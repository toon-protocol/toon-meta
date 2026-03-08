# Epic 2 Retrospective: Nostr Relay Reference Implementation, Protocol Stabilization & SDK Validation

**Date:** 2026-03-07 (final)
**Epic:** 2 -- Nostr Relay Reference Implementation, Protocol Stabilization & SDK Validation
**Package:** `@crosstown/town`, `@crosstown/sdk`, `@crosstown/core`
**Status:** Done (8/8 stories complete)
**Branch:** `epic-2`
**Commits:** 10 (1 epic start, 1 planning, 5 original story commits, 1 mid-epic retro, 2 scope-change story commits)
**Git range:** `e7827c2..1bcb9b4`
**Final test count:** 1,484 total (1,299 passed, 185 skipped, 0 failures)

---

## 1. Executive Summary

Epic 2 validated the SDK built in Epic 1 by reimplementing the Nostr relay as a set of SDK handlers in a new `@crosstown/town` package, then extended the SDK and protocol with three additional stories (2-6, 2-7, 2-8) that were pulled forward from Epic 3 during a mid-epic scope change.

The epic began with the relay rebuild: from ~300+ lines of monolithic `entrypoint.ts` wiring, the relay was rebuilt as composable SDK handlers. `createEventStorageHandler` is ~15 lines of logic, and the SDK pipeline handles all cross-cutting concerns (verification, pricing, self-write bypass) transparently. The epic culminated in a `startTown(config)` programmatic API, a CLI entrypoint (`npx @crosstown/town`), and an npm-publishable package.

The scope change added three stories: `publishEvent()` on `ServiceNode` (2-6), SPSP protocol removal and bootstrap simplification (2-7), and a relay subscription API on `TownInstance` (2-8). Story 2-7 was the most impactful of these -- it removed the entire SPSP handshake (kind:23194/23195), simplified peer discovery from 4 phases to 3, and cleaned 60+ stale references across the entire codebase. This protocol stabilization means Epic 3 can focus purely on production economics without carrying dead SPSP code.

All 8 stories shipped with 100% acceptance criteria coverage (40/40 ACs), ~193 story-specific tests, 61 code review issues found and fixed (converging to 0 on every final pass), 2 security fixes (CWE-209 error exposure, hex validation bypass), and zero test regressions. The monorepo test count grew from 1,353 passing at epic start to 1,299 passing at close (the decrease reflects intentional SPSP test deletion in Story 2-7, not regressions).

---

## 2. Delivery Metrics

| Metric | Value |
|--------|-------|
| Stories delivered | 8/8 (100%) |
| Acceptance criteria | 40 total, 40 covered (100%) |
| Story-specific tests | ~193 |
| New test files created | 13+ |
| Monorepo test count (start) | 1,353 passing / 86 skipped |
| Monorepo test count (end) | 1,299 passing / 185 skipped |
| Code review issues found | 61 total |
| Code review issues fixed | 61 |
| Code review issues remaining | 0 |
| Security scan findings | 2 real issues fixed (CWE-209, hex validation) |
| NFR assessments | 8 (4 PASS, 3 CONCERNS, 1 Conditional Pass) |
| Traceability gate | PASS (40/40 ACs, all priorities 100%) |
| Migrations | 0 |
| Files changed | 212 |
| Lines added/removed | +31,101 / -17,617 |

### Code Review Breakdown

| Severity | Found | Fixed | Remaining |
|----------|-------|-------|-----------|
| Critical | 0 | 0 | 0 |
| High | 2 | 2 | 0 |
| Medium | 14 | 14 | 0 |
| Low | 45 | 45 | 0 |

All 8 stories converged to 0 issues on their final code review pass.

### Code Review by Story

| Story | Pass #1 | Pass #2 | Pass #3 | Total |
|-------|---------|---------|---------|-------|
| 2-1 | 3 | 3 | 2 | 8 |
| 2-2 | 5 | 3 | 3 | 11 |
| 2-3 | 2 | 1 | 1 | 4 |
| 2-4 | 3 | 1 | 1 | 5 |
| 2-5 | 3 | 1 | 3 | 7 |
| 2-6 | 3 | 1 | 0 | 4 |
| 2-7 | 15 | 1 | 4 | 20 |
| 2-8 | 1 | 0 | 1 | 2 |

### Security Scan Breakdown

