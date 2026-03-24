# Epic 8 Retrospective: The Rig -- Arweave DVM + Forge-UI

**Date:** 2026-03-24
**Epic:** 8 -- The Rig: Arweave DVM + Forge-UI
**Packages:** `@toon-protocol/core`, `@toon-protocol/sdk`, `packages/rig` (new)
**Status:** Done (8/8 stories complete)
**Branch:** `epic-8`
**Final test count:** 3,256 total (3,191 passed, 65 skipped, 0 failures)

---

## 1. Executive Summary

Epic 8 delivered the first external storage integration (Arweave DVM) and the first browser-targeted deliverable (Forge-UI) in the TOON Protocol project. The epic produced 8 stories across two domains: a kind:5094 blob storage DVM provider with chunked upload support (Story 8-0), and a full-featured Forgejo-inspired source browser SPA covering repository lists, file trees, blob views, commit logs, diffs, blame, issues, and pull requests (Stories 8-1 through 8-5), validated by comprehensive E2E testing (Story 8-6) and deployable to Arweave via a CLI pipeline (Story 8-7).

The most technically significant deliverable is **Story 8-0's Arweave DVM Provider**, which establishes the first network primitive outside the relay-write pattern. The kind:5094 handler accepts ILP-prepaid uploads, stores data on Arweave via the ArDrive Turbo SDK behind an adapter interface, and supports chunked uploads for blobs exceeding 512KB. The adapter interface isolates the 31 known vulnerabilities in `@ardrive/turbo-sdk`'s dependency tree.

The most architecturally significant deliverable is **the Forge-UI SPA** (Stories 8-1 through 8-5), which proves that TOON protocol data (NIP-34 events on relays + git objects on Arweave) can power a full source browser without any server-side code. The vanilla TypeScript + Vite stack produces an 18.2K JS + 2.5K CSS bundle suitable for permanent Arweave hosting -- establishing the pattern for all future TOON web applications.

The most operationally significant deliverable is **Story 8-6's E2E validation gate**, which was added mid-epic (2026-03-23) after integration testing revealed 6 bugs (repoId routing, CSP headers, AR.IO gateway priority, URL-encoded ref decoding, SHA-to-txId cache seeding, binary tree format). All 6 were fixed and validated with 82+ new tests, establishing the principle that immutable Arweave deployments require pre-deployment validation gates.

Two critical tech debt items from the Epic 7 retro were resolved at epic start: BootstrapService.republish() was implemented with 3 new tests, and E2E test debt was triaged from 31 claimed items down to 6 real items.

---

## 2. Delivery Metrics

| Metric | Value |
|--------|-------|
| Stories delivered | 8/8 (100%) |
| Acceptance criteria | 128 total (124 automated, 4 manual) |
| AC coverage | 100% (all 128 covered) |
| Monorepo test count (start) | 2,741 (2,662 passed, 79 skipped) |
| Monorepo test count (end) | 3,256 (3,191 passed, 65 skipped) |
| Net test count growth | +515 tests (+529 passed, -14 skipped delta) |
| Code review passes | 24 total (3 per story) |
| Code review issues found | 96 total |
| Code review issues fixed | 82 |
| Code review issues accepted/noted | 14 (all MVP trade-offs) |
| Code review unresolved | 0 |
| Semgrep real findings (fixed) | 7 (CWE-20, CWE-113, CWE-209, command injection x2, insecure WebSocket, unbounded parsing) |
| Semgrep false positives suppressed | ~14 |
| NFR assessments | 8/8 PASS |
| Traceability gate | PASS (P0: 100%, P1: 100%, Overall: 96.9%) |
| Migrations | 0 |
| New runtime dependencies | 1 (`@ardrive/turbo-sdk` in packages/sdk) |
| New packages | 1 (`packages/rig`) |
| Frontend polish passes | 2 (Stories 8-5, 8-6) |
| Wall-clock time | ~12.5 hours estimated total pipeline time |

### Code Review Breakdown

