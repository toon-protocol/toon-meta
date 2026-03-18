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
lastSaved: '2026-03-13'
workflowType: 'testarch-atdd'
inputDocuments:
  - _bmad-output/implementation-artifacts/3-3-x402-publish-endpoint.md
  - _bmad-output/test-artifacts/atdd-checklist-epic-3.md
  - _bmad/tea/testarch/knowledge/data-factories.md
  - _bmad/tea/testarch/knowledge/test-quality.md
  - _bmad/tea/testarch/knowledge/test-levels-framework.md
  - _bmad/tea/testarch/knowledge/test-healing-patterns.md
  - _bmad/tea/config.yaml
  - packages/town/src/handlers/event-storage-handler.test.ts
  - packages/town/src/town.ts
  - packages/town/src/cli.ts
  - packages/town/src/index.ts
  - packages/core/src/index.ts
  - packages/core/src/chain/chain-config.ts
  - packages/town/vitest.config.ts
  - docker/src/shared.ts
---

# ATDD Checklist - Epic 3, Story 3.3: x402 /publish Endpoint

**Date:** 2026-03-13
**Author:** Jonathan
**Primary Test Level:** Unit + Integration (backend stack, vitest)

---

## Preflight Summary

| Item | Status |
|------|--------|
| Story approved with clear ACs | YES (8 ACs) |
| Detected stack | backend (Node.js/TypeScript, vitest) |
| Test framework configured | YES (vitest.config.ts in packages/town/) |
| Development environment available | YES (pnpm monorepo, all packages) |
| Existing test patterns reviewed | YES (event-storage-handler.test.ts pattern) |
| Knowledge fragments loaded | data-factories, test-quality, test-levels-framework, test-healing-patterns |
| Generation mode | AI Generation (backend stack, no browser recording needed) |

---

## Story Summary

Add an HTTP-native payment on-ramp to TOON via the x402 protocol pattern. The `/publish` endpoint allows any HTTP client (AI agents, browsers, CLI tools) to publish Nostr events to the network by paying USDC without understanding ILP or running an ILP client. Uses EIP-3009 gasless USDC authorization with a 6-layer pre-flight validation pipeline before any on-chain transaction.

**As an** HTTP client or AI agent
**I want** to publish Nostr events to any relay in the network via a simple HTTP endpoint with USDC payment
**So that** I can interact with TOON without understanding ILP or running an ILP client

---

## Acceptance Criteria

1. **AC #1:** GET /publish without X-PAYMENT header returns HTTP 402 with pricing info (amount, facilitatorAddress, paymentNetwork, chainId, usdcAddress)
2. **AC #2:** With X-PAYMENT header containing signed EIP-3009 authorization, node runs 6 pre-flight checks, settles USDC on-chain, constructs ILP PREPARE, routes to destination
3. **AC #3:** Destination relay receives packets indistinguishable from ILP-native packets (packet equivalence via shared buildIlpPrepare())
4. **AC #4:** On FULFILL, returns HTTP 200 with eventId and settlementTxHash
5. **AC #5:** Pricing includes destination basePricePerByte * toonLength + configurable routing buffer (default 10%)
6. **AC #6:** x402 disabled (default) returns 404
7. **AC #7:** Settlement tx revert prevents ILP PREPARE (no packet sent)
8. **AC #8:** Settlement success + ILP REJECT returns HTTP 200 with deliveryStatus: 'rejected', no refund

---

## Test Strategy

### Test Level Selection

| AC | Test Level | Justification |
|----|-----------|---------------|
| #1 (402 response) | Integration | Tests handler + Hono context interaction |
| #2 (pre-flight) | Integration | Tests validation pipeline with mocked viem contract reads |
| #3 (packet equivalence) | Unit | Pure function test: buildIlpPrepare() determinism |
| #4 (happy path) | Integration | Tests full handler flow with mocked deps |
| #5 (pricing) | Unit | Pure function test: calculateX402Price() |
| #6 (disabled) | Integration | Tests handler config flag |
| #7 (settlement revert) | Integration | Tests settlement + handler atomicity with mocks |
| #8 (no refund) | Integration | Tests settlement + reject + response with mocks |

