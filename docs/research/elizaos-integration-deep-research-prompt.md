# Deep Research Prompt: ElizaOS Plugin Integration with Agent Society Protocol

## Research Objective

Investigate and recommend the optimal technical architecture for building an **ElizaOS plugin** (`@elizaos/plugin-agent-society` or `@agent-society/elizaos-plugin`) that wraps the **Agent Society protocol** — enabling any ElizaOS-powered AI agent to participate in Nostr-based ILP payment networks with social-graph-driven peer discovery, trust derivation, and micropayment routing.

The research must produce:
1. A detailed plugin architecture mapping Agent Society's capabilities to ElizaOS's component model (Actions, Providers, Services, Evaluators, Events, Routes)
2. A concrete implementation plan showing how ElizaOS agents gain Nostr identity, discover ILP peers, negotiate SPSP handshakes, compute trust scores, and route payments — all through natural agent conversation and autonomous decision-making
3. Analysis of how Agent Society's 5-phase bootstrap process maps to ElizaOS's agent lifecycle
4. Recommendations for agent Character configuration patterns that leverage social trust for payment decisions
5. A prioritized implementation roadmap with clear milestones

The goal is to make the Interledger Protocol accessible to any ElizaOS agent through the Agent Society bridge — an agent says "pay Alice 5 USD" and the plugin handles peer discovery, SPSP negotiation, trust verification, and ILP packet routing automatically.

## Background Context

### Project 1: Agent Society Protocol

**Repository:** https://github.com/ALLiDoizCode/agent-society
**Nature:** TypeScript monorepo library bridging Nostr and Interledger Protocol (ILP)

**Core Architecture:**
- Monorepo (pnpm workspace): `packages/core` (protocol library), `packages/bls` (Business Logic Server), `packages/relay` (ILP-gated Nostr relay), `packages/examples`, `packages/ui-prototypes`
- Built on `nostr-tools 2.20.0`, `better-sqlite3`, `hono 4.x`, `@toon-format/toon`
- Node.js 20+, TypeScript, ESM output via `tsup`

**Key Subsystems:**

1. **Peer Discovery** (`NostrPeerDiscovery`) — Queries NIP-02 kind:3 follow lists to discover ILP peers, then fetches kind:10032 (ILP Peer Info) events for each followed pubkey. Returns `Map<string, IlpPeerInfo>` with ILP addresses, BTP endpoints, settlement chains, and token preferences. Supports real-time subscription to peer updates. Additional sources: `GenesisPeerLoader` (bootstrap JSON), `ArDrivePeerRegistry` (Arweave permanent registry).

2. **SPSP Client/Server** (`NostrSpspClient` / `NostrSpspServer`) — Encrypted request/response over Nostr (kind:23194 request, kind:23195 response, NIP-44 encryption). Client sends SPSP request with settlement preferences, waits for response with `destinationAccount`, `sharedSecret`, and negotiated settlement details. Server handles incoming requests, generates fresh SPSP params, performs settlement chain negotiation, and opens payment channels via `ConnectorChannelClient`.

3. **Social Trust Manager** (`SocialTrustManager`) — Computes trust scores (0-1) from social graph analysis: BFS social distance (weight 0.5), mutual follower count (weight 0.3), reputation placeholder (weight 0.2, future NIP-57 zaps). Maps trust scores to credit limits via configurable linear/exponential curves. Default max social distance: 3 hops.

4. **Bootstrap Service** (`BootstrapService`) — 5-phase state machine for network initialization:
   - Phase 1: `discovering` → Load peers from genesis/ArDrive/environment
   - Phase 2: `registering` → Query kind:10032 & register peers with ILP connector
   - Phase 3: `handshaking` → SPSP via ILP packets for settlement negotiation
   - Phase 4: `announcing` → Publish own kind:10032 as paid ILP PREPARE
   - Phase 5: `ready` → Signal bootstrap complete
   Emits typed events: `bootstrap:phase`, `bootstrap:peer-registered`, `bootstrap:channel-opened`, `bootstrap:handshake-failed`, `bootstrap:announced`, `bootstrap:ready`.

