# Epic 6 Retrospective: Advanced DVM Coordination + TEE Integration

**Date:** 2026-03-20
**Epic:** 6 -- Advanced DVM Coordination + TEE Integration
**Packages:** `@toon-protocol/core`, `@toon-protocol/sdk`
**Status:** Done (4/4 stories complete)
**Branch:** `epic-6`
**Commits:** 4 (1 per story)
**Git range:** `5d7217d..028efa7` (epic-6 start to epic-6 end)
**Final test count:** 2,526 total (100% pass rate)

---

## 1. Executive Summary

Epic 6 delivered the Advanced DVM Coordination and TEE Integration layer for the TOON protocol, building directly on the DVM Compute Marketplace (Epic 5) and TEE foundations (Epic 4). The epic implemented four stories: Workflow Chains (6-1), Agent Swarms (6-2), TEE-Attested DVM Results (6-3), and Reputation Scoring System (6-4). Together, these stories enable multi-step compute pipelines with automatic step advancement, competitive provider execution with winner selection, cryptographic verification of TEE-produced results, and composite reputation scoring with sybil defenses.

The most architecturally significant deliverable is **Story 6-1's WorkflowOrchestrator**, which introduces the first stateful orchestration component in the SDK. Previous epics operated on a stateless handler model where each event was processed independently. The WorkflowOrchestrator maintains a state machine across multiple ILP PREPARE/FULFILL cycles, tracking step progression, per-step settlement, and failure propagation through a multi-step pipeline. This establishes the pattern for any future SDK component that needs to coordinate across multiple asynchronous event lifecycles.

The most protocol-significant deliverable is **Story 6-3's attestation verification chain**, which bridges the TEE attestation system (Epic 4) with the DVM compute marketplace (Epic 5). Providers running in TEE enclaves can now cryptographically prove that a job result was produced inside a genuine enclave, and customers can verify this with a 3-check chain (pubkey match, PCR value validation, time validity). This is the convergence point that makes "verifiable compute" real: not just "I ran your job" but "I ran your job inside a TEE, and here is the cryptographic proof."

The most operationally significant deliverable is **Story 6-4's reputation scoring system**, which provides the marketplace's trust layer. The composite formula `(trustedBy*100) + (log10(max(1,channelVolumeUsdc))*10) + (jobsCompleted*5) + (avgRating*20)` balances four independent signals with explicit sybil defenses: customer-gated reviews (only job participants can review) and threshold Web of Trust (endorsements from established nodes carry weight). The `min_reputation` parameter enables providers to self-filter, ensuring they only accept jobs from requesters who meet their trust threshold.

All 4 stories completed with 100% pipeline success, 21/21 acceptance criteria covered, 286 story-specific tests, 44 code review issues found across 12 passes (1 critical, 6 high -- all fixed), zero security scan findings, and all 4 NFR assessments passing. The monorepo test count grew from 2,144 at epic start to 2,526 at epic close (+382 net). The epic start resolved 3 of 3 critical action items from the Epic 5 retro (test counting standardization, DVM event kinds table, ATDD RED-phase discipline).

---

## 2. Delivery Metrics

| Metric | Value |
|--------|-------|
| Stories delivered | 4/4 (100%) |
| Acceptance criteria | 21 total, 21 covered (100%) |
| Story-specific tests (actual) | 286 |
| Monorepo test count (start) | 2,144 (baseline after epic start cleanup) |
| Monorepo test count (end) | 2,526 |
| Net test count growth | +382 |
| Code review issues found | 44 total |
| Code review issues fixed | 38 |
| Code review issues acknowledged/deferred | 6 (all low) |
| Code review unresolved | 0 |
| Security scan findings (production) | 0 |
| Security scan informational | 5 (Story 6-4, triaged as safe) |
| NFR assessments | 4/4 PASS (76-86% ADR scores) |
| Traceability gate | PASS (P0: 93.3% with justified deferrals, Overall: 83.1%) |
| Migrations | 0 |
| New runtime dependencies | 0 |
| Frontend impact | None (all 4 stories backend-only) |
| E2E tests executed | 0 (all deferred -- require live infrastructure) |

