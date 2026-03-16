---
stepsCompleted:
  - 'step-01-preflight-and-context'
  - 'step-02-generation-mode'
  - 'step-03-test-strategy'
  - 'step-04c-aggregate'
  - 'step-05-validate-and-complete'
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-03-15'
workflowType: 'testarch-atdd'
inputDocuments:
  - '_bmad-output/implementation-artifacts/4-5-nix-reproducible-builds.md'
  - 'packages/core/src/build/nix-reproducibility.test.ts'
  - 'packages/core/src/build/reproducibility.test.ts (deleted - superseded)'
  - 'packages/core/src/build/oyster-config.test.ts (pattern reference)'
  - 'packages/core/src/errors.ts'
  - 'packages/core/src/index.ts'
  - 'docker/Dockerfile.oyster'
  - '.gitignore'
---

# ATDD Checklist - Epic 4, Story 4.5: Nix Reproducible Builds

**Date:** 2026-03-15
**Author:** Jonathan
**Primary Test Level:** Unit / Static Analysis (backend, no E2E)

---

## Story Summary

Story 4.5 adds Nix-based reproducible Docker builds to the Crosstown relay, ensuring that Docker images produce deterministic PCR (Platform Configuration Register) values across independent builds. This closes the trust loop between enclave code integrity and attestation verification.

**As a** Crosstown relay operator deploying to Marlin Oyster CVM
**I want** Docker builds to produce deterministic images with identical PCR values across independent builds
**So that** remote attestation verification can compare PCR measurements against a known-good registry, and any code tampering is detectable by a PCR mismatch

---

## Acceptance Criteria

1. **AC #1**: Two independent `nix build` invocations produce identical Docker image content hashes. Validated by `NixBuilder` class wrapping `nix build`.
2. **AC #2**: PCR values (pcr0, pcr1, pcr2 -- SHA-384, 96 hex chars) are identical across both builds. Modified source produces different PCR values.
3. **AC #3**: `docker/Dockerfile.nix` contains zero forbidden non-deterministic patterns (no apt-get update, unpinned deps, :latest tags, curl|bash). Validated by `analyzeDockerfileForNonDeterminism()`.
4. **AC #4**: `verifyPcrReproducibility(buildA, buildB)` returns structured result with per-register match booleans, details, and human-readable summary. Throws `PcrReproducibilityError` with `{ throwOnMismatch: true }`.
5. **AC #5**: All public APIs exported from `packages/core/src/build/index.ts` and re-exported from `packages/core/src/index.ts`.
6. **AC #6**: `flake.nix` defines `docker-image` output with `dockerTools.buildLayeredImage`. `.gitignore` contains `/result`.

---

## Test Strategy

**Detected Stack:** Backend (Node.js monorepo, Vitest, no frontend/browser)
**Generation Mode:** AI Generation (no browser recording needed)

### Test Level Selection

| AC | Test Level | Rationale |
|----|-----------|-----------|
| #1 | Unit (mocked) | NixBuilder.build() shells out to `nix` CLI. Unit tests mock child_process. Real Nix builds tagged `@nix` for weekly CI. |
| #2 | Unit (mocked) | PCR extraction from build results. Mock data validates comparison logic. |
| #3 | Unit + Static | `analyzeDockerfileForNonDeterminism()` is pure function. Static file existence checks for Dockerfile.nix. |
| #4 | Unit | `verifyPcrReproducibility()` is pure comparison logic with mock NixBuildResult objects. |
| #5 | Integration | Import verification -- dynamic import of barrel exports to verify re-export chain. |
| #6 | Static | File existence checks for flake.nix, content checks for .gitignore. |

### Priority Assignment

| Test ID | Priority | Rationale |
|---------|----------|-----------|
| T-4.5-01 | P0 | Core determinism guarantee. If builds differ, entire attestation model collapses. |
| T-4.5-02 | P0 | PCR identity is the attestation trust anchor. |
| T-4.5-03 | P1 | Dockerfile static analysis prevents regression to non-deterministic patterns. |
| T-4.5-04 | P1 | CI verification function is the deployment gate. |
| T-4.5-05 | P1 | Public API stability -- barrel exports must not break consumers. |
| T-4.5-06 | P1 | Infrastructure files must exist for the build pipeline to work. |

