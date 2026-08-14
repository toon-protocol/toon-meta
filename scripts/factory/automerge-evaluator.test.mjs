// Unit tests for the auto-merge evaluator (toon-meta#285). Run with:
//   npm run test:factory    (node --test scripts/factory/*.test.mjs)
//
// Every fixture below is a REAL live shape read on 2026-08-06 (`gh pr view
// --json ...`, `gh api repos/…/branches/main/protection`), so the acceptance
// criteria are asserted against the fleet as it actually is:
//   * Forge#50   — green `gate`, BEHIND base, no review          (ruleset)
//   * fractal#34 — green `gate`, BEHIND base, no review          (classic)
//   * toon#157   — green rollup, but the required `CI OK` context never
//                  reported (protection was repointed under it)  (classic)
//   * connector#826 — red required check                          (classic)
//   * connector#825 — red + `needs:human`                         (classic)
//   * buzz       — repointed to the `CI OK` aggregate by #279 (no longer excluded)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  planAutoMerge,
  latestOpinionatedReviews,
  normalizeLogin,
  requiredCheckStates,
  DEFAULT_EXCLUDED_REPOS,
} from "./automerge-evaluator.mjs";

const APPROVER = "factory-ops";
const HEAD = "0123456789abcdef0123456789abcdef01234567";

// Live protection, read 2026-08-06. NOTE: relay/toon-client/rig/store/toon/
// swap require `CI OK` (FACTORY.md's table still says `build` — the drift
// #279 is fixing); connector requires `CI Status Summary`; Forge's comes from
// a ruleset, not classic protection.
const POLICIES = {
  "toon-protocol/forge": {
    requiredContexts: ["gate"],
    strict: true,
    source: "ruleset",
    autoMergeAllowed: false,
  },
  "toon-protocol/fractal": {
    requiredContexts: ["gate"],
    strict: true,
    source: "classic",
    autoMergeAllowed: false,
  },
  "toon-protocol/toon": {
    requiredContexts: ["CI OK"],
    strict: true,
    source: "classic",
    autoMergeAllowed: false,
  },
  "toon-protocol/connector": {
    requiredContexts: ["CI Status Summary"],
    strict: true,
    source: "classic",
    autoMergeAllowed: false,
  },
  "toon-protocol/buzz": {
    requiredContexts: ["CI OK"],
    strict: true,
    source: "classic",
    autoMergeAllowed: false,
  },
  "toon-protocol/unprotected": { requiredContexts: [], source: "none" },
};

const approval = (over = {}) => ({
  author: APPROVER,
  state: "APPROVED",
  commitId: HEAD,
  submittedAt: "2026-08-06T12:00:00Z",
  ...over,
});

/** A PR that satisfies every precondition — each test breaks exactly one. */
const eligiblePr = (over = {}) => ({
  repo: "toon-protocol/Forge",
  number: 50,
  title: "forge-cli: author templates/archetypes/service/",
  url: "https://github.com/toon-protocol/Forge/pull/50",
  headRefName: "sandcastle/issue-49",
  headSha: HEAD,
  isDraft: false,
  labels: [],
  mergeable: "MERGEABLE",
  mergeStateStatus: "CLEAN",
  reviewDecision: "",
  reviews: [approval()],
  statusCheckRollup: [{ name: "gate", status: "COMPLETED", conclusion: "SUCCESS" }],
  autoMergeEnabled: false,
  author: "app/toon-backlog-bot",
  linkedIssues: [{ id: "toon-protocol/forge#49", labels: ["agent:implement"] }],
  ...over,
});

const plan = (pr, extra = {}) =>
  planAutoMerge({
    prs: [pr],
    repoPolicies: POLICIES,
    approvers: [APPROVER],
    ...extra,
  }).decisions[0];

const codes = (d) => d.blockers.map((b) => b.code);

