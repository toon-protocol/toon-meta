# Babylon Social Integration: Deep Research Report

**Date:** 2026-02-10
**Status:** Complete
**Scope:** Integration architecture for Babylon Social + Agent Society + Agent-Runtime

---

## Executive Summary

### Recommended Integration Architecture

Agent-runtime should be an **ElizaOS-embedded hybrid** that runs both `@elizaos/plugin-babylon` and a new `@elizaos/plugin-agent-society` within the same runtime. This gives each agent both Babylon trading capabilities and ILP payment routing, unified through ElizaOS's event system and shared wallet services. The two plugins communicate via ElizaOS events rather than custom coupling.

### Top 3 Highest-Value Integration Points

1. **ILP Micropayments for A2A Agent Services** (Effort: Medium, 4-6 weeks)
   Replace or supplement Babylon's x402 payment protocol with ILP streaming micropayments for agent-to-agent service requests. This enables pay-per-inference, pay-per-analysis, and pay-per-signal pricing that x402's per-transaction model cannot efficiently support. Compound value: Babylon agents get cheaper, more granular payments; Agent Society gets a high-value application layer with real economic activity.

2. **Trust Unification: Social Graph + Trading Performance** (Effort: Medium, 3-4 weeks)
   Feed Babylon's on-chain reputation (ERC-8004 trading P&L, accuracy scores) into Agent Society's credit limit computation alongside social trust (NIP-02 follows, mutual connections). Compound value: Credit limits for ILP routing become informed by both social trust AND economic performance — a signal no competing system offers.

3. **NIP-90 DVMs as Babylon Compute Marketplace** (Effort: Medium-High, 6-8 weeks)
   Babylon agents offer DVM services (market analysis, sentiment scoring, narrative summarization) that Agent Society agents pay for via ILP micropayments. This bridges Agent Society Epic 10 with Babylon's game engine. Compound value: Babylon's AI capabilities become monetizable services discoverable on Nostr; Agent Society agents gain access to specialized market intelligence.

### Critical Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Agent Society integration gaps (P0 bugs) block ILP routing | High | Fix Gaps 1-2 (BLS settlement negotiation, ConnectorChannelClient) before integration work |
| ElizaOS plugin conflicts between babylon and agent-society | Medium | Namespace all actions with prefixes, use separate services, share only wallet provider |
| ERC-8004 ↔ Nostr identity linkage has no standard | Medium | Use dual-attestation pattern (Nostr kind:0 references ERC-8004 tokenId; ERC-8004 metadata stores npub) |
| ILP settlement latency too high for real-time trading | Medium | Use ILP for service payments only; Babylon's on-chain settlement handles market positions |

### Recommended Implementation Sequence

**Phase 1** (Foundation, 4-6 weeks) → **Phase 2** (Enhancement, 6-8 weeks) → **Phase 3** (Advanced, 8-12 weeks)

---

## Section 1: Protocol Interoperability Map

### 1.1 System Pair Matrix

#### Babylon ↔ Agent Society

| Dimension | Babylon | Agent Society | Translation Required |
|-----------|---------|---------------|---------------------|
| **Identity** | ERC-8004 NFT (Ethereum address + tokenId) | Nostr keypair (npub/nsec, secp256k1) | Dual-attestation: cross-reference in metadata |
| **Reputation** | On-chain: totalBets, winningBets, accuracyScore, trustScore (0-10000) | Social: distance (hops), mutual followers, zaps (0.0-1.0) | Normalization function: Babylon 0-10000 → 0.0-1.0 weight |
| **Social Graph** | PostgreSQL follows (followUser/unfollowUser via A2A) | NIP-02 follow lists (Nostr events) | Bidirectional sync: A2A follow → NIP-02 event publish |
| **Communication** | A2A JSON-RPC 2.0 over HTTP/WebSocket (73+ methods) | Nostr events (kind:10032, 23194, 23195) via relay | A2A-to-Nostr event translator in agent-runtime |
| **Payments** | x402 (HTTP 402 + EIP-3009 signed tx, min ~$0.001 USDC) | ILP (PREPARE/FULFILL/REJECT with TOON-encoded data) | x402 as ILP settlement engine on Base L2 |
| **Discovery** | Agent Card at `/.well-known/agent-card.json` | NIP-02 follow list + kind:10032 peer info events | Publish A2A agent card referencing Nostr pubkey + ILP address |
| **Auth** | API key + Privy token + ERC-8004 signature | Nostr event signing (NIP-01) + BTP token | Bridge: Nostr signature verifiable as A2A credential |

#### Babylon ↔ Agent-Runtime

| Dimension | Babylon | Agent-Runtime | Translation Required |
|-----------|---------|---------------|---------------------|
| **API** | REST + A2A JSON-RPC + MCP (70+ tools) | ILP POST /ilp/send + Admin API | Agent-runtime exposes both interfaces |
| **Packet Format** | JSON-RPC 2.0 request/response | ILP PREPARE (destination, amount, data) | A2A task → ILP packet with TOON-encoded metadata |
| **Settlement** | Base L2 smart contracts (EIP-2535 Diamond) | ILP settlement engines (Base, XRP, Aptos) | Base L2 is the shared settlement layer |
| **State** | PostgreSQL + Redis | In-memory routing table + channel state | Admin API bridges state queries |

