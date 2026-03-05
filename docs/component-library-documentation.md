# Component Library Documentation

This document covers the three library packages in the Crosstown monorepo: **core**, **client**, and **examples**.

---

## @crosstown/core

**Type:** Library (Core Protocol Implementation)
**Description:** Core library for Nostr-based ILP peer discovery, SPSP, and bootstrap orchestration
**Files:** 37 TypeScript modules

### Key Exports

#### Event Kinds (Proposed NIPs)

- `ILP_PEER_INFO_KIND` (10032) - ILP peer information event
- `SPSP_REQUEST_KIND` (23194) - SPSP request event (encrypted)
- `SPSP_RESPONSE_KIND` (23195) - SPSP response event (encrypted)

#### Core Modules

**1. Peer Discovery (`discovery/`)**

- `NostrPeerDiscovery` - Discover ILP peers via NIP-02 follows
- `GenesisPeerLoader` - Load hardcoded genesis peers
- `ArDrivePeerRegistry` - Peer registry backed by Arweave
- `SocialPeerDiscovery` - Social graph-based peer discovery

**2. SPSP (`spsp/`)**

- `NostrSpspClient` - SPSP client using Nostr events
- `NostrSpspServer` - SPSP server using Nostr events
- `IlpSpspClient` - ILP SPSP client (HTTP-based)
- `negotiateSettlementChain()` - Negotiate settlement blockchain
- `negotiateAndOpenChannel()` - Complete channel opening flow

**3. Bootstrap (`bootstrap/`)**

- `BootstrapService` - Orchestrates joining Crosstown network
- `RelayMonitor` - Monitor relay for peer announcements
- `createHttpRuntimeClient()` - HTTP connector client factory
- `createAgentRuntimeClient()` - Agent runtime client factory
- `createDirectRuntimeClient()` - Direct connector client factory

**4. Node Composition (`compose.ts`)**

- `createCrosstownNode()` - Create complete Crosstown node
  - Manages embedded connector
  - Handles packet routing
  - Orchestrates bootstrap

#### Types

```typescript
// Peer Information
interface IlpPeerInfo {
  ilpAddress: string;
  btpEndpoint?: string;
  settlementInfo?: SettlementInfo;
  publicKey?: string;
}

// SPSP
interface SpspInfo {
  destination_account: string;
  shared_secret: string;
  settlementInfo?: SettlementInfo;
}

// Settlement
interface SettlementNegotiationConfig {
  preferredChainId?: number;
  supportedChainIds: number[];
  tokenAddress: string;
  walletAddress: string;
}

// Bootstrap
interface BootstrapConfig {
  secretKey: Uint8Array;
  ilpAddress: string;
  genesisRelay: string;
  genesisPeers?: GenesisPeer[];
  settlementConfig?: SettlementNegotiationConfig;
}
```

#### Error Classes

- `CrosstownError` - Base error
- `InvalidEventError` - Invalid Nostr event
- `PeerDiscoveryError` - Peer discovery failures
- `SpspError` - SPSP protocol errors
- `BootstrapError` - Bootstrap failures

### Usage Example

```typescript
import { createCrosstownNode, BootstrapService } from '@crosstown/core';

// Create node with embedded connector
const node = createCrosstownNode({
  secretKey: mySecretKey,
  ilpAddress: 'g.crosstown.peer1',
  connector: embeddableConnector,
  packetHandler: blsPacketHandler,
});

// Bootstrap into network
const bootstrap = new BootstrapService({
  secretKey: mySecretKey,
  ilpAddress: 'g.crosstown.peer1',
  genesisRelay: 'ws://genesis:7100',
  genesisPeers: [{ pubkey: '...', ilpAddress: 'g.crosstown.genesis' }],
});

const result = await bootstrap.bootstrap();
console.log(`Peered with ${result.peeredCount} nodes`);
```

---

## @crosstown/client

**Type:** Library (Client SDK)
**Description:** End-to-end client for publishing events to ILP-gated relays with automatic payment and settlement
**Files:** TypeScript client SDK

### Key Exports

#### Main Client

**`CrosstownClient`**

```typescript
class CrosstownClient {
  constructor(config: CrosstownClientConfig);
  async start(): Promise<CrosstownStartResult>;
  async publishEvent(event: NostrEvent): Promise<PublishEventResult>;
  async signBalanceProof(
    params: BalanceProofParams
  ): Promise<SignedBalanceProof>;
  stop(): Promise<void>;
}
```

#### Configuration

```typescript
interface CrosstownClientConfig {
  // Nostr
  secretKey: Uint8Array;
  relay: string;

  // ILP Connector
  connector:
    | {
        url: string; // HTTP connector URL
        ilpAddress: string; // Client's ILP address
      }
    | {
        transport: 'btp'; // BTP transport
        endpoint: string;
        authToken: string;
      };

  // Settlement (optional)
  settlement?: {
    enabled: boolean;
    chainId: number;
    rpcUrl: string;
    privateKey: string;
    tokenAddress: string;
    peerAddress?: string; // For channel creation
  };
}
```

