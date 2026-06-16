---
name: rfc-0030-notes-on-oer-encoding
description: How TOON Protocol relates to Interledger RFC 0030 - OER Encoding. Use when users ask about TOON's binary encoding, OER/ASN.1 encoding of ILP packets, the difference between ILP-packet OER and the TOON event codec, or how a Nostr event is serialized into a packet. Also covers generic OER, ASN.1, and binary-serialization questions. Triggers on 'OER', 'octet encoding', 'ASN.1', 'TOON codec', or 'how is the event encoded'.
---

# RFC 0030: OER Encoding on TOON

RFC 0030 describes Canonical Octet Encoding Rules (OER, an ASN.1 binary encoding) used to serialize ILP packets. TOON uses OER for ILP packets, but it is important not to confuse it with TOON's own event codec.

## Two distinct encodings on TOON

1. **ILP-packet OER** — the wire format of the ILPv4 PREPARE/FULFILL/REJECT packet itself (the standard RFC-0030 encoding). The connector's canonical ILP packet codec is delegated to **`@toon-protocol/shared`**; the connector also keeps a minimal local OER parser (`encoding/oer-parser.ts`) for the bits it inspects directly. As a skill author/agent you rarely touch this layer — the SDK/shared library handles it.

2. **The TOON event codec** — a *separate* encoding that serializes the Nostr event (and its fields) into the **`data` field carried inside** the ILP packet. This is the "TOON-encoded Nostr event." It is the **TOON codec**, not ILP-packet OER. When a relay returns events, EVENT messages come back as **TOON-format strings**, decoded with the TOON decoder (see `nostr-protocol-core`'s `toon-protocol-context.md`).

The mental model: `Nostr event → (TOON codec) → packet data → (OER) → ILP packet bytes → BTP frame`. OER wraps the packet; the TOON codec wraps the event inside it.

## What to tell a user asking about encoding

- "How is the ILP packet encoded?" → OER/ASN.1, handled by `@toon-protocol/shared` (you don't hand-roll it).
- "How is my Nostr event encoded / why isn't the relay returning JSON?" → the **TOON codec**, not OER; decode with the TOON decoder.
- Cost scales with the **encoded byte size** of the event (the TOON-codec output), which is why concise events are cheaper.

## Common Topics
- ILP-packet OER (`@toon-protocol/shared` codec; local `encoding/oer-parser.ts`)
- The distinct TOON event codec for the packet's `data` payload
- Why relay EVENT responses are TOON strings, not JSON
- Encoded byte size → per-byte write cost
