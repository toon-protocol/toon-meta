# Story 8.7: Deploy Forge-UI to Arweave

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **TOON developer**,
I want the Forge-UI permanently deployed to Arweave,
So that humans can browse repos via a censorship-resistant web interface.

**FRs covered:** FR-NIP34-3 (Forge-UI permanent deployment)

**Dependencies:** Stories 8.0-8.6 (Arweave DVM, all Forge-UI views, E2E validation) -- ALL COMPLETE.

**Downstream dependencies:** None -- this is the capstone story for Epic 8.

**Decision sources:**
- Party Mode 2026-03-22: Fully Decentralized Git Architecture (Arweave DVM + Forge-UI)
- `_bmad-output/project-context.md` section "Fully Decentralized Git Architecture"
- `_bmad-output/planning-artifacts/epics.md` Story 8.6 section (numbered 8.6 in epics.md; renumbered to 8.7 in implementation artifacts after Story 8.6 E2E Validation was inserted)

**Rationale:** This is the capstone story for Epic 8. The Forge-UI static web app is built, tested (unit + E2E), and bug-fixed. This story deploys it permanently to Arweave so it is censorship-resistant and publicly accessible. The TOON Protocol's own codebase is then browsable via this Forge-UI (dogfooding). Note: `epics.md` says "upload via kind:5094" but the correct approach is direct Turbo SDK upload (the DVM is for agent-to-agent uploads over ILP, not human-operated CLI deployments).

## Acceptance Criteria

### Part A: Build Pipeline

1. **Production build:** Given the Forge-UI source in `packages/rig/src/web/`, when `cd packages/rig && pnpm build` is run, then Vite produces a production-optimized `dist/` directory containing `index.html`, hashed JS/CSS bundles, and all static assets. The build output is self-contained (no external dependencies, no server-side code). [Test: 8.7-UNIT-001]

2. **CSP correctness:** Given the production build, when `index.html` is inspected, then the Content-Security-Policy `connect-src` includes all required Arweave gateways (`https://ar-io.dev`, `https://*.ar-io.dev`, `https://arweave.net`, `https://*.arweave.net`, `https://permagate.io`, `https://*.permagate.io`) and WebSocket origins (`ws:`, `wss:`), and `script-src` references only `'self'` (no inline scripts after Vite bundling). [Test: 8.7-UNIT-002]

3. **Relative asset paths:** Given the production build, when deployed to any base URL path (e.g., `arweave.net/<tx-id>/` or an ArNS name), then all asset references in `index.html` use relative paths (not absolute `/` paths). Vite config `base: './'` ensures this. [Test: 8.7-UNIT-003]

### Part B: Arweave Deployment Script

4. **Deploy script:** A `scripts/deploy-forge-ui.mjs` Node.js script that: (a) runs `pnpm build` in `packages/rig`, (b) reads all files from `packages/rig/dist/`, (c) creates an Arweave path manifest mapping each file to its content type, (d) uploads all files + manifest to Arweave via `@ardrive/turbo-sdk`, and (e) prints the manifest transaction ID (the single URL that serves the entire SPA). [Test: 8.7-UNIT-004]

5. **Arweave path manifest:** The deploy script creates a valid Arweave path manifest (JSON with `"manifest": "arweave/paths"`, `"version": "0.2.0"`, `"index": { "path": "index.html" }`, and `"paths"` mapping each file to its Arweave tx ID and content type). This manifest enables `arweave.net/<manifest-tx-id>/` to serve `index.html` and `arweave.net/<manifest-tx-id>/assets/main-abc123.js` to serve the JS bundle. [Test: 8.7-UNIT-005]

6. **Content-Type tagging:** Each uploaded file includes an Arweave `Content-Type` tag matching its MIME type (e.g., `text/html` for `.html`, `application/javascript` for `.js`, `text/css` for `.css`). The manifest transaction itself has `Content-Type: application/x.arweave-manifest+json`. [Test: 8.7-UNIT-006]

