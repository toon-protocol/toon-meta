# Deep Research Prompt: Human-Facing UI for Crosstown Protocol

## Research Objective

Investigate and recommend the optimal UI paradigm and social-media-inspired visualization approach for **non-agent human users** to observe, understand, and interact with the **Nostr social layer** of Crosstown — a protocol where autonomous agents use Nostr social graphs for ILP peer discovery, trust derivation, and payment routing. The UI must make agent-to-agent social activity (follows, peer discovery, zaps, trust scores, DVMs, communities) legible and engaging for humans. **ILP connector internals (packet routing, balances, settlement mechanics) are out of scope** — those belong to the separate agent-runtime project.

## Background Context

### What Crosstown Is

Crosstown is the Nostr integration layer that bridges social relationships to Interledger Protocol. It does NOT route payments itself — it populates a separate ILP connector (agent-runtime) with peers, trust-derived credit limits, and route priorities discovered from the Nostr social graph.

### Architecture (Critical for Scoping the UI)

```
Human Users  ←──── THIS UI (what we're researching)
    │
    ▼
@crosstown/protocol (Nostr social layer)
  - Peer discovery via NIP-02 follow lists
  - SPSP handshakes via encrypted Nostr events
  - Trust scores from social graph + zaps + reputation
  - ILP-gated relay (pay-to-write, free-to-read)
    │
    │ populates (Admin API calls)
    ▼
agent-runtime (ILP connector - SEPARATE PROJECT, OUT OF SCOPE FOR THIS UI)
  - Routes ILP packets
  - Manages BTP connections
  - Handles settlement channels
  - Has its own admin/monitoring surface
```

### The 14-Epic Roadmap (All Potential UI Surface Area)

| Epic | Title | UI-Relevant Data |
|------|-------|-------------------|
| 1-5 | Foundation, SPSP, Trust, Relay, Docker | Peer graph, trust scores, relay events |
| 6 | Decentralized Peer Discovery | Bootstrap phases, peer sources (genesis, ArDrive, social) |
| 7-8 | Settlement Negotiation & Bootstrap | SPSP handshake events, channel opening notifications |
| **9** | **Social Fabric Foundation** | **NIP-05 identities, NIP-65 relay lists, NIP-25 reactions, NIP-09 deletions, NIP-56 reports** |
| **10** | **Paid Computation Marketplace (DVMs)** | **NIP-90 job requests/results, agent service listings, micropayment flows** |
| **11** | **ILP Zaps & Social Routing** | **kind:9734 zap requests, kind:9735 receipts with fulfillment proofs, trust score updates, NIP-51 route preference lists** |
| **12** | **Capability Labels & Credentials** | **NIP-32 labels (settlement reliability, throughput), NIP-58 badges** |
| **13** | **Private Messaging & Content** | **NIP-17 DMs, NIP-10 threads, NIP-18 reposts, NIP-23 paid articles, NIP-72 communities** |
| **14** | **Payment-Gated Agent Swarms** | **NIP-29 relay-based groups with payment membership gating** |

### ILP Zap Flow (Epic 11 — Critical Detail)

These are NOT Lightning zaps. They use ILP with cryptographic proof-of-payment:

```
Zapper → kind:9734 ILP zap request (with p=recipient, amount, relays)
       → ILP PREPARE (amount=zap, data=TOON-encoded request)
       → Recipient BLS validates, accepts payment
       ← ILP FULFILL (fulfillment=SHA256)
       → Recipient publishes kind:9735 receipt with fulfillment proof to relays
       → SocialTrustManager observes receipt → updates trust scores
```

Zaps feed into a 7-component trust formula: social distance, mutual followers, reaction score, zap volume, zap diversity, settlement reliability, and report penalty.

### Trust Score Formula (from Epic 11)

```
trustScore = w1*socialDistance + w2*mutualFollowers + w3*reactionScore
           + w4*zapVolume(30d) + w5*zapDiversity + w6*settlementReliability
           + w7*reportPenalty
```

Default weights: 0.25, 0.15, 0.1, 0.15, 0.1, 0.15, 0.1

### Nostr Ecosystem Context

Nostr clients already provide diverse social experiences: microblogging (Damus, Primal), long-form (Habla), marketplace (Plebeian Market), chat (0xchat), streaming (Zap.stream), communities (NIP-72). The Crosstown UI should feel native to this ecosystem while adding a unique lens on agent activity.

### Nostr Event Kinds Used by Crosstown

| Kind | Name | Purpose |
|------|------|---------|
| `10032` | ILP Peer Info | Replaceable event with connector's ILP address, BTP endpoint, settlement info |
| `23194` | SPSP Request | NIP-44 encrypted request for fresh SPSP parameters |
| `23195` | SPSP Response | NIP-44 encrypted response with SPSP destination_account and shared_secret |
| `9734` | ILP Zap Request | Zap request with ILP amount and relay targets |
| `9735` | ILP Zap Receipt | Zap receipt with fulfillment proof and trust signal |

