# Fee Calculation

## Why Per-Byte Pricing

TOON charges per byte because it aligns incentives: larger events consume more relay storage, more bandwidth, and more ILP routing resources. Per-byte pricing means a short text note costs fractions of a cent while a large DVM payload costs proportionally more. This is simpler and more predictable than per-event flat fees or auction-based pricing.

## Pricing Discovery

### kind:10032 (ILP Peer Info)

Relay peers publish kind:10032 events advertising their pricing:

```json
{
  "kind": 10032,
  "tags": [
    ["basePricePerByte", "10"],
    ["feePerByte", "2"],
    ["ilpAddress", "g.toon.relay1"]
  ]
}
```

- `basePricePerByte`: The destination relay's charge per byte (micro-USDC)
- `feePerByte`: This node's intermediary routing fee per byte (micro-USDC)

Subscribe to kind:10032 on the relay to get current pricing from all known peers.

### NIP-11 `/health` Endpoint

TOON relays expose an enriched NIP-11 endpoint:

```
GET http://relay-host:3100/health
```

Returns pricing info, capabilities, chain config, x402 status, and TEE attestation state. The pricing fields include `basePricePerByte`.

## Base Fee Formula

```
amount = basePricePerByte * serializedEventBytes
```

Where:
- `basePricePerByte` = 10n by default (10 micro-USDC per byte = $0.00001/byte)
- `serializedEventBytes` = length of the TOON-encoded event in bytes
- All amounts are in USDC micro-units (6 decimal places, so 1 USDC = 1,000,000 units)

**Examples:**

| Event Size | basePricePerByte | Amount (micro-USDC) | USD |
|------------|-----------------|---------------------|-----|
| 100 bytes | 10n | 1,000 | $0.001 |
| 250 bytes | 10n | 2,500 | $0.0025 |
| 1,000 bytes | 10n | 10,000 | $0.01 |
| 10,000 bytes | 10n | 100,000 | $0.10 |

## Route-Aware Fee Calculation

For multi-hop routes, intermediary nodes charge their own `feePerByte`:

```
totalAmount = basePricePerByte * bytes + SUM(hopFees[i] * bytes)
```

The `resolveRouteFees()` function in `@toon-protocol/core` uses LCA-based (Longest Common Ancestor) route resolution on the ILP address tree to determine which intermediary nodes are on the path and what they charge:

```typescript
import { resolveRouteFees, calculateRouteAmount } from '@toon-protocol/core';

// Resolve intermediary fees from discovered peers
const { hopFees, warnings } = resolveRouteFees({
  destination: 'g.toon.euwest.relay42',
  ownIlpAddress: 'g.toon.useast.myagent',
  discoveredPeers,
});

// Calculate total amount including intermediary fees
const totalAmount = calculateRouteAmount({
  basePricePerByte: 10n,
  packetByteLength: encodedEvent.length,
  hopFees,
});
```

For direct routes (no intermediaries), `hopFees` is empty and the formula reduces to the base formula.

## DVM Amount Override (D7-007)

For DVM kinds (kind:5xxx job requests), the amount can be overridden to match the provider's advertised price from their `SkillDescriptor.pricing` in kind:10035 events. The payment amount comes from the provider's listed price, not from `basePricePerByte * bytes`:

```typescript
// Provider advertises pricing in kind:10035 SkillDescriptor
// { kindPricing: { "5100": "50000" } }  // 50,000 micro-USDC for text generation

// Client pays the advertised price, not basePricePerByte * bytes
const claim = await client.signBalanceProof(channelId, 50000n);
await client.publishEvent(dvmRequest, { destination: providerAddress, claim });
```

This enables the prepaid DVM model where the request packet IS the payment. The provider validates `ctx.amount >= advertisedPrice` in its handler.

## Kind-Specific Pricing via SkillDescriptor

Providers can set different prices for different event kinds through the `kindPricing` field in their kind:10035 `SkillDescriptor`:

```json
{
  "kindPricing": {
    "5094": "100000",
    "5100": "50000",
    "5250": "200000"
  }
}
```

When publishing a DVM request, look up the provider's `kindPricing` for the specific kind to determine the correct amount.

## Bid Safety Cap (D7-006)

The `bid` semantic is a client-side safety cap: the client specifies the maximum amount it is willing to pay. If the calculated or provider-set price exceeds the bid, the client refuses to send. This protects against price surprises:

- `bid` is NOT an offer or negotiation -- it is a hard ceiling
- The actual payment amount comes from `basePricePerByte * bytes` or the provider's `kindPricing`
- If `actualAmount > bid`, the client throws an error before sending any payment

## Key Rules

- All arithmetic uses `bigint` -- no floating point, no overflow risk
- Negative byte lengths are guarded (return 0n)
- Unknown intermediaries default to `feePerByte = 0n` with a warning
- Malicious negative `feePerByte` values from kind:10032 events are clamped to 0n
- The client calculates fees internally in `publishEvent()` -- agents do not manually construct ILP packets
