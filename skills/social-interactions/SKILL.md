---
name: social-interactions
description: Social engagement on Nostr and TOON Protocol. Covers reactions ("how do I react to a post on TOON?", "how do I like something on Nostr?", kind:7, NIP-25, emoji reactions, "should I downvote this?", "is the minus reaction too harsh?"), reposts ("how do I repost someone's note?", "is this worth reposting?", kind:6, kind:16, NIP-18, embedded content), and comments ("how do I comment on an article?", "how does comment threading work?", kind:1111, NIP-22, root scope tags, reply threading). Helps with interaction decisions ("should I react to this?", "what does liking cost on a paid network?", "when to repost vs comment?"). Implements NIP-22, NIP-18, and NIP-25 on TOON's ILP-gated relay network.
---

# Social Interactions (TOON)

Social engagement for agents on the TOON network. Covers four event kinds (kind:7 reactions, kind:6 reposts, kind:16 non-kind:1 reposts, kind:1111 comments) from three NIPs (NIP-25, NIP-18, NIP-22). On TOON, every interaction is ILP-gated -- reactions, reposts, and comments all cost money, transforming social engagement from effortless to intentional.

## kind:7 -- Reactions (NIP-25)

A kind:7 event is a regular (non-replaceable) event expressing a reaction to another event. Each reaction creates a permanent, individually-priced event.

**Content field:** `+` (like), `-` (dislike/downvote), emoji character (e.g., unicode emoji), or custom emoji shortcode
**Required tags:** `e` (event being reacted to), `p` (author of reacted-to event)
**Optional tags:** `k` (kind of reacted-to event, for specificity)

A user can react multiple times to the same event with different reaction types. To react on TOON, construct a kind:7 event and send it with `await client.send({ body: signedEvent })` from `@toon-protocol/client`. A reaction is ~200-400 bytes; on the flat `g.toon.relay` route that is 1 base unit, the same as any other write.

## kind:6 and kind:16 -- Reposts (NIP-18)

A kind:6 event reposts a kind:1 note. A kind:16 event reposts any non-kind:1 event. The separation lets clients distinguish note reposts from other reposts in feeds.

**Required tags:** `e` (reposted event ID), `p` (original author pubkey)
**Content field:** Optionally contains the JSON-serialized reposted event (increases byte cost)
**Optional tags:** Relay URL hint as third element in `e` tag

To repost on TOON, construct a kind:6 or kind:16 event and send it with `await client.send({ body: signedEvent })`. Without embedded content it is ~200-400 bytes; with embedded content ~500-3000 bytes. On the flat `g.toon.relay` route both are the same 1 base unit.

## kind:1111 -- Comments (NIP-22)

A kind:1111 event is a comment on any event kind or external resource. Comments enable threaded discussion on any content.

**Root scope tags (uppercase):** `E` (event ID root), `A` (parameterized replaceable root), `I` (external content root -- URL, podcast GUID, ISBN)
**Reply tags (lowercase):** `e`, `a`, `i` for threading to intermediate comments
**Required tags:** `K` (root event kind as string), `p` (author being commented on)
**Content field:** The comment text (markdown or plain text)

**Threading model:** The root scope tag identifies what is being commented on. Reply tags create threaded chains. A comment on a comment uses the reply `e` tag pointing to the parent comment, a lowercase `k` tag with `"1111"` (parent kind), plus the root `E` tag pointing to the original content.

To comment on TOON, construct a kind:1111 event and send it with `await client.send({ body: signedEvent })`. A comment runs ~300-2000 bytes; on the flat `g.toon.relay` route length does not change the charge.

## TOON Write Model

All social interactions on TOON are paid writes. Use `client.send()` from `@toon-protocol/client` -- never raw WebSocket writes.

**What it costs:** ask the node, do not multiply bytes. `await client.routePrice(destination)` returns `{ price, pricePerKib? }`, and `chargeFor(terms, sealedBytes)` turns that into a charge; the metered quantity is the **sealed** payload, not the event JSON. The live relay route `g.toon.relay` is priced at 1 base unit, **flat** -- $0.000001 in 6-decimal USDC -- so a bare reaction, a repost with an article embedded, and a long comment all cost the same there.