#### Agent Society ↔ Agent-Runtime

| Dimension | Agent Society | Agent-Runtime | Translation Required |
|-----------|---------------|---------------|---------------------|
| **Interface** | `AgentRuntimeClient.sendIlpPacket()` | POST /ilp/send endpoint | Already defined; fix field mismatch (accepted vs fulfilled) |
| **Configuration** | `POST /admin/peers` + `POST /admin/channels` | Admin API endpoints | ConnectorChannelClient HTTP implementation needed (Gap 2) |
| **Trust → Limits** | SocialTrustManager computes trust (0-1) → creditLimit | Connector enforces credit limits per peer | Trust score flows one-way: Agent Society → Agent-Runtime |
| **Events** | Nostr events (TOON-encoded in ILP data field) | Opaque data payload (base64 bytes) | TOON encode/decode at boundaries |

### 1.2 Identity Mapping Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    Agent Identity Registry                        │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │  Nostr Layer  │    │   EVM Layer   │    │ Babylon Layer │       │
│  │              │    │              │    │              │       │
│  │  npub: abc123│←──→│ addr: 0xDEF  │←──→│ userId: xyz  │       │
│  │  nsec: (priv)│    │ tokenId: 42  │    │ apiKey: ***  │       │
│  │              │    │              │    │              │       │
│  │  kind:0 meta │    │ ERC-8004 meta│    │ userProfile  │       │
│  │  → tokenId:42│    │ → npub:abc123│    │ → addr:0xDEF │       │
│  │  → addr:0xDEF│    │ → babylon:xyz│    │ → npub:abc123│       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│                                                                  │
│  Linking Method: Dual-attestation (each layer references others) │
│  Verification: Cross-check all three; any two sufficient         │
└──────────────────────────────────────────────────────────────────┘
```

**Recommended approach: Dual-identity with cross-reference**

- Nostr kind:0 profile metadata includes: `{"erc8004_token_id": 42, "evm_address": "0xDEF", "babylon_user_id": "xyz"}`
- ERC-8004 `setMetadata(agentId, "nostr_pubkey", "<hex_pubkey>")` stores Nostr identity on-chain
- Babylon user profile `metadata` field includes `nostr_pubkey` for discovery

This approach requires no shared keypair derivation (which would be a security risk) and allows independent evolution of each identity layer.

### 1.3 Message Format Translations

```
A2A JSON-RPC Request                    ILP PREPARE
┌──────────────────────┐               ┌──────────────────────┐
│ {                    │               │ destination: "g.peer1"│
│   "jsonrpc": "2.0",  │    translate  │ amount: "1000"       │
│   "method": "a2a.X", │ ──────────→  │ data: base64(TOON(   │
│   "params": {...},   │               │   kind:23194 event   │
│   "id": "req-123"   │               │   with A2A payload   │
│ }                    │               │ ))                   │
└──────────────────────┘               │ timeout: 30000       │
                                       └──────────────────────┘

ILP FULFILL                             A2A JSON-RPC Response
┌──────────────────────┐               ┌──────────────────────┐
│ fulfillment: "..."   │    translate  │ {                    │
│ data: base64(TOON(   │ ──────────→  │   "jsonrpc": "2.0",  │
│   kind:23195 event   │               │   "result": {...},   │
│   with response      │               │   "id": "req-123"   │
│ ))                   │               │ }                    │
└──────────────────────┘               └──────────────────────┘
```

**Key insight:** A2A tasks and ILP payment flows should NOT be 1:1 mapped. Instead:
- A2A handles communication semantics (task lifecycle, streaming, agent discovery)
- ILP handles payment semantics (micropayment settlement, credit limits, routing)
- They operate as **parallel channels**: an A2A task can trigger an ILP payment, but the task itself doesn't travel through ILP

### 1.4 Authentication Flow for Cross-System Operations

```
1. Agent generates Nostr keypair (source of truth)
2. Agent derives/creates EVM wallet
3. Agent registers on ERC-8004 (stores npub in metadata)
4. Agent publishes Nostr kind:0 with ERC-8004 tokenId
5. Agent registers on Babylon via A2A handshake (signs with EVM key)
6. Agent bootstraps into Agent Society network (kind:10032 + SPSP)

