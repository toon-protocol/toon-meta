# Epic 11: ElizaOS Plugin

**Phase:** Integration
**Estimated Stories:** 6
**Dependencies:** Epic 9 (agent-society published to npm), Epic 10 (embedded connector integration — provides `createAgentSocietyNode()`)
**External Dependency:** `@agent-runtime/connector` published as npm library (work tracked in agent-runtime repo — see `ELIZAOS-INTEGRATION-HANDOFF.md`)
**Blocks:** Epics 12–17 (future NIP/feature epics benefit from ElizaOS runtime)

---

## Epic Goal

Create `@agent-society/elizaos-plugin` — an ElizaOS plugin that wraps the entire agent-society + agent-runtime stack as a single in-process Service, with Actions for payments/discovery/trust, Providers for LLM context injection, and Evaluators for learning from outcomes. The end state: one ElizaOS character file, one process, a fully functional ILP-connected Nostr payment agent.

## Epic Description

### Existing System Context

- **Current functionality:** agent-society provides Nostr peer discovery, SPSP, trust scoring, BLS, and relay. agent-runtime provides ILP connector with BTP, routing, and settlement. After Epics 9-10, both are importable npm libraries.
- **Technology stack:** ElizaOS (agent runtime framework), TypeScript, @elizaos/core
- **Integration points:** ElizaOS Plugin interface (Services, Actions, Providers, Evaluators, Events, Routes)

### Target Architecture

```
ElizaOS Agent Process
├── AgentSocietyService (ElizaOS Service)
│   ├── ConnectorNode (BTP server — external peers connect here)
│   ├── BusinessLogicServer (BLS — handles incoming payments)
│   ├── NostrRelayServer (NIP-01 relay — external Nostr clients connect)
│   ├── BootstrapService (discovers peers, negotiates SPSP)
│   ├── SocialTrustManager (trust from social graph)
│   └── NostrSpspClient/Server (payment setup)
│
├── Actions
│   ├── PAY — "Pay Alice 5 USD"
│   ├── REQUEST_PAYMENT — "Request 10 USD from Bob"
│   ├── DISCOVER_PEERS — "Find new payment peers"
│   ├── CHECK_TRUST — "How much do I trust Carol?"
│   ├── BOOTSTRAP_NETWORK — "Bootstrap my ILP network"
│   └── PUBLISH_PEER_INFO — "Update my ILP peer info"
│
├── Providers (inject context into LLM decisions)
│   ├── trustScore — trust scores for mentioned peers
│   ├── peerStatus — connected peer status
│   ├── ilpBalance — connector balances per peer
│   ├── networkStatus — bootstrap phase, relay health
│   └── paymentHistory — recent payment records
│
├── Evaluators (learn from outcomes)
│   ├── paymentOutcome — assess success/failure, record in memory
│   └── trustEvolution — track trust changes over time
│
└── Routes (HTTP API for external tools)
    ├── GET /status
    ├── GET /peers
    ├── GET /trust/:pubkey
    └── GET /payments
```

### What's Being Built

> **Note:** Integration refactoring (`createDirectRuntimeClient`, `createAgentSocietyNode`, BLS visibility, `handlePacket` rename) was moved to Epic 10. This epic assumes those are complete.

1. **Package scaffolding** — new `packages/elizaos-plugin/` with package.json, tsconfig, tsup
2. **AgentSocietyService** — ElizaOS Service wrapping `createAgentSocietyNode()`, reads config from character settings/secrets
3. **PAY Action** — end-to-end payment: resolve recipient → check trust → SPSP negotiate → send ILP packet → record outcome
4. **Discovery & Trust Actions** — DISCOVER_PEERS, CHECK_TRUST, BOOTSTRAP_NETWORK, PUBLISH_PEER_INFO, REQUEST_PAYMENT
5. **Providers** — trustScore, peerStatus, ilpBalance, networkStatus, paymentHistory
6. **Evaluators, Events, Routes** — paymentOutcome, trustEvolution evaluators; custom event types; REST routes

### Character Configuration

With the plugin installed, an agent needs only a character file:

```jsonc
{
  "name": "PaymentAgent",
  "plugins": ["@agent-society/elizaos-plugin"],
  "settings": {
    "AGENT_SOCIETY_ILP_ADDRESS": "g.agent.payment-agent",
    "BTP_PORT": "7768",
    "RELAY_PORT": "7100",
    "AGENT_SOCIETY_RELAYS": "wss://relay.damus.io,wss://relay.nostr.band",
    "AGENT_SOCIETY_AUTO_BOOTSTRAP": "true",
    "AGENT_SOCIETY_TRUST_THRESHOLD": "0.5",
    "AGENT_SOCIETY_MAX_PAYMENT": "100"
  },
  "secrets": {
    "AGENT_SOCIETY_NOSTR_PRIVATE_KEY": "<hex-encoded-nostr-private-key>"
  }
}
```

## Acceptance Criteria

- [ ] `npm install @agent-society/elizaos-plugin` works
- [ ] Plugin loads in ElizaOS runtime without errors
- [ ] Agent bootstraps into ILP network on startup (BTP port open, peers discovered)
- [ ] "Pay Alice 5 USD" works end-to-end via PAY action (resolve → trust → SPSP → ILP → fulfill)
- [ ] Trust scores appear in LLM context when peers are mentioned (trustScoreProvider)
- [ ] Peer status and balances available via providers
- [ ] Payment outcomes recorded in ElizaOS Memory
- [ ] `GET /status` returns network health
- [ ] No HTTP between connector and BLS (direct function calls)
- [ ] Single character file is the only required configuration

## Stories

| # | Story | Description | Size |
|---|-------|-------------|------|
| 11.1 | Create ElizaOS plugin package scaffolding | New packages/elizaos-plugin/ with package.json, tsconfig, tsup, README | S |
| 11.2 | Implement AgentSocietyService | ElizaOS Service wrapping createAgentSocietyNode(), config from character settings | L |
| 11.3 | Implement PAY action | End-to-end payment flow: resolve recipient, trust check, SPSP, ILP send, record outcome | L |
| 11.4 | Implement discovery and trust actions | DISCOVER_PEERS, CHECK_TRUST, BOOTSTRAP_NETWORK, PUBLISH_PEER_INFO, REQUEST_PAYMENT | L |
| 11.5 | Implement providers | trustScore, peerStatus, ilpBalance, networkStatus, paymentHistory providers | L |
| 11.6 | Implement evaluators, events, and routes | paymentOutcome + trustEvolution evaluators, custom event types, REST routes, publish to npm | M |

---
