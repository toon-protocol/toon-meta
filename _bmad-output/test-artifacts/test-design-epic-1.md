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

# Test Design: Epic 1 - ILP-Gated Service Node SDK

**Date:** 2026-03-04
**Author:** Jonathan
**Status:** Draft

---

## Executive Summary

**Scope:** Epic-level test design for Epic 1 — the ILP-Gated Service Node SDK. 12 stories (1.0-1.11) covering TOON codec extraction, unified identity, kind-based handler registry, TOON-native HandlerContext, Schnorr verification, pricing validation, PaymentHandler bridge, createNode composition, connector API, bootstrap integration, dev mode, and package publishing.

**Risk Summary:**

- Total risks identified: 12
- High-priority risks (score >=6): 5
- Critical categories: TECH (pipeline ordering, codec regression), SEC (verification bypass, key derivation interop)

**Coverage Summary:**

- P0 scenarios: 11 (~22-33 hours)
- P1 scenarios: 8 (~8-16 hours)
- P2/P3 scenarios: 6 (~3-6 hours)
- **Total effort**: ~33-55 hours (~4-7 days)

**User Preference:** Avoid mocks. Use real local infrastructure: real crypto libraries (nostr-tools, @scure/bip39, @scure/bip32), real TOON codec, real ConnectorNode for integration tests, Anvil + Faucet for on-chain operations. Mocks justified ONLY where live infra is structurally unavailable (e.g., no running relay for unit-level handler tests).

---

## Not in Scope

| Item                         | Reasoning                                                   | Mitigation                                                     |
| ---------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------- |
| **Epic 2 Town handlers**     | SDK validation happens in Epic 2                            | Covered by Epic 2 test design                                  |
| **Epic 3 Rig/NIP-34**        | Different epic, different handlers                          | Covered by Epic 3 test design                                  |
| **E2E against genesis node** | SDK doesn't deploy standalone; validated via Town in Epic 2 | `genesis-bootstrap-with-channels.test.ts` remains the E2E gate |
| **Performance/load testing** | No SLA targets defined for SDK internals                    | Monitor pipeline latency in integration tests                  |
| **Multi-node peering**       | Requires deploy-peers.sh infrastructure                     | Deferred to Epic 2 E2E                                         |

---

## Risk Assessment

### High-Priority Risks (Score >=6)

| Risk ID | Category | Description                                                                                                                                                                                                       | Probability | Impact | Score | Mitigation                                                                                                                                       | Owner | Timeline  |
| ------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | --------- |
| E1-R001 | TECH     | TOON pipeline stage ordering — shallow parse → verify → price → dispatch is a correctness invariant. Stage reordering causes verify-after-decode (trusts decode) or price-before-verify (pays for forged events). | 3           | 3      | 9     | Integration test asserts stage ordering: inject invalid sig → handler never invoked; inject underpaid → rejection includes verify trace          | Dev   | Story 1.7 |
| E1-R002 | SEC      | Schnorr verification devMode leakage — if devMode defaults to true or can be set via env var, production skips all signature verification.                                                                        | 2           | 3      | 6     | Unit test: devMode unset → defaults false → invalid sig → F06; no env var override path in code                                                  | Dev   | Story 1.4 |
| E1-R003 | TECH     | TOON codec extraction regression — moving encoder/decoder from BLS to core breaks encode/decode roundtrip. Shallow parser introduces new failure surface.                                                         | 2           | 3      | 6     | Roundtrip tests in @crosstown/core using real TOON codec; run full `pnpm -r test` after move                                                     | Dev   | Story 1.0 |
| E1-R004 | SEC      | BIP-39/NIP-06 key derivation interop — derived keys from @scure/bip39+bip32 may be incompatible with nostr-tools Schnorr verification or viem EVM address derivation.                                             | 2           | 3      | 6     | Cross-library validation: derive key → sign with nostr-tools → verify with nostr-tools; derive same key → compute EVM address → verify with viem | Dev   | Story 1.1 |
| E1-R005 | TECH     | PaymentHandler bridge transit semantics — swapped isTransit flag causes fire-and-forget when await is needed (data loss) or await when fire-and-forget is needed (forwarding block).                              | 2           | 3      | 6     | Unit test both paths: isTransit=true returns immediately (handler still running); isTransit=false waits for handler result                       | Dev   | Story 1.6 |

