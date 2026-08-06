// Ticket-hygiene evaluator (toon-meta#277, epic #270).
//
// The pure decision logic behind the weekly ticket-hygiene sweep
// (ticket-hygiene.mjs). No GitHub reads or writes in this module — all state
// (labels, timestamps, PR references, PR states) is passed in by the caller,
// so every rule is unit-testable offline. Same split as
// unblock-evaluator.mjs / its runner.
//
// Three categories, deliberately different treatment, because the risk of
// being wrong differs enormously between them:
//
//   STALE     — reversible two-step: label + comment first, close only after a
//               grace period with zero activity. Protected labels are never
//               touched.
//   OBSOLETE  — auto-close, but ONLY the two mechanically decidable cases
//               (merged PR whose `Closes #n` link did not fire; housekeeping
//               remediation issue whose target PR is done). Everything else
//               is out of scope on purpose.
//   REDUNDANT — never automatic. clusterRedundant() only PROPOSES candidate
//               duplicate clusters for a human to confirm.
//
// ── EXPORTED API ────────────────────────────────────────────────────────────
//   PROTECTED_LABELS, STALE_LABEL, REPORT_MARKER
//   staleMarker(repo, issue) / obsoleteMarker(repo, issue)
//   closeLinkedIssues(text)      → Set<number>  (strict close-keyword refs)
//   referencedIssues(text)       → Set<number>  (ANY #N mention — broad)
//   parseStuckMarker(body)       → housekeeping/triage stuck marker, or null
//   evaluateStale(issue, ctx)    → { action, reason } for the stale lifecycle
//   findObsoleteFromMergedPrs(…) → { closable, skippedProtected }
//   evaluateRemediationObsolete(…) → close/keep verdict for a remediation issue
//   titleTokens(title) / clusterRedundant(issues, opts)
//
// Plain Node ESM, zero dependencies. Tests: hygiene-evaluator.test.mjs
// (node --test).

// ── Constants & markers ─────────────────────────────────────────────────────

// Long-lived by design — hygiene must NEVER touch issues carrying these.
export const PROTECTED_LABELS = new Set(["epic", "tracking", "needs:human"]);

export const STALE_LABEL = "stale";

// Hidden marker identifying the weekly hygiene report issue (redundancy
// proposals live there). Slash/hash-free so GitHub issue search can find it;
// callers re-check the exact string client-side (search is tokenized/fuzzy).
export const REPORT_MARKER = "ticket-hygiene-report";

export const sanitizeRepo = (repo) => String(repo).replace(/[^a-zA-Z0-9]+/g, "-");

// Marker embedded in the stale-warning comment. Its presence + timestamp is
// the provenance for the later close: grace is measured from when WE marked,
// never from updatedAt (which our own comment bumps).
export const staleMarker = (repo, issue) =>
  `ticket-hygiene-stale:${sanitizeRepo(repo)}-issue-${issue}`;

// Marker embedded in every obsolete auto-close comment. If a human REOPENS an
// auto-closed issue, this marker is how the next sweep knows to keep its hands
// off instead of re-closing (the merged-PR evidence never goes away, so
// without this the reopen would be silently reverted every week).
export const obsoleteMarker = (repo, issue) =>
  `ticket-hygiene-obsolete:${sanitizeRepo(repo)}-issue-${issue}`;

// ── Issue-reference parsing ─────────────────────────────────────────────────

// STRICT: issue numbers a PR closes/fixes/resolves (same regex family as
// pr-housekeeping.mjs). Used by the obsolete pass, which needs precision —
// it auto-closes on this evidence.
export function closeLinkedIssues(text) {
  const out = new Set();
  const re = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\b[:\s]+#(\d+)/gi;
  let m;
  while ((m = re.exec(text ?? "")) !== null) out.add(Number(m[1]));
  return out;
}

// BROAD: any bare `#N` token at all. Used by the stale pass' "no open PR
// references it" guard, which wants recall — more matches means FEWER issues
// judged stale, so over-matching here fails safe.
export function referencedIssues(text) {
  const out = new Set();
  const re = /#(\d+)\b/g;
  let m;
  while ((m = re.exec(text ?? "")) !== null) out.add(Number(m[1]));
  return out;
}

