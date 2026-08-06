// Unit tests for the epic completion evaluator (toon-meta#284). Run with:
//   npm run test:factory    (node --test scripts/factory/)
//
// The fixtures embed REAL fleet data fetched 2026-08-06 via the REST API:
//   * epic toon-meta#178 (sandcastle factory rollout) — the real completed
//     epic: all 15 children #180–#194 are closed as `completed`, every body
//     opening with the literal `## Parent\n\nPart of #178 — Epic: …` shape.
//     This is the "proven against a real completed epic" acceptance fixture.
//   * epic toon-meta#270 (AFK factory) — the live in-flight epic: children
//     #271–#286, of which #275/#279/#282/#283/#284/#285/#286 are open and the
//     other nine closed as completed (state_reason from REST).
//   * toon-meta#280's real closing PR toon-meta#300 (GraphQL
//     closedByPullRequestsReferences), for the completion-comment fixture.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  planCompletion,
  buildCompletionComment,
  buildEscalationComment,
  escalationMarker,
} from "./completion-evaluator.mjs";

const META = "toon-protocol/toon-meta";

// Real body shape shared by #180–#194 (verbatim opening lines of #180).
const partOf178 = (rest = "") =>
  `## Parent\n\nPart of #178 — Epic: stand up a sandcastle software factory in every execution repo; retire the old agent loops\n\n${rest}`;

const child = (number, title, state, stateReason, body) => ({
  repo: META,
  number,
  title,
  url: `https://github.com/toon-protocol/toon-meta/issues/${number}`,
  state,
  stateReason,
  body,
});

// ── The real completed epic: #178, children #180–#194 all completed ─────────

const EPIC_178 = {
  repo: META,
  number: 178,
  title:
    "Epic: stand up a sandcastle software factory in every execution repo; retire the old agent loops",
  url: "https://github.com/toon-protocol/toon-meta/issues/178",
  labels: ["epic"],
  body: "## Goal\n\nA software factory in every execution repo.",
};

const CHILDREN_178 = [
  [180, "Factory: store org-level CLAUDE_CODE_OAUTH_TOKEN Actions secret"],
  [181, "Factory: create FACTORY.md skeleton + shared conventions"],
  [182, "relay: scaffold .sandcastle/ + pnpm Dockerfile (image builds + plan passes)"],
  [183, "relay: establish green gate baseline (calibrates typecheck debt)"],
  [184, "relay: wire agent-implement/review workflows + land first merged PR"],
  [185, "relay: retire old 4 loops (closes the hard checkpoint)"],
  [186, "toon-client factory (large-monorepo scale proof)"],
  [187, "rig factory (pnpm repetition)"],
  [188, "toon factory (pnpm repetition; tighten lint budget)"],
  [189, "swap factory (pnpm repetition)"],
  [190, "store factory (lint-less pnpm + esbuild variant; merged-PR proof)"],
  [191, "connector factory (npm-workspaces + mina-zkapp variant; merged-PR proof)"],
  [192, "toon-meta docs factory (sequenced last; merged-PR proof)"],
  [193, "Closeout: org-wide straggler sweep + finalize FACTORY.md"],
  [194, "Archive swarm + capability-market (out of scope)"],
].map(([n, t]) => child(n, t, "closed", "completed", partOf178()));

// ── The live in-flight epic: #270, real 2026-08-06 states ───────────────────

const EPIC_270 = {
  repo: META,
  number: 270,
  title:
    "Epic: AFK factory — dependency-driven dispatch, enforced merge, and ticket housekeeping",
  url: "https://github.com/toon-protocol/toon-meta/issues/270",
  labels: ["epic"],
  body: "## Goal\n\nAFK factory.",
};

const COMPLETED_270 = [271, 272, 273, 274, 276, 277, 278, 280, 281];
const OPEN_270 = [275, 279, 282, 283, 284, 285, 286];
const CHILDREN_270 = [
  ...COMPLETED_270.map((n) => child(n, `ticket ${n}`, "closed", "completed", `Stuff.\n\nPart of #270\n`)),
  ...OPEN_270.map((n) => child(n, `ticket ${n}`, "open", null, `Stuff.\n\nPart of #270\n`)),
];

// ── planCompletion ──────────────────────────────────────────────────────────

