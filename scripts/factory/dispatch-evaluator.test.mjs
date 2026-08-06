// Unit tests for the dispatch evaluator (toon-meta#280). Run with:
//   npm run test:factory    (node --test scripts/factory/)
//
// The `Part of` fixtures embed the real declaration shapes fetched 2026-08-05
// via `gh issue view --json body`: toon-meta#282's trailing `Part of #270`
// line and connector#709's leading `Part of toon-protocol/toon-meta#265
// (mesh-compute earning). **The enabling change…**` line.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseEpicRefs,
  prIssueIds,
  collectBlockerIds,
  planDispatch,
  needsHumanMarker,
  EXCLUDED_LABELS,
  IMPLEMENT_LABEL,
} from "./dispatch-evaluator.mjs";

const META = "toon-protocol/toon-meta";
const FLEET = [
  "toon-protocol/relay",
  "toon-protocol/toon-client",
  "toon-protocol/rig",
  "toon-protocol/store",
  "toon-protocol/connector",
  "toon-protocol/toon",
  "toon-protocol/swap",
  "toon-protocol/toon-meta",
  "toon-protocol/Forge",
  "toon-protocol/fractal",
  "toon-protocol/buzz",
];
const COMPLETED = { state: "closed", stateReason: "completed" };
const NOT_PLANNED = { state: "closed", stateReason: "not_planned" };

// ── parseEpicRefs ───────────────────────────────────────────────────────────

describe("parseEpicRefs", () => {
  it("real shape: trailing `Part of #270` line (toon-meta#282)", () => {
    const body = "Five repos require an approving review.\n\n## Scope\n\n- stuff\n\n\nPart of #270\n";
    assert.deepEqual(parseEpicRefs(body, META), ["toon-protocol/toon-meta#270"]);
  });

  it("real shape: leading qualified ref with trailing prose (connector#709)", () => {
    const body =
      "Part of toon-protocol/toon-meta#265 (mesh-compute earning). **The enabling change, and it is worth more than the epic that surfaced it.**\n\nMore prose.";
    assert.deepEqual(parseEpicRefs(body, "toon-protocol/connector"), [
      "toon-protocol/toon-meta#265",
    ]);
  });

  it("resolves `repo#N` against the issue's own owner", () => {
    assert.deepEqual(parseEpicRefs("Part of toon-meta#270", "toon-protocol/relay"), [
      "toon-protocol/toon-meta#270",
    ]);
  });

  it("accepts list-marker and bold prefixes, case-insensitively", () => {
    assert.deepEqual(parseEpicRefs("- part of #12", META), ["toon-protocol/toon-meta#12"]);
    assert.deepEqual(parseEpicRefs("**Part of #12**", META), ["toon-protocol/toon-meta#12"]);
  });

  it("collects multiple memberships, deduplicated, in order", () => {
    const body = "Part of #1\n\nPart of toon-protocol/relay#2\n\nPart of #1\n";
    assert.deepEqual(parseEpicRefs(body, META), [
      "toon-protocol/toon-meta#1",
      "toon-protocol/relay#2",
    ]);
  });

  it("does NOT bind mid-sentence 'part of' prose or ref-less lines", () => {
    assert.deepEqual(parseEpicRefs("This is part of the plan for #270.", META), []);
    assert.deepEqual(parseEpicRefs("Part of the wider effort", META), []);
    assert.deepEqual(parseEpicRefs(null, META), []);
  });
});

// ── prIssueIds ──────────────────────────────────────────────────────────────

