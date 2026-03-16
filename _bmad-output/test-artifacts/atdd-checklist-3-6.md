---
stepsCompleted:
  [
    'step-01-preflight-and-context',
    'step-02-generation-mode',
    'step-03-test-strategy',
    'step-04-generate-tests',
    'step-04c-aggregate',
    'step-05-validate-and-complete',
  ]
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-03-14'
workflowType: 'testarch-atdd'
inputDocuments:
  [
    '_bmad-output/implementation-artifacts/3-6-enriched-health-endpoint.md',
    'packages/town/src/health.test.ts',
    'packages/town/src/town.test.ts',
    'packages/town/src/town.ts',
    'packages/town/src/index.ts',
    'packages/town/vitest.config.ts',
    'packages/core/src/index.ts',
    'packages/core/src/bootstrap/types.ts',
    'vitest.config.ts',
  ]
---

# ATDD Checklist - Epic 3, Story 3.6: Enriched /health Endpoint

**Date:** 2026-03-14
**Author:** Jonathan
**Primary Test Level:** Unit (backend, no UI)

---

## Story Summary

The `/health` endpoint is enriched to return comprehensive node status including pricing, capabilities, chain configuration, and service discovery information. This enables network operators and AI agents to monitor nodes and make programmatic peering decisions.

**As a** network operator or AI agent
**I want** the health endpoint to return comprehensive node status including pricing and capabilities
**So that** I can monitor nodes and make programmatic peering decisions

---

## Acceptance Criteria

1. **AC #1:** Given a running Crosstown node, when I request `GET /health`, then the response is a JSON object containing all of: `status`, `phase`, `pubkey`, `ilpAddress`, `peerCount`, `discoveredPeerCount`, `channelCount`, `pricing` (basePricePerByte + currency USDC), `capabilities`, `chain`, `version`, `sdk: true`, `timestamp`. When x402 is enabled, the response also includes `x402` (enabled + endpoint).
2. **AC #2:** Given a node with x402 disabled, when I request `GET /health`, then the `x402` field is entirely omitted (not set to `{ enabled: false }`), and `capabilities` does not contain `'x402'`.

---

## Failing Tests Created (RED Phase)

### Unit Tests (11 tests)

**File:** `packages/town/src/health.test.ts` (196 lines)

- **Test:** `[P2] response includes phase, peerCount, channelCount, pricing, x402, capabilities, chain, version (T-3.6-01)`
  - **Status:** RED - `it.skip()` -- module `./health.js` does not exist
  - **Verifies:** AC #1 -- full response schema shape with x402 enabled

- **Test:** `[P2] response with x402 disabled omits x402 field entirely (T-3.6-02)`
  - **Status:** RED - `it.skip()` -- module `./health.js` does not exist
  - **Verifies:** AC #2 -- x402 field omission semantics (not `{ enabled: false }`)

- **Test:** `[P2] peerCount and channelCount match actual node state (T-3.6-03)`
  - **Status:** RED - `it.skip()` -- module `./health.js` does not exist
  - **Verifies:** AC #1 -- runtime state fields match config inputs

- **Test:** `[P2] returns correct version from @crosstown/core (T-3.6-04)`
  - **Status:** RED - `it.skip()` -- module `./health.js` does not exist
  - **Verifies:** AC #1 -- version field uses VERSION constant

- **Test:** `[P2] returns sdk: true (T-3.6-05)`
  - **Status:** RED - `it.skip()` -- module `./health.js` does not exist
  - **Verifies:** AC #1 -- backward compatibility with E2E SDK detection

- **Test:** `[P2] always returns status healthy (T-3.6-06)`
  - **Status:** RED - `it.skip()` -- module `./health.js` does not exist
  - **Verifies:** AC #1 -- status is liveness check, not readiness

- **Test:** `[P2] timestamp is a recent number (T-3.6-07)`
  - **Status:** RED - `it.skip()` -- module `./health.js` does not exist
  - **Verifies:** AC #1 -- timestamp is current epoch milliseconds

