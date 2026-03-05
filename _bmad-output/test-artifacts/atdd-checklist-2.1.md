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
lastSaved: '2026-03-04'
workflowType: 'testarch-atdd'
inputDocuments:
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/test-artifacts/test-design-epic-2.md
  - packages/town/src/handlers/event-storage-handler.test.ts
---

# ATDD Checklist - Epic 2, Story 2.1: Relay Event Storage Handler

**Date:** 2026-03-04
**Author:** Jonathan
**Primary Test Level:** Integration

---

## Story Summary

The relay BLS is reimplemented as an SDK handler that stores Nostr events via the handler registry, proving SDK completeness for the core write path.

**As a** relay operator
**I want** the relay BLS reimplemented as an SDK handler that stores Nostr events
**So that** the existing relay functionality works on the SDK and serves as a reference for code-based handlers

---

## Acceptance Criteria

1. **AC1**: Given a `createNode()` instance with a handler registered, when a paid ILP packet arrives with a TOON-encoded Nostr event, then the handler calls `ctx.decode()` to get the structured NostrEvent, stores it in SQLite, and calls `ctx.accept()` with event metadata
2. **AC2**: Given the handler receives an event, when `ctx.decode()` returns a valid NostrEvent, then the event is stored with its original TOON encoding (TOON-native storage)
3. **AC3**: Given the relay node is configured with the node's own pubkey, when an event from the node's own pubkey arrives, then pricing is bypassed (self-write) and the event is stored

---

## Failing Tests Created (RED Phase)

### Integration Tests (7 tests)

**File:** `packages/town/src/handlers/event-storage-handler.test.ts` (313 lines)

- **Test:** `should store event when payment meets price`
  - **Status:** RED - `@crosstown/sdk` does not exist (import fails)
  - **Verifies:** AC1 — paid ILP packet → ctx.decode() → SQLite store → ctx.accept()
  - **Priority:** P0 | **Risk:** E2-R001, E2-R005

- **Test:** `should call ctx.decode() and get structured NostrEvent matching original`
  - **Status:** RED - SDK handler context API does not exist
  - **Verifies:** AC1/AC2 — TOON roundtrip: all NostrEvent fields match after decode
  - **Priority:** P0 | **Risk:** E2-R002

- **Test:** `should bypass pricing for node own pubkey (self-write)`
  - **Status:** RED - SDK self-write bypass not implemented
  - **Verifies:** AC3 — own pubkey writes with amount=0
  - **Priority:** P0 | **Risk:** E2-R005, E2-R006

- **Test:** `should preserve TOON encoding in storage (roundtrip fidelity)`
  - **Status:** RED - SDK TOON-native storage not built
  - **Verifies:** AC2 — bit-exact encode→store→decode roundtrip
  - **Priority:** P1 | **Risk:** E2-R002

- **Test:** `should return eventId and storedAt in accept response`
  - **Status:** RED - ctx.accept() metadata shape not implemented
  - **Verifies:** AC1 — accept response includes eventId + storedAt
  - **Priority:** P1

- **Test:** `should reject insufficient payment with F04 error code`
  - **Status:** RED - SDK handler error codes not defined
  - **Verifies:** AC1 (negative) — underpayment → F04 rejection
  - **Priority:** P0 | **Risk:** E2-R005

- **Test:** `should reject invalid signature with F06 error code`
  - **Status:** RED - SDK handler signature validation not implemented
  - **Verifies:** Tampered event → F06 rejection, event NOT stored
  - **Priority:** P1

---

## Data Factories Created

### Nostr Event Factory

**File:** `packages/town/src/handlers/event-storage-handler.test.ts` (inline)

**Exports (inline functions):**

- `createValidSignedEvent(overrides?, secretKey?)` — Create properly signed Nostr event using real nostr-tools
- `eventToBase64Toon(event)` — Encode event to base64 TOON wire format
- `createPacketRequest(event, amount, destination?)` — Build HandlePacketRequest
- `calculatePrice(event, basePricePerByte)` — Compute exact price (toonBytes.length \* basePricePerByte)

---

## Fixtures Created

N/A — Tests use inline setup/teardown with `beforeEach`/`afterEach`. SQLite :memory: store is created fresh per test.

---

## Mock Requirements

### Connector Transport (Implicit)

The `createEventStorageHandler()` function from `@crosstown/sdk` abstracts the connector transport. The handler receives a `HandlePacketRequest` directly — no HTTP or WebSocket transport mock is needed.

**No external service mocks required.** Tests use:

- Real SQLite :memory: (EventStore)
- Real TOON codec (encodeEventToToon/decodeEventFromToon from @crosstown/relay)
- Real nostr-tools signatures (generateSecretKey/getPublicKey/finalizeEvent)

---

## Required data-testid Attributes

N/A — Backend integration tests. No UI elements.

---

## Implementation Checklist

### Test: `should store event when payment meets price`

**File:** `packages/town/src/handlers/event-storage-handler.test.ts`

**Tasks to make this test pass:**