---

## Failing Tests Created (RED Phase)

### Unit Tests (33 tests)

**File:** `packages/core/src/build/nix-reproducibility.test.ts` (455 lines)

#### T-4.5-01: Nix build determinism -- identical image hashes (3 tests, AC #1)

- **Test:** T-4.5-01a: two consecutive nix builds produce the same Docker image hash
  - **Status:** RED - `it.skip()` -- NixBuilder module does not exist
  - **Verifies:** Image content hash determinism across builds

- **Test:** T-4.5-01b: two consecutive builds produce the same /nix/store path
  - **Status:** RED - `it.skip()` -- NixBuilder module does not exist
  - **Verifies:** Nix store path content-addressing (same inputs = same path)

- **Test:** T-4.5-01c: NixBuildResult contains imageHash, pcr0-2, and imagePath
  - **Status:** RED - `it.skip()` -- NixBuilder module does not exist
  - **Verifies:** NixBuildResult interface completeness

#### T-4.5-02: Nix build determinism -- identical PCR values (3 tests, AC #2)

- **Test:** T-4.5-02a: two independent nix builds produce identical PCR0 values
  - **Status:** RED - `it.skip()` -- NixBuilder module does not exist
  - **Verifies:** PCR0 identity across builds

- **Test:** T-4.5-02b: all three PCR values are identical across builds
  - **Status:** RED - `it.skip()` -- NixBuilder module does not exist
  - **Verifies:** All three PCR registers (pcr0, pcr1, pcr2) match

- **Test:** T-4.5-02c: modified source code produces different PCR values
  - **Status:** RED - `it.skip()` -- NixBuilder module does not exist
  - **Verifies:** PCR computation is non-trivially constant (negative case)

#### T-4.5-03: Dockerfile.nix determinism -- static analysis (8 tests, AC #3)

- **Test:** T-4.5-03a: Dockerfile.nix exists at the expected path
  - **Status:** RED - `it.skip()` -- docker/Dockerfile.nix does not exist
  - **Verifies:** File existence

- **Test:** T-4.5-03b: Dockerfile.nix does not contain apt-get update
  - **Status:** RED - `it.skip()` -- docker/Dockerfile.nix does not exist
  - **Verifies:** No mutable package index updates

- **Test:** T-4.5-03c: Dockerfile.nix does not contain npm install without lockfile
  - **Status:** RED - `it.skip()` -- docker/Dockerfile.nix does not exist
  - **Verifies:** Lockfile enforcement for npm

- **Test:** T-4.5-03d: Dockerfile.nix does not contain git clone without pinned commit
  - **Status:** RED - `it.skip()` -- docker/Dockerfile.nix does not exist
  - **Verifies:** Pinned git references

- **Test:** T-4.5-03e: Dockerfile.nix base images use digest pins
  - **Status:** RED - `it.skip()` -- docker/Dockerfile.nix does not exist
  - **Verifies:** SHA256 digest pinning for base images

- **Test:** T-4.5-03f: analyzeDockerfileForNonDeterminism reports zero violations
  - **Status:** RED - `it.skip()` -- pcr-validator module does not exist
  - **Verifies:** Real Dockerfile.nix passes full analysis

- **Test:** T-4.5-03g: analyzeDockerfileForNonDeterminism detects all anti-patterns
  - **Status:** RED - `it.skip()` -- pcr-validator module does not exist
  - **Verifies:** Static analysis correctly flags bad Dockerfiles (negative case)

- **Test:** T-4.5-03h: properly pinned Dockerfile passes validation
  - **Status:** RED - `it.skip()` -- pcr-validator module does not exist
  - **Verifies:** Correct Dockerfiles are not false-positived

#### T-4.5-04: CI pipeline PCR reproducibility verification (5 tests, AC #4)

- **Test:** T-4.5-04a: verifyPcrReproducibility returns success for identical builds
  - **Status:** RED - `it.skip()` -- pcr-validator module does not exist
  - **Verifies:** Positive case -- identical builds pass verification

- **Test:** T-4.5-04b: verifyPcrReproducibility returns failure for divergent builds
  - **Status:** RED - `it.skip()` -- pcr-validator module does not exist
  - **Verifies:** Negative case -- different builds detected with details