Cross-system operation verification:
- Babylon → Agent Society: Verify Nostr signature matches npub in ERC-8004 metadata
- Agent Society → Babylon: Verify EVM address matches addr in Nostr kind:0 metadata
- Either → Agent-Runtime: BTP token-based auth (issued during bootstrap)
```

---

## Section 2: Agent-Runtime Architecture

### 2.1 Recommended Architecture: ElizaOS-Embedded Hybrid

**Decision: ElizaOS-embedded runtime with two plugins**

**Rationale:**
- ElizaOS provides plugin architecture, action/provider/service abstractions, background tasks, multi-model LLM support — exactly what agent-runtime needs
- plugin-babylon already exists and is battle-tested (14 actions, 14+ providers, 2 services)
- Building a standalone service would duplicate ElizaOS's capabilities
- The hybrid approach lets agent-runtime participate in Babylon as a first-class agent while routing ILP packets

**Trade-offs considered:**

| Option | Pros | Cons |
|--------|------|------|
| Standalone service (current design) | Simple, no LLM dependency | Duplicates plugin architecture; can't participate in Babylon directly |
| ElizaOS-embedded (recommended) | Reuses plugin-babylon; full agent capabilities; event system for cross-plugin communication | Heavier runtime; LLM dependency even for pure routing |
| Hybrid with sidecar | ILP router as lightweight sidecar, ElizaOS for agent logic | Two processes to manage; IPC overhead |

### 2.2 Component Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                       ElizaOS Runtime                                │
│                                                                     │
│  ┌─────────────────────────┐    ┌──────────────────────────────┐   │
│  │  plugin-babylon          │    │  plugin-agent-society         │   │
│  │                         │    │                              │   │
│  │  Actions:               │    │  Actions:                    │   │
│  │  - buy/sell shares      │    │  - send_ilp_payment          │   │
│  │  - open/close position  │    │  - request_dvm_compute       │   │
│  │  - create/reply post    │    │  - publish_nostr_event       │   │
│  │  - send message         │    │  - update_trust_score        │   │
│  │                         │    │  - open_payment_channel      │   │
│  │  Providers:             │    │                              │   │
│  │  - markets, feed        │    │  Providers:                  │   │
│  │  - portfolio, positions │    │  - peer_network              │   │
│  │  - leaderboard          │    │  - trust_scores              │   │
│  │                         │    │  - channel_balances          │   │
│  │  Services:              │    │  - social_graph              │   │
│  │  - BabylonA2AService    │    │                              │   │
│  │  - BabylonEvmService    │    │  Services:                   │   │
│  │                         │    │  - IlpRouterService          │   │
│  │  Events:                │    │  - NostrRelayService         │   │
│  │  - TRADE_EXECUTED       │    │  - SocialTrustService        │   │
│  │  - POST_CREATED         │    │  - BootstrapService          │   │
│  │  - REPUTATION_CHANGED   │    │                              │   │
│  └────────────┬────────────┘    │  Events:                     │   │
│               │                 │  - PAYMENT_RECEIVED          │   │
│               │  ElizaOS        │  - PEER_DISCOVERED           │   │
│               │  Event Bus      │  - TRUST_UPDATED             │   │
│               └────────┬────────│  - CHANNEL_OPENED            │   │
│                        │        └──────────────┬───────────────┘   │
│                        │                       │                   │
│  ┌─────────────────────┴───────────────────────┴───────────────┐   │
│  │                    Shared Infrastructure                      │   │
│  │                                                               │   │
│  │  - EVM Wallet (shared between plugins)                        │   │
│  │  - Nostr Keypair (managed by plugin-agent-society)            │   │
│  │  - Character Settings (agent personality, risk tolerance)     │   │
│  │  - Memory System (conversation history, learned patterns)     │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                    External Connections                          │ │
│  │                                                                 │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │ │
│  │  │ Babylon  │  │  Nostr   │  │   ILP    │  │  Base L2      │  │ │
│  │  │ REST/A2A │  │  Relays  │  │ Connector│  │  Contracts    │  │ │
│  │  │ API      │  │  (WS)   │  │ (BTP)   │  │  (Settlement) │  │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └───────────────┘  │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.3 Interface Definitions

#### IlpRouterService (plugin-agent-society)

```typescript
interface IlpRouterService extends Service {
  serviceType: 'ILP_ROUTER_SERVICE';

  // Core ILP operations
  sendPayment(params: {
    destination: string;
    amount: string;
    data?: string;           // base64-encoded TOON
    timeout?: number;
  }): Promise<IlpSendResult>;

  // Peer management
  addPeer(config: PeerConfig): Promise<void>;
  removePeer(peerId: string): Promise<void>;
  listPeers(): Promise<PeerInfo[]>;

  // Channel management
  openChannel(params: OpenChannelParams): Promise<OpenChannelResult>;
  getChannelState(channelId: string): Promise<ChannelState>;

  // Trust-informed routing
  updateCreditLimit(peerId: string, limit: bigint): Promise<void>;
  getRoutingTable(): Promise<RouteEntry[]>;
}
```

#### NostrRelayService (plugin-agent-society)

```typescript
interface NostrRelayService extends Service {
  serviceType: 'NOSTR_RELAY_SERVICE';

  // Event operations
  publishEvent(event: UnsignedEvent): Promise<string>;  // returns eventId
  subscribeToKind(kind: number, callback: (event: Event) => void): string;  // returns subId
  unsubscribe(subId: string): void;

  // SPSP operations
  requestSpsp(peerPubkey: string): Promise<SpspInfo>;
  handleSpspRequest(request: SpspRequest): Promise<SpspResponse>;

  // Identity
  getPublicKey(): string;
  signEvent(event: UnsignedEvent): Event;
}
```

#### SocialTrustService (plugin-agent-society)

```typescript
interface SocialTrustService extends Service {
  serviceType: 'SOCIAL_TRUST_SERVICE';

  // Trust computation
  computeTrust(peerPubkey: string): Promise<TrustScore>;
  computeCreditLimit(trustScore: number, config?: CreditLimitConfig): bigint;

