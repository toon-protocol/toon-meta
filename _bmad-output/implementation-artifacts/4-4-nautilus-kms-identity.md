# Story 4.4: Nautilus KMS Identity

Status: done

## Story

As a **Crosstown relay operator running in a TEE enclave**,
I want the relay's Nostr identity to be derived from a Nautilus KMS seed inside the enclave using the NIP-06 derivation path,
So that the relay's identity is cryptographically bound to its code integrity — if the enclave code changes, attestation fails, KMS seed becomes inaccessible, and the identity is lost, making impersonation impossible.

**FRs covered:** FR-TEE-4 (Nautilus KMS identity — persistent enclave-bound keypairs, identity tied to code integrity)

**Dependencies:** Story 4.2 complete (confirmed — commit `864bb49`). The `buildAttestationEvent()` builder and `TEE_ATTESTATION_KIND` constant are available from `@crosstown/core`. Story 4.3 complete (confirmed — commit `aeb2b8b`). The `AttestationVerifier` class is available from `@crosstown/core`. The SDK identity module (`packages/sdk/src/identity.ts`) provides the existing NIP-06 derivation pattern using `@scure/bip39` and `@scure/bip32` — this story creates a parallel function in `@crosstown/core` for enclave-specific key derivation from raw KMS seeds.

**Critical dependency detail:** The `@scure/bip39` and `@scure/bip32` packages are dependencies of `@crosstown/sdk` but NOT currently dependencies of `@crosstown/core`. Story 4.4 places `deriveFromKmsSeed()` in core's `identity/` directory because core is the dependency that Docker entrypoints import. The implementation must add `@scure/bip39` and `@scure/bip32` as dependencies to `packages/core/package.json`.

**Decision sources:**
- Decision 12 (architecture.md): Attestation Lifecycle Architecture — identity bound to code integrity
- Research: Nautilus KMS — seeds encrypted using DKG key from Threshold Network, decryptable only by KMS root servers with attestation verification
- Research: Key Management Integration — "derive Nostr identity keys inside the enclave using KMS seeds, so the relay's identity is bound to its TEE"
- Architecture Pattern: Unified Identity — single secp256k1 key → Nostr pubkey + EVM address, derived from BIP-39 mnemonic via NIP-06 path
- Test Design: R-E4-003 (Nautilus KMS key incompatibility), T-4.4-01 through T-4.4-05

## Acceptance Criteria

1. Given a 32-byte KMS seed (raw bytes from Nautilus KMS), when `deriveFromKmsSeed(seed)` is called, then it returns `{ secretKey: Uint8Array, pubkey: string }` where `pubkey` is a valid 64-character lowercase hex x-only Schnorr public key, and `secretKey` is the 32-byte secp256k1 private key derived via the NIP-06 path (`m/44'/1237'/0'/0/0`), and an event signed with `secretKey` is verifiable by `nostr-tools.verifyEvent()`.

2. Given a BIP-39 mnemonic passed via `deriveFromKmsSeed(seed, { mnemonic })`, when the derivation is performed, then the key is derived following the NIP-06 standard: mnemonic → BIP-39 seed → BIP-32 HD key → derive `m/44'/1237'/0'/0/0` → extract private key → compute x-only pubkey. The mnemonic option takes precedence over the raw seed when provided.

3. Given the same KMS seed, when `deriveFromKmsSeed()` is called multiple times, then it returns identical `secretKey` and `pubkey` values every time (deterministic derivation — key persistence across enclave restarts).

4. Given a KMS-derived keypair, when `buildAttestationEvent(attestation, secretKey, options)` is called with a valid `TeeAttestation` payload and `AttestationEventOptions` (`{ relay, chain, expiry }`) to build a kind:10033 self-attestation event, then the resulting event has `event.pubkey === pubkey`, `event.kind === 10033`, a valid `id` (64-char hex), a valid `sig` (128-char hex), `verifyEvent(event)` returns `true`, and `JSON.parse(event.content)` round-trips the `TeeAttestation` fields (`enclave`, `pcr0`, `pcr1`, `pcr2`, `attestationDoc`, `version`) — proving the KMS-derived identity can sign its own attestation.

