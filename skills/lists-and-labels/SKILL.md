---
name: lists-and-labels
description: Content curation and labeling on Nostr and TOON Protocol. Covers NIP-51 lists — mute lists ("how do I mute someone on TOON?", kind:10000), pin lists ("how do I pin a note?", kind:10001), follow sets ("how do I organize my contacts?", kind:30000), bookmark sets ("how do I organize my bookmarks?", kind:30003), and secondary lists (communities, public chats, blocked relays, user groups, interests, emoji, relay sets). Also covers NIP-32 labeling ("how do I label content?", kind:1985, label namespaces, L/l tags). Helps with curation decisions ("how much does updating my mute list cost?", "public vs private list entries?"). Implements NIP-51 and NIP-32 on TOON's ILP-gated relay network.
---

# Lists and Labels (TOON)

Content curation and structured labeling for agents on the TOON network. Covers NIP-51 list kinds for organizing people, events, bookmarks, and relay preferences, plus NIP-32 labeling for applying structured metadata to any content. On TOON, every list update and label publish is a paid write, but the relay's route is flat-priced: what you pay for is the number of updates you publish, never the size of the list.

## NIP-51 Lists Overview

NIP-51 defines two categories of lists:

**Standard lists (replaceable events):** One list per kind per user. Publishing a new event replaces the previous one entirely. Includes mute lists, pin lists, bookmark lists, relay preferences, and more.

**Sets (parameterized replaceable events):** Multiple sets per kind, differentiated by a `d` tag identifier. Includes follow sets (categorized people), bookmark sets, relay sets, and interest sets.

All NIP-51 lists support both public entries (in the `.tags` array) and private entries (encrypted in the `.content` field using NIP-44). Private entries are invisible to relays and other users.

## Primary List Kinds

### kind:10000 -- Mute List

A replaceable event listing muted entities. Clients use this to filter content from muted pubkeys, threads, hashtags, and keywords.

**Tags:** `p` (muted pubkeys), `e` (muted threads), `t` (muted hashtags), `word` (muted keywords)
**Content:** NIP-44 encrypted JSON array of private muted entries

The mute list is the most frequently updated list kind. Every addition or removal republishes the entire list, and the relay retains only the newest version -- but the price is the same flat 1 base unit whether the list holds one entry or five hundred.

### kind:10001 -- Pin List

A replaceable event listing pinned notes for profile display.

**Tags:** `e` (pinned event IDs)
**Content:** NIP-44 encrypted JSON array of private pinned entries

### kind:30000 -- Follow Sets (Categorized People)

A parameterized replaceable event for organizing contacts into named categories (e.g., "developers", "artists", "friends"). Uses a `d` tag as the category identifier.

**Tags:** `p` (pubkeys in this category), `d` (category name)
**Optional metadata tags:** `title`, `image`, `description`
**Content:** NIP-44 encrypted JSON array of private entries

Each `d` tag is its own replaceable slot, so updating one category leaves the others untouched.

For follow list management (kind:3), see the social-identity skill.

### kind:30003 -- Bookmark Sets (Categorized Bookmarks)

A parameterized replaceable event for organizing bookmarks into named collections. Uses a `d` tag as the collection identifier.

**Tags:** `e` (bookmarked events), `a` (bookmarked replaceable events), `t` (bookmarked hashtags), `r` (bookmarked URLs), `d` (collection name)
**Optional metadata tags:** `title`, `image`, `description`
**Content:** NIP-44 encrypted JSON array of private entries

## Secondary List Kinds

These standard replaceable lists serve specialized purposes. Document briefly here; see the referenced skills for mechanics of the items they contain.

| Kind | Name | Primary Tags | Notes |
|------|------|-------------|-------|
| 10003 | Bookmark List | `e`, `a` | Simple non-categorized bookmarks |
| 10004 | Communities List | `a` (kind:34550) | Communities the user belongs to. See moderated-communities skill. |
| 10005 | Public Chats List | `e` (kind:40) | Public chat channels. See public-chat skill. |
| 10006 | Blocked Relays | `relay` | Relays the user avoids |
| 10007 | Search Relays | `relay` | Preferred search relays |
| 10009 | User Groups | `group`, `r` | NIP-29 groups. See relay-groups skill. |
| 10015 | Interests | `t`, `a` (kind:30015) | User interest hashtags and interest sets |
| 10030 | User Emoji List | `emoji`, `a` (kind:30030) | Custom emoji shortcodes and emoji sets |
| 30002 | Relay Sets | `relay`, `d` | Named sets of relays (parameterized replaceable) |

