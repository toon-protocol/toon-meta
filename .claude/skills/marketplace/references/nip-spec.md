# NIP-15 and NIP-99 Specification: Marketplace and Classified Listings

> **Why this reference exists:** NIP-15 defines the Nostr Marketplace protocol for stalls (kind:30017), products (kind:30018), and DM-based order negotiation. NIP-99 defines classified listings (kind:30402) for services, real estate, jobs, and other non-product offerings. Agents need to understand the event structures, content JSON schemas, tag formats, and the order negotiation flow. This reference covers the protocol mechanics; TOON-specific extensions are in toon-extensions.md.

## NIP-15: Nostr Marketplace

NIP-15 defines a decentralized marketplace protocol using three components:

1. **Stalls (kind:30017)** -- merchant profiles with currency and shipping configuration
2. **Products (kind:30018)** -- individual product listings within a stall
3. **Order negotiation** -- buyer-merchant communication via encrypted direct messages

All marketplace events are parameterized replaceable events (using `d` tags), meaning merchants can update their stalls and products by republishing with the same `d` tag value. Relays retain only the latest version.

### Stall Events (kind:30017)

Stalls represent a merchant's shop. Each stall defines the accepted currency and available shipping zones.

**Event structure:**

```json
{
  "kind": 30017,
  "content": "<JSON-string>",
  "tags": [
    ["d", "<stall-id>"]
  ],
  "pubkey": "<merchant-pubkey>",
  "created_at": "<unix-timestamp>",
  "id": "<event-id>",
  "sig": "<signature>"
}
```

**Content JSON schema:**

```json
{
  "id": "<stall-id>",
  "name": "<stall-name>",
  "description": "<optional-description>",
  "currency": "<ISO-4217-currency-code>",
  "shipping": [
    {
      "id": "<shipping-zone-id>",
      "name": "<zone-name>",
      "cost": "<numeric-cost>",
      "regions": ["<ISO-3166-1-alpha-2-code>", "..."]
    }
  ]
}
```

**Field definitions:**

- `id` (string, required): Unique stall identifier. Must match the `d` tag value.
- `name` (string, required): Human-readable stall name.
- `description` (string, optional): Description of the stall or merchant.
- `currency` (string, required): ISO 4217 currency code (e.g., `"USD"`, `"EUR"`, `"BTC"`, `"SAT"`). All prices in associated products use this currency.
- `shipping` (array, required): Array of shipping zone objects. At least one zone should be defined.

**Shipping zone fields:**

- `id` (string, required): Unique identifier for the shipping zone.
- `name` (string, required): Human-readable zone name (e.g., `"Worldwide"`, `"North America"`, `"Digital Delivery"`).
- `cost` (number, required): Shipping cost in the stall's currency. Use `0` for free or digital delivery.
- `regions` (array, required): Array of ISO 3166-1 alpha-2 country codes (e.g., `["US", "CA"]`). Use `["Worldwide"]` for global delivery.

**Example stall:**

```json
{
  "kind": 30017,
  "content": "{\"id\":\"vintage-records\",\"name\":\"Bob's Vintage Records\",\"description\":\"Curated collection of rare vinyl records\",\"currency\":\"USD\",\"shipping\":[{\"id\":\"us-standard\",\"name\":\"US Standard\",\"cost\":4.99,\"regions\":[\"US\"]},{\"id\":\"international\",\"name\":\"International\",\"cost\":14.99,\"regions\":[\"Worldwide\"]}]}",
  "tags": [["d", "vintage-records"]]
}
```

### Product Events (kind:30018)

Products are individual listings within a stall. Each product references its parent stall via `stall_id` and contains pricing, inventory, images, and specifications.

**Event structure:**

```json
{
  "kind": 30018,
  "content": "<JSON-string>",
  "tags": [
    ["d", "<product-id>"],
    ["t", "<category-tag>"],
    ["t", "<another-category-tag>"]
  ],
  "pubkey": "<merchant-pubkey>",
  "created_at": "<unix-timestamp>",
  "id": "<event-id>",
  "sig": "<signature>"
}
```

**Content JSON schema:**

```json
{
  "id": "<product-id>",
  "stall_id": "<parent-stall-d-tag>",
  "name": "<product-name>",
  "description": "<optional-description>",
  "images": ["<url>", "..."],
  "currency": "<ISO-4217-currency-code>",
  "price": "<numeric-price>",
  "quantity": "<available-inventory>",
  "specs": [["<key>", "<value>"], ["<key>", "<value>"]],
  "shipping": [
    {
      "id": "<shipping-zone-id>",
      "cost": "<override-cost>"
    }
  ]
}
```

**Field definitions:**

