# NIP-28 Specification: Public Chat

> **Why this reference exists:** NIP-28 defines a public chat channel model using five event kinds (40-44). Agents need to understand channel identity (kind:40 event ID), the tag structures for messages and threading, the metadata update authorization model, and the personal moderation tools (hide/mute). This reference covers the protocol mechanics that govern how chat channels work on any Nostr relay, with TOON-specific extensions covered in toon-extensions.md.

## Channel Model Overview

NIP-28 public chat uses a simple channel model:

1. **A channel is created** by publishing a kind:40 event with channel metadata as JSON content
2. **The kind:40 event ID becomes the channel identifier** -- all messages and metadata updates reference this ID
3. **Messages are published** as kind:42 events with `e` tag referencing the channel
4. **Metadata can be updated** via kind:41 events, but only from the original channel creator
5. **Personal moderation** is available via kind:43 (hide message) and kind:44 (mute user)

This is fundamentally different from NIP-29 relay groups (where the relay enforces membership and controls group state) and NIP-72 moderated communities (where moderators approve posts before they appear in the curated feed). NIP-28 channels are open by default -- anyone can read and write.

## Channel Creation (kind:40)

Channel creation events are **regular events** (not replaceable). The kind:40 event ID permanently identifies the channel.

**Structure:**
- **Kind:** 40
- **Content:** JSON string with channel metadata: `{"name": "<channel name>", "about": "<channel description>", "picture": "<channel picture URL>"}`
- **Tags:** Standard event tags (no special tags required)

**Content JSON fields:**
- `name` (required): Channel display name
- `about` (optional): Channel description explaining purpose and rules
- `picture` (optional): URL to channel avatar image

The `about` field serves as the channel's description and implicit rules. Well-crafted channel descriptions help participants understand the channel's purpose and expected norms.

## Channel Metadata Update (kind:41)

Metadata updates allow the channel creator to change channel name, description, or picture after creation.

**Structure:**
- **Kind:** 41
- **Content:** JSON string with updated metadata fields (same format as kind:40 content)
- **Tags:** `["e", "<kind:40-event-id>", "<relay-url>"]` -- references the channel being updated

**Authorization rule:** Clients should only accept kind:41 metadata updates where the event author matches the kind:40 channel creation event author. Metadata updates from non-creators should be ignored. This prevents unauthorized channel hijacking.

**Recommended relay behavior:** Relays may enforce the creator-only rule by rejecting kind:41 events from non-creators, but this is client-side validation in the spec.

## Channel Message (kind:42)

Channel messages are the primary content in chat channels.

**Structure:**
- **Kind:** 42
- **Content:** Plain text message
- **Tags:**
  - Root marker (required): `["e", "<kind:40-event-id>", "<relay-url>", "root"]` -- identifies which channel this message belongs to
  - Reply marker (optional): `["e", "<kind:42-event-id>", "<relay-url>", "reply"]` -- identifies the message being replied to (for threading)
  - Author tag (optional): `["p", "<replied-to-pubkey>"]` -- identifies the user being replied to

**Tag marker semantics:**
- The `"root"` marker on the `e` tag is critical -- it tells clients which channel this message belongs to. Without the root marker, clients cannot reliably associate the message with a channel.
- The `"reply"` marker enables threading within channels. A message can reference both the channel (root) and a specific message (reply) simultaneously.
- The `p` tag notifies the replied-to user and enables clients to highlight replies directed at them.

**Threading model:**
- A direct channel message: one `e` tag with `"root"` marker pointing to the kind:40 event
- A reply to a channel message: two `e` tags -- one with `"root"` marker (channel) and one with `"reply"` marker (parent message), plus a `p` tag for the parent author

## Hide Message (kind:43)

Hide message events allow users to hide specific messages from their own view. This is a **personal moderation tool**, not global censorship.

**Structure:**
- **Kind:** 43
- **Content:** Optional JSON string: `{"reason": "<reason for hiding>"}`
- **Tags:** `["e", "<kind:42-event-id>"]` -- references the message to hide

**Behavior:**
- The relay hides the referenced message for the requesting user only
- Other users continue to see the message normally
- The `reason` field is optional and informational
- Hiding is user-specific -- it does not affect other channel participants

## Mute User (kind:44)

Mute user events allow users to mute specific users, hiding all their messages from view. This is also a **personal moderation tool**.

**Structure:**
- **Kind:** 44
- **Content:** Optional JSON string: `{"reason": "<reason for muting>"}`
- **Tags:** `["p", "<user-pubkey>"]` -- references the user to mute

**Behavior:**
- The relay mutes the referenced user for the requesting user only
- Other users continue to see the muted user's messages
- The `reason` field is optional and informational
- Muting is user-specific -- it does not affect other channel participants

## Channel Discovery

Clients discover channels by subscribing to kind:40 events:

- **All channels on a relay:** Filter `kinds: [40]`
- **Specific channel:** Filter `ids: ["<kind:40-event-id>"]`
- **Channel messages:** Filter `kinds: [42]` with `#e: ["<kind:40-event-id>"]`
- **Channel metadata updates:** Filter `kinds: [41]` with `#e: ["<kind:40-event-id>"]`

## Event Kind Summary

| Kind | Name | Type | Content Format | Key Tags |
|------|------|------|---------------|----------|
| 40 | Channel Creation | Regular | JSON (name, about, picture) | None required |
| 41 | Channel Metadata | Regular | JSON (updated fields) | `e` tag (channel ref) |
| 42 | Channel Message | Regular | Plain text | `e` tag (root + optional reply), `p` tag |
| 43 | Hide Message | Regular | Optional JSON (reason) | `e` tag (message ref) |
| 44 | Mute User | Regular | Optional JSON (reason) | `p` tag (user ref) |

All five event kinds are regular events (not replaceable, not parameterized replaceable). They accumulate over time rather than replacing previous versions.
