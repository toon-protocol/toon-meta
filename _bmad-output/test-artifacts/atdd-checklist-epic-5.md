---
stepsCompleted:
  [
    'step-01-preflight-and-context',
    'step-02-generation-mode',
    'step-03-test-strategy',
    'step-04c-aggregate',
    'step-05-validate-and-complete',
  ]
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-03-04'
workflowType: 'testarch-atdd'
inputDocuments:
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/test-artifacts/test-design-epic-5.md
  - _bmad/tea/testarch/knowledge/data-factories.md
  - _bmad/tea/testarch/knowledge/test-quality.md
  - _bmad/tea/testarch/knowledge/test-levels-framework.md
  - _bmad/tea/testarch/knowledge/test-priorities-matrix.md
---

# ATDD Checklist - Epic 5: The Rig (ILP-Gated TypeScript Git Forge)

**Date:** 2026-03-04
**Author:** Jonathan
**Primary Test Level:** Unit + Integration (backend stack)
**TDD Phase:** RED (all tests skipped)

---

## Preflight Summary

### Stack Detection

- **Detected stack:** `backend`
- **Test framework:** Vitest (`vitest.config.ts` at root)
- **Test pattern:** Co-located `*.test.ts` files, `__integration__/` for integration tests
- **Conventions:** AAA pattern, `it.skip('[P0]')` priority tags, factory functions, `vi.fn()` mocks

### Stories in Scope

All 12 stories in Epic 5 (5.1 through 5.12):

- 5.1: SDK Node Setup and Repository Creation Handler
- 5.2: Patch Handler
- 5.3: Issue and Comment Handlers
- 5.4: Git HTTP Backend for Clone and Fetch
- 5.5: Nostr Pubkey-Native Git Identity
- 5.6: NIP-34 Status Events and PR Lifecycle
- 5.7: Layout and Repository List Page
- 5.8: File Tree and Blob View
- 5.9: Commit Log and Diff View
- 5.10: Blame View
- 5.11: Issues and PRs from Nostr Events on Relay
- 5.12: Publish @crosstown/rig Package

### Test Design Reference

- 39 tests planned (11 P0, 13 P1, 10 P2, 5 P3)
- Source: `_bmad-output/test-artifacts/test-design-epic-5.md`

### Knowledge Fragments Loaded

- `data-factories.md` - Factory pattern with overrides
- `test-quality.md` - Deterministic, isolated, explicit assertions
- `test-levels-framework.md` - Unit vs Integration vs E2E selection
- `test-priorities-matrix.md` - P0-P3 prioritization

---

## TDD Red Phase: Test Generation Results

### Summary Statistics

| Metric            | Count                    |
| ----------------- | ------------------------ |
| **Total Tests**   | 104 (all with `it.skip`) |
| Unit Tests        | 72 (7 files)             |
| Integration Tests | 32 (6 files)             |
| **P0 (Critical)** | 42                       |
| **P1 (High)**     | 31                       |
| **P2 (Medium)**   | 18                       |
| **P3 (Low)**      | 13                       |

### TDD Red Phase Compliance

- [x] All 104 tests use `it.skip('[PX]')` pattern
- [x] Zero placeholder assertions (`expect(true).toBe(true)`)
- [x] All tests assert expected behavior (real assertions against implementation)
- [x] All tests follow AAA (Arrange/Act/Assert) pattern
- [x] Factory functions used for test data (no hardcoded values)
- [x] Tests are deterministic and isolated

---

## Generated Test Files

### Unit Tests (72 tests, 7 files)

| File                                                      | Tests | Priorities | Stories Covered     |
| --------------------------------------------------------- | ----- | ---------- | ------------------- |
| `packages/rig/src/git/operations.test.ts`                 | 19    | P0         | 5.1, 5.2, 5.4       |
| `packages/rig/src/handlers/repo-creation-handler.test.ts` | 5     | P0, P1, P2 | 5.1                 |
| `packages/rig/src/handlers/issue-comment-handler.test.ts` | 6     | P1         | 5.3                 |
| `packages/rig/src/identity/pubkey-identity.test.ts`       | 12    | P0, P1, P2 | 5.5                 |
| `packages/rig/src/handlers/pr-lifecycle-handler.test.ts`  | 7     | P0, P1     | 5.6                 |
| `packages/rig/src/web/templates.test.ts`                  | 14    | P0, P2, P3 | 5.7, 5.8, 5.9, 5.10 |
| `packages/rig/src/index.test.ts`                          | 9     | P3         | 5.12                |

### Integration Tests (32 tests, 6 files)

