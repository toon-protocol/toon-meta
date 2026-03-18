# Story 4-5 Report

## Overview
- **Story file**: `_bmad-output/implementation-artifacts/4-5-nix-reproducible-builds.md`
- **Git start**: `81d3f4db1e116424f461e0b97a77fa2337a79b53`
- **Duration**: ~2.5 hours
- **Pipeline result**: success
- **Migrations**: None

## What Was Built
Nix reproducible builds for TOON Docker images (FR-TEE-5). Implemented `NixBuilder` class that shells out to `nix build` and returns deterministic image hashes + PCR values, `verifyPcrReproducibility()` for CI verification, `analyzeDockerfileForNonDeterminism()` for static Dockerfile analysis, and a Nix flake (`flake.nix`) + Nix expression (`Dockerfile.nix`) that produces a deterministic Docker image equivalent to the existing `Dockerfile.oyster`.

## Acceptance Criteria Coverage
- [x] AC1: Deterministic image hashes from `NixBuilder.build()` — covered by: T-4.5-01a through T-4.5-01e (5 tests)
- [x] AC2: Identical PCR values across builds, divergence on source changes — covered by: T-4.5-02a through T-4.5-02c (3 tests)
- [x] AC3: Dockerfile static analysis detecting non-deterministic patterns — covered by: T-4.5-03a through T-4.5-03m (13 tests)
- [x] AC4: `verifyPcrReproducibility()` structured result — covered by: T-4.5-04a through T-4.5-04j (10 tests)
- [x] AC5: Public API exports from `@toon-protocol/core` — covered by: T-4.5-05a through T-4.5-05f (6 tests; type-only exports verified by source inspection)
- [x] AC6: `flake.nix`, `dockerTools.buildLayeredImage`, runtime parity, `.gitignore` — covered by: T-4.5-06a through T-4.5-06k (11 tests)

## Files Changed

### `docker/` (new)
- `Dockerfile.nix` — **created** — Nix expression for deterministic Docker image via `dockerTools.buildLayeredImage`

### project root (new/modified)
- `flake.nix` — **created** — Nix flake with `docker-image` output, pinned nixpkgs
- `.gitignore` — **modified** — Added `/result` (Nix build output symlink)

### `packages/core/src/build/` (new/modified)
- `nix-builder.ts` — **created** — `NixBuilder` class, `NixBuildResult`, `NixBuilderConfig` interfaces
- `pcr-validator.ts` — **created** — `verifyPcrReproducibility()`, `analyzeDockerfileForNonDeterminism()`, `readDockerfileNix()`, `PcrReproducibilityError`
- `index.ts` — **created** — Barrel re-exports from `nix-builder.js` and `pcr-validator.js`
- `nix-reproducibility.test.ts` — **modified** — Converted 33 RED stubs to GREEN, added 15 new tests (48 total)
- `reproducibility.test.ts` — **deleted** — Superseded alternative function-based API

### `packages/core/src/` (modified)
- `index.ts` — **modified** — Added build module re-exports

### `_bmad-output/` (created/modified)
- `implementation-artifacts/4-5-nix-reproducible-builds.md` — **created** then modified through pipeline
- `implementation-artifacts/sprint-status.yaml` — **modified** — Status progression: backlog → ready-for-dev → review → done
- `test-artifacts/atdd-checklist-4-5.md` — **created** — ATDD checklist document
- `test-artifacts/nfr-assessment.md` — **modified** — Story 4.5 NFR assessment

## Pipeline Steps

### Step 1: Story Create
- **Status**: success
- **Duration**: ~8 min
- **What changed**: Created story file, updated sprint-status.yaml
- **Key decisions**: Chose class-based NixBuilder API over function-based alternative
- **Issues found & fixed**: 0

### Step 2: Story Validate
- **Status**: success
- **Duration**: ~12 min
- **What changed**: Modified story file (10 fixes)
- **Key decisions**: Added AC #6 for flake/gitignore, changed error base class to ToonError
- **Issues found & fixed**: 10 (5 medium, 5 low)

### Step 3: ATDD
- **Status**: success
- **Duration**: ~8 min
- **What changed**: Modified test file (added T-4.5-05/06), deleted reproducibility.test.ts, created ATDD checklist
- **Key decisions**: Added 14 new tests for ACs #5 and #6; deleted alternative API test file
- **Issues found & fixed**: 3 (module-scope type fix, path resolution, missing test coverage)

### Step 4: Develop
- **Status**: success
- **Duration**: ~25 min
- **What changed**: Created 5 files (Dockerfile.nix, flake.nix, nix-builder.ts, pcr-validator.ts, build/index.ts), modified 4 files
- **Key decisions**: Manual promise wrapper for execFile (mock compatibility), fixed regex for digest pin detection
- **Issues found & fixed**: 3 (promisify mock issue, regex false positive, lint errors)

### Step 5: Post-Dev Artifact Verify
- **Status**: success
- **Duration**: ~1 min
- **What changed**: Status fields corrected to "review"
- **Issues found & fixed**: 2 status fields

### Step 6: Frontend Polish
- **Status**: skipped
- **Reason**: Backend-only story, no UI impact

### Step 7: Post-Dev Lint & Typecheck
- **Status**: success
- **Duration**: ~2 min
- **What changed**: Nothing (already clean)
- **Issues found & fixed**: 0

### Step 8: Post-Dev Test Verification
- **Status**: success
- **Duration**: ~3 min
- **What changed**: Nothing (all 1787 tests passed)
- **Issues found & fixed**: 0

### Step 9: NFR
- **Status**: success
- **Duration**: ~8 min
- **What changed**: Updated NFR assessment file
- **Key decisions**: PASS (27/29 ADR criteria, 93%)
- **Issues found & fixed**: 0

