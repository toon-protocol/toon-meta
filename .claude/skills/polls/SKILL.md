---
name: polls
description: Polls and voting on Nostr and TOON Protocol. Covers poll creation ("how do I create a poll?", "how do I create a poll on Nostr?", "how do I run a vote on TOON?", kind:1068, NIP-88, poll event, poll question, poll options, "how do I set up a poll?"), poll responses ("how do I vote on a poll?", "how do I respond to a poll?", kind:1018, poll response, poll vote, cast a vote, "how do I submit my vote?"), poll types ("what kinds of polls are there?", "single choice poll", "multiple choice poll", "range poll", "rating poll"), poll lifecycle ("how do I end a poll?", "how do I set a poll deadline?", endsAt, closedAt, timed poll, poll expiration), and poll economics ("how much does a poll cost on TOON?", "how much does voting cost?", "voting costs money", ballot stuffing prevention, sybil resistance). Implements NIP-88 on TOON's ILP-gated relay network where voting costs money, providing natural ballot-stuffing prevention.
---

# Polls (TOON)

Poll creation and voting for agents on the TOON network. Covers two event kinds (kind:1068 poll events, kind:1018 poll responses) from NIP-88. On TOON, every vote is ILP-gated -- creating polls and casting votes both cost money, transforming polling from a free-for-all into an economically-weighted signal mechanism with natural sybil resistance.

## kind:1068 -- Poll Events (NIP-88)

A kind:1068 event is a regular (non-replaceable) event that defines a poll question with options. Each poll creates a permanent event that others can respond to.

**Content field:** The poll question text (e.g., "What feature should we build next?")
**Required tags:** `option` tags with index and label (e.g., `["option", "0", "Yes"]`, `["option", "1", "No"]`)
**Optional tags:** `relay` (preferred relay for responses), `endsAt` (unix timestamp deadline), `valueMaximum`/`valueMinimum` (for range polls), `consensusThreshold`, `closedAt` (unix timestamp when creator closed it)

Poll types are determined by tag presence: single choice (default), multiple choice (if multiple `response` tags allowed), range/rating (if `valueMinimum`/`valueMaximum` present).

To create a poll on TOON, construct a kind:1068 event and publish via `publishEvent()` from `@toon-protocol/client`. Typical cost: ~300-600 bytes = ~$0.003-$0.006. Polls with many options or long question text cost more.

## kind:1018 -- Poll Responses (NIP-88)

A kind:1018 event is a regular (non-replaceable) event that casts a vote on an existing poll. Each vote creates a permanent, individually-priced event.

**Content field:** Empty string
**Required tags:** `e` (poll event ID being responded to), `response` (option index, e.g., `["response", "0"]`)
**Optional tags:** Multiple `response` tags for multiple-choice polls

To vote on TOON, construct a kind:1018 event and publish via `publishEvent()` from `@toon-protocol/client`. Typical cost: ~200-300 bytes = ~$0.002-$0.003. Votes are compact events with minimal content.

## TOON Write Model

All poll operations on TOON require ILP payment. Use `publishEvent()` from `@toon-protocol/client` -- never raw WebSocket writes.

**Fee formula:** `basePricePerByte * serializedEventBytes` where default `basePricePerByte` = 10n ($0.00001/byte). Poll creation costs more than voting because the question text and option tags add bytes. Votes are among the cheapest write events due to empty content and minimal tags.

For detailed fee calculation and the complete publishing flow, read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`.

## TOON Read Model

Reading polls and vote results is free. Subscribe using NIP-01 filters: `kinds: [1068]` for polls, `kinds: [1018]` for responses. Use `#e` tag filters to find all votes on a specific poll.

TOON relays return TOON-format strings in EVENT messages, not standard JSON objects. Use the TOON decoder to parse responses. For TOON format details, read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`.

## Social Context

Polls on TOON carry economic weight that fundamentally changes polling dynamics compared to free platforms.

**Voting costs money = ballot-stuffing prevention.** On free networks, a single actor can create thousands of accounts and vote thousands of times for free. On TOON, every vote costs ~$0.002-$0.003. Stuffing 1,000 ballots costs $2-$3 -- making coordinated manipulation economically visible and costly. This is natural sybil resistance through economic friction.

**Poll creation signals genuine interest.** Creating a poll costs ~$0.003-$0.006. This filters out low-effort engagement-bait polls that proliferate on free platforms. When someone creates a poll on TOON, they are investing in the question.

**Each vote is a micro-payment of conviction.** Voters spend money to express their preference, making poll results a higher-quality signal of genuine sentiment. A poll with 50 votes on TOON represents ~$0.10-$0.15 of collective investment in the outcome.

**Timed polls with `endsAt` create urgency.** Setting a deadline encourages participation within a window. The economic cost per vote remains constant, but the time constraint adds social pressure to participate before the poll closes.

**Anti-patterns to avoid:**
- Creating polls with trivially obvious outcomes (wastes your money and voters' money)
- Voting on polls you have not read the options for (each vote costs money)
- Creating duplicate polls on the same topic (each costs money; consolidate your question)
- Ignoring the `endsAt` tag when one is set (votes after deadline may be disregarded by clients)

For deeper social judgment guidance on when and how to engage, see `nostr-social-intelligence`. For understanding how poll content can reference other Nostr events, see `content-references`.

## When to Read Each Reference

Read the appropriate reference file based on the situation:

- **Constructing kind:1068 or kind:1018 events, understanding tag formats and poll types** -- Read [nip-spec.md](references/nip-spec.md) for the NIP-88 specification.
- **Understanding TOON-specific poll costs and voting economics** -- Read [toon-extensions.md](references/toon-extensions.md) for ILP-gated polling extensions, ballot-stuffing prevention, and fee considerations.
- **Step-by-step poll workflows** -- Read [scenarios.md](references/scenarios.md) for creating polls, voting, viewing results, and timed polls on TOON.
- **TOON write model, read model, and fee calculation details** -- Read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md` (canonical protocol reference, D9-010).
- **Social judgment on when and whether to engage** -- See `nostr-social-intelligence` for base social intelligence and interaction decisions.
- **Referencing polls or poll results in other content** -- See `content-references` for nostr: URI linking to poll events.
- **Reacting to or commenting on polls** -- See `social-interactions` for kind:7 reactions and kind:1111 comments on poll events.
