# SDK Guide

`@toon-protocol/sdk` provides the building blocks for creating services that participate in the TOON network. It handles identity, signature verification, pricing, and handler dispatch — you bring the business logic.

## Where SDK Sits in the Stack

```
┌─────────────────────────┐
│  Your Application       │  ← You write this
├─────────────────────────┤
│  @toon-protocol/sdk         │  ← Identity, verification, pricing, handlers
├─────────────────────────┤
│  @toon-protocol/core        │  ← Bootstrap, discovery, peering
├─────────────────────────┤
│  ILP Connector          │  ← Payment routing
└─────────────────────────┘
```

SDK is the framework layer between your application logic and the protocol infrastructure.

## Identity

Every TOON node has a unified identity derived from a single secp256k1 key:

```typescript
import { fromMnemonic, fromSecretKey, generateMnemonic } from '@toon-protocol/sdk';

// Generate a new identity
const mnemonic = generateMnemonic();
const identity = fromMnemonic(mnemonic);

// Or use an existing secret key
const identity = fromSecretKey(secretKeyBytes);

console.log(identity.pubkey);      // Nostr pubkey (x-only Schnorr, BIP-340)
console.log(identity.evmAddress);  // EVM address (Keccak-256)
console.log(identity.secretKey);   // 32-byte Uint8Array
```

