---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-generate-tests', 'step-04c-aggregate', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-03-16'
workflowType: 'testarch-atdd'
inputDocuments:
  - '_bmad-output/implementation-artifacts/5-1-dvm-event-kind-definitions.md'
  - 'packages/core/src/events/attestation.ts'
  - 'packages/core/src/events/attestation.test.ts'
  - 'packages/core/src/events/service-discovery.ts'
  - 'packages/core/src/events/service-discovery.test.ts'
  - 'packages/core/src/events/index.ts'
  - 'packages/core/src/index.ts'
  - 'packages/core/src/constants.ts'
  - 'packages/core/src/errors.ts'
  - 'packages/core/src/toon/encoder.ts'
  - 'packages/core/src/toon/decoder.ts'
  - 'packages/core/src/toon/shallow-parse.ts'
  - 'packages/core/vitest.config.ts'
---

# ATDD Checklist - Epic 5, Story 5.1: DVM Event Kind Definitions

**Date:** 2026-03-16
**Author:** Jonathan
**Primary Test Level:** Unit

---

## Story Summary

Define NIP-90 compatible DVM event kinds for the TOON protocol with full TOON encoding support, enabling agents to post structured job requests, receive feedback, and collect results using the standard DVM protocol.

**As a** protocol developer
**I want** NIP-90 compatible DVM event kinds defined for the TOON protocol with full TOON encoding support
**So that** agents can post structured job requests, receive feedback, and collect results using the standard DVM protocol

---

## Acceptance Criteria

1. `buildJobRequestEvent()` produces signed Kind 5xxx with NIP-90 tags: `i`, `bid`, `output`, optional `p`, `param`, `relays`
2. `buildJobResultEvent()` produces signed Kind 6xxx with tags: `e`, `p`, `amount` and content
3. `buildJobFeedbackEvent()` produces signed Kind 7000 with tags: `e`, `p`, `status` and optional content
4. DVM events survive TOON encode -> decode roundtrip with all tags, content, metadata intact
5. `shallowParseToon()` extracts kind, pubkey, id, sig from DVM events without full decode
6. DVM kind constants exported: `TEXT_GENERATION_KIND=5100`, `IMAGE_GENERATION_KIND=5200`, `TEXT_TO_SPEECH_KIND=5300`, `TRANSLATION_KIND=5302`, base constants `JOB_REQUEST_KIND_BASE=5000`, `JOB_RESULT_KIND_BASE=6000`, `JOB_FEEDBACK_KIND=7000`
7. `parseJobRequest()` detects targeted vs open marketplace requests via presence/absence of `p` tag

---

## Failing Tests Created (RED Phase)

### Unit Tests (84 tests)

**File:** `packages/core/src/events/dvm.test.ts` (1689 lines)

- **Test:** DVM kind constants (T-5.1-08) -- 7 tests
  - **Status:** RED - Constants not defined in constants.ts
  - **Verifies:** JOB_REQUEST_KIND_BASE=5000, JOB_RESULT_KIND_BASE=6000, JOB_FEEDBACK_KIND=7000, TEXT_GENERATION_KIND=5100, IMAGE_GENERATION_KIND=5200, TEXT_TO_SPEECH_KIND=5300, TRANSLATION_KIND=5302

- **Test:** buildJobRequestEvent signature verification (T-5.1-12) -- 1 test
  - **Status:** RED - Module ./dvm.js does not exist
  - **Verifies:** Schnorr signature passes verifyEvent(), kind, pubkey, id, sig format

- **Test:** buildJobRequestEvent NIP-90 i tag format (T-5.1-09) -- 3 tests
  - **Status:** RED - Module not found
  - **Verifies:** `['i', data, type]`, `['i', data, type, relay]`, `['i', data, type, relay, marker]`

- **Test:** buildJobRequestEvent bid tag USDC micro-units (T-5.1-11) -- 1 test
  - **Status:** RED - Module not found
  - **Verifies:** `['bid', amount, 'usdc']` format

- **Test:** buildJobRequestEvent output tag -- 1 test
  - **Status:** RED - Module not found
  - **Verifies:** `['output', mimeType]` format