5. **ILP-Gated Relay** (`NostrRelayServer` + `BusinessLogicServer`) — Pay-to-write Nostr relay. Events encoded to TOON format, sent as ILP PREPARE packet data. BLS verifies payment amount against pricing service, stores event, returns fulfillment (SHA256 of eventId). Free reads via standard NIP-01 WebSocket queries.

6. **Event System** — Three custom Nostr event kinds:
   - `kind:10032` (ILP Peer Info) — Replaceable event with ILP address, BTP endpoint, supported chains, settlement addresses, preferred tokens
   - `kind:23194` (SPSP Request) — NIP-44 encrypted request for fresh SPSP parameters
   - `kind:23195` (SPSP Response) — NIP-44 encrypted response with SPSP data + settlement negotiation result

**Key TypeScript Interfaces:**

```typescript
interface IlpPeerInfo {
  ilpAddress: string;           // e.g., "g.agent.alice"
  btpEndpoint: string;          // WebSocket URL
  assetCode: string;            // e.g., "USD"
  assetScale: number;           // Decimal places
  supportedChains: string[];    // e.g., ["evm:base:8453", "xrp:mainnet"]
  settlementAddresses: Record<string, string>;
  preferredTokens: Record<string, string>;
  tokenNetworks: Record<string, string>;
}

interface TrustScore {
  score: number;                // 0-1 normalized
  socialDistance: number;        // Hops in follow graph
  mutualFollowerCount: number;
  breakdown: { socialDistanceScore, mutualFollowersScore, reputationScore };
}

interface SpspInfo {
  destinationAccount: string;   // ILP address to send to
  sharedSecret: string;         // Base64-encoded STREAM secret
}

// Client interfaces for connector integration
interface ConnectorAdminClient { addPeer(config): Promise<void>; removePeer(peerId): Promise<void>; }
interface AgentRuntimeClient { sendIlpPrepare(prepare): Promise<IlpReply>; }
interface ConnectorChannelClient { openChannel(params): Promise<OpenChannelResult>; getChannelState(channelId): Promise<ChannelState>; }
```

**Known Integration Gaps (as of Feb 2026):**
- `ConnectorChannelClient` implementation incomplete
- BLS `/handle-payment` doesn't wire settlement negotiation end-to-end
- `NostrSpspServer` not fully configured with settlement params in entrypoint
- Overall 60-75% complete on settlement/ILP flow

---

### Project 2: ElizaOS Agent Framework

**Documentation:** https://docs.elizaos.ai/
**Source Documentation:** https://docs.elizaos.ai/llms-full.txt
**Nature:** Framework for building autonomous AI agents with configurable personalities, persistent memory, and extensible capabilities

**Core Architecture:**

1. **Characters vs Agents** — Characters are static configuration blueprints (personality, capabilities, plugins). Agents are live runtime instances with status tracking, lifecycle management, and persistent state.

2. **Plugin System** — Self-contained modules contributing components to the runtime:
   - **Actions** — Executable tasks triggered by agent decisions. Validate applicability, handle execution with streaming callbacks, report results. Have names, descriptions, and similes for LLM selection.
   - **Providers** — Data contributors to agent state composition. Run in parallel during state assembly, merge results into context. Inform decision-making without blocking.
   - **Services** — Long-running background processes. Lifecycle methods (start/stop), handle reconnection, coordinate through runtime.
   - **Evaluators** — Post-processing assessment of message exchanges. Run after action execution, store evaluation results.
   - **Events** — Plugin-defined custom events for inter-component communication.
   - **Routes** — REST/WebSocket endpoints for external system interaction.
   - **Model Handlers** — LLM call implementations with fallback support.

3. **Memory System** — Unified with embeddings:
   - Creation: Messages generate vector embeddings for semantic search
   - Retrieval: Recency-based, semantic search (vector similarity), keyword filtering
   - Composition: State assembly pulls recent memories and provider data into context window
   - Types: Short-term (conversation), long-term (marked facts), knowledge (static/learned)

