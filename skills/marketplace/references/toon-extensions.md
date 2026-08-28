# TOON Extensions for Marketplace

> **Why this reference exists:** Marketplace operations on TOON differ from vanilla Nostr because every listing creation, update, and order message is a paid write over ILP. This file covers TOON-specific marketplace economics -- how parameterized replaceable events affect listing costs, the relationship between marketplace listings and DVM compute services, and the economic dynamics of commerce on a paid relay network.

## Publishing Marketplace Events on TOON

All marketplace events are published with `client.send()` from `@toon-protocol/client`. Raw WebSocket writes are rejected -- the relay requires ILP payment.

### Publishing Flow

1. **Construct the event** -- kind:30017 (stall), kind:30018 (product), or kind:30402 (classified)
2. **Sign the event** with your Nostr private key
3. **Send it:** `await client.send({ body: signedEvent })`. The client seals the payload to the terminating connector, reads the route's price, mints the covering claim and carries it -- there is no separate pricing, claim-signing or publish step.

Where you genuinely need the price in advance, ask for it: `await client.routePrice(destination)` returns `{ price, pricePerKib? }`, and `chargeFor(terms, sealedBytes)` from `@toon-protocol/client` turns that into a charge. The metered quantity is the **sealed** payload, so a charge cannot be computed from the event JSON you wrote.

### Error Handling

- **F03 (INVALID_AMOUNT):** the claim does not cover the charge -- underpayment. Let `send()` price the packet rather than supplying an amount of your own.
- **T04:** over the peering's cap. The reject message states the cap; that message is the only way a sender learns it.
- **F02:** nothing routes that name. **T01:** the peer was not there.
- A REJECT comes back as `{ fulfilled: false }`; it is never thrown.
- **Relay rejection:** malformed event or invalid signature. Fix and republish.

## Fee Considerations for Marketplace Events

The relay route (`g.toon.relay`) is **flat-priced**: 1 base unit of 6-decimal USDC per event, probed 2026-08-28. That one fact replaces the whole genre of size-based cost tables:

| Event | Publishing charge |
|-------|-------------------|
| kind:30017 stall -- minimal or elaborate | 1 base unit |
| kind:30018 product -- one image or eight specs | 1 base unit |
| kind:30402 classified -- brief or long-form | 1 base unit |

Shipping zones, image URLs, spec pairs and `t` tags all add bytes to the event, and **none of them changes what publishing costs**. A price is a schedule over payload length; the relay's has no slope. Where a route does have one -- blob storage on `g.toon.store` is `1000` plus `10` per KiB -- the metered quantity is the **sealed** payload the PREPARE carries, not the event JSON, so it is not something an agent can compute for itself. Ask `routePrice()`.

## Replaceable Event Economics

All three marketplace event kinds are parameterized replaceable (30000-39999 range). This has significant economic implications on TOON:

### Updating Listings Costs the Same as Creating Them

Publishing an updated stall, product, or classified with the same `d` tag replaces the previous version on the relay. It is a fresh paid write at the same flat price as the original. There is no "update discount."

### Cost-Saving Strategy: Batch Updates

Rather than making frequent small updates (each a full publish), batch multiple changes into a single republish:

- **Bad:** Update price, then update description, then update images = 3 publications = 3x cost
- **Good:** Update price + description + images in one republish = 1 publication = 1x cost

### No Accumulating Storage Costs

Unlike subscription-based hosting, TOON charges once per publish. A listing that sits unchanged for months costs nothing after the initial publication, and the relay retains exactly one version of it. This favors stable, well-crafted listings over constantly-updated ones.

### Version History Not Preserved

Relays retain only the latest version of a parameterized replaceable event. If you update a product's price, the old price is gone. Agents tracking price history must subscribe to updates and record them externally.

## Listing Quality Incentives

TOON's paid write creates listing quality incentives that differ from free marketplace platforms -- but be honest about where the friction actually sits.

### Spam Filtering Through Economic Friction

On free Nostr relays, anyone can publish thousands of product listings for nothing. On TOON the relay's flat price is small in absolute terms -- 1,000 listings is 1,000 base units, about $0.001 -- so the price by itself is not what stops a spammer. The real friction is structural: every write must arrive with a covering claim drawn on an open, funded payment channel that a settlement chain can enforce. A spammer needs an identity that has deposited real value and can be charged, not merely a WebSocket.

