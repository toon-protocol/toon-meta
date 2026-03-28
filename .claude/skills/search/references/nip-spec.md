# NIP Specification: Search (NIP-50)

> **Why this reference exists:** Agents need precise search filter syntax and relay capability detection to construct valid search queries. This file covers the NIP-50 search extension to NIP-01 filters, relay support detection via NIP-11, and search extension syntax. Understanding these structures prevents failed search queries against relays that do not support NIP-50.

## NIP-50: Search Capability

NIP-50 defines a search capability for Nostr relays by extending the NIP-01 filter object with a `search` field. Search is an optional relay feature -- not all relays implement it.

### Search Filter Extension

The `search` field is a plain-text string added to a standard NIP-01 REQ filter object. It works alongside all existing filter fields.

**Filter structure with search:**

```json
{
  "kinds": [1],
  "search": "bitcoin lightning",
  "limit": 20
}
```

The `search` field contains a human-readable search query string. The relay performs full-text search over stored events matching the other filter criteria and returns matching events.

### Combined Filters

The `search` field combines with all standard NIP-01 filter fields:

| Filter Field | Behavior with `search` |
|-------------|----------------------|
| `kinds` | Restricts search to specific event kinds |
| `authors` | Restricts search to events by specific pubkeys |
| `#e` | Restricts search to events referencing specific event IDs |
| `#p` | Restricts search to events mentioning specific pubkeys |
| `since` | Restricts search to events after a timestamp |
| `until` | Restricts search to events before a timestamp |
| `limit` | Limits the number of search results returned |
| `ids` | Restricts search to specific event IDs (rarely useful with search) |

**Example: Search by kind and author:**

```json
{
  "kinds": [30023],
  "authors": ["<hex-pubkey>"],
  "search": "interledger protocol",
  "limit": 10
}
```

This searches for kind:30023 long-form articles by a specific author containing "interledger protocol".

**Example: Search within a time range:**

```json
{
  "kinds": [1],
  "search": "nostr relay",
  "since": 1700000000,
  "until": 1710000000,
  "limit": 50
}
```

### REQ Message Format

Search queries use the standard NIP-01 REQ message format:

```json
["REQ", "<subscription_id>", {"search": "query string", "kinds": [1], "limit": 20}]
```

The relay responds with:
- An EVENT message (subscription_id + event) for each matching event
- An EOSE message (subscription_id) when all stored matches have been sent

After EOSE, the subscription remains open and the relay may send additional EVENT messages for new events that match the search criteria (if the relay supports this behavior).

### Closing a Search Subscription

To stop receiving results, send a CLOSE message:

```json
["CLOSE", "<subscription_id>"]
```

## Relay Support Detection

### NIP-11 Relay Information Document

Relays that support NIP-50 advertise it in their NIP-11 relay information document. The NIP-11 document is fetched via HTTP GET with an `Accept: application/nostr+json` header on the relay's WebSocket URL.

**NIP-11 response with NIP-50 support:**

```json
{
  "name": "Example Relay",
  "supported_nips": [1, 2, 4, 9, 11, 12, 15, 16, 20, 22, 28, 33, 40, 50],
  "software": "strfry",
  "version": "1.0.0"
}
```

Check that `50` is present in the `supported_nips` array before issuing search queries. If NIP-50 is not listed, the relay will likely ignore the `search` field or return a NOTICE error.

### Detection Flow

1. Fetch the relay's NIP-11 information document via HTTP GET
2. Parse the `supported_nips` array
3. Check for the presence of `50`
4. If present, the relay supports NIP-50 search queries
5. If absent, do not send search queries to this relay

## Search Extensions

Some relays support extensions to the search string. Extensions are prefixed keywords within the `search` field value.

### Known Extensions

| Extension | Purpose | Example |
|-----------|---------|---------|
| `include:spam` | Include events flagged as spam in results | `"search": "bitcoin include:spam"` |

Extensions are relay-specific and not standardized. Check relay documentation for supported extensions.

### Extension Syntax

Extensions appear as whitespace-separated tokens within the search string. The relay parses the search string and extracts recognized extension keywords before performing the text search on the remaining query.

```json
{
  "kinds": [1],
  "search": "bitcoin include:spam",
  "limit": 50
}
```

In this example, the relay would search for "bitcoin" in kind:1 events and include events that would normally be filtered out as spam.

## Search Behavior Notes

### Relay-Specific Behavior

NIP-50 defines the filter syntax but does not prescribe how relays implement search internally. Different relays may:

- Use different full-text search engines (SQLite FTS, PostgreSQL full-text, Elasticsearch, etc.)
- Support different query syntax (boolean operators, phrase matching, wildcards)
- Weight results differently (by relevance, by timestamp, by popularity)
- Index different event fields (content only, content + tags, content + metadata)

### What Gets Searched

The NIP-50 specification does not mandate which event fields are searched. Most implementations search the `content` field. Some may also search tag values. The exact behavior depends on the relay implementation.

### Result Ordering

Result ordering is relay-specific. Some relays return results ordered by relevance score, others by creation timestamp (`created_at`). The `limit` field constrains the number of results regardless of ordering.

### Empty Results

If no events match the search query and filter criteria, the relay sends only the EOSE message with no preceding EVENT messages:

```json
["EOSE", "<subscription_id>"]
```

This is the same behavior as any NIP-01 subscription with no matching events.
