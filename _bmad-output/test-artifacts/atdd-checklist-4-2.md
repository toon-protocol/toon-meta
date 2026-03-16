---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-generation-mode
  - step-03-test-strategy
  - step-04c-aggregate
  - step-05-validate-and-complete
lastStep: step-05-validate-and-complete
lastSaved: '2026-03-14'
workflowType: testarch-atdd
inputDocuments:
  - _bmad-output/implementation-artifacts/4-2-tee-attestation-events.md
  - packages/core/src/events/service-discovery.ts
  - packages/core/src/events/seed-relay.ts
  - packages/core/src/events/attestation.test.ts
  - packages/core/src/constants.ts
  - packages/core/src/types.ts
  - packages/core/src/events/index.ts
  - packages/core/src/index.ts
  - packages/town/src/health.ts
  - docker/src/attestation-server.ts
  - _bmad/tea/testarch/knowledge/data-factories.md
  - _bmad/tea/testarch/knowledge/test-quality.md
  - _bmad/tea/testarch/knowledge/test-levels-framework.md
---

# ATDD Checklist - Epic 4, Story 4.2: TEE Attestation Events

**Date:** 2026-03-14
**Author:** Jonathan
**Primary Test Level:** Unit

---

## Story Summary

Crosstown relay operators running on Marlin Oyster CVM need their nodes to publish kind:10033 TEE attestation events containing PCR values, enclave image hash, and attestation documents. The events are refreshed periodically so peers and clients can cryptographically verify trusted, unmodified code execution inside a TEE enclave.

**As a** Crosstown relay operator running on Marlin Oyster CVM
**I want** my node to publish kind:10033 TEE attestation events containing PCR values, enclave image hash, and attestation documents, and refresh them periodically
**So that** peers and clients can cryptographically verify that my relay is running trusted, unmodified code inside a TEE enclave

---

## Acceptance Criteria

1. **AC #1 -- buildAttestationEvent():** Given valid Nostr secret key and TEE attestation data, when `buildAttestationEvent()` is called, then it produces a signed kind:10033 event with JSON.stringify content (Pattern 14), relay/chain/expiry tags, and valid Schnorr signature.

2. **AC #2 -- parseAttestation():** Given a kind:10033 event, when `parseAttestation()` is called, then it extracts and validates TeeAttestation content and event tags. Forged or malformed attestation content is rejected (return null or throw).

3. **AC #3 -- Attestation server lifecycle:** Given the attestation server starts in TEE mode, when the server initializes, then it publishes a kind:10033 event to the local relay on startup and refreshes on configurable interval (default 300s).

4. **AC #4 -- /health tee field:** Given the enriched /health endpoint, when running inside a TEE enclave, the health response includes a `tee` field. When not in TEE, the `tee` field is entirely absent (enforcement guideline 12).

5. **AC #5 -- TEE_ATTESTATION_KIND constant:** Given the `TeeAttestation` constant and type, when imported from `@crosstown/core`, then `TEE_ATTESTATION_KIND` equals 10033 and the `TeeAttestation` interface defines the canonical field set.

---

## Failing Tests Created (RED Phase)

### Unit Tests (31 tests)

**File:** `packages/core/src/events/attestation.test.ts` (340 lines)

**buildAttestationEvent tests:**

- **Test:** `[P0] TEE_ATTESTATION_KIND equals 10033 (T-4.2-08)`
  - **Status:** RED - `it.skip` (TEE_ATTESTATION_KIND not defined yet)
  - **Verifies:** AC #5 -- constant value

- **Test:** `[P2] kind 10033 is within the NIP-16 replaceable range (T-4.2-15)`
  - **Status:** RED - `it.skip` (TEE_ATTESTATION_KIND not defined yet)
  - **Verifies:** AC #5 -- NIP-16 range compliance

- **Test:** `[P0] creates kind:10033 event with correct content fields (T-4.2-01)`
  - **Status:** RED - `it.skip` (buildAttestationEvent does not exist)
  - **Verifies:** AC #1, #5 -- event structure matches Pattern 14

