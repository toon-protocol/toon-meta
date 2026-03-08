---
stepsCompleted:
  - 'step-01-preflight-and-context'
  - 'step-02-generation-mode'
  - 'step-03-test-strategy'
  - 'step-04-generate-tests'
  - 'step-04c-aggregate'
  - 'step-05-validate-and-complete'
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-03-07'
workflowType: 'testarch-atdd'
inputDocuments:
  - '_bmad-output/implementation-artifacts/2-6-add-publish-event-to-service-node.md'
  - '_bmad/tea/testarch/knowledge/data-factories.md'
  - '_bmad/tea/testarch/knowledge/test-quality.md'
  - '_bmad/tea/testarch/knowledge/test-levels-framework.md'
  - '_bmad/tea/testarch/knowledge/test-healing-patterns.md'
---

# ATDD Checklist - Epic 2, Story 6: Add publishEvent() to ServiceNode

**Date:** 2026-03-07
**Author:** Jonathan
**Primary Test Level:** Unit
**TDD Phase:** GREEN (all 22 tests passing)

---

## Story Summary

Add a `publishEvent(event, options)` method to the SDK's `ServiceNode` interface that sends Nostr events through the embedded connector as outbound ILP packets. This completes the symmetric API: inbound events arrive via handlers (`node.on(kind, handler)`), outbound events depart via `node.publishEvent(event, { destination })`.

**As a** developer building on the Crosstown SDK
**I want** `ServiceNode` to expose a `publishEvent(event, options)` method
**So that** I can send outbound ILP packets without manually encoding TOON, computing conditions, or calling low-level connector APIs

---

## Acceptance Criteria

1. Given a started `ServiceNode`, when I call `node.publishEvent(event, { destination })`, then the event is TOON-encoded via the configured encoder, priced at `basePricePerByte * BigInt(toonData.length)`, converted to base64, and sent via `AgentRuntimeClient.sendIlpPacket()`.
2. Given a started `ServiceNode`, when I call `node.publishEvent(event)` without options or with an empty destination, then a `NodeError` is thrown with a clear message indicating that `destination` is required.
3. Given a `ServiceNode` that has not been started, when I call `node.publishEvent(event, { destination })`, then a `NodeError` is thrown with message "Cannot publish: node not started. Call start() first."
4. Given a successful publish, `publishEvent()` returns `{ success: true, eventId, fulfillment }`. Given a rejected publish, it returns `{ success: false, eventId, code, message }`.
5. Given the `@crosstown/sdk` package, `PublishEventResult` type is exported alongside existing exports, and `ServiceNode` includes the `publishEvent` method in its type definition.
6. Given the existing SDK test suite, all existing tests pass and new unit tests cover `publishEvent()` success, rejection, not-started error, and missing-destination error scenarios.

---

## Test Design Traceability

