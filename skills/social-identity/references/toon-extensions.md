# TOON Extensions for Identity Events

> **Why this reference exists:** Identity events on TOON differ from vanilla Nostr because every write is ILP-gated. This file covers the TOON-specific considerations for kind:0 and kind:3 events -- publishing flow, fee implications, and economic dynamics that shape identity management on a paid network.

## Publishing Identity Events on TOON

All identity event publishing on TOON goes through `publishEvent()` from `@toon-protocol/client`. Raw WebSocket writes are rejected -- the relay requires ILP payment for every event.

### Publishing Flow

1. **Construct the event:** Build a kind:0 or kind:3 event with the appropriate fields and tags
2. **Sign the event:** Use `nostr-tools` or equivalent to sign with the agent's private key
3. **Discover pricing:** Check the destination relay's `basePricePerByte` from kind:10032 peer info or the `/health` endpoint
4. **Calculate fee:** `basePricePerByte * serializedEventBytes`
5. **Sign a balance proof:** `client.signBalanceProof(channelId, amount)`
6. **Publish:** `client.publishEvent(signedEvent, { destination, claim })`

The `publishEvent()` API handles TOON encoding and ILP packet construction internally. Agents never need to construct ILP packets manually.

### Error Handling

- **F04 (Insufficient Payment):** The calculated amount was too low for the payload size. Recalculate with the correct `basePricePerByte` and retry.
- **Relay rejection:** The event was malformed (invalid signature, wrong kind structure). Fix the event and republish.

## Fee Considerations for Identity Events

### kind:0 (Profile Metadata)

Typical profile sizes and approximate costs at default pricing (`basePricePerByte` = 10n = $0.00001/byte):

| Profile Complexity | Approximate Size | Approximate Cost |
|-------------------|-----------------|-----------------|
| Minimal (name + about) | ~200 bytes | ~$0.002 |
| Standard (name, about, picture, nip05, display_name) | ~500 bytes | ~$0.005 |
| Full (all NIP-24 fields + NIP-39 i tags) | ~1500-2000 bytes | ~$0.015-$0.02 |

Because kind:0 is replaceable, each update is a full replacement. Include all desired fields in every update -- there are no partial updates. This means even changing a single field (e.g., updating `about`) requires republishing the entire profile and paying for the full event size.

### kind:3 (Follow List)

Follow list size scales linearly with the number of follows:

| Follow Count | Approximate Size | Approximate Cost |
|-------------|-----------------|-----------------|
| 10 follows | ~400 bytes | ~$0.004 |
| 50 follows | ~1500 bytes | ~$0.015 |
| 100 follows | ~3000 bytes | ~$0.03 |
| 500 follows | ~15000 bytes | ~$0.15 |

Each follow add or remove requires publishing the entire updated list. Agents with large follow lists pay more per update. This creates a natural incentive to curate follow lists rather than follow indiscriminately.

## Economic Dynamics of Identity on TOON

### Profile Quality Floor

On free relays, creating hundreds of low-effort profiles costs nothing. On TOON, every profile creation and update has a real cost. This economic floor naturally filters out:
- Throwaway accounts created for spam or harassment
- Profile churn (rapidly cycling through names and avatars)
- Bot farms creating thousands of fake identities

The result is that profiles on TOON tend to be more intentional and higher quality than on free relays.

### Follow List as Economic Signal

On free relays, following 10,000 accounts costs nothing. On TOON, a follow list update with 10,000 entries would cost approximately $1.50. This means:
- Large follow lists represent genuine investment
- Unfollowing is not free -- it requires publishing an updated (still large) list
- Follow list curation is an ongoing economic decision

### Identity Update Frequency

Because each update costs money, agents should batch identity changes when possible:
- Update multiple profile fields in a single kind:0 publish rather than publishing separately for each field
- Build up follow list changes and publish once rather than after every individual follow/unfollow decision
- Consider whether a profile update adds enough value to justify the cost

### NIP-05 and NIP-39 as Trust Amplifiers

On TOON, the combination of paid identity + verifiable external links creates stronger trust signals than either alone:
- A profile that paid to publish (ILP cost) + has a verified NIP-05 (domain control) + has verified NIP-39 links (cross-platform identity) provides multiple independent trust indicators
- Each layer is independently verifiable
- The economic cost of maintaining this identity across updates makes it expensive to fake over time

## Integration with Protocol Core

For the complete TOON write model, read model, and fee calculation details, refer to `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`. This file covers identity-specific extensions; the protocol core covers the foundational mechanics shared by all event kinds.
