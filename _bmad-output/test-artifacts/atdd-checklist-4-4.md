---
stepsCompleted:
  - 'step-01-preflight-and-context'
  - 'step-02-generation-mode'
  - 'step-03-test-strategy'
  - 'step-04c-aggregate'
  - 'step-05-validate-and-complete'
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-03-15'
workflowType: 'testarch-atdd'
inputDocuments:
  - '_bmad-output/implementation-artifacts/4-4-nautilus-kms-identity.md'
  - 'packages/core/src/identity/kms-identity.test.ts'
  - 'packages/core/src/events/attestation.ts'
  - 'packages/core/src/types.ts'
  - 'packages/core/src/errors.ts'
  - 'packages/core/src/constants.ts'
  - 'packages/sdk/src/identity.ts'
  - 'packages/sdk/src/identity.test.ts'
---

# ATDD Checklist - Epic 4, Story 4.4: Nautilus KMS Identity

**Date:** 2026-03-15
**Author:** Jonathan
**Primary Test Level:** Unit

---

## Story Summary

Story 4.4 implements enclave-bound Nostr identity derivation from Nautilus KMS seeds. The `deriveFromKmsSeed()` function in `@toon-protocol/core` converts a 32-byte raw KMS seed (or BIP-39 mnemonic) into a Nostr-compatible secp256k1 keypair via the NIP-06 derivation path, enabling relay identity to be cryptographically bound to TEE code integrity.

**As a** TOON relay operator running in a TEE enclave
**I want** the relay's Nostr identity to be derived from a Nautilus KMS seed inside the enclave using the NIP-06 derivation path
**So that** the relay's identity is cryptographically bound to its code integrity -- if the enclave code changes, attestation fails, KMS seed becomes inaccessible, and the identity is lost, making impersonation impossible

---

## Acceptance Criteria

1. **AC #1 -- Valid Schnorr keypair from raw seed:** Given a 32-byte KMS seed, `deriveFromKmsSeed(seed)` returns `{ secretKey, pubkey }` where pubkey is a valid 64-char hex x-only Schnorr key, secretKey is the 32-byte private key derived via NIP-06 path, and a signed event is verifiable by `nostr-tools.verifyEvent()`.

2. **AC #2 -- NIP-06 mnemonic derivation:** Given a BIP-39 mnemonic passed via `deriveFromKmsSeed(seed, { mnemonic })`, the key is derived following NIP-06 standard: mnemonic -> BIP-39 seed -> BIP-32 HD key -> derive `m/44'/1237'/0'/0/0`. Mnemonic takes precedence over raw seed.

3. **AC #3 -- Deterministic derivation:** Given the same KMS seed, calling `deriveFromKmsSeed()` multiple times returns identical keypair values every time.

4. **AC #4 -- Signs kind:10033 self-attestation:** Given a KMS-derived keypair, `buildAttestationEvent(attestation, secretKey, options)` produces a valid signed kind:10033 event with correct pubkey, valid id/sig, and round-tripped TeeAttestation content.

5. **AC #5 -- Invalid seed error handling:** Given a null, undefined, or invalid seed, `deriveFromKmsSeed(badSeed)` throws a `KmsIdentityError` with a message matching `/KMS|seed|unavailable/i`. No random key fallback.

6. **AC #6 -- Correct exports:** `deriveFromKmsSeed`, `KmsIdentityError`, `KmsKeypair` type, and `DeriveFromKmsSeedOptions` type are exported from `@toon-protocol/core` via `identity/kms-identity.ts` -> `identity/index.ts` -> `src/index.ts`.

---

## Failing Tests Created (RED Phase)

### Unit Tests (8 tests)

**File:** `packages/core/src/identity/kms-identity.test.ts` (159 lines)

- **Test:** T-4.4-01: KMS-derived keypair signs an event verifiable by nostr-tools
  - **Status:** RED - `it.skip()` (kms-identity.js does not exist yet)
  - **Priority:** P0
  - **Verifies:** AC #1 -- raw seed produces valid Schnorr keypair, finalizeEvent + verifyEvent roundtrip

- **Test:** T-4.4-02: derived key matches NIP-06 path m/44'/1237'/0'/0/0 for known mnemonic
  - **Status:** RED - `it.skip()` (kms-identity.js does not exist yet)
  - **Priority:** P0
  - **Verifies:** AC #2 -- mnemonic derivation matches golden value `e8bcf3823669444d0b49ad45d65088635d9fd8500a75b5f20b59abefa56a144f`

- **Test:** T-4.4-03: same seed produces identical pubkey on two separate derivations
  - **Status:** RED - `it.skip()` (kms-identity.js does not exist yet)
  - **Priority:** P1
  - **Verifies:** AC #3 -- deterministic derivation across invocations

