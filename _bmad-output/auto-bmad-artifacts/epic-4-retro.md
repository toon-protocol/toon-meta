# Epic 4 Retrospective: TEE Integration -- Marlin Oyster CVM

**Date:** 2026-03-16
**Epic:** 4 -- TEE Integration (Marlin Oyster CVM)
**Packages:** `@toon-protocol/core`, `@toon-protocol/town`, `docker/`
**Status:** Done (6/6 stories complete)
**Branch:** `epic-4`
**Commits:** 6 story commits + 1 traceability gate commit (4fbef06..eb173bb)
**Git range:** `d9e11c8..eb173bb` (epic-3 close to epic-4 end)
**Final test count:** 1,897 total (1,818 passed, 79 skipped, 0 failures)

---

## 1. Executive Summary

Epic 4 delivered the TEE (Trusted Execution Environment) integration layer for the TOON protocol, enabling verifiable code integrity guarantees for relay operators and users. The epic introduced six stories across four architectural layers: enclave packaging (Story 4.1), attestation event protocol (Story 4.2), attestation verification and peer trust (Stories 4.3, 4.6), enclave-bound identity (Story 4.4), and reproducible build infrastructure (Story 4.5).

The most architecturally significant deliverable is the **attestation trust chain** spanning Stories 4.2, 4.3, and 4.6. A TEE relay publishes kind:10033 attestation events containing PCR measurements. The `AttestationVerifier` class provides a state machine (VALID -> STALE -> UNATTESTED) that other components consume. The `AttestationBootstrap` class enforces attestation-first trust during seed relay discovery, verifying kind:10033 events *before* subscribing to a relay's kind:10032 peer list -- mitigating seed relay list poisoning (R-E4-004). This trust chain follows Decision 12: "Trust degrades; money doesn't." -- attestation state changes never trigger payment channel closure.

The most security-critical deliverable is `deriveFromKmsSeed()` (Story 4.4), which creates a cryptographic binding between enclave code integrity and relay identity: the Nautilus KMS seed is only accessible when PCR values are valid, so if the relay code changes, the identity becomes inaccessible. This is the enforcement mechanism that makes attestation consequential rather than advisory.

Story 4.5 (Nix reproducible builds) is the most infrastructure-significant addition, introducing `NixBuilder`, `verifyPcrReproducibility()`, `analyzeDockerfileForNonDeterminism()`, a `flake.nix`, and `Dockerfile.nix`. This enables deterministic Docker image builds where PCR values can be independently verified by anyone with access to the source code.

All 6 stories shipped with 97% acceptance criteria coverage (32/33 ACs FULL, 1 PARTIAL), 275 story-specific tests, 78 code review issues found and fixed across 18 review passes, zero test regressions, zero production security vulnerabilities, and all 6 NFR assessments passing. The monorepo test count grew from 1,558 at epic-3 close to 1,818 at epic-4 close (+260 net new tests, with 275 story-specific tests written).

---

## 2. Delivery Metrics

