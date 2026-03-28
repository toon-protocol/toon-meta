# NIP-17 Specification: Private Direct Messages

> **Why this reference exists:** Agents need precise knowledge of the kind:14 event structure, tag semantics, group DM model, and the relationship between NIP-17 and the underlying NIP-44/NIP-59 layers. This file covers the NIP-17 protocol mechanics -- the DM-specific event kind and delivery model. For NIP-44 encryption primitives and NIP-59 gift wrap structure, see the `encrypted-messaging` skill's nip-spec.md.

## Overview

NIP-17 defines private direct messages using kind:14 events delivered via NIP-59 gift wrap. It replaces the deprecated NIP-04 DMs (kind:4) which leaked metadata (sender, recipient, timestamps) and used weak encryption (AES-256-CBC without authentication or padding).

NIP-17's key improvement: the kind:14 message is never published directly. It exists only as an unsigned "rumor" inside the encrypted layers of a gift wrap. Observers see only kind:1059 gift wrap events with an ephemeral sender and the recipient's pubkey -- they cannot determine who sent the message, what it says, or when it was actually written.

## Kind:14 -- Private Direct Message

Kind:14 is the inner event (rumor) for a private DM. It is constructed but never signed and never published directly to relays.

### Event Structure

```
{
  "pubkey": "<real-sender-pubkey>",
  "created_at": <real-unix-timestamp>,
  "kind": 14,
  "tags": [
    ["p", "<recipient-pubkey>", "<relay-url-hint>"],
    ["e", "<replied-to-event-id>", "<relay-url-hint>", "reply"],
    ["subject", "conversation topic"]
  ],
  "content": "The actual message text in plaintext"
}
```

Note: No `id` or `sig` fields. The event is unsigned to provide plausible deniability -- the recipient cannot prove to a third party that the sender authored the message.

### Tag Reference

| Tag | Required | Format | Description |
|-----|----------|--------|-------------|
| `p` | Yes | `["p", "<pubkey>", "<relay-hint>"]` | Recipient pubkey. One tag per recipient. Relay hint is optional but recommended for delivery. |
| `e` | No | `["e", "<event-id>", "<relay-hint>", "reply"]` | Reference to a previous message being replied to. Use `reply` marker for threading. |
| `q` | No | `["q", "<event-id>", "<relay-hint>"]` | Reference to a quoted event (inline quote). |
| `subject` | No | `["subject", "<topic>"]` | Conversation subject. Include only on the first message of a new conversation. Subsequent replies inherit the subject. |

### Content Field

The content field contains the plaintext message text. It is not encrypted at the kind:14 level -- encryption is handled by the NIP-59 gift wrap layers around it. The content can include `nostr:` URIs (NIP-27) for inline references to other events, profiles, or addresses.

## Delivery Model

NIP-17 DMs are delivered using the NIP-59 gift wrap protocol. The complete flow:

### Sending a 1:1 DM