  // Trust with Babylon reputation input
  computeUnifiedTrust(params: {
    peerPubkey: string;
    babylonReputation?: {        // optional Babylon signals
      accuracyScore: number;     // 0-10000
      totalBets: number;
      profitLoss: number;
      trustScore: number;        // 0-10000
    };
  }): Promise<UnifiedTrustScore>;

  // Social graph
  getFollowList(pubkey: string): Promise<string[]>;
  getSocialDistance(from: string, to: string): Promise<number>;
  getMutualFollowers(a: string, b: string): Promise<string[]>;
}
```

---

## Section 3: Trust Unification Model

### 3.1 Trust Signal Sources

**Agent Society signals (social-relational):**
- Social distance: hop count in NIP-02 follow graph (weight: 0.5)
- Mutual followers: shared connections between two agents (weight: 0.3)
- Reputation/zaps: NIP-57 zap amounts received (weight: 0.2)

**Babylon signals (economic-transactional):**
- Trading accuracy: winningBets / totalBets (0-100%)
- Volume-weighted P&L: profitLoss relative to totalVolume
- Trust score: on-chain composite (0-10000, decays with inactivity)
- Peer feedback: -5 to +5 ratings from other agents
- Ban status: binary (isBanned flag)

### 3.2 Unified Trust Computation

```typescript
interface UnifiedTrustConfig {
  // Agent Society weights (social signals)
  socialDistanceWeight: number;     // default: 0.30 (reduced from 0.50)
  mutualFollowersWeight: number;    // default: 0.20 (reduced from 0.30)
  nostrReputationWeight: number;    // default: 0.10 (reduced from 0.20)

  // Babylon weights (economic signals)
  tradingAccuracyWeight: number;    // default: 0.20
  volumeWeightedPnlWeight: number;  // default: 0.10
  babylonTrustWeight: number;       // default: 0.10

  // Thresholds
  minBetsForBabylonSignal: number;  // default: 10 (below this, Babylon signals ignored)
  bannedAgentTrustOverride: number; // default: 0.0 (banned = zero trust)
}

function computeUnifiedTrust(
  socialTrust: TrustScore,
  babylonRep?: BabylonReputation,
  config: UnifiedTrustConfig = DEFAULTS
): number {
  // Social component (always available)
  let score =
    socialTrust.breakdown.socialDistanceScore * config.socialDistanceWeight +
    socialTrust.breakdown.mutualFollowersScore * config.mutualFollowersWeight +
    socialTrust.breakdown.reputationScore * config.nostrReputationWeight;

  // Babylon component (only if sufficient data)
  if (babylonRep && babylonRep.totalBets >= config.minBetsForBabylonSignal) {
    if (babylonRep.isBanned) return config.bannedAgentTrustOverride;

    const accuracy = babylonRep.accuracyScore / 10000;  // normalize to 0-1
    const pnlSignal = Math.max(0, Math.min(1,
      (babylonRep.profitLoss / (Number(babylonRep.totalVolume) || 1)) + 0.5
    ));
    const babylonTrust = babylonRep.trustScore / 10000;  // normalize to 0-1

    score +=
      accuracy * config.tradingAccuracyWeight +
      pnlSignal * config.volumeWeightedPnlWeight +
      babylonTrust * config.babylonTrustWeight;
  } else {
    // Redistribute Babylon weight to social signals
    const babylonTotal = config.tradingAccuracyWeight +
      config.volumeWeightedPnlWeight + config.babylonTrustWeight;
    const socialTotal = config.socialDistanceWeight +
      config.mutualFollowersWeight + config.nostrReputationWeight;
    const redistribution = babylonTotal / socialTotal;

    score *= (1 + redistribution);
  }

  return Math.max(0, Math.min(1, score));  // clamp to 0-1
}
```

### 3.3 Bidirectional Trust Flow

```
Agent Society → Babylon:
  Social trust score published to ERC-8004 ReputationSystem
  via submitFeedback(tokenId, rating=trust*10-5, comment="social-trust")
  (maps 0.0-1.0 → -5 to +5 rating scale)

Babylon → Agent Society:
  Trading reputation queried via A2A: a2a.getReputation(agentId)
  Normalized and fed into unified trust computation
  Result used for ILP credit limit: calculateCreditLimit(unifiedScore, config)
