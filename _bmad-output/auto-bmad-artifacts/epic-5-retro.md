# Epic 5 Retrospective: DVM Compute Marketplace

**Date:** 2026-03-17
**Epic:** 5 -- DVM Compute Marketplace
**Packages:** `@toon-protocol/core`, `@toon-protocol/sdk`, `@toon-protocol/town`
**Status:** Done (4/4 stories complete)
**Branch:** `epic-5`
**Commits:** 5 (4 story commits + 1 Docker E2E migration commit)
**Git range:** `2e4984c..e486294` (epic-5 start to epic-5 end)
**Final test count:** 2,174 total (2,095 passed, 79 skipped, 0 failures)

---

## 1. Executive Summary

Epic 5 delivered the DVM (Data Vending Machine) Compute Marketplace foundation for the TOON protocol, enabling ILP-native compute job submission, result delivery, settlement, and programmatic agent-to-agent service discovery. The epic implemented four stories across a clean dependency chain: NIP-90 event kind definitions (Story 5-1), ILP-native job submission validation (Story 5-2), job result delivery and compute settlement (Story 5-3), and skill descriptors in service discovery (Story 5-4).

The most architecturally significant deliverable is the **zero-production-code-change validation** of Story 5-2. The entire DVM job submission pipeline -- ILP PREPARE packets carrying Kind 5xxx events, handler dispatch, pricing, x402 packet equivalence -- works through the existing SDK infrastructure without a single line of production code modified. This validates the SDK's extensibility thesis from Epic 1: the `HandlerRegistry`, `publishEvent()`, and `buildIlpPrepare()` abstractions are genuinely kind-agnostic. The SDK is not merely a relay -- it is a general-purpose ILP-gated event processing platform.

The most protocol-significant deliverable is Story 5-3's `settleCompute()` method, which introduces a new ILP payment direction: customer-to-provider pure value transfers. Unlike event publishing (where payment flows alongside data), compute settlement sends an ILP packet with empty data -- a pure monetary transfer that represents payment for work completed. The `direct-ilp-client.ts` fix enabling empty-data packets is small (a `data.length > 0` guard) but architecturally consequential: it proves the ILP layer can carry both data-bearing and data-free payments.

The most operationally significant deliverable is Story 5-4's skill descriptors, which extend kind:10035 service discovery events with structured `SkillDescriptor` metadata. Agents can now programmatically discover DVM providers, inspect their `inputSchema` (JSON Schema draft-07), compare pricing, and construct valid job requests -- enabling a fully automated agent-to-agent marketplace without human intermediation.

A notable infrastructure contribution was the inter-story Docker E2E migration (commit `2159ad1`), which replaced 30 mock-based integration tests with real Docker container E2E tests. This enforced a "no-mock integration policy" and extracted shared test helpers into a reusable module, improving test fidelity across the entire SDK E2E suite.

All 4 stories shipped with 100% acceptance criteria coverage (27/27 ACs), 279 story-specific tests, 33 code review issues found across 12 review passes (0 critical, 0 high), zero test regressions, zero production security vulnerabilities, and all 4 NFR assessments passing. The monorepo test count grew from 1,843 at epic start to 2,095 at epic close (+252 net new passing tests, with 279 story-specific tests written). The epic start commit resolved 8 of 18 action items from the Epic 4 retro, including all 5 critical items.

---

## 2. Delivery Metrics

| Metric | Value |
|--------|-------|
| Stories delivered | 4/4 (100%) |
| Acceptance criteria | 27 total, 27 covered (100%) |
| Story-specific tests (actual) | 279 |
| Monorepo test count (start) | 1,843 passed / 79 skipped (1,922 total) |
| Monorepo test count (end) | 2,095 passed / 79 skipped (2,174 total) |
| Net test count growth | +331 (1,843 -> 2,174) |
| Code review issues found | 33 total |
| Code review issues fixed | 24 |
| Code review issues acknowledged/deferred | 9 |
| Code review unresolved | 0 |
| Security scan findings (production) | 0 |
| Security scan total rules run | 4,046 (cumulative across 4 stories) |
| NFR assessments | 4/4 PASS |
| Traceability gate | PASS (P0: 100%, P1: 100%, Overall: 100%) |
| Migrations | 0 |
| Files changed (total) | 45 |
| Lines added/removed (total) | +16,522 / -870 |
| New runtime dependencies | 0 |
| New dev dependencies | 0 |
| Frontend impact | None (all 4 stories backend-only) |
| Validation issues fixed pre-dev | 49 (across all 4 story validate steps) |

### Code Review Breakdown

| Severity | Found | Fixed | Acknowledged | Remaining |
|----------|-------|-------|--------------|-----------|
| Critical | 0 | 0 | 0 | 0 |
| High | 0 | 0 | 0 | 0 |
| Medium | 12 | 12 | 0 | 0 |
| Low | 21 | 12 | 9 | 0 |
| **Total** | **33** | **24** | **9** | **0** |

