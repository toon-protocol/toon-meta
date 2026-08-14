// PR repair evaluator (toon-meta#357). The factory covers issue → agent → PR
// → review → merge; nothing covered "PR went red → fix it", so a red PR sat
// red until a human noticed by hand. A red PR also holds its epic's dispatch
// slot — `agent:implement` stays on the ticket until the PR merges — so one
// stuck PR costs a lane indefinitely, and the dead-label reaper (#330)
// explicitly does not help: its condition is "the run finished AND no open PR
// exists", and once a PR exists, red or not, the reaper leaves it alone.
//
// This module is the pure decision half — no GitHub reads or writes here.
// The caller is `automerge-evaluator.mjs`: a PR whose auto-merge evaluation
// blocked ONLY on red checks or a merge conflict (every other precondition —
// approval, needs:human, review state, branch eligibility — already holds) is
// a repair candidate, and `planAutoMerge` asks `planRepair` what to do with
// it. The I/O shell (`auto-merge.mjs`) supplies the extra inputs (main's
// check rollup, prior attempt counts) and executes the resulting action.
//
// ── THE FOUR RULES (from #357, learned from live failures) ─────────────────
//   1. TRANSIENT → re-run the failed jobs, no agent. Today's red, in full, on
//      2026-08-12: `hermit` 503, `artifacts.nixos.org` 503, `release.anza.xyz`
//      failing at 87.5% of a 2.8 GB tarball, `get.nexte.st` 503, and the
//      GitHub release CDN. A naive loop would have burned ~8 agent runs on
//      CDN weather. Classification requires an actual error snippet — a
//      failing check with no captured text is never called transient (fail
//      closed toward "genuine", never guess an infra step passed by name
//      alone; see `classifyCheckFailure`).
//   2. RED ON MAIN → escalate, never dispatch. `toon-client`'s `main` failed
//      typecheck all day; `buzz`'s `ci.yml` failed six consecutive runs
//      across three unrelated branches. An agent cannot fix a repo-level
//      defect from a feature branch, so dispatching is guaranteed waste.
//   3. A BUDGET, THEN STOP. Without a cap an unfixable PR loops forever.
//      Repair attempts (agent:fix dispatches) and free retries (no agent) are
//      tracked and capped SEPARATELY — a transient-looking failure gets a few
//      free re-runs before it is treated as no-longer-transient and escalated
//      (rather than spending the agent-repair budget on CDN weather that
//      never clears); a genuine failure gets a couple of agent attempts
//      before a human is asked to look.
//   4. DO NOT RACE THE REVIEWER. A PR already carrying an outstanding
//      CHANGES_REQUESTED has an agent-shaped task pending. This is enforced
//      by construction in `automerge-evaluator.mjs`, not here: a PR is only
//      ever handed to `planRepair` when its ONLY blockers are red checks or a
//      conflict — any other blocker (review-changes-requested among them)
//      keeps the PR simply `blocked`.
//
// Merge conflicts are the easy case: `mergeable: CONFLICTING` is never
// transient and never repo-level, so it dispatches immediately with no
// classification (still subject to the repair budget).
//
// ── EXPORTED API ────────────────────────────────────────────────────────────
//   AGENT_FIX_LABEL, DEFAULT_REPAIR_BUDGET, DEFAULT_RETRY_BUDGET
//   classifyCheckFailure(check)        → "transient" | "genuine"
//   classifyFailures(failingChecks)    → { overall, perCheck }
//   redOnMain(failingChecks, mainRollup) → failing checks also red on main
//   planRepair(input)                  → { verdict, reason, ... }
//
// Plain Node ESM, zero dependencies. Tests: repair-evaluator.test.mjs
// (node --test).

import { normalizeCheck, FAILING_STATES } from "./pr-signals.mjs";

export const AGENT_FIX_LABEL = "agent:fix";

// "Two repair attempts, then needs:human" (#357). Retries (free re-runs, no
// agent) get their own, separate budget — a transient-looking failure that
// keeps recurring past its free-retry budget is no longer treated as
// transient and is escalated directly, without ever touching the (costlier)
// repair budget.
export const DEFAULT_REPAIR_BUDGET = 2;
export const DEFAULT_RETRY_BUDGET = 2;

