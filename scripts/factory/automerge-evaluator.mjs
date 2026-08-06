// Auto-merge evaluator (toon-meta#285, epic #270).
//
// The pure decision half of the auto-merge pass: given the fleet's open agent
// PRs and each repo's LIVE branch-protection policy, decide which PRs may
// merge themselves, which are only stale (behind base), and which are blocked
// — and on what, precisely. No GitHub reads or writes here; the I/O shell is
// scripts/factory/auto-merge.mjs.
//
// ── THE SEAM: OUR ELIGIBILITY vs GITHUB'S NATIVE AUTO-MERGE ─────────────────
// The ticket asks for `gh pr merge --auto` so that GITHUB enforces branch
// protection rather than us reimplementing it. That is right, and it is not
// sufficient, because native auto-merge merges as soon as *protection* is
// satisfied — and protection cannot express three of this ticket's five
// preconditions:
//
//   1. EMPTY / SKIPPED CHECK SETS. Branch protection counts a required check
//      reported as `skipped` (and, on repos whose gate is paths-filtered, a
//      check that never reports at all until it does) as satisfied. #285's
//      acceptance criterion is the opposite: a PR whose check set is empty or
//      all-skipped must NOT merge. Only our verdict can say that.
//   2. `needs:human`, on the PR *or its linked issue*. GitHub has no notion of
//      a label as a merge gate.
//   3. WHO approved. Protection can require "1 approval"; it cannot require
//      "the factory-ops machine verdict (#275/#282), not just anybody".
//      Worse, six of the eleven factory repos require ZERO approvals, so
//      protection would happily merge an unreviewed agent PR.
//
// So the seam is: **this pass is the stricter gate; GitHub is the final,
// authoritative one.** We decide eligibility with the extra preconditions, and
// then hand the merge to the native mechanism, which re-checks protection at
// the moment of merging (catching anything that turned red, or a base branch
// that moved, between our decision and the merge). Neither side can merge what
// the other rejects. We never reimplement protection, and we never delegate a
// precondition protection cannot express.
//
// Concretely, the action for an eligible PR is:
//   * `enable-auto-merge` — `gh pr merge --auto` — when the repo has GitHub's
//     auto-merge feature turned on. Arming it is safe precisely BECAUSE we
//     only ever arm PRs that already satisfy the strict preconditions; the
//     native mechanism then adds re-verification, not a weaker gate.
//   * `merge` — a direct `gh pr merge` — when the repo does NOT have the
//     auto-merge feature enabled (all 11 factory repos, as of 2026-08-06:
//     `allow_auto_merge: false`). A direct merge is still refused by GitHub
//     if protection is unsatisfied — the REST merge endpoint enforces branch
//     protection — so this fallback loses the *waiting*, not the *enforcing*.
//     It is therefore only ever produced for a PR that is verified green and
//     `CLEAN` right now, never for one that is pending.
//   Flipping `allow_auto_merge` on is a one-line repo setting and is the
//   recommended rollout step (see FACTORY.md); until then the fallback keeps
//   the loop closed.
//
// ── PRECONDITIONS (all must hold; every failure is reported, not just the
//    first, so one dry-run report explains every stuck PR) ─────────────────
//   policy-readable       the repo's branch protection could actually be READ.
//                         An unreadable policy (a credential that lost its
//                         access) is not an absent one and is not a pass.
//   repo-enabled          the repo has an enforced required status check, and
//                         is not on the excluded list (buzz — its required
//                         contexts are still #272's interim pair, pending
//                         #279's aggregate; an interim pair of always-run
//                         jobs is not a gate).
//   required-checks       EVERY required context is present in the PR's check
//                         rollup AND concluded SUCCESS. Missing → blocked
//                         (a required context that never reported is the
//                         empty-check-set failure mode, not a pass). SKIPPED
//                         or NEUTRAL → blocked, explicitly, even though
//                         protection would accept it.
//   overall-checks        the whole rollup's four-valued verdict (pr-signals
//                         .mjs) is `passed` — a failing non-required check
//                         still means the PR is not green, and `pending` means
//                         wait for the next pass, not merge now.
//   approval              a latest opinionated review from the factory-ops
//                         approver identity is APPROVED, no reviewer has an
//                         outstanding CHANGES_REQUESTED, and the review
//                         decision is not REVIEW_REQUIRED. A known approval
//                         commit that is not the PR head is STALE → blocked.
//   needs:human           absent from the PR and from every linked issue.
//   mergeable             settled `MERGEABLE` (the shell polls it out of
//                         UNKNOWN via pr-signals.settleMergeable; UNKNOWN
//                         here is a blocker — never judged clean).
//   merge-state           `CLEAN`, or `BEHIND` (strict protection: the branch
//                         must be updated first — see below). Anything else
//                         (BLOCKED, DIRTY, UNSTABLE, DRAFT, UNKNOWN) is a
//                         blocker; unrecognized values fail closed.
//
// ── BEHIND-BASE IS AN ACTION, NOT A VERDICT ─────────────────────────────────
// Every factory repo runs STRICT protection (#272): the branch must be up to
// date with `main` before merging. With ten repos merging all day, an
// otherwise-perfect PR goes BEHIND constantly, and nothing else in the factory
// updates branches — so "wait for someone to update it" is a permanent stall,
// not a safety property. A PR that satisfies EVERY other precondition and is
// only BEHIND therefore gets `update-branch` (merge base into head). That is
// not a merge: it re-runs CI on the new head, and the next pass — triggered by
// those very checks completing — re-evaluates from scratch. Because the update
// is gated behind all the other preconditions, it never churns a PR that was
// not about to merge anyway.
//
// ── EXPORTED API ────────────────────────────────────────────────────────────
//   planAutoMerge(input)          → { decisions, actions, summary }
//   latestOpinionatedReviews(rs)  → Map<normalized login, review>
//   normalizeLogin(login)         → comparable identity string
//   requiredCheckStates(...)      → per-required-context state report
//   DEFAULT_EXCLUDED_REPOS
//
// Plain Node ESM, zero dependencies. Tests: automerge-evaluator.test.mjs
// (node --test).

