# Marketplace Scenarios

> **Why this reference exists:** Agents need step-by-step workflows for common marketplace operations on TOON. Each scenario shows the complete flow from intent to published event, including TOON-specific considerations like per-byte costs, replaceable event economics, and the publishEvent API. These scenarios bridge the gap between knowing the event format (nip-spec.md) and knowing the TOON publishing mechanics (toon-extensions.md).

## Scenario 1: Creating a Stall

**When:** A merchant wants to set up a shop on TOON, defining their accepted currency and shipping options.

**Why this matters:** A stall (kind:30017) is the prerequisite for listing products. Products reference their parent stall via `stall_id`. On TOON, creating a stall costs per-byte, so plan the shipping zones and description carefully before publishing.

### Steps

1. **Choose a stall identifier.** Pick a unique, descriptive `d` tag value (e.g., `"digital-goods-shop"`). This becomes the permanent addressable identifier for the stall.

2. **Define accepted currency.** Choose an ISO 4217 currency code (e.g., `"USD"`, `"EUR"`, `"BTC"`, `"SAT"`). All products in this stall will use this currency.

3. **Configure shipping zones.** Create shipping zone objects with:
   - `id` -- unique zone identifier
   - `name` -- human-readable zone name
   - `cost` -- shipping cost in stall currency (use `0` for digital delivery)
   - `regions` -- array of ISO 3166-1 alpha-2 country codes or `["Worldwide"]`

4. **Construct the content JSON:**
   ```json
   {
     "id": "digital-goods-shop",
     "name": "Alice's Digital Shop",
     "description": "Handcrafted digital goods",
     "currency": "USD",
     "shipping": [
       {
         "id": "digital",
         "name": "Digital Delivery",
         "cost": 0,
         "regions": ["Worldwide"]
       }
     ]
   }
   ```

5. **Build the kind:30017 event.** Set `content` to the JSON string. Add `["d", "digital-goods-shop"]` tag.

6. **Sign the event.**

7. **Calculate the fee.** A stall with one shipping zone and a short description is ~400-500 bytes. At default `basePricePerByte` of 10n, cost is approximately $0.004-$0.005.

8. **Publish via `publishEvent()`** from `@toon-protocol/client`.

### Considerations

- The `d` tag value and the content JSON `id` field must match.
- Keep the description concise -- every byte costs money on TOON.
- Multiple shipping zones increase event size. Define only the zones you actually serve.
- As a parameterized replaceable event, you can update the stall later by republishing with the same `d` tag.

## Scenario 2: Listing a Product

**When:** A merchant wants to list a product for sale within an existing stall.

**Why this matters:** Products (kind:30018) are the core listings that buyers discover. On TOON, product events with many images, long descriptions, or extensive specs cost more per-byte. Keep listings informative but lean.

### Steps

1. **Verify the stall exists.** The product's `stall_id` must reference an existing kind:30017 event's `d` tag. Query to confirm your stall is published.

2. **Choose a product identifier.** Pick a unique `d` tag value (e.g., `"custom-avatar-001"`).

3. **Construct the content JSON:**
   ```json
   {
     "id": "custom-avatar-001",
     "stall_id": "digital-goods-shop",
     "name": "Custom Nostr Avatar",
     "description": "Hand-drawn digital avatar",
     "images": ["https://files.example.com/avatar-sample.png"],
     "currency": "USD",
     "price": 25.00,
     "quantity": 10,
     "specs": [
       ["format", "PNG"],
       ["resolution", "1024x1024"]
     ]
   }
   ```

4. **Add category tags.** Include one or more `["t", "<category>"]` tags for discoverability (e.g., `["t", "digital-art"]`, `["t", "avatar"]`).

5. **Build the kind:30018 event.** Set `content` to the JSON string. Add the `d` tag and `t` tags.

6. **Sign the event.**

7. **Calculate the fee.** A product with one image URL, short description, and two specs is ~500-700 bytes. Cost: ~$0.005-$0.007.

8. **Publish via `publishEvent()`.**

### Considerations

- Host product images externally (NIP-96 file storage servers). Do not embed image data in the event -- it would be extremely expensive per-byte.
- Keep `specs` focused on key product attributes. Exhaustive specs inflate the event size.
- The `quantity` field is self-reported. Update it by republishing with the same `d` tag when inventory changes.
- Use `t` tags strategically but sparingly -- each tag adds ~20-40 bytes.

## Scenario 3: Creating a Classified Listing

**When:** An agent wants to post a classified ad for a service, job, rental, or other non-product offering.

**Why this matters:** Classified listings (kind:30402) use markdown content with structured tags. On TOON, the markdown body is the largest cost driver -- write concisely.

### Steps

1. **Choose a listing identifier.** Pick a descriptive `d` tag value (e.g., `"dev-freelance-2026"`).

2. **Write the listing content in markdown.** Keep it structured and concise:
   ```markdown
   # Freelance Nostr Developer

   Experienced developer available for Nostr and TOON Protocol projects.

   ## Services
   - Custom NIP implementations
   - Relay deployment and configuration
   - DVM provider development

   ## Rates
   Hourly or project-based. DM for details.
   ```

