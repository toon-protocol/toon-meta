# Deep Research Report: ElizaOS Plugin Integration with Crosstown Protocol

## Executive Summary

### Key Findings on Architectural Fit

Crosstown and ElizaOS are architecturally complementary. Crosstown provides a protocol layer (Nostr-based ILP peer discovery, SPSP handshakes, social trust derivation) while ElizaOS provides an agent runtime (LLM-driven decision making, persistent memory, plugin extensibility). The integration maps naturally:

- Crosstown's **BootstrapService** → ElizaOS **Service** (long-running lifecycle process)
- Crosstown's **SocialTrustManager** + **NostrPeerDiscovery** → ElizaOS **Providers** (contextual data for agent decisions)
- Crosstown's **NostrSpspClient** payment operations → ElizaOS **Actions** (agent-triggered tasks)
- Crosstown's event system → ElizaOS **Events** (inter-component communication)
- ILP connector admin API → ElizaOS **Routes** (external system integration)

### Critical Integration Challenges

1. **Nostr Identity Bridging**: Each ElizaOS agent needs a Nostr keypair. The keypair must be stored securely and persistently linked to the agent's ElizaOS identity. Character `secrets` is the natural home.

2. **NIP-47 Kind Number Overlap**: Crosstown intentionally reuses NIP-47's kind:23194/23195 for SPSP. The encrypted payload content distinguishes them, but co-existence with Nostr Wallet Connect requires careful message routing.

3. **Settlement Incompleteness**: Crosstown's settlement flow is 60-75% complete. The plugin must be designed with clear abstraction boundaries so settlement backends can be swapped as they mature.

4. **Async Bootstrap vs. Sync Actions**: BootstrapService is a multi-phase state machine that may take minutes. ElizaOS Actions are request-response. The Service must manage bootstrap state while Actions report on and interact with it.

### Top 3 Highest-Value Capabilities

1. **"Pay Alice 5 USD" in natural language** — Agent resolves identity, discovers ILP peer, negotiates SPSP, checks trust, routes payment — all from a single conversational command.

2. **Social-graph-driven credit limits** — Agent autonomously manages who it trusts for routing, how much credit to extend, and when to cut off peers — informed by Nostr follow graph and payment history.

3. **Multi-agent ILP mesh** — Multiple ElizaOS agents form an interconnected payment network where trust scores, routing tables, and settlement channels are managed collectively through the shared Nostr relay infrastructure.

### Recommended Implementation Approach

Five iterative phases, each delivering standalone value. Phase 1 establishes the foundation (Service + identity + bootstrap). Each subsequent phase adds capabilities that build on the prior.

---

## Detailed Analysis

### 1. Plugin Architecture Specification

#### 1.1 Plugin Entry Point

```typescript
import type { Plugin } from '@elizaos/core';

const crosstownPlugin: Plugin = {
  name: '@crosstown/elizaos-plugin',
  dependencies: [],  // No ElizaOS plugin dependencies
  priority: 10,

  init: async (config: CrosstownConfig, runtime: IAgentRuntime) => {
    // Validate Nostr keypair exists in character secrets
    // Initialize nostr-tools SimplePool
    // Prepare configuration from character settings
  },

  actions: [
    payAction,
    requestPaymentAction,
    discoverPeersAction,
    checkTrustAction,
    bootstrapNetworkAction,
    publishPeerInfoAction,
  ],

  providers: [
    trustScoreProvider,
    peerStatusProvider,
    ilpBalanceProvider,
    networkStatusProvider,
    paymentHistoryProvider,
  ],

  services: [
    CrosstownService,        // Core lifecycle + bootstrap
    NostrRelayService,          // Relay connection management
    PaymentChannelService,      // Settlement channel monitoring
  ],

  evaluators: [
    paymentOutcomeEvaluator,
    trustEvolutionEvaluator,
  ],

  events: {
    [EventType.MESSAGE_RECEIVED]: [handleIncomingSpspRequest],
    [EventType.WORLD_JOINED]: [initializeNostrIdentity],
  },

  routes: [
    { type: 'GET', path: '/status', handler: getNetworkStatus },
    { type: 'GET', path: '/peers', handler: getPeerList },
    { type: 'GET', path: '/trust/:pubkey', handler: getTrustScore },
    { type: 'POST', path: '/connector/webhook', handler: handleConnectorWebhook },
    { type: 'GET', path: '/payments', handler: getPaymentHistory },
  ],
};
```

#### 1.2 Complete Component Inventory

##### Actions (6)

| Action | Description | Crosstown Classes | Trigger |
|--------|-------------|----------------------|---------|
| `PAY` | Send ILP payment to a peer | `NostrSpspClient`, `SocialTrustManager`, `NostrPeerDiscovery` | "Pay Alice 5 USD" |
| `REQUEST_PAYMENT` | Request payment from a peer via SPSP | `NostrSpspServer` | "Request 10 USD from Bob" |
| `DISCOVER_PEERS` | Scan follow list for ILP-capable peers | `NostrPeerDiscovery` | "Find new payment peers" |
| `CHECK_TRUST` | Compute and report trust score for a peer | `SocialTrustManager` | "How much do I trust Carol?" |
| `BOOTSTRAP_NETWORK` | Trigger or restart bootstrap process | `BootstrapService` | "Bootstrap my ILP network" |
| `PUBLISH_PEER_INFO` | Publish/update kind:10032 event | `buildIlpPeerInfoEvent` | "Update my ILP peer info" |

##### Providers (5)

| Provider | Description | Data Surfaced | Position |
|----------|-------------|---------------|----------|
| `trustScoreProvider` | Current trust scores for mentioned peers | Trust score breakdown, credit limits, social distance | 10 |
| `peerStatusProvider` | Connected ILP peer status | Peer count, online/offline, last seen, asset codes | 20 |
| `ilpBalanceProvider` | ILP connector balances | Balance per peer, pending settlements, total routing capacity | 30 |
| `networkStatusProvider` | Bootstrap phase, relay connectivity | Current phase, connected relays, error states | 5 |
| `paymentHistoryProvider` | Recent payment activity | Last N payments, success rate, volume by peer | 40 |

##### Services (3)

| Service | serviceType | Description | Lifecycle |
|---------|-------------|-------------|-----------|
| `CrosstownService` | `'crosstown'` | Core service managing Nostr identity, bootstrap state machine, SPSP server | Starts on agent init, runs bootstrap phases, listens for SPSP requests |
| `NostrRelayService` | `'nostr_relay'` | Manages SimplePool connections, subscription lifecycle, reconnection | Starts after CrosstownService, maintains relay connections |
| `PaymentChannelService` | `'payment_channel'` | Monitors settlement channels, manages open/close lifecycle | Starts after bootstrap reaches `ready` phase |

##### Evaluators (2)

| Evaluator | Description | When It Runs |
|-----------|-------------|--------------|
| `paymentOutcomeEvaluator` | Assesses payment success/failure, records outcome in memory | After PAY action completes |
| `trustEvolutionEvaluator` | Recalculates trust scores based on interaction history | After any peer interaction |

##### Events (Custom)

```typescript
// Extend ElizaOS EventType via module augmentation
declare module '@elizaos/core' {
  interface EventPayloadMap {
    SPSP_REQUEST_RECEIVED: SpspRequestPayload;
    SPSP_RESPONSE_SENT: SpspResponsePayload;
    PAYMENT_SENT: PaymentEventPayload;
    PAYMENT_RECEIVED: PaymentEventPayload;
    PEER_DISCOVERED: PeerDiscoveredPayload;
    PEER_LOST: PeerLostPayload;
    BOOTSTRAP_PHASE_CHANGED: BootstrapPhasePayload;
    TRUST_SCORE_UPDATED: TrustScoreUpdatedPayload;
    CHANNEL_OPENED: ChannelOpenedPayload;
    CHANNEL_CLOSED: ChannelClosedPayload;
  }
}
```

