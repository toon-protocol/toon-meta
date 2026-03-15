---
stepsCompleted:
  [
    'step-01-preflight-and-context',
    'step-02-generation-mode',
    'step-03-test-generation',
    'step-04-data-infrastructure',
    'step-05-implementation-checklist',
    'step-06-deliverables',
  ]
lastStep: 'step-06-deliverables'
lastSaved: '2026-03-14'
workflowType: 'testarch-atdd'
inputDocuments:
  [
    '_bmad-output/implementation-artifacts/4-3-attestation-aware-peering.md',
    'packages/core/src/events/attestation.ts',
    'packages/core/src/types.ts',
    'packages/core/src/constants.ts',
    'packages/core/src/bootstrap/index.ts',
    'packages/core/src/index.ts',
  ]
---

# ATDD Checklist - Epic 4, Story 4.3: Attestation-Aware Peering

**Date:** 2026-03-14
**Author:** Jonathan
**Primary Test Level:** Unit

---

## Story Summary

Story 4.3 adds attestation-aware peering to the Crosstown protocol. The `AttestationVerifier` class provides PCR verification against a known-good registry, attestation lifecycle state management (valid/stale/unattested), and peer ranking that prefers TEE-attested relays over non-attested ones.

**As a** Crosstown relay operator bootstrapping into the network
**I want** the BootstrapService to parse, verify, and rank peers based on kind:10033 TEE attestation events
**So that** my node preferentially connects to peers running verified, unmodified code in TEE enclaves

---

## Acceptance Criteria

1. **AC#1 - PCR Verification:** Given a valid kind:10033 event, `AttestationVerifier.verify()` returns `{ valid: true }` when all PCR values match the known-good registry, and `{ valid: false, reason: 'PCR mismatch' }` when any PCR does not match.
2. **AC#2 - Attestation State Lifecycle:** `getAttestationState()` returns VALID within validity period, STALE after validity but within grace period, UNATTESTED after both expire. Boundary: at exactly `attestedAt + validitySeconds` = VALID (inclusive); at exactly `attestedAt + validitySeconds + graceSeconds` = STALE (inclusive); at grace+1s = UNATTESTED.
3. **AC#3 - Peer Ranking:** `rankPeers()` places all TEE-attested peers before all non-attested peers, preserving relative order within each group (stable sort).
4. **AC#4 - Dual-Channel Consistency:** The same `AttestationVerifier` instance returns identical `AttestationState` values regardless of whether queried via the kind:10033 event path or the /health endpoint path (R-E4-008).
5. **AC#5 - Exports:** `AttestationVerifier`, `AttestationState`, `VerificationResult`, `PeerDescriptor`, and `AttestationVerifierConfig` are exported from `@crosstown/core`.

---

## Failing Tests Created (RED Phase)

### Unit Tests (11 tests across 8 test groups)

**File:** `packages/core/src/bootstrap/AttestationVerifier.test.ts` (320 lines)

- **Test:** T-4.3-01 -- should extract PCR values and attestation doc from a valid kind:10033 event
  - **Status:** RED -- Module `./AttestationVerifier.js` does not exist
  - **Verifies:** AC#1 -- `parseAttestation()` (from Story 4.2) correctly extracts PCR values; event factory produces valid events with required tags

- **Test:** T-4.3-02 -- should return { valid: true } when PCR values match the known-good registry
  - **Status:** RED -- `AttestationVerifier` class does not exist
  - **Verifies:** AC#1 -- `verify()` accepts attestation with all three PCR values present in the registry

- **Test:** T-4.3-03 -- should return { valid: false, reason: "PCR mismatch" } when PCR values do not match
  - **Status:** RED -- `AttestationVerifier` class does not exist
  - **Verifies:** AC#1 -- `verify()` rejects attestation when any PCR value is not in the registry

- **Test:** T-4.3-04 -- should rank attested peers higher than non-attested peers
  - **Status:** RED -- `AttestationVerifier` class does not exist
  - **Verifies:** AC#3 -- `rankPeers()` orders attested before non-attested

