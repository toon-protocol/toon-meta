// Unblock evaluator (toon-meta#274, epic #270).
//
// The library the dependency-driven dispatcher (#280) is built on: read a
// ticket's `## Blocked by` section and decide whether the ticket is ready to
// work. Pure logic — no GitHub reads or writes in this module. All state
// (blocker issue states, cycle membership) is passed in by the caller, so
// every rule is unit-testable offline.
//
// ── THE THREE SHAPES IN THE WILD ────────────────────────────────────────────
//   1. `None — start immediately.`             → ready (toon-meta#266)
//   2. `- toon-protocol/relay#74 (baseline)`   → decidable from issue state
//                                                 (toon-meta#232)
//   3. `- connector#463 merging, and #459      → NOT decidable: the prose
//        confirming a real >1h run …`             condition is load-bearing
//                                                 (toon-meta#248)
//
// ── RULES (fail closed) ─────────────────────────────────────────────────────
// * `None` (any casing, with or without trailing prose) → ready.
// * Clean issue references — `#N`, `repo#N`, `owner/repo#N`, one per bullet,
//   optionally followed by a single `(annotation)` — must ALL be closed
//   **as completed**. Bare `#N` / `repo#N` resolve against the issue's own
//   repo/owner.
// * Anything else (prose conditions, a bullet mixing a ref and a condition,
//   multiple refs in one bullet, URLs, an empty or missing section) is
//   `unresolvable`: NEVER auto-satisfied. The caller routes the ticket to
//   `needs:human`, naming the offending bullet. Absence of a `## Blocked by`
//   section is NOT a declaration of no blockers.
// * A section that declares `None` AND lists bullets contradicts itself →
//   unresolvable (fail closed).
// * Closed as `not planned` never satisfies a dependency — deciding against a
//   blocker usually invalidates its dependents, so they are flagged for a
//   human rather than released.
// * A blocker whose state the caller did not supply (or whose closed-reason
//   is unrecognized) cannot be verified → routed to a human, not dispatched.
// * Cycles are reported (see detectCycles); a member of a cycle is never
//   dispatched.
//
// ── EXPORTED API ────────────────────────────────────────────────────────────
//   parseBlockedBy(body)                  → { found, none, edges, unresolvable }
//   resolveRef(edge, selfRepo)            → "owner/repo#N" canonical id
//   isReady(issue, blockerStates, opts?)  → readiness verdict (see JSDoc)
//   detectCycles(issues)                  → array of cycles (canonical ids)
//
// Plain Node ESM, zero dependencies. Tests: unblock-evaluator.test.mjs
// (node --test).

// ── Parsing ─────────────────────────────────────────────────────────────────

// A heading line opening the section. Only an exactly-level-2 heading counts.
const SECTION_HEADING_RE = /^##\s+blocked\s+by\s*:?\s*$/i;
// Any level-1/2 heading closes the section.
const SECTION_END_RE = /^#{1,2}\s+\S/;
// A bullet line (list marker) inside the section.
const BULLET_START_RE = /^\s{0,3}[-*+]\s+/;
// An explicit no-blockers declaration: `None`, `none.`, `None — trailing prose`.
const NONE_RE = /^none\b/i;
// A clean, decidable bullet: exactly one issue reference (`#N`, `repo#N`,
// `owner/repo#N`), optionally followed by ONE parenthetical annotation and/or
// a trailing period. Anything beyond this shape is a prose condition.
const CLEAN_BULLET_RE =
  /^(?:(?:(?<owner>[A-Za-z\d](?:[A-Za-z\d-]*[A-Za-z\d])?)\/)?(?<repo>[A-Za-z\d._-]+))?#(?<number>\d+)(?:\s*\((?<note>[^()]*)\))?\.?$/;
// Loose detector for "there is at least one issue-ref-looking token in here",
// used only to word the unresolvable reason.
const REFISH_RE = /(?:[A-Za-z\d._/-]+)?#\d+/;

