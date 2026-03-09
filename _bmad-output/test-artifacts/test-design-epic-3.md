---
stepsCompleted:
  [
    'step-01-detect-mode',
    'step-02-load-context',
    'step-03-risk-and-testability',
    'step-04-coverage-plan',
    'step-05-generate-output',
  ]
lastStep: 'step-05-generate-output'
lastSaved: '2026-03-06'
---

# Test Design: Epic 3 - Production Protocol Economics

**Date:** 2026-03-06
**Author:** Jonathan
**Status:** Draft

---

## Executive Summary

**Scope:** Epic-level test design for Epic 3

**Risk Summary:**

- Total risks identified: 13 (11 epic-specific + 2 inherited)
- High-priority risks (score >=6): 5 (E3-R001, E3-R002, E3-R003, E3-R004, E3-R005)
- Critical categories: SEC (EIP-3009 forgery, gas griefing), TECH (settlement atomicity, packet equivalence), DATA (mock USDC fidelity)

**Coverage Summary:**

- P0 scenarios: 9 (~18-27 hours)
- P1 scenarios: 12 (~12-24 hours)
- P2 scenarios: 10 (~5-10 hours)
- P3 scenarios: 3 (~3-6 hours)
- **Total effort**: ~38-67 hours (~1-2 weeks, 1 engineer)

**Party Mode Decisions (incorporated):**

- **No refund on x402 REJECT** — payment is for routing attempt, not delivery guarantee; mirrors ILP semantics
- **Layered pre-flight validation** — 6 free checks before any on-chain transaction to prevent gas griefing
- **Shared `buildIlpPrepare()`** — x402 and SPSP paths MUST use a single shared function to construct ILP PREPARE packets
- **Destination reachability pre-flight** — check destination connectivity before incurring gas costs

---

## Not in Scope

| Item | Reasoning | Mitigation |
| --- | --- | --- |
| **Epic 2 relay internals** | Prerequisite; tested separately | Epic 2 test design covers SDK-based relay |
| **Epic 4 TEE attestation** | Different epic, different trust model | Covered by Epic 4 test design |
| **Arbitrum One mainnet testing** | Requires real USDC, real gas costs | Mock USDC on Anvil provides full EIP-3009 fidelity (Decision 10) |
| **Multi-node peering E2E** | Requires deploy-peers.sh infrastructure | Deferred to integration testing |
| **ethers.js connector migration** | Explicit architectural debt (Decision 7) | viem for new code only; connector untouched |

---

## Risk Assessment

### High-Priority Risks (Score >=6)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| E3-R001 | SEC | EIP-3009 signature verification bypass — accepting forged `transferWithAuthorization` signatures drains the facilitator or credits unearned USDC | 2 | 3 | 6 | Real FiatTokenV2_2 on Anvil; test forged sigs rejected; test valid sigs accepted | Dev | Story 3.3 |
| E3-R002 | TECH | Settlement atomicity — on-chain USDC transfer succeeds but ILP PREPARE rejected (or vice versa) leaves inconsistent state | 2 | 3 | 6 | Two sub-scenarios: (a) settlement reverts → no PREPARE, (b) PREPARE rejected → no refund, facilitator keeps USDC | Dev | Story 3.3 |
| E3-R003 | TECH | Packet equivalence — x402 `/publish` constructs different ILP PREPARE than SPSP path, causing silent routing or storage failures | 2 | 3 | 6 | Shared `buildIlpPrepare()` function enforced; integration test comparing packet bytes from both paths | Dev | Story 3.3 |
| E3-R004 | DATA | Chain config injection — wrong chainId in EIP-712 domain separator causes valid signatures to fail verification on wrong chain | 2 | 3 | 6 | Chain-aware EIP-712 signing tests across all 3 presets (Anvil 31337, Sepolia 421614, Arbitrum One 42161) | Dev | Story 3.2 |
| E3-R005 | DATA | Mock USDC fidelity — mock ERC-20 on Anvil missing EIP-3009 support or different behavior than production USDC | 2 | 3 | 6 | Deploy Circle's real FiatTokenV2_2 on Anvil (Decision 10); test transferWithAuthorization works identically | Dev | Story 3.1 |