- `id` (string, required): Unique product identifier. Must match the `d` tag value.
- `stall_id` (string, required): The `d` tag value of the parent stall (kind:30017). The product inherits the stall's currency and shipping unless overridden.
- `name` (string, required): Human-readable product name.
- `description` (string, optional): Product description. May include markdown formatting.
- `images` (array, optional): Array of image URLs for the product. Use external hosting (e.g., NIP-96 servers).
- `currency` (string, required): ISO 4217 currency code. Should match the parent stall's currency.
- `price` (number, required): Numeric price in the specified currency.
- `quantity` (number, required): Available inventory count. `0` means out of stock. Clients should check this before allowing orders.
- `specs` (array, optional): Array of `[key, value]` pairs for product specifications (e.g., `[["color", "red"], ["size", "large"]]`).
- `shipping` (array, optional): Array of shipping cost overrides per zone. Each entry has an `id` (matching a stall shipping zone) and a `cost` (overriding the stall's default for this product).

**Category tags:** The `t` tags on the event (not in the content JSON) define searchable categories. Multiple `t` tags allow products to appear in multiple category filters.

**Example product:**

```json
{
  "kind": 30018,
  "content": "{\"id\":\"abbey-road-lp\",\"stall_id\":\"vintage-records\",\"name\":\"Abbey Road - Original 1969 Pressing\",\"description\":\"Original UK pressing in VG+ condition. Includes inner sleeve.\",\"images\":[\"https://files.example.com/abbey-road-front.jpg\",\"https://files.example.com/abbey-road-back.jpg\"],\"currency\":\"USD\",\"price\":150.00,\"quantity\":1,\"specs\":[[\"condition\",\"VG+\"],[\"year\",\"1969\"],[\"label\",\"Apple Records\"],[\"pressing\",\"UK Original\"]]}",
  "tags": [
    ["d", "abbey-road-lp"],
    ["t", "vinyl"],
    ["t", "music"],
    ["t", "beatles"],
    ["t", "classic-rock"]
  ]
}
```

### Order Negotiation Protocol

NIP-15 defines a simple order negotiation flow using encrypted direct messages. Orders are JSON objects sent as the content of NIP-17 private DMs (kind:14).

**Message types:**

| Type | Direction | Purpose |
|------|-----------|---------|
| `0` | Buyer -> Merchant | New order request |
| `1` | Merchant -> Buyer | Payment request / order confirmation |
| `2` | Merchant -> Buyer | Order status update (shipped, fulfilled) |

**Type 0: Order Request (Buyer -> Merchant)**

```json
{
  "id": "<unique-order-id>",
  "type": 0,
  "name": "<buyer-name>",
  "address": "<shipping-address>",
  "message": "<optional-message-to-merchant>",
  "contact": {
    "nostr": "<buyer-npub>",
    "phone": "<optional-phone>",
    "email": "<optional-email>"
  },
  "items": [
    {
      "product_id": "<product-d-tag>",
      "quantity": 1
    }
  ],
  "shipping_id": "<shipping-zone-id>"
}
```

**Type 1: Payment Request (Merchant -> Buyer)**

```json
{
  "id": "<order-id>",
  "type": 1,
  "message": "<optional-message>",
  "payment_options": [
    {
      "type": "ln",
      "link": "<lightning-invoice>"
    },
    {
      "type": "url",
      "link": "<payment-url>"
    },
    {
      "type": "btc",
      "link": "<bitcoin-address>"
    }
  ]
}
```

**Type 2: Order Status Update (Merchant -> Buyer)**

```json
{
  "id": "<order-id>",
  "type": 2,
  "message": "Your order has been shipped!",
  "paid": true,
  "shipped": true
}
```

**Payment option types:**

- `ln` -- Lightning Network invoice
- `url` -- External payment URL (e.g., payment processor link)
- `btc` -- On-chain Bitcoin address
- Additional types may be defined by merchants (e.g., `"usdc"`, `"paypal"`)

## NIP-99: Classified Listings

NIP-99 defines classified listings (kind:30402) for general-purpose advertisements: services, real estate, job postings, rentals, event tickets, and other non-product offerings. Unlike NIP-15 products, classifieds do not have structured inventory, specifications, or parent stalls. They use markdown content with structured tags.

### Classified Listing Events (kind:30402)

**Event structure:**

```json
{
  "kind": 30402,
  "content": "<markdown-description>",
  "tags": [
    ["d", "<listing-id>"],
    ["title", "<listing-title>"],
    ["summary", "<short-summary>"],
    ["published_at", "<unix-timestamp>"],
    ["location", "<location-string>"],
    ["price", "<amount>", "<currency>", "<frequency>"],
    ["t", "<category-tag>"],
    ["e", "<referenced-event-id>", "<relay-url>"],
    ["a", "<kind>:<pubkey>:<d-tag>", "<relay-url>"]
  ],
  "pubkey": "<author-pubkey>",
  "created_at": "<unix-timestamp>",
  "id": "<event-id>",
  "sig": "<signature>"
}
```

**Tag definitions:**

- `d` (required): Unique listing identifier. Used for parameterized replaceable event addressing.
- `title` (required): Human-readable listing title. Should be concise and descriptive.
- `summary` (optional): Short summary or excerpt. Used for preview displays.
- `published_at` (optional): Unix timestamp of original publication. May differ from `created_at` if the listing was republished/updated.
- `location` (optional): Geographic location string. Free-form text (e.g., `"New York, NY"`, `"Remote"`, `"San Francisco Bay Area"`).
- `price` (optional): Pricing information as a three-element tag:
  - Element 1: Amount (string representation of a number, e.g., `"50000"`)
  - Element 2: Currency code (ISO 4217, e.g., `"USD"`, `"EUR"`, `"BTC"`)
  - Element 3: Frequency/period (e.g., `"hour"`, `"month"`, `"year"`, `"one-time"`, `"flat"`)
- `t` (optional, multiple): Category or topic tags for discoverability.
- `e` (optional): References to specific events (e.g., related listings, discussion threads).
- `a` (optional): References to replaceable events (e.g., related stalls, articles, community definitions).

**Content format:** The content field is markdown. It should contain the full listing description. Structured data (price, location, title) belongs in tags for machine readability; the markdown body provides the human-readable narrative.

**Example classified listing:**

```json
{
  "kind": 30402,
  "content": "# Cozy Mountain Cabin for Rent\n\nBeautiful 2-bedroom cabin in the Blue Ridge Mountains. Perfect for remote workers or weekend getaways.\n\n## Features\n- High-speed fiber internet (1Gbps)\n- Wood-burning fireplace\n- Fully equipped kitchen\n- Mountain views from every window\n- Private hiking trail\n\n## Availability\nAvailable for monthly rentals starting April 2026. Minimum 1-month stay.\n\n## Contact\nDM me on Nostr or email cabin@example.com",
  "tags": [
    ["d", "cabin-rental-2026"],
    ["title", "Mountain Cabin - Remote Worker Friendly"],
    ["summary", "2BR cabin in Blue Ridge Mountains with fiber internet, available for monthly rental"],
    ["published_at", "1711540000"],
    ["location", "Blue Ridge Mountains, NC"],
    ["price", "2500", "USD", "month"],
    ["t", "rental"],
    ["t", "cabin"],
    ["t", "remote-work"],
    ["t", "mountain"]
  ]
}
```

### Use Cases for Classified Listings

NIP-99 classifieds are appropriate for:

- **Services:** Freelance work, consulting, tutoring, design services
- **Real estate:** Rentals, property sales, coworking spaces
- **Jobs:** Job postings, contract opportunities, volunteer positions
- **Events:** Event announcements with ticket pricing
- **Vehicles:** Car sales, boat rentals
- **General:** Anything that does not fit the structured product model of NIP-15

### When to Use NIP-15 vs NIP-99

| Criterion | NIP-15 (kind:30018) | NIP-99 (kind:30402) |
|-----------|---------------------|---------------------|
| Has inventory/quantity | Yes | No |
| Has structured specs | Yes (key-value pairs) | No (markdown body) |
| Has parent stall | Yes (stall_id) | No |
| Has shipping zones | Yes (inherited from stall) | No |
| Has structured pricing | In content JSON | In `price` tag |
| Has location | No | Yes (`location` tag) |
| Content format | JSON | Markdown |
| Best for | Physical/digital products | Services, real estate, jobs |

## Relationship to Other NIPs

- **NIP-17 (Private DMs):** Order negotiation uses NIP-17 encrypted direct messages (kind:14) wrapped in gift wraps (kind:1059). See the `private-dms` skill for DM construction.
- **NIP-96 (File Storage):** Product images should be hosted on NIP-96 file storage servers and referenced by URL in the product's `images` array. See the `file-storage` skill for upload workflow.
- **NIP-94 (File Metadata):** Product images uploaded via NIP-96 produce kind:1063 file metadata events that can be cross-referenced.
- **NIP-50 (Search):** Relays supporting NIP-50 allow full-text search across stall names, product names, and classified content. See the `search` skill.
- **NIP-09 (Deletion):** Merchants can remove listings by publishing kind:5 deletion requests targeting the `a` coordinate of their parameterized replaceable events.

## Security and Trust Considerations

- **No escrow:** NIP-15 has no built-in escrow or dispute resolution. Buyers and merchants negotiate directly. Trust is based on reputation, NIP-05 verification, and transaction history.
- **Order privacy:** Order messages are encrypted via NIP-17. Third parties cannot see order details, payment information, or shipping addresses.
- **Stall authenticity:** Verify the merchant's pubkey via NIP-05 or web-of-trust. Anyone can create a stall -- there is no registration authority.
- **Inventory accuracy:** Product `quantity` is self-reported by the merchant. There is no on-chain inventory tracking. Buyers should confirm availability before paying.
- **Price currency:** The `currency` field is informational. There is no protocol-level currency conversion. Payment methods are negotiated in the order flow.
