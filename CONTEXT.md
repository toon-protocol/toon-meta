# CONTEXT

Glossary for the toon-meta docs/factory repo. Terms only — no implementation details.

## The gate

The `lint / typecheck / test / build` checkpoint the **dumb zone** (`.sandcastle/`) runs
before opening a PR. Every going-forward repo has one; its shape varies per repo (see
FACTORY.md per-repo table). "CI linters and tests" in day-to-day speech means the gate.

## Going-forward repos

The 8 live, actively-worked repos the factory targets: `relay`, `toon-client`, `rig`,
`store`, `connector`, `toon`, `swap`, `toon-meta`. Canonical list lives in FACTORY.md.

## Gate speed

CI **wall-clock time** — how long the gate takes to finish. A gate-speed improvement makes
the gate return its verdict sooner. Distinct from [gate performance](#gate-performance).

## Gate performance

**Runner cost & resource efficiency** — runner-minutes billed, Docker image size, cache
hit rate, parallelism. A gate-performance improvement makes the gate cheaper/lighter to run,
independent of whether it also finishes sooner. Does NOT mean benchmarking the code under
test — that is out of scope.

## Gate correctness

The trustworthiness of the gate's verdict. Two distinct sub-goals:

- **No false PASS** — the gate must not green-light real breakage. Today's holes: toon-client
  soft-gates 82 typecheck errors, toon runs `eslint --max-warnings 940`, store has no lint,
  toon-meta disables noisy markdownlint rules. Closing these is a no-false-PASS improvement.
- **No false FAIL** — the same commit always earns the same verdict; no flaky, nondeterministic,
  or environment-dependent failures.
