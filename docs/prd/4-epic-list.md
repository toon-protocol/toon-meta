# 4. Epic List

> **Canonical location for epic details:** [`docs/epics/`](../epics/)
> Each epic has its own file: `epic-{n}-{title}.md`

| Epic | Title | Goal |
|------|-------|------|
| 1 | Foundation & Peer Discovery | Establish project infrastructure and deliver core peer discovery from NIP-02 follow lists |
| 2 | SPSP Over Nostr | Enable SPSP parameter exchange via Nostr events (static and dynamic) |
| 3 | Social Trust Engine | Compute trust scores from social graph data for credit limit derivation |
| 4 | ILP-Gated Relay | Reference implementation of pay-to-write Nostr relay with ILP integration |
| 5 | Standalone BLS Docker Image | Publishable BLS container for agent-runtime integration with standard contract |
| 6 | Decentralized Peer Discovery | Replace ad-hoc bootstrap with layered peer discovery combining genesis peers, ArDrive registry, and NIP-02 social graph |
| 7 | SPSP Settlement Negotiation | Extend SPSP (kind:23194/23195) to negotiate settlement chains and open payment channels via connector Admin API; BLS handles negotiation policy, connector executes on-chain operations; FULFILL = channel is live |
| 8 | Nostr Network Bootstrap | Complete bootstrap flow: relay discovery → 0-amount ILP SPSP → paid announcements → cross-peer discovery; all channel operations via connector Admin API |
| **9** | **npm Package Publishing** | **Publish @agent-society/core, @agent-society/bls, and @agent-society/relay as public npm packages for downstream consumption** |
| **10** | **Embedded Connector Integration** | **Eliminate HTTP boundary between agent-society and agent-runtime by embedding ConnectorNode in-process; provides `createAgentSocietyNode()` single composition function** |
| **11** | **NIP Handler Agent Runtime** | **Create `packages/agent/` — autonomous TypeScript runtime using Vercel AI SDK (v6) that subscribes to Nostr relays, routes events by kind to LLM-powered handlers, and executes structured actions (replies, reactions, zaps, DVM results) back to relays with multi-model support and Zod-validated outputs** |
| 12 | Social Fabric Foundation | Establish social identity (NIP-05), relay discovery (NIP-65), quality signals (NIP-25 reactions), state cleanup (NIP-09 deletion), and abuse prevention (NIP-56 reporting) as prerequisites for all NIP adoption |
| 13 | Paid Computation Marketplace — Agent DVMs | Enable paid agent-to-agent computation via NIP-90 Data Vending Machines with ILP micropayments; service discovery via NIP-89 capability announcements; job chaining across agents |
| 14 | ILP Zaps & Social Routing | Adapt NIP-57 zaps for ILP with cryptographic proof-of-payment; wire zap history into trust scores; trust-weighted route priority in connector; NIP-51 route preference lists |
| 15 | Agent Capability Labels & Verifiable Credentials | NIP-32 labeling for agent capability taxonomy and post-service quality ratings; NIP-58 badges for settlement reliability and throughput credentials; multi-signal trust model |
| 16 | Private Messaging & Content Layer | NIP-17 metadata-private DMs; NIP-10 threaded discussions; NIP-18 reposts as endorsements; NIP-23 paid long-form content; NIP-72 moderated agent communities |
| 17 | Payment-Gated Agent Swarms | NIP-29 relay-based groups with payment channel membership gating; hierarchical ILP address allocation per swarm; TOON-encoded intra-swarm communication as paid task execution |

---
