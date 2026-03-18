# Risk-Based Test Plan: Epic 3 - Production Protocol Economics

**Date:** 2026-03-13
**Author:** Jonathan (with Claude Opus 4.6)
**Status:** Implementation-Ready
**Epic Source:** `_bmad-output/planning-artifacts/epics.md` -- Epic 3
**Predecessors:**
- `_bmad-output/planning-artifacts/test-design-epic-1.md` (Epic 1 SDK test plan)
- `_bmad-output/planning-artifacts/test-design-epic-2.md` (Epic 2 Town test plan)
- `_bmad-output/test-artifacts/test-design-architecture.md` (System-level architecture test design)
- `_bmad-output/test-artifacts/test-design-qa.md` (System-level QA test design)
- `_bmad-output/test-artifacts/test-design-epic-3.md` (Earlier epic-3 draft from 2026-03-06)

---

## 1. Scope and Context

Epic 3 delivers 6 stories (3.1-3.6) transforming TOON from a development-token prototype into a production-ready USDC-denominated protocol. This is the first epic where real money semantics enter the system: EIP-3009 gasless USDC authorization, on-chain settlement, multi-chain configuration, and x402 HTTP payment on-ramp.

**Dependency chain:**
```
3.1 (USDC Migration) --> 3.2 (Chain Config) --> 3.3 (x402 /publish)
3.1 (USDC Migration) --> 3.5 (kind:10035 Service Discovery) --> 3.6 (/health)
3.4 (Seed Relay Discovery) -- independent, no USDC dependency
```

**What exists today (post-Epic 2):**

- `@toon-protocol/sdk` is complete with `createNode()`, handler registry, and full processing pipeline
- `@toon-protocol/town` is published with `startTown()`, event storage handler, lifecycle management
- SPSP handshake removed (Story 2.7), peer discovery simplified to discover -> register -> announce
- Relay subscription API on TownInstance (Story 2.8) provides general-purpose remote relay subscriptions
- Payment channels use AGENT token with TokenNetwork on Anvil (chain ID 31337)
- Pricing is `basePricePerByte * toonData.length` in AGENT denomination
- No multi-chain configuration; everything hardcoded to Anvil
- No x402 / HTTP payment endpoint
- No seed relay discovery (genesis-based bootstrap only)
- No kind:10035 service discovery events
- `/health` returns basic status only

**What Epic 3 changes:**

- AGENT token replaced by USDC (FiatTokenV2_2) across all packages
- Chain configuration system supporting Anvil, Arbitrum Sepolia, Arbitrum One
- x402 `/publish` endpoint on the Town node (not a separate gateway)
- kind:10036 seed relay list for decentralized peer discovery
- kind:10035 service discovery events advertising capabilities and pricing
- Enriched `/health` endpoint with comprehensive node status

**Red-phase test stubs already exist:**

- `packages/core/src/chain/chain-config.test.ts` (Story 3.2, 9 tests, all `.skip`)
- `packages/core/src/chain/usdc-migration.test.ts` (Story 3.1, 4 tests, all `.skip`)
- `packages/core/src/events/service-discovery.test.ts` (Story 3.5, 4 tests, all `.skip`)

**Test stubs NOT yet created (identified as gaps):**

- Story 3.3: `packages/town/src/handlers/x402-publish-handler.test.ts` (12 tests per ATDD checklist)
- Story 3.4: `packages/core/src/discovery/seed-relay-discovery.test.ts` (4 tests per ATDD checklist)
- Story 3.6: `packages/town/src/health.test.ts` (3 tests per ATDD checklist)

**What this test plan does NOT cover:**

- Epic 1 SDK internals (covered by `test-design-epic-1.md`)
- Epic 2 Town relay internals (covered by `test-design-epic-2.md`)
- Epic 4 TEE attestation (separate epic)
- Arbitrum One mainnet testing with real USDC (requires real gas costs)
- Multi-node peering E2E (requires `deploy-peers.sh` infrastructure)
- ethers.js connector migration (explicit architectural debt, Decision 7)

---

## 2. Risk Assessment by Story

### Risk Scoring

- **Probability**: 1 (unlikely), 2 (possible), 3 (likely)
- **Impact**: 1 (minor), 2 (moderate), 3 (severe -- data loss, security breach, or cascade failure)
- **Score**: Probability x Impact (1-9)
- **Threshold**: Score >= 6 = high priority, 3-5 = medium, 1-2 = low

### Story-Level Risk Matrix

