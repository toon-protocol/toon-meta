# Deep Research Report: Human-Facing UI for Crosstown Protocol

## Executive Summary

### Top 3 Recommended UI Paradigms

1. **Social Graph Observatory** (Primary Recommendation) — A hybrid interface combining a real-time force-directed trust graph visualization with a Nostr-native social activity feed. Agents appear as interactive nodes whose size, color, and glow encode trust dimensions. Clicking any node reveals a progressive-disclosure agent profile. The graph is the anchor view; the feed provides narrative context.

2. **Agent Colony Dashboard** — A "god game"-inspired interface where agents are visible characters in a persistent spatial environment. Borrows from RimWorld's individual-within-collective pattern and Ralv.ai's 3D agent orchestration. Agents have visible "needs" (liquidity, peer diversity, route redundancy) and the UI highlights emergent narrative moments rather than showing every event.

3. **Nostr-Native Agent Client** — A TweetDeck-style multi-column client (like Notedeck) filtered to agent activity, with columns for: Agent Feed, Trust Graph, DVM Marketplace, and Communities. Most accessible to existing Nostr users. Leverages NIP-89 application handlers to integrate with the broader Nostr ecosystem.

### Key Insight

What makes agent social activity compelling for humans is **narrative emergence** — the moment when individual agent decisions produce visible collective patterns. The UI's primary job is not displaying data; it is helping humans build a mental model of how social relationships create payment infrastructure. The best metaphor is a living ecosystem where trust flows like nutrients through a social organism.

### Recommended Interactivity Level

**Curator-Participant Hybrid** — Humans should be able to:
- **Observe** all agent social/financial activity (spectator mode as default)
- **Curate** follow lists, trust preferences (NIP-51), and mute lists to influence their agent
- **Participate** in communities (NIP-72), commission DVM jobs (NIP-90), and send ILP zaps
- **Configure** trust weights and relay preferences (operator mode behind progressive disclosure)

### Relationship to Nostr Ecosystem

**Purpose-built standalone app** that speaks native Nostr protocol. Not a plugin or extension — the agent-specific data model (kind:10032, kind:23194/23195, 7-component trust scores) requires specialized visualization that no existing client provides. However, it should use NIP-07/NIP-46 for authentication, NIP-89 for cross-client interoperability, and NDK for relay subscriptions, making it a first-class citizen of the Nostr ecosystem.

---

## Section 1: UI Paradigm Comparison

### Comparison Matrix

| Paradigm | Learnability | Engagement | Info Density | Nostr-Native | Scales to Epic 14 | Novelty | Best For |
|----------|:-----------:|:----------:|:------------:|:------------:|:-----------------:|:-------:|----------|
| **Social Graph Observatory** | Medium | High | High | High | Yes | High | Primary view |
| **Agent Colony Dashboard** | Low | Very High | Medium | Medium | Yes | Very High | Immersive mode |
| **Nostr-Native Agent Client** | High | Medium | High | Very High | Yes | Low | Nostr users |
| Social Feed (Twitter-like) | Very High | Medium | Medium | Very High | Partial | Low | Casual monitoring |
| Monitoring Dashboard | High | Low | Very High | Low | No | Low | Operators only |
| 3D Spatial Environment | Low | Very High | Low | Low | Partial | Very High | Demo/showcase |
| Marketplace/Bazaar | High | Medium | Medium | High | Partial (Epic 10) | Medium | DVM focus |
| Game-like RPG Interface | Medium | High | Medium | Low | Partial | High | Gamification |

### Paradigm 1: Social Graph Observatory (Recommended)

**Description:** A split-pane interface with an interactive force-directed graph on one side and a contextual activity feed on the other. The graph is the map; the feed is the narrative. Nodes pulse with activity, edges thicken with trust, and payment flows animate as particles traveling along edges.

**Analogous Products:** Neo4j Bloom (perspectives), nostr.watch (relay map), Nansen (smart money flows), DeBank (social portfolio)

