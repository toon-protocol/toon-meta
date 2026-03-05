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
lastSaved: '2026-03-03'
workflowType: 'testarch-test-design'
inputDocuments:
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/epics.md
  - docs/architecture/crosstown-service-protocol.md
---

# Test Design for Architecture: Crosstown SDK

**Purpose:** Architectural concerns, testability gaps, and risk assessment for review by Architecture/Dev teams. Serves as a contract between QA and Engineering on what must be addressed before test development begins.

**Date:** 2026-03-03
**Author:** TEA Master Test Architect
**Status:** Architecture Review Pending
**Project:** Crosstown
**ADR Reference:** `_bmad-output/planning-artifacts/architecture.md`
**Requirements Reference:** `_bmad-output/planning-artifacts/epics.md`

---

## Executive Summary

**Scope:** System-level test design for Crosstown SDK (3 epics, 29 stories, 8 packages). Covers the ILP-Gated Service Node SDK, Nostr Relay reference implementation (Town), and NIP-34 Git Forge (Rig).

**Architecture:**

- **Decision 1:** TOON codec extracted to `@crosstown/core` (unblocks dependency graph)
- **Decision 2-3:** Express 5.2 + Eta 4.5 for Rig web UI
- **Decision 4:** `child_process.execFile` for git operations (no exec)
- **Decision 6:** Identity module in SDK (BIP-39 + NIP-06 derivation)

**Risk Summary:**

- **Total risks**: 14
- **High-priority (>=6)**: 6 risks requiring immediate mitigation
- **Test effort**: ~53 tests (~1.5-3 weeks for 1 QA)

---

## Quick Guide

### BLOCKERS - Team Must Decide

**Pre-Implementation Critical Path** - These MUST be completed before QA can write integration tests:

1. **R-001: TOON Pipeline Stage Ordering** - Architecture must document and enforce the exact stage sequence (shallow parse -> Schnorr verify -> pricing validate -> dispatch) as an invariant. No stage reordering by implementation agents. (recommended owner: Architecture)
2. **R-003: TOON Codec Extraction** - Story 1.0 must complete and all existing BLS/relay tests must pass before SDK tests can begin. This is the critical path prerequisite. (recommended owner: Dev)
3. **R-005: Payment Channel Test Infrastructure** - E2E/integration tests require an Anvil container (loads smart contracts) and Faucet container (funds wallets). The existing `deploy-genesis-node.sh` + `docker-compose-genesis.yml` infrastructure must be documented as test prerequisites. (recommended owner: Dev/DevOps)

**What we need from team:** Complete these 3 items pre-implementation or test development is blocked.

---

### HIGH PRIORITY - Team Should Validate

1. **R-002: Schnorr Verification Bypass** - DevMode toggle must be config-only (no env var override in production). Recommend: `devMode` defaults to `false`, requires explicit opt-in. (implementation phase)
2. **R-004: Git Command Injection** - All Rig git operations must use `execFile` (not `exec`). Recommend: lint rule or code review gate blocking `child_process.exec` in `packages/rig/`. (implementation phase)
3. **R-006: SDK Replacement Regression** - SDK-based relay (Town) must pass existing `genesis-bootstrap-with-channels.test.ts`. Recommend: this E2E test is the SDK completion gate. (Epic 2, Story 2.3)

**What we need from team:** Review recommendations and approve (or suggest changes).

---

### INFO ONLY - Solutions Provided

1. **Test framework**: Vitest with co-located `*.test.ts` files, AAA pattern (consistent with existing)
2. **Test levels**: Unit-first pipeline testing, integration for cross-package, E2E for genesis-bootstrap regression
3. **Execution**: Every PR runs unit + integration (~3-5 min). E2E runs nightly against deployed genesis node.
4. **Coverage**: ~53 test scenarios prioritized P0-P3 with risk-based classification
5. **Test infrastructure**: Anvil container (deterministic contract addresses) + Faucet (ETH + AGENT token distribution) for E2E/integration tests requiring on-chain operations

**What we need from team:** Review and acknowledge.

---

## For Architects and Devs - Open Topics

### Risk Assessment

**Total risks identified**: 14 (6 high-priority score >=6, 5 medium, 3 low)

#### High-Priority Risks (Score >=6) - IMMEDIATE ATTENTION