| Story | Risk ID | Category | Description | P | I | Score | Mitigation |
|-------|---------|----------|-------------|---|---|-------|------------|
| **3.1 USDC Migration** | E3-R001 | DATA | Mock USDC on Anvil missing EIP-3009 `transferWithAuthorization` -- mock ERC-20 behaves differently than Circle's FiatTokenV2_2 | 2 | 3 | **6** | Deploy Circle's real FiatTokenV2_2 on Anvil (Decision 10); test `transferWithAuthorization` works identically |
| **3.1 USDC Migration** | E3-R002 | DATA | AGENT token references survive in config/types, causing confused denomination in pricing or channels | 2 | 2 | 4 | Static analysis test: grep for AGENT references in `packages/{core,sdk,town}/src/` (must be zero) |
| **3.2 Chain Config** | E3-R003 | DATA | Chain config injection -- wrong chainId in EIP-712 domain separator causes valid signatures to fail verification on wrong chain | 2 | 3 | **6** | Chain-aware EIP-712 signing tests across all 3 presets (Anvil 31337, Sepolia 421614, Arbitrum One 42161) |
| **3.2 Chain Config** | E3-R004 | TECH | viem/ethers coexistence -- two EVM libraries with different provider patterns create import confusion or runtime conflicts | 1 | 3 | 3 | Static analysis: no ethers imports in Epic 3 code; viem-only in new code (Decision 7) |
| **3.3 x402 /publish** | E3-R005 | SEC | EIP-3009 signature verification bypass -- accepting forged `transferWithAuthorization` signatures drains the facilitator or credits unearned USDC | 2 | 3 | **6** | Real FiatTokenV2_2 on Anvil; test forged sigs rejected at pre-flight; valid sigs accepted |
| **3.3 x402 /publish** | E3-R006 | TECH | Settlement atomicity -- on-chain USDC transfer succeeds but ILP PREPARE rejected (or vice versa) leaves inconsistent state | 2 | 3 | **6** | Two sub-scenarios: (a) settlement reverts -> no PREPARE, (b) PREPARE rejected -> no refund, facilitator keeps USDC |
| **3.3 x402 /publish** | E3-R007 | TECH | Packet equivalence -- x402 `/publish` constructs different ILP PREPARE than ILP rail, causing routing or storage failures | 2 | 3 | **6** | Shared `buildIlpPrepare()` function enforced; integration test comparing packet bytes from both paths |
| **3.3 x402 /publish** | E3-R008 | SEC | Gas griefing via x402 -- bad actor spams x402 with deliberately-failing authorizations to drain facilitator ETH through gas fees | 1 | 3 | 3 | Layered pre-flight validation: 6 free crypto checks before any on-chain tx |
| **3.3 x402 /publish** | E3-R009 | TECH | Dual-protocol server conflicts -- Express/Hono routes interfere with WebSocket upgrade on same port | 2 | 2 | 4 | Integration test: concurrent HTTP + WS requests on same port |
| **3.3 x402 /publish** | E3-R010 | BUS | Multi-hop pricing opacity -- routing buffer (5-10%) plus destination pricing makes final price unpredictable for clients | 1 | 3 | 3 | Unit test: pricing = destination basePricePerByte * toonLength + routing buffer |
| **3.4 Seed Discovery** | E3-R011 | TECH | Seed relay liveness -- all seed relays unreachable blocks network join; no fallback to genesis mode | 2 | 2 | 4 | Fallback test: seed list exhausted -> clear error; backward compat: `discovery: 'genesis'` still works |
| **3.5 Service Disc.** | E3-R012 | DATA | NIP-33 replaceable event semantics -- kind:10035 updates not correctly replacing previous event (missing/wrong `d` tag) | 1 | 2 | 2 | Unit test for replaceable event `d` tag presence and value |
| **3.6 /health** | E3-R013 | OPS | /health schema instability -- response format changes break monitoring agents | 1 | 1 | 1 | Snapshot test for schema |

### Inherited System-Level Risks

These risks from the architecture-level test design remain relevant to Epic 3:

| Risk ID (System) | Score | Epic 3 Relevance |
|-------------------|-------|-------------------|
| R-001 (TOON pipeline ordering) | 9 | x402 PREPARE packets flow through the same TOON processing pipeline; the ordering invariant (shallow parse -> verify -> price -> dispatch) must hold for x402-originated packets |
| R-005 (Payment channel state integrity) | 6 | USDC channels must survive x402 settlement failures; channel state integrity is critical with real-money semantics |

### High-Priority Risks (Score >= 6) -- Ordered by Score

| Rank | Risk ID | Score | Story | Summary |
|------|---------|-------|-------|---------|
| 1 | E3-R001 | **6** | 3.1 | Mock USDC fidelity (missing EIP-3009) |
| 2 | E3-R003 | **6** | 3.2 | Chain config injection (wrong chainId in EIP-712) |
| 3 | E3-R005 | **6** | 3.3 | EIP-3009 signature verification bypass |
| 4 | E3-R006 | **6** | 3.3 | Settlement atomicity (USDC transfer vs ILP PREPARE) |
| 5 | E3-R007 | **6** | 3.3 | Packet equivalence (x402 vs ILP rail) |

