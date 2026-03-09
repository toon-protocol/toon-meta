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
lastSaved: '2026-03-04'
---

# Test Design: Epic 5 - The Rig (ILP-Gated TypeScript Git Forge)

**Date:** 2026-03-04
**Author:** Jonathan
**Status:** Draft

---

## Executive Summary

**Scope:** Full test design for Epic 5 — The Rig, an ILP-gated TypeScript git forge built on the SDK. 12 stories covering NIP-34 event handlers, git HTTP backend, read-only web UI, Nostr pubkey identity, and package publishing.

**Risk Summary:**

- Total risks identified: 13
- High-priority risks (>=6): 5
- Critical categories: SEC (4 risks), TECH (1 risk)

**Coverage Summary:**

- P0 scenarios: 11 (~20-35 hours)
- P1 scenarios: 13 (~18-30 hours)
- P2/P3 scenarios: 15 (~10-19 hours)
- **Total effort**: ~48-84 hours (~1.5-3 weeks)

---

## Not in Scope

| Item                             | Reasoning                                                                  | Mitigation                                                                                         |
| -------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **Admin panels / user settings** | Template port scope excludes non-code-browsing Forgejo features            | Not needed — Nostr pubkey identity replaces user management                                        |
| **OAuth / notification system**  | Forgejo features irrelevant to Nostr-native identity model                 | Pubkey-based auth handles all access control                                                       |
| **Performance / load testing**   | Rig is single-tenant, low-concurrency service; no SLA targets defined      | Monitor in production; add k6 tests if usage grows                                                 |
| **Multi-relay redundancy**       | Deferred per architecture (post-MVP enhancement)                           | Single relay dependency is an accepted trade-off                                                   |
| **E2E tests (full Rig + ILP)**   | Requires deployed SDK + connector + relay infrastructure not yet available | Integration tests with real git + SQLite :memory: cover handler flows; E2E deferred to post-Epic 5 |

---

## Risk Assessment

### High-Priority Risks (Score >=6)

| Risk ID | Category | Description                                                                                                                                                        | Probability | Impact | Score | Mitigation                                                                                                     | Owner | Timeline              |
| ------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- | ------ | ----- | -------------------------------------------------------------------------------------------------------------- | ----- | --------------------- |
| E5-R001 | SEC      | Git command injection — all git operations use `child_process` with inputs from Nostr events. Using `exec` instead of `execFile` enables shell injection.          | 2           | 3      | 6     | `execFile` only; input sanitization; reject shell metacharacters; lint rule blocking `exec` in `packages/rig/` | Dev   | Stories 5.1-5.4       |
| E5-R002 | SEC      | Authorization bypass in PR lifecycle — maintainer permission checks rely on kind:30617 maintainer tags. Stale/spoofed events could grant unauthorized merge/close. | 2           | 3      | 6     | Verify maintainer list from freshest kind:30617 event; reject unauthorized pubkeys with F06                    | Dev   | Story 5.6             |
| E5-R003 | SEC      | Path traversal in git operations — repo names and file paths from NIP-34 events could escape `repoDir` (e.g., `../../etc/passwd`).                                 | 2           | 3      | 6     | `path.resolve()` + verify within `repoDir`; reject `../` in names/paths                                        | Dev   | Stories 5.1, 5.4, 5.8 |
| E5-R004 | SEC      | XSS via Nostr event content — issue bodies, comments, PR descriptions rendered in Eta templates. Unescaped content enables stored XSS.                             | 2           | 3      | 6     | Eta auto-escape; sanitize markdown; CSP headers on Express                                                     | Dev   | Stories 5.7-5.11      |
| E5-R005 | TECH     | Malformed patch crashes git backend — patches from arbitrary Nostr events may be malformed, causing `git am`/`git apply` to fail or hang.                          | 3           | 2      | 6     | Timeout on child_process; catch git errors → `ctx.reject('F00')`; test with malformed inputs                   | Dev   | Story 5.2             |

### Medium-Priority Risks (Score 3-4)