// ── Housekeeping stuck-marker parsing ───────────────────────────────────────

/**
 * Detect a PR-housekeeping (toon-meta#276) or legacy triage-sweep remediation
 * marker in an issue body. These issues are keyed 1:1 to a stuck PR; the
 * hygiene sweep treats them specially in BOTH directions:
 *   - obsolete pass: close them once their target PR is closed/merged;
 *   - stale pass: never stale-close them while the PR is still open —
 *     housekeeping enforces exactly-one-open-remediation per stuck PR, so a
 *     stale close would just make it refile (and burn a retry-cap attempt).
 *
 * @returns {{ source: "pr-housekeeping"|"triage-sweep", repoToken: string,
 *             prNumber: number } | null}
 */
export function parseStuckMarker(body) {
  const m = /(pr-housekeeping|triage-sweep)-stuck:([A-Za-z0-9-]+?)-pr-(\d+)/.exec(
    body ?? "",
  );
  if (!m) return null;
  return { source: m[1], repoToken: m[2], prNumber: Number(m[3]) };
}

// ── Stale lifecycle ─────────────────────────────────────────────────────────

const DAY_MS = 86400000;

/**
 * Decide the stale-pass action for one open issue. Pure — the caller supplies
 * every observation.
 *
 * @param {{
 *   number: number,
 *   labels: string[],                 // label names
 *   updatedAt: string,                // ISO timestamp
 *   referencedByOpenPr: boolean,      // ANY open PR mentions #<number> (broad)
 *   hasStuckMarker?: boolean,         // housekeeping remediation issue
 *   staleMarkedAt?: string|null,      // ISO time of OUR stale marker comment
 *   commentsSinceMarked?: boolean,    // any comment newer than the marker
 * }} issue
 * @param {{
 *   now: number,                      // Date.now()
 *   staleDays: number,                // quiet threshold before marking
 *   graceDays: number,                // marked → close window
 *   activitySlackMinutes?: number,    // updatedAt jitter tolerated around the
 *                                     // marking itself (label+comment bump it)
 * }} ctx
 * @returns {{ action:
 *   "skip-protected"    // carries epic/tracking/needs:human — never touched
 * | "skip-housekeeping" // remediation issue — owned by the housekeeping loop
 * | "skip-referenced"   // an open PR references it — work is in flight
 * | "skip-active"       // activity within the quiet window
 * | "mark"              // apply `stale` label + warning comment
 * | "wait-grace"        // marked, grace not yet elapsed
 * | "close"             // marked, grace elapsed, zero activity → close
 * | "unstale"           // activity (or a PR) appeared after marking → un-mark
 * | "stale-unmanaged",  // label present but no marker comment: a human added
 *                       // it — no provenance, never auto-close
 *   reason: string }}
 */
