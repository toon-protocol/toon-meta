# Story 1.3: HandlerContext with TOON Passthrough and Lazy Decode

Status: done

## Story

As a **service developer**,
I want my handler to receive a `HandlerContext` with raw TOON data for direct LLM consumption and optional structured decode,
So that LLM-based handlers avoid decode overhead and code-based handlers can access typed objects.

**FRs covered:** FR-SDK-3 (TOON-native HandlerContext with passthrough + lazy decode), FR-SDK-7 (HandlerContext accept()/reject() helpers)

## Acceptance Criteria

1. `ctx.toon` contains the raw TOON string (no decode performed on access)
2. `ctx.kind` contains the event kind (extracted via shallow TOON parse, not full decode)
3. `ctx.pubkey` contains the sender's public key (extracted via shallow TOON parse)
4. `ctx.amount` contains the ILP payment amount as bigint
5. `ctx.destination` contains the ILP destination address
6. `ctx.decode()` performs the full TOON to NostrEvent decode and returns the typed object
7. Subsequent calls to `ctx.decode()` return the cached result (no re-decode; same object reference)
8. `ctx.accept(data?)` produces a correctly formatted `HandlePacketAcceptResponse` with optional response metadata
9. `ctx.reject(code, message)` produces a correctly formatted `HandlePacketRejectResponse` with the ILP error code

## Tasks / Subtasks