- **Test:** `[P0] includes required relay, chain, and expiry tags (T-4.2-02)`
  - **Status:** RED - `it.skip` (buildAttestationEvent does not exist)
  - **Verifies:** AC #1 -- required tags present

- **Test:** `[P0] content is valid JSON (enforcement guideline 11 compliance) (T-4.2-03)`
  - **Status:** RED - `it.skip` (buildAttestationEvent does not exist)
  - **Verifies:** AC #1 -- JSON.stringify not plain string

- **Test:** `[P2] does not include a d tag (T-4.2-17)`
  - **Status:** RED - `it.skip` (buildAttestationEvent does not exist)
  - **Verifies:** AC #1 -- NIP-16 replaceable without d tag

- **Test:** `[P2] produces an event that passes verifyEvent() (T-4.2-14)`
  - **Status:** RED - `it.skip` (buildAttestationEvent does not exist)
  - **Verifies:** AC #1 -- Schnorr signature correctness

**parseAttestation tests:**

- **Test:** `[P0] returns valid ParsedAttestation for well-formed event (T-4.2-09)`
  - **Status:** RED - `it.skip` (parseAttestation does not exist)
  - **Verifies:** AC #2 -- happy path parsing

- **Test:** `[P1] returns null for malformed JSON content (T-4.2-10)`
  - **Status:** RED - `it.skip` (parseAttestation does not exist)
  - **Verifies:** AC #2 -- graceful degradation

- **Test:** `[P1] returns null for non-object JSON content (T-4.2-18)`
  - **Status:** RED - `it.skip` (parseAttestation does not exist)
  - **Verifies:** AC #2 -- defensive parsing (array, null, empty)

- **Test:** `[P1] returns null for JSON null content (T-4.2-18)`
  - **Status:** RED - `it.skip` (parseAttestation does not exist)
  - **Verifies:** AC #2 -- null content edge case

- **Test:** `[P1] returns null for empty string content (T-4.2-18)`
  - **Status:** RED - `it.skip` (parseAttestation does not exist)
  - **Verifies:** AC #2 -- empty content edge case

- **Test:** `[P1] returns null when enclave is missing (T-4.2-11)`
  - **Status:** RED - `it.skip`
  - **Verifies:** AC #2 -- required field validation

- **Test:** `[P1] returns null when pcr0 is missing (T-4.2-11)`
  - **Status:** RED - `it.skip`
  - **Verifies:** AC #2 -- required field validation

- **Test:** `[P1] returns null when pcr1 is missing (T-4.2-11)`
  - **Status:** RED - `it.skip`
  - **Verifies:** AC #2 -- required field validation

- **Test:** `[P1] returns null when pcr2 is missing (T-4.2-11)`
  - **Status:** RED - `it.skip`
  - **Verifies:** AC #2 -- required field validation

- **Test:** `[P1] returns null when attestationDoc is missing (T-4.2-11)`
  - **Status:** RED - `it.skip`
  - **Verifies:** AC #2 -- required field validation

- **Test:** `[P1] returns null when version is missing (T-4.2-11)`
  - **Status:** RED - `it.skip`
  - **Verifies:** AC #2 -- required field validation

- **Test:** `[P1] returns null when relay tag is missing (T-4.2-12)`
  - **Status:** RED - `it.skip`
  - **Verifies:** AC #2 -- required tag validation

- **Test:** `[P1] returns null when chain tag is missing (T-4.2-12)`
  - **Status:** RED - `it.skip`
  - **Verifies:** AC #2 -- required tag validation

- **Test:** `[P1] returns null when expiry tag is missing (T-4.2-12)`
  - **Status:** RED - `it.skip`
  - **Verifies:** AC #2 -- required tag validation

- **Test:** `[P1] throws when pcr0 is not 96-char lowercase hex (T-4.2-13)`
  - **Status:** RED - `it.skip`
  - **Verifies:** AC #2 -- PCR format validation with verify=true

- **Test:** `[P1] throws when pcr0 contains uppercase hex (T-4.2-13)`
  - **Status:** RED - `it.skip`
  - **Verifies:** AC #2 -- PCR format validation with verify=true

