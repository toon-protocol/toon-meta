// Unit tests for the PR repair evaluator (toon-meta#357). Run with:
//   npm run test:factory    (node --test scripts/factory/*.test.mjs)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  AGENT_FIX_LABEL,
  DEFAULT_REPAIR_BUDGET,
  DEFAULT_RETRY_BUDGET,
  classifyCheckFailure,
  classifyFailures,
  redOnMain,
  planRepair,
} from "./repair-evaluator.mjs";

describe("classifyCheckFailure", () => {
  it("classifies a CDN 503 inside a setup step as transient (#357's own example)", () => {
    assert.equal(
      classifyCheckFailure({
        name: "setup-toolchain",
        errorText: "curl: (22) The requested URL returned error: 503",
      }),
      "transient",
    );
  });

  it("classifies a known-flaky host mention with a transport error as transient", () => {
    assert.equal(
      classifyCheckFailure({
        name: "install-deps",
        errorText: "Failed to fetch https://artifacts.nixos.org/nar/xyz: HTTP/1.1 503 Service Unavailable",
      }),
      "transient",
    );
  });

  it("fails closed to genuine when no error text was captured, even with an infra-shaped name", () => {
    assert.equal(classifyCheckFailure({ name: "setup-toolchain", errorText: "" }), "genuine");
  });

  it("classifies a compiler error inside a download-named step as genuine (name alone is not evidence)", () => {
    assert.equal(
      classifyCheckFailure({
        name: "fetch-and-build",
        errorText: "error[E0433]: failed to resolve: use of undeclared crate `foo`",
      }),
      "genuine",
    );
  });

  it("classifies a real test/lint failure as genuine", () => {
    assert.equal(
      classifyCheckFailure({ name: "unit-tests", errorText: "AssertionError: expected 1 to equal 2" }),
      "genuine",
    );
  });

  it("does not call a transport error transient outside an infra-shaped step", () => {
    // A flaky-sounding message inside a job that is not itself a
    // setup/download/toolchain step is not enough — two signals are
    // required, not one.
    assert.equal(
      classifyCheckFailure({
        name: "unit-tests",
        errorText: "connection reset by peer while running test suite",
      }),
      "genuine",
    );
  });
});

describe("classifyFailures", () => {
  it("is transient only when every failing check is transient", () => {
    const mixed = classifyFailures([
      { name: "setup-toolchain", errorText: "curl: (56) Recv failure: Connection reset by peer" },
      { name: "unit-tests", errorText: "AssertionError: expected 1 to equal 2" },
    ]);
    assert.equal(mixed.overall, "genuine");

    const allTransient = classifyFailures([
      { name: "setup-toolchain", errorText: "curl: (56) Recv failure: Connection reset by peer" },
      { name: "cache-restore", errorText: "HTTP/1.1 503 Service Unavailable from get.nexte.st" },
    ]);
    assert.equal(allTransient.overall, "transient");
  });

  it("is genuine for an empty failing-check list (nothing to call transient)", () => {
    assert.equal(classifyFailures([]).overall, "genuine");
  });
});

describe("redOnMain", () => {
  const FAILING = [{ name: "gate", state: "FAILURE" }];

  it("matches a check that is also FAILURE on main", () => {
    const result = redOnMain(FAILING, [{ name: "gate", conclusion: "FAILURE" }]);
    assert.deepEqual(result, [{ name: "gate", state: "FAILURE" }]);
  });

  it("does not match a check absent from main's rollup entirely", () => {
    assert.deepEqual(redOnMain(FAILING, [{ name: "other-check", conclusion: "SUCCESS" }]), []);
  });

  it("does not match a check that is green on main", () => {
    assert.deepEqual(redOnMain(FAILING, [{ name: "gate", conclusion: "SUCCESS" }]), []);
  });

  it("handles an empty/missing main rollup", () => {
    assert.deepEqual(redOnMain(FAILING, []), []);
    assert.deepEqual(redOnMain(FAILING, undefined), []);
  });
});

