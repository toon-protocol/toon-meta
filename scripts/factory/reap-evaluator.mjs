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
// ── DECOY RUNS NEVER DECIDE ANYTHING ─────────────────────────────────────────
// `agent-implement.yml` triggers on EVERY `issues.labeled` event, and its
// `guard` job carries `if: github.event.label.name == 'agent:implement'`. Any
// OTHER label applied to any ticket therefore mints a whole workflow run whose
// every job is skipped, so the RUN concludes `skipped` — and, where run-name is
// installed, it carries the same `agent:implement — issue #N` title as the real
// one. 74 of toon-meta's last 100 `issues`-triggered runs are these decoys.
//
// A run-level `skipped` conclusion means the guard job ITSELF never ran, i.e.
// the label was not `agent:implement`. It is therefore ALWAYS a decoy and never
// evidence about this labeling — verified against every `skipped`-conclusion run
// sampled in toon-meta and buzz (all have `guard=skipped`).
//
// A guard REFUSAL is a different, unrelated shape: the guard runs, decides
// against the target, and the run concludes `success` with `implement` skipped
// (verified: buzz run 31330244708, the buzz#6 refusal — `guard=success`,
// `implement=skipped`). That shape is classified as `guard-skipped` from the
// job conclusions, never from the run conclusion.
//
// So `isDecoyRun` candidates are dropped from BOTH tiers rather than used as a
// last resort. When a ticket's only visible run is a decoy the honest answer is
// "no run correlates" — the grace-gated `no-run-found` path — not "the run
// failed", which is what the previous fallback produced: a comment naming a run
// that did no work, asserting a failure that never happened (#330 criterion 4).
// The exact tier is authoritative once it matches anything AT ALL, decoys
// included: it must not fall through to the time-window tier just because this
// ticket's own runs were all decoys, or a DIFFERENT ticket labeled in the same
// minute would decide this one's fate.
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
//   guard-skipped              — conclusion success, but the `implement` job
//                               itself was `skipped` — one of `guard`'s
//                               checks in agent-implement.yml refused the
//                               target before any work began (buzz#6 shape:
//                               a PRD-shaped parent carrying sub-issues).
//   timed-out                 — conclusion timed_out, or duration ≥ the STEP
//                               timeout (a step-level timeout can surface as
//                               a plain `failure` conclusion).
//   pushed-nothing            — failed/timed out AND the issue's own comments
//                               claim a branch that does not exist (buzz#43
//                               shape — toon-meta#331 is the cause).
//   failed / cancelled        — anything else.
//   no-run-found              — no correlated run, label past grace.
//
// ── NEVER REAP BARE — REMOVING THE LABEL ALONE SPINS THE DISPATCHER ─────────
// Empirically disproven (buzz#90, 2026-08-09 18:29Z): unblock-dispatcher.mjs
// re-labeled a bare-reaped ticket 26 SECONDS after the label was removed —
// nothing about the ticket itself had changed, so its very next pass saw an
// idle epic with a "ready" child and dispatched it again. That is
// reap → dispatch → die → reap, a full burned agent run every cycle, strictly
// worse than the stall it replaces (a stall is at least free). So a reap MUST
// pair the removal with something that makes dispatch-evaluator.mjs's own
// readiness rule (EXCLUDED_LABELS / isReady) decline this ticket —
// `choosePairing` picks which, by outcome:
//   guard-skipped   → `tracking`. The guard refused a structurally
//                     undispatchable target (a parent with sub-issues); the
//                     runner will refuse it again every time, so this is not
//                     a transient failure — it needs decomposing, not a
//                     human queue entry.
//   pushed-nothing  → a new `## Blocked by` bullet naming the known root
//                     cause (toon-meta#331, PUSHED_NOTHING_BLOCKER_REF).
//                     unblock-evaluator.mjs's isReady then declines this
//                     ticket while #331 is open, AND — the useful half —
//                     dispatch resumes automatically the moment #331 closes,
//                     same as the by-hand fix applied to buzz#43 that held.
//   everything else → `needs:human`. No known ticket to point at; a human
//                     judgement call (retry budget, split, or drop) is what
//                     the follow-up guidance in the comment asks for anyway.
// A ticket that dies and gets reaped twice within `REPEAT_WINDOW_HOURS` is a
// repeat-death pattern, not a one-off — `evaluateTicket` escalates it to
// `needs:human` regardless of what `choosePairing` would otherwise pick.
//
// ── IDEMPOTENCY ──────────────────────────────────────────────────────────────
// Reaping REMOVES the label, so an already-reaped ticket is never re-scanned
// (the pass only looks at tickets currently carrying `agent:implement`). The
// hidden marker (`reapMarker`) is keyed on the CURRENT labeling's `labeledAt`
// timestamp, not just the issue number — a marker keyed only on the issue
// number would make every future death of the SAME ticket look
// "already reaped" forever (the first reap's comment is still sitting
// there), silently disabling the reaper for any ticket that had ever been
// reaped once. The per-cycle marker also doubles as the repeat-death log:
// `reapMarkerPrefix` (issue-level, no cycle key) matches every reap comment
// ever posted for this ticket, which is how the repeat-detector above finds
// prior reaps.
//
// ── EXPORTED API ─────────────────────────────────────────────────────────────
//   canonicalBranches(number)          → the two branch names a run for this
//                                         ticket could have pushed
//   isDecoyRun(run)                    → true for a run that was skipped whole
//                                         (a non-`agent:implement` label minted
//                                         it — never evidence about this one)
//   findRunForLabel(input)             → the correlated run, or null
//   classifyOutcome(input)             → outcome string (see above)
//   choosePairing(outcome)             → { kind, ref? } — see above
//   evaluateTicket(input)              → verdict for one agent:implement ticket
//   appendBlockerRef(body, ref, repo)  → body text with `ref` added to
//                                         `## Blocked by` (idempotent)
//   buildReapComment(input)            → comment text (includes the hidden marker)
//   reapMarker(repo, number, cycleKey) → hidden idempotency/search marker for
//                                         ONE labeling cycle
//   reapMarkerPrefix(repo, number)     → marker prefix matching ANY cycle's
//                                         marker for this ticket (repeat-detection)
//
// Plain Node ESM, zero dependencies. Tests: reap-evaluator.test.mjs
// (node --test).

