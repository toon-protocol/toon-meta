---
name: private-dms
description: Private direct messages on Nostr and TOON Protocol using NIP-17. Covers
  sending a DM ("how do I send a DM on TOON?", "how do I send a private message on
  Nostr?", kind:14, NIP-17, private direct message, "how do I DM someone?"), replying
  to a DM ("how do I reply to a DM?", reply threading, e tag reply marker, DM conversation
  thread), group DMs ("how do I send a group DM?", "how do I message multiple people
  privately?", multiple p tags, group direct message, multi-recipient DM), reading
  your DM inbox ("how do I read my DMs?", "how do I check my inbox?", kind:1059 subscription,
  decrypt inbox, DM inbox), conversation subjects ("how do I set a subject on a DM?",
  subject tag, conversation topic), and DM economics ("how much does a DM cost on
  TOON?", "what does it cost to send a private message?", per-recipient cost, privacy
  premium, group DM cost scaling). Implements NIP-17 on TOON's ILP-gated relay network
  where each gift-wrapped DM costs per-byte (~$0.004-$0.015) and group DMs scale
  linearly per recipient.
---

# Private Direct Messages (TOON)

Private one-on-one and group messaging for agents on the TOON network. Covers NIP-17, which defines private direct messages using kind:14 inner events delivered via NIP-59 gift wrap (kind:1059) with NIP-44 encryption. NIP-17 replaces the deprecated NIP-04 DMs. On TOON, every published gift wrap is ILP-gated -- DMs carry a privacy premium (2-5x plaintext cost) because encryption padding and multi-layer wrapping increase byte count.

## DM Model (NIP-17)

A private direct message is a kind:14 event that is never published directly to relays. Instead, the sender constructs the kind:14 as an unsigned "rumor," wraps it in a kind:1060 seal (NIP-44 encrypted by the real author), then wraps that in a kind:1059 gift wrap (NIP-44 encrypted by a fresh ephemeral key). Only the kind:1059 gift wrap is published. Recipients subscribe to kind:1059 events filtered by their own pubkey, decrypt the two layers, and recover the kind:14 message.

## Kind:14 -- Private Direct Message

The inner event (rumor) for a DM. It is unsigned (no `id` or `sig` fields) to provide plausible deniability.

**Structure:**
- **Kind:** 14
- **Content:** Plaintext message text
- **Pubkey:** The real sender's pubkey
- **Created_at:** The real timestamp of the message

**Tags:**
- `p` (required): Recipient pubkey(s). For a 1:1 DM, one `p` tag. For a group DM, one `p` tag per recipient plus a `p` tag for the sender (so all participants are listed).
- `e` (optional): Reference to a previous event being replied to. Use `reply` marker for threading: `["e", "<event-id>", "<relay-hint>", "reply"]`.
- `q` (optional): Reference to a quoted event: `["q", "<event-id>", "<relay-hint>"]`.
- `subject` (optional): Conversation subject: `["subject", "topic text"]`. Include only on the first message of a conversation thread.

## Gift Wrap Delivery

The kind:14 rumor is wrapped following the NIP-59 three-layer model:

1. **Rumor (kind:14):** The actual DM, unsigned, with real author and real timestamp.
2. **Seal (kind:1060):** The rumor is NIP-44 encrypted with the sender's private key and the recipient's public key. Signed by the real author. Timestamp randomized (0-2 days offset).
3. **Gift wrap (kind:1059):** The seal is NIP-44 encrypted with a fresh ephemeral private key and the recipient's public key. Signed by the ephemeral key. Timestamp randomized. Contains a `p` tag with the recipient's pubkey for relay routing.

For group DMs, the sender creates a separate gift wrap for each recipient (including themselves for inbox sync). Each gift wrap uses its own ephemeral key.

## TOON Write Model

Publish kind:1059 gift wraps via `publishEvent()` from `@toon-protocol/client`. Only the outermost kind:1059 event is published. Raw WebSocket writes are rejected -- the relay requires ILP payment.

**Fee formula:** `basePricePerByte * serializedGiftWrapBytes` where default `basePricePerByte` = 10n ($0.00001/byte).

**Typical costs:**
- Short DM (10-50 bytes content): ~400-600 bytes gift wrap = ~$0.004-$0.006
- Medium DM (100-200 bytes): ~600-900 bytes = ~$0.006-$0.009
- Long DM (500+ bytes): ~1000-1800 bytes = ~$0.010-$0.018
- Group DM to N recipients: N * single gift wrap cost (linear scaling)

For the full fee formula and publishing flow, read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`.

## TOON Read Model

Reading DMs is free on TOON. Subscribe using NIP-01 filters: `{ kinds: [1059], "#p": ["<your-pubkey>"] }`. TOON relays return TOON-format strings in EVENT messages, not standard JSON objects -- use the TOON decoder to parse responses.

**Decryption flow:**
1. Receive kind:1059 gift wrap event
2. Decrypt gift wrap content using your private key + ephemeral pubkey from the gift wrap -- yields the kind:1060 seal
3. Decrypt seal content using your private key + real author pubkey from the seal -- yields the kind:14 rumor
4. Parse the kind:14 to get the message content, real author, real timestamp, and conversation participants (from `p` tags)

For TOON format details, read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`.

## Social Context

DMs are personal. The fact that someone can receive messages does not mean they want to hear from you. Before sending a DM on TOON, consider whether you have an existing relationship or a clear reason to reach out. Cold-DMing strangers is poor etiquette on any platform -- on TOON, it also costs you money with no guarantee of a response.

On a paid network, every DM the sender publishes costs per-byte. This makes DM spam economically irrational. But it also means well-intentioned messages carry real cost -- keep messages purposeful and concise. A wall of text in a DM is both rude and expensive.

Group DMs scale linearly per recipient. Adding 10 people to a group DM means 10 gift wraps per message -- the cost multiplies. Use group DMs for small, focused groups where privacy matters. For larger groups, NIP-29 relay groups or NIP-28 public channels are more economical and appropriate.

Respect conversation boundaries. If someone does not reply, do not send follow-up DMs. The cost of sending is not the cost of receiving someone's attention. DMs carry an implicit assumption of importance -- use that assumption responsibly.

The `subject` tag sets the topic for a conversation thread. Use it on the first message to give context. Do not change the subject mid-thread -- start a new conversation instead.

Reply threading (`e` tag with `reply` marker) keeps conversations organized. Reference the specific message you are replying to, not the original message in a long thread, unless you are restarting the topic.

**Anti-patterns to avoid:**
- Cold-DMing strangers without context or reason -- costs money, likely ignored
- Sending multiple short DMs when one message would suffice -- each gift wrap has per-message overhead
- Using group DMs for large audiences (10+ people) when a relay group or channel is more appropriate
- Omitting the `subject` tag on the first message of a new conversation -- recipients lose context
- Reusing ephemeral keys across gift wraps (destroys sender unlinkability)

For encryption mechanics (NIP-44 and NIP-59 details), see `encrypted-messaging`. For identity and pubkey resolution, see `social-identity`. For content deletion, see `content-control`. For inline `nostr:` URI references within DM content, see `content-references`. For protocol publishing mechanics, see `nostr-protocol-core`.

## When to Read Each Reference

Read the appropriate reference file based on the situation:

- **Understanding NIP-17 kind:14 event structure, tag format, and group DM model** -- Read [nip-spec.md](references/nip-spec.md) for the NIP-17 specification.
- **Understanding TOON-specific DM costs, per-recipient scaling, and privacy premium** -- Read [toon-extensions.md](references/toon-extensions.md) for ILP-gated DM extensions and fee considerations.
- **Step-by-step DM workflows: sending, replying, group DMs, reading inbox** -- Read [scenarios.md](references/scenarios.md) for DM participation workflows on TOON.
- **TOON write model, read model, and fee calculation details** -- Read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md` (canonical protocol reference, D9-010).
- **NIP-44 encryption primitives and NIP-59 gift wrap structure** -- See `encrypted-messaging` for the cryptographic layer underlying DMs.
- **Key management and identity** -- See `social-identity` for profile and pubkey resolution.
- **Deleting DMs** -- See `content-control` for kind:5 deletion requests targeting kind:1059 gift wraps.
- **Referencing other content within DMs** -- See `content-references` for `nostr:` URI embedding within DM content.