- **Test:** T-4.5-04c: verifyPcrReproducibility throws PcrReproducibilityError
  - **Status:** RED - `it.skip()` -- pcr-validator module does not exist
  - **Verifies:** `throwOnMismatch` option throws with PCR values in message

- **Test:** T-4.5-04d: verification result includes human-readable summary
  - **Status:** RED - `it.skip()` -- pcr-validator module does not exist
  - **Verifies:** Summary string for CI log output

- **Test:** T-4.5-04e: end-to-end CI flow -- NixBuilder.build() x2 + verify
  - **Status:** RED - `it.skip()` -- both modules do not exist
  - **Verifies:** Full pipeline integration (build -> compare -> result)

#### T-4.5-05: Barrel exports -- build module public API (6 tests, AC #5)

- **Test:** T-4.5-05a: NixBuilder class is exported from build/index.ts
  - **Status:** RED - `it.skip()` -- build/index.ts does not exist
  - **Verifies:** NixBuilder class exportability

- **Test:** T-4.5-05b: verifyPcrReproducibility is exported
  - **Status:** RED - `it.skip()` -- build/index.ts does not exist
  - **Verifies:** Function export

- **Test:** T-4.5-05c: analyzeDockerfileForNonDeterminism is exported
  - **Status:** RED - `it.skip()` -- build/index.ts does not exist
  - **Verifies:** Function export

- **Test:** T-4.5-05d: readDockerfileNix is exported
  - **Status:** RED - `it.skip()` -- build/index.ts does not exist
  - **Verifies:** Function export

- **Test:** T-4.5-05e: PcrReproducibilityError is exported
  - **Status:** RED - `it.skip()` -- build/index.ts does not exist
  - **Verifies:** Error class export

- **Test:** T-4.5-05f: all build module exports re-exported from @crosstown/core
  - **Status:** RED - `it.skip()` -- build/index.ts does not exist
  - **Verifies:** Top-level barrel re-export chain

#### T-4.5-06: Nix flake configuration and gitignore (8 tests, AC #6)

- **Test:** T-4.5-06a: flake.nix exists at the project root
  - **Status:** RED - `it.skip()` -- flake.nix does not exist
  - **Verifies:** File existence

- **Test:** T-4.5-06b: flake.nix defines a docker-image output
  - **Status:** RED - `it.skip()` -- flake.nix does not exist
  - **Verifies:** dockerTools.buildLayeredImage usage

- **Test:** T-4.5-06c: flake.nix pins nixpkgs to a specific commit
  - **Status:** RED - `it.skip()` -- flake.nix does not exist
  - **Verifies:** Nixpkgs input pinning

- **Test:** T-4.5-06d: flake.nix includes Node.js 20 and supervisord
  - **Status:** RED - `it.skip()` -- flake.nix does not exist
  - **Verifies:** Runtime components match Dockerfile.oyster

- **Test:** T-4.5-06e: flake.nix exposes ports 3100, 7100, 1300
  - **Status:** RED - `it.skip()` -- flake.nix does not exist
  - **Verifies:** Port exposure matches Dockerfile.oyster

- **Test:** T-4.5-06f: .gitignore contains /result entry
  - **Status:** RED - `it.skip()` -- /result not yet in .gitignore
  - **Verifies:** Nix build output symlink excluded from VCS

- **Test:** T-4.5-06g: flake.nix sets NODE_ENV=production and creates crosstown user
  - **Status:** RED - `it.skip()` -- flake.nix does not exist
  - **Verifies:** Production config and security user

- **Test:** T-4.5-06h: flake.nix CMD uses supervisord
  - **Status:** RED - `it.skip()` -- flake.nix does not exist
  - **Verifies:** Process manager entry point

---

## Data Factories Created

### NixBuildResult Factory

**File:** `packages/core/src/build/nix-reproducibility.test.ts` (inline)

**Exports (test-local):**

- `createNixBuildResult(overrides?)` - Create single NixBuildResult with optional overrides
- `createBuildPair(identical)` - Create a pair of NixBuildResults (identical or divergent)
- `createForbiddenPatterns()` - Create the standard list of non-deterministic Docker patterns

**Example Usage:**

