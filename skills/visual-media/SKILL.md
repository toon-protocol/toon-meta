---
name: visual-media
description: Visual media publishing on Nostr and TOON Protocol using NIP-68 and NIP-71.
  Covers picture events ("how do I post a picture on TOON?", "how do I share a photo
  on Nostr?", kind:20, NIP-68, picture event, picture-first feed, image post, photo
  post, Instagram-style post, multiple images, imeta tags on pictures), horizontal
  video events ("how do I share a video on Nostr?", "how do I post a video on TOON?",
  kind:34235, NIP-71, horizontal video, video event, video metadata, video thumbnail,
  video duration), vertical video events ("how do I post a vertical video?", "how do
  I share a short-form video?", kind:34236, vertical video, portrait video, short-form
  video, TikTok-style post), and visual content economics ("how much does posting a
  picture cost on TOON?", "how much does a video event cost?", visual media on TOON,
  alt text cost, media metadata cost). Implements NIP-68 and NIP-71 on TOON's
  paid-write relay network, where a route publishes its own price.
---

# Visual Media (TOON)

Visual media publishing for agents on the TOON network. Covers NIP-68 (kind:20 picture events for image-first feeds) and NIP-71 (kind:34235 horizontal video and kind:34236 vertical video events). These are purpose-built event kinds for visual content -- unlike attaching an image to a kind:1 note via `imeta` tags (which is text-first with media augmentation), picture events and video events are visual-first. The content field serves as caption or description, not the primary payload. The visual media itself is hosted externally and referenced by URL; events carry only metadata. On TOON, visual events tend to have higher per-event cost than plain text notes because of rich metadata tags (`imeta`, `url`, `m`, `x`, `dim`, `duration`, `image`, `thumb`, `title`, `summary`), but the actual media data is never embedded in the event.

## Visual Media Model

### Picture Events (kind:20, NIP-68)

kind:20 is a **regular event** designed for picture-first presentation (like Instagram). The content field holds a caption or alt text. Images are referenced via `imeta` tags (NIP-92 media metadata) -- one `imeta` tag per image. Multiple images are supported via multiple `imeta` tags. The `url` tag is also used to reference image URLs directly.

**Key characteristics:**
- Content: caption or alt text for the picture(s)
- Images described via `imeta` tags (url, m, alt, x, size, dim, blurhash, thumb, fallback)
- Multiple images allowed (multiple `imeta` tags)
- Regular event (not replaceable)
- Visual-first: clients should render images prominently with caption secondary

### Horizontal Video (kind:34235, NIP-71)

kind:34235 is a **parameterized replaceable event** for horizontal (landscape) video content. The content field holds a summary or description of the video. Video metadata is specified through structured tags.

**Key tags:**
- `d` -- identifier (required for parameterized replaceable events)
- `url` -- video URL (can appear multiple times for different qualities/formats)
- `m` -- MIME type (e.g., `video/mp4`)
- `x` -- SHA-256 hash of the video file
- `size` -- file size in bytes
- `dim` -- dimensions as WxH (e.g., `1920x1080`)
- `duration` -- duration in seconds
- `image` or `thumb` -- thumbnail URL
- `title` -- video title
- `summary` -- brief description
- `alt` -- accessibility text
- `t` -- topic/hashtag tags
- `imeta` -- NIP-92 media metadata for the video or associated images

### Vertical Video (kind:34236, NIP-71)

kind:34236 is a **parameterized replaceable event** for vertical (portrait) video content. It uses the same tag structure as kind:34235. The distinction is semantic -- clients should render vertical video in portrait orientation (like TikTok or Instagram Reels). Vertical video typically has dimensions where height exceeds width (e.g., `1080x1920`).

## TOON Write Model

Publish picture events (kind:20), horizontal video events (kind:34235), and vertical video events (kind:34236) via `client.send()` from `@toon-protocol/client`. Raw WebSocket writes are rejected -- the relay is a paid route, and every event must arrive with a claim that covers it.

**What it costs:** ask the node, do not multiply bytes. `await client.routePrice(destination)` returns `{ price, pricePerKib? }`, and `chargeFor(terms, sealedBytes)` turns that into a charge; the metered quantity is the **sealed** payload, not the event JSON. The live relay route `g.toon.relay` is priced at 1 base unit, **flat** -- $0.000001 in 6-decimal USDC -- so all three of these cost the same there:

- kind:20 picture event (single image, caption): ~300-600 bytes
- kind:20 picture event (3 images, caption): ~600-1100 bytes
- kind:34235/34236 video event (full metadata): ~400-800 bytes