```

### 3.4 Credit Limit Implications

With unified trust, credit limits become more accurate:

| Scenario | Social-Only Trust | Unified Trust | Impact |
|----------|------------------|---------------|--------|
| New agent, no Babylon history | 0.3 (2 hops) | 0.3 (same, redistribution) | No change |
| Active trader, 80% accuracy, direct follow | 0.8 | 0.88 (accuracy boosts) | Higher credit limit |
| Profitable trader, no social connections | 0.1 (distant) | 0.35 (trading compensates) | Unlocks routing |
| Banned agent, many followers | 0.7 | 0.0 (ban override) | Prevents exploitation |

---

## Section 4: Payment Integration Architecture

### 4.1 ILP Payment Flows for Babylon Use Cases

#### Use Case 1: A2A Agent Service Payments (replaces x402)

```
Agent A (Babylon)                    Agent B (Babylon + Agent Society)
│                                    │
│  "Analyze market for prediction X" │
├─ A2A: a2a.paymentRequest ─────────>│
│  (service: "market-analysis")      │
│                                    │
│<─ A2A: paymentRequired ────────────┤
│  (amount: 500 units, ILP address)  │
│                                    │
│  plugin-agent-society:             │
│  IlpRouterService.sendPayment({   │
│    destination: "g.agentB.services",│
│    amount: "500",                  │
│    data: TOON(kind:5003 job req)   │
│  })                                │
├─ ILP PREPARE ──────────────────────>│
│                                    │  Receives payment
│                                    │  Executes analysis
│<─ ILP FULFILL ─────────────────────┤
│  (data: TOON(kind:6003 result))    │
│                                    │
│  Extracts analysis from FULFILL    │
│  Uses for trading decision         │
```

**Why ILP over x402:**
- x402 requires a full blockchain transaction per request (~$0.001 minimum, ~15s latency on Base)
- ILP enables streaming micropayments (sub-cent, sub-second latency via pre-funded channels)
- ILP credit limits prevent spam without per-request on-chain validation
- x402 can still serve as ILP's settlement engine for periodic on-chain settlement

#### Use Case 2: Alpha Group Access via Payment Channels

```
Agent wants to join Alpha Group:

1. Agent discovers group via A2A: a2a.getGroupInvites()
2. Group requires ILP channel deposit: 10,000 units
3. Agent opens ILP channel to group operator:
   IlpRouterService.openChannel({
     peerId: "group-operator",
     chain: "evm:base:84532",
     initialDeposit: "10000"
   })
4. Channel opening confirmed on Base L2
5. Agent granted access via A2A: a2a.acceptGroupInvite()
6. Ongoing membership fee: 100 units/hour deducted from channel
7. Group messages routed via ILP as paid TOON-encoded events
```

This maps directly to Agent Society Epic 14 (Payment-Gated Swarms → NIP-29 groups).

#### Use Case 3: DVM Compute Jobs (Epic 10 ↔ Babylon Engine)

```
Agent Society Agent                  Babylon DVM Provider
│                                    │
│  NIP-90 kind:5003 job request     │
│  "Summarize narrative for org X"   │
├─ Publish to relay ────────────────>│ (NIP-89 discovery)
│                                    │
│<─ kind:7000 feedback ──────────────┤
│  (status: "payment-required")      │
│  (amount: "2000 msats via ILP")    │
│                                    │
│  IlpRouterService.sendPayment({   │
│    destination: dvm_ilp_address,   │
│    amount: "2000"                  │
│  })                                │
├─ ILP PREPARE ──────────────────────>│
│                                    │  Babylon engine processes
│                                    │  LLM generates summary
│<─ kind:6003 result ────────────────┤
│  (content: "Organization X...")    │
│                                    │
│<─ ILP FULFILL ─────────────────────┤
│  (payment confirmed)               │
```

### 4.2 Settlement Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Settlement Layer                        │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │              Base L2 (Shared Chain)                 │  │
│  │                                                   │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────┐ │  │
│  │  │ ILP Payment  │  │ Babylon      │  │ ERC-8004 │ │  │
│  │  │ Channels    │  │ Prediction   │  │ Identity │ │  │
│  │  │ (TokenNet)  │  │ Markets      │  │ Registry │ │  │
│  │  └─────────────┘  └──────────────┘  └──────────┘ │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ILP channels settle periodically to Base L2            │
│  Babylon markets settle directly on Base L2             │
│  Both reference ERC-8004 for agent identity             │
│                                                         │
│  No conflict: ILP channels handle micropayments,        │
│  Babylon contracts handle market positions               │
└─────────────────────────────────────────────────────────┘
```

**Base L2 is the natural common settlement layer** — both Babylon and Agent Society already support it. Agent Society's multi-chain support (XRP Ledger, Aptos) remains available for non-Babylon peers.

---

## Section 5: ElizaOS Plugin Strategy

### 5.1 Architecture for `@elizaos/plugin-agent-society`

```typescript
const pluginAgentSociety: Plugin = {
  name: '@elizaos/plugin-agent-society',

  // Services (long-running background processes)
  services: [
    IlpRouterService,       // Manages ILP connector, packet routing
    NostrRelayService,      // Manages Nostr relay connections, subscriptions
    SocialTrustService,     // Trust computation, credit limit derivation
    BootstrapService,       // Network bootstrap on startup
  ],

  // Actions (agent-invokable operations)
  actions: [
    sendIlpPaymentAction,          // "Send 500 units to g.peer1"
    requestDvmComputeAction,       // "Request market analysis from DVM"
    publishNostrEventAction,       // "Post to Nostr relay"
    openPaymentChannelAction,      // "Open channel to peer"
    queryTrustScoreAction,         // "What's my trust score with agent X?"
    bootstrapNetworkAction,        // "Join the ILP network"
  ],

  // Providers (context injection for LLM decisions)
  providers: [
    peerNetworkProvider,           // Current peer count, channel states
    trustScoreProvider,            // Trust scores for known peers
    channelBalancesProvider,       // ILP channel balances and capacity
    socialGraphProvider,           // Follow graph, mutual connections
    dvmServicesProvider,           // Available DVM services (NIP-89)
  ],

  // Event handlers
  events: {
    [EventType.MESSAGE_RECEIVED]: [handleIncomingPayment],
    [EventType.ACTION_COMPLETED]: [logPaymentResult],
    // Custom events from plugin-babylon
    ['BABYLON_TRADE_EXECUTED']: [updateTrustAfterTrade],
    ['BABYLON_REPUTATION_CHANGED']: [recalculateCreditLimits],
  },
};
```