### Code Review Breakdown

| Severity | Found | Fixed | Acknowledged | Remaining |
|----------|-------|-------|--------------|-----------|
| Critical | 1 | 1 | 0 | 0 |
| High | 6 | 6 | 0 | 0 |
| Medium | 15 | 15 | 0 | 0 |
| Low | 22 | 16 | 6 | 0 |
| **Total** | **44** | **38** | **6** | **0** |

### Code Review by Story

| Story | Pass #1 | Pass #2 | Pass #3 | Total | Remaining |
|-------|---------|---------|---------|-------|-----------|
| 6-1 | 8 (1C, 2H, 3M, 2L) | 5 (0C, 1H, 2M, 2L) | 5 (0C, 1H, 2M, 2L) | 18 | 0 |
| 6-2 | 6 (0C, 2H, 2M, 2L) | 5 (0C, 0H, 2M, 3L) | 4 (0C, 0H, 2M, 2L) | 15 | 2 (low, deferred) |
| 6-3 | 1 (0C, 0H, 0M, 1L) | 0 | 0 | 1 | 0 |
| 6-4 | 4 (0C, 0H, 0M, 4L) | 4 (0C, 0H, 1M, 3L) | 2 (0C, 0H, 1M, 1L) | 10 | 4 (acknowledged) |

### Test Count Progression

| Story | Post-Dev | Regression | Delta |
|-------|----------|------------|-------|
| 6-1 | 2,144 | 2,245 | +101 |
| 6-2 | 2,296 | 2,315 | +19 |
| 6-3 | 2,341 | 2,356 | +15 |
| 6-4 | 2,490 | 2,526 | +36 |

---

## 3. Successes

### 3.1. Epic Start Resolved All 3 Critical Action Items from Epic 5

The Epic 6 start commit resolved all 3 critical action items carried from the Epic 5 retro:

| # | Action | Resolution |
|---|--------|------------|
| A1 | Standardize test counting between pipeline steps | Fixed -- root vitest.config.ts now includes docker/src tests |
| A2 | Update project-context.md DVM event kinds table | Already resolved in Epic 5 |
| A4 | Split dvm.test.ts (2,704 lines) | Fixed -- split into 4 focused files (builders, parsers, roundtrip, constants) + shared helpers |

Additionally, A7 (parseJobResult numeric validation) was hardened with `/^\d+$/` regex validation and 6 new tests. This is the second consecutive epic with 100% critical action item resolution at start, establishing a reliable pattern.

### 3.2. Story 6-3 Achieved the Cleanest Code Review in Project History

Story 6-3 (TEE-Attested DVM Results) had only 1 code review issue found across all 3 passes -- a single low-severity duplicate empty comment block in Pass #1. Passes #2 and #3 were completely clean (0 findings each). This ties Story 5-4's record as the cleanest code review in project history, and notably does so for a story with security-sensitive attestation verification logic. The clean reviews reflect that the implementation closely followed the attestation patterns established in Epic 4 (kind:10033) and the DVM patterns from Epic 5 (kind:6xxx parsers/builders).

### 3.3. ATDD-to-Implementation Integration Matured

Stories 6-2, 6-3, and 6-4 all completed implementation during the ATDD step, with the develop step serving as verification. While this was flagged as a deviation in Epic 5, the pattern has become productive when managed correctly: the ATDD agent writes tests and implementation together in a TDD green-phase approach, and the develop step validates correctness. The key distinction from Story 5-4's deviation is that the tests genuinely drove the implementation (test-first within the ATDD step), rather than implementation driving tests.

Story 6-1 was the exception, requiring a dedicated develop step with 2 sessions to implement the WorkflowOrchestrator state machine -- reflecting its higher architectural novelty.