| Metric | Value |
|--------|-------|
| Stories delivered | 6/6 (100%) |
| Acceptance criteria | 33 total, 32 FULL + 1 PARTIAL (97%) |
| Story-specific tests (actual) | 275 |
| Monorepo test count (start) | 1,558 passing |
| Monorepo test count (end) | 1,818 passing / 79 skipped |
| Total monorepo tests | 1,897 |
| Code review issues found | 78 total |
| Code review issues fixed | 66 |
| Code review issues noted/acknowledged | 12 (design choices) |
| Code review unresolved | 0 |
| Security scan findings (production) | 0 |
| Security scan findings (test fixture) | 5 CWE-319 (ws:// -> wss://) |
| NFR assessments | 6/6 PASS |
| Traceability gate | PASS (P0: 100%, P1: 94%, Overall: 97%) |
| Migrations | 0 |
| Source files changed (excl. artifacts) | 34 |
| Lines added/removed (source only) | +7,357 / -1,289 |
| New runtime dependencies | @scure/bip32, @scure/bip39 |
| New dev dependencies | yaml |
| Frontend impact | None (all 6 stories backend-only) |

### Code Review Breakdown

| Severity | Found | Fixed | Noted | Remaining |
|----------|-------|-------|-------|-----------|
| Critical | 1 | 1 | 0 | 0 |
| High | 4 | 4 | 0 | 0 |
| Medium | 29 | 25 | 4 | 0 |
| Low | 44 | 36 | 8 | 0 |
| **Total** | **78** | **66** | **12** | **0** |

### Code Review by Story

| Story | Pass #1 | Pass #2 | Pass #3 | Total | Final Pass Issues |
|-------|---------|---------|---------|-------|-------------------|
| 4-1 | 4 | 3 | 7 | 14 | 0 (all fixed) |
| 4-2 | 8 | 3 | 3 | 14 | 0 (all fixed) |
| 4-3 | 7 | 4 | 5 | 16 | 0 (4 acknowledged) |
| 4-4 | 2 | 1 | 3 | 6 | 0 (all fixed) |
| 4-5 | 7 | 6 | 4 | 17 | 0 (3 noted) |
| 4-6 | 1 | 2 | 8 | 11 | 0 (all fixed) |

### Security Scan Breakdown

| Story | Method | Findings | Real Issues | Test Fixture Fixes | Action |
|-------|--------|----------|-------------|-------------------|--------|
| 4-1 | Manual review | 0 | 0 | 0 | CWE-208 timing mitigated during CR#3 |
| 4-2 | semgrep (14 rulesets) | 1 | 0 | 0 | False positive suppressed |
| 4-3 | semgrep (217 rules) | 3 | 0 | 3 | ws:// -> wss:// in test fixtures |
| 4-4 | semgrep (266+ rules) | 1 | 0 | 1 | ws:// -> wss:// in test |
| 4-5 | semgrep (440 rules) | 0 | 0 | 0 | Clean scan |
| 4-6 | semgrep | 1 | 0 | 1 | ws:// -> wss:// in test factory |

### NFR Summary

| Story | Rating | Score | Common Concerns |
|-------|--------|-------|-----------------|
| 4-1 | PASS | 23/29 (79%) | Performance baseline, container scanning |
| 4-2 | PASS | -- | Pre-existing infrastructure gaps |
| 4-3 | PASS | -- | Pre-existing infrastructure gaps |
| 4-4 | PASS | 27/29 (93%) | CI pipeline, metrics endpoint |
| 4-5 | PASS | 27/29 (93%) | Scalability baseline, CI metrics |
| 4-6 | PASS | 27/29 (93%) | Infrastructure-level pre-existing |

---

## 3. Successes

### 3.1. TEE Trust Chain Architecture Is Clean and Composable

The most important success of Epic 4 is the clean separation of concerns across the attestation trust chain:

- **Story 4.2** (`attestation.ts`): Builder/parser for kind:10033 events. Pure functions, no state.
- **Story 4.3** (`AttestationVerifier.ts`): State machine + PCR verification. Pure logic, no transport.
- **Story 4.6** (`AttestationBootstrap.ts`): Orchestration layer with DI callbacks. No transport logic.

Each layer has a single responsibility and communicates through typed interfaces. The `AttestationVerifier` is the "single source of truth for attestation state" (R-E4-008) -- both the kind:10033 event path and the /health HTTP endpoint derive their TEE state from the same verifier instance. The `AttestationBootstrap` class uses dependency-injected `queryAttestation` and `subscribePeers` callbacks, keeping orchestration logic fully testable without WebSocket mocks. This layered architecture will make future integration straightforward: wire real WebSocket callbacks into the DI slots.

### 3.2. Decision 12 ("Trust Degrades; Money Doesn't") Is Architecturally Enforced

The design invariant that attestation state changes never trigger payment channel closure is not just documented -- it is structurally enforced. The `AttestationVerifier` has no reference to payment channels. The `AttestationBootstrap` has no reference to payment channels. The attestation state machine (VALID -> STALE -> UNATTESTED) is entirely orthogonal to the payment system. This separation was a deliberate architectural choice that reduces the blast radius of attestation failures: a stale attestation degrades trust ranking but never causes fund loss.

### 3.3. Cryptographic Identity Binding Is the Enforcement Mechanism

Story 4.4's `deriveFromKmsSeed()` creates the enforcement mechanism that makes the entire TEE trust chain consequential. Without it, attestation would be advisory -- a relay could claim to be attested without any consequences for lying. With KMS-derived identity, the relay's Nostr keypair is cryptographically bound to its enclave code integrity: change the code, PCR values change, KMS seed becomes inaccessible, identity is lost. This is the strongest possible enforcement: not just detection of code changes, but automatic loss of identity and reputation.

The implementation demonstrates careful security practices: strict input validation (never falls back to random keys), intermediate key material zeroing via `HDKey.wipePrivateData()` in a finally block, defensive copies of returned key material, and a custom `KmsIdentityError` that signals a security-critical condition.

### 3.4. Zero Test Regressions Across 275 New Tests

The monorepo test count grew from 1,558 to 1,818 (+260 net) with 275 story-specific tests written and zero regressions. This is the fourth consecutive epic with zero regressions, validating that the test pipeline's regression checking is working correctly and that the architecture's module boundaries prevent cross-package interference.

### 3.5. Code Review Pass #3 Continued to Find Distinct Security Issues

The three-pass code review model again demonstrated its value, with Pass #3 consistently finding security-relevant issues that Passes #1 and #2 missed:

- **Story 4.1 CR#3**: CWE-208 timing side-channel (timestamp in attestation response), pinned pnpm version for reproducibility (7 issues, highest count of all 3 passes)
- **Story 4.3 CR#3**: Number.isFinite() guard for non-finite attestedAt values, stale comment cleanup
- **Story 4.4 CR#3**: HDKey material not wiped after derivation -- the most security-critical find of the epic
- **Story 4.5 CR#3**: CWE-22 path traversal via startsWith prefix collision
- **Story 4.6 CR#3**: Unsafe type cast replaced with type guard, defensive array copy (8 issues -- highest of all 3 passes)

The pattern of Pass #3 finding the *most* issues (in Stories 4.1 and 4.6) is noteworthy. The OWASP-focused security audit in Pass #3 is surfacing issues that structure-focused (Pass #1) and logic-focused (Pass #2) reviews miss.

### 3.6. One Commit Per Story Maintained

All 6 stories follow the `feat(4-N):` pattern with descriptive commit messages. The 1-commit-per-story convention held for the fourth consecutive epic.

### 3.7. Story 4.4 Was the Leanest Story in Epic 4 -- and the Most Security-Critical

Story 4.4 (Nautilus KMS identity) completed in ~75 minutes with only 6 code review issues and 31 tests. Despite being the smallest story by these metrics, it delivers the most security-critical functionality: the cryptographic binding between enclave integrity and relay identity. This validates that security-critical stories can be small and focused -- the function is ~120 lines with strict validation and no optional behavior.

### 3.8. All NFR Assessments Passed

For the first time across all epics, all 6 stories received PASS NFR ratings. The recurring concerns (CI metrics, performance baseline) are pre-existing infrastructure gaps carried since Epic 1, not story-level regressions. This indicates that the code quality floor has stabilized at a high level.

---

## 4. Challenges

### 4.1. No Epic Start Commit -- Zero Retro Action Items Resolved

Unlike Epic 3 (which resolved 6 of 13 action items from the Epic 2 retro in its start commit), Epic 4 jumped directly into Story 4.1 with no epic start commit addressing prior action items. Of the 15 action items from the Epic 3 retro:

| Action | Status After Epic 4 |
|--------|---------------------|
| A1: Deploy FiatTokenV2_2 on Anvil | NOT ADDRESSED |
| A2: CI genesis node (carried 4 epics) | NOT ADDRESSED |
| A3: Research Marlin Oyster CVM | ADDRESSED (by Story 4.1 implementation) |
| A4: Project-level semgrep config | NOT ADDRESSED |
| A5: Transitive dependency audit (carried 3 epics) | NOT ADDRESSED |
| A6: Structured logger (carried 4 epics) | NOT ADDRESSED |
| A7: Wire viem clients in startTown() | NOT ADDRESSED |
| A8: Facilitator ETH monitoring | NOT ADDRESSED |
| A9: Refactor SDK publishEvent() | NOT ADDRESSED |
| A10: Docker entrypoint config fields | NOT ADDRESSED |
| A11: Split large test files | NOT ADDRESSED |
| A12: Deferred P3 E2E tests | NOT ADDRESSED |
| A13: NIP-33/NIP-16 doc discrepancy | NOT ADDRESSED |
| A14: Publish @toon-protocol/town to npm | NOT ADDRESSED |
| A15: Prettier before committing | NOT ADDRESSED |

While A3 was implicitly addressed by the epic's implementation work, the absence of a dedicated epic start pass means 14 of 15 action items carry forward unresolved. Several of these (A2: CI genesis node, A6: structured logger) have now been deferred for 4 consecutive epics. This is the most significant process regression in Epic 4.

### 4.2. Deferred Integration Tests Accumulating

Epic 4 added new deferred integration tests to the existing backlog:

- **Story 4.1**: T-4.1-03 (supervisord process ordering), T-4.1-04 (all processes healthy E2E) -- require Oyster CVM infrastructure
- **Story 4.5**: No real Nix integration tests -- all NixBuilder tests use mocked `child_process`
- **Story 4.6**: T-RISK-02 (payment channels survive attestation degradation) -- pending integration infrastructure
- **Story 4.6**: No E2E/integration tests with real WebSocket transport

Combined with the Epic 3 deferred tests (T-3.4-12, 3.6-E2E-001), the project now has at least 6 explicit deferred integration/E2E test items. While each individual deferral is low-risk (the tested-by-proxy coverage is strong), the cumulative gap means the project has never validated the *integration* of its TEE components with real infrastructure.

### 4.3. Test File Size Continues to Grow

Large test files remain a challenge. Notable examples from Epic 4:

| Test File | Lines | Tests |
|-----------|-------|-------|
| `attestation.test.ts` (4.2) | 1,342+ | 61 |
| `AttestationVerifier.test.ts` (4.3) | 1,058 | 42 |
| `nix-reproducibility.test.ts` (4.5) | 904+ | 48 |
| `attestation-bootstrap.test.ts` (4.1/4.6) | 531+ | 17 (active) + skipped stubs |

The test file for `attestation.test.ts` exceeds 1,300 lines. The multi-stage test amplification pipeline (ATDD -> automate -> review -> gap-fill -> code review additions) naturally produces large test files because tests accumulate across stages. Action A11 (split large test files) from Epic 3 was not addressed.

### 4.4. Mocked External Dependencies Create Fidelity Gaps

All Nix-related tests mock `child_process.execFile`. All attestation server tests mock the HTTP layer rather than testing against a real Oyster CVM attestation endpoint. The `deriveFromKmsSeed()` tests use synthetic seeds, not real Nautilus KMS output. While mocking is the correct testing strategy for unit/integration tests, the project lacks any mechanism to validate that these mocks accurately model the real external systems. The `flake.lock` not being committed (requires Nix tooling) is a concrete example: the `flake.nix` has never been executed.

### 4.5. Dockerfile.oyster Builder Stage Sync Is Manual

Story 4.1's `Dockerfile.oyster` duplicates the builder stage from the base `docker/Dockerfile`. Changes to the base Dockerfile must be manually synced. This was documented with a sync comment, but it is a maintenance burden that will cause drift.

---

## 5. Key Insights

### 5.1. Attestation as a Trust Gradient, Not a Binary Gate

The most important architectural insight from Epic 4 is the treatment of attestation as a *gradient* rather than a binary gate. The three-state lifecycle (VALID -> STALE -> UNATTESTED) with configurable validity and grace periods means the system degrades gracefully rather than failing catastrophically. A relay whose attestation is 1 second past validity becomes STALE (still usable, ranked lower), not immediately untrusted. This design acknowledges the reality of distributed systems where clock skew, network partitions, and attestation refresh timing create edge cases that binary trust models handle poorly.

The `AttestationBootstrap` class extends this gradient to bootstrap: if no attested seed relays are found, it degrades to `mode: 'degraded'` rather than failing entirely. This means a new node can still bootstrap in an environment where TEE infrastructure is not yet fully deployed.

### 5.2. DI Callbacks Are Superior to Interface Inheritance for Orchestration

Story 4.6's `AttestationBootstrap` uses dependency-injected callback functions (`queryAttestation`, `subscribePeers`) rather than requiring callers to implement an interface or subclass. This made the class trivially testable -- tests provide inline async functions -- and avoids the ceremony of interface definitions for what are fundamentally two function signatures. This pattern should be preferred for future orchestration classes that coordinate multiple I/O operations.

### 5.3. Static Analysis Testing Scales Well to Infrastructure Code

The static analysis testing pattern (reading config files, parsing YAML/Dockerfile syntax, asserting structural properties) was extended from TypeScript source code (Epics 2-3) to infrastructure code (Epic 4). Story 4.1's `oyster-config.test.ts` has 54 tests that parse `docker-compose-oyster.yml`, `supervisord.conf`, and `Dockerfile.oyster` to verify structural correctness. Story 4.5's `nix-reproducibility.test.ts` parses `flake.nix` and `Dockerfile.nix`. This approach validates infrastructure configuration *without* requiring the infrastructure to be running, catching configuration errors at test time rather than deployment time.

### 5.4. New Runtime Dependencies Were Minimal and Targeted

Epic 4 added only two new runtime dependencies: `@scure/bip32` and `@scure/bip39` (for BIP-32 HD key derivation and BIP-39 mnemonic support in Story 4.4). Both are from the `@scure` family by Paul Miller, the same author as `@noble/curves` already used in the project. This consistency in dependency authorship reduces supply chain risk. The `yaml` package was added as a dev dependency only (for parsing YAML in tests). No heavy frameworks or large dependency trees were introduced.

### 5.5. Test Amplification Ratio Varies with Story Pattern

The test amplification pattern continued from Epic 3, with clear correlation between story complexity and amplification:

| Story | ATDD Tests | Final Tests | Ratio | Pattern |
|-------|-----------|-------------|-------|---------|
| 4-1 | 32 | 67 | 2.1x | Infrastructure (broad static analysis) |
| 4-2 | 31 | 70 | 2.3x | Event protocol (builder/parser + lifecycle) |
| 4-3 | 12 | 42 | 3.5x | Pure logic (deep edge cases) |
| 4-4 | 8 | 31 | 3.9x | Cryptographic (strict validation paths) |
| 4-5 | 33 | 48 | 1.5x | Build tooling (complex mocking) |
| 4-6 | 10 | 17 | 1.7x | Orchestration (DI-based, focused) |

Stories with strict input validation (4.4: cryptographic derivation) amplified the most because each validation path requires its own test. Orchestration stories (4.6) amplified the least because DI callbacks reduce the number of paths to test. The epic average of 2.3x is lower than Epic 3's 5.0x, reflecting that TEE stories tend to have clearer boundaries and fewer cross-cutting interactions.

### 5.6. Pre-Existing Infrastructure Gaps Are Becoming the Dominant Quality Concern

All 6 NFR assessments passed, but every assessment flagged the same 2 pre-existing infrastructure gaps: no CI pipeline/metrics and no performance baseline. These are the *only* concerns preventing 29/29 NFR scores. The gap has been documented since Epic 1, making it a 4-epic-old concern. At this point, the infrastructure gaps are the single largest quality risk in the project -- larger than any story-level technical debt.

---

## 6. Action Items for Epic 5

### 6.1. Must-Do (Blockers or High Priority)

| # | Action | Owner | Status | Carried From | Reason |
|---|--------|-------|--------|-------------|--------|
| A1 | **Set up CI pipeline with genesis node** | Dev | OPEN | Epic 1 A2, 2 A2, 3 A2 | 4 epics deferred. 6+ integration tests cannot be validated without infrastructure. This is the single highest-priority item. |
| A2 | **Implement structured logging** | Dev | OPEN | Epic 1 A4, 2 A6, 3 A6 | 4 epics deferred. TEE enclave observability requires structured logging. DVM job execution (Epic 5) will need log correlation. |
| A3 | **Deploy FiatTokenV2_2 on Anvil** | Dev | OPEN | Epic 3 A1 | Mock USDC uses 18 decimals. DVM compute settlement (Epic 5 Story 5-3) will need proper USDC semantics. |
| A4 | **Address transitive dependency vulnerabilities** | Dev | OPEN | Epic 2 A5, 3 A5 | 3 epics deferred. Run `pnpm audit` with current dependency tree including @scure/bip32, @scure/bip39. |
| A5 | **Create project-level semgrep configuration** | Dev | OPEN | Epic 3 A4 | CWE-319 false positives for ws:// in test fixtures continue. 5 found in Epic 4. |

### 6.2. Should-Do (Quality Improvements)

| # | Action | Owner | Status | Reason |
|---|--------|-------|--------|--------|
| A6 | **Wire viem clients in startTown()** | Dev | OPEN | Epic 3 A7. Production x402 facilitators need this wiring. |
| A7 | **Update Docker entrypoint-town.ts for new config fields** | Dev | OPEN | Epic 3 A10. Entrypoint should consume TEE config, use `createHealthResponse()`. |
| A8 | **Refactor SDK publishEvent() to use shared buildIlpPrepare()** | Dev | OPEN | Epic 3 A9. Code consistency. |
| A9 | **Run deferred integration tests when CVM infra available** | Dev | OPEN | T-4.1-03, T-4.1-04, T-RISK-02 + Epic 3 deferred tests. |
| A10 | **Split large test files** | Dev | OPEN | Epic 3 A11. attestation.test.ts (1,342 lines), AttestationVerifier.test.ts (1,058 lines) added to the list. |
| A11 | **Commit flake.lock after first Nix build** | Dev | OPEN | Story 4.5 gap. Required for reproducible builds. |
| A12 | **Add real Nix integration tests with @nix tag** | Dev | OPEN | All NixBuilder tests are mocked. Weekly CI should run real builds. |
| A13 | **Extract Dockerfile.oyster builder stage to shared base** | Dev | OPEN | Manual sync with base Dockerfile is fragile. |

### 6.3. Nice-to-Have

| # | Action | Owner | Reason |
|---|--------|-------|--------|
| A14 | **Publish @toon-protocol/town to npm** | Dev | Carried from Epic 2 A3, 3 A14 |
| A15 | **Ensure code review agents run Prettier** | Tooling | Carried from Epic 1 A9, 2 A11, 3 A15 |
| A16 | **Fix NIP-33/NIP-16 doc discrepancy** | Dev | Carried from Epic 3 A13 |
| A17 | **Set up facilitator ETH monitoring** | Dev | Carried from Epic 3 A8 |
| A18 | **Migrate entrypoint-town.ts health to createHealthResponse()** | Dev | Story 4.2 follow-up task |

---

## 7. Epic 5 Preparation Tasks

Epic 5 (DVM Compute Marketplace) has 4 stories:

| Story | Title | Key Features |
|-------|-------|-------------|
| 5-1 | DVM Event Kind Definitions | kind:5xxx/6xxx/7xxx event builders and parsers |
| 5-2 | ILP-Native Job Submission | Job request -> ILP PREPARE -> handler dispatch |
| 5-3 | Job Result Delivery and Compute Settlement | Result events, USDC settlement, payment verification |
| 5-4 | Skill Descriptors in Service Discovery | kind:10035 enrichment with DVM capability advertising |

### Preparation Checklist

- [ ] **Resolve A1** (CI pipeline) -- 4 epics deferred. DVM testing will require live infrastructure for job routing.
- [ ] **Resolve A2** (structured logging) -- 4 epics deferred. Job execution needs log correlation.
- [ ] **Resolve A3** (FiatTokenV2_2) -- DVM settlement requires proper USDC semantics.
- [ ] **Review NIP-90 DVM specification** -- Stories 5-1 through 5-3 implement NIP-90 Data Vending Machine protocol.
- [ ] **Review existing kind:10035 service discovery** -- Story 5-4 extends the service discovery events from Epic 3 Story 3.5.
- [ ] **Assess ILP handler registration for DVM kinds** -- Story 5-2 routes DVM job requests through the existing ILP handler pipeline.
- [ ] **Create ATDD stubs for Epic 5 stories** -- Following validated pattern.
- [ ] **Create Epic 5 test design document** -- Identify risks around job lifecycle, settlement verification, concurrent jobs.
- [ ] **Lint-check all ATDD stubs** -- Per established agreement.
- [ ] **Address A1-A5 action items before stories begin** -- Restore epic start cleanup pattern.

### Key Risks for Epic 5

1. **NIP-90 event schema complexity** -- DVM protocol involves multiple event kinds (request, response, feedback, payment) with specific tag structures. Incorrect schema implementation would break interoperability with other DVM implementations.
2. **Job lifecycle state management** -- Unlike the stateless attestation verification in Epic 4, DVM jobs have multi-step lifecycles (submitted -> processing -> completed/failed). State management across ILP payment and result delivery introduces new failure modes.
3. **Compute settlement timing** -- Story 5-3 must handle the timing gap between job completion and USDC settlement. Partial payment, disputed results, and settlement failures need clear policies.
4. **CI dependency (critical)** -- Now 4 epics without CI infrastructure. DVM job routing requires multi-node testing that cannot be done with mocks alone.
5. **Large test file maintenance** -- With several 1000+ line test files already, DVM stories with complex lifecycle testing could push test files further. Addressing A10 before Epic 5 would help.

---

## 8. Team Agreements

Based on Epic 4 learnings (all 6 stories), the following agreements carry forward:

1. **ATDD stubs before epic start, lint-checked immediately.** Continued from Epics 1-3. ATDD test amplification averaged 2.3x in Epic 4 (lower than Epic 3's 5x, reflecting TEE stories' cleaner boundaries). Budget accordingly per story pattern.

2. **Three-pass code review model is non-negotiable.** Validated again across 6 stories. Pass #3 found the epic's most critical issues: HDKey material not wiped (4.4), CWE-22 path traversal (4.5), unsafe type cast (4.6). Stories 4.1 and 4.6 had their highest issue counts in Pass #3, confirming the OWASP security focus is essential.

3. **Multi-stage test amplification produces 1.5-4x the initial ATDD count.** Accept this as a feature. Budget story time for the automate, review, and code review addition stages.

4. **Static analysis tests for infrastructure code.** Extended from TypeScript source (Epics 2-3) to Docker compose, supervisord, Dockerfile, and Nix flake files. This pattern catches configuration errors at test time.

5. **One commit per story (maintained for 4th consecutive epic).** All 6 stories had clean, individual commits.

6. **Security scan every story.** Zero production findings across all 6 stories. 5 test fixture CWE-319 findings fixed. False positive rate improved over Epic 3 (5 vs. 36 findings), partly due to prior suppression work.

7. **Regression tests are non-negotiable.** Zero regressions for the 4th consecutive epic. Test count increased monotonically across all 6 stories.

8. **Traceability gate at story close.** 97% AC-to-test coverage (32/33 ACs). The single PARTIAL gap (Story 4.1 AC3) is infrastructure-dependent and LOW risk.

9. **Resolve retro action items at epic start.** **THIS AGREEMENT WAS VIOLATED IN EPIC 4.** No epic start commit was made. 14 of 15 action items from Epic 3 carry forward unresolved. This must be restored for Epic 5 -- the first task of Epic 5 should be an epic start commit addressing at minimum A1-A5.

10. **DI callbacks for orchestration classes.** New for Epic 4: `AttestationBootstrap` uses injected callback functions rather than interface inheritance. This pattern is trivially testable and should be the default for future orchestration code.

11. **Trust gradient over binary gates.** New for Epic 4: the VALID -> STALE -> UNATTESTED state machine with configurable validity/grace periods. Apply this pattern to any future trust-dependent system (e.g., DVM reputation in Epic 6).

12. **Cryptographic enforcement over advisory verification.** New for Epic 4: `deriveFromKmsSeed()` makes attestation consequential by binding identity to code integrity. Never rely on advisory-only verification for security-critical properties.

13. **Minimal, targeted runtime dependencies.** Epic 4 added only 2 runtime deps from a trusted author. Maintain this discipline. Run `pnpm audit` after each epic.

---

## 9. Timeline and Velocity

| Story | Duration (approx.) | Type |
|-------|-------------------|------|
| 4-1 | 180 min (3h) | Infrastructure packaging (Dockerfile, compose, supervisord, attestation server) |
| 4-2 | 90 min | Event protocol (kind:10033 builder, parser, lifecycle, health) |
| 4-3 | 90 min | Pure logic (verification, state machine, peer ranking) |
| 4-4 | 75 min | Cryptographic (KMS identity derivation) |
| 4-5 | 150 min (2.5h) | Build infrastructure (Nix, PCR verification, Dockerfile analysis) |
| 4-6 | 90 min | Orchestration (attestation-first bootstrap) |

**Average story velocity:** ~113 minutes per story pipeline execution
**Total pipeline time:** ~11.25 hours (approximate)
**Fastest story:** 4-4 (75 min, KMS identity)
**Slowest story:** 4-1 (180 min, Oyster CVM packaging)

### Velocity Comparison Across Epics

| Metric | Epic 1 | Epic 2 | Epic 3 | Epic 4 | Trend |
|--------|--------|--------|--------|--------|-------|
| Stories | 12 | 8 | 6 | 6 | Stable at 6 |
| ACs | 75 | 40 | 26 | 33 | Moderate increase |
| AC coverage | 100% | 100% | 100% | 97% | First PARTIAL (infra-dependent) |
| Story-specific tests | ~268 | ~193 | 244 | 275 | Increasing |
| Tests per story | 22.3 | 24.1 | 40.7 | 45.8 | Growing (more amplification) |
| Code review issues | 49 | 61 | 62 | 78 | Growing (more surface area per story) |
| Issues remaining | 3 (accepted) | 0 | 6 (informational) | 0 | Clean |
| Security findings (real) | 6 | 4 | 3 | 0 | Decreasing (0 for first time) |
| NFR pass rate | 12/12 | 4/8 | 4/6 | 6/6 | First 100% PASS |
| Test regressions | 0 | 0 | 0 | 0 | Maintained |
| Avg story duration | 55 min | 116 min | 150 min | 113 min | Decreased from Epic 3 |
| Total pipeline time | ~11h | ~13h | ~14h | ~11.25h | Decreased from Epic 3 |

Key observations:

- **Tests per story** continued growing (45.8 in Epic 4 vs. 40.7 in Epic 3), reflecting increased test amplification for security-critical TEE code.
- **Average story duration decreased** from 150 min (Epic 3) to 113 min (Epic 4). This is notable given TEE stories introduce novel concepts (attestation, PCR, Nix). The decrease is driven by cleaner module boundaries: each story implements a self-contained class with DI, rather than modifying shared state across packages.
- **Code review issues increased** to 78 (from 62 in Epic 3), driven by the security-sensitive nature of TEE code requiring more thorough scrutiny. Story 4.5 (Nix reproducible builds) had 17 issues -- the highest per-story count in Epic 4.
- **Zero real security findings** is a first. All CWE findings were test fixtures using ws:// URLs. The production code surface was clean across all 6 stories.
- **All NFR assessments passed** for the first time across any epic, though the persistent infrastructure gaps (CI, metrics) remain.

---

## 10. Known Risks Inventory

The following risks are documented from Epic 4. Risks R1-R12 from Epic 3 carry forward where still relevant.

| # | Risk | Severity | Source | Status |
|---|------|----------|--------|--------|
| R1 | CI pipeline and genesis node missing (4 epics) | **High** | Epic 1 A2 | OPEN -- escalated from Medium |
| R2 | Structured logging missing (4 epics) | Medium | Epic 1 A4 | OPEN |
| R3 | Mock USDC 18 decimals vs production 6 | Medium | Epic 3 A1 | OPEN |
| R4 | Transitive dependency vulnerabilities | Medium | Epic 2 A5 | OPEN |
| R5 | flake.lock not committed | Medium | Story 4-5 | OPEN |
| R6 | No real Nix integration tests | Medium | Story 4-5 | OPEN |
| R7 | Dockerfile.oyster builder stage manual sync | Low | Story 4-1 | OPEN |
| R8 | Story 4.1 AC3 deferred integration tests | Low | Story 4-1 | OPEN |
| R9 | T-RISK-02 payment channel attestation degradation | Low | Story 4-6 | OPEN |
| R10 | viem clients not wired in startTown() | Medium | Epic 3 A7 | OPEN |
| R11 | Large test files (5+ files > 900 lines) | Low | Epic 3 A11 | OPEN |
| R12 | Version field inconsistency (arch doc vs impl) | Low | Story 4-3 | OPEN |
| R13 | Docker entrypoint health endpoint migration | Low | Story 4-2 | OPEN |
| R14 | attestation:verification-failed event overloading | Low | Story 4-6 CR#3 | OPEN |

R1 has been escalated to High severity. Four epics without CI infrastructure means the entire TEE trust chain has never been validated end-to-end in an automated environment. With Epic 5 introducing DVM job routing that requires multi-node testing, this gap becomes blocking.

---

## 11. Conclusion

Epic 4 delivered a complete TEE integration layer for the TOON protocol: Oyster CVM packaging, kind:10033 attestation events, PCR verification with lifecycle state machine, KMS-derived enclave identity, Nix reproducible builds, and attestation-first seed relay bootstrap. The central architectural thesis -- that attestation should be a trust gradient with cryptographic enforcement through identity binding -- was implemented and tested across 275 tests with zero regressions.

The epic's technical execution was strong: zero production security findings, all 6 NFR assessments passed for the first time, average story velocity improved over Epic 3, and the layered architecture (events -> verification -> orchestration) demonstrates clean separation of concerns. The `AttestationVerifier` as single source of truth and `AttestationBootstrap` with DI callbacks establish patterns that future orchestration code should follow.

The most significant process concern is the absence of an epic start commit and the resulting 14 unresolved action items from Epic 3. The CI infrastructure gap (A1/R1) has been carried for 4 epics and is now escalated to High severity. The structured logging gap (A2/R2) has also been carried for 4 epics. Epic 5 must begin by addressing these systemic items -- the accumulation of deferred infrastructure work is the dominant quality risk in the project, exceeding any story-level technical debt.

The protocol is architecturally ready for DVM integration: the attestation trust chain provides the foundation for TEE-attested compute results (Epic 6 Story 6-3), the KMS identity provides the cryptographic anchor for compute node identity, and the reproducible build infrastructure provides the verification mechanism for compute environment integrity.
