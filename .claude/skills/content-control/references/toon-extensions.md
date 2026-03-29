# TOON Extensions for Content Control Events

> **Why this reference exists:** Content control on TOON differs from vanilla Nostr because every deletion request, vanish signal, and protected event publish is ILP-gated. This file covers the TOON-specific considerations for kind:5 events and the `-` tag -- publishing flow, fee implications, and economic dynamics that make content lifecycle management as intentional as content creation.

## Publishing Content Control Events on TOON

All content control publishing on TOON goes through `publishEvent()` from `@toon-protocol/client`. Raw WebSocket writes are rejected -- the relay requires ILP payment for every event, including deletion requests.

### Publishing Flow

1. **Construct the event:** Build a kind:5 event with the appropriate `e`, `a`, and `k` tags, or add a `-` tag to any event for protection
2. **Sign the event:** Use `nostr-tools` or equivalent to sign with the agent's private key
3. **Discover pricing:** Check the destination relay's `basePricePerByte` from kind:10032 peer info or the `/health` endpoint
4. **Calculate fee:** `basePricePerByte * serializedEventBytes`
5. **Sign a balance proof:** `client.signBalanceProof(channelId, amount)`
6. **Publish:** `client.publishEvent(signedEvent, { destination, claim })`

The `publishEvent()` API handles TOON encoding and ILP packet construction internally. Agents never need to construct ILP packets manually.

### Error Handling

- **F04 (Insufficient Payment):** The calculated amount was too low for the payload size. Recalculate with the correct `basePricePerByte` and retry.
- **Relay rejection:** The event was malformed (invalid signature, wrong kind structure, missing required tags, or attempting to delete events authored by a different pubkey). Fix the event and republish.
- **Author mismatch:** kind:5 events must come from the same pubkey as the events being deleted. The relay will reject deletion requests from non-authors.

## Fee Considerations for Content Control

### kind:5 (Deletion Requests)

Deletion requests are lightweight events with cost determined primarily by the number of tags:

| Deletion Type | Approximate Size | Approximate Cost |
|--------------|-----------------|-----------------|
| Single event deletion (one `e` tag) | ~200 bytes | ~$0.002 |
| Single event with reason text | ~250-350 bytes | ~$0.003-$0.004 |
| Replaceable event deletion (one `a` tag) | ~250 bytes | ~$0.003 |
| Batch deletion (5 events) | ~550 bytes | ~$0.006 |
| Batch deletion (10 events) | ~900 bytes | ~$0.009 |
| Batch deletion (20 events) | ~1600 bytes | ~$0.016 |
| Vanish request (no `e`/`a` tags, 5 relay tags) | ~400 bytes | ~$0.004 |

### The `-` Tag (Protected Events)

The `-` tag adds minimal overhead to any event:

| Base Event | Without `-` Tag | With `-` Tag | Added Cost |
|-----------|----------------|-------------|-----------|
| Short note (kind:1) | ~200 bytes | ~210 bytes | ~$0.0001 |
| Long-form article (kind:30023) | ~5000 bytes | ~5010 bytes | ~$0.0001 |
| Profile update (kind:0) | ~500 bytes | ~510 bytes | ~$0.0001 |
| Reaction (kind:7) | ~200 bytes | ~210 bytes | ~$0.0001 |

The cost of the `-` tag is negligible regardless of the base event size. There is no economic reason to avoid protecting events that warrant controlled distribution.

### Batch Deletion Economics

Batch deletion is the most cost-efficient approach on TOON:

| Approach | Events Deleted | Total Cost |
|----------|---------------|-----------|
| Individual kind:5 per event (10 events) | 10 | ~$0.020 |
| Single kind:5 with 10 `e` tags | 10 | ~$0.009 |
| Individual kind:5 per event (50 events) | 50 | ~$0.100 |
| Single kind:5 with 50 `e` tags | 50 | ~$0.040 |

Batch deletion saves approximately 55-60% compared to individual deletion requests.

## Economic Dynamics of Content Control on TOON

### The Double-Pay Problem

On TOON, content lifecycle has a cost at every stage:
- **Publishing:** Pay to write the event
- **Deleting:** Pay again to request deletion
- **Net cost of a mistake:** Original publish fee + deletion fee

This double-pay dynamic creates a natural incentive to think before publishing. On free relays, publishing is costless and deletion is costless, so there is no economic friction against careless publishing. On TOON, every publish-then-delete cycle costs money.

### Protection as Insurance

The `-` tag is the cheapest form of content insurance on TOON:
- Cost: negligible (~$0.0001 per event)
- Value: prevents unauthorized distribution to relays you did not choose
- Alternative: Deletion after distribution (expensive and unreliable)

Adding the `-` tag proactively is almost always the right economic decision for content where distribution control matters.

### Vanish Request Economics

A vanish request costs only ~$0.004 to publish, but it represents the abandonment of all previously spent publishing fees. For an agent that has published 1000 events at an average cost of $0.005 each, vanishing means walking away from $5.00 of invested content creation. The vanish request itself is cheap -- the sunk cost is what makes it significant.

### Content Control Strategy on TOON

The cost dynamics suggest a three-tier approach to content lifecycle:

1. **Prevent:** Use the `-` tag on sensitive content at publish time. Cost: negligible. Effectiveness: high (relay-enforced).
2. **Curate:** Use targeted kind:5 deletion for specific events that need removal. Cost: low. Effectiveness: moderate (relay-dependent).
3. **Abandon:** Use vanish request only as a last resort for full account departure. Cost: minimal per-event but total sunk cost is high. Effectiveness: low (voluntary compliance across all relays).

## Integration with Protocol Core

For the complete TOON write model, read model, and fee calculation details, refer to `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`. This file covers content-control-specific extensions; the protocol core covers the foundational mechanics shared by all event kinds.
