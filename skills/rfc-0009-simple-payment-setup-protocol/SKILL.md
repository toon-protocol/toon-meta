---
name: rfc-0009-simple-payment-setup-protocol
description: How TOON Protocol relates to Interledger RFC 0009 - Simple Payment Setup Protocol (SPSP). Use when users ask whether TOON uses SPSP, how TOON sets up a payment, how TOON discovers a receiver/service, or how payment setup differs from vanilla Interledger. Also covers generic SPSP, payment-setup, and receiver-info questions. Triggers on 'SPSP', 'payment setup', 'how does TOON set up a payment', or 'how do I find a TOON node'.
---

# RFC 0009: Simple Payment Setup Protocol (SPSP) — and why TOON does not use it

SPSP is the classic Interledger Application-layer protocol: a receiver exposes an HTTPS endpoint (resolved from a payment pointer) that returns its ILP destination address and shared secret, which the sender uses to start a STREAM payment.

## How TOON uses / diverges from this RFC

**TOON does NOT use SPSP for payment setup.** There is no SPSP HTTPS handshake in the pay path. (`facilitator/spsp-client.ts` exists in the connector tree but is imported nowhere in production — it is vestigial and used only in tests.) TOON sets up and discovers payments entirely differently:

- **Discovery = Nostr kind:10032 peer-info events.** Instead of resolving a payment pointer to an SPSP endpoint, a TOON node advertises its ILP address, reachable BTP/HS endpoints, and capabilities in a **kind:10032** event on the relay. Clients read these (free) to find the apex and child nodes. DVM/service capabilities are advertised in **kind:10035** SkillDescriptor events.
- **Setup = open a payment channel + sign claims over BTP.** A client funds an on-chain payment channel (EVM/Solana/Mina), opens a single **BTP WebSocket** session to the apex, and each paid write carries a signed **payment-channel balance-proof claim** (see `rfc-0023`). There is no SPSP receiver-info exchange and no shared-secret negotiation — the on-chain channel and the signed claim ARE the setup.
- **No STREAM follow-on.** SPSP normally bootstraps a STREAM connection; TOON has no STREAM (see `rfc-0029`). One write = one BTP packet + one claim.

## What to tell a user asking "how do I set up a payment on TOON?"

1. Read the apex's **kind:10032** advertisement to learn its ILP address and BTP/`.anon` endpoint (free read).
2. Open / fund a payment channel on the chain you want to pay with.
3. Connect over BTP and publish — the daemon signs the claim automatically (see `toon-client`).

Do not look for a payment pointer or an SPSP `/.well-known` endpoint; TOON has neither in the pay path.

## Common Topics
- Why SPSP is absent from TOON (vestigial `facilitator/spsp-client.ts`)
- kind:10032 peer-info / kind:10035 SkillDescriptor as TOON's discovery layer
- Payment-channel open + signed claim as TOON's "payment setup"
- Relationship to `rfc-0026` (payment pointers), `rfc-0029` (STREAM), `rfc-0023` (BTP)
