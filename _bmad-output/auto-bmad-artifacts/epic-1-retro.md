# Epic 1 Retrospective: ILP-Gated Service Node SDK

**Date:** 2026-03-05
**Epic:** 1 -- ILP-Gated Service Node SDK
**Package:** `@crosstown/sdk`
**Status:** Done (12/12 stories complete)
**Branch:** `epic-1`
**Commits:** 12 (one per story, squashed)
**Final test count:** 1,401 (100% pass rate)

---

## 1. Executive Summary

Epic 1 delivered the `@crosstown/sdk` package -- a developer-facing abstraction for building ILP-gated service nodes. From a 12-word seed phrase and ~10 lines of code, developers can create a fully wired node with unified secp256k1 identity (Nostr + EVM), TOON-native kind-based event handling, configurable pricing validation, embedded connector lifecycle management, network discovery, and dev mode. The package is ESM-only, TypeScript-strict, Node >=20, and npm-publish-ready.

All 12 stories (1-0 through 1-11) shipped with 100% acceptance criteria coverage (75/75 ACs), 268+ story-specific tests, and zero remaining critical or high-severity issues. The codebase grew from 0 SDK tests at epic start to 1,401 total monorepo tests at close with zero regressions.

---

## 2. Delivery Metrics

| Metric | Value |
|--------|-------|
| Stories delivered | 12/12 (100%) |
| Acceptance criteria | 75 total, 75 covered (100%) |
| Story-specific tests | ~268 |
| Monorepo test count (start) | 0 SDK / ~1,221 total |
| Monorepo test count (end) | ~180 SDK / 1,401 total |
| Code review issues found | 49 total |
| Code review issues fixed | 46 |
| Code review issues accepted | 3 (intentional design decisions) |
| Security scan findings | 6 total, all fixed |
| NFR assessments | 12/12 passed |
| Traceability gate | PASS (P0: 100%, P1: 100%) |
| Migrations | 0 |

### Code Review Breakdown

| Severity | Found | Fixed | Accepted |
|----------|-------|-------|----------|
| Critical | 0 | 0 | 0 |
| High | 0 | 0 | 0 |
| Medium | 21 | 21 | 0 |
| Low | 28 | 25 | 3 |

The 3 accepted low-severity items were intentional design decisions:
1. Story 1-7: Unused config fields in `PaymentHandlerBridgeConfig` (reserved for `createNode()` composition)
2. Story 1-7: `as unknown as HandlePacketResponse` double-cast bridging SDK/core type gap
3. Story 1-7: `console.error` in T00 error boundary (matches project convention; structured logger deferred)

### Security Scan Breakdown

| Story | Finding | Fix |
|-------|---------|-----|
| 1-7 | Unbounded `Buffer.from` DoS | Added `MAX_PAYLOAD_BASE64_LENGTH` guard |
| 1-8 | Insecure `btp+ws://` URL in test data | Changed to `btp+wss://` |
| 1-9 | Config handler kind validation bypass | Added kind type validation |
| 1-9 | Log injection vulnerability | Added sanitization for pubkey/destination in log output |
| 1-9 | Missing pubkey validation on `peerWith()` | Added hex format + length validation |
| 1-9 | Error logging data leakage | Error messages now extract message only |

---

## 3. Successes

### 3.1. ATDD Red Phase Paid Off Massively

The ATDD (Acceptance Test-Driven Development) red phase -- writing all test stubs and implementations before the epic officially started -- proved to be the single most impactful decision. Stories 1-2, 1-3, 1-4, 1-5, and 1-8 required zero production code changes during the develop step because their implementations were already correct from the ATDD phase. Story 1-3 completed with literally no source code modifications. This front-loading reduced the critical path to test enablement and gap-filling rather than greenfield implementation.

### 3.2. Clean Commit History

Each story produced exactly one squashed commit on `epic-1`, creating a readable 12-commit history that maps 1:1 to stories. Commit messages follow a consistent pattern (`feat(1-N):` for feature stories, `refactor(1-0):` for the extraction). This will make Cherry-picking, bisecting, and auditing straightforward.

### 3.3. Pipeline Ordering Correctly Identified as Highest Risk

The epic start report flagged pipeline ordering (shallow parse -> verify -> price -> dispatch) as risk E1-R11 with the highest score (9). Story 1-7's NFR assessment caught a critical flaw where the T-1.7-01 pipeline ordering test was testing wrapper spy labels rather than actual pipeline behavior, and it was rewritten as a multi-probe behavioral verification test. This validates the risk-based test design approach -- the highest-risk area received the most scrutiny and the catch justified the investment.

