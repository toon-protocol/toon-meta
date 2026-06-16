# NIP Specifications: Identity Events

> **Why this reference exists:** Agents need precise event structures to construct valid identity events. This file covers the wire format for kind:0 (profile metadata), kind:3 (follow list), NIP-05 DNS verification, NIP-24 extra metadata fields, and NIP-39 external identity tags. Understanding these structures prevents malformed events that waste ILP payment on rejected publishes.

## kind:0 -- Profile Metadata (NIP-01 + NIP-24 + NIP-39)

kind:0 is a **replaceable event** (per NIP-01). Only the most recent kind:0 from a given pubkey is retained by relays. Publishing a new kind:0 replaces the previous one entirely.

### Event Structure

```
{
  "kind": 0,
  "content": "{\"name\":\"alice\",\"about\":\"...\",\"picture\":\"https://...\",\"nip05\":\"alice@example.com\",\"display_name\":\"Alice\",\"website\":\"https://example.com\",\"banner\":\"https://...\",\"lud16\":\"alice@getalby.com\",\"bot\":false}",
  "tags": [
    ["i", "github:alice", "https://gist.github.com/alice/proof123"],
    ["i", "twitter:alice_tweets", "https://twitter.com/alice_tweets/status/123"]
  ]
}
```

### Content Fields (JSON string)

| Field | Source | Required | Description |
|-------|--------|----------|-------------|
| `name` | NIP-01 | No | Username / handle |
| `about` | NIP-01 | No | Free-form bio text |
| `picture` | NIP-01 | No | Avatar URL |
| `nip05` | NIP-05 | No | DNS identifier (`user@domain`) |
| `display_name` | NIP-24 | No | Display name (can differ from `name`) |
| `website` | NIP-24 | No | Personal website URL |
| `banner` | NIP-24 | No | Banner image URL |
| `lud16` | Community convention | No | Lightning address (on vanilla Nostr; less relevant on TOON where ILP replaces Lightning) |
| `bot` | NIP-24 | No | Boolean flag indicating automated account |

All fields are optional. The `content` field is a JSON-serialized string, not a JSON object at the event level.

### Replaceable Event Semantics

When a relay receives a kind:0 event, it replaces any existing kind:0 from the same pubkey. This means:
- Only the latest profile matters on the network
- Partial updates are not possible -- always include all desired fields
- Historical profile versions are discarded by compliant relays

## kind:3 -- Follow List / Contacts (NIP-02)

kind:3 is a **replaceable event** listing the pubkeys a user follows. The entire follow list is replaced on each update.

### Event Structure

```
{
  "kind": 3,
  "content": "",
  "tags": [
    ["p", "<pubkey-hex>", "<recommended-relay-url>", "<petname>"],
    ["p", "<pubkey-hex>", "wss://relay.example.com", "bob"],
    ["p", "<pubkey-hex>"]
  ]
}
```

### Tag Format

Each `p` tag represents one followed pubkey:
- **Position 1:** 32-byte hex pubkey (required)
- **Position 2:** Recommended relay URL for that pubkey (optional, can be empty string)
- **Position 3:** Petname / local alias (optional)

The `content` field is typically empty for kind:3. Some clients historically stored relay list JSON in content, but this is deprecated in favor of NIP-65 (kind:10002).

### Follow List Semantics

- The list is **complete** -- every followed pubkey must be in the latest kind:3
- Adding a follow means publishing a new kind:3 with all existing follows plus the new one
- Removing a follow means publishing a new kind:3 with all existing follows minus the removed one
- The follow list is **public** -- anyone can read your kind:3 to see who you follow

## NIP-05 -- DNS-Based Verification

NIP-05 maps human-readable identifiers (`user@domain`) to Nostr pubkeys using DNS and HTTPS.

### Verification Flow

1. User sets `nip05` field in their kind:0 profile to `alice@example.com`
2. Verifier fetches `https://example.com/.well-known/nostr.json?name=alice`
3. Response must be JSON:

```
{
  "names": {
    "alice": "<pubkey-hex>"
  },
  "relays": {
    "<pubkey-hex>": ["wss://relay1.example.com", "wss://relay2.example.com"]
  }
}
```

4. Verifier confirms that `names.alice` matches the pubkey from the kind:0 event
5. Optional `relays` object provides relay hints for that pubkey

### Key Properties

- **Domain-based:** Verification proves control of the domain, not identity
- **Client-side verification:** Relays do not verify NIP-05 claims; clients fetch and check
- **No event kind:** NIP-05 does not define a new event kind -- it augments kind:0's `nip05` field
- **CORS required:** The well-known URL must serve appropriate CORS headers for browser clients
- **Case-insensitive:** The `name` query parameter should be lowercased before lookup

## NIP-39 -- External Identities

NIP-39 allows claiming external platform identities by adding `i` tags to kind:0 events.

### Tag Format

```
["i", "<platform>:<identity>", "<proof>"]
```

- **platform:** Service identifier (e.g., `github`, `twitter`, `mastodon`, `telegram`)
- **identity:** Username or identifier on that platform
- **proof:** URL to a publicly accessible proof linking the platform identity to the Nostr pubkey

### Common Platforms

| Platform | Identity Format | Proof Format |
|----------|----------------|--------------|
| `github` | GitHub username | URL to a gist containing the pubkey |
| `twitter` | Twitter handle | URL to a tweet containing the pubkey |
| `mastodon` | `user@instance` | URL to a toot containing the pubkey |
| `telegram` | Telegram username | URL to proof message |

### Verification Pattern

1. Read the `i` tags from a user's kind:0 event
2. For each claim, fetch the proof URL
3. Verify the proof content contains the expected Nostr pubkey
4. The relay does NOT perform this verification -- it is the verifier's responsibility

### Trust Implications

External identity claims are **self-asserted**. Anyone can add `["i", "github:torvalds", "https://fake-proof.com"]` to their profile. The value comes from the proof URL being publicly verifiable. Multiple independently verifiable external links provide stronger identity evidence than any single claim.
