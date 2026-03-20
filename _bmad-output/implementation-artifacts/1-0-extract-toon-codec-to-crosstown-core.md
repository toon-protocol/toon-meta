# Story 1.0: Extract TOON Codec to @toon-protocol/core

Status: done

## Story

As a **SDK developer**,
I want the TOON encoder, decoder, and shallow parser to live in `@toon-protocol/core`,
So that the SDK can access TOON functionality without depending on `@toon-protocol/bls` or `@toon-protocol/relay`, avoiding circular dependencies.

## Acceptance Criteria

1. `packages/core/src/toon/encoder.ts` contains the Nostr event to TOON bytes encoder (moved from `packages/bls/src/toon/encoder.ts`)
2. `packages/core/src/toon/decoder.ts` contains the TOON bytes to Nostr event decoder (moved from `packages/bls/src/toon/decoder.ts`)
3. `packages/core/src/toon/index.ts` re-exports encoder, decoder, and shallow-parse
4. `packages/core/src/toon/shallow-parse.ts` exports `shallowParseToon(data: Uint8Array): ToonRoutingMeta` extracting `{ kind, pubkey, id, sig, rawBytes }` without full NostrEvent validation (uses `decode()` internally but skips `validateNostrEvent()` -- only validates the 4 routing fields)
5. `@toon-protocol/bls` imports TOON codec from `@toon-protocol/core` (no local copy remains)
6. `@toon-protocol/relay` imports TOON codec from `@toon-protocol/core` (no local copy remains)
7. All existing BLS and relay tests pass with updated import paths (`pnpm -r test`)
8. TOON codec exports are available from `@toon-protocol/core` package index

## Tasks / Subtasks