| Risk ID   | Category | Description                                                                                                                          | Probability | Impact | Score | Mitigation                                                                                  | Owner        | Timeline  |
| --------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------- | ------ | ----- | ------------------------------------------------------------------------------------------- | ------------ | --------- |
| **R-001** | **TECH** | TOON pipeline stage ordering — verifying after full decode trusts the decode; pricing before verify allows payment for forged events | 2           | 3      | **9** | Document invariant in ADR; unit test stage ordering; integration test full pipeline         | Architecture | Pre-impl  |
| **R-002** | **SEC**  | Schnorr verification bypass — devMode toggle leaking to production skips all signature verification                                  | 2           | 3      | **6** | Config-only toggle, default false, no env var override; unit test devMode=false enforcement | Dev          | Story 1.4 |
| **R-003** | **TECH** | TOON codec extraction regression — moving codec from BLS to core breaks encode/decode across packages                                | 2           | 3      | **6** | Roundtrip encode/decode tests in core; BLS + relay import validation after move             | Dev          | Story 1.0 |
| **R-004** | **SEC**  | Git command injection — Rig spawns git via child_process; unsanitized inputs enable shell injection                                  | 2           | 3      | **6** | execFile only (no exec); input sanitization for paths, repo names, patch content            | Dev          | Epic 3    |
| **R-005** | **DATA** | Payment channel state integrity — nonce conflicts, race conditions in on-chain operations can lock funds                             | 2           | 3      | **6** | Nonce retry logic; channel lifecycle integration tests against Anvil                        | Dev          | Story 1.7 |
| **R-006** | **TECH** | SDK replacement E2E regression — subtle pipeline differences break bootstrap/channels/publishing                                     | 3           | 2      | **6** | Existing E2E test suite as SDK completion gate (Story 2.3)                                  | Dev          | Epic 2    |

#### Medium-Priority Risks (Score 3-5)

| Risk ID | Category | Description                                                                                     | Probability | Impact | Score | Mitigation                                                             | Owner |
| ------- | -------- | ----------------------------------------------------------------------------------------------- | ----------- | ------ | ----- | ---------------------------------------------------------------------- | ----- |
| R-007   | TECH     | ConnectorNodeLike structural typing drift — connector API changes break SDK silently at runtime | 2           | 2      | 4     | Integration test matching structural type against real connector       | Dev   |
| R-008   | TECH     | Transit semantics misrouting — isTransit flag swapped causes data loss or forwarding block      | 1           | 3      | 3     | Unit tests for both fire-and-forget and await paths                    | Dev   |
| R-009   | OPS      | Rig relay dependency — relay unavailability breaks issue/PR page rendering                      | 2           | 2      | 4     | Graceful degradation with error page; integration test with relay down | Dev   |
| R-010   | BUS      | Self-write pricing bypass — pubkey format mismatch (hex vs npub) breaks free self-write         | 1           | 3      | 3     | Unit test pubkey format normalization                                  | Dev   |
| R-011   | TECH     | BIP-39/NIP-06 derivation interop — derived keys incompatible with nostr-tools or ethers         | 1           | 3      | 3     | Cross-library key derivation validation                                | Dev   |

#### Low-Priority Risks (Score 1-2)

| Risk ID | Category | Description                                                   | Probability | Impact | Score | Action  |
| ------- | -------- | ------------------------------------------------------------- | ----------- | ------ | ----- | ------- |
| R-012   | BUS      | Eta template port fidelity from Forgejo Go HTML               | 1           | 2      | 2     | Monitor |
| R-013   | DATA     | SQLite repo metadata schema evolution (no migration strategy) | 1           | 2      | 2     | Monitor |
| R-014   | OPS      | Package ESM export configuration for npm publish              | 1           | 1      | 1     | Monitor |

---

### Testability Concerns and Architectural Gaps

**No critical testability blockers identified.** The architecture supports testing well due to structural typing, mocked connectors, and co-located test files.

#### Architectural Improvements Needed

1. **Anvil + Faucet container documentation for test infrastructure**
   - **Current problem**: E2E and integration tests requiring on-chain operations depend on Anvil (smart contracts) and Faucet (wallet funding), but this is only documented in deployment scripts, not in test setup docs
   - **Required change**: Document test infrastructure setup (Anvil container with `DeployLocal.s.sol`, Faucet at port 3500) as test prerequisite
   - **Impact if not fixed**: QA cannot reproduce E2E test environment
   - **Owner**: Dev/DevOps
   - **Timeline**: Pre-Epic 2

---

### Testability Assessment Summary

#### What Works Well

- API-first design with `POST /handle-packet` supports isolated service testing
- Structural `ConnectorNodeLike` typing enables mocked connector injection
- Co-located `*.test.ts` pattern ensures test proximity to source
- TOON codec is pure function (encode/decode) — trivially testable
- Handler pattern (ctx.accept/reject) provides clear assertion points
- Existing E2E test (`genesis-bootstrap-with-channels`) serves as regression gate

#### Accepted Trade-offs

