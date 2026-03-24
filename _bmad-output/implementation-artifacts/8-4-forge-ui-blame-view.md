# Story 8.4: Forge-UI -- Blame View

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **human user**,
I want to view per-line blame information for any file,
So that I can see who last modified each line and when.

**FRs covered:** FR-NIP34-3 (Forge-UI subset)

**Dependencies:** Story 8.1 (layout, CSS, navigation, relay query patterns, `escapeHtml`) -- COMPLETE. Story 8.2 (git object parsers `parseGitCommit`/`parseGitTree`, Arweave client `resolveGitSha`/`fetchArweaveObject`, `TreeEntry` interface, `isBinaryBlob`) -- COMPLETE. Story 8.3 (commit chain walker `walkCommitChain`, `parseAuthorIdent`, `formatRelativeDate`, `CommitLogEntry`) -- COMPLETE.

**Decision sources:**
- Party Mode 2026-03-22: Fully Decentralized Git Architecture (Arweave DVM + Forge-UI)
- `_bmad-output/project-context.md` section "Fully Decentralized Git Architecture"
- `_bmad-output/planning-artifacts/test-design-epic-8.md` section "Story 8.4"

**Downstream dependencies:** Story 8.6 (deploy to Arweave) depends on all Forge-UI views being complete.

## Acceptance Criteria

### Part A: Blame Algorithm

1. **Blame computation:** Given a file path, a starting commit SHA, and a repository identifier, when `computeBlame(filePath, startSha, repo, maxDepth?)` is called, then it walks the commit history from Arweave and attributes each line of the current file content to the commit that last modified it. Returns `BlameResult` containing `{ lines: BlameLine[], fileContent: string, beyondLimit: boolean }` where each `BlameLine` is `{ commitSha: string, author: string, timestamp: number, lineNumber: number }`.

2. **Single-commit file blame:** Given a file that exists only in the most recent commit (added in that commit), when blame is computed, then all lines are attributed to that single commit.

3. **Multi-commit blame:** Given a file that has been modified across multiple commits, when blame is computed, then each line is attributed to the most recent commit that changed it. The algorithm compares the file's content at each commit with the previous version to determine which lines were introduced in each commit.

4. **Depth limit:** Given a blame computation that would walk more commits than `maxDepth` (default 50), when the limit is reached, then lines not yet attributed are marked with the oldest walked commit. The `BlameLine` for these lines includes the oldest commit SHA, and a flag `beyondLimit: boolean` is set on the `BlameResult`.

5. **Binary file handling:** Given a file detected as binary by `isBinaryBlob()`, when blame is requested, then it returns null (blame is not applicable to binary files).

6. **File not found handling:** Given a file path that does not exist in the commit's tree, when blame is requested, then it returns null.

### Part B: Blame View Rendering

7. **Blame view template:** Given a `BlameResult`, when `renderBlameView(repoName, ref, path, blameResult, isBinary?, ownerNpub?)` is called, then it renders a blame view showing for each line: the line number, the abbreviated commit hash (first 7 chars, linked to the commit diff view), the author name (from `parseAuthorIdent`), the relative date (from `formatRelativeDate`), and the line content. All values HTML-escaped.

8. **Blame grouping:** Given consecutive lines attributed to the same commit, when the blame view renders, then the commit info (hash, author, date) is shown only on the first line of each group. Subsequent lines in the same group show empty commit info cells. This reduces visual noise.

9. **Blame empty/error state:** Given a null `BlameResult` (file not found or binary), when the blame view renders, then it uses the `isBinary` flag to distinguish the cause and displays an appropriate error message ("File not found for blame" when `isBinary` is false/undefined, or "Binary files cannot be blamed" when `isBinary` is true).

10. **Depth limit notice:** Given a `BlameResult` with `beyondLimit: true`, when the blame view renders, then it displays a notice at the bottom of the blame table: "Blame history limited to N commits. Older attributions may be approximate."

11. **XSS prevention:** All file content, commit messages, author names, file names, and path segments MUST be HTML-escaped before rendering. Use `escapeHtml()` from `escape.ts`.

### Part C: Router Updates

12. **Blame route with ref:** The existing blame route `/<npub>/<repo>/blame/<path...>` MUST be updated to include a ref: `/<npub>/<repo>/blame/<ref>/<path...>`. The `Route` type must be updated from `{ type: 'blame'; owner: string; repo: string; path: string }` to `{ type: 'blame'; owner: string; repo: string; ref: string; path: string }`. This matches the tree/blob URL pattern and is required because blame needs a starting commit (resolved from the ref).

13. **Blame link from blob view:** Given a non-binary blob view, when the user wants to see blame, then a "Blame" link is available in the blob view header linking to `/<npub>/<repo>/blame/<ref>/<path>`. Binary blobs do NOT show a blame link (blame is not applicable to binary files).

### Part D: Main.ts Handler

14. **Blame route handler:** Given the blame route, when it fires, then `main.ts` resolves the ref to a commit SHA (same relay query + ref resolution pattern as tree/blob routes), calls `computeBlame()`, calls `renderBlameView()`, and renders the result inside the layout.

