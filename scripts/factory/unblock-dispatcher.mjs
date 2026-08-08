// Unblock dispatcher (`npm run dispatch:unblocked`). toon-meta#280.
//
// When a ticket closes, work out what it unblocked and start that work — the
// piece that makes the factory AFK once tickets exist. This file is the thin
// I/O shell: gh reads, gh writes (APPLY only), and the report. ALL decision
// logic lives in three pure, unit-tested modules:
//   * unblock-evaluator.mjs (#274) — `## Blocked by` readiness. Never
//     re-implemented here.
//   * dispatch-evaluator.mjs (#280) — epic membership (`Part of` lines),
//     PR→issue attribution, one-in-flight-per-epic serialization, and the
//     never-dispatch exclusions. See its header for the mechanical rules.
//   * completion-evaluator.mjs (#284) — the epic completion pass that runs
//     AFTER the dispatch pass, below: close an epic when every child closed
//     as completed; escalate (comment + needs:human) when scope was dropped.
//
// ── EVERY PASS IS A FULL-FLEET PASS (why the cron is equivalent) ────────────
// The dependency graph is cross-repo (a relay close can release a toon-meta
// dependent), so a pass never tries to slice the graph around the event that
// triggered it: whatever the trigger, it re-reads the whole fleet and
// recomputes the plan from scratch. The triggering event (DISPATCH_TRIGGER /
// DISPATCH_SOURCE) is logged for forensics but NEVER changes the outcome —
// which is exactly what makes the low-frequency safety cron a full recovery
// path for dropped events: a cron tick reaches the same conclusions an event
// pass would have.
//
// ── WRITES (APPLY=true only; dry-run prints the identical plan) ─────────────
// * dispatch  → `gh issue edit --add-label agent:implement`. The dispatcher
//   only ever labels EXISTING issues — the form that fires `issues.labeled`
//   and hence agent-implement.yml. (Labels attached at issue CREATION emit
//   only `opened`, which the runner never sees — the create-then-label
//   sequencing rule from #276/#277 kept here by construction.)
// * needs-human → `needs:human` label + a comment naming the offending
//   bullet/blocker, idempotent via a hidden marker (an issue already carrying
//   needs:human is excluded upstream, and a marker comment is never repeated).
//
// The write identity must be FACTORY_OPS_TOKEN (#271): agent-implement.yml's
// Guard 1 refuses labelers without write access, and #281 explicitly lets the
// factory-ops identity through. A plain App/bot token fails that guard.
//
// ── STATE READS ─────────────────────────────────────────────────────────────
// Blocker states come from the REST API (`gh api repos/…/issues/N`) because
// `gh issue view --json` exposes no stateReason field, and only
// closed-as-COMPLETED satisfies a dependency (#274). An unfetchable blocker
// stays unknown and fails closed to needs-human in the evaluator.
//
// ── WRITE FAILURE ISOLATION (toon-meta#320) ─────────────────────────────────
// The first live run aborted the whole pass on ONE failed `gh issue edit`
// (buzz had no `needs:human` label yet) — every remaining action, in every
// other repo, silently never ran. Every write in this file (dispatch pass and
// completion pass alike) now goes through write-report.mjs's `runWrite`,
// which catches the error, records it, and lets the loop continue to the next
// action. A preflight up front checks that both trigger labels
// (agent:implement, needs:human) exist in every fleet repo and reports the
// gap explicitly — that class of failure is config drift, not a per-issue
// error. The run still exits non-zero at the end iff any write failed, so
// failures stay visible without being fatal to the rest of the fleet.

import { execFileSync } from "node:child_process";
import {
  planDispatch,
  prIssueIds,
  collectBlockerIds,
  needsHumanMarker,
  parseEpicRefs,
  FACTORY_BRANCH_PREFIXES,
  IMPLEMENT_LABEL,
  HUMAN_LABEL,
  EPIC_LABEL,
} from "./dispatch-evaluator.mjs";
import {
  planCompletion,
  buildCompletionComment,
  buildEscalationComment,
  escalationMarker,
} from "./completion-evaluator.mjs";
import {
  createWriteReport,
  runWrite,
  hasFailures,
  formatFailedSection,
  planLabelPreflight,
} from "./write-report.mjs";

