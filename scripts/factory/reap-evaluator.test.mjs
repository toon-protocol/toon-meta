// Unit tests for the dead-label reap evaluator (toon-meta#330). Run with:
//   npm run test:factory    (node --test scripts/factory/)
//
// Fixtures model the three real wedged tickets named in #330's "Observed"
// table: buzz#90 (timeout, no branch), buzz#43 (timeout, claimed branch never
// pushed), rig#23 (success, no changes — the shape that rules out a
// failure-only reaper).

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canonicalBranches,
  isDecoyRun,
  findRunForLabel,
  classifyOutcome,
  choosePairing,
  evaluateTicket,
  appendBlockerRef,
  buildReapComment,
  reapMarker,
  reapMarkerPrefix,
  JOB_TIMEOUT_MINUTES,
  NO_RUN_GRACE_MINUTES,
  PUSHED_NOTHING_BLOCKER_REF,
  REPEAT_WINDOW_HOURS,
} from "./reap-evaluator.mjs";

const RUN_URL = "https://github.com/toon-protocol/buzz/actions/runs/1";

// ── canonicalBranches ─────────────────────────────────────────────────────

describe("canonicalBranches", () => {
  it("returns both factory branch conventions", () => {
    assert.deepEqual(canonicalBranches(90), ["sandcastle/issue-90", "agent/issue-90"]);
  });
});

// ── isDecoyRun ────────────────────────────────────────────────────────────

describe("isDecoyRun", () => {
  it("a run-level skipped conclusion is a decoy — the guard job itself never ran", () => {
    assert.equal(isDecoyRun({ status: "completed", conclusion: "skipped" }), true);
  });

  it("a guard REFUSAL is not a decoy — it concludes success (buzz run 31330244708)", () => {
    // guard=success, implement=skipped → the run concludes `success`. This is
    // the buzz#6 shape and is classified as `guard-skipped` from the job
    // conclusions, never from the run conclusion.
    assert.equal(isDecoyRun({ status: "completed", conclusion: "success" }), false);
  });

  it("an in-progress run is never a decoy", () => {
    assert.equal(isDecoyRun({ status: "in_progress", conclusion: null }), false);
  });

  it("tolerates missing fields", () => {
    assert.equal(isDecoyRun(undefined), false);
    assert.equal(isDecoyRun({}), false);
  });
});

// ── findRunForLabel ───────────────────────────────────────────────────────

