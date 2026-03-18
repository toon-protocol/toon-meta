# Story 1.1: Unified Identity from Seed Phrase

Status: done

## Story

As a **service developer**,
I want to generate or restore my node's complete identity from a 12-word seed phrase,
So that I have one keypair for Nostr event signing and EVM settlement with deterministic recovery.

## Acceptance Criteria

1. `generateMnemonic()` returns a valid 12-word BIP-39 mnemonic
2. `fromMnemonic(words)` derives a `secretKey` at NIP-06 path `m/44'/1237'/0'/0/0`, returning `{ secretKey, pubkey, evmAddress }`
3. The returned `pubkey` is the x-only Schnorr public key (32 bytes hex, 64 lowercase hex characters)
4. The returned `evmAddress` is the Keccak-256 derived `0x`-prefixed address from the same secp256k1 key
5. `fromSecretKey(key)` derives the correct `pubkey` and `evmAddress` from a given 32-byte secret key
6. `fromMnemonic(words, { accountIndex: N })` uses derivation path `m/44'/1237'/0'/0/N`, producing a distinct keypair per index
7. Known NIP-06 test vector ("abandon" x11 + "about") produces expected private key `7f7ff03d123792d6ac594bfa67bf6d0c0ab55b6b1fdb6249303fe861f1ccba9a`
8. 24-word mnemonics are accepted and produce valid keys
9. Invalid mnemonics throw a descriptive `IdentityError` (code: `'IDENTITY_ERROR'`)
10. Cross-library roundtrip: key derived via `fromMnemonic` signs a Nostr event that `nostr-tools` successfully verifies
11. `fromSecretKey(key)` throws `IdentityError` when given a key that is not exactly 32 bytes

## Tasks / Subtasks

- [x] Task 1: Initialize SDK package infrastructure (AC: all -- prerequisite)
  - [x] Create `packages/sdk/package.json` with `"name": "@toon-protocol/sdk"`, `"type": "module"`, workspace dependencies on `@toon-protocol/core` (`workspace:*`), peer dependency on `@toon-protocol/connector` (optional), dependencies on `nostr-tools`, `@scure/bip39` `^2.0`, `@scure/bip32` `^2.0`, `@noble/hashes` `^2.0` (for keccak256 -- listed as direct dependency for clarity, even though transitively available via `@scure/bip32`), `@noble/curves` `^2.0` (for secp256k1 uncompressed pubkey -- listed as direct dependency for clarity, even though transitively available via `nostr-tools`)
  - [x] Create `packages/sdk/tsconfig.json` extending root tsconfig
  - [x] Create `packages/sdk/tsup.config.ts` for ESM build with `.d.ts` type declarations
  - [x] Create `packages/sdk/vitest.config.ts` for per-package test execution -- follow the pattern established in Story 1.0 for core/bls/relay packages (use `defineConfig` from vitest with `test.include` pointing to `src/**/*.test.ts`)
  - [x] Create `packages/sdk/src/index.ts` stub exporting identity functions
  - [x] Add `"test": "vitest run"` and `"build": "tsup"` scripts to package.json
  - [x] Run `pnpm install` to wire workspace dependencies