**Note:** All 5 high-priority risks are in the financial/settlement path (Stories 3.1-3.3). Story 3.3 alone carries 3 of the 5. This confirms Story 3.3 as the highest-risk story in the epic.

---

## 3. Critical Integration Boundaries Between Stories

### 3.1 The USDC Settlement Chain (E3-R001 -> E3-R003 -> E3-R005/R006, Score 6+)

The most critical integration boundary in Epic 3 is the settlement chain:

```
Story 3.1 (Mock USDC):
  FiatTokenV2_2 deployed on Anvil
    -> EIP-3009 transferWithAuthorization available
    -> TokenNetwork.openChannel() works with USDC

Story 3.2 (Chain Config):
  resolveChainConfig() returns { chainId, rpcUrl, usdcAddress, tokenNetworkAddress }
    -> EIP-712 domain separator uses correct chainId
    -> Settlement code uses resolved addresses, not hardcoded

Story 3.3 (x402 /publish):
  Pre-flight validation (6 free checks)
    -> EIP-3009 sig verified off-chain using chain config
    -> On-chain settlement via transferWithAuthorization
    -> buildIlpPrepare() constructs packet identical to ILP rail
    -> Packet enters SDK pipeline -> relay stores event
```

**Why this chain is non-negotiable:**

- **3.1 underpins 3.2 and 3.3**: If mock USDC lacks EIP-3009, all x402 tests are blocked
- **3.2 underpins 3.3 cryptographically**: EIP-712 signatures include the chainId; wrong chain = rejected signatures
- **3.3 is the money path**: Incorrect settlement atomicity means lost funds or credited unearned USDC

**Integration boundary tests:**

1. **3.1 -> 3.2**: `resolveChainConfig('anvil').usdcAddress` matches the deployed FiatTokenV2_2 address
2. **3.2 -> 3.3**: EIP-3009 signature signed with `resolveChainConfig('anvil').chainId` in domain separator passes pre-flight verification
3. **3.1 -> 3.3**: `transferWithAuthorization()` on Anvil's FiatTokenV2_2 succeeds with valid EIP-3009 params

### 3.2 The Packet Equivalence Invariant (E3-R007, Score 6)

x402 `/publish` is a second write-path into the relay, alongside the existing ILP rail. Both must produce identical ILP PREPARE packets:

```
ILP Rail (existing):
  Agent -> ILP PREPARE (TOON payload) -> Connector -> BLS -> Event stored

x402 Rail (new):
  Agent -> POST /publish (Nostr event JSON)
    -> 402 response (pricing)
    -> EIP-3009 payment
    -> buildIlpPrepare(toonPayload) -> Connector -> BLS -> Event stored
```

**The invariant:** `buildIlpPrepare()` MUST be a single shared function used by both paths. If x402 constructs its own ILP PREPARE separately, packet format drift is inevitable.

**Boundary test:** Construct an ILP PREPARE via x402 and via the ILP rail with identical TOON payloads. Serialize both. Assert byte-exact match.

### 3.3 The Discovery Independence (Stories 3.4, 3.5, 3.6)

Stories 3.4, 3.5, and 3.6 form a second, lower-risk cluster:

```
Story 3.4 (Seed Relay Discovery):
  kind:10036 on public Nostr relays -> connect to seed -> subscribe kind:10032
  Independent of USDC (no financial path)

Story 3.5 (Service Discovery):
  kind:10035 published on bootstrap -> advertises pricing, x402, capabilities
  Depends on 3.1 (USDC pricing denomination) and 3.3 (x402 enabled flag)

Story 3.6 (/health):
  Aggregates data from 3.5 (pricing, capabilities) and live node state
```

**Integration boundary test:** After Stories 3.1-3.5 are complete, the `/health` endpoint must return correct pricing (USDC, not AGENT), correct x402 status, and live peer/channel counts.

### 3.4 Pipeline Ordering Invariant for x402-Originated Packets (Inherited R-001, Score 9)

x402 packets enter the TOON processing pipeline from a different origin than ILP rail packets, but must traverse the same stages:

```
x402 origin:
  POST /publish -> buildIlpPrepare() -> connector.sendPacket()
    -> PaymentHandlerBridge (isTransit=false, final hop is local relay)
      -> Shallow TOON Parse
        -> Schnorr Verification
          -> Pricing Validation (pricing already paid via USDC, but SDK pricing still runs)
            -> HandlerRegistry.dispatch(kind)
```

**Risk:** If x402-originated packets bypass any pipeline stage (e.g., pricing is skipped because "payment already happened via USDC"), the pipeline ordering invariant from Epic 1 is violated.

**Mitigation:** x402 PREPARE packets must be **indistinguishable** from ILP rail packets at the BLS level. Pricing validation runs identically. The x402 payment covers the cost, but the SDK pricing validator still checks the ILP amount field. This means `buildIlpPrepare()` must set the `amount` field to match `basePricePerByte * toonData.length`.

