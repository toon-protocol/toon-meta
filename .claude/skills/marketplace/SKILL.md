---
name: marketplace
description: Marketplace and classified listings on Nostr and TOON Protocol using NIP-15
  and NIP-99. Covers stall creation ("how do I create a marketplace listing?", "how do I
  set up a shop on Nostr?", kind:30017, NIP-15, stall event, merchant profile, shipping
  zones, currency), product listings ("how do I list a product on Nostr?", "how do I sell
  something on Nostr?", kind:30018, product event, product images, product specs, product
  price, product quantity, category tags), classified listings ("how do I create a classified
  listing?", "how do I post a classified ad on Nostr?", kind:30402, NIP-99, classified ad,
  listing title, listing price, location tag, listing summary), order negotiation ("how do
  I buy something on Nostr?", "how does ordering work on Nostr?", DM-based orders, NIP-17
  direct messages, buyer-merchant communication), and listing discovery ("how do I find
  products on Nostr?", "how do I search for listings?", "how do I browse a marketplace?",
  stall discovery, product search, classified search, category browsing). Implements NIP-15
  and NIP-99 on TOON's ILP-gated network where stalls, products, and classifieds cost
  per-byte to publish.
---

# Marketplace (TOON)

Decentralized marketplace and classified listings for agents on the TOON network. NIP-15 defines how merchants create stalls (kind:30017) and list products (kind:30018), with order negotiation via direct messages. NIP-99 defines classified listings (kind:30402) for services, real estate, jobs, and other non-product offerings. All three event kinds are parameterized replaceable events using `d` tags for stable identifiers.

This skill covers the full marketplace lifecycle: creating merchant stalls, listing products with pricing and inventory, posting classified ads, discovering listings, and negotiating orders. On TOON, every marketplace write operation costs per-byte via `publishEvent()`, creating an economic quality signal -- merchants pay to list, which filters spam listings absent from free relays.

## Marketplace Model

NIP-15 provides a structured e-commerce model. A merchant publishes a **stall** (kind:30017) that defines their shop identity, accepted currency, and shipping options. Products (kind:30018) reference their parent stall and contain structured pricing, inventory, images, and specifications. Buyers discover products via relay queries and negotiate orders via encrypted direct messages (NIP-17).

NIP-99 provides a simpler **classified listing** model (kind:30402) for things that are not traditional products: services, real estate, job postings, event tickets, rentals. Classifieds use markdown content with structured tags for title, price, location, and category.

Both models use parameterized replaceable events (`d` tag), meaning merchants can update listings by republishing with the same `d` tag value. Only the latest version is retained by relays.

## Stall Events (kind:30017)

Stalls are merchant profiles that define the shop context for products.

**Event structure:**
- **Kind:** 30017 (parameterized replaceable)
- **Content:** JSON string with stall details
- **Tags:** `["d", "<stall-id>"]` (unique stall identifier)

**Content JSON fields:**
- `id` (required) -- unique stall identifier (must match `d` tag)
- `name` (required) -- stall display name
- `description` (optional) -- stall description
- `currency` (required) -- ISO 4217 currency code (e.g., "USD", "EUR", "BTC")
- `shipping` (required) -- array of shipping zone objects

**Shipping zone object:**
- `id` -- unique shipping zone identifier
- `name` -- zone name (e.g., "Worldwide", "North America")
- `cost` -- shipping cost in the stall's currency
- `regions` -- array of region codes (ISO 3166-1 alpha-2 country codes)

**Example content JSON:**
```json
{
  "id": "my-stall-001",
  "name": "Alice's Digital Shop",
  "description": "Handcrafted digital goods and services",
  "currency": "USD",
  "shipping": [
    {
      "id": "ship-worldwide",
      "name": "Digital Delivery",
      "cost": 0,
      "regions": ["Worldwide"]
    },
    {
      "id": "ship-us",
      "name": "US Shipping",
      "cost": 5.99,
      "regions": ["US"]
    }
  ]
}
```

## Product Events (kind:30018)

Products are individual listings within a stall.

**Event structure:**
- **Kind:** 30018 (parameterized replaceable)
- **Content:** JSON string with product details
- **Tags:** `["d", "<product-id>"]`, `["t", "<category>"]` (one or more category tags)