- **Rig relay-sourced data**: Issue/PR pages depend on relay availability. Acceptable for Phase 1; caching layer deferred.
- **System git dependency**: Rig requires `git` binary in PATH. Acceptable; startup verification logs version or exits with clear error.

---

### Risk Mitigation Plans (High-Priority Risks >=6)

#### R-001: TOON Pipeline Stage Ordering (Score: 9) - CRITICAL

**Mitigation Strategy:**

1. Document pipeline stage invariant in architecture as a non-negotiable ordering constraint
2. Unit test each stage independently (shallow parse, verify, price, dispatch)
3. Integration test full pipeline verifying stages execute in order

**Owner:** Architecture + Dev
**Timeline:** Pre-implementation (architecture invariant), Story 1.6 (implementation)
**Status:** Planned
**Verification:** Integration test asserts verify runs before dispatch (inject invalid sig, verify handler never invoked)

#### R-002: Schnorr Verification Bypass (Score: 6)

**Mitigation Strategy:**

1. `devMode` config property defaults to `false`; no environment variable override
2. Unit test: devMode=false + invalid signature = F06 rejection (handler never called)

**Owner:** Dev
**Timeline:** Story 1.4
**Status:** Planned
**Verification:** Unit test with explicitly invalid signatures confirms rejection in production config

#### R-003: TOON Codec Extraction Regression (Score: 6)

**Mitigation Strategy:**

1. Roundtrip encode/decode test in `@crosstown/core` after extraction
2. Run full `pnpm -r test` after codec move to verify no regressions

**Owner:** Dev
**Timeline:** Story 1.0
**Status:** Planned
**Verification:** All existing BLS + relay tests pass with updated import paths

#### R-004: Git Command Injection (Score: 6)

**Mitigation Strategy:**

1. All git operations use `child_process.execFile` (not `exec`)
2. Input sanitization for repo names, paths, and patch content (reject shell metacharacters)
3. Code review gate: no `child_process.exec` calls in `packages/rig/`

**Owner:** Dev
**Timeline:** Epic 3
**Status:** Planned
**Verification:** Unit tests with malicious inputs (path traversal `../`, shell injection `; rm -rf /`)

#### R-005: Payment Channel State Integrity (Score: 6)

**Mitigation Strategy:**

1. Nonce retry logic for blockchain transaction conflicts
2. Integration test: channel open -> deposit -> balance proof -> settle lifecycle against Anvil
3. Test infrastructure: Anvil container with deterministic contract addresses + Faucet for wallet funding

**Owner:** Dev
**Timeline:** Story 1.7, Epic 2
**Status:** Planned
**Verification:** Integration test validates on-chain channel state after each operation

#### R-006: SDK Replacement E2E Regression (Score: 6)

**Mitigation Strategy:**

1. Existing `genesis-bootstrap-with-channels.test.ts` is the SDK completion gate
2. SDK-based relay (Town) must pass all tests in this suite before Story 2.3 is marked done

**Owner:** Dev
**Timeline:** Story 2.3
**Status:** Planned
**Verification:** Full E2E suite passes against SDK-built relay deployed as genesis node

---

### Assumptions and Dependencies

#### Assumptions

1. TOON codec extraction (Story 1.0) completes before SDK development begins
2. Connector API (`ConnectorNode`, `PaymentHandler`) remains stable during SDK development
3. The `@scure/bip39` + `@scure/bip32` libraries produce keys compatible with `nostr-tools` Schnorr verification

#### Dependencies

1. **Anvil + Faucet containers** - Required for all payment channel and E2E tests. Uses `docker-compose-genesis.yml` with deterministic contract addresses (AGENT: `0x5FbDB...`, TokenNetwork: `0xCafac...`). Required by: Story 1.7, Epic 2. **Note**: `deploy-genesis-node.sh` currently deploys the pre-SDK relay/BLS. Once Town (Epic 2) replaces the relay, these scripts will need updating to use the `@crosstown/town` image.
2. **Connector contracts repository** - Must be cloned to `../connector` for Anvil contract deployment (`DeployLocal.s.sol`). Required by: pre-Epic 1.
3. **System `git` binary** - Required in PATH for Rig integration tests. Required by: Epic 3.

---

**End of Architecture Document**

**Next Steps for Architecture Team:**

1. Review Quick Guide and prioritize the 3 blockers
2. Assign owners and timelines for high-priority risks (>=6)
3. Validate assumptions about connector API stability and crypto library interop

**Next Steps for QA Team:**

1. Wait for TOON codec extraction (Story 1.0) to complete
2. Refer to companion QA doc (`test-design-qa.md`) for test scenarios
3. Verify Anvil + Faucet test infrastructure is operational
