// Factory triage sweep (`npm run triage:sweep`).
//
// A cron-driven, MANAGER-TIER janitor that runs from toon-meta and reaches every
// factory execution repo. It does the two things the event-driven sandcastle
// runners cannot do for themselves, because both require looking ACROSS the
// backlog rather than reacting to a single label event:
//
//   Part A — dispatch workable issues. Any open, eligible LEAF issue that has
//            gone quiet for the cooldown window gets `agent:implement` added,
//            which fires that repo's `agent-implement.yml` runner.
//   Part B — unstick agent PRs. Open `agent/` PRs that are conflicting, failing
//            checks, or stale get a remediation issue filed (itself labeled
//            `agent:implement` so the factory retries), with a retry cap that
//            escalates to `needs:human` instead of looping forever.
//
// WHY THIS LIVES IN toon-meta AND NOT PER-REPO: triage is a manager function
// (it decides what to label by surveying the whole backlog), whereas the
// implement/review runners are execution functions (they act on the one repo
// they live in, triggered by a repo-local label event). Centralizing the sweep
// avoids rebuilding the per-repo fan-out that the old 4-loop `backlog-manager.yml`
// carried — the exact maintenance tax retired in #193. The org GitHub App is
// installed on every repo, so one workflow can sweep them all.
//
// ── SAFETY MODEL ────────────────────────────────────────────────────────────
// * DRY-RUN BY DEFAULT. Writes happen ONLY when APPLY=true. Every run prints the
//   full list of actions it took (apply) or would take (dry-run) so the first
//   live fan-out can be eyeballed via a workflow_dispatch dry-run first.
// * COOLDOWN. An issue must have been untouched for TRIAGE_COOLDOWN_MINUTES
//   before it is auto-labelled. Because the gate is "any eligible leaf issue"
//   (no risk:* required), this cooldown is the human grace window: open an issue
//   to jot it down, and you have that long to add `needs:human` or keep editing
//   (each edit resets updatedAt, so an actively-edited issue is never grabbed)
//   before the next hourly sweep dispatches it.
// * IDEMPOTENT. Part A never re-adds a label already present and skips issues
//   with an open agent PR. Part B keys remediation on a hidden body marker and
//   never files a second open remediation issue for the same PR.
// * LOOP-BOUNDED. After TRIAGE_STUCK_RETRY_CAP remediation attempts on one PR,
//   Part B stops filing agent:implement issues and escalates to needs:human.
//
// ── THE PAT REQUIREMENT (operational, human/admin action) ───────────────────
// For a label add to actually TRIGGER `agent-implement.yml`, two conditions from
// hard-won prior gotchas must both hold:
//   1. The labeler's events must be able to trigger workflows. The default
//      GITHUB_TOKEN cannot; a GitHub App token CAN; a user PAT CAN.
//   2. `agent-implement.yml`'s Guard 1 requires the LABELER to have write access
//      (`repos/.../collaborators/{actor}/permission`). A GitHub App bot is NOT a
//      collaborator, so an App-token label add is REJECTED by that guard.
// => The sweep must label as a USER with write access. Supply a fine-grained PAT
//    (Issues:RW, PRs:RW, Contents:read on the factory repos) as the org secret
//    TRIAGE_PAT — the same pattern the old REVIEWER_TOKEN used to be a distinct
//    write identity. Without TRIAGE_PAT the sweep falls back to the App token: it
//    still REPORTS and can still create issues, but auto-labelled issues will be
//    refused by Guard 1 and no implement run fires. This is surfaced at startup.
//
// This is a plain Node CI script (not a Workflow orchestration script), so
// Date.now()/new Date() are available and used for the age math.

import { execFileSync } from "node:child_process";

// ── Config (env-overridable) ────────────────────────────────────────────────
const ORG = process.env.TRIAGE_ORG ?? "toon-protocol";

