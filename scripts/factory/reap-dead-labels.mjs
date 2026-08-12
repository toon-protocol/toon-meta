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
//      two-tier match: exact via `run-name`, else nearest-after in time;
//      DECOY runs — skipped whole because some other label minted them — are
//      never a correlation, so "only decoys visible" reads as no-run-found
//      rather than as a failure that never happened).
//   3. Still running (or not correlated but too young) → leave alone.
//   4. Finished (or correlated-nothing past the grace period) → apply the
//      PAIRING (see below), THEN remove `agent:implement`, THEN comment.
//      Never re-applies the label — that is a human judgement call (#330's
//      "do not auto-re-dispatch").
//
// ── NEVER REAP BARE (toon-meta#330 comment, 2026-08-10) ──────────────────────
// Removing `agent:implement` alone does not free the epic's slot — it makes
// the dispatcher re-label the ticket on its very next pass (26s, observed
// live on buzz#90), spinning reap → dispatch → die → reap forever. Every reap
// therefore pairs the removal with something dispatch-evaluator.mjs's own
// readiness rule declines: `needs:human` / `tracking` labels, or a new
// `## Blocked by` bullet (reap-evaluator.mjs's `choosePairing` — see its
// header for the full decision table). The pairing write happens BEFORE the
// label removal in the write closure below, specifically so that if the
// pairing write fails, `agent:implement` is untouched (safe — retried next
// pass) rather than removed-and-unpaired (the exact bare-reap bug this
// exists to prevent).
//
// ── WRITE FAILURE ISOLATION (toon-meta#320 convention) ───────────────────────
// Every write goes through write-report.mjs's `runWrite` so one failed `gh`
// call degrades to "this one ticket wasn't reaped" instead of aborting the
// whole fleet pass; the run still exits non-zero iff a write failed.
//
// ── IDEMPOTENCY ──────────────────────────────────────────────────────────────
// Reaping removes the label, which is self-idempotent (an already-reaped
// ticket no longer matches the `agent:implement` scan). The hidden marker is
// keyed on THIS labeling cycle (reapMarker's `labeledAt` argument) — a
// per-issue-only marker would make every future death of the same ticket
// look already-reaped forever, per reap-evaluator.mjs's header.

