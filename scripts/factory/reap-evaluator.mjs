// Dead-label reap evaluator (toon-meta#330).
//
// Nothing reaps `agent:implement` when a run dies without opening a PR: the
// label stays forever, and the dispatcher treats the ticket as in-flight
// forever (dispatch-evaluator.mjs counts "a child already carries
// agent:implement" as busy — see its header), wedging the whole epic's
// serialization slot behind a runner that is no longer running.
//
// ── THE CONDITION IS "NO OPEN PR", NOT "THE RUN FAILED" ─────────────────────
// A successful run can legitimately open no PR (it verified the bug no
// longer reproduces and made no changes — the observed rig#23 shape). A
// reaper that only watched `conclusion == failure` would leave that ticket
// wedged forever. The only correct condition is: the run that owns this
// labeling has finished (or can be proven dead) AND no open PR exists for
// `sandcastle/issue-<n>` / `agent/issue-<n>`.
//
// ── CORRELATING A LABEL TO ITS RUN ───────────────────────────────────────────
// GitHub's workflow-run REST list carries no issue-number field for an
// `issues.labeled`-triggered run unless the workflow sets `run-name:`.
// `findRunForLabel` therefore matches in two tiers:
//   1. EXACT — a run whose `displayTitle` names this issue number. Requires
//      `run-name: "agent:implement — issue #${{ github.event.issue.number }}"`
//      in `agent-implement.yml`; toon-meta's own copy carries it (#330), the
//      other ten fleet repos do not yet (see FACTORY.md — flagged, not
//      assumed installed, per the #329 lesson).
//   2. TIME-WINDOW fallback — the run created nearest-after the `labeled`
//      timeline event, within `windowMinutes`. GitHub creates the run record
//      within seconds of the webhook, so this is a reliable proxy everywhere
//      run-name is absent (i.e. everywhere except toon-meta today). A repo
//      that labels two tickets in the same instant could misattribute here;
//      accepted, because a wrong correlation still fails closed downstream
//      (an in-progress match under either tier is never reaped).
//
// ── WHEN NO RUN CORRELATES AT ALL ────────────────────────────────────────────
// The label may have been applied by a path that never fired
// `issues.labeled` (see unblock-dispatcher.mjs's create-then-label note), or
// correlation may simply fail. Never touched while the label is younger than
// `NO_RUN_GRACE_MINUTES` (a run may just not be visible via the API yet).
// Past that grace period — deliberately longer than `JOB_TIMEOUT_MINUTES`, the
// job's own wall-clock cap in agent-implement.yml — no real in-progress run
// could still be running, so it is safe to reap as `no-run-found`.
//
// ── OUTCOMES (named in the comment; the follow-up differs per #330) ─────────
//   succeeded-with-no-changes — conclusion success, no PR (rig#23 shape).
//   timed-out                 — conclusion timed_out, or duration ≥ the STEP
//                               timeout (a step-level timeout can surface as
//                               a plain `failure` conclusion).
//   pushed-nothing            — failed/timed out AND the issue's own comments
//                               claim a branch that does not exist (buzz#43
//                               shape — toon-meta#331 is the cause).
//   failed / cancelled        — anything else.
//   no-run-found              — no correlated run, label past grace.
//
// ── IDEMPOTENCY ──────────────────────────────────────────────────────────────
// Reaping REMOVES the label, so re-running the pass is idempotent by
// construction: an already-reaped ticket no longer carries `agent:implement`
// and is never re-scanned. `reapMarker` is embedded in the comment anyway —
// not load-bearing, but it lets a human `search:` for reaper activity, the
// same convention as every other hidden marker in this codebase.
//
// ── EXPORTED API ─────────────────────────────────────────────────────────────
//   canonicalBranches(number)     → the two branch names a run for this
//                                    ticket could have pushed
//   findRunForLabel(input)        → the correlated run, or null
//   classifyOutcome(input)        → outcome string (see above)
//   evaluateTicket(input)         → verdict for one agent:implement ticket
//   buildReapComment(input)       → comment text (includes the hidden marker)
//   reapMarker(repo, number)      → hidden idempotency/search marker
//
// Plain Node ESM, zero dependencies. Tests: reap-evaluator.test.mjs
// (node --test).

import { IMPLEMENT_LABEL, FACTORY_BRANCH_PREFIXES } from "./dispatch-evaluator.mjs";

