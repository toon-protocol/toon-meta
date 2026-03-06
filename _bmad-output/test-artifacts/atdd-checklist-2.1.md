---
stepsCompleted:
  [
    'step-01-preflight-and-context',
    'step-02-generation-mode',
    'step-03-test-strategy',
    'step-04-generate-tests',
    'step-05-validate-and-complete',
  ]
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-03-06'
workflowType: 'testarch-atdd'
inputDocuments:
  - _bmad-output/implementation-artifacts/2-1-relay-event-storage-handler.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/test-artifacts/test-design-epic-2.md
  - packages/sdk/src/handler-context.ts
  - packages/sdk/src/handler-registry.ts
  - packages/sdk/src/create-node.ts
  - packages/sdk/src/pricing-validator.ts
  - packages/sdk/src/verification-pipeline.ts
  - packages/core/src/toon/shallow-parse.ts
  - packages/relay/src/storage/InMemoryEventStore.ts
  - packages/relay/src/storage/SqliteEventStore.ts
---

# ATDD Checklist - Epic 2, Story 2.1: Relay Event Storage Handler

**Date:** 2026-03-06
**Author:** Jonathan
**Primary Test Level:** Integration (unit + pipeline)

---

## Story Summary

The relay BLS is reimplemented as an SDK handler that stores Nostr events via the handler registry, proving SDK completeness for the core write path. The handler itself is minimal (~15 lines) because the SDK pipeline handles all validation stages.

**As a** relay operator
**I want** the relay BLS reimplemented as an SDK handler that stores Nostr events
**So that** the existing relay functionality works on the SDK and serves as a reference for code-based handlers

---

## Acceptance Criteria

1. **AC1**: Given a `createNode()` instance with a handler registered, when a paid ILP packet arrives with a TOON-encoded Nostr event, then the handler calls `ctx.decode()` to get the structured NostrEvent, stores it in SQLite, and calls `ctx.accept()` with event metadata (eventId, storedAt)
2. **AC2**: Given the handler receives an event, when `ctx.decode()` returns a valid NostrEvent, then the event is stored with its original TOON encoding (TOON-native storage), such that encoding the retrieved event produces identical TOON bytes (roundtrip fidelity)
3. **AC3**: Given the relay node is configured with the node's own pubkey, when an event from the node's own pubkey arrives, then pricing is bypassed by the SDK (self-write) and the event is stored

---

## Failing Tests Created (RED Phase)

### Unit Tests - Approach A (5 tests)

**File:** `packages/town/src/handlers/event-storage-handler.test.ts` (488 lines)
**Describe block:** `EventStorageHandler`

These tests build a `HandlerContext` via `createTestContext()` helper and call the handler directly. They exercise handler logic in isolation, bypassing the SDK pipeline.

- **T-2.1-01** `should store event when payment meets price`
  - **Status:** RED - `createEventStorageHandler` does not exist in `@crosstown/town` yet
  - **Verifies:** AC1 -- paid ILP packet -> ctx.decode() -> SQLite store -> ctx.accept()
  - **Priority:** P0 | **Risk:** E2-R001, E2-R005

- **T-2.1-02** `should call ctx.decode() and get structured NostrEvent matching original`
  - **Status:** RED - handler implementation does not exist
  - **Verifies:** AC1/AC2 -- TOON roundtrip: all 7 NostrEvent fields match after decode
  - **Priority:** P0 | **Risk:** E2-R002

- **T-2.1-04** `should preserve TOON encoding in storage (roundtrip fidelity)`
  - **Status:** RED - handler implementation does not exist
  - **Verifies:** AC2 -- bit-exact encode->store->decode roundtrip with unicode content
  - **Priority:** P1 | **Risk:** E2-R002

- **T-2.1-05** `should return eventId and storedAt in accept response`
  - **Status:** RED - handler implementation does not exist
  - **Verifies:** AC1 -- accept response includes eventId (matching event.id) + storedAt (valid timestamp)
  - **Priority:** P1

- **T-2.1-08** `should receive ctx.toon as raw TOON string (no premature decode)`
  - **Status:** RED - handler implementation does not exist
  - **Verifies:** AC1 -- ctx.toon is base64 TOON string, no premature decode, passthrough intact after handler
  - **Priority:** P1

### Pipeline Integration Tests - Approach B (3 tests)

**File:** `packages/town/src/handlers/event-storage-handler.test.ts` (same file)
**Describe block:** `EventStorageHandler (pipeline integration)`

