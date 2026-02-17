# 4. Epic List

> **Canonical location for epic details:** [`docs/epics/`](../epics/)
> Each epic has its own file: `epic-{n}-{title}.md`

| Epic | Title | Status | Goal |
|------|-------|--------|------|
| 1 | Foundation & Peer Discovery | Complete | Establish project infrastructure and deliver core peer discovery from NIP-02 follow lists |
| 2 | SPSP Over Nostr | Complete | Enable SPSP parameter exchange via Nostr events (static and dynamic) |
| 3 | Social Trust Engine | Complete | Compute trust scores from social graph data for credit limit derivation |
| 4 | ILP-Gated Relay | Complete | Reference implementation of pay-to-write Nostr relay with ILP integration |
| 5 | Standalone BLS Docker Image | Complete | Publishable BLS container for agent-runtime integration with standard contract |
| 6 | Decentralized Peer Discovery | Complete | Layered peer discovery combining genesis peers, ArDrive registry, and NIP-02 social graph |
| 7 | SPSP Settlement Negotiation | Complete | Extend SPSP to negotiate settlement chains and open payment channels via connector Admin API |
| 8 | Nostr Network Bootstrap | Complete | Complete bootstrap flow: relay discovery → 0-amount ILP SPSP → paid announcements → cross-peer discovery |
| **9** | **npm Package Publishing** | **Complete** | **Publish @crosstown/core, @crosstown/bls, and @crosstown/relay as public npm packages** |
| **10** | **Embedded Connector Integration** | **Complete** | **Eliminate HTTP boundary by embedding ConnectorNode in-process; `createCrosstownNode()` composition** |
| **11** | **NIP Handler Agent Runtime** | **In Progress** | **Autonomous TypeScript runtime using Vercel AI SDK (v6) for LLM-powered Nostr event processing** |
| 12 | Cross-Town Communication Foundation | Planned | NIP-05, NIP-17, NIP-25, NIP-40, NIP-46, NIP-65, NIP-09, NIP-56 — cross-Town messaging, identity, remote signing, lifecycle management |
| 13 | Paid Computation Marketplace | Planned | NIP-90 DVMs with ILP micropayments; NIP-89 service discovery; DVM payment flow for cross-Town work dispatch |
| 14 | Trust Infrastructure & Reputation | Planned | NIP-57 ILP zaps; NIP-32 labeling (agent taxonomy + code review); NIP-58 badges; NIP-85 trust oracles; NIP-51 lists |
| 15 | Decentralized Git Collaboration | Planned | NIP-34 patches/PRs/status; NIP-29 project groups; NIP-32 review labels; NIP-77 negentropy — trust-weighted multi-approval merges |
| 16 | Content & Community Layer | Planned | NIP-10 threading; NIP-18 reposts; NIP-23 long-form; NIP-53 live activities; NIP-72 communities |
| 17 | Cross-Town Federation & Agent Swarms | Planned | NIP-29 federation groups; payment-gated Town membership; hierarchical ILP addressing; Wasteland protocol replacement |

---