### 3.4. Zero New Runtime Dependencies for 2nd Consecutive Epic

All workflow orchestration, swarm coordination, attestation verification, and reputation scoring was implemented using existing `@toon-protocol/core` and `@toon-protocol/sdk` infrastructure. No new runtime dependencies were added. Combined with Epic 5's zero-dependency result, this confirms the protocol's dependency set has fully stabilized. The core abstractions (TOON codec, ILP prepare/fulfill, event builders/parsers, handler registry) are sufficient for increasingly sophisticated coordination patterns.

### 3.5. Consistent Commit Discipline Maintained

All 4 stories had clean individual commits following the `feat(6-N):` pattern, maintaining the 1-commit-per-story discipline for the 6th consecutive epic (now spanning 42+ stories). This consistency makes git bisect reliable and keeps the commit history readable.

### 3.6. Security Scan Results Remain Clean

Zero production security findings across all 4 stories for the 3rd consecutive epic. Story 6-4 produced 5 informational semgrep findings, all triaged as safe (false positives on patterns that are correct in context). The `.semgrep.yml` and `.semgrepignore` configuration established in Epic 5 continues to eliminate false positive triage burden.

---

## 4. Challenges

### 4.1. No E2E Tests Executed

All 4 stories deferred their E2E test IDs (9 total: T-6.1-16, T-6.2-14, T-6.3-13, T-6.4-09/11/13/15/16/19) because they require live infrastructure: Anvil chain, relay nodes, TEE Docker containers, or multi-node coordination. While each deferral is individually justified and documented, the cumulative gap means the entire epic has been validated only through unit and integration tests with mocks/stubs, never through real infrastructure.

This is the first epic where zero E2E tests were executed. Epics 2-5 all had at least some Docker E2E validation. The deferred E2E count has grown to 17+ items across Epics 3-6, representing a significant untested surface.

### 4.2. Story 6-1 Required the Most Pipeline Steps and Time

Story 6-1 (Workflow Chains) was the most expensive story in the epic at ~90 minutes wall-clock with the full 22 pipeline steps (including 3 code review passes finding 18 issues). The WorkflowOrchestrator's state machine -- tracking step progression, timeout handling, per-step settlement, and failure propagation -- was the most architecturally novel component in the epic. The 1 critical issue found (in code review Pass #1) confirms that novel stateful components warrant extra scrutiny.

### 4.3. SwarmCoordinator setTimeout Divergence

Story 6-2's SwarmCoordinator uses `setTimeout` directly for timeout handling rather than the injectable `now()` pattern used by WorkflowOrchestrator. While functionally equivalent when tested with Vitest fake timers, this creates an inconsistency between the two coordination components. The divergence was acknowledged but not fixed, as the test coverage is adequate with fake timers.

### 4.4. Self-Reported Reputation is a Design Tradeoff

Story 6-4's reputation system relies on self-reported data: providers embed their own reputation scores in Kind 10035 service discovery events. While the design includes independent verifiability (customers can recompute scores from raw review and WoT events), there is no protocol-level enforcement preventing a provider from advertising an inflated reputation score. This is an acknowledged design tradeoff -- full enforcement would require consensus or a trusted aggregator, neither of which exists in the current architecture.

### 4.5. Inherited NFR Concerns Continue to Persist

All 4 NFR assessments passed but continued to flag the same inherited project-level concerns from prior epics: no load testing, no formal SLOs, no distributed tracing, no DR plan, unknown MTTR. These have been documented since Epic 1 and are now 6 epics old. With DVM coordination introducing stateful multi-step pipelines and concurrent swarm execution, the absence of performance baselines and load testing is becoming more consequential.

---

## 5. Key Insights

### 5.1. Stateful Orchestration is the SDK's New Frontier

