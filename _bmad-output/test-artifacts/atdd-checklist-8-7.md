---
stepsCompleted:
  - 'step-01-preflight-and-context'
  - 'step-02-generation-mode'
  - 'step-03-test-strategy'
  - 'step-04c-aggregate'
  - 'step-05-validate-and-complete'
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-03-24'
workflowType: 'testarch-atdd'
inputDocuments:
  - '_bmad-output/implementation-artifacts/8-7-deploy-forge-ui-to-arweave.md'
  - 'packages/rig/vite.config.ts'
  - 'packages/rig/vitest.config.ts'
  - 'packages/rig/src/web/index.html'
  - 'packages/rig/src/web/router.ts'
  - 'packages/rig/src/web/arweave-client.ts'
  - 'packages/rig/src/web/csp.test.ts'
  - 'packages/rig/src/web/router.test.ts'
  - 'packages/rig/playwright.config.ts'
  - '_bmad/tea/testarch/knowledge/test-quality.md'
  - '_bmad/tea/testarch/knowledge/data-factories.md'
---

# ATDD Checklist - Epic 8, Story 8.7: Deploy Forge-UI to Arweave

**Date:** 2026-03-24
**Author:** Jonathan
**Primary Test Level:** Unit (Vitest)

---

## Story Summary

Story 8.7 is the capstone story for Epic 8. It deploys the Forge-UI static web app permanently to Arweave for censorship-resistant public access. The story covers three areas: (1) configuring Vite for Arweave-compatible build output (relative paths, CSP preservation), (2) creating a Node.js deploy script that uploads files via Turbo SDK and generates an Arweave path manifest, and (3) verifying the deployment serves the SPA correctly.

**As a** TOON developer
**I want** the Forge-UI permanently deployed to Arweave
**So that** humans can browse repos via a censorship-resistant web interface

---

## Acceptance Criteria

1. **AC #1 (Production build):** Vite produces optimized dist/ with index.html, hashed JS/CSS bundles
2. **AC #2 (CSP correctness):** Built index.html CSP includes all Arweave gateways and WebSocket origins
3. **AC #3 (Relative asset paths):** All asset references use relative paths (`./assets/...`) not absolute
4. **AC #4 (Deploy script):** `scripts/deploy-forge-ui.mjs` builds, reads dist/, creates manifest, uploads
5. **AC #5 (Path manifest):** Valid Arweave manifest with `arweave/paths` v0.2.0, index, fallback, paths
6. **AC #6 (Content-Type tagging):** Each file tagged with correct MIME type
7. **AC #7 (Free tier dev mode):** `--dev` flag uses unauthenticated Turbo, warns if files > 100KB
8. **AC #8 (Authenticated upload):** `--wallet` flag uses authenticated Turbo with cost estimates
9. **AC #9 (Gateway accessibility):** Deployed SPA accessible via ar-io.dev gateway (MANUAL)
10. **AC #10 (SPA routing):** Deep routes resolve via manifest fallback (MANUAL)
11. **AC #11 (Relay configuration):** Relay URL configurable via hash fragment (MANUAL)
12. **AC #12 (Deployment docs):** Deploy script prints gateway URLs and relay instructions
13. **AC #13 (Dogfooding):** TOON codebase browsable via deployed Forge-UI (MANUAL)

---

## Failing Tests Created (RED Phase)

### Unit Tests (32 tests)

**File:** `packages/rig/src/web/build-verification.test.ts` (130 lines)

- **Test:** [P0] dist/index.html exists after build
  - **Status:** RED - skipped (dist/ not built with `base: './'` yet)
  - **Verifies:** AC #1 - production build output exists

- **Test:** [P0] dist/ contains hashed JS bundle(s)
  - **Status:** RED - skipped (build not configured yet)
  - **Verifies:** AC #1 - JS bundles with content hashes

- **Test:** [P0] dist/ contains hashed CSS bundle(s)
  - **Status:** RED - skipped (build not configured yet)
  - **Verifies:** AC #1 - CSS bundles with content hashes