// The factory execution set. New factory repos are a one-line add here (or via
// the TRIAGE_REPOS env override, comma-separated `owner/name` or bare `name`).
const DEFAULT_REPOS = [
  "relay",
  "toon-client",
  "store",
  "connector",
  "toon",
  "swap",
  "toon-meta",
  "rig",
  "Forge",
  "fractal",
];

const REPOS = (process.env.TRIAGE_REPOS
  ? process.env.TRIAGE_REPOS.split(",").map((s) => s.trim()).filter(Boolean)
  : DEFAULT_REPOS
).map((r) => (r.includes("/") ? r : `${ORG}/${r}`));

const APPLY = process.env.APPLY === "true";
const COOLDOWN_MINUTES = Number(process.env.TRIAGE_COOLDOWN_MINUTES ?? 60);
const STALE_DAYS = Number(process.env.TRIAGE_STALE_DAYS ?? 3);
const RETRY_CAP = Number(process.env.TRIAGE_STUCK_RETRY_CAP ?? 2);
const ISSUE_LIMIT = Number(process.env.TRIAGE_ISSUE_LIMIT ?? 300);
const PR_LIMIT = Number(process.env.TRIAGE_PR_LIMIT ?? 200);

// Issues carrying any of these are never auto-dispatched: parents/PRD-shaped
// work (epic, tracking), human-held work (needs:human), already-dispatched
// (agent:implement), or the review trigger (agent:review, PR-only but harmless).
// NB: agent-implement.yml's own guards re-check epic/tracking/needs:human AND
// query sub-issues, so a PRD parent lacking the epic/tracking label is still
// caught downstream — this list is the cheap first pass, the runner is the
// authoritative backstop.
const EXCLUDE_LABELS = new Set([
  "epic",
  "tracking",
  "needs:human",
  "agent:implement",
  "agent:review",
]);

const AGENT_BRANCH_PREFIX = "agent/";
const IMPLEMENT_LABEL = "agent:implement";
const HUMAN_LABEL = "needs:human";

// Hidden marker embedded in every remediation issue body. Sanitised to a
// slash/hash-free token so GitHub issue search can find it; the exact string is
// re-checked client-side against candidate bodies to avoid tokenizer over-match.
const stuckMarker = (repo, pr) =>
  `triage-sweep-stuck:${repo.replace(/[^a-zA-Z0-9]+/g, "-")}-pr-${pr}`;

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

const minutesSince = (iso) => (Date.now() - new Date(iso).getTime()) / 60000;
const daysSince = (iso) => minutesSince(iso) / (60 * 24);

// Parse issue numbers a PR closes/fixes/resolves, from its title + body.
function linkedIssues(text) {
  const out = new Set();
  const re = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\b[:\s]+#(\d+)/gi;
  let m;
  while ((m = re.exec(text ?? "")) !== null) out.add(Number(m[1]));
  return out;
}

// ── Action log ──────────────────────────────────────────────────────────────
const actions = []; // { repo, kind, detail }
function record(repo, kind, detail) {
  actions.push({ repo, kind, detail });
  const tag = APPLY ? "APPLY" : "dry-run";
  console.log(`[${tag}] ${repo} · ${kind} · ${detail}`);
}

