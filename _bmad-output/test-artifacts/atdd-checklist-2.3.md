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
  - packages/client/tests/e2e/sdk-relay-validation.test.ts
---

# ATDD Checklist - Epic 2, Story 2.3: E2E Test Validation

**Date:** 2026-03-04
**Author:** Jonathan
**Primary Test Level:** E2E

---

## Story Summary

All existing E2E tests pass when running against the SDK-based relay, proving the SDK is a complete replacement for the manual wiring in docker/src/entrypoint.ts.

**As a** SDK developer
**I want** all existing E2E tests to pass against the SDK-based relay
**So that** the SDK is proven to be a complete replacement for manual wiring

---

## Acceptance Criteria

1. **AC1**: Given the SDK-based relay deployed as genesis node, when existing E2E tests run, then all tests pass including bootstrap, payment channel creation, and event publishing
2. **AC2**: Given the SDK-based relay entrypoint, when compared to original entrypoint.ts, then handler registrations are significantly shorter (< 100 lines)
3. **AC3**: Given genesis-bootstrap-with-channels.test.ts, when run against SDK relay, then bootstrap succeeds, balance proofs are generated, events publish, on-chain state is validated

---

## Failing Tests Created (RED Phase)

### E2E Tests (6 tests)

**File:** `packages/client/tests/e2e/sdk-relay-validation.test.ts` (675 lines)

- **Test:** `should bootstrap with payment channel creation against SDK-based relay`
  - **Status:** RED - @crosstown/town does not exist
  - **Verifies:** AC1/AC3 — full bootstrap → channel created → on-chain state open → correct participants
  - **Priority:** P0 | **Risk:** E2-R001

- **Test:** `should publish event with ILP payment and verify on relay`
  - **Status:** RED - SDK handler registry does not exist
  - **Verifies:** AC1/AC3 — sign event → balance proof → publish → verify on relay via WebSocket
  - **Priority:** P0 | **Risk:** E2-R001

- **Test:** `should verify on-chain channel state (open, correct participants)`
  - **Status:** RED - SDK SPSP handler does not exist
  - **Verifies:** AC3 — all tracked channels open, correct participants, positive settlementTimeout
  - **Priority:** P0 | **Risk:** E2-R004

- **Test:** `should verify signed balance proof generation`
  - **Status:** RED - SDK pricing pipeline does not exist
  - **Verifies:** AC3 — incremental nonces, cumulative amounts, relay accepts payment
  - **Priority:** P1

- **Test:** `should accept events from node own pubkey without payment (self-write)`
  - **Status:** RED - SDK self-write bypass does not exist
  - **Verifies:** AC1 — genesis node's kind:10032 event stored without ILP payment
  - **Priority:** P1

- **Test:** `should handle SPSP handshake through SDK handler (not manual BLS wiring)`
  - **Status:** RED - SDK handler registry for kind:23194 does not exist
  - **Verifies:** AC1 — bootstrap triggers SPSP → channels opened → BLS health reports SDK mode
  - **Priority:** P1

### Static Analysis Tests (1 test)

- **Test:** `SDK relay entrypoint should be < 100 lines of handler code`
  - **Status:** RED - @crosstown/town package does not exist
  - **Verifies:** AC2 — entrypoint line count < 100 (vs ~300 in original)
  - **Priority:** P2

---

## Data Factories Created

### E2E Test Client Factory

**File:** `packages/client/tests/e2e/sdk-relay-validation.test.ts` (inline)

**Exports (inline functions):**

- `createTestClient(secretKey, pubkey)` — CrosstownClient configured for genesis node E2E testing
- `waitForEventOnRelay(relayUrl, eventId, timeoutMs?)` — Subscribe via NIP-01 WebSocket, decode TOON response
- `getChannelState(channelId)` — Query TokenNetwork contract on Anvil for on-chain channel state

---

## Mock Requirements

**No mocks.** All E2E tests run against real infrastructure:

- Real Anvil blockchain at :8545 (deterministic contract addresses)
- Real Faucet at :3500 (ETH + AGENT token)
- Real ILP Connector at :8080
- Real Nostr Relay at :7100 (TOON-native)
- Real BLS at :3100

**Prerequisites:** `deploy-genesis-node.sh` must have been run with the SDK-based relay (@crosstown/town).

---

## Required data-testid Attributes

N/A — Backend E2E tests via API/WebSocket. No browser UI.

---

## Implementation Checklist

### Test: `should bootstrap with payment channel creation against SDK-based relay`

**File:** `packages/client/tests/e2e/sdk-relay-validation.test.ts`

**Tasks to make this test pass:**

