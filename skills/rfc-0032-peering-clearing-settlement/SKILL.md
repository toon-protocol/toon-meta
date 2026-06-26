---
name: rfc-0032-peering-clearing-settlement
description: How TOON Protocol implements Interledger RFC 0032 - Peering, Clearing and Settlement, via its apex/child model. Use when users ask about TOON's parent/child/peer relationships, why parent→child forwards are free, how clearing (off-chain balance accrual) works, when on-chain settlement happens, or the connector fee. Also covers generic peering, clearing, and settlement questions. Triggers on 'peering', 'clearing', 'settlement', 'parent child peer', 'free forward', or 'connector fee'.
---

# RFC 0032: Peering, Clearing and Settlement — TOON's apex/child model

Implements RFC 0032 semantics with TOON's specific topology: a single **apex** connector (`g.proxy`) and its **child** service nodes (town/dvm/swap). This skill describes the real peering relations, clearing, and settlement TOON uses.

## Peering: static relations (`relation: parent | peer | child`)

TOON peers are statically configured with a `relation` (`config/types.ts:71-88`) that governs how settlement claims flow:

- **`parent`** — an upstream provider this node settles *up* to. The child issues claims up to the parent when forwarding up.
- **`peer`** — a lateral bilateral peer; a per-packet claim flows on every value-bearing forward in either direction. **This is the default** when `relation` is omitted.
- **`child`** — a downstream node that settles *up* to this node. **A parent never issues per-packet claims down to a child.** Value-bearing forwards to a `child` next hop therefore **skip the mandatory per-packet claim**.

The apex model: the connector is the parent (`g.proxy`); town/dvm/swap are children. A client is a peer/customer of the apex (pays with claims); the apex forwards to its children for free.

## The free-forward rule (the part people get wrong)

When a client pays the apex and the apex routes the packet to one of its **children**, the parent→child hop carries **no claim**. The child accrues a balance owed *up* and settles it via its own up-claims; it does not get paid per-packet by the parent. For this to work the child must be **both**:

1. registered with `relation:'child'` on the apex, **and**
2. tagging the apex's nodeId `g.proxy` as its parent (`TOON_PARENT_PEER_ID`).

Get either wrong and the packet hits the "pay-the-child" path with no channel → **T00 / F06 reject** ("no reason to pay us"). This is the single most common misconfiguration in TOON deployments.

## Clearing: off-chain balance accrual

Clearing on TOON is the off-chain accrual of signed **payment-channel claims**. Each paid write advances a monotonic `nonce` and a cumulative `transferredAmount` on the channel (see `rfc-0023`). No on-chain transaction occurs per write — the running balance is the cleared-but-unsettled position.

## Settlement: threshold on-chain redemption

Settlement is **in-process and multi-chain** (see `rfc-0038`): when the cleared balance crosses a threshold, the connector redeems the latest claim on the underlying chain via `claimFromChannel` → `settleChannel`/`closeChannel` (EVM / Solana / Mina). This is not the RFC-0038 separate-process HTTP engine — it runs inside the connector.

## The connector fee

On a value-bearing forward, the connector deducts its fee from the packet amount before forwarding (`calculateConnectorFee`, `core/packet-handler.ts`; ~0.1% default). The free parent→child forward carries no extra fee.

## Common Topics
- `relation: parent | peer | child` and how claims flow per relation
- The apex (`g.proxy`) + town/dvm/swap child topology
- The free parent→child forward and the `relation:'child'` + parent-tag requirement
- T00/F06 from a mis-tagged child
- Off-chain clearing (claim accrual) vs threshold on-chain settlement
- The ~0.1% connector fee (`calculateConnectorFee`)