### Code Review by Story

| Story | Pass #1 | Pass #2 | Pass #3 | Total | Final Pass Issues |
|-------|---------|---------|---------|-------|-------------------|
| 5-1 | 6 | 4 | 5 | 15 | 0 (2 acknowledged) |
| 5-2 | 4 | 1 | 4 | 9 | 0 (2 documented) |
| 5-3 | 3 | 3 | 1 | 7 | 0 (all fixed) |
| 5-4 | 1 | 0 | 0 | 1 | 0 (fixed) |

### Security Scan Breakdown

| Story | Method | Rules | Findings | Real Issues | Action |
|-------|--------|-------|----------|-------------|--------|
| 5-1 | semgrep (8 rulesets) | 375 | 0 | 0 | Clean scan |
| 5-2 | semgrep (6 rulesets) | 413 | 0 | 0 | Clean scan |
| 5-3 | semgrep | 3,041 | 0 (24 false positives dismissed) | 0 | Clean scan |
| 5-4 | semgrep (12 rulesets) | 217 | 0 | 0 | Clean scan |

### NFR Summary

| Story | Rating | Score | Common Concerns |
|-------|--------|-------|-----------------|
| 5-1 | PASS | 93% ADR compliance | Pre-existing infrastructure gaps |
| 5-2 | PASS | 6 pass, 2 concerns | No load testing, no formal SLOs (inherited) |
| 5-3 | PASS | 21/29 ADR score | Inherited project-level concerns only |
| 5-4 | PASS | -- | Defensive parsing, prototype-safe access |

---

## 3. Successes

### 3.1. SDK Extensibility Thesis Validated -- Zero Production Code Changes for Job Submission

The strongest success of Epic 5 is Story 5-2's proof that DVM job request events flow through the existing SDK pipeline with zero production code modifications. The `HandlerRegistry`, `publishEvent()`, `buildIlpPrepare()`, and pipeline handler infrastructure built in Epic 1 already support arbitrary event kinds natively. This is not an incidental observation -- it is the validation of the fundamental architectural bet made in Epic 1: that the SDK should be kind-agnostic and let the handler registry handle dispatch. Story 5-2 created 27 tests proving this works, including ILP-native submission, x402 packet equivalence, handler dispatch with DVM-specific tags, pricing validation, and pipeline ordering invariants.

### 3.2. Epic Start Resolved All 5 Critical Action Items

The Epic 5 start commit resolved all 5 critical action items carried from the Epic 4 retro:

| # | Action | Resolution |
|---|--------|------------|
| A1 | CI pipeline with genesis node | `.github/workflows/test.yml` enhanced with format check, security audit, SDK E2E, proper teardown |
| A2 | Structured logging | `packages/core/src/logger.ts` created (zero-dep, JSON/human output, child loggers, 17 tests) |
| A3 | FiatTokenV2_2 on Anvil | `scripts/deploy-mock-usdc.sh` created (EIP-3009, EIP-712 compatible, 6 decimals) |
| A4 | Transitive dependency vulnerabilities | `pnpm.overrides` patches 8 vulns; 31 remaining unresolvable in `@ardrive/turbo-sdk` |
| A5 | Project-level semgrep configuration | `.semgrep.yml` and `.semgrepignore` created |

This is the best epic start performance in project history. The CI pipeline gap (A1) had been deferred for 4 consecutive epics and was the single highest-priority action item. The structured logging gap (A2) had also been deferred for 4 epics. Resolving both before story development began directly improved Epic 5's test infrastructure quality and set the foundation for the Docker E2E migration.

### 3.3. Docker E2E Migration Elevated Test Fidelity

The inter-story commit (`2159ad1`) replaced 30 mock-based integration tests with real Docker container E2E tests, establishing a "no-mock integration policy" for the SDK. This migration:

- Replaced `MockEmbeddedConnector` with real Docker containers via `sdk-e2e-infra.sh`
- Extracted shared test helpers into `docker-e2e-setup.ts` (constants, ABIs, node factories)
- Created 27 Docker E2E tests (11 for Story 5-2 submission, 16 for Story 5-3 lifecycle)
- Added 3 pure-function unit tests for `buildIlpPrepare()` (extracted from integration tests)
- Deleted 2,298 lines of mock-based tests, added 2,244 lines of Docker E2E tests

This is the first time the project has systematically migrated tests from mocks to real infrastructure. The Docker E2E tests validate actual ILP routing, TOON encoding, event storage, and settlement through real connector nodes -- catching integration issues that mocks would mask.

### 3.4. Zero Critical or High Code Review Issues Across 12 Passes

