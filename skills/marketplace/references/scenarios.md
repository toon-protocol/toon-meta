# Marketplace Scenarios

> **Why this reference exists:** Agents need step-by-step workflows for common marketplace operations on TOON. Each scenario shows the complete flow from intent to published event, including TOON-specific considerations like the route's charge for publishing, replaceable event economics, and the `client.send()` API. These scenarios bridge the gap between knowing the event format (nip-spec.md) and knowing the TOON publishing mechanics (toon-extensions.md).

## Scenario 1: Creating a Stall

**When:** A merchant wants to set up a shop on TOON, defining their accepted currency and shipping options.

**Why this matters:** A stall (kind:30017) is the prerequisite for listing products. Products reference their parent stall via `stall_id`. On TOON, creating a stall is a paid write, so publish it once you know your shipping zones rather than iterating live.

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

7. **Send it.** `await client.send({ body: signedEvent })` from `@toon-protocol/client`. The client seals the payload, reads the route's price, mints the covering claim and carries it -- no separate pricing or claim step. The relay route is flat-priced, so a stall costs 1 base unit of 6-decimal USDC whatever its size.

### Considerations

- The `d` tag value and the content JSON `id` field must match.
- Length does not change the charge on the relay route. Write the description for the buyer.
- Define only the shipping zones you actually serve -- a correctness matter, not a cost one.
- As a parameterized replaceable event, you can update the stall later by republishing with the same `d` tag.

## Scenario 2: Listing a Product

**When:** A merchant wants to list a product for sale within an existing stall.

**Why this matters:** Products (kind:30018) are the core listings that buyers discover. On TOON, publishing one is a paid write at the relay route's flat price -- images, long descriptions and extensive specs make the event bigger but not dearer.

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

7. **Send it.** `await client.send({ body: signedEvent })`. Cost: 1 base unit, flat.

### Considerations

- Host product images externally (NIP-96 file storage servers). Do not embed image data in the event. Blob storage belongs on the store route (`g.toon.store`), which *is* priced by size.
- Keep `specs` focused on key product attributes -- for the buyer's sake, not the bill's.
- The `quantity` field is self-reported. Update it by republishing with the same `d` tag when inventory changes; each republish is another paid write.
- Use `t` tags strategically. Extra tags do not raise the charge, but over-tagging dilutes discovery.

## Scenario 3: Creating a Classified Listing

**When:** An agent wants to post a classified ad for a service, job, rental, or other non-product offering.

**Why this matters:** Classified listings (kind:30402) use markdown content with structured tags. On TOON, publishing one is a paid write at the relay route's flat price -- the length of the markdown body does not change it.

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

6. **Send it.** `await client.send({ body: signedEvent })`. Cost: 1 base unit, flat.

### Considerations

- Put structured data (price, location, title) in tags for machine readability. The markdown body is for human readers.
- The `price` tag is NIP-99 application data -- what you are asking for the work -- and has nothing to do with what the route charges to publish the listing. Use three elements: amount, currency, frequency (e.g., `"hour"`, `"month"`, `"one-time"`).
- Set `published_at` to indicate freshness. Stale classifieds lose credibility.
- Use headings and lists for readability; formatting costs nothing extra.

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

6. **Read the events.** The relay answers reads in plain NIP-01: standard JSON `EVENT` messages, with no decoding step. Then parse the `content` field as JSON (for products/stalls) or read it as markdown (for classifieds).

7. **Check product availability.** Parse the content JSON and verify `quantity > 0` before initiating an order.

### Considerations

- All discovery queries are free reads on TOON.
- Reads speak plain NIP-01 -- the relay returns standard JSON events, so `content` is the only thing left to parse. TOON is the encoding of the sealed *write* payload, not of what a relay serves on a read.
- Products reference stalls via `stall_id` in the content JSON. To display a product with its stall context, fetch both the product and its parent stall.
- Parameterized replaceable events (kind:30017, 30018, 30402) are deduplicated by pubkey + kind + `d` tag. The relay returns only the latest version.
- Do not rely on NIP-50 `search` filters: the fleet relay implements NIP-01 and NIP-34 only. Fetch by `kinds` and tag filters, then do any full-text matching client-side.

## Scenario 5: Initiating an Order

**When:** A buyer wants to purchase a product from a merchant.

**Why this matters:** Order negotiation uses NIP-17 encrypted direct messages. On TOON each DM is a paid write at the relay route's flat price, so the cost of a negotiation is its number of messages, not their length. Keep it structured and few.

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

5. **Send the DM.** `await client.send({ body: giftWrappedEvent })`. Cost: 1 base unit, flat -- gift-wrap overhead makes the event bigger but not dearer.

6. **Wait for merchant response.** Monitor your DM inbox for a type 1 (payment request) or type 2 (fulfillment) message from the merchant.

7. **Complete payment.** Follow the payment instructions in the merchant's response (Lightning invoice, payment URL, etc.).

### Considerations

- Order messages use NIP-17 encryption -- third parties cannot see order details, payment info, or addresses.
- Keep the order JSON structured. Unstructured messages are harder for merchants to process and cost exactly as much to send.
- Include a `contact` field with at least your Nostr pubkey for follow-up communication.
- There is no built-in escrow or dispute resolution. Trust is based on merchant reputation and NIP-05 verification.
- Each message in the order conversation is a separate paid write on TOON. Minimize back-and-forth by providing complete information upfront.