Epic 6 marks the transition from a stateless event-processing SDK to one that includes stateful orchestration components. Both WorkflowOrchestrator (6-1) and SwarmCoordinator (6-2) maintain internal state machines that persist across multiple ILP packet cycles. This is architecturally significant: the SDK now has components whose correctness depends on state transitions, not just input/output transformations.

The state machine pattern -- explicit states (e.g., `collecting`, `judging`, `settled`, `failed`), guarded transitions, and timeout-driven progression -- proved effective for both stories. Future coordination components should follow this pattern rather than ad-hoc state tracking.

### 5.2. TEE-DVM Convergence Creates a Verifiable Compute Stack

Story 6-3 completed the convergence of two previously separate subsystems: TEE attestation (Epic 4) and DVM compute (Epic 5). The result is a verifiable compute stack where:

1. Provider advertises TEE capability via skill descriptor attestation field
2. Customer requires attestation via `require_attestation` parameter in job request
3. Provider attaches attestation reference to job result
4. Customer verifies 3-check chain: pubkey match, PCR values, time validity

This stack does not require trust in the provider -- the TEE attestation provides cryptographic proof of execution environment integrity. This is the protocol's strongest value proposition for security-sensitive compute workloads.

### 5.3. Reputation Design Must Balance Sybil Resistance with Simplicity

Story 6-4's reputation system made deliberate design choices that prioritize simplicity over theoretical completeness:

- **Threshold WoT over weighted WoT**: A binary "trusted/not-trusted" model rather than weighted trust propagation. Simpler to implement and reason about, but less nuanced.
- **Customer-gated reviews**: Only job participants can submit reviews. Prevents drive-by sybil attacks but requires job completion as a precondition.
- **Self-reported scores**: Providers embed their own scores. Independently verifiable but not protocol-enforced.

These tradeoffs are appropriate for v1 but should be revisited as the marketplace matures and adversarial incentives increase.

### 5.4. Code Review Severity Follows a Predictable Pattern by Story Novelty

| Story | Novelty | Total Issues | Critical+High |
|-------|---------|-------------|---------------|
| 6-1 (Workflows) | High (new state machine) | 18 | 1C + 4H = 5 |
| 6-2 (Swarms) | Medium (similar state machine) | 15 | 0C + 2H = 2 |
| 6-3 (Attestation) | Low (extends Epic 4 patterns) | 1 | 0 |
| 6-4 (Reputation) | Medium (new formula, new event kinds) | 10 | 0 |

Story 6-1, as the most architecturally novel component (first stateful orchestrator), attracted the most and most severe code review findings. Story 6-2 benefited from the patterns established by 6-1. Story 6-3 followed existing attestation patterns so closely that reviewers found almost nothing. This reinforces the insight from Epic 5: code review issue density correlates with novelty, not complexity.

### 5.5. Test Amplification Ratios Reflect Maturity

| Story | ATDD Tests (approx.) | Final Tests | Amplification |
|-------|---------------------|-------------|---------------|
| 6-1 | 51 | 81 | 1.6x |
| 6-2 | 51 | 70 | 1.4x |
| 6-3 | 28 | 41 | 1.5x |
| 6-4 | 55 | 94 | 1.7x |

Average amplification of 1.55x is consistent with Epic 5's 1.35x and well below the 2-3x ratios of earlier epics. This reflects the SDK's architectural maturity: established patterns produce fewer surprises during amplification phases. Story 6-4 had the highest ratio (1.7x) due to the reputation formula introducing many numeric edge cases (NaN, Infinity, negative values) that required defensive tests.

---

## 6. Action Items for Epic 7

### 6.1. Must-Do (Blockers or High Priority)