import { checksVerdict, normalizeCheck, VERIFIED_STATE } from "./pr-signals.mjs";

export const HUMAN_LABEL = "needs:human";
export const FACTORY_BRANCH_PREFIXES = ["sandcastle/", "agent/"];

// Repos where an enforced required check EXISTS but is not yet a real gate.
// buzz's required contexts are #272's interim pair (`Detect Changed Paths`,
// `Dead Token Reference Guard`) — the only two jobs in buzz's ci.yml that run
// unconditionally, while the other ~20 are paths-filtered and report `skipped`.
// Requiring them proves the workflow started, not that buzz's code is good.
// #279 repoints buzz at a real aggregate; remove buzz from this list then.
export const DEFAULT_EXCLUDED_REPOS = {
  "toon-protocol/buzz":
    "required contexts are #272's interim pair (Detect Changed Paths, Dead " +
    "Token Reference Guard), not an aggregate gate — pending toon-meta#279",
};

// States that are NOT a pass for a REQUIRED context, listed separately from
// pr-signals' failing set because the interesting ones here are the states
// branch protection quietly accepts.
const NON_VERIFYING_STATES = new Set(["SKIPPED", "NEUTRAL", "STALE"]);

/** Compare actor logins across GraphQL (`app/slug`) and REST (`slug[bot]`). */
export function normalizeLogin(login) {
  return String(login ?? "")
    .toLowerCase()
    .replace(/^app\//, "")
    .replace(/\[bot\]$/, "");
}

const canonicalId = (pr) => `${String(pr.repo).toLowerCase()}#${pr.number}`;
const labelNames = (labels) =>
  (labels ?? []).map((l) => (typeof l === "string" ? l : l.name));

/**
 * Reduce a PR's full review list to the latest OPINIONATED review per author,
 * GitHub's own rule: a `COMMENTED` review never overrides an earlier APPROVED
 * or CHANGES_REQUESTED, and `PENDING` (an unsubmitted draft) is not a review
 * at all. `DISMISSED` does count — it is how an approval is revoked.
 *
 * @param {Array<{author?:string,user?:{login:string},state:string,
 *   commitId?:string,submittedAt?:string}>} reviews  chronological order
 * @returns {Map<string, {author:string,state:string,commitId?:string}>}
 */
export function latestOpinionatedReviews(reviews = []) {
  const out = new Map();
  for (const r of reviews) {
    const state = String(r.state ?? "").toUpperCase();
    if (!["APPROVED", "CHANGES_REQUESTED", "DISMISSED"].includes(state)) continue;
    const author = normalizeLogin(r.author ?? r.user?.login);
    out.set(author, {
      author,
      state,
      commitId: r.commitId ?? r.commit_id ?? undefined,
      submittedAt: r.submittedAt ?? r.submitted_at ?? undefined,
    });
  }
  return out;
}

/**
 * State of each required context against a PR's check rollup.
 *
 * @returns {Array<{context:string, state:string,
 *   status:"passed"|"missing"|"not-verifying"|"failing-or-pending"}>}
 */
export function requiredCheckStates(requiredContexts = [], rollup = []) {
  const byName = new Map();
  for (const c of rollup ?? []) {
    const n = normalizeCheck(c);
    // Last writer wins: a re-run reports again under the same name and the
    // fresher entry is the one gh lists later.
    byName.set(n.name, n.state);
  }
  return requiredContexts.map((context) => {
    if (!byName.has(context)) return { context, state: "∅", status: "missing" };
    const state = byName.get(context);
    if (state === VERIFIED_STATE) return { context, state, status: "passed" };
    if (NON_VERIFYING_STATES.has(state)) return { context, state, status: "not-verifying" };
    return { context, state, status: "failing-or-pending" };
  });
}

/**
 * Plan one auto-merge pass. Pure: same inputs → same plan.
 *
 * @param {{
 *   prs: Array<{
 *     repo: string, number: number, title?: string, url?: string,
 *     headRefName?: string, headSha?: string, isDraft?: boolean,
 *     labels?: Array<string|{name:string}>,
 *     mergeable?: string,          // settled by the shell (pr-signals)
 *     mergeStateStatus?: string,   // CLEAN | BEHIND | BLOCKED | DIRTY | ...
 *     reviewDecision?: string,     // APPROVED | CHANGES_REQUESTED | REVIEW_REQUIRED | ""
 *     reviews?: Array<object>,     // chronological, REST or GraphQL shape
 *     statusCheckRollup?: Array<object>,
 *     autoMergeEnabled?: boolean,  // native auto-merge already armed
 *     author?: string,
 *     linkedIssues?: Array<{ id?:string, labels?:Array<string|{name:string}> }>,
 *   }>,
 *   repoPolicies: Object<string, {
 *     requiredContexts?: string[], strict?: boolean, source?: string,
 *     autoMergeAllowed?: boolean, mergeMethod?: string }>,  // keys lowercased
 *   approvers: string[],            // logins that count as the machine approver
 *   excludedRepos?: Object<string,string>,  // repo → why not eligible
 * }} input
 * @returns {{
 *   decisions: Array<{ id, repo, number, title, url,
 *     verdict: "merge"|"update-branch"|"already-armed"|"blocked",
 *     action: null | { type:"enable-auto-merge"|"merge"|"update-branch",
 *                      repo, number, method?:string, reason:string },
 *     blockers: Array<{code:string, detail:string}>,
 *     signals: object }>,
 *   actions: Array<object>,
 *   summary: Object<string, number>,
 * }}
 */
export function planAutoMerge({
  prs = [],
  repoPolicies = {},
  approvers = [],
  excludedRepos = DEFAULT_EXCLUDED_REPOS,
} = {}) {
  const approverSet = new Set(approvers.map(normalizeLogin).filter(Boolean));
  const decisions = [];

  for (const pr of [...prs].sort((a, b) => (canonicalId(a) < canonicalId(b) ? -1 : 1))) {
    const id = canonicalId(pr);
    const repoKey = String(pr.repo).toLowerCase();
    const policy = repoPolicies[repoKey] ?? {};
    const blockers = [];
    const add = (code, detail) => blockers.push({ code, detail });

    // ── repo eligibility ────────────────────────────────────────────────────
    const required = policy.requiredContexts ?? [];
    const excludedReason = excludedRepos?.[repoKey];
    if (excludedReason) add("repo-not-enabled", `repo excluded: ${excludedReason}`);
    else if (policy.readError)
      // "Could not read the protection" must never look like "there is no
      // protection", and must never look like a pass: the credential losing
      // its read on branch protection is exactly the silent-rot failure #271
      // exists to catch, so it is reported under its own code.
      add(
        "policy-unreadable",
        `branch protection could not be read (${policy.readError}) — failing ` +
          "closed; an unreadable policy is not an absent one",
      );
    else if (required.length === 0)
      add(
        "repo-not-enabled",
        "no enforced required status check on the base branch — auto-merge is " +
          "enabled per repo only once #272-style protection exists there",
      );

    // ── shape ───────────────────────────────────────────────────────────────
    if (pr.isDraft) add("draft", "PR is a draft");
    if (
      pr.headRefName &&
      !FACTORY_BRANCH_PREFIXES.some((p) => pr.headRefName.startsWith(p))
    )
      add(
        "not-factory-branch",
        `head branch '${pr.headRefName}' is not ${FACTORY_BRANCH_PREFIXES.join("/")}` +
          " — auto-merge only ever touches agent PRs",
      );

    // ── needs:human, on the PR or any linked issue ──────────────────────────
    if (labelNames(pr.labels).includes(HUMAN_LABEL))
      add("needs-human", `PR carries ${HUMAN_LABEL}`);
    for (const iss of pr.linkedIssues ?? []) {
      if (labelNames(iss.labels).includes(HUMAN_LABEL))
        add("needs-human-issue", `linked issue ${iss.id ?? "?"} carries ${HUMAN_LABEL}`);
    }

    // ── checks: required contexts first, then the whole rollup ──────────────
    const requiredStates = requiredCheckStates(required, pr.statusCheckRollup);
    for (const rc of requiredStates) {
      if (rc.status === "passed") continue;
      if (rc.status === "missing")
        add(
          "required-check-missing",
          `required check '${rc.context}' never reported on this PR — an absent ` +
            "check verifies nothing (it is the empty-check-set failure mode)",
        );
      else if (rc.status === "not-verifying")
        add(
          "required-check-unverified",
          `required check '${rc.context}' is ${rc.state} — branch protection ` +
            "accepts that, this pass does not: a skipped check is not a pass",
        );
      else
        add(
          "required-check-not-green",
          `required check '${rc.context}' is ${rc.state}`,
        );
    }
    const overall = checksVerdict(pr.statusCheckRollup);
    if (overall.verdict === "failing")
      add(
        "checks-failing",
        `${overall.failing.length} failing check(s): ` +
          overall.failing.slice(0, 5).map((f) => `${f.name}=${f.state}`).join(", "),
      );
    else if (overall.verdict === "pending")
      add("checks-pending", "checks still running — re-evaluated when they complete");
    else if (overall.verdict === "unverified")
      add(
        "checks-unverified",
        "check set is empty or all-skipped — nothing ran to a real SUCCESS, so " +
          "there is nothing to merge on",
      );

    // ── approval (the #275 verdict as submitted by #282) ────────────────────
    const latest = latestOpinionatedReviews(pr.reviews);
    const changesRequested = [...latest.values()].filter(
      (r) => r.state === "CHANGES_REQUESTED",
    );
    const approvals = [...latest.values()].filter(
      (r) => r.state === "APPROVED" && approverSet.has(r.author),
    );
    if (changesRequested.length)
      add(
        "review-changes-requested",
        `outstanding CHANGES_REQUESTED from ${changesRequested
          .map((r) => r.author)
          .join(", ")}`,
      );
    if (String(pr.reviewDecision ?? "").toUpperCase() === "REVIEW_REQUIRED")
      add("review-required", "branch protection still reports REVIEW_REQUIRED");
    if (approverSet.size === 0)
      add(
        "approver-unknown",
        "no factory-ops approver identity resolved — cannot tell a machine " +
          "verdict from any other approval (failing closed)",
      );
    else if (approvals.length === 0)
      add(
        "approval-missing",
        `no APPROVED review from the factory-ops approver ` +
          `(${[...approverSet].join(", ")}) — the #275 verdict has not been ` +
          "submitted clean (#282) on this PR",
      );
    else if (pr.headSha) {
      // An approval whose commit is KNOWN and is not the current head reviewed
      // different code. (`dismiss_stale_reviews` is off fleet-wide, so GitHub
      // will not catch this for us.) An unknown commit is not treated as
      // stale — the check-set verdict is the independent guard on the head.
      const stale = approvals.filter((a) => a.commitId && a.commitId !== pr.headSha);
      if (stale.length === approvals.length)
        add(
          "approval-stale",
          `the factory-ops approval is for commit ${stale[0].commitId.slice(0, 8)}, ` +
            `not the current head ${String(pr.headSha).slice(0, 8)}`,
        );
    }
    // The approver must never also be the PR author (#282's anti-rot rule,
    // re-asserted here so a misconfigured approver identity cannot self-approve
    // its way to a merge).
    if (pr.author && approverSet.has(normalizeLogin(pr.author)))
      add(
        "approver-is-author",
        `the approver identity (${normalizeLogin(pr.author)}) authored this PR`,
      );

    // ── mergeability + merge state ──────────────────────────────────────────
    const mergeable = String(pr.mergeable ?? "UNKNOWN").toUpperCase();
    if (mergeable === "CONFLICTING") add("conflict", "PR conflicts with its base branch");
    else if (mergeable !== "MERGEABLE")
      add(
        "mergeable-unsettled",
        `mergeable is ${mergeable} — GitHub computes it asynchronously; an ` +
          "unsettled PR is never judged clean",
      );

    const state = String(pr.mergeStateStatus ?? "UNKNOWN").toUpperCase();
    const behind = state === "BEHIND";
    if (!["CLEAN", "BEHIND"].includes(state)) {
      const detail = {
        BLOCKED:
          "GitHub reports BLOCKED — protection wants something this pass has " +
          "not accounted for (fail closed rather than guess)",
        DIRTY: "GitHub reports DIRTY — merge conflict",
        UNSTABLE: "GitHub reports UNSTABLE — a non-required check is failing or pending",
        DRAFT: "GitHub reports DRAFT",
        UNKNOWN: "GitHub has not computed the merge state yet",
        HAS_HOOKS: "GitHub reports HAS_HOOKS — a pre-receive hook governs this merge",
      }[state];
      add("merge-state", detail ?? `unrecognized merge state '${state}' — failing closed`);
    }

    const signals = {
      checks: overall.verdict,
      requiredChecks: requiredStates,
      requiredSource: policy.source ?? "unknown",
      mergeable,
      mergeState: state,
      approvedBy: approvals.map((a) => a.author),
      autoMergeAllowed: policy.autoMergeAllowed === true,
      autoMergeEnabled: pr.autoMergeEnabled === true,
    };

    let verdict = "blocked";
    let action = null;
    if (blockers.length === 0) {
      if (behind) {
        verdict = "update-branch";
        action = {
          type: "update-branch",
          repo: pr.repo,
          number: pr.number,
          // Carried so the shell can pin the update to the head we judged —
          // if the branch moved meanwhile, GitHub rejects the update rather
          // than acting on a PR nobody evaluated.
          headSha: pr.headSha,
          reason:
            "every precondition holds but the branch is behind base (strict " +
            "protection) — update it; checks re-run and the next pass merges",
        };
      } else if (pr.autoMergeEnabled) {
        verdict = "already-armed";
      } else if (policy.autoMergeAllowed === true) {
        verdict = "merge";
        action = {
          type: "enable-auto-merge",
          repo: pr.repo,
          number: pr.number,
          method: policy.mergeMethod ?? "squash",
          reason:
            "eligible — arming GitHub's native auto-merge so protection is " +
            "re-enforced by GitHub at the moment of merging",
        };
      } else {
        verdict = "merge";
        action = {
          type: "merge",
          repo: pr.repo,
          number: pr.number,
          method: policy.mergeMethod ?? "squash",
          reason:
            "eligible and CLEAN now; the repo has GitHub's auto-merge feature " +
            "disabled, so merge directly — the merge endpoint still enforces " +
            "branch protection",
        };
      }
    }

    decisions.push({
      id,
      repo: pr.repo,
      number: pr.number,
      title: pr.title,
      url: pr.url,
      verdict,
      action,
      blockers,
      signals,
    });
  }

  const summary = {};
  for (const d of decisions) summary[d.verdict] = (summary[d.verdict] ?? 0) + 1;
  return {
    decisions,
    actions: decisions.map((d) => d.action).filter(Boolean),
    summary,
  };
}
