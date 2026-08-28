# Kind:1619 — PR Updates

> **Progressive disclosure:** This is a Level 3 per-kind reference for kind:1619. For the full NIP-34 overview, see [nip-spec.md](nip-spec.md). For TOON economics, see [toon-extensions.md](toon-extensions.md).

## Purpose

Updates an existing PR's branch tip without creating a new PR event. Uses uppercase `E` and `P` tags (NIP-22 root scope) to reference the original PR.

## Event Type

**Regular** — each update is a unique event referencing the original kind:1618 PR.

## Content

Empty string.

## Required Tags

| Tag | Format | Description |
|-----|--------|-------------|
| `a` | `["a", "30617:<pubkey>:<repo-id>"]` | Repository address |
| `r` | `["r", "<earliest-unique-commit>"]` | Earliest unique commit in the updated branch |
| `E` | `["E", "<pr-event-id>"]` | PR event ID (uppercase E — NIP-22 root scope) |
| `P` | `["P", "<pr-author-pubkey>"]` | PR author pubkey (uppercase P — NIP-22 root scope) |
| `c` | `["c", "<updated-tip-commit>"]` | Updated branch tip commit hash |
| `clone` | `["clone", "<url>"]` | Clone URL where the updated branch can be fetched |

## Optional Tags

| Tag | Format | Description |
|-----|--------|-------------|
| `p` | `["p", "<maintainer-pubkey>"]` | Maintainer to notify |
| `merge-base` | `["merge-base", "<commit-hash>"]` | Updated merge base commit |

## Validation Rules

- `E` and `P` are **uppercase** NIP-22 root scope tags, distinct from lowercase `e` and `p`.
- The `E` tag references the original kind:1618 PR event.
- The `P` tag references the original PR author's pubkey.

## TOON Write Model

The relay route (`g.toon.relay`) is flat-priced: **1 base unit** of 6-decimal USDC per event, whatever its size. Confirm with `await client.routePrice('g.toon.relay')` rather than assuming a figure.

### Example 1: Force-Push Update

```typescript
const event = {
  kind: 1619,
  content: '',
  tags: [
    ['a', '30617:<maintainer-pubkey>:toon-sdk'],
    ['r', '<earliest-unique-commit>'],
    ['E', '<original-pr-event-id>'],
    ['P', '<pr-author-pubkey>'],
    ['c', '<updated-tip-commit>'],
    ['clone', 'https://github.com/contributor/toon-sdk.git'],
    ['p', '<maintainer-pubkey>']
  ]
};

// Sign, then send -- the client seals it, prices the route and mints the claim
await client.send({ body: signedEvent });
```

### Example 2: Update with New Merge Base

```typescript
const event = {
  kind: 1619,
  content: '',
  tags: [
    ['a', '30617:<maintainer-pubkey>:toon-sdk'],
    ['r', '<earliest-unique-commit>'],
    ['E', '<original-pr-event-id>'],
    ['P', '<pr-author-pubkey>'],
    ['c', '<rebased-tip-commit>'],
    ['clone', 'https://github.com/contributor/toon-sdk.git'],
    ['merge-base', '<new-merge-base-commit>']
  ]
};
```

## Reading (free, plain NIP-01)

Reading is free. Get updates for a specific PR:

```json
{"kinds": [1619], "#E": ["<pr-event-id>"]}
```

The relay answers reads with ordinary NIP-01 `EVENT` messages in plain JSON -- any Nostr client can parse them, and a free read never touches a connector.

## Event Structure (JSON)

```json
{
  "kind": 1619,
  "pubkey": "<hex-pubkey>",
  "created_at": 1711500000,
  "tags": [],
  "content": ""
}
```

## Filter Pattern

```json
{"kinds": [1619]}
```