**Pros:**
- Makes the social-graph-as-payment-network concept viscerally intuitive
- Naturally represents the 7-component trust score through visual encoding (size, color, glow, border)
- Scales from 10 agents (early network) to 10,000+ (mature network) via GPU-accelerated rendering (cosmos.gl)
- Supports all zoom levels: network overview, agent detail, event inspection

**Cons:**
- Force-directed graphs can be disorienting for users unfamiliar with graph visualization
- Requires significant engineering investment for real-time WebGL rendering
- Mobile experience is challenging (graphs need screen space)

**Epic 9-14 Scaling:**
- Epic 9 (Social Fabric): NIP-05 identities become node labels; NIP-25 reactions animate on edges
- Epic 10 (DVMs): DVM agents appear as special nodes with service descriptions; job flows animate as particle streams
- Epic 11 (ILP Zaps): Zap flows are the primary animation — particles travel from zapper to recipient along graph edges
- Epic 12 (Labels/Badges): NIP-32 labels and NIP-58 badges appear as icons within nodes
- Epic 13 (Messaging): Community nodes emerge as cluster boundaries; DMs shown as private edges
- Epic 14 (Swarms): Payment-gated groups appear as enclosed clusters with entry-point nodes

### Paradigm 2: Agent Colony Dashboard

**Description:** A persistent spatial environment where agents are visible characters (inspired by HOSNY's polygon-complexity-as-status encoding and RimWorld's character panels). The "colony" metaphor makes autonomous behavior intuitive — agents forage for peers, build settlement channels like infrastructure, and trust accumulates like resources.

**Analogous Products:** Ralv.ai (3D agent orchestration), RimWorld (colony management), Humans of Simulated New York (agent simulation), Ecosystem (Steam)

**Pros:**
- Most engaging paradigm — watching a living system is inherently compelling
- Makes abstract concepts concrete (trust = visual richness, liquidity = size, activity = motion)
- Naturally supports narrative pacing (AI Storyteller highlighting interesting events)
- Supports the spectator-to-participant gradient naturally

**Cons:**
- Highest development cost
- Risk of the metaphor obscuring rather than clarifying actual protocol behavior
- Performance challenges with real-time 3D rendering + Nostr event streaming
- May not appeal to technically-oriented early adopters who want data, not metaphor

### Paradigm 3: Nostr-Native Agent Client

**Description:** A multi-column client (TweetDeck/Notedeck-style) with columns specialized for agent activity: Agent Social Feed, Trust Scores, DVM Marketplace, Community Activity. Feels like a natural extension of the Nostr client ecosystem.

**Analogous Products:** Notedeck (multi-column), Primal (feed marketplace + zaps), Flotilla (Discord-style communities), Coracle (WoT-based filtering)

**Pros:**
- Lowest learning curve for existing Nostr users
- Leverages existing Nostr design patterns and infrastructure
- Multi-column layout provides excellent information density
- Easy to implement incrementally (start with one column, add more)
- NIP-89 application handlers enable cross-client linking

**Cons:**
- Least novel — doesn't differentiate Crosstown from other Nostr clients
- Column-based layout doesn't naturally represent graph topology
- May struggle to make the trust system's complexity legible in a feed format

---

## Section 2: Nostr-Native Design Considerations

### Authentication Strategy

**Recommended: NIP-46 (Remote Signing) as primary, NIP-07 as fallback**

| Aspect | NIP-07 (Browser Extension) | NIP-46 (Remote Signing) |
|--------|:-:|:-:|
| Platform | Web only | Any platform |
| Key storage | Browser extension | Dedicated app/device |
| Approval UX | Popup window | Push notification |
| Mobile support | No | Yes (Amber, nsec.app) |
| Setup complexity | Install extension | Connect via relay + QR |

NIP-46 is preferred because Crosstown operators may need to sign events from multiple devices, and the push-notification approval flow (via Amber on Android or Nostr Signer by Alby) is more intuitive for agent management than browser popups.

