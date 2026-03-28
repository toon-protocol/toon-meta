# TOON Extensions for Private Direct Messages

> **Why this reference exists:** Private DMs on TOON differ from vanilla Nostr because every published gift wrap is ILP-gated, and the three-layer encryption model adds significant byte overhead. This file covers the TOON-specific considerations for NIP-17 DMs -- publishing flow, per-recipient cost scaling for group DMs, the privacy premium, and the economic dynamics that make DM spam prohibitively expensive on a paid network.

## Publishing DMs on TOON

All DM publishing on TOON goes through `publishEvent()` from `@toon-protocol/client`. Only the outermost kind:1059 gift wrap event is published to the relay. The kind:1060 seal and kind:14 inner event exist only as encrypted content inside the gift wrap. Raw WebSocket writes are rejected -- the relay requires ILP payment.

### Publishing Flow

1. **Construct the kind:14 rumor:** Build the actual DM with real author, real timestamp, message content, `p` tags for recipient(s), optional `e`/`subject` tags. Do not sign it.
2. **Create the seal (kind:1060):** NIP-44 encrypt the rumor with your key + recipient pubkey. Sign with your real key. Randomize `created_at`.
3. **Generate ephemeral keypair:** Fresh random secp256k1 keypair for this message only.
4. **Create the gift wrap (kind:1059):** NIP-44 encrypt the seal with ephemeral key + recipient pubkey. Sign with ephemeral key. Randomize `created_at`. Add `p` tag with recipient pubkey.
5. **Discover pricing:** Check the destination relay's `basePricePerByte` from kind:10032 peer info or the `/health` endpoint.
6. **Calculate fee:** `basePricePerByte * serializedGiftWrapBytes`
7. **Sign a balance proof:** `client.signBalanceProof(channelId, amount)`
8. **Publish:** `client.publishEvent(signedGiftWrap, { destination, claim })`

The `publishEvent()` API handles TOON encoding and ILP packet construction internally. Agents never need to construct ILP packets manually.

### Error Handling

- **F04 (Insufficient Payment):** The calculated amount was too low for the gift wrap payload size. Gift wraps are larger than they appear due to encryption overhead (padding, double NIP-44 encryption, base64 expansion). Recalculate with the correct `basePricePerByte` and retry.
- **Relay rejection:** The gift wrap event was malformed (invalid ephemeral signature, missing `p` tag, wrong kind). Fix and republish.
- **Decryption failure on recipient side:** Not a TOON error -- the encryption was constructed incorrectly (wrong key, corrupted payload). Re-encrypt and publish a new gift wrap.

## Fee Considerations for Private DMs

### Per-Message Cost Breakdown

A single DM goes through multiple layers of overhead before reaching the relay:

| Layer | Overhead | Notes |
|-------|----------|-------|
| Kind:14 content | Original message size | The plaintext message |
| NIP-44 padding (seal) | Variable, min 32 bytes | Power-of-2 padding on the serialized rumor |
| NIP-44 crypto overhead (seal) | ~49 bytes + base64 ~33% | Version byte + nonce + MAC + base64 encoding |
| Kind:1060 envelope | ~250-350 bytes | pubkey, created_at, kind, empty tags, content, id, sig |
| NIP-44 padding (gift wrap) | Variable, min 32 bytes | Power-of-2 padding on the serialized seal |
| NIP-44 crypto overhead (gift wrap) | ~49 bytes + base64 ~33% | Version byte + nonce + MAC + base64 encoding |
| Kind:1059 envelope | ~300-400 bytes | pubkey, created_at, kind, p tag, content, id, sig |

### Total Cost Estimates

| Message Type | Original Content | Gift Wrap Size | Approximate Cost |
|-------------|-----------------|----------------|-----------------|
| Short DM ("hey, what's up?") | ~15 bytes | ~400-500 bytes | ~$0.004-$0.005 |
| Medium DM (a paragraph) | ~200 bytes | ~600-900 bytes | ~$0.006-$0.009 |
| Long DM (detailed message) | ~500 bytes | ~1000-1500 bytes | ~$0.010-$0.015 |
| Very long DM (essay-length) | ~2000 bytes | ~2500-4000 bytes | ~$0.025-$0.040 |

### Privacy Premium

Gift-wrapped DMs cost approximately 2-5x the equivalent plaintext content:

| Comparison | Plaintext (kind:1) | Gift-wrapped DM (kind:14 via 1059) | Premium |
|-----------|-------------------|-------------------------------------|---------|
| 50-byte message | ~$0.002-$0.003 | ~$0.004-$0.006 | ~2x |
| 200-byte message | ~$0.003-$0.004 | ~$0.006-$0.009 | ~2-3x |
| 500-byte message | ~$0.006-$0.008 | ~$0.010-$0.015 | ~2x |

