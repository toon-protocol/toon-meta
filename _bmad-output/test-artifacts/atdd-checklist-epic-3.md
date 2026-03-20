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
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/test-artifacts/test-design-epic-3.md
  - _bmad/tea/testarch/knowledge/data-factories.md
  - _bmad/tea/testarch/knowledge/test-quality.md
  - _bmad/tea/testarch/knowledge/test-levels-framework.md
  - _bmad/tea/testarch/knowledge/test-priorities-matrix.md
---

# ATDD Checklist - Epic 3: Production Protocol Economics

**Date:** 2026-03-06
**Author:** Jonathan
**Primary Test Level:** Unit + Integration (backend stack, vitest)
**Detected Stack:** backend (Node.js/TypeScript, vitest, no frontend)

---

## Epic Summary

**Epic 3: Production Protocol Economics** — Production-ready protocol economics: USDC payments, x402 HTTP payment on-ramp, multi-environment chain configuration, and decentralized peer discovery. After this epic, TOON nodes deploy on any infrastructure with real USDC on Arbitrum.

**Stories covered:** 3.1 through 3.6 (6 stories, 34 tests)

---

## Stories and Acceptance Criteria

### Story 3.1: USDC Token Migration (FR-PROD-1)
- Mock USDC (FiatTokenV2_2) deployed on Anvil at deterministic address
- TokenNetwork configured to use USDC
- Payment channels use USDC denomination
- Faucet distributes mock USDC instead of AGENT
- All "AGENT" references replaced with "USDC"

### Story 3.2: Multi-Environment Chain Configuration (FR-PROD-2)
- `chain: 'anvil'` connects to local Anvil
- `chain: 'arbitrum-sepolia'` connects to testnet
- `chain: 'arbitrum-one'` connects to production
- `TOON_CHAIN` env var overrides config
- `TOON_RPC_URL` allows custom RPC override

### Story 3.3: x402 /publish Endpoint (FR-PROD-3)
- GET /publish returns 402 with pricing info
- EIP-3009 gasless USDC authorization → settlement → ILP PREPARE
- Pre-flight validation: 6 free checks before on-chain tx
- Packet equivalence: x402 and SPSP use shared `buildIlpPrepare()`
- No refund on REJECT (payment is for routing attempt)
- x402 disabled → 404

### Story 3.4: Seed Relay Discovery (FR-PROD-4)
- kind:10036 seed relay list on public Nostr relays
- Connect to seeds, subscribe kind:10032 for network discovery
- Fallback when seeds unreachable
- Backward compat: `discovery: 'genesis'` still works

### Story 3.5: kind:10035 Service Discovery Events (FR-PROD-5)
- Node publishes kind:10035 after bootstrap
- Content: service type, ILP address, pricing, x402 endpoint
- x402 disabled → field omitted
- NIP-33 replaceable event pattern (d tag)

### Story 3.6: Enriched /health Endpoint (FR-PROD-6)
- JSON response: phase, peerCount, channelCount, pricing, x402, capabilities, chain, version
- Live state reflects actual peer/channel counts

---

## Failing Tests Created (RED Phase)

### Story 3.1: USDC Token Migration (3 tests)

**File:** `packages/core/src/chain/usdc-migration.test.ts`

- **3.1-INT-001** [P0] mock USDC supports EIP-3009 transferWithAuthorization on Anvil
  - **Status:** RED — implementation does not exist
  - **Risk:** E3-R005 (Mock USDC fidelity)
- **3.1-INT-001** [P0] TokenNetwork openChannel works with USDC token address
  - **Status:** RED — implementation does not exist
  - **Risk:** E3-R005
- **3.1-UNIT-001** [P2] faucet config specifies USDC token instead of AGENT
  - **Status:** RED — implementation does not exist
- **3.1-UNIT-002** [P2] no AGENT token references in config types
  - **Status:** RED — static analysis check not implemented

### Story 3.2: Multi-Environment Chain Configuration (9 tests)

**File:** `packages/core/src/chain/chain-config.test.ts`

- **3.2-UNIT-001** [P0] resolveChainConfig("anvil") returns local Anvil preset
  - **Status:** RED — resolveChainConfig does not exist
  - **Risk:** E3-R004