- **Test:** buildJobRequestEvent targeted vs open marketplace (T-5.1-10) -- 2 tests
  - **Status:** RED - Module not found
  - **Verifies:** p tag present = targeted, absent = open marketplace

- **Test:** buildJobRequestEvent multiple param tags (T-5.1-25) -- 1 test
  - **Status:** RED - Module not found
  - **Verifies:** `['param', key, value]` for each entry in params

- **Test:** buildJobRequestEvent relays tag (T-5.1-24) -- 1 test
  - **Status:** RED - Module not found
  - **Verifies:** `['relays', url1, url2, url3]` format

- **Test:** buildJobRequestEvent content field -- 2 tests
  - **Status:** RED - Module not found
  - **Verifies:** content from params, empty string default

- **Test:** buildJobRequestEvent validation errors (T-5.1-05) -- 5 tests
  - **Status:** RED - Module not found
  - **Verifies:** throws for missing input, bid, output, empty bid, empty output

- **Test:** buildJobRequestEvent kind range validation (T-5.1-18) -- 4 tests
  - **Status:** RED - Module not found
  - **Verifies:** rejects 4999/6000, accepts 5000/5999

- **Test:** buildJobResultEvent signature verification (T-5.1-13) -- 1 test
  - **Status:** RED - Module not found
  - **Verifies:** Schnorr signature, kind 6100

- **Test:** buildJobResultEvent required tags -- 4 tests
  - **Status:** RED - Module not found
  - **Verifies:** e, p, amount tags and content field

- **Test:** buildJobResultEvent validation errors (T-5.1-06) -- 5 tests
  - **Status:** RED - Module not found
  - **Verifies:** throws for missing/invalid requestEventId, customerPubkey, amount

- **Test:** buildJobResultEvent kind range validation (T-5.1-19) -- 4 tests
  - **Status:** RED - Module not found
  - **Verifies:** rejects 5999/7000, accepts 6000/6999

- **Test:** buildJobFeedbackEvent signature verification (T-5.1-14) -- 1 test
  - **Status:** RED - Module not found
  - **Verifies:** Schnorr signature, kind 7000

- **Test:** buildJobFeedbackEvent required tags -- 3 tests
  - **Status:** RED - Module not found
  - **Verifies:** e, p, status tags

- **Test:** buildJobFeedbackEvent DvmJobStatus values (T-5.1-07) -- 5 tests
  - **Status:** RED - Module not found
  - **Verifies:** accepts processing/error/success/partial, rejects invalid

- **Test:** buildJobFeedbackEvent content field -- 2 tests
  - **Status:** RED - Module not found
  - **Verifies:** content from params, empty string default

- **Test:** buildJobFeedbackEvent validation errors -- 2 tests
  - **Status:** RED - Module not found
  - **Verifies:** invalid requestEventId, customerPubkey

- **Test:** parseJobRequest builder-parser roundtrip (T-5.1-15) -- 1 test
  - **Status:** RED - Module not found
  - **Verifies:** all fields survive build -> parse cycle

- **Test:** parseJobRequest targeted vs open marketplace (T-5.1-10) -- 2 tests
  - **Status:** RED - Module not found
  - **Verifies:** targetProvider present/undefined based on p tag

- **Test:** parseJobRequest rejection (T-5.1-20) -- 4 tests
  - **Status:** RED - Module not found
  - **Verifies:** null for wrong kind, missing i/bid/output tags

- **Test:** parseJobResult builder-parser roundtrip (T-5.1-16) -- 1 test
  - **Status:** RED - Module not found
  - **Verifies:** all fields survive build -> parse cycle

- **Test:** parseJobResult rejection (T-5.1-20) -- 4 tests
  - **Status:** RED - Module not found
  - **Verifies:** null for wrong kind, missing e/p/amount tags

- **Test:** parseJobFeedback builder-parser roundtrip (T-5.1-17) -- 1 test
  - **Status:** RED - Module not found
  - **Verifies:** all fields survive build -> parse cycle

