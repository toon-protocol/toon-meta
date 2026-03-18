---
stepsCompleted:
  - 'step-01-preflight-and-context'
  - 'step-02-generation-mode'
  - 'step-03-test-strategy'
  - 'step-04-generate-tests'
  - 'step-05-validate-and-complete'
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-03-15'
workflowType: 'testarch-atdd'
inputDocuments:
  - '_bmad-output/implementation-artifacts/4-6-attestation-first-seed-relay-bootstrap.md'
  - 'packages/core/src/bootstrap/attestation-bootstrap.test.ts'
  - 'packages/core/src/bootstrap/AttestationVerifier.ts'
  - 'packages/core/src/bootstrap/BootstrapService.ts'
  - 'packages/core/src/bootstrap/index.ts'
  - 'packages/core/src/index.ts'
---

# ATDD Checklist - Epic 4, Story 4.6: Attestation-First Seed Relay Bootstrap

**Date:** 2026-03-15
**Author:** Jonathan
**Primary Test Level:** Unit (with integration verification via lifecycle events)

---

## Story Summary

Implements attestation-first seed relay bootstrap flow (FR-TEE-6). When bootstrapping into the ILP network, the seed relay discovery flow verifies each seed relay's kind:10033 TEE attestation BEFORE trusting its kind:10032 peer list. This mitigates seed relay list poisoning (R-E4-004) by using attestation as the bootstrap trust anchor.

**As a** TOON node operator bootstrapping into the ILP network
**I want** seed relay discovery to verify TEE attestation before trusting peer lists
**So that** seed relay list poisoning is mitigated and only peers from verified TEE-attested seed relays are added to my routing table

---

## Acceptance Criteria

1. For each seed relay, the system queries kind:10033 attestation and verifies it BEFORE subscribing to kind:10032 peer events (validated via `mock.invocationCallOrder`)
2. If a seed relay has no valid attestation (null, fails, or throws), the system falls back to the next seed relay without crashing
3. When attestation passes, the system proceeds to subscribe to kind:10032 peer events; result includes `discoveredPeers`, `attestedSeedRelay`, and `mode: 'attested'`
4. When ALL relays lack valid attestation, the node starts in degraded mode (`mode: 'degraded'`), logs a warning containing "No attested seed relays found", does NOT crash
5. Full bootstrap lifecycle events are emitted in order: `attestation:seed-connected` -> `attestation:verified` -> `attestation:peers-discovered`
6. `AttestationBootstrap`, `AttestationBootstrapConfig`, `AttestationBootstrapResult`, `AttestationBootstrapEvent` are exported from `@toon-protocol/core`

---

## Failing Tests Created (RED Phase) -> GREEN Phase

### Unit Tests (6 tests)

**File:** `packages/core/src/bootstrap/attestation-bootstrap.test.ts` (375 lines)

- **Test:** verifies kind:10033 attestation before trusting seed relay peer list (T-4.6-01)
  - **Status:** GREEN - passing
  - **Verifies:** AC #1 -- attestation query invocation order precedes peer subscription invocation order

- **Test:** falls back to next seed relay when first has invalid attestation (T-4.6-02)
  - **Status:** GREEN - passing
  - **Verifies:** AC #2 -- null attestation on first relay, valid on second, only second relay gets peer subscription

- **Test:** proceeds to kind:10032 peer discovery when attestation is valid (T-4.6-03)
  - **Status:** GREEN - passing
  - **Verifies:** AC #3 -- happy path with discovered peers, attested seed relay URL, and mode: 'attested'

- **Test:** starts in degraded mode when all seed relays are unattested (T-4.6-04)
  - **Status:** GREEN - passing
  - **Verifies:** AC #4 -- degraded mode result, console.warn with "No attested seed relays found", subscribePeers never called

- **Test:** completes full attestation-first bootstrap flow (T-4.6-05)
  - **Status:** GREEN - passing
  - **Verifies:** AC #5 -- full lifecycle events in order, result shape with mode/attestedSeedRelay/discoveredPeers

