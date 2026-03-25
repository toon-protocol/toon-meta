---
title: 'Rig-UI Pointer System'
slug: 'rig-ui-pointer-system'
created: '2026-03-25'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['typescript', 'vite', 'vitest', '@ardrive/turbo-sdk', 'arweave-path-manifests']
files_to_modify: ['packages/rig/src/web/main.ts', 'packages/rig/src/web/router.ts', 'packages/rig/src/web/layout.ts', 'packages/rig/src/web/index.html', 'packages/rig/src/web/env.d.ts', 'packages/rig/src/web/templates.ts', 'packages/rig/src/web/relay-client.ts', 'scripts/deploy-forge-ui.mjs', 'scripts/deploy-helpers.mjs', 'scripts/seed-forge-data.mjs', 'scripts/deploy-rig-pointer.mjs (NEW)']
code_patterns: ['renderLayout(title, content, relayUrl)', 'parseRelayUrl(search)', 'Turbo SDK upload pattern', 'escapeHtml for XSS prevention', 'vitest jsdom environment']
test_patterns: ['vitest-jsdom', 'describe/it/expect', 'test IDs [P0]/[P1]/[P2]', 'integration tests in __integration__/', 'AC coverage comments']
---

# Tech-Spec: Rig-UI Pointer System

**Created:** 2026-03-25

## Overview

### Problem Statement

Sharing a TOON git repo requires viewers to know the relay URL and manually configure it via `#relay=` hash fragments or `?relay=` query params. This creates UX friction — users should click one link and see code, with zero configuration.

### Solution

Thin HTML shell pointers on Arweave that embed relay config (`window.__RIG_CONFIG__`) and load a single canonical Rig-UI deploy via `<script>` tags. Pointers are sub-1KB HTML documents uploaded to Arweave for free. Single-repo pointers deep-link to a specific repo; relay pointers show the full repo list.

### Scope

**In Scope:**
- Rename Forge-UI references to Rig-UI across codebase
- `window.__RIG_CONFIG__` boot config in `main.ts` (highest priority — before hash/query/default relay fallback)
- New `scripts/deploy-rig-pointer.mjs` script that generates and uploads ~1KB HTML pointer to Arweave
- Both single-repo pointer (`--repo`, `--owner` flags) and relay-wide pointer modes
- Graceful error states for stale pointers (relay unreachable, repo not found)

**Out of Scope:**
- SDK-level auto-deploy on repo creation (future work)
- ANS-104 tag discovery / versioning for canonical Rig-UI
- Changes to `deploy-forge-ui.mjs` behavior (it becomes the "canonical deploy" tool)
- Renaming the `packages/rig` package directory itself

## Context for Development

### Codebase Patterns

- **Relay resolution chain** (`router.ts`): `parseRelayUrl()` priority is hash fragment > query param > `VITE_DEFAULT_RELAY` env default. `__RIG_CONFIG__.relay` becomes new priority 0.
- **Layout pattern** (`layout.ts`): `renderLayout(title, content, relayUrl)` is called ~70 times in `main.ts` with `'Forge'` as title. Footer has hardcoded `"Forge"` text.
- **Arweave upload pattern** (`deploy-forge-ui.mjs`): Uses `TurboFactory.unauthenticated()` (dev) or `TurboFactory.authenticated({privateKey: jwk})` (wallet). Files uploaded as data items with `Content-Type` and `App-Name` tags.
- **Boot sequence** (`main.ts:1509-1529`): `init()` calls `parseRelayUrl()` once, then `initRouter()` and `renderRoute()`. This is the integration point for `__RIG_CONFIG__`.
- **CSP** (`index.html:8`): `connect-src` allows `ws: wss:` and Arweave gateways. `script-src 'self'` — pointer HTML loads scripts from Arweave gateway origin, so CSP is naturally scoped per-origin.
- **Vite env types** (`env.d.ts`): `ImportMetaEnv` interface defines `VITE_DEFAULT_RELAY`.

### Files to Reference

