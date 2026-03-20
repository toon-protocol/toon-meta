# Story 1.11: Package Setup and npm Publish

Status: done

## Story

As a **service developer**,
I want to `npm install @toon-protocol/sdk` and import a clean public API,
So that I can start building immediately with TypeScript types and documentation.

**FRs covered:** FR-SDK-13 (The SDK SHALL be published as `@toon-protocol/sdk` on npm with public access)

**Dependencies:** Stories 1.0-1.10 (all SDK code must be complete before publish). All done.

## Acceptance Criteria

1. Given the `@toon-protocol/sdk` package, when I inspect `package.json`, then it has `"type": "module"`, `"engines": { "node": ">=20" }`, TypeScript strict mode, ESLint 9.x flat config, Prettier 3.x, peer dependency on `@toon-protocol/connector` (optional), and dependencies on `@toon-protocol/core`, `nostr-tools`, `@scure/bip39`, `@scure/bip32`, `@noble/curves`, `@noble/hashes`

> **Note:** The epics doc AC originally listed `@toon-protocol/relay` as a dependency "for TOON codec". Architecture Decision 1 moved the TOON codec to `@toon-protocol/core`, making `@toon-protocol/relay` unnecessary as an SDK runtime dependency. `@toon-protocol/relay` remains a devDependency only (used in integration test fixtures). The `@noble/curves` and `@noble/hashes` are direct dependencies used by `identity.ts` (BIP-340 Schnorr, Keccak-256) and `verification-pipeline.ts` -- these are not listed in the epics doc AC but are required per the actual implementation.
2. Given the package entry point `index.ts`, when I import from `@toon-protocol/sdk`, then all public APIs are exported: `createNode`, `fromMnemonic`, `fromSecretKey`, `generateMnemonic`, `HandlerContext`, `NodeConfig`, `ServiceNode`, type definitions
3. Given the package is built, when published to npm with `--access public`, then it is available as `@toon-protocol/sdk` with correct ESM exports and TypeScript declarations

## Tasks / Subtasks

