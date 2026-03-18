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

# Test Design: Epic 4 - Marlin TEE Deployment

**Date:** 2026-03-06
**Author:** Jonathan
**Status:** Draft

---

## Executive Summary

**Scope:** Epic-level test design for Epic 4: Marlin TEE Deployment — "From repository to one-command service deployment on Marlin Oyster — starting with the relay as reference implementation."

**Risk Summary:**

- Total risks identified: 10 (8 epic-specific + 2 inherited)
- High-priority risks (>=6): 4 (3 SEC, 1 TECH — trust model risks dominate)
- Critical categories: SEC (attestation forgery, KMS key integrity, bootstrap poisoning), TECH (build reproducibility)

**Coverage Summary:**

- P0 scenarios: 14 (~15-25 hours)
- P1 scenarios: 16 (~20-35 hours)
- P2 scenarios: 4 (~5-10 hours)
- **Total effort**: ~40-70 hours (~1-2 weeks for 1 QA)

---

## Not in Scope

| Item | Reasoning | Mitigation |
|------|-----------|------------|
| **Marlin POND staking** | Operator-only concern, invisible to relay users (Decision 1) | Marlin handles POND staking independently |
| **Multi-chain deployment** | Epic 4 targets Arbitrum One only (Decision 6) | Multi-chain deferred to future epic |
| **x402 payment integration** | Covered by Epic 3; Epic 4 builds on top | Epic 3 test design covers x402 |
| **Oyster CVM platform testing** | Marlin infrastructure, not TOON responsibility | Marlin provides CVM runtime guarantees |
| **Attestation contract verification** | Deferred decision (architecture.md Decision Priority Analysis) | PCR verification is software-only in Epic 4 |

---

## Risk Assessment

### High-Priority Risks (Score >=6)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
|---------|----------|-------------|-------------|--------|-------|------------|-------|----------|
| **R-E4-001** | **SEC** | TEE attestation forgery — kind:10033 events with fake/manipulated PCR values pass peer verification, allowing untrusted code into the network | 2 | 3 | **6** | Cryptographic validation of AWS Nitro attestation document; PCR verification against known-good image hashes | Dev | Story 4.2, 4.3 |
| **R-E4-002** | **TECH** | Nix build non-reproducibility — builds produce different PCR values across environments, collapsing the attestation verification model | 2 | 3 | **6** | CI pipeline verifies PCR reproducibility; Dockerfile determinism constraint (Decision 11) enforced from Epic 2 | Dev | Story 4.5 |
| **R-E4-003** | **SEC** | Nautilus KMS key incompatibility — KMS-derived keys fail nostr-tools Schnorr verification or don't persist across enclave restarts, causing identity loss | 2 | 3 | **6** | Cross-library key derivation validation (NIP-06 path); KMS persistence test across simulated restarts | Dev | Story 4.4 |
| **R-E4-004** | **SEC** | Seed relay list poisoning — malicious kind:10036 events on public Nostr relays point to non-attested nodes, enabling MitM during bootstrap | 2 | 3 | **6** | Attestation-first verification: kind:10033 check before trusting any seed relay's peer list (FR-TEE-6) | Dev | Story 4.6 |

### Medium-Priority Risks (Score 3-5)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
|---------|----------|-------------|-------------|--------|-------|------------|-------|
| R-E4-005 | TECH | Attestation lifecycle state race — valid/stale/unattested transitions cause incorrect peer trust during 30s grace window | 2 | 2 | 4 | State machine unit tests covering all transitions and boundary conditions | Dev |
| R-E4-006 | TECH | PCR measurement registry drift — known-good hash registry becomes stale after legitimate image updates, rejecting valid nodes | 2 | 2 | 4 | Registry update workflow integrated into release process; CI publishes new PCR values | Dev/DevOps |

### Low-Priority Risks (Score 1-2)

| Risk ID | Category | Description | Probability | Impact | Score | Action |
|---------|----------|-------------|-------------|--------|-------|--------|
| R-E4-007 | OPS | supervisord process ordering failure — attestation server starts before relay is ready | 1 | 2 | 2 | Monitor |
| R-E4-008 | DATA | Dual-channel attestation inconsistency — kind:10033 and /health report different attestation states | 1 | 2 | 2 | Monitor |

### Inherited System-Level Risks

| Risk ID | Category | Score | Epic 4 Relevance |
|---------|----------|-------|-------------------|
| R-001 | TECH | 9 | Attestation data flows through same ILP/TOON pipeline — ordering invariant must hold |
| R-005 | DATA | 6 | Payment channels stay open during attestation degradation (Decision 12: "trust degrades; money doesn't") |

### Risk Category Legend

- **TECH**: Technical/Architecture (flaws, integration, scalability)
- **SEC**: Security (access controls, auth, data exposure)
- **DATA**: Data Integrity (loss, corruption, inconsistency)
- **OPS**: Operations (deployment, config, monitoring)

