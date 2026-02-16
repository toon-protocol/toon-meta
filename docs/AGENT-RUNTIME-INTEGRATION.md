# Agent-Runtime Integration Guide

This document explains how to integrate `@agent-society/protocol` with `agent-runtime` to create an ILP-gated Nostr relay.

## Overview

The integration has two main components:

1. **Business Logic Server (BLS)**: Handles incoming payments, stores Nostr events
2. **Peer Discovery**: Discovers ILP peers from Nostr social graph

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        BUSINESS LOGIC SERVER                                 │
│                    (@agent-society/protocol + relay)                         │
│                                                                             │
│  Endpoints:                                                                 │
│    POST /handle-packet  ← Connector calls this on incoming payment         │
│    GET  /health          ← Health check                                     │
│                                                                             │
│  Responsibilities:                                                          │
│    - Decode TOON → Nostr event                                              │
│    - Verify event signature                                                 │
│    - Check payment amount ≥ price                                           │
│    - Store event in relay database                                          │
│    - Return accept/reject to connector                                      │
│                                                                             │
│  Also runs:                                                                 │
│    - NostrPeerDiscoveryService (populates connector routing)                │
│    - SocialTrustManager (derives credit limits)                             │
│    - WebSocket relay server (NIP-01 reads)                                  │
│                                                                             │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
          ┌─────────────────────┼─────────────────────────┐
          │                     │                         │
          ▼                     ▼                         ▼
   POST /handle-packet    Admin API calls         WebSocket :4000
   (payment notifications) (peer/route updates)    (NIP-01 relay)
          │                     │                         │
          ▼                     ▼                         │
┌─────────────────────────────────────────────────────────┴───────────────────┐
│                           agent-runtime                                      │
│                                                                             │
│  ConnectorNode                                                              │
│    ├── BTPClientManager  ← Peers added via Admin API                        │
│    ├── RoutingTable      ← Routes added via Admin API                       │
│    ├── AdminServer       ← REST API for dynamic config (:8081)              │
│    ├── PacketHandler     ← Routes ILP packets                               │
│    └── BLS Integration   ← Calls POST /handle-packet on incoming packets   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Business Logic Server

The BLS is the core of the ILP-gated relay. It receives payment notifications from the connector and decides whether to accept (store event) or reject.

### Required Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/handle-packet` | POST | Called by connector when payment arrives |
| `/health` | GET | Health check for connector to verify BLS is up |

### Payment Flow

```
ILP Prepare arrives at connector
        │
        ▼
Connector extracts: amount, destination, data (TOON event)
        │
        ▼
POST /handle-packet to BLS
{
  "amount": "50000",
  "destination": "g.agent.alice",
  "data": "<base64 TOON-encoded Nostr event>",
  "sourceAccount": "g.agent.bob"
}
        │
        ▼
BLS processes:
  1. Decode TOON → Nostr event
  2. Verify event signature (NIP-01)
  3. Look up price for this event
  4. Check: amount ≥ price?
        │
        ├─── YES ───► Store event, notify subscribers
        │             Return: { "accept": true, "fulfillment": "..." }
        │
        └─── NO ────► Return: { "accept": false, "code": "F06", "message": "Insufficient payment" }
        │
        ▼
Connector returns ILP Fulfill or Reject to sender
```

### BLS Implementation