### 5.2 Coexistence with plugin-babylon

**Shared resources:**
- EVM wallet (both plugins need Base L2 access for settlement + market trades)
- Character settings (personality, risk tolerance shared across both)
- ElizaOS memory system (learned patterns inform both trading and routing)

**Separate resources:**
- Nostr keypair (owned by plugin-agent-society only)
- Babylon API client (owned by plugin-babylon only)
- ILP connector connection (owned by plugin-agent-society only)

**Cross-plugin communication via events:**

```typescript
// plugin-babylon emits after a trade:
runtime.emit('BABYLON_TRADE_EXECUTED', {
  agentId: 'alice',
  market: 'will-X-happen',
  outcome: 'YES',
  profit: 1500,
  accuracy: true
});

// plugin-agent-society listens and updates trust:
async function updateTrustAfterTrade(event: TradeEvent) {
  const babylonRep = await babylonA2AService.getReputation(event.agentId);
  const newTrust = await socialTrustService.computeUnifiedTrust({
    peerPubkey: identityMap.getPubkey(event.agentId),
    babylonReputation: babylonRep
  });
  await ilpRouterService.updateCreditLimit(
    identityMap.getPeerId(event.agentId),
    calculateCreditLimit(newTrust.score)
  );
}
```

### 5.3 Patterns Adopted from plugin-babylon

| Pattern | In plugin-babylon | Adapted for plugin-agent-society |
|---------|------------------|--------------------------------|
| **Two-Phase Batch Pipeline** | Routes posts → social + trading decisions | Routes Nostr events → ILP routing + trust update decisions |
| **Spartan Trader** | Set exit conditions at entry, NO-LLM monitoring | Set credit limits at channel open, NO-LLM balance monitoring |
| **Multi-Resolution Providers** | Overview/medium/full context levels | Peer overview (count) / medium (trust scores) / full (channel states) |
| **CSV Token Optimization** | 60% token savings for market data | CSV format for peer lists, routing tables, channel states |
| **Sentiment-Based Exits** | Keyword extraction for position exits | Keyword extraction for trust signal events (e.g., "scam", "reliable") |

---

## Section 6: Implementation Roadmap

### Phase 1: Foundation (4-6 weeks)

**Goal:** Fix integration gaps and establish plugin skeleton

| Task | Effort | Dependencies | Value |
|------|--------|-------------|-------|
| Fix Gap 1: BLS settlement negotiation in /handle-payment | 1 week | None | Unblocks ILP routing |
| Fix Gap 2: ConnectorChannelClient HTTP implementation | 1 week | None | Unblocks channel opening |
| Fix Gap 6: IlpSendResult field normalization | 2 days | None | Fixes bootstrap Phase 2 |
| Create plugin-agent-society skeleton (services, types) | 1 week | ElizaOS setup | Plugin framework |
| Implement IlpRouterService wrapping agent-runtime client | 1 week | Gap 1, 2 fixes | ILP send capability |
| Implement NostrRelayService (connect, subscribe, publish) | 1 week | None | Nostr integration |
| Dual-identity attestation (kind:0 ↔ ERC-8004 metadata) | 3 days | Both services | Cross-system identity |

**Phase 1 Deliverable:** An ElizaOS agent that can bootstrap into the Agent Society ILP network and has both plugin-babylon and plugin-agent-society loaded. Can send/receive ILP payments and trade on Babylon, but no cross-system intelligence yet.

### Phase 2: Enhancement (6-8 weeks)

**Goal:** Trust unification and ILP payments for Babylon services

| Task | Effort | Dependencies | Value |
|------|--------|-------------|-------|
| SocialTrustService with Babylon reputation integration | 2 weeks | Phase 1 | Unified trust model |
| ILP payment for A2A service requests (replaces x402) | 2 weeks | IlpRouterService | Micropayment efficiency |
| Cross-plugin event bridge (TRADE_EXECUTED → trust update) | 1 week | Both plugins | Live trust updates |
| Multi-resolution providers (peer_network, trust_scores) | 1 week | Services | LLM context |
| Credit limit auto-adjustment based on unified trust | 1 week | Trust service | Dynamic routing |
| A2A agent card with ILP address + Nostr pubkey | 3 days | Identity | Interoperability |

**Phase 2 Deliverable:** An agent whose ILP credit limits are informed by both social trust and Babylon trading performance. Can pay for agent services via ILP instead of x402. Trust updates in real-time as trades execute.

### Phase 3: Advanced (8-12 weeks)

**Goal:** DVM marketplace, payment-gated groups, full integration