7. **Free tier support (dev):** Given no Arweave wallet configured, when the deploy script runs with `--dev` flag, then it uses `TurboFactory.unauthenticated()` (free tier, <=100KB per file). This enables local testing of the deployment pipeline without AR tokens. If the build output exceeds 100KB per file, the script warns and exits. [Test: 8.7-UNIT-007]

8. **Authenticated upload (prod):** Given an Arweave JWK wallet file, when the deploy script runs with `--wallet <path-to-jwk>`, then it uses `TurboFactory.authenticated({ privateKey })` for paid uploads with no size limit. The script prints cost estimates before uploading. [Test: 8.7-UNIT-008]

### Part C: Deployment Verification

9. **Gateway accessibility:** Given a successful deployment, when `https://ar-io.dev/<manifest-tx-id>/` is fetched, then `index.html` is returned. When `https://ar-io.dev/<manifest-tx-id>/assets/<bundle>.js` is fetched, then the JS bundle is returned. AR.IO gateway serves Turbo/Irys uploads immediately (no 10-minute delay like `arweave.net`). [Test: 8.7-MANUAL-001]

10. **SPA routing:** Given the deployed Forge-UI, when a user navigates to a deep route (e.g., `/<npub>/<repo>/tree/refs%2Fheads%2Fmain/src`) and refreshes the page, then the SPA handles routing client-side. The Arweave manifest's `"fallback"` field (or `index.html` fallback) ensures all paths resolve to `index.html`. [Test: 8.7-MANUAL-002]

11. **Relay configuration:** Given the deployed Forge-UI, when loaded in a browser, then the relay URL is configurable via URL hash fragment `#relay=wss://your-relay.example` (primary) or `?relay=` query parameter (legacy, auto-migrated to hash). The hash fragment is preferred because it works across Arweave gateways, is shareable/bookmarkable, and is not sent to the server. A default relay URL is baked into the build (configurable via Vite env var `VITE_DEFAULT_RELAY`). [Test: 8.7-MANUAL-003]

### Part D: Documentation and Dogfooding

12. **Deployment documentation:** The deploy script prints clear instructions including: manifest tx ID, gateway URLs (ar-io.dev, arweave.net, permagate.io), and how to configure the relay parameter via hash fragment. [Test: 8.7-UNIT-009]

13. **Dogfooding:** Given the TOON Protocol's own codebase has been seeded to a relay + Arweave (via `scripts/seed-forge-data.mjs`), when the deployed Forge-UI is loaded with the relay parameter pointing to that relay (e.g., `https://ar-io.dev/<tx-id>/#relay=wss://relay.example`), then the TOON Protocol repository is browsable (repo list, file tree, blob view, commits, blame, issues, PRs). [Test: 8.7-MANUAL-004]

## Tasks / Subtasks

### Part A: Vite Build Configuration