### 3.4. Security Scan Caught Real Issues

Semgrep security scans found 6 actionable issues across the epic, all fixed before merge. The most significant was the unbounded `Buffer.from` DoS in Story 1-7 and the four defense-in-depth issues in Story 1-9 (log injection, missing validation, data leakage). These were real security defects that would have shipped without automated scanning.

### 3.5. Zero Regressions Across 12 Stories

Despite 12 sequential stories modifying shared code (especially `create-node.ts`, `index.ts`, and `vitest.config.ts`), no story introduced a regression. Every regression test step passed on first attempt. The monorepo test count increased monotonically from 1,221 to 1,401.

### 3.6. Story Sizing Was Accurate

The epic start report noted all 12 stories had 3-5 ACs, and none exceeded the 8-AC oversized threshold. In practice, the largest stories (1-1 with 11 ACs, 1-3 with 9 ACs) still completed within pipeline bounds. No story required splitting or rescoping during implementation.

### 3.7. Traceability Was 100% From Day One

Every story achieved 100% AC-to-test traceability at the traceability gate step. No gaps were found that required retroactive test addition at the traceability step itself -- all gaps were caught earlier by the test automate and test review steps.

---

## 4. Challenges

### 4.1. Story 1-1 Had Disproportionate Infrastructure Burden

Story 1-1 (Unified Identity) was the first story to create the `@crosstown/sdk` package. It carried the weight of: creating the package scaffold, setting up `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`, `package.json`, the error hierarchy, stub files for all future stories, and fixing 433 TypeScript strict-mode errors across the monorepo. The actual identity implementation was ~100 lines but the infrastructure work was ~25 minutes of the 90-minute pipeline. Future epics should separate "create package scaffold" from "first feature story" when introducing a new package.

### 4.2. Stale Test Counts in Story Artifacts

Multiple stories (1-5, 1-8, 1-11) had code review findings for stale test counts in story documentation. The pipeline adds tests at multiple stages (ATDD, test automate, test review, code review fixes), but the story artifact's test count fields are written at story create time and not automatically updated. This created recurring low-severity findings that consumed review time without preventing any real defect.

### 4.3. TOON Byte-Level Manipulation Was Fragile

Stories 1-7 and 1-10 both encountered the same issue: flipping bytes in a TOON-encoded event to test signature verification doesn't just invalidate the signature -- it corrupts the TOON structure, causing a parse error before verification runs. Both stories independently discovered they needed to use structurally valid TOON with corrupted signature hex strings instead of binary byte-flipping. This knowledge should be documented as a testing pattern for future stories.

### 4.4. Type Gap Between SDK and Core

The `HandlePacketResponse` type in `@crosstown/core` and the SDK's internal handler response types don't perfectly align. Story 1-7 introduced an `as unknown as HandlePacketResponse` double-cast to bridge this gap. While accepted as an intentional design decision, this type unsafety could cause subtle bugs if the types diverge further. The gap should be closed before Epic 2's relay reimplementation exercises the full type chain end-to-end.

### 4.5. Integration Tests Require Genesis Node

Story 1-9's integration tests for network discovery require a running genesis node. Without infrastructure, these tests skip gracefully, but they cannot be validated in a pure unit-test CI run. This is acceptable for Epic 1 (SDK development) but will be a blocker for Epic 2's E2E validation story.

---

## 5. Key Insights

### 5.1. "Enable ATDD Tests" Stories Were Fast and Low-Risk

Stories 1-2 through 1-5 and 1-8 followed a pattern: unskip existing ATDD tests, fix priority labels, add gap-filling tests, run code review. These stories had zero production code changes and completed in 35-45 minutes each. This pattern should be preserved for future epics: invest in comprehensive ATDD stubs before the epic starts, then "develop" means "validate and harden."

### 5.2. Code Review Pass #3 Found Different Things Than Pass #1

Pass #1 typically caught structural issues (DRY violations, type safety, misleading comments). Pass #3, which includes OWASP Top 10 analysis, caught security-relevant issues (information disclosure in error logging, prototype-unsafe property lookups, generic error messages). The three-pass model works: passes #1 and #2 clean up code quality, pass #3 focuses on security.

### 5.3. Story Validation Step Had High Issue Count