---

## Research Questions

### Primary Questions (Must Answer)

1. **What social media paradigm best represents a network of autonomous agents performing social-financial activity on Nostr?**
   - A "feed" of agent social events (follows, zaps, DVM jobs, reactions) — like a Nostr client filtered to agent activity?
   - A spatial/graph visualization of the social trust network — where nodes pulse with zap activity and edges thicken with trust?
   - A "colony" or "ecosystem" metaphor — agents as organisms in a living system, where zaps are nourishment and trust is symbiosis?
   - A game-like interface — agent profiles as characters with stats (trust score, zap volume, settlement reliability)?
   - A marketplace/bazaar view — showcasing DVM capabilities (Epic 10), paid articles (Epic 13), gated communities (Epic 14)?
   - Something entirely novel that doesn't map to existing paradigms?

2. **How should the UI represent the rich, multi-layered trust system?**
   - Trust scores have 7 components with different weights — how to make this legible without overwhelming?
   - Zap volume and diversity are Sybil-resistant reputation signals — how to visualize "earned trust" vs "social proximity trust"?
   - NIP-51 trusted-routes and mute lists let agents curate their routing preferences — should humans see/edit these?
   - NIP-56 reports create negative trust signals — how to surface abuse prevention without creating a toxic experience?

3. **How should ILP zaps (kind:9734/9735) be presented differently from Lightning zaps?**
   - ILP zaps have cryptographic fulfillment proofs — is this a differentiator worth showing?
   - Zap receipts carry settlement chain info and ILP amounts — how much detail matters to a human?
   - Zaps feed trust scores in real-time — should the UI show the trust-score-updating effect of a zap?
   - Should humans be able to initiate zaps through the UI, or only observe agent-to-agent zaps?

4. **What novel visualization approaches could make the Nostr social graph + trust system intuitive?**
   - Animated trust score changes as zaps flow (receipts appear → trust components update → route priority shifts)?
   - "Reputation aura" or visual indicators that encode the multi-dimensional trust breakdown?
   - Time-lapse of network formation (bootstrap → peer discovery → zap accumulation → trust maturation)?
   - Sonification of network activity (distinct sounds for follows, zaps, DVM jobs, channel events)?
   - A "social weather map" where trust density = temperature and zap flow = wind patterns?

5. **How should the UI account for the full Epic 9-14 roadmap — especially DVMs (10), labels/badges (12), messaging (13), and swarms (14)?**
   - DVMs (Epic 10): Should the UI be an agent service marketplace where humans can browse and commission agent computations?
   - Labels/Badges (Epic 12): NIP-32 labels and NIP-58 badges as visual achievements/certifications on agent profiles?
   - Messaging (Epic 13): NIP-17 DMs and NIP-72 communities as social spaces where humans observe or participate alongside agents?
   - Swarms (Epic 14): Payment-gated NIP-29 groups — how to visualize coordinated agent collectives?

6. **What is the ideal level of human interactivity?**
   - **Spectator:** Pure observation of agent social/financial activity
   - **Curator:** Humans edit follow lists, trust preferences (NIP-51), mute lists to influence their agent's behavior
   - **Participant:** Humans post alongside agents in communities, send zaps, commission DVM jobs
   - **Operator:** Humans configure trust weights, bootstrap parameters, relay preferences
   - Should different user types get different views?

### Secondary Questions (Nice to Have)

7. **Should the UI be a standalone web app or a Nostr client extension/plugin?**
   - Could it be a "lens" or "filter" applied to existing Nostr clients like Primal or Coracle?
   - Or does the agent-specific data model require a purpose-built client?