- **Test:** T-4.4-04: building a kind:10033 event with KMS keypair produces a valid signed event
  - **Status:** RED - `it.skip()` (kms-identity.js does not exist yet)
  - **Priority:** P1
  - **Verifies:** AC #4 -- KMS identity signs self-attestation, TeeAttestation content round-trips

- **Test:** T-4.4-05a: null seed throws KmsIdentityError
  - **Status:** RED - `it.skip()` (kms-identity.js does not exist yet)
  - **Priority:** P2
  - **Verifies:** AC #5 -- null input triggers KmsIdentityError, not random key fallback

- **Test:** T-4.4-05b: undefined seed throws KmsIdentityError
  - **Status:** RED - `it.skip()` (kms-identity.js does not exist yet)
  - **Priority:** P2
  - **Verifies:** AC #5 -- undefined input triggers KmsIdentityError

- **Test:** T-4.4-05c: empty Uint8Array (0 bytes) throws KmsIdentityError
  - **Status:** RED - `it.skip()` (kms-identity.js does not exist yet)
  - **Priority:** P2
  - **Verifies:** AC #5 -- wrong-length seed (0 bytes) triggers KmsIdentityError

- **Test:** T-4.4-05d: wrong-length Uint8Array (16 bytes) throws KmsIdentityError
  - **Status:** RED - `it.skip()` (kms-identity.js does not exist yet)
  - **Priority:** P2
  - **Verifies:** AC #5 -- wrong-length seed (16 bytes) triggers KmsIdentityError

---

## Data Factories Created

### Test Seed Factory

**File:** `packages/core/src/identity/kms-identity.test.ts` (inline)

**Exports (test-scoped constants):**

- `TEST_KMS_SEED` -- Deterministic 32-byte seed (`Uint8Array(32).fill(0x42)`) for reproducible derivations
- `TEST_MNEMONIC` -- Standard BIP-39 12-word "abandon" vector for NIP-06 golden-file testing
- `EXPECTED_ABANDON_PUBKEY` -- Pre-computed golden value for the "abandon" mnemonic at NIP-06 path
- `TEST_ATTESTATION_PAYLOAD` -- Valid `TeeAttestation` payload with 96-char hex PCRs and base64 attestation doc

**Note:** Since this is a pure function with no external dependencies, inline test constants suffice. No separate factory file is needed. The test data is deterministic and self-contained.

---

## Fixtures Created

No test fixtures are required for Story 4.4. The function under test (`deriveFromKmsSeed`) is a pure computation (seed in, keypair out) with no external setup, teardown, or state management needed. Each test constructs its own input data inline.

---

## Mock Requirements

No mocks are required for Story 4.4. The function under test is a pure computation that performs only in-process cryptographic operations:
- `@scure/bip39` for mnemonic validation and seed derivation
- `@scure/bip32` for HD key derivation
- `nostr-tools/pure` for public key computation

There are no network calls, file I/O, database queries, or external service dependencies.

---

## Required data-testid Attributes

Not applicable. Story 4.4 is a backend-only pure function library with no UI components.

---

## Implementation Checklist

### Test: T-4.4-01 -- KMS-derived keypair valid Schnorr signatures

**File:** `packages/core/src/identity/kms-identity.test.ts`

**Tasks to make this test pass:**

- [ ] Add `@scure/bip32` and `@scure/bip39` to `packages/core/package.json` dependencies
- [ ] Run `pnpm install` to update lockfile
- [ ] Create `packages/core/src/identity/kms-identity.ts`
- [ ] Implement `KmsIdentityError` class extending `ToonError`
- [ ] Implement `KmsKeypair` interface and `DeriveFromKmsSeedOptions` type
- [ ] Implement `deriveFromKmsSeed(seed, options?)` -- raw seed path using `HDKey.fromMasterSeed(seed).derive(path)`
- [ ] Compute x-only pubkey via `getPublicKey(secretKey)` from `nostr-tools/pure`
- [ ] Return defensive copy `{ secretKey: new Uint8Array(privateKey), pubkey }`
- [ ] Uncomment imports in test file, change `it.skip` to `it`
- [ ] Run test: `npx vitest run packages/core/src/identity/kms-identity.test.ts -t "T-4.4-01"`
- [ ] Test passes (green phase)

**Estimated Effort:** 1 hour

---

### Test: T-4.4-02 -- NIP-06 derivation path for known mnemonic

**File:** `packages/core/src/identity/kms-identity.test.ts`

**Tasks to make this test pass:**

