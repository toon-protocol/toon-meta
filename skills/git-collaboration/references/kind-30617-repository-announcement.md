# Kind:30617 — Repository Announcement

> **Progressive disclosure:** This is a Level 3 per-kind reference for kind:30617. For the full NIP-34 overview, see [nip-spec.md](nip-spec.md). For TOON economics, see [toon-extensions.md](toon-extensions.md). For step-by-step workflows, see [scenarios.md](scenarios.md).

## Purpose

Announces a git repository and asserts maintainership. This is the anchor event for all NIP-34 collaboration — patches, PRs, issues, and status events all reference the repository address derived from this event.

## Event Type

**Parameterized replaceable** — updates replace the previous announcement with the same `d` tag. You pay only for the current version, not accumulated history.

## Required Tags

| Tag | Format | Description |
|-----|--------|-------------|
| `d` | `["d", "<repo-identifier>"]` | Repository identifier (e.g., `my-project`). Unique per author. |

## Optional Tags

| Tag | Format | Description |
|-----|--------|-------------|
| `name` | `["name", "<display name>"]` | Human-readable repository name |
| `description` | `["description", "<text>"]` | Repository description |
| `web` | `["web", "<url>"]` | Web URL for browsing (multiple allowed) |
| `clone` | `["clone", "<url>"]` | Git clone URL (multiple allowed: `https://`, `git://`, `ssh://`) |
| `relays` | `["relays", "<relay-url>", ...]` | Preferred relays for this repository's events |
| `r` | `["r", "<earliest-unique-commit>", "euc"]` | Earliest unique commit hash with `euc` marker |
| `maintainers` | `["maintainers", "<pubkey-hex>", ...]` | List of maintainer pubkeys (hex, not npub) |
| `t` | `["t", "<topic>"]` | Topic tags for discovery. `["t", "personal-fork"]` = personal fork. |

## Validation Rules

- The `d` tag is required and identifies the repository uniquely within the author's pubkey namespace.
- The repository address is `30617:<author-pubkey>:<d-tag-value>`.
- A `personal-fork` topic tag indicates the repo is a fork, not an original project.
- Multiple `clone` tags allow listing different protocol URLs (HTTPS, SSH, git://).
- Multiple `web` tags allow listing different browsing interfaces.

## TOON Write Model

Approximate size: 300–500 bytes. Cost at default `basePricePerByte` (10n): ~$0.003–$0.005.

### Example 1: Minimal Repository Announcement

```typescript
import { publishEvent } from '@toon-protocol/client';

const event = {
  kind: 30617,
  content: '',
  tags: [
    ['d', 'my-lib'],
    ['clone', 'https://github.com/user/my-lib.git'],
    ['maintainers', '<your-pubkey-hex>']
  ]
};

// Sign, calculate fee (~300 bytes ≈ $0.003), publish
await publishEvent(signedEvent, { destination, claim });
```

### Example 2: Full Metadata Announcement

```typescript
const event = {
  kind: 30617,
  content: 'A TypeScript SDK for decentralized protocols',
  tags: [
    ['d', 'toon-sdk'],
    ['name', 'TOON SDK'],
    ['description', 'A TypeScript SDK for decentralized protocols'],
    ['clone', 'https://github.com/toon-protocol/toon-sdk.git'],
    ['clone', 'git://git.toon.example/toon-sdk.git'],
    ['web', 'https://github.com/toon-protocol/toon-sdk'],
    ['relays', 'wss://relay.toon.example'],
    ['maintainers', '<pubkey-hex-1>', '<pubkey-hex-2>'],
    ['r', 'abc123def456', 'euc'],
    ['t', 'sdk'],
    ['t', 'typescript']
  ]
};

// Sign, calculate fee (~500 bytes ≈ $0.005), publish
await publishEvent(signedEvent, { destination, claim });
// Repository address: 30617:<your-pubkey>:toon-sdk
```

### Example 3: Personal Fork Announcement

```typescript
const event = {
  kind: 30617,
  content: '',
  tags: [
    ['d', 'toon-sdk'],
    ['name', 'TOON SDK (my fork)'],
    ['clone', 'https://github.com/contributor/toon-sdk.git'],
    ['maintainers', '<your-pubkey-hex>'],
    ['t', 'personal-fork']
  ]
};
```

## TOON Read Model

Reading is free. Discover repositories:

```json
{"kinds": [30617]}
```

Get a specific repository:

```json
{"kinds": [30617], "authors": ["<maintainer-pubkey>"], "#d": ["<repo-id>"]}
```

TOON relays return TOON-format strings — use the TOON decoder to parse.

## Event Structure (JSON)

```json
{
  "kind": 30617,
  "pubkey": "<hex-pubkey>",
  "created_at": 1711500000,
  "tags": [],
  "content": ""
}
```

## Filter Pattern

```json
{"kinds": [30617]}
```