describe("findRunForLabel", () => {
  it("prefers an exact displayTitle match over time-window candidates", () => {
    const runs = [
      { url: "a", createdAt: "2026-08-09T14:00:00Z", displayTitle: "agent:implement" }, // decoy, in-window
      { url: "b", createdAt: "2026-08-09T14:00:05Z", displayTitle: "agent:implement — issue #90" },
    ];
    const run = findRunForLabel({ runs, issueNumber: 90, labeledAt: "2026-08-09T14:00:00Z" });
    assert.equal(run.url, "b");
  });

  it("picks the most recent among multiple exact matches (re-labeled ticket)", () => {
    const runs = [
      { url: "old", createdAt: "2026-08-01T00:00:00Z", displayTitle: "agent:implement — issue #90" },
      { url: "new", createdAt: "2026-08-09T14:00:05Z", displayTitle: "agent:implement — issue #90" },
    ];
    const run = findRunForLabel({ runs, issueNumber: 90, labeledAt: "2026-08-09T14:00:00Z" });
    assert.equal(run.url, "new");
  });

  it("falls back to the nearest-after run in the time window when no run-name exists", () => {
    const runs = [
      { url: "before", createdAt: "2026-08-09T13:58:00Z" }, // before labeling, out
      { url: "after1", createdAt: "2026-08-09T14:00:10Z" }, // nearest after
      { url: "after2", createdAt: "2026-08-09T14:03:00Z" },
    ];
    const run = findRunForLabel({ runs, issueNumber: 90, labeledAt: "2026-08-09T14:00:00Z" });
    assert.equal(run.url, "after1");
  });

  it("respects toleranceSeconds for clock skew just before labeledAt", () => {
    const runs = [{ url: "skew", createdAt: "2026-08-09T13:59:45Z" }]; // 15s early
    const run = findRunForLabel({
      runs,
      issueNumber: 90,
      labeledAt: "2026-08-09T14:00:00Z",
      toleranceSeconds: 30,
    });
    assert.equal(run.url, "skew");
  });

  it("returns null when nothing falls in the window and no exact match exists", () => {
    const runs = [{ url: "far", createdAt: "2026-08-09T20:00:00Z" }];
    const run = findRunForLabel({ runs, issueNumber: 90, labeledAt: "2026-08-09T14:00:00Z" });
    assert.equal(run, null);
  });

  it("returns null on an empty run list", () => {
    assert.equal(
      findRunForLabel({ runs: [], issueNumber: 90, labeledAt: "2026-08-09T14:00:00Z" }),
      null,
    );
  });

  // ── DECOY RUNS ──────────────────────────────────────────────────────────
  // agent-implement.yml fires on EVERY issues.labeled event and its `guard`
  // job is gated on `github.event.label.name == 'agent:implement'`, so an
  // unrelated label mints a run in which NOTHING ran — the run concludes
  // `skipped` — under the SAME run-name. Observed live on buzz#90: adding
  // `tracking` mid-run minted exactly this decoy. A run-level `skipped`
  // conclusion is therefore always a decoy and never evidence about an
  // agent:implement labeling. (A guard REFUSAL concludes `success` with the
  // `implement` job skipped — verified on buzz run 31330244708 — and is
  // classified separately as `guard-skipped`.)

  it("never prefers a completed decoy over the still-running real run", () => {
    const runs = [
      {
        url: "real",
        status: "in_progress",
        conclusion: null,
        createdAt: "2026-08-09T14:00:05Z",
        displayTitle: "agent:implement — issue #90",
      },
      {
        url: "decoy",
        status: "completed",
        conclusion: "skipped",
        createdAt: "2026-08-09T14:03:00Z", // LATER — would win on recency alone
        displayTitle: "agent:implement — issue #90",
      },
    ];
    const run = findRunForLabel({ runs, issueNumber: 90, labeledAt: "2026-08-09T14:00:00Z" });
    assert.equal(run.url, "real", "a live run must win outright — #330 criterion 2");
    assert.notEqual(run.status, "completed");
  });

  it("prefers a real finished run over a decoy minted after it", () => {
    const runs = [
      {
        url: "real",
        status: "completed",
        conclusion: "failure",
        createdAt: "2026-08-09T14:00:05Z",
        displayTitle: "agent:implement — issue #90",
      },
      {
        url: "decoy",
        status: "completed",
        conclusion: "skipped",
        createdAt: "2026-08-09T14:50:00Z",
        displayTitle: "agent:implement — issue #90",
      },
    ];
    const run = findRunForLabel({ runs, issueNumber: 90, labeledAt: "2026-08-09T14:00:00Z" });
    assert.equal(run.url, "real");
    assert.equal(run.conclusion, "failure", "the comment must name the real outcome");
  });

  it("correlates NOTHING to a lone decoy — a skipped run is never evidence", () => {
    // The real run aged out of the fetched page (or never fired at all while an
    // unrelated label minted a decoy inside the window). Returning the decoy
    // would classify it `failed` and post a comment naming a run that did no
    // work, asserting a failure that never happened — #330 criterion 4.
    const runs = [
      {
        url: "decoy",
        status: "completed",
        conclusion: "skipped",
        createdAt: "2026-08-09T14:00:05Z",
        displayTitle: "agent:implement — issue #90",
      },
    ];
    const run = findRunForLabel({ runs, issueNumber: 90, labeledAt: "2026-08-09T14:00:00Z" });
    assert.equal(run, null, "no run correlates — the grace-gated no-run-found path owns this");
  });

  it("a decoy-only exact match never falls through to the time-window tier", () => {
    // A title match names THIS issue outright. If its only matches are decoys,
    // the answer is "nothing correlates" — not some other ticket's run that
    // happened to start in the same minute.
    const runs = [
      {
        url: "decoy-for-90",
        status: "completed",
        conclusion: "skipped",
        createdAt: "2026-08-09T14:00:05Z",
        displayTitle: "agent:implement — issue #90",
      },
      {
        url: "real-run-for-a-different-ticket",
        status: "completed",
        conclusion: "failure",
        createdAt: "2026-08-09T14:00:08Z",
        displayTitle: "agent:implement — issue #91",
      },
    ];
    const run = findRunForLabel({ runs, issueNumber: 90, labeledAt: "2026-08-09T14:00:00Z" });
    assert.equal(run, null, "a foreign run must never decide this ticket's fate");
  });

  it("correlates nothing when the time-window tier holds only decoys", () => {
    const runs = [
      { url: "decoy", status: "completed", conclusion: "skipped", createdAt: "2026-08-09T14:00:02Z" },
    ];
    const run = findRunForLabel({ runs, issueNumber: 90, labeledAt: "2026-08-09T14:00:00Z" });
    assert.equal(run, null);
  });

  it("still finds the real run when a decoy sits in front of it in the window", () => {
    const runs = [
      { url: "decoy", status: "completed", conclusion: "skipped", createdAt: "2026-08-09T14:00:02Z" },
      { url: "real", status: "completed", conclusion: "failure", createdAt: "2026-08-09T14:00:10Z" },
    ];
    const run = findRunForLabel({ runs, issueNumber: 90, labeledAt: "2026-08-09T14:00:00Z" });
    assert.equal(run.url, "real", "nearest-after applies among REAL runs only");
  });

  it("ignores an exact-title run created before the current labeling", () => {
    const runs = [
      {
        url: "previous-cycle",
        status: "completed",
        conclusion: "failure",
        createdAt: "2026-08-01T00:00:00Z",
        displayTitle: "agent:implement — issue #90",
      },
    ];
    const run = findRunForLabel({ runs, issueNumber: 90, labeledAt: "2026-08-09T14:00:00Z" });
    assert.equal(run, null, "an earlier cycle's run must not decide this labeling");
  });

  it("fails closed in the time-window tier too when a live run is present", () => {
    const runs = [
      { url: "decoy", status: "completed", conclusion: "skipped", createdAt: "2026-08-09T14:00:02Z" },
      { url: "real", status: "in_progress", conclusion: null, createdAt: "2026-08-09T14:00:10Z" },
    ];
    const run = findRunForLabel({ runs, issueNumber: 90, labeledAt: "2026-08-09T14:00:00Z" });
    assert.equal(run.url, "real", "nearest-after must not override the live-run guarantee");
  });
});