- **Test:** parseJobFeedback status validation (T-5.1-07) -- 1 test
  - **Status:** RED - Module not found
  - **Verifies:** null for invalid status value

- **Test:** parseJobFeedback rejection (T-5.1-20) -- 4 tests
  - **Status:** RED - Module not found
  - **Verifies:** null for wrong kind, missing e/p/status tags

- **Test:** Kind 5100 TOON roundtrip (T-5.1-01) -- 1 test
  - **Status:** RED - Module not found
  - **Verifies:** all required + optional tags preserved through TOON encode/decode

- **Test:** Kind 6100 TOON roundtrip (T-5.1-02) -- 1 test
  - **Status:** RED - Module not found
  - **Verifies:** required tags + content preserved

- **Test:** Kind 7000 TOON roundtrip (T-5.1-03) -- 1 test
  - **Status:** RED - Module not found
  - **Verifies:** required tags + content preserved

- **Test:** TOON tag order preservation (T-5.1-22) -- 1 test
  - **Status:** RED - Module not found
  - **Verifies:** decoded tag order matches original

- **Test:** shallowParseToon DVM kind extraction (T-5.1-04) -- 3 tests
  - **Status:** RED - Module not found
  - **Verifies:** kind/pubkey/id/sig for 5100, 6100, 7000

- **Test:** Edge cases (T-5.1-21) -- 3 tests
  - **Status:** RED - Module not found
  - **Verifies:** empty content, large content >10KB, many tags >20

- **Test:** Export verification (T-5.1-23) -- 3 tests
  - **Status:** RED - Exports not defined
  - **Verifies:** constants, builders, parsers importable from @toon-protocol/core

---

## Data Factories Created

### JobRequestParams Factory

**File:** `packages/core/src/events/dvm.test.ts` (inline)

**Exports:**
- `createJobRequestParams(overrides?)` - Create JobRequestParams with deterministic defaults (kind 5100, text input, 1 USDC bid)

### JobResultParams Factory

**File:** `packages/core/src/events/dvm.test.ts` (inline)

**Exports:**
- `createJobResultParams(overrides?)` - Create JobResultParams with deterministic defaults (kind 6100, 0.5 USDC amount)

### JobFeedbackParams Factory

**File:** `packages/core/src/events/dvm.test.ts` (inline)

**Exports:**
- `createJobFeedbackParams(overrides?)` - Create JobFeedbackParams with deterministic defaults (processing status)

### Test Event Factories

**File:** `packages/core/src/events/dvm.test.ts` (inline)

**Exports:**
- `createTestJobRequestEvent(overrides?)` - Create manual Kind 5xxx event for parser tests (independent of builder)
- `createTestJobResultEvent(overrides?)` - Create manual Kind 6xxx event for parser tests
- `createTestJobFeedbackEvent(overrides?)` - Create manual Kind 7000 event for parser tests

---

## Fixtures Created

No external fixture files needed. All test infrastructure is co-located in the test file following the established pattern from `attestation.test.ts` and `service-discovery.test.ts`. Factory functions create deterministic test data inline.

---

## Mock Requirements

No external service mocking required. Story 5.1 is pure library code (builders, parsers, constants). All dependencies (`nostr-tools/pure`, `@toon-format/toon`) are used directly without mocking.

---

## Required data-testid Attributes

Not applicable. Story 5.1 is backend library code with no UI components.

---

## Implementation Checklist

### Test: DVM kind constants (T-5.1-08)

**File:** `packages/core/src/events/dvm.test.ts`

**Tasks to make this test pass:**

- [ ] Add `JOB_REQUEST_KIND_BASE = 5000` to `packages/core/src/constants.ts`
- [ ] Add `JOB_RESULT_KIND_BASE = 6000` to `packages/core/src/constants.ts`
- [ ] Add `JOB_FEEDBACK_KIND = 7000` to `packages/core/src/constants.ts`
- [ ] Add `TEXT_GENERATION_KIND = 5100` to `packages/core/src/constants.ts`
- [ ] Add `IMAGE_GENERATION_KIND = 5200` to `packages/core/src/constants.ts`
- [ ] Add `TEXT_TO_SPEECH_KIND = 5300` to `packages/core/src/constants.ts`
- [ ] Add `TRANSLATION_KIND = 5302` to `packages/core/src/constants.ts`
- [ ] Add JSDoc on each constant explaining NIP-90 semantics
- [ ] Run test: `npx vitest run packages/core/src/events/dvm.test.ts`