| # | Action | Owner | Status | Carried From | Reason |
|---|--------|-------|--------|-------------|--------|
| A1 | **Address accumulated E2E test debt (17+ deferred items)** | Dev | OPEN | Epics 3-6 | Zero E2E tests executed in Epic 6. Cumulative deferred E2E count is now 17+ across Epics 3-6. At minimum, prioritize the P2 items (T-6.1-16, T-6.2-14) that test multi-step coordination with real infrastructure. |
| A2 | **Standardize injectable time pattern across coordination components** | Dev | OPEN | Story 6-2 | SwarmCoordinator uses `setTimeout` while WorkflowOrchestrator uses injectable `now()`. Standardize before adding more coordination components in future epics. |

### 6.2. Should-Do (Quality Improvements)

| # | Action | Owner | Status | Carried From | Reason |
|---|--------|-------|--------|-------------|--------|
| A3 | **Establish load testing infrastructure** | Dev | OPEN | Epic 1 NFR (6 epics deferred) | All 4 Epic 6 NFRs flagged this. Stateful orchestration and swarm coordination need performance baselines. |
| A4 | **Set up facilitator ETH monitoring** | Dev | OPEN | Epic 3 A8 (4 epics deferred) | x402 facilitator account needs ETH monitoring for operational safety. |
| A5 | **Commit flake.lock** | Dev | OPEN | Epic 4 A5 (3 epics deferred) | Requires Nix installation. Needed for reproducible builds. |
| A6 | **Add protocol-level reputation score verification** | Dev | OPEN | Story 6-4 | Self-reported reputation is an acknowledged tradeoff. Consider lightweight verification (e.g., relay-side score recomputation) when marketplace usage grows. |
| A7 | **Formal SLOs for DVM job lifecycle** | Dev | OPEN | NFR inherited (6 epics) | With workflow chains and swarm coordination, job lifecycle SLOs (submission-to-result latency, settlement time) are increasingly relevant. |

### 6.3. Nice-to-Have

| # | Action | Owner | Reason |
|---|--------|-------|--------|
| A8 | Runtime re-publication of kind:10035 on handler/reputation change | Dev | Carried from Epic 5 A11. Reputation scores embedded in skill descriptors are static after initial publication. |
| A9 | Weighted WoT model for reputation scoring | Dev | Threshold WoT is simpler but less nuanced. Weighted trust propagation would improve sybil resistance. |
| A10 | Publish @toon-protocol/town to npm | Dev | Carried from Epic 2 A3, 3 A14, 4 A14, 5 A13. |
| A11 | Fix NIP-33/NIP-16 doc discrepancy | Dev | Carried from Epic 3 A13, 4 A16, 5 A16. |
| A12 | Docker E2E for full workflow chain lifecycle | Dev | T-6.1-16 -- requires 2+ DVM providers in Docker with relay orchestration. |
| A13 | Docker E2E for swarm competitive execution | Dev | T-6.2-14 -- requires multiple competing providers in Docker. |

---

## 7. Epic 7 Preparation Tasks

Epic 7 (ILP Address Hierarchy & Protocol Economics) has 6 stories:

| Story | Title | Key Features |
|-------|-------|-------------|
| 7-1 | Deterministic Address Derivation | ILP address hierarchy from node identity |
| 7-2 | BTP Address Assignment Handshake | Dynamic address assignment during peering |
| 7-3 | Multi-Address Support for Multi-Peered Nodes | Nodes with multiple upstream peers |
| 7-4 | Fee-Per-Byte Advertisement in Kind 10032 | Relay metadata includes pricing |
| 7-5 | SDK Route-Aware Fee Calculation | Client-side fee estimation across routes |
| 7-6 | Prefix Claim Kind and Marketplace | ILP address namespace governance |

### Preparation Checklist

