// Epic completion evaluator (toon-meta#284, epic #270).
//
// The pure decision half of the epic completion pass that runs AFTER each
// unblock-dispatch pass (same triggers, same APPLY knob): given the fleet's
// open epics and every candidate child (open AND closed — the shell reaches
// closed children via the epic's cross-reference timeline), decide which
// epics are DONE (close + summary comment), which carry dropped scope
// (comment + `needs:human`, never auto-close), and which just aren't finished
// yet. No GitHub reads or writes here — the I/O lives in
// scripts/factory/unblock-dispatcher.mjs.
//
// ── MEMBERSHIP — SAME RULE AS DISPATCH, SAME CODE ───────────────────────────
// A child is an issue whose body has a line starting `Part of <issue-ref>`,
// resolved against the child's own repo — parseEpicRefs from
// dispatch-evaluator.mjs (#280) is imported, never re-implemented. The only
// difference from planDispatch is the candidate set: completion must see
// CLOSED children too (they are the whole point), so the shell feeds this
// module timeline-discovered candidates instead of just the open-issue scan.
// GitHub-native sub-issues are still not consulted (subIssues.totalCount == 0
// on every live epic).
//
// ── VERDICTS (fail closed, per epic, ≥1 child required) ─────────────────────
// * complete   — EVERY child is closed **as completed** → close the epic with
//                a summary comment listing what shipped (children + their
//                closing PRs, which the shell fetches via GraphQL
//                closedByPullRequestsReferences).
// * escalate   — ANY child closed as **not planned** → comment + apply
//                `needs:human`, NEVER auto-close (dropped scope is a human
//                decision), even if every other child is completed. Flagged
//                as soon as the not-planned child appears — surfacing dropped
//                scope early is the point; idempotent via a hidden marker
//                (shell-checked, same convention as needsHumanMarker).
// * held       — the epic itself carries `needs:human` → never auto-closed
//                and never re-escalated; a human already owns it. Reported
//                with the full tally so the digest (#286) can show it.
// * incomplete — open children remain, or a child's closed-reason cannot be
//                verified (state_reason missing/unrecognized — old closes,
//                API drift). Unknown NEVER counts as completed: fail closed.
// * no-children — nothing declares membership; the completion rule applies
//                only to epics with at least one child. Never closed.
//
// ── EXPORTED API ────────────────────────────────────────────────────────────
//   planCompletion({ epics, candidates })      → { epics, actions }
//   buildCompletionComment({ epic, completed, childPrs }) → close comment
//   buildEscalationComment({ epic, tally, marker })       → escalate comment
//   escalationMarker(repo, number)             → hidden idempotency marker
//
// Plain Node ESM, zero dependencies. Tests: completion-evaluator.test.mjs
// (node --test).

import { parseEpicRefs, EPIC_LABEL, HUMAN_LABEL } from "./dispatch-evaluator.mjs";

// Hidden marker embedded in every escalation comment so flagging is
// idempotent across passes (same convention as needsHumanMarker in
// dispatch-evaluator.mjs: slash/hash-free, re-checked client-side).
const sanitize = (repo) => repo.replace(/[^a-zA-Z0-9]+/g, "-");
export const escalationMarker = (repo, number) =>
  `epic-completion-not-planned:${sanitize(repo)}-issue-${number}`;