### Primary Test Level: Unit + Integration

- **Unit tests:** buildIlpPrepare() correctness (T-3.3-13), calculateX402Price() formula (T-3.3-08), packet equivalence (T-3.3-03)
- **Integration tests:** Pre-flight pipeline, handler flow (happy path, error paths, config flags), settlement atomicity
- **E2E test (deferred):** Full x402 E2E requiring genesis infrastructure (T-3.3-14, P3, nightly only)

---

## Failing Tests Created (RED Phase)

### Unit + Integration Tests (15 tests)

**File:** `packages/town/src/handlers/x402-publish-handler.test.ts` (approx. 340 lines)

- **Test:** `[P0] buildIlpPrepare() sets amount field to match basePricePerByte * toonData.length` (T-3.3-13)
  - **Status:** RED -- `it.skip()`, module `@toon-protocol/core/x402` does not exist
  - **Verifies:** buildIlpPrepare() amount field matches pricing formula (E3-R007)

- **Test:** `[P1] price = basePricePerByte * toonLength + configurable routing buffer` (T-3.3-08)
  - **Status:** RED -- `it.skip()`, module `x402-pricing.ts` does not exist
  - **Verifies:** calculateX402Price() formula with 10% routing buffer (E3-R010)

- **Test:** `[P1] routing buffer of 0% returns base price only` (T-3.3-08 edge case)
  - **Status:** RED -- `it.skip()`, module `x402-pricing.ts` does not exist
  - **Verifies:** calculateX402Price() with zero buffer returns base price only

- **Test:** `[P0] x402 and ILP paths produce identical ILP PREPARE packets via shared buildIlpPrepare()` (T-3.3-03)
  - **Status:** RED -- `it.skip()`, module `@toon-protocol/core/x402` does not exist
  - **Verifies:** Packet equivalence across both payment rails (E3-R007)

- **Test:** `[P0] 6 free checks execute before any on-chain transaction` (T-3.3-01)
  - **Status:** RED -- `it.skip()`, module `x402-preflight.ts` does not exist
  - **Verifies:** Pre-flight validation firewall: 6 checks, 0 gas (E3-R005, E3-R008)

- **Test:** `[P0] full 402 negotiation -> EIP-3009 -> settlement -> ILP PREPARE -> FULFILL -> 200` (T-3.3-02)
  - **Status:** RED -- `it.skip()`, module `x402-publish-handler.ts` does not exist
  - **Verifies:** Full x402 happy path (E3-R005, E3-R006)

- **Test:** `[P0] settlement tx reverts (insufficient balance) -> no ILP PREPARE sent` (T-3.3-04)
  - **Status:** RED -- `it.skip()`, module `x402-settlement.ts` does not exist
  - **Verifies:** Settlement atomicity on revert (E3-R006)

- **Test:** `[P0] settlement succeeds but ILP PREPARE rejected -> HTTP 200, no refund` (T-3.3-05)
  - **Status:** RED -- `it.skip()`, module `x402-publish-handler.ts` does not exist
  - **Verifies:** No-refund-on-REJECT design (E3-R006, E3-R008)

- **Test:** `[P0] invalid EIP-3009 signature rejected at pre-flight (no gas spent)` (T-3.3-06)
  - **Status:** RED -- `it.skip()`, module `x402-preflight.ts` does not exist
  - **Verifies:** Forged signature rejection at pre-flight (E3-R005)

- **Test:** `[P1] TOON_X402_ENABLED=false -> GET /publish returns 404` (T-3.3-07)
  - **Status:** RED -- `it.skip()`, module `x402-publish-handler.ts` does not exist
  - **Verifies:** x402 opt-in configuration

- **Test:** `[P1] HTTP 402 body contains required fields: amount, facilitatorAddress, paymentNetwork, chainId, usdcAddress` (T-3.3-09)
  - **Status:** RED -- `it.skip()`, module `x402-publish-handler.ts` does not exist
  - **Verifies:** 402 response schema correctness