- **Test:** `[P1] throws when pcr0 contains non-hex characters (T-4.2-13)`
  - **Status:** RED - `it.skip`
  - **Verifies:** AC #2 -- PCR format validation with verify=true

- **Test:** `[P0] rejects forged attestation document with invalid base64 (T-4.2-07)`
  - **Status:** RED - `it.skip`
  - **Verifies:** AC #2 -- adversarial input rejection (Risk R-E4-001)

- **Test:** `[P0] rejects attestation with empty attestationDoc when verify=true (T-4.2-07)`
  - **Status:** RED - `it.skip`
  - **Verifies:** AC #2 -- empty attestation document rejection

- **Test:** `[P2] parses content with extra unknown fields (forward compatible) (T-4.2-16)`
  - **Status:** RED - `it.skip`
  - **Verifies:** AC #2 -- forward compatibility

**Attestation server lifecycle tests:**

- **Test:** `[P1] publishes kind:10033 event on startup (T-4.2-04)`
  - **Status:** RED - `it.skip` (AttestationServer class does not exist)
  - **Verifies:** AC #3 -- initial publish on startup

- **Test:** `[P1] refreshes kind:10033 event on configurable interval (T-4.2-05)`
  - **Status:** RED - `it.skip` (AttestationServer class does not exist)
  - **Verifies:** AC #3 -- periodic refresh

**Health endpoint tests:**

- **Test:** `[P1] includes tee field in health response when TEE_ENABLED=true (T-4.2-06)`
  - **Status:** RED - `it.skip` (health tee field not implemented)
  - **Verifies:** AC #4 -- tee field present with correct structure

- **Test:** `[P1] omits tee field in health response when TEE_ENABLED is not set (T-4.2-06)`
  - **Status:** RED - `it.skip` (health tee field not implemented)
  - **Verifies:** AC #4 -- enforcement guideline 12 (omit, not false)

---

## Data Factories Created

### Test Attestation Factory

**File:** `packages/core/src/events/attestation.test.ts` (inline)

**Exports (test-internal):**

- `createTestAttestation()` - Creates valid TeeAttestation object with deterministic PCR values (96-char hex) and valid base64 attestation doc
- `createTestOptions()` - Creates standard AttestationEventOptions with plain numeric chain ID (31337 for Anvil)
- `createTestEvent(overrides?)` - Creates well-formed kind:10033 NostrEvent for parser tests, independent of buildAttestationEvent

**Example Usage:**

```typescript
const attestation = createTestAttestation();
// { enclave: 'aws-nitro', pcr0: 'aaa...', pcr1: 'bbb...', ... }

const options = createTestOptions();
// { relay: 'wss://relay.example.com', chain: '31337', expiry: <unix+1h> }

const event = createTestEvent({ content: JSON.stringify(attestation) });
// Well-formed NostrEvent with kind 10033
```

---

## Fixtures Created

No separate fixture files are needed for this story. All test fixtures are inline factory functions within the test file. This follows the existing pattern used by `service-discovery.test.ts` and other sibling event tests in this project.

---

## Mock Requirements

### Attestation Server Publish Mock (T-4.2-04, T-4.2-05)

**Interface:** `publish: (event: NostrEvent) => Promise<void>`

**Purpose:** Mock the WebSocket publish to the local relay for attestation server lifecycle tests.

**Success Response:** Promise resolves (void)

**Failure Response:** Promise rejects with Error

**Notes:** The attestation server lifecycle tests (T-4.2-04, T-4.2-05) use a mock publish function that collects events into an array. The actual WebSocket publish to `ws://localhost:${WS_PORT}` is mocked at the unit test level. Integration testing of the real WebSocket publish is deferred to E2E/docker tests.

---

## Required data-testid Attributes

Not applicable. This story has no UI components. All tests are unit-level testing of pure functions (builders/parsers), server lifecycle, and health response enrichment.

---

## Implementation Checklist

### Test: TEE_ATTESTATION_KIND constant (T-4.2-08, T-4.2-15)

**File:** `packages/core/src/events/attestation.test.ts`

**Tasks to make this test pass:**

