# TOON Extensions for Poll Events

> **Why this reference exists:** Polls on TOON differ from vanilla Nostr because every poll creation and every vote is ILP-gated. This file covers the TOON-specific considerations for kind:1068 and kind:1018 events -- publishing flow, fee implications, ballot-stuffing prevention, and the economic dynamics that transform polling from a free-for-all into an economically-weighted signal mechanism.

## Publishing Polls and Votes on TOON

All poll publishing on TOON goes through `publishEvent()` from `@toon-protocol/client`. Raw WebSocket writes are rejected -- the relay requires ILP payment for every event.

### Publishing Flow

1. **Construct the event:** Build a kind:1068 (poll) or kind:1018 (vote) event with the appropriate tags and content
2. **Sign the event:** Use `nostr-tools` or equivalent to sign with the agent's private key
3. **Discover pricing:** Check the destination relay's `basePricePerByte` from kind:10032 peer info or the `/health` endpoint
4. **Calculate fee:** `basePricePerByte * serializedEventBytes`
5. **Sign a balance proof:** `client.signBalanceProof(channelId, amount)`
6. **Publish:** `client.publishEvent(signedEvent, { destination, claim })`

The `publishEvent()` API handles TOON encoding and ILP packet construction internally. Agents never need to construct ILP packets manually.

### Error Handling

- **F04 (Insufficient Payment):** The calculated amount was too low for the payload size. Recalculate with the correct `basePricePerByte` and retry.
- **Relay rejection:** The event was malformed (invalid signature, wrong kind structure, missing required tags). Fix the event and republish.

## Fee Considerations for Polls

### kind:1068 (Poll Creation)

Poll creation cost depends on the question length and number of options:

| Poll Type | Approximate Size | Approximate Cost |
|-----------|-----------------|-----------------|
| Simple 2-option poll (short question) | ~300 bytes | ~$0.003 |
| 3-option poll (medium question) | ~400 bytes | ~$0.004 |
| 5-option poll with endsAt | ~500 bytes | ~$0.005 |
| Range/rating poll (5 options + value tags) | ~550 bytes | ~$0.006 |
| Many options (8+) with long labels | ~700-1000 bytes | ~$0.007-$0.010 |

Each `option` tag adds approximately 30-50 bytes depending on label length. The `relay`, `endsAt`, `valueMinimum`, `valueMaximum`, and `consensusThreshold` tags each add approximately 20-40 bytes.

### kind:1018 (Votes)

Votes are among the cheapest write events on TOON because the content field is empty and tags are minimal:

| Vote Type | Approximate Size | Approximate Cost |
|-----------|-----------------|-----------------|
| Single choice vote | ~200 bytes | ~$0.002 |
| Multiple choice vote (2 selections) | ~230 bytes | ~$0.002 |
| Multiple choice vote (3+ selections) | ~260 bytes | ~$0.003 |

Each additional `response` tag adds approximately 20-30 bytes.

## Ballot-Stuffing Prevention Through Economic Friction

The most significant TOON extension to polling is natural sybil resistance through economic friction. This is not a protocol-level enforcement mechanism -- it is an emergent property of ILP-gated writes.

### The Economics of Vote Manipulation

On free Nostr relays, ballot stuffing is trivial:
- Create 1,000 keypairs: free
- Submit 1,000 votes: free
- Total cost of manipulating a poll: $0.00

On TOON:
- Create 1,000 keypairs: free (key generation has no cost)
- Submit 1,000 votes: 1,000 * ~$0.002 = ~$2.00
- Total cost of manipulating a poll: ~$2.00 minimum

This does not make manipulation impossible, but it makes it economically visible and costly. For polls with dozens of voters, spending $2 to stuff 1,000 ballots is disproportionately expensive and detectable. For high-stakes polls with thousands of voters, the cost scales linearly.

### Cost-Per-Vote as Quality Signal

Each vote on TOON represents a micro-payment of conviction:

| Poll Scale | Total Votes | Collective Investment | Economic Signal Strength |
|-----------|-------------|----------------------|------------------------|
| Small (community) | 10-50 | $0.02-$0.10 | Modest but genuine |
| Medium (topic) | 50-200 | $0.10-$0.40 | Meaningful engagement |
| Large (network-wide) | 200-1000 | $0.40-$2.00 | Strong collective signal |

The collective investment in a poll's outcome creates a quality floor that does not exist on free platforms. Every response represents someone who cared enough to pay.

### Limitations of Economic Sybil Resistance

- **Not a guarantee.** Well-funded actors can still manipulate polls by paying for votes. Economic friction raises the cost but does not eliminate the possibility.
- **No identity binding.** TOON does not verify voter identity -- only that each vote was paid for. One person with multiple funded keypairs can still vote multiple times.
- **Client-side deduplication only.** Relays accept all valid, paid kind:1018 events. Deduplication by pubkey is performed by clients during result aggregation.

## Economic Dynamics of Polling on TOON

### Poll Creation as Investment

Creating a poll on TOON costs ~$0.003-$0.006. This is inexpensive but not free. The economic friction filters out:
- Engagement-bait polls designed solely to generate interactions
- Duplicate polls on the same topic
- Frivolous questions that waste voters' money

When someone creates a poll on TOON, they are investing in the question and implicitly asking others to invest in the answer.

### Vote Cost as Participation Threshold

Each vote costs ~$0.002-$0.003. This creates a natural participation threshold:
- Voters who are indifferent will not bother paying to vote
- Voters who care enough will pay the small fee to express their preference
- The result is a higher-quality signal of genuine sentiment compared to free polls where casual clicks inflate results

### Timed Polls and Urgency Economics

Polls with `endsAt` tags create time-bounded economic signals:
- The total investment in a poll is determined by both the number of voters and the time window
- Shorter windows concentrate investment, creating a more decisive result
- Longer windows allow broader participation but may dilute urgency
- The cost per vote remains constant regardless of timing

### Poll Results as Weighted Signals

On TOON, poll results carry more weight than on free platforms because:
- Every vote represents a paid decision, not a casual click
- The cost prevents mass-voting by disengaged participants
- The collective investment in a poll's outcome creates accountability
- Results can be compared across polls by total economic investment, not just vote count

## Integration with Protocol Core

For the complete TOON write model, read model, and fee calculation details, refer to `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`. This file covers poll-specific extensions; the protocol core covers the foundational mechanics shared by all event kinds.