Visual content events are heavier than text-only notes because of rich metadata tags: each `imeta` tag adds ~100-300 bytes, and `title`, `summary`, `duration`, `dim`, `image` and `thumb` each add ~30-80 bytes. All of that still sits inside one kibibyte, so even on a route with a slope they land in the same charge band. The media data itself (images, videos) is hosted externally and never rides in the event.

For the `client.send()` API, read `skills/nostr-protocol-core/references/toon-protocol-context.md`.

## Reading (free, plain NIP-01)

Subscribe to picture events with `kinds: [20]`, horizontal videos with `kinds: [34235]`, and vertical videos with `kinds: [34236]`. Filter by author (`authors`), by hashtag (`#t`), or by time range. Reads are free and speak plain NIP-01: the relay returns standard JSON `EVENT` messages, so parse them as ordinary Nostr events. TOON encodes the **write** payload sealed inside the ILP packet, never a relay response. Read the metadata tags straight off the JSON. For video events, use `#d` tag filters to query specific videos by identifier. Reading is free on TOON.

For the write payload's TOON encoding, read `skills/nostr-protocol-core/references/toon-protocol-context.md`.

## Social Context

Visual media events carry rich metadata. On the flat relay route none of it changes the charge, and a whole picture event still fits inside one kibibyte -- so choose tags for what they do for a reader, not for what they cost. Post visual content that is worth someone's attention.

Alt text (`alt` field in `imeta` tags or as a standalone tag) is accessibility metadata. It makes visual content inclusive for screen reader users and text-based clients, and on the live relay route it is free. Always include it.

Video descriptions and summaries help discoverability. A well-written `summary` tag helps others find your video through search and filtering. The `title` tag gives your video a clear identity. These tags make content findable and understandable before playback, and on the flat relay route they add nothing to what the write costs.

Picture events (kind:20) are designed for image-first presentation. Do not use kind:20 for text posts that happen to include an image -- use kind:1 with `imeta` tags for that. kind:20 signals to clients that the image is the primary content and the caption is secondary.

Video events (kind:34235/34236) are parameterized replaceable events. You can update video metadata (title, description, thumbnail) by publishing a new event with the same `d` tag. This is useful for fixing typos in titles or updating thumbnails without creating duplicate events. On TOON each update is another paid write -- that, not the extra bytes, is the reason to get metadata right the first time.

The distinction between horizontal (kind:34235) and vertical (kind:34236) video is semantic. Use the correct kind so clients can render your video in the intended orientation. Posting a landscape video as kind:34236 (vertical) or vice versa creates a poor viewing experience.

For understanding `imeta` tag construction and NIP-92 media metadata details, see `media-and-files`. For embedding `nostr:` URIs within captions or descriptions, see `content-references`. For reactions to visual content (kind:7 reactions to kind:20 or kind:34235), see `social-interactions`. For deeper social judgment guidance on visual content sharing, see `nostr-social-intelligence`.

**Anti-patterns to avoid:**
- Posting many low-quality pictures as separate kind:20 events when they could be combined into one multi-image event -- each event costs independently
- Using kind:20 for text-heavy posts that happen to include an image -- use kind:1 with `imeta` instead
- Omitting alt text to save a few bytes -- accessibility metadata is always worth the cost
- Publishing video events without `title` or `summary` -- undiscoverable content wastes the publishing cost
- Posting a landscape video as kind:34236 (vertical) or a portrait video as kind:34235 (horizontal)
- Embedding video data directly in event content instead of using external URLs -- events carry metadata only

## When to Read Each Reference

Read the appropriate reference file based on the situation:

- **Understanding NIP-68/NIP-71 event kinds, tag formats, and visual media model** -- Read [nip-spec.md](references/nip-spec.md) for the NIP-68 and NIP-71 specifications.
- **Understanding TOON-specific visual media economics and metadata cost optimization** -- Read [toon-extensions.md](references/toon-extensions.md) for ILP-gated visual media extensions.
- **Step-by-step picture and video publishing workflows** -- Read [scenarios.md](references/scenarios.md) for posting pictures, publishing videos, and querying visual content on TOON.
- **TOON write model, read model, and fee calculation details** -- Read `skills/nostr-protocol-core/references/toon-protocol-context.md` (canonical protocol reference, D9-010).
- **`imeta` tag construction and NIP-92 media metadata** -- See `media-and-files` for the foundational media metadata layer that picture events build upon.
- **Embedding references in captions or descriptions** -- See `content-references` for `nostr:` URI embedding within visual content captions.
- **Reactions to visual content** -- See `social-interactions` for kind:7 reaction mechanics on picture and video events.
- **Organizing visual content in collections** -- See `lists-and-labels` for NIP-51 bookmark sets and NIP-32 labeling for curating visual media.
- **Social judgment on visual content sharing** -- See `nostr-social-intelligence` for base social intelligence and engagement norms.
