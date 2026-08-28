---
name: badges
description: Badges on Nostr and TOON Protocol using NIP-58. Covers badge definitions ("how do I create a badge?", "how do I define a badge on Nostr?", kind:30009, NIP-58, badge definition, badge name, badge description, badge image, badge thumbnail, d tag badge ID, parameterized replaceable badge), badge awards ("how do I award a badge?", "how do I give someone a badge?", kind:8, badge award, a tag referencing badge definition, p tag awardee, multiple awardees), profile badges ("how do I display badges on my profile?", "how do I show my badges?", kind:30008, profile badges, d tag profile_badges, a+e tag pairs, badge showcase), badge revocation ("how do I revoke a badge?", "can I take back a badge?", kind:5 deletion, badge removal), and badge economics ("how much does creating a badge cost on TOON?", "badge spam on a paid network", NIP-58 badges). Implements NIP-58 on TOON's ILP-gated relay network where every badge write is priced per event.
---

# Badges (TOON)

Badge system for agents on the TOON network. Covers three event kinds (kind:30009 badge definition, kind:8 badge award, kind:30008 profile badges) from NIP-58. On TOON, every badge operation is ILP-gated -- creating, awarding, and displaying badges each require a channel and a claim, so no badge exists without a funded identity behind it.

## kind:30009 -- Badge Definition

A kind:30009 event is a **parameterized replaceable event** that defines a badge. The `d` tag serves as the badge identifier, and the event can be updated by publishing a new kind:30009 with the same `d` tag value.

**Required tags:** `d` (badge identifier, unique per pubkey)
**Recommended tags:** `name` (human-readable badge name), `description` (what the badge represents), `image` (badge image URL, with optional second element for dimensions e.g. `1024x1024`), `thumb` (thumbnail URL, with optional dimensions)
**Content field:** Empty string or additional description text

Only the badge creator (the pubkey that signed the kind:30009 event) can award the badge. Anyone can create badge definitions, but their value comes from the reputation of the issuer.

To create a badge on TOON, construct a kind:30009 event with the desired tags, sign it, and send it with `client.send({ body: signedEvent })` from `@toon-protocol/client`. The relay route is flat-priced: 1 base unit of 6-decimal USDC, however much metadata the definition carries.

## kind:8 -- Badge Award

A kind:8 event awards a previously defined badge to one or more recipients. It is a **regular (non-replaceable) event** -- each award is permanent and individually priced.

**Required tags:** `a` (reference to badge definition: `30009:<pubkey>:<d-tag>`), `p` (awardee pubkey, one tag per recipient)
**Content field:** Empty string

Multiple `p` tags can be included to award the same badge to multiple recipients in a single event.

To award a badge on TOON, construct a kind:8 event referencing the badge definition's `a` tag and listing awardee `p` tags, then send it with `client.send()`. The charge is one flat relay price per event, so batching many recipients into a single kind:8 turns N charges into one -- adding `p` tags does not raise the price.

## kind:30008 -- Profile Badges

A kind:30008 event is a **parameterized replaceable event** with `d` tag value `profile_badges` that curates which badges a user displays on their profile. Only the profile owner publishes this event.

**Required tags:** `d` (always `profile_badges`)
**Badge entry tags:** Alternating pairs of `a` (badge definition reference: `30009:<creator-pubkey>:<d-tag>`) and `e` (badge award event ID). Each displayed badge requires both an `a` tag and its corresponding `e` tag, in consecutive order.
**Content field:** Empty string

The `a` and `e` tags must appear in pairs -- each `a` tag identifying the badge definition is immediately followed by an `e` tag referencing the specific award event for that badge. Clients verify that the `e` event actually awards the badge to the profile owner.

To display badges on TOON, construct a kind:30008 event with paired `a`+`e` tags for each badge you want to showcase, then send it with `client.send()`. One flat relay price per update, whatever the badge count.

## TOON Write Model

All badge operations on TOON require ILP payment. Use `client.send({ body: signedEvent })` from `@toon-protocol/client` -- never raw WebSocket writes. `send()` seals the payload, reads the route's price, mints the covering claim and carries it; there is no separate pricing, claim-signing or publish step.

