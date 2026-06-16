# NIP Specifications: Social Interaction Events

> **Why this reference exists:** Agents need precise event structures to construct valid social interaction events. This file covers the wire format for kind:7 (reactions, NIP-25), kind:6 and kind:16 (reposts, NIP-18), and kind:1111 (comments, NIP-22). Understanding these structures prevents malformed events that waste ILP payment on rejected publishes.

## kind:7 -- Reactions (NIP-25)

kind:7 is a **regular event** (non-replaceable). Each reaction creates a new, permanent event. A user can react multiple times to the same event with different reaction types.

### Event Structure

```
{
  "kind": 7,
  "content": "+",
  "tags": [
    ["e", "<reacted-to-event-id-hex>", "<relay-url-hint>"],
    ["p", "<reacted-to-event-author-pubkey-hex>"],
    ["k", "<kind-of-reacted-to-event>"]
  ]
}
```

### Content Field Values

| Value | Meaning | Notes |
|-------|---------|-------|
| `+` | Like / approval | The default positive reaction |
| `-` | Dislike / downvote | Confrontational signal; use with care on paid networks |
| Unicode emoji | Emoji reaction | e.g., fire, heart, thumbs-up characters |
| `:shortcode:` | Custom emoji | References a custom emoji defined elsewhere |

### Tag Reference

| Tag | Required | Description |
|-----|----------|-------------|
| `e` | Yes | Event ID being reacted to. Optional relay URL hint as third element. |
| `p` | Yes | Pubkey of the author whose event is being reacted to. |
| `k` | No | Kind of the event being reacted to (as string). Added for specificity when reacting to non-kind:1 events. |

### Reaction Semantics

- Each reaction is an independent event -- reacting to the same event twice creates two separate kind:7 events
- The `e` tag points to the specific event being reacted to, enabling clients to aggregate reactions per event
- The `p` tag enables notification to the event author that their content received a reaction
- There is no "unreact" mechanism -- to undo a reaction, publish a kind:5 deletion event targeting the reaction's event ID

## kind:6 -- Reposts of kind:1 Notes (NIP-18)

kind:6 is a **regular event** for reposting kind:1 (short text note) events. It signals amplification of someone else's note.

### Event Structure

```
{
  "kind": 6,
  "content": "",
  "tags": [
    ["e", "<reposted-event-id-hex>", "<relay-url-hint>"],
    ["p", "<original-author-pubkey-hex>"]
  ]
}
```

### Content Field

The `content` field is optionally used to embed the full JSON-serialized reposted event. When included, clients can display the reposted content even if the original event is unavailable. When omitted, the content field is empty and clients must fetch the original event using the `e` tag.

Including embedded content increases the event byte size significantly (the original event is serialized inside the content field), which increases the ILP fee on TOON.

### Tag Reference

| Tag | Required | Description |
|-----|----------|-------------|
| `e` | Yes | Event ID of the reposted event. Optional relay URL hint as third element. |
| `p` | Yes | Pubkey of the original event's author. |

## kind:16 -- Reposts of Non-kind:1 Events (NIP-18)

kind:16 is identical in structure to kind:6 but is used for reposting events that are not kind:1 (short text notes). The separation exists so clients can differentiate note reposts from reposts of other content types (articles, reactions, etc.) in feeds.

### Event Structure

```
{
  "kind": 16,
  "content": "",
  "tags": [
    ["e", "<reposted-event-id-hex>", "<relay-url-hint>"],
    ["p", "<original-author-pubkey-hex>"],
    ["k", "<original-event-kind>"]
  ]
}
```

### Additional Tag

| Tag | Required | Description |
|-----|----------|-------------|
| `k` | Yes | The kind of the event being reposted (as string). Required for kind:16 to identify the original content type. |

### When to Use kind:6 vs kind:16

- **kind:6:** Reposting a kind:1 short text note
- **kind:16:** Reposting any other event kind (kind:30023 articles, kind:7 reactions, kind:1111 comments, etc.)

## kind:1111 -- Comments (NIP-22)

kind:1111 is a **regular event** for commenting on any event kind or external resource. Comments enable threaded discussion with a flexible scoping model.

### Event Structure (Comment on an Event)

