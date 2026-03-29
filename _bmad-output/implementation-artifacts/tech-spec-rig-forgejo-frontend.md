---
title: 'Replace Rig Frontend with Forgejo-style Git Forge UI'
slug: 'rig-forgejo-frontend'
created: '2026-03-28'
status: 'completed'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['react-19', 'react-router-v7', 'shadcn-ui-v4', 'tailwind-css-v4', 'shiki', 'vite-5', 'vitest-1', '@testing-library/react', '@toon-format/toon', 'marked-17']
files_to_modify:
  - 'packages/rig/src/web/index.html'
  - 'packages/rig/src/web/main.tsx (rewrite from main.ts)'
  - 'packages/rig/package.json'
  - 'packages/rig/vite.config.ts'
  - 'packages/rig/tsconfig.json'
  - 'packages/rig/components.json (new)'
  - 'packages/rig/src/web/app/ (new)'
  - 'packages/rig/src/web/components/ (new)'
  - 'packages/rig/src/web/hooks/ (new)'
  - 'packages/rig/src/web/lib/ (new - shadcn utils)'
  - 'packages/rig/src/web/globals.css (new - Tailwind base)'
  - 'packages/rig/src/web/rig-pointer-html.ts (update build paths)'
  - 'scripts/deploy-forge-ui.mjs (update build paths)'
code_patterns:
  - 'Data layer: pure TS modules, no framework deps, browser-native APIs only'
  - 'Module-level caches: arweave-client (10k SHA→txId), profile-cache (5k profiles)'
  - 'WebSocket subscriptions: relay-client manages lifecycle per query'
  - 'Async patterns: Promise-based, AbortSignal for timeouts'
  - 'Security: escapeHtml() for all user content, sanitized markdown rendering'
  - 'NIP-34 event kinds: 30617 (repo), 30618 (refs), 1621 (issues), 1617 (PRs), 1622 (comments), 1630-1633 (PR status)'
  - 'Git objects: Uint8Array parsing, TextDecoder, no Node.js Buffer'
test_patterns:
  - 'Framework: Vitest + React Testing Library (unit), Playwright (E2E)'
  - 'Naming: [P0/P1/P2] priority prefix, Test IDs in comments'
  - 'Factory functions for test data'
  - 'Fake timers: vi.useFakeTimers() for deterministic dates'
  - 'Security tests: XSS prevention in every component rendering user content'
  - 'RTL tests use pre-fetched data as props (no WebSocket in jsdom). E2E tests use real infra (no mocks).'
---

# Tech-Spec: Replace Rig Frontend with Forgejo-style Git Forge UI

**Created:** 2026-03-28

## Overview

### Problem Statement

The current Rig frontend is a vanilla TypeScript SPA with 40KB of HTML string concatenation in a single `templates.ts` file and a 47KB monolith dispatcher in `main.ts`. It lacks visual polish, proper component architecture, and key forge features (open/closed issue tabs, syntax highlighting, responsive layout, loading states). It needs to match the professional quality of Forgejo/Codeberg's git forge UI.

### Solution

Replace the rendering layer with React 19 + shadcn-ui v4 + Tailwind CSS, keeping the existing data layer (relay-client, arweave-client, git-objects, nip34-parsers) intact and wrapping it as React hooks. Visually replicate Forgejo's layout patterns using shadcn components. Use real local TOON infrastructure (relay on port 7100, BLS on port 3100) and Arweave gateways for all data — no mocks.

### Scope

**In Scope:**
- All read-only forge views: repo list, code browser, file viewer, commit log, commit detail, blame, issues (open/closed tabs), PRs (open/closed tabs + diff), comments on issues/PRs
- Syntax highlighting via Shiki
- Skeleton loading states for all async data
- Dark mode support (shadcn built-in)
- Responsive/mobile layout
- Arweave deployment compatibility (static SPA, relative base `./`)
- Standardized routes: `/:owner/:repo/...` (owner = npub)
- `window.__RIG_CONFIG__` bootstrap for relay URL + repo filter
- React Testing Library for component tests (fresh test suite)

**Out of Scope:**
- Write operations (creating issues/PRs/comments)
- Authentication UI / user registration / login
- Wiki, releases, packages, actions/CI, admin panels
- Search (NIP-50)
- Activity feeds / heatmaps
- Short-form routes (`/:repo/...` without owner)

## Context for Development

### Codebase Patterns

**Data Layer Architecture (keep as-is):**
- All 15 data layer files are pure TypeScript, browser-native (no Node.js deps). (`rig-pointer-html.ts` is build-time only, not data layer.)
- Browser APIs used: WebSocket, fetch + AbortSignal.timeout, TextDecoder, Uint8Array
- Module-level caches: `arweave-client.ts` (10k SHA→txId Map), `profile-cache.ts` (5k ProfileData Map + 10k requested Set)
- Cache eviction: LRU (oldest entry removed when max size hit)
- Async: Promise-based with timeouts (relay: 10s, Arweave: 15s)

**Security Patterns (must preserve):**
- `escapeHtml()` for all user-facing text content
- `renderMarkdownSafe()` for user comments (regex-based, no external parser)
- `renderMarkdown()` for READMEs (marked v17 with 60+ allowed tags, dangerous tag/URL blocklist)
- `sanitizeGraphQLValue()` for Arweave GraphQL queries
- `isValidRelayUrl()` for relay URL validation
- CSP headers in pointer HTML (blocks unsafe-eval, allows specific gateways)

