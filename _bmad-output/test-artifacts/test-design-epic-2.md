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
lastSaved: '2026-03-04'
---

# Test Design: Epic 2 - Nostr Relay Reference Implementation & SDK Validation

**Date:** 2026-03-04
**Author:** Jonathan
**Status:** Draft

---

## Executive Summary

**Scope:** Epic-level test design for Epic 2

**Risk Summary:**

- Total risks identified: 12
- High-priority risks (score >=6): 5
- Critical categories: TECH (SDK replacement equivalence), DATA (TOON fidelity), SEC (NIP-44 crypto)

**Coverage Summary:**

- P0 scenarios: 8 (~16-24 hours)
- P1 scenarios: 10 (~10-20 hours)
- P2/P3 scenarios: 9 (~4-9 hours)
- **Total effort**: ~30-53 hours (~4-7 days)

**User Preference:** Avoid mocks when possible. Use real local infrastructure (SQLite :memory:, real TOON codec, real nostr-tools crypto, Anvil for E2E). Mocks justified only where live infra is unavailable in CI (channel client, connector admin).

---

## Not in Scope

| Item                         | Reasoning                                | Mitigation                      |
| ---------------------------- | ---------------------------------------- | ------------------------------- |
| **Epic 1 SDK internals**     | SDK is a prerequisite; tested separately | SDK has its own test design     |
| **Epic 3 Rig/NIP-34**        | Different epic, different handlers       | Covered by Epic 3 test design   |
| **Performance/load testing** | No NFR-PERF requirements for Epic 2      | Monitor in production           |
| **Multi-node peering E2E**   | Requires deploy-peers.sh infrastructure  | Deferred to integration testing |
| **Docker image publishing**  | Build/CI concern, not functional         | Covered by CI pipeline          |

---

## Risk Assessment

### High-Priority Risks (Score >=6)

| Risk ID | Category | Description                                                                                                                           | Probability | Impact | Score | Mitigation                                                                                                 | Owner | Timeline   |
| ------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------ | ----- | ---------------------------------------------------------------------------------------------------------- | ----- | ---------- |
| E2-R001 | TECH     | SDK replacement behavioral equivalence — SDK-built relay must produce identical behavior to manual wiring in docker/src/entrypoint.ts | 3           | 3      | 9     | E2E validation against genesis node (real infra); compare SDK relay output to existing relay               | Dev   | Sprint 2.3 |
| E2-R002 | DATA     | TOON encode/decode roundtrip fidelity — bit-exact roundtrip required for all event kinds                                              | 2           | 3      | 6     | Real TOON codec in integration tests; bit-exact comparison of input vs decoded output                      | Dev   | Sprint 2.1 |
| E2-R003 | SEC      | NIP-44 encryption interop — SPSP encrypted payloads must be decryptable by both parties                                               | 2           | 3      | 6     | Real NIP-44 encryption with real keypairs in integration tests; cross-verify with nostr-tools              | Dev   | Sprint 2.2 |
| E2-R004 | TECH     | Payment channel ordering during SPSP — channels must be opened BEFORE SPSP handshake completes                                        | 2           | 3      | 6     | E2E test verifying on-chain channel state exists after bootstrap; integration test verifying call ordering | Dev   | Sprint 2.2 |
| E2-R005 | BUS      | Pricing calculation mismatch — basePricePerByte \* toonData.length must match exactly                                                 | 2           | 3      | 6     | Integration test with real pricing calc; verify F04 rejection on underpayment                              | Dev   | Sprint 2.1 |

### Medium-Priority Risks (Score 3-5)

| Risk ID | Category | Description                                                                              | Probability | Impact | Score | Mitigation                                            | Owner |
| ------- | -------- | ---------------------------------------------------------------------------------------- | ----------- | ------ | ----- | ----------------------------------------------------- | ----- |
| E2-R006 | TECH     | Self-write bypass edge cases — node's own pubkey bypass may fail on key format mismatch  | 2           | 2      | 4     | Integration test with real nostr-tools key generation | Dev   |
| E2-R007 | TECH     | SPSP graceful degradation — settlement failure must not crash handler                    | 2           | 2      | 4     | Integration test simulating settlement error          | Dev   |
| E2-R008 | TECH     | Peer registration correctness — ILP address and BTP endpoint must be correctly extracted | 2           | 2      | 4     | Integration test verifying registerPeer() arguments   | Dev   |
| E2-R009 | DATA     | EventStore SQLite transaction safety — concurrent writes must not corrupt state          | 1           | 3      | 3     | SQLite :memory: with concurrent write simulation      | Dev   |
| E2-R010 | OPS      | Lifecycle start/stop ordering — startTown() must initialize subsystems in correct order  | 1           | 3      | 3     | Integration test for lifecycle sequence               | Dev   |

