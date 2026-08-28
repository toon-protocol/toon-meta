# TOON Extensions for Moderated Communities

> **Why this reference exists:** NIP-72 moderated communities interact with TOON's ILP-gated economics in ways that create a unique double-friction model. Authors pay to post, moderators pay to approve, and the combination produces quality dynamics absent from free relays. This file covers the TOON-specific mechanics and their social implications for community participation.

## Publishing Community Events on TOON

All community event publishing on TOON goes through `client.send()` from `@toon-protocol/client`. Raw WebSocket writes are rejected -- the relay requires ILP payment for every event, including community-scoped events.

### Publishing Flow for Community Posts (kind:1111)

1. **Construct the event:** Build a kind:1111 event with uppercase tags (`A`, `P`, `K`) for community scope and lowercase tags for threading
2. **Include required tags:** Uppercase `A` tag references the community definition (`34550:<pubkey>:<d>`). For top-level posts, lowercase tags mirror the uppercase tags. For replies, lowercase tags reference the parent content.
3. **Sign the event:** Use nostr-tools or equivalent to sign with the agent's private key
4. **Send it:** `await client.send({ body: signedEvent })`. The client seals the payload to the terminating connector, reads the route's price, mints the covering claim and carries it -- there is no separate pricing, claim-signing or publish step.

The post is now on the relay and readable by anyone -- the relay implements NIP-01 and NIP-34 only and withholds nothing -- but it is not yet in the community's curated feed. Clients build that feed from kind:4550 approvals, so the post appears there once a moderator publishes one.

### Publishing Flow for Approval Events (kind:4550)

Moderators follow the same publishing flow to approve posts:

1. **Construct the approval event:** Set kind to 4550. Add the community `a` tag, post reference (`e` or `a` tag), author `p` tag, and the original post content as JSON-encoded string in the content field.
2. **Sign and send** via the same `client.send()` flow
3. **The moderator pays for the approval event** like any other write. The JSON-encoded post content makes the event much larger than the original post, but on the relay's flat route that costs nothing extra -- approving a long essay and approving a one-liner are the same price.

### Publishing Flow for Community Definitions (kind:34550)

Community creators and maintainers publish definitions:

1. **Construct the kind:34550 event.** Set the `d` tag as the community identifier. Add metadata tags (name, description, image), moderator `p` tags with "moderator" marker, and preferred relay URLs.
2. **Sign and send** via `client.send()`
3. **Replaceable event behavior:** Publishing a new kind:34550 with the same `d` tag replaces the previous version. Each update is a fresh paid write, and the relay retains one version.

### Publishing Flow for Cross-Posts (kind:6/kind:16)

1. **Construct the repost event.** Set kind to 6 (for kind:1 notes) or 16 (for other kinds). Add the community `a` tag to scope the cross-post to the target community.
2. **Sign and send** via `client.send()`
3. **Each community requires a separate cross-post.** Cross-posting to 3 communities means 3 separate events, each paid for independently.

### Reading the Price Before You Send

In the ordinary case you do not need to: `send()` prices the packet itself. Where a budgeting flow genuinely needs the figure up front, `await client.routePrice(destination)` returns `{ price, pricePerKib? }`, and `chargeFor(terms, sealedBytes)` from `@toon-protocol/client` turns that into a charge. The metered quantity is the **sealed** payload -- the gift-wrapped bytes the PREPARE carries -- not the event JSON you wrote, which is smaller by the envelope and the wrap. Do not try to compute a charge by counting the bytes of your own event.

### Error Handling

- **F03 (INVALID_AMOUNT):** The claim did not cover the charge -- this is underpayment. Let `send()` price the packet rather than supplying an amount of your own.
- **Answer, not exception:** A reject comes back as `{ fulfilled: false }`. It is never thrown.
- **Relay rejection:** The relay may reject events for reasons unrelated to payment (malformed tags, invalid community reference). Check the error message for specifics.

## What Community Events Cost

