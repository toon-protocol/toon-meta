# NIP Specifications: Lists (NIP-51) and Labeling (NIP-32)

> **Why this reference exists:** Agents need precise event structures to construct valid list and label events. This file covers the wire format for NIP-51 list kinds (mute lists, pin lists, follow sets, bookmark sets, and secondary lists) and NIP-32 labeling (kind:1985). Understanding these structures prevents malformed events that waste ILP payment on rejected publishes.

## NIP-51: Lists

NIP-51 defines standardized lists using two event categories: standard lists (replaceable) and sets (parameterized replaceable). All lists support dual public/private entries.

### Replaceable vs Parameterized Replaceable Semantics

**Replaceable events (kind:10000-10030):** Only one event per kind per user exists on the relay. Publishing a new event replaces the previous version entirely. The relay discards the older event.

**Parameterized replaceable events (kind:30000-30003):** Multiple events per kind per user, differentiated by the `d` tag value. Each unique `d` tag value is treated as a separate replaceable slot. Publishing with the same `d` tag replaces only that specific slot.

### Public and Private Entries

All NIP-51 lists support a dual-entry model:

- **Public entries:** Tags in the `.tags` array. Visible to everyone, including relays.
- **Private entries:** Tags serialized as a JSON array in the `.content` field, encrypted using NIP-44 with the author's own key pair. Only the list owner can decrypt.

A single list event can contain BOTH public and private entries simultaneously. The encrypted `.content` field uses the same tag format as the `.tags` array.

```
{
  "kind": 10000,
  "tags": [
    ["p", "<publicly-muted-pubkey-hex>"]
  ],
  "content": "<NIP-44-encrypted-JSON-of-private-tags>"
}
```

When decrypted, the `.content` field contains a JSON array of tag arrays:

```
[
  ["p", "<privately-muted-pubkey-hex>"],
  ["t", "privately-muted-hashtag"],
  ["word", "privately-muted-keyword"]
]
```

New items are appended chronologically to existing lists. Clients should preserve existing entries when adding or removing items.

## kind:10000 -- Mute List

kind:10000 is a **replaceable event** listing entities the user wants to mute. Clients filter content matching muted entries.

### Event Structure

```
{
  "kind": 10000,
  "content": "<NIP-44-encrypted-private-mute-entries>",
  "tags": [
    ["p", "<muted-pubkey-hex>"],
    ["e", "<muted-thread-event-id-hex>"],
    ["t", "muted-hashtag"],
    ["word", "muted-keyword-or-phrase"]
  ]
}
```

### Tag Reference

| Tag | Description | Example |
|-----|-------------|---------|
| `p` | Muted pubkey | `["p", "ab12...cd34"]` |
| `e` | Muted thread (event ID) | `["e", "ef56...gh78"]` |
| `t` | Muted hashtag | `["t", "politics"]` |
| `word` | Muted keyword or phrase | `["word", "spam phrase"]` |

### Typical Byte Sizes

| Entries | Approximate Size | TOON Cost |
|---------|-----------------|-----------|
| 5 muted pubkeys | ~500 bytes | ~$0.005 |
| 20 muted pubkeys | ~1500 bytes | ~$0.015 |
| 50 muted pubkeys + 10 words | ~4000 bytes | ~$0.04 |
| 200 muted pubkeys | ~14000 bytes | ~$0.14 |

### Filter Pattern

```json
{ "kinds": [10000], "authors": ["<pubkey-hex>"] }
```

## kind:10001 -- Pin List

kind:10001 is a **replaceable event** listing notes the user wants pinned to their profile.

### Event Structure

```
{
  "kind": 10001,
  "content": "<NIP-44-encrypted-private-pinned-entries>",
  "tags": [
    ["e", "<pinned-event-id-hex>"]
  ]
}
```

### Tag Reference

| Tag | Description | Example |
|-----|-------------|---------|
| `e` | Pinned event ID | `["e", "ab12...cd34"]` |

### Typical Byte Sizes

| Entries | Approximate Size | TOON Cost |
|---------|-----------------|-----------|
| 3 pinned notes | ~300 bytes | ~$0.003 |
| 10 pinned notes | ~500 bytes | ~$0.005 |

### Filter Pattern

```json
{ "kinds": [10001], "authors": ["<pubkey-hex>"] }
```

## kind:30000 -- Follow Sets (Categorized People)

kind:30000 is a **parameterized replaceable event** for organizing contacts into named categories. The `d` tag serves as the category identifier.

### Event Structure

```
{
  "kind": 30000,
  "content": "<NIP-44-encrypted-private-entries>",
  "tags": [
    ["d", "developers"],
    ["title", "Developer Friends"],
    ["description", "Developers I follow closely"],
    ["p", "<pubkey-hex-1>"],
    ["p", "<pubkey-hex-2>"],
    ["p", "<pubkey-hex-3>"]
  ]
}
```

### Tag Reference