- **Test:** `[P1] concurrent HTTP GET /health + WS connection on BLS port` (T-3.3-10 / 3.7-INT-001)
  - **Status:** RED -- `it.skip()`, validates future dual-protocol scenario (E3-R009)
  - **Verifies:** HTTP and WS coexistence

- **Test:** `[P2] balance check fails -> reject before settlement tx` (T-3.3-11)
  - **Status:** RED -- `it.skip()`, module `x402-preflight.ts` does not exist
  - **Verifies:** Pre-flight balance check (E3-R008)

- **Test:** `[P2] destination connectivity check fails -> reject before settlement tx` (T-3.3-12)
  - **Status:** RED -- `it.skip()`, module `x402-preflight.ts` does not exist
  - **Verifies:** Pre-flight destination reachability (E3-R008)

- **Test:** `[P3] x402 full E2E: Anvil + Faucet + Connector + Relay -> 402 -> payment -> store` (T-3.3-14)
  - **Status:** RED -- `it.skip()`, requires genesis infrastructure (deferred to nightly)
  - **Verifies:** Full E2E x402 flow (E3-R005, E3-R006)

---

## Data Factories Created

### EIP-3009 Authorization Factory

**File:** `packages/town/src/handlers/x402-publish-handler.test.ts` (inline)

**Exports:**
- `createEip3009Authorization(overrides?)` -- Creates a mock EIP-3009 signed authorization with realistic EVM addresses, value in USDC micro-units, and EIP-712 signature components (v, r, s)

**Example Usage:**
```typescript
const auth = createEip3009Authorization({ value: 10000n });
const forgedAuth = createEip3009Authorization({
  v: 28,
  r: '0x' + '0'.repeat(64),
  s: '0x' + '0'.repeat(64),
});
```

### TOON Payload Factory

**File:** `packages/town/src/handlers/x402-publish-handler.test.ts` (inline)

**Exports:**
- `createToonPayload(overrides?)` -- Creates a mock TOON-encoded payload with base64 data, kind, pubkey, and destination

### Nostr Event Factory

**File:** `packages/town/src/handlers/x402-publish-handler.test.ts` (inline)

**Exports:**
- `createNostrEvent(overrides?)` -- Creates a mock signed Nostr event with id, pubkey, created_at, kind, tags, content, sig

### X402 Request Body Factory

**File:** `packages/town/src/handlers/x402-publish-handler.test.ts` (inline)

**Exports:**
- `createX402RequestBody(overrides?)` -- Creates a mock x402 request body with event and destination fields

### X402 Config Factory

**File:** `packages/town/src/handlers/x402-publish-handler.test.ts` (inline)

**Exports:**
- `createX402Config(overrides?)` -- Creates a mock X402HandlerConfig with chain config (anvil), pricing, facilitator address, and feature flags

---

## Fixtures Created

No Playwright/Cypress fixtures needed (backend stack). Test setup uses inline factories and vitest mocking (`vi.fn()`, `vi.spyOn()`).

---

## Mock Requirements

### viem Public Client Mock

**Purpose:** Mock on-chain read operations for pre-flight checks

**Mocked Methods:**
- `readContract({ functionName: 'balanceOf' })` -- Returns `bigint` balance
- `readContract({ functionName: 'authorizationState' })` -- Returns `boolean` nonce usage

**Success Response:** `10000n` (sufficient balance), `false` (nonce unused)
**Failure Response:** `0n` (zero balance), `true` (nonce already used)

### viem Wallet Client Mock

**Purpose:** Mock on-chain write operations for settlement

**Mocked Methods:**
- `writeContract({ functionName: 'transferWithAuthorization' })` -- Returns tx hash or reverts

**Success Response:** `'0x' + 'f'.repeat(64)` (tx hash)
**Failure Response:** Throws with revert reason

### ILP Client Mock

**Purpose:** Mock ILP packet routing

**Mocked Methods:**
- `sendIlpPacket({ destination, amount, data })` -- Returns fulfill or reject

**Success Response:** `{ type: 'fulfill', data: '' }`
**Failure Response:** `{ type: 'reject', code: 'F02', message: 'No route found' }`

