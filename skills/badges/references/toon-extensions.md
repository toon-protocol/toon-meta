# TOON Extensions for Badge Events

> **Why this reference exists:** Badge events on TOON differ from vanilla Nostr because every write is ILP-gated. This file covers the TOON-specific considerations for kind:30009, kind:8, and kind:30008 events -- publishing flow, fee implications, and economic dynamics that shape badge systems on a paid network.

## Publishing Badge Events on TOON

All badge event publishing on TOON goes through `publishEvent()` from `@toon-protocol/client`. Raw WebSocket writes are rejected -- the relay requires ILP payment for every event.

### Publishing Flow

1. **Construct the event:** Build a kind:30009, kind:8, or kind:30008 event with the appropriate tags
2. **Sign the event:** Use `nostr-tools` or equivalent to sign with the agent's private key
3. **Discover pricing:** Check the destination relay's `basePricePerByte` from kind:10032 peer info or the `/health` endpoint
4. **Calculate fee:** `basePricePerByte * serializedEventBytes`
5. **Sign a balance proof:** `client.signBalanceProof(channelId, amount)`
6. **Publish:** `client.publishEvent(signedEvent, { destination, claim })`

The `publishEvent()` API handles TOON encoding and ILP packet construction internally. Agents never need to construct ILP packets manually.

### Error Handling

- **F04 (Insufficient Payment):** The calculated amount was too low for the payload size. Recalculate with the correct `basePricePerByte` and retry.
- **Relay rejection:** The event was malformed (invalid signature, wrong kind structure). Fix the event and republish.

## Fee Considerations for Badge Events

### kind:30009 (Badge Definition)

Badge definitions are moderate-size events. Cost scales with the amount of metadata:

| Definition Complexity | Approximate Size | Approximate Cost |
|----------------------|-----------------|-----------------|
| Minimal (d + name only) | ~200 bytes | ~$0.002 |
| Standard (d, name, description, image) | ~400 bytes | ~$0.004 |
| Full (d, name, description, image with dimensions, thumb with dimensions) | ~500 bytes | ~$0.005 |

Because kind:30009 is parameterized replaceable, updating a badge definition costs the same as creating one. Each update replaces the previous version for the same `d` tag. This means correcting a typo in the badge name requires paying for the full event again.

### kind:8 (Badge Award)

Awards are small events that scale with recipient count:

| Recipients | Approximate Size | Approximate Cost |
|-----------|-----------------|-----------------|
| 1 recipient | ~200 bytes | ~$0.002 |
| 5 recipients | ~500 bytes | ~$0.005 |
| 10 recipients | ~900 bytes | ~$0.009 |
| 50 recipients | ~3700 bytes | ~$0.037 |

Each additional `p` tag adds approximately 70 bytes. Batch awards are significantly cheaper than individual award events: awarding 10 recipients in one event (~$0.009) costs less than half of 10 separate single-recipient awards (~$0.020).

### kind:30008 (Profile Badges)

Profile badge lists scale with the number of displayed badges:

| Badges Displayed | Approximate Size | Approximate Cost |
|-----------------|-----------------|-----------------|
| 1 badge | ~250 bytes | ~$0.0025 |
| 3 badges | ~400 bytes | ~$0.004 |
| 5 badges | ~550 bytes | ~$0.0055 |
| 10 badges | ~900 bytes | ~$0.009 |

Each badge requires an `a`+`e` tag pair adding approximately 130 bytes. Because kind:30008 is parameterized replaceable, each update replaces the entire display. Adding or removing a badge means republishing the full list.

## Economic Dynamics of Badges on TOON

### Badge Spam is Economically Constrained

On free relays, anyone can create unlimited badge definitions and spam awards to thousands of accounts at zero cost. On TOON, the economics naturally constrain badge spam:

- Creating 100 badge definitions costs ~$0.40
- Awarding each badge to 100 recipients (individually) costs ~$20.00
- Awarding each badge to 100 recipients (batched, 10 per event) costs ~$9.00

These costs make large-scale badge spam economically impractical. The result is that badges on TOON tend to be more meaningful and intentionally issued.

### Issuer Reputation as Badge Value

A badge's value comes from its issuer's reputation, not its label. On TOON, the issuer has paid to create and award the badge, adding economic weight. But economic investment alone does not create trust -- a well-known community leader's badge carries more weight than an unknown account's badge, regardless of how much either paid.

### Replaceable Events Save Money on Corrections

Both badge definitions (kind:30009) and profile badges (kind:30008) are parameterized replaceable events. This means:
- Updating a badge's name, description, or image replaces the old version -- no duplicate events accumulate
- Updating your profile badge display replaces the old list -- you do not pay for stale versions lingering on the relay
- Only the latest version is retained, so storage costs are bounded

Awards (kind:8) are NOT replaceable. Each award is permanent and individually stored. This is intentional -- awards are historical records.

### Batch Award Economics

The per-byte pricing model creates a clear incentive to batch awards:

- **10 individual awards:** 10 events * ~200 bytes = ~2000 bytes = ~$0.020
- **1 batched award (10 recipients):** 1 event * ~900 bytes = ~$0.009

Batching saves ~55% on award costs. For organizations issuing badges regularly, this adds up. The tradeoff is that batched awards share a single timestamp and cannot be individually revoked (deleting the event revokes all awards in the batch).

### Profile Badge Curation Cost

Updating your profile badge display costs money each time. This creates a natural incentive to curate thoughtfully rather than constantly shuffling badges. On free relays, users might update their badge display impulsively; on TOON, each update is a deliberate economic decision.

## Integration with Protocol Core

For the complete TOON write model, read model, and fee calculation details, refer to `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`. This file covers badge-specific extensions; the protocol core covers the foundational mechanics shared by all event kinds.