Identity uses [NIP-06](https://github.com/nostr-protocol/nips/blob/master/06.md) derivation path: `m/44'/1237'/0'/0/{accountIndex}`. One key produces both a Nostr pubkey and an EVM address.

## Creating a Node

`createNode()` composes the full processing pipeline and returns a `ServiceNode`:

```typescript
import { createNode, fromMnemonic } from '@toon-protocol/sdk';
import { ConnectorNode } from '@toon-protocol/connector';

const identity = fromMnemonic('your twelve word mnemonic...');

// Create an embedded ILP connector
const connector = new ConnectorNode({
  nodeId: 'my-node',
  btpServerPort: 3000,
  environment: 'development',
  deploymentMode: 'embedded',
  peers: [],
  routes: [],
});

const node = createNode({
  secretKey: identity.secretKey,
  connector,                    // ConnectorNode instance
  basePricePerByte: 10n,        // 10 units per byte
  devMode: false,               // Enable signature verification
  knownPeers: [{ pubkey, relayUrl, btpEndpoint }],
});
```

> **Note:** The SDK uses an embedded connector that runs in-process for zero-latency direct function calls. [`@toon-protocol/town`](../town) also uses embedded mode by default, or can connect to an external connector via `connectorUrl` for advanced deployments.

### NodeConfig Reference

| Option | Type | Default | Purpose |
|--------|------|---------|---------|
| `secretKey` | `Uint8Array` | **required** | 32-byte identity key |
| `connector` | `EmbeddableConnectorLike` | **required** | ILP connector instance |
| `basePricePerByte` | `bigint` | `10n` | Price per byte of TOON data |
| `devMode` | `boolean` | `false` | Skip verification and pricing |
| `ilpAddress` | `string` | derived from pubkey | Node's ILP address (default: `deriveChildAddress('g.toon', pubkey)`) |
| `assetCode` | `string` | `USD` | Settlement asset code |
| `assetScale` | `number` | `6` | Settlement asset scale |
| `knownPeers` | `KnownPeer[]` | `[]` | Seed peers for bootstrap |
| `relayUrl` | `string` | — | Relay URL for discovery |
| `kindPricing` | `Record<number, bigint>` | — | Per-kind price overrides |
| `settlementInfo` | `SettlementConfig` | — | Chain and contract config |
| `handlers` | `Record<number, Handler>` | — | Config-based handler registration |
| `defaultHandler` | `Handler` | — | Config-based default handler |

## Handlers

Handlers are functions that process incoming events by kind. They receive a `HandlerContext` and respond with accept or reject.

### Registering Handlers

```typescript
// Chainable builder pattern
node
  .on(1, handleTextNote)
  .on(10032, handlePeerInfo)
  .onDefault(handleEverythingElse);

// Or via config at creation time
const node = createNode({
  ...config,
  handlers: { 1: handleTextNote, 10032: handlePeerInfo },
  defaultHandler: handleEverythingElse,
});
```

### Handler Context

```typescript
async function handleTextNote(ctx) {
  // Available properties
  ctx.toon;         // Raw TOON payload (string)
  ctx.kind;         // Event kind (number)
  ctx.pubkey;       // Author pubkey (string)
  ctx.amount;       // Payment amount (bigint)
  ctx.destination;  // ILP destination (string)

  // Lazy decode — only decodes when you need the full event
  const event = ctx.decode();

  // Respond
  return ctx.accept({ eventId: event.id });
  // or
  return ctx.reject('F04', 'Custom rejection reason');
}
```

### Handler Response Pattern

Handlers use `ctx` methods to respond:

- `ctx.accept(metadata?)` — Accept the packet, return ILP FULFILL
- `ctx.reject(code, message)` — Reject the packet, return ILP REJECT

**Exception:** Handlers that need to return data in the ILP FULFILL response return `{ accept: true, fulfillment: 'default-fulfillment', data }` directly. This puts the response in the top-level `data` field for the connector to relay back to the sender.

## Verification Pipeline

The SDK verifies Schnorr signatures on every incoming event:

1. Shallow-parse the TOON payload to extract `pubkey`, `id`, and `sig`
2. Verify the Schnorr signature against the serialized event bytes
3. Reject with F06 if invalid

**Important:** Verification operates on the raw serialized bytes, not on decoded-then-re-encoded data. Shallow parsing first, verification second — this prevents trusting the decode step.

In `devMode`, verification is skipped entirely — useful for testing.

## Pricing Validator

Payment validation ensures writers pay enough:

```
requiredAmount = toonData.length * basePricePerByte
```

**Special cases:**

- **Self-write bypass** — Events from the node's own pubkey skip pricing entirely
- **Per-kind overrides** — `kindPricing` config allows custom rates per event kind
- **Dev mode** — Pricing is skipped entirely

## Publishing Events

Send events to other nodes via ILP:

```typescript
import { finalizeEvent } from 'nostr-tools/pure';

const event = finalizeEvent({
  kind: 1,
  content: 'Hello from TOON!',
  tags: [],
  created_at: Math.floor(Date.now() / 1000),
}, identity.secretKey);

const result = await node.publishEvent(event, {
  destination: 'g.toon.peer1',
});

if (result.success) {
  console.log('Published:', result.eventId);
}
```

`publishEvent()` TOON-encodes the event, computes the payment amount (`basePricePerByte * toonData.length`), and sends via the connector.

Requirements:
- Node must be started (`node.start()` called)
- Destination is required (`options.destination`)

## Lifecycle

```typescript
// Start: wire packet handler, bootstrap, discover peers
const result = await node.start();
console.log(`Peers: ${result.peerCount}, Channels: ${result.channelCount}`);

// Peer with discovered nodes
await node.peerWith(discoveredPubkey);

// Stop: clean up connections
await node.stop();
```

### Bootstrap Events

```typescript
node.on('bootstrap', (event) => {
  console.log(`Phase: ${event.phase}`);
  // Phases: discovering → registering → announcing
});
```

## Error Handling

All SDK errors extend `TOONError` from `@toon-protocol/core`:

| Error Class | When | ILP Code |
|-------------|------|----------|
| `IdentityError` | Invalid mnemonic or secret key | — |
| `NodeError` | Lifecycle failure (start/stop/publish) | — |
| `VerificationError` | Schnorr signature invalid | F06 |
| `PricingError` | Insufficient payment | F04 |
| `HandlerError` | Handler registration or dispatch failure | T00 |

```typescript
import { IdentityError, NodeError } from '@toon-protocol/sdk';

try {
  const identity = fromMnemonic('invalid mnemonic');
} catch (e) {
  if (e instanceof IdentityError) {
    console.error('Bad mnemonic:', e.message);
  }
}
```

## ServiceNode API Summary

| Method | Purpose |
|--------|---------|
| `node.on(kind, handler)` | Register handler for event kind |
| `node.on('bootstrap', listener)` | Listen to bootstrap lifecycle events |
| `node.onDefault(handler)` | Register default handler |
| `node.start()` | Wire pipeline, bootstrap, discover peers |
| `node.stop()` | Clean shutdown |
| `node.peerWith(pubkey)` | Explicitly peer with a discovered node |
| `node.publishEvent(event, options)` | Publish event to a destination node |

| Property | Type | Description |
|----------|------|-------------|
| `node.pubkey` | `string` | Nostr public key |
| `node.evmAddress` | `string` | EVM address |
| `node.connector` | `EmbeddableConnectorLike` | Connector instance |
| `node.channelClient` | `ConnectorChannelClient \| null` | Channel operations |
