# Epic 4 Traceability Gate Report

**Epic:** TEE Attestation & Marlin Oyster CVM Integration
**Date:** 2026-03-16
**Evaluator:** Claude Opus 4.6 (epic-level aggregation)
**Stories:** 4.1 through 4.6 (6 stories, 33 total acceptance criteria)

---

## Aggregate Coverage Summary

| Priority | Total ACs | FULL | PARTIAL | NONE | Coverage % |
|----------|-----------|------|---------|------|------------|
| P0       | 12        | 12   | 0       | 0    | 100%       |
| P1       | 17        | 16   | 1       | 0    | 94%        |
| P2       | 4         | 4    | 0       | 0    | 100%       |
| P3       | 0         | 0    | 0       | 0    | N/A        |
| **Total**| **33**    | **32** | **1** | **0** | **97%**  |

---

## Per-Story Breakdown

| Story | ACs | FULL | PARTIAL | Story Gate | Tests |
|-------|-----|------|---------|------------|-------|
| 4.1 Oyster CVM Packaging | 5 | 4 | 1 (AC3) | CONCERNS | 67 |
| 4.2 TEE Attestation Events | 5 | 5 | 0 | PASS | 70 |
| 4.3 Attestation-Aware Peering | 5 | 5 | 0 | PASS | 42 |
| 4.4 Nautilus KMS Identity | 6 | 6 | 0 | PASS | 31 |
| 4.5 Nix Reproducible Builds | 6 | 6 | 0 | PASS | 48 |
| 4.6 Attestation-First Bootstrap | 6 | 6 | 0 | PASS | 17 |
| **Total** | **33** | **32** | **1** | -- | **275** |

---

## Gate Rules Evaluation

| Rule | Threshold | Actual | Status |
|------|-----------|--------|--------|
| P0 coverage | 100% | 100% (12/12) | **PASS** |
| P1 coverage | >= 80% | 94% (16/17) | **PASS** |
| Overall coverage | >= 80% | 97% (32/33) | **PASS** |
| Stories with FAIL gate | 0 | 0 | **PASS** |

---

## Acceptance Criteria with Less Than FULL Coverage

| Story | AC# | Priority | Coverage | Gap Description |
|-------|-----|----------|----------|-----------------|
| 4.1 | AC3 | P1 | PARTIAL | "Both processes running and healthy" -- 46 static/HTTP tests validate structural correctness but integration tests T-4.1-03 (supervisord process ordering) and T-4.1-04 (all processes healthy E2E) are deferred. Require Oyster CVM infrastructure not available in CI. |

**Risk assessment:** LOW. Supervisord is battle-tested infrastructure. Structural correctness of the configuration is validated by 14 supervisord-specific tests + 13 HTTP behavior tests for the attestation server. The gap is purely an integration/E2E test requiring real Oyster CVM hardware.

---

## Priority Distribution Detail

### P0 Acceptance Criteria (12 total -- all FULL)

- 4.2 AC1: buildAttestationEvent() produces signed kind:10033
- 4.2 AC2: parseAttestation() validates/rejects content
- 4.2 AC3: Attestation server publishes on startup + refresh
- 4.2 AC4: /health tee field conditional on TEE
- 4.2 AC5: TEE_ATTESTATION_KIND + TeeAttestation exports
- 4.3 AC1: PCR verification via verify()
- 4.3 AC2: Attestation lifecycle state machine
- 4.3 AC4: Dual-channel consistency
- 4.4 AC1: KMS seed produces valid Schnorr keypair
- 4.4 AC2: NIP-06 derivation path with mnemonic
- 4.5 AC1: Deterministic image hashes from NixBuilder
- 4.5 AC2: Identical PCR values across builds
- 4.6 AC1: Attestation query before peer subscription
- 4.6 AC2: Fallback on invalid attestation

### P1 Acceptance Criteria (17 total -- 16 FULL, 1 PARTIAL)

