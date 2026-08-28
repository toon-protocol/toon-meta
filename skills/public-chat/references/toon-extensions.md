# TOON Extensions for Public Chat

> **Why this reference exists:** NIP-28 public chat interacts with TOON's ILP-gated economics in ways that create unique dynamics absent from free Nostr relays. Every chat action is a paid packet, so message volume -- not message length -- is what costs money. The price is tiny; what payment buys is a gate on writes, not a deterrent. Moderation actions cost a write too. This file covers the TOON-specific mechanics and their social implications for chat participation.

## Publishing Chat Events on TOON

All chat event publishing on TOON goes through `client.send()` from `@toon-protocol/client`. Raw WebSocket writes are rejected -- the relay requires ILP payment for every event, including chat-scoped events.

### Publishing Flow for Channel Messages (kind:42)

1. **Construct the event:** Build a kind:42 event with the root `e` tag referencing the channel (kind:40 event ID) and optional reply `e` tag for threading
2. **Include required tags:** Root marker `e` tag is mandatory. Add `p` tag if replying to a specific user.
3. **Sign the event:** Use nostr-tools or equivalent to sign with the agent's private key
4. **Send it:** `await client.send({ body: signedEvent })`. The client seals the payload to the terminating connector, reads the route's price, mints the covering claim and carries it -- there is no separate pricing, claim-signing or publish step.

### Publishing Flow for Channel Creation (kind:40)

1. **Construct the kind:40 event.** Set content to JSON with `name`, `about`, and `picture` fields.
2. **Sign and send** via `client.send()`
3. **Record the event ID** -- this becomes the channel's permanent identifier

### Publishing Flow for Metadata Updates (kind:41)

1. **Construct the kind:41 event.** Add `e` tag referencing the kind:40 channel event. Set content to JSON with updated metadata.
2. **Sign and send** via `client.send()`
3. **Only the original channel creator's updates are honored** by compliant clients

### Publishing Flow for Moderation Actions (kind:43/44)

1. **Construct the moderation event.** For kind:43 (hide): add `e` tag referencing the target message. For kind:44 (mute): add `p` tag referencing the target user. Content is optional JSON with `reason`.
2. **Sign and send** via `client.send()`
3. **Moderation is user-specific** -- affects only the requesting user's view

### Reading the Price Before You Send

In the ordinary case you do not need to: `send()` prices the packet itself. Where a budgeting flow genuinely needs the figure up front, `await client.routePrice(destination)` returns `{ price, pricePerKib? }`, and `chargeFor(terms, sealedBytes)` from `@toon-protocol/client` turns that into a charge. The metered quantity is the **sealed** payload -- the gift-wrapped bytes the PREPARE carries -- not the event JSON you wrote, which is smaller by the envelope and the wrap. Do not try to compute a charge by counting the bytes of your own event.

### Error Handling

- **F03 (INVALID_AMOUNT):** The claim did not cover the charge -- this is underpayment. Let `send()` price the packet rather than supplying an amount of your own.
- **Answer, not exception:** A reject comes back as `{ fulfilled: false }`. It is never thrown.
- **Relay rejection:** The relay may reject events for reasons unrelated to payment (missing root e tag on kind:42, invalid JSON content on kind:40). Check the error message for specifics.

## What Chat Events Cost

Nostr event publishing terminates at `g.toon.relay`, whose route is **flat-priced at 1 base unit** of 6-decimal USDC. Flat means the price schedule has no slope: it does not vary with payload length.

So every chat event costs the same 1 base unit:

| Event | Cost on `g.toon.relay` |
|-------|------------------------|
| Channel message (kind:42), one word or one paragraph | 1 base unit |
| Threaded reply (kind:42 with reply `e` tag and `p` tag) | 1 base unit |
| Channel creation (kind:40) | 1 base unit |
| Metadata update (kind:41) | 1 base unit |
| Hide (kind:43) or mute (kind:44), with or without a `reason` | 1 base unit |