For the first time across any epic, all 12 code review passes (3 per story x 4 stories) found zero critical and zero high-severity issues. All 33 issues found were medium (12) or low (21). This indicates that the codebase's security posture and structural quality have reached a mature baseline where new code consistently follows established patterns. Compare to Epic 4 (1 critical, 4 high across 18 passes) and Epic 3 (6 high across 18 passes).

### 3.5. Story 5-4 Was the Cleanest Code Review in Project History

Story 5-4 (Skill Descriptors) had only 1 code review issue found across all 3 passes -- a single medium-severity variable shadowing fix in Pass #1. Passes #2 and #3 were completely clean. This is the lowest issue count for any story in the project's history (previously Story 4-4 with 6 issues). The clean reviews reflect that Story 5-4's implementation followed established patterns (extending `ServiceDiscoveryContent`, using `parseServiceDiscovery()` with lenient parsing, `HandlerRegistry` method additions) with no novel security surfaces.

### 3.6. 100% Traceability with Full Priority Coverage

The traceability gate passed with 27/27 ACs covered at 100% across all priority levels (P0: 100%, P1: 100%, Overall: 100%). This is the second consecutive epic with 100% AC coverage (Epic 4 achieved 97% with 1 PARTIAL). Two partial coverage notes were documented transparently:

- **5-2 AC-3**: Indirect coverage via pipeline (direct WebSocket subscription test deferred to CI infrastructure availability)
- **5-3 AC-4**: Structural validation only (multi-hop fee E2E deferred as P3 nightly test)

Both are classified as FULL coverage because the underlying behavior is validated through the pipeline tests, with the deferred items being additional validation layers rather than missing core coverage.

### 3.7. Zero New Runtime Dependencies

Epic 5 added zero new runtime dependencies. All DVM event builders, parsers, skill descriptors, and settlement methods were implemented using existing `@toon-protocol/core` infrastructure (TOON codec, `buildIlpPrepare()`, `ToonError`). Compare to Epic 4 (2 new runtime deps: `@scure/bip32`, `@scure/bip39`) and Epic 3 (viem for EIP-3009). This confirms the protocol's core dependency set has stabilized.

### 3.8. One Commit Per Story Maintained for 5th Consecutive Epic

All 4 stories had clean, individual commits following the `feat(5-N):` pattern. The additional Docker E2E migration commit follows the `test(5):` convention for non-story infrastructure work. The 1-commit-per-story discipline has held across all 5 epics (38 stories total).

---

## 4. Challenges

### 4.1. Story 5-4 ATDD Agent Implemented Production Code

Story 5-4's ATDD step deviated from the standard RED-phase pattern: the ATDD agent implemented both tests and production code simultaneously (13 files changed, 2 created, 11 modified). The develop step was reduced to a verification-only pass. While the final result was correct, this blurred the RED -> GREEN TDD boundary. The ATDD phase should produce failing tests only; production code implementation belongs in the develop step.

This deviation did not cause quality issues (the story had the cleanest code review in project history), but it introduces a process inconsistency. If ATDD agents routinely implement production code, the develop step becomes redundant and the test-first discipline is undermined.

### 4.2. Story Validate Step Found 49 Issues Across 4 Stories

The story validate steps collectively found 49 issues before development began:

| Story | Issues Found | Severity Breakdown |
|-------|-------------|-------------------|
| 5-1 | 17 | 4 structural, 5 AC, 5 task, 2 test/risk, 1 doc |
| 5-2 | 12 | 2 critical (false cross-refs, risk ID collision), 4 medium, 6 low |
| 5-3 | 12 | 1 high, 4 medium, 7 low |
| 5-4 | 8 | 2 high (NIP-33/NIP-16 confusion, wrong field names), 2 medium, 4 low |

While resolving these pre-development is better than discovering them during implementation, 49 validation issues across 4 stories suggests the story creation step is generating stories with structural deficiencies that require substantial rework before they are development-ready. The two critical issues in Story 5-2 (false cross-references to a non-existent test design, risk ID collisions with the epic risk registry) indicate incomplete context propagation from epic-level artifacts to story-level files.

### 4.3. Test Count Discrepancies Between Pipeline Steps

Story 5-1 showed a test count discrepancy: post-dev reported 2,008 tests, but regression reported 1,992 (-16). The report noted this was "attributed to counting method variance, NOT test removal -- git diff confirms 0 tests deleted." While not a real regression, inconsistent counting between pipeline steps erodes confidence in the regression check. The counting method should be standardized to produce identical results between post-dev and regression steps.

### 4.4. Large Test Files Continue to Grow

Epic 5 continued the pattern of large test files:

