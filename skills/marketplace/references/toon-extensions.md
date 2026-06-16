# TOON Extensions for Marketplace

> **Why this reference exists:** Marketplace operations on TOON differ from vanilla Nostr because every listing creation, update, and order message costs per-byte via ILP payment. This file covers TOON-specific marketplace economics -- how parameterized replaceable events affect listing costs, the relationship between marketplace listings and DVM compute services, per-byte incentives for listing quality, and the economic dynamics of commerce on a paid relay network.

## Publishing Marketplace Events on TOON

All marketplace events are published via `publishEvent()` from `@toon-protocol/client`. Raw WebSocket writes are rejected -- the relay requires ILP payment.

### Publishing Flow

1. **Construct the event** -- kind:30017 (stall), kind:30018 (product), or kind:30402 (classified)
2. **Sign the event** with your Nostr private key
3. **Discover pricing** from the relay's `basePricePerByte` via kind:10032 or `/health` endpoint
4. **Calculate fee**: `basePricePerByte * serializedEventBytes`
5. **Publish via `publishEvent()`**

### Error Handling

- **F04 (Insufficient Payment):** Recalculate with the correct `basePricePerByte` and retry.
- **Relay rejection:** Malformed event or invalid signature. Fix and republish.

## Fee Considerations for Marketplace Events

### kind:30017 (Stall Creation/Update)

Stall costs depend on the number of shipping zones and description length:

| Stall Profile | Approximate Size | Approximate Cost |
|--------------|-----------------|-----------------|
| Minimal stall (1 shipping zone, short name) | ~350 bytes | ~$0.004 |
| Standard stall (2 shipping zones, description) | ~500 bytes | ~$0.005 |
| Large stall (5+ shipping zones, long description) | ~800-1200 bytes | ~$0.008-$0.012 |

### kind:30018 (Product Listing/Update)

Product costs depend on description, images, and specs:

| Product Profile | Approximate Size | Approximate Cost |
|----------------|-----------------|-----------------|
| Minimal product (name, price, quantity) | ~400 bytes | ~$0.004 |
| Standard product (description, 2 images, 3 specs) | ~700 bytes | ~$0.007 |
| Detailed product (long description, 5 images, 8 specs) | ~1200 bytes | ~$0.012 |

Each image URL adds ~50-100 bytes. Each spec pair adds ~30-50 bytes. Each `t` category tag adds ~20-40 bytes.

### kind:30402 (Classified Listing/Update)

Classified costs are dominated by the markdown content:

| Classified Profile | Approximate Size | Approximate Cost |
|-------------------|-----------------|-----------------|
| Brief listing (short markdown, few tags) | ~400 bytes | ~$0.004 |
| Standard listing (moderate markdown, several tags) | ~800 bytes | ~$0.008 |
| Detailed listing (long markdown, many tags) | ~1500-2000 bytes | ~$0.015-$0.020 |

## Replaceable Event Economics

All three marketplace event kinds are parameterized replaceable (30000-39999 range). This has significant economic implications on TOON:

### Updating Listings Costs the Same as Creating Them

Publishing an updated stall, product, or classified with the same `d` tag replaces the previous version on the relay. The cost is the same per-byte fee as the original publication. There is no "update discount."

### Cost-Saving Strategy: Batch Updates

Rather than making frequent small updates (each costing a full per-byte fee), batch multiple changes into a single republish:

- **Bad:** Update price, then update description, then update images = 3 publications = 3x cost
- **Good:** Update price + description + images in one republish = 1 publication = 1x cost

### No Accumulating Storage Costs

Unlike subscription-based hosting, TOON's per-event pricing means you pay once per publish. A listing that sits unchanged for months costs nothing after the initial publication. This favors stable, well-crafted listings over constantly-updated ones.

### Version History Not Preserved

Relays retain only the latest version of a parameterized replaceable event. If you update a product's price, the old price is gone. Agents tracking price history must subscribe to updates and record them externally.

## Listing Quality Incentives

TOON's per-byte cost creates natural listing quality incentives that differ from free marketplace platforms:

### Spam Filtering Through Economic Friction

On free Nostr relays, anyone can publish thousands of product listings for free, flooding marketplaces with spam. On TOON:

- Publishing 100 spam product listings at ~$0.007 each = ~$0.70
- Publishing 1,000 spam listings = ~$7.00

The cost makes spam economically visible and costly, creating a natural quality floor.

### Conciseness Incentive

Every byte costs money. This incentivizes:

- Concise product descriptions that communicate value efficiently
- External image hosting (NIP-96) rather than embedding image data
- Relevant specs only, not exhaustive attribute lists
- Strategic use of `t` tags for discoverability without over-tagging

### Economic Commitment Signal

When a merchant pays to publish a listing on TOON, they signal economic commitment to the offering. Buyers can infer that listings on TOON carry more credibility than identical listings on free relays, because the merchant invested money in the listing's existence.

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

NIP-15 provides a structured, human-readable way to browse DVM services. While kind:10035 SkillDescriptor is the programmatic discovery mechanism, a NIP-15 product listing makes the same information browsable by humans and marketplace clients.

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

Order negotiation via NIP-17 encrypted DMs has its own cost profile on TOON:

| Message | Approximate Size | Approximate Cost |
|---------|-----------------|-----------------|
| Order request (type 0) | ~400-600 bytes | ~$0.004-$0.006 |
| Payment request (type 1) | ~300-500 bytes | ~$0.003-$0.005 |
| Order status (type 2) | ~200-400 bytes | ~$0.002-$0.004 |
| Gift wrap overhead per message | ~200-400 bytes | ~$0.002-$0.004 |

A complete order flow (request + payment info + confirmation) costs the buyer and merchant a total of ~$0.015-$0.030 across all messages. This is small relative to most product prices but adds up for high-volume merchants.

### Optimization: Complete Information Upfront

Minimize back-and-forth by including complete information in the initial order request. Every additional DM in the negotiation costs per-byte. Provide:

- All product IDs and quantities in the `items` array
- Shipping zone ID
- Contact information
- Any special instructions in the `message` field

## Integration with Protocol Core

For the complete TOON write model, read model, and fee calculation details, refer to `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`. This file covers marketplace-specific extensions; the protocol core covers the foundational mechanics shared by all event kinds.
