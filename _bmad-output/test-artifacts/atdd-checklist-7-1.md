---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-generate-tests', 'step-04c-aggregate', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-03-21'
workflowType: 'testarch-atdd'
inputDocuments:
  - '_bmad-output/implementation-artifacts/7-1-deterministic-address-derivation.md'
  - '_bmad/tea/config.yaml'
  - 'packages/core/src/constants.ts'
  - 'packages/core/src/errors.ts'
  - 'packages/core/src/index.ts'
  - 'packages/core/src/identity/kms-identity.test.ts'
  - 'packages/core/src/errors.test.ts'
---

# ATDD Checklist - Epic 7, Story 7.1: Deterministic Address Derivation

**Date:** 2026-03-21
**Author:** Jonathan
**Primary Test Level:** Unit (backend, pure function, no UI)

---

## Preflight Summary

- **Stack detected:** backend (Node.js/TypeScript monorepo, Vitest, no Playwright/Cypress)
- **Test framework:** Vitest with `describe/it` blocks, AAA pattern
- **Story file:** `_bmad-output/implementation-artifacts/7-1-deterministic-address-derivation.md`
- **Story status:** ready-for-dev
- **Acceptance criteria:** 3 ACs identified
- **Test IDs from story:** T-7.1-01 through T-7.1-12 (13 tests including T-2.8a)
- **Risk items:** E7-R001 (address collision, score 6), E7-R002 (invalid ILP chars, score 4)

### Existing Patterns Identified

- **Constants:** `packages/core/src/constants.ts` -- all kind constants co-located; `ILP_ROOT_PREFIX` will be added here
- **Error classes:** `packages/core/src/errors.ts` -- `ToonError` base class with `code` field for domain errors
- **Core barrel file:** `packages/core/src/index.ts` -- re-exports from subdirectory barrel files (chain, events, identity, etc.)
- **Subdirectory pattern:** `packages/core/src/identity/`, `packages/core/src/chain/` -- each has barrel `index.ts`
- **Test patterns:** Co-located `*.test.ts`, AAA pattern, deterministic test data, `ToonError` assertion with `code` check

### Knowledge Base Fragments Loaded

- `data-factories.md` (core) -- factory patterns with overrides (not needed -- pure function, fixed test data)
- `test-quality.md` (core) -- deterministic, isolated, explicit, focused, fast
- `test-levels-framework.md` (core) -- unit vs integration vs E2E selection
- `test-priorities-matrix.md` (core) -- P0-P3 priority classification

### TEA Config Flags

- `tea_use_playwright_utils`: true (not applicable -- backend stack)
- `tea_use_pactjs_utils`: true (not applicable -- no microservice contracts)
- `tea_pact_mcp`: mcp (not applicable)
- `tea_browser_automation`: auto (not applicable -- backend stack)
- `test_stack_type`: auto -> detected as `backend`

---

## Generation Mode

**Mode:** AI Generation (default for backend stack)
**Rationale:** Pure utility function with zero side effects, no external dependencies, no UI. All tests are unit level using Vitest. Clear acceptance criteria with explicit test IDs from the story.

---

## Story Summary

**As a** TOON node operator,
**I want** my ILP address to be deterministically derived from my Nostr pubkey and my upstream peer's prefix,
**So that** address assignment is automatic, collision-resistant, and requires zero configuration.

---

## Acceptance Criteria

1. **AC #1: Child address derivation** -- `deriveChildAddress(parentPrefix, childPubkey)` returns `parentPrefix + '.' + first8HexChars(childPubkey)` at any depth
2. **AC #2: Root prefix constant** -- Genesis node uses `g.toon` as ILP root prefix, exported as `ILP_ROOT_PREFIX` from `@toon-protocol/core`
3. **AC #3: ILP address segment validation** -- Lowercases hex input, rejects non-hex/short pubkeys and invalid prefixes, output conforms to ILP address rules

---

## Test Strategy