```
{
  "kind": 1111,
  "content": "Great article! The section on fee calculation was especially helpful.",
  "tags": [
    ["E", "<root-event-id-hex>", "<relay-url-hint>", "<root-event-author-pubkey>"],
    ["K", "<root-event-kind>"],
    ["p", "<root-event-author-pubkey-hex>"]
  ]
}
```

### Event Structure (Threaded Reply to a Comment)

```
{
  "kind": 1111,
  "content": "Agreed, the examples made it much clearer.",
  "tags": [
    ["E", "<root-event-id-hex>", "<relay-url-hint>", "<root-event-author-pubkey>"],
    ["e", "<parent-comment-event-id-hex>", "<relay-url-hint>", "<parent-comment-author-pubkey>"],
    ["K", "<root-event-kind>"],
    ["k", "1111"],
    ["p", "<root-event-author-pubkey-hex>"],
    ["p", "<parent-comment-author-pubkey-hex>"]
  ]
}
```

### Event Structure (Comment on External Content)

```
{
  "kind": 1111,
  "content": "This podcast episode covers the same topic from a different angle.",
  "tags": [
    ["I", "https://example.com/article", "url"],
    ["K", "443"],
    ["p", "<optional-author-pubkey-if-known>"]
  ]
}
```

### Root Scope Tags (Uppercase)

These tags identify what is being commented on at the top level:

| Tag | Description | Format |
|-----|-------------|--------|
| `E` | Event ID root | `["E", "<event-id>", "<relay-hint>", "<author-pubkey>"]` |
| `A` | Parameterized replaceable event root | `["A", "<kind>:<pubkey>:<d-tag>", "<relay-hint>"]` |
| `I` | External content root | `["I", "<identifier>", "<type-hint>"]` where type-hint is `url`, `podcast:guid`, `isbn`, etc. |

### Reply Tags (Lowercase)

These tags create threaded conversation chains within the comment tree:

| Tag | Description | Format |
|-----|-------------|--------|
| `e` | Reply to a specific comment event | `["e", "<comment-event-id>", "<relay-hint>", "<comment-author>"]` |
| `a` | Reply referencing a parameterized replaceable event | `["a", "<kind>:<pubkey>:<d-tag>", "<relay-hint>"]` |
| `i` | Reply referencing external content | `["i", "<identifier>", "<type-hint>"]` |

### Kind Tag

| Tag | Required | Description |
|-----|----------|-------------|
| `K` | Yes | Root event kind as string (e.g., `"30023"` for articles, `"1"` for notes). Placed at root level. |
| `k` | No | Kind of the immediate parent when replying to a comment (value is `"1111"`). |

### Threading Model

1. **Top-level comment on an event:** Include the uppercase root tag (`E`, `A`, or `I`) plus `K` for the root kind. No lowercase reply tags.
2. **Reply to a comment:** Include both the uppercase root tag (pointing to the original content) AND a lowercase `e` tag (pointing to the parent comment). Add a lowercase `k` tag with `"1111"` (the kind of the parent comment). This creates a tree structure.
3. **Deep threading:** Each reply includes the root scope tag AND an `e` tag pointing to its immediate parent comment. The root tag is always present regardless of nesting depth.

### External Content Comments

The `I` tag enables commenting on content outside Nostr:
- Web pages: `["I", "https://example.com/page", "url"]`
- Podcast episodes: `["I", "<podcast-guid>", "podcast:guid"]`
- Books: `["I", "<isbn>", "isbn"]`

This cross-protocol bridging feature allows Nostr comments on any addressable content.

## Filtering and Querying

To fetch social interactions, use NIP-01 subscription filters:

- **Reactions on a specific event:** `{ kinds: [7], "#e": ["<event-id>"] }`
- **All reactions by an author:** `{ kinds: [7], authors: ["<pubkey>"] }`
- **Reposts of a specific event:** `{ kinds: [6, 16], "#e": ["<event-id>"] }`
- **Comments on a specific event:** `{ kinds: [1111], "#E": ["<event-id>"] }`
- **Threaded replies to a comment:** `{ kinds: [1111], "#e": ["<comment-event-id>"] }`
- **All comments by an author:** `{ kinds: [1111], authors: ["<pubkey>"] }`
