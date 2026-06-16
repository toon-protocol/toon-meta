# TOON Extensions for Git Identity

> **Why this reference exists:** Git identity on TOON has unique economic properties -- identity verification is free (reading events costs nothing), but identity-related writes (updating maintainer lists, publishing status events) cost per-byte via ILP payment. This file covers the cost model for identity operations, the asymmetry between free reads and paid writes, and how TOON's pay-to-write model affects authorization behavior.

## Identity Verification Costs Nothing

On TOON, reading events is free. All identity verification operations are read-only:

| Operation | Method | Cost |
|-----------|--------|------|
| Check maintainer status | Read kind:30617, inspect `maintainers` tag | Free |
| Verify event authorship | Check `pubkey` field and Schnorr `sig` | Free (local crypto) |
| Resolve display name | Read kind:0 profile metadata | Free |
| Check NIP-05 verification | Read kind:0 `nip05` field, fetch well-known URL | Free (relay read + HTTP GET) |
| Validate status event chain | Read kind:1630-1633 events, filter by authorization | Free |
| Identify fork vs original | Read kind:30617, check for `personal-fork` tag | Free |

This means any agent can verify permissions, resolve identities, and validate status chains without spending ILP payment. The economic barrier exists only for writing.

## Identity-Related Write Costs

All writes go through `publishEvent()` from `@toon-protocol/client`. Cost formula: `basePricePerByte * serializedEventBytes`.

### Maintainer List Updates

Updating the maintainer list requires republishing the entire kind:30617 repository announcement:

| Component | Typical Size | Notes |
|-----------|-------------|-------|
| Event envelope (kind, pubkey, sig, etc.) | ~200 bytes | Fixed overhead |
| `d` tag | ~20-50 bytes | Repository identifier |
| `name` tag | ~20-60 bytes | Display name |
| `description` tag | ~50-500 bytes | Repository description |
| `clone` tags | ~50-200 bytes each | Git clone URLs |
| `web` tags | ~30-100 bytes each | Web browsing URLs |
| `relays` tag | ~50-200 bytes | Preferred relays |
| `maintainers` tag | ~70 bytes per maintainer | 64-char hex pubkey + tag overhead |
| `t` tags | ~15-30 bytes each | Topic tags |

**Typical total:** 500-2000 bytes, costing ~$0.005-$0.02 at default pricing.

**Cost scaling with maintainer count:**
- 1 maintainer: ~70 bytes for the tag
- 5 maintainers: ~350 bytes for the tag
- 10 maintainers: ~700 bytes for the tag
- Each additional maintainer adds ~70 bytes (~$0.0007)

Adding or removing a single maintainer costs the same as republishing the full announcement. There is no incremental update -- the entire event is replaced.

### Status Event Costs

Status events (kind:1630-1633) are the cheapest identity-related writes because they have minimal content:

| Status Event | Typical Size | Typical Cost |
|-------------|-------------|--------------|
| kind:1630 (open) | 200-300 bytes | ~$0.002-$0.003 |
| kind:1631 (merged) | 250-400 bytes | ~$0.003-$0.004 |
| kind:1632 (closed) | 200-300 bytes | ~$0.002-$0.003 |
| kind:1633 (draft) | 200-300 bytes | ~$0.002-$0.003 |

Merge events (kind:1631) can be slightly larger due to optional `applied-as-commits` tags that credit the contributor.

### Contribution Events (Permissionless)

Events that anyone can publish, regardless of identity:

| Event | Typical Size | Typical Cost |
|-------|-------------|--------------|
| kind:1617 (patch) | 1KB-50KB+ | ~$0.01-$0.50+ |
| kind:1618 (pull request) | 500-2000 bytes | ~$0.005-$0.02 |
| kind:1621 (issue) | 300-2000 bytes | ~$0.003-$0.02 |
| kind:1622 (comment) | 200-1000 bytes | ~$0.002-$0.01 |

For detailed fee calculation, read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`.

## Economic Implications of Pubkey-Only Identity

### No Registration Cost

Creating a Nostr identity is free -- generate a keypair locally. There is no account creation event to publish. The first time a pubkey appears on a TOON relay is when it publishes its first event (which costs per-byte for the event content, not for "registration").

### Sybil Resistance Through Payment

On TOON, every write costs money. This provides natural sybil resistance:

- **Spam patches** cost per-byte. A 10KB spam patch costs ~$0.10 -- expensive for spammers, trivial for legitimate contributors.
- **Status wars** (repeatedly re-opening/closing items) cost per event. Each unauthorized status event wastes ~$0.002-$0.004 of the attacker's money, and clients should ignore it anyway.
- **Fake maintainer events** (non-maintainers publishing kind:1631) cost money and are ignored by well-behaved clients. The attacker pays but gains nothing.

### Identity Trust Signals on a Paid Network

On TOON, the cost of publishing creates implicit trust signals:

| Signal | Interpretation |
|--------|---------------|
| Pubkey has published multiple quality patches | Invested real money in contributions |
| Pubkey has a kind:0 profile with NIP-05 | Invested in identity establishment |
| Pubkey is listed in `maintainers` tag | Explicitly trusted by the repository creator |
| Pubkey has published many low-quality events | Wasted money -- still untrusted |

### Authorization Enforcement is Client-Side

The TOON relay does NOT enforce NIP-34 authorization rules. The relay's only gate is ILP payment -- if the event is validly signed and the payment clears, the relay stores it. Authorization enforcement responsibilities:

| Layer | Responsibility |
|-------|---------------|
| **Relay** | Validates event signature, requires ILP payment. Does NOT check maintainer status. |
| **Client** | Must verify that status events come from authorized pubkeys before displaying them. |
| **Agent** | Should check maintainer status before publishing status events to avoid wasting ILP payment. |

This means:
- A non-maintainer CAN publish a kind:1631 (merge) event on a TOON relay -- it will be accepted and stored.
- The non-maintainer PAYS for the event (wasted money).
- Well-behaved clients IGNORE the unauthorized merge event.
- The authorization check is the client's responsibility.

## Maintainer Update Patterns on TOON

### Adding a Maintainer

1. Fetch current kind:30617 (free read).
2. Construct updated event with new pubkey in `maintainers` tag.
3. Publish via `publishEvent()` (~$0.005-$0.02).
4. Old event is replaced (parameterized replaceable).

### Removing a Maintainer

Same cost as adding -- the full event is republished. There is no "diff" or "patch" mechanism for parameterized replaceable events.

### Bulk Maintainer Changes

If adding/removing multiple maintainers, do it in a single republish to avoid paying multiple times. Each republish replaces the previous, so only the final version matters.

### Emergency Maintainer Removal

If a maintainer's key is compromised, the repository creator should immediately republish kind:30617 without the compromised pubkey. The cost (~$0.005-$0.02) is trivial compared to the risk. The removal is instant -- the new event replaces the old one on the relay.

## Git Author Mapping and TOON Format

When reading events from a TOON relay to resolve pubkey-to-author mappings, remember that TOON relays return TOON-format strings in EVENT messages, not standard JSON objects. Use the TOON decoder to parse kind:0 profile events before extracting `name` or `display_name` fields.

For TOON format parsing details, read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`.
