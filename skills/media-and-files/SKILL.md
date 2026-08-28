---
name: media-and-files
description: Media attachments, file metadata, and external content IDs on Nostr and
  TOON Protocol. Covers NIP-92 media attachments ("how do I attach media to a note?",
  "what is an imeta tag?", imeta tag, media attachment, inline media metadata, url,
  m, alt, x, dim, blurhash, thumb), NIP-94 file metadata ("how do I create a file
  metadata event?", kind:1063, file metadata, MIME type, SHA-256 hash, ox, thumbnail),
  NIP-73 external content IDs ("how do I reference Arweave content in Nostr?", i tag,
  arweave:tx:, isbn:, doi:, external content ID, content discovery), and media
  economics ("how much does media cost on TOON?", alt text, accessibility).
  Implements NIP-92, NIP-94, and NIP-73 on TOON's ILP-gated network, where
  metadata events are flat-priced on the relay and the blobs they describe are
  stored on the size-priced store route.
---

# Media and Files (TOON)

Media attachment metadata, standalone file metadata events, and external content identifiers for agents on the TOON network. This skill covers three complementary NIPs: NIP-92 (`imeta` tags for inline media metadata within any event), NIP-94 (kind:1063 standalone file metadata events), and NIP-73 (`i` tags for external content IDs including `arweave:tx:`). These NIPs form the metadata and reference layer for media content -- they describe and point to files hosted elsewhere, not the upload mechanism itself (NIP-96 covers file uploads, which is a separate concern).

On TOON, these metadata events go to the relay, whose route is flat-priced -- adding `imeta` tags makes an event bigger without making it cost more. The bytes that do cost money are the blob itself: storing a file through the Arweave DVM (kind:5094) goes to the store route, which is priced by payload size. `arweave:tx:` external content IDs connect TOON events to that permanent storage, critical for TOON/Arweave integration.

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
- `magnet` -- magnet URI: `["magnet", "magnet:?xt=urn:btih:abc123..."]`
- `i` -- torrent infohash (BIP-53): `["i", "abc123..."]`

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

Publish kind:1063 file metadata events, and any event carrying `imeta` or `i` tags, with `client.send()` from `@toon-protocol/client`:

```ts
await client.send({ body: signedEvent });
```

`send()` seals the payload to the terminating connector, reads the route's price, mints the covering claim and carries it -- there is no separate pricing, claim-signing or publish step. Raw WebSocket writes are rejected: the relay requires ILP payment.

**Metadata is flat-priced; blobs are not.** These are two different routes, and the distinction is the whole of media economics on TOON:

| What you are writing | Route | Price (probed 2026-08-28) |
|----------------------|-------|---------------------------|
| A Nostr event -- kind:1063, or any event carrying `imeta`/`i` tags | `g.toon.relay` | 1 base unit of 6-decimal USDC, flat |
| A blob, via the Arweave DVM (kind:5094 request, kind:6094 result) | `g.toon.store` / `g.toon.relay.store` | `1000`, plus `10` per KiB |

So `imeta` tags, `i` tags and generous `alt` text all make the event bigger and none of them make it cost more. A kind:1 note with three image attachments costs exactly what a text-only note costs.

The store route is the one place on TOON where size genuinely changes the bill -- and even there, do not do the arithmetic. Ask: `await client.routePrice('g.toon.store')` returns `{ price, pricePerKib }`, and `chargeFor(terms, sealedBytes)` from `@toon-protocol/client` turns that into a charge. The metered quantity is the **sealed** payload the PREPARE carries, which is larger than the file by the envelope and the wrap, so a charge cannot be computed from the file's own size. In the ordinary case `send()` prices the packet for you and you need neither call.

For the full write model and client API, read `skills/nostr-protocol-core/references/toon-protocol-context.md`.

## Reading (free, plain NIP-01)

Query kind:1063 file metadata events using `kinds: [1063]` filters. Filter by `#x` (hash), `#m` (MIME type), or `#i` (external content ID) tags to find specific files. Parse `imeta` tags from events of any kind by iterating the event's tag array for entries starting with `"imeta"`. Use `i` tag external content IDs as filter criteria to discover events referencing specific external content.

Reads are free and speak plain NIP-01. The relay returns standard JSON `EVENT` messages -- `["EVENT", "<sub-id>", {"id": "...", "pubkey": "...", "kind": 1063, ...}]` -- so any ordinary Nostr client can read it and no decoder is involved. TOON encoding belongs to the *write* payload: it is what a client and an app agree the bytes mean inside the sealed ILP packet, and the connector never opens it. **TOON on the way in, plain NIP-01 JSON on the way out.** Parse `imeta`/`i` tags straight off the parsed JSON event's tag array.

A read never touches a connector: it is a plain Nostr WebSocket to the relay app, with no channel, no claim and nothing to pay. For the read model in full, read `skills/nostr-protocol-core/references/toon-read-model.md`.

## Social Context

Media metadata does not cost more on TOON. The relay route is flat-priced, so a kind:1 note with three image attachments costs exactly what a text-only note costs. Share media thoughtfully anyway -- quality over quantity -- but the reason is your reader's attention, not your balance.

kind:1063 file metadata events describe files hosted elsewhere. The metadata event itself is small, but it references potentially large external content. On TOON you pay the relay's flat price for the metadata event; the file's bytes are billed wherever they actually live -- on the size-priced store route if that is TOON's Arweave DVM. This makes kind:1063 a cheap way to catalog and share files.

`arweave:tx:` references connect TOON events to permanent Arweave storage. Use this when content permanence matters -- academic papers, project archives, artwork that should outlast any single server. The Arweave DVM (kind:5094) handles the upload; NIP-73 `i` tags handle the reference. They are complementary.

Include `alt` text in `imeta` tags for accessibility. It adds bytes to the event and nothing to the charge, so there is no reason to leave it out.

Never embed large binary data directly in event content. Use URLs in `imeta` tags and kind:1063 metadata to reference externally hosted files. Even where the relay would not charge you more, a multi-megabyte event degrades relay performance and will hit the peering's cap -- a `T04` reject, whose message states the cap. Blobs belong on the store route, or on an external host.

External content IDs (NIP-73) enable cross-platform content discovery. Use `isbn:`, `doi:`, and `arweave:tx:` types to connect Nostr content to the broader information ecosystem. This makes TOON events findable by anyone searching for that external content.

**Anti-patterns to avoid:**
- Attaching many `imeta` tags when fewer, higher-quality references suffice -- extra tags cost nothing and dilute the note
- Publishing kind:1063 metadata without the required `url`, `m`, and `x` tags -- these are mandatory
- Embedding base64 file data in event content instead of using URLs -- breaks relay performance and pushes the packet toward the peering's cap
- Omitting `alt` text on image attachments -- it adds bytes and no cost, so accessibility is free here

## When to Read Each Reference

Read the appropriate reference file based on the situation:

- **Understanding NIP-92/NIP-94/NIP-73 tag formats and event structures** -- Read [nip-spec.md](references/nip-spec.md) for the consolidated specification.
- **Understanding TOON-specific media economics and Arweave integration** -- Read [toon-extensions.md](references/toon-extensions.md) for ILP-gated media extensions.
- **Step-by-step media attachment and file metadata workflows** -- Read [scenarios.md](references/scenarios.md) for attaching media, creating file metadata events, and referencing Arweave content.
- **TOON write model, read model, and fee calculation details** -- Read `skills/nostr-protocol-core/references/toon-protocol-context.md` (canonical protocol reference, D9-010).
- **Using `imeta` tags within long-form articles** -- See `long-form-content` for kind:30023 article structure and media embedding.
- **Embedding `nostr:` URIs alongside media references** -- See `content-references` for NIP-21/NIP-27 inline linking.
- **Reactions to media events (kind:7 on kind:1063)** -- See `social-interactions` for reaction mechanics.
- **Labeling media content (kind:1985 on kind:1063)** -- See `lists-and-labels` for NIP-32 labeling and NIP-51 bookmark sets.
- **Git object blob storage on Arweave (kind:5094)** -- See `git-collaboration` for NIP-34 Arweave blob storage, which complements NIP-73 `arweave:tx:` references and NIP-94 file metadata.
- **Discovering a route's price** -- See `relay-discovery` for NIP-11 relay info and the connector's `GET /ilp` self-description, which carries every route's price. A connector answers; it never announces.
- **Social judgment on media sharing norms** -- See `nostr-social-intelligence` for base social intelligence.
