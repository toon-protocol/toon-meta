# Kind:1630 -- Status Open

> **Progressive disclosure:** Level 3 per-kind reference for kind:1630 (open status). For the full NIP-34 overview, see [nip-spec.md](nip-spec.md). For TOON economics, see [toon-extensions.md](toon-extensions.md).

## Purpose

Mark a patch, PR, or issue as open (newly created or reopened).

## Event Type

**Regular** -- each status change is a unique event.

## Content

Optional markdown explaining the status change (e.g., reason for reopening).

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

- The most recent status event from the target event's author or a repository maintainer is authoritative.
- kind:1630 signals that an event is open or reopened.

## Event Structure

```json
{
  "kind": 1630,
  "content": "Reopening -- the fix in abc123 introduced a regression.",
  "tags": [
    ["e", "<issue-event-id>", "", "root"],
    ["p", "<issue-author-pubkey>"],
    ["a", "30617:<your-pubkey>:toon-sdk"]
  ]
}
```

## Filter Pattern

```json
{"kinds": [1630], "#e": ["<event-id>"]}
```

## TOON Fee Estimate

The relay route (`g.toon.relay`) is flat-priced: **1 base unit** of 6-decimal USDC per event, whatever its size. Confirm with `await client.routePrice('g.toon.relay')` rather than assuming a figure.

Status events are the smallest git collaboration events, but on a flat-priced route they cost what a patch costs. Lifecycle management is affordable either way.