```typescript
const result = createNixBuildResult({ pcr0: 'deadbeef'.repeat(12) });
const { buildA, buildB } = createBuildPair(/* identical */ true);
const patterns = createForbiddenPatterns();
```

---

## Fixtures Created

No shared fixtures required. All test data is created inline via factory helpers within the test file. The `NixBuildResult` objects are pure data structures with no external state, setup, or teardown requirements.

---

## Mock Requirements

### NixBuilder.build() Mock (for GREEN phase)

The `NixBuilder.build()` method shells out to `nix build` via `child_process.execFile`. For standard CI (no Nix installed), the GREEN phase must:

1. Mock `node:child_process` via `vi.mock('node:child_process')`
2. Return deterministic stdout containing image hash and store path
3. Simulate PCR extraction from build output

**Mock Success Response:**
```json
{
  "imagePath": "/nix/store/abc123-crosstown-docker-image.tar.gz",
  "imageHash": "sha256:ab12cd34ab12cd34ab12cd34ab12cd34ab12cd34ab12cd34ab12cd34ab12cd34"
}
```

**Mock Failure Response (nix not installed):**
```
Error: Nix is not installed. Install Nix from https://nixos.org/download.html
```

**Notes:** Real Nix builds should be tagged `@nix` and run in weekly CI only. Standard CI runs the mocked tests.

---

## Required data-testid Attributes

Not applicable. This is a backend-only story with no UI components.

---

## Implementation Checklist

### Test: T-4.5-01 (NixBuilder class + NixBuildResult type)

**File:** `packages/core/src/build/nix-reproducibility.test.ts`

**Tasks to make this test pass:**

- [ ] Create `packages/core/src/build/nix-builder.ts`
- [ ] Define `NixBuildResult` interface with all fields (imageHash, pcr0-2, imagePath, buildTimestamp)
- [ ] Define `NixBuilderConfig` interface (projectRoot, dockerfilePath, sourceOverride?)
- [ ] Implement `NixBuilder` class with `build()` method
- [ ] Shell out to `nix build .#docker-image` via `child_process.execFile`
- [ ] Parse build output: extract image hash, store path
- [ ] Compute PCR values from image (SHA-384 of layers)
- [ ] Handle `sourceOverride` for modified source tree testing
- [ ] Remove local `NixBuildResult` type from test file, uncomment real import
- [ ] Mock `child_process` in tests for CI without Nix
- [ ] Run test: `npx vitest run packages/core/src/build/nix-reproducibility.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 3 hours

---

### Test: T-4.5-02 (PCR value determinism)

**File:** `packages/core/src/build/nix-reproducibility.test.ts`

**Tasks to make this test pass:**

- [ ] Ensure `NixBuilder.build()` extracts PCR0, PCR1, PCR2 from build output
- [ ] Validate PCR format: 96 lowercase hex chars (SHA-384)
- [ ] Ensure identical source -> identical PCR (determinism)
- [ ] Ensure `sourceOverride` produces different PCR (non-triviality)
- [ ] Run test: `npx vitest run packages/core/src/build/nix-reproducibility.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 1 hour (builds on Task 1)

---

### Test: T-4.5-03 (Dockerfile.nix determinism analysis)

**File:** `packages/core/src/build/nix-reproducibility.test.ts`

**Tasks to make this test pass:**

- [ ] Create `docker/Dockerfile.nix` (Nix expression, not traditional Dockerfile)
- [ ] Use `dockerTools.buildLayeredImage` pattern
- [ ] Pin all dependencies via Nix store (no apt-get, npm install, etc.)
- [ ] Create `packages/core/src/build/pcr-validator.ts`
- [ ] Implement `readDockerfileNix(path)` function
- [ ] Implement `analyzeDockerfileForNonDeterminism(content, forbiddenPatterns)`
- [ ] Define `ForbiddenPattern`, `Violation`, `DeterminismReport` types
- [ ] Return `{ deterministic, violations[], scannedLines }` report
- [ ] Fix path resolution: use `resolveFromRoot()` pattern from oyster-config.test.ts
- [ ] Run test: `npx vitest run packages/core/src/build/nix-reproducibility.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 3 hours

---

### Test: T-4.5-04 (CI PCR reproducibility verification)

**File:** `packages/core/src/build/nix-reproducibility.test.ts`

**Tasks to make this test pass:**

- [ ] Implement `verifyPcrReproducibility(buildA, buildB, options?)` in pcr-validator.ts
- [ ] Define `PcrReproducibilityResult` interface
- [ ] Define `VerifyOptions` interface with `throwOnMismatch?` boolean
- [ ] Compare all 3 PCR registers + imageHash
- [ ] Return structured result with per-field match booleans and details
- [ ] Generate human-readable summary string for CI logs
- [ ] Implement `PcrReproducibilityError` extending `CrosstownError`
- [ ] Error message includes both PCR values for debugging
- [ ] Run test: `npx vitest run packages/core/src/build/nix-reproducibility.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 2 hours