---

## 4. Test Strategy Per Story

### Legend

- **U** = Unit test (isolated, mocked dependencies)
- **I** = Integration test (multiple real modules wired together)
- **E2E** = End-to-end test (requires genesis infrastructure)
- **Real EVM** = Uses Anvil for on-chain operations (EIP-3009, channels)
- **Real crypto** = Uses real viem/nostr-tools signing, no mocked crypto

### Story 3.1: USDC Token Migration

**Risk profile:** 1 high (E3-R001), 1 medium (E3-R002). Foundation story -- all subsequent stories depend on this.

| ID | Test | Level | Risk | Priority |
|----|------|-------|------|----------|
| T-3.1-01 | FiatTokenV2_2 deployed on Anvil supports `transferWithAuthorization` (EIP-3009) | I (real EVM) | E3-R001 | P0 |
| T-3.1-02 | TokenNetwork `openChannel()` works with USDC token address on Anvil | I (real EVM) | E3-R001 | P0 |
| T-3.1-03 | Faucet config specifies USDC token (not AGENT) | U | E3-R002 | P2 |
| T-3.1-04 | No AGENT token references in config/types across `packages/{core,sdk,town}/src/` | U (static analysis) | E3-R002 | P2 |
| T-3.1-05 | USDC denomination: `basePricePerByte` pricing produces amounts in USDC micro-units | U | -- | P1 |

**Notes:**

- T-3.1-01 and T-3.1-02 require Anvil running. These are the gating tests for Story 3.1 completion.
- T-3.1-04 is a static analysis test -- grep for AGENT references in source files (exclude test files and MEMORY.md).
- T-3.1-05 verifies the denomination switch does not alter the pricing formula itself, only the token.

**Existing red-phase stubs:** `packages/core/src/chain/usdc-migration.test.ts` (covers T-3.1-01, T-3.1-02, T-3.1-03, T-3.1-04)

### Story 3.2: Multi-Environment Chain Configuration

**Risk profile:** 1 high (E3-R003), 1 medium (E3-R004). Configuration foundation for all chain-dependent operations.

| ID | Test | Level | Risk | Priority |
|----|------|-------|------|----------|
| T-3.2-01 | `resolveChainConfig('anvil')` returns chainId=31337, rpcUrl=localhost:8545, deterministic USDC address | U | E3-R003 | P0 |
| T-3.2-02 | `resolveChainConfig('arbitrum-sepolia')` returns chainId=421614, valid RPC URL, testnet USDC address | U | E3-R003 | P0 |
| T-3.2-03 | `resolveChainConfig('arbitrum-one')` returns chainId=42161, valid RPC URL, USDC=`0xaf88d065e77c8cC2239327C5EDb3A432268e5831` | U | E3-R003 | P0 |
| T-3.2-04 | `TOON_CHAIN` env var overrides config file chain selection | U | -- | P1 |
| T-3.2-05 | `TOON_RPC_URL` env var overrides preset RPC endpoint | U | -- | P1 |
| T-3.2-06 | Invalid chain name throws clear error message | U | -- | P1 |
| T-3.2-07 | ChainPreset type has all required fields: chainId, rpcUrl, usdcAddress, tokenNetworkAddress, name | U | -- | P2 |
| T-3.2-08 | EIP-712 domain separator uses resolved chainId (not hardcoded) -- Anvil vs Arbitrum One produce different domains | I (real crypto) | E3-R003 | P0 |
| T-3.2-09 | EIP-3009 signature signed on Anvil chain fails verification against Arbitrum One chain (cross-chain rejection) | I (real crypto) | E3-R003 | P0 |
| T-3.2-10 | No ethers imports in Epic 3 code (`packages/{core,sdk,town}/src/`, excluding test files) | U (static analysis) | E3-R004 | P2 |

**Notes:**

- T-3.2-08 and T-3.2-09 together prove the EIP-712 chain-awareness. If a signature is portable across chains, there is a critical bug.
- T-3.2-10 enforces Decision 7 (viem-only in new code). The connector's ethers.js is untouched.

**Existing red-phase stubs:** `packages/core/src/chain/chain-config.test.ts` (covers T-3.2-01 through T-3.2-10)

### Story 3.3: x402 /publish Endpoint

**Risk profile:** 3 high (E3-R005, E3-R006, E3-R007), 3 medium (E3-R008, E3-R009, E3-R010). Highest complexity, highest risk. This is the story that introduces real-money semantics to the protocol.