4. **Message Processing Pipeline:**
   1. Pre-processing → Plugin hooks validate/modify incoming messages
   2. State composition → Providers gather contextual data
   3. Action selection → LLM chooses applicable action from registered set
   4. Execution → Selected action runs with streaming callback support
   5. Evaluation → Registered evaluators assess outcomes
   6. Storage → Memories persist with embeddings

5. **Key Interfaces:**
```typescript
interface Plugin {
  name: string;
  dependencies?: string[];
  priority?: number;
  init?: (config: any, runtime: IAgentRuntime) => Promise<void>;
  actions?: Action[];
  providers?: Provider[];
  services?: typeof Service[];
  evaluators?: Evaluator[];
}

interface IAgentRuntime {
  // Memory operations
  createMemory(memory: Memory): Promise<void>;
  getMemories(options: MemoryQuery): Promise<Memory[]>;
  searchMemories(query: string): Promise<Memory[]>;
  // State composition
  composeState(message: Memory): Promise<State>;
  // Component registration
  registerAction(action: Action): void;
  registerProvider(provider: Provider): void;
  registerService(service: Service): void;
}
```

6. **Multi-Agent Support** — Hierarchical parent-child delegation, shared memory spaces via roomId/worldId grouping, inter-agent message routing.

---

### Project 3: Existing ElizaOS Plugin Patterns (Reference)

