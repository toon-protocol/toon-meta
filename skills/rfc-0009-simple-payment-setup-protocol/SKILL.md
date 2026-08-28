---
name: rfc-0009-simple-payment-setup-protocol
description: Why TOON Protocol does not use Interledger RFC 0009 - Simple Payment Setup Protocol (SPSP). Use when users ask whether TOON uses SPSP, how TOON sets up a payment, how a payer discovers a node's terms, or how payment setup differs from vanilla Interledger. Also covers generic SPSP, payment-setup, and receiver-info questions. Triggers on 'SPSP', 'payment setup', 'how does TOON set up a payment', or 'how do I find a TOON node'.
---

# RFC 0009: Simple Payment Setup Protocol (SPSP) — and why TOON does not use it

## What the RFC says

SPSP is Interledger's Application-layer setup protocol. A receiver exposes an
HTTPS endpoint — conventionally found by resolving a payment pointer
(`rfc-0026`) — which answers a `GET` with the receiver's ILP destination
address and a shared secret. The sender uses that pair to start a STREAM
connection (`rfc-0029`) and pays over it. Setup is a handshake between a
**sender** and a **receiver**, and its product is a shared secret.

## How TOON diverges

**TOON deliberately does not use SPSP.** There is no payment-setup handshake in
the pay path, and SPSP is one of the RFCs the connector pointedly does *not*
vendor — a copy would assert a relevance it does not have (connector
[ADR 0062](https://github.com/toon-protocol/connector/blob/main/docs/adr/0062-an-rfc-is-vendored-verbatim-and-profiled-never-forked.md)
D4). Three of SPSP's four moving parts have no counterpart here:

- **No receiver.** TOON's triad is connector, app and handler. A route
  *termination* is a property of a route on the connector itself, and what sits
  behind it is a payment-oblivious app.
- **No shared secret negotiated in setup.** The 32-byte secret a packet uses is
  CSPRNG output carried *inside* the sealed payload, generated per packet.
- **No STREAM to bootstrap.** TOON has no transport layer at all. One sealed
  request envelope per packet — no chunking, no flow control.

What TOON has instead is **answering**, not handshaking.

## What replaces it: the self-description

A connector **answers, it never announces**. `GET /ilp` on a node's URL returns
its **self-description** — its addresses, its settlement facts (chain, token,
decimals) and **every route's price**. It is free, unauthenticated, and it is
the only thing a stranger needs in order to start paying
([ADR 0050](https://github.com/toon-protocol/connector/blob/main/docs/adr/0050-a-connectors-url-resolves-to-its-self-description.md)).

An unpaid request to a priced route is answered with a **greeting** carrying
that route's terms. (The word is *greeting*. Do not call it "402" or "x402".)

**Do not look for**: a payment pointer, an SPSP `/.well-known` endpoint, a
`/health` price endpoint, or a `kind:10032` peer-info event. The last was
removed outright — a connector must work with no relay in the world
([ADR 0046](https://github.com/toon-protocol/connector/blob/main/docs/adr/0046-the-kind-10032-announce-is-removed-a-connector-needs-no-relay.md)).
`basePricePerByte`, `feePerByte` and `kind:10035` `SkillDescriptor` pricing are
gone with it.

## What to tell a user asking "how do I set up a payment on TOON?"

There is no setup step. There is a channel and a client.

```ts
import { ToonClient } from '@toon-protocol/client';

const client = await ToonClient.create({
  connector: 'https://proxy.relay.devnet.toonprotocol.dev',
  mnemonic: process.env.TOON_MNEMONIC,
});
await client.channel.open({ deposit: 100_000n });
const answer = await client.send({ body: signedEvent });
```

`send()` does the sealing, the pricing and the claim. A caller never signs a
claim by hand and never builds an ILP packet. A REJECT comes back as
`{ fulfilled: false }` — it is never thrown.

To read terms before paying, ask: `await client.describe()` for the whole
document, or `await client.routePrice(destination)` for one route's
`{ price, pricePerKib? }`. Then `chargeFor(terms, sealedBytes)` decides what
goes on the claim.

## Common Topics

- Why SPSP is absent, and why it is not vendored (ADR 0062 D4)
- `GET /ilp` self-description and the greeting as what replaced setup
- Payment-channel open + a claim carried by the packet as TOON's "setup"
- Relationship to `rfc-0026` (payment pointers), `rfc-0029` (STREAM), `rfc-0023` (BTP)
