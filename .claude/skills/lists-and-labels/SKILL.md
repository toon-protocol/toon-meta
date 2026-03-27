---
name: lists-and-labels
description: Content curation and labeling on Nostr and TOON Protocol. Covers NIP-51 lists — mute lists ("how do I mute someone on TOON?", kind:10000), pin lists ("how do I pin a note?", kind:10001), follow sets ("how do I organize my contacts?", kind:30000), bookmark sets ("how do I organize my bookmarks?", kind:30003), and secondary lists (communities, public chats, blocked relays, user groups, interests, emoji, relay sets). Also covers NIP-32 labeling ("how do I label content?", kind:1985, label namespaces, L/l tags). Helps with curation decisions ("how much does updating my mute list cost?", "public vs private list entries?"). Implements NIP-51 and NIP-32 on TOON's ILP-gated relay network.
---

# Lists and Labels (TOON)

Content curation and structured labeling for agents on the TOON network. Covers NIP-51 list kinds for organizing people, events, bookmarks, and relay preferences, plus NIP-32 labeling for applying structured metadata to any content. On TOON, every list update and label publish is ILP-gated -- replaceable lists republish the ENTIRE list on every change, making curation a cost-conscious activity.

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
**Typical size:** 200-2000 bytes (grows with muted entities)
**TOON cost:** ~$0.002-$0.02 per update

The mute list is the most frequently updated list kind. Every addition or removal republishes the entire list at full cost. Batch changes when possible.

### kind:10001 -- Pin List

A replaceable event listing pinned notes for profile display.

**Tags:** `e` (pinned event IDs)
**Content:** NIP-44 encrypted JSON array of private pinned entries
**Typical size:** 150-500 bytes
**TOON cost:** ~$0.0015-$0.005

### kind:30000 -- Follow Sets (Categorized People)

A parameterized replaceable event for organizing contacts into named categories (e.g., "developers", "artists", "friends"). Uses a `d` tag as the category identifier.

**Tags:** `p` (pubkeys in this category), `d` (category name)
**Optional metadata tags:** `title`, `image`, `description`
**Content:** NIP-44 encrypted JSON array of private entries
**Typical size:** 200-5000 bytes (varies by category size)
**TOON cost:** ~$0.002-$0.05

For follow list management (kind:3), see the social-identity skill.

### kind:30003 -- Bookmark Sets (Categorized Bookmarks)

A parameterized replaceable event for organizing bookmarks into named collections. Uses a `d` tag as the collection identifier.

**Tags:** `e` (bookmarked events), `a` (bookmarked replaceable events), `t` (bookmarked hashtags), `r` (bookmarked URLs), `d` (collection name)
**Optional metadata tags:** `title`, `image`, `description`
**Content:** NIP-44 encrypted JSON array of private entries
**Typical size:** 200-5000 bytes (varies by bookmark count)
**TOON cost:** ~$0.002-$0.05

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

All secondary lists cost ~$0.001-$0.01 per update on TOON, depending on size.

**Additional NIP-51 kinds not covered here:** kind:10002 (relay list metadata, see NIP-65 / relay-discovery skill), kind:10012 (relay feeds), kind:10020 (media follows), kind:10050 (DM relays), kind:10101/10102 (good wiki authors/relays), kind:30004-30006 (curation sets for articles, videos, pictures), kind:30007 (kind mute sets), kind:30015 (interest sets), kind:30030 (emoji sets), kind:30063 (release artifact sets), kind:30267 (app curation sets), kind:31924 (calendar), kind:39089/39092 (starter packs). These follow the same replaceable/parameterized-replaceable patterns documented above.

## NIP-32 Labeling -- kind:1985

A kind:1985 event applies structured labels to any target (events, pubkeys, replaceable events, URLs).

**Namespace tag:** `["L", "<namespace>"]` -- declares the label namespace
**Value tag:** `["l", "<value>", "<namespace>"]` -- the label within a namespace
**Target tags:** `e` (event), `p` (pubkey), `a` (replaceable event), `r` (URL), `t` (hashtag)
**Content:** Optional label description text

Labels are regular (non-replaceable) events. Each label publish is a separate, permanent event.

**Standard namespaces:** `ugc` (user-generated content classification), reverse domain notation (e.g., `com.example.ontology`), ISO standards (e.g., `ISO-639-1` for languages)