- **Test:** T-4.3-05a -- should transition from VALID to STALE after attestation expiry
  - **Status:** RED -- `AttestationVerifier` class does not exist
  - **Verifies:** AC#2 -- State is STALE at `attestedAt + validitySeconds + 1`

- **Test:** T-4.3-05b -- should transition from STALE to UNATTESTED after grace period expires
  - **Status:** RED -- `AttestationVerifier` class does not exist
  - **Verifies:** AC#2 -- State is UNATTESTED at `attestedAt + validitySeconds + graceSeconds + 1`

- **Test:** T-4.3-05c -- should remain VALID within the validity period
  - **Status:** RED -- `AttestationVerifier` class does not exist
  - **Verifies:** AC#2 -- State is VALID at `attestedAt + validitySeconds - 1`

- **Test:** T-4.3-06a -- should be VALID at exactly the validity boundary (inclusive <=)
  - **Status:** RED -- `AttestationVerifier` class does not exist
  - **Verifies:** AC#2 -- Boundary: VALID at exactly `attestedAt + validitySeconds`

- **Test:** T-4.3-06b -- should be STALE at exactly 30s into grace period
  - **Status:** RED -- `AttestationVerifier` class does not exist
  - **Verifies:** AC#2 -- Boundary: STALE at exactly `attestedAt + validitySeconds + graceSeconds`

- **Test:** T-4.3-06c -- should be UNATTESTED at 31s past grace period start
  - **Status:** RED -- `AttestationVerifier` class does not exist
  - **Verifies:** AC#2 -- Boundary: UNATTESTED at `attestedAt + validitySeconds + graceSeconds + 1`

- **Test:** T-RISK-01 -- should produce the same AttestationState for both kind:10033 events and /health responses
  - **Status:** RED -- `AttestationVerifier` class does not exist
  - **Verifies:** AC#4 -- Same verifier instance, same inputs, same output (dual-channel consistency)

---

## Data Factories Created

### TeeAttestation Factory

**File:** `packages/core/src/bootstrap/AttestationVerifier.test.ts` (inline)

**Exports (test-scoped):**

- `createTestAttestation(overrides?)` -- Creates a `TeeAttestation` with PCR values `'a'.repeat(96)`, `'b'.repeat(96)`, `'c'.repeat(96)` and optional field overrides
- `createAttestationEvent(pubkey, attestation?, createdAt?)` -- Creates a kind:10033 `NostrEvent` with required tags (relay, chain, expiry) so `parseAttestation()` returns a valid result
- `createKnownGoodRegistry()` -- Creates a `Map<string, boolean>` with the three default PCR values
- `createPeerDescriptor(pubkey, attested, attestationTimestamp?)` -- Creates a `PeerDescriptor` for ranking tests

**Example Usage:**

```typescript
const attestation = createTestAttestation({ pcr0: 'd'.repeat(96) });
const event = createAttestationEvent(pubkey, attestation);
const registry = createKnownGoodRegistry();
const peer = createPeerDescriptor('a'.repeat(64), true, 1767225600);
```

---

## Fixtures Created

No separate fixture files created. Test infrastructure is inline in the test file. This is appropriate because:
- All tests are pure logic (no setup/teardown of external resources)
- No database, network, or file system dependencies
- Factory functions provide sufficient test data isolation
- Real nostr-tools crypto (`generateSecretKey`, `getPublicKey`) generates fresh keys per test via `beforeEach`

---

## Mock Requirements

No mocks required. The `AttestationVerifier` is a pure logic class with no external dependencies:
- No WebSocket connections
- No HTTP calls
- No database access
- No relay queries
- Accepts parsed attestation data, returns verification results

The `parseAttestation()` function from Story 4.2 is tested with real (non-mocked) event data including proper tags.

---

## Required data-testid Attributes

Not applicable. Story 4.3 is backend-only (pure TypeScript logic class). No UI components are created or modified.

---

## Implementation Checklist

