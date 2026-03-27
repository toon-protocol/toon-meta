# NIP Specification: Media Attachments (NIP-92), File Metadata (NIP-94), External Content IDs (NIP-73)

> **Why this reference exists:** This skill covers three complementary NIPs that form the metadata and reference layer for media content on Nostr. NIP-92 defines `imeta` tags for embedding media metadata within any event. NIP-94 defines kind:1063 standalone file metadata events. NIP-73 defines `i` tags for referencing external content by type-prefixed identifiers. Agents need to understand how these three protocols work together: `imeta` augments events with media details, kind:1063 catalogs files as standalone events, and `i` tags connect Nostr content to external platforms. TOON-specific extensions are covered in toon-extensions.md.

## NIP-92: Media Attachments (`imeta` Tags)

### Overview

NIP-92 defines the `imeta` tag for embedding structured media metadata within any Nostr event. Unlike kind:1063 (which is a standalone event), `imeta` tags are added to existing event kinds (kind:1 notes, kind:30023 articles, kind:42 chat messages, etc.) to describe media URLs referenced in the event content.

### Tag Structure

The `imeta` tag is a standard Nostr tag array where each element after the tag name is a space-separated key-value string:

```
["imeta",
  "url https://example.com/image.jpg",
  "m image/jpeg",
  "alt A photograph of a sunset over the ocean",
  "x 3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b",
  "size 245760",
  "dim 1920x1080",
  "blurhash LGF5]+Yk^6#M@-5c",
  "thumb https://example.com/thumb/image.jpg",
  "fallback https://cdn2.example.com/image.jpg"
]
```

### Field Definitions

| Field | Description | Required | Example |
|-------|-------------|----------|---------|
| `url` | The media URL | Required in practice | `url https://example.com/photo.jpg` |
| `m` | MIME type | Recommended | `m image/jpeg` |
| `alt` | Accessibility description | Recommended | `alt A cat sitting on a keyboard` |
| `x` | SHA-256 hex hash of the file | Recommended | `x 3b4c5d...` (64 hex chars) |
| `size` | File size in bytes | Optional | `size 245760` |
| `dim` | Dimensions as WxH | Optional (images/video) | `dim 1920x1080` |
| `blurhash` | Compact blur hash placeholder | Optional (images) | `blurhash LGF5]+Yk^6#M@-5c` |
| `thumb` | Thumbnail URL | Optional | `thumb https://example.com/thumb.jpg` |
| `fallback` | Alternative URL if primary fails | Optional | `fallback https://cdn2.example.com/photo.jpg` |

### Multiple `imeta` Tags

An event can contain multiple `imeta` tags -- one per media URL referenced in the event content. Each `imeta` tag is independent and describes a single media attachment.

**Example: A note with two images:**
```json
{
  "kind": 1,
  "content": "Check out these photos from the meetup! https://example.com/photo1.jpg https://example.com/photo2.jpg",
  "tags": [
    ["imeta", "url https://example.com/photo1.jpg", "m image/jpeg", "alt Group photo at the meetup", "x abc123...", "dim 1920x1080"],
    ["imeta", "url https://example.com/photo2.jpg", "m image/jpeg", "alt Speaker presenting on stage", "x def456...", "dim 1600x900"]
  ]
}
```

### Which Events Use `imeta`

`imeta` tags can augment any event kind that references media URLs in its content:
- **kind:1 (short notes):** Photos, screenshots, diagrams in notes
- **kind:30023 (long-form articles):** Illustrations, charts, header images in articles
- **kind:42 (chat messages):** Media shared in chat channels
- **Any other content event:** `imeta` is a general-purpose media metadata tag

### Relationship to NIP-94

NIP-92 `imeta` tags describe media **within** another event. NIP-94 kind:1063 describes a file **as** a standalone event. They serve different purposes:
- Use `imeta` when attaching media to a note, article, or message
- Use kind:1063 when cataloging or announcing a file as a standalone piece of content

## NIP-94: File Metadata (kind:1063)

### Overview

NIP-94 defines kind:1063 as a standalone file metadata event. The event describes a file hosted elsewhere (HTTP server, Arweave, IPFS, etc.) with structured metadata tags. The content field contains the file description or caption.

### Event Structure

kind:1063 is a **regular event** (not replaceable). Each kind:1063 event describes one file.

```json
{
  "kind": 1063,
  "content": "Quarterly revenue report for Q4 2025, showing 40% growth in subscription revenue.",
  "tags": [
    ["url", "https://files.example.com/reports/q4-2025.pdf"],
    ["m", "application/pdf"],
    ["x", "7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b"],
    ["size", "1048576"],
    ["summary", "Q4 2025 revenue report"],
    ["alt", "PDF document containing quarterly revenue data and growth charts"]
  ]
}
```

### Required Tags

These three tags are mandatory for kind:1063 events:

| Tag | Description | Example |
|-----|-------------|---------|
| `url` | File URL (where the file is hosted) | `["url", "https://example.com/file.pdf"]` |
| `m` | MIME type | `["m", "application/pdf"]` |
| `x` | SHA-256 hex hash of the file | `["x", "7a8b9c0d..."]` |

### Optional Tags

