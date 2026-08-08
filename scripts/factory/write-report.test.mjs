// Unit tests for the write-failure-isolation report (toon-meta#320). Run
// with:
//   npm run test:factory    (node --test scripts/factory/*.test.mjs)
//
// The scenario under test is the exact live incident: `gh issue edit N
// --add-label needs:human` fails on one issue ('needs:human' not found)
// mid-pass. Acceptance criterion: that failure must not prevent actions on
// issue N+1 or the completion pass that runs after the dispatch loop.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createWriteReport,
  runWrite,
  hasFailures,
  formatFailedSection,
  planLabelPreflight,
} from "./write-report.mjs";

describe("runWrite — a failed write never aborts the pass", () => {
  it("a simulated `gh issue edit` failure on issue N does not prevent issue N+1", () => {
    const report = createWriteReport();
    const attempted = [];

    // Mirrors the live incident: buzz#42 had no needs:human label yet.
    runWrite(report, { type: "needs-human", target: "toon-protocol/buzz#42" }, () => {
      attempted.push("toon-protocol/buzz#42");
      throw new Error("failed to update https://github.com/toon-protocol/buzz/issues/42: 'needs:human' not found");
    });

    // The next issue in the same pass must still run — this is the bug: the
    // old code let the exception above propagate out of the whole script.
    runWrite(report, { type: "dispatch", target: "toon-protocol/relay#7" }, () => {
      attempted.push("toon-protocol/relay#7");
    });

    assert.deepEqual(attempted, ["toon-protocol/buzz#42", "toon-protocol/relay#7"]);
    assert.equal(report.succeeded.length, 1);
    assert.deepEqual(report.succeeded[0], {
      type: "dispatch",
      target: "toon-protocol/relay#7",
      detail: undefined,
    });
  });

  it("does not prevent the completion pass that runs after the dispatch loop", () => {
    const report = createWriteReport();
    const attempted = [];

    for (const child of ["toon-protocol/buzz#42", "toon-protocol/relay#7"]) {
      runWrite(report, { type: "needs-human", target: child }, () => {
        attempted.push(child);
        if (child.includes("buzz")) throw new Error("'needs:human' not found");
      });
    }

    // The epic completion pass (#284) runs unconditionally after dispatch —
    // it must still fire even though a dispatch-pass write failed above.
    runWrite(report, { type: "close-epic", target: "toon-protocol/toon-meta#270" }, () => {
      attempted.push("toon-protocol/toon-meta#270");
    });

    assert.deepEqual(attempted, [
      "toon-protocol/buzz#42",
      "toon-protocol/relay#7",
      "toon-protocol/toon-meta#270",
    ]);
    assert.equal(report.failed.length, 1);
    assert.equal(report.failed[0].target, "toon-protocol/buzz#42");
    assert.match(report.failed[0].error, /needs:human' not found/);
    assert.equal(report.succeeded.length, 2);
  });

  it("records the error text against the target, keyed by write type", () => {
    const report = createWriteReport();
    runWrite(report, { type: "escalate-epic", target: "toon-protocol/Forge#1" }, () => {
      throw new Error("HTTP 404: Not Found");
    });
    assert.deepEqual(report.failed, [
      { type: "escalate-epic", target: "toon-protocol/Forge#1", detail: undefined, error: "HTTP 404: Not Found" },
    ]);
  });

  it("carries a non-Error throw through as a string", () => {
    const report = createWriteReport();
    runWrite(report, { type: "dispatch", target: "toon-protocol/swap#3" }, () => {
      throw "boom"; // eslint-disable-line no-throw-literal
    });
    assert.equal(report.failed[0].error, "boom");
  });
});

describe("hasFailures / formatFailedSection", () => {
  it("is false for an empty or all-succeeded report", () => {
    const report = createWriteReport();
    assert.equal(hasFailures(report), false);
    runWrite(report, { type: "dispatch", target: "x#1" }, () => {});
    assert.equal(hasFailures(report), false);
    assert.equal(formatFailedSection(report), "");
  });

  it("is true once any write fails, and the section lists type/target/error", () => {
    const report = createWriteReport();
    runWrite(report, { type: "needs-human", target: "toon-protocol/buzz#42" }, () => {
      throw new Error("'needs:human' not found");
    });
    assert.equal(hasFailures(report), true);
    const section = formatFailedSection(report);
    assert.match(section, /Failed writes \(1\):/);
    assert.match(section, /needs-human/);
    assert.match(section, /toon-protocol\/buzz#42/);
    assert.match(section, /'needs:human' not found/);
  });
});

describe("planLabelPreflight — trigger-label config drift", () => {
  const REPOS = ["toon-protocol/buzz", "toon-protocol/relay"];
  const REQUIRED = ["agent:implement", "needs:human"];

  it("reports nothing missing when every repo carries both trigger labels", () => {
    const labelsByRepo = {
      "toon-protocol/buzz": ["agent:implement", "needs:human", "bug"],
      "toon-protocol/relay": ["agent:implement", "needs:human"],
    };
    assert.deepEqual(planLabelPreflight({ repos: REPOS, requiredLabels: REQUIRED, labelsByRepo }), {});
  });

  it("reports the exact missing labels per repo (the buzz/Forge incident)", () => {
    const labelsByRepo = {
      "toon-protocol/buzz": ["agent:implement"], // needs:human did not exist yet
      "toon-protocol/relay": ["agent:implement", "needs:human"],
    };
    assert.deepEqual(planLabelPreflight({ repos: REPOS, requiredLabels: REQUIRED, labelsByRepo }), {
      "toon-protocol/buzz": ["needs:human"],
    });
  });

  it("treats an unfetchable repo (no entry) as missing everything required", () => {
    const labelsByRepo = { "toon-protocol/relay": ["agent:implement", "needs:human"] };
    assert.deepEqual(planLabelPreflight({ repos: REPOS, requiredLabels: REQUIRED, labelsByRepo }), {
      "toon-protocol/buzz": REQUIRED,
    });
  });
});