- **Test:** exports AttestationBootstrap and types from barrel (T-4.6-06)
  - **Status:** GREEN - passing
  - **Verifies:** AC #6 -- barrel exports from bootstrap/index.ts

### Skipped Tests (5 tests -- not part of Story 4.6)

- T-4.1-01 through T-4.1-04: Oyster CVM Packaging (Story 4.1 -- GREEN in `oyster-config.test.ts`)
- T-RISK-02: Payment channels remain open when attestation degrades (deferred to integration)

---

## Data Factories Created

### Seed Relay List Factory

**File:** `packages/core/src/bootstrap/attestation-bootstrap.test.ts` (in-file)

**Exports:**
- `createSeedRelayList()` - Creates 3 seed relay WebSocket URLs for testing
- `createValidAttestationEvent()` - Creates a structurally valid kind:10033 attestation event
- `_createExpiredAttestationEvent()` - Creates an expired kind:10033 attestation event
- `createPeerInfoEvent(relayPubkey)` - Creates a kind:10032 ILP peer info event
- `createMockVerifier(state)` - Creates a mock verifier with the specified state ('valid'|'invalid'|'missing'|'expired')

**Example Usage:**

```typescript
const seedRelays = createSeedRelayList();
const attestation = createValidAttestationEvent();
const mockVerifier = createMockVerifier('valid');
const mockQueryAttestation = vi.fn().mockResolvedValue(attestation);
```

---

## Fixtures Created

No separate fixture files were created. Test factories are co-located in the test file, following the established pattern from Stories 4.2-4.5. The mock verifier (`createMockVerifier`) and DI callback mocks (`vi.fn().mockResolvedValue`) serve as the fixture pattern for this unit-test-only story.

---

## Mock Requirements

### AttestationVerifier Mock

**Interface:**
```typescript
{
  verify: vi.fn().mockResolvedValue(boolean);  // Promise<boolean>
  getState: vi.fn().mockReturnValue(state);     // sync state string
}
```

**Notes:** The mock returns `Promise<boolean>` while the real `AttestationVerifier.verify()` returns sync `VerificationResult { valid: boolean }`. The `AttestationBootstrap` normalizes both via `await Promise.resolve(verifier.verify(event))` and then checks if the result is a boolean or has a `.valid` property.

### DI Callback Mocks

- `queryAttestation: (relayUrl: string) => Promise<NostrEvent | null>` - Mocked with `vi.fn().mockResolvedValue(event)` or `mockResolvedValueOnce(null)` for fallback scenarios
- `subscribePeers: (relayUrl: string) => Promise<NostrEvent[]>` - Mocked with `vi.fn().mockResolvedValue([peerInfoEvent])`

---

## Required data-testid Attributes

N/A -- this is a backend-only story with no UI components.

---

## Implementation Checklist

### Test: T-4.6-01 through T-4.6-06

**File:** `packages/core/src/bootstrap/attestation-bootstrap.test.ts`

**Tasks to make tests pass:**

