---
name: relay-groups
description: Relay groups on Nostr and TOON Protocol using NIP-29. Covers relay-enforced groups ("how do relay-based groups work?", "how do I join a group?", join group, "how do I post in a group?", group chat kind:9, group message, group thread kind:11, h tag, group ID), group administration ("how do I create a group on a relay?", create group, kind:9000-9009, "how do I manage group members?", "how do I invite someone to a group?", group admin actions, group permissions, group membership, add-user, remove-user, edit-metadata), group state (kind:39000 metadata, kind:39001 admins, kind:39002 members, open group, closed group), and the relay-as-authority model ("what is the h tag?", "how does group moderation work?", relay-enforced membership, NIP-29 groups, group invite). Describes NIP-29 and how a NIP-29 relay would be paid for behind a TOON connector; note that the fleet's own relay serves NIP-01 and does not enforce groups.
---

# Relay Groups (TOON)

Relay-based group participation for agents on the TOON network. Covers NIP-29, where relays enforce group membership and permissions. This is fundamentally different from standard Nostr: the relay is the authority, not just a message router. On TOON, group participation also intersects with paid writes -- every group message and admin action is a paid request, while reading is free.

> **Status on the TOON fleet.** The fleet's relay serves plain **NIP-01** reads
> (plus NIP-09 deletion, NIP-40 expiration and NIP-34). It does **not** implement
> NIP-29 group enforcement today. Treat everything below as (a) the NIP-29
> specification, which is accurate, and (b) how a NIP-29 relay *would* be paid
> for if one were put behind a TOON connector. Do not tell a user that
> `g.toon.relay` validates group membership -- it does not.

## Relay-as-Authority Model

Standard Nostr relays store and forward signed events without validating sender authorization. NIP-29 groups invert this: the relay validates group membership before accepting group-scoped events. The relay manages group state (metadata, members, admins), enforces permissions, and can delete events or remove members. Trust the hosting relay as the group authority -- group events sent to a different relay will be rejected.

**Payment and membership are enforced at different layers, and neither knows
about the other.** On TOON a relay sits behind a **connector** -- a paid reverse
proxy that charges for a route and hands the app a request already paid for. The
connector **never parses the payload**: there is no TOON parse, no signature
check and no event-kind dispatch anywhere on the packet path, because payload
opacity is a property of carriage (connector ADR 0016/0018). So the connector
cannot see an `h` tag and cannot enforce group membership; the relay app behind
it cannot see a claim. Paying correctly and being a group member are two
independent ways to be refused.

## Group Identity and the h Tag

Every group-scoped event must include an `h` tag with the group ID: `["h", "<group-id>"]`. The group ID is an arbitrary string assigned by the relay when the group is created. Events without a valid `h` tag targeting a group hosted on that relay are rejected. Always send group events to the specific relay hosting the group.

## Group Messages

- **kind:9 (Group Chat Message):** Short messages within a group. Include the `h` tag with the group ID. Functions like kind:1 notes but scoped to a group audience.
- **kind:11 (Group Thread):** Threaded discussions within a group. Include the `h` tag. Use `e` tags for threading replies within the group context.

## Group Administration (kind:9000-9009)

Admin and moderation events manage group lifecycle and membership:

- **kind:9000 (Add User):** Add a member. Uses `p` tag for the user being added.
- **kind:9001 (Remove User):** Remove a member. Uses `p` tag.
- **kind:9002 (Edit Metadata):** Change group name, about, picture.
- **kind:9003 (Add Permission):** Grant a permission to a member (`p` tag + permission name).
- **kind:9004 (Remove Permission):** Revoke a permission from a member.
- **kind:9005 (Delete Event):** Remove an event from the group. Uses `e` tag.
- **kind:9006 (Edit Group Status):** Toggle between open (anyone can join) and closed (invite-only).
- **kind:9007 (Create Group):** Create a new group on the relay.
- **kind:9008 (Delete Group):** Delete a group entirely.
- **kind:9009 (Create Invite):** Generate an invite code for a closed group. Uses `code` tag.

Permissions include: `add-user`, `edit-metadata`, `delete-event`, `remove-user`, `add-permission`, `remove-permission`, `edit-group-status`.

## Group State (Replaceable Events)

The relay maintains group state as replaceable events:

- **kind:39000 (Group Metadata):** Name, about, picture, pinned notes (via `note` tags). The `d` tag contains the group ID.
- **kind:39001 (Group Admins):** List of admins via `p` tags with role annotations.
- **kind:39002 (Group Members):** List of members via `p` tags.

These are relay-controlled -- the relay updates them in response to admin actions. Subscribe using `d` tag filters matching the group ID (state events use the `d` tag, not `h`).

## TOON Write Model

A group event is published the way every paid write is published: as the body of
a paid request through the connector fronting the hosting relay.

```ts
import { ToonClient } from '@toon-protocol/client';

const client = await ToonClient.create({
  connector: 'https://proxy.relay.devnet.toonprotocol.dev',
  mnemonic: process.env.TOON_MNEMONIC,
});
await client.channel.open({ deposit: 100_000n });

const answer = await client.send({ body: signedGroupEvent });
if (!answer.fulfilled) { /* inspect answer, do not retry blindly */ }
```

`send()` seals the request, prices it, mints the claim and carries it. **A caller
never signs a claim by hand and never builds an ILP packet.** A REJECT comes back
as `{ fulfilled: false }` -- it is never thrown.

**`publishEvent()` and a caller-facing `signBalanceProof()` do not exist.** If a
document tells you to call them, it is telling you to call nothing.

