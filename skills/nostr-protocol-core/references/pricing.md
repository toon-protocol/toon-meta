# Pricing

> This file was `fee-calculation.md`. It was renamed because **fee** now means something specific and different: a fee is flat, per packet, and belongs to a **peering** between two operators. What a write costs you is a **charge**, and it comes from a route's **price**.

## Three Words That Are Not Interchangeable

| Word | What it is | Record |
|------|-----------|--------|
| **Fee** | Flat, per packet, attached to a **peering** — never per route, never per byte | ADR 0061 |
| **Price** | What a **terminated route** charges: a schedule over payload length, flat exactly when it has no slope | ADR 0065 |
| **Charge** | That price evaluated for one packet, over the **sealed** payload's length | ADR 0065 |
| **Cost** | Every hop's fee plus the terminating charge — discovered from a probe's reject, sum only | ADR 0011, 0044 |
| **Cap** | The most one packet may carry to one peer | ADR 0049 |

**Never say "per-byte".** The unit is a **kibibyte**.

## Why a Route, Not a Byte

Pricing attaches to the route because the route is the thing a connector actually terminates. A route's price is a schedule over payload length, and most routes are flat — the slope is zero, so every packet costs the same regardless of size.

This matters for how you reason about cost. On the live relay route, a one-word reply and a two-thousand-word article cost **exactly the same**. Length is free; frequency is not. Anti-spam on TOON works because every write costs something, not because long writes cost more.

The exception is a genuinely metered route like the store, where the slope is non-zero and a bigger blob does cost more. That is the route to reach for when you want to reason about size.

## Asking the Price

A connector **answers**; it never announces. Its **self-description**, served free and unauthenticated from `GET /ilp` on its own URL (ADR 0050), carries its addresses, its settlement facts and every route's price. That is the only place a node's payment facts come from.

```typescript
const terms = await client.routePrice('g.toon.relay');
// { price: 1n }                      — flat
// { price: 1000n, pricePerKib: 10n } — metered
// null                                — this node terminates no matching route
```

`null` is an **answer** — "I do not terminate that" — and not a failure. A connector that could not be reached throws instead, so the two are never confused.

`client.price(destination)` is the same question when you only want the base figure. It is **not** always the whole bill: a route that also publishes `pricePerKib` charges strictly more than that for every packet.

## Working Out What a Packet Will Carry

```typescript
import { chargeFor } from '@toon-protocol/client';

const terms = await client.routePrice(destination);
const amount = chargeFor(terms, sealedBytes);
```

`chargeFor` is the only thing that should decide what goes on a claim. **Do not reimplement its arithmetic.** The connector counts kibibytes in a specific way, and a locally invented formula that disagrees produces an `F03` with the real figure attached — or, worse, silent overpayment.

**You usually should not call it at all.** `send()` calls it for you, and pays the full charge without being asked. Reach for `chargeFor` only when you must show a user a price before committing to a write.

### You Cannot Compute the Charge From Your Event

The metered quantity is the **sealed** payload — the gift-wrapped bytes the PREPARE actually carries — **not** the event JSON you wrote, which is smaller by the envelope and the wrap. A charge can therefore only be computed *after* sealing, which is why `send()` seals before it prices.

This is why "measure your event and multiply" is not a thing you can do on TOON, even in principle.

## Units

Prices are whole counts of the settlement token's smallest unit. USDC is 6-decimal, so `1_000_000` = $1.

All arithmetic is `bigint`. A price past 2^53 is a real amount and a JSON number would round it, so the wire carries a decimal string and the client normalises to `bigint`.

## Live Devnet Prices

Probed 2026-08-28 from each node's `GET /ilp`:

| Destination | Terminates at | Price (base units of 6-dp USDC) |
|-------------|---------------|--------------------------------|
| `g.toon.relay` | relay box | **1**, flat — $0.000001 per write, any length |
| `g.toon.store`, `g.toon.relay.store` | store box | **base 1000, plus 10 per KiB** |
| `g.toon.gas` | gas box | **1000** |

Ask the node rather than trusting this table. A node's own self-description is the authority, and a node repository's `deploy/` bundle is the authority for what its box serves.

**Nothing answers at `g.toon` itself** — the apex was destroyed 2026-08-14 — and every `g.proxy…` address is dead.

## Multi-Hop Cost

The cost of a path is every hop's fee plus the terminating charge. You **discover** it by probing, not by computing it from a fee table:

```typescript
const { accumulatedCost, code, message } = await client.probe(destination);
```

A probe is free to traverse but not free to make: it must carry a claim on a channel the connector recognises, because free traversal offered to anyone is an amplifier. The claim **identifies rather than pays** — it is validated in full against a price of zero, so possession of the channel is proven and a replay is still refused, but no value advances.

**Retired:** `resolveRouteFees()`, `calculateRouteAmount()`, `hopFees`, and LCA-based route resolution over an ILP address tree. Addresses are not a tree you can route on — an ILP address is self-asserted, a claim and not a grant, and nothing derives one from topology.

## Underpayment

`F03` INVALID_AMOUNT means the claim does not cover the charge. The reject carries the real figure, so the correct response is to re-ask and re-sign, not to guess upward.

**There is no `F04`.** Underpayment is `F03`.

`T04` is the neighbouring case and a different problem: the packet is over the peering's **cap**. The message states the cap, which is the only way a sender learns it. It is never carried and never split for you.

## Retired Pricing Machinery

None of the following exists. Do not reach for it, and treat any code or document that does as stale:

- `basePricePerByte`, `feePerByte`, and per-byte pricing in general — all removed.
- `kind:10032` ILP peer info, and any pricing read from an announce. ADR 0046 removed the announce; ADR 0050 puts the same facts on a `GET` of the node's own URL.
- A `/health` endpoint returning pricing.
- `kind:10035` / `SkillDescriptor` and its `kindPricing` per-kind overrides.
- The `bid` safety cap (D7-006) and the DVM amount override (D7-007) as previously described. `SendOptions.amount` exists, but on a forwarded route an amount above the price is refused `F03` before the claim is even read — so raising it does not buy priority, and it is not a negotiation.
- Purchasable peering and vanity prefixes (ADR 0043). A peering cannot be bought; it is one operator write, trust-on-first-use.