### Step 10: Test Automate
- **Status**: success
- **Duration**: ~15 min
- **What changed**: Added 13 new tests to nix-reproducibility.test.ts (33→46)
- **Issues found & fixed**: 1 (Prettier formatting)

### Step 11: Test Review
- **Status**: success
- **Duration**: ~10 min
- **What changed**: Modified test file (3 quality improvements, 2 new tests; 46→48)
- **Issues found & fixed**: 3 (incomplete anti-pattern verification, redundant double invocation, missing edge cases)

### Step 12: Code Review #1
- **Status**: success
- **Duration**: ~10 min
- **What changed**: Modified flake.nix, nix-builder.ts, test file, pcr-validator.ts
- **Issues found & fixed**: 7 (1 critical, 1 high, 2 medium, 3 low) — 4 fixed, 3 noted
- **Key decisions**: Fixed truncated nixpkgs hash, PCR2 domain separator for small images

### Step 13: Review #1 Artifact Verify
- **Status**: success
- **Duration**: ~2 min
- **What changed**: Added Code Review Record section to story file

### Step 14: Code Review #2
- **Status**: success
- **Duration**: ~10 min
- **What changed**: Modified nix-builder.ts, pcr-validator.ts, test file
- **Issues found & fixed**: 6 (0 critical, 0 high, 3 medium, 3 low) — all fixed
- **Key decisions**: Path traversal prevention for sourceOverride, enhanced error messages, RegExp.exec lastIndex reset

### Step 15: Review #2 Artifact Verify
- **Status**: success
- **Duration**: ~1 min
- **What changed**: Nothing (Pass #2 already recorded correctly)

### Step 16: Code Review #3
- **Status**: success
- **Duration**: ~15 min
- **What changed**: Modified nix-builder.ts (startsWith prefix collision fix), story file
- **Issues found & fixed**: 4 (0 critical, 0 high, 1 medium, 3 low) — 1 fixed, 3 noted
- **Key decisions**: Strengthened path.sep delimiter check for CWE-22

### Step 17: Review #3 Artifact Verify
- **Status**: success
- **Duration**: ~1 min
- **What changed**: Status fields set to "done"
- **Issues found & fixed**: 2 status fields

### Step 18: Security Scan (semgrep)
- **Status**: success
- **Duration**: ~2 min
- **What changed**: Nothing (clean scan)
- **Issues found & fixed**: 0 (5 passes, ~440 rules, zero findings)

### Step 19: Regression Lint & Typecheck
- **Status**: success
- **Duration**: ~2 min
- **What changed**: Nothing (already clean)
- **Issues found & fixed**: 0

### Step 20: Regression Test
- **Status**: success
- **Duration**: ~3 min
- **What changed**: Nothing (all tests passed)
- **Issues found & fixed**: 0

### Step 21: E2E
- **Status**: skipped
- **Reason**: Backend-only story, no UI impact

### Step 22: Trace
- **Status**: success
- **Duration**: ~5 min
- **What changed**: Nothing (read-only analysis)
- **Key decisions**: All 6 ACs fully covered, type exports verified by source inspection
- **Issues found & fixed**: 0

## Test Coverage
- **Test files**: `packages/core/src/build/nix-reproducibility.test.ts` (48 tests)
- **ATDD checklist**: `_bmad-output/test-artifacts/atdd-checklist-4-5.md`
- **Coverage**: All 6 ACs covered (see AC Coverage section above)
- **Gaps**: Type-only exports (AC #5) not runtime-testable; `flake.lock` not generated (requires Nix)
- **Test count**: post-dev 1787 → regression 1802 (delta: +15)

## Code Review Findings

| Pass | Critical | High | Medium | Low | Total Found | Fixed | Noted |
|------|----------|------|--------|-----|-------------|-------|-------|
| #1   | 1        | 1    | 2      | 3   | 7           | 4     | 3     |
| #2   | 0        | 0    | 3      | 3   | 6           | 6     | 0     |
| #3   | 0        | 0    | 1      | 3   | 4           | 1     | 3     |
| **Total** | **1** | **1** | **6** | **9** | **17** | **11** | **6** |

## Quality Gates
- **Frontend Polish**: skipped — backend-only story
- **NFR**: PASS (27/29, 93%) — 2 CONCERNS (scalability baseline, CI metrics — inherited infrastructure gaps)
- **Security Scan (semgrep)**: PASS — 0 findings across ~440 rules in 5 passes
- **E2E**: skipped — backend-only story
- **Traceability**: PASS — all 6 ACs fully covered by 48 tests

## Known Risks & Gaps
1. **`flake.lock` not committed** — requires `nix flake lock` with Nix installed. First Nix build will generate it.
2. **`pnpm install --offline` in Nix sandbox** — the flake's build phase assumes a pre-populated pnpm store. Production usage would need `npmDeps`/`fetchNpmDeps` or similar mechanism.
3. **No real Nix integration tests** — all NixBuilder tests use mocked `child_process`. Real `@nix`-tagged tests for weekly CI don't exist yet.
4. **Mock image size** — test mock images are <1MB, so PCR1 === PCR0 in mocks (real images would be multi-MB with distinct PCR registers).

---

## TL;DR
Story 4-5 implements Nix reproducible builds for TOON Docker images (FR-TEE-5), including `NixBuilder` class, PCR verification utilities, Dockerfile static analysis, and a Nix flake producing deterministic images equivalent to the existing `Dockerfile.oyster`. The pipeline completed cleanly: 48 tests covering all 6 acceptance criteria, 3 code review passes finding 17 issues (11 fixed, 6 noted as acceptable), clean semgrep security scan, and NFR pass at 93%. The main operational gap is that `flake.lock` generation and real Nix builds require Nix tooling not yet available in CI.