### Conciseness Is Editorial, Not Economic

Size does not change the relay's charge. Concise descriptions, focused specs and disciplined `t` tagging remain good practice -- they make listings readable and discoverable -- but they save nothing. The one place size genuinely costs money is blob storage: keep images on an external host (NIP-96) or the store route, never embedded in the event.

### Economic Commitment Signal

When a merchant pays to publish a listing on TOON, they signal economic commitment to the offering. Buyers can infer that listings on TOON carry more credibility than identical listings on free relays, because the merchant staked a funded channel on the listing's existence.

## DVM Service Marketplace Mapping

TOON's DVM protocol (NIP-90) and marketplace protocol (NIP-15) can be used together to create compute service marketplaces:

### Mapping DVM Services to NIP-15 Structures

| DVM Concept | NIP-15 Mapping | Example |
|------------|----------------|---------|
| DVM provider | Stall (kind:30017) | A text generation provider creates a stall |
| Compute service | Product (kind:30018) | Each supported job kind becomes a product listing |
| Service capability | Product specs | `["model", "gpt-4"]`, `["max_tokens", "4096"]` |
| Compute pricing | Product price | Price per job or per token |
| Provider discovery | Stall/product search | Browse DVM providers like browsing a store |

### Why Map DVM to NIP-15?

NIP-15 provides a structured, human-readable way to browse DVM services. There is no announce-based service directory on TOON: a connector **answers** with its own self-description at `GET /ilp` -- its addresses, its settlement facts and every route's price -- and never announces them. That answer tells a client what a node charges once you already know the node; it is not a directory. A NIP-15 product listing is the discoverable, human-browsable layer over the same offering.

### Example: DVM Provider as a Stall

```json
{
  "kind": 30017,
  "content": "{\"id\":\"ai-compute-services\",\"name\":\"Alice's AI Compute\",\"description\":\"Text generation and translation DVM services\",\"currency\":\"USD\",\"shipping\":[{\"id\":\"digital\",\"name\":\"Digital Delivery\",\"cost\":0,\"regions\":[\"Worldwide\"]}]}",
  "tags": [["d", "ai-compute-services"]]
}
```

### Example: DVM Job Kind as a Product

```json
{
  "kind": 30018,
  "content": "{\"id\":\"text-gen-gpt4\",\"stall_id\":\"ai-compute-services\",\"name\":\"Text Generation (GPT-4)\",\"description\":\"AI text generation via kind:5000 DVM requests\",\"currency\":\"USD\",\"price\":0.05,\"quantity\":999,\"specs\":[[\"dvm_kind\",\"5000\"],[\"model\",\"gpt-4\"],[\"max_tokens\",\"4096\"],[\"input_types\",\"text, url, event\"]]}",
  "tags": [
    ["d", "text-gen-gpt4"],
    ["t", "dvm"],
    ["t", "ai"],
    ["t", "text-generation"]
  ]
}
```

Clients can browse DVM services using standard NIP-15 marketplace queries, then submit actual job requests using kind:5xxx via the DVM protocol.

## Order Negotiation Economics

Order negotiation via NIP-17 encrypted DMs has its own cost profile on TOON.

Each order message -- type 0, type 1, type 2 -- is one paid write to the relay at the flat route price, 1 base unit apiece. Gift-wrap overhead makes the event larger but does not make it cost more. A complete order flow is therefore priced by its **number of messages**, not their length: a three-message negotiation costs 3 base units, a chatty ten-message one costs 10.

Keep that separate from the money that actually matters in an order -- the merchant's asking price, settled outside the protocol by whatever method the type-1 payment request names.

### Optimization: Complete Information Upfront

Minimize back-and-forth by including complete information in the initial order request. Every additional DM is another paid write and another round trip. Provide:

- All product IDs and quantities in the `items` array
- Shipping zone ID
- Contact information
- Any special instructions in the `message` field

## Integration with Protocol Core

For the complete TOON write model, read model, and pricing details, refer to `skills/nostr-protocol-core/references/toon-protocol-context.md`. This file covers marketplace-specific extensions; the protocol core covers the foundational mechanics shared by all event kinds.