// ── classifyOutcome ───────────────────────────────────────────────────────

describe("classifyOutcome", () => {
  it("success with no PR is succeeded-with-no-changes (rig#23 shape)", () => {
    const run = { conclusion: "success", createdAt: "2026-08-08T20:00:00Z", updatedAt: "2026-08-08T20:05:00Z" };
    assert.equal(classifyOutcome({ run }), "succeeded-with-no-changes");
  });

  it("failure long enough to span the step timeout is timed-out even without a timed_out conclusion", () => {
    // Step-level timeout surfaces as a plain `failure` conclusion — duration is the tell.
    const run = {
      conclusion: "failure",
      createdAt: "2026-08-09T14:07:00Z",
      updatedAt: "2026-08-09T14:57:00Z", // 50 minutes
    };
    assert.equal(classifyOutcome({ run }), "timed-out");
  });

  it("an explicit timed_out conclusion is timed-out regardless of duration", () => {
    const run = { conclusion: "timed_out", createdAt: "2026-08-09T14:07:00Z", updatedAt: "2026-08-09T14:10:00Z" };
    assert.equal(classifyOutcome({ run }), "timed-out");
  });

  it("a claimed branch that does not exist is pushed-nothing, even at the ~50m buzz#43 duration", () => {
    // buzz#43 ran ~50 minutes (the same step-timeout shape as buzz#90) but
    // ALSO commented a branch claim that turned out false. pushed-nothing
    // takes priority over timed-out: it is the more actionable diagnosis (a
    // straight retry once #331 is fixed) than "split the work up".
    const run = { conclusion: "failure", createdAt: "2026-08-09T03:27:00Z", updatedAt: "2026-08-09T04:17:00Z" };
    assert.equal(classifyOutcome({ run, branchClaimed: true, branchExists: false }), "pushed-nothing");
  });

  it("a claimed branch that does not exist, on a short failure, is still pushed-nothing", () => {
    const run = { conclusion: "failure", createdAt: "2026-08-09T03:27:00Z", updatedAt: "2026-08-09T03:35:00Z" };
    assert.equal(classifyOutcome({ run, branchClaimed: true, branchExists: false }), "pushed-nothing");
  });

  it("a claimed branch that DOES exist is not pushed-nothing", () => {
    const run = { conclusion: "failure", createdAt: "2026-08-09T03:27:00Z", updatedAt: "2026-08-09T03:35:00Z" };
    assert.equal(classifyOutcome({ run, branchClaimed: true, branchExists: true }), "failed");
  });

  it("cancelled short run is cancelled", () => {
    const run = { conclusion: "cancelled", createdAt: "2026-08-09T03:27:00Z", updatedAt: "2026-08-09T03:30:00Z" };
    assert.equal(classifyOutcome({ run }), "cancelled");
  });

  it("plain failure short run is failed", () => {
    const run = { conclusion: "failure", createdAt: "2026-08-09T03:27:00Z", updatedAt: "2026-08-09T03:30:00Z" };
    assert.equal(classifyOutcome({ run }), "failed");
  });

  it("success with the implement job skipped is guard-skipped, not succeeded-with-no-changes (buzz#6 shape)", () => {
    const run = { conclusion: "success", createdAt: "2026-08-10T00:00:00Z", updatedAt: "2026-08-10T00:02:00Z" };
    assert.equal(classifyOutcome({ run, implementJobSkipped: true }), "guard-skipped");
  });

  it("a decoy never classifies as failed (defence in depth — findRunForLabel filters them)", () => {
    const run = {
      status: "completed",
      conclusion: "skipped",
      createdAt: "2026-08-10T00:00:00Z",
      updatedAt: "2026-08-10T00:00:20Z",
    };
    assert.equal(classifyOutcome({ run }), "no-run-found");
  });
});

