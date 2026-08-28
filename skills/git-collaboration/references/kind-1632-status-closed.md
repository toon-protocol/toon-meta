# Kind:1632 -- Status Closed

> **Progressive disclosure:** Level 3 per-kind reference for kind:1632 (closed status). For the full NIP-34 overview, see [nip-spec.md](nip-spec.md). For TOON economics, see [toon-extensions.md](toon-extensions.md).

## Purpose

Close a patch, PR, or issue without merging or applying.

## Event Type

**Regular** -- each status change is a unique event.

## Content

Optional markdown explaining the reason for closing (e.g., duplicate, won't fix, out of scope).

## Required Tags

| Tag | Format | Description |
|-----|--------|-------------|
| `e` | `["e", "<target-event-id>", "", "root"]` | Target event (patch/PR/issue) with `root` marker |

## Optional Tags

| Tag | Format | Description |
|-----|--------|-------------|
| `p` | `["p", "<target-author-pubkey>"]` | Target event author |
| `a` | `["a", "30617:<pubkey>:<repo-id>"]` | Repository for context |
| `r` | `["r", "<commit-hash>"]` | Related commit hash (if closed by a fix) |

## Validation Rules

- Maintainers and the original event author can close events.
- Non-maintainers closing others' issues is poor etiquette.
- Provide a reason in the content field when closing.

## Event Structure

```json
{
  "kind": 1632,
  "content": "Fixed in commit abc123. Closing.",
  "tags": [
    ["e", "<issue-event-id>", "", "root"],
    ["p", "<issue-author-pubkey>"],
    ["a", "30617:<your-pubkey>:toon-sdk"],
    ["r", "<fix-commit-hash>"]
  ]
}
```

## Filter Pattern

```json
{"kinds": [1632], "#e": ["<event-id>"]}
```

## TOON Fee Estimate

The relay route (`g.toon.relay`) is flat-priced: **1 base unit** of 6-decimal USDC per event, whatever its size. Confirm with `await client.routePrice('g.toon.relay')` rather than assuming a figure.

Always include a reason when closing. The reason text is free -- the route is flat-priced -- and it is what the issue's readers actually need.
