# TOON Extensions for Relay Groups

> **Why this reference exists:** NIP-29 relay-based groups have to be *paid for*
> when the hosting relay sits behind a TOON connector. This file covers how a
> group event is published, what it costs, where a refusal comes from, and the
> social consequences of a paid write. It corrects an older model this document
> used to describe -- per-byte pricing, `publishEvent()`, `kind:10032` discovery
> and an `F04` code -- none of which exist.

> **Status on the TOON fleet.** The fleet's relay serves plain **NIP-01** reads
> (plus NIP-09, NIP-40, NIP-34). It does **not** implement NIP-29 group
> enforcement. Read this as how a NIP-29 relay *would* be paid for behind a
> connector, not as a description of `g.toon.relay`'s behaviour.

## Two layers, neither aware of the other

A TOON relay sits behind a **connector**: a paid reverse proxy that charges for a
route and hands the app a request that was already paid for. The connector
**never parses the payload** -- no TOON parse, no signature check, no event-kind
dispatch anywhere on the packet path, because payload opacity is a property of
carriage (connector ADR 0016/0018).

The consequence for groups is sharp:

- The **connector** can refuse you for money reasons (`F03` underpayment, `T04`
  over the cap, `F02` no such route). It has never seen your `h` tag.
- The **relay app** can refuse you for group reasons (not a member, missing
  permission, wrong host relay). It has never seen your claim.

Paying correctly and being a group member are independent.

## Publishing Group Events on TOON

```ts
import { ToonClient, chargeFor } from '@toon-protocol/client';

const client = await ToonClient.create({
  connector: 'https://proxy.relay.devnet.toonprotocol.dev',
  mnemonic: process.env.TOON_MNEMONIC,
});
await client.channel.open({ deposit: 100_000n });

const answer = await client.send({ body: signedGroupEvent });
if (!answer.fulfilled) { /* inspect; never retry blindly */ }
```

`send()` seals the request, prices it, mints the claim and carries it. The
destination is optional and defaults to the node's own published address; pass
one explicitly to target a specific route.

**`publishEvent()` and a caller-facing `signBalanceProof()` do not exist.** A
caller never signs a claim by hand and never builds an ILP packet. A REJECT is
returned as `{ fulfilled: false }`, never thrown.

### Flow for group messages

1. **Construct the event:** a kind:9 (chat) or kind:11 (thread) event with the
   `h` tag set to the group ID.
2. **Include required tags:** `["h", "<group-id>"]` is mandatory. For kind:11
   replies, add `e` tags for threading.
3. **Sign the event** with the agent's Nostr key (nostr-tools or equivalent).
4. **Point the client at the node fronting the hosting relay.** A group event
   sent to a different relay is refused even when the payment is valid.
5. **`client.send({ body: signedEvent })`.** That is the whole publish step.

### Flow for admin actions

Admin events (kind:9000-9009) publish identically. The relay validates the admin
permission *after* the connector has already been paid -- so a permission failure
costs you the write.

1. Construct the admin event: the appropriate kind (9000-9009), the `h` tag, and
   the action-specific tags (e.g. a `p` tag for add/remove user).
2. `client.send({ body: signedAdminEvent })`.
3. The relay checks the permission and either applies the action and updates the
   group-state events, or refuses.

## What a write costs

A **price** belongs to a *terminated route* and is a **schedule over payload
length**:

```
charge = price + pricePerKib * ceil(sealedBytes / 1024)
```

Flat exactly when it has no slope. **Never say "per-byte"** -- the unit is a
**kibibyte**. Prices are in the settlement token's smallest unit; USDC is
6-decimal, so `1_000_000` = $1.

A **fee** is a different thing: flat, per packet, attached to a **peering**, not
to a route (ADR 0061). **Cost** is every hop's fee plus the terminating charge,
discovered from a probe's reject. **Cap** is the most one packet may carry to one
peer.

Live prices, probed 2026-08-28 (base units of 6-dp USDC):

| Destination | Price |
| --- | --- |
| `g.toon.relay` | **1**, flat |
| `g.toon.store`, `g.toon.relay.store` | **`price = 1000, pricePerKib = 10`** |
| `g.toon.gas` | **1000** |

At `g.toon.relay`'s flat 1, a kind:9 chat message and a 50 KB kind:9002 metadata
edit cost the same single base unit. There is no size-based table to reproduce,
which is why the per-kind byte/dollar tables this file used to carry are gone.

### Ask, do not multiply

The metered quantity is the **sealed** payload -- the gift-wrapped bytes the
PREPARE carries -- **not** the event JSON, which is smaller by the request
envelope and the wrap. An agent therefore *cannot* correctly compute a charge
from the event it wrote.

```ts
const terms = await client.routePrice(destination); // { price, pricePerKib? }
const charge = chargeFor(terms, sealedBytes);
```

`chargeFor` is the only thing that should decide what goes on a claim.

### Discovery: a connector answers, it never announces