**NIP-34 Event Kinds:**
- kind:30617 = repository announcement (d tag, name, description, clone URLs)
- kind:30618 = repository refs (branch→SHA mappings, arweave tag SHA→txId bypass)
- kind:1621 = issues (subject tag for title, t tags for labels)
- kind:1617 = patches/PRs (commit SHAs, base branch)
- kind:1622 = comments (e tag for parent event)
- kind:1630-1633 = PR status events (open/applied/closed/draft)

**Dependency Tree (leaf-first):**
```
escape.ts (no deps)
npub.ts (no deps)
date-utils.ts (no deps)
git-objects.ts (no deps)
unified-diff.ts (no deps)
nip34-parsers.ts (no deps)
arweave-client.ts (no deps)
tree-diff.ts → git-objects
profile-cache.ts → npub
ref-resolver.ts → nip34-parsers
markdown-safe.ts → escape
markdown-renderer.ts → marked, escape
relay-client.ts → @toon-format/toon, nip34-parsers, router.ts (isValidRelayUrl)
commit-walker.ts → git-objects, arweave-client
blame.ts → git-objects, arweave-client
rig-pointer-html.ts (no deps — build-time only, not data layer)
```

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `packages/rig/src/web/relay-client.ts` | WebSocket relay queries, TOON decoding, filter builders |
| `packages/rig/src/web/arweave-client.ts` | Arweave gateway fetch, SHA→txId resolution, cache |
| `packages/rig/src/web/git-objects.ts` | Parse tree/commit/blob Uint8Array, binary detection |
| `packages/rig/src/web/nip34-parsers.ts` | Parse repo/refs/issue/PR/comment Nostr events |
| `packages/rig/src/web/blame.ts` | Line-by-line blame via commit chain walk |
| `packages/rig/src/web/unified-diff.ts` | LCS-based unified diff (10k line / 25M product limit) |
| `packages/rig/src/web/commit-walker.ts` | Walk first-parent commit chain (default 50 depth) |
| `packages/rig/src/web/profile-cache.ts` | Kind:0 profile cache with dedup, LRU eviction |
| `packages/rig/src/web/npub.ts` | Bech32 npub encoding, truncation for display |
| `packages/rig/src/web/ref-resolver.ts` | Resolve default branch from repo metadata + refs |
| `packages/rig/src/web/date-utils.ts` | Relative date formatting (unix seconds → "5 min ago") |
| `packages/rig/src/web/escape.ts` | HTML entity escaping (& < > " ') |
| `packages/rig/src/web/markdown-renderer.ts` | GFM rendering for READMEs (marked + sanitization) |
| `packages/rig/src/web/markdown-safe.ts` | Safe markdown subset for user comments (regex-based) |
| `packages/rig/src/web/tree-diff.ts` | Flat tree-to-tree diff (added/deleted/modified) |
| `packages/rig/src/web/rig-pointer-html.ts` | Arweave pointer HTML shell with window.__RIG_CONFIG__ |

### Technical Decisions

- **Framework**: React 19 (required by shadcn-ui v4)
- **Router**: React Router v7 with standardized `/:owner/:repo/...` routes
- **UI Library**: shadcn-ui v4 + Tailwind CSS v4 (mandated by CLAUDE.md)
- **Syntax Highlighting**: Shiki (lightweight, works with React, WASM-based)
- **Bootstrap**: Continue using `window.__RIG_CONFIG__` for relay URL + repo filter
- **Data Layer**: Keep 100% of existing TS modules, wrap as React hooks
- **Delete**: `templates.ts` (40KB), `main.ts` (47KB), `styles.css` (29KB), `layout.ts` (1KB). **Note:** `router.ts` cannot be fully deleted — `isValidRelayUrl()` must be extracted to a new `url-utils.ts` file first since `relay-client.ts` imports it. Only delete `router.ts` after extraction.
- **Testing**: Fresh Vitest + React Testing Library suite; Playwright for E2E
- **No Mocks**: All tests use real local TOON genesis infra (relay ws://localhost:7100) + real Arweave gateways

### React Hooks to Create

| Hook | Wraps | State |
|---|---|---|
| `useRigConfig()` | window.__RIG_CONFIG__ | relayUrl, repoFilter, owner |
| `useRepoList()` | queryRelay + buildRepoListFilter + parseRepoAnnouncement | repos[], loading, error |
| `useRepo(owner, repo)` | queryRelay + parseRepoAnnouncement + parseRepoRefs | metadata, refs, loading, error |
| `useGitTree(sha, repo)` | resolveGitSha + fetchArweaveObject + parseGitTree | entries[], loading, error |
| `useGitBlob(sha, repo)` | resolveGitSha + fetchArweaveObject | data (Uint8Array), loading, error |
| `useCommitLog(startSha, repo)` | walkCommitChain | entries[], loading, hasMore |
| `useCommitDetail(sha, repo)` | Multi-step orchestration (see note below table) | commit, changedFiles[], loading, error |
| `useBlame(filePath, startSha, repo)` | computeBlame | lines[], fileContent, loading, error |
| `useIssues(owner, repo)` | queryRelay + buildIssueListFilter + parseIssue | issues[], loading, error |
| `usePRs(owner, repo)` | queryRelay + buildPRListFilter + parsePR + resolvePRStatus | prs[], loading, error |
| `useComments(eventIds)` | queryRelay + buildCommentFilter + parseComment | comments[], loading |
| `useProfileCache()` | ProfileCache singleton | getDisplayName(), loading |

**`useCommitDetail` orchestration:** This hook requires multi-step async work: (1) resolve commit SHA → fetch commit object from Arweave → `parseGitCommit()`, (2) extract parent SHA from commit, (3) fetch parent commit → get parent tree SHA, (4) fetch both root trees → `parseGitTree()`, (5) run `diffTrees()` to identify changed/added/deleted files, (6) for each changed file, lazy-fetch old+new blobs from Arweave (2 fetches per file), (7) run `computeUnifiedDiff()` on each text pair. This is 2N+4 Arweave fetches for N changed files. The hook should return `changedFiles[]` where each entry has `{ name, status, oldSha, newSha }`. Diff computation should be lazy — triggered when a file's collapsible section is expanded, not all upfront. Consider a sub-hook `useFileDiff(oldSha, newSha, repo)`.

### Forgejo Source Reference

Verified from codeberg.org/forgejo/forgejo API:
- 23 Vue components in `web_src/js/components/`
- Go templates in `templates/repo/` define page layouts
- CSS: `repo.css` (62KB), `base.css` (29KB) — Fomantic UI + Tailwind utilities

### shadcn Components

tabs, table, badge, button, dropdown-menu, command, breadcrumb, avatar, card, pagination, separator, scroll-area, skeleton, tooltip, collapsible, select, toggle-group, popover

### Component Architecture

```
App
├── AppLayout (TopNav + Outlet)
├── RepoLayout (RepoHeader + RepoTabs + RepoSidebar + Outlet)
└── Routes:
    ├── / → RepoListPage
    ├── /:owner/:repo → RepoHomePage
    ├── /:owner/:repo/tree/:ref/* → TreePage (access path via useParams()["*"])
    ├── /:owner/:repo/blob/:ref/* → BlobPage (access path via useParams()["*"])
    ├── /:owner/:repo/commits/:ref → CommitLogPage
    ├── /:owner/:repo/commit/:sha → CommitDetailPage
    ├── /:owner/:repo/blame/:ref/* → BlamePage (access path via useParams()["*"])
    ├── /:owner/:repo/issues → IssueListPage
    ├── /:owner/:repo/issues/:id → IssueDetailPage
    ├── /:owner/:repo/pulls → PRListPage
    └── /:owner/:repo/pulls/:id → PRDetailPage
```

### Forgejo → shadcn Component Mapping

| Forgejo Source | React Component | shadcn Parts |
|---|---|---|
| header.tmpl | RepoHeader + RepoTabs | tabs, badge, avatar, breadcrumb |
| RepoBranchTagSelector.vue | BranchSelector | command, popover, badge |
| view_list.tmpl | FileTree | table, skeleton |
| view_file.tmpl | FileViewer | scroll-area, breadcrumb |
| issue/list.tmpl + openclose.tmpl | IssueList | table, toggle-group, pagination, badge |
| issue/view_title.tmpl + view_content.tmpl | IssueDetail | card, avatar, separator, badge |
| diff/section_unified.tmpl | UnifiedDiff | collapsible, table |
| commits.tmpl + commits_table.tmpl | CommitLog | table, avatar, pagination |
| DiffFileTree.vue | DiffFileTree | collapsible, badge |

## Implementation Plan

### Tasks

#### Phase 1: Scaffolding (foundation — all other phases depend on this)

- [ ] Task 1: Install React and build tooling
  - File: `packages/rig/package.json`
  - Action: Add react, react-dom, react-router, @vitejs/plugin-react, @types/react, @types/react-dom, tailwindcss, **@tailwindcss/vite**, clsx, tailwind-merge, @testing-library/react, @testing-library/jest-dom, shiki
  - Notes: Run `pnpm install` after updating. Keep existing deps (marked, @toon-format/toon, vite, vitest). **Tailwind CSS v4 requires `@tailwindcss/vite` plugin** — there is no `tailwind.config.js` in v4. Configuration is CSS-first via `@import "tailwindcss"` in `globals.css`. `clsx` + `tailwind-merge` are needed for shadcn's `cn()` utility.

- [ ] Task 2: Configure Vite for React + Tailwind v4
  - File: `packages/rig/vite.config.ts`
  - Action: Add `@vitejs/plugin-react` AND `@tailwindcss/vite` to plugins array. Keep base `./` and root `src/web`.
  - Notes: Tailwind v4 uses a Vite plugin (`@tailwindcss/vite`) instead of PostCSS. Ensure build output path unchanged for Arweave deploy compatibility.

- [ ] Task 3: Configure TypeScript for JSX
  - File: `packages/rig/tsconfig.json`
  - Action: Add `"jsx": "react-jsx"` to compilerOptions. **Update `include` array** to add `"src/**/*.tsx"` and `"tests/**/*.tsx"` alongside existing `"src/**/*.ts"` patterns. Add `"paths": { "@/*": ["./src/web/*"] }` for shadcn alias. Keep all existing strict flags.
  - Notes: Without `.tsx` in the include pattern, TypeScript will not compile any React component files. Data layer `.ts` files remain unchanged.

- [ ] Task 4: Initialize shadcn-ui v4 with explicit config
  - File: `packages/rig/components.json` (new), `packages/rig/src/web/lib/utils.ts` (new), `packages/rig/src/web/globals.css` (new)
  - Action: **Do NOT run `npx shadcn@latest init` interactively** — the non-standard Vite root (`src/web/`) will confuse it. Instead, manually create `components.json` with these paths:
    ```json
    {
      "$schema": "https://ui.shadcn.com/schema.json",
      "style": "new-york",
      "rsc": false,
      "tsx": true,
      "aliases": {
        "components": "@/components",
        "utils": "@/lib/utils",
        "ui": "@/components/ui",
        "lib": "@/lib",
        "hooks": "@/hooks"
      },
      "tailwind": {
        "config": "",
        "css": "src/web/globals.css",
        "baseColor": "zinc"
      }
    }
    ```
    Configure tsconfig paths: `"@/*": ["./src/web/*"]`. Create `src/web/lib/utils.ts` with the `cn()` utility (clsx + tailwind-merge). Create `src/web/globals.css` with `@import "tailwindcss"` (Tailwind v4 CSS-first config).
  - Notes: Use `get_component_demo` MCP tool before implementing each shadcn component. The `@/` alias maps to `src/web/` because that is the source root.

- [ ] Task 5: Install core shadcn components
  - File: `packages/rig/src/web/components/ui/` (new dir with component files)
  - Action: Run `npx shadcn@latest add tabs table badge button dropdown-menu command breadcrumb avatar card pagination separator scroll-area skeleton tooltip collapsible select toggle-group popover`
  - Notes: This installs the 18 base components needed for the forge UI.

- [ ] Task 6: Create React app entry point
  - File: `packages/rig/src/web/main.tsx` (new), `packages/rig/src/web/index.html` (update)
  - Action: Create `main.tsx` with React 19 createRoot, **HashRouter** (NOT BrowserRouter), route definitions, and RigConfigProvider context. Update `index.html` to import `main.tsx` instead of `main.ts`. Add Tailwind CSS import (`globals.css`). Update CSP in `index.html` to add `'wasm-unsafe-eval'` to `script-src` directive (required for Shiki WASM).
  - Notes: **Must use HashRouter** — Arweave gateways serve static files with no server-side routing. Direct navigation to `/:owner/:repo/issues` would 404 with BrowserRouter. HashRouter uses `#/owner/repo/issues` which works on any static host.

- [ ] Task 7: Create useRigConfig hook, context, and npub decode utility
  - File: `packages/rig/src/web/hooks/use-rig-config.ts` (new), `packages/rig/src/web/npub.ts` (update)
  - Action: Create React context + provider that reads `window.__RIG_CONFIG__` (relay, repo, owner). Export `useRigConfig()` hook. **Add `npubToHex()` function to `npub.ts`** — the reverse of `hexToNpub()`. This is needed because routes use npub format but relay filters require hex pubkeys. The existing `npub.ts` only has hex→npub, not npub→hex. Implementation requires: (1) reverse character lookup from `BECH32_CHARSET`, (2) `bech32VerifyChecksum()` using the existing polymod function, (3) `convertBits(data, 5, 8, false)` — the existing `convertBits()` already handles both directions but the `pad=false` path must validate trailing bits, (4) input validation: verify `npub1` prefix, check length limits, reject mixed case. Must throw on invalid input — do not silently return garbage.
  - Notes: This is the bootstrap mechanism — all other hooks depend on relayUrl from this. Route params will have npub-format owners that must be decoded to hex for relay queries.

- [ ] Task 8: Create core data hooks
  - File: `packages/rig/src/web/hooks/use-relay.ts`, `use-repo.ts`, `use-repo-list.ts`, `use-git-tree.ts`, `use-git-blob.ts`, `use-profile-cache.ts` (all new)
  - Action: Create hooks wrapping existing data layer functions. Each hook manages loading/error state and AbortController for cleanup on unmount. **`useRepoList()`** must filter by owner hex pubkey if `window.__RIG_CONFIG__.owner` is set — add `authors: [ownerHex]` to the filter passed to `queryRelay()`. If no owner is configured, show all repos. **`useProfileCache()`** must use a **module-level singleton** (not useRef per component) — create the `ProfileCache` instance at module scope and export a hook that reads from it. Wrap in a React context provider at the app root so all components share one cache instance. **Profile fetching is progressive enhancement:** render truncated npub immediately, then batch-fetch profiles via `useEffect` and swap in display names when they arrive. Never block rendering on profile resolution.
  - Notes: Import data layer as `.js` (existing ESM convention). Hooks return `{ data, loading, error }` pattern. `useRepo(owner, repo)` must decode npub owner to hex via `npubToHex()` before building relay filters.

- [ ] Task 9: Create AppLayout and TopNav
  - File: `packages/rig/src/web/app/app-layout.tsx` (new), `packages/rig/src/web/components/top-nav.tsx` (new)
  - Action: AppLayout renders TopNav + React Router Outlet. TopNav shows TOON Forge branding (matching Forgejo's top bar layout without sign-in/register since read-only). Use shadcn `button` for navigation links.
  - Notes: Match Forgejo's blue top navigation bar. No auth buttons.

- [ ] Task 10: Verify scaffolding builds, renders, and test pipeline works
  - Action: Run `pnpm build` and `pnpm dev` in packages/rig. Verify the app renders TopNav with "TOON Forge" branding. Verify Vite HMR works. **Write one smoke test**: an RTL test that renders `AppLayout` with a mocked `RigConfigProvider` and asserts the TopNav text appears. Run `pnpm test` to verify the Vitest + RTL pipeline works end-to-end.
  - Notes: This is a gate — do not proceed to Phase 2 until build AND test pipeline work. Discovering a broken test setup in Phase 4 is costly.

#### Phase 2: Code Browser (core forge experience)

- [ ] Task 11: Create RepoLayout with header and tabs
  - File: `packages/rig/src/web/app/repo-layout.tsx` (new), `packages/rig/src/web/components/repo-header.tsx` (new), `packages/rig/src/web/components/repo-tabs.tsx` (new)
  - Action: RepoLayout uses `useRepo()` hook to fetch repo metadata + refs. RepoHeader shows owner (truncated npub) / repo name as breadcrumb, description, topic badges. RepoTabs uses shadcn `tabs` with Code | Issues | PRs | Commits labels and count badges.
  - Notes: Match Forgejo's `header.tmpl` layout exactly — breadcrumb path, description below, topic pills, tab bar with counts.

- [ ] Task 12: Create BranchSelector
  - File: `packages/rig/src/web/components/branch-selector.tsx` (new)
  - Action: Searchable branch/tag dropdown using shadcn `popover` + `command`. Lists all refs from useRepo() hook. Shows current branch name in trigger button with git-branch icon.
  - Notes: Match Forgejo's `RepoBranchTagSelector.vue` — searchable input, branch/tag toggle, current selection highlighted.

- [ ] Task 13: Create RepoListPage
  - File: `packages/rig/src/web/app/pages/repo-list-page.tsx` (new), `packages/rig/src/web/components/repo-card.tsx` (new)
  - Action: Uses `useRepoList()` hook. Renders shadcn `card` grid — each card shows repo name, description, owner npub, topic badges. Skeleton loading state while fetching. Links to `/:owner/:repo`.
  - Notes: Match Forgejo's org repo list layout (from snapshot). Cards with description + topics + last updated.

- [ ] Task 14: Create RepoHomePage with FileTree
  - File: `packages/rig/src/web/app/pages/repo-home-page.tsx` (new), `packages/rig/src/web/components/file-tree.tsx` (new), `packages/rig/src/web/components/repo-sidebar.tsx` (new)
  - Action: RepoHomePage resolves default branch via `resolveDefaultRef()`, fetches root tree via `useGitTree()`. FileTree renders shadcn `table` with icon column (folder/file icons), name, last commit message (placeholder), age. RepoSidebar shows commits/branches/tags counts and language bar (if available). Renders README below file tree using `renderMarkdown()`.
  - Notes: Match Forgejo's `view_list.tmpl` + `home.tmpl`. File icons: folder for mode 40000, file for others. README rendered with full markdown sanitization.

- [ ] Task 15: Create TreePage (subdirectory browsing)
  - File: `packages/rig/src/web/app/pages/tree-page.tsx` (new)
  - Action: Reuses FileTree component. Adds breadcrumb path navigation using shadcn `breadcrumb`. Handles path parameter from route. Shows ".." parent directory entry.
  - Notes: Path walking: resolve tree SHA → walk each path segment → fetch subtree.

- [ ] Task 16: Create BlobPage (file viewer) with optimized Shiki
  - File: `packages/rig/src/web/app/pages/blob-page.tsx` (new), `packages/rig/src/web/components/file-viewer.tsx` (new), `packages/rig/src/web/lib/highlighter.ts` (new)
  - Action: Uses `useGitBlob()` hook. FileViewer shows file path breadcrumb, file size, line count. For text: syntax highlight with Shiki + line numbers. For binary: "Binary file not shown" message. Uses `isBinaryBlob()` from git-objects. **Create `highlighter.ts` that lazy-loads Shiki with a limited grammar set** — only load grammars for: javascript, typescript, json, html, css, markdown, python, go, rust, yaml, bash, sql, toml. Use `createHighlighterCore()` from `shiki/core` with individual grammar imports from `shiki/langs/*.mjs` (NOT `@shikijs/langs` — that's the old package name). Example: `import js from 'shiki/langs/javascript.mjs'`. Use `createOnigurumaEngine` from `shiki/engine/oniguruma` for the WASM engine. This reduces the bundle from ~15MB to ~2MB. Load the highlighter lazily on first use (not at app startup).
  - Notes: Detect language from file extension mapping. Fallback to plain text if no grammar matches. Match Forgejo's `view_file.tmpl` layout. CSP in `index.html` must include `'wasm-unsafe-eval'` for Shiki's oniguruma WASM (handled in Task 6).

- [ ] Task 17: Verify code browser with real data
  - Action: Start genesis node (`./deploy-genesis-node.sh`). Navigate to `http://localhost:5173`. Verify: repo list loads from relay, clicking repo shows file tree from Arweave, clicking file shows syntax-highlighted content.
  - Notes: Gate check — all data must come from real relay + Arweave. No mocks.

#### Phase 3: Git History

- [ ] Task 18: Create commit detail hook (multi-step orchestration)
  - File: `packages/rig/src/web/hooks/use-commit-detail.ts` (new)
  - Action: Implement the multi-step orchestration described in the hooks table: (1) fetch+parse commit, (2) fetch+parse parent commit, (3) fetch both root trees, (4) `diffTrees()` to find changed files, (5) for each changed file, lazy-fetch old+new blobs on demand, (6) `computeUnifiedDiff()` per file pair. Return `{ commit, changedFiles, loading, error }` where `changedFiles` has `{ name, status, oldSha, newSha }`. Diff computation should be lazy — triggered when a file's collapsible section is expanded, not all at once.
  - Notes: This is the most complex hook. 2N+4 Arweave fetches for N files. Use AbortController for cleanup. Consider a sub-hook `useFileDiff(oldSha, newSha, repo)` that individual collapsible sections call.

- [ ] Task 19: Create blame hook
  - File: `packages/rig/src/web/hooks/use-blame.ts` (new)
  - Action: Wrap `computeBlame()`. Return `{ lines, fileContent, beyondLimit, loading, error }`. Use AbortController for cleanup on unmount.
  - Notes: Default maxDepth 50. `computeBlame` already handles the full walk internally.

- [ ] Task 20: Create commit log hook
  - File: `packages/rig/src/web/hooks/use-commit-log.ts` (new)
  - Action: Wrap `walkCommitChain()`. Returns `{ entries, loading, hasMore }`. Support pagination by tracking last SHA.
  - Notes: Default depth 50. Parse author idents with `parseAuthorIdent()`.

- [ ] Task 21: Create CommitLogPage
  - File: `packages/rig/src/web/app/pages/commit-log-page.tsx` (new), `packages/rig/src/web/components/commit-list.tsx` (new)
  - Action: CommitList renders shadcn `table` grouped by date. Each row: author avatar (from profile cache), commit message (truncated), SHA (7-char link), relative date. Uses shadcn `avatar` with fallback to initials.
  - Notes: Match Forgejo's `commits_table.tmpl`. Group commits by day. Truncate message at first newline.

- [ ] Task 22: Create CommitDetailPage
  - File: `packages/rig/src/web/app/pages/commit-detail-page.tsx` (new), `packages/rig/src/web/components/commit-header.tsx` (new)
  - Action: Uses `useCommitDetail()` hook. Shows commit message, author/committer, parent SHAs, diff stats. Renders unified diff using existing `computeUnifiedDiff()`. Diff sections in shadcn `collapsible` per file.
  - Notes: Match Forgejo's `commit_header.tmpl` + `diff/section_unified.tmpl`. Green/red line coloring for add/delete.

- [ ] Task 23: Create BlamePage
  - File: `packages/rig/src/web/app/pages/blame-page.tsx` (new), `packages/rig/src/web/components/blame-view.tsx` (new)
  - Action: Uses `useBlame()` hook. Renders table with blame gutter (commit SHA, author, date) and code content with line numbers + Shiki highlighting. Alternating background for different commit blocks.
  - Notes: Match Forgejo's `blame.tmpl`. Show "beyond limit" indicator if maxDepth reached.

#### Phase 4: Issues & PRs

- [ ] Task 24: Create issue/PR data hooks and `resolveIssueStatus()`
  - File: `packages/rig/src/web/hooks/use-issues.ts`, `use-prs.ts`, `use-comments.ts` (all new), `packages/rig/src/web/nip34-parsers.ts` (update)
  - Action: **First, create `resolveIssueStatus()` in `nip34-parsers.ts`**: An issue is closed if ANY kind:1632 event has an `e` tag referencing its event ID; otherwise it is open. This is simpler than `resolvePRStatus()` which checks four kinds (1630-1633). Then create hooks: `useIssues()` fetches kind:1621 events + kind:1632 status-close events (via `buildIssueCloseFilter()`), calls `resolveIssueStatus()` for each issue. **WARNING:** `parseIssue()` hardcodes `status: 'open'` — the hook must override this with the resolved status. `usePRs()` fetches kind:1617 + kind:1630-1633 status events and uses existing `resolvePRStatus()`. `useComments()` fetches kind:1622 for given event IDs.
  - Notes: **Do NOT use kind:5 (NIP-09 deletion) for issue close detection.** The codebase uses kind:1632 via `buildIssueCloseFilter()` in `relay-client.ts`.

- [ ] Task 25: Create IssueListPage
  - File: `packages/rig/src/web/app/pages/issue-list-page.tsx` (new), `packages/rig/src/web/components/issue-list.tsx` (new), `packages/rig/src/web/components/open-close-toggle.tsx` (new)
  - Action: OpenCloseToggle uses shadcn `toggle-group` — "N Open" / "N Closed" buttons matching Forgejo's `openclose.tmpl`. IssueList renders shadcn `table` — each row: status icon (green open / red closed), title as link, label badges, author npub, relative date, comment count. Shadcn `pagination` at bottom.
  - Notes: Match Forgejo's `issue/list.tmpl` exactly. Label badges use colored shadcn `badge` components.

- [ ] Task 26: Create IssueDetailPage
  - File: `packages/rig/src/web/app/pages/issue-detail-page.tsx` (new), `packages/rig/src/web/components/comment-thread.tsx` (new)
  - Action: Shows issue title with status badge (open/closed), author, creation date. CommentThread renders each comment as shadcn `card` with avatar, author npub, relative date, and content rendered via `renderMarkdownSafe()`. Original issue content is the first "comment".
  - Notes: Match Forgejo's `issue/view_title.tmpl` + `view_content.tmpl`. Separator between comments.

- [ ] Task 27: Create PRListPage
  - File: `packages/rig/src/web/app/pages/pr-list-page.tsx` (new)
  - Action: Reuses OpenCloseToggle and same table pattern as IssueList. Status badges: open (green), applied/merged (purple), closed (red), draft (grey). Shows base branch target.
  - Notes: PR status resolved via `resolvePRStatus()` from kind:1630-1633 events.

- [ ] Task 28: Create PRDetailPage
  - File: `packages/rig/src/web/app/pages/pr-detail-page.tsx` (new)
  - Action: Similar to IssueDetailPage but adds a "Files Changed" tab showing unified diff of PR commits. Uses shadcn `tabs` for Conversation / Files Changed views. Diff rendered same as CommitDetailPage.
  - Notes: Match Forgejo's `pulls/tab_menu.tmpl` — Conversation and Files Changed tabs.

- [ ] Task 29: Verify issues and PRs with real data
  - Action: Ensure genesis node has issues and PRs (kind:1621, kind:1617 events). Navigate through issue list → issue detail → comments. Navigate PR list → PR detail → diff tab.
  - Notes: If no issues/PRs exist on relay, create test events using ToonClient before verification.

#### Phase 5: Polish

- [ ] Task 30: Add skeleton loading states and empty states
  - File: All page components
  - Action: Add shadcn `skeleton` components for every async data load. File tree rows, commit entries, issue cards, blob content — all show skeletons while loading. **Also add empty states** for when data returns successfully but is empty: RepoListPage ("No repositories found. Check that your relay is running at [relay URL]"), IssueListPage ("No issues found"), PRListPage ("No pull requests found"), CommitLogPage ("No commits found"). Empty states should include the relay URL from config so users can debug connection issues.
  - Notes: Use consistent skeleton shapes matching the final rendered content dimensions. Empty states are critical for first-time users and debugging.

- [ ] Task 31: Add dark mode support
  - File: `packages/rig/src/web/globals.css`, `packages/rig/src/web/components/theme-toggle.tsx` (new)
  - Action: Add dark mode CSS variables (shadcn built-in). Add theme toggle button in TopNav. Persist preference in localStorage.
  - Notes: shadcn-ui v4 has built-in dark mode support via CSS variables. Use `class` strategy (add `dark` class to `<html>`).

- [ ] Task 32: Responsive layout
  - File: All layout and page components
  - Action: Add Tailwind responsive breakpoints. Mobile: stack sidebar below content, collapse tabs to dropdown, reduce table columns. Tablet: sidebar as collapsible sheet.
  - Notes: Test at 375px (mobile), 768px (tablet), 1024px+ (desktop).

- [ ] Task 33: Extract `isValidRelayUrl` and delete old rendering layer
  - Files: `packages/rig/src/web/templates.ts`, `packages/rig/src/web/main.ts`, `packages/rig/src/web/router.ts`, `packages/rig/src/web/styles.css`, `packages/rig/src/web/layout.ts`
  - Action: **BEFORE deleting `router.ts`**: Extract `isValidRelayUrl()` to a new `packages/rig/src/web/url-utils.ts` file. Update `relay-client.ts` import from `./router.js` to `./url-utils.js`. Verify `relay-client.ts` still passes its existing tests. THEN delete `templates.ts`, `main.ts`, `router.ts`, `styles.css`, `layout.ts`. Remove old integration tests in `src/web/__integration__/` that test deleted template functions. Keep all data layer files and their existing unit tests.
  - Notes: Do this AFTER Phase 4 is verified working. The extraction of `isValidRelayUrl` is critical — `relay-client.ts` imports it from `router.ts` and will break without it.

- [ ] Task 34: Update Arweave deploy scripts
  - File: `packages/rig/src/web/rig-pointer-html.ts`, `scripts/deploy-forge-ui.mjs`
  - Action: Update build output paths referenced in pointer HTML generation and deploy script to match new React build output (likely `dist/assets/index-[hash].js` and `dist/assets/index-[hash].css`).
  - Notes: Verify pointer HTML still generates valid CSP headers for React app.

- [ ] Task 35: Write React component tests
  - File: `packages/rig/src/web/__tests__/` (new directory)
  - Action: Create React Testing Library tests for key components: RepoListPage, FileTree, IssueList (with open/closed toggle), BranchSelector, CommentThread. **Pass pre-fetched data as props** — do NOT call relay/Arweave from RTL tests (jsdom has no WebSocket). Create factory functions: `createRepoMetadata()`, `createTreeEntry()`, `createIssueMetadata()`, `createCommentMetadata()`, etc. Test XSS prevention in markdown rendering components by passing malicious content and asserting no script execution.
  - Notes: Follow convention: [P0/P1/P2] priority prefix, factory functions. RTL tests verify rendering + interactions. Real infra testing is in Playwright E2E (Task 36).

- [ ] Task 36: Write Playwright E2E tests
  - File: `packages/rig/tests/e2e/` (update existing)
  - Action: E2E flows: (1) repo list → repo home → file tree → file view, (2) repo → issues tab → open/closed toggle → issue detail → comments, (3) repo → commits tab → commit detail → diff. Run against genesis infra. **Add a prerequisite health check** at the top of the test suite: `curl http://localhost:3100/health` must return 200 before any tests run. Fail fast with a clear message ("Genesis node not running — run ./deploy-genesis-node.sh first") if health check fails.
  - Notes: Use existing Playwright config. Target dev server connected to real relay. Priority: [P0] XSS tests, [P1] core navigation flows, [P2] edge cases (binary files, blame depth limits).

### Acceptance Criteria

- [ ] AC 1: Given the genesis node is running with repos published, when navigating to `/`, then a grid of repository cards loads from the relay showing repo name, description, owner npub, and topic badges — with skeleton loading state while fetching.

- [ ] AC 2: Given a repo card is clicked, when the repo home page loads, then the file tree displays from Arweave data with folder/file icons, file names, and the README renders below with full markdown (images, tables, code blocks) — matching Forgejo's repo home layout.

- [ ] AC 3: Given the repo home page is displayed, when the branch selector dropdown is opened, then all branches from kind:30618 refs are listed in a searchable command palette, and selecting a branch reloads the file tree for that ref.

- [ ] AC 4: Given a file is clicked in the tree, when the blob page loads, then the file content is syntax-highlighted via Shiki with line numbers, file size displayed, and breadcrumb path shown — matching Forgejo's file viewer layout.

- [ ] AC 5: Given a binary file is encountered, when the blob page renders, then "Binary file not shown" is displayed instead of attempting to render content.

- [ ] AC 6: Given the Commits tab is clicked, when the commit log loads, then commits display in a table grouped by date with author avatar, truncated message, 7-char SHA link, and relative timestamp — all data from Arweave commit objects.

- [ ] AC 7: Given a commit SHA is clicked, when the commit detail page loads, then the full commit message, author/committer info, and unified diff are displayed with green/red line coloring in collapsible file sections.

- [ ] AC 8: Given the blame view is accessed for a file, when blame data loads, then each line shows the commit SHA, author, and date in a gutter alongside syntax-highlighted code — with alternating backgrounds per commit block.

- [ ] AC 9: Given the Issues tab is clicked, when the issue list loads, then issues display with open/closed toggle (showing counts), status icons (green/red), title, label badges, author npub, date, and comment count — matching Forgejo's issue list layout.

- [ ] AC 10: Given an issue is clicked, when the issue detail page loads, then the title with status badge, original content, and all comments render as a threaded timeline with author avatars, npub display names, relative dates, and safe markdown content.

- [ ] AC 11: Given the Pull Requests tab is clicked, when the PR list loads, then PRs display with open/applied/closed/draft status badges (green/purple/red/grey), base branch target, and the same open/closed toggle pattern as issues.

- [ ] AC 12: Given a PR is clicked, when the PR detail page loads, then Conversation and Files Changed tabs are available — Conversation shows comments, Files Changed shows unified diffs of PR commits.

- [ ] AC 13: Given user-generated content (issue body, comment, PR description) contains `<script>` tags or javascript: URLs, when rendered, then the dangerous content is escaped/stripped — no XSS execution possible.

- [ ] AC 14: Given the app is loaded with `window.__RIG_CONFIG__` set, when the relay URL points to the local genesis relay (ws://localhost:7100), then all data fetches use that relay URL — no hardcoded relay addresses.

- [ ] AC 15: Given the dark mode toggle is clicked, when the theme switches, then all shadcn components and custom styles respect the dark color scheme — and the preference persists across page reloads via localStorage.

- [ ] AC 16: Given the app is built with `pnpm build`, when the output is deployed to Arweave via the deploy script, then the SPA loads correctly with relative asset paths (`./`) and CSP headers allow Arweave gateways and WebSocket connections.

## Additional Context

### Dependencies

**New npm packages:**
- `react` ^19.0.0, `react-dom` ^19.0.0
- `react-router` ^7.0.0
- `shiki` ^1.0.0 (use `@shikijs/langs` individual imports for tree-shaking)
- `@types/react` ^19.0.0, `@types/react-dom` ^19.0.0
- `@vitejs/plugin-react` ^4.0.0
- `tailwindcss` ^4.0.0, **`@tailwindcss/vite`** ^4.0.0 (required Vite plugin for Tailwind v4)
- `clsx` ^2.0.0, `tailwind-merge` ^2.0.0 (required for shadcn's `cn()` utility)
- `@testing-library/react` ^16.0.0, `@testing-library/jest-dom` ^6.0.0
- shadcn-ui v4 components (via `npx shadcn@latest add`)

**Keep existing:**
- `@toon-format/toon` ^1.0.0, `marked` ^17.0.5, `vite` ^5.0.0, `vitest` ^1.0.0

**Infrastructure required:**
- Local TOON genesis node (relay ws://localhost:7100, BLS http://localhost:3100)
- Repos published to relay with git objects on Arweave
- Issues and PRs (kind:1621, kind:1617) published to relay for Phase 4 testing

### Testing Strategy

- **Unit tests (RTL)**: Vitest + React Testing Library for component rendering and user interactions. These tests render components with **pre-fetched data passed as props** — they do NOT call relay/Arweave directly (jsdom has no WebSocket). Use factory functions to create realistic test data matching the shapes returned by hooks (RepoMetadata, TreeEntry[], IssueMetadata[], etc.). Test that components render correctly, handle empty states, and prevent XSS.
- **Hook tests**: Vitest tests for hook logic in isolation. Mock `queryRelay()` and `fetchArweaveObject()` at the module boundary (vi.mock) since these require real network. Test state transitions (loading → data → error).
- **E2E tests (Playwright)**: Real browser against Vite dev server connected to local TOON genesis infrastructure. **This is where "no mocks" applies** — E2E tests use real relay (ws://localhost:7100) + real Arweave gateways. Test full user flows: navigation, data loading, interactions.
- **Security tests**: XSS prevention verified in RTL tests for every component that renders user content (renderMarkdownSafe output, issue titles, comments).
- **Visual verification**: Use `playwright-cli` to compare rendered pages against Forgejo/Codeberg screenshots.
- **Convention**: [P0/P1/P2] priority prefix in test names, Test ID comments, factory functions for test data.

### Notes

- **High-risk: Shiki bundle size** — Shiki loads language grammars as WASM. May impact initial load time on Arweave. Consider lazy-loading grammars or limiting to top-10 languages.
- **High-risk: Arweave latency** — Git object fetches from Arweave gateways can be slow (1-5s). Skeleton loading states are critical for UX. Consider prefetching tree entries when hovering file links.
- **rig-pointer-html.ts** is NOT part of the rendering layer — it generates the Arweave pointer shell and must be updated to reference new React build output paths.
- **deploy-forge-ui.mjs** script needs path updates for new build output structure.
- All `.js` imports in data layer files use `.js` extension (ESM convention) — React files will use `.tsx` extension but import data layer as `.js`.
- The old rendering files (templates.ts, main.ts, router.ts, styles.css, layout.ts) should be kept during development for reference, then deleted in Phase 5 Task 33.
- Existing data layer unit tests (e.g., `relay-query.test.ts`, `date-utils.test.ts`, `git-objects.test.ts`) remain valid and should continue passing throughout the migration.
- **Breaking change: short-form routes removed.** The old `router.ts` handled `/<repo>/...` without an owner prefix. The new React router only supports `/:owner/:repo/...`. Any existing Arweave pointer deployments or bookmarks using short-form URLs will break. Add a catch-all route that redirects single-segment paths to the repo list page with an info message, or auto-resolves the owner from the relay if only one owner publishes the repo name.
- **HashRouter breaks hash-fragment relay URL override.** The old app supported `#relay=wss://...` as a shareable URL mechanism. HashRouter uses the hash for routing (`#/owner/repo/issues`), which conflicts. The `window.__RIG_CONFIG__` mechanism (set by pointer HTML) is the primary config path and is unaffected. The hash-fragment relay override is dropped in this migration. Document this as a known trade-off — relay URL must be configured via `window.__RIG_CONFIG__` or query parameter (`?relay=wss://...`) instead.