// ── Config (env-overridable) ────────────────────────────────────────────────
const ORG = process.env.DISPATCH_ORG ?? "toon-protocol";

// The full factory fleet (11 repos) — same set as pr-housekeeping.mjs /
// ticket-hygiene.mjs.
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

const REPOS = (process.env.DISPATCH_REPOS
  ? process.env.DISPATCH_REPOS.split(",").map((s) => s.trim()).filter(Boolean)
  : DEFAULT_REPOS
).map((r) => (r.includes("/") ? r : `${ORG}/${r}`));

const APPLY = process.env.APPLY === "true";
const ISSUE_LIMIT = Number(process.env.DISPATCH_ISSUE_LIMIT ?? 300);
const PR_LIMIT = Number(process.env.DISPATCH_PR_LIMIT ?? 200);
// Informational only — see header: the plan never depends on these.
const TRIGGER = process.env.DISPATCH_TRIGGER ?? "local";
const SOURCE = process.env.DISPATCH_SOURCE ?? "";

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

// REST read of one issue (state + state_reason + body). Returns null when the
// number does not exist, is inaccessible, or is actually a pull request —
// callers treat null as "unknown", which fails closed.
function fetchIssueRest(id) {
  const [repo, number] = id.split("#");
  const data = gh(["api", `repos/${repo}/issues/${number}`], { json: true, allowFail: true });
  if (!data || data.pull_request) return null;
  return { state: data.state, stateReason: data.state_reason ?? undefined, body: data.body ?? "" };
}

const fetchComments = (repo, number) =>
  gh(["issue", "view", String(number), "--repo", repo, "--json", "comments"], {
    json: true,
    allowFail: true,
  })?.comments ?? [];

// ── Fleet reads ─────────────────────────────────────────────────────────────
function readFleet() {
  const openIssues = [];
  const agentPrs = [];
  for (const repo of REPOS) {
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
          "number,title,labels,body,url",
        ],
        { json: true, allowFail: true },
      ) ?? [];
    for (const i of issues) {
      openIssues.push({ ...i, repo, labels: (i.labels ?? []).map((l) => l.name) });
    }
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
    for (const p of prs) {
      if (FACTORY_BRANCH_PREFIXES.some((pre) => (p.headRefName ?? "").startsWith(pre))) {
        agentPrs.push({ ...p, repo });
      }
    }
  }
  return { openIssues, agentPrs };
}

// ── Main ────────────────────────────────────────────────────────────────────
console.log(
  `Unblock dispatcher — mode=${APPLY ? "APPLY (writing)" : "DRY-RUN (no writes)"}, ` +
    `trigger=${TRIGGER}${SOURCE ? ` source=${SOURCE}` : ""} (informational — every ` +
    `pass re-evaluates the full fleet graph), ` +
    `repos=${REPOS.length} [${REPOS.map((r) => r.split("/")[1]).join(", ")}]`,
);
if (!process.env.FACTORY_OPS_TOKEN_PRESENT && APPLY) {
  console.log(
    "::warning::FACTORY_OPS_TOKEN not detected — falling back to the ambient " +
      "token. agent-implement.yml's Guard 1 refuses labelers without write " +
      "access, so a dispatch under the wrong identity is silently ignored " +
      "by the runner (#271/#281).",
  );
}

// ── Preflight: trigger labels must exist in every fleet repo ────────────────
// A missing label is config drift, not a per-issue error (buzz and Forge had
// no `needs:human` label on the first live run, which is what crashed the
// whole pass — toon-meta#320): report it explicitly, up front, instead of
// letting it surface as N identically-shaped failed writes deep in the run.
function fetchRepoLabels(repo) {
  const data = gh(["label", "list", "--repo", repo, "--json", "name", "--limit", "200"], {
    json: true,
    allowFail: true,
  });
  return (data ?? []).map((l) => l.name);
}

