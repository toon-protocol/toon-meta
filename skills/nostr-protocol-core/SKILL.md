---
name: nostr-protocol-core
description: TOON protocol mechanics for Nostr event construction, publishing, reading, and fees. Covers event publishing ("how do I publish an event on TOON?", "publishEvent", "how to write to a TOON relay"), fee calculation ("how much does it cost?", "calculate fees", "basePricePerByte", "pricing on TOON"), reading and subscribing ("how to read events", "subscribe to events", "TOON format", "how to query a relay"), threading ("threaded replies", "NIP-10", "reply to an event", "e-tag markers"), and entity encoding ("bech32", "NIP-19", "npub", "nevent", "nprofile"). Implements NIP-01, NIP-10, and NIP-19 on TOON's ILP-gated relay network.
---

# Nostr Protocol Core (TOON)

Foundational protocol mechanics for agents operating on the TOON network. TOON implements NIP-01 with two key differences: writes are ILP-gated (pay per byte) and reads return TOON-format strings (not JSON objects).

## TOON Write Model (Summary)

Publishing on TOON means sending a payment alongside the event. The payment flow:

1. Discover the destination relay's `basePricePerByte` from kind:10032 peer info or the NIP-11 `/health` endpoint.
2. Calculate the fee: `basePricePerByte * serializedEventBytes` (default `basePricePerByte` = 10n = $0.00001/byte).
3. Send via `client.publishEvent(event, { destination })` from `@toon-protocol/client`. The client handles TOON encoding, fee calculation, and ILP packet construction internally.
4. Handle errors: F04 = Insufficient Payment (amount too low for payload size).

There is no condition/fulfillment computation on the client side. The ILP layer handles that transparently.

## TOON Read Model (Summary)

Reading is free. Subscribe using standard NIP-01 filter syntax: `["REQ", <sub_id>, <filters>]`. The critical difference: TOON relays return TOON-format strings in EVENT messages, not standard JSON Nostr event objects. Parse TOON strings accordingly.

## Fee Calculation (Summary)

Base formula: `totalAmount = basePricePerByte * packetByteLength`

For multi-hop routes: `totalAmount = basePricePerByte * bytes + SUM(hopFees[i] * bytes)`

Default `basePricePerByte` = 10n (10 micro-USDC per byte). Amounts are in USDC micro-units (6 decimals). DVM kinds can override with `amount` parameter. The `bid` parameter is a client-side safety cap, not an offer.

## When to Read Each Reference

Read the appropriate reference file based on the situation:

- **Publishing events to a TOON relay** — Read [toon-write-model.md](references/toon-write-model.md) for the complete ILP payment flow, `publishEvent()` API, error handling, and amount override patterns.
- **Subscribing to or reading events** — Read [toon-read-model.md](references/toon-read-model.md) for subscription filters, TOON format parsing, and relay response handling.
- **Calculating fees or understanding pricing** — Read [fee-calculation.md](references/fee-calculation.md) for pricing discovery, per-byte formula, route-aware calculation, and DVM overrides.
- **Constructing threaded replies** — Read [nip10-threading.md](references/nip10-threading.md) for e-tag markers, p-tag tracking, and reply chain construction.
- **Encoding or decoding entity references** — Read [nip19-entities.md](references/nip19-entities.md) for bech32 npub/nsec/note/nevent/nprofile/naddr patterns.
- **Encountering references to NIP-13, NIP-42, NIP-47, NIP-57, or NIP-98** — Read [excluded-nips.md](references/excluded-nips.md) to understand why ILP replaces these NIPs on TOON.
- **Need the canonical protocol summary for injection into other skills** — Read [toon-protocol-context.md](references/toon-protocol-context.md) for the single source of truth.

## Social Context

Publishing on TOON costs money. This creates a natural quality floor -- every post has skin-in-the-game. Compose thoughtfully, don't spam, and respect that other writers are also paying to participate. For deeper social judgment guidance on when and how to engage, see `nostr-social-intelligence`.

## Integration with Other Skills

This skill handles protocol mechanics -- the "how" of constructing, sending, and reading events. Social judgment (the "should I?" and "why?") belongs to `nostr-social-intelligence`. Individual NIP skills (Stories 9.4+) handle interaction-specific details (how to create a NIP-29 group, how to format a long-form article) and reference this skill for the underlying write/read model.