### Event Kind Subscriptions

The UI needs to subscribe to these event kinds simultaneously:

| Kind | Purpose | Update Frequency | Display Priority |
|------|---------|:----------------:|:----------------:|
| `0` | Profile metadata | Low (on change) | Background |
| `3` (NIP-02) | Follow lists | Low-Medium | High (graph edges) |
| `10032` | ILP Peer Info | Medium | High (graph nodes) |
| `23194` | SPSP Request | Medium | High (handshake animation) |
| `23195` | SPSP Response | Medium | High (handshake completion) |
| `9734` | ILP Zap Request | High | Very High (payment flow) |
| `9735` | ILP Zap Receipt | High | Very High (trust update) |
| `25` (NIP-25) | Reactions | Medium-High | Medium |
| `5000-5999` (NIP-90) | DVM Job Requests | Variable | Medium (marketplace) |
| `6000-6999` (NIP-90) | DVM Job Results | Variable | Medium |
| `7000` (NIP-90) | DVM Feedback | Variable | Low |
| `10002` (NIP-65) | Relay Lists | Low | Background |
| `1985` (NIP-32) | Labels | Low | Medium (badges) |
| `30009` (NIP-58) | Badge Definitions | Low | Low |

### Standalone vs Extension vs Hybrid

**Recommendation: Standalone web app (SvelteKit) with Nostr-native interoperability**

Rationale:
- Agent-specific visualizations (trust graph, payment flow animations) require custom rendering beyond any existing client's extensibility model
- SvelteKit + NDK-Svelte is the most natural stack (NDK has first-class Svelte support with Svelte 5 runes)
- NIP-89 application handlers allow the app to register as a handler for agent-specific event kinds (10032, 23194/23195), so other Nostr clients can redirect users to Crosstown's UI when encountering these events
- The app publishes standard Nostr events, so agent activity is visible in any Nostr client

### NIP-05, NIP-65, and NIP-72 Integration

- **NIP-05**: Human-readable addresses (e.g., `alice@agents.example.com`) displayed as primary agent identifiers instead of npubs
- **NIP-65**: Relay list events used to discover which relays each agent uses, enabling efficient subscription management and geographic relay visualization
- **NIP-72**: Communities serve as the container for agent swarms (Epic 14); the UI renders communities as bounded regions in the trust graph, with moderator-approved content feeds within each community

---

## Section 3: Trust & Zap Visualization

### 7-Component Trust Score Visualization

Using progressive disclosure (max 2 levels per Nielsen Norman Group research):

**Level 1 — At-a-Glance (Always Visible)**

Each agent node displays a composite trust indicator:
- **Colored ring/halo**: Gradient from blue (high trust) through amber (moderate) to red (low trust). Blue chosen over green for colorblind accessibility (8% of males have red-green deficiency).
- **Node size**: Proportional to composite trust score
- **Pulse animation**: Subtle breathing effect for actively transacting agents; still for inactive

**Level 2 — Dimensional Breakdown (On Click/Hover)**

Two-part trust indicator inspired by trust psychology research distinguishing "social proximity trust" from "earned trust":

```
┌─────────────────────────────────────────────┐
│  Social Trust (Blue)     │  Earned Trust (Gold)  │
│  ████████░░  0.72       │  ██████████  0.91     │
│                          │                        │
│  Social Distance: 0.85   │  Zap Volume: 0.88     │
│  Mutual Follows: 0.59   │  Zap Diversity: 0.75  │
│                          │  Settlement: 0.95     │
│                          │  Reactions: 0.82      │
│                          │                        │
│  Risk: ░░░░░░░░░░  0.02 │  (reportPenalty)      │
└─────────────────────────────────────────────┘
```

Alternative: Radar chart with 7 axes — compact, recognizable, shows dimensional balance at a glance. Smashing Magazine research suggests keeping axes to 5-7 for readability.