| AC | Test ID(s) | Level | Priority | Rationale |
|----|-----------|-------|----------|-----------|
| #1 | T-7.1-01, T-7.1-02 | Unit | P0 | Core derivation logic -- must work correctly |
| #2 | T-7.1-03 | Unit | P0 | Constant value verification |
| #3 | T-7.1-04, T-7.1-05 | Unit | P0 | Output format correctness |
| #1 | T-7.1-06 | Unit | P1 | Collision property documentation |
| #1 | T-7.1-07 | Unit | P2 | Birthday paradox analysis |
| #3 | T-7.1-08, T-2.8a, T-2.8a-b | Unit | P0/P1 | Prefix validation errors |
| #3 | T-7.1-09, T-7.1-10 | Unit | P0 | Pubkey validation errors |
| #1 | T-7.1-11 | Unit | P0 | Determinism guarantee |
| #3 | T-7.1-12, T-7.1-12b | Unit | P1 | ILP address structure validity |
| #1,#2 | T-3.2 | Unit | P0 | Public API export verification |

**Total:** 15 tests in 1 test file

---

## Failing Tests Created (RED Phase)

### Unit Tests (15 tests)

**File:** `packages/core/src/address/derive-child-address.test.ts` (233 lines)

- **Test:** T-7.1-01: derives g.toon.abcd1234 from root prefix and 64-char pubkey
  - **Status:** RED - `deriveChildAddress` module does not exist
  - **Verifies:** AC #1 -- basic child address derivation

- **Test:** T-7.1-02: derives nested address g.toon.ef567890.11aabb22
  - **Status:** RED - `deriveChildAddress` module does not exist
  - **Verifies:** AC #1 -- nested derivation at arbitrary depth

- **Test:** T-7.1-03: exports g.toon as the ILP root prefix constant
  - **Status:** RED - `ILP_ROOT_PREFIX` not yet defined in constants.ts
  - **Verifies:** AC #2 -- root prefix constant

- **Test:** T-7.1-04: derived address segment contains only lowercase hex chars
  - **Status:** RED - `deriveChildAddress` module does not exist
  - **Verifies:** AC #3 -- output format validation

- **Test:** T-7.1-05: uppercase hex pubkey is lowercased to g.toon.abcd1234
  - **Status:** RED - `deriveChildAddress` module does not exist
  - **Verifies:** AC #3 -- case normalization

- **Test:** T-7.1-06: two pubkeys sharing 8-char prefix produce same derived address
  - **Status:** RED - `deriveChildAddress` module does not exist
  - **Verifies:** AC #1 -- collision is documented property

- **Test:** T-7.1-07: birthday paradox collision probability analysis
  - **Status:** RED - `deriveChildAddress` module does not exist (math tests pass independently but suite fails)
  - **Verifies:** Risk E7-R001 documentation

- **Test:** T-7.1-08: throws ToonError with ADDRESS_INVALID_PREFIX for empty prefix
  - **Status:** RED - `deriveChildAddress` module does not exist
  - **Verifies:** AC #3 -- prefix validation

- **Test:** T-2.8a: throws ToonError with ADDRESS_INVALID_PREFIX for uppercase in prefix
  - **Status:** RED - `deriveChildAddress` module does not exist
  - **Verifies:** AC #3 -- ILP address character validation

- **Test:** T-2.8a-b: throws ToonError with ADDRESS_INVALID_PREFIX for spaces in prefix
  - **Status:** RED - `deriveChildAddress` module does not exist
  - **Verifies:** AC #3 -- ILP address character validation

- **Test:** T-7.1-09: throws ToonError with ADDRESS_INVALID_PUBKEY for short pubkey
  - **Status:** RED - `deriveChildAddress` module does not exist
  - **Verifies:** AC #3 -- pubkey length validation

- **Test:** T-7.1-10: throws ToonError with ADDRESS_INVALID_PUBKEY for non-hex chars
  - **Status:** RED - `deriveChildAddress` module does not exist
  - **Verifies:** AC #3 -- pubkey hex validation

