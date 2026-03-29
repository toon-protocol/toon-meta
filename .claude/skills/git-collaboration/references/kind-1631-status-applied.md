# Kind:1631 -- Status Applied/Merged

> **Progressive disclosure:** Level 3 per-kind reference for kind:1631 (applied/merged status). For the full NIP-34 overview, see [nip-spec.md](nip-spec.md). For TOON economics, see [toon-extensions.md](toon-extensions.md).

## Purpose

Mark a patch as applied, a PR as merged, or an issue as resolved.

## Event Type

**Regular** -- each status change is a unique event.

## Content

Optional markdown explaining the merge or resolution.

## Required Tags

| Tag | Format | Description |
|-----|--------|-------------|
| `e` | `["e", "<target-event-id>", "", "root"]` | Target event (patch/PR/issue) with `root` marker |

## Optional Tags

| Tag | Format | Description |
|-----|--------|-------------|
| `p` | `["p", "<target-author-pubkey>"]` | Target event author |
| `a` | `["a", "30617:<pubkey>:<repo-id>"]` | Repository for context |
| `merge-commit` | `["merge-commit", "<commit-hash>"]` | Merge commit hash (for PRs) |
| `applied-as-commits` | `["applied-as-commits", "<hash1>", "<hash2>"]` | Commits the patch was applied as |
| `r` | `["r", "<commit-hash>"]` | Related commit hash |

## Validation Rules

- Only maintainers (listed in kind:30617 `maintainers` tag) should publish kind:1631.
- kind:1631 on a PR should include `merge-commit` tag.
- kind:1631 on a patch should include `applied-as-commits` tags to credit the contributor.

## Event Structure

```json
{
  "kind": 1631,
  "content": "Merged. Great work on the reconnection logic.",
  "tags": [
    ["e", "<pr-event-id>", "", "root"],
    ["p", "<pr-author-pubkey>"],
    ["a", "30617:<your-pubkey>:toon-sdk"],
    ["merge-commit", "<merge-commit-hash>"]
  ]
}
```

## Filter Pattern

```json
{"kinds": [1631], "#e": ["<event-id>"]}
```

## TOON Fee Estimate

Approximate size: 250-400 bytes. Cost at default `basePricePerByte` (10n): ~$0.003-$0.004.

Status events are cheap. Lifecycle management is affordable.
