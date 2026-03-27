# NIP-34 Specification: Git Collaboration

> **Why this reference exists:** NIP-34 defines a complete decentralized git collaboration model using 12 event kinds spanning repository management, code contribution, issue tracking, and lifecycle status. Agents need to understand the tag structures, content formats, and relationships between these kinds to construct valid git collaboration events. TOON-specific economics are covered in toon-extensions.md.

## Overview

NIP-34 enables fully decentralized git workflows on Nostr. Maintainers announce repositories and publish authoritative branch state. Contributors submit patches or pull requests. Anyone can open issues and comment on collaboration events. Status events track the lifecycle of patches, PRs, and issues. Git objects can be stored permanently on Arweave via kind:5094 DVM requests.

The event kinds fall into four categories:

1. **Repository management** -- kind:30617 (announcement), kind:30618 (state)
2. **Code contribution** -- kind:1617 (patch), kind:1618 (pull request), kind:1619 (PR update)
3. **Issue tracking** -- kind:1621 (issue), kind:1622 (comment)
4. **Lifecycle status** -- kind:1630 (open), kind:1631 (applied/merged), kind:1632 (closed), kind:1633 (draft)
5. **Storage** -- kind:5094 (Arweave blob via DVM)

## Repository Announcement (kind:30617)

Announces a git repository and asserts maintainership.

- **Kind:** 30617
- **Event type:** Parameterized replaceable (updates replace previous announcement with same `d` tag)
- **Content:** Repository description text (may be empty; clients also check the `description` tag)

**Required tags:**

| Tag | Format | Description |
|-----|--------|-------------|
| `d` | `["d", "<repo-identifier>"]` | Repository identifier (e.g., `my-project`). Unique per author. |

**Optional tags:**

| Tag | Format | Description |
|-----|--------|-------------|
| `name` | `["name", "<display name>"]` | Human-readable repository name |
| `description` | `["description", "<text>"]` | Repository description |
| `web` | `["web", "<url>"]` | Web URL for browsing (multiple allowed) |
| `clone` | `["clone", "<url>"]` | Git clone URL (multiple allowed, e.g., `https://`, `git://`, `ssh://`) |
| `relays` | `["relays", "<relay-url>", ...]` | Preferred relays for this repository's events |
| `r` | `["r", "<earliest-unique-commit>", "euc"]` | Earliest unique commit hash with `euc` marker |
| `maintainers` | `["maintainers", "<pubkey-hex>", ...]` | List of maintainer pubkeys (hex, not npub) |
| `t` | `["t", "<topic>"]` | Topic tags for discovery. Use `["t", "personal-fork"]` to indicate a personal fork. |