- **3.2-UNIT-001** [P0] resolveChainConfig("arbitrum-sepolia") returns testnet preset
  - **Status:** RED
- **3.2-UNIT-001** [P0] resolveChainConfig("arbitrum-one") returns production preset
  - **Status:** RED
- **3.2-UNIT-002** [P1] TOON_CHAIN env var overrides config file chain selection
  - **Status:** RED
- **3.2-UNIT-002** [P1] TOON_RPC_URL env var overrides preset RPC endpoint
  - **Status:** RED
- **3.2-UNIT-003** [P1] unknown chain name throws clear error message
  - **Status:** RED
- **3.2-UNIT-004** [P2] ChainPreset has all required fields
  - **Status:** RED
- **3.9-UNIT-001** [P2] no ethers imports in Epic 3 code (viem-only enforcement)
  - **Status:** RED — static analysis check not implemented
  - **Risk:** E3-R009
- **3.2-INT-001** [P0] EIP-712 domain separator uses resolved chainId + cross-chain rejection
  - **Status:** RED — 2 sub-tests
  - **Risk:** E3-R004, E3-R005

### Story 3.3: x402 /publish Endpoint (12 tests)

**File:** `packages/town/src/handlers/x402-publish-handler.test.ts`

- **3.3-INT-001** [P0] 6 free pre-flight checks before on-chain tx — Risk: E3-R001, E3-R013
- **3.3-INT-002** [P0] full 402→payment→200 happy path — Risk: E3-R001, E3-R002
- **3.3-INT-003** [P0] x402 and SPSP packet equivalence via shared buildIlpPrepare() — Risk: E3-R003
- **3.3-INT-004** [P0] settlement revert → no ILP PREPARE sent — Risk: E3-R002
- **3.3-INT-005** [P0] no refund on REJECT → HTTP 200 with settlement hash — Risk: E3-R002, E3-R013
- **3.3-INT-006** [P0] forged EIP-3009 sig rejected at pre-flight — Risk: E3-R001
- **3.3-INT-007** [P1] x402 disabled → 404
- **3.3-INT-008** [P1] multi-hop pricing with routing buffer — Risk: E3-R008
- **3.3-INT-009** [P1] 402 response schema (amount, facilitatorAddress, paymentNetwork, chainId)
- **3.7-INT-001** [P1] concurrent HTTP + WS on port 7100 — Risk: E3-R007
- **3.3-INT-010** [P2] pre-flight: insufficient USDC balance → reject — Risk: E3-R013
- **3.3-INT-011** [P2] pre-flight: destination unreachable → reject — Risk: E3-R013

All Status: **RED** — x402 handler does not exist

### Story 3.4: Seed Relay Discovery (4 tests)

**File:** `packages/core/src/discovery/seed-relay-discovery.test.ts`

- **3.4-INT-001** [P1] reads kind:10036 → connects to seed → subscribes kind:10032 — Risk: E3-R006
- **3.4-INT-002** [P1] first seed unreachable → tries next + all exhausted → error — Risk: E3-R006
- **3.4-INT-003** [P1] genesis mode backward compatibility
- **3.4-INT-004** [P1] node publishes kind:10036 seed list entry

All Status: **RED** — SeedRelayDiscovery does not exist

### Story 3.5: kind:10035 Service Discovery Events (4 tests)

**File:** `packages/core/src/events/service-discovery.test.ts`

- **3.5-INT-001** [P1] kind:10035 published on bootstrap
- **3.5-INT-002** [P1] content correctness (service type, ILP address, pricing, x402)
- **3.5-INT-003** [P2] x402 disabled → ILP-only advertised
- **3.5-UNIT-001** [P2] NIP-33 replaceable event d tag — Risk: E3-R011

All Status: **RED** — buildServiceDiscoveryEvent does not exist

### Story 3.6: Enriched /health Endpoint (3 tests)

**File:** `packages/town/src/health.test.ts`

- **3.6-UNIT-001** [P2] response schema snapshot (phase, peerCount, channelCount, pricing, x402, capabilities, chain, version) — Risk: E3-R012
- **3.6-UNIT-001** [P2] x402 disabled → endpoint field omitted
- **3.6-INT-001** [P2] peerCount and channelCount match actual node state

All Status: **RED** — createHealthHandler does not exist

---

## Data Factories Created

