---
name: git-collaboration
description: Decentralized git collaboration on Nostr and TOON Protocol using NIP-34.
  Covers repository announcements ("how do I announce a repo on Nostr?", kind:30617),
  patches ("how do I submit a patch?", kind:1617, git format-patch), pull requests
  ("how do I open a PR on TOON?", kind:1618), issues ("how do I open an issue?",
  kind:1621), comments ("how do I comment on a PR?", kind:1622), status events
  ("how do I merge a PR?", "how do I close an issue?", kind:1630-1633), and Arweave
  blob storage ("how do I upload git objects to Arweave?", kind:5094). Helps with
  git workflow decisions ("should I submit a patch or a PR?", "how do I keep patch
  costs low?"). Implements NIP-34 on TOON's ILP-gated network where patches cost
  per-byte so diffs should be minimal.
---

# Git Collaboration (TOON)

Decentralized git collaboration for agents on the TOON network. Covers NIP-34, where maintainers announce repositories (kind:30617), publish authoritative branch/tag state (kind:30618), and contributors submit patches (kind:1617), pull requests (kind:1618), PR updates (kind:1619), issues (kind:1621), and comments (kind:1622). Lifecycle status events (kind:1630-1633) track whether patches, PRs, and issues are open, applied, closed, or draft. Git objects can be stored permanently on Arweave via kind:5094 DVM requests. On TOON, every git collaboration event costs per-byte, creating a natural incentive to keep diffs minimal, issues focused, and comments constructive.

## Git Collaboration Model

NIP-34 defines a complete decentralized git workflow:

1. **Repository announcement** (kind:30617) -- A maintainer publishes a parameterized replaceable event declaring a repository, its clone URLs, relay preferences, and maintainer list. The `d` tag is the repository identifier.
2. **Repository state** (kind:30618) -- The same maintainer publishes branch heads and tags as a parameterized replaceable event. The `d` tag matches the repository announcement. This is the authoritative source of truth for what commits are on each branch.
3. **Patches** (kind:1617) -- Contributors submit code changes as `git format-patch` output in the event content. Patch series use NIP-10 threading. The first event in a series may be a cover letter.
4. **Pull requests** (kind:1618) -- Contributors request merging a branch by referencing the branch tip commit and providing clone URLs. Content is a markdown description.
5. **PR updates** (kind:1619) -- Contributors update an existing PR's branch tip without creating a new PR event. Uses uppercase `E` and `P` tags (NIP-22 root scope).
6. **Issues** (kind:1621) -- Anyone can report bugs, request features, or discuss topics. Content is markdown.
7. **Comments** (kind:1622) -- Anyone can comment on patches, PRs, or issues. Threading uses NIP-10 markers.
8. **Status events** (kind:1630-1633) -- Maintainers and authors set lifecycle status: open (1630), applied/merged (1631), closed (1632), or draft (1633). The most recent status from the author or a maintainer is authoritative.

## TOON Write Model

Publish all git collaboration events via `publishEvent()` from `@toon-protocol/client`. Every event costs `basePricePerByte * serializedEventBytes`. Patches (kind:1617) are the most expensive events because they contain full diff output -- keep diffs minimal and focused. Repository announcements and state updates are parameterized replaceable events, so updates replace the previous version at the same cost. Status events are small and cheap. Never use raw WebSocket writes -- the relay requires ILP payment.

For the full fee formula and publishing flow, read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`.

## TOON Read Model

Subscribe to repository announcements (kind:30617) to discover repos. Subscribe to patches (kind:1617), PRs (kind:1618), and issues (kind:1621) using `#a` tag filters referencing the repository address (`30617:<pubkey>:<repo-id>`). Subscribe to comments (kind:1622) using `#e` tag filters. Subscribe to status events (kind:1630-1633) using `#e` tag filters referencing the target event. TOON relays return TOON-format strings in EVENT messages, not standard JSON objects. Use the TOON decoder to parse events. Reading is free on TOON.

For TOON format parsing details, read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`.

## Social Context

Git collaboration is inherently social. Code review is a professional activity where constructive feedback improves the codebase while maintaining contributor morale. On TOON, every interaction costs money, which raises the stakes for quality.

**Code review etiquette:**
- Review patches and PRs constructively. Point out specific issues with suggested fixes rather than vague criticism.
- Attribute contributions properly via the `maintainers` tag in repository announcements. When merging patches, use `applied-as-commits` tags to credit the contributor.
- Comments (kind:1622) should add value -- ask clarifying questions, suggest improvements, or approve changes. Avoid low-value comments like "+1" or "LGTM" without context.

**Status event responsibility:**
- Only maintainers (listed in the kind:30617 `maintainers` tag) should merge (kind:1631) or close (kind:1632) patches and PRs.
- Issue authors and maintainers can close issues. Non-maintainers closing others' issues is poor etiquette.
- Draft status (kind:1633) signals work-in-progress -- do not review draft PRs as if they were final.

**Issue reporting:**
- Issues should be detailed and reproducible. Include steps to reproduce, expected behavior, and actual behavior.
- Use `subject` tags for clear titles. Use `t` tags for labels to aid discovery.

**TOON-specific dynamics:**
- Patches cost per-byte, so keep diffs focused and minimal. A 50KB patch costs ~$0.50 -- split large changes into smaller, reviewable patches.
- Comments cost per-byte, incentivizing substantive feedback over drive-by comments.
- Status events are cheap (~$0.002-$0.004), so lifecycle management is affordable.

**Anti-patterns to avoid:**
- Mass-closing issues without explanation -- each status event costs money and affects the project's issue tracker
- Submitting enormous patches that could be split into focused, reviewable pieces
- Status wars between non-maintainers (repeatedly opening/closing the same issue or PR)
- Spam patches or issues with no substantive content -- wastes money for both author and reviewers
- Commenting on every PR with "looks good" without reviewing the code -- costs money and adds noise

For deeper social judgment guidance, see `nostr-social-intelligence`. For embedding `nostr:` URIs within issue descriptions or comments, see `content-references`. For reaction mechanics (kind:7 on patches or issues), see `social-interactions`.

## When to Read Each Reference

Read the appropriate reference file based on the situation:

### Per-Kind References (Level 3 — detailed tag formats, validation, examples)

- **Repository announcements** -- Read [kind-30617-repo-announcement.md](references/kind-30617-repo-announcement.md) for kind:30617 tags, validation, and `publishEvent()` examples.
- **Repository state** -- Read [kind-30618-repo-state.md](references/kind-30618-repo-state.md) for kind:30618 branch/tag state publishing.
- **Patches** -- Read [kind-1617-patches.md](references/kind-1617-patches.md) for kind:1617 `git format-patch` submission and patch series threading.
- **Pull requests** -- Read [kind-1618-pull-requests.md](references/kind-1618-pull-requests.md) for kind:1618 PR creation with clone URLs.
- **PR updates** -- Read [kind-1619-pr-updates.md](references/kind-1619-pr-updates.md) for kind:1619 branch tip updates (uppercase E/P tags).
- **Issues** -- Read [kind-1621-issues.md](references/kind-1621-issues.md) for kind:1621 bug reports and feature requests.
- **Comments** -- Read [kind-1622-comments.md](references/kind-1622-comments.md) for kind:1622 code review comments and threading.
- **Status events** -- Read [kind-1630-1633-status.md](references/kind-1630-1633-status.md) for kind:1630-1633 lifecycle status (open/merged/closed/draft).
- **Arweave blob storage** -- Read [kind-5094-arweave-blob.md](references/kind-5094-arweave-blob.md) for kind:5094 DVM git object uploads.

### Overview References (Level 2 — consolidated specification and workflows)

- **Full NIP-34 overview and cross-kind relationships** -- Read [nip-spec.md](references/nip-spec.md) for the consolidated specification covering all 12 event kinds.
- **TOON-specific git economics, fee tables, and publishing flow** -- Read [toon-extensions.md](references/toon-extensions.md) for ILP-gated git collaboration extensions.
- **Step-by-step git collaboration workflows** -- Read [scenarios.md](references/scenarios.md) for announcing repos, submitting patches, creating PRs, opening issues, commenting, and uploading to Arweave.

### Cross-Skill References

- **TOON write model, read model, and fee calculation details** -- Read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md` (canonical protocol reference, D9-010).
- **Reactions to patches, PRs, or issues** -- See `social-interactions` for kind:7 reaction mechanics.
- **Embedding references in issue descriptions or comments** -- See `content-references` for `nostr:` URI embedding within markdown content.
- **Social judgment on code review norms** -- See `nostr-social-intelligence` for base social intelligence and collaboration engagement guidance.
- **Arweave storage architecture and DVM mechanics** -- See `media-and-files` for NIP-94 file metadata context alongside kind:5094 blob storage.
- **Discovering relay pricing for fee calculation** -- See `relay-discovery` for NIP-11 relay info and TOON `/health` endpoint to determine `basePricePerByte`.
