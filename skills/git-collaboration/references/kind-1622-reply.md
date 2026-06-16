# Kind:1622 — Comments

> **Progressive disclosure:** This is a Level 3 per-kind reference for kind:1622. For the full NIP-34 overview, see [nip-spec.md](nip-spec.md). For TOON economics, see [toon-extensions.md](toon-extensions.md).

## Purpose

Comments on issues, PRs, or patches. Threading uses NIP-10 markers.

## Event Type

**Regular** — each comment is a unique event.

## Content

Markdown text of the comment.

## Required Tags

| Tag | Format | Description |
|-----|--------|-------------|
| `e` | `["e", "<parent-event-id>", "", "reply"]` | Parent event being replied to (NIP-10 reply marker) |
| `p` | `["p", "<parent-author-pubkey>"]` | Parent event author's pubkey |

## Optional Tags

| Tag | Format | Description |
|-----|--------|-------------|
| `a` | `["a", "30617:<pubkey>:<repo-id>"]` | Repository for context |

## Validation Rules

- Threading uses NIP-10 markers. The `e` tag with `reply` marker points to the parent event. Format: `["e", "<event-id>", "<relay-url-hint>", "<marker>"]` where relay hint can be empty string.
- Comments on comments create threaded discussions.
- The `a` tag provides repository context but is not strictly required.

## TypeScript Gap

kind:1622 has NO constant in `packages/core/src/nip34/constants.ts`. A browser-side parser (`parseComment`) exists in `packages/rig/src/web/nip34-parsers.ts` but there is no core-level constant or interface.

## TOON Write Model

Approximate size: 200–1000 bytes. Cost at default `basePricePerByte` (10n): ~$0.002–$0.01.

On TOON, comments cost per-byte, incentivizing substantive feedback. Consolidate feedback into one detailed comment rather than many short ones.

### Example 1: Code Review Comment

```typescript
const event = {
  kind: 1622,
  content: `The backoff logic looks correct, but consider capping retries at 5 to avoid infinite reconnection in network-down scenarios.

Suggested change in \`reconnect()\`:
\`\`\`ts
if (this.retryCount >= this.maxRetries) {
  this.emit('connection-failed');
  return;
}
\`\`\``,
  tags: [
    ['e', '<pr-event-id>', '', 'reply'],
    ['p', '<pr-author-pubkey>'],
    ['a', '30617:<maintainer-pubkey>:toon-sdk']
  ]
};

// Sign, calculate fee (~400 bytes ≈ $0.004), publish
await publishEvent(signedEvent, { destination, claim });
```

### Example 2: Reply to Another Comment (Threaded)

```typescript
const event = {
  kind: 1622,
  content: 'Good point on the retry cap. I have updated the PR with maxRetries = 5.',
  tags: [
    ['e', '<previous-comment-event-id>', '', 'reply'],
    ['p', '<previous-commenter-pubkey>'],
    ['a', '30617:<maintainer-pubkey>:toon-sdk']
  ]
};
```

### Example 3: Issue Comment with Workaround

```typescript
const event = {
  kind: 1622,
  content: 'Workaround: check for empty input before calling `parse()`. A proper fix should handle this in the parser itself.',
  tags: [
    ['e', '<issue-event-id>', '', 'reply'],
    ['p', '<issue-author-pubkey>']
  ]
};
```

## TOON Read Model

Reading is free. Get comments on a specific issue/PR/patch:

```json
{"kinds": [1622], "#e": ["<event-id>"]}
```

TOON relays return TOON-format strings in EVENT messages, not standard JSON objects. Use the TOON decoder to parse.

## Event Structure (JSON)

```json
{
  "kind": 1622,
  "pubkey": "<hex-pubkey>",
  "created_at": 1711500000,
  "tags": [],
  "content": ""
}
```

## Filter Pattern

```json
{"kinds": [1622]}
```