import { IMPLEMENT_LABEL, FACTORY_BRANCH_PREFIXES } from "./dispatch-evaluator.mjs";
import { parseBlockedBy, resolveRef } from "./unblock-evaluator.mjs";

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
 * A DECOY: `agent-implement.yml` fires on every `issues.labeled` event and its
 * `guard` job is gated on `github.event.label.name == 'agent:implement'`, so
 * any other label mints a run in which nothing ran at all and the run as a
 * whole concludes `skipped`. A run-level `skipped` conclusion therefore means
 * "this run was minted by a label that is not `agent:implement`" — it is never
 * evidence about an `agent:implement` labeling. (A guard that legitimately
 * REFUSES a target is a different shape entirely: the run concludes `success`
 * with the `implement` JOB skipped, which `classifyOutcome` reports as
 * `guard-skipped`. See the header.)
 *
 * @param {{status?:string, conclusion?:string|null}} run
 * @returns {boolean}
 */
export const isDecoyRun = (run) =>
  run?.status === "completed" && run?.conclusion === "skipped";

/**
 * Correlate a ticket's current `agent:implement` labeling to the workflow run
 * it fired. See the header for the two-tier match.
 *
 * Never returns a decoy run: when a tier's only candidates are decoys the
 * result is `null` (i.e. "no run correlates"), which routes the caller to the
 * grace-gated `no-run-found` path instead of reporting a run that did no work.
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

  const newest = (list) =>
    list.reduce((a, r) => (new Date(r.createdAt) > new Date(a.createdAt) ? r : a));
  const earliest = (list) =>
    list.reduce((a, r) => (new Date(r.createdAt) < new Date(a.createdAt) ? r : a));

  /**
   * Reduce correlated candidates to the one that decides this ticket's fate,
   * in strict precedence. Both tiers go through here so neither can regress
   * either guarantee independently. `order` keeps each tier's own tie-break:
   * EXACT wants the latest matching run, the TIME-WINDOW fallback wants the one
   * nearest-after the label. Returns null when nothing survives.
   */
  const pick = (candidates, order) => {
    // 1. FAIL CLOSED. Any candidate that is not finished wins outright: the
    //    caller reaps nothing while a run is live, whatever else correlates.
    //    (A decoy is always `completed`, so it can never mask a live run.)
    const live = candidates.filter((r) => r.status !== "completed");
    if (live.length > 0) return order(live);
    // 2. DECOYS ARE NOT EVIDENCE. A run-level `skipped` conclusion means the
    //    guard job never ran, i.e. some OTHER label minted this run. Dropping
    //    it (rather than falling back to it) is what makes "no run correlates"
    //    the answer when nothing real is visible — see the header.
    const real = candidates.filter((r) => !isDecoyRun(r));
    return real.length > 0 ? order(real) : null;
  };

  // Tier 1 — EXACT. Bounded below by the labeling: a run from an EARLIER
  // label/reap cycle carries the same title and must not be mistaken for this
  // one's.
  const titleRe = new RegExp(`\\bissue\\s*#${issueNumber}\\b`, "i");
  const exact = runs.filter(
    (r) =>
      titleRe.test(r.displayTitle ?? "") && new Date(r.createdAt).getTime() >= windowStart,
  );
  // Authoritative once it matches ANYTHING, decoys included: a title match names
  // this issue outright, so falling through to the coarser time-window tier
  // because those matches were all decoys would let a different ticket's run —
  // labeled in the same minute — decide this ticket's fate. `pick` may return
  // null here; that is the intended "no run correlates" answer.
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
 *   implementJobSkipped?: boolean, // the run's `implement` job conclusion
 *                                  // was `skipped` (a guard refused the
 *                                  // target — buzz#6 shape)
 *   stepTimeoutMinutes?: number,
 * }} input
 * @returns {"succeeded-with-no-changes"|"guard-skipped"|"timed-out"|"pushed-nothing"|"failed"|"cancelled"|"no-run-found"}
 */