- [ ] Implement mnemonic option in `deriveFromKmsSeed()`: `if (options.mnemonic)` -> validate with `validateMnemonic(mnemonic, wordlist)`, derive via `mnemonicToSeedSync(mnemonic)` -> `HDKey.fromMasterSeed()` -> `.derive(path)`
- [ ] Mnemonic takes precedence over raw seed when provided
- [ ] Verify golden value matches: `e8bcf3823669444d0b49ad45d65088635d9fd8500a75b5f20b59abefa56a144f`
- [ ] Run test: `npx vitest run packages/core/src/identity/kms-identity.test.ts -t "T-4.4-02"`
- [ ] Test passes (green phase)

**Estimated Effort:** 0.5 hours

---

### Test: T-4.4-03 -- Deterministic derivation

**File:** `packages/core/src/identity/kms-identity.test.ts`

**Tasks to make this test pass:**

- [ ] Verify `deriveFromKmsSeed()` is stateless (no module-level caching or randomness)
- [ ] This test should pass automatically once T-4.4-01 implementation is correct
- [ ] Run test: `npx vitest run packages/core/src/identity/kms-identity.test.ts -t "T-4.4-03"`
- [ ] Test passes (green phase)

**Estimated Effort:** 0 hours (passes automatically with correct implementation)

---

### Test: T-4.4-04 -- KMS identity signs kind:10033 self-attestation

**File:** `packages/core/src/identity/kms-identity.test.ts`

**Tasks to make this test pass:**

- [ ] Verify `buildAttestationEvent()` from `../events/attestation.js` works with KMS-derived secretKey
- [ ] `buildAttestationEvent(attestation, secretKey, options)` already exists (Story 4.2, commit `864bb49`)
- [ ] This test validates integration between KMS identity and existing attestation builder
- [ ] Uncomment `buildAttestationEvent` import, `TeeAttestation` type import, `TEE_ATTESTATION_KIND` import
- [ ] Run test: `npx vitest run packages/core/src/identity/kms-identity.test.ts -t "T-4.4-04"`
- [ ] Test passes (green phase)

**Estimated Effort:** 0.25 hours

---

### Test: T-4.4-05a/b/c/d -- KMS unavailable error handling

**File:** `packages/core/src/identity/kms-identity.test.ts`

**Tasks to make this test pass:**

- [ ] Implement seed validation in `deriveFromKmsSeed()`:
  - Check `instanceof Uint8Array` first (catches null, undefined, wrong types)
  - Check `length === 32` (catches empty and wrong-length arrays)
  - Throw `KmsIdentityError` with descriptive message matching `/KMS|seed|unavailable/i`
- [ ] Ensure NO random key fallback under any circumstances
- [ ] Run tests: `npx vitest run packages/core/src/identity/kms-identity.test.ts -t "T-4.4-05"`
- [ ] All 4 error handling tests pass (green phase)

**Estimated Effort:** 0.25 hours

---

### Export wiring (AC #6)

**Tasks:**

- [ ] Create `packages/core/src/identity/index.ts` re-exporting `deriveFromKmsSeed`, `KmsIdentityError`, `KmsKeypair`, `DeriveFromKmsSeedOptions` from `./kms-identity.js`
- [ ] Add re-export to `packages/core/src/index.ts`: `export { ... } from './identity/index.js'`
- [ ] Verify: `import { deriveFromKmsSeed } from '@toon-protocol/core'` resolves correctly
- [ ] Run full build: `pnpm build --filter=@toon-protocol/core`

**Estimated Effort:** 0.25 hours

---

## Running Tests

