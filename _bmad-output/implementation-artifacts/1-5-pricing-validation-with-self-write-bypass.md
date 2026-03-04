# Story 1.5: Pricing Validation with Self-Write Bypass

Status: done

## Story

As a **service developer**,
I want the SDK to validate ILP payment amounts against configurable pricing before my handler is invoked,
So that underpaid events are automatically rejected and my own node's events are free.

**FRs covered:** FR-SDK-5 (Configurable pricing validation with per-byte and per-kind pricing, self-write bypass)

## Acceptance Criteria

1. An event with `amount < toonBytes.length * basePricePerByte` is rejected with ILP error code `F04` (insufficient amount), and the rejection metadata includes `required` and `received` amounts
2. A `kindPricing` map with overrides (e.g., `{ 23194: 0n }`) causes the kind-specific price to be used instead of per-byte calculation for events of that kind
3. An event where `ctx.pubkey` matches the node's own pubkey bypasses pricing (self-write is free), and the handler is invoked normally
4. When no `basePricePerByte` is configured, the default `10n` is applied
5. An event with `amount >= required` (overpaid) is accepted
6. An event with `amount == required` (exact payment) is accepted
7. Kind-specific pricing override takes precedence over per-byte base calculation

## Tasks / Subtasks

- [x] Task 1: Remove pricing-validator.test.ts from vitest exclude (AC: #1-#7)
  - [x] In `packages/sdk/vitest.config.ts`, remove the line `'src/pricing-validator.test.ts',` from the `exclude` array (line 19)
  - [x] Update the ATDD comment to mark Story 1.5 as done: `//   pricing-validator.test.ts -> Story 1.5 (done)`
  - [x] Do NOT remove any other excluded test files -- they belong to later stories

- [x] Task 2: Enable ATDD tests, update stale comment, fix priority labels (AC: #1, #2, #3, #4, #5, #6)
  - [x] In `packages/sdk/src/pricing-validator.test.ts`, change all 6 `it.skip(` calls to `it(` (remove `.skip`)
  - [x] Update the stale ATDD Red Phase comment (line 5) from `// ATDD Red Phase - tests will fail until implementation exists` to `// ATDD tests for Story 1.5 -- pricing validator` (the implementation already exists; keeping the old comment would be misleading, per Story 1.3/1.4 review precedent)
  - [x] **Priority label fix #1:** ATDD test 4 is labeled `[P0]` in the test file but test-design T-1.5-06 is P1 (default basePricePerByte, no risk mitigation). Update the test description string from `'[P0] default basePricePerByte is 10n when not specified'` to `'[P1] default basePricePerByte is 10n when not specified'` to match the test-design priority
  - [x] **Priority label fix #2:** ATDD test 5 is labeled `[P1]` in the test file but test-design T-1.5-01 is P0 (core per-byte pricing happy path). Update the test description string from `'[P1] overpaid event is accepted'` to `'[P0] overpaid event is accepted'` to match the test-design priority
  - [x] The ATDD Red Phase has 6 tests. The mapping from test-design-epic-1.md IDs to ATDD test file is:
    - ATDD test 1 [P0]: underpaid event produces F04 rejection with required/received metadata (AC: #1) -- covers test-design T-1.5-02
    - ATDD test 2 [P0]: kindPricing override changes price for specific kind (AC: #2) -- covers test-design T-1.5-03
    - ATDD test 3 [P0]: self-write bypass accepts event from own pubkey regardless of amount (AC: #3) -- covers test-design T-1.5-05
    - ATDD test 4 [P1]: default basePricePerByte is 10n when not specified (AC: #4) -- covers test-design T-1.5-06 (priority fix: [P0]->[P1])
    - ATDD test 5 [P0]: overpaid event is accepted (AC: #5) -- covers test-design T-1.5-01 (priority fix: [P1]->[P0])
    - ATDD test 6 [P1]: exactly-priced event is accepted (AC: #6) -- covers test-design T-1.5-07

- [x] Task 3: Add missing test (AC: #7)
  - [x] Add test [P0] for kind-specific pricing taking precedence over per-byte calculation (AC: #7, test-design T-1.5-04):

    ```typescript
    it('[P0] kindPricing override takes precedence over per-byte calculation', () => {
      // Arrange
      const validator = createPricingValidator({
        basePricePerByte: 10n,
        ownPubkey: 'ff'.repeat(32),
        kindPricing: { 1: 5n }, // Kind 1 costs 5n per byte instead of 10n
      });
      const meta = createMockMeta({ kind: 1, rawBytes: new Uint8Array(100) });
      // 100 bytes * 5n = 500n required (not 100 * 10n = 1000n)
      const amount = 500n;

      // Act
      const result = validator.validate(meta, amount);

      // Assert
      expect(result.accepted).toBe(true);
    });
    ```

  - [x] Place this test within the existing `describe('Pricing Validator', ...)` block, after the existing ATDD tests

- [x] Task 4: Run tests and verify (AC: #1-#7)
  - [x] Run `cd packages/sdk && pnpm test` -- all 9 pricing validator tests must pass (7 ATDD + 2 gap-filling)
  - [x] Expected SDK test count: 59 (from Story 1.4) + 9 (this story: 7 ATDD + 2 gap-filling) = 68 total (not counting skipped tests from later stories)
  - [x] Verify no test regressions: `pnpm -r test` from project root

## Dev Notes

### What This Story Does

Enables 6 skipped ATDD tests (fixing 2 priority labels), updates a stale ATDD comment, adds 1 new test for per-kind precedence (T-1.5-04), then removes the vitest exclude entry for `pricing-validator.test.ts`. The core `createPricingValidator()` implementation already exists and appears correct -- verify by running tests.

### What Already Exists

These files exist from the ATDD Red Phase and previous stories:

- **`packages/sdk/src/pricing-validator.ts`** -- Working `createPricingValidator()` function with `PricingValidatorConfig` and `PricingValidationResult` types. The implementation includes:
  - `validate(meta: ToonRoutingMeta, amount: bigint): PricingValidationResult` method
  - Self-write bypass: if `meta.pubkey === config.ownPubkey`, returns `{ accepted: true }` immediately
  - Kind-specific pricing override: checks `config.kindPricing && meta.kind in config.kindPricing`
  - Per-byte calculation: `BigInt(meta.rawBytes.length) * pricePerByte`
  - Default `basePricePerByte` via `config.basePricePerByte ?? 10n`
  - F04 rejection with `required` and `received` metadata on insufficient payment
  - **Potential issue to verify:** The `kindPricing` lookup uses `meta.kind in config.kindPricing` which checks for property existence in the record. Since `kindPricing` is typed as `Record<number, bigint>`, the `in` operator will correctly detect numeric keys. Verify this works for `{ 23194: 0n }` where the value is `0n` (falsy but present).

- **`packages/sdk/src/pricing-validator.test.ts`** -- 6 `.skip`ped tests using a `createMockMeta()` helper function. Missing: per-kind precedence test (T-1.5-04).

- **`packages/sdk/vitest.config.ts`** -- Excludes `pricing-validator.test.ts` in the `exclude` array (line 19). Must be updated.

- **`packages/sdk/src/index.ts`** -- Already exports `createPricingValidator`, `PricingValidatorConfig`, `PricingValidationResult`. No changes needed.

**No new files are created by this story.** Only 2 existing files are modified.

### Exact Code Changes

**File 1: `packages/sdk/vitest.config.ts`** -- Remove 1 line from `exclude` array

Remove: `'src/pricing-validator.test.ts',`

Update the ATDD comment: `//   pricing-validator.test.ts -> Story 1.5 (done)`

**File 2: `packages/sdk/src/pricing-validator.test.ts`** -- Remove `.skip` from 6 tests, fix 2 priority labels, update stale comment, add 1 new test

1. Update the stale ATDD Red Phase comment on line 5 to `// ATDD tests for Story 1.5 -- pricing validator`
2. Change all `it.skip(` to `it(` (6 occurrences)
3. Change ATDD test 4's label from `'[P0] default basePricePerByte is 10n when not specified'` to `'[P1] default basePricePerByte is 10n when not specified'` (matches test-design T-1.5-06 P1 priority)
4. Change ATDD test 5's label from `'[P1] overpaid event is accepted'` to `'[P0] overpaid event is accepted'` (matches test-design T-1.5-01 P0 priority -- core happy path)
5. Add the 1 new test (per-kind precedence T-1.5-04/AC #7)

### Architecture Pattern Compliance

The pricing validator follows the TOON pipeline ordering invariant from the architecture doc:

```
ILP Packet
  -> PaymentHandlerBridge (isTransit check)           [Story 1.6]
    -> Shallow TOON Parse (extract kind, pubkey, id, sig)  [Story 1.0]
      -> Schnorr Signature Verification                    [Story 1.4]
        -> Pricing Validation                              [Story 1.5 -- THIS STORY]
          -> HandlerRegistry.dispatch(kind)                [Story 1.2]
            -> Handler(ctx) -> ctx.accept()/reject()       [Story 1.3]
```

The pricing validator accepts `ToonRoutingMeta` (from shallow parse) and an `amount` (from the ILP packet). It does NOT access the full decoded `NostrEvent`. This is architecturally correct per the pipeline ordering invariant -- pricing validation must operate on shallow-parsed fields and raw byte length, not decoded event objects.

[Source: _bmad-output/planning-artifacts/architecture.md#SDK Pipeline Test Strategy]
[Source: _bmad-output/planning-artifacts/test-design-epic-1.md#3.1 The Pipeline Ordering Invariant]

### Pricing Logic Details

The pricing validator implements three layers of pricing:

1. **Self-write bypass** (checked first): If `meta.pubkey === config.ownPubkey`, the event is free. This enables nodes to publish their own events (e.g., kind:10032 ILP Peer Info) without paying themselves.

2. **Kind-specific pricing** (checked second): If `kindPricing` map contains the event's kind, that price-per-byte is used instead of the base rate. Example: `{ 23194: 0n }` makes SPSP requests free.

3. **Per-byte base pricing** (default): `amount >= rawBytes.length * basePricePerByte`. Default `basePricePerByte` is `10n`.

Error code `F04` (Insufficient Amount) is the standard ILP error for underpayment. The rejection includes `required` and `received` amounts as string metadata for debugging.

### Dependencies

- **Upstream**: Story 1.0 (TOON codec in `@crosstown/core` provides `ToonRoutingMeta` type with `rawBytes` field for byte-length pricing). Already implemented and available.
- **Cross-story boundary**: Story 1.1 (Identity module provides `ownPubkey` used for self-write bypass). The pricing validator receives `ownPubkey` as a config string -- no code dependency on the identity module, but the format must match. Both sides use lowercase hex pubkey strings. [Source: _bmad-output/planning-artifacts/test-design-epic-1.md#3.5 Story 1.5 -> Story 1.1 (Pricing -> Identity)]
- **Downstream**: Story 1.7 (createNode) wires pricing into the full pipeline between verification and handler dispatch. Story 1.10 (Dev Mode) adds pricing bypass when `devMode: true`.

### Previous Story Learnings (from Stories 1.2, 1.3, and 1.4)

- `vitest.config.ts` does NOT use `globals: true` -- all test files explicitly import `describe`, `it`, `expect` from `vitest`
- ESM imports use `.js` extensions: `import { createPricingValidator } from './pricing-validator.js'` (already correct in the test file)
- The ATDD test file already follows AAA pattern correctly
- When enabling tests, do NOT modify the existing test logic -- just remove `.skip`
- TypeScript strict mode with `noPropertyAccessFromIndexSignature` is active -- use bracket notation for index signatures if needed (the test file already uses `result.rejection!.metadata!['required']` correctly)
- When removing a test file from vitest excludes, also update the ATDD comment to mark the story as `(done)` for clarity (established in Story 1.2 review)
- Update stale ATDD Red Phase comments (e.g., "tests will fail until implementation exists") to reflect current state -- the implementation already exists (established in Story 1.3 review)
- Do NOT modify the implementation file unless existing tests fail (established in Story 1.4)
- Verify that test priority labels in test description strings ([P0], [P1]) match the test-design priority for the corresponding test ID -- mismatches undermine risk traceability (established in Story 1.4)

[Source: _bmad-output/implementation-artifacts/1-4-schnorr-signature-verification-pipeline.md#Previous Story Learnings]
[Source: _bmad-output/implementation-artifacts/1-3-handlercontext-with-toon-passthrough-and-lazy-decode.md#Previous Story Learnings]
[Source: _bmad-output/implementation-artifacts/1-2-handler-registry-with-kind-based-routing.md#Previous Story Learnings]

### Test Design

[Source: _bmad-output/planning-artifacts/test-design-epic-1.md#Story 1.5]

**Note:** The test-design-epic-1.md defines 7 tests (T-1.5-01 through T-1.5-07) for this story. The ATDD Red Phase wrote 6 of these. Missing from the ATDD Red Phase: T-1.5-04 (per-kind override takes precedence over per-byte calculation).

| ATDD Test | Test-Design IDs | Test                                                                      | AC  | Level | Risk   | Priority | Status   |
| --------- | --------------- | ------------------------------------------------------------------------- | --- | ----- | ------ | -------- | -------- |
| 1         | T-1.5-02        | Underpaid event produces F04 rejection with required/received metadata    | #1  | U     | -      | P0       | Existing |
| 2         | T-1.5-03        | kindPricing override changes price for specific kind (23194 = 0n)        | #2  | U     | -      | P0       | Existing |
| 3         | T-1.5-05        | Self-write bypass accepts event from own pubkey regardless of amount     | #3  | U     | E1-R08 | P0       | Existing |
| 4         | T-1.5-06        | Default basePricePerByte is 10n when not specified                       | #4  | U     | -      | P1       | Existing (priority label fix: [P0]->[P1]) |
| 5         | T-1.5-01        | Overpaid event is accepted                                               | #5  | U     | -      | P0       | Existing (priority label fix: [P1]->[P0]) |
| 6         | T-1.5-07        | Exactly-priced event is accepted                                         | #6  | U     | -      | P1       | Existing |
| NEW-1     | T-1.5-04        | kindPricing override takes precedence over per-byte calculation          | #7  | U     | -      | P0       | **NEW**  |

All 7 test-design IDs (T-1.5-01 through T-1.5-07) are covered by 7 tests (6 existing + 1 new).

**Risk E1-R08** (score 3, medium): Self-write pubkey comparison fails due to format mismatch (hex vs npub vs different case). The current implementation uses strict equality (`===`) on hex pubkey strings. The `ToonRoutingMeta.pubkey` field comes from shallow TOON parse which returns hex pubkeys. The node's own pubkey from the identity module (Story 1.1) is also hex format. No format mismatch risk exists because both sides use the same hex representation. The ATDD test (test 3) validates this path with matching hex pubkeys.

### ILP Error Codes

| Code  | Name               | When Used                              |
| ----- | ------------------ | -------------------------------------- |
| `F04` | Insufficient Amount | Underpaid event (THIS STORY)           |
| `F06` | Unexpected Payment | Invalid Schnorr signature (Story 1.4)  |
| `F00` | Bad Request        | No handler matches the event kind (Story 1.2) |
| `T00` | Internal Error     | Unhandled handler exception (Story 1.6) |

### Coding Standards

- PascalCase for interface names: `PricingValidatorConfig`, `PricingValidationResult`
- camelCase for function names: `createPricingValidator`
- No `any` -- uses typed `ToonRoutingMeta` from `@crosstown/core/toon`
- Co-located tests: `pricing-validator.test.ts` next to `pricing-validator.ts`
- AAA pattern in all tests (the existing ATDD tests already follow this)
- ESM `.js` extensions in imports (already correct in existing files)
- Bracket notation for index signature access: `result.rejection!.metadata!['required']` (already correct in existing tests per `noPropertyAccessFromIndexSignature`)

### Critical Rules

- Do NOT modify `pricing-validator.ts` UNLESS the existing tests fail -- the implementation appears complete and correct
- Do NOT rename the file -- it is `pricing-validator.ts` (kebab-case)
- Do NOT create any new files
- Do NOT remove any other test files from the vitest exclude list -- they belong to later stories
- Do NOT add `process.env` reads for pricing configuration -- it is config-driven only (consistent with verification pipeline pattern, prevents accidental production overrides)
- The `kindPricing` check uses `meta.kind in config.kindPricing` which correctly handles `0n` values (a kind priced at `0n` IS in the map, not undefined)
- Do NOT add devMode bypass to `pricing-validator.ts` -- devMode pricing bypass is deferred to Story 1.10 (Dev Mode), consistent with the verification pipeline's devMode deferral in Story 1.4
- DO update ATDD test 4's priority label from `[P0]` to `[P1]` -- T-1.5-06 is P1 in test-design (default config, no risk mitigation)
- DO update ATDD test 5's priority label from `[P1]` to `[P0]` -- T-1.5-01 is P0 in test-design (core per-byte pricing happy path)

### Project Structure Notes

- File naming: `pricing-validator.ts` (kebab-case) is correct per project convention, consistent with `verification-pipeline.ts`, `handler-context.ts`, `handler-registry.ts`, etc.
- The architecture doc's source tree shows `pricing.ts` but the ATDD Red Phase established more descriptive kebab-case names (e.g., `pricing-validator.ts` instead of `pricing.ts`). This is consistent with `verification-pipeline.ts` vs the architecture's `verification.ts`.
- No new files created. No new exports added to `index.ts`.

### Git Intelligence (Recent Commits)

The last 5 commits follow a consistent pattern:
```
0df2148 feat(1-4): enable Schnorr signature verification pipeline
54ec1b8 feat(1-3): enable HandlerContext with TOON passthrough and lazy decode
85d68d4 feat(1-2): implement handler registry with kind-based routing
5d41861 feat(1-1): implement unified identity from seed phrase
01e274e refactor(1-0): extract TOON codec to @crosstown/core
```

**Commit message convention:** `feat(<story-id>): <description>` for new stories. The expected commit for this story: `feat(1-5): enable pricing validation with self-write bypass`

**Pattern from Story 1.4:** Only 2 files were modified (vitest.config.ts + test file). No changes to the implementation file were needed. This story follows the same pattern.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.5]
- [Source: _bmad-output/planning-artifacts/epics.md#FR Coverage Map -- FR-SDK-5]
- [Source: _bmad-output/planning-artifacts/architecture.md#SDK Pipeline Test Strategy]
- [Source: _bmad-output/planning-artifacts/architecture.md#Cross-Cutting Concerns: Pricing Abstraction]
- [Source: _bmad-output/planning-artifacts/test-design-epic-1.md#Story 1.5]
- [Source: _bmad-output/test-artifacts/atdd-checklist-epic-1-sdk.md#Story 1.5]
- [Source: packages/sdk/src/pricing-validator.ts -- existing implementation]
- [Source: packages/sdk/src/pricing-validator.test.ts -- ATDD Red Phase tests]
- [Source: _bmad-output/implementation-artifacts/1-4-schnorr-signature-verification-pipeline.md -- previous story patterns]
- [Source: _bmad-output/planning-artifacts/test-design-epic-1.md#3.5 Story 1.5 -> Story 1.1 (Pricing -> Identity)]
- [Source: packages/core/src/toon/shallow-parse.ts -- ToonRoutingMeta type definition]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

None required -- all tests passed on first run.

### Completion Notes List

- **Task 1**: Removed `'src/pricing-validator.test.ts'` from vitest exclude array in `packages/sdk/vitest.config.ts`. Updated ATDD comment to mark Story 1.5 as `(done)`. No other excluded test files were touched.
- **Task 2**: Removed `.skip` from all 6 `it.skip(` calls in `packages/sdk/src/pricing-validator.test.ts`. Updated stale ATDD Red Phase comment to `// ATDD tests for Story 1.5 -- pricing validator`. Fixed priority label on test 4 from `[P0]` to `[P1]` (matches T-1.5-06). Fixed priority label on test 5 from `[P1]` to `[P0]` (matches T-1.5-01).
- **Task 3**: Added 7th test `[P0] kindPricing override takes precedence over per-byte calculation` at the end of the `describe('Pricing Validator', ...)` block, verifying AC #7 / T-1.5-04.
- **Task 4**: All 9 pricing validator tests pass (7 ATDD + 2 gap-filling). SDK total: 68 passed, 13 skipped. Full monorepo `pnpm -r test` passes with no regressions. Implementation file `pricing-validator.ts` was NOT modified (it was already correct).

### File List

- `packages/sdk/vitest.config.ts` -- modified (removed pricing-validator exclude, updated ATDD comment)
- `packages/sdk/src/pricing-validator.test.ts` -- modified (unskipped 6 tests, fixed 2 priority labels, updated stale comment, added 1 ATDD test + 2 gap-filling tests)

## Code Review Record

### Review Pass #1

- **Date**: 2026-03-04
- **Reviewer Model**: Claude Opus 4.6 (claude-opus-4-6)
- **Issues Found**: Critical: 0, High: 0, Medium: 0, Low: 1
- **Low Issues**:
  1. Stale test counts in implementation artifact -- Task 4 and Completion Notes referenced 66 total SDK tests and 7 pricing tests instead of correct 68 total and 9 pricing tests (reflecting 2 gap-filling tests added post-v1.0). Fixed in-place.
- **Action Items**: None (low issue fixed during review)
- **Outcome**: Pass -- all issues resolved, no code changes required, all 68 SDK tests pass

### Review Pass #2

- **Date**: 2026-03-04
- **Reviewer Model**: Claude Opus 4.6 (claude-opus-4-6)
- **Issues Found**: Critical: 0, High: 0, Medium: 0, Low: 0
- **Action Items**: None
- **Outcome**: Pass -- zero issues found, no changes required

### Review Pass #3 (Final)

- **Date**: 2026-03-04
- **Reviewer Model**: Claude Opus 4.6 (claude-opus-4-6)
- **Issues Found**: Critical: 0, High: 0, Medium: 0, Low: 0
- **Action Items**: None
- **Outcome**: Pass -- zero issues across all severity levels, no fixes needed. Story approved for done.

## Change Log

| Date       | Version | Description         | Author |
| ---------- | ------- | ------------------- | ------ |
| 2026-03-04 | 0.1     | Initial story draft | SM     |
| 2026-03-04 | 0.2     | Adversarial review: fixed 2 priority label mismatches (ATDD test 4 [P0]->[P1] per T-1.5-06, ATDD test 5 [P1]->[P0] per T-1.5-01); added cross-story dependency note for Story 1.1 -> 1.5 (identity -> pricing self-write bypass) per test-design section 3.5; added priority label fix subtasks to Task 2; updated Exact Code Changes for File 2 to include priority label fixes; added priority label verification to Previous Story Learnings and Critical Rules (per Story 1.4 precedent); added Change Log section for structural consistency with completed stories | Review |
| 2026-03-04 | 1.0     | Implementation complete: enabled 6 ATDD tests, fixed 2 priority labels, added 1 new test (T-1.5-04), removed vitest exclude. All 7 tests pass. No changes to pricing-validator.ts implementation. Commit: feat(1-5): enable pricing validation with self-write bypass | Claude Opus 4.6 |
| 2026-03-04 | 1.1     | Code review: fixed stale test counts in Task 4 and Completion Notes (66->68, 7->9) to reflect 2 gap-filling tests added post-v1.0. Updated File List description. Zero code issues found (0 critical, 0 high, 0 medium, 1 low doc-only fix). All 68 SDK tests pass. | Claude Opus 4.6 |
| 2026-03-04 | 1.2     | Code review pass #2: zero issues found across all severities (0 critical, 0 high, 0 medium, 0 low). No changes required. | Claude Opus 4.6 |
| 2026-03-04 | 1.3     | Code review pass #3 (final): zero issues across all severity levels. Status set to done. | Claude Opus 4.6 |