const labelsByRepo = {};
for (const repo of REPOS) labelsByRepo[repo] = fetchRepoLabels(repo);
const missingLabels = planLabelPreflight({
  repos: REPOS,
  requiredLabels: [IMPLEMENT_LABEL, HUMAN_LABEL],
  labelsByRepo,
});
if (Object.keys(missingLabels).length) {
  console.log(`\n::warning::Preflight — trigger label(s) missing (config drift, not a per-issue failure):`);
  for (const [repo, labels] of Object.entries(missingLabels)) {
    console.log(`   ${repo}: missing ${labels.join(", ")}`);
  }
} else {
  console.log(
    `Preflight: trigger labels (${IMPLEMENT_LABEL}, ${HUMAN_LABEL}) present in all ${REPOS.length} repo(s).`,
  );
}

const report = createWriteReport();

const { openIssues, agentPrs } = readFleet();
const openIds = new Set(openIssues.map((i) => `${i.repo.toLowerCase()}#${i.number}`));
console.log(`Fleet scan: ${openIssues.length} open issue(s), ${agentPrs.length} open agent PR(s).`);

// Bodies of agent-PR-linked issues that are NOT open (already closed) — needed
// so an open PR for a just-closed child still serializes its epic.
const prLinkedBodies = {};
for (const pr of agentPrs) {
  for (const id of prIssueIds(pr)) {
    if (openIds.has(id) || id in prLinkedBodies) continue;
    const iss = fetchIssueRest(id);
    if (iss) prLinkedBodies[id] = { body: iss.body };
  }
}

// Blocker states for every candidate child's clean edges. Children are the
// open issues declaring membership of an open epic — cheaply over-approximated
// here by "has any Part of line"; the evaluator re-derives exact membership.
const candidates = openIssues.filter((i) => parseEpicRefs(i.body, i.repo).length > 0);
const blockerStates = {};
for (const id of collectBlockerIds(candidates)) {
  if (openIds.has(id)) continue; // known open — evaluator fills these in
  const iss = fetchIssueRest(id);
  if (iss) blockerStates[id] = { state: iss.state, stateReason: iss.stateReason };
  // absent → unknown → fails closed to needs-human in the evaluator
}
console.log(
  `Attribution: ${Object.keys(prLinkedBodies).length} closed PR-linked issue(s) fetched, ` +
    `${Object.keys(blockerStates).length} external blocker state(s) fetched.`,
);

const plan = planDispatch({ openIssues, agentPrs, prLinkedBodies, blockerStates, fleetRepos: REPOS });

// ── Report + writes ─────────────────────────────────────────────────────────
const tag = APPLY ? "APPLY" : "dry-run";
const counts = {};
const bump = (k) => (counts[k] = (counts[k] ?? 0) + 1);

for (const epic of plan.epics) {
  console.log(`\n━━ epic ${epic.id} — "${epic.title}" (${epic.openChildren} open child(ren))`);
  if (epic.busyWith.length) {
    for (const b of epic.busyWith) console.log(`   busy: ${b}`);
  }
  if (epic.stalled) console.log(`   STALLED: no work in flight and no ready child`);
  for (const a of plan.actions.filter((x) => x.epicIds.includes(epic.id))) {
    // A multi-epic child prints under each of its epics; counted once below.
    console.log(`   [${tag}] ${a.type} · ${a.child.id} "${a.child.title ?? ""}"`);
    for (const r of a.reasons) console.log(`       - ${r}`);
  }
}
if (plan.cycles.length) {
  console.log(`\nDependency cycles detected (members are never dispatched):`);
  for (const c of plan.cycles) console.log(`   ${c.join(" → ")}`);
}

