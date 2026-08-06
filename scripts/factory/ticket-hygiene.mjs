// Weekly ticket-hygiene sweep (`npm run hygiene:tickets`). toon-meta#277.
//
// Nothing pruned the backlog before this: triage-sweep only ever CREATES
// issues and pr-housekeeping only files remediation. This sweep is the
// pruner. Unlike #276 it is correctly a CRON — staleness is a property of
// TIME, not of any event — so it runs weekly from toon-meta across the whole
// factory fleet (.github/workflows/ticket-hygiene.yml).
//
// Decision logic lives in hygiene-evaluator.mjs (pure, unit-tested); this
// file is the I/O shell: gh reads, gh writes (APPLY only), and the report.
//
// ── THE THREE CATEGORIES (deliberately different treatment) ─────────────────
// STALE — reversible, two-step:
//   * mark: open ≥ STALE_DAYS (default 30) with no activity and NO open PR
//     referencing it (broad `#N` matching — over-matching fails safe) →
//     add `stale` label + a warning comment carrying a hidden marker.
//   * close: still zero activity GRACE_DAYS (default 14) after OUR marking →
//     close as "not planned". Grace is measured from the marker comment's
//     timestamp, never from updatedAt (our own label+comment bump that).
//   * any activity/PR after marking → the label is REMOVED (clock resets).
//   * `epic` / `tracking` / `needs:human` are never touched, and a stale
//     label a human applied by hand (no marker comment) is never auto-closed.
//   Why 30d: the factory's own loops act on minutes-to-days (triage cooldown
//   60m, housekeeping PR-staleness 3d) — an issue quiet for 30 days has
//   survived ~4 weekly sweeps outside every loop and is genuinely dormant.
//   Why 14d grace: two full weekly sweeps between warning and close, so a
//   human always sees at least one intervening report.
//
// OBSOLETE — auto-close, but ONLY the two mechanically decidable cases:
//   (a) an open issue referenced with a close keyword by a PR MERGED into the
//       default branch — the `Closes #n` link did not fire (keyword in the PR
//       title, or the fix-ticket-runner gap where work lands on another PR's
//       branch). Closed as completed, evidence PR(s) in the comment.
//   (b) a housekeeping remediation issue (hidden marker
//       `pr-housekeeping-stuck:*`, legacy `triage-sweep-stuck:*`) whose
//       target PR is now MERGED (→ completed) or CLOSED (→ not planned).
//   Reopen guard: every obsolete close comment carries a hidden marker; if a
//   human reopens the issue, the marker's presence makes the next sweep
//   REPORT instead of re-closing (the merged-PR evidence never goes away, so
//   without this the reopen would be silently reverted weekly).
//
// REDUNDANT — never automatic. A conservative heuristic (title-token Jaccard
//   + minimum shared informative tokens, per repo) only PROPOSES duplicate
//   clusters; they land in a single persistent report issue in toon-meta
//   (hidden marker `ticket-hygiene-report`, upserted each run) for a human to
//   confirm or dismiss. A heuristic was chosen over an LLM pass deliberately:
//   no new API keys or secrets (a hard constraint here), and precision-tuned
//   proposals are all the ticket asks for.
//
// ── INTERPLAY WITH THE OTHER JANITORS ───────────────────────────────────────
// * Housekeeping remediation issues are EXCLUDED from the stale pass and from
//   clustering: housekeeping enforces exactly-one-open-remediation per stuck
//   PR (stale-closing one would just make it refile and burn a retry-cap
//   attempt), and their titles are near-identical by construction. Hygiene
//   only ever closes them via obsolete case (b), when their PR is done.
// * A stale close uses reason "not planned", which the unblock evaluator
//   (#274) deliberately treats as NOT satisfying dependents — tickets blocked
//   on a stale-closed one get routed to a human, not silently released.
//
// ── SAFETY MODEL (inherited from triage-sweep / pr-housekeeping) ────────────
// * DRY-RUN BY DEFAULT: writes happen only when APPLY=true. Every run prints
//   the full action list either way, plus the would-be report body.
// * IDEMPOTENT: stale marking/closing is keyed on the hidden marker comment;
//   obsolete closes carry a reopen-guard marker; the report issue is upserted
//   in place, never duplicated.
// * FAIL CLOSED: unfetchable PR states, missing marker provenance, and
//   protected labels all degrade to reporting, never to writes.
// * LABEL PROVISIONING: the `stale` label may not exist in every repo; on the
//   first APPLY-mode marking in a repo it is created if missing (create is
//   allowed to fail if it already exists — existing colors are not clobbered).
//
// ── CREDENTIAL ──────────────────────────────────────────────────────────────
// FACTORY_OPS_TOKEN (org secret, provisioned + monitored under #271) is the
// write identity for labels, comments, closes and the report issue. Hygiene
// never adds `agent:implement`, so the Guard-1 labeler constraint is not in
// play.