export function evaluateStale(issue, ctx) {
  const { now, staleDays, graceDays, activitySlackMinutes = 60 } = ctx;
  const labels = new Set(issue.labels ?? []);

  for (const l of labels) {
    if (PROTECTED_LABELS.has(l)) {
      return { action: "skip-protected", reason: `carries protected label '${l}'` };
    }
  }
  if (issue.hasStuckMarker) {
    return {
      action: "skip-housekeeping",
      reason:
        "housekeeping remediation issue — its lifecycle is owned by the " +
        "stuck-PR loop (stale-closing it would only make housekeeping refile)",
    };
  }

  const updated = Date.parse(issue.updatedAt);

  if (labels.has(STALE_LABEL)) {
    if (issue.referencedByOpenPr) {
      return {
        action: "unstale",
        reason: "an open PR now references this issue — work is in flight",
      };
    }
    if (!issue.staleMarkedAt) {
      return {
        action: "stale-unmanaged",
        reason:
          `'${STALE_LABEL}' label present but no hygiene marker comment found — ` +
          "a human labeled it; without marking provenance it is never auto-closed",
      };
    }
    const marked = Date.parse(issue.staleMarkedAt);
    const activity =
      issue.commentsSinceMarked === true ||
      updated > marked + activitySlackMinutes * 60000;
    if (activity) {
      return { action: "unstale", reason: "activity since the stale marking" };
    }
    const graceElapsed = (now - marked) / DAY_MS;
    if (graceElapsed >= graceDays) {
      return {
        action: "close",
        reason:
          `marked stale ${Math.round(graceElapsed)}d ago; grace of ${graceDays}d ` +
          "elapsed with no activity",
      };
    }
    return {
      action: "wait-grace",
      reason: `in grace: ${Math.round(graceElapsed)}d of ${graceDays}d since marking`,
    };
  }

  if (issue.referencedByOpenPr) {
    return { action: "skip-referenced", reason: "an open PR references this issue" };
  }
  const quietDays = (now - updated) / DAY_MS;
  if (quietDays < staleDays) {
    return {
      action: "skip-active",
      reason: `active ${Math.round(quietDays)}d ago (< ${staleDays}d threshold)`,
    };
  }
  return {
    action: "mark",
    reason: `quiet for ${Math.round(quietDays)}d (≥ ${staleDays}d), no open PR references it`,
  };
}

// ── Obsolete case (a): merged PR whose close link did not fire ──────────────

/**
 * Find open issues referenced with a close keyword by a MERGED PR — the
 * `Closes #n` link that should have closed them did not fire. Known causes:
 * the keyword sits in the PR TITLE (GitHub only processes bodies), or the
 * work landed via another PR's branch (the fix-ticket runner gap).
 *
 * Only PRs merged into the repo's DEFAULT branch count as evidence — a PR
 * merged into some other branch has not actually landed the work.
 *
 * @param {{
 *   openIssues: Array<{ number: number, labels: string[], title?: string, url?: string }>,
 *   mergedPrs: Array<{ number: number, title: string, body: string,
 *                      baseRefName: string, mergedAt?: string, url?: string }>,
 *   defaultBranch: string,
 * }} args
 * @returns {{
 *   closable: Array<{ issue, prs: Array<{number, url, mergedAt}> }>,
 *   skippedProtected: Array<{ issue, prs, protectedLabel: string }>,
 * }}
 */
export function findObsoleteFromMergedPrs({ openIssues, mergedPrs, defaultBranch }) {
  const open = new Map(openIssues.map((i) => [i.number, i]));
  const byIssue = new Map();

  for (const pr of mergedPrs ?? []) {
    if (defaultBranch && pr.baseRefName !== defaultBranch) continue;
    for (const n of closeLinkedIssues(`${pr.title}\n${pr.body ?? ""}`)) {
      if (!open.has(n)) continue;
      if (!byIssue.has(n)) byIssue.set(n, []);
      byIssue.get(n).push({ number: pr.number, url: pr.url, mergedAt: pr.mergedAt });
    }
  }

  const closable = [];
  const skippedProtected = [];
  for (const [n, prs] of byIssue) {
    const issue = open.get(n);
    const prot = (issue.labels ?? []).find((l) => PROTECTED_LABELS.has(l));
    if (prot) skippedProtected.push({ issue, prs, protectedLabel: prot });
    else closable.push({ issue, prs });
  }
  return { closable, skippedProtected };
}

// ── Obsolete case (b): remediation issue whose target PR is done ────────────

/**
 * Verdict for an open housekeeping/triage remediation issue given its target
 * PR's observed state. Fail closed: an unfetchable or unrecognized PR state
 * is reported, never acted on.
 *
 * @param {{ marker: ReturnType<typeof parseStuckMarker>,
 *           pr: { state: string } | null }} args
 * @returns {{ action: "close-completed"|"close-not-planned"|"keep-open"|"report-only",
 *             reason: string }}
 */