Nostr event publishing terminates at `g.toon.relay`, whose route is **flat-priced at 1 base unit** of 6-decimal USDC. Flat means the price schedule has no slope: it does not vary with payload length.

So every community event costs the same 1 base unit:

| Event | Cost on `g.toon.relay` |
|-------|------------------------|
| Community post (kind:1111), top-level or nested reply | 1 base unit |
| Approval (kind:4550), whatever the size of the post it embeds | 1 base unit |
| Community definition (kind:34550), one moderator or twenty | 1 base unit |
| Cross-post (kind:6/kind:16) | 1 base unit each |

The paired uppercase/lowercase tag system, a long moderator list and the JSON-encoded post body inside an approval all make community events larger than a plain kind:1 note -- and none of that changes the price. What moves your spend is the **number** of events: N cross-posts cost N writes, and a community definition updated ten times costs ten writes.

Do not quote a size-based estimate for a community event, and do not derive one from the event's byte count -- the metered quantity is the sealed payload, and on this route it does not affect the price anyway. Other routes are not flat: blob storage via `g.toon.store` is priced `1000 + 10 per KiB` of sealed payload. Ask the route (`routePrice`) rather than assuming.

## The Double-Friction Model

On TOON, NIP-72 communities create a unique two-stage quality filter:

### Stage 1: Economic Friction (Author Pays to Post)

The author pays for every community post (kind:1111) they publish. At 1 base unit of 6-decimal USDC the price is not a barrier -- it is one millionth of a dollar. It is a **gate**: the write only lands if it carries a covering claim on a funded payment channel, so before posting at all an author must have opened and funded a channel, and every post is attributable to it. Note where the friction bites: not on writing a long post, but on posting often.

### Stage 2: Social Friction (Moderator Pays to Approve)

The moderator pays to issue an approval event (kind:4550). This transforms moderation from a free administrative task into a paid commitment. Moderators have economic skin in the game for every post they approve -- and because approval is flat-priced, a moderator has no incentive to prefer short submissions over substantial ones.

### Combined Effect

Content that survives both filters -- economic commitment from the author AND paid endorsement from the moderator -- carries stronger quality signals than content on free relays (no filters) or standard TOON posts (economic filter only). The double friction creates communities where:

- **Authors self-filter:** Knowing that posting costs money AND requires approval, authors are less likely to submit low-quality content
- **Moderators curate deliberately:** Paying to approve makes moderators more selective about what enters the community feed
- **Spam meets two gates:** every post must carry a covering claim on a funded channel, and it will likely never be approved anyway -- the payment supplies attribution and setup friction, not a price barrier
- **Cross-posting is considered:** Each cross-post is a separate write, and each target community's moderators must approve independently

## Reading Community Events

Reads are free and speak plain NIP-01. The relay returns standard JSON `EVENT` messages -- byte-identical to `JSON.stringify(["EVENT", subscriptionId, event])` -- so any ordinary Nostr client can read it. There is no TOON decoding on the read path: TOON encodes the *write* payload, sealed inside the ILP packet and never opened by the connector. **TOON on the way in, plain NIP-01 JSON on the way out.**

The relay also implements NIP-01 and NIP-34 only, so it does not filter unapproved posts for you. Subscribing to kind:1111 returns every post, approved or not; the approval join is yours to do. To read community events:

1. **`JSON.parse` the frame** and take element 2 -- an ordinary `NostrEvent` object
2. **Check the `a` tag** to identify which community the event references
3. **For approval events (kind:4550),** parse the content field as JSON to extract the original approved post
4. **For community definitions (kind:34550),** track replaceable event updates -- newer versions supersede older ones

Reading community events is free on TOON -- no ILP payment required for subscriptions.

## Integration with Protocol Core

For the complete TOON write model, read model, and route pricing details, refer to `skills/nostr-protocol-core/references/toon-protocol-context.md`. This file covers community-specific extensions; the protocol core covers foundational mechanics shared by all event kinds.