```typescript
import express from 'express';
import { decodeToon } from 'toon';
import { verifyEvent } from 'nostr-tools';
import { NostrRelay } from './relay';
import { PricingService } from './pricing';

const app = express();
app.use(express.json());

const relay = new NostrRelay();       // Your Nostr relay implementation
const pricing = new PricingService(); // Price lookup from kind:10032

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    relay: relay.isReady(),
    timestamp: Date.now(),
  });
});

// Handle incoming ILP payments
app.post('/handle-packet', async (req, res) => {
  const { amount, destination, data, sourceAccount } = req.body;

  try {
    // 1. Decode TOON → Nostr event
    const toonBytes = Buffer.from(data, 'base64');
    const event = decodeToon(toonBytes);

    // 2. Verify Nostr event signature
    if (!verifyEvent(event)) {
      return res.json({
        accept: false,
        code: 'F00',  // Bad request
        message: 'Invalid event signature',
      });
    }

    // 3. Calculate price for this event
    const price = pricing.getPrice(event);

    // 4. Check payment amount
    if (BigInt(amount) < price) {
      return res.json({
        accept: false,
        code: 'F06',  // Insufficient payment
        message: `Insufficient payment: got ${amount}, need ${price}`,
        metadata: {
          required: price.toString(),
          received: amount,
        },
      });
    }

    // 5. Store event in relay
    await relay.storeEvent(event);

    // 6. Notify WebSocket subscribers
    relay.notifySubscribers(event);

    // 7. Return success with fulfillment
    const fulfillment = generateFulfillment(event.id);

    return res.json({
      accept: true,
      fulfillment: fulfillment,
      metadata: {
        eventId: event.id,
        storedAt: Date.now(),
      },
    });

  } catch (error) {
    console.error('Payment handling error:', error);
    return res.json({
      accept: false,
      code: 'F00',
      message: error.message,
    });
  }
});

function generateFulfillment(eventId: string): string {
  // Generate ILP fulfillment (32 bytes)
  // Could be derived from event ID or use pre-agreed condition
  const hash = crypto.createHash('sha256').update(eventId).digest();
  return hash.toString('base64');
}

app.listen(3001, () => {
  console.log('BLS listening on :3001');
});
```

### Pricing Service

```typescript
import { NostrEvent } from 'nostr-tools';

interface PricingConfig {
  pricePerByte: bigint;
  kindPrices: Map<number, bigint>;
}

export class PricingService {
  constructor(private config: PricingConfig = {
    pricePerByte: 10n,
    kindPrices: new Map([
      [0, 10000n],   // Profile metadata
      [1, 5000n],    // Short text note
      [3, 20000n],   // Follow list
      [7, 1000n],    // Reaction
    ]),
  }) {}

  getPrice(event: NostrEvent): bigint {
    // Check for kind-specific price
    const kindPrice = this.config.kindPrices.get(event.kind);
    if (kindPrice !== undefined) {
      return kindPrice;
    }

    // Default: price per byte
    const eventBytes = JSON.stringify(event).length;
    return BigInt(eventBytes) * this.config.pricePerByte;
  }

  // Load pricing from kind:10032 event
  loadFromPeerInfo(peerInfoEvent: NostrEvent): void {
    for (const tag of peerInfoEvent.tags) {
      if (tag[0] === 'price_per_byte') {
        this.config.pricePerByte = BigInt(tag[1]);
      } else if (tag[0].startsWith('price_kind_')) {
        const kind = parseInt(tag[0].replace('price_kind_', ''));
        this.config.kindPrices.set(kind, BigInt(tag[1]));
      }
    }
  }
}
```

### Configure agent-runtime for BLS

```yaml
# agent-runtime config.yaml
nodeId: my-agent
btpServerPort: 3000
healthCheckPort: 8080

# Business Logic Server configuration
bls:
  enabled: true
  url: http://localhost:3001        # BLS base URL
  handlePacketPath: /handle-packet
  healthPath: /health
  timeout: 5000                      # ms

adminApi:
  enabled: true
  port: 8081
  apiKey: your-secret-api-key
```

## Peer Discovery Integration

In addition to handling payments, the BLS also manages peer discovery via Nostr.

### Combined BLS + Discovery Service

