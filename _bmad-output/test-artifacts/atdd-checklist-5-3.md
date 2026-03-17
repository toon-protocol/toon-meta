---
stepsCompleted:
  - 'step-01-preflight-and-context'
  - 'step-02-generation-mode'
  - 'step-03-test-strategy'
  - 'step-04-generate-tests'
  - 'step-04c-aggregate'
  - 'step-05-validate-and-complete'
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-03-16'
workflowType: 'testarch-atdd'
inputDocuments:
  - '_bmad-output/implementation-artifacts/5-3-job-result-delivery-and-compute-settlement.md'
  - '_bmad-output/project-context.md'
  - 'packages/sdk/src/create-node.ts'
  - 'packages/core/src/events/dvm.ts'
  - 'packages/core/src/events/service-discovery.ts'
  - 'packages/core/src/bootstrap/types.ts'
---

# ATDD Checklist - Epic 5, Story 5.3: Job Result Delivery + Compute Settlement

**Date:** 2026-03-16
**Author:** Jonathan
**Primary Test Level:** Unit + Integration (backend stack)

---

## Story Summary

Story 5.3 introduces the first NEW production code in Epic 5: three SDK helper methods (`publishFeedback`, `publishResult`, `settleCompute`) on the `ServiceNode` interface that compose existing primitives into convenient DVM-specific helpers.

**As a** DVM provider agent
**I want** to publish job results and receive compute payment through the ILP network
**So that** the complete job lifecycle (request -> feedback -> result -> settlement) works end-to-end on Crosstown.

---

## Acceptance Criteria

1. Provider publishes Kind 7000 feedback via `publishFeedback()` with correct NIP-90 tags (`e`, `p`, `status`)
2. Provider publishes Kind 6xxx result via `publishResult()` with correct NIP-90 tags (`e`, `p`, `amount`) and content
3. Customer calls `settleCompute()` to send ILP payment for compute cost (pure value transfer, empty data)
4. Multi-hop compute payment routes through ILP mesh (same infrastructure as relay write fees)
5. Provider publishes error feedback with `status: 'error'` and error details in content
6. SDK provides high-level helpers: `publishFeedback()`, `publishResult()`, `settleCompute()` on ServiceNode
7. Customer receives feedback + result events correlated by shared `requestEventId` in `e` tag
8. Bid validation: `settleCompute()` rejects when `amount > originalBid`, accepts when `amount <= bid`

---

## Failing Tests Created (RED Phase)

### Unit Tests (20 tests)

**File:** `packages/sdk/src/dvm-lifecycle.test.ts` (790 lines)

- **Test:** T-5.3-10: publishFeedback() builds Kind 7000 event with correct e, p, and status tags
  - **Status:** RED - TypeError: node.publishFeedback is not a function
  - **Verifies:** AC #1, #6 -- publishFeedback() delegation to buildJobFeedbackEvent() + publishEvent()

- **Test:** T-5.3-10 amplification: publishFeedback() includes content
  - **Status:** RED - TypeError: node.publishFeedback is not a function
  - **Verifies:** AC #1 -- content field in feedback event

- **Test:** T-5.3-10 amplification: publishFeedback() with error status
  - **Status:** RED - TypeError: node.publishFeedback is not a function
  - **Verifies:** AC #5 -- error status with error details in content

- **Test:** T-5.3-16: publishFeedback() pays basePricePerByte * toonData.length
  - **Status:** RED - TypeError: node.publishFeedback is not a function
  - **Verifies:** AC #1 -- standard pricing model (no DVM-specific overrides)

- **Test:** publishFeedback() throws when called before start()
  - **Status:** RED - TypeError: node.publishFeedback is not a function
  - **Verifies:** Guard condition -- lifecycle enforcement

- **Test:** T-5.3-11: publishResult() builds Kind 6100 event with correct e, p, and amount tags
  - **Status:** RED - TypeError: node.publishResult is not a function
  - **Verifies:** AC #2, #6 -- publishResult() delegation to buildJobResultEvent() + publishEvent()

- **Test:** T-5.3-11 amplification: publishResult() accepts custom kind option
  - **Status:** RED - TypeError: node.publishResult is not a function
  - **Verifies:** AC #2 -- custom kind override (e.g., 6200 for image generation)