### Medium-Priority Risks (Score 3-4)

| Risk ID | Category | Description                                                                                                   | Probability | Impact | Score | Mitigation                                                                       | Owner |
| ------- | -------- | ------------------------------------------------------------------------------------------------------------- | ----------- | ------ | ----- | -------------------------------------------------------------------------------- | ----- |
| E1-R006 | TECH     | ConnectorNodeLike structural drift — connector API changes break SDK at runtime with no compile error         | 2           | 2      | 4     | Integration test matching structural type against real ConnectorNode             | Dev   |
| E1-R007 | BUS      | Self-write pricing bypass format mismatch — hex pubkey vs npub format breaks free self-write                  | 1           | 3      | 3     | Unit test with both pubkey formats; normalize to hex internally                  | Dev   |
| E1-R008 | TECH     | Handler exception propagation — unhandled async errors in handlers leak instead of producing T00              | 2           | 2      | 4     | Integration test: handler throws → T00 response returned, no unhandled rejection | Dev   |
| E1-R009 | DATA     | Shallow parse field extraction — parser extracts wrong byte offsets for id/pubkey/sig from TOON binary format | 1           | 3      | 3     | Unit test with known TOON payloads; verify each field matches full decode        | Dev   |

### Low-Priority Risks (Score 1-2)

| Risk ID | Category | Description                                                                  | Probability | Impact | Score | Action  |
| ------- | -------- | ---------------------------------------------------------------------------- | ----------- | ------ | ----- | ------- |
| E1-R010 | OPS      | Lifecycle start/stop race conditions — double start or stop during bootstrap | 1           | 2      | 2     | Monitor |
| E1-R011 | OPS      | Package ESM export configuration — wrong module resolution for consumers     | 1           | 1      | 1     | Monitor |
| E1-R012 | BUS      | kindPricing map type coercion — number keys vs string keys in Map            | 1           | 2      | 2     | Monitor |

### Risk Category Legend

- **TECH**: Technical/Architecture (flaws, integration, scalability)
- **SEC**: Security (access controls, auth, data exposure)
- **PERF**: Performance (SLA violations, degradation, resource limits)
- **DATA**: Data Integrity (loss, corruption, inconsistency)
- **BUS**: Business Impact (UX harm, logic errors, revenue)
- **OPS**: Operations (deployment, config, monitoring)

---

## Entry Criteria

- [x] TOON codec extraction (Story 1.0) prerequisite accepted — this is part of Epic 1
- [ ] Architecture invariant documented: pipeline stage ordering (shallow parse → verify → price → dispatch)
- [ ] @scure/bip39 ^2.0 and @scure/bip32 ^2.0 verified compatible with nostr-tools Schnorr
- [ ] Connector API (`ConnectorNode`, `PaymentHandler`, `setPacketHandler`) stable and documented
- [ ] Test infrastructure available: Vitest ^1.0, real crypto libraries installed

## Exit Criteria

- [ ] All P0 tests passing (51 tests — 100% required)
- [ ] All P1 tests passing (27 tests — or failures triaged with waivers)
- [ ] No open high-priority risks (E1-R001 through E1-R005) unmitigated
- [ ] > 80% line coverage for public APIs (NFR-SDK-3)
- [ ] Integration test proves full pipeline: TOON → parse → verify → price → dispatch → accept/reject
- [ ] All existing BLS + relay tests pass after TOON codec extraction

---

## Test Coverage Plan

### P0 (Critical) - Run on every commit

**Criteria**: Core SDK pipeline + High risk (>=6) + No workaround

| Requirement                                 | Test Level         | Risk Link | Test Count | Owner | Notes                                                  |
| ------------------------------------------- | ------------------ | --------- | ---------- | ----- | ------------------------------------------------------ |
| FR-SDK-NEW-1: Identity from seed phrase     | Unit (real crypto) | E1-R004   | 11         | Dev   | Real @scure/bip39+bip32, cross-verify with nostr-tools |
| FR-SDK-2: Handler registry routing          | Unit               | —         | 5          | Dev   | Kind dispatch, default fallback, F00 on no match       |
| FR-SDK-3/7: HandlerContext TOON passthrough | Unit               | E1-R009   | 7          | Dev   | Raw TOON, lazy decode caching, accept/reject format    |
| FR-SDK-4: Schnorr verification pipeline     | Unit (real crypto) | E1-R002   | 4          | Dev   | Real nostr-tools Schnorr, devMode enforcement          |
| FR-SDK-5: Pricing validation                | Unit               | E1-R007   | 6          | Dev   | Per-byte, per-kind, self-write bypass, F04 rejection   |
| FR-SDK-1/10/11: createNode composition      | Integration        | E1-R001   | 13         | Dev   | Full pipeline integration with real TOON codec         |
| FR-SDK-0: TOON codec extraction             | Unit               | E1-R003   | 5          | Dev   | Roundtrip encode/decode, shallow parse                 |