const canonicalId = (iss) => `${String(iss.repo).toLowerCase()}#${iss.number}`;
const normalizeReason = (r) =>
  String(r ?? "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

// Trim a child to what reports and comments need.
const childRef = (c) => ({
  id: c.id,
  repo: c.repo,
  number: c.number,
  title: c.title,
  url: c.url,
  state: c.state,
  stateReason: c.stateReason ?? null,
});

/**
 * Compute the completion plan for one pass. Pure: same inputs → same plan.
 *
 * @param {{
 *   epics: Array<{ repo: string, number: number, title?: string, url?: string,
 *     labels?: string[], body?: string }>,
 *     // the fleet's OPEN issues carrying the `epic` label (others ignored)
 *   candidates: Array<{ repo: string, number: number, title?: string,
 *     url?: string, state: string, stateReason?: string|null,
 *     labels?: string[], body: string }>,
 *     // every issue that might be a child: the open-issue scan PLUS the
 *     // epics' timeline cross-references (which is how closed children are
 *     // reached). Membership is decided HERE via `Part of` lines — feeding
 *     // extra non-member candidates is harmless. Duplicates deduped (first
 *     // occurrence wins, so callers should list fresher data first).
 * }} input
 * @returns {{
 *   epics: Array<{ id: string, title?: string, url?: string,
 *     verdict: "complete"|"escalate"|"held"|"incomplete"|"no-children",
 *     tally: { completed: Child[], open: Child[], notPlanned: Child[],
 *              unknown: Child[] },   // Child = childRef shape above
 *     reasons: string[] }>,          // ordered by canonical epic id
 *   actions: Array<
 *     { type: "close-epic", epic: EpicRef, completed: Child[] } |
 *     { type: "escalate-epic", epic: EpicRef, notPlanned: Child[],
 *       tally: {...} }>,             // EpicRef = { id, repo, number, title, url }
 * }}
 */
export function planCompletion({ epics = [], candidates = [] } = {}) {
  const epicMap = new Map(); // canonical id → { issue, children: [] }
  for (const e of epics) {
    if (!(e.labels ?? []).includes(EPIC_LABEL)) continue;
    epicMap.set(canonicalId(e), { issue: e, children: [] });
  }

  // Membership: dedup candidates, bind each to every epic its `Part of`
  // lines name (a multi-epic child counts for all of them; self-refs never
  // bind — an epic cannot be its own child).
  const seen = new Set();
  for (const c of candidates) {
    const id = canonicalId(c);
    if (seen.has(id)) continue;
    seen.add(id);
    const refs = parseEpicRefs(c.body, c.repo).filter((r) => epicMap.has(r) && r !== id);
    for (const r of refs) epicMap.get(r).children.push({ ...c, id });
  }

  const out = { epics: [], actions: [] };
  for (const eid of [...epicMap.keys()].sort()) {
    const { issue, children } = epicMap.get(eid);
    const epicRef = {
      id: eid,
      repo: issue.repo,
      number: issue.number,
      title: issue.title,
      url: issue.url,
    };
    const held = (issue.labels ?? []).includes(HUMAN_LABEL);

    const tally = { completed: [], open: [], notPlanned: [], unknown: [] };
    for (const ch of [...children].sort((a, b) => (a.id < b.id ? -1 : 1))) {
      const state = String(ch.state ?? "").toLowerCase();
      const reason = normalizeReason(ch.stateReason);
      if (state === "open") tally.open.push(childRef(ch));
      else if (state === "closed" && reason === "completed") tally.completed.push(childRef(ch));
      else if (state === "closed" && reason === "not_planned") tally.notPlanned.push(childRef(ch));
      // Anything else (closed without a verifiable reason, unknown state) can
      // never count toward completion — fail closed.
      else tally.unknown.push(childRef(ch));
    }
    const counts =
      `${tally.completed.length} completed, ${tally.open.length} open, ` +
      `${tally.notPlanned.length} not planned, ${tally.unknown.length} unverifiable`;

    let verdict;
    const reasons = [];
    if (children.length === 0) {
      verdict = "no-children";
      reasons.push(
        "no child declares membership (`Part of` line) — the completion rule " +
          "applies only to epics with at least one child",
      );
    } else if (held) {
      verdict = "held";
      reasons.push(
        `epic carries ${HUMAN_LABEL} — never auto-closed or re-escalated; ` +
          `a human owns it (${counts})`,
      );
    } else if (tally.notPlanned.length > 0) {
      verdict = "escalate";
      reasons.push(
        `child(ren) closed as not planned: ` +
          `${tally.notPlanned.map((c) => c.id).join(", ")} — dropped scope needs a ` +
          `human decision; the epic is never auto-closed (${counts})`,
      );
      out.actions.push({ type: "escalate-epic", epic: epicRef, notPlanned: tally.notPlanned, tally });
    } else if (tally.open.length > 0 || tally.unknown.length > 0) {
      verdict = "incomplete";
      if (tally.open.length)
        reasons.push(`open child(ren) remain: ${tally.open.map((c) => c.id).join(", ")}`);
      if (tally.unknown.length)
        reasons.push(
          `child(ren) not verifiably closed as completed (failing closed): ` +
            tally.unknown.map((c) => `${c.id} (state=${c.state}, stateReason=${c.stateReason ?? "∅"})`).join(", "),
        );
    } else {
      verdict = "complete";
      reasons.push(`all ${tally.completed.length} child(ren) closed as completed`);
      out.actions.push({ type: "close-epic", epic: epicRef, completed: tally.completed });
    }

    out.epics.push({ id: eid, title: issue.title, url: issue.url, verdict, tally, reasons });
  }
  return out;
}

// ── Comment builders (pure text) ────────────────────────────────────────────

const prLabel = (pr) => (typeof pr === "string" ? pr : (pr.url ?? `#${pr.number}`));

function lookupPrs(childPrs, id) {
  if (!childPrs) return [];
  if (childPrs instanceof Map) {
    for (const [k, v] of childPrs) if (String(k).toLowerCase() === id) return v ?? [];
    return [];
  }
  for (const k of Object.keys(childPrs)) if (k.toLowerCase() === id) return childPrs[k] ?? [];
  return [];
}

/**
 * The comment posted when closing a completed epic: what shipped, child by
 * child, with each child's closing PR(s) (from GraphQL
 * closedByPullRequestsReferences, fetched by the shell).
 *
 * @param {{ epic: {id:string}, completed: Array<{id:string,title?:string}>,
 *   childPrs?: Object<string, Array<{url?:string,number?:number}|string>>|Map }} input
 * @returns {string}
 */
export function buildCompletionComment({ epic, completed, childPrs = {} }) {
  const lines = [
    `Every child of this epic is closed **as completed** — closing the epic.`,
    ``,
    `What shipped:`,
    ``,
  ];
  for (const ch of completed) {
    const prs = lookupPrs(childPrs, ch.id).map(prLabel);
    const via = prs.length ? ` (${prs.join(", ")})` : "";
    lines.push(`- [x] ${ch.id}${ch.title ? ` — ${ch.title}` : ""}${via}`);
  }
  lines.push(
    ``,
    `_Closed automatically by the epic completion pass (toon-meta#284, part of ` +
      `the unblock dispatcher). Children are the issues declaring \`Part of ` +
      `${epic.id}\`; PRs come from each child's closing-PR references._`,
  );
  return lines.join("\n");
}

/**
 * The comment posted when escalating an epic with not-planned children.
 * Includes the hidden marker so the shell never posts it twice.
 *
 * @param {{ epic: {id:string}, tally: {completed:any[],open:any[],
 *   notPlanned:Array<{id:string,title?:string}>,unknown:any[]},
 *   marker: string }} input
 * @returns {string}
 */
export function buildEscalationComment({ epic, tally, marker }) {
  const lines = [
    `The epic completion pass (toon-meta#284) will **not** auto-close this ` +
      `epic: child(ren) were closed as **not planned**, which usually means ` +
      `scope was dropped — that is a decision worth a human look, not a green ` +
      `checkmark.`,
    ``,
    `Not planned:`,
    ``,
  ];
  for (const ch of tally.notPlanned) {
    lines.push(`- ${ch.id}${ch.title ? ` — ${ch.title}` : ""}`);
  }
  lines.push(
    ``,
    `Tally for ${epic.id}: ${tally.completed.length} completed, ` +
      `${tally.open.length} still open, ${tally.notPlanned.length} not planned, ` +
      `${tally.unknown.length} unverifiable.`,
    ``,
    `Applying \`${HUMAN_LABEL}\`. When the scope question is settled: close the ` +
      `epic manually if it is done, or re-scope (reopen / replace the dropped ` +
      `child) and remove \`${HUMAN_LABEL}\` so automation resumes watching it.`,
    ``,
    `<!-- ${marker} -->`,
  );
  return lines.join("\n");
}
