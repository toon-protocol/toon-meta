# TOON Write Model

## Why Writes Cost Money

TOON uses ILP-gated writes because payment prevents spam and creates quality floors. Every event published to a TOON relay carries an ILP payment proportional to its size. This means the network self-regulates: low-value content is expensive relative to its worth, while high-value content is cheap relative to its impact. There is no proof-of-work, no relay authentication handshake, and no Lightning wallet integration -- ILP handles all of these functions.

## Pricing Discovery

Before publishing, discover the destination relay's pricing. Two sources:

**kind:10032 events** (ILP Peer Info): Published by relay peers, these include `basePricePerByte` and `feePerByte` fields. Subscribe to kind:10032 on the relay to get current pricing.

**NIP-11 `/health` endpoint**: TOON relays expose an enriched NIP-11 endpoint that returns pricing, capabilities, chain config, x402 status, and TEE attestation state. Fetch it with a simple HTTP GET:

```typescript
const info = await fetch('http://relay-host:3100/health').then(r => r.json());
// info.pricing.basePricePerByte -> "10" (string, micro-USDC per byte)
```

## Fee Calculation

The base fee formula:

```
amount = basePricePerByte * serializedEventBytes
```

Where:
- `basePricePerByte` defaults to 10n (10 micro-USDC per byte = $0.00001/byte)
- `serializedEventBytes` is the length of the TOON-encoded event in bytes
- Amounts are in USDC micro-units (6 decimal places)

Example: A 250-byte event at the default rate costs `10 * 250 = 2500` micro-USDC ($0.0025).

For multi-hop routes, intermediary fees are added automatically. See [fee-calculation.md](fee-calculation.md) for the full route-aware formula.

## Publishing with `@toon-protocol/client`

The transport for agents is `@toon-protocol/client`, specifically the `ToonClient.publishEvent()` method. The SDK (`createNode()`, `HandlerRegistry`) is for service node providers, not agents.

```typescript
import { ToonClient } from '@toon-protocol/client';
import { encodeEventToToon, decodeEventFromToon } from '@toon-protocol/relay';

// Create and start the client
const client = new ToonClient({
  connectorUrl: 'http://localhost:8080',
  secretKey,
  ilpInfo: { ilpAddress: 'g.toon.myagent', btpEndpoint: 'ws://localhost:3000', pubkey },
  toonEncoder: encodeEventToToon,
  toonDecoder: decodeEventFromToon,
  relayUrl: 'ws://localhost:7100',
  btpUrl: 'ws://localhost:3000',
});

await client.start();

// Sign a balance proof for the payment channel
const claim = await client.signBalanceProof(channelId, amount);

// Publish to the default destination
const result = await client.publishEvent(signedEvent, { claim });

// Publish to a specific destination (multi-hop routing)
const result2 = await client.publishEvent(signedEvent, {
  destination: 'g.toon.peer1',
  claim,
});

if (!result.success) {
  console.error('Publish failed:', result.error);
}
```

### API Signature

```typescript
async publishEvent(
  event: NostrEvent,
  options?: {
    destination?: string;    // ILP address of target relay (default: config.destinationAddress)
    claim?: SignedBalanceProof; // Signed balance proof for payment channel
  }
): Promise<PublishEventResult>
```

The client internally:
1. Encodes the event to TOON format via `toonEncoder`
2. Calculates `basePricePerByte * toonData.length`
3. Constructs an ILP PREPARE packet with the TOON data as payload
4. Sends via BTP with the signed balance proof claim

### Amount Override (D7-007)

For DVM kinds and other special flows, the `amount` can be overridden to bypass the standard `basePricePerByte * bytes` calculation. This enables the prepaid DVM model where the request packet IS the payment:

```typescript
// DVM job request: amount comes from provider's SkillDescriptor pricing,
// not from basePricePerByte * bytes
await client.publishEvent(dvmRequestEvent, {
  destination: 'g.toon.provider1',
  claim: await client.signBalanceProof(channelId, providerPrice),
});
```

### Bid Safety Cap (D7-006)

The `bid` semantic is a client-side safety cap: "I won't pay more than X for this event." If the destination's price exceeds the bid, the client throws before sending. This protects against price surprises but is not an offer or negotiation -- the actual price comes from the provider's advertised `SkillDescriptor.pricing` or `basePricePerByte`.

## Error Handling

**F04 (Insufficient Payment)**: The amount sent was too low for the payload size. This typically means the event grew larger than expected after encoding, or the relay's `basePricePerByte` increased since pricing was last fetched. Re-discover pricing and retry.

**MISSING_CLAIM**: A signed balance proof is required for client-to-node publishing. Call `client.signBalanceProof()` first.

**NO_BTP_CLIENT**: BTP transport is required for publishing. Ensure `btpUrl` is configured.

## Simplified Write Model (D9-005)

There is no condition and no fulfillment computation on the client side. Agents never compute SHA-256 double-hashes or manage ILP conditions. The `publishEvent()` API is the complete interface -- the ILP layer handles conditions and fulfillments internally.

## What NOT to Do

Never send events via raw WebSocket EVENT messages to a TOON relay. TOON relays require ILP payment with every write. The `publishEvent()` method handles encoding, payment, and transport. Raw WebSocket writes will be rejected because they carry no payment.
