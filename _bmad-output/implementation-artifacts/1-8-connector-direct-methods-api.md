# Story 1.8: Connector Direct Methods API

Status: done

## Story

As a **service developer**,
I want to access the embedded connector's peer management and channel operations through the node,
So that I can programmatically manage peers and payment channels for advanced use cases.

**FRs covered:** FR-SDK-8 (Connector direct methods API: pass-through for peer management, packet sending, and channel operations)

**Dependencies:** Story 1.7 (createNode composition -- `createNode()` and `ServiceNode` must exist before connector API tests can run)

## Acceptance Criteria

1. Given a created node, when I access `node.connector`, then `registerPeer()`, `removePeer()`, and `sendPacket()` are available as callable methods (pass-through to the underlying `EmbeddableConnectorLike`)
2. Given a created node, when I access `node.connector.removePeer`, then it is a function -- confirming the full required surface of `EmbeddableConnectorLike` is exposed without wrapping
3. Given a connector **without** `openChannel`/`getChannelState` methods (older connector version), when I access `node.channelClient`, then it returns `null`
4. Given a connector **with** `openChannel` and `getChannelState` methods, when I access `node.channelClient`, then it returns a non-null object with both methods callable

## Tasks / Subtasks

- [x] Task 1: Remove `connector-api.test.ts` from vitest exclude (AC: #1-#4)
  - [x] In `packages/sdk/vitest.config.ts`, remove the line `'src/connector-api.test.ts',` from the `exclude` array (line 22)
  - [x] Update the ATDD comment to mark Story 1.8 as done: `//   connector-api.test.ts    -> Story 1.8 (done)`
  - [x] Do NOT remove `src/dev-mode.test.ts` -- that belongs to Story 1.10

- [x] Task 2: Enable ATDD tests and remove `@ts-nocheck` (AC: #1, #2, #3, #4)
  - [x] In `packages/sdk/src/connector-api.test.ts`, remove the `// @ts-nocheck` pragma on line 1 (full text: `// @ts-nocheck — ATDD Red Phase: imports reference exports that don't exist yet` -- these exports now exist from Story 1.7)
  - [x] Change all 4 `it.skip(` calls to `it(` (remove `.skip`)
  - [x] Update the stale ATDD Red Phase comment (line 5) from `// ATDD Red Phase - tests will fail until implementation exists` to `// ATDD tests for Story 1.8 -- connector direct methods API`
  - [x] **Priority label fix #1:** ATDD test 1 is labeled `[P0]` but test-design T-1.8-01 is P2. Update from `'[P0] node.connector exposes registerPeer method'` to `'[P2] node.connector exposes registerPeer method'`
  - [x] **Priority label fix #2:** ATDD test 2 is labeled `[P0]` but test-design T-1.8-01 is P2. Update from `'[P0] node.connector exposes removePeer method'` to `'[P2] node.connector exposes removePeer method'`
  - [x] **Priority label fix #3:** ATDD test 3 is labeled `[P1]` but test-design T-1.8-02 is P2. Update from `'[P1] node.channelClient is null when connector lacks channel support'` to `'[P2] node.channelClient is null when connector lacks channel support'`
  - [x] **Priority label fix #4:** ATDD test 4 is labeled `[P1]` but test-design T-1.8-03 is P2. Update from `'[P1] node.channelClient is available when connector has channel methods'` to `'[P2] node.channelClient is available when connector has channel methods'`
  - [x] The ATDD Red Phase has 4 tests. The mapping from test-design-epic-1.md IDs to ATDD test file is:
    - ATDD test 1 [P2]: `node.connector` exposes `registerPeer` method (AC: #1) -- covers test-design T-1.8-01 partially (priority fix: [P0]->[P2])
    - ATDD test 2 [P2]: `node.connector` exposes `removePeer` method (AC: #2) -- covers test-design T-1.8-01 partially (priority fix: [P0]->[P2])
    - ATDD test 3 [P2]: `node.channelClient` is null when connector lacks channel support (AC: #3) -- covers test-design T-1.8-02 (priority fix: [P1]->[P2])
    - ATDD test 4 [P2]: `node.channelClient` is available when connector has channel methods (AC: #4) -- covers test-design T-1.8-03 (priority fix: [P1]->[P2])

- [x] Task 3: Add missing test for `sendPacket` exposure (AC: #1, test-design T-1.8-01)
  - [x] Add test [P2] for `node.connector.sendPacket` being available:

    ```typescript
    it('[P2] node.connector exposes sendPacket method', () => {
      // Arrange
      const config = createTestConfig();

      // Act
      const node = createNode(config);

      // Assert
      expect(typeof node.connector.sendPacket).toBe('function');
    });
    ```

  - [x] Place this test within the existing `describe('Connector Direct Methods API', ...)` block, after the existing ATDD tests
  - [x] This completes T-1.8-01 coverage: all three methods (`registerPeer`, `removePeer`, `sendPacket`) are verified

- [x] Task 4: Run tests and verify (AC: #1-#4)
  - [x] Run `cd packages/sdk && pnpm test` -- all connector-api tests pass (4 ATDD + 1 gap-filling = 5 total)
  - [x] Expected SDK unit test count: 100 (from Story 1.7) + 5 (this story: 4 ATDD + 1 gap) = 105 total
  - [x] Verify no test regressions: `pnpm -r test` from project root
  - [x] Verify TypeScript compiles without errors: `cd packages/sdk && npx tsc --noEmit`

## Dev Notes

### What This Story Does

Enables 4 skipped ATDD tests in `connector-api.test.ts` (fixing all 4 priority labels to match test-design P2), removes `@ts-nocheck`, updates the stale ATDD comment, adds 1 new test for `sendPacket` exposure, and removes the vitest exclude entry. The underlying implementation already exists in `create-node.ts` (Story 1.7) -- this story verifies the connector pass-through API surface and channel client conditional exposure.

### What Already Exists

**Implementation (in `packages/sdk/src/create-node.ts`):**

The `createNode()` function already returns a `ServiceNode` with:
- `node.connector` -- getter that returns `config.connector` (direct pass-through, line ~293)
- `node.channelClient` -- getter that delegates to `toonNode.channelClient` (line ~296), which is `null` if the connector lacks `openChannel`/`getChannelState` methods (see `packages/core/src/compose.ts` lines 302-310)

The `ServiceNode` interface (lines 98-115) already declares:
```typescript
readonly connector: EmbeddableConnectorLike;
readonly channelClient: ConnectorChannelClient | null;
```

**ATDD test file (in `packages/sdk/src/connector-api.test.ts`):**

4 skipped tests with `@ts-nocheck` pragma (line 1: `// @ts-nocheck — ATDD Red Phase: imports reference exports that don't exist yet`). Uses:
- `createMockConnector()` -- returns mock with `sendPacket`, `registerPeer`, `removePeer`, `setPacketHandler`
- `createTestConfig()` -- returns `{ secretKey, connector, ilpAddress, assetCode, assetScale }`
- Tests verify `node.connector` method types and `node.channelClient` null/non-null behavior

**vitest.config.ts (in `packages/sdk/vitest.config.ts`):**

Line 22: `'src/connector-api.test.ts',` in the exclude array, with comment on line 20: `//   connector-api.test.ts    -> Story 1.8 (uses createNode, available after 1.7)`

**Core types (in `packages/core/src/compose.ts`):**

`EmbeddableConnectorLike` interface (lines 109-148):
- `sendPacket(params): Promise<SendPacketResult>` -- required
- `registerPeer(params): Promise<void>` -- required
- `removePeer(peerId): Promise<void>` -- required
- `setPacketHandler?(handler): void` -- optional
- `openChannel?(params): Promise<{channelId, status}>` -- optional
- `getChannelState?(channelId): Promise<{channelId, status, chain}>` -- optional

`ConnectorChannelClient` interface (in `packages/core/src/types.ts` lines 144-149):
- `openChannel(params): Promise<OpenChannelResult>`
- `getChannelState(channelId): Promise<ChannelState>`

### Previous Story Insights

[Source: `_bmad-output/implementation-artifacts/1-7-createnode-composition-with-embedded-connector-lifecycle.md`]

- Story 1.7 explicitly noted: "Do NOT unskip `connector-api.test.ts` tests. These 4 tests are Story 1.8 scope."
- `createNode()` passes `config.connector` through unchanged as `node.connector`
- `channelClient` is delegated to `toonNode.channelClient` (from `@toon-protocol/core` compose)
- Story 1.7 added 100 unit tests and 16 integration tests -- all passing
- `packages/sdk/vitest.config.ts` has `'src/connector-api.test.ts'` in the exclude array with comment: `//   connector-api.test.ts    -> Story 1.8 (uses createNode, available after 1.7)`

### Architecture Compliance

- `connector` is a pass-through -- do NOT wrap or modify the connector object
- `channelClient` detection happens in `@toon-protocol/core/compose.ts` via `createDirectChannelClient()` -- the SDK does not duplicate this logic
- All tests use mocks (no real connector or relay) -- consistent with unit test strategy (NFR-SDK-6)

### Coding Standards

| Element | Convention | Example |
| --- | --- | --- |
| Test file | co-located | `connector-api.test.ts` |
| Mock factory | camelCase | `createMockConnector()` |
| Test description | `[P2]` priority prefix (per test-design) | `'[P2] node.connector exposes registerPeer method'` |

**Critical:**
- Never use `any` -- use `unknown` and type guards
- Follow AAA pattern (Arrange, Act, Assert) in all tests
- Use `as unknown as X` casting pattern for mocks
- Explicit imports from `vitest`: `import { describe, it, expect, vi } from 'vitest'`
- ESM `.js` extensions in imports

### Testing

**Framework:** Vitest 1.x

**File:** `packages/sdk/src/connector-api.test.ts` (modify existing)

**Test count after this story:** ~105 SDK unit tests (100 from Story 1.7 + 5 from this story)

### Test Design

[Source: `_bmad-output/planning-artifacts/test-design-epic-1.md#Story 1.8`]

| Test ID  | Test Description                                                                | Level | Risk   | Priority | Status                | ATDD File              |
| -------- | ------------------------------------------------------------------------------- | ----- | ------ | -------- | --------------------- | ---------------------- |
| T-1.8-01 | `node.connector` exposes registerPeer, removePeer, sendPacket                   | U     | E1-R13 | P2       | Existing (.skip) + 1 new | `connector-api.test.ts` |
| T-1.8-02 | `node.channelClient` is null when connector lacks channel support               | U     | -      | P2       | Existing (.skip)      | `connector-api.test.ts` |
| T-1.8-03 | `node.channelClient` is non-null when connector has openChannel/getChannelState | U     | -      | P2       | Existing (.skip)      | `connector-api.test.ts` |

**Risk E1-R13** (score 4, medium): ConnectorNodeLike structural type drifts from real ConnectorNode. Mitigated by type-checking tests that verify method existence on `node.connector`.

**Priority label fixes:** All 4 ATDD tests have wrong priority labels. Test-design assigns P2 to all three test IDs (T-1.8-01, T-1.8-02, T-1.8-03). ATDD file has [P0] on tests 1-2 and [P1] on tests 3-4. All must be updated to [P2].

### Previous Story Learnings (from Stories 1.4, 1.5, 1.6, 1.7)

- `vitest.config.ts` does NOT use `globals: true` -- all test files explicitly import from `vitest`
- ESM imports use `.js` extensions: `import { createNode } from './index.js'`
- When enabling tests, do NOT modify the existing test logic -- just remove `.skip` (and fix priority labels)
- TypeScript strict mode with `noPropertyAccessFromIndexSignature` is active
- Update stale ATDD Red Phase comments to reflect current state (per Story 1.3 review precedent)
- No `any` type -- use `unknown` with type guards (enforced by ESLint)
- Priority label mismatches between ATDD test files and test-design must be fixed (precedent: Stories 1.4 and 1.5)

### Project Structure Notes

Files to modify:
```
packages/sdk/
├── src/
│   └── connector-api.test.ts        # Enable tests, remove @ts-nocheck, fix priority labels (modify)
└── vitest.config.ts                  # Remove exclude entry, update ATDD comment (modify)
```

No new files need to be created. No source code changes required -- only test enablement and label corrections.

### Git Intelligence

Last 5 commits follow pattern: `feat(<story-id>): <description>`

Recent commits:
- `feat(1-7): implement createNode composition with embedded connector lifecycle`
- `feat(1-6): implement PaymentHandler bridge with transit semantics`
- `feat(1-5): enable pricing validation with self-write bypass`
- `feat(1-4): enable Schnorr signature verification pipeline`
- `feat(1-3): enable HandlerContext with TOON passthrough and lazy decode`

Expected commit: `feat(1-8): enable connector direct methods API tests`

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 1.8: Connector Direct Methods API`]
- [Source: `_bmad-output/planning-artifacts/epics.md#FR Coverage Map` -- FR-SDK-8: Epic 1, Story 1.8]
- [Source: `_bmad-output/planning-artifacts/test-design-epic-1.md#Story 1.8`]
- [Source: `packages/sdk/src/create-node.ts` lines 98-115, 285-310]
- [Source: `packages/core/src/compose.ts` lines 109-148, 302-310]
- [Source: `packages/core/src/types.ts` lines 144-149]
- [Source: `_bmad-output/implementation-artifacts/1-7-createnode-composition-with-embedded-connector-lifecycle.md#Task 4`]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

None -- all tests passed on first run with no debugging required.

### Completion Notes List

- **Task 1 (vitest exclude):** Verified `connector-api.test.ts` was already removed from `vitest.config.ts` exclude array and ATDD comment updated to "done". `dev-mode.test.ts` remains excluded for Story 1.10.
- **Task 2 (enable ATDD tests):** Verified `@ts-nocheck` pragma was already removed, all 4 `.skip` markers removed, ATDD Red Phase comment updated, and all 4 priority labels corrected from [P0]/[P1] to [P2].
- **Task 3 (sendPacket test):** Verified gap-filling test for `node.connector.sendPacket` was already added as the 5th test in the describe block.
- **Task 4 (test verification):** All 13 connector-api tests pass (4 ATDD + 9 gap-filling). SDK total: 113 tests (9 files). Full monorepo: all test suites pass. TypeScript compiles without errors (`tsc --noEmit` clean).

**Note:** All implementation was already committed in `79150b5` (`feat(1-8): enable connector direct methods API tests`). This verification session confirmed correctness and updated the story artifact.

### File List

- `packages/sdk/src/connector-api.test.ts` -- modified (removed @ts-nocheck, removed .skip, fixed priority labels, added sendPacket test)
- `packages/sdk/vitest.config.ts` -- modified (removed exclude entry, updated ATDD comment)
- `_bmad-output/implementation-artifacts/1-8-connector-direct-methods-api.md` -- modified (task checkboxes, status, Dev Agent Record)

### Change Log

| Date | Summary |
| --- | --- |
| 2026-03-05 | Verified Story 1.8 implementation (already committed in 79150b5). All 13 connector-api tests pass: 4 ATDD tests (registerPeer, removePeer, channelClient null, channelClient non-null) + 9 gap-filling tests (sendPacket, identity check, delegation tests, edge cases). Priority labels fixed [P0]/[P1] -> [P2]. SDK total: 113 tests (9 files). Full monorepo green. Updated story artifact with task completion checkboxes and Dev Agent Record. |

## Code Review Record

### Review Pass #1

| Field | Value |
| --- | --- |
| **Date** | 2026-03-05 |
| **Reviewer Model** | Claude Opus 4.6 (claude-opus-4-6) |
| **Issues Found** | Critical: 0, High: 0, Medium: 0, Low: 0 |
| **Total Issues** | 0 |
| **Fixes Applied** | 0 |
| **Files Modified** | None |
| **Outcome** | Pass -- no issues found |

### Review Pass #2

| Field | Value |
| --- | --- |
| **Date** | 2026-03-05 |
| **Reviewer Model** | Claude Opus 4.6 (claude-opus-4-6) |
| **Issues Found** | Critical: 0, High: 0, Medium: 0, Low: 1 |
| **Total Issues** | 1 |
| **Fixes Applied** | 1 |
| **Files Modified** | `_bmad-output/implementation-artifacts/1-8-connector-direct-methods-api.md` |
| **Outcome** | Pass -- 1 low-severity documentation issue fixed |

**LOW-1 (fixed): Stale test count in artifact documentation.**
The Completion Notes and Change Log reported "5 connector-api tests" and "SDK total: 105 tests" but the actual file contains 13 tests (4 ATDD + 9 gap-filling) with an SDK total of 113 tests (9 files). The 8 additional gap-filling tests were added in commit `0f9002e` (NFR assessment expansion) without updating the artifact's task-4 notes or change log. Fixed by correcting the counts in both locations.

**Note on ESLint warnings (not counted as issue):** 4 `no-non-null-assertion` warnings in `connector-api.test.ts` (lines 92, 93, 197, 222) were reviewed and found to be consistent with project convention. The ESLint config explicitly downgrades this to `warn` for test files, and the same pattern is used in `verification-pipeline.test.ts` and `pricing-validator.test.ts`. No change needed.

### Review Pass #3

| Field | Value |
| --- | --- |
| **Date** | 2026-03-05 |
| **Reviewer Model** | Claude Opus 4.6 (claude-opus-4-6) |
| **Issues Found** | Critical: 0, High: 0, Medium: 0, Low: 0 |
| **Total Issues** | 0 |
| **Fixes Applied** | 0 |
| **Files Modified** | None |
| **Outcome** | Pass -- no issues found. Security review (OWASP Top 10) also passed clean. |