export function classifyOutcome({
  run,
  branchClaimed = false,
  branchExists = false,
  implementJobSkipped = false,
  stepTimeoutMinutes = STEP_TIMEOUT_MINUTES,
} = {}) {
  // Defence in depth: `findRunForLabel` never hands a decoy back, so
  // `evaluateTicket` cannot reach this — but a decoy carries no information
  // about the labeling, and the one thing it must NEVER do is fall through to
  // `failed` and have the reap comment assert a failure that never happened.
  if (isDecoyRun(run)) return "no-run-found";
  if (run.conclusion === "success") {
    return implementJobSkipped ? "guard-skipped" : "succeeded-with-no-changes";
  }
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

// ── Pairing — never reap bare (see header) ───────────────────────────────────

// The known, always-applicable root cause of `pushed-nothing`: a lost push
// caused by the App-token-expiry shape toon-meta#331 tracks. Fixed reference,
// not inferred — see header's "NEVER REAP BARE" section.
export const PUSHED_NOTHING_BLOCKER_REF = "toon-protocol/toon-meta#331";

// A ticket reaped again within this many hours of a prior reap is a
// repeat-death pattern, escalated to `needs:human` regardless of outcome.
export const REPEAT_WINDOW_HOURS = 6;

/**
 * The label/blocker pairing a reap of this outcome applies, so removing
 * `agent:implement` never leaves the ticket bare-reaped (see header).
 *
 * @param {string} outcome
 * @returns {{ kind: "tracking" }|{ kind: "blocker", ref: string }|{ kind: "needs-human" }}
 */
export function choosePairing(outcome) {
  if (outcome === "guard-skipped") return { kind: "tracking" };
  if (outcome === "pushed-nothing") return { kind: "blocker", ref: PUSHED_NOTHING_BLOCKER_REF };
  return { kind: "needs-human" };
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
 *   implementJobSkipped?: boolean,
 *   priorReapTimestamps?: string[], // createdAt of every past reap comment on
 *                                   // this ticket (any cycle) — repeat-detection
 *   windowMinutes?: number,
 *   toleranceSeconds?: number,
 *   stepTimeoutMinutes?: number,
 *   jobTimeoutMinutes?: number,
 *   graceMinutes?: number,
 *   repeatWindowHours?: number,
 * }} input
 * @returns {{
 *   verdict: "open-pr"|"in-progress"|"too-recent"|"reap",
 *   outcome?: "succeeded-with-no-changes"|"guard-skipped"|"timed-out"|"pushed-nothing"|"failed"|"cancelled"|"no-run-found",
 *   pairing?: {kind:string, ref?:string},
 *   repeated?: boolean,
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
  implementJobSkipped = false,
  priorReapTimestamps = [],
  windowMinutes,
  toleranceSeconds,
  stepTimeoutMinutes = STEP_TIMEOUT_MINUTES,
  jobTimeoutMinutes = JOB_TIMEOUT_MINUTES,
  graceMinutes = NO_RUN_GRACE_MINUTES,
  repeatWindowHours = REPEAT_WINDOW_HOURS,
} = {}) {
  if (hasOpenPr) {
    return {
      verdict: "open-pr",
      reasons: [`an open PR already maps to this ticket — in review, not dead; leaving alone`],
    };
  }

  const nowMs = new Date(now).getTime();
  const repeatWindowMs = repeatWindowHours * 3600000;
  const repeated = priorReapTimestamps.some((t) => {
    const ageMs = nowMs - new Date(t).getTime();
    return ageMs >= 0 && ageMs < repeatWindowMs;
  });

  const reap = (outcome, run, reasons) => {
    const pairing = repeated ? { kind: "needs-human" } : choosePairing(outcome);
    const allReasons = repeated
      ? [
          ...reasons,
          `this ticket was already reaped within the last ${repeatWindowHours}h — repeat-death ` +
            `pattern, escalating to needs:human instead of the usual ${choosePairing(outcome).kind} pairing`,
        ]
      : reasons;
    return { verdict: "reap", run, outcome, pairing, repeated, reasons: allReasons };
  };

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
    const outcome = classifyOutcome({
      run,
      branchClaimed,
      branchExists,
      implementJobSkipped,
      stepTimeoutMinutes,
    });
    return reap(outcome, run, [
      `correlated run ${run.url} finished (conclusion=${run.conclusion}) with no open PR — ` +
        `outcome: ${outcome}`,
    ]);
  }

  const ageMinutes = (nowMs - new Date(labeledAt).getTime()) / 60000;
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
  return reap(
    "no-run-found",
    undefined,
    [
      `no correlated run found and the label is ${Math.round(ageMinutes)}m old ` +
        `(≥ ${graceMinutes}m grace, past the ${jobTimeoutMinutes}m job timeout) — no real run ` +
        `could still be in progress; treating as dead`,
    ],
  );
}

