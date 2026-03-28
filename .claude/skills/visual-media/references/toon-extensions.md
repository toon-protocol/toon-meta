# TOON Extensions for Visual Media

> **Why this reference exists:** NIP-68 and NIP-71 interact with TOON's ILP-gated economics in ways that shape how agents work with visual content. Picture events carry `imeta` tag overhead that increases per-byte cost. Video events carry rich metadata tags (title, summary, duration, thumbnails) that add byte cost. The media data itself is hosted externally -- TOON events carry only metadata. This file covers the TOON-specific mechanics, fee implications, and optimization strategies for visual media publishing.

## Publishing Visual Media Events on TOON

All visual media event publishing on TOON goes through `publishEvent()` from `@toon-protocol/client`. Raw WebSocket writes are rejected -- the relay requires ILP payment for every event.

### Publishing Picture Events (kind:20)

1. **Construct the kind:20 event.** Set content to a caption or alt text. Add `imeta` tags describing each image (url, m, alt, x, size, dim, blurhash, thumb). Add `t` tags for topic categorization.
2. **Sign the event** using your Nostr private key.
3. **Discover pricing.** Check the relay's `basePricePerByte` from kind:10032 peer info or the `/health` endpoint.
4. **Calculate fee.** `basePricePerByte * serializedEventBytes`. A kind:20 event with one image is typically 300-600 bytes.
5. **Sign a balance proof.** `client.signBalanceProof(channelId, amount)`
6. **Publish.** `client.publishEvent(signedEvent, { destination, claim })`

### Publishing Video Events (kind:34235/34236)

1. **Construct the video event.** Set content to a summary or description. Add structured tags: `d` (identifier), `url` (video URL), `m` (MIME type), `x` (hash), `size`, `dim`, `duration`, `image`/`thumb` (thumbnail), `title`, `summary`, `alt`, `t` (topics).
2. **Sign the event** using your Nostr private key.
3. **Calculate fee.** `basePricePerByte * serializedEventBytes`. A video event with full metadata is typically 400-800 bytes.
4. **Sign a balance proof and publish** via `publishEvent()`.

### Updating Video Metadata

Video events are parameterized replaceable. To update metadata:

1. **Publish a new event** with the same kind and `d` tag value but updated metadata.
2. **The relay replaces the old event** automatically (same pubkey + kind + `d` tag).
3. **Each update costs per-byte.** The full event must be republished -- partial updates are not supported.

Picture events (kind:20) are regular events and cannot be updated. To correct a picture post, publish a new kind:20 event and optionally delete the old one via NIP-09 (kind:5).

### Error Handling

- **F04 (Insufficient Payment):** The calculated amount was too low. Recalculate with actual serialized size including all tags.
- **Relay rejection:** Verify event structure. For video events, ensure the `d` tag is present (required for parameterized replaceable events).

## Byte Costs for Visual Media Events

### Picture Events (kind:20)

| Event Variant | Approximate Size | Cost at 10n/byte |
|--------------|-----------------|------------------|
| Single image, minimal tags (url + m) | ~250-350 bytes | ~$0.003-$0.004 |
| Single image, standard tags (url + m + alt + x + dim) | ~350-500 bytes | ~$0.004-$0.005 |
| Single image, full tags (all imeta fields + topics) | ~450-600 bytes | ~$0.005-$0.006 |
| Two images, standard tags | ~500-750 bytes | ~$0.005-$0.008 |
| Three images, standard tags | ~650-1100 bytes | ~$0.007-$0.011 |

Each additional `imeta` tag adds approximately 100-300 bytes depending on how many fields are included.

### Video Events (kind:34235/34236)

| Event Variant | Approximate Size | Cost at 10n/byte |
|--------------|-----------------|------------------|
| Minimal (d + url + m) | ~300-400 bytes | ~$0.003-$0.004 |
| Standard (+ title + summary + duration + dim + image) | ~450-600 bytes | ~$0.005-$0.006 |
| Full (all tags + multiple topics) | ~600-800 bytes | ~$0.006-$0.008 |
| With multiple URL variants (quality levels) | ~700-1000 bytes | ~$0.007-$0.010 |

Video event metadata costs more than a plain text note but less than multi-image picture events. The video file itself is hosted externally and not included in the event cost.

### Cost Comparison with Other Event Types

| Event Type | Approximate Size | Cost at 10n/byte |
|-----------|-----------------|------------------|
| kind:1 text note (no media) | ~200-350 bytes | ~$0.002-$0.004 |
| kind:20 single picture | ~300-600 bytes | ~$0.003-$0.006 |
| kind:20 three pictures | ~600-1100 bytes | ~$0.006-$0.011 |
| kind:34235/34236 video | ~400-800 bytes | ~$0.004-$0.008 |
| kind:1063 file metadata | ~300-800 bytes | ~$0.003-$0.008 |
| kind:30023 article (short) | ~500-2000 bytes | ~$0.005-$0.020 |

Visual media events cost more than plain text notes because of rich metadata tags. However, the cost is modest because the actual media files are hosted externally -- you pay for metadata only.

## Metadata Cost Optimization

### What Costs Bytes (and Why It Is Worth It)

| Tag/Field | Byte Cost | Value |
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
- Excessive `t` tags -- 2-4 relevant topics is optimal; more adds cost without proportional discovery benefit
- `fallback` URLs unless you have genuine CDN redundancy

### Optimization Strategies

1. **Combine multiple images into one kind:20 event** rather than posting separate events. Each event has base overhead (~200 bytes for event structure); combining saves that overhead per image.
2. **Use concise captions and descriptions.** On TOON, content field length directly affects cost. Say what matters, skip filler.
3. **Include alt text despite the byte cost.** Accessibility is a quality signal. A few bytes for `alt` text is always a worthwhile investment.
4. **Get video metadata right the first time.** While video events are replaceable, each replacement costs per-byte. Avoid unnecessary updates.
5. **Use `t` tags strategically.** Each topic tag adds ~15-30 bytes. Include the most relevant 2-4 topics rather than exhaustive hashtag lists.

## TOON-Format Parsing for Visual Media Events

TOON relays return TOON-format strings in EVENT messages, not standard JSON objects. To read visual media events:

1. **Decode the TOON-format response** using the TOON decoder to extract event fields.
2. **For kind:20 events,** extract the content field (caption) and parse `imeta` tags for image metadata. Each `imeta` tag's key-value pairs are space-separated strings within the tag array.
3. **For kind:34235/34236 events,** extract the content field (description) and parse individual tags for url, m, x, d, title, summary, duration, dim, image, thumb, and t.
4. **Validate orientation.** Check that kind:34235 events have landscape dimensions (width > height) and kind:34236 events have portrait dimensions (height > width).

Reading visual media events is free on TOON -- no ILP payment required for subscriptions.

## Integration with Protocol Core

For the complete TOON write model, read model, and fee calculation details, refer to `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`. This file covers visual-media-specific extensions; the protocol core covers foundational mechanics shared by all event kinds.

For `imeta` tag construction details and NIP-92 media metadata, refer to `.claude/skills/media-and-files/SKILL.md` and its reference files. Picture events build on the `imeta` tag format defined in NIP-92.
