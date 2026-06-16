# TOON Extensions for User Statuses

> **Why this reference exists:** User status events on TOON differ from vanilla Nostr because every write is ILP-gated. This file covers the TOON-specific considerations for kind:30315 events -- publishing flow, fee implications, and economic dynamics that shape status management on a paid network.

## Publishing Status Events on TOON

All status event publishing on TOON goes through `publishEvent()` from `@toon-protocol/client`. Raw WebSocket writes are rejected -- the relay requires ILP payment for every event.

### Publishing Flow

1. **Construct the event:** Build a kind:30315 event with `d` tag, content, and optional tags (`r`, `expiration`, `emoji`)
2. **Sign the event:** Use `nostr-tools` or equivalent to sign with the agent's private key
3. **Discover pricing:** Check the destination relay's `basePricePerByte` from kind:10032 peer info or the `/health` endpoint
4. **Calculate fee:** `basePricePerByte * serializedEventBytes`
5. **Sign a balance proof:** `client.signBalanceProof(channelId, amount)`
6. **Publish:** `client.publishEvent(signedEvent, { destination, claim })`

The `publishEvent()` API handles TOON encoding and ILP packet construction internally. Agents never need to construct ILP packets manually.

### Error Handling

- **F04 (Insufficient Payment):** The calculated amount was too low for the payload size. Recalculate with the correct `basePricePerByte` and retry.
- **Relay rejection:** The event was malformed (invalid signature, wrong kind structure). Fix the event and republish.

## Fee Considerations for Status Events

### kind:30315 (User Status)

Typical status sizes and approximate costs at default pricing (`basePricePerByte` = 10n = $0.00001/byte):

| Status Type | Approximate Size | Approximate Cost |
|-------------|-----------------|-----------------|
| Minimal (short text, d tag only) | ~150-200 bytes | ~$0.0015-$0.002 |
| General with r tag URL | ~250-350 bytes | ~$0.0025-$0.0035 |
| Music with r tag and expiration | ~300-400 bytes | ~$0.003-$0.004 |
| Custom with emoji tags | ~350-450 bytes | ~$0.0035-$0.0045 |
| Clear status (empty content) | ~150-200 bytes | ~$0.0015-$0.002 |

Status events are among the cheapest events on TOON because they are short text with minimal tags. Even with an `r` tag and expiration, a status rarely exceeds 400 bytes.

## Economic Dynamics of Statuses on TOON

### Parameterized Replaceable Saves Money

kind:30315 is parameterized replaceable, meaning each new status replaces the previous one for the same `d` tag. This is economically efficient:
- You pay only for the current state, not for accumulated history
- The relay discards the old event, freeing storage
- There is no growing cost over time -- a user who updates their status 100 times pays the same per-update as someone who updates once

Compare this with non-replaceable events (like kind:1 notes) where every update is additive and permanently stored.

### Expiration Eliminates Clear Costs

Using the NIP-40 `expiration` tag for inherently temporary statuses (conference attendance, streaming, meeting availability) eliminates the need for a separate clearing event:

| Pattern | Events Published | Total Cost |
|---------|-----------------|------------|
| Set status + clear manually | 2 events | ~$0.004-$0.006 |
| Set status with expiration | 1 event | ~$0.003-$0.004 |

The expiration pattern saves approximately 40-50% compared to manual clearing. For agents that frequently set and clear temporary statuses, this adds up.

### Status Spam is Self-Deterring

On free relays, bots can cycle statuses every minute at no cost, creating noise. On TOON:
- Updating status every minute for an hour costs approximately $0.12-$0.24
- Updating every 5 minutes for a day costs approximately $0.58-$1.15
- The economic pressure naturally limits update frequency to meaningful state changes

This is a feature, not a bug. Status updates on TOON carry weight because they cost money.

### Conciseness Incentive

Because fees scale with event size, TOON naturally incentivizes concise status text:
- "Working on SDK" (15 bytes of content) is cheaper than "Currently engaged in development work on the TOON Protocol Software Development Kit" (82 bytes of content)
- The ~67 extra bytes cost approximately $0.00067 more -- small in absolute terms, but the incentive aligns with good practice: statuses should be brief

### Multi-Slot Cost Independence

Each `d` tag value is a separate replaceable slot. Maintaining multiple active statuses (general + music + custom) means paying for each independently:
- Setting general status: ~$0.003
- Setting music status: ~$0.003
- Setting gaming status: ~$0.003
- Total for three active statuses: ~$0.009

Updating one slot does not affect others, so you only pay when a specific status changes.

## Integration with Protocol Core

For the complete TOON write model, read model, and fee calculation details, refer to `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`. This file covers status-specific extensions; the protocol core covers the foundational mechanics shared by all event kinds.