- [ ] Add `TEE_ATTESTATION_KIND = 10033` to `packages/core/src/constants.ts`
- [ ] Export from `packages/core/src/index.ts`
- [ ] Uncomment `TEE_ATTESTATION_KIND` import in test file
- [ ] Remove `it.skip` from T-4.2-08 and T-4.2-15
- [ ] Run test: `npx vitest run packages/core/src/events/attestation.test.ts`
- [ ] Tests pass (green phase)

**Estimated Effort:** 0.25 hours

---

### Test: buildAttestationEvent() (T-4.2-01, T-4.2-02, T-4.2-03, T-4.2-14, T-4.2-17)

**File:** `packages/core/src/events/attestation.test.ts`

**Tasks to make these tests pass:**

- [ ] Add `TeeAttestation` interface to `packages/core/src/types.ts`
- [ ] Create `packages/core/src/events/attestation.ts` with `buildAttestationEvent()`
- [ ] Implement `AttestationEventOptions` interface
- [ ] Use `finalizeEvent()` from nostr-tools for signing
- [ ] Set content to `JSON.stringify(attestation)` (enforcement guideline 11)
- [ ] Set tags: `['relay', ...]`, `['chain', ...]`, `['expiry', ...]` (no d tag)
- [ ] Export from `packages/core/src/events/index.ts`
- [ ] Uncomment imports in test file
- [ ] Remove `it.skip` from T-4.2-01, T-4.2-02, T-4.2-03, T-4.2-14, T-4.2-17
- [ ] Run test: `npx vitest run packages/core/src/events/attestation.test.ts`
- [ ] All 5 tests pass (green phase)

**Estimated Effort:** 1 hour

---

### Test: parseAttestation() (T-4.2-09 through T-4.2-13, T-4.2-16, T-4.2-18)

**File:** `packages/core/src/events/attestation.test.ts`

**Tasks to make these tests pass:**

- [ ] Implement `parseAttestation()` in `packages/core/src/events/attestation.ts`
- [ ] Define `ParsedAttestation` return type
- [ ] Parse `event.content` as JSON, return null on failure
- [ ] Validate required content fields: enclave, pcr0-2, attestationDoc, version
- [ ] Extract required tags: relay, chain, expiry (return null if missing)
- [ ] When `verify: true`: validate PCR format (96-char lowercase hex), validate base64 attestation doc
- [ ] Export from `packages/core/src/events/index.ts`
- [ ] Uncomment imports in test file
- [ ] Remove `it.skip` from T-4.2-09 through T-4.2-13, T-4.2-16, T-4.2-18
- [ ] Run test: `npx vitest run packages/core/src/events/attestation.test.ts`
- [ ] All 18 parser tests pass (green phase)

**Estimated Effort:** 1.5 hours

---

### Test: Forged attestation rejected (T-4.2-07)

**File:** `packages/core/src/events/attestation.test.ts`

**Tasks to make these tests pass:**

- [ ] Ensure `parseAttestation()` with `verify: true` validates base64 format of attestationDoc
- [ ] Minimum viable check: attestationDoc matches `^[A-Za-z0-9+/]+=*$` (valid base64)
- [ ] Reject empty attestationDoc when verify=true
- [ ] Remove `it.skip` from T-4.2-07 tests
- [ ] Run test: `npx vitest run packages/core/src/events/attestation.test.ts`
- [ ] Both forged attestation tests pass (green phase)

**Estimated Effort:** 0.5 hours

---

### Test: Attestation server lifecycle (T-4.2-04, T-4.2-05)

**File:** `packages/core/src/events/attestation.test.ts`

**Tasks to make these tests pass:**

- [ ] Modify `docker/src/attestation-server.ts` to import `buildAttestationEvent`
- [ ] Implement attestation server class/module with configurable publish function
- [ ] On startup: publish kind:10033 event to local relay via WebSocket
- [ ] Set up refresh interval with `setInterval()` (ATTESTATION_REFRESH_INTERVAL)
- [ ] Export `stopRefresh()` for testing cleanup
- [ ] Uncomment server instantiation code in test file
- [ ] Remove `it.skip` from T-4.2-04 and T-4.2-05
- [ ] Run test: `npx vitest run packages/core/src/events/attestation.test.ts`
- [ ] Both lifecycle tests pass (green phase)

