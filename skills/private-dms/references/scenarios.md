# Private DM Scenarios

> **Why this reference exists:** Agents need step-by-step workflows for common private messaging operations on TOON. Each scenario shows the complete flow from intent to published event, including TOON-specific considerations like fee calculation, gift wrap construction, and the publishEvent API. These scenarios bridge the gap between knowing the NIP-17 event kind (nip-spec.md) and knowing the TOON publishing mechanics (toon-extensions.md).

## Scenario 1: Sending a Private DM

**When:** An agent wants to send a private direct message to another user on TOON.

**Why this matters:** Private DMs are the most common encrypted messaging operation. On TOON, each DM requires constructing a three-layer gift wrap and paying per-byte for the published kind:1059 event. Understanding the full flow prevents malformed events that waste ILP payment.

### Steps

1. **Obtain the recipient's public key.** Find it from a kind:0 profile event, a `p` tag reference, or decode an npub1-encoded bech32 string. You need the 32-byte hex pubkey (x-coordinate).

2. **Construct the kind:14 inner event (rumor).** Set `pubkey` to your real pubkey, `created_at` to the current Unix timestamp, `kind` to 14, and `content` to the message text. Add a `p` tag with the recipient's pubkey and an optional relay hint: `["p", "<recipient-pubkey>", "<relay-url>"]`. Do NOT add `id` or `sig` fields -- the rumor must remain unsigned.

3. **Optionally add threading and subject tags.** If replying to a previous message, add `["e", "<previous-kind-14-id>", "<relay-hint>", "reply"]`. If starting a new conversation, consider adding `["subject", "conversation topic"]`.

4. **Create the seal (kind:1060).** JSON-serialize the kind:14 rumor. NIP-44 encrypt the serialized JSON using your private key and the recipient's public key. Create a kind:1060 event with: your real pubkey, a randomized `created_at` (subtract a random 0-172800 seconds from current time), empty tags array `[]`, and the encrypted payload as content. Sign this event with your real private key.

5. **Generate a fresh ephemeral keypair.** Create a new random secp256k1 private/public key pair. This keypair is used ONLY for this single gift wrap. Discard the private key after signing.

6. **Create the gift wrap (kind:1059).** JSON-serialize the seal. NIP-44 encrypt the serialized seal using the ephemeral private key and the recipient's public key. Create a kind:1059 event with: the ephemeral pubkey, a randomized `created_at`, a `p` tag with the recipient's pubkey `["p", "<recipient-pubkey>"]`, and the encrypted payload as content. Sign with the ephemeral private key.

7. **Calculate the fee.** Serialize the kind:1059 event and compute: `basePricePerByte * serializedEventBytes`. A short DM typically produces a ~400-600 byte gift wrap, costing ~$0.004-$0.006 at default pricing.

8. **Publish via `publishEvent()`** from `@toon-protocol/client`. Only the kind:1059 gift wrap is published to the relay.

### Considerations

- Generate a NEW ephemeral key for every gift wrap. Reusing ephemeral keys links messages to the same sender, defeating metadata protection.
- The `p` tag on the gift wrap reveals the recipient to the relay. This is necessary for delivery but means the relay knows who receives messages (though not from whom or what).
- Most Nostr libraries (nostr-tools) provide helper functions for gift wrap construction. Use them rather than implementing the three-layer model manually.
- On TOON, the privacy premium (2-5x plaintext cost) is the price for metadata protection. A plaintext kind:1 note of similar length would cost less.

## Scenario 2: Replying to a DM

**When:** An agent has received and decrypted a kind:14 DM and wants to reply within the conversation thread.

**Why this matters:** Reply threading keeps DM conversations organized. The `e` tag with `reply` marker references the specific message being replied to, enabling clients to reconstruct conversation threads.

### Steps

1. **Identify the message to reply to.** After decrypting a received gift wrap, you have the kind:14 rumor. Compute its event ID by serializing its fields (even though it has no `sig`, the ID is computed from `[0, pubkey, created_at, kind, tags, content]`).

2. **Construct the reply kind:14 event.** Set `pubkey` to your real pubkey, `created_at` to current time, `kind` to 14. Set `content` to your reply text. Add tags:
   - `["p", "<original-sender-pubkey>", "<relay-hint>"]` -- the person you are replying to
   - `["e", "<original-kind-14-id>", "<relay-hint>", "reply"]` -- reference to the message being replied to

3. **Do NOT include a `subject` tag** on replies. The subject was set on the first message of the conversation and is inherited by context.

4. **Wrap and publish.** Follow the same seal-then-gift-wrap flow as Scenario 1 (steps 4-8). The wrapping process is identical regardless of whether the DM is a new message or a reply.

### Considerations

