# TOON Extensions for Visual Media

> **Why this reference exists:** NIP-68 and NIP-71 interact with TOON's paid-write economics in ways that shape how agents work with visual content. Picture events carry `imeta` tag overhead, and video events carry rich metadata tags (title, summary, duration, thumbnails), so both are larger than a bare note. The media data itself is hosted externally -- TOON events carry only metadata. This file covers the TOON-specific mechanics, what a write actually costs, and optimization strategies for visual media publishing.

## Publishing Visual Media Events on TOON

All visual media event publishing on TOON goes through `client.send()` from `@toon-protocol/client`. Raw WebSocket writes are rejected -- the relay is a paid route, and every event must arrive with a claim that covers it.

### Publishing Picture Events (kind:20)

1. **Construct the kind:20 event.** Set content to a caption or alt text. Add `imeta` tags describing each image (url, m, alt, x, size, dim, blurhash, thumb). Add `t` tags for topic categorization.
2. **Sign the event** using your Nostr private key.
3. **Send it.** `await client.send({ body: signedEvent })`. That is the whole write path: `send()` seals the payload to the terminating connector's key, prices it, mints the covering claim and carries it. An agent never signs a claim by hand and never builds a packet.

### Publishing Video Events (kind:34235/34236)

1. **Construct the video event.** Set content to a summary or description. Add structured tags: `d` (identifier), `url` (video URL), `m` (MIME type), `x` (hash), `size`, `dim`, `duration`, `image`/`thumb` (thumbnail), `title`, `summary`, `alt`, `t` (topics).
2. **Sign the event** using your Nostr private key.
3. **Send it.** `await client.send({ body: signedEvent })`, exactly as for a picture event.

### Asking What It Costs

Where a price is genuinely needed up front -- to decide between one image and four, say -- ask the node instead of multiplying bytes:

```ts
const terms = await client.routePrice('g.toon.relay');  // { price, pricePerKib? }
const charge = chargeFor(terms, sealedBytes);
```

A **price** belongs to a terminated route and is a schedule over payload length: flat when it has no slope, otherwise `price + pricePerKib * ceil(sealedBytes / 1024)` -- per kibibyte, never per byte. The metered quantity is the **sealed** payload the PREPARE carries, which is larger than the event JSON by the envelope and the wrap, so an agent cannot work the charge out from the event it wrote. `chargeFor` is the only thing that should decide what goes on a claim.

A node's free, unauthenticated self-description at `GET /ilp` publishes every route's price alongside its addresses and settlement facts. The `/health` price endpoint and `basePricePerByte` were both removed along with the `kind:10032` announce; the self-description replaced them.

### Error Handling

A refusal comes back as `{ fulfilled: false }`; it is never thrown.

- **`F03` INVALID_AMOUNT:** the claim does not cover the charge. This is underpayment -- re-read the route's terms with `routePrice()` and send again. There is no `F04`.
- **`T04`:** over the peering's cap. The reject's message states the cap; that is the only way a sender learns it.
- **`F02` / `T01`:** nothing routes that name, or the peer was not there.
- **Relay rejection:** Verify event structure. For video events, ensure the `d` tag is present (required for parameterized replaceable events).

### Updating Video Metadata

Video events are parameterized replaceable. To update metadata:

1. **Publish a new event** with the same kind and `d` tag value but updated metadata.
2. **The relay replaces the old event** automatically (same pubkey + kind + `d` tag).
3. **Each update is another paid write.** The full event must be republished -- partial updates are not supported.

Picture events (kind:20) are regular events and cannot be updated. To correct a picture post, publish a new kind:20 event and optionally delete the old one via NIP-09 (kind:5).

## What Visual Media Events Weigh, and What That Costs

### On the Live Relay Route, Size Does Not Change the Charge

The live relay route `g.toon.relay` is priced at **1 base unit, flat** -- no slope. Settlement is in USDC, which is 6-decimal, so that is $0.000001 per write, and a flat schedule charges the same for a 250-byte picture event and a 1000-byte one. Every table below is therefore about **weight**, not price: on this route a three-image kind:20 event and a bare kind:1 note cost exactly the same.

Where a route does have a slope, the unit is a **kibibyte** -- `price + pricePerKib * ceil(sealedBytes / 1024)` -- so a difference of a few hundred bytes changes the charge only when it crosses a 1024-byte boundary. Ask the node for the figure with `await client.routePrice(destination)` and price it with `chargeFor(terms, sealedBytes)`; never assume a rate.

### Picture Events (kind:20)

| Event Variant | Approximate Size |
|--------------|-----------------|
| Single image, minimal tags (url + m) | ~250-350 bytes |
| Single image, standard tags (url + m + alt + x + dim) | ~350-500 bytes |
| Single image, full tags (all imeta fields + topics) | ~450-600 bytes |
| Two images, standard tags | ~500-750 bytes |
| Three images, standard tags | ~650-1100 bytes |