5. Given a null, undefined, or otherwise invalid seed (not a 32-byte Uint8Array), when `deriveFromKmsSeed(badSeed)` is called, then it throws a `KmsIdentityError` (not a random key fallback) with a message matching `/KMS|seed|unavailable/i`, ensuring operators get a clear error if KMS is unreachable.

6. Given `deriveFromKmsSeed`, `KmsIdentityError`, `KmsKeypair` type, and `DeriveFromKmsSeedOptions` type, when imported from `@crosstown/core`, then they are exported from `packages/core/src/identity/kms-identity.ts` and re-exported via `packages/core/src/identity/index.ts` and the top-level `packages/core/src/index.ts`.

## Tasks / Subtasks

- [x] Task 1: Add `@scure/bip39` and `@scure/bip32` dependencies to `@crosstown/core` (AC: #1, #2)
  - [x]Add `"@scure/bip32": "^2.0.0"` and `"@scure/bip39": "^2.0.0"` to `packages/core/package.json` `dependencies`
  - [x]Run `pnpm install` to update lockfile
  - [x]Verify imports resolve correctly

- [x] Task 2: Create `KmsIdentityError` class and `KmsKeypair` type (AC: #5, #6)
  - [x]Create `packages/core/src/identity/kms-identity.ts`
  - [x]Import `{ CrosstownError }` from `../errors.js`
  - [x]Define `KmsIdentityError` extending `CrosstownError`:
    ```typescript
    export class KmsIdentityError extends CrosstownError {
      constructor(message: string, cause?: Error) {
        super(message, 'KMS_IDENTITY_ERROR', cause);
        this.name = 'KmsIdentityError';
      }
    }
    ```
  - [x]Define `KmsKeypair` type:
    ```typescript
    export interface KmsKeypair {
      /** The 32-byte secp256k1 secret key derived from the KMS seed. */
      secretKey: Uint8Array;
      /** The x-only Schnorr public key (32 bytes, 64 lowercase hex characters). */
      pubkey: string;
    }
    ```
  - [x]Define `DeriveFromKmsSeedOptions` type:
    ```typescript
    export interface DeriveFromKmsSeedOptions {
      /** BIP-39 mnemonic — when provided, takes precedence over raw seed for derivation. */
      mnemonic?: string;
      /** Key index in the NIP-06 derivation path. Defaults to 0. */
      accountIndex?: number;
    }
    ```

- [x] Task 3: Implement `deriveFromKmsSeed()` function (AC: #1, #2, #3)
  - [x]Add required imports to `kms-identity.ts`:
    - `import { validateMnemonic, mnemonicToSeedSync } from '@scure/bip39';`
    - `import { wordlist } from '@scure/bip39/wordlists/english.js';`
    - `import { HDKey } from '@scure/bip32';`
    - `import { getPublicKey } from 'nostr-tools/pure';`
  - [x]Implement `deriveFromKmsSeed(seed: Uint8Array, options?: DeriveFromKmsSeedOptions): KmsKeypair`:
    - Validate `seed` is a `Uint8Array` with length 32; throw `KmsIdentityError` if not (check `instanceof Uint8Array` first, then `length === 32`)
    - If `options.accountIndex` is provided, validate it is a non-negative integer <= 0x7FFFFFFF; throw `KmsIdentityError` if not (follows SDK `fromMnemonic()` validation pattern)
    - If `options.mnemonic` is provided, validate with `validateMnemonic(mnemonic, wordlist)` (English wordlist required by `@scure/bip39` v2.x) and derive from mnemonic instead of raw seed
    - NIP-06 derivation path: `m/44'/1237'/0'/0/{accountIndex}` (accountIndex defaults to 0)
    - For raw seed: use `HDKey.fromMasterSeed(seed)` then `.derive(path)` to get private key
    - For mnemonic: use `mnemonicToSeedSync(mnemonic)` then `HDKey.fromMasterSeed()` then `.derive(path)` (note: `mnemonicToSeedSync` returns a 64-byte seed, vs the 32-byte raw KMS seed)
    - Compute x-only pubkey via `getPublicKey(secretKey)` from `nostr-tools/pure`
    - Return `{ secretKey: new Uint8Array(privateKey), pubkey }` (defensive copy)
  - [x]Best-effort zeroing of intermediate seed material in `finally` block (following SDK identity.ts pattern)

- [x] Task 4: Export from identity index and top-level core index (AC: #6)
  - [x]Create `packages/core/src/identity/index.ts` with:
    ```typescript
    export {
      deriveFromKmsSeed,
      KmsIdentityError,
      type KmsKeypair,
      type DeriveFromKmsSeedOptions,
    } from './kms-identity.js';
    ```
  - [x]Add exports to `packages/core/src/index.ts`:
    ```typescript
    // KMS Identity (TEE enclave-bound key derivation)
    export {
      deriveFromKmsSeed,
      KmsIdentityError,
      type KmsKeypair,
      type DeriveFromKmsSeedOptions,
    } from './identity/index.js';
    ```

- [x] Task 5: Convert ATDD RED stubs to GREEN (AC: #1, #2, #3, #4, #5)
  - [x]In `packages/core/src/identity/kms-identity.test.ts`:
    - Uncomment imports for `deriveFromKmsSeed` and `KmsIdentityError` from `./kms-identity.js`
    - Uncomment `buildAttestationEvent` import from `../events/attestation.js`; also import `type { AttestationEventOptions }` from the same path (needed for T-4.4-04 fix)
    - Uncomment `TEE_ATTESTATION_KIND` import from `../constants.js`
    - Remove `it.skip()` from all test cases, replace with `it()`
    - Uncomment the implementation assertions inside each test
  - [x]**Fix T-4.4-01 stub: Schnorr signature test:**
    - Import `finalizeEvent` from `nostr-tools/pure` (add to existing import block at line 2)
    - Rename `_unsigned` variable to `unsigned` (remove underscore prefix)
    - Uncomment the `finalizeEvent(unsigned, secretKey)` call and `verifyEvent(signed)` assertion
    - Remove the placeholder assertions (`expect(secretKey).toBeDefined()` etc.)
    - Also remove `_generateSecretKey` and `_getPublicKey` unused aliased imports (lines 4-5) which were only placeholders
  - [x]**Fix T-4.4-02 stub: NIP-06 derivation path:**
    - Compute the expected pubkey for the well-known "abandon" mnemonic at NIP-06 path and fill in the golden-file value
    - Replace the TODO placeholder with `expect(pubkey).toBe('<computed-expected-hex>')` once the golden value is known
  - [x]**Fix T-4.4-04 stub: kind:10033 self-attestation:**
    - Import `type { TeeAttestation }` from `../types.js` (or from `../events/attestation.js` which re-exports it)
    - The stub references `attestationPayload` with `{ nodeId, platform, pcrs: { pcr0, pcr1 } }` — this does not match the `TeeAttestation` type which has `{ enclave, pcr0, pcr1, pcr2, attestationDoc, version }`. Fix the test payload to use the correct type shape and include all required fields.
    - The `buildAttestationEvent()` requires `AttestationEventOptions` as a third argument with `{ relay, chain, expiry }` — add this argument to the call: `buildAttestationEvent(attestation, secretKey, { relay: 'ws://test:7100', chain: '31337', expiry: Math.floor(Date.now() / 1000) + 300 })`
    - Update assertions from `content.nodeId` and `content.platform` to match the actual `TeeAttestation` fields (`content.enclave`, `content.pcr0`, etc.)
    - Remove the stale comment "../events/attestation.js do not exist yet" — `attestation.ts` was created in Story 4.2 (commit `864bb49`)
    - Remove the stale comment "TEE_ATTESTATION_KIND (10033) is not yet in constants.ts" — it was added in Story 4.2
  - [x]**Fix T-4.4-05 stub: KMS unavailable:**
    - Verify that `null as unknown as Uint8Array` correctly triggers `KmsIdentityError` (not a generic TypeError)
    - Consider also testing `undefined`, empty `Uint8Array(0)`, and wrong-length `Uint8Array(16)` as supplementary tests
  - [x]Convert T-4.4-01: KMS keypair valid Schnorr signatures (nostr-tools cross-library validation)
  - [x]Convert T-4.4-02: NIP-06 derivation path (`m/44'/1237'/0'/0/0`)
  - [x]Convert T-4.4-03: Same seed = same pubkey across invocations (determinism)
  - [x]Convert T-4.4-04: KMS identity signs kind:10033 self-attestation
  - [x]Convert T-4.4-05: KMS unavailable — clear error, no random key fallback

## Dev Notes

### Architecture Context

**Nautilus KMS Key Management:**
Nautilus KMS provides persistent seeds encrypted using a DKG (Distributed Key Generation) key from the Threshold Network. Seeds are decryptable only by KMS root servers through the KmsRoot contract with attestation verification. The practical implication for Crosstown: the enclave receives a 32-byte seed from KMS, and this story's `deriveFromKmsSeed()` function converts that seed into a Nostr-compatible keypair using the NIP-06 standard derivation path.

**Identity-Attestation Binding:**
The KMS seed is only accessible when the enclave's attestation is valid (correct PCR values). If operator changes the relay code, PCR values change, attestation fails, KMS seed becomes inaccessible, and the relay loses its identity. This creates a cryptographic binding: identity proves code integrity.

**Relationship to SDK Identity:**
The SDK (`packages/sdk/src/identity.ts`) already has `fromMnemonic()` and `fromSecretKey()` using the same NIP-06 derivation path. This story's `deriveFromKmsSeed()` in core is a specialized variant that:
1. Accepts raw 32-byte seeds (not just mnemonics) — matching KMS output format
2. Lives in core (not SDK) because Docker entrypoints import from core
3. Does NOT include EVM address derivation (that's an SDK concern, not needed for TEE identity)
4. Has KMS-specific error handling (`KmsIdentityError`)

**Why Core, Not SDK:**
The Docker entrypoint (`docker/src/entrypoint-*.ts`) and attestation server (`docker/src/attestation-server.ts`) import from `@crosstown/core`, not `@crosstown/sdk`. KMS identity derivation must be available at the Docker entrypoint level for the relay to derive its identity before creating an SDK node instance.

### Existing Files to Touch

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/package.json` | **MODIFY** | Add `@scure/bip39` and `@scure/bip32` dependencies |
| `packages/core/src/identity/kms-identity.ts` | **CREATE** | `deriveFromKmsSeed()`, `KmsIdentityError`, types |
| `packages/core/src/identity/index.ts` | **CREATE** | Re-export identity module |
| `packages/core/src/identity/kms-identity.test.ts` | **MODIFY** | Convert RED stubs to GREEN, fix stub bugs |
| `packages/core/src/index.ts` | **MODIFY** | Re-export from identity |

### Key Technical Constraints

1. **NIP-06 derivation path:** `m/44'/1237'/0'/0/{accountIndex}` — purpose 44' (BIP-44), coin type 1237' (Nostr), account 0', external chain 0, index N. This is identical to the SDK's `fromMnemonic()` path. The function must produce identical keys for the same mnemonic input as `@crosstown/sdk`'s `fromMnemonic()`.

2. **Raw seed vs mnemonic:** The primary use case is raw 32-byte seeds from KMS (`HDKey.fromMasterSeed(seed).derive(path)`). The mnemonic option is secondary (for backward compat and testing with known BIP-39 vectors). When `options.mnemonic` is provided, it takes precedence — the raw seed is ignored. Note: `HDKey.fromMasterSeed()` accepts seeds of 16-64 bytes; the raw KMS seed is 32 bytes (valid). The mnemonic path produces a 64-byte seed via `mnemonicToSeedSync()` — both are valid inputs.

2a. **`@scure/bip39` v2.x requires explicit wordlist:** `validateMnemonic(mnemonic, wordlist)` needs the English wordlist imported from `@scure/bip39/wordlists/english.js`. This matches the SDK's `identity.ts` import pattern.

3. **No EVM address:** Unlike the SDK's `NodeIdentity` (which includes `evmAddress`), the KMS keypair type only returns `{ secretKey, pubkey }`. EVM address derivation requires `@noble/curves/secp256k1` and `@noble/hashes/sha3` which are SDK dependencies, not core. If EVM address is needed later, callers can use the SDK's `fromSecretKey()`.

4. **Defensive copy:** Return `new Uint8Array(privateKey)` to prevent external mutation, following the SDK's `deriveIdentity()` pattern.

5. **Best-effort seed zeroing:** Follow SDK identity.ts pattern of zeroing intermediate seed material in `finally` blocks. This is not a guarantee (JS has no secure-erase primitive) but limits exposure window.

6. **`@scure/bip39` and `@scure/bip32` must be runtime dependencies** of core, not devDependencies. They are used at runtime for key derivation inside the Docker entrypoint.

7. **`nostr-tools` is already a core dependency** — `getPublicKey()` from `nostr-tools/pure` is available without adding new dependencies.

### Anti-Patterns to Avoid

- **DO NOT fall back to random key generation** when KMS seed is unavailable — this is a security-critical requirement. Always throw `KmsIdentityError`.
- **DO NOT duplicate the EVM address derivation** from the SDK identity module — that's an SDK concern. This story only produces Nostr keypairs.
- **DO NOT import from `@crosstown/sdk`** in `@crosstown/core` — that would create a circular dependency (SDK depends on core).
- **DO NOT store or cache secrets** in module-level variables — each call to `deriveFromKmsSeed()` is stateless.
- **DO NOT create documentation files** — use inline comments and JSDoc.
- **DO NOT modify the Docker entrypoint** in this story — entrypoint integration is a future concern.

### ATDD Test Stubs (Pre-existing RED Phase)

The TEA agent has already created RED phase test stubs for Story 4.4:

| Test ID | File | Description | Status |
|---------|------|-------------|--------|
| T-4.4-01 | `packages/core/src/identity/kms-identity.test.ts` | KMS keypair valid Schnorr signatures (nostr-tools) | RED (it.skip) |
| T-4.4-02 | `packages/core/src/identity/kms-identity.test.ts` | NIP-06 derivation path (`m/44'/1237'/0'/0/0`) | RED (it.skip) |
| T-4.4-03 | `packages/core/src/identity/kms-identity.test.ts` | Same seed = same pubkey across invocations | RED (it.skip) |
| T-4.4-04 | `packages/core/src/identity/kms-identity.test.ts` | KMS identity signs kind:10033 self-attestation | RED (it.skip) |
| T-4.4-05 | `packages/core/src/identity/kms-identity.test.ts` | KMS unavailable — clear error, no random key fallback | RED (it.skip) |

**ATDD Stub Bugs (must fix during GREEN phase):**

- **T-4.4-01: Missing `finalizeEvent` import and unused aliased imports.** The stub comments say "finalizeEvent is the nostr-tools helper that hashes + signs; import it once the implementation exists." The `finalizeEvent` import must be added to the imports at the top, the `_unsigned` variable renamed to `unsigned`, and the commented-out `finalizeEvent(unsigned, secretKey)` / `verifyEvent(signed)` calls uncommented. Additionally, `generateSecretKey as _generateSecretKey` and `getPublicKey as _getPublicKey` (lines 4-5) are unused placeholder imports that should be removed (they are not needed since `deriveFromKmsSeed` handles key derivation).

- **T-4.4-02: Missing golden-file pubkey value.** The stub has `// TODO(green phase): replace with exact expected hex once derived`. The implementation must compute the canonical NIP-06 pubkey for the "abandon" mnemonic and fill this in.

- **T-4.4-04: Incorrect attestation payload shape.** The stub uses `{ nodeId, platform, pcrs: { pcr0, pcr1 } }` but `buildAttestationEvent()` expects `TeeAttestation` type: `{ enclave, pcr0, pcr1, pcr2, attestationDoc, version }`. Also missing the third argument `AttestationEventOptions` (`{ relay, chain, expiry }`). The assertions reference `content.nodeId` and `content.platform` which don't exist in the `TeeAttestation` type. All must be corrected.

- **T-4.4-04: `buildAttestationEvent` reference comment is stale.** Comment says `../events/attestation.js do not exist yet` but attestation.ts was created in Story 4.2. Also says `TEE_ATTESTATION_KIND (10033) is not yet in constants.ts` but it was added in Story 4.2. These comments should be updated or removed.

### Test Traceability

| Test ID | Test Name | AC | Location | Priority | Level | Phase |
|---------|-----------|----|-----------|---------:|-------|-------|
| T-4.4-01 | KMS keypair valid Schnorr signatures | #1 | `packages/core/src/identity/kms-identity.test.ts` | P0 | Unit | GREEN |
| T-4.4-02 | NIP-06 derivation path | #2 | `packages/core/src/identity/kms-identity.test.ts` | P0 | Unit | GREEN |
| T-4.4-03 | Same seed = same pubkey | #3 | `packages/core/src/identity/kms-identity.test.ts` | P1 | Unit | GREEN |
| T-4.4-04 | KMS identity signs kind:10033 | #4 | `packages/core/src/identity/kms-identity.test.ts` | P1 | Unit | GREEN |
| T-4.4-05 | KMS unavailable — clear error | #5 | `packages/core/src/identity/kms-identity.test.ts` | P2 | Unit | GREEN |

### Project Structure Notes

- `deriveFromKmsSeed()` goes in `packages/core/src/identity/kms-identity.ts` (alongside the pre-existing test stub at `kms-identity.test.ts`)
- The `identity/` directory is new in core — requires creating `identity/index.ts` for re-exports
- This follows the ATDD checklist recommendation: "packages/core/src/identity/kms-identity.ts — deriveFromKmsSeed(), KmsIdentityError"
- The function is pure computation: seed in → keypair out. No network calls, no file I/O, no state.

### Previous Epic Patterns

**Commit pattern:** One commit per story with `feat(story-id): description` format.

**Expected commit:** `feat(4-4): Nautilus KMS identity — deriveFromKmsSeed, NIP-06 derivation, KmsIdentityError`

**Testing pattern:** Pure function with comprehensive unit tests. No mocks or transport needed. Real nostr-tools crypto for signature verification. Follows same pattern as Story 4.3 (AttestationVerifier — pure logic, deterministic, no I/O).

### References

- [Source: _bmad-output/planning-artifacts/architecture.md — FR-TEE-4, Decision 12]
- [Source: _bmad-output/planning-artifacts/epics.md — Story 4.4: Nautilus KMS Identity]
- [Source: _bmad-output/test-artifacts/test-design-epic-4.md — R-E4-003 (KMS key incompatibility), T-4.4-01 through T-4.4-05]
- [Source: _bmad-output/test-artifacts/atdd-checklist-epic-4.md — Story 4.4 test IDs, implementation modules]
- [Source: _bmad-output/planning-artifacts/research/technical-marlin-integration-research-2026-03-05.md — Nautilus KMS, Key Management Integration, Phase 4]
- [Source: packages/sdk/src/identity.ts — Existing NIP-06 derivation pattern (fromMnemonic, fromSecretKey)]
- [Source: packages/core/src/identity/kms-identity.test.ts — Pre-existing RED phase test stubs]
- [Source: packages/core/src/events/attestation.ts — buildAttestationEvent(), TeeAttestation (Story 4.2 output)]

---

## Dev Agent Record

**Agent Model Used:** Claude Opus 4.6 (claude-opus-4-6)

**Completion Notes List:**
- Task 1: Added `@scure/bip32` ^2.0.0 and `@scure/bip39` ^2.0.0 as runtime dependencies to `packages/core/package.json`. Ran `pnpm install` to update lockfile.
- Task 2: Created `KmsIdentityError` class extending `CrosstownError` with code `KMS_IDENTITY_ERROR`. Defined `KmsKeypair` and `DeriveFromKmsSeedOptions` interfaces with JSDoc. Implemented `deriveFromKmsSeed()` with full seed validation, mnemonic precedence, NIP-06 path derivation (`m/44'/1237'/0'/0/{accountIndex}`), defensive copy of secret key, and best-effort seed zeroing in finally block.
- Task 3: Implemented `deriveFromKmsSeed()` following the SDK `fromMnemonic()` pattern but specialized for core: raw 32-byte KMS seed support, no EVM address derivation, KMS-specific error handling. Uses `HDKey.fromMasterSeed(seed).derive(path)` for raw seeds and `mnemonicToSeedSync()` for mnemonic path.
- Task 4: Created `packages/core/src/identity/index.ts` barrel re-export. Added identity module exports to `packages/core/src/index.ts`.
- Task 5: Converted all 8 ATDD RED stubs to GREEN. Uncommented imports, removed `it.skip`, fixed test assertions. The TEA agent had already corrected most stub bugs (attestation payload shape, golden pubkey value, import structure) in the pre-existing stubs, so minimal fixes were needed. Used bracket notation for `JSON.parse` content access to satisfy `noPropertyAccessFromIndexSignature`.

**File List:**
- `packages/core/package.json` -- MODIFIED (added @scure/bip32, @scure/bip39 dependencies)
- `packages/core/src/identity/kms-identity.ts` -- CREATED (deriveFromKmsSeed, KmsIdentityError, KmsKeypair, DeriveFromKmsSeedOptions)
- `packages/core/src/identity/index.ts` -- CREATED (barrel re-exports)
- `packages/core/src/identity/kms-identity.test.ts` -- MODIFIED (RED stubs converted to GREEN, 8 tests passing)
- `packages/core/src/index.ts` -- MODIFIED (added identity module re-exports)
- `pnpm-lock.yaml` -- MODIFIED (lockfile updated for new @scure/bip32, @scure/bip39 dependencies)

**Change Log:**
- 2026-03-15: Implemented Story 4.4 -- Nautilus KMS Identity. Added `deriveFromKmsSeed()` to `@crosstown/core` for TEE enclave-bound key derivation from raw 32-byte KMS seeds via NIP-06 path. Created `KmsIdentityError` error class, `KmsKeypair` and `DeriveFromKmsSeedOptions` types. All 8 ATDD tests passing (T-4.4-01 through T-4.4-05 with subtests). Full monorepo: 659 core tests passing, 0 lint errors, build clean.

---

## Code Review Record

### Review Pass #1

- **Date:** 2026-03-15
- **Reviewer Model:** Claude Opus 4.6 (claude-opus-4-6)
- **Outcome:** Pass (all issues fixed)

**Issue Counts:**
| Severity | Found | Fixed |
|----------|------:|------:|
| Critical |     0 |     0 |
| High     |     0 |     0 |
| Medium   |     1 |     1 |
| Low      |     1 |     1 |
| **Total**|   **2** | **2** |

**Issues Found:**
1. **[Medium] Empty string mnemonic silent fallback:** `deriveFromKmsSeed()` accepted an empty string `""` for the `mnemonic` option without throwing `KmsIdentityError`, silently falling back to raw seed derivation instead of producing a clear validation error. Fixed by adding explicit empty-string check before mnemonic validation.
2. **[Low] Redundant try/catch in test:** A test case wrapped assertions in an unnecessary try/catch block that obscured test failures. Fixed by removing the redundant error handling and letting assertions propagate naturally.

**Review Follow-ups:** None — all issues resolved in-pass.

### Review Pass #2

- **Date:** 2026-03-15
- **Reviewer Model:** Claude Opus 4.6 (claude-opus-4-6)
- **Outcome:** Pass (all issues fixed)

**Issue Counts:**
| Severity | Found | Fixed |
|----------|------:|------:|
| Critical |     0 |     0 |
| High     |     0 |     0 |
| Medium   |     0 |     0 |
| Low      |     1 |     1 |
| **Total**|   **1** | **1** |

**Issues Found:**
1. **[Low] Prettier formatting violation in test file:** `kms-identity.test.ts` had formatting that did not conform to the project's Prettier configuration (per retro A15: "Ensure code review agents run Prettier before committing"). Fixed by running `npx prettier --write` on the file.

**Review Notes:**
- All 6 acceptance criteria verified and passing.
- All 30 tests pass (5 ATDD tests + 25 amplification tests covering AC gaps, SDK cross-compatibility, defensive copy, barrel exports, invalid inputs).
- Build clean (tsup ESM + DTS), ESLint 0 errors, Prettier clean.
- No TypeScript errors in the identity module (pre-existing tsc errors in other files are from ATDD stubs for future stories).
- No monorepo test regressions: core 681 passed, SDK 180 passed, BLS 220 passed.
- Implementation correctly follows SDK `fromMnemonic()` pattern but specialized for core: raw 32-byte seed support, no EVM address, KMS-specific errors.
- Official NIP-06 test vector (from nips/06.md) validates against known private key and pubkey values.
- Security: No random key fallback, proper input validation, defensive copy, best-effort seed zeroing.
- Dependencies: `@scure/bip32` and `@scure/bip39` correctly added as runtime dependencies (not devDependencies).

**Review Follow-ups:** None -- all issues resolved in-pass.

### Review Pass #3 (Security-Focused)

- **Date:** 2026-03-15
- **Reviewer Model:** Claude Opus 4.6 (claude-opus-4-6)
- **Outcome:** Pass (all issues fixed)
- **Scope:** Adversarial code review + OWASP Top 10 security analysis + authentication/authorization audit + injection risk scan

**Issue Counts:**
| Severity | Found | Fixed |
|----------|------:|------:|
| Critical |     0 |     0 |
| High     |     0 |     0 |
| Medium   |     1 |     1 |
| Low      |     2 |     2 |
| **Total**|   **3** | **3** |

**Issues Found:**
1. **[Medium] HDKey internal private key material not wiped after derivation:** `HDKey.wipePrivateData()` (available in `@scure/bip32@2.0.1`) was not called in the finally block. For a TEE identity derivation function, all intermediate key material should be zeroed to minimize the window during which secrets remain in memory. Fixed by splitting `HDKey.fromMasterSeed()` and `.derive()` into separate `masterKey` and `childKey` variables accessible from the finally block, then calling `wipePrivateData()` on both.
2. **[Low] Missing test for whitespace-only mnemonic edge case:** Environment variables can contain trailing whitespace or newlines. Added test covering `"   "` and `"\t\n"` mnemonic inputs to document that `validateMnemonic` correctly rejects these.
3. **[Low] Story File List omitted `pnpm-lock.yaml`:** The Dev Agent Record File List documented 5 files but omitted `pnpm-lock.yaml` which was modified in commit `dd47a3d`. Fixed by adding the lockfile entry to the File List.

**Security Assessment (OWASP Top 10):**
- A01 Broken Access Control: N/A (pure function, no access control surfaces)
- A02 Cryptographic Failures: PASS -- NIP-06 derivation correct, seed zeroing present, defensive copy implemented, HDKey material now wiped
- A03 Injection: PASS -- no user input reaches execution contexts (eval, exec, etc.)
- A04 Insecure Design: PASS -- fails closed on invalid inputs, no random key fallback
- A05 Security Misconfiguration: N/A at function level
- A06 Vulnerable Components: PASS -- `@scure/bip32@2.0.1` and `@scure/bip39@2.0.0` are current, maintained by same author as `@noble/curves`
- A07 Auth Failures: PASS -- proper input validation, no bypass paths
- A08 Data Integrity: PASS -- seed integrity enforced by TEE attestation (external), function validates Uint8Array type and length
- A09 Logging Failures: PASS -- no logging of secrets, error messages do not leak key material
- A10 SSRF: N/A (no network calls)

**Review Notes:**
- All 6 acceptance criteria verified and passing.
- All 31 tests pass (5 ATDD tests + 26 amplification tests).
- Build clean, ESLint 0 errors, Prettier clean.
- No monorepo test regressions: core 682 passed.
- HDKey.wipePrivateData() now called for both master and child keys in finally block.

**Review Follow-ups:** None -- all issues resolved in-pass.