8. **How to handle the dual identity — agents have Nostr keypairs but humans oversee them?**
   - First-person (see the network through your agent's eyes)?
   - Third-person (observe your agent as one node among many)?
   - Toggle between perspectives?

9. **What Nostr identity integration should the UI use?**
   - NIP-07 browser extension (nos2x, Alby)?
   - NIP-46 remote signing (Nostr Connect)?
   - NIP-05 human-readable addresses for display?

10. **Are there precedents for "spectator mode" UIs for autonomous agent systems?**
    - Multi-agent simulation viewers (NetLogo, Mesa)?
    - DAO dashboards (Colony.io, DAOhaus, Snapshot)?
    - AutoGPT/CrewAI observer interfaces?
    - DeFi social dashboards (DeBank social feed, Nansen Smart Money)?

11. **Could the UI create its own Nostr event kinds for human-readable agent activity narratives?**
    - e.g., "Your agent discovered 3 peers via Alice's follow list, zapped Bob 500 units, and trust score for Carol increased from 0.6 → 0.78"
    - This would make agent activity shareable as normal Nostr notes

---

## Research Methodology

### Information Sources

- **Nostr ecosystem**: NIP repository (especially NIPs 02, 05, 25, 32, 51, 57, 58, 65, 72, 90), existing client UIs (Primal, Damus, Snort, Coracle, Amethyst, Habla), relay dashboards, NIP-90 DVM clients
- **Social network visualization**: Academic papers on trust visualization, reputation systems UX, social graph rendering at scale
- **Agent/simulation UIs**: AutoGPT web, CrewAI dashboards, NetLogo, Mesa visualization, ant colony simulations, "god game" interfaces
- **DeFi social layers**: DeBank social feed, Nansen Smart Money, Zapper social, Friend.tech-style social finance
- **Novel UI paradigms**: Spatial computing, ambient displays, generative UI, data sonification, living system metaphors
- **Real-time data visualization**: D3.js force-directed graphs, Three.js WebGL, Svelte reactive rendering, WebSocket-driven dashboards
- **Reputation/trust UX**: eBay reputation display, Reddit karma visualization, Stack Overflow badge systems, Web of Trust visualizations

### Analysis Frameworks

- **Jobs-to-be-Done**: What "job" does a human hire this UI to do? (Monitor my agent? Understand the network? Build reputation? Commission work? Socialize with agents?)
- **Progressive Disclosure**: Layer complexity — "at-a-glance status" → "social feed" → "trust deep-dive" → "network topology"
- **Comparison Matrix**: Rate each UI paradigm on: learnability, engagement, information density, Nostr-nativeness, scalability across Epics 9-14, novelty
- **Spectator vs Participant Spectrum**: Map each paradigm to the interactivity level it naturally supports

---

## Expected Deliverables

### Executive Summary

- Top 2-3 recommended UI paradigms with rationale
- Key insight about what makes agent social activity compelling for humans
- Recommended interactivity level
- Relationship to existing Nostr client ecosystem

### Detailed Analysis

**Section 1: UI Paradigm Comparison**
- Comparison matrix of 5-8 paradigms rated across criteria
- For each: description, analogous products, pros/cons for Crosstown, mockup/wireframe concept
- Explicit consideration of how each paradigm scales from Epic 9 through Epic 14

**Section 2: Nostr-Native Design Considerations**
- How to leverage existing Nostr infrastructure (relays, event subscriptions, NIP-07/46 auth)
- Whether standalone app vs client extension vs hybrid
- How the UI subscribes to relevant event kinds (10032, 9734, 9735, NIP-90, etc.)
- How NIP-05 identities, NIP-65 relay lists, and NIP-72 communities integrate

**Section 3: Trust & Zap Visualization**
- Specific approaches for visualizing the 7-component trust score
- ILP zap flow visualization (request → payment → receipt → trust update)
- Zap diversity and Sybil resistance as visual concepts
- NIP-51 route preference and mute list management UI

**Section 4: Novel Visualization Concepts**
- 2-3 original ideas specific to "social graph as payment network with agent autonomy"
- Concept descriptions with enough detail for prototyping
- Technical feasibility for each

**Section 5: Technology Stack Recommendations**
- Framework and libraries for real-time Nostr event rendering + graph visualization
- Performance considerations (potentially thousands of real-time events)
- Nostr library integration (nostr-tools, NDK)

**Section 6: User Journey Maps**
- First-time human user onboarding
- "Check on my agent" daily flow
- "Something interesting happened" notification
- "Commission a DVM job" flow (Epic 10)
- "Explore communities" flow (Epics 13-14)

### Supporting Materials

- Annotated screenshots of referenced UIs
- Comparison matrices
- Conceptual wireframe descriptions

---

## Success Criteria

1. Identifies at least one UI paradigm that makes agent Nostr social activity **genuinely engaging** for humans — not just a monitoring dashboard
2. Properly scopes to the **Nostr/social layer** (not ILP internals)
3. Accounts for the **full Epic 9-14 roadmap** — the UI concept must scale to DVMs, badges, messaging, and swarms
4. Treats **ILP zaps (Epic 11)** as a first-class visualization concern with their unique proof-of-payment properties
5. Proposes at least one **novel** concept that goes beyond copying existing Nostr clients or dashboards
6. Provides enough specificity for a developer to start prototyping
7. Considers both Nostr-native users and potential mainstream onboarding

---

## Execution Guidance

This prompt is designed for deep research using AI with web search (Claude with web search, Perplexity Pro, ChatGPT Deep Research). Key search directions:

- "Nostr client UI design patterns 2025 2026"
- "NIP-90 DVM client interface marketplace"
- "social trust visualization reputation systems UX"
- "autonomous agent monitoring spectator UI"
- "social finance visualization friend.tech debank social"
- "force-directed graph real-time WebSocket visualization"
- "NIP-57 zap visualization Nostr clients"
- "god game simulation UI design living systems"
- "progressive disclosure complex data non-technical users"
- "NIP-72 community client Nostr groups UI"
- "multi-agent system observer dashboard"
- "novel social media visualization 2025 2026"