| Risk ID | Category | Description                                                                                 | Probability | Impact | Score | Mitigation                                                     | Owner |
| ------- | -------- | ------------------------------------------------------------------------------------------- | ----------- | ------ | ----- | -------------------------------------------------------------- | ----- |
| E5-R006 | TECH     | Relay unavailability breaks issue/PR pages — Rig queries relay at render time with no cache | 2           | 2      | 4     | Graceful degradation with "relay unavailable" message          | Dev   |
| E5-R007 | DATA     | NIP-34 event validation — malformed events with missing `a` tags or invalid repo references | 2           | 2      | 4     | Validate required tags before processing; reject with F00      | Dev   |
| E5-R008 | TECH     | Express route conflicts — overlapping patterns between repo, git-backend, and issues routes | 2           | 2      | 4     | Route mounting order; integration test all patterns            | Dev   |
| E5-R009 | DATA     | SQLite repo metadata concurrent writes during simultaneous repo creation                    | 1           | 3      | 3     | better-sqlite3 WAL mode; serialize writes                      | Dev   |
| E5-R010 | OPS      | Git binary missing at runtime — startup check skipped or version incompatible               | 1           | 3      | 3     | Startup verification with version check; exit with clear error | Dev   |

### Low-Priority Risks (Score 1-2)

| Risk ID | Category | Description                                                                        | Probability | Impact | Score | Action  |
| ------- | -------- | ---------------------------------------------------------------------------------- | ----------- | ------ | ----- | ------- |
| E5-R011 | BUS      | Eta template port fidelity — rendering differences from Forgejo Go HTML            | 1           | 2      | 2     | Monitor |
| E5-R012 | OPS      | Package ESM/CLI/Docker configuration                                               | 1           | 1      | 1     | Monitor |
| E5-R013 | BUS      | Pubkey profile enrichment failures — kind:0 fetch fails to truncated npub fallback | 1           | 1      | 1     | Monitor |

### Risk Category Legend

- **TECH**: Technical/Architecture (flaws, integration, scalability)
- **SEC**: Security (access controls, auth, data exposure)
- **PERF**: Performance (SLA violations, degradation, resource limits)
- **DATA**: Data Integrity (loss, corruption, inconsistency)
- **BUS**: Business Impact (UX harm, logic errors, revenue)
- **OPS**: Operations (deployment, config, monitoring)

---

## Entry Criteria

- [ ] SDK (Epic 1) complete and published
- [ ] `@crosstown/core` TOON codec extraction done (Story 1.0)
- [ ] `git` binary available in development environment PATH
- [ ] NIP-34 types available in `@crosstown/core/nip34`
- [ ] Test fixtures: git repo factory function for creating test repos with commits

## Exit Criteria

- [ ] All P0 tests passing (100%)
- [ ] All P1 tests passing (or failures triaged with waivers)
- [ ] No open high-priority / high-severity bugs
- [ ] All SEC-category risks (E5-R001 through E5-R004) have passing mitigation tests
- [ ] Test coverage agreed as sufficient by team review

---

## Test Coverage Plan

> **Note:** P0/P1/P2/P3 = priority classification based on risk severity, NOT execution timing. See Execution Strategy for when tests run.

### P0 (Critical)

**Criteria:** Blocks core write path + High risk (>=6) + No workaround. Security mitigations are non-negotiable.

| Test ID       | Requirement                                            | Test Level  | Risk Link | Notes                                                   |
| ------------- | ------------------------------------------------------ | ----------- | --------- | ------------------------------------------------------- |
| 5.1-UNIT-001  | All git operations use `execFile`, never `exec`        | Unit        | E5-R001   | Verify function signatures in git/operations.ts         |
| 5.1-UNIT-002  | Path traversal rejected in repo names                  | Unit        | E5-R003   | `../`, absolute paths, null bytes, shell metacharacters |
| 5.2-UNIT-001  | Malformed patch → `ctx.reject('F00')`                  | Unit        | E5-R005   | Empty, binary, oversized, timeout                       |
| 5.2-UNIT-002  | Patch path traversal — diff referencing outside repo   | Unit        | E5-R003   | `diff --git a/../../etc/passwd`                         |
| 5.4-UNIT-001  | HTTP push (receive-pack) rejected                      | Unit        | E5-R001   | Only upload-pack allowed                                |
| 5.5-UNIT-001  | Unauthorized pubkey → `ctx.reject('F06')`              | Unit        | E5-R002   | Non-maintainer merge/close blocked                      |
| 5.6-UNIT-001  | Merge only by maintainer pubkeys from kind:30617       | Unit        | E5-R002   | Maintainer list lookup + rejection                      |
| 5.11-UNIT-001 | XSS payloads escaped in Eta templates                  | Unit        | E5-R004   | `<script>`, `onerror=`, `javascript:` in content        |
| 5.1-INT-001   | Repo creation: kind:30617 → `git init --bare` → SQLite | Integration | E5-R001   | Real git + SQLite :memory:                              |
| 5.2-INT-001   | Patch application: kind:1617 → `git am` succeeds       | Integration | E5-R005   | Real git repo on disk                                   |
| 5.6-INT-001   | PR merge: kind:1631 → `git merge` on target branch     | Integration | E5-R002   | Authorized maintainer merge                             |

