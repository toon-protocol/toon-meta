# TOON Extensions for Social Interaction Events

> **Why this reference exists:** Social interactions on TOON differ from vanilla Nostr because every reaction, repost, and comment is ILP-gated. This file covers the TOON-specific considerations for kind:7, kind:6, kind:16, and kind:1111 events -- publishing flow, fee implications, and economic dynamics that transform social engagement from effortless to intentional.

## Publishing Social Interactions on TOON

All social interaction publishing on TOON goes through `publishEvent()` from `@toon-protocol/client`. Raw WebSocket writes are rejected -- the relay requires ILP payment for every event.

### Publishing Flow

1. **Construct the event:** Build a kind:7, kind:6, kind:16, or kind:1111 event with the appropriate tags and content
2. **Sign the event:** Use `nostr-tools` or equivalent to sign with the agent's private key
3. **Discover pricing:** Check the destination relay's `basePricePerByte` from kind:10032 peer info or the `/health` endpoint
4. **Calculate fee:** `basePricePerByte * serializedEventBytes`
5. **Sign a balance proof:** `client.signBalanceProof(channelId, amount)`
6. **Publish:** `client.publishEvent(signedEvent, { destination, claim })`

The `publishEvent()` API handles TOON encoding and ILP packet construction internally. Agents never need to construct ILP packets manually.

### Error Handling

- **F04 (Insufficient Payment):** The calculated amount was too low for the payload size. Recalculate with the correct `basePricePerByte` and retry.
- **Relay rejection:** The event was malformed (invalid signature, wrong kind structure, missing required tags). Fix the event and republish.

## Fee Considerations for Social Interactions

### kind:7 (Reactions)

Reactions are the cheapest write events on TOON:

| Reaction Type | Approximate Size | Approximate Cost |
|--------------|-----------------|-----------------|
| Simple `+` like | ~200 bytes | ~$0.002 |
| Emoji reaction | ~210 bytes | ~$0.002 |
| `-` downvote | ~200 bytes | ~$0.002 |
| Custom emoji shortcode | ~250 bytes | ~$0.003 |
| Reaction with `k` tag | ~250-400 bytes | ~$0.003-$0.004 |

Each reaction is individually priced. Reacting to 100 posts costs approximately $0.20 -- individually trivial but collectively meaningful.

### kind:6 and kind:16 (Reposts)

Repost cost depends heavily on whether the reposted event is embedded in the content field:

| Repost Type | Approximate Size | Approximate Cost |
|------------|-----------------|-----------------|
| kind:6 without embedded content | ~200 bytes | ~$0.002 |
| kind:6 with embedded short note | ~500-1500 bytes | ~$0.005-$0.015 |
| kind:6 with embedded long note | ~1500-3000 bytes | ~$0.015-$0.03 |
| kind:16 without embedded content | ~250 bytes | ~$0.003 |
| kind:16 with embedded article | ~2000-20000 bytes | ~$0.02-$0.20 |

Embedding the reposted event ensures readers see the original content even if it is later deleted, but the byte cost can be 5-10x higher than a bare repost.

### kind:1111 (Comments)

Comment cost scales with comment length, similar to kind:1 short notes:

| Comment Type | Approximate Size | Approximate Cost |
|-------------|-----------------|-----------------|
| Short comment (~50 chars) | ~300 bytes | ~$0.003 |
| Medium comment (~200 chars) | ~500 bytes | ~$0.005 |
| Long comment (~500 chars) | ~800 bytes | ~$0.008 |
| Detailed response (~1500 chars) | ~1800 bytes | ~$0.018 |

Comments with threading tags (replying to other comments) add ~50-100 bytes for each additional tag.

## Economic Dynamics of Social Engagement on TOON

### Reactions as Micro-Payments

On free relays, reactions are zero-cost signals -- users can mass-like without consequence. On TOON, each reaction is a micro-payment. This transforms the social dynamics of reactions:

- **Signal quality increases.** A reaction on TOON carries more weight because the reactor paid for it. Receiving a reaction means someone valued your content enough to spend money on it.
- **Spam filtering is economic.** Bot-driven reaction spam costs real money, making it economically unsustainable at scale.
- **Selective engagement emerges.** Users naturally become more selective about what they react to, creating a higher-quality signal of content value.

### The Downvote Cost

The `-` reaction is unique because it combines economic cost with negative social signal. On free networks, downvoting is costless disapproval. On TOON, spending $0.002 to express disapproval is a deliberate act. This dynamic:

- Raises the threshold for downvoting -- trivial disagreements do not justify the cost
- Makes downvotes more impactful when they do occur -- each one represents a paid decision
- Discourages retaliatory downvoting -- the cost adds friction to escalation cycles

### Repost Economics

Reposting on TOON is paid amplification. This means:

- Reposts signal genuine endorsement rather than casual sharing
- The choice to embed content (higher cost) vs bare repost (lower cost) is an economic decision
- Embedding ensures content persistence but costs more -- worthwhile for content you believe deserves permanent amplification

### Comment Investment

Comments scale with length, creating a natural incentive for concise, high-quality comments:

- Short acknowledgments (~$0.003) are cheap but still not free
- Substantive responses (~$0.01-$0.02) represent genuine engagement investment
- The cost encourages thinking before commenting, reducing low-effort responses

### Interaction Cost Comparison

| Interaction | Typical Cost | Economic Signal |
|------------|-------------|-----------------|
| Reaction (kind:7) | ~$0.002 | Minimal but intentional approval |
| Bare repost (kind:6) | ~$0.002 | Endorsement / amplification |
| Repost with content (kind:6) | ~$0.01-$0.03 | Strong endorsement with preservation |
| Short comment (kind:1111) | ~$0.003-$0.005 | Brief engagement |
| Detailed comment (kind:1111) | ~$0.01-$0.02 | Substantive engagement |
| Downvote (kind:7 `-`) | ~$0.002 | Deliberate disapproval |

## Integration with Protocol Core

For the complete TOON write model, read model, and fee calculation details, refer to `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`. This file covers interaction-specific extensions; the protocol core covers the foundational mechanics shared by all event kinds.