| File | Purpose | Change Type |
| ---- | ------- | ----------- |
| `packages/rig/src/web/main.ts` | App entry — boot logic, ~70x `'Forge'` title | Modify: add `__RIG_CONFIG__` reading in `init()`, rename `'Forge'` → `'Rig'` |
| `packages/rig/src/web/router.ts` | Relay URL resolution | Modify: add `__RIG_CONFIG__` as priority 0 in `parseRelayUrl()` |
| `packages/rig/src/web/layout.ts` | Page shell — header/footer | Modify: rename `"Forge"` in footer |
| `packages/rig/src/web/index.html` | HTML entry | Modify: rename `<title>Forge</title>` → `<title>Rig</title>`, update meta description |
| `packages/rig/src/web/env.d.ts` | Vite env types | Modify: add `RigConfig` interface on `window` |
| `packages/rig/src/web/templates.ts` | Template rendering | Modify: rename `"Forge-UI"` in contribution banner |
| `packages/rig/src/web/relay-client.ts` | WebSocket relay client | Modify: rename `forge-` subscription ID prefix |
| `scripts/deploy-forge-ui.mjs` | Canonical Rig-UI deploy | Modify: rename comments, help text, `App-Name` tags |
| `scripts/deploy-helpers.mjs` | Shared deploy helpers | Modify: rename summary text |
| `scripts/seed-forge-data.mjs` | Test data seeder | Modify: rename output messages |
| `scripts/deploy-rig-pointer.mjs` | **NEW** — Pointer HTML generator + Arweave uploader | Create |
| Multiple `*.test.ts` files | Tests with `'Forge'` assertions | Modify: rename string literals |
| Multiple `*.ts` JSDoc comments | `"Forge-UI"` in doc comments | Modify: rename to `"Rig-UI"` |

### Technical Decisions

| ID | Decision | Rationale |
|---|---|---|
| D-RIG-001 | Rename Forge-UI to Rig-UI | Aligns with `packages/rig` package name |
| D-RIG-002 | Thin HTML shell pointer pattern | Sub-1KB HTML on Arweave bootstraps canonical Rig-UI from fixed TX |
| D-RIG-003 | Single canonical Rig-UI deploy | One Arweave manifest for the full app, referenced by all pointers |
| D-RIG-004 | `window.__RIG_CONFIG__` boot config | Rig-UI reads relay/repo/owner from global injected by pointer HTML |
| D-RIG-005 | Both single-repo and relay pointers | `repo` field optional — present = deep-link, absent = repo list |
| D-RIG-006 | Single-repo is the default | Primary use case: "here's my project" = one clean URL |
| D-RIG-007 | `deploy-rig-pointer.mjs` script | CLI tool for pointer creation: `--relay`, `--repo`, `--owner` flags |
| D-RIG-008 | Graceful error for stale pointers | "Relay unreachable" / "Repo not found" UX rather than prevention |

## Implementation Plan

### Tasks

- [ ] **Task 0: Validate cross-TX script loading on Arweave gateways**
  - Action: Before implementing the pointer system, manually verify that an HTML page on Arweave can load a `<script>` from a different TX on the same gateway. Upload a minimal test HTML to ar-io.dev that references a JS file from a known TX. Confirm script executes. Test on ar-io.dev, arweave.net, and permagate.io.
  - Notes: If any gateway blocks cross-TX script loading (sandbox subdomains), document which gateways work and constrain the pointer deploy script to emit only compatible gateway URLs. This is a BLOCKING validation — do not proceed with Task 13 if this fails.

- [ ] **Task 1: Add `RigConfig` type and `window.__RIG_CONFIG__` declaration**
  - File: `packages/rig/src/web/env.d.ts`
  - Action: Add `interface RigConfig { relay: string; repo?: string; owner?: string }` and extend `Window` interface with optional `__RIG_CONFIG__?: RigConfig`
  - Notes: This is the type contract consumed by `router.ts` and `main.ts`