| ID | Test | Level | Risk | Priority |
|----|------|-------|------|----------|
| T-3.3-01 | Pre-flight validation firewall: 6 free checks (EIP-3009 sig, USDC balance, nonce, TOON shallow parse, Schnorr verify, destination reachability) run before any on-chain tx | I | E3-R005, E3-R008 | P0 |
| T-3.3-02 | x402 happy path: `GET /publish` -> 402 with pricing -> `X-PAYMENT` header with EIP-3009 auth -> on-chain USDC settlement -> ILP PREPARE -> FULFILL -> HTTP 200 | I (real EVM) | E3-R005, E3-R006 | P0 |
| T-3.3-03 | Packet equivalence: x402 and ILP rail produce identical serialized ILP PREPARE bytes for same TOON payload via shared `buildIlpPrepare()` | I | E3-R007 | P0 |
| T-3.3-04 | Settlement atomicity (revert scenario): settlement tx reverts (insufficient balance) -> no ILP PREPARE sent, HTTP 402 retry response | I (real EVM) | E3-R006 | P0 |
| T-3.3-05 | No refund on REJECT: settlement succeeds -> PREPARE rejected by destination -> HTTP 200 with settlement hash, no refund initiated | I | E3-R006, E3-R008 | P0 |
| T-3.3-06 | Forged EIP-3009 signature rejected at pre-flight (no gas spent) | I (real crypto) | E3-R005 | P0 |
| T-3.3-07 | x402 disabled (`TOON_X402_ENABLED=false`) -> `GET /publish` returns 404 | I | -- | P1 |
| T-3.3-08 | Multi-hop pricing: price = destination `basePricePerByte * toonLength` + configurable routing buffer (5-10%) | U | E3-R010 | P1 |
| T-3.3-09 | 402 response schema: body contains `amount`, `facilitatorAddress`, `paymentNetwork`, `chainId` | I | -- | P1 |
| T-3.3-10 | Dual-protocol server: concurrent HTTP `GET /health` + WebSocket connection on same port succeeds | I | E3-R009 | P1 |
| T-3.3-11 | Pre-flight: insufficient USDC balance -> reject before settlement tx | I | E3-R008 | P2 |
| T-3.3-12 | Pre-flight: destination unreachable -> reject before settlement tx | I | E3-R008 | P2 |
| T-3.3-13 | `buildIlpPrepare()` sets `amount` field to match `basePricePerByte * toonData.length` so SDK pricing validator passes | U | E3-R007 | P0 |
| T-3.3-14 | x402 full E2E: Anvil + Faucet + Connector + Relay -> full 402 -> payment -> store flow | E2E | E3-R005, E3-R006 | P3 |

**Notes:**

- T-3.3-01 is the gas griefing defense. All 6 checks are free (no on-chain tx). If any fails, the request is rejected immediately.
- T-3.3-02 is the canonical happy path. It exercises the full settlement chain from HTTP request to relay storage.
- T-3.3-03 is the packet equivalence invariant. This test **must** compare serialized bytes, not just field equality.
- T-3.3-05 enforces the no-refund design decision. Verify that no refund queue, retry, or tracking code exists.
- T-3.3-13 bridges the x402 settlement path to the SDK pricing validator -- the ILP PREPARE `amount` must be set correctly even though payment happened via USDC, because the SDK pipeline still validates pricing.
- T-3.3-14 (E2E) requires full genesis infrastructure. Deferred to nightly.

**Red-phase stubs needed:** `packages/town/src/handlers/x402-publish-handler.test.ts` (per ATDD checklist)

### Story 3.4: Seed Relay Discovery

**Risk profile:** 1 medium (E3-R011). Independent of USDC. Lowest coupling to other stories.

| ID | Test | Level | Risk | Priority |
|----|------|-------|------|----------|
| T-3.4-01 | Happy path: read kind:10036 from public relay -> connect to seed -> subscribe kind:10032 for network discovery | I | E3-R011 | P1 |
| T-3.4-02 | Fallback: first seed unreachable -> try next in list; all exhausted -> clear error message | I | E3-R011 | P1 |
| T-3.4-03 | Backward compatibility: `discovery: 'genesis'` uses existing bootstrap flow unchanged | I | -- | P1 |
| T-3.4-04 | Node publishes kind:10036 event with own WebSocket URL and metadata | I | -- | P1 |
| T-3.4-05 | kind:10036 event uses relay subscription API (`town.subscribe()` from Story 2.8) | U | -- | P2 |
| T-3.4-06 | Seed relay discovery E2E with live genesis node | E2E | E3-R011 | P3 |

**Notes:**

- T-3.4-01 through T-3.4-04 use in-process mock relays (no real network needed).
- T-3.4-05 validates that seed relay discovery uses the Story 2.8 subscription API rather than building its own WebSocket management.
- T-3.4-06 requires genesis infrastructure. Deferred to nightly.

**Red-phase stubs needed:** `packages/core/src/discovery/seed-relay-discovery.test.ts` (per ATDD checklist)

### Story 3.5: kind:10035 Service Discovery Events

**Risk profile:** 1 low (E3-R012). Lightweight event builder/parser. Depends on 3.1 for USDC pricing denomination.