- [x] Task 1: Remove handler-context.test.ts from vitest exclude (AC: #1-#9)
  - [x] In `packages/sdk/vitest.config.ts`, remove the line `'src/handler-context.test.ts',` from the `exclude` array (line 19)
  - [x] Update the ATDD comment to mark handler-context.test.ts as done (Story 1.3), following the pattern established in Story 1.2 where handler-registry.test.ts was marked `(done)`
  - [x] Do NOT remove any other excluded test files -- they belong to later stories

- [x] Task 2: Enable ATDD tests (AC: #1-#9)
  - [x] In `packages/sdk/src/handler-context.test.ts`, change all 7 `it.skip(` calls to `it(` (remove `.skip`)
  - [x] The ATDD Red Phase consolidated the 10 test design tests into 7 tests. The mapping from test-design-epic-1.md IDs to ATDD test file is:
    - ATDD test 1 [P0]: `ctx.toon` returns raw TOON string without triggering decode (AC: #1) -- covers test-design T-1.3-01
    - ATDD test 2 [P0]: `ctx.kind` and `ctx.pubkey` come from shallow parse metadata (AC: #2, #3) -- covers test-design T-1.3-02 + T-1.3-03 (consolidated)
    - ATDD test 3 [P0]: `ctx.amount` is exposed as bigint (AC: #4) -- covers test-design T-1.3-04
    - ATDD test 4 [P0]: `ctx.decode()` performs lazy decode and caches the result (AC: #6, #7) -- covers test-design T-1.3-06 + T-1.3-07 (consolidated)
    - ATDD test 5 [P0]: `ctx.accept()` produces a HandlePacketAcceptResponse (AC: #8) -- covers test-design T-1.3-08
    - ATDD test 6 [P1]: `ctx.accept(data)` includes optional response data (AC: #8) -- covers test-design T-1.3-09
    - ATDD test 7 [P0]: `ctx.reject(code, msg)` produces a HandlePacketRejectResponse (AC: #9) -- covers test-design T-1.3-10

- [x] Task 3: Add missing test for ctx.destination (AC: #5)
  - [x] Add new test [P0] inside the existing `describe('HandlerContext', ...)` block, covering test-design T-1.3-05:

    ```typescript
    it('[P0] ctx.destination contains the ILP destination address', () => {
      // Arrange
      const ctx = createHandlerContext({
        toon: rawToon,
        meta: mockMeta,
        amount: 5000n,
        destination: 'g.test.receiver',
        toonDecoder: mockDecoder,
      });

      // Act & Assert
      expect(ctx.destination).toBe('g.test.receiver');
    });
    ```

  - [x] Place this test AFTER the ctx.amount test and BEFORE the ctx.decode() test, to match the natural property order and AC numbering

- [x] Task 4: Run tests and verify (AC: #1-#9)
  - [x] Run `cd packages/sdk && pnpm test` -- all 10 tests (7 existing + 1 new destination test + 2 NFR review tests) must pass
  - [x] Expected SDK test count: 38 (from Story 1.2) + 10 (this story) = 48 total
  - [x] Verify no test regressions: `pnpm -r test` from project root

## Dev Notes

### What This Story Does

Enables 7 skipped ATDD tests, adds 1 new test for `ctx.destination`, and removes the vitest exclude entry for `handler-context.test.ts`. The core `createHandlerContext()` implementation already exists and is correct -- no source changes needed.

### What Already Exists

These files exist from the ATDD Red Phase and previous stories:

- **`packages/sdk/src/handler-context.ts`** -- Working `createHandlerContext()` function with `HandlerContext` interface, `HandlePacketAcceptResponse`, `HandlePacketRejectResponse`, and `CreateHandlerContextOptions` types. The implementation includes:
  - Getters for `toon`, `kind`, `pubkey`, `amount`, `destination` backed by options/meta
  - `decode()` with closure-based caching via `cachedEvent` variable
  - `accept()` returning `{ accept: true, fulfillment: 'default-fulfillment', metadata? }`
  - `reject()` returning `{ accept: false, code, message }`
  - **No changes needed to this file.**

- **`packages/sdk/src/handler-context.test.ts`** -- 7 `.skip`ped tests using `createMockMeta()` and `createDecodedEvent()` factory functions. Missing: a dedicated test for `ctx.destination` (AC #5, test-design T-1.3-05).

- **`packages/sdk/vitest.config.ts`** -- Excludes `handler-context.test.ts` in the `exclude` array (line 19). Must be updated.

- **`packages/sdk/src/index.ts`** -- Already exports `createHandlerContext`, `HandlerContext`, `HandlePacketAcceptResponse`, `HandlePacketRejectResponse`, `CreateHandlerContextOptions`. No changes needed.

**No new files are created by this story.** Only 2 existing files are modified.

### Exact Code Changes

**File 1: `packages/sdk/vitest.config.ts`** -- Remove 1 line from `exclude` array

Remove: `'src/handler-context.test.ts',`

Also update the ATDD comment to mark Story 1.3 as done, e.g.: `//   handler-context.test.ts   -> Story 1.3 (done)`

**File 2: `packages/sdk/src/handler-context.test.ts`** -- Remove `.skip` from 7 tests, add 1 new test

Change all `it.skip(` to `it(` (7 occurrences). Add the new `ctx.destination` test (covering test-design T-1.3-05).

### Architecture Pattern Compliance

The `HandlerContext` interface follows Architecture Pattern 1 (Handler Function Signature): handlers receive a `ctx` with `accept()`/`reject()` methods. The implementation uses getter-based property access to avoid upfront computation, and the `decode()` method uses closure-based caching (no class fields, no WeakMap -- simple and effective).

**Pattern 1 clarification (from Story 1.2):** The architecture doc says "Handlers use void return with `ctx` methods." This describes the **recommended usage pattern** for handler authors, not the actual type signature. In practice, `ctx.accept()` and `ctx.reject()` **return** response objects, and the handler **returns** that object to the registry. The `accept()` method returns a `HandlePacketAcceptResponse`; `reject()` returns a `HandlePacketRejectResponse`. Do NOT change these to void -- they must return response objects.

The `toonDecoder` callback in `CreateHandlerContextOptions` follows the DI pattern established in the architecture doc: TOON encoder/decoder are passed as config callbacks, not imported directly.

[Source: _bmad-output/planning-artifacts/architecture.md#Pattern 1: Handler Function Signature]

### TOON Pipeline Position

Story 1.3 produces the `HandlerContext` that sits at the END of the SDK processing pipeline:

```
ILP Packet
  -> PaymentHandlerBridge (isTransit check)           [Story 1.6]
    -> Shallow TOON Parse (extract kind, pubkey)       [Story 1.0]
      -> Schnorr Signature Verification                [Story 1.4]
        -> Pricing Validation                          [Story 1.5]
          -> HandlerRegistry.dispatch(kind)            [Story 1.2]
            -> Handler(ctx) -> ctx.accept()/reject()   [Story 1.3 -- THIS STORY]
```

The `HandlerContext` is created by the PaymentHandler bridge (Story 1.6) using `createHandlerContext()`. At construction time, the `meta` parameter contains the shallow-parsed `ToonRoutingMeta` -- this is why `ctx.kind` and `ctx.pubkey` come from the meta, not from a full decode.

[Source: _bmad-output/planning-artifacts/test-design-epic-1.md#3.1 The Pipeline Ordering Invariant]

### Dependencies

- **Upstream**: Story 1.0 (TOON codec in `@toon-protocol/core` provides `ToonRoutingMeta` type). Already implemented and available.
- **Downstream**: Story 1.6 (PaymentHandler Bridge) creates `HandlerContext` instances via `createHandlerContext()`. Story 1.7 (createNode) wires everything together.

### Previous Story Learnings (from Story 1.2)

- `vitest.config.ts` does NOT use `globals: true` -- all test files explicitly import `describe`, `it`, `expect`, `vi` from `vitest`
- ESM imports use `.js` extensions: `import { createHandlerContext } from './handler-context.js'` (already correct in the test file)
- The ATDD test file already follows AAA pattern correctly
- When enabling tests, do NOT modify the existing test logic -- just remove `.skip`
- TypeScript strict mode with `noPropertyAccessFromIndexSignature` is active -- use bracket notation for index signatures if needed (not relevant for this story's changes)
- When removing a test file from vitest excludes, also update the ATDD comment to mark the story as `(done)` for clarity (established in Story 1.2 review)

[Source: _bmad-output/implementation-artifacts/1-2-handler-registry-with-kind-based-routing.md#Previous Story Learnings]

### Test Design

[Source: _bmad-output/planning-artifacts/test-design-epic-1.md#Story 1.3]

**Note:** The test-design-epic-1.md defines 10 tests (T-1.3-01 through T-1.3-10) for this story. The ATDD Red Phase consolidated these into 7 tests by combining kind+pubkey (T-1.3-02 + T-1.3-03) and decode+cache (T-1.3-06 + T-1.3-07). The destination test (T-1.3-05) was not written in the ATDD Red Phase and must be added. The table below shows the ATDD file's actual tests with their test-design ID mappings.

| ATDD Test | Test-Design IDs          | Test                                                                     | Level | Risk   | Priority | Status   |
| --------- | ------------------------ | ------------------------------------------------------------------------ | ----- | ------ | -------- | -------- |
| 1         | T-1.3-01                 | `ctx.toon` contains raw TOON string, no decode performed at construction | U     | -      | P0       | Existing |
| 2         | T-1.3-02 + T-1.3-03     | `ctx.kind` and `ctx.pubkey` from shallow parse metadata                  | U     | -      | P0       | Existing |
| 3         | T-1.3-04                 | `ctx.amount` contains ILP payment amount as bigint                       | U     | -      | P0       | Existing |
| NEW       | T-1.3-05                 | `ctx.destination` contains the ILP destination address                   | U     | -      | P0       | **NEW**  |
| 4         | T-1.3-06 + T-1.3-07     | `ctx.decode()` performs lazy decode and caches the result                 | U     | E1-R05 | P0       | Existing |
| 5         | T-1.3-08                 | `ctx.accept()` produces HandlePacketAcceptResponse                       | U     | -      | P0       | Existing |
| 6         | T-1.3-09                 | `ctx.accept(data)` includes response data                                | U     | -      | P1       | Existing |
| 7         | T-1.3-10                 | `ctx.reject(code, message)` produces HandlePacketRejectResponse          | U     | -      | P0       | Existing |

All 10 test-design IDs (T-1.3-01 through T-1.3-10) are covered by 10 ATDD tests (7 existing + 1 new destination test + 2 NFR review tests). The NEW test fills the gap for AC #5 (`ctx.destination`). The 2 NFR review tests cover no-decode-on-kind/pubkey-access and accept-without-data-excludes-metadata.

**Risk E1-R05** (score 2, low): `decode()` called multiple times causes redundant TOON parsing. Mitigated by ATDD test 4 which verifies caching behavior (same object reference on second call).

### ILP Error Codes

This story's `accept()`/`reject()` methods produce response objects that carry error codes. The error codes used elsewhere in the pipeline:

| Code  | Name               | When Used                              |
| ----- | ------------------ | -------------------------------------- |
| `F00` | Bad Request        | No handler matches the event kind (Story 1.2) |
| `F04` | Insufficient Amount | Underpaid event (Story 1.5)           |
| `F06` | Unexpected Payment | Invalid Schnorr signature (Story 1.4) |
| `T00` | Internal Error     | Unhandled handler exception (Story 1.6) |

### Coding Standards

- PascalCase for interface names: `HandlerContext`, `HandlePacketAcceptResponse`, `HandlePacketRejectResponse`, `CreateHandlerContextOptions`
- camelCase for function names: `createHandlerContext`
- No `any` -- uses `Record<string, unknown>` for metadata
- Co-located tests: `handler-context.test.ts` next to `handler-context.ts`
- AAA pattern in all tests (the existing ATDD tests already follow this)
- ESM `.js` extensions in imports (already correct in existing files)

### Critical Rules

- Do NOT modify `handler-context.ts` -- the implementation is already complete and correct
- Do NOT rename the file -- it is `handler-context.ts` (kebab-case)
- Do NOT create any new files
- Do NOT remove any other test files from the vitest exclude list -- they belong to later stories
- The `fulfillment` field in `HandlePacketAcceptResponse` currently uses `'default-fulfillment'` -- this is a placeholder. The real fulfillment (SHA-256 of event.id) will be wired in Story 1.6 when the PaymentHandler bridge creates the context. Do NOT change this.

### Project Structure Notes

- File naming: `handler-context.ts` (kebab-case) is correct per project convention, consistent with `handler-registry.ts`, `verification-pipeline.ts`, etc.
- The architecture doc's source tree shows `HandlerContext.ts` (PascalCase) but the ATDD Red Phase established kebab-case.
- No new files created. No new exports added to `index.ts`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.3]
- [Source: _bmad-output/planning-artifacts/epics.md#FR Coverage Map -- FR-SDK-3, FR-SDK-7]
- [Source: _bmad-output/planning-artifacts/architecture.md#Pattern 1: Handler Function Signature]
- [Source: _bmad-output/planning-artifacts/architecture.md#Pattern 3: Shallow TOON Parse Type]
- [Source: _bmad-output/planning-artifacts/test-design-epic-1.md#Story 1.3]
- [Source: _bmad-output/test-artifacts/atdd-checklist-epic-1-sdk.md#Story 1.3]
- [Source: packages/sdk/src/handler-context.ts -- existing implementation]
- [Source: packages/sdk/src/handler-context.test.ts -- ATDD Red Phase tests]
- [Source: _bmad-output/implementation-artifacts/1-2-handler-registry-with-kind-based-routing.md -- previous story patterns]
- [Source: packages/core/src/toon/shallow-parse.ts -- ToonRoutingMeta type definition]
- [Source: packages/core/src/compose.ts -- HandlePacketRequest/Response types]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

None required -- all tasks completed without issues.

### Completion Notes List

- **Task 1 (Remove handler-context.test.ts from vitest exclude)**: Removed `'src/handler-context.test.ts',` from the `exclude` array in `packages/sdk/vitest.config.ts`. Updated the ATDD comment to mark Story 1.3 as `(done)`.
- **Task 2 (Enable ATDD tests)**: Changed all 7 `it.skip(` calls to `it(` in `packages/sdk/src/handler-context.test.ts`, enabling all skipped tests.
- **Task 3 (Add missing test for ctx.destination)**: Added new `[P0] ctx.destination contains the ILP destination address` test covering AC #5 / test-design T-1.3-05, placed after the ctx.amount test and before the ctx.decode() test.
- **Task 4 (Run tests and verify)**: All 10 handler-context tests pass (8 from initial implementation + 2 added during NFR review). SDK total: 53 passed, 13 skipped (from later stories). Full monorepo `pnpm -r test` passes with zero failures.

### File List

- `packages/sdk/vitest.config.ts` -- modified (removed handler-context.test.ts from exclude, updated ATDD comment)
- `packages/sdk/src/handler-context.test.ts` -- modified (removed .skip from 7 tests, added 1 new destination test, added 2 NFR review tests: no-decode-on-kind/pubkey-access and accept-without-data-excludes-metadata)

## Code Review Record

### Review Pass #1

- **Date**: 2026-03-04
- **Reviewer Model**: Claude Opus 4.6 (claude-opus-4-6)
- **Issue Counts**: 1 total — Critical: 0, High: 0, Medium: 0, Low: 1
- **Issues Found**:
  - **Low**: Stale ATDD Red Phase comment in `handler-context.test.ts` — outdated comment referencing the Red Phase was updated to reflect the current story status.
- **Outcome**: All issues fixed. Story status updated from "review" to "done". All 10 handler-context tests pass (8 from initial implementation + 2 added during NFR review). Review pass #1 complete.

### Review Pass #2

- **Date**: 2026-03-04
- **Reviewer Model**: Claude Opus 4.6 (claude-opus-4-6)
- **Issue Counts**: 1 total — Critical: 0, High: 0, Medium: 0, Low: 1
- **Issues Found**:
  - **Low**: Stale test count in story documentation — story doc and NFR assessment referenced "8 tests" but actual count is 10 after NFR review phase added 2 tests (ctx.kind/pubkey no-decode test and ctx.accept() no-metadata test). Fixed all stale count references in story doc.
- **Outcome**: All issues fixed. Documentation now accurately reflects 10 handler-context tests. Review pass #2 complete.

### Review Pass #3

- **Date**: 2026-03-04
- **Reviewer Model**: Claude Opus 4.6 (claude-opus-4-6)
- **Issue Counts**: 0 total — Critical: 0, High: 0, Medium: 0, Low: 0
- **Issues Found**: None.
- **Outcome**: No issues found. No files modified. OWASP Top 10 assessment clean. Full monorepo regression passing. Review pass #3 (final) complete.

## Change Log

| Date       | Version | Description         | Author |
| ---------- | ------- | ------------------- | ------ |
| 2026-03-04 | 0.1     | Initial story draft | SM     |
| 2026-03-04 | 0.2     | Adversarial review: added FR traceability (FR-SDK-3, FR-SDK-7), fixed test-design ID mapping (10 canonical IDs mapped to 8 ATDD tests with consolidation notes), added vitest comment update subtask, added Pattern 1 return-type clarification from Story 1.2, added test placement guidance for destination test, added previous-story learning about vitest comment updates, added FR reference to References section | Review |
| 2026-03-04 | 1.0     | Implementation complete: enabled 7 ATDD tests, added ctx.destination test (T-1.3-05), removed vitest exclude. All 8 tests pass, full monorepo green. No source code changes needed -- createHandlerContext() implementation was already correct. | Claude Opus 4.6 |
| 2026-03-04 | 1.1     | Code review #1 complete: 1 Low issue (stale comment) fixed. Added Code Review Record section. | Claude Opus 4.6 |
| 2026-03-04 | 1.2     | Code review #2 complete: 1 Low issue (stale test count in story doc and NFR assessment -- references "8 tests" but actual count is 10 after NFR review added 2 tests). Fixed documentation references. | Claude Opus 4.6 |
| 2026-03-04 | 1.3     | Code review #3 (final) complete: 0 issues found. OWASP Top 10 assessment clean. Full monorepo regression passing. Story confirmed done. | Claude Opus 4.6 |