**Validation rules:**
- The `d` tag is required and identifies the repository uniquely within the author's pubkey namespace.
- The repository address is `30617:<author-pubkey>:<d-tag-value>`.
- A `personal-fork` topic tag indicates the repo is a fork, not an original project.
- Multiple `clone` tags allow listing different protocol URLs (HTTPS, SSH, git://).
- Multiple `web` tags allow listing different browsing interfaces.

## Repository State (kind:30618)

Publishes the authoritative source of truth for branch heads and tags.

- **Kind:** 30618
- **Event type:** Parameterized replaceable
- **Content:** Empty string

**Required tags:**

| Tag | Format | Description |
|-----|--------|-------------|
| `d` | `["d", "<repo-identifier>"]` | Must match a kind:30617 repository announcement's `d` tag |

**Optional tags:**

| Tag | Format | Description |
|-----|--------|-------------|
| `refs/heads/*` | `["refs/heads/main", "<commit-hash>"]` | Branch head commit hash |
| `refs/tags/*` | `["refs/tags/v1.0.0", "<commit-hash>"]` | Tag commit hash |
| `HEAD` | `["HEAD", "ref: refs/heads/main"]` | Default branch reference |

**Validation rules:**
- The `d` tag must match an existing kind:30617 from the same author.
- Omitting all `refs/heads/*` and `refs/tags/*` tags means the maintainer has ceased tracking the repository.
- Each branch/tag is a separate tag entry. Multiple branches and tags are represented as multiple tags.
- Only the most recent kind:30618 event (by `created_at`) is authoritative.

**TOON codebase note:** The Forge-UI parser (`packages/rig/src/web/nip34-parsers.ts`) parses kind:30618 refs using `["r", "<ref-name>", "<commit-sha>"]` format (3-element `r` tags), not the tag-name-as-ref format shown above. Both formats exist in the wild. The NIP-34 spec uses tag names like `refs/heads/main` directly as tag keys, but the TOON parser expects `r` tags. When constructing kind:30618 events for TOON, prefer the `r` tag format for compatibility with existing parsers.

**TypeScript gap:** kind:30618 has NO constant or interface in `packages/core/src/nip34/constants.ts` or `types.ts`. The Forge-UI parser (`parseRepoRefs`) exists in `packages/rig/src/web/nip34-parsers.ts` but there is no core-level type support.

## Patch (kind:1617)

Submits code patches using `git format-patch` output.

- **Kind:** 1617
- **Event type:** Regular
- **Content:** Output of `git format-patch` -- the full patch text including commit message, author, and diff

**Required tags:**

| Tag | Format | Description |
|-----|--------|-------------|
| `a` | `["a", "30617:<pubkey>:<repo-id>"]` | Repository address |
| `r` | `["r", "<earliest-unique-commit>"]` | Earliest unique commit hash in the patch |

**Optional tags:**

| Tag | Format | Description |
|-----|--------|-------------|
| `p` | `["p", "<maintainer-pubkey>"]` | Maintainer to notify |
| `t` | `["t", "root"]` | Marks the first event in a patch series (cover letter or first patch) |
| `t` | `["t", "root-revision"]` | Marks a revision of a previously submitted patch series |
| `commit` | `["commit", "<commit-hash>"]` | Commit hash this patch represents |
| `parent-commit` | `["parent-commit", "<commit-hash>"]` | Parent commit hash |
| `commit-pgp-sig` | `["commit-pgp-sig", "<signature>"]` | PGP signature of the commit |
| `committer` | `["committer", "<name>", "<email>", "<timestamp>", "<timezone>"]` | Committer identity |
| `e` | `["e", "<prev-patch-event-id>", "", "reply"]` | Reply to previous patch in series (NIP-10 threading) |

**Validation rules:**
- Content must be valid `git format-patch` output.
- The first patch in a series should have `["t", "root"]` tag.
- Subsequent patches in the series use NIP-10 `e` reply tags to thread back to the first patch.
- A revision of a previously submitted series uses `["t", "root-revision"]` and an `e` tag referencing the original root patch.

## Pull Request (kind:1618)

Requests merging a branch by providing the branch tip and clone URLs.

- **Kind:** 1618
- **Event type:** Regular
- **Content:** Markdown description of the pull request

**Required tags:**

| Tag | Format | Description |
|-----|--------|-------------|
| `a` | `["a", "30617:<pubkey>:<repo-id>"]` | Repository address |
| `r` | `["r", "<earliest-unique-commit>"]` | Earliest unique commit hash |
| `c` | `["c", "<branch-tip-commit>"]` | PR branch tip commit hash |
| `clone` | `["clone", "<url>"]` | At least one clone URL where the branch can be fetched |

**Optional tags:**

| Tag | Format | Description |
|-----|--------|-------------|
| `p` | `["p", "<maintainer-pubkey>"]` | Maintainer to notify |
| `subject` | `["subject", "<title>"]` | PR title/subject line |
| `t` | `["t", "<label>"]` | Labels for categorization |
| `branch-name` | `["branch-name", "<name>"]` | Source branch name |
| `e` | `["e", "<root-patch-event-id>"]` | Root patch event if this PR is a revision |
| `merge-base` | `["merge-base", "<commit-hash>"]` | Merge base commit |

**Validation rules:**
- The tip commit (`c` tag) should be pushed to `refs/nostr/<event-id>` before signing, so reviewers can fetch it.
- At least one `clone` URL is required so reviewers can fetch the branch.
- Content is markdown describing the changes, motivation, and any testing done.

## PR Update (kind:1619)

Updates an existing PR's branch tip without creating a new PR event.

- **Kind:** 1619
- **Event type:** Regular
- **Content:** Empty string

**Required tags:**

| Tag | Format | Description |
|-----|--------|-------------|
| `a` | `["a", "30617:<pubkey>:<repo-id>"]` | Repository address |
| `r` | `["r", "<earliest-unique-commit>"]` | Earliest unique commit in the updated branch |
| `E` | `["E", "<pr-event-id>"]` | PR event ID (uppercase E -- NIP-22 root scope) |
| `P` | `["P", "<pr-author-pubkey>"]` | PR author pubkey (uppercase P -- NIP-22 root scope) |
| `c` | `["c", "<updated-tip-commit>"]` | Updated branch tip commit hash |
| `clone` | `["clone", "<url>"]` | Clone URL where the updated branch can be fetched |

**Optional tags:**

| Tag | Format | Description |
|-----|--------|-------------|
| `p` | `["p", "<maintainer-pubkey>"]` | Maintainer to notify |
| `merge-base` | `["merge-base", "<commit-hash>"]` | Updated merge base commit |

**Validation rules:**
- `E` and `P` are uppercase NIP-22 root scope tags, distinct from lowercase `e` and `p`.
- The `E` tag references the original kind:1618 PR event.
- The `P` tag references the original PR author's pubkey.

## Issue (kind:1621)

Reports bugs, requests features, or opens discussion topics.

- **Kind:** 1621
- **Event type:** Regular
- **Content:** Markdown text describing the issue

**Required tags:**

| Tag | Format | Description |
|-----|--------|-------------|
| `a` | `["a", "30617:<pubkey>:<repo-id>"]` | Repository address |
| `p` | `["p", "<repo-owner-pubkey>"]` | Repository owner's pubkey |

**Optional tags:**

| Tag | Format | Description |
|-----|--------|-------------|
| `subject` | `["subject", "<issue title>"]` | Issue title |
| `t` | `["t", "<label>"]` | Labels (e.g., `bug`, `enhancement`, `question`) |

**Validation rules:**
- Content is markdown describing the issue in detail.
- Replies to issues follow the NIP-22 comment standard using kind:1622 (not kind:1111).
- The `subject` tag serves as the issue title for display in client UIs.

## Comment (kind:1622)

Comments on issues, PRs, or patches.

- **Kind:** 1622
- **Event type:** Regular
- **Content:** Markdown text of the comment

**Required tags:**

| Tag | Format | Description |
|-----|--------|-------------|
| `e` | `["e", "<parent-event-id>", "", "reply"]` | Parent event being replied to (NIP-10 reply marker) |
| `p` | `["p", "<parent-author-pubkey>"]` | Parent event author's pubkey |

**Optional tags:**

| Tag | Format | Description |
|-----|--------|-------------|
| `a` | `["a", "30617:<pubkey>:<repo-id>"]` | Repository for context |

**Validation rules:**
- Threading uses NIP-10 markers. The `e` tag with `reply` marker points to the parent event. The 4-element `e` tag format is `["e", "<event-id>", "<relay-url-hint>", "<marker>"]` where the relay hint can be an empty string.
- Comments on comments create threaded discussions.
- The `a` tag provides repository context but is not strictly required.

**TypeScript gap:** kind:1622 has NO constant in `packages/core/src/nip34/constants.ts`. A browser-side parser (`parseComment`) exists in `packages/rig/src/web/nip34-parsers.ts` but there is no core-level constant or interface.

## Status Events (kind:1630-1633)

Set lifecycle status for patches, PRs, and issues.

| Kind | Status | Meaning |
|------|--------|---------|
| 1630 | Open | Newly opened or reopened |
| 1631 | Applied / Merged / Resolved | Patch applied, PR merged, or issue resolved |
| 1632 | Closed | Closed without merging/applying |
| 1633 | Draft | Work in progress, not ready for review |

- **Event type:** Regular
- **Content:** Optional markdown explaining the status change (e.g., reason for closing)

**Required tags:**

| Tag | Format | Description |
|-----|--------|-------------|
| `e` | `["e", "<target-event-id>", "", "root"]` | Target event (patch/PR/issue) with `root` marker |

**Optional tags:**

| Tag | Format | Description |
|-----|--------|-------------|
| `e` | `["e", "<accepted-revision-id>", "", "reply"]` | Accepted revision (for kind:1631 on patch series) |
| `p` | `["p", "<target-author-pubkey>"]` | Target event author |
| `a` | `["a", "30617:<pubkey>:<repo-id>"]` | Repository for context |
| `r` | `["r", "<commit-hash>"]` | Related commit hash |
| `q` | `["q", "<applied-patch-event-id>"]` | Applied patch event ID (for kind:1631) |
| `merge-commit` | `["merge-commit", "<commit-hash>"]` | Merge commit hash (for kind:1631 on PRs) |
| `applied-as-commits` | `["applied-as-commits", "<hash1>", "<hash2>", ...]` | Commits the patch was applied as (for kind:1631) |

**Validation rules:**
- The most recent status event from the target event's author or a repository maintainer is authoritative.
- Only maintainers (listed in kind:30617 `maintainers` tag) should publish kind:1631 (applied/merged) status.
- Revision status inherits the root event's status, or becomes closed if the root is merged.
- A kind:1631 on a PR should include `merge-commit` tag. A kind:1631 on a patch should include `applied-as-commits` tags.

## Arweave Blob Storage DVM (kind:5094)

Uploads git objects (blob, tree, commit) to Arweave via DVM job request. **Note:** kind:5094 is NOT a NIP-34 kind. It is a NIP-90 DVM job request kind used for Arweave blob storage, included here as a cross-NIP reference because git collaboration depends on blob storage.

- **Kind:** 5094
- **Event type:** Regular (DVM job request)
- **Content:** Empty string (blob data goes in the `i` tag)

**Required tags (per TOON codebase `packages/core/src/events/arweave-storage.ts`):**

| Tag | Format | Description |
|-----|--------|-------------|
| `i` | `["i", "<base64-encoded-blob>", "blob"]` | Base64-encoded blob data with type marker |
| `bid` | `["bid", "<amount>", "usdc"]` | Bid amount in USDC micro-units |
| `output` | `["output", "<content-type>"]` | Expected output MIME type (e.g., `application/octet-stream`) |

**Optional tags (chunked uploads):**

| Tag | Format | Description |
|-----|--------|-------------|
| `param` | `["param", "uploadId", "<uuid>"]` | Upload session ID for chunked uploads |
| `param` | `["param", "chunkIndex", "<index>"]` | Chunk index (0-based) |
| `param` | `["param", "totalChunks", "<count>"]` | Total chunks in upload |
| `param` | `["param", "contentType", "<mime>"]` | Content MIME type |

**Git-specific tags (for Arweave resolution):**

| Tag | Format | Description |
|-----|--------|-------------|
| `Git-SHA` | `["Git-SHA", "<sha-hash>"]` | Content-addressed SHA hash of the git object |
| `Git-Type` | `["Git-Type", "<type>"]` | Git object type: `blob`, `tree`, or `commit` |
| `Repo` | `["Repo", "<repo-identifier>"]` | Repository identifier |

**Resolution:**
- Arweave GraphQL queries by `Git-SHA`, `Git-Type`, and `Repo` tags
- Manifest transactions for repository-level resolution
- Gateway URLs: `https://arweave.net/<tx-id>`
- Free uploads up to 100KB via `TurboFactory.unauthenticated()` (dev mode)
- Authenticated/paid uploads for production via `@ardrive/turbo-sdk`

## Cross-Kind Relationships

```
kind:30617 (Repo Announcement)
  |
  +-- kind:30618 (Repo State) -- d tag matches
  |
  +-- kind:1617 (Patch) -- a tag references
  |     +-- kind:1617 (Patch 2/N) -- e tag threads
  |     +-- kind:1622 (Comment) -- e tag replies
  |     +-- kind:1630-1633 (Status) -- e tag with root marker
  |
  +-- kind:1618 (Pull Request) -- a tag references
  |     +-- kind:1619 (PR Update) -- E tag references
  |     +-- kind:1622 (Comment) -- e tag replies
  |     +-- kind:1630-1633 (Status) -- e tag with root marker
  |
  +-- kind:1621 (Issue) -- a tag references
  |     +-- kind:1622 (Comment) -- e tag replies
  |     +-- kind:1630-1633 (Status) -- e tag with root marker
  |
  +-- kind:5094 (Arweave Blob) -- Repo tag references
```
