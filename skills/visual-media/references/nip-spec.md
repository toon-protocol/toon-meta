# NIP Specification: Picture-first Feeds (NIP-68) and Video Events (NIP-71)

> **Why this reference exists:** This skill covers two complementary NIPs for visual-first content on Nostr. NIP-68 defines kind:20 picture events for image-first feeds (like Instagram). NIP-71 defines kind:34235 (horizontal video) and kind:34236 (vertical video) for video content. These are distinct from attaching media to text notes via `imeta` tags (NIP-92) -- picture and video events are visual-first by design. The content field serves as caption or description, not the primary payload. TOON-specific extensions are covered in toon-extensions.md.

## NIP-68: Picture-first Feeds (kind:20)

### Overview

NIP-68 defines kind:20 as a picture event designed for image-first presentation. Unlike a kind:1 note that happens to include an image URL, a kind:20 event signals to clients that the image is the primary content and the text is secondary (caption/alt text). This is analogous to Instagram posts -- the visual content dominates, and the text accompanies it.

### Event Structure

kind:20 is a **regular event** (not replaceable). Each kind:20 event represents one picture post, which may contain one or more images.

```json
{
  "kind": 20,
  "content": "Sunset over the Pacific from the cliffs at Big Sur",
  "tags": [
    ["imeta",
      "url https://example.com/photos/sunset.jpg",
      "m image/jpeg",
      "alt Golden sunset over the Pacific Ocean viewed from Big Sur cliffs",
      "x 7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b",
      "size 2097152",
      "dim 3840x2160",
      "blurhash LGF5]+Yk^6#M@-5c",
      "thumb https://example.com/photos/sunset_thumb.jpg"
    ],
    ["t", "photography"],
    ["t", "sunset"],
    ["t", "bigsur"]
  ]
}
```

### Content Field

The content field of a kind:20 event is a **caption or alt text** for the picture(s). It is plain text, not JSON. Keep it descriptive but concise -- it accompanies the visual content, not the other way around.

### Image References via `imeta` Tags

Pictures are described using NIP-92 `imeta` tags. Each `imeta` tag describes one image with space-separated key-value pairs:

| Field | Description | Recommended |
|-------|-------------|-------------|
| `url` | Image URL | Required in practice |
| `m` | MIME type (e.g., `image/jpeg`, `image/png`, `image/webp`) | Yes |
| `alt` | Accessibility description of the image | Yes |
| `x` | SHA-256 hex hash of the image file | Yes |
| `size` | File size in bytes | Optional |
| `dim` | Dimensions as WxH (e.g., `3840x2160`) | Optional |
| `blurhash` | Compact blur hash placeholder for progressive loading | Optional |
| `thumb` | Thumbnail URL for previews | Optional |
| `fallback` | Alternative URL if primary fails | Optional |

### Multiple Images

A single kind:20 event can contain multiple images via multiple `imeta` tags. This is analogous to a multi-image Instagram post or a photo carousel.

```json
{
  "kind": 20,
  "content": "Hiking through the redwoods today -- three favorite moments",
  "tags": [
    ["imeta",
      "url https://example.com/hike/trail.jpg",
      "m image/jpeg",
      "alt Sunlit trail through towering redwood trees",
      "x abc123...",
      "dim 1920x1080"
    ],
    ["imeta",
      "url https://example.com/hike/creek.jpg",
      "m image/jpeg",
      "alt Clear creek running between moss-covered rocks",
      "x def456...",
      "dim 1920x1080"
    ],
    ["imeta",
      "url https://example.com/hike/canopy.jpg",
      "m image/jpeg",
      "alt Looking up through the redwood canopy at blue sky",
      "x ghi789...",
      "dim 1080x1920"
    ],
    ["t", "hiking"],
    ["t", "redwoods"],
    ["t", "nature"]
  ]
}
```

### Topic Tags

Use `t` tags for topic/hashtag categorization. These enable discovery via `#t` tag filters.

### When to Use kind:20 vs kind:1 with `imeta`

- **kind:20** -- The image IS the content. Visual-first presentation. Clients render images prominently with caption secondary.
- **kind:1 with `imeta`** -- The text IS the content. The image augments the text. Clients render text prominently with media as attachment.

This distinction is semantic and affects how clients display the event. Using kind:20 for text-heavy posts with an incidental image is incorrect usage.

## NIP-71: Video Events (kind:34235 and kind:34236)

### Overview

NIP-71 defines two event kinds for video content:
- **kind:34235** -- Horizontal (landscape) video
- **kind:34236** -- Vertical (portrait) video

Both are **parameterized replaceable events** (identified by the `d` tag). This means you can update video metadata (title, description, thumbnail) by publishing a new event with the same `d` tag value, and the new event replaces the old one.

### Horizontal Video Event Structure (kind:34235)

```json
{
  "kind": 34235,
  "content": "A deep dive into how the Interledger Protocol enables micropayments across different ledgers. Covers the four-layer architecture, connector routing, and STREAM transport.",
  "tags": [
    ["d", "ilp-deep-dive-2026"],
    ["url", "https://videos.example.com/ilp-deep-dive.mp4"],
    ["m", "video/mp4"],
    ["x", "9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b"],
    ["size", "157286400"],
    ["dim", "1920x1080"],
    ["duration", "1847"],
    ["image", "https://videos.example.com/ilp-deep-dive-thumb.jpg"],
    ["thumb", "https://videos.example.com/ilp-deep-dive-thumb-sm.jpg"],
    ["title", "Interledger Protocol Deep Dive"],
    ["summary", "How ILP enables micropayments across ledgers"],
    ["alt", "Video tutorial explaining Interledger Protocol architecture and routing"],
    ["t", "interledger"],
    ["t", "micropayments"],
    ["t", "protocol"]
  ]
}
```