| Tag | Required | Description |
|-----|----------|-------------|
| `d` | Yes | Category identifier (unique per user). E.g., "developers", "artists", "family". |
| `p` | Yes (at least one) | Pubkey of a person in this category. |
| `title` | No | Human-readable category title. |
| `image` | No | URL of an image representing the set. |
| `description` | No | Description of the category. |

### Typical Byte Sizes

| Category Size | Approximate Size | TOON Cost |
|--------------|-----------------|-----------|
| 5 people | ~500 bytes | ~$0.005 |
| 20 people | ~1600 bytes | ~$0.016 |
| 100 people | ~7500 bytes | ~$0.075 |

### Filter Patterns

```json
// All follow sets for a user
{ "kinds": [30000], "authors": ["<pubkey-hex>"] }

// Specific follow set by category name
{ "kinds": [30000], "authors": ["<pubkey-hex>"], "#d": ["developers"] }
```

## kind:30003 -- Bookmark Sets (Categorized Bookmarks)

kind:30003 is a **parameterized replaceable event** for organizing bookmarks into named collections. The `d` tag serves as the collection identifier.

### Event Structure

```
{
  "kind": 30003,
  "content": "<NIP-44-encrypted-private-entries>",
  "tags": [
    ["d", "nostr-dev-resources"],
    ["title", "Nostr Development Resources"],
    ["e", "<bookmarked-event-id-hex>", "<relay-url-hint>"],
    ["a", "30023:<pubkey-hex>:<article-d-tag>", "<relay-url-hint>"],
    ["t", "nostr"],
    ["r", "https://example.com/useful-resource"]
  ]
}
```

### Tag Reference

| Tag | Required | Description |
|-----|----------|-------------|
| `d` | Yes | Collection identifier. E.g., "nostr-dev-resources", "favorite-articles". |
| `e` | No | Bookmarked event ID with optional relay hint. |
| `a` | No | Bookmarked replaceable event (kind:pubkey:d-tag format) with relay hint. |
| `t` | No | Bookmarked hashtag. |
| `r` | No | Bookmarked URL. |
| `title` | No | Human-readable collection title. |
| `image` | No | URL of an image representing the set. |
| `description` | No | Description of the collection. |

### Typical Byte Sizes

| Collection Size | Approximate Size | TOON Cost |
|----------------|-----------------|-----------|
| 5 bookmarks | ~600 bytes | ~$0.006 |
| 20 bookmarks | ~2000 bytes | ~$0.02 |
| 50 bookmarks | ~5000 bytes | ~$0.05 |

### Filter Patterns

```json
// All bookmark sets for a user
{ "kinds": [30003], "authors": ["<pubkey-hex>"] }

// Specific bookmark set by collection name
{ "kinds": [30003], "authors": ["<pubkey-hex>"], "#d": ["nostr-dev-resources"] }
```

## Secondary List Kinds (Brief Reference)

### kind:10003 -- Bookmark List

Simple non-categorized bookmark list. Uses `e` and `a` tags. Replaceable.

```json
{ "kinds": [10003], "authors": ["<pubkey-hex>"] }
```

### kind:10004 -- Communities List

List of NIP-72 communities the user belongs to. Uses `a` tags pointing to kind:34550 community definitions.

```json
{ "kinds": [10004], "authors": ["<pubkey-hex>"] }
```

### kind:10005 -- Public Chats List

List of NIP-28 public chat channels the user follows. Uses `e` tags pointing to kind:40 channel creation events.

```json
{ "kinds": [10005], "authors": ["<pubkey-hex>"] }
```

### kind:10006 -- Blocked Relays List

Relays the user avoids. Uses `relay` tags with relay URLs.

```json
{ "kinds": [10006], "authors": ["<pubkey-hex>"] }
```

### kind:10007 -- Search Relays List

Preferred search relays. Uses `relay` tags.

```json
{ "kinds": [10007], "authors": ["<pubkey-hex>"] }
```

### kind:10009 -- User Groups List

NIP-29 groups the user belongs to. Uses `group` tags with group identifiers and `r` tags with relay URLs.

```json
{ "kinds": [10009], "authors": ["<pubkey-hex>"] }
```

### kind:10015 -- Interests List

User interests expressed as hashtags and interest sets. Uses `t` tags for hashtags and `a` tags pointing to kind:30015 interest sets.

```json
{ "kinds": [10015], "authors": ["<pubkey-hex>"] }
```

### kind:10030 -- User Emoji List

Custom emoji shortcodes. Uses `emoji` tags and `a` tags pointing to kind:30030 emoji sets.

```json
{ "kinds": [10030], "authors": ["<pubkey-hex>"] }
```

### kind:30002 -- Relay Sets

Named sets of relays (parameterized replaceable). Uses `relay` tags and a `d` tag for the set name.

```json
// All relay sets for a user
{ "kinds": [30002], "authors": ["<pubkey-hex>"] }

// Specific relay set
{ "kinds": [30002], "authors": ["<pubkey-hex>"], "#d": ["reading"] }
```

## NIP-32: Labeling

NIP-32 defines a labeling system using kind:1985 events and self-labeling tags on other event kinds.