- [ ] **Resolve A1** (E2E test debt) -- prioritize at least 2-3 items from the deferred list before starting new stories.
- [ ] **Resolve A2** (injectable time pattern) -- standardize before introducing any new coordination or timeout components.
- [ ] **Review ILP addressing model** -- Stories 7-1 through 7-3 fundamentally change how nodes acquire and manage ILP addresses. Review current `g.toon.*` address scheme and connector route configuration.
- [ ] **Review BTP handshake flow** -- Story 7-2 modifies the BTP connection lifecycle. Review current `authToken` pattern and `BTP_PEER_*` env var scheme.
- [ ] **Assess fee calculation requirements** -- Stories 7-4 and 7-5 introduce route-aware pricing. Review current `basePricePerByte` model and multi-hop fee accumulation.
- [ ] **Create Epic 7 test design document** -- Key risks: address collision, fee calculation drift, BTP handshake failure modes, multi-address routing ambiguity.

### Key Risks for Epic 7

1. **ILP address migration** -- Changing the address derivation model may break existing peer configurations. Backward compatibility with `g.toon.*` addresses must be preserved during transition.
2. **BTP handshake complexity** -- Dynamic address assignment adds state to the BTP connection lifecycle, which is currently stateless (connect, authenticate, route).
3. **Fee calculation accuracy** -- Route-aware fee calculation across multi-hop paths requires accurate fee advertisements from every intermediate node. Stale or incorrect fee data could cause overpayment or underpayment.
4. **Connector route table scale** -- Multi-address support increases the number of routes each connector must maintain. Route table performance under scale is untested.
5. **Namespace governance** -- Story 7-6 introduces economic mechanisms for ILP address claims. This is the first story with governance implications and needs careful design to avoid centralization.

---

## 8. Team Agreements

Based on Epic 6 learnings (all 4 stories), the following agreements carry forward:

1. **ATDD stubs before implementation, lint-checked immediately.** Continued from all prior epics. Epic 6 amplification averaged 1.55x. Budget 1.5-2x for novel stories, 1-1.5x for extension stories.

2. **Three-pass code review model is non-negotiable.** Maintained across 12 passes. Epic 6 had 1 critical and 6 high issues (all in stories 6-1 and 6-2, the novel coordination components). Story 6-3's single-issue result tied the project record. Pass #3 continues to find meaningful issues.

3. **One commit per story.** Maintained for the 6th consecutive epic (42+ stories). Use `feat(N-M):` pattern for stories, `test(N):` for infrastructure.

4. **Security scan every story.** Zero production findings for 3rd consecutive epic. 5 informational findings (Story 6-4) triaged transparently.

5. **Regression tests are non-negotiable.** Zero regressions for the 6th consecutive epic. Test count increased monotonically across all 4 stories.

6. **Traceability gate at story close.** 21/21 ACs covered (100%). Deferred test IDs documented with priority and infrastructure requirements.

7. **Resolve retro action items at epic start.** 3/3 critical items resolved in Epic 6 start. This is the 2nd consecutive epic with 100% critical item resolution.

8. **Zero new runtime dependencies when extending established patterns.** Maintained for 2nd consecutive epic. Any new runtime dependency should be scrutinized.

9. **State machine pattern for coordination components.** New for Epic 6: explicit states, guarded transitions, timeout-driven progression. Both WorkflowOrchestrator and SwarmCoordinator validated this pattern. Future coordination components must follow it.

10. **Injectable time/timer patterns for testability.** New for Epic 6 (corrective): coordination components should use injectable `now()` functions rather than direct `setTimeout`. SwarmCoordinator's divergence is acknowledged as technical debt (A2).

11. **No-mock integration policy for SDK tests.** Carried from Epic 5. Docker E2E for cross-process integration. However, Epic 6's zero E2E execution is a concern -- this policy must be actively enforced, not just stated.

12. **Trust gradient over binary gates.** Carried from Epic 4. Applied successfully in Story 6-4's reputation scoring (composite formula with graduated signals rather than pass/fail).

13. **DI callbacks for orchestration classes.** Carried from Epic 4. Applied in both WorkflowOrchestrator (EventStore, settle callback) and SwarmCoordinator (settle callback, EventStore).

---

## 9. Timeline and Velocity

