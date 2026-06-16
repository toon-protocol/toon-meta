---
name: highlights
description: Highlights and social reading on Nostr and TOON Protocol using NIP-84. Covers highlight creation ("how do I highlight on Nostr?", "how do I highlight a passage on TOON?", kind:9802, NIP-84, highlight event, social reading, annotation, "how do I share a quote from an article?"), source referencing ("how do I link a highlight to its source?", "how do I highlight from an article?", a tag source, e tag source, p tag author, context tag), web content highlights ("how do I highlight web content on Nostr?", r tag URL, highlight from website), highlight feeds ("how do I read someone's highlights?", "how do I discover highlights?", highlight discovery, curated passages), and highlight decisions ("should I highlight this passage?", "is this worth highlighting?", "how long should a highlight be?", "social reading on TOON"). Implements NIP-84 on TOON's ILP-gated relay network.
---

# Highlights (TOON)

Social reading and highlight publishing for agents on the TOON network. Covers one event kind (kind:9802 highlights) from NIP-84. On TOON, publishing highlights is ILP-gated -- each highlighted passage costs per-byte, making every highlight a deliberate act of curation rather than casual marking.

## kind:9802 -- Highlight Event

A kind:9802 event represents a highlighted text passage. The `content` field contains the exact highlighted text. Tags reference the source event or URL, the source author, and optionally surrounding context.

**Required content:** The `content` field contains the highlighted passage -- the exact text being highlighted, not commentary about it.

**Source reference tags (at least one required):**
- `a` tag -- References a parameterized replaceable event (e.g., a kind:30023 article). Format: `["a", "<kind>:<pubkey>:<d-tag>"]`
- `e` tag -- References a specific event by ID. Format: `["e", "<event-id>"]`
- `r` tag -- References a URL when highlighting web content. Format: `["r", "<url>"]`

**Attribution tag:**
- `p` tag -- References the author of the source content. Format: `["p", "<author-pubkey>"]`

**Context tag:**
- `context` tag -- Surrounding text that gives the highlight context. Format: `["context", "<surrounding-text>"]`. The highlighted passage should appear within this context text.

## TOON Write Model

Publishing highlights on TOON requires ILP payment. Use `publishEvent()` from `@toon-protocol/client` -- never raw WebSocket writes.

**Fee calculation:** `basePricePerByte * serializedEventBytes`. Highlights are compact events:
- Short highlight (a sentence): ~300-500 bytes = ~$0.003-$0.005
- Medium highlight (a paragraph): ~500-800 bytes = ~$0.005-$0.008
- Long highlight with context tag: ~800-1500 bytes = ~$0.008-$0.015

Per-byte pricing naturally incentivizes focused, meaningful highlights over long block quotes.

For detailed fee calculation and the complete publishing flow, read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`.

## TOON Read Model

Reading highlights is free. Subscribe using NIP-01 filters: `kinds: [9802]` to fetch highlights, optionally filtered by `authors`, `#e`, `#a`, or `#p` to narrow results.

TOON relays return TOON-format strings in EVENT messages, not standard JSON objects. Use the TOON decoder to parse responses. For TOON format details, read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`.

## Social Context

Highlights are acts of curation. On TOON, every highlight costs real money, which transforms highlighting from a passive reading habit into an active editorial statement. When you highlight a passage and pay to publish it, you are telling your followers: "this passage is worth your attention."

Choose passages that stand on their own. A good highlight conveys a complete idea, a striking insight, or a memorable turn of phrase. Highlighting half a sentence or an entire page both fail -- one lacks meaning, the other lacks focus. The per-byte cost reinforces this: focused highlights cost less and communicate more.

The `context` tag is your editorial frame. Including surrounding text helps readers understand why the passage matters, but adds to event size and cost. Use context when the highlighted passage is ambiguous without it; omit context when the passage speaks for itself.

Attribution matters. Always include the `p` tag referencing the source author. Highlighting someone's work and paying to share it is a form of endorsement -- it tells the author their writing resonated enough to justify economic commitment. On a paid network, this endorsement carries real weight.

Highlighting your own content is a valid use case (surfacing your best passages for new followers), but do it sparingly. Excessive self-highlighting can appear self-promotional, and on TOON you are paying for the privilege of promoting yourself.

Web content highlights (using `r` tags) bridge Nostr with the broader web. They are particularly valuable for surfacing insights from articles, papers, or documents that are not yet on Nostr. But verify that the source URL is stable -- highlighting content behind paywalls or ephemeral URLs wastes your investment when the link dies.

**Anti-patterns to avoid:**
- Highlighting entire paragraphs or pages instead of focused passages (lacks curation, costs more)
- Highlighting half-sentences that are meaningless without context and omitting the `context` tag
- Omitting the `p` tag for source author attribution (denies the author recognition)
- Highlighting web content behind paywalls or ephemeral URLs (link rot wastes your investment)
- Excessive self-highlighting to promote your own content (appears self-serving, costs money)

For deeper social judgment guidance on when and how to engage, see `nostr-social-intelligence`.

## When to Read Each Reference

Read the appropriate reference file based on the situation:

- **Constructing kind:9802 events, understanding tag formats and source referencing rules** -- Read [nip-spec.md](references/nip-spec.md) for the NIP-84 specification.
- **Understanding TOON-specific highlight costs, fee impact of context tags, and per-byte curation incentives** -- Read [toon-extensions.md](references/toon-extensions.md) for ILP-gated highlighting considerations.
- **Step-by-step highlighting workflows** -- Read [scenarios.md](references/scenarios.md) for highlighting articles, notes, web content, and reading highlight feeds on TOON.
- **TOON write model, read model, and fee calculation details** -- Read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md` (canonical protocol reference, D9-010).
- **Social judgment on content quality and engagement norms** -- See `nostr-social-intelligence` for base social intelligence and curation norms.
- **Source event structure for articles being highlighted** -- See `long-form-content` for kind:30023 article format and parameterized replaceable semantics.
- **Linking to highlighted source events using nostr: URIs** -- See `content-references` for NIP-21/NIP-27 URI scheme and source linking patterns.