- [ ] Create `packages/sdk/src/handlers/event-storage-handler.ts`
- [ ] Export `createEventStorageHandler(config: EventStorageHandlerConfig)` from `@crosstown/sdk`
- [ ] Implement handler: decode base64 data → TOON decode → verify signature → check pricing → store in EventStore → return accept
- [ ] Export `EventStorageHandlerConfig` type with `eventStore`, `basePricePerByte`, `ownerPubkey`, `toonDecoder`, `toonEncoder`
- [ ] Export `HandlerContext` type from `@crosstown/sdk`
- [ ] Run test: `cd packages/town && pnpm vitest run src/handlers/event-storage-handler.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 3-4 hours

---

### Test: `should call ctx.decode() and get structured NostrEvent matching original`

**File:** `packages/town/src/handlers/event-storage-handler.test.ts`

**Tasks to make this test pass:**

- [ ] Ensure `ctx.decode()` uses real TOON decoder (injected via config)
- [ ] Verify all NostrEvent fields preserved: id, pubkey, kind, content, tags, created_at, sig
- [ ] Run test: `cd packages/town && pnpm vitest run src/handlers/event-storage-handler.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 1-2 hours (mostly covered by first test implementation)

---

### Test: `should bypass pricing for node own pubkey (self-write)`

**File:** `packages/town/src/handlers/event-storage-handler.test.ts`

**Tasks to make this test pass:**

- [ ] Add self-write bypass logic: if `ctx.pubkey === config.ownerPubkey`, skip pricing validation
- [ ] Ensure event is still stored even with amount=0
- [ ] Return accept with eventId in metadata
- [ ] Run test: `cd packages/town && pnpm vitest run src/handlers/event-storage-handler.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 0.5-1 hours

---

### Test: `should preserve TOON encoding in storage (roundtrip fidelity)`

**File:** `packages/town/src/handlers/event-storage-handler.test.ts`

**Tasks to make this test pass:**

- [ ] Ensure EventStore preserves event data such that re-encoding produces identical TOON bytes
- [ ] Verify no lossy JSON intermediate during storage/retrieval
- [ ] Run test: `cd packages/town && pnpm vitest run src/handlers/event-storage-handler.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 1-2 hours

---

### Test: `should return eventId and storedAt in accept response`

**File:** `packages/town/src/handlers/event-storage-handler.test.ts`

**Tasks to make this test pass:**

- [ ] Return `{ accept: true, metadata: { eventId: event.id, storedAt: Date.now() } }` from handler
- [ ] Run test: `cd packages/town && pnpm vitest run src/handlers/event-storage-handler.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 0.5 hours

---

### Test: `should reject insufficient payment with F04 error code`

**File:** `packages/town/src/handlers/event-storage-handler.test.ts`

**Tasks to make this test pass:**

- [ ] Implement pricing validation: `toonData.length * basePricePerByte` vs `request.amount`
- [ ] Return `{ accept: false, code: 'F04', message: 'Insufficient...', metadata: { required, received } }` on underpayment
- [ ] Ensure event is NOT stored on rejection
- [ ] Run test: `cd packages/town && pnpm vitest run src/handlers/event-storage-handler.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 1-2 hours

---

### Test: `should reject invalid signature with F06 error code`

**File:** `packages/town/src/handlers/event-storage-handler.test.ts`

**Tasks to make this test pass:**

- [ ] Implement Schnorr signature verification using `nostr-tools/pure` `verifyEvent()`
- [ ] Return `{ accept: false, code: 'F06', message: '...signature...' }` on invalid signature
- [ ] Ensure event is NOT stored on rejection
- [ ] Run test: `cd packages/town && pnpm vitest run src/handlers/event-storage-handler.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 1-2 hours

---

## Running Tests

```bash
# Run all failing tests for this story
cd packages/town && pnpm vitest run src/handlers/event-storage-handler.test.ts

# Run with verbose output
cd packages/town && pnpm vitest run src/handlers/event-storage-handler.test.ts --reporter=verbose

# Run with coverage
cd packages/town && pnpm vitest run src/handlers/event-storage-handler.test.ts --coverage

# Run in watch mode during development
cd packages/town && pnpm vitest src/handlers/event-storage-handler.test.ts
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**

- All 7 tests written and failing (describe.skip)
- Inline factories created with real crypto and TOON codec
- No external mocks needed (real SQLite :memory:, real nostr-tools)
- Implementation checklist created with per-test tasks

**Verification:**

- Tests skip due to `@crosstown/sdk` import failure
- Failure is due to missing implementation, not test bugs
- All assertions target expected behavior

---

### GREEN Phase (DEV Team - Next Steps)

**Implementation Order (recommended):**

1. Create `@crosstown/sdk` package with `createEventStorageHandler` export
2. Implement basic handler (decode + store + accept) → passes first 2 tests
3. Add pricing validation → passes F04 rejection test
4. Add self-write bypass → passes self-write test
5. Add signature verification → passes F06 rejection test
6. Add response metadata → passes metadata test
7. Verify TOON fidelity → passes roundtrip test

**Key Principle:** Remove `describe.skip` → `describe` once `@crosstown/sdk` exists. Work one test at a time.

---

### REFACTOR Phase (After All Tests Pass)

1. Extract shared handler utilities (pricing calc, signature check) to SDK core
2. Ensure handler is composable (can be used with `createNode().on(kind, handler)`)
3. Verify all tests still pass after each refactor

---

## Notes

- Tests use real `SqliteEventStore` from `@crosstown/relay` — ensure this dependency is available in `@crosstown/town`
- `encodeEventToToon`/`decodeEventFromToon` from `@crosstown/relay` — per architecture, TOON codec moves to `@crosstown/core` in Story 1.0
- The `createEventStorageHandler` function should accept config via DI (injected encoder/decoder, not imported directly) to support the TOON codec relocation
- Total estimated effort: ~8-12 hours for all 7 tests to pass

---

**Generated by BMad TEA Agent** - 2026-03-04
