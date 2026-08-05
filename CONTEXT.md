# CONTEXT

Glossary for the toon-meta docs/factory repo. Terms only — no implementation details.

## The gate

The `lint / typecheck / test / build` checkpoint the **dumb zone** (`.sandcastle/`) runs
before opening a PR. Every going-forward repo has one; its shape varies per repo (see
FACTORY.md per-repo table). "CI linters and tests" in day-to-day speech means the gate.

## Going-forward repos

The org's live, actively-worked repos — the set the factory targets. This glossary
deliberately does not restate the list: the canonical, always-current enumeration is
FACTORY.md's per-repo [registry](#registry) table, and two lists that must be kept in sync
will not stay in sync.

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

- **No false PASS** — the gate must not green-light real breakage. Three of the original four
  holes are closed or mechanically frozen: toon-client's eslint/typecheck counts are enforced
  by `.sandcastle/gate-guard.ts` against its frozen baseline; toon's typecheck debt is paid to
  zero errors (blocking CI step) and its eslint ceiling is a hard `--max-warnings 940` freeze;
  store lints against a frozen `eslint-suppressions.json` allowlist. The remaining hole:
  toon-meta disables noisy markdownlint rules (a frozen allowlist) pending a ratchet slice.
  Ratcheting frozen debt to zero is a no-false-PASS improvement.
- **No false FAIL** — the same commit always earns the same verdict; no flaky, nondeterministic,
  or environment-dependent failures.

## Archetype

A **pinned opinion** — environment × doctrine × oracle-skeleton — that `forge new <archetype>`
stamps into a new factory. Named for **what you build** (`service`, `spa`, `game`), never for the
toolchain that builds it. An archetype is not a category and not a set of flags: a divergent
opinion is a *different archetype*, so one archetype pins exactly one
[environment](#environment-kind). `blank` is the escape hatch — libraries and one-offs take
`forge new --blank` plus a bare environment, with no archetype opinions applied.

## Minted

The state in which an [archetype](#archetype) **exists**. An archetype is minted only after its
[pilot](#pilot) — at least one merged `agent:implement` PR proving the bundle end to end. Naming
an unminted archetype in a `factory.toml` MUST fail validation. Un-minted archetypes may still be
scaffolded and listed; scaffolded is not minted.

## Pilot

The repo whose merged `agent:implement` PR [mints](#minted) an archetype — the proof that the
bundle works, recorded in the archetype catalog as the archetype's proving repo. `service` is
piloted by `relay`.

## Registry

`FACTORY.md` in this repo, acting as the **sole authority on what exists**: unregistered means
does not exist. The registry decides existence; a Forge archetype bundle
(`templates/archetypes/<name>/`) describes only the *opinion*, and deliberately carries no mint
status of its own so the two can never disagree. Revising a pinned opinion is registry-first,
then fans out via `forge upgrade`.

## Environment kind

The prepared toolchain shape a factory's sandbox image and CI runner are built from — one of
`node-pnpm`, `npm-workspaces`, `docs`, `bevy-spacetime`, `bevy-spacetime-gpu`. Adding a kind is a
Forge template change, not a per-repo freedom.
