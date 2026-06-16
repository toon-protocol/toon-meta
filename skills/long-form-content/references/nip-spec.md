# NIP Specifications: Long-form Content Events

> **Why this reference exists:** Agents need precise event structures to construct valid long-form content events. This file covers the wire format for kind:30023 (long-form articles, NIP-23) and the subject tag extension (NIP-14). Understanding these structures prevents malformed events that waste ILP payment on rejected publishes.

## kind:30023 -- Long-form Content (NIP-23)

kind:30023 is a **parameterized replaceable event** (address range 30000-39999). Unlike simple replaceable events (like kind:0), parameterized replaceable events use a `d` tag to distinguish between multiple events of the same kind from the same author. A pubkey can have many kind:30023 events, each identified by a different `d` tag value.

### Event Structure

```
{
  "kind": 30023,
  "content": "# Article Title\n\nThis is the article body in **markdown** format.\n\n## Section One\n\nParagraph text with [links](https://example.com) and `inline code`.\n\n```\ncode block\n```\n\n- List item one\n- List item two\n",
  "tags": [
    ["d", "my-first-article"],
    ["title", "My First Article on TOON"],
    ["summary", "An introduction to publishing long-form content on the TOON network."],
    ["image", "https://example.com/cover.jpg"],
    ["published_at", "1711324800"],
    ["t", "toon"],
    ["t", "tutorial"],
    ["subject", "Getting started with TOON publishing"]
  ]
}
```

### Tag Reference

| Tag | Required | Description |
|-----|----------|-------------|
| `d` | Yes | Article identifier, unique per author. Determines which article is replaced on update. |
| `title` | Yes | Article title displayed in feeds and listings. |
| `summary` | No | Brief excerpt or description. Used by clients for article previews. |
| `image` | No | Cover image URL for visual previews. |
| `published_at` | No | Unix timestamp (as string) of publication time. Absence signals draft status. |
| `t` | No | Hashtag-style topic labels (one per tag, multiple allowed). |
| `subject` | No | NIP-14 descriptive subject line for categorization. |

### Content Format

The `content` field contains markdown text. Supported formatting includes:
- **Headers** (`#`, `##`, `###`) for article structure
- **Bold/italic** (`**bold**`, `*italic*`) for emphasis
- **Links** (`[text](url)`) for references
- **Code blocks** (fenced with triple backticks) for technical content
- **Lists** (ordered and unordered) for structured information
- **Images** (`![alt](url)`) for inline media

### Parameterized Replaceable Semantics

When a relay receives a kind:30023 event, it checks the `d` tag value combined with the author's pubkey:
- If no existing event matches the same pubkey + kind + `d` tag value, the event is stored as new
- If an existing event matches, the relay replaces it with the newer event (by `created_at` timestamp)
- Different `d` tag values are independent articles -- replacing one does not affect others

This means:
- An author can have many articles simultaneously (each with a unique `d` tag)
- Updating an article means publishing a new kind:30023 with the same `d` tag value
- The `d` tag value is the stable identifier clients use to link to a specific article
- Historical versions are discarded by compliant relays

### Draft vs Published

The `published_at` tag controls article visibility:
- **Draft:** No `published_at` tag present. Clients may hide drafts from public feeds.
- **Published:** `published_at` tag set to a unix timestamp string. Clients display the article in feeds.
- **Backdated:** `published_at` can be set to a past timestamp to indicate original publication date (e.g., migrating content from another platform).

The `created_at` field (standard Nostr event timestamp) tracks when the event was signed, while `published_at` tracks the intended publication date. These can differ.

## NIP-14 -- Subject Tags

NIP-14 defines the `subject` tag, applicable to any event kind.

### Tag Format

```
["subject", "<subject-text>"]
```

The subject is a free-form text string, similar to an email subject line. It provides a concise description of the event's topic or angle.

### Usage with kind:30023

For long-form articles, the subject tag serves a different purpose than other metadata tags:
- **`title`** is the article heading displayed prominently
- **`summary`** is a multi-sentence excerpt or description
- **`subject`** is a brief topic categorization, like a subject line
- **`t` tags** are hashtag-style labels for broad topic matching

Example of all four in context:
- Title: "Building Your First TOON Integration"
- Summary: "A step-by-step guide to publishing events on TOON relays, from key generation to payment channel setup."
- Subject: "TOON development tutorial"
- Tags: `["t", "toon"]`, `["t", "development"]`, `["t", "tutorial"]`

### Usage with Other Event Kinds

NIP-14 is not limited to kind:30023. The `subject` tag can be added to kind:1 (short notes) or any other event kind to provide a subject line. In kind:1, it functions like an email subject line for threaded conversations.

## Filtering and Querying

To fetch long-form articles, use NIP-01 subscription filters:

- **All articles from an author:** `{ kinds: [30023], authors: ["<pubkey>"] }`
- **A specific article by d tag:** `{ kinds: [30023], authors: ["<pubkey>"], "#d": ["<d-tag-value>"] }`
- **Articles with a specific hashtag:** `{ kinds: [30023], "#t": ["<topic>"] }`
- **Recent articles from anyone:** `{ kinds: [30023], limit: 20 }`

The `#d` filter is particularly useful for fetching the latest version of a known article, since parameterized replaceable semantics mean only the latest version is retained.