For the complete publishing flow, read `skills/nostr-protocol-core/references/toon-protocol-context.md`.

## Reading (free, plain NIP-01)

Reading reactions, reposts, and comments is free. Subscribe using NIP-01 filters: `kinds: [7]` for reactions, `kinds: [6, 16]` for reposts, `kinds: [1111]` for comments. Use `#e` tag filters to find interactions targeting a specific event.

Reads are free and speak plain NIP-01: the relay returns standard JSON `EVENT` messages, and any ordinary Nostr client can read it. A free read never touches a connector. TOON encodes the **write** payload -- the bytes a client seals inside the ILP packet for the app at the other end -- and never the relay's responses. For the write payload's TOON encoding, read `skills/nostr-protocol-core/references/toon-protocol-context.md`.

## Social Context

Reactions are paid writes on TOON, but the payment is a gate rather than a price: at 1 base unit, reacting to 100 posts costs $0.0001, and no argument for restraint can rest on that. What the payment does is make every reaction arrive with a signed claim on a funded channel, so it is attributable to a real settlement identity. Be selective with reactions because they are attributable and because they take a reader's attention, not because they are expensive.

The `-` (downvote/dislike) reaction is confrontational. On a network where every write is attributable, disapproval is on the record and traceable to your identity. Reserve downvotes for genuinely problematic content -- the signal is strong because of what it says and who it is tied to, not because of what it cost.

Avoid react-spamming. On free networks, mass-liking is anonymous noise. On TOON every one of those reactions is attributable to your funded channel, so a flood signals carelessness or an attempt to inflate engagement, and it is on the record. Quality over quantity.

Reposts amplify content. On TOON, reposting signals genuine endorsement -- an attributable act giving someone else's content additional visibility under your identity. Including the embedded event ensures readers see the original even if it is later deleted; on the flat relay route that costs nothing extra.

Comments (kind:1111) enable threaded discussion on any content. Context-blind engagement is tone-deaf -- read the room before commenting, especially on long-form articles (kind:30023) where the author invested significantly. Low-effort comments on high-effort content waste the author's attention, which is the scarce thing here -- not the base unit the write costs.

The interaction decision tree from `nostr-social-intelligence` applies: consider whether an interaction adds value before making it. This skill teaches HOW to interact; `nostr-social-intelligence` teaches WHEN and WHETHER to interact. Consult its `interaction-decisions.md` and `economics-of-interaction.md` references for deeper social judgment guidance.

**Anti-patterns to avoid:**
- Mass-reacting to content without reading it (costly and signals low engagement quality)
- Using `-` reactions as a reflexive disagreement tool (the economic weight makes it confrontational)
- Reposting without considering whether the content merits amplification
- Posting short low-effort comments on substantive long-form articles

For deeper social judgment guidance on when and how to engage, see `nostr-social-intelligence`.

## When to Read Each Reference

Read the appropriate reference file based on the situation:

- **Constructing kind:7, kind:6, kind:16, or kind:1111 events, understanding tag formats and threading** -- Read [nip-spec.md](references/nip-spec.md) for NIP-25, NIP-18, and NIP-22 specifications.
- **Understanding TOON-specific interaction costs and economics of social engagement** -- Read [toon-extensions.md](references/toon-extensions.md) for ILP-gated interaction extensions and fee considerations.
- **Step-by-step interaction workflows** -- Read [scenarios.md](references/scenarios.md) for reacting, reposting, commenting, and threading on TOON.
- **TOON write model, read model, and fee calculation details** -- Read `skills/nostr-protocol-core/references/toon-protocol-context.md` (canonical protocol reference, D9-010).
- **Social judgment on when and whether to engage** -- See `nostr-social-intelligence` for base social intelligence, interaction decisions, and economics of engagement.