for (const a of plan.actions) {
  bump(a.type);
  const [repo] = a.child.id.split("#");
  const number = String(a.child.number);
  if (a.type === "dispatch") {
    if (APPLY) {
      // Labeling an EXISTING issue is what fires `issues.labeled` → the
      // agent-implement runner. See header (create-then-label rule).
      const ok = runWrite(report, { type: "dispatch", target: a.child.id }, () => {
        gh(["issue", "edit", number, "--repo", repo, "--add-label", IMPLEMENT_LABEL]);
      });
      if (ok) {
        console.log(`\n[APPLY] dispatched ${a.child.id}: added ${IMPLEMENT_LABEL}`);
      } else {
        console.log(`\n[APPLY] FAILED to dispatch ${a.child.id} — continuing (see failed writes below)`);
      }
    }
  } else if (a.type === "needs-human") {
    const marker = needsHumanMarker(repo, a.child.number);
    const already = fetchComments(repo, a.child.number).some((c) =>
      (c.body ?? "").includes(marker),
    );
    if (already) {
      console.log(`\n[${tag}] ${a.child.id} already flagged needs-human (marker found) — skipping`);
      bump("needs-human-already");
      continue;
    }
    const comment = [
      `The unblock dispatcher (toon-meta#280) cannot mechanically release this ticket:`,
      ``,
      ...a.reasons.map((r) => `- ${r}`),
      ``,
      `Routing to \`${HUMAN_LABEL}\` instead of dispatching. To release it: make every`,
      `\`## Blocked by\` bullet a single clean issue reference (or declare \`None\`),`,
      `resolve the flagged blocker decision, then remove the \`${HUMAN_LABEL}\` label.`,
      ``,
      `<!-- ${marker} -->`,
    ].join("\n");
    if (APPLY) {
      const ok = runWrite(report, { type: "needs-human", target: a.child.id }, () => {
        gh(["issue", "edit", number, "--repo", repo, "--add-label", HUMAN_LABEL]);
        gh(["issue", "comment", number, "--repo", repo, "--body", comment]);
      });
      if (ok) {
        console.log(`\n[APPLY] flagged ${a.child.id}: added ${HUMAN_LABEL} + comment`);
      } else {
        console.log(`\n[APPLY] FAILED to flag ${a.child.id} — continuing (see failed writes below)`);
      }
    }
  }
}

// ── Summary ─────────────────────────────────────────────────────────────────
const n = (k) => counts[k] ?? 0;
console.log(
  `\nDispatch pass complete (${APPLY ? "APPLIED" : "dry-run"}): ` +
    `${n("dispatch")} dispatched, ${n("queue")} queued (serialization), ` +
    `${n("blocked")} waiting on open blockers, ` +
    `${n("needs-human")} routed to ${HUMAN_LABEL} ` +
    `(${n("needs-human-already")} of them already flagged), ` +
    `${n("in-flight-pr") + n("in-flight-label")} already in flight, ` +
    `${n("excluded")} excluded by label, ${n("outside-fleet")} outside the fleet; ` +
    `${plan.epics.filter((e) => e.stalled).length} stalled epic(s).`,
);

// ═══ Epic completion pass (toon-meta#284) — runs AFTER each dispatch pass ═══
//
// Close an epic when its work is done; surface dropped scope instead of
// burying it. Decision logic is pure (completion-evaluator.mjs — verdicts,
// fail-closed rules, comment text); this shell only:
//   * discovers CANDIDATE children via each epic's cross-reference timeline
//     (the dispatch pass only sees OPEN issues; completion needs the CLOSED
//     children, and any issue whose body says `Part of <epic>` left a
//     cross-referenced event on the epic's timeline). Membership itself is
//     still decided by parseEpicRefs on the candidate's body — a timeline
//     mention without a `Part of` line never binds;
//   * backfills unverifiable stateReasons via REST (fail closed otherwise);
//   * fetches each completed child's closing PR(s) via GraphQL
//     closedByPullRequestsReferences, for the summary comment;
//   * writes (close / needs:human + comment) under the SAME APPLY knob
//     (org var DISPATCH_APPLY); dry-run prints the identical plan.