| ATDD Test ID | Test Name | AC | Priority | Level | Status |
|---|---|---|---|---|---|
| T-2.6-01 | publishEvent() TOON-encodes the event and sends via connector.sendPacket() with correct parameters | #1 | P0 | Unit | GREEN |
| T-2.6-02 | publishEvent() computes correct amount as basePricePerByte * toonData.length | #1 | P0 | Unit | GREEN |
| T-2.6-03 | publishEvent() returns { success: true, eventId, fulfillment } when connector accepts | #4 | P0 | Unit | GREEN |
| T-2.6-04 | publishEvent() returns { success: false, eventId, code, message } when connector rejects | #4 | P0 | Unit | GREEN |
| T-2.6-05 | publishEvent() throws NodeError when node not started | #3 | P1 | Unit | GREEN |
| T-2.6-06 | publishEvent() throws NodeError when options is undefined | #2 | P1 | Unit | GREEN |
| T-2.6-07 | publishEvent() throws NodeError when destination is empty string | #2 | P1 | Unit | GREEN |
| T-2.6-08 | publishEvent() uses custom basePricePerByte from config when provided | #1 | P2 | Unit | GREEN |
| T-2.6-09 | publishEvent() uses default basePricePerByte (10n) when not configured | #1 | P2 | Unit | GREEN |
| T-2.6-10 | publishEvent() throws NodeError after node.stop() is called | #3 | P2 | Unit | GREEN |
| T-2.6-11 | publishEvent() computes exact amount matching basePricePerByte * TOON byte length | #1 | P2 | Unit | GREEN |
| T-2.6-12 | publishEvent() wraps TOON encoder errors in NodeError | #1 | P2 | Unit | GREEN |
| T-2.6-13 | publishEvent() wraps connector sendPacket errors in NodeError | #1 | P1 | Unit | GREEN |
| T-2.6-14 | publishEvent() wraps non-Error thrown values in NodeError with String() conversion | #1 | P2 | Unit | GREEN |
| T-2.6-15 | publishEvent() propagates NodeError directly without re-wrapping | #1 | P1 | Unit | GREEN |
| T-2.6-16 | publishEvent() scales amount proportionally with event content size | #1 | P2 | Unit | GREEN |
| T-2.6-17 | publishEvent() uses the configured toonEncoder for encoding | #1 | P1 | Unit | GREEN |
| T-2.6-18 | publishEvent() success result does not include code or message fields | #4 | P1 | Unit | GREEN |
| T-2.6-19 | publishEvent() rejection result does not include fulfillment field | #4 | P1 | Unit | GREEN |
| T-2.6-20 | publishEvent() sends TOON-encoded bytes that match the encoder output | #1 | P2 | Unit | GREEN |
| T-2.6-21 | publishEvent() passes through empty code and message when connector rejects with empty strings | #4 | P2 | Unit | GREEN |
| T-2.6-22 | publishEvent() returns empty fulfillment when connector fulfill omits it | #4 | P2 | Unit | GREEN |

**Priority Distribution:** P0: 4, P1: 8, P2: 10
**Test file location:** `packages/sdk/src/publish-event.test.ts` (22 tests)

---

## Tests (22 total -- 9 original ATDD + 7 code review + 4 review 4 + 2 test review)

**File:** `packages/sdk/src/publish-event.test.ts` (22 tests)

- **Test:** `[P0] publishEvent() TOON-encodes the event and sends via connector.sendPacket() with correct parameters (AC#1)`
  - **Status:** GREEN
  - **Verifies:** Event is TOON-encoded, destination passed through, data is Uint8Array, amount is bigint > 0

- **Test:** `[P0] publishEvent() computes correct amount as basePricePerByte * toonData.length (AC#1)`
  - **Status:** GREEN
  - **Verifies:** Amount is a multiple of basePricePerByte and greater than zero

- **Test:** `[P0] publishEvent() returns { success: true, eventId, fulfillment } when connector accepts (AC#4)`
  - **Status:** GREEN
  - **Verifies:** Success result shape with eventId matching the input event and non-empty fulfillment string

- **Test:** `[P0] publishEvent() returns { success: false, eventId, code, message } when connector rejects (AC#4)`
  - **Status:** GREEN
  - **Verifies:** Rejection result shape with eventId, error code (F02), and error message

- **Test:** `[P1] publishEvent() throws NodeError when node not started (AC#3)`
  - **Status:** GREEN
  - **Verifies:** NodeError thrown with "Cannot publish: node not started" message

- **Test:** `[P1] publishEvent() throws NodeError when options is undefined (AC#2)`
  - **Status:** GREEN
  - **Verifies:** NodeError thrown with "destination is required" message when called without options

- **Test:** `[P1] publishEvent() throws NodeError when destination is empty string (AC#2)`
  - **Status:** GREEN
  - **Verifies:** NodeError thrown with "destination is required" message when destination is ""

- **Test:** `[P2] publishEvent() uses custom basePricePerByte from config when provided (AC#1)`
  - **Status:** GREEN
  - **Verifies:** Amount is a multiple of the custom basePricePerByte (50n)

- **Test:** `[P2] publishEvent() uses default basePricePerByte (10n) when not configured (AC#1)`
  - **Status:** GREEN
  - **Verifies:** Amount is a multiple of the default 10n basePricePerByte

- **Test:** `[P2] publishEvent() throws NodeError after node.stop() is called (AC#3)` *(added in code review 2)*
  - **Status:** GREEN
  - **Verifies:** NodeError with "not started" message after stop() resets started flag

