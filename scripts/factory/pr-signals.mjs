// PR merge signals — the two facts every "is this PR safe to act on?" pass
// reads (toon-meta#285, epic #270). EXTRACTED VERBATIM from
// pr-housekeeping.mjs (#276), which is now a consumer: the check-set verdict
// and the mergeability-settling policy are battle-tested and must exist ONCE,
// or the auto-merge pass and the housekeeping pass can disagree about whether
// the same PR is green — the exact class of bug that lets a PR be remediated
// as failing and merged as passing in the same minute.
//
// ── CHECK-SET HONESTY (the buzz gotcha) ─────────────────────────────────────
// A skipped check is not a passing check, and an EMPTY check set is not a
// green one. buzz's CI is paths-filtered across ~20 jobs; buzz#141 had an
// entirely empty check set. "No failing checks" is true of it and means
// nothing. The verdict is therefore FOUR-valued:
//   failing / pending / passed / unverified
// where `unverified` means "nothing ran to a real SUCCESS" (empty rollup, or
// all SKIPPED/NEUTRAL). `unverified` is never `passed`. Branch protection
// itself does NOT make this distinction — GitHub counts a `skipped` required
// check as satisfied — which is precisely why the auto-merge pass cannot
// delegate this judgement to GitHub (see automerge-evaluator.mjs).
//
// ── MERGEABILITY IS COMPUTED ASYNCHRONOUSLY (the silent-wrongness gotcha) ───
// Immediately after a merge, GitHub reports `mergeable: UNKNOWN` for every
// other open PR for several seconds while it recomputes. Judging at that
// moment records conflicted PRs as clean. Any PR still UNKNOWN is therefore
// POLLED (GETting the PR is what schedules the recomputation) until it settles
// to MERGEABLE/CONFLICTING or the poll budget runs out — and a PR that never
// settles is reported, never judged.
//
// `settleMergeable` takes the read and the sleep as injected functions so the
// policy is unit-testable without a network or a real clock; the gh call and
// the timer live in the shells.
//
// ── EXPORTED API ────────────────────────────────────────────────────────────
//   checksVerdict(rollup)                  → { verdict, failing }
//   settleMergeable({ initial, refetch, sleep, tries, intervalMs }) → string
//   FAILING_STATES / PENDING_STATES / VERIFIED_STATE / PLUMBING_CHECKS
//
// Plain Node ESM, zero dependencies. Tests: pr-signals.test.mjs (node --test).

export const FAILING_STATES = new Set([
  "FAILURE",
  "ERROR",
  "TIMED_OUT",
  "CANCELLED",
  "STARTUP_FAILURE",
]);

export const PENDING_STATES = new Set([
  "PENDING",
  "QUEUED",
  "IN_PROGRESS",
  "WAITING",
  "REQUESTED",
  "EXPECTED",
  "ACTION_REQUIRED",
]);

/** The ONLY state that counts as "this check actually ran and passed". */
export const VERIFIED_STATE = "SUCCESS";

/** Normalize one statusCheckRollup entry (CheckRun or StatusContext shape). */
export function normalizeCheck(c) {
  return {
    name: c.name || c.context || "?",
    state: (c.conclusion || c.state || c.status || "").toUpperCase(),
  };
}

/**
 * Factory PLUMBING check names — jobs the factory's own event-triggered
 * workflows attach to a PR's rollup that verify NOTHING about the change:
 * the fleet auto-merge pass itself (`automerge`), the housekeeping sweep
 * (`sweep`), each repo's forwarding shim (`forward`), and the agent
 * runner trigger-guards and runner jobs (`guard`/`review`/`fix`/
 * `implement`). They are excluded from the verdict in BOTH directions —
 * found live 2026-08-14 by the AFK drill on toon-meta#368:
 *
 *   - pending: a pull_request-event pass sees ITS OWN in-progress
 *     `automerge` job in the rollup, self-blocks `checks-pending`, and —
 *     because the pass's own workflow is deliberately absent from every
 *     workflow_run trigger list — its completion re-fires nothing. A
 *     self-inflicted deadlock on every PR-event evaluation.
 *   - passed: an `automerge: SUCCESS` run must never be the check that
 *     satisfies "at least one check actually RAN and SUCCEEDED" on a PR
 *     with no real CI.
 *
 * Required contexts are unaffected: `requiredCheckStates` matches branch
 * protection's own names against the raw rollup, and no protection names
 * a plumbing job. If a repo ever names REAL CI after one of these words,
 * rename one of the two — this set is matched exactly, by design.
 */
export const PLUMBING_CHECKS = new Set([
  "automerge",
  "sweep",
  "forward",
  "guard",
  "review",
  "fix",
  "implement",
]);

/**
 * Four-valued verdict over a PR's whole statusCheckRollup.
 *
 * "passed" requires at least one check that actually RAN and SUCCEEDED — an
 * empty rollup, or one that is all SKIPPED/NEUTRAL, verifies nothing.
 * Factory plumbing runs (PLUMBING_CHECKS) are invisible here, both as
 * blockers and as verification.
 *
 * @param {Array<object>} rollup  gh's `statusCheckRollup` array (may be null)
 * @returns {{ verdict: "failing"|"pending"|"passed"|"unverified",
 *             failing: Array<{name:string,state:string}> }}
 */
export function checksVerdict(rollup) {
  const states = (rollup ?? [])
    .map(normalizeCheck)
    .filter((s) => !PLUMBING_CHECKS.has(s.name));
  const failing = states.filter((s) => FAILING_STATES.has(s.state));
  if (failing.length) return { verdict: "failing", failing };
  if (states.some((s) => PENDING_STATES.has(s.state)))
    return { verdict: "pending", failing: [] };
  const ranGreen = states.filter((s) => s.state === VERIFIED_STATE);
  if (ranGreen.length === 0) return { verdict: "unverified", failing: [] };
  return { verdict: "passed", failing: [] };
}

/**
 * Poll a PR's `mergeable` out of UNKNOWN. Returns the settled value, or
 * "UNKNOWN" when the budget ran out — callers MUST treat that as unjudgeable
 * (never as clean, never as conflicted).
 *
 * @param {{ initial?: string,
 *           refetch: () => Promise<string|undefined>|string|undefined,
 *           sleep?: (ms:number)=>Promise<void>,
 *           tries?: number, intervalMs?: number }} input
 * @returns {Promise<string>} "MERGEABLE" | "CONFLICTING" | "UNKNOWN"
 */
export async function settleMergeable({
  initial,
  refetch,
  sleep = async () => {},
  tries = 8,
  intervalMs = 4000,
} = {}) {
  let value = (initial ?? "UNKNOWN").toUpperCase();
  for (let i = 0; i < tries && value === "UNKNOWN"; i++) {
    await sleep(intervalMs);
    const fresh = await refetch();
    value = (fresh ?? "UNKNOWN").toUpperCase();
  }
  return value;
}
