# TOON Extensions for Sensitive Content / Content Warnings

> **Why this reference exists:** Content warnings on TOON differ from vanilla Nostr because every event publish is ILP-gated. This file covers the TOON-specific considerations for the `content-warning` tag -- fee impact, quality signaling dynamics, and how paid publishing changes the social calculus of content warning decisions.

## Publishing Content-Warned Events on TOON

All publishing on TOON goes through `publishEvent()` from `@toon-protocol/client`. Raw WebSocket writes are rejected -- the relay requires ILP payment for every event, including events with content warnings.

### Publishing Flow

1. **Construct the event:** Build the event as normal (any kind), then add `["content-warning", "reason"]` to the tags array
2. **Sign the event:** Use `nostr-tools` or equivalent to sign with the agent's private key
3. **Discover pricing:** Check the destination relay's `basePricePerByte` from kind:10032 peer info or the `/health` endpoint
4. **Calculate fee:** `basePricePerByte * serializedEventBytes` (the content-warning tag is included in the byte count)
5. **Sign a balance proof:** `client.signBalanceProof(channelId, amount)`
6. **Publish:** `client.publishEvent(signedEvent, { destination, claim })`

The `publishEvent()` API handles TOON encoding and ILP packet construction internally. Agents never need to construct ILP packets manually.

### Error Handling

- **F04 (Insufficient Payment):** The calculated amount was too low for the payload size. Recalculate with the correct `basePricePerByte` and retry.
- **Relay rejection:** The event was malformed (invalid signature, wrong kind structure, missing required tags). Fix the event and republish.

## Fee Impact of Content Warnings

The `content-warning` tag adds minimal overhead to any event. The cost increase is negligible regardless of the base event size.

### Tag Size by Reason Length

| Tag Form | Approximate Added Bytes | Added Cost (at 10n/byte) |
|----------|------------------------|--------------------------|
| `["content-warning"]` (no reason) | ~20 bytes | ~$0.0002 |
| `["content-warning", "nudity"]` | ~30 bytes | ~$0.0003 |
| `["content-warning", "violence"]` | ~32 bytes | ~$0.0003 |
| `["content-warning", "spoiler: Movie Title"]` | ~45 bytes | ~$0.0005 |
| `["content-warning", "graphic violence, disturbing imagery"]` | ~55 bytes | ~$0.0006 |
| `["content-warning", "spoiler: Breaking Bad season 5 finale"]` | ~60 bytes | ~$0.0006 |

### Impact on Different Event Types

| Base Event | Base Size | With CW Tag | CW Overhead | CW as % of Total |
|-----------|-----------|-------------|-------------|-------------------|
| Short note (kind:1, ~100 chars) | ~200 bytes | ~240 bytes | ~$0.0004 | ~17% |
| Short note (kind:1, ~280 chars) | ~400 bytes | ~440 bytes | ~$0.0004 | ~9% |
| Long-form article (kind:30023, ~5KB) | ~5000 bytes | ~5040 bytes | ~$0.0004 | ~0.8% |
| Long-form article (kind:30023, ~20KB) | ~20000 bytes | ~20040 bytes | ~$0.0004 | ~0.2% |
| Picture event (kind:20) | ~300 bytes | ~340 bytes | ~$0.0004 | ~12% |
| Video event (kind:34235) | ~400 bytes | ~440 bytes | ~$0.0004 | ~9% |

The percentage overhead decreases as the base event gets larger. For long-form articles, the content warning is essentially free relative to the article's base cost.

## Content Warnings as Quality Signals on TOON

### The Paid Relay Quality Dynamic

On free Nostr relays, content warnings are purely a social norm -- there is no economic consequence for omitting them. On TOON, the dynamics are different:

- **Publishing costs money.** Authors who pay to publish are already more intentional about their content. Adding a content warning extends this intentionality to how the content is presented.
- **Readers expect quality.** On a paid relay, the baseline content quality is higher because the economic barrier filters out spam and low-effort posts. Content warnings are part of this quality signal -- they indicate an author who thinks about their audience, not just their message.
- **Community trust compounds.** On a paid network, trust is more valuable because participants have invested money. Authors who consistently use appropriate content warnings build trust faster. Authors who consistently omit them erode trust faster.

### The Negligible Cost Argument

The cost of adding a content warning is so low (~$0.0003-$0.0006) that there is never an economic argument for omitting one. Compare:

| Action | Cost |
|--------|------|
| Adding a content warning to a note | ~$0.0004 |
| Publishing the note itself | ~$0.002-$0.004 |
| Deleting the note later (kind:5) | ~$0.002 |
| Total cost of "publish without CW, get complaints, delete" | ~$0.004-$0.006 |
| Total cost of "publish with CW" | ~$0.002-$0.005 |

Publishing with a content warning is always cheaper than the publish-complaint-delete cycle. Prevention is cheaper than cleanup -- this is a recurring TOON principle.

### Content Warnings and Moderation

On TOON, content warnings interact with moderation in specific ways:

- **Community moderators (NIP-72)** may require content warnings for certain types of content. Failing to add them could result in posts not being approved.
- **Relay operators** may set policies requiring content warnings for specific content categories. Non-compliance could result in event rejection or account restrictions.
- **NIP-32 labels** can be used by third parties (moderators, automated classifiers) to retroactively label content that should have had a warning. This is a separate mechanism from NIP-36 but serves a complementary purpose.

## Content Warning Strategy on TOON

The cost dynamics suggest a simple decision framework:

1. **When in doubt, add it.** The cost is negligible (~$0.0004). The downside of a false positive (unnecessary warning, one extra click for readers) is much smaller than the downside of a false negative (harm, loss of trust, potential deletion and republish).

2. **Be specific.** A reason string like `"nudity"` costs only ~10 bytes more than a bare `["content-warning"]` tag but provides significantly more value to readers. The marginal cost of specificity is essentially zero.

3. **Consider the context.** Content that is normal in one community may be sensitive in another. If publishing to a general-purpose TOON relay, err on the side of more warnings. If publishing to a specialized community relay where all participants expect certain content types, fewer warnings may be appropriate.

4. **Combine with NIP-32 labels for structured classification.** If you need content to be filterable by sensitivity category (not just hidden behind a click-through), use both `["content-warning", "reason"]` on the event and a separate kind:1985 label event with structured namespace labels.

## Integration with Protocol Core

For the complete TOON write model, read model, and fee calculation details, refer to `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`. This file covers content-warning-specific extensions; the protocol core covers the foundational mechanics shared by all event kinds.
