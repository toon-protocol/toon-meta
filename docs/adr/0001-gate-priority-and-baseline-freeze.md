# Gate hardening: Correctness > Speed > Performance, via baseline-freeze then ratchet

**Status:** accepted

## Context

The `lint / typecheck / test / build` **gate** the dumb zone runs before opening a PR is the
factory's only guard on agent-produced code. Across the 8 going-forward repos the gates are
heterogeneous and today carry deliberate soft-gate holes (toon-client soft-gates 82 typecheck
errors, toon runs `eslint --max-warnings 940`, store has no lint config, toon-meta disables
noisy markdownlint rules). An epic to improve the gate's **correctness**, **speed** (CI
wall-clock), and **performance** (runner cost & resources) needs a tie-breaker when those
goals conflict, and a strategy for closing the holes without freezing every gate red.

## Decision

**1. Priority order is `Correctness > Speed > Performance`.** When goals conflict, correctness
wins every tie, then speed, then runner cost. Rationale: a fast, cheap gate that green-lights
broken code actively lies to the dumb-zone agents — worse than a slow one. Speed outranks cost
because gate wall-clock throttles factory throughput, while the factory already runs on
Max-plan billing so runner-minutes are the cheapest of the three to spend.

**2. Correctness is closed by baseline-freeze first, ratchet to zero after.** Snapshot each
repo's current violations as an allowlist so the gate fails only on *new* violations (stops the
bleeding instantly and uniformly), then burn down the frozen debt in follow-up ratchet slices.
Correctness alone gets an *absolute* end-state (zero holes); speed and performance are measured
*baseline-relative* with a standing no-regression guard. Big-bang closing is used only where
debt is trivial (store just needs a lint config; store/connector have 0 typecheck debt).

## Considered options

- **Big-bang correctness** (fix all violations, then flip strict) — rejected: blocks the gate
  green for too long across large repos and is high-risk.
- **Absolute speed/perf targets** (e.g. "gate under 5 min") — rejected: arbitrary for a
  6-package repo like toon-client; baseline-relative deltas with a no-regression guard are
  falsifiable without inventing a number.
- **Shared reusable gate action up front** — deferred to a harmonize-last ticket: you cannot
  safely factor out a shared gate before each repo's baseline reveals its real deltas.

## Consequences

Every per-repo improvement is gated behind a "capture baseline" child that must land first
(wall-clock, runner-minutes, image size, cache hit rate, violation counts). Baselines are
per-repo source of truth; toon-meta carries a regenerated read-only rollup only.