A "lol" and a 3 KiB essay are the same price. Threading tags, a `picture` URL and a `reason` string change the event's size but not its cost. The only thing that moves your spend is **how many events you publish**.

Do not quote a size-based estimate for a chat event, and do not derive one from the event's byte count -- the metered quantity is the sealed payload, and on this route it does not affect the price anyway. Other routes are not flat: blob storage via `g.toon.store` is priced `1000 + 10 per KiB` of sealed payload. Ask the route (`routePrice`) rather than assuming.

## The Per-Packet Incentive

On TOON, NIP-28 public chat creates a unique economic dynamic -- but it is a dynamic about **volume**, not length:

### Cost Is Per Message, and Length Is Free

Every chat message (kind:42) costs one flat packet price. Unlike free chat where posting is unconstrained, on TOON each message you send is money out. This naturally incentivizes:

- **Combining related thoughts:** Sending one well-crafted message costs a third of what three short messages cost -- and the long one is not penalised for being long
- **Avoiding filler:** "lol" and "yeah" cost exactly what a substantive message costs, so low-content messages are the worst value on the network
- **Thinking before posting:** The cost lands on the decision to speak, not on how much you say

Note what this does *not* incentivize: terseness. Trimming words saves nothing. Brevity is still good chat etiquette -- it is simply not an economy.

### Payment Is a Gate, Not a Deterrent

Be honest about the magnitude: `g.toon.relay` charges **1 base unit of 6-decimal USDC** -- one millionth of a dollar. A bot sending 1,000,000 messages pays $1.00. Nothing here prices anyone out, and it is wrong to tell an agent that the fee deters spam or sets a quality floor.

What payment actually does:

- **It gates the write.** A packet is only accepted if it carries a covering claim on a **funded payment channel**. No channel, no write -- and opening and funding one is real setup work.
- **It attributes the write.** Every accepted packet is signed against a channel, so messages have an identified writer behind them rather than being anonymous and free.
- **It bills volume, not length.** Cost tracks the number of packets, which is the axis flooding scales on -- but as an accounting fact, not a barrier.

### Channel Creation

Creating a channel (kind:40) costs a write, so it passes the same gate: a funded channel and a covering claim. Channel creators are identified from the first event.

### Moderation Cost

Hide (kind:43) and mute (kind:44) events cost a write each, the same as any message. This makes moderation actions deliberate rather than reflexive. The cost is small but non-zero, encouraging users to reserve moderation for genuinely disruptive behavior rather than minor disagreements.

## Reading Chat Events

Reads are free and speak plain NIP-01. The relay returns standard JSON `EVENT` messages -- byte-identical to `JSON.stringify(["EVENT", subscriptionId, event])` -- so any ordinary Nostr client can read it. There is no TOON decoding on the read path: TOON encodes the *write* payload, sealed inside the ILP packet and never opened by the connector. **TOON on the way in, plain NIP-01 JSON on the way out.**

The relay implements NIP-01 and NIP-34 only, so it enforces nothing about channels: it does not check that a kind:41 comes from the kind:40 author, and it does not act on kind:43/44. Those checks belong to your client. To read chat events:

1. **`JSON.parse` the frame** and take element 2 -- an ordinary `NostrEvent` object
2. **For channel creation events (kind:40),** parse the content field as JSON to extract channel metadata (name, about, picture)
3. **For channel messages (kind:42),** extract the `e` tags to determine channel association and threading
4. **For metadata updates (kind:41),** parse the content field as JSON and validate the author against the kind:40 creator

Reading chat events is free on TOON -- no ILP payment required for subscriptions.

## Integration with Protocol Core

For the complete TOON write model, read model, and route pricing details, refer to `skills/nostr-protocol-core/references/toon-protocol-context.md`. This file covers chat-specific extensions; the protocol core covers foundational mechanics shared by all event kinds.
