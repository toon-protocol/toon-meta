# TOON Extensions for Git Identity

> **Why this reference exists:** Git identity on TOON has unique economic properties -- identity verification is free (reading events costs nothing), but identity-related writes (updating maintainer lists, publishing status events) are paid via ILP. This file covers the price model for identity operations, the asymmetry between free reads and paid writes, and how TOON's pay-to-write model affects authorization behavior.

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

This means any agent can verify permissions, resolve identities, and validate status chains without spending ILP payment, and without a channel or a connector -- reads speak plain NIP-01. The gate exists only on writing.

## Identity-Related Write Prices

All writes go through `client.send({ body: signedEvent })` from `@toon-protocol/client`. The client seals the payload, reads the route's price, mints the covering claim and carries it -- a caller never prices the packet or signs a claim by hand.

Identity events are Nostr events, so they terminate at the relay. The `g.toon.relay` route is **flat-priced: 1 base unit of 6-decimal USDC per event**, whatever the event contains. There is no arithmetic to do, and no way to make an identity write cheaper by making it smaller.

Where a skill genuinely needs the price in advance, `await client.routePrice(destination)` returns `{ price, pricePerKib? }`, then `chargeFor(terms, sealedBytes)` from `@toon-protocol/client` computes the charge. The metered quantity is the **sealed** payload the PREPARE carries, so a charge cannot be computed from the event JSON you wrote.

### Maintainer List Updates

Updating the maintainer list requires republishing the entire kind:30617 repository announcement. Adding or removing a single maintainer therefore replaces the whole event -- there is no incremental update.

This used to matter economically. It no longer does: on a flat-priced route, a one-maintainer announcement and a fifty-maintainer announcement cost the same 1 base unit. Republishing is a correctness question (copy every existing tag forward), not a cost question.

### Status Event Prices

Status events (kind:1630-1633) cost the same 1 base unit as every other relay write. A kind:1631 merge event carrying optional `applied-as-commits` tags is larger than a bare kind:1632 close, and costs exactly the same.

### Contribution Events (Permissionless)

kind:1617 patches, kind:1618 pull requests, kind:1621 issues and kind:1622 comments are all relay writes at 1 base unit each. A 50 KB patch and a 200-byte comment are priced identically.

The exception is a git object pushed as a blob: those go to the **store** route (`g.toon.store` / `g.toon.relay.store`), which is priced `1000 + 10 per KiB` of sealed payload. Size matters there and only there.

For route pricing details, read `skills/nostr-protocol-core/references/toon-protocol-context.md`.

## Economic Implications of Pubkey-Only Identity

### No Registration Cost

Creating a Nostr identity is free -- generate a keypair locally. There is no account creation event to publish. The first time a pubkey appears on a TOON relay is when it publishes its first event (which is priced as an ordinary relay write, not as a "registration").

### Payment Is a Gate, Not a Deterrent

A relay write costs 1 base unit of 6-decimal USDC. That is far too small to price anyone out of anything, so do not reason about it as a spam deterrent. What it actually provides is a gate: every write requires an open, funded payment channel and a signed claim, so there is no anonymous free write and every event is attached to a channel someone had to fund.

- **Spam patches** cost 1 base unit each, the same as a legitimate patch. An attacker is not priced out; they are merely obliged to have a channel.
- **Status wars** (repeatedly re-opening/closing items) cost one write per event, and clients should ignore unauthorized ones anyway.
- **Fake maintainer events** (non-maintainers publishing kind:1631) still require a funded channel and are ignored by well-behaved clients. The attacker pays but gains nothing.

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
3. Sign it and `await client.send({ body: updatedAnnouncement })` (1 base unit).
4. Old event is replaced (parameterized replaceable).

### Removing a Maintainer

Same price as adding -- the full event is republished. There is no "diff" or "patch" mechanism for parameterized replaceable events.

### Bulk Maintainer Changes

If adding/removing multiple maintainers, do it in a single republish rather than one write per change -- the price is per event, so batching is what saves money. Each republish replaces the previous, so only the final version matters.

### Emergency Maintainer Removal

If a maintainer's key is compromised, the repository creator should immediately republish kind:30617 without the compromised pubkey. One base unit is trivial compared to the risk. The removal is instant -- the new event replaces the old one on the relay.

## Git Author Mapping and the Read Path

Resolving pubkey-to-author mappings is an ordinary NIP-01 read. The relay returns standard JSON `EVENT` messages, so parse a kind:0 profile event the way any Nostr client would before extracting `name` or `display_name`. There is no decoder step and no connector in the path.

TOON format is the encoding of the sealed *write* payload, not of anything a relay serves on a read. For that distinction in full, read `skills/nostr-protocol-core/references/toon-protocol-context.md`.
