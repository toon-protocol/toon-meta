# TOON System Architecture

System- and repo-level architecture — toon-meta's own value is the **cross-repo map**. Protocol law is not restated here: it lives in [`connector/CONTEXT.md`](https://github.com/toon-protocol/connector/blob/main/CONTEXT.md) and [`connector/docs/adr/`](https://github.com/toon-protocol/connector/blob/main/docs/adr/README.md), which this file cites rather than paraphrases.

## Layers

```
connector (own repo)  ── a paid reverse proxy: it terminates payments the way nginx
     ▲                    terminates SSL. One static Rust binary, one OCI image.
     │ pinned by release handle in each node repo's own deploy/ (ADR 0068)
     │
relay · store · swap · gas-station  ── apps: payment-oblivious HTTP origin servers,
     ▲                                  each its own repo + image
     │ npm semver
toon = core + sdk · toon-client  ── libraries + the client implementations
```

Exactly **two roles**, **connector** and **app**. There is no third.

- **connector** — routing, peering, claim verification, pricing, route termination, settlement, operator surface. Publishes **no npm package**: `ghcr.io/toon-protocol/connector:rust-main` plus dated release handles. Configured by **one typed TOML file with no environment-variable layer** — the only env var read is `RUST_LOG` (ADR 0009). There is no `PROXY_*`.
- **apps** — relay (Nostr), store (Arweave, kind:5094), gas-station (kind:5096/5098), swap. Ordinary HTTP servers; none holds a channel, verifies a claim, or is told which destination was addressed.
- **toon / toon-client** — the TOON event codec, and the clients that build packets, sign claims and replay the wire vectors.

## Runtime topology (one paid write)

```
client ─(1) PREPARE + covering claim─► connector  (client edge: https://…/ilp or wss://…/ilp/btp)
                                       verifies the claim, charges this route's price
   ┌───────────────────────────────────┘
   │ (2) each further hop is a PEERING an operator wrote down. The sending connector
   │     mints a covering claim for the forwarded value and takes that peering's flat
   │     per-packet fee (ADR 0042, ADR 0061). Nothing is owed between packets.
   ▼
connector (route termination) ─(3) plain HTTP + X-TOON-Payer / X-TOON-Amount / X-TOON-Chain─► app
                              ◄(4) ordinary HTTP response; the terminating connector derives
client ◄─(5) FULFILL / REJECT ─┘     the fulfilment and seals the answer back

unpaid:  a request to a priced route gets a GREETING — that route's terms — never the work.
asking:  GET on a connector's own URL returns its SELF-DESCRIPTION (ADR 0050). Nothing announces.
reads:   client ─Nostr WS (NIP-01, free)─► relay app       (never touches a connector)
payout:  an authenticated operator write, POST /channels/:id/redeem-latest — never on the packet path.
```

## Load-bearing invariants

1. **Claim validation happens only in the connector.** An app receives ordinary HTTP that was already paid for, plus `X-TOON-Payer`/`X-TOON-Amount`/`X-TOON-Chain` when the delivering connector was the one paid (ADR 0040). `localDelivery`, `POST /handle-packet`, `PaymentRequest`, `ConnectorNode`, `ClaimReceiver` and `SettlementMonitor` are **all deleted**.
2. **Every packet carries its own claim** (ADR 0042). No apex, no parent/child, no free-forward, no `relation:'child'`, no `TOON_PARENT_PEER_ID` — and nothing accumulates between packets.
3. **A peering is one operator write**: `POST /peers {id, url, fee, max_packet_amount}`, where `url` is the counterparty's self-description URL; identity is trust-on-first-use (ADR 0058). It cannot be bought (ADR 0043), learned, earned or announced into existence.
4. **An ILP address is self-asserted — a claim, not a grant.** Nothing allocates one; reachability is the only registry. Nothing answers at `g.toon`.
5. **Reads are free** Nostr WS and bypass the payment path entirely.

## Payment model

- **USDC** on two chains: Base Sepolia (`evm:84532`) and Solana devnet. Mina left the connector repository (ADR 0065-mina) — but the connector still **refuses a claim whose `blockchain` is `mina`, by name**: wire behaviour owed to toon-client, not something to clean up.
- A **fee** is flat per packet and attaches to the **peering**, not to a route (ADR 0061). `fee` on a route is a refuse-to-start error.
- A **price** is a **schedule over payload length** — `base + per_kib × ceil(len / 1024)` — flat exactly when the slope is zero (ADR 0065). Never "per-byte": the unit is a kibibyte. Prices are whole counts of the token's smallest unit.
- A **channel is derived from its participants** — sorted pair + token + epoch. No channel identifier is ever exchanged, and there is no shared secret (ADR 0059, ADR 0060).
- **Two peer carriages**: BTP over `wss://` and ILP-over-HTTP over `https://` (ADR 0027). BTP is not "the only transport".
- **Settlement** has no threshold and is never on the packet path: a deliberate, authenticated operator write, `POST /channels/:id/redeem-latest` — this is how you get paid.

## Key event kinds

| Kind | Meaning |
|------|---------|
| 1 | Nostr note (relay app; the connector in front prices the packet) |
| 10035 | Service discovery / SkillDescriptor (pricing) |
| 5094 / 6094 | Arweave blob-storage DVM request / result (store app) |
| 5096 / 5098 | Solana fee-payer co-sign / EVM ERC-2771 relay (gas-station app) |

> **kind:10032 is removed** (ADR 0046, which retires ADR 0030). A connector answers `GET /ilp` with its self-description instead; discovery is never a node's job. Other kinds in older planning docs (5000, 5250, 5260, 5300) are valid NIP-90 examples with no provider on the network.