import { execFileSync } from "node:child_process";
import {
  prIssueIds,
  FACTORY_BRANCH_PREFIXES,
  IMPLEMENT_LABEL,
  HUMAN_LABEL,
  TRACKING_LABEL,
} from "./dispatch-evaluator.mjs";
import {
  canonicalBranches,
  findRunForLabel,
  evaluateTicket,
  appendBlockerRef,
  buildReapComment,
  reapMarker,
  reapMarkerPrefix,
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
// Fetched in 100-run pages (see fetchRuns) — most of an active repo's
// `issues`-triggered runs are decoys, so one page is rarely enough history.
const RUN_LIMIT = Number(process.env.REAP_RUN_LIMIT ?? 300);
const NOW = new Date().toISOString();

// ── gh helpers ──────────────────────────────────────────────────────────────
function gh(args, { json = false, allowFail = false, input } = {}) {
  try {
    const out = execFileSync("gh", args, {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
      ...(input !== undefined ? { input } : {}),
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

// NOT allowFail: a swallowed failure here would return "" indistinguishable
// from a genuinely empty body, and appendBlockerRef("", ref, repo) would
// then produce a body that's JUST the new `## Blocked by` section — writing
// that back would silently truncate the real issue body. Letting this throw
// inside the write closure (below) instead fails the whole write, which
// runWrite records and skips — same as any other failed pairing write.
const fetchBody = (repo, number) =>
  gh(["issue", "view", String(number), "--repo", repo, "--json", "body", "--jq", ".body"]);

function branchExistsOnRepo(repo, branch) {
  const data = gh(["api", `repos/${repo}/branches/${encodeURIComponent(branch)}`], {
    json: true,
    allowFail: true,
  });
  return data != null;
}

// A repo without agent-implement.yml (404) has no runs — that IS the truth,
// same convention as daily-digest.mjs's fetchRunCount.
//
// Paged deliberately: ~74% of the `issues`-triggered runs on an active repo are
// DECOYS (runs minted by a non-`agent:implement` label, skipped whole — see
// reap-evaluator.mjs's `isDecoyRun`), so a single 100-run page can be almost
// entirely noise and age a still-relevant real run out of view. The evaluator
// degrades safely when that happens (it reports `no-run-found` rather than
// guessing), but the comment is far more useful when the real run is in hand,
// and pages are cheap — fetched once per repo, only when that repo actually has
// ticketed issues.
function fetchRuns(repo) {
  const jq =
    ".workflow_runs[] | {id: .id, status: .status, conclusion: .conclusion, " +
    "createdAt: .created_at, updatedAt: .updated_at, url: .html_url, displayTitle: .display_title}";
  const rows = [];
  const perPage = Math.min(RUN_LIMIT, 100);
  const pages = Math.max(1, Math.ceil(RUN_LIMIT / perPage));
  for (let page = 1; page <= pages; page++) {
    const out = gh(
      [
        "api",
        `repos/${repo}/actions/workflows/agent-implement.yml/runs` +
          `?event=issues&per_page=${perPage}&page=${page}`,
        "--jq",
        jq,
      ],
      { allowFail: true },
    );
    if (!out) break; // 404 (no such workflow) or an empty page — nothing further to read
    let added = 0;
    for (const line of out.split("\n")) {
      if (!line.trim()) continue;
      try {
        rows.push(JSON.parse(line));
        added++;
      } catch {
        /* partial/unparseable line — skip, fail closed */
      }
    }
    if (added < perPage) break; // short page — end of history
  }
  return rows;
}

// Guard-skip detection (buzz#6 shape): a run can conclude `success` while its
// `implement` job specifically was `skipped` — one of agent-implement.yml's
// guard checks refused the target (e.g. a PRD-shaped parent) before any work
// began. Verified live on buzz run 31330244708 (the buzz#6 refusal):
// run conclusion=success, `guard`=success, `implement`=skipped. Note this is
// NOT the same thing as a run whose conclusion is `skipped` — that means the
// guard job itself never ran, i.e. a decoy (reap-evaluator's `isDecoyRun`),
// which never reaches here. Only ever called for a correlated, finished,
// `success` run — a failed/timed-out run never reaches this (branch-claim
// checking covers it instead), so one extra `gh api` call per candidate is
// the whole cost.
function isImplementJobSkipped(repo, run) {
  if (!run?.id) return false;
  const jq = ".jobs[] | {name: .name, conclusion: .conclusion}";
  const out = gh(["api", `repos/${repo}/actions/runs/${run.id}/jobs`, "--jq", jq], {
    allowFail: true,
  });
  if (!out) return false;
  for (const line of out.split("\n")) {
    if (!line.trim()) continue;
    try {
      const job = JSON.parse(line);
      if ((job.name ?? "").toLowerCase() === "implement") return job.conclusion === "skipped";
    } catch {
      /* partial/unparseable line — skip, fail closed */
    }
  }
  return false;
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
    let implementJobSkipped = false;
    if (!hasOpenPr) {
      const peek = findRunForLabel({ runs, issueNumber: issue.number, labeledAt });
      if (peek && peek.status === "completed") {
        if (peek.conclusion !== "success") {
          const text = getComments()
            .map((c) => c.body ?? "")
            .join("\n");
          branchClaimed = canonicalBranches(issue.number).some((b) => text.includes(b));
          if (branchClaimed) {
            branchExists = canonicalBranches(issue.number).some((b) => branchExistsOnRepo(repo, b));
          }
        } else {
          implementJobSkipped = isImplementJobSkipped(repo, peek);
        }
      }
    }

    const priorReapTimestamps = getComments()
      .filter((c) => (c.body ?? "").includes(reapMarkerPrefix(repo, issue.number)))
      .map((c) => c.createdAt)
      .filter(Boolean);

    const verdict = evaluateTicket({
      issue: { repo, number: issue.number, title: issue.title, url: issue.url },
      runs,
      hasOpenPr,
      labeledAt,
      now: NOW,
      branchClaimed,
      branchExists,
      implementJobSkipped,
      priorReapTimestamps,
    });

    for (const r of verdict.reasons) console.log(`   ${id} — ${r}`);

    if (verdict.verdict !== "reap") {
      bump(verdict.verdict);
      continue;
    }

    const marker = reapMarker(repo, issue.number, labeledAt);
    if (getComments().some((c) => (c.body ?? "").includes(marker))) {
      console.log(`   ${id} — already reaped this cycle (marker found) — skipping`);
      bump("reap-already");
      continue;
    }

    const comment = buildReapComment({
      issue: { number: issue.number },
      outcome: verdict.outcome,
      run: verdict.run,
      marker,
      pairing: verdict.pairing,
      repeated: verdict.repeated,
    });
    const tag = APPLY ? "APPLY" : "dry-run";
    console.log(
      `   [${tag}] ${id} — REAP (${verdict.outcome} → ${verdict.pairing.kind}` +
        `${verdict.repeated ? ", repeat-death" : ""}): pair, then remove ${IMPLEMENT_LABEL} + comment`,
    );
    if (APPLY) {
      // Pairing FIRST — see header. If this write fails, agent:implement is
      // left untouched (safe, retried next pass) rather than removed with no
      // pairing applied (a bare reap, the exact bug #330's follow-up flagged).
      const ok = runWrite(
        report,
        { type: "reap", target: id, detail: `${verdict.outcome}/${verdict.pairing.kind}` },
        () => {
          if (verdict.pairing.kind === "needs-human") {
            gh(["issue", "edit", String(issue.number), "--repo", repo, "--add-label", HUMAN_LABEL]);
          } else if (verdict.pairing.kind === "tracking") {
            gh(["issue", "edit", String(issue.number), "--repo", repo, "--add-label", TRACKING_LABEL]);
          } else if (verdict.pairing.kind === "blocker") {
            const body = fetchBody(repo, issue.number);
            const newBody = appendBlockerRef(body, verdict.pairing.ref, repo);
            if (newBody !== body) {
              gh(["issue", "edit", String(issue.number), "--repo", repo, "--body-file", "-"], {
                input: newBody,
              });
            }
          }
          gh(["issue", "edit", String(issue.number), "--repo", repo, "--remove-label", IMPLEMENT_LABEL]);
          gh(["issue", "comment", String(issue.number), "--repo", repo, "--body", comment]);
        },
      );
      if (!ok) console.log(`   [APPLY] FAILED to reap ${id} — continuing (see failed writes below)`);
    }
    bump("reap");
    bump(`reap-${verdict.outcome}`);
    bump(`pairing-${verdict.pairing.kind}`);
    if (verdict.repeated) bump("reap-repeat-death");
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
console.log(
  `Dead-label reaper — mode=${APPLY ? "APPLY (writing)" : "DRY-RUN (no writes)"}, ` +
    `repos=${REPOS.length} [${REPOS.map((r) => r.split("/")[1]).join(", ")}], now=${NOW}`,
);
if (!process.env.FACTORY_OPS_TOKEN_PRESENT && APPLY) {
  console.log(
    "::warning::FACTORY_OPS_TOKEN not detected — falling back to the ambient token. Pairing, " +
      "removing a label and commenting need only write access, not the guarded add-label path " +
      "(which gates `agent:implement`, the one label this pass never adds), so nothing " +
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
    `${n("reap-guard-skipped")} guard-skipped, ` +
    `${n("reap-pushed-nothing")} pushed-nothing, ${n("reap-cancelled")} cancelled, ` +
    `${n("reap-no-run-found")} no-run-found) — ` +
    `paired ${n("pairing-needs-human")} needs:human, ${n("pairing-tracking")} tracking, ` +
    `${n("pairing-blocker")} blocker-ref (${n("reap-repeat-death")} escalated as repeat-deaths), ` +
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
