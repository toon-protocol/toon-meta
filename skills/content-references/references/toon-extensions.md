# TOON Extensions for Content References

> **Why this reference exists:** Content references on TOON travel inside paid writes. This file covers the TOON-specific considerations for embedding `nostr:` URIs in events -- reference sizes, what the relay actually charges for them, the `client.send()` integration, and extracting references from the plain NIP-01 JSON a read returns.

## Publishing Events with References on TOON

All event publishing on TOON goes through `client.send()` from `@toon-protocol/client`. Raw WebSocket writes are rejected -- the relay requires ILP payment for every event. References are embedded within the `content` field of events published through this API.

### Publishing Flow for Events Containing References

1. **Construct the event:** Build the event (kind:1, kind:30023, kind:1111, etc.) with `nostr:` URIs embedded in the `content` field
2. **Add corresponding tags:** For each inline `nostr:` URI, add the matching `p`, `e`, or `a` tag to the event's tags array
3. **Sign the event:** Use nostr-tools or equivalent to sign with the agent's private key
4. **Send it:** `await client.send({ body: signedEvent })`

`send()` seals the payload to the terminating connector, reads the route's price, mints the covering claim and carries it -- there is no separate pricing, claim-signing or publish step, and an agent never builds an ILP packet. TOON format is the encoding of those sealed write bytes, and only of those: reads come back as ordinary NIP-01 JSON. A REJECT comes back as `{ fulfilled: false }`; it is never thrown.

Where you genuinely need the price in advance, ask the node: `await client.routePrice(destination)` returns `{ price, pricePerKib? }`, and `chargeFor(terms, sealedBytes)` from `@toon-protocol/client` turns those terms into a charge. A node's free, unauthenticated `GET /ilp` self-description carries the same facts for every route -- a connector answers, it never announces.

### Error Handling

- **F03 (INVALID_AMOUNT):** the claim did not cover the charge. This is underpayment, and it is what you get for computing a charge from the event JSON you wrote: the metered quantity is the **sealed** payload, which is larger by the envelope and the wrap. Let `send()` price the packet.
- **T04:** the amount is over the peering's cap. The reject message states the cap -- that is the only way a sender learns it.
- **Relay rejection:** Malformed event (invalid signature, missing required tags for inline URIs). Fix and republish.

## Size of Content References

Each `nostr:` URI and its corresponding tag add bytes to the event. On the relay's flat-priced route they do not add to the charge; they matter when a reference-heavy event is stored on a length-priced route such as `g.toon.store`.

### URI Sizes

| URI Type | Approximate URI Size | Notes |
|----------|---------------------|-------|
| `nostr:npub1...` | ~69 bytes | `nostr:` prefix (6) + bech32 npub (63 chars) |
| `nostr:note1...` | ~69 bytes | `nostr:` prefix (6) + bech32 note (63 chars) |
| `nostr:nprofile1...` | ~80-120 bytes | Longer due to TLV-encoded relay hints |
| `nostr:nevent1...` | ~80-140 bytes | TLV relay hints + author pubkey + kind |
| `nostr:naddr1...` | ~80-150 bytes | TLV kind + pubkey + d-tag + relay hints (longest) |

### Tag Sizes

Each inline URI requires a corresponding tag in the event's tags array:

| Tag Type | Approximate Tag Size | Notes |
|----------|---------------------|-------|
| `["p", "<hex-pubkey>"]` | ~70 bytes | 64-char hex pubkey + JSON overhead |
| `["e", "<hex-event-id>"]` | ~70 bytes | 64-char hex event ID + JSON overhead |
| `["a", "<kind>:<pubkey>:<d-tag>"]` | ~100-150 bytes | Compound identifier, size varies with d-tag length |

### Combined Reference Sizes

| Scenario | URI Bytes | Tag Bytes | Total Added |
|----------|-----------|-----------|-------------|
| 1 user mention (npub1) | ~69 | ~70 | ~139 |
| 1 note embed (nevent1) | ~100 | ~70 | ~170 |
| 1 article link (naddr1) | ~120 | ~130 | ~250 |
| 3 user mentions | ~200 | ~210 | ~410 |
| Short note + 3 mentions | ~350 content + ~410 refs | | ~760 total |
| Article + 5 references | ~5000 content + ~800 refs | | ~5800 total |

### What This Costs

Nothing extra. `g.toon.relay` is flat-priced at 1 base unit of 6-decimal USDC per event: a bare note, a note with three mentions and a 5 KB article with five references are all charged the same 1. Size only reaches the bill on a length-priced route -- `g.toon.store` charges `1000 + 10 per KiB` of sealed payload -- and there the quantity is the sealed bytes, not the table above.

The TLV entities (`nprofile1`, `nevent1`, `naddr1`) are larger than the simple entities (`npub1`, `note1`) but provide relay hints that improve reference resolution. On the relay this used to be a tradeoff and is no longer one: the hints are free, so prefer them.

## Extracting References from Received Events

Reads are free and speak plain NIP-01: the relay returns standard JSON `EVENT` messages, and a free read never touches a connector. To extract references from received events:

1. **Take the event's `content` field** straight from the JSON the relay returned -- there is nothing to decode first
2. **Scan content for `nostr:` URIs** using string matching (look for `nostr:` prefix followed by bech32 characters)
3. **Decode each bech32 entity** per NIP-19 to extract the underlying data (pubkeys, event IDs, relay hints, etc.)
4. **Cross-reference with event tags** to verify tag correspondence -- each URI should have a matching tag

### Reference Resolution from Received Events

After extracting and decoding references:
- **npub1 / nprofile1:** Fetch the profile (kind:0) using the decoded pubkey. Use relay hints from nprofile1 for cross-relay resolution.
- **note1 / nevent1:** Fetch the event using the decoded event ID. Use relay hints from nevent1 if the local relay does not have the event.
- **naddr1:** Fetch the parameterized replaceable event using decoded kind + pubkey + d-tag. This always resolves to the latest version.

Reading referenced events from TOON relays is free (no ILP payment for subscriptions/reads).

## Integration with Protocol Core

For the complete TOON write model, read model, and route-pricing details, refer to `skills/nostr-protocol-core/references/toon-protocol-context.md`. This file covers reference-specific extensions; the protocol core covers the foundational mechanics shared by all event kinds.