describe("prIssueIds", () => {
  it("maps the sandcastle/issue-<n> branch convention to the PR's own repo", () => {
    assert.deepEqual(
      prIssueIds({ repo: "toon-protocol/relay", headRefName: "sandcastle/issue-74" }),
      ["toon-protocol/relay#74"],
    );
    assert.deepEqual(prIssueIds({ repo: "toon-protocol/relay", headRefName: "agent/issue-3" }), [
      "toon-protocol/relay#3",
    ]);
  });

  it("collects close-keyword refs from title and body, cross-repo capable", () => {
    const ids = prIssueIds({
      repo: "toon-protocol/buzz",
      headRefName: "sandcastle/issue-90",
      title: "huddles: seal frames (closes #90)",
      body: "Fixes toon-protocol/toon-meta#265\nResolves buzz#91",
    });
    assert.deepEqual(ids, [
      "toon-protocol/buzz#90",
      "toon-protocol/toon-meta#265",
      "toon-protocol/buzz#91",
    ]);
  });

  it("returns nothing for a non-factory branch with no close refs", () => {
    assert.deepEqual(
      prIssueIds({ repo: "toon-protocol/relay", headRefName: "feature/foo", body: "docs" }),
      [],
    );
  });
});

// ── collectBlockerIds ───────────────────────────────────────────────────────

describe("collectBlockerIds", () => {
  it("collects unique canonical ids from clean edges only", () => {
    const ids = collectBlockerIds([
      { repo: META, body: "## Blocked by\n\n- #1\n- toon-protocol/relay#2\n" },
      { repo: "toon-protocol/relay", body: "## Blocked by\n\n- #2\n- some prose condition\n" },
    ]);
    assert.deepEqual(ids.sort(), ["toon-protocol/relay#2", "toon-protocol/toon-meta#1"]);
  });
});

// ── planDispatch fixtures ───────────────────────────────────────────────────

const epicIssue = (number, extra = {}) => ({
  repo: META,
  number,
  title: `Epic ${number}`,
  url: `https://github.com/toon-protocol/toon-meta/issues/${number}`,
  labels: ["epic"],
  body: "The epic body.",
  ...extra,
});

const child = (repo, number, { epic = 100, blockedBy = "None — start immediately.", labels = [], ...extra } = {}) => ({
  repo,
  number,
  title: `Child ${number}`,
  url: `https://github.com/${repo}/issues/${number}`,
  labels,
  // Mirrors the real ticket shape (#282 etc.): the `Part of` trailer sits
  // AFTER a heading-closed section. A `Part of` line directly inside the
  // `## Blocked by` section would read as a prose condition and fail closed.
  body: `Work.\n\n## Blocked by\n\n${blockedBy}\n\n## Acceptance criteria\n\n- [ ] done\n\nPart of toon-protocol/toon-meta#${epic}\n`,
  ...extra,
});

const actionFor = (plan, id) => plan.actions.find((a) => a.child.id === id);

// ── planDispatch ────────────────────────────────────────────────────────────

