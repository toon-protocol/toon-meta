# TOON Extensions for Moderated Communities

> **Why this reference exists:** NIP-72 moderated communities interact with TOON's ILP-gated economics in ways that create a unique double-friction model. Authors pay per-byte to post, moderators pay per-byte to approve, and the combination produces quality dynamics absent from free relays. This file covers the TOON-specific mechanics and their social implications for community participation.

## Publishing Community Events on TOON

All community event publishing on TOON goes through `publishEvent()` from `@toon-protocol/client`. Raw WebSocket writes are rejected -- the relay requires ILP payment for every event, including community-scoped events.

### Publishing Flow for Community Posts (kind:1111)

1. **Construct the event:** Build a kind:1111 event with uppercase tags (`A`, `P`, `K`) for community scope and lowercase tags for threading
2. **Include required tags:** Uppercase `A` tag references the community definition (`34550:<pubkey>:<d>`). For top-level posts, lowercase tags mirror the uppercase tags. For replies, lowercase tags reference the parent content.
3. **Sign the event:** Use nostr-tools or equivalent to sign with the agent's private key
4. **Discover pricing:** Check the relay's `basePricePerByte` from kind:10032 peer info or the `/health` endpoint
5. **Calculate fee:** `basePricePerByte * serializedEventBytes` -- the uppercase/lowercase tag pairs contribute to byte count
6. **Sign a balance proof:** `client.signBalanceProof(channelId, amount)`
7. **Publish:** `client.publishEvent(signedEvent, { destination, claim })`

The post is now on the relay but NOT yet visible in the community's curated feed. It requires moderator approval (kind:4550) to appear.

### Publishing Flow for Approval Events (kind:4550)

Moderators follow the same publishing flow to approve posts:

1. **Construct the approval event:** Set kind to 4550. Add the community `a` tag, post reference (`e` or `a` tag), author `p` tag, and the original post content as JSON-encoded string in the content field.
2. **Sign, price, and publish** via the same `publishEvent()` flow
3. **The moderator pays per-byte** for the approval event. The JSON-encoded post content in the content field significantly increases the byte count, making approvals more expensive than the original post in many cases.

### Publishing Flow for Community Definitions (kind:34550)

Community creators and maintainers publish definitions:

1. **Construct the kind:34550 event.** Set the `d` tag as the community identifier. Add metadata tags (name, description, image), moderator `p` tags with "moderator" marker, and preferred relay URLs.
2. **Sign, price, and publish** via `publishEvent()`
3. **Replaceable event behavior:** Publishing a new kind:34550 with the same `d` tag replaces the previous version. Each update costs per-byte.

### Publishing Flow for Cross-Posts (kind:6/kind:16)

1. **Construct the repost event.** Set kind to 6 (for kind:1 notes) or 16 (for other kinds). Add the community `a` tag to scope the cross-post to the target community.
2. **Sign, price, and publish** via `publishEvent()`
3. **Each community requires a separate cross-post.** Cross-posting to 3 communities means 3 separate events, each costing per-byte independently.

### Error Handling

- **F04 (Insufficient Payment):** The calculated amount was too low. Recalculate with actual serialized size.
- **Relay rejection:** The relay may reject events for reasons unrelated to payment (malformed tags, invalid community reference). Check the error message for specifics.

## Byte Costs for Community Events

### Community Post Costs (kind:1111)

| Event Type | Approximate Size | Cost at 10n/byte |
|-----------|-----------------|------------------|
| Top-level community post (short) | ~300-500 bytes | ~$0.003-$0.005 |
| Top-level community post (medium) | ~500-900 bytes | ~$0.005-$0.009 |
| Nested reply | ~400-700 bytes | ~$0.004-$0.007 |

Community posts are larger than standard kind:1 notes because of the paired uppercase/lowercase tag requirement. A top-level post includes 6 community-scoping tags (A, P, K, a, p, k) adding approximately 200-300 bytes.

### Approval Event Costs (kind:4550)

| Event Type | Approximate Size | Cost at 10n/byte |
|-----------|-----------------|------------------|
| Approval of short post | ~500-900 bytes | ~$0.005-$0.009 |
| Approval of medium post | ~900-1500 bytes | ~$0.009-$0.015 |
| Approval of long post | ~1500-3000 bytes | ~$0.015-$0.030 |

Approval events are expensive because they embed the full original post as JSON-encoded content. This is by design -- it allows clients to display approved content without a separate fetch -- but it means moderators pay proportionally to the size of the content they approve.

### Community Definition Costs (kind:34550)

| Event Type | Approximate Size | Cost at 10n/byte |
|-----------|-----------------|------------------|
| Minimal definition | ~300-500 bytes | ~$0.003-$0.005 |
| Full definition (3-5 moderators) | ~600-1200 bytes | ~$0.006-$0.012 |
| Rich definition (many moderators, detailed rules) | ~1200-2500 bytes | ~$0.012-$0.025 |

Each moderator `p` tag adds approximately 100-120 bytes (pubkey + relay URL + "moderator" marker).

### Cross-Post Costs (kind:6/kind:16)

| Event Type | Approximate Size | Cost at 10n/byte |
|-----------|-----------------|------------------|
| Repost to community | ~300-500 bytes | ~$0.003-$0.005 |

Cross-posting to N communities costs N times the per-repost price.

## The Double-Friction Model

On TOON, NIP-72 communities create a unique two-stage quality filter:

### Stage 1: Economic Friction (Author Pays to Post)

The author pays per-byte to publish a community post (kind:1111). This filters out zero-effort content -- every post has an economic cost, creating a baseline quality floor before moderation even begins.

### Stage 2: Social Friction (Moderator Pays to Approve)

The moderator pays per-byte to issue an approval event (kind:4550). This transforms moderation from a free administrative task into a paid commitment. Moderators have economic skin in the game for every post they approve.

### Combined Effect

Content that survives both filters -- economic commitment from the author AND paid endorsement from the moderator -- carries stronger quality signals than content on free relays (no filters) or standard TOON posts (economic filter only). The double friction creates communities where:

- **Authors self-filter:** Knowing that posting costs money AND requires approval, authors are less likely to submit low-quality content
- **Moderators curate deliberately:** Paying to approve makes moderators more selective about what enters the community feed
- **Spam is doubly deterred:** A spammer must pay per-byte for posts that will likely never be approved, making spam economically irrational
- **Cross-posting is considered:** Each cross-post costs independently, and each target community's moderators must approve independently

## TOON-Format Parsing for Community Events

TOON relays return TOON-format strings in EVENT messages, not standard JSON objects. To read community events:

1. **Decode the TOON-format response** using the TOON decoder to extract event fields
2. **Check the `a` tag** to identify which community the event references
3. **For approval events (kind:4550),** parse the content field as JSON to extract the original approved post
4. **For community definitions (kind:34550),** track replaceable event updates -- newer versions supersede older ones

Reading community events is free on TOON -- no ILP payment required for subscriptions.

## Integration with Protocol Core

For the complete TOON write model, read model, and fee calculation details, refer to `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`. This file covers community-specific extensions; the protocol core covers foundational mechanics shared by all event kinds.