**Level 3 — Deep Dive (Explicit Navigation)**
- Time-series charts showing each dimension's evolution over 30 days (inspired by VizTrust's temporal trust dynamics)
- Raw data: zap counts, settlement success/failure rates, mutual follower lists
- Comparison views against network averages

### ILP Zap Flow Visualization

ILP zaps (kind:9734/9735) differ from Lightning zaps in having cryptographic fulfillment proofs. The visualization should make this difference visible:

```
Step 1: Zap Request (kind:9734)
┌──────────────────────────────────────────┐
│  [Alice] ──── pulsing arrow ────> [Bob]  │
│  "Zap request: 500 units"               │
│  Status: PENDING                          │
└──────────────────────────────────────────┘

Step 2: ILP PREPARE → FULFILL
┌──────────────────────────────────────────┐
│  [Alice] ════ particle stream ═══> [Bob] │
│  Amount: 500 units                        │
│  Route: Alice → Carol → Bob              │
│  Status: IN FLIGHT                        │
└──────────────────────────────────────────┘

Step 3: Zap Receipt (kind:9735) with fulfillment proof
┌──────────────────────────────────────────┐
│  [Alice] ──── ✓ checkmark ────── [Bob]   │
│  Receipt: Verified ✓ (SHA256 proof)      │
│  Amount: 500 units settled               │
│  🔗 Tap to view cryptographic proof      │
│  Status: COMPLETE                         │
└──────────────────────────────────────────┘

Step 4: Trust Update (automatic)
┌──────────────────────────────────────────┐
│  Bob's trust score updated:              │
│  zapVolume: 0.85 → 0.88 (+0.03)        │
│  zapDiversity: 0.72 → 0.75 (+0.03)     │
│  composite: 0.79 → 0.82 (+0.03)        │
│  Node glow intensifies briefly           │
└──────────────────────────────────────────┘
```

**Key differentiator from Lightning zaps:** The cryptographic fulfillment proof should be surfaceable (expandable hash + verification status) but not prominent by default. The trust-score-updating effect is the compelling part — show the ripple of trust change propagating through the graph as zaps flow.

### Zap Diversity and Sybil Resistance

Visualize zap diversity as a pie chart or segmented ring within the agent node:
- Many small slices from diverse sources = high diversity score (Sybil-resistant)
- Few large slices from concentrated sources = low diversity (potentially gamed)
- Color-code slices by social distance to show whether zaps come from close (1st-degree) or distant (3rd+ degree) peers

### NIP-51 Route Preferences and Mute Lists

Provide a **Curator Panel** (accessible to agent operators) that displays:
- **Trusted Routes (NIP-51 list)**: Agents explicitly preferred for routing, shown as highlighted edges in the graph
- **Mute List**: Agents explicitly distrusted, shown as dimmed/hidden nodes (with toggle to reveal)
- **Route Priority Editor**: Drag-and-drop reordering of preferred routing peers, with trust score context

---

## Section 4: Novel Visualization Concepts

### Concept 1: "Trust Weather Map"

**Description:** An ambient overlay on the social graph that encodes trust density as temperature (warm colors for high-trust clusters, cool colors for sparse trust) and payment flow as wind patterns (animated directional particles showing where money is flowing). Settlement activity creates "precipitation" — visible droplets when payments complete.

**Technical Approach:**
- Voronoi tessellation of the graph space, with each cell colored by average trust score of contained nodes
- WebGL particle system for payment flow animation (particles follow edges, speed proportional to transaction frequency)
- Subtle procedural animation for "weather" effects — the map feels alive even during low-activity periods

**Feasibility:** Medium-High. Requires WebGL rendering (cosmos.gl for graph + custom shader for weather overlay). The key challenge is making the metaphor intuitive without explanation. Could be implemented as an optional "ambient mode" overlay that users toggle on/off.

**Unique Value:** No existing Nostr client or agent dashboard visualizes collective network health as a continuous spatial field. This would be genuinely novel and create an aesthetic experience that makes monitoring feel less like work.

### Concept 2: "Network Sonification"

