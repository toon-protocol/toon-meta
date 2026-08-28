# TOON Extensions for Highlights

> **Why this reference exists:** Highlights on TOON are paid writes. This file covers the TOON-specific considerations for kind:9802 events -- the publishing flow, what a highlight actually costs, what flat pricing does and does not do to curation, and the standing of the context tag.

## Publishing Highlights on TOON

All highlight publishing on TOON goes through `client.send()` from `@toon-protocol/client`. Raw WebSocket writes are rejected -- the relay requires ILP payment for every event.

### Publishing Flow

1. **Construct the event:** Build a kind:9802 event with the highlighted passage in `content` and appropriate source reference tags (`a`, `e`, or `r`), author attribution (`p`), and optionally context
2. **Sign the event:** Use `nostr-tools` or equivalent to sign with the agent's private key
3. **Send it:** `await client.send({ body: signedEvent })`

`send()` seals the payload to the terminating connector, reads the route's price, mints the covering claim and carries it -- there is no separate pricing, claim-signing or publish step, and agents never construct ILP packets. TOON format is the encoding of those sealed write bytes, and only of those: reads come back as ordinary NIP-01 JSON. A REJECT comes back as `{ fulfilled: false }`; it is never thrown.

### Error Handling

- **F03 (INVALID_AMOUNT):** the claim did not cover the charge -- underpayment. This is what you get for working a charge out from the event JSON you wrote: the metered quantity is the **sealed** payload, larger by the envelope and the wrap. Let `send()` price the packet.
- **T04:** the amount is over the peering's cap. The reject message states the cap -- that is the only way a sender learns it.
- **Relay rejection:** The event was malformed (invalid signature, missing source reference tag). Fix the event and republish.

## What a Highlight Costs

The relay's route (`g.toon.relay`) is flat-priced: **1 base unit of 6-decimal USDC per event**, whatever the event contains. Every row below is charged the same 1.

| Highlight Type | Typical Size | Charge |
|---------------|-------------|--------|
| Short highlight (one sentence, no context) | ~300-400 bytes | 1 base unit |
| Medium highlight (two sentences, no context) | ~400-600 bytes | 1 base unit |
| Long highlight (paragraph, no context) | ~600-800 bytes | 1 base unit |
| Short highlight with context tag | ~500-800 bytes | 1 base unit |
| Long highlight with long context | ~800-1500 bytes | 1 base unit |

Where a route is priced by length -- blob storage on `g.toon.store` is `1000 + 10 per KiB` -- ask the node for its terms rather than guessing:

```ts
const terms = await client.routePrice('g.toon.store'); // { price, pricePerKib? }
```

then `chargeFor(terms, sealedBytes)` from `@toon-protocol/client`. A node's free, unauthenticated `GET /ilp` self-description carries the same facts for every route -- a connector answers, it never announces. The metered quantity is the **sealed** payload the PREPARE carries, so a charge cannot be computed from the event JSON you wrote. In the ordinary case you need neither call: `send()` prices the packet itself.

### What Contributes to Event Size

Size still matters for readers and for length-priced routes, so it is worth knowing where a highlight's bytes go:
- Event envelope (kind, pubkey, created_at, id, sig): ~200 bytes overhead
- Content (highlighted passage): typically 50-500 bytes
- Source reference tag (`a`, `e`, or `r`): ~70-150 bytes depending on tag type
- Author tag (`p`): ~70 bytes
- Context tag: 0-500+ bytes (the biggest variable)

### The Context Tag Trade-off

The `context` tag is the biggest size variable in a highlight event and costs nothing on the relay. Decide it on editorial grounds alone:
- **Adds value:** Readers understand the highlight in its original setting without fetching the source
- **Adds noise:** A passage that already speaks for itself is weakened by being reprinted inside a paragraph
- **Decision rule:** Include context when the highlighted passage is ambiguous or surprising without surrounding text. Omit context when the passage is self-explanatory.

| Context Decision | Example | Size Impact |
|-----------------|---------|-------------|
| No context needed | "The best code is no code at all." | 0 extra bytes |
| Brief context | One sentence before and after | +100-200 bytes |
| Full context | Full paragraph surrounding the highlight | +300-500 bytes |

## Economic Dynamics of Highlights on TOON

### Flat Pricing Is a Floor, Not a Length Limit

On free platforms, highlighting is frictionless -- users can highlight everything without cost. On TOON, each highlight is a micro-payment against a funded channel, which puts a floor under the act. What that floor does not do is police length: a focused sentence and a wholesale block quote are charged identically, so any argument for brevity is about the reader, not the bill.

### Highlights vs Other Engagement Types

| Engagement | Kind | What It Signals |
|-----------|------|-----------------|
| Reaction | 7 | "I approve of this" |
| Highlight | 9802 | "This specific passage is noteworthy" |
| Repost | 6 | "Everyone should see this" |
| Comment | 1111 | "I have something to add" |
| Short note | 1 | "Here is my thought" |

Each of these is one event on the relay's flat-priced route, so all five cost the same. What separates them is meaning, not money. Highlights occupy a unique niche -- they are more specific than reactions (which approve the whole event) and more curated than reposts (which share the whole event). A highlight says "I read this carefully and this particular passage stood out."

### Highlight Frequency Economics

A reader highlighting 5-10 passages a day spends 5-10 base units a day, on the order of a hundredth of a cent a month. The cost floor is real but small; on its own it filters nothing. What actually deters low-effort highlighting is that each highlight needs a funded channel and is published under your pubkey, where your followers see the whole feed.

### The Highlight as Attribution

Publishing a highlight with a `p` tag notifies the source author. On TOON, this notification carries extra weight because the highlighter paid to publish it. Unlike free platforms where highlights are invisible to authors, TOON highlights are paid endorsements of specific passages -- a stronger signal of appreciation than a free "like."

## Integration with Protocol Core

For the complete TOON write model, read model, and route-pricing details, refer to `skills/nostr-protocol-core/references/toon-protocol-context.md`. This file covers highlight-specific extensions; the protocol core covers the foundational mechanics shared by all event kinds.
