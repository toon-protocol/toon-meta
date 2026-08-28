# TOON Extensions for Media and Files

> **Why this reference exists:** NIP-92, NIP-94, and NIP-73 interact with TOON's ILP-gated economics in ways that shape how agents work with media. Metadata events go to the relay, whose route is flat-priced; the blobs they describe go to the store route, which is priced by payload size. `arweave:tx:` external content IDs connect TOON events to permanent Arweave storage, bridging TOON's metadata layer with Arweave's permanence layer. This file covers the TOON-specific mechanics, the pricing implications, and the Arweave integration details.

## Publishing Media Events on TOON

All media-related event publishing on TOON goes through `client.send()` from `@toon-protocol/client`. Raw WebSocket writes are rejected -- the relay requires ILP payment for every event.

### Publishing kind:1063 File Metadata Events

1. **Construct the kind:1063 event.** Set content to a file description/caption. Add required tags: `url` (file URL), `m` (MIME type), `x` (SHA-256 hex hash). Add optional tags as appropriate: `size`, `dim`, `alt`, `thumb`, etc.
2. **Sign the event** using your Nostr private key.
3. **Send it.** `await client.send({ body: signedEvent })`. The client seals the payload to the terminating connector, reads the route's price, mints the covering claim and carries it -- there is no separate pricing, claim-signing or publish step.

### Publishing Events with `imeta` Tags

1. **Construct the host event** (e.g., kind:1 note, kind:30023 article). Write content with media URLs.
2. **Add `imeta` tags.** One `imeta` tag per media URL in the content.
3. **Sign the event** using your Nostr private key.
4. **Send it.** `await client.send({ body: signedEvent })`. The `imeta` tags make the event larger; on the relay's flat-priced route they do not make it dearer.

### Publishing Events with `i` Tags (External Content IDs)

1. **Construct the event** (any kind). Add `i` tags referencing external content: `["i", "arweave:tx:<txid>"]`.
2. **Sign and send** with `await client.send({ body: signedEvent })`.

### Error Handling

- **F03 (INVALID_AMOUNT):** the claim does not cover the charge -- underpayment. Let `send()` price the packet rather than supplying an amount of your own.
- **T04:** over the peering's cap. The reject message states the cap; that message is the only way a sender learns it. A packet carrying embedded binary data is the usual way to trip this.
- **F02:** nothing routes that name. **T01:** the peer was not there.
- A REJECT comes back as `{ fulfilled: false }`; it is never thrown.
- **Relay rejection:** check for missing required tags on kind:1063 (url, m, x are mandatory).

## What Media Actually Costs on TOON

Two routes are in play, and only one of them cares about size:

| What you are writing | Route | Price (probed 2026-08-28) |
|----------------------|-------|---------------------------|
| Any Nostr event -- kind:1063, or a note/article carrying `imeta` and `i` tags | `g.toon.relay` | 1 base unit of 6-decimal USDC, flat |
| A blob, via the Arweave DVM (kind:5094 request, kind:6094 result) | `g.toon.store` / `g.toon.relay.store` | `1000`, plus `10` per KiB |

### Metadata Events Are Flat-Priced

A minimal kind:1063 and a fully-tagged one cost the same. A kind:1 note with three full `imeta` tags costs the same as a bare text note. A kind:30023 article with three attachments costs the same again. The relay's price is a schedule over payload length with no slope, so tag overhead -- however many bytes it adds -- changes nothing about the charge. There is no byte-shaving to do and no cost argument for dropping `alt` text.

### Blob Storage Is Priced by Size

The store route does have a slope, which makes it the only place in this skill where size and money are connected. Do not compute the charge yourself: `await client.routePrice('g.toon.store')` returns `{ price, pricePerKib }`, and `chargeFor(terms, sealedBytes)` from `@toon-protocol/client` turns those terms into a charge. The metered quantity is the **sealed** payload the PREPARE carries, not the file on disk -- the seal and the envelope make it larger -- so a charge cannot be derived from the file's own size. A small blob lands near 1010 base units, roughly $0.00101. In the ordinary case `send()` prices the packet for you and neither call is needed.

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
- **Cost separation:** the metadata event is a flat-priced relay write no matter how many tags it carries. The file's bytes are charged on the store route, priced by the sealed payload, when the DVM stores them. Two routes, two charges, and only the second one scales with size.
- **Cross-platform discovery:** Anyone can search for `#i: ["arweave:tx:<txid>"]` to find all Nostr events referencing that Arweave content.

## Reading Media Events

Reads are free and speak plain NIP-01. The relay returns standard JSON `EVENT` messages, byte-identical to `JSON.stringify(["EVENT", subscriptionId, event])`, so any ordinary Nostr client can read it. There is no TOON decoding on the read path: TOON is the encoding of the *write* payload, sealed inside the ILP packet and never opened by the connector. **TOON on the way in, plain NIP-01 JSON on the way out.**

To read media events:

1. **`JSON.parse` the frame** and take element 2 -- an ordinary `NostrEvent` object with `id`, `pubkey`, `created_at`, `kind`, `tags`, `content`, `sig`.
2. **For kind:1063 events,** extract the content field (file description), then parse individual tags for url, m, x, and optional metadata.
3. **For events with `imeta` tags,** iterate the tag array looking for entries where the first element is `"imeta"`. Parse each subsequent element as a space-separated key-value pair.
4. **For events with `i` tags,** iterate the tag array looking for entries where the first element is `"i"`. Parse the second element as `<type>:<identifier>`.

Reading media events is free on TOON -- no ILP payment required for subscriptions.

## Integration with Protocol Core

For the complete TOON write model, read model, and pricing details, refer to `skills/nostr-protocol-core/references/toon-protocol-context.md`. This file covers media-specific extensions; the protocol core covers foundational mechanics shared by all event kinds.
