// Fork-PR-approval watch (`npm run forkapproval:prs`). toon-meta#360, epic #342.
//
// Nothing in the factory previously watched for a fork PR whose workflow run
// is sitting unapproved: `auto-merge.yml` scans agent PRs only (`sandcastle/`,
// `agent/`), the dispatcher works on issues, and `pr-housekeeping.mjs` scans
// factory-branch PRs only — none of the three ever look at an external
// contributor's fork PR. An unapproved run's `action_required` conclusion is
// invisible to `gh pr checks` (no CheckRun is ever created — no job started)
// and fires no `check_suite` event, so it is silent rather than merely red.
// Full reasoning: fork-approval-evaluator.mjs's header.
//
// This is the thin gh I/O shell; ALL decision logic (surface / no-op / clear
// / skip) lives in the pure, unit-tested fork-approval-evaluator.mjs.
//
// ── PER OPEN PR, PER PASS ────────────────────────────────────────────────
//   1. Not a fork PR (`isCrossRepository` false) → skip outright (#360's own
//      scope: fork PRs are the class GitHub gates).
//   2. Fetch workflow runs at the PR's CURRENT `headRefOid` (`head_sha`
//      filter — NOT the run's own `pull_requests` field, which is always
//      empty for a fork-triggered run; see the evaluator header) and keep
//      the ones that concluded `action_required`.
//   3. Blocked + already labeled `needs:approval` → no-op (already surfaced).
//   4. Blocked + not labeled → label + comment naming every blocked run.
//   5. Not blocked + labeled → clear the label (stale signal).
//   6. Not blocked + not labeled → nothing to do.
//
// ── WRITE FAILURE ISOLATION (toon-meta#320 convention) ───────────────────
// Every write goes through write-report.mjs's `runWrite`, so one failed `gh`
// call degrades to "this one PR wasn't surfaced/cleared" instead of aborting
// the whole fleet pass; the run still exits non-zero iff a write failed.
//
// ── NO PATH TO REPO SECRETS ───────────────────────────────────────────────
// This pass never checks out the fork's code and never runs anything the
// fork PR authored — it only reads PR/run metadata via `gh api`/`gh pr` and
// writes a label + a comment via the SAME `FACTORY_OPS_TOKEN` every other
// housekeeping pass already uses. It cannot widen what an unapproved fork PR
// can reach (#360's fourth acceptance criterion).

import { execFileSync } from "node:child_process";
import {
  FORK_APPROVAL_LABEL,
  planForkApproval,
  buildSurfaceComment,
} from "./fork-approval-evaluator.mjs";
import { createWriteReport, runWrite, hasFailures, formatFailedSection } from "./write-report.mjs";

// ── Config (env-overridable) ────────────────────────────────────────────────
const ORG = process.env.FORKAPPROVAL_ORG ?? "toon-protocol";

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

const REPOS = (process.env.FORKAPPROVAL_REPOS
  ? process.env.FORKAPPROVAL_REPOS.split(",").map((s) => s.trim()).filter(Boolean)
  : DEFAULT_REPOS
).map((r) => (r.includes("/") ? r : `${ORG}/${r}`));

const APPLY = process.env.APPLY === "true";
const PR_LIMIT = Number(process.env.FORKAPPROVAL_PR_LIMIT ?? 200);

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