##### Routes (5)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/status` | Public | Network status, bootstrap phase, peer count |
| GET | `/peers` | Private | Full peer list with trust scores and ILP info |
| GET | `/trust/:pubkey` | Private | Trust score for specific peer |
| POST | `/connector/webhook` | Private | ILP connector callbacks (payment received, balance updates) |
| GET | `/payments` | Private | Payment history with filtering |

#### 1.3 Configuration Schema

```typescript
interface CrosstownConfig {
  // Nostr Configuration
  nostrRelays: string[];                    // Relay URLs for peer discovery
  nostrPrivateKey?: string;                 // Override: usually from character.secrets

  // ILP Configuration
  ilpAddress: string;                       // Agent's ILP address (e.g., "g.agent.alice")
  btpEndpoint: string;                      // BTP WebSocket URL for connector
  connectorAdminUrl: string;                // ILP connector admin API URL
  assetCode: string;                        // Default: "USD"
  assetScale: number;                       // Default: 9

  // Settlement Configuration
  supportedChains: string[];                // e.g., ["evm:base:8453"]
  settlementAddresses: Record<string, string>;
  preferredTokens: Record<string, string>;

  // Trust Configuration
  maxSocialDistance: number;                 // Default: 3
  trustWeights: {
    socialDistance: number;                  // Default: 0.5
    mutualFollowers: number;                // Default: 0.3
    reputation: number;                     // Default: 0.2
  };
  creditLimitCurve: 'linear' | 'exponential';  // Default: 'linear'
  maxCreditLimit: number;                   // Default: 1000 (in asset units)

  // Bootstrap Configuration
  genesisFile?: string;                     // Path to genesis peer list
  arDriveRegistry?: string;                 // ArDrive registry URL
  autoBootstrap: boolean;                   // Default: true

  // Operational
  paymentConfirmationThreshold: number;     // Trust score above which payments auto-execute
  maxPaymentAmount: number;                 // Safety limit
  autonomousMode: boolean;                  // Enable autonomous peer management
}
```

**Character Configuration Example:**

```json
{
  "name": "PaymentAgent",
  "plugins": ["@crosstown/elizaos-plugin"],
  "settings": {
    "CROSSTOWN_ILP_ADDRESS": "g.agent.payment-agent",
    "CROSSTOWN_BTP_ENDPOINT": "ws://localhost:7768",
    "CROSSTOWN_CONNECTOR_ADMIN_URL": "http://localhost:7769",
    "CROSSTOWN_ASSET_CODE": "USD",
    "CROSSTOWN_ASSET_SCALE": "9",
    "CROSSTOWN_RELAYS": "wss://relay.damus.io,wss://relay.nostr.band",
    "CROSSTOWN_SUPPORTED_CHAINS": "evm:base:8453",
    "CROSSTOWN_AUTO_BOOTSTRAP": "true",
    "CROSSTOWN_AUTONOMOUS_MODE": "false",
    "CROSSTOWN_MAX_PAYMENT": "100",
    "CROSSTOWN_TRUST_THRESHOLD": "0.5"
  },
  "secrets": {
    "CROSSTOWN_NOSTR_PRIVATE_KEY": "<hex-encoded-nostr-private-key>",
    "CROSSTOWN_SETTLEMENT_KEY": "<settlement-chain-private-key>"
  }
}
```

#### 1.4 Component Dependency Graph

```
CrosstownService (core)
    ├── NostrRelayService (relay connections)
    │       └── used by: trustScoreProvider, peerStatusProvider, discoverPeersAction
    ├── PaymentChannelService (settlement)
    │       └── used by: ilpBalanceProvider, PAY action
    ├── trustScoreProvider
    │       └── used by: PAY action (trust check), CHECK_TRUST action
    ├── peerStatusProvider
    │       └── used by: PAY action (peer resolution), DISCOVER_PEERS action
    └── paymentHistoryProvider
            └── used by: paymentOutcomeEvaluator, trustEvolutionEvaluator
```

---

### 2. Integration Architecture

#### 2.1 Data Flow: Agent Bootstrap into ILP Network

```
Agent Startup
    │
    ▼
ElizaOS runtime.initialize()
    │
    ├── registerPlugin(@crosstown/elizaos-plugin)
    │       ├── plugin.init() → validate config, create SimplePool
    │       ├── register Actions, Providers, Evaluators, Routes
    │       └── register Services
    │
    ├── CrosstownService.start(runtime)
    │       ├── Load Nostr keypair from character.secrets
    │       ├── Derive Nostr pubkey from private key
    │       ├── Store Nostr identity as Entity Component
    │       └── If autoBootstrap: start BootstrapService
    │
    ├── NostrRelayService.start(runtime)
    │       ├── Connect to configured relays via SimplePool
    │       ├── Subscribe to kind:10032 events from follow list
    │       └── Subscribe to kind:23194 events (incoming SPSP requests)
    │
    └── BootstrapService (5-phase state machine)
            │
            Phase 1: discovering
            │   ├── GenesisPeerLoader.loadPeers()
            │   ├── ArDrivePeerRegistry.loadPeers() (if configured)
            │   └── Emit BOOTSTRAP_PHASE_CHANGED event
            │
            Phase 2: registering
            │   ├── For each discovered peer:
            │   │   ├── Query kind:10032 event for ILP info
            │   │   ├── Compute trust score via SocialTrustManager
            │   │   ├── Register peer with ILP connector via ConnectorAdminClient
            │   │   └── Emit PEER_DISCOVERED event
            │   └── Store peer info in ElizaOS Memory (type: 'custom', tags: ['ilp-peer'])
            │
            Phase 3: handshaking
            │   ├── For each registered peer:
            │   │   ├── Send SPSP request (kind:23194, NIP-44 encrypted)
            │   │   ├── Await SPSP response (kind:23195)
            │   │   ├── Negotiate settlement parameters
            │   │   └── Open payment channel via ConnectorChannelClient
            │   └── Emit CHANNEL_OPENED events
            │
            Phase 4: announcing
            │   ├── Build own kind:10032 event with ILP info
            │   ├── Sign and publish to relays
            │   └── Emit BOOTSTRAP_PHASE_CHANGED
            │
            Phase 5: ready
                ├── Emit BOOTSTRAP_PHASE_CHANGED (ready)
                ├── Start NostrSpspServer (listen for incoming SPSP requests)
                └── PaymentChannelService.start() now safe to proceed
```

#### 2.2 Data Flow: Agent Sends a Payment

```
User: "Pay Alice 5 USD"
    │
    ▼
ElizaOS Message Processing Pipeline
    │
    ├── State Composition (Providers run in parallel)
    │   ├── trustScoreProvider → {alice: {score: 0.82, distance: 1, ...}}
    │   ├── peerStatusProvider → {alice: {online: true, ilpAddress: "g.agent.alice", ...}}
    │   ├── ilpBalanceProvider → {alice: {balance: 50.00, creditLimit: 100.00}}
    │   └── networkStatusProvider → {phase: "ready", connectedRelays: 3}
    │
    ├── Action Selection (LLM chooses PAY action)
    │   └── LLM sees trust score, peer status, balance — decides PAY is appropriate
    │
    ├── PAY Action Execution
    │   │
    │   ├── 1. Resolve "Alice" to Nostr pubkey
    │   │   ├── Check ElizaOS Memory for known entities named "Alice"
    │   │   ├── If not found: try NIP-05 resolution (alice@domain.com)
    │   │   └── If still not found: ask user for pubkey
    │   │
    │   ├── 2. Trust Check
    │   │   ├── SocialTrustManager.getTrustScore(alicePubkey)
    │   │   ├── If score < paymentConfirmationThreshold:
    │   │   │   └── Return confirmation prompt to user
    │   │   └── If score >= threshold: proceed automatically
    │   │
    │   ├── 3. SPSP Negotiation
    │   │   ├── NostrSpspClient.requestSpspParams(alicePubkey)
    │   │   ├── Send kind:23194 event (NIP-44 encrypted)
    │   │   ├── Await kind:23195 response with destinationAccount + sharedSecret
    │   │   └── Verify settlement compatibility
    │   │
    │   ├── 4. ILP Payment
    │   │   ├── AgentRuntimeClient.sendIlpPrepare({
    │   │   │     destination: spspInfo.destinationAccount,
    │   │   │     amount: 5_000_000_000n,  // 5 USD at scale 9
    │   │   │     data: streamPacket
    │   │   │   })
    │   │   └── Await ILP FULFILL or REJECT
    │   │
    │   └── 5. Report Result
    │       ├── Create Memory: {type: 'custom', tags: ['payment', 'sent'], ...}
    │       └── Return success/failure message to conversation
    │
    └── Evaluation
        ├── paymentOutcomeEvaluator → record success/failure, amount, peer
        └── trustEvolutionEvaluator → adjust trust score based on outcome
```

