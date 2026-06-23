---
name: rfc-0001-interledger-architecture
description: How TOON Protocol maps onto the Interledger architecture (RFC 0001). Use when users ask how TOON works end-to-end, the apex/child topology, the connector's role, how pay-to-write/free-read maps to ILP layers, or how TOON's stack (BTP + payment-channel claims + multi-chain settlement + Nostr/TOON codec) composes. Also covers generic ILP architecture, protocol layers, and connector-design questions. Triggers on 'how Interledger works', 'ILP architecture', 'TOON architecture', 'apex', 'connector', or 'protocol stack'.
---

# RFC 0001: Interledger Architecture, mapped to TOON

Implements the RFC 0001 layered model as the foundation of TOON Protocol: **pay-to-write Nostr over Interledger**. This skill explains how TOON's concrete stack maps onto ILP's Application / Transport / Interledger / Ledger layers.

## How this maps to TOON

| ILP layer (RFC 0001) | Generic role | TOON's implementation |
| --- | --- | --- |
| **Application** | App-level intent / setup | A Nostr event (the thing being published) encoded with the **TOON codec**. Service discovery is **Nostr kind:10032 peer-info**, not SPSP (`rfc-0009`). |
| **Transport** | End-to-end value delivery | **One BTP WebSocket packet per write** carrying a signed `payment-channel-claim`. TOON does **not** use STREAM (`rfc-0029`) — no chunking/flow-control/quoting. |
| **Interledger** | Packet routing across connectors | ILPv4 PREPARE/FULFILL/REJECT (`rfc-0027`), routed by `g.*` ILP address (`rfc-0015`). |
| **Ledger** | Settlement on an underlying ledger | **In-process multi-chain payment-channel providers** (EVM / Solana / Mina) redeeming signed claims on-chain. Not the RFC-0038 separate settlement-engine process (`rfc-0038`). |

## TOON's actual topology

- **Apex = the connector** (`@toon-protocol/connector`), nodeId `g.proxy`. It owns the BTP port, validates claims, takes a fee, and routes by ILP address.
- **Children** = service nodes under the apex: **town** (the Nostr relay, pay-per-publish), **dvm** (NIP-90 compute; the only deployed kind is 5094 Arweave blob storage), **mill** (multi-chain swap peer). Each is registered `relation:'child'` and tags `g.proxy` as its parent.
- **Clients** pay the apex over BTP with a signed balance-proof claim; the apex validates, takes its fee, and **forwards to the child for free** (parent→child packets carry no per-packet claim — settled in aggregate).

## The core mental model

- **Write = pay.** ILP packet + signed payment-channel **claim** (an EIP-712 / Ed25519 / Pallas balance proof against an on-chain channel deposit) over BTP → connector validates → FULFILL or REJECT. Cost scales with encoded byte size.
- **Read = free.** NIP-01 subscriptions over the same link, no claim.
- **Settlement is off-chain + threshold.** Each write advances a monotonic nonce + cumulative amount; the connector redeems on-chain only when a threshold is crossed.

## What TOON deliberately omits from the classic ILP stack

TOON's value layer is the signed channel claim, so several classic ILP pieces are **absent from the pay path**: SPSP (`rfc-0009`), payment pointers (`rfc-0026`), and STREAM / STREAM receipts (`rfc-0029`/`rfc-0039`). Two caveats often misremembered: **ILP-over-HTTP (`rfc-0035`) IS used** — as the one-shot edge ingress (`POST /ilp`) with an HTTP→BTP upgrade, alongside BTP; and while there is **no on-chain HTLC escrow (`rfc-0022`)**, multi-hop *does* use packet-level **execution-condition/fulfillment** (active when NIP-59 claim-wrapping is enabled). When reasoning about TOON, don't assume the genuinely-absent pieces are present.

## Common Topics
- The apex (`g.proxy`) + town/dvm/mill child topology
- How pay-to-write / free-read maps to ILP's four layers
- Claims-over-BTP as the value layer; in-process multi-chain settlement
- Why SPSP/STREAM and on-chain HTLC escrow are not in TOON's stack; how ILP-over-HTTP and packet-level execution-conditions *are* used
- The free parent→child forward (apex model)