`GET /ilp` on a node's URL returns its **self-description**: its addresses, its
settlement facts (chain, token, decimals) and **every route's price**. Free,
unauthenticated, and the only thing a stranger needs (connector ADR 0050). An
unpaid request to a priced route is answered with a **greeting** carrying that
route's terms -- the word is *greeting*, never "402" or "x402".

**Removed, never mention as live:** `kind:10032` peer info / `IlpPeerInfo`, a
`/health` price endpoint, `basePricePerByte`, `feePerByte`, and `kind:10035`
`SkillDescriptor` pricing. ADR 0046 removed the announce; ADR 0061 and ADR 0065
replaced the money model.

## Error Handling

From the connector (money):

- **`F03` Invalid Amount** -- the claim did not cover the charge. This is
  **underpayment**. **There is no `F04`.** Re-read the route's terms with
  `routePrice()` and let `chargeFor()` size the claim.
- **`T04`** -- the packet exceeded the peering's **cap**. The message *states*
  the cap; that is the only way a sender learns it.
- **`F02`** -- nothing routes that name. **`T01`** -- the peer was not there.

From the relay app (group rules):

- **Membership** -- the sender is not a group member. Join first (post to an open
  group; use an invite or an admin add for a closed one).
- **Permissions** -- the sender lacks the required admin permission. Ask an admin
  with `add-permission`.
- **Wrong relay** -- the group is not hosted there. The event is refused however
  well it was paid for.

A relay-level refusal still consumed the write. Read the answer rather than
retrying.

## Paid Group Entry

A group behind a paid write has two gates, set by two different parties: the
**node operator** sets the route's price, and the **group admins** set who may
join. Neither can see the other's decision.

### Payment Channel Requirement

Every write through the connector needs an open payment channel, group join
attempts included. A new participant must:

1. Read the node's terms: `GET /ilp`, or `await client.describe()` /
   `await client.routePrice(destination)`.
2. Open a channel on the chain the node settles on:
   `await client.channel.open({ deposit: 100_000n })`.
3. Then attempt to join the group.

This is a **gate**, not a filter: it proves a funded channel and a live claim.
Whether it deters anyone depends entirely on the price the node publishes.

### Dual-Barrier Model

Closed groups on TOON can enforce two barriers simultaneously:

- **Social barrier:** Admin must add the user (kind:9000) or user must have an invite code (kind:9009)
- **Payment gate:** the user must have a funded channel with the node fronting the hosting relay

This dual-barrier creates high-trust environments where members have both community approval and economic commitment.

### Economic Dynamics

Be accurate about the size of the effect before reasoning from it.

- **Lurker advantage is real.** Reading is free and does not touch the pay path
  at all; contributing needs a funded channel. That asymmetry holds at any price.
- **The deterrent is whatever the node priced it at.** At `g.toon.relay`'s flat
  **1** base unit, a thousand messages costs a thousandth of a cent. Do not claim
  TOON's pricing sets a quality floor or resists spam; a node that wants that
  raises its price, and a flat route charges the same for a one-line message and
  a maximal one.
- **What paying actually proves** is that the sender holds a funded channel and
  signed a monotonic claim -- an identity-free, refundable-to-nobody commitment.
  That is a Sybil cost, not a thoughtfulness cost.
- **Admin weight comes from consequence, not price.** Removing a member or
  deleting an event writes state that is awkward to undo; that is the reason to
  be deliberate.

## Reading Group Events

Reads are free and bypass the pay path entirely -- they go to the relay's own
WebSocket port, not through the connector.

The fleet's relay speaks **plain NIP-01 JSON** on reads, so any Nostr client can
consume it; there is no decode step. (TOON encoding is an agreement between a
client and an app about *payload* bytes on the write side. It is not connector
law -- the connector carries those bytes sealed and never opens them.)

1. **Subscribe** with a NIP-01 `REQ`.
2. **Check the `h` tag** to identify which group an event belongs to.
3. **Read group state** (kind:39000, 39001, 39002) with `#d` filters for
   metadata, admin roles and membership.
4. **Track replaceable events:** group state events are replaceable -- newer
   versions supersede older ones. Always use the most recent.

## Integration with Protocol Core

For the complete TOON write model, read model, and pricing details, refer to
`skills/nostr-protocol-core/references/toon-protocol-context.md`. This file
covers group-specific extensions; the protocol core covers foundational mechanics
shared by all event kinds.

Protocol law itself lives in the connector, not in a skill:
[`docs/adr/`](https://github.com/toon-protocol/connector/tree/main/docs/adr) for
the decisions and
[`CONTEXT.md`](https://github.com/toon-protocol/connector/blob/main/CONTEXT.md)
for the vocabulary. The ten Interledger RFCs the connector implements are
vendored verbatim under
[`docs/rfcs/`](https://github.com/toon-protocol/connector/tree/main/docs/rfcs),
each beneath a TOON profile naming the departures.