// ── `## Blocked by` body editing ─────────────────────────────────────────────

// Mirrors unblock-evaluator.mjs's SECTION_HEADING_RE / SECTION_END_RE /
// BULLET_START_RE exactly — this must parse the same section the same way,
// or an appended bullet could land somewhere isReady never reads.
const BLOCKED_BY_HEADING_RE = /^##\s+blocked\s+by\s*:?\s*$/i;
const BODY_SECTION_END_RE = /^#{1,2}\s+\S/;
const BODY_BULLET_START_RE = /^\s{0,3}[-*+]\s+/;
const BODY_NONE_RE = /^none\b/i;

/**
 * Add `ref` as a `## Blocked by` bullet, idempotently. Used only for the
 * `pushed-nothing` pairing (see header) — `ref` is always a fully-qualified
 * `owner/repo#N` string.
 *
 * @param {string|null|undefined} body
 * @param {string} ref - e.g. "toon-protocol/toon-meta#331"
 * @param {string} selfRepo - the issue's own repo, to resolve existing bullets
 * @returns {string} the new body, or `body` unchanged if `ref` is already
 *   a declared blocker (never duplicates a bullet across repeated reaps).
 */
export function appendBlockerRef(body, ref, selfRepo) {
  const src = String(body ?? "");
  const parsed = parseBlockedBy(src);
  const target = ref.toLowerCase();
  if (parsed.edges.some((e) => resolveRef(e, selfRepo) === target)) return src;

  const lines = src.split(/\r?\n/);
  const start = lines.findIndex((l) => BLOCKED_BY_HEADING_RE.test(l));

  if (start === -1) {
    const trimmed = src.replace(/\s+$/, "");
    return `${trimmed ? `${trimmed}\n\n` : ""}## Blocked by\n\n- ${ref}\n`;
  }

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (BODY_SECTION_END_RE.test(lines[i])) {
      end = i;
      break;
    }
  }
  const section = lines.slice(start + 1, end);

  // A bare `None` declaration is replaced outright (`None` + a real blocker
  // would parse as unresolvable — see unblock-evaluator.mjs); otherwise the
  // bullet is appended after the section's existing content.
  const noneIdx = section.findIndex((l) => BODY_NONE_RE.test(l.trim()) && !BODY_BULLET_START_RE.test(l));
  let newSection;
  if (noneIdx !== -1) {
    newSection = [...section.slice(0, noneIdx), `- ${ref}`, ...section.slice(noneIdx + 1)];
  } else {
    const trimmedSection = [...section];
    while (trimmedSection.length && !trimmedSection.at(-1).trim()) trimmedSection.pop();
    newSection = trimmedSection.length ? [...trimmedSection, `- ${ref}`] : [`- ${ref}`];
  }

  return [...lines.slice(0, start + 1), ...newSection, "", ...lines.slice(end)].join("\n");
}

