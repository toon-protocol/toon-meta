# NIP-38 Specification: User Statuses

> **Why this reference exists:** Agents need precise event structures to construct valid user status events. This file covers the wire format for kind:30315 (user status), including d tag types, optional tags, and parameterized replaceable semantics. Understanding these structures prevents malformed events that waste ILP payment on rejected publishes.

## kind:30315 -- User Status

kind:30315 is a **parameterized replaceable event** (per NIP-01). The `d` tag determines the status category. For a given pubkey and `d` tag value, only the most recent kind:30315 is retained by relays. Publishing a new event with the same `d` tag replaces the previous one.

### Event Structure

```
{
  "kind": 30315,
  "content": "Working on the TOON SDK",
  "tags": [
    ["d", "general"],
    ["r", "https://github.com/toon-protocol/town"]
  ]
}
```

### d Tag -- Status Type

The `d` tag determines the status category. Multiple status types can coexist independently for the same pubkey.

| d Tag Value | Purpose | Example Content |
|-------------|---------|-----------------|
| `general` | General-purpose status message | "Working on TOON SDK", "At a conference", "AFK" |
| `music` | Currently playing music | "Listening to Dark Side of the Moon - Pink Floyd" |
| Custom string | Any custom status category | "gaming", "reading", "streaming" |

Each `d` tag value creates an independent replaceable slot. A user can have both a `general` status and a `music` status simultaneously. Updating one does not affect the other.

### Content Field

The `content` field contains the status text as a free-form string.

- **Setting a status:** Populate `content` with the desired status text
- **Clearing a status:** Publish with the same `d` tag and **empty string** content (`""`)

An empty content field signals that the user has no active status for that category. Clients should treat this as "status cleared" and stop displaying it.

### Optional Tags

#### r Tag -- URL Reference

```
["r", "https://open.spotify.com/track/abc123"]
```

Associates a URL with the status. Common uses:
- Music status: link to the song/album on a streaming platform
- Work status: link to the project, PR, or repository
- Event status: link to the event page

Multiple `r` tags are allowed if multiple URLs are relevant.

#### expiration Tag (NIP-40)

```
["expiration", "1700000000"]
```

Sets a Unix timestamp after which the status should be considered expired. Relays MAY discard events past their expiration time. Clients should not display expired statuses.

Use cases:
- Conference attendance: expires when the event ends
- Temporary availability: "Available for calls until 5pm"
- Streaming: expires when the stream ends

The expiration value is a string containing a Unix timestamp in seconds.

#### emoji Tags (NIP-30)

```
["emoji", "toon", "https://example.com/emoji/toon.png"]
```

Custom emoji shortcodes can be used in the content field (e.g., `:toon:`) with corresponding `emoji` tags providing the image URL. This follows the standard NIP-30 custom emoji format.

### Parameterized Replaceable Semantics

kind:30315 follows NIP-01 parameterized replaceable event rules:

1. **Replacement scope:** Events are replaced per `(pubkey, kind, d-tag-value)` tuple
2. **Independent slots:** `d=general` and `d=music` are separate -- updating one does not affect the other
3. **No history:** Relays discard the previous event when a replacement arrives
4. **Timestamp ordering:** If two events have the same `(pubkey, kind, d-tag)`, the one with the higher `created_at` wins

### Reading User Statuses

To fetch a user's statuses, use NIP-01 filters:

**All statuses for a user:**
```
{ "kinds": [30315], "authors": ["<pubkey-hex>"] }
```

**Specific status type:**
```
{ "kinds": [30315], "authors": ["<pubkey-hex>"], "#d": ["general"] }
```

**Statuses from multiple users:**
```
{ "kinds": [30315], "authors": ["<pubkey1>", "<pubkey2>", "<pubkey3>"] }
```

### Complete Event Examples

**General status with URL:**
```
{
  "kind": 30315,
  "content": "Building the future of decentralized payments",
  "tags": [
    ["d", "general"],
    ["r", "https://github.com/toon-protocol/town"]
  ]
}
```

**Music status with expiration:**
```
{
  "kind": 30315,
  "content": "Listening to Echoes - Pink Floyd",
  "tags": [
    ["d", "music"],
    ["r", "https://open.spotify.com/track/abc123"],
    ["expiration", "1700003600"]
  ]
}
```

**Clearing a status:**
```
{
  "kind": 30315,
  "content": "",
  "tags": [
    ["d", "general"]
  ]
}
```

**Custom status type with emoji:**
```
{
  "kind": 30315,
  "content": "Playing :chess: with friends",
  "tags": [
    ["d", "gaming"],
    ["emoji", "chess", "https://example.com/emoji/chess.png"]
  ]
}
```