// ── AC: a green, approved, conflict-free agent PR merges ────────────────────
describe("the happy path", () => {
  it("merges a green, approved, conflict-free agent PR", () => {
    const d = plan(eligiblePr());
    assert.deepEqual(d.blockers, []);
    assert.equal(d.verdict, "merge");
    assert.equal(d.action.type, "merge"); // Forge has allow_auto_merge=false
    assert.equal(d.action.method, "squash");
  });

  it("arms GitHub's native auto-merge when the repo allows it", () => {
    const d = planAutoMerge({
      prs: [eligiblePr()],
      repoPolicies: {
        ...POLICIES,
        "toon-protocol/forge": { ...POLICIES["toon-protocol/forge"], autoMergeAllowed: true },
      },
      approvers: [APPROVER],
    }).decisions[0];
    assert.equal(d.verdict, "merge");
    assert.equal(d.action.type, "enable-auto-merge");
  });

  it("does nothing to a PR whose native auto-merge is already armed", () => {
    const d = plan(eligiblePr({ autoMergeEnabled: true }));
    assert.equal(d.verdict, "already-armed");
    assert.equal(d.action, null);
  });

  it("honours a repo's configured merge method", () => {
    const d = planAutoMerge({
      prs: [eligiblePr()],
      repoPolicies: {
        ...POLICIES,
        "toon-protocol/forge": { ...POLICIES["toon-protocol/forge"], mergeMethod: "merge" },
      },
      approvers: [APPROVER],
    }).decisions[0];
    assert.equal(d.action.method, "merge");
  });
});

// ── AC: an empty or skipped check set does NOT merge ────────────────────────
describe("check-set honesty (acceptance criterion)", () => {
  it("refuses a PR with an EMPTY check set", () => {
    const d = plan(eligiblePr({ statusCheckRollup: [] }));
    assert.equal(d.verdict, "blocked");
    assert.ok(codes(d).includes("required-check-missing"));
    assert.ok(codes(d).includes("checks-unverified"));
  });

  it("refuses a PR whose required check is SKIPPED, though protection accepts it", () => {
    const d = plan(
      eligiblePr({
        statusCheckRollup: [{ name: "gate", status: "COMPLETED", conclusion: "SKIPPED" }],
      }),
    );
    assert.equal(d.verdict, "blocked");
    assert.ok(codes(d).includes("required-check-unverified"));
    assert.match(
      d.blockers.find((b) => b.code === "required-check-unverified").detail,
      /skipped check is not a pass/,
    );
  });

  it("refuses toon#157's real shape: the required context never reported", () => {
    // toon's protection was repointed to `CI OK`; this PR predates it and
    // reports `build` instead. Everything is green — and it still must not
    // merge, because the check protection requires did not run.
    const d = plan(
      eligiblePr({
        repo: "toon-protocol/toon",
        number: 157,
        headRefName: "sandcastle/issue-153",
        statusCheckRollup: [
          { name: "Build sandcastle agent image", conclusion: "SUCCESS" },
          { name: "build", conclusion: "SUCCESS" },
          { name: "Devbox Environment Validation", conclusion: "SUCCESS" },
          { name: "Gate speed/performance no-regression guard", conclusion: "SUCCESS" },
        ],
      }),
    );
    assert.equal(d.verdict, "blocked");
    assert.deepEqual(codes(d), ["required-check-missing"]);
    assert.equal(d.signals.checks, "passed"); // the rollup IS green — and irrelevant
  });

  it("refuses connector#826's real shape: required check CANCELLED", () => {
    const d = plan(
      eligiblePr({
        repo: "toon-protocol/connector",
        number: 826,
        headRefName: "sandcastle/issue-817",
        mergeStateStatus: "BLOCKED",
        statusCheckRollup: [
          { name: "Lint and Format Check", conclusion: "SUCCESS" },
          { name: "Security Audit", conclusion: "FAILURE" },
          { name: "Rust Workspace Gate", conclusion: "FAILURE" },
          { name: "Solana Program Tests (Rust)", conclusion: "SUCCESS" },
          { name: "Devbox Environment Validation", conclusion: "FAILURE" },
          { name: "CI Status Summary", conclusion: "CANCELLED" },
        ],
      }),
    );
    assert.equal(d.verdict, "blocked");
    assert.ok(codes(d).includes("required-check-not-green"));
    assert.ok(codes(d).includes("checks-failing"));
    assert.ok(codes(d).includes("merge-state"));
  });

  it("refuses while checks are still running", () => {
    const d = plan(
      eligiblePr({
        statusCheckRollup: [
          { name: "gate", status: "IN_PROGRESS" },
          { name: "extra", conclusion: "SUCCESS" },
        ],
      }),
    );
    assert.equal(d.verdict, "blocked");
    assert.ok(codes(d).includes("checks-pending"));
  });

  it("refuses when a NON-required check is red, though protection would merge", () => {
    const d = plan(
      eligiblePr({
        mergeStateStatus: "UNSTABLE",
        statusCheckRollup: [
          { name: "gate", conclusion: "SUCCESS" },
          { name: "flaky-extra", conclusion: "FAILURE" },
        ],
      }),
    );
    assert.equal(d.verdict, "blocked");
    assert.ok(codes(d).includes("checks-failing"));
  });
});