**Estimated Effort:** 0.5 hours

---

### Test: buildJobRequestEvent (T-5.1-05, T-5.1-09, T-5.1-11, T-5.1-12, T-5.1-18)

**File:** `packages/core/src/events/dvm.test.ts`

**Tasks to make this test pass:**

- [ ] Create `packages/core/src/events/dvm.ts`
- [ ] Define `JobRequestParams` interface with fields: kind, input, bid, output, content?, targetProvider?, params?, relays?
- [ ] Define `DvmJobStatus` type: `'processing' | 'error' | 'success' | 'partial'`
- [ ] Implement `buildJobRequestEvent(params, secretKey)` using `finalizeEvent()`
- [ ] Add kind range validation (5000-5999), throw `ToonError` for invalid range
- [ ] Add required param validation: input, bid (non-empty), output (non-empty)
- [ ] Construct tags: i, bid (with 'usdc'), output, optional p/param/relays
- [ ] Run test: `npx vitest run packages/core/src/events/dvm.test.ts -t "buildJobRequestEvent"`

**Estimated Effort:** 1.5 hours

---

### Test: buildJobResultEvent (T-5.1-06, T-5.1-13, T-5.1-19)

**File:** `packages/core/src/events/dvm.test.ts`

**Tasks to make this test pass:**

- [ ] Define `JobResultParams` interface with fields: kind, requestEventId, customerPubkey, amount, content
- [ ] Implement `buildJobResultEvent(params, secretKey)` using `finalizeEvent()`
- [ ] Add kind range validation (6000-6999), throw `ToonError`
- [ ] Add 64-char hex validation for requestEventId and customerPubkey
- [ ] Add non-empty string validation for amount
- [ ] Construct tags: e, p, amount (with 'usdc')
- [ ] Run test: `npx vitest run packages/core/src/events/dvm.test.ts -t "buildJobResultEvent"`

**Estimated Effort:** 1 hour

---

### Test: buildJobFeedbackEvent (T-5.1-07, T-5.1-14)

**File:** `packages/core/src/events/dvm.test.ts`

**Tasks to make this test pass:**

- [ ] Define `JobFeedbackParams` interface with fields: requestEventId, customerPubkey, status, content?
- [ ] Implement `buildJobFeedbackEvent(params, secretKey)` using `finalizeEvent()` with fixed kind 7000
- [ ] Add 64-char hex validation for requestEventId and customerPubkey
- [ ] Add DvmJobStatus validation (must be one of processing/error/success/partial)
- [ ] Construct tags: e, p, status
- [ ] Run test: `npx vitest run packages/core/src/events/dvm.test.ts -t "buildJobFeedbackEvent"`

**Estimated Effort:** 0.75 hours

---

### Test: parseJobRequest (T-5.1-15, T-5.1-10, T-5.1-20)

**File:** `packages/core/src/events/dvm.test.ts`

**Tasks to make this test pass:**

- [ ] Define `ParsedJobRequest` interface
- [ ] Implement `parseJobRequest(event)` following lenient parse pattern
- [ ] Validate kind range 5000-5999, return null if not
- [ ] Extract required tags: i (data, type, relay?, marker?), bid (amount, currency), output (mimeType)
- [ ] Extract optional tags: p (targetProvider), param (collect all), relays
- [ ] Return null for missing required tags
- [ ] Run test: `npx vitest run packages/core/src/events/dvm.test.ts -t "parseJobRequest"`

**Estimated Effort:** 1 hour

---

### Test: parseJobResult (T-5.1-16, T-5.1-20)

**File:** `packages/core/src/events/dvm.test.ts`

**Tasks to make this test pass:**

