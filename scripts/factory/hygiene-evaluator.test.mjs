// Unit tests for the ticket-hygiene evaluator (toon-meta#277). Run with:
//   npm run test:factory    (node --test scripts/factory/)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PROTECTED_LABELS,
  STALE_LABEL,
  staleMarker,
  obsoleteMarker,
  closeLinkedIssues,
  referencedIssues,
  parseStuckMarker,
  evaluateStale,
  findObsoleteFromMergedPrs,
  evaluateRemediationObsolete,
  titleTokens,
  clusterRedundant,
} from "./hygiene-evaluator.mjs";

const DAY = 86400000;
const NOW = Date.parse("2026-08-05T12:00:00Z");
const iso = (daysAgo) => new Date(NOW - daysAgo * DAY).toISOString();
const CTX = { now: NOW, staleDays: 30, graceDays: 14 };

const issue = (over = {}) => ({
  number: 42,
  labels: [],
  updatedAt: iso(45),
  referencedByOpenPr: false,
  ...over,
});

// ── markers & reference parsing ─────────────────────────────────────────────

describe("markers and reference parsing", () => {
  it("stale/obsolete markers are slash/hash-free and repo-scoped", () => {
    assert.equal(
      staleMarker("toon-protocol/relay", 7),
      "ticket-hygiene-stale:toon-protocol-relay-issue-7",
    );
    assert.equal(
      obsoleteMarker("toon-protocol/toon-client", 12),
      "ticket-hygiene-obsolete:toon-protocol-toon-client-issue-12",
    );
  });

  it("closeLinkedIssues is strict: close keywords only", () => {
    const s = closeLinkedIssues("Closes #5\nFixes: #9\nresolved #12\nsee #99, part of #100");
    assert.deepEqual([...s].sort((a, b) => a - b), [5, 9, 12]);
  });

  it("referencedIssues is broad: any #N mention counts", () => {
    const s = referencedIssues("see #99, part of #100 and Closes #5");
    assert.deepEqual([...s].sort((a, b) => a - b), [5, 99, 100]);
  });

  it("parseStuckMarker reads housekeeping and legacy triage markers", () => {
    assert.deepEqual(
      parseStuckMarker("…\n<!-- pr-housekeeping-stuck:toon-protocol-relay-pr-45 -->"),
      { source: "pr-housekeeping", repoToken: "toon-protocol-relay", prNumber: 45 },
    );
    assert.deepEqual(
      parseStuckMarker("<!-- triage-sweep-stuck:toon-protocol-toon-client-pr-9 -->"),
      { source: "triage-sweep", repoToken: "toon-protocol-toon-client", prNumber: 9 },
    );
    assert.equal(parseStuckMarker("no marker here #45"), null);
    assert.equal(parseStuckMarker(null), null);
  });
});

// ── evaluateStale ───────────────────────────────────────────────────────────

