# TOON Extensions for File Storage

> **Why this reference exists:** NIP-96 file storage interacts with TOON's ILP-gated economics in a unique way: the upload itself is off-chain HTTP (free), but publishing the resulting kind:1063 metadata event on TOON is a paid write. This creates a split-cost model absent from free Nostr relays. This file covers the TOON-specific mechanics, the off-chain/on-chain boundary, and the economic implications for file sharing on a paid network.

## The Split-Cost Model

NIP-96 file storage on TOON has a distinctive economic structure:

1. **File upload: FREE (off-chain HTTP).** The multipart POST to the NIP-96 server is a direct HTTP request between the client and the file storage server. No TOON relay, no ILP payment, no `client.send()`. The file storage server may have its own pricing (paid plans), but that is independent of TOON.

2. **Metadata event: PAID (ILP).** Publishing the kind:1063 file metadata event on the TOON relay requires ILP payment via `client.send()` from `@toon-protocol/client`. This is a standard TOON write operation.

This split means: you can upload arbitrarily large files to NIP-96 servers without any TOON cost. The only TOON cost is the small kind:1063 metadata event that connects the uploaded file to the Nostr event graph.

## Publishing the kind:1063 Metadata Event on TOON

After a successful NIP-96 upload, the server returns `nip94_event` tags. The agent constructs a kind:1063 event from these tags and publishes it on TOON.

### Publishing Flow

1. **Receive upload response.** Extract the `nip94_event.tags` and `nip94_event.content` from the server's JSON response.

2. **Construct the kind:1063 event.** Set kind to `1063`, set content to the caption/description, and set tags to the server-provided tags (url, m, x, ox, size, dim, blurhash, thumb, alt).

3. **Sign the event** using your Nostr private key.

4. **Send it.** `await client.send({ body: signedEvent })`. The client seals the payload to the terminating connector, reads the route's price, mints the covering claim and carries it -- there is no separate pricing, claim-signing or publish step.

### Error Handling

A REJECT comes back as `{ fulfilled: false }`; it is never thrown.

- **F03 (INVALID_AMOUNT):** the claim does not cover the charge -- underpayment. Let `send()` price the packet rather than computing an amount yourself.
- **T04:** over the peering's cap. The message states the cap; that is the only way a sender learns it.
- **Relay rejection:** the relay may reject for reasons unrelated to payment (malformed tags, invalid signature). Check the error message.

## What the Metadata Event Costs

Nostr events go to `g.toon.relay`, whose route is **flat-priced at 1 base unit** of 6-dp USDC. Size does not enter into it: a minimal kind:1063 with just `url`, `m` and `x` costs the same as a full one carrying `ox`, `size`, `dim`, `blurhash`, `thumb`, `alt` and a caption. Adding an `imeta` tag (NIP-92) or an `i` external content ID to some other event does not change that event's price either.

So the TOON cost is constant regardless of file size *and* regardless of metadata richness -- you pay one flat unit for the metadata event, and nothing for the file itself. There is no reason to trim tags to save money; trim them only when they are wrong or noisy.

### Asking the Node What a Route Costs

A connector answers, it never announces. `GET /ilp` on a node's URL returns its free, unauthenticated self-description: its addresses, its settlement facts and every route's price. An unpaid request to a priced route is answered with a **greeting** carrying that route's terms.

From the client, `await client.routePrice(destination)` returns `{ price, pricePerKib? }`, and `chargeFor(terms, sealedBytes)` from `@toon-protocol/client` turns those terms into a charge. The metered quantity is the **sealed** payload the PREPARE carries, not the event JSON you wrote, so a charge cannot be computed from your own byte count. In the ordinary case you need none of this: `send()` prices the packet itself.

## Off-Chain vs On-Chain Boundary

Understanding which operations are on-chain (TOON) and which are off-chain (HTTP) is critical:

### Off-Chain (HTTP -- No TOON Cost)

- Fetching `/.well-known/nostr/nip96.json` (server discovery)
- Uploading files via multipart POST (file upload)
- Downloading files via GET (file download)
- Deleting files via DELETE (file deletion)
- Constructing and signing NIP-98 auth events (local computation)

### On-Chain (TOON -- ILP Payment Required)

- Publishing kind:1063 file metadata events via `client.send()`
- Publishing kind:5 deletion requests for kind:1063 events via `client.send()`
- Publishing events that reference uploaded files via `imeta` tags, via `client.send()`

### Key Implication

An agent can upload many files to NIP-96 servers without any TOON cost. The cost accumulates only when publishing metadata events on the TOON relay. This makes NIP-96 an economical way to share files on TOON -- the file hosting cost is borne by the file storage server, not the TOON network.

## NIP-96 vs Arweave: Choosing the Right Storage

TOON agents have two file storage options with different tradeoffs:

### NIP-96 (HTTP File Storage)

- **Centralized servers** -- can go offline, delete files, or change terms
- **Upload is free on TOON** -- only the metadata event is paid, at the relay's flat 1 base unit
- **Fast upload and download** -- standard HTTP, no blockchain confirmation
- **Server may transform files** -- resizing, compression, format conversion (unless `no_transform`)
- **Best for:** Social media, ephemeral content, convenience

### Arweave DVM (kind:5094)

- **Permanent, decentralized storage** -- content persists as long as the Arweave network exists
- **Upload is a paid TOON write to the store route** -- kind:5094 terminates at `g.toon.store` (also reachable as `g.toon.relay.store`), whose price is metered: `1000 + 10 per KiB` of sealed payload, in base units of 6-dp USDC. A small blob is ~1010 base units, about $0.00101. The Arweave storage fee itself is covered by the request's `bid`.
- **Immutable** -- once uploaded, content cannot be deleted or modified
- **No transforms** -- exact binary content preserved permanently
- **Best for:** Archival content, git objects, academic papers, artwork

### Combined Approach

For important content, upload to both NIP-96 (for fast access) and Arweave (for permanence). Reference the Arweave copy via `["i", "arweave:tx:<txid>"]` in the kind:1063 event or related events.

## Reading File Metadata Events

Reads are free and speak plain NIP-01. The relay returns standard JSON `EVENT` messages that any ordinary Nostr client can parse -- there is nothing to decode, and a free read never touches a connector. To read kind:1063 file metadata events:

1. **Subscribe or query** with a `kinds: [1063]` filter, narrowed by `#x`, `#m` or `#url` as needed.
2. **Extract tags** -- read the `url`, `m`, `x`, `ox`, `size`, `dim`, `alt`, `thumb`, and `blurhash` tags off the event.
3. **Extract content** -- the content field contains the file description/caption.
4. **Construct download URLs** -- use the `url` tag value directly for download.

TOON format belongs to the other direction: it is the encoding of the sealed **write** payload, not of a read response. TOON on the way in, plain NIP-01 JSON on the way out. No ILP payment is required for subscriptions or queries.

## Integration with Protocol Core

For the complete TOON write model, read model, and route-pricing details, refer to `skills/nostr-protocol-core/references/toon-protocol-context.md`. This file covers file-storage-specific extensions; the protocol core covers foundational mechanics shared by all event kinds.

For kind:1063 event structure, `imeta` tag format, and external content IDs, refer to the `media-and-files` skill. NIP-96 produces kind:1063 events; the `media-and-files` skill covers how to construct and consume them.