// A failing job/check NAME that suggests a download/setup/toolchain step —
// necessary but not sufficient on its own (see classifyCheckFailure: a name
// hint with no error text is never enough to call a failure transient).
const TRANSIENT_NAME_HINTS = [
  /\bsetup\b/i,
  /\binstall\b/i,
  /\btoolchain\b/i,
  /\bcache\b/i,
  /\bdownload\b/i,
  /\bprovision\b/i,
  /\bfetch\b/i,
];

// Transport-shaped errors: curl exit codes for a stalled/reset/DNS-failed
// connection, HTTP 5xx / 429, and the generic network-error phrasings the
// tools in this fleet's setup steps (curl, npm, cargo, rustup) actually emit.
// Never a compiler, linter or test failure shape.
const TRANSIENT_TEXT_PATTERNS = [
  /curl:\s*\(\s*(?:6|7|18|22|28|35|52|55|56|60)\s*\)/i,
  /\bHTTP\/[\d.]+\s*(?:50[0-4]|429)\b/i,
  /\bstatus(?:\s*code)?[:=]?\s*(?:50[0-4]|429)\b/i,
  /\b50[0-4]\b.*\b(?:error|bad gateway|service unavailable|gateway timeout)\b/i,
  /connection reset by peer/i,
  /connection timed out/i,
  /could not resolve host/i,
  /temporary failure in name resolution/i,
  /network is unreachable/i,
  /\bi\/o timeout\b/i,
  /\betimedout\b/i,
  /\beconnreset\b/i,
  /rate limit(?:ed)? exceeded/i,
];

// Hosts named as flaky in #357's own live incident report. Matched against
// the check name + error text together, so a host mention alone (with no
// transport-error text) is still not sufficient — see classifyCheckFailure.
const KNOWN_FLAKY_HOSTS = [
  /\bhermit\b/i,
  /artifacts\.nixos\.org/i,
  /release\.anza\.xyz/i,
  /get\.nexte\.st/i,
  /githubusercontent\.com/i,
  /objects\.githubusercontent\.com/i,
  /github(?:usercontent)?\.com\/.*\/releases\//i,
];

/**
 * Classify one failing check as "transient" (infrastructure — re-run for
 * free) or "genuine" (a real defect — repair candidate).
 *
 * FAILS CLOSED: a failing check with no captured error text is always
 * "genuine", even if its name looks like a setup/download step — a step
 * NAME is not evidence of what actually failed inside it, and treating it as
 * transient on name alone risks silently re-running a real compiler/test
 * failure forever. Only an actual transport-shaped error (or a mention of a
 * known-flaky host) earns "transient", and only when paired with a
 * download/setup-shaped step name — the same two-signal requirement #357's
 * own examples satisfy (a CDN 503 inside a `hermit`/`nixos.org`/`anza.xyz`
 * fetch step, not a bare "curl failed" anywhere in a build).
 *
 * @param {{name?:string, errorText?:string}} check
 * @returns {"transient"|"genuine"}
 */
export function classifyCheckFailure({ name = "", errorText = "" } = {}) {
  if (!errorText) return "genuine";
  const nameLooksLikeInfra = TRANSIENT_NAME_HINTS.some((re) => re.test(name));
  const haystack = `${name}\n${errorText}`;
  const errorLooksTransient =
    TRANSIENT_TEXT_PATTERNS.some((re) => re.test(errorText)) ||
    KNOWN_FLAKY_HOSTS.some((re) => re.test(haystack));
  return nameLooksLikeInfra && errorLooksTransient ? "transient" : "genuine";
}

/**
 * Classify a whole failing-check set. "transient" only when EVERY failing
 * check classifies transient — one genuine failure among several means the
 * PR is a repair candidate, not a free retry (re-running the transient ones
 * would still leave the genuine one red).
 *
 * @param {Array<{name?:string, errorText?:string}>} failingChecks
 * @returns {{overall:"transient"|"genuine", perCheck:Array<object>}}
 */
export function classifyFailures(failingChecks = []) {
  const perCheck = failingChecks.map((c) => ({
    ...c,
    classification: classifyCheckFailure(c),
  }));
  const overall =
    perCheck.length > 0 && perCheck.every((c) => c.classification === "transient")
      ? "transient"
      : "genuine";
  return { overall, perCheck };
}

/**
 * Which of `failingChecks` are ALSO failing on `mainRollup` — a repo-level
 * defect no feature branch can fix (#357 rule 2). Matched by normalized
 * check name; a check absent from main's rollup entirely is not "red on
 * main" (it never ran there, e.g. a paths-filtered job).
 *
 * @param {Array<{name:string}>} failingChecks
 * @param {Array<object>} mainRollup  main's statusCheckRollup shape
 * @returns {Array<{name:string, state:string}>}
 */
