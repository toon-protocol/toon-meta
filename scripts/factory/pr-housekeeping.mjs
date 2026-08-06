// Event-driven stuck-PR housekeeping (`npm run housekeeping:prs`). toon-meta#276.
//
// The remediation half of what `triage-sweep.mjs` Part B was meant to do, fixed
// and re-triggered. Part B was a NO-OP in production: it filtered open PRs on
// `headRefName.startsWith("agent/")` while every sandcastle PR is
// `sandcastle/issue-<n>` (live fleet count when this shipped: 144 sandcastle/*
// vs 71 agent/*, the latter all historical from the retired 4-loop system).
// This script matches BOTH prefixes, so any straggler agent/ PR is also swept.
//
// NB: triage-sweep (both parts + its hourly cron) was retired by toon-meta#283.
// Part A's dispatch role is superseded by the dependency-driven unblock
// dispatcher (unblock-dispatcher.mjs, toon-meta#280); Part B's role lives here.
//
// ── TRIGGER MODEL (event-driven, not cron) ──────────────────────────────────
// This script is repo-scoped and is invoked by .github/workflows/
// pr-housekeeping.yml, which each factory repo calls as a reusable workflow
// (workflow_call) from a tiny identical shim on:
//   * pull_request closed-and-merged — a merge into main is what CREATES
//     conflicts in everyone else's open PRs, so that is the moment to re-check
//     them all;
//   * check_suite completed on a sandcastle/ or agent/ branch — the PR's own
//     checks just finished; if red, file the fix ticket now, not up to an hour
//     later.
// An hourly cron is wrong on both axes: it lags, and it re-scans hundreds of
// issues across ten repos to usually do nothing.
//
// ── WHAT IT DOES, PER STUCK PR ──────────────────────────────────────────────
// A non-draft factory PR is STUCK when it has a merge conflict, failing checks,
// or has gone stale. For each stuck PR:
//   1. If an open remediation issue already exists for it (hidden body marker),
//      do nothing — exactly one open fix ticket per stuck PR.
//   2. If the retry cap is exhausted (counting closed priors too), label the PR
//      `needs:human` and stop looping forever.
//   3. Otherwise file ONE remediation issue. The body tells the fixer to CLOSE
//      the stuck PR and re-implement the underlying issue cleanly — never to
//      push onto the stuck branch. (Known runner failure: a fix ticket that
//      pushes to another PR's branch always fails the runner's final
//      `gh pr create`; the work lands, the ticket stays open, and an empty
//      branch is left behind.)
//
// ── CHECK-SET HONESTY + ASYNC MERGEABILITY (shared with #285) ───────────────
// Both rules — the four-valued check verdict (failing / pending / passed /
// UNVERIFIED, where an empty or all-skipped rollup is never a pass) and the
// mergeable-out-of-UNKNOWN polling — now live ONCE in pr-signals.mjs and are
// imported here. They were extracted by toon-meta#285 so the auto-merge pass
// reads exactly the same signals: two copies could disagree about whether the
// same PR is green, and remediate it as failing while merging it as passing.
// See pr-signals.mjs for the full reasoning (the buzz#141 empty-check-set
// gotcha, and why polling is both the read and the nudge).
//
// Unverified PRs are still reported loudly here and never counted as passed;
// they are not auto-remediated either, because there is no red check for a fix
// agent to act on. A PR whose mergeability never settles is reported, not
// judged.
//
// ── SAFETY MODEL (inherited from triage-sweep) ──────────────────────────────
// * DRY-RUN BY DEFAULT: writes happen only when APPLY=true. Every run prints
//   the full action list either way.
// * IDEMPOTENT: remediation is keyed on a hidden body marker; the legacy
//   triage-sweep marker is also counted so history carries over.
// * LOOP-BOUNDED: HOUSEKEEPING_RETRY_CAP attempts per PR, then needs:human.
// * NO agent:implement AUTO-LABEL (yet): fix tickets are filed UNLABELED by
//   default because of the runner failure described above. When that is fixed,
//   set HOUSEKEEPING_AUTOLABEL=true to enable the create-then-label sequence
//   (create first, label second — GitHub fires `issues.labeled` only for labels
//   added to an EXISTING issue; create-with-label emits only `opened`, which
//   the implement runner never sees).

import { execFileSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

import { checksVerdict, settleMergeable } from "./pr-signals.mjs";

// ── Config (env-overridable) ────────────────────────────────────────────────
const ORG = process.env.HOUSEKEEPING_ORG ?? "toon-protocol";

// The full factory fleet (11 repos). A single-repo event run narrows this via
// HOUSEKEEPING_REPOS (comma-separated `owner/name` or bare `name`).
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

const REPOS = (process.env.HOUSEKEEPING_REPOS
  ? process.env.HOUSEKEEPING_REPOS.split(",").map((s) => s.trim()).filter(Boolean)
  : DEFAULT_REPOS
).map((r) => (r.includes("/") ? r : `${ORG}/${r}`));

const APPLY = process.env.APPLY === "true";
const AUTOLABEL = process.env.HOUSEKEEPING_AUTOLABEL === "true";
const STALE_DAYS = Number(process.env.HOUSEKEEPING_STALE_DAYS ?? 3);
const RETRY_CAP = Number(process.env.HOUSEKEEPING_RETRY_CAP ?? 2);
const PR_LIMIT = Number(process.env.HOUSEKEEPING_PR_LIMIT ?? 200);
const MERGEABLE_POLL_TRIES = Number(process.env.HOUSEKEEPING_MERGEABLE_TRIES ?? 8);
const MERGEABLE_POLL_MS = Number(process.env.HOUSEKEEPING_MERGEABLE_INTERVAL_MS ?? 4000);

const FACTORY_BRANCH_PREFIXES = ["sandcastle/", "agent/"];
const IMPLEMENT_LABEL = "agent:implement";
const HUMAN_LABEL = "needs:human";

// Hidden marker embedded in every remediation issue body — slash/hash-free so
// GitHub issue search can find it; the exact string is re-checked client-side
// against candidate bodies because search is tokenized/fuzzy.
const sanitize = (repo) => repo.replace(/[^a-zA-Z0-9]+/g, "-");
const stuckMarker = (repo, pr) => `pr-housekeeping-stuck:${sanitize(repo)}-pr-${pr}`;
// triage-sweep Part B's marker. It never fired for sandcastle/* PRs (the no-op
// this ticket fixes), but any historical agent/* remediation it DID file must
// count toward the same retry cap rather than resetting it.
const legacyMarker = (repo, pr) => `triage-sweep-stuck:${sanitize(repo)}-pr-${pr}`;

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

const daysSince = (iso) => (Date.now() - new Date(iso).getTime()) / 86400000;

// Parse issue numbers a PR closes/fixes/resolves, from its title + body.
function linkedIssues(text) {
  const out = new Set();
  const re = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\b[:\s]+#(\d+)/gi;
  let m;
  while ((m = re.exec(text ?? "")) !== null) out.add(Number(m[1]));
  return out;
}

// ── mergeable settling ──────────────────────────────────────────────────────
// Policy + poll loop live in pr-signals.mjs; this binds them to gh and the
// real clock. Returns the settled value, or "UNKNOWN" if the budget ran out
// (callers must treat that as unjudgeable).
const settlePrMergeable = (repo, prNumber, initial) =>
  settleMergeable({
    initial,
    refetch: () =>
      gh(["pr", "view", String(prNumber), "--repo", repo, "--json", "mergeable"], {
        json: true,
        allowFail: true,
      })?.mergeable,
    sleep: (ms) => sleep(ms),
    tries: MERGEABLE_POLL_TRIES,
    intervalMs: MERGEABLE_POLL_MS,
  });

// ── Action log ──────────────────────────────────────────────────────────────
const actions = []; // { repo, kind, detail }
function record(repo, kind, detail) {
  actions.push({ repo, kind, detail });
  const tag = APPLY ? "APPLY" : "dry-run";
  console.log(`[${tag}] ${repo} · ${kind} · ${detail}`);
}

// ── Per-repo sweep ──────────────────────────────────────────────────────────
async function sweepRepo(repo) {
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

  const factoryPrs = prs.filter((p) =>
    FACTORY_BRANCH_PREFIXES.some((pre) => (p.headRefName ?? "").startsWith(pre)),
  );

  for (const pr of factoryPrs) {
    if (pr.isDraft) continue;
    const labels = new Set((pr.labels ?? []).map((l) => l.name));
    if (labels.has(HUMAN_LABEL)) continue; // already escalated to a human

    // Settle mergeability BEFORE judging — see header. A PR that never leaves
    // UNKNOWN is reported and skipped, never recorded as clean OR conflicted.
    const mergeable = await settlePrMergeable(repo, pr.number, pr.mergeable);
    if (mergeable === "UNKNOWN") {
      record(
        repo,
        "mergeable-unsettled",
        `PR #${pr.number} mergeability still UNKNOWN after ` +
          `${MERGEABLE_POLL_TRIES} polls — not judging this run`,
      );
      continue;
    }

    const { verdict, failing } = checksVerdict(pr.statusCheckRollup);
    const reasons = [];
    if (mergeable === "CONFLICTING") reasons.push("merge conflict");
    if (verdict === "failing") {
      const names = failing.slice(0, 5).map((f) => f.name).join(", ");
      reasons.push(
        `${failing.length} failing check(s)` + (names ? ` [${names}]` : ""),
      );
    }
    if (daysSince(pr.updatedAt) >= STALE_DAYS)
      reasons.push(`stale ${Math.round(daysSince(pr.updatedAt))}d`);

    // Empty/skipped check set: NOT stuck (nothing red to fix), but NEVER
    // "passed" either — surface it every run so it cannot masquerade as green.
    if (verdict === "unverified" && !reasons.length) {
      record(
        repo,
        "checks-unverified",
        `PR #${pr.number} "${pr.title}" — check set is empty or all-skipped; ` +
          `treating as NOT VERIFIED (never as passed); no remediation filed`,
      );
      continue;
    }
    if (!reasons.length) continue; // genuinely healthy (or pending)

    const reason = reasons.join(", ");
    const marker = stuckMarker(repo, pr.number);
    const legacy = legacyMarker(repo, pr.number);

    // Count prior remediation attempts for THIS PR via the hidden markers,
    // re-checking exact strings client-side (search is tokenized/fuzzy).
    const findByMarker = (m) =>
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
            `"${m}" in:body`,
            "--limit",
            "50",
            "--json",
            "number,state,body",
          ],
          { json: true, allowFail: true },
        ) ?? []
      ).filter((c) => (c.body ?? "").includes(m));
    const priors = [...findByMarker(marker), ...findByMarker(legacy)];
    const openPrior = priors.find((c) => (c.state ?? "").toUpperCase() === "OPEN");

    if (openPrior) {
      // Exactly one open fix ticket per stuck PR — it already exists.
      record(
        repo,
        "stuck-skip",
        `PR #${pr.number} (${reason}) — remediation #${openPrior.number} already open`,
      );
      continue;
    }

    if (priors.length >= RETRY_CAP) {
      // Retry budget exhausted — escalate to a human, stop looping.
      const body =
        `⚠️ **PR housekeeping escalation.** This factory PR is still stuck ` +
        `(${reason}) after ${priors.length} automated remediation attempt(s) ` +
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

    // File a fresh remediation issue. The instruction is deliberately
    // close-and-reimplement, NOT fix-the-branch: a fix ticket that pushes to
    // another PR's branch always fails the runner's final `gh pr create`.
    const target = [...linkedIssues(`${pr.title}\n${pr.body}`)][0];
    const attempt = priors.length + 1;
    const title = `[housekeeping] Stuck factory PR #${pr.number}: ${reason} (attempt ${attempt}/${RETRY_CAP})`;
    const body = [
      `The factory PR ${pr.url} is stuck: **${reason}**.`,
      ``,
      `**Close the stuck PR and re-implement the underlying issue cleanly:**`,
      ``,
      target
        ? `1. Close PR #${pr.number} (it was opened for #${target}).`
        : `1. Close PR #${pr.number}.`,
      target
        ? `2. Re-implement #${target} from fresh \`main\` on a NEW branch.`
        : `2. Re-implement the underlying change from fresh \`main\` on a NEW branch.`,
      `3. Open a new PR; make it green (conflicts resolved, checks passing —`,
      `   a skipped or empty check set does not count as passing).`,
      ``,
      `Do NOT push commits onto the stuck PR's branch: pushing to another PR's`,
      `branch breaks the runner's final \`gh pr create\` step and strands the work.`,
      ``,
      `This is automated remediation attempt ${attempt} of ${RETRY_CAP}; after the`,
      `cap, housekeeping escalates PR #${pr.number} to \`${HUMAN_LABEL}\` instead`,
      `of filing again.`,
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
      // Create-then-label: `issues.labeled` only fires for labels added to an
      // EXISTING issue, so the label must be a second call — but it is OFF by
      // default until the fix-ticket runner gap is closed (see header).
      if (AUTOLABEL) {
        const num = (created.trim().split("/").pop() || "").trim();
        if (num) {
          gh(["issue", "edit", num, "--repo", repo, "--add-label", IMPLEMENT_LABEL]);
        }
      }
    }
    record(
      repo,
      "stuck-remediate",
      `PR #${pr.number} (${reason}) → file remediation issue ` +
        `(attempt ${attempt}/${RETRY_CAP}${AUTOLABEL ? `, +${IMPLEMENT_LABEL}` : ", unlabeled"})`,
    );
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
console.log(
  `PR housekeeping — mode=${APPLY ? "APPLY (writing)" : "DRY-RUN (no writes)"}, ` +
    `repos=${REPOS.length} [${REPOS.map((r) => r.split("/")[1]).join(", ")}], ` +
    `stale=${STALE_DAYS}d, retryCap=${RETRY_CAP}, autolabel=${AUTOLABEL}`,
);
if (!process.env.FACTORY_OPS_TOKEN_PRESENT && APPLY) {
  console.log(
    "::warning::FACTORY_OPS_TOKEN not detected — falling back to the ambient " +
      "token. Issue creation and needs:human labeling may still work, but the " +
      "write identity will not be the monitored factory-ops credential (#271).",
  );
}

for (const repo of REPOS) {
  try {
    await sweepRepo(repo);
  } catch (err) {
    console.error(`::error::housekeeping failed for ${repo}: ${err.message}`);
  }
}

// ── Summary ─────────────────────────────────────────────────────────────────
const by = (k) => actions.filter((a) => a.kind === k).length;
console.log(
  `\nHousekeeping complete (${APPLY ? "APPLIED" : "dry-run"}): ` +
    `${by("stuck-remediate")} remediation issue(s) filed, ` +
    `${by("stuck-escalate")} PR(s) escalated to ${HUMAN_LABEL}, ` +
    `${by("stuck-skip")} stuck PR(s) already in remediation, ` +
    `${by("checks-unverified")} PR(s) with an unverified (empty/skipped) check set, ` +
    `${by("mergeable-unsettled")} PR(s) left unjudged (mergeable never settled).`,
);
process.exit(0);
