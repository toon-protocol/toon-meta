// Fork-PR-approval watch — pure decision logic (toon-meta#360, epic #342).
//
// ── THE FAILURE THIS CLOSES ──────────────────────────────────────────────
// GitHub gates Actions runs on fork PRs behind a maintainer-approval setting.
// An unapproved run concludes `action_required` with no job ever scheduled,
// which means it creates NO CheckRun for the PR's Checks tab (`gh pr checks`
// prints nothing; `statusCheckRollup` is empty) and fires NO `check_suite`
// event for anything event-driven to wake up on. connector#925 (fork PR,
// opened 2026-08-10) sat this way for two days — invisible, not merely red —
// until a human found it by hand on 2026-08-12 while triaging. In the
// meantime connector#927 landed the same decision under a different filename,
// which would have produced two ADR 0035s.
//
// ── WHY `head_sha`, NOT THE RUN'S `pull_requests` FIELD, CORRELATES A RUN
//    TO A PR ────────────────────────────────────────────────────────────
// A workflow run's `pull_requests` array is meant to name the PR(s) it
// belongs to, but for a run triggered by a FORK's `pull_request` event that
// array is always empty (a documented GitHub privacy limit, verified live
// against the two action_required runs connector#925 — a PR from the
// RawNuke/connector fork — left in toon-protocol/connector, both with
// `pull_requests: []`). The only reliable correlation is the run's
// `head_sha` against the PR's own `headRefOid`, which also naturally excludes
// stale runs left over from a since-superseded commit.
//
// ── WHY THE LABEL ALONE IS SAFE IDEMPOTENCY, SET AND CLEARED UNCONDITIONALLY
// Unlike `needs:human` (#353), `needs:approval` is never applied by a human —
// it is a pure machine signal ("some run at this PR's current head needs a
// maintainer's Actions approval to proceed"). Same reasoning as `agent:review`
// clearing (#355): no ownership check is needed, so the pass may set it and
// clear it freely. Still-blocked + label-present is "already surfaced" (no
// duplicate comment); no-longer-blocked + label-present clears it, so the
// label never lies about current state — the same "every applied label needs
// a clearer" discipline this repo applies everywhere else (needs:human #353,
// agent:review #355, agent:implement #330, agent:fix #357).

export const FORK_APPROVAL_LABEL = "needs:approval";

/**
 * @param {{ isCrossRepository: boolean,
 *           hasLabel: boolean,
 *           blockedRuns: Array<{ id: number|string, name: string, url: string }> }} input
 * @returns {{ verdict: "surface"|"noop"|"clear"|"skip", blockedRuns: Array }}
 */
export function planForkApproval({ isCrossRepository, hasLabel, blockedRuns }) {
  // Scoped to fork PRs specifically — that is the class GitHub gates (#360's
  // own acceptance criterion). A same-repo PR never hits this approval gate.
  if (!isCrossRepository) return { verdict: "skip", blockedRuns: [] };

  const blocked = blockedRuns ?? [];
  if (blocked.length > 0) {
    return { verdict: hasLabel ? "noop" : "surface", blockedRuns: blocked };
  }
  // Nothing blocked at the current head: clear a stale label, else no-op.
  return { verdict: hasLabel ? "clear" : "skip", blockedRuns: [] };
}

/** Hidden marker embedded in the surfacing comment, for searchability only —
 * idempotency itself is carried by the label (see header), not this marker. */
export const forkApprovalMarker = (repo, prNumber) =>
  `fork-approval-watch:${repo.replace(/[^a-zA-Z0-9]+/g, "-")}-pr-${prNumber}`;

/** Build the comment body naming the PR's blocked run(s), one click to fix. */
export function buildSurfaceComment({ repo, prNumber, blockedRuns }) {
  const plural = blockedRuns.length > 1;
  const lines = [
    `⚠️ **This fork PR's workflow run${plural ? "s are" : " is"} pending maintainer ` +
      `approval** (GitHub's fork-PR Actions gate). No checks have run at all, which ` +
      `reads as "nothing configured" rather than "blocked" — see ` +
      `[toon-meta#360](https://github.com/toon-protocol/toon-meta/issues/360).`,
    ``,
    `Blocked run${plural ? "s" : ""}:`,
    ...blockedRuns.map((r) => `- [\`${r.name}\`](${r.url})`),
    ``,
    `Approve from the Actions tab (or ` +
      `\`gh api -X POST repos/{repo}/actions/runs/{run_id}/approve\`) to let CI run. ` +
      `\`${FORK_APPROVAL_LABEL}\` clears automatically once no run at this PR's current ` +
      `head is pending approval.`,
    ``,
    `<!-- ${forkApprovalMarker(repo, prNumber)} -->`,
  ];
  return lines.join("\n");
}
