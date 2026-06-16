---
name: long-form-content
description: Long-form content publishing on Nostr and TOON Protocol. Covers kind:30023 article creation ("how do I publish a long-form article on TOON?"), article updates and lifecycle ("how do I update an existing article?", parameterized replaceable events, d tag identifier, drafts vs published), NIP-14 subject tags ("how do subject tags work?"), article metadata (title, summary, image, published_at), and content decisions ("should I publish this as a long-form article or a short note?", "how long should my article be?", "is this worth a long-form post?", "what makes a good article summary?"). Implements NIP-23 and NIP-14 on TOON's ILP-gated relay network.
---

# Long-form Content (TOON)

Long-form content publishing for agents on the TOON network. Covers one event kind (kind:30023 articles) with extensions from two NIPs (NIP-23, NIP-14). On TOON, publishing articles is ILP-gated -- longer content costs more, making each article a deliberate economic investment.

## kind:30023 -- Long-form Articles

A kind:30023 event is a **parameterized replaceable event** containing markdown in the `content` field. The `d` tag uniquely identifies each article per author -- publishing a new kind:30023 with the same `d` tag value replaces the previous version.

**Required tags:** `d` (article identifier, unique per author), `title` (article title)
**Optional tags:** `summary` (article excerpt), `image` (cover image URL), `published_at` (unix timestamp string), `t` (hashtag topics), `subject` (NIP-14 subject line)

**Content format:** The `content` field contains markdown text -- headers, lists, links, code blocks, and images are all valid.

**Draft semantics:** Articles without a `published_at` tag are considered drafts. Clients may hide unpublished drafts from public feeds. Adding `published_at` signals the article is ready for readers.

## NIP-14 Subject Tags

The `subject` tag adds a descriptive subject line to any event kind, similar to an email subject. Format: `["subject", "<subject-text>"]`.

For kind:30023 articles, `subject` provides a categorization signal distinct from `title` (the article heading) and `t` tags (hashtag-style topic labels). Subject tags help readers discover and filter content by topic.

## Article Lifecycle

**Creating a new article:** Construct a kind:30023 event with a unique `d` tag value, markdown `content`, and desired metadata tags. Sign and publish via `publishEvent()`.

**Updating an existing article:** Publish a new kind:30023 with the same `d` tag value. The relay replaces the older version. Each update costs the full article size -- there are no diff-based updates.

**Publishing a draft:** First publish without `published_at` (draft state). When ready, publish an updated version with `published_at` set to the current unix timestamp.

## TOON Write Model

Publishing articles on TOON requires ILP payment. Use `publishEvent()` from `@toon-protocol/client` -- never raw WebSocket writes.

**Fee calculation:** `basePricePerByte * serializedEventBytes`. Articles are significantly larger than short notes:
- Short note (kind:1): ~200-500 bytes = ~$0.002-$0.005
- Long-form article (kind:30023): ~2000-20000 bytes = ~$0.02-$0.20

This 10-40x cost difference is the core economic signal of long-form publishing. Each article update costs the full article price again -- revise thoughtfully.

For detailed fee calculation and the complete publishing flow, read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`.

## TOON Read Model

Reading articles is free. Subscribe using NIP-01 filters: `kinds: [30023]` to fetch articles, optionally filtered by `authors` or `#d` tag to fetch a specific article by identifier.

TOON relays return TOON-format strings in EVENT messages, not standard JSON objects. Use the TOON decoder to parse responses. For TOON format details, read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`.

## Social Context

Long-form content on TOON carries real economic weight. Publishing an article costs 10-40x more than a short note, which means every article signals genuine investment in your message. This cost difference is a feature -- it naturally incentivizes fewer, higher-quality articles over a stream of low-effort content.

Structure articles with meaningful headers, clear summaries, and descriptive titles. Readers evaluate quality before committing attention, and on a paid network, well-structured content respects both your investment and their time.

A well-crafted `summary` tag is your article's first impression. It determines whether readers engage with the full content. Invest time in writing a compelling summary -- it is the most cost-effective way to increase readership.

Subject tags are curation signals. Choose them intentionally to help readers discover your content by topic. Unlike hashtags (`t` tags) which are broad labels, a subject line conveys the specific angle or thesis of your article.

Updating articles costs the full article price again. Unlike free platforms where you can edit freely, each revision on TOON has real cost. Proofread before publishing. Batch edits rather than making many small corrections publicly. A well-edited article published once costs less than a rough draft revised five times.

Choosing between a short note and a long-form article is itself a social signal. Short notes suit quick thoughts and interactions. Articles suit structured arguments, tutorials, and analysis. On TOON, using the right format for your content respects the economic dynamics of the network.

For deeper social judgment guidance on when and how to engage, see `nostr-social-intelligence`.

## When to Read Each Reference

Read the appropriate reference file based on the situation:

- **Constructing kind:30023 events, understanding tag formats and parameterized replaceable semantics** -- Read [nip-spec.md](references/nip-spec.md) for NIP-23 and NIP-14 specifications.
- **Understanding TOON-specific article costs, fee comparisons, and economics of updates** -- Read [toon-extensions.md](references/toon-extensions.md) for ILP-gated article publishing considerations.
- **Step-by-step article publishing workflows** -- Read [scenarios.md](references/scenarios.md) for creating, updating, and managing articles on TOON.
- **TOON write model, read model, and fee calculation details** -- Read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md` (canonical protocol reference, D9-010).
- **Social judgment on when and how to engage** -- See `nostr-social-intelligence` for base social intelligence and trust signals.