Each additional `imeta` tag adds approximately 100-300 bytes depending on how many fields are included. Note that these are the sizes of the event JSON; the **sealed** payload the connector meters is larger by the envelope and the wrap, which is one more reason not to price a write yourself.

### Video Events (kind:34235/34236)

| Event Variant | Approximate Size |
|--------------|-----------------|
| Minimal (d + url + m) | ~300-400 bytes |
| Standard (+ title + summary + duration + dim + image) | ~450-600 bytes |
| Full (all tags + multiple topics) | ~600-800 bytes |
| With multiple URL variants (quality levels) | ~700-1000 bytes |

Video event metadata weighs more than a plain text note but less than a multi-image picture event. The video file itself is hosted externally and never rides in the event.

### Weight Comparison with Other Event Types

| Event Type | Approximate Size |
|-----------|-----------------|
| kind:1 text note (no media) | ~200-350 bytes |
| kind:20 single picture | ~300-600 bytes |
| kind:20 three pictures | ~600-1100 bytes |
| kind:34235/34236 video | ~400-800 bytes |
| kind:1063 file metadata | ~300-800 bytes |
| kind:30023 article (short) | ~500-2000 bytes |

Visual media events weigh more than plain text notes because of rich metadata tags -- but every one of them sits inside a single kibibyte, so even on a sloped route they all land in the same charge band. The actual media files are hosted externally; you never pay to carry them.

## Metadata Weight and What It Buys

On the flat relay route none of this changes the charge, and on a sloped route the granularity is a kibibyte -- so treat the byte figures below as a guide to what a tag is worth carrying, not as a bill.

### What Weighs Something (and Why It Is Worth It)

| Tag/Field | Approximate Bytes | Value |
|-----------|-----------|-------|
| `alt` text | ~30-100 bytes | Accessibility. Always worth it. |
| `title` (video) | ~20-60 bytes | Discoverability. Essential for search. |
| `summary` (video) | ~30-80 bytes | Discoverability. Helps browsing. |
| `duration` (video) | ~15-25 bytes | UX. Lets viewers know video length. |
| `dim` dimensions | ~15-25 bytes | Rendering. Correct aspect ratio. |
| `image`/`thumb` | ~40-80 bytes | Preview. Essential for feeds. |
| `blurhash` | ~25-40 bytes | Progressive loading. Nice to have. |
| `t` topic tag | ~15-30 bytes each | Discovery. Include relevant topics. |

### What to Skip

- `blurhash` on video events -- thumbnails serve the preview purpose
- Redundant `thumb` when `image` is already small enough
- Excessive `t` tags -- 2-4 relevant topics is optimal; more adds weight and noise without proportional discovery benefit
- `fallback` URLs unless you have genuine CDN redundancy

### Optimization Strategies

1. **Combine multiple images into one kind:20 event** rather than posting separate events. This is the strategy that actually saves money: each event is its own paid write, so four images in one event cost one charge and four separate events cost four.
2. **Use concise captions and descriptions.** Brevity is a courtesy to readers. It does not lower the charge on a flat route, and on a sloped one it only helps if it keeps the sealed payload under a kibibyte boundary.
3. **Always include alt text.** Accessibility is a quality signal, and on the live relay route it is free.
4. **Get video metadata right the first time.** Video events are replaceable, but each replacement is another paid write -- that, not the extra bytes, is what an unnecessary update costs.
5. **Use `t` tags for discovery, not for weight management.** Include the most relevant 2-4 topics rather than exhaustive hashtag lists, because long tag lists dilute discovery, not because they cost more.

## Reading Visual Media Events

Reads are free and speak plain NIP-01: the relay returns standard JSON `EVENT` messages, so parse them as ordinary Nostr events. TOON encodes the **write** payload sealed inside the ILP packet, never a relay response. To read visual media events:

1. **Read the JSON event** straight off the wire -- there is no decoding step.
2. **For kind:20 events,** extract the content field (caption) and parse `imeta` tags for image metadata. Each `imeta` tag's key-value pairs are space-separated strings within the tag array.
3. **For kind:34235/34236 events,** extract the content field (description) and parse individual tags for url, m, x, d, title, summary, duration, dim, image, thumb, and t.
4. **Validate orientation.** Check that kind:34235 events have landscape dimensions (width > height) and kind:34236 events have portrait dimensions (height > width).

Reading visual media events is free on TOON -- no ILP payment required for subscriptions.

## Integration with Protocol Core

For the complete TOON write model, read model, and fee calculation details, refer to `skills/nostr-protocol-core/references/toon-protocol-context.md`. This file covers visual-media-specific extensions; the protocol core covers foundational mechanics shared by all event kinds.

For `imeta` tag construction details and NIP-92 media metadata, refer to `skills/media-and-files/SKILL.md` and its reference files. Picture events build on the `imeta` tag format defined in NIP-92.
