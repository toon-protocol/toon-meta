---
name: rfc-0039-stream-receipts
description: How TOON Protocol relates to Interledger RFC 0039 - STREAM Receipts. Use when users ask how TOON proves a payment, what proof-of-payment looks like on TOON, or whether TOON issues STREAM receipts. Also covers generic STREAM-receipt, payment-verification, and proof-of-payment questions. Triggers on 'STREAM receipt', 'payment proof', 'proof of payment', or 'how does TOON verify payment'.
---

# RFC 0039: STREAM Receipts — and what TOON uses instead

STREAM receipts are signed records a STREAM receiver issues to prove how much it received, for non-repudiation by a third party.

## How TOON uses / diverges from this RFC

**TOON has no STREAM receipts** — it has no STREAM at all (see `rfc-0029`). Proof of payment and proof of delivery on TOON come from different artifacts:

- **Proof of payment = the signed payment-channel claim.** Each paid write produces a counterparty-signed **balance-proof claim** (`payment-channel-claim`, see `rfc-0023`) asserting a monotonically-increasing `nonce` and cumulative `transferredAmount` against an on-chain channel deposit. The claim is itself the non-repudiable proof: the payer signed it (EIP-712 / Ed25519 / Pallas), and it can be redeemed on-chain.
- **On-chain settlement is the final proof.** When a threshold is crossed, the connector redeems the latest claim on the underlying chain (`claimFromChannel` → `settleChannel`/`closeChannel`), producing an on-chain transaction — the strongest form of payment proof.
- **Proof of delivery = the ILP FULFILL.** A FULFILL returned by the destination (e.g. the relay accepting an event, or the kind:5094 DVM returning an Arweave tx id in the FULFILL `data`) is the receiver's acknowledgment that it received and acted on the packet. A REJECT means it was not accepted.

## What to tell a user asking "where's my receipt?"

There is no receipt event. To verify a payment, point them at:
1. the **claim** (nonce + cumulative amount) tracked by their client/daemon (`toon_channels`), and
2. the matching **on-chain channel state** once settled, and
3. the **FULFILL** response for delivery (e.g. the returned Arweave tx id for a DVM job).

## Common Topics
- Why TOON has no STREAM receipts (no STREAM)
- Signed payment-channel claim as non-repudiable payment proof
- On-chain claim redemption as final settlement proof
- ILP FULFILL (incl. DVM tx-id in `data`) as delivery proof