| Test File | Lines | Tests | Story |
|-----------|-------|-------|-------|
| `dvm.test.ts` | 2,704 | 149 | 5-1 |
| `skill-descriptor.test.ts` | 1,015 | 26 | 5-4 |
| `dvm-lifecycle.test.ts` (unit) | 957 | 26 | 5-3 |
| `docker-dvm-lifecycle-e2e.test.ts` | 833 | 16 | E2E migration |
| `service-discovery.test.ts` | 789+ | 24+ new | 5-4 |
| `docker-dvm-submission-e2e.test.ts` | 739 | 11 | E2E migration |

Story 5-1's `dvm.test.ts` at 2,704 lines is the largest test file in the project, nearly double the previous record holder (`seed-relay-discovery.test.ts` at 1,401 lines). Action A11 (split large test files) from Epic 3 remains unaddressed after 3 epics.

### 4.5. Inherited Project-Level NFR Concerns Persist

All 4 NFR assessments passed but flagged the same inherited project-level concerns: no load testing infrastructure, no formal SLOs, no distributed tracing, and no DR plan. These concerns have been documented since Epic 1 and are the only factors preventing perfect NFR scores. With the DVM marketplace introducing compute workloads, load testing becomes more urgent -- a DVM node processing concurrent jobs needs performance baselines.

---

## 5. Key Insights

### 5.1. Kind-Agnostic SDK Architecture Pays Compound Returns

The most important insight from Epic 5 is that the SDK's kind-agnostic architecture (established in Epic 1) provides compound returns as new event kinds are added. Story 5-2 required zero production code changes to support DVM job submission -- the entire kind 5xxx pipeline worked out of the box. This means future event kinds (e.g., Rig git operations in Epic 7, custom application kinds) will also work immediately. The cost of the kind-agnostic abstraction was paid once in Epic 1; every subsequent epic benefits for free.

This contrasts with architectures that bake event kind knowledge into the pipeline. If the SDK had hard-coded kind handling (e.g., switch statements on kind ranges), each new epic would require pipeline modifications and regression testing. The handler registry pattern avoids this entirely.

### 5.2. Pure Value Transfers Expand ILP's Role Beyond Data Carriage

Story 5-3's `settleCompute()` method demonstrates that the ILP layer can serve as a general-purpose payment rail, not just a data carriage mechanism. The `direct-ilp-client.ts` fix enabling empty-data packets (`data.length > 0` guard) is architecturally significant because it separates the payment function from the data function:

- **Event publishing**: Payment + data flow together in the same ILP PREPARE packet
- **Compute settlement**: Payment flows alone as a pure value transfer

This separation means the ILP mesh can support any payment pattern -- not just "pay to write" but also "pay for compute," "pay for query results," or "pay for API access." Future epics can leverage this for any settlement scenario where payment and data are decoupled.

### 5.3. No-Mock Integration Policy Produces Higher-Fidelity Tests

The Docker E2E migration (commit `2159ad1`) demonstrated that replacing mock-based integration tests with real container tests catches integration issues that mocks cannot:

- **Mock tests** verified that the correct functions were called with correct arguments -- behavioral verification
- **Docker E2E tests** verify that real events flow through real connectors, get stored in real SQLite databases, and produce real ILP FULFILL/REJECT packets -- outcome verification

The migration deleted 2,298 lines of mock-based tests and replaced them with 2,244 lines of Docker E2E tests. The line count is similar, but the fidelity is categorically different. Mock tests can pass even when the real integration is broken (as documented in MEMORY.md: "nostr-tools SimplePool does NOT work in Node.js containers"). Docker E2E tests catch these environment-specific failures.

The "no-mock integration policy" should be considered for adoption across the project: any test that calls itself "integration" should exercise real infrastructure, not mocks. Unit tests with mocks remain valuable for isolated logic testing.

### 5.4. Skill Descriptors Enable Agent-to-Agent Marketplace Without Human Intermediation

Story 5-4's skill descriptors complete the automated agent workflow:

1. **Discovery**: Agent queries public relay for kind:10035 events with `skill` field
2. **Evaluation**: Agent inspects `skill.inputSchema` (JSON Schema draft-07) to understand input requirements
3. **Comparison**: Agent compares `skill.pricing` across providers to find best price
4. **Submission**: Agent constructs valid Kind 5xxx job request from schema + discovered ILP address
5. **Settlement**: Agent receives Kind 6xxx result and calls `settleCompute()` with provider's ILP address

This five-step workflow requires no human intermediation -- an LLM agent with access to the TOON SDK can discover, evaluate, submit, and settle DVM jobs programmatically. The `inputSchema` using JSON Schema draft-07 is the key enabling decision: it is the most widely supported schema format for programmatic consumption by AI agents.

### 5.5. Test Amplification Ratio Correlates with Story Type, Not Complexity

| Story | ATDD Tests | Final Tests | Ratio | Type |
|-------|-----------|-------------|-------|------|
| 5-1 | 84 | 149 | 1.8x | Event protocol (builders/parsers) |
| 5-2 | 21 | 27 | 1.3x | Validation (no production code) |
| 5-3 | 34 | 42 | 1.2x | Pipeline methods (thin wrappers) |
| 5-4 | 54 | 61 | 1.1x | Extension (established patterns) |