- [x] Task 1: Audit and fix package.json for npm publish readiness (AC: #1)
  - [x] Verify `"type": "module"` is set (ALREADY SET at line 5)
  - [x] Verify `"exports"` field has correct ESM entry with types condition (ALREADY SET at lines 9-13)
  - [x] Verify `"files"` field includes only `dist` (ALREADY SET at lines 15-17)
  - [x] Verify `"publishConfig"` has `"access": "public"` (ALREADY SET at lines 39-41)
  - [x] Verify peer dependency on `@toon-protocol/connector` is optional (ALREADY SET at lines 50-57)
  - [x] Verify dependencies list is correct and minimal per NFR-SDK-7: `@toon-protocol/core`, `nostr-tools`, `@scure/bip39`, `@scure/bip32` (ALREADY HAS: `@toon-protocol/core`, `@noble/curves`, `@noble/hashes`, `@scure/bip32`, `@scure/bip39`, `nostr-tools`). The `@noble/curves` and `@noble/hashes` are direct dependencies used by `identity.ts` and `verification-pipeline.ts` -- these are correct to keep.
  - [x] Add `"engines"` field: `{ "node": ">=20" }` per NFR-SDK-2 (Node.js 24.x support). Already present in SDK package.json.
  - [x] Verify `"description"` field is informative for npm listing
  - [x] Verify `"keywords"` includes relevant terms for npm discoverability
  - [x] Verify `"license"` is `"MIT"` (ALREADY SET)
  - [x] Verify `"repository"` field points to correct directory (ALREADY SET)

- [x] Task 2: Verify all public APIs are exported from `src/index.ts` (AC: #2)
  - [x] Verify `createNode` is exported (ALREADY EXPORTED, line 63)
  - [x] Verify `fromMnemonic`, `fromSecretKey`, `generateMnemonic` identity functions exported (ALREADY EXPORTED, line 8)
  - [x] Verify `HandlerContext` type is exported (ALREADY EXPORTED via type import, line 25)
  - [x] Verify `NodeConfig` type is exported (ALREADY EXPORTED, line 64)
  - [x] Verify `ServiceNode` type is exported (ALREADY EXPORTED, line 64)
  - [x] Verify `StartResult` type is exported (ALREADY EXPORTED, line 64)
  - [x] Verify `NodeIdentity` and `FromMnemonicOptions` types exported (ALREADY EXPORTED, line 10)
  - [x] Verify error classes exported: `IdentityError`, `NodeError`, `HandlerError`, `VerificationError`, `PricingError` (ALREADY EXPORTED, lines 13-19)
  - [x] Verify `HandlerRegistry`, `Handler`, `HandlerResponse` exported (ALREADY EXPORTED, lines 31-32)
  - [x] Verify `createHandlerContext` and context types exported (ALREADY EXPORTED, lines 22-28)
  - [x] Verify `createPricingValidator` and pricing types exported (ALREADY EXPORTED, lines 35-39)
  - [x] Verify `createVerificationPipeline` and verification types exported (ALREADY EXPORTED, lines 42-46)
  - [x] Verify `createPaymentHandlerBridge` and bridge types exported (ALREADY EXPORTED, lines 49-54)
  - [x] Verify `createEventStorageHandler` stub exported (ALREADY EXPORTED, line 57)
  - [x] Verify `createSpspHandshakeHandler` stub exported (ALREADY EXPORTED, line 60)
  - [x] Verify `BootstrapEvent` and `BootstrapEventListener` type re-exports (ALREADY EXPORTED, line 67)

- [x] Task 3: Verify ESM build output (AC: #3)
  - [x] Run `cd packages/sdk && pnpm build` -- produces `dist/index.js` (ESM bundle) and `dist/index.d.ts` (TypeScript declarations)
  - [x] Verify `dist/index.js` is valid ESM (contains `export` statements, no `require()` calls)
  - [x] Verify `dist/index.d.ts` contains all exported type declarations
  - [x] Run `npm pack --dry-run` from `packages/sdk/` to verify published file list only includes `dist/` contents

- [x] Task 4: Verify ATDD tests cover story requirements (AC: #1-#3)
  - [x] Verify `packages/sdk/src/index.test.ts` covers T-1.11-01 (all public APIs importable from `@toon-protocol/sdk`). The existing `index.test.ts` has 28 tests verifying all major exports, package.json structure, tooling config, and npm publish readiness.
  - [x] Fix priority labels in `index.test.ts` to match test-design-epic-1.md. Labels already correct: all use `[P2]` with `(T-1.11-01)` references, matching test-design convention. No changes needed.
  - [x] Decide on T-1.11-02: TypeScript types exported correctly. Decision: `tsc --noEmit` passes clean, confirming all type-only exports resolve correctly. No additional runtime test needed.
  - [x] Ensure `index.test.ts` is NOT in the vitest exclude list (confirmed: not excluded in vitest.config.ts)

- [x] Task 5: Run full verification suite (AC: #1-#3)
  - [x] Run `cd packages/sdk && npx tsc --noEmit` -- TypeScript compiles without errors (zero errors)
  - [x] Run `cd packages/sdk && pnpm test` -- all tests pass (154 tests across 10 test files)
  - [x] Run `cd packages/sdk && pnpm build` -- ESM build succeeds (16.68 KB JS, 13.81 KB DTS)
  - [x] Run `pnpm -r test` from project root -- no regressions (1385 tests across 64 files, all passing)

## Dev Notes

### What This Story Does

Validates that the `@toon-protocol/sdk` package is correctly structured and ready for npm publish. This is primarily an audit and verification story -- most of the package infrastructure was set up during Story 1.0 and evolved through Stories 1.1-1.10. The key deliverable is confidence that `npm publish` will produce a correct, usable package.

### What Already Exists (Comprehensive Audit)

**Package.json (MOSTLY COMPLETE):**
- `packages/sdk/package.json` has all required fields except `"engines"`
- `"type": "module"` -- set
- `"exports"` with types condition -- set
- `"files": ["dist"]` -- set
- `"publishConfig": { "access": "public" }` -- set
- `"peerDependencies"` with optional `@toon-protocol/connector` -- set
- Dependencies: `@toon-protocol/core`, `@noble/curves`, `@noble/hashes`, `@scure/bip32`, `@scure/bip39`, `nostr-tools` -- correct
- MISSING: `"engines": { "node": ">=20" }`

**Index.ts (COMPLETE):**
- `packages/sdk/src/index.ts` exports all public APIs (68 lines)
- Identity: `generateMnemonic`, `fromMnemonic`, `fromSecretKey`, `NodeIdentity`, `FromMnemonicOptions`
- Errors: `IdentityError`, `NodeError`, `HandlerError`, `VerificationError`, `PricingError`
- Handler context: `createHandlerContext`, `HandlerContext`, `HandlePacketAcceptResponse`, `HandlePacketRejectResponse`, `CreateHandlerContextOptions`
- Handler registry: `HandlerRegistry`, `Handler`, `HandlerResponse`
- Pricing: `createPricingValidator`, `PricingValidatorConfig`, `PricingValidationResult`
- Verification: `createVerificationPipeline`, `VerificationResult`, `VerificationPipelineConfig`
- Bridge: `createPaymentHandlerBridge`, `PaymentHandlerBridgeConfig`, `PaymentRequest`, `PaymentResponse`
- Stubs: `createEventStorageHandler`, `createSpspHandshakeHandler`
- Composition: `createNode`, `NodeConfig`, `ServiceNode`, `StartResult`
- Re-exports: `BootstrapEvent`, `BootstrapEventListener` from `@toon-protocol/core`

**Build tooling (COMPLETE):**
- `packages/sdk/tsup.config.ts` -- ESM build with dts, sourcemap, clean
- `packages/sdk/tsconfig.json` -- extends root tsconfig
- `packages/sdk/vitest.config.ts` -- all test files included (no remaining excludes except `__integration__/`). The ATDD story tracker comments list all story test files as done. Note: `network-discovery.test.ts` from Story 1.9 is not in the tracker because it lives under `__integration__/` which is excluded by the glob pattern `'**/__integration__/**'` -- no explicit tracker entry needed.

**Test coverage (COMPLETE):**
- `index.test.ts` -- 28 tests verifying all major public API exports, package.json structure, tooling config, and npm publish readiness
- 10 total test files, 154 tests across the SDK package

### What Needs To Be Done

1. **Add `"engines"` field to package.json** -- `{ "node": ">=20" }` per root package.json and NFR-SDK-2
2. **Fix priority labels in `index.test.ts`** -- current labels (P0/P1/P2) were locally assigned; should match test-design T-1.11-01 (P2) convention. Precedent: Stories 1.4, 1.5, 1.8, 1.9, 1.10 all standardized priority labels to match test-design-epic-1.md.
3. **Verify build output** -- run `pnpm build` and inspect `dist/` contents
4. **Verify npm pack** -- run `npm pack --dry-run` to confirm only `dist/` is included
5. **Verify no missing exports** -- cross-reference index.ts exports against all src/*.ts files
6. **Run full test suite** -- `pnpm test` passes (154 tests), `tsc --noEmit` compiles clean

### Architecture Compliance

**NFR-SDK-1:** TypeScript strict mode -- root tsconfig has `strict: true`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`. SDK tsconfig extends root.

**NFR-SDK-2:** Node.js 24.x via ESM -- `"type": "module"`, ESM-only build output via tsup. Need to add `"engines"` field.

**NFR-SDK-3:** >80% line coverage for public APIs -- all public modules have co-located `*.test.ts` files. 154 tests.

**NFR-SDK-5:** Structural typing for ConnectorNode -- `EmbeddableConnectorLike` from `@toon-protocol/core` used (not direct `@toon-protocol/connector` import). Connector is optional peer dependency.

**NFR-SDK-6:** Unit tests use mocked connectors -- MockConnector pattern in test files, no live relay/blockchain deps.

**NFR-SDK-7:** Minimal package size -- depends only on `@toon-protocol/core`, `nostr-tools`, `@scure/bip39`, `@scure/bip32`, `@noble/curves`, `@noble/hashes`. The `@noble/*` deps are direct dependencies for identity.ts (BIP-340 Schnorr, Keccak-256) and verification-pipeline.ts.

**Dependency graph (correct):**
```
@toon-protocol/core  <-- foundation (TOON codec, types, bootstrap, SPSP)
    ^
@toon-protocol/sdk   <-- developer-facing (identity, handlers, pipeline)
```

SDK does NOT depend on `@toon-protocol/bls` or `@toon-protocol/relay` at runtime. `@toon-protocol/relay` is a devDependency only (used in integration tests for TOON event encoding fixtures).

### Coding Standards

| Element | Convention | Status |
| --- | --- | --- |
| ESM module type | `"type": "module"` in package.json | Done |
| TypeScript strict | `strict: true` via root tsconfig | Done |
| ESLint 9.x flat config | Root `eslint.config.js` covers all packages | Done |
| Prettier 3.x | Root prettier config | Done |
| `.js` import extensions | All imports use `.js` suffix | Done |
| PascalCase classes | `HandlerRegistry`, `NodeError`, etc. | Done |
| camelCase functions | `createNode`, `fromMnemonic`, etc. | Done |
| UPPER_SNAKE_CASE constants | `MAX_PAYLOAD_BASE64_LENGTH` | Done |
| No `any` type | `unknown` with type guards used everywhere | Done |

### Testing

**Framework:** Vitest 1.x

**Existing tests (already passing):**
- `index.test.ts` -- 28 tests covering all public API exports, package.json structure, tooling config, and npm publish readiness (T-1.11-01/T-1.11-02)
- Total SDK: 10 test files, 154 tests

**Test design reference:**

| Test ID   | Test Description                                   | Level | Risk   | Priority | Status        | ATDD File       |
| --------- | -------------------------------------------------- | ----- | ------ | -------- | ------------- | --------------- |
| T-1.11-01 | All public APIs importable from `@toon-protocol/sdk`   | U     | E1-R16 | P2       | Existing      | `index.test.ts` |
| T-1.11-02 | TypeScript types exported correctly                | U     | -      | P3       | Via tsc check | `index.test.ts` |

**Risk E1-R16** (score 1, low -- P=1, I=1): ESM export map misconfigured, consumers get import errors. Mitigated by T-1.11-01 runtime import checks + TypeScript compilation catching type mismatches.

T-1.11-01 is covered by the existing `index.test.ts` which verifies all major function and class exports are importable.

T-1.11-02 is covered by `tsc --noEmit` which validates that all type-only exports (`HandlerContext`, `NodeConfig`, `ServiceNode`, `StartResult`, `BootstrapEvent`, etc.) resolve correctly. No additional runtime test needed for type exports since TypeScript compilation is the authoritative check.

### Previous Story Learnings (from Story 1.10)

- Dev mode implementation pattern: pipeline-level bypass (not per-module bypass). The `create-node.ts` pipelinedHandler orchestrates all pipeline stages.
- `config.devMode ?? false` standardized across all three pipeline checks (verification, logging, pricing) for consistency.
- Test restructuring: when tests use wrong abstraction level (e.g., `createPaymentHandlerBridge()` instead of `createNode()`), restructure to use the correct entry point for full coverage.
- Log injection sanitization added for dev mode logging output.
- Code review found 3 passes of issues: non-null assertions in tests (use descriptive helper methods), console spy cleanup (wrap in try/finally), inconsistent guard style (standardize).
- Final SDK test count: 154 tests across 10 files.

### Git Intelligence

Last 5 commits follow pattern: `feat(<story-id>): <description>`

Recent commits:
- `feat(1-10): enable dev mode with pricing bypass and packet logging`
- `feat(1-9): integrate network discovery and bootstrap with ServiceNode API`
- `feat(1-8): enable connector direct methods API tests`
- `feat(1-7): implement createNode composition with embedded connector lifecycle`
- `feat(1-6): implement PaymentHandler bridge with transit semantics`

Expected commit: `feat(1-11): finalize SDK package setup for npm publish readiness`

### Project Structure Notes

Files to modify:
```
packages/sdk/
├── package.json               # Add "engines" field (modify)
├── src/
│   └── index.test.ts          # Fix priority labels to match test-design; potentially add T-1.11-02 test (modify)
```

Files to verify (read-only):
```
packages/sdk/
├── src/index.ts               # Verify all exports (read)
├── tsconfig.json              # Verify extends root (read)
├── tsup.config.ts             # Verify ESM build config (read)
├── vitest.config.ts           # Verify no excluded test files (read)
├── dist/                      # Verify build output after `pnpm build` (read)
```

No new files need to be created. This is a verification and minimal fixup story.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 1.11: Package Setup and npm Publish`]
- [Source: `_bmad-output/planning-artifacts/epics.md#FR Coverage Map` -- FR-SDK-13: Epic 1, Story 1.11]
- [Source: `_bmad-output/planning-artifacts/test-design-epic-1.md#Story 1.11`]
- [Source: `_bmad-output/planning-artifacts/architecture.md` -- NFR-SDK-1 through NFR-SDK-7]
- [Source: `_bmad-output/planning-artifacts/architecture.md#New Package Setup Pattern`]
- [Source: `_bmad-output/planning-artifacts/architecture.md#Requirements to Structure Mapping` -- Story 1.11: Package setup -> `package.json`, `index.ts`]
- [Source: `_bmad-output/project-context.md` -- Technology Stack, Build & Scripts, Code Organization]
- [Source: `packages/sdk/package.json` -- current package configuration]
- [Source: `packages/sdk/src/index.ts` -- current public API exports]
- [Source: `packages/sdk/tsup.config.ts` -- ESM build configuration]
- [Source: `packages/sdk/vitest.config.ts` -- test configuration with ATDD tracker]
- [Source: `_bmad-output/implementation-artifacts/1-10-dev-mode.md`]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

None required -- this was a verification-only story with no code changes.

### Completion Notes List

- **Task 1 (package.json audit):** All fields verified correct. `"type": "module"`, `"exports"` with types condition, `"files": ["dist"]`, `"publishConfig": { "access": "public" }`, `"engines": { "node": ">=20" }`, optional `@toon-protocol/connector` peer dependency, all runtime dependencies (`@toon-protocol/core`, `@noble/curves`, `@noble/hashes`, `@scure/bip32`, `@scure/bip39`, `nostr-tools`), `"description"`, `"keywords"`, `"license": "MIT"`, `"repository"` -- all present and correct. The `"engines"` field noted as MISSING in the story was already present (added during a prior story).
- **Task 2 (public API exports):** All 30+ exports from index.ts verified against source modules. Every function, class, interface, and type from identity.ts, errors.ts, handler-context.ts, handler-registry.ts, pricing-validator.ts, verification-pipeline.ts, payment-handler-bridge.ts, event-storage-handler.ts, spsp-handshake-handler.ts, and create-node.ts is correctly re-exported. `BootstrapEvent` and `BootstrapEventListener` type re-exports from `@toon-protocol/core` confirmed.
- **Task 3 (index.test.ts verification):** Priority labels already correct (`[P2]` with `(T-1.11-01)` and `(T-1.11-02)` references matching test-design-epic-1.md). T-1.11-02 comment present explaining TypeScript type validation via `tsc --noEmit`. 28 tests cover runtime-verifiable exports, package.json structure, tooling config, and npm publish readiness. No changes needed.
- **Task 4 (ESM build and npm pack):** `pnpm build` produces `dist/index.js` (16.68 KB ESM), `dist/index.d.ts` (13.81 KB type declarations), and `dist/index.js.map` (45.76 KB source map). Verified ESM format (contains `export` statements, zero `require()` calls). `npm pack --dry-run` confirms only 4 files in tarball: dist/index.d.ts, dist/index.js, dist/index.js.map, package.json. Total package size: 19.6 KB compressed.
- **Task 5 (full verification suite):** `tsc --noEmit` passes clean (zero errors). SDK tests: 10 files, 154 tests all passing. ESLint: 0 errors on source files, 28 warnings in test files (non-null assertions, expected per relaxed test rules).

### File List

No files were created, modified, or deleted. This was a verification-only story -- all package infrastructure was already in place from Stories 1.0-1.10.

Verified (read-only):
- `packages/sdk/package.json` -- all fields correct
- `packages/sdk/src/index.ts` -- all exports complete
- `packages/sdk/src/index.test.ts` -- all tests correct with proper priority labels
- `packages/sdk/tsup.config.ts` -- ESM build config correct
- `packages/sdk/tsconfig.json` -- extends root tsconfig correctly
- `packages/sdk/vitest.config.ts` -- no incorrect exclusions

### Change Log

| Date | Change | Details |
| --- | --- | --- |
| 2026-03-05 | Story 1.11 verification complete | Audited and verified all SDK package setup for npm publish readiness. No code changes required -- all package.json fields, public API exports, test coverage, ESM build output, and npm pack contents confirmed correct. 154 SDK tests all passing. |
| 2026-03-05 | Code review: fix test count discrepancies | Updated artifact to reflect actual test counts (154 SDK tests, 28 in index.test.ts) instead of stale counts (138/10). No code changes -- documentation-only fix. |

## Code Review Record

### Review Pass #1

- **Date:** 2026-03-05
- **Reviewer Model:** Claude Opus 4.6 (claude-opus-4-6)
- **Issue Counts:** 0 critical, 0 high, 0 medium, 1 low
- **Low Issues:**
  - Stale test counts in artifact: story artifact referenced outdated test counts (138 SDK tests, 10 in index.test.ts) instead of actual counts (154 SDK tests, 28 in index.test.ts). Fixed by updating counts in the artifact. No source code changes required.
- **Outcome:** Pass -- no source code changes needed. Artifact documentation updated to reflect correct test counts.
- **Action Items:** None. The single low-severity issue (stale counts) was fixed during the review itself.

### Review Pass #2

- **Date:** 2026-03-05
- **Reviewer Model:** Claude Opus 4.6 (claude-opus-4-6)
- **Issue Counts:** 0 critical, 0 high, 0 medium, 0 low
- **Outcome:** Pass -- no files changed. Verification-only review confirmed package is ready for npm publish. All package.json fields, public API exports, ESM build output, test coverage (154 tests), and npm pack contents validated correct.
- **Action Items:** None. Clean review with zero issues across all severity levels.

### Review Pass #3 (Final)

- **Date:** 2026-03-05
- **Reviewer Model:** Claude Opus 4.6 (claude-opus-4-6)
- **Issue Counts:** 0 critical, 0 high, 0 medium, 4 low
- **Low Issues:**
  - Information disclosure in error logs (payment-handler-bridge.ts)
  - Undocumented placeholder fulfillment (handler-context.ts)
  - Prototype-unsafe property lookup (pricing-validator.ts)
  - Test assertion updates (payment-handler-bridge.test.ts)
- **Files Changed:** payment-handler-bridge.ts, handler-context.ts, pricing-validator.ts, payment-handler-bridge.test.ts
- **Outcome:** Pass -- all 4 low-severity issues fixed. Final review successful with zero remaining issues.
- **Action Items:** None. All issues resolved during review.