**Content JSON fields:**
- `id` (required) -- unique product identifier (must match `d` tag)
- `stall_id` (required) -- the `d` tag of the parent stall (kind:30017)
- `name` (required) -- product display name
- `description` (optional) -- product description
- `images` (optional) -- array of image URLs
- `currency` (required) -- ISO 4217 currency code (should match the stall currency)
- `price` (required) -- numeric price in the specified currency
- `quantity` (required) -- available inventory count (0 = out of stock)
- `specs` (optional) -- array of `[key, value]` specification pairs
- `shipping` (optional) -- array of shipping cost overrides per zone

**Example content JSON:**
```json
{
  "id": "product-001",
  "stall_id": "my-stall-001",
  "name": "Custom Nostr Avatar",
  "description": "Hand-drawn digital avatar in your preferred style",
  "images": ["https://example.com/avatar-sample-1.png", "https://example.com/avatar-sample-2.png"],
  "currency": "USD",
  "price": 25.00,
  "quantity": 10,
  "specs": [
    ["format", "PNG"],
    ["resolution", "1024x1024"],
    ["delivery", "48 hours"]
  ]
}
```

**Category tags:** Products use `t` tags for categorization. Multiple `t` tags allow a product to appear in multiple category searches.

## Classified Listings (kind:30402)

Classified listings are general-purpose advertisements for services, real estate, jobs, and other non-product offerings.

**Event structure:**
- **Kind:** 30402 (parameterized replaceable)
- **Content:** Markdown description of the listing
- **Tags:**
  - `["d", "<listing-id>"]` -- unique listing identifier
  - `["title", "<title>"]` -- listing title (required)
  - `["summary", "<summary>"]` -- short summary (optional)
  - `["published_at", "<unix-timestamp>"]` -- original publication timestamp
  - `["location", "<location-string>"]` -- geographic location (optional)
  - `["price", "<amount>", "<currency>", "<frequency>"]` -- pricing info (optional; frequency examples: "hour", "month", "one-time")
  - `["t", "<tag>"]` -- category/topic tags (one or more)
  - `["e", "<event-id>", "<relay-url>"]` -- references to related events (optional)
  - `["a", "<kind>:<pubkey>:<d-tag>", "<relay-url>"]` -- references to replaceable events (optional)

**Example event:**
```json
{
  "kind": 30402,
  "content": "# Senior Nostr Developer\n\nWe are looking for an experienced developer...\n\n## Requirements\n- 3+ years of experience\n- Familiarity with NIP specifications\n\n## Benefits\n- Remote work\n- Competitive salary",
  "tags": [
    ["d", "job-senior-dev-2026"],
    ["title", "Senior Nostr Developer - Remote"],
    ["summary", "Full-time remote position for experienced Nostr developer"],
    ["published_at", "1711540000"],
    ["location", "Remote"],
    ["price", "120000", "USD", "year"],
    ["t", "job"],
    ["t", "developer"],
    ["t", "remote"]
  ]
}
```

## Order Negotiation via Direct Messages

NIP-15 defines order negotiation through encrypted direct messages (NIP-17, kind:14). The flow is:

1. **Buyer sends order request.** A DM to the merchant containing a JSON order object with product IDs, quantities, shipping zone, and contact information.
2. **Merchant confirms or rejects.** A DM back with order status, total price, and payment instructions.
3. **Buyer sends payment proof.** A DM with payment confirmation (transaction ID, receipt, etc.).
4. **Merchant confirms fulfillment.** A DM with shipping/delivery details.

Order messages are standard NIP-17 private DMs. On TOON, each DM costs per-byte (~$0.004-$0.015 per message). See the `private-dms` skill for DM construction and costs.

**Order request JSON (sent as DM content):**
```json
{
  "type": 0,
  "id": "<order-id>",
  "items": [
    {"product_id": "product-001", "quantity": 1}
  ],
  "shipping_id": "ship-worldwide",
  "contact": {
    "nostr": "<buyer-pubkey>",
    "email": "buyer@example.com"
  }
}
```

**Order status types:**
- `type: 1` -- payment request (merchant sends payment details)
- `type: 2` -- order shipped/fulfilled

## TOON Write Model

All marketplace events are published via `publishEvent()` from `@toon-protocol/client`. Each write costs `basePricePerByte * serializedEventBytes`.

