# TOON Extensions for DVM Protocol

> **Why this reference exists:** DVM operations on TOON differ fundamentally from vanilla NIP-90 because of the prepaid model -- the job request IS the payment. This file covers TOON-specific DVM extensions: the prepaid payment model, how route pricing replaces Lightning invoices, the economics of job requests and results, and how a client finds out what a service costs on the TOON network.

## The Prepaid Model: Job Request IS Payment

On standard Nostr relays, NIP-90 uses a request-negotiate-pay cycle:
1. Client submits job request with a `bid` tag
2. Provider responds with kind:7000 `payment-required` and a Lightning invoice
3. Client pays the invoice
4. Provider processes the job

On TOON, the model is simplified to prepaid:
1. Client submits the kind:5xxx job request with `client.send()` -- sending it pays the price of the route that terminates it
2. Provider processes the job (payment already received)
3. Provider publishes the kind:6xxx result

There is no separate settlement step. The payment is atomic with the event publication. Where the work itself is a priced TOON route -- as kind:5094 blob storage is -- that route's price *is* the price of the work, and the `payment-required` negotiation round-trip disappears entirely.

### Why Prepaid Works on TOON

Every write on TOON requires payment. The job request event (kind:5xxx) is a write operation, so it arrives already paid: the client's `send()` minted a claim covering the terminating route's price. Where the DVM work is itself a terminated route, the provider that terminates it has been paid for the work by the same packet that delivered the request.

### When Payment Negotiation Still Happens

The prepaid model does not eliminate all negotiation. kind:7000 `payment-required` feedback is still used when:

- The provider's work is not itself a priced TOON route, so the relay's flat price bought the event's publication and nothing more
- The job requires more compute than initially estimated
- The route's terms changed between the client's last `routePrice()` read and the send
- The job involves variable-cost work where the final price depends on processing results

In these cases, the provider publishes kind:7000 with `payment-required` and `amount` tag, and the client can submit a new kind:5xxx request with the adjusted payment.

## Finding Out What a Service Costs

Nothing on TOON announces its prices. A connector answers: `GET /ilp` on a node's URL returns its self-description -- its addresses, its settlement facts (chain, token, decimals) and every route's price. It is free and unauthenticated. An unpaid request to a priced route is answered with a greeting carrying that route's terms.

From a client, the same information arrives through the client:

```ts
const terms = await client.routePrice('g.toon.store');  // { price, pricePerKib? }
```

`chargeFor(terms, sealedBytes)` from `@toon-protocol/client` turns those terms into the number that goes on a claim. It is the only thing that should decide what goes on a claim, and in the ordinary case you do not need even that -- `send()` prices the packet itself.

The live routes, probed 2026-08-28:

| Route | Price | Terminates |
|-------|-------|------------|
| `g.toon.relay` | 1, flat | Nostr event publishing -- every DVM event kind |
| `g.toon.store` (also `g.toon.relay.store`) | 1000 + 10/KiB | kind:5094 Arweave blob storage |
| `g.toon.gas` | 1000, flat | the gas station |

A price belongs to a terminated route and is a schedule over payload length: flat when it has no slope, otherwise `price + pricePerKib * ceil(sealedBytes / 1024)`. Prices are in the settlement token's smallest unit; USDC is 6-decimal, so `1_000_000` = $1. A fee is a different thing -- flat per packet, belonging to the peering, never to a route.

## Publishing Flow on TOON

### Job Request (kind:5xxx)

1. **Construct the kind:5xxx event.** Add `i` tags for input, `output` tag for expected result type, `param` tags for parameters, and optionally `p` tag for a specific provider.
2. **Sign the event.**
3. **Send it:** `await client.send({ body: signedJobRequest })`. The client seals the payload to the terminating connector, reads the route's price, mints the covering claim and carries it -- there is no separate pricing, claim-signing or publish step. Pass a destination as a leading string argument (`client.send('g.toon.store', { body })`) to reach a route other than the node's own published address.

