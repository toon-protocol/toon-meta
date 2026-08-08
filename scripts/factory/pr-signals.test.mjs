// Unit tests for the shared PR merge signals (toon-meta#285). Run with:
//   npm run test:factory    (node --test scripts/factory/*.test.mjs)
//
// These cover behaviour that pr-housekeeping.mjs (#276) relied on before the
// extraction and that auto-merge.mjs (#285) now relies on too — in particular
// the empty/skipped honesty rule, which is an acceptance criterion on #285.
// Check-rollup fixtures are the real live shapes read on 2026-08-06 via
// `gh pr view --json statusCheckRollup`.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checksVerdict, normalizeCheck, settleMergeable } from "./pr-signals.mjs";

// ── Real shape: Forge#50 — a single green gate check ────────────────────────
const ROLLUP_FORGE_50 = [
  {
    __typename: "CheckRun",
    name: "gate",
    status: "COMPLETED",
    conclusion: "SUCCESS",
    workflowName: "CI",
  },
];

// ── Real shape: connector#826 — a mixed red rollup ──────────────────────────
const ROLLUP_CONNECTOR_826 = [
  { name: "Lint and Format Check", status: "COMPLETED", conclusion: "SUCCESS" },
  { name: "Security Audit", status: "COMPLETED", conclusion: "FAILURE" },
  { name: "Rust Workspace Gate", status: "COMPLETED", conclusion: "FAILURE" },
  { name: "Solana Program Tests (Rust)", status: "COMPLETED", conclusion: "SUCCESS" },
  { name: "Devbox Environment Validation", status: "COMPLETED", conclusion: "FAILURE" },
  { name: "CI Status Summary", status: "COMPLETED", conclusion: "CANCELLED" },
];

describe("checksVerdict — four-valued, never 'nothing failed'", () => {
  it("passes only when something actually ran green", () => {
    assert.equal(checksVerdict(ROLLUP_FORGE_50).verdict, "passed");
  });

  it("treats an EMPTY rollup as unverified, not passed (the buzz#141 gotcha)", () => {
    assert.equal(checksVerdict([]).verdict, "unverified");
    assert.equal(checksVerdict(null).verdict, "unverified");
    assert.equal(checksVerdict(undefined).verdict, "unverified");
  });

  it("treats an all-SKIPPED rollup as unverified (paths-filtered CI)", () => {
    const rollup = [
      { name: "unit", status: "COMPLETED", conclusion: "SKIPPED" },
      { name: "e2e", status: "COMPLETED", conclusion: "SKIPPED" },
      { name: "lint", status: "COMPLETED", conclusion: "NEUTRAL" },
    ];
    assert.equal(checksVerdict(rollup).verdict, "unverified");
  });

  it("reports failing checks by name, and CANCELLED counts as failing", () => {
    const v = checksVerdict(ROLLUP_CONNECTOR_826);
    assert.equal(v.verdict, "failing");
    assert.deepEqual(
      v.failing.map((f) => f.name).sort(),
      [
        "CI Status Summary",
        "Devbox Environment Validation",
        "Rust Workspace Gate",
        "Security Audit",
      ],
    );
  });

  it("failing beats pending beats passed", () => {
    assert.equal(
      checksVerdict([
        { name: "a", conclusion: "SUCCESS" },
        { name: "b", status: "IN_PROGRESS" },
        { name: "c", conclusion: "FAILURE" },
      ]).verdict,
      "failing",
    );
    assert.equal(
      checksVerdict([
        { name: "a", conclusion: "SUCCESS" },
        { name: "b", status: "QUEUED" },
      ]).verdict,
      "pending",
    );
  });

  it("reads the StatusContext shape (context/state) as well as CheckRun", () => {
    assert.equal(
      checksVerdict([{ __typename: "StatusContext", context: "ci/legacy", state: "SUCCESS" }])
        .verdict,
      "passed",
    );
    assert.deepEqual(normalizeCheck({ context: "ci/legacy", state: "success" }), {
      name: "ci/legacy",
      state: "SUCCESS",
    });
  });
});

describe("settleMergeable — mergeability is computed asynchronously", () => {
  const noSleep = async () => {};

  it("returns a value that is already settled without refetching", async () => {
    let calls = 0;
    const v = await settleMergeable({
      initial: "MERGEABLE",
      refetch: async () => {
        calls++;
        return "CONFLICTING";
      },
      sleep: noSleep,
    });
    assert.equal(v, "MERGEABLE");
    assert.equal(calls, 0);
  });

  it("polls out of UNKNOWN and returns the settled value", async () => {
    const seq = ["UNKNOWN", "UNKNOWN", "CONFLICTING"];
    let i = 0;
    const v = await settleMergeable({
      initial: "UNKNOWN",
      refetch: async () => seq[i++],
      sleep: noSleep,
      tries: 8,
    });
    assert.equal(v, "CONFLICTING");
    assert.equal(i, 3);
  });

  it("gives up after the budget and returns UNKNOWN — never a guess", async () => {
    let calls = 0;
    const v = await settleMergeable({
      initial: "UNKNOWN",
      refetch: async () => {
        calls++;
        return "UNKNOWN";
      },
      sleep: noSleep,
      tries: 3,
    });
    assert.equal(v, "UNKNOWN");
    assert.equal(calls, 3);
  });

  it("treats a failed refetch (undefined) as still unknown", async () => {
    const v = await settleMergeable({
      initial: "UNKNOWN",
      refetch: async () => undefined,
      sleep: noSleep,
      tries: 2,
    });
    assert.equal(v, "UNKNOWN");
  });

  it("waits between polls with the configured interval", async () => {
    const waited = [];
    await settleMergeable({
      initial: "UNKNOWN",
      refetch: async () => "UNKNOWN",
      sleep: async (ms) => waited.push(ms),
      tries: 3,
      intervalMs: 1234,
    });
    assert.deepEqual(waited, [1234, 1234, 1234]);
  });
});
