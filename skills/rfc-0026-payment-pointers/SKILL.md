---
name: rfc-0026-payment-pointers
description: How TOON Protocol relates to Interledger RFC 0026 - Payment Pointers. Use when users ask whether TOON uses payment pointers, what a TOON "address" is, how to address a TOON node, or how user-facing addressing differs from vanilla Interledger. Also covers generic payment-pointer format/resolution questions. Triggers on 'payment pointer', '$paymentpointer', 'TOON address', or 'how do I address a TOON node'.
---

# RFC 0026: Payment Pointers — and why TOON does not use them

A payment pointer (`$example.com/alice`) is a human-friendly handle that resolves over HTTPS to an SPSP endpoint, giving a sender the receiver's ILP details.

## How TOON uses / diverges from this RFC

**TOON has no payment pointers.** There is no `$`-prefixed handle and no HTTPS payment-pointer resolution anywhere in production. Because TOON also skips SPSP (`rfc-0009`), the entire payment-pointer → SPSP resolution chain is absent. TOON addresses things two ways instead:

- **ILP addresses** identify the routing destination. The apex connector is `g.proxy`; child nodes resolve under it — e.g. the relay is `g.proxy.town`, with store/mill children alongside. These are hierarchical `g.*` addresses routed by longest-prefix match (see `rfc-0015`). This is what a client puts in a packet's `destination`.
- **Nostr identity (npub / hex pubkey)** identifies *who* an actor is — the publisher of an event, a DVM provider, a swap counterparty. Identity is a secp256k1 keypair, not a URL.
- **Discovery** of a node's ILP address + reachable endpoints is via **kind:10032** peer-info events on the relay (free reads), not via resolving a pointer.

## What to tell a user asking "what's the payment pointer for…?"

There isn't one. To pay a TOON node:
- use its **ILP address** (`g.proxy.town` for the default relay) as the packet destination, and
- find that address by reading the apex's **kind:10032** advertisement.
To attribute content to a person, use their **npub/pubkey**, not an address.

## Common Topics
- Why TOON has no payment pointers (no SPSP chain — see `rfc-0009`)
- ILP addresses (`g.proxy`, `g.proxy.town`) as routing destinations
- Nostr npub/pubkey as actor identity
- kind:10032 peer-info as the discovery mechanism