**Total P0**: 11 tests, ~20-35 hours

### P1 (High)

**Criteria:** Core read path + handler happy paths + git HTTP backend

| Test ID      | Requirement                             | Test Level  | Risk Link | Notes                                 |
| ------------ | --------------------------------------- | ----------- | --------- | ------------------------------------- |
| 5.3-UNIT-001 | Issue handler accepts valid kind:1621   | Unit        | —         | `ctx.accept()` happy path             |
| 5.3-UNIT-002 | Comment handler accepts valid kind:1622 | Unit        | —         | `ctx.accept()` happy path             |
| 5.3-UNIT-003 | Non-existent repo → `ctx.reject('F00')` | Unit        | E5-R007   | Invalid `a` tag reference             |
| 5.1-UNIT-003 | Git startup verification                | Unit        | E5-R010   | Mock execFile → missing git → exit    |
| 5.5-UNIT-002 | Pubkey as git author identity           | Unit        | —         | `GIT_AUTHOR_NAME`/`EMAIL` format      |
| 5.6-UNIT-002 | Status events update repo metadata      | Unit        | —         | kind:1630/1632/1633 state transitions |
| 5.4-INT-001  | Clone via HTTP (git-upload-pack)        | Integration | —         | Real git repo, Express route          |
| 5.4-INT-002  | Fetch via HTTP returns updated refs     | Integration | —         | After patch applied                   |
| 5.7-INT-001  | Repository list page renders            | Integration | —         | Express + SQLite + Eta                |
| 5.8-INT-001  | File tree renders from `git ls-tree`    | Integration | —         | Express + real git repo               |
| 5.8-INT-002  | Blob view renders file content          | Integration | —         | Syntax highlighting                   |
| 5.9-INT-001  | Commit log renders from `git log`       | Integration | —         | Express + real git repo               |
| 5.9-INT-002  | Commit diff renders from `git diff`     | Integration | —         | Diff formatting                       |

**Total P1**: 13 tests, ~18-30 hours

### P2 (Medium)

**Criteria:** Secondary features + edge cases + relay-sourced data

| Test ID      | Requirement                                         | Test Level  | Risk Link | Notes                     |
| ------------ | --------------------------------------------------- | ----------- | --------- | ------------------------- |
| 5.10-INT-001 | Blame view renders from `git blame`                 | Integration | —         | Express + real git repo   |
| 5.11-INT-001 | Issues list from relay queries                      | Integration | E5-R006   | Mocked relay subscription |
| 5.11-INT-002 | PR list from relay queries with status              | Integration | E5-R006   | Mocked relay              |
| 5.11-INT-003 | Comment thread renders chronologically              | Integration | —         | Verify ordering           |
| 5.5-UNIT-003 | kind:0 profile enrichment; missing → truncated npub | Unit        | E5-R013   | Graceful fallback         |
| 5.7-UNIT-001 | Empty state when no repos exist                     | Unit        | —         | Template renders message  |
| 5.8-UNIT-001 | 404 for non-existent path                           | Unit        | —         | Tree/blob error handling  |
| 5.9-UNIT-001 | 404 for invalid commit SHA                          | Unit        | —         | Diff/log error handling   |
| 5.11-INT-004 | Relay unavailable → graceful degradation            | Integration | E5-R006   | Mocked relay timeout      |
| 5.1-UNIT-004 | Unsupported NIP-34 kind → `ctx.reject('F00')`       | Unit        | E5-R007   | Unknown kind rejection    |

**Total P2**: 10 tests, ~8-15 hours

### P3 (Low)

**Criteria:** Nice-to-have + package configuration + cosmetic

| Test ID       | Requirement                                | Test Level  | Notes                       |
| ------------- | ------------------------------------------ | ----------- | --------------------------- |
| 5.12-UNIT-001 | Package exports `startRig`, `RigConfig`    | Unit        | Public API surface          |
| 5.12-UNIT-002 | CLI entrypoint parses flags                | Unit        | `--mnemonic`, `--relay-url` |
| 5.11-UNIT-002 | Contribution banner renders with docs link | Unit        | Banner text check           |
| 5.10-UNIT-001 | 404 for non-existent blame file at ref     | Unit        | Error handling              |
| 5.4-INT-003   | 404 for clone/fetch non-existent repo      | Integration | HTTP 404 response           |