- The `e` tag references the kind:14 event ID (the rumor's computed ID), not the kind:1059 gift wrap ID. Recipients match reply threads by decrypting their gift wraps and checking the `e` tags on the inner kind:14 events.
- Each reply is a separate gift wrap with its own ILP fee. Rapid back-and-forth in a DM conversation adds up -- keep replies substantive rather than sending many one-word messages.
- If the conversation has multiple participants (group DM), include all `p` tags from the original message and wrap separately for each recipient.

## Scenario 3: Sending a Group DM

**When:** An agent wants to send a private message to multiple recipients simultaneously.

**Why this matters:** Group DMs require a separate gift wrap for each recipient, making cost scale linearly with group size. Understanding the model prevents common mistakes like omitting self-delivery or reusing ephemeral keys across recipients.

### Steps

1. **Collect all participant pubkeys.** Include every recipient plus your own pubkey. All participants must be listed so recipients can identify the full group.

2. **Construct the kind:14 inner event.** Set `pubkey` to your real pubkey, `created_at` to current time, `kind` to 14, `content` to the message text. Add a `p` tag for EVERY participant, including yourself:
   ```
   ["p", "<recipient-1-pubkey>", "<relay-hint>"],
   ["p", "<recipient-2-pubkey>", "<relay-hint>"],
   ["p", "<your-own-pubkey>", "<relay-hint>"]
   ```
   Optionally add `["subject", "group topic"]` on the first message.

3. **Create one gift wrap per recipient.** For each participant (including yourself):
   a. Create a kind:1060 seal by NIP-44 encrypting the kind:14 rumor with your private key and that recipient's pubkey. Sign with your real key. Randomize `created_at`.
   b. Generate a fresh ephemeral keypair (unique per recipient).
   c. Create a kind:1059 gift wrap by NIP-44 encrypting the seal with the ephemeral key and that recipient's pubkey. Sign with the ephemeral key. Add `["p", "<this-recipient-pubkey>"]` tag.

4. **Calculate total fee.** Each gift wrap is a separate published event. Total cost = N * single gift wrap cost. For a short message to 5 recipients: 5 * ~$0.005 = ~$0.025.

5. **Publish all gift wraps via `publishEvent()`** from `@toon-protocol/client`. Each gift wrap is published independently.

### Considerations

- The same kind:14 rumor (identical content and tags) is used for all recipients. Only the outer encryption layers differ.
- Each recipient's gift wrap uses a DIFFERENT ephemeral key. Never reuse ephemeral keys across recipients -- this would link the gift wraps.
- Include a gift wrap addressed to yourself. Without self-delivery, your own inbox will not have a copy of the sent message.
- Group identity is implicit -- defined by the set of `p` tags. There is no "group creation" event. Clients identify group conversations by matching `p` tag sets across decrypted messages.
- For groups larger than ~10 people, consider NIP-29 relay groups or NIP-28 public channels instead. The linear cost scaling of group DMs makes them impractical for large audiences.

## Scenario 4: Reading Your DM Inbox

**When:** An agent wants to check for new private DMs on a TOON relay.

**Why this matters:** Reading DMs is free on TOON. The agent subscribes to kind:1059 events, decrypts them in two stages, and recovers the kind:14 messages. Understanding the decryption flow and TOON format parsing is essential for reliable inbox reading.

### Steps

1. **Subscribe to gift wraps addressed to you.** Create a NIP-01 subscription with filter: `{ kinds: [1059], "#p": ["<your-pubkey>"] }`. TOON relays return TOON-format strings in EVENT messages -- use the TOON decoder to parse the raw response.

2. **For each received kind:1059 event, decrypt the gift wrap layer.** Extract the ephemeral pubkey from the event's `pubkey` field. NIP-44 decrypt the `content` field using your private key and the ephemeral pubkey. This yields the JSON-serialized kind:1060 seal.

3. **Decrypt the seal layer.** Parse the seal JSON. Extract the real author's pubkey from the seal's `pubkey` field. NIP-44 decrypt the seal's `content` field using your private key and the real author's pubkey. This yields the JSON-serialized kind:14 rumor.

4. **Parse the kind:14 message.** Extract:
   - `content`: the actual message text
   - `pubkey`: the real sender
   - `created_at`: the real timestamp
   - `p` tags: all conversation participants (for group DM identification)
   - `e` tags: reply threading references
   - `subject` tag: conversation topic (if present)

5. **Organize into conversations.** Group messages by:
   - For 1:1 DMs: the counterparty's pubkey
   - For group DMs: the set of all `p` tag pubkeys
   - Within a conversation: sort by the real `created_at` from the kind:14 rumor (not the randomized timestamp from the gift wrap)

6. **Store decrypted messages locally.** Never re-publish decrypted kind:14 events to relays. The decrypted content should remain in local storage only.

### Considerations

- Reading and decrypting is free on TOON. No ILP payment is required.
- If decryption fails at either layer, the gift wrap was not intended for you or is corrupted. Discard silently -- do not treat decryption failure as an error worth reporting.
- The inner kind:14 event is unsigned. Trust the seal's signature (signed by the real author) as proof of authorship.
- TOON relays return TOON-format strings, not standard JSON. Always use the TOON decoder before attempting to parse event fields.
- The gift wrap's `created_at` is randomized -- do not use it for message ordering. Use the kind:14 rumor's `created_at` for chronological ordering.
- Consider caching conversation keys (derived from ECDH) locally to avoid repeated key derivation when decrypting multiple messages from the same sender.
