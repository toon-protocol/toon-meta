// Daily digest evaluator (toon-meta#286, epic #270).
//
// The pure decision half of the daily digest: given a window of raw fleet
// events (label/close events, merged PRs, freshly opened issues, workflow-run
// counts) plus the dispatch plan, decide WHAT goes in the digest and render it.
// No GitHub reads or writes here — the I/O shell is scripts/factory/daily-digest.mjs.
//
// Nothing in this file re-derives logic that already exists elsewhere:
//   * `## Blocked by` parsing            → unblock-evaluator.mjs (#274)
//   * PR → issue attribution, epic refs  → dispatch-evaluator.mjs (#280)
//   * housekeeping fix-ticket markers    → hygiene-evaluator.mjs (#277)
//   * stalled-epic detection             → dispatch-evaluator.mjs `planDispatch`
//     already computes `epics[].stalled` (no in-flight PR, nothing dispatched,
//     no ready child). The digest only ENRICHES it with the per-child verdict
//     breakdown that says WHY, so the human sees the wedged ticket, not just
//     the wedged epic.
//
// ── EVENTS, NOT STATE (this is the whole design) ─────────────────────────────
// Every section reports TRANSITIONS inside the window, never current state.
// A state-based digest ("here is everything labeled needs:human") repeats the
// same escalation every morning until a human clears it, which is exactly the
// failure the ticket warns about — a digest nobody reads. An event-based digest
// reports each escalation on the day it happened, once. The corollary: an
// escalation that is still unresolved is NOT re-listed, so the digest is a
// change log, not a dashboard. (The standing issue keeps the history one scroll
// away, and `needs:human` remains the queryable queue.)
//
// ── ESCALATION DEDUPE — "EXACTLY ONCE" (acceptance criterion) ────────────────
// Three layers, because windows drift (cron delay, a manual re-run, an outage
// backfill) and an overlap would otherwise double-report:
//   1. Within a run: several `labeled needs:human` events for the same item
//      collapse to the LATEST one (a flapping label is one escalation).
//   2. Across runs: every escalation carries a stable key
//      `<repo>#<number>@<label-event ISO>` and each posted digest embeds the
//      full key list in a hidden marker line. The shell feeds back the keys
//      from previous digests; any key already reported is suppressed. Overlapping
//      windows therefore cannot double-report, and a genuine RE-escalation
//      (label removed, then re-applied) has a new timestamp → a new key → it is
//      reported again, correctly.
//   3. Same-day re-run: the digest comment carries `factory-digest:<UTC day>`
//      and the shell UPSERTS on that marker, so a second run of the same day
//      edits its own comment instead of posting a twin.
//
// Plain Node ESM, zero dependencies. Tests: digest-evaluator.test.mjs (node --test).

import { parseBlockedBy, resolveRef } from "./unblock-evaluator.mjs";
import {
  prIssueIds,
  IMPLEMENT_LABEL,
  HUMAN_LABEL,
  FACTORY_BRANCH_PREFIXES,
} from "./dispatch-evaluator.mjs";
import { parseStuckMarker, STALE_LABEL } from "./hygiene-evaluator.mjs";

export { IMPLEMENT_LABEL, HUMAN_LABEL, STALE_LABEL };

// ── Markers ─────────────────────────────────────────────────────────────────
// Same hidden-marker convention as the other components (slash/hash-free so
// GitHub search can find them; the exact string is re-checked client-side).

/** Per-day idempotency marker — one digest comment per UTC day. */
export const digestMarker = (day) => `factory-digest:${day}`;
/** Prefix of the hidden line carrying the escalation keys this digest reported. */
export const ESCALATION_KEYS_MARKER = "factory-digest-escalations:";

/** Title prefixes the other components file under (used to classify "Filed"). */
export const HOUSEKEEPING_TITLE_PREFIX = "[housekeeping]";
export const HYGIENE_TITLE_PREFIX = "[hygiene]";