**Total P3**: 5 tests, ~2-4 hours

---

## Execution Order

**Philosophy:** Run everything on every PR. The Rig's tests use real git repos on disk + SQLite :memory: — no live infrastructure needed. Vitest parallelization keeps the full suite under 10 minutes.

| Trigger      | What Runs                            | Duration  |
| ------------ | ------------------------------------ | --------- |
| **Every PR** | All 39 unit + integration tests      | < 10 min  |
| **Manual**   | Exploratory template fidelity review | As needed |

No nightly or weekly cadence needed — all tests are fast and infrastructure-light (real git + in-memory SQLite only).

---

## Resource Estimates

### Test Development Effort

| Priority  | Count  | Effort Range     | Notes                                      |
| --------- | ------ | ---------------- | ------------------------------------------ |
| P0        | 11     | ~20-35 hours     | Security input crafting, git repo fixtures |
| P1        | 13     | ~18-30 hours     | Handler logic + Express route integration  |
| P2        | 10     | ~8-15 hours      | Relay mocking, error states                |
| P3        | 5      | ~2-4 hours       | Package config, simple assertions          |
| **Total** | **39** | **~48-84 hours** | **~1.5-3 weeks, 1 engineer**               |

### Prerequisites

**Test Data:**

- Git repo factory function (creates bare repo with initial commit, configurable branches/files)
- NIP-34 event factory functions (valid kind:30617, kind:1617, kind:1621, kind:1622, kind:1630-1633 events)
- SQLite :memory: database factory for RepoMetadataStore

**Tooling:**

- Vitest for unit + integration tests
- Real `git` binary in PATH for integration tests
- `child_process.execFile` for git operations under test
- Mocked `nostr-tools` SimplePool for relay query tests

**Environment:**

- Node.js 24.x with ESM
- `git` >= 2.x in PATH
- No Docker, no live relay, no blockchain required

---

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate**: 100% (no exceptions)
- **P1 pass rate**: >= 95% (waivers required for failures)
- **P2/P3 pass rate**: >= 90% (informational)
- **SEC risk mitigations (E5-R001 through E5-R004)**: 100% complete

### Coverage Targets

- **Critical paths (write handlers)**: >= 80%
- **Security scenarios**: 100%
- **Business logic (handlers + routing)**: >= 70%
- **Edge cases**: >= 50%

### Non-Negotiable Requirements

- [ ] All P0 tests pass
- [ ] No high-risk (>=6) items unmitigated
- [ ] Security tests (SEC category) pass 100%
- [ ] Git command injection prevention verified (`execFile` only)
- [ ] XSS prevention verified (Eta auto-escape)
- [ ] Authorization boundary verified (maintainer-only merge/close)

---

## Mitigation Plans

### E5-R001: Git Command Injection (Score: 6)

**Mitigation Strategy:**

1. All git operations in `packages/rig/src/git/operations.ts` use `child_process.execFile` exclusively
2. Input sanitization for repo names (alphanumeric + hyphens only), file paths (no `../`, no absolute paths), and patch content (reject shell metacharacters)
3. Lint rule or code review gate blocking `child_process.exec` in `packages/rig/`

**Owner:** Dev
**Timeline:** Stories 5.1-5.4
**Status:** Planned
**Verification:** Unit tests 5.1-UNIT-001, 5.1-UNIT-002, 5.4-UNIT-001 with malicious inputs (path traversal `../`, shell injection `; rm -rf /`, null bytes)

### E5-R002: Authorization Bypass in PR Lifecycle (Score: 6)

**Mitigation Strategy:**

1. Maintainer list fetched from the most recent kind:30617 event for the repository on every authorization check
2. Non-maintainer pubkeys receive `ctx.reject('F06', 'Unauthorized: pubkey lacks maintainer permissions')`
3. Unit test the boundary: same pubkey authorized as maintainer → allowed; different pubkey → rejected

**Owner:** Dev
**Timeline:** Story 5.6
**Status:** Planned
**Verification:** Unit tests 5.5-UNIT-001, 5.6-UNIT-001; Integration test 5.6-INT-001

### E5-R003: Path Traversal in Git Operations (Score: 6)

**Mitigation Strategy:**

1. All paths canonicalized via `path.resolve(repoDir, userInput)`
2. Verify resolved path starts with `repoDir` prefix — reject otherwise
3. Reject `../`, absolute paths, and null bytes in repo names and file paths