// ── AC: a PR with needs:human does not merge ────────────────────────────────
describe("needs:human (acceptance criterion)", () => {
  it("refuses a PR labelled needs:human", () => {
    const d = plan(eligiblePr({ labels: [{ name: "needs:human" }] }));
    assert.equal(d.verdict, "blocked");
    assert.deepEqual(codes(d), ["needs-human"]);
  });

  it("refuses when the LINKED ISSUE is labelled needs:human", () => {
    const d = plan(
      eligiblePr({
        linkedIssues: [{ id: "toon-protocol/forge#49", labels: ["needs:human"] }],
      }),
    );
    assert.equal(d.verdict, "blocked");
    assert.deepEqual(codes(d), ["needs-human-issue"]);
  });

  it("accepts plain string labels as well as gh's object shape", () => {
    assert.deepEqual(codes(plan(eligiblePr({ labels: ["needs:human"] }))), ["needs-human"]);
  });
});

// ── The reviewer verdict + factory-ops approval ─────────────────────────────
describe("approval — the #275 verdict as submitted by #282", () => {
  it("refuses a PR with no review at all (Forge#50 / fractal#34 today)", () => {
    const d = plan(eligiblePr({ reviews: [] }));
    assert.equal(d.verdict, "blocked");
    assert.deepEqual(codes(d), ["approval-missing"]);
  });

  it("refuses an approval from anyone who is not the factory-ops identity", () => {
    const d = plan(eligiblePr({ reviews: [approval({ author: "some-passer-by" })] }));
    assert.deepEqual(codes(d), ["approval-missing"]);
  });

  it("matches the approver across app/ and [bot] login shapes", () => {
    assert.equal(normalizeLogin("app/factory-ops"), "factory-ops");
    assert.equal(normalizeLogin("Factory-Ops[bot]"), "factory-ops");
    const d = plan(eligiblePr({ reviews: [approval({ author: "app/Factory-Ops" })] }));
    assert.equal(d.verdict, "merge");
  });

  it("refuses when a CHANGES_REQUESTED review is outstanding", () => {
    const d = plan(
      eligiblePr({
        reviews: [approval(), { author: "a-human", state: "CHANGES_REQUESTED", commitId: HEAD }],
      }),
    );
    assert.equal(d.verdict, "blocked");
    assert.deepEqual(codes(d), ["review-changes-requested"]);
  });

  it("lets a later APPROVED override that same author's CHANGES_REQUESTED", () => {
    const d = plan(
      eligiblePr({
        reviews: [
          { author: APPROVER, state: "CHANGES_REQUESTED", commitId: HEAD },
          approval(),
        ],
      }),
    );
    assert.equal(d.verdict, "merge");
  });

  it("does not let a COMMENTED review override an approval", () => {
    const d = plan(
      eligiblePr({ reviews: [approval(), { author: APPROVER, state: "COMMENTED" }] }),
    );
    assert.equal(d.verdict, "merge");
  });

  it("treats a DISMISSED approval as no approval", () => {
    const d = plan(
      eligiblePr({ reviews: [approval(), { author: APPROVER, state: "DISMISSED" }] }),
    );
    assert.deepEqual(codes(d), ["approval-missing"]);
  });

  it("refuses an approval left on an older commit", () => {
    const d = plan(eligiblePr({ reviews: [approval({ commitId: "deadbeefdeadbeef" })] }));
    assert.equal(d.verdict, "blocked");
    assert.deepEqual(codes(d), ["approval-stale"]);
  });

  it("accepts an approval whose commit is unknown (API shape without oid)", () => {
    const d = plan(eligiblePr({ reviews: [approval({ commitId: undefined })] }));
    assert.equal(d.verdict, "merge");
  });

  it("refuses when protection still reports REVIEW_REQUIRED", () => {
    const d = plan(eligiblePr({ reviewDecision: "REVIEW_REQUIRED" }));
    assert.equal(d.verdict, "blocked");
    assert.deepEqual(codes(d), ["review-required"]);
  });

  it("fails closed when no approver identity could be resolved", () => {
    const d = planAutoMerge({
      prs: [eligiblePr()],
      repoPolicies: POLICIES,
      approvers: [],
    }).decisions[0];
    assert.equal(d.verdict, "blocked");
    assert.deepEqual(codes(d), ["approver-unknown"]);
  });

  it("refuses to let the approver identity merge a PR it authored itself", () => {
    const d = plan(eligiblePr({ author: APPROVER }));
    assert.equal(d.verdict, "blocked");
    assert.ok(codes(d).includes("approver-is-author"));
  });

  it("reduces reviews to the latest opinionated one per author", () => {
    const latest = latestOpinionatedReviews([
      { author: "a", state: "COMMENTED" },
      { author: "a", state: "CHANGES_REQUESTED" },
      { author: "a", state: "APPROVED" },
      { author: "b", state: "PENDING" },
    ]);
    assert.equal(latest.get("a").state, "APPROVED");
    assert.equal(latest.has("b"), false);
  });
});

