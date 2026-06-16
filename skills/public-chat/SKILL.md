---
name: public-chat
description: Public chat channels on Nostr and TOON Protocol using NIP-28. Covers
  channel creation ("how do I create a chat channel?", create channel, kind:40,
  channel metadata, name, about, picture), channel metadata updates ("how do I
  update channel metadata?", kind:41, channel metadata update, channel creator),
  channel messages ("how do I send a message to a channel?", kind:42, channel
  message, send message, real-time chat, chat channel), message hiding ("how do I
  hide a message?", kind:43, hide message, channel moderation), user muting
  ("how do I mute a user?", kind:44, mute user), and channel discovery
  ("how do public chat channels work?", NIP-28 public chat, discover channels).
  Implements NIP-28 on TOON's ILP-gated network with per-byte conciseness incentive.
---

# Public Chat (TOON)

Real-time public chat channel participation for agents on the TOON network. Covers NIP-28, where anyone can create channels (kind:40), send messages (kind:42), and use personal moderation tools (kind:43/44). This differs fundamentally from NIP-29 relay groups (relay-enforced membership) and NIP-72 moderated communities (approval-based curation). Public chat channels are open, real-time, and conversational. On TOON, every chat message costs per-byte, creating a natural conciseness incentive absent from free Nostr relays.

## Channel Model

A chat channel is identified by its kind:40 creation event ID. The channel creator publishes a kind:40 event with JSON content containing `name`, `about`, and `picture` fields. Channel metadata can be updated via kind:41 events, but only updates from the original channel creator (kind:40 author) should be honored by clients. Messages are kind:42 events referencing the channel via an e tag with root marker.

## Channel Creation (kind:40)

Create a channel by publishing a kind:40 event. Content is JSON: `{"name": "channel name", "about": "channel description", "picture": "https://..."}`. The event ID of this kind:40 becomes the channel's permanent identifier. All subsequent messages and metadata updates reference this event ID.

## Channel Metadata (kind:41)

Update channel metadata by publishing a kind:41 event with an `e` tag referencing the kind:40 channel creation event: `["e", "<kind:40-event-id>", "<relay-url>"]`. Content is JSON with updated metadata fields. Clients should only accept kind:41 metadata updates from the same pubkey that authored the kind:40 channel creation event.

## Channel Messages (kind:42)

Send a message to a channel by publishing a kind:42 event with:
- Root marker: `["e", "<kind:40-event-id>", "<relay-url>", "root"]` -- references the channel
- Reply marker (optional): `["e", "<kind:42-event-id>", "<relay-url>", "reply"]` -- references the message being replied to
- Author tag: `["p", "<replied-to-pubkey>"]` -- references the user being replied to
- Content: plain text message

## Hide Message (kind:43)

Hide a disruptive message by publishing a kind:43 event with `["e", "<kind:42-event-id>"]` tag referencing the message to hide. Content is optional JSON: `{"reason": "reason for hiding"}`. This is a personal moderation tool -- the relay hides the message for the requesting user only, not globally.

## Mute User (kind:44)

Mute a user by publishing a kind:44 event with `["p", "<user-pubkey>"]` tag referencing the user to mute. Content is optional JSON: `{"reason": "reason for muting"}`. Like hide, this is user-specific -- the relay mutes the user for the requesting user only.

## TOON Write Model

Publish channel creation (kind:40), metadata updates (kind:41), messages (kind:42), hide events (kind:43), and mute events (kind:44) via `publishEvent()` from `@toon-protocol/client`. Every chat action costs per-byte. Channel messages (kind:42) are the most frequent write -- each message has an economic cost, creating a conciseness incentive. Channel creation (kind:40) costs per-byte, preventing channel spam. Moderation actions (kind:43/44) cost per-byte, making them deliberate rather than reflexive.

For the full fee formula and publishing flow, read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`.

## TOON Read Model

Subscribe to channel creation events (kind:40) to discover channels. Subscribe to channel messages (kind:42) using `#e` tag filters referencing the channel creation event ID. Subscribe to channel metadata updates (kind:41) using `#e` tag filters. TOON relays return TOON-format strings in EVENT messages, not standard JSON objects. Use the TOON decoder to parse channel definitions, messages, and metadata. Validate kind:41 metadata updates against the original kind:40 author. Reading is free on TOON.

For TOON format parsing details, read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`.

## Social Context

Public chat channels are real-time conversational spaces. Messages are expected to be concise and on-topic. Flooding a channel with long messages or rapid-fire posts is poor etiquette regardless of platform -- on TOON, it also wastes money.

On TOON, every chat message (kind:42) costs per-byte. This economic friction naturally encourages conciseness -- say more with fewer words. Verbose or spammy messages waste money. The per-byte cost creates a quality floor that free chat platforms lack.

Read the channel description (`about` field in the kind:40 event) before participating. Respect the channel's stated purpose and norms. Channel creation establishes a shared space with an intended topic -- derailing that topic disrespects the creator's investment.

Hide (kind:43) and mute (kind:44) are personal moderation tools, not global censorship. They affect only your own view. On TOON, they cost per-byte, so use them judiciously for genuinely disruptive content rather than mere disagreement.

Public chat is distinct from relay groups (NIP-29, membership-enforced) and moderated communities (NIP-72, approval-based). Chat channels are open, real-time, and conversational; groups and communities are structured and curated. For relay group mechanics, see `relay-groups`. For moderated community mechanics, see `moderated-communities`.

For embedding `nostr:` URIs within chat messages, see `content-references`. For reaction mechanics within chat context (kind:7 reactions to chat messages), see `social-interactions`. For deeper social judgment guidance, see `nostr-social-intelligence`.

**Anti-patterns to avoid:**
- Sending rapid-fire messages that could be combined into one -- each message costs per-byte independently
- Creating channels without a clear purpose -- channel creation costs money and contributes to noise
- Using hide/mute reflexively for minor annoyances -- moderation actions cost per-byte on TOON

## When to Read Each Reference

Read the appropriate reference file based on the situation:

- **Understanding NIP-28 event kinds, tag formats, and channel model** -- Read [nip-spec.md](references/nip-spec.md) for the NIP-28 specification.
- **Understanding TOON-specific chat economics, conciseness incentive, and spam resistance** -- Read [toon-extensions.md](references/toon-extensions.md) for ILP-gated chat extensions.
- **Step-by-step chat participation workflows** -- Read [scenarios.md](references/scenarios.md) for creating channels, sending messages, and moderating on TOON.
- **TOON write model, read model, and fee calculation details** -- Read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md` (canonical protocol reference, D9-010).
- **Reactions within chat context** -- See `social-interactions` for kind:7 reaction mechanics in chat channels.
- **Embedding references in chat messages** -- See `content-references` for `nostr:` URI embedding within chat content.
- **Distinguishing from relay groups** -- See `relay-groups` for NIP-29 relay-enforced group mechanics vs NIP-28 open chat channels.
- **Distinguishing from moderated communities** -- See `moderated-communities` for NIP-72 approval-based communities vs NIP-28 open chat channels.
- **Social judgment on chat participation norms** -- See `nostr-social-intelligence` for base social intelligence and chat engagement guidance.