| ID | Test | Level | Risk | Priority |
|----|------|-------|------|----------|
| T-3.5-01 | `buildServiceDiscoveryEvent()` produces kind:10035 event with correct kind, pubkey, signed | I (real crypto) | -- | P1 |
| T-3.5-02 | Event content contains: serviceType, ilpAddress, pricing (USDC), x402 endpoint, supportedKinds, capabilities, chain, version | U | -- | P1 |
| T-3.5-03 | x402 disabled -> event omits x402 endpoint, capabilities list does not contain 'x402' | U | -- | P2 |
| T-3.5-04 | Event has `d` tag for NIP-33 replaceable event pattern; tag value is non-empty | U | E3-R012 | P2 |
| T-3.5-05 | `parseServiceDiscovery()` roundtrip: build -> parse -> all fields recovered | U | -- | P1 |

**Notes:**

- T-3.5-01 uses real nostr-tools signing to verify the event is properly signed.
- T-3.5-04 validates the NIP-33 pattern, which is critical for event replacement semantics.

**Existing red-phase stubs:** `packages/core/src/events/service-discovery.test.ts` (covers T-3.5-01, T-3.5-02, T-3.5-03, T-3.5-04)

### Story 3.6: Enriched /health Endpoint

**Risk profile:** 1 low (E3-R013). Aggregation endpoint. Lowest risk.

| ID | Test | Level | Risk | Priority |
|----|------|-------|------|----------|
| T-3.6-01 | Response schema snapshot: `{ phase, peerCount, channelCount, pricing, x402, capabilities, chain, version }` | U | E3-R013 | P2 |
| T-3.6-02 | x402 disabled -> endpoint field omitted from response | U | -- | P2 |
| T-3.6-03 | `peerCount` and `channelCount` reflect actual live node state | I | -- | P2 |
| T-3.6-04 | /health E2E with live genesis node | E2E | -- | P3 |

**Notes:**

- T-3.6-01 uses snapshot testing to catch accidental schema changes.
- T-3.6-03 requires a mocked connector with known peer/channel counts.

**Red-phase stubs needed:** `packages/town/src/health.test.ts` (per ATDD checklist)

---

## 5. Test Count Summary

| Story | P0 | P1 | P2 | P3 | Total |
|-------|----|----|----|----|-------|
| 3.1 USDC Migration | 2 | 1 | 2 | 0 | **5** |
| 3.2 Chain Config | 4 | 3 | 3 | 0 | **10** |
| 3.3 x402 /publish | 7 | 4 | 2 | 1 | **14** |
| 3.4 Seed Discovery | 0 | 4 | 1 | 1 | **6** |
| 3.5 Service Discovery | 0 | 3 | 2 | 0 | **5** |
| 3.6 /health | 0 | 0 | 3 | 1 | **4** |
| **Total** | **13** | **15** | **13** | **3** | **44** |

### Cross-Story Integration Tests (in addition to per-story tests)

| ID | Boundary | Test | Level | Priority |
|----|----------|------|-------|----------|
| T-INT-01 | 3.1 -> 3.2 | `resolveChainConfig('anvil').usdcAddress` matches deployed FiatTokenV2_2 address | I | P0 |
| T-INT-02 | 3.2 -> 3.3 | EIP-3009 sig signed with resolved chain config passes x402 pre-flight verification | I (real crypto) | P0 |
| T-INT-03 | 3.1 -> 3.3 | `transferWithAuthorization()` on deployed mock USDC settles x402 payment | I (real EVM) | P0 |
| T-INT-04 | 3.5 -> 3.6 | `/health` pricing and capabilities match most recent kind:10035 event content | I | P1 |
| T-INT-05 | x402 -> SDK pipeline | x402-originated packet traverses full SDK pipeline (parse -> verify -> price -> dispatch) with no stage skipped | I | P0 |

**Grand total with integration tests: 49 tests**

---

## 6. Execution Strategy

| Trigger | What Runs | Time Budget | Infrastructure |
|---------|-----------|-------------|----------------|
| **Every PR** | All unit + integration tests (P0-P2) | < 10 min | Anvil container (for EIP-3009 and channel tests) |
| **Nightly** | Full suite including E2E (P0-P3) | < 15 min | Genesis node (deploy-genesis-node.sh) |

**Philosophy:** Run everything in PRs unless it requires the full genesis stack. Most tests run against Anvil directly (single Docker container). Only the 3 E2E tests (P3) require the full genesis node deployment and are deferred to nightly.

**PR test infrastructure:**

- Anvil container at `http://localhost:8545` (chain ID 31337, 10 pre-funded accounts)
- FiatTokenV2_2 deployed at deterministic address
- No Faucet, Connector, or Relay containers needed for PR tests

**Nightly E2E infrastructure:**

