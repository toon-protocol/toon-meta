# NIP-11, NIP-65, and NIP-66 Specifications: Relay Discovery

> **Why this reference exists:** Relay discovery spans three NIPs: NIP-11 (Relay Information Document), NIP-65 (Relay List Metadata), and NIP-66 (Relay Discovery and Liveness Monitoring). Agents need to understand how to query relay capabilities via HTTP, how users publish their relay preferences, and how monitors track relay health. This reference covers the protocol mechanics that govern relay discovery on any Nostr relay, with TOON-specific extensions covered in toon-extensions.md.

## NIP-11: Relay Information Document

NIP-11 defines an HTTP-based mechanism for clients to discover relay capabilities before connecting via WebSocket.

### Request Format

Send an HTTP GET request to the relay's WebSocket URL, replacing the WebSocket scheme with HTTPS:

- `wss://relay.example.com` becomes `https://relay.example.com`
- `ws://relay.example.com` becomes `http://relay.example.com`

**Required header:** `Accept: application/nostr+json`

Without the `Accept: application/nostr+json` header, the relay may return an HTML page or other non-JSON response. This header is critical.

### Response Format

The relay returns a JSON object with the following fields (all optional):

```json
{
  "name": "Example Relay",
  "description": "A relay for general-purpose Nostr events",
  "pubkey": "<relay-operator-hex-pubkey>",
  "contact": "admin@example.com",
  "supported_nips": [1, 2, 9, 11, 12, 15, 16, 20, 22, 28, 33, 40, 65],
  "software": "https://github.com/example/relay",
  "version": "1.0.0",
  "limitation": {
    "max_message_length": 16384,
    "max_subscriptions": 20,
    "max_filters": 100,
    "max_limit": 5000,
    "max_subid_length": 100,
    "max_event_tags": 100,
    "max_content_length": 8196,
    "min_pow_difficulty": 0,
    "auth_required": false,
    "payment_required": true,
    "restricted_writes": true,
    "created_at_lower_limit": 0,
    "created_at_upper_limit": 0
  },
  "relay_countries": ["US", "DE"],
  "language_tags": ["en"],
  "tags": ["TOON", "ILP-gated"],
  "posting_policy": "https://relay.example.com/policy",
  "payments_url": "https://relay.example.com/payments",
  "fees": {
    "admission": [{"amount": 0, "unit": "msats"}],
    "subscription": [{"amount": 0, "unit": "msats", "period": 0}],
    "publication": [{"amount": 0, "unit": "msats"}]
  },
  "icon": "https://relay.example.com/icon.png"
}
```

### Key Fields for Agents

- **`supported_nips`** -- Array of NIP numbers the relay supports. Always check this before assuming a relay supports specific event kinds or features.
- **`payment_required`** -- Boolean. On TOON relays, this is always `true`. Clients must pay via ILP to publish events.
- **`limitation`** -- Object describing relay constraints. `max_message_length` and `max_content_length` are important for sizing events.
- **`fees`** -- Standard NIP-11 fee structure. TOON relays extend this with per-byte ILP pricing via the `/health` endpoint.
- **`retention`** -- Array of retention policy objects describing how long the relay stores events. Each object may specify `time` (seconds) and/or `count` limits, optionally filtered by `kinds`. Relays with limited retention may discard old events.
- **`relay_countries`** -- Array of ISO 3166-1 alpha-2 country codes (e.g., `["US", "DE"]`) indicating where the relay operates. Useful for geographic relay selection and latency optimization.

### Limitation Object Fields

| Field | Type | Description |
|-------|------|-------------|
| `max_message_length` | integer | Maximum WebSocket message size in bytes |
| `max_subscriptions` | integer | Maximum concurrent subscriptions per connection |
| `max_filters` | integer | Maximum filters per subscription |
| `max_limit` | integer | Maximum `limit` value in filters |
| `max_subid_length` | integer | Maximum subscription ID length |
| `max_event_tags` | integer | Maximum number of tags per event |
| `max_content_length` | integer | Maximum content field length |
| `min_pow_difficulty` | integer | Minimum proof-of-work difficulty for events |
| `auth_required` | boolean | Whether NIP-42 authentication is required |
| `payment_required` | boolean | Whether payment is required to publish |
| `restricted_writes` | boolean | Whether writes are restricted |
| `created_at_lower_limit` | integer | Earliest acceptable `created_at` timestamp (0 = no limit) |
| `created_at_upper_limit` | integer | Latest acceptable `created_at` timestamp (0 = no limit) |

## NIP-65: Relay List Metadata

NIP-65 defines kind:10002 events for publishing a user's relay preferences. This enables other users and clients to discover where a person reads and writes.

### kind:10002 Event Structure

```json
{
  "kind": 10002,
  "pubkey": "<user-hex-pubkey>",
  "created_at": 1234567890,
  "tags": [
    ["r", "wss://relay1.example.com", "read"],
    ["r", "wss://relay2.example.com", "write"],
    ["r", "wss://relay3.example.com"]
  ],
  "content": "",
  "id": "<event-id>",
  "sig": "<signature>"
}
```

### r Tag Semantics

Each `r` tag specifies a relay URL and an optional read/write marker:

| Tag Format | Meaning |
|-----------|---------|
| `["r", "wss://relay.example.com"]` | Relay used for both reading and writing |
| `["r", "wss://relay.example.com", "read"]` | Relay used only for reading |
| `["r", "wss://relay.example.com", "write"]` | Relay used only for writing |