### Medium-Priority Risks (Score 3-5)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E3-R006 | TECH | Seed relay liveness — all seed relays unreachable blocks network join; no fallback to genesis | 2 | 2 | 4 | Fallback test: seed list exhausted → clear error; backward compat test: genesis mode still works | Dev |
| E3-R007 | TECH | Dual-protocol server conflicts — Express routes interfere with WebSocket upgrade on port 7100 | 2 | 2 | 4 | Integration test: concurrent HTTP + WS requests on same port | Dev |
| E3-R008 | BUS | Multi-hop pricing opacity — routing buffer (5-10%) plus destination pricing makes final price unpredictable | 1 | 3 | 3 | Unit test: pricing = destination basePricePerByte * toonLength + routing buffer | Dev |
| E3-R009 | TECH | viem/ethers coexistence — two EVM libraries with different provider patterns create import confusion | 1 | 3 | 3 | Static analysis: grep for ethers imports in Epic 3 code (must be zero); viem-only in new code | Dev |
| E3-R013 | SEC | Gas griefing via x402 — bad actor spams x402 with deliberately-failing authorizations to drain facilitator ETH through gas fees | 1 | 3 | 3 | Layered pre-flight validation: free crypto checks before any on-chain tx; no-refund eliminates reject-based griefing | Dev |

### Low-Priority Risks (Score 1-2)

| Risk ID | Category | Description | Probability | Impact | Score | Action |
| --- | --- | --- | --- | --- | --- | --- |
| E3-R010 | OPS | RPC endpoint reliability — Arbitrum One/Sepolia RPC unavailability | 1 | 2 | 2 | Monitor; env var override for custom RPC |
| E3-R011 | DATA | NIP-33 replaceable event semantics — kind:10035 updates not correctly replacing previous | 1 | 2 | 2 | Monitor; unit test for replaceable event `d` tag |
| E3-R012 | OPS | /health schema stability — response format changes break monitoring | 1 | 1 | 1 | Monitor; snapshot test for schema |

### Inherited System-Level Risks

| Risk ID | Category | Score | Epic 3 Relevance |
| --- | --- | --- | --- |
| R-001 | TECH | 9 | x402 PREPARE packets flow through same TOON pipeline; ordering invariant must hold |
| R-005 | DATA | 6 | USDC channels must survive x402 settlement failures; channel state integrity critical |

### Risk Category Legend

- **TECH**: Technical/Architecture (flaws, integration, scalability)
- **SEC**: Security (access controls, auth, data exposure)
- **DATA**: Data Integrity (loss, corruption, inconsistency)
- **BUS**: Business Impact (UX harm, logic errors, revenue)
- **OPS**: Operations (deployment, config, monitoring)

---

## Entry Criteria

- [ ] Epic 2 complete (@crosstown/town relay reference implementation functional)
- [ ] @crosstown/sdk and @crosstown/town packages importable
- [ ] Anvil running with deterministic contract addresses
- [ ] Circle FiatTokenV2_2 (mock USDC) deployed on Anvil
- [ ] Faucet distributing mock USDC (not AGENT token)
- [ ] Genesis node deployable via deploy-genesis-node.sh
- [ ] viem ^2.46 installed in workspace

## Exit Criteria

- [ ] All P0 tests passing (9/9)
- [ ] P1 tests >=95% passing or failures triaged
- [ ] No open high-priority bugs (E3-R001 through E3-R005)
- [ ] Pre-flight validation firewall: 100% branch coverage
- [ ] Packet equivalence verified: x402 and SPSP produce identical ILP PREPARE bytes
- [ ] No-refund on REJECT enforced and tested
- [ ] EIP-712 domain separator chain-aware across all 3 presets

---

## Test Coverage Plan

> **Note:** P0/P1/P2/P3 indicate priority based on risk and criticality, NOT execution timing. See Execution Strategy for timing.

### P0 (Critical)

**Criteria:** Blocks core functionality + High risk (score >=6) + No workaround