```typescript
import {
  NostrPeerDiscoveryService,
  SocialTrustManager,
  parseIlpPeerInfoEvent,
} from '@agent-society/protocol';
import { SimplePool } from 'nostr-tools';

export class AgentBLS {
  private discovery: NostrPeerDiscoveryService;
  private trustManager: SocialTrustManager;
  private pool: SimplePool;
  private relay: NostrRelay;
  private pricing: PricingService;

  constructor(private config: {
    relays: string[];
    pubkey: string;
    secretKey: Uint8Array;
    adminUrl: string;
    adminApiKey?: string;
  }) {
    this.pool = new SimplePool();
    this.relay = new NostrRelay();
    this.pricing = new PricingService();

    this.discovery = new NostrPeerDiscoveryService({
      relays: config.relays,
      pubkey: config.pubkey,
      pool: this.pool,
    });

    this.trustManager = new SocialTrustManager(
      this.pool,
      config.relays,
      config.pubkey,
      {
        baseCreditForFollowed: 10000n,
        mutualFollowerBonus: 1000n,
        maxCreditLimit: 100000n,
      }
    );
  }

  async start(): Promise<void> {
    // Start HTTP server for BLS endpoints
    await this.startHttpServer();

    // Start WebSocket server for NIP-01 relay
    await this.relay.start();

    // Initialize trust and discovery
    await this.trustManager.initialize();

    // Discover and register peers with connector
    const peers = await this.discovery.discoverPeers();
    for (const peer of peers) {
      await this.registerPeerWithConnector(peer);
    }

    // Subscribe to peer updates
    this.discovery.subscribeToPeerUpdates(async (event) => {
      const peerInfo = parseIlpPeerInfoEvent(event);
      if (peerInfo) {
        await this.registerPeerWithConnector(peerInfo);
      }
    });
  }

  private async registerPeerWithConnector(peer: {
    pubkey: string;
    ilpAddress: string;
    btpEndpoint: string;
  }): Promise<void> {
    const trust = await this.trustManager.computeTrust(peer.pubkey);

    await fetch(`${this.config.adminUrl}/admin/peers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.adminApiKey && {
          'X-Api-Key': this.config.adminApiKey,
        }),
      },
      body: JSON.stringify({
        id: peer.pubkey.slice(0, 16),
        url: peer.btpEndpoint,
        authToken: await this.deriveAuthToken(peer.pubkey),
        routes: [{
          prefix: peer.ilpAddress,
          priority: Math.floor(trust.score),
        }],
      }),
    });
  }

  private async deriveAuthToken(peerPubkey: string): Promise<string> {
    // Derive from NIP-44 conversation key
    return `nostr-${peerPubkey.slice(0, 8)}`;
  }

  // ... BLS endpoint handlers (handle-packet, health) ...
}
```

## Architecture Options

### Option A: Separate Processes (Recommended)

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│  agent-runtime      │     │  Agent BLS          │     │  Nostr Relays       │
│  (ILP Connector)    │     │  (This library)     │     │  (External)         │
│                     │     │                     │     │                     │
│  :3000 BTP          │◄───►│  :3001 BLS API      │◄───►│  wss://relay.io     │
│  :8080 Health       │     │  :4000 NIP-01 WS    │     │                     │
│  :8081 Admin API    │     │                     │     │                     │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
```

**Advantages:**
- Decoupled deployment and scaling
- Independent upgrades
- Clear separation of concerns
- Can run BLS as multiple replicas

### Option B: Single Process

```
┌─────────────────────────────────────────────────────────────┐
│  Combined Agent Process                                      │
│                                                             │
│  ┌─────────────────────┐  ┌─────────────────────┐          │
│  │  ConnectorNode      │  │  AgentBLS           │          │
│  │  (agent-runtime)    │◄─┤  (embedded)         │          │
│  └─────────────────────┘  └─────────────────────┘          │
│                                                             │
│  :3000 BTP, :4000 NIP-01 WS, :8080 Health                   │
└─────────────────────────────────────────────────────────────┘
```

**Advantages:**
- Simpler deployment
- Lower latency (no HTTP calls)
- Single configuration

## Admin API Reference

The BLS uses agent-runtime's Admin API to register discovered peers. See the `AgentBLS.registerPeerWithConnector()` method above for usage.

### Add Peer

```http
POST /admin/peers
Content-Type: application/json
X-Api-Key: your-api-key

{
  "id": "peer-alice",
  "url": "ws://alice.example.com:4000",
  "authToken": "shared-secret",
  "routes": [
    {
      "prefix": "g.alice",
      "priority": 50
    }
  ]
}
```

Response:
```json
{
  "success": true,
  "peer": {
    "id": "peer-alice",
    "url": "ws://alice.example.com:4000",
    "connected": true
  },
  "routes": ["g.alice"],
  "message": "Peer 'peer-alice' added and connected"
}
```

### Remove Peer

```http
DELETE /admin/peers/peer-alice
X-Api-Key: your-api-key
```

### List Peers

```http
GET /admin/peers
X-Api-Key: your-api-key
```

Response:
```json
{
  "peers": [
    {
      "id": "peer-alice",
      "url": "ws://alice.example.com:4000",
      "connected": true,
      "lastSeen": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### Add Route

```http
POST /admin/routes
Content-Type: application/json
X-Api-Key: your-api-key