// Runs at this PR's CURRENT head commit, filtered to `pull_request`-event
// runs so a coincidental push-triggered run on the same SHA elsewhere can
// never be mistaken for this PR's own gate. `head_sha` is a REST query
// param, not a client-side filter — cheap, one call per fork PR.
function fetchBlockedRuns(repo, headSha) {
  const jq =
    '.workflow_runs[] | select(.conclusion=="action_required") | ' +
    "{id: .id, name: .name, url: .html_url}";
  const out = gh(
    ["api", `repos/${repo}/actions/runs?head_sha=${headSha}&event=pull_request&per_page=50`, "--jq", jq],
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

// ── Per-repo pass ────────────────────────────────────────────────────────────
const report = createWriteReport();
const counts = {};
const bump = (k) => (counts[k] = (counts[k] ?? 0) + 1);

function sweepRepo(repo) {
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
        "number,title,url,isCrossRepository,headRefOid,labels",
      ],
      { json: true, allowFail: true },
    ) ?? [];

  const forkPrs = prs.filter((p) => p.isCrossRepository);
  if (forkPrs.length === 0) return;
  console.log(`\n━━ ${repo} — ${forkPrs.length} open fork PR(s)`);

  for (const pr of forkPrs) {
    const id = `${repo}#${pr.number}`;
    const hasLabel = (pr.labels ?? []).some((l) => l.name === FORK_APPROVAL_LABEL);
    const blockedRuns = fetchBlockedRuns(repo, pr.headRefOid);

    const { verdict, blockedRuns: named } = planForkApproval({
      isCrossRepository: true,
      hasLabel,
      blockedRuns,
    });

    if (verdict === "skip") {
      bump("skip");
      continue;
    }

    if (verdict === "noop") {
      console.log(`   ${id} — still pending approval (${blockedRuns.length} run(s)); already labeled`);
      bump("noop");
      continue;
    }

    const tag = APPLY ? "APPLY" : "dry-run";
    if (verdict === "clear") {
      console.log(`   [${tag}] ${id} — no longer blocked, clearing ${FORK_APPROVAL_LABEL}`);
      if (APPLY) {
        const ok = runWrite(report, { type: "clear", target: id }, () => {
          gh(["pr", "edit", String(pr.number), "--repo", repo, "--remove-label", FORK_APPROVAL_LABEL]);
        });
        if (!ok) console.log(`   [APPLY] FAILED to clear ${FORK_APPROVAL_LABEL} on ${id}`);
      }
      bump("clear");
      continue;
    }

    // verdict === "surface"
    console.log(
      `   [${tag}] ${id} — pending approval (${named.length} run(s): ` +
        `${named.map((r) => r.name).join(", ")}) → label + comment`,
    );
    if (APPLY) {
      const comment = buildSurfaceComment({ repo, prNumber: pr.number, blockedRuns: named });
      const ok = runWrite(report, { type: "surface", target: id, detail: `${named.length} run(s)` }, () => {
        gh(["pr", "edit", String(pr.number), "--repo", repo, "--add-label", FORK_APPROVAL_LABEL]);
        gh(["pr", "comment", String(pr.number), "--repo", repo, "--body", comment]);
      });
      if (!ok) console.log(`   [APPLY] FAILED to surface ${id}`);
    }
    bump("surface");
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
console.log(
  `Fork-PR-approval watch — mode=${APPLY ? "APPLY (writing)" : "DRY-RUN (no writes)"}, ` +
    `repos=${REPOS.length} [${REPOS.map((r) => r.split("/")[1]).join(", ")}]`,
);
if (!process.env.FACTORY_OPS_TOKEN_PRESENT && APPLY) {
  console.log(
    "::warning::FACTORY_OPS_TOKEN not detected — falling back to the ambient token. Labeling " +
      "and commenting need only write access (not the guarded add-label path, which gates " +
      "`agent:implement` specifically), so nothing here is silently ignored for coming from the " +
      "wrong identity — but the ambient token is scoped to one repo and carries contents:read " +
      "only, so writes will FAIL loudly (see \"Failed writes\") rather than apply.",
  );
}

for (const repo of REPOS) {
  try {
    sweepRepo(repo);
  } catch (err) {
    console.error(`::error::fork-approval watch failed for ${repo}: ${err.message}`);
  }
}

// ── Summary ─────────────────────────────────────────────────────────────────
const n = (k) => counts[k] ?? 0;
console.log(
  `\nFork-PR-approval watch complete (${APPLY ? "APPLIED" : "dry-run"}): ` +
    `${n("surface")} PR(s) newly surfaced, ${n("noop")} still pending (already labeled), ` +
    `${n("clear")} label(s) cleared, ${n("skip")} fork PR(s) not blocked.`,
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