| Test ID | Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 3.3-INT-001 | FR-PROD-3: Pre-flight validation firewall | Integration | E3-R001, E3-R013 | 1 | Dev | 6 free checks: EIP-3009 sig, USDC balance, nonce, TOON parse, Schnorr verify, destination reachability — all before on-chain tx |
| 3.3-INT-002 | FR-PROD-3: x402 happy path (402→payment→200) | Integration | E3-R001, E3-R002 | 1 | Dev | Real FiatTokenV2_2 on Anvil; full 402 negotiation→EIP-3009→settlement→ILP PREPARE→FULFILL |
| 3.3-INT-003 | FR-PROD-3: Packet equivalence (x402 vs SPSP) | Integration | E3-R003 | 1 | Dev | Both paths call shared `buildIlpPrepare()`; compare serialized packet bytes |
| 3.3-INT-004 | FR-PROD-3: Settlement atomicity — revert scenario | Integration | E3-R002 | 1 | Dev | Settlement tx reverts (insufficient balance) → no ILP PREPARE sent, HTTP 402 retry response |
| 3.3-INT-005 | FR-PROD-3: No refund on REJECT | Integration | E3-R002, E3-R013 | 1 | Dev | Settlement succeeds → PREPARE rejected by destination → HTTP 200 with settlement hash, no refund initiated |
| 3.3-INT-006 | FR-PROD-3: EIP-3009 forged signature rejection | Integration | E3-R001 | 1 | Dev | Invalid EIP-3009 sig → pre-flight rejects before settlement; valid sig → proceeds |
| 3.1-INT-001 | FR-PROD-1: USDC channel creation on Anvil | Integration | E3-R005 | 1 | Dev | Real FiatTokenV2_2 supports tokenNetwork.openChannel() with USDC |
| 3.2-UNIT-001 | FR-PROD-2: Chain preset correctness | Unit | E3-R004 | 1 | Dev | resolveChainConfig() returns correct chainId, rpcUrl, usdcAddress for all 3 presets |
| 3.2-INT-001 | FR-PROD-2: EIP-712 chain-awareness | Integration | E3-R004, E3-R005 | 1 | Dev | EIP-712 domain separator uses resolved chainId, not hardcoded; test across Anvil (31337) and Arbitrum One (42161) |

**Total P0**: 9 tests, ~18-27 hours

### P1 (High)

**Criteria:** Important features + Medium risk (3-5) + Common workflows

| Test ID | Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 3.2-UNIT-002 | FR-PROD-2: Env var override (CROSSTOWN_CHAIN) | Unit | E3-R004 | 1 | Dev | Env var overrides config file; CROSSTOWN_RPC_URL overrides preset RPC |
| 3.2-UNIT-003 | FR-PROD-2: Invalid chain name | Unit | — | 1 | Dev | Unknown chain name → clear error message |
| 3.3-INT-007 | FR-PROD-3: x402 disabled returns 404 | Integration | — | 1 | Dev | CROSSTOWN_X402_ENABLED=false → GET /publish → 404 |
| 3.3-INT-008 | FR-PROD-3: Multi-hop pricing with routing buffer | Integration | E3-R008 | 1 | Dev | Price = destination basePricePerByte * toonLength + configurable buffer (5-10%) |
| 3.3-INT-009 | FR-PROD-3: 402 response schema | Integration | — | 1 | Dev | HTTP 402 body contains amount, facilitatorAddress, paymentNetwork, chainId |
| 3.4-INT-001 | FR-PROD-4: Seed relay discovery happy path | Integration | E3-R006 | 1 | Dev | Read kind:10036 → connect to seed → subscribe kind:10032 |
| 3.4-INT-002 | FR-PROD-4: Seed relay fallback on failure | Integration | E3-R006 | 1 | Dev | First seed unreachable → try next; all exhausted → clear error |
| 3.4-INT-003 | FR-PROD-4: Genesis mode backward compatibility | Integration | — | 1 | Dev | discovery: 'genesis' uses existing bootstrap flow unchanged |
| 3.4-INT-004 | FR-PROD-4: Publish kind:10036 seed list event | Integration | — | 1 | Dev | Node publishes its own seed relay entry |
| 3.5-INT-001 | FR-PROD-5: kind:10035 published on bootstrap | Integration | — | 1 | Dev | Service discovery event published after startup |
| 3.5-INT-002 | FR-PROD-5: kind:10035 content correctness | Integration | — | 1 | Dev | Contains service type, ILP address, pricing, x402 endpoint (if enabled) |
| 3.7-INT-001 | FR-PROD-3: Dual-protocol server (HTTP + WS) | Integration | E3-R007 | 1 | Dev | Concurrent HTTP GET /health + WS connection on port 7100 |

**Total P1**: 12 tests, ~12-24 hours

### P2 (Medium)