| Severity | Found | Fixed | Accepted | Remaining |
|----------|-------|-------|----------|-----------|
| Critical | 0 | 0 | 0 | 0 |
| High | 12 | 12 | 0 | 0 |
| Medium | 38 | 32 | 6 | 0 |
| Low | 46 | 38 | 8 | 0 |
| **Total** | **96** | **82** | **14** | **0** |

### Code Review by Story

| Story | Pass #1 | Pass #2 | Pass #3 | Total | Accepted |
|-------|---------|---------|---------|-------|----------|
| 8-0 | 3 (0C/1H/1M/1L) | 4 (0C/0H/2M/2L) | 4 (0C/0H/2M/2L) | 11 | 2 |
| 8-1 | 7 (0C/1H/3M/3L) | 8 (0C/1H/3M/4L) | 7 (0C/1H/2M/4L) | 22 | 7 |
| 8-2 | 9 (0C/3H/4M/2L) | 4 (0C/0H/2M/2L) | 5 (0C/1H/2M/2L) | 18 | 0 |
| 8-3 | 0 | 1 (0C/0H/0M/1L) | 1 (0C/0H/1M/0L) | 2 | 0 |
| 8-4 | 3 (0C/0H/2M/1L) | 3 (0C/0H/0M/3L) | 1 (0C/0H/0M/1L) | 7 | 1 |
| 8-5 | 4 (0C/0H/1M/3L) | 2 (0C/0H/1M/1L) | 0 | 6 | 2 |
| 8-6 | 4 (0C/0H/2M/2L) | 4 (0C/0H/2M/2L) | 4 (0C/0H/2M/2L) | 12 | 1 |
| 8-7 | 6 (0C/1H/2M/3L) | 3 (0C/0H/2M/1L) | 1 (0C/0H/0M/1L) | 10 | 2 (noted) |

### Test Count Progression

| Story | Post-Dev | Regression | Delta |
|-------|----------|------------|-------|
| 8-0 | 2,774 | 2,794 | +20 |
| 8-1 | 2,768 | 2,818 | +50 |
| 8-2 | 2,862 | 2,942 | +80 |
| 8-3 | 2,975 | 3,002 | +27 |
| 8-4 | ~2,659 | 3,026 | +367 |
| 8-5 | 3,120 | 3,228 | +108 |
| 8-6 | 3,081 | 3,084 | +3 |
| 8-7 | 3,236 | 3,256 | +20 |

---

## 3. Successes

### 3.1. Two Critical Epic 7 Retro Actions Resolved at Epic Start

The Epic 8 start pipeline resolved both critical action items from Epic 7: BootstrapService.republish() was implemented with 3 new tests (A2), and E2E test debt was triaged from 31 claimed items to 6 real items (A1). This breaks the regression pattern from Epic 7 where 0% of critical items were resolved.

### 3.2. First Browser-Targeted Deliverable -- From Zero to Full SPA in 5 Stories

The project had zero frontend code before Epic 8. Stories 8-1 through 8-5 established the complete web development stack (Vite + vanilla TypeScript, jsdom unit testing, Playwright E2E, CSS styling) and delivered a full-featured source browser with repository lists, file trees, blob views, commit logs, diffs, blame, issues, and pull requests. The 18.2K JS + 2.5K CSS bundle size demonstrates that framework-free vanilla TypeScript can deliver a complex SPA within Arweave-friendly size constraints.

### 3.3. Security Posture Significantly Strengthened

7 real security vulnerabilities were discovered and fixed via semgrep scanning across the epic:
- CWE-20 (input validation) -- uploadId validation in Arweave DVM handler
- CWE-113 (header injection) -- Content-Type sanitization
- CWE-209 (error exposure) -- error message sanitization
- Command injection x2 -- seed script hardened with `execFileSync`, `sqliteEscape()`, `isHexString()`
- Insecure WebSocket -- default changed from `ws://` to `wss://`
- Unbounded parsing -- MAX_REFS_PER_EVENT cap added