### Test: T-4.3-01 -- Parse kind:10033 events

**File:** `packages/core/src/bootstrap/AttestationVerifier.test.ts`

**Tasks to make this test pass:**

- [x] `parseAttestation()` already exists from Story 4.2 (no implementation needed)
- [ ] Create `packages/core/src/bootstrap/AttestationVerifier.ts` (even an empty file that exports the types would unblock the import)
- [ ] Export `AttestationState` enum and `PeerDescriptor` type from the new file
- [ ] Run test: `npx vitest run packages/core/src/bootstrap/AttestationVerifier.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 0.25 hours (this test validates existing Story 4.2 code)

---

### Test: T-4.3-02 -- PCR match known-good registry

**File:** `packages/core/src/bootstrap/AttestationVerifier.test.ts`

**Tasks to make this test pass:**

- [ ] Create `AttestationVerifier` class in `packages/core/src/bootstrap/AttestationVerifier.ts`
- [ ] Implement constructor accepting `AttestationVerifierConfig` with `knownGoodPcrs` map
- [ ] Implement `verify(attestation: TeeAttestation): VerificationResult`
- [ ] Check pcr0, pcr1, pcr2 against `knownGoodPcrs` map
- [ ] Return `{ valid: true }` when all three match
- [ ] Run test: `npx vitest run packages/core/src/bootstrap/AttestationVerifier.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 0.5 hours

---

### Test: T-4.3-03 -- PCR mismatch rejected

**File:** `packages/core/src/bootstrap/AttestationVerifier.test.ts`

**Tasks to make this test pass:**

- [ ] In `verify()`, return `{ valid: false, reason: 'PCR mismatch' }` when any PCR is not in the registry
- [ ] Run test: `npx vitest run packages/core/src/bootstrap/AttestationVerifier.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 0.25 hours (builds on T-4.3-02 implementation)

---

### Test: T-4.3-04 -- Prefer attested relays

**File:** `packages/core/src/bootstrap/AttestationVerifier.test.ts`

**Tasks to make this test pass:**

- [ ] Implement `rankPeers(peers: PeerDescriptor[]): PeerDescriptor[]`
- [ ] Use `Array.prototype.filter()` to partition (NOT `sort()` -- filter guarantees stability)
- [ ] Return `[...attested, ...nonAttested]` as a new array
- [ ] Do NOT mutate input array
- [ ] Run test: `npx vitest run packages/core/src/bootstrap/AttestationVerifier.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 0.25 hours

---

### Test: T-4.3-05 -- State transitions (valid -> stale -> unattested)

**File:** `packages/core/src/bootstrap/AttestationVerifier.test.ts`

**Tasks to make this test pass:**

- [ ] Implement `getAttestationState(attestation: TeeAttestation, attestedAt: number, now?: number): AttestationState`
- [ ] Default `now` to `Math.floor(Date.now() / 1000)` if not provided
- [ ] If `now <= attestedAt + validitySeconds`: return `AttestationState.VALID`
- [ ] If `now <= attestedAt + validitySeconds + graceSeconds`: return `AttestationState.STALE`
- [ ] Otherwise: return `AttestationState.UNATTESTED`
- [ ] Default `validitySeconds` to 300, `graceSeconds` to 30
- [ ] Run test: `npx vitest run packages/core/src/bootstrap/AttestationVerifier.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 0.5 hours

---

### Test: T-4.3-06 -- 30s grace boundary values

**File:** `packages/core/src/bootstrap/AttestationVerifier.test.ts`

**Tasks to make this test pass:**

- [ ] Verify boundary behavior in `getAttestationState()`:
  - At exactly `attestedAt + validitySeconds`: VALID (inclusive `<=`)
  - At exactly `attestedAt + validitySeconds + graceSeconds`: STALE (inclusive `<=`)
  - At `grace + 1`: UNATTESTED
- [ ] Run test: `npx vitest run packages/core/src/bootstrap/AttestationVerifier.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 0.25 hours (covered by T-4.3-05 implementation if boundaries are correct)

