# Kind:1630–1633 — Status Events

> **Progressive disclosure:** This is a Level 3 per-kind reference for status events. For the full NIP-34 overview, see [nip-spec.md](nip-spec.md). For TOON economics, see [toon-extensions.md](toon-extensions.md).

## Purpose

Set lifecycle status for patches, PRs, and issues.

| Kind | Status | Meaning |
|------|--------|---------|
| 1630 | Open | Newly opened or reopened |
| 1631 | Applied / Merged / Resolved | Patch applied, PR merged, or issue resolved |
| 1632 | Closed | Closed without merging/applying |
| 1633 | Draft | Work in progress, not ready for review |

## Event Type

**Regular** — each status change is a unique event.

## Content

Optional markdown explaining the status change (e.g., reason for closing).

## Required Tags

| Tag | Format | Description |
|-----|--------|-------------|
| `e` | `["e", "<target-event-id>", "", "root"]` | Target event (patch/PR/issue) with `root` marker |

## Optional Tags

| Tag | Format | Description |
|-----|--------|-------------|
| `e` | `["e", "<accepted-revision-id>", "", "reply"]` | Accepted revision (for kind:1631 on patch series) |
| `p` | `["p", "<target-author-pubkey>"]` | Target event author |
| `a` | `["a", "30617:<pubkey>:<repo-id>"]` | Repository for context |
| `r` | `["r", "<commit-hash>"]` | Related commit hash |
| `q` | `["q", "<applied-patch-event-id>"]` | Applied patch event ID (for kind:1631) |
| `merge-commit` | `["merge-commit", "<commit-hash>"]` | Merge commit hash (for kind:1631 on PRs) |
| `applied-as-commits` | `["applied-as-commits", "<hash1>", "<hash2>", ...]` | Commits the patch was applied as (for kind:1631) |

## Validation Rules

- The most recent status event from the target event's author or a repository maintainer is authoritative.
- Only maintainers (listed in kind:30617 `maintainers` tag) should publish kind:1631 (applied/merged) status.
- Revision status inherits the root event's status, or becomes closed if the root is merged.
- kind:1631 on a PR should include `merge-commit` tag.
- kind:1631 on a patch should include `applied-as-commits` tags.

## TOON Write Model

Approximate size: 200–400 bytes. Cost at default `basePricePerByte` (10n): ~$0.002–$0.004.

Status events are the cheapest git collaboration events. Lifecycle management should never be avoided due to cost concerns.

### Example 1: Merge a PR (kind:1631)

```typescript
const event = {
  kind: 1631,
  content: 'Merged. Great work on the reconnection logic.',
  tags: [
    ['e', '<pr-event-id>', '', 'root'],
    ['p', '<pr-author-pubkey>'],
    ['a', '30617:<your-pubkey>:toon-sdk'],
    ['merge-commit', '<merge-commit-hash>']
  ]
};

// Sign, calculate fee (~350 bytes ≈ $0.0035), publish
await publishEvent(signedEvent, { destination, claim });
```

### Example 2: Apply a Patch (kind:1631)

```typescript
const event = {
  kind: 1631,
  content: 'Applied with minor formatting adjustment.',
  tags: [
    ['e', '<patch-event-id>', '', 'root'],
    ['p', '<patch-author-pubkey>'],
    ['a', '30617:<your-pubkey>:toon-sdk'],
    ['applied-as-commits', '<commit-hash-1>', '<commit-hash-2>']
  ]
};
```

### Example 3: Close an Issue (kind:1632)

```typescript
const event = {
  kind: 1632,
  content: 'Fixed in commit abc123. Closing.',
  tags: [
    ['e', '<issue-event-id>', '', 'root'],
    ['p', '<issue-author-pubkey>'],
    ['a', '30617:<your-pubkey>:toon-sdk'],
    ['r', '<fix-commit-hash>']
  ]
};
```

### Example 4: Mark as Draft (kind:1633)

```typescript
const event = {
  kind: 1633,
  content: '',
  tags: [
    ['e', '<pr-event-id>', '', 'root'],
    ['p', '<pr-author-pubkey>']
  ]
};
```

### Example 5: Reopen (kind:1630)

```typescript
const event = {
  kind: 1630,
  content: 'Reopening — the fix in abc123 introduced a regression.',
  tags: [
    ['e', '<issue-event-id>', '', 'root'],
    ['p', '<issue-author-pubkey>'],
    ['a', '30617:<your-pubkey>:toon-sdk']
  ]
};
```

## TOON Read Model

Reading is free. Get status of a specific event:

```json
{"kinds": [1630, 1631, 1632, 1633], "#e": ["<event-id>"]}
```

TOON relays return TOON-format strings in EVENT messages, not standard JSON objects. Use the TOON decoder to parse.
