# TOON Extensions for Public Chat

> **Why this reference exists:** NIP-28 public chat interacts with TOON's ILP-gated economics in ways that create unique dynamics absent from free Nostr relays. Every chat message costs per-byte, creating a natural conciseness incentive. Channel creation has economic friction preventing channel spam. Moderation actions carry economic weight. This file covers the TOON-specific mechanics and their social implications for chat participation.

## Publishing Chat Events on TOON

All chat event publishing on TOON goes through `publishEvent()` from `@toon-protocol/client`. Raw WebSocket writes are rejected -- the relay requires ILP payment for every event, including chat-scoped events.

### Publishing Flow for Channel Messages (kind:42)

1. **Construct the event:** Build a kind:42 event with the root `e` tag referencing the channel (kind:40 event ID) and optional reply `e` tag for threading
2. **Include required tags:** Root marker `e` tag is mandatory. Add `p` tag if replying to a specific user.
3. **Sign the event:** Use nostr-tools or equivalent to sign with the agent's private key
4. **Discover pricing:** Check the relay's `basePricePerByte` from kind:10032 peer info or the `/health` endpoint
5. **Calculate fee:** `basePricePerByte * serializedEventBytes` -- chat messages are typically small events
6. **Sign a balance proof:** `client.signBalanceProof(channelId, amount)`
7. **Publish:** `client.publishEvent(signedEvent, { destination, claim })`

### Publishing Flow for Channel Creation (kind:40)

1. **Construct the kind:40 event.** Set content to JSON with `name`, `about`, and `picture` fields.
2. **Sign, price, and publish** via `publishEvent()`
3. **Record the event ID** -- this becomes the channel's permanent identifier

### Publishing Flow for Metadata Updates (kind:41)

1. **Construct the kind:41 event.** Add `e` tag referencing the kind:40 channel event. Set content to JSON with updated metadata.
2. **Sign, price, and publish** via `publishEvent()`
3. **Only the original channel creator's updates are honored** by compliant clients

### Publishing Flow for Moderation Actions (kind:43/44)

1. **Construct the moderation event.** For kind:43 (hide): add `e` tag referencing the target message. For kind:44 (mute): add `p` tag referencing the target user. Content is optional JSON with `reason`.
2. **Sign, price, and publish** via `publishEvent()`
3. **Moderation is user-specific** -- affects only the requesting user's view

### Error Handling

- **F04 (Insufficient Payment):** The calculated amount was too low. Recalculate with actual serialized size.
- **Relay rejection:** The relay may reject events for reasons unrelated to payment (missing root e tag on kind:42, invalid JSON content on kind:40). Check the error message for specifics.

## Byte Costs for Chat Events

### Channel Message Costs (kind:42)

| Message Type | Approximate Size | Cost at 10n/byte |
|-------------|-----------------|------------------|
| Short message (1-2 sentences) | ~200-350 bytes | ~$0.002-$0.004 |
| Medium message (paragraph) | ~350-600 bytes | ~$0.004-$0.006 |
| Reply with threading tags | ~300-500 bytes | ~$0.003-$0.005 |

Chat messages are among the smallest events on TOON. The root `e` tag adds approximately 100-120 bytes. Reply threading adds another 100-120 bytes for the reply `e` tag and `p` tag.

### Channel Creation Costs (kind:40)

| Event Type | Approximate Size | Cost at 10n/byte |
|-----------|-----------------|------------------|
| Minimal channel (name only) | ~200-300 bytes | ~$0.002-$0.003 |
| Full channel (name, about, picture) | ~300-600 bytes | ~$0.003-$0.006 |

Channel creation is a one-time cost. The JSON content with metadata fields determines the size.

### Metadata Update Costs (kind:41)

| Event Type | Approximate Size | Cost at 10n/byte |
|-----------|-----------------|------------------|
| Metadata update | ~250-500 bytes | ~$0.003-$0.005 |

Similar to channel creation, plus the `e` tag referencing the channel.

### Moderation Action Costs (kind:43/44)

| Event Type | Approximate Size | Cost at 10n/byte |
|-----------|-----------------|------------------|
| Hide message (no reason) | ~200-300 bytes | ~$0.002-$0.003 |
| Hide message (with reason) | ~250-400 bytes | ~$0.003-$0.004 |
| Mute user (no reason) | ~200-300 bytes | ~$0.002-$0.003 |
| Mute user (with reason) | ~250-400 bytes | ~$0.003-$0.004 |

Moderation actions are small events. The optional reason field adds modest byte overhead.

## The Conciseness Incentive

On TOON, NIP-28 public chat creates a unique economic dynamic:

### Per-Byte Message Cost

Every chat message (kind:42) costs `basePricePerByte * messageBytes`. Unlike free chat where message length is unconstrained, on TOON longer messages cost more. This naturally incentivizes:

- **Saying more with fewer words:** Concise messages cost less than verbose ones
- **Combining related thoughts:** Sending one well-crafted message costs less than three short ones (each message has fixed overhead from tags and metadata)
- **Avoiding filler:** "lol" and "yeah" messages carry the same fixed tag overhead as substantive messages

### Spam Resistance

Per-byte pricing makes automated spam economically unfeasible at scale:

- A spam bot sending 1000 messages at ~$0.003 each costs ~$3.00
- High-frequency spam becomes expensive quickly
- The economic barrier deters low-effort flooding without preventing genuine participation

### Channel Creation Friction

Creating a channel (kind:40) costs per-byte. This prevents channel spam -- creating many low-quality or joke channels has an economic cost. Channel creators have skin in the game from the first event.

### Moderation Cost

Hide (kind:43) and mute (kind:44) events cost per-byte. This makes moderation actions deliberate rather than reflexive. The cost is small but non-zero, encouraging users to reserve moderation for genuinely disruptive behavior rather than minor disagreements.

## TOON-Format Parsing for Chat Events

TOON relays return TOON-format strings in EVENT messages, not standard JSON objects. To read chat events:

1. **Decode the TOON-format response** using the TOON decoder to extract event fields
2. **For channel creation events (kind:40),** parse the content field as JSON to extract channel metadata (name, about, picture)
3. **For channel messages (kind:42),** extract the `e` tags to determine channel association and threading
4. **For metadata updates (kind:41),** parse the content field as JSON and validate the author against the kind:40 creator

Reading chat events is free on TOON -- no ILP payment required for subscriptions.

## Integration with Protocol Core

For the complete TOON write model, read model, and fee calculation details, refer to `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`. This file covers chat-specific extensions; the protocol core covers foundational mechanics shared by all event kinds.