#### 2.3 Data Flow: Agent Discovers and Evaluates a New Peer

```
NostrRelayService detects new kind:10032 event from followed pubkey
    │
    ▼
Emit PEER_DISCOVERED event
    │
    ├── CrosstownService handles event:
    │   ├── Parse IlpPeerInfo from event
    │   ├── Compute trust score via SocialTrustManager
    │   ├── Compute credit limit from trust score
    │   ├── Store as Entity Component: {type: 'ilp-peer', data: {...}}
    │   ├── Create Memory: {type: 'custom', tags: ['peer-discovery'], content: {...}}
    │   └── If autonomousMode and trust >= threshold:
    │       ├── Register peer with ILP connector
    │       ├── Initiate SPSP handshake
    │       └── Open payment channel
    │
    └── Agent can discuss new peer in conversation:
        "I discovered a new ILP peer: Bob (trust: 0.75, 2 hops away).
         Should I establish a payment channel?"
```

#### 2.4 Data Flow: Agent Receives a Payment Request

```
kind:23194 SPSP Request arrives via Nostr relay
    │
    ▼
NostrRelayService routes to CrosstownService
    │
    ├── Decrypt NIP-44 payload
    ├── Validate sender is in follow graph
    ├── Compute trust score for sender
    │
    ├── If trust score > 0:
    │   ├── NostrSpspServer.handleRequest()
    │   ├── Generate fresh SPSP params (destinationAccount, sharedSecret)
    │   ├── Negotiate settlement parameters
    │   ├── Build kind:23195 response (NIP-44 encrypted)
    │   ├── Publish to relay
    │   └── Emit SPSP_RESPONSE_SENT event
    │
    └── If trust score == 0 (unknown peer):
        ├── Log the request in Memory
        └── Optionally notify agent/user of untrusted SPSP attempt
```

#### 2.5 State Management Design

| Data | ElizaOS Location | Crosstown Location | Sync Strategy |
|------|-----------------|----------------------|---------------|
| Nostr keypair | `character.secrets` | N/A (derived at init) | Character is source of truth |
| Peer list | Entity Components (`type: 'ilp-peer'`) | `NostrPeerDiscovery` cache | Sync on discovery events |
| Trust scores | Provider (computed on-demand) | `SocialTrustManager` cache | Recompute per-request, cache in state |
| Payment history | Memory (`tags: ['payment']`) | N/A (plugin creates) | ElizaOS Memory is source of truth |
| Bootstrap state | Service internal state | `BootstrapService` state machine | Service wraps BootstrapService |
| ILP balances | Provider (fetched from connector) | Connector internal | Fetched on-demand from connector API |
| Channel state | Service internal state | `ConnectorChannelClient` | Service wraps channel client |
| Follow graph | Relationship records | `SocialTrustManager` graph | Nostr relay is source of truth |

---

### 3. Detailed Component Designs

#### 3.1 CrosstownService (Core Service)

```typescript
import { Service, type IAgentRuntime } from '@elizaos/core';
import {
  BootstrapService, NostrPeerDiscovery, NostrSpspClient,
  NostrSpspServer, SocialTrustManager
} from '@crosstown/core';

export class CrosstownService extends Service {
  static serviceType = 'crosstown' as const;
  capabilityDescription = 'Manages Nostr identity and ILP network participation';

  private bootstrapService!: BootstrapService;
  private peerDiscovery!: NostrPeerDiscovery;
  private spspClient!: NostrSpspClient;
  private spspServer!: NostrSpspServer;
  private trustManager!: SocialTrustManager;
  private nostrKeypair!: { privateKey: Uint8Array; publicKey: string };

  static async start(runtime: IAgentRuntime): Promise<CrosstownService> {
    const service = new CrosstownService(runtime);

    // 1. Load Nostr identity from character secrets
    const nsec = runtime.getSetting('CROSSTOWN_NOSTR_PRIVATE_KEY');
    if (!nsec) throw new Error('CROSSTOWN_NOSTR_PRIVATE_KEY required');
    service.nostrKeypair = deriveKeypair(nsec as string);

    // 2. Store Nostr pubkey as Entity Component for other plugins
    await runtime.createEntity({
      id: runtime.agentId,
      names: [runtime.character.name],
      agentId: runtime.agentId,
      metadata: { nostrPubkey: service.nostrKeypair.publicKey },
    });

    // 3. Initialize Crosstown subsystems
    const relays = (runtime.getSetting('CROSSTOWN_RELAYS') as string)?.split(',') || [];

    service.peerDiscovery = new NostrPeerDiscovery(relays);
    service.trustManager = new SocialTrustManager(relays, {
      maxSocialDistance: Number(runtime.getSetting('CROSSTOWN_MAX_SOCIAL_DISTANCE') || 3),
    });
    service.spspClient = new NostrSpspClient(relays, service.nostrKeypair.privateKey);
    service.spspServer = new NostrSpspServer(relays, service.nostrKeypair.privateKey, {
      ilpAddress: runtime.getSetting('CROSSTOWN_ILP_ADDRESS') as string,
    });

    // 4. Auto-bootstrap if configured
    if (runtime.getSetting('CROSSTOWN_AUTO_BOOTSTRAP') !== 'false') {
      service.bootstrapService = new BootstrapService(/* config */);

      service.bootstrapService.on('bootstrap:phase', (phase) => {
        runtime.emitEvent('BOOTSTRAP_PHASE_CHANGED' as any, {
          runtime, source: 'crosstown', phase,
        });
      });

      service.bootstrapService.on('bootstrap:peer-registered', (peer) => {
        runtime.emitEvent('PEER_DISCOVERED' as any, {
          runtime, source: 'crosstown', peer,
        });
        // Persist peer as memory
        runtime.createMemory({
          entityId: runtime.agentId,
          roomId: /* agent self-room */,
          content: { text: `Discovered ILP peer: ${peer.ilpAddress}`, peer },
          metadata: { type: 'custom', tags: ['ilp-peer', 'discovery'] },
        }, 'memories');
      });

      await service.bootstrapService.start();
    }

    return service;
  }

  // Accessors for Actions and Providers
  getPeerDiscovery(): NostrPeerDiscovery { return this.peerDiscovery; }
  getTrustManager(): SocialTrustManager { return this.trustManager; }
  getSpspClient(): NostrSpspClient { return this.spspClient; }
  getSpspServer(): NostrSpspServer { return this.spspServer; }
  getBootstrapPhase(): string { return this.bootstrapService?.getPhase() || 'not-started'; }
  getNostrPubkey(): string { return this.nostrKeypair.publicKey; }

  async stop(): Promise<void> {
    await this.bootstrapService?.stop();
    await this.spspServer?.stop();
    this.peerDiscovery?.close();
    this.trustManager?.close();
  }
}
```