- **Test:** T-5.3-16: publishResult() pays basePricePerByte * toonData.length
  - **Status:** RED - TypeError: node.publishResult is not a function
  - **Verifies:** AC #2 -- standard pricing model

- **Test:** publishResult() throws when called before start()
  - **Status:** RED - TypeError: node.publishResult is not a function
  - **Verifies:** Guard condition -- lifecycle enforcement

- **Test:** T-5.3-12: settleCompute() extracts amount and sends ILP payment with empty data
  - **Status:** RED - TypeError: node.settleCompute is not a function
  - **Verifies:** AC #3, #6 -- pure value transfer via sendIlpPacket

- **Test:** T-5.3-04: settleCompute() throws when amount > originalBid (E5-R005)
  - **Status:** RED - TypeError: node.settleCompute is not a function
  - **Verifies:** AC #8 -- bid validation security boundary

- **Test:** T-5.3-04 amplification: error message indicates amount exceeds bid
  - **Status:** RED - TypeError: node.settleCompute is not a function
  - **Verifies:** AC #8 -- actionable error message

- **Test:** T-5.3-05: settleCompute() proceeds when amount <= originalBid
  - **Status:** RED - TypeError: node.settleCompute is not a function
  - **Verifies:** AC #8 -- bid validation passes

- **Test:** T-5.3-05 amplification: exact equality (amount == bid) succeeds
  - **Status:** RED - TypeError: node.settleCompute is not a function
  - **Verifies:** AC #8 -- boundary condition

- **Test:** T-5.3-17: settleCompute() throws for malformed result event (no amount tag)
  - **Status:** RED - TypeError: node.settleCompute is not a function
  - **Verifies:** AC #3 -- input validation for malformed events

- **Test:** T-5.3-18: settleCompute() without originalBid proceeds without validation
  - **Status:** RED - TypeError: node.settleCompute is not a function
  - **Verifies:** AC #8 -- optional bid validation

- **Test:** T-5.3-18 amplification: no originalBid with very large amounts
  - **Status:** RED - TypeError: node.settleCompute is not a function
  - **Verifies:** AC #8 -- caller assumes responsibility when bid omitted

- **Test:** T-5.3-07: settleCompute() returns rejected result for unreachable ILP address
  - **Status:** RED - TypeError: node.settleCompute is not a function
  - **Verifies:** AC #3 -- error handling for invalid destinations

- **Test:** settleCompute() throws when called before start()
  - **Status:** RED - TypeError: node.settleCompute is not a function
  - **Verifies:** Guard condition -- lifecycle enforcement

- **Test:** T-5.3-06: parseServiceDiscovery() extracts ilpAddress from kind:10035
  - **Status:** GREEN (validates existing infrastructure)
  - **Verifies:** AC #3 -- address extraction chain for settleCompute() callers

### Integration Tests (14 tests)

**File:** `packages/sdk/src/__integration__/dvm-lifecycle.test.ts` (990 lines)

- **Test:** T-5.3-01: publishFeedback() sends Kind 7000 via ILP PREPARE with correct tags
  - **Status:** RED - TypeError: node.publishFeedback is not a function
  - **Verifies:** AC #1 -- full pipeline: TOON encode -> ILP PREPARE -> decoded event has correct tags

- **Test:** T-5.3-08: publishFeedback() with error status includes error details
  - **Status:** RED - TypeError: node.publishFeedback is not a function
  - **Verifies:** AC #5 -- error feedback with error details in content

- **Test:** T-INT-08: Kind 7000 feedback with all four status values survives TOON roundtrip
  - **Status:** RED - TypeError: node.publishFeedback is not a function
  - **Verifies:** Cross-story 5.1 -> 5.3 -- all NIP-90 status values preserved through TOON

- **Test:** T-5.3-02: publishResult() sends Kind 6100 via ILP PREPARE with correct tags and content
  - **Status:** RED - TypeError: node.publishResult is not a function
  - **Verifies:** AC #2 -- full pipeline: TOON encode -> ILP PREPARE -> decoded event has correct tags

- **Test:** T-INT-07: Kind 6100 result with complex content survives TOON roundtrip
  - **Status:** RED - TypeError: node.publishResult is not a function
  - **Verifies:** Cross-story 5.1 -> 5.3 -- multi-line text, JSON, URLs preserved