### Low-Priority Risks (Score 1-2)

| Risk ID | Category | Description                                                               | Probability | Impact | Score | Action                                 |
| ------- | -------- | ------------------------------------------------------------------------- | ----------- | ------ | ----- | -------------------------------------- |
| E2-R011 | OPS      | Package dependency cleanliness — stale git-proxy references may remain    | 1           | 2      | 2     | Monitor (cleanup tests already active) |
| E2-R012 | OPS      | Config defaults and CLI parsing — wrong default ports or missing env vars | 1           | 2      | 2     | Monitor (unit tests for config schema) |

### Risk Category Legend

- **TECH**: Technical/Architecture (flaws, integration, scalability)
- **SEC**: Security (access controls, auth, data exposure)
- **DATA**: Data Integrity (loss, corruption, inconsistency)
- **BUS**: Business Impact (UX harm, logic errors, revenue)
- **OPS**: Operations (deployment, config, monitoring)

---

## Entry Criteria

- [x] Epic 1 SDK complete (prerequisite for Stories 2.1-2.3, 2.5)
- [ ] @crosstown/sdk package published and importable
- [ ] Genesis node deployable via deploy-genesis-node.sh (for E2E tests)
- [ ] Anvil running with deterministic contract addresses
- [ ] Faucet running at :3500 for ETH + AGENT token distribution
- [ ] Test data: valid Nostr keypairs, TOON-encoded events, NIP-44 encrypted payloads

## Exit Criteria

- [ ] All P0 tests passing (8/8)
- [ ] All P1 tests passing or failures triaged (>=95%)
- [ ] No open high-priority bugs (E2-R001 through E2-R005)
- [ ] SDK-based relay entrypoint < 100 lines of handler logic
- [ ] All existing E2E tests pass against SDK-based relay

---

## Test Coverage Plan

> **Note:** P0/P1/P2/P3 indicate priority based on risk and criticality, NOT execution timing. See Execution Strategy for timing.

### P0 (Critical)

**Criteria:** Blocks core functionality + High risk (score >=6) + No workaround

| Test ID     | Requirement                              | Test Level  | Risk Link        | Test Count | Owner | Notes                                                    |
| ----------- | ---------------------------------------- | ----------- | ---------------- | ---------- | ----- | -------------------------------------------------------- |
| 2.1-INT-001 | FR-SDK-14: Payment-gated event storage   | Integration | E2-R001, E2-R005 | 1          | Dev   | Real SQLite :memory:, real TOON codec, real pricing calc |
| 2.1-INT-002 | FR-SDK-14: TOON roundtrip fidelity       | Integration | E2-R002          | 1          | Dev   | Bit-exact encode→store→decode comparison                 |
| 2.1-INT-003 | FR-SDK-14: Pricing rejection (F04)       | Integration | E2-R005          | 1          | Dev   | basePricePerByte \* toonData.length validation           |
| 2.1-INT-004 | FR-SDK-14: Self-write bypass             | Integration | E2-R005, E2-R006 | 1          | Dev   | Real nostr-tools signature, own pubkey                   |
| 2.2-INT-001 | FR-SDK-14: NIP-44 SPSP handshake         | Integration | E2-R003          | 1          | Dev   | Real NIP-44 encryption, real keypairs                    |
| 2.2-INT-002 | FR-SDK-14: Settlement + channel ordering | Integration | E2-R004          | 1          | Dev   | Mock channel client (Anvil unavailable in unit CI)       |
| 2.3-E2E-001 | FR-SDK-15: Full bootstrap E2E            | E2E         | E2-R001          | 1          | Dev   | Real genesis node: Anvil + Faucet + Connector            |
| 2.3-E2E-002 | FR-SDK-15: On-chain channel state        | E2E         | E2-R004          | 1          | Dev   | Real Anvil contract state verification                   |

**Total P0**: 8 tests, ~16-24 hours

### P1 (High)