{
  "prefix": "g.alice.wallet",
  "nextHop": "peer-alice",
  "priority": 100
}
```

### Remove Route

```http
DELETE /admin/routes/g.alice.wallet
X-Api-Key: your-api-key
```

### List Routes

```http
GET /admin/routes
X-Api-Key: your-api-key
```

## Embedded Integration (Option B)

For embedding discovery in the connector, extend `ConnectorNode`:

```typescript
// In agent-runtime codebase
// packages/connector/src/discovery/nostr-discovery-integration.ts

import {
  NostrPeerDiscoveryService,
  SocialTrustManager,
  parseIlpPeerInfoEvent,
} from '@agent-society/protocol';
import { SimplePool } from 'nostr-tools';
import { BTPClientManager } from '../btp/btp-client-manager';
import { RoutingTable } from '../routing/routing-table';

export interface NostrDiscoveryConfig {
  enabled: boolean;
  relays: string[];
  pubkey: string;
  secretKey: Uint8Array;
  trustConfig?: {
    baseCreditForFollowed?: bigint;
    mutualFollowerBonus?: bigint;
    maxCreditLimit?: bigint;
  };
}

export class NostrDiscoveryIntegration {
  private discovery: NostrPeerDiscoveryService;
  private trustManager: SocialTrustManager;
  private pool: SimplePool;

  constructor(
    private config: NostrDiscoveryConfig,
    private btpClientManager: BTPClientManager,
    private routingTable: RoutingTable
  ) {
    this.pool = new SimplePool();

    this.discovery = new NostrPeerDiscoveryService({
      relays: config.relays,
      pubkey: config.pubkey,
      pool: this.pool,
    });

    this.trustManager = new SocialTrustManager(
      this.pool,
      config.relays,
      config.pubkey,
      config.trustConfig ?? {
        baseCreditForFollowed: 10000n,
        mutualFollowerBonus: 1000n,
        maxCreditLimit: 100000n,
      }
    );
  }

  async start(): Promise<void> {
    if (!this.config.enabled) return;

    await this.trustManager.initialize();

    // Discover and add initial peers
    const peers = await this.discovery.discoverPeers();
    for (const peer of peers) {
      await this.addPeer(peer);
    }

    // Subscribe to updates
    this.discovery.subscribeToPeerUpdates(async (event) => {
      const peerInfo = parseIlpPeerInfoEvent(event);
      if (peerInfo) {
        await this.addPeer(peerInfo);
      }
    });
  }

  private async addPeer(peer: {
    pubkey: string;
    ilpAddress: string;
    btpEndpoint: string;
  }): Promise<void> {
    const peerId = `nostr-${peer.pubkey.slice(0, 12)}`;
    const trust = await this.trustManager.computeTrust(peer.pubkey);

    // Add to BTP client manager
    await this.btpClientManager.addPeer({
      id: peerId,
      url: peer.btpEndpoint,
      authToken: await this.deriveAuthToken(peer.pubkey),
      connected: false,
      lastSeen: new Date(),
    });

    // Add route with trust-derived priority
    this.routingTable.addRoute(
      peer.ilpAddress,
      peerId,
      Math.floor(trust.score)
    );

    console.log(`[Nostr] Added peer ${peerId} with trust score ${trust.score}`);
  }

  private async deriveAuthToken(peerPubkey: string): Promise<string> {
    // Implement auth token derivation
    return `nostr-auth-${peerPubkey.slice(0, 8)}`;
  }

  async stop(): Promise<void> {
    this.pool.close([]);
  }
}
```

Then modify `ConnectorNode.start()`:

```typescript
// In connector-node.ts

import { NostrDiscoveryIntegration, NostrDiscoveryConfig } from '../discovery/nostr-discovery-integration';

export class ConnectorNode {
  private nostrDiscovery?: NostrDiscoveryIntegration;

  async start(): Promise<void> {
    // ... existing initialization ...

    // Add after BTPClientManager and RoutingTable are created
    if (this.config.nostrDiscovery?.enabled) {
      this.nostrDiscovery = new NostrDiscoveryIntegration(
        this.config.nostrDiscovery,
        this._btpClientManager,
        this._routingTable
      );
      await this.nostrDiscovery.start();
    }

    // ... rest of startup ...
  }