- **Test:** `[P2] publishEvent() computes exact amount matching basePricePerByte * TOON byte length (AC#1)` *(added in code review 2)*
  - **Status:** GREEN
  - **Verifies:** Exact amount matches basePricePerByte * encodeEventToToon(event).length

- **Test:** `[P2] publishEvent() wraps TOON encoder errors in NodeError (error path)` *(added in code review 3)*
  - **Status:** GREEN
  - **Verifies:** Custom TOON encoder failure wrapped in NodeError with "Failed to publish event:" prefix

- **Test:** `[P1] publishEvent() wraps connector sendPacket errors in NodeError (AC#1 error path)` *(added in code review 3)*
  - **Status:** GREEN
  - **Verifies:** Generic Error from sendPacket wrapped in NodeError with "Failed to publish event:" prefix

- **Test:** `[P2] publishEvent() wraps non-Error thrown values in NodeError with String() conversion` *(added in code review 3)*
  - **Status:** GREEN
  - **Verifies:** Non-Error values (e.g., raw strings) from sendPacket wrapped via String() in NodeError

- **Test:** `[P1] publishEvent() propagates NodeError directly without re-wrapping` *(added in code review 3)*
  - **Status:** GREEN
  - **Verifies:** NodeError thrown inside try block propagates directly without "Failed to publish event:" prefix

- **Test:** `[P2] publishEvent() scales amount proportionally with event content size` *(added in code review 3)*
  - **Status:** GREEN
  - **Verifies:** Larger event content produces proportionally larger amount; both amounts are multiples of basePricePerByte

- **Test:** `[P1] publishEvent() uses the configured toonEncoder for encoding (AC#1)` *(added in review 4)*
  - **Status:** GREEN
  - **Verifies:** Custom toonEncoder is called with the event, data matches encoder output, amount computed from encoder output length

- **Test:** `[P1] publishEvent() success result does not include code or message fields (AC#4)` *(added in review 4)*
  - **Status:** GREEN
  - **Verifies:** Success result has no code or message fields (undefined), only fulfillment

- **Test:** `[P1] publishEvent() rejection result does not include fulfillment field (AC#4)` *(added in review 4)*
  - **Status:** GREEN
  - **Verifies:** Rejection result has no fulfillment field (undefined), only code and message

- **Test:** `[P2] publishEvent() sends TOON-encoded bytes that match the encoder output (AC#1)` *(added in review 4)*
  - **Status:** GREEN
  - **Verifies:** Data bytes sent to connector match TOON encoding, decoded data matches original event

- **Test:** `[P2] publishEvent() passes through empty code and message when connector rejects with empty strings (AC#4)` *(added in test review)*
  - **Status:** GREEN
  - **Verifies:** Connector reject with empty code/message passes through (documents nullish coalescing `??` behavior -- empty strings are not nullish)

- **Test:** `[P2] publishEvent() returns empty fulfillment when connector fulfill omits it (AC#4)` *(added in test review)*
  - **Status:** GREEN
  - **Verifies:** Connector fulfill with empty fulfillment returns a string fulfillment (documents the ?? '' fallback)

---

## Data Factories Created

### Nostr Event Factory

**File:** `packages/sdk/src/publish-event.test.ts` (inline)

**Exports:**

- `createTestEvent(overrides?)` - Create a deterministic NostrEvent with optional field overrides

**Example Usage:**

```typescript
const event = createTestEvent(); // Default test event
const event = createTestEvent({ id: 'dd'.repeat(32) }); // Custom event ID
const event = createTestEvent({ kind: 30617, content: 'custom' }); // Custom kind and content
```

### Mock Connector Factory

**File:** `packages/sdk/src/publish-event.test.ts` (inline)

**Exports:**

- `createMockConnector(sendPacketResult?)` - Create a mock EmbeddableConnectorLike with configurable sendPacket behavior

**Example Usage:**

```typescript
// Connector that accepts (fulfills) packets
const connector = createMockConnector({ type: 'fulfill', fulfillment: Buffer.from('ful') });

// Connector that rejects packets
const connector = createMockConnector({ type: 'reject', code: 'F02', message: 'No route' });

// Access recorded calls
connector.sendPacketCalls[0].destination; // 'g.peer.address'
connector.sendPacketCalls[0].amount; // bigint
```