describe("planCompletion — verdicts", () => {
  it("real completed epic #178: every child completed → close-epic action", () => {
    const plan = planCompletion({ epics: [EPIC_178], candidates: CHILDREN_178 });
    assert.equal(plan.epics.length, 1);
    const e = plan.epics[0];
    assert.equal(e.id, "toon-protocol/toon-meta#178");
    assert.equal(e.verdict, "complete");
    assert.equal(e.tally.completed.length, 15);
    assert.deepEqual(
      [e.tally.open.length, e.tally.notPlanned.length, e.tally.unknown.length],
      [0, 0, 0],
    );
    assert.equal(plan.actions.length, 1);
    assert.equal(plan.actions[0].type, "close-epic");
    assert.equal(plan.actions[0].epic.id, "toon-protocol/toon-meta#178");
    assert.deepEqual(
      plan.actions[0].completed.map((c) => c.number),
      CHILDREN_178.map((c) => c.number),
    );
  });

  it("live epic #270: seven open children → incomplete, no action, exact tally", () => {
    const plan = planCompletion({ epics: [EPIC_270], candidates: CHILDREN_270 });
    const e = plan.epics[0];
    assert.equal(e.verdict, "incomplete");
    assert.deepEqual(
      e.tally.open.map((c) => c.number),
      OPEN_270,
    );
    assert.deepEqual(
      e.tally.completed.map((c) => c.number),
      COMPLETED_270,
    );
    assert.equal(plan.actions.length, 0);
  });

  it("any not-planned child → escalate, never close, even if all others are completed", () => {
    const candidates = [
      ...CHILDREN_178.slice(0, 14),
      child(194, "Archive swarm (out of scope)", "closed", "not_planned", partOf178()),
    ];
    const plan = planCompletion({ epics: [EPIC_178], candidates });
    const e = plan.epics[0];
    assert.equal(e.verdict, "escalate");
    assert.equal(plan.actions.length, 1);
    assert.equal(plan.actions[0].type, "escalate-epic");
    assert.deepEqual(
      plan.actions[0].notPlanned.map((c) => c.number),
      [194],
    );
    assert.ok(!plan.actions.some((a) => a.type === "close-epic"));
  });

  it("not-planned outranks open: dropped scope is flagged while work is still in flight", () => {
    const candidates = [
      child(1, "open one", "open", null, "Part of #178"),
      child(2, "dropped one", "closed", "not_planned", "Part of #178"),
    ];
    const plan = planCompletion({ epics: [EPIC_178], candidates });
    assert.equal(plan.epics[0].verdict, "escalate");
    assert.equal(plan.actions[0].type, "escalate-epic");
  });

  it("an epic carrying needs:human is held — never closed, never re-escalated", () => {
    const held = { ...EPIC_178, labels: ["epic", "needs:human"] };
    for (const candidates of [
      CHILDREN_178, // all completed — would otherwise close
      [child(1, "dropped", "closed", "not_planned", "Part of #178")], // would otherwise escalate
    ]) {
      const plan = planCompletion({ epics: [held], candidates });
      assert.equal(plan.epics[0].verdict, "held");
      assert.equal(plan.actions.length, 0);
    }
  });

  it("closed WITHOUT a verifiable completed reason fails closed → incomplete", () => {
    for (const stateReason of [null, undefined, "reopened", "weird"]) {
      const candidates = [
        ...CHILDREN_178.slice(0, 14),
        child(194, "old close, no reason", "closed", stateReason, partOf178()),
      ];
      const plan = planCompletion({ epics: [EPIC_178], candidates });
      assert.equal(plan.epics[0].verdict, "incomplete", `stateReason=${stateReason}`);
      assert.equal(plan.epics[0].tally.unknown.length, 1);
      assert.equal(plan.actions.length, 0);
    }
  });

  it("an epic with no members is no-children — never closed", () => {
    const plan = planCompletion({
      epics: [EPIC_178],
      candidates: [child(9, "unrelated", "closed", "completed", "No membership line. Mentions #178 though.")],
    });
    assert.equal(plan.epics[0].verdict, "no-children");
    assert.equal(plan.actions.length, 0);
  });
});