- [ ] Define `ParsedJobResult` interface
- [ ] Implement `parseJobResult(event)` following lenient parse pattern
- [ ] Validate kind range 6000-6999, return null if not
- [ ] Extract required tags: e (requestEventId), p (customerPubkey), amount (cost, currency)
- [ ] Return null for missing required tags
- [ ] Run test: `npx vitest run packages/core/src/events/dvm.test.ts -t "parseJobResult"`

**Estimated Effort:** 0.75 hours

---

### Test: parseJobFeedback (T-5.1-17, T-5.1-07, T-5.1-20)

**File:** `packages/core/src/events/dvm.test.ts`

**Tasks to make this test pass:**

- [ ] Define `ParsedJobFeedback` interface
- [ ] Implement `parseJobFeedback(event)` following lenient parse pattern
- [ ] Validate kind is exactly 7000, return null if not
- [ ] Extract required tags: e (requestEventId), p (customerPubkey), status (validate DvmJobStatus)
- [ ] Return null for invalid status or missing required tags
- [ ] Run test: `npx vitest run packages/core/src/events/dvm.test.ts -t "parseJobFeedback"`

**Estimated Effort:** 0.75 hours

---

### Test: TOON roundtrip (T-5.1-01, T-5.1-02, T-5.1-03, T-5.1-22)

**File:** `packages/core/src/events/dvm.test.ts`

**Tasks to make this test pass:**

- [ ] Builders must produce valid NostrEvent objects that encode/decode through TOON
- [ ] No TOON codec changes expected (validates existing behavior)
- [ ] If tag order not preserved, investigate TOON format extension (E5-R001 escalation)
- [ ] Run test: `npx vitest run packages/core/src/events/dvm.test.ts -t "TOON roundtrip"`

**Estimated Effort:** 0 hours (passes once builders are implemented correctly)

---

### Test: shallowParseToon DVM events (T-5.1-04)

**File:** `packages/core/src/events/dvm.test.ts`

**Tasks to make this test pass:**

- [ ] No code changes to shallow parser expected
- [ ] Builders must produce valid events with correct kind/pubkey/id/sig
- [ ] Run test: `npx vitest run packages/core/src/events/dvm.test.ts -t "shallowParseToon"`

**Estimated Effort:** 0 hours (passes once builders are implemented correctly)

---

### Test: Export verification (T-5.1-23)

**File:** `packages/core/src/events/dvm.test.ts`

**Tasks to make this test pass:**

- [ ] Add DVM constant exports to `packages/core/src/constants.ts`
- [ ] Re-export DVM types, builders, parsers from `packages/core/src/events/index.ts`
- [ ] Re-export DVM constants from `packages/core/src/index.ts`
- [ ] Re-export DVM builders/parsers via events/index.ts -> index.ts chain
- [ ] Run test: `npx vitest run packages/core/src/events/dvm.test.ts -t "export verification"`

**Estimated Effort:** 0.5 hours

---

## Running Tests

