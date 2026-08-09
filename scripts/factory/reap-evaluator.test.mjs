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
  findRunForLabel,
  classifyOutcome,
  evaluateTicket,
  buildReapComment,
  reapMarker,
  JOB_TIMEOUT_MINUTES,
  NO_RUN_GRACE_MINUTES,
} from "./reap-evaluator.mjs";

const RUN_URL = "https://github.com/toon-protocol/buzz/actions/runs/1";

// ── canonicalBranches ─────────────────────────────────────────────────────

describe("canonicalBranches", () => {
  it("returns both factory branch conventions", () => {
    assert.deepEqual(canonicalBranches(90), ["sandcastle/issue-90", "agent/issue-90"]);
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
  // agent-implement.yml fires on EVERY issues.labeled event and skips unless
  // the label is agent:implement, so an unrelated label mints a completed/
  // `skipped` run under the SAME run-name. Observed live on buzz#90: adding
  // `tracking` mid-run minted exactly this decoy.

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

  it("still returns a lone skipped run — a guard-refused label has nothing in flight", () => {
    const runs = [
      {
        url: "refused",
        status: "completed",
        conclusion: "skipped",
        createdAt: "2026-08-09T14:00:05Z",
        displayTitle: "agent:implement — issue #90",
      },
    ];
    const run = findRunForLabel({ runs, issueNumber: 90, labeledAt: "2026-08-09T14:00:00Z" });
    assert.equal(run.url, "refused", "that ticket IS reapable — nothing is running");
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
});

// ── buildReapComment / reapMarker ────────────────────────────────────────

describe("buildReapComment", () => {
  it("names the run URL, both branch conventions, and embeds the marker", () => {
    const marker = reapMarker("toon-protocol/buzz", 90);
    const comment = buildReapComment({
      issue: { number: 90 },
      outcome: "timed-out",
      run: { url: RUN_URL },
      marker,
    });
    assert.match(comment, /timed out/);
    assert.match(comment, new RegExp(RUN_URL.replace(/\//g, "\\/")));
    assert.match(comment, /sandcastle\/issue-90/);
    assert.match(comment, /agent\/issue-90/);
    assert.match(comment, new RegExp(`<!-- ${marker} -->`));
    assert.match(comment, /never re-applies/);
  });

  it("no-run-found omits the run URL line but still names the follow-up", () => {
    const comment = buildReapComment({
      issue: { number: 90 },
      outcome: "no-run-found",
      run: undefined,
      marker: reapMarker("toon-protocol/buzz", 90),
    });
    assert.doesNotMatch(comment, /^Run: /m);
    assert.match(comment, /Actions tab/);
  });

  it("reapMarker is stable and sanitizes the repo slug", () => {
    assert.equal(reapMarker("toon-protocol/buzz", 90), "label-reaper-dead-run:toon-protocol-buzz-issue-90");
  });
});
