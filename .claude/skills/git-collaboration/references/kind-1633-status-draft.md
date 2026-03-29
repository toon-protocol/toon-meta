# Kind:1633 -- Status Draft

> **Progressive disclosure:** Level 3 per-kind reference for kind:1633 (draft status). For the full NIP-34 overview, see [nip-spec.md](nip-spec.md). For TOON economics, see [toon-extensions.md](toon-extensions.md).

## Purpose

Mark a patch, PR, or issue as draft (work in progress, not ready for review).

## Event Type

**Regular** -- each status change is a unique event.

## Content

Optional markdown (usually empty for drafts).

## Required Tags

| Tag | Format | Description |
|-----|--------|-------------|
| `e` | `["e", "<target-event-id>", "", "root"]` | Target event (patch/PR/issue) with `root` marker |

## Optional Tags

| Tag | Format | Description |
|-----|--------|-------------|
| `p` | `["p", "<target-author-pubkey>"]` | Target event author |
| `a` | `["a", "30617:<pubkey>:<repo-id>"]` | Repository for context |

## Validation Rules

- Draft status signals work-in-progress. Do not review draft PRs as if they were final.
- Typically published by the event's original author.

## Event Structure

```json
{
  "kind": 1633,
  "content": "",
  "tags": [
    ["e", "<pr-event-id>", "", "root"],
    ["p", "<pr-author-pubkey>"]
  ]
}
```

## Filter Pattern

```json
{"kinds": [1633], "#e": ["<event-id>"]}
```

## TOON Fee Estimate

Approximate size: 150-250 bytes. Cost at default `basePricePerByte` (10n): ~$0.002-$0.003.

Draft status events are the smallest git collaboration events.
