---
name: rfc-0015-ilp-addresses
description: How TOON Protocol uses Interledger RFC 0015 - ILP Addresses. Use when users ask about TOON's ILP address scheme, what g.toon.relay / g.toon.store / g.toon.gas mean, who allocates an address, or longest-prefix routing. Also covers generic ILP address format, grammar, and validation questions. Triggers on 'ILP address', 'g.toon', 'address format', 'routing prefix', or 'how does TOON address a node'.
---

# RFC 0015: ILP Addresses on TOON

RFC 0015 is **vendored verbatim** in the connector at a pinned upstream commit,
beneath a TOON profile naming every departure:
[`connector/docs/rfcs/0015-ilp-addresses/`](https://github.com/toon-protocol/connector/tree/main/docs/rfcs/0015-ilp-addresses).
Read the profile before the body — the profile is the part that binds
(connector ADR 0062).

## What the RFC says

An ILP address is a dot-separated, hierarchical routing identifier
(`g.example.app`), matched by longest prefix. The RFC also defines an
**allocation scheme** in the first label — `g`, `private`, `example`, `peer`,
`self`, `test1`–`test3`, `local` — each with its own intended semantics.

## How TOON diverges

- **An address is self-asserted: a claim, not a grant.** Nothing allocates one,
  no registry records one, and no connector is given one by another. There is no
  "address space" anyone owns, no upstream that assigns a child its name, and no
  address derived from peering topology. Choosing a name beneath a peer's
  address is a courtesy that keeps their routing table small, never a delegation
  that binds anyone. The connector's `CONTEXT.md` puts it as *reachability is the
  only registry*, and refuses the phrases "allocated address" and "assigned
  address" outright.
- **A prefix cannot be bought.** Purchasable peering, vanity prefixes and
  prefix-sale pricing were removed outright by
  [ADR 0043](https://github.com/toon-protocol/connector/blob/main/docs/adr/0043-purchasable-peering-is-removed.md);
  `[peer_sale]` is a config key parsed only to be refused by name.
- **The allocation scheme is not validated, or even read.** Address validation
  checks non-empty, ≤ 1023 characters, and that every dot-separated label is
  valid. There is no enumeration of `g` / `peer` / `self` / `private`, and a bare
  `"g"` passes. `peer.`'s link-local semantics, `self.`'s loopback and
  `private.`'s unroutability are simply absent. Every live address is under `g.`.
- **The label character set omits `~`.** Only ASCII alphanumerics plus `-` and
  `_` are accepted — stricter than the RFC, inherited from the TypeScript
  prototype. A conforming peer using `~` in a label would be refused.
- **Matching is longest-prefix, then route rank** — App, Peer, RuntimePeer,
  Leased — with length dominating rank, an ordering the RFC has no notion of
  ([ADR 0048](https://github.com/toon-protocol/connector/blob/main/docs/adr/0048-routing-precedence-is-length-then-rank-and-a-lease-cannot-capture-a-termination.md)).
  Matching is label-aware, so `g.example` cannot match `g.exampleX`.
- **An address does not name an endpoint by itself.** The sealed envelope's
  target is confined beneath the matched route's handler path; an absolute path,
  a `.`/`..` segment, a scheme or an authority is `F00` before the app is
  touched.

**Faithful:** dot-separated labels as the atom of matching, the 1023-character
maximum, no empty or consecutive-dot labels, hierarchical longest-prefix routing,
and an empty address permitted only as a REJECT's `triggeredBy`.

## The live addresses

| Destination | Terminates at | Price (base units of 6-dp USDC) |
| --- | --- | --- |
| `g.toon.relay` | relay box | **1**, flat |
| `g.toon.store`, `g.toon.relay.store` | store box | **`base = 1000, per_kib = 10`** — a schedule |
| `g.toon.gas` | gas box | **1000** |

Probed live 2026-08-28. **`g.proxy…` is dead** — the apex was destroyed
2026-08-14 (connector#872, toon-meta#313), and there is no `g.proxy.town`,
`g.proxy.dvm` or `g.proxy.mill`. **Nothing answers at `g.toon` itself**: it is
the namespace root in the wire protocol and no node claims it.

Never quote a price from memory. A node's own `GET /ilp` is the authority, and a
node repository's `deploy/` bundle is the authority for what its box serves
(ADR 0068).

## What to tell a user constructing a destination

Ask the node. `GET /ilp` on its URL returns the self-description: its addresses,
its settlement facts and every route's price — free and unauthenticated
([ADR 0050](https://github.com/toon-protocol/connector/blob/main/docs/adr/0050-a-connectors-url-resolves-to-its-self-description.md)).
From a client:

```ts
const desc = await client.describe();
const terms = await client.routePrice('g.toon.store'); // { price, pricePerKib? }
```

`client.send()`'s destination is optional and defaults to the node's own
published address.

Don't confuse the **ILP address** (a routing destination) with a **Nostr
identity** (npub/pubkey, who signed an event) — and TOON has no payment pointers
at all (`rfc-0026`).

## Common Topics

- Self-asserted addressing: a claim, not a grant; nothing allocates, nothing sells
- The live `g.toon.*` addresses, and that nothing answers at `g.toon`
- Longest-prefix then route rank; label-aware matching; the `~` omission
- Learning an address and its price from `GET /ilp`, never from memory
