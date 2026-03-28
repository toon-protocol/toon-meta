# NIP Specification: Highlights

> **Why this reference exists:** Agents need precise event structures to construct valid highlight events. This file covers the wire format for kind:9802 (highlights, NIP-84). Understanding these structures prevents malformed events that waste ILP payment on rejected publishes.

## kind:9802 -- Highlights (NIP-84)

kind:9802 is a **regular event** (not replaceable). Each highlight is a standalone event representing a specific text passage the author found noteworthy. Multiple highlights from the same source are separate events.

### Event Structure

```
{
  "kind": 9802,
  "content": "The economic incentive of per-byte pricing naturally selects for quality over quantity.",
  "tags": [
    ["a", "30023:<source-author-pubkey>:article-slug"],
    ["p", "<source-author-pubkey>"],
    ["context", "In traditional social networks, posting is free, which encourages volume. The economic incentive of per-byte pricing naturally selects for quality over quantity. This dynamic creates a fundamentally different content landscape."]
  ]
}
```

### Content Field

The `content` field contains the exact highlighted text passage. This is the core of the highlight event -- the specific words the highlighter found noteworthy.

**Rules:**
- The content is the highlighted text itself, not commentary about it
- The passage should be a direct quote from the source material
- Preserve the original formatting (capitalization, punctuation) of the source text
- Do not add quotation marks -- the event kind itself signals that the content is a quotation

### Tag Reference

| Tag | Required | Description |
|-----|----------|-------------|
| `a` | Conditional | Source reference for parameterized replaceable events (e.g., kind:30023 articles). Format: `["a", "<kind>:<pubkey>:<d-tag>"]`. Use when highlighting articles or other addressable content. |
| `e` | Conditional | Source reference by event ID. Format: `["e", "<event-id>"]`. Use when highlighting a specific non-replaceable event (e.g., a kind:1 note). |
| `r` | Conditional | Source URL for web content. Format: `["r", "<url>"]`. Use when highlighting content from a website or external document. |
| `p` | Recommended | Author of the source content. Format: `["p", "<author-pubkey>"]`. Enables notifications and attribution. |
| `context` | Optional | Surrounding text that gives the highlight context. The highlighted passage (content field) should appear within this context text. |

**Source reference requirement:** At least one of `a`, `e`, or `r` must be present to identify the source being highlighted. Multiple source tags are allowed (e.g., both `a` and `r` if the article is available on Nostr and the web).

### Source Reference Patterns

**Highlighting a kind:30023 article (most common):**
```
{
  "kind": 9802,
  "content": "Payment channels enable micropayments without on-chain transaction costs.",
  "tags": [
    ["a", "30023:ab12cd34...:<d-tag>"],
    ["p", "ab12cd34..."]
  ]
}
```

Use the `a` tag with the article's kind, author pubkey, and d-tag. This references the article by its stable address, so the highlight remains valid even if the article is updated.

**Highlighting a kind:1 note:**
```
{
  "kind": 9802,
  "content": "The best code is no code at all.",
  "tags": [
    ["e", "ef56gh78..."],
    ["p", "ab12cd34..."]
  ]
}
```

Use the `e` tag with the specific event ID. Since kind:1 notes are not replaceable, the event ID is a stable reference.

**Highlighting web content:**
```
{
  "kind": 9802,
  "content": "Decentralized protocols shift power from platforms to users.",
  "tags": [
    ["r", "https://example.com/article-about-decentralization"],
    ["p", "ab12cd34..."],
    ["context", "The fundamental promise of decentralized protocols is simple: decentralized protocols shift power from platforms to users. This inversion has implications for every layer of the technology stack."]
  ]
}
```

Use the `r` tag with the source URL. The `p` tag is still recommended if the web author has a Nostr pubkey.

**Highlighting with full context:**
```
{
  "kind": 9802,
  "content": "every byte has a price",
  "tags": [
    ["a", "30023:ab12cd34...:toon-economics"],
    ["p", "ab12cd34..."],
    ["context", "On TOON, every byte has a price, which means content quality becomes an economic signal rather than a social convention."]
  ]
}
```

The `context` tag provides the surrounding text so readers can understand the highlight in its original setting. The highlighted passage should appear verbatim within the context text.

### Querying and Filtering

To fetch highlights, use NIP-01 subscription filters:

- **All highlights from an author:** `{ kinds: [9802], authors: ["<pubkey>"] }`
- **Highlights of a specific article:** `{ kinds: [9802], "#a": ["30023:<pubkey>:<d-tag>"] }`
- **Highlights of a specific event:** `{ kinds: [9802], "#e": ["<event-id>"] }`
- **Highlights referencing a URL:** `{ kinds: [9802], "#r": ["<url>"] }`
- **Highlights mentioning a specific author:** `{ kinds: [9802], "#p": ["<author-pubkey>"] }`
- **Recent highlights from anyone:** `{ kinds: [9802], limit: 20 }`

### Relationship to Other Event Kinds

- **kind:30023 (NIP-23):** The most common source for highlights. Articles provide structured long-form content with notable passages worth highlighting.
- **kind:1 (NIP-01):** Short notes can also be highlighted, though their brevity means the entire note may be the highlight.
- **kind:7 (NIP-25):** Reactions express approval; highlights express curation. A reaction says "I like this," while a highlight says "this specific passage is noteworthy."
- **kind:6/16 (NIP-18):** Reposts share an entire event; highlights share a specific passage from an event.

### Non-replaceable Semantics

kind:9802 events are regular (non-replaceable) events. This means:
- Each highlight is permanent once published (subject to NIP-09 deletion requests)
- Publishing multiple highlights from the same source creates multiple independent events
- There is no mechanism to "update" a highlight -- publish a new one and optionally delete the old one
- The event ID is the stable identifier for each highlight
