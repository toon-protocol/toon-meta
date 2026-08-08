// Daily digest (`npm run digest:daily`). toon-meta#286, epic #270.
//
// Make an AFK day legible: one comment a day covering what the factory
// dispatched, merged, filed, escalated, what quietly stalled, and what it all
// cost in agent runs. This file is the thin I/O shell — gh reads, one gh write
// (APPLY only), and the run-log report. ALL decision and formatting logic lives
// in the pure, unit-tested scripts/factory/digest-evaluator.mjs.
//
// ── WHERE IT POSTS: A STANDING ISSUE, ONE COMMENT PER DAY ────────────────────
// The ticket allows either a standing tracking issue or a fresh dated issue.
// This is the standing issue, and the reasons are mechanical, not aesthetic:
//   * The fleet's issue list IS the work queue. 365 digest issues a year would
//     pollute it for every component that scans issues — ticket-hygiene's
//     redundancy clustering (near-identical titles by construction), the
//     dispatcher's epic/child scans, and any human triage view.
//   * One URL to subscribe to / pin. On a phone a single thread is scrollable
//     history; a new issue per day is a new notification thread per day, which
//     is exactly how a digest stops being read.
//   * Dedupe needs memory. Escalations must appear EXACTLY once (#286
//     acceptance criterion), and the cheapest durable memory is the previous
//     digests themselves: the shell reads back the last DIGEST_HISTORY digest
//     comments from the standing issue and feeds their escalation keys to the
//     evaluator, which suppresses anything already reported. With dated issues
//     that history is a search, not a read.
//   * Re-running the same day must not double-post: the comment carries the
//     hidden marker `factory-digest:<UTC day>` and is UPSERTED on it (same
//     hidden-marker convention as pr-housekeeping's stuck markers and the
//     hygiene report issue).
// The standing issue must be labeled `tracking` so the dispatcher and hygiene
// never touch it (`tracking` is in dispatch-evaluator's EXCLUDED_LABELS and
// hygiene-evaluator's PROTECTED_LABELS). Its ref is configuration, not code:
// org/repo variable DIGEST_ISSUE = `owner/repo#N`. Without it the run is a
// report-only run, whatever APPLY says — the digest never invents an issue.
//
// ── EVENTS, NOT STATE ───────────────────────────────────────────────────────
// Every section reports transitions inside the window (see the evaluator
// header). The primary source is each repo's issue-event feed
// (`/repos/{repo}/issues/events`, which covers issues AND pull requests):
// `labeled agent:implement` = a dispatch, `labeled needs:human` = an
// escalation, `labeled/unlabeled stale` + not-planned closes = hygiene, plain
// closes = the join key for "what did this merge close" and "what did this
// dispatch release". Merges come from the PR list and are reported regardless
// of WHO merged them — auto-merge (#285), the orchestrator, or a human — so
// this works before and after #285 lands.
//
// ── WRITES ──────────────────────────────────────────────────────────────────
// Exactly one, and only when APPLY (org var DIGEST_APPLY / a manual apply=true)
// AND DIGEST_ISSUE is set: create-or-update today's comment on the standing
// issue. Dry-run prints the identical rendered digest to the run log (and the
// job summary). Nothing else is ever written — the digest observes, it never
// labels, closes or comments on the work it reports.

import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";

import {
  planDispatch,
  prIssueIds,
  collectBlockerIds,
  parseEpicRefs,
  FACTORY_BRANCH_PREFIXES,
} from "./dispatch-evaluator.mjs";
import {
  buildDigest,
  renderDigest,
  digestMarker,
  parseReportedEscalationKeys,
  extractEscalationReason,
  classifyHygieneClose,
  utcDay,
  HUMAN_LABEL,
} from "./digest-evaluator.mjs";

// ── Config (env-overridable) ────────────────────────────────────────────────
const ORG = process.env.DIGEST_ORG ?? "toon-protocol";

