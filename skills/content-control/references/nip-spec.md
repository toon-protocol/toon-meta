# NIP Specifications: Content Control Events

> **Why this reference exists:** Agents need precise event structures to construct valid content control events. This file covers the wire format for kind:5 (deletion requests, NIP-09), the vanish request convention (NIP-62), and the protected event tag (NIP-70). Understanding these structures prevents malformed events that waste ILP payment on rejected publishes.

## kind:5 -- Event Deletion Request (NIP-09)

kind:5 is a **regular event** (non-replaceable). Each deletion request creates a new, permanent event that asks relays to delete the referenced events. Only the original author of the referenced events can request their deletion.

### Event Structure (Deleting Specific Events by ID)

```
{
  "kind": 5,
  "content": "these posts were published in error",
  "tags": [
    ["e", "<event-id-hex-1>"],
    ["e", "<event-id-hex-2>"],
    ["k", "1"]
  ]
}
```

### Event Structure (Deleting Replaceable Events by Address)

```
{
  "kind": 5,
  "content": "removing outdated article",
  "tags": [
    ["a", "<kind>:<pubkey>:<d-tag-value>"],
    ["k", "30023"]
  ]
}
```

### Content Field

The `content` field optionally contains a human-readable reason for the deletion. Clients MAY display this reason. If no reason is needed, set content to an empty string.

### Tag Reference

| Tag | Required | Description |
|-----|----------|-------------|
| `e` | Conditional | Event ID(s) to delete. Use for regular and non-parameterized replaceable events. At least one `e` or `a` tag is required. |
| `a` | Conditional | Replaceable event address(es) to delete. Format: `<kind>:<pubkey>:<d-tag>`. Use for parameterized replaceable events (e.g., kind:30023 articles). At least one `e` or `a` tag is required. |
| `k` | Yes | The event kind being deleted, as a string (e.g., `"1"`, `"30023"`, `"7"`). Required so relays know what kind of events the `e` and `a` tags reference. |

### Deletion Semantics

- **Author-only:** A kind:5 event is only valid if its `pubkey` matches the `pubkey` of the events being deleted. Relays MUST ignore deletion requests from non-authors.
- **Relay compliance is voluntary:** Relays SHOULD delete the referenced events, but compliance is not guaranteed. Some relays may keep events and simply stop serving them. Others may ignore deletion requests entirely.
- **Deletion is not erasure:** Once an event has been distributed to multiple relays and clients, a kind:5 event cannot guarantee complete removal. Other parties may have cached copies.
- **Deleting a deletion:** A kind:5 event can itself be targeted by another kind:5 event, but this does not "undelete" the originally deleted events.
- **Multiple events per request:** A single kind:5 event can reference multiple `e` tags and/or `a` tags, enabling batch deletion in a single event (and a single ILP payment on TOON).
- **Undoing reactions:** To undo a kind:7 reaction, publish a kind:5 event with an `e` tag pointing to the reaction event ID and a `k` tag with `"7"`.

### Filtering and Querying Deletion Requests

- **Deletion requests for a specific event:** `{ kinds: [5], "#e": ["<event-id>"] }`
- **All deletion requests by an author:** `{ kinds: [5], authors: ["<pubkey>"] }`
- **Deletion requests for a specific kind:** `{ kinds: [5], "#k": ["<kind-string>"] }`

## Request to Vanish (NIP-62)

NIP-62 extends NIP-09 with a convention for requesting complete content removal. A vanish request is a kind:5 event with specific tag conventions that signal the user wants ALL their content removed from all relays.

### Event Structure

```
{
  "kind": 5,
  "content": "Requesting account deletion",
  "tags": [
    ["relay", "wss://relay1.example.com"],
    ["relay", "wss://relay2.example.com"]
  ]
}
```

### Vanish Request Semantics

- **Stronger signal:** A vanish request is a more emphatic version of NIP-09 deletion. It signals that the user wants to leave the network entirely, not just delete specific events.
- **Relay tags optional:** The `relay` tags indicate which relays the user has published to, helping the vanish request reach the right relays. If omitted, the request applies to any relay that receives it.
- **No `e` or `a` tags needed:** Unlike a standard kind:5, a vanish request does not need to enumerate specific events. The absence of `e`/`a` tags combined with the vanish signal tells relays to delete ALL events from this pubkey.
- **Relay compliance:** Relays that support NIP-62 SHOULD delete all stored events from the requesting pubkey and stop accepting new events from that pubkey. Compliance is voluntary.
- **Irreversible intent:** A vanish request signals permanent departure. Relays that honor it may refuse future events from the same pubkey. This is the "delete my account" equivalent in decentralized Nostr.
- **Social weight:** Issuing a vanish request is a significant social signal. It should only be used when genuinely intending to leave the network, not as a dramatic gesture.

## Protected Events -- The `-` Tag (NIP-70)

NIP-70 defines a simple tag that controls event distribution. When the `-` tag is present in an event's tags array, relays SHOULD only accept the event directly from the event's author.

### Tag Format

```
["-"]
```

A single-element array containing the string `"-"`. Added to the `tags` array of any event.

### Event Structure (Protected Short Note)

```
{
  "kind": 1,
  "content": "This note should only appear on relays I directly publish to.",
  "tags": [
    ["-"]
  ]
}
```

### Event Structure (Protected Article)

```
{
  "kind": 30023,
  "content": "Article content here...",
  "tags": [
    ["d", "my-article-slug"],
    ["title", "My Protected Article"],
    ["-"]
  ]
}
```

### Protected Event Semantics

- **Author-direct-only:** Relays receiving a protected event SHOULD verify that the event was submitted by the event's author (i.e., the pubkey of the submitting connection matches the event's `pubkey`). If the event was submitted by a third party (relay-to-relay sync, client rebroadcasting someone else's event), the relay SHOULD reject it.
- **Prevents rebroadcasting:** The primary purpose is to prevent relay-to-relay event propagation that the author did not intend. On standard Nostr, events freely propagate across relays. The `-` tag restricts this.
- **Does not encrypt:** The `-` tag does not provide confidentiality. Anyone who connects to the relay where the event exists can read it. It only controls which relays accept the event.
- **Proactive, not retroactive:** The `-` tag must be present when the event is first published. It cannot be added after the fact to already-distributed events.
- **Applies to any event kind:** The `-` tag can be added to events of any kind -- notes (kind:1), articles (kind:30023), reactions (kind:7), metadata (kind:0), etc.
- **Relay enforcement required:** The protection depends on relay-side enforcement. A relay that does not implement NIP-70 will accept the event from anyone, effectively ignoring the `-` tag.
- **Minimal size impact:** The `-` tag adds approximately 10 bytes to the serialized event, making the fee impact on TOON negligible.

### Combining Protection with Other Features

- **Protected deletion requests:** A kind:5 with a `-` tag ensures the deletion request itself is not rebroadcast to relays where the author did not publish.
- **Protected profile updates:** A kind:0 with a `-` tag limits profile metadata distribution to relays the author directly publishes to.
- **Protected reactions:** A kind:7 with a `-` tag keeps reactions on specific relays without relay-to-relay propagation.
