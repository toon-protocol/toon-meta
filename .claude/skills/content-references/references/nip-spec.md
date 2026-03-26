# NIP Specifications: Content References

> **Why this reference exists:** Agents need precise URI formats and tag correspondence rules to construct valid content references. This file covers the nostr: URI scheme (NIP-21), text note references (NIP-27), and the underlying NIP-19 bech32 encoding. Understanding these structures prevents malformed references that waste ILP payment on events with broken or unresolvable links.

## NIP-21: nostr: URI Scheme

The `nostr:` URI scheme provides a standardized way to reference Nostr entities. Format: `nostr:<bech32-entity>` where the bech32 entity is encoded per NIP-19.

### Simple Bech32 Entities

These use standard bech32 encoding of a single 32-byte value:

| Prefix | Entity | Encoded Data | Byte Size |
|--------|--------|-------------|-----------|
| `npub1` | Public key | 32-byte hex pubkey | 63 chars bech32 |
| `note1` | Event ID | 32-byte hex event ID | 63 chars bech32 |

**npub1 example:** `nostr:npub1` followed by ~58 characters of bech32-encoded pubkey data (~63 characters total including the `npub1` prefix). Decodes to a 32-byte hex public key that can be used in `p` tags and subscription filters.

**note1 example:** `nostr:note1` followed by ~58 characters of bech32-encoded event ID data (~63 characters total including the `note1` prefix). Decodes to a 32-byte hex event ID that can be used in `e` tags and subscription filters.

### TLV Bech32 Entities

These use TLV (Type-Length-Value) encoding to pack multiple data fields:

| Prefix | Entity | Contains | Typical Size |
|--------|--------|----------|-------------|
| `nprofile1` | Profile | Pubkey + relay hints | 80-120 chars |
| `nevent1` | Event | Event ID + relay hints + author + kind | 80-140 chars |
| `naddr1` | Replaceable event | Kind + pubkey + d-tag + relay hints | 80-150 chars |

### TLV Type Definitions

| Type | Name | Used In | Description |
|------|------|---------|-------------|
| 0 | Special | All TLV entities | Primary data: pubkey (nprofile), event ID (nevent), d-tag identifier (naddr) |
| 1 | Relay | All TLV entities | Relay URL hint (can appear multiple times for multiple relays) |
| 2 | Author | nevent, naddr | Author's 32-byte hex pubkey |
| 3 | Kind | nevent, naddr | Event kind as 32-bit unsigned integer, big-endian encoded |

### nprofile1 Structure

```
TLV data:
  Type 0 (special): 32-byte pubkey
  Type 1 (relay): "wss://relay.example.com" (repeatable)
```

Use `nprofile1` instead of `npub1` when you know which relays serve the referenced profile. The relay hints enable cross-relay resolution.

### nevent1 Structure

```
TLV data:
  Type 0 (special): 32-byte event ID
  Type 1 (relay): "wss://relay.example.com" (repeatable)
  Type 2 (author): 32-byte pubkey (optional, aids verification)
  Type 3 (kind): 4-byte big-endian kind number (optional, aids filtering)
```

Use `nevent1` instead of `note1` when you want to include relay hints, author information, or the event kind for richer context.

### naddr1 Structure

```
TLV data:
  Type 0 (special): UTF-8 d-tag identifier string
  Type 1 (relay): "wss://relay.example.com" (repeatable)
  Type 2 (author): 32-byte pubkey (required for naddr)
  Type 3 (kind): 4-byte big-endian kind number (required for naddr)
```

Use `naddr1` to reference parameterized replaceable events (kind:30023 articles, kind:30000+ lists). Because replaceable events are identified by kind + pubkey + d-tag (not event ID), `naddr1` always resolves to the latest version.

## NIP-27: Text Note References

NIP-27 defines how `nostr:` URIs appear inline within event content and how clients render them.

### Inline Mention Rendering

| URI Pattern | Client Rendering |
|-------------|-----------------|
| `nostr:npub1...` | Clickable profile name link |
| `nostr:nprofile1...` | Clickable profile name link (with relay context) |
| `nostr:note1...` | Embedded note preview |
| `nostr:nevent1...` | Embedded note preview (with relay context) |
| `nostr:naddr1...` | Link to the parameterized replaceable event |

### Tag Correspondence Rules

Each inline `nostr:` mention must be accompanied by a corresponding tag in the event's tags array. This enables machine-readable indexing and notification routing.

| Inline URI | Required Tag | Tag Format |
|-----------|-------------|-----------|
| `nostr:npub1<data>` | `p` tag | `["p", "<hex-pubkey>"]` |
| `nostr:nprofile1<data>` | `p` tag | `["p", "<hex-pubkey>"]` |
| `nostr:note1<data>` | `e` tag | `["e", "<hex-event-id>"]` |
| `nostr:nevent1<data>` | `e` tag | `["e", "<hex-event-id>"]` |
| `nostr:naddr1<data>` | `a` tag | `["a", "<kind>:<pubkey>:<d-tag>"]` |

**Why both are needed:** Tags provide structured metadata for relay indexing, notification delivery, and programmatic access. Inline URIs provide human-readable placement context within the content flow. An event with tags but no inline URIs loses the contextual placement. An event with inline URIs but no tags loses machine-readable indexing.

### Markdown Compatibility

In long-form content (kind:30023), `nostr:` URIs can appear within markdown text naturally. Clients that render markdown will detect and linkify `nostr:` URIs within the rendered output. Example in a markdown article:

```
As nostr:npub1abc... discussed in their article nostr:naddr1xyz...,
the implications of paid content linking are significant.
```

The `nostr:` URIs are treated as inline elements within the markdown flow, similar to bare URLs in markdown.

### Multiple References in a Single Event

An event can contain multiple `nostr:` URIs. Each URI must have its own corresponding tag. Example: a note mentioning two users and referencing one article would have two `p` tags and one `a` tag, plus the three inline `nostr:` URIs in content.

## URI Parsing and Resolution

### Parsing nostr: URIs from Content

To extract references from event content:
1. Scan the content string for occurrences of `nostr:` followed by bech32 data
2. The bech32 portion starts after `nostr:` and continues until a non-bech32 character (whitespace, punctuation other than the bech32 charset)
3. Decode the bech32 prefix to determine the entity type (npub1, note1, nprofile1, nevent1, naddr1)
4. Decode the bech32 data per NIP-19 to extract the underlying values

### Resolving References

- **npub1 / nprofile1:** Fetch the referenced profile (kind:0) by pubkey. Use relay hints from nprofile1 if available.
- **note1 / nevent1:** Fetch the referenced event by ID. Use relay hints from nevent1 if available.
- **naddr1:** Fetch the referenced parameterized replaceable event by kind + pubkey + d-tag. Use relay hints if available. Always resolves to the latest version.