---

## Entry Criteria

- [ ] Epic 3 complete (seed relay discovery, /health endpoint are prerequisites)
- [ ] Marlin Oyster SDK version finalized (Nautilus KMS, oyster-cvm CLI available)
- [ ] AWS Nitro Enclave development environment accessible
- [ ] Known-good PCR hash registry established for test images
- [ ] Architecture decisions 11-12 reviewed and approved

## Exit Criteria

- [ ] All P0 tests passing (100%)
- [ ] All P1 tests passing or failures triaged (>=95%)
- [ ] No open high-priority / high-severity bugs
- [ ] Nix build reproducibility verified in CI
- [ ] Attestation lifecycle (valid/stale/unattested) demonstrated end-to-end
- [ ] No fake attestation data in any test or production environment

---

## Test Coverage Plan

> **Note:** P0/P1/P2/P3 indicate priority and risk level, NOT execution timing. Execution strategy is defined separately below.

### P0 (Critical)

**Criteria:** Blocks core trust model + High risk (>=6) + No workaround

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| T-4.2-01 | kind:10033 event builder produces correct JSON structure per Pattern 14 | Unit | R-E4-001 | enclave, pcr0-2, attestationDoc, version fields |
| T-4.2-02 | kind:10033 event includes required tags: relay, chain, expiry | Unit | — | Pattern 14 compliance |
| T-4.2-03 | kind:10033 content is JSON.stringify() — not plain string | Unit | — | Anti-pattern enforcement (architecture rule 11) |
| T-4.2-07 | Forged attestation document (invalid AWS Nitro signature) detected and rejected | Unit | R-E4-001 | Adversarial input |
| T-4.3-01 | BootstrapService parses kind:10033 events — extracts PCR values and attestation doc | Unit | R-E4-001 | Event parsing correctness |
| T-4.3-02 | BootstrapService verifies PCR values against known-good hash — valid match accepted | Unit | R-E4-001 | Happy path verification |
| T-4.3-03 | BootstrapService rejects mismatched PCR values | Unit | R-E4-001 | Adversarial: tampered PCR |
| T-4.4-01 | KMS-derived Nostr keypair produces valid Schnorr signatures verifiable by nostr-tools | Unit | R-E4-003 | Cross-library compatibility |
| T-4.4-02 | KMS seed derivation follows NIP-06 path — compatible with BIP-39/BIP-32 | Unit | R-E4-003 | Derivation path correctness |
| T-4.5-01 | Nix build produces identical Docker image hash across two consecutive builds | Build | R-E4-002 | Determinism validation |
| T-4.5-02 | Nix build produces identical PCR values across two independent builds | Build | R-E4-002 | PCR reproducibility |
| T-4.6-01 | Seed relay bootstrap verifies kind:10033 before trusting peer list | Unit | R-E4-004 | Attestation-first gate |
| T-4.6-02 | Seed relay with invalid/missing attestation — fallback to next seed relay | Unit | R-E4-004 | Graceful degradation |
| T-RISK-01 | Dual-channel consistency — kind:10033 and /health tee field reflect same state | Unit | R-E4-008 | Single source of truth |

**Total P0**: 14 tests, ~15-25 hours

### P1 (High)

**Criteria:** Critical paths + Medium risk + Common workflows

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| T-4.1-01 | docker-compose-oyster.yml defines correct services, ports, images | Unit | — | Config validation |
| T-4.1-02 | supervisord.conf defines correct process priorities (relay=10, connector=20, attestation=30) | Unit | R-E4-007 | Pattern 16 compliance |
| T-4.1-04 | Oyster CVM deployment — all 3 processes running and healthy | E2E | — | Full deployment validation |
| T-4.2-04 | Attestation server publishes kind:10033 on startup | Unit | — | Lifecycle: initial publish |
| T-4.2-05 | Attestation server refreshes kind:10033 on configurable interval | Unit | R-E4-005 | Lifecycle: refresh cycle |
| T-4.2-06 | /health includes tee field only when running in TEE — never fake attestation | Unit | R-E4-008 | Enforcement guideline 12 |
| T-4.3-04 | BootstrapService prefers TEE-attested relays over non-attested | Unit | — | Peer selection priority |
| T-4.3-05 | Attestation state transitions: valid -> stale after expiry, stale -> unattested after grace | Unit | R-E4-005 | State machine correctness |
| T-4.3-07 | Mixed attested/non-attested peers — connects to attested peer first | Integration | — | Peer selection integration |
| T-4.4-03 | Same KMS seed produces same Nostr pubkey across invocations | Unit | R-E4-003 | Key persistence |
| T-4.4-04 | KMS-derived identity signs kind:10033 events — self-attestation chain | Unit | — | Identity-attestation binding |
| T-4.5-03 | Dockerfile.nix has no non-deterministic build steps | Unit | R-E4-002 | Static analysis: no apt-get update, no unpinned deps |
| T-4.5-04 | CI pipeline verifies PCR reproducibility — two builds, same PCR0 | Build | R-E4-006 | CI integration |
| T-4.6-03 | Seed relay with valid attestation — proceed to kind:10032 peer discovery | Unit | — | Happy path bootstrap |
| T-4.6-04 | All seed relays unattested — node starts but logs warning, no fatal crash | Unit | — | Graceful degradation |
| T-4.6-05 | Full bootstrap: kind:10036 -> connect seed -> verify kind:10033 -> subscribe kind:10032 | Integration | R-E4-004 | End-to-end bootstrap flow |