1. Construct a kind:14 event with one `p` tag (the recipient)
2. Wrap in a kind:1060 seal (NIP-44 encrypted with sender's key + recipient's pubkey, signed by sender, randomized timestamp)
3. Wrap in a kind:1059 gift wrap (NIP-44 encrypted with fresh ephemeral key + recipient's pubkey, signed by ephemeral key, randomized timestamp, `p` tag with recipient)
4. Publish the kind:1059 gift wrap to the recipient's preferred relays

### Receiving a DM

1. Subscribe to kind:1059 events with `#p` filter matching your pubkey
2. Decrypt the gift wrap layer (your private key + ephemeral pubkey) to get the kind:1060 seal
3. Decrypt the seal layer (your private key + real author pubkey) to get the kind:14 rumor
4. Parse the kind:14 to read the message content and metadata

### Reply Threading

To reply to a DM, include an `e` tag with the `reply` marker referencing the event ID of the message being replied to. Note: this references the event ID of the kind:14 rumor (computed from its serialized fields), not the ID of the kind:1059 gift wrap.

```
["e", "<kind-14-event-id>", "<relay-hint>", "reply"]
```

Clients reconstruct conversation threads by following `e` tag chains across decrypted kind:14 events.

## Group DMs

NIP-17 supports group direct messages using multiple `p` tags on the kind:14 event.

### Group DM Structure

```
{
  "pubkey": "<sender-pubkey>",
  "created_at": <real-timestamp>,
  "kind": 14,
  "tags": [
    ["p", "<recipient-1-pubkey>", "<relay-hint>"],
    ["p", "<recipient-2-pubkey>", "<relay-hint>"],
    ["p", "<recipient-3-pubkey>", "<relay-hint>"],
    ["p", "<sender-own-pubkey>", "<relay-hint>"],
    ["subject", "Group topic"]
  ],
  "content": "Message to the group"
}
```

### Key Rules for Group DMs

1. **All participants listed:** Every participant -- including the sender -- should have a `p` tag. This lets recipients identify all group members.
2. **Separate gift wraps:** The sender creates a separate kind:1059 gift wrap for each recipient. Each gift wrap has its own fresh ephemeral key.
3. **Self-delivery:** The sender also creates a gift wrap addressed to themselves (with their own pubkey in the `p` tag). This ensures their own inbox has a copy of the sent message.
4. **Consistent inner event:** The same kind:14 rumor (with identical content and tags) is used for all gift wraps in a group DM. Only the outer encryption layers differ per recipient.

### Group Identification

Group DMs are identified by their participant set -- the combination of all `p` tag pubkeys. Clients group messages into conversations by matching the set of `p` tags across decrypted kind:14 events.

There is no explicit "group ID" or "group creation" event. A group DM conversation emerges from the consistent use of the same `p` tag set across messages.

## Conversation Identification

### 1:1 Conversations

A 1:1 conversation is identified by the pair of pubkeys (sender + recipient). All kind:14 events between two parties with matching `p` tags form a single conversation thread.

### Subject-Based Threading

The `subject` tag provides an optional conversation topic. When present on the first message, subsequent replies in the thread inherit the subject context. Clients may use the subject to visually group or label conversation threads.

The subject tag should only appear on conversation-initiating messages. Including it on every reply wastes bytes (relevant on TOON where every byte costs money).

## Relationship to NIP-04 (Deprecated)

NIP-17 replaces NIP-04 DMs entirely. Key differences:

| Property | NIP-04 (Deprecated) | NIP-17 |
|----------|---------------------|--------|
| Event kind | kind:4 | kind:14 (inner), kind:1059 (published) |
| Encryption | AES-256-CBC (NIP-04) | XChaCha20-Poly1305 (NIP-44) |
| Sender visible | Yes (pubkey on kind:4) | No (hidden behind ephemeral key) |
| Recipient visible | Yes (`p` tag on kind:4) | Partially (recipient `p` tag on kind:1059) |
| Timestamp visible | Yes (kind:4 `created_at`) | No (randomized on seal and gift wrap) |
| Padding | None (length leaked) | Power-of-2 padding |
| Authentication | None | Poly1305 MAC |
| Group DMs | Not supported | Multiple `p` tags + per-recipient wrapping |
| Plausible deniability | No (kind:4 is signed) | Yes (kind:14 rumor is unsigned) |

## Relay Behavior

Relays that support NIP-17:
- MUST NOT publish kind:14 events directly (reject if received as a standalone event)
- Should store kind:1059 gift wrap events and deliver them to subscribers matching the `p` tag filter
- Cannot read, search, or index the encrypted content of gift wraps
- May implement NIP-17 support alongside NIP-04 during the transition period

## Security Properties

- **Sender anonymity:** The published kind:1059 has an ephemeral pubkey, hiding the real sender
- **Content confidentiality:** Two layers of NIP-44 encryption protect the message content
- **Timing privacy:** Randomized timestamps on seal and gift wrap prevent timing analysis
- **Plausible deniability:** The kind:14 rumor is unsigned -- the sender cannot be cryptographically proven to have authored the message to a third party
- **Forward secrecy (per-message):** Each NIP-44 encryption uses a unique random nonce
- **No message linking:** Each gift wrap uses a fresh ephemeral key, preventing correlation of messages from the same sender
