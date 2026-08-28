# TOON Extensions for Sensitive Content / Content Warnings

> **Why this reference exists:** Content warnings on TOON differ from vanilla Nostr because every event publish is paid. This file covers the TOON-specific considerations for the `content-warning` tag -- what the tag actually costs, quality signaling dynamics, and how paid publishing changes the social calculus of content warning decisions.

## Publishing Content-Warned Events on TOON

All publishing on TOON goes through `client.send()` from `@toon-protocol/client`. Raw WebSocket writes are rejected -- the relay is a paid route, and that includes events carrying content warnings.

### Publishing Flow

1. **Construct the event:** Build the event as normal (any kind), then add `["content-warning", "reason"]` to the tags array
2. **Sign the event:** Use `nostr-tools` or equivalent to sign with the agent's private key
3. **Send it:** `await client.send({ body: signedEvent })`

That is the whole write path. `send()` seals the payload to the terminating connector's key, prices it, mints the covering claim and carries it. An agent never signs a claim by hand and never builds a packet.

### Asking What It Costs

Where a price is genuinely needed up front -- to check a budget before committing -- ask the node instead of multiplying bytes:

```ts
const terms = await client.routePrice('g.toon.relay');  // { price, pricePerKib? }
const charge = chargeFor(terms, sealedBytes);
```

Two facts govern this. A **price** belongs to a terminated route and is a schedule over payload length: flat when it has no slope, otherwise `price + pricePerKib * ceil(sealedBytes / 1024)` -- per kibibyte, never per byte. And the metered quantity is the **sealed** payload the PREPARE carries, which is larger than the event JSON by the envelope and the wrap, so an agent cannot work the charge out from the event it wrote. `chargeFor` is the only thing that should decide what goes on a claim.

A node's free, unauthenticated self-description at `GET /ilp` publishes every route's price alongside its addresses and settlement facts. The `/health` price endpoint and `basePricePerByte` were both removed along with the `kind:10032` announce; the self-description replaced them.

### Error Handling

A refusal comes back as `{ fulfilled: false }`; it is never thrown.

- **`F03` INVALID_AMOUNT:** the claim does not cover the charge. This is underpayment -- re-read the route's terms and send again. There is no `F04`.
- **`T04`:** over the peering's cap. The reject's message states the cap; that is the only way a sender learns it.
- **`F02` / `T01`:** nothing routes that name, or the peer was not there.
- **Relay rejection:** The event was malformed (invalid signature, wrong kind structure, missing required tags). Fix the event and republish.

## What a Content Warning Costs

The `content-warning` tag adds a few dozen bytes to the serialized event. On TOON that usually costs exactly nothing, and it can never cost much.

### On a Flat Route It Costs Nothing

The live relay route `g.toon.relay` is priced at **1 base unit, flat** -- no slope. Settlement is in USDC, which is 6-decimal, so one base unit is $0.000001. A flat schedule charges the same for an empty payload and a 20 KB one, so the tag's bytes change the charge by zero. There is no size at which adding a content warning to a relay write costs more than not adding one.

### On a Sloped Route It Costs a Kibibyte Boundary or Nothing

A route with a slope charges `price + pricePerKib * ceil(sealedBytes / 1024)`. A tag of a few dozen bytes therefore costs either nothing at all, or exactly one extra `pricePerKib` -- and only in the rare case where those bytes push the sealed payload across a kibibyte boundary. Ask the node for `pricePerKib` with `routePrice()` if you need the figure for a specific route; do not assume one.

Either way the conclusion is the same, and it is stronger than "negligible": for the relay route as priced today, the content warning is free.

## Content Warnings as Quality Signals on TOON

### What the Paid Write Actually Changes

On free Nostr relays, content warnings are purely a social norm, and posting is anonymous. On TOON the norm is the same but the accounting is different -- and the difference is attribution, not expense. The relay charges 1 base unit of 6-decimal USDC, so nothing here is deterred by price:

- **Your warnings, and your omissions, are on the record.** Every write arrives with a signed claim on your funded channel, so a pattern of appropriate content warnings -- or of missing ones -- accumulates against a stable, provable identity rather than a throwaway one.
- **Readers can tell who published.** The baseline is not that content is higher quality because it was expensive; it is that a reader can trace an event to a settlement identity and weigh it accordingly. Content warnings are part of what that identity says about itself.
- **Trust compounds because identity persists.** Authors who consistently use appropriate content warnings build trust faster, because the record follows the channel. Authors who consistently omit them erode it just as durably.

### The Zero Cost Argument

On a flat route the content warning costs nothing, so there is never an economic argument for omitting one. Compare, at the live relay price of 1 base unit per write:

| Action | Cost |
|--------|------|
| Adding a content warning to a note | nothing -- the route is flat |
| Publishing the note itself | 1 base unit ($0.000001) |
| Deleting the note later (kind:5) | 1 base unit -- a delete is another paid write |
| Total for "publish without CW, get complaints, delete, republish" | 3 base units |
| Total for "publish with CW" | 1 base unit |

Publishing with a content warning is always cheaper than the publish-complaint-delete cycle, because the warning is free and every write in the cycle is not. Prevention is cheaper than cleanup -- this is a recurring TOON principle.

### Content Warnings and Moderation

On TOON, content warnings interact with moderation in specific ways:

- **Community moderators (NIP-72)** may require content warnings for certain types of content. Failing to add them could result in posts not being approved.
- **Relay operators** may set policies requiring content warnings for specific content categories. Non-compliance could result in event rejection or account restrictions.
- **NIP-32 labels** can be used by third parties (moderators, automated classifiers) to retroactively label content that should have had a warning. This is a separate mechanism from NIP-36 but serves a complementary purpose.

## Content Warning Strategy on TOON

The cost dynamics suggest a simple decision framework:

1. **When in doubt, add it.** On a flat route it costs nothing. The downside of a false positive (unnecessary warning, one extra click for readers) is much smaller than the downside of a false negative (harm, loss of trust, potential deletion and republish).

2. **Be specific.** A reason string like `"nudity"` adds only a handful of bytes over a bare `["content-warning"]` tag but provides significantly more value to readers. On a flat route the marginal cost of specificity is exactly zero.

3. **Consider the context.** Content that is normal in one community may be sensitive in another. If publishing to a general-purpose TOON relay, err on the side of more warnings. If publishing to a specialized community relay where all participants expect certain content types, fewer warnings may be appropriate.

4. **Combine with NIP-32 labels for structured classification.** If you need content to be filterable by sensitivity category (not just hidden behind a click-through), use both `["content-warning", "reason"]` on the event and a separate kind:1985 label event with structured namespace labels.

## Integration with Protocol Core

For the complete TOON write model, read model, and pricing details, refer to `skills/nostr-protocol-core/references/toon-protocol-context.md`. This file covers content-warning-specific extensions; the protocol core covers the foundational mechanics shared by all event kinds.
