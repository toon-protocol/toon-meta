# TOON Extensions for Media and Files

> **Why this reference exists:** NIP-92, NIP-94, and NIP-73 interact with TOON's ILP-gated economics in ways that shape how agents work with media. `imeta` tags increase event byte size and therefore cost. kind:1063 file metadata events are small but describe large external files. `arweave:tx:` external content IDs connect TOON events to permanent Arweave storage, bridging TOON's metadata layer with Arweave's permanence layer. This file covers the TOON-specific mechanics, fee implications, and Arweave integration details.

## Publishing Media Events on TOON

All media-related event publishing on TOON goes through `publishEvent()` from `@toon-protocol/client`. Raw WebSocket writes are rejected -- the relay requires ILP payment for every event.

### Publishing kind:1063 File Metadata Events

1. **Construct the kind:1063 event.** Set content to a file description/caption. Add required tags: `url` (file URL), `m` (MIME type), `x` (SHA-256 hex hash). Add optional tags as appropriate: `size`, `dim`, `alt`, `thumb`, etc.
2. **Sign the event** using your Nostr private key.
3. **Discover pricing.** Check the relay's `basePricePerByte` from kind:10032 peer info or the `/health` endpoint.
4. **Calculate fee.** `basePricePerByte * serializedEventBytes`. A kind:1063 event is typically 300-800 bytes.
5. **Sign a balance proof.** `client.signBalanceProof(channelId, amount)`
6. **Publish.** `client.publishEvent(signedEvent, { destination, claim })`

### Publishing Events with `imeta` Tags

1. **Construct the host event** (e.g., kind:1 note, kind:30023 article). Write content with media URLs.
2. **Add `imeta` tags.** One `imeta` tag per media URL in the content. Each `imeta` tag adds approximately 100-300 bytes to the event depending on how many fields are included.
3. **Sign the event** using your Nostr private key.
4. **Calculate fee.** The fee includes the base event plus all `imeta` tag overhead. A kind:1 note with one `imeta` tag is approximately 400-700 bytes.
5. **Sign a balance proof and publish** via `publishEvent()`.

### Publishing Events with `i` Tags (External Content IDs)

1. **Construct the event** (any kind). Add `i` tags referencing external content: `["i", "arweave:tx:<txid>"]`.
2. **Sign, calculate fee, and publish** via `publishEvent()`. Each `i` tag adds approximately 50-100 bytes.

### Error Handling

- **F04 (Insufficient Payment):** The calculated amount was too low. Recalculate with actual serialized size including all tags.
- **Relay rejection:** Check for missing required tags on kind:1063 (url, m, x are mandatory).

## Byte Costs for Media Events

### kind:1063 File Metadata Events

| Event Variant | Approximate Size | Cost at 10n/byte |
|--------------|-----------------|------------------|
| Minimal (url + m + x only) | ~300-400 bytes | ~$0.003-$0.004 |
| Standard (+ size + alt + summary) | ~500-650 bytes | ~$0.005-$0.007 |
| Full (all optional tags) | ~650-800 bytes | ~$0.007-$0.008 |

kind:1063 events are small because they describe external files -- the file itself is stored elsewhere. The metadata event contains only text tags, not binary data.

### `imeta` Tag Overhead

| Tag Completeness | Overhead per Tag | Cost per Tag at 10n/byte |
|-----------------|-----------------|--------------------------|
| Minimal (url + m) | ~80-120 bytes | ~$0.001-$0.001 |
| Standard (url + m + alt + x) | ~150-220 bytes | ~$0.002-$0.002 |
| Full (all fields) | ~250-300 bytes | ~$0.003-$0.003 |

Each `imeta` tag adds to the host event's byte size. Multiple `imeta` tags accumulate linearly. A kind:1 note with three full `imeta` tags adds approximately 750-900 bytes of tag overhead.

### `i` Tag Overhead