- **Test:** T-7.1-11: same inputs always produce same output (determinism)
  - **Status:** RED - `deriveChildAddress` module does not exist
  - **Verifies:** AC #1 -- deterministic derivation

- **Test:** T-7.1-12: derived address has valid ILP structure
  - **Status:** RED - `deriveChildAddress` module does not exist
  - **Verifies:** AC #3 -- ILP address structure

- **Test:** T-7.1-12b: deeply nested derivation maintains valid ILP structure
  - **Status:** RED - `deriveChildAddress` module does not exist
  - **Verifies:** AC #3 -- ILP address structure at depth

- **Test:** T-3.2: @toon-protocol/core exports deriveChildAddress and ILP_ROOT_PREFIX
  - **Status:** RED - symbols not yet exported from core barrel file
  - **Verifies:** AC #1, #2 -- public API completeness

---

## Data Factories Created

N/A -- `deriveChildAddress` is a pure function tested with fixed deterministic test data constants. No factory pattern needed.

---

## Fixtures Created

N/A -- No fixtures required. Tests use inline constants and direct function calls.

---

## Mock Requirements

N/A -- `deriveChildAddress` is a pure function with zero dependencies beyond `ToonError`. No mocking needed.

---

## Required data-testid Attributes

N/A -- Backend-only story, no UI components.

---

## Implementation Checklist

### Test: T-7.1-03 (ILP_ROOT_PREFIX constant)

**File:** `packages/core/src/address/derive-child-address.test.ts`

**Tasks to make this test pass:**

- [ ] Add `export const ILP_ROOT_PREFIX = 'g.toon';` to `packages/core/src/constants.ts`
- [ ] Add `ILP_ROOT_PREFIX` to the existing constants export block in `packages/core/src/index.ts`
- [ ] Run test: `npx vitest run packages/core/src/address/derive-child-address.test.ts -t "T-7.1-03"`
- [ ] Test passes (green phase)

**Estimated Effort:** 0.25 hours

---

### Tests: T-7.1-01, T-7.1-02, T-7.1-04, T-7.1-05, T-7.1-06, T-7.1-11 (Core derivation)

**File:** `packages/core/src/address/derive-child-address.test.ts`

**Tasks to make these tests pass:**

- [ ] Create `packages/core/src/address/derive-child-address.ts`
- [ ] Implement `deriveChildAddress(parentPrefix: string, childPubkey: string): string`
- [ ] Extract first 8 hex characters of `childPubkey`, lowercase, append as new segment
- [ ] Run tests: `npx vitest run packages/core/src/address/derive-child-address.test.ts -t "T-7.1-01|T-7.1-02|T-7.1-04|T-7.1-05|T-7.1-06|T-7.1-11"`
- [ ] All 6 tests pass (green phase)

**Estimated Effort:** 0.5 hours

---

### Tests: T-7.1-08, T-2.8a, T-2.8a-b, T-7.1-09, T-7.1-10 (Input validation)

**File:** `packages/core/src/address/derive-child-address.test.ts`

**Tasks to make these tests pass:**

- [ ] Add empty prefix check: throw `ToonError('...', 'ADDRESS_INVALID_PREFIX')`
- [ ] Add ILP character validation for prefix: reject uppercase, spaces, invalid chars
- [ ] Add pubkey length check: throw `ToonError('...', 'ADDRESS_INVALID_PUBKEY')` if < 8 hex chars
- [ ] Add pubkey hex validation: reject non-hex characters
- [ ] Run tests: `npx vitest run packages/core/src/address/derive-child-address.test.ts -t "T-7.1-08|T-2.8a|T-7.1-09|T-7.1-10"`
- [ ] All 5 tests pass (green phase)

**Estimated Effort:** 0.5 hours

---

### Tests: T-7.1-12, T-7.1-12b (ILP address structure)

**File:** `packages/core/src/address/derive-child-address.test.ts`

**Tasks to make these tests pass:**