describe("planRepair — merge conflicts", () => {
  it("repairs a conflict immediately, no classification needed", () => {
    const plan = planRepair({ mergeable: "CONFLICTING", failingChecks: [] });
    assert.equal(plan.verdict, "repair");
  });

  it("escalates a conflict once the repair budget is spent", () => {
    const plan = planRepair({
      mergeable: "CONFLICTING",
      failingChecks: [],
      repairAttempts: DEFAULT_REPAIR_BUDGET,
    });
    assert.equal(plan.verdict, "escalate");
    assert.match(plan.reason, /conflict/);
  });
});

describe("planRepair — nothing to do", () => {
  it("returns null when nothing is failing and the PR is not conflicting", () => {
    const plan = planRepair({ mergeable: "MERGEABLE", failingChecks: [] });
    assert.equal(plan.verdict, null);
  });

  it("returns null when agent:fix is already in flight, even for a genuine failure", () => {
    const plan = planRepair({
      mergeable: "MERGEABLE",
      failingChecks: [{ name: "unit-tests", state: "FAILURE", errorText: "boom" }],
      hasAgentFixInFlight: true,
    });
    assert.equal(plan.verdict, null);
    assert.match(plan.reason, new RegExp(AGENT_FIX_LABEL));
  });
});

describe("planRepair — red on main (rule 2)", () => {
  it("escalates rather than dispatches when the failing check is also red on main", () => {
    const plan = planRepair({
      mergeable: "MERGEABLE",
      failingChecks: [{ name: "typecheck", state: "FAILURE", errorText: "TS2345: ..." }],
      mainRollup: [{ name: "typecheck", conclusion: "FAILURE" }],
    });
    assert.equal(plan.verdict, "escalate");
    assert.match(plan.reason, /also failing on main/);
    assert.deepEqual(plan.redOnMain, [{ name: "typecheck", state: "FAILURE" }]);
  });

  it("still checks main even when the failure looks transient — main-red wins", () => {
    const plan = planRepair({
      mergeable: "MERGEABLE",
      failingChecks: [
        { name: "setup-toolchain", state: "FAILURE", errorText: "curl: (22) 503 from hermit" },
      ],
      mainRollup: [{ name: "setup-toolchain", conclusion: "FAILURE" }],
    });
    assert.equal(plan.verdict, "escalate");
    assert.match(plan.reason, /also failing on main/);
  });
});

describe("planRepair — transient (rule 1)", () => {
  const TRANSIENT_CHECK = {
    name: "setup-toolchain",
    state: "FAILURE",
    errorText: "curl: (22) The requested URL returned error: 503 from artifacts.nixos.org",
  };

  it("retries a transient failure for free", () => {
    const plan = planRepair({ mergeable: "MERGEABLE", failingChecks: [TRANSIENT_CHECK] });
    assert.equal(plan.verdict, "retry");
    assert.equal(plan.classification, "transient");
  });

  it("escalates once the retry budget is spent, without ever touching the repair budget", () => {
    const plan = planRepair({
      mergeable: "MERGEABLE",
      failingChecks: [TRANSIENT_CHECK],
      retryAttempts: DEFAULT_RETRY_BUDGET,
      repairAttempts: 0,
    });
    assert.equal(plan.verdict, "escalate");
    assert.match(plan.reason, /no longer treated as transient/);
  });
});

describe("planRepair — genuine (repair)", () => {
  const GENUINE_CHECK = {
    name: "unit-tests",
    state: "FAILURE",
    errorText: "AssertionError: expected 1 to equal 2",
  };

  it("dispatches a repair for a genuine failure not present on main", () => {
    const plan = planRepair({ mergeable: "MERGEABLE", failingChecks: [GENUINE_CHECK] });
    assert.equal(plan.verdict, "repair");
    assert.equal(plan.classification, "genuine");
  });

  it("escalates once the repair budget is spent", () => {
    const plan = planRepair({
      mergeable: "MERGEABLE",
      failingChecks: [GENUINE_CHECK],
      repairAttempts: DEFAULT_REPAIR_BUDGET,
    });
    assert.equal(plan.verdict, "escalate");
    assert.match(plan.reason, /repair attempt/);
  });

  it("honors a custom repair budget", () => {
    const plan = planRepair({
      mergeable: "MERGEABLE",
      failingChecks: [GENUINE_CHECK],
      repairAttempts: 5,
      repairBudget: 10,
    });
    assert.equal(plan.verdict, "repair");
  });
});
