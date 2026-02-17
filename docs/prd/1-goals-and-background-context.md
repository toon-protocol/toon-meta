# 1. Goals and Background Context

## 1.1 Goals

- Enable autonomous AI agents to discover ILP payment peers from their Nostr follow lists without manual configuration
- Provide SPSP parameter exchange over Nostr events with settlement negotiation, eliminating HTTPS/DNS/TLS dependencies
- Derive trust-based credit limits from social graph relationships (social distance, mutual followers, reputation)
- Deliver a reference implementation of ILP-gated Nostr relays with pay-to-write spam resistance
- Provide a standalone BLS Docker image for plug-and-play integration with agent-runtime
- Implement layered peer discovery (genesis peers, ArDrive registry, NIP-02 social graph) for reliable network bootstrap
- Support embedded connector mode for zero-latency in-process ILP routing alongside HTTP mode
- Deliver an autonomous agent runtime powered by LLM-based event handlers for real-time Nostr event processing
- Enable Gas Town (Go) instances to participate as standard protocol peers via Nostr relay subscription and ILP connector interaction — no custom bridge protocol required
- Support cross-Town code collaboration via NIP-34 decentralized git with trust-weighted multi-approval merges
- Deliver Town-to-Town federation replacing Gas Town's Wasteland/DoltHub transport with Nostr events and ILP payment channels
- Publish core packages to npm for downstream consumption by agent frameworks
- Establish the protocol as the standard for Nostr+ILP integration with formal NIP submissions
- Achieve adoption by 3+ agent framework projects within 6 months of stable release

## 1.2 Background Context

Traditional ILP infrastructure struggles with peer discovery (requires manual config or centralized registries), SPSP handshakes (heavyweight HTTPS dependencies), and trust bootstrapping (no data-driven basis for credit limits). For autonomous AI agents, these problems are acute—agents need to transact programmatically, discover counterparties dynamically, and make trust decisions without human intervention.

The convergence of Nostr's growth as decentralized identity infrastructure, rising interest in autonomous AI agents, ILP's maturity as a payment protocol, and the need for spam-resistant relay infrastructure creates the ideal moment for Crosstown Protocol. The core insight: **your Nostr follows become your ILP peers, and social distance informs financial trust.**

The project has grown from a 3-package protocol library to a comprehensive 6-package monorepo with Docker deployment, embedded connector integration, settlement negotiation, layered peer discovery, and an autonomous LLM-powered agent runtime. A NIP adoption roadmap (Epics 12-17) extends the protocol with cross-Town communication, paid computation, trust infrastructure, decentralized git collaboration, content communities, and Town-to-Town federation.

The [Crosstown x Gas Town Integration Analysis](../research/gastown-integration-analysis.md) is planned work that drives the roadmap. Gas Town (Steve Yegge's multi-agent orchestration framework, ~189K LOC Go) instances interact with Crosstown as standard protocol peers — subscribing to a peer's Nostr relay for events and submitting ILP packets to that peer's connector. No custom bridge or Go-TypeScript gateway is required; Gas Town speaks the same NIP-01 WebSocket and ILP BTP/HTTP protocols as any other peer.

## 1.3 Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-05 | 0.1 | Initial PRD draft from Project Brief | PM |
| 2026-02-17 | 2.0 | Major update: Epics 5-11 added (BLS Docker, layered discovery, settlement negotiation, bootstrap, npm publishing, embedded connector, agent runtime). Epics 12-17 roadmap added. Updated FRs/NFRs, package structure (6 packages + Docker), three deployment modes, Node.js 24.x. Removed kind:10047 static SPSP. | PM |
| 2026-02-17 | 3.0 | Epics 12-17 restructured for Gas Town integration (planned work). NIP-17 moved to Epic 12. NIP-34 added as Epic 15. Old Epics 14+15 merged into new Epic 14 (Trust Infrastructure). Epic 17 grounded in Gas Town federation model. New FRs (38-66) and NFRs (14-15) added. | Architect |

---