// Hidden markers the factory writes when it escalates, mapped to the component
// that owns them. Used to explain WHY something is `needs:human`.
const ESCALATION_SOURCES = [
  { marker: "unblock-dispatcher-needs-human:", source: "unblock dispatcher (#280)" },
  { marker: "epic-completion-not-planned:", source: "epic completion pass (#284)" },
];
// pr-housekeeping's PR escalation comment carries no hidden marker (it is 1:1
// with the PR, so it never needed one) — it is matched on its opening phrase.
const HOUSEKEEPING_ESCALATION_PHRASE = "PR housekeeping escalation";

/**
 * Did the ticket-hygiene sweep (#277) close this issue, or did a human?
 *
 * Provenance, not identity: `FACTORY_OPS_TOKEN` may resolve to a login a human
 * also uses, so "closed as not planned by <bot-ish actor>" is not evidence.
 * Hygiene's own closes always leave one of its comments — the obsolete pass a
 * hidden reopen-guard marker, the stale pass its "weekly ticket hygiene"
 * sentence. No such comment ⇒ not attributed (fail closed: a human's decision
 * is never reported as an automated one).
 *
 * @param {Array<{body?: string}>} comments
 * @returns {{ hygiene: boolean, kind: "obsolete"|"stale"|"" }}
 */
export function classifyHygieneClose(comments = []) {
  for (const c of comments) {
    const body = String(c?.body ?? "");
    if (body.includes("ticket-hygiene-obsolete:")) return { hygiene: true, kind: "obsolete" };
    if (/weekly ticket[- ]hygiene/i.test(body)) return { hygiene: true, kind: "stale" };
  }
  return { hygiene: false, kind: "" };
}

// ── Small helpers ───────────────────────────────────────────────────────────

const ms = (t) => (typeof t === "number" ? t : Date.parse(t));

/** UTC calendar day (YYYY-MM-DD) of an ISO timestamp / Date / epoch ms. */
export function utcDay(t) {
  return new Date(ms(t)).toISOString().slice(0, 10);
}

/** Second-precision ISO, so a key never depends on millisecond noise. */
const isoSeconds = (t) => new Date(ms(t)).toISOString().replace(/\.\d+Z$/, "Z");

const canonical = (repo, number) => `${String(repo).toLowerCase()}#${number}`;

/** Short display id: `relay#88` from `toon-protocol/relay#88`. */
export const shortId = (id) => String(id).replace(/^[^/]+\//, "");

/**
 * Stable identity of one escalation: the item plus the moment it was labeled.
 * Re-escalating the same ticket later yields a different key on purpose.
 */
export const escalationKey = ({ repo, number, at }) => `${canonical(repo, number)}@${isoSeconds(at)}`;

/**
 * Escalation keys reported by previous digests, read back from their hidden
 * marker lines. Tolerates any surrounding text/HTML-comment wrapping.
 *
 * @param {Array<string|{body?: string}>} comments
 * @returns {string[]} unique keys, in encounter order.
 */
export function parseReportedEscalationKeys(comments = []) {
  const out = [];
  for (const c of comments) {
    const body = typeof c === "string" ? c : (c?.body ?? "");
    for (const line of body.split(/\r?\n/)) {
      const at = line.indexOf(ESCALATION_KEYS_MARKER);
      if (at === -1) continue;
      const tail = line.slice(at + ESCALATION_KEYS_MARKER.length).replace(/-->\s*$/, "");
      for (const key of tail.split(/[\s,]+/)) {
        if (key && !out.includes(key)) out.push(key);
      }
    }
  }
  return out;
}

/**
 * Why an item is `needs:human`, read from its comments. Prefers the newest
 * factory-written escalation comment; falls back to "no factory reason" so a
 * human-applied label is visibly distinguishable from an automated one.
 *
 * @param {Array<{body?: string, createdAt?: string}>} comments
 * @returns {{ reason: string, source: string }}
 */
export function extractEscalationReason(comments = []) {
  const sorted = [...comments].sort((a, b) => ms(a.createdAt ?? 0) - ms(b.createdAt ?? 0));
  for (const c of [...sorted].reverse()) {
    const body = String(c.body ?? "");
    const hit = ESCALATION_SOURCES.find((s) => body.includes(s.marker));
    if (hit) return { reason: summarizeReason(body), source: hit.source };
    if (body.includes(HOUSEKEEPING_ESCALATION_PHRASE)) {
      return { reason: summarizeReason(body), source: "pr housekeeping (#276)" };
    }
  }
  return { reason: "", source: "" };
}

// The escalation comments all state the cause either as bullets ("- blocker X
// closed as not planned") or in the first sentence. Take the bullets when they
// exist (they name the offending blocker), else the first sentence.
function summarizeReason(body) {
  const lines = String(body)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !l.startsWith("<!--"));
  const bullets = lines
    .filter((l) => /^[-*+]\s+/.test(l))
    .map((l) => l.replace(/^[-*+]\s+/, "").trim())
    .filter((l) => l.length > 3);
  const raw = bullets.length ? bullets.join("; ") : (lines.join(" ").split(/(?<=\.)\s/)[0] ?? "");
  return tidy(raw);
}