**Criteria:** Important features + Medium risk (3-5) + Common workflows

| Test ID     | Requirement                              | Test Level  | Risk Link | Test Count | Owner | Notes                                          |
| ----------- | ---------------------------------------- | ----------- | --------- | ---------- | ----- | ---------------------------------------------- |
| 2.1-INT-005 | FR-SDK-14: ctx.decode() lazy decode      | Integration | E2-R002   | 1          | Dev   | Real TOON codec, structured field verification |
| 2.1-INT-006 | FR-SDK-14: ctx.accept() metadata         | Integration | —         | 1          | Dev   | Response includes event id, kind, timestamp    |
| 2.2-INT-003 | FR-SDK-14: SPSP graceful degradation     | Integration | E2-R007   | 1          | Dev   | Simulated settlement failure → basic response  |
| 2.2-INT-004 | FR-SDK-14: Peer registration             | Integration | E2-R008   | 1          | Dev   | Mock connector admin for registerPeer() args   |
| 2.2-INT-005 | FR-SDK-14: SPSP unique parameters        | Integration | —         | 1          | Dev   | Two requests → different destination/secret    |
| 2.2-INT-006 | FR-SDK-14: NIP-44 response decryptable   | Integration | E2-R003   | 1          | Dev   | Real nostr-tools nip44                         |
| 2.2-INT-007 | FR-SDK-14: Settlement chain intersection | Integration | E2-R004   | 1          | Dev   | Mock channel client, chain matching logic      |
| 2.3-E2E-003 | FR-SDK-15: SPSP through SDK handler      | E2E         | E2-R001   | 1          | Dev   | Real genesis infra, full SPSP flow             |
| 2.3-E2E-004 | FR-SDK-15: Entrypoint line count         | E2E         | —         | 1          | Dev   | Static analysis: < 100 lines                   |
| 2.3-E2E-005 | FR-SDK-15: Self-write bypass E2E         | E2E         | —         | 1          | Dev   | Genesis publishes own event without payment    |

**Total P1**: 10 tests, ~10-20 hours

### P2 (Medium)

**Criteria:** Secondary features + Low risk (1-2) + Edge cases

| Test ID      | Requirement                       | Test Level  | Risk Link | Test Count | Owner | Notes                                  |
| ------------ | --------------------------------- | ----------- | --------- | ---------- | ----- | -------------------------------------- |
| 2.4-UNIT-001 | FR-SDK-16: git-proxy dir removed  | Unit        | E2-R011   | 1          | Dev   | Filesystem existence check             |
| 2.4-UNIT-002 | FR-SDK-16: No git-proxy deps      | Unit        | E2-R011   | 1          | Dev   | package.json scan                      |
| 2.4-UNIT-003 | FR-SDK-16: No workspace refs      | Unit        | E2-R011   | 1          | Dev   | pnpm-workspace.yaml check              |
| 2.4-UNIT-004 | FR-SDK-16: SDK package exists     | Unit        | —         | 1          | Dev   | @crosstown/sdk package.json validation |
| 2.5-INT-001  | FR-RELAY-1: startTown() lifecycle | Integration | E2-R010   | 1          | Dev   | Real SQLite, no live relay needed      |
| 2.5-UNIT-001 | FR-RELAY-1: TownConfig defaults   | Unit        | E2-R012   | 1          | Dev   | Ports 7100/3100, default pricing       |
| 2.5-UNIT-002 | FR-RELAY-1: API surface exports   | Unit        | —         | 1          | Dev   | startTown, TownConfig exported         |

**Total P2**: 7 tests, ~3-7 hours

### P3 (Low)

**Criteria:** Nice-to-have + Exploratory

| Test ID      | Requirement                          | Test Level  | Test Count | Owner | Notes                          |
| ------------ | ------------------------------------ | ----------- | ---------- | ----- | ------------------------------ |
| 2.5-INT-002  | FR-RELAY-1: Bootstrap peer discovery | Integration | 1          | Dev   | Requires live relay for NIP-02 |
| 2.5-UNIT-003 | FR-RELAY-1: Default port values      | Unit        | 1          | Dev   | Config schema static check     |

**Total P3**: 2 tests, ~1-2 hours

---

## Execution Strategy