describe("evaluateStale", () => {
  it("never touches protected labels, even when already stale-labeled", () => {
    for (const l of PROTECTED_LABELS) {
      const r = evaluateStale(issue({ labels: [l], updatedAt: iso(400) }), CTX);
      assert.equal(r.action, "skip-protected", l);
      const r2 = evaluateStale(
        issue({ labels: [l, STALE_LABEL], updatedAt: iso(400), staleMarkedAt: iso(60) }),
        CTX,
      );
      assert.equal(r2.action, "skip-protected", `${l} + stale`);
    }
  });

  it("never stale-touches a housekeeping remediation issue", () => {
    const r = evaluateStale(issue({ hasStuckMarker: true, updatedAt: iso(90) }), CTX);
    assert.equal(r.action, "skip-housekeeping");
  });

  it("an open PR referencing the issue blocks marking", () => {
    const r = evaluateStale(issue({ referencedByOpenPr: true, updatedAt: iso(90) }), CTX);
    assert.equal(r.action, "skip-referenced");
  });

  it("activity within the quiet window → skip-active", () => {
    const r = evaluateStale(issue({ updatedAt: iso(29) }), CTX);
    assert.equal(r.action, "skip-active");
  });

  it("quiet ≥ N days with no PR → mark", () => {
    const r = evaluateStale(issue({ updatedAt: iso(30) }), CTX);
    assert.equal(r.action, "mark");
    assert.match(r.reason, /30d/);
  });

  it("marked, grace not elapsed → wait-grace", () => {
    const r = evaluateStale(
      issue({ labels: [STALE_LABEL], updatedAt: iso(10), staleMarkedAt: iso(10) }),
      CTX,
    );
    assert.equal(r.action, "wait-grace");
  });

  it("marked, grace elapsed, no activity → close", () => {
    const r = evaluateStale(
      issue({ labels: [STALE_LABEL], updatedAt: iso(14), staleMarkedAt: iso(14) }),
      CTX,
    );
    assert.equal(r.action, "close");
  });

  it("the marking's own label+comment updatedAt bump is tolerated (slack)", () => {
    // updatedAt 30 min AFTER the marker comment — still no real activity.
    const marked = NOW - 15 * DAY;
    const r = evaluateStale(
      issue({
        labels: [STALE_LABEL],
        staleMarkedAt: new Date(marked).toISOString(),
        updatedAt: new Date(marked + 30 * 60000).toISOString(),
      }),
      CTX,
    );
    assert.equal(r.action, "close");
  });

  it("a comment after marking → unstale (label removed, clock reset)", () => {
    const r = evaluateStale(
      issue({
        labels: [STALE_LABEL],
        staleMarkedAt: iso(15),
        updatedAt: iso(15),
        commentsSinceMarked: true,
      }),
      CTX,
    );
    assert.equal(r.action, "unstale");
  });

  it("a body edit after marking (updatedAt past slack) → unstale", () => {
    const r = evaluateStale(
      issue({ labels: [STALE_LABEL], staleMarkedAt: iso(15), updatedAt: iso(2) }),
      CTX,
    );
    assert.equal(r.action, "unstale");
  });

  it("an open PR appearing after marking → unstale, not close", () => {
    const r = evaluateStale(
      issue({
        labels: [STALE_LABEL],
        staleMarkedAt: iso(20),
        updatedAt: iso(20),
        referencedByOpenPr: true,
      }),
      CTX,
    );
    assert.equal(r.action, "unstale");
  });

  it("human-applied stale label without our marker is never auto-closed", () => {
    const r = evaluateStale(
      issue({ labels: [STALE_LABEL], updatedAt: iso(120), staleMarkedAt: null }),
      CTX,
    );
    assert.equal(r.action, "stale-unmanaged");
  });
});

// ── findObsoleteFromMergedPrs ───────────────────────────────────────────────

describe("findObsoleteFromMergedPrs", () => {
  const pr = (over = {}) => ({
    number: 100,
    title: "fix the thing",
    body: "Closes #7",
    baseRefName: "main",
    mergedAt: iso(3),
    url: "https://github.com/o/r/pull/100",
    ...over,
  });

  it("flags a still-open issue close-referenced by a merged PR", () => {
    const { closable, skippedProtected } = findObsoleteFromMergedPrs({
      openIssues: [{ number: 7, labels: [] }],
      mergedPrs: [pr()],
      defaultBranch: "main",
    });
    assert.equal(skippedProtected.length, 0);
    assert.equal(closable.length, 1);
    assert.equal(closable[0].issue.number, 7);
    assert.deepEqual(closable[0].prs.map((p) => p.number), [100]);
  });

  it("a close keyword in the TITLE counts (GitHub only processes bodies — the gap)", () => {
    const { closable } = findObsoleteFromMergedPrs({
      openIssues: [{ number: 8, labels: [] }],
      mergedPrs: [pr({ title: "runner gap: fixes #8", body: "no keyword here" })],
      defaultBranch: "main",
    });
    assert.deepEqual(closable.map((c) => c.issue.number), [8]);
  });

  it("ignores PRs merged into a non-default branch (work not landed)", () => {
    const { closable } = findObsoleteFromMergedPrs({
      openIssues: [{ number: 7, labels: [] }],
      mergedPrs: [pr({ baseRefName: "sandcastle/issue-9" })],
      defaultBranch: "main",
    });
    assert.equal(closable.length, 0);
  });

  it("ignores closed issues and plain mentions without close keywords", () => {
    const { closable } = findObsoleteFromMergedPrs({
      openIssues: [{ number: 9, labels: [] }],
      mergedPrs: [pr({ body: "part of #9, see #9" })],
      defaultBranch: "main",
    });
    assert.equal(closable.length, 0);
  });

  it("protected issues are reported, never closable", () => {
    const { closable, skippedProtected } = findObsoleteFromMergedPrs({
      openIssues: [{ number: 7, labels: ["epic"] }],
      mergedPrs: [pr()],
      defaultBranch: "main",
    });
    assert.equal(closable.length, 0);
    assert.equal(skippedProtected.length, 1);
    assert.equal(skippedProtected[0].protectedLabel, "epic");
  });

  it("collects multiple evidence PRs for one issue", () => {
    const { closable } = findObsoleteFromMergedPrs({
      openIssues: [{ number: 7, labels: [] }],
      mergedPrs: [pr(), pr({ number: 101, url: "https://github.com/o/r/pull/101" })],
      defaultBranch: "main",
    });
    assert.deepEqual(closable[0].prs.map((p) => p.number), [100, 101]);
  });
});

