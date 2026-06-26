---
name: rfc-0027-interledger-protocol-4
description: How TOON Protocol uses Interledger Protocol V4 (ILPv4, RFC 0027). Use when users ask about TOON's ILP packet format, PREPARE/FULFILL/REJECT framing, routing by ILP address, or the connector error codes (F06, T04, T00, etc.) a TOON client may see. Also covers generic ILPv4 packet, routing, and rejection-code questions. Triggers on 'ILPv4', 'ILP packet', 'FULFILL', 'REJECT', 'F06', 'error code', 'routing', or core protocol questions on TOON.
---

# RFC 0027: Interledger Protocol V4 (ILPv4) on TOON

Implements ILPv4 (RFC 0027) as TOON's packet and routing layer. Every paid write is an ILPv4 PREPARE packet whose `data` carries a TOON-encoded Nostr event; the connector routes it by ILP address and returns FULFILL or REJECT. The packets ride TOON's BTP transport (see `rfc-0023`).

## How TOON uses / diverges from this RFC

TOON uses ILPv4's packet structure, routing, and error codes, but the **value is proven by a signed payment-channel claim, not by the ILP condition/fulfillment**:

- **PREPARE / FULFILL / REJECT.** TOON uses all three (BTP framing, `btp/btp-types.ts:9-17`). A successful paid write returns FULFILL; a refused one returns REJECT with an error code.
- **`executionCondition` / `fulfillment` are placeholders.** In classic ILPv4 these implement an HTLC: the FULFILL must contain the preimage of the PREPARE's condition. On TOON they are **zero/placeholder** in the normal pay path — payment is proven by the attached `payment-channel-claim` balance proof, not a hash preimage. (The optional NIP-59-wrapped-claim path derives a preimage via ECDH; see `rfc-0022`.) So **do not treat the condition/fulfillment fields as the proof of payment.**
- **Routing by ILP address.** The connector routes on the PREPARE's destination address using hierarchical `g.*` longest-prefix matching (`routing/routing-table.ts:135-157`). TOON's scheme: the apex is `g.proxy`; child node types resolve under it (`g.proxy.town` for the relay, plus store/mill children). See `rfc-0015`.
- **Connector fee.** Before forwarding, the connector deducts its fee from the packet amount (`calculateConnectorFee`, `core/packet-handler.ts:501`; ~0.1% default). Parent→child forwards are free (no per-packet claim, no extra fee).

## Error codes a TOON client actually sees

The connector maps internal conditions onto ILPv4 error codes. The ones that matter when debugging TOON writes:

- **F06** — the destination has "no reason to pay us," i.e. a **parent/child mis-tag**: the child wasn't registered `relation:'child'` AND tagging the apex `g.proxy` as its parent (`TOON_PARENT_PEER_ID`). The single most common paid-traffic rejection. Often appears with **T00** (internal/relationship error) at the parent→child ingress.
- **T04** — insufficient liquidity / channel balance: the claim's cumulative amount would exceed the on-chain channel deposit.
- **F03** — invalid packet (malformed claim, bad signature, regressed nonce).
- Generic `Fxx` (final) errors are not retryable; `Txx` (temporary) errors may be after addressing the cause. Never blind-retry a rejected claim — it can still cost a fee.

Surface the `code` + `message` verbatim to the user rather than guessing. The connector README's BLS error table is the authoritative mapping.

## Common Topics
- ILPv4 PREPARE/FULFILL/REJECT framing on TOON
- Why condition/fulfillment are placeholders (claim is the proof)
- Longest-prefix routing under the `g.proxy` apex
- The F06/T00 parent-child mis-tag, T04 insufficient balance, F03 invalid claim
- Connector fee deduction before forward; free parent→child forward