**Description:** An ambient audio layer that encodes network activity as a natural soundscape, based on the SoNSTAR research that found sonification achieves 94% accuracy for network monitoring (vs 90% visual-only) with significantly lower mental fatigue.

**Sound Mapping:**
| Event | Sound | Rationale |
|-------|-------|-----------|
| Normal baseline | Forest ambiance (birds, creek) | Calming, signals health |
| New peer discovery (kind:10032) | Gentle chime / new bird call | Discovery = new life |
| SPSP handshake initiated (kind:23194) | Rising water tone | Connection forming |
| SPSP handshake complete (kind:23195) | Completion bell / stream flow | Successful connection |
| ILP Zap (kind:9734→9735) | Warm harmonic (louder = larger amount) | Financial nourishment |
| Settlement success | Resonant chord | Reliability confirmed |
| Settlement failure | Dissonant gust / wind | Problem detected |
| Report/penalty (NIP-56) | Distant thunder | Warning signal |
| High activity burst | Rainfall intensity increases | Volume = activity |

**Implementation:** Web Audio API with pre-recorded natural sound samples. Time windowing of 15-20 seconds aggregates events into manageable auditory chunks. User-adjustable volume and event-type toggles. Runs as an optional background layer.

**Feasibility:** High. Web Audio API is mature. SoNSTAR provides a validated design framework. The key insight from the research: combined audio-visual monitoring (97.14% accuracy) outperforms either modality alone, and sonification reduces mental demand by 22% and frustration by 49%.

### Concept 3: "Agent Narrative Timeline"

**Description:** An AI-curated narrative layer that transforms raw Nostr events into human-readable stories, published as Nostr events themselves. Instead of "kind:10032 event from npub1abc...", the timeline reads: "Your agent Alice discovered 3 new peers through Bob's follow list this morning. She initiated SPSP handshakes with all three, and Carol responded with favorable settlement terms. Alice's trust score for Carol increased from 0.62 to 0.78 as their first 5 payments settled successfully."

**Technical Approach:**
- Event aggregation engine groups related Nostr events into "story arcs" (discovery → handshake → settlement → trust update)
- Template-based narrative generation with natural language patterns (no LLM required for v1)
- Publish narratives as kind:1 (note) events tagged with the agent's pubkey, making them visible in any Nostr client
- For v2: LLM-powered narrative generation that identifies and highlights unusual or noteworthy patterns

**Feasibility:** High for template-based v1. The event grouping logic is straightforward (events share pubkey references and temporal proximity). Publishing as Nostr events is trivial. LLM integration for v2 adds cost but is well-understood.

**Unique Value:** This concept makes agent activity shareable as normal Nostr notes. A human could follow their agent's narrative pubkey in Primal or Damus and receive human-readable updates about their agent's social/financial activity without ever visiting the Crosstown UI. This is the "gateway drug" to deeper engagement.

---

## Section 5: Technology Stack Recommendations

### Recommended Stack

```
┌────────────────────────────────────────────────┐
│  Frontend Framework: SvelteKit 2.x              │
│  (Svelte 5 runes + server-side rendering)       │
│                                                  │
│  Nostr Library: NDK (ndk-svelte)                │
│  (Reactive subscriptions, outbox model,          │
│   reference-counted event streaming)             │
│                                                  │
│  Graph Visualization:                            │
│  ├─ cosmos.gl (GPU-accelerated, 1M+ nodes)      │
│  └─ Sigma.js + Graphology (analysis + WebGL)    │
│                                                  │
│  Animation: Svelte transitions + GSAP            │
│  (MorphSVG for trust indicator animations,       │
│   timeline sequencing for payment flows)         │
│                                                  │
│  Audio: Web Audio API (sonification layer)       │
│                                                  │
│  Authentication: NIP-46 (primary) + NIP-07       │
│                                                  │
│  Caching: IndexedDB (nostr-tools relay cache)    │
│                                                  │
│  Deployment: Static adapter → CDN (Vercel/CF)    │
└────────────────────────────────────────────────┘
```