// ── Comment builder ──────────────────────────────────────────────────────────

const sanitize = (s) => s.replace(/[^a-zA-Z0-9]+/g, "-");
// Hidden marker embedded in every reap comment, keyed on the CURRENT
// labeling's cycle (see header — a static per-issue marker would disable the
// reaper permanently after the first reap of any given ticket).
export const reapMarker = (repo, number, cycleKey) =>
  `${reapMarkerPrefix(repo, number)}${sanitize(String(cycleKey))}`;
// Matches every reap marker ever posted for this ticket, across all cycles —
// how the repeat-detector (see header) finds prior reaps.
export const reapMarkerPrefix = (repo, number) => `label-reaper-dead-run:${sanitize(repo)}-issue-${number}-`;

const OUTCOME_TEXT = {
  "succeeded-with-no-changes":
    "the run **succeeded** but opened no PR — it made no changes (e.g. it verified the " +
    "underlying issue no longer reproduces)",
  "guard-skipped":
    "the run **succeeded**, but its `implement` job was **skipped** — one of the guard's checks " +
    "refused this target before any work began (e.g. it is a PRD-shaped parent carrying " +
    "sub-issues, not a buildable leaf ticket)",
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
  "guard-skipped":
    "This ticket is not buildable by the single-issue runner as-is — decompose it into child " +
    "tickets instead of re-dispatching it directly.",
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

const PAIRING_TEXT = {
  "needs-human": () =>
    `Added \`needs:human\`: the dispatcher never re-labels a ticket carrying it, so this reap ` +
    `frees the epic's slot without spinning — a human decides the next step.`,
  tracking: () =>
    `Added \`tracking\`: the dispatcher never re-labels a ticket carrying it, so this reap frees ` +
    `the epic's slot without spinning — decompose this ticket instead of re-dispatching it.`,
  blocker: (ref) =>
    `Added \`- ${ref}\` to \`## Blocked by\`: the dispatcher declines this ticket while that stays ` +
    `open, so this reap frees the epic's slot without spinning — and dispatch resumes ` +
    `automatically the moment ${ref} closes, no human step required.`,
};

/**
 * The comment posted when a dead label is reaped.
 *
 * @param {{
 *   issue: {number:number}, outcome: string, run?: {url:string}, marker: string,
 *   pairing: {kind:string, ref?:string}, repeated?: boolean,
 * }} input
 * @returns {string}
 */
export function buildReapComment({ issue, outcome, run, marker, pairing, repeated = false }) {
  const branches = canonicalBranches(issue.number)
    .map((b) => `\`${b}\``)
    .join(" / ");
  const lines = [
    `The label reaper (toon-meta#330) removed \`${IMPLEMENT_LABEL}\`: ` +
      `${OUTCOME_TEXT[outcome] ?? outcome}, and no open PR exists for this ticket (${branches}).`,
    ``,
  ];
  if (run?.url) lines.push(`Run: ${run.url}`, ``);
  if (repeated) {
    lines.push(
      `**Repeat death**: this ticket was reaped once already within the last ` +
        `${REPEAT_WINDOW_HOURS}h — escalating straight to \`needs:human\` rather than repeating ` +
        `the pairing that did not stick.`,
      ``,
    );
  }
  lines.push(
    FOLLOW_UP[outcome] ?? "A human should decide whether to re-dispatch.",
    ``,
    (PAIRING_TEXT[pairing?.kind] ?? (() => ""))(pairing?.ref),
    ``,
    `Removing \`${IMPLEMENT_LABEL}\` alone does not stop the dispatcher from re-labeling this ` +
      `ticket on its very next pass (observed live, buzz#90 — a bare reap spins). The pairing ` +
      `above is what actually stops it; this pass never re-applies \`${IMPLEMENT_LABEL}\` itself ` +
      `— re-dispatching is a human judgement call.`,
    ``,
    `<!-- ${marker} -->`,
  );
  return lines.join("\n");
}
