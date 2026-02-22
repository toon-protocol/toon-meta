# @crosstown/client Architecture Document

**Version:** 1.0
**Date:** 2026-02-20
**Status:** Proposed Architecture
**Author:** Winston (Architect Agent)

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [High-Level Architecture](#2-high-level-architecture)
3. [API Specification](#3-api-specification)
4. [Implementation Details](#4-implementation-details)
5. [Testing Strategy](#5-testing-strategy)
6. [Package Publishing & Distribution](#6-package-publishing--distribution)
7. [Migration Guide](#7-migration-guide)
8. [Future Enhancements](#8-future-enhancements)
9. [Coding Standards](#9-coding-standards)
10. [Security & Performance](#10-security--performance)
11. [Monitoring & Observability](#11-monitoring--observability)

---

## 1. Introduction

### 1.1 Context

**Current State:**
- `@crosstown/core` provides excellent **building blocks** (NostrSpspClient, IlpSpspClient, BootstrapService, RelayMonitor)
- **No unified client** exists - agents must manually compose components
- Two integration modes: **embedded** (requires `@crosstown/connector`) or **HTTP** (requires external connector)
- Examples use `MockIlpConnector` for testing, not a real production client
- `createCrosstownNode` exists but is buried in `@crosstown/core/compose.ts` with unclear naming

### 1.2 Proposed Solution

Create `@crosstown/client` - a high-level, full-featured Nostr client that:

1. **Abstracts complexity** - Simple API for agents to interact with Crosstown network
2. **Full read/write support** - Subscribe to any Nostr relay (free) + publish to ILP-gated relays (paid)
3. **Manages lifecycle** - Handles Nostr subscriptions, SPSP handshakes, payment channels
4. **Supports both modes** - Works with embedded or external connectors
5. **Production-ready** - Real implementation replacing mock connectors

### 1.3 Design Principles

- **Progressive Disclosure**: Simple API for basic use, advanced options for power users
- **Connector-Agnostic**: Works with any ILP connector (embedded or HTTP)
- **Type-Safe**: Full TypeScript support with shared types from `@crosstown/core`
- **Observable**: Event-driven architecture for monitoring and debugging
- **Full Nostr Client**: Not just a writer - supports subscriptions and queries too

### 1.4 Key Decision: Replace `createCrosstownNode`

**Decision:** Move `createCrosstownNode` from `@crosstown/core` to `@crosstown/client` as `CrosstownClient`

**Rationale:**
- `createCrosstownNode` is already a client - it just has poor naming and placement
- "CrosstownClient" is more intuitive than "CrosstownNode" for agent developers
- Moving to dedicated package clarifies purpose and ownership
- Enables adding HTTP mode support alongside existing embedded mode
- Backward compatibility maintained via re-export from `@crosstown/core`

---

## 2. High-Level Architecture

### 2.1 Technical Summary

`@crosstown/client` is a **unified Nostr client library** for interacting with the Crosstown protocol. It provides a single API that supports:

- **Read operations** (standard Nostr, free): Subscribe to any relay, query events
- **Write operations** (Crosstown-specific, paid): Publish events to ILP-gated relays
- **Dual connector modes**: Embedded (in-process) or HTTP (external service)
- **Payment channel management**: Open and manage ILP payment channels
- **Peer discovery**: Automatic discovery via Nostr follows and ArDrive registry

**Key Characteristics:**
- **Event-driven architecture**: Observable lifecycle and network events
- **TypeScript-first**: Full type safety with shared types from `@crosstown/core`
- **Production-ready**: Replaces mock connectors with real ILP integration
- **Lifecycle managed**: Simple `start()` / `stop()` API with automatic cleanup

**Design Evolution from `createCrosstownNode`:**
- ✅ Keeps all existing embedded-mode functionality
- ✅ Adds HTTP mode support (new capability)
- ✅ Adds full Nostr subscription API (read support)
- ✅ Better naming (`CrosstownClient` vs `createCrosstownNode`)
- ✅ Enhanced error handling and retry logic
- ✅ Improved TypeScript ergonomics

### 2.2 Architecture Diagram

```mermaid
graph TB
    subgraph "Agent Application"
        Agent[Agent Code]
    end

    subgraph "@crosstown/client"
        Client[CrosstownClient]
        Config[ClientConfig]
        Pool[SimplePool<br/>Shared Connection Pool]

        subgraph "Core Services (from @crosstown/core)"
            Bootstrap[BootstrapService]
            Monitor[RelayMonitor]
            SPSP[NostrSpspClient/IlpSpspClient]
        end

        subgraph "Runtime Adapters"
            DirectRT[DirectRuntimeClient]
            HttpRT[HttpRuntimeClient]
        end

        subgraph "Admin Adapters"
            DirectAdmin[DirectConnectorAdmin]
            HttpAdmin[HttpConnectorAdmin]
        end

        Channel[DirectChannelClient]
    end

    subgraph "Connector Layer"
        Embedded[Embedded Connector<br/>@agent-runtime/connector]
        HTTP[HTTP Connector<br/>External Service]
    end

    subgraph "Nostr Network"
        Relay1[Nostr Relay 1]
        Relay2[Nostr Relay 2]
        ILPRelay[ILP-Gated Relay]
    end

    subgraph "ILP Network"
        Peers[ILP Peers]
    end

    Agent -->|new CrosstownClient(config)| Client
    Client -->|shares| Pool
    Client -->|manages| Bootstrap
    Client -->|manages| Monitor
    Client -->|uses| SPSP

    Client -.->|embedded mode| DirectRT
    Client -.->|HTTP mode| HttpRT
    Client -.->|embedded mode| DirectAdmin
    Client -.->|HTTP mode| HttpAdmin
    Client -.->|if supported| Channel

    DirectRT --> Embedded
    DirectAdmin --> Embedded
    HttpRT --> HTTP
    HttpAdmin -.->|future| HTTP

    Embedded --> Peers
    HTTP --> Peers

    Pool --> Relay1
    Pool --> Relay2
    Pool --> ILPRelay
    Monitor --> Pool
    SPSP --> Pool

    style Client fill:#4CAF50,stroke:#2E7D32,stroke-width:3px,color:#fff
    style Agent fill:#2196F3,stroke:#1565C0,stroke-width:2px,color:#fff
    style Pool fill:#FF9800,stroke:#E65100,stroke-width:2px,color:#fff
```

### 2.3 Key Components

#### **CrosstownClient (Main Class)**
**Responsibility:** Unified API for Crosstown network interaction

**Key Methods:**
```typescript
class CrosstownClient {
  // Lifecycle
  async start(): Promise<StartResult>
  async stop(): Promise<void>

  // Peer management
  async peerWith(pubkey: string): Promise<void>
  getPeers(): PeerInfo[]

  // Nostr subscriptions (READ - free)
  subscribe(relays: string[], filters: Filter[], callbacks): NostrSubscription
  subscribeToRelay(filters: Filter[], callbacks): NostrSubscription
  queryEvents(relays: string[], filters: Filter[]): Promise<NostrEvent[]>
  getEvent(relays: string[], eventId: string): Promise<NostrEvent | null>

  // Event publishing (WRITE - paid)
  async publishEvent(event: NostrEvent, amount?: string): Promise<PublishResult>
  async publishBatch(events: NostrEvent[]): Promise<PublishResult[]>

  // Payment channels
  async openChannel(params: OpenChannelParams): Promise<OpenChannelResult>
  getChannelState(channelId: string): Promise<ChannelState>

  // Event listeners
  on(event: ClientEvent, listener: EventListener): void
  off(event: ClientEvent, listener: EventListener): void

  // Advanced access
  get pool(): SimplePool
  get bootstrap(): BootstrapService
  get relayMonitor(): RelayMonitor
  get channels(): ConnectorChannelClient | null
}
```

### 2.4 Integration Patterns

**Pattern 1: Embedded Mode (Original `createCrosstownNode` functionality)**
```typescript
import { ConnectorNode } from '@agent-runtime/connector';
import { CrosstownClient } from '@crosstown/client';
import { encodeEvent, decodeEvent } from '@crosstown/relay';

const connector = new ConnectorNode({ /* config */ });

const client = new CrosstownClient({
  connector,                           // Embedded connector instance
  handlePacket: async (req) => {
    // Handle incoming packets
    return { accept: true, fulfillment: '...' };
  },
  secretKey,
  ilpInfo: { ilpAddress: 'g.agent.alice', ... },
  toonEncoder: encodeEvent,
  toonDecoder: decodeEvent,
});

await client.start();

// Subscribe to events (read - free)
client.subscribe(['wss://relay.damus.io'], [{ kinds: [1] }], {
  onevent: (e) => console.log(e)
});

// Publish events (write - paid)
await client.publishEvent(myEvent);
```

**Pattern 2: HTTP Mode (NEW capability)**
```typescript
import { CrosstownClient } from '@crosstown/client';
import { encodeEvent, decodeEvent } from '@crosstown/relay';

const client = new CrosstownClient({
  connectorUrl: 'http://localhost:3000',  // External connector via HTTP
  secretKey,
  ilpInfo: { ilpAddress: 'g.agent.alice', ... },
  toonEncoder: encodeEvent,
  toonDecoder: decodeEvent,
  // Note: handlePacket not needed - connector handles incoming packets
});

await client.start();

// Same API for subscriptions and publishing
```

**Pattern 3: Agent with Auto-Responder**
```typescript
const client = new CrosstownClient({ /* ... */ });
await client.start();

// Listen for mentions
client.subscribe(['wss://relay.damus.io'], [{ kinds: [1], '#p': [myPubkey] }], {
  onevent: async (event) => {
    console.log('Mentioned:', event.content);

    // Auto-reply
    const reply = finalizeEvent({
      kind: 1,
      content: 'Thanks!',
      tags: [['e', event.id], ['p', event.pubkey]],
    }, secretKey);

    await client.publishEvent(reply);
  }
});
```

### 2.5 Architectural Patterns

- **Facade Pattern**: Client hides complexity of bootstrap, relay monitoring, SPSP
- **Adapter Pattern**: `DirectRuntimeClient` and `HttpRuntimeClient` implement same interface
- **Dependency Injection**: Runtime/admin clients injected based on mode
- **Observer Pattern**: Event-driven architecture for lifecycle and network events
- **Strategy Pattern**: Different strategies for embedded vs HTTP mode
- **Singleton Pool**: Shared `SimplePool` instance for all relay connections

---

## 3. API Specification

### 3.1 Main Class: CrosstownClient

```typescript
/**
 * Unified client for interacting with the Crosstown protocol.
 * Supports both embedded (in-process) and HTTP (external) connector modes.
 * Provides full Nostr read/write capabilities with ILP micropayments.
 */
export class CrosstownClient {
  constructor(config: CrosstownClientConfig);

  // ============================================================================
  // LIFECYCLE MANAGEMENT
  // ============================================================================

  /**
   * Start the client: bootstrap peers, start relay monitoring, open channels.
   *
   * @returns Summary of bootstrap results and peer/channel counts
   * @throws CrosstownClientError if already started or bootstrap fails
   */
  start(): Promise<CrosstownStartResult>;

  /**
   * Stop the client: close relay subscriptions, cleanup resources.
   * Safe to call when not started (no-op).
   */
  stop(): Promise<void>;

  /**
   * Check if the client is currently running.
   */
  get isStarted(): boolean;

  // ============================================================================
  // PEER MANAGEMENT
  // ============================================================================

  /**
   * Initiate peering with a discovered peer.
   * The peer must have been discovered by RelayMonitor first.
   *
   * @param pubkey - Nostr public key (64-char hex) of the peer
   * @throws PeerNotFoundError if peer hasn't been discovered
   * @throws SpspError if handshake fails
   */
  peerWith(pubkey: string): Promise<PeerResult>;

  /**
   * Get list of currently connected peers.
   */
  getPeers(): PeerInfo[];

  /**
   * Remove a peer from the connector.
   *
   * @param pubkey - Nostr public key of the peer to remove
   */
  removePeer(pubkey: string): Promise<void>;

  // ============================================================================
  // NOSTR SUBSCRIPTIONS (READ - FREE)
  // ============================================================================

  /**
   * Subscribe to Nostr events from relays.
   *
   * Creates a real-time subscription for events matching the filters.
   * This is standard Nostr subscription (REQ) - no payment required.
   *
   * @param relays - Relay URLs to subscribe to
   * @param filters - Nostr filters (NIP-01)
   * @param callbacks - Event handlers
   * @returns Subscription object with close() method
   *
   * @example
   * ```typescript
   * const sub = client.subscribe(
   *   ['wss://relay.damus.io'],
   *   [{ kinds: [1], authors: [pubkey], limit: 10 }],
   *   {
   *     onevent: (event) => console.log('New event:', event.content),
   *     oneose: () => console.log('End of stored events'),
   *   }
   * );
   *
   * // Later: sub.close();
   * ```
   */
  subscribe(
    relays: string | string[],
    filters: Filter[],
    callbacks: {
      onevent: (event: NostrEvent) => void;
      oneose?: () => void;
      onclose?: (reason?: string) => void;
    }
  ): NostrSubscription;

  /**
   * Subscribe to the client's configured relay.
   * Convenience method for subscribing to the relay used for publishing.
   */
  subscribeToRelay(
    filters: Filter[],
    callbacks: {
      onevent: (event: NostrEvent) => void;
      oneose?: () => void;
      onclose?: (reason?: string) => void;
    }
  ): NostrSubscription;

  /**
   * Query events (one-time fetch, not real-time).
   *
   * Sends REQ, collects events until EOSE, then closes subscription.
   *
   * @param relays - Relay URLs to query
   * @param filters - Nostr filters
   * @param options - Query options (timeout, etc.)
   * @returns Array of events
   *
   * @example
   * ```typescript
   * const events = await client.queryEvents(
   *   ['wss://relay.damus.io'],
   *   [{ kinds: [1], authors: [pubkey], limit: 10 }]
   * );
   * ```
   */
  queryEvents(
    relays: string | string[],
    filters: Filter[],
    options?: { timeout?: number }
  ): Promise<NostrEvent[]>;

  /**
   * Get a single event by ID.
   *
   * @param relays - Relay URLs to query
   * @param eventId - Event ID (hex string)
   * @returns Event or null if not found
   */
  getEvent(
    relays: string | string[],
    eventId: string
  ): Promise<NostrEvent | null>;

  // ============================================================================
  // EVENT PUBLISHING (WRITE - PAID)
  // ============================================================================

  /**
   * Publish a Nostr event to a Crosstown relay with automatic payment.
   *
   * This is the primary high-level API for agents. It:
   * 1. TOON-encodes the event
   * 2. Calculates the required payment amount (if not provided)
   * 3. Sends the event as an ILP packet to the configured relay
   * 4. Returns success/failure result
   *
   * @param event - Signed Nostr event to publish
   * @param options - Publishing options (amount, destination, timeout)
   * @returns Result indicating success or failure
   */
  publishEvent(
    event: NostrEvent,
    options?: PublishEventOptions
  ): Promise<PublishEventResult>;

  /**
   * Publish multiple events in a batch.
   * More efficient than calling publishEvent() multiple times.
   *
   * @param events - Array of signed Nostr events
   * @param options - Batch publishing options
   * @returns Array of results (one per event)
   */
  publishBatch(
    events: NostrEvent[],
    options?: PublishBatchOptions
  ): Promise<PublishEventResult[]>;

  // ============================================================================
  // PAYMENT CHANNELS (if connector supports it)
  // ============================================================================

  /**
   * Get the channel client for direct channel operations.
   * Returns null if the connector doesn't support channels.
   */
  get channels(): ConnectorChannelClient | null;

  /**
   * Open a payment channel with a peer.
   *
   * @param params - Channel opening parameters
   * @returns Channel ID and initial state
   * @throws UnsupportedError if connector doesn't support channels
   */
  openChannel(params: OpenChannelParams): Promise<OpenChannelResult>;

  /**
   * Get the state of a payment channel.
   *
   * @param channelId - Channel ID returned by openChannel()
   */
  getChannelState(channelId: string): Promise<ChannelState>;

  // ============================================================================
  // EVENT LISTENERS
  // ============================================================================

  /**
   * Register an event listener.
   *
   * @param event - Event type to listen for
   * @param listener - Callback function
   */
  on<E extends ClientEventType>(
    event: E,
    listener: ClientEventListener<E>
  ): void;

  /**
   * Unregister an event listener.
   */
  off<E extends ClientEventType>(
    event: E,
    listener: ClientEventListener<E>
  ): void;

  /**
   * Register a one-time event listener.
   */
  once<E extends ClientEventType>(
    event: E,
    listener: ClientEventListener<E>
  ): void;

  // ============================================================================
  // READ-ONLY ACCESS TO INTERNAL SERVICES
  // ============================================================================

  /**
   * Access to BootstrapService for advanced use cases.
   * Allows attaching custom event listeners before calling start().
   */
  get bootstrap(): BootstrapService;

  /**
   * Access to RelayMonitor for advanced use cases.
   */
  get relayMonitor(): RelayMonitor;

  /**
   * Access the underlying SimplePool for advanced Nostr operations.
   * The pool is shared between internal operations and user subscriptions.
   */
  get pool(): SimplePool;
}
```

### 3.2 Configuration Interface

```typescript
/**
 * Configuration for CrosstownClient.
 * Either `connector` (embedded mode) or `connectorUrl` (HTTP mode) is required.
 */
export interface CrosstownClientConfig {
  // ============================================================================
  // CONNECTOR (one required)
  // ============================================================================

  /**
   * Embedded connector instance (e.g., ConnectorNode from @agent-runtime/connector).
   * Use this for zero-latency in-process mode.
   *
   * Mutually exclusive with `connectorUrl`.
   */
  connector?: EmbeddableConnectorLike;

  /**
   * HTTP URL of external connector service.
   * Use this for remote connector deployments.
   *
   * Mutually exclusive with `connector`.
   * Example: 'http://localhost:3000'
   */
  connectorUrl?: string;

  // ============================================================================
  // IDENTITY (required)
  // ============================================================================

  /**
   * Nostr secret key (32 bytes) for signing events and SPSP encryption.
   */
  secretKey: Uint8Array;

  /**
   * Own ILP peer information.
   */
  ilpInfo: IlpPeerInfo;

  // ============================================================================
  // PACKET HANDLING (embedded mode only)
  // ============================================================================

  /**
   * Callback for handling incoming ILP packets.
   *
   * Required in embedded mode (when `connector` is provided).
   * Ignored in HTTP mode (connector handles packets).
   */
  handlePacket?: PacketHandler;

  // ============================================================================
  // TOON ENCODING (required)
  // ============================================================================

  /**
   * Function to encode Nostr events to TOON binary format.
   *
   * Example: `import { encodeEvent } from '@crosstown/relay'`
   */
  toonEncoder: (event: NostrEvent) => Uint8Array;

  /**
   * Function to decode TOON binary to Nostr events.
   */
  toonDecoder: (bytes: Uint8Array) => NostrEvent;

  // ============================================================================
  // NETWORK (optional with defaults)
  // ============================================================================

  /**
   * Nostr relay WebSocket URL for monitoring and publishing.
   * @default 'ws://localhost:7100'
   */
  relayUrl?: string;

  /**
   * Default relays for subscribe() when not specified.
   * @default [relayUrl]
   */
  defaultSubscriptionRelays?: string[];

  /**
   * Initial known peers to bootstrap from.
   * @default []
   */
  knownPeers?: KnownPeer[];

  /**
   * Additional peers JSON for bootstrap (ArDrive format).
   */
  additionalPeersJson?: string;

  /**
   * Default ILP destination for publishEvent() if not specified.
   * @default Derived from first bootstrapped peer
   */
  defaultDestination?: string;

  // ============================================================================
  // PRICING (optional with defaults)
  // ============================================================================

  /**
   * Base price per byte for ILP packet pricing.
   * Used to calculate payment amounts in publishEvent().
   * @default 10n
   */
  basePricePerByte?: bigint;

  /**
   * Fixed overhead added to every packet price.
   * @default 100n
   */
  fixedOverhead?: bigint;

  // ============================================================================
  // SETTLEMENT (optional)
  // ============================================================================

  /**
   * Settlement preferences for SPSP handshakes.
   */
  settlementInfo?: SpspRequestSettlementInfo;

  /**
   * Settlement negotiation config for opening payment channels.
   */
  settlementNegotiationConfig?: SettlementNegotiationConfig;

  // ============================================================================
  // DISCOVERY (optional with defaults)
  // ============================================================================

  /**
   * Enable ArDrive peer lookup during bootstrap.
   * @default true
   */
  ardriveEnabled?: boolean;

  /**
   * Default relay URL for ArDrive-sourced peers that lack relay URLs.
   * @default ''
   */
  defaultRelayUrl?: string;

  /**
   * Timeout for relay queries in milliseconds.
   * @default 5000
   */
  queryTimeout?: number;

  // ============================================================================
  // SUBSCRIPTIONS (optional with defaults)
  // ============================================================================

  /**
   * Maximum number of concurrent subscriptions.
   * Prevents resource exhaustion.
   * @default 100
   */
  maxSubscriptions?: number;

  // ============================================================================
  // RETRY & RESILIENCE (optional with defaults)
  // ============================================================================

  /**
   * Maximum retry attempts for failed operations.
   * @default 3
   */
  maxRetries?: number;

  /**
   * Initial retry delay in milliseconds (exponential backoff).
   * @default 1000
   */
  retryDelay?: number;

  /**
   * Enable automatic reconnection on connection loss.
   * @default true
   */
  autoReconnect?: boolean;
}
```

### 3.3 Return Types

```typescript
/**
 * Result returned by start()
 */
export interface CrosstownStartResult {
  /** Bootstrap results for each peer */
  bootstrapResults: BootstrapResult[];
  /** Number of successfully connected peers */
  peerCount: number;
  /** Number of payment channels opened */
  channelCount: number;
  /** Client mode (embedded or http) */
  mode: 'embedded' | 'http';
}

/**
 * Result returned by peerWith()
 */
export interface PeerResult {
  /** Peer's public key */
  pubkey: string;
  /** Peer's ILP address */
  ilpAddress: string;
  /** SPSP information */
  spspInfo: SpspInfo;
  /** Opened channel ID (if settlement negotiation succeeded) */
  channelId?: string;
}

/**
 * Current peer information
 */
export interface PeerInfo {
  pubkey: string;
  ilpAddress: string;
  relayUrl?: string;
  channelId?: string;
  channelStatus?: 'opening' | 'open' | 'closed';
}

/**
 * Result of publishEvent()
 */
export type PublishEventResult =
  | PublishEventSuccess
  | PublishEventFailure;

export interface PublishEventSuccess {
  success: true;
  /** Event ID (from Nostr event) */
  eventId: string;
  /** Amount paid (in smallest units) */
  amountPaid: string;
  /** ILP fulfillment received */
  fulfillment: string;
  /** Time taken in milliseconds */
  duration: number;
}

export interface PublishEventFailure {
  success: false;
  /** Event ID (from Nostr event) */
  eventId: string;
  /** Error code (ILP error code or client error code) */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Original error (if available) */
  error?: Error;
}

/**
 * Options for publishEvent()
 */
export interface PublishEventOptions {
  /** Payment amount (auto-calculated if not provided) */
  amount?: string;
  /** ILP destination address (uses defaultDestination if not provided) */
  destination?: string;
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Options for publishBatch()
 */
export interface PublishBatchOptions {
  /** Publish events in parallel (default) or sequentially */
  parallel?: boolean;
  /** Timeout per event in milliseconds */
  timeout?: number;
  /** Destination for all events */
  destination?: string;
}
```

### 3.4 Event System

```typescript
/**
 * Client event types
 */
export type ClientEventType =
  | 'started'
  | 'stopped'
  | 'peer:discovered'
  | 'peer:connected'
  | 'peer:disconnected'
  | 'channel:opened'
  | 'channel:closed'
  | 'event:published'
  | 'event:failed'
  | 'error';

/**
 * Event payloads
 */
export interface ClientEvents {
  started: { startResult: CrosstownStartResult };
  stopped: {};
  'peer:discovered': { pubkey: string; ilpInfo: IlpPeerInfo };
  'peer:connected': { peerResult: PeerResult };
  'peer:disconnected': { pubkey: string; reason?: string };
  'channel:opened': { channelId: string; peerId: string };
  'channel:closed': { channelId: string; peerId: string };
  'event:published': { result: PublishEventSuccess };
  'event:failed': { result: PublishEventFailure };
  error: { error: Error; context?: string };
}

/**
 * Typed event listener
 */
export type ClientEventListener<E extends ClientEventType> = (
  event: ClientEvents[E]
) => void | Promise<void>;
```

### 3.5 Error Types

```typescript
/**
 * Base error class for all Crosstown client errors
 */
export class CrosstownClientError extends Error {
  constructor(
    message: string,
    public code: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'CrosstownClientError';
  }
}

/**
 * Thrown when client is used in invalid state (e.g., start() called twice)
 */
export class InvalidStateError extends CrosstownClientError {
  constructor(message: string, cause?: Error) {
    super(message, 'INVALID_STATE', cause);
    this.name = 'InvalidStateError';
  }
}

/**
 * Thrown when configuration is invalid
 */
export class ConfigurationError extends CrosstownClientError {
  constructor(message: string, cause?: Error) {
    super(message, 'INVALID_CONFIG', cause);
    this.name = 'ConfigurationError';
  }
}

/**
 * Thrown when requested peer is not found
 */
export class PeerNotFoundError extends CrosstownClientError {
  constructor(pubkey: string, cause?: Error) {
    super(`Peer not found: ${pubkey}`, 'PEER_NOT_FOUND', cause);
    this.name = 'PeerNotFoundError';
  }
}

/**
 * Thrown when an operation is not supported in current mode
 */
export class UnsupportedOperationError extends CrosstownClientError {
  constructor(operation: string, mode: string, cause?: Error) {
    super(
      `Operation '${operation}' not supported in ${mode} mode`,
      'UNSUPPORTED_OPERATION',
      cause
    );
    this.name = 'UnsupportedOperationError';
  }
}

/**
 * Thrown when event publishing fails
 */
export class PublishError extends CrosstownClientError {
  constructor(
    message: string,
    public eventId: string,
    cause?: Error
  ) {
    super(message, 'PUBLISH_FAILED', cause);
    this.name = 'PublishError';
  }
}
```

### 3.6 Usage Examples

**Example 1: Basic Agent with Read/Write**
```typescript
import { CrosstownClient } from '@crosstown/client';
import { finalizeEvent, generateSecretKey } from 'nostr-tools/pure';
import { encodeEvent, decodeEvent } from '@crosstown/relay';

const secretKey = generateSecretKey();

const client = new CrosstownClient({
  connectorUrl: 'http://localhost:3000',
  secretKey,
  ilpInfo: { ilpAddress: 'g.agent.alice', /* ... */ },
  toonEncoder: encodeEvent,
  toonDecoder: decodeEvent,
});

await client.start();

// READ: Subscribe to mentions (free)
client.subscribe(
  ['wss://relay.damus.io'],
  [{ kinds: [1], '#p': [myPubkey] }],
  {
    onevent: async (event) => {
      console.log('Mentioned:', event.content);

      // WRITE: Auto-reply (paid)
      const reply = finalizeEvent({
        kind: 1,
        content: 'Thanks!',
        tags: [['e', event.id], ['p', event.pubkey]],
      }, secretKey);

      await client.publishEvent(reply);
    }
  }
);
```

**Example 2: Query Historical Events**
```typescript
// Fetch recent notes from a specific user
const events = await client.queryEvents(
  ['wss://relay.damus.io'],
  [{ kinds: [1], authors: [somePubkey], limit: 10 }]
);

console.log(`Found ${events.length} notes`);
```

**Example 3: Multi-Relay Monitoring**
```typescript
// Monitor multiple relays for hashtags
const sub = client.subscribe(
  ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band'],
  [{ kinds: [1], '#t': ['crosstown'] }],
  {
    onevent: (event) => console.log('Crosstown mention:', event.content),
  }
);
```

---

## 4. Implementation Details

### 4.1 Package Structure

```
packages/client/
├── src/
│   ├── CrosstownClient.ts          # Main client class (400-500 LOC)
│   ├── types.ts                    # TypeScript interfaces and types
│   ├── errors.ts                   # Error classes
│   ├── events.ts                   # Event emitter implementation
│   ├── config.ts                   # Config validation and defaults
│   ├── pricing.ts                  # Price calculation utilities
│   ├── modes/
│   │   ├── embedded.ts             # Embedded mode initialization
│   │   ├── http.ts                 # HTTP mode initialization
│   │   └── types.ts                # Mode-specific types
│   ├── utils/
│   │   ├── retry.ts                # Retry logic with exponential backoff
│   │   ├── timeout.ts              # Timeout utilities
│   │   └── validation.ts           # Input validation helpers
│   └── index.ts                    # Public exports
├── tests/
│   ├── CrosstownClient.test.ts
│   ├── embedded-mode.test.ts
│   ├── http-mode.test.ts
│   ├── subscriptions.test.ts
│   ├── pricing.test.ts
│   └── fixtures/
│       ├── mock-connector.ts
│       └── test-data.ts
├── package.json
├── tsconfig.json
├── README.md
└── MIGRATION.md                    # Migration guide from createCrosstownNode
```

### 4.2 Core Implementation: CrosstownClient

```typescript
// src/CrosstownClient.ts

import { EventEmitter } from 'node:events';
import { SimplePool } from 'nostr-tools/pool';
import { BootstrapService, RelayMonitor } from '@crosstown/core';
import type { NostrEvent, Filter } from 'nostr-tools';
import { validateConfig, applyDefaults } from './config.js';
import { ConfigurationError, InvalidStateError } from './errors.js';
import { initializeEmbeddedMode } from './modes/embedded.js';
import { initializeHttpMode } from './modes/http.js';
import { calculatePrice } from './pricing.js';
import { withRetry } from './utils/retry.js';

/**
 * Internal runtime state
 */
interface RuntimeState {
  mode: 'embedded' | 'http';
  bootstrapService: BootstrapService;
  relayMonitor: RelayMonitor;
  runtimeClient: AgentRuntimeClient;
  adminClient: ConnectorAdminClient;
  channelClient: ConnectorChannelClient | null;
  subscription: Subscription | null;
  defaultDestination: string | null;
  activeSubscriptions: Set<NostrSubscription>;
}

export class CrosstownClient {
  private readonly config: Required<CrosstownClientConfig>;
  private readonly emitter: EventEmitter;
  private readonly pool: SimplePool;
  private state: RuntimeState | null = null;

  constructor(config: CrosstownClientConfig) {
    // Validate and apply defaults
    const validationResult = validateConfig(config);
    if (!validationResult.valid) {
      throw new ConfigurationError(validationResult.error!);
    }

    this.config = applyDefaults(config);
    this.emitter = new EventEmitter();

    // Create shared SimplePool for all relay connections
    this.pool = new SimplePool();
  }

  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================

  async start(): Promise<CrosstownStartResult> {
    if (this.state !== null) {
      throw new InvalidStateError('Client already started');
    }

    try {
      // Detect mode based on config
      const mode = this.config.connector ? 'embedded' : 'http';

      // Initialize mode-specific components
      const initialization = mode === 'embedded'
        ? await initializeEmbeddedMode(this.config, this.pool)
        : await initializeHttpMode(this.config, this.pool);

      const {
        bootstrapService,
        relayMonitor,
        runtimeClient,
        adminClient,
        channelClient,
      } = initialization;

      // Run bootstrap to discover and register peers
      const bootstrapResults = await bootstrapService.bootstrap(
        this.config.additionalPeersJson
      );

      // Determine default destination from first peer
      const defaultDestination = bootstrapResults.length > 0
        ? bootstrapResults[0].knownPeer.ilpAddress
        : null;

      // Extract bootstrapped peer pubkeys for relay monitor exclusion
      const bootstrappedPubkeys = bootstrapResults.map(r => r.knownPeer.pubkey);

      // Start relay monitor (excludes already-bootstrapped peers)
      const subscription = relayMonitor.start(bootstrappedPubkeys);

      // Wire up relay monitor event forwarding
      this.setupRelayMonitorEvents(relayMonitor);

      // Store runtime state
      this.state = {
        mode,
        bootstrapService,
        relayMonitor,
        runtimeClient,
        adminClient,
        channelClient,
        subscription,
        defaultDestination,
        activeSubscriptions: new Set(),
      };

      const result: CrosstownStartResult = {
        bootstrapResults,
        peerCount: bootstrapResults.length,
        channelCount: bootstrapResults.filter(r => r.channelId).length,
        mode,
      };

      // Emit started event
      this.emit('started', { startResult: result });

      return result;
    } catch (error) {
      throw new InvalidStateError(
        'Failed to start client',
        error instanceof Error ? error : undefined
      );
    }
  }

  async stop(): Promise<void> {
    if (this.state === null) {
      return; // No-op if not started
    }

    // Close all user subscriptions
    for (const sub of this.state.activeSubscriptions) {
      sub.close();
    }
    this.state.activeSubscriptions.clear();

    // Unsubscribe from relay monitor
    if (this.state.subscription) {
      this.state.subscription.unsubscribe();
    }

    // Close all relay connections
    this.pool.close(this.getActiveRelayUrls());

    // Clear state
    this.state = null;

    // Emit stopped event
    this.emit('stopped', {});
  }

  get isStarted(): boolean {
    return this.state !== null;
  }

  // ==========================================================================
  // NOSTR SUBSCRIPTIONS (READ - FREE)
  // ==========================================================================

  subscribe(
    relays: string | string[],
    filters: Filter[],
    callbacks: {
      onevent: (event: NostrEvent) => void;
      oneose?: () => void;
      onclose?: (reason?: string) => void;
    }
  ): NostrSubscription {
    this.assertStarted();

    const relayUrls = Array.isArray(relays) ? relays : [relays];

    // Check subscription limit
    if (this.state!.activeSubscriptions.size >= this.config.maxSubscriptions) {
      throw new ConfigurationError(
        `Maximum subscriptions (${this.config.maxSubscriptions}) reached`
      );
    }

    // Use shared pool for subscription
    const sub = this.pool.subscribeMany(relayUrls, filters, {
      onevent: callbacks.onevent,
      oneose: callbacks.oneose,
      onclose: callbacks.onclose,
    });

    // Track active subscriptions for cleanup
    this.state!.activeSubscriptions.add(sub);

    // Wrap to remove from tracking on close
    const originalClose = sub.close.bind(sub);
    sub.close = () => {
      this.state?.activeSubscriptions.delete(sub);
      originalClose();
    };

    return sub;
  }

  subscribeToRelay(
    filters: Filter[],
    callbacks: {
      onevent: (event: NostrEvent) => void;
      oneose?: () => void;
      onclose?: (reason?: string) => void;
    }
  ): NostrSubscription {
    return this.subscribe(this.config.relayUrl, filters, callbacks);
  }

  async queryEvents(
    relays: string | string[],
    filters: Filter[],
    options?: { timeout?: number }
  ): Promise<NostrEvent[]> {
    this.assertStarted();

    const relayUrls = Array.isArray(relays) ? relays : [relays];
    const timeout = options?.timeout ?? this.config.queryTimeout;

    return new Promise((resolve) => {
      const events: NostrEvent[] = [];
      let receivedEose = 0;
      const targetEose = relayUrls.length;

      const timeoutId = setTimeout(() => {
        sub.close();
        resolve(events); // Return what we have so far
      }, timeout);

      const sub = this.pool.subscribeMany(relayUrls, filters, {
        onevent: (event) => {
          events.push(event);
        },
        oneose: () => {
          receivedEose++;
          if (receivedEose >= targetEose) {
            clearTimeout(timeoutId);
            sub.close();
            resolve(events);
          }
        },
      });
    });
  }

  async getEvent(
    relays: string | string[],
    eventId: string
  ): Promise<NostrEvent | null> {
    const events = await this.queryEvents(
      relays,
      [{ ids: [eventId] }],
      { timeout: 5000 }
    );

    return events.length > 0 ? events[0] : null;
  }

  // ==========================================================================
  // PEER MANAGEMENT
  // ==========================================================================

  async peerWith(pubkey: string): Promise<PeerResult> {
    this.assertStarted();

    const result = await this.state!.relayMonitor.peerWith(pubkey);

    // Emit event
    this.emit('peer:connected', { peerResult: result });

    return result;
  }

  getPeers(): PeerInfo[] {
    this.assertStarted();

    // Aggregate peers from bootstrap and relay monitor
    const bootstrapPeers = this.state!.bootstrapService.getBootstrappedPeers();
    const discoveredPeers = this.state!.relayMonitor.getDiscoveredPeers();

    return [...bootstrapPeers, ...discoveredPeers];
  }

  async removePeer(pubkey: string): Promise<void> {
    this.assertStarted();

    await this.state!.adminClient.removePeer(pubkey);

    this.emit('peer:disconnected', { pubkey });
  }

  // ==========================================================================
  // EVENT PUBLISHING (WRITE - PAID)
  // ==========================================================================

  async publishEvent(
    event: NostrEvent,
    options?: PublishEventOptions
  ): Promise<PublishEventResult> {
    this.assertStarted();

    const startTime = Date.now();

    try {
      // Determine destination
      const destination = options?.destination
        ?? this.state!.defaultDestination
        ?? this.throwNoDestination();

      // TOON-encode event
      const toonBytes = this.config.toonEncoder(event);
      const base64Data = Buffer.from(toonBytes).toString('base64');

      // Calculate price if not provided
      const amount = options?.amount ?? calculatePrice(
        toonBytes.length,
        this.config.basePricePerByte,
        this.config.fixedOverhead
      ).toString();

      // Send ILP packet with retry
      const result = await withRetry(
        () => this.state!.runtimeClient.sendIlpPacket({
          destination,
          amount,
          data: base64Data,
          timeout: options?.timeout,
        }),
        {
          maxRetries: this.config.maxRetries,
          retryDelay: this.config.retryDelay,
        }
      );

      const duration = Date.now() - startTime;

      if (!result.accepted) {
        const failure: PublishEventFailure = {
          success: false,
          eventId: event.id,
          code: result.code ?? 'UNKNOWN',
          message: result.message ?? 'Payment rejected',
        };

        this.emit('event:failed', { result: failure });
        return failure;
      }

      const success: PublishEventSuccess = {
        success: true,
        eventId: event.id,
        amountPaid: amount,
        fulfillment: result.fulfillment!,
        duration,
      };

      this.emit('event:published', { result: success });
      return success;

    } catch (error) {
      const failure: PublishEventFailure = {
        success: false,
        eventId: event.id,
        code: 'CLIENT_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        error: error instanceof Error ? error : undefined,
      };

      this.emit('event:failed', { result: failure });
      return failure;
    }
  }

  async publishBatch(
    events: NostrEvent[],
    options?: PublishBatchOptions
  ): Promise<PublishEventResult[]> {
    const parallel = options?.parallel ?? true;

    if (parallel) {
      return Promise.all(
        events.map(event => this.publishEvent(event, {
          destination: options?.destination,
          timeout: options?.timeout,
        }))
      );
    } else {
      const results: PublishEventResult[] = [];
      for (const event of events) {
        const result = await this.publishEvent(event, {
          destination: options?.destination,
          timeout: options?.timeout,
        });
        results.push(result);
      }
      return results;
    }
  }

  // ==========================================================================
  // PAYMENT CHANNELS
  // ==========================================================================

  get channels(): ConnectorChannelClient | null {
    return this.state?.channelClient ?? null;
  }

  async openChannel(params: OpenChannelParams): Promise<OpenChannelResult> {
    this.assertStarted();

    if (!this.state!.channelClient) {
      throw new UnsupportedOperationError('openChannel', this.state!.mode);
    }

    const result = await this.state!.channelClient.openChannel(params);

    this.emit('channel:opened', {
      channelId: result.channelId,
      peerId: params.peerId,
    });

    return result;
  }

  async getChannelState(channelId: string): Promise<ChannelState> {
    this.assertStarted();

    if (!this.state!.channelClient) {
      throw new UnsupportedOperationError('getChannelState', this.state!.mode);
    }

    return this.state!.channelClient.getChannelState(channelId);
  }

  // ==========================================================================
  // EVENT LISTENERS
  // ==========================================================================

  on<E extends ClientEventType>(
    event: E,
    listener: ClientEventListener<E>
  ): void {
    this.emitter.on(event, listener);
  }

  off<E extends ClientEventType>(
    event: E,
    listener: ClientEventListener<E>
  ): void {
    this.emitter.off(event, listener);
  }

  once<E extends ClientEventType>(
    event: E,
    listener: ClientEventListener<E>
  ): void {
    this.emitter.once(event, listener);
  }

  // ==========================================================================
  // INTERNAL SERVICES ACCESS
  // ==========================================================================

  get bootstrap(): BootstrapService {
    this.assertStarted();
    return this.state!.bootstrapService;
  }

  get relayMonitor(): RelayMonitor {
    this.assertStarted();
    return this.state!.relayMonitor;
  }

  get pool(): SimplePool {
    return this._pool;
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private assertStarted(): asserts this is { state: RuntimeState } {
    if (this.state === null) {
      throw new InvalidStateError('Client not started. Call start() first.');
    }
  }

  private throwNoDestination(): never {
    throw new ConfigurationError(
      'No destination available. Provide via publishEvent() options or ensure peers are bootstrapped.'
    );
  }

  private emit<E extends ClientEventType>(
    event: E,
    payload: ClientEvents[E]
  ): void {
    this.emitter.emit(event, payload);
  }

  private setupRelayMonitorEvents(monitor: RelayMonitor): void {
    monitor.on('peer:discovered', (event) => {
      this.emit('peer:discovered', event);
    });
  }

  private getActiveRelayUrls(): string[] {
    const relays = new Set<string>();
    relays.add(this.config.relayUrl);

    for (const peer of this.config.knownPeers) {
      if (peer.relayUrl) relays.add(peer.relayUrl);
    }

    return Array.from(relays);
  }
}
```

### 4.3 Key Algorithms

**Price Calculation (`src/pricing.ts`)**
```typescript
/**
 * Calculate the price for an ILP packet containing a Nostr event.
 *
 * Formula: (eventSize * basePricePerByte) + fixedOverhead
 */
export function calculatePrice(
  eventSizeBytes: number,
  basePricePerByte: bigint = 10n,
  fixedOverhead: bigint = 100n
): bigint {
  return BigInt(eventSizeBytes) * basePricePerByte + fixedOverhead;
}
```

**Retry with Exponential Backoff (`src/utils/retry.ts`)**
```typescript
export interface RetryOptions {
  maxRetries: number;
  retryDelay: number;
  exponentialBackoff?: boolean;
  maxDelay?: number;
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const {
    maxRetries,
    retryDelay,
    exponentialBackoff = true,
    maxDelay = 30000,
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxRetries) break;

      const delay = exponentialBackoff
        ? Math.min(retryDelay * Math.pow(2, attempt), maxDelay)
        : retryDelay;

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
```

---

## 5. Testing Strategy

### 5.1 Testing Pyramid

```
        E2E Tests (10%)
       /              \
    Integration Tests (30%)
   /                      \
  Unit Tests (60%)
```

### 5.2 Unit Tests

**Coverage target: 90%+**

Key areas:
- CrosstownClient class methods
- Config validation and defaults
- Price calculation
- Retry logic with exponential backoff
- Error classes and error handling
- Event emitter functionality
- Subscription management

**Example Test:**
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { CrosstownClient } from '../src/CrosstownClient';
import { MockConnector } from './fixtures/mock-connector';

describe('CrosstownClient', () => {
  it('should throw when started twice', async () => {
    const client = new CrosstownClient({
      connector: new MockConnector(),
      secretKey: new Uint8Array(32),
      ilpInfo: { ilpAddress: 'g.test', /* ... */ },
      toonEncoder: mockEncoder,
      toonDecoder: mockDecoder,
      handlePacket: async () => ({ accept: true, fulfillment: 'test' }),
    });

    await client.start();
    await expect(client.start()).rejects.toThrow('already started');
  });

  it('should manage subscriptions correctly', async () => {
    const client = new CrosstownClient({ /* ... */ });
    await client.start();

    const events: NostrEvent[] = [];
    const sub = client.subscribe(['wss://test'], [{ kinds: [1] }], {
      onevent: (e) => events.push(e)
    });

    expect(client['state']!.activeSubscriptions.size).toBe(1);

    sub.close();
    expect(client['state']!.activeSubscriptions.size).toBe(0);
  });
});
```

### 5.3 Integration Tests

Test full workflows across multiple components:
- Bootstrap → peer discovery → SPSP handshake → channel opening
- Event publishing with retry and backoff
- Subscription with event delivery
- Mode switching (embedded vs HTTP)
- Event listener propagation

### 5.4 E2E Tests

Test against real components:
- Real Nostr relay (local test relay)
- Real connector instance
- Real TOON encoding/decoding
- Real ILP packet flow
- Real subscription delivery

### 5.5 Test Coverage Requirements

| Component | Unit | Integration | E2E |
|-----------|------|-------------|-----|
| CrosstownClient | ✅ 95% | ✅ | ✅ |
| Config validation | ✅ 100% | - | - |
| Pricing | ✅ 100% | - | - |
| Retry logic | ✅ 95% | ✅ | - |
| Subscriptions | ✅ 90% | ✅ | ✅ |
| Embedded mode | ✅ 90% | ✅ | ✅ |
| HTTP mode | ✅ 90% | ✅ | ✅ |
| Event system | ✅ 95% | ✅ | - |

---

## 6. Package Publishing & Distribution

### 6.1 Package.json

```json
{
  "name": "@crosstown/client",
  "version": "1.0.0",
  "description": "Unified client for the Crosstown protocol - full Nostr client with ILP micropayments",
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": [
    "dist",
    "README.md",
    "MIGRATION.md"
  ],
  "scripts": {
    "build": "tsup",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit"
  },
  "keywords": [
    "crosstown",
    "nostr",
    "ilp",
    "interledger",
    "spsp",
    "client",
    "micropayments"
  ],
  "repository": {
    "type": "git",
    "url": "https://github.com/ALLiDoizCode/crosstown.git",
    "directory": "packages/client"
  },
  "license": "MIT",
  "dependencies": {
    "@crosstown/core": "workspace:*",
    "nostr-tools": "^2.20.0"
  },
  "peerDependencies": {
    "@agent-runtime/connector": ">=1.2.0"
  },
  "peerDependenciesMeta": {
    "@agent-runtime/connector": {
      "optional": true
    }
  },
  "devDependencies": {
    "@crosstown/relay": "workspace:*",
    "@types/node": "^20.0.0",
    "tsup": "^8.0.0",
    "typescript": "^5.3.0",
    "vitest": "^1.0.0"
  }
}
```

---

## 7. Migration Guide

### 7.1 From `createCrosstownNode` to `CrosstownClient`

**Before (Old API):**
```typescript
import { createCrosstownNode } from '@crosstown/core';

const node = createCrosstownNode({
  connector,
  handlePacket,
  secretKey,
  ilpInfo,
  toonEncoder,
  toonDecoder,
});

await node.start();
```

**After (New API):**
```typescript
import { CrosstownClient } from '@crosstown/client';

const client = new CrosstownClient({
  connector,
  handlePacket,
  secretKey,
  ilpInfo,
  toonEncoder,
  toonDecoder,
});

await client.start();
```

### 7.2 Breaking Changes

1. **Import path**: `@crosstown/core` → `@crosstown/client`
2. **Function to class**: `createCrosstownNode()` → `new CrosstownClient()`
3. **Return type**: Factory function → Class instance

### 7.3 New Features Available

After migrating, you gain:

1. **Full subscription API** - Subscribe to any Nostr relay
2. **HTTP mode** - Use `connectorUrl` instead of embedded connector
3. **`publishEvent()`** - High-level event publishing API
4. **`queryEvents()`** - One-time event fetches
5. **Event listeners** - Observable client lifecycle
6. **Batch publishing** - `publishBatch()` for multiple events
7. **Better errors** - Typed error classes

---

## 8. Future Enhancements

### 8.1 Planned Features (v1.x)

1. **HTTP Admin Client** (v1.1)
   - Complete HTTP mode with peer management
   - `removePeer()` support in HTTP mode

2. **Auto-Reconnection** (v1.1)
   - Automatic reconnection on connection loss
   - Exponential backoff for reconnection attempts

3. **Browser Support** (v1.2)
   - Replace Node.js-specific APIs
   - Custom event system (not Node EventEmitter)
   - Web Crypto API support

4. **Advanced Queries** (v1.2)
   - `queryEventsByFilter()` with pagination
   - `countEvents()` for statistics
   - Query result caching

5. **Subscription Enhancements** (v1.3)
   - `subscribeWithReconnect()` - Auto-reconnecting subscriptions
   - Subscription filters update
   - Backpressure handling

### 8.2 Research Items (v2.x)

1. **Multi-relay coordination**
2. **WebSocket fallback for HTTP mode**
3. **SPSP response caching**
4. **Built-in metrics (Prometheus)**
5. **Plugin system**

---

## 9. Coding Standards

### 9.1 Critical Rules

- **TypeScript strict mode**: All code must pass `strict: true`
- **Error handling**: Always use typed error classes, never throw strings
- **Async patterns**: Use `async/await`, avoid raw Promises
- **Config validation**: Validate all inputs in constructor, fail fast
- **No silent failures**: Log or emit errors, never swallow exceptions
- **Immutability**: Never mutate config or state objects directly
- **Dependency injection**: Accept dependencies as constructor params

### 9.2 Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Classes | PascalCase | `CrosstownClient` |
| Interfaces | PascalCase | `CrosstownClientConfig` |
| Methods | camelCase | `publishEvent()` |
| Private fields | camelCase | `state` |
| Constants | UPPER_SNAKE_CASE | `DEFAULT_RETRY_DELAY` |
| Type aliases | PascalCase | `ClientEventType` |

---

## 10. Security & Performance

### 10.1 Security Considerations

1. **Secret key handling**:
   - Never log secret keys
   - Clear from memory when client stops
   - Validate length (32 bytes)

2. **Input validation**:
   - Validate all pubkeys (64-char hex)
   - Sanitize ILP addresses
   - Validate TOON-encoded data

3. **Network security**:
   - Use WSS for relay connections in production
   - Validate TLS certificates in HTTP mode
   - Rate limit publishEvent() to prevent abuse

### 10.2 Performance Targets

| Operation | Target | Notes |
|-----------|--------|-------|
| `start()` | < 2s | With 5 bootstrap peers |
| `publishEvent()` | < 500ms | Single event, embedded mode |
| `publishEvent()` | < 1s | Single event, HTTP mode |
| `subscribe()` | < 100ms | Connection establishment |
| `queryEvents()` | < 2s | Query with 100 results |
| Memory usage | < 50MB | Idle client |
| Memory usage | < 100MB | With 100 peers + 10 subscriptions |

---

## 11. Monitoring & Observability

### 11.1 Event-Based Monitoring

```typescript
client.on('started', ({ startResult }) => {
  metrics.gauge('peers.count', startResult.peerCount);
  metrics.gauge('channels.count', startResult.channelCount);
});

client.on('event:published', ({ result }) => {
  metrics.increment('events.published');
  metrics.histogram('publish.duration', result.duration);
});

client.on('event:failed', ({ result }) => {
  metrics.increment('events.failed', { code: result.code });
});

client.on('error', ({ error, context }) => {
  logger.error('Client error', { error, context });
});
```

### 11.2 Key Metrics

**Client metrics:**
- `client.started` - Client starts
- `client.stopped` - Client stops
- `peers.discovered` - Peers discovered
- `peers.connected` - Successful peer connections
- `channels.opened` - Payment channels opened
- `subscriptions.active` - Active subscription count

**Publishing metrics:**
- `events.published` - Successful publishes
- `events.failed` - Failed publishes (by error code)
- `publish.duration` - Publish latency histogram
- `publish.amount` - Payment amounts

**Subscription metrics:**
- `subscriptions.created` - New subscriptions
- `subscriptions.closed` - Closed subscriptions
- `events.received` - Events received from subscriptions

**Error metrics:**
- `errors` - All errors (by type and context)
- `retries` - Retry attempts

---

## Appendix A: Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-20 | Move `createCrosstownNode` to `@crosstown/client` | Better package organization, clearer naming |
| 2026-02-20 | Add full subscription API | Clients need read capabilities, not just write |
| 2026-02-20 | Use shared SimplePool | Efficient connection management |
| 2026-02-20 | Class-based API over factory function | Better TypeScript ergonomics, clearer lifecycle |

---

## Appendix B: References

- [Crosstown Protocol CLAUDE.md](../../CLAUDE.md)
- [Nostr Protocol Specification](https://github.com/nostr-protocol/nips)
- [NIP-01: Basic Protocol](https://github.com/nostr-protocol/nips/blob/master/01.md)
- [Interledger RFC 0009: SPSP](https://interledger.org/developers/rfcs/simple-payment-setup-protocol/)
- [nostr-tools Documentation](https://github.com/nbd-wtf/nostr-tools)

---

**End of Architecture Document**
