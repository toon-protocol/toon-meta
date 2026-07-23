// Doc-factory speed/performance no-regression guard (`npm run gate:regression`).
//
// Part of the gate-hardening epic (#210, ADR-0001 "Correctness > Speed > Performance,
// via baseline-freeze then ratchet"). Speed and performance are measured
// BASELINE-RELATIVE against .sandcastle/gate-baseline.json (per-repo source of truth,
// see CONTEXT.md's "gate speed" / "gate performance" definitions) rather than against
// invented absolute thresholds, so the guard never produces a false FAIL from an
// arbitrary number.
//
// INERT UNTIL THE BASELINE EXISTS: #227 ("capture baseline") is a hard blocker for
// this repo (ADR-0001: "every per-repo improvement is gated behind a 'capture
// baseline' child that must land first"). Until .sandcastle/gate-baseline.json is
// committed on main, this script no-ops (exit 0) so `npm run gate` stays green. Once
// the baseline lands, the guard activates automatically — no further wiring needed.
//
// Live measurements are supplied via env vars (this script cannot measure CI
// wall-clock or Docker image size itself — those are known only to the calling
// workflow step). Any live metric that isn't supplied is skipped individually, same
// as a missing baseline: no live number in, no comparison, no false FAIL.
//
//   GATE_WALL_CLOCK_SECONDS   -> compared against baseline.speed.docGateJobWallClockSeconds
//   GATE_RUNNER_MINUTES       -> compared against baseline.performance.runnerMinutesBilled
//   GATE_IMAGE_SIZE_BYTES     -> compared against baseline.performance.dockerImageSizeBytes
//
// All three metrics are "lower is better." A metric regresses when it grows by more
// than GATE_REGRESSION_TOLERANCE (default 0.20 = 20%) over its baseline. A zero
// baseline (e.g. runnerMinutesBilled: 0 for this public repo) has no meaningful
// percentage delta, so it is held to an exact floor: any nonzero live value fails.

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
const BASELINE_PATH = resolve(ROOT, ".sandcastle/gate-baseline.json");
const TOLERANCE = Number(process.env.GATE_REGRESSION_TOLERANCE ?? "0.2");

if (!existsSync(BASELINE_PATH)) {
  console.log(
    "gate:regression — no .sandcastle/gate-baseline.json yet (blocked by #227). " +
      "Guard is inert; gate stays green.",
  );
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));

const METRICS = [
  {
    label: "gate speed (Doc gate job wall-clock)",
    envVar: "GATE_WALL_CLOCK_SECONDS",
    baselineValue: baseline?.speed?.docGateJobWallClockSeconds,
  },
  {
    label: "gate performance (runner-minutes billed)",
    envVar: "GATE_RUNNER_MINUTES",
    baselineValue: baseline?.performance?.runnerMinutesBilled,
  },
  {
    label: "gate performance (Docker image size, bytes)",
    envVar: "GATE_IMAGE_SIZE_BYTES",
    baselineValue: baseline?.performance?.dockerImageSizeBytes,
  },
];

const failures = [];
let compared = 0;

for (const metric of METRICS) {
  const raw = process.env[metric.envVar];
  if (raw === undefined || raw === "") continue; // no live number supplied — skip
  if (metric.baselineValue === undefined || metric.baselineValue === null) continue; // nothing to compare against

  compared++;
  const live = Number(raw);
  if (Number.isNaN(live)) {
    failures.push(`${metric.label}: ${metric.envVar}="${raw}" is not a number`);
    continue;
  }

  const base = metric.baselineValue;
  const ratio = base === 0 ? (live === 0 ? 0 : Infinity) : (live - base) / base;

  if (ratio > TOLERANCE) {
    const pct = ratio === Infinity ? "∞" : `${(ratio * 100).toFixed(1)}%`;
    failures.push(
      `${metric.label}: baseline ${base}, live ${live} (+${pct}, tolerance +${(TOLERANCE * 100).toFixed(0)}%)`,
    );
  }
}

if (compared === 0) {
  console.log(
    "gate:regression — baseline present but no live metrics supplied " +
      "(GATE_WALL_CLOCK_SECONDS / GATE_RUNNER_MINUTES / GATE_IMAGE_SIZE_BYTES). " +
      "Guard no-ops for this run.",
  );
  process.exit(0);
}

if (failures.length === 0) {
  console.log(`gate:regression — ${compared} metric(s) within tolerance. Gate green.`);
  process.exit(0);
}

console.error(`\ngate:regression — ${failures.length} regression(s) vs frozen baseline:`);
for (const f of failures) console.error(`  ${f}`);
process.exit(1);
