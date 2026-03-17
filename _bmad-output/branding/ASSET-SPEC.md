# TOON Protocol — Asset Generation Spec

Deterministic spec for regenerating all social/branding assets from the source mark.

---

## Source Mark

| Field | Value |
|-------|-------|
| **File** | `_bmad-output/branding/toon-protocol-logos/08-towns-a.png` |
| **Resolution** | 2048x2048 |
| **Description** | Four charcoal town tiles in 2x2 grid on cream background. Each tile has unique internal floor-plan patterns with gray street grids and white window accents. Gold accent square in bottom-right tile. Cream channels between tiles. |

---

## Color Palette

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Cream | `#fef3c0` | (254, 243, 192) | Mark background |
| Parchment | `#ece7d3` | (236, 231, 211) | Banner/asset backgrounds (sampled from AI-generated assets) |
| Charcoal | `#1b1b1f` | (27, 27, 31) | Town blocks, text |
| White | `#ffffff` | (255, 255, 255) | Window accents |
| Gold | `#d4a843` | (212, 168, 67) | Token accent square |

---

## Avatar

### GitHub Avatar (`avatar.png`)

| Field | Value |
|-------|-------|
| **Source** | `08-towns-a.png` |
| **Transform** | Resize to 800x800, no crop (preserve original proportions) |
| **Format** | PNG, optimized |
| **Max size** | <1 MB (GitHub limit) |
| **Method** | `Image.resize((800, 800), Image.LANCZOS)` |

### X/Twitter Avatar (`x-avatar.png`)

| Field | Value |
|-------|-------|
| **Source** | `08-towns-a.png` |
| **Transform** | Resize to 1024x1024, no crop (preserve original proportions) |
| **Format** | PNG |
| **Note** | X crops to circle; mark should sit centered with breathing room |
| **Method** | `Image.resize((1024, 1024), Image.LANCZOS)` |

---

## X/Twitter Banner (`x-banner.png`)

Inspired by [@aoTheComputer](https://x.com/aoTheComputer) banner — minimal, text-only, no logo.

| Field | Value |
|-------|-------|
| **Dimensions** | 3000x1000 (2x of X's recommended 1500x500 for Retina sharpness) |
| **Background** | Parchment `#ece7d3` (solid fill) |
| **Text** | `WHERE EVERY TOKEN COUNTS.` |
| **Font** | Courier New, 72px |
| **Text color** | Charcoal `#1b1b1f` |
| **Position** | Right-aligned with 200px right margin, vertically centered (offset -20px above true center) |
| **Format** | PNG |

### Generation code (Python/PIL)

```python
from PIL import Image, ImageDraw, ImageFont

W, H = 3000, 1000
img = Image.new('RGB', (W, H), (236, 231, 211))
draw = ImageDraw.Draw(img)
font = ImageFont.truetype('Courier New.ttf', 72)  # or system path

text = 'WHERE EVERY TOKEN COUNTS.'
bbox = draw.textbbox((0, 0), text, font=font)
tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]

x = W - tw - 200
y = (H - th) // 2 - 20
draw.text((x, y), text, fill=(27, 27, 31), font=font)

img.save('x-banner.png', 'PNG')
```

### macOS font path

```
/System/Library/Fonts/Supplemental/Courier New.ttf
```

---

## Discord Banner (`discord-banner.png`)

| Field | Value |
|-------|-------|
| **Dimensions** | ~1600x900 (16:9) |
| **Background** | Parchment `#ece7d3` |
| **Content** | Mark centered, "TOON PROTOCOL" text below in sans-serif |
| **Generation** | AI-generated via Replicate (nanobanana model) using `08-towns-a.png` as `image_input` reference |
| **Prompt** | `"Minimalist 16:9 banner, cream parchment background, the four-square town mark centered, text TOON PROTOCOL below in clean sans-serif, charcoal and cream palette"` |

---

## GitHub Social Preview (`github-social-preview.png`)

| Field | Value |
|-------|-------|
| **Dimensions** | ~1200x800 (3:2) |
| **Background** | Parchment `#ece7d3` |
| **Content** | Mark on left, "TOON PROTOCOL" + "Token-Oriented Open Network" text on right |
| **Generation** | AI-generated via Replicate (nanobanana model) using `08-towns-a.png` as `image_input` reference |
| **Prompt** | `"Minimalist 3:2 social preview card, cream parchment background, four-square town mark on left, TOON PROTOCOL heading and Token-Oriented Open Network subheading on right, charcoal text"` |

---

## AI Generation Notes (Discord & GitHub assets)

These assets were generated via Replicate's `google/nano-banana-pro` model with the source mark as an image reference. AI text rendering is imperfect — generated text may contain minor artifacts.

### Replicate API pattern

```python
# Requires REPLICATE_API_TOKEN from .env.publish
# Helper script at /tmp/gen-social.py
# 1. Resize 08-towns-a.png to 512x512 (reduces payload)
# 2. Base64-encode as PNG
# 3. POST to google/nano-banana-pro with image_input array
# 4. Poll for completion
```

### Key API details

| Field | Value |
|-------|-------|
| **Model** | `google/nano-banana-pro` |
| **Endpoint** | `https://api.replicate.com/v1/models/google/nano-banana-pro/predictions` |
| **image_input** | Must be an **array** of data URIs: `["data:image/png;base64,..."]` |
| **Reference image** | Resize to 512x512 before encoding to avoid payload/timeout issues |
| **output_format** | `png` |
| **allow_fallback_model** | `true` |

---

## File Inventory

| File | Dimensions | Size | Platform |
|------|-----------|------|----------|
| `avatar.png` | 800x800 | <1 MB | GitHub |
| `x-avatar.png` | 1024x1024 | ~1.1 MB | X/Twitter |
| `x-banner.png` | 3000x1000 | ~25 KB | X/Twitter |
| `discord-banner.png` | ~1600x900 | ~5 MB | Discord |
| `github-social-preview.png` | ~1200x800 | ~5 MB | GitHub repo |
