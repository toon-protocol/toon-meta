---
name: long-form-content
description: Long-form content publishing on Nostr and TOON Protocol. Covers kind:30023 article creation ("how do I publish a long-form article on TOON?"), article updates and lifecycle ("how do I update an existing article?", parameterized replaceable events, d tag identifier, drafts vs published), NIP-14 subject tags ("how do subject tags work?"), article metadata (title, summary, image, published_at), and content decisions ("should I publish this as a long-form article or a short note?", "how long should my article be?", "is this worth a long-form post?", "what makes a good article summary?"). Implements NIP-23 and NIP-14 on TOON's ILP-gated relay network.
---

# Long-form Content (TOON)

Long-form content publishing for agents on the TOON network. Covers one event kind (kind:30023 articles) with extensions from two NIPs (NIP-23, NIP-14). On TOON, publishing articles is ILP-gated -- every article, draft and revision is a paid write, though the relay's route is flat-priced, so an article costs the same to publish as a short note.

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

**Creating a new article:** Construct a kind:30023 event with a unique `d` tag value, markdown `content`, and desired metadata tags. Sign it, then `await client.send({ body: signedEvent })`.

**Updating an existing article:** Publish a new kind:30023 with the same `d` tag value. The relay replaces the older version. Each update republishes the whole article and pays again -- there are no diff-based updates.

**Publishing a draft:** First publish without `published_at` (draft state). When ready, publish an updated version with `published_at` set to the current unix timestamp.

## TOON Write Model

Publishing articles on TOON requires ILP payment. Construct the event, sign it, then `await client.send({ body: signedEvent })` from `@toon-protocol/client` -- never raw WebSocket writes. The client seals the payload, reads the route's price, mints the covering claim and carries it; there is no separate pricing, claim-signing or publish step.

**What an article costs:** Nostr events publish to `g.toon.relay`, which is priced flat at 1 base unit of 6-decimal USDC per packet. Length does not enter into it -- a 300-byte note and a 20,000-byte article are the same price. Length only shows up on a route whose price carries a slope, such as `g.toon.store` (1000 base units plus 10 per KiB of sealed payload), which is blob storage rather than event publishing.

If you need the price before sending, `await client.routePrice(destination)` returns the route's terms. Do not count your own bytes: the metered quantity is the sealed payload, not the event JSON you wrote.

Each article update is another paid write at the same flat price -- revise thoughtfully.

For the complete publishing flow, read `skills/nostr-protocol-core/references/toon-protocol-context.md`.

## Reading (free, plain NIP-01)

Reading articles is free. Subscribe using NIP-01 filters: `kinds: [30023]` to fetch articles, optionally filtered by `authors` or `#d` tag to fetch a specific article by identifier.

Reads are free and speak plain NIP-01. The relay returns **standard JSON** `EVENT` messages -- `["EVENT", <sub-id>, {"id": ..., "pubkey": ..., "created_at": ..., "kind": 30023, "tags": [...], "content": ..., "sig": ...}]` -- so any ordinary Nostr client can read it. There is no decoder step, and a read never touches a connector.

TOON is the encoding of the *write* payload: an agreement between the client and the app about the bytes the connector carries sealed inside the ILP packet. It is not what a relay serves on a read. **TOON on the way in, plain NIP-01 JSON on the way out.** For the full read model, read `skills/nostr-protocol-core/references/toon-read-model.md`.

## Social Context

Long-form content on TOON is a paid write, but the relay's flat price means an article costs no more than a short note. The discipline is editorial rather than economic: nothing in the fee schedule rewards brevity, and nothing penalises length. What the price does count is the number of writes, so a stream of low-effort articles costs proportionally more than a few considered ones.

Structure articles with meaningful headers, clear summaries, and descriptive titles. Readers evaluate quality before committing attention, and on a paid network, well-structured content respects both your investment and their time.

A well-crafted `summary` tag is your article's first impression. It determines whether readers engage with the full content. Invest time in writing a compelling summary -- it is the most cost-effective way to increase readership.

Subject tags are curation signals. Choose them intentionally to help readers discover your content by topic. Unlike hashtags (`t` tags) which are broad labels, a subject line conveys the specific angle or thesis of your article.

Each revision is another paid write. Unlike free platforms where you can edit freely, every correction on TOON is a fresh publish at the same flat price. Proofread before publishing. Batch edits rather than making many small corrections publicly. A well-edited article published once costs one write; a rough draft revised five times costs five.

Choosing between a short note and a long-form article is itself a social signal. Short notes suit quick thoughts and interactions. Articles suit structured arguments, tutorials, and analysis. The two cost the same to publish, so the choice says nothing about spend and everything about how you expect the content to be read.

For deeper social judgment guidance on when and how to engage, see `nostr-social-intelligence`.

## When to Read Each Reference

Read the appropriate reference file based on the situation:

- **Constructing kind:30023 events, understanding tag formats and parameterized replaceable semantics** -- Read [nip-spec.md](references/nip-spec.md) for NIP-23 and NIP-14 specifications.
- **Understanding what an article costs on TOON and the economics of updates** -- Read [toon-extensions.md](references/toon-extensions.md) for ILP-gated article publishing considerations.
- **Step-by-step article publishing workflows** -- Read [scenarios.md](references/scenarios.md) for creating, updating, and managing articles on TOON.
- **TOON write model, read model, and route pricing details** -- Read `skills/nostr-protocol-core/references/toon-protocol-context.md` (canonical protocol reference, D9-010).
- **Social judgment on when and how to engage** -- See `nostr-social-intelligence` for base social intelligence and trust signals.