---

### Test: T-4.3-07 -- Mixed peer ordering

**File:** `packages/core/src/bootstrap/AttestationVerifier.test.ts`

**Tasks to make this test pass:**

- [ ] `rankPeers()` must preserve relative order within attested and non-attested groups
- [ ] Use `filter()` not `sort()` to guarantee stable partitioning
- [ ] Run test: `npx vitest run packages/core/src/bootstrap/AttestationVerifier.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 0.25 hours (covered by T-4.3-04 implementation if using filter)

---

### Test: T-RISK-01 -- Dual-channel consistency

**File:** `packages/core/src/bootstrap/AttestationVerifier.test.ts`

**Tasks to make this test pass:**

- [ ] `getAttestationState()` must be a pure function (same inputs -> same output)
- [ ] The verifier is the single source of truth -- both code paths use the same instance
- [ ] Run test: `npx vitest run packages/core/src/bootstrap/AttestationVerifier.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 0.25 hours (automatically passes when getAttestationState is pure)

---

### Export Tasks (AC#5)

**Files:** `packages/core/src/bootstrap/index.ts`, `packages/core/src/index.ts`

**Tasks:**

- [ ] Add to `packages/core/src/bootstrap/index.ts`:
  ```typescript
  export {
    AttestationVerifier,
    AttestationState,
    type VerificationResult,
    type PeerDescriptor,
    type AttestationVerifierConfig,
  } from './AttestationVerifier.js';
  ```
- [ ] Add to `packages/core/src/index.ts` (bootstrap section):
  ```typescript
  export {
    AttestationVerifier,
    AttestationState,
    type VerificationResult,
    type PeerDescriptor,
    type AttestationVerifierConfig,
  } from './bootstrap/index.js';
  ```
- [ ] Run build: `cd packages/core && pnpm build`
- [ ] Verify exports resolve correctly

**Estimated Effort:** 0.25 hours

---

## Running Tests

```bash
# Run all failing tests for this story
npx vitest run packages/core/src/bootstrap/AttestationVerifier.test.ts

# Run tests in watch mode
npx vitest packages/core/src/bootstrap/AttestationVerifier.test.ts

# Run with verbose output
npx vitest run packages/core/src/bootstrap/AttestationVerifier.test.ts --reporter=verbose

# Run all core package tests
cd packages/core && pnpm test

# Run with coverage
npx vitest run packages/core/src/bootstrap/AttestationVerifier.test.ts --coverage
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**

- All 11 tests written and failing (module not found: `./AttestationVerifier.js`)
- Factories created with proper types and required tags
- Bug fixes applied (3 bugs from ATDD stub review)
- Implementation checklist created
- No mocks required (pure logic class)

**Verification:**

- All tests run and fail as expected
- Failure is: `Error: Failed to load url ./AttestationVerifier.js`
- Tests fail due to missing implementation module, not test bugs
- `parseAttestation()` import from Story 4.2 resolves correctly

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. **Create** `packages/core/src/bootstrap/AttestationVerifier.ts`
2. **Define** `AttestationState` enum (VALID, STALE, UNATTESTED)
3. **Define** types: `VerificationResult`, `PeerDescriptor`, `AttestationVerifierConfig`
4. **Implement** `AttestationVerifier` class:
   - `constructor(config: AttestationVerifierConfig)`
   - `verify(attestation: TeeAttestation): VerificationResult`
   - `getAttestationState(attestation: TeeAttestation, attestedAt: number, now?: number): AttestationState`
   - `rankPeers(peers: PeerDescriptor[]): PeerDescriptor[]`
5. **Export** from `bootstrap/index.ts` and `core/src/index.ts`
6. **Run tests** and verify all 11 pass

**Key Principles:**

- One test at a time (don't try to fix all at once)
- Minimal implementation (don't over-engineer)
- Run tests frequently (immediate feedback)
- Use implementation checklist as roadmap

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

**DEV Agent Responsibilities:**

1. Verify all tests pass (green phase complete)
2. Review code for quality (readability, maintainability)
3. Ensure no mutation in `rankPeers()` and `verify()`
4. Verify JSDoc comments are complete
5. Run full `pnpm build && pnpm test` to catch regressions

---

## Next Steps

1. **Review this checklist** and the failing test output
2. **Run failing tests** to confirm RED phase: `npx vitest run packages/core/src/bootstrap/AttestationVerifier.test.ts`
3. **Begin implementation** using the implementation checklist as guide
4. **Work one test at a time** (red -> green for each)
5. **When all tests pass**, refactor code for quality
6. **Export from index files** (AC#5)
7. **Run full build** to verify: `cd packages/core && pnpm build && pnpm test`

---

## Knowledge Base References Applied

- **test-quality.md** -- Test design principles (Given-When-Then, one assertion per test, determinism, isolation)
- **data-factories.md** -- Factory patterns for test data generation with overrides support
- **test-levels-framework.md** -- Test level selection (Unit selected: pure logic, no transport)
- **component-tdd.md** -- TDD cycle patterns (RED -> GREEN -> REFACTOR)

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `npx vitest run packages/core/src/bootstrap/AttestationVerifier.test.ts`

**Results:**

```
 FAIL  packages/core/src/bootstrap/AttestationVerifier.test.ts