**Typical size:** 150-400 bytes
**TOON cost:** ~$0.0015-$0.004 (labels are lightweight and cheap)

Self-labeling is also possible: non-kind:1985 events can include `L` and `l` tags to label themselves at creation time.

## TOON Write Model

All list and label publishing on TOON goes through `publishEvent()` from `@toon-protocol/client`. Raw WebSocket writes are rejected.

**Fee formula:** `basePricePerByte * serializedEventBytes` where default `basePricePerByte` = 10n ($0.00001/byte).

**Replaceable event cost trap:** Replaceable lists (kind:10000, 10001) and parameterized replaceable lists (kind:30000, 30003) must republish the ENTIRE list on every update. A mute list with 200 p-tags at ~70 bytes each = ~14KB = ~$0.14 per update. Batch changes to minimize cost.

**Labels are cheap:** kind:1985 events are regular (non-replaceable) and typically small. Labeling is one of the most cost-effective write operations on TOON.

For the complete publishing flow and fee calculation details, read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`.

## TOON Read Model

Reading lists and labels is free. Use NIP-01 subscription filters:

- **Mute list:** `{ "kinds": [10000], "authors": ["<pubkey>"] }`
- **Follow sets:** `{ "kinds": [30000], "authors": ["<pubkey>"] }`
- **Specific bookmark set:** `{ "kinds": [30003], "authors": ["<pubkey>"], "#d": ["<collection-name>"] }`
- **Labels on an event:** `{ "kinds": [1985], "#e": ["<event-id>"] }`
- **Labels in a namespace:** `{ "kinds": [1985], "#L": ["<namespace>"] }`

TOON relays return TOON-format strings in EVENT messages, not standard JSON objects. Use the TOON decoder to parse responses. Private list entries in the `.content` field require NIP-44 decryption with the list owner's keys.

## Social Context

Mute lists are private conflict resolution. On TOON, updating your mute list costs money, but the social benefit of filtering unwanted content justifies the expense. Muting is non-confrontational -- the muted party is never notified. Prefer muting over downvoting (kind:7 with `-`) when you simply want to disengage rather than signal disapproval.

List curation on a paid network is inherently cost-conscious. Every list update republishes the full list at per-byte cost. This creates a natural incentive to be deliberate about what you add and to batch changes rather than making frequent single-item updates.

Public vs private list entries carry different social signals. Public entries in `.tags` are visible to everyone -- a public mute list broadcasts your conflicts. Private entries encrypted in `.content` keep your curation decisions confidential. Default to private entries for mute lists; use public entries for follow sets and bookmark sets where visibility benefits discovery.

Labels (kind:1985) are permanent assertions. On a paid network, labeling costs money, which discourages frivolous or malicious labeling. Choose label namespaces carefully -- well-structured labels using established namespaces (ISO standards, reverse domain notation) create more value than ad-hoc labels. The `ugc` namespace is appropriate for user-generated content classification.

Avoid over-labeling. Each label is a separate paid event. Label content that genuinely benefits from structured metadata rather than labeling everything reflexively.

## List Deletion and Clearing

To delete a list, publish a kind:5 deletion event (NIP-09) targeting the list event ID. For replaceable lists, publishing a new event with empty tags and empty content effectively clears the list (the relay replaces the old version). Both approaches cost money on TOON.

## When to Read Each Reference

Read the appropriate reference file based on the situation:

- **Constructing list or label events, understanding tag formats, encrypted content, replaceable semantics** -- Read [nip-spec.md](references/nip-spec.md) for NIP-51 and NIP-32 wire format specifications.
- **Understanding TOON-specific costs for list curation, fee estimates, ILP considerations** -- Read [toon-extensions.md](references/toon-extensions.md) for TOON economics of list and label events.
- **Step-by-step curation and labeling workflows, social context scenarios** -- Read [scenarios.md](references/scenarios.md) for list management, mute list usage, labeling, and public vs private entry decisions.
- **TOON write model, read model, and fee calculation details** -- Read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md` (canonical protocol reference).
- **Follow list management (kind:3)** -- See the social-identity skill (do not duplicate kind:3 coverage here).
- **NIP-44 encryption mechanics for private list entries** -- The encrypted-messaging skill will cover NIP-44 in detail when available. For now, private entries use NIP-44 encryption with the list owner's key pair.