- [x] Task 1: Configure Vite for Arweave-compatible output (AC: #1, #2, #3)
  - [x] 1.1 In `packages/rig/vite.config.ts`, add `base: './'` to ensure all asset paths are relative (not absolute `/assets/...`). This is critical for Arweave deployment where the base URL is `arweave.net/<tx-id>/`.
  - [x] 1.2 Verify `pnpm build` produces `dist/index.html` with relative `href` and `src` attributes (e.g., `./assets/main-abc123.js`, not `/assets/main-abc123.js`).
  - [x] 1.3 Verify CSP meta tag in built `dist/index.html` still contains all required Arweave gateway origins (the CSP is in the source HTML, not injected by Vite).
  - [x] 1.4 Add `VITE_DEFAULT_RELAY` env var support. In `packages/rig/src/web/router.ts`, replace the hardcoded `DEFAULT_RELAY_URL = 'wss://localhost:7100'` with `import.meta.env.VITE_DEFAULT_RELAY || 'wss://localhost:7100'`. This allows the default relay to be configured at build time for production deployments. The relay resolution priority remains: (1) `#relay=` hash fragment, (2) `?relay=` query param (legacy, auto-migrated), (3) `VITE_DEFAULT_RELAY` build-time default.

### Part B: Deploy Script

- [x] Task 2: Create `scripts/deploy-forge-ui.mjs` (AC: #4, #5, #6, #7, #8)
  - [x] 2.1 Create `scripts/deploy-forge-ui.mjs`. Parse CLI args: `--dev` (free tier), `--wallet <path>` (authenticated), `--dry-run` (build only, no upload).
  - [x] 2.2 Run `pnpm build` in `packages/rig` using `execFileSync('pnpm', ['build'], { cwd: rigDir, stdio: 'inherit' })`. Use `execFileSync` (not `execSync`) to avoid shell injection (lesson from Story 8.6 code review).
  - [x] 2.3 Read all files from `packages/rig/dist/` recursively. For each file, determine MIME type from extension: `.html` -> `text/html`, `.js` -> `application/javascript`, `.css` -> `text/css`, `.svg` -> `image/svg+xml`, `.json` -> `application/json`, `.ico` -> `image/x-icon`, `.png` -> `image/png`, default -> `application/octet-stream`.
  - [x] 2.4 Upload each file to Arweave with `Content-Type` tag set to the determined MIME type. Collect `{ path: relativeFilePath, txId: uploadResult.id }` for each.
  - [x] 2.5 Create the Arweave path manifest JSON: `{ "manifest": "arweave/paths", "version": "0.2.0", "index": { "path": "index.html" }, "fallback": { "id": "<index-html-tx-id>" }, "paths": { "<path>": { "id": "<tx-id>" } } }`. The `"fallback"` key ensures SPA routing works (all unmatched paths serve index.html).
  - [x] 2.6 Upload the manifest JSON to Arweave with tags: `Content-Type: application/x.arweave-manifest+json`, `Type: manifest`, `App-Name: Forge-UI`.
  - [x] 2.7 Print deployment summary: manifest tx ID, gateway URLs, relay configuration instructions.
  - [x] 2.8 For `--dev` mode: before uploading, check each file size. If any file > 100KB, warn and exit (free tier limit). Use `TurboFactory.unauthenticated()`.
  - [x] 2.9 For `--wallet` mode: read JWK file, use `TurboFactory.authenticated({ privateKey: jwk })`. Print estimated cost (file count * avg size) before uploading. Require `--confirm` flag to proceed (no interactive prompts -- CI/CD compatible). Without `--confirm`, print the cost estimate and exit.

### Part C: Verification

- [x] Task 3: Build verification tests (AC: #1, #2, #3)
  - [x] 3.1 In `packages/rig/src/web/build-verification.test.ts`, create unit test (8.7-UNIT-001): run `vite build` programmatically (or parse a pre-built dist), verify `index.html` contains relative asset paths (no leading `/`).
  - [x] 3.2 Unit test (8.7-UNIT-002): verify built `index.html` CSP `connect-src` includes all required Arweave gateways including wildcard subdomains (`*.ar-io.dev`, `*.arweave.net`, `*.permagate.io`).
  - [x] 3.3 Unit test (8.7-UNIT-003): verify no absolute asset paths (starting with `/assets/`) in `index.html`.

- [x] Task 4: Deploy script tests (AC: #4, #5, #6)
  - [x] 4.1 In `packages/rig/src/web/deploy-manifest.test.ts`, test the path manifest generation logic (8.7-UNIT-005): given a list of `{ path, txId }` entries, verify the manifest JSON has correct structure, includes fallback, and maps all paths.
  - [x] 4.2 Test MIME type detection (8.7-UNIT-006): verify `.html` -> `text/html`, `.js` -> `application/javascript`, `.css` -> `text/css`, unknown -> `application/octet-stream`.
  - [x] 4.3 Test `--dev` mode file size check (8.7-UNIT-007): given a file > 100KB, verify the script warns and exits without uploading.

### Part D: Documentation

- [x] Task 5: Update deployment docs (AC: #12, #13)
  - [x] 5.1 Add deployment instructions to the deploy script's `--help` output. Include: prerequisites (Arweave JWK wallet for prod, Node.js >= 20), usage examples for dev and prod modes, relay configuration.
  - [x] 5.2 Print dogfooding instructions: how to seed data (`node scripts/seed-forge-data.mjs`), how to access the deployed Forge-UI with `#relay=` hash fragment (e.g., `https://ar-io.dev/<tx-id>/#relay=wss://relay.example`).

## Dev Notes

### Architecture Patterns

- **Forge-UI is a static web app.** No server, no SDK dependency, no Node.js APIs in the browser code. The deploy script is a Node.js CLI tool (not part of the web app).
- **Arweave path manifests** are the standard way to deploy multi-file web apps to Arweave. Each file is uploaded as a separate data item, then a manifest JSON maps URL paths to tx IDs. The manifest tx ID becomes the entry point URL.
- **SPA fallback** via the manifest's `"fallback"` field. When a user hits a deep route, Arweave serves `index.html` (the fallback), and the client-side router (`packages/rig/src/web/router.ts`) handles the route.
- **AR.IO gateways** (`ar-io.dev`) serve Turbo/Irys uploads immediately. `arweave.net` can take 10+ minutes. Always use `ar-io.dev` as the primary gateway for verification.

### Turbo SDK Usage

The deploy script uses `@ardrive/turbo-sdk` directly (not via the kind:5094 DVM). The DVM is for agent-to-agent uploads over ILP. The deploy script is a human-operated CLI tool that uploads directly.

- **Dev (free tier):** `TurboFactory.unauthenticated()` -- free uploads <= 100KB per data item. Good for testing the pipeline.
- **Prod (paid):** `TurboFactory.authenticated({ privateKey: jwk })` -- paid via Turbo credits (purchased with fiat or crypto). No size limit.
- **Import:** `import { TurboFactory } from '@ardrive/turbo-sdk/node'` (Node.js specific import path).

### Vite Build Details

The existing Vite config (`packages/rig/vite.config.ts`) builds from `src/web/` to `dist/`. Key change: add `base: './'` for relative asset paths. Without this, Vite defaults to `base: '/'` which produces absolute paths that break on Arweave (where the base is `/<tx-id>/`, not `/`).

Current Vite config:
```ts
export default defineConfig({
  root: resolve(import.meta.dirname, 'src/web'),
  build: {
    outDir: resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(import.meta.dirname, 'src/web/index.html'),
    },
  },
});
```

Add `base: './'` at the top level of the config object.

### MIME Type Map

```javascript
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};
```

### Arweave Path Manifest Format

```json
{
  "manifest": "arweave/paths",
  "version": "0.2.0",
  "index": {
    "path": "index.html"
  },
  "fallback": {
    "id": "<index-html-tx-id>"
  },
  "paths": {
    "index.html": { "id": "<tx-id-1>" },
    "assets/main-abc123.js": { "id": "<tx-id-2>" },
    "assets/style-def456.css": { "id": "<tx-id-3>" }
  }
}
```

The `"fallback"` key is critical for SPA routing -- it tells the gateway to serve `index.html` for any path not explicitly in the manifest.

### Project Structure Notes

| File | Change | Type |
|------|--------|------|
| `packages/rig/vite.config.ts` | Add `base: './'` for relative asset paths | modify |
| `packages/rig/src/web/router.ts` | Add `VITE_DEFAULT_RELAY` env var support for `DEFAULT_RELAY_URL` | modify |
| `scripts/deploy-forge-ui.mjs` | Arweave deployment script | create |
| `packages/rig/src/web/build-verification.test.ts` | Build output validation tests | create |
| `packages/rig/src/web/deploy-manifest.test.ts` | Manifest generation and MIME type detection tests | create |

### Reuse from Prior Stories (DO NOT REINVENT)

- **`TurboFactory`** from `@ardrive/turbo-sdk/node` -- already a dependency of `@toon-protocol/sdk`. The deploy script uses it directly (not via the SDK package). Import from `@ardrive/turbo-sdk/node`.
- **`execFileSync`** -- use argument array form (not shell interpolation) as established in Story 8.6 code review (security hardening).
- **`ARWEAVE_GATEWAYS`** array from `packages/rig/src/web/arweave-client.ts` -- reference for gateway URLs in the deploy script's output, but do NOT import browser code into the Node.js script.
- **`parseRoute()`** in `packages/rig/src/web/router.ts` -- already handles SPA routing. No changes needed for Arweave deployment.
- **`seedShaCache()`** in `packages/rig/src/web/arweave-client.ts` -- already handles SHA-to-txId caching. No changes needed.
- **Vite config** at `packages/rig/vite.config.ts` -- extend, do not recreate.

### Anti-Patterns to Avoid

- **DO NOT use the kind:5094 DVM** for this deployment. The deploy script uploads directly via Turbo SDK. The DVM is for agent-to-agent uploads over ILP.
- **DO NOT use `execSync`** with string interpolation. Use `execFileSync` with argument arrays.
- **DO NOT hardcode gateway URLs** in the deploy script. Define a `GATEWAYS` constant and reference it.
- **DO NOT use `Buffer`** in browser code. The deploy script is Node.js and can use `Buffer`. The browser code in `packages/rig/src/web/` must use `Uint8Array`.
- **DO NOT modify the Forge-UI source code** (beyond the `base` config and relay env var). This story is about deployment, not feature changes.
- **DO NOT add `@ardrive/turbo-sdk`** as a dependency of `packages/rig`. The deploy script is in `scripts/` (root level) and uses the workspace-level dependency already installed for `packages/sdk`.

### Test Strategy

- **Unit tests:** Vitest for build verification (relative paths, CSP correctness) and manifest generation logic.
- **No E2E deployment tests:** Deploying to Arweave is a manual/CI operation. Tests verify the build output and manifest structure, not the actual upload.
- **Manual verification:** After deployment, verify in browser: `https://ar-io.dev/<manifest-tx-id>/` loads Forge-UI, deep routes work, relay parameter works.

### Previous Story Intelligence

Key learnings from Story 8.6 that apply here:
- **AR.IO gateway** (`ar-io.dev`) serves Turbo/Irys uploads immediately. `arweave.net` takes 10+ minutes. Use `ar-io.dev` for verification.
- **`execFileSync` over `execSync`** -- shell injection prevention established in code review.
- **E2E tests confirmed** all views work: repo list, tree, blob, commits, blame, issues, PRs. The Forge-UI is ready for deployment.
- **Seed script** (`scripts/seed-forge-data.mjs`) creates real NIP-34 events + Arweave git objects for dogfooding.

### Git Intelligence

Recent commits on `epic-8` branch:
- `2f26a3d feat(8-6): Forge-UI polish -- Forgejo-style tree view, markdown rendering, clean URLs`
- `7fd32e3 feat(8-6): Forge-UI E2E validation -- bug fixes, seed script, Playwright tests`
- `006c0b5 feat(8-5): Forge-UI issues and PRs from relay`

Expected commit for this story: `feat(8-7): Deploy Forge-UI to Arweave`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md, Story 8.6 "Deploy Forge-UI to Arweave"]
- [Source: _bmad-output/project-context.md, "Fully Decentralized Git Architecture"]
- [Source: packages/rig/vite.config.ts -- current build configuration]
- [Source: packages/rig/src/web/index.html -- CSP meta tag, SPA entry point]
- [Source: packages/rig/src/web/main.ts -- route handlers, view rendering orchestration]
- [Source: packages/rig/src/web/router.ts -- SPA routing via History API, relay URL parsing (`parseRelayUrl`), `DEFAULT_RELAY_URL`]
- [Source: packages/rig/src/web/arweave-client.ts -- ARWEAVE_GATEWAYS array]
- [Source: packages/sdk/src/arweave/turbo-adapter.ts -- TurboUploadAdapter pattern (reference, not reuse)]
- [Source: scripts/seed-forge-data.mjs -- data seeding for dogfooding]
- [Source: Arweave path manifest spec -- https://specs.arweave.dev/#/view/OXcT1sVRSA5eGwt2k6Yuz8-3e3g9WJi5uSE99CWqsBs]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- **Task 1 (Vite build config):** Added `base: './'` to `vite.config.ts` for relative asset paths. Added `VITE_DEFAULT_RELAY` env var support to `router.ts` with proper Vite env typing via `env.d.ts`. Build verified: `dist/index.html` uses `./assets/` relative paths, CSP preserved.
- **Task 2 (Deploy script):** Created `scripts/deploy-forge-ui.mjs` with `--dev` (free tier), `--wallet <path>` (authenticated), `--dry-run`, and `--help` modes. Uses `execFileSync` (not `execSync`). Creates Arweave path manifest with SPA fallback. Helper functions extracted to `scripts/deploy-helpers.mjs` for testability.
- **Task 3 (Build verification tests):** Updated `build-verification.test.ts` from RED phase stubs to working tests using `describe.skipIf(!buildExists)` pattern. 9 tests pass when dist/ exists. Fixed CSP test that incorrectly matched `'unsafe-inline'` in `style-src` when checking `script-src`.
- **Task 4 (Deploy script tests):** Updated `deploy-manifest.test.ts` to import real functions from `scripts/deploy-helpers.mjs`. All 23 tests pass: manifest generation (5), MIME detection (12), file size validation (3), deployment summary (3).
- **Task 5 (Documentation):** Deploy script `--help` output includes prerequisites, usage examples, env vars, relay configuration, and dogfooding instructions. `generateDeploymentSummary()` prints gateway URLs and seed instructions.
- **Bonus fix:** Fixed pre-existing router test isolation bug (5 tests were failing before this story) by adding `beforeEach` to clear `window.location.hash` between relay URL tests.

### File List

- `packages/rig/vite.config.ts` — modified (added `base: './'`)
- `packages/rig/src/web/router.ts` — modified (added `VITE_DEFAULT_RELAY` env var support)
- `packages/rig/src/web/env.d.ts` — created (Vite env type declarations)
- `scripts/deploy-forge-ui.mjs` — created (Arweave deployment script)
- `scripts/deploy-helpers.mjs` — created (testable helper functions: manifest, MIME, validation, summary)
- `packages/rig/src/web/build-verification.test.ts` — modified (RED phase stubs to working tests)
- `packages/rig/src/web/deploy-manifest.test.ts` — modified (RED phase stubs to working tests with real imports)
- `packages/rig/src/web/router.test.ts` — modified (fixed pre-existing test isolation bug)
- `_bmad-output/implementation-artifacts/8-7-deploy-forge-ui-to-arweave.md` — modified (status, checkboxes, dev record)

### Change Log

| Date | Summary |
|------|---------|
| 2026-03-24 | Story 8.7 implemented: Vite build configured for Arweave (`base: './'`), deploy script created with dev/prod/dry-run modes, 32 unit tests pass (9 build verification + 23 deploy manifest), pre-existing router test bug fixed |

## Code Review Record

### Review Pass #1

| Field | Value |
|-------|-------|
| **Date** | 2026-03-24 |
| **Reviewer Model** | Claude Opus 4.6 (1M context) |
| **Critical Issues** | 0 |
| **High Issues** | 1 (fixed) |
| **Medium Issues** | 2 (fixed) |
| **Low Issues** | 1 fixed, 2 accepted without changes |
| **Outcome** | All actionable issues fixed; story approved |

#### Issues Found

1. **HIGH — Missing wallet file validation in `deploy-forge-ui.mjs`** (fixed): Added try/catch around `readFileSync` for the wallet JWK file with clear error message and exit on failure.
2. **MEDIUM — Field name mismatch in `validateDevModeFileSizes`** (fixed): Function now accepts objects with either `path` or `relativePath` fields, matching output from `collectFiles()`.
3. **MEDIUM — Windows path separator in manifest paths** (fixed): `collectFiles()` normalizes paths with `.split('\\').join('/')` so Arweave manifest paths always use forward slashes.
4. **LOW — Missing dependency error message for `@ardrive/turbo-sdk` import** (fixed): Dynamic import catch block now prints actionable error message directing user to run `pnpm install`.
5. **LOW — Accepted without changes** (2 items): Minor style observations accepted as-is.

### Review Pass #2

| Field | Value |
|-------|-------|
| **Date** | 2026-03-24 |
| **Reviewer Model** | Claude Opus 4.6 (1M context) |
| **Critical Issues** | 0 |
| **High Issues** | 0 |
| **Medium Issues** | 2 (fixed) |
| **Low Issues** | 1 (fixed) |
| **Outcome** | All issues fixed; story approved |

#### Issues Found

1. **MEDIUM — Missing JSON.parse error handling for wallet file in `deploy-forge-ui.mjs`** (fixed): `JSON.parse(jwkContent)` had no try/catch. If the wallet file contains invalid JSON, users got a raw SyntaxError stack trace. Added try/catch with friendly error message.
2. **MEDIUM — No error handling around Turbo SDK upload calls in `deploy-forge-ui.mjs`** (fixed): Both the per-file upload loop and the manifest upload had no try/catch. Network errors, insufficient credits, or other upload failures produced raw stack traces. Added try/catch with contextual error messages and recovery guidance.
3. **LOW — `--wallet` flag could consume another flag as path in `deploy-helpers.mjs`** (fixed): `--wallet --dev` treated `--dev` as the wallet file path. Added check that the argument following `--wallet` does not start with `--`.

### Review Pass #3 (Security-focused: OWASP Top 10 + Semgrep)

| Field | Value |
|-------|-------|
| **Date** | 2026-03-24 |
| **Reviewer Model** | Claude Opus 4.6 (1M context) |
| **Tools Used** | Semgrep 1.153.0 (custom rules: path traversal, command injection, prototype pollution, open redirect, sensitive data logging) |
| **Critical Issues** | 0 |
| **High Issues** | 0 |
| **Medium Issues** | 0 |
| **Low Issues** | 1 (fixed) |
| **Outcome** | All issues fixed; story approved |

#### Security Audit Scope

OWASP Top 10 analysis, authentication/authorization flaws, injection risks (command injection, prototype pollution, path traversal, open redirect, XSS via CSP bypass, SSRF via relay URL).

#### Issues Found

1. **LOW — Prototype pollution in `generateManifest` paths object** (fixed): `const paths = {}` used plain object literal for the manifest paths map. If a file path in `dist/` matched a prototype property name (e.g., `__proto__`, `constructor`), it could pollute Object.prototype. Fixed by using `Object.create(null)` which has no prototype chain.

#### Security Observations (no action required)

- **Command injection:** Mitigated — uses `execFileSync` with argument array, not `execSync` with string interpolation.
- **Path traversal:** Mitigated — wallet file read is in try/catch; `collectFiles` operates only on the build output directory (not user-supplied paths); symlinks are naturally ignored by `Dirent.isFile()`.
- **Open redirect:** Mitigated — `navigateTo()` blocks absolute URLs and protocol-relative URLs (`//`).
- **XSS via CSP bypass:** Mitigated — CSP `script-src 'self'` with no `unsafe-inline` or `unsafe-eval`. `style-src 'unsafe-inline'` is accepted for Vite CSS injection.
- **SSRF via relay URL:** Not applicable — relay URL validation (`isValidRelayUrl`) restricts to `ws://`/`wss://` only; used client-side in browser WebSocket API.
- **Sensitive data exposure:** Mitigated — wallet file path (not contents) is logged; wallet private key material is never logged.
- **Authentication flaws:** N/A — deploy script is a local CLI tool, not a service. Turbo SDK handles Arweave authentication via JWK.
- **Injection in Arweave tags:** Not applicable — tag values (`Content-Type`, `App-Name`) are hardcoded constants, not user input.
