# Story 8.3: Forge-UI -- Commit Log and Diff View

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **human user**,
I want to view commit history and individual commit diffs,
So that I can understand the change history of a repository through the web interface.

**FRs covered:** FR-NIP34-3 (Forge-UI subset)

**Dependencies:** Story 8.1 (layout, CSS, navigation, relay query patterns, `escapeHtml`) -- COMPLETE. Story 8.2 (git object parsers `parseGitCommit`/`parseGitTree`, Arweave client `resolveGitSha`/`fetchArweaveObject`, router with `commit` route, `TreeEntry` interface) -- COMPLETE. Story 8.0 (Arweave DVM provider, Arweave data item tags `Git-SHA`, `Git-Type`, `Repo`) -- COMPLETE.

**Decision sources:**
- Party Mode 2026-03-22: Fully Decentralized Git Architecture (Arweave DVM + Forge-UI)
- `_bmad-output/project-context.md` section "Fully Decentralized Git Architecture"
- `_bmad-output/planning-artifacts/test-design-epic-8.md` section "Story 8.3"

**Downstream dependencies:** Story 8.4 (blame view) uses the commit chain walker created in this story. Story 8.6 (deploy) depends on all Forge-UI views being complete.

## Acceptance Criteria

### Part A: Commit Chain Walker

1. **Commit chain walker:** Given a starting commit SHA and a repository identifier, when `walkCommitChain(startSha, repo, maxDepth?)` is called, then it walks the parent chain from Arweave (resolve SHA -> fetch commit -> follow parent -> repeat) and returns `CommitLogEntry[]` ordered newest-first, where each entry is `{ sha: string, commit: GitCommit }` (wrapping `GitCommit` with its own SHA). Default `maxDepth` is 50 to prevent unbounded traversal.

2. **Merge commit handling:** Given a merge commit with multiple parent SHAs, when the chain walker encounters it, then it follows only the **first parent** (linear history, matching `git log --first-parent`). The merge commit itself is included in the result with all `parentShas` preserved. [Risk: E8-R004]

3. **Chain termination:** Given a commit with no parent (root commit) or a commit whose parent SHA cannot be resolved on Arweave, when the chain walker reaches it, then it stops gracefully and returns all commits walked so far. No error thrown.

### Part B: Commit Log Rendering

4. **Commit log page:** Given a repository and ref, when the commit log page loads at `/<npub>/<repo>/commits/<ref>`, then the UI resolves the ref to a commit SHA (reusing the ref resolution from Story 8.2), walks the commit chain, and renders a list showing for each commit: abbreviated hash (first 7 chars, linked to commit detail view), commit message (first line only), author identity (parsed from the `author` field), and relative date.

5. **Author identity parsing:** Given a git commit `author` field like `"Alice <alice@example.com> 1711234567 +0000"`, when `parseAuthorIdent(author)` is called, then it returns `{ name: string, email: string, timestamp: number, timezone: string }`. The name is displayed in the commit log. Timestamp is rendered as a relative date ("2 hours ago", "3 days ago", etc.).

6. **Commit log empty state:** Given a ref that resolves but whose commit chain is empty or the commit cannot be fetched, when the commit log renders, then it displays an appropriate empty state message.

### Part C: Tree-to-Tree Diff Computation

7. **Tree diff algorithm:** Given two `TreeEntry[]` arrays (parent tree and current tree), when `diffTrees(oldEntries, newEntries)` is called, then it returns `TreeDiffEntry[]` where each entry has `{ status: 'added' | 'deleted' | 'modified', name: string, oldSha?: string, newSha?: string, mode: string }`. Comparison is by name+SHA: same name + different SHA = modified; name only in new = added; name only in old = deleted. [Risk: E8-R008]

8. **Nested directory diff:** Given trees with subdirectories that differ, when `diffTrees` is called, then directory entries (mode `40000`) with different SHAs are reported as `modified`. The diff is **flat** (one level only) -- it does NOT recursively expand subdirectories. Subdirectory contents are shown when the user clicks into a modified directory (future enhancement or separate fetch). [Risk: E8-R008]

9. **Renamed file detection:** Rename detection is NOT implemented in this story. A renamed file appears as one `deleted` + one `added` entry. This is acceptable for MVP and matches basic `git diff --no-renames` behavior. [Risk: E8-R008]

### Part D: Commit Diff Rendering

10. **Commit diff view:** Given a commit SHA at route `/<npub>/<repo>/commit/<sha>`, when the commit diff view loads, then it fetches the commit from Arweave, fetches the commit's tree AND the parent commit's tree, computes the tree diff, and renders a diff summary showing: commit message (full), author, date, and a file change list (added/deleted/modified files with status indicators).

11. **Inline blob diff (text files):** Given a modified file entry in the diff, when the diff view renders, then for each modified text file it fetches both the old blob (from parent tree) and new blob (from current tree), computes a unified diff, and renders additions (green) and deletions (red). Binary files show "Binary file changed" instead of a diff.

12. **Unified diff algorithm:** Given two text strings (old content, new content), when `computeUnifiedDiff(oldText, newText)` is called, then it produces a unified diff with context lines (3 lines before/after each change). The diff algorithm is a simple line-by-line comparison using a longest-common-subsequence (LCS) approach. The output is `DiffHunk[]` where each hunk has `{ oldStart, oldCount, newStart, newCount, lines: DiffLine[] }` and each `DiffLine` has `{ type: 'context' | 'add' | 'delete', content: string }`.