The validate step averaged 7-8 issues per story, with Story 1-8 finding 15. These weren't bugs -- they were spec quality issues (missing FRs, wrong priority labels, ambiguous language, missing dependencies). The validate step is functioning as intended: it catches specification defects before any code is written.

### 5.4. NFR Assessment Uncovered One Critical Test Flaw

The NFR assessment for Story 1-7 discovered that the T-1.7-01 pipeline ordering test was fundamentally flawed -- testing spy labels attached to a wrapper function rather than actual pipeline behavior. This was the only critical finding across 12 NFR assessments and led to a complete test rewrite. The NFR step is valuable specifically for high-integration stories where behavioral correctness matters.

### 5.5. Prettier Formatting Was the Most Common Regression Fix

Across all 12 stories, Prettier formatting violations were the most frequently fixed regression issue. The pattern: code review or security scan modifies a file, the modification is functionally correct but not Prettier-formatted, the regression lint step catches and fixes it. This is a tooling gap -- code review agents should run Prettier before committing.

---

## 6. Action Items for Epic 2

### 6.1. Must-Do (Blockers for Epic 2)

| # | Action | Owner | Story Affected |
|---|--------|-------|----------------|
| A1 | **Align SDK/core `HandlePacketResponse` types** -- eliminate the `as unknown as` double-cast in `create-node.ts` by either: (a) widening core's type to accept SDK metadata, or (b) creating a shared response type in `@crosstown/core` | Dev | 2-1 (Relay Handler) |
| A2 | **Set up genesis node in CI** -- Story 1-9's integration tests and all of Epic 2's E2E validation (Story 2-3) require a running genesis node. Document the Docker Compose-based CI setup | Dev | 2-3 (E2E Validation) |
| A3 | **Document TOON byte-manipulation testing pattern** -- add a comment in the SDK test utilities explaining that TOON signature testing must use hex-level corruption, not binary byte-flipping | Dev | All Epic 2 stories |

### 6.2. Should-Do (Quality Improvements)

| # | Action | Owner | Reason |
|---|--------|-------|--------|
| A4 | **Replace `console.error` with structured logger** -- the T00 error boundary and dev mode logging use `console.error`/`console.log`. Introduce a minimal structured logger (or accept `pino`/`consola` as a dependency) before Epic 2 adds more logging paths | Dev | Prevent log noise in production deployments |
| A5 | **Add `vitest --coverage` reporting** -- carried as an NFR CONCERN since Story 1-2. Epic 2 should establish coverage baselines before adding relay handler code | Dev | NFR-SDK-3 requires >80% line coverage |
| A6 | **Add dependency vulnerability scanning** -- `npm audit` or similar, flagged as a project-level gap in Story 1-9's NFR assessment | Dev | Security hygiene |
| A7 | **Auto-update test counts in story artifacts** -- reduce the recurring "stale test count" code review finding by either automating the count update or removing the count field from story templates | Process | Pipeline efficiency |

### 6.3. Nice-to-Have

| # | Action | Owner | Reason |
|---|--------|-------|--------|
| A8 | **Separate "create package scaffold" from first feature story** in future new-package epics | Process | Reduce infrastructure burden on Story N.1 |
| A9 | **Ensure code review agents run Prettier before committing** | Tooling | Eliminate the most common regression lint fix |

---

## 7. Epic 2 Preparation Tasks

Epic 2 (Nostr Relay Reference Implementation & SDK Validation) has 5 stories:

| Story | Title | Key SDK Features Exercised |
|-------|-------|---------------------------|
| 2-1 | Relay Event Storage Handler | `ctx.decode()`, EventStore, kind routing |
| 2-2 | SPSP Handshake Handler | `ctx.decode()`, NIP-44, `node.connector.registerPeer()`, channels |
| 2-3 | E2E Test Validation | Full pipeline end-to-end against genesis node |
| 2-4 | Remove git-proxy, Document Reference | Cleanup + documentation |
| 2-5 | Publish `@crosstown/town` | `startTown()` function, CLI, Docker image |

### Preparation Checklist