| Trigger      | What Runs                            | Time Budget | Infrastructure                            |
| ------------ | ------------------------------------ | ----------- | ----------------------------------------- |
| **Every PR** | All unit + integration tests (P0-P2) | < 5 min     | None (SQLite :memory:, in-process codecs) |
| **Nightly**  | Full suite including E2E (P0-P3)     | < 15 min    | Genesis node (deploy-genesis-node.sh)     |

**Philosophy:** Run everything in PRs unless it requires live infrastructure. Only E2E tests (5 tests requiring Anvil + Faucet + Connector) are deferred to nightly.

---

## Resource Estimates

### Test Development Effort

| Priority  | Count  | Hours/Test | Total Hours      | Notes                                          |
| --------- | ------ | ---------- | ---------------- | ---------------------------------------------- |
| P0        | 8      | 2.0-3.0    | ~16-24           | E2E infra, NIP-44 crypto, channel verification |
| P1        | 10     | 1.0-2.0    | ~10-20           | Integration with real codecs                   |
| P2        | 7      | 0.5-1.0    | ~3-7             | Filesystem checks, config validation           |
| P3        | 2      | 0.5-1.0    | ~1-2             | Simple validation                              |
| **Total** | **27** | **—**      | **~30-53 hours** | **~4-7 days (1 engineer)**                     |

**Note:** All 27 tests have RED-phase implementations (skipped or active). Effort is for making them GREEN — implementing production code and updating test expectations.

### Prerequisites

**Test Data:**

- Nostr keypair factory (real nostr-tools generateSecretKey/getPublicKey)
- TOON-encoded event factory (real encoder from @crosstown/core)
- NIP-44 encrypted payload factory (real nip44 from nostr-tools)

**Tooling:**

- Vitest for all test levels
- SQLite :memory: for EventStore integration tests
- Real nostr-tools for signature + encryption
- Real TOON codec from @crosstown/core

**Environment:**

- CI: No external services needed for unit + integration
- Nightly: Genesis node via deploy-genesis-node.sh (Anvil :8545, Faucet :3500, Relay :7100, BLS :3100, Connector :8080)

---

## Mitigation Plans

### E2-R001: SDK Replacement Behavioral Equivalence (Score: 9)

**Mitigation Strategy:**

1. E2E test (2.3-E2E-001) validates full bootstrap + publish against real genesis node
2. Integration tests (2.1-INT-001 through 2.1-INT-004) verify individual handler behaviors match existing BLS
3. Entrypoint line count test (2.3-E2E-004) ensures SDK abstraction is effective

**Owner:** Dev
**Timeline:** Sprint 2.3 (after handlers implemented)
**Status:** Planned
**Verification:** All existing E2E tests pass against SDK-built relay

### E2-R002: TOON Roundtrip Fidelity (Score: 6)

**Mitigation Strategy:**

1. Integration test (2.1-INT-002) performs bit-exact encode→store→decode comparison
2. Uses real TOON codec from @crosstown/core (no mocks)
3. Tests multiple event kinds (standard events, SPSP events)

**Owner:** Dev
**Timeline:** Sprint 2.1
**Status:** Planned
**Verification:** Decoded NostrEvent fields exactly match original input

### E2-R003: NIP-44 Encryption Interop (Score: 6)

**Mitigation Strategy:**

1. Integration tests (2.2-INT-001, 2.2-INT-006) use real NIP-44 encryption
2. Real keypairs generated via nostr-tools
3. Cross-verify: requester can decrypt response encrypted by handler

**Owner:** Dev
**Timeline:** Sprint 2.2
**Status:** Planned
**Verification:** Decrypted SPSP response contains valid destination + shared secret

### E2-R004: Payment Channel Ordering (Score: 6)

**Mitigation Strategy:**

1. Integration test (2.2-INT-002) verifies openChannel() called before SPSP response
2. E2E test (2.3-E2E-002) verifies on-chain channel state exists on Anvil after bootstrap
3. Known issue: channel creation BEFORE SPSP handshake (fixed 2026-02-26)

**Owner:** Dev
**Timeline:** Sprint 2.2
**Status:** Planned
**Verification:** Anvil contract shows open channel with correct token network address

### E2-R005: Pricing Calculation Mismatch (Score: 6)

**Mitigation Strategy:**

1. Integration test (2.1-INT-003) verifies F04 rejection on underpayment
2. Integration test (2.1-INT-001) verifies acceptance on exact payment
3. Uses real pricing calculation (basePricePerByte \* toonData.length)