- [x] Create `AttestationBootstrap` class in `packages/core/src/bootstrap/AttestationBootstrap.ts`
- [x] Define `AttestationBootstrapConfig` interface with seedRelays, secretKey, verifier, queryAttestation, subscribePeers
- [x] Define `AttestationBootstrapResult` interface with mode, attestedSeedRelay, discoveredPeers
- [x] Define `AttestationBootstrapEvent` type union for lifecycle events
- [x] Implement `on(listener)` / `off(listener)` for event registration
- [x] Implement `bootstrap()` method with sequential relay iteration
- [x] Handle null attestation events (skip to next relay)
- [x] Normalize verifier results (boolean | VerificationResult | Promise)
- [x] Handle callback errors (try/catch, treat as failed attestation)
- [x] Emit lifecycle events in correct order
- [x] Return degraded mode when all relays fail, with console.warn
- [x] Add barrel exports to `packages/core/src/bootstrap/index.ts`
- [x] Add re-exports to `packages/core/src/index.ts`
- [x] Add `expect(result.mode).toBe('attested')` to T-4.6-03 (gap from AC #3)
- [x] Add T-4.6-06 barrel export verification test
- [x] Run tests: `cd packages/core && pnpm test -- src/bootstrap/attestation-bootstrap.test.ts`
- [x] All tests pass (GREEN phase)

**Estimated Effort:** 1 hour

---

## Running Tests

```bash
# Run all tests for this story
cd packages/core && pnpm test -- src/bootstrap/attestation-bootstrap.test.ts

# Run full test suite (regression check)
pnpm test

# Run with verbose output
cd packages/core && npx vitest run --reporter=verbose src/bootstrap/attestation-bootstrap.test.ts

# Build and verify
pnpm build && pnpm test && pnpm lint
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**

- Pre-existing RED stubs (T-4.6-01 through T-4.6-05) were in `attestation-bootstrap.test.ts`
- All stubs used `it.skip()` because `AttestationBootstrap` class did not exist

### GREEN Phase (Complete)

**Changes made:**

1. Created `AttestationBootstrap` class with DI-based orchestration pattern
2. Converted `it.skip()` to `it()` for T-4.6-01 through T-4.6-05
3. Added `import { AttestationBootstrap } from './AttestationBootstrap.js'`
4. Added `expect(result.mode).toBe('attested')` to T-4.6-03 (gap fix)
5. Added T-4.6-06 barrel export verification test
6. All 6 tests passing, 0 regressions (1808 total tests pass)

### REFACTOR Phase (Not Required)

The implementation is minimal and clean (204 lines). No refactoring needed:
- Single class, no duplication
- DI pattern keeps orchestration separate from transport
- Event emitter follows established `BootstrapService` pattern

---

## Test Execution Evidence

### Test Run (GREEN Phase Verification)

**Command:** `cd packages/core && pnpm test -- src/bootstrap/attestation-bootstrap.test.ts`

**Results:**

```
 RUN  v1.6.1 /Users/jonathangreen/Documents/toon/packages/core

 ✓ src/bootstrap/attestation-bootstrap.test.ts  (11 tests | 5 skipped) 149ms

 Test Files  1 passed (1)
      Tests  6 passed | 5 skipped (11)
   Start at  20:30:33
   Duration  419ms
```

**Full Suite Regression Check:**

```
 Test Files  82 passed | 7 skipped (89)
      Tests  1808 passed | 79 skipped (1887)
   Duration  8.90s
```

**Lint Check:**

```
✖ 477 problems (0 errors, 477 warnings)
```

0 errors. All 477 warnings are pre-existing.

---

## Notes

- **DI Pattern:** `AttestationBootstrap` does not own transport logic. `queryAttestation` and `subscribePeers` are injected callbacks, making the class fully testable without WebSocket mocks.
- **Verifier normalization:** The implementation handles both `boolean` (from mock) and `VerificationResult` (from real `AttestationVerifier`) via `await Promise.resolve()` and type narrowing.
- **Callback error handling:** `queryAttestation` and `subscribePeers` throwing errors is treated equivalently to a null/failed attestation -- caught and triggers fallback to next relay.
- **secretKey field:** Stored but unused. Reserved for future use (e.g., signing subscription requests).
- **Story 4.1 tests remain `it.skip`:** They are already GREEN in `oyster-config.test.ts`. T-RISK-02 deferred to integration.

---

## Knowledge Base References Applied

This ATDD workflow consulted the following knowledge fragments:

- **test-quality.md** - Test design principles (Given-When-Then, one assertion per test, determinism, isolation)
- **test-levels-framework.md** - Test level selection framework (Unit selected as primary level)
- **data-factories.md** - Factory patterns for mock verifiers and attestation events
- **test-healing-patterns.md** - Common failure patterns (mock normalization for async/sync verifier)

---

**Generated by BMad TEA Agent** - 2026-03-15