**Total P1**: 16 tests, ~20-35 hours

### P2 (Medium)

**Criteria:** Edge cases + Low risk

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| T-4.1-03 | supervisord starts processes in correct order — relay ready before attestation publishes | Integration | R-E4-007 | Startup ordering |
| T-4.3-06 | 30s grace window boundary: peer at exactly 30s is stale, at 31s is unattested | Unit | R-E4-005 | Boundary value testing |
| T-4.4-05 | KMS unavailable — node startup fails with clear error, not silent fallback to random key | Unit | — | Failure mode |
| T-RISK-02 | Payment channels remain open when attestation degrades to unattested | Integration | R-005 | Inherited risk validation |

**Total P2**: 4 tests, ~5-10 hours

---

## Execution Strategy

| Cadence | What Runs | Duration |
|---------|-----------|----------|
| **Every PR** | All unit tests (P0 + P1 + P2 unit-level) | < 5 minutes |
| **Nightly** | Integration tests (T-4.3-07, T-4.6-05, T-RISK-02, T-4.1-03) | < 15 minutes |
| **Weekly** | Build reproducibility (T-4.5-01, T-4.5-02, T-4.5-04), E2E CVM deployment (T-4.1-04) | < 30 minutes |

Philosophy: Run everything in PRs if < 15 min. Defer only build reproducibility tests (require full Nix rebuild) and E2E CVM deployment (requires Oyster testnet) to weekly cadence.

---

## Resource Estimates

### Test Development Effort

| Priority | Count | Hours/Test | Total Hours | Notes |
|----------|-------|------------|-------------|-------|
| P0 | 14 | ~1-2 | ~15-25 | Adversarial tests, crypto validation |
| P1 | 16 | ~1-2 | ~20-35 | State machine, integration, CI setup |
| P2 | 4 | ~1-3 | ~5-10 | Edge cases, failure modes |
| **Total** | **34** | — | **~40-70** | **~1-2 weeks** |

### Prerequisites

**Test Data:**

- Mock attestation documents (valid and forged AWS Nitro attestation docs)
- Known-good PCR hash registry fixture
- KMS seed test vectors with expected NIP-06 derived keypairs

**Tooling:**

- Vitest for unit and integration tests
- Nix for reproducible build tests
- Oyster CVM testnet access for E2E deployment tests

**Environment:**

- Nix package manager installed in CI
- AWS Nitro Enclave simulator (or mock) for development
- Oyster testnet credentials for weekly E2E

---

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate**: 100% (no exceptions — these are trust model tests)
- **P1 pass rate**: >=95% (waivers required for failures)
- **P2 pass rate**: >=90% (informational)
- **High-risk mitigations**: 100% complete (R-E4-001 through R-E4-004)

### Coverage Targets

- **Attestation code** (`packages/core/src/events/attestation.ts`): >=80%
- **Bootstrap attestation logic** (`packages/core/bootstrap/`): >=80%
- **Security scenarios**: 100% (all SEC-category risks covered)

### Non-Negotiable Requirements

- [ ] All P0 tests pass
- [ ] No high-risk (>=6) items unmitigated
- [ ] Security tests (SEC category) pass 100%
- [ ] Nix reproducibility verified in CI before merge to main
- [ ] No fake attestation data in any environment (enforcement guideline 12)

---

## Mitigation Plans

### R-E4-001: TEE Attestation Forgery (Score: 6)

**Mitigation Strategy:**
1. Cryptographic validation of AWS Nitro attestation document signature
2. PCR value verification against known-good image hash registry
3. Unit tests with adversarial inputs: forged attestation docs, tampered PCR values, expired attestation

**Owner:** Dev
**Timeline:** Stories 4.2, 4.3
**Status:** Planned
**Verification:** T-4.2-07 (forged doc rejected), T-4.3-02 (valid PCR accepted), T-4.3-03 (invalid PCR rejected)

### R-E4-002: Nix Build Non-Reproducibility (Score: 6)

