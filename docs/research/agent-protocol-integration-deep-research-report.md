# Agent Protocol Integration: Deep Research Report

**Date:** 2026-02-10
**Scope:** Google A2A, x402, ERC-8004, Competitive Landscape, MCP Composition, NIP-90 DVMs
**Relevance:** Informing the Crosstown Protocol's architecture decisions for ILP-Nostr bridge integration

---

## Table of Contents

1. [Google A2A Protocol](#1-google-a2a-protocol)
2. [X402 Payment Protocol](#2-x402-payment-protocol)
3. [ERC-8004 Agent Identity](#3-erc-8004-agent-identity)
4. [Competitive Landscape - Agent Payment Systems](#4-competitive-landscape---agent-payment-systems)
5. [Model Context Protocol (MCP) Composition](#5-model-context-protocol-mcp-composition)
6. [NIP-90 Data Vending Machines](#6-nip-90-data-vending-machines)
7. [Synthesis: Implications for Crosstown Protocol](#7-synthesis-implications-for-crosstown-protocol)

---

## 1. Google A2A Protocol

### Overview

Agent2Agent (A2A) is an open protocol released by Google in April 2025, enabling communication and interoperability between opaque agentic applications. It is built on existing web standards: HTTP, SSE, and JSON-RPC 2.0. As of version 0.3 (July 2025), it also supports gRPC. Over 150 organizations support the protocol.

### Agent Cards (Discovery)

Every A2A-compliant agent publishes a JSON metadata document at `/.well-known/agent.json` (RFC 8615). The Agent Card declares:

- **Identity**: Provider info, display name, version
- **Capabilities**: Boolean flags for streaming, push notifications, extended cards
- **Security Schemes**: API keys, HTTP auth, OAuth2, OpenID Connect, mTLS
- **Skills**: Discrete agent functionalities with input/output mode specifications
- **Extensions**: Custom functionality declarations with versioning
- **Interfaces**: Protocol binding declarations (JSON-RPC, gRPC, HTTP/REST)
- **Signature**: Cryptographic verification via agent's private key

An authenticated variant (`GetExtendedAgentCard`) provides additional metadata to credentialed clients.

### JSON-RPC 2.0 Message Format

All A2A communication occurs over HTTP(S) using JSON-RPC 2.0 payloads. Core methods:

| Method | Purpose |
|--------|---------|
| `SendMessage` | Initiate interaction, get immediate or task-based response |
| `SendStreamingMessage` | Real-time event streaming during processing |
| `GetTask` | Retrieve task state, artifacts, optional history |
| `ListTasks` | Discover tasks with filtering and pagination |
| `CancelTask` | Request task cancellation (idempotent) |
| `SubscribeToTask` | Persistent streaming for existing tasks |
| `GetExtendedAgentCard` | Authenticated agent metadata |
| Push Notification CRUD | Create/Get/List/Delete webhook configs |

### Task-Based Communication Model

The **Task** is the fundamental unit of work. Tasks are stateful and progress through a defined lifecycle:

```
submitted -> working -> input-required -> completed
                    \-> failed
                    \-> canceled
                    \-> rejected
```

Terminal states (`completed`, `failed`, `canceled`, `rejected`) prevent further message acceptance.

**Messages** encapsulate conversational turns with a role (`user` or `agent`) and contain **Parts** (text, file references, structured data, or embedded UI). **Artifacts** are agent-generated outputs composed of multiple parts.

### Transport Mechanisms

Three complementary delivery patterns:

1. **Polling**: Clients periodically invoke `GetTask` for status -- simple but higher latency
2. **Streaming**: Real-time via SSE with `SendStreamingMessage` or `SubscribeToTask`
3. **Push Notifications**: Server-initiated HTTP POST to registered webhooks for long-running tasks

### Payment Handling (A2A x402 Extension)

Google, in collaboration with Coinbase, Ethereum Foundation, MetaMask, and others, released the **A2A x402 extension** -- a production-ready solution for agent-based crypto payments. When a request lacks a valid payment transaction in the HTTP header, middleware responds with HTTP 402, including payment metadata (token address, receiver address, network, amount). The client prepares an EIP-3009 compliant signed payment transaction embedded in the `X-PAYMENT` header as base64.

Additionally, Google announced **AP2 (Agent Payments Protocol)** in late 2025 -- an open protocol for secure agent-led payments with 60+ partners (Mastercard, PayPal, Coinbase, Adyen). AP2 introduces **Mandates**: cryptographically signed digital contracts capturing user authorization:

- **Cart Mandate**: Explicit user approval for specific items/prices (human-present)
- **Intent Mandate**: Pre-approved conditions for autonomous agent action (human-not-present)
- **Payment Mandate**: Signals AI agent involvement to payment networks

### Security Model

- TLS certificate validation required
- Client authentication per Agent Card-declared schemes
- Authorization scoping (servers must not leak existence information)
- In-task secondary credentials for sensitive operations

### Sources

- [A2A Protocol Specification](https://a2a-protocol.org/latest/specification/)
- [Google Developers Blog: A2A Announcement](https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/)
- [A2A x402 Extension (GitHub)](https://github.com/google-agentic-commerce/a2a-x402)
- [AP2 Protocol Documentation](https://ap2-protocol.org/)
- [Google Cloud: Announcing AP2](https://cloud.google.com/blog/products/ai-machine-learning/announcing-agents-to-payments-ap2-protocol)

---

## 2. X402 Payment Protocol

### Overview

x402 is an open payment protocol developed by Coinbase (released May 2025) that enables instant, automatic stablecoin payments directly over HTTP by reviving the HTTP 402 "Payment Required" status code. The x402 Foundation was established in September 2025 by Coinbase and Cloudflare. As of early 2026, it has processed over 140 million transactions from 406,700 buyers and 81,000 sellers.

### Protocol Flow

```
1. Client -> Server:     HTTP request to protected resource
2. Server -> Client:     402 Payment Required + PAYMENT-REQUIRED header
                         (base64-encoded PaymentRequirements JSON)
3. Client -> Server:     Retry with PAYMENT-SIGNATURE header
                         (base64-encoded PaymentPayload)
4. Server -> Facilitator: POST /verify (optional), POST /settle
5. Server -> Client:     200 OK + PAYMENT-RESPONSE header
                         (base64-encoded SettlementResponse)
```

### Message Format

**PaymentRequirements** (returned in `PAYMENT-REQUIRED` header):
- Scheme identifier (e.g., `exact-evm`)
- Network/chain specification
- Token address (e.g., USDC contract)
- Receiver address
- Amount (supports micropayments as low as $0.001)
- Facilitator URL
- Additional parameters per scheme

**PaymentPayload** (sent in `PAYMENT-SIGNATURE` header):
- Signed transaction data (EIP-3009 for EVM chains)
- Scheme-specific authorization proof
- Network identifier

**SettlementResponse** (returned in `PAYMENT-RESPONSE` header):
- Transaction hash
- Settlement status
- Network confirmation details

### Facilitator Architecture

The **facilitator** is a server that handles verification and settlement so sellers don't need blockchain infrastructure:

- `POST /verify` -- Validates PaymentPayload against PaymentRequirements
- `POST /settle` -- Executes on-chain settlement
- Coinbase hosts a facilitator with a free tier of 1,000 tx/month
- Third parties can run their own facilitators

### V2 Upgrades (January 2026)

- Wallet-based identity support
- Automatic API discovery
- Dynamic payment recipients
- Multi-chain and fiat support via CAIP standards
- Modular SDK for custom networks and payment schemes

### Comparison with ILP Micropayments

| Dimension | x402 | ILP |
|-----------|------|-----|
| **Architecture** | HTTP-native (402 status code + headers) | Packet-routing across payment networks |
| **Micropayment floor** | ~$0.001 per request | Sub-cent streaming payments |
| **Settlement** | On-chain stablecoin (USDC on Base/Solana) | Settlement engine agnostic (any ledger) |
| **Transport** | HTTP request/response cycle | BTP (Bilateral Transfer Protocol) |
| **Identity** | Wallet addresses | ILP addresses (e.g., `g.node.alice`) |
| **Intermediaries** | Facilitator server | Connectors route packets |
| **Agent focus** | Purpose-built for AI agents | General-purpose, not agent-specific |
| **Adoption** | 140M+ tx, growing rapidly | Smaller ecosystem, W3C Web Monetization attempt stalled |
| **Currency** | Stablecoins (USDC) | Any currency via connectors |
| **Trust model** | On-chain verification | Bilateral trust between peers |

**Key insight**: x402 is HTTP-native and optimized for the AI agent use case. ILP is more general and protocol-agnostic but lacks the HTTP-native integration and agent-specific tooling. However, ILP's settlement-engine architecture could theoretically settle via stablecoins just as x402 does, and ILP's social-graph-informed routing (as proposed by Crosstown) has no equivalent in x402.

### Sources

- [x402 Official Site](https://www.x402.org/)
- [Coinbase x402 Documentation](https://docs.cdp.coinbase.com/x402/welcome)
- [x402 GitHub](https://github.com/coinbase/x402)
- [x402 V2 Launch Announcement](https://www.x402.org/writing/x402-v2-launch)
- [x402 Whitepaper (PDF)](https://www.x402.org/x402-whitepaper.pdf)
- [InfoQ: x402 Major Upgrade](https://www.infoq.com/news/2026/01/x402-agentic-http-payments/)

---

## 3. ERC-8004 Agent Identity

### Overview

ERC-8004 ("Trustless Agents") is an Ethereum Improvement Proposal that establishes three lightweight on-chain registries for agent Identity, Reputation, and Validation. Created August 13, 2025, and co-authored by representatives from MetaMask, Ethereum Foundation, Google, and Coinbase. It went live on Ethereum mainnet on January 29, 2026.

The standard extends Google's A2A protocol with a blockchain-based trust layer, enabling agents to discover, choose, and interact across organizational boundaries without pre-existing trust.

### Three Core Registries

#### Identity Registry

Based on ERC-721 with URIStorage extension. Each agent is an NFT with:

```solidity
struct MetadataEntry {
    string metadataKey;
    bytes metadataValue;
}

function register(string agentURI, MetadataEntry[] calldata metadata) external returns (uint256 agentId);
function setAgentURI(uint256 agentId, string calldata newURI) external;
function setMetadata(uint256 agentId, string memory metadataKey, bytes metadataValue) external;
function getMetadata(uint256 agentId, string memory metadataKey) external view returns (bytes memory);
function setAgentWallet(uint256 agentId, address newWallet, uint256 deadline, bytes calldata signature) external;
function getAgentWallet(uint256 agentId) external view returns (address);
```

Key properties:
- Agent ID is a globally unique, tokenized entry (ERC-721)
- Token URI points to an off-chain agent registration file (JSON) -- can include A2A or MCP endpoints
- Agent wallet can be set separately from owner address
- Metadata is key-value with arbitrary bytes values
- CAIP-10 aligned for cross-chain references

#### Reputation Registry

```solidity
function giveFeedback(uint256 agentId, int128 value, uint8 valueDecimals,
    string calldata tag1, string calldata tag2, string calldata endpoint,
    string calldata feedbackURI, bytes32 feedbackHash) external;
function revokeFeedback(uint256 agentId, uint64 feedbackIndex) external;
function appendResponse(uint256 agentId, address clientAddress, uint64 feedbackIndex,
    string calldata responseURI, bytes32 responseHash) external;
function getSummary(uint256 agentId, address[] calldata clientAddresses,
    string tag1, string tag2) external view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals);
```

- Fixed-point scoring (`int128` with 0-18 decimals)
- Tag-based categorization for multi-dimensional reputation
- Revocable feedback with response mechanism
- On-chain aggregation for composability, off-chain for sophisticated algorithms

#### Validation Registry

```solidity
function validationRequest(address validatorAddress, uint256 agentId,
    string requestURI, bytes32 requestHash) external;
function validationResponse(bytes32 requestHash, uint8 response,
    string responseURI, bytes32 responseHash, string tag) external;
function getValidationStatus(bytes32 requestHash) external view returns (
    address validatorAddress, uint256 agentId, uint8 response,
    bytes32 responseHash, string tag, uint256 lastUpdate);
```

- Generic hooks for independent validator checks
- Supports: stake-secured re-execution, zkML proofs, TEE oracles, trusted judges
- Summary aggregation across validators

### How It Could Link to Nostr Keypairs

ERC-8004 does not natively reference Nostr. However, a bridge is architecturally feasible:

1. **Metadata storage**: The `setMetadata(agentId, "nostr_pubkey", <hex_pubkey>)` call could store a Nostr public key as agent metadata on-chain
2. **Agent URI linking**: The off-chain JSON registration file (pointed to by `agentURI`) could include Nostr relay URLs and the agent's npub
3. **Cross-protocol attestation**: An agent could publish a NIP-78 (arbitrary custom app data) event on Nostr signing a message that references its ERC-8004 agent ID, creating a bidirectional attestation
4. **CAIP-10 extension**: The standard's CAIP-10 alignment for cross-chain references could be extended with a custom namespace for Nostr (though this would require community adoption)
5. **Dual identity**: An agent could operate with both an Ethereum address (for ERC-8004 reputation) and a Nostr keypair (for social graph trust via NIP-02), unifying them through mutual attestation

### Sources

- [ERC-8004 Official EIP](https://eips.ethereum.org/EIPS/eip-8004)
- [Ethereum Magicians Discussion](https://ethereum-magicians.org/t/erc-8004-trustless-agents/25098)
- [Eco: What is ERC-8004?](https://eco.com/support/en/articles/13221214-what-is-erc-8004-the-ethereum-standard-enabling-trustless-ai-agents)
- [BuildBear: ERC-8004 Practical Explainer](https://www.buildbear.io/blog/erc-8004)
- [CoinDesk: ERC-8004 Goes Live](https://www.coindesk.com/markets/2026/01/28/ethereum-s-erc-8004-aims-to-put-identity-and-trust-behind-ai-agents)

---

## 4. Competitive Landscape - Agent Payment Systems

### a) NEAR AI Agent Payments

**Payment Mechanism**: NEAR Intents -- a cross-chain liquidity protocol where users/agents express desired outcomes and **Solvers** (market makers) compete to fulfill them optimally. Settlement occurs via a Verifier smart contract on NEAR. Has processed $10B+ in volume as of late 2025.

**Architecture Flow**: User/Agent -> Intent -> Solver Bus (off-chain) -> Solver competition -> Quote -> Approval -> Verifier contract (on-chain) -> Settlement

**Identity Model**: NEAR account IDs (human-readable, e.g., `alice.near`). Chain Signatures technology enables cross-chain identity. Monthly active users: 46M+.

**Trust/Reputation**: Solver competition provides market-driven trust. No formal on-chain reputation registry, but solver performance is implicitly tracked.

**Strengths**:
- Massive scale (46M users, $10B+ intent volume)
- Chain abstraction removes blockchain complexity for users
- Natural language intent expression with AI agent translation
- Cross-chain capability without traditional bridges
- Active AI agent marketplace (NEAR AI)

**Weaknesses**:
- Tied to NEAR ecosystem (despite chain abstraction claims)
- Solver Bus is off-chain, reducing transparency
- No formal agent identity or reputation standard
- Payment settlement requires NEAR infrastructure

**vs. ILP**: NEAR Intents and ILP share the concept of intermediaries (Solvers vs. Connectors) competing to route value. ILP is more protocol-agnostic and doesn't require a specific blockchain, while NEAR provides a more vertically integrated experience.

### Sources

- [NEAR Intents Overview](https://docs.near.org/chain-abstraction/intents/overview)
- [Introducing NEAR Intents](https://pages.near.org/blog/introducing-near-intents/)
- [NEAR AI Agent Market](https://near.ai/blog/introducing-near-ai-agent-market)

---

### b) Fetch.ai / ASI Alliance

**Payment Mechanism**: AI-to-AI payment system launched January 2026 on the ASI:ONE platform. Supports payments via temporary Visa cards, on-chain USDC, and FET tokens. Mastercard support planned for later 2026. Agents operate with dedicated wallets and user-defined spending limits.

**Identity Model**: Agent identities managed through the ASI:ONE platform. Agents have dedicated wallets with user-configured spending budgets and optional transaction confirmation requirements.

**Trust/Reputation**: Platform-managed trust. Security controls include dedicated agent wallets, spending limits, and optional approval flows before payment finalization.

**Strengths**:
- First to market with AI-to-AI payments on a proprietary platform
- Multi-rail payment support (Visa, USDC, FET)
- Strong user control mechanisms (spending limits, approval gates)
- Agents can transact while user is offline

**Weaknesses**:
- Platform-locked (ASI:ONE only)
- ASI Alliance instability (Ocean Protocol withdrew in October 2025 over treasury disputes)
- Proprietary identity model, not interoperable
- No open standard for cross-platform agent payments
- Centralized trust model

**vs. ILP**: Fetch.ai's approach is proprietary and platform-bound. ILP's open connector model would enable any agent platform to interoperate. Fetch.ai's multi-rail support (card + crypto) is broader than typical ILP deployments but lacks ILP's settlement-agnostic design.

### Sources

- [Fetch.ai AI-to-AI Payment System](https://fetch.ai/blog/world-s-first-ai-to-ai-payment-for-real-world-transactions)
- [Fetch.ai AI Agent Payment Launch 2026](https://www.indexbox.io/blog/fetchai-launches-ai-agent-payment-system-in-january-2026/)
- [Fetch.ai AI-to-AI Payments Using USDC and FET](https://cryptobriefing.com/ai-agent-payments-usdc-fet/)

---

### c) Autonolas (Olas)

**Payment Mechanism**: Multi-layered token economics using OLAS:
- **Developer incentives**: Proportional to code contributions
- **Operator rewards**: For running agent services
- **Bonding**: LP share bonding for protocol-owned liquidity
- **Service staking**: Operators lock deposits, with slashing for misbehavior
- **veOLAS**: Lock OLAS to receive governance power and service whitelisting

**Identity Model**: On-chain registry where autonomous services, agents, and components are registered as NFTs. Agents are composed from components, and services are composed from agents -- all tracked on-chain.

**Architecture**: Off-chain Multi-Agent Systems (MAS) secured by on-chain consensus. Agents replicate internal state via a consensus gadget. A threshold of agents must approve and sign transactions using a multisig Safe, preventing single-agent malicious actions.

**Trust/Reputation**: Crypto-economic security via staking and slashing. Consensus-based action approval. Service owners can be whitelisted through veOLAS governance.

**Strengths**:
- Sophisticated multi-agent coordination with consensus
- On-chain composability (components -> agents -> services)
- Slashing provides economic security guarantees
- Decentralized by construction (no single point of failure)
- Open Autonomy framework for building agent services

**Weaknesses**:
- Complex token economics may deter adoption
- Agent coordination overhead (consensus gadget)
- Primarily Ethereum-based
- Developer experience is more complex than alternatives
- No native micropayment mechanism for per-request billing

**vs. ILP**: Olas focuses on coordinating multi-agent services rather than payment routing. ILP could complement Olas by providing the payment layer for per-request billing between agent services, while Olas handles coordination and security.

### Sources

- [Olas Network](https://olas.network/)
- [Olas Developer Documentation](https://docs.olas.network/open-autonomy/)
- [What is Autonolas (Olas)?](https://www.gate.com/learn/articles/what-is-autonolas-olas/7162)

---

### d) SingularityNET

**Payment Mechanism**: Originally AGIX token for marketplace transactions. Now transitioning to ASI (Artificial Superintelligence) token as part of the ASI Alliance merger with Fetch.ai and Ocean Protocol. The legacy AGIX marketplace has been deprecated; services are migrating to the FET (ASI) marketplace.

**Identity Model**: Platform-managed agent identities on the SingularityNET marketplace. Service providers register and list AI services with metadata, pricing, and API specifications.

**Trust/Reputation**: Marketplace-based ratings and reviews. Service quality tracked through platform metrics.

**Strengths**:
- Pioneer in decentralized AI marketplace concept (since 2017)
- Wide range of AI services available
- Academic credibility (Dr. Ben Goertzel, AGI research)
- Part of ASI Alliance (broader ecosystem)

**Weaknesses**:
- Token migration from AGIX to ASI creates confusion
- ASI Alliance instability (Ocean's departure)
- Marketplace model is centralized despite decentralized branding
- No micropayment support -- full transaction per service call
- Limited agent-to-agent direct communication

**vs. ILP**: SingularityNET's marketplace model is more like an app store than a payment network. ILP enables direct peer-to-peer value transfer without a central marketplace. ILP's streaming micropayments would enable pay-per-token or pay-per-inference billing that SingularityNET's model cannot support.

### Sources

- [SingularityNET](https://singularitynet.io/)
- [The AGIX Token](https://singularitynet.io/the-agix-token-enabling-anyone-to-participate-in-the-future-of-ai/)
- [SingularityNET FET (ASI) Token Integration](https://singularitynet.io/singularitynet-completes-fet-asi-token-integration-into-decentralized-ai-platform/)

---

### e) Nostr-Native Agent Experiments

#### NIP-90 DVMs (covered in detail in Section 6)

The primary Nostr-native compute marketplace. Service providers compete to fulfill job requests with Lightning payment integration.

#### nostrdvm

A Python framework (PyPI: `nostr-dvm`) for building and running NIP-90 Data Vending Machines. Handles event subscription, job processing, result publishing, and payment flows. Active development.

#### DVMDash

A monitoring and debugging dashboard for DVM activity on Nostr (dvmdash.live). Tracks DVM events from relays, provides metrics, request browsing, and interaction debugging. Funded by OpenSats (fifth wave of Nostr grants, 2024).

#### DVMCP (DVM-MCP Bridge)

A bridge connecting MCP servers to Nostr's DVM ecosystem. Enables AI tools to be discovered and utilized via Nostr's decentralized network. Available as `@dvmcp/bridge` on npm. This is a significant convergence point -- MCP tools exposed as Nostr DVMs.

#### Alby NWC MCP Server

Alby's MCP server connects Bitcoin Lightning wallets to LLMs via Nostr Wallet Connect (NWC). Enables AI agents to check balances, create invoices, and manage Lightning payments. Supports STDIO, SSE, and HTTP Streamable transports. This demonstrates the NWC-as-agent-payment-rail pattern.

#### n8n AI Agent DVM MCP Client

An n8n workflow that enables AI agents to find and use MCP Server tools served as DVMs over Nostr. Demonstrates the full loop: AI agent -> MCP -> Nostr DVM -> compute -> payment -> result.

**Strengths of Nostr-native approaches**:
- Fully decentralized, censorship-resistant
- Native Lightning micropayment integration
- Open protocol (anyone can build DVMs, no platform lock-in)
- Social graph integration via NIP-02
- MCP bridge exists (DVMCP)
- No token required -- uses Bitcoin/Lightning

**Weaknesses**:
- Small ecosystem compared to alternatives
- No formal agent identity standard (just Nostr keypairs)
- Payment UX relies on Lightning, which has adoption limitations
- No on-chain reputation (reputation is social-graph based)
- DVM monitoring tooling is nascent (DVMDash is under development)

### Sources

- [nostrdvm (GitHub)](https://github.com/believethehype/nostrdvm)
- [DVMDash](https://dvmdash.live/)
- [DVMCP Bridge (GitHub)](https://github.com/gzuuus/dvmcp)
- [Alby MCP Server (GitHub)](https://github.com/getAlby/mcp)
- [n8n DVM MCP Client (GitHub)](https://github.com/r0d8lsh0p/n8n-AI-agent-DVM-MCP-client)
- [NWC Documentation](https://docs.nwc.dev/introduction/introduction-to-nwc)

---

### f) Other Relevant Agent Payment Systems (2025-2026)

#### Visa Trusted Agent Protocol (October 2025)
Open framework for safe agent-driven checkout. Helps merchants distinguish legitimate AI agents from bots. Built on existing web infrastructure. Partners with 10+ organizations.

#### Stripe Agentic Commerce Protocol (September 2025)
API for agentic payments launched with OpenAI. Enables AI agents to complete purchases on behalf of users through existing Stripe payment rails.

#### Mastercard Agent Pay
Introduces Agentic Tokens for security and transparency in AI agent payments. Provides before/during/after transaction verification.

#### Google AP2 (covered in Section 1)
Open protocol with 60+ partners. Mandate-based authorization with cryptographic audit trail.

### Sources

- [Visa Trusted Agent Protocol](https://corporate.visa.com/en/sites/visa-perspectives/newsroom/visa-partners-complete-secure-agentic-transactions.html)
- [Stripe Agentic Commerce](https://www.pymnts.com/news/artificial-intelligence/2025/2025-the-year-ai-agents-entered-payments-and-changed-whos-in-control)
- [Mastercard Agent Pay](https://www.mastercard.com/global/en/news-and-trends/stories/2026/agentic-commerce-standards.html)

---

### Competitive Landscape Summary Table

| System | Payment Rail | Identity | Trust Model | Micropayments | Open Standard | Agent-Native |
|--------|-------------|----------|-------------|---------------|---------------|--------------|
| **A2A + x402** | Stablecoin (USDC) | Agent Card + Wallet | On-chain verification | Yes ($0.001) | Yes (Apache 2.0) | Yes |
| **A2A + AP2** | Card/Crypto/Bank | Agent Card + Mandates | Cryptographic audit | No (full tx) | Yes (Apache 2.0) | Yes |
| **ERC-8004** | N/A (identity layer) | ERC-721 NFT | On-chain reputation | N/A | Yes (EIP) | Yes |
| **NEAR Intents** | NEAR tokens | NEAR accounts | Solver competition | Partial | Yes | Partial |
| **Fetch.ai/ASI** | Visa/USDC/FET | Platform wallets | Platform-managed | No | No | Yes |
| **Olas** | OLAS token | NFT registry | Staking/slashing | No | Yes | Yes |
| **SingularityNET** | ASI token | Platform registry | Marketplace ratings | No | Partial | No |
| **Nostr DVMs** | Lightning (sats) | Nostr keypairs | Social graph | Yes (msats) | Yes (NIP-90) | Partial |
| **ILP (Crosstown)** | Any (settlement agnostic) | Nostr keypairs + ILP address | Social graph trust | Yes (streaming) | Yes (RFC) | Designed for it |
| **Visa TAP** | Card networks | Visa credentials | Framework verification | No | Partial | Partial |
| **Stripe ACP** | Stripe rails | Stripe accounts | Stripe trust | Yes | No | Partial |

---

## 5. Model Context Protocol (MCP) Composition

### MCP Fundamentals

MCP is Anthropic's open protocol (released November 2024, latest spec: November 2025) for connecting LLMs to external tools and data. Over 5,800 MCP servers and 300+ clients exist as of early 2026.

### Three Core Primitives

1. **Tools** (model-controlled): Executable functions the AI model can discover and invoke. The model chooses when and how to call them based on context.

2. **Resources** (application-controlled): Data exposed by the server for the client to use as context. Analogous to GET endpoints -- read-only data retrieval.

3. **Prompts** (user-controlled): Reusable templates that guide AI interactions. Typically exposed through slash commands or menu options.

### Tool Exposure Pattern

MCP servers expose tools with:
- **Name**: Unique identifier for the tool
- **Description**: Human-readable explanation for the model
- **Input schema**: JSON Schema defining expected parameters
- **Handler function**: Actual implementation

The model discovers available tools via `tools/list`, evaluates which to call based on the user's request and tool descriptions, constructs appropriate parameters, and processes results.

### Composite MCP Server Patterns

#### 1. MCP Proxy/Gateway Pattern

An MCP gateway is a session-aware reverse proxy that fronts multiple MCP servers behind one endpoint. Capabilities:

- **Unified tool discovery**: Clients list tools from many servers without knowing their locations
- **Transport adaptation**: Accept HTTP+JSON from clients, convert to WebSocket/TCP toward servers
- **Automatic prefixing**: Tools from different servers get namespaced (e.g., `weather_get_forecast`, `calendar_add_event`)
- **Centralized auth**: Single authentication point for all downstream servers
- **Routing**: Determines the best server for each request based on cached capabilities
- **Lifecycle management**: Connects to each server on startup, runs initialize, caches capabilities

Implementations:
- **FastMCP Proxy Provider**: Native composite proxy support
- **mcp-proxy-server** (GitHub: adamwattis): Aggregates multiple MCP resource servers through single interface
- **Atrax** (GitHub: metcalfc): MCP proxy with multiple server aggregation
- **MCP Gateway Registry** (GitHub: agentic-community): Enterprise-ready with OAuth, dynamic discovery

#### 2. Server Composition via FastMCP

FastMCP enables creating composite servers by importing and mounting sub-servers:

```python
from fastmcp import FastMCP

app = FastMCP("composite")
app.mount("weather", weather_server)
app.mount("calendar", calendar_server)
# Tools auto-prefixed: weather_get_forecast, calendar_add_event
```

#### 3. Enterprise Gateway Pattern

For production deployments:
- Central registry of approved MCP servers
- OAuth/OIDC authentication per server
- Rate limiting and usage tracking
- Audit logging
- Policy enforcement (which tools are available to which agents)

### November 2025 Specification: Tasks Primitive

The latest MCP spec introduces **Tasks** -- allowing servers to perform asynchronous, long-running operations:
- Server creates a task, returns a handle
- Publishes progress updates
- Delivers results when complete

This mirrors A2A's task lifecycle and enables MCP servers to manage stateful workflows.

### MCP + Nostr Integration Opportunities

The DVMCP bridge already demonstrates MCP-to-DVM connectivity. For Crosstown:
- ILP connector operations could be exposed as MCP tools
- Social trust queries could be MCP resources
- SPSP handshake flows could be MCP tool sequences
- A composite MCP server could unify ILP + Nostr + social graph capabilities

### Sources

- [MCP Specification (2025-11-25)](https://modelcontextprotocol.io/specification/2025-11-25)
- [MCP Tools Specification](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)
- [FastMCP Proxy Provider](https://gofastmcp.com/servers/providers/proxy)
- [MCP Gateway Explained (Gravitee)](https://www.gravitee.io/blog/mcp-api-gateway-explained-protocols-caching-and-remote-server-integration)
- [MCP Proxy Server (GitHub)](https://github.com/adamwattis/mcp-proxy-server)
- [MCP Gateway Registry (GitHub)](https://github.com/agentic-community/mcp-gateway-registry)
- [MCP Blog: First Anniversary](http://blog.modelcontextprotocol.io/posts/2025-11-25-first-mcp-anniversary/)

---

## 6. NIP-90 Data Vending Machines

### Overview

NIP-90 defines Nostr as a marketplace for on-demand computation. Users publish job requests specifying desired outputs and willingness to pay. Service providers compete to fulfill requests optimally. This is a broadcast marketplace, not a 1:1 exchange.

### Event Kinds

| Kind Range | Purpose |
|------------|---------|
| 5000-5999 | Job requests |
| 6000-6999 | Job results (request kind + 1000) |
| 7000 | Job feedback/status |

### Job Request Format (Kind 5000-5999)

```json
{
  "kind": 5xxx,
  "tags": [
    ["i", "<data>", "<input-type>", "<relay>", "<marker>"],
    ["output", "<mime-type>"],
    ["param", "<key>", "<value>"],
    ["bid", "<millisats>"],
    ["relays", "wss://relay1", "wss://relay2"],
    ["p", "<service-provider-pubkey>"]
  ]
}
```

Input types: `url`, `event`, `job` (for chaining), `text`

### Job Result Format (Kind 6000-6999)

```json
{
  "kind": 6xxx,
  "tags": [
    ["request", "<stringified-original-request>"],
    ["e", "<job-request-id>", "<relay-hint>"],
    ["p", "<customer-pubkey>"],
    ["amount", "<millisats>", "<bolt11-invoice>"],
    ["i", "<original-input>"]
  ]
}
```

### Job Feedback Status Types (Kind 7000)

| Status | Description |
|--------|-------------|
| `payment-required` | Payment needed before continuation |
| `processing` | Job in progress |
| `error` | Processing failed |
| `success` | Job completed successfully |
| `partial` | Partial results available |

### Payment Integration

The payment flow is deliberately flexible:

1. **Pre-payment**: Provider responds with `payment-required` before starting work
2. **Post-delivery**: Provider delivers results, then requests payment
3. **Partial delivery**: Provider delivers a sample, requests payment for full results
4. **Trust-based**: Provider assesses likelihood of payment based on customer's past behavior and serves accordingly

Payment methods:
- **Bolt11 invoice**: Included in the `amount` tag of job results
- **Zaps (NIP-57)**: Customer zaps the result event
- Both methods should be monitored by service providers

### Job Chaining

Jobs can be chained by specifying previous job outputs as inputs:

```json
["i", "<event-id-of-previous-job>", "job"]
```

Example: Podcast audio -> kind:5002 (transcription) -> kind:5001 (summarization)

### Encryption

For sensitive inputs, NIP-04 encryption between customer and provider:
- Encrypted `i` and `param` tags placed in event `content`
- `encrypted` tag added to signal encryption
- Provider decrypts with customer's public key

### Service Provider Discovery

Providers advertise capabilities via NIP-89 (kind:31990) announcements:
```json
{
  "kind": 31990,
  "tags": [
    ["k", "5005"],
    ["d", "<unique-identifier>"]
  ]
}
```

### DVM as Compute Marketplace

DVMs serve as a natural compute marketplace because:
- **Permissionless entry**: Anyone can run a DVM (no platform registration)
- **Competitive pricing**: Multiple providers compete per job
- **Micropayment native**: Lightning enables per-job payments in millisats
- **Censorship resistant**: Jobs and results transit via Nostr relays
- **Composable**: Job chaining enables multi-step workflows
- **Discoverable**: NIP-89 announcements enable automatic discovery

### Registered DVM Job Kinds

Some standardized kinds from the data-vending-machines registry:

| Kind | Name | Description |
|------|------|-------------|
| 5000 | Text Extraction | Extract text from media |
| 5001 | Summarization | Summarize text |
| 5002 | Translation | Translate text |
| 5003 | Text Generation | Generate text from prompt |
| 5005 | Image Generation | Generate images |
| 5050 | Text-to-Speech | Convert text to audio |
| 5100 | Content Discovery | Algorithmic feed/recommendations |
| 5250 | Event Counting | Count events matching filter |
| 5300 | Content Search | Search for content |

### Sources

- [NIP-90 Specification](https://nips.nostr.com/90)
- [NIP-90 on GitHub](https://github.com/nostr-protocol/nips/blob/master/90.md)
- [DVM Kind Registry (GitHub)](https://github.com/nostr-protocol/data-vending-machines)
- [nostrdvm Framework (GitHub)](https://github.com/believethehype/nostrdvm)
- [nostr-dvm on PyPI](https://pypi.org/project/nostr-dvm/)

---

## 7. Synthesis: Implications for Crosstown Protocol

### Where Crosstown Fits in the Landscape

The Crosstown Protocol occupies a unique position at the intersection of three ecosystems that are converging but not yet connected:

1. **Nostr social graph** (NIP-02 follows, NIP-90 DVMs, NWC payments)
2. **ILP routing** (settlement-agnostic micropayments, connector mesh)
3. **Emerging agent standards** (A2A, x402, ERC-8004, MCP)

No other project bridges all three. The closest competitors address subsets:
- A2A + x402 handles agent communication + payments but lacks social trust
- Nostr DVMs handle compute marketplace + Lightning payments but lack structured routing
- ERC-8004 handles identity + reputation but not payments or social graph
- NEAR Intents handle cross-chain payments but not social-graph-informed routing

### Strategic Integration Opportunities

#### 1. A2A Compatibility Layer
Crosstown agents could publish A2A-compatible Agent Cards (at `/.well-known/agent.json`) that reference their Nostr pubkey and ILP address. This would make Crosstown agents discoverable by the broader A2A ecosystem while maintaining Nostr-native operation.

#### 2. x402 as Settlement Rail
The x402 facilitator architecture maps naturally to ILP settlement engines. An x402-based settlement engine would allow ILP connectors to settle via stablecoins on Base/Solana, connecting Crosstown to the 140M+ x402 transaction ecosystem.

#### 3. ERC-8004 Reputation Bridge
Crosstown's social-graph-based trust (NIP-02 follows, mutual connections, zap history) could be published to ERC-8004's Reputation Registry, creating a cross-ecosystem reputation that's legible to the broader agent economy. The Identity Registry's metadata system could store Nostr pubkeys for bidirectional linking.

#### 4. NIP-90 DVMs as Service Layer
ILP-peered agents could expose their capabilities as NIP-90 DVMs, enabling Nostr users to pay for agent services via Lightning while the agent-to-agent backbone uses ILP for routing. The DVMCP bridge already demonstrates MCP-to-DVM connectivity.

#### 5. MCP as Agent Interface
A composite MCP server could unify:
- ILP connector management tools (add peer, check balance, route payment)
- Nostr social graph resources (follow list, trust scores, peer discovery)
- SPSP handshake tools (request/respond to payment setup)
- DVM job management (submit, monitor, pay for compute)

This would make Crosstown capabilities available to any MCP-compatible AI system (Claude, GPT, etc.).

#### 6. AP2 Mandate Integration
For human-agent commerce, AP2 mandates could authorize ILP-based agent payments with cryptographic user approval, combining AP2's trust model with ILP's micropayment efficiency.

### Key Architectural Decisions Informed by This Research

1. **Agent Cards are the lingua franca**: Publishing A2A-compatible agent cards is low-cost and high-value for interoperability
2. **x402 is not a competitor to ILP -- it's a complementary settlement rail**: They operate at different layers (HTTP payment negotiation vs. packet-level routing)
3. **Social graph trust is Crosstown's moat**: No other system derives trust from social relationships. ERC-8004's reputation is transactional; NIP-02-based trust is relational
4. **MCP composition is the right integration surface**: Rather than building custom integrations, exposing capabilities as MCP tools enables broad compatibility
5. **NIP-90 DVMs provide the service marketplace**: ILP provides the routing/settlement backbone; DVMs provide the service discovery and job management layer
6. **Lightning and ILP can coexist**: Lightning for Nostr-native payments (zaps, DVM jobs), ILP for cross-network routing and settlement
