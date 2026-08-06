// Unit tests for the daily-digest evaluator (toon-meta#286).
// Run: npm run test:factory  (node --test "scripts/factory/*.test.mjs")

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildDigest,
  renderDigest,
  escalationKey,
  parseReportedEscalationKeys,
  extractEscalationReason,
  classifyHygieneClose,
  digestMarker,
  utcDay,
  shortId,
  ESCALATION_KEYS_MARKER,
} from "./digest-evaluator.mjs";

const NOW = Date.parse("2026-08-06T18:00:00Z");
const ago = (h) => new Date(NOW - h * 3600_000).toISOString();

const ev = (over = {}) => ({
  repo: "toon-protocol/relay",
  event: "labeled",
  createdAt: ago(2),
  label: "agent:implement",
  actor: "factory-ops",
  issue: { number: 10, title: "a ticket", url: "https://x/10", isPr: false },
  ...over,
});

// ── window ──────────────────────────────────────────────────────────────────

test("only events inside the window are reported", () => {
  const d = buildDigest({
    now: NOW,
    events: [
      ev({ createdAt: ago(2), issue: { number: 1, title: "in", isPr: false } }),
      ev({ createdAt: ago(30), issue: { number: 2, title: "out", isPr: false } }),
    ],
  });
  assert.deepEqual(
    d.dispatched.map((x) => x.number),
    [1],
  );
});

test("utcDay / shortId", () => {
  assert.equal(utcDay("2026-08-06T23:59:59Z"), "2026-08-06");
  assert.equal(shortId("toon-protocol/relay#88"), "relay#88");
});

// ── dispatched ──────────────────────────────────────────────────────────────

test("a dispatch names the blocker that closed in-window", () => {
  const d = buildDigest({
    now: NOW,
    events: [
      ev({
        createdAt: ago(1),
        issue: { number: 10, title: "child", url: "u10", isPr: false },
      }),
      {
        repo: "toon-protocol/relay",
        event: "closed",
        createdAt: ago(2),
        actor: "someone",
        issue: { number: 9, title: "blocker", url: "u9", isPr: false, stateReason: "completed" },
      },
    ],
    dispatchedBodies: {
      "toon-protocol/relay#10": "## Blocked by\n\n- #9\n- toon-protocol/toon-meta#4\n",
    },
  });
  assert.equal(d.dispatched.length, 1);
  assert.deepEqual(d.dispatched[0].unblockedBy, ["toon-protocol/relay#9"]);
  assert.equal(d.dispatched[0].blockers.length, 2);
});

test("dispatches on PRs are ignored and a ticket is listed once per day", () => {
  const d = buildDigest({
    now: NOW,
    events: [
      ev({ issue: { number: 77, title: "pr", isPr: true } }),
      ev({ createdAt: ago(3), issue: { number: 10, title: "t", isPr: false } }),
      ev({ createdAt: ago(1), issue: { number: 10, title: "t", isPr: false } }),
    ],
  });
  assert.equal(d.dispatched.length, 1);
});

// ── merged ──────────────────────────────────────────────────────────────────

test("merged agent PRs report the issues that closed as a result", () => {
  const d = buildDigest({
    now: NOW,
    events: [
      {
        repo: "toon-protocol/relay",
        event: "closed",
        createdAt: ago(1),
        issue: { number: 42, title: "the issue", isPr: false, stateReason: "completed" },
      },
    ],
    mergedPrs: [
      {
        repo: "toon-protocol/relay",
        number: 100,
        title: "do the thing",
        mergedAt: ago(1),
        headRefName: "sandcastle/issue-42",
        body: "Closes #42\nCloses #43",
        mergedBy: "whoever",
      },
      { repo: "toon-protocol/relay", number: 99, title: "old", mergedAt: ago(48), body: "" },
    ],
  });
  assert.equal(d.merged.length, 1);
  assert.deepEqual(d.merged[0].closedIssues, ["toon-protocol/relay#42"]);
  assert.equal(d.counts.issuesClosedByMerges, 1);
});

test("merges on ticket-named branches are reported too, tagged non-agent-branch", () => {
  // Real factory PRs land on `epic270/286-…` branches; filtering on the
  // dispatcher's `sandcastle/`/`agent/` prefixes would report an empty day.
  const d = buildDigest({
    now: NOW,
    mergedPrs: [
      {
        repo: "toon-protocol/toon-meta",
        number: 303,
        title: "approver",
        mergedAt: ago(2),
        headRefName: "epic270/282-approver",
        body: "Closes #282",
      },
      {
        repo: "toon-protocol/relay",
        number: 90,
        title: "agent work",
        mergedAt: ago(3),
        headRefName: "sandcastle/issue-7",
        body: "",
      },
    ],
  });
  assert.equal(d.counts.merged, 2);
  assert.equal(d.counts.agentBranchMerges, 1);
  assert.match(renderDigest(d), /Merged \(2, 1 on agent branches\)/);
});

