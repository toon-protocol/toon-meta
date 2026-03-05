---
stepsCompleted:
  [
    'step-01-preflight',
    'step-02-generate-pipeline',
    'step-03-configure-quality-gates',
    'step-04-validate-and-summary',
  ]
lastStep: 'step-04-validate-and-summary'
lastSaved: '2026-03-04'
---

# CI Pipeline Setup: Crosstown Monorepo

**Date:** 2026-03-04
**Author:** Jonathan (TEA Master Test Architect)
**CI Platform:** GitHub Actions
**Test Framework:** Vitest
**Package Manager:** pnpm 8.x
**Node Version:** 20+
**Stack Type:** Backend (Node.js monorepo)

---

## Step 1: Preflight Results

| Check           | Result                 | Details                                                                                             |
| --------------- | ---------------------- | --------------------------------------------------------------------------------------------------- |
| Git repository  | PASS                   | `.git/` exists, remote configured (github.com/ALLiDoizCode/crosstown)                               |
| Test stack type | **backend**            | No frontend indicators; Node.js monorepo with Vitest                                                |
| Test framework  | **Vitest**             | 6 configs detected (root unit, root integration, client unit, client e2e, core integration, docker) |
| CI platform     | **github-actions**     | `.github/workflows/publish-bls.yml` exists                                                          |
| Package manager | **pnpm**               | `pnpm@8.15.0` (packageManager field)                                                                |
| Node version    | **>=20**               | From `engines` in root package.json; no `.nvmrc`                                                    |
| Existing CI     | `publish-bls.yml` only | No test pipeline exists yet                                                                         |

### Vitest Configuration Map

| Config                                       | Scope            | Include Pattern                               | Timeout | Notes                          |
| -------------------------------------------- | ---------------- | --------------------------------------------- | ------- | ------------------------------ |
| `vitest.config.ts` (root)                    | Unit             | `packages/*/src/**/*.test.ts`                 | default | Excludes `__integration__/`    |
| `vitest.integration.config.ts` (root)        | Integration      | `packages/*/src/__integration__/**/*.test.ts` | 60s     | All packages                   |
| `packages/client/vitest.config.ts`           | Client unit      | `src/**/*.test.ts`                            | default | Package-scoped                 |
| `packages/client/vitest.e2e.config.ts`       | Client E2E       | `tests/e2e/**/*.test.ts`                      | 30s     | Requires genesis node          |
| `packages/core/vitest.integration.config.ts` | Core integration | `src/integration/**/*.test.ts`                | 30s     | Sequential (forks, singleFork) |

---

## Step 2: Pipeline Configuration

**Output file:** `.github/workflows/test.yml`
**Template:** GitHub Actions (customized for pnpm monorepo backend stack)

### Pipeline Architecture

```
PR / push to main:
  ┌──────────────────┐
  │  lint-and-build   │  (lint + pnpm -r build)
  └────────┬─────────┘
           ├───────────────────┐
  ┌────────▼─────────┐  ┌─────▼──────────────┐
  │   unit-tests      │  │ integration-tests   │
  │   (pnpm test)     │  │ (vitest integration)│
  └────────┬─────────┘  └─────┬──────────────┘
           └───────┬───────────┘
           ┌───────▼──────────┐
           │     report       │  (PR summary)
           └──────────────────┘

Nightly / manual:
  ┌──────────────────┐
  │  lint-and-build   │
  └────────┬─────────┘
           ├──────────┬──────────────────┐
  ┌────────▼──┐ ┌─────▼──────┐  ┌───────▼────────┐
  │  unit     │ │ integration│  │   e2e-tests     │
  │  tests    │ │ tests      │  │ (genesis node)  │
  └───────────┘ └────────────┘  └─────────────────┘
```

### Stage Details

| Stage             | Trigger                       | Timeout | Dependencies       | What It Tests                                                   |
| ----------------- | ----------------------------- | ------- | ------------------ | --------------------------------------------------------------- |
| lint-and-build    | All                           | 10 min  | None               | ESLint + TypeScript compilation                                 |
| unit-tests        | PR, push, manual              | 10 min  | lint-and-build     | Pure functions: TOON codec, pricing calc, key derivation        |
| integration-tests | PR, push, manual              | 15 min  | lint-and-build     | Component boundaries: real crypto, real TOON, ConnectorNodeLike |
| e2e-tests         | Nightly, push to main, manual | 30 min  | lint-and-build     | Full stack: genesis node, Anvil, relay, payment channels        |
| report            | PR only                       | 5 min   | unit + integration | GitHub Step Summary                                             |

### Key Design Decisions