describe("planDispatch — serialization", () => {
  it("dispatches exactly ONE ready child per epic; the rest queue", () => {
    const plan = planDispatch({
      openIssues: [
        epicIssue(100),
        child(META, 5),
        child(META, 3),
        child(META, 7, { blockedBy: "- #3" }),
      ],
      fleetRepos: FLEET,
    });
    // Deterministic pick: lowest canonical id among ready children.
    assert.equal(actionFor(plan, "toon-protocol/toon-meta#3").type, "dispatch");
    assert.equal(actionFor(plan, "toon-protocol/toon-meta#5").type, "queue");
    assert.equal(actionFor(plan, "toon-protocol/toon-meta#7").type, "blocked");
    assert.equal(plan.epics[0].dispatched, "toon-protocol/toon-meta#3");
    assert.equal(plan.epics[0].stalled, false);
  });

  it("a busy epic (open agent PR on a child) dispatches nothing — ready children queue", () => {
    const plan = planDispatch({
      openIssues: [epicIssue(100), child(META, 3), child(META, 5)],
      agentPrs: [
        {
          repo: META,
          number: 900,
          url: "https://github.com/toon-protocol/toon-meta/pull/900",
          headRefName: "sandcastle/issue-5",
          title: "impl",
          body: "Closes #5",
        },
      ],
      fleetRepos: FLEET,
    });
    assert.equal(actionFor(plan, "toon-protocol/toon-meta#3").type, "queue");
    assert.equal(actionFor(plan, "toon-protocol/toon-meta#5").type, "in-flight-pr");
    assert.equal(plan.epics[0].dispatched, null);
    assert.ok(plan.epics[0].busyWith.some((b) => b.includes("pull/900")));
  });

  it("an agent PR whose linked issue is already CLOSED still marks the epic busy (via prLinkedBodies)", () => {
    const plan = planDispatch({
      openIssues: [epicIssue(100), child(META, 3)],
      agentPrs: [
        { repo: META, number: 901, headRefName: "sandcastle/issue-50", body: "Closes #50" },
      ],
      prLinkedBodies: {
        "toon-protocol/toon-meta#50": { body: "Done.\n\nPart of #100\n" },
      },
      fleetRepos: FLEET,
    });
    assert.equal(actionFor(plan, "toon-protocol/toon-meta#3").type, "queue");
  });

  it("a child already carrying agent:implement makes the epic busy", () => {
    const plan = planDispatch({
      openIssues: [
        epicIssue(100),
        child(META, 3),
        child(META, 5, { labels: [IMPLEMENT_LABEL] }),
      ],
      fleetRepos: FLEET,
    });
    assert.equal(actionFor(plan, "toon-protocol/toon-meta#5").type, "in-flight-label");
    assert.equal(actionFor(plan, "toon-protocol/toon-meta#3").type, "queue");
  });

  it("independent epics dispatch in parallel (one each)", () => {
    const plan = planDispatch({
      openIssues: [
        epicIssue(100),
        epicIssue(200),
        child(META, 3, { epic: 100 }),
        child("toon-protocol/relay", 9, { epic: 200 }),
      ],
      fleetRepos: FLEET,
    });
    assert.equal(actionFor(plan, "toon-protocol/toon-meta#3").type, "dispatch");
    assert.equal(actionFor(plan, "toon-protocol/relay#9").type, "dispatch");
  });

  it("a multi-epic child needs ALL its epics free", () => {
    const multi = {
      repo: META,
      number: 8,
      title: "Child 8",
      labels: [],
      body: "Work.\n\n## Blocked by\n\nNone.\n\nPart of #100\nPart of #200\n",
    };
    const plan = planDispatch({
      openIssues: [epicIssue(100), epicIssue(200), multi],
      agentPrs: [
        {
          repo: META,
          number: 902,
          headRefName: "sandcastle/issue-77",
          body: "Closes #77",
        },
      ],
      prLinkedBodies: { "toon-protocol/toon-meta#77": { body: "Part of #200\n" } },
      fleetRepos: FLEET,
    });
    assert.equal(actionFor(plan, "toon-protocol/toon-meta#8").type, "queue");
  });
});