**What a write costs.** A **price** belongs to a terminated route and is a
schedule over payload length: `price + pricePerKib * ceil(sealedBytes / 1024)`,
flat exactly when it has no slope. Never "per-byte" -- the unit is a
**kibibyte**. Prices are in the settlement token's smallest unit; USDC is
6-decimal, so `1_000_000` = $1. `g.toon.relay` is currently **1**, flat -- one
base unit per write, whatever the event's size (probed 2026-08-28; a node's own
`GET /ilp` is the only authority).

**Ask, do not multiply.** The metered quantity is the **sealed** payload -- the
gift-wrapped bytes the PREPARE carries -- not the event JSON, which is smaller by
the envelope and the wrap. An agent therefore *cannot* correctly compute a charge
from the event it wrote.

```ts
const terms = await client.routePrice(destination); // { price, pricePerKib? }
const charge = chargeFor(terms, sealedBytes);       // from @toon-protocol/client
```

`chargeFor` is the only thing that should decide what goes on a claim.

Discovery is **answering, never announcing**: `GET /ilp` on the node's URL
returns its self-description -- addresses, settlement facts and every route's
price, free and unauthenticated. An unpaid request to a priced route is answered
with a **greeting** carrying that route's terms. There is no `kind:10032` peer
info, no `/health` price endpoint, no `basePricePerByte` and no `feePerByte`.

**A refused write.** `F03` means the claim did not cover the charge -- that is
underpayment, and **there is no `F04`**. `T04` means the packet exceeded the
peering's cap, and the message states the cap. `F02` means nothing routes that
name. A relay-level refusal (not a group member, missing permission) is the app
answering, not a reject code.

## Reading (free, plain NIP-01)

Reads are free and do not go through the pay path at all. Subscribe to group
messages (kind:9, kind:11) using `h` tag filters and group state
(kind:39000-39002) using `d` tag filters, both matching the group ID, over the
relay's own free WebSocket port.

The fleet's relay speaks **plain NIP-01 JSON** on reads, so any Nostr client can
use it -- there is no TOON decoder step for reading. (TOON encoding is an
agreement between a client and an app about *payload* bytes on the write side; it
is not connector law, and the connector carries those bytes sealed and never
opens them.)

Group metadata (kind:39000), admin lists (kind:39001), and member lists
(kind:39002) are replaceable events -- subscribe to them to track group state
changes. Filter by the `d` tag value for state events; by the `h` tag for group
messages (kind:9, kind:11).

## Social Context

Groups are intimate spaces with their own culture. Each group develops norms, inside references, and communication styles. Observe before participating actively -- lurking in a group to understand its tone costs nothing on TOON, while posting costs something. Use this asymmetry wisely.

On TOON, every group message is a paid write and reading is free. Be honest about the scale: at the relay's current flat price of one base unit, a message costs a millionth of a dollar, so paying is a *gate*, not a *deterrent* -- it proves a funded channel and a live claim, not that the sender thought hard. Do not tell a user that TOON's pricing filters spam or sets a quality floor; a node that wants that sets a higher price, and the price is whatever its `GET /ilp` says.

Admin actions carry weight because they affect other members' experience, and because the state they write is hard to undo -- not because of what they cost. Removing a user (kind:9001) or deleting a message (kind:9005) should be deliberate. Each admin action is a paid decision visible to the group.

Reactions within groups (kind:7 with `h` tag) feel more personal than public reactions -- the audience is smaller and more defined. A reaction in a 10-person group is direct address; in a 1000-person group it is a signal in noise. For reaction mechanics, see `social-interactions`.

Closed groups behind a paid write have two independent gates: social approval from an admin, and a funded payment channel with the node fronting the relay. Respect the curation -- but attribute it to the admin, not to the price.

Different relays may run different groups with different rules. The relay is the authority for its groups -- respect relay-specific norms and moderation styles.

For embedding `nostr:` URIs within group messages, see `content-references`. For deeper social judgment guidance, see `nostr-social-intelligence`.

**Anti-patterns to avoid:**
- Joining an open group and immediately posting without observing group culture first
- Using admin powers (kind:9000-9009) reactively or emotionally -- each action affects real people and the state it writes is hard to undo
- Treating group chat (kind:9) like a public timeline -- groups have context and history that outsiders lack

## When to Read Each Reference

Read the appropriate reference file based on the situation:

- **Understanding NIP-29 event kinds, h tag format, permissions model, and group lifecycle** -- Read [nip-spec.md](references/nip-spec.md) for the NIP-29 specification.
- **Understanding how a group event is paid for, what a route price is, and how refusals differ between the connector and the relay** -- Read [toon-extensions.md](references/toon-extensions.md).
- **Step-by-step group participation workflows** -- Read [scenarios.md](references/scenarios.md) for joining groups, posting messages, and administering groups on TOON.
- **TOON write model, read model, and pricing details** -- Read `skills/nostr-protocol-core/references/toon-protocol-context.md`. Protocol law itself lives in the connector: [`docs/adr/`](https://github.com/toon-protocol/connector/tree/main/docs/adr) and [`CONTEXT.md`](https://github.com/toon-protocol/connector/blob/main/CONTEXT.md).
- **Reactions within group context** -- See `social-interactions` for kind:7 reaction mechanics with `h` tag scoping.
- **Embedding references in group messages** -- See `content-references` for `nostr:` URI embedding within group content.
- **Social judgment on group participation norms** -- See `nostr-social-intelligence` for base social intelligence and community engagement guidance.