| Story | Duration (approx.) | Type |
|-------|-------------------|------|
| Epic start | ~30 min | Retro action resolution (3 critical items) + baseline |
| 6-1 | ~90 min | Novel state machine (WorkflowOrchestrator, 81 tests) |
| 6-2 | ~45 min | Extension state machine (SwarmCoordinator, 70 tests) |
| 6-3 | ~45 min | Pattern extension (attestation verification, 41 tests) |
| 6-4 | ~90 min | New domain (reputation formula + event kinds, 94 tests) |

**Average story velocity:** ~68 minutes per story pipeline execution
**Total pipeline time:** ~5 hours (approximate, including epic start)
**Fastest stories:** 6-2 and 6-3 (45 min each)
**Slowest stories:** 6-1 and 6-4 (90 min each)

### Velocity Comparison Across Epics

| Metric | Epic 1 | Epic 2 | Epic 3 | Epic 4 | Epic 5 | Epic 6 | Trend |
|--------|--------|--------|--------|--------|--------|--------|-------|
| Stories | 12 | 8 | 6 | 6 | 4 | 4 | Stable at 4 |
| ACs | 75 | 40 | 26 | 33 | 27 | 21 | Decreasing (more focused) |
| AC coverage | 100% | 100% | 100% | 97% | 100% | 100% | Maintained |
| Story-specific tests | ~268 | ~193 | 244 | 275 | 279 | 286 | Increasing |
| Tests per story | 22.3 | 24.1 | 40.7 | 45.8 | 69.8 | 71.5 | Stable at high level |
| Code review issues | 49 | 61 | 62 | 78 | 33 | 44 | Slightly up from Epic 5 |
| Issues per story | 4.1 | 7.6 | 10.3 | 13.0 | 8.3 | 11.0 | Increased (more novel code) |
| Critical+High issues | -- | -- | -- | 5 | 0 | 7 | Increased (stateful components) |
| Issues remaining | 3 | 0 | 6 | 0 | 0 | 0 | Clean |
| Security findings (real) | 6 | 4 | 3 | 0 | 0 | 0 | Zero for 3rd consecutive epic |
| NFR pass rate | 12/12 | 4/8 | 4/6 | 6/6 | 4/4 | 4/4 | 100% for 3rd consecutive epic |
| Test regressions | 0 | 0 | 0 | 0 | 0 | 0 | Maintained (6 epics) |
| Avg story duration | 55 min | 116 min | 150 min | 113 min | 160 min | 68 min | Significant decrease |
| Total pipeline time | ~11h | ~13h | ~14h | ~11.25h | ~12.25h | ~5h | Significant decrease |
| Retro actions resolved (critical) | -- | -- | 6/13 | 0/15 | 8/18 | 3/3 | 100% for 2nd consecutive epic |

Key observations:

- **Average story duration decreased significantly** to 68 minutes (from 160 min in Epic 5). Stories 6-2 and 6-3 completed in 45 minutes each, benefiting from patterns established by 6-1 and Epic 4 respectively. The ATDD-implements-together pattern (where implementation completes during ATDD) eliminates the develop step's overhead for pattern-following stories.

- **Code review issues increased slightly** from 33 (Epic 5) to 44 (Epic 6). The increase is entirely attributable to stories 6-1 and 6-2, which introduced novel stateful coordination logic with 18 and 15 issues respectively. Stories 6-3 and 6-4 had 1 and 10 issues -- consistent with pattern-following stories.

- **Critical+High issues returned** (7 total, all in 6-1 and 6-2) after Epic 5's zero. This is expected: stateful orchestration components introduce more security-sensitive code paths (state transitions, settlement authorization, timeout handling) than stateless event builders/parsers.

- **Tests per story stabilized** at 71.5 (vs 69.8 in Epic 5). The test density is consistent across epics now, suggesting the testing methodology has reached equilibrium.

