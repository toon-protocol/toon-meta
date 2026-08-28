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

To create a poll on TOON, construct and sign a kind:1068 event, then `await client.send({ body: signedEvent })` from `@toon-protocol/client`. The relay route is flat-priced, so a poll with many options and a long question costs exactly what a two-option poll costs.

## kind:1018 -- Poll Responses (NIP-88)

A kind:1018 event is a regular (non-replaceable) event that casts a vote on an existing poll. Each vote creates a permanent, individually-priced event.

**Content field:** Empty string
**Required tags:** `e` (poll event ID being responded to), `response` (option index, e.g., `["response", "0"]`)
**Optional tags:** Multiple `response` tags for multiple-choice polls

To vote on TOON, construct and sign a kind:1018 event, then `await client.send({ body: signedEvent })` from `@toon-protocol/client`. A vote is a paid write at the same flat price as the poll it answers.

## TOON Write Model

All poll operations on TOON require ILP payment. Construct the event, sign it, then `await client.send({ body: signedEvent })` from `@toon-protocol/client` -- never raw WebSocket writes. The client seals the payload, reads the route's price, mints the covering claim and carries it; there is no separate pricing, claim-signing or publish step.

**What it costs:** Nostr events publish to `g.toon.relay`, which is priced flat at 1 base unit of 6-decimal USDC per packet. Creating a poll and casting a vote cost the same, and neither varies with the number of options or the length of the question. If you need the price up front, `await client.routePrice(destination)` returns the route's terms -- do not count your own bytes, because the metered quantity is the sealed payload rather than the event JSON.

For the complete publishing flow, read `skills/nostr-protocol-core/references/toon-protocol-context.md`.

## Reading (free, plain NIP-01)

Reading polls and vote results is free. Subscribe using NIP-01 filters: `kinds: [1068]` for polls, `kinds: [1018]` for responses. Use `#e` tag filters to find all votes on a specific poll.

Reads are free and speak plain NIP-01. The relay returns **standard JSON** `EVENT` messages -- `["EVENT", <sub-id>, {"id": ..., "pubkey": ..., "created_at": ..., "kind": 1018, "tags": [...], "content": ..., "sig": ...}]` -- so any ordinary Nostr client can tally a poll. There is no decoder step, and a read never touches a connector.

TOON is the encoding of the *write* payload: an agreement between the client and the app about the bytes the connector carries sealed inside the ILP packet. It is not what a relay serves on a read. **TOON on the way in, plain NIP-01 JSON on the way out.** For the full read model, read `skills/nostr-protocol-core/references/toon-read-model.md`.

## Social Context

Polls on TOON carry economic weight that fundamentally changes polling dynamics compared to free platforms.

**Voting costs money -- but the friction is the channel, not the price.** On free networks a single actor can create thousands of keypairs and vote thousands of times for nothing. On TOON every vote is a paid write, and a payer needs a funded payment channel, not just a keypair: opening one is an on-chain transaction with a deposit behind it. That setup cost is where the sybil resistance lives. The per-vote price itself is small -- `g.toon.relay` is flat at 1 base unit of 6-decimal USDC, so a thousand ballots cost a thousand base units. Paid voting raises the cost of manipulation and makes it visible; it does not price it out.

**Poll creation signals genuine interest.** Creating a poll is a paid write from a funded channel. This filters out the low-effort engagement-bait polls that proliferate on free platforms. When someone creates a poll on TOON, they are investing in the question.

**Each vote is a micro-payment of conviction.** Voters spend money to express their preference, making poll results a higher-quality signal of genuine sentiment. A poll with 50 votes represents 50 paid writes from 50 funded channels -- the channels, not the dollar total, are the signal.

**Timed polls with `endsAt` create urgency.** Setting a deadline encourages participation within a window. The economic cost per vote remains constant, but the time constraint adds social pressure to participate before the poll closes.

**Anti-patterns to avoid:**
- Creating polls with trivially obvious outcomes (wastes attention, and every response is still a paid write)
- Voting on polls you have not read the options for (each vote is a paid write)
- Creating duplicate polls on the same topic (each costs money; consolidate your question)
- Ignoring the `endsAt` tag when one is set (votes after deadline may be disregarded by clients)

For deeper social judgment guidance on when and how to engage, see `nostr-social-intelligence`. For understanding how poll content can reference other Nostr events, see `content-references`.

## When to Read Each Reference

Read the appropriate reference file based on the situation:

- **Constructing kind:1068 or kind:1018 events, understanding tag formats and poll types** -- Read [nip-spec.md](references/nip-spec.md) for the NIP-88 specification.
- **Understanding what polls and votes cost on TOON and the voting economics** -- Read [toon-extensions.md](references/toon-extensions.md) for ILP-gated polling extensions, ballot-stuffing prevention, and fee considerations.
- **Step-by-step poll workflows** -- Read [scenarios.md](references/scenarios.md) for creating polls, voting, viewing results, and timed polls on TOON.
- **TOON write model, read model, and route pricing details** -- Read `skills/nostr-protocol-core/references/toon-protocol-context.md` (canonical protocol reference, D9-010).
- **Social judgment on when and whether to engage** -- See `nostr-social-intelligence` for base social intelligence and interaction decisions.
- **Referencing polls or poll results in other content** -- See `content-references` for nostr: URI linking to poll events.
- **Reacting to or commenting on polls** -- See `social-interactions` for kind:7 reactions and kind:1111 comments on poll events.
