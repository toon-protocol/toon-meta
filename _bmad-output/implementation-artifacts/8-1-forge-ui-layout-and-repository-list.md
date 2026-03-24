# Story 8.1: Forge-UI -- Layout and Repository List

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **human user**,
I want a web interface to discover and browse repositories,
So that I can explore code without needing a Nostr client or understanding the protocol.

**FRs covered:** FR-NIP34-3 (Forge-UI subset)

**Dependencies:** Epic 9 Stories 9.26-9.30 (NIP-34 skill defines event structures Forge-UI queries) -- NOT a hard blocker. Forge-UI queries kind:30617 events directly; it does not depend on skill code. NIP-34 event structures are defined by the Nostr protocol spec, not by Epic 9 implementation.

**Decision sources:**
- Party Mode 2026-03-22: Fully Decentralized Git Architecture (Arweave DVM + Forge-UI)
- `_bmad-output/project-context.md` section "Fully Decentralized Git Architecture"

**Downstream dependencies:** Stories 8.2-8.5 build on this story's layout, CSS, navigation, relay query patterns, and package infrastructure.

## Acceptance Criteria

### Part A: Package Infrastructure (First Web App in Monorepo)

1. **Package setup:** Given the `packages/rig/` directory (ATDD stubs exist), when `package.json`, `tsconfig.json`, and `vitest.config.ts` are created, then `pnpm install && pnpm build && pnpm test` succeeds across the monorepo. The rig package is a pnpm workspace member with `"type": "module"`.

2. **Build pipeline:** Given a Vite-based build configuration, when `cd packages/rig && pnpm build` runs, then a `dist/` directory is produced containing `index.html` and bundled JS/CSS assets suitable for static hosting (Arweave or any HTTP server).

3. **Vitest with jsdom:** Given `packages/rig/vitest.config.ts` with `environment: 'jsdom'`, when unit tests run, then DOM APIs (`document`, `window`, etc.) are available for testing rendering logic.

### Part B: Relay Query and Repository List

4. **Relay query builder for kind:30617:** Given a relay URL, when `buildRepoListFilter()` is called, then it produces a correct Nostr filter `{ kinds: [30617] }` for querying repository announcement events. The query is sent via WebSocket to the configured relay and responses are decoded from TOON format.

5. **Repository list rendering:** Given kind:30617 events returned from the relay, when the repo list is rendered, then each repo shows: name (from `d` tag), description (from content or `description` tag), owner pubkey, and default branch (from `ref` tag). The rendering uses XSS-safe HTML escaping.

6. **Profile enrichment:** Given a repo owner's pubkey, when the repo list renders, then it fetches kind:0 profile events for each unique pubkey and displays the profile name if available, falling back to truncated npub (first 8 + last 4 chars) if no profile exists.

7. **Empty state:** Given no kind:30617 events from the relay, when the repo list renders, then a "No repositories found" message is displayed.

### Part C: Navigation and Layout

