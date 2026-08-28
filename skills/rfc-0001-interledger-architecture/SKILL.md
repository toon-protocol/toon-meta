---
name: rfc-0001-interledger-architecture
description: How TOON Protocol maps onto the Interledger architecture (RFC 0001). Use when users ask how TOON works end-to-end, what a connector is, how paid writes and free reads work, which of ILP's layers TOON has and which it does not, or how TOON's stack (payment channels + signed claims + a sealed payload + a payment-oblivious app) composes. Also covers generic ILP architecture, protocol layers, and connector-design questions. Triggers on 'how Interledger works', 'ILP architecture', 'TOON architecture', 'connector', or 'protocol stack'.
---

# RFC 0001: Interledger Architecture, mapped to TOON

RFC 0001 is **vendored verbatim** in the connector at a pinned upstream commit,
beneath a TOON profile naming every departure:
[`connector/docs/rfcs/0001-interledger-architecture/`](https://github.com/toon-protocol/connector/tree/main/docs/rfcs/0001-interledger-architecture).
Read the profile before the body — the profile is the part that binds
(connector ADR 0062).

## What TOON is, in one sentence

**A connector is a paid reverse proxy.** It fronts an ordinary HTTP app, charges
for a route, and hands that app a request that was already paid for. The app
never learns it was paid for.

## Read RFC 0001 for the layering — then delete two of its five layers

| RFC 0001 layer | TOON |
| --- | --- |
| **Application** | Ordinary HTTP the app never knows was paid for. A payment-oblivious app behind a handler URL, with the connector acting as a paid reverse proxy (ADR 0020, narrowed by ADR 0040). Not an application protocol both endpoints speak. |
| **Transport** | **Absent.** No STREAM, no chunking, no end-to-end secret negotiated above ILP. One sealed request envelope per packet. |
| **Interledger** | ILPv4 PREPARE/FULFILL/REJECT **semantics** with **TOON's own encoding** — deliberately not byte-compatible (ADR 0063; see `rfc-0027`). Routed by self-asserted `g.*` address, longest prefix (`rfc-0015`). |
| **Ledger** | **Deleted rather than abstracted.** There is no ledger abstraction (ADR 0005). Settlement is in-process payment channels on **EVM and Solana only**, with a channel derived from its participants (ADR 0059). |

Two more inversions worth holding:

- **Conditional transfer is inverted.** Nothing is held in escrow pending a
  fulfilment. The covering claim rides **with** the PREPARE, and a fulfilment
  proves the intended receiver got the packet and nothing else
  ([ADR 0042](https://github.com/toon-protocol/connector/blob/main/docs/adr/0042-a-packet-carries-its-claim.md)).
- **The sender–connector–receiver triad collapses to two roles.** There is no
  receiver. A route *termination* is a property of a route on the connector
  itself; what sits behind it is an **app**.

**Faithful:** the bilateral peering shape — two carriages, BTP over `wss://` and
ILP-over-HTTP over `https://` (ADR 0027) — hop-by-hop forwarding, and payload
opacity in carriage, made structural rather than advisory (ADR 0016).

## The mental model

- **Discovery: a connector answers, it never announces.** `GET /ilp` on a node's
  URL returns its **self-description**: addresses, settlement facts (chain,
  token, decimals) and **every route's price**. Free, unauthenticated
  ([ADR 0050](https://github.com/toon-protocol/connector/blob/main/docs/adr/0050-a-connectors-url-resolves-to-its-self-description.md)).
  An unpaid request to a priced route is answered with a **greeting** carrying
  that route's terms. The word is *greeting* — never "402" or "x402".
- **Write = pay.** A PREPARE whose `data` is a gift wrap sealed to the
  terminating connector, carrying its covering **claim** — a signed, monotonic
  cumulative assertion against an on-chain channel deposit. The connector
  verifies, charges, forwards to the app, and answers FULFILL or REJECT.
- **Read = free.** Reads do not go through the pay path at all. The fleet's relay
  serves plain NIP-01 over its own free WebSocket port.
- **Clearing is per packet, and settlement has no threshold.** Nothing accrues
  between packets. Settlement is an authenticated **operator** write —
  `POST /channels/:id/redeem-latest` — never a schedule (see `rfc-0032`).

## The money words

| Word | What it is |
| --- | --- |
| **Fee** | flat, per packet, attached to the **peering** (ADR 0061) |
| **Price** | a schedule on a *terminated* route: `price + pricePerKib × ceil(sealedBytes / 1024)`, flat when the slope is zero (ADR 0065) |
| **Charge** | that price evaluated for one packet, over the **sealed** payload's length |
| **Cost** | every hop's fee plus the terminating charge — discovered by probe (ADR 0011, ADR 0044) |
| **Cap** | the most one packet may carry to one peer (ADR 0049) |

Never "per-byte" — the unit is a **kibibyte**. Prices are in the settlement
token's smallest unit; USDC is 6-decimal, so `1_000_000` = $1.

## The live topology

| Destination | Terminates at | Price (base units of 6-dp USDC) |
| --- | --- | --- |
| `g.toon.relay` | relay box | **1**, flat |
| `g.toon.store`, `g.toon.relay.store` | store box | **`base = 1000, per_kib = 10`** |
| `g.toon.gas` | gas box | **1000** |

Probed live 2026-08-28. There is **no apex**: `g.proxy` and its `town` / `dvm` /
`mill` children are dead (the apex box was destroyed 2026-08-14), there is no
"free parent→child forward", and **nothing answers at `g.toon`** itself. An ILP
address is **self-asserted — a claim, not a grant**.

## Using it

```ts
import { ToonClient } from '@toon-protocol/client';

const client = await ToonClient.create({
  connector: 'https://proxy.relay.devnet.toonprotocol.dev',
  mnemonic: process.env.TOON_MNEMONIC,
});
await client.channel.open({ deposit: 100_000n });
const answer = await client.send({ body: signedEvent });
```

`send()` seals the request, prices it, mints the claim and carries it. A caller
never signs a claim by hand and never builds an ILP packet. A REJECT comes back
as `{ fulfilled: false }` — never thrown. Other real methods: `describe()`,
`price(dest)`, `routePrice(dest)`, `probe(...)`, `claimState(...)`, `close()`.

## What TOON deliberately omits

No **SPSP** (`rfc-0009`), no **payment pointers** (`rfc-0026`), no **STREAM** or
STREAM receipts (`rfc-0029`/`rfc-0039`), no **HTLA** ledger-layer trust spectrum
(`rfc-0022`), no **ILDCP** (`rfc-0031`), no **separate settlement engine**
(`rfc-0038`), no route discovery, no advertisement, no exchange rates and no
quoting. **ILP-over-HTTP (`rfc-0035`) is present** — one of the two peer
carriages, and the client edge (`POST /ilp`).

**Never mention as live:** `kind:10032` peer info, `IlpPeerInfo`, a `/health`
price endpoint, `basePricePerByte`, `feePerByte`, `kind:10035` `SkillDescriptor`
pricing, `publishEvent()` or a caller-facing `signBalanceProof()`.

## Common Topics

- The connector as a paid reverse proxy in front of a payment-oblivious app
- Which of RFC 0001's five layers TOON has (two are absent, one is inverted)
- Answering vs announcing: `GET /ilp` and the greeting
- Fee / price / charge / cost / cap, and the live `g.toon.*` prices
- Why SPSP, STREAM, payment pointers and settlement engines are absent
