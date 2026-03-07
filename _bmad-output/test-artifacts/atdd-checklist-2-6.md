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

## Failing Tests Created (RED Phase)

### Unit Tests (9 tests)

**File:** `packages/sdk/src/publish-event.test.ts` (374 lines)

- **Test:** `[P0] publishEvent() TOON-encodes the event and sends via connector.sendPacket() with correct parameters (AC#1)`
  - **Status:** RED - `TypeError: node.publishEvent is not a function`
  - **Verifies:** Event is TOON-encoded, destination passed through, data is Uint8Array, amount is bigint > 0

- **Test:** `[P0] publishEvent() computes correct amount as basePricePerByte * toonData.length (AC#1)`
  - **Status:** RED - `TypeError: node.publishEvent is not a function`
  - **Verifies:** Amount is a multiple of basePricePerByte and greater than zero

- **Test:** `[P0] publishEvent() returns { success: true, eventId, fulfillment } when connector accepts (AC#4)`
  - **Status:** RED - `TypeError: node.publishEvent is not a function`
  - **Verifies:** Success result shape with eventId matching the input event and non-empty fulfillment string

- **Test:** `[P0] publishEvent() returns { success: false, eventId, code, message } when connector rejects (AC#4)`
  - **Status:** RED - `TypeError: node.publishEvent is not a function`
  - **Verifies:** Rejection result shape with eventId, error code (F02), and error message

- **Test:** `[P1] publishEvent() throws NodeError when node not started (AC#3)`
  - **Status:** RED - `TypeError: node.publishEvent is not a function`
  - **Verifies:** NodeError thrown with "Cannot publish: node not started" message

- **Test:** `[P1] publishEvent() throws NodeError when options is undefined (AC#2)`
  - **Status:** RED - `TypeError: node.publishEvent is not a function`
  - **Verifies:** NodeError thrown with "destination is required" message when called without options

- **Test:** `[P1] publishEvent() throws NodeError when destination is empty string (AC#2)`
  - **Status:** RED - `TypeError: node.publishEvent is not a function`
  - **Verifies:** NodeError thrown with "destination is required" message when destination is ""

- **Test:** `[P2] publishEvent() uses custom basePricePerByte from config when provided (AC#1)`
  - **Status:** RED - `TypeError: node.publishEvent is not a function`
  - **Verifies:** Amount is a multiple of the custom basePricePerByte (50n)

- **Test:** `[P2] publishEvent() uses default basePricePerByte (10n) when not configured (AC#1)`
  - **Status:** RED - `TypeError: node.publishEvent is not a function`
  - **Verifies:** Amount is a multiple of the default 10n basePricePerByte

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
# IMPORTANT: Tests are excluded from normal pnpm test during RED phase.
# To run them, first remove the exclusion from vitest.config.ts (root)
# and packages/sdk/vitest.config.ts, then:

# Run all failing tests for this story
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

- All 9 tests written and failing
- Mock connector factory created with call recording
- Test event factory created with overrides support
- Implementation checklist created mapping tests to code tasks
- No fixtures needed beyond inline helpers (project convention)

**Verification:**

- All 9 tests run and fail with `TypeError: node.publishEvent is not a function`
- Failure messages are clear and actionable
- Tests fail due to missing implementation, not test bugs
- All 27 existing SDK tests continue to pass

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. **Task 1:** Expose `runtimeClient` from `CrosstownNode` in `packages/core/src/compose.ts`
2. **Task 2:** Add `PublishEventResult` type and `publishEvent()` to `ServiceNode` interface + implementation in `packages/sdk/src/create-node.ts`
3. **Task 3:** Update SDK exports in `packages/sdk/src/index.ts`
4. **Task 4:** Remove exclusion (if any) from `packages/sdk/vitest.config.ts` for `publish-event.test.ts`
5. **Task 5:** Run `pnpm build && pnpm test && pnpm lint && pnpm format:check` -- all pass

**Key Principles:**

- One test at a time (don't try to fix all at once)
- Minimal implementation (don't over-engineer)
- Run tests frequently (immediate feedback)
- Use implementation checklist as roadmap

**Progress Tracking:**

- Check off tasks as you complete them
- All 9 tests passing = GREEN phase complete

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

**DEV Agent Responsibilities:**

1. **Verify all tests pass** (green phase complete)
2. **Review code for quality** (readability, maintainability, performance)
3. **Extract duplications** (DRY principle)
4. **Ensure tests still pass** after each refactor
5. **Verify no linting or formatting errors**

**Key Principles:**

- Tests provide safety net (refactor with confidence)
- Make small refactors (easier to debug if tests fail)
- Run tests after each change
- Don't change test behavior (only implementation)

**Completion:**

- All 9 new tests pass
- All 27 existing SDK tests pass
- `pnpm build && pnpm test && pnpm lint && pnpm format:check` all pass
- Ready for code review and story approval

---

## Next Steps

1. **Run failing tests** to confirm RED phase: `npx vitest run packages/sdk/src/publish-event.test.ts`
2. **Begin implementation** using implementation checklist as guide
3. **Work one test at a time** (red to green for each)
4. **When all tests pass**, refactor code for quality
5. **Run full suite**: `pnpm build && pnpm test && pnpm lint`
6. **When complete**, update story status to 'done' in sprint-status.yaml

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

**Expected Failure Messages:**

All 9 tests fail with: `TypeError: node.publishEvent is not a function`
This confirms tests fail because the feature is not implemented, not because of test bugs.

### Existing Test Verification

**Command:** `npx vitest run packages/sdk/src/create-node.test.ts --reporter=verbose`

**Results:**

```
 Test Files  1 passed (1)
      Tests  27 passed (27)
   Duration  1.19s
```

All 27 existing SDK tests continue to pass -- new test file does not break any existing functionality.

---

## Notes

- The test file is **excluded** from both `vitest.config.ts` (root) and `packages/sdk/vitest.config.ts` during the RED phase to avoid breaking `pnpm test`. When implementing Story 2.6, **remove the exclusion** from both configs to activate the tests. Run with `npx vitest run packages/sdk/src/publish-event.test.ts` to run the tests directly during development
- Tests follow the co-located test file convention established by `create-node.test.ts`, `handler-registry.test.ts`, etc.
- The mock connector factory records `sendPacket` calls in `sendPacketCalls[]` array, enabling precise assertion on the parameters passed through the full `publishEvent -> DirectRuntimeClient -> connector.sendPacket` chain
- The `PublishEventResult` type export (AC#5) is verified implicitly -- the test file imports it from `./create-node.js`, so TypeScript compilation will fail if the type is not defined
- Amount assertions verify mathematical properties (> 0, divisible by basePricePerByte) rather than exact values, making tests resilient to TOON encoding changes

---

## Contact

**Questions or Issues?**

- Refer to Story 2.6 implementation artifacts: `_bmad-output/implementation-artifacts/2-6-add-publish-event-to-service-node.md`
- Consult `_bmad/tea/testarch/knowledge/` for testing best practices
- Run `pnpm test` for full suite verification

---

**Generated by BMad TEA Agent** - 2026-03-07