### EventStore Mock

**Purpose:** Mock destination reachability check

**Mocked Methods:**
- `query(filter)` -- Returns matching events for kind:10032 lookup

**Success Response:** Array with kind:10032 event
**Failure Response:** Empty array (destination not known)

---

## Required data-testid Attributes

N/A -- Backend-only story with no UI components.

---

## Implementation Checklist

### Test: T-3.3-13 -- buildIlpPrepare() amount correctness

**File:** `packages/town/src/handlers/x402-publish-handler.test.ts`

**Tasks to make this test pass:**
- [ ] Create `packages/core/src/x402/build-ilp-prepare.ts` with `buildIlpPrepare()` function
- [ ] Create `packages/core/src/x402/index.ts` barrel export
- [ ] Export `buildIlpPrepare` from `packages/core/src/index.ts`
- [ ] Uncomment import and assertions in T-3.3-13
- [ ] Remove `it.skip()` from T-3.3-13
- [ ] Run test: `pnpm test packages/town/src/handlers/x402-publish-handler.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 1 hour

---

### Test: T-3.3-08 -- Multi-hop pricing with routing buffer

**File:** `packages/town/src/handlers/x402-publish-handler.test.ts`

**Tasks to make this test pass:**
- [ ] Create `packages/town/src/handlers/x402-pricing.ts` with `calculateX402Price()` function
- [ ] Implement formula: `price = basePricePerByte * toonLength + (basePricePerByte * toonLength * routingBufferPercent / 100)`
- [ ] Export from `packages/town/src/index.ts`
- [ ] Uncomment imports and assertions in T-3.3-08 tests
- [ ] Remove `it.skip()` from both pricing tests
- [ ] Run test: `pnpm test packages/town/src/handlers/x402-publish-handler.test.ts`
- [ ] Tests pass (green phase)

**Estimated Effort:** 1 hour

---

### Test: T-3.3-03 -- Packet equivalence

**File:** `packages/town/src/handlers/x402-publish-handler.test.ts`

**Tasks to make this test pass:**
- [ ] Verify `buildIlpPrepare()` is deterministic (same inputs -> same output)
- [ ] Uncomment imports and assertions in T-3.3-03
- [ ] Remove `it.skip()`
- [ ] Run test: `pnpm test packages/town/src/handlers/x402-publish-handler.test.ts`
- [ ] Test passes (green phase)

**Estimated Effort:** 0.5 hours

---

### Test: T-3.3-01 -- Pre-flight validation firewall

**File:** `packages/town/src/handlers/x402-publish-handler.test.ts`

**Tasks to make this test pass:**
- [ ] Create `packages/town/src/handlers/x402-preflight.ts` with `runPreflight()` function
- [ ] Implement 6 ordered checks: EIP-3009 sig, USDC balance, nonce freshness, TOON parse, Schnorr verify, destination reachability
- [ ] Return `{ passed, failedCheck, checksPerformed }` result
- [ ] Uncomment imports and assertions
- [ ] Remove `it.skip()`
- [ ] Run test
- [ ] Test passes (green phase)

**Estimated Effort:** 4 hours

---

### Test: T-3.3-02 -- x402 happy path

**File:** `packages/town/src/handlers/x402-publish-handler.test.ts`

**Tasks to make this test pass:**
- [ ] Create `packages/town/src/handlers/x402-publish-handler.ts` with `createX402Handler()` function
- [ ] Create `packages/town/src/handlers/x402-types.ts` with `Eip3009Authorization` and `EIP_3009_TYPES`
- [ ] Implement 402 response (no payment -> pricing info)
- [ ] Implement 200 response (payment + preflight + settlement + ILP PREPARE + FULFILL)
- [ ] Wire mock deps for testing
- [ ] Uncomment imports and assertions
- [ ] Remove `it.skip()`
- [ ] Run test
- [ ] Test passes (green phase)

**Estimated Effort:** 6 hours

---

### Test: T-3.3-04 -- Settlement atomicity (revert)

**File:** `packages/town/src/handlers/x402-publish-handler.test.ts`

**Tasks to make this test pass:**
- [ ] Create `packages/town/src/handlers/x402-settlement.ts` with `settleEip3009()` function
- [ ] Implement revert handling: return `{ success: false, error }` on tx revert
- [ ] Handler must check settlement result before sending ILP PREPARE
- [ ] Uncomment imports and assertions
- [ ] Remove `it.skip()`
- [ ] Run test
- [ ] Test passes (green phase)

**Estimated Effort:** 3 hours

---

### Test: T-3.3-05 -- No refund on REJECT

**File:** `packages/town/src/handlers/x402-publish-handler.test.ts`

**Tasks to make this test pass:**
- [ ] Handler returns HTTP 200 with `deliveryStatus: 'rejected'` when ILP PREPARE is rejected
- [ ] `refundInitiated: false` in response
- [ ] No refund queue or retry logic
- [ ] Uncomment imports and assertions
- [ ] Remove `it.skip()`
- [ ] Run test
- [ ] Test passes (green phase)

**Estimated Effort:** 1 hour

---

### Test: T-3.3-06 -- EIP-3009 forged signature rejection

**File:** `packages/town/src/handlers/x402-publish-handler.test.ts`

**Tasks to make this test pass:**
- [ ] Pre-flight check #1 uses viem `verifyTypedData()` for off-chain EIP-3009 sig recovery
- [ ] Forged signature (zeroed r, s) -> recovered address does not match `from` -> reject
- [ ] Uncomment imports and assertions
- [ ] Remove `it.skip()`
- [ ] Run test
- [ ] Test passes (green phase)

**Estimated Effort:** 2 hours

---

### Test: T-3.3-07 -- x402 disabled returns 404

**File:** `packages/town/src/handlers/x402-publish-handler.test.ts`

**Tasks to make this test pass:**
- [ ] `createX402Handler({ x402Enabled: false })` returns handler that responds with 404
- [ ] Add `x402Enabled?: boolean` to TownConfig (default: false)
- [ ] Add `TOON_X402_ENABLED` env var to `packages/town/src/cli.ts`
- [ ] Add to `docker/src/shared.ts` parseConfig()
- [ ] Uncomment imports and assertions
- [ ] Remove `it.skip()`
- [ ] Run test
- [ ] Test passes (green phase)

**Estimated Effort:** 2 hours

---

### Test: T-3.3-09 -- 402 response schema

**File:** `packages/town/src/handlers/x402-publish-handler.test.ts`

**Tasks to make this test pass:**
- [ ] 402 response body includes: amount (string), facilitatorAddress (0x-address), paymentNetwork ('eip-3009'), chainId (number), usdcAddress (0x-address)
- [ ] Uncomment imports and assertions
- [ ] Remove `it.skip()`
- [ ] Run test
- [ ] Test passes (green phase)

**Estimated Effort:** 1 hour

---

### Test: T-3.3-10 -- Dual-protocol server

**File:** `packages/town/src/handlers/x402-publish-handler.test.ts`

**Tasks to make this test pass:**
- [ ] Verify BLS (HTTP) and relay (WS) can run concurrently on separate ports
- [ ] Uncomment imports and assertions
- [ ] Remove `it.skip()`
- [ ] Run test
- [ ] Test passes (green phase)

**Estimated Effort:** 1 hour

---

### Test: T-3.3-11 -- Insufficient USDC balance

**File:** `packages/town/src/handlers/x402-publish-handler.test.ts`

**Tasks to make this test pass:**
- [ ] Pre-flight check #2 reads balanceOf(from) on USDC contract
- [ ] Zero balance -> `{ passed: false, failedCheck: 'usdc-balance' }`
- [ ] Uncomment imports and assertions
- [ ] Remove `it.skip()`
- [ ] Run test
- [ ] Test passes (green phase)

**Estimated Effort:** 1 hour

---

### Test: T-3.3-12 -- Destination unreachable

**File:** `packages/town/src/handlers/x402-publish-handler.test.ts`

**Tasks to make this test pass:**
- [ ] Pre-flight check #6 verifies destination ILP address is known
- [ ] No kind:10032 event and no connector route -> `{ passed: false, failedCheck: 'destination-reachability' }`
- [ ] Uncomment imports and assertions
- [ ] Remove `it.skip()`
- [ ] Run test
- [ ] Test passes (green phase)

**Estimated Effort:** 1 hour

---

## Running Tests

```bash
# Run all x402 tests for this story (currently all skipped/RED)
pnpm test packages/town/src/handlers/x402-publish-handler.test.ts

