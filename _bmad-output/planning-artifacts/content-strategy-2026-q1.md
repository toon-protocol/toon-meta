# TOON Protocol Content Strategy — 2026 Q1

**Date:** 2026-03-12
**Author:** Jonathan (with BMAD Party Mode collaboration)
**Status:** Approved
**Based on:** [AI Agent & Nostr Visibility Research](research/domain-ai-agents-nostr-visibility-research-2026-03-12.md)

---

## Strategic Objectives

1. **Establish existence** — Make TOON known to Nostr operators and AI agent developers
2. **Claim the narrative** — Own "ILP-gated relay" and "missing agent data layer" positioning
3. **Build community trust** — Be seen as one of them by Nostr and ILP communities
4. **Generate inbound** — Turn search/social discovery into developers using the protocol

---

## Platform Stack (Research-Validated)

### Tier 0: HOME BASE
**Hashnode with custom domain** (e.g., blog.toon.dev)
- Every article builds SEO equity for the TOON brand
- Canonical URL ownership — syndicated content credits us via Google
- Growing platform (+45% MoM), instant publish, Markdown-native, code syntax highlighting
- Publish on YOUR domain for free while distributing through the Hashnode network

### Tier 1: DOGFOODING + COMMUNITY CREDIBILITY
| Platform | Purpose | Key Insight |
|----------|---------|-------------|
| **Nostr (Habla.news / Primal)** | Publish every article as NIP-23 event | NIP-23 articles propagate across all Nostr clients automatically. Dogfooding is non-negotiable for authenticity. |
| **Stacker News** | Original deep-dives in `~nostr` and `~tech` territories | Original content gets 2.7x more engagement than link posts (22.1 vs 8.1 avg comments). Sats-based engagement = high signal. |
| **Interledger Community** | Case study posts + community call demo | 2,514 members who build ILP infrastructure. Monthly calls (2nd Wednesday, 4pm UTC). TOON is a novel ILP use case. |

### Tier 2: REACH + SEO
| Platform | Purpose | Key Insight |
|----------|---------|-------------|
| **Dev.to** | Cross-post from Hashnode using canonical URLs | ~15-20M monthly visits. `ai` is the #1 tag (18-23% of articles). DR 80+ SEO. 68% organic search traffic. Frame content as AI-agent-adjacent. Short-form (~5 min reads). |
| **HackerNoon** | Submit polished pieces for editorial review | ~1.8M monthly visits. Active Web3 writing contests ($2-5K prizes). **Uses Web Monetization powered by Interledger** — direct thematic connection. GPTZero labels AI-assisted content (not banned). 4+ day editorial review. |

### Tier 3: AMPLIFICATION
| Platform | Purpose | Key Insight |
|----------|---------|-------------|
| **Twitter/X** | Thread summaries of every article | Essential distribution channel for both Nostr and AI agent communities. Not a publishing platform, but THE amplification layer. |
| **Medium** | Syndicate non-paywalled summaries only | 104M monthly visits but paywall kills reach. No code support. Writer earnings in decline. Minimal effort syndication only. |

### Tier 4: HIGH-LEVERAGE OPPORTUNITIES
| Platform | Purpose | Key Insight |
|----------|---------|-------------|
| **The New Stack / InfoQ** | Pitch guest articles | Maximum credibility with senior engineers. Hard to get published, massive impact if accepted. |
| **ILF Community Call** | Demo TOON live | One-time high-impact event. Schedule after Article 3 drops. |
| **Podcasts** (Plebchain Radio, Bitcoin Fundamentals) | Guest appearances | High-leverage for awareness with Bitcoin/Nostr audience. |

### Deprioritized / Skip
| Platform | Reason |
|----------|--------|
| **Reddit r/nostr** | 4,104 subs, ~1 post/day, flat growth. Essentially dead. |
| **Medium (as primary)** | Paywall, no code support, declining developer relevance. Syndication only. |

---

## Content Pipeline (Per Article)

