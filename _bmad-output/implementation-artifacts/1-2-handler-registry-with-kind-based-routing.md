# Story 1.2: Handler Registry with Kind-Based Routing

Status: done

## Story

As a **service developer**,
I want to register event handlers by Nostr event kind using `.on(kind, handler)` and `.onDefault(handler)`,
So that incoming ILP packets are routed to my domain logic based on event type.

## Acceptance Criteria

1. `.on(kind, handler)` registers a handler for a specific Nostr event kind; incoming events with that kind are dispatched to the registered handler
2. Multiple kind registrations each dispatch to their own handler -- events of different kinds are routed to the correct handler only
3. `.onDefault(handler)` registers a fallback handler invoked when an event arrives with a kind that has no specific handler
4. When no default handler and no matching kind handler exist, the SDK automatically rejects with ILP error code `F00` (bad request) and a descriptive message
5. `.on(kind, newHandler)` for an already-registered kind replaces the previous handler -- the new handler is invoked, the old handler is not
6. `.on()` and `.onDefault()` return `this` for method chaining (builder pattern per architecture Pattern 2)

## Tasks / Subtasks

- [x] Task 1: Update HandlerRegistry class for method chaining (AC: #1, #2, #3, #4, #5, #6)
  - [x] Open `packages/sdk/src/handler-registry.ts` and verify the existing implementation satisfies AC #1, #2, #3, #4, #5 (it does -- see "What Already Exists" below)
  - [x] Change `on()` return type from `void` to `this` and add `return this;` at the end of the method body (AC: #6)
  - [x] Change `onDefault()` return type from `void` to `this` and add `return this;` at the end of the method body (AC: #6)
  - [x] Do NOT rename the file -- it is `handler-registry.ts` (kebab-case), not `HandlerRegistry.ts`. The architecture doc uses PascalCase file names for classes but the project already established kebab-case in the ATDD Red Phase. Keep kebab-case.
  - [x] Do NOT modify the `Handler` type signature, `dispatch()` method, or any other logic -- they are already correct

- [x] Task 2: Enable and update ATDD tests (AC: #1-#6)
  - [x] In `packages/sdk/vitest.config.ts`, remove the line `'src/handler-registry.test.ts',` from the `exclude` array (line 19)
  - [x] In `packages/sdk/src/handler-registry.test.ts`, change all 5 `it.skip(` calls to `it(` (remove `.skip`)
  - [x] **Add new test** -- T-1.2-06 **[P1]**: Method chaining. Add the following test inside the existing `describe('HandlerRegistry', ...)` block:

    ```typescript
    it('[P1] method chaining: .on().on().onDefault() registers all handlers', async () => {
      // Arrange
      const handler1 = vi.fn().mockResolvedValue({ accept: true });
      const handler2 = vi.fn().mockResolvedValue({ accept: true });
      const defaultHandler = vi.fn().mockResolvedValue({ accept: true });

      // Act -- chain registration
      const result = registry
        .on(1, handler1)
        .on(30617, handler2)
        .onDefault(defaultHandler);

      // Assert -- chaining returns the registry
      expect(result).toBe(registry);

      // Assert -- all registrations are active
      await registry.dispatch(createMockContext({ kind: 1 }));
      expect(handler1).toHaveBeenCalledTimes(1);

      await registry.dispatch(createMockContext({ kind: 30617 }));
      expect(handler2).toHaveBeenCalledTimes(1);

      await registry.dispatch(createMockContext({ kind: 99999 }));
      expect(defaultHandler).toHaveBeenCalledTimes(1);
    });
    ```

  - [x] Run `cd packages/sdk && pnpm test` -- all 6 tests (5 existing + 1 new) must pass

- [x] Task 3: Full regression check (AC: all)
  - [x] Run `pnpm -r test` from project root
  - [x] Verify zero test regressions across core, bls, relay, sdk packages
  - [x] Expected SDK test count: 32 (from Story 1.1) + 6 (this story) = 38 total

## Dev Notes

### What This Story Does

Adds method chaining (`return this`) to the existing `HandlerRegistry.on()` and `onDefault()` methods, enables 5 skipped ATDD tests, and adds 1 new chaining test. The core routing logic is already correct and does not need changes.

### What Already Exists

These files exist from the ATDD Red Phase and Story 1.1 package setup:

- **`packages/sdk/src/handler-registry.ts`** -- Working `HandlerRegistry` class with `on()`, `onDefault()`, and `dispatch()`. The `Map<number, Handler>` structure, F00 rejection, and handler replacement are all correct. **Only change needed**: `on()` and `onDefault()` return `void` instead of `this`.
- **`packages/sdk/src/handler-registry.test.ts`** -- 5 `.skip`ped tests (T-1.2-01 through T-1.2-05) using `createMockContext()` factory.
- **`packages/sdk/src/handler-context.ts`** -- `HandlerContext` interface and `createHandlerContext()`. Type-only import for the registry. No changes needed.
- **`packages/sdk/src/index.ts`** -- Already exports `HandlerRegistry` and `Handler` type. No changes needed.
- **`packages/sdk/vitest.config.ts`** -- Excludes `handler-registry.test.ts` in the `exclude` array. Must be updated.

**No new files are created by this story.** Only 3 existing files are modified.

### Exact Code Changes

**File 1: `packages/sdk/src/handler-registry.ts`** -- 2 lines changed

```typescript
// BEFORE (line 24):
on(kind: number, handler: Handler): void {
// AFTER:
on(kind: number, handler: Handler): this {
  this.handlers.set(kind, handler);
  return this;  // ADD THIS LINE
}

// BEFORE (line 31):
onDefault(handler: Handler): void {
// AFTER:
onDefault(handler: Handler): this {
  this.defaultHandler = handler;
  return this;  // ADD THIS LINE
}
```

**File 2: `packages/sdk/vitest.config.ts`** -- Remove 1 line from `exclude` array

Remove: `'src/handler-registry.test.ts',`

**File 3: `packages/sdk/src/handler-registry.test.ts`** -- Remove `.skip` from 5 tests, add 1 new test

### Architecture Pattern Clarification

The architecture doc (Pattern 1) says "Handlers use void return with `ctx` methods." This describes the **recommended usage pattern** for handler authors, not the actual type signature. The `Handler` type correctly returns `Promise<{ accept: boolean; [key: string]: unknown }>`. In practice, handlers call `ctx.accept()` which **returns** a response object, and the handler **returns** that object:

```typescript
// How handlers work in practice (correct):
node.on(30617, async (ctx) => {
  const event = ctx.decode();
  await processRepo(event);
  return ctx.accept({ eventId: event.id });  // accept() returns the response, handler returns it
});
```

The `HandlerRegistry.dispatch()` then receives and returns this response object. Do NOT change the `Handler` type to `void` -- it must return a `Promise<{ accept: boolean; ... }>`.

### Previous Story Learnings (from Story 1.1)

- `vitest.config.ts` does NOT use `globals: true` -- all test files explicitly import `describe`, `it`, `expect`, `vi` from `vitest`
- ESM imports use `.js` extensions: `import { HandlerRegistry } from './handler-registry.js'`
- The existing test file already follows these patterns correctly

### ILP Error Codes

This story only uses `F00` (Bad Request) for the no-handler case. Full table for reference:

| Code  | Name               | When Used                              |
| ----- | ------------------ | -------------------------------------- |
| `F00` | Bad Request        | No handler matches the event kind      |
| `F04` | Insufficient Amount | Underpaid event (Story 1.5)           |
| `F06` | Unexpected Payment | Invalid Schnorr signature (Story 1.4) |
| `T00` | Internal Error     | Unhandled handler exception (Story 1.6) |

### Test Design

[Source: _bmad-output/planning-artifacts/test-design-epic-1.md#Story 1.2]

| ID       | Test                                                            | Level | Risk   | Priority | Status   |
| -------- | --------------------------------------------------------------- | ----- | ------ | -------- | -------- |
| T-1.2-01 | `.on(kind, handler)` dispatches to correct handler              | U     | -      | P0       | Existing |
| T-1.2-02 | Multiple kinds registered, each dispatches to its own handler   | U     | -      | P0       | Existing |
| T-1.2-03 | `.onDefault(handler)` invoked when no kind match                | U     | -      | P0       | Existing |
| T-1.2-04 | No handler, no default -> auto-reject F00                       | U     | E1-R04 | P0       | Existing |
| T-1.2-05 | `.on(kind, newHandler)` replaces previous handler for that kind | U     | -      | P1       | Existing |
| T-1.2-06 | Method chaining: `.on().on().onDefault()` works                 | U     | -      | P1       | **NEW**  |

T-1.2-01 through T-1.2-05 already exist in the ATDD test file (`.skip`ped). T-1.2-06 must be added.

**Risk E1-R04** (score 2, low): No handler and no default leads to silent drop instead of F00 rejection. Mitigated by T-1.2-04.

### Dependencies

- **Upstream**: None. The `HandlerContext` type import is type-only; no runtime dependency on Story 1.3 implementation.
- **Downstream**: Story 1.6 (PaymentHandler Bridge) uses `HandlerRegistry.dispatch()`. Story 1.7 (createNode) wires the registry into the pipeline.

### Project Structure Notes

- File naming: `handler-registry.ts` (kebab-case) is correct per project convention. The architecture doc's source tree shows `HandlerRegistry.ts` (PascalCase) but the ATDD Red Phase established kebab-case, consistent with `handler-context.ts`, `verification-pipeline.ts`, etc.
- No new files created. No new exports added to `index.ts`.

### Coding Standards

- PascalCase for class name: `HandlerRegistry`
- camelCase for methods: `on()`, `onDefault()`, `dispatch()`
- No `any` -- uses `{ accept: boolean; [key: string]: unknown }` with `unknown` index type
- Co-located tests: `handler-registry.test.ts` next to `handler-registry.ts`
- AAA pattern in all tests (the existing ATDD tests already follow this)
- ESM `.js` extensions in imports (already correct in existing files)

### Critical Rules

- `.on()` and `.onDefault()` MUST return `this` (not `void`) for chaining
- `dispatch()` MUST return the F00 rejection object (not throw) when no handler matches
- Do NOT change the `Handler` type signature -- it correctly returns `Promise<{ accept: boolean; ... }>`
- Do NOT rename `handler-registry.ts` to `HandlerRegistry.ts`
- Do NOT create any new files
- Handler functions are async (return `Promise`) -- `dispatch()` awaits them

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.2]
- [Source: _bmad-output/planning-artifacts/architecture.md#Pattern 1: Handler Function Signature]
- [Source: _bmad-output/planning-artifacts/architecture.md#Pattern 2: Handler Registration Chaining]
- [Source: _bmad-output/planning-artifacts/test-design-epic-1.md#Story 1.2]
- [Source: _bmad-output/test-artifacts/atdd-checklist-epic-1-sdk.md#Story 1.2]
- [Source: packages/sdk/src/handler-registry.ts -- existing implementation]
- [Source: packages/sdk/src/handler-registry.test.ts -- ATDD Red Phase tests]
- [Source: _bmad-output/implementation-artifacts/1-1-unified-identity-from-seed-phrase.md -- previous story patterns]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

No debug issues encountered. All changes were straightforward per the story spec.

### Completion Notes List

- Changed `on()` and `onDefault()` return types from `void` to `this` with `return this;` statements
- Removed `handler-registry.test.ts` from vitest exclude array
- Unskipped 5 existing ATDD tests (T-1.2-01 through T-1.2-05)
- Added 1 new chaining test (T-1.2-06)
- All 6 handler-registry tests pass
- Full monorepo regression: zero failures across all packages (core: 536, bls: 204, relay: 165, docker: 52, sdk: 38, client: 210)

### File List

- `packages/sdk/src/handler-registry.ts` -- modified (return type + return this)
- `packages/sdk/src/handler-registry.test.ts` -- modified (unskip 5, add 1 test)
- `packages/sdk/vitest.config.ts` -- modified (remove exclude entry)

## Code Review Record

### Review Pass #1

- **Date**: 2026-03-04
- **Reviewer Model**: Claude Opus 4.6 (claude-opus-4-6)
- **Issue Counts**: 2 total — Critical: 0, High: 0, Medium: 1, Low: 1
- **Issues Found**:
  - **Medium**: TypeScript strict mode violation — `tsc --noEmit` failure due to `noPropertyAccessFromIndexSignature` in tsconfig. Fixed.
  - **Low**: Misleading `vitest.config.ts` comment about an already-re-included test file. Fixed.
- **Outcome**: All issues fixed. All 11 tests pass. Review pass #1 complete.

### Review Pass #2

- **Date**: 2026-03-04
- **Reviewer Model**: Claude Opus 4.6 (claude-opus-4-6)
- **Issue Counts**: 0 total — Critical: 0, High: 0, Medium: 0, Low: 0
- **Issues Found**: None
- **Outcome**: Implementation is clean. All 11 tests pass. No fixes needed. Review pass #2 complete.

### Review Pass #3

- **Date**: 2026-03-04
- **Reviewer Model**: Claude Opus 4.6 (claude-opus-4-6)
- **Issue Counts**: 0 total — Critical: 0, High: 0, Medium: 0, Low: 0
- **Issues Found**: None
- **Outcome**: Clean with full OWASP security analysis. No fixes needed. Review pass #3 (final) complete.

## Change Log

| Date       | Version | Description         | Author |
| ---------- | ------- | ------------------- | ------ |
| 2026-03-04 | 0.1     | Initial story draft | SM     |
| 2026-03-04 | 0.2     | Adversarial review: fixed AC-to-task mapping, added exact code changes, added file naming guard, added architecture pattern clarification, added previous story learnings, added Project Structure Notes, added new test code template, improved LLM optimization | Review |
| 2026-03-04 | 1.0     | Implementation verified complete: all 3 files modified per spec, 6/6 handler-registry tests pass, full monorepo regression 1205 tests pass with 0 failures (core: 536, bls: 204, relay: 165, docker: 52, sdk: 38, client: 210). Story marked done. | Claude Opus 4.6 |
