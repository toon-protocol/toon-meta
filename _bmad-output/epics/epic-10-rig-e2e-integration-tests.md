# Epic 10: Rig E2E Integration Test Suite

**Epic ID:** 10
**Status:** DRAFT
**Author:** Bob (Technical Scrum Master)
**Date:** 2026-03-29
**Decision Source:** Party Mode 2026-03-29 — Rig E2E Integration Tests

---

## Goal / Objective

Deliver robust, high-coverage E2E integration tests for the Rig (Forge-UI) using real SDK E2E infrastructure — no mocks. Seed scripts perform incremental git pushes via ToonClient + ILP through Arweave DVM, then Playwright specs verify every read-side UI flow. Covers: repo browsing, nested file/folder navigation (known regression), branches, tags, PRs, issues, multi-client conversations, labels, and status lifecycle.

---

## Dependencies

- **Epic 8 (The Rig — Arweave DVM + Forge-UI):** All read-side UI implemented
- **Epic 9 (NIP-to-TOON Skill Pipeline):** NIP-34 skills documented
- **SDK E2E Infrastructure:** `./scripts/sdk-e2e-infra.sh up` (Anvil + 2 Docker peers)
- **Peer1 Arweave DVM:** ArDrive Turbo free tier (<=100KB per upload)

---

## Architecture

**Three-layer test architecture:**

1. **Seed Layer** — TypeScript scripts using ToonClient (`@toon-protocol/client`) to publish Nostr events and upload git objects via ILP. Incremental pushes mimic real git workflow.
2. **Orchestrator** — Playwright `globalSetup` runs all seed scripts in sequence, exports state for specs.
3. **Spec Layer** — Playwright browser E2E specs verify read-side UI rendering against seeded data.

**Infrastructure topology:**
```
Anvil (18545) --- Peer1 (BLS:19100, Arweave DVM) --- Peer2 (BLS:19110)
                       |
                  ToonClient(s) [Alice, Bob, Charlie]
                       |
                  Forge UI (http://localhost:5173, Vite dev server)
```