All factories are **inline** within test files (co-located pattern, per project conventions):

### Chain/USDC Factories (usdc-migration.test.ts)
- `createUsdcConfig(overrides?)` — Mock USDC contract configuration

### Chain Config Factories (chain-config.test.ts)
- Constants: `ANVIL_CHAIN_ID`, `ARBITRUM_SEPOLIA_CHAIN_ID`, `ARBITRUM_ONE_CHAIN_ID`, `ARBITRUM_ONE_USDC`

### x402 Factories (x402-publish-handler.test.ts)
- `createEip3009Authorization(overrides?)` — Mock EIP-3009 gasless USDC authorization
- `createToonPayload(overrides?)` — Mock TOON-encoded Nostr event
- `createX402Request(overrides?)` — Mock x402 HTTP request with X-PAYMENT header

### Discovery Factories (seed-relay-discovery.test.ts)
- `createSeedRelayList(count)` — Array of mock seed relay entries
- `createSeedRelayEvent(seedRelays?, overrides?)` — Mock kind:10036 Nostr event

### Service Discovery Factories (service-discovery.test.ts)
- `createServiceDiscoveryContent(overrides?)` — Mock kind:10035 content payload

### Health Factories (health.test.ts)
- `createHealthConfig(overrides?)` — Mock health endpoint configuration

---

## Mock Requirements