/**
 * Parse an issue body's `## Blocked by` section into structured dependency
 * edges plus a list of unresolvable bullets. Pure text → data; no I/O.
 *
 * @param {string|null|undefined} body - full issue body (markdown).
 * @returns {{
 *   found: boolean,               // was a `## Blocked by` section present?
 *   none: boolean,                // explicit `None` declaration (→ ready)
 *   edges: Array<{
 *     raw: string,                // the bullet text, verbatim (joined lines)
 *     owner: string|null,         // null when the ref was `repo#N` or `#N`
 *     repo: string|null,          // null when the ref was bare `#N`
 *     number: number,
 *     note: string|null,          // trailing `(annotation)` if present
 *   }>,
 *   unresolvable: Array<{ bullet: string, reason: string }>,
 * }}
 */
export function parseBlockedBy(body) {
  const result = { found: false, none: false, edges: [], unresolvable: [] };

  const lines = String(body ?? "").split(/\r?\n/);
  const start = lines.findIndex((l) => SECTION_HEADING_RE.test(l));
  if (start === -1) {
    result.unresolvable.push({
      bullet: null,
      reason:
        "missing '## Blocked by' section — absence of a declaration is not a declaration of no blockers",
    });
    return result;
  }
  result.found = true;

  // Collect the section: everything until the next level-1/2 heading.
  const section = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (SECTION_END_RE.test(lines[i])) break;
    section.push(lines[i]);
  }

  // Group into items: bullets (with indented/unbroken continuation lines
  // appended) and prose paragraphs. Blank lines separate items.
  const bullets = [];
  const prose = [];
  let current = null; // { kind: "bullet"|"prose", text }
  const flush = () => {
    if (!current) return;
    (current.kind === "bullet" ? bullets : prose).push(current.text.trim());
    current = null;
  };
  for (const line of section) {
    if (!line.trim()) {
      flush();
      continue;
    }
    if (BULLET_START_RE.test(line)) {
      flush();
      current = { kind: "bullet", text: line.replace(BULLET_START_RE, "") };
    } else if (current) {
      current.text += ` ${line.trim()}`; // continuation of the open item
    } else {
      current = { kind: "prose", text: line.trim() };
    }
  }
  flush();

  const noneDeclared =
    prose.some((p) => NONE_RE.test(p)) ||
    bullets.some((b) => NONE_RE.test(b) && !REFISH_RE.test(b));

  if (noneDeclared) {
    const refBullets = bullets.filter((b) => !NONE_RE.test(b) || REFISH_RE.test(b));
    if (refBullets.length > 0) {
      // `None` and a blocker list in the same section contradict each other.
      result.unresolvable.push({
        bullet: refBullets[0],
        reason:
          "section declares 'None' but also lists blocker bullets — contradictory declaration",
      });
      return result;
    }
    result.none = true;
    return result;
  }

  // Prose that is not a `None` declaration is a condition — unresolvable.
  for (const p of prose) {
    result.unresolvable.push({
      bullet: p,
      reason: "prose condition (not a 'None' declaration or an issue-reference bullet)",
    });
  }

  for (const b of bullets) {
    const m = CLEAN_BULLET_RE.exec(b);
    if (m) {
      result.edges.push({
        raw: b,
        owner: m.groups.owner ?? null,
        repo: m.groups.repo ?? null,
        number: Number(m.groups.number),
        note: m.groups.note?.trim() || null,
      });
    } else {
      result.unresolvable.push({
        bullet: b,
        reason: REFISH_RE.test(b)
          ? "mixes an issue reference with a prose condition — the condition is the load-bearing part"
          : "no parsable issue reference",
      });
    }
  }

  if (result.edges.length === 0 && result.unresolvable.length === 0) {
    // Section present but empty: not a declaration either way. Fail closed.
    result.unresolvable.push({
      bullet: null,
      reason: "'## Blocked by' section is empty — not a declaration of no blockers",
    });
  }

  return result;
}

// ── Reference resolution ────────────────────────────────────────────────────

