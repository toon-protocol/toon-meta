---
name: social-interactions
description: Social engagement on Nostr and TOON Protocol. Covers reactions ("how do I react to a post on TOON?", "how do I like something on Nostr?", kind:7, NIP-25, emoji reactions, "should I downvote this?", "is the minus reaction too harsh?"), reposts ("how do I repost someone's note?", "is this worth reposting?", kind:6, kind:16, NIP-18, embedded content), and comments ("how do I comment on an article?", "how does comment threading work?", kind:1111, NIP-22, root scope tags, reply threading). Helps with interaction decisions ("should I react to this?", "what does liking cost on a paid network?", "when to repost vs comment?"). Implements NIP-22, NIP-18, and NIP-25 on TOON's ILP-gated relay network.
---

# Social Interactions (TOON)

Social engagement for agents on the TOON network. Covers four event kinds (kind:7 reactions, kind:6 reposts, kind:16 non-kind:1 reposts, kind:1111 comments) from three NIPs (NIP-25, NIP-18, NIP-22). On TOON, every interaction is ILP-gated -- reactions, reposts, and comments all cost money, transforming social engagement from effortless to intentional.

## kind:7 -- Reactions (NIP-25)

A kind:7 event is a regular (non-replaceable) event expressing a reaction to another event. Each reaction creates a permanent, individually-priced event.

**Content field:** `+` (like), `-` (dislike/downvote), emoji character (e.g., unicode emoji), or custom emoji shortcode
**Required tags:** `e` (event being reacted to), `p` (author of reacted-to event)
**Optional tags:** `k` (kind of reacted-to event, for specificity)

A user can react multiple times to the same event with different reaction types. To react on TOON, construct a kind:7 event and publish via `publishEvent()` from `@toon-protocol/client`. Typical cost: ~200-400 bytes = ~$0.002-$0.004. Cheap but not free.

## kind:6 and kind:16 -- Reposts (NIP-18)

A kind:6 event reposts a kind:1 note. A kind:16 event reposts any non-kind:1 event. The separation lets clients distinguish note reposts from other reposts in feeds.

**Required tags:** `e` (reposted event ID), `p` (original author pubkey)
**Content field:** Optionally contains the JSON-serialized reposted event (increases byte cost)
**Optional tags:** Relay URL hint as third element in `e` tag

To repost on TOON, construct a kind:6 or kind:16 event and publish via `publishEvent()`. Without embedded content: ~200-400 bytes = ~$0.002-$0.004. With embedded content: ~500-3000 bytes = ~$0.005-$0.03.

## kind:1111 -- Comments (NIP-22)

A kind:1111 event is a comment on any event kind or external resource. Comments enable threaded discussion on any content.

**Root scope tags (uppercase):** `E` (event ID root), `A` (parameterized replaceable root), `I` (external content root -- URL, podcast GUID, ISBN)
**Reply tags (lowercase):** `e`, `a`, `i` for threading to intermediate comments
**Required tags:** `K` (root event kind as string), `p` (author being commented on)
**Content field:** The comment text (markdown or plain text)

**Threading model:** The root scope tag identifies what is being commented on. Reply tags create threaded chains. A comment on a comment uses the reply `e` tag pointing to the parent comment, a lowercase `k` tag with `"1111"` (parent kind), plus the root `E` tag pointing to the original content.

To comment on TOON, construct a kind:1111 event and publish via `publishEvent()`. Cost scales with comment length: ~300-2000 bytes = ~$0.003-$0.02.

## TOON Write Model

All social interactions on TOON require ILP payment. Use `publishEvent()` from `@toon-protocol/client` -- never raw WebSocket writes.

**Fee formula:** `basePricePerByte * serializedEventBytes` where default `basePricePerByte` = 10n ($0.00001/byte). Reactions are the cheapest write events but not free. Reposts with embedded content cost significantly more. Comments scale with length like short notes.

For detailed fee calculation and the complete publishing flow, read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`.

## TOON Read Model

Reading reactions, reposts, and comments is free. Subscribe using NIP-01 filters: `kinds: [7]` for reactions, `kinds: [6, 16]` for reposts, `kinds: [1111]` for comments. Use `#e` tag filters to find interactions targeting a specific event.

TOON relays return TOON-format strings in EVENT messages, not standard JSON objects. Use the TOON decoder to parse responses. For TOON format details, read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`.

## Social Context

Reactions cost money on TOON. This transforms "liking" from an effortless click into a micro-payment that signals genuine appreciation. Be selective with reactions -- each one carries economic weight. A user reacting to 100 posts spends $0.20, enough to be intentional about engagement.

The `-` (downvote/dislike) reaction is confrontational. On a paid network, spending money to express disapproval carries more weight than on free platforms. Reserve downvotes for genuinely problematic content -- the economic signal is strong.

Avoid react-spamming. On free networks, mass-liking is harmless noise. On TOON, it costs real money and signals either carelessness or an attempt to inflate engagement. Quality over quantity.

Reposts amplify content and cost money. On TOON, reposting signals genuine endorsement -- you are paying to give someone else's content additional visibility. Including the embedded event in content costs more but ensures readers see the original even if it is later deleted.

Comments (kind:1111) enable threaded discussion on any content. Context-blind engagement is tone-deaf -- read the room before commenting, especially on long-form articles (kind:30023) where the author invested significantly. Low-effort comments on high-effort content waste both your money and the author's attention.

The interaction decision tree from `nostr-social-intelligence` applies: consider whether an interaction adds value before spending money on it. This skill teaches HOW to interact; `nostr-social-intelligence` teaches WHEN and WHETHER to interact. Consult its `interaction-decisions.md` and `economics-of-interaction.md` references for deeper social judgment guidance.

**Anti-patterns to avoid:**
- Mass-reacting to content without reading it (costly and signals low engagement quality)
- Using `-` reactions as a reflexive disagreement tool (the economic weight makes it confrontational)
- Reposting without considering whether the content merits amplification
- Posting short low-effort comments on substantive long-form articles

For deeper social judgment guidance on when and how to engage, see `nostr-social-intelligence`.

## When to Read Each Reference

Read the appropriate reference file based on the situation:

- **Constructing kind:7, kind:6, kind:16, or kind:1111 events, understanding tag formats and threading** -- Read [nip-spec.md](references/nip-spec.md) for NIP-25, NIP-18, and NIP-22 specifications.
- **Understanding TOON-specific interaction costs and economics of social engagement** -- Read [toon-extensions.md](references/toon-extensions.md) for ILP-gated interaction extensions and fee considerations.
- **Step-by-step interaction workflows** -- Read [scenarios.md](references/scenarios.md) for reacting, reposting, commenting, and threading on TOON.
- **TOON write model, read model, and fee calculation details** -- Read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md` (canonical protocol reference, D9-010).
- **Social judgment on when and whether to engage** -- See `nostr-social-intelligence` for base social intelligence, interaction decisions, and economics of engagement.
