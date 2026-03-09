---
stepsCompleted:
  [
    'step-01-preflight-and-context',
    'step-02-generation-mode',
    'step-03-test-strategy',
    'step-04-generate-tests',
    'step-04c-aggregate',
    'step-05-validate-and-complete',
  ]
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-03-06'
workflowType: 'testarch-atdd'
inputDocuments:
  - _bmad-output/implementation-artifacts/2-4-remove-git-proxy-and-document-reference-implementation.md
  - _bmad-output/test-artifacts/atdd-checklist-epic-2.md
  - _bmad-output/test-artifacts/test-design-epic-2.md
  - packages/town/src/cleanup.test.ts
  - packages/town/src/sdk-entrypoint-validation.test.ts
  - docker/src/entrypoint-town.ts
  - vitest.config.ts
  - _bmad/tea/testarch/knowledge/data-factories.md
  - _bmad/tea/testarch/knowledge/test-quality.md
  - _bmad/tea/testarch/knowledge/test-healing-patterns.md
  - _bmad/tea/testarch/knowledge/test-levels-framework.md
  - _bmad/tea/testarch/knowledge/test-priorities-matrix.md
---

# ATDD Checklist - Epic 2, Story 2.4: Remove packages/git-proxy and Document Reference Implementation

**Date:** 2026-03-06
**Author:** Jonathan
**Primary Test Level:** Unit (static filesystem/source analysis)

---

## Preflight Summary

**Detected Stack:** backend (Node.js/TypeScript monorepo, Vitest)
**Test Framework:** Vitest (co-located `*.test.ts`, workspace config at root + package level)
**Test Design Preference:** Static analysis (filesystem checks, source code inspection)

### Story Context