- **Test:** `[P2] includes pubkey and ilpAddress from config (T-3.6-08)`
  - **Status:** RED - `it.skip()` -- module `./health.js` does not exist
  - **Verifies:** AC #1 -- identity fields pass through from config

- **Test:** `[P2] x402 enabled includes endpoint /publish (T-3.6-09)`
  - **Status:** RED - `it.skip()` -- module `./health.js` does not exist
  - **Verifies:** AC #1 -- x402 object shape when enabled

- **Test:** `[P2] capabilities array always includes relay (T-3.6-10)`
  - **Status:** RED - `it.skip()` -- module `./health.js` does not exist
  - **Verifies:** AC #1, #2 -- relay always present, x402 conditional

- **Test:** `[P2] pricing basePricePerByte converted from bigint (T-3.6-11)`
  - **Status:** RED - `it.skip()` -- module `./health.js` does not exist
  - **Verifies:** AC #1 -- bigint-to-number conversion for JSON serialization

### Static Analysis / Integration Tests (2 tests)

**File:** `packages/town/src/town.test.ts` (appended, 2 new tests)

- **Test:** `town.ts imports createHealthResponse from ./health.js (T-3.6-12)`
  - **Status:** RED - `it.skip()` -- import does not exist in town.ts yet
  - **Verifies:** AC #1 -- town.ts uses the new health module

- **Test:** `town.ts health endpoint calls createHealthResponse (T-3.6-13)`
  - **Status:** RED - `it.skip()` -- createHealthResponse not referenced in town.ts yet
  - **Verifies:** AC #1 -- /health handler delegates to the pure function

---

## Data Factories Created

### HealthConfig Factory

**File:** `packages/town/src/health.test.ts` (inline)

**Exports:**

- `_createHealthConfig(overrides?)` - Creates a HealthConfig matching the interface

**Factory Fields (matching HealthConfig interface):**

- `phase: 'ready'`
- `pubkey: 'abcdef...' (64 hex chars)`
- `ilpAddress: 'g.crosstown.abcdef12345678'`
- `peerCount: 5`
- `discoveredPeerCount: 12`
- `channelCount: 3`
- `basePricePerByte: 10n (bigint)`
- `x402Enabled: true`
- `chain: 'arbitrum-one'`

**ATDD Stub Bugs Fixed:**

1. Added missing required fields: `phase`, `pubkey`, `ilpAddress`
2. Removed derived fields that are NOT in HealthConfig: `currency`, `x402Endpoint`, `capabilities`, `version`
3. Changed `basePricePerByte: 10` to `basePricePerByte: 10n` (bigint)
4. Fixed import name: `createHealthResponse` (not `createHealthHandler`)
5. Fixed x402 disabled assertion: omit field entirely (not `enabled: false`)
6. Fixed BootstrapPhase regex: `discovering|registering|announcing|ready|failed` (not `starting|running|stopping`)

---

## Fixtures Created

No separate fixture files needed. The `_createHealthConfig()` factory function is defined inline in the test file. `createHealthResponse()` is a pure function with no external dependencies, so no fixture setup/teardown is required.

---

## Mock Requirements

No mocks needed. `createHealthResponse()` is a pure function that takes a `HealthConfig` and returns a `HealthResponse`. It has no side effects, no I/O, no database access.

The static analysis tests in `town.test.ts` read source files via `readFileSync` (following the established pattern from Story 3.4 and 3.5).

---

## Required data-testid Attributes

Not applicable. Story 3.6 is a backend-only story with no UI components.

---

## Implementation Checklist

### Test: T-3.6-01 through T-3.6-11 (Unit tests for createHealthResponse)

**File:** `packages/town/src/health.test.ts`

**Tasks to make these tests pass:**