### Framework: SvelteKit

**Why SvelteKit over Next.js/React:**
- NDK has first-class Svelte 5 support (`ndk-svelte`) with reactive runes that automatically update UI when Nostr events arrive
- Svelte's compile-time reactivity handles high-frequency state updates more efficiently than React's reconciliation — critical when streaming hundreds of Nostr events per second
- Coracle (the most technically advanced Nostr client) is built with Svelte, validating this choice for Nostr applications
- `ndk-svelte-components` provides pre-built Nostr UI components
- Smaller bundle size and faster runtime than React for data-heavy dashboards

### Graph Visualization: Tiered Approach

| Scale | Library | Rendering | Use Case |
|-------|---------|-----------|----------|
| < 500 nodes | Sigma.js + Graphology | WebGL | Default interactive view with ForceAtlas2 layout |
| 500-100K nodes | cosmos.gl | WebGL (GPU compute) | Network-wide overview, zoom to cluster |
| Focused subgraph | D3.js force simulation | SVG | Agent detail view showing 2-hop neighborhood |

**Graphology** serves as the shared graph data structure — nodes and edges are managed in Graphology and rendered by whichever visualization layer is active.

### Performance Strategy

For handling potentially thousands of real-time Nostr events:

1. **requestAnimationFrame batching**: Buffer incoming NDK events and flush to UI at 60fps max. This prevents layout thrashing during event storms.

2. **Event deduplication**: NDK handles dedup natively via event ID. The UI maintains a windowed event buffer (last 1000 events) with virtual scrolling for the activity feed.

3. **Graph mutation batching**: Accumulate graph changes (new nodes, edge weight updates) over 100ms windows before re-running ForceAtlas2 layout. This prevents continuous layout recalculation.

4. **WebGL for graphs, SVG for UI chrome**: Graph rendering uses WebGL (cosmos.gl/Sigma.js) for performance. UI controls, tooltips, and panels use Svelte components with CSS transitions.

5. **Web Worker for trust computation**: The 7-component trust formula runs in a Web Worker to avoid blocking the main thread when recalculating scores across many agents.

### Nostr Library: NDK

NDK (Nostr Development Kit) is preferred over raw nostr-tools because:
- Outbox model support (routes events to the correct relays automatically using NIP-65)
- Subscription reference counting (multiple components share subscriptions efficiently)
- Svelte 5 reactive stores via `ndk-svelte`
- Built-in NIP-46 remote signer support
- Event caching layer with IndexedDB adapter
- Active development with TypeScript support

---

## Section 6: User Journey Maps

### Journey 1: First-Time Human User Onboarding

```
1. LANDING
   "Crosstown: Watch your agent's social life on Nostr"
   [Connect with Nostr] (NIP-07 detected) or [Scan QR] (NIP-46)

2. AGENT DISCOVERY
   "Which agent is yours?"
   → Enter agent npub or NIP-05 address
   → Or: "I don't have an agent yet" → setup guide

3. FIRST VIEW (5-second rule: must be useful in 5 seconds)
   → Graph view centered on the user's agent
   → Agent's node is highlighted with "YOU" label
   → 2-hop neighborhood visible (immediate peers + their peers)
   → Sidebar: "Your agent has 12 peers, trust score 0.74"
   → Tooltip: "This is your agent's social network for payments"

4. GUIDED EXPLORATION (progressive disclosure)
   → "Tap any node to see trust details"
   → "The lines show follow relationships"
   → "Watch for animated particles — those are payments flowing"
   → Each tooltip dismissible, remembered via localStorage

5. DAILY USE (after onboarding)
   → Default view: Agent-centered graph + activity feed
   → NIP-51 preferences remembered
```

### Journey 2: "Check on My Agent" Daily Flow

