# NIP-36 Specification: Sensitive Content / Content Warning

> **Why this reference exists:** Agents need the precise tag format and client behavior requirements to correctly construct content-warned events. This file covers the NIP-36 specification -- the `content-warning` tag, its optional reason field, and the expected client-side display behavior. Understanding this prevents malformed tags that waste ILP payment on TOON.

## The `content-warning` Tag

NIP-36 defines a single tag that marks an event as containing sensitive content. When present, clients SHOULD hide the event's content behind a click-through or expandable warning.

### Tag Format

```
["content-warning", "<optional reason>"]
```

The tag is a standard Nostr tag array. The first element is the string `"content-warning"`. The second element is an optional human-readable reason string explaining why the content is sensitive.

### Minimal Form (No Reason)

```
["content-warning"]
```

A single-element array containing only `"content-warning"`. This signals generic sensitivity without specifying the nature of the content. Clients SHOULD display a generic "Sensitive content" or "Content warning" label.

### With Reason

```
["content-warning", "nudity"]
["content-warning", "violence"]
["content-warning", "spoiler: Breaking Bad season 5"]
["content-warning", "flashing lights"]
["content-warning", "gore"]
["content-warning", "disturbing imagery"]
["content-warning", "strong language"]
["content-warning", "drug use"]
["content-warning", "self-harm"]
["content-warning", "politically sensitive"]
```

The reason string is freeform text. There is no controlled vocabulary -- authors choose their own reason descriptions. Clients SHOULD display the reason text alongside the warning so readers can make an informed decision.

## Event Examples

### Short Note with Content Warning (kind:1)

```
{
  "kind": 1,
  "content": "Graphic description of a car accident I witnessed today...",
  "tags": [
    ["content-warning", "disturbing imagery"]
  ]
}
```

### Short Note with Generic Content Warning (kind:1)

```
{
  "kind": 1,
  "content": "Something that might bother some people...",
  "tags": [
    ["content-warning"]
  ]
}
```

### Long-Form Article with Content Warning (kind:30023)

```
{
  "kind": 30023,
  "content": "Full article text with sensitive discussion...",
  "tags": [
    ["d", "my-sensitive-article"],
    ["title", "An Analysis of Wartime Photography"],
    ["summary", "A detailed look at the ethics of publishing graphic wartime images."],
    ["content-warning", "graphic violence, disturbing imagery"],
    ["t", "photography"],
    ["t", "ethics"]
  ]
}
```

### Picture Event with Content Warning (kind:20)

```
{
  "kind": 20,
  "content": "",
  "tags": [
    ["imeta", "url https://example.com/photo.jpg", "m image/jpeg", "alt A sensitive photograph"],
    ["content-warning", "nudity"]
  ]
}
```

### Video Event with Content Warning (kind:34235)

```
{
  "kind": 34235,
  "content": "",
  "tags": [
    ["imeta", "url https://example.com/video.mp4", "m video/mp4"],
    ["content-warning", "violence"]
  ]
}
```

### Spoiler Warning on a Reaction (kind:7)

```
{
  "kind": 7,
  "content": "The ending was incredible when the protagonist...",
  "tags": [
    ["e", "<event-id-hex>"],
    ["p", "<pubkey-hex>"],
    ["content-warning", "spoiler: movie title"]
  ]
}
```

## Client Behavior Requirements

### Display Behavior

When a client encounters an event with the `content-warning` tag:

1. **SHOULD hide the content by default.** The event's `content` field, any media attachments, and any inline previews should not be immediately visible.
2. **SHOULD display a warning label.** If a reason is provided, display it (e.g., "Content warning: nudity"). If no reason is provided, display a generic warning (e.g., "Sensitive content").
3. **SHOULD provide a click-through mechanism.** A button, link, or expandable section that allows the reader to reveal the content after acknowledging the warning.
4. **MAY provide user preferences.** Some clients allow users to auto-reveal all content warnings, or to auto-hide content with specific reason keywords. This is a client-side feature, not part of the protocol.

### What Clients SHOULD NOT Do

- **Do not suppress the event entirely.** The `content-warning` tag is not a deletion or censorship mechanism. The event should still appear in feeds and search results -- just with its content hidden behind a warning.
- **Do not strip the tag.** When rebroadcasting or displaying events, preserve the `content-warning` tag. Removing it defeats the author's intent.
- **Do not auto-expand for all users.** Respect the author's decision to flag the content. Individual users may choose to disable warnings in their client settings, but this should be an explicit opt-in.

## Applicability

The `content-warning` tag can be added to events of **any kind**. Common use cases:

| Event Kind | Use Case |
|-----------|----------|
| kind:1 (short note) | Flagging sensitive text content |
| kind:30023 (long-form article) | Warning about sensitive topics in articles |
| kind:20 (picture event) | Flagging NSFW or disturbing images |
| kind:34235/34236 (video events) | Warning about graphic video content |
| kind:7 (reaction) | Spoiler warnings in reaction comments |
| kind:42 (channel message) | Sensitive content in public chat channels |
| kind:1111 (comment) | Content warnings on comments to articles or media |

## Relationship to NIP-32 Labels

NIP-32 (labels) provides a structured content classification system using kind:1985 events with namespace (`L`) and label (`l`) tags. NIP-36 and NIP-32 serve different purposes and can be used together:

| Feature | NIP-36 (Content Warning) | NIP-32 (Labels) |
|---------|------------------------|-----------------|
| Mechanism | Tag on the event itself | Separate kind:1985 event |
| Scope | Self-labeling by author | Can be applied by anyone (author, moderator, third party) |
| Client behavior | Hide behind click-through | Filterable, searchable classification |
| Vocabulary | Freeform reason string | Namespaced labels (e.g., `["L", "content-type"]`, `["l", "nsfw", "content-type"]`) |
| Immediacy | Instant -- client reads tag on the event | Requires fetching the label event separately |

For content that needs both immediate client-side hiding AND structured classification, use both: add `["content-warning", "nudity"]` to the event's tags AND publish a kind:1985 label event referencing it.

## Filtering and Querying

### Finding Content-Warned Events

Use the `#content-warning` tag filter in NIP-01 subscriptions:

- **All content-warned events:** `{ "#content-warning": [] }` (filter for events that have the tag, regardless of value)
- **Content-warned events of a specific kind:** `{ kinds: [1], "#content-warning": [] }`
- **Content-warned events by a specific author:** `{ authors: ["<pubkey>"], "#content-warning": [] }`

Note: Not all relays support filtering by arbitrary tag names. Relay support for `#content-warning` tag filtering may vary.