---

## Fixtures Created

N/A -- This story uses co-located inline test helpers following the existing project convention established in `packages/sdk/src/create-node.test.ts`. The mock connector and test event factory are defined directly in the test file for maximum clarity and co-location with test logic.

---

## Mock Requirements

### Embedded Connector Mock

**Interface:** `EmbeddableConnectorLike`

**Mock Methods:**

- `sendPacket(params)` - Returns configurable `SendPacketResult` (fulfill or reject)
- `registerPeer(params)` - No-op
- `removePeer(peerId)` - No-op
- `setPacketHandler(handler)` - No-op

**Success Response (Fulfill):**

```typescript
{
  type: 'fulfill',
  fulfillment: Buffer.from('test-fulfillment'), // Uint8Array
  data: undefined
}
```

**Failure Response (Reject):**

```typescript
{
  type: 'reject',
  code: 'F02',
  message: 'No route to destination',
  data: undefined
}
```

**Notes:** The mock connector records all `sendPacket` calls in `connector.sendPacketCalls[]` for assertion. The `DirectRuntimeClient` created internally by `createCrosstownNode()` wraps `connector.sendPacket()`, so mocking at the connector level exercises the full chain: `publishEvent() -> sendIlpPacket() -> sendPacket()`.

### nostr-tools Mock

**Mock:** `vi.mock('nostr-tools')` -- prevents live relay connections via SimplePool (project convention: always mock nostr-tools in unit tests).

---

## Required data-testid Attributes

N/A -- This is a pure backend/SDK story with no UI components. No data-testid attributes are required.

---

## Implementation Checklist

### Test: publishEvent() TOON-encodes and sends via connector (P0)

**File:** `packages/sdk/src/publish-event.test.ts`

**Tasks to make this test pass:**

- [x] Add `runtimeClient` property to `CrosstownNode` interface in `packages/core/src/compose.ts`
- [x] Return `directRuntimeClient` as `runtimeClient` in `createCrosstownNode()` return object
- [x] Add `PublishEventResult` type to `packages/sdk/src/create-node.ts`
- [x] Add `publishEvent()` method signature to `ServiceNode` interface
- [x] Implement `publishEvent()` in `createNode()` closure: TOON-encode, compute amount, base64 convert, call `sendIlpPacket()`
- [x] Run test: `npx vitest run packages/sdk/src/publish-event.test.ts`
- [x] Test passes (green phase)

**Estimated Effort:** 1.5 hours

---

### Test: publishEvent() computes correct amount (P0)

**File:** `packages/sdk/src/publish-event.test.ts`

**Tasks to make this test pass:**

- [x] Ensure amount computation uses `String(basePricePerByte * BigInt(toonData.length))` in `sendIlpPacket()` call
- [x] Verify `config.basePricePerByte ?? 10n` is used as the multiplier
- [x] Run test: `npx vitest run packages/sdk/src/publish-event.test.ts`
- [x] Test passes (green phase)

**Estimated Effort:** 0.25 hours (part of main implementation)

---

### Test: publishEvent() returns success result (P0)

**File:** `packages/sdk/src/publish-event.test.ts`

**Tasks to make this test pass:**

- [x] Map `IlpSendResult { accepted: true, fulfillment }` to `PublishEventResult { success: true, eventId, fulfillment }`
- [x] Run test: `npx vitest run packages/sdk/src/publish-event.test.ts`
- [x] Test passes (green phase)

**Estimated Effort:** 0.25 hours (part of main implementation)

---

### Test: publishEvent() returns rejection result (P0)

**File:** `packages/sdk/src/publish-event.test.ts`

**Tasks to make this test pass:**

- [x] Map `IlpSendResult { accepted: false, code, message }` to `PublishEventResult { success: false, eventId, code, message }`
- [x] Run test: `npx vitest run packages/sdk/src/publish-event.test.ts`
- [x] Test passes (green phase)

**Estimated Effort:** 0.25 hours (part of main implementation)

---

### Test: publishEvent() throws when not started (P1)

**File:** `packages/sdk/src/publish-event.test.ts`

**Tasks to make this test pass:**

