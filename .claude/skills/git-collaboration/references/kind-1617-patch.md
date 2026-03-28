# Kind:1617 — Patches

> **Progressive disclosure:** This is a Level 3 per-kind reference for kind:1617. For the full NIP-34 overview, see [nip-spec.md](nip-spec.md). For TOON economics, see [toon-extensions.md](toon-extensions.md).

## Purpose

Submits code patches using `git format-patch` output. Patches are the primary code contribution mechanism in NIP-34. On TOON, patches are the most expensive git collaboration events because the content contains full diff output.

## Event Type

**Regular** — each patch is a unique event. Patch series use NIP-10 threading.

## Content

Output of `git format-patch` — the full patch text including commit message, author info, and diff.

## Required Tags

| Tag | Format | Description |
|-----|--------|-------------|
| `a` | `["a", "30617:<pubkey>:<repo-id>"]` | Repository address |
| `r` | `["r", "<earliest-unique-commit>"]` | Earliest unique commit hash in the patch |

## Optional Tags

| Tag | Format | Description |
|-----|--------|-------------|
| `p` | `["p", "<maintainer-pubkey>"]` | Maintainer to notify |
| `t` | `["t", "root"]` | First event in a patch series |
| `t` | `["t", "root-revision"]` | Revision of a previously submitted patch series |
| `commit` | `["commit", "<commit-hash>"]` | Commit hash this patch represents |
| `parent-commit` | `["parent-commit", "<commit-hash>"]` | Parent commit hash |
| `commit-pgp-sig` | `["commit-pgp-sig", "<signature>"]` | PGP signature of the commit |
| `committer` | `["committer", "<name>", "<email>", "<timestamp>", "<timezone>"]` | Committer identity |
| `e` | `["e", "<prev-patch-event-id>", "", "reply"]` | Reply to previous patch in series (NIP-10 threading) |

## Validation Rules

- Content must be valid `git format-patch` output.
- The first patch in a series should have `["t", "root"]` tag.
- Subsequent patches in the series use NIP-10 `e` reply tags to thread back to the first patch.
- A revision of a previously submitted series uses `["t", "root-revision"]` and an `e` tag referencing the original root patch.

## TOON Write Model

Approximate size: 500–50,000 bytes. Cost at default `basePricePerByte` (10n):
- Small fix (<50 lines): ~$0.005–$0.02
- Medium feature: ~$0.02–$0.10
- Large refactor: ~$0.10–$0.50

**Keep diffs minimal.** A 50KB monolithic patch costs ~$0.50. Five 10KB patches cost ~$0.50 total but are individually reviewable. Avoid unnecessary whitespace changes. Write concise commit messages (they're part of the content and cost per-byte).

### Example 1: Single Patch (Bug Fix)

```typescript
const patchContent = `From abc123 Mon Sep 17 00:00:00 2001
From: Author <author@example.com>
Date: Thu, 27 Mar 2026 10:00:00 +0000
Subject: [PATCH] Fix null check in parser

---
 src/parser.ts | 3 ++-
 1 file changed, 2 insertions(+), 1 deletion(-)

diff --git a/src/parser.ts b/src/parser.ts
index abc123..def456 100644
--- a/src/parser.ts
+++ b/src/parser.ts
@@ -42,7 +42,8 @@
-  return input.length;
+  if (!input) return 0;
+  return input.length;
`;

const event = {
  kind: 1617,
  content: patchContent,
  tags: [
    ['a', '30617:<maintainer-pubkey>:toon-sdk'],
    ['r', '<earliest-unique-commit>'],
    ['p', '<maintainer-pubkey>'],
    ['t', 'root'],
    ['commit', '<commit-hash>'],
    ['parent-commit', '<parent-hash>']
  ]
};

// Sign, calculate fee (~800 bytes ≈ $0.008), publish
await publishEvent(signedEvent, { destination, claim });
```

### Example 2: Patch Series (2 of 3)

```typescript
const event = {
  kind: 1617,
  content: patchContent2,
  tags: [
    ['a', '30617:<maintainer-pubkey>:toon-sdk'],
    ['r', '<earliest-unique-commit>'],
    ['e', '<first-patch-event-id>', '', 'reply'],
    ['commit', '<commit-hash-2>'],
    ['parent-commit', '<commit-hash-1>']
  ]
};
// No "root" tag — this is a follow-up in the series
```

### Example 3: Revised Patch Series

```typescript
const event = {
  kind: 1617,
  content: revisedPatchContent,
  tags: [
    ['a', '30617:<maintainer-pubkey>:toon-sdk'],
    ['r', '<earliest-unique-commit>'],
    ['t', 'root-revision'],
    ['e', '<original-root-patch-event-id>', '', 'reply']
  ]
};
// "root-revision" signals this replaces a previous series
```

## TOON Read Model

Reading is free. Get all patches for a repository:

```json
{"kinds": [1617], "#a": ["30617:<pubkey>:<repo-id>"]}
```

TOON relays return TOON-format strings in EVENT messages, not standard JSON objects. Use the TOON decoder to parse.

## Event Structure (JSON)

```json
{
  "kind": 1617,
  "pubkey": "<hex-pubkey>",
  "created_at": 1711500000,
  "tags": [],
  "content": ""
}
```

## Filter Pattern

```json
{"kinds": [1617]}
```