```
1. WRITE on Hashnode (canonical, SEO-optimized, full technical depth)
     ↓
2. PUBLISH on Nostr via Habla/Primal (NIP-23 event, dogfooding, zappable)
     ↓
3. ADAPT for Stacker News (original format, more conversational, earn sats)
     ↓
4. CONDENSE for Dev.to (5-min version, AI-agent framing, canonical → Hashnode)
     ↓
5. SUBMIT to HackerNoon (polished version, editorial review, contest-eligible)
     ↓
6. THREAD on X (key insights, link to Hashnode/Nostr)
     ↓
7. PRESENT at ILF call (for ILP-specific articles)
```

### Platform-Specific Formatting

| Element | Hashnode (canonical) | Dev.to (condensed) | Habla/Nostr | Stacker News | HackerNoon |
|---------|---------------------|-------------------|-------------|-------------|------------|
| Length | 2,000-3,000 words | 800-1,200 words | 1,500-2,500 words | 1,000-1,500 words | 2,000-3,000 words |
| Code examples | Full | Key snippets | Minimal | Minimal | Full |
| Diagrams | Architecture diagrams | 1 key diagram | Text-focused | None | Architecture diagrams |
| Tone | Technical depth | Quick-hit, AI-framed | Community-native | Conversational, economic | Polished thought leadership |
| CTA | GitHub repo + docs | Link to canonical | Zap if useful | Discussion prompt | Project link |

---

## Editorial Calendar

### Article 1: "95% of Nostr Relays Can't Cover Costs. Here's Why That Matters."
- **Week:** 1-2
- **Angle:** Problem-first. No mention of TOON until the very end (or not at all). Establish credibility by naming the pain.
- **Audience:** Nostr relay operators, Nostr developers
- **Platforms:** Habla.news (primary) → Stacker News (original) → X thread
- **Narrative role:** Sets the stage. Creates the "something must change" tension.
- **Tone:** Empathetic, data-driven. "You're not alone, and this problem has structural causes."
- **Key data points:** 95% relay unprofitability, 1,005 relays (343 offline), subscription models (nostr.wine ~$7/mo), one-time models (expensive-relay), none sustainable at scale

### Article 2: "The Missing Layer in the AI Agent Protocol Stack"
- **Week:** 3-4
- **Angle:** MCP handles tools. A2A handles agent-agent communication. x402/ILP handle payments. But where do agents write things down? There's a hole in the stack.
- **Audience:** AI agent developers, protocol engineers
- **Platforms:** Hashnode (canonical) → Dev.to (condensed, AI-tagged) → HackerNoon (polished submit) → X thread
- **Narrative role:** Names the gap. Positions TOON's category without selling it.
- **Tone:** Architectural, thought-provoking. "Here's what nobody's talking about."
- **Key data points:** $7.6B agent market at 40-46% CAGR, 1,445% surge in multi-agent inquiries, protocol stack diagram showing the gap

### Article 3: "Introducing TOON: An ILP-Gated Nostr Relay"
- **Week:** 5-6
- **Prereq:** README and docs must be polished before this drops
- **Angle:** The reveal. Here's what we built and why. Technical overview with architecture diagrams.
- **Audience:** Both audiences — the "aha" moment connecting Articles 1 and 2
- **Platforms:** Hashnode (canonical) → Habla.news → Dev.to → Stacker News → ILF Community post → X thread
- **Narrative role:** The resolution. "We built the thing that solves both problems."
- **Tone:** Technical but accessible. Show the architecture, explain the choices.

### Article 4: "ILP vs x402: Two Approaches to Machine Micropayments"
- **Week:** 7-8
- **Angle:** Honest technical comparison. Streaming payments (ILP) vs request-response (x402). When to use which.
- **Audience:** Protocol engineers, agent infrastructure developers
- **Platforms:** Hashnode (canonical) → HackerNoon (editorial submit) → Dev.to → X thread
- **Narrative role:** Thought leadership. Establishes technical credibility.
- **Tone:** Fair, balanced, deeply technical. "Here's how we evaluated both."
- **Key data points:** x402 115M machine micropayments but only ~$28K daily real volume, ILP streaming model advantages for continuous interactions