---

### Test: T-4.5-05 (Barrel exports)

**File:** `packages/core/src/build/nix-reproducibility.test.ts`

**Tasks to make this test pass:**

- [ ] Create `packages/core/src/build/index.ts` barrel file
- [ ] Re-export NixBuilder, NixBuildResult, NixBuilderConfig from nix-builder.js
- [ ] Re-export verifyPcrReproducibility, readDockerfileNix, analyzeDockerfileForNonDeterminism from pcr-validator.js
- [ ] Re-export PcrReproducibilityError, PcrReproducibilityResult, VerifyOptions, DeterminismReport, Violation, ForbiddenPattern
- [ ] Add build module exports to `packages/core/src/index.ts`
- [ ] Run test: `npx vitest run packages/core/src/build/nix-reproducibility.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 0.5 hours

---

### Test: T-4.5-06 (flake.nix and .gitignore)

**File:** `packages/core/src/build/nix-reproducibility.test.ts`

**Tasks to make this test pass:**

- [ ] Create `flake.nix` at project root with docker-image output
- [ ] Pin nixpkgs to specific commit hash
- [ ] Include Node.js 20, pnpm, supervisord
- [ ] Define build derivation: pnpm install, build, deploy
- [ ] Output via `dockerTools.buildLayeredImage`
- [ ] Set NODE_ENV=production, expose ports 3100/7100/1300
- [ ] Create non-root crosstown user, CMD supervisord
- [ ] Create `flake.lock` via `nix flake lock`
- [ ] Add `/result` to `.gitignore`
- [ ] Run test: `npx vitest run packages/core/src/build/nix-reproducibility.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 2 hours

---

## Running Tests

```bash
# Run all failing tests for this story
npx vitest run packages/core/src/build/nix-reproducibility.test.ts

# Run with verbose output
npx vitest run packages/core/src/build/nix-reproducibility.test.ts --reporter=verbose

# Run all core package tests (ensure no regressions)
npx vitest run packages/core

# Run tests in watch mode during development
npx vitest packages/core/src/build/nix-reproducibility.test.ts

# Run tests with coverage
npx vitest run packages/core --coverage
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**

- All 33 tests written and failing (it.skip)
- Factory helpers created (createNixBuildResult, createBuildPair, createForbiddenPatterns)
- Local NixBuildResult type defined for RED phase compilation
- Path resolution fixed (resolveFromRoot pattern from oyster-config.test.ts)
- Alternative test file deleted (reproducibility.test.ts -- superseded)
- Mock requirements documented
- Implementation checklist created

**Verification:**

- All 33 tests skip as expected (RED phase)
- Full core package test suite passes (29 files, 682 tests)
- No compilation errors

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. **Start with Task 3** (pcr-validator.ts) -- pure functions, no external deps
2. **Then Task 1** (nix-builder.ts) -- depends on NixBuildResult type
3. **Then Task 5** (barrel exports) -- depends on both modules existing
4. **Then Task 6** (flake.nix, .gitignore) -- infrastructure files
5. **Then Task 3/Dockerfile** (docker/Dockerfile.nix) -- Nix expression

**Key Principles:**

- One test group at a time (don't try to fix all at once)
- Remove `it.skip()` only for the tests you're implementing
- Remove local `NixBuildResult` type when real import is available
- Mock `child_process` for NixBuilder tests in CI
- Run tests frequently

**CRITICAL GREEN Phase Notes:**

1. **Remove local NixBuildResult type**: When creating `nix-builder.ts`, uncomment the real import and delete the local interface definition at the top of the test file
2. **Remove placeholder variables**: Delete the `NixBuilder`, `verifyPcrReproducibility`, `readDockerfileNix`, `analyzeDockerfileForNonDeterminism` placeholder constants
3. **Path resolution**: Tests use `resolveFromRoot()` which navigates up 4 levels from `packages/core/src/build/` to the project root. This matches the pattern established in `oyster-config.test.ts`
4. **PcrReproducibilityError**: Must extend `CrosstownError` from `../errors.js` per project convention

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

**DEV Agent Responsibilities:**

1. Verify all 33 tests pass (green phase complete)
2. Review for code duplication between nix-builder.ts and pcr-validator.ts
3. Ensure TypeScript strict mode compliance
4. Verify ESM imports use `.js` extensions
5. Run full test suite after each refactor

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `npx vitest run packages/core/src/build/nix-reproducibility.test.ts`

**Results:**

```
 RUN  v1.6.1 /Users/jonathangreen/Documents/crosstown

 ↓ packages/core/src/build/nix-reproducibility.test.ts  (33 tests | 33 skipped)

 Test Files  1 skipped (1)
      Tests  33 skipped (33)
   Start at  14:50:26
   Duration  238ms