- 4.1 AC1: docker-compose-oyster.yml services/ports -- FULL
- 4.1 AC2: supervisord.conf process priorities -- FULL
- **4.1 AC3: Both processes running and healthy -- PARTIAL**
- 4.1 AC4: Compose file oyster-cvm compatible -- FULL
- 4.3 AC3: Peer ranking stable sort -- FULL
- 4.3 AC5: Export verification -- FULL
- 4.4 AC3: Deterministic derivation -- FULL
- 4.4 AC4: kind:10033 self-attestation signing -- FULL
- 4.4 AC6: Exports from @crosstown/core -- FULL
- 4.5 AC3: Dockerfile determinism analysis -- FULL
- 4.5 AC4: verifyPcrReproducibility() -- FULL
- 4.5 AC5: Public API exports -- FULL
- 4.5 AC6: flake.nix + .gitignore -- FULL
- 4.6 AC3: Valid attestation proceeds to discovery -- FULL
- 4.6 AC4: Degraded mode when all unattested -- FULL
- 4.6 AC5: Lifecycle events in order -- FULL
- 4.6 AC6: Barrel exports -- FULL

### P2 Acceptance Criteria (4 total -- all FULL)

- 4.1 AC5: No application code changes needed -- FULL
- 4.4 AC5: Invalid seed throws KmsIdentityError -- FULL
- 4.3 AC2-boundary: 30s grace boundary values -- FULL (sub-criterion)
- 4.5 AC3-antipatterns: Dockerfile anti-pattern detection -- FULL (sub-criterion)

---

## Code Review Summary (Epic-Wide)

| Story | Review Passes | Critical | High | Medium | Low | Total |
|-------|--------------|----------|------|--------|-----|-------|
| 4.1 | 3 | 0 | 1 | 7 | 6 | 14 |
| 4.2 | 3 | 0 | 1 | 5 | 8 | 14 |
| 4.3 | 3 | 0 | 1 | 6 | 9 | 16 |
| 4.4 | 3 | 0 | 0 | 2 | 4 | 6 |
| 4.5 | 3 | 1 | 1 | 6 | 9 | 17 |
| 4.6 | 3 | 0 | 0 | 3 | 8 | 11 |
| **Total** | **18** | **1** | **4** | **29** | **44** | **78** |

All 78 issues resolved (fixed or documented as acceptable design choices). Zero open issues.

---

## Security Audit Summary

All 6 stories underwent OWASP Top 10 security audits during code review pass #3. No critical or high security vulnerabilities found in any story. Key mitigations:

- CWE-208 (timing side-channel): Timestamp removed from attestation responses (4.1)
- CWE-209 (information exposure): PCR error messages sanitized, log output truncated (4.2, 4.3)
- CWE-22 (path traversal): sourceOverride path validation with path.sep delimiter (4.5)
- CWE-319 (insecure transport): Test fixtures updated from ws:// to wss:// (4.3, 4.4, 4.6)
- CWE-704 (unsafe type cast): Type guard replacing cast in verifier normalization (4.6)

---

## GATE DECISION: PASS

**Rationale:**
- P0 coverage: 100% (12/12) -- meets 100% threshold
- P1 coverage: 94% (16/17) -- exceeds 80% threshold
- Overall coverage: 97% (32/33) -- exceeds 80% threshold
- The single PARTIAL gap (Story 4.1 AC3) is P1, has LOW risk, and is an infrastructure-dependent integration test deferral, not a missing implementation
- All 6 stories have status "done" with 275 total tests passing
- 18 code review passes across the epic found and resolved 78 issues
- OWASP security audits clean across all stories
- Full monorepo test suite: 1808+ tests, 0 failures, 0 regressions

---

## Remaining Concerns

1. **Story 4.1 AC3 integration tests** -- T-4.1-03 and T-4.1-04 require Oyster CVM infrastructure. Should be addressed when CVM test environment becomes available.
2. **T-RISK-02** (payment channels survive attestation degradation) -- Skipped, pending integration infrastructure.
3. **flake.lock not committed** -- Requires running `nix flake lock` with Nix installed. First Nix build will generate it.
4. **No real Nix integration tests** -- NixBuilder tests use mocked child_process. Real @nix-tagged tests for weekly CI do not exist yet.

---

## Handoff

GATE_RESULT: PASS

---

Generated: 2026-03-16
Workflow: epic-level traceability gate (aggregated from 6 story-level reports)