| Event Type | Approximate Size | Cost at 10n/byte |
|-----------|-----------------|------------------|
| Stall (kind:30017) | ~400-800 bytes | ~$0.004-$0.008 |
| Product (kind:30018) | ~500-1200 bytes | ~$0.005-$0.012 |
| Classified (kind:30402) | ~400-2000 bytes | ~$0.004-$0.020 |
| Order DM (kind:14 via NIP-17) | ~400-800 bytes | ~$0.004-$0.008 |

Products with many images, long descriptions, or extensive specs cost more. Keep listings concise to minimize per-byte costs. Updating a listing (republishing with the same `d` tag) costs the same as creating a new one.

For the full fee formula and `publishEvent()` API, read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`.

## TOON Read Model

Query marketplace events using kind filters:

- **Stalls:** `kinds: [30017]`, filter by `#d` (stall ID) or author pubkey
- **Products:** `kinds: [30018]`, filter by `#d` (product ID), `#t` (category), or author pubkey
- **Classifieds:** `kinds: [30402]`, filter by `#d` (listing ID), `#t` (category/tag), or author pubkey

TOON relays return TOON-format strings in EVENT messages, not standard JSON objects. Use the TOON decoder to parse marketplace events. Reading is free on TOON.

To find all products in a stall, query by the merchant's pubkey and kind:30018, then filter by `stall_id` in the parsed content JSON. To browse by category, use `#t` tag filters.

For TOON format parsing details, read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`.

## Social Context

Marketplace listings on TOON carry an economic quality signal. The per-byte cost to publish means merchants pay to list, which naturally filters spam and low-effort listings that plague free marketplace platforms. This is a feature, not a bug -- it creates a marketplace where listings have nonzero economic commitment behind them.

**Pricing considerations on a paid network:**
- Keep product descriptions concise but informative. Every byte costs money.
- Use external image hosting (NIP-96) for product images rather than embedding image data.
- Use `t` tags strategically for discoverability but do not over-tag -- each tag adds bytes.
- Stall updates (changing shipping zones, currency) cost the same as creation. Batch changes rather than making frequent small updates.

**Classified listing best practices:**
- Use markdown formatting in kind:30402 content for readability, but keep it lean.
- Include the `price` tag for machine-readable pricing -- do not put price only in the markdown body.
- Use `location` tag for geographic relevance even for remote/digital services.
- Set `published_at` to indicate freshness -- stale classifieds lose credibility.

**Order negotiation etiquette:**
- Keep order DMs structured (use the JSON format). Unstructured messages are harder to process and cost the same per-byte.
- Merchants should respond promptly to order requests. Silence after payment is a trust violation.
- Include a `contact` field in order requests to provide fallback communication channels.

**Anti-patterns to avoid:**
- Publishing products without a parent stall -- products reference a `stall_id` that must exist as a kind:30017 event
- Putting structured product data in kind:30402 classifieds -- use kind:30018 for actual products with inventory
- Using raw WebSocket writes instead of `publishEvent()` on TOON
- Listing items at price 0 with quantity 0 as "coming soon" placeholders -- this wastes per-byte cost
- Omitting the `d` tag -- without it, you cannot update the listing later

## When to Read Each Reference

Read the appropriate reference file based on the situation:

- **Understanding NIP-15 stall/product protocol and NIP-99 classified format** -- Read [nip-spec.md](references/nip-spec.md) for the full NIP specifications.
- **Understanding TOON-specific marketplace economics and DVM service mapping** -- Read [toon-extensions.md](references/toon-extensions.md) for ILP-gated marketplace extensions.
- **Step-by-step stall creation, product listing, classified posting, and discovery workflows** -- Read [scenarios.md](references/scenarios.md) for complete operational workflows.
- **TOON write model, read model, and fee calculation details** -- Read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md` (canonical protocol reference, D9-010).
- **Order negotiation via encrypted DMs** -- See `private-dms` for NIP-17 DM construction, gift wrapping, and per-message costs.
- **Product images via NIP-96 file storage** -- See `media-and-files` for kind:1063 file metadata and `imeta` tag format; see `file-storage` for NIP-96 upload workflow.
- **DVM service marketplace mapping** -- Read [toon-extensions.md](references/toon-extensions.md) for how DVM compute services map to NIP-15 stalls and products.
- **Discovering relay pricing for listing fees** -- See `relay-discovery` for NIP-11 relay info and TOON `/health` endpoint.
- **Social judgment on marketplace interactions** -- See `nostr-social-intelligence` for base social intelligence.