/** Collapse markdown noise + whitespace and clamp, for a phone-width line. */
function tidy(text, max = 200) {
  const s = String(text ?? "")
    .replace(/[`*]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

// ── The digest ──────────────────────────────────────────────────────────────

/**
 * Build the digest for one window. Pure: same inputs → same digest, which is
 * what makes the rendered text (and its escalation keys) reproducible across a
 * dry-run and the apply run that follows it.
 *
 * @param {{
 *   now?: string|number,            // window end (default: Date.now())
 *   windowHours?: number,           // default 24
 *   repos?: string[],               // "owner/name" fleet, for the header
 *   events?: Array<{ repo: string, event: string, createdAt: string,
 *     label?: string|null, actor?: string,
 *     issue: { number: number, title?: string, url?: string, isPr?: boolean,
 *              stateReason?: string|null, body?: string } }>,
 *     // repo issue-event feed (`/repos/{r}/issues/events`), issues AND PRs
 *   mergedPrs?: Array<{ repo: string, number: number, title?: string,
 *     url?: string, mergedAt: string, headRefName?: string, body?: string,
 *     author?: string, mergedBy?: string }>,   // agent PRs only (shell filters)
 *   openedIssues?: Array<{ repo: string, number: number, title?: string,
 *     url?: string, createdAt: string, body?: string }>,
 *   dispatchedBodies?: Object<string,string>,  // canonical id → issue body,
 *     // for the `## Blocked by` attribution of a dispatched ticket
 *   escalationReasons?: Object<string,{reason: string, source: string}>,
 *   plan?: { epics?: Array<object>, actions?: Array<object> },  // planDispatch()
 *   runs?: Object<string,{implement?: number, review?: number}>,  // repo → counts
 *   reportedEscalationKeys?: string[],   // from previous digests (dedupe layer 2)
 *   closeProvenance?: Object<string,{hygiene: boolean, kind: string}>,
 *     // per closed-issue id, the classifyHygieneClose() verdict
 *   notes?: string[],                    // free-text notes (e.g. an outage)
 * }} input
 * @returns {object} the digest model consumed by renderDigest().
 */
export function buildDigest({
  now = Date.now(),
  windowHours = 24,
  repos = [],
  events = [],
  mergedPrs = [],
  openedIssues = [],
  dispatchedBodies = {},
  escalationReasons = {},
  plan = {},
  runs = {},
  reportedEscalationKeys = [],
  closeProvenance = {},
  notes = [],
} = {}) {
  const end = ms(now);
  const start = end - windowHours * 3600_000;
  const inWindow = (t) => {
    const v = ms(t);
    return Number.isFinite(v) && v > start && v <= end;
  };
  const evs = events.filter((e) => inWindow(e.createdAt));

  // Every issue closed in the window — the join key for "what did this dispatch
  // release" and "what did this merge close".
  const closed = new Map();
  for (const e of evs) {
    if (e.event !== "closed" || e.issue?.isPr) continue;
    const id = canonical(e.repo, e.issue.number);
    const prev = closed.get(id);
    if (!prev || ms(e.createdAt) > ms(prev.at)) {
      closed.set(id, {
        id,
        at: e.createdAt,
        title: e.issue.title,
        url: e.issue.url,
        stateReason: e.issue.stateReason ?? null,
        actor: e.actor,
      });
    }
  }

  // ── Dispatched ────────────────────────────────────────────────────────────
  const dispatched = [];
  const seenDispatch = new Set();
  for (const e of evs) {
    if (e.event !== "labeled" || e.label !== IMPLEMENT_LABEL || e.issue?.isPr) continue;
    const id = canonical(e.repo, e.issue.number);
    if (seenDispatch.has(id)) continue; // one dispatch line per ticket per day
    seenDispatch.add(id);
    const body = lookup(dispatchedBodies, id) ?? e.issue.body ?? "";
    const [ownerRepo] = [id.split("#")[0]];
    const blockers = parseBlockedBy(body).edges.map((edge) => resolveRef(edge, ownerRepo));
    const unblockedBy = blockers.filter((b) => closed.has(b));
    dispatched.push({
      id,
      number: e.issue.number,
      title: tidy(e.issue.title, 70),
      url: e.issue.url,
      at: e.createdAt,
      actor: e.actor,
      blockers,
      unblockedBy,
    });
  }
  dispatched.sort((a, b) => ms(a.at) - ms(b.at));

  // ── Merged ────────────────────────────────────────────────────────────────
  // Reported from PR/issue data alone: whoever merged (auto-merge #285, the
  // orchestrator, or a human) is irrelevant to the fact of the merge — which is
  // what lets this work before and after #285 lands.
  //
  // Every merged PR is reported, not only `sandcastle/*` / `agent/*` branches.
  // Real factory PRs routinely land on ticket-named branches (`epic270/286-…`),
  // so the branch-prefix filter the dispatcher uses for SERIALIZATION would
  // under-report a day's merges to near zero here. Agent-branch PRs are tagged
  // instead of filtered: over-reporting a human merge costs one line, while
  // under-reporting makes a busy AFK day look idle.
  const merged = mergedPrs
    .filter((p) => inWindow(p.mergedAt))
    .map((p) => {
      const linked = prIssueIds(p);
      return {
        id: canonical(p.repo, p.number),
        number: p.number,
        title: tidy(p.title, 70),
        url: p.url,
        mergedAt: p.mergedAt,
        mergedBy: p.mergedBy ?? "",
        agentBranch: FACTORY_BRANCH_PREFIXES.some((pre) =>
          String(p.headRefName ?? "").startsWith(pre),
        ),
        closedIssues: linked.filter((l) => closed.has(l)),
        linkedIssues: linked,
      };
    })
    .sort((a, b) => ms(a.mergedAt) - ms(b.mergedAt));

  // ── Filed ─────────────────────────────────────────────────────────────────
  // (a) #276 fix tickets — identified by the hidden stuck marker in the body
  // (hygiene-evaluator's parser), with the title prefix as a fallback for the
  // legacy triage-sweep shape.
  const fixTickets = openedIssues
    .filter((i) => inWindow(i.createdAt))
    .filter(
      (i) =>
        Boolean(parseStuckMarker(i.body ?? "")) ||
        String(i.title ?? "").startsWith(HOUSEKEEPING_TITLE_PREFIX),
    )
    .map((i) => ({
      id: canonical(i.repo, i.number),
      title: tidy(i.title, 80),
      url: i.url,
      at: i.createdAt,
      targetPr: parseStuckMarker(i.body ?? "")?.prNumber ?? null,
    }))
    .sort((a, b) => ms(a.at) - ms(b.at));

  // (b) #277 hygiene actions. The sweep leaves no machine-readable event
  // stream, so they are inferred from its own vocabulary: the `stale` label it
  // owns, and the not-planned auto-closes it performs. A not-planned close is
  // attributed to hygiene only on PROVENANCE (its own comment, supplied by the
  // shell via classifyHygieneClose) — a human closing their own ticket as not
  // planned is a decision, not a sweep action, and the two share a login.
  const hygiene = [];
  for (const e of evs) {
    const id = canonical(e.repo, e.issue.number);
    const base = { id, title: tidy(e.issue.title, 70), url: e.issue.url, at: e.createdAt };
    if (e.event === "labeled" && e.label === STALE_LABEL) {
      hygiene.push({ ...base, action: "stale-mark" });
    } else if (e.event === "unlabeled" && e.label === STALE_LABEL) {
      hygiene.push({ ...base, action: "unstale" });
    } else if (
      e.event === "closed" &&
      !e.issue?.isPr &&
      (e.issue.stateReason ?? "") === "not_planned" &&
      lookup(closeProvenance, id)?.hygiene
    ) {
      hygiene.push({ ...base, action: `auto-close (${lookup(closeProvenance, id).kind})` });
    }
  }
  hygiene.sort((a, b) => ms(a.at) - ms(b.at));
  const hygieneReports = openedIssues
    .filter((i) => inWindow(i.createdAt) && String(i.title ?? "").startsWith(HYGIENE_TITLE_PREFIX))
    .map((i) => ({ id: canonical(i.repo, i.number), title: tidy(i.title, 80), url: i.url }));

  // ── Escalated ─────────────────────────────────────────────────────────────
  // Dedupe layer 1 (latest event per item) then layer 2 (keys already reported).
  const latestEsc = new Map();
  for (const e of evs) {
    if (e.event !== "labeled" || e.label !== HUMAN_LABEL) continue;
    const id = canonical(e.repo, e.issue.number);
    const prev = latestEsc.get(id);
    if (!prev || ms(e.createdAt) > ms(prev.createdAt)) latestEsc.set(id, e);
  }
  const alreadyReported = new Set(reportedEscalationKeys);
  const escalated = [];
  const suppressedEscalations = [];
  for (const [id, e] of [...latestEsc.entries()].sort(
    (a, b) => ms(a[1].createdAt) - ms(b[1].createdAt),
  )) {
    const key = escalationKey({ repo: e.repo, number: e.issue.number, at: e.createdAt });
    const info = lookup(escalationReasons, id) ?? {};
    const row = {
      key,
      id,
      kind: e.issue?.isPr ? "PR" : "issue",
      title: tidy(e.issue.title, 70),
      url: e.issue.url,
      at: e.createdAt,
      actor: e.actor,
      reason: info.reason ? tidy(info.reason) : "",
      source: info.source ?? "",
    };
    if (alreadyReported.has(key)) suppressedEscalations.push(row);
    else escalated.push(row);
  }

  // ── Stalled ───────────────────────────────────────────────────────────────
  // planDispatch already decided `stalled`; here we only say why, by counting
  // the verdicts of the epic's children. With per-epic serialization one wedged
  // child halts the whole epic, so the per-verdict breakdown IS the diagnosis.
  const actions = plan.actions ?? [];
  const stalled = (plan.epics ?? [])
    .filter((e) => e.stalled)
    .map((e) => {
      const mine = actions.filter((a) => (a.epicIds ?? []).includes(e.id));
      const byType = {};
      for (const a of mine) byType[a.type] = (byType[a.type] ?? 0) + 1;
      const worst = mine
        .filter((a) => a.type === "needs-human" || a.type === "blocked")
        .slice(0, 2)
        .map((a) => `${shortId(a.child.id)}: ${tidy(a.reasons?.[0] ?? a.type, 90)}`);
      return {
        id: e.id,
        title: tidy(e.title, 60),
        url: e.url,
        openChildren: e.openChildren,
        // An epic with no open children is stalled only in the trivial sense:
        // there is nothing left to dispatch. That is the completion pass's job
        // (#284), not a wedge, so it is collapsed to one line when rendering —
        // otherwise the section that should surface real wedges is drowned by
        // finished epics every single day.
        childless: e.openChildren === 0,
        byType,
        detail: worst,
      };
    })
    .sort((a, b) => b.openChildren - a.openChildren || a.id.localeCompare(b.id));
  const epicsSeen = (plan.epics ?? []).length;

  // ── Spend ─────────────────────────────────────────────────────────────────
  const spend = Object.keys(runs)
    .map((repo) => ({
      repo,
      implement: runs[repo]?.implement ?? 0,
      review: runs[repo]?.review ?? 0,
    }))
    .filter((r) => r.implement + r.review > 0)
    .sort((a, b) => b.implement + b.review - (a.implement + a.review));
  const totalRuns = spend.reduce((n, r) => n + r.implement + r.review, 0);

  return {
    day: utcDay(end),
    windowStart: new Date(start).toISOString(),
    windowEnd: new Date(end).toISOString(),
    windowHours,
    repoCount: repos.length,
    dispatched,
    merged,
    filed: { fixTickets, hygiene, hygieneReports },
    escalated,
    suppressedEscalations,
    stalled,
    epicsSeen,
    spend,
    totalRuns,
    escalationKeys: escalated.map((e) => e.key),
    notes: notes.filter(Boolean),
    counts: {
      dispatched: dispatched.length,
      merged: merged.length,
      agentBranchMerges: merged.filter((m) => m.agentBranch).length,
      issuesClosedByMerges: new Set(merged.flatMap((m) => m.closedIssues)).size,
      filed: fixTickets.length + hygiene.length + hygieneReports.length,
      escalated: escalated.length,
      stalled: stalled.length,
      runs: totalRuns,
    },
  };
}

function lookup(map, id) {
  if (!map) return undefined;
  if (map instanceof Map) {
    for (const [k, v] of map) if (String(k).toLowerCase() === id) return v;
    return undefined;
  }
  for (const k of Object.keys(map)) if (k.toLowerCase() === id) return map[k];
  return undefined;
}

// ── Rendering ───────────────────────────────────────────────────────────────
//
// Phone-first: a headline count line, then the two sections a human must act on
// (Escalated, Stalled), then the record of what the factory did, then spend.
// Long sections are clamped with a "+N more" tail — the digest is a summary,
// and the links are one tap away.

const link = (text, url) => (url ? `[${text}](${url})` : text);

/**
 * Render the digest as the markdown body of one comment.
 *
 * @param {ReturnType<typeof buildDigest>} d
 * @param {{ maxRows?: number, marker?: boolean }} opts
 * @returns {string}
 */
export function renderDigest(d, { maxRows = 12, marker = true } = {}) {
  const L = [];
  const clamp = (rows, render) => {
    for (const r of rows.slice(0, maxRows)) L.push(render(r));
    if (rows.length > maxRows) L.push(`- …and ${rows.length - maxRows} more`);
  };

  const hhmm = (iso) => iso.slice(11, 16);
  L.push(`## Factory digest — ${d.day}`);
  L.push("");
  L.push(
    `\`${d.windowHours}h to ${hhmm(d.windowEnd)}Z\` · ${d.repoCount} repos · ` +
      `**${d.counts.dispatched}** dispatched · **${d.counts.merged}** merged · ` +
      `**${d.counts.filed}** filed · **${d.counts.escalated}** escalated · ` +
      `**${d.counts.stalled}** stalled epics · **${d.counts.runs}** agent runs`,
  );

  // Escalated — first, because it is the only section that is someone's queue.
  L.push("", `### 🚨 Escalated → \`needs:human\` (${d.escalated.length})`);
  if (!d.escalated.length) {
    L.push("_none_");
  } else {
    clamp(d.escalated, (e) => {
      // Title always shown: this section is a queue, and a bare ref is not
      // triageable on a phone. The reason comes from the escalating component's
      // own comment; when there is none the label was applied by hand, and
      // saying so IS the reason (nothing automated knows why).
      const why = e.reason
        ? ` — ${e.reason}`
        : ` — labeled by @${e.actor} (no factory reason comment)`;
      const src = e.source ? ` _(${e.source})_` : "";
      return `- ${link(shortId(e.id), e.url)} ${e.kind} "${e.title}"${why}${src}`;
    });
  }
  if (d.suppressedEscalations.length) {
    L.push(
      `<sub>${d.suppressedEscalations.length} escalation(s) already reported in an earlier digest — not repeated.</sub>`,
    );
  }

  // Stalled — the silent failure serialization makes likely.
  const wedged = d.stalled.filter((s) => !s.childless);
  const childless = d.stalled.filter((s) => s.childless);
  L.push("", `### 🧊 Stalled epics (${d.stalled.length}/${d.epicsSeen})`);
  if (!d.stalled.length) {
    L.push("_none_");
  } else {
    if (!wedged.length) L.push("_no epic with open children is wedged_");
    clamp(wedged, (s) => {
      const mix = Object.entries(s.byType)
        .map(([k, v]) => `${v} ${k}`)
        .join(", ");
      const head = `- ${link(shortId(s.id), s.url)} ${s.title} — ${s.openChildren} open child(ren)${mix ? `: ${mix}` : ""}`;
      return s.detail.length ? `${head}\n` + s.detail.map((x) => `  - ${x}`).join("\n") : head;
    });
    if (childless.length) {
      L.push(
        `<sub>${childless.length} epic(s) stalled with no open children — the completion ` +
          `pass (#284) owns them: ${childless.map((s) => shortId(s.id)).join(", ")}</sub>`,
      );
    }
  }

  L.push("", `### 🚀 Dispatched (${d.dispatched.length})`);
  if (!d.dispatched.length) L.push("_none_");
  else
    clamp(d.dispatched, (x) => {
      const by = x.unblockedBy.length
        ? ` ← unblocked by ${x.unblockedBy.map(shortId).join(", ")}`
        : x.blockers.length
          ? " ← blockers cleared earlier"
          : " ← no declared blockers";
      return `- ${link(shortId(x.id), x.url)} ${x.title}${by}`;
    });

  L.push(
    "",
    `### ✅ Merged (${d.merged.length}, ${d.counts.agentBranchMerges} on agent branches) → ` +
      `${d.counts.issuesClosedByMerges} issue(s) closed`,
  );
  if (!d.merged.length) L.push("_none_");
  else
    clamp(d.merged, (m) => {
      const cl = m.closedIssues.length ? ` → closed ${m.closedIssues.map(shortId).join(", ")}` : "";
      return `- ${link(shortId(m.id), m.url)} ${m.title}${cl}`;
    });

  const f = d.filed;
  L.push("", `### 📝 Filed (${f.fixTickets.length + f.hygiene.length + f.hygieneReports.length})`);
  if (!f.fixTickets.length && !f.hygiene.length && !f.hygieneReports.length) {
    L.push("_none_");
  } else {
    clamp(f.fixTickets, (t) => `- fix ticket ${link(shortId(t.id), t.url)} ${t.title}`);
    clamp(f.hygiene, (h) => `- hygiene ${h.action}: ${link(shortId(h.id), h.url)} ${h.title}`);
    clamp(f.hygieneReports, (r) => `- hygiene report ${link(shortId(r.id), r.url)}`);
  }

  L.push("", `### 💸 Spend — ${d.totalRuns} agent run(s) started`);
  if (!d.spend.length) {
    L.push("_none_");
  } else {
    L.push("| repo | implement | review |", "|---|---:|---:|");
    for (const s of d.spend) L.push(`| ${shortId(s.repo)} | ${s.implement} | ${s.review} |`);
  }

  for (const n of d.notes) L.push("", `> ${n}`);

  if (marker) {
    L.push("", `<!-- ${digestMarker(d.day)} -->`);
    L.push(`<!-- ${ESCALATION_KEYS_MARKER} ${d.escalationKeys.join(" ")} -->`);
  }
  return L.join("\n");
}