- **Zero E2E test execution** is a regression from Epic 5's Docker E2E migration. While unit/integration coverage is comprehensive, the lack of real infrastructure validation for coordination components is a notable gap.

---

## 10. Known Risks Inventory

| # | Risk | Severity | Source | Status |
|---|------|----------|--------|--------|
| R1 | Accumulated E2E test debt (17+ deferred items across Epics 3-6) | High | Cross-epic | OPEN -- escalated from Medium |
| R2 | Self-reported reputation scores not protocol-enforced | Medium | Story 6-4 | OPEN (design tradeoff) |
| R3 | SwarmCoordinator setTimeout diverges from injectable pattern | Low | Story 6-2 | OPEN (tech debt) |
| R4 | No load testing infrastructure | Medium | NFR inherited (6 epics) | OPEN |
| R5 | No formal SLOs | Medium | NFR inherited (6 epics) | OPEN |
| R6 | No distributed tracing | Medium | NFR inherited (6 epics) | OPEN |
| R7 | No DR plan | Low | NFR inherited (6 epics) | OPEN |
| R8 | Facilitator ETH monitoring not implemented | Medium | Epic 3 A8 (4 epics) | OPEN |
| R9 | flake.lock not committed | Medium | Epic 4 A5 (3 epics) | OPEN |
| R10 | 31 unresolvable transitive vulnerabilities in @ardrive/turbo-sdk | Low | Epic 5 start | OPEN |
| R11 | No runtime re-publication of kind:10035 on handler/reputation change | Low | Epic 5 A11 | OPEN |
| R12 | NIP-33/NIP-16 doc discrepancy | Low | Epic 3 A13 (4 epics) | OPEN |
| R13 | @toon-protocol/town unpublished to npm | Low | Epic 2 A3 (5 epics) | OPEN |
| R14 | handleStepResult() does not validate e-tag matches current step | Low | Story 6-1 | OPEN (defense-in-depth) |

R1 has been escalated to High severity. With 17+ deferred E2E test items across 4 epics and zero E2E execution in Epic 6, the gap between tested and untested integration paths is widening. The stateful coordination components introduced in Epic 6 (WorkflowOrchestrator, SwarmCoordinator) are precisely the kind of components most likely to exhibit integration-level bugs that unit tests cannot catch.

---

## 11. Conclusion

Epic 6 delivered the Advanced DVM Coordination and TEE Integration layer for the TOON protocol: multi-step workflow pipelines with automatic step advancement and per-step settlement, competitive swarm execution with winner selection and loser transparency, TEE attestation verification for cryptographically provable compute results, and composite reputation scoring with sybil defenses. Together with Epic 5's DVM Compute Marketplace, the protocol now supports a complete agent-to-agent compute marketplace with discovery, submission, execution (including competitive and multi-step), verification, settlement, and reputation.

The epic's execution was efficient: 4 stories delivered in approximately 5 hours of pipeline time (the fastest epic in project history), with all quality gates passing. The critical action items from Epic 5 were all resolved at epic start. Code review found and fixed all critical and high issues, security scans were clean, and the test suite grew to 2,526 tests with zero regressions.

The most significant concern is the accumulation of E2E test debt -- now 17+ deferred items across 4 epics with zero E2E execution in Epic 6. While unit and integration test coverage is strong (286 story-specific tests, 21/21 ACs covered), the stateful coordination components introduced in this epic are precisely the kind of code that benefits most from real infrastructure validation. Addressing E2E test debt should be the top priority for the Epic 7 start.

The protocol is architecturally ready for ILP Address Hierarchy & Protocol Economics (Epic 7): the SDK's coordination patterns (state machines, settlement callbacks, timeout handling) are proven, the event type system supports arbitrary new kinds, and the test infrastructure is mature. The transition from DVM coordination (Epics 5-6) to protocol economics (Epic 7) shifts focus from marketplace features to infrastructure plumbing -- a domain where the existing connector and ILP abstractions provide a strong foundation.