- Full genesis stack: Anvil, Faucet, Connector, Relay via `deploy-genesis-node.sh`
- Ports: BLS 3100, Relay 7100, Connector 8080/8081/3000, Faucet 3500, Anvil 8545

---

## 7. Mitigation Plans for High-Priority Risks

### E3-R001: Mock USDC Fidelity (Score: 6)

**Mitigation Strategy:**

1. Deploy Circle's real FiatTokenV2_2 on Anvil (same contract bytecode as production USDC)
2. Test `transferWithAuthorization()` succeeds on Anvil with valid EIP-3009 parameters
3. Test `permit()` (EIP-2612) if used for approval flows
4. Validate that Anvil-deployed contract exposes the same ABI as production USDC

**Owner:** Dev
**Timeline:** Story 3.1
**Verification:** T-3.1-01, T-3.1-02
**Conditional escalation:** If FiatTokenV2_2 cannot be deployed on Anvil, fall back to simplified ERC-20 with `transferWithAuthorization` interface and document the fidelity gap. Escalate risk score to 9.

### E3-R003: Chain Config Injection (Score: 6)

**Mitigation Strategy:**

1. EIP-712 domain separator MUST use chainId from `resolveChainConfig()`, not hardcoded
2. Unit test: all 3 presets return correct values (T-3.2-01 through T-3.2-03)
3. Integration test: EIP-712 signature on wrong chain fails verification (T-3.2-09)

**Owner:** Dev
**Timeline:** Story 3.2
**Verification:** T-3.2-08, T-3.2-09, T-INT-01

### E3-R005: EIP-3009 Signature Verification Bypass (Score: 6)

**Mitigation Strategy:**

1. Pre-flight validation: verify EIP-3009 signature off-chain before submitting to contract (zero gas cost for rejection)
2. Integration test with forged signature -> pre-flight rejects (T-3.3-06)
3. Integration test with valid signature -> settlement proceeds (T-3.3-02)
4. Use real FiatTokenV2_2 on Anvil -- same contract as production

**Owner:** Dev
**Timeline:** Story 3.3
**Verification:** T-3.3-01, T-3.3-02, T-3.3-06

### E3-R006: Settlement Atomicity (Score: 6)

**Mitigation Strategy:**

Two distinct failure modes, both tested:

1. **Sub-scenario A (settlement reverts):** Settlement tx reverts (insufficient USDC balance) -> no ILP PREPARE is ever constructed -> HTTP response indicates payment needed (T-3.3-04)
2. **Sub-scenario B (PREPARE rejected):** Settlement succeeds, ILP PREPARE rejected by destination relay -> NO refund, facilitator retains USDC -> HTTP 200 with settlement tx hash (T-3.3-05)

The no-refund design decision eliminates the refund-based gas griefing vector and simplifies the implementation (no refund queue/retry/tracking).

**Owner:** Dev
**Timeline:** Story 3.3
**Verification:** T-3.3-04, T-3.3-05
**Code-level verification:** Assert that no refund queue, retry logic, or tracking code exists in the x402 handler.

### E3-R007: Packet Equivalence (Score: 6)

**Mitigation Strategy:**

1. Architectural constraint: single shared `buildIlpPrepare()` function used by both x402 and ILP rail paths
2. Integration test: construct ILP PREPARE via x402 path and ILP rail with identical TOON payload -> compare serialized bytes (T-3.3-03)
3. Unit test: `buildIlpPrepare()` sets `amount` field correctly for SDK pricing validator (T-3.3-13)

**Owner:** Dev
**Timeline:** Story 3.3
**Verification:** T-3.3-03, T-3.3-13, T-INT-05
**Conditional escalation:** If shared `buildIlpPrepare()` is not enforced architecturally (two separate construction paths exist), escalate risk score to 9 and add a CI lint rule to prevent divergence.

---

## 8. Entry and Exit Criteria

### Entry Criteria

QA testing for Epic 3 cannot begin until ALL of the following are met:

- [ ] Epic 2 complete (`@toon-protocol/town` relay reference implementation functional)
- [ ] `@toon-protocol/sdk` and `@toon-protocol/town` packages importable
- [ ] Anvil running with deterministic contract addresses
- [ ] Circle FiatTokenV2_2 (mock USDC) deployed on Anvil (or deterministic deployment script ready)
- [ ] Faucet updated to distribute mock USDC (not AGENT token)
- [ ] viem ^2.46 installed in workspace
- [ ] Genesis node deployable via `deploy-genesis-node.sh` (for nightly E2E)

### Exit Criteria

Epic 3 testing is complete when ALL of the following are met:

