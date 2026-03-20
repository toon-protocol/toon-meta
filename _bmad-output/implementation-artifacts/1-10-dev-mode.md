# Story 1.10: Dev Mode

Status: done

## Story

As a **service developer**,
I want a dev mode that skips signature verification, relaxes pricing, and logs all packets,
So that I can iterate locally without running a full network or blockchain.

**FRs covered:** FR-SDK-12 (Dev mode that skips signature verification, bypasses pricing, and logs all incoming packets for local development)

**Dependencies:** Story 1.4 (verification pipeline to bypass), Story 1.5 (pricing validation to bypass). Both are done.

## Acceptance Criteria

1. Given `createNode({ devMode: true, ... })`, when an event arrives with an invalid or missing signature, then verification is skipped and the handler is invoked
2. Given dev mode is enabled, when any event arrives, then the full packet details are logged (kind, pubkey, amount, destination, TOON preview)
3. Given dev mode is enabled, when pricing validation runs, then all amounts are accepted (pricing bypass)
4. Given dev mode is NOT enabled (production), when an event fails verification or pricing, then it is rejected normally with no bypass

## Tasks / Subtasks

- [x] Task 1: Add dev mode pricing bypass to the pipeline in `create-node.ts` (AC: #3, #4)
  - [x] In `packages/sdk/src/create-node.ts`, locate the pipelined packet handler (the `pipelinedHandler` async function, around line 194). Find Step 3 (pricing validation, around line 231-250).
  - [x] Add a conditional before the `pricer.validate()` call: if `config.devMode` is truthy, skip pricing entirely and proceed to Step 4 (handler context + dispatch). The pricing validator itself does NOT have a devMode flag -- the bypass is at the pipeline level in `create-node.ts`.
  - [x] The bypass should be structured as:
    ```typescript
    // Step 3: Validate pricing (skip in dev mode)
    if (!(config.devMode ?? false)) {
      let amount: bigint;
      try {
        amount = BigInt(request.amount);
      } catch {
        return { accept: false, code: 'T00', message: 'Invalid payment amount' };
      }
      const priceResult = pricer.validate(meta, amount);
      if (!priceResult.accepted) {
        if (priceResult.rejection) {
          return priceResult.rejection as HandlePacketResponse;
        }
        return { accept: false, code: 'F04', message: 'Pricing validation failed' };
      }
    }
    ```
  - [x] The `amount` variable is also used by `createHandlerContext` in Step 4. When pricing is bypassed, parse the amount with a fallback to 0n:
    ```typescript
    // Amount for HandlerContext: use parsed value, or 0n in dev mode when parse fails
    let contextAmount: bigint;
    try {
      contextAmount = BigInt(request.amount);
    } catch {
      if (config.devMode) {
        contextAmount = 0n;
      } else {
        return { accept: false, code: 'T00', message: 'Invalid payment amount' };
      }
    }
    ```
    Note: Restructure the amount parsing so it happens once, before both pricing and context creation. The `amount` variable should be available for both steps.

- [x] Task 2: Add dev mode packet logging to the pipeline in `create-node.ts` (AC: #2)
  - [x] In the pipelined handler, after Step 1 (shallow TOON parse) succeeds and before Step 2 (verification), add dev mode logging:
    ```typescript
    // Dev mode: log packet details
    if (config.devMode) {
      const toonPreview = request.data.length > 80
        ? request.data.substring(0, 80) + '...'
        : request.data;
      console.log(
        '[toon:dev]',
        `kind=${meta.kind}`,
        `pubkey=${meta.pubkey.substring(0, 16)}...`,
        `amount=${request.amount}`,
        `dest=${request.destination}`,
        `toon=${toonPreview}`
      );
    }
    ```
  - [x] The log format uses `[toon:dev]` prefix for easy filtering. It logs: kind (from shallow parse), pubkey (truncated to 16 chars for readability), amount (raw string from request), destination (ILP address), and TOON preview (first 80 chars of base64).
  - [x] Use `console.log` (not `console.debug`) because dev mode is explicitly opted-in and the user expects visible output.

- [x] Task 3: Enable ATDD tests in `dev-mode.test.ts` (AC: #1-#4)
  - [x] In `packages/sdk/src/dev-mode.test.ts`:
    - [x] Update the stale ATDD Red Phase comment (line 5) from `// ATDD Red Phase - tests will fail until implementation exists` to `// ATDD tests for Story 1.10 -- dev mode verification and pricing bypass`
    - [x] Change all 5 `it.skip(` calls to `it(` (remove `.skip`)
  - [x] Fix test data so tests work with the full pipeline. The current tests use `createPaymentHandlerBridge()` directly, but dev mode bypass for pricing happens in the `pipelinedHandler` inside `createNode()`, NOT in the `PaymentHandlerBridge`. The tests need restructuring:
    - [x] Rewrite the test file to use `createNode()` with `devMode: true` and a mock connector, delivering packets through the full pipeline. This matches how the other integration-adjacent unit tests work (see `create-node.test.ts`). The tests should:
      1. Create a `MockConnector` (same pattern as `createMockConnector()` in `create-node.test.ts`)
      2. Call `createNode({ secretKey, connector, devMode: true, handlers: { ... } })`
      3. Call `node.start()` to wire the packet handler
      4. Deliver packets via `connector.packetHandler!(request)` -- the `packetHandler` is set by `start()` -> `toonNode.start()` -> `connector.setPacketHandler()`
      5. Assert that invalid signatures are accepted, pricing is bypassed, and logging occurs
    - [x] Update the test for "production mode rejects invalid signature with F06" (test 4, currently using `devMode: false`) to also use `createNode()` with no devMode set (defaults to false). This test validates AC #4 and mirrors the existing `__integration__/create-node.test.ts` test at line 851.
    - [x] Update the test for "production mode rejects underpaid event with F04" (test 5, currently using `devMode: false`) to use `createNode()` with a validly-signed event but insufficient payment.
  - [x] Fix priority labels to match test-design-epic-1.md:
    - Test 1 (sig bypass) `[P0]` -> test-design T-1.10-01 is P1. Update label to `[P1]`
    - Test 2 (logging) `[P0]` -> test-design T-1.10-03 is P2. Update label to `[P2]`
    - Test 3 (pricing bypass) `[P0]` -> test-design T-1.10-02 is P1. Update label to `[P1]`
    - Test 4 (production sig reject) `[P0]` -> test-design T-1.10-04 is P0. Keep as `[P0]`
    - Test 5 (production pricing reject) `[P1]` -> validates the "pricing active" dimension of T-1.10-04 (P0, risk E1-R15: dev mode bypasses leak to production). Update label to `[P0]`

- [x] Task 4: Remove `dev-mode.test.ts` from vitest exclude list (AC: #1-#4)
  - [x] In `packages/sdk/vitest.config.ts`, remove the line `'src/dev-mode.test.ts',` from the `exclude` array (line 22)
  - [x] Update the ATDD story tracker comment above it: change `//   dev-mode.test.ts                -> Story 1.10` to `//   dev-mode.test.ts                -> Story 1.10 (done)`

- [x] Task 5: Verify tests compile and pass (AC: #1-#4)
  - [x] Run `cd packages/sdk && npx tsc --noEmit` -- TypeScript compiles without errors
  - [x] Run `cd packages/sdk && pnpm test` -- all tests pass including the newly-enabled dev-mode tests. Expected count: 128 existing + new dev-mode tests.
  - [x] Run `pnpm -r test` from project root -- no regressions across monorepo

## Dev Notes

### What This Story Does

Enables dev mode behavior in the SDK's packet processing pipeline. Dev mode is an explicitly opted-in flag (`devMode: true` in `NodeConfig`) that:
1. **Skips signature verification** -- already implemented in `verification-pipeline.ts` (Story 1.4, line 34: `if (config.devMode) return { verified: true }`)
2. **Bypasses pricing validation** -- needs implementation in `create-node.ts`'s pipelined handler (pricing validator itself has no devMode knowledge)
3. **Logs all incoming packets** -- needs implementation in `create-node.ts`'s pipelined handler

### What Already Exists

**Verification bypass (ALREADY DONE -- Story 1.4):**
- `packages/sdk/src/verification-pipeline.ts`, line 34: `if (config.devMode) { return { verified: true }; }`
- The `createVerificationPipeline()` accepts `{ devMode: boolean }` and skips Schnorr verification when true
- The `createNode()` function already passes `config.devMode ?? false` to the verifier (line 173)

**Pricing bypass (NOT YET DONE):**
- `packages/sdk/src/pricing-validator.ts` has NO devMode flag -- it always validates
- The bypass must be added at the pipeline level in `create-node.ts`, BEFORE calling `pricer.validate()`
- This is the correct architecture: pricing validator is a pure validation function; the pipeline orchestrator decides whether to invoke it

**Packet logging (NOT YET DONE):**
- No logging exists in the pipeline. The only console output is the `console.error` in the T00 error boundary (line 271)
- Dev mode logging should be added after shallow TOON parse succeeds (so we have metadata to log)

**ATDD test file (EXISTS with `.skip`):**
- `packages/sdk/src/dev-mode.test.ts` -- 5 skipped tests
- Tests use `createPaymentHandlerBridge()` directly, which does NOT exercise the pipeline-level pricing bypass
- Tests need restructuring to use `createNode()` for full pipeline coverage
- Currently excluded from vitest config (line 22 of `vitest.config.ts`)

**DevMode in `NodeConfig` (ALREADY EXISTS):**
- `packages/sdk/src/create-node.ts`, line 64: `devMode?: boolean;`
- Default is `false` (line 173: `config.devMode ?? false`)

### Architecture Compliance

**Pipeline ordering (must remain unchanged):**
```
ILP Packet
  -> Step 0: Reject oversized payloads (DoS mitigation)
  -> Step 1: Shallow TOON parse (extract routing metadata)
  -> [DEV MODE LOG HERE] -- log after parse, before verify
  -> Step 2: Verify signature (SKIP in dev mode -- already implemented)
  -> Step 3: Validate pricing (SKIP in dev mode -- this story)
  -> Step 4: Build HandlerContext
  -> Step 5: Dispatch to handler
```

Dev mode bypasses Steps 2 and 3 but does NOT change Steps 0, 1, 4, or 5. The shallow TOON parse always runs (even in dev mode) because we need the `meta` for HandlerContext construction and logging. The DoS check always runs because oversized payloads waste memory regardless of mode.

**Risk E1-R15 (score 3, medium):** Dev mode bypasses leak to production through incomplete config isolation. Mitigated by:
- `devMode` defaults to `false` (line 173 of create-node.ts)
- T-1.10-04 test explicitly validates: no devMode set -> verification and pricing active
- No environment variable override for devMode (it's only settable via `NodeConfig`)

**Error handling in dev mode:**
- When pricing is bypassed and `BigInt(request.amount)` fails (invalid amount string), fall back to `0n` instead of rejecting. In dev mode, the developer may send arbitrary data without valid amounts.
- When verification is bypassed, corrupted signatures are accepted (already handled by verification pipeline).
- T00 error boundary (handler exceptions) is NOT bypassed in dev mode -- handler errors are always caught and logged.

### Coding Standards

| Element | Convention | Example |
| --- | --- | --- |
| Log prefix | `[toon:dev]` | `console.log('[toon:dev]', ...)` |
| Pubkey truncation | 16 chars | `meta.pubkey.substring(0, 16) + '...'` |
| TOON preview | 80 chars base64 | `request.data.substring(0, 80) + '...'` |
| Priority prefix | matches test-design | `'[P1] devMode skips...'` |
| ESM extensions | `.js` | `import { createNode } from './create-node.js'` |

**Critical:**
- Never use `any` -- use `unknown` and type guards
- Follow AAA pattern (Arrange, Act, Assert) in all tests
- Priority label mismatches between ATDD test files and test-design must be fixed (precedent: Stories 1.4, 1.5, 1.8, 1.9)
- Update stale ATDD Red Phase comments to reflect current state (precedent: Story 1.3)

### Testing

**Framework:** Vitest 1.x

**Unit tests (modify existing):**
- File: `packages/sdk/src/dev-mode.test.ts`
- 5 tests covering all 4 ACs
- Tests must be restructured from `createPaymentHandlerBridge()` to `createNode()` for full pipeline coverage
- Need `createSignedToonEvent()` helper from nostr-tools (same pattern as `__integration__/create-node.test.ts`)
- Need `createMockConnector()` helper (same pattern as `create-node.test.ts` unit tests)

**Test factory pattern:** The dev-mode tests should use the same test factories as the existing tests:
- `createMockConnector()` from `create-node.test.ts` pattern (line 29-51)
- Signed event creation using `generateSecretKey()` + `finalizeEvent()` + `encodeEventToToon()` from `@toon-protocol/core/toon`
- The `__integration__/create-node.test.ts` file has `createSignedToonEvent()` and `createTestSecretKey()` helpers that can be referenced for the pattern

**Unit test count:** After this story: 128 existing + ~5 new dev-mode tests = ~133+ tests (9 existing files + dev-mode.test.ts = 10 test files)

### Test Design

[Source: `_bmad-output/planning-artifacts/test-design-epic-1.md#Story 1.10`]

| Test ID   | Test Description                                           | Level | Risk   | Priority | Status       | ATDD File           |
| --------- | ---------------------------------------------------------- | ----- | ------ | -------- | ------------ | ------------------- |
| T-1.10-01 | devMode=true: invalid signature accepted                   | U     | -      | P1       | Existing (.skip) | `dev-mode.test.ts` |
| T-1.10-02 | devMode=true: underpaid event accepted (pricing bypass)    | U     | -      | P1       | Existing (.skip) | `dev-mode.test.ts` |
| T-1.10-03 | devMode=true: packet details logged                        | U     | -      | P2       | Existing (.skip) | `dev-mode.test.ts` |
| T-1.10-04 | devMode not set: verification and pricing active (no leak) | U     | E1-R15 | P0       | Existing (.skip) | `dev-mode.test.ts` |

**Risk E1-R15** (score 3, medium): Dev mode bypasses leak to production through incomplete config isolation. Mitigated by unit test T-1.10-04 validating that devMode unset in config -> verification and pricing are active.

### Previous Story Learnings (from Story 1.9)

- Story 1.9 pattern: enable ATDD tests by removing `.skip`, fixing priority labels
- No `@ts-nocheck` pragma in dev-mode.test.ts (unlike network-discovery.test.ts), but tests use `it.skip()`
- The existing dev-mode.test.ts tests use `createPaymentHandlerBridge()` directly, which bypasses the pipeline-level pricing bypass. Tests MUST be restructured to use `createNode()`.
- `vitest.config.ts` does NOT use `globals: true` -- all test files explicitly import from `vitest`
- ESM imports use `.js` extensions
- TypeScript strict mode with `noPropertyAccessFromIndexSignature` is active
- When fixing priority labels: match test-design-epic-1.md exactly

### Git Intelligence

Last 5 commits follow pattern: `feat(<story-id>): <description>`

Recent commits:
- `feat(1-9): integrate network discovery and bootstrap with ServiceNode API`
- `feat(1-8): enable connector direct methods API tests`
- `feat(1-7): implement createNode composition with embedded connector lifecycle`
- `feat(1-6): implement PaymentHandler bridge with transit semantics`
- `feat(1-5): enable pricing validation with self-write bypass`

Expected commit: `feat(1-10): enable dev mode with pricing bypass and packet logging`

### Project Structure Notes

Files to modify:
```
packages/sdk/
├── src/
│   ├── create-node.ts          # Add pricing bypass + packet logging in pipelinedHandler (modify)
│   └── dev-mode.test.ts        # Enable tests, fix priorities, restructure to use createNode (modify)
├── vitest.config.ts            # Remove dev-mode.test.ts from exclude list (modify)
```

No new files need to be created. All changes are to existing files.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 1.10: Dev Mode`]
- [Source: `_bmad-output/planning-artifacts/epics.md#FR Coverage Map` -- FR-SDK-12: Epic 1, Story 1.10]
- [Source: `_bmad-output/planning-artifacts/test-design-epic-1.md#Story 1.10`]
- [Source: `_bmad-output/planning-artifacts/architecture.md` -- Cross-Cutting Concern #6: Dev Mode]
- [Source: `packages/sdk/src/create-node.ts` -- NodeConfig (line 64: devMode), pipelinedHandler (lines 194-274)]
- [Source: `packages/sdk/src/verification-pipeline.ts` -- devMode bypass (line 34)]
- [Source: `packages/sdk/src/pricing-validator.ts` -- no devMode support (pricing bypass must be at pipeline level)]
- [Source: `packages/sdk/src/dev-mode.test.ts` -- 5 skipped ATDD tests]
- [Source: `packages/sdk/vitest.config.ts` -- dev-mode.test.ts excluded (line 22)]
- [Source: `_bmad-output/implementation-artifacts/1-9-network-discovery-and-bootstrap-integration.md`]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

None required -- all tests passed on first run.

### Completion Notes List

- **Task 1 (Pricing bypass):** Verified `create-node.ts` lines 246-271 implement the dev mode pricing bypass. Amount parsing uses `BigInt(request.amount)` with fallback to `0n` in dev mode. The `pricer.validate()` call is wrapped in `if (!(config.devMode ?? false))` guard.
- **Task 2 (Packet logging):** Verified `create-node.ts` lines 220-233 implement dev mode packet logging after shallow TOON parse and before verification. Uses `[toon:dev]` prefix, 16-char pubkey truncation, 80-char TOON preview, and `console.log`.
- **Task 3 (ATDD tests):** Verified `dev-mode.test.ts` has all 5 tests enabled (no `.skip`), restructured to use `createNode()` with `MockConnector` for full pipeline coverage. Priority labels match test-design: `[P1]`, `[P2]`, `[P1]`, `[P0]`, `[P0]`. ATDD comment updated.
- **Task 4 (vitest exclude):** Verified `vitest.config.ts` no longer excludes `dev-mode.test.ts` and tracker comment updated to `(done)`.
- **Task 5 (Verification):** TypeScript compiles cleanly (`tsc --noEmit`). SDK tests: 10 files, 133 tests all passing. Full monorepo: no regressions.

### File List

- `packages/sdk/src/create-node.ts` (modified) -- Added dev mode pricing bypass and packet logging in pipelinedHandler
- `packages/sdk/src/dev-mode.test.ts` (modified) -- Restructured tests to use createNode() with MockConnector, removed .skip, fixed priority labels
- `packages/sdk/vitest.config.ts` (modified) -- Removed dev-mode.test.ts from exclude list, updated tracker comment

### Change Log

| Date       | Change Description |
| ---------- | ------------------ |
| 2026-03-05 | Verified Story 1.10 implementation: dev mode pricing bypass in create-node.ts pipeline, packet logging with [toon:dev] prefix, all 5 ATDD tests enabled and passing (133 total SDK tests), no monorepo regressions. All tasks complete. |

## Code Review Record

### Review Pass #1

- **Date:** 2026-03-05
- **Reviewer Model:** Claude Opus 4.6 (claude-opus-4-6)
- **Issue Counts:**
  - Critical: 0
  - High: 0
  - Medium: 1 — Non-null assertions (`connector.packetHandler!`) in test `MockConnector` replaced with a proper `deliverPacket()` method that throws a descriptive error if no handler is registered.
  - Low: 2 — Console spy cleanup (`consoleSpy.mockRestore()`) in logging tests wrapped in `try/finally` blocks to ensure restoration even if assertions fail.
- **Outcome:** Success — all issues fixed in the same pass. No follow-up tasks required.
- **Files Modified:**
  - `packages/sdk/src/dev-mode.test.ts` — Added `MockConnector` interface with `deliverPacket()` method; wrapped console spy cleanup in `try/finally` in two tests.

### Review Pass #2

- **Date:** 2026-03-05
- **Reviewer Model:** Claude Opus 4.6 (claude-opus-4-6)
- **Issue Counts:**
  - Critical: 0
  - High: 0
  - Medium: 0
  - Low: 1 — Inconsistent `config.devMode` guard style in `create-node.ts`: some checks used truthiness (`if (config.devMode)`) while others used nullish coalescing (`if (config.devMode ?? false)`). Standardized all three pipeline checks to use `config.devMode ?? false` for consistency with the verifier creation at line 173.
- **Outcome:** Success — all issues fixed. 136 SDK tests pass, 1383 monorepo tests pass, TypeScript compiles cleanly.
- **Files Modified:**
  - `packages/sdk/src/create-node.ts` — Lines 221 and 252: changed `config.devMode` to `config.devMode ?? false` for consistency with line 262.

### Review Pass #3

- **Date:** 2026-03-05
- **Reviewer Model:** Claude Opus 4.6 (claude-opus-4-6)
- **Issue Counts:**
  - Critical: 0
  - High: 0
  - Medium: 0
  - Low: 2 — Log injection sanitization added; inconsistent devMode guard style standardized.
- **Outcome:** Success — all issues fixed. Final review pass complete.
- **Files Modified:**
  - `packages/sdk/src/create-node.ts` — Added log injection sanitization for dev mode logging output.
  - `packages/sdk/src/dev-mode.test.ts` — Standardized devMode guard style across tests.