#### 3.2 PAY Action

```typescript
import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from '@elizaos/core';

export const payAction: Action = {
  name: 'PAY',
  description: 'Send an ILP payment to a peer. Use when the user wants to pay someone.',
  similes: ['SEND_PAYMENT', 'TRANSFER', 'SEND_MONEY', 'PAY_PEER'],

  examples: [
    [
      { name: 'user', content: { text: 'Pay Alice 5 USD' } },
      { name: 'agent', content: { text: 'I\'ll send 5 USD to Alice via ILP.', actions: ['PAY'] } },
    ],
    [
      { name: 'user', content: { text: 'Send 0.50 to bob@example.com' } },
      { name: 'agent', content: { text: 'Sending 0.50 USD to bob@example.com.', actions: ['PAY'] } },
    ],
  ],

  validate: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
    // Check that CrosstownService is running and bootstrap is ready
    const service = runtime.getService<CrosstownService>('crosstown');
    if (!service) return false;

    const phase = service.getBootstrapPhase();
    if (phase !== 'ready') return false;

    // Check message contains payment intent (amount + recipient)
    const text = message.content.text?.toLowerCase() || '';
    return /pay|send|transfer/.test(text) && /\d/.test(text);
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    options: Record<string, unknown>,
    callback: HandlerCallback,
  ): Promise<void> => {
    const service = runtime.getService<CrosstownService>('crosstown');
    if (!service) {
      await callback({ text: 'Crosstown service is not available.' });
      return;
    }

    // 1. Parse payment intent from message
    const { recipient, amount, currency } = parsePaymentIntent(message.content.text || '');
    if (!recipient || !amount) {
      await callback({ text: 'I need a recipient and amount. Example: "Pay Alice 5 USD"' });
      return;
    }

    // 2. Resolve recipient to Nostr pubkey
    const pubkey = await resolveRecipient(runtime, service, recipient);
    if (!pubkey) {
      await callback({ text: `I couldn't find "${recipient}" in my peer network. Please provide their Nostr pubkey or NIP-05 address.` });
      return;
    }

    // 3. Check trust score
    const trustScore = await service.getTrustManager().getTrustScore(
      service.getNostrPubkey(), pubkey
    );

    const threshold = Number(runtime.getSetting('CROSSTOWN_TRUST_THRESHOLD') || 0.5);
    if (trustScore.score < threshold) {
      await callback({
        text: `Trust score for ${recipient} is ${trustScore.score.toFixed(2)} (below threshold ${threshold}). ` +
              `Social distance: ${trustScore.socialDistance} hops, ` +
              `${trustScore.mutualFollowerCount} mutual followers. ` +
              `Proceed anyway?`,
      });
      // In a real implementation, this would await user confirmation
      return;
    }

    // 4. SPSP negotiation
    await callback({ text: `Negotiating payment with ${recipient}...` });

    try {
      const spspInfo = await service.getSpspClient().requestSpspParams(pubkey);

      // 5. Send ILP payment
      const result = await sendIlpPayment(runtime, service, {
        destination: spspInfo.destinationAccount,
        sharedSecret: spspInfo.sharedSecret,
        amount: BigInt(Math.round(amount * 10 ** 9)), // Scale 9
      });

      // 6. Record payment in memory
      await runtime.createMemory({
        entityId: runtime.agentId,
        roomId: message.roomId,
        content: {
          text: `Payment sent: ${amount} ${currency} to ${recipient}`,
          source: 'crosstown',
          payment: {
            recipient, pubkey, amount, currency,
            destination: spspInfo.destinationAccount,
            status: result.success ? 'fulfilled' : 'rejected',
            timestamp: Date.now(),
          },
        },
        metadata: { type: 'custom', tags: ['payment', 'sent', result.success ? 'success' : 'failed'] },
      }, 'memories');

      // 7. Report result
      if (result.success) {
        await callback({ text: `Payment of ${amount} ${currency} to ${recipient} was successful.` });
      } else {
        await callback({ text: `Payment failed: ${result.error}` });
      }

      // 8. Emit event for evaluators
      await runtime.emitEvent('PAYMENT_SENT' as any, {
        runtime, source: 'crosstown',
        recipient: pubkey, amount, currency, success: result.success,
      });

    } catch (error) {
      await callback({ text: `Payment failed: ${error instanceof Error ? error.message : 'Unknown error'}` });
    }
  },
};
```

#### 3.3 Trust Score Provider

```typescript
import type { Provider, IAgentRuntime, Memory, State, ProviderResult } from '@elizaos/core';

export const trustScoreProvider: Provider = {
  name: 'trustScore',
  description: 'Provides trust scores for peers mentioned in the conversation',
  position: 10,  // Run early — trust informs all payment decisions

  get: async (runtime: IAgentRuntime, message: Memory, state: State): Promise<ProviderResult> => {
    const service = runtime.getService<CrosstownService>('crosstown');
    if (!service || service.getBootstrapPhase() !== 'ready') {
      return { text: '', values: {}, data: {} };
    }

    // Extract mentioned names/pubkeys from the message
    const mentionedPeers = extractPeerMentions(message.content.text || '');
    if (mentionedPeers.length === 0) {
      return { text: '', values: {}, data: {} };
    }

    const trustData: Record<string, any> = {};
    const textParts: string[] = [];

    for (const peer of mentionedPeers) {
      const pubkey = await resolveRecipient(runtime, service, peer);
      if (!pubkey) continue;

      const score = await service.getTrustManager().getTrustScore(
        service.getNostrPubkey(), pubkey
      );

      trustData[peer] = {
        score: score.score,
        socialDistance: score.socialDistance,
        mutualFollowers: score.mutualFollowerCount,
        breakdown: score.breakdown,
        creditLimit: computeCreditLimit(score.score, runtime),
      };

      textParts.push(
        `Trust for ${peer}: ${(score.score * 100).toFixed(0)}% ` +
        `(${score.socialDistance} hops, ${score.mutualFollowerCount} mutual followers, ` +
        `credit limit: $${computeCreditLimit(score.score, runtime).toFixed(2)})`
      );
    }

    return {
      text: textParts.length > 0 ? `\n## Peer Trust Scores\n${textParts.join('\n')}` : '',
      values: { trustScores: trustData },
      data: { providers: { trustScore: trustData } },
    };
  },
};
```

---

### 4. Bootstrap Lifecycle Integration

#### 4.1 Mapping Crosstown Phases to ElizaOS Lifecycle

| Crosstown Phase | ElizaOS Stage | Integration Point |
|---------------------|---------------|-------------------|
| (pre-bootstrap) | `plugin.init()` | Validate config, create SimplePool |
| (pre-bootstrap) | `Service.start()` | Load keypair, initialize subsystems |
| Phase 1: `discovering` | Service internal | GenesisPeerLoader, ArDrive, environment scan |
| Phase 2: `registering` | Service internal + Memory writes | Create Entity Components for each peer |
| Phase 3: `handshaking` | Service internal + Event emissions | SPSP negotiation, channel opening |
| Phase 4: `announcing` | Service internal | Publish kind:10032 to relays |
| Phase 5: `ready` | Service ready signal | Other services can proceed, Actions become valid |

#### 4.2 Bootstrap as Service (Recommended Approach)

Bootstrap should run as part of the `CrosstownService` lifecycle, not as a standalone Action. Rationale:

1. **Automatic**: Agents should participate in the ILP network by default, not require manual triggering.
2. **Idempotent**: Service restart re-runs bootstrap from the last successful phase.
3. **Observable**: The `networkStatusProvider` surfaces bootstrap progress to the agent's context, so the LLM can explain status to users.
4. **Overridable**: The `BOOTSTRAP_NETWORK` Action allows manual trigger/restart for cases where automatic bootstrap fails or the user wants to force a refresh.

#### 4.3 Bootstrap Failure Handling

```
Phase fails → BootstrapService emits error event
    │
    ├── CrosstownService catches error
    │   ├── Log error in Memory (tags: ['bootstrap', 'error'])
    │   ├── Emit BOOTSTRAP_PHASE_CHANGED with error details
    │   └── Set service state to 'bootstrap-failed'
    │
    ├── networkStatusProvider surfaces error to agent context:
    │   "Bootstrap stalled at phase 3 (handshaking): SPSP timeout for peer g.agent.bob"
    │
    ├── Agent can communicate status to user:
    │   "I'm having trouble connecting to the ILP network. The SPSP handshake
    │    with Bob timed out. Would you like me to retry or skip this peer?"
    │
    └── BOOTSTRAP_NETWORK Action allows manual intervention:
        "Bootstrap my ILP network" → restart from failed phase
