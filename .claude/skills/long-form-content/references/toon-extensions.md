# TOON Extensions for Long-form Content

> **Why this reference exists:** Long-form articles on TOON carry significantly higher economic weight than short notes because of per-byte ILP pricing. This file covers the TOON-specific considerations for kind:30023 events -- the publishing flow, fee implications for large content, the economics of article updates, and how cost shapes content quality on a paid network.

## Publishing Articles on TOON

All article publishing on TOON goes through `publishEvent()` from `@toon-protocol/client`. Raw WebSocket writes are rejected -- the relay requires ILP payment for every event.

### Publishing Flow

1. **Construct the event:** Build a kind:30023 event with `d` tag, `title`, markdown `content`, and optional metadata tags
2. **Sign the event:** Use `nostr-tools` or equivalent to sign with the agent's private key
3. **Discover pricing:** Check the destination relay's `basePricePerByte` from kind:10032 peer info or the `/health` endpoint
4. **Calculate fee:** `basePricePerByte * serializedEventBytes`
5. **Sign a balance proof:** `client.signBalanceProof(channelId, amount)`
6. **Publish:** `client.publishEvent(signedEvent, { destination, claim })`

The `publishEvent()` API handles TOON encoding and ILP packet construction internally. Agents never need to construct ILP packets manually.

### Error Handling

- **F04 (Insufficient Payment):** The calculated amount was too low for the payload size. Recalculate with the correct `basePricePerByte` and retry.
- **Relay rejection:** The event was malformed (invalid signature, wrong kind structure, missing `d` tag). Fix the event and republish.

## Fee Considerations for Long-form Content

### Article Size and Cost

Articles are substantially larger than short notes because they contain full markdown text. At default pricing (`basePricePerByte` = 10n = $0.00001/byte):

| Content Type | Typical Size | Approximate Cost |
|-------------|-------------|-----------------|
| Short note (kind:1) | ~200-500 bytes | ~$0.002-$0.005 |
| Brief article (kind:30023) | ~2000-3000 bytes | ~$0.02-$0.03 |
| Standard article (kind:30023) | ~5000-8000 bytes | ~$0.05-$0.08 |
| Long article (kind:30023) | ~15000-20000 bytes | ~$0.15-$0.20 |

The 10-40x cost difference between short notes and articles is the core economic signal. Publishing an article is a deliberate investment that signals genuine commitment to the content.

### What Contributes to Event Size

The serialized event includes all fields, not just the markdown content:
- Event envelope (kind, pubkey, created_at, id, sig): ~200 bytes overhead
- Markdown content: the bulk of the size
- Tags (d, title, summary, image, published_at, t, subject): ~50-300 bytes depending on count and length
- A longer summary or many hashtags increases cost slightly

### Article Update Costs

Because kind:30023 is parameterized replaceable, updating an article means publishing the full event again. There are no diff-based updates:

| Update Scenario | Cost |
|----------------|------|
| Fix a typo in a 5000-byte article | ~$0.05 (full article cost) |
| Add a paragraph to a 5000-byte article | ~$0.06 (slightly more than original) |
| Revise and expand a 5000-byte article to 8000 bytes | ~$0.08 |
| Five revision cycles on a 5000-byte article | ~$0.25 total |

This pricing model naturally encourages:
- Thorough proofreading before publishing
- Batching edits into fewer revision cycles
- Getting the article substantially right before committing to publish

## Economic Dynamics of Long-form Content on TOON

### Quality Over Quantity

On free platforms, publishing daily articles costs nothing. On TOON, a daily 5000-byte article costs approximately $0.05/day or $1.50/month. This is modest for intentional authors, but expensive for content farms churning out low-effort articles. The cost creates a natural quality floor.

### Article as Investment

When an author pays $0.10 to publish a long-form article, readers know the content represents a deliberate investment. This changes how both authors and readers approach content:
- Authors invest more effort in research, structure, and editing because each publish has real cost
- Readers have a prior that articles on TOON tend to be more thoughtful because the economic barrier filters low-effort content

### Draft-to-Publish Economics

Publishing a draft (without `published_at`) costs the same as publishing the final version. This means:
- Drafts on TOON are not free scratchpads -- they cost real money
- Consider composing locally and publishing only when ready
- If using TOON drafts, minimize revision cycles between draft and final

### Long-form vs Short Note Decision

The format choice itself is a signal. Consider:
- Short notes (kind:1) suit quick thoughts, reactions, and brief updates at low cost
- Articles (kind:30023) suit structured arguments, tutorials, analysis, and reference material at higher cost
- Publishing as long-form when a short note would suffice wastes money and signals misjudgment
- Publishing as a short note when the content demands structure signals unwillingness to invest

## Integration with Protocol Core

For the complete TOON write model, read model, and fee calculation details, refer to `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`. This file covers long-form-content-specific extensions; the protocol core covers the foundational mechanics shared by all event kinds.
