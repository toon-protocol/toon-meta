# NIP-89 Specification: Recommended Application Handlers

> **Why this reference exists:** Agents need precise tag formats, event structures, and URL template syntax to construct valid application handler events. This file covers the full NIP-89 specification for kind:31990 (handler information) and kind:31989 (handler recommendations). Understanding these structures prevents malformed handler advertisements that waste ILP payment on events that clients cannot parse.

## Overview

NIP-89 defines a decentralized application discovery system for Nostr. Applications advertise which event kinds they handle (kind:31990), and users recommend applications they trust (kind:31989). Together, these enable clients to suggest appropriate applications for viewing or interacting with specific event kinds.

## kind:31990 -- Application Handler Information

A parameterized replaceable event (kind 30000-39999 range) where an application publishes its capabilities.

### Event Structure

| Field | Value |
|-------|-------|
| `kind` | `31990` |
| `content` | Markdown description of the application |
| `created_at` | Unix timestamp |
| `pubkey` | Application publisher's public key |
| `tags` | See tag table below |

### Tag Table for kind:31990

| Tag | Required | Format | Description |
|-----|----------|--------|-------------|
| `d` | Yes | `["d", "<app-identifier>"]` | Unique application identifier (typically app name or reverse-domain). This is the parameterized replaceable key. |
| `k` | Yes (at least one) | `["k", "<kind-number>"]` | Event kind the app can handle, as a string. Repeat for each supported kind. |
| `web` | No | `["web", "<url-template>", "<permission>"]` | Web URL template. `<bech32>` placeholder for entity deep links. Permission: `"read"`, `"write"`, or omitted for both. |
| `ios` | No | `["ios", "<url-or-uri>"]` | iOS App Store URL or URI scheme for the app. |
| `android` | No | `["android", "<url-or-uri>"]` | Android Play Store URL or URI scheme for the app. |
| `r` | No | `["r", "<relay-url>"]` | Relay hint where the app publishes events. Repeatable. |

### URL Template Syntax

Platform URL tags (`web`, `ios`, `android`) can include a `<bech32>` placeholder that clients replace with the appropriate NIP-19 bech32-encoded entity:

```
["web", "https://example.com/<bech32>", "read"]
["web", "https://example.com/compose?to=<bech32>", "write"]
```

When a client wants to open a specific event or profile in the app, it replaces `<bech32>` with the entity's bech32 encoding (e.g., `nevent1...`, `nprofile1...`, `naddr1...`).