// ── Mergeability + merge state ──────────────────────────────────────────────
describe("mergeability and merge state", () => {
  it("repairs a conflicting PR that is otherwise eligible (toon-meta#357)", () => {
    // #357: "mergeable: CONFLICTING is never transient and never repo-level,
    // so it dispatches immediately with no classification" — a PR blocked on
    // nothing but the conflict is a repair candidate, not a permanent stall.
    const d = plan(eligiblePr({ mergeable: "CONFLICTING", mergeStateStatus: "DIRTY" }));
    assert.equal(d.verdict, "repair");
    assert.ok(codes(d).includes("conflict"));
    assert.equal(d.action.type, "apply-label");
    assert.equal(d.action.label, "agent:fix");
  });

  it("blocks (does not repair) a conflicting PR that also carries needs:human", () => {
    const d = plan(eligiblePr({ mergeable: "CONFLICTING", mergeStateStatus: "DIRTY", labels: ["needs:human"] }));
    assert.equal(d.verdict, "blocked");
    assert.ok(codes(d).includes("conflict"));
    assert.ok(codes(d).includes("needs-human"));
  });

  it("refuses a PR whose mergeability never settled — never judged clean", () => {
    const d = plan(eligiblePr({ mergeable: "UNKNOWN" }));
    assert.equal(d.verdict, "blocked");
    assert.ok(codes(d).includes("mergeable-unsettled"));
  });

  it("refuses a BLOCKED merge state even when we found nothing else wrong", () => {
    const d = plan(eligiblePr({ mergeStateStatus: "BLOCKED" }));
    assert.equal(d.verdict, "blocked");
    assert.deepEqual(codes(d), ["merge-state"]);
  });

  it("fails closed on an unrecognized merge state", () => {
    const d = plan(eligiblePr({ mergeStateStatus: "SOMETHING_NEW" }));
    assert.equal(d.verdict, "blocked");
    assert.match(d.blockers[0].detail, /failing closed/);
  });

  it("refuses a draft", () => {
    const d = plan(eligiblePr({ isDraft: true, mergeStateStatus: "DRAFT" }));
    assert.equal(d.verdict, "blocked");
    assert.ok(codes(d).includes("draft"));
  });

  it("never touches a non-factory branch", () => {
    const d = plan(eligiblePr({ headRefName: "feature/human-work" }));
    assert.equal(d.verdict, "blocked");
    assert.ok(codes(d).includes("not-factory-branch"));
  });
});

// ── BEHIND base is an action, not a verdict (strict protection, #272) ───────
describe("strict protection: behind base", () => {
  it("updates the branch when everything else holds (Forge#50 / fractal#34)", () => {
    const d = plan(eligiblePr({ mergeStateStatus: "BEHIND" }));
    assert.deepEqual(d.blockers, []);
    assert.equal(d.verdict, "update-branch");
    assert.equal(d.action.type, "update-branch");
    // Pinned to the head we judged, so a branch that moved meanwhile is not
    // acted on blind.
    assert.equal(d.action.headSha, HEAD);
  });

  it("does NOT update the branch of a PR that is blocked for other reasons", () => {
    const d = plan(eligiblePr({ mergeStateStatus: "BEHIND", reviews: [] }));
    assert.equal(d.verdict, "blocked");
    assert.equal(d.action, null);
  });
});

