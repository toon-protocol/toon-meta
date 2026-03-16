---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-generation-mode
  - step-03-test-strategy
  - step-04c-aggregate
  - step-05-validate-and-complete
lastStep: step-05-validate-and-complete
lastSaved: '2026-03-16'
workflowType: testarch-atdd
inputDocuments:
  - _bmad-output/implementation-artifacts/5-2-ilp-native-job-submission.md
  - packages/sdk/src/handler-registry.ts
  - packages/sdk/src/handler-registry.test.ts
  - packages/sdk/src/handler-context.ts
  - packages/sdk/src/handler-context.test.ts
  - packages/sdk/src/create-node.ts
  - packages/sdk/src/verification-pipeline.ts
  - packages/sdk/src/pricing-validator.ts
  - packages/sdk/src/publish-event.test.ts
  - packages/sdk/src/__integration__/create-node.test.ts
  - packages/core/src/events/dvm.ts
  - packages/core/src/x402/build-ilp-prepare.ts
  - packages/core/src/constants.ts
  - packages/sdk/vitest.config.ts
  - packages/sdk/vitest.integration.config.ts
---

# ATDD Checklist - Epic 5, Story 5.2: ILP-Native Job Submission

**Date:** 2026-03-16
**Author:** Jonathan
**Primary Test Level:** Unit + Integration (Backend)

---

## Story Summary

Story 5.2 validates that the existing Crosstown SDK infrastructure correctly handles DVM (Data Vending Machine) event kinds (5000-5999 range) for job submission via ILP PREPARE packets. This is a validation-only story -- no production code changes are expected.

**As a** initiated agent (with an open ILP payment channel)
**I want** to publish DVM job requests via ILP PREPARE packets as the preferred path
**So that** I can post jobs using the native payment rail with lower cost and no HTTP overhead

---

## Acceptance Criteria

1. **AC #1:** Initiated agent publishes Kind 5xxx via `publishEvent()` -- event is TOON-encoded, sent as ILP PREPARE, relay stores it, pricing is `basePricePerByte * toonData.length`
2. **AC #2:** Non-initiated agent sends Kind 5xxx via x402 `/publish` -- ILP PREPARE packet is indistinguishable from ILP-native path (packet equivalence via shared `buildIlpPrepare()`)
3. **AC #3:** Provider subscribes to relay for Kind 5xxx events and receives them via WebSocket subscription
4. **AC #4:** Provider registers DVM handlers via `node.on(5100, handler)` -- handler's `ctx.decode()` returns structured event with all DVM tags intact, `ctx.toon` provides raw TOON
5. **AC #5:** Multiple DVM handlers route correctly (5100 -> textHandler, 5200 -> imageHandler); Kind 5300 with no handler returns F00
6. **AC #6:** DVM events traverse the full SDK pipeline (shallow parse -> verify -> price -> dispatch) with no stages skipped

---

## Failing Tests Created (RED Phase)

### Unit Tests (10 tests)

**File:** `packages/sdk/src/dvm-handler-dispatch.test.ts` (508 lines)