```

---

### 5. Nostr Identity Management

#### 5.1 Keypair Storage

**Recommended: Character `secrets` field**

```json
{
  "secrets": {
    "CROSSTOWN_NOSTR_PRIVATE_KEY": "nsec1..."
  }
}
```

Rationale:
- `secrets` is the ElizaOS convention for sensitive configuration
- `getSetting()` resolves secrets with highest priority from `character.secrets`
- Secrets are masked in settings UI (`secret: true` in Setting interface)
- Separate from public `settings` to prevent accidental exposure

#### 5.2 Identity Mapping

Each ElizaOS agent MUST have its own Nostr identity (1:1 mapping). Rationale:

- **Nostr events are signed by a single keypair** — shared identities would create ambiguous signatures
- **Follow lists (NIP-02) are per-pubkey** — each agent maintains its own peer network
- **Trust scores depend on social distance from a specific pubkey** — shared identity breaks the trust model
- **SPSP handshakes are encrypted to a specific pubkey** — shared identity means all agents can decrypt all handshakes

#### 5.3 Identity Initialization Flow

```
CrosstownService.start()
    │
    ├── Read CROSSTOWN_NOSTR_PRIVATE_KEY from character.secrets
    │
    ├── If not found:
    │   ├── Generate new keypair: generateSecretKey() from nostr-tools
    │   ├── Derive public key: getPublicKey(secretKey)
    │   ├── Warn user: "Generated new Nostr identity. Save this key to persist across restarts."
    │   └── Store temporarily (lost on restart if not saved to secrets)
    │
    ├── Derive public key from secret key
    ├── Store as Entity Component: {type: 'nostr-identity', data: {pubkey, npub}}
    │
    └── Optional: NIP-05 verification
        ├── If CROSSTOWN_NIP05 is set (e.g., "agent@colony.example.com"):
        │   ├── Verify DNS record matches derived pubkey
        │   └── Store NIP-05 identifier for human-readable reference
        └── Publish kind:0 metadata event with NIP-05 field
```

---

### 6. Payment Action Design (End-to-End)

#### 6.1 Conversation Flow

```
User: "Pay Alice 5 USD"

Agent (internal — Provider context gathered):
  Trust for Alice: 82% (1 hop, 5 mutual followers, credit limit: $82.00)
  Alice peer status: online, ILP address: g.agent.alice
  Current balance with Alice: $50.00 available

Agent: "Sending 5 USD to Alice. Trust score: 82%. Proceeding..."

Agent (internal — PAY Action executes):
  1. Resolve "Alice" → npub1alice... (from Memory)
  2. Trust check: 0.82 > 0.50 threshold → auto-approve
  3. SPSP request → kind:23194 encrypted to Alice
  4. SPSP response ← kind:23195 with destination + secret
  5. ILP PREPARE → connector routes to Alice
  6. ILP FULFILL ← payment successful

Agent: "Payment of 5 USD to Alice was successful. Transaction recorded."
```

#### 6.2 Recipient Resolution Strategy

Priority order for resolving "Alice" to a Nostr pubkey:

1. **ElizaOS Memory search**: Search for entities/memories tagged with name "Alice"
2. **Entity Component lookup**: Check Entity Components of type 'ilp-peer' for matching names
3. **NIP-05 resolution**: If input looks like `alice@domain.com`, resolve via DNS
4. **Direct pubkey**: If input is `npub1...` or hex pubkey, use directly
5. **Nostr profile search**: Query relays for kind:0 events matching name (last resort, unreliable)
6. **Ask user**: "I couldn't find Alice. Please provide their Nostr pubkey or NIP-05 address."

#### 6.3 Trust Thresholds and Confirmation Logic

| Trust Score | Amount | Behavior |
|-------------|--------|----------|
| >= threshold (0.5) | <= max | Auto-execute, report result |
| >= threshold (0.5) | > max | Prompt for confirmation (amount exceeds safety limit) |
| > 0, < threshold | Any | Prompt: "Trust score is low. Proceed?" |
| == 0 | Any | Reject: "Unknown peer. Cannot route payment." |
| Social distance > 3 | Any | Reject: "Peer is too distant in the social graph." |

---

### 7. Trust-Informed Decision Making

#### 7.1 Trust as a Provider

The `trustScoreProvider` enriches every conversation about a peer with trust data. This means the LLM naturally factors trust into its responses:

- **Payment decisions**: "Alice has a trust score of 82%, I'll proceed with the payment."
- **Routing choices**: "I can route through Bob (trust: 90%) or Carol (trust: 45%). I'll use Bob."
- **Credit extension**: "David has a trust score of 30%. I'll only extend $30 credit."
- **Peer acceptance**: "Eve wants to peer with me. Trust score: 15% — I'll decline."

#### 7.2 Trust Score in Memory

Trust scores are computed on-demand (not cached in memory) because:
- The Nostr social graph changes (new follows, unfollows)
- Payment history evolves
- Caching stale trust scores leads to incorrect decisions

However, **trust snapshots** are stored in Memory for historical analysis:

```typescript
// After each significant interaction, record a trust snapshot
await runtime.createMemory({
  entityId: runtime.agentId,
  roomId: selfRoomId,
  content: {
    text: `Trust snapshot for ${peerName}: ${score.score.toFixed(2)}`,
    trustSnapshot: {
      pubkey, score: score.score,
      socialDistance: score.socialDistance,
      mutualFollowers: score.mutualFollowerCount,
      timestamp: Date.now(),
      trigger: 'payment_completed',
    },
  },
  metadata: { type: 'custom', tags: ['trust', 'snapshot', pubkey] },
}, 'memories');
```

This enables queries like: "How has my trust with Alice changed over time?"

#### 7.3 Handling Untrusted Peers

For peers with social distance > 3 (outside the agent's trust horizon):

1. **No automatic interaction** — the agent will not route payments through or to untrusted peers
2. **Discovery notification** — if autonomousMode, the agent logs the discovery but takes no action
3. **User escalation** — in conversational mode, the agent informs the user: "I discovered a peer (Dave) but they're outside my trust network (4 hops away). Would you like me to follow them to bring them within trust range?"
4. **Follow suggestion** — the agent can suggest following intermediate nodes to reduce social distance

---

### 8. State and Memory Integration

#### 8.1 Memory Types for Payment Data

| Memory Purpose | MemoryType | Tags | Content Fields |
|---------------|-----------|------|----------------|
| Payment sent | `custom` | `['payment', 'sent', 'success'/'failed']` | recipient, amount, currency, destination, timestamp |
| Payment received | `custom` | `['payment', 'received']` | sender, amount, currency, timestamp |
| Peer discovery | `custom` | `['ilp-peer', 'discovery']` | pubkey, ilpAddress, btpEndpoint, trustScore |
| Trust snapshot | `custom` | `['trust', 'snapshot', pubkey]` | pubkey, score, socialDistance, mutualFollowers, trigger |
| SPSP handshake | `custom` | `['spsp', 'handshake']` | pubkey, destination, settlementChain, timestamp |
| Bootstrap event | `custom` | `['bootstrap', phase]` | phase, peerCount, error (if any) |
| Channel state | `custom` | `['channel', 'opened'/'closed']` | channelId, peer, capacity, timestamp |

#### 8.2 Semantic Search over Payment History

ElizaOS memories support vector embeddings, enabling natural language queries:

- "Show me payments to Alice in January" → search memories with tags=['payment'] and text containing "Alice"
- "What's my total payment volume this week?" → retrieve all payment memories from the last 7 days
- "Who have I sent the most money to?" → aggregate payment memories by recipient
- "When did I last interact with Bob?" → search for any memories mentioning Bob

#### 8.3 Entity Components for Peer Data

Using ElizaOS's ECS-style Component system to attach structured ILP data to entities:

```typescript
// Store ILP peer info as an Entity Component
await runtime.createComponent({
  entityId: peerEntityId,
  agentId: runtime.agentId,
  roomId: selfRoomId,
  worldId: selfWorldId,
  sourceEntityId: runtime.agentId,
  type: 'ilp-peer',
  data: {
    nostrPubkey: pubkey,
    ilpAddress: 'g.agent.alice',
    btpEndpoint: 'ws://...',
    supportedChains: ['evm:base:8453'],
    trustScore: 0.82,
    lastSeen: Date.now(),
    totalPaymentsSent: 5,
    totalPaymentsReceived: 3,
    totalVolume: 150.00,
  },
});
```

---

### 9. Multi-Agent Payment Routing

#### 9.1 Intra-Instance Routing

Multiple ElizaOS agents within the same runtime can route payments to each other:

- Each agent has its own Nostr keypair and ILP address
- Agents discover each other via the shared Nostr relay infrastructure
- The ILP connector handles actual packet routing between agents
- Trust scores between co-located agents can be boosted (they share infrastructure trust)

#### 9.2 Cross-Instance Discovery

Agents on different ElizaOS instances discover each other via:

1. **Shared Nostr relays** — agents publish kind:10032 to public relays
2. **Follow graph propagation** — Agent A follows Agent B, who follows Agent C on a different instance
3. **Genesis peer list** — a curated list of known agent pubkeys for bootstrapping
4. **ArDrive registry** — permanent, decentralized peer registry

#### 9.3 Agent-to-Agent Payment Negotiation

```
Agent A (ElizaOS instance 1): "I need to pay Agent C"
    │
    ├── Peer discovery: Agent C is 2 hops away (A → B → C)
    ├── Trust check: trust(A, C) = 0.65 (via B as intermediary)
    │
    ├── SPSP negotiation:
    │   ├── A sends kind:23194 to C (directly, even though routing is via B)
    │   └── C responds with kind:23195 (SPSP params)
    │
    └── ILP routing:
        ├── A's connector sends PREPARE to B's connector
        ├── B's connector forwards to C's connector
        └── C's connector fulfills → B forwards FULFILL → A receives FULFILL
