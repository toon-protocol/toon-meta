# TOON Extensions for Drafts and Expiration

> **Why this reference exists:** Draft events and expiration timestamps on TOON differ from vanilla Nostr because every write is ILP-gated. This file covers the TOON-specific considerations for kind:31234 draft events and the expiration tag -- publishing flow, fee implications, and economic dynamics that shape drafting and expiration on a paid network.

## Publishing Draft Events on TOON

All draft event publishing on TOON goes through `publishEvent()` from `@toon-protocol/client`. Raw WebSocket writes are rejected -- the relay requires ILP payment for every event.

### Publishing Flow

1. **Construct the event:** Build a kind:31234 event with `d` tag (draft identifier), `k` tag (target kind), content, and optional tags
2. **Encrypt the content (recommended):** Use NIP-44 self-encryption so only you can read the draft
3. **Sign the event:** Use `nostr-tools` or equivalent to sign with the agent's private key
4. **Discover pricing:** Check the destination relay's `basePricePerByte` from kind:10032 peer info or the `/health` endpoint
5. **Calculate fee:** `basePricePerByte * serializedEventBytes`
6. **Sign a balance proof:** `client.signBalanceProof(channelId, amount)`
7. **Publish:** `client.publishEvent(signedEvent, { destination, claim })`

The `publishEvent()` API handles TOON encoding and ILP packet construction internally. Agents never need to construct ILP packets manually.

### Error Handling

- **F04 (Insufficient Payment):** The calculated amount was too low for the payload size. Recalculate with the correct `basePricePerByte` and retry.
- **Relay rejection:** The event was malformed (invalid signature, wrong kind structure). Fix the event and republish.

## Fee Considerations for Draft Events

### kind:31234 (Draft Event)

Typical draft sizes and approximate costs at default pricing (`basePricePerByte` = 10n = $0.00001/byte):

| Draft Type | Approximate Size | Approximate Cost |
|------------|-----------------|-----------------|
| Short note draft (kind:1 target) | ~200-400 bytes | ~$0.002-$0.004 |
| Article draft, short (kind:30023 target) | ~500-1000 bytes | ~$0.005-$0.010 |
| Article draft, medium (kind:30023 target) | ~1000-3000 bytes | ~$0.010-$0.030 |
| Article draft, long (kind:30023 target) | ~3000-10000 bytes | ~$0.030-$0.100 |
| Encrypted draft (NIP-44 overhead) | +~50-100 bytes | +~$0.0005-$0.001 |

### Expiration Tag Overhead

The expiration tag adds minimal cost to any event:

| Component | Size | Cost |
|-----------|------|------|
| `["expiration", "<timestamp>"]` | ~25-30 bytes | ~$0.00025-$0.0003 |

This is negligible compared to any event's base size. Adding expiration to a 300-byte event increases cost by less than 10%.

### Draft Deletion (kind:5)

After publishing the final event from a draft, the draft should be deleted:

| Operation | Size | Cost |
|-----------|------|------|
| kind:5 deletion targeting draft `a` coordinate | ~150-250 bytes | ~$0.0015-$0.0025 |

## Economic Dynamics of Drafts on TOON

### Drafting Cost vs Publishing Cost

The full draft-to-publish workflow on TOON involves multiple paid operations:

| Workflow Step | Typical Cost | Notes |
|--------------|-------------|-------|
| Save draft (1-3 iterations) | $0.005-$0.030 each | Parameterized replaceable -- only latest stored |
| Publish final event | $0.003-$0.200 | Depends on target kind and content length |
| Delete draft | $0.001-$0.003 | kind:5 cleanup |
| **Total (simple note)** | **~$0.008-$0.015** | 1 draft save + publish + delete |
| **Total (article, 3 saves)** | **~$0.045-$0.250** | 3 draft saves + publish + delete |

### Compose Locally, Save Checkpoints

The TOON economic model strongly favors local composition with relay saves at meaningful checkpoints:

| Pattern | Draft Saves | Cost of Drafting |
|---------|-------------|-----------------|
| Auto-save every keystroke (anti-pattern) | ~100+ saves | ~$0.50-$1.00+ |
| Save every paragraph | ~10-20 saves | ~$0.05-$0.20 |
| Save at major checkpoints | ~2-5 saves | ~$0.01-$0.05 |
| Compose locally, save once | 1 save | ~$0.005-$0.020 |

The optimal pattern: compose in a local editor, save to the relay when you want cross-device access or backup, and publish when ready.

### Encryption Overhead is Minimal

NIP-44 encryption adds approximately 50-100 bytes of overhead (nonce, MAC, padding). On a 1000-byte draft, this is 5-10% cost increase -- well worth the privacy:

| Draft | Unencrypted | Encrypted | Overhead |
|-------|-------------|-----------|----------|
| 200-byte note draft | $0.002 | $0.0025 | +$0.0005 |
| 1000-byte article draft | $0.010 | $0.011 | +$0.001 |
| 5000-byte article draft | $0.050 | $0.051 | +$0.001 |

The privacy benefit of encryption far outweighs the marginal cost increase.

### Parameterized Replaceable Saves Money

kind:31234 is parameterized replaceable, meaning each draft save with the same `d` tag replaces the previous version:
- You pay per save, but the relay only stores the latest version
- No growing storage cost over iterations
- Each save is independent -- if a save fails, the previous version is still intact

### Expiration Eliminates Cleanup Costs

Using the expiration tag eliminates the need for separate deletion events:

| Pattern | Events Published | Total Cost |
|---------|-----------------|------------|
| Publish + delete later (kind:5) | 2 events | event + ~$0.002 |
| Publish with expiration | 1 event | event + ~$0.0003 |
| **Savings** | 1 fewer event | **~$0.0017** |

For agents that frequently publish temporary content, expiration saves approximately $0.002 per event compared to manual deletion.

### Expiration Saves Relay Storage

On TOON, relay storage is a real cost. Expired events are automatically purged, which:
- Reduces the relay's storage burden
- Aligns author intent (temporary content) with relay economics
- Is considered good network citizenship
- May factor into future relay pricing decisions (relays could offer discounts for expiring content)

### Stale Drafts Waste Money

Drafts left on the relay after publishing the final event waste storage. Always clean up:
1. Publish the final event
2. Delete the draft with kind:5
3. Or set an expiration on the draft itself so it auto-cleans if you forget

Setting a generous expiration on drafts (e.g., 30 days) is a safety net against stale drafts:

```
["expiration", "<timestamp-30-days-from-now>"]
```

This costs only ~$0.0003 extra and prevents indefinite draft accumulation.

## Integration with Protocol Core

For the complete TOON write model, read model, and fee calculation details, refer to `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`. This file covers draft-and-expiration-specific extensions; the protocol core covers the foundational mechanics shared by all event kinds.