- **Test:** T-INT-03: Kind 6xxx amount tag preserved through TOON encode/decode
  - **Status:** RED - TypeError: node.publishResult is not a function
  - **Verifies:** Cross-story 5.1 -> 5.3 -- amount survives roundtrip, parseable as USDC micro-units

- **Test:** T-5.3-03: settleCompute() sends ILP payment with correct amount and empty data
  - **Status:** RED - TypeError: node.settleCompute is not a function
  - **Verifies:** AC #3 -- pure value transfer, destination = provider ILP address

- **Test:** T-5.3-13: settleCompute() uses same sendPacket infrastructure as relay write fees
  - **Status:** RED - TypeError: node.settleCompute is not a function
  - **Verifies:** AC #4 -- no separate channel creation needed

- **Test:** T-5.3-09: full DVM lifecycle -- request -> feedback -> result -> settleCompute()
  - **Status:** RED - TypeError: node.publishFeedback is not a function
  - **Verifies:** AC #1, #2, #3, #6 -- complete lifecycle with SDK helpers

- **Test:** T-5.3-19: feedback and result events correlated by shared requestEventId
  - **Status:** RED - TypeError: node.publishFeedback is not a function
  - **Verifies:** AC #7 -- event correlation via e tag

- **Test:** T-INT-02: Provider Kind 6xxx references customer Kind 5xxx via e tag
  - **Status:** RED - TypeError: node.publishResult is not a function
  - **Verifies:** Cross-story 5.2 -> 5.3 -- result references request

- **Test:** T-5.3-20: error lifecycle -- error feedback -> no result -> no settlement
  - **Status:** RED - TypeError: node.publishFeedback is not a function
  - **Verifies:** AC #5 -- error lifecycle (no compute payment expected)

- **Test:** T-INT-07 extended: Kind 6100 with embedded JSON content survives TOON roundtrip
  - **Status:** RED - TypeError: node.publishResult is not a function
  - **Verifies:** Cross-story 5.1 -> 5.3 -- structured JSON content preservation

- **Test:** T-INT-03 amplification: settlement amount matches after TOON roundtrip
  - **Status:** RED - TypeError: node.settleCompute is not a function
  - **Verifies:** Cross-story 5.1 -> 5.3 -- amount preservation through full pipeline

---

## Data Factories Created

### Mock Connector Factory

**File:** `packages/sdk/src/dvm-lifecycle.test.ts` (inline)

**Exports:**
- `createMockConnector(sendPacketResult?)` - Create connector with configurable sendPacket behavior
- `createMockResultEvent(overrides?)` - Create deterministic Kind 6100 result event
- `createMalformedResultEvent()` - Create result event with no amount tag

### Mock Embedded Connector (Integration)

**File:** `packages/sdk/src/__integration__/dvm-lifecycle.test.ts` (inline)

**Exports:**
- `MockEmbeddedConnector` class - Full EmbeddableConnectorLike with packet delivery simulation

---

## Fixtures Created

No separate fixture files created. Test data is inline using factory functions (project pattern: deterministic mock data with fixed timestamps and keys).

---

## Mock Requirements

### ILP Client Mock

**Method:** `sendIlpPacket({ destination, amount, data })`
- Used by `settleCompute()` for compute settlement (empty data)
- Used by `publishEvent()` for relay writes (TOON data)

**Success Response:** `{ accepted: true, fulfillment: 'test-fulfillment' }`
**Failure Response:** `{ accepted: false, code: 'F02', message: 'No route found' }`

### Embedded Connector Mock

**Interface:** `EmbeddableConnectorLike`
- `sendPacket(params)` - Records calls, returns configurable result
- `registerPeer(params)` - No-op for unit tests
- `setPacketHandler(handler)` - Stores handler for pipeline integration

---

## Required data-testid Attributes

Not applicable (backend SDK project -- no UI components).

---

## Implementation Checklist

### Test: T-5.3-10/T-5.3-11 (publishFeedback/publishResult)

**File:** `packages/sdk/src/dvm-lifecycle.test.ts`