- [ ] Create `packages/town/src/health.ts` with `HealthConfig` and `HealthResponse` interfaces
- [ ] Implement `createHealthResponse(config: HealthConfig): HealthResponse` pure function
- [ ] Import `VERSION` from `@crosstown/core`
- [ ] Handle x402 field omission when `x402Enabled: false` (AC #2)
- [ ] Convert `basePricePerByte` from bigint to number via `Number()`
- [ ] Set `capabilities` array based on x402 flag (`['relay']` or `['relay', 'x402']`)
- [ ] Export `createHealthResponse`, `HealthConfig`, `HealthResponse` from `health.ts`
- [ ] Export health module from `packages/town/src/index.ts`
- [ ] Remove `it.skip()` from all 11 tests in health.test.ts
- [ ] Uncomment test imports and assertions
- [ ] Run tests: `npx vitest run packages/town/src/health.test.ts`
- [ ] All 11 tests pass (green phase)

**Estimated Effort:** 1-2 hours

---

### Test: T-3.6-12, T-3.6-13 (Static analysis for town.ts integration)

**File:** `packages/town/src/town.test.ts`

**Tasks to make these tests pass:**

- [ ] Import `createHealthResponse` from `./health.js` in `packages/town/src/town.ts`
- [ ] Replace inline `/health` handler (lines 686-701) with `createHealthResponse()` call
- [ ] Wire config fields: `phase`, `pubkey`, `ilpAddress`, `peerCount`, `discoveredPeerCount`, `channelCount`, `basePricePerByte`, `x402Enabled`, `chain`
- [ ] Remove `it.skip()` from both tests in town.test.ts
- [ ] Run tests: `npx vitest run packages/town/src/town.test.ts`
- [ ] Both tests pass (green phase)

**Estimated Effort:** 0.5 hours

---

## Running Tests

```bash
# Run all failing tests for Story 3.6
npx vitest run packages/town/src/health.test.ts packages/town/src/town.test.ts --reporter=verbose

# Run specific test file (health unit tests)
npx vitest run packages/town/src/health.test.ts --reporter=verbose

# Run specific test file (town.ts integration tests)
npx vitest run packages/town/src/town.test.ts --reporter=verbose

# Run full test suite to check for regressions
pnpm test

# Run tests in watch mode for development
npx vitest packages/town/src/health.test.ts
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**

- All 13 tests written and skipped (`it.skip()`)
- Factory corrected to match `HealthConfig` interface
- ATDD stub bugs fixed (6 issues corrected from original stubs)
- Implementation checklist created
- No separate fixtures/mocks needed (pure function)

**Verification:**

- All 11 health.test.ts tests detected and skipped
- All 2 town.test.ts static analysis tests detected and skipped
- Full test suite passes with no regressions (75 passed, 14 skipped)

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. **Create `packages/town/src/health.ts`** -- implement `createHealthResponse()`, `HealthConfig`, `HealthResponse`
2. **Update `packages/town/src/index.ts`** -- export new health APIs
3. **Update `packages/town/src/town.ts`** -- replace inline health handler with `createHealthResponse()`
4. **Enable tests** -- remove `it.skip()`, uncomment imports and assertions
5. **Run tests** -- verify all 13 tests pass

**Key Principles:**

- One test at a time (start with T-3.6-06 "always returns status healthy" -- simplest)
- Minimal implementation (pure function, no I/O)
- Run tests frequently (immediate feedback)
- Use implementation checklist as roadmap

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

**DEV Agent Responsibilities:**

1. Verify all 13 tests pass (green phase complete)
2. Review code for quality (TypeScript types, ESM imports)
3. Verify backward compatibility (`sdk: true`, `status: 'healthy'`)
4. Run full test suite: `pnpm build && pnpm lint && pnpm test`
5. Verify `sdk-entrypoint-validation.test.ts` still passes

---

## Test Traceability Matrix

| ATDD Test ID | Test Name | AC | Test-Design ID | Risk Link | Priority | Level |
|---|---|---|---|---|---|---|
| T-3.6-01 | response includes full schema | #1 | 3.6-UNIT-001 | E3-R013 | P2 | Unit |
| T-3.6-02 | x402 disabled omits x402 field | #2 | 3.6-UNIT-001 | -- | P2 | Unit |
| T-3.6-03 | peerCount/channelCount match config | #1 | 3.6-INT-001 | -- | P2 | Unit |
| T-3.6-04 | version from @crosstown/core | #1 | -- | -- | P2 | Unit |
| T-3.6-05 | sdk: true | #1 | -- | -- | P2 | Unit |
| T-3.6-06 | status always healthy | #1 | -- | -- | P2 | Unit |
| T-3.6-07 | timestamp is recent | #1 | -- | -- | P2 | Unit |
| T-3.6-08 | pubkey and ilpAddress from config | #1 | -- | -- | P2 | Unit |
| T-3.6-09 | x402 enabled includes /publish | #1 | -- | -- | P2 | Unit |
| T-3.6-10 | capabilities always includes relay | #1, #2 | -- | -- | P2 | Unit |
| T-3.6-11 | basePricePerByte bigint conversion | #1 | -- | -- | P2 | Unit |
| T-3.6-12 | town.ts imports createHealthResponse | #1 | -- | -- | P2 | Static |
| T-3.6-13 | town.ts calls createHealthResponse | #1 | -- | -- | P2 | Static |

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `npx vitest run packages/town/src/health.test.ts packages/town/src/town.test.ts --reporter=verbose`

**Results:**

```
Test Files  1 passed | 1 skipped (2)
Tests       41 passed | 13 skipped (54)
```

**Summary:**

- Total Story 3.6 tests: 13
- Passing: 0 (expected - all skipped)
- Skipped: 13 (expected - RED phase)
- Status: RED phase verified

**Full suite regression check:**

```
Test Files  75 passed | 14 skipped (89)
Tests       1535 passed | 162 skipped (1697)
```

No regressions. All existing tests continue to pass.

---

## ATDD Stub Bugs Fixed

The following bugs were identified in the original ATDD stubs and corrected:

1. **Factory field drift:** `_createHealthConfig` had fields not in `HealthConfig` interface (`currency`, `x402Endpoint`, `capabilities`, `version`). These are derived by `createHealthResponse()`, not part of the input config. Removed.
2. **Missing required fields:** `phase`, `pubkey`, `ilpAddress` were missing from factory. Added.
3. **Wrong basePricePerByte type:** Factory used `10` (number) but `HealthConfig.basePricePerByte` is `bigint`. Changed to `10n`.
4. **Wrong import name:** Stubs referenced `createHealthHandler` / `handler.getHealth()` but implementation is `createHealthResponse(config)` (pure function, not handler class). Updated.
5. **Wrong x402 disabled assertion:** Stubs asserted `response.x402.enabled === false` and `response.x402.endpoint === undefined`. Per AC #2, when x402 is disabled the entire `x402` field must be omitted. Fixed to assert `response.x402 === undefined` and `!('x402' in response)`.
6. **Wrong BootstrapPhase regex:** Stubs used `(starting|running|stopping)` but actual `BootstrapPhase` type is `'discovering' | 'registering' | 'announcing' | 'ready' | 'failed'`. Fixed regex.

---

## Notes

- `createHealthResponse()` is a **pure function** -- no mocks, fixtures, or infrastructure needed for unit testing
- Static analysis tests in `town.test.ts` follow the established pattern from Story 3.4 and 3.5 (reading source files with `readFileSync`)
- Risk E3-R013 (/health schema instability) is mitigated by the schema snapshot test (T-3.6-01) and the `HealthResponse` TypeScript type
- The `sdk-entrypoint-validation.test.ts` greps `docker/src/entrypoint-town.ts`, NOT `packages/town/src/town.ts`, so it is unaffected by this refactoring
- Backward compatibility: `status: 'healthy'` and `sdk: true` preserved; `bootstrapPhase` renamed to `phase` (minor breaking change for field-name consumers)

---

## Knowledge Base References Applied

This ATDD workflow consulted the following knowledge fragments:

- **data-factories.md** - Factory pattern for `_createHealthConfig()` with `Partial` overrides
- **test-quality.md** - Deterministic tests, explicit assertions in test bodies, no hidden assertion helpers
- **test-levels-framework.md** - Test level selection: unit tests for pure functions (primary), static analysis for integration verification

---

**Generated by BMad TEA Agent** - 2026-03-14