function fetchTimelineCandidates(repo, number) {
  // One compact JSON object per line (NDJSON across --paginate pages).
  const jq =
    '.[] | select(.event=="cross-referenced" and .source.issue != null and (.source.issue.pull_request == null)) | ' +
    "{repo: .source.issue.repository.full_name, number: .source.issue.number, " +
    "title: .source.issue.title, url: .source.issue.html_url, state: .source.issue.state, " +
    "stateReason: .source.issue.state_reason, body: .source.issue.body, " +
    "labels: [.source.issue.labels[].name]}";
  const out = gh(
    ["api", `repos/${repo}/issues/${number}/timeline?per_page=100`, "--paginate", "--jq", jq],
    { allowFail: true },
  );
  if (!out) return [];
  const rows = [];
  for (const line of out.split("\n")) {
    if (!line.trim()) continue;
    try {
      rows.push(JSON.parse(line));
    } catch {
      /* partial line on a failed page — skip, fail closed */
    }
  }
  return rows;
}

function fetchClosingPrs(repo, number) {
  const [owner, name] = repo.split("/");
  const data = gh(
    [
      "api",
      "graphql",
      "-f",
      "query=query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){issue(number:$number){closedByPullRequestsReferences(first:10,includeClosedPrs:true){nodes{url number}}}}}",
      "-F",
      `owner=${owner}`,
      "-F",
      `name=${name}`,
      "-F",
      `number=${number}`,
    ],
    { json: true, allowFail: true },
  );
  return data?.data?.repository?.issue?.closedByPullRequestsReferences?.nodes ?? [];
}

console.log(`\n━━━ Epic completion pass (toon-meta#284) — mode=${tag} ━━━`);

const epicIssues = openIssues.filter((i) => (i.labels ?? []).includes(EPIC_LABEL));
const candidateMap = new Map(); // canonical id → candidate
// (a) Timeline cross-references — the only way to reach CLOSED children.
for (const epic of epicIssues) {
  for (const c of fetchTimelineCandidates(epic.repo, epic.number)) {
    const id = `${String(c.repo).toLowerCase()}#${c.number}`;
    if (!candidateMap.has(id)) candidateMap.set(id, c);
  }
}
// (b) The open-issue scan (already in hand) — belt and braces if a timeline
// read failed; an open child missing from the tally could wrongly close an
// epic, so open issues always participate.
for (const i of openIssues) {
  const id = `${i.repo.toLowerCase()}#${i.number}`;
  if (!candidateMap.has(id)) candidateMap.set(id, { ...i, state: "open", stateReason: null });
}
// (c) Backfill closed candidates whose stateReason the timeline omitted —
// without a verifiable reason the evaluator fails closed to "unknown".
let backfilled = 0;
for (const c of candidateMap.values()) {
  if (String(c.state).toLowerCase() === "closed" && c.stateReason == null) {
    const iss = fetchIssueRest(`${String(c.repo).toLowerCase()}#${c.number}`);
    if (iss) {
      c.stateReason = iss.stateReason ?? null;
      backfilled++;
    }
  }
}
console.log(
  `Candidate scan: ${epicIssues.length} open epic(s), ${candidateMap.size} candidate ` +
    `issue(s) (timeline + open scan), ${backfilled} stateReason backfill(s).`,
);

const completion = planCompletion({ epics: epicIssues, candidates: [...candidateMap.values()] });

for (const e of completion.epics) {
  const t = e.tally;
  console.log(`\n━━ epic ${e.id} — "${e.title ?? ""}" — completion verdict: ${e.verdict}`);
  console.log(
    `   children: ${t.completed.length} completed, ${t.open.length} open, ` +
      `${t.notPlanned.length} not planned, ${t.unknown.length} unverifiable`,
  );
  if (t.open.length) console.log(`   open: ${t.open.map((c) => c.id).join(", ")}`);
  if (t.notPlanned.length)
    console.log(`   not planned: ${t.notPlanned.map((c) => c.id).join(", ")}`);
  if (t.unknown.length) console.log(`   unverifiable: ${t.unknown.map((c) => c.id).join(", ")}`);
  for (const r of e.reasons) console.log(`   - ${r}`);
}