// ── choosePairing ─────────────────────────────────────────────────────────

describe("choosePairing", () => {
  it("guard-skipped pairs with tracking — a parent-shaped ticket is never re-dispatchable", () => {
    assert.deepEqual(choosePairing("guard-skipped"), { kind: "tracking" });
  });

  it("pushed-nothing pairs with a blocker ref naming the known root cause", () => {
    assert.deepEqual(choosePairing("pushed-nothing"), {
      kind: "blocker",
      ref: PUSHED_NOTHING_BLOCKER_REF,
    });
  });

  for (const outcome of ["succeeded-with-no-changes", "timed-out", "failed", "cancelled", "no-run-found"]) {
    it(`${outcome} pairs with needs-human (no known ticket to point at)`, () => {
      assert.deepEqual(choosePairing(outcome), { kind: "needs-human" });
    });
  }
});

// ── appendBlockerRef ──────────────────────────────────────────────────────

describe("appendBlockerRef", () => {
  const REF = "toon-protocol/toon-meta#331";
  const SELF = "toon-protocol/buzz";

  it("replaces a bare None declaration with the bullet", () => {
    const body = "Some text.\n\n## Blocked by\n\nNone — start immediately.\n\n## Other\nstuff";
    const out = appendBlockerRef(body, REF, SELF);
    assert.match(out, /- toon-protocol\/toon-meta#331/);
    assert.doesNotMatch(out, /None/);
  });

  it("appends after existing bullets without disturbing them", () => {
    const body = "## Blocked by\n\n- #10 (baseline)\n- toon-protocol/relay#5\n\n## Acceptance\nfoo";
    const out = appendBlockerRef(body, REF, SELF);
    assert.match(out, /- #10 \(baseline\)/);
    assert.match(out, /- toon-protocol\/relay#5/);
    assert.match(out, /- toon-protocol\/toon-meta#331/);
    assert.match(out, /## Acceptance\nfoo/);
  });

  it("adds a new section when none exists", () => {
    const out = appendBlockerRef("Just a body, no section.", REF, SELF);
    assert.match(out, /## Blocked by/);
    assert.match(out, /- toon-protocol\/toon-meta#331/);
  });

  it("is idempotent — never duplicates the bullet across repeated reaps", () => {
    const body = "## Blocked by\n\n- toon-protocol/toon-meta#331\n";
    assert.equal(appendBlockerRef(body, REF, SELF), body);
  });

  it("recognizes a bare #331 bullet (same repo) as already present", () => {
    const body = "## Blocked by\n\n- #331\n";
    assert.equal(appendBlockerRef(body, "toon-protocol/toon-meta#331", "toon-protocol/toon-meta"), body);
  });
});

// ── evaluateTicket ────────────────────────────────────────────────────────

const ISSUE_90 = { repo: "toon-protocol/buzz", number: 90, title: "…", url: "https://x/90" };

describe("evaluateTicket", () => {
  it("an open PR always wins, even with no correlated run at all", () => {
    const out = evaluateTicket({
      issue: ISSUE_90,
      runs: [],
      hasOpenPr: true,
      labeledAt: "2026-08-09T14:07:00Z",
      now: "2026-08-09T20:00:00Z",
    });
    assert.equal(out.verdict, "open-pr");
  });

  it("a correlated in-progress run is never touched", () => {
    const runs = [
      { url: RUN_URL, status: "in_progress", conclusion: null, createdAt: "2026-08-09T14:07:05Z" },
    ];
    const out = evaluateTicket({
      issue: ISSUE_90,
      runs,
      hasOpenPr: false,
      labeledAt: "2026-08-09T14:07:00Z",
      now: "2026-08-09T14:20:00Z",
    });
    assert.equal(out.verdict, "in-progress");
  });

  it("buzz#90 shape: correlated failure, no branch claim, no open PR → reap as failed/timed-out", () => {
    const runs = [
      {
        url: RUN_URL,
        status: "completed",
        conclusion: "failure",
        createdAt: "2026-08-09T14:07:00Z",
        updatedAt: "2026-08-09T14:57:00Z", // 50 minutes
        displayTitle: "agent:implement — issue #90",
      },
    ];
    const out = evaluateTicket({
      issue: ISSUE_90,
      runs,
      hasOpenPr: false,
      labeledAt: "2026-08-09T14:07:00Z",
      now: "2026-08-09T15:10:00Z",
    });
    assert.equal(out.verdict, "reap");
    assert.equal(out.outcome, "timed-out");
    assert.equal(out.run.url, RUN_URL);
    assert.deepEqual(out.pairing, { kind: "needs-human" }, "no known ticket to point at");
    assert.equal(out.repeated, false);
  });

  it("buzz#43 shape: failure + claimed branch that does not exist → pushed-nothing", () => {
    const runs = [
      {
        url: RUN_URL,
        status: "completed",
        conclusion: "failure",
        createdAt: "2026-08-09T03:27:00Z",
        updatedAt: "2026-08-09T03:35:00Z",
      },
    ];
    const out = evaluateTicket({
      issue: { ...ISSUE_90, number: 43 },
      runs,
      hasOpenPr: false,
      labeledAt: "2026-08-09T03:27:00Z",
      now: "2026-08-09T04:00:00Z",
      branchClaimed: true,
      branchExists: false,
    });
    assert.equal(out.verdict, "reap");
    assert.equal(out.outcome, "pushed-nothing");
    assert.deepEqual(out.pairing, { kind: "blocker", ref: PUSHED_NOTHING_BLOCKER_REF });
  });

  it("rig#23 shape: success, no PR → reap as succeeded-with-no-changes, not skipped", () => {
    const runs = [
      {
        url: "https://github.com/toon-protocol/rig/actions/runs/2",
        status: "completed",
        conclusion: "success",
        createdAt: "2026-08-08T20:25:00Z",
        updatedAt: "2026-08-08T20:30:00Z",
      },
    ];
    const out = evaluateTicket({
      issue: { repo: "toon-protocol/rig", number: 23, title: "…", url: "https://x/23" },
      runs,
      hasOpenPr: false,
      labeledAt: "2026-08-08T20:25:00Z",
      now: "2026-08-08T21:00:00Z",
    });
    assert.equal(out.verdict, "reap");
    assert.equal(out.outcome, "succeeded-with-no-changes");
    assert.deepEqual(out.pairing, { kind: "needs-human" });
  });

  it("buzz#6 shape: success + implement job skipped → guard-skipped, paired with tracking", () => {
    const runs = [
      {
        url: "https://github.com/toon-protocol/buzz/actions/runs/6",
        status: "completed",
        conclusion: "success",
        createdAt: "2026-08-10T00:00:00Z",
        updatedAt: "2026-08-10T00:02:00Z",
      },
    ];
    const out = evaluateTicket({
      issue: { repo: "toon-protocol/buzz", number: 6, title: "…", url: "https://x/6" },
      runs,
      hasOpenPr: false,
      labeledAt: "2026-08-10T00:00:00Z",
      now: "2026-08-10T00:05:00Z",
      implementJobSkipped: true,
    });
    assert.equal(out.verdict, "reap");
    assert.equal(out.outcome, "guard-skipped");
    assert.deepEqual(out.pairing, { kind: "tracking" });
  });

  it("a ticket reaped once already within the repeat window escalates to needs:human, overriding the usual pairing", () => {
    const runs = [
      {
        url: "https://github.com/toon-protocol/buzz/actions/runs/6",
        status: "completed",
        conclusion: "success",
        createdAt: "2026-08-10T00:00:00Z",
        updatedAt: "2026-08-10T00:02:00Z",
      },
    ];
    const out = evaluateTicket({
      issue: { repo: "toon-protocol/buzz", number: 6, title: "…", url: "https://x/6" },
      runs,
      hasOpenPr: false,
      labeledAt: "2026-08-10T00:00:00Z",
      now: "2026-08-10T00:05:00Z",
      implementJobSkipped: true, // would normally pair with tracking
      priorReapTimestamps: ["2026-08-09T22:00:00Z"], // 2h05m before `now`, inside the 6h window
    });
    assert.equal(out.verdict, "reap");
    assert.equal(out.repeated, true);
    assert.deepEqual(out.pairing, { kind: "needs-human" });
    assert.match(out.reasons.at(-1), /repeat-death/);
  });

  it("a prior reap outside the repeat window does not escalate", () => {
    const runs = [
      {
        url: RUN_URL,
        status: "completed",
        conclusion: "failure",
        createdAt: "2026-08-09T14:07:00Z",
        updatedAt: "2026-08-09T14:57:00Z",
        displayTitle: "agent:implement — issue #90",
      },
    ];
    const out = evaluateTicket({
      issue: ISSUE_90,
      runs,
      hasOpenPr: false,
      labeledAt: "2026-08-09T14:07:00Z",
      now: "2026-08-09T15:10:00Z",
      // REPEAT_WINDOW_HOURS is 6 — 08:00Z is >6h before 15:10Z, so outside the window.
      priorReapTimestamps: ["2026-08-09T08:00:00Z"],
    });
    assert.equal(REPEAT_WINDOW_HOURS, 6, "test fixture assumes the default 6h window");
    assert.equal(out.repeated, false);
    assert.deepEqual(out.pairing, { kind: "needs-human" });
  });

  it("a prior reap timestamp AFTER now is not counted as recent (fail closed on clock skew)", () => {
    const runs = [
      {
        url: RUN_URL,
        status: "completed",
        conclusion: "failure",
        createdAt: "2026-08-09T14:07:00Z",
        updatedAt: "2026-08-09T14:57:00Z",
        displayTitle: "agent:implement — issue #90",
      },
    ];
    const out = evaluateTicket({
      issue: ISSUE_90,
      runs,
      hasOpenPr: false,
      labeledAt: "2026-08-09T14:07:00Z",
      now: "2026-08-09T15:10:00Z",
      priorReapTimestamps: ["2026-08-09T16:00:00Z"], // in the future relative to `now`
    });
    assert.equal(out.repeated, false);
  });

  it("no correlated run and the label is young → too-recent, never reaped", () => {
    const out = evaluateTicket({
      issue: ISSUE_90,
      runs: [],
      hasOpenPr: false,
      labeledAt: "2026-08-09T14:07:00Z",
      now: "2026-08-09T14:20:00Z", // 13m old
    });
    assert.equal(out.verdict, "too-recent");
  });

  it("no correlated run and the label is older than the grace period → reap as no-run-found", () => {
    const out = evaluateTicket({
      issue: ISSUE_90,
      runs: [],
      hasOpenPr: false,
      labeledAt: "2026-08-09T14:07:00Z",
      now: "2026-08-09T15:25:00Z", // 78m old > 75m grace
    });
    assert.equal(out.verdict, "reap");
    assert.equal(out.outcome, "no-run-found");
  });

  it("grace period is exactly JOB_TIMEOUT_MINUTES + 15", () => {
    assert.equal(NO_RUN_GRACE_MINUTES, JOB_TIMEOUT_MINUTES + 15);
  });

  // ── DECOY-ONLY TICKETS ──────────────────────────────────────────────────
  // The real run aged out of the fetched history (74 of toon-meta's last 100
  // issues-triggered runs are decoys) or never fired, while an unrelated label
  // minted a decoy inside the window. The decoy must not become the verdict.

  it("a decoy-only ticket inside the grace period is left alone, not reaped as failed", () => {
    const runs = [
      {
        url: "decoy",
        status: "completed",
        conclusion: "skipped",
        createdAt: "2026-08-09T14:07:04Z",
        displayTitle: "agent:implement — issue #90",
      },
    ];
    const out = evaluateTicket({
      issue: ISSUE_90,
      runs,
      hasOpenPr: false,
      labeledAt: "2026-08-09T14:07:00Z",
      now: "2026-08-09T14:20:00Z", // 13m old — a real run could still be running
    });
    assert.equal(out.verdict, "too-recent", "a decoy proves nothing about a live run");
  });

  it("a decoy-only ticket past the grace period reaps as no-run-found, never as failed", () => {
    const runs = [
      {
        url: "https://github.com/toon-protocol/buzz/actions/runs/decoy",
        status: "completed",
        conclusion: "skipped",
        createdAt: "2026-08-09T14:07:04Z",
        displayTitle: "agent:implement — issue #90",
      },
    ];
    const out = evaluateTicket({
      issue: ISSUE_90,
      runs,
      hasOpenPr: false,
      labeledAt: "2026-08-09T14:07:00Z",
      now: "2026-08-09T15:25:00Z", // 78m old > 75m grace
    });
    assert.equal(out.verdict, "reap");
    assert.equal(out.outcome, "no-run-found", "#330 criterion 4 — report the truth, not `failed`");
    assert.equal(out.run, undefined, "no run URL is named, because none was correlated");
    assert.deepEqual(out.pairing, { kind: "needs-human" }, "never reaped bare");

    // AC4 end-to-end: the posted comment must not assert a failure that never
    // happened, and must not point a human at a run that did no work.
    const comment = buildReapComment({
      issue: { number: 90 },
      outcome: out.outcome,
      run: out.run,
      marker: reapMarker(ISSUE_90.repo, 90, "2026-08-09T14:07:00Z"),
      pairing: out.pairing,
    });
    assert.doesNotMatch(comment, /run \*\*failed\*\*/);
    assert.doesNotMatch(comment, /^Run: /m);
    assert.match(comment, /no workflow run could be correlated/);
  });

  it("a real run still wins over a decoy minted alongside it (unchanged)", () => {
    const runs = [
      {
        url: "decoy",
        status: "completed",
        conclusion: "skipped",
        createdAt: "2026-08-09T14:50:00Z",
        displayTitle: "agent:implement — issue #90",
      },
      {
        url: RUN_URL,
        status: "completed",
        conclusion: "success",
        createdAt: "2026-08-09T14:07:02Z",
        updatedAt: "2026-08-09T14:12:00Z",
        displayTitle: "agent:implement — issue #90",
      },
    ];
    const out = evaluateTicket({
      issue: ISSUE_90,
      runs,
      hasOpenPr: false,
      labeledAt: "2026-08-09T14:07:00Z",
      now: "2026-08-09T15:25:00Z",
    });
    assert.equal(out.verdict, "reap");
    assert.equal(out.outcome, "succeeded-with-no-changes");
    assert.equal(out.run.url, RUN_URL);
  });
});

// ── buildReapComment / reapMarker ────────────────────────────────────────

const CYCLE = "2026-08-09T14:07:00Z";

describe("buildReapComment", () => {
  it("names the run URL, both branch conventions, the pairing, and embeds the marker", () => {
    const marker = reapMarker("toon-protocol/buzz", 90, CYCLE);
    const comment = buildReapComment({
      issue: { number: 90 },
      outcome: "timed-out",
      run: { url: RUN_URL },
      marker,
      pairing: { kind: "needs-human" },
    });
    assert.match(comment, /timed out/);
    assert.match(comment, new RegExp(RUN_URL.replace(/\//g, "\\/")));
    assert.match(comment, /sandcastle\/issue-90/);
    assert.match(comment, /agent\/issue-90/);
    assert.match(comment, new RegExp(`<!-- ${marker} -->`));
    assert.match(comment, /never re-applies/);
    assert.match(comment, /Added `needs:human`/);
  });

  it("no-run-found omits the run URL line but still names the follow-up", () => {
    const comment = buildReapComment({
      issue: { number: 90 },
      outcome: "no-run-found",
      run: undefined,
      marker: reapMarker("toon-protocol/buzz", 90, CYCLE),
      pairing: { kind: "needs-human" },
    });
    assert.doesNotMatch(comment, /^Run: /m);
    assert.match(comment, /Actions tab/);
  });

  it("guard-skipped pairs with tracking in the comment text", () => {
    const comment = buildReapComment({
      issue: { number: 6 },
      outcome: "guard-skipped",
      run: { url: "https://x/6" },
      marker: reapMarker("toon-protocol/buzz", 6, CYCLE),
      pairing: { kind: "tracking" },
    });
    assert.match(comment, /implement.*job was \*\*skipped\*\*/);
    assert.match(comment, /Added `tracking`/);
  });

  it("pushed-nothing names the blocker ref added to `## Blocked by`", () => {
    const comment = buildReapComment({
      issue: { number: 43 },
      outcome: "pushed-nothing",
      run: { url: "https://x/43" },
      marker: reapMarker("toon-protocol/buzz", 43, CYCLE),
      pairing: { kind: "blocker", ref: PUSHED_NOTHING_BLOCKER_REF },
    });
    assert.match(comment, new RegExp(`- ${PUSHED_NOTHING_BLOCKER_REF.replace(/\//g, "\\/")}`));
    assert.match(comment, /dispatch resumes automatically/);
  });

  it("a repeated reap names the repeat-death escalation", () => {
    const comment = buildReapComment({
      issue: { number: 90 },
      outcome: "failed",
      run: { url: RUN_URL },
      marker: reapMarker("toon-protocol/buzz", 90, CYCLE),
      pairing: { kind: "needs-human" },
      repeated: true,
    });
    assert.match(comment, /Repeat death/);
  });
});

describe("reapMarker / reapMarkerPrefix", () => {
  it("reapMarker sanitizes the repo slug and the cycle key", () => {
    assert.equal(
      reapMarker("toon-protocol/buzz", 90, "2026-08-09T14:07:00Z"),
      "label-reaper-dead-run:toon-protocol-buzz-issue-90-2026-08-09T14-07-00Z",
    );
  });

  it("two different labeling cycles for the same ticket get different markers", () => {
    const a = reapMarker("toon-protocol/buzz", 90, "2026-08-09T14:07:00Z");
    const b = reapMarker("toon-protocol/buzz", 90, "2026-08-10T09:00:00Z");
    assert.notEqual(a, b);
  });

  it("reapMarkerPrefix matches any cycle's marker for the same ticket", () => {
    const prefix = reapMarkerPrefix("toon-protocol/buzz", 90);
    const a = reapMarker("toon-protocol/buzz", 90, "2026-08-09T14:07:00Z");
    const b = reapMarker("toon-protocol/buzz", 90, "2026-08-10T09:00:00Z");
    assert.ok(a.startsWith(prefix));
    assert.ok(b.startsWith(prefix));
  });

  it("reapMarkerPrefix does not collide across issue numbers with a shared digit prefix", () => {
    const prefix9 = reapMarkerPrefix("toon-protocol/buzz", 9);
    const marker90 = reapMarker("toon-protocol/buzz", 90, "2026-08-09T14:07:00Z");
    assert.ok(!marker90.startsWith(prefix9));
  });
});