// The full factory fleet (11 repos) — same set as unblock-dispatcher.mjs /
// pr-housekeeping.mjs / ticket-hygiene.mjs.
const DEFAULT_REPOS = [
  "relay",
  "toon-client",
  "rig",
  "store",
  "connector",
  "toon",
  "swap",
  "toon-meta",
  "Forge",
  "fractal",
  "buzz",
];

const REPOS = (
  process.env.DIGEST_REPOS
    ? process.env.DIGEST_REPOS.split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : DEFAULT_REPOS
).map((r) => (r.includes("/") ? r : `${ORG}/${r}`));

const APPLY = process.env.APPLY === "true";
const WINDOW_HOURS = Number(process.env.DIGEST_WINDOW_HOURS ?? 24);
// `owner/repo#N` of the standing tracking issue. Blank ⇒ report-only.
const DIGEST_ISSUE = (process.env.DIGEST_ISSUE ?? "").trim();
// How many previous digest comments to read back for escalation dedupe. 7 days
// of memory absorbs a missed run, a late cron and an outage backfill.
const HISTORY = Number(process.env.DIGEST_HISTORY ?? 7);
const MAX_ROWS = Number(process.env.DIGEST_MAX_ROWS ?? 12);
const ISSUE_LIMIT = Number(process.env.DIGEST_ISSUE_LIMIT ?? 300);
const PR_LIMIT = Number(process.env.DIGEST_PR_LIMIT ?? 200);
const EVENT_PAGES = Number(process.env.DIGEST_EVENT_PAGES ?? 6); // ×100 events/repo
const NOTES = (process.env.DIGEST_NOTES ?? "")
  .split("\n")
  .map((s) => s.trim())
  .filter(Boolean);

const AGENT_WORKFLOWS = { implement: "agent-implement.yml", review: "agent-review.yml" };

const NOW = process.env.DIGEST_NOW ? Date.parse(process.env.DIGEST_NOW) : Date.now();
const SINCE = new Date(NOW - WINDOW_HOURS * 3600_000).toISOString().replace(/\.\d+Z$/, "Z");