import { execFileSync } from "node:child_process";
import {
  PROTECTED_LABELS,
  STALE_LABEL,
  REPORT_MARKER,
  staleMarker,
  obsoleteMarker,
  referencedIssues,
  parseStuckMarker,
  evaluateStale,
  findObsoleteFromMergedPrs,
  evaluateRemediationObsolete,
  clusterRedundant,
} from "./hygiene-evaluator.mjs";

// ── Config (env-overridable) ────────────────────────────────────────────────
const ORG = process.env.HYGIENE_ORG ?? "toon-protocol";

// The full factory fleet (11 repos) — same set as pr-housekeeping.mjs.
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

const REPOS = (process.env.HYGIENE_REPOS
  ? process.env.HYGIENE_REPOS.split(",").map((s) => s.trim()).filter(Boolean)
  : DEFAULT_REPOS
).map((r) => (r.includes("/") ? r : `${ORG}/${r}`));

const APPLY = process.env.APPLY === "true";
const STALE_DAYS = Number(process.env.HYGIENE_STALE_DAYS ?? 30);
const GRACE_DAYS = Number(process.env.HYGIENE_GRACE_DAYS ?? 14);
const ACTIVITY_SLACK_MINUTES = Number(process.env.HYGIENE_ACTIVITY_SLACK_MINUTES ?? 60);
const ISSUE_LIMIT = Number(process.env.HYGIENE_ISSUE_LIMIT ?? 300);
const PR_LIMIT = Number(process.env.HYGIENE_PR_LIMIT ?? 200);
const MERGED_PR_LIMIT = Number(process.env.HYGIENE_MERGED_PR_LIMIT ?? 200);
const SIM_THRESHOLD = Number(process.env.HYGIENE_SIM_THRESHOLD ?? 0.5);
const MIN_SHARED = Number(process.env.HYGIENE_MIN_SHARED ?? 4);

const REPORT_REPO = process.env.HYGIENE_REPORT_REPO ?? `${ORG}/toon-meta`;

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
  gh(
    ["issue", "view", String(number), "--repo", repo, "--json", "comments"],
    { json: true, allowFail: true },
  )?.comments ?? [];

// Ensure the `stale` label exists (create-if-missing; APPLY only). Creation is
// allowed to fail when the label already exists so we never clobber a repo's
// existing color/description. Cached per repo per run.
const labelEnsured = new Set();
function ensureStaleLabel(repo) {
  if (!APPLY || labelEnsured.has(repo)) return;
  labelEnsured.add(repo);
  gh(
    [
      "label",
      "create",
      STALE_LABEL,
      "--repo",
      repo,
      "--color",
      "ededed",
      "--description",
      "No activity for a while; will be closed by the weekly hygiene sweep unless it sees activity",
    ],
    { allowFail: true },
  );
}

// ── Action log ──────────────────────────────────────────────────────────────
const actions = []; // { repo, kind, detail }
function record(repo, kind, detail) {
  actions.push({ repo, kind, detail });
  const tag = APPLY ? "APPLY" : "dry-run";
  console.log(`[${tag}] ${repo} · ${kind} · ${detail}`);
}

