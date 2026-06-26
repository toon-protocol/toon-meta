---
name: rfc-0033-relationship-between-protocols
description: How TOON Protocol's layers compose, framed against Interledger RFC 0033 - Relationship Between Protocols. Use when users ask how TOON's pieces fit together, the layer stack (Nostr event -> TOON codec -> ILP packet -> BTP + claim -> connector -> child), which ILP protocols TOON does/doesn't use, or how the protocols interact end-to-end. Also covers generic ILP protocol-composition questions. Triggers on 'protocol relationship', 'protocol layers', 'how do TOON protocols interact', or 'TOON stack'.
---

# RFC 0033: Relationship Between Protocols — TOON's live composition

RFC 0033 explains how ILP's protocols layer and compose. This skill describes TOON's *actual* composition, which deliberately uses some ILP layers and omits others.

## TOON's live layer stack (top to bottom)

```
Nostr event (the thing published)
        │  TOON event codec
        ▼
ILP packet `data`  (TOON-encoded event)
        │  ILPv4 PREPARE/FULFILL/REJECT  (rfc-0027), OER-encoded (rfc-0030)
        ▼
BTP MESSAGE  +  payment-channel-claim sub-protocol  (rfc-0023)
        │  WebSocket  (optionally over ATOR `.anon`)
        ▼
Connector / apex (g.proxy)  — validates claim, takes fee, routes by ILP address (rfc-0015)
        │  free parent→child forward  (rfc-0032)
        ▼
Child node: town (relay) / dvm (kind:5094) / swap
        │  threshold on-chain settlement, in-process EVM/Solana/Mina (rfc-0038)
```

## What composes, and what is NOT in the stack

**Present:** Nostr/TOON codec (application + serialization), ILPv4 packet layer, OER for the packet, BTP transport + the `payment-channel-claim` sub-protocol (value), connector routing, in-process multi-chain settlement.

**Absent (do not assume they compose into TOON):**
- **SPSP** (`rfc-0009`) — discovery is kind:10032, not SPSP.
- **Payment pointers** (`rfc-0026`) — ILP addresses + npub instead.
- **STREAM** (`rfc-0029`) — one write = one packet + one claim; no chunking/flow-control/quoting.
- **STREAM receipts** (`rfc-0039`) — proof is the signed claim + on-chain state + FULFILL.
- **HTLC** (`rfc-0022`) — condition/fulfillment are placeholders; the claim is the proof.
- **ILP-over-HTTP** (`rfc-0035`) — BTP/WebSocket only.

So TOON's composition is: **application (Nostr/TOON codec) + value (signed channel claim over BTP) + interledger (ILPv4 routing) + ledger (in-process multi-chain settlement)** — with the classic SPSP/STREAM/HTLC transport-and-setup tier replaced by Nostr discovery + single-packet claims.

## Common Topics
- The end-to-end TOON layer diagram (event → codec → packet → BTP+claim → connector → child → settlement)
- Which ILP protocols TOON uses vs omits, with cross-refs
- Why the value layer is the claim, not STREAM/HTLC
- Discovery via Nostr (kind:10032/10035) rather than SPSP/pointers