  async stop(): Promise<void> {
    await this.nostrDiscovery?.stop();
    // ... existing shutdown ...
  }
}
```

Configuration:

```yaml
# config.yaml
nodeId: my-connector
btpServerPort: 3000

nostrDiscovery:
  enabled: true
  relays:
    - wss://relay.damus.io
    - wss://nos.lol
  pubkey: "your-hex-pubkey"
  # secretKey loaded from env or secure storage
  trustConfig:
    baseCreditForFollowed: 50000
    mutualFollowerBonus: 10000
    maxCreditLimit: 500000
```

## Mapping Concepts

| agent-society | agent-runtime | Notes |
|---------------|---------------|-------|
| `AgentBLS` | Business Logic Server | Handles `/handle-packet`, `/health` |
| `NostrRelay.storeEvent()` | BLS accept response | Payment → event storage |
| `PricingService.getPrice()` | BLS accept/reject decision | Amount vs price check |
| `NostrPeerDiscoveryService.discoverPeers()` | `BTPClientManager.addPeer()` | Discovered peers become BTP connections |
| `SocialTrustManager.computeTrust()` | `RoutingTable.addRoute(priority)` | Trust score → route priority |
| `IlpPeerInfo.btpEndpoint` | `Peer.url` | WebSocket URL for BTP |
| `IlpPeerInfo.ilpAddress` | Route prefix | e.g., `g.alice` |
| Follow list (NIP-02) | Peer list | Social graph = network graph |
| `kind:10032` event | Peer configuration | Connector metadata + pricing |

## Authentication Strategies

### Strategy 1: Static Token in kind:10032

Peers publish auth tokens in their ILP Peer Info event:

```json
{
  "kind": 10032,
  "tags": [
    ["ilp_address", "g.alice"],
    ["btp_endpoint", "ws://alice.example:4000"],
    ["btp_auth", "public-shared-token"]
  ]
}
```

**Pros:** Simple, self-contained
**Cons:** Token is public, limited security

### Strategy 2: NIP-44 Encrypted Exchange

Use SPSP request/response to exchange tokens:

```typescript
const spspClient = new NostrSpspClient({ relays, secretKey });
const params = await spspClient.requestSpspParams(peerPubkey);
// params.sharedSecret can be used as auth token
```

**Pros:** End-to-end encrypted, fresh secrets
**Cons:** Requires online peer, more complex

### Strategy 3: Derived from Nostr Keys

Derive BTP auth token from NIP-44 conversation key:

```typescript
import { nip44 } from 'nostr-tools';

const conversationKey = nip44.getConversationKey(mySecretKey, peerPubkey);
const authToken = bytesToHex(conversationKey).slice(0, 32);
```

**Pros:** Deterministic, no exchange needed
**Cons:** Both sides must implement same derivation

## Complete Example

See [examples/nostr-discovery-bridge/](../examples/nostr-discovery-bridge/) for a complete working example with:

- Docker Compose setup
- agent-runtime connector configuration
- Nostr discovery bridge service
- Test relays and sample events

## Troubleshooting

### Peer not connecting

1. Check BTP endpoint is reachable: `wscat -c ws://host:port`
2. Verify auth token matches on both sides
3. Check agent-runtime logs for connection errors
4. Ensure firewall allows WebSocket connections

### Routes not working

1. Verify route prefix matches ILP address format
2. Check `GET /admin/routes` to see current routing table
3. Ensure peer is connected before adding routes
4. Check priority - higher priority routes take precedence

### Trust scores not updating

1. Verify Nostr relays are accessible
2. Check that follow lists (kind:3) are published
3. Ensure `trustManager.initialize()` completes
4. Monitor relay connections with `pool.ensureRelay()`

## Next Steps

1. **BLS Implementation**: Build complete BLS with `/handle-packet` and `/health` endpoints
2. **TOON Integration**: Add TOON encoding/decoding for Nostr events in ILP packets
3. **NIP Proposal**: Formalize event kinds 10032, 10047, 23194, 23195
4. **Auth Token Standard**: Define canonical BTP auth derivation from Nostr keys
5. **Credit Limit Integration**: Wire trust scores to actual credit limits in settlement
6. **Route Propagation**: Implement kind:10033 for multi-hop route announcements
7. **Relay Implementation**: Build NIP-01 compliant relay with WebSocket subscriptions