A REJECT arrives as `{ fulfilled: false }`; it is never thrown. `F03` INVALID_AMOUNT means the claim did not cover the charge -- underpayment. `T04` means the peering's cap was exceeded, and the message states the cap, which is the only way a sender learns it. `F02` means nothing routes that name and `T01` means the peer was not there.

### Job Result (kind:6xxx)

Providers publish results with `client.send()` -- result publication is a paid write too, at the relay's flat price, borne by the provider.

### Job Feedback (kind:7000)

Each feedback event is a paid write at the relay's flat price: 1 base unit, whatever the status message says. That is a gate, not a deterrent -- providers should still minimize unnecessary status updates, because the scarce resource is the client's attention rather than the base units.

### Application-specific Data (kind:30078)

kind:30078 is parameterized replaceable. Updates replace the previous version, so you pay per update -- one flat base unit each -- but never accumulate storage for outdated data. The relay retains one version.

## What DVM Events Cost

Every DVM event kind -- kind:5xxx requests, kind:6xxx results, kind:7000 feedback, kind:30078 app data -- is published to the relay, whose route is **flat**: 1 base unit of 6-decimal USDC per event. Size does not enter into it. A ~200-byte feedback event, a ~2.5 KB job request with a long prompt and a ~6 KB text result all cost the same 1 base unit.

That makes the old advice to keep DVM payloads small for cost reasons simply wrong on the relay. Keep them small for the honest reasons -- bandwidth, relay storage, and providers' parse cost -- and budget by counting events, not bytes.

### The one route with a slope

kind:5094 blob storage terminates at the store route (`g.toon.store`, also reachable as `g.toon.relay.store`), priced `1000 + 10 per KiB`. A small blob is about 1010 base units, roughly $0.00101. Here size does move the price -- but the metered quantity is the **sealed** payload the PREPARE carries, not the event JSON you wrote, which is smaller by the envelope and the wrap. You therefore cannot work the charge out from your own byte count. Read `client.routePrice('g.toon.store')` and pass the terms to `chargeFor()`, or just let `send()` price the packet.

### Costs borne by the provider

Publishing a kind:6xxx result and any kind:7000 feedback are paid writes borne by the provider, one flat base unit each. A provider's own pricing must cover compute cost + one base unit per event it publishes + margin.

## TOON-specific DVM Economics

### Job Request as Economic Signal

On TOON, submitting a job request is paying for a service. The prepaid model creates clear economic alignment:

- **Clients** pay upfront through an open channel and a signed claim. There is no anonymous free job request -- though at 1 base unit that is a gate, not a price that makes spam uneconomic.
- **Providers** receive payment atomically with the request. No invoice chasing.
- **Quality incentive** -- providers who deliver poor results lose reputation but keep the payment. Repeat business depends on quality.

### Provider Economics

Providers must balance three costs:
1. **Monitoring cost** -- subscribing to incoming job requests is free (reads are free)
2. **Compute cost** -- the actual work of processing the job (provider's infrastructure)
3. **Result publication cost** -- one flat base unit per kind:6xxx result and per kind:7000 feedback event

A viable provider's own price must cover compute cost + result publication cost + margin.

### Job Pipelining Economics

Chained DVM jobs (using `"job"` input type) are separate payments, one per step, and pipeline costs are additive. On the relay's flat route each step's publication is 1 base unit regardless of what it carries, so a pipeline's cost is driven by its step count and by any step that terminates a sloped route such as the blob store. Design pipelines with the minimum necessary steps.

### Broadcast vs Targeted Requests

- **Broadcast** (no `p` tag): All providers monitoring for the job kind can respond. Creates competition but may yield multiple responses (each costing the provider a base unit to publish).
- **Targeted** (`p` tag set): Only the specified provider should respond. Reduces provider waste but removes competition.

On TOON, broadcast requests are more efficient for the client (read responses for free, pick the best one). Targeted requests are more efficient for providers (no wasted result publications).

## Integration with Protocol Core

For the complete TOON write model, read model, and route pricing details, refer to `skills/nostr-protocol-core/references/toon-protocol-context.md`. This file covers DVM-specific protocol extensions; the protocol core covers the foundational mechanics shared by all event kinds.
