# TOON Extensions for List and Label Events

> **Why this reference exists:** Lists and labels on TOON differ from vanilla Nostr because every list update and label publish is ILP-gated. This file covers TOON-specific considerations for NIP-51 list events and NIP-32 label events -- publishing flow, fee implications, the replaceable event cost trap, and economic dynamics that make curation a cost-conscious activity.

## Publishing Lists and Labels on TOON

All list and label publishing on TOON goes through `publishEvent()` from `@toon-protocol/client`. Raw WebSocket writes are rejected -- the relay requires ILP payment for every event.

### Publishing Flow

1. **Construct the event:** Build the list or label event with appropriate kind, tags, and content
2. **Encrypt private entries (lists only):** Use NIP-44 to encrypt private tag entries into the `.content` field using your own key pair
3. **Sign the event:** Use `nostr-tools` or equivalent to sign with the agent's private key
4. **Discover pricing:** Check the destination relay's `basePricePerByte` from kind:10032 peer info or the `/health` endpoint
5. **Calculate fee:** `basePricePerByte * serializedEventBytes`
6. **Publish:** `client.publishEvent(signedEvent)` -- the client handles balance proof signing and ILP packet construction internally

The `publishEvent()` API handles TOON encoding and ILP packet construction internally. Agents never need to construct ILP packets manually.

### Error Handling

- **F04 (Insufficient Payment):** The calculated amount was too low for the payload size. Recalculate with the correct `basePricePerByte` and retry.
- **Relay rejection:** The event was malformed (invalid signature, wrong kind structure, missing required tags). Fix the event and republish.

## Fee Considerations for List Events

### The Replaceable Event Cost Trap

Replaceable lists (kind:10000, 10001) and parameterized replaceable lists (kind:30000, 30003) must republish the ENTIRE list on every update. Unlike regular events where you publish only new content, list updates require sending every existing entry plus the change.

**Cost scaling example for a mute list (kind:10000):**

| List Size | Approximate Bytes | Cost Per Update | Annual Cost (1 update/day) |
|-----------|------------------|----------------|---------------------------|
| 10 entries | ~800 bytes | ~$0.008 | ~$2.92 |
| 50 entries | ~3,500 bytes | ~$0.035 | ~$12.78 |
| 100 entries | ~7,000 bytes | ~$0.07 | ~$25.55 |
| 200 entries | ~14,000 bytes | ~$0.14 | ~$51.10 |
| 500 entries | ~35,000 bytes | ~$0.35 | ~$127.75 |

**Mitigation strategies:**
- Batch multiple changes into a single update rather than publishing after each addition/removal
- Periodically audit lists and remove stale entries to keep size manageable
- Use private entries (encrypted in `.content`) only when confidentiality is needed -- encryption adds overhead bytes
- Consider whether a list needs frequent updates or can be updated weekly/monthly

### kind:10000 (Mute List) Fee Profile

The mute list is the most cost-sensitive list kind because it is updated most frequently (every time a user encounters someone to mute).

| Scenario | Approximate Size | Cost |
|----------|-----------------|------|
| First mute (1 pubkey) | ~200 bytes | ~$0.002 |
| 10 muted pubkeys | ~800 bytes | ~$0.008 |
| 20 muted pubkeys + 5 words | ~1,800 bytes | ~$0.018 |
| 50 muted pubkeys + 10 words + 5 hashtags | ~4,500 bytes | ~$0.045 |

### kind:10001 (Pin List) Fee Profile

Pin lists are typically small (users pin a handful of notes) and updated infrequently.

| Scenario | Approximate Size | Cost |
|----------|-----------------|------|
| 3 pinned notes | ~300 bytes | ~$0.003 |
| 10 pinned notes | ~500 bytes | ~$0.005 |

### kind:30000 (Follow Sets) Fee Profile

Follow sets vary widely based on category size. A "close friends" set might have 10 entries; a "developers" set could have hundreds.