// ── filed ───────────────────────────────────────────────────────────────────

test("fix tickets are recognised by the housekeeping stuck marker", () => {
  const d = buildDigest({
    now: NOW,
    openedIssues: [
      {
        repo: "toon-protocol/buzz",
        number: 200,
        title: "[housekeeping] Stuck factory PR #55: conflict (attempt 1/2)",
        createdAt: ago(4),
        body: "blah <!-- pr-housekeeping-stuck:toon-protocol-buzz-pr-55 -->",
      },
      { repo: "toon-protocol/buzz", number: 201, title: "unrelated", createdAt: ago(4), body: "" },
    ],
  });
  assert.equal(d.filed.fixTickets.length, 1);
  assert.equal(d.filed.fixTickets[0].targetPr, 55);
});

test("hygiene actions: stale marks, unstale, and only PROVEN hygiene closes", () => {
  const d = buildDigest({
    now: NOW,
    // Provenance, not actor: both closes below were done by the same login.
    closeProvenance: {
      "toon-protocol/relay#3": { hygiene: true, kind: "stale" },
      "toon-protocol/relay#4": { hygiene: false, kind: "" },
    },
    events: [
      ev({ label: "stale", issue: { number: 1, title: "quiet", isPr: false } }),
      ev({ event: "unlabeled", label: "stale", issue: { number: 2, title: "woke", isPr: false } }),
      {
        repo: "toon-protocol/relay",
        event: "closed",
        createdAt: ago(2),
        actor: "ALLiDoizCode",
        issue: { number: 3, title: "dropped", isPr: false, stateReason: "not_planned" },
      },
      {
        repo: "toon-protocol/relay",
        event: "closed",
        createdAt: ago(2),
        actor: "ALLiDoizCode",
        issue: { number: 4, title: "human call", isPr: false, stateReason: "not_planned" },
      },
    ],
  });
  const actions = d.filed.hygiene.map((h) => `${h.action} ${h.id}`);
  assert.deepEqual(actions.sort(), [
    "auto-close (stale) toon-protocol/relay#3",
    "stale-mark toon-protocol/relay#1",
    "unstale toon-protocol/relay#2",
  ]);
});

test("classifyHygieneClose reads provenance from the sweep's own comments", () => {
  assert.deepEqual(
    classifyHygieneClose([{ body: "<!-- ticket-hygiene-obsolete:toon-protocol-relay-issue-9 -->" }]),
    { hygiene: true, kind: "obsolete" },
  );
  assert.deepEqual(
    classifyHygieneClose([{ body: "Closing as stale (weekly ticket hygiene, toon-meta#277)…" }]),
    { hygiene: true, kind: "stale" },
  );
  // A human's own not-planned close, and the stale WARNING marker (not a close).
  assert.deepEqual(classifyHygieneClose([{ body: "superseded by #12" }]), {
    hygiene: false,
    kind: "",
  });
  assert.deepEqual(
    classifyHygieneClose([{ body: "<!-- ticket-hygiene-stale:toon-protocol-relay-issue-9 -->" }]),
    { hygiene: false, kind: "" },
  );
  assert.deepEqual(classifyHygieneClose(), { hygiene: false, kind: "" });
});

// ── escalated ───────────────────────────────────────────────────────────────

const escEvent = (over = {}) =>
  ev({
    label: "needs:human",
    createdAt: ago(3),
    issue: { number: 5, title: "wedged", url: "u5", isPr: false },
    ...over,
  });

test("escalations carry their reason and a stable key", () => {
  const d = buildDigest({
    now: NOW,
    events: [escEvent()],
    escalationReasons: {
      "toon-protocol/relay#5": { reason: "blocker relay#4 closed as not planned", source: "x" },
    },
  });
  assert.equal(d.escalated.length, 1);
  assert.equal(d.escalated[0].reason, "blocker relay#4 closed as not planned");
  assert.equal(d.escalated[0].key, `toon-protocol/relay#5@${ago(3).replace(/\.\d+Z$/, "Z")}`);
  assert.deepEqual(d.escalationKeys, [d.escalated[0].key]);
});

test("a flapping label collapses to one escalation (dedupe layer 1)", () => {
  const d = buildDigest({
    now: NOW,
    events: [escEvent({ createdAt: ago(5) }), escEvent({ createdAt: ago(2) })],
  });
  assert.equal(d.escalated.length, 1);
  assert.equal(d.escalated[0].at, ago(2)); // the latest transition wins
});

