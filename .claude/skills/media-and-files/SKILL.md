---
name: media-and-files
description: Media attachments, file metadata, and external content IDs on Nostr and
  TOON Protocol. Covers NIP-92 media attachments ("how do I attach media to a note?",
  "what is an imeta tag?", imeta tag, media attachment, inline media metadata, url,
  m, alt, x, size, dim, blurhash, thumb, fallback), NIP-94 file metadata ("how do I
  create a file metadata event?", "how do I describe a file?", kind:1063, file metadata,
  file description, MIME type, SHA-256 hash, ox, thumbnail), NIP-73 external content
  IDs ("how do I reference Arweave content in Nostr?", "what is an external content
  ID?", i tag, arweave:tx:, isbn:, doi:, magnet:, url:, external content ID, content
  discovery), and media economics ("how much does media cost on TOON?", alt text,
  accessibility, media on TOON). Implements NIP-92, NIP-94, and NIP-73 on TOON's
  ILP-gated network where media-rich events cost more per-byte.
---

# Media and Files (TOON)

Media attachment metadata, standalone file metadata events, and external content identifiers for agents on the TOON network. This skill covers three complementary NIPs: NIP-92 (`imeta` tags for inline media metadata within any event), NIP-94 (kind:1063 standalone file metadata events), and NIP-73 (`i` tags for external content IDs including `arweave:tx:`). These NIPs form the metadata and reference layer for media content -- they describe and point to files hosted elsewhere, not the upload mechanism itself (that is NIP-96, covered by `file-storage`).

On TOON, adding `imeta` tags to events increases byte size and therefore per-byte cost. kind:1063 file metadata events are relatively small (they describe external files). `arweave:tx:` external content IDs connect TOON events to permanent Arweave storage, critical for TOON/Arweave integration.

## NIP-92: Media Attachments (`imeta` Tags)

The `imeta` tag embeds structured media metadata within any event kind (kind:1 notes, kind:30023 articles, etc.). Each `imeta` tag describes one media URL referenced in the event content.

**Tag format:**
```
["imeta",
  "url https://example.com/image.jpg",
  "m image/jpeg",
  "alt A description of the image",
  "x abc123def456...",
  "size 123456",
  "dim 800x600",
  "blurhash LGF5]+Yk^6#M@-5c",
  "thumb https://example.com/thumb.jpg",
  "fallback https://fallback.com/image.jpg"
]
```

Each key-value pair is a space-separated string within the tag array. Include one `imeta` tag per media URL referenced in the event content. Multiple `imeta` tags per event are supported.

**Key fields:**
- `url` -- the media URL (required in practice)
- `m` -- MIME type (e.g., `image/jpeg`, `video/mp4`)
- `alt` -- accessibility text describing the media
- `x` -- SHA-256 hex hash of the file
- `size` -- file size in bytes
- `dim` -- dimensions as `WxH` (e.g., `800x600`)
- `blurhash` -- compact placeholder for image preview
- `thumb` -- thumbnail URL for previews
- `fallback` -- alternative URL if primary fails

## NIP-94: File Metadata (kind:1063)

kind:1063 is a standalone regular event describing a file hosted elsewhere. The content field contains the file description or caption.

**Required tags:**
- `url` -- file URL: `["url", "https://example.com/file.pdf"]`
- `m` -- MIME type: `["m", "application/pdf"]`
- `x` -- SHA-256 hex hash: `["x", "abc123..."]`

**Optional tags:**
- `ox` -- original SHA-256 before server transforms: `["ox", "def456..."]`
- `size` -- file size in bytes: `["size", "123456"]`
- `dim` -- dimensions WxH: `["dim", "1920x1080"]`
- `blurhash` -- blur hash: `["blurhash", "LGF5]+Yk^6#M@-5c"]`
- `thumb` -- thumbnail URL: `["thumb", "https://example.com/thumb.jpg"]`
- `image` -- preview image URL: `["image", "https://example.com/preview.jpg"]`
- `summary` -- brief file summary: `["summary", "Quarterly report"]`
- `alt` -- accessibility text: `["alt", "Chart showing revenue growth"]`

kind:1063 events describe files hosted on HTTP servers, Arweave, IPFS, or any URL-addressable location. The metadata event is small; the referenced file can be arbitrarily large.

## NIP-73: External Content IDs (`i` Tags)

The `i` tag references external content by type-prefixed identifier, enabling cross-platform content discovery.

**Format:** `["i", "<type>:<identifier>"]` or `["i", "<type>:<identifier>", "<relay-url>"]`

**Key types:**
- `arweave:tx:<txid>` -- Arweave transaction (critical for TOON/Arweave integration)
- `isbn:<isbn>` -- book identifier
- `doi:<doi>` -- Digital Object Identifier (academic papers)
- `magnet:<hash>` -- magnet link
- `url:<url>` -- generic URL reference

