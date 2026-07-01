# TOON Protocol — Context

**Start here.** This is the curated, agent-loadable context for the TOON Protocol. It replaces the old `project-context.md` (which was a BMAD planning dump). For depth, see the sibling docs in this folder and the protocol docs in [`../docs/`](../docs/).

## What TOON is (30-second model)

TOON Protocol = **pay-to-write Nostr over Interledger (ILP)**. Reads are free; a *write* is an ILP packet carrying a **TOON-encoded Nostr event** plus a **signed off-chain payment-channel claim** (a balance proof against an on-chain deposit). A **connector** validates the claim, takes a fee, routes by ILP address over **BTP** (WebSocket), and the destination node returns **FULFILL** (accepted) or **REJECT**.

Guiding thesis: **"sending a message and sending money are the same action."** Every monetized flow is a single packet that carries both the message and its payment.

## The three service-node types (what you can pay for)

- **relay** — the Nostr relay; pay-per-event publish (kind:1 and any NIP).
- **store** — NIP-90 **Arweave DVM** (kind:5094): pay to store a blob permanently; the FULFILL returns the Arweave tx id.
- **swap** — multi-chain swap peer: pay asset A, receive a signed target-chain claim redeemable for asset B (EVM / Solana / Mina).

Operators run the **connector as a proxy-server layer** — the apex (nodeId `g.proxy`) sitting in front of child relay/swap/store containers. Clients pay the proxy over BTP; it validates, fees, and **free-forwards** to the child.

## Current state (2026-06)

The codebase was a single monorepo; it is being split into **per-team repos** (see [`repos.md`](./repos.md)). Code is shared via **npm** (semver); deployment composition via **pinned Docker image digests**. The ILP payment engine is the separate **connector** repo.

A **shared devnet** runs on **four dedicated Linode nodes** (one per chain + TOON connector) under `*.devnet.toonprotocol.dev` (Porkbun DNS, trusted Let's Encrypt TLS — no `NODE_TLS_REJECT_UNAUTHORIZED` needed):

| Endpoint | Node |
|----------|------|
| `https://evm-rpc.devnet.toonprotocol.dev` | Anvil, chain-id 31337, USDC `0x5FbDB2…` |
| `https://solana-rpc.devnet.toonprotocol.dev` | solana-test-validator, USDC `H8HSre…` |
| `https://mina.devnet.toonprotocol.dev/graphql` | Mina lightnet (o1labs/mina-local-network) |
| `wss://relay-ws.devnet.toonprotocol.dev` | Nostr relay (free read) |
| `https://proxy.devnet.toonprotocol.dev` | TOON connector ILP ingress (`g.proxy.relay`) |
| `https://faucet.devnet.toonprotocol.dev` | Multi-chain faucet |

Managed by `connector/infra/devnet-manage.sh` (`feat/devnet-multi-node` branch) or the `/deploy-devnet` Claude Code skill. See [deployment.md → Linode Devnet](../docs/deployment.md#linode-devnet--live).

## How to use this repo (toon-meta)

- **Shared agent skills** — installable as a Claude Code plugin: `/plugin marketplace add toon-protocol/toon-meta` → `/plugin install toon-skills@toon-meta`. (Product skills ship in `toon-client`.)
- **Context** — this `context/` folder: [architecture](./architecture.md) · [repos](./repos.md) · [decisions](./decisions.md) · [glossary](./glossary.md).
- **Deep protocol docs** — [`../docs/`](../docs/) (protocol.md, settlement.md, architecture.md, guides).

## What TOON deliberately does NOT use

TOON uses its own **signed payment-channel claim** protocol — **not** ILP's SPSP, STREAM, or payment-pointers. Claims ride over **BTP/WebSocket** (duplex sessions + peering) **and ILP-over-HTTP** (`POST /ilp`, the one-shot edge ingress, with an HTTP→BTP upgrade). Multi-hop atomicity uses packet-level execution-condition/fulfillment (no on-chain HTLC escrow). Settlement is **in-process multi-chain**, not a separate settlement-engine service. See [decisions.md](./decisions.md), [payment proxy](../docs/payment-proxy.md), and the `rfc-*` skills for the per-RFC rationale.