- [ ] **Task 2: Add `__RIG_CONFIG__` as priority 0 in `parseRelayUrl()`**
  - File: `packages/rig/src/web/router.ts`
  - Action: At the top of `parseRelayUrl()` (before the hash fragment check), add: if `window.__RIG_CONFIG__?.relay` exists and passes `isValidRelayUrl()`, return it immediately. Also update the priority comment on line 35 from `"Priority: (1) #relay= hash fragment, (2) ?relay= query param, (3) this default"` to `"Priority: (0) window.__RIG_CONFIG__.relay, (1) #relay= hash fragment, (2) ?relay= query param, (3) this default"`
  - Notes: This ensures pointer-injected relay config takes absolute precedence. Existing hash/query/default fallback chain is unchanged. This adds another direct `window` access to `parseRelayUrl()` (which already accesses `window.location.hash` directly), consistent with the existing pattern.

- [ ] **Task 3: Add `__RIG_CONFIG__` deep-link logic in `init()`**
  - File: `packages/rig/src/web/main.ts`
  - Action: In the `init()` function (line ~1509), after `parseRelayUrl()` and `initRouter()` but before `renderRoute(initialRoute)`: if `window.__RIG_CONFIG__?.repo` is set, override `initialRoute` to a tree route for that repo (with optional owner from `__RIG_CONFIG__?.owner`)
  - Notes: Call `parseRoute(`/${owner}/${repo}/`)` to parse the constructed path into a Route object — `parseRoute` is a parser, not a constructor. Only override if current route is `repo-list` (i.e., user landed on `/`). If the URL already has a path (user navigated to `<pointer-tx>/some/path`), do NOT override — respect the explicit navigation.

- [ ] **Task 4: Rename `'Forge'` → `'Rig'` in `main.ts`**
  - File: `packages/rig/src/web/main.ts`
  - Action: Replace all `renderLayout('Forge',` with `renderLayout('Rig',` (~70 occurrences). Also rename JSDoc comment `"Forge-UI main entry point"` → `"Rig-UI main entry point"` and `"Initialize the Forge-UI application"` → `"Initialize the Rig-UI application"`
  - Notes: Use `replace_all` for the `renderLayout` calls. Manual edit for JSDoc.

- [ ] **Task 5: Rename `"Forge"` in `layout.ts`**
  - File: `packages/rig/src/web/layout.ts`
  - Action: Change footer text from `Forge &mdash; Decentralized Git on Nostr &amp; TOON Protocol` to `Rig &mdash; Decentralized Git on Nostr &amp; TOON Protocol`. Also rename JSDoc comment `"Shared layout for Forge-UI"` → `"Shared layout for Rig-UI"`

- [ ] **Task 6: Rename in `index.html`**
  - File: `packages/rig/src/web/index.html`
  - Action: Change `<title>Forge</title>` → `<title>Rig</title>`. Change meta description from `"Decentralized Git forge on Nostr"` → `"Decentralized Git on Nostr &amp; TOON Protocol"`

