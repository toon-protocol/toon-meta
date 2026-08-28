---
name: rfc-0032-peering-clearing-settlement
description: How TOON Protocol relates to Interledger RFC 0032 - Peering, Clearing and Settlement. Use when users ask how a TOON peering is created, whether a peering can be bought or announced, how clearing works, when on-chain settlement happens, how an operator gets paid, or what the connector fee is. Also covers generic peering, clearing, and settlement questions. Triggers on 'peering', 'clearing', 'settlement', 'POST /peers', 'redeem', 'connector fee', or 'how do I get paid'.
---

# RFC 0032: Peering, Clearing and Settlement — the model TOON replaces most completely

RFC 0032 is **vendored verbatim** in the connector at a pinned upstream commit,
beneath a TOON profile naming every departure:
[`connector/docs/rfcs/0032-peering-clearing-settlement/`](https://github.com/toon-protocol/connector/tree/main/docs/rfcs/0032-peering-clearing-settlement).
Read the profile before the body — the profile is the part that binds
(connector ADR 0062).

## What the RFC says

Two connectors agree to peer. Traffic between them accrues an obligation; the
obligation is **netted**; when the net position crosses a **threshold** (or a
timer fires), the debtor **settles** on some underlying ledger. Peer, clear,
settle — three phases, with credit extended between them and a credit limit
bounding the exposure.

Read it to understand what a peering is *for*. Do not read it for how this
connector keeps score.

## How TOON diverges

**There is nothing to net, because nothing accumulates.**

- **A peering is created by an operator, from a URL.** `POST /peers { id, url,
  fee, max_packet_amount }`, an authenticated write on the operator surface. The
  counterparty's endpoint, carriage, identity and settlement facts are read from
  its own self-description at that URL
  ([ADR 0058](https://github.com/toon-protocol/connector/blob/main/docs/adr/0058-a-peering-is-established-from-a-url.md)).
  That identity is trust-on-first-use over TLS, pinned by nothing — worth knowing
  before you peer with a stranger.
- **A peering cannot be bought, learned, earned or announced into existence.**
  Purchasable peering was **removed outright** by
  [ADR 0043](https://github.com/toon-protocol/connector/blob/main/docs/adr/0043-purchasable-peering-is-removed.md),
  which retired ADRs 0037/0038/0039 with it; `[peer_sale]` is a config key parsed
  only to be refused by name. Terms are not negotiated. The connector neither
  discovers nor advertises routes — it **answers**, and does nothing else about
  being found (ADR 0022, ADR 0046).
- **Clearing is per packet.** Every PREPARE carries the claim that pays for it,
  and a connector covers every PREPARE it sends
  ([ADR 0042](https://github.com/toon-protocol/connector/blob/main/docs/adr/0042-a-packet-carries-its-claim.md)).
  Nothing is ever owed between packets, so there is no window for a counterparty
  to walk away inside.
- **There is no clearing balance.** Claims are the source of truth; a balance is
  a projection replayed from the journal, which is the only money state persisted
  ([ADR 0005](https://github.com/toon-protocol/connector/blob/main/docs/adr/0005-claims-are-truth-balances-are-a-projection.md)).
  The word is **claim**, never "balance proof".
- **There is no credit limit.** What remains is the **cap**, which bounds **one
  packet** and never an accumulation; a sender learns it from a `T04` whose
  message states it (ADR 0049). "Ceiling", "credit limit", "debt limit" and
  "liquidity bound" are refused by name.
- **No channel identifier is ever exchanged.** Both sides derive it from the two
  participants — `keccak256(p1, p2, epoch)` on EVM, a PDA on Solana (ADR 0059).

## Settlement: an operator write, with no threshold

**There is no settlement threshold, trigger, netting cycle or interval.**
Settlement is an explicit, authenticated **operator** write against a channel,
never a schedule. `flush_interval_ms` is parsed only to be refused by name
([ADR 0033](https://github.com/toon-protocol/connector/blob/main/docs/adr/0033-the-exposure-machinery-is-retired-not-restated.md)),
and `toon_settlement_total` is a permanently-zero placeholder kept for
scrape-config stability.

**`POST /channels/:id/redeem-latest` is how you get paid.** It takes the latest
claim on that channel to the chain and redeems it. `GET /claims` and
`GET /channels` are the read side. On-chain settlement is rare and deliberate —
the opposite of a claim.

## Fee, price, charge, cost

| Word | What it is |
| --- | --- |
| **Fee** | flat, per packet, attached to the **peering** — never a spread, never a percentage, never per route (ADR 0061) |
| **Price** | a schedule on a *terminated* route: `price + pricePerKib × ceil(sealedBytes / 1024)`, flat exactly when the slope is zero (ADR 0065) |
| **Charge** | that price evaluated for one packet, over the **sealed** payload's length |
| **Cost** | every hop's fee plus the terminating charge — discovered from a probe's reject, sum only (ADR 0011, ADR 0044) |
| **Cap** | the most one packet may carry to one peer (ADR 0049) |

Never "per-byte" — the unit is a **kibibyte**. Never "quote" or "spread": cost is
discovered by **probe**, from a reject carrying the accumulated sum.

## Faithful

The bilateral relation is still the unit — one relation, one fee, one watermark
set, however many carriage paths carry it. And the payee's remedy for a watermark
that stops advancing is this RFC's own: stop forwarding to that peer.

**What the trade costs, stated plainly.** Because the claim rides *with* the
PREPARE rather than after the fulfilment, a hop can take your claim and decline
to carry the packet. ADR 0042 does not hide this. The bounds on it are the
per-packet cap and the sender's own choice of packet size.

## Common Topics

- `POST /peers` from a URL as the only way a peering comes into being (ADR 0058)
- Why a peering cannot be bought (ADR 0043) or announced (ADR 0046)
- Per-packet clearing; no balance, no threshold, no netting, no credit limit
- `POST /channels/:id/redeem-latest` as the operator's way to get paid
- Fee vs price vs charge vs cost vs cap