3. **Add structured tags:**
   - `["d", "dev-freelance-2026"]` -- unique identifier
   - `["title", "Freelance Nostr Developer"]` -- listing title
   - `["summary", "Experienced developer for Nostr/TOON projects"]` -- short summary
   - `["published_at", "1711540000"]` -- publication timestamp
   - `["location", "Remote"]` -- location
   - `["price", "150", "USD", "hour"]` -- pricing
   - `["t", "freelance"]`, `["t", "developer"]` -- category tags

4. **Build the kind:30402 event.** Set `content` to the markdown text. Add all tags.

5. **Sign the event.**

6. **Calculate the fee.** A classified with moderate markdown content and several tags is ~600-1000 bytes. Cost: ~$0.006-$0.010.

7. **Publish via `publishEvent()`.**

### Considerations

- Put structured data (price, location, title) in tags for machine readability. The markdown body is for human readers.
- Use the `price` tag with three elements: amount, currency, frequency (e.g., `"hour"`, `"month"`, `"one-time"`).
- Set `published_at` to indicate freshness. Stale classifieds lose credibility.
- Markdown formatting adds bytes. Use headings and lists but avoid excessive formatting.

## Scenario 4: Discovering Listings

**When:** An agent wants to browse or search for products, stalls, or classified listings.

**Why this matters:** Discovery is free on TOON -- reads cost nothing. Efficient filtering saves time and bandwidth.

### Steps

1. **Browse all stalls.** Subscribe for kind:30017 events:
   ```json
   ["REQ", "stalls", { "kinds": [30017] }]
   ```

2. **Browse products by category.** Use `#t` tag filters:
   ```json
   ["REQ", "products", { "kinds": [30018], "#t": ["digital-art"] }]
   ```

3. **Find products in a specific stall.** Query by merchant pubkey and kind:30018, then filter by `stall_id` in the parsed content JSON:
   ```json
   ["REQ", "merchant-products", { "kinds": [30018], "authors": ["<merchant-pubkey>"] }]
   ```

4. **Search classifieds by category.** Use `#t` tag filters:
   ```json
   ["REQ", "classifieds", { "kinds": [30402], "#t": ["freelance"] }]
   ```

5. **Search classifieds by location.** Currently requires fetching all classifieds and filtering client-side by the `location` tag, as most relays do not support location-based filtering.

6. **Parse TOON-format responses.** TOON relays return TOON-format strings in EVENT messages, not JSON objects. Use the TOON decoder to parse each event, then parse the content field as JSON (for products/stalls) or markdown (for classifieds).

7. **Check product availability.** Parse the content JSON and verify `quantity > 0` before initiating an order.

### Considerations

- All discovery queries are free reads on TOON.
- TOON relays return TOON-format strings -- use the TOON decoder before parsing content.
- Products reference stalls via `stall_id` in the content JSON. To display a product with its stall context, fetch both the product and its parent stall.
- Parameterized replaceable events (kind:30017, 30018, 30402) are deduplicated by pubkey + kind + `d` tag. The relay returns only the latest version.
- Use NIP-50 search filters (if the relay supports them) for full-text search across listing content.

## Scenario 5: Initiating an Order

**When:** A buyer wants to purchase a product from a merchant.

**Why this matters:** Order negotiation uses NIP-17 encrypted direct messages. On TOON, each DM costs per-byte (~$0.004-$0.015), so the order conversation has a real cost. Keep messages structured and concise.

### Steps

1. **Identify the product and merchant.** From the kind:30018 event, extract the merchant's pubkey and the product's `id`, `price`, and available `quantity`.

2. **Choose a shipping zone.** From the parent stall (kind:30017), identify the applicable shipping zone's `id` and cost.

3. **Construct the order request JSON:**
   ```json
   {
     "id": "order-001-abc123",
     "type": 0,
     "name": "Bob",
     "address": "123 Main St, Springfield",
     "message": "Please ship ASAP",
     "contact": {
       "nostr": "<buyer-npub>",
       "email": "bob@example.com"
     },
     "items": [
       { "product_id": "custom-avatar-001", "quantity": 1 }
     ],
     "shipping_id": "digital"
   }
   ```

4. **Send as an encrypted DM.** Construct a NIP-17 private DM (kind:14) to the merchant with the order JSON as content. See the `private-dms` skill for DM construction.

5. **Publish the DM via `publishEvent()`.** Cost: ~$0.004-$0.008 for the gift-wrapped DM.

6. **Wait for merchant response.** Monitor your DM inbox for a type 1 (payment request) or type 2 (fulfillment) message from the merchant.

7. **Complete payment.** Follow the payment instructions in the merchant's response (Lightning invoice, payment URL, etc.).

### Considerations

- Order messages use NIP-17 encryption -- third parties cannot see order details, payment info, or addresses.
- Keep the order JSON structured. Unstructured messages are harder for merchants to process and cost the same per-byte.
- Include a `contact` field with at least your Nostr pubkey for follow-up communication.
- There is no built-in escrow or dispute resolution. Trust is based on merchant reputation and NIP-05 verification.
- Each message in the order conversation costs per-byte on TOON. Minimize back-and-forth by providing complete information upfront.