// ── Per-repo enablement ─────────────────────────────────────────────────────
describe("per-repo enablement", () => {
  it("refuses a repo with no enforced required check", () => {
    const d = plan(eligiblePr({ repo: "toon-protocol/unprotected" }));
    assert.equal(d.verdict, "blocked");
    assert.deepEqual(codes(d), ["repo-not-enabled"]);
  });

  it("refuses a repo missing from the policy map entirely", () => {
    const d = plan(eligiblePr({ repo: "toon-protocol/somewhere-else" }));
    assert.deepEqual(codes(d), ["repo-not-enabled"]);
  });

  it("fails closed, and loudly, when the protection could not be READ", () => {
    const d = planAutoMerge({
      prs: [eligiblePr()],
      repoPolicies: {
        "toon-protocol/forge": { requiredContexts: [], readError: "HTTP 403" },
      },
      approvers: [APPROVER],
    }).decisions[0];
    assert.equal(d.verdict, "blocked");
    assert.deepEqual(codes(d), ["policy-unreadable"]);
    assert.match(d.blockers[0].detail, /unreadable policy is not an absent one/);
  });

  it("no longer excludes buzz now that it's repointed to the CI OK aggregate (#279)", () => {
    const d = plan(
      eligiblePr({
        repo: "toon-protocol/buzz",
        statusCheckRollup: [{ name: "CI OK", conclusion: "SUCCESS" }],
      }),
    );
    assert.deepEqual(d.blockers, []);
    assert.equal(d.verdict, "merge");
    assert.ok(!("toon-protocol/buzz" in DEFAULT_EXCLUDED_REPOS));
    assert.deepEqual(DEFAULT_EXCLUDED_REPOS, {});
  });

  it("still refuses buzz on the retired interim pair — CI OK never reported", () => {
    // Guards against a stale repoPolicies cache: if something still hands us
    // buzz's old #272 requiredContexts, this must fail on required-check
    // shape, not silently pass because the exclusion is gone.
    const d = plan(
      eligiblePr({
        repo: "toon-protocol/buzz",
        statusCheckRollup: [
          { name: "Detect Changed Paths", conclusion: "SUCCESS" },
          { name: "Dead Token Reference Guard", conclusion: "SUCCESS" },
        ],
      }),
    );
    assert.equal(d.verdict, "blocked");
    assert.ok(codes(d).includes("required-check-missing"));
  });
});

// ── Reporting shape ─────────────────────────────────────────────────────────
describe("the pass as a whole", () => {
  it("reports EVERY failed precondition, not just the first", () => {
    const d = plan(
      eligiblePr({
        labels: ["needs:human"],
        reviews: [],
        mergeable: "CONFLICTING",
        mergeStateStatus: "DIRTY",
        statusCheckRollup: [],
      }),
    );
    assert.deepEqual(codes(d).sort(), [
      "approval-missing",
      "checks-unverified",
      "conflict",
      "merge-state",
      "needs-human",
      "required-check-missing",
    ]);
  });

  it("is deterministic and ordered by canonical id", () => {
    const prs = [
      eligiblePr({ repo: "toon-protocol/fractal", number: 34 }),
      eligiblePr({ repo: "toon-protocol/Forge", number: 50 }),
    ];
    const a = planAutoMerge({ prs, repoPolicies: POLICIES, approvers: [APPROVER] });
    const b = planAutoMerge({
      prs: [...prs].reverse(),
      repoPolicies: POLICIES,
      approvers: [APPROVER],
    });
    assert.deepEqual(
      a.decisions.map((d) => d.id),
      ["toon-protocol/forge#50", "toon-protocol/fractal#34"],
    );
    assert.deepEqual(a.decisions.map((d) => d.id), b.decisions.map((d) => d.id));
    assert.deepEqual(a.summary, { merge: 2 });
  });

  it("collects actions and counts verdicts", () => {
    const out = planAutoMerge({
      prs: [
        eligiblePr(),
        eligiblePr({ repo: "toon-protocol/fractal", number: 34, mergeStateStatus: "BEHIND" }),
        eligiblePr({ repo: "toon-protocol/connector", number: 825, labels: ["needs:human"] }),
      ],
      repoPolicies: POLICIES,
      approvers: [APPROVER],
    });
    assert.deepEqual(out.summary, { merge: 1, "update-branch": 1, blocked: 1 });
    assert.deepEqual(out.actions.map((a) => a.type).sort(), ["merge", "update-branch"]);
  });

  it("reports which required contexts were checked, and from where", () => {
    const d = plan(eligiblePr());
    assert.deepEqual(d.signals.requiredChecks, [
      { context: "gate", state: "SUCCESS", status: "passed" },
    ]);
    assert.equal(d.signals.requiredSource, "ruleset");
    assert.deepEqual(d.signals.approvedBy, [APPROVER]);
  });

  it("requiredCheckStates classifies missing / skipped / green independently", () => {
    assert.deepEqual(
      requiredCheckStates(["a", "b", "c"], [
        { name: "a", conclusion: "SUCCESS" },
        { name: "b", conclusion: "SKIPPED" },
      ]),
      [
        { context: "a", state: "SUCCESS", status: "passed" },
        { context: "b", state: "SKIPPED", status: "not-verifying" },
        { context: "c", state: "∅", status: "missing" },
      ],
    );
  });
});

