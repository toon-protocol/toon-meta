# Brief: Expose Payment Channel Methods on ConnectorNode

## Context

`@agent-society/core` provides an embedded mode where the connector runs in-process via `createAgentSocietyNode()`. All peer management and ILP packet routing already works through direct method calls on `ConnectorNode` — no HTTP required.

However, **payment channel operations are HTTP-only** (`POST /admin/channels`, `GET /admin/channels/:channelId`). This means the SPSP handshake flow cannot open payment channels in embedded mode. The `negotiateAndOpenChannel()` function in agent-society needs to call channel methods directly on the connector instance.

## What agent-society needs

`ConnectorNode` needs to expose two public methods that match the `ConnectorChannelClient` interface already defined in `@agent-society/core`:

```typescript
// From @agent-society/core/types.ts

interface OpenChannelParams {
  peerId: string;          // Registered peer ID (e.g., "nostr-54dad746e52dab00")
  chain: string;           // Settlement chain (e.g., "evm:base:84532")
  token?: string;          // Token contract address
  tokenNetwork?: string;   // TokenNetwork contract address
  peerAddress: string;     // Peer's on-chain wallet address
  initialDeposit?: string; // Amount as string (default: "0")
  settlementTimeout?: number; // Challenge period in seconds (default: 86400)
}

interface OpenChannelResult {
  channelId: string;
  status: string;
}

interface ChannelState {
  channelId: string;
  status: 'opening' | 'open' | 'closed' | 'settled';
  chain: string;
}

interface ConnectorChannelClient {
  openChannel(params: OpenChannelParams): Promise<OpenChannelResult>;
  getChannelState(channelId: string): Promise<ChannelState>;
}
```

## Required changes to ConnectorNode

### 1. `openChannel(params: OpenChannelParams): Promise<OpenChannelResult>`

Exposes the same logic currently behind `POST /admin/channels`:

1. Validate peer exists (`btpClientManager.getPeerIds()` check)
2. Resolve peer address from `params.peerAddress`
3. Call `channelManager.ensureChannelExists(peerId, tokenId, options)`
4. Return `{ channelId, status }`

This is a thin wrapper around `ChannelManager.ensureChannelExists()` with the same peer validation the HTTP handler does.

### 2. `getChannelState(channelId: string): Promise<ChannelState>`

Exposes the same logic currently behind `GET /admin/channels/:channelId`:

1. Get metadata from `channelManager.getChannelById(channelId)`
2. Normalize status to agent-society's status union
3. Return `{ channelId, status, chain }`

### Current internal references (all private)

From `connector-node.ts`:
- `_channelManager: ChannelManager` — holds channel lifecycle state
- `_paymentChannelSDK: PaymentChannelSDK` — on-chain operations
- `_settlementExecutor` — settlement execution

The HTTP admin API in `admin-api.ts` accesses these via closures passed during server setup. The new public methods on `ConnectorNode` would access them directly as instance members.

## How agent-society will consume this

Once ConnectorNode exposes these methods, agent-society extends `EmbeddableConnectorLike`:

```typescript
// Current
interface EmbeddableConnectorLike {
  sendPacket(params: SendPacketParams): Promise<SendPacketResult>;
  registerPeer(params: RegisterPeerParams): Promise<void>;
  removePeer(peerId: string): Promise<void>;
  setPacketHandler(handler: PacketHandler): void;
}

// Extended
interface EmbeddableConnectorLike {
  sendPacket(params: SendPacketParams): Promise<SendPacketResult>;
  registerPeer(params: RegisterPeerParams): Promise<void>;
  removePeer(peerId: string): Promise<void>;
  setPacketHandler(handler: PacketHandler): void;
  openChannel(params: OpenChannelParams): Promise<OpenChannelResult>;   // NEW
  getChannelState(channelId: string): Promise<ChannelState>;            // NEW
}
```

Then `createDirectChannelClient(connector)` wraps these into a `ConnectorChannelClient`, and `negotiateAndOpenChannel()` gets wired into the ILP-routed SPSP handler inside `createAgentSocietyNode()`.

## End-to-end flow (after implementation)

```
Peer A (joiner)                          Peer B (genesis, spspMinPrice=0)
     │                                        │
     │  Phase 1: Query relay for kind:10032   │
     │──────── Nostr relay ──────────────────>│
     │                                        │
     │  Phase 2: SPSP handshake (0-amount)    │
     │  ILP PREPARE (kind:23194 in TOON)      │
     │──────── ILP connector routing ────────>│
     │                                        │  parseSpspRequest()
     │                                        │  negotiateAndOpenChannel()
     │                                        │    → connector.openChannel()  ← direct call
     │                                        │    → connector.getChannelState() poll
     │                                        │  buildSpspResponseEvent(channelId)
     │  ILP FULFILL (kind:23195 in TOON)      │
     │<───────────────────────────────────────│
     │  parseSpspResponse() → channelId       │
     │  updatePeerRegistration(settlement)    │
     │                                        │
     │  Phase 3: Announce kind:10032 (paid)   │
     │  ILP PREPARE (kind:10032 in TOON)      │
     │──────── ILP connector routing ────────>│
     │                                        │  BLS stores event, returns FULFILL
```

## Scope

| Change | Project | File |
|--------|---------|------|
| Add `openChannel()` to ConnectorNode | agent-runtime | `packages/connector/src/core/connector-node.ts` |
| Add `getChannelState()` to ConnectorNode | agent-runtime | `packages/connector/src/core/connector-node.ts` |
| Export types if not already | agent-runtime | `packages/connector/src/index.ts` |
| Extend `EmbeddableConnectorLike` | agent-society | `packages/core/src/compose.ts` |
| Create `createDirectChannelClient()` | agent-society | `packages/core/src/bootstrap/direct-channel-client.ts` |
| Wire `negotiateAndOpenChannel` into SPSP handler | agent-society | `packages/core/src/compose.ts` |
| Update integration test | agent-society | `packages/core/src/__integration__/five-peer-bootstrap.test.ts` |

## Reference files

**agent-runtime:**
- `packages/connector/src/core/connector-node.ts` — ConnectorNode class (needs new methods)
- `packages/connector/src/settlement/channel-manager.ts` — `ensureChannelExists()`, `getChannelById()`
- `packages/connector/src/http/admin-api.ts` — HTTP handlers to use as reference implementation

**agent-society:**
- `packages/core/src/types.ts` — `ConnectorChannelClient`, `OpenChannelParams`, `ChannelState`
- `packages/core/src/spsp/negotiateAndOpenChannel.ts` — settlement negotiation + channel open
- `packages/core/src/compose.ts` — `EmbeddableConnectorLike`, `createAgentSocietyNode()`
- `packages/core/src/bootstrap/direct-runtime-client.ts` — pattern for `createDirectChannelClient`
- `packages/core/src/bootstrap/direct-connector-admin.ts` — pattern for `createDirectChannelClient`