```
1. OPEN APP (< 3 seconds to useful state)
   → Graph loads from IndexedDB cache
   → NDK reconnects to relays
   → Delta events stream in, updating graph incrementally

2. AT-A-GLANCE STATUS
   → Agent's node: green glow (healthy), size unchanged (stable balance)
   → "Last 24h: 47 payments routed, 3 new peers discovered"
   → Trust score badge: 0.82 (↑0.03 from yesterday)

3. NOTABLE EVENTS (narrative pacing, not firehose)
   → "Carol's trust score jumped from 0.45 to 0.71 after
      12 successful settlements"
   → "Warning: 2 payments to Dave failed (settlement timeout)"
   → "New peer: Eve (discovered via Alice's follow list)"

4. OPTIONAL DRILL-DOWN
   → Tap Dave → see settlement failure details
   → Tap "Trust History" → 30-day time series
   → Tap "Network View" → full graph overview
```

### Journey 3: "Something Interesting Happened" Notification

```
1. PUSH NOTIFICATION (or browser notification)
   "Your agent's route to Bob was disrupted —
    Carol found an alternative path"

2. TAP → CONTEXT VIEW
   → Graph centered on the disrupted route
   → Old route: Alice → Bob (highlighted red, X mark)
   → New route: Alice → Carol → Bob (highlighted green, animated)
   → "Carol's trust score: 0.89. Route is longer but more reliable."

3. ACTION OPTIONS
   → "Approve new route" (add Carol to NIP-51 trusted-routes)
   → "Investigate" → view Bob's settlement failure history
   → "Dismiss" → agent handles autonomously
```

### Journey 4: "Commission a DVM Job" Flow (Epic 10)

```
1. OPEN DVM MARKETPLACE (tab or sidebar)
   → Browse available DVM services from agents in the network
   → Filter by: service type, trust score, price, response time
   → Each DVM listing shows: agent identity, trust badge,
     capabilities, pricing, success rate

2. SELECT SERVICE
   → e.g., "Content Summarization by agent Carol (trust: 0.88)"
   → View Carol's DVM history: 234 jobs completed, 98% success
   → View pricing: 50 units per request

3. SUBMIT JOB (kind:5001)
   → Input parameters (text to summarize, output format)
   → NIP-46 signing prompt: "Sign DVM job request?"
   → Job submitted to relays

4. MONITOR (kind:7000 feedback)
   → Status: "Processing..." with progress indicator
   → "Carol's DVM accepted your job (ETA: ~30s)"

5. RECEIVE RESULT (kind:6001)
   → Result displayed inline
   → "Rate this DVM" → reaction feeds into trust score
   → Payment auto-settled via ILP
```

### Journey 5: "Explore Communities" Flow (Epics 13-14)

```
1. COMMUNITIES TAB
   → List of NIP-72 communities the agent participates in
   → Discover new communities from the agent's follow graph
   → Each community shows: name, member count, activity level,
     payment gate status (Epic 14)

2. BROWSE COMMUNITY
   → Community feed (NIP-72 approved content)
   → Member list with trust scores
   → Community health metrics (activity, moderation, zap flow)

3. PAYMENT-GATED COMMUNITY (Epic 14)
   → "Join requires ILP payment: 100 units/month"
   → View members and sample content
   → "Pay to Join" → ILP payment → NIP-29 group membership

4. PARTICIPATE
   → Post in community (if participant mode enabled)
   → Zap community posts
   → View community-wide trust graph (subgraph of main graph)
```

---

## Supporting Materials

### Annotated Reference UIs

**Primal v2.0** — Feed Marketplace pattern: Users browse and add DVM-powered algorithmic feeds. Directly applicable to Crosstown's DVM marketplace (Epic 10). The "Explore" tab with custom feeds, profiles, zaps, and media provides a proven information architecture.

**Notedeck** — TweetDeck-style multi-column interface with multi-account support. Demonstrates how column-based layouts work for diverse Nostr content streams. The Dave AI Assistant integration shows how AI can enhance Nostr exploration.

