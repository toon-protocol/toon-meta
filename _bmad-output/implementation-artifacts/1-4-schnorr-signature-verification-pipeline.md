# Story 1.4: Schnorr Signature Verification Pipeline

Status: done

## Story

As a **service developer**,
I want all incoming events to have their Schnorr signatures verified before my handler is invoked,
So that I can trust event authorship without implementing verification myself.

**FRs covered:** FR-SDK-4 (Schnorr signature verification pipeline, dev mode bypass)

## Acceptance Criteria

1. An incoming ILP packet with a valid TOON-encoded Nostr event and valid Schnorr signature is dispatched to the appropriate handler
2. An incoming ILP packet with an invalid signature is rejected with ILP error code `F06` (unexpected payment), and the handler is never invoked
3. When `devMode: true`, an event with an invalid or missing signature is dispatched to the handler normally (verification skipped)
4. When `devMode: true` and verification is skipped, a debug log is emitted noting the skipped verification (**Note:** the current implementation defers logging to Story 1.10 (Dev Mode). This story validates the skip behavior; Story 1.10 adds the debug log emission.)
5. Verification uses only shallow-parsed fields (`id`, `pubkey`, `sig`) from `ToonRoutingMeta` -- no full content decode is required
6. Tampered event content (valid structure but modified `id`) produces a signature mismatch and is rejected with `F06`
7. When `devMode` is explicitly `false`, invalid signatures produce `F06` rejection (no bypass leak -- risk E1-R06)

## Tasks / Subtasks

