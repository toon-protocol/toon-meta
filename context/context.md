# TOON Protocol — Context

**Start here.** This is the curated, agent-loadable context for the TOON Protocol. It replaces the old `project-context.md` (which was a BMAD planning dump). For depth, see the sibling docs in this folder and the protocol docs in [`../docs/`](../docs/).

## What TOON is (30-second model)

TOON Protocol = **pay-to-write Nostr over Interledger (ILP)**. Reads are free; a *write* is an ILP packet carrying a **TOON-encoded Nostr event** plus a **signed off-chain payment-channel claim** (a balance proof against an on-chain deposit). A **connector** validates the claim, takes a fee, routes by ILP address over **BTP** (WebSocket), and the destination node returns **FULFILL** (accepted) or **REJECT**.

Guiding thesis: **"sending a message and sending money are the same action."** Every monetized flow is a single packet that carries both the message and its payment.

## The three service-node types (what you can pay for)

- **relay** — the Nostr relay; pay-per-event publish (kind:1 and any NIP).
- **store** — NIP-90 **Arweave DVM** (kind:5094): pay to store a blob permanently; the FULFILL returns the Arweave tx id.
- **swap** — multi-chain swap peer: pay asset A, receive a signed target-chain claim redeemable for asset B (EVM / Solana / Mina).

Operators run a **hub** (apex) = the connector (nodeId `g.townhouse`) + child relay/swap/store containers. Clients pay the hub over BTP; it validates, fees, and **free-forwards** to the child.

## Current state (2026-06)

The codebase was a single monorepo; it is being split into **per-team repos** (see [`repos.md`](./repos.md)). Code is shared via **npm** (semver); deployment composition via **pinned Docker image digests**. The ILP payment engine is the separate **connector** repo.

## How to use this repo (toon-meta)

- **Shared agent skills** — installable as a Claude Code plugin: `/plugin marketplace add toon-protocol/toon-meta` → `/plugin install toon-skills@toon-meta`. (Product skills ship in `toon-client`/`hub`.)
- **Context** — this `context/` folder: [architecture](./architecture.md) · [repos](./repos.md) · [decisions](./decisions.md) · [glossary](./glossary.md).
- **Deep protocol docs** — [`../docs/`](../docs/) (protocol.md, settlement.md, architecture.md, guides).

## What TOON deliberately does NOT use

TOON uses its own **signed payment-channel claim** protocol over BTP — **not** ILP's SPSP, STREAM, payment-pointers, HTLCs, or ILP-over-HTTP. Settlement is **in-process multi-chain**, not a separate settlement-engine service. See [decisions.md](./decisions.md) and the `rfc-*` skills for the per-RFC rationale.
