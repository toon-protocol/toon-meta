// Dead-label reaper (`npm run reap:dead-labels`). toon-meta#330.
//
// Nothing else in the factory notices when an `agent:implement` run dies
// without opening a PR — the label stays forever, and the dispatcher's own
// serialization rule ("a child already carries agent:implement" counts an
// epic as busy — dispatch-evaluator.mjs) means the epic's slot is wedged
// behind a runner that stopped running. This is the thin gh I/O shell; ALL
// decision logic lives in the pure, unit-tested reap-evaluator.mjs (run
// correlation, outcome classification, the grace period, comment text).
//
// ── PER TICKET, PER PASS ─────────────────────────────────────────────────────
//   1. Skip if an open PR already maps to this ticket (in review, not dead).
//   2. Correlate the current labeling to its workflow run (reap-evaluator's
//      two-tier match: exact via `run-name`, else nearest-after in time).
//   3. Still running (or not correlated but too young) → leave alone.
//   4. Finished (or correlated-nothing past the grace period) → REMOVE
//      `agent:implement`, comment naming the run + outcome. Never re-applies
//      the label — that is a human judgement call (#330's "do not
//      auto-re-dispatch").
//
// ── WRITE FAILURE ISOLATION (toon-meta#320 convention) ───────────────────────
// Every write goes through write-report.mjs's `runWrite` so one failed `gh`
// call degrades to "this one ticket wasn't reaped" instead of aborting the
// whole fleet pass; the run still exits non-zero iff a write failed.
//
// ── IDEMPOTENCY ──────────────────────────────────────────────────────────────
// Reaping removes the label, which is self-idempotent (an already-reaped
// ticket no longer matches the `agent:implement` scan). The hidden marker is
// still checked before posting, belt-and-braces against a race between two
// overlapping passes acting on the same ticket.

import { execFileSync } from "node:child_process";
import { prIssueIds, FACTORY_BRANCH_PREFIXES, IMPLEMENT_LABEL } from "./dispatch-evaluator.mjs";
import {
  canonicalBranches,
  findRunForLabel,
  evaluateTicket,
  buildReapComment,
  reapMarker,
} from "./reap-evaluator.mjs";
import { createWriteReport, runWrite, hasFailures, formatFailedSection } from "./write-report.mjs";

// ── Config (env-overridable) ────────────────────────────────────────────────
const ORG = process.env.REAP_ORG ?? "toon-protocol";

// The full factory fleet (11 repos) — same set as the other fleet passes.
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

const REPOS = (process.env.REAP_REPOS
  ? process.env.REAP_REPOS.split(",").map((s) => s.trim()).filter(Boolean)
  : DEFAULT_REPOS
).map((r) => (r.includes("/") ? r : `${ORG}/${r}`));

const APPLY = process.env.APPLY === "true";
const ISSUE_LIMIT = Number(process.env.REAP_ISSUE_LIMIT ?? 100);
const PR_LIMIT = Number(process.env.REAP_PR_LIMIT ?? 200);
const RUN_LIMIT = Number(process.env.REAP_RUN_LIMIT ?? 100);
const NOW = new Date().toISOString();

