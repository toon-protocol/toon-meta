// Dispatch evaluator (toon-meta#280, epic #270).
//
// The pure decision half of the unblock dispatcher: given the fleet's open
// issues, its open agent PRs, and the states of every referenced blocker,
// decide EXACTLY which tickets get `agent:implement` this pass, which are
// queued, and which are routed to a human. No GitHub reads or writes here —
// the I/O shell is scripts/factory/unblock-dispatcher.mjs. Readiness rules
// are NOT re-implemented: they are imported from unblock-evaluator.mjs
// (toon-meta#274), which is the single authority on `## Blocked by` parsing.
//
// ── EPIC MEMBERSHIP — THE MECHANICAL RULE ───────────────────────────────────
// * An EPIC is any open issue carrying the `epic` label.
// * A ticket is a CHILD of an epic iff its body contains a line that STARTS
//   with `Part of <issue-ref>` (case-insensitive; an optional list marker or
//   `**` bold prefix is allowed; trailing prose after the ref is ignored).
//   Bare `#N` and `repo#N` refs resolve against the ticket's own repo, so
//   `Part of #270` in toon-meta and `Part of toon-protocol/toon-meta#265` in
//   connector both work. This is the live convention on every current epic
//   (#262, #265, #270); GitHub-native sub-issues are NOT used
//   (`subIssues.totalCount == 0` on these epics) and are not consulted.
// * A ticket may declare several `Part of` lines. It is then a member of ALL
//   of them, and is dispatched only when NONE of them has an in-flight PR
//   (fail closed on ambiguity).
// * `Part of` lines pointing at something that is not an open `epic`-labeled
//   issue (a PR, a closed epic, a plain issue) simply do not bind.
//
// ── SERIALIZATION — ONE IN-FLIGHT AGENT PR PER EPIC ─────────────────────────
// Epics run in parallel with each other; WITHIN an epic at most one agent PR
// (`sandcastle/*` or `agent/*` head branch) is in flight. An epic counts BUSY
// when any open agent PR maps to one of its children (via close-keyword refs
// or the `sandcastle/issue-<n>` branch name — the PR's linked issue may
// already be closed, so the shell supplies those bodies too), or when a child
// already carries `agent:implement` (a runner may be mid-run before its PR
// exists). Ready children of a busy epic are QUEUED and re-tried next pass.
// Among several ready children, the pick is DETERMINISTIC (lowest canonical
// id): two racing passes over the same state converge on the same child, and
// `gh issue edit --add-label` of an already-present label is a no-op that
// fires no `issues.labeled` event — so a race cannot double-dispatch.
//
// ── NEVER DISPATCHED ────────────────────────────────────────────────────────
// * anything labeled `epic`, `tracking`, or `needs:human`;
// * anything with an already-open agent PR or already carrying
//   `agent:implement`;
// * unresolvable blockers, not-planned blockers, unknown blocker states, and
//   dependency-cycle members → verdict "needs-human" (comment + label, in the
//   shell), exactly as isReady rules — never dispatch;
// * children living outside the factory fleet (no runner there to fire).
//
// ── EXPORTED API ────────────────────────────────────────────────────────────
//   parseEpicRefs(body, selfRepo)   → canonical epic ids from `Part of` lines
//   prIssueIds(pr)                  → canonical issue ids an agent PR addresses
//   collectBlockerIds(issues)       → unique canonical blocker ids to fetch
//   planDispatch(input)             → the full pass plan (see JSDoc)
//   needsHumanMarker(repo, number)  → hidden idempotency marker string
//
// Plain Node ESM, zero dependencies. Tests: dispatch-evaluator.test.mjs
// (node --test).

import { parseBlockedBy, resolveRef, isReady, detectCycles } from "./unblock-evaluator.mjs";

// ── Shared vocabulary ───────────────────────────────────────────────────────
export const IMPLEMENT_LABEL = "agent:implement";
export const HUMAN_LABEL = "needs:human";
export const EPIC_LABEL = "epic";
// Labels that make an issue ineligible for dispatch, ever.
export const EXCLUDED_LABELS = new Set([EPIC_LABEL, "tracking", HUMAN_LABEL]);
// Agent PR head-branch prefixes — same set as pr-housekeeping.mjs.
export const FACTORY_BRANCH_PREFIXES = ["sandcastle/", "agent/"];

// Hidden marker embedded in every needs:human comment the dispatcher writes,
// so the flagging is idempotent across passes (same convention as
// pr-housekeeping's stuck markers: slash/hash-free for issue search, exact
// string re-checked client-side).
const sanitize = (repo) => repo.replace(/[^a-zA-Z0-9]+/g, "-");
export const needsHumanMarker = (repo, number) =>
  `unblock-dispatcher-needs-human:${sanitize(repo)}-issue-${number}`;