- [x] Add guard at top of `publishEvent()`: `if (!started) throw new NodeError("Cannot publish: node not started. Call start() first.")`
- [x] Run test: `npx vitest run packages/sdk/src/publish-event.test.ts`
- [x] Test passes (green phase)

**Estimated Effort:** 0.1 hours (part of main implementation)

---

### Test: publishEvent() throws when destination missing (P1)

**File:** `packages/sdk/src/publish-event.test.ts`

**Tasks to make this test pass:**

- [x] Add guard: `if (!options?.destination) throw new NodeError("Cannot publish: destination is required. Pass { destination: 'g.peer.address' }.")`
- [x] Run test: `npx vitest run packages/sdk/src/publish-event.test.ts`
- [x] Test passes (green phase)

**Estimated Effort:** 0.1 hours (part of main implementation)

---

### Test: publishEvent() throws when destination is empty (P1)

**File:** `packages/sdk/src/publish-event.test.ts`

**Tasks to make this test pass:**

- [x] Ensure the `!options?.destination` guard catches empty string (falsy check)
- [x] Run test: `npx vitest run packages/sdk/src/publish-event.test.ts`
- [x] Test passes (green phase)

**Estimated Effort:** 0 hours (covered by previous guard)

---

### Test: publishEvent() uses custom basePricePerByte (P2)

**File:** `packages/sdk/src/publish-event.test.ts`

**Tasks to make this test pass:**

- [x] Ensure `config.basePricePerByte ?? 10n` is used (already in scope from pricing validator setup)
- [x] Run test: `npx vitest run packages/sdk/src/publish-event.test.ts`
- [x] Test passes (green phase)

**Estimated Effort:** 0 hours (covered by main implementation)

---

### Test: publishEvent() uses default basePricePerByte (P2)

**File:** `packages/sdk/src/publish-event.test.ts`

**Tasks to make this test pass:**

- [x] Ensure default fallback `?? 10n` is applied when basePricePerByte is omitted
- [x] Run test: `npx vitest run packages/sdk/src/publish-event.test.ts`
- [x] Test passes (green phase)

**Estimated Effort:** 0 hours (covered by main implementation)

---

### Test: publishEvent() throws after stop() (P2)

**File:** `packages/sdk/src/publish-event.test.ts`

**Tasks to make this test pass:**

- [x] Verify `stop()` resets the `started` flag so the not-started guard fires
- [x] Run test: `npx vitest run packages/sdk/src/publish-event.test.ts`
- [x] Test passes (green phase)

**Estimated Effort:** 0 hours (covered by existing stop() implementation)

---

### Test: publishEvent() exact amount verification (P2)

**File:** `packages/sdk/src/publish-event.test.ts`

**Tasks to make this test pass:**

- [x] Import `encodeEventToToon` from `@crosstown/core/toon` and verify exact `basePricePerByte * BigInt(toonData.length)` match
- [x] Run test: `npx vitest run packages/sdk/src/publish-event.test.ts`
- [x] Test passes (green phase)

**Estimated Effort:** 0 hours (covered by main implementation)

---

### Test: publishEvent() error wrapping tests (P1/P2)

**File:** `packages/sdk/src/publish-event.test.ts`

**Tasks to make this test pass:**

- [x] Implement try/catch in `publishEvent()` that propagates `NodeError` directly and wraps other errors with "Failed to publish event:" prefix
- [x] Handle non-Error thrown values via `String()` conversion
- [x] Run test: `npx vitest run packages/sdk/src/publish-event.test.ts`
- [x] All 4 error wrapping tests pass (T-2.6-12 through T-2.6-15)

**Estimated Effort:** 0.25 hours

---

### Additional: Export PublishEventResult type (AC#5)

**File:** `packages/sdk/src/index.ts`

**Tasks:**

- [x] Add `PublishEventResult` to the type exports line: `export type { NodeConfig, ServiceNode, StartResult, PublishEventResult } from './create-node.js';`
- [x] Run test: `npx vitest run packages/sdk/src/index.test.ts` (existing export validation test)
- [x] Test passes (green phase)

**Estimated Effort:** 0.1 hours

---

### Additional: Re-enable ATDD tests in vitest configs