- [ ] All P0 tests passing (13/13 required)
- [ ] All P1 tests >= 95% passing or failures triaged
- [ ] No open high-priority bugs (E3-R001, E3-R003, E3-R005, E3-R006, E3-R007)
- [ ] Pre-flight validation firewall: 100% branch coverage
- [ ] Packet equivalence verified: x402 and ILP rail produce identical ILP PREPARE bytes
- [ ] No-refund on REJECT enforced and tested
- [ ] EIP-712 domain separator chain-aware across all 3 presets
- [ ] Existing E2E tests pass (`genesis-bootstrap-with-channels.test.ts`) with USDC denomination
- [ ] No AGENT token references in `packages/{core,sdk,town}/src/` (excluding tests)

---

## 9. Resource Estimates

### Test Development Effort

| Priority | Count | Hours/Test | Total Hours | Notes |
|----------|-------|-----------|-------------|-------|
| P0 | 13 + 5 integration | 2.0-3.0 | ~36-54 | EIP-3009 crypto, settlement flows, packet comparison |
| P1 | 15 | 1.0-2.0 | ~15-30 | Discovery, pricing, schema validation |
| P2 | 13 | 0.5-1.0 | ~7-13 | Static analysis, config checks, snapshot tests |
| P3 | 3 | 1.0-2.0 | ~3-6 | Full E2E with genesis node |
| **Total** | **49** | -- | **~61-103 hours** | **~2-3 weeks (1 engineer)** |

### Recommended Story Implementation Order

Based on dependency chain and risk concentration:

1. **Story 3.2** (Chain Config) -- foundation for all chain-dependent code; 10 tests
2. **Story 3.1** (USDC Migration) -- depends on chain config for Anvil preset; 5 tests
3. **Story 3.3** (x402 /publish) -- highest risk, depends on 3.1 + 3.2; 14 tests
4. **Story 3.4** (Seed Relay Discovery) -- independent, can run in parallel; 6 tests
5. **Story 3.5** (kind:10035 Service Discovery) -- depends on 3.1 for USDC pricing; 5 tests
6. **Story 3.6** (/health) -- depends on 3.5 data; 4 tests

This order differs from the dependency chain (3.1 -> 3.2) because `resolveChainConfig()` is needed by USDC migration to know where the mock USDC contract lives, while USDC migration (deploying FiatTokenV2_2) is needed by chain config's EIP-712 integration tests.

---

## 10. Interworking and Regression

### Packages Impacted by Epic 3

| Package | Impact | Regression Scope |
|---------|--------|------------------|
| **@toon-protocol/core** | Chain presets added (`resolveChainConfig`), kind:10035 event builder, seed relay discovery | Core unit tests must pass; new chain/discovery/event tests |
| **@toon-protocol/sdk** | `NodeConfig` extended with chain config, x402 config; pricing denominated in USDC | SDK unit tests must pass with new config fields |
| **@toon-protocol/town** | Express/Hono routes added (`/publish`, enriched `/health`); dual-protocol HTTP+WS server | Existing Town lifecycle tests must pass; new handler/route tests |
| **@toon-protocol/connector** | Untouched (ethers.js architectural debt) | Connector tests unaffected |
| **@toon-protocol/faucet** | Distributes mock USDC instead of AGENT | Faucet config tests updated |
| **@toon-protocol/client** | No code changes; E2E tests validate x402 | E2E regression gate |

### Regression Test Strategy

1. `pnpm -r test` on every PR (catches cross-package regressions from USDC migration)
2. `genesis-bootstrap-with-channels.test.ts` must pass with USDC denomination (nightly)
3. Story 3.1 completion gate: no AGENT references in source code
4. Story 3.3 completion gate: packet equivalence byte-exact match

---

## 11. Relationship to Earlier Test Artifacts

This test plan supersedes and refines `_bmad-output/test-artifacts/test-design-epic-3.md` (dated 2026-03-06), which was the initial draft produced by the TEA test architect workflow. Key differences:

1. **Additional tests:** 49 total (up from 34) -- added cross-story integration tests (T-INT-01 through T-INT-05), pipeline ordering validation for x402-originated packets (T-INT-05), `buildIlpPrepare()` amount field test (T-3.3-13), pricing denomination test (T-3.1-05), relay subscription API usage test (T-3.4-05), and `parseServiceDiscovery()` roundtrip test (T-3.5-05)
2. **Explicit dependency chain documentation:** Story dependency graph with integration boundary analysis
3. **Pipeline ordering invariant:** Explicit analysis of how x402-originated packets interact with the inherited R-001 pipeline ordering risk
4. **Implementation order recommendation:** Risk-based story ordering (3.2 -> 3.1 -> 3.3 -> 3.4 -> 3.5 -> 3.6)
5. **Conditional escalation paths:** E3-R001 and E3-R007 have documented escalation conditions

The ATDD checklist (`_bmad-output/test-artifacts/atdd-checklist-epic-3.md`) remains the authoritative reference for red-phase test stub locations and implementation checklists per story.

---

**Generated by:** Jonathan + Claude Opus 4.6
**Date:** 2026-03-13
