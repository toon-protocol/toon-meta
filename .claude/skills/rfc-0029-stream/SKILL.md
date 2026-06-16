---
name: rfc-0029-stream
description: How TOON Protocol relates to Interledger RFC 0029 - STREAM. Use when users ask whether TOON uses STREAM, how TOON sends value (chunking, flow control, quoting), or how a paid write is structured vs a STREAM connection. Also covers generic STREAM, streaming-payment, and transport-layer questions. Triggers on 'STREAM', 'streaming payment', 'payment chunking', 'flow control', or 'quoting on TOON'.
---

# RFC 0029: STREAM — and why TOON does not implement it

STREAM is Interledger's transport protocol: it chunks a large payment into many ILP packets, does flow control / congestion management, quotes exchange rates, and encrypts data end-to-end between sender and receiver.

## How TOON uses / diverges from this RFC

**TOON does NOT implement STREAM.** There is no STREAM connection, no packet chunking, no flow control, and no quoting layer in the connector. TOON's transport model is deliberately simpler:

- **One paid write = one BTP packet + one balance-proof claim.** A write is a single ILPv4 PREPARE over the BTP session (see `rfc-0023`), carrying a TOON-encoded Nostr event in `data` and a signed **payment-channel claim** as the value proof. It is fulfilled or rejected as a unit — there is no multi-packet stream to reassemble.
- **No chunking / flow control.** Because each write is atomic and small (a Nostr event), there is nothing to chunk. Cost scales linearly with the encoded byte size of the event; the client just makes the event concise.
- **No quoting.** STREAM's exchange-rate discovery is irrelevant: the fee is per-byte at the connector's configured rate, and cross-asset conversion only happens explicitly at a **mill** swap node, not implicitly during a write.
- **End-to-end encryption** of the message, when needed, comes from Nostr's own NIP-44/NIP-59 (gift-wrap), not STREAM's encryption — and an optional NIP-59 claim wrapper exists for privacy (see `rfc-0022`).

## What to tell a user expecting STREAM behavior

Don't model a TOON payment as a stream of packets with a quote step. Model it as: build a signed Nostr event → attach one claim → send one BTP packet → get FULFILL/REJECT. For large data, TOON uses the **kind:5094 Arweave DVM** (store the blob, publish a small reference event), not STREAM chunking.

## Common Topics
- Why STREAM is absent on TOON (single-packet, claim-based writes)
- One write = one BTP packet + one payment-channel claim
- No chunking / flow control / quoting; per-byte pricing instead
- Large payloads via the kind:5094 Arweave DVM, not stream chunking
- Relationship to `rfc-0023` (BTP) and `rfc-0039` (no STREAM receipts)