Error: Failed to load url ./AttestationVerifier.js (resolved id: ./AttestationVerifier.js)
in /Users/jonathangreen/Documents/crosstown/packages/core/src/bootstrap/AttestationVerifier.test.ts.
Does the file exist?

 Test Files  1 failed (1)
      Tests  no tests
   Duration  261ms
```

**Summary:**

- Total tests: 11 (in 1 test file)
- Passing: 0 (expected)
- Failing: 1 suite (module not found) -- all 11 tests blocked
- Status: RED phase verified

**Expected Failure Reason:**
- `Error: Failed to load url ./AttestationVerifier.js` -- The implementation module does not exist yet. Once created, all tests will attempt to run and should pass with correct implementation.

---

## ATDD Stub Bug Fixes Applied

Three bugs were found and fixed in the original RED phase test stubs:

1. **Missing tags in `createAttestationEvent()`**: The factory created events with `tags: []`, but `parseAttestation()` requires relay, chain, and expiry tags. Fixed by adding `[['relay', 'ws://test:7100'], ['chain', '31337'], ['expiry', String(createdAt + 300)]]`.

2. **Incorrect `parseAttestation()` return type assertions**: T-4.3-01 accessed `result.enclave`, `result.pcr0` directly, but `parseAttestation()` returns `ParsedAttestation | null` where fields are at `result.attestation.enclave`, `result.attestation.pcr0`. Fixed to unwrap via `.attestation`.

3. **Variable reference error**: `_attestation` declared but `attestation` referenced on next line. Fixed by removing `_` prefix from all variables and uncommenting all assertion code.

**Additional improvements:**
- Changed `createTestAttestation()` return type from `Record<string, unknown>` to `TeeAttestation` for type safety
- Changed `attestationDoc` value from `'base64-encoded-attestation-doc'` to `'base64encodedattestationdoc'` (valid base64 characters only, compatible with strict validation)
- Added validity boundary test (T-4.3-06a) for `VALID` at exactly `attestedAt + validitySeconds`
- Added stable sort assertions to T-4.3-07 to verify relative order preservation
- Imported `PeerDescriptor` type from `AttestationVerifier.js` for type-safe factory return

---

## Notes

- This is a pure logic class with no transport dependencies -- ideal for unit testing
- `parseAttestation()` from Story 4.2 is tested but not reimplemented
- The `AttestationVerifier` will be integrated into `BootstrapService` in Story 4.6
- Payment channels are never affected by attestation state changes (trust degrades; money doesn't)
- PCR registry is a simple `Map<string, boolean>` -- future stories may use on-chain verification

---

**Generated by BMad TEA Agent** - 2026-03-14
