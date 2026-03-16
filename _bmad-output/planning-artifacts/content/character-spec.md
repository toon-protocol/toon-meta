# Relay Bot — Recurring Character Spec

## Identity
- **Name:** Relay Bot
- **Role:** Mascot for the Crosstown content series (6 articles)
- **Personality:** Cheerful, calm under pressure, slightly oblivious to chaos

## Visual Design (Prompt Prefix)
Use this exact prefix when generating images to maintain character consistency:

```
1930s rubber hose cartoon animation style, hand-painted watercolor. A cartoon robot character named Relay Bot with a round vintage television set head. The face on the TV screen has exactly two simple round black dot eyes, a small curved line smile, and two small rosy pink circle cheeks like a classic smiley face. Small single antenna on top of the TV head. Wearing a small orange bow tie on the chest. White cartoon glove hands with no fingers. Bendy rubber hose style arms and legs. The full body must be visible including torso, both arms, and both legs. Simple rounded rectangular torso. Warm sepia cream orange and red watercolor tones, bold ink outlines, vintage Fleischer Studios animation aesthetic.
```

## Key Visual Traits (non-negotiable for consistency)
1. **Head:** Round vintage CRT/television set, face displayed ON the screen
2. **Face (CRITICAL):** Two simple round black dot eyes, small curved line smile, two rosy pink circle cheeks — like a classic :) smiley. NO detailed/realistic eyes. NO half-lidded eyes. Always the same simple dot-eye face.
3. **Antenna:** Single small antenna on top of the TV head
4. **Bow tie:** Small, orange, on the chest
5. **Hands:** White cartoon gloves, NO fingers (mitten style)
6. **Limbs:** Bendy rubber hose style (1930s animation), MUST show full arms and legs
7. **Body:** Simple rounded rectangular torso — FULL BODY must always be visible (no floating heads)
8. **Art style:** Hand-painted watercolor, bold ink outlines, Fleischer Studios aesthetic
9. **Palette:** Warm sepia, cream, orange, red — with teal/blue accents for tech elements

## Expression Guide
Relay Bot's expression is always conveyed through BODY LANGUAGE, not face changes.
The face stays the same (dot eyes, curved smile, rosy cheeks) across all articles.
- **Calm/content:** Relaxed posture, coffee in hand (Article 1)
- **Curious/excited:** Leaning forward, pointing (Article 2, 3)
- **Confident:** Hands on hips power pose (Article 5, 6)
- **Thoughtful:** Hand on chin, head tilted (Article 4)

## Per-Article Scene Concepts

### Article 1: "95% of Nostr Relays Can't Cover Costs"
- **Scene:** Relay Bot calmly sipping tea/coffee at a desk while server room burns around it
- **Props:** Coffee mug, burning dollar bills, flaming mainframes
- **Mood:** "This is fine" — calm oblivion amid financial chaos

### Article 2: "The Missing Layer in the AI Agent Protocol Stack"
- **Scene:** Relay Bot examining a gap/missing piece in a stack of protocol layers
- **Props:** Puzzle pieces, protocol stack diagram, magnifying glass
- **Mood:** Curious detective energy

### Article 3: "Introducing Crosstown"
- **Scene:** Relay Bot proudly presenting/unveiling Crosstown
- **Props:** Relay tower, payment streams, connected nodes
- **Mood:** Grand reveal, confident

### Article 4: "ILP vs x402"
- **Scene:** Relay Bot as a referee/judge between two competing approaches
- **Props:** Scale/balance, two paths diverging
- **Mood:** Thoughtful comparison

### Article 5: "Building an Agent That Writes to a Nostr Relay via ILP"
- **Scene:** Relay Bot building/coding at a workbench
- **Props:** Wrench, gears, relay components, code snippets floating
- **Mood:** Hands-on builder

### Article 6: "Why AI Agents Are the Next Wave of Nostr Users"
- **Scene:** Relay Bot leading a parade of smaller robots toward a relay tower
- **Props:** Multiple small bots, relay tower glowing, notes/events flowing
- **Mood:** Visionary, forward-looking

## Image Generation Settings
- **Model:** `google/nano-banana-pro` on Replicate
- **Aspect ratio:** 16:9
- **Output format:** PNG
- **Safety filter:** block_only_high
- **Resize:** 1000x420 (Dev.to cover spec) via ImageMagick

## Script Usage
```bash
# With character prefix (recommended for article covers):
./scripts/generate-cover.sh "Scene description here" output.png --character

# Without prefix (custom prompt):
./scripts/generate-cover.sh "Full custom prompt" output.png
```