export function redOnMain(failingChecks = [], mainRollup = []) {
  const mainByName = new Map(
    (mainRollup ?? []).map((c) => {
      const n = normalizeCheck(c);
      return [n.name, n.state];
    }),
  );
  return failingChecks
    .filter((c) => FAILING_STATES.has(mainByName.get(c.name)))
    .map((c) => ({ name: c.name, state: mainByName.get(c.name) }));
}

/**
 * Decide what to do with a PR whose auto-merge evaluation blocked only on
 * red checks and/or a merge conflict. Pure: same inputs → same plan.
 *
 * @param {{
 *   mergeable?: string,                 // "CONFLICTING" | "MERGEABLE" | ...
 *   failingChecks?: Array<{name:string, state:string, errorText?:string}>,
 *   mainRollup?: Array<object>,         // main's statusCheckRollup, same repo
 *   repairAttempts?: number,            // prior agent:fix dispatches on this PR
 *   retryAttempts?: number,             // prior free re-runs on this PR
 *   hasAgentFixInFlight?: boolean,      // agent:fix currently applied
 *   repairBudget?: number,
 *   retryBudget?: number,
 * }} input
 * @returns {{
 *   verdict: "retry"|"repair"|"escalate"|null,
 *   reason: string,
 *   classification?: "transient"|"genuine",
 *   redOnMain?: Array<{name:string, state:string}>,
 * }}
 */
export function planRepair({
  mergeable = "MERGEABLE",
  failingChecks = [],
  mainRollup = [],
  repairAttempts = 0,
  retryAttempts = 0,
  hasAgentFixInFlight = false,
  repairBudget = DEFAULT_REPAIR_BUDGET,
  retryBudget = DEFAULT_RETRY_BUDGET,
} = {}) {
  if (hasAgentFixInFlight)
    return {
      verdict: null,
      reason: `${AGENT_FIX_LABEL} is already applied — a repair run is in flight`,
    };

  const conflicting = String(mergeable ?? "").toUpperCase() === "CONFLICTING";
  if (!conflicting && failingChecks.length === 0)
    return { verdict: null, reason: "nothing to repair" };

  // Merge conflicts dispatch immediately, no classification (#357: "never
  // transient and never repo-level"), still subject to the repair budget so
  // a conflict an agent cannot actually resolve does not loop forever.
  if (conflicting) {
    if (repairAttempts >= repairBudget)
      return {
        verdict: "escalate",
        reason:
          `merge conflict persisted through ${repairAttempts} repair ` +
          `attempt(s) (budget ${repairBudget})`,
      };
    return { verdict: "repair", reason: "PR conflicts with its base branch" };
  }

  // Rule 2: a failing check that is ALSO red on main is a repo-level defect.
  const mainRed = redOnMain(failingChecks, mainRollup);
  if (mainRed.length > 0)
    return {
      verdict: "escalate",
      reason:
        `also failing on main: ${mainRed.map((c) => c.name).join(", ")} — a feature ` +
        "branch cannot fix a repo-level defect",
      redOnMain: mainRed,
    };

  // Rule 1: an all-transient failure set is re-run for free, up to its own
  // budget — past that it is no longer treated as transient (a check that
  // stays red after several free re-runs is not CDN weather).
  const { overall: classification } = classifyFailures(failingChecks);
  if (classification === "transient") {
    if (retryAttempts >= retryBudget)
      return {
        verdict: "escalate",
        reason:
          `still failing after ${retryAttempts} free re-run(s) (budget ${retryBudget}) ` +
          "— no longer treated as transient",
        classification,
      };
    return {
      verdict: "retry",
      reason:
        "failing check(s) look transient (infrastructure): " +
        failingChecks.map((c) => c.name).join(", "),
      classification,
    };
  }

  // Genuine failure: not on main, not already being repaired.
  if (repairAttempts >= repairBudget)
    return {
      verdict: "escalate",
      reason: `still red after ${repairAttempts} repair attempt(s) (budget ${repairBudget})`,
      classification,
    };
  return {
    verdict: "repair",
    reason:
      "genuine failing check(s), not present on main: " +
      failingChecks.map((c) => c.name).join(", "),
    classification,
  };
}
