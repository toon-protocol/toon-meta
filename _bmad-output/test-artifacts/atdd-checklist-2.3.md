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
  - _bmad-output/implementation-artifacts/2-3-e2e-test-validation.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/test-artifacts/test-design-epic-2.md
  - packages/client/tests/e2e/sdk-relay-validation.test.ts
  - packages/client/tests/e2e/genesis-bootstrap-with-channels.test.ts
---

# ATDD Checklist - Epic 2, Story 2.3: E2E Test Validation

**Date:** 2026-03-06
**Author:** Jonathan
**Primary Test Level:** E2E
**Detected Stack:** backend (Node.js/TypeScript monorepo, vitest)

---

## Story Summary

All existing E2E tests pass when running against the SDK-based relay, proving the SDK is a complete replacement for the manual wiring in docker/src/entrypoint.ts.

**As a** SDK developer
**I want** all existing E2E tests to pass against the SDK-based relay
**So that** the SDK is proven to be a complete replacement for manual wiring

**FRs covered:** FR-SDK-15

**Dependencies:** Stories 2.1 (Event Storage Handler -- done), 2.2 (SPSP Handshake Handler -- done)

---

## Acceptance Criteria

1. **AC1**: Given the SDK-based relay deployed as genesis node, when existing E2E tests run (`pnpm test:e2e`), then all tests pass including bootstrap, payment channel creation, and event publishing
2. **AC2**: Given the SDK-based relay entrypoint (`docker/src/entrypoint-town.ts`), when compared to original `docker/src/entrypoint.ts`, then handler registrations are < 100 lines of handler logic (non-blank, non-comment, non-import)
3. **AC3**: Given `genesis-bootstrap-with-channels.test.ts`, when run against SDK relay, then bootstrap succeeds, balance proofs are generated, events publish, on-chain state is validated

---

## Failing Tests Created (RED Phase)

### E2E Tests (6 tests)

**File:** `packages/client/tests/e2e/sdk-relay-validation.test.ts` (720 lines)

- **Test:** T-2.3-01 `should bootstrap with payment channel creation against SDK-based relay`
  - **Status:** RED - describe.skip; docker/src/entrypoint-town.ts does not exist
  - **Verifies:** AC1/AC3 -- full bootstrap -> channel created -> on-chain state open -> correct participants
  - **Priority:** P0 | **Risk:** E2-R08 (score 9)

- **Test:** T-2.3-02 `should publish event with ILP payment and verify on relay`
  - **Status:** RED - describe.skip; SDK-based relay not deployed
  - **Verifies:** AC1/AC3 -- sign event -> balance proof -> publish -> verify on relay via WebSocket
  - **Priority:** P0 | **Risk:** E2-R08

- **Test:** T-2.3-03 `should verify on-chain channel state (open, correct participants)`
  - **Status:** RED - describe.skip; SDK SPSP handler not wired to Docker entrypoint
  - **Verifies:** AC3 -- all tracked channels open, correct participants, positive settlementTimeout, closedAt=0
  - **Priority:** P0 | **Risk:** E2-R08

- **Test:** T-2.3-04 `should verify signed balance proof generation`
  - **Status:** RED - describe.skip; SDK pricing pipeline not wired to Docker entrypoint
  - **Verifies:** AC3 -- incremental nonces (1, 2), cumulative amounts, relay accepts payment
  - **Priority:** P0 | **Risk:** E2-R08

- **Test:** T-2.3-05 `should accept events from node own pubkey without payment (self-write)`
  - **Status:** RED - describe.skip; SDK self-write bypass not wired
  - **Verifies:** AC1 -- genesis node's kind:10032 event stored without ILP payment, contains valid ILP peer info
  - **Priority:** P1 | **Risk:** E2-R08

- **Test:** T-2.3-06 `should handle SPSP handshake through SDK handler (not manual BLS wiring)`
  - **Status:** RED - describe.skip; SDK handler registry for kind:23194 not wired; `/health` lacks `sdk: true`
  - **Verifies:** AC1 -- bootstrap triggers SPSP -> channels opened -> BLS health reports `sdk: true`
  - **Priority:** P1 | **Risk:** E2-R05

### Static Analysis Tests (1 test)

