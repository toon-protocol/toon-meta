# Kind:1621 — Issues

> **Progressive disclosure:** This is a Level 3 per-kind reference for kind:1621. For the full NIP-34 overview, see [nip-spec.md](nip-spec.md). For TOON economics, see [toon-extensions.md](toon-extensions.md).

## Purpose

Reports bugs, requests features, or opens discussion topics on a repository.

## Event Type

**Regular** — each issue is a unique event.

## Content

Markdown text describing the issue (bug report, feature request, discussion topic).

## Required Tags

| Tag | Format | Description |
|-----|--------|-------------|
| `a` | `["a", "30617:<pubkey>:<repo-id>"]` | Repository address |
| `p` | `["p", "<repo-owner-pubkey>"]` | Repository owner's pubkey |

## Optional Tags

| Tag | Format | Description |
|-----|--------|-------------|
| `subject` | `["subject", "<issue title>"]` | Issue title |
| `t` | `["t", "<label>"]` | Labels (e.g., `bug`, `enhancement`, `question`) |

## Validation Rules

- Content is markdown describing the issue in detail.
- Replies to issues use kind:1622 comments (not kind:1111).
- The `subject` tag serves as the issue title for display in client UIs.

## TOON Write Model

Approximate size: 300–2000 bytes. Cost at default `basePricePerByte` (10n): ~$0.003–$0.02.

On TOON, detailed issues cost more per-byte but are more valuable than vague one-liners. Include reproduction steps, expected vs actual behavior, and environment details.

### Example 1: Concise Bug Report

```typescript
const event = {
  kind: 1621,
  content: 'Parser throws TypeError on empty input.\n\nSteps: call `parse("")`.\nExpected: returns empty result.\nActual: `TypeError: Cannot read property length of undefined`.',
  tags: [
    ['a', '30617:<maintainer-pubkey>:toon-sdk'],
    ['p', '<maintainer-pubkey>'],
    ['subject', 'Parser crashes on empty input'],
    ['t', 'bug']
  ]
};

// Sign, calculate fee (~400 bytes ≈ $0.004), publish
await publishEvent(signedEvent, { destination, claim });
```

### Example 2: Detailed Bug Report with Environment

```typescript
const event = {
  kind: 1621,
  content: `## Bug Report

**Expected:** Parser handles empty input gracefully
**Actual:** Throws uncaught TypeError on line 42

## Steps to Reproduce

1. Call \`parse('')\`
2. Observe TypeError: Cannot read property 'length' of undefined

## Environment

- Node.js 20.11
- Package version 1.2.3
- OS: macOS 14.3`,
  tags: [
    ['a', '30617:<maintainer-pubkey>:toon-sdk'],
    ['p', '<maintainer-pubkey>'],
    ['subject', 'Parser crashes on empty input'],
    ['t', 'bug']
  ]
};

// Sign, calculate fee (~600 bytes ≈ $0.006), publish
await publishEvent(signedEvent, { destination, claim });
```

### Example 3: Feature Request

```typescript
const event = {
  kind: 1621,
  content: '## Feature Request\n\nAdd WebSocket reconnection with exponential backoff.\n\nCurrently the client drops silently on disconnect. A reconnect mechanism would improve reliability for long-running agents.',
  tags: [
    ['a', '30617:<maintainer-pubkey>:toon-sdk'],
    ['p', '<maintainer-pubkey>'],
    ['subject', 'Add WebSocket reconnection support'],
    ['t', 'enhancement']
  ]
};
```

## TOON Read Model

Reading is free.

```json
{"kinds": [1621], "#a": ["30617:<pubkey>:<repo-id>"]}
```

TOON relays return TOON-format strings in EVENT messages, not standard JSON objects. Use the TOON decoder to parse.
