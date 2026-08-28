---
name: rfc-0019-glossary
description: Where TOON Protocol's vocabulary actually lives (Interledger RFC 0019 glossary, localized). Use when users ask "what is" / "define" for a TOON or ILP term - claim, fee, price, charge, cost, cap, peering, greeting, self-description, fulfilment - or use a term that has been retired (peer wire, exposure, ceiling, balance proof, apex, kind:10032). Triggers on 'what is', 'define', 'terminology', 'glossary', or an unclear TOON/ILP term.
---

# RFC 0019: Glossary — read `CONTEXT.md`, not this page

RFC 0019 is **vendored verbatim** in the connector at a pinned upstream commit,
beneath a TOON profile:
[`connector/docs/rfcs/0019-glossary/`](https://github.com/toon-protocol/connector/tree/main/docs/rfcs/0019-glossary)
(connector ADR 0062).

## The one rule this skill exists to state

**[`connector/CONTEXT.md`](https://github.com/toon-protocol/connector/blob/main/CONTEXT.md)
is TOON's vocabulary, and it wins.** Read RFC 0019 to learn what an Interledger
practitioner means by a word; read `CONTEXT.md` to learn what a line of TOON code
means by it. Where the two disagree, `CONTEXT.md` is what the code, the records
and the specs use — and the standing rule is to fix the glossary, never the
record.

This page deliberately does **not** restate live definitions. A copied
definition drifts, and a drifted definition is worse than a link. Go to
`CONTEXT.md` for a live term. What is worth keeping here is the part `CONTEXT.md`
cannot give you by search: the words that are **gone**, and what replaced them.

## Where TOON's vocabulary departs from RFC 0019

- **"Ledger" and "transfer" have no referent.** There is no ledger and no
  transfer object. The money primitives are **payment channel**, **claim**,
  **nonce** and **watermark** (ADR 0005). `TRANSFER` survives only as a BTP frame
  type at carriage.
- **"Receiver" is not a role.** The triad is **connector**, **app** and
  **handler**. A route *termination* is a property of a route on the connector
  itself, and what sits behind it is a payment-oblivious app.
- **"Fulfilment" is respelled and redefined.** British spelling, and it proves
  *delivery*; it does not move value (ADR 0042). "Receipt", "proof of payment"
  and "preimage" are avoided.
- **"Peer" is narrower, and peer role is proved by a claim signature** — never by
  which listener the bytes arrived on, and no longer by a shared secret
  (ADR 0060). A peering is established from a URL (ADR 0058).
- **"Quote" and "spread" are refused.** A **fee** is not a spread, a commission
  or a rate; a **cost** is not a quote. Cost is discovered by **probe**, from a
  reject carrying the accumulated sum (ADR 0011).

**Faithful:** *connector*, *packet*, *condition*, *prepare* / *fulfil* / *reject*,
*expiry*, *peering* and *settlement* keep their RFC 0019 meanings.

## Retired terms — refused, not renamed

Each of these is kept as a tombstone so the name is refused rather than
reinvented. If you meet one in an old document, this is what it became.

| Retired term | What it was | What to say instead |
| --- | --- | --- |
| **Peer wire** | a raw-TCP transport, deleted | **peer carriage** (where the bytes ride — BTP or ILP-over-HTTP) and **peer role** (the authority of one interaction) — ADR 0027 |
| **Exposure** | a tracked amount a peering was owed | nothing. No projection produces it — ADR 0033 |
| **Ceiling** | the exposure a peering tolerated | **cap**, which bounds **one packet** and never an accumulation — ADR 0049. "Credit limit", "debt limit" and "liquidity bound" are refused too |
| **Flush** | how long trailing exposure could persist | nothing. (Not to be confused with the still-live `Toon-Flush-Requested` hint, which prompts a payer and binds nothing) |
| **Minimum delivery** | a floor on what must arrive | nothing — a claim bounds erosion (ADR 0057). `R01` survives narrowed to RFC 0027's own "too little to forward" sense |
| **Balance proof** | a signed cumulative assertion | **claim** |
| **Speaks ILPv4** | — | **ILPv4 semantics, TOON encoding** (ADR 0063); the byte layout is not RFC 0027's |
| **402 / x402** | the unpaid-request answer | **greeting** |
| **BLS / Business Logic Server / backend / gateway / terminator / agent runtime** | what sits behind a route | **app**, reached through a **handler** |
| **Admin / control plane** | the authenticated write surface | **operator surface** |
| **`kind:10032` / `IlpPeerInfo`** | a node's announce on a Nostr relay | the **self-description** at `GET /ilp` — ADR 0046 removed the announce, ADR 0050 put the facts on the node's own URL |
| **`basePricePerByte`, `feePerByte`, per-byte pricing, `kind:10035` SkillDescriptor pricing** | the old money model | **fee / price / charge / cost / cap** below — ADR 0061 and ADR 0065 |
| **Apex, `g.proxy`, town / dvm / mill children, free-forward** | the old topology | gone. The apex was destroyed 2026-08-14; live addresses are `g.toon.relay`, `g.toon.store`, `g.toon.gas`, and **nothing answers at `g.toon`** |
| **Purchasable peering, vanity prefix, prefix sale** | buying a route or a name | nothing — ADR 0043 removed it outright; `[peer_sale]` is refused by name |

## The five money words, since they are asked for constantly

| Word | What it is |
| --- | --- |
| **Fee** | flat, per packet, attached to the **peering** — never proportional, never per route (ADR 0061) |
| **Price** | a schedule on a *terminated* route: `price + pricePerKib × ceil(sealedBytes / 1024)`, flat exactly when the slope is zero (ADR 0065) |
| **Charge** | that price evaluated for one packet, over the **sealed** payload's length |
| **Cost** | every hop's fee plus the terminating charge — discovered from a probe's reject (ADR 0011, ADR 0044) |
| **Cap** | the most one packet may carry to one peer (ADR 0049) |

Never "per-byte" — the unit is a **kibibyte**.

## Common Topics

- Deferring to `connector/CONTEXT.md` as the live vocabulary
- Retired terms and their replacements: peer wire, exposure, ceiling, flush, minimum delivery, balance proof
- Fee / price / charge / cost / cap
- Words that are forbidden rather than merely unused (BLS, admin, 402, per-byte)