These tests wire a full `createNode()` with the handler registered as `defaultHandler`, then send packets through the SDK pipeline via `mockConnector.packetHandler()`. Required for testing pricing (F04) and signature (F06) validation since those happen in the SDK pipeline, not the handler.

- **T-2.1-03** `should bypass pricing for node own pubkey (self-write)`
  - **Status:** RED - `createEventStorageHandler` does not exist in `@crosstown/town` yet
  - **Verifies:** AC3 -- own pubkey writes with amount=0 through full SDK pipeline (self-write bypass in pricing validator)
  - **Priority:** P0 | **Risk:** E2-R005, E2-R006

- **T-2.1-06** `should reject insufficient payment with F04 error code`
  - **Status:** RED - handler implementation does not exist
  - **Verifies:** AC1 (negative) -- underpayment -> SDK pipeline F04 rejection, event NOT stored
  - **Priority:** P0 | **Risk:** E2-R005

- **T-2.1-07** `should reject invalid signature with F06 error code`
  - **Status:** RED - handler implementation does not exist
  - **Verifies:** Tampered event -> SDK pipeline F06 rejection (Schnorr verification), event NOT stored
  - **Priority:** P1

---

## Test Design Traceability

| ATDD Test ID | Test Name | AC | Test-Design ID | Risk Link | Priority | Approach |
|---|---|---|---|---|---|---|
| T-2.1-01 | `should store event when payment meets price` | #1 | 2.1-INT-001 | E2-R001, E2-R005 | P0 | A (unit) |
| T-2.1-02 | `should call ctx.decode() and get structured NostrEvent...` | #1,2 | 2.1-INT-002 | E2-R002 | P0 | A (unit) |
| T-2.1-03 | `should bypass pricing for node own pubkey (self-write)` | #3 | 2.1-INT-004 | E2-R005, E2-R006 | P0 | B (pipeline) |
| T-2.1-04 | `should preserve TOON encoding in storage (roundtrip fidelity)` | #2 | 2.1-INT-002 | E2-R002 | P1 | A (unit) |
| T-2.1-05 | `should return eventId and storedAt in accept response` | #1 | 2.1-INT-006 | -- | P1 | A (unit) |
| T-2.1-06 | `should reject insufficient payment with F04 error code` | #1 | 2.1-INT-003 | E2-R005 | P0 | B (pipeline) |
| T-2.1-07 | `should reject invalid signature with F06 error code` | -- | 2.1-INT-005 | -- | P1 | B (pipeline) |
| T-2.1-08 | `should receive ctx.toon as raw TOON string (no premature...)` | #1 | NEW | -- | P1 | A (unit) |

---

## Data Factories Created

### Nostr Event Factory

**File:** `packages/town/src/handlers/event-storage-handler.test.ts` (inline)

**Exports (inline functions):**

- `createValidSignedEvent(overrides?, secretKey?)` -- Create properly signed Nostr event using real nostr-tools (`finalizeEvent`). Deterministic timestamp (`TEST_CREATED_AT = 1767225600`).
- `eventToBase64Toon(event)` -- Encode event to base64 TOON wire format using real codec from `@crosstown/core/toon`
- `calculatePrice(event, basePricePerByte)` -- Compute exact price (`toonBytes.length * basePricePerByte`)

### Test Context Helper (Approach A)

**File:** `packages/town/src/handlers/event-storage-handler.test.ts` (inline)

- `createTestContext(request)` -- Build a `HandlerContext` from `{ amount, destination, data }` using `shallowParseToon` and `createHandlerContext` from SDK. Wires real TOON decoder. Bypasses SDK pipeline for unit-level tests.

### Mock Connector (Approach B)

**File:** `packages/town/src/handlers/event-storage-handler.test.ts` (inline)

- `createMockConnector()` -- Returns an `EmbeddableConnectorLike` that captures the `packetHandler` registered by `createNode()`. Pipeline tests invoke `mockConnector.packetHandler!(request)` to send packets through the full SDK pipeline.

---

## Fixtures Created

N/A -- Tests use inline setup/teardown with `beforeEach`/`afterEach`. SQLite `:memory:` store is created fresh per test. No shared fixtures needed.

---

## Mock Requirements

### Connector Transport (Mock)

Tests use a mock connector (`createMockConnector()`) that implements `EmbeddableConnectorLike`:
- `setPacketHandler(handler)` -- captures the pipeline handler wired by `createNode()`
- `sendPacket(params)` -- returns reject (not used directly; pipeline tests use `packetHandler`)
- `registerPeer(params)`, `removePeer(peerId)` -- no-ops

**No external service mocks required.** Tests use:

- Real SQLite `:memory:` (`SqliteEventStore` from `@crosstown/relay`)
- Real TOON codec (`encodeEventToToon`/`decodeEventFromToon`/`shallowParseToon` from `@crosstown/core/toon`)
- Real nostr-tools signatures (`generateSecretKey`/`getPublicKey`/`finalizeEvent`)
- Real SDK pipeline (`createNode`, `createHandlerContext`, `createPricingValidator`, `createVerificationPipeline`)

---

## Required data-testid Attributes

N/A -- Backend integration tests. No UI elements.

---

## Implementation Checklist

### Task 1: Set up `@crosstown/town` package infrastructure

**Prerequisite for all tests.**

- [ ] Create `packages/town/package.json` with `@crosstown/town`, workspace deps
- [ ] Create `packages/town/tsconfig.json` extending root
- [ ] Create `packages/town/tsup.config.ts` for ESM build
- [ ] Create `packages/town/vitest.config.ts` for per-package test execution
- [ ] Create `packages/town/src/index.ts` stub exporting `createEventStorageHandler`
- [ ] Update root `tsconfig.json` to include `packages/town`
- [ ] Update root `eslint.config.js` to include `packages/town`
- [ ] Run `pnpm install` to wire workspace dependencies
- [ ] Verify `pnpm -r list` shows `@crosstown/town`

**Estimated Effort:** 1-2 hours

---

### Task 2: Implement `createEventStorageHandler` (T-2.1-01, T-2.1-02, T-2.1-04, T-2.1-05, T-2.1-08)

**File:** `packages/town/src/handlers/event-storage-handler.ts`

**Tasks to make these 5 unit tests pass:**

- [ ] Create `packages/town/src/handlers/event-storage-handler.ts`
- [ ] Define `EventStorageHandlerConfig` interface: `{ eventStore: EventStore }`
- [ ] Implement `createEventStorageHandler(config): Handler`:
  - Call `ctx.decode()` to get `NostrEvent`
  - Store via `config.eventStore.store(event)`
  - Return `ctx.accept({ eventId: event.id, storedAt: Date.now() })`
- [ ] Export from `packages/town/src/index.ts`
- [ ] Run tests: `cd packages/town && pnpm vitest run src/handlers/event-storage-handler.test.ts`
- [ ] All 5 unit tests pass (T-2.1-01, T-2.1-02, T-2.1-04, T-2.1-05, T-2.1-08)

**Estimated Effort:** 1-2 hours

---

### Task 3: Wire pipeline tests (T-2.1-03, T-2.1-06, T-2.1-07)

**File:** `packages/town/src/handlers/event-storage-handler.test.ts`

**Tasks to make the 3 pipeline tests pass:**

- [ ] Verify `createNode()` + `defaultHandler` correctly wires the handler in the pipeline
- [ ] T-2.1-03 (self-write): Verify SDK `createPricingValidator` bypasses pricing for own pubkey
- [ ] T-2.1-06 (F04): Verify SDK pipeline rejects underpaid packets before reaching handler
- [ ] T-2.1-07 (F06): Verify SDK `createVerificationPipeline` rejects tampered signatures
- [ ] Run tests: `cd packages/town && pnpm vitest run src/handlers/event-storage-handler.test.ts`
- [ ] All 3 pipeline tests pass (T-2.1-03, T-2.1-06, T-2.1-07)

**Estimated Effort:** 1-2 hours (should pass once Task 2 is complete, since pipeline tests exercise SDK code that already works)

---

### Task 4: Update SDK stub JSDoc

**File:** `packages/sdk/src/event-storage-handler.ts`

- [ ] Update JSDoc on SDK stub to say "See `@crosstown/town` for the relay implementation"
- [ ] Do NOT move the real implementation into SDK (keep boundary: SDK = framework, Town = application)

**Estimated Effort:** 0.25 hours

---

### Task 5: Wire exports and verify build

- [ ] Export `createEventStorageHandler` and `EventStorageHandlerConfig` from `packages/town/src/index.ts`
- [ ] Run `pnpm build` -- town package builds
- [ ] Run `cd packages/town && pnpm test` -- all 8 tests pass
- [ ] Run `pnpm -r test` from root -- no regressions

**Estimated Effort:** 0.5-1 hours

---

## Running Tests