- [x] Task 1: Move encoder to core (AC: #1, #8)
  - [x]Copy `packages/bls/src/toon/encoder.ts` to `packages/core/src/toon/encoder.ts`
  - [x]Change error base class from `BlsBaseError` to `ToonError` (import from `../errors.js`)
  - [x]Keep the same function signatures: `encodeEventToToon(event: NostrEvent): Uint8Array`
  - [x]Add `encodeEventToToonString(event: NostrEvent): string` (exists in relay version, needed by relay consumers)
  - [x]Move `@toon-format/toon` from `devDependencies` to `dependencies` in `packages/core/package.json` (currently at `^1.1.0` in devDependencies; it must be a runtime dependency for the codec to work in consuming packages)
- [x] Task 2: Move decoder to core (AC: #2, #8)
  - [x]Copy `packages/bls/src/toon/decoder.ts` to `packages/core/src/toon/decoder.ts`
  - [x]Change error base class from `BlsBaseError` to `ToonError`
  - [x]Keep same function signatures: `decodeEventFromToon(data: Uint8Array): NostrEvent`
  - [x]Keep `validateNostrEvent()` and `isValidHex()` helpers in the decoder
- [x] Task 3: Create shallow parser (AC: #4)
  - [x]Create `packages/core/src/toon/shallow-parse.ts`
  - [x]Define and export `ToonRoutingMeta` interface: `{ kind: number, pubkey: string, id: string, sig: string, rawBytes: Uint8Array }`
  - [x]Implement `shallowParseToon(data: Uint8Array): ToonRoutingMeta` that decodes the TOON string, extracts only `kind`, `pubkey`, `id`, `sig` from the decoded object, and preserves the original `data` as `rawBytes`
  - [x]Throw `ToonError` for malformed input (cannot parse, missing fields)
  - [x]Do NOT perform full NostrEvent validation (content, tags, created_at are not extracted)
- [x] Task 4: Create index and wire exports (AC: #3, #8)
  - [x]Create `packages/core/src/toon/index.ts` re-exporting: `encodeEventToToon`, `encodeEventToToonString`, `ToonEncodeError`, `decodeEventFromToon`, `ToonError`, `shallowParseToon`, `ToonRoutingMeta`
  - [x]Add TOON exports to `packages/core/src/index.ts`
- [x] Task 5: Move tests to core (AC: #7)
  - [x]Copy `packages/bls/src/toon/toon.test.ts` to `packages/core/src/toon/toon.test.ts` (30 existing test cases)
  - [x]Also check `packages/relay/src/toon/toon.test.ts` for any tests covering `encodeEventToToonString` -- merge those into the core test file (relay test file also has 30 tests, near-identical to BLS but may include string encoding tests)
  - [x]Update imports to use local relative paths (`./index.js`)
  - [x]Add tests for `encodeEventToToonString` if not already covered by the merged tests
  - [x]Add shallow parser tests: encode a known event, shallow parse the bytes, verify `kind`, `pubkey`, `id`, `sig` match the original event fields, and `rawBytes` is byte-identical to the encoded input
  - [x]Add cross-validation test: shallow parse output fields match full decode output fields for the same payload
- [x] Task 6: Update BLS imports (AC: #5, #7)
  - [x]Delete `packages/bls/src/toon/encoder.ts`, `decoder.ts`, `toon.test.ts`
  - [x]Update `packages/bls/src/toon/index.ts` to re-export from `@toon-protocol/core` (or delete and update all BLS import paths to import from `@toon-protocol/core` directly)
  - [x]Add `@toon-protocol/core` as a dependency in `packages/bls/package.json` if not already present
  - [x]Ensure BLS `package.json` has a `test` script (currently missing -- add `"test": "vitest run"` to `scripts` if absent)
  - [x]Run BLS tests: `cd packages/bls && pnpm test`
- [x] Task 7: Update relay imports (AC: #6, #7)
  - [x]Delete `packages/relay/src/toon/encoder.ts`, `decoder.ts`, `toon.test.ts`
  - [x]Update `packages/relay/src/toon/index.ts` to re-export from `@toon-protocol/core` -- must include `encodeEventToToonString` since internal relay files (ConnectionHandler.ts, NostrRelayServer.test.ts) import it from `../toon/index.js`
  - [x]The relay's `packages/relay/src/index.ts` currently re-exports `encodeEventToToon`, `decodeEventFromToon`, `ToonEncodeError`, `ToonError` from `./toon/index.js` but does NOT re-export `encodeEventToToonString`. No change needed to the public API re-exports unless desired.
  - [x]Ensure relay `package.json` has a `test` script (currently missing -- add `"test": "vitest run"` to `scripts` if absent)
  - [x]Run relay tests: `cd packages/relay && pnpm test`
- [x] Task 8: Full regression check (AC: #7)
  - [x]Run `pnpm -r test` from project root
  - [x]Verify zero test regressions

## Dev Notes

### What This Story Does

This is a code extraction and reorganization story. The TOON encoder/decoder already exist and work correctly in both `@toon-protocol/bls` and `@toon-protocol/relay` (they are near-identical copies). The task is to consolidate them into `@toon-protocol/core` and create a new shallow parser. No new encoding/decoding logic is invented.

### Why This Story Exists

The SDK (`@toon-protocol/sdk`) needs TOON codec access. If SDK depends on BLS or relay for the codec, it creates circular dependencies when `@toon-protocol/town` (built on SDK) also provides relay functionality. Moving the codec to `@toon-protocol/core` (the shared foundation package) breaks this cycle.

### Existing Code Locations

**BLS TOON codec** (`packages/bls/src/toon/`):

- `encoder.ts` -- `encodeEventToToon(event: NostrEvent): Uint8Array`, error class `ToonEncodeError extends BlsBaseError`
- `decoder.ts` -- `decodeEventFromToon(data: Uint8Array): NostrEvent`, error class `ToonError extends BlsBaseError`, includes `validateNostrEvent()` and `isValidHex()` helpers
- `index.ts` -- re-exports encoder and decoder
- `toon.test.ts` -- comprehensive roundtrip tests (30 test cases covering 7 event kinds)

**BLS consumers** (files that import from `../toon/index.js`):

- `packages/bls/src/bls/BusinessLogicServer.ts` -- imports `decodeEventFromToon`
- `packages/bls/src/bls/BusinessLogicServer.test.ts` -- imports `encodeEventToToon`
- `packages/bls/src/pricing/PricingService.ts` -- imports `encodeEventToToon`
- `packages/bls/src/pricing/PricingService.test.ts` -- imports `encodeEventToToon`

**Relay TOON codec** (`packages/relay/src/toon/`):

- `encoder.ts` -- same as BLS plus `encodeEventToToonString(event: NostrEvent): string` (returns TOON as string, not Uint8Array). Error class `ToonEncodeError extends RelayError`
- `decoder.ts` -- identical to BLS except error base class is `RelayError` instead of `BlsBaseError`
- `index.ts` -- re-exports including `encodeEventToToonString`

**Relay consumers** (files that import from `../toon/index.js`):

- `packages/relay/src/pricing/PricingService.ts` -- imports `encodeEventToToon`
- `packages/relay/src/pricing/PricingService.test.ts` -- imports `encodeEventToToon`
- `packages/relay/src/websocket/ConnectionHandler.ts` -- imports `encodeEventToToonString`
- `packages/relay/src/websocket/ConnectionHandler.test.ts` -- imports `encodeEventToToonString`
- `packages/relay/src/websocket/NostrRelayServer.test.ts` -- imports `encodeEventToToonString`
- `packages/relay/src/bls/BusinessLogicServer.ts` -- imports `decodeEventFromToon`
- `packages/relay/src/bls/BusinessLogicServer.test.ts` -- imports `encodeEventToToon`
- `packages/relay/src/index.ts` -- re-exports `encodeEventToToon`, `decodeEventFromToon`, `ToonEncodeError`, `ToonError` (does NOT re-export `encodeEventToToonString` -- that function is only used internally by relay files importing from `../toon/index.js`)

**Core target directory**: `packages/core/src/toon/` exists but is empty.

**Core error base class**: `ToonError` in `packages/core/src/errors.ts` -- this is what the moved error classes should extend.

### Error Class Migration

BLS uses `BlsBaseError` and relay uses `RelayError` as base classes for TOON errors. In core, both `ToonEncodeError` and `ToonError` must extend `ToonError`:

```typescript
// In packages/core/src/toon/encoder.ts
import { ToonError } from '../errors.js';

export class ToonEncodeError extends ToonError {
  constructor(message: string, cause?: Error) {
    super(message, 'TOON_ENCODE_ERROR', cause);
    this.name = 'ToonEncodeError';
  }
}
```

```typescript
// In packages/core/src/toon/decoder.ts
import { ToonError } from '../errors.js';

export class ToonError extends ToonError {
  constructor(message: string, cause?: Error) {
    super(message, 'TOON_DECODE_ERROR', cause);
    this.name = 'ToonError';
  }
}
```

**Constructor signature change (important):**

- `BlsBaseError(message, code)` / `RelayError(message, code)` -- then BLS/relay encoders set `this.cause = cause` manually on a separate line
- `ToonError(message, code, cause?)` -- passes `cause` through to `Error` via `super(message, { cause })` using the standard `Error` cause option
- In the new core versions, pass `cause` as the third arg to `super()`. Do NOT set `this.cause` manually -- `ToonError` handles it via `Error`'s built-in cause mechanism.
- Remove the `if (cause) { this.cause = cause; }` block that exists in the BLS/relay versions.

### Shallow Parser Implementation

The shallow parser is new code. It extracts routing metadata from TOON-encoded bytes without performing full NostrEvent validation. Implementation approach:

1. Decode the TOON bytes to a string, then use `@toon-format/toon`'s `decode()` to get a JavaScript object
2. Extract only `kind`, `pubkey`, `id`, `sig` from the decoded object using type guards (check types, validate hex lengths for pubkey/id/sig)
3. Preserve the original `Uint8Array` as `rawBytes` (this is the input bytes, not re-encoded)

This is NOT a zero-decode approach -- it does use `decode()` but skips the expensive `validateNostrEvent()` step that checks all 7 fields, tags structure, etc. The shallow parser validates only the 4 routing fields.

The `rawBytes` field is critical: Story 1.4 (Schnorr verification) uses it for signature verification against the original serialized bytes. It MUST be the original encoded bytes, not re-encoded bytes.

```typescript
export interface ToonRoutingMeta {
  kind: number;
  pubkey: string;
  id: string;
  sig: string;
  rawBytes: Uint8Array;
}

export function shallowParseToon(data: Uint8Array): ToonRoutingMeta {
  // Decode TOON to object
  // Extract and validate only kind, pubkey, id, sig
  // Return with rawBytes = data (the original input)
}
```

### Dependency Updates

- `packages/core/package.json`: `@toon-format/toon` is currently in `devDependencies` at `^1.1.0`. It MUST be moved to `dependencies` (not just verified). Without this, consuming packages that depend on `@toon-protocol/core` will get a runtime error when the TOON codec tries to import `@toon-format/toon`.
- `packages/bls/package.json`: `@toon-protocol/core` is already in `dependencies` at `workspace:*`. `@toon-format/toon` at `^1.0.0` is also a direct dependency -- it can be removed after migration since BLS will get it transitively through core, but this is optional cleanup.
- `packages/relay/package.json`: `@toon-protocol/core` is already in `dependencies` at `workspace:*`. `@toon-format/toon` at `^1.0.0` is also a direct dependency -- same optional cleanup as BLS.

### Re-export Strategy for BLS and Relay

Two valid approaches for updating BLS/relay:

**Option A (recommended): Thin re-export files.** Keep `packages/bls/src/toon/index.ts` and `packages/relay/src/toon/index.ts` as thin re-export files pointing to `@toon-protocol/core`:

```typescript
// packages/bls/src/toon/index.ts
export { encodeEventToToon, ToonEncodeError } from '@toon-protocol/core';
export { decodeEventFromToon, ToonError } from '@toon-protocol/core';

// packages/relay/src/toon/index.ts (includes encodeEventToToonString)
export {
  encodeEventToToon,
  encodeEventToToonString,
  ToonEncodeError,
} from '@toon-protocol/core';
export { decodeEventFromToon, ToonError } from '@toon-protocol/core';
```

The relay re-export must include `encodeEventToToonString` because internal relay files (ConnectionHandler.ts, etc.) import it from `../toon/index.js`.

This approach minimizes changes in BLS/relay consumer files -- they continue importing from `../toon/index.js`.

**Option B: Direct imports.** Delete the toon directories entirely and update every import site to use `@toon-protocol/core` directly. More churn but cleaner long-term.

Choose whichever approach results in fewer changes and lower regression risk.

### BLS/Relay Error Compatibility

After migration, `ToonError` and `ToonEncodeError` will be `instanceof ToonError` (not `BlsBaseError` or `RelayError`).

**Actual `instanceof` check locations (verified):**

- `packages/bls/src/storage/SqliteEventStore.ts:151` -- `instanceof BlsBaseError` (NOT `ToonError`). This catch block re-throws `BlsBaseError` subclasses and wraps others. After migration, TOON errors thrown from the decoder will no longer match `instanceof BlsBaseError`. However, since `decodeEventFromToon` is called OUTSIDE this catch block (in the BLS request handler, not in SqliteEventStore), this is NOT affected by the migration.
- `packages/relay/src/storage/SqliteEventStore.ts:163` -- `instanceof RelayError`. Same pattern, same analysis: not affected.
- `packages/bls/src/toon/decoder.ts:101` and `packages/relay/src/toon/decoder.ts:101` -- `instanceof ToonError` inside the decoder's own catch block. These files are being DELETED, so no compatibility concern.

**Verdict: No catch block updates needed in BLS or relay.** The `instanceof` checks in SqliteEventStore are on `BlsBaseError`/`RelayError` (not TOON errors) and those catch blocks never handle TOON codec errors.

### Project Structure Notes

Target structure after this story:

```
packages/core/src/toon/
  ├── index.ts           # Re-exports all TOON public API
  ├── encoder.ts         # encodeEventToToon, encodeEventToToonString, ToonEncodeError
  ├── decoder.ts         # decodeEventFromToon, ToonError, validateNostrEvent, isValidHex
  ├── shallow-parse.ts   # shallowParseToon, ToonRoutingMeta
  └── toon.test.ts       # All tests (roundtrip + shallow parse)
```

### Testing Strategy

**From test design (test-design-epic-1.md):**

| ID       | Test                                                                   | Level       | Risk   | Priority |
| -------- | ---------------------------------------------------------------------- | ----------- | ------ | -------- |
| T-1.0-01 | Encode NostrEvent -> TOON bytes -> decode back = identical event       | Unit        | E1-R01 | P0       |
| T-1.0-02 | Shallow parse extracts kind from TOON bytes, matches full decode       | Unit        | E1-R02 | P0       |
| T-1.0-03 | Shallow parse extracts pubkey from TOON bytes, matches full decode     | Unit        | E1-R02 | P0       |
| T-1.0-04 | Shallow parse extracts id from TOON bytes, matches full decode         | Unit        | E1-R02 | P0       |
| T-1.0-05 | Shallow parse extracts sig from TOON bytes, matches full decode        | Unit        | E1-R02 | P0       |
| T-1.0-06 | Shallow parse preserves rawBytes (byte-exact match with encoded input) | Unit        | E1-R02 | P0       |
| T-1.0-07 | Re-export from `@toon-protocol/core` index.ts works (import validation)    | Unit        | E1-R01 | P1       |
| T-1.0-08 | BLS and relay tests pass after import path change (`pnpm -r test`)     | Integration | E1-R01 | P0       |

The existing `toon.test.ts` (30 test cases) covers T-1.0-01 thoroughly. New tests needed: T-1.0-02 through T-1.0-07 for the shallow parser and re-exports.

### BLS and Relay Packages Missing Test Scripts

Both `packages/bls/package.json` and `packages/relay/package.json` have no `test` script (only `build` and `dev`). Before running `pnpm test` in either package, add `"test": "vitest run"` to both packages' `scripts` sections. The core package already has `"test": "vitest run"` as a reference. Without this, Tasks 6, 7, and 8 will fail when attempting `pnpm test` in those packages.

### Critical Rules

- **Never use `any` type** -- use `unknown` with type guards (enforced by ESLint)
- **Always use `.js` extensions in imports** -- ESM requires `import { foo } from './bar.js'`
- **Use consistent type imports** -- `import type { NostrEvent } from 'nostr-tools/pure'`
- **Error classes extend ToonError** -- not `Error`, `BlsBaseError`, or `RelayError`
- **TOON is the native format** -- this codec is foundational to the entire stack
- **No `encodeEventToToonString` in BLS** -- BLS only had `encodeEventToToon` (Uint8Array). The string version came from relay. Core should have both.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.0]
- [Source: _bmad-output/planning-artifacts/architecture.md#Decision 1: TOON Codec Location]
- [Source: _bmad-output/planning-artifacts/architecture.md#Modified Package: @toon-protocol/core]
- [Source: _bmad-output/planning-artifacts/test-design-epic-1.md#Story 1.0]
- [Source: packages/bls/src/toon/encoder.ts] -- existing encoder implementation
- [Source: packages/bls/src/toon/decoder.ts] -- existing decoder implementation
- [Source: packages/bls/src/toon/toon.test.ts] -- existing test suite (30 test cases)
- [Source: packages/relay/src/toon/encoder.ts] -- relay encoder with `encodeEventToToonString`
- [Source: packages/relay/src/toon/decoder.ts] -- relay decoder (identical logic to BLS)
- [Source: packages/core/src/errors.ts] -- ToonError base class

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

None -- no debug sessions required. Implementation was already present in WIP commits; agent completed verification, fixed vitest config issues, and finalized the story.

### Completion Notes List

- **Task 1 (Move encoder to core)**: Verified `packages/core/src/toon/encoder.ts` contains `encodeEventToToon` and `encodeEventToToonString`, error class extends `ToonError` with proper cause handling, `@toon-format/toon` is in `dependencies` (not `devDependencies`).
- **Task 2 (Move decoder to core)**: Verified `packages/core/src/toon/decoder.ts` contains `decodeEventFromToon`, `ToonError` extends `ToonError`, includes `validateNostrEvent()` and `isValidHex()` helpers.
- **Task 3 (Create shallow parser)**: Verified `packages/core/src/toon/shallow-parse.ts` exports `ToonRoutingMeta` interface and `shallowParseToon` function. Validates only 4 routing fields (kind, pubkey, id, sig), preserves rawBytes as original input.
- **Task 4 (Create index and wire exports)**: Verified `packages/core/src/toon/index.ts` re-exports all public API. `packages/core/src/index.ts` exports TOON codec from `./toon/index.js`.
- **Task 5 (Move tests to core)**: Verified `packages/core/src/toon/toon.test.ts` contains 52 tests covering: encoding (8 tests), string encoding (4 tests), decoding (14 tests), round-trips (8 tests), shallow parser (12 tests), re-export validation (6 tests).
- **Task 6 (Update BLS imports)**: Verified BLS toon/index.ts is a thin re-export from `@toon-protocol/core`. Old encoder.ts, decoder.ts, toon.test.ts deleted. BLS `package.json` has `"test": "vitest run"`. Created `packages/bls/vitest.config.ts` to fix test discovery when running from package directory. BLS tests: 10 files, 233 tests passed.
- **Task 7 (Update relay imports)**: Verified relay toon/index.ts is a thin re-export from `@toon-protocol/core` (includes `encodeEventToToonString`). Old encoder.ts, decoder.ts, toon.test.ts deleted. Relay `package.json` has `"test": "vitest run"`. Created `packages/relay/vitest.config.ts` to fix test discovery. Relay tests: 9 files, 216 tests passed.
- **Task 8 (Full regression check)**: Core: 24 files, 510 tests passed. BLS: 10 files, 233 tests passed. Relay: 9 files, 216 tests passed. Docker: 1 file failed (pre-existing, unrelated to TOON codec changes). No regressions introduced.

### File List

- `packages/core/src/toon/encoder.ts` -- created (moved from BLS/relay, error class changed to ToonError)
- `packages/core/src/toon/decoder.ts` -- created (moved from BLS/relay, error class changed to ToonError)
- `packages/core/src/toon/shallow-parse.ts` -- created (new shallow parser with ToonRoutingMeta)
- `packages/core/src/toon/validate.ts` -- created (shared `isValidHex` utility, extracted during code review #1)
- `packages/core/src/toon/index.ts` -- created (re-exports all TOON public API)
- `packages/core/src/toon/toon.test.ts` -- created (merged BLS+relay tests, added shallow parser + re-export tests)
- `packages/core/src/index.ts` -- modified (added TOON codec exports)
- `packages/core/package.json` -- modified (`@toon-format/toon` moved from devDependencies to dependencies)
- `packages/core/vitest.config.ts` -- created (enables `pnpm test` from package directory)
- `packages/bls/src/toon/encoder.ts` -- deleted
- `packages/bls/src/toon/decoder.ts` -- deleted
- `packages/bls/src/toon/toon.test.ts` -- deleted
- `packages/bls/src/toon/index.ts` -- modified (thin re-export from @toon-protocol/core)
- `packages/bls/package.json` -- modified (added "test": "vitest run" script)
- `packages/bls/vitest.config.ts` -- created (enables `pnpm test` from package directory)
- `packages/relay/src/toon/encoder.ts` -- deleted
- `packages/relay/src/toon/decoder.ts` -- deleted
- `packages/relay/src/toon/toon.test.ts` -- deleted
- `packages/relay/src/toon/index.ts` -- modified (thin re-export from @toon-protocol/core, includes encodeEventToToonString)
- `packages/relay/package.json` -- modified (added "test": "vitest run" script)
- `packages/relay/vitest.config.ts` -- created (enables `pnpm test` from package directory)

### Change Log

| Date       | Summary                                                                                                                                                                                                                                                                                                                                                           |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-03-04 | Verified and completed Story 1.0: TOON codec extraction to @toon-protocol/core. Encoder, decoder, and shallow parser are consolidated in packages/core/src/toon/. BLS and relay use thin re-exports. Created vitest.config.ts for core, BLS, and relay packages to enable per-package test execution. All 959 tests across core/BLS/relay pass with zero regressions. |

## Code Review Record

### Review Pass #1

| Field              | Value                             |
| ------------------ | --------------------------------- |
| **Date**           | 2026-03-04                        |
| **Reviewer Model** | Claude Opus 4.6 (claude-opus-4-6) |
| **Outcome**        | PASS                              |
| **Critical**       | 0                                 |
| **High**           | 0                                 |
| **Medium**         | 0                                 |
| **Low**            | 1 (fixed)                         |

**Issues Found:**

1. **[Low] DRY violation: duplicated `isValidHex` function** -- The `isValidHex` helper was defined in both `decoder.ts` and `shallow-parse.ts` with identical logic. Extracted to a shared `packages/core/src/toon/validate.ts` utility module. Both `decoder.ts` and `shallow-parse.ts` now import from `./validate.js`. The function is not part of the public API (not re-exported from `toon/index.ts`).

**Files Changed by Review:**

- `packages/core/src/toon/validate.ts` -- created (shared `isValidHex` utility)
- `packages/core/src/toon/decoder.ts` -- modified (imports `isValidHex` from `./validate.js`, removed local definition)
- `packages/core/src/toon/shallow-parse.ts` -- modified (imports `isValidHex` from `./validate.js`, removed local definition)

### Review Pass #2

| Field              | Value                             |
| ------------------ | --------------------------------- |
| **Date**           | 2026-03-04                        |
| **Reviewer Model** | Claude Opus 4.6 (claude-opus-4-6) |
| **Outcome**        | PASS                              |
| **Critical**       | 0                                 |
| **High**           | 0                                 |
| **Medium**         | 0                                 |
| **Low**            | 0                                 |

**Issues Found:** None. All 8 acceptance criteria verified against actual code -- all pass.

**Test Results:** 536 core tests, 233 BLS tests, 216 relay tests pass.

**Files Changed by Review:** None. No code changes required.

**Notes:** Review Pass #1 action item (Low: DRY violation for `isValidHex`) was resolved in the previous pass. No new issues identified in this pass.

### Review Pass #3

| Field              | Value                             |
| ------------------ | --------------------------------- |
| **Date**           | 2026-03-04                        |
| **Reviewer Model** | Claude Opus 4.6 (claude-opus-4-6) |
| **Outcome**        | PASS                              |
| **Critical**       | 0                                 |
| **High**           | 0                                 |
| **Medium**         | 0                                 |
| **Low**            | 0                                 |

**Issues Found:** None. OWASP Top 10 assessment clean. Implementation production-ready.

**Files Changed by Review:** None. No code changes required.

**Notes:** Final review pass. Zero issues across all severity levels. OWASP Top 10 assessment produced no findings. Implementation is production-ready.