// agent-implement.yml has two nested caps: the job as a whole is capped at
// JOB_TIMEOUT_MINUTES, but the implement step inside it (the one that can
// actually run long) is capped at STEP_TIMEOUT_MINUTES — that is the wall
// the observed runs (buzz#90/#43) actually hit, so it is what classifyOutcome
// checks a run's duration against.
export const STEP_TIMEOUT_MINUTES = 50; // agent-implement.yml's step timeout-minutes
export const JOB_TIMEOUT_MINUTES = 60; // agent-implement.yml's job timeout-minutes
// Long enough that ANY genuinely in-progress run (capped at JOB_TIMEOUT_MINUTES)
// must have finished by the time this grace period elapses.
export const NO_RUN_GRACE_MINUTES = JOB_TIMEOUT_MINUTES + 15;

/**
 * The branch names a run for this ticket could have pushed, in convention
 * order (`sandcastle/issue-<n>` first — see dispatch-evaluator.mjs's
 * FACTORY_BRANCH_PREFIXES / BRANCH_ISSUE_RE, never re-implemented here).
 *
 * @param {number} number
 * @returns {string[]}
 */
export function canonicalBranches(number) {
  return FACTORY_BRANCH_PREFIXES.map((prefix) => `${prefix}issue-${number}`);
}

/**
 * Correlate a ticket's current `agent:implement` labeling to the workflow run
 * it fired. See the header for the two-tier match.
 *
 * @param {{
 *   runs: Array<{status:string, conclusion:string|null, createdAt:string,
 *     updatedAt?:string, url:string, displayTitle?:string}>,
 *   issueNumber: number,
 *   labeledAt: string,             // ISO timestamp of the `labeled` event
 *   windowMinutes?: number,        // time-window fallback width (default 10)
 *   toleranceSeconds?: number,     // clock-skew allowance before labeledAt (default 30)
 * }} input
 * @returns {object|null} the matched run, or null if none correlates.
 */
export function findRunForLabel({
  runs = [],
  issueNumber,
  labeledAt,
  windowMinutes = 10,
  toleranceSeconds = 30,
} = {}) {
  const labeledMs = new Date(labeledAt).getTime();
  const windowStart = labeledMs - toleranceSeconds * 1000;

  // A DECOY: `agent-implement.yml` triggers on EVERY `issues.labeled` event and
  // skips its jobs unless the label is `agent:implement`, so any other label
  // applied to this ticket mints a completed/`skipped` run carrying the SAME
  // run-name — `agent:implement — issue #N` — as the real one. 68 of
  // toon-meta's last 91 runs are such decoys. Observed live on buzz#90: adding
  // `tracking` while its implement run was in flight minted exactly this.
  //
  // Left unfiltered, the exact tier's "most recent title match" returns the
  // decoy instead of the real in-progress run, classifies it as finished, and
  // reaps the label out from under a job that is still working — defeating
  // #330 criterion 2 and naming the wrong run in the comment.
  const isDecoy = (r) => r.status === "completed" && r.conclusion === "skipped";
  const newest = (list) =>
    list.reduce((a, r) => (new Date(r.createdAt) > new Date(a.createdAt) ? r : a));
  const earliest = (list) =>
    list.reduce((a, r) => (new Date(r.createdAt) < new Date(a.createdAt) ? r : a));

  /**
   * Reduce correlated candidates to the one that decides this ticket's fate,
   * in strict precedence. Both tiers go through here so neither can regress
   * the in-progress guarantee independently. `order` keeps each tier's own
   * tie-break: EXACT wants the latest matching run, the TIME-WINDOW fallback
   * wants the one nearest-after the label.
   */
  const pick = (candidates, order) => {
    if (candidates.length === 0) return null;
    // 1. FAIL CLOSED. Any candidate that is not finished wins outright: the
    //    caller reaps nothing while a run is live, whatever else correlates.
    const live = candidates.filter((r) => r.status !== "completed");
    if (live.length > 0) return order(live);
    // 2. A real run beats a decoy. Decoys are only consulted when nothing
    //    else correlates — a guard that legitimately refused an
    //    `agent:implement` label also lands as `skipped`, and that ticket has
    //    nothing in flight and SHOULD be reaped.
    const real = candidates.filter((r) => !isDecoy(r));
    return order(real.length > 0 ? real : candidates);
  };

  // Tier 1 — EXACT. Bounded below by the labeling: a run from an EARLIER
  // label/reap cycle carries the same title and must not be mistaken for this
  // one's.
  const titleRe = new RegExp(`\\bissue\\s*#${issueNumber}\\b`, "i");
  const exact = runs.filter(
    (r) =>
      titleRe.test(r.displayTitle ?? "") && new Date(r.createdAt).getTime() >= windowStart,
  );
  if (exact.length > 0) return pick(exact, newest);

  // Tier 2 — TIME-WINDOW fallback, for the ten repos whose `agent-implement.yml`
  // carries no `run-name` yet.
  const windowEnd = labeledMs + windowMinutes * 60000;
  const windowed = runs.filter((r) => {
    const t = new Date(r.createdAt).getTime();
    return t >= windowStart && t <= windowEnd;
  });
  if (windowed.length > 0) return pick(windowed, earliest);

  return null;
}

