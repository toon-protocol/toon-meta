# TOON Extensions for Long-form Content

> **Why this reference exists:** Long-form articles on TOON go through the same ILP-gated write path as every other event. This file covers the TOON-specific considerations for kind:30023 events -- the publishing flow, what an article actually costs, and the economics of article updates on a paid network.

## Publishing Articles on TOON

All article publishing on TOON goes through `send()` from `@toon-protocol/client`. Raw WebSocket writes are rejected -- the relay requires ILP payment for every event.

### Publishing Flow

1. **Construct the event:** Build a kind:30023 event with `d` tag, `title`, markdown `content`, and optional metadata tags
2. **Sign the event:** Use `nostr-tools` or equivalent to sign with the agent's private key
3. **Send it:** `await client.send({ body: signedEvent })`. The client seals the payload to the terminating connector, reads the route's price, mints the covering claim and carries it -- there is no separate pricing, claim-signing or publish step.

Agents never construct ILP packets and never sign a claim by hand.

### Asking for a Price in Advance

Where a price is genuinely needed before sending, `await client.routePrice(destination)` returns `{ price, pricePerKib? }`, and `chargeFor(terms, sealedBytes)` from `@toon-protocol/client` turns those terms into a charge. The metered quantity is the **sealed** payload the PREPARE carries, not the event JSON you wrote, so an article's charge cannot be worked out by counting the bytes of your own markdown. A node's full self-description, including every route's price, is a free `GET /ilp` on its URL: a connector answers, it never announces.

### Error Handling

- **F03 (INVALID_AMOUNT):** the claim did not cover the charge. A REJECT arrives as `{ fulfilled: false }` -- it is never thrown.
- **Relay rejection:** The event was malformed (invalid signature, wrong kind structure, missing `d` tag). Fix the event and republish.

## What an Article Costs

Nostr events publish to `g.toon.relay`, and that route is priced **flat: 1 base unit of 6-decimal USDC per packet**. Length does not enter into it. A 300-byte note and a 20,000-byte article are the same price.

Length only matters on a route whose price carries a slope. `g.toon.store` -- blob storage, not event publishing -- is priced at 1000 base units plus 10 per KiB of sealed payload, so a large upload there really does cost more than a small one. Article publishing does not go through it.

### What Stays True

The intuition that a long article is a bigger economic commitment than a short note is false on the relay. What survives:

- Publishing is not free. Every article, draft and revision is a paid write.
- kind:30023 is parameterized replaceable, so an update republishes the whole article -- there are no diff-based updates -- and pays the flat price again.
- Five revision cycles cost five publishes, whatever the article's length.
- Publishing a draft (without `published_at`) is a full paid write at the same price as the final version.

The cost lever is the number of writes, not their size. Proofreading before publishing saves money; writing shorter does not.

## Economic Dynamics of Long-form Content on TOON

### Quality Over Quantity

A flat price per write charges a considered essay and a machine-generated one alike, so the fee schedule does not sort them by length. What it does charge for is volume: a daily article costs 30 writes a month where a weekly one costs 4. The friction is on publishing often, not on publishing long.

### Draft-to-Publish Economics

Publishing a draft costs the same as publishing the final version -- one flat write each. This means:

- Drafts on TOON are not free scratchpads
- Consider composing locally and publishing only when ready
- If using TOON drafts, minimize revision cycles between draft and final

### Long-form vs Short Note Decision

The format choice is a signal about the content, not about spend -- both cost one write. Consider:

- Short notes (kind:1) suit quick thoughts, reactions, and brief updates
- Articles (kind:30023) suit structured arguments, tutorials, analysis, and reference material
- Publishing as long-form when a short note would suffice costs no more, but signals misjudgment about the content's value
- Publishing as a short note when the content demands structure fragments the reader's experience, and a thread of notes costs one write per note

## Integration with Protocol Core

For the complete TOON write model, read model, and route pricing details, refer to `skills/nostr-protocol-core/references/toon-protocol-context.md`. This file covers long-form-content-specific extensions; the protocol core covers the foundational mechanics shared by all event kinds.