let epicsClosed = 0;
let epicsEscalated = 0;
let escalationsAlready = 0;
for (const a of completion.actions) {
  const { repo, number } = a.epic;
  if (a.type === "close-epic") {
    const childPrs = {};
    for (const ch of a.completed) {
      const [chRepo, chNumber] = ch.id.split("#");
      childPrs[ch.id] = fetchClosingPrs(chRepo, Number(chNumber));
    }
    const comment = buildCompletionComment({ epic: a.epic, completed: a.completed, childPrs });
    if (APPLY) {
      const ok = runWrite(report, { type: "close-epic", target: a.epic.id }, () => {
        gh([
          "issue",
          "close",
          String(number),
          "--repo",
          repo,
          "--reason",
          "completed",
          "--comment",
          comment,
        ]);
      });
      if (ok) {
        console.log(`\n[APPLY] closed epic ${a.epic.id} (completed) with summary comment`);
      } else {
        console.log(`\n[APPLY] FAILED to close epic ${a.epic.id} — continuing (see failed writes below)`);
      }
    } else {
      console.log(`\n[dry-run] would CLOSE epic ${a.epic.id} with comment:`);
      for (const line of comment.split("\n")) console.log(`   | ${line}`);
    }
    epicsClosed++;
  } else if (a.type === "escalate-epic") {
    const marker = escalationMarker(repo, number);
    const already = fetchComments(repo, number).some((c) => (c.body ?? "").includes(marker));
    if (already) {
      console.log(`\n[${tag}] epic ${a.epic.id} already escalated (marker found) — skipping`);
      escalationsAlready++;
      continue;
    }
    const comment = buildEscalationComment({ epic: a.epic, tally: a.tally, marker });
    if (APPLY) {
      const ok = runWrite(report, { type: "escalate-epic", target: a.epic.id }, () => {
        gh(["issue", "edit", String(number), "--repo", repo, "--add-label", HUMAN_LABEL]);
        gh(["issue", "comment", String(number), "--repo", repo, "--body", comment]);
      });
      if (ok) {
        console.log(`\n[APPLY] escalated epic ${a.epic.id}: added ${HUMAN_LABEL} + comment`);
      } else {
        console.log(`\n[APPLY] FAILED to escalate epic ${a.epic.id} — continuing (see failed writes below)`);
      }
    } else {
      console.log(`\n[dry-run] would ESCALATE epic ${a.epic.id} (${HUMAN_LABEL}) with comment:`);
      for (const line of comment.split("\n")) console.log(`   | ${line}`);
    }
    epicsEscalated++;
  }
}

const byVerdict = {};
for (const e of completion.epics) byVerdict[e.verdict] = (byVerdict[e.verdict] ?? 0) + 1;
console.log(
  `\nCompletion pass complete (${APPLY ? "APPLIED" : "dry-run"}): ` +
    `${completion.epics.length} epic(s) examined — ` +
    `${byVerdict["complete"] ?? 0} completable (${epicsClosed} close action(s)), ` +
    `${byVerdict["escalate"] ?? 0} escalatable (${epicsEscalated} new, ${escalationsAlready} already flagged), ` +
    `${byVerdict["held"] ?? 0} held by ${HUMAN_LABEL}, ` +
    `${byVerdict["incomplete"] ?? 0} incomplete, ` +
    `${byVerdict["no-children"] ?? 0} with no children.`,
);

// ── Failed writes (toon-meta#320) ───────────────────────────────────────────
// A failed write is recorded and the pass continues (see write-report.mjs);
// it must still make the run visibly red at the end, so the exit code is
// non-zero iff at least one write failed this pass — never on a read failure
// or an empty plan.
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
