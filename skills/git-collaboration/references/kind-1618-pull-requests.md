# Kind:1618 — Pull Requests

> **Progressive disclosure:** This is a Level 3 per-kind reference for kind:1618. For the full NIP-34 overview, see [nip-spec.md](nip-spec.md). For TOON economics, see [toon-extensions.md](toon-extensions.md).

## Purpose

Requests merging a branch by providing the branch tip commit and clone URLs. PRs are cheaper than patches on TOON because the content is a markdown description, not the full diff.

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

Approximate size: 400–1000 bytes. Cost at default `basePricePerByte` (10n): ~$0.004–$0.01.

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

// Sign, calculate fee (~700 bytes ≈ $0.007), publish
await publishEvent(signedEvent, { destination, claim });
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

## TOON Read Model

Reading is free.

```json
{"kinds": [1618], "#a": ["30617:<pubkey>:<repo-id>"]}
```

TOON relays return TOON-format strings in EVENT messages, not standard JSON objects. Use the TOON decoder to parse.
