# TOON Extensions for Private Direct Messages

> **Why this reference exists:** Private DMs on TOON differ from vanilla Nostr because every published gift wrap is ILP-gated, and a group DM is not one write but one write per recipient. This file covers the TOON-specific considerations for NIP-17 DMs -- the send flow, what the relay actually charges, per-recipient scaling for group DMs, and the economic dynamics of DMs on a paid network.

## Publishing DMs on TOON

All DM publishing on TOON goes through `send()` from `@toon-protocol/client`. Only the outermost kind:1059 gift wrap event is sent to the relay. The kind:1060 seal and kind:14 inner event exist only as encrypted content inside the gift wrap. Raw WebSocket writes are rejected -- the relay requires ILP payment.

### Two Different Seals, and the Encoding Inside Them

The word "seal" means two unrelated things here, at two different layers, and a third thing is often confused with both. Keep all three apart:

- **NIP-59 gift wrap** is the NIP-level seal of the *message*: the kind:1060 seal inside the kind:1059 gift wrap. You construct it, and it is what hides the message from the relay.
- **TOON's transport seal** is what `send()` does to the *payload* on its way to the terminating connector (ADR 0018). It is a lower layer, applied to whatever bytes you hand the client.
- **TOON encoding** is not a seal at all. It is the *format* of the write-payload bytes carried sealed inside the ILP packet -- an agreement between a client and an app, which the connector never opens.

None of the three replaces another. `send()` sealing your payload does not make the message private from the relay; only the gift wrap does that. Building a gift wrap does not exempt you from the transport layer. And none of the three is what a relay hands back on a read -- reads come back as plain NIP-01 JSON (see "Reading Is Plain NIP-01" below).

### Send Flow

1. **Construct the kind:14 rumor:** Build the actual DM with real author, real timestamp, message content, `p` tags for recipient(s), optional `e`/`subject` tags. Do not sign it.
2. **Create the seal (kind:1060):** NIP-44 encrypt the rumor with your key + recipient pubkey. Sign with your real key. Randomize `created_at`.
3. **Generate ephemeral keypair:** Fresh random secp256k1 keypair for this message only.
4. **Create the gift wrap (kind:1059):** NIP-44 encrypt the seal with ephemeral key + recipient pubkey. Sign with ephemeral key. Randomize `created_at`. Add `p` tag with recipient pubkey.
5. **Send it:** `await client.send({ body: giftWrap })`. The client seals the payload to the terminating connector, reads the route's price, mints the covering claim and carries it -- there is no separate pricing, claim-signing or publish step.

Agents never construct ILP packets, never compute a charge by hand and never sign a claim.

### Asking the Price in Advance

Where you genuinely need the price before sending -- a budget check, a batch estimate -- ask the route rather than multiplying:

```ts
const terms = await client.routePrice('g.toon.relay'); // { price, pricePerKib? }
```

Then `chargeFor(terms, sealedBytes)` from `@toon-protocol/client`. The metered quantity is the **sealed** payload the PREPARE carries, not the gift wrap JSON you serialized, so you cannot compute the charge from your own event bytes. For the relay route the question rarely arises: the price is flat, so it does not depend on the payload at all.

### Error Handling

A REJECT comes back as `{ fulfilled: false }`; it is never thrown.

- **F03 (INVALID_AMOUNT):** the claim does not cover the charge -- underpayment. This should not happen when `send()` prices the packet; it happens when a caller supplied its own amount. Let the client price it.
- **T04:** the packet is over the peering's cap. The reject message states the cap, which is the only way a sender learns it. For a large group DM, this is the limit you will meet first.
- **F02 / T01:** nothing routes that destination name / the peer was not there. Check the destination address, not the event.
- **Relay rejection:** the gift wrap event was malformed (invalid ephemeral signature, missing `p` tag, wrong kind). Fix and resend.
- **Decryption failure on recipient side:** not a TOON error -- the encryption was constructed incorrectly (wrong key, corrupted payload). Re-encrypt and send a new gift wrap.