# Run specific test file with verbose output
npx vitest run packages/town/src/handlers/x402-publish-handler.test.ts --reporter=verbose

# Run all town package tests
pnpm test packages/town/

# Run full test suite (verify no regressions)
pnpm test

# Run tests in watch mode during development
npx vitest packages/town/src/handlers/x402-publish-handler.test.ts
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**

- All 15 tests written and skipped (it.skip)
- Factories created for EIP-3009 auth, TOON payloads, Nostr events, request bodies, config
- Mock requirements documented (viem PublicClient, WalletClient, ILP client, EventStore)
- Implementation checklist created with effort estimates
- Test file validates cleanly (0 errors, 15 skipped)

**Verification:**

- All tests skip cleanly with no import errors
- Full test suite passes with no regressions (72 passed, 17 skipped)
- Test file at `packages/town/src/handlers/x402-publish-handler.test.ts`

---

### GREEN Phase (DEV Team -- Next Steps)

**DEV Agent Responsibilities:**

1. **Start with pure function tests** (T-3.3-13, T-3.3-08, T-3.3-03) -- these require only Task 1 (buildIlpPrepare) and Task 2 (pricing)
2. **Then pre-flight pipeline** (T-3.3-01, T-3.3-06, T-3.3-11, T-3.3-12) -- requires Task 3
3. **Then settlement** (T-3.3-04) -- requires Task 4
4. **Then handler** (T-3.3-02, T-3.3-05, T-3.3-07, T-3.3-09) -- requires Task 5
5. **Then integration** (T-3.3-10) -- requires Task 6
6. **Finally E2E** (T-3.3-14) -- deferred, requires genesis infra

