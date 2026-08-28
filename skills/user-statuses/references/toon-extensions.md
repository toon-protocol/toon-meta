# TOON Extensions for User Statuses

> **Why this reference exists:** User status events on TOON differ from vanilla Nostr because every write is ILP-gated. This file covers the TOON-specific considerations for kind:30315 events -- publishing flow, fee implications, and economic dynamics that shape status management on a paid network.

## Publishing Status Events on TOON

All status event publishing on TOON goes through `client.send()` from `@toon-protocol/client`. Raw WebSocket writes are rejected -- the relay is a paid route, and every event must arrive with a claim that covers it.

### Publishing Flow

1. **Construct the event:** Build a kind:30315 event with `d` tag, content, and optional tags (`r`, `expiration`, `emoji`)
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

## What Status Events Cost

### The Live Relay Route Is Flat

`g.toon.relay` is priced at **1 base unit, flat** -- no slope. Settlement is in USDC, which is 6-decimal, so that is $0.000001 per write, and a 150-byte status and a 450-byte one cost the same. On this route, size does not enter into it.

Do not carry that assumption to another route. A price belongs to a terminated route and is a schedule over payload length: flat when it has no slope, otherwise `price + pricePerKib * ceil(sealedBytes / 1024)`, in kibibytes. Ask with `await client.routePrice(destination)`, then `chargeFor(terms, sealedBytes)`. The metered quantity is the **sealed** payload, not the event JSON.

### kind:30315 (User Status)

| Status Type | Approximate Size |
|-------------|-----------------|
| Minimal (short text, d tag only) | ~150-200 bytes |
| General with r tag URL | ~250-350 bytes |
| Music with r tag and expiration | ~300-400 bytes |
| Custom with emoji tags | ~350-450 bytes |
| Clear status (empty content) | ~150-200 bytes |

Status events are among the lightest events on TOON -- short text with minimal tags. Even with an `r` tag and expiration, a status rarely exceeds 400 bytes, which sits comfortably inside one kibibyte on any sloped route too.

## Economic Dynamics of Statuses on TOON

### Parameterized Replaceable Saves Writes

kind:30315 is parameterized replaceable, meaning each new status replaces the previous one for the same `d` tag:
- The relay discards the old event, freeing storage
- Nothing accumulates, so there is no growing payload over time
- A user who updates their status 100 times pays for 100 writes, but never for a longer one

Compare this with non-replaceable events (like kind:1 notes) where every update is additive and permanently stored.

### Expiration Eliminates a Write

Using the NIP-40 `expiration` tag for inherently temporary statuses (conference attendance, streaming, meeting availability) removes the need for a separate clearing event:

| Pattern | Events Published | Total Charge (flat relay route) |
|---------|-----------------|---------------------------------|
| Set status + clear manually | 2 events | 2 base units |
| Set status with expiration | 1 event | 1 base unit |

That is a real saving of one paid write and one round trip -- half the traffic, and one fewer thing to remember.

### The Gate, Not a Deterrent

It is tempting to say that paying makes status spam expensive. At 1 base unit of 6-decimal USDC it does not: cycling a status every minute for a day costs $0.00144. Any argument for restraint that rests on cost is off by orders of magnitude.

What paying does is **gate**. Every status update must arrive with a signed claim on an open payment channel, so a status is attributable to a settlement identity somebody provisioned, and the update rate is bounded by that channel's throughput rather than by a budget. The reason not to cycle a status every minute is that it is noise to your followers, not that it is expensive.

### Conciseness

Keep status text short for the reader, not for the bill. On the flat relay route "Working on SDK" and "Currently engaged in development work on the TOON Protocol Software Development Kit" cost exactly the same; the first is simply better.

### Multi-Slot Independence

Each `d` tag value is a separate replaceable slot. Maintaining multiple active statuses (general + music + custom) means one write per slot -- three active statuses is three writes, and three base units on the flat relay route. Updating one slot does not affect the others, so you only write when a specific status changes.

## Integration with Protocol Core

For the complete TOON write model, read model, and pricing details, refer to `skills/nostr-protocol-core/references/toon-protocol-context.md`. This file covers status-specific extensions; the protocol core covers the foundational mechanics shared by all event kinds.