Story 2.4 is a **documentation and cleanup** story with two parts:
1. **Cleanup (AC #1):** Verify git-proxy removal and clean up stale documentation
2. **Documentation (AC #2, #3):** Add inline SDK reference implementation documentation to `docker/src/entrypoint-town.ts`

### Key Observation

The story originally stated "This story adds no new test files." However, ATDD analysis identified coverage gaps: AC #1's stale documentation cleanup (3 stale doc files) and AC #2/#3's reference implementation documentation requirements had no automated test coverage. The ATDD workflow created 5 new RED tests in `packages/town/src/doc-cleanup-and-reference.test.ts` to cover these gaps, while the 4 existing tests in `cleanup.test.ts` remain GREEN.

### Existing Test Files

| File | Tests | Status | Purpose |
|------|-------|--------|---------|
| `packages/town/src/cleanup.test.ts` | 4 | GREEN | Git-proxy removal verification (T-2.4-01 through T-2.4-04) |
| `packages/town/src/sdk-entrypoint-validation.test.ts` | 7 | GREEN | SDK entrypoint structure validation (Story 2.3, verification-only for 2.4) |

### Knowledge Fragments Loaded (Backend Core)

- `data-factories.md` -- Factory patterns (N/A for static analysis tests)
- `test-quality.md` -- Test design principles (applied to existing tests)
- `test-healing-patterns.md` -- Common failure patterns (N/A, tests are stable)
- `test-levels-framework.md` -- Test level selection (Unit level for static checks)
- `test-priorities-matrix.md` -- P0-P3 criteria (P2 for cleanup validation)

---

## Generation Mode

**Mode:** AI Generation
**Reason:** Detected stack is `backend` (Node.js/TypeScript). No browser recording needed. Acceptance criteria are clear (3 ACs). All tests are static analysis (filesystem checks, source code inspection). Story adds no new test files -- ATDD documents existing GREEN tests and maps them to ACs.

---

## Story Summary

Remove the obsolete `packages/git-proxy/` package, clean up stale documentation referencing it, and add comprehensive inline documentation to the SDK-based relay entrypoint (`docker/src/entrypoint-town.ts`) so it serves as the SDK reference implementation.

**As a** SDK developer
**I want** the obsolete `packages/git-proxy/` removed and the SDK-based relay documented as the reference implementation
**So that** the codebase is clean and developers have a clear example to follow

**FRs covered:** FR-SDK-16

**Dependencies:** AC #1 has no blocking dependencies. AC #2 and #3 depend on Story 2.3 (done).

---

## Acceptance Criteria

1. Given `packages/git-proxy/` exists in the monorepo, when this story is completed, then the package is removed from the filesystem and `pnpm-workspace.yaml`, no other package depends on it, and all stale documentation referencing it is removed or updated.
2. Given the SDK-based relay entrypoint (`docker/src/entrypoint-town.ts`), when a developer reads the example, then it demonstrates: seed phrase identity, kind-based handler registration, `ctx.decode()` for code handlers, SPSP handling, settlement negotiation, and lifecycle management, with inline comments explaining each SDK pattern.
3. Given the example code, when reviewed against the SDK's public API, then every major SDK feature is exercised (identity, handlers, pricing, bootstrap, channels, dev mode).

---

## Test Strategy

### Test Level Assignment

| Level | AC | Tests | Infrastructure | Rationale |
|-------|-----|-------|----------------|-----------|
| **Unit (static)** | #1 | T-2.4-01 to T-2.4-04 | Filesystem only | Static checks on repo structure, package.json, workspace config |
| **Unit (static)** | #1 | T-2.4-05 to T-2.4-07 (NEW) | Filesystem only | Stale documentation cleanup verification |
| **Unit (static)** | #2 | T-2.4-08, T-2.4-09 (NEW) | Source analysis | Reference implementation documentation verification |
| **Unit (static)** | #3 | Covered by sdk-entrypoint-validation.test.ts | Source analysis | SDK feature coverage verification (Story 2.3 tests, verification-only) |

### Priority Distribution

| Priority | Count | Tests |
|----------|-------|-------|
| **P2** | 9 | T-2.4-01 through T-2.4-09 (all cleanup and documentation tests) |

All tests are P2 because Story 2.4 is a cleanup/documentation story with risk score 2 (E2-R011).

### Red Phase Status

**Existing tests (T-2.4-01 to T-2.4-04):** Already GREEN. These were created during Epic 2 baseline.

**New tests (T-2.4-05 to T-2.4-09):** Will be RED because:
- T-2.4-05: `docs/api-contracts-git-proxy.md` still exists (not yet deleted)
- T-2.4-06: `docs/project-scan-report.json` still references git-proxy
- T-2.4-07: `docs/index.md` still references git-proxy
- T-2.4-08: `docker/src/entrypoint-town.ts` lacks file-level JSDoc reference implementation documentation
- T-2.4-09: `docker/src/entrypoint-town.ts` lacks inline section comments for pipeline stages

### Mock Policy

No mocks needed. All tests are static analysis (read filesystem, parse files, check content).

---

## Failing Tests Created (RED Phase)

### Unit/Static Tests -- Existing (4 tests, GREEN)

**File:** `packages/town/src/cleanup.test.ts` (153 lines)

- **Test:** T-2.4-01 `should not have packages/git-proxy directory`
  - **Status:** GREEN (passing since Epic 2 baseline)
  - **Verifies:** AC #1 -- git-proxy directory removed from filesystem

- **Test:** T-2.4-02 `should not have any package depending on @crosstown/git-proxy`
  - **Status:** GREEN (passing since Epic 2 baseline)
  - **Verifies:** AC #1 -- no workspace package references git-proxy

- **Test:** T-2.4-03 `should not reference @crosstown/git-proxy in pnpm-workspace.yaml`
  - **Status:** GREEN (passing since Epic 2 baseline)
  - **Verifies:** AC #1 -- workspace config clean

- **Test:** T-2.4-04 `SDK relay entrypoint should import from @crosstown/sdk`
  - **Status:** GREEN (passing since SDK implementation)
  - **Verifies:** AC #1 -- SDK package exists and is correctly named

### Unit/Static Tests -- New (5 tests, RED)

**File:** `packages/town/src/doc-cleanup-and-reference.test.ts` (227 lines)

- **Test:** T-2.4-05 `docs/api-contracts-git-proxy.md should not exist`
  - **Status:** RED -- file still exists (not yet deleted)
  - **Verifies:** AC #1 -- stale git-proxy API contracts document deleted

- **Test:** T-2.4-06 `docs/project-scan-report.json should not reference git-proxy`
  - **Status:** RED -- file contains 6 git-proxy references
  - **Verifies:** AC #1 -- project scan report cleaned of stale references

- **Test:** T-2.4-07 `docs/index.md should not reference git-proxy`
  - **Status:** RED -- file contains package table row and API contracts link
  - **Verifies:** AC #1 -- documentation index cleaned of stale references

- **Test:** T-2.4-08 `entrypoint-town.ts should have SDK Reference Implementation JSDoc`
  - **Status:** RED -- file-level JSDoc lacks "reference implementation" text
  - **Verifies:** AC #2 -- file documented as SDK reference implementation

- **Test:** T-2.4-09 `entrypoint-town.ts should have inline section comments for pipeline stages`
  - **Status:** RED -- only 35 comment lines (needs >= 40), missing SDK pattern keywords
  - **Verifies:** AC #2, AC #3 -- inline section comments for all SDK features

### Verification-Only Tests (7 tests, GREEN)

**File:** `packages/town/src/sdk-entrypoint-validation.test.ts` (361 lines)

These tests were created in Story 2.3 and are verification-only for Story 2.4. They validate that the SDK-based entrypoint uses all required SDK pipeline components.

- T-2.3-07: Handler logic < 100 lines (GREEN)
- Handler logic significantly smaller than old entrypoint (GREEN)
- Imports handlers from @crosstown/town (GREEN)
- Includes sdk:true in health response (GREEN)
- Docker dependencies correct (GREEN)
- Dockerfile CMD references entrypoint-town.js (GREEN)
- Full pipeline composition (verify, price, dispatch) (GREEN)

---

## Test Design Traceability

| ATDD Test ID | Test Name | AC | Test-Design ID | Risk Link | Priority | Level | Status |
|---|---|---|---|---|---|---|---|
| T-2.4-01 | should not have packages/git-proxy directory | #1 | 2.4-UNIT-001 | E2-R011 | P2 | Unit | GREEN |
| T-2.4-02 | should not have any package depending on @crosstown/git-proxy | #1 | 2.4-UNIT-002 | E2-R011 | P2 | Unit | GREEN |
| T-2.4-03 | should not reference @crosstown/git-proxy in pnpm-workspace.yaml | #1 | 2.4-UNIT-003 | E2-R011 | P2 | Unit | GREEN |
| T-2.4-04 | SDK relay entrypoint should import from @crosstown/sdk | #1 | 2.4-UNIT-004 | E2-R011 | P2 | Unit | GREEN |
| T-2.4-05 | docs/api-contracts-git-proxy.md should not exist | #1 | 2.4-UNIT-005 | E2-R011 | P2 | Unit | RED |
| T-2.4-06 | docs/project-scan-report.json should not reference git-proxy | #1 | 2.4-UNIT-006 | E2-R011 | P2 | Unit | RED |
| T-2.4-07 | docs/index.md should not reference git-proxy | #1 | 2.4-UNIT-007 | E2-R011 | P2 | Unit | RED |
| T-2.4-08 | entrypoint-town.ts should have SDK Reference Implementation JSDoc | #2 | 2.4-UNIT-008 | E2-R011 | P2 | Unit | RED |
| T-2.4-09 | entrypoint-town.ts should have inline section comments for pipeline stages | #2, #3 | 2.4-UNIT-009 | E2-R011 | P2 | Unit | RED |

---

## Data Factories Created

N/A -- All tests are static analysis (filesystem existence checks, file content pattern matching). No test data generation needed.

---

## Fixtures Created

N/A -- Static analysis tests use direct filesystem APIs (`existsSync`, `readFileSync`). No fixture setup/teardown needed.

---

## Mock Requirements

N/A -- No mocks. All tests read real filesystem and source files.

---

## Required data-testid Attributes

N/A -- Backend static analysis tests. No browser UI.

---

## Implementation Checklist

### Test: T-2.4-05 `docs/api-contracts-git-proxy.md should not exist`

**File:** `packages/town/src/doc-cleanup-and-reference.test.ts`

**Tasks to make this test pass:**

- [ ] Delete `docs/api-contracts-git-proxy.md`
- [ ] Run test: `npx vitest run packages/town/src/doc-cleanup-and-reference.test.ts -t "T-2.4-05"`
- [ ] Test passes (green phase)

**Estimated Effort:** < 0.1 hours

---

### Test: T-2.4-06 `docs/project-scan-report.json should not reference git-proxy`

**File:** `packages/town/src/doc-cleanup-and-reference.test.ts`

**Tasks to make this test pass:**

- [ ] Remove `git-proxy` entry from `project_types` array
- [ ] Remove `api-contracts-git-proxy.md` from `outputs_generated` array
- [ ] Remove `packages/git-proxy/src` batch from `batches_completed` array
- [ ] Update `project_classification` string to remove git-proxy mention
- [ ] Update `technology_stack` string to remove git-proxy mention
- [ ] Update `completed_steps[0].summary` to reflect current package count
- [ ] Run test: `npx vitest run packages/town/src/doc-cleanup-and-reference.test.ts -t "T-2.4-06"`
- [ ] Test passes (green phase)

**Estimated Effort:** 0.25 hours

---

### Test: T-2.4-07 `docs/index.md should not reference git-proxy`

**File:** `packages/town/src/doc-cleanup-and-reference.test.ts`

**Tasks to make this test pass:**

- [ ] Remove `@crosstown/git-proxy` row from the package table
- [ ] Remove the git-proxy API contracts link
- [ ] Optionally add `@crosstown/sdk` and `@crosstown/town` entries to the package table
- [ ] Run test: `npx vitest run packages/town/src/doc-cleanup-and-reference.test.ts -t "T-2.4-07"`
- [ ] Test passes (green phase)

**Estimated Effort:** 0.25 hours

---

### Test: T-2.4-08 `entrypoint-town.ts should have SDK Reference Implementation JSDoc`

**File:** `packages/town/src/doc-cleanup-and-reference.test.ts`

**Tasks to make this test pass:**

- [ ] Expand the file-level JSDoc comment in `docker/src/entrypoint-town.ts` to include "Reference Implementation"
- [ ] Document what the file demonstrates (SDK-based relay construction)
- [ ] Document the SDK pattern: identity -> pipeline -> handlers -> lifecycle
- [ ] Document why Approach A is used (external connector mode vs embedded)
- [ ] Document which SDK features are exercised
- [ ] Run `pnpm format` (Prettier may reformat JSDoc)
- [ ] Run test: `npx vitest run packages/town/src/doc-cleanup-and-reference.test.ts -t "T-2.4-08"`
- [ ] Test passes (green phase)

**Estimated Effort:** 0.5 hours

---

### Test: T-2.4-09 `entrypoint-town.ts should have inline section comments for pipeline stages`

**File:** `packages/town/src/doc-cleanup-and-reference.test.ts`

**Tasks to make this test pass:**

- [ ] Add inline comments to `createPipelineHandler()`:
  - Identity derivation (`fromSecretKey`) -- explain secp256k1 unified identity
  - Verification pipeline (`createVerificationPipeline`) -- explain Schnorr verification
  - Pricing validator (`createPricingValidator`) -- explain self-write bypass, per-byte pricing
  - Handler registry (`HandlerRegistry`) -- explain `.onDefault()` and `.on(kind)` routing
  - Handler context (`createHandlerContext`) -- explain TOON passthrough, lazy decode
  - Pipeline stages -- explain the 5-stage pipeline
- [ ] Add inline comments to `main()`:
  - EventStore initialization and TOON-native storage
  - Settlement configuration and channel client setup
  - Bootstrap lifecycle (BootstrapService, RelayMonitor, SocialPeerDiscovery)
  - Self-write bypass for kind:10032 peer info publication
  - Graceful shutdown pattern
- [ ] Comments should explain the "why" not the "what"
- [ ] Run `pnpm format` after adding comments
- [ ] Run test: `npx vitest run packages/town/src/doc-cleanup-and-reference.test.ts -t "T-2.4-09"`
- [ ] Test passes (green phase)

**Estimated Effort:** 1.5 hours

---

## Running Tests

```bash
# Run all Story 2.4 tests (existing + new)
npx vitest run packages/town/src/cleanup.test.ts packages/town/src/doc-cleanup-and-reference.test.ts --reporter=verbose

# Run only the new RED tests
npx vitest run packages/town/src/doc-cleanup-and-reference.test.ts --reporter=verbose

# Run a specific test by name
npx vitest run packages/town/src/doc-cleanup-and-reference.test.ts -t "T-2.4-05"

# Run existing GREEN tests (should always pass)
npx vitest run packages/town/src/cleanup.test.ts --reporter=verbose

# Run verification-only tests from Story 2.3
npx vitest run packages/town/src/sdk-entrypoint-validation.test.ts --reporter=verbose

# Run full test suite
pnpm test

# Run with coverage
pnpm test:coverage

# Run full quality checks
pnpm build && pnpm test && pnpm lint && pnpm format:check
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**

- 5 new failing tests written in `packages/town/src/doc-cleanup-and-reference.test.ts`
- Tests cover stale documentation cleanup (T-2.4-05 to T-2.4-07)
- Tests cover reference implementation documentation (T-2.4-08, T-2.4-09)
- All tests fail for correct reasons (missing implementation, not test bugs)
- Existing tests (cleanup.test.ts, sdk-entrypoint-validation.test.ts) remain GREEN

**Verification:**

- All 5 new tests run and fail as expected
- Failure messages are clear and actionable
- No existing tests broken (38 passing, 15 skipped, 5 failing = only new tests)

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. **Start with documentation cleanup (AC #1)** -- easiest tests to turn GREEN:
   - Delete `docs/api-contracts-git-proxy.md` -> T-2.4-05 GREEN
   - Update `docs/project-scan-report.json` (remove 6 git-proxy references) -> T-2.4-06 GREEN
   - Update `docs/index.md` (remove package table row and API link) -> T-2.4-07 GREEN
2. **Then add reference implementation documentation (AC #2, #3):**
   - Expand file-level JSDoc in `docker/src/entrypoint-town.ts` -> T-2.4-08 GREEN
   - Add inline section comments for all SDK pipeline stages -> T-2.4-09 GREEN
3. **Run `pnpm format`** after adding JSDoc/comments (Prettier compliance)
4. **Verify all tests pass:**
   ```bash
   npx vitest run packages/town/src/doc-cleanup-and-reference.test.ts packages/town/src/cleanup.test.ts packages/town/src/sdk-entrypoint-validation.test.ts --reporter=verbose
   ```
5. **Run full quality checks:** `pnpm build && pnpm test && pnpm lint && pnpm format:check`

**Key Principles:**

- One test at a time (start with T-2.4-05, easiest)
- Do NOT change any functional code in entrypoint-town.ts (documentation only)
- Do NOT modify existing tests (cleanup.test.ts and sdk-entrypoint-validation.test.ts)
- Comments should explain "why" not "what"
- Run `pnpm format` after adding JSDoc/comments

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

- Verify all 9 Story 2.4 tests pass (4 existing + 5 new)
- Verify all 7 Story 2.3 verification tests pass
- Search for any additional git-proxy references beyond documented locations
- Ensure documentation reads naturally and provides value to developers
- Run full suite: `pnpm build && pnpm test && pnpm lint && pnpm format:check`

---

## Risk Mitigations

- **E2-R011 (Package dependency cleanliness -- stale git-proxy references, score 2):** Low risk. New tests T-2.4-05 through T-2.4-07 provide automated regression coverage for stale documentation cleanup. The dev agent should also search for any additional `git-proxy` string occurrences beyond the three documented files.

---

## Adaptations from Standard Checklist

The standard ATDD checklist is oriented toward API/E2E tests with browser automation. Adaptations for this static analysis story:

- `test.skip()` -> Not used (tests fail naturally since implementation is not done)
- `test.extend()` fixtures -> N/A (no fixtures needed for static checks)
- `data-testid` selectors -> N/A (no browser/DOM tests)
- `page.route()` network-first -> N/A (no network requests)
- Playwright/Cypress config -> `vitest.config.ts`
- API endpoints -> N/A (filesystem and source code analysis)
- Data factories -> N/A (no test data generation)
- Subprocesses (API + E2E parallel) -> Single test file (all static analysis)

---

## Validation Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Story approved with clear acceptance criteria | PASS | 3 ACs from story markdown |
| Test framework configuration available | PASS | vitest.config.ts at root + package level |
| All ACs identified and extracted | PASS | AC #1 (cleanup), AC #2 (JSDoc), AC #3 (SDK features) |
| Test level selection framework applied | PASS | Unit (static analysis) for file/doc checks |
| Duplicate coverage avoided | PASS | New tests cover gaps not tested by existing tests |
| Tests prioritized P0-P2 | PASS | All P2 (low risk cleanup/documentation) |
| Test files organized in correct directories | PASS | Co-located in packages/town/src/ |
| Tests have descriptive names | PASS | Names include test ID and expected behavior |
| No placeholder assertions | PASS | All assertions test real behavior |
| Tests are isolated (no shared state) | PASS | Each test reads filesystem independently |
| Tests are deterministic | PASS | Same filesystem state -> same result |
| RED phase verified | PASS | 5/5 new tests fail with correct messages |
| Real infra preferred over mocks | PASS | Direct filesystem access |
| No orphaned browser sessions | N/A | Backend stack |
| Temp artifacts in test_artifacts/ | PASS | Output at correct path |
| Existing tests not broken | PASS | 38 existing tests still pass |

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `npx vitest run packages/town/src/doc-cleanup-and-reference.test.ts --reporter=verbose`

**Results:**

```
 x T-2.4-05: docs/api-contracts-git-proxy.md should not exist
   -> file still exists (not yet deleted)
 x T-2.4-06: docs/project-scan-report.json should not reference git-proxy
   -> file contains git-proxy references in 6 locations
 x T-2.4-07: docs/index.md should not reference git-proxy
   -> file contains git-proxy package table row and API link
 x T-2.4-08: entrypoint-town.ts should have SDK Reference Implementation JSDoc
   -> file-level JSDoc lacks "reference implementation"
 x T-2.4-09: entrypoint-town.ts should have inline section comments for pipeline stages
   -> only 35 comment lines (needs >= 40), missing SDK pattern keywords

Test Files  1 failed (1)
Tests       5 failed (5)
```

**Summary:**

- Total new tests: 5
- Passing: 0 (expected)
- Failing: 5 (expected)
- Status: RED phase verified

### Existing Tests (GREEN Baseline)

**Command:** `npx vitest run packages/town/src/cleanup.test.ts packages/town/src/sdk-entrypoint-validation.test.ts --reporter=verbose`

**Results:**

```
Test Files  2 passed (2)
Tests       11 passed (11)
```

---

## Completion Summary

**ATDD Workflow Complete -- TDD RED Phase**

| Metric | Value |
|--------|-------|
| Stories covered | 1 (Story 2.4) |
| Total tests (new) | 5 |
| Total tests (existing, GREEN) | 4 (cleanup.test.ts) |
| Total tests (verification-only, GREEN) | 7 (sdk-entrypoint-validation.test.ts) |
| Unit/static tests | 5 (all new) |
| Test files created | 1 (`packages/town/src/doc-cleanup-and-reference.test.ts`) |
| Total lines (new file) | 206 |
| P2 tests | 9 (4 existing + 5 new) |
| Shared fixture files | 0 |
| Mock count | 0 |
| Knowledge fragments applied | 5 (data-factories, test-quality, test-healing-patterns, test-levels-framework, test-priorities-matrix) |
| Estimated total effort | ~2.5 hours (to move all 5 tests from RED to GREEN) |

**Output file:** `_bmad-output/test-artifacts/atdd-checklist-2.4.md`

**Next recommended workflow:** Run `bmad-bmm-dev-story` for Story 2.4 to move tests from RED to GREEN.

---

## Knowledge Base References Applied

- **data-factories.md** -- Confirmed no factories needed (static analysis uses filesystem APIs)
- **test-quality.md** -- Tests follow: deterministic, isolated, explicit assertions, descriptive names, no hard waits
- **test-levels-framework.md** -- All tests are Unit level (static analysis, no runtime dependencies)
- **test-priorities-matrix.md** -- All P2 (cleanup/documentation, risk score 2)
- **test-healing-patterns.md** -- Graceful fallback for missing files (`existsSync` guard before `readFileSync`)

See `tea-index.csv` for complete knowledge fragment mapping.

---

## Notes

- Story 2.4 originally stated "This story adds no new test files." The ATDD workflow identified 5 gaps in AC coverage and created tests for them. The new tests cover stale documentation cleanup (AC #1 gap) and reference implementation documentation verification (AC #2, #3 gap).
- The `archive/compose-experiments/docker-compose-with-local.yml` file contains a commented-out git-proxy service definition (lines 250-295). Per story guidance, this is acceptable as archived historical reference and no change is needed. The tests do NOT check archive files.
- T-2.4-09 uses a comment line count threshold (>= 40) and keyword matching to verify that sufficient documentation was added. This is a heuristic -- the dev agent should verify the documentation quality manually beyond what the automated test checks.
- All tests use `resolve(__dirname, '..', '..', '..')` to find the repo root, consistent with the pattern established in `cleanup.test.ts`.

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-03-06 | 1.0 | Initial ATDD checklist via TEA ATDD workflow (YOLO mode). Created 5 new RED tests for AC coverage gaps: stale doc cleanup (T-2.4-05 to T-2.4-07) and reference implementation docs (T-2.4-08, T-2.4-09). | TEA (Claude Opus 4.6) |

---

**Generated by BMad TEA Agent** - 2026-03-06
