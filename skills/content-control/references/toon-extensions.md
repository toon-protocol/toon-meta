# TOON Extensions for Content Control Events

> **Why this reference exists:** Content control on TOON differs from vanilla Nostr because every deletion request, vanish signal, and protected event publish is ILP-gated. This file covers the TOON-specific considerations for kind:5 events and the `-` tag -- publishing flow, pricing implications, and economic dynamics that make content lifecycle management as intentional as content creation.

## Publishing Content Control Events on TOON

All content control publishing on TOON goes through `send()` from `@toon-protocol/client`. Raw WebSocket writes are rejected -- the relay requires ILP payment for every event, including deletion requests.

### Publishing Flow

1. **Construct the event:** Build a kind:5 event with the appropriate `e`, `a`, and `k` tags, or add a `-` tag to any event for protection
2. **Sign the event:** Use `nostr-tools` or equivalent to sign with the agent's private key
3. **Send it:** `await client.send({ body: signedEvent })`

`send()` seals the payload to the terminating connector, reads the route's price, mints the covering claim and carries it. There is no separate pricing, claim-signing or publish step, and an agent never constructs an ILP packet or signs a claim by hand.

Where a price is genuinely needed in advance, ask rather than multiply: `await client.routePrice(destination)` returns `{ price, pricePerKib? }`, then `chargeFor(terms, sealedBytes)` from `@toon-protocol/client`. The metered quantity is the **sealed** payload -- the gift-wrapped bytes the PREPARE carries -- so a charge cannot be computed from the event JSON you wrote.

### Error Handling

- **F03 (INVALID_AMOUNT):** The claim does not cover the charge -- underpayment. Let `send()` price the packet rather than supplying an amount of your own.
- **A REJECT is returned, not thrown:** it comes back as `{ fulfilled: false }`.
- **Relay rejection:** The event was malformed (invalid signature, wrong kind structure, missing required tags, or attempting to delete events authored by a different pubkey). Fix the event and republish.
- **Author mismatch:** kind:5 events must come from the same pubkey as the events being deleted. The relay will reject deletion requests from non-authors.

## Pricing Considerations for Content Control

The relay route (`g.toon.relay`) is **flat**: 1 base unit of 6-decimal USDC per event, whatever the payload length. Every content control write therefore costs the same, and the only quantity that moves your total is the **number of events**.

### kind:5 (Deletion Requests)

A kind:5 is one flat-priced write whether it carries a single `e` tag, twenty `e` tags, an `a` tag, or a reason in its content field. A vanish request is likewise one write.

### The `-` Tag (Protected Events)

The `-` tag costs nothing. On a flat-priced route, protecting a short note and protecting a 5 KiB article both cost exactly what publishing them unprotected would. There is no economic reason to leave off protection where controlled distribution matters.

### Batch Deletion Economics

Because the charge is per event and `e` tags are free, batching is not a marginal saving -- it is the whole saving:

| Approach | Events Deleted | Paid Writes |
|----------|---------------|-------------|
| Individual kind:5 per event | 10 | 10 |
| Single kind:5 with 10 `e` tags | 10 | 1 |
| Individual kind:5 per event | 50 | 50 |
| Single kind:5 with 50 `e` tags | 50 | 1 |

Batch deletion divides the cost by the batch size.

## Economic Dynamics of Content Control on TOON

### The Double-Pay Problem

On TOON, content lifecycle has a cost at every stage:
- **Publishing:** one paid write
- **Deleting:** another paid write to request deletion
- **Net cost of a mistake:** two writes where one would have done

On free relays, publishing and deletion are both costless and anonymous. On TOON both are writes signed from your channel, so a publish-then-delete cycle is charged twice and attributable twice. Two base units will not deter anyone -- what should is that the second write is only a request, and the content may already have travelled.

### Protection as Insurance

The `-` tag is the cheapest form of content insurance on TOON:
- Cost: nothing -- it is carried by a write you were making anyway
- Value: prevents unauthorized distribution to relays you did not choose
- Alternative: deletion after distribution (an extra write, and unreliable)

Adding the `-` tag proactively is almost always the right economic decision for content where distribution control matters.

### Vanish Request Economics

A vanish request is a single flat-priced write, but it represents the abandonment of everything previously paid for. An agent that has published 1000 events has paid 1000 writes; vanishing walks away from all of them. The vanish request itself is cheap -- the sunk cost is what makes it significant.

### Content Control Strategy on TOON

The cost dynamics suggest a three-tier approach to content lifecycle:

1. **Prevent:** Use the `-` tag on sensitive content at publish time. Cost: nothing extra. Effectiveness: high (relay-enforced).
2. **Curate:** Use one batched kind:5 for the events that need removal. Cost: one write. Effectiveness: moderate (relay-dependent).
3. **Abandon:** Use a vanish request only as a last resort for full account departure. Cost: one write, but the sunk cost behind it is everything you published. Effectiveness: low (voluntary compliance across all relays).

## Integration with Protocol Core

For the complete TOON write model, read model, and pricing details, refer to `skills/nostr-protocol-core/references/toon-protocol-context.md`. This file covers content-control-specific extensions; the protocol core covers the foundational mechanics shared by all event kinds.