**Key design decisions:**
- **Incremental pushes (not bulk upload):** Each push adds a small set of git objects, staying under 100KB Arweave free tier. Creates real commit history with parent chains.
- **Multi-client:** 3 ToonClient instances (Anvil accounts #3/#4/#5) with distinct Nostr keypairs for multi-author conversations.
- **No mocks:** All events flow through real ILP payment channels, real relays, real Arweave DVM.
- **Read-side only:** Write-side handlers are stubs; E2E tests verify UI rendering of seeded data.

---

## Story Breakdown

| # | Story | Dependencies | Size |
|---|---|---|---|
| 10.1 | Test Infrastructure & Shared Seed Library | None | L |
| 10.2 | Seed Script — Initial Repo Push (Push 1) | 10.1 | M |
| 10.3 | Seed Script — Nested Directory Structure (Push 2) | 10.2 | M |
| 10.4 | Seed Script — Feature Branch (Pushes 3-4) | 10.3 | M |
| 10.5 | Seed Script — Tag (Push 5) | 10.4 | S |
| 10.6 | Seed Script — PRs with Status (Push 6) | 10.4 | M |
| 10.7 | Seed Script — Issues, Labels, Conversations (Push 7) | 10.1 | M |
| 10.8 | Seed Script — Merge PR & Close Issue (Push 8) | 10.6, 10.7 | S |
| 10.9 | Seed Orchestrator | 10.2-10.8 | M |
| 10.10 | Playwright Spec — Repo List & Home | 10.9 | M |
| 10.11 | Playwright Spec — Deep Navigation Regression | 10.9 | L |
| 10.12 | Playwright Spec — File Viewing | 10.9 | M |
| 10.13 | Playwright Spec — Branch Switching | 10.9 | M |
| 10.14 | Playwright Spec — Tag Viewing | 10.9 | S |
| 10.15 | Playwright Spec — Commit Log & Detail | 10.9 | M |
| 10.16 | Playwright Spec — Issue List & Detail | 10.9 | L |
| 10.17 | Playwright Spec — PR List & Detail | 10.9 | L |
| 10.18 | Playwright Spec — Blame View | 10.9 | M |

**Estimated Complexity:** XL (18 stories, new test infrastructure, seed scripts, 9 Playwright spec files)

---

## Story Details

### Story 10.1: Test Infrastructure & Shared Seed Library

**Goal:** Set up Playwright E2E infrastructure and shared seed utilities.

**Acceptance Criteria:**

- [ ] AC-1.1: `packages/rig/tests/e2e/seed/lib/clients.ts` creates 3 ToonClient instances (Alice/Bob/Charlie) using Anvil accounts #3/#4/#5, each with distinct Nostr keypairs
- [ ] AC-1.2: `packages/rig/tests/e2e/seed/lib/git-builder.ts` wraps `buildGitBlob()`, `buildGitTree()`, `buildGitCommit()` with SHA-to-txId tracking across pushes; uploads only new objects via kind:5094 DVM
- [ ] AC-1.3: `packages/rig/tests/e2e/seed/lib/publish.ts` wraps `publishEvent()` with ILP claim signing (basePricePerByte=10, TOON byte length calculation)
- [ ] AC-1.4: `packages/rig/tests/e2e/seed/lib/constants.ts` re-exports all docker-e2e-setup constants (PEER1_*, TOKEN_*, ANVIL_RPC, etc.)
- [ ] AC-1.5: `packages/rig/playwright.config.ts` updated — `globalSetup` runs seed orchestrator, baseURL `http://localhost:5173`, webServer starts `pnpm dev`
- [ ] AC-1.6: `packages/rig/tests/e2e/seed/lib/event-builders.ts` provides builders for kind:30617 (repo announcement), kind:30618 (refs), kind:1621 (issue), kind:1622 (comment), kind:1617 (PR/patch), kind:1630-1633 (status), with correct NIP-34 tag structures (`a`, `e`, `d`, `subject`, `t`, `r`, `arweave` tags)
- [ ] AC-1.7: All seed libs use `@toon-protocol/client` ToonClient — never SDK `createNode`

---

### Story 10.2: Seed Script — Initial Repo Push (Push 1)

**Goal:** First push creates repo announcement, initial commit with root-level files, and refs.

**Acceptance Criteria:**

- [ ] AC-2.1: `seed/push-01-init.ts` creates git objects for: `README.md`, `package.json`, `src/index.ts` — 3 blobs, 2 trees (root + `src/`), 1 commit
- [ ] AC-2.2: Each git object uploaded to Arweave via kind:5094 DVM through Peer1 — all txIds captured
- [ ] AC-2.3: kind:30617 repo announcement published with `d` tag (repo ID), `name`, `description`, `r` tag with HEAD->main
- [ ] AC-2.4: kind:30618 refs published with `r` tag `["r", "refs/heads/main", "<commit-sha>"]` and `arweave` tags for all SHA-to-txId mappings
- [ ] AC-2.5: SHA-to-txId map persisted to `seed/state.json` for subsequent pushes
- [ ] AC-2.6: Published via Alice's ToonClient with valid ILP claims

---

### Story 10.3: Seed Script — Nested Directory Structure (Push 2)

**Goal:** Second push adds deep directory nesting to exercise the known depth bug.

**Acceptance Criteria:**

- [ ] AC-3.1: `seed/push-02-nested.ts` adds files at increasing depths: `src/lib/core.ts` (depth 2), `src/lib/utils/format.ts` (depth 3), `src/lib/utils/helpers/deep-file.ts` (depth 4), `docs/guide.md` (depth 1)
- [ ] AC-3.2: Only new/changed git objects uploaded (delta from Push 1's SHA map)
- [ ] AC-3.3: New commit has parent = Push 1's commit SHA
- [ ] AC-3.4: kind:30618 refs updated — main branch advances, arweave map includes all objects from both pushes
- [ ] AC-3.5: State file updated with new SHA-to-txId entries

---

### Story 10.4: Seed Script — Feature Branch (Pushes 3-4)

**Goal:** Create a feature branch with two commits to test branch switching and commit history.

**Acceptance Criteria:**

- [ ] AC-4.1: `seed/push-03-branch.ts` creates branch `feature/add-retry` from main HEAD, adds `src/lib/retry.ts` with new commit
- [ ] AC-4.2: `seed/push-04-branch-work.ts` adds a second commit on `feature/add-retry` modifying `src/index.ts` (import retry) and adding `src/lib/retry.test.ts`
- [ ] AC-4.3: kind:30618 refs includes both `refs/heads/main` and `refs/heads/feature/add-retry` with correct SHAs
- [ ] AC-4.4: Commit graph: Push 4 commit -> Push 3 commit -> Push 2 commit (parent chain intact)
- [ ] AC-4.5: Branch-specific files only appear on the feature branch, not main

---

### Story 10.5: Seed Script — Tag (Push 5)

**Goal:** Tag v1.0.0 on main HEAD.

**Acceptance Criteria:**

- [ ] AC-5.1: `seed/push-05-tag.ts` adds `refs/tags/v1.0.0` pointing to main's HEAD commit SHA
- [ ] AC-5.2: kind:30618 refs includes the tag alongside branches
- [ ] AC-5.3: No new git objects needed (tag points to existing commit)

---

### Story 10.6: Seed Script — PRs with Status (Push 6)

**Goal:** Open PRs as patches with status events.

**Acceptance Criteria:**

- [ ] AC-6.1: `seed/push-06-prs.ts` publishes 2 kind:1617 PR events: PR #1 "feat: add retry logic" by Alice (branch tag: `feature/add-retry`, commit tags for both feature commits, `a` tag referencing repo); PR #2 "fix: update docs" by Charlie (single commit SHA, `a` tag referencing repo)
- [ ] AC-6.2: kind:1630 (Open) status event published for PR #2 (referencing PR event ID via `e` tag)
- [ ] AC-6.3: kind:1631 (Merged/Applied) status event published for PR #1
- [ ] AC-6.4: All events signed by correct author keypairs (Alice for PR #1, Charlie for PR #2)

---

### Story 10.7: Seed Script — Issues, Labels, Conversations (Push 7)

**Goal:** Create issues with labels and multi-client comment threads.

**Acceptance Criteria:**

- [ ] AC-7.1: `seed/push-07-issues.ts` publishes 2 kind:1621 issues: Issue #1 "Add WebSocket reconnection logic" by Alice (t tags: enhancement, networking); Issue #2 "Fix deep path navigation bug" by Bob (t tags: bug, forge-ui). Both with `a` tag referencing repo.
- [ ] AC-7.2: Comment thread on Issue #1 (kind:1622, e tag -> issue event ID): Bob: "Should we use exponential backoff?", Alice: "Yes, with jitter. See RFC 6298.", Charlie: "What about connection pooling?"
- [ ] AC-7.3: Comment thread on Issue #2: Alice: "Reproduced at depth 3+", Bob: "Root cause is in tree SHA resolution"
- [ ] AC-7.4: All comments have correct `e` tag pointing to parent issue event ID and `p` tag for author threading

---

### Story 10.8: Seed Script — Merge PR & Close Issue (Push 8)

**Goal:** Publish status events to close issue #2 and confirm PR #1 merged.

**Acceptance Criteria:**

- [ ] AC-8.1: `seed/push-08-close.ts` publishes kind:1632 (Closed) for Issue #2 (via `e` tag referencing issue event ID)
- [ ] AC-8.2: Verifies PR #1 already has kind:1631 from Push 6 (no duplicate needed)
- [ ] AC-8.3: All events signed by appropriate authors

---

### Story 10.9: Seed Orchestrator

**Goal:** Single entry point that runs all pushes in sequence, waits for relay availability, and exports state.

**Acceptance Criteria:**

- [ ] AC-9.1: `seed/seed-all.ts` checks services ready via `checkAllServicesReady()`
- [ ] AC-9.2: Runs push-01 through push-08 in sequence, each receiving the accumulated SHA-to-txId map from prior pushes
- [ ] AC-9.3: Exports final state (repo ID, owner pubkey, event IDs for issues/PRs/comments, branch names, tag names) to `seed/state.json`
- [ ] AC-9.4: Configured as Playwright `globalSetup` — runs once before all specs
- [ ] AC-9.5: Skips seeding if `state.json` exists and is fresh (< 10 min) to speed up re-runs
- [ ] AC-9.6: Total seed time < 60 seconds

---

### Story 10.10: Playwright Spec — Repo List & Home

**Goal:** Verify repo appears in list and home page renders file tree.

**Acceptance Criteria:**

- [ ] AC-10.1: `specs/repo-list.spec.ts` — navigates to `/#/`, verifies repo name appears in card
- [ ] AC-10.2: Clicks repo card, navigates to `/#/:owner/:repo`
- [ ] AC-10.3: Home page shows FileTree with root entries: `README.md`, `package.json`, `src/`, `docs/`
- [ ] AC-10.4: Directories sort before files
- [ ] AC-10.5: README content renders below the file tree

---

### Story 10.11: Playwright Spec — Deep Navigation Regression

**Goal:** Parametric test navigating file tree to depth 4.

**Acceptance Criteria:**

- [ ] AC-11.1: `specs/deep-nav.spec.ts` — from repo home, clicks `src/` -> verifies `lib/` and `index.ts` visible
- [ ] AC-11.2: Clicks `lib/` -> verifies `core.ts`, `utils/` visible
- [ ] AC-11.3: Clicks `utils/` -> verifies `format.ts`, `helpers/` visible
- [ ] AC-11.4: Clicks `helpers/` -> verifies `deep-file.ts` visible
- [ ] AC-11.5: Clicks `deep-file.ts` -> FileViewer renders file content (not "file not found")
- [ ] AC-11.6: Each depth level verifies breadcrumb path updates correctly
- [ ] AC-11.7: Browser back navigation works at each level

---

### Story 10.12: Playwright Spec — File Viewing

**Goal:** Verify file content rendering for code and markdown files.

**Acceptance Criteria:**

- [ ] AC-12.1: `specs/file-view.spec.ts` — navigates to `README.md` blob, verifies markdown preview renders
- [ ] AC-12.2: Code tab shows raw content with line numbers
- [ ] AC-12.3: Navigates to `src/index.ts`, verifies code content displayed
- [ ] AC-12.4: File header shows line count and file size
- [ ] AC-12.5: Binary detection does NOT trigger for text files

---

### Story 10.13: Playwright Spec — Branch Switching

**Goal:** Verify branch selector and content changes per branch.

**Acceptance Criteria:**

- [ ] AC-13.1: `specs/branch-switch.spec.ts` — on repo home (main branch), verifies BranchSelector shows "main"
- [ ] AC-13.2: Opens BranchSelector popover, verifies both `main` and `feature/add-retry` listed
- [ ] AC-13.3: Selects `feature/add-retry`, verifies file tree updates — `src/lib/retry.ts` and `src/lib/retry.test.ts` now visible
- [ ] AC-13.4: Switches back to `main`, verifies `retry.ts` is NOT in the file tree
- [ ] AC-13.5: URL updates to reflect selected branch in path

---

### Story 10.14: Playwright Spec — Tag Viewing

**Goal:** Verify tag appears in selector and pins content to tagged commit.

**Acceptance Criteria:**

- [ ] AC-14.1: `specs/tag-view.spec.ts` — opens BranchSelector, verifies `v1.0.0` tag listed
- [ ] AC-14.2: Selects `v1.0.0`, file tree matches main's state at that commit
- [ ] AC-14.3: URL updates to reflect tag

---

### Story 10.15: Playwright Spec — Commit Log & Detail

**Goal:** Verify commit history and individual commit view.

**Acceptance Criteria:**

- [ ] AC-15.1: `specs/commit-log.spec.ts` — navigates to Commits tab, verifies multiple commits listed
- [ ] AC-15.2: Commits show abbreviated SHA (7 chars), message, author, relative date
- [ ] AC-15.3: Commits grouped by date
- [ ] AC-15.4: Clicks a commit, navigates to commit detail page
- [ ] AC-15.5: `specs/commit-detail.spec.ts` — commit detail shows full message, author, parent SHA(s)
- [ ] AC-15.6: DiffView renders changed files

---

### Story 10.16: Playwright Spec — Issue List & Detail

**Goal:** Verify issue listing, filtering, and comment threads with multi-author attribution.

**Acceptance Criteria:**

- [ ] AC-16.1: `specs/issue-list.spec.ts` — navigates to Issues tab, verifies 2 issues listed
- [ ] AC-16.2: Open/Closed toggle shows correct counts (1 open, 1 closed)
- [ ] AC-16.3: Issue #1 shows labels "enhancement", "networking" as badges
- [ ] AC-16.4: Clicking "Closed" filter shows Issue #2 with closed status
- [ ] AC-16.5: `specs/issue-detail.spec.ts` — clicks Issue #1, verifies title "Add WebSocket reconnection logic"
- [ ] AC-16.6: Comment thread shows 3 comments in chronological order
- [ ] AC-16.7: Each comment attributed to correct author (different pubkeys -> different display names/identifiers)
- [ ] AC-16.8: Issue #2 detail shows "closed" status badge

---

### Story 10.17: Playwright Spec — PR List & Detail

**Goal:** Verify PR listing, status badges, and conversation/files tabs.

**Acceptance Criteria:**

- [ ] AC-17.1: `specs/pr-list.spec.ts` — navigates to Pulls tab, verifies 2 PRs listed
- [ ] AC-17.2: PR #1 shows "Merged" badge (secondary variant)
- [ ] AC-17.3: PR #2 shows "Open" badge (default variant)
- [ ] AC-17.4: `specs/pr-detail.spec.ts` — clicks PR #1, verifies title, target branch display ("-> main")
- [ ] AC-17.5: Conversation tab shows comment thread (if seeded)
- [ ] AC-17.6: Files Changed tab shows diff with changed files count badge
- [ ] AC-17.7: Switching between Conversation and Files Changed tabs works

---

### Story 10.18: Playwright Spec — Blame View

**Goal:** Verify blame view renders with commit attribution per line.

**Acceptance Criteria:**

- [ ] AC-18.1: `specs/blame.spec.ts` — navigates to a file, switches to Blame view
- [ ] AC-18.2: Blame gutter shows commit SHA (7 chars), author, relative date
- [ ] AC-18.3: Line numbers displayed correctly
- [ ] AC-18.4: Code content matches file content

---

## File Structure

```
packages/rig/tests/e2e/
  seed/
    push-01-init.ts
    push-02-nested.ts
    push-03-branch.ts
    push-04-branch-work.ts
    push-05-tag.ts
    push-06-prs.ts
    push-07-issues.ts
    push-08-close.ts
    seed-all.ts              # Orchestrator (Playwright globalSetup)
    state.json               # Generated at runtime, gitignored
    lib/
      clients.ts             # 3 ToonClient instances (Alice, Bob, Charlie)
      constants.ts           # Re-export docker-e2e-setup constants
      event-builders.ts      # NIP-34 event kind builders
      git-builder.ts         # Git object construction + SHA-to-txId tracking
      publish.ts             # publishEvent + ILP claim wrapper
  specs/
    repo-list.spec.ts
    deep-nav.spec.ts
    file-view.spec.ts
    branch-switch.spec.ts
    tag-view.spec.ts
    commit-log.spec.ts
    commit-detail.spec.ts
    issue-list.spec.ts
    issue-detail.spec.ts
    pr-list.spec.ts
    pr-detail.spec.ts
    blame.spec.ts
  playwright.config.ts       # Updated with globalSetup + SDK E2E prereqs
```

---

## Execution Order

1. **Stories 10.1** (infra) -- foundation
2. **Stories 10.2-10.8** (seed scripts) -- can be partially parallelized
3. **Story 10.9** (orchestrator) -- depends on all seeds
4. **Stories 10.10-10.18** (Playwright specs) -- can be fully parallelized across devs

---

## Seeded Data Summary

After all seed scripts complete:

- **1 repository** with kind:30617 announcement
- **4+ commits** across 2 branches (main + feature/add-retry)
- **1 tag** (v1.0.0)
- **4-level deep directory structure** (src/lib/utils/helpers/deep-file.ts)
- **2 PRs** (1 merged, 1 open) with kind:1617 + kind:1630/1631 statuses
- **2 issues** (1 open, 1 closed) with kind:1621 + kind:1632 close events
- **5+ comments** across issues with 3 distinct authors (kind:1622)
- **Labels** on issues (enhancement, networking, bug, forge-ui)

---

## Risk Factors

1. **Arweave free tier latency:** GraphQL indexing may lag. Mitigated by `seedShaCache()` from kind:30618 arweave tags.
2. **Nested navigation depth bug:** Known issue — this epic is designed to catch and prevent regression.
3. **Multi-client payment channels:** Each ToonClient needs its own payment channel on Anvil. May require sequential bootstrapping.
4. **Seed script fragility:** If Arweave DVM upload fails, subsequent pushes break. Orchestrator must handle gracefully.
