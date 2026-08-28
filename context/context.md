# TOON Protocol — Context

**Start here.** The curated, agent-loadable context for the TOON Protocol. For depth, see the sibling docs in this folder and the protocol docs in [`../docs/`](../docs/). **Protocol law is not restated here** — it lives in the connector repo ([`CONTEXT.md`](https://github.com/toon-protocol/connector/blob/main/CONTEXT.md), [`docs/adr/`](https://github.com/toon-protocol/connector/blob/main/docs/adr/README.md)); this folder is the **cross-repo map**.

## What TOON is (30-second model)

TOON is **payment as a reverse proxy**. A **connector** terminates payments the way nginx terminates SSL: value arrives wrapped in a protocol the service never speaks, and at the last hop the connector unwraps it, verifies it, and hands the service ordinary HTTP that was already paid for. Exactly two roles — **connector** and **app**. A packet carries its own **covering claim**, so nothing is owed between packets, and no separate invoice/settle round-trip exists.

Guiding thesis: **"sending a message and sending money are the same action."**

**Pay-to-write Nostr is one application of this, not its definition.** It is the one the fleet runs: the relay app behind a connector, so a *write* is a paid packet carrying a TOON-encoded Nostr event and reads stay free.

## The apps you can pay for

- **relay** — the Nostr relay; a paid packet per published event (kind:1 and any NIP).
- **store** — NIP-90 Arweave DVM (kind:5094): pay to store a blob permanently; the FULFILL returns the Arweave tx id.
- **gas-station** — kind:5096 (Solana fee-payer co-sign) / kind:5098 (EVM ERC-2771 relay): pay in what you hold to get a transaction landed on a chain you hold no gas for.
- **swap** — multi-chain swap peer: pay asset A, receive a signed target-chain claim redeemable for asset B.

Each runs its **own** connector in front of it, from its **own** repo's `deploy/` bundle. There is no apex and no parent/child: a hop between two nodes is a **peering** an operator wrote down (`POST /peers`, connector ADR 0058), and every hop takes its peering's flat per-packet fee (ADR 0061).

## Current state (2026-08)

Polyrepo (see [`repos.md`](./repos.md)). The connector publishes **no npm package** — one static Rust binary and the image `ghcr.io/toon-protocol/connector:rust-main`; each node repo **pins** a dated release handle in exactly one guarded place in its own `deploy/` (ADR 0068). Configuration is **one typed TOML file with no environment-variable layer** (ADR 0009).

Devnet is **four boxes and no apex** — the apex (`toon`, `104.237.150.177`) was destroyed 2026-08-14. Relay and store were re-deployed 2026-08-27 from their own repos' `deploy/` bundles, and the gas box was stood up the same day from `gas-station`'s; the relay box runs Caddy, not nginx. Settlement is on **public chains only**: Base Sepolia (`evm:84532`) and Solana devnet. Mina left the connector repository (ADR 0065-mina), though a claim declaring `blockchain: "mina"` is still refused by name.

| Endpoint | What |
|----------|------|
| `wss://relay-ws.devnet.toonprotocol.dev` | Nostr relay app — free reads, never touches a connector |
| `https://proxy.relay.devnet.toonprotocol.dev/ilp` | relay box connector — self-description; terminates `g.toon.relay`, price `1` |
| `wss://proxy.relay.devnet.toonprotocol.dev/ilp/btp` | the same node's BTP carriage |
| `https://proxy.ario.devnet.toonprotocol.dev/ilp` | store box (`ario`) connector — terminates `g.toon.store` and `g.toon.relay.store`, price `base = 1000, per_kib = 10` |
| `https://proxy.gas.devnet.toonprotocol.dev/ilp` | gas box connector — terminates `g.toon.gas` and `g.toon.relay.gas`, price `1000` |
| `https://faucet.devnet.toonprotocol.dev` | faucet box — **USDC only, two chains** (`/api/base-sepolia/request`, `/api/solana/usdc-request`) |

Dead: `proxy.devnet.toonprotocol.dev` (the apex) answers nothing, and `dvm.devnet.toonprotocol.dev` resolves to the store box but is not served — use `proxy.ario.…`. The faucet's SOL leg and both Mina legs are deleted. kind:5096/5098 moved out of `store` into the **gas-station** repo (2026-08-27).

Chain endpoints, tokens and program ids are hand-maintained in [`connector/infra/linode/endpoints.json`](https://github.com/toon-protocol/connector/blob/main/infra/linode/endpoints.json) — the canonical answer to "what does a TOON node point at on devnet". A node's own live figures are on its **self-description**; ask the node, don't guess.

## How to use this repo (toon-meta)

- **Shared agent skills** — installable as a Claude Code plugin: `/plugin marketplace add toon-protocol/toon-meta` → `/plugin install toon-skills@toon-meta`. (Product skills ship in `toon-client`.)
- **Context** — this `context/` folder: [architecture](./architecture.md) · [repos](./repos.md) · [contracts](./contracts.md) · [decisions](./decisions.md) · [glossary](./glossary.md).
- **Deep protocol docs** — the connector repo. Anything here that contradicts it is a bug here.

## What TOON deliberately does NOT use

Its value layer is the **signed payment-channel claim** — not SPSP, STREAM or payment-pointers. Claims ride the two carriages, BTP over `wss://` and ILP-over-HTTP over `https://` (ADR 0027). Multi-hop atomicity is packet-level condition/fulfilment; there is no on-chain HTLC escrow. The packet is **TOON's dialect, not RFC 0027's** — ILPv4 semantics, TOON encoding, not byte-compatible, ratified deliberately (ADR 0063), with `condition = sha256(fulfilment)`. Settlement is in-process, deliberate and thresholdless.
