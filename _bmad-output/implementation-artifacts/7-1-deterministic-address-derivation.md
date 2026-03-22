# Story 7.1: Deterministic Address Derivation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **TOON node operator**,
I want my ILP address to be deterministically derived from my Nostr pubkey and my upstream peer's prefix,
So that address assignment is automatic, collision-resistant, and requires zero configuration.

**FRs covered:** FR-ADDR-1 (Deterministic address derivation from pubkey + parent prefix)

**Dependencies:** None -- this is the foundation story for Chain A (Address Hierarchy). All infrastructure from Epics 1-6 is complete. The `@toon-protocol/core` package already has `constants.ts` for protocol constants and an established pattern for utility functions.

**Decision sources:**
- Party Mode 2026-03-20 Prepaid Protocol Decisions: D7-003 (prefix claim single-packet), D7-004 (unified payment pattern) -- address derivation is the foundation these build on
- Epic 7 architectural decisions (epics.md): 8-char pubkey truncation, `g.toon` root prefix constant, hierarchical ILP addressing

**Downstream dependencies:** Story 7.2 (BTP Address Assignment Handshake) consumes `deriveChildAddress()` to compute addresses from handshake-communicated prefixes. Story 7.3 (Multi-Address Support) extends the addressing model to multiple upstream peerings. Story 7.7 (Prefix Claim Marketplace) replaces pubkey-derived addresses with vanity prefixes but relies on the derivation utility as the default.

## Acceptance Criteria

1. **Child address derivation:** Given a `deriveChildAddress(parentPrefix, childPubkey)` utility function, when called with `('g.toon', 'abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234')`, then it returns `g.toon.abcd1234` (first 8 hex characters of the pubkey appended as a new ILP address segment). When called with `('g.toon.ef567890', '11aabb2233ccdd4455eeff6677889900aabbccdd11223344aabbccdd11223344')`, it returns `g.toon.ef567890.11aabb22` (nested derivation works at any depth).

2. **Root prefix constant:** Given the genesis node starting the TOON network, when it initializes, then it uses the ILP root prefix `g.toon` as a protocol constant (not derived from any pubkey). This constant is exported from `@toon-protocol/core`.

3. **ILP address segment validation:** Given pubkeys with varying formats, when `deriveChildAddress()` is called, then derived address segments are always lowercase hex, the function lowercases uppercase hex input, and rejects pubkeys with non-hex characters or fewer than 8 hex characters. The resulting ILP address conforms to connector address rules (dot-separated segments, each segment non-empty, valid characters only).

## Tasks / Subtasks