**Criteria:** Secondary features + Low risk (1-2) + Edge cases

| Test ID | Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 3.1-UNIT-001 | FR-PROD-1: Faucet distributes mock USDC | Unit | — | 1 | Dev | Faucet config updated from AGENT to USDC |
| 3.1-UNIT-002 | FR-PROD-1: "AGENT" references removed | Unit | — | 1 | Dev | Static analysis: grep for AGENT token refs in config/types (must be zero) |
| 3.2-UNIT-004 | FR-PROD-2: Preset type completeness | Unit | — | 1 | Dev | ChainPreset has chainId, rpcUrl, usdcAddress, tokenNetworkAddress, name |
| 3.5-INT-003 | FR-PROD-5: kind:10035 omits x402 when disabled | Integration | — | 1 | Dev | x402 disabled → event advertises ILP-only |
| 3.5-UNIT-001 | FR-PROD-5: kind:10035 replaceable (NIP-33) | Unit | E3-R011 | 1 | Dev | Event has `d` tag for NIP-33 replaceable pattern |
| 3.6-UNIT-001 | FR-PROD-6: /health response schema | Unit | E3-R012 | 1 | Dev | Snapshot test: phase, peerCount, channelCount, pricing, x402, capabilities, chain, version |
| 3.6-INT-001 | FR-PROD-6: /health reflects live state | Integration | — | 1 | Dev | peerCount and channelCount match actual state |
| 3.9-UNIT-001 | FR-PROD-2: viem-only enforcement | Unit | E3-R009 | 1 | Dev | Static analysis: no ethers imports in packages/{core,sdk,town}/src for Epic 3 code |
| 3.3-INT-010 | FR-PROD-3: Pre-flight: insufficient USDC balance | Integration | E3-R013 | 1 | Dev | Balance check fails → reject before settlement tx |
| 3.3-INT-011 | FR-PROD-3: Pre-flight: destination unreachable | Integration | E3-R013 | 1 | Dev | Destination connectivity check fails → reject before settlement tx |

**Total P2**: 10 tests, ~5-10 hours

### P3 (Low)

**Criteria:** Nice-to-have + Exploratory + Full E2E

| Test ID | Requirement | Test Level | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- |
| 3.3-E2E-001 | FR-PROD-3: x402 full E2E with genesis node | E2E | 1 | Dev | Real genesis infra: Anvil + Faucet + Connector + Relay; full 402→payment→store flow |
| 3.4-E2E-001 | FR-PROD-4: Seed relay discovery E2E | E2E | 1 | Dev | Real genesis node + seed list → new peer bootstraps via seed |
| 3.6-E2E-001 | FR-PROD-6: /health E2E with live node | E2E | 1 | Dev | Real genesis node → /health returns correct live state |

**Total P3**: 3 tests, ~3-6 hours

---

## Execution Strategy

| Trigger | What Runs | Time Budget | Infrastructure |
| --- | --- | --- | --- |
| **Every PR** | All unit + integration tests (P0-P2) | < 10 min | Anvil (for USDC contract + EIP-3009 tests) |
| **Nightly** | Full suite including E2E (P0-P3) | < 15 min | Genesis node (deploy-genesis-node.sh) |

**Philosophy:** Run everything in PRs unless it requires the full genesis stack. Most tests run against Anvil directly (no relay/connector needed). Only the 3 E2E tests (P3) require the full genesis node and are deferred to nightly.

**Note:** PR tests require Anvil running for EIP-3009 and channel tests. This is lighter than the full genesis stack (single Docker container vs. 5+ services).

---

## Resource Estimates

### Test Development Effort

| Priority | Count | Hours/Test | Total Hours | Notes |
| --- | --- | --- | --- | --- |
| P0 | 9 | 2.0-3.0 | ~18-27 | EIP-3009 crypto, settlement flows, packet comparison |
| P1 | 12 | 1.0-2.0 | ~12-24 | Discovery, pricing, schema validation |
| P2 | 10 | 0.5-1.0 | ~5-10 | Static analysis, config checks, snapshot tests |
| P3 | 3 | 1.0-2.0 | ~3-6 | Full E2E with genesis node |
| **Total** | **34** | **—** | **~38-67 hours** | **~1-2 weeks (1 engineer)** |

### Prerequisites

**Test Data:**

