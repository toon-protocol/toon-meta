# TOON Extensions for Identity Events

> **Why this reference exists:** Identity events on TOON differ from vanilla Nostr because every write is ILP-gated. This file covers the TOON-specific considerations for kind:0 and kind:3 events -- publishing flow, fee implications, and economic dynamics that shape identity management on a paid network.

## Publishing Identity Events on TOON

All identity event publishing on TOON goes through `client.send()` from `@toon-protocol/client`. Raw WebSocket writes are rejected -- the relay is a paid route, and every event must arrive with a claim that covers it.

### Publishing Flow

1. **Construct the event:** Build a kind:0 or kind:3 event with the appropriate fields and tags
2. **Sign the event:** Use `nostr-tools` or equivalent to sign with the agent's private key
3. **Send it:** `await client.send({ body: signedEvent })`

That is the whole write path. `send()` seals the payload to the terminating connector's key, prices it, mints the covering claim and carries it. An agent never signs a claim by hand and never builds a packet.

### Asking What It Costs

Where a price is genuinely needed up front, ask the node instead of multiplying bytes:

```ts
const terms = await client.routePrice('g.toon.relay');  // { price, pricePerKib? }
const charge = chargeFor(terms, sealedBytes);
```

A **price** belongs to a terminated route and is a schedule over payload length: flat when it has no slope, otherwise `price + pricePerKib * ceil(sealedBytes / 1024)` -- per kibibyte, never per byte. The metered quantity is the **sealed** payload the PREPARE carries, which is larger than the event JSON by the envelope and the wrap, so an agent cannot work the charge out from the event it wrote. `chargeFor` is the only thing that should decide what goes on a claim.

A node's free, unauthenticated self-description at `GET /ilp` publishes every route's price alongside its addresses and settlement facts. The `/health` price endpoint and `basePricePerByte` were both removed along with the `kind:10032` announce; the self-description replaced them.

The `client.send()` API handles TOON encoding and ILP packet construction internally. Agents never need to construct ILP packets manually.

### Error Handling

A refusal comes back as `{ fulfilled: false }`; it is never thrown.

- **`F03` INVALID_AMOUNT:** the claim does not cover the charge. This is underpayment -- re-read the route's terms with `routePrice()` and send again. There is no `F04`.
- **`T04`:** over the peering's cap. The reject's message states the cap; that is the only way a sender learns it.
- **`F02` / `T01`:** nothing routes that name, or the peer was not there.
- **Relay rejection:** The event was malformed (invalid signature, wrong kind structure). Fix the event and republish.

## What Identity Events Cost

### The Live Relay Route Is Flat

`g.toon.relay` is priced at **1 base unit, flat** -- no slope. Settlement is in USDC, which is 6-decimal, so that is $0.000001 per write, and it is the same figure for a 200-byte profile and a 15 KB follow list. Size does not change the charge on this route.

Do not assume that for another route. A price belongs to a terminated route and is a schedule over payload length: flat when it has no slope, otherwise `price + pricePerKib * ceil(sealedBytes / 1024)`, in kibibytes. Ask with `await client.routePrice(destination)`, then `chargeFor(terms, sealedBytes)`.

### kind:0 (Profile Metadata)

| Profile Complexity | Approximate Size |
|-------------------|-----------------|
| Minimal (name + about) | ~200 bytes |
| Standard (name, about, picture, nip05, display_name) | ~500 bytes |
| Full (all NIP-24 fields + NIP-39 i tags) | ~1500-2000 bytes |

Because kind:0 is replaceable, each update is a full replacement. Include all desired fields in every update -- there are no partial updates. Even changing a single field means republishing the whole profile. On a flat route that costs no more than a minimal one; what it costs is one more paid write.

### kind:3 (Follow List)

Follow list size scales linearly with the number of follows:

| Follow Count | Approximate Size |
|-------------|-----------------|
| 10 follows | ~400 bytes |
| 50 follows | ~1500 bytes |
| 100 follows | ~3000 bytes |
| 500 follows | ~15000 bytes |

Each follow add or remove requires publishing the entire updated list. On the flat relay route that is one write's charge whatever the list's length -- the thing to economise on is the **number** of updates, not their size.

## Economic Dynamics of Identity on TOON

### The Gate, Not a Deterrent

It is tempting to say that paying makes bad behaviour expensive. At 1 base unit of 6-decimal USDC it does not: a million profile updates cost a dollar. The payment is a **gate**, not a price.

What the gate actually requires is that every write arrive with a signed claim on an open payment channel. Before an identity can publish anything at all, it needs a settlement identity and a funded channel behind it -- and every write it makes is attributable to that channel. That is the property that distinguishes a TOON profile from a free-relay one: not that it was expensive, but that somebody with a funded, on-chain-anchored identity stood behind it.

So the honest claim is narrow and worth making:
- A profile on TOON was published by an identity that had already opened and funded a channel.
- Bot farms are not priced out; they are gated behind provisioning a channel per identity.
- Profile churn is bounded by the throughput of the channel, not by its cost.

### Follow List as a Signal

A follow list published on TOON is a public declaration made through a funded, attributable channel. Its weight comes from that attribution, not from the size of a bill -- on the live relay route, a 10,000-entry list costs the same 1 base unit as a 10-entry one.

### Identity Update Frequency

Batch identity changes anyway, because each update is a separate paid write and a separate round trip:
- Update multiple profile fields in a single kind:0 publish rather than publishing separately for each field
- Build up follow list changes and publish once rather than after every individual follow/unfollow decision
- Consider whether a profile update adds enough value to justify another write

### NIP-05 and NIP-39 as Trust Amplifiers

On TOON, the combination of paid identity + verifiable external links creates stronger trust signals than either alone:
- A profile that paid to publish (ILP cost) + has a verified NIP-05 (domain control) + has verified NIP-39 links (cross-platform identity) provides multiple independent trust indicators
- Each layer is independently verifiable
- The economic cost of maintaining this identity across updates makes it expensive to fake over time

## Integration with Protocol Core

For the complete TOON write model, read model, and fee calculation details, refer to `skills/nostr-protocol-core/references/toon-protocol-context.md`. This file covers identity-specific extensions; the protocol core covers the foundational mechanics shared by all event kinds.