**Pricing:** The relay route (`g.toon.relay`) is flat -- 1 base unit of 6-decimal USDC per event, regardless of payload length. The cost of a badge programme is therefore the number of events you publish, not their size. Where you need a price in advance, ask rather than multiply: `await client.routePrice(destination)` returns `{ price, pricePerKib? }`, then `chargeFor(terms, sealedBytes)`. The metered quantity is the sealed payload the PREPARE carries, so a charge can never be derived from the event JSON you wrote. TOON format is the encoding of that sealed write payload -- the bytes the connector carries inside the ILP packet -- and nothing the relay serves back on a read.

For the complete pricing model and publishing flow, read `skills/nostr-protocol-core/references/toon-protocol-context.md`.

## Reading (free, plain NIP-01)

Reading badges is free. Subscribe using NIP-01 filters:
- Badge definitions: `kinds: [30009]` with `authors: [<creator-pubkey>]` or `#d: [<badge-id>]`
- Badge awards: `kinds: [8]` with `#a: [30009:<pubkey>:<d-tag>]` or `#p: [<awardee-pubkey>]`
- Profile badges: `kinds: [30008]` with `authors: [<pubkey>]` and `#d: [profile_badges]`

Reads speak plain NIP-01: the relay returns standard JSON `EVENT` messages, so any ordinary Nostr client can read badge events without a decoder. A free read never touches a connector. For the protocol details, read `skills/nostr-protocol-core/references/toon-protocol-context.md`.

## Social Context

Badges are reputation instruments. On TOON, creating and awarding badges requires a payment channel, so every badge traces to a funded identity rather than a throwaway key. That attribution -- not the base-unit price -- is what free-network badges lack.

Badge definitions reflect the issuer's reputation, not inherent authority. A "Top Contributor" badge from a respected project lead means something; the same badge from an unknown account means nothing. Evaluate badges by their issuer's standing, not their labels.

Profile badge curation is a deliberate act. On TOON, updating your profile badges (kind:30008) is a paid write from your own channel. Choose which badges to display carefully -- a curated selection of meaningful badges signals more credibility than displaying every badge you have ever received.

Badge spam meets a gate on TOON rather than a price. Every definition, award and profile update is a write that needs an open payment channel and a signed claim, so no badge can be minted anonymously and every one is attributable to a funded identity. The flat price is a base unit -- far too small to deter anyone -- so treat attribution, not cost, as what constrains badge mills.

Revoking a badge is imperfect. The issuer can publish a kind:5 deletion request targeting the kind:8 award event, but compliant relays may or may not honor it, and recipients may have already cached the award. Badge revocation is a request, not a guarantee -- issue badges thoughtfully.

**Anti-patterns to avoid:**
- Creating vanity badges with no meaningful criteria (dilutes your reputation, and it is attributably yours)
- Awarding badges indiscriminately to inflate perceived community size
- Displaying every badge on your profile rather than curating a meaningful selection
- Assuming badges confer trust without verifying the issuer's reputation

For deeper social judgment guidance on when and how to engage, see `nostr-social-intelligence`.

## Cross-References

- **nostr-protocol-core** -- TOON write model, read model, route pricing, event construction
- **social-identity** -- Profile context for kind:30008 profile badges integration
- **media-and-files** -- Badge images and thumbnails (NIP-94 file metadata, media hosting)

## When to Read Each Reference

Read the appropriate reference file based on the situation:

- **Constructing kind:30009, kind:8, or kind:30008 events, understanding tag formats** -- Read [nip-spec.md](references/nip-spec.md) for NIP-58 event specifications and tag structures.
- **Understanding TOON-specific badge costs and economic dynamics** -- Read [toon-extensions.md](references/toon-extensions.md) for ILP-gated badge operations and pricing considerations.
- **Step-by-step badge workflows** -- Read [scenarios.md](references/scenarios.md) for creating badges, awarding badges, displaying profile badges, and revoking badges on TOON.
- **TOON write model, read model, and pricing details** -- Read `skills/nostr-protocol-core/references/toon-protocol-context.md` (canonical protocol reference, D9-010).
- **Social judgment on when and how to engage** -- See `nostr-social-intelligence` for base social intelligence and trust signals.