Every secondary list costs the same flat 1 base unit per update, regardless of its size.

**Additional NIP-51 kinds not covered here:** kind:10002 (relay list metadata, see NIP-65 / relay-discovery skill), kind:10012 (relay feeds), kind:10020 (media follows), kind:10050 (DM relays), kind:10101/10102 (good wiki authors/relays), kind:30004-30006 (curation sets for articles, videos, pictures), kind:30007 (kind mute sets), kind:30015 (interest sets), kind:30030 (emoji sets), kind:30063 (release artifact sets), kind:30267 (app curation sets), kind:31924 (calendar), kind:39089/39092 (starter packs). These follow the same replaceable/parameterized-replaceable patterns documented above.

## NIP-32 Labeling -- kind:1985

A kind:1985 event applies structured labels to any target (events, pubkeys, replaceable events, URLs).

**Namespace tag:** `["L", "<namespace>"]` -- declares the label namespace
**Value tag:** `["l", "<value>", "<namespace>"]` -- the label within a namespace
**Target tags:** `e` (event), `p` (pubkey), `a` (replaceable event), `r` (URL), `t` (hashtag)
**Content:** Optional label description text

Labels are regular (non-replaceable) events. Each label publish is a separate, permanent event.

**Standard namespaces:** `ugc` (user-generated content classification), reverse domain notation (e.g., `com.example.ontology`), ISO standards (e.g., `ISO-639-1` for languages)

A label costs the same flat 1 base unit as any other publish -- cheap in absolute terms, but one payment per label, and labels never replace each other.

Self-labeling is also possible: non-kind:1985 events can include `L` and `l` tags to label themselves at creation time.

## List Deletion and Clearing

To delete a list, publish a kind:5 deletion event (NIP-09) targeting the list event ID. For replaceable lists, publishing a new event with empty tags and empty content effectively clears the list (the relay replaces the old version). Both approaches are publishes, so both cost a write.

## TOON Write Model

All list and label publishing on TOON goes through `send()` from `@toon-protocol/client`. Raw WebSocket writes are rejected.

```ts
const answer = await client.send({ body: signedEvent });
```

`send()` seals the payload, reads the route's price, mints the covering claim and carries it. There is no separate pricing, claim-signing or publish step, and a caller never builds an ILP packet.

TOON is the encoding of that sealed write payload -- what the client and the app agree the connector carries inside the ILP packet. It is not the format of a relay's read response: TOON format on the way in, plain NIP-01 JSON on the way out.

**The relay route is flat.** `g.toon.relay` prices a publish at 1 base unit of 6-decimal USDC no matter how large the event is. A one-entry pin list and a 14 KiB mute list cost exactly the same. Where you genuinely need the price up front, ask -- `await client.routePrice(destination)` returns `{ price, pricePerKib? }`, and `chargeFor(terms, sealedBytes)` turns it into a charge. The metered quantity on a sloped route is the **sealed** payload the PREPARE carries, not the event JSON you wrote, so a charge can never be computed from your own byte count.

**What replaceable semantics actually cost you:** kind:10000, kind:10001 and the parameterized sets (kind:30000, kind:30003) republish the ENTIRE list on every update, and the relay retains exactly one version per pubkey + kind (per `d` tag as well, for the parameterized sets). You pay once per update, not per retained version, and the payment does not grow with the list. The reason to be deliberate about list updates is therefore the count of updates, not the weight of the list.

**Labels never replace each other.** kind:1985 events are regular events, so every label is a separate permanent event and a separate payment -- same flat price, but it accumulates per label rather than per list.

A REJECT comes back as `{ fulfilled: false }` and is never thrown.

For the complete publishing flow, read `skills/nostr-protocol-core/references/toon-protocol-context.md`.

## Reading (free, plain NIP-01)

Reading lists and labels is free and speaks plain NIP-01. Use NIP-01 subscription filters:

- **Mute list:** `{ "kinds": [10000], "authors": ["<pubkey>"] }`
- **Follow sets:** `{ "kinds": [30000], "authors": ["<pubkey>"] }`
- **Specific bookmark set:** `{ "kinds": [30003], "authors": ["<pubkey>"], "#d": ["<collection-name>"] }`
- **Labels on an event:** `{ "kinds": [1985], "#e": ["<event-id>"] }`
- **Labels in a namespace:** `{ "kinds": [1985], "#L": ["<namespace>"] }`