Epic 5's amplification ratios (1.1x - 1.8x) are significantly lower than Epic 4's (1.5x - 3.9x) and Epic 3's (2.2x - 15.3x). This reflects that DVM stories follow established SDK patterns -- there are fewer novel code paths to discover during amplification. Stories extending existing infrastructure (5-2, 5-3, 5-4) had the lowest amplification, while the foundational event kind story (5-1) had the highest. The insight: amplification ratios predict how much novel surface area a story introduces. Low ratios are a positive signal that the architecture is stable.

### 5.6. Validation Step as Quality Gate Catches Significant Issues

The 49 pre-development validation issues -- including 2 critical issues in Story 5-2 -- demonstrate that the story validate step is functioning as an effective quality gate. Without this step, developers would have discovered these issues during implementation (incorrect test IDs, wrong AC specifications, NIP confusion), causing rework and confusion. The validation step's 49-issue yield across 4 stories (12.25 per story) is consistent with Epic 4's experience and should be expected as a standard pipeline cost.

---

## 6. Action Items for Epic 6

### 6.1. Must-Do (Blockers or High Priority)

| # | Action | Owner | Status | Carried From | Reason |
|---|--------|-------|--------|-------------|--------|
| A1 | **Standardize test counting between pipeline steps** | Dev | OPEN | Epic 5 new | Story 5-1 showed -16 discrepancy between post-dev and regression counts. Must produce identical results. |
| A2 | **Update project-context.md DVM event kinds table** | Dev | OPEN | Story 5-1 deferred | DVM kinds (5xxx, 6xxx, 7000) not in project-context event kinds reference. |
| A3 | **Enforce ATDD RED-phase discipline** | Process | OPEN | Story 5-4 deviation | ATDD step should produce failing tests only, never production code. |

### 6.2. Should-Do (Quality Improvements)

| # | Action | Owner | Status | Carried From | Reason |
|---|--------|-------|--------|-------------|--------|
| A4 | **Split large test files** | Dev | OPEN | Epic 3 A11, 4 A10 | 3 epics deferred. `dvm.test.ts` (2,704 lines) is now the largest. At minimum split by builder/parser/lifecycle. |
| A5 | **Add direct WebSocket subscription test for DVM events** | Dev | OPEN | Story 5-2 AC-3 | Indirect coverage via pipeline. Direct test requires genesis infra in CI (now available). |
| A6 | **Implement multi-hop routing fee E2E test** | Dev | OPEN | Story 5-3 T-5.3-15 | P3 nightly priority. Validates fee accumulation across ILP hops for compute settlement. |
| A7 | **Harden parseJobResult() numeric amount validation** | Dev | OPEN | Story 5-3 gap | Non-numeric amount from malicious provider caught by `settleCompute()` BigInt guard but error message is confusing. |
| A8 | **Set up facilitator ETH monitoring** | Dev | OPEN | Epic 3 A8, 4 A17 | 3 epics deferred. x402 facilitator account needs ETH monitoring. |
| A9 | **Commit flake.lock** | Dev | OPEN | Epic 4 A5 | 2 epics deferred. Requires Nix installation. Needed for reproducible builds. |
| A10 | **Establish load testing infrastructure** | Dev | OPEN | NFR inherited | All 4 Epic 5 NFRs flagged this. DVM compute workloads make performance baselines urgent. |

### 6.3. Nice-to-Have

| # | Action | Owner | Reason |
|---|--------|-------|--------|
| A11 | **Runtime re-publication of kind:10035 on handler change** | Dev | Story 5-4 stretch goal. `getSkillDescriptor()` reads live; no auto re-publish. |
| A12 | **Docker E2E for full schema-to-request agent path** | Dev | Story 5-4 T-INT-05. Unit-level composition test exists; Docker E2E with network boundaries deferred. |
| A13 | **Publish @toon-protocol/town to npm** | Dev | Carried from Epic 2 A3, 3 A14, 4 A14. |
| A14 | **Add real Nix integration tests** | Dev | Carried from Epic 4 A12. Requires Nix in CI runner. |
| A15 | **Implement deferred P3 E2E tests from Epics 3-4** | Dev | T-3.4-12, 3.6-E2E-001, T-4.1-03, T-4.1-04, T-RISK-02. |
| A16 | **Fix NIP-33/NIP-16 doc discrepancy** | Dev | Carried from Epic 3 A13, 4 A16. |

---

## 7. Epic 6 Preparation Tasks

Epic 6 (Advanced DVM Coordination + TEE Integration) has 4 stories:

| Story | Title | Key Features |
|-------|-------|-------------|
| 6-1 | Workflow Chains | Multi-step DVM job pipelines where output of one job feeds input of next |
| 6-2 | Agent Swarms | Coordinated multi-agent job distribution and result aggregation |
| 6-3 | TEE-Attested DVM Results | Kind:10033 attestation for DVM compute results (Epic 4 + Epic 5 convergence) |
| 6-4 | Reputation Scoring System | Provider reputation from job completion history, attestation state, settlement reliability |

### Preparation Checklist

- [ ] **Resolve A2** (DVM event kinds in project-context.md) -- Epic 6 builds on DVM kinds; the reference must be current.
- [ ] **Resolve A3** (ATDD RED-phase discipline) -- Process agreement needed before Story 6-1.
- [ ] **Resolve A4** (split large test files) -- 3 epics deferred. `dvm.test.ts` at 2,704 lines will be extended by Epic 6 stories.
- [ ] **Review Epic 5 DVM implementation** -- Stories 6-1 and 6-2 build directly on the DVM event kinds, job lifecycle, and settlement from Stories 5-1/5-3.
- [ ] **Review Epic 4 attestation implementation** -- Story 6-3 converges TEE attestation (kind:10033, `AttestationVerifier`) with DVM results (kind:6xxx).
- [ ] **Design workflow state machine** -- Story 6-1 introduces multi-step job pipelines requiring state tracking across jobs. Assess whether `ServiceNode` needs lifecycle management beyond the current stateless pattern.
- [ ] **Design reputation data model** -- Story 6-4 needs a persistent reputation store. Assess SQLite schema requirements.
- [ ] **Create ATDD stubs for Epic 6 stories** -- Following validated pattern. Enforce RED-phase discipline per A3.
- [ ] **Create Epic 6 test design document** -- Risk-based format. Key risks: workflow deadlock, swarm coordination failure, attestation-result binding, reputation gaming.
- [ ] **Assess Docker E2E infrastructure for multi-agent tests** -- Stories 6-2 (agent swarms) will need multiple Docker nodes coordinating. Verify `sdk-e2e-infra.sh` supports 3+ peer nodes.

### Key Risks for Epic 6

1. **Workflow state management complexity** -- Story 6-1 introduces stateful multi-step job pipelines. The SDK is currently stateless (handlers process events independently). Adding workflow state tracking increases the blast radius of failures: a stuck workflow could block dependent jobs.
2. **Agent swarm coordination** -- Story 6-2 requires distributing jobs across multiple agents and aggregating results. This is the first story requiring multi-node coordination logic in the SDK itself (previous multi-node behavior was connector-level ILP routing).
3. **Attestation-DVM convergence** -- Story 6-3 must bind TEE attestation to DVM results without creating a dependency between attestation freshness and result delivery. Decision 12 ("Trust degrades; money doesn't") must be preserved.
4. **Reputation gaming** -- Story 6-4's reputation system is vulnerable to Sybil attacks (fake providers, self-dealing) and reputation inflation. The design must address adversarial reputation manipulation.
5. **Test infrastructure scale** -- Multi-agent stories (6-2) may require 3+ Docker nodes in the E2E test infrastructure. The current `sdk-e2e-infra.sh` supports 2 peers; scaling to 3+ requires infrastructure work.

---

## 8. Team Agreements

Based on Epic 5 learnings (all 4 stories + Docker E2E migration), the following agreements carry forward:

1. **ATDD stubs before implementation, lint-checked immediately.** Continued from Epics 1-4. Epic 5 amplification averaged 1.35x (significantly lower than Epic 4's 2.3x and Epic 3's 5x), reflecting the mature SDK patterns. Budget 1-2x for extension stories, 3-5x for novel stories.

2. **Three-pass code review model is non-negotiable.** Maintained across 12 passes. Epic 5 was the cleanest yet: 0 critical, 0 high issues. Pass #3 continued to find security-relevant issues (parser hex validation in 5-1, OWASP assessment in all stories). Story 5-4's Pass #2 and #3 were completely clean -- the first clean consecutive passes in project history.

3. **Multi-stage test amplification produces predictable results by story type.** Extension stories (5-2, 5-3, 5-4): 1.1-1.3x. Foundational stories (5-1): 1.8x. Novel architecture stories: 3-5x. Budget accordingly.

4. **No-mock integration policy for SDK tests.** New for Epic 5: integration tests must use real Docker containers via `sdk-e2e-infra.sh`, not `MockEmbeddedConnector`. Unit tests with mocks remain appropriate for isolated logic. This policy was enforced by the Docker E2E migration commit and updated in `project-context.md`.

5. **One commit per story (maintained for 5th consecutive epic).** All 4 stories had clean individual commits. Inter-story infrastructure work (Docker E2E migration) uses `test(5):` convention.