**Estimated Effort:** 2 hours

---

### Test: Health tee field (T-4.2-06)

**File:** `packages/core/src/events/attestation.test.ts`

**Tasks to make these tests pass:**

- [ ] Add optional `tee` field to `HealthConfig` interface in `packages/town/src/health.ts`
- [ ] Add optional `tee` field to `HealthResponse` interface
- [ ] In `createHealthResponse()`, include tee field when provided, omit when not
- [ ] Wire TEE info into health config in `docker/src/entrypoint-town.ts`
- [ ] Replace placeholder assertions with real `createHealthResponse()` calls
- [ ] Remove `it.skip` from T-4.2-06 tests
- [ ] Run test: `npx vitest run packages/core/src/events/attestation.test.ts`
- [ ] Both health tests pass (green phase)

**Estimated Effort:** 1 hour

---

## Running Tests

```bash
# Run all failing tests for this story
npx vitest run packages/core/src/events/attestation.test.ts

# Run with verbose output
npx vitest run packages/core/src/events/attestation.test.ts --reporter=verbose

# Run specific test by name pattern
npx vitest run packages/core/src/events/attestation.test.ts -t "T-4.2-01"

# Run tests in watch mode
npx vitest packages/core/src/events/attestation.test.ts

# Run all core package tests
cd packages/core && pnpm test
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**

- All 31 tests written and skipped (`it.skip`)
- Factory functions created with deterministic test data
- Mock requirements documented (publish function for lifecycle tests)
- Implementation checklist created with concrete tasks
- Known discrepancies from original stubs resolved:
  - TeeAttestation type annotation removed from factory (avoids compile error before implementation)
  - Chain ID format corrected to plain numeric (31337) per Pattern 14
  - attestationDoc uses valid base64 in factory (not plain ASCII placeholder)
  - T-4.2-07 forged attestation clarified: base64 validation as minimum viable check

**Verification:**

- All 31 tests run and are skipped as expected
- Test file compiles cleanly (no TypeScript errors)
- Failure mode: module-not-found (implementation does not exist yet)

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. **Pick one test group** from implementation checklist (start with TEE_ATTESTATION_KIND)
2. **Read the tests** to understand expected behavior
3. **Implement minimal code** to make those tests pass
4. **Run the tests** to verify they now pass (green)
5. **Check off the tasks** in implementation checklist
6. **Move to next test group** and repeat

**Recommended implementation order:**

1. TEE_ATTESTATION_KIND constant + TeeAttestation type (T-4.2-08, T-4.2-15) -- foundational
2. buildAttestationEvent() (T-4.2-01, T-4.2-02, T-4.2-03, T-4.2-14, T-4.2-17) -- builder
3. parseAttestation() (T-4.2-09 through T-4.2-13, T-4.2-16, T-4.2-18) -- parser
4. Forged attestation gate (T-4.2-07) -- security verification
5. Health tee field (T-4.2-06) -- health response enrichment
6. Attestation server lifecycle (T-4.2-04, T-4.2-05) -- server integration

**Key Principles:**

- One test group at a time (don't try to fix all at once)
- Minimal implementation (don't over-engineer)
- Run tests frequently (immediate feedback)
- Use implementation checklist as roadmap

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

**DEV Agent Responsibilities:**

1. **Verify all 31 tests pass** (green phase complete)
2. **Review code for quality** (readability, maintainability)
3. **Extract duplications** (DRY principle)
4. **Ensure tests still pass** after each refactor
5. **Update exports** in events/index.ts and core/src/index.ts

**Key Principles:**

- Tests provide safety net (refactor with confidence)
- Make small refactors (easier to debug if tests fail)
- Run tests after each change
- Don't change test behavior (only implementation)

---

## Next Steps

1. **Review this checklist** with team
2. **Run failing tests** to confirm RED phase: `npx vitest run packages/core/src/events/attestation.test.ts`
3. **Begin implementation** using implementation checklist as guide (start with TEE_ATTESTATION_KIND)
4. **Work one test group at a time** (red -> green for each)
5. **When all tests pass**, refactor code for quality
6. **When refactoring complete**, update story status

---

## Knowledge Base References Applied

This ATDD workflow consulted the following knowledge fragments:

- **data-factories.md** -- Factory patterns with overrides for random test data generation (applied to createTestAttestation, createTestOptions, createTestEvent)
- **test-quality.md** -- Test design principles (Given-When-Then, determinism, isolation, explicit assertions)
- **test-levels-framework.md** -- Test level selection framework (pure function unit tests for builders/parsers, no E2E for backend-only story)

See `tea-index.csv` for complete knowledge fragment mapping.

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `npx vitest run packages/core/src/events/attestation.test.ts`

**Results:**

```
 Test Files  1 skipped (1)
      Tests  31 skipped (31)
   Start at  19:59:25
   Duration  268ms