// ── gh helpers ──────────────────────────────────────────────────────────────
function gh(args, { json = false, allowFail = false } = {}) {
  try {
    const out = execFileSync("gh", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
    return json ? JSON.parse(out || "null") : out;
  } catch (err) {
    if (allowFail) return json ? null : "";
    throw err;
  }
}

const fetchComments = (repo, number) =>
  gh(["issue", "view", String(number), "--repo", repo, "--json", "comments"], {
    json: true,
    allowFail: true,
  })?.comments ?? [];

// PR comments live on the same issue-comments endpoint; `gh pr view` is the
// symmetric read for a PR number.
const fetchPrComments = (repo, number) =>
  gh(["pr", "view", String(number), "--repo", repo, "--json", "comments"], {
    json: true,
    allowFail: true,
  })?.comments ?? [];

// ── Reads ───────────────────────────────────────────────────────────────────

// Honest-partial-data notes, surfaced in the digest body itself.
const TRUNCATION_NOTES = [];

// Repo issue-event feed, newest first, paged until we fall out of the window.
// Covers issues AND pull requests, which is why PR escalations show up too.
function fetchEvents(repo) {
  const out = [];
  let truncated = false;
  for (let page = 1; page <= EVENT_PAGES; page++) {
    const rows = gh(["api", `repos/${repo}/issues/events?per_page=100&page=${page}`], {
      json: true,
      allowFail: true,
    });
    if (!Array.isArray(rows) || rows.length === 0) break;
    let ranOut = false;
    for (const r of rows) {
      if (Date.parse(r.created_at) <= Date.parse(SINCE)) {
        ranOut = true;
        continue;
      }
      out.push({
        repo,
        event: r.event,
        createdAt: r.created_at,
        label: r.label?.name ?? null,
        actor: r.actor?.login ?? "",
        issue: {
          number: r.issue?.number,
          title: r.issue?.title,
          url: r.issue?.html_url,
          isPr: Boolean(r.issue?.pull_request),
          stateReason: r.issue?.state_reason ?? null,
          body: r.issue?.body ?? "",
        },
      });
    }
    if (ranOut || rows.length < 100) break;
    // Still inside the window with pages left to read, but the budget is spent:
    // say so rather than silently reporting a partial day.
    truncated = page === EVENT_PAGES;
  }
  if (truncated) {
    const note =
      `event feed for ${repo} truncated at ${EVENT_PAGES * 100} events — ` +
      `the window is only partially covered (raise DIGEST_EVENT_PAGES)`;
    console.log(`::warning::${note}`);
    TRUNCATION_NOTES.push(note);
  }
  return out;
}

// Every PR merged in the window — NOT just `sandcastle/*`/`agent/*` branches.
// Factory PRs routinely land on ticket-named branches (`epic270/286-…`), so the
// dispatcher's branch-prefix filter would under-report a day's merges to almost
// nothing. The evaluator tags agent-branch PRs rather than dropping the rest.
function fetchMergedPrs(repo) {
  const rows =
    gh(
      [
        "pr",
        "list",
        "--repo",
        repo,
        "--state",
        "merged",
        "--search",
        `merged:>=${SINCE}`,
        "--limit",
        String(PR_LIMIT),
        "--json",
        "number,title,url,mergedAt,headRefName,body,author,mergedBy",
      ],
      { json: true, allowFail: true },
    ) ?? [];
  return rows.map((p) => ({
    ...p,
    repo,
    author: p.author?.login ?? "",
    mergedBy: p.mergedBy?.login ?? "",
  }));
}

const fetchOpenedIssues = (repo) =>
  (
    gh(
      [
        "issue",
        "list",
        "--repo",
        repo,
        "--state",
        "all",
        "--search",
        `created:>=${SINCE}`,
        "--limit",
        "100",
        "--json",
        "number,title,url,createdAt,body",
      ],
      { json: true, allowFail: true },
    ) ?? []
  ).map((i) => ({ ...i, repo }));

// Agent-run counts. A repo without the workflow file 404s → 0, which is the
// truth for that repo (no runner installed there).
function fetchRunCount(repo, workflowFile) {
  const data = gh(
    [
      "api",
      `repos/${repo}/actions/workflows/${workflowFile}/runs?created=%3E%3D${SINCE}&per_page=1`,
    ],
    { json: true, allowFail: true },
  );
  return Number(data?.total_count ?? 0);
}

// REST read of one issue (state + state_reason + body) — same helper (and same
// fail-closed semantics) as unblock-dispatcher.mjs.
function fetchIssueRest(id) {
  const [repo, number] = id.split("#");
  const data = gh(["api", `repos/${repo}/issues/${number}`], { json: true, allowFail: true });
  if (!data || data.pull_request) return null;
  return { state: data.state, stateReason: data.state_reason ?? undefined, body: data.body ?? "" };
}

// ── Main ────────────────────────────────────────────────────────────────────
console.log(
  `Daily digest — mode=${APPLY ? "APPLY (will post)" : "DRY-RUN (no writes)"}, ` +
    `window=${WINDOW_HOURS}h since ${SINCE}, ` +
    `repos=${REPOS.length} [${REPOS.map((r) => r.split("/")[1]).join(", ")}], ` +
    `standing issue=${DIGEST_ISSUE || "(unset — report only)"}`,
);

const events = [];
const mergedPrs = [];
const openedIssues = [];
const runs = {};
const openIssues = [];
const agentPrs = [];

for (const repo of REPOS) {
  events.push(...fetchEvents(repo));
  mergedPrs.push(...fetchMergedPrs(repo));
  openedIssues.push(...fetchOpenedIssues(repo));
  runs[repo] = {
    implement: fetchRunCount(repo, AGENT_WORKFLOWS.implement),
    review: fetchRunCount(repo, AGENT_WORKFLOWS.review),
  };
  // Fleet state for the stalled-epic pass (identical reads to the dispatcher).
  for (const i of gh(
    [
      "issue",
      "list",
      "--repo",
      repo,
      "--state",
      "open",
      "--limit",
      String(ISSUE_LIMIT),
      "--json",
      "number,title,labels,body,url",
    ],
    { json: true, allowFail: true },
  ) ?? []) {
    openIssues.push({ ...i, repo, labels: (i.labels ?? []).map((l) => l.name) });
  }
  for (const p of gh(
    [
      "pr",
      "list",
      "--repo",
      repo,
      "--state",
      "open",
      "--limit",
      String(PR_LIMIT),
      "--json",
      "number,title,headRefName,body,url",
    ],
    { json: true, allowFail: true },
  ) ?? []) {
    if (FACTORY_BRANCH_PREFIXES.some((pre) => (p.headRefName ?? "").startsWith(pre))) {
      agentPrs.push({ ...p, repo });
    }
  }
}
console.log(
  `Fleet scan: ${events.length} in-window event(s), ${mergedPrs.length} merged PR(s), ` +
    `${openedIssues.length} new issue(s), ${openIssues.length} open issue(s), ` +
    `${agentPrs.length} open agent PR(s).`,
);

// ── Stalled epics: reuse the dispatcher's own plan, unmodified ──────────────
// Same inputs the dispatcher builds, so "stalled" here means exactly what it
// means there — no second definition of stalled to drift.
const openIds = new Set(openIssues.map((i) => `${i.repo.toLowerCase()}#${i.number}`));
const prLinkedBodies = {};
for (const pr of agentPrs) {
  for (const id of prIssueIds(pr)) {
    if (openIds.has(id) || id in prLinkedBodies) continue;
    const iss = fetchIssueRest(id);
    if (iss) prLinkedBodies[id] = { body: iss.body };
  }
}
const blockerStates = {};
for (const id of collectBlockerIds(openIssues.filter((i) => parseEpicRefs(i.body, i.repo).length))) {
  if (openIds.has(id)) continue;
  const iss = fetchIssueRest(id);
  if (iss) blockerStates[id] = { state: iss.state, stateReason: iss.stateReason };
}
const plan = planDispatch({ openIssues, agentPrs, prLinkedBodies, blockerStates, fleetRepos: REPOS });

// Forensics: the whole epic ledger, not just the stalled slice the digest
// renders — so a "why is this epic NOT listed" question is answerable from the
// same run log.
console.log(`Epic scan: ${plan.epics.length} open epic(s)`);
for (const e of plan.epics) {
  // "would dispatch", never "dispatching": this is a read-only replay of the
  // dispatcher's plan — the digest itself never labels anything.
  const state = e.stalled
    ? "STALLED"
    : e.dispatched
      ? `ready — the dispatcher would pick ${e.dispatched}`
      : e.busyWith.length
        ? `busy (${e.busyWith[0]})`
        : "ready work available";
  console.log(`   ${e.id} — ${e.openChildren} open child(ren) — ${state}`);
}

// ── Escalation reasons: comments, only for the items escalated in-window ────
const escalationReasons = {};
for (const e of events) {
  if (e.event !== "labeled" || e.label !== HUMAN_LABEL) continue;
  const id = `${e.repo.toLowerCase()}#${e.issue.number}`;
  if (id in escalationReasons) continue;
  const comments = e.issue.isPr
    ? fetchPrComments(e.repo, e.issue.number)
    : fetchComments(e.repo, e.issue.number);
  escalationReasons[id] = extractEscalationReason(comments);
}

// ── Close provenance: was a not-planned close hygiene's, or a human's? ──────
// Only not-planned closes need this (a handful a day), and only their comments
// can answer it — the actor cannot, because FACTORY_OPS_TOKEN may resolve to a
// login a human also uses.
const closeProvenance = {};
for (const e of events) {
  if (e.event !== "closed" || e.issue.isPr || (e.issue.stateReason ?? "") !== "not_planned") continue;
  const id = `${e.repo.toLowerCase()}#${e.issue.number}`;
  if (id in closeProvenance) continue;
  closeProvenance[id] = classifyHygieneClose(fetchComments(e.repo, e.issue.number));
}

// ── Dispatched tickets' bodies: for the `## Blocked by` attribution ─────────
const dispatchedBodies = {};
for (const e of events) {
  if (e.event !== "labeled" || e.label !== "agent:implement" || e.issue.isPr) continue;
  const id = `${e.repo.toLowerCase()}#${e.issue.number}`;
  if (id in dispatchedBodies) continue;
  dispatchedBodies[id] = e.issue.body || fetchIssueRest(id)?.body || "";
}

// ── Previously reported escalation keys (dedupe layer 2) ────────────────────
let reportedEscalationKeys = [];
let priorComments = [];
if (DIGEST_ISSUE) {
  const [repo, number] = DIGEST_ISSUE.split("#");
  priorComments =
    gh(["api", `repos/${repo}/issues/${number}/comments?per_page=100`], {
      json: true,
      allowFail: true,
    }) ?? [];
  const digests = priorComments
    .filter((c) => (c.body ?? "").includes("factory-digest:"))
    .slice(-HISTORY);
  reportedEscalationKeys = parseReportedEscalationKeys(digests);
  console.log(
    `Standing issue ${DIGEST_ISSUE}: ${digests.length} prior digest comment(s) read, ` +
      `${reportedEscalationKeys.length} escalation key(s) already reported.`,
  );
} else {
  console.log(
    "::notice::DIGEST_ISSUE is unset — no standing issue to post to, and no " +
      "cross-day escalation dedupe. Create a `tracking`-labeled issue and set " +
      "the org variable DIGEST_ISSUE=owner/repo#N.",
  );
}

// ── Build + render ──────────────────────────────────────────────────────────
const digest = buildDigest({
  now: NOW,
  windowHours: WINDOW_HOURS,
  repos: REPOS,
  events,
  mergedPrs,
  openedIssues,
  dispatchedBodies,
  escalationReasons,
  plan,
  runs,
  reportedEscalationKeys,
  closeProvenance,
  notes: [...NOTES, ...TRUNCATION_NOTES],
});
const body = renderDigest(digest, { maxRows: MAX_ROWS });

console.log(`\n${"─".repeat(72)}`);
console.log(body);
console.log(`${"─".repeat(72)}\n`);
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${body}\n`);
}

// ── The single write ────────────────────────────────────────────────────────
const marker = digestMarker(digest.day);
if (!APPLY) {
  console.log(
    `[dry-run] would ${
      priorComments.some((c) => (c.body ?? "").includes(marker)) ? "UPDATE" : "POST"
    } today's digest comment on ${DIGEST_ISSUE || "(no standing issue configured)"}` +
      ` (marker ${marker}).`,
  );
} else if (!DIGEST_ISSUE) {
  console.log(
    "::warning::APPLY is set but DIGEST_ISSUE is not — nothing posted. The " +
      "digest never creates its own tracking issue; an admin sets the variable.",
  );
} else {
  const [repo, number] = DIGEST_ISSUE.split("#");
  const existing = priorComments.find((c) => (c.body ?? "").includes(marker));
  if (existing) {
    // Upsert: a second run on the same UTC day edits its own comment.
    gh([
      "api",
      "--method",
      "PATCH",
      `repos/${repo}/issues/comments/${existing.id}`,
      "-f",
      `body=${body}`,
    ]);
    console.log(`[APPLY] updated today's digest comment ${existing.html_url}`);
  } else {
    const out = gh(["issue", "comment", String(number), "--repo", repo, "--body", body]);
    console.log(`[APPLY] posted today's digest comment ${String(out).trim()}`);
  }
}

const c = digest.counts;
console.log(
  `Digest complete (${APPLY ? "APPLIED" : "dry-run"}): ${c.dispatched} dispatched, ` +
    `${c.merged} merged (${c.issuesClosedByMerges} issue(s) closed), ${c.filed} filed, ` +
    `${c.escalated} escalated (${digest.suppressedEscalations.length} suppressed as ` +
    `already-reported), ${c.stalled}/${digest.epicsSeen} epic(s) stalled, ${c.runs} agent run(s).`,
);
console.log(`Digest day (UTC): ${utcDay(NOW)}; window start ${SINCE}.`);
process.exit(0);
