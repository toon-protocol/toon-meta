---
name: rfc-0022-hashed-timelock-agreements
description: How TOON Protocol relates to Interledger RFC 0022 - Hashed Timelock Agreements (HTLCs). Use when users ask whether TOON uses HTLCs, how TOON secures a payment, what the ILP condition/fulfillment fields mean on TOON, or how multi-hop payment security works. Also covers generic HTLC, conditional-payment, and cryptographic-escrow questions. Triggers on 'HTLC', 'hashed timelock', 'conditional payment', 'execution condition', or 'how does TOON secure a payment'.
---

# RFC 0022: Hashed Timelock Agreements (HTLCs) — and what TOON uses instead

A classic ILP HTLC secures a multi-hop payment with a hashlock + timelock: each hop holds funds until it sees the preimage of an `executionCondition`, and the FULFILL propagating the preimage settles the chain atomically.

## How TOON uses / diverges from this RFC

**TOON does NOT use classic HTLCs to secure payments.** It uses ILPv4 PREPARE/FULFILL/REJECT framing, but the security model is the **signed payment-channel claim**, not a hash-preimage escrow:

- **`executionCondition` / `fulfillment` are placeholders.** In the normal pay path these fields are zero/placeholder (see `rfc-0027`). The packet is not "unlocked" by revealing a preimage — it is accepted because the attached `payment-channel-claim` is a valid, signed balance proof against an on-chain channel deposit.
- **Security = the claim, not a timelock.** Value is bound by the claim's signature (EIP-712 / Ed25519 / Pallas) over a monotonic `nonce` and cumulative amount. Double-spend protection is the never-go-backwards nonce watermark plus on-chain channel redemption — not an expiring conditional escrow.
- **Optional NIP-59 preimage wrapper.** TOON does have one place that derives a preimage: the optional **NIP-59 claim-wrapper** privacy path (`settlement/privacy/nip59-claim-wrapper.ts`) derives a condition/preimage via ECDH so the claim can be gift-wrapped. This is a privacy feature, not the general payment-security mechanism, and most writes don't use it.

## What to tell a user reasoning about TOON payment security

Don't reason about hashlocks/timelocks or atomic multi-hop preimage release. Reason about: a signed off-chain balance proof against an on-chain channel deposit, validated at the connector ingress, monotonic by nonce, redeemed on-chain at a threshold. The ILP condition fields are inert in the common case.

## Common Topics
- Why TOON doesn't use classic HTLCs (claim-based, not preimage-based)
- ILP condition/fulfillment fields are placeholders on TOON
- Nonce watermark + on-chain channel redemption as the security model
- The optional NIP-59 ECDH preimage wrapper for privacy
- Relationship to `rfc-0027` (placeholder conditions), `rfc-0023` (claim transport)
