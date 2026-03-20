# Story 1.6: PaymentHandler Bridge with Transit Semantics

Status: done

## Story

As a **service developer**,
I want the SDK to bridge my handler registry to the connector's `PaymentHandler` interface,
So that the embedded connector delivers ILP packets to my handlers with correct fire-and-forget vs await behavior.

**FRs covered:** FR-SDK-6 (Bridge handler registry to connector's PaymentHandler interface, using isTransit to distinguish fire-and-forget from await semantics)

## Acceptance Criteria

1. When the connector receives an ILP packet where `isTransit` is `true` (intermediate hop), the handler is invoked fire-and-forget (non-blocking) and the connector continues forwarding immediately without waiting for handler response
2. When the connector receives an ILP packet where `isTransit` is `false` (final hop), the handler is invoked and the response is awaited, with the handler's `accept()`/`reject()` result flowing back as the ILP fulfill/reject
3. When a handler throws an unhandled exception, the PaymentHandler bridge catches it and returns an ILP `T00` (internal error) reject response, and the error is logged
4. When a handler returns an async rejection (rejected promise), the bridge catches it and returns a `T00` reject response (same as synchronous throw)

## Tasks / Subtasks

- [x] Task 1: Remove payment-handler-bridge.test.ts from vitest exclude (AC: #1-#4)
  - [x] In `packages/sdk/vitest.config.ts`, remove the line `'src/payment-handler-bridge.test.ts',` from the `exclude` array (line 19)
  - [x] Update the ATDD comment to mark Story 1.6 as done: `//   payment-handler-bridge.test.ts -> Story 1.6 (done)`
  - [x] Do NOT remove any other excluded test files -- they belong to later stories (dev-mode.test.ts -> Story 1.10)

- [x] Task 2: Enable ATDD tests and update stale comment (AC: #1, #2, #3)
  - [x] In `packages/sdk/src/payment-handler-bridge.test.ts`, change all 3 `it.skip(` calls to `it(` (remove `.skip`)
  - [x] Update the stale ATDD Red Phase comment (line 5) from `// ATDD Red Phase - tests will fail until implementation exists` to `// ATDD tests for Story 1.6 -- payment handler bridge` (the implementation needs to be completed; keeping the old comment would be misleading, per Story 1.3/1.4 review precedent)
  - [x] The ATDD Red Phase has 3 tests. The mapping from test-design-epic-1.md IDs to ATDD test file is:
    - ATDD test 1 [P0]: isTransit=true invokes handler fire-and-forget (AC: #1) -- covers test-design T-1.6-01
    - ATDD test 2 [P0]: isTransit=false awaits handler response (AC: #2) -- covers test-design T-1.6-02
    - ATDD test 3 [P0]: unhandled exception in handler produces T00 internal error (AC: #3) -- covers test-design T-1.6-03

- [x] Task 3: Add missing test for async rejection (AC: #4)
  - [x] Add test [P1] for handler async rejection producing T00 (AC: #4, test-design T-1.6-04):

    ```typescript
    it('[P1] handler async rejection produces T00 internal error', async () => {
      // Arrange
      (mockRegistry.dispatch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Async handler failure')
      );
      const bridge = createPaymentHandlerBridge({
        registry: mockRegistry as unknown as HandlerRegistry,
        devMode: false,
        ownPubkey: 'ff'.repeat(32),
        basePricePerByte: 10n,
      });
      const request = createPaymentRequest({ isTransit: false });

      // Act
      const response = await bridge.handlePayment(request);

      // Assert
      expect(response.accept).toBe(false);
      expect(response.code).toBe('T00');
      expect(response.message).toBeDefined();
    });
    ```

  - [x] Place this test within the existing `describe('PaymentHandler Bridge', ...)` block, after the existing ATDD tests

- [x] Task 4: Implement the PaymentHandler bridge (AC: #1, #2, #3, #4)
  - [x] In `packages/sdk/src/payment-handler-bridge.ts`, replace the stub `handlePayment` implementation with a real bridge:
    1. Rename `_config` to `config` (removing underscore prefix since it is now used to access `config.registry`)
    2. Change `_request: unknown` to `request: PaymentRequest` (removing underscore prefix since it is now used)
    3. Construct a minimal `HandlerContext` via `createHandlerContext()` from `request` fields (see Dev Notes for required fields including `rawBytes`)
    4. For `isTransit === true`: invoke `registry.dispatch(ctx)` fire-and-forget (do NOT await), attach `.catch()` to prevent unhandled rejection, return `{ accept: true }` immediately
    5. For `isTransit === false`: await `registry.dispatch(ctx)` and return the handler's response
    6. Wrap the `isTransit === false` path in try/catch that returns `{ accept: false, code: 'T00', message: <error message> }` on any exception
  - [x] Add necessary imports: `createHandlerContext` from `./handler-context.js`, `type ToonRoutingMeta` from `@toon-protocol/core/toon`
  - [x] The bridge is a thin adapter -- it does NOT implement verification, pricing, or TOON parsing. Those pipeline stages are composed externally in Story 1.7's `createNode()`.

- [x] Task 5: Run tests and verify (AC: #1-#4)
  - [x] Run `cd packages/sdk && pnpm test` -- all payment handler bridge tests must pass (3 ATDD + 1 new = 4 total)
  - [x] Expected SDK test count: 68 (from Story 1.5) + 4 (this story) = 72 total (not counting skipped tests from later stories)
  - [x] Verify no test regressions: `pnpm -r test` from project root

## Dev Notes

### What Already Exists

- **`packages/sdk/src/payment-handler-bridge.ts`** -- Stub with interfaces (`PaymentHandlerBridgeConfig`, `PaymentRequest`, `PaymentResponse`) and `createPaymentHandlerBridge(_config)` returning `{ accept: false, code: 'T00', message: 'Not yet implemented' }`. Both `_config` and `_request` have underscore prefixes (unused) -- both must be renamed.

- **`packages/sdk/src/payment-handler-bridge.test.ts`** -- 3 `.skip`ped tests:
  - Test 1 [P0]: isTransit=true fire-and-forget (uses setTimeout to simulate slow handler, checks `handlerResolved` is false when bridge returns)
  - Test 2 [P0]: isTransit=false awaits handler response
  - Test 3 [P0]: unhandled exception -> T00 response
  Missing: T-1.6-04 (async rejection -> T00)

- **`packages/sdk/vitest.config.ts`** -- Excludes `payment-handler-bridge.test.ts` (line 19). Must be removed.

- **`packages/sdk/src/index.ts`** -- Already exports `createPaymentHandlerBridge`, `PaymentHandlerBridgeConfig`, `PaymentRequest`, `PaymentResponse`. No changes needed.

- **`packages/sdk/src/handler-registry.ts`** -- `HandlerRegistry` class with `dispatch(ctx: HandlerContext)` returning `Promise<{ accept: boolean; [key: string]: unknown }>`.

- **`packages/sdk/src/handler-context.ts`** -- `createHandlerContext(options: CreateHandlerContextOptions)` factory. The `CreateHandlerContextOptions` interface requires: `toon: string`, `meta: ToonRoutingMeta`, `amount: bigint`, `destination: string`, `toonDecoder: (toon: string) => NostrEvent`.

### Context Construction

The ATDD tests mock `registry.dispatch`, so the context is never inspected. However, the bridge must construct a type-correct `HandlerContext` via `createHandlerContext()`:

```typescript
import { createHandlerContext } from './handler-context.js';
import type { ToonRoutingMeta } from '@toon-protocol/core/toon';

const ctx = createHandlerContext({
  toon: request.data,
  meta: {
    kind: 0,
    pubkey: '',
    id: '',
    sig: '',
    rawBytes: new Uint8Array(0),   // ToonRoutingMeta requires rawBytes
  } as ToonRoutingMeta,
  amount: BigInt(request.amount),
  destination: request.destination,
  toonDecoder: () => { throw new Error('decode not available in bridge'); },
});
```

The real shallow parse and proper context construction happens in Story 1.7's `createNode()` pipeline. The bridge provides minimal placeholder values for type safety only.

### Fire-and-Forget Pattern

The isTransit=true test verifies timing: the bridge must return `{ accept: true }` BEFORE the handler resolves. The handler promise must have `.catch()` attached to prevent unhandled rejections:

```typescript
const { registry } = config;

if (request.isTransit) {
  void registry.dispatch(ctx).catch((err: unknown) => {
    console.error('Transit handler error:', err);
  });
  return { accept: true };
}

// isTransit=false: await handler response
return await registry.dispatch(ctx);
```

Use `void` keyword to satisfy no-floating-promises lint rule. Wrap the entire `isTransit=false` path in try/catch for T00 error boundary.

### Pipeline Position

```
ILP Packet
  -> PaymentHandlerBridge (isTransit check)           [Story 1.6 -- THIS STORY]
    -> Shallow TOON Parse                              [Story 1.0, composed in 1.7]
      -> Schnorr Signature Verification                [Story 1.4, composed in 1.7]
        -> Pricing Validation                          [Story 1.5, composed in 1.7]
          -> HandlerRegistry.dispatch(kind)             [Story 1.2]
            -> Handler(ctx) -> ctx.accept()/reject()    [Story 1.3]
```

This story implements ONLY the outer layer (transit semantics + error boundary). The inner pipeline stages are composed by `createNode()` in Story 1.7.

### Dependencies

- **Upstream**: Story 1.2 (HandlerRegistry.dispatch()), Story 1.3 (HandlerContext + createHandlerContext). Both implemented.
- **Downstream**: Story 1.7 (createNode) composes the bridge with verification, pricing, and TOON parsing.
- **No dependency on**: Stories 1.4 (verification) or 1.5 (pricing).

### Previous Story Learnings

- `vitest.config.ts` does NOT use `globals: true` -- all test files explicitly import `describe`, `it`, `expect`, `vi`, `beforeEach` from `vitest`
- ESM imports use `.js` extensions: `import { createPaymentHandlerBridge } from './payment-handler-bridge.js'`
- When enabling tests, do NOT modify the existing test logic -- just remove `.skip`
- TypeScript strict mode with `noPropertyAccessFromIndexSignature` is active
- When removing a test file from vitest excludes, also update the ATDD comment to mark `(done)`
- Update stale ATDD Red Phase comments to reflect current state
- The existing ATDD test priorities ([P0] for all 3) match test-design T-1.6-01/02/03 -- no priority label fixes needed

### Test Design

[Source: _bmad-output/planning-artifacts/test-design-epic-1.md#Story 1.6]

| ATDD Test | Test-Design IDs | Test                                                                      | AC  | Level | Risk   | Priority | Status   |
| --------- | --------------- | ------------------------------------------------------------------------- | --- | ----- | ------ | -------- | -------- |
| 1         | T-1.6-01        | isTransit=true: bridge returns BEFORE handler promise resolves           | #1  | U     | E1-R09 | P0       | Existing |
| 2         | T-1.6-02        | isTransit=false: bridge returns AFTER handler promise resolves           | #2  | U     | E1-R09 | P0       | Existing |
| 3         | T-1.6-03        | Handler throws -> T00 reject response returned                          | #3  | U     | E1-R10 | P0       | Existing |
| NEW-1     | T-1.6-04        | Handler async rejection -> T00 reject response returned                 | #4  | U     | E1-R10 | P1       | **NEW**  |

**Risk E1-R09** (score 6, high): Transit semantics swapped. Tests 1 and 2 specifically validate timing behavior.

**Risk E1-R10** (score 4, medium): Unhandled async exception leaks instead of T00. Tests 3 and NEW-1 verify both sync and async exceptions produce T00.

### ILP Error Codes

| Code  | Name               | When Used                              |
| ----- | ------------------ | -------------------------------------- |
| `T00` | Internal Error     | Unhandled handler exception (THIS STORY) |
| `F04` | Insufficient Amount | Underpaid event (Story 1.5)            |
| `F06` | Unexpected Payment | Invalid Schnorr signature (Story 1.4)  |
| `F00` | Bad Request        | No handler matches the event kind (Story 1.2) |

### Critical Rules

- The bridge MUST NOT implement verification or pricing -- those are composed externally in Story 1.7
- The bridge MUST construct a HandlerContext via `createHandlerContext()` for type correctness (see Context Construction above)
- The bridge MUST catch errors from fire-and-forget dispatch (isTransit=true) using `.catch()` to prevent unhandled promise rejections
- Both `_config` and `_request` must have their underscore prefixes removed (both are now used)
- Do NOT remove `dev-mode.test.ts` from the vitest exclude list -- it belongs to Story 1.10
- Do NOT add `process.env` reads -- the bridge is config-driven only
- The bridge MUST NOT import or use `createVerificationPipeline` or `createPricingValidator` directly
- The test file already has correct priority labels -- no label fixes needed

### Coding Standards

- PascalCase for interfaces, camelCase for functions
- No `any` -- use typed `PaymentRequest` not `unknown`
- Co-located tests: `payment-handler-bridge.test.ts` next to `payment-handler-bridge.ts`
- ESM `.js` extensions in imports
- Use `void` keyword for fire-and-forget promise to satisfy no-floating-promises lint rule

### Project Structure Notes

- File naming: `payment-handler-bridge.ts` (kebab-case) per project convention
- Architecture doc shows `PaymentHandlerBridge.ts` (PascalCase) but ATDD Red Phase established kebab-case. Kebab-case is correct.
- No new exports needed in `index.ts`

### Git Intelligence

Commit message convention: `feat(<story-id>): <description>`. Expected: `feat(1-6): implement PaymentHandler bridge with transit semantics`

**Key difference from Stories 1.2-1.5:** This story requires modifying the implementation file (`payment-handler-bridge.ts`). Previous stories only enabled skipped tests because implementations were already complete.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.6]
- [Source: _bmad-output/planning-artifacts/epics.md#FR Coverage Map -- FR-SDK-6]
- [Source: _bmad-output/planning-artifacts/architecture.md#Cross-Cutting Concerns: Transit Semantics]
- [Source: _bmad-output/planning-artifacts/test-design-epic-1.md#Story 1.6]
- [Source: _bmad-output/planning-artifacts/test-design-epic-1.md#3.4 Story 1.2 -> Story 1.6 (Registry -> Bridge)]
- [Source: packages/sdk/src/payment-handler-bridge.ts -- existing stub implementation]
- [Source: packages/sdk/src/payment-handler-bridge.test.ts -- ATDD Red Phase tests]
- [Source: packages/sdk/src/handler-registry.ts -- HandlerRegistry.dispatch() interface]
- [Source: packages/sdk/src/handler-context.ts -- HandlerContext interface and createHandlerContext()]
- [Source: packages/core/src/toon/shallow-parse.ts -- ToonRoutingMeta type definition (fields: kind, pubkey, id, sig, rawBytes)]
- [Source: _bmad-output/implementation-artifacts/1-5-pricing-validation-with-self-write-bypass.md -- previous story patterns]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

None required -- all tests passed on first run.

### Completion Notes List

- **Task 1**: Removed `src/payment-handler-bridge.test.ts` from vitest exclude array in `packages/sdk/vitest.config.ts`. Updated ATDD comment to mark Story 1.6 as `(done)`. Only `src/dev-mode.test.ts` remains excluded (Story 1.10).
- **Task 2**: Removed `.skip` from all 3 existing ATDD tests in `packages/sdk/src/payment-handler-bridge.test.ts`. Updated stale ATDD Red Phase comment to `// ATDD tests for Story 1.6 -- payment handler bridge`.
- **Task 3**: Added `[P1] handler async rejection produces T00 internal error` test (T-1.6-04) after the existing 3 ATDD tests in the `describe('PaymentHandler Bridge', ...)` block.
- **Task 4**: Replaced stub `handlePayment` implementation in `packages/sdk/src/payment-handler-bridge.ts` with full bridge: renamed `_config` to `config` and `_request` to `request: PaymentRequest`, added imports for `createHandlerContext` and `ToonRoutingMeta`, constructs `HandlerContext` via `createHandlerContext()` with minimal placeholder metadata, fire-and-forget dispatch with `void`/`.catch()` for `isTransit=true`, awaited dispatch with try/catch T00 error boundary for `isTransit=false`.
- **Task 5**: All 4 payment-handler-bridge tests pass. SDK total: 72 passed, 13 skipped. Full monorepo `pnpm -r test` passes with no regressions.

### File List

- `packages/sdk/vitest.config.ts` -- modified (removed exclude entry, updated comment)
- `packages/sdk/src/payment-handler-bridge.test.ts` -- modified (removed 3x `.skip`, updated comment, added T-1.6-04 test)
- `packages/sdk/src/payment-handler-bridge.ts` -- modified (replaced stub with full bridge implementation)

### Change Log

| Date       | Summary |
|------------|---------|
| 2026-03-04 | Implemented PaymentHandler bridge with transit semantics (Story 1.6). Replaced stub `handlePayment` with full bridge that constructs HandlerContext, supports fire-and-forget for transit packets (isTransit=true) and awaited dispatch with T00 error boundary for final-hop packets (isTransit=false). Enabled 3 ATDD tests, added 1 new async rejection test. All 72 SDK tests pass, no monorepo regressions. |

## Code Review Record

### Review Pass #1

| Field             | Value                                                                 |
|-------------------|-----------------------------------------------------------------------|
| **Date**          | 2026-03-04                                                            |
| **Reviewer Model**| Claude Opus 4.6 (claude-opus-4-6)                                     |
| **Outcome**       | Success                                                               |
| **Critical**      | 0                                                                     |
| **High**          | 0                                                                     |
| **Medium**        | 1 (misleading docstring claiming bridge performs verification/pricing -- fixed) |
| **Low**           | 0                                                                     |
| **Total Found**   | 1                                                                     |
| **Total Fixed**   | 1                                                                     |

**File Changed**: `packages/sdk/src/payment-handler-bridge.ts` -- Docstring fix: removed misleading claims that the bridge performs verification and pricing (those are composed externally in Story 1.7's `createNode()`).

**Follow-up Tasks**: None.

### Review Pass #2

| Field             | Value                                                                 |
|-------------------|-----------------------------------------------------------------------|
| **Date**          | 2026-03-04                                                            |
| **Reviewer Model**| Claude Opus 4.6 (claude-opus-4-6)                                     |
| **Outcome**       | Success                                                               |
| **Critical**      | 0                                                                     |
| **High**          | 0                                                                     |
| **Medium**        | 0                                                                     |
| **Low**           | 0                                                                     |
| **Total Found**   | 0                                                                     |
| **Total Fixed**   | 0                                                                     |

**No issues found.** The implementation passed review with no fixes required. The medium-severity docstring issue identified in Review Pass #1 was already fixed prior to this review.

**Follow-up Tasks**: None.

### Review Pass #3

| Field             | Value                                                                 |
|-------------------|-----------------------------------------------------------------------|
| **Date**          | 2026-03-04                                                            |
| **Reviewer Model**| Claude Opus 4.6 (claude-opus-4-6)                                     |
| **Outcome**       | Success                                                               |
| **Critical**      | 0                                                                     |
| **High**          | 0                                                                     |
| **Medium**        | 1 (BigInt outside error boundary -- fixed)                            |
| **Low**           | 2 (error message info disclosure -- fixed; unused config fields -- noted) |
| **Total Found**   | 3                                                                     |
| **Total Fixed**   | 2                                                                     |
| **Total Noted**   | 1                                                                     |

**Files Changed**: `packages/sdk/src/payment-handler-bridge.ts` (BigInt try/catch, generic error message), `packages/sdk/src/payment-handler-bridge.test.ts` (1 new test, 2 updated assertions).

**Follow-up Tasks**: None.