// ── evaluateRemediationObsolete ─────────────────────────────────────────────

describe("evaluateRemediationObsolete", () => {
  const marker = { source: "pr-housekeeping", repoToken: "toon-protocol-relay", prNumber: 45 };

  it("target PR merged → close as completed", () => {
    const r = evaluateRemediationObsolete({ marker, pr: { state: "MERGED" } });
    assert.equal(r.action, "close-completed");
    assert.match(r.reason, /#45/);
  });

  it("target PR closed unmerged → close as not planned", () => {
    const r = evaluateRemediationObsolete({ marker, pr: { state: "CLOSED" } });
    assert.equal(r.action, "close-not-planned");
  });

  it("target PR still open → keep open", () => {
    const r = evaluateRemediationObsolete({ marker, pr: { state: "OPEN" } });
    assert.equal(r.action, "keep-open");
  });

  it("unfetchable or weird PR state fails closed → report-only", () => {
    assert.equal(evaluateRemediationObsolete({ marker, pr: null }).action, "report-only");
    assert.equal(
      evaluateRemediationObsolete({ marker, pr: { state: "DRAFT?" } }).action,
      "report-only",
    );
  });

  it("no marker → keep open", () => {
    assert.equal(evaluateRemediationObsolete({ marker: null, pr: null }).action, "keep-open");
  });
});

// ── clusterRedundant ────────────────────────────────────────────────────────

describe("clusterRedundant", () => {
  it("titleTokens lowercases, strips punctuation/stopwords, keeps #refs and numbers", () => {
    const t = titleTokens("Fix the Relay: BTP peering fails on devnet (#45)");
    assert.ok(t.has("relay") && t.has("btp") && t.has("peering") && t.has("devnet"));
    assert.ok(!t.has("the") && !t.has("on") && !t.has("fix"));
  });

  it("clusters near-identical titles and leaves distinct ones alone", () => {
    const clusters = clusterRedundant([
      { number: 1, title: "relay: BTP peering fails on devnet apex" },
      { number: 2, title: "BTP peering to the devnet apex relay fails" },
      { number: 3, title: "wallet balance reads the wrong EVM chain" },
    ]);
    assert.equal(clusters.length, 1);
    assert.deepEqual(clusters[0].issues.map((i) => i.number), [1, 2]);
    assert.ok(clusters[0].pairs[0].score >= 0.6);
  });

  it("short titles cannot cluster on a couple of shared words (minShared)", () => {
    const clusters = clusterRedundant([
      { number: 1, title: "relay peering" },
      { number: 2, title: "relay peering" }, // jaccard 1.0 but only 2 shared tokens
    ]);
    assert.equal(clusters.length, 0);
  });

  it("housekeeping remediation issues never cluster (near-identical by construction)", () => {
    const clusters = clusterRedundant([
      {
        number: 1,
        title: "[housekeeping] Stuck factory PR #45: merge conflict (attempt 1/2)",
        body: "…\n<!-- pr-housekeeping-stuck:toon-protocol-relay-pr-45 -->",
      },
      {
        number: 2,
        title: "[housekeeping] Stuck factory PR #46: merge conflict (attempt 1/2)",
        body: "…\n<!-- pr-housekeeping-stuck:toon-protocol-relay-pr-46 -->",
      },
    ]);
    assert.equal(clusters.length, 0);
  });

  it("transitive pairs merge into one cluster, largest first", () => {
    const clusters = clusterRedundant([
      { number: 1, title: "connector settlement engine drops solana claims" },
      { number: 2, title: "settlement engine drops solana claims in connector" },
      { number: 3, title: "connector settlement engine drops claims (solana)" },
      { number: 4, title: "docs gate misses broken markdown links table" },
      { number: 5, title: "docs gate misses broken links in markdown table" },
    ]);
    assert.equal(clusters.length, 2);
    assert.deepEqual(clusters[0].issues.map((i) => i.number), [1, 2, 3]);
    assert.deepEqual(clusters[1].issues.map((i) => i.number), [4, 5]);
  });

  it("threshold is configurable", () => {
    const issues = [
      { number: 1, title: "relay devnet peering flake under load testing" },
      { number: 2, title: "relay devnet peering flake" },
    ];
    assert.equal(clusterRedundant(issues, { threshold: 0.9 }).length, 0);
    assert.equal(clusterRedundant(issues, { threshold: 0.5 }).length, 1);
  });
});