8. **Shared layout:** Given the Forge-UI app, when any page renders, then a shared layout provides: a navigation header with the app title ("Forge"), a CSS reset and base styles (mechanically ported from Forgejo's visual design), and a content area.

9. **Repo navigation:** Given the repository list, when I click on a repository name, then I am navigated to that repository's file tree view (route: `/<owner-npub>/<repo-name>/`).

10. **Relay URL configuration:** Given the Forge-UI app, when it loads, then the relay URL is configurable via URL query parameter (`?relay=wss://...`) or a settings UI. A sensible default relay URL is used if none is specified.

### Part D: TOON Format Handling and Security

11. **TOON format decoding:** Given the relay returns events in TOON format (not standard JSON), when the Forge-UI receives event data via WebSocket, then it correctly decodes TOON-encoded events using `@toon-protocol/core` TOON codec (or a browser-compatible subset).

12. **XSS prevention in rendered content:** Given kind:30617 events with malicious content in tag values (e.g., repo name `<script>alert(1)</script>`, description containing `<img onerror=...>`), when the repo list is rendered, then all user-supplied strings are HTML-escaped (replacing `<>&"'` with HTML entities) and no unescaped content is inserted via `innerHTML`. This is a **P0 security requirement**.

## Tasks / Subtasks

### Part A: Package Infrastructure

- [x] Task 1: Create `packages/rig/package.json` (AC: #1, #2)
  - [x] 1.1 Create `packages/rig/package.json` with name `@toon-protocol/rig`, `"type": "module"`, dependencies on `@toon-protocol/core` (workspace). Dev dependencies: `vite`, `vitest`, `jsdom`, `typescript`. NO dependency on `@toon-protocol/sdk` -- Forge-UI is a static frontend, not a service node.
  - [x] 1.2 Add scripts: `"build": "vite build"`, `"dev": "vite"`, `"test": "vitest run"`, `"test:watch": "vitest"`.
  - [x] 1.3 Verify `pnpm install` succeeds at monorepo root with the new workspace member.

- [x] Task 2: Create `packages/rig/tsconfig.json` (AC: #1, #3)
  - [x] 2.1 Create `packages/rig/tsconfig.json` extending root config. Add `"lib": ["es2022", "dom", "dom.iterable"]` for browser type definitions. Set `"moduleResolution": "bundler"` and `"target": "es2022"`.
  - [x] 2.2 Include `src/**/*.ts` and `src/**/*.tsx` (if needed).

- [x] Task 3: Create `packages/rig/vitest.config.ts` (AC: #3)
  - [x] 3.1 Create vitest config with `environment: 'jsdom'`. Follow the pattern from other packages (e.g., `packages/sdk/vitest.config.ts`). Set `test.include` to `src/**/*.test.ts`.
  - [x] 3.2 Verify existing ATDD stub tests in `packages/rig/src/web/templates.test.ts` run (they should all skip).

- [x] Task 4: Create `packages/rig/vite.config.ts` (AC: #2)
  - [x] 4.1 Create Vite config for building a static SPA. Entry point: `packages/rig/src/web/index.html`. Output: `packages/rig/dist/`.
  - [x] 4.2 Configure Vite to bundle `@toon-protocol/core` TOON codec for browser usage. Externalize Node.js-only modules (better-sqlite3, ws, etc.) that core may transitively reference.

- [x] Task 5: Create entry point HTML and app shell (AC: #2, #8)
  - [x] 5.1 Create `packages/rig/src/web/index.html` with standard HTML5 boilerplate, viewport meta, title "Forge", and a `<div id="app">` mount point. Link to main JS/CSS entry.
  - [x] 5.2 Create `packages/rig/src/web/main.ts` as the JS entry point. Initialize app, set up client-side routing, render initial view.

### Part B: Relay Client and Repository Data

- [x] Task 6: Create relay query module (AC: #4, #11)
  - [x] 6.1 Create `packages/rig/src/web/relay-client.ts`. Implement a minimal WebSocket relay client for the browser. Connect to relay URL, send `REQ` subscriptions, handle `EVENT`/`EOSE` messages. Decode TOON format responses using `@toon-protocol/core` decodeToon (or equivalent browser-compatible function).
  - [x] 6.2 Export `queryRelay(relayUrl: string, filter: NostrFilter): Promise<NostrEvent[]>` -- sends REQ, collects events until EOSE, closes subscription.
  - [x] 6.3 Export `buildRepoListFilter(): NostrFilter` -- returns `{ kinds: [30617] }`.
  - [x] 6.4 DO NOT use `nostr-tools` SimplePool -- it does NOT work correctly in all environments (known issue documented in project-context.md). Use raw WebSocket.

- [x] Task 7: Create profile enrichment module (AC: #6)
  - [x] 7.1 Create `packages/rig/src/web/profile-cache.ts`. Export `ProfileCache` class that fetches kind:0 events for pubkeys, caches results, and provides display names. Batch pubkey lookups to minimize relay queries.
  - [x] 7.2 Fallback for missing profiles: truncated npub format (`npub1abc...xyz1`).

### Part C: Repository List UI

- [x] Task 8: Implement `renderRepoList()` (AC: #5, #7, #8, #12)
  - [x] 8.1 Update `packages/rig/src/web/templates.ts`. Replace the stub `renderRepoList()` with a real implementation. Accept `RepoMetadata[]` where `RepoMetadata = { name, description, ownerPubkey, defaultBranch, eventId }` (parsed from kind:30617 events).
  - [x] 8.2 Render each repo as an HTML card/row with: linked name (href to `/<npub>/<name>/`), description (XSS-escaped), owner display name (from ProfileCache), default branch badge.
  - [x] 8.3 Empty state: render "No repositories found" when list is empty.
  - [x] 8.4 All user-supplied content (name, description, etc.) MUST be HTML-escaped to prevent XSS. Use a simple escape function (replace `<>&"'` with HTML entities).

- [x] Task 9: Create shared layout (AC: #8)
  - [x] 9.1 Create `packages/rig/src/web/layout.ts`. Export `renderLayout(title: string, content: string): string` that wraps content in the shared layout HTML: nav header ("Forge" title, optional relay indicator), CSS, content area, footer.
  - [x] 9.2 Create `packages/rig/src/web/styles.css` (or inline styles). Base CSS reset, typography, layout grid. Visually reference Forgejo's clean design (neutral colors, readable fonts, clear hierarchy). Do NOT copy Forgejo CSS -- create a minimal equivalent.

- [x] Task 10: Client-side routing (AC: #9, #10)
  - [x] 10.1 Create `packages/rig/src/web/router.ts`. Implement a minimal hash-based or History API router. Routes: `/` (repo list), `/<npub>/<repo>/` (file tree, stub for Story 8.2), `/<npub>/<repo>/commit/<sha>` (stub), `/<npub>/<repo>/blame/<path>` (stub).
  - [x] 10.2 Parse relay URL from `window.location.search` query param `?relay=`. Default to a reasonable relay URL (e.g., `ws://localhost:7100` for development).

### Part D: NIP-34 Event Parsing

- [x] Task 11: Parse kind:30617 repository announcements (AC: #4, #5)
  - [x] 11.1 Create `packages/rig/src/web/nip34-parsers.ts`. Export `parseRepoAnnouncement(event: NostrEvent): RepoMetadata | null`. Extract from kind:30617 tags: `d` tag (repo identifier), `name` tag, `description` tag, `clone` tags (git URLs), `web` tags, `maintainers` tags, `relays` tags. Content field may contain a longer description.
  - [x] 11.2 Validate kind = 30617. Return null for malformed events.

### Part E: Unit Tests

- [x] Task 12: Unit tests for relay query builder (AC: #4)
  - [x] 12.1 File: `packages/rig/src/web/relay-query.test.ts`. Test ID: 8.1-UNIT-001.
  - [x] 12.2 Test: `buildRepoListFilter()` returns `{ kinds: [30617] }`.

- [x] Task 13: Unit tests for repo list renderer (AC: #5, #7)
  - [x] 13.1 Update `packages/rig/src/web/templates.test.ts`. Activate existing ATDD stubs AND add new tests. Test IDs: 8.1-UNIT-002, 8.1-UNIT-003.
  - [x] 13.2 Test: given repos, render contains repo names, descriptions, owner display. (8.1-UNIT-002)
  - [x] 13.3 Test: empty repos array renders "No repositories" message. (8.1-UNIT-003)

- [x] Task 14: Unit tests for profile enrichment (AC: #6)
  - [x] 14.1 File: `packages/rig/src/web/profile-cache.test.ts`. Test ID: 8.1-UNIT-004.
  - [x] 14.2 Test: missing profile falls back to truncated npub format.

- [x] Task 15: Unit tests for relay URL config (AC: #10)
  - [x] 15.1 File: `packages/rig/src/web/router.test.ts`. Test ID: 8.1-UNIT-005.
  - [x] 15.2 Test: relay URL extracted from query parameter. Default used when absent.

- [x] Task 16: Unit tests for TOON format parsing (AC: #11)
  - [x] 16.1 File: `packages/rig/src/web/relay-client.test.ts`. Test ID: 8.1-UNIT-006.
  - [x] 16.2 Test: TOON-encoded kind:30617 event is correctly decoded.

- [x] Task 17: Unit tests for NIP-34 repo announcement parser (AC: #4, #5)
  - [x] 17.1 File: `packages/rig/src/web/nip34-parsers.test.ts`. Test IDs: 8.1-UNIT-007, 8.1-UNIT-008.
  - [x] 17.2 Test: valid kind:30617 event parsed to RepoMetadata with correct fields. (8.1-UNIT-007)
  - [x] 17.3 Test: malformed event (wrong kind, missing d tag) returns null. (8.1-UNIT-008)

- [x] Task 18: Unit tests for XSS prevention in repo list rendering (AC: #5, #12)
  - [x] 18.1 File: `packages/rig/src/web/templates.test.ts`. Test IDs: 8.1-UNIT-009, 8.1-UNIT-010.
  - [x] 18.2 Test: repo name containing `<script>alert(1)</script>` is HTML-escaped in rendered output. (8.1-UNIT-009)
  - [x] 18.3 Test: repo description containing `<img onerror=alert(1) src=x>` is HTML-escaped in rendered output. (8.1-UNIT-010)

### Part F: Integration Tests

- [x] Task 19: Integration test -- static HTML renders repo list (AC: #5)
  - [x] 19.1 File: `packages/rig/src/web/__integration__/repo-list-render.test.ts`. Test ID: 8.1-INT-001.
  - [x] 19.2 Test: inject mock kind:30617 data into DOM renderer, verify HTML output contains expected repo entries. Uses jsdom environment.

- [x] Task 20: Integration test -- navigation (AC: #9)
  - [x] 20.1 File: `packages/rig/src/web/__integration__/navigation.test.ts`. Test ID: 8.1-INT-002.
  - [x] 20.2 Test: click repo name in rendered HTML triggers navigation to file tree route.

## Dev Notes

### Architecture Patterns

- **First web application in the monorepo.** This story establishes ALL patterns for Stories 8.2-8.5. Take extra care with build pipeline, test infrastructure, and code organization.
- **Static web app -- no server.** Forge-UI is pure client-side HTML/JS/CSS. It queries relays via WebSocket and Arweave gateways via HTTP fetch. There is no backend, no API server, no SDK dependency.
- **Transport is raw WebSocket, NOT nostr-tools SimplePool.** SimplePool does NOT work correctly in all environments (documented known issue). Use raw `WebSocket` in the browser to connect to relays.
- **TOON format responses.** The relay returns events in TOON format, not standard JSON. The Forge-UI must decode TOON responses. Import decode functions from `@toon-protocol/core`. Verify that the core TOON codec functions are browser-compatible (no Node.js-only APIs like `Buffer`).
- **XSS prevention is critical.** All user-supplied content from Nostr events (repo names, descriptions, issue content) MUST be HTML-escaped before rendering. This is the primary security surface for a static web app.
- **NIP-34 kind:30617 event structure.** Repository announcement events use NIP-33 parameterized replaceable format. Key tags: `d` (identifier), `name`, `description`, `clone` (git URLs), `web` (web URLs), `maintainers` (pubkeys), `relays` (relay URLs), `r` (references/refs), `t` (topics). Content field contains markdown description.

### Package Infrastructure Notes

- **`packages/rig/` already has ATDD stubs** but NO `package.json`, `tsconfig.json`, or `vitest.config.ts`. These must be created from scratch.
- **ESLint currently ignores `packages/rig/`** (documented in project-context.md). This is acceptable during ATDD phase but should be revisited when real code is written. Consider adding ESLint config for rig or removing the ignore.
- **Root `tsconfig.json` excludes `packages/rig`** (documented in project-context.md). The rig package needs its own tsconfig that may not extend root due to DOM lib requirements.
- **Vite is the recommended build tool** for the web app (referenced in test-design-epic-8.md risk E8-R005). It handles bundling, dev server, and asset processing. Do NOT use tsup (server-side tool) for the web app.
- **jsdom for testing** (referenced in test-design-epic-8.md). No headless browser required at this stage.

### Browser Compatibility for @toon-protocol/core

- **CRITICAL CHECK:** `@toon-protocol/core` may use Node.js APIs (e.g., `Buffer`, `fs`, `path`) that are not available in browsers. The Vite build must handle this:
  - If core uses `Buffer`: Vite can polyfill via `buffer` npm package or use `Uint8Array` equivalents.
  - If core imports Node.js-only modules: Vite config must externalize or alias them.
  - Alternative: create a thin browser-compatible wrapper in `packages/rig/src/web/toon-browser.ts` that re-exports only the functions needed (TOON decode, event types) without Node.js dependencies.
- Test the build early (Task 4) to catch browser-incompatibility issues before writing application code.

### ATDD Stub Path Reconciliation

The test-design-epic-8.md references planned ATDD stubs at `packages/rig/src/web/repo-list.test.ts` and `packages/rig/src/web/relay-query.test.ts`, but these files were never created. The actual existing stub is `packages/rig/src/web/templates.test.ts` which covers repo list rendering tests. This story creates the missing test files as specified in the task breakdown (Tasks 12, 16, 17) -- the test-design paths are honored where they exist (`relay-query.test.ts` maps to Task 12, `repo-list.test.ts` coverage is absorbed into `templates.test.ts` per Task 13 since the existing ATDD stubs already live there).

### Existing ATDD Stubs

The following files already exist in `packages/rig/` and should be preserved/updated:
- `src/web/templates.ts` -- stub implementations (throw "not yet implemented"). Update with real code.
- `src/web/templates.test.ts` -- skipped tests with factories. Activate relevant tests, add new ones.
- `src/index.ts` -- stub `startRig()`. May need updating but Forge-UI is a static app, not a server.
- `src/identity/pubkey-identity.ts` / `.test.ts` -- identity stubs (may be useful for profile enrichment).
- `src/handlers/` -- server-side handler stubs (NOT relevant to Forge-UI, which is read-only).
- `src/git/operations.ts` -- git operation stubs (NOT relevant to Forge-UI, which reads from Arweave).
- `src/__integration__/` -- integration test stubs (preserve, update where relevant).

### Anti-Patterns to Avoid

- **DO NOT import `@toon-protocol/sdk`** in the rig package for Forge-UI code. SDK is for service node providers, not static frontends. The rig may import SDK in non-web code (handlers), but Forge-UI web code must only use `@toon-protocol/core`.
- **DO NOT use `nostr-tools` SimplePool.** Known to be broken in some environments. Use raw WebSocket.
- **DO NOT render user content without XSS escaping.** Every string from a Nostr event must be escaped before inserting into HTML.
- **DO NOT use `innerHTML` with unescaped content.** Use `textContent` for plain text, or escape before `innerHTML`.
- **DO NOT add Node.js-only dependencies** to the rig's web code. This is a browser app.
- **DO NOT create a backend/server for Forge-UI.** It must be deployable as static files on Arweave.
- **DO NOT copy Forgejo CSS/templates verbatim.** Create a minimal visual equivalent. Forgejo uses Go templates; Forge-UI uses client-side JS rendering.
- **DO NOT overcomplicate routing.** A simple hash-based router is sufficient for this MVP. No need for a framework like React Router.
- **DO NOT use a frontend framework (React, Vue, Svelte).** Keep it vanilla JS/TS with DOM manipulation. This minimizes bundle size for Arweave hosting and avoids introducing framework complexity into the monorepo.

### Previous Story Intelligence (Story 8.0)

Key learnings from Story 8.0 that apply here:
- **`HandlePacketAcceptResponse` has a `data` field** -- discovered during 8.0 that `publishEvent()` was silently dropping FULFILL data. Fixed by adding `data` to `PublishEventResult`. Forge-UI does not call `publishEvent()` (read-only), but good to know the pattern.
- **Adapter isolation pattern** -- Story 8.0 wrapped `@ardrive/turbo-sdk` behind an interface to isolate the external dependency. Apply the same pattern if Forge-UI needs to wrap relay communication or Arweave fetching behind interfaces for testability.
- **3 code review passes were needed** -- Story 8.0 required 3 review iterations. Anticipate review feedback on XSS prevention, browser compatibility, and test coverage.

### Git Intelligence

Recent commits on `epic-8` branch:
- `fa5e79c feat(8-0): Arweave Storage DVM Provider with chunked uploads` -- Story 8.0 complete
- `82cf038 chore(epic-8): epic start -- baseline green, retro actions resolved`

Pattern: commit messages use `feat(X-Y):` format for story completions.

### Project Structure Notes

- `packages/rig/src/web/` is the Forge-UI web app directory. All new web files go here.
- `packages/rig/src/handlers/`, `src/git/`, `src/identity/` are server-side stubs from ATDD -- NOT part of Forge-UI. Leave them in place but do not modify for this story.
- The rig package is at the "leaf" of the dependency graph: it imports from core (and optionally SDK), but nothing imports from rig.
- The `dist/` output must be a self-contained static site deployable to Arweave (Story 8.6 will upload it via kind:5094).

### Testing Standards

- **Vitest with jsdom** for unit tests. Co-located `*.test.ts` files.
- **No mocking in integration tests.** Integration tests use real DOM rendering (jsdom is acceptable as the "real" environment for a browser app).
- **Test IDs** follow `8.1-UNIT-*` and `8.1-INT-*` scheme from `test-design-epic-8.md`.
- **XSS prevention tests are P0.** The existing ATDD stubs in `templates.test.ts` include XSS tests -- these must pass.

### References

- [Source: _bmad-output/project-context.md#Fully Decentralized Git Architecture]
- [Source: _bmad-output/project-context.md#Technology Stack & Versions]
- [Source: _bmad-output/project-context.md#Project Structure]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.1]
- [Source: _bmad-output/planning-artifacts/test-design-epic-8.md#Story 8.1]
- [Source: _bmad-output/planning-artifacts/test-design-epic-8.md#E8-R005 First Web App in Monorepo]
- [Source: _bmad-output/planning-artifacts/test-design-epic-8.md#E8-R006 NIP-34 TOON Encoding/Decoding]
- [Source: _bmad-output/planning-artifacts/test-design-epic-8.md#Relay Mock Strategy for NIP-34 Events]
- [Source: packages/rig/src/web/templates.ts] -- existing ATDD stubs
- [Source: packages/rig/src/web/templates.test.ts] -- existing ATDD test stubs
- [Source: packages/rig/src/index.ts] -- existing package stub
- [NIP-34 specification: https://github.com/nostr-protocol/nips/blob/master/34.md]
- [NIP-33 (parameterized replaceable events): https://github.com/nostr-protocol/nips/blob/master/33.md]
- [Forgejo visual reference: https://codeberg.org/forgejo/forgejo]
- [Vite documentation: https://vitejs.dev/]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None required.

### Completion Notes List

- **Task 1 (Package Infrastructure):** Created `packages/rig/package.json` with `@toon-protocol/rig`, `"type": "module"`, Vite/Vitest/jsdom dev deps, `@toon-format/toon` dependency. Scripts: build, dev, test, test:integration, test:watch.
- **Task 2 (tsconfig):** Created `packages/rig/tsconfig.json` with `"lib": ["ES2022", "DOM", "DOM.Iterable"]`, `"moduleResolution": "bundler"`. Does not extend root tsconfig (root excludes rig; rig needs DOM libs).
- **Task 3 (Vitest config):** Created `vitest.config.ts` with `environment: 'jsdom'`, excludes `__integration__/`. Created `vitest.integration.config.ts` for web integration tests.
- **Task 4 (Vite config):** Created `vite.config.ts` with root at `src/web/`, output to `dist/`. `@toon-format/toon` is browser-compatible (pure JS, no Node.js APIs) -- no polyfills needed.
- **Task 5 (Entry point):** Created `src/web/index.html` (HTML5 boilerplate, viewport meta, `<div id="app">`) and `src/web/main.ts` (app initialization, routing, relay query orchestration).
- **Task 6 (Relay client):** Created `src/web/relay-client.ts` with `queryRelay()` (raw WebSocket, REQ/EVENT/EOSE protocol), `buildRepoListFilter()`, `buildProfileFilter()`, `decodeToonMessage()` (TOON decode with object passthrough).
- **Task 7 (Profile cache):** Created `src/web/profile-cache.ts` with `ProfileCache` class (caching, deduplication, display name resolution with truncated npub fallback).
- **Task 8 (Repo list renderer):** Updated `src/web/templates.ts` -- replaced stub `renderRepoList()` with full implementation. XSS-escaped all user content. Empty state rendering. Also implemented `renderIssueContent()`, `renderIssuesPage()`, and stub 404 returns for tree/blob/commit/blame views.
- **Task 9 (Layout):** Created `src/web/layout.ts` with `renderLayout()` (header, content area, footer). Created `src/web/styles.css` with Forgejo-inspired clean design (CSS variables, responsive layout, repo cards).
- **Task 10 (Router):** Created `src/web/router.ts` with `parseRelayUrl()`, `parseRoute()`, `navigateTo()`, `initRouter()`. History API based with link click interception.
- **Task 11 (NIP-34 parser):** Created `src/web/nip34-parsers.ts` with `parseRepoAnnouncement()`. Extracts name, description, ownerPubkey, defaultBranch, cloneUrls, webUrls from kind:30617 tags.
- **Tasks 12-18 (Unit tests):** Activated all ATDD stub tests (removed `.skip`). All 40 unit tests pass. XSS prevention tests updated to use DOM-based assertions (verifying no elements created in DOM) rather than substring checks, since HTML-escaped content like `&lt;img onerror=...` safely contains `onerror=` as text.
- **Tasks 19-20 (Integration tests):** Activated all 6 integration tests across 2 files. All pass with jsdom environment.
- **Supporting modules:** Created `src/web/escape.ts` (HTML entity escaping) and `src/web/npub.ts` (pure-JS bech32 npub encoding without external deps).
- **Build verification:** `pnpm install && pnpm build && pnpm test` succeeds. Build produces `dist/index.html` + 18.2K JS + 2.5K CSS. Full monorepo: 2762 passed, 65 skipped (0 failures).

### Change Log

| Date | Summary |
|------|---------|
| 2026-03-22 | Story 8.1 implementation: Forge-UI package infrastructure (Vite build, jsdom tests), relay WebSocket client with TOON decoding, NIP-34 kind:30617 parser, repo list renderer with XSS prevention, profile cache with npub fallback, client-side router, shared layout with Forgejo-inspired CSS. 46 tests (40 unit + 6 integration) all passing. |

### File List

| File | Action |
|------|--------|
| `packages/rig/package.json` | Created |
| `packages/rig/tsconfig.json` | Created |
| `packages/rig/vitest.config.ts` | Created |
| `packages/rig/vitest.integration.config.ts` | Created |
| `packages/rig/vite.config.ts` | Created |
| `packages/rig/src/web/index.html` | Created |
| `packages/rig/src/web/main.ts` | Created |
| `packages/rig/src/web/styles.css` | Created |
| `packages/rig/src/web/escape.ts` | Created |
| `packages/rig/src/web/npub.ts` | Created |
| `packages/rig/src/web/relay-client.ts` | Created |
| `packages/rig/src/web/profile-cache.ts` | Created |
| `packages/rig/src/web/router.ts` | Created |
| `packages/rig/src/web/layout.ts` | Created |
| `packages/rig/src/web/nip34-parsers.ts` | Created |
| `packages/rig/src/web/templates.ts` | Modified |
| `packages/rig/src/web/templates.test.ts` | Modified |
| `packages/rig/src/web/relay-query.test.ts` | Modified |
| `packages/rig/src/web/nip34-parsers.test.ts` | Modified |
| `packages/rig/src/web/profile-cache.test.ts` | Modified |
| `packages/rig/src/web/relay-client.test.ts` | Modified |
| `packages/rig/src/web/router.test.ts` | Modified |
| `packages/rig/src/web/__integration__/repo-list-render.test.ts` | Modified |
| `packages/rig/src/web/__integration__/navigation.test.ts` | Modified |

## Code Review Record

### Review Pass #1

- **Date:** 2026-03-22
- **Reviewer model:** Claude Opus 4.6 (1M context)
- **Issues found:** 7 total
  - Critical: 0
  - High: 1 -- queryRelay Promise double-settle bug fixed
  - Medium: 3 -- profileCache never used (AC#6 violation) fixed, unsafe type cast fixed, test factories missing fields fixed
  - Low: 3 -- CSP meta tag added, TypeScript cast fixed, legacy type reference fixed
- **Outcome:** All 7 issues fixed. Code approved pending verification.

### Review Pass #2

- **Date:** 2026-03-22
- **Reviewer model:** Claude Opus 4.6 (1M context)
- **Issues found:** 8 total
  - Critical: 0
  - High: 1 -- Dead `createMockRepo` factory producing wrong shape (legacy fields instead of RepoMetadata), removed
  - Medium: 3 -- Repo href URL path segments not URI-encoded (URL correctness, not XSS) fixed with `encodeURIComponent`; WebSocket error handler missing underlying error detail fixed; Test factory timestamps using `Date.now()` instead of fixed values (determinism violation) fixed in 3 test files
  - Low: 4 -- `_createMockTreeEntry` dead code retained for future Story 8.2 use (noted, no action); `import.meta.dirname` requires Node 21+ but project uses 24.x locally (noted, no action); `BECH32_CHARSET[d]` theoretically undefined but safe in practice (noted, no action); CSS lacks mobile responsive breakpoints fixed with `@media (max-width: 600px)` rules
- **Outcome:** All actionable issues (7 of 8) fixed. 1 low-severity item (L1: `_createMockTreeEntry`) retained intentionally for Story 8.2. All 87 tests pass (81 unit + 6 integration). Build produces valid static assets (19.8K JS + 2.8K CSS). Zero TypeScript errors in web files.

### Review Pass #3 (Security-Focused)

- **Date:** 2026-03-22
- **Reviewer model:** Claude Opus 4.6 (1M context)
- **Review type:** OWASP Top 10 + security-focused code review with Semgrep scanning
- **Issues found:** 7 total
  - Critical: 0
  - High: 1 -- Relay URL from query param accepted without protocol validation (SSRF/protocol confusion risk). Fixed: `parseRelayUrl()` now validates `ws://`/`wss://` protocol via `isValidRelayUrl()`, falls back to default for invalid URLs. `queryRelay()` also validates before connecting.
  - Medium: 2 -- (M1) `navigateTo()` accepted arbitrary paths including absolute URLs enabling open redirect. Fixed: added path validation rejecting non-`/`-prefixed and `//`-prefixed paths. (M2) External link in issues page contribution banner missing `rel="noopener noreferrer"`. Fixed: added `rel="noopener noreferrer" target="_blank"` to external documentation link.
  - Low: 4 -- (L1) innerHTML usage in main.ts -- analyzed and confirmed safe: all user-supplied content is HTML-escaped before reaching innerHTML via escapeHtml() in templates/layout. Existing XSS test suite confirms no injection vectors. No action needed. (L2) JSON.parse in main.ts -- false positive, already inside try/catch. No action. (L3) JSON.parse in relay-client.ts -- false positive, already inside try/catch. No action. (L4) CSP header already present in index.html restricting script-src to 'self'. No action.
- **Semgrep findings:** 7 raw findings, 3 actionable (fixed), 4 false positives/accepted risks
- **Security coverage:** OWASP A01 (Broken Access Control -- open redirect fixed), A03 (Injection -- XSS prevention verified, relay URL injection fixed), A07 (XSS -- comprehensive escaping confirmed), A08 (Software Integrity -- CSP present), A10 (SSRF -- relay URL validation added)
- **Tests added:** 9 new unit tests for `isValidRelayUrl()`, relay URL rejection of http/javascript protocols, ws:// acceptance
- **Outcome:** All 3 actionable issues fixed. 96 tests pass (90 unit + 6 integration). Build succeeds. Zero regressions.