| Tag | Description | Example |
|-----|-------------|---------|
| `ox` | Original SHA-256 before server transforms | `["ox", "1a2b3c4d..."]` |
| `size` | File size in bytes | `["size", "1048576"]` |
| `dim` | Dimensions WxH (images/video) | `["dim", "1920x1080"]` |
| `blurhash` | Compact blur hash placeholder | `["blurhash", "LGF5]+Yk^6#M@-5c"]` |
| `thumb` | Thumbnail URL | `["thumb", "https://example.com/thumb.jpg"]` |
| `image` | Preview image URL | `["image", "https://example.com/preview.jpg"]` |
| `summary` | Brief file summary | `["summary", "Quarterly report"]` |
| `alt` | Accessibility text | `["alt", "Chart showing revenue growth"]` |

### Content Field

The content field of a kind:1063 event is a **free-text description or caption** for the file. It is not JSON -- it is human-readable text explaining what the file is about. Keep it descriptive but concise.

### The `ox` Tag (Original Hash)

The `ox` tag records the file's original SHA-256 hash before any server-side transformations (compression, resizing, format conversion). This allows verification against the original file even if the server modified it. The `x` tag should contain the hash of the file as served from the URL.

### Querying kind:1063 Events

- **All file metadata:** Filter `kinds: [1063]`
- **By MIME type:** Filter `kinds: [1063]` with `#m: ["image/jpeg"]`
- **By hash:** Filter `kinds: [1063]` with `#x: ["abc123..."]`
- **By author:** Filter `kinds: [1063]` with `authors: ["<pubkey>"]`

## NIP-73: External Content IDs (`i` Tags)

### Overview

NIP-73 defines the `i` tag for referencing external content by type-prefixed identifier. This enables cross-platform content discovery -- a Nostr event can reference a book (ISBN), academic paper (DOI), Arweave transaction, or any external identifier.

### Tag Format

```
["i", "<type>:<identifier>"]
["i", "<type>:<identifier>", "<relay-url>"]
```

The optional third element is a relay URL hint for discovering related events.

### Supported Types

| Type Prefix | Description | Example |
|-------------|-------------|---------|
| `arweave:tx:<txid>` | Arweave transaction | `["i", "arweave:tx:bNBsl1C_QXyT9V0riR..."]` |
| `isbn:<isbn>` | Book identifier | `["i", "isbn:9780140449136"]` |
| `doi:<doi>` | Digital Object Identifier | `["i", "doi:10.1038/nature12373"]` |
| `magnet:<hash>` | Magnet link hash | `["i", "magnet:xt=urn:btih:abc123..."]` |
| `url:<url>` | Generic URL reference | `["i", "url:https://example.com/resource"]` |

### `arweave:tx:` for TOON Integration

The `arweave:tx:` type is critical for TOON's Arweave integration:

1. **Upload content to Arweave** via the Arweave DVM (kind:5094 request/response from Epic 8)
2. **Receive the Arweave transaction ID** in the DVM result
3. **Reference the content** in subsequent events using `["i", "arweave:tx:<txid>"]`

This creates a permanent, immutable reference. Arweave transactions are content-addressed and permanent -- the referenced data cannot be altered or removed.

**Example: A kind:1063 file metadata event referencing an Arweave-hosted file:**
```json
{
  "kind": 1063,
  "content": "Research paper on decentralized identity protocols, permanently stored on Arweave.",
  "tags": [
    ["url", "https://arweave.net/bNBsl1C_QXyT9V0riR..."],
    ["m", "application/pdf"],
    ["x", "abc123def456..."],
    ["i", "arweave:tx:bNBsl1C_QXyT9V0riR..."],
    ["size", "2097152"],
    ["alt", "PDF: Decentralized Identity Protocols Survey"]
  ]
}
```

### Cross-Platform Content Discovery

External content IDs enable rich cross-referencing:
- **Book reviews:** Attach `["i", "isbn:9780140449136"]` to a kind:1 review note. Anyone searching for that ISBN can discover your review.
- **Academic discussions:** Attach `["i", "doi:10.1038/nature12373"]` to a note discussing a paper. Researchers can find all Nostr discussion of that paper.
- **Arweave-stored content:** Attach `["i", "arweave:tx:<txid>"]` to reference permanently stored data. Any event referencing the same Arweave TX is discoverable.

### Querying by External Content ID

Filter events by `i` tag: `#i: ["arweave:tx:<txid>"]` to discover all events referencing a specific external content identifier.

## Event Kind and Tag Summary

| Kind/Tag | Name | Type | Key Use |
|----------|------|------|---------|
| `imeta` tag | Media Attachment | Tag (NIP-92) | Inline media metadata within any event kind |
| kind:1063 | File Metadata | Regular event (NIP-94) | Standalone file description/catalog entry |
| `i` tag | External Content ID | Tag (NIP-73) | Cross-platform content reference |

These three mechanisms are complementary:
- `imeta` **augments** existing events with media metadata
- kind:1063 **describes** files as standalone events
- `i` tags **connect** Nostr events to external content identifiers

A single event can use all three: a kind:1063 event with `imeta` tags for thumbnails and an `i` tag with an `arweave:tx:` reference.