```bash
# Run all failing tests for this story
npx vitest run packages/core/src/events/dvm.test.ts

# Run specific test group
npx vitest run packages/core/src/events/dvm.test.ts -t "buildJobRequestEvent"

# Run tests in watch mode
npx vitest packages/core/src/events/dvm.test.ts

# Run with verbose output
npx vitest run packages/core/src/events/dvm.test.ts --reporter=verbose

# Run tests with coverage
npx vitest run packages/core/src/events/dvm.test.ts --coverage
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**

- All tests written and failing (module-not-found errors)
- Factories created with deterministic data (no random values)
- Implementation checklist created mapping tests to code tasks
- No external fixtures or mocks needed

**Verification:**

- All tests run and fail as expected: `Error: Failed to load url ./dvm.js`
- Failure is due to missing implementation, not test bugs
- Test run output captured (see below)

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. **Start with constants** (T-5.1-08) -- add 7 DVM kind constants to constants.ts
2. **Create dvm.ts** with type definitions (JobRequestParams, JobResultParams, etc.)
3. **Implement builders** one at a time: buildJobRequestEvent, buildJobResultEvent, buildJobFeedbackEvent
4. **Implement parsers** one at a time: parseJobRequest, parseJobResult, parseJobFeedback
5. **Wire exports** through events/index.ts and index.ts
6. **Run tests after each builder/parser** to verify incremental progress

**Key Principles:**

- One builder/parser at a time (don't try to fix all at once)
- Follow `attestation.ts` pattern exactly (finalizeEvent, tag construction, lenient parsing)
- Use `ToonError` for validation errors (not generic Error)
- Handle `noUncheckedIndexedAccess`: tag elements are `string | undefined`
- Use `.js` extensions in all imports

**Progress Tracking:**

- Check off tasks in implementation checklist as completed
- Run `npx vitest run packages/core/src/events/dvm.test.ts` after each change

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

**DEV Agent Responsibilities:**

1. Verify all 84 tests pass (green phase complete)
2. Review code for quality (readability, maintainability)
3. Verify JSDoc on all exported functions and types
4. Ensure TypeScript strict mode compliance (noUncheckedIndexedAccess, noPropertyAccessFromIndexSignature)
5. Run `pnpm lint && pnpm format` to verify code style
6. Run full test suite: `pnpm test` to verify no regressions

---

## Next Steps

1. **Review this checklist** to understand the test structure
2. **Run failing tests** to confirm RED phase: `npx vitest run packages/core/src/events/dvm.test.ts`
3. **Begin implementation** using implementation checklist as guide
4. **Work one group at a time** (constants -> builders -> parsers -> exports)
5. **When all tests pass**, refactor code for quality
6. **When refactoring complete**, update story status

---

## Knowledge Base References Applied

This ATDD workflow consulted the following knowledge fragments:

- **data-factories.md** - Deterministic factory patterns for test data (no faker/random -- fixed values for reproducibility)
- **test-quality.md** - Test design principles (Given-When-Then via AAA, one assertion per test, determinism, isolation)
- **test-levels-framework.md** - Test level selection: Unit is primary for pure library code
- **Established patterns** - `attestation.test.ts` and `service-discovery.test.ts` for builder/parser test structure, factory functions, import patterns

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `npx vitest run packages/core/src/events/dvm.test.ts`

**Results:**

```
FAIL  packages/core/src/events/dvm.test.ts [ packages/core/src/events/dvm.test.ts ]
Error: Failed to load url ./dvm.js (resolved id: ./dvm.js) in
/Users/jonathangreen/Documents/toon/packages/core/src/events/dvm.test.ts.
Does the file exist?

 Test Files  1 failed (1)
      Tests  no tests
   Start at  12:35:09
   Duration  295ms
```

**Summary:**

- Total tests: 84 (in file, but none execute due to module-not-found)
- Passing: 0 (expected)
- Failing: 1 suite (expected -- module-not-found is the first error)
- Status: RED phase verified

**Expected Failure Messages:**
- Primary: `Error: Failed to load url ./dvm.js -- Does the file exist?`
- After dvm.ts is created but constants missing: `SyntaxError: The requested module does not provide an export named 'JOB_REQUEST_KIND_BASE'`

---

## Notes

- All tests follow the established co-located test pattern from `attestation.test.ts` and `service-discovery.test.ts`
- Factory functions use deterministic values (no faker/random) per project conventions
- Parser test events are constructed manually (not via builders) so parser tests are independent of builder correctness
- TOON roundtrip tests and shallowParseToon tests validate existing codec behavior -- no codec changes expected for DVM events
- Risk E5-R001 (TOON tag corruption) is gated by T-5.1-01, T-5.1-02, T-5.1-03 (all P0)

---

## Contact

**Questions or Issues?**

- Refer to `_bmad-output/implementation-artifacts/5-1-dvm-event-kind-definitions.md` for full story spec
- Refer to `_bmad-output/planning-artifacts/test-design-epic-5.md` for test design context
- Consult `packages/core/src/events/attestation.ts` as implementation pattern reference

---

**Generated by BMad TEA Agent** - 2026-03-16
