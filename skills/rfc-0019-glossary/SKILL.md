---
name: rfc-0019-glossary
description: Glossary of Interledger (RFC 0019) and TOON Protocol terms. Use when users ask "what is" / "define" for a TOON or ILP term - apex, child, claim, balance proof, free-forward, relay/store/swap, kind:10032, connector, BTP, settlement - or need clarification on protocol terminology. Triggers on 'what is', 'define', 'terminology', 'glossary', or an unclear TOON/ILP term.
---

# RFC 0019: Interledger + TOON Glossary

Authoritative definitions for the terms an agent meets working with TOON Protocol — the standard RFC-0019 ILP vocabulary plus TOON-specific terms.

## TOON-specific terms

- **TOON Protocol** — pay-to-write Nostr over Interledger. A write is an ILP packet carrying a TOON-encoded Nostr event plus a signed payment-channel claim; reads are free.
- **Apex** — a deployment's connector, nodeId `g.proxy`. The parent of the child service nodes. Owns the BTP port, validates claims, takes a fee, routes by ILP address.
- **Child** — a service node under the apex: **relay** (Nostr relay, pay-per-publish), **store** (NIP-90 compute; only kind:5094 Arweave blob storage is deployed), **swap** (multi-chain swap peer). Registered `relation:'child'`, tags the apex as parent.
- **The proxy** — the connector acting as the proxy-server layer: the apex connector (nodeId `g.proxy`) plus its co-located backend nodes (relay/store/swap containers). There is no separate operator product — the proxy *is* the connector at the edge.
- **Claim / payment-channel claim** — a signed off-chain **balance proof** (EIP-712 / Ed25519 / Pallas) asserting a monotonic `nonce` and cumulative `transferredAmount` against an on-chain channel deposit. TOON's unit of payment; sent over BTP as the `payment-channel-claim` sub-protocol.
- **Balance proof** — synonym for the claim; the signed assertion of how much has been transferred on a channel.
- **Free-forward** — the apex forwarding a packet to its own child without a per-packet claim (parent→child carries no claim; settled in aggregate).
- **Nonce watermark** — the monotonic per-channel counter that must never go backwards; a regressed nonce invalidates the proof. The client daemon persists it.
- **kind:10032** — Nostr ILP peer-info event; a node's advertisement of its ILP address + reachable BTP/HS endpoints. TOON's discovery mechanism (replaces SPSP/payment pointers).
- **kind:10035** — SkillDescriptor event advertising a DVM/service node's capabilities + pricing.
- **kind:5094** — the Arweave blob-storage DVM job; the only deployed TOON DVM kind.
- **ATOR / `.anon`** — optional hidden-service transport wrapping the BTP WebSocket for network-location privacy.

## Standard ILP terms (as used in TOON)

- **Connector** — a node that receives ILP packets and forwards them toward their destination. TOON's connector is `@toon-protocol/connector` (the apex).
- **ILP address** — hierarchical `g.*` routing identifier (e.g. `g.proxy.relay`); routed by longest prefix.
- **BTP** — Bilateral Transfer Protocol (RFC 0023); TOON's session + inter-connector ILP transport, over WebSocket. (The one-shot edge ingress is **ILP-over-HTTP**, `rfc-0035`, with an HTTP→BTP upgrade.)
- **PREPARE / FULFILL / REJECT** — the ILPv4 packet lifecycle. FULFILL = accepted, REJECT = refused (with an error code like F06/T04).
- **Settlement** — moving the cleared off-chain balance on-chain; in TOON, in-process per-chain providers redeeming claims (`claimFromChannel`).
- **Clearing** — the off-chain accrual of signed claims before settlement.
- **Peer / parent / child** — the `relation` of a configured peer governing how claims flow (see `rfc-0032`).

## Notably absent terms (don't assume they apply to TOON)

SPSP, payment pointer, STREAM, STREAM receipt, and on-chain HTLC escrow — see `rfc-0009`, `rfc-0026`, `rfc-0029`, `rfc-0039`, `rfc-0022` for why each is absent from TOON's pay path. **Present, by contrast** (don't list these as absent): **ILP-over-HTTP** (`rfc-0035`, the one-shot edge ingress + HTTP→BTP upgrade) and packet-level **execution-condition/fulfillment** (active under NIP-59 claim-wrapping).

## Common Topics
- TOON terms: apex, child, claim, balance proof, free-forward, nonce watermark
- TOON kinds: 10032, 10035, 5094
- Standard ILP: connector, ILP address, BTP, PREPARE/FULFILL/REJECT, clearing/settlement
- Which classic ILP terms do NOT apply to TOON
