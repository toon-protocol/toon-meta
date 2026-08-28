---
name: rfc-0033-relationship-between-protocols
description: How TOON Protocol's layers compose, framed against Interledger RFC 0033 - Relationship Between Protocols. Use when users ask how TOON's pieces fit together, the layer stack (payload -> seal -> ILP packet -> carriage + claim -> connector -> app), which ILP protocols TOON does/doesn't use, or how the protocols interact end-to-end. Also covers generic ILP protocol-composition questions. Triggers on 'protocol relationship', 'protocol layers', 'how do TOON protocols interact', or 'TOON stack'.
---

# RFC 0033: Relationship Between Protocols — TOON's live composition

RFC 0033 explains how ILP's protocols layer and compose. This skill describes TOON's *actual* composition, which deliberately uses some ILP layers and omits others.

## TOON's live layer stack (top to bottom)

```
The payload (a signed Nostr event, or any HTTP-shaped request body)
        │  the client seals it to the terminating connector's key
        ▼
ILP PREPARE `data`  (the sealed payload — this is also what gets metered)
        │  ILPv4 PREPARE/FULFILL/REJECT (rfc-0027, in TOON's dialect), OER-encoded (rfc-0030)
        ▼
The packet carries its own covering claim
        │  carriage: ILP-over-HTTP over https (rfc-0035) or BTP over wss (rfc-0023)
        ▼
Connector  — validates the claim, takes its per-packet peering fee, routes by ILP address (rfc-0015)
        │  peer carriage to the next connector: BTP or HTTP
        ▼
Terminating connector — charges the route's price, derives the fulfilment,
        unseals the payload and hands the request to its app
        │  threshold on-chain settlement, EVM and Solana (rfc-0038)
        ▼
Claims redeemed on chain
```

Live destinations at the bottom of that stack are `g.toon.relay`, `g.toon.store` (also reachable as `g.toon.relay.store`) and `g.toon.gas`. Nothing answers at `g.toon` itself, and an ILP address is self-asserted — a claim, not a grant.

## What composes, and what is NOT in the stack

**Present:** the application payload and its seal, the ILPv4 packet layer, OER for the packet, both carriages (ILP-over-HTTP and BTP) with a covering claim on every packet, connector routing, in-process multi-chain settlement.

**Absent (do not assume they compose into TOON):**
- **SPSP** (`rfc-0009`) — a connector answers rather than announces: its identity, its settlement facts and every route's price come from its free, unauthenticated self-description at `GET /ilp`. An unpaid request to a priced route gets a **greeting** carrying that route's terms.
- **Payment pointers** (`rfc-0026`) — ILP addresses instead.
- **STREAM** (`rfc-0029`) — one write = one packet + one claim; no chunking, flow control or quoting. What a path costs is discovered by probing it, and what a route costs is published on the self-description.
- **STREAM receipts** (`rfc-0039`) — proof is the signed claim plus the FULFILL and the on-chain channel state.
- **HTLC** (`rfc-0022`) — the terminating connector derives the fulfilment from the packet; there is no hash-lock negotiation, and the claim is the proof.

**Retired — do not restate as live:** discovery by `kind:10032` announce, `IlpPeerInfo`, a `/health` price endpoint, `basePricePerByte`, `feePerByte`, exposure and its ceiling, minimum delivery, and the raw-TCP peer wire. The `g.proxy…` address space is dead. Prices are never per-byte: a **fee** is flat per packet and belongs to the peering, and a **price** belongs to a terminated route as a schedule over the sealed payload's length, charged per kibibyte.

So TOON's composition is: **application payload (sealed) + value (the covering claim on every packet) + interledger (ILPv4 routing over HTTP or BTP carriage) + ledger (multi-chain settlement)** — with the classic SPSP/STREAM/HTLC transport-and-setup tier replaced by ask-the-node discovery and single-packet claims.

## Common Topics
- The end-to-end TOON layer diagram (payload → seal → packet + claim → carriage → connector → app → settlement)
- Which ILP protocols TOON uses vs omits, with cross-refs
- Why the value layer is the claim, not STREAM or an HTLC
- Discovery by asking a connector (`GET /ilp`, and the greeting) rather than SPSP or payment pointers
