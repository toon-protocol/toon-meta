# Kind:1618 — Pull Requests

> **Progressive disclosure:** This is a Level 3 per-kind reference for kind:1618. For the full NIP-34 overview, see [nip-spec.md](nip-spec.md). For TOON economics, see [toon-extensions.md](toon-extensions.md).

## Purpose

Requests merging a branch by providing the branch tip commit and clone URLs. Content is a markdown description rather than the full diff, so reviewers fetch the code from a clone URL. On TOON that is a review-experience choice, not a cost one -- the relay route is flat-priced, so a PR costs the same as a patch.

## Event Type

**Regular** — each PR is a unique event.

## Content

Markdown description of the pull request (changes, motivation, test plan).

## Required Tags

| Tag | Format | Description |
|-----|--------|-------------|
| `a` | `["a", "30617:<pubkey>:<repo-id>"]` | Repository address |
| `r` | `["r", "<earliest-unique-commit>"]` | Earliest unique commit hash |
| `c` | `["c", "<branch-tip-commit>"]` | PR branch tip commit hash |
| `clone` | `["clone", "<url>"]` | At least one clone URL where the branch can be fetched |

## Optional Tags

| Tag | Format | Description |
|-----|--------|-------------|
| `p` | `["p", "<maintainer-pubkey>"]` | Maintainer to notify |
| `subject` | `["subject", "<title>"]` | PR title/subject line |
| `t` | `["t", "<label>"]` | Labels for categorization |
| `branch-name` | `["branch-name", "<name>"]` | Source branch name |
| `e` | `["e", "<root-patch-event-id>"]` | Root patch event if this PR is a revision |
| `merge-base` | `["merge-base", "<commit-hash>"]` | Merge base commit |

## Validation Rules

- The tip commit (`c` tag) should be pushed to `refs/nostr/<event-id>` before signing, so reviewers can fetch it.
- At least one `clone` URL is required so reviewers can fetch the branch.
- Content is markdown describing the changes, motivation, and any testing done.

## TOON Write Model

The relay route (`g.toon.relay`) is flat-priced: **1 base unit** of 6-decimal USDC per event, whatever its size. Confirm with `await client.routePrice('g.toon.relay')` rather than assuming a figure.

### Example 1: Feature PR

```typescript
const event = {
  kind: 1618,
  content: `## Summary\n\nAdds WebSocket reconnection with exponential backoff.\n\n## Changes\n\n- New \`reconnect()\` method\n- Backoff: 1s → 30s max\n- Tests for reconnection scenarios\n\n## Test Plan\n\n- \`pnpm test\` passes`,
  tags: [
    ['a', '30617:<maintainer-pubkey>:toon-sdk'],
    ['r', '<earliest-unique-commit>'],
    ['c', '<branch-tip-commit>'],
    ['clone', 'https://github.com/contributor/toon-sdk.git'],
    ['p', '<maintainer-pubkey>'],
    ['subject', 'Add WebSocket reconnection with exponential backoff'],
    ['branch-name', 'feature/ws-reconnect']
  ]
};

// Sign, then send -- the client seals it, prices the route and mints the claim
await client.send({ body: signedEvent });
```

### Example 2: Bug Fix PR with Merge Base

```typescript
const event = {
  kind: 1618,
  content: '## Fix\n\nResolves null pointer in parser when input is empty.\n\nFixes #42.',
  tags: [
    ['a', '30617:<maintainer-pubkey>:toon-sdk'],
    ['r', '<earliest-unique-commit>'],
    ['c', '<branch-tip-commit>'],
    ['clone', 'https://github.com/contributor/toon-sdk.git'],
    ['subject', 'Fix parser crash on empty input'],
    ['merge-base', '<merge-base-commit>'],
    ['t', 'bug']
  ]
};
```

### Example 3: PR Revising a Previous Patch

```typescript
const event = {
  kind: 1618,
  content: 'Revised version of the parser fix, now as a PR with additional tests.',
  tags: [
    ['a', '30617:<maintainer-pubkey>:toon-sdk'],
    ['r', '<earliest-unique-commit>'],
    ['c', '<updated-tip-commit>'],
    ['clone', 'https://github.com/contributor/toon-sdk.git'],
    ['e', '<original-root-patch-event-id>']
  ]
};
```

## Reading (free, plain NIP-01)

Reading is free.

```json
{"kinds": [1618], "#a": ["30617:<pubkey>:<repo-id>"]}
```

The relay answers reads with ordinary NIP-01 `EVENT` messages in plain JSON -- any Nostr client can parse them, and a free read never touches a connector.

## Event Structure (JSON)

```json
{
  "kind": 1618,
  "pubkey": "<hex-pubkey>",
  "created_at": 1711500000,
  "tags": [],
  "content": ""
}
```

## Filter Pattern

```json
{"kinds": [1618]}
```