If no `<bech32>` placeholder is present, the URL is used as-is (e.g., the app's homepage).

### Permission Values for Web Tags

| Permission | Meaning |
|-----------|---------|
| `"read"` | App can display/read events of this kind |
| `"write"` | App can create/write events of this kind |
| (omitted) | App supports both read and write |

### Multiple Kind Support

An app that handles multiple event kinds includes one `k` tag per kind:

```
["k", "1"]        // handles short notes
["k", "30023"]    // handles long-form articles
["k", "31990"]    // handles app handler listings (meta!)
```

### Content Field

The `content` field contains a markdown description of the application. This should describe:
- What the application does
- Key features and capabilities
- Target audience or use case
- Any special requirements (e.g., TOON ILP support)

### Example kind:31990 Event

```json
{
  "kind": 31990,
  "content": "# MyNostrApp\n\nA full-featured Nostr client with support for notes, articles, and DVM services.\n\n## Features\n- Rich text editing for long-form content\n- DVM job management\n- Multi-relay support",
  "tags": [
    ["d", "my-nostr-app"],
    ["k", "1"],
    ["k", "30023"],
    ["k", "5600"],
    ["web", "https://mynostrapp.com/<bech32>", "read"],
    ["web", "https://mynostrapp.com/compose?ref=<bech32>", "write"],
    ["ios", "https://apps.apple.com/app/mynostrapp/id123456"],
    ["android", "https://play.google.com/store/apps/details?id=com.mynostrapp"],
    ["r", "wss://relay.mynostrapp.com"]
  ]
}
```

## kind:31989 -- Application Handler Recommendation

A parameterized replaceable event where a user recommends one or more applications for handling a specific event kind.

### Event Structure

| Field | Value |
|-------|-------|
| `kind` | `31989` |
| `content` | Optional review text or endorsement |
| `created_at` | Unix timestamp |
| `pubkey` | Recommending user's public key |
| `tags` | See tag table below |

### Tag Table for kind:31989

| Tag | Required | Format | Description |
|-----|----------|--------|-------------|
| `d` | Yes | `["d", "<kind-number>"]` | The event kind being recommended for, as a string. This is the parameterized replaceable key -- one recommendation per kind per user. |
| `a` | Yes (at least one) | `["a", "31990:<pubkey>:<d-tag>", "<relay-hint>"]` | Reference to the kind:31990 handler info event being recommended. The relay hint (third element) is optional but recommended. |

### Multiple Recommendations Per Kind

A user can recommend multiple apps for the same kind by including multiple `a` tags. The order implies preference (first = most preferred):

```json
{
  "kind": 31989,
  "content": "Both great clients for reading articles, but AppA has better markdown rendering.",
  "tags": [
    ["d", "30023"],
    ["a", "31990:<pubkeyA>:app-a", "wss://relay.app-a.com"],
    ["a", "31990:<pubkeyB>:app-b", "wss://relay.app-b.com"]
  ]
}
```

### Recommendation Scoping

The `d` tag scopes the recommendation to a specific event kind. A user who wants to recommend apps for multiple kinds publishes separate kind:31989 events for each kind:

- `["d", "1"]` -- recommendation for kind:1 (short notes) handlers
- `["d", "30023"]` -- recommendation for kind:30023 (articles) handlers
- `["d", "9735"]` -- recommendation for kind:9735 (zap receipt) handlers

Because kind:31989 is parameterized replaceable (keyed by `d` tag), publishing a new recommendation for the same kind replaces the previous one.

### Example kind:31989 Event

```json
{
  "kind": 31989,
  "content": "Best app I have found for reading long-form articles. Great markdown support and offline reading.",
  "tags": [
    ["d", "30023"],
    ["a", "31990:abc123def456:article-reader-pro", "wss://relay.example.com"]
  ]
}
```

## Querying Application Handlers

### Finding Apps That Handle a Specific Kind

Subscribe with a filter on kind:31990 and the `k` tag:

```json
["REQ", "find-apps", { "kinds": [31990], "#k": ["30023"] }]
```

This returns all kind:31990 events that include `["k", "30023"]` in their tags.

### Finding Recommendations for a Kind

Subscribe with a filter on kind:31989 and the `d` tag:

```json
["REQ", "find-recs", { "kinds": [31989], "#d": ["30023"] }]
```

This returns all recommendations for kind:30023 handlers.

### Finding a Specific User's Recommendations

Filter by author and kind:

```json
["REQ", "user-recs", { "kinds": [31989], "authors": ["<user-pubkey>"] }]
```

### Finding a Specific App's Handler Info

Filter by author and `d` tag:

```json
["REQ", "app-info", { "kinds": [31990], "authors": ["<app-pubkey>"], "#d": ["my-nostr-app"] }]
```

## Parameterized Replaceable Semantics

Both kind:31990 and kind:31989 are parameterized replaceable events (kind range 30000-39999). Key implications:

1. **Unique by pubkey + kind + d-tag:** Only one event per combination exists on a relay. Publishing a new event with the same pubkey, kind, and `d` tag replaces the previous one.
2. **Latest wins:** Relays keep only the event with the highest `created_at` for each pubkey + kind + d-tag combination.
3. **Addressable via naddr1:** Both kinds can be referenced using `naddr1` bech32 encoding (NIP-19) with kind + pubkey + d-tag.
4. **Deletable via NIP-09:** A kind:5 deletion event referencing the `a` tag address (`31990:<pubkey>:<d-tag>`) can remove the handler listing.

## Client Behavior

Clients implementing NIP-89 should:

1. When encountering an event kind the client does not natively handle, query for kind:31990 events with the appropriate `k` tag filter.
2. Check the user's kind:31989 recommendations to prioritize apps the user has endorsed.
3. Present matched applications with their platform-appropriate URLs, substituting `<bech32>` with the relevant entity encoding.
4. Fall back to generic app listings if the user has no recommendations for the given kind.