export function evaluateRemediationObsolete({ marker, pr }) {
  if (!marker) return { action: "keep-open", reason: "no stuck marker in body" };
  const ref = `target PR #${marker.prNumber}`;
  if (!pr) {
    return {
      action: "report-only",
      reason: `${ref} could not be fetched — cannot verify, keeping open`,
    };
  }
  const state = String(pr.state ?? "").toUpperCase();
  if (state === "OPEN") {
    return { action: "keep-open", reason: `${ref} is still open — remediation still applies` };
  }
  if (state === "MERGED") {
    return {
      action: "close-completed",
      reason: `${ref} was MERGED — the stuck state this remediation tracked is resolved`,
    };
  }
  if (state === "CLOSED") {
    return {
      action: "close-not-planned",
      reason: `${ref} was CLOSED without merging — the stuck PR is gone, remediation is moot`,
    };
  }
  return {
    action: "report-only",
    reason: `${ref} has unrecognized state '${pr.state}' — failing closed, keeping open`,
  };
}

// ── Redundancy clustering (proposals ONLY — never automatic) ────────────────

// Words too common in this backlog to signal similarity on their own.
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "for", "of", "to", "in", "on", "with", "is",
  "are", "be", "as", "at", "by", "from", "that", "this", "it", "its", "into",
  "via", "not", "no", "when", "after", "add", "fix", "use",
]);

/** Normalize an issue title into a comparable token set. */
export function titleTokens(title) {
  return new Set(
    String(title ?? "")
      .toLowerCase()
      .split(/[^a-z0-9#]+/)
      .filter((t) => t.length > 1 && !STOPWORDS.has(t)),
  );
}

function jaccard(a, b) {
  if (a.size === 0 || b.size === 0) return { score: 0, shared: 0 };
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return { score: shared / (a.size + b.size - shared), shared };
}

/**
 * Cheap heuristic duplicate-candidate clustering over open issues of ONE
 * repo. Deliberately not an auto-closer and deliberately not an LLM: the
 * output is a PROPOSAL list for a human, so recall matters more than for an
 * auto-closer, but precision still gates (Jaccard over title tokens ≥
 * threshold AND a minimum count of shared informative tokens, so short
 * titles cannot cluster on a couple of words). Defaults were tuned against
 * the live fleet on 2026-08-05: 0.5/4-shared proposes the one plausible
 * duplicate pair while leaving deliberately-split ticket families (≤0.40)
 * unproposed.
 *
 * Housekeeping remediation issues are excluded up front: their titles are
 * near-identical BY CONSTRUCTION ("Stuck factory PR #N: …") while being
 * mechanically distinct per PR — every pair would be a false positive.
 *
 * @param {Array<{ number: number, title: string, body?: string, url?: string }>} issues
 * @param {{ threshold?: number, minShared?: number }} [opts]
 * @returns {Array<{ issues: Array, pairs: Array<{a:number,b:number,score:number}> }>}
 *   clusters (size ≥ 2), largest first.
 */
export function clusterRedundant(issues, opts = {}) {
  const { threshold = 0.5, minShared = 4 } = opts;
  const eligible = (issues ?? []).filter((i) => !parseStuckMarker(i.body));
  const toks = eligible.map((i) => titleTokens(i.title));

  // Union-find over above-threshold pairs.
  const parent = eligible.map((_, i) => i);
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const union = (x, y) => {
    parent[find(x)] = find(y);
  };

  const pairs = [];
  for (let i = 0; i < eligible.length; i++) {
    for (let j = i + 1; j < eligible.length; j++) {
      const { score, shared } = jaccard(toks[i], toks[j]);
      if (score >= threshold && shared >= minShared) {
        pairs.push({ i, j, score });
        union(i, j);
      }
    }
  }

  const groups = new Map();
  for (const { i, j, score } of pairs) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, { members: new Set(), pairs: [] });
    const g = groups.get(root);
    g.members.add(i);
    g.members.add(j);
    g.pairs.push({
      a: eligible[i].number,
      b: eligible[j].number,
      score: Math.round(score * 100) / 100,
    });
  }

  return [...groups.values()]
    .map((g) => ({
      issues: [...g.members].sort((x, y) => x - y).map((idx) => eligible[idx]),
      pairs: g.pairs,
    }))
    .sort((x, y) => y.issues.length - x.issues.length);
}
