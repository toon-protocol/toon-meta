# Protocol

**toon-meta does not state protocol law.** The connector owns it, in two places:

- [`connector/docs/adr/`](https://github.com/toon-protocol/connector/tree/main/docs/adr) — 69 status-tracked records. Each record's own `**Status:**` line, *not* the index, is the authority for whether it is live.
- [`connector/CONTEXT.md`](https://github.com/toon-protocol/connector/blob/main/CONTEXT.md) — the vocabulary. Read it before naming anything.

This page is a pointer map, plus the little that is genuinely cross-repo.

## Where the law lives

| Area | Records |
|------|---------|
| **Addressing & discovery** | `0022` a connector answers, it never announces · `0046` the kind:10032 announce is removed · `0050` a connector's URL resolves to its self-description · `0067` a route declares its request shape, and the connector never reads it |
| **Peering & carriage** | `0027` peers ride BTP or ILP-over-HTTP; the raw-TCP peer wire is deleted · `0058` a peering is established from a URL · `0060` a claim proves a peering; the shared secret is deleted · `0061` a fee attaches to a peering, not to a route |
| **Money model** | `0042` a packet carries its claim · `0049` the cap bounds one packet and is set from outside · `0052` permissionless payment is guaranteed; a claim, never an identity, authorises · `0057` minimum delivery is retired · `0059` a channel is derived from its participants · `0065` a price is a schedule over payload length |
| **Payload & termination** | `0018` a payload is sealed to the terminating connector · `0019` a terminating connector derives the fulfilment · `0032` a client destination is never a route termination · `0040` a verified payment is stated to the app · `0064` a deadline bounds the wait for an app, not the answer |
| **Encoding & conformance** | `0021` vectors are normative, prose is not · `0063` the ILP packet is TOON's dialect, not RFC 0027's · `0062` an RFC is vendored verbatim and profiled, never forked |

Two records are numbered **0065** in that folder (`0065-a-price-is-a-schedule-over-payload-length.md` and `0065-mina-leaves-the-repository.md`). Cite 0065 by title, never by number alone.

Specifications rather than decisions live in [`connector/docs/protocol/`](https://github.com/toon-protocol/connector/tree/main/docs/protocol) (client edge, peer carriage, packet flow, payment, self-description, configuration, operator). The ten Interledger RFCs the connector implements are **vendored verbatim at a pinned upstream commit** under [`connector/docs/rfcs/`](https://github.com/toon-protocol/connector/tree/main/docs/rfcs), each beneath a TOON profile naming the departures (ADR 0062). Link those, never interledger.org — the profile is the part that binds.

## The money model, in five words

| Word | What it is | Record |
|------|-----------|--------|
| **Fee** | flat, per packet, attached to the **peering** — never proportional, never per route | 0061 |
| **Price** | a schedule on a *terminated* route: `base + per_kib × ceil(len / 1024)`, flat exactly when the slope is zero | 0065 (a price is a schedule) |
| **Charge** | that price evaluated for one packet, over the **sealed payload's** length | 0065 |
| **Cost** | every hop's fee plus the terminating charge — discovered from a probe's reject, sum only | 0011, 0044 |
| **Cap** | the most one packet may carry to one peer | 0049 |

Never "per-byte" — the unit is a **kibibyte**.

## Reject codes that bind

A reject code binds only where a sender must act differently (ADR 0051).

| Code | Means |
|------|-------|
| `F03` | Invalid Amount — the claim does not cover the charge. This is underpayment. |
| `T04` | over the peering's cap. **The message states the cap**, which is the only way a sender learns it (ADR 0049). Never carried, never split. |
| `R01` | RFC 0027's own case only: this hop's fee alone exceeds the arriving amount, so nothing would be forwarded (ADR 0057 as corrected). |
| `F02` | nothing routes that name. |
| `T01` | the peer was not there. |

**The connector never parses the payload.** There is no TOON parse, no signature check and no event-kind dispatch anywhere on the packet path — opacity is a property of carriage (ADR 0016/0018), and the terminating connector reads only the envelope.

## Live devnet

| Destination | Terminates at | Price (base units of 6-dp USDC) |
|-------------|---------------|--------------------------------|
| `g.toon.relay` | relay box | **1**, flat |
| `g.toon.store`, `g.toon.relay.store` | store box (`ario`) | **`base = 1000, per_kib = 10`** — a schedule |
| `g.toon.store.relay` | store box | **2**, flat |
| `g.toon.gas`, `g.toon.relay.gas` | gas box | **1000** |

Probed live 2026-08-28 from each node's `GET /ilp`. **A node repository's own `deploy/` bundle is the authority for what its box serves** (ADR 0068) — read that, or probe. `connector/docs/devnet-pricing.md` is behind the fleet on all three counts and is tracked as connector#1250: it still names `g.toon.ario` (a box label, not an address any route answers to), still shows the store as flat, and does not know about the gas box.

**Nothing answers at `g.toon`.** It remains the namespace root in the wire protocol, but the apex was destroyed on 2026-08-14 (connector#872, toon-meta#313) and no node claims that address. An ILP address is **self-asserted** — nothing allocates one, no registry records one, and no connector is given one by another. *(This lands the correction `two-node-architecture.md` §5.4 asked for.)*

## Genuinely cross-repo

- **TOON encoding** ([toon-format](https://github.com/toon-format/toon)) is an agreement between a **client and an app** about payload bytes. It is not connector law: the connector carries those bytes sealed and never opens them.
- **Nostr event kinds** are owned by the app repos that serve them — `relay` for NIP-01/NIP-34, `store` and `gas-station` for their NIP-90 job kinds. Read each repo; no kind table lives here.

## Retired — do not rebuild

| Machinery | What killed it |
|-----------|----------------|
| Purchasable peering, vanity prefixes, prefix-sale pricing | **ADR 0043** removed purchasable peering outright and retired 0037/0038/0039. A peering cannot be bought; `[peer_sale]` is a config key parsed only to be refused by name. |
| The kind:10032 "business card" (`btpEndpoint`, `feePerByte`, `supportedChains`, `tokenNetworks`) | **ADR 0046** removed the announce (built, #1074); **ADR 0050** puts the same facts on a `GET` of the node's own URL. Arbitrum was never the fleet's chain. |
| Addresses derived from peering topology; an upstream "assigning a child address" | Exactly inverted — see the self-asserted-address rule above (`CONTEXT.md`, *ILP address*). |
| `feePerByte`, `basePricePerByte`, per-byte pricing, per-kind overrides, self-write bypass, kind:10035 `SkillDescriptor` | **ADR 0061** and **ADR 0065** (a price is a schedule) replaced the whole model with fee / price / charge / cost above. |
| Mill swap recipient-key discovery, `MILL_MNEMONIC`, `mill_ready` | `@toon-protocol/mill` is a dead 404 package (`@toon-protocol/swap` is the live one), and the connector takes **no mnemonic anywhere** — every key is a path, never a value. |
| The five-stage validation pipeline (size → TOON parse → Schnorr → pricing → kind dispatch) and its `F04`/`F06`/`F08` table | Never true of the connector; see the reject table above. |
| Minimum delivery | **ADR 0057** — a claim bounds erosion. |
| Exposure, ceiling, flush | **ADR 0033** — `cap` bounds one packet, never an accumulation. |
| The raw-TCP peer wire | **ADR 0027**. The two live axes are **peer carriage** (where the bytes ride) and **peer role** (the authority of one interaction). |
| "Balance proof" | The word is **claim** (`CONTEXT.md`). |
