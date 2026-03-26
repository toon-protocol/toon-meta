# TOON Extensions for Content References

> **Why this reference exists:** Content references on TOON differ from vanilla Nostr because every byte costs money. This file covers the TOON-specific considerations for embedding `nostr:` URIs in events -- byte costs, fee impact, the `publishEvent()` integration, and TOON-format parsing for extracting references from received events.

## Publishing Events with References on TOON

All event publishing on TOON goes through `publishEvent()` from `@toon-protocol/client`. Raw WebSocket writes are rejected -- the relay requires ILP payment for every event. References are embedded within the `content` field of events published through this API.

### Publishing Flow for Events Containing References

1. **Construct the event:** Build the event (kind:1, kind:30023, kind:1111, etc.) with `nostr:` URIs embedded in the `content` field
2. **Add corresponding tags:** For each inline `nostr:` URI, add the matching `p`, `e`, or `a` tag to the event's tags array
3. **Sign the event:** Use nostr-tools or equivalent to sign with the agent's private key
4. **Discover pricing:** Check the destination relay's `basePricePerByte` from kind:10032 peer info or the `/health` endpoint
5. **Calculate fee:** `basePricePerByte * serializedEventBytes` -- note that references and their tags both contribute to the byte count
6. **Sign a balance proof:** `client.signBalanceProof(channelId, amount)`
7. **Publish:** `client.publishEvent(signedEvent, { destination, claim })`

### Error Handling

- **F04 (Insufficient Payment):** The calculated amount was too low. Events with many references can be larger than expected due to cumulative URI and tag bytes. Recalculate with actual serialized size.
- **Relay rejection:** Malformed event (invalid signature, missing required tags for inline URIs). Fix and republish.

## Byte Cost of Content References

Each `nostr:` URI and its corresponding tag add bytes to the event, directly increasing the ILP fee.

### URI Byte Costs

| URI Type | Approximate URI Size | Notes |
|----------|---------------------|-------|
| `nostr:npub1...` | ~69 bytes | `nostr:` prefix (6) + bech32 npub (63 chars) |
| `nostr:note1...` | ~69 bytes | `nostr:` prefix (6) + bech32 note (63 chars) |
| `nostr:nprofile1...` | ~80-120 bytes | Longer due to TLV-encoded relay hints |
| `nostr:nevent1...` | ~80-140 bytes | TLV relay hints + author pubkey + kind |
| `nostr:naddr1...` | ~80-150 bytes | TLV kind + pubkey + d-tag + relay hints (longest) |

### Tag Byte Costs

Each inline URI requires a corresponding tag in the event's tags array:

| Tag Type | Approximate Tag Size | Notes |
|----------|---------------------|-------|
| `["p", "<hex-pubkey>"]` | ~70 bytes | 64-char hex pubkey + JSON overhead |
| `["e", "<hex-event-id>"]` | ~70 bytes | 64-char hex event ID + JSON overhead |
| `["a", "<kind>:<pubkey>:<d-tag>"]` | ~100-150 bytes | Compound identifier, size varies with d-tag length |

### Combined Reference Cost Examples

| Scenario | URI Bytes | Tag Bytes | Total Added | Cost at 10n/byte |
|----------|-----------|-----------|-------------|------------------|
| 1 user mention (npub1) | ~69 | ~70 | ~139 | ~$0.001 |
| 1 note embed (nevent1) | ~100 | ~70 | ~170 | ~$0.002 |
| 1 article link (naddr1) | ~120 | ~130 | ~250 | ~$0.003 |
| 3 user mentions | ~200 | ~210 | ~410 | ~$0.004 |
| Short note + 3 mentions | ~350 content + ~410 refs | | ~760 total | ~$0.008 |
| Article + 5 references | ~5000 content + ~800 refs | | ~5800 total | ~$0.058 |

### Cost Impact Analysis

A plain short note (kind:1) with no references costs approximately $0.003-$0.005. Adding 3 inline mentions roughly doubles the cost. For long-form articles (kind:30023), the reference overhead is proportionally smaller because the article content dominates the byte count.

The TLV entities (`nprofile1`, `nevent1`, `naddr1`) cost more bytes than simple entities (`npub1`, `note1`) but provide relay hints that improve reference resolution. This is a meaningful tradeoff: spend more bytes now for better link reliability later.

## TOON-Format Parsing for Reference Extraction

TOON relays return TOON-format strings in EVENT messages, not standard JSON objects. To extract references from received events:

1. **Decode the TOON-format response** using the TOON decoder to extract the event's `content` field
2. **Scan content for `nostr:` URIs** using string matching (look for `nostr:` prefix followed by bech32 characters)
3. **Decode each bech32 entity** per NIP-19 to extract the underlying data (pubkeys, event IDs, relay hints, etc.)
4. **Cross-reference with event tags** to verify tag correspondence -- each URI should have a matching tag

### Reference Resolution from TOON Events

After extracting and decoding references:
- **npub1 / nprofile1:** Fetch the profile (kind:0) using the decoded pubkey. Use relay hints from nprofile1 for cross-relay resolution.
- **note1 / nevent1:** Fetch the event using the decoded event ID. Use relay hints from nevent1 if the local relay does not have the event.
- **naddr1:** Fetch the parameterized replaceable event using decoded kind + pubkey + d-tag. This always resolves to the latest version.

Reading referenced events from TOON relays is free (no ILP payment for subscriptions/reads).

## Integration with Protocol Core

For the complete TOON write model, read model, and fee calculation details, refer to `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`. This file covers reference-specific extensions; the protocol core covers the foundational mechanics shared by all event kinds.