describe("PR repair: retry / repair / escalate (toon-meta#357)", () => {
  const FAILING_ROLLUP = [
    { name: "gate", status: "COMPLETED", conclusion: "FAILURE" },
  ];
  const TRANSIENT_ROLLUP = [
    {
      name: "setup-toolchain",
      status: "COMPLETED",
      conclusion: "FAILURE",
      errorText: "curl: (22) The requested URL returned error: 503 from artifacts.nixos.org",
    },
  ];

  it("repairs a genuinely failing PR that is otherwise eligible", () => {
    const d = plan(eligiblePr({ statusCheckRollup: FAILING_ROLLUP }));
    assert.equal(d.verdict, "repair");
    assert.ok(codes(d).includes("checks-failing"));
    assert.equal(d.action.type, "apply-label");
    assert.equal(d.action.label, "agent:fix");
    assert.equal(d.signals.repair.classification, "genuine");
  });

  it("retries a transient-looking failure for free — no agent action", () => {
    const d = plan(eligiblePr({ statusCheckRollup: TRANSIENT_ROLLUP }), {
      repoPolicies: {
        ...POLICIES,
        "toon-protocol/forge": { ...POLICIES["toon-protocol/forge"], requiredContexts: ["setup-toolchain"] },
      },
    });
    assert.equal(d.verdict, "retry");
    assert.equal(d.action.type, "rerun-failed-jobs");
    assert.deepEqual(d.action.checks, ["setup-toolchain"]);
  });

  it("escalates when the same check is also red on main", () => {
    const d = plan(
      eligiblePr({ repo: "toon-protocol/toon", statusCheckRollup: [{ name: "CI OK", status: "COMPLETED", conclusion: "FAILURE" }] }),
      { mainRollups: { "toon-protocol/toon": [{ name: "CI OK", conclusion: "FAILURE" }] } },
    );
    assert.equal(d.verdict, "escalate");
    assert.equal(d.action.type, "apply-label");
    assert.equal(d.action.label, "needs:human");
    assert.match(d.signals.repair.reason, /also failing on main/);
  });

  it("escalates once the repair-attempt budget is spent", () => {
    const d = plan(eligiblePr({ statusCheckRollup: FAILING_ROLLUP }), {
      repairAttempts: { "toon-protocol/forge#50": 2 },
    });
    assert.equal(d.verdict, "escalate");
  });

  it("never dispatches a second repair while agent:fix is already in flight", () => {
    const d = plan(eligiblePr({ statusCheckRollup: FAILING_ROLLUP, labels: ["agent:fix"] }));
    assert.equal(d.verdict, "blocked");
    assert.equal(d.action, null);
  });

  it("stays blocked (never repaired) when CHANGES_REQUESTED is also outstanding", () => {
    const d = plan(
      eligiblePr({
        statusCheckRollup: FAILING_ROLLUP,
        reviews: [{ author: "someone", state: "CHANGES_REQUESTED", commitId: HEAD }],
      }),
    );
    assert.equal(d.verdict, "blocked");
    assert.ok(codes(d).includes("review-changes-requested"));
    assert.ok(codes(d).includes("checks-failing"));
  });

  it("stays blocked (never repaired) when needs:human is also present", () => {
    const d = plan(eligiblePr({ statusCheckRollup: FAILING_ROLLUP, labels: ["needs:human"] }));
    assert.equal(d.verdict, "blocked");
    assert.ok(codes(d).includes("needs-human"));
  });

  it("does not repair a PR whose required check is merely still pending", () => {
    const d = plan(
      eligiblePr({
        statusCheckRollup: [{ name: "gate", status: "IN_PROGRESS", conclusion: "" }],
      }),
    );
    assert.equal(d.verdict, "blocked");
    assert.equal(d.signals.repair, null);
  });
});