**Content field:** Always empty string (`""`). All relay information is in the tags.

### Replaceable Event Semantics

kind:10002 is a **replaceable event** (kind 10000-19999). Publishing a new kind:10002 event replaces the previous one entirely. The latest event (by `created_at`) is the authoritative relay list.

### Client Relay Selection

Clients use kind:10002 data to determine where to fetch a user's events:

1. **To read a user's posts:** Connect to their `read` and unmarked relays
2. **To send a user a message:** Publish to their `write` and unmarked relays
3. **To discover a user's relay list:** Query any relay where the user publishes for kind:10002 events

### Filter for Relay List Discovery

```json
{
  "kinds": [10002],
  "authors": ["<target-user-hex-pubkey>"]
}
```

This returns the user's latest relay list (one event, since it is replaceable).

## NIP-66: Relay Discovery and Liveness Monitoring

NIP-66 defines a systematic approach to relay monitoring through three event kinds published by relay monitor services.

### kind:30166 -- Relay Discovery Event

Published by relay monitors. Contains a snapshot of a relay's metadata and status. This is a **parameterized replaceable event** with the `d` tag set to the relay URL.

```json
{
  "kind": 30166,
  "pubkey": "<monitor-hex-pubkey>",
  "created_at": 1234567890,
  "tags": [
    ["d", "wss://relay.example.com"],
    ["n", "clearnet"],
    ["N", "1"],
    ["N", "11"],
    ["N", "65"],
    ["R", "read"],
    ["R", "write"],
    ["T", "pay-to-relay"],
    ["s", "online"],
    ["rtt", "open", "150"],
    ["rtt", "read", "200"],
    ["rtt", "write", "250"]
  ],
  "content": ""
}
```

### kind:30166 Tag Reference

| Tag | Format | Description |
|-----|--------|-------------|
| `d` | `["d", "wss://relay.example.com"]` | Relay URL (parameterized replaceable identifier) |
| `n` | `["n", "clearnet"]` or `["n", "tor"]` | Network type |
| `N` | `["N", "11"]` | Supported NIP number (one tag per NIP) |
| `R` | `["R", "read"]` or `["R", "write"]` | Relay capabilities |
| `T` | `["T", "pay-to-relay"]` | Relay type tags |
| `s` | `["s", "online"]` or `["s", "offline"]` | Relay status |
| `rtt` | `["rtt", "open", "150"]` | Round-trip time for connection open (ms) |
| `rtt` | `["rtt", "read", "200"]` | Round-trip time for read operations (ms) |
| `rtt` | `["rtt", "write", "250"]` | Round-trip time for write operations (ms) |

### kind:10166 -- Relay Monitor Registration

Published by monitor services to register themselves. Declares monitoring parameters.

```json
{
  "kind": 10166,
  "pubkey": "<monitor-hex-pubkey>",
  "created_at": 1234567890,
  "tags": [
    ["timeout", "open", "5000"],
    ["timeout", "read", "15000"],
    ["timeout", "write", "15000"],
    ["frequency", "3600"]
  ],
  "content": ""
}
```

### kind:10166 Tag Reference

| Tag | Format | Description |
|-----|--------|-------------|
| `timeout` | `["timeout", "open", "5000"]` | Connection open timeout in milliseconds |
| `timeout` | `["timeout", "read", "15000"]` | Read operation timeout in milliseconds |
| `timeout` | `["timeout", "write", "15000"]` | Write operation timeout in milliseconds |
| `frequency` | `["frequency", "3600"]` | Check interval in seconds |
| `t` | `["t", "clearnet"]` | Network types the monitor covers (e.g., clearnet, tor) |

### kind:10066 -- Relay List for Monitoring

Published by monitors to declare which relays they are actively monitoring. Uses `r` tags similar to kind:10002.

```json
{
  "kind": 10066,
  "pubkey": "<monitor-hex-pubkey>",
  "created_at": 1234567890,
  "tags": [
    ["r", "wss://relay1.example.com"],
    ["r", "wss://relay2.example.com"],
    ["r", "wss://relay3.example.com"]
  ],
  "content": ""
}
```

### Filter Patterns for NIP-66

**Discover all monitored relays:**
```json
{ "kinds": [30166] }
```

**Find monitoring data for a specific relay:**
```json
{ "kinds": [30166], "#d": ["wss://relay.example.com"] }
```

**Find active relay monitors:**
```json
{ "kinds": [10166] }
```

**Find which relays a monitor tracks:**
```json
{ "kinds": [10066], "authors": ["<monitor-hex-pubkey>"] }
```

**Find pay-to-relay relays:**
```json
{ "kinds": [30166], "#T": ["pay-to-relay"] }
```

**Find online relays:**
```json
{ "kinds": [30166], "#s": ["online"] }
```

## Event Kind Summary

| Kind | Name | Type | Content | Key Tags |
|------|------|------|---------|----------|
| 10002 | Relay List Metadata | Replaceable | Empty string | `r` tags with optional read/write markers |
| 30166 | Relay Discovery | Parameterized Replaceable | Empty string | `d` (relay URL), `n`, `N`, `R`, `T`, `s`, `rtt` |
| 10166 | Relay Monitor Registration | Replaceable | Empty string | `timeout`, `frequency` |
| 10066 | Relay List for Monitoring | Replaceable | Empty string | `r` tags (relay URLs) |

kind:10002 is the only event kind in this skill that users publish directly. kind:30166, kind:10166, and kind:10066 are published by relay monitor services. NIP-11 is an HTTP endpoint, not an event kind.