| File                                                         | Tests | Priorities | Stories Covered     |
| ------------------------------------------------------------ | ----- | ---------- | ------------------- |
| `packages/rig/src/__integration__/repo-creation.test.ts`     | 6     | P0, P1     | 5.1                 |
| `packages/rig/src/__integration__/patch-handler.test.ts`     | 5     | P0, P1     | 5.2                 |
| `packages/rig/src/__integration__/pr-lifecycle.test.ts`      | 6     | P0, P1     | 5.6                 |
| `packages/rig/src/__integration__/git-http-backend.test.ts`  | 4     | P1, P3     | 5.4                 |
| `packages/rig/src/__integration__/web-routes.test.ts`        | 6     | P1, P2     | 5.7, 5.8, 5.9, 5.10 |
| `packages/rig/src/__integration__/relay-integration.test.ts` | 5     | P2         | 5.11                |

---

## Acceptance Criteria Coverage

### Story 5.1: SDK Node Setup and Repository Creation Handler

- [x] kind:30617 triggers `git init --bare` (unit + integration)
- [x] Repo name validation (path traversal, null bytes, shell metacharacters)
- [x] Unsupported NIP-34 kinds rejected
- [x] SQLite metadata persistence

### Story 5.2: Patch Handler

- [x] kind:1617 applies patch via `git am` (integration)
- [x] Binary/oversized/malformed patches rejected (unit)
- [x] Path traversal in patches rejected (unit)
- [x] `execFile` only enforcement (no `exec/spawn`)

### Story 5.3: Issue and Comment Handlers

- [x] kind:1621 creates issue (unit)
- [x] kind:1622 creates comment (unit)
- [x] Non-existent repo rejection (unit)

### Story 5.4: Git HTTP Backend for Clone and Fetch

- [x] HTTP clone via `git-upload-pack` (integration)
- [x] HTTP push rejected (unit + integration)
- [x] Content negotiation (integration)

### Story 5.5: Nostr Pubkey-Native Git Identity

- [x] Maintainer authorization via pubkey (unit)
- [x] Non-maintainer F06 rejection (unit)
- [x] Git author format from npub (unit)
- [x] kind:0 profile enrichment (unit)

### Story 5.6: NIP-34 Status Events and PR Lifecycle

- [x] Maintainer-only merge authorization (unit + integration)
- [x] Status event state machine transitions (unit + integration)
- [x] Invalid state transitions rejected (unit)

### Story 5.7: Layout and Repository List Page

- [x] Repository list rendering (unit + integration)
- [x] Empty state handling (unit)
- [x] Contribution banner display (unit)

### Story 5.8: File Tree and Blob View

- [x] File tree rendering (integration)
- [x] Blob content display (integration)
- [x] XSS escaping in filenames (unit)

### Story 5.9: Commit Log and Diff View

- [x] Commit log rendering (integration)
- [x] Diff view display (integration)

### Story 5.10: Blame View

- [x] Blame view rendering (integration)
- [x] 404 error page (unit)

### Story 5.11: Issues and PRs from Nostr Events on Relay

- [x] Issues fetched from relay (integration)
- [x] PRs fetched from relay (integration)
- [x] Comment chronological order (integration)
- [x] Relay unavailable degradation (integration)

### Story 5.12: Publish @crosstown/rig Package

- [x] `startRig` exported (unit)
- [x] `RigConfig` type exported (unit)
- [x] CLI flag parsing (unit)

---

## Security Risk Coverage

| Risk ID | Risk                  | Test Coverage                                                       |
| ------- | --------------------- | ------------------------------------------------------------------- |
| E5-R001 | Git command injection | `operations.test.ts`: execFile-only, no exec/spawn (19 tests)       |
| E5-R002 | Authorization bypass  | `pubkey-identity.test.ts`: maintainer auth (12 tests)               |
| E5-R003 | Path traversal        | `operations.test.ts`: repo name + patch path validation             |
| E5-R004 | XSS in web UI         | `templates.test.ts`: HTML escaping for filenames/content (14 tests) |
| E5-R005 | Malformed patches     | `operations.test.ts`: binary, oversized, empty patch rejection      |

---

## Data Factories Created

Factory functions are co-located within test files (following existing project conventions):

| Factory                      | Location                | Purpose                                |
| ---------------------------- | ----------------------- | -------------------------------------- |
| `createMockHandlerContext()` | Unit test files         | Mock SDK HandlerContext with overrides |
| `createMockEvent()`          | Unit test files         | Create NIP-34 event objects            |
| `createTestRepo()`           | Integration test files  | Set up bare git repos for testing      |
| `createPatchEvent()`         | `patch-handler.test.ts` | Create kind:1617 patch events          |
| `createRepoCreationEvent()`  | `repo-creation.test.ts` | Create kind:30617 events               |

