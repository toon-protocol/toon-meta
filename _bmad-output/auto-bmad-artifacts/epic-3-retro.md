# Epic 3 Retrospective: Production Protocol Economics

**Date:** 2026-03-14
**Epic:** 3 -- Production Protocol Economics
**Packages:** `@crosstown/core`, `@crosstown/town`, `@crosstown/sdk`
**Status:** Done (6/6 stories complete)
**Branch:** `epic-3`
**Commits:** 7 (1 epic start, 6 story commits)
**Git range:** `47c848e..5ebd67f`
**Final test count:** 1,558 total (100% pass rate)

---

## 1. Executive Summary

Epic 3 transformed the Crosstown protocol from a development-token prototype into a production-ready USDC-denominated payment system. The epic delivered six stories across three dependency waves: USDC migration and chain configuration (Wave 1-2), x402 HTTP payment on-ramp and seed relay discovery (Wave 2-3), and service discovery with enriched health reporting (Wave 3).

The most architecturally significant deliverable was Story 3.3 (x402 /publish endpoint), which introduced a second payment rail -- HTTP-based event publishing with EIP-3009 gasless USDC authorization -- alongside the existing ILP WebSocket rail. The shared `buildIlpPrepare()` function in `@crosstown/core` ensures packet equivalence between both rails, meaning the BLS and destination relay cannot distinguish x402-originated packets from ILP-originated ones. This dual-rail architecture positions Crosstown for both power-user ILP clients and lightweight HTTP clients (including AI agents).

Story 3.4 (Seed Relay Discovery) was the most topologically significant change, replacing the genesis hub-and-spoke bootstrap model with a decentralized peer discovery model using kind:10036 events on public Nostr relays. Combined with Story 3.5's kind:10035 service discovery events, Crosstown nodes can now advertise their capabilities, pricing, and payment rails to the network without depending on a specific genesis node.

All 6 stories shipped with 100% acceptance criteria coverage (26/26 ACs), 244 story-specific tests (4.98x the 49 planned), 62 code review issues found and fixed (6 remaining as informational only), 3 real security vulnerabilities fixed (command injection in shell scripts), and zero test regressions. The monorepo test count grew from 1,320 at epic start to 1,558 at close (+238 net, with 244 story-specific tests written).

---

## 2. Delivery Metrics

| Metric | Value |
|--------|-------|
| Stories delivered | 6/6 (100%) |
| Acceptance criteria | 26 total, 26 covered (100%) |
| Story-specific tests (planned) | 49 |
| Story-specific tests (actual) | 244 (4.98x planned) |
| Monorepo test count (start) | 1,320 passing / 185 skipped |
| Monorepo test count (end) | 1,558 passing |
| Code review issues found | 62 total |
| Code review issues fixed | 56 |
| Code review issues remaining | 6 (all informational) |
| Security scan findings | 6/6 stories PASS, 3 real vulnerabilities fixed |
| NFR assessments | 4 PASS, 2 CONCERNS (non-blocking) |
| Traceability gate | PASS (26/26 ACs, all priorities 100%) |
| Migrations | 0 |
| Files changed | 89 |
| Lines added/removed | +19,727 / -1,253 |
| Wall-clock duration | ~14 hours |

### Code Review Breakdown

| Severity | Found | Fixed | Remaining |
|----------|-------|-------|-----------|
| Critical | 0 | 0 | 0 |
| High | 6 | 6 | 0 |
| Medium | 24 | 24 | 0 |
| Low | 32 | 26 | 6 (informational) |

All 6 stories converged to 0 actionable issues on their final code review pass.

### Code Review by Story

| Story | Pass #1 | Pass #2 | Pass #3 | Total |
|-------|---------|---------|---------|-------|
| 3-1 | 5 | 2 | 0 | 7 |
| 3-2 | 2 | 0 | 0 | 2 |
| 3-3 | 7 | 3 | 6 | 16 |
| 3-4 | 8 | 7 | 7 | 22 |
| 3-5 | 6 | 0 | 1 | 7 |
| 3-6 | 3 | 4 | 1 | 8 |

