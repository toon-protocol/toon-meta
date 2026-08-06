// Unblock dispatcher (`npm run dispatch:unblocked`). toon-meta#280.
//
// When a ticket closes, work out what it unblocked and start that work — the
// piece that makes the factory AFK once tickets exist. This file is the thin
// I/O shell: gh reads, gh writes (APPLY only), and the report. ALL decision
// logic lives in two pure, unit-tested modules:
//   * unblock-evaluator.mjs (#274) — `## Blocked by` readiness. Never
//     re-implemented here.
//   * dispatch-evaluator.mjs (#280) — epic membership (`Part of` lines),
//     PR→issue attribution, one-in-flight-per-epic serialization, and the
//     never-dispatch exclusions. See its header for the mechanical rules.
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
} from "./dispatch-evaluator.mjs";

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
      gh(["issue", "edit", number, "--repo", repo, "--add-label", IMPLEMENT_LABEL]);
      console.log(`\n[APPLY] dispatched ${a.child.id}: added ${IMPLEMENT_LABEL}`);
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
      gh(["issue", "edit", number, "--repo", repo, "--add-label", HUMAN_LABEL]);
      gh(["issue", "comment", number, "--repo", repo, "--body", comment]);
      console.log(`\n[APPLY] flagged ${a.child.id}: added ${HUMAN_LABEL} + comment`);
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
process.exit(0);