| Story | Finding | Fix |
|-------|---------|-----|
| 2-4 | CWE-209 error message exposure in `/handle-packet` 500 handler | Error message replaced with generic "Internal error" |
| 2-5 | `--secret-key` CLI flag accepted non-hex strings bypassing length check | Added hex regex validation before length check |
| 2-7 | CWE-209 info exposure in `entrypoint.ts` (found in Code Review #3) | Generic error message, full error logged server-side |
| 2-7 | `!body.amount` truthiness bug in `entrypoint.ts` and `entrypoint-town.ts` | Fixed with `=== undefined || === null` pattern |

Stories 2-1, 2-2, 2-3, 2-6, 2-8 had clean semgrep scans (0 true positives).

### NFR Summary

| Story | Rating | Detail |
|-------|--------|--------|
| 2-1 | PASS (20/20) | All applicable criteria met |
| 2-2 | CONCERNS | Handler strong (96.9% line coverage); project-level gaps (no CI, dep vulns) |
| 2-3 | CONCERNS (15/29) | 2 FAIL items: dep vulnerabilities, no automated rollback |
| 2-4 | PASS (29/29) | Documentation-only story, all criteria met |
| 2-5 | Conditional Pass | 14 PASS, 12 CONCERNS (by-design deferrals to Epic 3), 3 FAIL |
| 2-6 | PASS (20/20) | All applicable criteria met |
| 2-7 | PASS | Removal reduces attack surface, eliminates network round-trips |
| 2-8 | CONCERNS | Story implementation quality high; project-wide infrastructure gaps (no vuln scanning, no load testing) |

---

## 3. Successes

### 3.1. SDK Proved Its Abstraction Value

The central hypothesis of Epic 2 was that the SDK from Epic 1 could completely replace the monolithic relay wiring. This was proven decisively: `createEventStorageHandler` is ~15 lines of handler logic (decode -> store -> accept). The SDK pipeline handles all cross-cutting concerns (verification, pricing, self-write bypass) transparently. Story 2-3 reduced the Docker entrypoint from ~300+ lines of manual packet handling to ~73 lines of SDK pipeline composition.

### 3.2. Mid-Epic Scope Change Was Well-Managed

Epic 2 expanded from 5 stories to 8 via a deliberate scope change that pulled Stories 3.7 and 3.8 from Epic 3. The rationale was sound: these stories modified the SDK's public surface (removing SPSP exports, adding `publishEvent()` and `subscribe()` APIs), and shipping the SDK with dead SPSP code that would be immediately removed in the next epic was wasteful. The scope change was documented in a formal addendum to the mid-epic retro, the sprint-status was updated, and the additional stories integrated cleanly into the existing pipeline. This demonstrates the process can handle mid-flight adjustments without sacrificing quality.

### 3.3. Story 2-7 Eliminated Significant Protocol Debt

Story 2-7 (SPSP Removal) was the single most impactful cleanup story in the project's history. It deleted the entire `packages/core/src/spsp/` directory, removed SPSP handlers from SDK and Town, simplified bootstrap from 4 phases to 3, fixed the long-standing `!body.amount` truthiness bug (A1 from the mid-epic retro), and cleaned 60+ stale references across comments, tests, JSDoc, env files, and project metadata. The protocol is now simpler, more secure (fewer network round-trips, smaller attack surface), and better aligned with the self-describing BTP claims architecture.

### 3.4. Epic 1 Retro Actions Were Resolved at Epic Start

Three critical action items from Epic 1 were resolved in the epic start commit (`6e8bfbd`):
- **A1** (type alignment): Widened core `HandlePacketAcceptResponse` metadata types, eliminated 3 unsafe `as unknown as` casts
- **A3** (TOON byte testing pattern): Created documentation in `toon-byte-testing-pattern.md`
- **A5** (coverage tooling): Installed `@vitest/coverage-v8`, coverage now generates text/JSON/HTML reports

This front-loading prevented these issues from blocking story development.

### 3.5. Clean Commit History Maintained

The 1-commit-per-story convention from Epic 1 continued. Ten commits map cleanly to the epic lifecycle:
1. `6e8bfbd` -- epic start (retro actions, baseline green)
2. `23f8e32` -- planning (test designs, stale docs cleanup)
3. `bed43c9` -- Story 2-1 (event storage handler)
4. `8fc7157` -- Story 2-2 (SPSP handshake handler)
5. `fb4e4fb` -- Story 2-3 (E2E test validation)
6. `7205a13` -- Story 2-4 (git-proxy cleanup, reference docs)
7. `9dc7574` -- Story 2-5 (startTown(), CLI, publish readiness)
8. `26956e4` -- mid-epic retro (scope change documented)
9. `ce161ef` -- Story 2-6 (publishEvent() on ServiceNode)
10. `1bcb9b4` -- Story 2-7 (SPSP removal, protocol stabilization) + Story 2-8 (subscribe API)

Note: Stories 2-7 and 2-8 share a commit due to their tightly coupled implementation (SPSP removal cascaded into subscription API changes).

### 3.6. Three-Pass Code Review Model Continued to Catch Different Issue Classes

Across all 8 stories, the three-pass model demonstrated clear value:
- **Pass #1** caught structural issues: duplicate imports, type aliases, JSDoc gaps, stale SPSP references (15 in Story 2-7 alone)
- **Pass #2** caught deeper logic issues: SPSP pricing fallback, `parseInt` NaN validation, erroneous `ilpAddress` in SettlementConfig, non-null assertions for `noUncheckedIndexedAccess`
- **Pass #3** caught security issues: CWE-209 info exposure, `!body.amount` truthiness bug, uncaught `JSON.parse`, URL scheme validation

Story 2-7's Pass #3 found 4 issues including the CWE-209 fix and the truthiness bug -- resolving Epic 2 retro action item A1 in the process.

### 3.7. Zero Regressions Across All 8 Stories

No story introduced a regression. Every regression test step passed on first attempt. The test count decreased from 1,353 to 1,299 passing, but this reflects intentional SPSP test deletion (Story 2-7 removed ~144 SPSP-specific tests and added 25 verification tests). No test that should pass was broken.

### 3.8. Security Scanning Found Real Issues

Semgrep scans across 8 stories found 2 genuine security issues plus 2 additional security-relevant fixes caught by code review Pass #3:
- CWE-209 error message exposure leaking internal error details to HTTP responses (Story 2-4)
- Hex validation bypass allowing non-hex strings through the `--secret-key` CLI flag (Story 2-5)
- CWE-209 info exposure in `docker/src/entrypoint.ts` (Story 2-7, Code Review #3)
- `!body.amount` truthiness bug causing amount=0 rejection (Story 2-7, Code Review #3)

All were fixed before the story closed. False positives (ws:// protocol checks in test fixtures and validation code) were properly managed.

---

## 4. Challenges

### 4.1. Story 2-5 and 2-7 Were Disproportionately Large

Story 2-5 (`startTown()`, CLI, npm publish) took approximately 3 hours, and Story 2-7 (SPSP removal) took approximately 3.5 hours -- both roughly 3x the average for the other stories. Story 2-5's size was driven by the combination of programmatic API + CLI + packaging + subprocess testing. Story 2-7's size was driven by the breadth of SPSP references across every package (60+ stale references in comments, tests, JSDoc, env files, and metadata). Both were appropriately scoped for their respective concerns but confirm that protocol-level changes and capstone stories should budget extra time.

### 4.2. SPSP Removal Cascaded Across Every Package

Story 2-7 touched 30+ files across 8 packages because SPSP references had permeated comments, test data (kind:23194 used as test fixtures), JSDoc, env files, package keywords, and even pricing test examples. Code Review Pass #1 alone found 15 stale references in `project-context.md` and `MEMORY.md`. The lesson: when a protocol concept is removed, the cleanup scope extends far beyond the implementation files.

### 4.3. Stories 2-7 and 2-8 Shared a Commit

Due to implementation coupling (SPSP removal in 2-7 cascaded into subscription API changes in 2-8), both stories were committed together. This breaks the 1-commit-per-story convention and makes per-story bisecting harder. The coupling was technically justified (shared build fixes for SPSP removal) but should be avoided in future by ensuring stories in the same epic don't have implementation-level dependencies that force joint commits.

### 4.4. NFR Scores Continue to Reflect Project-Level Gaps

Four of 8 NFR assessments received ratings below PASS (3 CONCERNS, 1 Conditional Pass), but in every case the handler-level quality was strong. The downgrades were driven by the same recurring project-level gaps:
- 33 transitive dependency vulnerabilities (upstream `fast-xml-parser` via AWS SDK)
- No CI pipeline for automated enforcement
- No automated rollback mechanism
- CLI secret exposure in process listings
- No load testing or vulnerability scanning baseline

These are legitimate concerns but should be tracked as project-level action items rather than story-level blockers.

### 4.5. Story 2-2 Was Built and Then Removed

Story 2-2 (SPSP Handshake Handler) was fully implemented, tested, and code-reviewed -- then Story 2-7 deleted all of its production code. The ~160-line SPSP handler, its 16 tests, and all supporting SPSP infrastructure were removed. While this is the correct outcome (the protocol decision to remove SPSP was made after Story 2-2 shipped), it represents ~90 minutes of pipeline time producing throwaway code. The lesson: if a protocol-level architectural decision is under active discussion, defer implementing the component until the decision is final.

### 4.6. E2E Tests Still Require Deployed Infrastructure

All 8 stories' E2E steps were either skipped or marked as backend-only. The genesis node CI action item from Epic 1 (A2) remains unresolved after two full epics. Epic 3's production economics stories (USDC migration, x402 publish, multi-chain config) will have heavier E2E requirements, making A2 increasingly urgent.

---

## 5. Key Insights

### 5.1. Handler Composition Pattern Is the SDK's Core Value

The most important insight from Epic 2 is that the SDK's value is not in any single feature but in the composition pattern: `createNode()` wires identity + verification + pricing + handlers + connector into a running node with ~10 lines. The `startTown()` function demonstrates this: 14 composition steps that would be ~300+ lines of manual wiring are reduced to a function call with a config object. This pattern should be preserved and documented for future package authors (Epic 5's `@crosstown/rig`).

### 5.2. Protocol Simplification Pays Compound Interest

Story 2-7's SPSP removal simplified not just the code but the mental model: 4 bootstrap phases became 3, settlement negotiation moved from a complex NIP-44 encrypted handshake to a simple kind:10032 data lookup, and channel opening became unilateral. This simplification will compound in Epic 3: the x402 integration (Story 3-3) no longer needs to account for SPSP interactions, seed relay discovery (Story 3-4) has a simpler peer registration flow, and the enriched health endpoint (Story 3-6) has fewer states to report. Removing complexity early is more valuable than removing it later.

### 5.3. publishEvent() Completes the SDK's Write Path

Story 2-6's `publishEvent(event, options)` method on `ServiceNode` closes a significant gap: before this story, the SDK could receive and process events but had no API for sending them. The method handles TOON encoding, per-byte pricing computation, base64 conversion, and ILP packet dispatch -- all in one call. This symmetric read/write capability makes the SDK viable for peer-to-peer scenarios and will be essential for Epic 3's service discovery (publishing kind:10035/10036 events).

### 5.4. Two-Approach Testing (Unit + Pipeline) Continued to Scale

The handler testing pattern from Story 2-1 (Approach A: unit tests with `createTestContext`, Approach B: pipeline integration with `createNode().start()`) extended naturally to Stories 2-6, 2-7, and 2-8. Story 2-7 added a third approach: static verification tests that grep source files for removed patterns. This "verification by absence" pattern is uniquely suited to removal stories and should be reused whenever protocol concepts are deprecated.

### 5.5. Static Analysis Tests Are Increasingly Important

Story 2-7's `spsp-removal-verification.test.ts` (25 tests, 853 lines) established a pattern of testing structural properties by scanning source files for forbidden patterns. Combined with Story 2-3's entrypoint validation tests and Story 2-5's package structure tests, the project now has a robust suite of static analysis tests that catch architectural drift without running production code. These tests are fast, deterministic, and resilient to refactoring.

### 5.6. Mid-Epic Scope Changes Work When Process Is Followed

Epic 2 expanded from 5 to 8 stories without sacrificing quality: all 8 stories achieved 100% AC coverage, all code review cycles converged to 0 issues, and the traceability gate passed for every story. The key enablers were: (1) the scope change was documented in a formal retro addendum, (2) sprint-status was updated with clear annotations, (3) each added story followed the same full pipeline (create -> validate -> ATDD -> develop -> review -> security -> regression -> trace), and (4) the rationale for each story's inclusion was recorded.

---

## 6. Action Items for Epic 3

### 6.1. Must-Do (Blockers for Epic 3)

| # | Action | Owner | Status | Story Affected |
|---|--------|-------|--------|----------------|
| A1 | ~~Fix `!body.amount` truthiness bug in `entrypoint-town.ts`~~ | Dev | **DONE** (Story 2-7) | Resolved |
| A2 | **Set up genesis node in CI** (carried from Epic 1 A2) -- E2E tests across 8 stories were never run in the pipeline. Epic 3 stories (USDC migration, x402 publish, service discovery) will have heavier E2E requirements. | Dev | OPEN | 3-1, 3-3, 3-5 |
| A3 | **Publish `@crosstown/town` to npm** -- package is build-ready and tested but manual `npm publish --access public` has not been executed. Must happen before Epic 3 stories that reference the published package. | Dev | OPEN | Pre-epic |

### 6.2. Should-Do (Quality Improvements)

| # | Action | Owner | Status | Reason |
|---|--------|-------|--------|--------|
| A4 | **Clean up stale git-proxy and SPSP references in root-level docs** -- Story 2-4 cleaned `docs/` directory, Story 2-7 cleaned source code. References may remain in README.md, SECURITY.md, ARCHITECTURE.md, SETUP-GUIDE.md, DOCUMENTATION-INDEX.md. | Dev | OPEN | Documentation accuracy |
| A5 | **Address transitive dependency vulnerabilities** -- 33 findings (2 critical, 12 high) from `fast-xml-parser` via `@agent-society/connector` -> AWS SDK. Recurring NFR CONCERN across all 8 stories. Consider pinning or patching. | Dev | OPEN | Security hygiene (NFR recurring FAIL) |
| A6 | **Replace `console.error` with structured logger** (carried from Epic 1 A4) -- Epic 3's enriched health endpoint (Story 3-6) is a natural place to introduce structured logging. | Dev | OPEN | Production observability |
| A7 | **Lint-check ATDD stubs immediately after creation** -- Story 2-2 inherited 53 ESLint errors from RED-phase test stubs. Future ATDD red phases should run `pnpm lint` before committing stubs. | Process | OPEN | Prevent deferred lint debt |
| A8 | **Address CLI `--mnemonic`/`--secret-key` process listing exposure** -- NFR FAIL item from Story 2-5. CLI flags expose secrets in `ps` output. Document env var alternatives prominently. Consider deprecating CLI flags in favor of env vars. | Dev | OPEN | Security (CWE-214) |

### 6.3. Nice-to-Have

| # | Action | Owner | Reason |
|---|--------|-------|--------|
| A9 | **Consider splitting capstone and protocol-change stories** -- Stories 2-5 and 2-7 were both 3x+ the average pipeline duration. Budget accordingly or split. | Process | Pipeline efficiency |
| A10 | **Add automated test count validation** -- test count discrepancies appeared in multiple story artifacts. Automate the count in CI or remove the field from story templates. | Process | Reduce recurring low-severity code review findings |
| A11 | **Ensure code review agents run Prettier before committing** (carried from Epic 1 A9) | Tooling | Eliminate recurring lint-format regression fixes |
| A12 | **Clean up `docker/src/entrypoint.ts` legacy entrypoint** -- Contains SPSP stub declarations and is excluded from build. Should be fully updated or deleted. | Dev | Code hygiene |
| A13 | **Add E2E test for `town.subscribe()`** -- No E2E test exercises `subscribe()` against a live relay. Future peer discovery stories should validate integration. | Dev | Test coverage |

---

## 7. Epic 3 Preparation Tasks

Epic 3 (Production Protocol Economics) has 6 stories:

| Story | Title | Key Features |
|-------|-------|-------------|
| 3-1 | USDC Token Migration | Multi-token support, USDC contract deployment |
| 3-2 | Multi-Environment Chain Configuration | Chain config for mainnet/testnet/devnet |
| 3-3 | x402 Publish Endpoint | HTTP-based publish with x402 payment protocol |
| 3-4 | Seed Relay Discovery | Decentralized relay discovery from seed nodes |
| 3-5 | Kind 10035 Service Discovery Events | NIP-compliant service discovery |
| 3-6 | Enriched Health Endpoint | Detailed health/status reporting |

### Preparation Checklist

- [x] **Resolve A1** (entrypoint-town.ts truthiness bug) -- fixed in Story 2-7
- [ ] **Resolve A3** (npm publish) -- `cd packages/town && pnpm build && npm publish --access public`
- [ ] **Plan A2** (CI genesis node) -- needed before Story 3-1's E2E tests. Document Docker Compose-based CI setup.
- [ ] **Review existing chain configuration** (`packages/core/src/chain/`) -- Story 3-2 will extend this
- [ ] **Review existing USDC migration code** (`packages/core/src/chain/usdc-migration.test.ts`) -- Story 3-1 has RED-phase stubs
- [ ] **Create ATDD stubs for Epic 3 stories** -- following the validated pattern of front-loading test stubs
- [ ] **Create Epic 3 test design document** -- risk-based format, identify settlement negotiation and multi-token risks
- [ ] **Lint-check all ATDD stubs** (per A7) -- ensure no ESLint debt carries into story development
- [ ] **Review `publishEvent()` API** -- Story 3-5 (service discovery) will use this to publish kind:10035/10036 events
- [ ] **Review `subscribe()` API** -- Story 3-4 (seed relay discovery) will use this to subscribe to seed relays

### Key Risks for Epic 3

1. **USDC contract integration** -- Story 3-1 requires deploying a USDC token contract on Anvil and updating the TokenNetworkRegistry. This is more complex than the AGENT token (deterministic addresses may change).
2. **x402 payment protocol** -- Story 3-3 introduces a new payment protocol that must interoperate with ILP. With SPSP removed (Story 2-7), the x402 integration is cleaner, but the packet construction and routing still requires careful design.
3. **Multi-chain configuration** -- Story 3-2 must support mainnet, testnet, and devnet simultaneously. Configuration errors could cause fund loss on mainnet.
4. **CI dependency** -- Without CI (deferred since Epic 1), Epic 3's more complex E2E scenarios increase the risk of untested integration paths. A2 is increasingly urgent after 2 full epics.
5. **subscribe() API maturity** -- Story 3-4 (seed relay discovery) will be the first production consumer of `town.subscribe()`. If the API surface needs changes, they should be identified during the ATDD phase.

---

## 8. Team Agreements

Based on Epic 2 learnings (all 8 stories), the following agreements carry forward:

1. **ATDD stubs before epic start, lint-checked immediately.** The Epic 1 pattern of front-loading test stubs continues to pay off. New for Epic 2: stubs must pass `pnpm lint` before committing to avoid the 53-error cleanup that hit Story 2-2.

2. **Three-pass code review model.** Maintained and validated across 8 stories. Pass #1 (structural), Pass #2 (deeper analysis), Pass #3 (OWASP security). Pass #3 caught high-severity issues in Stories 2-5 (truthiness bug) and 2-7 (CWE-209, JSON.parse, truthiness bug) that Passes #1 and #2 missed.

3. **Two-approach handler testing.** Approach A (unit with `createTestContext`) and Approach B (pipeline integration with `createNode().start()`). Extended in Story 2-7 with a third approach: "verification by absence" static tests for removal stories.

4. **Static analysis tests for structural properties.** Tests that read source files and assert structural invariants (line counts, export shapes, Dockerfile commands, forbidden patterns). Expanded in Story 2-7 to include codebase-wide grep verification for removed protocol concepts.

5. **One commit per story (with documented exceptions).** Maintained for 7 of 8 stories. Stories 2-7 and 2-8 shared a commit due to implementation coupling. When exceptions occur, document the rationale.

6. **Security scan every story.** Maintained across all 8 stories. Found 2 real issues via semgrep plus 2 additional security fixes via code review Pass #3. False positives are handled with `nosemgrep` annotations.

7. **Regression tests are non-negotiable.** Zero regressions across 8 stories. Every regression step passed on first attempt.

8. **Traceability gate at story close.** 100% AC-to-test coverage maintained for all 8 stories (40/40 ACs).

9. **Resolve retro action items at epic start.** Epic 2 resolved 3 of 9 action items from Epic 1 in the epic start commit. A1 from the mid-epic retro was resolved by Story 2-7. Repeat for Epic 3.

10. **Defer protocol decisions until confirmed.** New for Epic 2: Story 2-2 (SPSP handler) was fully implemented then deleted by Story 2-7 (SPSP removal). When protocol-level architectural decisions are under discussion, defer the implementation until the decision is final to avoid throwaway work.

---

## 9. Timeline and Velocity

| Story | Duration (approx.) | Type |
|-------|-------------------|------|
| Epic start | 30 min | Retro actions + baseline |
| Planning | 20 min | Test designs + stale doc cleanup |
| 2-1 | 90 min | New package + handler implementation |
| 2-2 | 90 min | Handler implementation (SPSP -- later removed) |
| 2-3 | 90 min | Docker entrypoint + E2E test framework |
| 2-4 | 90 min | Documentation cleanup + reference implementation |
| 2-5 | 180 min | Capstone: API + CLI + packaging (largest story) |
| Mid-epic retro | 30 min | Scope change documentation |
| 2-6 | 90 min | publishEvent() API on ServiceNode |
| 2-7 | 210 min | SPSP removal + protocol stabilization (most impactful) |
| 2-8 | 90 min | Relay subscription API on TownInstance |

**Average story velocity:** ~116 minutes per story pipeline execution
**Total pipeline time:** ~13 hours (approximate)
**Fastest stories:** 2-1, 2-2, 2-3, 2-4, 2-6, 2-8 (90 min each)
**Slowest stories:** 2-7 (210 min, protocol removal across all packages), 2-5 (180 min, capstone with CLI + packaging)

Compared to Epic 1 (55 min average, 12 stories), Epic 2 stories were ~2x longer per story but delivered proportionally more complex functionality. The two outliers (2-5 and 2-7) were justified by their scope: 2-5 was the epic capstone with CLI/API/packaging, and 2-7 was a protocol-level removal touching every package in the monorepo.

---

## 10. Comparison with Epic 1

| Metric | Epic 1 | Epic 2 (Final) | Trend |
|--------|--------|----------------|-------|
| Stories | 12 | 8 | Fewer, larger stories |
| ACs | 75 | 40 | Proportional to story count |
| AC coverage | 100% | 100% | Maintained |
| Story-specific tests | ~268 | ~193 | Proportional to story count |
| Code review issues | 49 found | 61 found | Higher (protocol removal = broad surface) |
| Issues remaining | 3 (accepted) | 0 | Improved |
| Security scan findings | 6 | 2 + 2 code-review | Similar real-issue rate |
| NFR pass rate | 12/12 PASS | 4/8 PASS | Project-level gaps more visible |
| Test regressions | 0 | 0 | Maintained |
| Avg story duration | 55 min | 116 min | Larger scope per story |

Key differences:
- Epic 1 had many "enable ATDD tests" stories (~43 min each) that lowered the average. Epic 2 had no such stories -- every story required significant implementation.
- Epic 2's code review issue count (61) was higher than Epic 1's (49) despite having fewer stories, driven primarily by Story 2-7's 20 issues (15 stale SPSP references found in Pass #1 alone).
- Epic 2's NFR scores were lower due to project-level gaps (CI, dep vulns) becoming more visible as the codebase grew. Handler-level quality was consistently strong.
- Zero accepted code review issues in Epic 2 (vs. 3 in Epic 1) -- all 61 findings were addressed.
- Epic 2 included a mid-epic scope change (5 -> 8 stories) that was managed successfully without quality regression.

---

## 11. Conclusion

Epic 2 delivered a complete, tested, npm-publish-ready `@crosstown/town` package that validates the SDK from Epic 1, extended the SDK with `publishEvent()` and `subscribe()` APIs, and stabilized the protocol by removing SPSP. The central thesis -- that a relay can be built from composable SDK handlers in ~10 lines of composition -- was proven. The `startTown(config)` API, CLI entrypoint, and reference implementation Docker entrypoint provide three entry points for relay deployment.

The scope change from 5 to 8 stories was well-managed: all 8 stories achieved 100% AC coverage (40/40), 61 code review issues were found and fixed (0 remaining), and zero test regressions occurred. Story 2-7's SPSP removal was the most impactful individual story in the project's history, simplifying the protocol and eliminating significant technical debt.

Two action items remain as blockers for Epic 3 (npm publish, CI planning). One blocker (A1, truthiness bug) was resolved by Story 2-7. Five items are quality improvements (stale docs, dep vulns, structured logger, ATDD lint, CLI secret exposure). Five are nice-to-haves (story splitting, test count automation, Prettier in review, legacy entrypoint cleanup, subscribe E2E test).

The SDK + Town architecture is validated, the protocol is stabilized, and the project is ready for production economics (Epic 3) and application-layer development (Epic 5).
