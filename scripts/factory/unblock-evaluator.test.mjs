// Unit tests for the unblock evaluator (toon-meta#274). Run with:
//   npm run test:factory    (node --test scripts/factory/)
//
// The three "real shape" fixtures embed the `## Blocked by` sections of
// toon-meta#266, #232 and #248 VERBATIM (fetched 2026-08-05 via
// `gh issue view <n> --json body`), wrapped in a minimal realistic body.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseBlockedBy,
  resolveRef,
  isReady,
  detectCycles,
} from "./unblock-evaluator.mjs";

const SELF = { repo: "toon-protocol/toon-meta", number: 999 };
const body = (section) =>
  `## What to build\n\nSomething.\n\n${section}\n## Acceptance criteria\n\n- [ ] done\n`;

// ── Real shape 1: toon-meta#266 — None ──────────────────────────────────────
const FIXTURE_266 = body(`## Blocked by

None — start immediately.

`);

// ── Real shape 2: toon-meta#232 — clean qualified refs ──────────────────────
const FIXTURE_232 = body(`## Blocked by

- toon-protocol/relay#74 (relay baseline)
- toon-protocol/rig#8 (rig baseline)
- toon-protocol/swap#76 (swap baseline)
- toon-protocol/toon-client#432 (toon-client baseline)
- toon-protocol/toon#116 (toon baseline)

`);

const FIXTURE_232_IDS = [
  "toon-protocol/relay#74",
  "toon-protocol/rig#8",
  "toon-protocol/swap#76",
  "toon-protocol/toon-client#432",
  "toon-protocol/toon#116",
];
const COMPLETED = { state: "closed", stateReason: "completed" };
const allCompleted = Object.fromEntries(FIXTURE_232_IDS.map((id) => [id, COMPLETED]));

// ── Real shape 3: toon-meta#248 — ref + prose condition ─────────────────────
const FIXTURE_248_BULLET =
  "- connector#463 merging, and connector#459 confirming a real >1h chain-touching run pushes successfully. Do not fan this out to 8 repos before one repo has proven it live — the failure mode only appears on long runs, so a green short run is not evidence.";
const FIXTURE_248 = body(`## Blocked by

${FIXTURE_248_BULLET}

`);

// ── parseBlockedBy ──────────────────────────────────────────────────────────