// ── Per-repo sweep ──────────────────────────────────────────────────────────
function sweepRepo(repo) {
  // Part B data is fetched first: its open agent PRs tell Part A which issues
  // already have work in flight (skip those), and drive the stuck-PR pass.
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
        "number,title,headRefName,mergeable,updatedAt,url,labels,isDraft,body,statusCheckRollup",
      ],
      { json: true, allowFail: true },
    ) ?? [];

  const agentPrs = prs.filter((p) =>
    (p.headRefName ?? "").startsWith(AGENT_BRANCH_PREFIX),
  );

  // Issue numbers referenced by ANY open agent PR — do not re-dispatch these.
  const inFlight = new Set();
  for (const p of agentPrs)
    for (const n of linkedIssues(`${p.title}\n${p.body}`)) inFlight.add(n);

  // ── Part A: dispatch workable issues ──────────────────────────────────────
  const issues =
    gh(
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
        "number,title,labels,updatedAt,url",
      ],
      { json: true, allowFail: true },
    ) ?? [];

  for (const iss of issues) {
    const labels = new Set((iss.labels ?? []).map((l) => l.name));
    if ([...labels].some((l) => EXCLUDE_LABELS.has(l))) continue;
    if (inFlight.has(iss.number)) continue; // agent PR already in flight
    const quietFor = minutesSince(iss.updatedAt);
    if (quietFor < COOLDOWN_MINUTES) continue; // still in the human grace window

    const detail = `#${iss.number} "${iss.title}" (quiet ${Math.round(
      quietFor,
    )}m) → add ${IMPLEMENT_LABEL}`;
    if (APPLY) {
      gh([
        "issue",
        "edit",
        String(iss.number),
        "--repo",
        repo,
        "--add-label",
        IMPLEMENT_LABEL,
      ]);
    }
    record(repo, "dispatch-issue", detail);
  }

  // ── Part B: unstick agent PRs ─────────────────────────────────────────────
  // SUPERSEDED by the event-driven pr-housekeeping.mjs (toon-meta#276): this
  // pass filters on the `agent/` prefix only, which matches zero live factory
  // PRs (they are all `sandcastle/issue-<n>`), so it is a production no-op.
  // It is left in place untouched because #283 retires Part A + this cron as a
  // separate ticket. Do not extend this pass — extend pr-housekeeping.mjs.
  for (const pr of agentPrs) {
    if (pr.isDraft) continue;
    const labels = new Set((pr.labels ?? []).map((l) => l.name));
    if (labels.has(HUMAN_LABEL)) continue; // already escalated

    const reasons = [];
    if (pr.mergeable === "CONFLICTING") reasons.push("merge conflict");
    const rollup = pr.statusCheckRollup ?? [];
    const failing = rollup.filter((c) => {
      const s = (c.conclusion || c.state || "").toUpperCase();
      return ["FAILURE", "ERROR", "TIMED_OUT", "CANCELLED", "STARTUP_FAILURE"].includes(s);
    });
    if (failing.length) reasons.push(`${failing.length} failing check(s)`);
    if (daysSince(pr.updatedAt) >= STALE_DAYS)
      reasons.push(`stale ${Math.round(daysSince(pr.updatedAt))}d`);
    if (!reasons.length) continue;

    const reason = reasons.join(", ");
    const marker = stuckMarker(repo, pr.number);

    // Count prior remediation attempts for THIS PR via the hidden marker,
    // re-checking the exact string client-side (search is tokenized/fuzzy).
    const candidates =
      gh(
        [
          "issue",
          "list",
          "--repo",
          repo,
          "--state",
          "all",
          "--search",
          `"${marker}" in:body`,
          "--limit",
          "50",
          "--json",
          "number,state,body",
        ],
        { json: true, allowFail: true },
      ) ?? [];
    const priors = candidates.filter((c) => (c.body ?? "").includes(marker));
    const openPrior = priors.find((c) => (c.state ?? "").toUpperCase() === "OPEN");

    if (openPrior) {
      // A remediation issue is already open for this PR — do nothing.
      record(
        repo,
        "stuck-skip",
        `PR #${pr.number} (${reason}) — remediation #${openPrior.number} already open`,
      );
      continue;
    }

    if (priors.length >= RETRY_CAP) {
      // Retry budget exhausted — escalate the PR to a human, stop looping.
      const body =
        `⚠️ **Triage sweep escalation.** This agent PR is still stuck (${reason}) ` +
        `after ${priors.length} automated remediation attempt(s) ` +
        `(cap ${RETRY_CAP}). Handing to a human — no further auto-remediation ` +
        `will be filed while \`${HUMAN_LABEL}\` is present.`;
      if (APPLY) {
        gh(["pr", "edit", String(pr.number), "--repo", repo, "--add-label", HUMAN_LABEL]);
        gh(["pr", "comment", String(pr.number), "--repo", repo, "--body", body]);
      }
      record(
        repo,
        "stuck-escalate",
        `PR #${pr.number} (${reason}) — ${priors.length} attempt(s) ≥ cap → ${HUMAN_LABEL}`,
      );
      continue;
    }

    // File a fresh remediation issue. Created WITHOUT the label, then labelled
    // in a second call, because GitHub fires issues.labeled only for labels
    // added to an EXISTING issue (a create-with-label emits only `opened` and
    // the implement runner, which listens on `labeled`, would never pick it up).
    const target = [...linkedIssues(`${pr.title}\n${pr.body}`)][0];
    const attempt = priors.length + 1;
    const title = `[triage] Stuck agent PR #${pr.number}: ${reason} (attempt ${attempt}/${RETRY_CAP})`;
    const body = [
      `The agent PR ${pr.url} is stuck: **${reason}**.`,
      ``,
      `Resolve it, then supersede the stuck PR:`,
      `- Use the \`resolving-merge-conflicts\` skill if there is a merge conflict.`,
      `- Rebase/merge \`main\`, fix conflicts and failing checks, and get the`,
      `  change green.`,
      target
        ? `- This PR was opened for #${target}; prefer closing PR #${pr.number} and re-implementing #${target} cleanly over force-editing the stuck branch.`
        : `- If the branch is unrecoverable, close PR #${pr.number} and re-implement the underlying issue cleanly.`,
      ``,
      `This is automated remediation attempt ${attempt} of ${RETRY_CAP}; after the`,
      `cap the sweep escalates PR #${pr.number} to \`${HUMAN_LABEL}\` instead of`,
      `filing again.`,
      ``,
      `<!-- ${marker} -->`,
    ].join("\n");

    if (APPLY) {
      const created = gh([
        "issue",
        "create",
        "--repo",
        repo,
        "--title",
        title,
        "--body",
        body,
      ]);
      // `gh issue create` prints the new issue URL; the number is its last path segment.
      const num = (created.trim().split("/").pop() || "").trim();
      if (num) {
        gh(["issue", "edit", num, "--repo", repo, "--add-label", IMPLEMENT_LABEL]);
      }
    }
    record(
      repo,
      "stuck-remediate",
      `PR #${pr.number} (${reason}) → file remediation issue (attempt ${attempt}/${RETRY_CAP})`,
    );
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
console.log(
  `Triage sweep — mode=${APPLY ? "APPLY (writing)" : "DRY-RUN (no writes)"}, ` +
    `repos=${REPOS.length}, cooldown=${COOLDOWN_MINUTES}m, stale=${STALE_DAYS}d, ` +
    `retryCap=${RETRY_CAP}`,
);
if (!process.env.TRIAGE_PAT_PRESENT) {
  console.log(
    "::warning::TRIAGE_PAT not detected — auto-labelled issues will be refused " +
      "by agent-implement.yml's write-access guard and NO implement run will " +
      "fire. Set the TRIAGE_PAT org secret (fine-grained user PAT, Issues+PRs " +
      "write) to enable dispatch. The sweep still reports below.",
  );
}

for (const repo of REPOS) {
  try {
    sweepRepo(repo);
  } catch (err) {
    console.error(`::error::sweep failed for ${repo}: ${err.message}`);
  }
}

// ── Summary ─────────────────────────────────────────────────────────────────
const by = (k) => actions.filter((a) => a.kind === k).length;
console.log(
  `\nSweep complete (${APPLY ? "APPLIED" : "dry-run"}): ` +
    `${by("dispatch-issue")} issue(s) dispatched, ` +
    `${by("stuck-remediate")} remediation issue(s) filed, ` +
    `${by("stuck-escalate")} PR(s) escalated to ${HUMAN_LABEL}, ` +
    `${by("stuck-skip")} stuck PR(s) already-in-remediation.`,
);
process.exit(0);