1. **No burn-in** — Backend-only stack. Tests use real crypto (deterministic), not UI selectors. Flakiness risk is minimal.
2. **No sharding** — Test suite is small enough (<100 tests) to run in a single job. Revisit when suite exceeds 200 tests.
3. **Build artifact caching** — `actions/cache` shares compiled TypeScript across all test jobs, saving ~2 min per job.
4. **E2E isolated to nightly** — Requires Docker services (Anvil, relay, BLS, faucet, connector). Too heavy for every PR.
5. **No mocks** — Real crypto libraries, real TOON codec, real local infrastructure. Matches project philosophy.

---

## Step 3: Quality Gates

### Pass Rate Thresholds

| Priority           | Required Pass Rate | Enforcement       |
| ------------------ | ------------------ | ----------------- |
| P0 (critical path) | 100%               | CI blocks merge   |
| P1 (high priority) | 100%               | CI blocks merge   |
| P2 (medium)        | 95%                | Warning in report |
| P3 (low)           | Best effort        | Informational     |

### Quality Gate Rules

1. **Unit tests must pass** — `unit-tests` job is a required status check for PR merge
2. **Integration tests must pass** — `integration-tests` job is a required status check
3. **E2E failures don't block PRs** — E2E runs nightly; failures create issues, not PR blocks
4. **Coverage target** — NFR-SDK-3 requires >80% line coverage. Coverage report uploaded as artifact on PRs.

### Burn-In Decision

**SKIPPED** — Backend-only stack rationale:

- Unit tests are pure functions (TOON codec, pricing) — deterministic by nature
- Integration tests use real crypto libraries (`nostr-tools`, `@scure/bip39`) — no timing flakiness
- E2E tests have 30s timeout and run against stable Docker services
- If flakiness emerges, add burn-in for specific test files via `vitest --repeat 10`

### Notifications

- **PR comments:** GitHub Step Summary shows pass/fail per stage
- **Failure artifacts:** Test results + service logs uploaded on failure (7-day retention)
- **Coverage reports:** Uploaded on PRs (14-day retention)

---

## Step 4: Validation Summary

### Checklist Results

| Item                      | Status | Notes                                                 |
| ------------------------- | ------ | ----------------------------------------------------- |
| CI file created           | PASS   | `.github/workflows/test.yml`                          |
| YAML syntax valid         | PASS   | Standard GitHub Actions syntax                        |
| Correct test commands     | PASS   | `pnpm test`, `pnpm vitest --config`, `pnpm test:e2e`  |
| Node version matches      | PASS   | `20` (matches `engines: >=20`)                        |
| pnpm caching              | PASS   | `pnpm/action-setup@v4` + `setup-node` cache           |
| Build artifact caching    | PASS   | `actions/cache/save` + `actions/cache/restore` by SHA |
| No browser install        | PASS   | Backend-only stack                                    |
| No burn-in                | PASS   | Backend-only (documented rationale)                   |
| Concurrency control       | PASS   | `cancel-in-progress: true` per workflow+ref           |
| Failure artifacts         | PASS   | Uploaded for integration and E2E failures             |
| E2E service health checks | PASS   | `curl` wait loops for BLS and Faucet                  |
| Service logs on failure   | PASS   | Docker compose logs collected                         |
| No secrets in config      | PASS   | No credentials hardcoded                              |
| Triggers correct          | PASS   | push, PR, schedule, workflow_dispatch                 |

### Performance Estimates

| Stage               | Estimated Duration                       | Budget |
| ------------------- | ---------------------------------------- | ------ |
| lint-and-build      | ~3 min                                   | 10 min |
| unit-tests          | ~2 min                                   | 10 min |
| integration-tests   | ~5 min                                   | 15 min |
| e2e-tests (nightly) | ~10 min                                  | 30 min |
| **Total (PR)**      | **~7 min** (parallel unit + integration) | 15 min |
| **Total (nightly)** | **~13 min** (parallel all 3)             | 30 min |

### Next Steps for User

1. **Commit** `.github/workflows/test.yml`
2. **Push** to remote to trigger first CI run
3. **Configure branch protection** — Add `unit-tests` and `integration-tests` as required status checks
4. **E2E in CI** — The E2E job uses `deploy-genesis-node.sh` which may need Docker-in-Docker setup. Verify on first nightly run and adjust if needed.
5. **Coverage badge** — After first coverage run, add badge to README

### Files Created

| File                                                  | Purpose                                |
| ----------------------------------------------------- | -------------------------------------- |
| `.github/workflows/test.yml`                          | GitHub Actions test pipeline           |
| `_bmad-output/test-artifacts/ci-pipeline-progress.md` | This document (CI setup documentation) |

---

**Generated by:** BMad TEA Agent - Test Architect Module
**Workflow:** `_bmad/tea/testarch/ci`
**Version:** 5.0 (BMad v6)
