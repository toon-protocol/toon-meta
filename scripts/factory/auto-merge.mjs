// Auto-merge pass (`npm run automerge:prs`). toon-meta#285, epic #270.
//
// The last manual step in the factory: a green, approved, conflict-free agent
// PR merges itself, which closes its linked issue, which fires the unblock
// dispatcher (#280), which starts the next ticket. This file is the thin I/O
// shell — gh reads, gh writes (APPLY only), and the report. ALL decision logic
// is pure and unit-tested:
//   * automerge-evaluator.mjs — eligibility: the five merge preconditions, the
//     native-auto-merge seam, and the "behind base is an action" rule. Read
//     its header for WHY we do not simply hand every PR to `gh pr merge
//     --auto` (protection cannot express `needs:human`, cannot tell a
//     factory-ops approval from anyone's, and counts a SKIPPED required check
//     as a pass).
//   * pr-signals.mjs — the four-valued check-set verdict and the
//     mergeable-out-of-UNKNOWN settling policy, shared verbatim with
//     pr-housekeeping.mjs (#276) so the two passes can never disagree about
//     whether the same PR is green.
//   * dispatch-evaluator.mjs — prIssueIds(), reused to find each PR's linked
//     issue(s) (close-keyword refs + the `sandcastle/issue-<n>` branch name),
//     because `needs:human` on the ISSUE must also block the merge.
//
// ── WHAT IT READS, PER REPO ─────────────────────────────────────────────────
// The required-check list is read LIVE from GitHub, never from FACTORY.md's
// table: the table has drifted before (it still says relay requires `build`
// while live protection requires `CI OK`), and a stale list here would either
// block every merge or, worse, "verify" a check that no longer gates anything.
// Three sources, unioned:
//   1. classic branch protection (`/branches/{b}/protection`) — needs admin;
//   2. the branches endpoint (`/branches/{b}` → `.protection`) — the same
//      contexts with only push access, so the factory-ops credential can read
//      it even without admin;
//   3. rulesets (`/rules/branches/{b}`) — Forge's `Gate` ruleset lives ONLY
//      here; classic protection 404s on that repo.
// If none of them can be read, the repo is reported `policy-unreadable` and
// nothing merges there — an unreadable policy is never treated as an absent
// one (that is how a rotted credential would otherwise look like "no gate").
//
// ── THE APPROVER IDENTITY RESOLVES ITSELF ───────────────────────────────────
// Which login counts as "the factory-ops approval" is not hardcoded: this pass
// runs as FACTORY_OPS_TOKEN — the SAME credential that submits the #282 review
// — so `gh api user` names it exactly, and a token rotation cannot silently
// desynchronize the two. AUTOMERGE_APPROVERS can add logins (rotation
// overlap). If the token is missing and the run falls back to the ambient App
// token, the resolved identity is the App, which never approves: every PR then
// reports `approval-missing` and nothing merges. That is the intended
// fail-closed shape, and it is loud in the report.
//
// ── SAFETY MODEL ────────────────────────────────────────────────────────────
// * DRY-RUN BY DEFAULT: writes happen only when APPLY=true (org variable
//   AUTOMERGE_APPLY, same convention as HOUSEKEEPING_APPLY / HYGIENE_APPLY /
//   DISPATCH_APPLY). Every run prints the same full decision report either way.
// * READ-ONLY UNTIL PROVEN: the dry-run report names, for every open agent PR,
//   the verdict and every precondition that failed.
// * NEVER `SANDCASTLE_AUTO_MERGE`: that is the *other* mechanism — the agent
//   merging its own branch from inside the sandbox, before CI and review. It
//   stays off (verified: no factory repo's agent-implement.yml sets it). This
//   pass merges through GitHub, after the gate.
// * AUTOMERGE_LIMIT caps how many merges one pass performs (default 5), so a
//   mistake cannot cascade across the fleet in one run.

import { execFileSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

import { settleMergeable } from "./pr-signals.mjs";
import { prIssueIds } from "./dispatch-evaluator.mjs";
import {
  planAutoMerge,
  normalizeLogin,
  DEFAULT_EXCLUDED_REPOS,
  FACTORY_BRANCH_PREFIXES,
} from "./automerge-evaluator.mjs";

// ── Config (env-overridable) ────────────────────────────────────────────────
const ORG = process.env.AUTOMERGE_ORG ?? "toon-protocol";

// The full factory fleet (11 repos) — same set as pr-housekeeping.mjs /
// unblock-dispatcher.mjs / ticket-hygiene.mjs.
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

const REPOS = (process.env.AUTOMERGE_REPOS
  ? process.env.AUTOMERGE_REPOS.split(",").map((s) => s.trim()).filter(Boolean)
  : DEFAULT_REPOS
).map((r) => (r.includes("/") ? r : `${ORG}/${r}`));

const APPLY = process.env.APPLY === "true";
const PR_LIMIT = Number(process.env.AUTOMERGE_PR_LIMIT ?? 200);
const MERGE_LIMIT = Number(process.env.AUTOMERGE_LIMIT ?? 5);
const MERGEABLE_POLL_TRIES = Number(process.env.AUTOMERGE_MERGEABLE_TRIES ?? 8);
const MERGEABLE_POLL_MS = Number(process.env.AUTOMERGE_MERGEABLE_INTERVAL_MS ?? 4000);
const EXTRA_APPROVERS = (process.env.AUTOMERGE_APPROVERS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// ── gh helpers ──────────────────────────────────────────────────────────────
function gh(args, { json = false, allowFail = false } = {}) {
  try {
    const out = execFileSync("gh", args, {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return json ? JSON.parse(out || "null") : out;
  } catch (err) {
    if (allowFail) return json ? null : "";
    throw err;
  }
}

function ghTry(args, { json = false } = {}) {
  try {
    const out = execFileSync("gh", args, {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true, value: json ? JSON.parse(out || "null") : out };
  } catch (err) {
    const stderr = String(err.stderr ?? err.message ?? "").trim().split("\n")[0];
    return { ok: false, error: stderr || "unknown error" };
  }
}

// ── Per-repo policy: the LIVE required checks + merge settings ──────────────
function readRepoPolicy(repo) {
  const meta = gh(["api", `repos/${repo}`], { json: true, allowFail: true });
  const branch = meta?.default_branch ?? "main";
  const contexts = new Set();
  const sources = [];
  let strict = null;
  let readOk = false;
  let readError = "";

  // 1. Classic protection (admin-only, richest: also carries `strict`).
  const prot = ghTry(["api", `repos/${repo}/branches/${branch}/protection`], { json: true });
  if (prot.ok && prot.value) {
    readOk = true;
    for (const c of prot.value.required_status_checks?.contexts ?? []) contexts.add(c);
    if (prot.value.required_status_checks) {
      strict = prot.value.required_status_checks.strict === true;
      sources.push("classic");
    }
  } else if (prot.ok === false && !/not protected/i.test(prot.error)) {
    readError = `classic protection: ${prot.error}`;
  }

  // 2. Branches endpoint — the same contexts with only push access, so the
  //    factory-ops credential works here even without admin.
  if (!readOk || contexts.size === 0) {
    const br = ghTry(["api", `repos/${repo}/branches/${branch}`], { json: true });
    if (br.ok && br.value) {
      readOk = true;
      readError = "";
      const rsc = br.value.protection?.required_status_checks;
      if (br.value.protection?.enabled && rsc) {
        for (const c of rsc.contexts ?? []) contexts.add(c);
        if (rsc.contexts?.length) sources.push("classic(branches)");
      }
    } else if (br.ok === false) {
      readError = readError || `branch read: ${br.error}`;
    }
  }

  // 3. Rulesets — Forge's `Gate` ruleset exists ONLY here.
  const rules = ghTry(["api", `repos/${repo}/rules/branches/${branch}`], { json: true });
  if (rules.ok && Array.isArray(rules.value)) {
    readOk = true;
    for (const r of rules.value) {
      if (r.type !== "required_status_checks") continue;
      for (const c of r.parameters?.required_status_checks ?? []) contexts.add(c.context);
      if (r.parameters?.strict_required_status_checks_policy === true) strict = true;
      sources.push(`ruleset:${r.ruleset_id ?? "?"}`);
    }
  } else if (!readOk) {
    readError = readError || `rules: ${rules.error}`;
  }

  return {
    branch,
    requiredContexts: [...contexts],
    strict,
    source: sources.join("+") || (readOk ? "none" : "unreadable"),
    readError: readOk ? "" : readError || "no protection source could be read",
    autoMergeAllowed: meta?.allow_auto_merge === true,
    mergeMethod:
      process.env.AUTOMERGE_METHOD ??
      (meta?.allow_squash_merge === false ? "merge" : "squash"),
    deleteBranchOnMerge: meta?.delete_branch_on_merge === true,
  };
}

// ── Per-repo PR reads ───────────────────────────────────────────────────────
function readAgentPrs(repo) {
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
        [
          "number",
          "title",
          "url",
          "body",
          "headRefName",
          "headRefOid",
          "baseRefName",
          "isDraft",
          "labels",
          "mergeable",
          "mergeStateStatus",
          "reviewDecision",
          "autoMergeRequest",
          "author",
          "statusCheckRollup",
        ].join(","),
      ],
      { json: true, allowFail: true },
    ) ?? [];
  return prs.filter((p) =>
    FACTORY_BRANCH_PREFIXES.some((pre) => (p.headRefName ?? "").startsWith(pre)),
  );
}

// Reviews come from REST (not gh's `latestReviews`) for two reasons: it is the
// only shape carrying `commit_id`, which is how a stale approval left on an
// older head is detected; and reducing the full chronological list to "the
// latest opinionated review per author" is a decision, so it belongs in the
// pure evaluator, not in a gh flag.
const readReviews = (repo, number) =>
  (
    gh(["api", `repos/${repo}/pulls/${number}/reviews?per_page=100`, "--paginate"], {
      json: true,
      allowFail: true,
    }) ?? []
  ).map((r) => ({
    author: r.user?.login,
    state: r.state,
    commitId: r.commit_id,
    submittedAt: r.submitted_at,
  }));

const issueLabels = (id) => {
  const [repo, number] = id.split("#");
  const data = gh(["api", `repos/${repo}/issues/${number}`], { json: true, allowFail: true });
  if (!data || data.pull_request) return null;
  return { id, labels: (data.labels ?? []).map((l) => l.name), state: data.state };
};

// ── Main ────────────────────────────────────────────────────────────────────
const tag = APPLY ? "APPLY" : "dry-run";
console.log(
  `Auto-merge pass (toon-meta#285) — mode=${APPLY ? "APPLY (merging)" : "DRY-RUN (no writes)"}, ` +
    `repos=${REPOS.length} [${REPOS.map((r) => r.split("/")[1]).join(", ")}], ` +
    `merge cap=${MERGE_LIMIT}/run`,
);

// Resolve the approver identity from the credential this pass runs as — see
// header. `gh api user` fails for a GitHub App installation token, which is
// itself informative: an App run can never match a factory-ops approval.
const tokenLogin = gh(["api", "user", "--jq", ".login"], { allowFail: true }).trim();
const approvers = [...new Set([tokenLogin, ...EXTRA_APPROVERS].filter(Boolean))];
if (!process.env.FACTORY_OPS_TOKEN_PRESENT) {
  console.log(
    "::warning::FACTORY_OPS_TOKEN not detected — running under the ambient " +
      "identity. The approver identity is resolved from the running token, so " +
      "unless that token IS factory-ops, every PR will report approval-missing " +
      "and nothing will merge (fail closed by design, #271).",
  );
}
console.log(
  `Approver identity: ${approvers.length ? approvers.join(", ") : "(none resolved)"}` +
    ` — only an APPROVED review from this identity satisfies the #275/#282 verdict.`,
);

// Repo policies (live protection + merge settings).
const repoPolicies = {};
for (const repo of REPOS) {
  const p = readRepoPolicy(repo);
  repoPolicies[repo.toLowerCase()] = p;
  const excluded = DEFAULT_EXCLUDED_REPOS[repo.toLowerCase()];
  console.log(
    `  ${repo}: required=[${p.requiredContexts.join(", ") || "∅"}] ` +
      `strict=${p.strict ?? "?"} source=${p.source} ` +
      `nativeAutoMerge=${p.autoMergeAllowed ? "on" : "OFF"} method=${p.mergeMethod}` +
      (p.readError ? ` READ-ERROR(${p.readError})` : "") +
      (excluded ? ` EXCLUDED(${excluded})` : ""),
  );
}

// PRs + their per-PR reads.
const prs = [];
for (const repo of REPOS) {
  for (const pr of readAgentPrs(repo)) {
    // Settle mergeability BEFORE judging: GitHub computes it asynchronously
    // and reports UNKNOWN for seconds after any merge. Polling is both the
    // read and the nudge (pr-signals.settleMergeable, shared with #276).
    const mergeable = await settleMergeable({
      initial: pr.mergeable,
      refetch: () =>
        gh(["pr", "view", String(pr.number), "--repo", repo, "--json", "mergeable"], {
          json: true,
          allowFail: true,
        })?.mergeable,
      sleep: (ms) => sleep(ms),
      tries: MERGEABLE_POLL_TRIES,
      intervalMs: MERGEABLE_POLL_MS,
    });
    const linkedIssues = prIssueIds({ ...pr, repo })
      .map(issueLabels)
      .filter(Boolean);
    prs.push({
      repo,
      number: pr.number,
      title: pr.title,
      url: pr.url,
      headRefName: pr.headRefName,
      headSha: pr.headRefOid,
      isDraft: pr.isDraft,
      labels: (pr.labels ?? []).map((l) => l.name),
      mergeable,
      mergeStateStatus: pr.mergeStateStatus,
      reviewDecision: pr.reviewDecision,
      reviews: readReviews(repo, pr.number),
      statusCheckRollup: pr.statusCheckRollup,
      autoMergeEnabled: pr.autoMergeRequest != null,
      author: pr.author?.login,
      linkedIssues,
    });
  }
}
console.log(`\nFleet scan: ${prs.length} open agent PR(s).`);

const plan = planAutoMerge({ prs, repoPolicies, approvers });

// ── Report ──────────────────────────────────────────────────────────────────
for (const d of plan.decisions) {
  console.log(`\n━━ ${d.id} — "${d.title ?? ""}"`);
  console.log(`   ${d.url ?? ""}`);
  console.log(
    `   verdict: ${d.verdict.toUpperCase()} · checks=${d.signals.checks} ` +
      `mergeable=${d.signals.mergeable} state=${d.signals.mergeState} ` +
      `approvedBy=[${d.signals.approvedBy.join(", ") || "∅"}]`,
  );
  console.log(
    `   required (${d.signals.requiredSource}): ` +
      (d.signals.requiredChecks.length
        ? d.signals.requiredChecks
            .map((c) => `${c.context}=${c.state}(${c.status})`)
            .join(", ")
        : "∅"),
  );
  for (const b of d.blockers) console.log(`   ✗ ${b.code}: ${b.detail}`);
  if (d.action) console.log(`   [${tag}] → ${d.action.type}: ${d.action.reason}`);
}

// ── Writes (APPLY only) ─────────────────────────────────────────────────────
let merged = 0;
let armed = 0;
let updated = 0;
let failed = 0;
for (const a of plan.actions) {
  const repo = a.repo;
  const n = String(a.number);
  if (a.type === "update-branch") {
    if (APPLY) {
      // REST, not `gh pr update-branch`: that subcommand only exists in gh
      // >= 2.51, and the pass must not depend on the runner image's CLI
      // version. `expected_head_sha` makes the update a no-op if the head
      // moved since we judged it.
      const r = ghTry([
        "api",
        "--method",
        "PUT",
        `repos/${repo}/pulls/${n}/update-branch`,
        ...(a.headSha ? ["-f", `expected_head_sha=${a.headSha}`] : []),
      ]);
      if (!r.ok) {
        console.log(`::warning::${repo}#${n} update-branch failed: ${r.error}`);
        failed++;
        continue;
      }
      console.log(`[APPLY] ${repo}#${n}: branch updated from base — CI re-runs, next pass merges`);
    }
    updated++;
    continue;
  }
  if (merged + armed >= MERGE_LIMIT) {
    console.log(
      `[${tag}] ${repo}#${n}: merge cap (${MERGE_LIMIT}/run) reached — deferred to the next pass`,
    );
    continue;
  }
  const args =
    a.type === "enable-auto-merge"
      ? ["pr", "merge", n, "--repo", repo, "--auto", `--${a.method}`]
      : ["pr", "merge", n, "--repo", repo, `--${a.method}`];
  if (APPLY) {
    const r = ghTry(args);
    if (!r.ok) {
      // GitHub refusing the merge IS the outer gate doing its job — report it,
      // never retry around it.
      console.log(`::warning::${repo}#${n} ${a.type} refused by GitHub: ${r.error}`);
      failed++;
      continue;
    }
    console.log(`[APPLY] ${repo}#${n}: ${a.type} (${a.method}) — ok`);
  }
  if (a.type === "enable-auto-merge") armed++;
  else merged++;
}

// ── Markdown summary (paste-able into a PR body / job summary) ──────────────
console.log(`\n## Auto-merge dry-run report (${APPLY ? "APPLIED" : "no writes"})\n`);
console.log("| PR | verdict | required checks | mergeable / state | blocked on |");
console.log("|----|---------|-----------------|-------------------|------------|");
for (const d of plan.decisions) {
  const req =
    d.signals.requiredChecks.map((c) => `\`${c.context}\`=${c.state}`).join("<br>") || "∅";
  const blocked = d.blockers.map((b) => `\`${b.code}\``).join(", ") || "—";
  console.log(
    `| [${d.id}](${d.url}) | **${d.verdict}** | ${req} | ` +
      `${d.signals.mergeable} / ${d.signals.mergeState} | ${blocked} |`,
  );
}

const s = plan.summary;
console.log(
  `\nAuto-merge pass complete (${APPLY ? "APPLIED" : "dry-run"}): ` +
    `${s.merge ?? 0} eligible to merge (${merged} merged, ${armed} armed), ` +
    `${s["update-branch"] ?? 0} behind base (${updated} updated), ` +
    `${s["already-armed"] ?? 0} already armed, ${s.blocked ?? 0} blocked, ` +
    `${failed} action(s) refused by GitHub.`,
);
process.exit(0);