13. **Root commit diff:** Given a commit with no parent (root commit), when the diff view renders, then all files in the root commit's tree are shown as `added`.

14. **XSS prevention:** All commit messages, author names, file names, and diff content MUST be HTML-escaped before rendering. Use `escapeHtml()` from `escape.ts`.

### Part E: Router Updates

15. **Commits log route:** Given the existing router, when extended, then it supports `/<npub>/<repo>/commits/<ref>` (commit log page). New Route variant: `{ type: 'commits'; owner: string; repo: string; ref: string }`.

16. **Commit route already exists:** The `/<npub>/<repo>/commit/<sha>` route already exists from Story 8.2 (router.ts line 86-87). This story implements the handler in `main.ts` (currently a stub returning "Commit diff view -- coming in Story 8.4" -- note: the stub message incorrectly says "8.4" but the diff view is implemented in THIS story, 8.3).

### Part F: Navigation Links

17. **Commits tab link:** Given the tree view or blob view, when the user wants to see the commit log, then a "Commits" link is available in the breadcrumb/navigation area linking to `/<npub>/<repo>/commits/<ref>`.

18. **Commit hash links:** Given the commit log, when the user clicks a commit's abbreviated hash, then they navigate to `/<npub>/<repo>/commit/<full-sha>` (the individual commit diff view).

## Tasks / Subtasks

### Part A: Commit Chain Walker