- [x] Task 1: Define ILP root prefix constant and address derivation utility (AC: #1, #2, #3)
  - [x] 1.1 Add `ILP_ROOT_PREFIX = 'g.toon'` constant to `packages/core/src/constants.ts`
  - [x] 1.2 Create `packages/core/src/address/derive-child-address.ts` with `deriveChildAddress(parentPrefix: string, childPubkey: string): string`
  - [x] 1.3 Implement 8-char hex truncation: extract first 8 hex characters of `childPubkey`, lowercase, append as new segment to `parentPrefix`
  - [x] 1.4 Implement input validation:
    - Reject empty `parentPrefix` (throw `ToonError` with code `ADDRESS_INVALID_PREFIX`)
    - Reject `parentPrefix` containing invalid ILP address characters (throw `ToonError` with code `ADDRESS_INVALID_PREFIX`)
    - Reject `childPubkey` shorter than 8 hex characters (throw `ToonError` with code `ADDRESS_INVALID_PUBKEY`)
    - Reject `childPubkey` containing non-hex characters (throw `ToonError` with code `ADDRESS_INVALID_PUBKEY`)
    - Lowercase the pubkey before truncation (handles mixed-case input)
  - [x] 1.5 Implement ILP address validation on the result: dot-separated segments, each non-empty, valid characters only
  - [x] 1.6 Create `packages/core/src/address/index.ts` barrel file exporting `deriveChildAddress` (follows established pattern: `events/index.ts`, `chain/index.ts`, `identity/index.ts`)
  - [x] 1.7 Export `deriveChildAddress` and `ILP_ROOT_PREFIX` from `packages/core/src/index.ts` (re-export `deriveChildAddress` from `./address/index.js`, `ILP_ROOT_PREFIX` from `./constants.js`)

- [x] Task 2: Unit tests for `deriveChildAddress()` (AC: #1, #3)
  - [x] 2.1 Test: `deriveChildAddress('g.toon', 'abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234')` returns `g.toon.abcd1234` (T-7.1-01)
  - [x] 2.2 Test: `deriveChildAddress('g.toon.ef567890', '11aabb2233ccdd4455eeff6677889900aabbccdd11223344aabbccdd11223344')` returns `g.toon.ef567890.11aabb22` -- nested derivation (T-7.1-02)
  - [x] 2.3 Test: root prefix `g.toon` is an exported constant `ILP_ROOT_PREFIX`, not derived from a pubkey (T-7.1-03)
  - [x] 2.4 Test: derived address contains only lowercase hex chars in the child segment (T-7.1-04)
  - [x] 2.5 Test: uppercase hex pubkey `'ABCD1234ABCD1234ABCD1234ABCD1234ABCD1234ABCD1234ABCD1234ABCD1234'` lowercased to `g.toon.abcd1234` (T-7.1-05)
  - [x] 2.6 Test: two pubkeys sharing 8-char prefix (`abcd1234aaaa0000...` 64-char hex and `abcd1234bbbb0000...` 64-char hex) under same parent produce same derived address `g.toon.abcd1234` -- collision is a documented known property of 8-char truncation (T-7.1-06)
  - [x] 2.7 Test: birthday paradox analysis documenting collision probability (< 0.001% for < 3000 peers at 8 hex chars / 4.29B address space) (T-7.1-07)
  - [x] 2.8 Test: empty parent prefix throws `ToonError` with code `ADDRESS_INVALID_PREFIX` (T-7.1-08)
  - [x] 2.8a Test: parent prefix with invalid ILP characters (e.g., `g.toon.UPPER` or `g.toon.sp ace`) throws `ToonError` with code `ADDRESS_INVALID_PREFIX`
  - [x] 2.9 Test: pubkey shorter than 8 hex chars throws `ToonError` with code `ADDRESS_INVALID_PUBKEY` (T-7.1-09)
  - [x] 2.10 Test: pubkey with non-hex characters throws `ToonError` with code `ADDRESS_INVALID_PUBKEY` (T-7.1-10)
  - [x] 2.11 Test: determinism -- same inputs always produce same output (T-7.1-11)
  - [x] 2.12 Test: ILP address structure valid -- total address within length limits, segments separated by dots, each segment non-empty (T-7.1-12)

- [x] Task 3: Export and integration verification (AC: #1, #2, #3)
  - [x] 3.1 Verify `deriveChildAddress` and `ILP_ROOT_PREFIX` are importable from `@toon-protocol/core`
  - [x] 3.2 Write static analysis test: `@toon-protocol/core` public API exports `deriveChildAddress` and `ILP_ROOT_PREFIX`
  - [x] 3.3 Verify builds pass: `pnpm build && pnpm test`

## Dev Notes

### Architecture and Constraints

**This is a pure utility function -- no side effects, no state.** `deriveChildAddress()` is a deterministic function from `(parentPrefix, childPubkey)` to a string. It lives in `@toon-protocol/core` because it is consumed by both the SDK (Story 7.2 BTP handshake) and potentially Town (kind:10032 event construction). It has zero dependencies beyond core's own types.

**File placement:** Create `packages/core/src/address/derive-child-address.ts` as a new module directory. This follows the pattern of `packages/core/src/chain/`, `packages/core/src/events/`, `packages/core/src/identity/` -- domain-specific subdirectories under core's src.

**8-character truncation rationale (from Epic 7 test plan):**
- 8 hex characters = 16^8 = 4,294,967,296 possible values
- Birthday paradox: collision probability exceeds 1% only at ~9,292 peers under the same parent
- This is more than sufficient for any realistic TOON network deployment
- Collision detection is NOT the responsibility of `deriveChildAddress()` -- it is a pure derivation function. Collision handling (if two peers produce the same child segment) is the caller's responsibility (Story 7.2 BTP handshake handler)

**ILP address constraints:**
- Segments separated by `.` (dot)
- Each segment must be non-empty
- Characters must be valid ILP address characters (alphanumeric + hyphen, lowercase)
- The child segment from pubkey truncation will always be lowercase hex (a subset of valid chars)
- Total address length should be reasonable (ILP addresses have practical limits)

**Root prefix `g.toon`:**
- `g.` is the ILP global allocation prefix (standard ILP convention)
- `toon` is the TOON network identifier
- The genesis node uses `g.toon` directly -- it does not derive its address from a pubkey
- All other nodes derive addresses as children of their upstream peer's prefix

**What this story does NOT include:**
- BTP handshake protocol changes (Story 7.2)
- Multi-address support in kind:10032 events (Story 7.3)
- Fee-per-byte fields (Story 7.4)
- Prefix claim events or vanity prefixes (Story 7.7)
- Any changes to `createNode()`, `publishEvent()`, or the SDK pipeline

**Risk E7-R001 (Address collision, score 6):** The 8-char truncation means collisions are theoretically possible but astronomically unlikely at realistic peer counts. T-7.1-06 and T-7.1-07 document this as a known property. The design decision is intentional: 8 chars balances readability (human-scannable addresses) with collision resistance. If collision detection is needed, it belongs in the BTP handshake handler (Story 7.2), not in this pure derivation function.

**Risk E7-R002 (Invalid ILP address characters, score 4):** Mitigated by lowercasing all input and validating hex-only pubkey characters before truncation.

### What Already Exists (DO NOT Recreate)

- **`constants.ts`** in `packages/core/src/constants.ts` -- existing protocol constants (`ILP_PEER_INFO_KIND`, `SERVICE_DISCOVERY_KIND`, `TEE_ATTESTATION_KIND`, DVM kind constants). Add `ILP_ROOT_PREFIX` here alongside existing constants
- **`ToonError`** in `packages/core/src/errors.ts` -- base error class for domain errors. Use for all validation errors in `deriveChildAddress()`
- **Core subdirectory pattern** -- `packages/core/src/chain/`, `packages/core/src/events/`, `packages/core/src/identity/` each have an `index.ts` barrel file re-exported from `packages/core/src/index.ts`. Follow this pattern for `packages/core/src/address/`
- **`packages/core/src/index.ts`** -- main barrel file re-exporting all public API. Do NOT duplicate exports; re-export from `./address/index.js`

### Testing Approach

Follow the standard unit test pattern established in Epic 6. All tests go in `packages/core/src/address/derive-child-address.test.ts`. Use `describe`/`it` blocks. No mocking needed -- this is a pure function.

Expected test count: ~13 tests (T-7.1-01 through T-7.1-12 from the epic test plan, plus T-2.8a for parentPrefix validation). Budget 1.0-1.5x amplification for this focused utility story.

---

## Dev Agent Record

- **Agent Model Used:** Claude Opus 4.6 (1M context)
- **Completion Notes List:**
  - Task 1: Added `ILP_ROOT_PREFIX = 'g.toon'` constant to `constants.ts`. Created `derive-child-address.ts` with full input validation (prefix emptiness, ILP character validity, pubkey hex-only check, minimum length), 8-char hex truncation with lowercasing, and result length validation. Created `address/index.ts` barrel file. Exported `deriveChildAddress` and `ILP_ROOT_PREFIX` from `packages/core/src/index.ts`.
  - Task 2: All 16 pre-written TDD tests pass (T-7.1-01 through T-7.1-12, T-2.8a, T-2.8a-b, T-7.1-12b, T-3.2). Tests cover: basic derivation, nested derivation, root prefix constant, lowercase output, uppercase normalization, collision properties, birthday paradox analysis, empty prefix rejection, invalid prefix characters, short pubkey rejection, non-hex pubkey rejection, determinism, ILP structure validation, deep nesting, and public API export verification.
  - Task 3: Verified `deriveChildAddress` and `ILP_ROOT_PREFIX` are importable from `@toon-protocol/core`. Build passes (`pnpm build`). Full test suite passes across all packages. Lint passes (0 errors).
- **File List:**
  - `packages/core/src/constants.ts` (modified -- added `ILP_ROOT_PREFIX`)
  - `packages/core/src/address/derive-child-address.ts` (created -- implementation)
  - `packages/core/src/address/index.ts` (created -- barrel file)
  - `packages/core/src/index.ts` (modified -- added exports for `ILP_ROOT_PREFIX` and `deriveChildAddress`)
- **Change Log:**
  - 2026-03-21: Implemented Story 7.1 -- deterministic ILP address derivation from Nostr pubkeys. Added `deriveChildAddress()` pure utility function and `ILP_ROOT_PREFIX` constant to `@toon-protocol/core`. All 16 unit tests pass, full suite green, zero lint errors.

## Code Review Record

### Review Pass #1
- **Date:** 2026-03-21
- **Reviewer Model:** Claude Opus 4.6 (1M context)
- **Issues Found:** Critical: 0, High: 0, Medium: 0, Low: 1
  - Low: Incorrect error code `ADDRESS_INVALID_PREFIX` used for address-too-long validation on line 116 of `packages/core/src/address/derive-child-address.ts`; changed to `ADDRESS_TOO_LONG`.
- **Outcome:** Success -- all issues fixed inline during review.

### Review Pass #2
- **Date:** 2026-03-21
- **Reviewer Model:** Claude Opus 4.6 (1M context)
- **Issues Found:** Critical: 0, High: 0, Medium: 0, Low: 1
  - Low: Validation order in `packages/core/src/address/derive-child-address.ts` -- pubkey length check was running after hex-content check, producing misleading error messages for short/empty pubkey inputs. Swapped validation order so length check runs first.
- **Outcome:** Success -- all issues fixed inline during review. No remaining concerns.

### Review Pass #3 (Security-Focused)
- **Date:** 2026-03-21
- **Reviewer Model:** Claude Opus 4.6 (1M context)
- **Scope:** Full code review + OWASP Top 10 + auth/authz + injection + ReDoS + Semgrep automated scan
- **Tools Used:** Semgrep OSS v1.153.0 (custom rules: regex-dos, user-input-in-error, command-injection, unsafe-deserialization, eval-usage, sql-injection, path-traversal, missing-input-length-check, redos-risk)
- **Issues Found:** Critical: 0, High: 0, Medium: 1, Low: 0
  - Medium: Missing maximum pubkey length validation -- `HEX_PATTERN.test(childPubkey)` ran against unbounded input. While the regex is linear (simple character class, no ReDoS risk), an excessively long string (multi-MB) could waste CPU/memory. Added `MAX_PUBKEY_LENGTH = 128` constant and length check before regex test. Nostr pubkeys are 64 hex chars; 128 provides headroom. Added 2 boundary tests (129 chars rejected, 128 chars accepted).
- **Semgrep Findings (triaged):**
  - 4x INFO CWE-209 (user input in error messages): Not actionable -- this is a library function, not an HTTP handler. Project convention delegates HTTP-level error sanitization to the handler layer per critical rule "NEVER expose internal error details in HTTP responses".
  - 2x INFO ReDoS risk on `/^[a-z0-9-]+$/` and `/^[0-9a-fA-F]+$/`: False positive -- simple character-class quantifiers run in O(n) linear time, no catastrophic backtracking possible. Now also bounded by MAX_PUBKEY_LENGTH.
- **Security Analysis Summary:**
  - OWASP A03 (Injection): No injection vectors -- pure function, no DB/FS/exec.
  - OWASP A01 (Broken Access Control): N/A -- pure utility, no auth.
  - OWASP A02 (Cryptographic Failures): N/A -- no crypto operations.
  - OWASP A04 (Insecure Design): Collision properties well-documented (T-7.1-06, T-7.1-07).
  - OWASP A05 (Security Misconfiguration): N/A.
  - OWASP A06 (Vulnerable Components): No external dependencies beyond ToonError.
  - OWASP A07 (Auth Failures): N/A.
  - OWASP A08 (Data Integrity): Deterministic derivation, no data mutation.
  - OWASP A09 (Logging/Monitoring): N/A -- pure function.
  - OWASP A10 (SSRF): N/A -- no network calls.
- **Outcome:** Success -- medium-severity issue fixed with `MAX_PUBKEY_LENGTH` guard + 2 new tests. Full suite green (2476 passed, 29 in address module). No remaining concerns.