**Key Principles:**

- One test at a time (don't try to fix all at once)
- Minimal implementation (don't over-engineer)
- Run tests frequently (immediate feedback)
- Use implementation checklist as roadmap
- Follow task order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9

---

### REFACTOR Phase (DEV Team -- After All Tests Pass)

**DEV Agent Responsibilities:**

1. Verify all tests pass (green phase complete)
2. Review code for quality (readability, maintainability)
3. Extract duplications (DRY principle)
4. Ensure tests still pass after each refactor
5. Optionally refactor SDK `publishEvent()` to use `buildIlpPrepare()` (reduces code duplication)

---

## Next Steps

1. **Share this checklist** with the dev workflow (manual handoff)
2. **Run failing tests** to confirm RED phase: `pnpm test packages/town/src/handlers/x402-publish-handler.test.ts`
3. **Begin implementation** starting with Task 1 (buildIlpPrepare shared function)
4. **Work one test at a time** (red -> green for each)
5. **Run full suite** after each task: `pnpm test`
6. **When all 13 unit/integration tests pass**, mark story as done
7. **E2E test (T-3.3-14)** deferred to nightly CI with genesis infrastructure

---

## Knowledge Base References Applied

- **data-factories.md** -- Factory pattern with overrides for test data generation (EIP-3009 auth, TOON payloads, Nostr events, config objects)
- **test-levels-framework.md** -- Test level selection: unit for pure functions (pricing, buildIlpPrepare), integration for handler flows (pre-flight, settlement, happy path)
- **test-quality.md** -- Given-When-Then structure, deterministic tests, isolation (mocked dependencies)
- **test-healing-patterns.md** -- Module-not-found errors as expected RED phase failures

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `npx vitest run packages/town/src/handlers/x402-publish-handler.test.ts --reporter=verbose`

**Results:**

```
Test Files  1 skipped (1)
     Tests  15 skipped (15)
  Start at  13:49:25
  Duration  255ms
```

**Summary:**

- Total tests: 15
- Passing: 0 (expected)
- Failing: 0 (all skipped -- modules don't exist)
- Skipped: 15 (expected)
- Status: RED phase verified

**Full Suite Verification:**

```
Test Files  72 passed | 17 skipped (89)
     Tests  1365 passed | 174 skipped (1539)
  Duration  5.30s
```

No regressions.

---

## Test Design Traceability

| ATDD Test ID | Test Name | AC | Test-Design ID | Risk Link | Priority | Level |
|---|---|---|---|---|---|---|
| T-3.3-01 | 6 free checks execute before any on-chain transaction | #2 | 3.3-INT-001 | E3-R005, E3-R008 | P0 | I |
| T-3.3-02 | full 402 negotiation -> EIP-3009 -> settlement -> ILP PREPARE -> FULFILL -> 200 | #1, #2, #4 | 3.3-INT-002 | E3-R005, E3-R006 | P0 | I |
| T-3.3-03 | x402 and ILP paths produce identical ILP PREPARE packets via shared buildIlpPrepare() | #3 | 3.3-INT-003 | E3-R007 | P0 | U |
| T-3.3-04 | settlement tx reverts (insufficient balance) -> no ILP PREPARE sent | #7 | 3.3-INT-004 | E3-R006 | P0 | I |
| T-3.3-05 | settlement succeeds but ILP PREPARE rejected -> HTTP 200, no refund | #8 | 3.3-INT-005 | E3-R006, E3-R008 | P0 | I |
| T-3.3-06 | invalid EIP-3009 signature rejected at pre-flight (no gas spent) | #2 | 3.3-INT-006 | E3-R005 | P0 | I |
| T-3.3-07 | TOON_X402_ENABLED=false -> GET /publish returns 404 | #6 | 3.3-INT-007 | -- | P1 | I |
| T-3.3-08 | price = basePricePerByte * toonLength + configurable routing buffer | #5 | 3.3-INT-008 | E3-R010 | P1 | U |
| T-3.3-08b | routing buffer of 0% returns base price only | #5 | 3.3-INT-008 | E3-R010 | P1 | U |
| T-3.3-09 | HTTP 402 body contains required fields | #1 | 3.3-INT-009 | -- | P1 | I |
| T-3.3-10 | concurrent HTTP GET /health + WS connection on BLS port | -- | 3.7-INT-001 | E3-R009 | P1 | I |
| T-3.3-11 | balance check fails -> reject before settlement tx | #2 | 3.3-INT-010 | E3-R008 | P2 | I |
| T-3.3-12 | destination connectivity check fails -> reject before settlement tx | #2 | 3.3-INT-011 | E3-R008 | P2 | I |
| T-3.3-13 | buildIlpPrepare() sets amount field to match basePricePerByte * toonData.length | #3 | -- | E3-R007 | P0 | U |
| T-3.3-14 | x402 full E2E: Anvil + Faucet + Connector + Relay -> full 402 -> payment -> store | #1-#8 | 3.3-E2E-001 | E3-R005, E3-R006 | P3 | E2E |

---

## Notes

- The existing test file had 12 placeholder tests with `expect(true).toBe(false)`. These have been rewritten with proper RED phase structure: real factories, real assertion comments (commented out until GREEN phase), and proper Given-When-Then format.
- T-3.3-13 is a new test added per the test design traceability table, validating buildIlpPrepare() amount field correctness for SDK pricing validator compatibility.
- T-3.3-08 was expanded to include a zero-buffer edge case test (total: 15 tests instead of the original 12+1).
- The unused `vi` import was changed from `vi as _vi` to `vi` since it will be needed when tests are unskipped.
- The `_createX402Request` factory was replaced with more specific factories (`createX402RequestBody`, `createNostrEvent`, `createX402Config`) that match the actual API design from the story.
- All risk IDs align with test-design-epic-3.md: E3-R005 (sig bypass), E3-R006 (settlement atomicity), E3-R007 (packet equivalence), E3-R008 (gas griefing), E3-R009 (dual-protocol), E3-R010 (pricing opacity).

---

**Generated by BMad TEA Agent** -- 2026-03-13