test("keys reported by an earlier digest are suppressed (dedupe layer 2)", () => {
  const key = escalationKey({ repo: "toon-protocol/relay", number: 5, at: ago(3) });
  const d = buildDigest({
    now: NOW,
    events: [escEvent()],
    reportedEscalationKeys: [key],
  });
  assert.equal(d.escalated.length, 0);
  assert.equal(d.suppressedEscalations.length, 1);
  assert.deepEqual(d.escalationKeys, []);
});

test("a genuine re-escalation is a new key, so it IS reported again", () => {
  const old = escalationKey({ repo: "toon-protocol/relay", number: 5, at: ago(30) });
  const d = buildDigest({
    now: NOW,
    events: [escEvent({ createdAt: ago(1) })],
    reportedEscalationKeys: [old],
  });
  assert.equal(d.escalated.length, 1);
});

test("escalations on PRs are reported too, tagged as PRs", () => {
  const d = buildDigest({
    now: NOW,
    events: [escEvent({ issue: { number: 300, title: "stuck pr", isPr: true } })],
  });
  assert.equal(d.escalated[0].kind, "PR");
});

test("an escalation line always carries the title, with or without a reason", () => {
  const withReason = renderDigest(
    buildDigest({
      now: NOW,
      events: [escEvent()],
      escalationReasons: { "toon-protocol/relay#5": { reason: "blocker not planned", source: "s" } },
    }),
  );
  assert.match(withReason, /relay#5\]\(u5\) issue "wedged" — blocker not planned _\(s\)_/);
  const noReason = renderDigest(buildDigest({ now: NOW, events: [escEvent()] }));
  assert.match(noReason, /issue "wedged" — labeled by @factory-ops \(no factory reason comment\)/);
});

test("escalation keys round-trip through the hidden marker line", () => {
  const d = buildDigest({ now: NOW, events: [escEvent()] });
  const body = renderDigest(d);
  assert.deepEqual(parseReportedEscalationKeys([body]), d.escalationKeys);
  assert.deepEqual(parseReportedEscalationKeys([{ body }]), d.escalationKeys);
  assert.ok(body.includes(digestMarker(d.day)));
});

test("parseReportedEscalationKeys tolerates empty / absent marker lines", () => {
  assert.deepEqual(parseReportedEscalationKeys(["no marker here"]), []);
  assert.deepEqual(parseReportedEscalationKeys([`<!-- ${ESCALATION_KEYS_MARKER}  -->`]), []);
});

// ── escalation reason extraction ────────────────────────────────────────────

test("extractEscalationReason prefers the newest factory comment and its bullets", () => {
  const got = extractEscalationReason([
    { createdAt: ago(9), body: "chit chat" },
    {
      createdAt: ago(5),
      body:
        "The unblock dispatcher (toon-meta#280) cannot mechanically release this ticket:\n\n" +
        "- blocker relay#4 is closed as **not planned**\n\n" +
        "<!-- unblock-dispatcher-needs-human:toon-protocol-relay-issue-5 -->",
    },
  ]);
  assert.equal(got.source, "unblock dispatcher (#280)");
  assert.equal(got.reason, "blocker relay#4 is closed as not planned");
});

test("extractEscalationReason recognises the marker-less housekeeping escalation", () => {
  const got = extractEscalationReason([
    { createdAt: ago(1), body: "⚠️ **PR housekeeping escalation.** This factory PR is still stuck (conflict) after 2 attempts." },
  ]);
  assert.equal(got.source, "pr housekeeping (#276)");
  assert.match(got.reason, /still stuck/);
});

test("extractEscalationReason returns empty for a human-applied label", () => {
  assert.deepEqual(extractEscalationReason([{ createdAt: ago(1), body: "I'll take this" }]), {
    reason: "",
    source: "",
  });
  assert.deepEqual(extractEscalationReason([]), { reason: "", source: "" });
});

// ── stalled ─────────────────────────────────────────────────────────────────

test("stalled epics are taken from planDispatch and explained by child verdicts", () => {
  const plan = {
    epics: [
      { id: "toon-protocol/toon-meta#270", title: "AFK factory", url: "u", openChildren: 3, stalled: true },
      { id: "toon-protocol/toon-meta#262", title: "money", url: "u2", openChildren: 2, stalled: false },
    ],
    actions: [
      {
        type: "needs-human",
        epicIds: ["toon-protocol/toon-meta#270"],
        child: { id: "toon-protocol/toon-meta#291" },
        reasons: ["blocker toon-meta#12 is closed as not planned"],
      },
      {
        type: "blocked",
        epicIds: ["toon-protocol/toon-meta#270"],
        child: { id: "toon-protocol/toon-meta#292" },
        reasons: ["waiting on toon-meta#291"],
      },
      {
        type: "blocked",
        epicIds: ["toon-protocol/toon-meta#270"],
        child: { id: "toon-protocol/toon-meta#293" },
        reasons: ["waiting on toon-meta#291"],
      },
    ],
  };
  const d = buildDigest({ now: NOW, plan });
  assert.equal(d.stalled.length, 1);
  assert.equal(d.stalled[0].id, "toon-protocol/toon-meta#270");
  assert.deepEqual(d.stalled[0].byType, { "needs-human": 1, blocked: 2 });
  assert.match(d.stalled[0].detail[0], /toon-meta#291: blocker/);
  assert.equal(d.epicsSeen, 2);
});

test("a childless stalled epic is collapsed to one line, wedged epics are listed", () => {
  const d = buildDigest({
    now: NOW,
    plan: {
      epics: [
        { id: "o/r#1", title: "finished?", openChildren: 0, stalled: true },
        { id: "o/r#2", title: "wedged", openChildren: 2, stalled: true },
      ],
      actions: [
        {
          type: "needs-human",
          epicIds: ["o/r#2"],
          child: { id: "o/r#9" },
          reasons: ["prose blocker bullet"],
        },
      ],
    },
  });
  assert.equal(d.stalled[0].id, "o/r#2", "epics with open children sort first");
  assert.equal(d.stalled[0].childless, false);
  assert.equal(d.stalled[1].childless, true);
  const out = renderDigest(d);
  assert.match(out, /- r#2 wedged — 2 open child\(ren\): 1 needs-human/);
  assert.match(out, /1 epic\(s\) stalled with no open children — the completion pass \(#284\) owns them: r#1/);
  assert.ok(!/^- .*r#1/m.test(out), "a childless epic never gets its own bullet");
});

// ── spend ───────────────────────────────────────────────────────────────────

test("spend counts runs per repo, busiest first, zero-run repos omitted", () => {
  const d = buildDigest({
    now: NOW,
    runs: {
      "toon-protocol/relay": { implement: 1, review: 1 },
      "toon-protocol/buzz": { implement: 5, review: 3 },
      "toon-protocol/store": { implement: 0, review: 0 },
    },
  });
  assert.deepEqual(
    d.spend.map((s) => s.repo),
    ["toon-protocol/buzz", "toon-protocol/relay"],
  );
  assert.equal(d.totalRuns, 10);
});

// ── rendering ───────────────────────────────────────────────────────────────

test("render puts escalations first and is terse when nothing happened", () => {
  const d = buildDigest({ now: NOW, repos: ["a/b"] });
  const out = renderDigest(d);
  const lines = out.split("\n");
  assert.match(lines[0], /^## Factory digest — 2026-08-06$/);
  assert.ok(out.indexOf("Escalated") < out.indexOf("Stalled epics"));
  assert.ok(out.indexOf("Stalled epics") < out.indexOf("Dispatched"));
  assert.ok(out.indexOf("Dispatched") < out.indexOf("Merged"));
  assert.ok(out.indexOf("Merged") < out.indexOf("Spend"));
  assert.equal((out.match(/_none_/g) ?? []).length, 6); // all six sections, explicitly empty
  assert.ok(out.length < 900, `empty digest should stay tiny, got ${out.length}`);
});

test("render clamps long sections with a +N more tail", () => {
  const events = [];
  for (let n = 1; n <= 20; n++) {
    events.push(ev({ createdAt: ago(1), issue: { number: n, title: `t${n}`, isPr: false } }));
  }
  const out = renderDigest(buildDigest({ now: NOW, events }), { maxRows: 5 });
  assert.match(out, /…and 15 more/);
});

test("render notes suppressed escalations without listing them", () => {
  const key = escalationKey({ repo: "toon-protocol/relay", number: 5, at: ago(3) });
  const d = buildDigest({ now: NOW, events: [escEvent()], reportedEscalationKeys: [key] });
  const out = renderDigest(d);
  assert.match(out, /1 escalation\(s\) already reported/);
  assert.ok(!out.includes("relay#5]"), "suppressed escalation must not be listed again");
});

test("render is deterministic for the same input", () => {
  const input = {
    now: NOW,
    events: [escEvent(), ev()],
    mergedPrs: [{ repo: "toon-protocol/relay", number: 1, title: "x", mergedAt: ago(1), body: "" }],
  };
  assert.equal(renderDigest(buildDigest(input)), renderDigest(buildDigest(input)));
});