6. **Security scan every story.** Zero production findings across all 4 stories and 4,046 cumulative semgrep rules. This is the second consecutive epic with zero production security findings (after Epic 4). The `.semgrep.yml` and `.semgrepignore` configuration (resolved in epic start) eliminated the false positive triage burden from prior epics.

7. **Regression tests are non-negotiable.** Zero regressions for the 5th consecutive epic. Test count increased monotonically across all 4 stories.

8. **Traceability gate at story close.** 100% AC-to-test coverage (27/27 ACs) for the second consecutive epic. Partial coverage notes are documented transparently with specific deferred test IDs.

9. **Resolve retro action items at epic start.** **THIS AGREEMENT WAS RESTORED IN EPIC 5** after being violated in Epic 4. The epic start commit resolved 8 of 18 items including all 5 critical. This is the best resolution rate in project history.

10. **DI callbacks for orchestration classes.** Carried from Epic 4. Story 5-3's thin wrapper pattern (`publishFeedback` delegates to `publishEvent`) is a simpler variant for cases where orchestration is minimal.

11. **Trust gradient over binary gates.** Carried from Epic 4. Apply to DVM provider reputation in Story 6-4.

12. **Zero new runtime dependencies when extending established patterns.** New for Epic 5: all DVM functionality was implemented using existing `@toon-protocol/core` infrastructure. The dependency set has stabilized. Any new runtime dependency in Epic 6 should be scrutinized.

13. **ATDD step must produce failing tests only -- never production code.** New for Epic 5 (corrective): Story 5-4's ATDD deviation (implementing production code alongside tests) is explicitly prohibited going forward. ATDD = RED phase. Development = GREEN phase.

14. **Docker E2E tests for any cross-process integration.** New for Epic 5: any test that validates behavior across process boundaries (ILP routing, event storage, settlement) must use real Docker infrastructure, not mocks.

---

## 9. Timeline and Velocity

| Story | Duration (approx.) | Type |
|-------|-------------------|------|
| Epic start | ~35 min | Retro action resolution (8 items) + baseline |
| 5-1 | ~130 min (2.2h) | Event protocol (builders, parsers, constants, 149 tests) |
| 5-2 | ~180 min (3h) | Validation (zero production code, 27 tests) |
| Docker E2E migration | ~60 min (1h) | Infrastructure (mock-to-Docker test migration) |
| 5-3 | ~150 min (2.5h) | Pipeline methods (3 new methods, 42 tests) |
| 5-4 | ~180 min (3h) | Extension (skill descriptors across 3 packages, 61 tests) |

**Average story velocity:** ~160 minutes per story pipeline execution
**Total pipeline time:** ~12.25 hours (approximate, including epic start and Docker E2E migration)
**Fastest story:** 5-1 (130 min, event kind definitions)
**Slowest stories:** 5-2 and 5-4 (180 min each)

### Velocity Comparison Across Epics

| Metric | Epic 1 | Epic 2 | Epic 3 | Epic 4 | Epic 5 | Trend |
|--------|--------|--------|--------|--------|--------|-------|
| Stories | 12 | 8 | 6 | 6 | 4 | Fewer, more focused |
| ACs | 75 | 40 | 26 | 33 | 27 | Stable per story (6.75) |
| AC coverage | 100% | 100% | 100% | 97% | 100% | Restored to 100% |
| Story-specific tests | ~268 | ~193 | 244 | 275 | 279 | Increasing |
| Tests per story | 22.3 | 24.1 | 40.7 | 45.8 | 69.8 | Significant increase |
| Code review issues | 49 | 61 | 62 | 78 | 33 | Significant decrease |
| Issues per story | 4.1 | 7.6 | 10.3 | 13.0 | 8.3 | Decreased |
| Issues remaining | 3 | 0 | 6 | 0 | 0 | Clean |
| Security findings (real) | 6 | 4 | 3 | 0 | 0 | Zero for 2nd consecutive epic |
| NFR pass rate | 12/12 | 4/8 | 4/6 | 6/6 | 4/4 | 100% for 2nd consecutive epic |
| Test regressions | 0 | 0 | 0 | 0 | 0 | Maintained (5 epics) |
| Avg story duration | 55 min | 116 min | 150 min | 113 min | 160 min | Slight increase |
| Total pipeline time | ~11h | ~13h | ~14h | ~11.25h | ~12.25h | Stable |
| Retro actions resolved at start | -- | -- | 6/13 | 0/15 | 8/18 | Restored and improved |

Key observations:

- **Tests per story jumped to 69.8** (from 45.8 in Epic 4), driven by Story 5-1's 149 tests and the Docker E2E migration adding infrastructure tests. However, test amplification ratios (1.1-1.8x) are the lowest in project history, indicating that the ATDD phase is capturing more coverage upfront.

- **Code review issues decreased to 33** (from 78 in Epic 4), the lowest total since Epic 1. Issues per story also decreased from 13.0 to 8.3. This reflects DVM stories following established SDK patterns rather than introducing novel security surfaces (as TEE stories did in Epic 4).

