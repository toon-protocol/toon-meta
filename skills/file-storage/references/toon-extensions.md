# TOON Extensions for File Storage

> **Why this reference exists:** NIP-96 file storage interacts with TOON's ILP-gated economics in a unique way: the upload itself is off-chain HTTP (free), but publishing the resulting kind:1063 metadata event on TOON costs per-byte. This creates a split-cost model absent from free Nostr relays. This file covers the TOON-specific mechanics, the off-chain/on-chain boundary, and the economic implications for file sharing on a paid network.

## The Split-Cost Model

NIP-96 file storage on TOON has a distinctive economic structure:

1. **File upload: FREE (off-chain HTTP).** The multipart POST to the NIP-96 server is a direct HTTP request between the client and the file storage server. No TOON relay, no ILP payment, no `publishEvent()`. The file storage server may have its own pricing (paid plans), but that is independent of TOON.

2. **Metadata event: PAID (on-chain ILP).** Publishing the kind:1063 file metadata event on the TOON relay requires ILP payment via `publishEvent()` from `@toon-protocol/client`. This is a standard TOON write operation.

This split means: you can upload arbitrarily large files to NIP-96 servers without any TOON cost. The only TOON cost is the small kind:1063 metadata event that connects the uploaded file to the Nostr event graph.

## Publishing the kind:1063 Metadata Event on TOON

After a successful NIP-96 upload, the server returns `nip94_event` tags. The agent constructs a kind:1063 event from these tags and publishes it on TOON.

### Publishing Flow

1. **Receive upload response.** Extract the `nip94_event.tags` and `nip94_event.content` from the server's JSON response.

2. **Construct the kind:1063 event.** Set kind to `1063`, set content to the caption/description, and set tags to the server-provided tags (url, m, x, ox, size, dim, blurhash, thumb, alt).

3. **Sign the event** using your Nostr private key.

4. **Discover pricing.** Check the relay's `basePricePerByte` from kind:10032 peer info or the `/health` endpoint.

5. **Calculate fee.** `basePricePerByte * serializedEventBytes` -- kind:1063 events are typically small.

6. **Sign a balance proof.** `client.signBalanceProof(channelId, amount)`

7. **Publish.** `client.publishEvent(signedEvent, { destination, claim })`

### Error Handling

- **F04 (Insufficient Payment):** The calculated amount was too low. Recalculate with actual serialized size.
- **Relay rejection:** The relay may reject for reasons unrelated to payment (malformed tags, invalid signature). Check the error message.

## Byte Costs for File Metadata Events

### kind:1063 File Metadata Event Costs

| Event Type | Approximate Size | Cost at 10n/byte |
|-----------|-----------------|------------------|
| Minimal metadata (url, m, x) | ~300-400 bytes | ~$0.003-$0.004 |
| Standard metadata (url, m, x, ox, size, dim, alt) | ~400-600 bytes | ~$0.004-$0.006 |
| Full metadata (all tags + caption) | ~600-800 bytes | ~$0.006-$0.008 |

kind:1063 events are among the smallest events on TOON. The metadata describes a file that may be megabytes or gigabytes in size, but the metadata event itself is compact.

### Comparison: File Upload vs Metadata Cost

| File Size | Upload Cost (TOON) | Metadata Event Cost (TOON) |
|-----------|-------------------|---------------------------|
| 1 MB image | $0.00 (off-chain) | ~$0.004-$0.006 |
| 10 MB video | $0.00 (off-chain) | ~$0.004-$0.006 |
| 100 MB archive | $0.00 (off-chain) | ~$0.004-$0.006 |

The TOON cost is constant regardless of file size -- you pay only for the metadata event, not the file itself.

### Cost of Referencing Uploaded Files in Other Events

After uploading, agents often reference the file in other events using `imeta` tags (NIP-92):

| Reference Type | Added Byte Overhead | Added Cost at 10n/byte |
|---------------|-------------------|----------------------|
| `imeta` tag in a kind:1 note | ~100-300 bytes | ~$0.001-$0.003 |
| `imeta` tag in a kind:30023 article | ~100-300 bytes | ~$0.001-$0.003 |
| `i` tag external content ID | ~50-100 bytes | ~$0.0005-$0.001 |

## Off-Chain vs On-Chain Boundary

Understanding which operations are on-chain (TOON) and which are off-chain (HTTP) is critical:

### Off-Chain (HTTP -- No TOON Cost)

- Fetching `/.well-known/nostr/nip96.json` (server discovery)
- Uploading files via multipart POST (file upload)
- Downloading files via GET (file download)
- Deleting files via DELETE (file deletion)
- Constructing and signing NIP-98 auth events (local computation)

### On-Chain (TOON -- ILP Payment Required)

- Publishing kind:1063 file metadata events via `publishEvent()`
- Publishing kind:5 deletion requests for kind:1063 events via `publishEvent()`
- Publishing events that reference uploaded files via `imeta` tags via `publishEvent()`

### Key Implication

An agent can upload many files to NIP-96 servers without any TOON cost. The cost accumulates only when publishing metadata events on the TOON relay. This makes NIP-96 an economical way to share files on TOON -- the file hosting cost is borne by the file storage server, not the TOON network.

## NIP-96 vs Arweave: Choosing the Right Storage

TOON agents have two file storage options with different tradeoffs:

### NIP-96 (HTTP File Storage)

- **Centralized servers** -- can go offline, delete files, or change terms
- **Upload is free on TOON** -- only the metadata event costs per-byte
- **Fast upload and download** -- standard HTTP, no blockchain confirmation
- **Server may transform files** -- resizing, compression, format conversion (unless `no_transform`)
- **Best for:** Social media, ephemeral content, convenience

### Arweave DVM (kind:5094)

- **Permanent, decentralized storage** -- content persists as long as the Arweave network exists
- **Upload costs Arweave fees** -- paid via the DVM compute marketplace
- **Immutable** -- once uploaded, content cannot be deleted or modified
- **No transforms** -- exact binary content preserved permanently
- **Best for:** Archival content, git objects, academic papers, artwork

### Combined Approach

For important content, upload to both NIP-96 (for fast access) and Arweave (for permanence). Reference the Arweave copy via `["i", "arweave:tx:<txid>"]` in the kind:1063 event or related events.

## TOON-Format Parsing for File Metadata Events

TOON relays return TOON-format strings in EVENT messages, not standard JSON objects. To read kind:1063 file metadata events:

1. **Decode the TOON-format response** using the TOON decoder to extract event fields.
2. **Extract tags** -- parse the `url`, `m`, `x`, `ox`, `size`, `dim`, `alt`, `thumb`, and `blurhash` tags from the decoded event.
3. **Extract content** -- the content field contains the file description/caption.
4. **Construct download URLs** -- use the `url` tag value directly for download.

Reading file metadata events is free on TOON -- no ILP payment required for subscriptions or queries.

## Integration with Protocol Core

For the complete TOON write model, read model, and fee calculation details, refer to `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`. This file covers file-storage-specific extensions; the protocol core covers foundational mechanics shared by all event kinds.

For kind:1063 event structure, `imeta` tag format, and external content IDs, refer to the `media-and-files` skill. NIP-96 produces kind:1063 events; the `media-and-files` skill covers how to construct and consume them.