// ── gh helpers ──────────────────────────────────────────────────────────────
function gh(args, { json = false, allowFail = false } = {}) {
  try {
    const out = execFileSync("gh", args, {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    });
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

function branchExistsOnRepo(repo, branch) {
  const data = gh(["api", `repos/${repo}/branches/${encodeURIComponent(branch)}`], {
    json: true,
    allowFail: true,
  });
  return data != null;
}

// A repo without agent-implement.yml (404) has no runs — that IS the truth,
// same convention as daily-digest.mjs's fetchRunCount.
function fetchRuns(repo) {
  const jq =
    ".workflow_runs[] | {status: .status, conclusion: .conclusion, createdAt: .created_at, " +
    "updatedAt: .updated_at, url: .html_url, displayTitle: .display_title}";
  const out = gh(
    [
      "api",
      `repos/${repo}/actions/workflows/agent-implement.yml/runs?event=issues&per_page=${RUN_LIMIT}`,
      "--jq",
      jq,
    ],
    { allowFail: true },
  );
  if (!out) return [];
  const rows = [];
  for (const line of out.split("\n")) {
    if (!line.trim()) continue;
    try {
      rows.push(JSON.parse(line));
    } catch {
      /* partial/unparseable line — skip, fail closed */
    }
  }
  return rows;
}

// The current labeling's start time: the MOST RECENT `labeled` timeline event
// for agent:implement. Correct even if the label was toggled off/on before —
// if it were removed after that event, the label would not currently be
// present (we only ever call this for issues that carry it right now).
function fetchLabeledAt(repo, number) {
  const jq = `.[] | select(.event=="labeled" and .label.name=="${IMPLEMENT_LABEL}") | .created_at`;
  const out = gh(
    ["api", `repos/${repo}/issues/${number}/timeline?per_page=100`, "--paginate", "--jq", jq],
    { allowFail: true },
  );
  if (!out) return null;
  const times = out.split("\n").map((s) => s.trim()).filter(Boolean);
  if (!times.length) return null;
  return times.sort().at(-1); // ISO 8601 UTC strings sort lexicographically
}

// ── Per-repo pass ────────────────────────────────────────────────────────────
const report = createWriteReport();
const counts = {};
const bump = (k) => (counts[k] = (counts[k] ?? 0) + 1);

function sweepRepo(repo) {
  const ticketed =
    gh(
      [
        "issue",
        "list",
        "--repo",
        repo,
        "--state",
        "open",
        "--label",
        IMPLEMENT_LABEL,
        "--limit",
        String(ISSUE_LIMIT),
        "--json",
        "number,title,url",
      ],
      { json: true, allowFail: true },
    ) ?? [];
  if (ticketed.length === 0) return;

  const prs =
    gh(
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
    ) ?? [];
  const agentPrIssueIds = new Set(
    prs
      .filter((p) => FACTORY_BRANCH_PREFIXES.some((pre) => (p.headRefName ?? "").startsWith(pre)))
      .flatMap((p) => prIssueIds({ ...p, repo })),
  );

  const runs = fetchRuns(repo);
  console.log(
    `\n━━ ${repo} — ${ticketed.length} ticket(s) carrying ${IMPLEMENT_LABEL}, ` +
      `${runs.length} agent-implement run(s) fetched`,
  );

  for (const issue of ticketed) {
    const id = `${repo.toLowerCase()}#${issue.number}`;
    const labeledAt = fetchLabeledAt(repo, issue.number);
    if (!labeledAt) {
      console.log(
        `   ${id} — could not find the 'labeled' timeline event for ${IMPLEMENT_LABEL}; ` +
          `cannot judge age — skipping (fail closed)`,
      );
      bump("unjudgeable");
      continue;
    }

    const hasOpenPr = agentPrIssueIds.has(id);
    let comments = null;
    const getComments = () => (comments ??= fetchComments(repo, issue.number));

    let branchClaimed = false;
    let branchExists = false;
    if (!hasOpenPr) {
      const peek = findRunForLabel({ runs, issueNumber: issue.number, labeledAt });
      if (peek && peek.status === "completed" && peek.conclusion !== "success") {
        const text = getComments()
          .map((c) => c.body ?? "")
          .join("\n");
        branchClaimed = canonicalBranches(issue.number).some((b) => text.includes(b));
        if (branchClaimed) {
          branchExists = canonicalBranches(issue.number).some((b) => branchExistsOnRepo(repo, b));
        }
      }
    }

    const verdict = evaluateTicket({
      issue: { repo, number: issue.number, title: issue.title, url: issue.url },
      runs,
      hasOpenPr,
      labeledAt,
      now: NOW,
      branchClaimed,
      branchExists,
    });

    for (const r of verdict.reasons) console.log(`   ${id} — ${r}`);

    if (verdict.verdict !== "reap") {
      bump(verdict.verdict);
      continue;
    }

    const marker = reapMarker(repo, issue.number);
    if (getComments().some((c) => (c.body ?? "").includes(marker))) {
      console.log(`   ${id} — already reaped (marker found) — skipping`);
      bump("reap-already");
      continue;
    }

    const comment = buildReapComment({
      issue: { number: issue.number },
      outcome: verdict.outcome,
      run: verdict.run,
      marker,
    });
    const tag = APPLY ? "APPLY" : "dry-run";
    console.log(`   [${tag}] ${id} — REAP (${verdict.outcome}): remove ${IMPLEMENT_LABEL} + comment`);
    if (APPLY) {
      const ok = runWrite(report, { type: "reap", target: id, detail: verdict.outcome }, () => {
        gh(["issue", "edit", String(issue.number), "--repo", repo, "--remove-label", IMPLEMENT_LABEL]);
        gh(["issue", "comment", String(issue.number), "--repo", repo, "--body", comment]);
      });
      if (!ok) console.log(`   [APPLY] FAILED to reap ${id} — continuing (see failed writes below)`);
    }
    bump("reap");
    bump(`reap-${verdict.outcome}`);
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
console.log(
  `Dead-label reaper — mode=${APPLY ? "APPLY (writing)" : "DRY-RUN (no writes)"}, ` +
    `repos=${REPOS.length} [${REPOS.map((r) => r.split("/")[1]).join(", ")}], now=${NOW}`,
);
if (!process.env.FACTORY_OPS_TOKEN_PRESENT && APPLY) {
  console.log(
    "::warning::FACTORY_OPS_TOKEN not detected — falling back to the ambient token. Removing a " +
      "label and commenting need only write access, not the guarded add-label path, so nothing " +
      "here is silently ignored for coming from the wrong identity — but the ambient token is " +
      "scoped to one repo and carries contents:read only, so reaps will FAIL loudly (see " +
      "\"Failed writes\") rather than apply.",
  );
}

for (const repo of REPOS) {
  try {
    sweepRepo(repo);
  } catch (err) {
    console.error(`::error::reap pass failed for ${repo}: ${err.message}`);
  }
}

// ── Summary ─────────────────────────────────────────────────────────────────
const n = (k) => counts[k] ?? 0;
console.log(
  `\nReap pass complete (${APPLY ? "APPLIED" : "dry-run"}): ` +
    `${n("reap")} dead label(s) reaped ` +
    `(${n("reap-timed-out")} timed-out, ${n("reap-failed")} failed, ` +
    `${n("reap-succeeded-with-no-changes")} succeeded-with-no-changes, ` +
    `${n("reap-pushed-nothing")} pushed-nothing, ${n("reap-cancelled")} cancelled, ` +
    `${n("reap-no-run-found")} no-run-found), ` +
    `${n("reap-already")} already reaped, ` +
    `${n("in-progress")} in progress, ${n("too-recent")} too recent to judge, ` +
    `${n("open-pr")} with an open PR, ${n("unjudgeable")} unjudgeable (no labeled-event found).`,
);

if (hasFailures(report)) {
  console.log(`\n${formatFailedSection(report)}`);
}
const exitCode = hasFailures(report) ? 1 : 0;
if (exitCode) {
  console.log(
    `\nExiting ${exitCode}: ${report.failed.length} write(s) failed this pass ` +
      `(${report.succeeded.length} succeeded) — see "Failed writes" above.`,
  );
}
process.exit(exitCode);