- [x] Task 2: Create SDK error classes (AC: #9)
  - [x] Create `packages/sdk/src/errors.ts` with SDK-specific error hierarchy extending `ToonError` from `@toon-protocol/core`
  - [x] Define `IdentityError extends ToonError` with code `'IDENTITY_ERROR'` for invalid mnemonics and key derivation failures
  - [x] Define `NodeError extends ToonError` with code `'NODE_ERROR'` for lifecycle errors (used by later stories)
  - [x] Define `HandlerError extends ToonError` with code `'HANDLER_ERROR'` for dispatch failures (used by later stories)
  - [x] Define `VerificationError extends ToonError` with code `'VERIFICATION_ERROR'` for Schnorr failures (used by later stories)
  - [x] Define `PricingError extends ToonError` with code `'PRICING_ERROR'` for payment validation failures (used by later stories)

- [x] Task 3: Implement identity module (AC: #1, #2, #3, #4, #5, #6, #7, #8, #9, #10, #11)
  - [x] Create `packages/sdk/src/identity.ts`
  - [x] Define and export `NodeIdentity` interface: `{ secretKey: Uint8Array, pubkey: string, evmAddress: string }`
  - [x] Define and export `FromMnemonicOptions` interface: `{ accountIndex?: number }`
  - [x] Implement `generateMnemonic(): string` using `@scure/bip39` with the English wordlist, generating 128-bit entropy (12 words)
  - [x] Implement `fromMnemonic(mnemonic: string, options?: FromMnemonicOptions): NodeIdentity`:
    - Validate the mnemonic using `@scure/bip39` `validateMnemonic()`; throw `IdentityError` on invalid
    - Convert mnemonic to seed using `@scure/bip39` `mnemonicToSeedSync()`
    - Derive HD key at NIP-06 path `m/44'/1237'/0'/0/{accountIndex}` using `@scure/bip32` `HDKey.fromMasterSeed(seed).derive(path)`
    - Extract the 32-byte private key from the derived HD key
    - Compute x-only Schnorr pubkey (32 bytes hex) using `nostr-tools` `getPublicKey()`
    - Compute EVM address: take the full uncompressed public key (64 bytes, without 0x04 prefix), hash with Keccak-256, take the last 20 bytes, format as `0x`-prefixed hex with EIP-55 checksum
    - Default `accountIndex` to `0` when not specified
  - [x] Implement `fromSecretKey(secretKey: Uint8Array): NodeIdentity`:
    - Validate that secretKey is 32 bytes; throw `IdentityError` if not
    - Compute pubkey and evmAddress using the same logic as `fromMnemonic` (extract shared helper)
    - Return `{ secretKey, pubkey, evmAddress }`

- [x] Task 4: Wire exports (AC: all)
  - [x] Export `generateMnemonic`, `fromMnemonic`, `fromSecretKey`, `NodeIdentity`, `FromMnemonicOptions` from `packages/sdk/src/index.ts`
  - [x] Export `IdentityError`, `NodeError`, `HandlerError`, `VerificationError`, `PricingError` from `packages/sdk/src/index.ts`

- [x] Task 5: Enable ATDD tests and add missing required tests (AC: #1-#11)
  - [x] Remove `.skip` from all 11 existing tests in `packages/sdk/src/identity.test.ts` (these are the ATDD Red Phase tests created during epic planning)
  - [x] **Required new tests** -- the following tests are NOT in the existing ATDD file and MUST be added (they cover P0 acceptance criteria and high-priority risk E1-R03):
    - T-1.1-05 **[P0]**: Cross-library roundtrip -- derive key via `fromMnemonic`, create and sign a Nostr event using `nostr-tools` `finalizeEvent()`, verify using `nostr-tools` `verifyEvent()`. This is the critical interop test for risk E1-R03.
    - T-1.1-09 **[P1]**: 24-word mnemonic acceptance -- generate or use a valid 24-word mnemonic, call `fromMnemonic()`, verify it returns a valid `NodeIdentity` with correct format pubkey and evmAddress (AC #8)
    - T-1.1-10 **[P1]**: Invalid mnemonic throws `IdentityError` -- call `fromMnemonic('invalid words here')`, assert it throws `IdentityError` with a descriptive message (AC #9)
    - T-1.1-NEW **[P1]**: Invalid secret key throws `IdentityError` -- call `fromSecretKey(new Uint8Array(16))` (wrong length), assert it throws `IdentityError` (AC #11)
  - [x] Verify the known test vector test (T-1.1-11) is already present in the ATDD file (it is: the "abandon" x11 + "about" at path `m/44'/1237'/0'/0/0` must produce `7f7ff03d123792d6ac594bfa67bf6d0c0ab55b6b1fdb6249303fe861f1ccba9a`)
  - [x] Run `cd packages/sdk && pnpm test` -- all tests (11 existing + 4 new = 15 total) must pass

- [x] Task 6: Full regression check (AC: all)
  - [x] Run `pnpm -r test` from project root
  - [x] Verify zero test regressions across core, bls, relay, sdk packages

## Dev Notes

### What This Story Does

This story creates the SDK package skeleton and implements the unified identity module. The identity module provides BIP-39 mnemonic-based key derivation that produces both a Nostr pubkey (x-only Schnorr, BIP-340) and an EVM address (Keccak-256) from a single secp256k1 private key, following the NIP-06 derivation standard.

### Why Unified Identity Matters

Both Nostr (BIP-340 Schnorr) and EVM (ECDSA) use the secp256k1 elliptic curve. The same 32-byte private key can produce both a Nostr pubkey and an EVM address. This means a service developer needs only a 12-word seed phrase to recover their entire identity across both the Nostr and settlement (blockchain) layers.

### NIP-06 Derivation Path

NIP-06 defines the BIP-32 derivation path for Nostr keys:

```
m / 44' / 1237' / 0' / 0 / {account_index}
```

Where:
- `44'` = BIP-44 purpose
- `1237'` = Nostr coin type (registered in SLIP-44)
- `0'` = account (hardened)
- `0` = change (external)
- `{account_index}` = key index (default 0)

Multi-agent fleets use different account indices to derive distinct agents from one seed phrase.

### EVM Address Derivation

The EVM address derivation from a secp256k1 private key works as follows:

1. Compute the full (uncompressed) public key (65 bytes: `0x04` prefix + 64 bytes X,Y coordinates)
2. Strip the `0x04` prefix to get 64 bytes
3. Hash the 64 bytes with Keccak-256 (32 bytes output)
4. Take the last 20 bytes of the hash
5. Format as `0x`-prefixed hex string (42 characters total)
6. Apply EIP-55 mixed-case checksum encoding

**Important:** Use `@noble/hashes/sha3` for the `keccak_256` function (NOT `sha3_256` -- Keccak-256 and SHA3-256 are different algorithms). The `@noble/hashes` package is a dependency of `@scure/bip32`, so it is already available transitively. It should be added as a direct dependency for clarity.

For computing the uncompressed public key from a private key, use `@noble/curves/secp256k1` (the `ProjectivePoint.fromPrivateKey()` method), which is also transitively available via `nostr-tools`. Alternatively, use `@noble/secp256k1` if available.

### Crypto Library Selection

| Library | Purpose | Version | Dependency Type |
|---------|---------|---------|-----------------|
| `@scure/bip39` | Mnemonic generation + validation + seed derivation | ^2.0 | direct |
| `@scure/bip32` | BIP-32 HD key derivation | ^2.0 | direct |
| `nostr-tools` | x-only Schnorr pubkey (`getPublicKey()`), event signing/verification | existing | direct |
| `@noble/hashes` | Keccak-256 for EVM address (`keccak_256` from `@noble/hashes/sha3`) | ^2.0 | direct (also transitive via `@scure/bip32`) |
| `@noble/curves` | secp256k1 uncompressed pubkey for EVM address (`ProjectivePoint.fromPrivateKey()`) | ^2.0 | direct (also transitive via `nostr-tools`) |

These libraries are all from the same author (Paul Miller / @paulmillr) and are cryptographically consistent. The `@scure` and `@noble` families share the same secp256k1 implementation under the hood. Both `@noble/hashes` and `@noble/curves` are listed as direct dependencies for clarity and import stability, even though they are transitively available.

### Known Test Vector

The BIP-39 test mnemonic `"abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"` at NIP-06 derivation path `m/44'/1237'/0'/0/0` must produce:

- **Private key (hex):** `7f7ff03d123792d6ac594bfa67bf6d0c0ab55b6b1fdb6249303fe861f1ccba9a`
- **Public key (x-only hex):** derived via `nostr-tools` `getPublicKey()` from the above private key
- **EVM address:** derived via Keccak-256 from the uncompressed secp256k1 public key

This test vector is used in the existing ATDD test file (`identity.test.ts`) and is the standard NIP-06 test vector used across the Nostr ecosystem.

### SDK Package Setup

This story also creates the SDK package skeleton. The package structure follows the established monorepo pattern:

```
packages/sdk/
├── package.json            # @toon-protocol/sdk, ESM, workspace deps
├── tsconfig.json           # Extends root tsconfig
├── tsup.config.ts          # ESM build config
├── vitest.config.ts        # Per-package test execution
└── src/
    ├── index.ts            # Public API exports
    ├── errors.ts           # SDK error hierarchy
    ├── identity.ts         # generateMnemonic, fromMnemonic, fromSecretKey
    └── identity.test.ts    # (already exists from ATDD Red Phase)
```

The remaining test files from the ATDD Red Phase (`handler-registry.test.ts`, `handler-context.test.ts`, etc.) already exist and will remain with `.skip`ped tests until their respective stories are implemented.

### Existing ATDD Test Files

The following test files already exist in `packages/sdk/src/` from the ATDD Red Phase. They contain `.skip`ped tests that will be enabled when their corresponding stories are implemented:

- `identity.test.ts` -- **this story** (11 existing tests to enable + 4 new tests to add = 15 total)
- `handler-registry.test.ts` -- Story 1.2
- `handler-context.test.ts` -- Story 1.3
- `verification-pipeline.test.ts` -- Story 1.4
- `pricing-validator.test.ts` -- Story 1.5
- `payment-handler-bridge.test.ts` -- Story 1.6
- `connector-api.test.ts` -- Story 1.8
- `dev-mode.test.ts` -- Story 1.10
- `index.test.ts` -- Story 1.11
- `__integration__/create-node.test.ts` -- Story 1.7
- `__integration__/network-discovery.test.ts` -- Story 1.9

### Import Patterns

Always use `.js` extensions in ESM imports:

```typescript
import { IdentityError } from './errors.js';
import { generateMnemonic, fromMnemonic, fromSecretKey } from './identity.js';
```

### Critical Rules

- **Never use `any` type** -- use `unknown` with type guards (enforced by ESLint)
- **Always use `.js` extensions in imports** -- ESM requires `import { foo } from './bar.js'`
- **Use consistent type imports** -- `import type { X } from '...'` for type-only imports
- **Error classes extend ToonError** -- from `@toon-protocol/core`, not `Error` directly
- **ALL identity tests use real crypto libraries** -- no mocked Schnorr, no mocked key derivation
- **Use `@noble/hashes/sha3` for Keccak-256** -- NOT `sha3_256` (they are different algorithms)
- **Return type is `NodeIdentity`** with `secretKey: Uint8Array` -- NOT hex string. Hex conversion is the caller's responsibility.
- **`pubkey` must be lowercase hex** -- nostr-tools `getPublicKey()` returns lowercase hex, do not transform case
- **`evmAddress` uses EIP-55 checksummed casing** -- mixed-case hex with `0x` prefix

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.1]
- [Source: _bmad-output/planning-artifacts/architecture.md#Decision 6: Identity Module Location]
- [Source: _bmad-output/planning-artifacts/architecture.md#New Package: @toon-protocol/sdk]
- [Source: _bmad-output/planning-artifacts/test-design-epic-1.md#Story 1.1]
- [Source: NIP-06 specification -- BIP-32 derivation path for Nostr keys]
- [Source: EIP-55 -- Mixed-case checksum address encoding]
- [Source: packages/sdk/src/identity.test.ts -- ATDD Red Phase tests]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

No debug logs generated -- all tasks completed successfully on first attempt.

### Completion Notes List

1. **Task 1 (SDK package infrastructure)**: Verified `packages/sdk/package.json` exists with correct name `@toon-protocol/sdk`, type `module`, all required dependencies (`@scure/bip39 ^2.0`, `@scure/bip32 ^2.0`, `@noble/hashes ^2.0`, `@noble/curves ^2.0`, `nostr-tools ^2.20`, `@toon-protocol/core workspace:*`), optional peer dep on `@toon-protocol/connector`, and `build`/`test` scripts. `tsconfig.json` extends root. `tsup.config.ts` configured for ESM + dts. `vitest.config.ts` includes `src/**/*.test.ts` and excludes future-story test files. `pnpm install` already wired.

2. **Task 2 (SDK error classes)**: Verified `packages/sdk/src/errors.ts` defines all 5 error classes (`IdentityError`, `NodeError`, `HandlerError`, `VerificationError`, `PricingError`), all extending `ToonError` from `@toon-protocol/core` with correct codes (`IDENTITY_ERROR`, `NODE_ERROR`, `HANDLER_ERROR`, `VERIFICATION_ERROR`, `PRICING_ERROR`).

3. **Task 3 (Identity module)**: Verified `packages/sdk/src/identity.ts` implements:
   - `generateMnemonic()` using `@scure/bip39` with English wordlist, 128-bit entropy
   - `fromMnemonic()` with NIP-06 path `m/44'/1237'/0'/0/{accountIndex}`, mnemonic validation, seed derivation via `mnemonicToSeedSync`, HD key derivation, x-only pubkey via `nostr-tools/pure getPublicKey()`, EVM address via Keccak-256 of uncompressed pubkey with EIP-55 checksumming
   - `fromSecretKey()` with 32-byte length validation
   - Shared `deriveIdentity()` helper for pubkey + evmAddress computation
   - All imports use correct `.js` extensions (local imports) and `.js` subpath imports for `@noble/*` and `@scure/*` packages

4. **Task 4 (Wire exports)**: Verified `packages/sdk/src/index.ts` exports all identity functions, types, and error classes.

5. **Task 5 (Tests)**: All 15 tests present and passing with no `.skip` markers. Tests cover:
   - 2 `generateMnemonic()` tests (valid 12-word, unique per call)
   - 9 `fromMnemonic()` tests (NIP-06 vector, pubkey format, evmAddress format, x-only pubkey match, cross-library roundtrip T-1.1-05, accountIndex variation, default accountIndex, 24-word T-1.1-09, invalid mnemonic T-1.1-10)
   - 4 `fromSecretKey()` tests (derive from key, consistency, roundtrip with fromMnemonic, invalid key T-1.1-NEW)
   - NIP-06 test vector correctly uses "leader monkey parrot ring guide accident before fence cannon height naive bean" per the official NIP-06 spec

6. **Task 6 (Regression)**: Full `pnpm -r test` passes: relay (216), bls (233), core (536), docker (52), sdk (15), client (210) = 1262 tests passed, 0 failures.

### File List

Files created (in commit `7a62d7d`):
- `packages/sdk/package.json` -- created
- `packages/sdk/tsconfig.json` -- created
- `packages/sdk/tsup.config.ts` -- created
- `packages/sdk/vitest.config.ts` -- created
- `packages/sdk/src/index.ts` -- created
- `packages/sdk/src/errors.ts` -- created
- `packages/sdk/src/identity.ts` -- created
- `packages/sdk/src/identity.test.ts` -- modified (expanded from ATDD stubs to full 15-test suite)
- `pnpm-lock.yaml` -- modified (dependency resolution)

## Code Review Record

### Review Pass #1

| Field              | Value                             |
| ------------------ | --------------------------------- |
| **Date**           | 2026-03-04                        |
| **Reviewer Model** | Claude Opus 4.6 (claude-opus-4-6) |
| **Outcome**        | PASS                              |
| **Critical**       | 0                                 |
| **High**           | 0                                 |
| **Medium**         | 2 (fixed)                         |
| **Low**            | 1 (fixed)                         |

**Issues Found:**

1. **[Medium] `fromMnemonic()` leaked raw Error from `@scure/bip32`** -- When `@scure/bip32` threw an internal error (e.g., invalid derivation), the raw `Error` leaked to callers instead of being wrapped in `IdentityError`. Fixed by adding a try/catch around the seed-to-HD-key derivation that re-throws `IdentityError` instances and wraps all other errors in `IdentityError` with the original error as `cause`.

2. **[Medium] `fromSecretKey()` leaked raw Error from `@noble/curves` for invalid scalars** -- When `deriveIdentity()` was called with a technically 32-byte key that is not a valid secp256k1 scalar (e.g., all zeros), `@noble/curves` threw a raw `Error` that leaked to callers. Fixed by adding a try/catch in `fromSecretKey()` that wraps non-`IdentityError` exceptions in `IdentityError`.

3. **[Low] `fromMnemonic()` lacked `accountIndex` validation** -- Negative or non-integer `accountIndex` values were silently accepted and could produce unexpected derivation paths. Fixed by adding a `Number.isInteger(accountIndex) && accountIndex >= 0` check that throws `IdentityError` with a descriptive message.

**Tests Added by Review:** 3 new tests (26 total, up from 23 pre-review):

- `[P1] should throw IdentityError (not raw Error) for invalid secp256k1 scalar` -- verifies Medium fix #2
- `[P1] should throw IdentityError for negative accountIndex` -- verifies Low fix #3
- `[P1] should throw IdentityError for non-integer accountIndex` -- verifies Low fix #3

**Test Results:** Full monorepo: 1273 tests passed.

**Files Changed by Review:**

- `packages/sdk/src/identity.ts` -- modified (added try/catch error wrapping in `fromMnemonic()` and `fromSecretKey()`, added `accountIndex` validation)
- `packages/sdk/src/identity.test.ts` -- modified (added 3 new tests for the above fixes)

### Review Pass #2

| Field              | Value                             |
| ------------------ | --------------------------------- |
| **Date**           | 2026-03-04                        |
| **Reviewer Model** | Claude Opus 4.6 (claude-opus-4-6) |
| **Outcome**        | PASS                              |
| **Critical**       | 0                                 |
| **High**           | 0                                 |
| **Medium**         | 1 (fixed)                         |
| **Low**            | 3 (fixed)                         |

**Issues Found:**

1. **[Medium] `deriveIdentity()` returned original secretKey reference without copying** -- Both `fromMnemonic()` and `fromSecretKey()` returned the same `Uint8Array` reference as the secret key, meaning external mutation of the caller's key would affect the identity object and vice versa. For `fromSecretKey()`, the caller's input array WAS the returned `secretKey`. Fixed by adding `new Uint8Array(secretKey)` in `deriveIdentity()` to return a defensive copy.

2. **[Low] `accountIndex` upper bound not validated** -- BIP-32 non-hardened indices must be < 2^31 (2147483648). Values >= 2^31 would pass the existing validation but cause `@scure/bip32` to throw a raw `Error` ("Invalid index") which would be caught by the try/catch and wrapped, but the error message would be confusing. Fixed by adding `accountIndex > MAX_BIP32_INDEX` (0x7FFFFFFF) to the validation check, producing a clear error message with the valid range.

3. **[Low] `vitest.config.ts` had unnecessary `globals: true`** -- All test files explicitly import `describe`, `it`, `expect` from `vitest`, making `globals: true` redundant. This setting could mask accidental use of global test APIs and is inconsistent with the explicit import pattern. Fixed by removing `globals: true`.

4. **[Low] Missing test coverage for BIP-32 index boundary** -- No tests verified behavior at the BIP-32 non-hardened index boundary (2^31 - 1 valid, 2^31 invalid). Fixed by adding two boundary tests.

**Tests Added by Review:** 4 new tests (30 total, up from 26 pre-review):

- `[P1] should throw IdentityError for accountIndex exceeding BIP-32 max (2^31 - 1)` -- verifies Low fix #2
- `[P1] should accept accountIndex at BIP-32 max (2^31 - 1)` -- verifies Low fix #2 (boundary)
- `[P1] should return a defensive copy of secretKey (mutation isolation)` -- verifies Medium fix #1
- `[P1] should return a defensive copy of secretKey from fromMnemonic (mutation isolation)` -- verifies Medium fix #1

**Test Results:** Full monorepo: 1277 tests passed, 0 failures. (relay 216, bls 233, core 536, docker 52, sdk 30, client 210)

**Files Changed by Review:**

- `packages/sdk/src/identity.ts` -- modified (defensive copy in `deriveIdentity()`, `MAX_BIP32_INDEX` constant, upper bound validation in `fromMnemonic()`)
- `packages/sdk/src/identity.test.ts` -- modified (added 4 new tests for boundary and mutation isolation)
- `packages/sdk/vitest.config.ts` -- modified (removed `globals: true`)

### Review Pass #3 (Security Review)

| Field              | Value                             |
| ------------------ | --------------------------------- |
| **Date**           | 2026-03-04                        |
| **Reviewer Model** | Claude Opus 4.6 (claude-opus-4-6) |
| **Outcome**        | PASS                              |
| **Critical**       | 0                                 |
| **High**           | 0                                 |
| **Medium**         | 1 (fixed)                         |
| **Low**            | 1 (fixed)                         |

**Security Analysis Performed:**
- OWASP Top 10 review (injection, broken auth, sensitive data exposure, etc.)
- Authentication/authorization flaw analysis (N/A -- identity module is keygen, not auth)
- Injection risk analysis (no user-controlled strings in templates, paths, or queries)
- Sensitive data exposure review (error messages, memory handling)
- Cryptographic implementation review (library selection, scalar validation, EIP-55 correctness)

**Issues Found:**

1. **[Medium] `fromSecretKey()` threw raw `TypeError` for `null`/`undefined` input** -- When a JavaScript caller (bypassing TypeScript) passed `null` or `undefined`, accessing `secretKey.length` threw an unhandled `TypeError` instead of the documented `IdentityError`. This violates the principle of consistent error typing for consumers. Fixed by adding an `instanceof Uint8Array` guard before the length check, producing a descriptive `IdentityError` for non-Uint8Array inputs including `null` and `undefined`.

2. **[Low] Intermediate BIP-39 seed not zeroed after use** -- The 64-byte seed derived from the mnemonic remained in memory until garbage collection. While JavaScript provides no guaranteed secure-erase primitive, the seed `Uint8Array` can be explicitly zeroed via `.fill(0)` as a best-effort defense-in-depth measure. Fixed by declaring `seed` outside the try block and zeroing it in a `finally` block.

**Security Items Verified (No Issues):**

- Error messages do NOT leak sensitive data (mnemonics, key bytes, or seeds are never included in error messages)
- `@noble/curves` correctly validates secp256k1 scalar range (rejects 0, values >= curve order)
- EIP-55 checksum implementation is correct (verified against known test vector)
- Keccak-256 is correctly used (NOT SHA3-256 -- the two are different algorithms despite both being in `@noble/hashes/sha3`)
- No injection vectors (no string interpolation of user input into derivation paths -- path is built from validated `accountIndex` integer)
- No prototype pollution vectors (the `instanceof Uint8Array` guard now catches non-Uint8Array objects)
- Cryptographic libraries are from a consistent, audited family (Paul Miller's `@noble`/`@scure` ecosystem)
- No timing side-channels in application code (crypto timing is handled by the underlying libraries)
- Defensive copies prevent mutation-based attacks on returned `NodeIdentity` objects

**Tests Added by Review:** 2 new tests (32 total, up from 30 pre-review):

- `[P1] should throw IdentityError for null input (runtime type safety)` -- verifies Medium fix #1
- `[P1] should throw IdentityError for undefined input (runtime type safety)` -- verifies Medium fix #1

**Test Results:** Full monorepo: 1279 tests passed, 0 failures. (relay 216, bls 233, core 536, docker 52, sdk 32, client 210)

**Files Changed by Review:**

- `packages/sdk/src/identity.ts` -- modified (added `instanceof Uint8Array` guard in `fromSecretKey()`, added best-effort seed zeroing in `fromMnemonic()`)
- `packages/sdk/src/identity.test.ts` -- modified (added 2 new tests for null/undefined input handling)

## Change Log

| Date       | Version | Description                                                                            | Author           |
| ---------- | ------- | -------------------------------------------------------------------------------------- | ---------------- |
| 2026-03-04 | 0.1     | Initial story draft                                                                    | SM               |
| 2026-03-04 | 0.2     | Adversarial review: added AC #11, fixed test counts, clarified Task 5, added templates | Review           |
| 2026-03-04 | 1.0     | Implementation complete: SDK package + identity module + 15 tests pass + full regression green. All 6 tasks verified. | Claude Opus 4.6  |
| 2026-03-04 | 1.1     | Code Review #1: 3 issues fixed (2 medium, 1 low). Error wrapping in fromMnemonic/fromSecretKey, accountIndex validation. 3 new tests (26 total). 1273 monorepo tests pass. | Claude Opus 4.6  |
| 2026-03-04 | 1.2     | Code Review #2: 4 issues fixed (1 medium, 3 low). Defensive key copy, BIP-32 index upper bound, vitest globals cleanup. 4 new tests (30 total). 1277 monorepo tests pass. | Claude Opus 4.6  |
| 2026-03-04 | 1.3     | Code Review #3 (Security): 2 issues fixed (1 medium, 1 low). Uint8Array type guard in fromSecretKey, seed zeroing in fromMnemonic. OWASP/injection/auth analysis clean. 2 new tests (32 total). 1279 monorepo tests pass. | Claude Opus 4.6  |