const redundancyClusters = []; // { repo, cluster }

// ── Per-repo sweep ──────────────────────────────────────────────────────────
function sweepRepo(repo) {
  const defaultBranch =
    gh(["repo", "view", repo, "--json", "defaultBranchRef"], {
      json: true,
      allowFail: true,
    })?.defaultBranchRef?.name ?? "main";

  const openIssues = (
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
        "number,title,labels,updatedAt,url,body",
      ],
      { json: true, allowFail: true },
    ) ?? []
  ).map((i) => ({ ...i, labels: (i.labels ?? []).map((l) => l.name) }));

  // The hygiene report issue governs itself — never sweep it.
  const issues = openIssues.filter((i) => !(i.body ?? "").includes(REPORT_MARKER));

  const openPrs =
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
        "number,title,body",
      ],
      { json: true, allowFail: true },
    ) ?? [];

  // Issues mentioned by ANY open PR (broad matching — fails safe for stale).
  const referencedByOpen = new Set();
  for (const p of openPrs)
    for (const n of referencedIssues(`${p.title}\n${p.body ?? ""}`))
      referencedByOpen.add(n);

  const mergedPrs =
    gh(
      [
        "pr",
        "list",
        "--repo",
        repo,
        "--state",
        "merged",
        "--limit",
        String(MERGED_PR_LIMIT),
        "--json",
        "number,title,body,baseRefName,mergedAt,url",
      ],
      { json: true, allowFail: true },
    ) ?? [];

  const handled = new Set(); // issues an obsolete pass already acted on

  // ── Obsolete (a): merged PR whose close link did not fire ─────────────────
  const { closable, skippedProtected } = findObsoleteFromMergedPrs({
    openIssues: issues,
    mergedPrs,
    defaultBranch,
  });
  for (const { issue, prs, protectedLabel } of skippedProtected) {
    record(
      repo,
      "obsolete-skip-protected",
      `#${issue.number} "${issue.title}" is close-referenced by merged ` +
        `PR(s) ${prs.map((p) => `#${p.number}`).join(", ")} but carries ` +
        `'${protectedLabel}' — reporting only`,
    );
  }
  for (const { issue, prs } of closable) {
    const marker = obsoleteMarker(repo, issue.number);
    // Reopen guard: if we auto-closed this before and a human reopened it,
    // the marker is already in its comments — report, never re-close.
    const priorClose = fetchComments(repo, issue.number).some((c) =>
      (c.body ?? "").includes(marker),
    );
    if (priorClose) {
      record(
        repo,
        "obsolete-reopened",
        `#${issue.number} was auto-closed before and reopened by a human — ` +
          `not re-closing (needs a human decision)`,
      );
      handled.add(issue.number);
      continue;
    }
    const evidence = prs
      .map((p) => `${p.url ?? `#${p.number}`} (merged ${p.mergedAt ?? "?"})`)
      .join(", ");
    const comment = [
      `Closing automatically (weekly ticket hygiene, toon-meta#277): this issue`,
      `is referenced with a close keyword by merged PR ${evidence}, but the`,
      `\`Closes #n\` link did not fire — a known gap when the keyword sits in the`,
      `PR title or the work landed via another PR's branch.`,
      ``,
      `If this is wrong, reopen it — the sweep will not close it again.`,
      ``,
      `<!-- ${marker} -->`,
    ].join("\n");
    if (APPLY) {
      gh([
        "issue",
        "close",
        String(issue.number),
        "--repo",
        repo,
        "--reason",
        "completed",
        "--comment",
        comment,
      ]);
    }
    record(
      repo,
      "obsolete-close-merged-pr",
      `#${issue.number} "${issue.title}" → close (completed); evidence: ${evidence}`,
    );
    handled.add(issue.number);
  }

  // ── Obsolete (b): remediation issue whose target PR is done ───────────────
  for (const issue of issues) {
    if (handled.has(issue.number)) continue;
    const marker = parseStuckMarker(issue.body);
    if (!marker) continue;
    if (issue.labels.some((l) => PROTECTED_LABELS.has(l))) continue; // never touched
    const pr = gh(
      ["pr", "view", String(marker.prNumber), "--repo", repo, "--json", "state"],
      { json: true, allowFail: true },
    );
    const verdict = evaluateRemediationObsolete({ marker, pr });
    if (verdict.action === "keep-open") continue;
    if (verdict.action === "report-only") {
      record(repo, "obsolete-unverifiable", `#${issue.number}: ${verdict.reason}`);
      continue;
    }
    const closeMarker = obsoleteMarker(repo, issue.number);
    const priorClose = fetchComments(repo, issue.number).some((c) =>
      (c.body ?? "").includes(closeMarker),
    );
    if (priorClose) {
      record(
        repo,
        "obsolete-reopened",
        `#${issue.number} was auto-closed before and reopened by a human — not re-closing`,
      );
      handled.add(issue.number);
      continue;
    }
    const reason = verdict.action === "close-completed" ? "completed" : "not planned";
    const comment = [
      `Closing automatically (weekly ticket hygiene, toon-meta#277): this is a`,
      `${marker.source} remediation issue and its ${verdict.reason}.`,
      ``,
      `If this is wrong, reopen it — the sweep will not close it again.`,
      ``,
      `<!-- ${closeMarker} -->`,
    ].join("\n");
    if (APPLY) {
      gh([
        "issue",
        "close",
        String(issue.number),
        "--repo",
        repo,
        "--reason",
        reason,
        "--comment",
        comment,
      ]);
    }
    record(
      repo,
      "obsolete-close-remediation",
      `#${issue.number} "${issue.title}" → close (${reason}); ${verdict.reason}`,
    );
    handled.add(issue.number);
  }

  // ── Stale pass ────────────────────────────────────────────────────────────
  for (const issue of issues) {
    if (handled.has(issue.number)) continue;

    const marker = staleMarker(repo, issue.number);
    let staleMarkedAt = null;
    let commentsSinceMarked = false;
    if (issue.labels.includes(STALE_LABEL)) {
      // Provenance lives in the comments; fetched only for stale-labeled
      // issues (few) to keep the sweep cheap.
      const comments = fetchComments(repo, issue.number);
      const markComment = [...comments]
        .reverse()
        .find((c) => (c.body ?? "").includes(marker));
      if (markComment) {
        staleMarkedAt = markComment.createdAt;
        commentsSinceMarked = comments.some(
          (c) =>
            Date.parse(c.createdAt) > Date.parse(markComment.createdAt) &&
            !(c.body ?? "").includes(marker),
        );
      }
    }

    const verdict = evaluateStale(
      {
        number: issue.number,
        labels: issue.labels,
        updatedAt: issue.updatedAt,
        referencedByOpenPr: referencedByOpen.has(issue.number),
        hasStuckMarker: Boolean(parseStuckMarker(issue.body)),
        staleMarkedAt,
        commentsSinceMarked,
      },
      {
        now: Date.now(),
        staleDays: STALE_DAYS,
        graceDays: GRACE_DAYS,
        activitySlackMinutes: ACTIVITY_SLACK_MINUTES,
      },
    );

    switch (verdict.action) {
      case "mark": {
        const comment = [
          `This issue has been quiet for ${STALE_DAYS}+ days with no open PR`,
          `referencing it, so the weekly ticket-hygiene sweep (toon-meta#277)`,
          `has marked it \`${STALE_LABEL}\`. It will be **closed in ${GRACE_DAYS} days**`,
          `unless it sees activity — comment, update, or label it \`needs:human\``,
          `to keep it open indefinitely. Any activity removes the \`${STALE_LABEL}\``,
          `label automatically.`,
          ``,
          `<!-- ${marker} -->`,
        ].join("\n");
        if (APPLY) {
          ensureStaleLabel(repo);
          gh(["issue", "edit", String(issue.number), "--repo", repo, "--add-label", STALE_LABEL]);
          gh(["issue", "comment", String(issue.number), "--repo", repo, "--body", comment]);
        }
        record(repo, "stale-mark", `#${issue.number} "${issue.title}" — ${verdict.reason}`);
        break;
      }
      case "close": {
        const comment = [
          `Closing as stale (weekly ticket hygiene, toon-meta#277): marked`,
          `\`${STALE_LABEL}\` ${GRACE_DAYS}+ days ago and untouched since. Closed as`,
          `"not planned" — reopen it (or file fresh with current context) if it`,
          `still matters; a dependent ticket blocked on this one will be routed`,
          `to a human rather than released.`,
        ].join("\n");
        if (APPLY) {
          gh([
            "issue",
            "close",
            String(issue.number),
            "--repo",
            repo,
            "--reason",
            "not planned",
            "--comment",
            comment,
          ]);
        }
        record(repo, "stale-close", `#${issue.number} "${issue.title}" — ${verdict.reason}`);
        break;
      }
      case "unstale": {
        if (APPLY) {
          gh([
            "issue",
            "edit",
            String(issue.number),
            "--repo",
            repo,
            "--remove-label",
            STALE_LABEL,
          ]);
        }
        record(repo, "stale-refresh", `#${issue.number} — ${verdict.reason} → remove label`);
        break;
      }
      case "wait-grace":
        record(repo, "stale-wait", `#${issue.number} — ${verdict.reason}`);
        break;
      case "stale-unmanaged":
        record(repo, "stale-unmanaged", `#${issue.number} — ${verdict.reason}`);
        break;
      default:
        break; // skip-* — silent, they are the common case
    }
  }

  // ── Redundancy pass (proposals only) ──────────────────────────────────────
  const clusters = clusterRedundant(issues, {
    threshold: SIM_THRESHOLD,
    minShared: MIN_SHARED,
  });
  for (const cluster of clusters) {
    redundancyClusters.push({ repo, cluster });
    record(
      repo,
      "redundant-propose",
      `candidate duplicates: ${cluster.issues
        .map((i) => `#${i.number} "${i.title}"`)
        .join(" ↔ ")} (max pair score ${Math.max(...cluster.pairs.map((p) => p.score))})`,
    );
  }
}

// ── Report ──────────────────────────────────────────────────────────────────
function buildReportBody() {
  const by = (k) => actions.filter((a) => a.kind === k);
  const lines = [];
  lines.push(
    `Weekly ticket-hygiene report — ${new Date().toISOString().slice(0, 10)} ` +
      `(${APPLY ? "applied" : "dry-run"}; toon-meta#277).`,
    ``,
    `## Proposed duplicates — a human must confirm`,
    ``,
    `These are HEURISTIC candidates (title-token similarity ≥ ${SIM_THRESHOLD},`,
    `≥ ${MIN_SHARED} shared informative tokens). Nothing is closed automatically:`,
    `close the losers yourself, or dismiss a proposal by simply ignoring it —`,
    `the list is regenerated from scratch every week.`,
    ``,
  );
  if (redundancyClusters.length === 0) {
    lines.push(`No duplicate candidates this week.`, ``);
  } else {
    for (const { repo, cluster } of redundancyClusters) {
      lines.push(`### ${repo}`, ``);
      for (const i of cluster.issues) lines.push(`- ${i.url ?? `#${i.number}`} — ${i.title}`);
      lines.push(
        `  - pair scores: ${cluster.pairs.map((p) => `#${p.a}↔#${p.b}=${p.score}`).join(", ")}`,
        ``,
      );
    }
  }
  lines.push(`## Actions ${APPLY ? "taken" : "that WOULD be taken (dry-run)"}`, ``);
  const summarize = (kind, label) => {
    const rows = by(kind);
    if (!rows.length) return;
    lines.push(`### ${label} (${rows.length})`, ``);
    for (const r of rows) lines.push(`- ${r.repo}: ${r.detail}`);
    lines.push(``);
  };
  summarize("stale-mark", "Stale — marked");
  summarize("stale-close", "Stale — closed after grace");
  summarize("stale-refresh", "Stale — label removed (activity)");
  summarize("stale-wait", "Stale — in grace window");
  summarize("stale-unmanaged", "Stale — human-labeled, left alone");
  summarize("obsolete-close-merged-pr", "Obsolete — closed (merged PR evidence)");
  summarize("obsolete-close-remediation", "Obsolete — closed (target PR done)");
  summarize("obsolete-skip-protected", "Obsolete — protected, reported only");
  summarize("obsolete-reopened", "Obsolete — reopened by a human, left alone");
  summarize("obsolete-unverifiable", "Obsolete — unverifiable, left alone");
  lines.push(``, `<!-- ${REPORT_MARKER} -->`);
  return lines.join("\n");
}

function upsertReport(body) {
  const title = "[hygiene] Weekly ticket-hygiene report — duplicates need human review";
  const existing = (
    gh(
      [
        "issue",
        "list",
        "--repo",
        REPORT_REPO,
        "--state",
        "open",
        "--search",
        `"${REPORT_MARKER}" in:body`,
        "--limit",
        "10",
        "--json",
        "number,body",
      ],
      { json: true, allowFail: true },
    ) ?? []
  ).find((i) => (i.body ?? "").includes(REPORT_MARKER));
  if (existing) {
    gh([
      "issue",
      "edit",
      String(existing.number),
      "--repo",
      REPORT_REPO,
      "--body",
      body,
    ]);
    record(REPORT_REPO, "report-update", `updated report issue #${existing.number}`);
  } else {
    const created = gh([
      "issue",
      "create",
      "--repo",
      REPORT_REPO,
      "--title",
      title,
      "--body",
      body,
    ]);
    record(REPORT_REPO, "report-create", `created report issue ${created.trim()}`);
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
console.log(
  `Ticket hygiene — mode=${APPLY ? "APPLY (writing)" : "DRY-RUN (no writes)"}, ` +
    `repos=${REPOS.length} [${REPOS.map((r) => r.split("/")[1]).join(", ")}], ` +
    `stale=${STALE_DAYS}d, grace=${GRACE_DAYS}d, sim≥${SIM_THRESHOLD}/${MIN_SHARED} shared`,
);
if (!process.env.FACTORY_OPS_TOKEN_PRESENT && APPLY) {
  console.log(
    "::warning::FACTORY_OPS_TOKEN not detected — falling back to the ambient " +
      "token. Labeling/closing may still work, but the write identity will not " +
      "be the monitored factory-ops credential (#271).",
  );
}

for (const repo of REPOS) {
  try {
    sweepRepo(repo);
  } catch (err) {
    console.error(`::error::hygiene sweep failed for ${repo}: ${err.message}`);
  }
}

const report = buildReportBody();
if (APPLY) {
  try {
    upsertReport(report);
  } catch (err) {
    console.error(`::error::report upsert failed: ${err.message}`);
  }
}
console.log(`\n───── report body ${APPLY ? "(published)" : "(dry-run preview)"} ─────\n`);
console.log(report);

// ── Summary ─────────────────────────────────────────────────────────────────
const count = (k) => actions.filter((a) => a.kind === k).length;
console.log(
  `\nHygiene complete (${APPLY ? "APPLIED" : "dry-run"}): ` +
    `${count("stale-mark")} marked stale, ${count("stale-close")} stale-closed, ` +
    `${count("stale-refresh")} refreshed, ` +
    `${count("obsolete-close-merged-pr") + count("obsolete-close-remediation")} obsolete-closed, ` +
    `${redundancyClusters.length} duplicate cluster(s) proposed.`,
);
process.exit(0);
