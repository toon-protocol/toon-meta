---
name: rfc-0015-ilp-addresses
description: How TOON Protocol uses Interledger RFC 0015 - ILP Addresses. Use when users ask about TOON's ILP address scheme, the g.proxy apex address, how g.proxy.town resolves, child node addressing, or longest-prefix routing. Also covers generic ILP address format, grammar, and validation questions. Triggers on 'ILP address', 'g.proxy', 'address format', 'routing prefix', or 'how does TOON address a node'.
---

# RFC 0015: ILP Addresses on TOON

Implements RFC 0015 hierarchical ILP addressing as TOON's routing scheme. TOON uses the `g.*` (global) allocation with longest-prefix matching (`routing/routing-table.ts:135-157`).

## How TOON uses this RFC

- **The apex is `g.proxy`.** The connector (the parent of every apex deployment) routes under this prefix.
- **Child nodes resolve under the apex.** The town relay is `g.proxy.town`; store and mill children sit alongside (e.g. `g.proxy.<child>`). A client publishing to the default relay uses destination `g.proxy.town`.
- **Longest-prefix routing.** The connector matches a packet's destination address against its routing table by longest prefix, so `g.proxy.town` routes to the town child while `g.proxy` (or an unmatched suffix) is handled by the apex itself.
- **Hierarchical structure mirrors topology.** The address hierarchy *is* the parent/child topology: the prefix relationship (`g.proxy` parent of `g.proxy.town` child) is what the free-forward rule keys on (see `rfc-0032`).

## Addressing pitfalls on TOON

- A child must tag the apex (`g.proxy`) as its parent (`TOON_PARENT_PEER_ID`) **and** be registered `relation:'child'`. A mismatch between the address hierarchy and the registered relation causes paid traffic to the child to be rejected with **F06 / T00** (see `rfc-0027`, `rfc-0032`).
- Don't confuse the **ILP address** (routing destination, `g.proxy.town`) with **Nostr identity** (npub/pubkey, who published an event). Addresses route packets; pubkeys identify actors. TOON has no payment pointers (see `rfc-0026`).

## What to tell a user constructing a destination

Use `g.proxy.town` for the default relay; discover the exact apex/child addresses from the apex's **kind:10032** peer-info advertisement (free read). The client daemon defaults `destination` to the configured apex relay.

## Common Topics
- The `g.proxy` apex prefix and `g.proxy.town` / child addresses
- Longest-prefix routing (`routing-table.ts`)
- Address hierarchy mirroring the parent/child topology
- F06/T00 from address-vs-relation mismatch
- ILP address vs Nostr identity vs (absent) payment pointers