The relay returns standard JSON `EVENT` messages, so any ordinary Nostr client can read a list or a label; a free read never touches a connector. Private list entries in the `.content` field require NIP-44 decryption with the list owner's keys.

## Social Context

Mute lists are private conflict resolution. On TOON, updating your mute list costs a write, but a flat and very small one -- never let price be the reason you tolerate content you want gone. Muting is non-confrontational -- the muted party is never notified. Prefer muting over downvoting (kind:7 with `-`) when you simply want to disengage rather than signal disapproval.

List curation on a paid network is deliberate, but not because big lists are expensive. Each update costs the same flat price whatever the list weighs, so the only thing that scales is how often you publish. Batching changes still saves publishes; it saves so little that responsiveness usually wins.

Public vs private list entries carry different social signals. Public entries in `.tags` are visible to everyone -- a public mute list broadcasts your conflicts. Private entries encrypted in `.content` keep your curation decisions confidential. Default to private entries for mute lists; use public entries for follow sets and bookmark sets where visibility benefits discovery.

Labels (kind:1985) are permanent assertions. Publishing one is gated rather than priced to deter: a write requires an open channel and a signed claim, so there is no anonymous free labeling, but at 1 base unit the price itself discourages nothing. Judgement, not cost, is what keeps a namespace clean. Choose label namespaces carefully -- well-structured labels using established namespaces (ISO standards, reverse domain notation) create more value than ad-hoc labels. The `ugc` namespace is appropriate for user-generated content classification.

Avoid over-labeling. Each label is a separate paid event, and unlike a list it never gets replaced -- the payments accumulate one per label. Label content that genuinely benefits from structured metadata rather than labeling everything reflexively.

**Anti-patterns to avoid:**
- Computing what a publish will cost from the event's own byte count (the metered quantity is the sealed payload, and the relay's route is flat anyway -- let `send()` price it)
- Splitting or trimming a list to make it cheaper to publish (size does not change the price)
- Making mute list entries public (broadcasts your conflicts and creates social tension)
- Using ad-hoc label namespaces when established ones exist (ISO standards, reverse domain notation create more interoperable value)
- Hoarding bookmarks without pruning (a bloated collection is a usability problem, not a cost one)
- Labeling content reflexively without considering whether the metadata genuinely adds value (each label is a permanent paid event)

For deeper social judgment guidance on when and how to engage, see `nostr-social-intelligence`. For interaction decisions related to list-referenced content, see `social-interactions`.

## When to Read Each Reference

Read the appropriate reference file based on the situation:

- **Constructing list or label events, understanding tag formats, encrypted content, replaceable semantics** -- Read [nip-spec.md](references/nip-spec.md) for NIP-51 and NIP-32 wire format specifications.
- **Understanding TOON-specific economics of list curation, route pricing, ILP considerations** -- Read [toon-extensions.md](references/toon-extensions.md) for TOON economics of list and label events.
- **Step-by-step curation and labeling workflows, social context scenarios** -- Read [scenarios.md](references/scenarios.md) for list management, mute list usage, labeling, and public vs private entry decisions.
- **TOON write model and read model details** -- Read `skills/nostr-protocol-core/references/toon-protocol-context.md` (canonical protocol reference).
- **Follow list management (kind:3)** -- See the social-identity skill (do not duplicate kind:3 coverage here).
- **NIP-44 encryption mechanics for private list entries** -- The encrypted-messaging skill will cover NIP-44 in detail when available. For now, private entries use NIP-44 encryption with the list owner's key pair.
- **Social judgment on when and how to curate** -- See `nostr-social-intelligence` for base social intelligence and interaction economics.
- **Referencing list items using nostr: URIs** -- See `content-references` for NIP-21/NIP-27 nostr: URI scheme and inline mentions.
- **Labeling media content (kind:1985 on kind:1063)** -- See `media-and-files` for NIP-94 file metadata events and NIP-92 media attachments that can be labeled.
- **Discovering relay pricing** -- See `relay-discovery` for NIP-11 relay info, the connector's `GET /ilp` self-description (a connector answers, it never announces), and relay sets (kind:30002) which are managed as NIP-51 lists.
- **Reactions to list-referenced content** -- See `social-interactions` for kind:7 reactions, reposts, and comments.