15. **Loading state:** Given the blame route, when loading starts, then a "Loading blame..." message is displayed while the blame computation runs.

16. **Error handling:** Given a blame computation failure (network error, Arweave unavailable), when the route handler catches the error, then it renders a user-friendly error message.

## Tasks / Subtasks

### Part A: Blame Algorithm

- [x] Task 1: Create blame algorithm module (AC: #1, #2, #3, #4, #5, #6)
  - [x] 1.1 Create `packages/rig/src/web/blame.ts`. Export interfaces: `BlameLine = { commitSha: string, author: string, timestamp: number, lineNumber: number }`, `BlameResult = { lines: BlameLine[], fileContent: string, beyondLimit: boolean }`. Export `computeBlame(filePath: string, startSha: string, repo: string, maxDepth?: number): Promise<BlameResult | null>`.
  - [x] 1.2 Blame algorithm overview: (a) Resolve the starting commit SHA to fetch the commit from Arweave. (b) From the commit's tree, resolve the file path to a blob SHA. (c) Fetch the blob content. If binary, return null. (d) Split the file content into lines. Initialize all lines as "unattributed". (e) Walk the commit chain (using same resolution pattern as `walkCommitChain`): for each commit, fetch the file's blob SHA from that commit's tree, fetch the parent commit's file blob SHA. Compare the two blob contents line-by-line. Lines that differ (present in current but not in parent) are attributed to the current commit. (f) Continue until all lines are attributed or maxDepth is reached.
  - [x] 1.3 File path resolution within a tree: Given a file path like `src/web/main.ts`, walk the tree hierarchy from Arweave: resolve root tree -> find `src` entry (mode `40000`) -> fetch subtree -> find `web` entry -> fetch subtree -> find `main.ts` entry -> return blob SHA. Export a helper `resolveFileSha(treeSha: string, filePath: string, repo: string): Promise<string | null>`.
  - [x] 1.4 Line attribution algorithm: Use a simple approach -- split both current and parent file into lines, compute a mapping of which lines in the current file exist in the parent (using content matching). Lines NOT present in the parent (or whose position changed relative to surrounding context) are attributed to the current commit. Lines present in both are carried forward for attribution to an older commit. This is a simplified blame (not a full Myers diff per commit), but sufficient for MVP.
  - [x] 1.5 Handle edge cases: root commit (all lines attributed to it), file added in a later commit (all lines attributed to that commit), file deleted in a later commit (no blame result from current ref), empty file (zero lines, valid but empty blame).
  - [x] 1.6 Performance guard: default `maxDepth = 50`. If maxDepth is reached and some lines remain unattributed, attribute them to the oldest walked commit and set `beyondLimit = true`.

### Part B: Blame View Rendering

- [x] Task 2: Replace `renderBlameView()` stub in templates.ts (AC: #7, #8, #9, #10, #11)
  - [x] 2.1 Update `renderBlameView()` in `packages/rig/src/web/templates.ts`. Change signature from `(_repoName: string, _ref: string, _path: string, blameData: unknown)` to `(repoName: string, ref: string, path: string, blameResult: BlameResult | null, isBinary?: boolean, ownerNpub?: string): TemplateResult`. Import `BlameResult` and `BlameLine` types.
  - [x] 2.2 For null `blameResult`: if `isBinary` is true, render "Binary files cannot be blamed"; otherwise render "File not found for blame." Both as 404 status.
  - [x] 2.3 Render blame table: each row has columns for commit info (abbreviated hash linked to `/<npub>/<repo>/commit/<sha>`, author name from `parseAuthorIdent()`, relative date from `formatRelativeDate()`), line number, and line content. Use `escapeHtml()` on all user-supplied values.
  - [x] 2.4 Group consecutive lines by commit SHA. Only show commit info on the first line of each group. Subsequent lines in the same group have empty commit info cells (or a subtle background color change).
  - [x] 2.5 Include breadcrumbs using `renderBreadcrumbs()` (same pattern as blob view).
  - [x] 2.6 If `beyondLimit` is true, show a notice at the bottom: "Blame history limited to N commits. Older attributions may be approximate."

### Part C: Router Updates

- [x] Task 3: Update blame route to include ref (AC: #12)
  - [x] 3.1 Update `packages/rig/src/web/router.ts`. Change the `blame` Route variant from `{ type: 'blame'; owner: string; repo: string; path: string }` to `{ type: 'blame'; owner: string; repo: string; ref: string; path: string }`.
  - [x] 3.2 Update the blame route parsing from `/<npub>/<repo>/blame/<path...>` to `/<npub>/<repo>/blame/<ref>/<path...>`. The ref is `segments[3]`, the path is `segments.slice(4).join('/')`. This matches the tree/blob URL pattern. **IMPORTANT:** The blame route match must require `segments.length >= 5` (needs at least ref + one path segment) to avoid matching `/<npub>/<repo>/blame/<ref>` with no path.
  - [x] 3.3 Update the module doc comment at top of `router.ts` to reflect the updated blame route format: `/<npub>/<repo>/blame/<ref>/<path...>`.

- [x] Task 4: Add blame link to blob view (AC: #13)
  - [x] 4.1 Update `renderBlobView()` in `packages/rig/src/web/templates.ts`. Add a "Blame" link in the blob header (next to file name and size), linking to `/<owner>/<repo>/blame/<ref>/<path>`. Only show for non-binary blobs.

### Part D: Main.ts Handler

- [x] Task 5: Implement blame route handler in main.ts (AC: #14, #15, #16)
  - [x] 5.1 Update `packages/rig/src/web/main.ts`. Add import for `computeBlame` from `./blame.js` and `renderBlameView` is already imported.
  - [x] 5.2 Create `renderBlameRoute(owner, repo, ref, path, relayUrl): Promise<string>`. Follow the same relay query + ref resolution pattern as `renderTreeRoute` and `renderBlobRoute`: query kind:30617, query kind:30618, resolve ref to commit SHA, then call `computeBlame(path, commitSha, repo)`.
  - [x] 5.3 Replace the `case 'blame':` stub in `renderRoute()` with a real handler that shows loading state, calls `renderBlameRoute()`, and handles errors with a user-friendly message.
  - [x] 5.4 Pass `route.ref` and `route.path` from the updated Route type.

### Part E: CSS Updates

- [x] Task 6: Add blame view styles (AC: #7, #8, #10)
  - [x] 6.1 Update `packages/rig/src/web/styles.css`. Add styles for: blame table (monospace font for content, fixed-width commit info columns), blame commit info cells (muted text color for hash/author/date), blame group separator (subtle top border when commit changes), blame line numbers, blame content column (pre-wrap, overflow-x auto), blame depth-limit notice. Follow the existing Forgejo-inspired design system (CSS variables, spacing, colors).

### Part F: Unit Tests

- [x] Task 7: Blame algorithm unit tests (AC: #1, #2, #3, #4, #5, #6)
  - [x] 7.1 File: `packages/rig/src/web/blame.test.ts`. Test IDs: 8.4-UNIT-001, 8.4-UNIT-002, 8.4-UNIT-003.
  - [x] 7.2 Test: single-commit file -- all lines attributed to that commit. Mock `resolveGitSha`, `fetchArweaveObject` via `vi.mock()`. (8.4-UNIT-001)
  - [x] 7.3 Test: multi-commit blame -- lines attributed to correct commits across 3-commit history. Set up mock where commit C modifies lines 3-4, commit B modifies lines 1-2, commit A is the initial. (8.4-UNIT-002)
  - [x] 7.4 Test: depth limit reached -- remaining lines attributed to oldest commit, `beyondLimit` is true. (8.4-UNIT-003)
  - [x] 7.5 Test: binary file returns null.
  - [x] 7.6 Test: file not found in tree returns null.
  - [x] 7.7 Test: root commit (no parent) -- all lines attributed to root commit.
  - [x] 7.8 Test: `resolveFileSha()` walks nested tree path correctly.
  - [x] 7.9 Note: test-design 8.4-UNIT-005 (rename tracking) is explicitly deferred (P3, not MVP scope). See Anti-Patterns: "DO NOT implement rename tracking."

- [x] Task 8: Blame renderer unit tests (AC: #7, #8, #9, #10, #11)
  - [x] 8.1 File: `packages/rig/src/web/templates.test.ts` (add alongside existing tests). Test ID: 8.4-UNIT-004.
  - [x] 8.2 Test: `renderBlameView()` renders blame lines with abbreviated hash, author, date, line number, content. (8.4-UNIT-004)
  - [x] 8.3 Test: consecutive lines from same commit show commit info only on first line.
  - [x] 8.4 Test: null blame result (not binary) returns 404.
  - [x] 8.5 Test: null blame result (binary) returns binary message.
  - [x] 8.6 Test: XSS in file content is escaped.
  - [x] 8.7 Test: `beyondLimit` notice is shown when true.

- [x] Task 9: Router blame route unit tests (AC: #12)
  - [x] 9.1 File: `packages/rig/src/web/router.test.ts` (add alongside existing tests).
  - [x] 9.2 Test: `/<npub>/<repo>/blame/main/src/file.ts` parses to `{ type: 'blame', ref: 'main', path: 'src/file.ts' }`.
  - [x] 9.3 Test: `/<npub>/<repo>/blame/main` (segments.length === 4, no file path segment) does NOT match blame route -- returns `not-found` or falls through to another route. Also test `/<npub>/<repo>/blame/main/` with trailing slash (segments.length === 5 with empty last segment) for consistent handling.
  - [x] 9.4 Test: existing tree, blob, commits, commit routes still parse correctly (regression).

- [x] Task 10: Blob view blame link unit tests (AC: #13)
  - [x] 10.1 File: `packages/rig/src/web/templates.test.ts` (add alongside existing tests).
  - [x] 10.2 Test: `renderBlobView()` includes a blame link for text files.
  - [x] 10.3 Test: `renderBlobView()` does NOT include a blame link for binary files.

### Part G: Integration Tests

- [x] Task 11: Blame view integration test (AC: #1, #7, #10)
  - [x] 11.1 File: `packages/rig/src/web/__integration__/blame-view.test.ts`. Test ID: 8.4-INT-001.
  - [x] 11.2 Test: mock Arweave commit history (3 commits, file modified in commit 2 and 3) -> compute blame -> render blame view -> verify correct line attributions are displayed with correct commit SHAs, authors, and dates.

## Dev Notes

### Architecture Patterns

- **Continue Story 8.1/8.2/8.3 patterns.** All code organization, testing, CSS, XSS prevention, and routing patterns established in Stories 8.1-8.3 must be followed. This story adds a new module (`blame.ts`) and extends existing ones.
- **Static web app -- no server.** Forge-UI is pure client-side HTML/JS/CSS. Git objects are fetched via `fetch()` from Arweave gateways. No backend, no API server, no SDK dependency.
- **Browser-only code.** All new modules in `packages/rig/src/web/` must use `Uint8Array` (NOT `Buffer`), `TextDecoder` (NOT `Buffer.toString()`), and `fetch()` (NOT Node.js `http`/`https`). No Node.js APIs.
- **XSS prevention is critical.** All file content, commit messages, author names, file names, and path segments MUST be HTML-escaped before rendering. Use `escapeHtml()` from `escape.ts`.

### Reuse from Stories 8.2 and 8.3 (DO NOT REINVENT)

- **`parseGitCommit(data: Uint8Array): GitCommit | null`** -- already exists in `git-objects.ts`. Use for parsing commits during blame walk.
- **`parseGitTree(data: Uint8Array): TreeEntry[]`** -- already exists in `git-objects.ts`. Use for resolving file paths within trees.
- **`resolveGitSha(sha, repo): Promise<string | null>`** -- already exists in `arweave-client.ts`. Has built-in caching. Use for all SHA-to-txId resolution.
- **`fetchArweaveObject(txId): Promise<Uint8Array | null>`** -- already exists in `arweave-client.ts`. Has gateway fallback. Use for all Arweave data fetching.
- **`isBinaryBlob(data: Uint8Array): boolean`** -- already exists in `git-objects.ts`. Use for binary file detection before blame computation.
- **`parseAuthorIdent(ident: string): AuthorIdent | null`** -- already exists in `git-objects.ts`. Use for parsing author names from blame commit data.
- **`formatRelativeDate(timestamp: number): string`** -- already exists in `date-utils.ts`. Use for formatting blame dates.
- **`escapeHtml(s: string): string`** -- already exists in `escape.ts`. Use for ALL user-supplied content rendering.
- **`walkCommitChain(startSha, repo, maxDepth): Promise<CommitLogEntry[]>`** -- already exists in `commit-walker.ts`. The blame algorithm should NOT reuse this directly because blame needs to track per-file changes at each commit step (it needs to fetch trees and blobs per commit, not just commits). However, the walking pattern (resolve SHA -> fetch -> parse -> follow parent) is the same.
- **`renderBreadcrumbs()`** -- private function in `templates.ts`. Reuse for blame view breadcrumbs.
- **`resolveDefaultRef()`** -- already in `ref-resolver.ts`. Reuse for blame route handler ref resolution.
- **`buildRepoRefsFilter()`** -- already in `relay-client.ts`. Reuse for blame route handler relay queries.

### Blame Algorithm Design Notes

The blame algorithm is a simplified version of `git blame`. Full `git blame` uses Myers diff to track line movement precisely. For the Forge-UI MVP, a simpler approach is acceptable:

1. Start at the HEAD commit for the given ref.
2. Fetch the file blob at HEAD. This is the "current" content.
3. Split into lines. All lines start as "unattributed."
4. Walk the commit chain (HEAD -> parent -> grandparent -> ...):
   - At each commit, fetch the file blob from the commit's tree.
   - At the parent commit, fetch the file blob from the parent's tree.
   - If the parent doesn't have the file (file was added in this commit), attribute all remaining unattributed lines to this commit.
   - If the parent has a different blob SHA, compute a line diff (simple LCS or direct comparison) between parent and current. Lines that are new or changed relative to the parent are attributed to the current commit.
   - Lines that match between parent and current remain unattributed (to be attributed to an older commit).
   - Continue with the parent's file content as the new "current" for the next iteration.
5. At the root commit (no parent) or maxDepth, attribute all remaining unattributed lines.

**Key insight:** The blame does NOT need to diff the entire tree at each commit. It only needs to track ONE file's blob SHA through the commit chain. This means:
- At each commit: resolve root tree SHA -> walk path to file -> get blob SHA.
- If blob SHA is the same as the previous commit's blob SHA, skip (no changes to this file in this commit).
- If blob SHA is different, diff the two blob contents to find which lines changed.

This optimization makes blame much faster: only commits that actually modified the file trigger a blob fetch and diff.

### Performance Considerations (Risk: E8-R009)

- **Blame is computationally expensive.** Walking the commit history requires sequential Arweave fetches (commit -> tree -> subtree -> ... -> blob) for each commit that modified the file. For a file with 50 commits in its history, this could be hundreds of network requests.
- **SHA cache helps.** `resolveGitSha()` caches SHA-to-txId mappings. Subsequent blame requests for files in the same repo benefit from cached resolutions.
- **Blob SHA comparison short-circuits.** If the blob SHA for a file is the same in two consecutive commits, no blob fetch or diff is needed. This is the most common case (most commits don't modify most files).
- **maxDepth guard.** Default 50 commits. Prevents unbounded traversal for files with long histories. Users get approximate blame for very old lines.
- **Tree path resolution is sequential.** For deeply nested files, each directory level requires a separate tree fetch. For `src/web/templates.ts`, that's 3 tree fetches (root -> src -> web -> templates.ts). These are sequential but cached after the first resolution.
- **LCS diff per commit is bounded.** Each diff is only for one file, not the entire tree. For typical source files (<1000 lines), the LCS is fast.
- **No progressive rendering for MVP.** The entire blame result is computed before rendering. Progressive rendering (showing lines as they're attributed) is a future enhancement.

### Router Change -- BREAKING

The blame route changes from `/<npub>/<repo>/blame/<path...>` to `/<npub>/<repo>/blame/<ref>/<path...>`. This is a breaking change to the URL format, but since:
1. The blame route was a stub (never rendered real content).
2. No external links to blame routes exist yet.
3. The new format is consistent with tree/blob URL patterns.

This change is safe and necessary.

### Existing Stubs to Replace

- **`renderBlameView()` in `templates.ts`** (around line 542-559): Currently a stub returning "Blame view -- coming in Story 8.5." Replace with real implementation. Change the signature entirely.
- **`case 'blame':` in `main.ts`** (around line 806-812): Currently renders a stub HTML string. Replace with real handler that calls `renderBlameRoute()`.
- **`blame` route in `router.ts`** (around line 97-101): Currently parses `/<npub>/<repo>/blame/<path...>` without a ref. Update to include ref.

### New Files to Create

- `packages/rig/src/web/blame.ts` -- blame algorithm (computeBlame, resolveFileSha)
- `packages/rig/src/web/blame.test.ts` -- blame algorithm unit tests
- `packages/rig/src/web/__integration__/blame-view.test.ts` -- blame view integration test

### Existing Files to Modify

- `packages/rig/src/web/templates.ts` -- replace `renderBlameView()` stub with real implementation
- `packages/rig/src/web/router.ts` -- update blame Route type and route parsing to include ref
- `packages/rig/src/web/main.ts` -- replace blame case stub with `renderBlameRoute()` handler, add import for `computeBlame`
- `packages/rig/src/web/styles.css` -- add blame view styles
- `packages/rig/src/web/templates.test.ts` -- update `renderBlameView()` tests, add blame rendering tests
- `packages/rig/src/web/router.test.ts` -- update blame route parsing tests

### Resolution Chain for Blame

1. Route `/<npub>/<repo>/blame/<ref>/<path>` arrives
2. Query relay for kind:30617 (repo metadata) -> get repo metadata
3. Query relay for kind:30618 (refs) -> get ref->commitSHA map
4. Resolve ref to commit SHA (using `resolveDefaultRef()` if empty)
5. Call `computeBlame(path, commitSha, repo)` -> get `BlameResult | null`
6. Call `renderBlameView()` -> HTML
7. Wrap in `renderLayout()` -> final page

### ATDD Stub Reconciliation

The test-design-epic-8.md references ATDD stubs at:
- `packages/rig/src/git/blame.test.ts` -- NOT to be created at that path. All web code lives in `src/web/`. Create at `packages/rig/src/web/blame.test.ts`.
- `packages/rig/src/web/blame-view.test.ts` -- Blame view rendering tests go in `packages/rig/src/web/templates.test.ts` (following Story 8.1/8.2/8.3 pattern of co-locating template tests).

### Anti-Patterns to Avoid

- **DO NOT use `Buffer`** -- this is browser code. Use `Uint8Array`, `TextDecoder`, `TextEncoder`.
- **DO NOT import `@toon-protocol/sdk`** in web code. Forge-UI is a static frontend.
- **DO NOT use `nostr-tools` SimplePool.** Known broken. Use raw WebSocket (from Story 8.1 relay-client).
- **DO NOT render user content without XSS escaping.** Every string from Nostr events or git objects must be escaped.
- **DO NOT use `innerHTML` with unescaped content.** Use `escapeHtml()` from `escape.ts`.
- **DO NOT use external diff libraries for blame.** Implement a simple line-comparison algorithm. No `diff`, `jsdiff`, or similar.
- **DO NOT use external date libraries.** Use `formatRelativeDate()` from `date-utils.ts`.
- **DO NOT walk the entire tree at each commit.** Only resolve the specific file path to get its blob SHA. Skip commits where the blob SHA hasn't changed.
- **DO NOT reuse `walkCommitChain()` directly.** Blame needs per-commit file-level resolution, not just commit collection. Implement a blame-specific walk that fetches tree/blob data at each step.
- **DO NOT implement rename tracking.** A renamed file appears as a different path. Blame only tracks the given path. Rename detection is not in scope for MVP (matches test-design: 8.4-UNIT-005 is P3).

### Project Structure Notes

- All new web modules go in `packages/rig/src/web/` (browser-compatible, no Node.js APIs).
- All unit tests are co-located with their source: `blame.test.ts` next to `blame.ts`.
- Integration tests go in `packages/rig/src/web/__integration__/`.
- Template rendering tests go in `packages/rig/src/web/templates.test.ts` (established pattern).
- CSS additions go in `packages/rig/src/web/styles.css` (single stylesheet, established pattern).
- `tsconfig.json` excludes `packages/rig` -- the rig package has its own build config.
- ESLint ignores `packages/rig/` -- linting is relaxed for this browser-only package.

### Previous Story Intelligence

Key learnings from Stories 8.1, 8.2, and 8.3 that apply here:
- **`escapeHtml()` from `escape.ts`** is the canonical XSS prevention function. Use it everywhere.
- **`hexToNpub()` from `npub.ts`** is the canonical npub encoder (pure JS, no external deps).
- **`decodeToonMessage()` from `relay-client.ts`** handles TOON format decoding with object passthrough.
- **Router uses History API** (not hash-based). New routes must follow the same pattern.
- **Git object parsing uses `Uint8Array` indexing** (not regex). Binary format requires byte-level access.
- **Arweave client has built-in caching** (`shaToTxIdCache`). No need to add blame-level caching.
- **3 code review passes were needed in Story 8.1.** Anticipate review feedback on XSS prevention, browser compatibility, blame algorithm correctness, and Arweave error handling.
- **`isBinaryBlob()` exists in `git-objects.ts`.** Use it for binary file detection before blame -- do not reimplement.
- **Story 8.3 commit diff stub messages were misnumbered.** The blame stub in `templates.ts` says "coming in Story 8.5" (incorrect -- blame is Story 8.4). Replace entirely.
- **`computeUnifiedDiff()` from `unified-diff.ts`** could be reused for line-by-line diff in blame, but it returns `DiffHunk[]` which is more than needed. A simpler line comparison may be more appropriate for blame. Consider reusing the LCS core from `unified-diff.ts` or implementing a dedicated blame diff.
- **`renderCommitDiff()` signature change in Story 8.3 broke existing tests.** Similarly, `renderBlameView()` signature change will break existing tests. Update them proactively.

### Testing Standards

- **Vitest with jsdom** for unit tests. Co-located `*.test.ts` files.
- **No mocking in integration tests** except for `fetch` (Arweave gateway) and `WebSocket` (relay). These are external dependencies that must be mocked.
- **Test IDs** follow `8.4-UNIT-*` and `8.4-INT-*` scheme from `test-design-epic-8.md`.
- **XSS prevention tests are P0.** File content, author names, and line content must be verified as escaped.
- **Mock `Date.now()` in tests** using `vi.useFakeTimers()` where relative dates are tested.
- **Mock Arweave resolution chain** using `vi.mock()` on `arweave-client.ts` functions.

### Git Intelligence

Recent commits on `epic-8` branch:
- `1712685 feat(8-3): Forge-UI commit log and diff view`
- `809fd39 feat(8-2): Forge-UI file tree and blob view`
- `d081cd7 docs: add Epics 10-11 (Compute + Chain Bridge primitives) from network primitives strategy`
- `66c45a2 feat(8-1): Forge-UI layout and repository list`
- `fa5e79c feat(8-0): Arweave Storage DVM Provider with chunked uploads`

Pattern: commit messages use `feat(X-Y):` format for story completions. Expected commit for this story: `feat(8-4): Forge-UI blame view`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md, Story 8.4 section]
- [Source: _bmad-output/planning-artifacts/test-design-epic-8.md, Story 8.4 section]
- [Source: _bmad-output/planning-artifacts/test-design-epic-8.md, Risk E8-R009 (blame performance)]
- [Source: packages/rig/src/web/git-objects.ts -- GitCommit, TreeEntry, parseGitCommit, parseGitTree, isBinaryBlob, parseAuthorIdent, AuthorIdent]
- [Source: packages/rig/src/web/arweave-client.ts -- resolveGitSha, fetchArweaveObject, clearShaCache]
- [Source: packages/rig/src/web/commit-walker.ts -- walkCommitChain, CommitLogEntry]
- [Source: packages/rig/src/web/templates.ts -- renderBlameView stub (~line 542), renderBreadcrumbs (~line 94)]
- [Source: packages/rig/src/web/router.ts -- blame Route variant (~line 23), parseRoute blame case (~line 97)]
- [Source: packages/rig/src/web/main.ts -- blame stub handler (~line 806)]
- [Source: packages/rig/src/web/escape.ts -- escapeHtml]
- [Source: packages/rig/src/web/date-utils.ts -- formatRelativeDate]
- [Source: packages/rig/src/web/unified-diff.ts -- computeUnifiedDiff, DiffHunk, DiffLine (potential reuse for line diff)]
- [Source: packages/rig/src/web/ref-resolver.ts -- resolveDefaultRef]
- [Source: packages/rig/src/web/relay-client.ts -- buildRepoRefsFilter]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- **Task 1 (Blame Algorithm):** `blame.ts` implements `computeBlame()`, `resolveFileSha()`, and `extractTimestamp()`. Uses simplified line-set-based diffing (not full LCS) for MVP. Handles root commits, file-not-found, binary detection, depth limits, and blob SHA short-circuiting.
- **Task 2 (Blame View Rendering):** `renderBlameView()` in `templates.ts` fully implemented with commit grouping, breadcrumbs, abbreviated SHA links, author/date display, XSS escaping, and beyondLimit notice.
- **Task 3 (Router Updates):** Blame route already updated to `/<npub>/<repo>/blame/<ref>/<path...>` with `segments.length >= 5` guard. Route type includes `ref` field.
- **Task 4 (Blob Blame Link):** `renderBlobView()` includes a "Blame" link for non-binary files, hidden for binary files.
- **Task 5 (Main.ts Handler):** `renderBlameRoute()` implements full resolution chain: relay query -> ref resolution -> `computeBlame()` -> `renderBlameView()` -> layout. Loading state and error handling included.
- **Task 6 (CSS):** Blame styles added: `.blame-view`, `.blame-table`, `.blame-line`, `.blame-group-start`, `.blame-sha`, `.blame-author`, `.blame-date`, `.blame-line-number`, `.blame-content`, `.blame-depth-notice`, `.blob-blame-link`.
- **Task 7 (Blame Unit Tests):** 10 tests in `blame.test.ts` covering single-commit, multi-commit, depth limit, binary, file-not-found, root commit, and `resolveFileSha` path walking.
- **Task 8 (Renderer Tests):** 7 tests in `templates.test.ts` covering null results (binary/not-found), line rendering, commit grouping, XSS escaping, and beyondLimit notice.
- **Task 9 (Router Tests):** 4 tests in `router.test.ts` covering blame route parsing with ref, no-path guard, and trailing slash handling.
- **Task 10 (Blob Blame Link Tests):** 2 tests in `templates.test.ts` verifying blame link presence for text files and absence for binary files.
- **Task 11 (Integration Tests):** 3 tests in `blame-view.test.ts` covering 3-commit blame rendering, depth limit notice, and XSS prevention.
- **Bug fix:** Fixed `isBinary` flag in `renderBlameRoute()` -- was incorrectly passing `blameResult === null` (always true when null), changed to `false` since `computeBlame` doesn't distinguish binary from not-found.

### File List

- `packages/rig/src/web/blame.ts` (created - blame algorithm)
- `packages/rig/src/web/blame.test.ts` (created - blame unit tests)
- `packages/rig/src/web/templates.ts` (modified - renderBlameView implementation, blob blame link)
- `packages/rig/src/web/templates.test.ts` (modified - blame view + blob blame link tests)
- `packages/rig/src/web/router.ts` (modified - blame route with ref)
- `packages/rig/src/web/router.test.ts` (modified - blame route tests)
- `packages/rig/src/web/main.ts` (modified - renderBlameRoute handler, isBinary fix)
- `packages/rig/src/web/styles.css` (modified - blame view CSS)
- `packages/rig/src/web/__integration__/blame-view.test.ts` (created - integration tests)
- `_bmad-output/implementation-artifacts/8-4-forge-ui-blame-view.md` (modified - status + dev record)

### Change Log

- **2026-03-23:** Story 8.4 implementation verified and completed. All code (blame algorithm, renderer, router, main handler, CSS, tests) was already in place from prior implementation. Fixed a bug where `isBinary` was incorrectly set to `blameResult === null` in `renderBlameRoute()`, causing all null blame results to show "Binary files cannot be blamed" instead of "File not found for blame." Changed to `false` as the safe default. All 99 tests passing (96 unit + 3 integration).
- **2026-03-23 (code review fixes):** (1) MEDIUM: Added `BlameError` discriminated union type and `isBlameError()` type guard to `blame.ts`, enabling `renderBlameRoute()` to properly distinguish binary files from file-not-found (AC #9). Previously hardcoded `isBinary: false`. (2) LOW: Added `maxDepth` field to `BlameResult` interface so the depth limit notice can display the actual commit limit number per AC #10 ("Blame history limited to N commits"). Updated all tests to include `maxDepth`. All 326 tests passing (239 unit + 87 integration).

## Code Review Record

### Review Pass #1

- **Date:** 2026-03-23
- **Reviewer model:** Claude Opus 4.6 (1M context)
- **Status:** Success
- **Issue counts:**
  - Critical: 0
  - High: 0
  - Medium: 2
  - Low: 1
- **Issues found and resolved:**
  1. **MEDIUM (AC #9):** `renderBlameRoute()` hardcoded `isBinary: false` — could not distinguish binary files from file-not-found. **Fix:** Added `BlameError` discriminated union type and `isBlameError()` type guard to `blame.ts`. Files modified: `blame.ts`, `main.ts`, `blame.test.ts`, `blame-view.test.ts`.
  2. **MEDIUM (AC #10, accepted trade-off):** Simplified line-set diffing is a known limitation — does not produce identical results to full Myers diff. Documented as acceptable MVP trade-off; no code change required.
  3. **LOW (AC #10):** Depth limit notice text was missing "to N commits" — the notice did not display the actual `maxDepth` value. **Fix:** Added `maxDepth` field to `BlameResult` interface so the template can render "Blame history limited to N commits." Files modified: `blame.ts`, `templates.ts`, `templates.test.ts`, `blame-view.test.ts`.
- **Files modified:** `blame.ts`, `main.ts`, `templates.ts`, `blame.test.ts`, `templates.test.ts`, `blame-view.test.ts`, `8-4-forge-ui-blame-view.md` (story file)
- **Outcome:** All issues resolved. 326 tests passing (239 unit + 87 integration). No follow-up tasks created.

### Review Pass #2

- **Date:** 2026-03-23
- **Reviewer model:** Claude Opus 4.6 (1M context)
- **Status:** Success
- **Issue counts:**
  - Critical: 0
  - High: 0
  - Medium: 0
  - Low: 3
- **Issues found and resolved:**
  1. **LOW (test accuracy):** Test descriptions in `blame.test.ts` for binary file and file-not-found cases said "returns null" but the functions actually return `BlameError` objects. Assertions were correct but descriptions were misleading. **Fix:** Updated test names and section comments to say "returns BlameError with reason binary/not-found." File modified: `blame.test.ts`.
  2. **LOW (test data):** Integration test `blame-view.test.ts` AC#14 had `BlameResult` with 2 `BlameLine` entries but `fileContent` with 3 lines — inconsistent test data. **Fix:** Added third `BlameLine` entry to match the 3 lines in `fileContent`. File modified: `blame-view.test.ts`.
  3. **LOW (cosmetic CSS):** First blame row always gets `blame-group-start` CSS class which adds a top border, doubling up with the table's own border from `.blame-view`. **Fix:** Added `.blame-line.blame-group-start:first-child td { border-top: none; }` rule. File modified: `styles.css`.
- **Files modified:** `blame.test.ts`, `blame-view.test.ts`, `styles.css`, `8-4-forge-ui-blame-view.md` (story file)
- **Outcome:** All issues resolved. 326 tests passing (239 unit + 87 integration). No follow-up tasks created.

### Review Pass #3 (Security-focused)

- **Date:** 2026-03-23
- **Reviewer model:** Claude Opus 4.6 (1M context)
- **Status:** Success
- **Scope:** Full code review + OWASP Top 10 security audit (XSS, injection, authentication/authorization, SSRF, prototype pollution, ReDoS)
- **Issue counts:**
  - Critical: 0
  - High: 0
  - Medium: 0
  - Low: 1
- **Issues found and resolved:**
  1. **LOW (defense-in-depth XSS):** `blameResult.maxDepth` was interpolated into HTML without `escapeHtml()` in the depth limit notice. While `maxDepth` is typed as `number` (safe via TypeScript's type system), defense-in-depth XSS prevention requires all interpolated values to be escaped. **Fix:** Wrapped with `escapeHtml(String(blameResult.maxDepth))`. File modified: `templates.ts`.
- **Security audit findings (no issues):**
  - **A03:2021 Injection / XSS:** All user-supplied values (file content, author names, commit SHAs, paths, repo names) are passed through `escapeHtml()` before HTML rendering. URL components use `encodeURIComponent()`. The `innerHTML` assignments in `main.ts` only receive output from template functions that escape all inputs. Marked with `nosemgrep` comments acknowledging intentional usage.
  - **A01:2021 Broken Access Control:** N/A -- Forge-UI is a read-only static SPA with no authentication. All data is public (Nostr relay + Arweave).
  - **A07:2021 SSRF:** Relay URL validation in `router.ts` restricts to `ws://`/`wss://` protocol via `isValidRelayUrl()`. `navigateTo()` blocks absolute URLs and protocol-relative URLs.
  - **A08:2021 Software and Data Integrity:** Git objects are fetched from Arweave (content-addressed by SHA), providing integrity verification by design.
  - **Prototype Pollution:** `isBlameError()` uses `in` operator but only receives internal `computeBlame` output. `HTML_ESCAPE_MAP` uses string keys from a static regex match. No dynamic property assignment from user input.
  - **ReDoS:** `extractTimestamp` regex `/\s(\d+)\s+[+-]\d{4}$/` is anchored, uses simple character classes, no nested quantifiers. Safe.
  - **Open Redirect:** `navigateTo()` blocks non-relative paths. `initRouter()` skips `http://` and `//` prefixed hrefs.
- **Files modified:** `templates.ts`, `8-4-forge-ui-blame-view.md` (story file)
- **Outcome:** 1 low-severity issue fixed. 239 tests passing. No follow-up tasks created.