**plugin-babylon** (https://github.com/elizaos-plugins/plugin-babylon/) — ElizaOS plugin for Babylon prediction markets. Demonstrates:
- 14 actions for trading, social posting, market analysis
- 14+ providers for multi-resolution data reads
- 2 services for background monitoring
- Two operating modes: Player (conversational) and Autonomous (independent)
- Batch processing pipeline with shared LLM routing
- Spartan Trader pattern: LLM sets exit conditions at entry, monitoring is deterministic

This plugin serves as a reference architecture for complex ElizaOS integrations.

---

## Research Questions

### Primary Questions (Must Answer)

1. **Plugin Architecture Design**: What is the optimal mapping of Agent Society's capabilities to ElizaOS plugin components? Specifically:
   - Which Agent Society operations become **Actions** (user/agent-triggered) vs **Services** (background processes)?
   - What **Providers** should surface trust scores, peer status, payment channel state, and balance information into agent context?
   - How should **Evaluators** assess payment outcomes and trust evolution over time?
   - What **Routes** should expose for external ILP connector integration and webhook callbacks?
   - What custom **Events** enable inter-agent payment coordination?

2. **Bootstrap Lifecycle Integration**: How should Agent Society's 5-phase BootstrapService map to ElizaOS's agent lifecycle? Should bootstrap run as:
   - A Service that starts when the agent initializes?
   - An Action that the agent can trigger conversationally ("bootstrap my ILP network")?
   - An automatic background process tied to agent startup?
   - What happens when bootstrap fails or stalls at a phase? How does the agent communicate this?

3. **Nostr Identity Management**: How should ElizaOS agents acquire and manage Nostr keypairs?
   - Should each agent have its own Nostr identity (keypair)?
   - How are keypairs stored securely (Character secrets, environment variables, key management service)?
   - How does the agent's Nostr identity relate to its ElizaOS identity?
   - Can multiple agents share a Nostr identity, or is 1:1 mapping required?

4. **Payment Action Design**: How should the "pay" action work end-to-end?
   - What's the conversation flow? ("Pay Alice 5 USD" → discovery → SPSP → trust check → route → confirm)
   - How does the agent resolve "Alice" to a Nostr pubkey? (Memory lookup, Nostr NIP-05 resolution, direct pubkey input?)
   - What trust thresholds trigger confirmation prompts vs automatic execution?
   - How are payment results reported back to the conversation?

5. **Trust-Informed Decision Making**: How should social trust scores influence agent behavior?
   - Should trust scores be a Provider that enriches every conversation about a peer?
   - How do agents reason about trust when deciding to accept payments, extend credit, or route through intermediaries?
   - Can trust scores feed into ElizaOS's memory system for long-term relationship tracking?
   - How do agents handle untrusted peers (social distance > 3)?

6. **State and Memory Integration**: How should payment history, peer relationships, and trust data persist?
   - What ElizaOS Memory types should store payment records, peer info, trust snapshots?
   - How should semantic search over payment history work? ("Show me payments to Alice in January")
   - Should trust scores be computed on-demand or cached in memory?
   - How does the agent's knowledge of its ILP network evolve over its lifetime?

### Secondary Questions (Nice to Have)

7. **Multi-Agent Payment Routing**: How can multiple ElizaOS agents form an ILP payment mesh?
   - Can agents within the same ElizaOS instance route payments to each other?
   - How do agents discover other ElizaOS agents on the Nostr network?
   - What's the model for agent-to-agent payment negotiation?

8. **ILP-Gated Relay as Agent Infrastructure**: Can ElizaOS agents use the Agent Society relay for persistent communication?
   - Should agents pay to write to the relay as part of normal operation?
   - Can the relay serve as an agent's "public memory" or "bulletin board"?
   - How does the pay-per-write model interact with agent economy?

9. **Autonomous Mode Patterns**: What autonomous behaviors should the plugin support?
   - Periodic trust recalculation and peer list maintenance
   - Automatic settlement channel management (open/close based on activity)
   - Proactive payment routing optimization
   - Social graph exploration for new peer discovery

10. **Error Handling and Recovery**: How should the plugin handle failure modes?
    - Relay connectivity issues (reconnection, relay failover)
    - SPSP handshake timeouts (retry with different relays, escalate to user)
    - Trust score disputes (mutual trust asymmetry)
    - ILP packet routing failures (alternate path discovery)
    - Bootstrap phase failures (partial restart, manual intervention)

11. **Character Configuration Patterns**: What Character templates enable effective ILP agents?
    - What personality traits help agents make good payment decisions?
    - What knowledge bases should ILP-enabled agents include?
    - What system prompts guide trust-aware behavior?
    - Are there archetypes? (conservative payer, generous router, trust maximizer)

12. **Performance and Scalability**: What are the resource implications?
    - Nostr relay connection pooling across agents
    - Trust score computation cost at scale (many peers)
    - Memory usage for payment history
    - Concurrent SPSP handshake limits

## Research Methodology

### Information Sources

**Primary Sources (Highest Priority):**
- ElizaOS official documentation: https://docs.elizaos.ai/
- ElizaOS full documentation for LLMs: https://docs.elizaos.ai/llms-full.txt
- ElizaOS GitHub repository: https://github.com/elizaOS/eliza
- Agent Society source code (provided in context above)
- Existing ElizaOS plugins (plugin-babylon as reference architecture)

**Secondary Sources:**
- Nostr protocol NIPs repository: https://github.com/nostr-protocol/nips
- Interledger Protocol specifications: https://interledger.org/developers/rfcs/
- ElizaOS plugin development guides and examples
- ElizaOS community plugins registry
- SPSP specification: RFC-0009

**Tertiary Sources:**
- Agent-to-agent payment protocol research
- Autonomous agent economy design patterns
- Social graph-based trust systems in distributed networks
- Existing Nostr+payments integrations (NIP-57 zaps, Nostr Wallet Connect NIP-47)

### Analysis Frameworks

1. **Component Mapping Matrix** — Map every Agent Society class/function to an ElizaOS plugin component type with rationale
2. **Lifecycle Alignment** — Side-by-side comparison of Agent Society bootstrap phases and ElizaOS agent lifecycle stages
3. **Data Flow Diagrams** — Trace complete flows: discovery, payment, trust computation, settlement
4. **Interface Adapter Pattern Analysis** — Identify where Agent Society interfaces need wrapping for ElizaOS compatibility
5. **Failure Mode Analysis** — Enumerate failure scenarios and recovery strategies for each integration point

### Data Requirements

- Complete ElizaOS plugin API surface (all interfaces, types, lifecycle hooks)
- Existing ElizaOS plugin examples demonstrating Services, Actions, Providers patterns
- Agent Society public API surface (all exported classes, interfaces, functions)
- Nostr event kind specifications for all custom events (10032, 23194, 23195)
- ILP connector Admin API specification

## Expected Deliverables

### Executive Summary
- Key findings on architectural fit between Agent Society and ElizaOS
- Critical integration challenges and recommended solutions
- Top 3 highest-value capabilities the plugin would unlock
- Recommended implementation approach (iterative phases)

### Detailed Analysis

#### 1. Plugin Architecture Specification
- Complete component inventory (Actions, Providers, Services, Evaluators, Events, Routes)
- For each component: name, description, inputs/outputs, Agent Society classes used, ElizaOS interfaces implemented
- Dependency graph between components
- Configuration schema (Character settings, environment variables, secrets)

#### 2. Integration Architecture
- Data flow diagrams for key user stories:
  - Agent bootstrap into ILP network
  - Agent discovers and evaluates a new peer
  - Agent sends a payment
  - Agent receives a payment request
  - Agent updates trust based on payment outcome
- Sequence diagrams for SPSP negotiation through ElizaOS pipeline
- State management design (what lives in ElizaOS memory vs Agent Society state)

#### 3. Implementation Roadmap
- Phase 1: Core infrastructure (Service + identity + bootstrap)
- Phase 2: Basic operations (peer discovery Provider + trust Provider + pay Action)
- Phase 3: Full SPSP flow (SPSP Actions + settlement negotiation)
- Phase 4: Autonomous behaviors (Evaluators + background trust + channel management)
- Phase 5: Multi-agent mesh (inter-agent routing + shared relay)
- Estimated complexity per phase (S/M/L)
- Dependencies between phases

#### 4. Character Configuration Guide
- Template Character configs for ILP-enabled agents
- Required plugins, settings, and secrets
- Example knowledge bases for payment-aware agents
- Personality trait recommendations for different agent archetypes

#### 5. Risk Assessment
- Technical risks (API compatibility, performance, reliability)
- Architectural risks (tight coupling, version drift, breaking changes)
- Operational risks (key management, relay dependency, settlement failures)
- Mitigation strategies for each identified risk

### Supporting Materials
- Component mapping matrix (Agent Society → ElizaOS)
- Interface adapter specifications
- Configuration reference table
- Error code mapping (Agent Society errors → ElizaOS error handling)
- Glossary of cross-project terminology

## Success Criteria

1. **Architectural Clarity**: A reader should understand exactly which ElizaOS components to build and how they interact with Agent Society classes
2. **Implementation Readiness**: The roadmap should be detailed enough that a developer could start coding Phase 1 immediately
3. **Complete Coverage**: Every Agent Society capability should have a clear path to ElizaOS integration (even if deferred to later phases)
4. **Practical Examples**: Include concrete code sketches or pseudocode for at least the core Action (pay), Service (bootstrap), and Provider (trust score)
5. **Risk Awareness**: All significant integration challenges are identified with mitigation strategies

## Timeline and Priority

**Highest Priority:**
- Plugin architecture specification (Actions, Services, Providers mapping)
- Bootstrap lifecycle integration design
- Payment action end-to-end flow

**Medium Priority:**
- Trust-informed decision making patterns
- Memory and state management design
- Character configuration templates

**Lower Priority (but important for completeness):**
- Multi-agent mesh networking
- Autonomous behavior patterns
- Performance and scalability analysis

## Notes

- Agent Society is at 60-75% completion on settlement/ILP flow — the research should account for both current capabilities and planned completion
- The plugin should be designed to work with Agent Society's existing API surface without requiring changes to the core protocol library
- ElizaOS plugin-babylon serves as the strongest reference architecture for a complex integration plugin
- Consider that agents may operate in both conversational mode (human-directed payments) and autonomous mode (self-directed peer management and routing)
- The Nostr identity layer is critical — it's the bridge between ElizaOS agent identity and the Agent Society network identity