```bash
# Run all failing tests for this story
npx vitest run packages/core/src/identity/kms-identity.test.ts

# Run specific test by name
npx vitest run packages/core/src/identity/kms-identity.test.ts -t "T-4.4-01"

# Run tests in watch mode
npx vitest packages/core/src/identity/kms-identity.test.ts

# Run all core package tests
npx vitest run --config packages/core/vitest.config.ts

# Run tests with coverage
npx vitest run packages/core/src/identity/kms-identity.test.ts --coverage
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**

- All 8 tests written and failing (skipped)
- Test data factories defined inline (deterministic seeds, golden values)
- No fixtures needed (pure function, no external deps)
- No mocks needed (pure computation)
- Implementation checklist created
- Stub bugs fixed:
  - T-4.4-01: Added `finalizeEvent` import, removed unused aliases, fixed unsigned variable name, replaced placeholder assertions with real signing/verification
  - T-4.4-02: Computed and filled golden pubkey value (`e8bcf38...a144f`)
  - T-4.4-04: Fixed `TeeAttestation` payload shape (was `{ nodeId, platform, pcrs }`, now `{ enclave, pcr0, pcr1, pcr2, attestationDoc, version }`), added `AttestationEventOptions` third argument, corrected content assertions, removed stale comments about missing files
  - T-4.4-05: Split into 4 sub-tests (null, undefined, empty Uint8Array, wrong-length Uint8Array)

**Verification:**

- All 8 tests run and skip as expected
- Test file compiles and collects without errors
- No syntax or import errors in the test file

---

### GREEN Phase (DEV Team -- Next Steps)

**DEV Agent Responsibilities:**

1. **Pick one failing test** from implementation checklist (start with T-4.4-01, highest priority)
2. **Read the test** to understand expected behavior
3. **Implement minimal code** to make that specific test pass
4. **Run the test** to verify it now passes (green)
5. **Check off the task** in implementation checklist
6. **Move to next test** and repeat

**Key Principles:**

- One test at a time (don't try to fix all at once)
- Minimal implementation (don't over-engineer)
- Run tests frequently (immediate feedback)
- Use implementation checklist as roadmap

**Recommended order:**

1. T-4.4-01 (core keypair derivation -- unblocks all other tests)
2. T-4.4-02 (mnemonic support -- extends core)
3. T-4.4-05a/b/c/d (error handling -- guard rails)
4. T-4.4-03 (determinism -- should pass automatically)
5. T-4.4-04 (attestation integration -- depends on core derivation)

---

### REFACTOR Phase (DEV Team -- After All Tests Pass)

**DEV Agent Responsibilities:**

1. **Verify all tests pass** (green phase complete)
2. **Review code for quality** -- best-effort seed zeroing in `finally` blocks, defensive copies
3. **Verify exports** -- `@toon-protocol/core` re-exports all public symbols
4. **Run full test suite** -- `pnpm test` to ensure no regressions
5. **Run lint/format** -- `pnpm lint && pnpm format`

**Key Principles:**

- Tests provide safety net (refactor with confidence)
- Make small refactors (easier to debug if tests fail)
- Run tests after each change
- Don't change test behavior (only implementation)

---

## Next Steps

1. **Review this checklist** -- verify AC coverage is complete
2. **Run failing tests** to confirm RED phase: `npx vitest run packages/core/src/identity/kms-identity.test.ts`
3. **Begin implementation** using implementation checklist as guide
4. **Work one test at a time** (red -> green for each)
5. **When all tests pass**, refactor code for quality
6. **When refactoring complete**, commit with: `feat(4-4): Nautilus KMS identity -- deriveFromKmsSeed, NIP-06 derivation, KmsIdentityError`

---

## Knowledge Base References Applied

This ATDD workflow consulted the following knowledge fragments and reference files:

- **test-quality.md** -- Test design principles (Given-When-Then, one assertion per test, determinism, isolation)
- **data-factories.md** -- Factory patterns for test data generation (adapted to inline constants for pure functions)
- **test-levels-framework.md** -- Test level selection framework (all unit-level for this pure function story)
- **SDK identity.ts** -- Existing NIP-06 derivation pattern (fromMnemonic, fromSecretKey) used as reference for the core implementation
- **SDK identity.test.ts** -- Existing identity test patterns (golden values, cross-library roundtrip, error handling)
- **attestation.ts** -- Story 4.2 attestation builder (buildAttestationEvent, TeeAttestation type, AttestationEventOptions)

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `npx vitest run packages/core/src/identity/kms-identity.test.ts`

**Results:**

```
 RUN  v1.6.1 /Users/jonathangreen/Documents/toon

 ↓ packages/core/src/identity/kms-identity.test.ts  (8 tests | 8 skipped)

 Test Files  1 skipped (1)
      Tests  8 skipped (8)
   Start at  10:38:12
   Duration  266ms
```

**Summary:**

- Total tests: 8
- Passing: 0 (expected)
- Failing/Skipped: 8 (expected -- all `it.skip()`)
- Status: RED phase verified

---

## Notes

- The `@scure/bip39` and `@scure/bip32` packages must be added as runtime dependencies to `packages/core/package.json` (not devDependencies) since they are used at runtime inside the Docker entrypoint.
- The golden pubkey value (`e8bcf3823669444d0b49ad45d65088635d9fd8500a75b5f20b59abefa56a144f`) was computed using the SDK's existing crypto dependencies and verified against the NIP-06 derivation path.
- The `TeeAttestation` type uses flat fields (`enclave`, `pcr0`, `pcr1`, `pcr2`, `attestationDoc`, `version`), not nested `pcrs` object -- the original test stub had an incorrect shape.
- The `buildAttestationEvent()` function requires three arguments (attestation, secretKey, options) -- the original stub was missing the options argument.
- T-4.4-05 was expanded from 1 test to 4 sub-tests to cover null, undefined, empty array, and wrong-length array scenarios.

---

**Generated by BMad TEA Agent** - 2026-03-15