- [ ] Add result validation: dot-separated, non-empty segments, valid characters
- [ ] Run tests: `npx vitest run packages/core/src/address/derive-child-address.test.ts -t "T-7.1-12"`
- [ ] Both tests pass (green phase)

**Estimated Effort:** 0.25 hours

---

### Test: T-3.2 (Public API exports)

**File:** `packages/core/src/address/derive-child-address.test.ts`

**Tasks to make this test pass:**

- [ ] Create `packages/core/src/address/index.ts` barrel file exporting `deriveChildAddress`
- [ ] Add `export { deriveChildAddress } from './address/index.js';` to `packages/core/src/index.ts`
- [ ] Verify `ILP_ROOT_PREFIX` already exported from constants block in `packages/core/src/index.ts`
- [ ] Run test: `npx vitest run packages/core/src/address/derive-child-address.test.ts -t "T-3.2"`
- [ ] Test passes (green phase)

**Estimated Effort:** 0.25 hours

---

### Final Verification

- [ ] Run full test suite: `npx vitest run packages/core/src/address/derive-child-address.test.ts`
- [ ] All 15 tests pass
- [ ] Run `pnpm build` to verify TypeScript compilation
- [ ] Run `pnpm test` to verify no regressions
- [ ] Run `pnpm lint` to verify no lint errors

**Total Estimated Effort:** 1.75 hours

---

## Running Tests

```bash
# Run all failing tests for this story
npx vitest run packages/core/src/address/derive-child-address.test.ts

# Run specific test by ID
npx vitest run packages/core/src/address/derive-child-address.test.ts -t "T-7.1-01"

# Run tests in watch mode
npx vitest packages/core/src/address/derive-child-address.test.ts

# Run with verbose output
npx vitest run packages/core/src/address/derive-child-address.test.ts --reporter=verbose

# Run full package tests (after implementation)
cd packages/core && pnpm test
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**

- All 15 tests written and failing (module not found)
- No fixtures or factories needed (pure function)
- No mock requirements (zero dependencies)
- Implementation checklist created with 5 task groups

**Verification:**

- All tests fail with: `Error: Failed to load url ./derive-child-address.js`
- Failure is due to missing implementation, not test bugs
- ESLint passes on test file (0 errors)

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. Start with `ILP_ROOT_PREFIX` constant (simplest, unblocks other tests)
2. Create `derive-child-address.ts` with basic derivation logic
3. Add input validation (prefix + pubkey)
4. Add ILP address structure validation on result
5. Create barrel file and update core exports
6. Verify all 15 tests pass

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

- Review `deriveChildAddress` for clarity and edge cases
- Consider adding JSDoc documentation
- Verify no unnecessary string allocations
- Run full `pnpm build && pnpm test` to confirm no regressions

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `npx vitest run packages/core/src/address/derive-child-address.test.ts`

**Results:**

```
 FAIL  packages/core/src/address/derive-child-address.test.ts
Error: Failed to load url ./derive-child-address.js (resolved id: ./derive-child-address.js)
in /Users/jonathangreen/Documents/crosstown/packages/core/src/address/derive-child-address.test.ts.
Does the file exist?

 Test Files  1 failed (1)
      Tests  no tests
```

**Summary:**

- Total tests: 15 (in 1 file)
- Passing: 0 (expected)
- Failing: 1 file (expected -- module not found)
- Status: RED phase verified
- ESLint: 0 errors

---

## Notes

- Story 7.1 is a pure utility with zero side effects -- ideal for TDD
- Test IDs match the epic test plan (T-7.1-01 through T-7.1-12) with additions (T-2.8a, T-2.8a-b, T-7.1-12b, T-3.2)
- Collision property (T-7.1-06) is intentionally documented as a known limitation of 8-char truncation
- Birthday paradox test (T-7.1-07) is mathematical validation, not implementation-dependent
- No integration or E2E tests needed -- this is a pure function with no infrastructure dependencies

---

**Generated by BMad TEA Agent** - 2026-03-21
