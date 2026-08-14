// Unit tests for the fork-PR-approval watch (toon-meta#360). Run with:
//   npm run test:factory    (node --test scripts/factory/*.test.mjs)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  FORK_APPROVAL_LABEL,
  planForkApproval,
  buildSurfaceComment,
  forkApprovalMarker,
} from "./fork-approval-evaluator.mjs";

// Real shape, verified live 2026-08-14 against connector's action_required
// runs from RawNuke/connector (the connector#925 fork PR).
const LIVE_BLOCKED_RUNS = [
  {
    id: 31628435683,
    name: "pr-housekeeping-shim",
    url: "https://github.com/toon-protocol/connector/actions/runs/31628435683",
  },
  {
    id: 31628435797,
    name: "auto-merge-shim",
    url: "https://github.com/toon-protocol/connector/actions/runs/31628435797",
  },
];

describe("planForkApproval — scoped to forks, label is the only idempotency marker", () => {
  it("skips same-repo PRs outright, blocked runs or not", () => {
    assert.deepEqual(
      planForkApproval({ isCrossRepository: false, hasLabel: false, blockedRuns: LIVE_BLOCKED_RUNS }),
      { verdict: "skip", blockedRuns: [] },
    );
    assert.equal(
      planForkApproval({ isCrossRepository: false, hasLabel: true, blockedRuns: LIVE_BLOCKED_RUNS }).verdict,
      "skip",
    );
  });

  it("surfaces a blocked fork PR that has not been labeled yet", () => {
    const v = planForkApproval({
      isCrossRepository: true,
      hasLabel: false,
      blockedRuns: LIVE_BLOCKED_RUNS,
    });
    assert.equal(v.verdict, "surface");
    assert.deepEqual(v.blockedRuns, LIVE_BLOCKED_RUNS);
  });

  it("no-ops a still-blocked fork PR that already carries the label (no duplicate comment)", () => {
    const v = planForkApproval({
      isCrossRepository: true,
      hasLabel: true,
      blockedRuns: LIVE_BLOCKED_RUNS,
    });
    assert.equal(v.verdict, "noop");
  });

  it("clears the label once nothing at the current head is blocked", () => {
    const v = planForkApproval({ isCrossRepository: true, hasLabel: true, blockedRuns: [] });
    assert.equal(v.verdict, "clear");
  });

  it("is a true no-op for a healthy fork PR that was never labeled", () => {
    const v = planForkApproval({ isCrossRepository: true, hasLabel: false, blockedRuns: [] });
    assert.equal(v.verdict, "skip");
  });

  it("treats a missing blockedRuns array the same as an empty one", () => {
    assert.equal(
      planForkApproval({ isCrossRepository: true, hasLabel: false, blockedRuns: undefined }).verdict,
      "skip",
    );
  });
});

describe("buildSurfaceComment — names the PR and every blocked run", () => {
  it("singular phrasing and one bullet for a single blocked run", () => {
    const body = buildSurfaceComment({
      repo: "toon-protocol/connector",
      prNumber: 925,
      blockedRuns: [LIVE_BLOCKED_RUNS[0]],
    });
    assert.match(body, /run is pending maintainer/);
    assert.match(body, /Blocked run:/);
    assert.equal(body.match(/^- \[`/gm)?.length, 1);
    assert.match(body, /\[`pr-housekeeping-shim`\]\(https:\/\/github\.com\/toon-protocol\/connector\/actions\/runs\/31628435683\)/);
  });

  it("plural phrasing and one bullet per run for multiple blocked runs", () => {
    const body = buildSurfaceComment({
      repo: "toon-protocol/connector",
      prNumber: 925,
      blockedRuns: LIVE_BLOCKED_RUNS,
    });
    assert.match(body, /runs are pending maintainer/);
    assert.match(body, /Blocked runs:/);
    assert.equal(body.match(/^- \[`/gm)?.length, 2);
  });

  it("embeds the hidden marker for searchability", () => {
    const body = buildSurfaceComment({
      repo: "toon-protocol/connector",
      prNumber: 925,
      blockedRuns: LIVE_BLOCKED_RUNS,
    });
    assert.match(body, /<!-- fork-approval-watch:toon-protocol-connector-pr-925 -->/);
  });

  it("names the label so the comment stays accurate if the label ever renames", () => {
    const body = buildSurfaceComment({ repo: "r", prNumber: 1, blockedRuns: [LIVE_BLOCKED_RUNS[0]] });
    assert.match(body, new RegExp(FORK_APPROVAL_LABEL.replace(":", "\\:")));
  });
});

describe("forkApprovalMarker — sanitized and repo+PR scoped", () => {
  it("sanitizes non-alphanumeric repo characters", () => {
    assert.equal(
      forkApprovalMarker("toon-protocol/connector", 925),
      "fork-approval-watch:toon-protocol-connector-pr-925",
    );
  });

  it("is distinct per repo and per PR number", () => {
    assert.notEqual(forkApprovalMarker("a/b", 1), forkApprovalMarker("a/c", 1));
    assert.notEqual(forkApprovalMarker("a/b", 1), forkApprovalMarker("a/b", 2));
  });
});