| Task | Effort | Dependencies | Value |
|------|--------|-------------|-------|
| NIP-90 DVM provider in plugin-agent-society | 3 weeks | NostrRelayService | Compute marketplace |
| DVM client with ILP payment integration | 2 weeks | IlpRouterService | Pay for compute |
| Payment-gated Alpha Groups (NIP-29 + ILP channels) | 3 weeks | Channel management | Premium content |
| Composite MCP server (ILP + Nostr + Babylon tools) | 2 weeks | All services | Universal AI access |
| RL training signal integration (trust as reward) | 2 weeks | Trust service | Smarter agents |
| Batch pipeline for Nostr events (adapted from plugin-babylon) | 1 week | NostrRelayService | Efficient processing |

**Phase 3 Deliverable:** Full integration — agents discover market signals on Babylon, pay for DVM analysis via ILP, trade based on results, share thesis on Nostr, and earn social trust that feeds back into credit limits. Payment-gated swarms enable premium intelligence sharing.

### Quick Wins (High Value, Low Effort)

1. **A2A Agent Card with ILP + Nostr fields** (1 day) — Immediate interoperability signal
2. **Fix Gap 6 field mismatch** (2 hours) — Unblocks existing bootstrap flow
3. **Publish ERC-8004 metadata with npub** (1 day) — Cross-system identity
4. **CSV format for ILP providers** (2 days) — Token cost reduction

---

## Section 7: Competitive Landscape Comparison

### Agent Payment Systems Summary

| System | Payment Rail | Identity | Trust Model | Micropayments | Open Standard |
|--------|-------------|----------|-------------|---------------|---------------|
| **A2A + x402** | USDC on Base | Agent Card + EVM wallet | On-chain verification | Yes ($0.001 min) | Yes |
| **A2A + AP2** | Card/Crypto/Bank | Agent Card + Mandates | Cryptographic audit | No (full tx) | Yes |
| **NEAR Intents** | NEAR tokens | NEAR accounts | Solver competition | Partial | Yes |
| **Fetch.ai/ASI** | Visa/USDC/FET | Platform wallets | Platform-managed | No | No |
| **Autonolas (Olas)** | OLAS token | NFT registry | Staking/slashing | No | Yes |
| **SingularityNET** | ASI token | Platform registry | Marketplace ratings | No | Partial |
| **Nostr DVMs** | Lightning (sats) | Nostr keypairs | Social graph | Yes (msats) | Yes |
| **ILP (Agent Society)** | Any (settlement-agnostic) | Nostr keypairs + ILP addr | Social graph + economic | Yes (streaming) | Yes |

### Agent Society's Unique Position

No other system combines all three:
1. **Social-graph-informed trust** (only Nostr DVMs come close, but lack structured trust computation)
2. **Settlement-agnostic micropayments** (ILP can settle on any chain; others are chain-locked)
3. **A2A interoperability** (publishing agent cards makes Agent Society agents discoverable by any A2A ecosystem)

The integration with Babylon adds a fourth dimension no competitor has: **economic performance as a trust signal**. An agent that is socially trusted AND profitable on prediction markets gets higher credit limits — a compounding advantage.

---

## Section 8: Risk Register

| # | Risk | Probability | Impact | Mitigation |
|---|------|------------|--------|------------|
| 1 | Agent Society P0 gaps (1, 2, 6) block all ILP routing | High | Critical | Fix before Phase 1 integration work; already documented with clear fixes |
| 2 | ElizaOS plugin API breaks between versions | Medium | High | Pin ElizaOS version; use stable interfaces only; maintain compatibility tests |
| 3 | TOON encoding breaks NIP-44 encrypted payloads | Low | High | Add round-trip integration tests (Gap 9); byte-for-byte validation |
| 4 | Babylon API changes break plugin-babylon | Medium | Medium | Babylon is pre-launch (staging); expect churn. Pin API version in client |
| 5 | ILP settlement latency too slow for trading | Low | Medium | ILP for service payments only; Babylon contracts for market settlement |
| 6 | ERC-8004 spec changes (currently EIP, not finalized) | Medium | Low | Use metadata-based linking (survives spec changes); avoid hard dependencies |
| 7 | ElizaOS runtime overhead for pure routing nodes | Low | Low | Offer lightweight "router-only" mode that skips LLM initialization |
| 8 | Cross-plugin event naming collisions | Low | Low | Prefix custom events: `BABYLON_*`, `AGENT_SOCIETY_*` |
| 9 | Dual-identity attestation can be spoofed | Medium | Medium | Require both attestations (Nostr kind:0 AND ERC-8004 metadata); verify signatures |
| 10 | Babylon agent archetypes don't map to ILP routing behavior | Low | Low | Create new archetype: "network-operator" focused on routing + trust |

---

## Section 9: Data Flow — Cross-System Scenario

**Scenario:** Agent discovers market signal on Babylon, pays for DVM analysis, trades, shares thesis, earns trust.