- [x] Task 1: Remove verification-pipeline.test.ts from vitest exclude (AC: #1-#7)
  - [x] In `packages/sdk/vitest.config.ts`, remove the line `'src/verification-pipeline.test.ts',` from the `exclude` array (line 19)
  - [x] Update the ATDD comment to mark Story 1.4 as done: `//   verification-pipeline.test.ts -> Story 1.4 (done)`
  - [x] Do NOT remove any other excluded test files -- they belong to later stories

- [x] Task 2: Enable ATDD tests and update stale comment (AC: #1, #2, #3, #5)
  - [x] In `packages/sdk/src/verification-pipeline.test.ts`, change all 4 `it.skip(` calls to `it(` (remove `.skip`)
  - [x] Update the stale ATDD Red Phase comment (line 10) from `// ATDD Red Phase - tests will fail until implementation exists` to `// ATDD tests for Story 1.4 -- verification pipeline` (the implementation already exists; keeping the old comment would be misleading, per Story 1.3 review precedent)
  - [x] The ATDD Red Phase has 4 tests. The mapping from test-design-epic-1.md IDs to ATDD test file is:
    - ATDD test 1 [P0]: valid Schnorr signature allows event dispatch to handler (AC: #1) -- covers test-design T-1.4-01
    - ATDD test 2 [P0]: invalid signature produces F06 rejection and handler is never called (AC: #2) -- covers test-design T-1.4-02
    - ATDD test 3 [P0]: devMode: true skips verification for invalid signature (AC: #3) -- covers test-design T-1.4-04
    - ATDD test 4 [P0]: verification uses only shallow-parsed fields (no full decode) (AC: #5) -- covers test-design T-1.4-06
  - [x] **Priority label fix:** ATDD test 4 is labeled `[P1]` in the test file but test-design T-1.4-06 is P0 (risk E1-R07, score 6, high). Update the test description string from `'[P1] verification uses only shallow-parsed fields (no full decode)'` to `'[P0] verification uses only shallow-parsed fields (no full decode)'` to match the test-design priority

- [x] Task 3: Add missing tests (AC: #6, #7)
  - [x] Add test [P0] for tampered event content -> signature mismatch -> F06 (AC: #6, test-design T-1.4-03):

    ```typescript
    it('[P0] tampered event content causes signature mismatch and F06 rejection', async () => {
      // Arrange
      const { meta, toonBase64 } = createSignedToonPayload();
      // Tamper the id (simulates content change that invalidates signature)
      const tamperedMeta = {
        ...meta,
        id: 'aa'.repeat(32), // Different event id = different message hash
      };
      const pipeline = createVerificationPipeline({ devMode: false });

      // Act
      const result = await pipeline.verify(tamperedMeta, toonBase64);

      // Assert
      expect(result.verified).toBe(false);
      expect(result.rejection).toBeDefined();
      expect(result.rejection!.code).toBe('F06');
    });
    ```

  - [x] Add test [P0] for devMode explicitly false -> invalid signature -> F06 (AC: #7, test-design T-1.4-05, risk E1-R06):

    ```typescript
    it('[P0] devMode explicitly false -- invalid signature produces F06 (no bypass leak)', async () => {
      // Arrange
      const { meta } = createTamperedToonPayload();
      const pipeline = createVerificationPipeline({ devMode: false });

      // Act
      const result = await pipeline.verify(meta, 'irrelevant');

      // Assert
      expect(result.verified).toBe(false);
      expect(result.rejection).toBeDefined();
      expect(result.rejection!.code).toBe('F06');
      expect(result.rejection!.message).toBeDefined();
    });
    ```

  - [x] Place these tests within the existing `describe('Verification Pipeline', ...)` block, after the existing ATDD tests

- [x] Task 4: Run tests and verify (AC: #1-#7)
  - [x] Run `cd packages/sdk && pnpm test` -- all 6 verification pipeline tests must pass
  - [x] Expected SDK test count: 53 (from Story 1.3) + 6 (this story) = 59 total (not counting skipped tests from later stories)
  - [x] Verify no test regressions: `pnpm -r test` from project root

## Dev Notes

### What This Story Does

Enables 4 skipped ATDD tests (fixing 1 priority label), updates a stale ATDD comment, adds 2 new tests for Story 1.4, then removes the vitest exclude entry for `verification-pipeline.test.ts`. The core `createVerificationPipeline()` implementation already exists and appears correct -- verify by running tests.

### What Already Exists

These files exist from the ATDD Red Phase and previous stories:

- **`packages/sdk/src/verification-pipeline.ts`** -- Working `createVerificationPipeline()` function with `VerificationResult` and `VerificationPipelineConfig` types. The implementation includes:
  - `verify(meta: ToonRoutingMeta, _toonData: string): Promise<VerificationResult>` method
  - Dev mode check: if `config.devMode` is true, returns `{ verified: true }` immediately
  - Schnorr verification using `@noble/curves/secp256k1` `schnorr.verify(sigBytes, msgBytes, pubkeyBytes)`
  - Hex-to-bytes conversion using `@noble/hashes/utils` `hexToBytes()`
  - F06 rejection response on verification failure
  - Try/catch for malformed signature data (also returns F06)
  - **Potential issue to verify:** The current implementation verifies `schnorr.verify(sigBytes, msgBytes, pubkeyBytes)` where `msgBytes = hexToBytes(meta.id)`. This is the correct Nostr verification approach: the event `id` IS the message hash (SHA-256 of the serialized event). Verify this matches nostr-tools' `verifyEvent()` behavior.

- **`packages/sdk/src/verification-pipeline.test.ts`** -- 4 `.skip`ped tests using `createSignedToonPayload()` and `createTamperedToonPayload()` helper functions. Missing: tampered content test (T-1.4-03) and devMode default-false test (T-1.4-05).

- **`packages/sdk/vitest.config.ts`** -- Excludes `verification-pipeline.test.ts` in the `exclude` array (line 19). Must be updated.

- **`packages/sdk/src/index.ts`** -- Already exports `createVerificationPipeline`, `VerificationResult`, `VerificationPipelineConfig`. No changes needed.

**No new files are created by this story.** Only 2 existing files are modified.

### Exact Code Changes

**File 1: `packages/sdk/vitest.config.ts`** -- Remove 1 line from `exclude` array

Remove: `'src/verification-pipeline.test.ts',`

Update the ATDD comment: `//   verification-pipeline.test.ts -> Story 1.4 (done)`

**File 2: `packages/sdk/src/verification-pipeline.test.ts`** -- Remove `.skip` from 4 tests, fix 1 priority label, update stale comment, add 2 new tests

1. Update the stale ATDD Red Phase comment on line 10 to `// ATDD tests for Story 1.4 -- verification pipeline`
2. Change all `it.skip(` to `it(` (4 occurrences)
3. Change ATDD test 4's label from `'[P1] verification uses only shallow-parsed fields (no full decode)'` to `'[P0] verification uses only shallow-parsed fields (no full decode)'` (matches test-design T-1.4-06 P0 priority for E1-R07 high-risk mitigation)
4. Add the 2 new tests (tampered content T-1.4-03/AC #6, devMode explicit-false T-1.4-05/AC #7)

### Architecture Pattern Compliance

The verification pipeline follows the TOON pipeline ordering invariant from the architecture doc:

```
ILP Packet
  -> PaymentHandlerBridge (isTransit check)           [Story 1.6]
    -> Shallow TOON Parse (extract kind, pubkey, id, sig)  [Story 1.0]
      -> Schnorr Signature Verification                    [Story 1.4 -- THIS STORY]
        -> Pricing Validation                              [Story 1.5]
          -> HandlerRegistry.dispatch(kind)                [Story 1.2]
            -> Handler(ctx) -> ctx.accept()/reject()       [Story 1.3]
```

The verification module accepts `ToonRoutingMeta` (from shallow parse), NOT a `NostrEvent` (from full decode). This is architecturally correct per the pipeline ordering invariant -- verification must operate on shallow-parsed fields from the serialized event bytes, not decoded event objects.

[Source: _bmad-output/planning-artifacts/architecture.md#SDK Pipeline Test Strategy]
[Source: _bmad-output/planning-artifacts/test-design-epic-1.md#3.1 The Pipeline Ordering Invariant]

### Schnorr Verification Details

The Nostr event `id` field is the SHA-256 hash of the serialized event (kind, pubkey, created_at, tags, content). The `sig` field is a Schnorr signature over this hash. Verification checks:

```
schnorr.verify(signature, message, publicKey)
  where signature = hexToBytes(meta.sig)     // 64 bytes (128 hex chars)
        message   = hexToBytes(meta.id)      // 32 bytes (64 hex chars) -- the event hash
        publicKey = hexToBytes(meta.pubkey)   // 32 bytes (64 hex chars) -- x-only pubkey
```

This matches the NIP-01 verification spec. The `@noble/curves` `schnorr.verify()` is the same library used internally by `nostr-tools`, ensuring cryptographic consistency.

### Dependencies

- **Upstream**: Story 1.0 (TOON codec in `@crosstown/core` provides `ToonRoutingMeta` type and `shallowParseToon` function). Already implemented and available.
- **Downstream**: Story 1.7 (createNode) wires verification into the full pipeline. Story 1.10 (Dev Mode) extends the devMode bypass with debug logging (completing AC #4's logging requirement).

### AC #4 Deferral Rationale

The epics.md AC for devMode says "a debug log is emitted noting the skipped verification." The current `verification-pipeline.ts` implementation returns `{ verified: true }` immediately without logging. Adding a logger dependency to this module solely for AC #4 would introduce unnecessary coupling. Instead:

- **This story (1.4):** Validates that `devMode: true` skips verification (the behavioral part of AC #4, tested by ATDD test 3).
- **Story 1.10 (Dev Mode):** Adds structured debug logging across all devMode bypass paths (verification, pricing), completing the logging part of AC #4.

This split is consistent with the architecture doc's Cross-Cutting Concern #6 (Dev Mode) which treats logging as part of the dev mode toggle, not as part of individual pipeline stages.

### Previous Story Learnings (from Stories 1.2 and 1.3)

- `vitest.config.ts` does NOT use `globals: true` -- all test files explicitly import `describe`, `it`, `expect`, `vi` from `vitest`
- ESM imports use `.js` extensions: `import { createVerificationPipeline } from './verification-pipeline.js'` (already correct in the test file)
- The ATDD test file already follows AAA pattern correctly
- When enabling tests, do NOT modify the existing test logic -- just remove `.skip`
- TypeScript strict mode with `noPropertyAccessFromIndexSignature` is active -- use bracket notation for index signatures if needed
- When removing a test file from vitest excludes, also update the ATDD comment to mark the story as `(done)` for clarity (established in Story 1.2 review)
- Update stale ATDD Red Phase comments (e.g., "tests will fail until implementation exists") to reflect current state -- the implementation already exists (established in Story 1.3 review)
- Verify that test priority labels in test description strings ([P0], [P1]) match the test-design priority for the corresponding test ID -- mismatches undermine risk traceability

[Source: _bmad-output/implementation-artifacts/1-3-handlercontext-with-toon-passthrough-and-lazy-decode.md#Previous Story Learnings]
[Source: _bmad-output/implementation-artifacts/1-2-handler-registry-with-kind-based-routing.md#Previous Story Learnings]

### Test Design

[Source: _bmad-output/planning-artifacts/test-design-epic-1.md#Story 1.4]

**Note:** The test-design-epic-1.md defines 6 tests (T-1.4-01 through T-1.4-06) for this story. The ATDD Red Phase wrote 4 of these. Missing from the ATDD Red Phase: T-1.4-03 (tampered content -> F06) and T-1.4-05 (devMode default -> no bypass leak).

| ATDD Test | Test-Design IDs | Test                                                                      | AC  | Level           | Risk   | Priority | Status   |
| --------- | --------------- | ------------------------------------------------------------------------- | --- | --------------- | ------ | -------- | -------- |
| 1         | T-1.4-01        | Valid Schnorr signature passes verification, event dispatched             | #1  | U (real crypto) | -      | P0       | Existing |
| 2         | T-1.4-02        | Invalid signature rejected with F06, handler NEVER invoked               | #2  | U (real crypto) | E1-R06 | P0       | Existing |
| 3         | T-1.4-04        | devMode=true -> invalid signature accepted, handler invoked              | #3  | U               | -      | P0       | Existing |
| 4         | T-1.4-06        | Verification uses shallow parse fields (id, pubkey, sig), NOT full decode| #5  | U               | E1-R07 | P0       | Existing (priority label fix: [P1]->[P0]) |
| NEW-1     | T-1.4-03        | Tampered event content -> signature mismatch -> F06                      | #6  | U (real crypto) | -      | P0       | **NEW**  |
| NEW-2     | T-1.4-05        | devMode explicitly false -> invalid sig -> F06 (no bypass leak)          | #7  | U (real crypto) | E1-R06 | P0       | **NEW**  |

All 6 test-design IDs (T-1.4-01 through T-1.4-06) are covered by 6 tests (4 existing + 2 new).

**AC #4 coverage note:** AC #4 (debug log on devMode skip) is partially covered by ATDD test 3 which validates the skip behavior. The debug log emission itself is deferred to Story 1.10 (Dev Mode), which extends the devMode bypass with structured logging. This matches the Dependencies section and avoids modifying the existing `verification-pipeline.ts` implementation solely for logging.

**ATDD test 3 priority correction:** The test-design-epic-1.md lists T-1.4-04 as P1 (devMode skip is lower risk than signature rejection). The ATDD file correctly labels it `[P0]` in the test string. However, the previous version of this story's table showed P1. Updated to P0 to match the test file's actual label. Both P0 and P1 are defensible; P0 is kept for consistency with the existing test string.

**Risk E1-R06** (score 6, high): devMode defaults to true or has env var override, leaking bypass to production. Mitigated by ATDD test 2 (invalid sig -> F06 with devMode false) and NEW-2 test (explicit default behavior test).

**Risk E1-R07** (score 6, high): Verification runs AFTER full decode (trusts decode, defeats purpose). Mitigated by ATDD test 4 which verifies the function signature accepts `ToonRoutingMeta`, not `NostrEvent`.

### ILP Error Codes

| Code  | Name               | When Used                              |
| ----- | ------------------ | -------------------------------------- |
| `F06` | Unexpected Payment | Invalid Schnorr signature (THIS STORY) |
| `F00` | Bad Request        | No handler matches the event kind (Story 1.2) |
| `F04` | Insufficient Amount | Underpaid event (Story 1.5)           |
| `T00` | Internal Error     | Unhandled handler exception (Story 1.6) |

### Coding Standards

- PascalCase for interface names: `VerificationResult`, `VerificationPipelineConfig`
- camelCase for function names: `createVerificationPipeline`
- No `any` -- uses typed `ToonRoutingMeta` from `@crosstown/core/toon`
- Co-located tests: `verification-pipeline.test.ts` next to `verification-pipeline.ts`
- AAA pattern in all tests (the existing ATDD tests already follow this)
- ESM `.js` extensions in imports (already correct in existing files)
- Real crypto in tests: uses `nostr-tools/pure` for `generateSecretKey`, `getPublicKey`, `finalizeEvent` and `@crosstown/core/toon` for `encodeEventToToon`, `shallowParseToon`

### Critical Rules

- Do NOT modify `verification-pipeline.ts` UNLESS the existing tests fail -- the implementation appears complete and correct
- Do NOT rename the file -- it is `verification-pipeline.ts` (kebab-case)
- Do NOT create any new files
- Do NOT remove any other test files from the vitest exclude list -- they belong to later stories
- Do NOT add `process.env` reads for devMode -- it is config-driven only (prevents E1-R06 bypass leak)
- The `_toonData` parameter in `verify()` is intentionally unused (underscore prefix) -- verification works from `ToonRoutingMeta` fields only, NOT from the TOON string
- Do NOT add logging to `verification-pipeline.ts` for the devMode skip -- logging is deferred to Story 1.10 (Dev Mode) per the AC #4 deferral rationale
- DO update ATDD test 4's priority label from `[P1]` to `[P0]` -- it mitigates risk E1-R07 (score 6, high)

### Project Structure Notes

- File naming: `verification-pipeline.ts` (kebab-case) is correct per project convention, consistent with `handler-context.ts`, `handler-registry.ts`, `pricing-validator.ts`, etc.
- The architecture doc's source tree shows `verification.ts` (PascalCase) but the ATDD Red Phase established kebab-case file names with more descriptive names (e.g., `verification-pipeline.ts` instead of `verification.ts`).
- No new files created. No new exports added to `index.ts`.

### Crypto Library Dependencies

The verification pipeline uses `@noble/curves` and `@noble/hashes` which are already declared in `packages/sdk/package.json`:

```json
"@noble/curves": "^2.0.0",
"@noble/hashes": "^2.0.0"
```

These are the same underlying libraries used by `nostr-tools` for Schnorr signing/verification, ensuring cryptographic compatibility.

The test file uses `nostr-tools/pure` for generating test events (which internally uses `@noble/curves`), and `@crosstown/core/toon` for TOON encoding/shallow parsing.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.4]
- [Source: _bmad-output/planning-artifacts/epics.md#FR Coverage Map -- FR-SDK-4]
- [Source: _bmad-output/planning-artifacts/architecture.md#SDK Pipeline Test Strategy]
- [Source: _bmad-output/planning-artifacts/architecture.md#Cross-Cutting Concerns: Verification Pipeline]
- [Source: _bmad-output/planning-artifacts/test-design-epic-1.md#Story 1.4]
- [Source: _bmad-output/test-artifacts/atdd-checklist-epic-1-sdk.md#Story 1.4]
- [Source: packages/sdk/src/verification-pipeline.ts -- existing implementation]
- [Source: packages/sdk/src/verification-pipeline.test.ts -- ATDD Red Phase tests]
- [Source: _bmad-output/implementation-artifacts/1-3-handlercontext-with-toon-passthrough-and-lazy-decode.md -- previous story patterns]
- [Source: packages/core/src/toon/shallow-parse.ts -- ToonRoutingMeta type definition]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

None required -- all tests passed on first run.

### Completion Notes List

- **Task 1**: Removed `src/verification-pipeline.test.ts` from the `exclude` array in `packages/sdk/vitest.config.ts`. Updated the ATDD comment to mark Story 1.4 as `(done)`. No other excluded test files were touched.
- **Task 2**: Enabled all 4 skipped ATDD tests by changing `it.skip(` to `it(`. Updated the stale ATDD Red Phase comment to `// ATDD tests for Story 1.4 -- verification pipeline`. Fixed ATDD test 4 priority label from `[P1]` to `[P0]` to match test-design T-1.4-06 (risk E1-R07, high).
- **Task 3**: Added 2 new tests: (1) tampered event content causes signature mismatch and F06 rejection (T-1.4-03, AC #6), (2) devMode explicitly false produces F06 with no bypass leak (T-1.4-05, AC #7, risk E1-R06). Both placed within the existing `describe('Verification Pipeline', ...)` block after the 4 ATDD tests.
- **Task 4**: All 6 verification pipeline tests pass. SDK total: 59 passed, 13 skipped (matches expected count). Full monorepo `pnpm -r test` passes with zero regressions across all packages (sdk, core, client, relay, bls, docker).
- **No changes** were needed to `verification-pipeline.ts` -- the existing implementation was correct and all tests passed against it.

### File List

- `packages/sdk/vitest.config.ts` -- modified (removed exclude entry, updated ATDD comment)
- `packages/sdk/src/verification-pipeline.test.ts` -- modified (unskipped 4 tests, fixed priority label, updated stale comment, added 2 new tests)

## Code Review Record

### Review Pass #1

- **Date:** 2026-03-04
- **Reviewer Model:** Claude Opus 4.6 (claude-opus-4-6)
- **Issues Found:**
  - Critical: 0
  - High: 0
  - Medium: 0
  - Low: 0
- **Files Modified:** None
- **Outcome:** Pass -- implementation approved with zero issues. No action items or follow-up tasks generated.

### Review Pass #2

- **Date:** 2026-03-04
- **Reviewer Model:** Claude Opus 4.6 (claude-opus-4-6)
- **Issues Found:**
  - Critical: 0
  - High: 0
  - Medium: 0
  - Low: 0
- **Files Modified:** None
- **Outcome:** Pass -- second review confirms zero issues. No code modifications required, no action items generated. Implementation remains correct and complete.

### Review Pass #3

- **Date:** 2026-03-04
- **Reviewer Model:** Claude Opus 4.6 (claude-opus-4-6)
- **Issues Found:**
  - Critical: 0
  - High: 0
  - Medium: 0
  - Low: 0
- **Files Modified:** None
- **Outcome:** Pass -- third and final review confirms zero issues. No code modifications required, no action items generated. Implementation approved as correct and complete.

## Change Log

| Date       | Version | Description         | Author |
| ---------- | ------- | ------------------- | ------ |
| 2026-03-04 | 0.1     | Initial story draft | SM     |
| 2026-03-04 | 0.2     | Adversarial review: added AC #6 (tampered content -> F06) and AC #7 (devMode explicit false -> F06) to close test-design coverage gaps; clarified AC #4 deferral of debug logging to Story 1.10 with rationale; fixed ATDD test 4 priority label mismatch ([P1] -> [P0] per test-design T-1.4-06 / risk E1-R07); added stale ATDD comment update subtask (per Story 1.3 review precedent); added AC column to test table for traceability; corrected Task AC mappings to reference new ACs; updated NEW-2 test name from "defaults to false" to "explicitly false" since VerificationPipelineConfig requires devMode (not optional); added AC #4 deferral rationale section; added priority label and stale comment guidance to Previous Story Learnings and Critical Rules; updated ATDD test 3 priority note in table; fixed Task 2 title to include stale comment update | Review |
| 2026-03-04 | 1.0     | Implementation complete. Enabled 4 ATDD tests, fixed priority label, updated stale comment, added 2 new tests (tampered content T-1.4-03, devMode explicit-false T-1.4-05). All 6 verification pipeline tests pass. 59 SDK tests total, zero regressions across monorepo. No changes to verification-pipeline.ts implementation. | Claude Opus 4.6 |
| 2026-03-04 | 1.0-cr1 | Code Review #1 passed with zero issues. Added Code Review Record section. No code changes, no action items. | Claude Opus 4.6 |
| 2026-03-04 | 1.0-cr2 | Code Review #2 passed with zero issues. No code changes, no action items. | Claude Opus 4.6 |
| 2026-03-04 | 1.0-cr3 | Code Review #3 (final) passed with zero issues. No code changes, no action items. Status -> done. | Claude Opus 4.6 |