**Tasks to make these tests pass:**
- [ ] Add `publishFeedback()` method signature to `ServiceNode` interface (packages/sdk/src/create-node.ts ~line 168)
- [ ] Add `publishResult()` method signature to `ServiceNode` interface
- [ ] Import `buildJobFeedbackEvent`, `buildJobResultEvent` from `@crosstown/core` in create-node.ts
- [ ] Implement `publishFeedback()` in createNode() closure: build feedback event with `buildJobFeedbackEvent()`, delegate to `this.publishEvent()`
- [ ] Implement `publishResult()` in createNode() closure: build result event with `buildJobResultEvent()`, delegate to `this.publishEvent()`
- [ ] Add lifecycle guard (not started check) in both methods
- [ ] Run test: `npx vitest run packages/sdk/src/dvm-lifecycle.test.ts`
- [ ] Verify tests pass (green phase)

**Estimated Effort:** 2 hours

---

### Test: T-5.3-12/T-5.3-04/T-5.3-05/T-5.3-17/T-5.3-18 (settleCompute)

**File:** `packages/sdk/src/dvm-lifecycle.test.ts`

**Tasks to make these tests pass:**
- [ ] Add `settleCompute()` method signature to `ServiceNode` interface with `options?: { originalBid?: string }`
- [ ] Import `parseJobResult` from `@crosstown/core` in create-node.ts
- [ ] Implement `settleCompute()` in createNode() closure:
  - [ ] Parse result event with `parseJobResult()` to extract amount
  - [ ] Throw NodeError if parseJobResult returns null (malformed event, T-5.3-17)
  - [ ] If `options.originalBid` provided, validate `BigInt(amount) <= BigInt(originalBid)` (T-5.3-04, T-5.3-05)
  - [ ] Throw NodeError with descriptive message if amount exceeds bid (E5-R005)
  - [ ] Call `ilpClient.sendIlpPacket({ destination: providerIlpAddress, amount, data: '' })` (T-5.3-12)
  - [ ] Return `IlpSendResult`
- [ ] Add lifecycle guard (not started check)
- [ ] Run test: `npx vitest run packages/sdk/src/dvm-lifecycle.test.ts`
- [ ] Verify tests pass (green phase)

**Estimated Effort:** 2 hours

---

### Integration Tests: T-5.3-01/02/03/08/09/13/19/20, T-INT-02/03/07/08

**File:** `packages/sdk/src/__integration__/dvm-lifecycle.test.ts`

**Tasks to make these tests pass:**
- [ ] All production code from Task 1 (publishFeedback, publishResult, settleCompute) must be implemented
- [ ] Verify TOON encode/decode roundtrip preserves all NIP-90 tags (uses real TOON codec)
- [ ] Verify full lifecycle: request -> feedback -> result -> settlement
- [ ] Verify error lifecycle: request -> error feedback -> no settlement
- [ ] Run test: `cd packages/sdk && npx vitest run src/__integration__/dvm-lifecycle.test.ts --config vitest.integration.config.ts`
- [ ] Verify tests pass (green phase)

**Estimated Effort:** 1 hour (after production code is implemented)

---

## Running Tests