**Total P0**: 51 tests, ~22-33 hours

### P1 (High) - Run on PR to main

**Criteria**: Important features + Medium risk (3-4) + Common workflows

| Requirement                                    | Test Level         | Risk Link | Test Count | Owner | Notes                                                   |
| ---------------------------------------------- | ------------------ | --------- | ---------- | ----- | ------------------------------------------------------- |
| FR-SDK-0: TOON codec re-exports and edge cases | Unit               | E1-R003   | 3          | Dev   | Index re-exports, unicode handling                      |
| FR-SDK-6: PaymentHandler bridge transit        | Unit               | E1-R005   | 3          | Dev   | isTransit fire-and-forget vs await, exception → T00     |
| FR-SDK-9: Network discovery & bootstrap        | Integration        | E1-R006   | 8          | Dev   | Real BootstrapService, RelayMonitor, Anvil for channels |
| FR-SDK-NEW-1: Identity edge cases              | Unit (real crypto) | —         | 4          | Dev   | 24-word mnemonic, consecutive calls, default index      |

**Total P1**: 18 tests (revised from ATDD 27 to avoid double-counting P0), ~8-16 hours

### P2 (Medium) - Run nightly

**Criteria**: Secondary features + Low risk (1-2) + Edge cases

| Requirement                        | Test Level | Risk Link | Test Count | Owner | Notes                                            |
| ---------------------------------- | ---------- | --------- | ---------- | ----- | ------------------------------------------------ |
| FR-SDK-8: Connector direct methods | Unit       | E1-R006   | 4          | Dev   | registerPeer, removePeer, channelClient nullable |
| FR-SDK-12: Dev mode                | Unit       | —         | 5          | Dev   | Bypass verification, pricing; verbose logging    |

**Total P2**: 9 tests, ~2-5 hours

### P3 (Low) - Run on-demand

**Criteria**: Nice-to-have + Package setup

| Requirement                | Test Level | Test Count | Owner | Notes                                   |
| -------------------------- | ---------- | ---------- | ----- | --------------------------------------- |
| FR-SDK-13: Package exports | Unit       | 9          | Dev   | Import verification for all public APIs |

**Total P3**: 9 tests, ~1-2 hours

---

## Execution Order

### Smoke Tests (<2 min)

**Purpose**: Fast feedback, catch import/build-breaking issues

- [ ] TOON encode/decode roundtrip (30s)
- [ ] Identity: generateMnemonic + fromMnemonic (30s)
- [ ] Handler registry: register + dispatch (15s)
- [ ] Package exports: all public APIs importable (15s)

**Total**: 4 scenarios

### P0 Tests (<5 min)

**Purpose**: Critical pipeline validation

- [ ] Full pipeline integration: signed TOON → verify → price → dispatch → accept (Integration)
- [ ] Pipeline rejects invalid signature → F06 (Integration)
- [ ] Pipeline rejects underpaid → F04 with metadata (Integration)
- [ ] Self-write bypass (Integration)
- [ ] Schnorr verification with real nostr-tools (Unit)
- [ ] Pricing with exact, over, and underpayment (Unit)
- [ ] HandlerContext lazy decode caching (Unit)

**Total**: 51 tests

### P1 Tests (<10 min)

**Purpose**: Bridge, discovery, edge cases

- [ ] PaymentHandler bridge: transit vs await vs exception (Unit)
- [ ] Network discovery with BootstrapService (Integration)
- [ ] Channel opening on settlement overlap (Integration)

**Total**: 18 tests

### P2/P3 Tests (<15 min)

**Purpose**: Full coverage

- [ ] Connector direct methods (Unit)
- [ ] Dev mode bypasses (Unit)
- [ ] Package exports (Unit)