### Article 5: "Building an Agent That Writes to a Nostr Relay via ILP" (Tutorial)
- **Week:** 9-10
- **Angle:** Hands-on walkthrough. Code examples. Getting started guide.
- **Audience:** Developers who want to build on TOON
- **Platforms:** Hashnode (canonical) → Dev.to (tutorials recovering on platform) → X thread
- **Narrative role:** Activation. Turn readers into users.
- **Tone:** Step-by-step, code-heavy. "Ship something in 30 minutes."

### Article 6: "Why AI Agents Are the Next Wave of Nostr Users"
- **Week:** 11-12
- **Angle:** Bridge piece. Connects Nostr community with agent community. Shows how agents writing to relays via micropayments creates a sustainable relay economy.
- **Audience:** Both audiences simultaneously
- **Platforms:** Hashnode (canonical) → Habla.news → Stacker News → Dev.to → X thread
- **Narrative role:** Vision. "Here's where this is all going."
- **Tone:** Visionary but grounded. Data from research to back every claim.
- **Key data points:** 20% of B2B transactions agent-driven by 2026 (Gartner), $15T agent B2B purchases by 2028, 82.5% increase in Lightning-addressed Nostr profiles

---

## Narrative Arc

```
Problem          Problem         Solution        Credibility    Activation     Vision
(Nostr)          (Agents)        (TOON)     (ILP vs x402)  (Tutorial)     (Bridge)
  [1] ────────────[2] ───────────[3] ────────────[4] ───────────[5] ──────────[6]

  Habla/SN        Dev.to/HN      EVERYWHERE      HN/Dev.to      Dev.to        EVERYWHERE
  Week 1-2        Week 3-4       Week 5-6        Week 7-8       Week 9-10     Week 11-12
```

**ILF Community Call demo:** Schedule after Article 3 drops (week 6+), when context exists to point attendees to.

---

## Success Metrics

| Metric | Baseline (now) | 3-Month Target |
|--------|---------------|----------------|
| Hashnode blog monthly visits | 0 | 500+ |
| Dev.to article total reactions | 0 | 50+ per article |
| Stacker News sats earned | 0 | Consistent engagement signal |
| GitHub stars | Current | +25% |
| ILF community call demo | Not done | Completed |
| Nostr zaps on articles | 0 | Any consistent zapping |
| Inbound developer inquiries | 0 | First ones arriving |

**Leading indicator:** Article 3 click-through to GitHub. That's where intent converts to adoption.

---

## Prerequisites (Before Article 3)

1. **Set up Hashnode blog with custom domain** (~1 day)
2. **Polish README and getting-started docs** — docs are AI training data; this is highest-ROI content
3. **Ensure GitHub repo is presentable** — clear description, architecture diagram in README, contributing guide

---

## Content Principles

1. **Lead with problems, not solutions** — "95% of relays can't cover costs" > "use our ILP relay"
2. **Write for developers, not marketers** — Code examples, architecture diagrams, honest tradeoffs
3. **Leverage existing communities** — Post where people already are (Nostr, Dev.to, ILF)
4. **Keep content evergreen** — Architecture and fundamentals over implementation specifics
5. **Docs are AI-ready** — README and getting-started guide are highest-ROI content assets
6. **Dogfood the protocol** — Always publish on Nostr. The medium is the message.

---

## Research Sources

Full research document: [domain-ai-agents-nostr-visibility-research-2026-03-12.md](research/domain-ai-agents-nostr-visibility-research-2026-03-12.md)

Platform validation research conducted 2026-03-12 covering:
- Habla.news, YakiHonne, Primal, Highlighter, Postr (Nostr long-form clients)
- Dev.to (~15-20M monthly visits, AI #1 tag, DR 80+ SEO)
- HackerNoon (~1.8M monthly visits, editorial review, Web3 contests, ILP-powered Web Monetization)
- Hashnode (~442K monthly visits, +45% growth, custom domain, SEO ownership)
- Stacker News (niche Bitcoin/Nostr, sats-based engagement, 2.7x engagement for original content)
- Medium (104M visits but paywall kills reach, no code support, declining for devs)
- Interledger Community (2,514 members, monthly calls, Slack, perfect ILP audience)
- The New Stack / InfoQ (editorial publications, high credibility, hard to get published)
- Reddit r/nostr (dead — 4,104 subs, flat growth)
- Substack, Mirror.xyz, daily.dev (evaluated, secondary options)