```

**Summary:**

- Total tests: 33
- Passing: 0 (expected)
- Failing/Skipped: 33 (expected -- it.skip RED phase)
- Status: RED phase verified

### Full Core Package Regression Check

**Command:** `npx vitest run packages/core`

**Results:**

```
 Test Files  29 passed | 2 skipped (31)
      Tests  682 passed | 44 skipped (726)
   Duration  1.84s
```

- No regressions from test file changes
- `reproducibility.test.ts` deletion did not break anything

---

## Notes

- **API Design Decision:** Chose class-based NixBuilder API over function-based computePcr/comparePcrs alternative. The class better models the real workflow (instantiate builder, run builds, compare results). Deleted the alternative `reproducibility.test.ts` (22 tests).

- **Local Type Definition:** Added a local `NixBuildResult` interface at the top of the test file so factory helpers compile during RED phase. This MUST be removed in GREEN phase when the real module is created.

- **Placeholder Variables:** Added placeholder constants for `NixBuilder`, `verifyPcrReproducibility`, `readDockerfileNix`, `analyzeDockerfileForNonDeterminism` with eslint-disable comments. These exist so the skipped test bodies reference variables that exist at module scope. Remove in GREEN phase.

- **Path Resolution:** Fixed from `path.resolve(process.cwd(), ...)` to `resolveFromRoot()` using `path.resolve(__dirname, '../../../../', ...)` which correctly navigates from `packages/core/src/build/` to the project root regardless of CWD.

- **Test Naming:** Added letter suffixes (a, b, c...) to test names for disambiguation within each T-4.5-XX group, following the pattern from `oyster-config.test.ts`.

---

## Test Traceability Matrix

| Test ID | Test Name | AC | File | Priority | Level | Status |
|---------|-----------|----|----|-------:|-------|--------|
| T-4.5-01a | Identical image hash | #1 | nix-reproducibility.test.ts | P0 | Unit | RED |
| T-4.5-01b | Identical store path | #1 | nix-reproducibility.test.ts | P0 | Unit | RED |
| T-4.5-01c | NixBuildResult fields | #1 | nix-reproducibility.test.ts | P0 | Unit | RED |
| T-4.5-02a | Identical PCR0 | #2 | nix-reproducibility.test.ts | P0 | Unit | RED |
| T-4.5-02b | All 3 PCR values match | #2 | nix-reproducibility.test.ts | P0 | Unit | RED |
| T-4.5-02c | Modified source -> different PCR | #2 | nix-reproducibility.test.ts | P0 | Unit | RED |
| T-4.5-03a | Dockerfile.nix exists | #3 | nix-reproducibility.test.ts | P1 | Static | RED |
| T-4.5-03b | No apt-get update | #3 | nix-reproducibility.test.ts | P1 | Static | RED |
| T-4.5-03c | No unpinned npm install | #3 | nix-reproducibility.test.ts | P1 | Static | RED |
| T-4.5-03d | No unpinned git clone | #3 | nix-reproducibility.test.ts | P1 | Static | RED |
| T-4.5-03e | Digest-pinned base images | #3 | nix-reproducibility.test.ts | P1 | Static | RED |
| T-4.5-03f | Zero violations (real Dockerfile) | #3 | nix-reproducibility.test.ts | P1 | Unit | RED |
| T-4.5-03g | Detects anti-patterns (bad Dockerfile) | #3 | nix-reproducibility.test.ts | P1 | Unit | RED |
| T-4.5-03h | Pinned Dockerfile passes | #3 | nix-reproducibility.test.ts | P1 | Unit | RED |
| T-4.5-04a | Identical builds pass verification | #4 | nix-reproducibility.test.ts | P1 | Unit | RED |
| T-4.5-04b | Divergent builds fail verification | #4 | nix-reproducibility.test.ts | P1 | Unit | RED |
| T-4.5-04c | throwOnMismatch throws error | #4 | nix-reproducibility.test.ts | P1 | Unit | RED |
| T-4.5-04d | Human-readable summary | #4 | nix-reproducibility.test.ts | P1 | Unit | RED |
| T-4.5-04e | E2E CI flow | #4 | nix-reproducibility.test.ts | P1 | Unit | RED |
| T-4.5-05a | NixBuilder exported | #5 | nix-reproducibility.test.ts | P1 | Integration | RED |
| T-4.5-05b | verifyPcrReproducibility exported | #5 | nix-reproducibility.test.ts | P1 | Integration | RED |
| T-4.5-05c | analyzeDockerfileForNonDeterminism exported | #5 | nix-reproducibility.test.ts | P1 | Integration | RED |
| T-4.5-05d | readDockerfileNix exported | #5 | nix-reproducibility.test.ts | P1 | Integration | RED |
| T-4.5-05e | PcrReproducibilityError exported | #5 | nix-reproducibility.test.ts | P1 | Integration | RED |
| T-4.5-05f | Top-level @crosstown/core re-exports | #5 | nix-reproducibility.test.ts | P1 | Integration | RED |
| T-4.5-06a | flake.nix exists | #6 | nix-reproducibility.test.ts | P1 | Static | RED |
| T-4.5-06b | docker-image output defined | #6 | nix-reproducibility.test.ts | P1 | Static | RED |
| T-4.5-06c | nixpkgs pinned | #6 | nix-reproducibility.test.ts | P1 | Static | RED |
| T-4.5-06d | Node.js 20 + supervisord | #6 | nix-reproducibility.test.ts | P1 | Static | RED |
| T-4.5-06e | Ports 3100, 7100, 1300 | #6 | nix-reproducibility.test.ts | P1 | Static | RED |
| T-4.5-06f | .gitignore contains /result | #6 | nix-reproducibility.test.ts | P1 | Static | RED |
| T-4.5-06g | NODE_ENV + crosstown user | #6 | nix-reproducibility.test.ts | P1 | Static | RED |
| T-4.5-06h | CMD supervisord | #6 | nix-reproducibility.test.ts | P1 | Static | RED |

---

## Knowledge Base References Applied

This ATDD workflow consulted the following:

- **test-quality.md** -- Given-When-Then structure, one assertion per test, determinism, isolation
- **test-levels-framework.md** -- Test level selection (Unit vs Static vs Integration for backend)
- **data-factories.md** -- Factory patterns with overrides support (createNixBuildResult)
- **component-tdd.md** -- TDD red-green-refactor cycle principles
- **oyster-config.test.ts** -- Existing test patterns: resolveFromRoot(), static file analysis, Given-When-Then

---

## Next Steps

1. **Share this checklist and failing tests** with the dev workflow (manual handoff)
2. **Review this checklist** with team in standup or planning
3. **Run failing tests** to confirm RED phase: `npx vitest run packages/core/src/build/nix-reproducibility.test.ts`
4. **Begin implementation** using implementation checklist as guide (start with pcr-validator.ts)
5. **Work one test group at a time** (red -> green for each T-4.5-XX group)
6. **Share progress** in daily standup
7. **When all tests pass**, refactor code for quality
8. **When refactoring complete**, manually update story status to 'done' in sprint-status.yaml

---

**Generated by BMad TEA Agent** -- 2026-03-15