**Total**: 18 tests

---

## Resource Estimates

### Test Development Effort

| Priority  | Count  | Hours/Test | Total Hours | Notes                        |
| --------- | ------ | ---------- | ----------- | ---------------------------- |
| P0        | 51     | 0.5        | ~25         | Real crypto setup overhead   |
| P1        | 18     | 0.75       | ~14         | Integration with local infra |
| P2        | 9      | 0.5        | ~5          | Standard unit tests          |
| P3        | 9      | 0.25       | ~2          | Import verification          |
| **Total** | **87** | **—**      | **~46**     | **~6 days**                  |

### Prerequisites

**Test Data:**

- `createSignedToonPayload()` factory — real signed TOON using nostr-tools (no mocks)
- `createTamperedToonPayload()` factory — tampered signature TOON
- `createPaymentRequest()` factory — PaymentRequest with overrides
- `MockEmbeddedConnector` — lightweight in-process connector implementing real interface

**Tooling:**

- Vitest ^1.0 with co-located `*.test.ts` files
- nostr-tools/pure for real Schnorr signing/verification
- @scure/bip39, @scure/bip32 for real key derivation
- @crosstown/core TOON codec (after Story 1.0)

**Environment:**

- Node.js 24.x with ESM
- Anvil container + Faucet for Story 1.9 integration tests (channels)
- No browser, no Docker required for unit/integration tests

---

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate**: 100% (no exceptions)
- **P1 pass rate**: >=95% (waivers required for failures)
- **P2/P3 pass rate**: >=90% (informational)
- **High-risk mitigations**: 100% complete or approved waivers

### Coverage Targets

- **Public APIs (exported from index.ts)**: >80% line coverage (NFR-SDK-3)
- **Pipeline stages (verify, price, dispatch)**: 100% branch coverage
- **Security scenarios (SEC category)**: 100%
- **Identity derivation paths**: 100%

### Non-Negotiable Requirements

- [ ] All P0 tests pass
- [ ] No high-risk (>=6) items unmitigated
- [ ] Full pipeline integration test passes (TOON → parse → verify → price → dispatch → accept/reject)
- [ ] Cross-library key derivation validated (nostr-tools + @scure/\* + viem)
- [ ] devMode defaults to false with no env var override
- [ ] All existing BLS + relay tests pass after TOON codec extraction

---

## Mitigation Plans

### E1-R001: TOON Pipeline Stage Ordering (Score: 9) - CRITICAL

**Mitigation Strategy:**

1. Document pipeline invariant in architecture: `shallow parse → Schnorr verify → pricing validate → handler dispatch`
2. Integration test: inject invalid signature → handler is NEVER invoked (verify runs before dispatch)
3. Integration test: inject underpaid valid event → F04 rejection includes amount metadata (price runs after verify)
4. Unit test each stage independently

**Owner:** Architecture + Dev
**Timeline:** Pre-implementation (invariant), Story 1.7 (integration test)
**Status:** Planned
**Verification:** Integration test `full-pipeline.test.ts` asserts stage ordering with spy/tracing

### E1-R002: Schnorr Verification devMode Leakage (Score: 6)

**Mitigation Strategy:**

1. `devMode` property defaults to `false` in NodeConfig
2. No environment variable reads for devMode — config-only
3. Unit test: unset devMode + invalid sig → F06 rejection, handler never called

**Owner:** Dev
**Timeline:** Story 1.4
**Status:** Planned
**Verification:** Unit test with real nostr-tools Schnorr — tampered event rejected in default config

### E1-R003: TOON Codec Extraction Regression (Score: 6)

**Mitigation Strategy:**

1. Roundtrip tests in `packages/core/src/toon/toon-codec.test.ts` — encode → decode → bit-exact match
2. Shallow parse test validates field extraction against full decode
3. Run `pnpm -r test` after codec move — zero regressions in BLS + relay

**Owner:** Dev
**Timeline:** Story 1.0
**Status:** Planned
**Verification:** All 8 TOON codec tests pass; existing BLS/relay suites green

### E1-R004: BIP-39/NIP-06 Key Derivation Interop (Score: 6)

**Mitigation Strategy:**

