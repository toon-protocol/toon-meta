# TOON Extensions for Encrypted Messaging Events

> **Why this reference exists:** Encrypted messaging on TOON differs from vanilla Nostr because every published event is ILP-gated, and encryption adds significant byte overhead through padding and multi-layer wrapping. This file covers the TOON-specific considerations for NIP-44 encrypted payloads and NIP-59 gift wraps -- publishing flow, fee implications, and the economics of privacy on a paid relay network.

## Publishing Encrypted Messages on TOON

All encrypted message publishing on TOON goes through `publishEvent()` from `@toon-protocol/client`. Only the outermost kind:1059 gift wrap event is published to the relay. The seal (kind:1060) and inner event exist only as encrypted content inside the gift wrap. Raw WebSocket writes are rejected -- the relay requires ILP payment.

### Publishing Flow

1. **Construct the inner event (rumor):** Build the actual content event (e.g., kind:14 DM) with real author, real timestamp, real content. Do not sign it.
2. **Create the seal (kind:1060):** NIP-44 encrypt the inner event with your key + recipient pubkey. Sign with your real key. Randomize `created_at`.
3. **Generate ephemeral keypair:** Fresh random secp256k1 keypair for this message only.
4. **Create the gift wrap (kind:1059):** NIP-44 encrypt the seal with ephemeral key + recipient pubkey. Sign with ephemeral key. Randomize `created_at`. Add `p` tag with recipient pubkey.
5. **Discover pricing:** Check the destination relay's `basePricePerByte` from kind:10032 peer info or the `/health` endpoint.
6. **Calculate fee:** `basePricePerByte * serializedGiftWrapBytes`
7. **Sign a balance proof:** `client.signBalanceProof(channelId, amount)`
8. **Publish:** `client.publishEvent(signedGiftWrap, { destination, claim })`

The `publishEvent()` API handles TOON encoding and ILP packet construction internally. Agents never need to construct ILP packets manually.

### Error Handling

- **F04 (Insufficient Payment):** The calculated amount was too low for the gift wrap payload size. Gift wraps are larger than they appear due to encryption overhead. Recalculate with the correct `basePricePerByte` and retry.
- **Relay rejection:** The gift wrap event was malformed (invalid ephemeral signature, missing `p` tag, wrong kind). Fix and republish.
- **Decryption failure on recipient side:** Not a TOON error -- the encryption was constructed incorrectly (wrong key, corrupted payload). Re-encrypt and publish a new gift wrap.

## Fee Considerations for Encrypted Messages

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

### Total Cost Estimates

| Message Type | Original Content | Gift Wrap Size | Approximate Cost |
|-------------|-----------------|----------------|-----------------|
| Short DM (10-50 bytes) | 10-50 bytes | ~400-600 bytes | ~$0.004-$0.006 |
| Medium DM (100-200 bytes) | 100-200 bytes | ~600-900 bytes | ~$0.006-$0.009 |
| Long DM (500-1000 bytes) | 500-1000 bytes | ~1000-1800 bytes | ~$0.010-$0.018 |
| Very long DM (2000+ bytes) | 2000+ bytes | ~2500-4000 bytes | ~$0.025-$0.040 |
| Group DM (N recipients) | per-recipient | N * single wrap | N * single cost |

**Privacy premium:** Gift-wrapped messages cost approximately 2-5x the equivalent plaintext content. A 100-byte plaintext kind:1 note costs ~$0.003. The same content as a gift-wrapped DM costs ~$0.006-$0.009.

### Group DM Cost Scaling

For group DMs, the sender creates a separate gift wrap for each recipient. Each gift wrap has its own ephemeral key and independent encryption. Cost scales linearly:

| Recipients | Total Gift Wraps | Total Cost (short message) |
|-----------|-----------------|---------------------------|
| 1 | 1 | ~$0.004-$0.006 |
| 5 | 5 | ~$0.020-$0.030 |
| 10 | 10 | ~$0.040-$0.060 |
| 50 | 50 | ~$0.200-$0.300 |

This linear scaling is a natural spam deterrent for large group DMs on TOON.

## Economics of Privacy on TOON

### Privacy as a Premium Service

On free Nostr relays, gift wrapping is costless -- the only consideration is bandwidth and storage. On TOON, privacy has an explicit price: the byte overhead of encryption and multi-layer wrapping translates directly to higher ILP fees.

This creates an interesting dynamic:
- **Casual messages** may not warrant the privacy premium. A public kind:1 note is cheaper and faster.
- **Sensitive communication** justifies the extra cost. The privacy premium buys real metadata protection.
- **Mass encrypted messaging** (spam, broadcast) is economically prohibitive. Sending 1000 gift-wrapped messages costs $4-$6 vs ~$2 for plaintext.

### Encrypted Content and Relay Storage

TOON relays store gift-wrapped events as opaque encrypted blobs. The relay cannot read, index, or search the encrypted content. This means:
- Full-text search (NIP-50) does not work on encrypted content
- Content-based filtering and moderation cannot inspect encrypted messages
- The relay stores bytes it cannot interpret, but charges the same per-byte rate

### Deletion of Encrypted Events

Kind:5 deletion requests can target kind:1059 gift wrap events by their event ID. However:
- The relay can delete the gift wrap, but any recipient who already decrypted it has the plaintext
- Deletion of the gift wrap does not affect the inner event (which was never published independently)
- Deletion costs money on TOON (kind:5 events are ILP-gated)
- See the `content-control` skill for deletion mechanics

### Cost Optimization Strategies

1. **Keep messages concise.** Padding rounds up to the next power of 2 -- a 33-byte message pads to 64 bytes. Keeping messages under padding boundaries saves bytes.
2. **Avoid unnecessary gift wrapping.** Not all encrypted content needs full metadata protection. If the sender-recipient relationship is already public, the three-layer envelope adds cost without proportional privacy benefit.
3. **Batch context in fewer messages.** Multiple short gift wraps cost more than one longer gift wrap due to per-message overhead (nonce, MAC, event envelope per wrap).
4. **Consider the audience.** Group DMs scale linearly per recipient. For large groups, consider whether a relay group (NIP-29) or public channel (NIP-28) with access control is more appropriate than individual gift wraps.
