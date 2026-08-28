---
name: rfc-0026-payment-pointers
description: Why TOON Protocol does not use Interledger RFC 0026 - Payment Pointers. Use when users ask whether TOON uses payment pointers, what a TOON "address" is, how to address or find a TOON node, or how user-facing addressing differs from vanilla Interledger. Also covers generic payment-pointer format/resolution questions. Triggers on 'payment pointer', '$paymentpointer', 'TOON address', or 'how do I address a TOON node'.
---

# RFC 0026: Payment Pointers — and why TOON does not use them

## What the RFC says

A payment pointer (`$example.com/alice`) is a human-friendly handle that
resolves, by a fixed rule, to an HTTPS URL. A `GET` on that URL reaches an SPSP
endpoint (`rfc-0009`), which hands the sender the receiver's ILP address and a
shared secret. The pointer exists so that a person can be told where to pay in
a form they can read out loud.

## How TOON diverges

**TOON deliberately has no payment pointers.** There is no `$`-prefixed handle
and no pointer resolution anywhere. Payment pointers are one of the RFCs the
connector pointedly does *not* vendor — a copy would assert a relevance it does
not have (connector
[ADR 0062](https://github.com/toon-protocol/connector/blob/main/docs/adr/0062-an-rfc-is-vendored-verbatim-and-profiled-never-forked.md)
D4). Since TOON also has no SPSP, the whole pointer → SPSP → shared-secret chain
is absent, not merely unused.

The one-line replacement: **a route is an ILP address, a node is a URL.**

- **A node is a URL.** `GET /ilp` on it returns the node's **self-description**
  — its addresses, its settlement facts (chain, token, decimals) and **every
  route's price**. Free, unauthenticated, and the only thing a stranger needs
  ([ADR 0050](https://github.com/toon-protocol/connector/blob/main/docs/adr/0050-a-connectors-url-resolves-to-its-self-description.md)).
  An unpaid request to a priced route is answered with a **greeting** carrying
  that route's terms — the word is *greeting*, never "402" or "x402".
- **A route is an ILP address.** `g.toon.relay`, `g.toon.store`, `g.toon.gas`.
  Hierarchical, matched by longest prefix (`rfc-0015`). An ILP address is
  **self-asserted — a claim, not a grant**: nothing allocates one, no registry
  records one, and no connector is given one by another.
- **A person is a Nostr pubkey.** An npub/hex secp256k1 key identifies *who*
  wrote an event. It is not an address and it routes nothing.

## What to tell a user asking "what's the payment pointer for…?"

There isn't one, and there is nothing shaped like one. To pay a TOON node you
need its **URL**; the destination address and the price both come out of its own
`GET /ilp`:

```ts
const client = await ToonClient.create({
  connector: 'https://proxy.relay.devnet.toonprotocol.dev',
  mnemonic: process.env.TOON_MNEMONIC,
});
const desc = await client.describe();               // addresses, settlement, prices
const terms = await client.routePrice('g.toon.store'); // { price, pricePerKib? }
```

`client.send()` then seals, prices and mints the claim; the destination is
optional and defaults to the node's own published address.

**Never mention as live**: `kind:10032` peer info / `IlpPeerInfo`, a `/health`
price endpoint, `basePricePerByte`, `feePerByte`, or `kind:10035`
`SkillDescriptor` pricing. The announce was removed
([ADR 0046](https://github.com/toon-protocol/connector/blob/main/docs/adr/0046-the-kind-10032-announce-is-removed-a-connector-needs-no-relay.md));
the money model it carried was replaced by ADR 0061 and ADR 0065.

## Common Topics

- Why TOON has no payment pointers (no SPSP chain — see `rfc-0009`)
- A route is an ILP address, a node is a URL; `GET /ilp` is how you learn both
- Self-asserted addresses: `g.toon.relay`, `g.toon.store`, `g.toon.gas`
- Nostr npub/pubkey as actor identity, not an address