- **AC coverage restored to 100%** after Epic 4's first PARTIAL. All 27 ACs are fully covered, with partial coverage notes documented transparently.

- **Retro action resolution restored and improved** -- 8 of 18 items resolved (44%) including all 5 critical, compared to 0 of 15 in Epic 4 and 6 of 13 in Epic 3.

- **Zero real security findings for 2nd consecutive epic** and **all NFR assessments passing for 2nd consecutive epic** confirm the codebase's quality floor has stabilized at a high level.

- **Average story duration increased slightly** to 160 min (from 113 min in Epic 4). This is partly due to Story 5-2's 3-hour duration -- notable given it required zero production code changes. The time was consumed by validation (12 issues), code review (9 issues), and test infrastructure work.

---

## 10. Known Risks Inventory

The following risks are documented from Epic 5. Risks from Epic 4 carry forward where still relevant.

| # | Risk | Severity | Source | Status |
|---|------|----------|--------|--------|
| R1 | Large test files (6+ files > 700 lines, `dvm.test.ts` at 2,704) | Medium | Epic 3 A11 | OPEN -- escalated from Low |
| R2 | Facilitator ETH monitoring not implemented | Medium | Epic 3 A8 | OPEN |
| R3 | flake.lock not committed (Nix reproducibility gap) | Medium | Epic 4 A5 | OPEN |
| R4 | No load testing infrastructure | Medium | NFR inherited | OPEN |
| R5 | No formal SLOs | Medium | NFR inherited | OPEN |
| R6 | No distributed tracing | Medium | NFR inherited | OPEN |
| R7 | No DR plan | Low | NFR inherited | OPEN |
| R8 | 31 unresolvable transitive vulnerabilities in @ardrive/turbo-sdk | Low | Epic 5 start | OPEN (no patches available) |
| R9 | ATDD RED-phase discipline violation (Story 5-4) | Low | Story 5-4 | OPEN (process) |
| R10 | parseJobResult() non-numeric amount accepted | Low | Story 5-3 | OPEN |
| R11 | No runtime re-publication of kind:10035 on handler change | Low | Story 5-4 | OPEN (stretch, Epic 6) |
| R12 | DVM event kinds not in project-context.md reference table | Low | Story 5-1 | OPEN |
| R13 | Test count discrepancy between pipeline steps | Low | Story 5-1 | OPEN |
| R14 | Deferred integration tests accumulating (8+ items across Epics 3-5) | Medium | Cross-epic | OPEN |

R1 has been escalated from Low to Medium. With `dvm.test.ts` at 2,704 lines, the test maintenance burden is becoming tangible. The file was the most-modified file in Epic 5 and will be extended further if Epic 6 adds new DVM event kinds.

R14 is new: deferred integration tests have accumulated to 8+ items across Epics 3-5. While each individual deferral is documented and justified, the cumulative gap means significant integration paths remain validated only through mocks or structural tests. The CI infrastructure resolved in the epic start should make it possible to address several of these.

---

## 11. Conclusion

Epic 5 delivered a complete DVM Compute Marketplace foundation for the TOON protocol: NIP-90 event kind definitions, ILP-native job submission (validated without production code changes), job result delivery with compute settlement, and programmatic skill descriptors for agent-to-agent service discovery. The central architectural thesis -- that the SDK's kind-agnostic pipeline supports arbitrary event kinds including DVM compute jobs -- was validated conclusively by Story 5-2's zero-production-code-change result.

The epic's process execution was the strongest in project history: all 5 critical retro action items resolved at start (best ever), 100% AC coverage restored, zero critical/high code review issues (first time), zero production security findings (second consecutive), all NFR assessments passing (second consecutive), and zero test regressions (fifth consecutive). The Docker E2E migration establishing the no-mock integration policy represents a qualitative improvement in test infrastructure fidelity.

The most significant technical contribution beyond the DVM features themselves is the `settleCompute()` pure value transfer, which proves the ILP layer can carry payments independent of data -- expanding the protocol from "pay to write" to a general-purpose payment mesh. This architectural capability will be leveraged in Epic 6 for workflow settlement chains, swarm coordination payments, and reputation-staked compute.

The deferred items are well-scoped and non-blocking: DVM event kinds table update, parser amount validation hardening, runtime re-publication of skill descriptors, and several P3 E2E tests. The largest systemic concern is the accumulation of large test files (now 6+ files over 700 lines), which should be addressed in the Epic 6 start commit.

The protocol is architecturally ready for Advanced DVM Coordination (Epic 6): the event builders and parsers provide the message format for workflow chains, the settlement infrastructure supports multi-step payment flows, the skill descriptors enable programmatic agent discovery, and the Docker E2E infrastructure provides the test harness for multi-agent scenarios.