/**
 * Classify a finished run's outcome for the comment + follow-up guidance.
 * Only called once the run is known `completed` and no open PR exists.
 *
 * @param {{
 *   run: {conclusion:string|null, createdAt:string, updatedAt?:string},
 *   branchClaimed?: boolean,   // an issue comment names a canonical branch
 *   branchExists?: boolean,    // that branch is live on the repo right now
 *   stepTimeoutMinutes?: number,
 * }} input
 * @returns {"succeeded-with-no-changes"|"timed-out"|"pushed-nothing"|"failed"|"cancelled"}
 */
export function classifyOutcome({
  run,
  branchClaimed = false,
  branchExists = false,
  stepTimeoutMinutes = STEP_TIMEOUT_MINUTES,
} = {}) {
  if (run.conclusion === "success") return "succeeded-with-no-changes";
  // pushed-nothing outranks timed-out: it is the more actionable diagnosis
  // (a straight retry once the push-loss cause is fixed) even when the run
  // that lost the push also happened to hit the wall clock.
  if (branchClaimed && !branchExists) return "pushed-nothing";

  const durationMinutes =
    (new Date(run.updatedAt ?? run.createdAt).getTime() - new Date(run.createdAt).getTime()) /
    60000;
  // A step-level timeout can surface as a plain `failure` conclusion —
  // duration against the STEP cap (not the outer job cap) is the tell.
  if (run.conclusion === "timed_out" || durationMinutes >= stepTimeoutMinutes) {
    return "timed-out";
  }
  if (run.conclusion === "cancelled") return "cancelled";
  return "failed";
}

/**
 * Decide the verdict for one ticket currently carrying `agent:implement`.
 * Pure — every input is supplied by the shell (gh reads, the current clock).
 *
 * @param {{
 *   issue: { repo: string, number: number, title?: string, url?: string },
 *   runs: Array,                  // this repo's agent-implement.yml runs (event=issues)
 *   hasOpenPr: boolean,           // an open PR maps to this ticket (prIssueIds)
 *   labeledAt: string,            // ISO timestamp the current labeling began
 *   now: string,                  // ISO timestamp, caller-supplied (no Date.now() here)
 *   branchClaimed?: boolean,
 *   branchExists?: boolean,
 *   windowMinutes?: number,
 *   toleranceSeconds?: number,
 *   stepTimeoutMinutes?: number,
 *   jobTimeoutMinutes?: number,
 *   graceMinutes?: number,
 * }} input
 * @returns {{
 *   verdict: "open-pr"|"in-progress"|"too-recent"|"reap",
 *   outcome?: "succeeded-with-no-changes"|"timed-out"|"pushed-nothing"|"failed"|"cancelled"|"no-run-found",
 *   run?: object,
 *   reasons: string[],
 * }}
 */