### Anvil (Local EVM) — Stories 3.1, 3.2, 3.3
- **Required:** Anvil running at `http://localhost:8545` for EIP-3009 and channel tests
- **Contract:** Real FiatTokenV2_2 (Circle's USDC implementation) deployed on Anvil
- **Purpose:** Full EIP-3009 `transferWithAuthorization` fidelity

### WebSocket/Nostr Relay — Stories 3.4, 3.5
- **Required:** Mock Nostr relay for kind:10036 and kind:10035 event tests
- **Pattern:** In-process mock (no real network needed for unit/integration)

### Connector — Story 3.3
- **Required:** Mock ConnectorNode for `sendPacket()` and `getChannelState()`
- **Pattern:** vi.spyOn() on connector methods

---

## Implementation Checklist

### Story 3.1: USDC Token Migration

**Tasks:**
- [ ] Deploy FiatTokenV2_2 contract on Anvil (deterministic address)
- [ ] Update TokenNetwork to use USDC token address
- [ ] Update faucet config from AGENT to USDC
- [ ] Replace all "AGENT" references in config/types with "USDC"
- [ ] Remove `.skip` from `usdc-migration.test.ts` tests
- [ ] Run: `pnpm test packages/core/src/chain/usdc-migration.test.ts`
- [ ] All tests pass (GREEN phase)

**Estimated Effort:** 4-6 hours

### Story 3.2: Multi-Environment Chain Configuration

**Tasks:**
- [ ] Create `packages/core/src/chain/chain-config.ts` with `resolveChainConfig()`
- [ ] Define `ChainPreset` type with chainId, rpcUrl, usdcAddress, tokenNetworkAddress, name
- [ ] Implement 3 presets: anvil, arbitrum-sepolia, arbitrum-one
- [ ] Add TOON_CHAIN and TOON_RPC_URL env var support
- [ ] Build EIP-712 domain separator using resolved chainId
- [ ] Remove `.skip` from `chain-config.test.ts` tests
- [ ] Run: `pnpm test packages/core/src/chain/chain-config.test.ts`
- [ ] All tests pass (GREEN phase)

**Estimated Effort:** 4-6 hours

### Story 3.3: x402 /publish Endpoint

**Tasks:**
- [ ] Create `packages/town/src/handlers/x402-publish-handler.ts`
- [ ] Implement pre-flight validation (6 free checks)
- [ ] Implement EIP-3009 signature verification (off-chain)
- [ ] Implement USDC settlement via `transferWithAuthorization`
- [ ] Create shared `buildIlpPrepare()` function (used by both x402 and SPSP)
- [ ] Implement 402 response with pricing info
- [ ] Implement no-refund-on-REJECT logic
- [ ] Add Express route: GET /publish
- [ ] Add TOON_X402_ENABLED config flag
- [ ] Remove `.skip` from `x402-publish-handler.test.ts` tests
- [ ] Run: `pnpm test packages/town/src/handlers/x402-publish-handler.test.ts`
- [ ] All tests pass (GREEN phase)

**Estimated Effort:** 12-18 hours (highest complexity story)

### Story 3.4: Seed Relay Discovery

**Tasks:**
- [ ] Create `packages/core/src/discovery/seed-relay-discovery.ts`
- [ ] Implement kind:10036 event reading from public Nostr relays
- [ ] Implement seed relay connection with fallback
- [ ] Implement kind:10032 subscription on seed relay
- [ ] Implement kind:10036 event publishing
- [ ] Maintain backward compat: `discovery: 'genesis'` mode
- [ ] Remove `.skip` from `seed-relay-discovery.test.ts` tests
- [ ] Run: `pnpm test packages/core/src/discovery/seed-relay-discovery.test.ts`
- [ ] All tests pass (GREEN phase)

**Estimated Effort:** 6-8 hours

### Story 3.5: kind:10035 Service Discovery Events

**Tasks:**
- [ ] Create `packages/core/src/events/service-discovery.ts`
- [ ] Implement `buildServiceDiscoveryEvent()` with NIP-33 d tag
- [ ] Implement `parseServiceDiscovery()` for content parsing
- [ ] Add SERVICE_DISCOVERY_KIND constant (10035)
- [ ] Integrate with bootstrap to publish after startup
- [ ] Remove `.skip` from `service-discovery.test.ts` tests
- [ ] Run: `pnpm test packages/core/src/events/service-discovery.test.ts`
- [ ] All tests pass (GREEN phase)

**Estimated Effort:** 3-4 hours

### Story 3.6: Enriched /health Endpoint

**Tasks:**
- [ ] Create `packages/town/src/health.ts` with `createHealthHandler()`
- [ ] Implement JSON response schema (phase, peerCount, channelCount, pricing, x402, capabilities, chain, version)
- [ ] Wire to live node state (peerCount, channelCount from connector)
- [ ] Add Express route: GET /health
- [ ] Remove `.skip` from `health.test.ts` tests
- [ ] Run: `pnpm test packages/town/src/health.test.ts`
- [ ] All tests pass (GREEN phase)

**Estimated Effort:** 2-3 hours

---

## Running Tests

```bash
# Run all Epic 3 ATDD tests (all will be skipped in red phase)
pnpm test packages/core/src/chain/ packages/core/src/discovery/seed-relay-discovery.test.ts packages/core/src/events/service-discovery.test.ts packages/town/src/handlers/x402-publish-handler.test.ts packages/town/src/health.test.ts

# Run specific story tests
pnpm test packages/core/src/chain/usdc-migration.test.ts          # Story 3.1
pnpm test packages/core/src/chain/chain-config.test.ts             # Story 3.2
pnpm test packages/town/src/handlers/x402-publish-handler.test.ts  # Story 3.3
pnpm test packages/core/src/discovery/seed-relay-discovery.test.ts # Story 3.4
pnpm test packages/core/src/events/service-discovery.test.ts       # Story 3.5
pnpm test packages/town/src/health.test.ts                         # Story 3.6

# Run with coverage
pnpm test:coverage

# Run all project tests (verify no regressions)
pnpm test
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**
- All 31 tests written with `it.skip()` (intentionally failing)
- Factories created inline (co-located pattern)
- Mock requirements documented
- Implementation checklist created per story
- Test IDs mapped to test-design-epic-3.md

**Verification:**
- All tests are skipped (not executed)
- Tests document expected behavior per acceptance criteria
- Tests follow project conventions (vitest, AAA, [P0-P3] tags, .js imports)

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**
1. Pick one story (recommend: 3.2 → 3.1 → 3.3 → 3.4 → 3.5 → 3.6)
2. Implement the source module referenced in commented imports
3. Uncomment imports in test file
4. Remove `.skip` from tests
5. Run tests → fix until all pass
6. Repeat for next story

**Recommended story order:**
1. **3.2** (Chain config) — foundation for all other stories
2. **3.1** (USDC migration) — depends on chain config
3. **3.3** (x402 /publish) — highest complexity, highest risk
4. **3.4** (Seed relay discovery) — independent
5. **3.5** (kind:10035 service discovery) — lightweight
6. **3.6** (/health endpoint) — lightweight

### REFACTOR Phase (After All Tests Pass)

1. Verify all 31 tests pass (green phase complete)
2. Extract shared `buildIlpPrepare()` if not already shared
3. Verify packet equivalence test passes
4. Run full test suite: `pnpm test`
5. Run E2E tests: `cd packages/client && pnpm test:e2e`

---

## E2E Tests (P3 — Deferred to Nightly)

These E2E tests require the full genesis node infrastructure and are NOT generated as ATDD tests. They should be created during or after GREEN phase:

| Test ID | Story | Description | Infrastructure |
|---------|-------|-------------|----------------|
| 3.3-E2E-001 | 3.3 | x402 full E2E with genesis node | Anvil + Faucet + Connector + Relay |
| 3.4-E2E-001 | 3.4 | Seed relay discovery E2E | Genesis node + seed list |
| 3.6-E2E-001 | 3.6 | /health E2E with live node | Genesis node |

**Location:** `packages/client/tests/e2e/`
**Run:** `cd packages/client && pnpm test:e2e`

---

## Knowledge Base References Applied

- **data-factories.md** — Factory patterns with overrides (Partial<T>), inline co-located factories
- **test-quality.md** — AAA pattern, deterministic tests, explicit assertions, <300 lines per test
- **test-levels-framework.md** — Unit for pure logic, Integration for service interactions, E2E for full stack
- **test-priorities-matrix.md** — P0 for revenue/security-critical, P1 for core workflows, P2 for secondary features

---

## Risk Coverage Summary

| Risk ID | Score | Test Coverage | Tests |
|---------|-------|---------------|-------|
| E3-R001 (EIP-3009 bypass) | 6 | P0 | 3.3-INT-001, 3.3-INT-002, 3.3-INT-006 |
| E3-R002 (Settlement atomicity) | 6 | P0 | 3.3-INT-002, 3.3-INT-004, 3.3-INT-005 |
| E3-R003 (Packet equivalence) | 6 | P0 | 3.3-INT-003 |
| E3-R004 (Chain config injection) | 6 | P0 | 3.2-UNIT-001, 3.2-INT-001 |
| E3-R005 (Mock USDC fidelity) | 6 | P0 | 3.1-INT-001, 3.2-INT-001 |
| E3-R006 (Seed relay liveness) | 4 | P1 | 3.4-INT-001, 3.4-INT-002 |
| E3-R007 (Dual-protocol conflicts) | 4 | P1 | 3.7-INT-001 |
| E3-R008 (Multi-hop pricing) | 3 | P1 | 3.3-INT-008 |
| E3-R009 (viem/ethers coexistence) | 3 | P2 | 3.9-UNIT-001 |
| E3-R011 (NIP-33 semantics) | 2 | P2 | 3.5-UNIT-001 |
| E3-R012 (/health schema) | 1 | P2 | 3.6-UNIT-001 |
| E3-R013 (Gas griefing) | 3 | P0-P2 | 3.3-INT-001, 3.3-INT-005, 3.3-INT-010, 3.3-INT-011 |

All 5 high-priority risks (score >=6) have P0 test coverage.

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `pnpm test` (all Epic 3 test files)

**Expected Results:**
- Total tests: 36
- Skipped: 36 (all `it.skip()`)
- Passing: 0 (expected — no implementation exists)
- Failing: 0 (skipped tests don't count as failures)
- Status: RED phase verified — all tests document expected behavior

---

## Notes

- **viem-only enforcement (3.9-UNIT-001):** Static analysis test for no `ethers` imports in Epic 3 code. Added to `chain-config.test.ts` as part of Story 3.2.
- **Dual-protocol server (3.7-INT-001):** Concurrent HTTP + WS on port 7100. Added to `x402-publish-handler.test.ts` as part of Story 3.3.
- **Factory pattern:** All factories are inline (co-located) following existing project conventions. No separate `tests/support/factories/` directory needed.
- **Import pattern:** Tests use commented-out imports (Pattern B from Epic 4 ATDD). Uncomment when implementing.

---

**Generated by:** BMad TEA Agent - ATDD Workflow
**Workflow:** `_bmad/tea/workflows/testarch/atdd`
**Version:** 5.0 (Step-File Architecture)
**Date:** 2026-03-06