- **Test:** [P1] build output is self-contained (no server-side imports)
  - **Status:** RED - skipped (build not configured yet)
  - **Verifies:** AC #1 - no Node.js imports in browser bundles

- **Test:** [P0] index.html uses relative paths for JS assets
  - **Status:** RED - skipped (`base: './'` not added to vite.config.ts)
  - **Verifies:** AC #3 - relative script src paths

- **Test:** [P0] index.html uses relative paths for CSS assets
  - **Status:** RED - skipped (`base: './'` not added to vite.config.ts)
  - **Verifies:** AC #3 - relative link href paths

- **Test:** [P1] no asset references use absolute root paths
  - **Status:** RED - skipped (`base: './'` not added to vite.config.ts)
  - **Verifies:** AC #3 - comprehensive path check

- **Test:** [P1] built index.html preserves CSP with Arweave gateways
  - **Status:** RED - skipped (build not run with new config)
  - **Verifies:** AC #2 - CSP connect-src preserved in build

- **Test:** [P1] built index.html CSP script-src is self only
  - **Status:** RED - skipped (build not run with new config)
  - **Verifies:** AC #2 - no unsafe inline scripts

**File:** `packages/rig/src/web/deploy-manifest.test.ts` (210 lines)

- **Test:** [P0] generates valid manifest with correct structure
  - **Status:** RED - skipped (generateManifest not implemented)
  - **Verifies:** AC #5 - manifest format `arweave/paths` v0.2.0

- **Test:** [P0] manifest includes fallback pointing to index.html tx ID
  - **Status:** RED - skipped (generateManifest not implemented)
  - **Verifies:** AC #5, AC #10 - SPA fallback for routing

- **Test:** [P0] manifest paths map each file to its tx ID
  - **Status:** RED - skipped (generateManifest not implemented)
  - **Verifies:** AC #5 - path-to-txId mapping

- **Test:** [P1] manifest handles nested directory paths correctly
  - **Status:** RED - skipped (generateManifest not implemented)
  - **Verifies:** AC #5 - nested assets/js/, assets/css/ paths

- **Test:** [P2] manifest with empty entries produces minimal valid manifest
  - **Status:** RED - skipped (generateManifest not implemented)
  - **Verifies:** AC #5 - edge case

- **Test:** [P0] detects text/html for .html files
  - **Status:** RED - skipped (getMimeType not implemented)
  - **Verifies:** AC #6 - MIME type detection

- **Test:** [P0] detects application/javascript for .js files
  - **Status:** RED - skipped
  - **Verifies:** AC #6

- **Test:** [P0] detects text/css for .css files
  - **Status:** RED - skipped
  - **Verifies:** AC #6

- **Test:** [P1] detects application/json for .json files
  - **Status:** RED - skipped
  - **Verifies:** AC #6

- **Test:** [P1] detects image/svg+xml for .svg files
  - **Status:** RED - skipped
  - **Verifies:** AC #6

- **Test:** [P1] detects image/png for .png files
  - **Status:** RED - skipped
  - **Verifies:** AC #6

- **Test:** [P1] detects image/x-icon for .ico files
  - **Status:** RED - skipped
  - **Verifies:** AC #6

- **Test:** [P1] detects font/woff2 for .woff2 files
  - **Status:** RED - skipped
  - **Verifies:** AC #6

- **Test:** [P1] detects font/woff for .woff files
  - **Status:** RED - skipped
  - **Verifies:** AC #6

- **Test:** [P1] detects application/json for .map files
  - **Status:** RED - skipped
  - **Verifies:** AC #6

- **Test:** [P2] returns application/octet-stream for unknown extensions
  - **Status:** RED - skipped
  - **Verifies:** AC #6

- **Test:** [P2] handles files with no extension
  - **Status:** RED - skipped
  - **Verifies:** AC #6

- **Test:** [P0] accepts files under 100KB in dev mode
  - **Status:** RED - skipped (validateDevModeFileSizes not implemented)
  - **Verifies:** AC #7 - free tier validation pass