```

**Summary:**

- Total tests: 31
- Passing: 0 (expected)
- Failing: 0 (all skipped)
- Skipped: 31 (expected -- TDD red phase)
- Status: RED phase verified

---

## Test Traceability Matrix

| Test ID | Test Name | AC | Priority | Level | Phase |
|---------|-----------|-----|----------|-------|-------|
| T-4.2-01 | kind:10033 event correct JSON structure | #1, #5 | P0 | Unit | RED |
| T-4.2-02 | Required tags: relay, chain, expiry | #1 | P0 | Unit | RED |
| T-4.2-03 | Content is valid JSON (not plain string) | #1 | P0 | Unit | RED |
| T-4.2-04 | Publishes kind:10033 on startup | #3 | P1 | Unit | RED |
| T-4.2-05 | Refreshes kind:10033 on interval | #3 | P1 | Unit | RED |
| T-4.2-06 | /health tee field conditional on TEE (2) | #4 | P1 | Unit | RED |
| T-4.2-07 | Forged attestation document rejected (2) | #2 | P0 | Unit | RED |
| T-4.2-08 | TEE_ATTESTATION_KIND equals 10033 | #5 | P0 | Unit | RED |
| T-4.2-09 | parseAttestation valid event | #2 | P0 | Unit | RED |
| T-4.2-10 | parseAttestation malformed JSON | #2 | P1 | Unit | RED |
| T-4.2-11 | parseAttestation missing content fields (6) | #2 | P1 | Unit | RED |
| T-4.2-12 | parseAttestation missing tags (3) | #2 | P1 | Unit | RED |
| T-4.2-13 | parseAttestation invalid PCR format (3) | #2 | P1 | Unit | RED |
| T-4.2-14 | Schnorr signature verification | #1 | P2 | Unit | RED |
| T-4.2-15 | NIP-16 replaceable range | #5 | P2 | Unit | RED |
| T-4.2-16 | Forward compatibility | #2 | P2 | Unit | RED |
| T-4.2-17 | No d tag (NIP-16 not NIP-33) | #1 | P2 | Unit | RED |
| T-4.2-18 | Non-object JSON content (3) | #2 | P1 | Unit | RED |

---

## Notes

- **Existing test stubs were replaced:** The original 7-test RED stub file (from the TEA agent's initial ATDD pass in the epic-level checklist) had known discrepancies (TeeAttestation type import error, chain ID format inconsistency, plain ASCII attestation doc). The enhanced file resolves all discrepancies and adds 24 gap-filling tests for comprehensive AC coverage.

- **No separate factory/fixture files:** Following the project convention (same pattern as service-discovery.test.ts), all factory functions are inline in the test file. This keeps the test file self-contained.

- **Attestation server lifecycle tests (T-4.2-04, T-4.2-05) are partially stubbed:** The server class code is commented out because the implementation architecture is still TBD (class vs function, test harness design). The mock publish pattern is established for when the implementation is created.

- **Health endpoint tests (T-4.2-06) use placeholder assertions:** These will be replaced with real `createHealthResponse()` calls once the `tee` field is added to `HealthConfig` and `HealthResponse` in `packages/town/src/health.ts`.

---

**Generated by BMad TEA Agent** - 2026-03-14
