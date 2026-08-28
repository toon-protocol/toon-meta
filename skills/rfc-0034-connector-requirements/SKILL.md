---
name: rfc-0034-connector-requirements
description: How TOON Protocol's connector meets Interledger RFC 0034 - Connector Requirements. Use when users ask about the TOON connector implementation, what a TOON connector must do, building/operating a TOON connector, routing/forwarding obligations, peering, fees and caps, or the connector's release/compliance contract. Also covers generic connector-requirements and connector-implementation questions. Triggers on 'connector requirements', 'build a connector', 'TOON connector', 'operate a connector', or 'connector compliance'.
---

# RFC 0034: Connector Requirements — TOON's reference connector

RFC 0034 lists what a compliant Interledger connector must do (route, forward, manage liquidity, handle errors). TOON's connector is a concrete implementation of these requirements, and it is narrower than the RFC in ways that are deliberate: several things RFC 0034 assumes a connector does, a TOON connector refuses to do.

## TOON's connector

The authoritative implementation is the Rust connector in the `connector` repository — a Cargo workspace of `connector-*` crates. Rather than a generic RFC checklist, ground your answers in what this connector actually does, and in the ADRs that bind every implementation:

- **It answers; it never announces.** A connector tells whoever asks what its own configuration already says, and pushes nothing into any network unprompted (ADR 0022, ADR 0046). `GET /ilp` on the node's URL returns its **self-description**: its addresses, its settlement facts (chain, token, decimals) and every route's price. Free, unauthenticated, generated from live configuration when asked (ADR 0050). An unpaid request to a priced route is answered with a **greeting** carrying that route's terms — what it costs and what is needed to pay it — instead of the work. Call it a greeting; never "402" or "x402", which name the carrier rather than the thing.
- **Routing & forwarding.** Routes packets by longest matching `g.*` prefix, then rank; a static route always beats a leased one for the same prefix, and a runtime row can never take a key the config file owns (ADR 0034, ADR 0048).
- **Value validation.** A packet carries the claim that pays for it (ADR 0042). The connector validates that claim at ingress before it carries anything, and mints a claim for the value it forwards on. Say **claim**, not "balance proof".
- **Fees.** A **fee** is flat per packet and attaches to the **peering**, not to a route and never to a byte (ADR 0061). The fee and the cap are the operator's policy about one counterparty, held once by the peering rather than repeated on each route through it.
- **Prices.** A **price** belongs to a terminated route and is a schedule over payload length (ADR 0065): flat when it has no slope, otherwise `price + pricePerKib * ceil(sealedBytes / 1024)`. The metered quantity is the **sealed** payload the PREPARE carries. Prices are in the settlement token's smallest unit — USDC is 6-decimal, so `1_000_000` is one dollar.
- **The cap.** The live bound on one packet is the **cap**: the largest amount the connector will forward to one peer in a single packet. Over it is `T04`, never a split, and the **reject's message states the current cap** — that is the only way a sender learns it, because caps are per-peer and are never published in advance (ADR 0049). Say **cap**, never "ceiling".
- **Peering.** A peering is a counterparty key, a carriage to reach it on, a fee and a cap. An **operator** creates one — in the config file, or through the operator surface with `POST /peers { id, url, fee, max_packet_amount }`, which reads the counterparty's self-description at that URL, derives the channel, opens it if absent and writes a durable runtime peering (ADR 0058). Identity is trust-on-first-use: whoever the URL answers as is who the peering is with. A peering **cannot be bought** (ADR 0043), learned, earned or announced into existence.
- **Error handling.** Returns ILPv4 rejects, and a reject is an answer rather than an exception — a client sees `{ fulfilled: false }`, never a throw. The codes that bind where a sender must act differently (ADR 0051): `F03` INVALID_AMOUNT when the claim does not cover the charge — this is underpayment, and there is no `F04`; `T04` over the peering's cap, with the cap in the message; `R01` for RFC 0027's own case only, where this hop's fee alone exceeds the arriving amount; `F02` when nothing routes that name; `T01` when the peer was not there.
- **Settlement.** Redeems claims on-chain through EVM and Solana settlement crates.
- **Keys and configuration.** The connector holds a **signer and no wallet** (ADR 0012) and takes **no mnemonic anywhere**. It is configured by **one typed TOML file with no environment layer** (ADR 0009) — there is no env-var tier to fall back on and no partial override.
- **Operator surface.** Reads are split from writes (ADR 0008); the surface serves a `/dashboard` page that signs writes in the operator's browser. Say **operator surface**, never "admin" or "control plane".

## Retired — do not restate any of these as live

- **Exposure** and its machinery: retired, not restated (ADR 0033). Do not describe a connector as tracking exposure.
- **Ceiling**: retired as a word. The live bound on one packet is the **cap**, above.
- **Minimum delivery**: retired (ADR 0057). Once a packet carries its own covering claim, a floor check returns the sender nothing; what bounds erosion is the claim itself. `R01` survives, but only in RFC 0027's own meaning.
- **The raw-TCP peer wire**: deleted (ADR 0027). Connectors peer over BTP or HTTP. Say **peer carriage** for where the bytes ride and **peer role** for what the interaction means; do not say "peer wire".
- **Purchasable peering**: removed (ADR 0043). There is no route whose work is buying a peering.
- **The `kind:10032` announce**: removed (ADR 0046). A connector needs no relay, and there is no `IlpPeerInfo`, no `/health` price endpoint, no `basePricePerByte` and no `feePerByte`.
- **`g.proxy…`**: dead addressing. The live names are `g.toon.relay`, `g.toon.store` (also reachable as `g.toon.relay.store`) and `g.toon.gas`; nothing answers at `g.toon` itself. An ILP address is self-asserted — a claim, not a grant — and nothing allocates one.

## The compliance contract that actually matters

For TOON, the binding "requirements" are not the abstract RFC. They are, in order:

- **The ADRs in `docs/adr/`**, which are scoped as protocol law and bind every implementation, not just this one.
- **The vectors in `vectors/`** — normative where prose is not (ADR 0021). A behavioural rule is normative prose only until its vector lands (ADR 0045).
- **`CONTEXT.md`**, which fixes the vocabulary above and marks the words that are banned.

Point users at these for "what must a TOON connector do / what changed," rather than the generic RFC-0034 text.

## Common Topics
- The Rust connector as the reference implementation, and its ADRs as protocol law
- Answering versus announcing: `GET /ilp` self-description, and the greeting on a priced route
- Routing/forwarding precedence, claim validation, peering fees, route prices, the cap
- Reject codes and what each one tells a sender to do differently
- Operator-created peering from a URL, and why it cannot be bought
- One typed TOML file, a signer and no wallet, no mnemonic