This is the highest semgrep finding count in any epic (surpassing Epic 1's 6 findings), reflecting the expanded attack surface of browser-facing code and external script tooling.

### 3.4. Story 8-3 Achieved Cleanest Code Reviews in Epic

Story 8-3 (Commit Log and Diff View) had only 2 code review issues across all 3 passes (1 low, 1 medium), both fixed. Pass #1 was completely clean. This is notable given the story's algorithmic complexity (LCS-based unified diff, tree-to-tree diff, commit chain walking).

### 3.5. Zero Critical Code Review Issues Across 24 Passes

Continuing the trend from Epic 7, Epic 8 had zero critical code review findings across all 24 review passes. The 12 high-severity issues found were all resolved, with no residual risk. This is the 2nd consecutive epic with zero critical issues.

### 3.6. Mid-Epic Course Correction (Story 8-6 Addition)

Story 8-6 was added mid-epic (2026-03-23) after integration testing revealed 6 bugs that would have been deployed permanently to Arweave. The decision to add a validation gate before immutable deployment was operationally sound -- 6 real bugs were caught and fixed, and 82+ new tests were added. This demonstrates disciplined quality gates even under the pressure of completing an epic.

### 3.7. Frontend Polish Applied Systematically

Stories 8-5 and 8-6 both received frontend polish passes -- the first such passes in the project. Story 8-5 received 8 improvements (hover transitions, alignment, padding, responsive breakpoints, loading states). Story 8-6 added sticky header, hover transitions, color tokens, SVG favicon, and accessibility focus outlines. This establishes frontend polish as a standard pipeline step for UI-facing stories.

### 3.8. ATDD-Implements-Together Pattern Continues

In Stories 8-2, 8-3, 8-4, and 8-5, implementation was substantially completed during the ATDD step, with the develop step serving as verification only. This pattern (established in Epic 6, continued in Epic 7) is now the dominant development mode for the project.

---

## 4. Challenges

### 4.1. Playwright E2E Tests Written But Not Executed Against Live Infrastructure

Story 8-6 created 7 Playwright E2E specs covering all Forge-UI views, but these tests have not been executed against live infrastructure. The tests were validated through 3 code review passes for selector correctness and test logic, but runtime execution requires the SDK E2E infra with seeded Arweave data. This is the most significant gap in the epic's validation.

### 4.2. Four Manual ACs Pending First Arweave Deployment

Story 8-7 has 4 acceptance criteria (AC9: gateway accessibility, AC10: SPA routing fallback, AC11: relay configuration, AC13: dogfooding verification) that require a live Arweave deployment. These are appropriately designated as manual ACs but represent untested deployment behavior.

### 4.3. Arweave DVM E2E Stubs Pending Docker Infra Update

Story 8-0's E2E tests (`docker-arweave-dvm-e2e.test.ts`) are stubs pending Docker infrastructure updates to include the Arweave DVM handler in peer configurations. This means the full upload-store-retrieve cycle has not been validated end-to-end in a Docker environment.

### 4.4. packages/rig Excluded from ESLint

Story 8-1 excluded `packages/rig/` from the ESLint configuration. While understandable during initial development to avoid friction, this means the new web package has no static analysis enforcement. The rig package now has 2,000+ lines of TypeScript without lint coverage.

### 4.5. Code Review Issue Count Increased

With 96 total issues across 24 passes (4.0 per pass), Epic 8 had a higher absolute issue count than Epic 7 (28 issues across 18 passes, 1.6 per pass). This is expected given the introduction of browser-facing code (new domain, new security concerns, new patterns), but the higher density in Stories 8-1 (22 issues) and 8-2 (18 issues) suggests that first-in-domain stories require more review attention.

### 4.6. Simplified Blame Algorithm Accepted as MVP

Story 8-4's blame algorithm uses set-based line matching rather than full Myers diff, which can misattribute duplicate lines (blank lines, closing braces). This was accepted as an MVP trade-off but is a known correctness limitation.

---

## 5. Key Insights

### 5.1. Immutable Deployments Require Pre-Deployment Validation Gates

The mid-epic addition of Story 8-6 is the most important process learning from Epic 8. Unlike Docker deployments that can be restarted or updated, Arweave uploads are permanent. The 6 bugs discovered during integration testing (repoId routing, CSP, gateway priority, URL encoding, cache seeding, binary format) would have been permanently deployed without the validation gate. **Any future deployment to immutable storage must include a validation story.**

### 5.2. Vanilla TypeScript + Vite is a Viable Stack for Protocol Web Apps

The decision to use vanilla TypeScript without a framework (React, Vue, Svelte) produced a 18.2K JS + 2.5K CSS bundle -- small enough for Arweave hosting at negligible cost. The template-rendering pattern (`renderXYZ()` functions returning HTML strings) proved sufficient for a read-only source browser. This stack should be evaluated for future TOON web applications, with the caveat that interactive applications with state management may benefit from a lightweight framework.

### 5.3. Browser Security Requires Different Patterns Than Backend

Epic 8 introduced XSS prevention as a recurring concern across all UI stories (8-1 through 8-6). Every rendering function required `escapeHtml()` calls. The markdown-safe renderer (Story 8-5) needed escape-first processing with code block extraction. The CSP configuration (Story 8-6) required Arweave gateway whitelisting. These patterns did not exist in the backend-only codebase and needed to be established from scratch.

### 5.4. First-in-Domain Stories Have Higher Review Density

Stories 8-0 (first Arweave integration), 8-1 (first web SPA), and 8-2 (first git object parsing) collectively had 51 code review issues -- more than half the epic total. Later stories in the same domain (8-3: 2 issues, 8-4: 7 issues, 8-5: 6 issues) had significantly fewer. This confirms the pattern from Epic 7: code review density correlates with novelty, not scope.

### 5.5. Adapter Interfaces Isolate Supply Chain Risk

Story 8-0's `ArweaveUploadAdapter` interface isolates `@ardrive/turbo-sdk` (31 known vulnerabilities) behind a clean boundary. The adapter pattern means that switching to a different Arweave upload mechanism requires only a new adapter implementation -- no changes to the DVM handler, chunk manager, or client upload logic. This pattern should be applied to all future external service integrations.

### 5.6. Seed Scripts Need Security Hardening

Story 8-6's seed script required `execFileSync` (not `exec`), `sqliteEscape()`, `isHexString()`, and CLI argument validation to pass the security scan. Developer tooling scripts are often written with less rigor than production code, but semgrep correctly flagged 2 command injection vulnerabilities. **All scripts that process external input must receive the same security scrutiny as production code.**

---

## 6. Action Items for Epic 9

### 6.1. Must-Do (Blockers or High Priority)

| # | Action | Owner | Status | Carried From | Reason |
|---|--------|-------|--------|-------------|--------|
| A1 | **Enable ESLint for packages/rig** | Dev | NEW | Story 8-1 | 2,000+ lines of TypeScript without lint coverage. Enable incrementally (error-level for security rules, warn for style). |
| A2 | **Execute Playwright E2E tests against live infra** | Dev | NEW | Story 8-6 | 7 Playwright specs written but never executed. Requires SDK E2E infra + seeded data. |
| A3 | **Verify 4 manual ACs after first Arweave deployment** | Dev | NEW | Story 8-7 | AC9 (gateway accessibility), AC10 (SPA routing fallback), AC11 (relay config), AC13 (dogfooding). |

### 6.2. Should-Do (Quality Improvements)

| # | Action | Owner | Status | Carried From | Reason |
|---|--------|-------|--------|-------------|--------|
| A4 | **Update Docker E2E infra to include Arweave DVM handler** | Dev | NEW | Story 8-0 | E2E stubs in `docker-arweave-dvm-e2e.test.ts` pending infra update. |
| A5 | **Establish load testing infrastructure** | Dev | OPEN | Epic 1 NFR (8 epics deferred) | All Epic 8 NFRs continue to flag this. |
| A6 | **Add caching to resolveRouteFees()** | Dev | OPEN | Story 7-5 NFR (2 epics deferred) | Per-call Map rebuild acceptable for v1 but won't scale. |
| A7 | **Formal SLOs for DVM job lifecycle** | Dev | OPEN | Epic 6 A7 (3 epics deferred) | With Arweave DVM added, end-to-end SLOs increasingly relevant. |
| A8 | **Set up facilitator ETH monitoring** | Dev | OPEN | Epic 3 A8 (6 epics deferred) | x402 facilitator account operational safety. |

### 6.3. Nice-to-Have

| # | Action | Owner | Reason |
|---|--------|-------|--------|
| A9 | Commit flake.lock | Dev | Carried from Epic 4 A5 (5 epics deferred). Requires Nix. |
| A10 | Publish @toon-protocol/town to npm | Dev | Carried from Epic 2 A3 (7 epics deferred). |
| A11 | Improve blame algorithm (full Myers diff) | Dev | Story 8-4 MVP limitation. Set-based matching misattributes duplicate lines. |
| A12 | Refactor main.ts route handlers (shared repo metadata + refs logic) | Dev | Stories 8-2/8-3 noted duplicated logic in renderTreeRoute/renderBlobRoute. |
| A13 | Add Arweave object caching to Forge-UI | Dev | Deferred per Story 8-2. No caching for fetched git objects. |
| A14 | Weighted WoT model for reputation scoring | Dev | Carried from Epic 6 A9 (3 epics deferred). |
| A15 | Docker E2E for workflow chain + swarm coordination | Dev | Carried from Epic 6 A12/A13 (3 epics deferred). |

---

## 7. Epic 9 Preparation Tasks

Epic 9 (NIP-to-TOON Skill Pipeline + Socialverse Skills) has 34 stories across 11 phases:

| Phase | Stories | Scope |
|-------|---------|-------|
| 0: Pipeline Foundation | 9-0 through 9-3 | Social intelligence base skill, TOON core skill, NIP-to-TOON pipeline, eval framework |
| 1: Identity | 9-4 | Social identity skill (NIP-01/05) |
| 2: Content | 9-5 through 9-7 | Long-form content, social interactions, content references |
| 3: Community | 9-8 through 9-10 | Relay groups, moderated communities, public chat |
| 4: Curation | 9-11 through 9-13 | Lists/labels, search, app handlers |
| 5: Media | 9-14 through 9-16 | Media/files, visual media, file storage |
| 6: Privacy | 9-17 through 9-20 | Encrypted messaging, private DMs, content control, sensitive content |
| 7: Advanced Social | 9-21 through 9-25 | Statuses, badges, highlights, polls, drafts/expiration |
| 8: NIP-34 Git | 9-26 through 9-30 | Kind resources, git objects, Arweave integration, workflow examples, identity evals |
| 9: DVM | 9-31 through 9-32 | DVM protocol skill, marketplace skill |
| 10-11: Discovery + Publish | 9-33 through 9-34 | Relay discovery skill, publish all skills |

### Preparation Checklist

- [ ] **Resolve A1** (ESLint for packages/rig) -- cleanup before Epic 9 adds more code.
- [ ] **Execute A2** (Playwright E2E tests) -- validate Forge-UI before shifting focus to skills.
- [ ] **Define skill file format and directory structure** -- Epic 9 is the first epic producing skills rather than code. The skill file format, directory layout, evaluation framework, and progressive disclosure levels need to be defined before Story 9-0.
- [ ] **Evaluate Claude Agent Skill best practices** -- The skill-creator methodology (evals, description optimization, with/without baseline testing) needs to be reviewed and adapted for TOON-specific skills.
- [ ] **Inventory NIP specifications for all 34 stories** -- Each story corresponds to one or more NIPs. The full NIP list should be compiled with version/status to identify any draft or deprecated NIPs.
- [ ] **Plan Phase 0 carefully** -- Stories 9-0 through 9-3 establish the pipeline that all subsequent phases depend on. Phase 0 quality determines the velocity of Phases 1-11.
- [ ] **Create Epic 9 test design document** -- Key risks: skill quality evaluation (subjective), NIP interpretation accuracy, progressive disclosure level design, eval framework reliability.

### Key Risks for Epic 9

1. **34 stories is the largest epic in project history.** Previous epics ranged from 4 to 12 stories. At 34 stories, Epic 9 is 3x the size of the largest completed epic. Consider splitting into sub-epics (Phase 0 + Phase 1-3 + Phase 4-7 + Phase 8-11) if velocity or scope concerns arise.

2. **Skills are a fundamentally different deliverable type.** All previous epics produced TypeScript code packages. Epic 9 produces Claude Agent Skills -- a format the pipeline has never processed. The ATDD, code review, and traceability steps may need adaptation for skill artifacts.

3. **NIP-34 git skills (Phase 8) can leverage Epic 8 implementation.** Stories 9-26 through 9-30 cover the same NIP-34 domain that Forge-UI implements. The skills should reference and encode the patterns established in `packages/rig/src/web/` (git-objects.ts, nip34-parsers.ts, arweave-client.ts).

4. **Eval framework quality gates are subjective.** Unlike code tests (pass/fail), skill evaluation involves judgment about description quality, progressive disclosure effectiveness, and use-case coverage. Story 9-3 (skill eval framework) must establish objective, repeatable metrics.

5. **No new runtime dependencies expected.** Epic 9 should not add runtime dependencies to the protocol packages -- skills are documentation/knowledge artifacts, not executable code.

---

## 8. Team Agreements

Based on Epic 8 learnings (all 8 stories), the following agreements carry forward and are amended:

1. **ATDD stubs before implementation, lint-checked immediately.** Continued from all prior epics. Budget 2x for first-in-domain stories (8-0, 8-1), 1-1.5x for pattern-extension stories.

2. **Three-pass code review model is non-negotiable.** Maintained across 24 passes in Epic 8. Zero critical issues. The model continues to catch meaningful issues in every epic.

3. **One commit per story.** Maintained for the 8th consecutive epic (56+ stories). Use `feat(N-M):` pattern for stories.

4. **Security scan every story.** 7 real findings in Epic 8 (highest count in any epic). Browser-facing code and developer scripts expand the attack surface. Semgrep scanning is increasingly valuable.

5. **Regression tests are non-negotiable.** Zero regressions for the 8th consecutive epic. Test count increased by +515 -- the largest single-epic growth in project history.

6. **Traceability gate at story close.** 128/128 ACs covered (100%). Manual ACs documented with deployment prerequisites.

7. **Resolve retro action items at epic start.** Epic 8 resolved both critical items from Epic 7 (BootstrapService.republish and E2E debt triage), reversing the regression from Epic 7. This discipline must continue.

8. **Immutable deployment validation gates.** New for Epic 8: any deployment to immutable storage (Arweave, IPFS, permanent URLs) must include a pre-deployment validation story with E2E tests. Story 8-6's mid-epic addition caught 6 bugs that would have been permanently deployed.

9. **Frontend polish for UI-facing stories.** New for Epic 8: stories that produce visible UI must include a frontend polish step covering hover states, transitions, accessibility focus outlines, responsive breakpoints, and loading states.

10. **XSS prevention as default for all rendering functions.** New for Epic 8: every function that produces HTML must use `escapeHtml()` on all user-supplied content. No exceptions. Markdown rendering must use escape-first processing.

11. **Adapter interfaces for external service dependencies.** New for Epic 8: all external service integrations (Arweave, future storage providers, chain bridges) must be wrapped in an adapter interface to isolate supply chain risk and enable testing with mocks.

12. **Security-hardened developer scripts.** New for Epic 8: scripts that process external input (seed data, deployment artifacts, CLI arguments) must use `execFileSync` (not `exec`), validate inputs, and escape interpolated values. Semgrep scans apply to scripts as well as production code.

13. **Unified payment pattern for all monetized flows.** Carried from Epic 7 (D7-004).

14. **Backward-compatible field additions with sensible defaults.** Carried from Epic 7.

15. **Injectable dependencies for orchestration classes.** Carried from Epics 4/6.

---

## 9. Timeline and Velocity

| Story | Duration (approx.) | Type |
|-------|-------------------|------|
| 8-0 | ~90 min | New domain (Arweave DVM, chunked upload, adapter interface) |
| 8-1 | ~120 min | New domain (first SPA, Vite, WebSocket, browser rendering) |
| 8-2 | ~90 min | Domain extension (git object parsing, Arweave fetch, tree/blob views) |
| 8-3 | ~120 min | Domain extension (commit walking, unified diff, LCS algorithm) |
| 8-4 | ~45 min | Domain extension (blame algorithm, visual grouping) |
| 8-5 | ~120 min | Domain extension (issues, PRs, markdown-safe, navigation tabs) |
| 8-6 | ~90 min | Validation (bug fixes, seed script, Playwright E2E, polish) |
| 8-7 | ~90 min | Tooling (Vite build config, deploy script, path manifest) |

**Average story velocity:** ~96 minutes per story pipeline execution
**Total pipeline time:** ~12.5 hours (approximate)
**Fastest story:** 8-4 (45 min -- partial pipeline, steps 12-22 only)
**Slowest stories:** 8-1, 8-3, 8-5 (120 min each -- largest scope or new domain)

### Velocity Comparison Across Epics

| Metric | Epic 5 | Epic 6 | Epic 7 | Epic 8 | Trend |
|--------|--------|--------|--------|--------|-------|
| Stories | 4 | 4 | 6 | 8 | Largest epic yet |
| ACs | 27 | 21 | 35 | 128 | 3.7x increase |
| AC coverage | 100% | 100% | 100% | 100% | Maintained |
| Net test growth | +279 | +286 | +212 | +515 | Largest growth |
| Tests per story | 69.8 | 71.5 | 37.2 | 64.4 | Recovered |
| Code review issues | 33 | 44 | 28 | 96 | Highest (new domain) |
| Issues per story | 8.3 | 11.0 | 4.7 | 12.0 | Highest (expected) |
| Critical+High issues | 0 | 7 | 0 | 12 (all H, 0 C) | 12 high, zero critical |
| Issues remaining | 0 | 0 | 0 | 0 | Clean |
| Security findings (real) | 0 | 0 | 4 | 7 | Highest (new attack surface) |
| NFR pass rate | 4/4 | 4/4 | 6/6 | 8/8 | 100% for 5th consecutive epic |
| Test regressions | 0 | 0 | 0 | 0 | Maintained (8 epics) |
| Avg story duration | 160 min | 68 min | 80 min | 96 min | Moderate increase |
| Total pipeline time | ~12.25h | ~5h | ~8h | ~12.5h | Increased (more stories) |
| Retro actions resolved (critical) | 8/18 | 3/3 | 0/2 | 2/2 | 100% recovery |

Key observations:

- **128 acceptance criteria is the largest in project history** (3.7x the previous high of 35 in Epic 7). This reflects the breadth of UI functionality delivered -- each Forge-UI view required multiple rendering, navigation, and security ACs.

- **+515 net test growth is the largest in project history**, surpassing Epic 6's +286. The growth reflects both the new `packages/rig` test suite and the trace gap fills that added tests for previously untested paths.

- **Code review issues per story (12.0) is the highest since Epic 4 (13.0).** This is expected: Epic 8 introduced two new domains (Arweave integration and browser-facing code), both requiring patterns not established in previous epics. The density concentrated in first-in-domain stories (8-0: 11, 8-1: 22, 8-2: 18) and decreased in later stories (8-3: 2, 8-4: 7, 8-5: 6).

- **7 real security findings is the highest in any epic.** Browser-facing code (XSS, CSP, WebSocket security) and developer scripts (command injection) expanded the attack surface beyond the backend-only patterns of previous epics.

- **Retro action item resolution recovered to 100%.** Both critical Epic 7 items were resolved at epic start, reversing the regression from Epic 7.

---

## 10. Known Risks Inventory

| # | Risk | Severity | Source | Status |
|---|------|----------|--------|--------|
| R1 | Playwright E2E tests written but not executed against live infra | High | Story 8-6 | NEW -- requires SDK E2E infra + seeded Arweave data |
| R2 | 4 manual ACs pending first Arweave deployment | Medium | Story 8-7 | NEW -- AC9, AC10, AC11, AC13 |
| R3 | packages/rig excluded from ESLint | Medium | Story 8-1 | NEW -- 2,000+ lines without lint |
| R4 | Arweave DVM E2E stubs pending Docker infra update | Medium | Story 8-0 | NEW -- full upload-retrieve cycle untested in Docker |
| R5 | Simplified blame algorithm misattributes duplicate lines | Low | Story 8-4 | NEW -- MVP trade-off, known limitation |
| R6 | @ardrive/turbo-sdk 31 transitive vulnerabilities | Low | Story 8-0 | CARRIED -- mitigated by adapter interface |
| R7 | Per-call Map rebuild in resolveRouteFees() | Low | Story 7-5 | CARRIED (2 epics) |
| R8 | No load testing infrastructure | Medium | NFR inherited | CARRIED (8 epics) |
| R9 | No formal SLOs | Medium | NFR inherited | CARRIED (8 epics) |
| R10 | No distributed tracing | Medium | NFR inherited | CARRIED (8 epics) |
| R11 | Facilitator ETH monitoring not implemented | Medium | Epic 3 A8 | CARRIED (6 epics) |
| R12 | flake.lock not committed | Low | Epic 4 A5 | CARRIED (5 epics) |
| R13 | Self-reported reputation scores not protocol-enforced | Medium | Epic 6 | CARRIED (3 epics) |
| R14 | @toon-protocol/town unpublished to npm | Low | Epic 2 A3 | CARRIED (7 epics) |

R1 is the highest-priority new risk. The 7 Playwright E2E specs represent the most comprehensive Forge-UI validation available, but they have never been executed. Until they run against live infrastructure, the SPA's runtime behavior is validated only through jsdom unit tests and code review.

R3 is operationally significant because `packages/rig` is now the largest new package added in any single epic, and it has no static analysis enforcement. This should be resolved before Epic 9 adds more code or skills that reference rig patterns.

---

## 11. Conclusion

Epic 8 delivered the TOON Protocol's first external storage integration and first browser application -- two significant firsts that expand the project from a backend-only protocol into a full-stack platform. The 8 stories produced a kind:5094 Arweave DVM with chunked upload support, a complete Forge-UI source browser (repos, trees, blobs, commits, diffs, blame, issues, PRs), an E2E validation gate, and an Arweave deployment pipeline.

The epic's execution was thorough: 128 acceptance criteria (all covered), +515 net new tests (largest single-epic growth), 7 real security vulnerabilities found and fixed, zero test regressions, and all quality gates passing. The mid-epic addition of Story 8-6 as a validation gate before immutable Arweave deployment was the most important process decision, catching 6 bugs that would have been permanently deployed.

The most significant remaining gaps are the unexecuted Playwright E2E tests (R1), the 4 manual ACs pending first Arweave deployment (R2), and the ESLint exclusion for packages/rig (R3). These should be prioritized in Epic 9 preparation.

Epic 9 (NIP-to-TOON Skill Pipeline) represents a fundamental shift in deliverable type -- from TypeScript packages to Claude Agent Skills. The pipeline, review, and quality gate processes established over 8 epics will need adaptation for skill artifacts. Phase 0 (Stories 9-0 through 9-3) is the critical foundation that determines the velocity of all subsequent phases.