- Nostr keypair factory (real nostr-tools)
- TOON-encoded event factory (real @crosstown/core codec)
- EIP-3009 authorization factory (viem signTypedData with FiatTokenV2_2 ABI)
- Chain preset fixtures (Anvil, Sepolia, Arbitrum One configs)

**Tooling:**

- Vitest for all test levels
- viem for EIP-3009 signing and on-chain interaction
- Real FiatTokenV2_2 contract on Anvil (Decision 10)
- Real TOON codec from @crosstown/core

**Environment:**

- CI/PR: Anvil container for EIP-3009 + channel tests
- Nightly: Genesis node via deploy-genesis-node.sh (Anvil :8545, Faucet :3500, Relay :7100, BLS :3100, Connector :8080)

---

## Mitigation Plans

### E3-R001: EIP-3009 Signature Verification Bypass (Score: 6)

**Mitigation Strategy:**

1. Pre-flight validation: verify EIP-3009 signature off-chain before submitting to contract
2. Integration test with forged signature → pre-flight rejects (no gas spent)
3. Integration test with valid signature → settlement proceeds
4. Use real FiatTokenV2_2 on Anvil — same contract as production

**Owner:** Dev
**Timeline:** Story 3.3
**Status:** Planned
**Verification:** Forged EIP-3009 sig rejected at pre-flight; valid sig accepted and settles

### E3-R002: Settlement Atomicity (Score: 6)

**Mitigation Strategy:**

1. Sub-scenario A: settlement tx reverts (insufficient balance) → no ILP PREPARE sent, HTTP response indicates payment needed
2. Sub-scenario B: settlement succeeds, ILP PREPARE rejected by destination → NO refund, facilitator retains USDC, HTTP 200 with settlement hash
3. No-refund design eliminates the refund-based gas griefing vector

**Owner:** Dev
**Timeline:** Story 3.3
**Status:** Planned
**Verification:** Test both sub-scenarios; verify no refund queue/retry/tracking code exists

### E3-R003: Packet Equivalence (Score: 6)

**Mitigation Strategy:**

1. Architectural constraint: single shared `buildIlpPrepare()` function used by both x402 and SPSP paths
2. Integration test: construct ILP PREPARE via x402 path and SPSP path with identical event → compare serialized bytes
3. If shared function not enforced, escalate risk score to 9

**Owner:** Dev
**Timeline:** Story 3.3
**Status:** Planned
**Verification:** Byte-exact comparison of ILP PREPARE packets from both paths

### E3-R004: Chain Config Injection (Score: 6)

**Mitigation Strategy:**

1. EIP-712 domain separator MUST use the chainId from resolved chain preset, not hardcoded
2. Unit test: resolveChainConfig() returns correct values for all 3 presets
3. Integration test: EIP-712 signature verification with Anvil chainId (31337) and Arbitrum One chainId (42161) — signature on wrong chain must fail

**Owner:** Dev
**Timeline:** Story 3.2
**Status:** Planned
**Verification:** Cross-chain signature rejection; correct-chain signature acceptance

### E3-R005: Mock USDC Fidelity (Score: 6)

**Mitigation Strategy:**

1. Deploy Circle's real FiatTokenV2_2 on Anvil (Decision 10 — same contract code as production)
2. Test `transferWithAuthorization()` (EIP-3009) works on Anvil deployment
3. Test `permit()` (EIP-2612) if used
4. Coupled with E3-R004: EIP-712 domain separator must include correct chainId

**Owner:** Dev
**Timeline:** Story 3.1
**Status:** Planned
**Verification:** EIP-3009 transferWithAuthorization succeeds on Anvil with same parameters that would work on Arbitrum One

---

## Assumptions and Dependencies

### Assumptions

1. Epic 2 is complete and @crosstown/town relay is functional before Epic 3 starts
2. Circle's FiatTokenV2_2 contract is deployable on Anvil without modifications
3. viem ^2.46 provides full EIP-712 typed data signing support for EIP-3009
4. Arbitrum One USDC contract address is `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` (per Story 3.2)
5. The connector's ethers.js internals are not affected by viem introduction (coexistence per Decision 7)

### Dependencies

1. @crosstown/town package — Required before all Epic 3 stories
2. Circle FiatTokenV2_2 contract source — Required for Story 3.1 (Anvil deployment)
3. viem ^2.46 — Required for Story 3.2+ (chain config, EIP-3009)
4. Genesis node infrastructure — Required for E2E tests (P3)
5. Anvil container — Required for PR-level integration tests (EIP-3009, channels)