### kind:1985 -- Label Event

kind:1985 is a **regular event** (non-replaceable). Each label creates a new, permanent event.

### Event Structure

```
{
  "kind": 1985,
  "content": "This article provides an excellent introduction to the topic.",
  "tags": [
    ["L", "ugc"],
    ["l", "review", "ugc"],
    ["e", "<labeled-event-id-hex>", "<relay-url-hint>"],
    ["p", "<labeled-event-author-pubkey-hex>"]
  ]
}
```

### Label with Multiple Namespaces

A single label event can include labels from multiple namespaces:

```
{
  "kind": 1985,
  "content": "",
  "tags": [
    ["L", "ISO-639-1"],
    ["L", "ugc"],
    ["l", "en", "ISO-639-1"],
    ["l", "informative", "ugc"],
    ["e", "<labeled-event-id-hex>", "<relay-url-hint>"]
  ]
}
```

### Labeling a Replaceable Event

Use an `a` tag to label a parameterized replaceable event:

```
{
  "kind": 1985,
  "content": "",
  "tags": [
    ["L", "com.example.quality"],
    ["l", "high-quality", "com.example.quality"],
    ["a", "30023:<pubkey-hex>:<article-d-tag>", "<relay-url-hint>"]
  ]
}
```

### Labeling a URL

Use an `r` tag to label an external resource:

```
{
  "kind": 1985,
  "content": "",
  "tags": [
    ["L", "ugc"],
    ["l", "educational", "ugc"],
    ["r", "https://example.com/tutorial"]
  ]
}
```

### Tag Reference

| Tag | Required | Description |
|-----|----------|-------------|
| `L` | Recommended | Label namespace declaration. Any string; use well-defined namespaces. If omitted, `ugc` is implied for `l` tags without a mark. |
| `l` | Yes | Label value. Third element must match an `L` tag in the same event. |
| `e` | Conditional | Target event ID (with optional relay hint). |
| `p` | Conditional | Target pubkey. |
| `a` | Conditional | Target replaceable event (kind:pubkey:d-tag format). |
| `r` | Conditional | Target URL. |
| `t` | Conditional | Target hashtag. |

At least one target tag (`e`, `p`, `a`, `r`, or `t`) is required.

### Namespace Conventions

| Namespace Pattern | Example | Use Case |
|------------------|---------|----------|
| `ugc` | `["l", "review", "ugc"]` | User-generated content classification |
| ISO standard | `["l", "en", "ISO-639-1"]` | Language identification |
| Reverse domain | `["l", "tutorial", "com.example.content"]` | Organization-specific taxonomy |
| `#t` prefix | `["l", "nostr", "#t"]` | Attach standard nostr hashtags to targets |

The `ugc` namespace is a catch-all for user-generated labels. ISO standards and reverse domain notation provide more structured, interoperable labeling.

### Self-Labeling

Non-kind:1985 events can include `L` and `l` tags to label themselves at creation time. The labels refer to the event itself:

```
{
  "kind": 1,
  "content": "Just finished reading about Interledger...",
  "tags": [
    ["L", "ugc"],
    ["l", "opinion", "ugc"]
  ]
}
```

### Typical Byte Sizes

| Label Complexity | Approximate Size | TOON Cost |
|-----------------|-----------------|-----------|
| Single label, single target | ~200 bytes | ~$0.002 |
| Multi-namespace, single target | ~300 bytes | ~$0.003 |
| Single label, multiple targets | ~350 bytes | ~$0.004 |

### Filter Patterns

```json
// All labels on a specific event
{ "kinds": [1985], "#e": ["<event-id>"] }

// All labels in a specific namespace
{ "kinds": [1985], "#L": ["ugc"] }

// All labels with a specific value
{ "kinds": [1985], "#l": ["review"] }

// Labels by a specific author
{ "kinds": [1985], "authors": ["<pubkey-hex>"] }

// Labels on a specific replaceable event
{ "kinds": [1985], "#a": ["30023:<pubkey-hex>:<d-tag>"] }
```

## List Deletion and Clearing

### NIP-09 Deletion (kind:5)

Publish a kind:5 deletion event targeting the list event ID to request relay removal:

```
{
  "kind": 5,
  "content": "removing old mute list",
  "tags": [
    ["e", "<list-event-id-hex>"],
    ["k", "10000"]
  ]
}
```

The `k` tag specifies the kind being deleted. Relays SHOULD honor deletion requests from the event author.

### Clearing via Empty Replaceable Event

For replaceable lists, publishing a new event with empty tags and empty content replaces the previous version:

```
{
  "kind": 10000,
  "content": "",
  "tags": []
}
```

This effectively clears the list while maintaining a valid replaceable event slot.

### Label Deletion

Labels (kind:1985) are regular events and can be deleted via kind:5:

```
{
  "kind": 5,
  "content": "removing incorrect label",
  "tags": [
    ["e", "<label-event-id-hex>"],
    ["k", "1985"]
  ]
}
```