- [ ] Complete Story 2.1 (event storage handler)
- [ ] Complete Story 2.2 (SPSP handshake handler)
- [ ] Create `packages/town/src/index.ts` with `startTown(config)` function
- [ ] Wire event storage handler and SPSP handler into createNode()
- [ ] Update `deploy-genesis-node.sh` to use @crosstown/town instead of docker/src/entrypoint.ts
- [ ] Deploy SDK-based genesis node
- [ ] Run test: `cd packages/client && pnpm vitest run tests/e2e/sdk-relay-validation.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 4-6 hours (depends on Stories 2.1 + 2.2 completion)

---

### Test: `should publish event with ILP payment and verify on relay`

**Tasks to make this test pass:**

- [ ] Ensure SDK relay's event storage handler correctly processes ILP payments
- [ ] Ensure relay returns TOON-encoded events via NIP-01 WebSocket
- [ ] Verify published event is retrievable by ID
- [ ] Run test
- [ ] Test passes (green phase)

**Estimated Effort:** 1-2 hours (mostly covered by Story 2.1 implementation)

---

### Test: `should verify on-chain channel state (open, correct participants)`

**Tasks to make this test pass:**

- [ ] Ensure SPSP handler opens channels on Anvil during bootstrap
- [ ] Channel state queryable via TokenNetwork contract
- [ ] Participants match test account and genesis node
- [ ] Run test
- [ ] Test passes (green phase)

**Estimated Effort:** 1-2 hours (covered by Story 2.2 implementation)

---

### Test: `should verify signed balance proof generation`

**Tasks to make this test pass:**

- [ ] Ensure SDK relay accepts ILP packets with signed balance proof claims
- [ ] Sequential nonces accepted (1, 2, ...)
- [ ] Event published with second claim succeeds
- [ ] Run test
- [ ] Test passes (green phase)

**Estimated Effort:** 1-2 hours

---

### Test: `should accept events from node own pubkey without payment (self-write)`

**Tasks to make this test pass:**

- [ ] Ensure SDK-based genesis node publishes its own kind:10032 event during startup (self-write bypass)
- [ ] Event retrievable via WebSocket NIP-01 query
- [ ] Event contains valid ILP peer info (ilpAddress, btpEndpoint)
- [ ] Run test
- [ ] Test passes (green phase)

**Estimated Effort:** 1-2 hours (self-write bypass from Story 2.1)

---

### Test: `should handle SPSP handshake through SDK handler (not manual BLS wiring)`

**Tasks to make this test pass:**

- [ ] Add `sdk: true` field to BLS health endpoint response in SDK-based relay
- [ ] Ensure SPSP handshake works through SDK handler registry (kind:23194 routing)
- [ ] Channel opened during bootstrap via SDK handler
- [ ] Run test
- [ ] Test passes (green phase)

**Estimated Effort:** 1-2 hours

---

### Test: `SDK relay entrypoint should be < 100 lines of handler code`

**Tasks to make this test pass:**

- [ ] Create `packages/town/src/index.ts` with `startTown()` function
- [ ] Keep handler registration code concise (leveraging SDK's createNode() + .on() pattern)
- [ ] Verify non-blank, non-comment, non-import lines < 100
- [ ] Run test
- [ ] Test passes (green phase)

**Estimated Effort:** 2-3 hours (part of startTown() implementation in Story 2.5)

---

## Running Tests

```bash
# Run all failing tests for this story (requires genesis node running)
cd packages/client && pnpm vitest run tests/e2e/sdk-relay-validation.test.ts

# Deploy SDK-based genesis node first
./deploy-genesis-node.sh

# Run with verbose output
cd packages/client && pnpm vitest run tests/e2e/sdk-relay-validation.test.ts --reporter=verbose

# Run specific test
cd packages/client && pnpm vitest run tests/e2e/sdk-relay-validation.test.ts -t "should bootstrap"
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

- All 7 tests written and failing (describe.skip)
- Real E2E infrastructure (Anvil, Faucet, Connector, Relay)
- No mocks — full end-to-end validation
- Health checks with graceful skip if infrastructure not ready

### GREEN Phase (DEV Team)

**Prerequisites:**

1. Stories 2.1 + 2.2 must be GREEN first (integration tests passing)
2. `startTown()` function created (Story 2.5 partial)
3. Genesis node redeployed with @crosstown/town

**Implementation Order:**

1. Deploy SDK relay → bootstrap test passes
2. Verify publish → publish test passes
3. Verify channels → channel state test passes
4. Verify balance proofs → balance proof test passes
5. Verify self-write → self-write test passes
6. Verify SDK health → SPSP test passes
7. Verify entrypoint size → line count test passes

### REFACTOR Phase

- Clean up startTown() function for minimal code
- Ensure Docker image build works with SDK relay
- Verify original genesis-bootstrap-with-channels.test.ts also passes

---

## Notes

- This story is a validation gate: it only passes when Stories 2.1 + 2.2 are complete
- The E2E tests use real CrosstownClient from @crosstown/client — no SDK-specific client needed
- The `servicesReady` flag allows graceful degradation if infrastructure isn't deployed
- Each test has a 60-second timeout (blockchain operations can be slow)
- The line count test is the only non-runtime test (reads source files directly)
- Total estimated effort: ~11-19 hours (largely dependent on Story 2.1 + 2.2 completion)

---

**Generated by BMad TEA Agent** - 2026-03-04
