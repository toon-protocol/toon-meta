# Kind:30618 — Repository State

> **Progressive disclosure:** This is a Level 3 per-kind reference for kind:30618. For the full NIP-34 overview, see [nip-spec.md](nip-spec.md). For TOON economics, see [toon-extensions.md](toon-extensions.md).

## Purpose

Publishes the authoritative source of truth for branch heads and tags. Only the most recent kind:30618 from the repository maintainer is authoritative.

## Event Type

**Parameterized replaceable** — each update replaces the previous state event.

## Required Tags

| Tag | Format | Description |
|-----|--------|-------------|
| `d` | `["d", "<repo-identifier>"]` | Must match a kind:30617 repository announcement's `d` tag |

## Optional Tags

| Tag | Format | Description |
|-----|--------|-------------|
| `refs/heads/*` | `["refs/heads/main", "<commit-hash>"]` | Branch head commit hash |
| `refs/tags/*` | `["refs/tags/v1.0.0", "<commit-hash>"]` | Tag commit hash |
| `HEAD` | `["HEAD", "ref: refs/heads/main"]` | Default branch reference |

## Validation Rules

- The `d` tag must match an existing kind:30617 from the same author.
- Omitting all `refs/heads/*` and `refs/tags/*` tags means the maintainer has ceased tracking the repository.
- Each branch/tag is a separate tag entry.
- Only the most recent kind:30618 event (by `created_at`) is authoritative.

## TOON Codebase Note

The Forge-UI parser (`packages/rig/src/web/nip34-parsers.ts`) parses kind:30618 refs using `["r", "<ref-name>", "<commit-sha>"]` format (3-element `r` tags), not the tag-name-as-ref format. Both formats exist in the wild. When constructing kind:30618 events for TOON, prefer the `r` tag format for compatibility with existing parsers.

**TypeScript gap:** kind:30618 has NO constant or interface in `packages/core/src/nip34/constants.ts` or `types.ts`. The Forge-UI parser (`parseRepoRefs`) exists in `packages/rig/src/web/nip34-parsers.ts` but there is no core-level type support.

## TOON Write Model

The relay route (`g.toon.relay`) is flat-priced: **1 base unit** of 6-decimal USDC per event, whatever its size. Confirm with `await client.routePrice('g.toon.relay')` rather than assuming a figure.

### Example 1: Simple Repository State

```typescript
const event = {
  kind: 30618,
  content: '',
  tags: [
    ['d', 'my-project'],
    ['refs/heads/main', 'abc123def456789...'],
    ['HEAD', 'ref: refs/heads/main']
  ]
};

// Sign, then send -- the client seals it, prices the route and mints the claim
await client.send({ body: signedEvent });
```

### Example 2: Multi-Branch State with Tags

```typescript
const event = {
  kind: 30618,
  content: '',
  tags: [
    ['d', 'toon-sdk'],
    ['refs/heads/main', 'abc123...'],
    ['refs/heads/develop', '789ghi...'],
    ['refs/heads/feature/ws-reconnect', 'def456...'],
    ['refs/tags/v1.0.0', 'mno345...'],
    ['refs/tags/v1.1.0', 'pqr678...'],
    ['HEAD', 'ref: refs/heads/main']
  ]
};

// Sign, then send -- the client seals it, prices the route and mints the claim
await client.send({ body: signedEvent });
```

### Example 3: Cease Tracking (Empty State)

```typescript
const event = {
  kind: 30618,
  content: '',
  tags: [
    ['d', 'deprecated-project']
  ]
};
// No ref tags = maintainer has ceased tracking
```

## Reading (free, plain NIP-01)

Reading is free.

```json
{"kinds": [30618], "authors": ["<maintainer-pubkey>"], "#d": ["<repo-id>"]}
```

The relay answers reads with ordinary NIP-01 `EVENT` messages in plain JSON -- any Nostr client can parse them, and a free read never touches a connector.

## Event Structure (JSON)

```json
{
  "kind": 30618,
  "pubkey": "<hex-pubkey>",
  "created_at": 1711500000,
  "tags": [],
  "content": ""
}
```

## Filter Pattern

```json
{"kinds": [30618]}
```