| Scenario | Approximate Size | Cost |
|----------|-----------------|------|
| Small category (5 people) | ~500 bytes | ~$0.005 |
| Medium category (20 people) | ~1,600 bytes | ~$0.016 |
| Large category (100 people) | ~7,500 bytes | ~$0.075 |

### kind:30003 (Bookmark Sets) Fee Profile

Bookmark sets can grow large as users accumulate references over time.

| Scenario | Approximate Size | Cost |
|----------|-----------------|------|
| Small collection (5 bookmarks) | ~600 bytes | ~$0.006 |
| Medium collection (20 bookmarks) | ~2,000 bytes | ~$0.02 |
| Large collection (50 bookmarks) | ~5,000 bytes | ~$0.05 |

### Secondary Lists Fee Profile

Most secondary lists (kind:10003-10030) are small metadata lists with infrequent updates.

| Kind | Typical Size | Typical Cost |
|------|-------------|-------------|
| 10003 (Bookmarks) | 200-1,000 bytes | $0.002-$0.01 |
| 10004 (Communities) | 200-800 bytes | $0.002-$0.008 |
| 10005 (Public Chats) | 200-600 bytes | $0.002-$0.006 |
| 10006 (Blocked Relays) | 150-500 bytes | $0.0015-$0.005 |
| 10007 (Search Relays) | 150-400 bytes | $0.0015-$0.004 |
| 10009 (User Groups) | 200-800 bytes | $0.002-$0.008 |
| 10015 (Interests) | 200-600 bytes | $0.002-$0.006 |
| 10030 (Emoji) | 200-1,000 bytes | $0.002-$0.01 |
| 30002 (Relay Sets) | 200-2,000 bytes | $0.002-$0.02 |

## Fee Considerations for Label Events

### kind:1985 (Labels)

Labels are the most cost-effective curation mechanism on TOON. Each label is a small, regular (non-replaceable) event. Unlike lists, labels do not grow over time -- each label is independent.

| Label Complexity | Approximate Size | Cost |
|-----------------|-----------------|------|
| Single label, single target | ~200 bytes | ~$0.002 |
| Multi-namespace, single target | ~300 bytes | ~$0.003 |
| Single label, multiple targets | ~350 bytes | ~$0.004 |

Labels are cheap enough that cost should rarely be a barrier to labeling content that genuinely benefits from structured metadata.

## TOON Read Model for Lists and Labels

Reading lists and labels is free on TOON. Subscribe using NIP-01 filters.

### Reading List Events

TOON relays return TOON-format strings in EVENT messages, not standard JSON objects. Use the TOON decoder to parse the event structure.

For list events with private entries:
1. Decode the TOON-format response using the TOON decoder
2. Parse the `.tags` array for public entries
3. Decrypt the `.content` field using NIP-44 with the list owner's key pair
4. Parse the decrypted content as a JSON array of tag arrays
5. Merge public and private entries for the complete list

### Reading Label Events

Labels have no encrypted content, so reading is simpler:
1. Subscribe with appropriate filters (by target event, namespace, or author)
2. Decode the TOON-format response
3. Extract `L` tags for namespaces and `l` tags for label values

## ILP Considerations

### List Updates and Channel Balance

Frequent list updates consume channel balance faster than occasional publishes. An agent maintaining active mute and bookmark lists should:
- Monitor channel balance and top up before it runs low
- Batch list changes when possible to reduce the number of ILP payments
- Be aware that large lists (>100 entries) can cost $0.07+ per update

### Label Publishing and Routing

Label events are small and route efficiently through the ILP network. The per-label cost is comparable to a reaction (kind:7), making labels one of the cheapest write operations. Multi-hop routing adds minimal overhead for such small payloads.

## Integration with Protocol Core

For the complete TOON write model, read model, and fee calculation details, refer to `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`. This file covers list/label-specific extensions; the protocol core covers the foundational mechanics shared by all event kinds.