The premium decreases for longer messages because the fixed overhead (event envelopes, crypto headers) becomes a smaller fraction of total size.

## Group DM Cost Scaling

### Linear Per-Recipient Cost

Group DMs require a separate gift wrap for each recipient. Cost scales linearly:

| Recipients | Gift Wraps Published | Total Cost (short message) | Total Cost (medium message) |
|-----------|---------------------|---------------------------|---------------------------|
| 1 (1:1 DM) | 1 | ~$0.004-$0.005 | ~$0.006-$0.009 |
| 3 | 3 | ~$0.012-$0.015 | ~$0.018-$0.027 |
| 5 | 5 | ~$0.020-$0.025 | ~$0.030-$0.045 |
| 10 | 10 | ~$0.040-$0.050 | ~$0.060-$0.090 |
| 25 | 25 | ~$0.100-$0.125 | ~$0.150-$0.225 |
| 50 | 50 | ~$0.200-$0.250 | ~$0.300-$0.450 |

### Self-Delivery Cost

The sender should also create a gift wrap addressed to themselves for inbox sync. This adds one additional gift wrap to every message. For a 5-person group DM, the sender publishes 5 gift wraps (one per recipient, including self).

### When Group DMs Become Impractical

At approximately 10+ recipients, consider alternatives:

| Mechanism | Cost Model | Privacy | Best For |
|-----------|-----------|---------|----------|
| NIP-17 group DM | N * per-wrap cost | Full metadata hiding | Small private groups (2-10) |
| NIP-29 relay group | 1 event per message | Relay sees membership | Medium groups, persistent membership |
| NIP-28 public channel | 1 event per message | Fully public | Large open discussions |

The crossover point depends on message frequency. A group DM to 10 people with 50 messages/day costs ~$2-$5/day. A relay group with the same traffic costs ~$0.20-$0.50/day.

## Economics of Private DMs on TOON

### DM Spam Deterrence

On free Nostr relays, DM spam is costless -- the only barrier is relay acceptance policies. On TOON, every DM costs per-byte:

| Spam Volume | Cost per DM | Total Cost |
|------------|------------|------------|
| 100 DMs | ~$0.005 | ~$0.50 |
| 1,000 DMs | ~$0.005 | ~$5.00 |
| 10,000 DMs | ~$0.005 | ~$50.00 |
| 100,000 DMs | ~$0.005 | ~$500.00 |

This economic friction makes mass DM spam irrational on TOON. The cost of reaching 10,000 users via DM ($50) far exceeds the value of unsolicited messages.

### Cold DM Economics

Cold-DMing (messaging someone you have no relationship with) has both social and economic costs on TOON:
- **Economic cost:** Each cold DM costs ~$0.004-$0.009 with no guarantee of a response
- **Social cost:** Recipients on a paid network have higher expectations for message quality -- they are paying for their relay presence and expect the same from correspondents
- **Opportunity cost:** The money spent on ignored cold DMs could fund meaningful interactions

This does not mean cold DMs are never appropriate -- introducing yourself to someone whose work you admire is valid. But "spray and pray" messaging is both wasteful and unwelcome.

### Encrypted Content and Relay Limitations

TOON relays store DM gift wraps as opaque encrypted blobs:
- Full-text search (NIP-50) cannot index encrypted DM content
- Content-based moderation cannot inspect DM content
- The relay charges the same per-byte rate regardless of content
- DMs cannot be discovered by third parties browsing the relay

### Deletion of DMs

Kind:5 deletion requests can target kind:1059 gift wrap events:
- The relay deletes the gift wrap, but recipients who already decrypted it have the plaintext locally
- Deletion costs money on TOON (kind:5 events are ILP-gated)
- Deleting a gift wrap does not affect the recipient's local copy
- For group DMs, you would need to delete the gift wrap on each recipient's relay -- impractical and possibly impossible
- See the `content-control` skill for deletion mechanics

### Cost Optimization Strategies

1. **Combine short messages.** Three 20-byte DMs cost ~$0.015 (3 * ~$0.005). One 60-byte DM costs ~$0.005. Batch your thoughts into fewer, more complete messages.
2. **Keep within padding boundaries.** NIP-44 pads to powers of 2. A 33-byte message pads to 64 bytes. Staying under 32 bytes saves padding overhead.
3. **Right-size your groups.** Do not use group DMs for audiences larger than ~10. Use relay groups or channels instead.
4. **Skip the subject tag on replies.** The subject is inherited from the first message. Including it on every reply wastes bytes.
5. **Use relay hints judiciously.** Relay hints in `p` tags improve delivery reliability but add bytes. Include them for recipients whose preferred relays are known; omit for well-connected pubkeys.