// ── Epic membership parsing ─────────────────────────────────────────────────

// A `Part of <ref>` declaration line. Anchored to the line start (optional
// list marker / bold) so prose like "this is part of the plan" never binds.
// The ref fragment mirrors unblock-evaluator's CLEAN_BULLET_RE.
const EPIC_REF_LINE_RE =
  /^\s{0,3}(?:[-*+]\s+)?(?:\*\*)?part\s+of\s+(?:(?:(?<owner>[A-Za-z\d](?:[A-Za-z\d-]*[A-Za-z\d])?)\/)?(?<repo>[A-Za-z\d._-]+))?#(?<number>\d+)/i;

/**
 * Extract the canonical epic ids an issue declares membership of.
 *
 * @param {string|null|undefined} body - full issue body (markdown).
 * @param {string} selfRepo - the issue's own repo as "owner/name" (bare `#N`
 *   and `repo#N` refs resolve against it, via unblock-evaluator's resolveRef).
 * @returns {string[]} canonical ids, e.g. ["toon-protocol/toon-meta#270"],
 *   deduplicated, in declaration order. Empty when no `Part of` line exists.
 */
export function parseEpicRefs(body, selfRepo) {
  const out = [];
  for (const line of String(body ?? "").split(/\r?\n/)) {
    const m = EPIC_REF_LINE_RE.exec(line);
    if (!m) continue;
    const id = resolveRef(
      {
        owner: m.groups.owner ?? null,
        repo: m.groups.repo ?? null,
        number: Number(m.groups.number),
      },
      selfRepo,
    );
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

// ── PR → issue attribution ──────────────────────────────────────────────────

// `sandcastle/issue-123` / `agent/issue-123` → issue 123 in the PR's own repo.
const BRANCH_ISSUE_RE = /^(?:sandcastle|agent)\/issue-(\d+)/;
// Close-keyword refs, cross-repo capable (`Closes #5`, `fixes relay#74`,
// `resolves toon-protocol/toon-meta#280`).
const CLOSE_REF_RE =
  /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\b[:\s]+(?:(?:(?<owner>[A-Za-z\d](?:[A-Za-z\d-]*[A-Za-z\d])?)\/)?(?<repo>[A-Za-z\d._-]+))?#(?<number>\d+)/gi;

/**
 * Canonical ids of the issue(s) an agent PR addresses: the
 * `sandcastle/issue-<n>` branch-name convention plus any close-keyword refs
 * in title/body. Bare refs resolve against the PR's own repo.
 *
 * @param {{ repo: string, headRefName?: string, title?: string, body?: string }} pr
 * @returns {string[]} canonical issue ids, deduplicated.
 */
export function prIssueIds(pr) {
  const out = [];
  const push = (edge) => {
    const id = resolveRef(edge, pr.repo);
    if (!out.includes(id)) out.push(id);
  };
  const bm = BRANCH_ISSUE_RE.exec(pr.headRefName ?? "");
  if (bm) push({ owner: null, repo: null, number: Number(bm[1]) });
  const text = `${pr.title ?? ""}\n${pr.body ?? ""}`;
  let m;
  while ((m = CLOSE_REF_RE.exec(text)) !== null) {
    push({
      owner: m.groups.owner ?? null,
      repo: m.groups.repo ?? null,
      number: Number(m.groups.number),
    });
  }
  return out;
}

// ── Blocker enumeration (for the shell's state fetch) ───────────────────────

/**
 * Unique canonical blocker ids referenced by the given issues' `## Blocked by`
 * sections (clean edges only — unresolvable bullets have no ids to fetch).
 *
 * @param {Array<{ repo: string, body: string }>} issues
 * @returns {string[]}
 */
export function collectBlockerIds(issues) {
  const out = new Set();
  for (const iss of issues) {
    for (const edge of parseBlockedBy(iss.body).edges) out.add(resolveRef(edge, iss.repo));
  }
  return [...out];
}

// ── The pass plan ───────────────────────────────────────────────────────────

const canonicalId = (iss) => `${String(iss.repo).toLowerCase()}#${iss.number}`;

function lookup(map, id) {
  if (!map) return undefined;
  if (map instanceof Map) {
    for (const [k, v] of map) if (String(k).toLowerCase() === id) return v;
    return undefined;
  }
  for (const k of Object.keys(map)) if (k.toLowerCase() === id) return map[k];
  return undefined;
}

/**
 * Compute the full dispatch plan for one pass. Pure: same inputs → same plan,
 * which is what makes racing passes converge (see header).
 *
 * @param {{
 *   openIssues: Array<{ repo: string, number: number, title?: string,
 *     url?: string, labels?: string[], body: string }>,
 *     // every OPEN issue across the fleet (epics included)
 *   agentPrs: Array<{ repo: string, number: number, url?: string,
 *     headRefName?: string, title?: string, body?: string }>,
 *     // every OPEN PR on a factory branch prefix, fleet-wide
 *   prLinkedBodies?: Object<string,{ body: string }>|Map,
 *     // bodies of issues agent PRs reference that are NOT in openIssues
 *     // (already closed) — needed to attribute those PRs to their epic
 *   blockerStates?: Object<string,{state:string,stateReason?:string}>|Map,
 *     // states of blocker ids from collectBlockerIds; open issues already in
 *     // openIssues may be omitted (they are known open)
 *   fleetRepos?: string[],  // "owner/name" repos that have a runner
 * }} input
 * @returns {{
 *   actions: Array<{ type: "dispatch"|"queue"|"blocked"|"needs-human"|
 *     "in-flight-label"|"in-flight-pr"|"excluded"|"outside-fleet",
 *     child: { id: string, repo: string, number: number, title?: string,
 *       url?: string },
 *     epicIds: string[], reasons: string[] }>,
 *     // exactly one action per child, ordered by canonical child id
 *   epics: Array<{ id: string, title?: string, url?: string,
 *     openChildren: number, busyWith: string[],  // PR urls / label evidence
 *     dispatched: string|null, stalled: boolean }>,
 *     // stalled = not busy, nothing dispatched, no ready child — the epic
 *     // makes no progress without outside intervention (feeds #286)
 *   cycles: string[][],
 * }}
 */
export function planDispatch({
  openIssues = [],
  agentPrs = [],
  prLinkedBodies = {},
  blockerStates = {},
  fleetRepos = [],
} = {}) {
  const fleet = new Set(fleetRepos.map((r) => String(r).toLowerCase()));
  const byId = new Map(openIssues.map((i) => [canonicalId(i), i]));

  // Epics: open + `epic` label.
  const epics = new Map(); // id → { issue, children: [], busyWith: [] }
  for (const iss of openIssues) {
    if ((iss.labels ?? []).includes(EPIC_LABEL)) {
      epics.set(canonicalId(iss), { issue: iss, children: [], busyWith: [] });
    }
  }

  // Membership: open issues whose `Part of` line names a known epic.
  const epicsOf = new Map(); // childId → [epicIds]
  for (const iss of openIssues) {
    const id = canonicalId(iss);
    const refs = parseEpicRefs(iss.body, iss.repo).filter((r) => epics.has(r) && r !== id);
    if (!refs.length) continue;
    epicsOf.set(id, refs);
    for (const r of refs) epics.get(r).children.push(iss);
  }

  // PR → epic attribution. The linked issue's body may come from openIssues
  // (still open) or prLinkedBodies (already closed).
  const prsByIssue = new Map(); // issueId → [pr labels]
  for (const pr of agentPrs) {
    const prLabel = pr.url ?? `${pr.repo}#${pr.number}`;
    for (const iid of prIssueIds(pr)) {
      if (!prsByIssue.has(iid)) prsByIssue.set(iid, []);
      prsByIssue.get(iid).push(prLabel);
      const body = byId.get(iid)?.body ?? lookup(prLinkedBodies, iid)?.body;
      if (body == null) continue; // unattributable — blocks no epic
      const [repoOfIid] = iid.split("#");
      for (const r of parseEpicRefs(body, repoOfIid)) {
        if (epics.has(r)) epics.get(r).busyWith.push(`open agent PR ${prLabel} (via ${iid})`);
      }
    }
  }

  // A child already labeled agent:implement counts as in flight (the runner
  // may be mid-run before its PR exists).
  for (const [childId, refs] of epicsOf) {
    const child = byId.get(childId);
    if ((child.labels ?? []).includes(IMPLEMENT_LABEL)) {
      for (const r of refs) epics.get(r).busyWith.push(`child ${childId} already carries ${IMPLEMENT_LABEL}`);
    }
  }

  // Effective blocker states: caller-supplied, plus "open" for any blocker
  // that is itself one of the open issues we already hold.
  const states = {};
  if (blockerStates instanceof Map) {
    for (const [k, v] of blockerStates) states[String(k).toLowerCase()] = v;
  } else {
    for (const k of Object.keys(blockerStates)) states[k.toLowerCase()] = blockerStates[k];
  }
  for (const id of byId.keys()) if (!(id in states)) states[id] = { state: "open" };

  // Cycles across everything we can see.
  const cycles = detectCycles(openIssues);
  const cycleMembers = new Set(cycles.flat());

  // Per-child verdict (computed once even under multi-epic membership).
  const verdicts = new Map(); // childId → { type, reasons }
  for (const [childId] of epicsOf) {
    const child = byId.get(childId);
    const labels = child.labels ?? [];
    const excluded = labels.filter((l) => EXCLUDED_LABELS.has(l));
    if (excluded.length) {
      verdicts.set(childId, {
        type: "excluded",
        reasons: [`carries excluded label(s): ${excluded.join(", ")} — never dispatched`],
      });
      continue;
    }
    if (labels.includes(IMPLEMENT_LABEL)) {
      verdicts.set(childId, {
        type: "in-flight-label",
        reasons: [`already carries ${IMPLEMENT_LABEL} — runner owns it`],
      });
      continue;
    }
    if (prsByIssue.has(childId)) {
      verdicts.set(childId, {
        type: "in-flight-pr",
        reasons: [`already has open agent PR(s): ${prsByIssue.get(childId).join(", ")}`],
      });
      continue;
    }
    const ready = isReady({ repo: child.repo, number: child.number, body: child.body }, states, {
      cycleMembers,
    });
    if (ready.verdict === "ready") {
      if (!fleet.has(String(child.repo).toLowerCase())) {
        verdicts.set(childId, {
          type: "outside-fleet",
          reasons: [
            `ready, but ${child.repo} is not a factory fleet repo — no ${IMPLEMENT_LABEL} runner to fire`,
          ],
        });
      } else {
        verdicts.set(childId, { type: "ready", reasons: ready.reasons });
      }
    } else if (ready.verdict === "blocked") {
      verdicts.set(childId, { type: "blocked", reasons: ready.reasons });
    } else {
      // needs-human and cycle both route to a human, never to dispatch.
      verdicts.set(childId, { type: "needs-human", reasons: ready.reasons });
    }
  }

  // Serialization: deterministic order everywhere; one dispatch per epic per
  // pass; multi-epic children need ALL their epics free.
  const busyEpics = new Set([...epics.keys()].filter((id) => epics.get(id).busyWith.length > 0));
  const dispatchedByEpic = new Map(); // epicId → childId
  const actions = [];
  const sortedChildIds = [...epicsOf.keys()].sort();
  for (const childId of sortedChildIds) {
    const v = verdicts.get(childId);
    const child = byId.get(childId);
    const epicIds = epicsOf.get(childId);
    const base = {
      child: {
        id: childId,
        repo: child.repo,
        number: child.number,
        title: child.title,
        url: child.url,
      },
      epicIds,
    };
    if (v.type !== "ready") {
      actions.push({ type: v.type, ...base, reasons: v.reasons });
      continue;
    }
    const busy = epicIds.filter((e) => busyEpics.has(e));
    if (busy.length) {
      actions.push({
        type: "queue",
        ...base,
        reasons: [
          ...v.reasons,
          `queued: epic(s) ${busy.join(", ")} already have work in flight ` +
            `(${busy.map((e) => epics.get(e).busyWith[0] ?? dispatchedByEpic.get(e)).join("; ")})`,
        ],
      });
      continue;
    }
    actions.push({ type: "dispatch", ...base, reasons: v.reasons });
    for (const e of epicIds) {
      busyEpics.add(e);
      dispatchedByEpic.set(e, `dispatching ${childId} this pass`);
      epics.get(e).busyWith.push(`dispatching ${childId} this pass`);
    }
  }

  // Epic summaries (deterministic order).
  const epicSummaries = [...epics.keys()].sort().map((id) => {
    const e = epics.get(id);
    const dispatched =
      actions.find((a) => a.type === "dispatch" && a.epicIds.includes(id))?.child.id ?? null;
    const hasReady = e.children.some((c) => verdicts.get(canonicalId(c))?.type === "ready");
    return {
      id,
      title: e.issue.title,
      url: e.issue.url,
      openChildren: e.children.length,
      busyWith: [...new Set(e.busyWith)],
      dispatched,
      // Stalled: nothing in flight, nothing dispatched, nothing ready — the
      // epic cannot progress without a human (or a blocker closing elsewhere).
      stalled: e.busyWith.length === 0 && !dispatched && !hasReady,
    };
  });

  return { actions, epics: epicSummaries, cycles };
}