| Tag Variant | Overhead per Tag | Cost per Tag at 10n/byte |
|------------|-----------------|--------------------------|
| Short identifier (isbn) | ~40-60 bytes | ~$0.0004-$0.0006 |
| Medium identifier (arweave:tx:) | ~70-90 bytes | ~$0.0007-$0.0009 |
| With relay hint | ~100-130 bytes | ~$0.001-$0.001 |

`i` tags add minimal byte overhead. The `arweave:tx:` type includes a 43-character Arweave transaction ID, making it a medium-length tag.

### Composite Event Costs

| Event Type | Approximate Size | Cost at 10n/byte |
|-----------|-----------------|------------------|
| kind:1 note with 1 imeta tag | ~400-700 bytes | ~$0.004-$0.007 |
| kind:1 note with 3 imeta tags | ~700-1200 bytes | ~$0.007-$0.012 |
| kind:30023 article with 3 imeta tags | ~2000-8000 bytes | ~$0.02-$0.08 |
| kind:1063 with arweave:tx: i tag | ~400-900 bytes | ~$0.004-$0.009 |

## Arweave Integration: The Upload-Reference Pattern

TOON's Arweave integration follows a two-step pattern: **upload** via the Arweave DVM (kind:5094), then **reference** via NIP-73/NIP-94 metadata.

### Step 1: Upload to Arweave (Epic 8)

The Arweave DVM (kind:5094 from Epic 8) handles file uploads to Arweave:

1. Submit a kind:5094 DVM request with file data
2. DVM provider uploads the file to Arweave
3. DVM result includes the Arweave transaction ID

This step is handled by the DVM compute marketplace. See `packages/core/src/events/arweave-storage.ts` for the kind:5094 builder/parser.

### Step 2: Reference in Metadata (This Skill)

After uploading, reference the Arweave-stored content in NIP-73/NIP-94 metadata:

**Option A: kind:1063 file metadata with Arweave URL and `i` tag:**
```json
{
  "kind": 1063,
  "content": "Research paper on decentralized protocols, permanently stored on Arweave.",
  "tags": [
    ["url", "https://arweave.net/<txid>"],
    ["m", "application/pdf"],
    ["x", "<sha256-of-file>"],
    ["i", "arweave:tx:<txid>"],
    ["size", "2097152"],
    ["alt", "PDF: Decentralized Protocols Survey"]
  ]
}
```

**Option B: `i` tag on any event referencing Arweave content:**
```json
{
  "kind": 1,
  "content": "Just published my research paper on Arweave for permanence.",
  "tags": [
    ["i", "arweave:tx:<txid>"]
  ]
}
```

### Why This Pattern Matters

- **Separation of concerns:** The DVM handles upload logistics; NIP-73/NIP-94 handle discovery and metadata.
- **Permanence guarantee:** `arweave:tx:` IDs point to immutable, permanent content. The referenced data cannot be altered or deleted.
- **Cost efficiency:** On TOON, you pay for the small metadata event (300-800 bytes), not the potentially large file. The Arweave upload cost is handled separately by the DVM.
- **Cross-platform discovery:** Anyone can search for `#i: ["arweave:tx:<txid>"]` to find all Nostr events referencing that Arweave content.

## TOON-Format Parsing for Media Events

TOON relays return TOON-format strings in EVENT messages, not standard JSON objects. To read media events:

1. **Decode the TOON-format response** using the TOON decoder to extract event fields.
2. **For kind:1063 events,** extract the content field (file description), then parse individual tags for url, m, x, and optional metadata.
3. **For events with `imeta` tags,** iterate the tag array looking for entries where the first element is `"imeta"`. Parse each subsequent element as a space-separated key-value pair.
4. **For events with `i` tags,** iterate the tag array looking for entries where the first element is `"i"`. Parse the second element as `<type>:<identifier>`.

Reading media events is free on TOON -- no ILP payment required for subscriptions.

## Integration with Protocol Core

For the complete TOON write model, read model, and fee calculation details, refer to `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`. This file covers media-specific extensions; the protocol core covers foundational mechanics shared by all event kinds.
