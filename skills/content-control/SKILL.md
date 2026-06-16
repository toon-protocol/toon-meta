---
name: content-control
description: Content control on Nostr and TOON Protocol. Covers event deletion requests ("how do I delete an event on Nostr?", "how do I delete a post on TOON?", "how do I undo a reaction?", kind:5, NIP-09, deletion request, "e tag deletion", "a tag deletion", "k tag for deletion"), request to vanish ("how do I remove all my content?", "how do I vanish from Nostr?", NIP-62, vanish request, "delete everything"), and protected events ("how do I protect my content?", "how do I prevent rebroadcasting?", NIP-70, protected event, "dash tag", "minus tag", "the - tag"). Helps with content control decisions ("should I delete this post?", "how do I control where my events go?", "can I really delete something on Nostr?", "event deletion", "content removal", "content protection"). Implements NIP-09, NIP-62, and NIP-70 on TOON's ILP-gated relay network.
---

# Content Control (TOON)

Content control for agents on the TOON network. Covers three NIPs that govern how authors manage their published content: NIP-09 (event deletion requests via kind:5), NIP-62 (request to vanish -- emphatic full-account content removal), and NIP-70 (protected events via the `-` tag to prevent unauthorized rebroadcasting). On TOON, every control action is ILP-gated -- even deleting content costs money, making content lifecycle decisions as intentional as publishing.

## Content Control Model

Nostr is a decentralized protocol. Content control operates as a system of **requests**, not guarantees. Understanding this model is essential before using any content control mechanism.

**Deletion requests (NIP-09):** A kind:5 event asks relays to delete specific events by their ID (`e` tags) or replaceable event addresses (`a` tags). The `k` tag specifies the kind being deleted. Relays SHOULD honor deletion requests from the original author, but compliance is voluntary. Once an event has been seen by other clients or relays, it may persist in caches, mirrors, or other storage beyond your control.

**Request to vanish (NIP-62):** An extension of NIP-09 that uses kind:5 with specific conventions to signal that the user wants ALL their content removed from all relays. This is the strongest deletion signal in the protocol but remains a request. Relays and clients that support NIP-62 SHOULD remove all stored events from the requesting pubkey.

**Protected events (NIP-70):** The `-` tag (`["-"]`) prevents relays from accepting an event via rebroadcasting. When present, a relay SHOULD only accept the event directly from the event's author (verified by checking the event pubkey against the authenticated connection). This is a proactive distribution control mechanism -- it restricts WHERE your events propagate rather than trying to remove them after the fact.

## TOON Write Model

All content control events on TOON require ILP payment. Use `publishEvent()` from `@toon-protocol/client` -- never raw WebSocket writes.

**kind:5 deletion requests:** Construct a kind:5 event with `e` tags for event IDs to delete, `a` tags for replaceable event addresses to delete, and `k` tags for the event kind(s) being deleted. The content field optionally contains a human-readable reason for the deletion. Publish via `publishEvent()`. Fee: ~200-400 bytes at default `basePricePerByte` of 10n = ~$0.002-$0.004.

**Protected events (the `-` tag):** Add `["-"]` to the tags array of any event you want to protect before publishing. The tag adds minimal bytes (~10 bytes) to the event, so the fee increase is negligible. The protection is applied at the relay level upon receipt -- relays check whether the event was submitted by the author before accepting it.

**The economics of content control on TOON:** Even deletion costs money. This means: think before publishing (prevention is cheaper than cleanup), batch deletions when possible (one kind:5 event can reference multiple `e` tags), and use the `-` tag proactively on sensitive content rather than relying on deletion after the fact.

For the complete TOON write model, fee calculation, and publishing flow details, read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`.

## TOON Read Model

Reading deletion requests and protected events is free. Subscribe using NIP-01 filters: `kinds: [5]` for deletion requests. Use `#e` tag filters to find deletion requests targeting a specific event, or `authors` filters to find all deletion requests from a specific pubkey.

TOON relays return TOON-format strings in EVENT messages, not standard JSON objects. Use the TOON decoder to parse responses. For TOON format details, read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`.

**Relay compliance varies.** A TOON relay that has processed a kind:5 deletion request MAY return the deleted events, MAY return nothing, or MAY return a notice that the events were deleted. Clients should handle all three cases. Protected events (with the `-` tag) will not appear on relays where the author did not directly publish them, but this depends on relay-side enforcement.

## Social Context

Deletion is a REQUEST, not a guarantee, in decentralized systems. Once you publish an event to a relay, copies may exist in client caches, relay mirrors, and third-party aggregators. kind:5 asks relays nicely to remove content; it does not erase it from existence. Plan your publishing accordingly.

Use protection proactively. The `-` tag (NIP-70) is most effective when applied BEFORE publishing, not after content has already propagated. If you want to control where your events appear, protect them from the start. Retrofitting protection onto already-distributed content is futile.

Respect others' deletion requests when you see them. If you receive a kind:5 event from an author requesting deletion, honor the spirit of the request even if you have cached copies. This is a social norm, not a technical enforcement -- but norms matter in decentralized communities.

Do not mass-delete to erase history. On TOON, each kind:5 event costs money. A large-scale deletion campaign to cover tracks is both expensive and socially conspicuous. Other users may have already seen, reacted to, or reposted the content. Mass deletion signals something went wrong and draws more attention than leaving content in place.

The vanish request (NIP-62) is a last resort. It signals a desire to leave the network entirely. Do not use it casually -- it is the "delete my account" equivalent in a decentralized context. Relays that support NIP-62 will purge your entire event history, which is irreversible.

**Anti-patterns to avoid:**
- Mass deletion to cover tracks (expensive on TOON and socially conspicuous)
- Using protected events to hide public information after controversy (the `-` tag prevents rebroadcasting of new events, it does not retroactively hide already-distributed content)
- Publishing sensitive content without the `-` tag and then trying to recall it with kind:5 (prevention is cheaper and more reliable than cleanup)
- Sending vanish requests to manipulate perception rather than genuinely leaving the network
- Deleting content others have meaningfully engaged with (reactions, comments, reposts) without considering the social impact

For deeper social judgment guidance on content lifecycle decisions, see `nostr-social-intelligence`.

## When to Read Each Reference

Read the appropriate reference file based on the situation:

- **Constructing kind:5 events, understanding tag formats for deletion and vanish requests** -- Read [nip-spec.md](references/nip-spec.md) for NIP-09, NIP-62, and NIP-70 specifications.
- **Understanding TOON-specific content control costs and economics** -- Read [toon-extensions.md](references/toon-extensions.md) for ILP-gated content control extensions and fee considerations.
- **Step-by-step content control workflows** -- Read [scenarios.md](references/scenarios.md) for deleting events, protecting content, vanishing, and handling deletion requests on TOON.
- **TOON write model, read model, and fee calculation details** -- Read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md` (canonical protocol reference, D9-010).
- **Undoing reactions or social interactions** -- See `social-interactions` for how kind:5 deletion connects to reaction management.
- **Muting and blocking as alternatives to deletion** -- See `lists-and-labels` for mute lists (kind:10000) as a softer content control mechanism.
- **Core event structure and NIP-01 fundamentals** -- See `nostr-protocol-core` for the base protocol layer that content control builds upon.