All factories support `Partial<T>` overrides for test-specific customization.

---

## Implementation Checklist (TDD Green Phase)

After implementing the Rig package, developers should follow this sequence:

### Phase 1: Core Infrastructure (P0 tests)

1. [ ] Implement `git/operations.ts` — `execFile`-based git command runner with input validation
2. [ ] Implement `handlers/repo-creation-handler.ts` — kind:30617 handler
3. [ ] Implement `identity/pubkey-identity.ts` — Nostr pubkey authorization and git identity
4. [ ] Implement `handlers/pr-lifecycle-handler.ts` — merge authorization and status events
5. [ ] Remove `it.skip` from P0 tests, run: `pnpm vitest packages/rig/src --reporter=verbose`
6. [ ] All 42 P0 tests should PASS

### Phase 2: Handler Coverage (P1 tests)

7. [ ] Implement `handlers/issue-comment-handler.ts` — kind:1621/1622 handlers
8. [ ] Implement `handlers/patch-handler.ts` — kind:1617 handler with `git am`
9. [ ] Implement `git/http-backend.ts` — git-upload-pack HTTP handler
10. [ ] Implement `web/templates.ts` — Eta template rendering
11. [ ] Remove `it.skip` from P1 tests, verify 31 P1 tests PASS

### Phase 3: Web UI and Relay (P2 tests)

12. [ ] Implement web routes (repo list, file tree, blob, commit log, diff, blame)
13. [ ] Implement relay integration for issues/PRs
14. [ ] Remove `it.skip` from P2 tests, verify 18 P2 tests PASS

### Phase 4: Package Publishing (P3 tests)

15. [ ] Configure `package.json` exports and CLI entrypoint
16. [ ] Remove `it.skip` from P3 tests, verify 13 P3 tests PASS

### Execution Commands

```bash
# Run all unit tests
pnpm vitest packages/rig/src --exclude='**/__integration__/**' --reporter=verbose

# Run all integration tests
pnpm vitest packages/rig/src/__integration__ --reporter=verbose

# Run specific test file
pnpm vitest packages/rig/src/git/operations.test.ts --reporter=verbose

# Run with filter
pnpm vitest packages/rig/src -t "P0" --reporter=verbose
```

---

## Validation Checklist

### Prerequisites

- [x] Stories have clear acceptance criteria
- [x] Vitest configured (`vitest.config.ts`)
- [x] Development environment ready (monorepo with pnpm workspaces)

### Test Quality

- [x] All tests use AAA (Arrange/Act/Assert) structure
- [x] All tests have descriptive names explaining what they test
- [x] No duplicate tests
- [x] No flaky patterns (no timeouts, no shared state)
- [x] Tests are deterministic
- [x] Tests can run in any order (isolated)
- [x] Factory functions used (no hardcoded test data)

### Red Phase Verification

- [x] All 104 tests use `it.skip('[PX]')` — confirmed by grep
- [x] Zero placeholder assertions — confirmed by grep
- [x] All tests will fail until implementation exists
- [x] Failure is due to missing implementation, not test bugs

### Test Design Integration

- [x] P0 scenarios from test-design prioritized
- [x] All 5 security risks (E5-R001 through E5-R005) covered
- [x] Coverage expanded from 39 planned to 104 actual tests
- [x] All 12 stories have test coverage

---

## Completion Summary

**ATDD workflow complete for Epic 5 (TDD RED phase).**

- **104 failing tests** generated across 13 files
- **All tests use `it.skip`** — ready for implementation team
- **All 12 stories** covered with unit + integration tests
- **All 5 security risks** addressed in test suite
- **Priority distribution:** 42 P0, 31 P1, 18 P2, 13 P3

### Key Risks and Assumptions

- Tests assume `packages/rig/` will be the package directory (not yet created as production code)
- Integration tests assume SQLite for metadata storage
- Web template tests assume Eta as the template engine
- Git operations tests assume `execFile` (not `exec`) for security

### Next Recommended Workflow

1. **Sprint Planning** (`/bmad-bmm-sprint-planning`) — plan implementation sprints for Epic 5
2. **Story Implementation** (`/bmad-bmm-dev-story`) — implement stories starting with 5.1
3. **Test Automation** (`/bmad-tea-testarch-automate`) — expand coverage after green phase

### Output Path

`_bmad-output/test-artifacts/atdd-checklist-epic-5.md`