#### Adapters

- `HttpRuntimeClient` - HTTP connector client
- `BtpRuntimeClient` - BTP connector client
- `HttpConnectorAdmin` - Connector admin API client
- `OnChainChannelClient` - Payment channel management

#### Signing

- `EvmSigner` - EVM balance proof signing

#### Utilities

- `withRetry()` - Retry helper with exponential backoff

### Usage Example

```typescript
import { CrosstownClient } from '@crosstown/client';
import { finalizeEvent } from 'nostr-tools/pure';

const client = new CrosstownClient({
  secretKey: mySecretKey,
  relay: 'ws://relay:7100',
  connector: {
    url: 'http://connector:8080',
    ilpAddress: 'g.crosstown.client',
  },
  settlement: {
    enabled: true,
    chainId: 31337,
    rpcUrl: 'http://anvil:8545',
    privateKey: '0x...',
    tokenAddress: '0x...',
  },
});

// Start client (opens channels if settlement enabled)
await client.start();

// Publish event (automatic payment)
const event = finalizeEvent(
  { kind: 1, content: 'Hello!', tags: [], created_at: now },
  secretKey
);
const result = await client.publishEvent(event);

console.log(`Event published: ${result.eventId}`);
console.log(`Payment: ${result.amountPaid}`);
```

---

## @crosstown/examples

**Type:** Examples/Demos
**Description:** Example applications demonstrating Crosstown protocol usage
**Files:** Demo code

### Available Demos

#### 1. ILP-Gated Relay Demo (`ilp-gated-relay-demo/`)

**Purpose:** Demonstrates the complete ILP payment flow for event publishing

**What it demonstrates:**

1. **Basic Payment Flow:**
   - Create Nostr event
   - Calculate payment amount
   - Send ILP payment via BLS
   - Verify event stored in relay

2. **Self-Write Bypass:**
   - Owner events accepted with zero payment
   - Non-owner events rejected without payment
   - Non-owner events accepted with proper payment

**Components:**

- `index.ts` - Main demo orchestration
- `relay.ts` - Relay server setup
- `mock-connector.ts` - Mock ILP connector for testing

**Run Demo:**

```bash
cd packages/examples
pnpm demo:ilp-gated-relay
```

**Expected Output:**

```
=================================
DEMO 1: Basic Payment Flow
=================================
[Agent] Generated keypair
[Agent] Sending payment of 500 units...
[Agent] PAID: Event accepted!
[Agent] Event verified in relay!

=================================
DEMO 2: Self-Write Bypass
=================================
[Demo] BYPASS: Owner event accepted with 0 payment
[Demo] Non-owner event rejected (insufficient)
[Demo] PAID: Non-owner event accepted with 500 payment
```

### Demo Architecture

```
Demo → Mock Connector → BLS → Relay (WebSocket)
                          ↓
                      Event Store (SQLite)
```

---

## Integration Patterns

### Pattern 1: Embedded Connector (core)

Use `createCrosstownNode()` to run an embedded connector:

```typescript
import { createCrosstownNode } from '@crosstown/core';
import { Connector } from '@agent-society/connector';

const connector = new Connector({ ilpAddress: 'g.crosstown.peer1' });
const node = createCrosstownNode({
  secretKey,
  ilpAddress: 'g.crosstown.peer1',
  connector,
  packetHandler: blsInstance.handlePacket,
});

await node.start();
await node.bootstrap({ genesisRelay, genesisPeers });
```

### Pattern 2: Client SDK (client)

Use `CrosstownClient` for application-level integration:

```typescript
import { CrosstownClient } from '@crosstown/client';

const client = new CrosstownClient({
  secretKey,
  relay: 'ws://relay:7100',
  connector: { url: 'http://connector:8080', ilpAddress: '...' },
});

await client.start();
await client.publishEvent(event);
```

### Pattern 3: Manual Integration (core primitives)

Use core primitives for custom integrations:

```typescript
import {
  NostrSpspClient,
  NostrPeerDiscovery,
  buildIlpPeerInfoEvent,
} from '@crosstown/core';

const discovery = new NostrPeerDiscovery(pool, relays);
const peers = await discovery.discoverPeersFromFollow(myPubkey);

const spsp = new NostrSpspClient(pool, relays, secretKey);
const spspInfo = await spsp.request(peerPubkey);
```

---

## Testing Utilities

### Mock Connector (`examples/ilp-gated-relay-demo/mock-connector.ts`)

Simulates ILP payment flow for testing:

```typescript
import { MockIlpConnector } from '@crosstown/examples/ilp-gated-relay-demo/mock-connector';

const connector = new MockIlpConnector({ blsUrl: 'http://bls:3100' });
const response = await connector.sendPayment(event, amount);
```

---

**Generated:** 2026-02-26
**Last Updated:** 2026-02-26