describe("planDispatch — exclusions and needs-human routing", () => {
  it("never dispatches epic/tracking/needs:human children", () => {
    for (const label of EXCLUDED_LABELS) {
      const plan = planDispatch({
        openIssues: [epicIssue(100), child(META, 3, { labels: [label] })],
        fleetRepos: FLEET,
      });
      assert.equal(actionFor(plan, "toon-protocol/toon-meta#3").type, "excluded", label);
    }
  });

  it("a not-planned blocker routes to needs-human, never dispatch", () => {
    const plan = planDispatch({
      openIssues: [epicIssue(100), child(META, 3, { blockedBy: "- toon-protocol/relay#2" })],
      blockerStates: { "toon-protocol/relay#2": NOT_PLANNED },
      fleetRepos: FLEET,
    });
    const a = actionFor(plan, "toon-protocol/toon-meta#3");
    assert.equal(a.type, "needs-human");
    assert.ok(a.reasons.some((r) => r.includes("not planned")));
  });

  it("an unresolvable (prose) blocker routes to needs-human", () => {
    const plan = planDispatch({
      openIssues: [
        epicIssue(100),
        child(META, 3, { blockedBy: "- relay#2 merging, and a real >1h run confirming it" }),
      ],
      fleetRepos: FLEET,
    });
    assert.equal(actionFor(plan, "toon-protocol/toon-meta#3").type, "needs-human");
  });

  it("an unknown blocker state fails closed to needs-human", () => {
    const plan = planDispatch({
      openIssues: [epicIssue(100), child(META, 3, { blockedBy: "- toon-protocol/relay#2" })],
      blockerStates: {}, // shell failed to fetch it
      fleetRepos: FLEET,
    });
    assert.equal(actionFor(plan, "toon-protocol/toon-meta#3").type, "needs-human");
  });

  it("dependency-cycle members are routed to needs-human, never dispatched", () => {
    const a = child(META, 3, { blockedBy: "- #4" });
    const b = child(META, 4, { blockedBy: "- #3" });
    const plan = planDispatch({ openIssues: [epicIssue(100), a, b], fleetRepos: FLEET });
    assert.equal(plan.cycles.length, 1);
    assert.equal(actionFor(plan, "toon-protocol/toon-meta#3").type, "needs-human");
    assert.equal(actionFor(plan, "toon-protocol/toon-meta#4").type, "needs-human");
  });

  it("an open blocker means blocked (wait), not needs-human", () => {
    const plan = planDispatch({
      openIssues: [
        epicIssue(100),
        child(META, 3, { blockedBy: "- #5" }),
        child(META, 5), // open blocker, present in the fleet scan
      ],
      fleetRepos: FLEET,
    });
    assert.equal(actionFor(plan, "toon-protocol/toon-meta#3").type, "blocked");
  });

  it("a completed blocker releases the child", () => {
    const plan = planDispatch({
      openIssues: [epicIssue(100), child(META, 3, { blockedBy: "- toon-protocol/relay#2 (baseline)" })],
      blockerStates: { "toon-protocol/relay#2": COMPLETED },
      fleetRepos: FLEET,
    });
    assert.equal(actionFor(plan, "toon-protocol/toon-meta#3").type, "dispatch");
  });

  it("a ready child outside the fleet is reported, not dispatched", () => {
    const plan = planDispatch({
      openIssues: [epicIssue(100), child("toon-protocol/elsewhere", 3)],
      fleetRepos: FLEET,
    });
    assert.equal(actionFor(plan, "toon-protocol/elsewhere#3").type, "outside-fleet");
  });
});

describe("planDispatch — epic summaries", () => {
  it("flags a stalled epic (no in-flight PR, no ready child)", () => {
    const plan = planDispatch({
      openIssues: [
        epicIssue(100),
        child(META, 3, { blockedBy: "- #5" }),
        child(META, 5, { blockedBy: "- #3" }), // cycle → needs-human, nothing ready
      ],
      fleetRepos: FLEET,
    });
    assert.equal(plan.epics[0].stalled, true);
  });

  it("issues with no Part-of line, and Part-of refs to non-epics, bind nothing", () => {
    const plain = { repo: META, number: 40, labels: [], body: "No membership here." };
    const refsNonEpic = {
      repo: META,
      number: 41,
      labels: [],
      body: "Part of #40\n", // #40 is not an epic
    };
    const plan = planDispatch({ openIssues: [epicIssue(100), plain, refsNonEpic], fleetRepos: FLEET });
    assert.equal(plan.actions.length, 0);
    assert.equal(plan.epics[0].openChildren, 0);
  });

  it("is deterministic: identical inputs produce an identical plan (race convergence)", () => {
    const input = () => ({
      openIssues: [
        epicIssue(100),
        child(META, 5),
        child(META, 3),
        child("toon-protocol/relay", 9, { epic: 100 }),
      ],
      fleetRepos: FLEET,
    });
    assert.deepEqual(planDispatch(input()), planDispatch(input()));
  });
});

describe("needsHumanMarker", () => {
  it("is slash/hash-free and unique per repo+issue", () => {
    const m = needsHumanMarker("toon-protocol/relay", 7);
    assert.equal(m, "unblock-dispatcher-needs-human:toon-protocol-relay-issue-7");
    assert.ok(!m.includes("/") && !m.includes("#"));
  });
});