- **Test:** [P0] rejects files over 100KB in dev mode
  - **Status:** RED - skipped
  - **Verifies:** AC #7 - free tier validation fail

- **Test:** [P1] threshold is exactly 100KB (102400 bytes)
  - **Status:** RED - skipped
  - **Verifies:** AC #7 - boundary case

- **Test:** [P1] generates gateway URLs from manifest tx ID
  - **Status:** RED - skipped (generateDeploymentSummary not implemented)
  - **Verifies:** AC #12 - documentation output

- **Test:** [P1] includes relay configuration instructions
  - **Status:** RED - skipped
  - **Verifies:** AC #12 - relay hash fragment docs

- **Test:** [P2] includes dogfooding instructions
  - **Status:** RED - skipped
  - **Verifies:** AC #12, AC #13 - seed script reference

### E2E Tests

No E2E tests for this story. The story explicitly states: "No E2E deployment tests -- deploying to Arweave is a manual/CI operation." Manual verification (AC #9, #10, #11, #13) happens post-deployment in a browser.

### API Tests

No API tests. This story creates no API endpoints.

---

## Data Factories Created

N/A -- This story tests build output and manifest generation logic. No dynamic test data or entity factories are needed. Tests use static fixture data (file paths, tx IDs, file sizes).

---

## Fixtures Created

N/A -- Tests use inline test data appropriate for unit-level verification of pure functions (manifest generation, MIME detection, file size validation). No Playwright fixtures, database seeding, or cleanup needed.

---

## Mock Requirements

N/A -- The unit tests verify pure functions (manifest generation, MIME type detection, file size validation, summary generation). The actual Turbo SDK upload is NOT tested in unit tests (that would be an integration test against Arweave). The `build-verification.test.ts` tests read the filesystem (dist/ directory) but do not mock anything.

---

## Required data-testid Attributes

N/A -- No UI components are created or modified in this story. The story is about build configuration and deployment scripting.

---

## Implementation Checklist

### Test: [P0] Build output and relative paths (8.7-UNIT-001, 8.7-UNIT-003)

**File:** `packages/rig/src/web/build-verification.test.ts`

**Tasks to make these tests pass:**

- [ ] Add `base: './'` to `packages/rig/vite.config.ts`
- [ ] Run `pnpm build` in `packages/rig` to produce dist/
- [ ] Verify dist/index.html has relative `./assets/` paths (not `/assets/`)
- [ ] Remove `it.skip()` from build verification tests
- [ ] Run test: `cd packages/rig && npx vitest run src/web/build-verification.test.ts`
- [ ] Tests pass (green phase)

**Estimated Effort:** 0.5 hours

---

### Test: [P1] CSP preserved in build (8.7-UNIT-002)

**File:** `packages/rig/src/web/build-verification.test.ts`

**Tasks to make these tests pass:**

- [ ] Verify CSP meta tag is preserved through Vite build (it should be -- CSP is in source HTML)
- [ ] Remove `it.skip()` from CSP tests
- [ ] Run test: `cd packages/rig && npx vitest run src/web/build-verification.test.ts`
- [ ] Tests pass (green phase)

**Estimated Effort:** 0.25 hours

---

### Test: [P0] Manifest generation (8.7-UNIT-005)

**File:** `packages/rig/src/web/deploy-manifest.test.ts`

**Tasks to make these tests pass:**

- [ ] Create `scripts/deploy-forge-ui.mjs` with `generateManifest()` function
- [ ] Export `generateManifest` as a testable function (or extract to a shared module)
- [ ] Implement: accept `ManifestEntry[]`, return Arweave manifest JSON with index, fallback, paths
- [ ] Update test imports to point to the real implementation
- [ ] Remove placeholder function stubs from test file
- [ ] Remove `it.skip()` from manifest tests
- [ ] Run test: `cd packages/rig && npx vitest run src/web/deploy-manifest.test.ts`
- [ ] Tests pass (green phase)

**Estimated Effort:** 1 hour

---

### Test: [P0] MIME type detection (8.7-UNIT-006)

**File:** `packages/rig/src/web/deploy-manifest.test.ts`

**Tasks to make these tests pass:**

- [ ] Implement `getMimeType(filename)` in the deploy script
- [ ] Map extensions: .html, .js, .css, .json, .svg, .png, .ico, .woff, .woff2, .map
- [ ] Default to `application/octet-stream` for unknown extensions
- [ ] Update test imports
- [ ] Remove `it.skip()` from MIME type tests
- [ ] Run test: `cd packages/rig && npx vitest run src/web/deploy-manifest.test.ts`
- [ ] Tests pass (green phase)

**Estimated Effort:** 0.5 hours

---

### Test: [P0] Dev mode file size validation (8.7-UNIT-007)

**File:** `packages/rig/src/web/deploy-manifest.test.ts`

**Tasks to make these tests pass:**

- [ ] Implement `validateDevModeFileSizes(files)` in the deploy script
- [ ] Threshold: 102,400 bytes (100KB)
- [ ] Return `{ valid, oversizedFiles }` -- list files exceeding the limit
- [ ] Update test imports
- [ ] Remove `it.skip()` from file size validation tests
- [ ] Run test: `cd packages/rig && npx vitest run src/web/deploy-manifest.test.ts`
- [ ] Tests pass (green phase)

**Estimated Effort:** 0.25 hours

---

### Test: [P1] Deployment summary output (8.7-UNIT-009)

**File:** `packages/rig/src/web/deploy-manifest.test.ts`

**Tasks to make these tests pass:**

- [ ] Implement `generateDeploymentSummary(manifestTxId)` in the deploy script
- [ ] Include gateway URLs for ar-io.dev, arweave.net, permagate.io
- [ ] Include relay configuration instructions with `#relay=` hash fragment
- [ ] Include seed-forge-data reference for dogfooding
- [ ] Update test imports
- [ ] Remove `it.skip()` from summary tests
- [ ] Run test: `cd packages/rig && npx vitest run src/web/deploy-manifest.test.ts`
- [ ] Tests pass (green phase)

**Estimated Effort:** 0.5 hours

---

### Non-tested implementation tasks (AC #4, #8)

These are integration-level tasks not covered by unit tests:

- [ ] Complete `scripts/deploy-forge-ui.mjs` CLI with `--dev`, `--wallet`, `--dry-run`, `--confirm` flags
- [ ] Implement Turbo SDK upload loop (upload each file, collect tx IDs)
- [ ] Implement `TurboFactory.unauthenticated()` for `--dev` mode
- [ ] Implement `TurboFactory.authenticated({ privateKey })` for `--wallet` mode
- [ ] Print cost estimate before authenticated upload
- [ ] Upload manifest with `Content-Type: application/x.arweave-manifest+json`
- [ ] Add `VITE_DEFAULT_RELAY` env var support in `packages/rig/src/web/router.ts`

**Estimated Effort:** 2 hours

---

### Manual verification (AC #9, #10, #11, #13)

- [ ] Deploy to Arweave (dev mode or prod mode)
- [ ] Verify `https://ar-io.dev/<tx-id>/` loads index.html
- [ ] Verify `https://ar-io.dev/<tx-id>/assets/<bundle>.js` loads JS
- [ ] Verify deep route refresh works (SPA fallback)
- [ ] Verify `#relay=wss://relay.example` configures relay
- [ ] Seed TOON codebase data and browse via deployed Forge-UI

**Estimated Effort:** 1 hour

---

## Running Tests

```bash
# Run all failing tests for this story
cd packages/rig && npx vitest run src/web/build-verification.test.ts src/web/deploy-manifest.test.ts

# Run specific test file
cd packages/rig && npx vitest run src/web/build-verification.test.ts
cd packages/rig && npx vitest run src/web/deploy-manifest.test.ts

# Run tests in watch mode
cd packages/rig && npx vitest src/web/build-verification.test.ts src/web/deploy-manifest.test.ts

# Run with verbose output
cd packages/rig && npx vitest run src/web/build-verification.test.ts src/web/deploy-manifest.test.ts --reporter=verbose

# Run all rig package tests (includes existing + new)
cd packages/rig && pnpm test
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete)

**TEA Agent Responsibilities:**

- All 32 tests written and skipped (RED phase)
- No fixtures or factories needed (pure function unit tests)
- No mock requirements (filesystem reads and pure logic)
- No data-testid requirements (no UI changes)
- Implementation checklist created with 6 test groups + 2 non-tested task groups

**Verification:**

- All 32 tests skip as expected (verified via `npx vitest run`)
- Failure is due to missing implementation (skipped, not erroring)
- Test structure follows existing patterns in `csp.test.ts` and `router.test.ts`

---

### GREEN Phase (DEV Team - Next Steps)

**DEV Agent Responsibilities:**

1. **Pick one failing test group** from implementation checklist (start with build config)
2. **Read the tests** to understand expected behavior
3. **Implement minimal code** to make that test group pass
4. **Run the tests** to verify green
5. **Check off tasks** in implementation checklist
6. **Move to next group** and repeat

**Recommended order:**

1. Build config (`base: './'` in vite.config.ts) -- unblocks build-verification tests
2. MIME type detection -- standalone pure function
3. Manifest generation -- depends on MIME types
4. File size validation -- standalone pure function
5. Deployment summary -- depends on manifest generation
6. Full deploy script assembly -- integrates all pieces

---

### REFACTOR Phase (DEV Team - After All Tests Pass)

1. Verify all 32 tests pass
2. Review deploy script for code quality
3. Extract shared constants (GATEWAYS, MIME_TYPES) if duplicated
4. Ensure deploy script `--help` output is clear
5. Run full `pnpm test` to verify no regressions

---

## Next Steps

1. **Share this checklist and failing tests** with the dev workflow
2. **Run failing tests** to confirm RED phase: `cd packages/rig && npx vitest run src/web/build-verification.test.ts src/web/deploy-manifest.test.ts`
3. **Begin implementation** using implementation checklist as guide
4. **Work one test group at a time** (red -> green for each)
5. **When all tests pass**, refactor code for quality
6. **Manual deployment verification** after all unit tests green
7. **Commit**: `feat(8-7): Deploy Forge-UI to Arweave`

---

## Knowledge Base References Applied

- **test-quality.md** - Deterministic test design, explicit assertions, no hard waits
- **data-factories.md** - Reviewed; not applicable (no entity data needed for this story)

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `cd packages/rig && npx vitest run src/web/build-verification.test.ts src/web/deploy-manifest.test.ts --reporter=verbose`

**Results:**

```
 RUN  v1.6.1 /Users/jonathangreen/Documents/crosstown/packages/rig

 Test Files  2 skipped (2)
      Tests  32 skipped (32)
   Start at  10:01:08
   Duration  780ms
```

**Summary:**

- Total tests: 32
- Passing: 0 (expected)
- Skipped: 32 (expected -- RED phase uses it.skip())
- Status: RED phase verified

---

## Notes

- Story 8.7 is deployment-focused -- no UI components created, no browser-level E2E tests needed
- The deploy script (`scripts/deploy-forge-ui.mjs`) is a CLI tool, not part of the web app bundle
- Testable functions (generateManifest, getMimeType, validateDevModeFileSizes, generateDeploymentSummary) should be extracted from the deploy script into a module importable by Vitest
- The `build-verification.test.ts` tests require a pre-built dist/ directory -- they should be run after `pnpm build`, not as part of the default test suite (or conditionally skip if dist/ missing)
- AC #8 (authenticated upload with cost estimate) is not unit-tested because it requires Turbo SDK integration; it is verified manually
- Existing CSP tests in `csp.test.ts` (Story 8.6) test the source HTML; the new tests in `build-verification.test.ts` verify CSP survives the Vite build process

---

**Generated by BMad TEA Agent** - 2026-03-24