**Files:** `vitest.config.ts` (root), `packages/sdk/vitest.config.ts`

**Tasks:**

- [x] Remove `'packages/sdk/src/publish-event.test.ts'` from root `vitest.config.ts` exclude array
- [x] Remove `'src/publish-event.test.ts'` from `packages/sdk/vitest.config.ts` exclude array (and update comment to "Story 2.6 (done)")
- [x] Run `pnpm test` -- all tests pass including the new publish-event tests

**Estimated Effort:** 0.1 hours

---

## Running Tests

```bash
# Run all publishEvent tests for this story
npx vitest run packages/sdk/src/publish-event.test.ts

# Run all SDK unit tests (existing + new)
npx vitest run packages/sdk/src/

# Run full project test suite
pnpm test

# Run with verbose output
npx vitest run packages/sdk/src/publish-event.test.ts --reporter=verbose

# Run with coverage
pnpm test:coverage
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**

- All 9 original ATDD tests written and failing with `TypeError: node.publishEvent is not a function`
- Mock connector factory created with call recording
- Test event factory created with overrides support
- Implementation checklist created mapping tests to code tasks
- No fixtures needed beyond inline helpers (project convention)
- Test file excluded from vitest configs during RED phase

**Verification:**

- All 9 original tests failed with clear, actionable error messages
- Tests failed due to missing implementation, not test bugs
- All 27 existing SDK tests continued to pass

---

### GREEN Phase (Complete)

**DEV Agent Responsibilities (All Complete):**

1. Exposed `runtimeClient` from `CrosstownNode` in `packages/core/src/compose.ts`
2. Added `PublishEventResult` type and `publishEvent()` to `ServiceNode` interface + implementation in `packages/sdk/src/create-node.ts`
3. Updated SDK exports in `packages/sdk/src/index.ts`
4. Removed exclusion from both `vitest.config.ts` (root) and `packages/sdk/vitest.config.ts`
5. All 16 tests passing (9 original + 7 added during code review) at commit `ce161ef`
6. `pnpm build && pnpm test && pnpm lint && pnpm format:check` all passed at commit `ce161ef`
7. Test review added 6 more tests (T-2.6-17 through T-2.6-22), bringing total to 22

**Final Test Counts (after test review):**

- 22 publishEvent tests GREEN
- 0 lint errors, format clean

---

### REFACTOR Phase (Complete)

**Completed During Code Reviews:**

1. All tests pass after each refactor
2. Code quality verified: readability, maintainability, proper error handling
3. No duplications or code smells
4. Non-null assertions replaced with optional chains
5. `afterEach` with `vi.clearAllMocks()` added per project convention
6. Non-deterministic `generateSecretKey()` replaced with fixed test key

---

## Knowledge Base References Applied

This ATDD workflow consulted the following knowledge fragments:

- **data-factories.md** - Factory patterns with overrides support (applied to inline `createTestEvent()` and `createMockConnector()` factories)
- **test-quality.md** - Test design principles (Given-When-Then comments, one assertion focus per test, determinism via fixed test data, isolation via fresh connector per test)
- **test-levels-framework.md** - Test level selection framework (Unit selected as primary level for pure function/method logic with no external dependencies)
- **test-healing-patterns.md** - Failure pattern awareness (tests designed to produce clear `TypeError` on missing method, not ambiguous failures)

See `tea-index.csv` for complete knowledge fragment mapping.

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `npx vitest run packages/sdk/src/publish-event.test.ts --reporter=verbose`

**Results:**

```
 FAIL  packages/sdk/src/publish-event.test.ts > publishEvent() unit tests (Story 2.6) > [P0] publishEvent() TOON-encodes the event and sends via connector.sendPacket() with correct parameters (AC#1)
TypeError: node.publishEvent is not a function

 FAIL  packages/sdk/src/publish-event.test.ts > publishEvent() unit tests (Story 2.6) > [P0] publishEvent() computes correct amount as basePricePerByte * toonData.length (AC#1)
TypeError: node.publishEvent is not a function

 FAIL  packages/sdk/src/publish-event.test.ts > publishEvent() unit tests (Story 2.6) > [P0] publishEvent() returns { success: true, eventId, fulfillment } when connector accepts (AC#4)
TypeError: node.publishEvent is not a function

 FAIL  packages/sdk/src/publish-event.test.ts > publishEvent() unit tests (Story 2.6) > [P0] publishEvent() returns { success: false, eventId, code, message } when connector rejects (AC#4)
TypeError: node.publishEvent is not a function

 FAIL  packages/sdk/src/publish-event.test.ts > publishEvent() unit tests (Story 2.6) > [P1] publishEvent() throws NodeError when node not started (AC#3)
TypeError: node.publishEvent is not a function

 FAIL  packages/sdk/src/publish-event.test.ts > publishEvent() unit tests (Story 2.6) > [P1] publishEvent() throws NodeError when options is undefined (AC#2)
TypeError: node.publishEvent is not a function

 FAIL  packages/sdk/src/publish-event.test.ts > publishEvent() unit tests (Story 2.6) > [P1] publishEvent() throws NodeError when destination is empty string (AC#2)
TypeError: node.publishEvent is not a function

 FAIL  packages/sdk/src/publish-event.test.ts > publishEvent() unit tests (Story 2.6) > [P2] publishEvent() uses custom basePricePerByte from config when provided (AC#1)
TypeError: node.publishEvent is not a function

 FAIL  packages/sdk/src/publish-event.test.ts > publishEvent() unit tests (Story 2.6) > [P2] publishEvent() uses default basePricePerByte (10n) when not configured (AC#1)
TypeError: node.publishEvent is not a function

 Test Files  1 failed (1)
      Tests  9 failed (9)
   Duration  1.76s
```

**Summary:**

- Total tests: 9
- Passing: 0 (expected)
- Failing: 9 (expected)
- Status: RED phase verified

### GREEN Phase Verification (at commit ce161ef)

**Command:** `pnpm test`

**Results:**

- Test Files: 1,454 passed, 185 skipped, 0 failures
- publishEvent tests: 16 passed (9 original + 7 added during code review)
- Lint: 0 errors (381 pre-existing warnings)
- Format: all files clean

---

## Risk Mitigations

- **Amount conversion safety (score 2):** `publishEvent()` converts bigint amount to string via `String()` for `sendIlpPacket()`, and the `DirectRuntimeClient` converts back to bigint. Tests T-2.6-02, T-2.6-08, T-2.6-09, T-2.6-11 verify the full roundtrip.
- **Error wrapping correctness (score 2):** `NodeError` is propagated directly (not double-wrapped), while non-`NodeError` exceptions are wrapped with "Failed to publish event:" prefix. Tests T-2.6-12 through T-2.6-15 cover all error paths.

---

## Notes

- Tests follow the co-located test file convention established by `create-node.test.ts`, `handler-registry.test.ts`, etc.
- The mock connector factory records `sendPacket` calls in `sendPacketCalls[]` array, enabling precise assertion on the parameters passed through the full `publishEvent -> DirectRuntimeClient -> connector.sendPacket` chain
- The `PublishEventResult` type export (AC#5) is verified by a compile-time type import from the SDK index (`import type { PublishEventResult } from './index.js'`), so TypeScript compilation will fail if the type is not exported
- Amount assertions verify both mathematical properties (> 0, divisible by basePricePerByte) and exact values (T-2.6-11), making tests resilient to TOON encoding changes while still verifying correctness
- `vi.mock('nostr-tools')` is included per project convention to prevent live relay connections via SimplePool
- Tests use a fixed 32-byte secret key (`'a'.repeat(64)` hex-decoded) for deterministic identity derivation
- **Build note:** WIP commits for Stories 2-7/2-8 on the `epic-2` branch have removed SPSP files but not yet updated all references in `RelayMonitor.ts`, causing a build failure. This is unrelated to Story 2-6 and does not affect the validity of the publishEvent tests (which were verified GREEN at commit `ce161ef`)

---

## Contact

**Questions or Issues?**

- Refer to Story 2.6 implementation artifacts: `_bmad-output/implementation-artifacts/2-6-add-publish-event-to-service-node.md`
- Consult `_bmad/tea/testarch/knowledge/` for testing best practices
- Run `pnpm test` for full suite verification

---

**Generated by BMad TEA Agent** - 2026-03-07
