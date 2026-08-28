# TOON Extensions for Encrypted Messaging Events

> **Why this reference exists:** Encrypted messaging on TOON differs from vanilla Nostr because every published event is paid for, and encryption adds significant size overhead through padding and multi-layer wrapping. This file covers the TOON-specific considerations for NIP-44 encrypted payloads and NIP-59 gift wraps -- the publishing flow, what a route actually charges, and the economics of privacy on a paid relay network.

## Publishing Encrypted Messages on TOON

All encrypted message publishing on TOON goes through `client.send()` from `@toon-protocol/client`. Only the outermost kind:1059 gift wrap event is published to the relay. The seal (kind:1060) and inner event exist only as encrypted content inside the gift wrap. Raw WebSocket writes are rejected -- the relay requires payment.

### Publishing Flow

1. **Construct the inner event (rumor):** Build the actual content event (e.g., kind:14 DM) with real author, real timestamp, real content. Do not sign it.
2. **Create the seal (kind:1060):** NIP-44 encrypt the inner event with your key + recipient pubkey. Sign with your real key. Randomize `created_at`.
3. **Generate ephemeral keypair:** Fresh random secp256k1 keypair for this message only.
4. **Create the gift wrap (kind:1059):** NIP-44 encrypt the seal with ephemeral key + recipient pubkey. Sign with ephemeral key. Randomize `created_at`. Add `p` tag with recipient pubkey.
5. **Send it:** `await client.send({ body: signedGiftWrap })`. The client seals the payload to the terminating connector, reads the route's price, mints the covering claim and carries it -- there is no separate pricing, claim-signing or publish step.

`send()` handles TOON encoding and packet construction internally. Agents never build a packet and never sign a claim by hand.

If you need the price before you send, ask the node rather than multiplying anything: `await client.routePrice(destination)` returns `{ price, pricePerKib? }`, and `chargeFor(terms, sealedBytes)` from `@toon-protocol/client` turns that into the number that goes on a claim. A node's whole self-description -- its addresses, its settlement facts, and every route's price -- is free and unauthenticated at `GET /ilp` on its URL. A connector answers; it never announces.

### Error Handling

- **F03 INVALID_AMOUNT:** the claim did not cover the charge. This is underpayment. It should not happen when `send()` prices the packet; if it does, the route's terms changed under you -- re-read `routePrice()` and send again.
- **T04:** over the peering's cap. The reject message states the cap, which is the only way a sender learns it.
- **F02 / T01:** nothing routes that name, or the peer was not there.
- **Relay rejection:** The gift wrap event was malformed (invalid ephemeral signature, missing `p` tag, wrong kind). Fix and republish.
- **Decryption failure on recipient side:** Not a TOON error -- the encryption was constructed incorrectly (wrong key, corrupted payload). Re-encrypt and send a new gift wrap.

A REJECT arrives as `{ fulfilled: false }`. It is never thrown.

## What Encryption Costs on TOON

### Encryption Overhead Breakdown

NIP-44 encryption adds fixed overhead per encryption operation:

| Component | Size | Notes |
|-----------|------|-------|
| Version byte | 1 byte | `0x02` |
| Nonce | 32 bytes | Random, per-message |
| MAC | 16 bytes | Poly1305 authentication tag |
| Padding | Variable | Minimum 32 bytes, power-of-2 scheme |
| Length prefix | 2 bytes | Unpadded length, prepended before padding |
| Base64 encoding | ~33% expansion | Base64 encodes 3 bytes as 4 characters |

A 10-byte plaintext message:
- Pads to 32 bytes (+ 2 byte length prefix = 34 bytes)
- Encrypts to 34 + 16 (MAC) = 50 bytes ciphertext
- Adds 1 (version) + 32 (nonce) = 83 bytes binary
- Base64 encodes to ~112 characters

### Gift Wrap Layer Overhead

Each layer of the gift wrap model adds an event envelope:

| Layer | Added Overhead | Notes |
|-------|---------------|-------|
| Inner event (rumor) | ~150-300 bytes | Event fields (pubkey, created_at, kind, tags, content) without id/sig |
| Seal (kind:1060) | ~250-350 bytes | Full event with id, pubkey, created_at, kind, empty tags, content, sig |
| Gift wrap (kind:1059) | ~300-400 bytes | Full event with id, pubkey, created_at, kind, p tag, content, sig |

The seal contains the NIP-44 encrypted inner event. The gift wrap contains the NIP-44 encrypted seal. Each NIP-44 encryption adds its own overhead (nonce, MAC, padding, base64).