describe("planCompletion — membership mechanics (reused from #280)", () => {
  it("duplicate candidates dedupe (first occurrence wins)", () => {
    const fresh = child(180, "fresh", "closed", "completed", partOf178());
    const stale = child(180, "stale", "open", null, partOf178());
    const plan = planCompletion({
      epics: [EPIC_178],
      candidates: [fresh, stale, ...CHILDREN_178.slice(1)],
    });
    assert.equal(plan.epics[0].verdict, "complete");
    assert.equal(plan.epics[0].tally.completed.length, 15);
  });

  it("a multi-epic child counts toward every epic it declares", () => {
    const both = child(
      500,
      "shared child",
      "closed",
      "completed",
      "Part of #178\n\nPart of #270\n",
    );
    const plan = planCompletion({ epics: [EPIC_178, EPIC_270], candidates: [both] });
    for (const e of plan.epics) {
      assert.equal(e.tally.completed.length, 1, e.id);
      assert.equal(e.verdict, "complete", e.id);
    }
    assert.equal(plan.actions.filter((a) => a.type === "close-epic").length, 2);
  });

  it("cross-repo children resolve against their own repo (connector#709 shape)", () => {
    const c = {
      repo: "toon-protocol/connector",
      number: 709,
      title: "prepaid window",
      url: "https://github.com/toon-protocol/connector/issues/709",
      state: "closed",
      stateReason: "completed",
      body: "Part of toon-protocol/toon-meta#178 (mesh). **The enabling change.**",
    };
    const plan = planCompletion({ epics: [EPIC_178], candidates: [c] });
    assert.equal(plan.epics[0].tally.completed[0].id, "toon-protocol/connector#709");
  });

  it("self-references never bind; non-epic-labeled inputs are ignored", () => {
    const selfRef = { ...EPIC_178, body: "Part of #178" };
    const notEpic = { repo: META, number: 9, title: "plain", labels: [], body: "x" };
    const plan = planCompletion({
      epics: [selfRef, notEpic],
      candidates: [{ ...selfRef, state: "open", stateReason: null }],
    });
    assert.equal(plan.epics.length, 1);
    assert.equal(plan.epics[0].verdict, "no-children");
  });
});

// ── Comment builders ────────────────────────────────────────────────────────

describe("comment builders", () => {
  it("completion comment lists every child with its closing PR (real #280→PR#300)", () => {
    const completed = [
      {
        id: "toon-protocol/toon-meta#280",
        title:
          "unblock dispatcher: dispatch what a closed ticket unblocks, one at a time per epic",
      },
      { id: "toon-protocol/toon-meta#281", title: "guard: let factory-ops through" },
    ];
    const comment = buildCompletionComment({
      epic: { id: "toon-protocol/toon-meta#270" },
      completed,
      childPrs: {
        // Real closing-PR reference fetched via GraphQL closedByPullRequestsReferences.
        "toon-protocol/toon-meta#280": [
          { url: "https://github.com/toon-protocol/toon-meta/pull/300", number: 300 },
        ],
      },
    });
    assert.match(comment, /closed \*\*as completed\*\* — closing the epic/);
    assert.match(
      comment,
      /- \[x\] toon-protocol\/toon-meta#280 — .* \(https:\/\/github\.com\/toon-protocol\/toon-meta\/pull\/300\)/,
    );
    // A child with no discoverable PR still appears, without a PR suffix.
    assert.match(comment, /- \[x\] toon-protocol\/toon-meta#281 — guard: let factory-ops through\n/);
    assert.match(comment, /Part of toon-protocol\/toon-meta#270/);
  });

  it("escalation comment names the dropped children, the tally, and the marker", () => {
    const marker = escalationMarker(META, 178);
    const comment = buildEscalationComment({
      epic: { id: "toon-protocol/toon-meta#178" },
      tally: {
        completed: Array(14).fill({}),
        open: [],
        notPlanned: [{ id: "toon-protocol/toon-meta#194", title: "Archive swarm" }],
        unknown: [],
      },
      marker,
    });
    assert.match(comment, /closed as \*\*not planned\*\*/);
    assert.match(comment, /- toon-protocol\/toon-meta#194 — Archive swarm/);
    assert.match(comment, /14 completed, 0 still open, 1 not planned, 0 unverifiable/);
    assert.ok(comment.includes(`<!-- ${marker} -->`));
    assert.match(comment, /Applying `needs:human`/);
  });

  it("escalationMarker is slash/hash-free and issue-specific", () => {
    const m = escalationMarker(META, 262);
    assert.equal(m, "epic-completion-not-planned:toon-protocol-toon-meta-issue-262");
    assert.notEqual(m, escalationMarker(META, 263));
  });
});