- **Test:** T-2.3-07 `SDK relay entrypoint should be < 100 lines of handler code`
  - **Status:** RED - describe.skip; `docker/src/entrypoint-town.ts` does not exist
  - **Verifies:** AC2 -- entrypoint line count < 100 (vs ~300 in original), < 50% of old entrypoint
  - **Priority:** P1 | **Risk:** E2-R08
  - **Note:** Reads `docker/src/entrypoint-town.ts` (updated from previous path of `packages/town/src/index.ts` -- see ATDD revision 2026-03-06)

### Existing E2E Test (must pass unchanged)

- **Test:** T-2.3-EXIST `genesis-bootstrap-with-channels.test.ts`
  - **File:** `packages/client/tests/e2e/genesis-bootstrap-with-channels.test.ts` (389 lines)
  - **Status:** Currently GREEN against old entrypoint; must remain GREEN against SDK-based relay
  - **Verifies:** AC1/AC3 -- bootstrap, channel creation, event publishing, on-chain state
  - **Priority:** P0 | **Risk:** E2-R08 (score 9, highest risk)

---

## Test Design Traceability

| ATDD Test ID | Test Name | AC | Test-Design ID | Risk Link | Priority | Level |
|---|---|---|---|---|---|---|
| T-2.3-01 | Bootstrap with payment channel creation | #1, #3 | 2.3-E2E-001 | E2-R08 | P0 | E2E |
| T-2.3-02 | Publish event with ILP payment and verify on relay | #1, #3 | 2.3-E2E-001 | E2-R08 | P0 | E2E |
| T-2.3-03 | Verify on-chain channel state (open, correct participants) | #3 | 2.3-E2E-001 | E2-R08 | P0 | E2E |
| T-2.3-04 | Verify signed balance proof generation | #3 | 2.3-E2E-001 | E2-R08 | P0 | E2E |
| T-2.3-05 | Self-write bypass (node's own kind:10032 event) | #1 | 2.3-E2E-002 | E2-R08 | P1 | E2E |
| T-2.3-06 | SPSP handshake through SDK handler | #1, #3 | 2.3-E2E-003 | E2-R05 | P1 | E2E |
| T-2.3-07 | SDK relay entrypoint < 100 lines of handler code | #2 | 2.3-CODE-001 | E2-R08 | P1 | Static |
| T-2.3-EXIST | genesis-bootstrap-with-channels.test.ts passes | #1, #3 | 2.3-E2E-001 | E2-R08 | P0 | E2E |

---

## Data Factories Created

### E2E Test Client Factory

**File:** `packages/client/tests/e2e/sdk-relay-validation.test.ts` (inline)

**Exports (inline functions):**

- `createTestClient(secretKey, pubkey)` -- CrosstownClient configured for genesis node E2E testing with EVM channels
- `waitForEventOnRelay(relayUrl, eventId, timeoutMs?)` -- Subscribe via NIP-01 WebSocket, decode TOON response
- `getChannelState(channelId)` -- Query TokenNetwork contract on Anvil for on-chain channel state

**Note:** These are inline helper functions, not separate factory files, consistent with the existing test pattern in `genesis-bootstrap-with-channels.test.ts`. No `@faker-js/faker` is needed since test data uses cryptographic key generation (`generateSecretKey()`, `getPublicKey()`) and timestamps (`Date.now()`), which are inherently unique per run.

---

## Fixtures Created

N/A -- E2E tests use vitest `beforeAll`/`afterAll` hooks with inline setup/teardown. The `servicesReady` flag pattern provides graceful skip when infrastructure is not deployed. Each test creates its own client keypair for isolation.

---

## Mock Requirements

**No mocks.** All E2E tests run against real infrastructure:

- Real Anvil blockchain at :8545 (deterministic contract addresses)
- Real Faucet at :3500 (ETH + AGENT token)
- Real ILP Connector at :8080 (BTP WebSocket + Admin API)
- Real Nostr Relay at :7100 (TOON-native, NIP-01 WebSocket)
- Real BLS at :3100 (HTTP /health + /handle-packet)

**Prerequisites:** `deploy-genesis-node.sh` must have been run with the SDK-based relay (using `docker/src/entrypoint-town.ts`).

---

## Required data-testid Attributes

N/A -- Backend E2E tests via API/WebSocket/HTTP. No browser UI.

---

## Implementation Checklist

### Test: T-2.3-01 `should bootstrap with payment channel creation against SDK-based relay`

**File:** `packages/client/tests/e2e/sdk-relay-validation.test.ts`

**Tasks to make this test pass:**

- [x] Complete Story 2.1 (event storage handler) -- DONE
- [x] Complete Story 2.2 (SPSP handshake handler) -- DONE
- [ ] Create `docker/src/entrypoint-town.ts` -- SDK-based Docker entrypoint (Approach A: individual SDK components)
- [ ] Wire SDK pipeline: size check -> shallow TOON parse -> Schnorr verify -> pricing validate -> kind-based dispatch via `HandlerRegistry`
- [ ] Import handlers from `@crosstown/town` (NOT from `@crosstown/sdk` which has throwing stubs)
- [ ] Update `docker/Dockerfile` to include `@crosstown/sdk` and `@crosstown/town` packages
- [ ] Update `docker/package.json` dependencies
- [ ] Update Dockerfile CMD to point to new entrypoint
- [ ] Deploy SDK-based genesis node: `./deploy-genesis-node.sh`
- [ ] Change `describe.skip(...)` to `describe(...)` in test file
- [ ] Run test: `cd packages/client && pnpm test:e2e sdk-relay-validation`
- [ ] Test passes (green phase)

**Estimated Effort:** 4-6 hours

---

### Test: T-2.3-02 `should publish event with ILP payment and verify on relay`

**Tasks to make this test pass:**

- [ ] Ensure SDK relay's event storage handler correctly processes ILP payments via SDK pipeline
- [ ] Ensure relay returns TOON-encoded events via NIP-01 WebSocket
- [ ] Verify published event is retrievable by ID
- [ ] Run test
- [ ] Test passes (green phase)

**Estimated Effort:** 1-2 hours (mostly covered by entrypoint wiring in T-2.3-01)

---

### Test: T-2.3-03 `should verify on-chain channel state (open, correct participants)`

**Tasks to make this test pass:**

- [ ] Ensure SPSP handler opens channels on Anvil during bootstrap
- [ ] Channel state queryable via TokenNetwork contract (open, participants, settlementTimeout, closedAt=0)
- [ ] Participants match test account and genesis node
- [ ] Run test
- [ ] Test passes (green phase)

**Estimated Effort:** 1-2 hours (covered by SPSP handler wiring in entrypoint)

---

### Test: T-2.3-04 `should verify signed balance proof generation`

**Tasks to make this test pass:**

- [ ] Ensure SDK relay accepts ILP packets with signed balance proof claims
- [ ] Sequential nonces accepted (1, 2)
- [ ] Event published with second claim succeeds
- [ ] Run test
- [ ] Test passes (green phase)

**Estimated Effort:** 1-2 hours

---

### Test: T-2.3-05 `should accept events from node own pubkey without payment (self-write)`

**Tasks to make this test pass:**

- [ ] Ensure SDK pricing validator has self-write bypass (`ctx.pubkey === node.pubkey`)
- [ ] Ensure genesis node publishes its own kind:10032 event during bootstrap startup
- [ ] Event retrievable via WebSocket NIP-01 query (kind:10032, author:GENESIS_PUBKEY)
- [ ] Event contains valid ILP peer info (ilpAddress, btpEndpoint in content JSON)
- [ ] Run test
- [ ] Test passes (green phase)

**Estimated Effort:** 1-2 hours

---

### Test: T-2.3-06 `should handle SPSP handshake through SDK handler (not manual BLS wiring)`

**Tasks to make this test pass:**

- [ ] Add `sdk: true` field to `/health` JSON response in SDK-based entrypoint
- [ ] Ensure SPSP handshake works through SDK `HandlerRegistry` (kind:23194 routing to `createSpspHandshakeHandler`)
- [ ] Channel opened during bootstrap via SDK handler
- [ ] BLS health endpoint check for `sdk: true`
- [ ] Run test
- [ ] Test passes (green phase)

**Estimated Effort:** 1-2 hours

---

### Test: T-2.3-07 `SDK relay entrypoint should be < 100 lines of handler code`

**Tasks to make this test pass:**

- [ ] Create `docker/src/entrypoint-town.ts` using Approach A (individual SDK components)
- [ ] Keep handler registration and pipeline code concise (leveraging SDK components)
- [ ] Verify non-blank, non-comment, non-import lines < 100
- [ ] Verify < 50% of old entrypoint's non-blank, non-comment, non-import line count
- [ ] Run test
- [ ] Test passes (green phase)

**Estimated Effort:** 2-3 hours (part of entrypoint creation)

---

### Test: T-2.3-EXIST `genesis-bootstrap-with-channels.test.ts passes`

**Tasks to make this test pass:**

- [ ] Deploy SDK-based relay as genesis node
- [ ] Run `cd packages/client && pnpm test:e2e genesis-bootstrap-with-channels`
- [ ] Confirm all assertions pass unchanged:
  - Client bootstrap succeeds (`startResult.mode === 'http'`)
  - Payment channels created during bootstrap
  - On-chain channel state is 'open' with correct participants
  - Nostr event published with ILP payment succeeds
  - Event retrievable from relay via WebSocket subscription
- [ ] Document any behavioral differences from the old entrypoint

**Estimated Effort:** 1-2 hours (deploy + run + verify)

---

## Running Tests

```bash
# Deploy SDK-based genesis node first
./deploy-genesis-node.sh

# Run all SDK-specific E2E tests (requires genesis node running)
cd packages/client && pnpm test:e2e sdk-relay-validation

# Run the existing equivalence test (must also pass)
cd packages/client && pnpm test:e2e genesis-bootstrap-with-channels

# Run all E2E tests
cd packages/client && pnpm test:e2e

# Run with verbose output
cd packages/client && pnpm vitest run --config vitest.e2e.config.ts --reporter=verbose

# Run specific test by name
cd packages/client && pnpm vitest run --config vitest.e2e.config.ts -t "should bootstrap"

# Run full test suite (unit + integration, no E2E)
pnpm test

# Run full quality checks
pnpm build && pnpm test && pnpm lint && pnpm format:check
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**

- All 7 SDK-specific tests written and in describe.skip
- T-2.3-07 line count test path corrected to docker/src/entrypoint-town.ts (updated 2026-03-06)
- Multi-line comment patterns added to line counting filter (updated 2026-03-06)
- Real E2E infrastructure (Anvil, Faucet, Connector, Relay)
- No mocks -- full end-to-end validation
- Health checks with graceful skip if infrastructure not ready
- Existing genesis-bootstrap-with-channels.test.ts already passing (equivalence baseline)

**Verification:**

- All 7 tests are in `describe.skip` and will fail if unskipped (no SDK-based relay deployed)
- Failure messages are clear and actionable (point to missing entrypoint or infrastructure)
- Tests fail due to missing implementation, not test bugs

---

### GREEN Phase (DEV Team - Next Steps)

**Prerequisites:**

1. Stories 2.1 + 2.2 are GREEN (done)
2. `docker/src/entrypoint-town.ts` created with SDK pipeline (Approach A)
3. Docker image rebuilt with SDK and Town packages
4. Genesis node redeployed with SDK-based entrypoint

**Implementation Order:**

1. Create `docker/src/entrypoint-town.ts` (Task 1 from story)
2. Update Docker build (Task 2 from story)
3. Update docker-compose (Task 3 from story)
4. Deploy SDK relay: `./deploy-genesis-node.sh`
5. Change `describe.skip` to `describe` in `sdk-relay-validation.test.ts` (Task 4)
6. Run tests in order:
   - T-2.3-01: Bootstrap test passes
   - T-2.3-02: Publish test passes
   - T-2.3-03: Channel state test passes
   - T-2.3-04: Balance proof test passes
   - T-2.3-05: Self-write test passes
   - T-2.3-06: SPSP/SDK health test passes
   - T-2.3-07: Line count test passes
7. Verify T-2.3-EXIST: `genesis-bootstrap-with-channels.test.ts` passes (Task 5)
8. Run full test suite (Task 6)

**Key Principles:**

- One test at a time (do not try to fix all at once)
- Minimal implementation (do not over-engineer)
- Run tests frequently (immediate feedback)
- Use implementation checklist as roadmap

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

- Clean up entrypoint-town.ts for minimal code
- Ensure Docker image build is clean (no unnecessary copies)
- Verify all tests still pass after each refactor
- Consider removing the old entrypoint.ts if no longer needed (git history preserves it)

---

## Risk Mitigations

- **E2-R08 (SDK-based relay fails existing E2E tests, score 9):** Run `genesis-bootstrap-with-channels.test.ts` as the primary gate. If it passes, SDK is behaviorally equivalent for the happy path. SDK adds Schnorr verification (security improvement) but E2E tests use properly signed events via `finalizeEvent()`.
- **E2-R05 (Settlement negotiation behavioral mismatch, score 9):** SPSP handler delegates to same `negotiateAndOpenChannel()` from core. Unit tests (Story 2.2) verify handler calls it correctly. E2E validates actual channel creation on Anvil.
- **E2-R09 (Docker image build failure, score 4):** New packages (SDK, Town) must be added to Dockerfile. Build order enforced by pnpm workspace dependency graph.

---

## Behavioral Differences from Old BLS

| Behavior | Old BLS (entrypoint.ts) | SDK-based (entrypoint-town.ts) |
|----------|------------------------|-------------------------------|
| Signature verification | None | SDK verifies Schnorr (security improvement) |
| Error: insufficient payment | F06 | F04 (SDK standard ILP code) |
| Error: invalid TOON | F00 | F06 (SDK parse stage) |
| Error: invalid signature | N/A | F06 (SDK verify stage) |
| Pipeline ordering | Decode first, then price | Parse -> verify -> price -> decode |
| Self-write | Manual pubkey check | SDK pricing validator bypass |
| SPSP response data | Top-level `data` field | Same (handler bypasses ctx.accept()) |

**Impact on E2E tests:** Existing tests use properly signed events and do NOT assert specific error codes for payment failures (happy path only). The `sdk-relay-validation.test.ts` tests are designed for SDK behavioral differences.

---

## Notes

- This story is a validation gate: it only passes when Stories 2.1 + 2.2 are complete AND the SDK-based Docker entrypoint is created
- The E2E tests use real CrosstownClient from @crosstown/client -- no SDK-specific client needed
- The `servicesReady` flag allows graceful degradation if infrastructure is not deployed
- Each test has a 60-second timeout (blockchain operations can be slow on Anvil)
- The line count test (T-2.3-07) is the only non-runtime test (reads source files directly)
- Handlers MUST be imported from `@crosstown/town`, NOT from `@crosstown/sdk` (SDK has throwing stubs)
- Docker entrypoint uses Approach A (individual SDK components, NOT `createNode()`) -- external connector mode
- Total estimated effort: ~13-21 hours (largely dependent on entrypoint creation and Docker build)

---

## Knowledge Base References Applied

- **data-factories.md** -- Confirmed inline factory pattern is appropriate (crypto key generation provides natural uniqueness)
- **test-quality.md** -- Tests follow: deterministic, isolated (own keypair per test), explicit assertions, < 300 lines each, no hard waits (timeout-based WebSocket waits are deterministic)
- **test-levels-framework.md** -- All tests are E2E level (cross-system validation: blockchain + ILP + Nostr relay + WebSocket)
- **test-priorities-matrix.md** -- P0 for revenue-critical/data-integrity paths, P1 for SDK-specific behaviors
- **test-healing-patterns.md** -- Health check pattern prevents flaky failures from infrastructure unavailability

See `tea-index.csv` for complete knowledge fragment mapping.

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `cd packages/client && pnpm vitest run --config vitest.e2e.config.ts tests/e2e/sdk-relay-validation.test.ts`

**Expected Results:**

```
 SKIP  tests/e2e/sdk-relay-validation.test.ts > SDK-Based Relay Validation (Story 2.3)

Test Files  1 skipped
Tests       7 skipped
```

**Summary:**

- Total tests: 7
- Passing: 0 (expected)
- Skipped: 7 (describe.skip)
- Status: RED phase verified (tests will fail when unskipped)

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-03-04 | 1.0 | Initial ATDD checklist via TEA ATDD workflow | TEA |
| 2026-03-06 | 1.1 | Updated T-2.3-07 line count test to read from `docker/src/entrypoint-town.ts` (was `packages/town/src/index.ts`) per refined story v0.2. Added multi-line comment pattern filtering. Updated test file header comments. Added traceability table. Added risk mitigations. Added behavioral differences table. Updated implementation checklist with corrected file paths and completed story dependencies. Added T-2.3-EXIST tracking. | TEA |

---

**Generated by BMad TEA Agent** - 2026-03-06
