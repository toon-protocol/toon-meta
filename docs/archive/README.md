# Archive - Future Vision & Unimplemented Features

**Last Updated:** 2026-02-20

## Purpose

This archive contains documentation for features that were planned but not implemented. Crosstown refocused on its core mission as an **ILP-gated Nostr relay**, and these documents represent a broader vision that extended beyond that scope.

## What's Implemented (Epics 1-10)

The **current codebase** (v1.1.1) successfully implements:

✅ **Epic 1-2:** Foundation - Peer discovery via NIP-02, SPSP over Nostr (kinds 10032, 23194, 23195)
✅ **Epic 3:** Social Trust Engine - Trust scoring from social graph relationships
✅ **Epic 4:** ILP-Gated Relay - Pay to write, free to read, spam-resistant relay
✅ **Epic 5:** Standalone BLS Docker - Business Logic Server with Docker deployment
✅ **Epic 6:** Decentralized Peer Discovery - ArDrive registry, genesis peers, social discovery
✅ **Epic 7:** SPSP Settlement Negotiation - Multi-chain settlement, token resolution
✅ **Epic 8:** Nostr Network Bootstrap - BootstrapService, RelayMonitor, 3-phase handshake
✅ **Epic 9:** NPM Package Publishing - 3 packages published to npm at v1.1.1
✅ **Epic 10:** Embedded Connector Integration - `createCrosstownNode()` for in-process ILP routing

## What's Archived (Epics 11-17)

The following features were **documented but never implemented**:

### Epics

- **Epic 11:** NIP Handler Agent Runtime - Autonomous LLM-powered event processing
- **Epic 12:** Cross-Town Communication Foundation - NIP-05, NIP-65, NIP-17 identity/messaging
- **Epic 13:** Paid Computation Marketplace - NIP-90 Data Vending Machines with ILP payments
- **Epic 14:** Trust Infrastructure & Reputation - Advanced multi-signal trust scoring
- **Epic 15:** Decentralized Git Collaboration - NIP-34 git patches, trust-weighted merges
- **Epic 16:** Content & Community Layer - Long-form content, communities, moderation
- **Epic 17:** Cross-Town Federation & Agent Swarms - Multi-node agent coordination

### Stories

5 stories from Epic 11 (agent runtime) - no stories existed for Epics 12-17

### Research Documents

- Agent framework selection (Vercel AI SDK evaluation)
- Agent protocol integration analysis
- Babylon integration (staking, timestamping)
- Claude frontend design skill research
- ElizaOS integration analysis
- Gastown integration (payment streaming)
- Human UI deep research

### Other Documents

- `AGENT-RUNTIME-INTEGRATION.md` - Integration spec for autonomous agents

## Why Archive These?

**Scope Refocus:** After successfully implementing the core ILP-gated relay (Epics 1-10), the project refocused on its original mission rather than expanding into agent runtimes, computation marketplaces, and git collaboration.

**Current Mission:** Crosstown is a **protocol library** for ILP-gated Nostr relays with peer discovery, SPSP negotiation, and bootstrap services. The core functionality is complete and published to npm.

**Future Consideration:** These documents may be valuable for:
- Future projects that want to build on Crosstown's foundation
- Reference implementations of advanced Nostr+ILP patterns
- Understanding the original vision and potential expansion paths

## What Remains Active

📂 **docs/epics/** - Epics 1-10 (implemented features)
📂 **docs/stories/** - Stories 1.x-10.x (60 implemented stories)
📂 **docs/research/** - NIP use cases research (relevant to core protocol)
📂 **docs/architecture/** - Current system architecture
📂 **docs/prd/** - Product requirements (to be updated to v3.0)
📄 **docs/prd.md** - Main PRD (to be updated to reflect implemented scope)

## Archive Contents

```
archive/
├── epics/           # 7 unimplemented epics (11-17)
├── stories/         # 5 stories from Epic 11
├── research/        # 14 research documents for agent/UI features
├── AGENT-RUNTIME-INTEGRATION.md
└── README.md        # This file
```

---

**Note:** Nothing was deleted - all documentation is preserved here for future reference.