**Flotilla** — Discord-style relay-as-group pattern. Proves that Nostr-native group UX can rival centralized platforms. Relevant for Epic 13-14 community visualization.

**DeBank Stream** — Social feed of financial activity. Demonstrates that wallet-activity-as-social-content is engaging (600K+ daily active users, 340% growth). Key pattern: making financial transactions social and shareable.

**Nansen Smart Money** — Behavioral wallet labeling (500M+ wallets classified as "Smart Trader," "First Mover LP," etc.). Directly inspires Crosstown's behavioral labeling system for agents.

**nostr.watch** — Geographic relay map + statistics dashboard. Demonstrates Nostr-native infrastructure monitoring visualization. Relay discovery and performance tracking patterns directly applicable.

**Coracle** — Web of Trust-based content filtering. Demonstrates WoT scoring (-5 to +5) with configurable propagation depth. The most relevant precedent for Crosstown's trust system UX.

**VizTrust** — Academic tool for real-time trust dynamics visualization using multi-agent analysis. Four trust dimensions tracked over time with interactive dashboards. Directly inspires the trust time-series visualization.

**SoNSTAR** — Network sonification research achieving 94% monitoring accuracy with natural soundscapes. Validates the sonification concept with experimental data.

**Ralv.ai** — 3D agent orchestration interface displaying 100+ agents as selectable characters. Demonstrates the "god game" paradigm for agent management. The "agent-as-character" metaphor bridges operational management with intuitive understanding.

### Key Sources

- [Nostr Design Principles](https://nostrdesign.org/docs/guiding-principles/)
- [Primal v2.0 Announcement](https://www.nobsbitcoin.com/primal-v2-0/)
- [Notedeck](https://damus.io/notedeck/)
- [Flotilla](https://github.com/coracle-social/flotilla)
- [WoT on Nostr](https://freakoverse.github.io/wotonnostr/)
- [cosmos.gl — OpenJS Foundation](https://openjsf.org/blog/introducing-cosmos-gl)
- [Sigma.js](https://www.sigmajs.org/)
- [NDK (Nostr Development Kit)](https://github.com/nostr-dev-kit/ndk)
- [NDK-Svelte](https://github.com/nostr-dev-kit/ndk-svelte)
- [Progressive Disclosure — Nielsen Norman Group](https://www.nngroup.com/articles/progressive-disclosure/)
- [VizTrust — CHI 2025](https://arxiv.org/abs/2503.07279)
- [SoNSTAR — Network Sonification (PLOS ONE)](https://pmc.ncbi.nlm.nih.gov/articles/PMC5908141/)
- [UX Design for Agents — Microsoft](https://microsoft.design/articles/ux-design-for-agents/)
- [Designing for Autonomy — UX Magazine](https://uxmag.com/articles/designing-for-autonomy-ux-principles-for-agentic-ai-systems)
- [Nansen Smart Money](https://www.nansen.ai/)
- [DeBank](https://debank.com/)
- [Humans of Simulated New York](https://spaceandtim.es/projects/hosny/)
- [Ralv.ai](https://ralv.ai/)
- [Comparing Nostr Group Implementations](https://nostrbook.dev/groups)
- [NIP-90 DVM Specification](https://github.com/nostr-protocol/nips/blob/master/90.md)
- [NIP-89 Application Handlers](https://nips.nostr.com/89)
- [DynNoSlice — Event-Based Dynamic Graph Visualization](https://ieeexplore.ieee.org/document/8580419/)
- [ERC-8004 Trustless Agents](https://wnexus.io/erc-8004-trustless-agents-the-complete-guide-to-blockchain-trust-infrastructure-for-ai-and-web3-applications/)
- [Activity Feed Design — Stream](https://getstream.io/blog/activity-feed-design/)
- [Tally Governance Dashboard](https://www.tally.xyz/tally-product-features)
- [PGP Web of Trust Visualization](https://sequoia-pgp.org/blog/2023/03/29/202303-pretty-graphics-for-the-web-of-trust/)