```bash
# Run all failing tests for this story
cd packages/town && pnpm vitest run src/handlers/event-storage-handler.test.ts

# Run from project root (using root vitest config aliases)
pnpm vitest run packages/town/src/handlers/event-storage-handler.test.ts

# Run with verbose output
cd packages/town && pnpm vitest run src/handlers/event-storage-handler.test.ts --reporter=verbose

# Run with coverage
cd packages/town && pnpm vitest run src/handlers/event-storage-handler.test.ts --coverage

# Run in watch mode during development
cd packages/town && pnpm vitest src/handlers/event-storage-handler.test.ts

# Run all tests in the monorepo (regression check)
pnpm test
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**

- 8 tests written and failing (5 unit + 3 pipeline integration)
- Test architecture updated from RED-phase prototype to match real SDK API:
  - Handler receives `HandlerContext` (not raw `HandlePacketRequest`)
  - Handler config simplified to `{ eventStore }` (not `{ eventStore, basePricePerByte, ownerPubkey, toonDecoder, toonEncoder }`)
  - TOON codec imported from `@crosstown/core/toon` (not `@crosstown/relay`)
  - Handler imported from local `../event-storage-handler.js` (not `@crosstown/sdk`)
  - `describe.skip` removed -- tests are enabled
- Inline factories and helpers created with real crypto and TOON codec
- Mock connector follows SDK test patterns (captures `packetHandler` for pipeline tests)
- New test T-2.1-08 added for ctx.toon passthrough verification
- Implementation checklist created with per-task granularity

**Verification:**

- Tests fail because `createEventStorageHandler` does not exist in `@crosstown/town` yet
- Failure is due to missing implementation, not test bugs
- All assertions target expected behavior

---

### GREEN Phase (DEV Team - Next Steps)

**Implementation Order (recommended):**

1. Set up `@crosstown/town` package infrastructure (Task 1)
2. Implement `createEventStorageHandler` (Task 2) -- passes all 5 unit tests
3. Verify pipeline tests pass (Task 3) -- should pass automatically once Task 2 is done
4. Update SDK stub JSDoc (Task 4)
5. Wire exports and verify build (Task 5)

**Key Principles:**

- The handler is ~15 lines of code: `ctx.decode()` -> `store()` -> `ctx.accept()`
- The SDK pipeline handles pricing, verification, self-write bypass
- One task at a time, run tests after each task

---

### REFACTOR Phase (After All Tests Pass)

1. Verify all 8 tests pass (green phase complete)
2. Review handler code for quality
3. Ensure handler follows `Handler` type signature from `@crosstown/sdk`
4. Verify no regressions across all packages (`pnpm test`)
5. Extract any shared test helpers if Story 2.2 needs similar patterns

---

## Notes

- The handler lives in `@crosstown/town`, NOT `@crosstown/sdk`. SDK has stubs, Town has implementations.
- The handler config is intentionally minimal (`{ eventStore }` only). The SDK pipeline handles pricing, verification, and self-write bypass.
- Pipeline tests (Approach B) exercise the full SDK pipeline: shallow parse -> Schnorr verify -> pricing validate -> handler dispatch. These tests validate end-to-end behavior through `createNode()` + `mockConnector.packetHandler()`.
- Unit tests (Approach A) use `createTestContext()` to build a `HandlerContext` directly, bypassing the pipeline. These test handler logic in isolation.
- The `createMockConnector()` pattern matches the SDK's own `create-node.test.ts` pattern: expose `packetHandler` field, not override `sendPacket`.
- TOON codec imports updated from `@crosstown/relay` to `@crosstown/core/toon` per Story 1.0.
- Total estimated effort: ~4-7 hours for all 8 tests to pass.

---

## Knowledge Base References Applied

- **test-quality.md** -- Given-When-Then format, one assertion per test (where practical), determinism, isolation
- **test-levels-framework.md** -- Test level selection: unit (Approach A) for handler logic, integration (Approach B) for SDK pipeline + handler
- **data-factories.md** -- Factory patterns for test data (createValidSignedEvent, eventToBase64Toon, calculatePrice)

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `cd packages/town && pnpm vitest run src/handlers/event-storage-handler.test.ts`

**Expected Results:**

```
Tests fail because createEventStorageHandler does not exist in @crosstown/town yet.
Import error: Cannot find module '../event-storage-handler.js'
```

**Summary:**

- Total tests: 8
- Passing: 0 (expected)
- Failing: 8 (expected -- import failure, module not yet created)
- Status: RED phase verified

---

## Contact

**Questions or Issues?**

- Refer to `_bmad-output/implementation-artifacts/2-1-relay-event-storage-handler.md` for full implementation guidance
- Refer to `packages/sdk/src/create-node.test.ts` for mock connector pattern reference
- Refer to `packages/sdk/src/handler-context.test.ts` for HandlerContext test patterns

---

**Generated by BMad TEA Agent** - 2026-03-06