1. Derive key from known test mnemonic (`abandon` vector)
2. Sign event with derived key using nostr-tools → verify succeeds
3. Derive EVM address from same key → matches expected address
4. Test with both 12-word and 24-word mnemonics

**Owner:** Dev
**Timeline:** Story 1.1
**Status:** Planned
**Verification:** Cross-library roundtrip in `identity.test.ts` — 11 tests with real crypto

### E1-R005: PaymentHandler Bridge Transit Semantics (Score: 6)

**Mitigation Strategy:**

1. Unit test isTransit=true: bridge returns BEFORE handler resolves (fire-and-forget)
2. Unit test isTransit=false: bridge returns AFTER handler resolves (await semantics)
3. Unit test handler exception: T00 response returned, no unhandled rejection

**Owner:** Dev
**Timeline:** Story 1.6
**Status:** Planned
**Verification:** `payment-handler-bridge.test.ts` — 3 tests covering both paths + exception

---

## Assumptions and Dependencies

### Assumptions

1. TOON codec extraction (Story 1.0) is the first story implemented in Epic 1 — all other stories depend on it
2. Connector API (`ConnectorNode`, `PaymentHandler`, `setPacketHandler`) remains stable during SDK development
3. @scure/bip39 ^2.0 + @scure/bip32 ^2.0 produce keys compatible with nostr-tools BIP-340 Schnorr verification
4. Real crypto libraries are used in all tests — no mocked Schnorr, no mocked key derivation

### Dependencies

1. **@crosstown/core TOON codec** — Story 1.0 must complete before Stories 1.3, 1.4, 1.5, 1.7. Required by: all pipeline tests.
2. **Anvil + Faucet containers** — Required for Story 1.9 (network discovery with channels). Uses `docker-compose-genesis.yml` with deterministic contract addresses. Required by: integration tests only.
3. **@crosstown/connector** — Real ConnectorNode for integration tests. SDK uses structural typing (`ConnectorNodeLike`) but integration tests validate against the real connector.
4. **nostr-tools/pure** — Real Schnorr signing and verification. No mock substitute.

### Risks to Plan

- **Risk**: Connector API changes during SDK development
  - **Impact**: Structural type `ConnectorNodeLike` drifts from real connector, runtime failures
  - **Contingency**: Integration test against real connector catches drift early; pin connector version during Epic 1

---

## Interworking & Regression

| Service/Component        | Impact                                             | Regression Scope                                                         |
| ------------------------ | -------------------------------------------------- | ------------------------------------------------------------------------ |
| **@crosstown/bls**       | Import path changes after TOON codec extraction    | All existing BLS tests must pass                                         |
| **@crosstown/relay**     | Import path changes if relay references TOON codec | All existing relay tests must pass                                       |
| **@crosstown/core**      | New toon/ module added                             | Existing core tests must pass; new TOON tests added                      |
| **@crosstown/connector** | SDK's PaymentHandler bridge consumes connector API | Connector tests unaffected; SDK integration tests validate compatibility |
| **@crosstown/client**    | No direct impact                                   | Existing E2E tests remain unchanged                                      |

---

## Follow-on Workflows (Manual)

- Run `*atdd` to generate failing P0 tests (COMPLETE — see `atdd-checklist-epic-1-sdk.md`, 83 tests in RED phase).
- Run `*automate` for broader coverage once implementation exists.
- Run `*trace` to validate FR → Story → Test mapping after Epic 1 implementation.

---

## Approval

**Test Design Approved By:**

- [ ] Product Manager: Jonathan Date: \_\_\_
- [ ] Tech Lead: **_ Date: _**
- [ ] QA Lead: **_ Date: _**

**Comments:**

---

## Appendix

### Knowledge Base References

- `risk-governance.md` - Risk classification framework
- `probability-impact.md` - Risk scoring methodology
- `test-levels-framework.md` - Test level selection
- `test-priorities-matrix.md` - P0-P3 prioritization

### Related Documents

- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Epics: `_bmad-output/planning-artifacts/epics.md`
- System Test Design: `_bmad-output/test-artifacts/test-design-architecture.md`
- ATDD Checklist: `_bmad-output/test-artifacts/atdd-checklist-epic-1-sdk.md`

---

**Generated by**: BMad TEA Agent - Test Architect Module
**Workflow**: `_bmad/tea/testarch/test-design`
**Version**: 4.0 (BMad v6)