### Total Size Estimates

| Message Type | Original Content | Gift Wrap Size |
|-------------|-----------------|----------------|
| Short DM (10-50 bytes) | 10-50 bytes | ~400-600 bytes |
| Medium DM (100-200 bytes) | 100-200 bytes | ~600-900 bytes |
| Long DM (500-1000 bytes) | 500-1000 bytes | ~1000-1800 bytes |
| Very long DM (2000+ bytes) | 2000+ bytes | ~2500-4000 bytes |
| Group DM (N recipients) | one wrap per recipient | N * single wrap |

**No privacy premium.** Every row of that table costs the same to publish: the relay's route (`g.toon.relay`) is flat, 1 base unit of 6-decimal USDC per event. A 100-byte plaintext kind:1 note and a 4 KB gift wrap are the same price. Encryption expands the payload; it does not expand the bill.

Size does move the price on routes that carry a slope. The blob store at `g.toon.store` (also reachable as `g.toon.relay.store`) is priced `1000 + 10 per KiB`. There, the metered quantity is the **sealed** payload the PREPARE carries -- not the event JSON you wrote, which is smaller by the envelope and the wrap -- so you cannot work out a charge from your own byte count. Read `routePrice()` and hand the terms to `chargeFor()`; in the ordinary case `send()` has already done both.

### Group DM Cost Scaling

For group DMs, the sender creates a separate gift wrap for each recipient. Each gift wrap has its own ephemeral key and independent encryption, and each is its own paid write. Cost scales linearly with the recipient count -- N recipients cost N times the flat route price -- and not at all with message length.

| Recipients | Total Gift Wraps | Total Price on the relay route |
|-----------|-----------------|-------------------------------|
| 1 | 1 | 1 base unit |
| 5 | 5 | 5 base units |
| 10 | 10 | 10 base units |
| 50 | 50 | 50 base units |

The scaling is linear in recipients, but it is not what stops group-DM spam: 50 wraps is 50 base units. What stops it is that each of those writes needs an open channel and a signed claim.

## Economics of Privacy on TOON

### Privacy Without a Surcharge

On free Nostr relays, gift wrapping is costless -- the only consideration is bandwidth and storage. On TOON, publishing has an explicit price, but privacy does not: the relay's route is flat, so the size overhead of encryption and multi-layer wrapping buys bandwidth and storage without buying a bigger charge.

This changes the calculus that used to apply here:
- **Casual messages** are no cheaper in the clear. A public kind:1 note and a gift-wrapped DM cost the same; choose between them on audience, not on price.
- **Sensitive communication** costs nothing extra to protect. Take the metadata protection.
- **Mass encrypted messaging** (spam, broadcast) is not priced out -- 1000 gift wraps is 1000 base units, a thousandth of a cent. It is gated instead: each write requires an open channel and a signed claim, so a broadcast is attributable to a funded identity.

### Encrypted Content and Relay Storage

TOON relays store gift-wrapped events as opaque encrypted blobs. The relay cannot read, index, or search the encrypted content. This means:
- Full-text search (NIP-50) does not work on encrypted content
- Content-based filtering and moderation cannot inspect encrypted messages
- The relay stores bytes it cannot interpret, and on a flat route charges the same for them as for anything else

### Deletion of Encrypted Events

Kind:5 deletion requests can target kind:1059 gift wrap events by their event ID. However:
- The relay can delete the gift wrap, but any recipient who already decrypted it has the plaintext
- Deletion of the gift wrap does not affect the inner event (which was never published independently)
- Deletion costs money on TOON (a kind:5 event is a paid write like any other)
- See the `content-control` skill for deletion mechanics

### Cost Optimization Strategies

1. **Send fewer messages, not smaller ones.** On the relay's flat route the price is per write. Multiple short gift wraps cost more than one longer gift wrap carrying the same context -- length is free, count is not.
2. **Keep messages concise anyway.** Padding rounds up to the next power of 2 -- a 33-byte message pads to 64 bytes. That saves bandwidth and relay storage, and it saves money on a sloped route such as the blob store.
3. **Avoid unnecessary gift wrapping.** Not all encrypted content needs full metadata protection. If the sender-recipient relationship is already public, the three-layer envelope adds work without proportional privacy benefit.
4. **Consider the audience.** Group DMs scale linearly per recipient. For large groups, consider whether a relay group (NIP-29) or public channel (NIP-28) is more appropriate than individual gift wraps -- bearing in mind that the fleet relay implements NIP-01 and NIP-34 only, so NIP-29 membership enforcement would have to come from a relay that implements it.