- **Test:** `[P1] T-5.2-04: node.on(5100, handler) routes Kind 5100 to the registered handler`
  - **Status:** RED - it.skip()
  - **Verifies:** HandlerRegistry dispatches DVM Kind 5100 to registered handler (AC #4)

- **Test:** `[P2] T-5.2-09: Multiple DVM handlers (5100, 5200) route to correct handler; 5300 with no handler returns F00`
  - **Status:** RED - it.skip()
  - **Verifies:** Kind-based routing for multiple DVM kinds and F00 rejection for unhandled kinds (AC #5)

- **Test:** `[P2] T-5.2-09 amplification: default handler catches unregistered DVM kinds`
  - **Status:** RED - it.skip()
  - **Verifies:** Default handler fallback for unregistered DVM kinds (AC #5)

- **Test:** `[P1] T-5.2-06: ctx.toon provides raw TOON base64 string for direct LLM consumption`
  - **Status:** RED - it.skip()
  - **Verifies:** HandlerContext.toon returns raw TOON without triggering decode (AC #4)

- **Test:** `[P1] T-5.2-05: ctx.decode() returns full Nostr event with all DVM tags intact`
  - **Status:** RED - it.skip()
  - **Verifies:** Lazy decode preserves all DVM tags (i, bid, output, p, param, relays) (AC #4)

- **Test:** `[P1] T-5.2-05 amplification: ctx.decode() caches result and only calls decoder once`
  - **Status:** RED - it.skip()
  - **Verifies:** Lazy decode caching invariant for DVM events (AC #4)

- **Test:** `[P2] T-5.2-10: handler can detect targeted request via p tag presence`
  - **Status:** RED - it.skip()
  - **Verifies:** Targeted vs untargeted request filtering via p tag (AC #4)

- **Test:** `[P1] T-5.2-06 amplification: ctx.kind from shallow parse returns DVM kind without triggering decode`
  - **Status:** RED - it.skip()
  - **Verifies:** Shallow parse metadata for DVM kinds (AC #4)

- **Test:** `[P1] T-5.2-08: DVM event pricing uses basePricePerByte * toonData.length`
  - **Status:** RED - it.skip()
  - **Verifies:** Standard per-byte pricing applies to DVM events (AC #1)

- **Test:** `[P1] T-5.2-08 amplification: DVM kinds have no special pricing`
  - **Status:** RED - it.skip()
  - **Verifies:** DVM events pay same rate as Kind 1 events (AC #1)

### Integration Tests (11 tests)

**File:** `packages/sdk/src/__integration__/dvm-job-submission.test.ts` (946 lines)

- **Test:** `[P0] T-5.2-01: publishEvent() sends Kind 5100 DVM event via ILP PREPARE`
  - **Status:** RED - it.skip()
  - **Verifies:** End-to-end ILP-native DVM job submission (AC #1)

- **Test:** `[P0] T-5.2-01 amplification: Kind 5100 DVM tags survive TOON encode/decode roundtrip`
  - **Status:** RED - it.skip()
  - **Verifies:** DVM tag fidelity through TOON encoding (AC #1)

- **Test:** `[P0] T-5.2-03 / T-INT-04: buildIlpPrepare() produces identical packets for ILP and x402 paths`
  - **Status:** RED - it.skip()
  - **Verifies:** Packet equivalence invariant (AC #2)

- **Test:** `[P0] T-5.2-02: x402-submitted Kind 5100 uses shared buildIlpPrepare()`
  - **Status:** RED - it.skip()
  - **Verifies:** Identical relay-side storage for x402 path (AC #2)

- **Test:** `[P0] T-5.2-03 amplification: ILP and x402 compute identical amounts`
  - **Status:** RED - it.skip()
  - **Verifies:** Amount calculation consistency (AC #2)

- **Test:** `[P0] T-INT-06: Kind 5100 traverses full pipeline: shallow parse -> verify -> price -> dispatch`
  - **Status:** RED - it.skip()
  - **Verifies:** Pipeline ordering invariant for DVM events (AC #6)

- **Test:** `[P0] T-INT-06 amplification: DVM handler receives correct HandlerContext`
  - **Status:** RED - it.skip()
  - **Verifies:** HandlerContext correctness after full pipeline (AC #4, #6)

- **Test:** `[P0] T-INT-01: Complex DVM event survives TOON roundtrip and handler dispatch`
  - **Status:** RED - it.skip()
  - **Verifies:** Cross-story 5.1 -> 5.2 boundary (AC #1, #4)

- **Test:** `[P0] T-INT-01 amplification: DVM event content field survives TOON roundtrip`
  - **Status:** RED - it.skip()
  - **Verifies:** Content field fidelity through pipeline (AC #1)

- **Test:** `[P1] T-5.2-04 integration: node.on(5100, handler) receives live Kind 5100 event`
  - **Status:** RED - it.skip()
  - **Verifies:** Handler registration works through full pipeline (AC #4)

- **Test:** `[P2] T-5.2-09 integration: multiple DVM handlers route correctly through pipeline`
  - **Status:** RED - it.skip()
  - **Verifies:** Multi-handler routing through live pipeline (AC #5)

---

## Data Factories Created

### DVM Event Factory

**File:** `packages/sdk/src/dvm-handler-dispatch.test.ts` (inline)

**Exports (test-local):**

- `createDvmMeta(overrides?)` - Create ToonRoutingMeta for DVM events
- `createDvmJobRequestEvent(overrides?)` - Create decoded NostrEvent with DVM tags
- `createComplexDvmEvent(overrides?)` - Create complex DVM event with all tag types
- `createMockDvmContext(overrides?)` - Create mock HandlerContext for DVM dispatch

### DVM Integration Factory

**File:** `packages/sdk/src/__integration__/dvm-job-submission.test.ts` (inline)

**Exports (test-local):**

- `createSignedDvmEvent(secretKey, kind, tags, content?)` - Create signed TOON-encoded DVM event
- `createDvmJobRequestViaBuilder(secretKey)` - Create Kind 5100 via Story 5.1 builder
- `createComplexDvmJobRequest(secretKey)` - Create complex DVM event with all tag types
- `MockEmbeddedConnector` - Mock connector class for integration tests

---

## Fixtures Created

### MockEmbeddedConnector Fixture

**File:** `packages/sdk/src/__integration__/dvm-job-submission.test.ts` (inline class)

**Fixture:**

- `MockEmbeddedConnector` - Full mock of `EmbeddableConnectorLike` with `deliverPacket()` for pipeline testing
  - **Setup:** Instantiate with `new MockEmbeddedConnector()`
  - **Provides:** `sendPacketCalls` array for assertion, `deliverPacket()` for pipeline delivery
  - **Cleanup:** Called via `node.stop()` in each test

---

## Mock Requirements

### EmbeddableConnectorLike Mock

**Interface:** `EmbeddableConnectorLike` from `@crosstown/core`

**Methods mocked:**

- `sendPacket(params)` - Records calls, returns `{ type: 'fulfill', fulfillment: ... }`
- `registerPeer(params)` - No-op, stores in map
- `removePeer(peerId)` - No-op, removes from map
- `setPacketHandler(handler)` - Captures handler for `deliverPacket()` testing

**Notes:** Same mock pattern used by existing `create-node.test.ts` integration tests. No external services to mock -- all tests use in-process embedded connector mode.

---

## Required data-testid Attributes

N/A -- This is a backend-only story with no UI components. All tests operate on SDK APIs, ILP packets, and TOON encoding/decoding.

---

## Implementation Checklist

### Test: T-5.2-04 -- node.on(5100, handler) routes Kind 5100 to handler

**File:** `packages/sdk/src/dvm-handler-dispatch.test.ts`

**Tasks to make this test pass:**

- [ ] Remove `it.skip()` from this test
- [ ] Verify HandlerRegistry.dispatch() routes Kind 5100 correctly (existing code)
- [ ] Run test: `pnpm --filter @crosstown/sdk test -- --run src/dvm-handler-dispatch.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 0.1 hours (validation only -- no production code changes expected)

---

### Test: T-5.2-05 -- ctx.decode() returns all DVM tags intact

**File:** `packages/sdk/src/dvm-handler-dispatch.test.ts`

**Tasks to make this test pass:**

- [ ] Remove `it.skip()` from this test
- [ ] Verify createHandlerContext lazy decode preserves DVM tags (existing code)
- [ ] Run test: `pnpm --filter @crosstown/sdk test -- --run src/dvm-handler-dispatch.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 0.1 hours

---

### Test: T-5.2-06 -- ctx.toon provides raw TOON for LLM consumption

**File:** `packages/sdk/src/dvm-handler-dispatch.test.ts`

**Tasks to make this test pass:**

- [ ] Remove `it.skip()` from this test
- [ ] Verify ctx.toon returns raw base64 string without decoding (existing code)
- [ ] Run test: `pnpm --filter @crosstown/sdk test -- --run src/dvm-handler-dispatch.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 0.1 hours

---

### Test: T-5.2-08 -- DVM pricing uses basePricePerByte * toonData.length

**File:** `packages/sdk/src/dvm-handler-dispatch.test.ts`

**Tasks to make this test pass:**

- [ ] Remove `it.skip()` from this test
- [ ] Verify createPricingValidator accepts DVM events at standard per-byte rate (existing code)
- [ ] Run test: `pnpm --filter @crosstown/sdk test -- --run src/dvm-handler-dispatch.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 0.1 hours

---

### Test: T-5.2-09 -- Multiple DVM handlers and F00 rejection

**File:** `packages/sdk/src/dvm-handler-dispatch.test.ts`

**Tasks to make this test pass:**

- [ ] Remove `it.skip()` from this test
- [ ] Verify HandlerRegistry routes 5100, 5200 correctly and returns F00 for 5300 (existing code)
- [ ] Run test: `pnpm --filter @crosstown/sdk test -- --run src/dvm-handler-dispatch.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 0.1 hours

---

### Test: T-5.2-10 -- Targeted request filtering via p tag

**File:** `packages/sdk/src/dvm-handler-dispatch.test.ts`

**Tasks to make this test pass:**

- [ ] Remove `it.skip()` from this test
- [ ] Verify ctx.decode() exposes p tag for targeted filtering (existing code)
- [ ] Run test: `pnpm --filter @crosstown/sdk test -- --run src/dvm-handler-dispatch.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 0.1 hours

---

### Test: T-5.2-01 -- publishEvent() sends Kind 5100 via ILP PREPARE

**File:** `packages/sdk/src/__integration__/dvm-job-submission.test.ts`

**Tasks to make this test pass:**

- [ ] Remove `it.skip()` from this test
- [ ] Verify publishEvent() TOON-encodes and sends DVM event via connector (existing code)
- [ ] Run test: `pnpm --filter @crosstown/sdk test:integration -- --run`
- [ ] Test passes (green phase)

**Estimated Effort:** 0.1 hours

---

### Test: T-5.2-02 / T-5.2-03 / T-INT-04 -- Packet equivalence

**File:** `packages/sdk/src/__integration__/dvm-job-submission.test.ts`

**Tasks to make this test pass:**

- [ ] Remove `it.skip()` from packet equivalence tests
- [ ] Verify buildIlpPrepare() produces identical output for both paths (existing code)
- [ ] Run test: `pnpm --filter @crosstown/sdk test:integration -- --run`
- [ ] Tests pass (green phase)

**Estimated Effort:** 0.1 hours

---

### Test: T-INT-06 -- Full pipeline ordering for DVM events

**File:** `packages/sdk/src/__integration__/dvm-job-submission.test.ts`

**Tasks to make this test pass:**

- [ ] Remove `it.skip()` from pipeline ordering test
- [ ] Verify DVM events traverse shallow parse -> verify -> price -> dispatch (existing code)
- [ ] Run test: `pnpm --filter @crosstown/sdk test:integration -- --run`
- [ ] Test passes (green phase)

**Estimated Effort:** 0.2 hours

---

### Test: T-INT-01 -- Complex DVM tags survive TOON roundtrip

**File:** `packages/sdk/src/__integration__/dvm-job-submission.test.ts`

**Tasks to make this test pass:**

- [ ] Remove `it.skip()` from cross-story boundary test
- [ ] Verify complex DVM event with all tag types survives TOON encode/decode/parse (existing code)
- [ ] Run test: `pnpm --filter @crosstown/sdk test:integration -- --run`
- [ ] Test passes (green phase)

**Estimated Effort:** 0.2 hours

---

## Running Tests

```bash
# Run all failing unit tests for this story
pnpm --filter @crosstown/sdk test -- --run src/dvm-handler-dispatch.test.ts

# Run all failing integration tests for this story
pnpm --filter @crosstown/sdk test:integration -- --run

# Run specific integration test file only
pnpm --filter @crosstown/sdk test:integration -- --run src/__integration__/dvm-job-submission.test.ts

# Run all SDK tests (unit + integration)
pnpm --filter @crosstown/sdk test -- --run && pnpm --filter @crosstown/sdk test:integration -- --run

# Run with verbose reporter for detailed output
pnpm --filter @crosstown/sdk test -- --run --reporter=verbose src/dvm-handler-dispatch.test.ts
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**

- All 21 tests written and skipped (it.skip())
- Factories created with deterministic DVM test data
- Mock connector follows existing project patterns
- Implementation checklist maps each test to validation tasks
- No production code changes expected

**Verification:**

- Unit tests: 10 skipped, 0 failing, 0 passing (RED phase confirmed)
- Integration tests: 11 skipped, 0 failing, 0 passing (RED phase confirmed)
- All tests compile cleanly with no TypeScript errors
- Existing test suites unaffected (180 unit tests still passing)

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. **Pick one failing test** from implementation checklist (start with P0 tests)
2. **Remove `it.skip()`** from the test
3. **Run the test** -- it should pass without production code changes (validation story)
4. **If test fails**: investigate whether it's a test bug or a regression in existing infrastructure
5. **Check off the task** in implementation checklist
6. **Move to next test** and repeat

**Key Principles:**

- One test at a time (don't remove all `it.skip()` at once)
- If a test fails, it indicates a regression -- fix existing infrastructure, not new DVM-specific code
- Run tests frequently for immediate feedback

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

**DEV Agent Responsibilities:**

1. **Verify all tests pass** (green phase complete)
2. **Consider extracting** shared DVM factory functions to a common test utility if needed by Story 5.3
3. **Ensure tests still pass** after each refactor

---

## Risk Assessment

**S5.2-R1 (Score 3):** SDK handler routing for DVM kinds -- Low risk. HandlerRegistry already routes by numeric kind. Tests T-5.2-04, T-5.2-09 validate this.

**S5.2-R2 (Score 6):** Two-tier access divergence -- Moderate risk. Tests T-5.2-01, T-5.2-02, T-5.2-03, T-INT-04 validate that ILP and x402 paths produce identical packets via `buildIlpPrepare()`.

**S5.2-R3 (Score 9):** Pipeline ordering invariant -- High risk (inherited). Test T-INT-06 validates DVM events traverse the full pipeline in order. Multi-probe strategy covers all four pipeline stages.

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `pnpm --filter @crosstown/sdk test -- --run --reporter=verbose src/dvm-handler-dispatch.test.ts`

**Results:**

```
 ↓ src/dvm-handler-dispatch.test.ts  (10 tests | 10 skipped)
 Test Files  1 skipped (12 total)
      Tests  10 skipped (190 total)
```

**Command:** `pnpm --filter @crosstown/sdk test:integration -- --run --reporter=verbose`

**Results:**

```
 ↓ src/__integration__/dvm-job-submission.test.ts  (11 tests | 11 skipped)
 Test Files  1 skipped (3 total)
      Tests  11 skipped (35 total)
```

**Summary:**

- Total tests: 21
- Passing: 0 (expected)
- Skipped: 21 (expected -- it.skip() for RED phase)
- Status: RED phase verified

---

## Notes

- **Validation-only story:** No production code changes expected. All DVM submission infrastructure exists from Epics 1-4. The value is in the tests proving the infrastructure handles DVM kinds correctly.
- **Epic 5 renumbering:** Decision 8 renumbered the old Epic 5 (The Rig / NIP-34 Git Forge) to Epic 7. The current Epic 5 is the DVM Compute Marketplace. The existing `test-design-epic-5.md` and `atdd-checklist-epic-5.md` cover the old Rig epic and are not relevant to DVM stories.
- **T-5.2-07 (provider subscription):** Not implemented in this ATDD batch because it requires live WebSocket infrastructure (relay running). This test should be added when infrastructure is available or as part of the E2E test suite.
- **Import path note:** DVM builders/parsers (`buildJobRequestEvent`, `parseJobRequest`) are re-exported from `@crosstown/core` (not `@crosstown/core/events/dvm`), as the package.json exports map does not include the events subpath.

---

## Next Steps

1. **Share this checklist and failing tests** with the dev workflow
2. **Run failing tests** to confirm RED phase: `pnpm --filter @crosstown/sdk test -- --run src/dvm-handler-dispatch.test.ts`
3. **Begin validation**: Remove `it.skip()` one test at a time, starting with P0 priority
4. **Work one test at a time** (red -> green for each)
5. **When all tests pass**, refactor if needed
6. **When complete**, update story status to 'done'

---

## Knowledge Base References Applied

This ATDD workflow consulted the following knowledge fragments and project artifacts:

- **test-quality.md** - Test design principles (Given-When-Then / AAA pattern, deterministic factories, isolation)
- **data-factories.md** - Factory patterns for DVM mock data (ToonRoutingMeta, NostrEvent, HandlerContext)
- **test-levels-framework.md** - Test level selection: Unit for isolated handler/context tests, Integration for pipeline and packet equivalence
- **Existing test patterns** - handler-registry.test.ts, handler-context.test.ts, publish-event.test.ts, create-node integration tests
- **project-context.md** - SDK Pipeline ordering, Handler Pattern, publishEvent(), Testing Rules, TypeScript strict mode

---

## Contact

**Questions or Issues?**

- Tag @jonathan in Slack/Discord
- Refer to `_bmad-output/implementation-artifacts/5-2-ilp-native-job-submission.md` for story details
- Consult `_bmad-output/project-context.md` for SDK architecture

---

**Generated by BMad TEA Agent** - 2026-03-16