### Security Scan Breakdown

| Story | Findings | Real Issues | False Positives | Action |
|-------|----------|-------------|-----------------|--------|
| 3-1 | 8 | 3 (command injection in shell scripts) | 5 (ws:// in Docker contexts) | Fixed with input validation |
| 3-2 | 1 | 0 | 1 | Triaged |
| 3-3 | 17 | 0 | 17 (ws://, test data) | Analyzed, suppressed |
| 3-4 | 13 | 0 | 13 (CWE-319 on ws:// in validation/docs) | Suppressed with nosemgrep |
| 3-5 | 0 | 0 | 0 | Clean scan |
| 3-6 | 0 | 0 | 0 | Clean scan |

### NFR Summary

| Story | Rating | Detail |
|-------|--------|--------|
| 3-1 | PASS | Configuration-level migration, no new runtime logic |
| 3-2 | PASS | 6 pass, 2 pre-existing concerns |
| 3-3 | CONCERNS | 18/29 (62%); opt-in feature, 2 HIGH items (dependency audit, facilitator ETH monitoring) |
| 3-4 | CONCERNS | Safe to merge; operational readiness gaps are pre-production items |
| 3-5 | PASS | 21/29 score, 0 blockers |
| 3-6 | PASS | 27/29 (93%), 2 non-blocking concerns |

---

## 3. Successes

### 3.1. Test Amplification Far Exceeded Plans

The epic's test plan called for 49 tests across 6 stories. The pipeline produced 244 story-specific tests -- a 4.98x amplification factor. This was driven by the test automate, test review, and trace gap-fill steps consistently identifying coverage gaps beyond the initial ATDD stubs. Story 3.4 (Seed Relay Discovery) was the most dramatic example: 12 ATDD stubs expanded to 61 tests across 3 files (seed-relay-discovery.test.ts, town.test.ts, cli.test.ts). This amplification validates the multi-stage testing pipeline: ATDD sets the floor, but subsequent stages systematically find and fill gaps.

### 3.2. Shared buildIlpPrepare() Preserved Packet Equivalence

The highest-risk design decision in Epic 3 was ensuring that x402-originated ILP packets are indistinguishable from ILP-originated ones (risk E3-R007, score 8). This was achieved by extracting packet construction into a shared `buildIlpPrepare()` function in `@crosstown/core`. Both the SDK's `publishEvent()` and the x402 handler call this function, guaranteeing identical TOON encoding, amount computation, and destination formatting. The test suite includes explicit equivalence tests (T-3.3-03, T-3.3-13) that construct packets via both paths and assert byte-level identity.

### 3.3. Three-Pass Code Review Continued to Find Distinct Issue Classes

Across 6 stories and 18 review passes, the three-pass model again demonstrated differentiated value:
- **Pass #1** caught structural issues: stale AGENT references, sprint status errors, type widening opportunities, duplicate code, missing exports (35 issues total)
- **Pass #2** caught deeper logic issues: naming collisions, NaN validation gaps, deprecated type names, response type narrowing (9 issues total)
- **Pass #3** caught security and correctness issues: missing EVM format validation (OWASP A03/A04), event signature verification (CWE-345), input clamping, BigInt boundary correctness (15 issues total)

Story 3.3 had the highest total (16 issues), justified by its architectural complexity (6-check pre-flight pipeline, on-chain settlement, multi-module orchestration). Story 3.4's Pass #3 caught a high-severity CWE-345 finding -- missing `verifyEvent()` calls on kind:10036 and kind:10032 events received from untrusted relays -- that would have allowed event forgery in the peer discovery path.

### 3.4. Epic Start Resolved 6 of 13 Retro Action Items

The epic start commit (`47c848e`) resolved 6 action items from the Epic 2 retro:
- **A1**: Already fixed (Story 2-7)
- **A4**: Cleaned stale SPSP references from core README files
- **A5**: Bumped simple-git (critical RCE) and hono (timing attack)
- **A8**: Added runtime warnings and security help text for CLI secret exposure
- **A12**: Deleted the 943-line legacy `docker/src/entrypoint.ts` file

This front-loading eliminated dead code and reduced security exposure before any story development began.

### 3.5. One Commit Per Story Maintained Across All 6 Stories

The 1-commit-per-story convention held perfectly for all 6 stories with no exceptions needed. Each commit message follows the `feat(3-N):` pattern with descriptive summaries. This is an improvement over Epic 2 where Stories 2-7 and 2-8 shared a commit due to implementation coupling.

### 3.6. Security Scanning Caught Real Command Injection Vulnerabilities

Story 3.1's semgrep scan identified 3 command injection vulnerabilities in `fund-peer-wallet.sh` where user-supplied arguments were passed directly to `cast` commands without validation. These were fixed with proper input validation (hex address format, numeric amount). While the shell scripts are dev-only tooling, the fix prevents accidental command injection during local development and demonstrates that security scanning provides value even for non-production code.

### 3.7. Story 3.3 Was the Most Complex Story Yet -- and Delivered Clean

Story 3.3 (x402 /publish endpoint) was the most architecturally complex story in the project's history: 7 new files, a 6-check pre-flight validation pipeline, EIP-3009 on-chain settlement via viem, shared packet construction, configurable pricing with routing buffer, and 4.5 hours of pipeline time. Despite this complexity, the story shipped with 57 active tests, all 8 ACs covered, 16 code review issues found and fixed, and 0 security findings. The opt-in feature flag (`CROSSTOWN_X402_ENABLED`, disabled by default) de-risks deployment.

---

## 4. Challenges

### 4.1. False Positive Rate in Security Scanning Increased Significantly

Across 6 stories, semgrep produced 39 findings, of which only 3 were real vulnerabilities (7.7% true positive rate). The remaining 36 were false positives, predominantly CWE-319 ("Cleartext Transmission of Sensitive Information") triggered by `ws://` URLs in Docker-internal contexts, test data, and URL validation code. Each false positive required manual triage and `nosemgrep` suppression with documentation. Story 3.3 alone produced 17 false positives and Story 3.4 produced 13. This overhead adds ~5-10 minutes per story for triage without catching real issues.

**Recommendation**: Create a project-level semgrep configuration that pre-suppresses `ws://` patterns in Docker compose files, test fixtures, and URL validation functions.

### 4.2. Story 3.3 Was Disproportionately Large

At 4.5 hours, Story 3.3 consumed nearly a third of the epic's 14-hour pipeline time. This was driven by the combination of: 7 new files across 2 packages, a 6-check pre-flight pipeline with injectable dependencies, EIP-3009 settlement integration, 16 code review issues across 3 passes (including high-severity items), and a trace gap-fill cycle requiring 11 additional tests. While the story's scope was appropriate for its architectural significance, the 3:1 duration ratio (vs. the ~90-minute average for other stories) confirms the Epic 2 observation that protocol-level stories should budget extra time.

### 4.3. NFR CONCERNS on Stories 3.3 and 3.4 Highlight Pre-Production Gaps

Stories 3.3 (x402) and 3.4 (Seed Relay Discovery) both received CONCERNS ratings on their NFR assessments. The concerns are consistent:
- No dependency audit for viem dependency chain (Story 3.3)
- Facilitator ETH monitoring not implemented (Story 3.3)
- No structured logging (Story 3.4)
- No SLO definitions (Story 3.4)
- No performance baselines (both)

These are not story-level defects but project-level infrastructure gaps that have persisted since Epic 1. The pattern of "handler-level quality strong, project-level infrastructure weak" continues. These items are increasingly urgent as Epic 4 moves toward TEE deployment where operational monitoring is non-negotiable.

### 4.4. Mock USDC Fidelity Gap Remains Open

Story 3.1 replaced AGENT with USDC across the protocol, but the Anvil mock USDC contract still uses 18 decimals (the original AGENT ERC-20) while `USDC_DECIMALS = 6` reflects production semantics. The story documented this gap with JSDoc in `usdc.ts` and deferred FiatTokenV2_2 deployment to Story 3.3's scope, but Story 3.3 ultimately did not deploy FiatTokenV2_2 either -- it used injectable settlement mocks instead. This means the on-chain mock USDC still does not implement EIP-3009 `transferWithAuthorization`, and the production fidelity gap remains open for Epic 4 or a dedicated infrastructure task.

### 4.5. E2E Tests Deferred for Third Consecutive Epic

All 6 stories' E2E steps were skipped (backend-only, no deployed infrastructure). Two P3 E2E tests were explicitly deferred: T-3.4-12 (seed relay discovery against genesis infrastructure) and 3.6-E2E-001 (health endpoint against live node). The CI genesis node action item (A2 from Epic 1) remains unresolved after 3 full epics. While unit and integration tests are comprehensive, the absence of automated E2E validation means integration paths between packages are only validated manually during deployment.

### 4.6. Test File Size Growing Large

Story 3.4's `seed-relay-discovery.test.ts` reached 1,401 lines, and Story 3.3's `x402-publish-handler.test.ts` reached a comparable size. These large test files are harder to navigate and maintain. The story reports recommend splitting, but no action was taken within the epic. Future stories should consider test file organization as a quality criterion.

---

## 5. Key Insights

### 5.1. Dual Payment Rails Enable Different Client Populations

The most important architectural insight from Epic 3 is that the dual ILP + x402 payment architecture serves fundamentally different client populations:
- **ILP rail**: Power users running their own Crosstown nodes, opening persistent payment channels, routing multi-hop packets. Requires WebSocket connectivity and channel management.
- **x402 rail**: Lightweight HTTP clients, AI agents, one-shot publishers. Single POST request with EIP-3009 authorization. No WebSocket, no channel, no ILP knowledge required.

Both rails produce identical ILP PREPARE packets via `buildIlpPrepare()`, so the rest of the protocol (BLS processing, relay storage, peer routing) is rail-agnostic. This separation of entry points from packet processing is a pattern worth preserving and documenting for future payment rails (e.g., Lightning, Solana).

### 5.2. Decentralized Discovery Is Additive, Not Replacement

Story 3.4's seed relay discovery is designed as an additive mode (`discovery: 'seed-list'`) with genesis remaining the default. This was a deliberate architectural decision: discovery populates `knownPeers` and delegates to the existing `BootstrapService`. The `SeedRelayDiscovery` class is a peer-finding adapter, not a bootstrap replacement. This composability means future discovery modes (e.g., DHT-based, attestation-first) can follow the same pattern: implement the discovery logic, populate `knownPeers`, and let `BootstrapService` handle the rest.

### 5.3. Chain Configuration Enables Multi-Environment Deployment Without Code Changes

Story 3.2's `resolveChainConfig()` and `CHAIN_PRESETS` map means switching between Anvil, Arbitrum Sepolia, and Arbitrum One requires only a single config change (`chain: 'arbitrum-one'`) or environment variable (`CROSSTOWN_CHAIN=arbitrum-one`). All dependent values -- RPC URL, USDC address, TokenNetwork address, chain ID, EIP-712 domain -- resolve from the preset. This eliminates the entire class of "wrong chain" configuration errors and will be essential for Epic 4's TEE deployment where enclave configuration must be minimal and deterministic.

### 5.4. Pre-Flight Validation Pattern Is Reusable

Story 3.3's 6-check pre-flight pipeline (`x402-preflight.ts`) established a clean pattern for multi-check request validation: ordered by computational cost (cheap checks first), each check returns success or a typed failure, the pipeline short-circuits on first failure, and every check is individually testable via dependency injection. This pattern should be reused for future endpoints that require multi-step validation (e.g., attestation verification in Epic 4, DVM job validation in Epic 5).

### 5.5. Static Analysis Tests Extended to Integration Verification

Stories 3.4, 3.5, and 3.6 all used the static analysis test pattern (reading source files and asserting structural properties) pioneered in Epic 2 Story 2-7. The pattern was extended beyond "verification by absence" to "verification by presence": tests assert that `town.ts` contains specific integration points (e.g., `createHealthResponse`, `publishSeedRelayEntry`, `buildServiceDiscoveryEvent`). This catches integration drift -- if `startTown()` is refactored and the integration call is accidentally removed, the static analysis test fails even though no unit test would catch the missing integration.

### 5.6. Test Amplification Ratio Is Predictable by Story Complexity

The test amplification ratio (actual tests / planned tests) correlates with story architectural complexity:

| Story | Planned | Actual | Ratio | Complexity |
|-------|---------|--------|-------|------------|
| 3-1 | 5 | 23 | 4.6x | Migration (broad but shallow) |
| 3-2 | 13 | 28 | 2.2x | Configuration (focused) |
| 3-3 | 15 | 57 | 3.8x | New endpoint (deep) |
| 3-4 | 4 | 61 | 15.3x | Discovery (broad + deep) |
| 3-5 | 4 | 52 | 13.0x | Event builder (broad surface) |
| 3-6 | 3 | 23 | 7.7x | Endpoint enrichment (moderate) |

Stories with broader surface areas (3-4 and 3-5 touch multiple packages) and deeper dependency chains amplify more. This insight can inform future test planning: budget 3-5x for focused stories, 10-15x for cross-cutting stories.

---

## 6. Action Items for Epic 4

### 6.1. Must-Do (Blockers for Epic 4)

| # | Action | Owner | Status | Story Affected |
|---|--------|-------|--------|----------------|
| A1 | **Deploy FiatTokenV2_2 on Anvil with 6 decimals and EIP-3009** -- Mock USDC still uses 18-decimal AGENT ERC-20 at the same address. TEE attestation verification will need on-chain interactions with proper USDC semantics. | Dev | OPEN | 4-1, 4-2 |
| A2 | **Set up genesis node in CI** (carried from Epic 1 A2, Epic 2 A2, Epic 3) -- 3 full epics with no automated E2E validation. TEE deployment testing absolutely requires infrastructure. | Dev | OPEN | 4-1, 4-3, 4-6 |
| A3 | **Research Marlin Oyster CVM deployment requirements** -- Docker image packaging, attestation server configuration, proxy endpoint mapping, Nautilus KMS API. Must be done before Story 4.1 begins. | Dev | OPEN | 4-1 |

### 6.2. Should-Do (Quality Improvements)

| # | Action | Owner | Status | Reason |
|---|--------|-------|--------|--------|
| A4 | **Create project-level semgrep configuration** -- Suppress CWE-319 false positives for ws:// in Docker compose, test fixtures, and URL validation. 36 false positives in Epic 3 consumed significant triage time. | Dev | OPEN | Pipeline efficiency |
| A5 | **Address transitive dependency vulnerabilities** (carried from Epic 2 A5) -- 42 transitive vulnerabilities remain. Run `pnpm audit` with new viem dependency chain. | Dev | OPEN | Security hygiene |
| A6 | **Replace `console.error` with structured logger** (carried from Epic 1 A4, Epic 2 A6) -- Three epics deferred. TEE deployment requires structured logging for enclave observability. | Dev | OPEN | Production observability |
| A7 | **Wire viem clients in startTown() for production x402** -- `walletClient` and `publicClient` are currently injected in tests but not created by `startTown()`. Production x402 facilitators need this wiring. | Dev | OPEN | Production readiness |
| A8 | **Set up facilitator ETH monitoring** -- x402 facilitator account needs ETH for gas. No monitoring exists. | Dev | OPEN | Production operations |
| A9 | **Refactor SDK publishEvent() to use shared buildIlpPrepare()** -- SDK inline packet construction should call the shared function for consistency. | Dev | OPEN | Code consistency |
| A10 | **Update Docker entrypoint-town.ts for new config fields** -- Does not consume seed relay, service discovery, or health config fields. Operators using Approach A miss Epic 3 features. | Dev | OPEN | Feature parity |

### 6.3. Nice-to-Have

| # | Action | Owner | Reason |
|---|--------|-------|--------|
| A11 | **Split large test files** -- `seed-relay-discovery.test.ts` (1,401 lines) and `x402-publish-handler.test.ts` are unwieldy. Consider splitting by test category. | Dev | Maintainability |
| A12 | **Implement deferred P3 E2E tests** -- T-3.4-12 (seed relay E2E) and 3.6-E2E-001 (health E2E) deferred due to no infrastructure. | Dev | Test coverage |
| A13 | **Fix NIP-33/NIP-16 documentation discrepancy** -- test-design-epic-3.md references "NIP-33" for test 3.5-UNIT-001; implementation uses NIP-16 correctly. | Dev | Documentation accuracy |
| A14 | **Publish @crosstown/town to npm** (carried from Epic 2 A3) -- Package verified ready but manual publish not executed. | Dev | Distribution |
| A15 | **Ensure code review agents run Prettier before committing** (carried from Epic 1 A9, Epic 2 A11) | Tooling | Eliminate recurring format fixes |

---

## 7. Epic 4 Preparation Tasks

Epic 4 (Marlin TEE Deployment) has 6 stories:

| Story | Title | Key Features |
|-------|-------|-------------|
| 4-1 | Oyster CVM Packaging | Docker image for Marlin Oyster CVM, attestation server config |
| 4-2 | TEE Attestation Events | kind:10033 events with PCR values, enclave image hash |
| 4-3 | Attestation-Aware Peering | BootstrapService verifies kind:10033 before trusting peers |
| 4-4 | Nautilus KMS Identity | Enclave-bound Nostr keypairs from KMS seeds |
| 4-5 | Nix Reproducible Builds | Deterministic PCR values across build environments |
| 4-6 | Attestation-First Seed Relay Bootstrap | kind:10036 bootstrap verifies TEE attestation trust anchor |

### Preparation Checklist

- [ ] **Resolve A1** (FiatTokenV2_2 deployment) -- On-chain USDC with proper decimals and EIP-3009
- [ ] **Resolve A3** (Marlin Oyster CVM research) -- Understand deployment requirements before Story 4.1
- [ ] **Plan A2** (CI genesis node) -- 3 epics deferred; TEE testing requires live infrastructure
- [ ] **Review Marlin documentation** -- Oyster CVM SDK, attestation server API, proxy configuration, Nautilus KMS
- [ ] **Review kind:10036 seed relay discovery** -- Story 4.6 extends seed relay bootstrap with attestation verification
- [ ] **Create ATDD stubs for Epic 4 stories** -- Following the validated pattern of front-loading test stubs
- [ ] **Create Epic 4 test design document** -- Risk-based format, identify attestation verification and KMS integration risks
- [ ] **Lint-check all ATDD stubs** (per A7 from Epic 2) -- Ensure no ESLint debt carries into story development
- [ ] **Evaluate Nix tooling requirements** -- Story 4.5 requires Nix for reproducible builds; assess team familiarity
- [ ] **Review existing Docker image** -- Story 4.1 will repackage the existing image for Oyster CVM

### Key Risks for Epic 4

1. **External dependency on Marlin Oyster** -- Story 4.1 requires deploying to Marlin's CVM platform. Platform APIs, documentation quality, and testnet availability are not under our control.
2. **Nix learning curve** -- Story 4.5 introduces Nix for reproducible builds. If the team has no Nix experience, this story could take disproportionately long.
3. **Nautilus KMS integration** -- Story 4.4 requires integrating with Marlin's KMS for enclave-bound keypairs. The API may not be well-documented or may have breaking changes.
4. **Attestation verification correctness** -- Stories 4.3 and 4.6 must verify PCR measurements against known-good values. Incorrect verification could either accept compromised nodes or reject valid ones. This is a security-critical path.
5. **CI dependency (critical)** -- Without CI infrastructure (deferred since Epic 1), TEE deployment testing will be entirely manual. This is the highest-risk item for Epic 4 and should be resolved before the epic begins.
6. **No E2E test baseline** -- The project has never run automated E2E tests in CI. Epic 4's enclave-based testing will be even harder to automate. Establishing E2E CI for the existing stack before attempting enclave E2E is strongly recommended.

---

## 8. Team Agreements

Based on Epic 3 learnings (all 6 stories), the following agreements carry forward:

1. **ATDD stubs before epic start, lint-checked immediately.** Continued from Epics 1-2. Epic 3 proved the ATDD-to-final amplification ratio averages 5x, with cross-cutting stories reaching 13-15x. Plan for amplification, not just ATDD counts.

2. **Three-pass code review model.** Maintained and validated across 6 stories. Pass #3's OWASP focus caught high-severity issues in Stories 3.3 (missing EVM format validation) and 3.4 (CWE-345 event verification bypass). The three-pass model is non-negotiable for security-sensitive stories.

3. **Multi-stage test amplification.** New for Epic 3: the test automate, test review, and trace gap-fill stages consistently produce 3-15x the initial ATDD test count. Accept this as a feature, not overhead. Budget story time accordingly.

4. **Static analysis tests for integration verification.** Extended from Epic 2's "verification by absence" to "verification by presence" -- asserting that integration points exist in composition functions like `startTown()`. This pattern catches integration drift that unit tests miss.

5. **One commit per story (no exceptions in Epic 3).** All 6 stories had clean, individual commits. The Epic 2 exception (Stories 2-7/2-8 sharing a commit) was avoided by ensuring stories have independent implementation paths.

6. **Security scan every story.** Maintained across all 6 stories. Found 3 real command injection vulnerabilities (Story 3.1). False positive rate (92.3%) is high; project-level semgrep configuration recommended to reduce triage overhead (Action A4).

7. **Regression tests are non-negotiable.** Zero regressions across 6 stories. Every regression step passed on first attempt. Test count increased monotonically.

8. **Traceability gate at story close.** 100% AC-to-test coverage maintained for all 6 stories (26/26 ACs). Trace gap-fill cycle (Story 3.3) produced 11 additional tests, demonstrating the gate's value as a safety net.

9. **Resolve retro action items at epic start.** Epic 3 resolved 6 of 13 action items from Epic 2 in the epic start commit. Four items carry forward (CI, structured logger, dependency audit, npm publish). Repeat for Epic 4 with emphasis on CI (A2), which has been deferred for 3 epics.

10. **Opt-in feature flags for high-risk features.** New for Epic 3: the x402 endpoint is disabled by default (`CROSSTOWN_X402_ENABLED`). This pattern de-risks deployment and allows incremental rollout. Apply to TEE features in Epic 4 where enclave-specific behavior should be opt-in until validated.

11. **Shared functions for cross-rail consistency.** New for Epic 3: `buildIlpPrepare()` ensures packet equivalence between ILP and x402 rails. Any future payment rail must use this shared function. Extend this pattern to other cross-cutting concerns (e.g., attestation verification in Epic 4).

---

## 9. Timeline and Velocity

| Story | Duration (approx.) | Type |
|-------|-------------------|------|
| Epic start | 45 min | Retro actions + baseline |
| 3-1 | 150 min (2.5h) | Migration (broad, 33+ files) |
| 3-2 | 90 min | Configuration system |
| 3-3 | 270 min (4.5h) | New endpoint + payment rail (largest story) |
| 3-4 | 210 min (3.5h) | Discovery system |
| 3-5 | 90 min | Event builder + integration |
| 3-6 | 90 min | Endpoint enrichment |

**Average story velocity:** ~150 minutes per story pipeline execution
**Total pipeline time:** ~14 hours (approximate)
**Fastest stories:** 3-2, 3-5, 3-6 (90 min each)
**Slowest story:** 3-3 (270 min, x402 endpoint with on-chain settlement)

### Velocity Comparison Across Epics

| Metric | Epic 1 | Epic 2 | Epic 3 | Trend |
|--------|--------|--------|--------|-------|
| Stories | 12 | 8 | 6 | Fewer, larger stories |
| ACs | 75 | 40 | 26 | Proportional to story count |
| AC coverage | 100% | 100% | 100% | Maintained |
| Story-specific tests | ~268 | ~193 | 244 | Increasing per story |
| Tests per story | 22.3 | 24.1 | 40.7 | Growing (more amplification) |
| Code review issues | 49 | 61 | 62 | Stable (proportional to complexity) |
| Issues remaining | 3 (accepted) | 0 | 6 (informational) | Stable |
| Security findings (real) | 6 | 4 | 3 | Decreasing (fewer new surfaces) |
| NFR pass rate | 12/12 | 4/8 | 4/6 | Project-level gaps persist |
| Test regressions | 0 | 0 | 0 | Maintained |
| Avg story duration | 55 min | 116 min | 150 min | Increasing complexity per story |
| Total pipeline time | ~11h | ~13h | ~14h | Stable with fewer, larger stories |

Key observations:
- **Tests per story** nearly doubled from Epic 1 (22.3) to Epic 3 (40.7), reflecting the multi-stage test amplification pipeline maturing.
- **Average story duration** increased 2.7x from Epic 1, but each story now covers more architectural surface area. Epic 3 stories introduce new systems (chain config, payment rails, discovery protocols) rather than enabling existing ATDD stubs.
- **Code review issues** remained stable (~62) despite fewer stories, driven by Story 3.3's 16 issues and Story 3.4's 22 issues -- the most complex stories found the most issues.
- **Real security findings** decreased from 6 (Epic 1) to 3 (Epic 3), suggesting the codebase's security posture is improving as foundational patterns (input validation, CWE-209 prevention) are established.

---

## 10. Known Risks Inventory

The following 12 risks are documented from Epic 3. None are blocking, but several are increasingly urgent.

| # | Risk | Severity | Source | Status |
|---|------|----------|--------|--------|
| R1 | Mock USDC uses 18 decimals, not 6 | Medium | Story 3-1 | Open (A1) |
| R2 | SDK publishEvent() inline packet construction | Low | Story 3-3 | Open (A9) |
| R3 | viem client production wiring for x402 | Medium | Story 3-3 | Open (A7) |
| R4 | Dependency audit for viem chain | Medium | Story 3-3 NFR | Open (A5) |
| R5 | Facilitator ETH monitoring | Medium | Story 3-3 NFR | Open (A8) |
| R6 | Docker entrypoint schema inconsistency | Low | Story 3-6 | Open (A10) |
| R7 | Deferred P3 E2E tests (2 tests) | Low | Stories 3-4, 3-6 | Open (A12) |
| R8 | Pre-production operational readiness | Medium | Story 3-4 NFR | Open |
| R9 | 42 transitive dependency vulnerabilities | Medium | Epic start | Open (A5) |
| R10 | NIP-33/NIP-16 doc discrepancy | Low | Story 3-5 | Open (A13) |
| R11 | Large test files (>1000 lines) | Low | Stories 3-3, 3-4 | Open (A11) |
| R12 | No non-Anvil chain E2E tests | Medium | Story 3-2 | Open |

---

## 11. Conclusion

Epic 3 delivered a production-grade payment architecture for the Crosstown protocol: USDC denomination, multi-chain configuration, dual ILP/x402 payment rails, decentralized peer discovery, service capability advertising, and comprehensive health reporting. The central architectural thesis -- that x402 HTTP payments can produce packets identical to ILP payments via a shared construction function -- was proven and tested.

The test pipeline matured significantly: the 4.98x test amplification ratio (49 planned to 244 actual) demonstrates that the multi-stage approach (ATDD -> automate -> review -> trace -> gap-fill) systematically finds coverage gaps that initial test planning misses. This amplification should be expected and budgeted for in future epics.

Three systemic items carry forward as increasingly urgent: CI/E2E infrastructure (3 epics deferred), structured logging (3 epics deferred), and dependency vulnerability remediation (2 epics deferred). Epic 4's TEE deployment will make all three non-negotiable -- enclave-based testing requires infrastructure, enclave observability requires structured logging, and production deployment requires clean dependency audit.

The protocol is architecturally ready for TEE deployment: seed relay discovery (kind:10036) provides the bootstrap mechanism that Story 4.6 will extend with attestation verification, service discovery (kind:10035) provides the capability advertising that attestation events (kind:10033) will complement, and the chain configuration system supports the multi-environment deployment that TEE staging requires.