## Price Considerations for Private DMs

### What the Relay Charges

Nostr events go to the relay route `g.toon.relay`, and that route is **flat-priced: 1 base unit of 6-decimal USDC per packet** (probed 2026-08-28). The price does not depend on payload length. A fifteen-byte "hey" and an essay-length DM cost exactly the same, and so does a plaintext kind:1 note.

The size-metered case on TOON is the store route (`g.toon.store`, 1000 base units plus 10 per KiB of sealed payload) for blob storage. DMs do not go there.

### Encryption Overhead Is Real, but It Is Not a Price

A gift wrap is much larger than the message inside it. Roughly, in order:

| Layer | Overhead |
|-------|----------|
| Kind:14 content | The plaintext message |
| NIP-44 padding (seal) | Power-of-2 padding, min 32 bytes |
| NIP-44 crypto overhead (seal) | ~49 bytes + ~33% base64 expansion |
| Kind:1060 envelope | ~250-350 bytes |
| NIP-44 padding (gift wrap) | Power-of-2 padding, min 32 bytes |
| NIP-44 crypto overhead (gift wrap) | ~49 bytes + ~33% base64 expansion |
| Kind:1059 envelope | ~300-400 bytes |

A short DM lands around 400-600 bytes on the wire. That matters for packet size limits and for anything you route to a size-metered destination. On the relay's flat route it changes nothing about what you pay.

### The Privacy Premium Is Not a Cost Premium

Gift-wrapped DMs used to be described as costing 2-5x an equivalent plaintext note, because they are 2-5x the bytes. On a flat-priced route that is simply false: one gift wrap is one packet, and one plaintext note is one packet, at the same price. Choose encryption on privacy grounds, not on price grounds.

What privacy does cost is packets, in one specific place: a group conversation. A public note reaches everyone for one packet; a group DM needs one gift wrap per recipient.

## Group DM Cost Scaling

### Linear Per-Recipient Cost

Group DMs require a separate gift wrap for each recipient, and each gift wrap is a separate packet. Cost is exactly linear in recipient count and independent of message length: N recipients cost N base units. A 5-person group DM costs 5 base units whether the message is a word or a page.

### Self-Delivery Cost

The sender should also create a gift wrap addressed to themselves for inbox sync. This adds one additional packet to every message. For a 5-person group DM, the sender publishes 5 gift wraps (one per recipient, including self).

### When Group DMs Become Impractical

At approximately 10+ recipients, consider alternatives:

| Mechanism | Cost Model | Privacy | Best For |
|-----------|-----------|---------|----------|
| NIP-17 group DM | N packets per message | Full metadata hiding | Small private groups (2-10) |
| NIP-29 relay group | 1 packet per message | Membership is in the clear | Medium groups, persistent membership |
| NIP-28 public channel | 1 packet per message | Fully public | Large open discussions |

The crossover is about packet count, not bytes: a group DM to 10 people costs 10x what the same message costs in a relay group, however short or long the message is. At high recipient counts the practical wall is usually the peering's cap (T04) and the round trips, not the money.

Note what the fleet relay does and does not do for the two alternatives: it implements NIP-01 and NIP-34, so NIP-29 group membership and NIP-28 channel structure are client-side conventions over ordinary events, not rules the relay enforces.

## Economics of Private DMs on TOON

### DM Spam Deterrence

On free Nostr relays, DM spam is costless -- the only barrier is relay acceptance policies. On TOON every DM is a metered packet, so a campaign's cost scales with the number of messages sent. Look at the actual numbers before calling that a deterrent:

| Spam Volume | Packets | Total Cost |
|------------|---------|-----------|
| 100 DMs | 100 | 100 base units (~$0.0001) |
| 10,000 DMs | 10,000 | 10,000 base units (~$0.01) |
| 100,000 DMs | 100,000 | 100,000 base units (~$0.10) |