### Vertical Video Event Structure (kind:34236)

```json
{
  "kind": 34236,
  "content": "Quick tip: how to set up your first TOON relay node in under 60 seconds.",
  "tags": [
    ["d", "toon-quick-tip-001"],
    ["url", "https://videos.example.com/toon-quicktip.mp4"],
    ["m", "video/mp4"],
    ["x", "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b"],
    ["size", "15728640"],
    ["dim", "1080x1920"],
    ["duration", "58"],
    ["image", "https://videos.example.com/toon-quicktip-thumb.jpg"],
    ["title", "TOON Quick Tip: First Relay Node"],
    ["summary", "Set up a TOON relay node in under 60 seconds"],
    ["alt", "Vertical video showing step-by-step TOON relay node setup"],
    ["t", "toon"],
    ["t", "tutorial"]
  ]
}
```

### Tag Definitions

| Tag | Description | Required | Example |
|-----|-------------|----------|---------|
| `d` | Unique identifier for the video (parameterized replaceable) | Required | `["d", "ilp-deep-dive-2026"]` |
| `url` | Video URL (can appear multiple times for different qualities) | Required in practice | `["url", "https://example.com/video.mp4"]` |
| `m` | MIME type | Recommended | `["m", "video/mp4"]` |
| `x` | SHA-256 hex hash of the video file | Recommended | `["x", "9a8b7c..."]` |
| `size` | File size in bytes | Optional | `["size", "157286400"]` |
| `dim` | Dimensions as WxH | Recommended | `["dim", "1920x1080"]` |
| `duration` | Duration in seconds | Recommended | `["duration", "1847"]` |
| `image` | Thumbnail/poster image URL | Recommended | `["image", "https://example.com/thumb.jpg"]` |
| `thumb` | Smaller thumbnail URL | Optional | `["thumb", "https://example.com/thumb-sm.jpg"]` |
| `title` | Video title | Recommended | `["title", "ILP Deep Dive"]` |
| `summary` | Brief description | Optional | `["summary", "How ILP works"]` |
| `alt` | Accessibility text | Recommended | `["alt", "Video about ILP"]` |
| `t` | Topic/hashtag tags | Optional | `["t", "interledger"]` |
| `imeta` | NIP-92 media metadata (for video or thumbnails) | Optional | Standard `imeta` format |

### Multiple URLs for Different Qualities

A video event can include multiple `url` tags for different quality levels or formats:

```json
["url", "https://example.com/video-1080p.mp4"],
["url", "https://example.com/video-720p.mp4"],
["url", "https://example.com/video-480p.mp4"]
```

Clients can select the appropriate quality based on bandwidth and device capabilities.

### Content Field

The content field is a **summary or description** of the video. It is plain text, not JSON. For horizontal video (kind:34235), this typically provides context about the video content. For vertical video (kind:34236), it may be a brief caption.

### Parameterized Replaceable Semantics

Video events are parameterized replaceable, meaning:
- The event is identified by the combination of (pubkey, kind, `d` tag value)
- Publishing a new event with the same `d` tag replaces the previous version
- This allows updating video metadata (title, description, thumbnail URL) without creating duplicate entries
- The `d` tag value should be a stable, unique identifier for the video (e.g., a slug or UUID)

### Horizontal vs Vertical Distinction

The kind number indicates the intended display orientation:
- **kind:34235** -- Horizontal/landscape video. Dimensions typically have width > height (e.g., `1920x1080`, `1280x720`).
- **kind:34236** -- Vertical/portrait video. Dimensions typically have height > width (e.g., `1080x1920`, `720x1280`).

Clients should render videos in the appropriate aspect ratio based on the kind. Using the wrong kind for a video's actual orientation creates a poor viewing experience.

### Querying Video Events

- **All horizontal videos:** `kinds: [34235]`
- **All vertical videos:** `kinds: [34236]`
- **All videos by an author:** `kinds: [34235, 34236], authors: ["<pubkey>"]`
- **Specific video by identifier:** `kinds: [34235], #d: ["ilp-deep-dive-2026"]`
- **Videos by topic:** `kinds: [34235, 34236], #t: ["interledger"]`

## Event Kind Summary

| Kind | Name | Type | Key Use |
|------|------|------|---------|
| kind:20 | Picture Event | Regular (NIP-68) | Image-first feed posts, photo sharing |
| kind:34235 | Horizontal Video | Parameterized replaceable (NIP-71) | Landscape video content |
| kind:34236 | Vertical Video | Parameterized replaceable (NIP-71) | Portrait/short-form video content |

## Relationship to Other Media NIPs

- **NIP-92 (`imeta` tags):** Used within kind:20 picture events to describe images. Also used within video events for thumbnail or associated image metadata. See `media-and-files` for `imeta` tag details.
- **NIP-94 (kind:1063 file metadata):** Standalone file description events. A kind:1063 event can describe a video or image file, but it is not a visual-first presentation -- it is a metadata catalog entry. Use kind:20/34235/34236 for visual-first presentation and kind:1063 for file cataloging.
- **NIP-73 (`i` tags):** External content IDs can be added to visual media events to reference Arweave-stored media, ISBNs, DOIs, etc. See `media-and-files` for `i` tag details.