**Owner:** Dev
**Timeline:** Sprint 2.1
**Status:** Planned
**Verification:** Underpayment rejected with F04; exact payment accepted

---

## Assumptions and Dependencies

### Assumptions

1. Epic 1 SDK is complete and @crosstown/sdk is importable before Epic 2 development starts
2. TOON codec in @crosstown/core provides identical behavior to current BLS codec
3. deploy-genesis-node.sh produces a working genesis node with Anvil at deterministic addresses
4. SQLite :memory: is sufficient for integration testing (no need for persistent DB)

### Dependencies

1. @crosstown/sdk package — Required before Stories 2.1-2.3, 2.5
2. @crosstown/core TOON codec — Required before Story 2.1
3. Genesis node infrastructure — Required for E2E tests (Story 2.3)
4. Anvil contract addresses — Deterministic from DeployLocal.s.sol

### Risks to Plan

- **Risk**: Epic 1 delayed → Epic 2 cannot start Stories 2.1-2.3
  - **Impact**: 4-7 day slip
  - **Contingency**: Story 2.4 (git-proxy cleanup) is independent and can proceed

---

## Interworking & Regression

| Service/Component                           | Impact                                 | Regression Scope                                               |
| ------------------------------------------- | -------------------------------------- | -------------------------------------------------------------- |
| **@crosstown/bls**                          | Replaced by SDK handler registry       | Existing BLS tests must still pass during transition           |
| **@crosstown/relay**                        | EventStore reused by @crosstown/town   | Relay tests unaffected (shared dependency)                     |
| **@crosstown/core**                         | TOON codec + BootstrapService consumed | Core tests must pass (codec extraction in Epic 1)              |
| **docker/src/entrypoint.ts**                | Superseded by SDK-based entrypoint     | Original entrypoint tests deprecated after SDK relay validated |
| **genesis-bootstrap-with-channels.test.ts** | Must pass against SDK relay            | Existing E2E test is the validation gate                       |

---

## Existing Test Inventory

All 27 tests are already authored in RED phase (skipped or active):

| File                                                        | Tests | Status              | Story | Level           |
| ----------------------------------------------------------- | ----- | ------------------- | ----- | --------------- |
| `packages/town/src/handlers/event-storage-handler.test.ts`  | 6     | RED (describe.skip) | 2.1   | Integration     |
| `packages/town/src/handlers/spsp-handshake-handler.test.ts` | 7     | RED (describe.skip) | 2.2   | Integration     |
| `packages/client/tests/e2e/sdk-relay-validation.test.ts`    | 6     | RED (describe.skip) | 2.3   | E2E             |
| `packages/town/src/cleanup.test.ts`                         | 3     | ACTIVE (passing)    | 2.4   | Unit            |
| `packages/town/tests/e2e/town-lifecycle.test.ts`            | 5     | RED (describe.skip) | 2.5   | Integration/E2E |

**Mock Usage in Existing Tests:**

- **event-storage-handler.test.ts**: No mocks — uses real SQLite :memory:, real TOON, real nostr-tools
- **spsp-handshake-handler.test.ts**: Mocks channel client + admin client (justified: Anvil not available in unit CI)
- **sdk-relay-validation.test.ts**: No mocks — full E2E against real genesis node
- **cleanup.test.ts**: No mocks — filesystem checks
- **town-lifecycle.test.ts**: No mocks — real genesis node for E2E tests

---

## Follow-on Workflows (Manual)

- Run `*atdd` to generate failing P0 tests (separate workflow; not auto-run).
- Run `*automate` for broader coverage once implementation exists.

---

## Appendix

### Knowledge Base References

- `risk-governance.md` - Risk classification framework
- `probability-impact.md` - Risk scoring methodology
- `test-levels-framework.md` - Test level selection
- `test-priorities-matrix.md` - P0-P3 prioritization

### Related Documents

- Epic: `_bmad-output/planning-artifacts/epics.md` (Epic 2, Stories 2.1-2.5)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- System-Level Test Design: `_bmad-output/test-artifacts/test-design-architecture.md`
- System-Level QA Recipe: `_bmad-output/test-artifacts/test-design-qa.md`

---

**Generated by**: BMad TEA Agent - Test Architect Module
**Workflow**: `_bmad/tea/workflows/testarch/test-design`
**Version**: 4.0 (BMad v6)