describe("parseBlockedBy", () => {
  it("shape 1 (#266 verbatim): None → none, no edges, no unresolvable", () => {
    const p = parseBlockedBy(FIXTURE_266);
    assert.equal(p.found, true);
    assert.equal(p.none, true);
    assert.deepEqual(p.edges, []);
    assert.deepEqual(p.unresolvable, []);
  });

  it("shape 2 (#232 verbatim): five clean owner/repo#N edges with notes", () => {
    const p = parseBlockedBy(FIXTURE_232);
    assert.equal(p.found, true);
    assert.equal(p.none, false);
    assert.deepEqual(p.unresolvable, []);
    assert.equal(p.edges.length, 5);
    assert.deepEqual(
      p.edges.map((e) => `${e.owner}/${e.repo}#${e.number}`),
      FIXTURE_232_IDS,
    );
    assert.equal(p.edges[0].note, "relay baseline");
    assert.equal(p.edges[3].repo, "toon-client"); // hyphenated repo name
  });

  it("shape 3 (#248 verbatim): ref+condition bullet is unresolvable, yields NO edges", () => {
    const p = parseBlockedBy(FIXTURE_248);
    assert.equal(p.found, true);
    assert.equal(p.none, false);
    assert.deepEqual(p.edges, []); // the refs inside must NOT count as edges
    assert.equal(p.unresolvable.length, 1);
    assert.match(p.unresolvable[0].bullet, /connector#463 merging/);
    assert.match(p.unresolvable[0].reason, /prose condition/);
  });

  it("accepts bare #N, repo#N and owner/repo#N bullets", () => {
    const p = parseBlockedBy(body(`## Blocked by

- #7
- relay#74 (baseline)
- other-org/thing#3
`));
    assert.deepEqual(p.unresolvable, []);
    assert.deepEqual(
      p.edges.map((e) => [e.owner, e.repo, e.number]),
      [
        [null, null, 7],
        [null, "relay", 74],
        ["other-org", "thing", 3],
      ],
    );
  });

  it("None is case-insensitive and tolerates trailing prose / bullet form", () => {
    for (const s of ["None", "none.", "NONE — nothing here", "- None"]) {
      const p = parseBlockedBy(body(`## Blocked by\n\n${s}\n`));
      assert.equal(p.none, true, `expected none for ${JSON.stringify(s)}`);
    }
  });

  it("missing section → unresolvable, not ready (absence is not a declaration)", () => {
    const p = parseBlockedBy("## What to build\n\nStuff.\n");
    assert.equal(p.found, false);
    assert.equal(p.none, false);
    assert.equal(p.unresolvable.length, 1);
    assert.match(p.unresolvable[0].reason, /missing '## Blocked by'/);
  });

  it("empty section → unresolvable (fail closed)", () => {
    const p = parseBlockedBy(body("## Blocked by\n\n"));
    assert.equal(p.found, true);
    assert.equal(p.none, false);
    assert.equal(p.unresolvable.length, 1);
    assert.match(p.unresolvable[0].reason, /empty/);
  });

  it("a bullet mixing a ref and a condition is unresolvable, not its refs", () => {
    const p = parseBlockedBy(body("## Blocked by\n\n- #5 once the deploy is verified\n"));
    assert.deepEqual(p.edges, []);
    assert.equal(p.unresolvable.length, 1);
    assert.match(p.unresolvable[0].reason, /mixes an issue reference/);
  });

  it("multiple refs in one bullet fail closed (not one of the clean shapes)", () => {
    const p = parseBlockedBy(body("## Blocked by\n\n- relay#1, rig#2\n"));
    assert.deepEqual(p.edges, []);
    assert.equal(p.unresolvable.length, 1);
  });

  it("non-None prose in the section is an unresolvable condition", () => {
    const p = parseBlockedBy(body("## Blocked by\n\nWait for the devnet reset.\n"));
    assert.deepEqual(p.edges, []);
    assert.equal(p.unresolvable.length, 1);
    assert.match(p.unresolvable[0].bullet, /devnet reset/);
  });

  it("'None' alongside blocker bullets is contradictory → unresolvable", () => {
    const p = parseBlockedBy(body("## Blocked by\n\nNone\n\n- relay#74\n"));
    assert.equal(p.none, false);
    assert.deepEqual(p.edges, []);
    assert.match(p.unresolvable[0].reason, /contradictory/);
  });

  it("joins wrapped continuation lines into a single bullet", () => {
    const p = parseBlockedBy(
      body("## Blocked by\n\n- connector#463 merging, and connector#459 confirming\n  a real >1h run pushes successfully.\n"),
    );
    assert.equal(p.unresolvable.length, 1);
    assert.match(p.unresolvable[0].bullet, /confirming a real >1h run/);
  });
});

// ── resolveRef ──────────────────────────────────────────────────────────────

describe("resolveRef", () => {
  it("resolves bare and repo-qualified refs against the issue's own repo", () => {
    assert.equal(resolveRef({ owner: null, repo: null, number: 7 }, SELF.repo), "toon-protocol/toon-meta#7");
    assert.equal(resolveRef({ owner: null, repo: "relay", number: 74 }, SELF.repo), "toon-protocol/relay#74");
    assert.equal(resolveRef({ owner: "Other-Org", repo: "Thing", number: 3 }, SELF.repo), "other-org/thing#3");
  });
});

// ── isReady ─────────────────────────────────────────────────────────────────

describe("isReady", () => {
  it("#266 shape: None → ready with no blocker states needed", () => {
    const r = isReady({ ...SELF, body: FIXTURE_266 }, {});
    assert.equal(r.ready, true);
    assert.equal(r.verdict, "ready");
  });

  it("#232 shape: all blockers closed as completed → ready", () => {
    const r = isReady({ ...SELF, body: FIXTURE_232 }, allCompleted);
    assert.equal(r.ready, true);
    assert.equal(r.verdict, "ready");
    assert.equal(r.blockers.completed.length, 5);
  });

  it("#232 shape: one blocker still open → blocked, names it", () => {
    const states = { ...allCompleted, "toon-protocol/rig#8": { state: "open" } };
    const r = isReady({ ...SELF, body: FIXTURE_232 }, states);
    assert.equal(r.ready, false);
    assert.equal(r.verdict, "blocked");
    assert.deepEqual(r.blockers.open, ["toon-protocol/rig#8"]);
    assert.match(r.reasons.join("\n"), /toon-protocol\/rig#8/);
  });

  it("#232 shape: a blocker closed as not planned → needs-human, never satisfied", () => {
    const states = { ...allCompleted, "toon-protocol/swap#76": { state: "closed", stateReason: "not_planned" } };
    const r = isReady({ ...SELF, body: FIXTURE_232 }, states);
    assert.equal(r.ready, false);
    assert.equal(r.verdict, "needs-human");
    assert.deepEqual(r.blockers.notPlanned, ["toon-protocol/swap#76"]);
    assert.match(r.reasons.join("\n"), /not planned/);
  });

  it("#232 shape: missing state for a blocker fails closed → needs-human", () => {
    const states = { ...allCompleted };
    delete states["toon-protocol/toon#116"];
    const r = isReady({ ...SELF, body: FIXTURE_232 }, states);
    assert.equal(r.ready, false);
    assert.equal(r.verdict, "needs-human");
    assert.deepEqual(r.blockers.unknown, ["toon-protocol/toon#116"]);
  });

  it("#248 shape: prose condition → needs-human, reason names the bullet", () => {
    const r = isReady({ ...SELF, body: FIXTURE_248 }, {
      // Even if both referenced issues are completed, the bullet stays unresolvable.
      "toon-protocol/connector#463": COMPLETED,
      "toon-protocol/connector#459": COMPLETED,
    });
    assert.equal(r.ready, false);
    assert.equal(r.verdict, "needs-human");
    assert.match(r.reasons.join("\n"), /connector#463 merging/);
  });

  it("missing '## Blocked by' section → needs-human, not ready", () => {
    const r = isReady({ ...SELF, body: "## What to build\n\nStuff.\n" }, {});
    assert.equal(r.ready, false);
    assert.equal(r.verdict, "needs-human");
    assert.match(r.reasons.join("\n"), /missing '## Blocked by'/);
  });

  it("bare #N resolves against the issue's own repo; gh-style casing accepted", () => {
    const r = isReady(
      { ...SELF, body: body("## Blocked by\n\n- #7\n") },
      { "toon-protocol/toon-meta#7": { state: "CLOSED", stateReason: "COMPLETED" } },
    );
    assert.equal(r.ready, true);
  });

  it("blockerStates keys match case-insensitively and Maps are accepted", () => {
    const r = isReady(
      { ...SELF, body: body("## Blocked by\n\n- Relay#74\n") },
      new Map([["toon-protocol/RELAY#74", COMPLETED]]),
    );
    assert.equal(r.ready, true);
  });

  it("closed without a verifiable 'completed' reason fails closed → needs-human", () => {
    const r = isReady(
      { ...SELF, body: body("## Blocked by\n\n- #7\n") },
      { "toon-protocol/toon-meta#7": { state: "closed", stateReason: "" } },
    );
    assert.equal(r.ready, false);
    assert.equal(r.verdict, "needs-human");
    assert.deepEqual(r.blockers.unknown, ["toon-protocol/toon-meta#7"]);
  });

  it("a member of a cycle is never dispatched, even with all blockers completed", () => {
    const r = isReady(
      { ...SELF, body: body("## Blocked by\n\n- #7\n") },
      { "toon-protocol/toon-meta#7": COMPLETED },
      { cycleMembers: ["toon-protocol/toon-meta#999"] },
    );
    assert.equal(r.ready, false);
    assert.equal(r.verdict, "cycle");
  });
});

// ── detectCycles ────────────────────────────────────────────────────────────

describe("detectCycles", () => {
  const iss = (number, section) => ({
    repo: "toon-protocol/toon-meta",
    number,
    body: body(section),
  });

  it("finds a two-node cycle and leaves outsiders alone", () => {
    const cycles = detectCycles([
      iss(1, "## Blocked by\n\n- #2\n"),
      iss(2, "## Blocked by\n\n- #1\n"),
      iss(3, "## Blocked by\n\n- #1\n"), // depends on the cycle, not in it
    ]);
    assert.equal(cycles.length, 1);
    assert.deepEqual(
      [...cycles[0]].sort(),
      ["toon-protocol/toon-meta#1", "toon-protocol/toon-meta#2"],
    );
  });

  it("finds a self-loop", () => {
    const cycles = detectCycles([iss(5, "## Blocked by\n\n- #5\n")]);
    assert.deepEqual(cycles, [["toon-protocol/toon-meta#5"]]);
  });

  it("no cycles in an acyclic graph; edges out of the known set are dead ends", () => {
    const cycles = detectCycles([
      iss(1, "## Blocked by\n\n- #2\n- relay#74\n"),
      iss(2, "## Blocked by\n\nNone\n"),
    ]);
    assert.deepEqual(cycles, []);
  });

  it("cycle members flow into isReady and block dispatch", () => {
    const issues = [iss(1, "## Blocked by\n\n- #2\n"), iss(2, "## Blocked by\n\n- #1\n")];
    const cycleMembers = detectCycles(issues).flat();
    const r = isReady(
      { repo: "toon-protocol/toon-meta", number: 1, body: issues[0].body },
      { "toon-protocol/toon-meta#2": COMPLETED },
      { cycleMembers },
    );
    assert.equal(r.verdict, "cycle");
    assert.equal(r.ready, false);
  });
});