**Mitigation Strategy:**
1. Nix-based Docker builds with pinned dependencies and no non-deterministic steps
2. CI pipeline runs two independent builds and compares image hashes and PCR values
3. Dockerfile determinism constraint (Decision 11) enforced from Epic 2 onwards

**Owner:** Dev
**Timeline:** Story 4.5
**Status:** Planned
**Verification:** T-4.5-01 (identical image hash), T-4.5-02 (identical PCR), T-4.5-04 (CI verification)

### R-E4-003: Nautilus KMS Key Incompatibility (Score: 6)

**Mitigation Strategy:**
1. KMS seed derivation follows NIP-06 derivation path (BIP-39 -> BIP-32 -> Nostr key)
2. Cross-library validation: KMS-derived keys verified by nostr-tools Schnorr verification
3. Persistence test: same KMS seed produces same pubkey across enclave restarts

**Owner:** Dev
**Timeline:** Story 4.4
**Status:** Planned
**Verification:** T-4.4-01 (Schnorr verification), T-4.4-02 (NIP-06 path), T-4.4-03 (persistence)

### R-E4-004: Seed Relay List Poisoning (Score: 6)

**Mitigation Strategy:**
1. Attestation-first verification: kind:10033 must validate before any seed relay peer list is trusted
2. Invalid/missing attestation triggers fallback to next seed relay in list
3. All seed relays unattested: node starts in degraded mode with warning (no crash)

**Owner:** Dev
**Timeline:** Story 4.6
**Status:** Planned
**Verification:** T-4.6-01 (attestation gate), T-4.6-02 (fallback), T-4.6-05 (full bootstrap flow)

---

## Assumptions and Dependencies

### Assumptions

1. Marlin Oyster SDK and Nautilus KMS are stable and available before Epic 4 starts
2. AWS Nitro attestation document format is well-documented and parseable in TypeScript
3. Nix package manager can produce fully deterministic Docker images for the TOON stack
4. Epic 3 seed relay discovery (kind:10036) and /health endpoint are complete before Story 4.6

### Dependencies

1. **Epic 3 completion** — Seed relay discovery (Story 3.4) and /health endpoint (Story 3.6) are prerequisites for Stories 4.6 and 4.2 respectively
2. **Marlin Oyster SDK** — `oyster-cvm` CLI tool for deployment (Story 4.1)
3. **Nautilus KMS SDK** — Enclave-bound key management (Story 4.4). Integration specifics deferred to epic start (architecture.md Decision Priority Analysis)
4. **Nix package manager** — Required in CI for reproducible builds (Story 4.5)
5. **AWS Nitro Enclave access** — Development/testing environment for attestation document generation

### Risks to Plan

- **Risk**: Nautilus KMS SDK version not finalized at epic start
  - **Impact**: Story 4.4 blocked, delays identity integration
  - **Contingency**: Implement KMS interface with mock, integrate real SDK when available

- **Risk**: Nix build determinism blocked by upstream non-deterministic dependencies
  - **Impact**: Story 4.5 scope expansion, PCR reproducibility delayed
  - **Contingency**: Identify and pin/replace non-deterministic deps early; accept wider build tolerance if needed

---

## Interworking & Regression

| Service/Component | Impact | Regression Scope |
|-------------------|--------|------------------|
| **BootstrapService** (`packages/core/bootstrap/`) | Extended with attestation verification (Stories 4.3, 4.6) | Existing bootstrap tests must pass; seed relay discovery (Epic 3) unaffected |
| **Node entrypoint** (`docker/src/entrypoint.ts`) | KMS integration for identity (Story 4.4) | Existing entrypoint behavior preserved; non-TEE deployments unaffected |
| **/health endpoint** (`packages/town/src/http/health.ts`) | TEE field added (Story 4.2) | Existing /health response fields unchanged; tee field only present in TEE |
| **ILP pipeline** | Attestation data flows through same pipeline (inherited R-001) | Existing E2E test (`genesis-bootstrap-with-channels.test.ts`) must pass |

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

- Epic: `_bmad-output/planning-artifacts/epics.md` (Epic 4: Stories 4.1-4.6)
- Architecture: `_bmad-output/planning-artifacts/architecture.md` (Decisions 11-12, Patterns 14-16)
- Research: `_bmad-output/planning-artifacts/research/technical-marlin-integration-research-2026-03-05.md`
- Decisions: `_bmad-output/planning-artifacts/research/marlin-party-mode-decisions-2026-03-05.md` (Decisions 3, 4, 5, 9, 10, 11)
- System-level test design: `_bmad-output/test-artifacts/test-design-architecture.md` (inherited risks R-001, R-005)

---

**Generated by**: BMad TEA Agent - Test Architect Module
**Workflow**: `_bmad/tea/testarch/test-design`
**Version**: 4.0 (BMad v6)