export function evaluateTicket({
  issue,
  runs,
  hasOpenPr,
  labeledAt,
  now,
  branchClaimed = false,
  branchExists = false,
  windowMinutes,
  toleranceSeconds,
  stepTimeoutMinutes = STEP_TIMEOUT_MINUTES,
  jobTimeoutMinutes = JOB_TIMEOUT_MINUTES,
  graceMinutes = NO_RUN_GRACE_MINUTES,
} = {}) {
  if (hasOpenPr) {
    return {
      verdict: "open-pr",
      reasons: [`an open PR already maps to this ticket — in review, not dead; leaving alone`],
    };
  }

  const run = findRunForLabel({
    runs,
    issueNumber: issue.number,
    labeledAt,
    windowMinutes,
    toleranceSeconds,
  });

  if (run) {
    if (run.status !== "completed") {
      return {
        verdict: "in-progress",
        run,
        reasons: [`correlated run ${run.url} is still ${run.status} — leaving alone`],
      };
    }
    const outcome = classifyOutcome({ run, branchClaimed, branchExists, stepTimeoutMinutes });
    return {
      verdict: "reap",
      run,
      outcome,
      reasons: [
        `correlated run ${run.url} finished (conclusion=${run.conclusion}) with no open PR — ` +
          `outcome: ${outcome}`,
      ],
    };
  }

  const ageMinutes = (new Date(now).getTime() - new Date(labeledAt).getTime()) / 60000;
  if (ageMinutes < graceMinutes) {
    return {
      verdict: "too-recent",
      reasons: [
        `no correlated run found, but the label is only ${Math.round(ageMinutes)}m old ` +
          `(< ${graceMinutes}m grace) — a run may still be starting, or not yet visible via the ` +
          `API; leaving alone`,
      ],
    };
  }
  return {
    verdict: "reap",
    outcome: "no-run-found",
    reasons: [
      `no correlated run found and the label is ${Math.round(ageMinutes)}m old ` +
        `(≥ ${graceMinutes}m grace, past the ${jobTimeoutMinutes}m job timeout) — no real run ` +
        `could still be in progress; treating as dead`,
    ],
  };
}

// ── Comment builder ──────────────────────────────────────────────────────────

const sanitize = (repo) => repo.replace(/[^a-zA-Z0-9]+/g, "-");
// Hidden marker embedded in every reap comment. Not load-bearing for
// idempotency (removing the label already prevents re-processing — see
// header); it exists so a human can `search:` for reaper activity, matching
// every other hidden-marker convention in this codebase.
export const reapMarker = (repo, number) => `label-reaper-dead-run:${sanitize(repo)}-issue-${number}`;

const OUTCOME_TEXT = {
  "succeeded-with-no-changes":
    "the run **succeeded** but opened no PR — it made no changes (e.g. it verified the " +
    "underlying issue no longer reproduces)",
  "timed-out": "the run **timed out** (hit the runner's wall-clock cap) without opening a PR",
  "pushed-nothing":
    "the run **failed**, and although it commented that work was pushed to a branch, that " +
    "branch does not exist — the push was lost",
  failed: "the run **failed** without opening a PR",
  cancelled: "the run was **cancelled** without opening a PR",
  "no-run-found":
    "no workflow run could be correlated to this labeling, and enough time has passed that a " +
    "genuinely running job would have finished by now",
};

const FOLLOW_UP = {
  "succeeded-with-no-changes":
    "If the underlying task is confirmed done, close this ticket; otherwise re-dispatch with a " +
    "clarified acceptance criterion.",
  "timed-out":
    "This ticket likely needs splitting into smaller work, or a longer run budget, before " +
    "re-dispatching.",
  "pushed-nothing":
    "This looks like a lost push (toon-meta#331) — re-dispatch once that is fixed, or verify " +
    "manually first.",
  failed: "Check the run logs for the cause, fix the underlying blocker, then re-dispatch.",
  cancelled: "Re-dispatch when ready, or leave it for a human to decide.",
  "no-run-found":
    "Check the repo's Actions tab for `agent:implement` runs around when the label was added — " +
    "the `issues.labeled` webhook may never have reached the runner.",
};

/**
 * The comment posted when a dead label is reaped.
 *
 * @param {{ issue: {number:number}, outcome: string, run?: {url:string}, marker: string }} input
 * @returns {string}
 */
export function buildReapComment({ issue, outcome, run, marker }) {
  const branches = canonicalBranches(issue.number)
    .map((b) => `\`${b}\``)
    .join(" / ");
  const lines = [
    `The label reaper (toon-meta#330) removed \`${IMPLEMENT_LABEL}\`: ` +
      `${OUTCOME_TEXT[outcome] ?? outcome}, and no open PR exists for this ticket (${branches}).`,
    ``,
  ];
  if (run?.url) lines.push(`Run: ${run.url}`, ``);
  lines.push(
    FOLLOW_UP[outcome] ?? "A human should decide whether to re-dispatch.",
    ``,
    `This pass never re-applies \`${IMPLEMENT_LABEL}\` — that is a judgement call, not this ` +
      `pass's job (re-adding it automatically would re-run a run that already burned its budget).`,
    ``,
    `<!-- ${marker} -->`,
  );
  return lines.join("\n");
}