### Risks to Plan

- **Risk**: FiatTokenV2_2 deployment on Anvil fails or behaves differently than production
  - **Impact**: All x402 tests blocked; EIP-3009 cannot be validated locally
  - **Contingency**: Fall back to simplified ERC-20 with `transferWithAuthorization` interface; document fidelity gap

- **Risk**: viem EIP-712 support incomplete for EIP-3009 domain separator
  - **Impact**: Cannot sign gasless USDC authorizations in tests
  - **Contingency**: Use raw signTypedData with manual domain construction

---

## Interworking & Regression

| Service/Component | Impact | Regression Scope |
| --- | --- | --- |
| **@crosstown/core** | Chain presets added (resolveChainConfig) | Core tests must pass; new preset tests |
| **@crosstown/sdk** | NodeConfig extended with chain, x402 config | SDK tests must pass with new config fields |
| **@crosstown/town** | Express routes added (/publish, /health) | Existing Town lifecycle tests must pass |
| **@crosstown/connector** | Untouched (ethers.js, architectural debt) | Connector tests unaffected |
| **Faucet** | Distributes mock USDC instead of AGENT | Faucet tests updated for USDC |
| **genesis-bootstrap-with-channels.test.ts** | Must pass with USDC channels | E2E regression gate |

---

## Appendix

### Party Mode Refinements (2026-03-06)

The following refinements were made during party mode discussion with Murat (TEA), Winston (Architect), Amelia (Dev), and Quinn (QA):

1. **E3-R003 conditional escalation**: Packet equivalence stays at score 6 IF shared `buildIlpPrepare()` function is enforced architecturally. If implementation allows separate construction paths, escalate to score 9.

2. **E3-R004/R005 coupling**: Chain config injection and mock USDC fidelity are coupled through the EIP-712 domain separator. The chainId in the domain separator MUST come from `resolveChainConfig()`, not be hardcoded. Test added: 3.2-INT-001.

3. **E3-R002 sub-scenarios**: Settlement atomicity split into two distinct failure modes:
   - (a) Settlement tx reverts → no ILP PREPARE constructed
   - (b) Settlement succeeds but ILP PREPARE rejected → no refund, facilitator retains USDC

4. **Gas griefing attack vector** (user-identified): Bad actors could spam x402 with deliberately-failing EIP-3009 authorizations to drain facilitator ETH through gas fees. Mitigated by layered pre-flight validation: 6 free checks (EIP-3009 sig verify, USDC balance, nonce, TOON shallow parse, Schnorr verify, destination reachability) before any on-chain transaction. Risk E3-R013 scored at 3 with mitigations.

5. **No-refund design decision** (user-identified): Payment is for routing attempt, not delivery guarantee. Mirrors ILP semantics where PREPARE rejection doesn't unwind payment channels. Eliminates refund-based gas griefing vector (attacker can't force double gas payment). Simplifies implementation (no refund queue/retry/tracking). New acceptance criterion added to Story 3.3.

6. **Story 3.4 backward compatibility**: Both `discovery: 'seed-list'` and `discovery: 'genesis'` strategies must be tested.

### Knowledge Base References

- `risk-governance.md` - Risk classification framework
- `probability-impact.md` - Risk scoring methodology
- `test-levels-framework.md` - Test level selection
- `test-priorities-matrix.md` - P0-P3 prioritization

### Related Documents

- Epic: `_bmad-output/planning-artifacts/epics.md` (Epic 3, Stories 3.1-3.6)
- Architecture: `_bmad-output/planning-artifacts/architecture.md` (Decisions 7-10)
- Party Mode Decisions: `_bmad-output/planning-artifacts/research/marlin-party-mode-decisions-2026-03-05.md`
- System-Level Test Design: `_bmad-output/test-artifacts/test-design-architecture.md`

---

## Follow-on Workflows (Manual)

- Run `*atdd` to generate failing P0 tests (separate workflow; not auto-run).
- Run `*automate` for broader coverage once implementation exists.

---

**Generated by**: BMad TEA Agent - Test Architect Module
**Workflow**: `_bmad/tea/workflows/testarch/test-design`
**Version**: 4.0 (BMad v6)