```bash
# Run all failing unit tests for this story
npx vitest run packages/sdk/src/dvm-lifecycle.test.ts

# Run all failing integration tests for this story
cd packages/sdk && npx vitest run src/__integration__/dvm-lifecycle.test.ts --config vitest.integration.config.ts

# Run both test suites
npx vitest run packages/sdk/src/dvm-lifecycle.test.ts && cd packages/sdk && npx vitest run src/__integration__/dvm-lifecycle.test.ts --config vitest.integration.config.ts

# Run specific test by name
npx vitest run packages/sdk/src/dvm-lifecycle.test.ts -t "T-5.3-04"

# Run tests with verbose output
npx vitest run packages/sdk/src/dvm-lifecycle.test.ts --reporter=verbose
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**

- All 34 tests written (33 failing, 1 passing)
- Factories and mocks created inline (project pattern)
- Implementation checklist created with specific file/line references
- Test IDs aligned with test-design-epic-5.md numbering

**Verification:**

- All tests run and fail as expected
- Failure messages are clear: `TypeError: node.publishFeedback/publishResult/settleCompute is not a function`
- Tests fail due to missing implementation, not test bugs
- 1 test (T-5.3-06) passes -- validates existing `parseServiceDiscovery()` infrastructure

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. **Pick publishFeedback() tests first** (T-5.3-10 group) -- simplest helper
2. **Add interface signatures** to ServiceNode (all three methods)
3. **Implement publishFeedback()** -- ~10 lines: build event, delegate to publishEvent()
4. **Run unit tests** to verify publishFeedback tests pass
5. **Implement publishResult()** -- ~15 lines: build event with kind derivation, delegate
6. **Run unit tests** to verify publishResult tests pass
7. **Implement settleCompute()** -- ~20 lines: parse result, bid validation, sendIlpPacket
8. **Run all unit tests** to verify all pass
9. **Run integration tests** to verify full pipeline
10. **Lint check:** `pnpm lint`

**Key Principles:**

- One test at a time (don't try to fix all at once)
- Minimal implementation (don't over-engineer)
- Run tests frequently (immediate feedback)
- Use implementation checklist as roadmap

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

**DEV Agent Responsibilities:**

1. **Verify all 34 tests pass** (green phase complete)
2. **Review code for quality** (readability, maintainability, performance)
3. **Ensure no TypeScript strict mode violations** (noUncheckedIndexedAccess, etc.)
4. **Run full monorepo tests** to verify no regressions: `pnpm test`
5. **Run lint:** `pnpm lint`

---

## Next Steps

1. **Review this checklist** with team
2. **Run failing tests** to confirm RED phase: `npx vitest run packages/sdk/src/dvm-lifecycle.test.ts`
3. **Begin implementation** using implementation checklist as guide
4. **Work one test at a time** (red -> green for each)
5. **When all tests pass**, refactor code for quality
6. **When refactoring complete**, manually update story status to 'done'

---

## Knowledge Base References Applied

This ATDD workflow consulted the following knowledge fragments:

- **test-quality.md** - Test design principles (Given-When-Then, one assertion per test, determinism, isolation)
- **data-factories.md** - Factory patterns for random test data generation with overrides support
- **test-levels-framework.md** - Test level selection framework (Unit vs Integration for backend)
- **test-priorities-matrix.md** - P0-P3 priority assignment based on risk and business impact

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `npx vitest run packages/sdk/src/dvm-lifecycle.test.ts --reporter=verbose`

**Results:**

```
Test Files  1 failed (1)
     Tests  19 failed | 1 passed (20)
  Duration  2.93s
```

**Command:** `cd packages/sdk && npx vitest run src/__integration__/dvm-lifecycle.test.ts --config vitest.integration.config.ts --reporter=verbose`

**Results:**

```
Test Files  1 failed (1)
     Tests  14 failed (14)
  Duration  2.54s
```

**Summary:**

- Total tests: 34
- Passing: 1 (T-5.3-06 -- validates existing infrastructure)
- Failing: 33 (expected -- methods don't exist yet)
- Status: RED phase verified

**Expected Failure Messages:**
- `TypeError: node.publishFeedback is not a function` (13 tests)
- `TypeError: node.publishResult is not a function` (10 tests)
- `TypeError: node.settleCompute is not a function` (10 tests)

---

## Notes

- All `(node as any).publishFeedback/publishResult/settleCompute` casts are intentional -- they exercise methods that don't exist yet on the ServiceNode interface. These casts will be replaced with proper typed calls when the interface is expanded in Story 5.3 implementation.
- T-5.3-06 (parseServiceDiscovery) passes because it validates existing Story 3.5 infrastructure, not new Story 5.3 code.
- T-5.3-14 (multi-hop routing E2E) is deferred to SDK E2E infra availability (requires `sdk-e2e-infra.sh` with 2+ Docker peers).
- T-5.3-15 (full lifecycle E2E on genesis infrastructure) is P3 priority, deferred.
- ESLint warnings for `any` type in test files are expected (project rule: relaxed to `warn` in test files).

---

## Contact

**Questions or Issues?**

- Refer to `_bmad-output/implementation-artifacts/5-3-job-result-delivery-and-compute-settlement.md` for full story details
- Consult `_bmad-output/project-context.md` for testing rules and patterns

---

**Generated by BMad TEA Agent** - 2026-03-16