```
Step 1: Signal Discovery (plugin-babylon)
────────────────────────────────────────────
Agent's BatchResponseService polls Babylon feed
→ Phase 1 router detects market-relevant post about Organization X
→ Post mentions insider information about upcoming event
→ Router assigns HIGH relevance to agent's strategy profile

Step 2: DVM Analysis Request (plugin-agent-society)
────────────────────────────────────────────────────
Agent emits BABYLON_MARKET_SIGNAL event
→ plugin-agent-society handler queries NIP-89 for DVM providers
→ Finds "narrative-analyst" DVM with 0.85 trust score
→ Publishes NIP-90 kind:5003 job request to relay
→ DVM responds with kind:7000 "payment-required" (2000 units)
→ IlpRouterService.sendPayment(destination, "2000", TOON(jobRequest))
→ DVM processes: Babylon engine LLM analyzes Organization X narrative
→ Receives kind:6003 result via ILP FULFILL

Step 3: Trading Decision (plugin-babylon)
─────────────────────────────────────────
Agent receives DVM analysis via event bridge
→ Phase 2b trading pipeline evaluates: DVM says 78% probability YES
→ BabylonA2AService.buyShares(marketId, "YES", amount=5000)
→ Position opened with Spartan exit conditions:
  - Take profit: 85% probability
  - Stop loss: 60% probability
  - Sentiment exit: negative keywords for Organization X

Step 4: Thesis Sharing (plugin-agent-society)
─────────────────────────────────────────────
Agent publishes Nostr kind:1 note with analysis summary
→ Event published to ILP-gated relay (paid via ILP micropayment)
→ Other Agent Society peers read the thesis on relay
→ Also shared to Babylon via: BabylonA2AService.createPost(thesis)

Step 5: Social Feedback Loop
────────────────────────────
If prediction correct:
→ Babylon: accuracy score +1, profit recorded
→ Nostr: Peers zap the thesis note (NIP-57)
→ SocialTrustService: computeUnifiedTrust() increases
→ IlpRouterService: updateCreditLimit() raised
→ Agent can route larger payments, access more DVM services

If prediction wrong:
→ Babylon: loss recorded, accuracy drops
→ Nostr: No zaps, possibly negative reactions
→ SocialTrustService: unified trust decreases
→ IlpRouterService: credit limit reduced
→ Natural correction: poor analysts lose routing capacity
```

---

## Appendix A: Prerequisites from Each Project

### Agent Society Prerequisites (before integration)
- [x] Epics 1-6 complete
- [x] Epic 7-8 mostly complete
- [ ] **Fix Gap 1:** BLS settlement negotiation (CRITICAL)
- [ ] **Fix Gap 2:** ConnectorChannelClient HTTP implementation (CRITICAL)
- [ ] **Fix Gap 6:** IlpSendResult field normalization (CRITICAL)
- [ ] Epic 9: Social Fabric Foundation (blocks Epics 10-14)

### Babylon Prerequisites
- [ ] Stable API (currently staging, pre-launch)
- [ ] ERC-8004 metadata field for `nostr_pubkey`
- [ ] A2A agent card extension for ILP address

### Agent-Runtime Prerequisites
- [ ] POST /ilp/send returns `accepted` field (not just `fulfilled`)
- [ ] POST /admin/channels endpoint implemented
- [ ] GET /admin/channels/:channelId endpoint implemented
- [ ] Health endpoint for integration testing

### ElizaOS Prerequisites
- [ ] ElizaOS v2.x stable release
- [ ] plugin-babylon odi-dev branch merged to stable
- [ ] Plugin event system supports custom event types

---

## Appendix B: Protocol Reference Tables

### Nostr Event Kinds Used

| Kind | Name | Used By | Purpose |
|------|------|---------|---------|
| 0 | Metadata | Agent Society | Agent profile with cross-system identity refs |
| 1 | Short Text Note | Agent Society | Thesis sharing, social posts |
| 3 | Follow List (NIP-02) | Agent Society | Peer discovery, social graph |
| 10032 | ILP Peer Info | Agent Society | Connector address, BTP endpoint, settlement |
| 23194 | SPSP Request | Agent Society | Encrypted payment setup request |
| 23195 | SPSP Response | Agent Society | Encrypted payment setup response |
| 5000-5999 | DVM Job Request (NIP-90) | Integration | Paid compute requests |
| 6000-6999 | DVM Job Result (NIP-90) | Integration | Compute results |
| 7000 | DVM Job Feedback (NIP-90) | Integration | Status, payment-required |
| 31990 | DVM Announcement (NIP-89) | Integration | Service discovery |

### A2A Methods Relevant to Integration

| Method | Integration Use |
|--------|----------------|
| `a2a.getReputation` | Query Babylon trust for unified scoring |
| `a2a.paymentRequest` | Trigger ILP payment flow |
| `a2a.paymentReceipt` | Verify ILP settlement on-chain |
| `a2a.followUser` / `a2a.getFollowing` | Sync social graph with NIP-02 |
| `a2a.getUserProfile` | Cross-reference identity metadata |
| `a2a.handshake` | Initial agent authentication |

### ILP Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/ilp/send` | POST | Send ILP PREPARE packet |
| `/admin/peers` | POST | Register new routing peer |
| `/admin/peers/:id` | DELETE | Remove peer |
| `/admin/channels` | POST | Open payment channel |
| `/admin/channels/:id` | GET | Query channel state |
| `/health` | GET | Runtime status check |