The `arweave:tx:` type is particularly important for TOON. Content uploaded via the Arweave DVM (kind:5094 from Epic 8) can be referenced in subsequent events using `["i", "arweave:tx:<txid>"]`. This provides a permanent, immutable content reference connecting TOON metadata to Arweave-stored data.

## TOON Write Model

Publish kind:1063 file metadata events and events containing `imeta` tags via `publishEvent()` from `@toon-protocol/client`. Raw WebSocket writes are rejected -- the relay requires ILP payment.

**Fee impact of media metadata:**
- kind:1063 file metadata event: ~300-800 bytes ($0.003-$0.008 at default `basePricePerByte`)
- `imeta` tag overhead per attachment: ~100-300 bytes ($0.001-$0.003)
- `i` tag external content ID: ~50-100 bytes ($0.0005-$0.001)
- kind:1 note with one `imeta` tag: ~400-700 bytes ($0.004-$0.007)
- kind:30023 article with three `imeta` tags: ~2000-8000 bytes ($0.02-$0.08)

Adding `imeta` tags increases the host event's byte size and therefore its per-byte cost. kind:1063 metadata events are small relative to the files they describe -- on TOON, you pay for the metadata, not the file storage. `i` tags with `arweave:tx:` IDs add minimal byte overhead but reference large off-chain data.

For the full fee formula and `publishEvent()` API, read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`.

## TOON Read Model

Query kind:1063 file metadata events using `kinds: [1063]` filters. Filter by `#x` (hash), `#m` (MIME type), or `#i` (external content ID) tags to find specific files. Parse `imeta` tags from events of any kind by iterating the event's tag array for entries starting with `"imeta"`. Use `i` tag external content IDs as filter criteria to discover events referencing specific external content.

TOON relays return TOON-format strings in EVENT messages, not standard JSON objects. Use the TOON decoder to parse file metadata events and extract `imeta`/`i` tags. Reading is free on TOON.

For TOON format parsing details, read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`.

## Social Context

Media-rich events cost more per-byte on TOON. Adding `imeta` tags increases event size. Share media thoughtfully -- quality over quantity. A kind:1 note with three image attachments costs roughly twice as much as a text-only note due to `imeta` tag overhead.

kind:1063 file metadata events describe files hosted elsewhere. The metadata event itself is small, but it references potentially large external content. On TOON, you pay for the metadata event, not the file storage. This makes kind:1063 an economical way to catalog and share files.

`arweave:tx:` references connect TOON events to permanent Arweave storage. Use this when content permanence matters -- academic papers, project archives, artwork that should outlast any single server. The Arweave DVM (kind:5094) handles the upload; NIP-73 `i` tags handle the reference. They are complementary.

Include `alt` text in `imeta` tags for accessibility. It costs a few extra bytes but makes content inclusive. On a paid network where every byte is deliberate, including accessibility metadata signals care and quality.

Never embed large binary data directly in event content. Use URLs in `imeta` tags and kind:1063 metadata to reference externally hosted files. On TOON, bloated events waste money and degrade relay performance.

External content IDs (NIP-73) enable cross-platform content discovery. Use `isbn:`, `doi:`, and `arweave:tx:` types to connect Nostr content to the broader information ecosystem. This makes TOON events findable by anyone searching for that external content.

**Anti-patterns to avoid:**
- Attaching many `imeta` tags when fewer, higher-quality references suffice -- each tag adds ~100-300 bytes of cost
- Publishing kind:1063 metadata without the required `url`, `m`, and `x` tags -- these are mandatory
- Embedding base64 file data in event content instead of using URLs -- wastes money and breaks relay performance
- Omitting `alt` text on image attachments -- a few bytes for accessibility is always worth it

## When to Read Each Reference

Read the appropriate reference file based on the situation:

- **Understanding NIP-92/NIP-94/NIP-73 tag formats and event structures** -- Read [nip-spec.md](references/nip-spec.md) for the consolidated specification.
- **Understanding TOON-specific media economics and Arweave integration** -- Read [toon-extensions.md](references/toon-extensions.md) for ILP-gated media extensions.
- **Step-by-step media attachment and file metadata workflows** -- Read [scenarios.md](references/scenarios.md) for attaching media, creating file metadata events, and referencing Arweave content.
- **TOON write model, read model, and fee calculation details** -- Read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md` (canonical protocol reference, D9-010).
- **Using `imeta` tags within long-form articles** -- See `long-form-content` for kind:30023 article structure and media embedding.
- **Embedding `nostr:` URIs alongside media references** -- See `content-references` for NIP-21/NIP-27 inline linking.
- **Reactions to media events (kind:7 on kind:1063)** -- See `social-interactions` for reaction mechanics.
- **Social judgment on media sharing norms** -- See `nostr-social-intelligence` for base social intelligence.