- [ ] **Task 7: Rename in `templates.ts`**
  - File: `packages/rig/src/web/templates.ts`
  - Action: Change `"Forge-UI is read-only"` → `"Rig-UI is read-only"` in the contribution banner (line ~798). Also rename JSDoc comments containing `"Forge-UI"` or `"Forgejo"` references in comments (keep `"Forgejo-style"` as it refers to the external project's design language)

- [ ] **Task 8: Rename in `relay-client.ts`**
  - File: `packages/rig/src/web/relay-client.ts`
  - Action: Change subscription ID prefix from `` `forge-${Date.now()}` `` to `` `rig-${Date.now()}` `` (line ~133)

- [ ] **Task 9: Rename JSDoc comments across source files**
  - Files: `profile-cache.ts`, `tree-diff.ts`, `markdown-renderer.ts`, `npub.ts`, `nip34-parsers.ts`, `escape.ts`, `git-objects.ts`, `unified-diff.ts`, `markdown-safe.ts`, `arweave-client.ts`, `commit-walker.ts`, `blame.ts`, `date-utils.ts`, `ref-resolver.ts`
  - Action: Replace `"Forge-UI"` → `"Rig-UI"` in JSDoc `@file`/module-level comments
  - Notes: Only change comments — no functional code changes in these files

- [ ] **Task 10: Rename in deploy scripts**
  - Files: `scripts/deploy-forge-ui.mjs`, `scripts/deploy-helpers.mjs`, `scripts/seed-forge-data.mjs`
  - Action: Replace `"Forge-UI"` → `"Rig-UI"` in comments, help text, console output, and Arweave `App-Name` tags. In `deploy-forge-ui.mjs` lines 233 and 270: `{ name: 'App-Name', value: 'Rig-UI' }`. In `deploy-helpers.mjs` line 211: `'=== Rig-UI Deployment Summary ==='`
  - Notes: Script filenames (`deploy-forge-ui.mjs`, `seed-forge-data.mjs`) are NOT renamed — they remain as-is for backwards compatibility. Only content is updated.

- [ ] **Task 11: Update test assertions**
  - Files: `layout.test.ts`, `templates.test.ts`, `router.test.ts`, `__integration__/issues-list.test.ts`, `__integration__/pulls-list.test.ts`, `__integration__/issues-prs-e2e.test.ts`, `__integration__/blame-view.test.ts`, `__integration__/blame-e2e.test.ts`, `__integration__/issues-pr-fallback.test.ts`
  - Action: Replace `'Forge'` → `'Rig'` in `renderLayout('Forge',` calls and `expect(...).toContain('Forge')` assertions. Replace `'Forge-UI is read-only'` → `'Rig-UI is read-only'` in assertion strings.
  - Notes: Use `replace_all` within each test file. `deploy-manifest.test.ts` references `seed-forge-data` (script filename) — leave as-is.

- [ ] **Task 12: Add `__RIG_CONFIG__` unit tests**
  - File: `packages/rig/src/web/router.test.ts`
  - Action: Add new test group `describe('Router - __RIG_CONFIG__ relay resolution', ...)` with tests:
    - `[P0] uses __RIG_CONFIG__.relay when set (highest priority)`
    - `[P1] __RIG_CONFIG__.relay takes precedence over #relay= hash fragment`
    - `[P1] ignores __RIG_CONFIG__ with invalid relay URL`
    - `[P2] falls back to hash/query/default when __RIG_CONFIG__ is undefined`
  - Notes: Set `(window as any).__RIG_CONFIG__ = { relay: 'wss://...' }` in `beforeEach`, clean up in `afterEach`

- [ ] **Task 13: Create `scripts/deploy-rig-pointer.mjs`**
  - File: `scripts/deploy-rig-pointer.mjs` (NEW)
  - Action: Create script that:
    1. Parses CLI args: `--relay <url>` (required), `--repo <name>` (optional), `--owner <npub>` (optional), `--rig-tx <manifest-tx-id>` (required — canonical Rig-UI manifest), `--dev` / `--wallet <path>` / `--dry-run` / `--help`
    2. Fetches the raw Arweave manifest from `https://ar-io.dev/raw/<rig-tx>` (NOT `/<rig-tx>` which returns resolved index.html) to discover asset paths (JS/CSS filenames with Vite content hashes)
    3. Generates pointer HTML with:
       - Full HTML boilerplate: `<!DOCTYPE html>`, `<html lang="en">`, `<meta charset="utf-8">`, `<meta name="viewport" content="width=device-width,initial-scale=1">`
       - Config injection using safe serialization: `<script>window.__RIG_CONFIG__=${JSON.stringify(config).replace(/</g, '\\u003c')}</script>` — the `\\u003c` escaping prevents `</script>` breakout XSS
       - Own CSP meta tag: `<meta http-equiv="Content-Security-Policy" content="default-src 'self' https://ar-io.dev; script-src 'self' 'unsafe-inline' https://ar-io.dev; style-src 'self' 'unsafe-inline' https://ar-io.dev; connect-src 'self' ws: wss: https://ar-io.dev https://*.ar-io.dev https://arweave.net https://*.arweave.net https://permagate.io https://*.permagate.io">` — `'unsafe-inline'` required for the config `<script>` block
       - Script/CSS tags: `<script type="module" src="https://ar-io.dev/<rig-tx>/<main-js-path>">` + `<link rel="stylesheet" href="https://ar-io.dev/<rig-tx>/<css-path>">`
    4. Uploads the HTML to Arweave via Turbo SDK (reuse upload pattern from `deploy-forge-ui.mjs`)
    5. Prints pointer URL: `https://ar-io.dev/<pointer-tx-id>/`
  - Notes: Reuse `parseCliArgs` from `deploy-helpers.mjs` where possible. Validate `--relay` with `isValidRelayUrl` pattern (ws/wss only) — warn if `ws://` (insecure) is used for a permanent Arweave pointer. Validate `--owner` is a valid `npub1` or 64-char hex pubkey if provided. HTML is a single data item, not a manifest (no path routing needed). Title: `<repo> — Rig` or `Rig` if no repo. `--dry-run` generates the pointer HTML and prints it to stdout without uploading.

- [ ] **Task 14: Add pointer generation unit tests**
  - File: `packages/rig/src/web/rig-pointer.test.ts` (NEW) or inline in deploy test
  - Action: Test the HTML generation function (extract from deploy script as testable export):
    - Generated HTML contains `window.__RIG_CONFIG__` with correct relay/repo/owner
    - HTML is valid (has doctype, charset, viewport meta)
    - Relay URL is JSON-escaped (no XSS via relay URL injection)
    - Title reflects repo name when provided
    - Asset paths are correctly resolved from manifest
  - Notes: The generation logic should be a pure function importable for testing, similar to how `deploy-helpers.mjs` exports testable functions

- [ ] **Task 15: Run full test suite and fix any breakage**
  - Action: Run `pnpm test` from workspace root. The rename (Tasks 4-11) is the most likely source of missed references. Fix any `'Forge'` strings in assertions or snapshots that were not caught in Task 11.
  - Notes: CSS class names like `.layout-header` do NOT change. Only user-facing text and comments change.

### Acceptance Criteria

- [ ] **AC1**: Given a pointer HTML page loaded from Arweave with `window.__RIG_CONFIG__ = { relay: 'wss://relay.example' }`, when the Rig-UI JS loads, then it connects to `wss://relay.example` and shows the repo list (no hash fragment or query param needed)
- [ ] **AC2**: Given a pointer with `__RIG_CONFIG__ = { relay: 'wss://relay.example', repo: 'my-project', owner: 'npub1abc...' }`, when the Rig-UI loads, then it navigates directly to the `my-project` tree view (skips repo list)
- [ ] **AC3**: Given `__RIG_CONFIG__.relay` is set AND `#relay=wss://other` is in the URL, when `parseRelayUrl()` is called, then `__RIG_CONFIG__.relay` wins (highest priority)
- [ ] **AC4**: Given `__RIG_CONFIG__` is undefined (standalone Rig-UI, not loaded via pointer), when the app boots, then existing behavior is preserved (hash > query > VITE_DEFAULT_RELAY > default)
- [ ] **AC5**: Given `__RIG_CONFIG__.relay` contains an invalid URL (not `ws://` or `wss://`), when `parseRelayUrl()` is called, then the invalid value is ignored and fallback chain is used
- [ ] **AC6**: Given the user runs `node scripts/deploy-rig-pointer.mjs --relay wss://relay.example --repo my-project --rig-tx abc123 --dev`, when the script completes, then a pointer HTML is uploaded to Arweave and the pointer URL is printed
- [ ] **AC7**: Given the user runs `node scripts/deploy-rig-pointer.mjs --relay wss://relay.example --rig-tx abc123 --dev` (no `--repo`), when the script completes, then a relay-wide pointer HTML is uploaded (no deep-link, shows repo list)
- [ ] **AC8**: Given all `'Forge'` references are renamed to `'Rig'`, when `pnpm test` is run, then all existing tests pass with the new naming
- [ ] **AC9**: Given the relay in a pointer is unreachable, when the Rig-UI loads via that pointer, then a graceful "Relay unreachable" message is displayed (existing empty-state pattern)
- [ ] **AC10**: Given a single-repo pointer references a repo that doesn't exist on the relay, when the Rig-UI loads, then "Repository not found" is displayed (existing 404 pattern in `renderTreeRoute`)

## Additional Context

### Dependencies

- `@ardrive/turbo-sdk` (already installed — used by `deploy-forge-ui.mjs`)
- A deployed canonical Rig-UI manifest TX ID (from `deploy-forge-ui.mjs`) is required before pointers can reference it
- Arweave gateway access for resolving manifest → asset paths in the pointer script
- No new npm packages needed

### Testing Strategy

**Unit Tests (automated, vitest):**
- `router.test.ts`: 4 new tests for `__RIG_CONFIG__` relay priority (AC1, AC3, AC4, AC5)
- `rig-pointer.test.ts` (new): 5 tests for pointer HTML generation (AC6, AC7 generation logic)
- Existing test suite: rename assertions pass (AC8)

**Manual Testing:**
1. Deploy canonical Rig-UI: `node scripts/deploy-forge-ui.mjs --dev` → note manifest TX
2. Deploy single-repo pointer: `node scripts/deploy-rig-pointer.mjs --relay wss://localhost:7100 --repo test-repo --rig-tx <manifest-tx> --dev`
3. Open pointer URL in browser → verify repo loads directly (AC2)
4. Deploy relay pointer (no `--repo`): verify repo list renders (AC7)
5. Deploy pointer with invalid relay → verify graceful error (AC9)

### Notes

- Party mode decisions D-RIG-001 through D-RIG-008 documented in Technical Decisions
- Arweave free tier (`--dev` mode) supports files up to 100KB — pointer HTML is ~1KB, well within limits
- Vite content hashes in asset filenames mean the pointer script must resolve them from the raw manifest JSON (`/raw/<txid>`)
- The `relay-client.ts` `queryRelay()` already handles WebSocket connection failures with timeout — stale pointer error handling (AC9) is covered by existing empty-state rendering when no events are returned
- AC10 is already handled by the existing 404 path in `renderTreeRoute()` — no additional error handling code needed
- Script filename `deploy-forge-ui.mjs` is kept for backwards compatibility — add a comment at top: `// Historically named "Forge-UI", now deploys Rig-UI. Filename kept for backwards compat.`

### Adversarial Review Resolutions

**F1/F2/F3 — CSP & Arweave gateway sandboxing (Critical/High):**
- The canonical Rig-UI's CSP (in its `index.html`) does NOT apply to the pointer HTML — they are separate documents
- `ar-io.dev` uses path-based routing (`ar-io.dev/<txid>/`) by default, which IS same-origin for cross-TX script loading
- Some gateways MAY use sandbox subdomains (`<txid>.ar-io.dev`) which would break cross-TX loading
- **Resolution:** Pointer HTML includes its own CSP that explicitly allows `https://ar-io.dev` as a script/style source. `'unsafe-inline'` is required for the `__RIG_CONFIG__` injection script. Gateway constraint documented: pointers require path-based gateways (ar-io.dev, arweave.net, permagate.io) — NOT sandbox-subdomain gateways.
- **Pre-implementation validation (Task 0):** Before implementing Task 13, manually verify cross-TX script loading works on ar-io.dev by creating a minimal test HTML that loads a JS file from a different TX.

**F4 — No versioning for stale pointers (High):**
- Accepted risk for v1. When canonical Rig-UI is redeployed, existing pointers load the old JS bundle (which still works — Arweave is permanent). Pointers are ~free to regenerate.
- The `deploy-rig-pointer.mjs` help text should document this: "Pointers reference a specific Rig-UI version. Regenerate pointers after redeploying the canonical Rig-UI to use the latest version."

**F7 — XSS via `</script>` in relay URL (High):**
- Resolved: `JSON.stringify(config).replace(/</g, '\\u003c')` escapes all `<` chars in the serialized config, preventing `</script>` breakout.

**F9 — Wrong manifest fetch URL (Medium):**
- Resolved: Use `https://ar-io.dev/raw/<txid>` to fetch raw manifest JSON.

**F10 — No `--owner` validation (Medium):**
- Resolved: Validate `--owner` is `npub1`-prefixed (bech32) or 64-char hex. Reject with error if invalid.

**F11 — Missing viewport meta (Medium):**
- Resolved: Pointer HTML includes full boilerplate (`charset`, `viewport`, `lang`).

**F12 — `App-Name` tag rename (Medium, Undecided):**
- No existing code queries by `App-Name` tag. Existing Arweave deploys are permanent and unaffected. New deploys use `Rig-UI`. Accepted.