**Owner:** Dev
**Timeline:** Stories 5.1, 5.4, 5.8
**Status:** Planned
**Verification:** Unit tests 5.1-UNIT-002, 5.2-UNIT-002 with path traversal payloads

### E5-R004: XSS via Nostr Event Content (Score: 6)

**Mitigation Strategy:**

1. Eta template engine configured with auto-escape enabled for all interpolated values
2. Markdown rendering sanitized (strip raw HTML or use allowlist)
3. Content-Security-Policy headers on all Express responses
4. Unit test with XSS payloads in issue/comment content

**Owner:** Dev
**Timeline:** Stories 5.7-5.11
**Status:** Planned
**Verification:** Unit test 5.11-UNIT-001 with `<script>alert(1)</script>`, `<img onerror=alert(1)>`, `javascript:` URI payloads

### E5-R005: Malformed Patch Crashes Git Backend (Score: 6)

**Mitigation Strategy:**

1. Timeout on all `child_process.execFile` calls (default 30s)
2. Catch all git errors gracefully → `ctx.reject('F00', errorMessage)`
3. Test with empty patches, binary content, oversized patches, and patches that conflict

**Owner:** Dev
**Timeline:** Story 5.2
**Status:** Planned
**Verification:** Unit test 5.2-UNIT-001; Integration test 5.2-INT-001

---

## Assumptions and Dependencies

### Assumptions

1. SDK (Epic 1) is complete and stable before Rig development begins
2. `@crosstown/core` TOON codec extraction (Story 1.0) is done
3. NIP-34 types in `packages/core/src/nip34/` remain stable (no breaking changes during Epic 5)
4. The `git` binary (>= 2.x) is available in all development and CI environments
5. Eta template engine supports auto-escape by default (verified: Eta ^4.5 does)

### Dependencies

1. `@crosstown/sdk` package — Required for `createNode()`, handler registry, `HandlerContext`. Required by: All stories.
2. `@crosstown/core` NIP-34 types — Required for `RepositoryAnnouncement`, `PatchEvent`, `IssueEvent`, `StatusEvent`. Required by: All handler stories.
3. System `git` binary — Required for all git operations (init, am, merge, ls-tree, show, log, diff, blame, http-backend). Required by: Stories 5.1-5.10.
4. `better-sqlite3` — Required for `RepoMetadataStore`. Required by: Story 5.1.
5. `express` ^5.2 + `eta` ^4.5 — Required for web UI. Required by: Stories 5.7-5.11.

### Risks to Plan

- **Risk**: SDK (Epic 1) delivery delayed
  - **Impact**: All Epic 5 work blocked
  - **Contingency**: Begin Rig git operations module and Express routes independently (they don't depend on SDK); integrate handler wiring later

- **Risk**: NIP-34 types in core change during Epic 5
  - **Impact**: Handler implementations need updating
  - **Contingency**: Pin core dependency version; update handlers in a separate story

---

## Interworking & Regression

| Service/Component            | Impact                                                            | Regression Scope                             |
| ---------------------------- | ----------------------------------------------------------------- | -------------------------------------------- |
| **@crosstown/sdk**           | Rig depends on `createNode()`, handler registry, `HandlerContext` | SDK unit + integration tests must pass       |
| **@crosstown/core (NIP-34)** | Rig uses NIP-34 types, constants, `parseRepositoryReference()`    | Core NIP-34 tests must pass                  |
| **@crosstown/core (TOON)**   | SDK pipeline uses TOON codec (shallow parse → verify → dispatch)  | Core TOON codec roundtrip tests must pass    |
| **Relay (WebSocket)**        | Rig queries relay for issues/PRs/comments at render time          | Relay WebSocket subscription tests must pass |

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

- PRD: `docs/prd/2-requirements.md`
- Epic: `_bmad-output/planning-artifacts/epics.md` (Epic 5)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- System-Level Test Design: `_bmad-output/test-artifacts/test-design-architecture.md`

### Inherited System-Level Risks

| System Risk                        | Epic 5 Risk | Status                                |
| ---------------------------------- | ----------- | ------------------------------------- |
| R-004 (Git command injection)      | E5-R001     | Scoped to stories 5.1-5.4             |
| R-009 (Rig relay dependency)       | E5-R006     | Medium priority, graceful degradation |
| R-012 (Eta template port fidelity) | E5-R011     | Low priority, monitor                 |

---

**Generated by**: BMad TEA Agent - Test Architect Module
**Workflow**: `_bmad/tea/testarch/test-design`
**Version**: 4.0 (BMad v6)