/**
 * Canonicalize a parsed edge against the depending issue's own repo.
 * `#N` → selfRepo#N; `repo#N` → selfOwner/repo#N; `owner/repo#N` unchanged.
 * Canonical ids are lowercased (GitHub owner/repo names are case-insensitive)
 * — use this same function to build `blockerStates` keys.
 *
 * @param {{ owner: string|null, repo: string|null, number: number }} edge
 * @param {string} selfRepo - the depending issue's repo as "owner/name".
 * @returns {string} canonical id, e.g. "toon-protocol/relay#74".
 */
export function resolveRef(edge, selfRepo) {
  const self = String(selfRepo ?? "").toLowerCase();
  const [selfOwner] = self.split("/");
  if (!selfOwner) throw new Error(`resolveRef: selfRepo must be "owner/name", got "${selfRepo}"`);
  let full;
  if (edge.owner && edge.repo) full = `${edge.owner}/${edge.repo}`;
  else if (edge.repo) full = `${selfOwner}/${edge.repo}`;
  else full = self;
  return `${full.toLowerCase()}#${edge.number}`;
}

// ── Readiness ───────────────────────────────────────────────────────────────

const normalizeReason = (r) =>
  String(r ?? "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

function lookupState(blockerStates, id) {
  if (!blockerStates) return undefined;
  if (blockerStates instanceof Map) {
    for (const [k, v] of blockerStates) if (String(k).toLowerCase() === id) return v;
    return undefined;
  }
  for (const k of Object.keys(blockerStates))
    if (k.toLowerCase() === id) return blockerStates[k];
  return undefined;
}

/**
 * Decide whether an issue is ready to dispatch. Pure — every input is passed
 * in; the caller fetches issue bodies/states and runs detectCycles first.
 *
 * @param {{ repo: string, number?: number, body: string }} issue
 *   - repo: "owner/name" (used to resolve bare `#N` / `repo#N` refs).
 * @param {Object<string,{state:string,stateReason?:string}>|Map} blockerStates
 *   Keyed by canonical id (see resolveRef; keys matched case-insensitively).
 *   `state`: "open"|"closed" (gh casing accepted); `stateReason`:
 *   "completed"|"not_planned" etc. Only closed+completed satisfies.
 * @param {{ cycleMembers?: Iterable<string> }} [opts]
 *   cycleMembers: canonical ids known to sit on a dependency cycle
 *   (from detectCycles). If this issue is a member it is never dispatched.
 * @returns {{
 *   ready: boolean,
 *   verdict: "ready"|"blocked"|"needs-human"|"cycle",
 *   reasons: string[],                 // human-readable, names offending bullets
 *   unresolvable: Array<{bullet:string|null, reason:string}>,
 *   blockers: {
 *     completed: string[],             // closed as completed — satisfied
 *     open: string[],                  // still open — wait (verdict "blocked")
 *     notPlanned: string[],            // closed as not planned — needs-human
 *     unknown: string[],               // no state supplied / unrecognized close
 *   },
 * }}
 *   `ready` is true ONLY for verdict "ready". "needs-human" means route to
 *   `needs:human` with the reasons as the comment.
 */
export function isReady(issue, blockerStates, opts = {}) {
  const parsed = parseBlockedBy(issue.body);
  const out = {
    ready: false,
    verdict: "blocked",
    reasons: [],
    unresolvable: parsed.unresolvable,
    blockers: { completed: [], open: [], notPlanned: [], unknown: [] },
  };

  // Cycle membership trumps everything: never dispatch a member of a cycle.
  const cycleMembers = new Set(
    [...(opts.cycleMembers ?? [])].map((id) => String(id).toLowerCase()),
  );
  const selfId =
    issue.number != null ? `${String(issue.repo).toLowerCase()}#${issue.number}` : null;
  if (selfId && cycleMembers.has(selfId)) {
    out.verdict = "cycle";
    out.reasons.push(`issue ${selfId} is a member of a dependency cycle — never dispatched`);
    return out;
  }

  if (parsed.none) {
    out.ready = true;
    out.verdict = "ready";
    out.reasons.push("'## Blocked by' declares None");
    return out;
  }

  for (const u of parsed.unresolvable) {
    out.reasons.push(
      u.bullet != null
        ? `unresolvable bullet: "${u.bullet}" — ${u.reason}`
        : `unresolvable: ${u.reason}`,
    );
  }

  for (const edge of parsed.edges) {
    const id = resolveRef(edge, issue.repo);
    const st = lookupState(blockerStates, id);
    if (!st) {
      out.blockers.unknown.push(id);
      out.reasons.push(`blocker ${id}: no state supplied — cannot verify, failing closed`);
      continue;
    }
    const state = String(st.state ?? "").toLowerCase();
    const reason = normalizeReason(st.stateReason);
    if (state === "closed" && reason === "completed") {
      out.blockers.completed.push(id);
    } else if (state === "closed" && reason === "not_planned") {
      out.blockers.notPlanned.push(id);
      out.reasons.push(
        `blocker ${id} was closed as not planned — this does NOT satisfy the dependency; ` +
          `the dependent is likely invalidated and needs a human decision`,
      );
    } else if (state === "open") {
      out.blockers.open.push(id);
    } else {
      // Closed with an unrecognized/absent reason (e.g. reopened race, old
      // API shape): cannot confirm "closed as completed" — fail closed.
      out.blockers.unknown.push(id);
      out.reasons.push(
        `blocker ${id}: closed but not verifiably 'completed' ` +
          `(state=${st.state}, stateReason=${st.stateReason ?? "∅"}) — failing closed`,
      );
    }
  }

  if (
    parsed.unresolvable.length > 0 ||
    out.blockers.notPlanned.length > 0 ||
    out.blockers.unknown.length > 0
  ) {
    out.verdict = "needs-human";
    return out;
  }
  if (out.blockers.open.length > 0) {
    out.verdict = "blocked";
    out.reasons.push(`waiting on open blocker(s): ${out.blockers.open.join(", ")}`);
    return out;
  }
  out.ready = true;
  out.verdict = "ready";
  out.reasons.push(
    parsed.edges.length
      ? `all ${parsed.edges.length} blocker(s) closed as completed`
      : "no decidable blockers", // unreachable in practice (empty → unresolvable)
  );
  return out;
}

// ── Cycle detection ─────────────────────────────────────────────────────────

/**
 * Detect dependency cycles across a set of issues. Only clean edges
 * participate (unresolvable bullets contribute no edges — those issues are
 * already routed to a human). Edges pointing outside the provided set are
 * dead ends and cannot close a cycle.
 *
 * @param {Array<{ repo: string, number: number, body: string }>} issues
 * @returns {string[][]} cycles, each an array of canonical ids
 *   ("owner/repo#N"). Feed the flattened union to isReady's
 *   `opts.cycleMembers` so members are never dispatched.
 */
export function detectCycles(issues) {
  const adj = new Map(); // canonical id → [canonical dep ids]
  for (const iss of issues) {
    const id = `${String(iss.repo).toLowerCase()}#${iss.number}`;
    const parsed = parseBlockedBy(iss.body);
    adj.set(
      id,
      parsed.edges.map((e) => resolveRef(e, iss.repo)),
    );
  }

  // Tarjan's SCC. A cycle is an SCC of size > 1, or a self-loop.
  const index = new Map();
  const low = new Map();
  const onStack = new Set();
  const stack = [];
  let counter = 0;
  const cycles = [];

  function strongConnect(v) {
    index.set(v, counter);
    low.set(v, counter);
    counter++;
    stack.push(v);
    onStack.add(v);
    for (const w of adj.get(v) ?? []) {
      if (!adj.has(w)) continue; // edge leaves the known set — dead end
      if (!index.has(w)) {
        strongConnect(w);
        low.set(v, Math.min(low.get(v), low.get(w)));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v), index.get(w)));
      }
    }
    if (low.get(v) === index.get(v)) {
      const scc = [];
      let w;
      do {
        w = stack.pop();
        onStack.delete(w);
        scc.push(w);
      } while (w !== v);
      if (scc.length > 1 || (adj.get(v) ?? []).includes(v)) cycles.push(scc.reverse());
    }
  }

  for (const v of adj.keys()) if (!index.has(v)) strongConnect(v);
  return cycles;
}