Be honest about what this does and does not buy. One base unit of 6-decimal USDC is one millionth of a dollar, so 100,000 DMs cost about ten cents: money alone is not a deterrent to mass DMs at any volume worth worrying about. Payment is a **gate, not a price barrier**. What it actually provides is that no write happens at all without a covering claim on a funded payment channel -- so every message is attributable, volume is capped per peering, and a sender must stand up real on-chain funding before sending anything. That is friction and attribution. The strongest deterrent to cold-DM spam on TOON remains social: recipients ignore it, and reputation is the scarce resource.

### Cold DM Economics

Cold-DMing (messaging someone you have no relationship with) costs little in money and a great deal in standing:

- **Economic cost:** one base unit per message, with no guarantee of a response. Real but negligible.
- **Social cost:** this is the actual cost. Recipients on a paid network have higher expectations for message quality, and an ignored cold DM spends reputation, not money.
- **Attention cost:** the money spent is trivial; the recipient's attention is the resource you are actually consuming.

This does not mean cold DMs are never appropriate -- introducing yourself to someone whose work you admire is valid. But "spray and pray" messaging is unwelcome, and on TOON its price will not stop you, so judgment has to.

### Reading Is Plain NIP-01

Reads are free and speak ordinary NIP-01. Subscribe with `["REQ", <sub_id>, { kinds: [1059], "#p": ["<your-pubkey>"] }]` and the relay answers with **standard JSON** `EVENT` messages:

```json
["EVENT", "inbox", {"id": "…", "pubkey": "…", "created_at": 1756400000, "kind": 1059, "tags": [["p", "…"]], "content": "…", "sig": "…"}]
```

`JSON.parse` the frame and the third element is already a `NostrEvent`. There is nothing to decode: any ordinary Nostr client can read a TOON relay with no TOON dependency, and a read never touches a connector. **Do not import `@toon-format/toon` for a read** -- earlier guidance describing relay responses as TOON-format strings was wrong. TOON on the way in, plain NIP-01 JSON on the way out.

The unwrapping a DM inbox still needs is the two NIP-44 decryptions (gift wrap, then seal), which are cryptography, not encoding.

### Encrypted Content and Relay Limitations

TOON relays store DM gift wraps as opaque encrypted blobs:

- Full-text search (NIP-50) cannot index encrypted DM content
- Content-based moderation cannot inspect DM content
- The route's price is flat and content-blind -- the relay charges the same whether the payload is encrypted or not
- DMs cannot be discovered by third parties browsing the relay
- The relay does not know a gift wrap is a gift wrap. The fleet relay implements **NIP-01 and NIP-34 only**: it stores a signed kind:1059 event like any other event, and enforces no NIP-17, NIP-59 or NIP-29 rule server-side

### Deletion of DMs

Kind:5 deletion requests can target kind:1059 gift wrap events:

- The relay deletes the gift wrap, but recipients who already decrypted it have the plaintext locally
- Deletion costs a packet on TOON (kind:5 events are ILP-gated like any other write)
- Deleting a gift wrap does not affect the recipient's local copy
- For group DMs, you would need to delete the gift wrap on each recipient's relay -- impractical and possibly impossible
- See the `content-control` skill for deletion mechanics

### Cost Optimization Strategies

Cost on the relay route is counted in packets, so every real saving is a saving in packets, never in bytes.

1. **Combine short messages.** Three 20-byte DMs are three packets. One message containing all three thoughts is one packet, at one third the cost and no penalty for its length.
2. **Right-size your groups.** A group DM's cost is one packet per recipient. Do not use group DMs for audiences larger than ~10; use relay groups or channels, which are one packet per message regardless of audience.
3. **Do not chase bytes.** Trimming a message, skipping a relay hint or staying under a NIP-44 padding boundary saves nothing on a flat-priced route. Omit the `subject` tag on replies because it is inherited from the first message and repeating it is wrong, not because it costs anything.
4. **Do not hand the client an amount.** Letting `send()` price the packet is both correct and the only way to avoid an F03 when the sealed payload is not the size you assumed.