- [ ] **Resolve A1** (type alignment) before Story 2-1 starts -- the relay handler will exercise the full type chain
- [ ] **Resolve A2** (genesis node CI) before Story 2-3 starts -- E2E tests cannot run without infrastructure
- [ ] **Review existing relay BLS code** (`docker/src/entrypoint.ts`) to understand the ~300 lines that Story 2-1/2-2 will replace with SDK handlers
- [ ] **Review existing E2E tests** (`packages/client/tests/e2e/`) to understand what Story 2-3 must validate
- [ ] **Create ATDD stubs for `@crosstown/town`** package (Story 2-5) -- following the Epic 1 pattern of front-loading test stubs
- [ ] **Verify `packages/git-proxy/`** was already removed in Story 1-1 -- if so, Story 2-4 may be partially complete
- [ ] **Create Epic 2 test design document** (`_bmad-output/planning-artifacts/test-design-epic-2.md`) following the same risk-based format as Epic 1

### Key Risks for Epic 2

1. **E2E environment dependency** -- Stories 2-1 and 2-2 can be unit-tested with mocks, but Story 2-3 requires a full genesis node stack (Anvil + Faucet + Connector + Relay). If the Docker environment is flaky, E2E validation will be the bottleneck.
2. **SPSP complexity** -- Story 2-2 involves NIP-44 encryption, settlement negotiation, payment channel opening, and peer registration. This is the most complex handler and may need to be split if ACs exceed 8.
3. **Town package scope creep** -- Story 2-5 includes a CLI entrypoint and Docker image in addition to the library. Consider whether Docker image publishing belongs in a separate story.

---

## 8. Team Agreements

Based on Epic 1 learnings, the following agreements carry forward:

1. **ATDD stubs before epic start.** Continue the pattern of writing all test stubs and initial implementations in the ATDD red phase before the epic begins. This was the highest-ROI practice in Epic 1.

2. **Three-pass code review model.** Maintain the three-pass structure: Pass #1 (structural quality), Pass #2 (deeper analysis), Pass #3 (OWASP security). This model caught both code quality and security issues.

3. **Risk-based test design per epic.** Create a risk-scored test design document before the first story. The pipeline ordering risk (E1-R11, score 9) validated this approach by catching a critical test flaw.

4. **One commit per story.** Maintain the squashed-commit-per-story pattern for clean history and easy auditing.

5. **Security scan every story.** Semgrep + manual OWASP analysis caught 6 real security issues. Continue running scans even for "test-only" stories (Story 1-8's insecure URL was in test data).

6. **Regression tests are non-negotiable.** Every story runs a full monorepo regression. Zero regressions across 12 stories validates the cost.

7. **Traceability gate at story close.** 100% AC-to-test coverage was achieved for every story. Continue the automated traceability check as the final quality gate.

---

## 9. Timeline and Velocity

| Story | Duration (approx.) | Type |
|-------|-------------------|------|
| 1-0 | 90 min | Extraction + new code |
| 1-1 | 90 min | New package + implementation |
| 1-2 | 45 min | Enable ATDD tests (4 lines prod code) |
| 1-3 | 45 min | Enable ATDD tests (0 lines prod code) |
| 1-4 | 35 min | Enable ATDD tests (0 lines prod code) |
| 1-5 | 45 min | Enable ATDD tests (0 lines prod code) |
| 1-6 | 45 min | New implementation |
| 1-7 | 90 min | Major composition (largest story) |
| 1-8 | 45 min | Enable ATDD tests (0 lines prod code) |
| 1-9 | 55 min | New implementation + integration |
| 1-10 | 45 min | New implementation |
| 1-11 | 45 min | Verification + audit |

**Average story velocity:** ~55 minutes per story pipeline execution
**Total pipeline time:** ~11 hours (approximate)
**Fastest story:** 1-4 (35 min, enable-ATDD pattern)
**Slowest stories:** 1-0, 1-1, 1-7 (90 min each, greenfield or high-integration)

The "enable ATDD tests" pattern (Stories 1-2 through 1-5, 1-8) averaged 43 minutes -- roughly half the time of new-implementation stories. This confirms the ROI of front-loading ATDD stubs.

---

## 10. Conclusion

Epic 1 delivered a complete, well-tested, security-scanned SDK package with 100% acceptance criteria coverage, zero regressions, and npm-publish readiness. The ATDD red phase approach, risk-based test design, and three-pass code review model proved their value and should carry forward into Epic 2. Three action items are blockers for Epic 2 (type alignment, genesis node CI, TOON testing documentation), four are quality improvements, and two are process optimizations.

The `@crosstown/sdk` is ready for real-world validation in Epic 2, where it will be exercised by reimplementing the relay BLS as SDK handlers.