- [x] Task 1: Create commit chain walker (AC: #1, #2, #3)
  - [x] 1.1 Create `packages/rig/src/web/commit-walker.ts`. Export interface `CommitLogEntry = { sha: string, commit: GitCommit }` (wraps `GitCommit` from `git-objects.ts` with its own SHA). Export `walkCommitChain(startSha: string, repo: string, maxDepth?: number): Promise<CommitLogEntry[]>`. Default `maxDepth = 50`. Uses `resolveGitSha()` and `fetchArweaveObject()` from `arweave-client.ts`, and `parseGitCommit()` from `git-objects.ts`.
  - [x] 1.2 Walk loop: resolve SHA -> fetch commit bytes -> parse -> add to result -> follow `parentShas[0]` (first parent only for linear history) -> repeat until no parent, resolution fails, or maxDepth reached.
  - [x] 1.3 Return `CommitLogEntry[]` ordered newest-first (natural walk order). Gracefully stop on any resolution or fetch failure -- return all commits collected so far, do not throw.

### Part B: Author Identity Parser

- [x] Task 2: Parse git author identity strings (AC: #5)
  - [x]2.1 Add to `packages/rig/src/web/git-objects.ts`: export interface `AuthorIdent = { name: string, email: string, timestamp: number, timezone: string }`. Export `parseAuthorIdent(ident: string): AuthorIdent | null`. Parse format: `"Name <email> timestamp timezone"`. Return null for malformed strings.
  - [x]2.2 Add `formatRelativeDate(timestamp: number): string` to a new file `packages/rig/src/web/date-utils.ts`. Takes a Unix timestamp (seconds), returns relative date string ("just now", "5 minutes ago", "2 hours ago", "3 days ago", "2 months ago", "1 year ago"). Use `Date.now()` for current time. No external date library.

### Part C: Tree Diff Computation

- [x]Task 3: Compute tree-to-tree diff (AC: #7, #8, #9)
  - [x]3.1 Create `packages/rig/src/web/tree-diff.ts`. Export interface `TreeDiffEntry = { status: 'added' | 'deleted' | 'modified', name: string, oldSha?: string, newSha?: string, mode: string }`. Export `diffTrees(oldEntries: TreeEntry[], newEntries: TreeEntry[]): TreeDiffEntry[]`. Comparison by name: build a `Map<name, entry>` for each tree. Iterate both: name in new but not old = added; name in old but not new = deleted; name in both but different SHA = modified; same name + same SHA = unchanged (omitted from result).
  - [x]3.2 Sort result: deleted first, then modified, then added (matches git convention). Within each group, alphabetical by name.

### Part D: Unified Diff Algorithm

- [x]Task 4: Compute unified diff between two text strings (AC: #12)
  - [x]4.1 Create `packages/rig/src/web/unified-diff.ts`. Export interfaces: `DiffLine = { type: 'context' | 'add' | 'delete', content: string }`, `DiffHunk = { oldStart: number, oldCount: number, newStart: number, newCount: number, lines: DiffLine[] }`. Export `computeUnifiedDiff(oldText: string, newText: string, contextLines?: number): DiffHunk[]`. Default `contextLines = 3`.
  - [x]4.2 Implement LCS-based line diff. Split both texts by `\n`. Compute the longest common subsequence of lines. From the LCS, derive additions, deletions, and context lines. Group into hunks with the specified number of context lines around each change.
  - [x]4.3 Performance guard: if either text exceeds 10,000 lines, return a single hunk with a placeholder message "File too large for inline diff" rather than attempting a potentially expensive LCS computation.

### Part E: Commit Log Rendering

- [x]Task 5: Render commit log template (AC: #4, #6, #14, #17)
  - [x]5.1 Add to `packages/rig/src/web/templates.ts`: export `renderCommitLog(repoName: string, ref: string, commits: CommitLogEntry[], ownerNpub?: string): TemplateResult`. This is a NEW function for the commit log page (not the commit diff view -- that is Task 6).
  - [x]5.2 Render each commit as a row: abbreviated hash (first 7 chars, linked to `/<npub>/<repo>/commit/<sha>`), first line of message (truncated to ~72 chars), author name (from `parseAuthorIdent`), relative date (from `formatRelativeDate`). All values HTML-escaped.
  - [x]5.3 Include a breadcrumb with a back-link to the tree view. Include "Commits" as the active segment.
  - [x]5.4 Empty state: if `commits` array is empty, render "No commits found" message.

### Part F: Commit Diff Rendering

- [x]Task 6: Render commit diff template (AC: #10, #11, #13, #14)
  - [x]6.1 Update `renderCommitDiff()` in `packages/rig/src/web/templates.ts`. Change signature from `(repoName, sha, commitData: unknown)` to `(repoName: string, sha: string, commit: CommitLogEntry, diffEntries: TreeDiffEntry[], fileDiffs: FileDiff[], ownerNpub?: string): TemplateResult`. New interface `FileDiff = { name: string, status: 'added' | 'deleted' | 'modified', hunks: DiffHunk[], isBinary: boolean }`.
  - [x]6.2 Render: commit message (full, multi-line), author + date, parent SHA(s), file change summary (count of added/deleted/modified), then for each file: collapsible section with file name + status badge, and inline diff (green for additions, red for deletions, gray for context). Binary files show "Binary file changed".
  - [x]6.3 Root commit (no parent): all files shown as added with full content in green.
  - [x]6.4 All content HTML-escaped via `escapeHtml()`.

### Part G: Router and Navigation Updates

- [x]Task 7: Add commits log route (AC: #15, #16)
  - [x]7.1 Update `packages/rig/src/web/router.ts`. Add new Route variant: `{ type: 'commits'; owner: string; repo: string; ref: string }`. Add parsing: `/<npub>/<repo>/commits/<ref>` -> `{ type: 'commits', owner, repo, ref }`. **IMPORTANT:** The `commits` (plural) route match MUST be inserted BEFORE the existing `commit` (singular) match at line 86 to prevent `commits` being misrouted. Update the module doc comment at top of file.
  - [x]7.2 Update `packages/rig/src/web/main.ts`. Add `case 'commits':` handler in `renderRoute()`: resolve ref to commit SHA (same relay query pattern as tree route), call `walkCommitChain()`, call `renderCommitLog()`. Replace the existing `case 'commit':` stub with real implementation: fetch commit, fetch parent commit, compute tree diff, fetch blob diffs for modified files, call `renderCommitDiff()`.

- [x]Task 8: Add commits link to tree/blob views (AC: #17)
  - [x]8.1 Update `renderBreadcrumbs()` in `packages/rig/src/web/templates.ts` to include a "Commits" link next to the ref badge, linking to `/<npub>/<repo>/commits/<ref>`. This should appear in both tree and blob views.

### Part H: CSS Updates

- [x]Task 9: Add commit log and diff styles (AC: #4, #10, #11)
  - [x]9.1 Update `packages/rig/src/web/styles.css`. Add styles for: commit log list (commit rows with hash, message, author, date columns), commit diff view (commit header, file change summary, diff hunks with line coloring), diff line additions (`--color-diff-add: #e6ffec`, `--color-diff-add-text: #1a7f37`), diff line deletions (`--color-diff-del: #ffebe9`, `--color-diff-del-text: #cf222e`), diff context lines, collapsible file sections, status badges (A/D/M). Follow the existing Forgejo-inspired design.

### Part I: Unit Tests

- [x]Task 10: Commit chain walker unit tests (AC: #1, #2, #3)
  - [x]10.1 File: `packages/rig/src/web/commit-walker.test.ts`. Test IDs: 8.3-UNIT-001, 8.3-UNIT-002.
  - [x]10.2 Test: walks a 3-commit linear chain, returns all 3 in order. Mock `resolveGitSha` and `fetchArweaveObject` via `vi.mock()`. (8.3-UNIT-001)
  - [x]10.3 Test: merge commit with 2 parents -- follows only first parent. (8.3-UNIT-002)
  - [x]10.4 Test: stops at maxDepth (e.g., maxDepth=2 on a 5-commit chain returns 2).
  - [x]10.5 Test: stops gracefully when parent SHA resolution fails (returns partial results).
  - [x]10.6 Test: root commit (no parents) returns single commit.

- [x]Task 11: Author identity parser unit tests (AC: #5)
  - [x]11.1 File: `packages/rig/src/web/git-objects.test.ts` (add alongside existing tests).
  - [x]11.2 Test: valid author string parsed to AuthorIdent with name, email, timestamp, timezone.
  - [x]11.3 Test: malformed author string returns null.

- [x]Task 12: Relative date formatter unit tests (AC: #5)
  - [x]12.1 File: `packages/rig/src/web/date-utils.test.ts`.
  - [x]12.2 Test: timestamp from 30 seconds ago returns "just now".
  - [x]12.3 Test: timestamp from 2 hours ago returns "2 hours ago".
  - [x]12.4 Test: timestamp from 3 days ago returns "3 days ago".

- [x]Task 13: Tree diff unit tests (AC: #7, #8)
  - [x]13.1 File: `packages/rig/src/web/tree-diff.test.ts`. Test IDs: 8.3-UNIT-004, 8.3-UNIT-005, 8.3-UNIT-006.
  - [x]13.2 Test: added file detected (name in new, not in old). (8.3-UNIT-005)
  - [x]13.3 Test: deleted file detected (name in old, not in new). (8.3-UNIT-005)
  - [x]13.4 Test: modified file detected (same name, different SHA). (8.3-UNIT-004)
  - [x]13.5 Test: unchanged file omitted from result (same name, same SHA).
  - [x]13.6 Test: directory entry with different SHA reported as modified. (8.3-UNIT-006)
  - [x]13.7 Test: result sorted: deleted, modified, added, alphabetical within group.

- [x]Task 14: Unified diff unit tests (AC: #12)
  - [x]14.1 File: `packages/rig/src/web/unified-diff.test.ts`. Test ID: 8.3-UNIT-007.
  - [x]14.2 Test: identical texts produce zero hunks.
  - [x]14.3 Test: single line added produces one hunk with correct line numbers.
  - [x]14.4 Test: single line deleted produces correct hunk.
  - [x]14.5 Test: modification in the middle produces context lines around change.
  - [x]14.6 Test: large file (>10000 lines) returns placeholder hunk.

- [x]Task 15: Commit log rendering unit tests (AC: #4, #6)
  - [x]15.1 File: `packages/rig/src/web/templates.test.ts` (add alongside existing tests). Test ID: 8.3-UNIT-003.
  - [x]15.2 Test: `renderCommitLog()` renders commit list with abbreviated hash, message, author, date. (8.3-UNIT-003)
  - [x]15.3 Test: empty commits array renders empty state.
  - [x]15.4 Test: commit message with HTML tags is escaped.

- [x]Task 16: Commit diff rendering unit tests (AC: #10, #11)
  - [x]16.1 File: `packages/rig/src/web/templates.test.ts` (add alongside existing tests).
  - [x]16.2 Test: `renderCommitDiff()` renders commit header with message, author, date.
  - [x]16.3 Test: diff entries rendered with correct status badges (A/D/M).
  - [x]16.4 Test: inline diff lines rendered with add/delete styling classes.
  - [x]16.5 Test: XSS in diff content is escaped.

- [x]Task 17: Router extension unit tests (AC: #15)
  - [x]17.1 File: `packages/rig/src/web/router.test.ts` (add alongside existing tests).
  - [x]17.2 Test: `/<npub>/<repo>/commits/main` parses to `{ type: 'commits', ref: 'main' }`.
  - [x]17.3 Test: existing `/<npub>/<repo>/commit/<sha>` still parses correctly (regression).

### Part J: Integration Tests

- [x]Task 18: Commit log integration test (AC: #4)
  - [x]18.1 File: `packages/rig/src/web/__integration__/commit-log.test.ts`. Test ID: 8.3-INT-001.
  - [x]18.2 Test: mock Arweave commit chain (3 commits) -> render commit log -> verify all commits displayed in correct order with correct hash, message, author.

- [x]Task 19: Commit diff integration test (AC: #10, #11)
  - [x]19.1 File: `packages/rig/src/web/__integration__/commit-diff.test.ts`. Test ID: 8.3-INT-002.
  - [x]19.2 Test: mock Arweave commit + parent commit + trees + blobs -> render diff view -> verify file changes displayed with correct additions/deletions.

## Dev Notes

### Architecture Patterns

- **Continue Story 8.1/8.2 patterns.** All code organization, testing, CSS, XSS prevention, and routing patterns established in Stories 8.1-8.2 must be followed. This story adds new modules and extends existing ones.
- **Static web app -- no server.** Forge-UI is pure client-side HTML/JS/CSS. Git objects are fetched via `fetch()` from Arweave gateways. No backend, no API server, no SDK dependency.
- **Browser-only code.** All new modules in `packages/rig/src/web/` must use `Uint8Array` (NOT `Buffer`), `TextDecoder` (NOT `Buffer.toString()`), and `fetch()` (NOT Node.js `http`/`https`). No Node.js APIs.
- **XSS prevention is critical.** All commit messages, author names, file names, diff content, and path segments MUST be HTML-escaped before rendering. Use `escapeHtml()` from `escape.ts`.

### Reuse from Story 8.2 (DO NOT REINVENT)

- **`parseGitCommit(data: Uint8Array): GitCommit | null`** -- already exists in `git-objects.ts`. Returns `{ treeSha, parentShas, author, committer, message }`. Use this directly in the commit chain walker.
- **`parseGitTree(data: Uint8Array): TreeEntry[]`** -- already exists in `git-objects.ts`. Use for tree diff computation.
- **`resolveGitSha(sha, repo): Promise<string | null>`** -- already exists in `arweave-client.ts`. Has built-in caching. Use for all SHA-to-txId resolution.
- **`fetchArweaveObject(txId): Promise<Uint8Array | null>`** -- already exists in `arweave-client.ts`. Has gateway fallback. Use for all Arweave data fetching.
- **`isBinaryBlob(data: Uint8Array): boolean`** -- already exists in `git-objects.ts`. Use for binary file detection in diff view.
- **`escapeHtml(s: string): string`** -- already exists in `escape.ts`. Use for ALL user-supplied content rendering.
- **`renderBreadcrumbs()`** -- private function in `templates.ts`. May need to be extended or a new variant created for commit views.
- **`renderTreeRoute()` and `renderBlobRoute()` in `main.ts`** -- reference patterns for relay queries, ref resolution, Arweave fetch chains. The commit log route handler follows the same pattern.
- **`buildRepoRefsFilter()`** -- already in `relay-client.ts` (line 35). Reuse for ref resolution in commit log route.
- **`resolveDefaultRef()`** -- already in `ref-resolver.ts` (line 31). Handles default branch -> HEAD -> first ref fallback logic. Reuse in the commit log route handler.

### Existing Stubs to Replace

- **`renderCommitDiff()` in `templates.ts`** (line 268-283): Currently returns "Commit diff view -- coming in Story 8.4." The message is WRONG -- it should say "8.3" not "8.4". Replace the entire stub with real implementation. Change the signature (see Task 6.1).
- **`case 'commit':` in `main.ts`** (line 516-522): Currently renders a stub. Replace with real implementation that fetches commit, computes diff, renders result.

### Existing Tests to Update

- **`templates.test.ts`**: The existing `renderCommitDiff()` tests (lines 138-149) test only the null-input -> 404 path (two tests: non-existent commit SHA and malformed SHA, both passing `null` as `commitData`). These tests MUST be updated when the function signature changes from `(repoName, sha, commitData: unknown)` to the new signature (see Task 6.1). The 404-on-null behavior should be preserved but the test calls need new parameters. The import on line 15 remains valid.

### New Files to Create

- `packages/rig/src/web/commit-walker.ts` -- commit chain walker
- `packages/rig/src/web/commit-walker.test.ts` -- commit chain walker unit tests
- `packages/rig/src/web/tree-diff.ts` -- tree-to-tree diff computation
- `packages/rig/src/web/tree-diff.test.ts` -- tree diff unit tests
- `packages/rig/src/web/unified-diff.ts` -- unified diff algorithm
- `packages/rig/src/web/unified-diff.test.ts` -- unified diff unit tests
- `packages/rig/src/web/date-utils.ts` -- relative date formatting
- `packages/rig/src/web/date-utils.test.ts` -- date utils unit tests
- `packages/rig/src/web/__integration__/commit-log.test.ts` -- commit log integration test
- `packages/rig/src/web/__integration__/commit-diff.test.ts` -- commit diff integration test

### Existing Files to Modify

- `packages/rig/src/web/templates.ts` -- replace `renderCommitDiff()` stub, add `renderCommitLog()`, extend `renderBreadcrumbs()` with commits link
- `packages/rig/src/web/git-objects.ts` -- add `parseAuthorIdent()` and `AuthorIdent` interface
- `packages/rig/src/web/router.ts` -- add `commits` Route variant and route parsing
- `packages/rig/src/web/main.ts` -- add `case 'commits':` handler, replace `case 'commit':` stub
- `packages/rig/src/web/styles.css` -- add commit log and diff styles
- `packages/rig/src/web/templates.test.ts` -- update `renderCommitDiff()` tests, add `renderCommitLog()` tests
- `packages/rig/src/web/git-objects.test.ts` -- add `parseAuthorIdent()` tests
- `packages/rig/src/web/router.test.ts` -- add `commits` route parsing tests

### Resolution Chain for Commit Log

1. Route `/<npub>/<repo>/commits/<ref>` arrives
2. Query relay for kind:30617 (repo announcement) -> get repo metadata
3. Query relay for kind:30618 (refs) -> get ref->commitSHA map
4. Resolve ref to commit SHA
5. Call `walkCommitChain(commitSha, repo)` -> get `CommitLogEntry[]`
6. Call `renderCommitLog()` -> HTML

### Resolution Chain for Commit Diff

1. Route `/<npub>/<repo>/commit/<sha>` arrives
2. Resolve SHA to Arweave txId -> fetch commit bytes -> parse
3. Resolve parent SHA (if exists) -> fetch parent commit -> parse
4. Fetch current commit's tree and parent's tree from Arweave
5. `diffTrees(parentTreeEntries, currentTreeEntries)` -> `TreeDiffEntry[]`
6. For each modified text file: fetch old blob + new blob -> `computeUnifiedDiff()`
7. Call `renderCommitDiff()` -> HTML

### ATDD Stub Reconciliation

The test-design-epic-8.md references ATDD stubs at:
- `packages/rig/src/git/commit-walker.test.ts` -- NOT to be created at that path. All web code lives in `src/web/`. Create at `packages/rig/src/web/commit-walker.test.ts`.
- `packages/rig/src/git/tree-diff.test.ts` -- NOT to be created at that path. Create at `packages/rig/src/web/tree-diff.test.ts`.
- `packages/rig/src/web/commit-log.test.ts` -- Commit log rendering tests go in `packages/rig/src/web/templates.test.ts` (following Story 8.1/8.2 pattern of co-locating template tests).
- `packages/rig/src/web/diff-view.test.ts` -- Diff view rendering tests go in `packages/rig/src/web/templates.test.ts`.

The test-design paths assumed separate test files per view. The established pattern from Stories 8.1-8.2 places all template rendering tests in `templates.test.ts`. Follow the established pattern.

### Performance Considerations

- **Commit chain walking is sequential.** Each commit requires a SHA resolution + Arweave fetch. For a 50-commit chain, this is ~100 network requests. The `shaToTxIdCache` in `arweave-client.ts` mitigates repeated lookups, but first loads will be slow. Accept this for MVP.
- **LCS diff on large files is expensive.** The 10,000-line guard (Task 4.3) prevents browser hangs. For files under 10K lines, a simple O(n*m) LCS is acceptable.
- **Blob fetching for diffs can be parallelized.** When computing diffs for modified files, the old and new blob fetches for a single file are independent and can use `Promise.all()`. Multiple files can also be fetched in parallel (but limit concurrency to ~3 to avoid overwhelming gateways).

### Anti-Patterns to Avoid

- **DO NOT use `Buffer`** -- this is browser code. Use `Uint8Array`, `TextDecoder`, `TextEncoder`.
- **DO NOT import `@toon-protocol/sdk`** in web code. Forge-UI is a static frontend.
- **DO NOT use `nostr-tools` SimplePool.** Known broken. Use raw WebSocket (from Story 8.1 relay-client).
- **DO NOT render user content without XSS escaping.** Every string from Nostr events or git objects must be escaped.
- **DO NOT use `innerHTML` with unescaped content.** Use `escapeHtml()` from `escape.ts`.
- **DO NOT use external diff libraries.** Implement a simple LCS-based diff. No `diff`, `jsdiff`, or similar dependencies.
- **DO NOT use external date libraries.** Implement `formatRelativeDate()` with vanilla JS `Date` math. No `date-fns`, `dayjs`, or `moment`.
- **DO NOT recursively diff subdirectories.** Tree diff is flat (one level). Subdirectory expansion is a future enhancement.

### Project Structure Notes

- All new web modules go in `packages/rig/src/web/` (browser-compatible, no Node.js APIs).
- All unit tests are co-located with their source: `commit-walker.test.ts` next to `commit-walker.ts`, etc.
- Integration tests go in `packages/rig/src/web/__integration__/`.
- Template rendering tests go in `packages/rig/src/web/templates.test.ts` (established pattern).
- CSS additions go in `packages/rig/src/web/styles.css` (single stylesheet, established pattern).

### Existing Code Gotchas

- **`renderCommitDiff()` stub message misnumbered:** The stub in `templates.ts` (line 281) says "coming in Story 8.4" but the commit diff view is implemented in THIS story (8.3). The `main.ts` stub (line 519) has the same error. Replace both stubs entirely -- do not fix the message, replace the code.
- **`renderCommitDiff()` signature change breaks existing tests:** The two existing tests in `templates.test.ts` (lines 138-149) call `renderCommitDiff('test-repo', 'sha', null)`. The third parameter changes from `commitData: unknown` to `commit: CommitLogEntry`. Update the 404 tests to pass `null` for the `commit` parameter (preserving 404-on-null behavior) and adjust remaining parameters.
- **`renderBreadcrumbs()` is a private function.** It is not exported from `templates.ts` (line 89). Task 8.1 extends it, but adding new functionality may require refactoring to accept an options parameter or creating a variant function. Do not export it unless necessary.
- **`commits` vs `commit` route ambiguity.** The new `commits` route (plural, for commit log) must be parsed BEFORE the existing `commit` route (singular, for individual diff view) in the router to avoid `commits` being matched as a repo name by the `commit` branch. The existing `commit` match is at line 86; insert `commits` match above it.
- **Ref resolution in commit log route.** The commit log route needs both kind:30617 (repo metadata) and kind:30618 (refs) from the relay. Reuse `resolveDefaultRef()` from `ref-resolver.ts` and `buildRepoRefsFilter()` from `relay-client.ts`. These patterns are established in `main.ts` for the tree and blob routes.
- **`main.ts` stub at line 519 also references "Story 8.4":** Both the `templates.ts` stub and the `main.ts` stub have this error. Both are replaced by real implementations in this story.

### Previous Story Intelligence

Key learnings from Stories 8.1 and 8.2 that apply here:
- **`escapeHtml()` from `escape.ts`** is the canonical XSS prevention function. Use it everywhere.
- **`hexToNpub()` from `npub.ts`** is the canonical npub encoder (pure JS, no external deps).
- **`decodeToonMessage()` from `relay-client.ts`** handles TOON format decoding with object passthrough.
- **Router uses History API** (not hash-based). New routes must follow the same pattern.
- **Git object parsing uses `Uint8Array` indexing** (not regex). Binary format requires byte-level access.
- **Arweave client has built-in caching** (`shaToTxIdCache`). No need to cache at the walker level.
- **3 code review passes were needed in Story 8.1.** Anticipate review feedback on XSS prevention, browser compatibility, diff algorithm correctness, and Arweave error handling.
- **`isBinaryBlob()` exists in `git-objects.ts`.** Use it in the diff view for binary file detection -- do not reimplement.
- **`resolveDefaultRef()` from `ref-resolver.ts`** handles fallback logic (default branch -> HEAD -> first ref). Reuse it in the commit log route.

### Testing Standards

- **Vitest with jsdom** for unit tests. Co-located `*.test.ts` files.
- **No mocking in integration tests** except for `fetch` (Arweave gateway) and `WebSocket` (relay). These are external dependencies that must be mocked.
- **Test IDs** follow `8.3-UNIT-*` and `8.3-INT-*` scheme from `test-design-epic-8.md`.
- **XSS prevention tests are P0.** Commit messages, author names, file names, and diff content must be verified as escaped.
- **Git object fixture generation.** Create test fixtures using known git object bytes. Use `Uint8Array` literals rather than `Buffer.from()` for browser compatibility.
- **Mock `Date.now()` in date-utils tests.** Use `vi.useFakeTimers()` to control the current time for deterministic relative date testing.
- **LCS diff edge cases.** Test empty strings, identical strings, completely different strings, and the 10,000-line guard.

### Git Intelligence

Recent commits on `epic-8` branch:
- `809fd39 feat(8-2): Forge-UI file tree and blob view`
- `d081cd7 docs: add Epics 10-11 (Compute + Chain Bridge primitives) from network primitives strategy`
- `66c45a2 feat(8-1): Forge-UI layout and repository list`
- `fa5e79c feat(8-0): Arweave Storage DVM Provider with chunked uploads`

Pattern: commit messages use `feat(X-Y):` format for story completions. Expected commit for this story: `feat(8-3): Forge-UI commit log and diff view`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md, Story 8.3 section]
- [Source: _bmad-output/planning-artifacts/test-design-epic-8.md, Story 8.3 section]
- [Source: _bmad-output/planning-artifacts/test-design-epic-8.md, Risk E8-R004 (merge commits), E8-R008 (tree diff correctness)]
- [Source: packages/rig/src/web/git-objects.ts -- GitCommit, TreeEntry, parseGitCommit, parseGitTree, isBinaryBlob]
- [Source: packages/rig/src/web/arweave-client.ts -- resolveGitSha, fetchArweaveObject, clearShaCache]
- [Source: packages/rig/src/web/templates.ts -- renderCommitDiff stub (line 268), renderBreadcrumbs (line 89)]
- [Source: packages/rig/src/web/router.ts -- commit Route variant (line 20), parseRoute commit case (line 86)]
- [Source: packages/rig/src/web/main.ts -- commit stub handler (line 516)]
- [Source: packages/rig/src/web/escape.ts -- escapeHtml]
- [Source: packages/rig/src/web/ref-resolver.ts -- resolveDefaultRef (line 31)]
- [Source: packages/rig/src/web/relay-client.ts -- buildRepoRefsFilter (line 35)]
- [Source: packages/rig/src/web/templates.test.ts -- renderCommitDiff tests (lines 138-149)]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (1M context)

### Debug Log References
N/A — all tests passed on first run, no debugging needed.

### Completion Notes List
- **Task 1 (Commit Chain Walker):** Implemented `commit-walker.ts` with `walkCommitChain()` that walks first-parent only, stops gracefully on resolution failure or maxDepth, returns `CommitLogEntry[]` newest-first.
- **Task 2 (Author Identity Parser):** Added `parseAuthorIdent()` and `AuthorIdent` interface to `git-objects.ts`. Regex-based parser for `"Name <email> timestamp timezone"` format.
- **Task 2 (Date Utils):** Implemented `formatRelativeDate()` in `date-utils.ts` with vanilla JS Date math — no external library.
- **Task 3 (Tree Diff):** Implemented `diffTrees()` in `tree-diff.ts` with Map-based comparison. Sorted output: deleted, modified, added. Flat diff only (no recursive subdirectory expansion).
- **Task 4 (Unified Diff):** Implemented LCS-based `computeUnifiedDiff()` in `unified-diff.ts` with configurable context lines and 10K-line performance guard.
- **Task 5 (Commit Log Rendering):** Added `renderCommitLog()` to `templates.ts` with abbreviated SHA links, truncated messages (72 chars), parsed author names, relative dates. All XSS-escaped.
- **Task 6 (Commit Diff Rendering):** Replaced `renderCommitDiff()` stub with full implementation — commit header, parent SHA links, file change summary, inline diff with colored add/delete lines, binary file handling, root commit support.
- **Task 7 (Router Updates):** Added `commits` Route variant and route parsing (plural before singular to avoid ambiguity). Implemented `renderCommitsRoute()` and `renderCommitRoute()` handlers in `main.ts`.
- **Task 8 (Navigation Links):** Extended `renderBreadcrumbs()` with "Commits" link visible in tree and blob views.
- **Task 9 (CSS):** Added commit log, commit diff, diff hunk, diff line coloring (green/red), status badges (A/D/M), and responsive styles to `styles.css`.
- **Tasks 10-19 (Tests):** All unit tests (commit-walker, git-objects parseAuthorIdent, date-utils, tree-diff, unified-diff, templates commit log + diff, router commits route) and integration tests (commit-log, commit-diff) implemented and passing.

### File List
**Created:**
- `packages/rig/src/web/commit-walker.ts`
- `packages/rig/src/web/commit-walker.test.ts`
- `packages/rig/src/web/tree-diff.ts`
- `packages/rig/src/web/tree-diff.test.ts`
- `packages/rig/src/web/unified-diff.ts`
- `packages/rig/src/web/unified-diff.test.ts`
- `packages/rig/src/web/date-utils.ts`
- `packages/rig/src/web/date-utils.test.ts`
- `packages/rig/src/web/__integration__/commit-log.test.ts`
- `packages/rig/src/web/__integration__/commit-diff.test.ts`

**Modified:**
- `packages/rig/src/web/templates.ts` — replaced `renderCommitDiff()` stub, added `renderCommitLog()`, `renderCommitBreadcrumbs()`, `FileDiff` interface, `getStatusBadge()`, extended `renderBreadcrumbs()` with Commits link
- `packages/rig/src/web/git-objects.ts` — added `AuthorIdent` interface and `parseAuthorIdent()`
- `packages/rig/src/web/router.ts` — added `commits` Route variant and route parsing
- `packages/rig/src/web/main.ts` — added `renderCommitsRoute()`, `renderCommitRoute()`, `commits`/`commit` case handlers
- `packages/rig/src/web/styles.css` — added commit log, commit diff, diff hunk, diff line, status badge styles
- `packages/rig/src/web/templates.test.ts` — updated `renderCommitDiff()` tests for new signature, added commit log and commit diff rendering tests
- `packages/rig/src/web/git-objects.test.ts` — added `parseAuthorIdent()` tests
- `packages/rig/src/web/router.test.ts` — added `commits` route parsing tests

### Change Log
| Date | Summary |
|------|---------|
| 2026-03-23 | Story 8.3 verified complete. All implementation (commit chain walker, author identity parser, date utils, tree diff, unified diff, commit log/diff rendering, router, CSS) and tests (16 unit test suites, 2 integration test suites, 200 tests passing) confirmed working. Build and lint pass cleanly. |

## Code Review Record

### Review Pass #1
- **Date:** 2026-03-23
- **Reviewer Model:** Claude Opus 4.6 (1M context)
- **Issues Found:** 0 critical, 0 high, 0 medium, 0 low
- **Files Changed:** 0
- **Outcome:** PASS — no issues found, no changes required.

### Review Pass #2 (BMAD Code Review)
- **Date:** 2026-03-23
- **Reviewer Model:** Claude Opus 4.6 (1M context)
- **Issues Found:** 0 critical, 0 high, 0 medium, 1 low
- **Files Changed:** 2
- **Outcome:** PASS — 1 low-severity issue found and fixed.

#### Low-1: `formatRelativeDate()` returns misleading output for future timestamps
- **File:** `packages/rig/src/web/date-utils.ts`
- **Severity:** Low
- **Description:** If a timestamp is in the future (e.g., due to clock skew between git author time and browser time), `diff` is negative and falls through all threshold checks to the `years` calculation, producing `"0 years ago"` or incorrect negative-derived values.
- **Fix:** Added early guard `if (diff < 0) return 'just now';` before the existing threshold checks.
- **Test added:** `packages/rig/src/web/date-utils.test.ts` — new test "future timestamp (clock skew) returns 'just now'".

### Review Pass #3 (BMAD Code Review + Security Audit)
- **Date:** 2026-03-23
- **Reviewer Model:** Claude Opus 4.6 (1M context)
- **Issues Found:** 0 critical, 0 high, 1 medium, 0 low
- **Files Changed:** 2
- **Outcome:** PASS — 1 medium-severity issue found and fixed. Semgrep OWASP Top 10 + JS/TS rulesets (79 rules) returned 0 findings. Full manual review of OWASP Top 10, authentication/authorization, and injection risks completed.

#### Medium-1: Potential browser OOM from LCS computation on large file pairs
- **File:** `packages/rig/src/web/unified-diff.ts`
- **Severity:** Medium
- **Description:** The per-file 10,000-line guard prevents single-file abuse, but two files each just under 10K lines (e.g., 9,999 x 9,999 = ~100M entries) would allocate a ~800MB 2D array, potentially crashing the browser tab. This is a denial-of-service risk for diff views of large modified files.
- **Fix:** Added a `MAX_LCS_PRODUCT = 25_000_000` constant and a product-of-lines guard that returns the placeholder hunk when `oldLines.length * newLines.length` exceeds the limit. This caps the LCS table at ~200MB while still allowing reasonable diffs (e.g., 5000x5000 lines).
- **Test added:** `packages/rig/src/web/unified-diff.test.ts` — new test "two large files whose product exceeds LCS limit returns placeholder hunk".

#### Security Audit Summary
- **Tool:** Semgrep v1.x with `p/javascript` + `p/owasp-top-ten` rulesets (79 rules, 10 files scanned)
- **Automated findings:** 0
- **Manual review scope:** OWASP Top 10 (A01-A10), XSS injection, GraphQL injection, ReDoS, prototype pollution, open redirect, SSRF, DOM-based attacks
- **XSS prevention:** All user-supplied content (commit messages, author names, file names, diff content, path segments) passes through `escapeHtml()` from `escape.ts`. Verified in templates.ts commit log (line 352-362), commit diff (line 429-480), and breadcrumb rendering (lines 94-134, 293-321).
- **Injection risks:** GraphQL queries in `arweave-client.ts` use `sanitizeGraphQLValue()` + SHA format validation (`isValidGitSha()`). No user-controlled strings reach GraphQL without sanitization.
- **Open redirect:** `navigateTo()` in `router.ts` blocks absolute URLs and protocol-relative URLs. `parseRelayUrl()` restricts to `ws://` or `wss://` protocols only.
- **ReDoS:** The `parseAuthorIdent` regex `/^(.+?)\s+<([^>]*)>\s+(\d+)\s+([+-]\d{4})$/` uses lazy quantifier with anchors — safe from catastrophic backtracking.
- **Prototype pollution:** `Map<string, TreeEntry>` used for tree diff (not plain objects) — not susceptible.
- **DOM-based attacks:** All `innerHTML` assignments in `main.ts` use content built from escaped template functions. Each is annotated with `nosemgrep` comments.
