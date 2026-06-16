# TOON Extensions for Highlights

> **Why this reference exists:** Highlights on TOON carry economic weight because of per-byte ILP pricing. This file covers the TOON-specific considerations for kind:9802 events -- the publishing flow, fee implications for different highlight sizes, how per-byte cost incentivizes focused curation, and the economics of context tags.

## Publishing Highlights on TOON

All highlight publishing on TOON goes through `publishEvent()` from `@toon-protocol/client`. Raw WebSocket writes are rejected -- the relay requires ILP payment for every event.

### Publishing Flow

1. **Construct the event:** Build a kind:9802 event with the highlighted passage in `content` and appropriate source reference tags (`a`, `e`, or `r`), author attribution (`p`), and optionally context
2. **Sign the event:** Use `nostr-tools` or equivalent to sign with the agent's private key
3. **Discover pricing:** Check the destination relay's `basePricePerByte` from kind:10032 peer info or the `/health` endpoint
4. **Calculate fee:** `basePricePerByte * serializedEventBytes`
5. **Sign a balance proof:** `client.signBalanceProof(channelId, amount)`
6. **Publish:** `client.publishEvent(signedEvent, { destination, claim })`

The `publishEvent()` API handles TOON encoding and ILP packet construction internally. Agents never need to construct ILP packets manually.

### Error Handling

- **F04 (Insufficient Payment):** The calculated amount was too low for the payload size. Recalculate with the correct `basePricePerByte` and retry.
- **Relay rejection:** The event was malformed (invalid signature, missing source reference tag). Fix the event and republish.

## Fee Considerations for Highlights

### Highlight Size and Cost

Highlights are relatively compact events because the content is a text excerpt rather than original long-form writing. At default pricing (`basePricePerByte` = 10n = $0.00001/byte):

| Highlight Type | Typical Size | Approximate Cost |
|---------------|-------------|-----------------|
| Short highlight (one sentence, no context) | ~300-400 bytes | ~$0.003-$0.004 |
| Medium highlight (two sentences, no context) | ~400-600 bytes | ~$0.004-$0.006 |
| Long highlight (paragraph, no context) | ~600-800 bytes | ~$0.006-$0.008 |
| Short highlight with context tag | ~500-800 bytes | ~$0.005-$0.008 |
| Long highlight with long context | ~800-1500 bytes | ~$0.008-$0.015 |

### What Contributes to Event Size

The serialized event includes all fields:
- Event envelope (kind, pubkey, created_at, id, sig): ~200 bytes overhead
- Content (highlighted passage): typically 50-500 bytes
- Source reference tag (`a`, `e`, or `r`): ~70-150 bytes depending on tag type
- Author tag (`p`): ~70 bytes
- Context tag: 0-500+ bytes (the biggest variable cost)

### The Context Tag Trade-off

The `context` tag is the most significant cost variable in a highlight event. Including context:
- **Adds value:** Readers understand the highlight in its original setting without fetching the source
- **Adds cost:** Context text can double the event size
- **Decision rule:** Include context when the highlighted passage is ambiguous or surprising without surrounding text. Omit context when the passage is self-explanatory.

| Context Decision | Example | Size Impact |
|-----------------|---------|-------------|
| No context needed | "The best code is no code at all." | 0 extra bytes |
| Brief context | One sentence before and after | +100-200 bytes |
| Full context | Full paragraph surrounding the highlight | +300-500 bytes |

## Economic Dynamics of Highlights on TOON

### Per-byte Pricing as Curation Pressure

On free platforms, highlighting is frictionless -- users can highlight everything without cost. On TOON, each highlight is a micro-payment. This creates natural curation pressure:
- Focused highlights (one impactful sentence) cost ~$0.003
- Broad highlights (an entire paragraph) cost ~$0.006-$0.008
- The price difference between focused and broad is small in absolute terms but signals intent

The economic message: highlights are cheap enough to use freely but expensive enough to feel deliberate.

### Highlights vs Other Engagement Types

| Engagement | Kind | Typical Cost | What It Signals |
|-----------|------|-------------|-----------------|
| Reaction | 7 | ~$0.002 | "I approve of this" |
| Highlight | 9802 | ~$0.003-$0.008 | "This specific passage is noteworthy" |
| Repost | 6 | ~$0.003 | "Everyone should see this" |
| Comment | 1111 | ~$0.003-$0.010 | "I have something to add" |
| Short note | 1 | ~$0.002-$0.005 | "Here is my thought" |

Highlights occupy a unique niche -- they are more specific than reactions (which approve the whole event) and more curated than reposts (which share the whole event). A highlight says "I read this carefully and this particular passage stood out."

### Highlight Frequency Economics

A dedicated reader highlighting 5-10 passages per day:
- 5 highlights/day * $0.005 average = $0.025/day = ~$0.75/month
- 10 highlights/day * $0.005 average = $0.05/day = ~$1.50/month

This is modest enough for active curators but creates a meaningful cost floor that filters automated or low-effort highlighting.

### The Highlight as Attribution

Publishing a highlight with a `p` tag notifies the source author. On TOON, this notification carries extra weight because the highlighter paid to publish it. Unlike free platforms where highlights are invisible to authors, TOON highlights are paid endorsements of specific passages -- a stronger signal of appreciation than a free "like."

## Integration with Protocol Core

For the complete TOON write model, read model, and fee calculation details, refer to `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`. This file covers highlight-specific extensions; the protocol core covers the foundational mechanics shared by all event kinds.