```

---

### 10. Autonomous Mode Patterns

#### 10.1 Periodic Trust Recalculation

```typescript
// In CrosstownService, schedule periodic trust updates
if (config.autonomousMode) {
  setInterval(async () => {
    const peers = await this.peerDiscovery.discoverPeers(this.nostrKeypair.publicKey);

    for (const [pubkey, peerInfo] of peers) {
      const oldScore = cachedTrustScores.get(pubkey);
      const newScore = await this.trustManager.getTrustScore(
        this.nostrKeypair.publicKey, pubkey
      );

      if (oldScore && Math.abs(newScore.score - oldScore.score) > 0.1) {
        // Significant trust change — emit event
        await runtime.emitEvent('TRUST_SCORE_UPDATED' as any, {
          runtime, source: 'crosstown',
          pubkey, oldScore: oldScore.score, newScore: newScore.score,
        });

        // Adjust credit limit
        const newLimit = computeCreditLimit(newScore.score, runtime);
        await updatePeerCreditLimit(pubkey, newLimit);
      }
    }
  }, 15 * 60 * 1000); // Every 15 minutes
}
```

#### 10.2 Automatic Channel Management

```typescript
// Monitor channel utilization and manage lifecycle
if (config.autonomousMode) {
  setInterval(async () => {
    const channels = await this.channelClient.listChannels();

    for (const channel of channels) {
      // Close idle channels (no activity in 7 days)
      if (channel.lastActivity < Date.now() - 7 * 24 * 60 * 60 * 1000) {
        await this.channelClient.closeChannel(channel.id);
        await runtime.emitEvent('CHANNEL_CLOSED' as any, {
          runtime, source: 'crosstown',
          channelId: channel.id, reason: 'idle',
        });
      }

      // Open new channels for high-trust peers without channels
      const peersWithoutChannels = await findPeersWithoutChannels();
      for (const peer of peersWithoutChannels) {
        if (peer.trustScore > 0.7) {
          await this.channelClient.openChannel({
            peer: peer.pubkey,
            capacity: computeCreditLimit(peer.trustScore, runtime),
          });
        }
      }
    }
  }, 60 * 60 * 1000); // Every hour
}
```

#### 10.3 Social Graph Exploration

```typescript
// Proactively explore follow graph for new peering opportunities
if (config.autonomousMode) {
  setInterval(async () => {
    // Get friends-of-friends who have ILP peer info
    const followList = await this.peerDiscovery.getFollowList(this.nostrKeypair.publicKey);

    for (const followedPubkey of followList) {
      const theirFollows = await this.peerDiscovery.getFollowList(followedPubkey);

      for (const candidate of theirFollows) {
        if (candidate === this.nostrKeypair.publicKey) continue;
        if (await isAlreadyPeered(candidate)) continue;

        const peerInfo = await this.peerDiscovery.getPeerInfo(candidate);
        if (!peerInfo) continue; // Not an ILP peer

        const trustScore = await this.trustManager.getTrustScore(
          this.nostrKeypair.publicKey, candidate
        );

        if (trustScore.score > 0.6 && trustScore.socialDistance <= 2) {
          // Good candidate — log for review or auto-peer
          await runtime.createMemory({
            entityId: runtime.agentId,
            roomId: selfRoomId,
            content: {
              text: `Potential new peer: ${candidate} (trust: ${trustScore.score.toFixed(2)}, ${trustScore.socialDistance} hops)`,
            },
            metadata: { type: 'custom', tags: ['peer-candidate'] },
          }, 'memories');
        }
      }
    }
  }, 6 * 60 * 60 * 1000); // Every 6 hours
}
```

---

### 11. Error Handling and Recovery

#### 11.1 Failure Mode Analysis

| Failure | Detection | Recovery | User Communication |
|---------|-----------|----------|--------------------|
| Relay connectivity loss | SimplePool connection error | Exponential backoff reconnection (5s, 10s, 20s, 40s, max 5min) | "Lost connection to Nostr relay. Reconnecting..." |
| SPSP handshake timeout | 30s timeout on kind:23195 response | Retry on different relay (if multiple configured); escalate to user after 3 retries | "SPSP handshake with Alice timed out. Trying alternative relay..." |
| ILP REJECT packet | ILP error code in REJECT packet | Map ILP error code to human message; retry with different route if available | "Payment rejected: insufficient liquidity on route. Trying alternate path..." |
| Bootstrap phase failure | BootstrapService error event | Retry phase with exponential backoff; allow manual restart via Action | "Bootstrap stalled at phase 3. SPSP timeout for Bob. Retry?" |
| Trust score computation failure | SocialTrustManager error | Return trust score 0 (conservative — no trust); log error | "Couldn't compute trust for Carol. Treating as untrusted." |
| ILP connector unreachable | HTTP connection error to admin API | Retry with backoff; set service state to 'connector-unavailable' | "ILP connector is unreachable. Payment operations unavailable." |
| NIP-44 decryption failure | Decryption error on incoming message | Log and skip message; may indicate key mismatch | Silent — log internally |
| Settlement channel failure | ConnectorChannelClient error | Close failed channel, attempt re-open; escalate if persistent | "Settlement channel with Bob failed. Re-establishing..." |

#### 11.2 Error Code Mapping

| Crosstown Error | ElizaOS Handling |
|--------------------|-----------------|
| `PeerDiscoveryError` | Log in Memory, surface via networkStatusProvider |
| `SpspTimeoutError` | Retry action, surface in callback message |
| `TrustComputationError` | Default to score=0 (conservative), log warning |
| `BootstrapPhaseError` | Emit BOOTSTRAP_PHASE_CHANGED with error, allow manual retry |
| `BlsError` / `ILP_ERROR_CODES` | Map to user-friendly message in action callback |
| `ToonEncodeError` | Log error, skip event encoding, surface in Provider |
| `PricingError` | Log error, reject payment attempt |

---

### 12. Character Configuration Guide

#### 12.1 Conservative Payer Archetype

```json
{
  "name": "Prudent Pete",
  "bio": "A careful ILP agent that prioritizes security and only transacts with highly trusted peers.",
  "system": "You are a conservative payment agent. Always verify trust scores before payments. Prefer peers with high mutual follower counts. Never auto-approve payments to peers with trust scores below 0.7. Ask for confirmation on any payment above 10 USD.",
  "plugins": ["@crosstown/elizaos-plugin"],
  "settings": {
    "CROSSTOWN_TRUST_THRESHOLD": "0.7",
    "CROSSTOWN_MAX_PAYMENT": "50",
    "CROSSTOWN_AUTONOMOUS_MODE": "false",
    "CROSSTOWN_MAX_SOCIAL_DISTANCE": "2"
  },
  "knowledge": [
    "ILP payments are irreversible once fulfilled. Always verify the recipient.",
    "Trust scores below 0.5 indicate weak social connection. Require explicit approval.",
    "Settlement channels lock up capital. Only open channels with proven, high-trust peers."
  ],
  "style": {
    "all": [
      "Always mention trust scores when discussing payments.",
      "Warn about low-trust peers.",
      "Suggest waiting for higher trust before large payments."
    ]
  }
}
```

#### 12.2 Generous Router Archetype

```json
{
  "name": "Router Riley",
  "bio": "An active ILP routing agent that eagerly connects new peers and routes payments across the network.",
  "system": "You are a payment routing agent. Your goal is to maximize network connectivity. Accept peering requests from any peer with trust > 0.3. Proactively discover and connect to new peers. Open settlement channels aggressively. Offer routing services to peers.",
  "plugins": ["@crosstown/elizaos-plugin"],
  "settings": {
    "CROSSTOWN_TRUST_THRESHOLD": "0.3",
    "CROSSTOWN_MAX_PAYMENT": "1000",
    "CROSSTOWN_AUTONOMOUS_MODE": "true",
    "CROSSTOWN_MAX_SOCIAL_DISTANCE": "4"
  },
  "knowledge": [
    "More peers means better routing options and redundancy.",
    "Routing fees compensate for the credit risk of forwarding payments.",
    "A well-connected router is valuable to the network and earns routing fees."
  ],
  "style": {
    "all": [
      "Be enthusiastic about new peer connections.",
      "Proactively suggest routing optimizations.",
      "Report routing statistics and network health."
    ]
  }
}
```

#### 12.3 Trust Maximizer Archetype

```json
{
  "name": "Trust Tara",
  "bio": "An agent focused on building deep trust relationships through consistent, reliable payment behavior.",
  "system": "You are a trust-focused agent. Prioritize building strong relationships with a small set of highly-trusted peers. Track payment success rates meticulously. Reward reliable peers with higher credit limits. Gradually reduce trust for peers with failed payments.",
  "plugins": ["@crosstown/elizaos-plugin"],
  "settings": {
    "CROSSTOWN_TRUST_THRESHOLD": "0.5",
    "CROSSTOWN_MAX_PAYMENT": "200",
    "CROSSTOWN_AUTONOMOUS_MODE": "true",
    "CROSSTOWN_MAX_SOCIAL_DISTANCE": "3"
  },
  "knowledge": [
    "Trust is earned through consistent successful interactions.",
    "Failed payments should reduce trust scores gradually, not immediately.",
    "Mutual followers indicate shared community trust.",
    "NIP-57 zap receipts provide economic reputation signals."
  ],
  "style": {
    "all": [
      "Always discuss trust evolution when reporting payment outcomes.",
      "Celebrate milestone trust achievements with peers.",
      "Warn about trust degradation patterns."
    ]
  }
}
```

---

### 13. Implementation Roadmap

#### Phase 1: Core Infrastructure (Complexity: L)

**Goal**: Agent has a Nostr identity, connects to relays, and bootstraps into the ILP network.

**Components**:
- `CrosstownService` — Nostr keypair management, bootstrap lifecycle
- `NostrRelayService` — SimplePool management, subscription lifecycle
- `networkStatusProvider` — Bootstrap phase and relay status
- `BOOTSTRAP_NETWORK` Action — Manual bootstrap trigger
- Plugin entry point with configuration validation

**Deliverables**:
- Agent starts, loads Nostr keypair from Character secrets
- Agent connects to configured relays
- Agent runs 5-phase bootstrap (discovers peers, registers with connector, handshakes, announces, ready)
- networkStatusProvider surfaces bootstrap progress to conversations
- REST route `/status` exposes network health

**Dependencies**: Crosstown `@crosstown/core` package, `nostr-tools`, running ILP connector

---

#### Phase 2: Basic Operations (Complexity: M)

**Goal**: Agent can discover peers, compute trust, and surface this information in conversations.

**Components**:
- `trustScoreProvider` — Trust scores for mentioned peers
- `peerStatusProvider` — Connected peer status
- `DISCOVER_PEERS` Action — Manual peer discovery
- `CHECK_TRUST` Action — Trust score query
- `PUBLISH_PEER_INFO` Action — Update kind:10032
- Memory integration — peer discovery records, trust snapshots

**Deliverables**:
- Provider context includes trust scores when peers are mentioned
- Agent can answer "How much do I trust Alice?" with breakdown
- Agent can discover new peers and report findings
- Trust and peer data persisted in ElizaOS Memory

**Dependencies**: Phase 1 complete

---

#### Phase 3: Full Payment Flow (Complexity: L)

**Goal**: Agent can send and receive ILP payments through natural conversation.

**Components**:
- `PAY` Action — End-to-end payment execution
- `REQUEST_PAYMENT` Action — SPSP request handling
- `ilpBalanceProvider` — ILP connector balance data
- `paymentHistoryProvider` — Payment records
- `paymentOutcomeEvaluator` — Payment result assessment
- Memory integration — payment records with semantic search
- Routes: `/payments` for payment history

**Deliverables**:
- "Pay Alice 5 USD" works end-to-end
- Recipient resolution (name → Memory → NIP-05 → pubkey)
- Trust-gated payment confirmation
- SPSP negotiation via Nostr
- Payment history searchable via natural language
- POST `/connector/webhook` handles payment notifications

**Dependencies**: Phase 2 complete, Crosstown SPSP flow functional

---

#### Phase 4: Autonomous Behaviors (Complexity: M)

**Goal**: Agent autonomously manages its ILP network position.

**Components**:
- `trustEvolutionEvaluator` — Long-term trust tracking
- `PaymentChannelService` — Settlement channel lifecycle
- Autonomous mode behaviors: periodic trust recalculation, channel management, social graph exploration
- Enhanced `networkStatusProvider` with channel and routing data

**Deliverables**:
- Agent periodically recalculates trust scores and adjusts credit limits
- Agent opens/closes settlement channels based on activity
- Agent explores follow graph for new peering opportunities
- Trust evolution tracked in Memory over time

**Dependencies**: Phase 3 complete, `ConnectorChannelClient` functional

---

#### Phase 5: Multi-Agent Mesh (Complexity: L)

**Goal**: Multiple agents form an interconnected ILP payment mesh.

**Components**:
- Cross-agent payment routing optimization
- Shared relay infrastructure management
- Inter-agent trust propagation
- Agent coordination via ElizaOS multi-agent (`IElizaOS.handleMessage`)

**Deliverables**:
- Multiple agents discover and peer with each other
- Routing tables optimized across agent mesh
- Agents coordinate on trust assessments
- ILP-gated relay used for persistent agent communication

**Dependencies**: Phase 4 complete, multi-agent ElizaOS deployment

---

### 14. Risk Assessment

#### 14.1 Technical Risks

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| Crosstown settlement flow incomplete (60-75%) | High | Confirmed | Design plugin with abstracted settlement interface; mock settlement for testing; prioritize non-settlement features first |
| NIP-47 kind number collision | Medium | Medium | Use payload content (not kind number) for message routing; document disambiguation strategy |
| nostr-tools API instability | Medium | Low | Pin version, wrap in adapter layer, maintain compatibility tests |
| ILP connector unavailability | High | Medium | Graceful degradation — agent operates in "Nostr-only" mode without ILP features |
| Nostr relay downtime | Medium | Medium | Multi-relay configuration, automatic failover, offline queueing |

#### 14.2 Architectural Risks

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| Tight coupling between plugin and Crosstown internals | High | Medium | Use only public API surface; wrap Crosstown classes in adapter layer |
| ElizaOS breaking changes in Plugin interface | Medium | Medium | Pin ElizaOS version; follow semver; maintain integration tests |
| State synchronization between ElizaOS Memory and Crosstown caches | Medium | High | Designate single source of truth per data type (see section 2.5) |
| Plugin bloat from trying to wrap everything | Medium | Medium | Phase implementation; only build what's needed for each milestone |

#### 14.3 Operational Risks

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| Nostr private key exposure | Critical | Low | Store in Character secrets only; never log; mask in UI |
| Incorrect trust score leading to bad payment decisions | High | Medium | Conservative defaults (high threshold, low max payment); always show trust breakdown to user |
| Settlement key compromise | Critical | Low | Separate from Nostr key; use hardware security if available; limit settlement amounts |
| Relay censorship/blocking | Medium | Medium | Multi-relay configuration; include at least 3 independent relays |
| Memory growth from payment history | Low | High | Implement memory pruning; archive old records; aggregate statistics |

---

### 15. Supporting Materials

#### 15.1 Component Mapping Matrix

| Crosstown Class | ElizaOS Component | Type | Notes |
|--------------------|-------------------|------|-------|
| `BootstrapService` | `CrosstownService` | Service | Wrapped in service lifecycle |
| `NostrPeerDiscovery` | `CrosstownService` (internal) + `peerStatusProvider` | Service + Provider | Discovery runs in service, results surfaced via provider |
| `SocialTrustManager` | `CrosstownService` (internal) + `trustScoreProvider` | Service + Provider | Computation in service, context injection via provider |
| `NostrSpspClient` | `PAY` Action | Action | Triggered by user intent |
| `NostrSpspServer` | `CrosstownService` (internal) + event handler | Service + Event | Listens for incoming SPSP requests |
| `buildIlpPeerInfoEvent` | `PUBLISH_PEER_INFO` Action | Action | Triggered by user or bootstrap |
| `parseIlpPeerInfo` | `CrosstownService` (internal) | Service | Used during peer discovery |
| `ConnectorAdminClient` | `CrosstownService` (internal) | Service | Peer registration |
| `AgentRuntimeClient` | `PAY` Action (internal) | Action | ILP packet sending |
| `ConnectorChannelClient` | `PaymentChannelService` | Service | Settlement channel lifecycle |
| `GenesisPeerLoader` | `CrosstownService` (bootstrap) | Service | Phase 1 of bootstrap |
| `ArDrivePeerRegistry` | `CrosstownService` (bootstrap) | Service | Phase 1 of bootstrap |
| `PricingService` | N/A (BLS-side only) | N/A | Used by relay, not by agent plugin |
| `BusinessLogicServer` | N/A (BLS-side only) | N/A | Server-side component |
| `NostrRelayServer` | N/A (relay-side only) | N/A | Server-side component |

#### 15.2 Glossary of Cross-Project Terminology

| Crosstown Term | ElizaOS Equivalent | Description |
|-------------------|-------------------|-------------|
| Nostr pubkey | Entity ID / Agent ID | Unique identifier for a network participant |
| Follow list (NIP-02) | Relationship records | Social graph edges representing trust/peering |
| kind:10032 event | Entity Component (type: 'ilp-peer') | Structured data attached to a peer |
| SPSP handshake | Action execution (PAY) | Request-response for payment setup |
| Trust score | Provider data (trustScoreProvider) | Computed metric influencing decisions |
| Bootstrap phase | Service state | Lifecycle stage of network initialization |
| ILP PREPARE/FULFILL/REJECT | Action result | Payment packet lifecycle |
| Settlement channel | Service state (PaymentChannelService) | Long-lived payment capacity reservation |
| BTP endpoint | Configuration setting | WebSocket URL for connector communication |
| Credit limit | Computed from trust score | Maximum outstanding balance with a peer |

#### 15.3 NIP-47 Relationship Analysis

Crosstown's SPSP protocol intentionally mirrors NIP-47 (Nostr Wallet Connect):

| Aspect | NIP-47 (NWC) | Crosstown SPSP |
|--------|-------------|-------------------|
| Request kind | 23194 | 23194 (same) |
| Response kind | 23195 | 23195 (same) |
| Encryption | NIP-44 | NIP-44 (same) |
| Payload format | `{method, params}` | `{destinationAccount, sharedSecret, ...}` |
| Purpose | Lightning wallet operations | ILP payment setup |
| Discovery | Connection URI | NIP-02 follow list + kind:10032 |
| Trust model | Explicit connection string | Social graph derivation |

**Coexistence strategy**: Since both protocols use the same kind numbers, message routing must examine the encrypted payload content. The payload structure differs (NWC uses `method` field, SPSP uses `destinationAccount`/`sharedSecret`), making disambiguation straightforward after decryption. An ElizaOS agent could implement both protocols simultaneously, using NWC for Lightning settlement and SPSP for ILP routing setup.

---

## Conclusion

The ElizaOS plugin architecture provides an excellent fit for wrapping the Crosstown protocol. The key architectural insight is that Crosstown's long-running processes (bootstrap, relay connections, channel management) map to ElizaOS Services, while user-facing operations (pay, discover, check trust) map to Actions, and contextual data (trust scores, peer status, balances) map to Providers.

The five-phase implementation roadmap allows iterative delivery of value, starting with core infrastructure (Phase 1) and building up to a full multi-agent ILP mesh (Phase 5). Each phase is independently testable and delivers standalone capabilities.

The primary risk is Crosstown's incomplete settlement flow (60-75%), which can be mitigated by designing clean abstraction boundaries around settlement operations and focusing early phases on the complete subsystems (peer discovery, trust computation, SPSP negotiation).

The plugin architecture draws heavily from the plugin-babylon reference, particularly its patterns for:
- Service lifecycle management (autonomous coordinator)
- Dual operating modes (conversational vs. autonomous)
- Background monitoring with deterministic thresholds (Spartan Trader pattern adapted for trust-based decisions)
- Batch processing for efficiency (social graph exploration)
