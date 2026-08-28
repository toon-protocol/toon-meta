# TOON Extensions for Poll Events

> **Why this reference exists:** Polls on TOON differ from vanilla Nostr because every poll creation and every vote is ILP-gated. This file covers the TOON-specific considerations for kind:1068 and kind:1018 events -- publishing flow, what a poll and a vote actually cost, and how paying for writes changes polling dynamics and what it does and does not do against ballot stuffing.

## Publishing Polls and Votes on TOON

All poll publishing on TOON goes through `send()` from `@toon-protocol/client`. Raw WebSocket writes are rejected -- the relay requires ILP payment for every event.

### Publishing Flow

1. **Construct the event:** Build a kind:1068 (poll) or kind:1018 (vote) event with the appropriate tags and content
2. **Sign the event:** Use `nostr-tools` or equivalent to sign with the agent's private key
3. **Send it:** `await client.send({ body: signedEvent })`. The client seals the payload to the terminating connector, reads the route's price, mints the covering claim and carries it -- there is no separate pricing, claim-signing or publish step.

Agents never construct ILP packets and never sign a claim by hand.

### Asking for a Price in Advance

Where a price is genuinely needed before sending, `await client.routePrice(destination)` returns `{ price, pricePerKib? }`, and `chargeFor(terms, sealedBytes)` from `@toon-protocol/client` turns those terms into a charge. The metered quantity is the **sealed** payload the PREPARE carries, not the event JSON you wrote, so a vote's charge cannot be worked out by counting the bytes of your own tags. A node's full self-description, including every route's price, is a free `GET /ilp` on its URL: a connector answers, it never announces.

### Error Handling

- **F03 (INVALID_AMOUNT):** the claim did not cover the charge. A REJECT arrives as `{ fulfilled: false }` -- it is never thrown.
- **Relay rejection:** The event was malformed (invalid signature, wrong kind structure, missing required tags). Fix the event and republish.

## What Polls and Votes Cost

Nostr events publish to `g.toon.relay`, and that route is priced **flat: 1 base unit of 6-decimal USDC per packet**. One price covers every poll operation:

- A two-option poll with a short question: 1 base unit
- An eight-option range poll with `endsAt`, `relay` and value tags: 1 base unit
- A single-choice vote: 1 base unit
- A multiple-choice vote with several `response` tags: 1 base unit

Extra options, longer labels and additional tags change the event's size but not its price. Length only matters on a route whose price carries a slope, such as `g.toon.store` (1000 base units plus 10 per KiB of sealed payload), which is blob storage rather than event publishing. Polls do not go through it.

What the price does count is the number of writes: a poll plus fifty votes is fifty-one paid writes.

## Ballot Stuffing and Economic Friction

Paid writes give polling on TOON a sybil-resistance property that free relays lack. It is not a protocol-level enforcement mechanism, and at the relay's flat price it is not the per-vote fee that does the work.

### Where the Friction Actually Is

On free Nostr relays, ballot stuffing is trivial:

- Create 1,000 keypairs: free
- Submit 1,000 votes: free
- Total cost of manipulating a poll: $0.00

On TOON, keys are still free and the votes themselves are cheap -- 1,000 votes at 1 base unit each is 1,000 base units. The barrier is upstream of the fee: **every payer needs a funded payment channel**, opened on-chain with a deposit behind it. A stuffer running votes from a thousand distinct pubkeys needs a thousand funded channels, each with its own on-chain open and gas; running them all from one channel makes the whole block of votes trivially attributable to one payer.

So the honest statement is: paid writes make manipulation *visible and operationally expensive*, not *priced out*. Do not tell a user that stuffing a poll costs dollars per thousand votes.

### Cost-Per-Vote as Quality Signal

Each vote on TOON is a paid write from a funded channel. The collective dollar value of a poll is negligible at the relay's flat price -- fifty votes is fifty base units -- so read the signal as participation from funded payers rather than as an amount of money staked. Every response represents someone who had a channel open and chose to spend a write on the question.

### Limitations of Economic Sybil Resistance

- **Not a guarantee.** Well-funded actors can still manipulate polls by funding channels and paying for votes. Friction raises the cost but does not eliminate the possibility.
- **No identity binding.** TOON does not verify voter identity -- only that each vote was paid for. One person with multiple funded channels can still vote multiple times.
- **Client-side deduplication only.** Relays accept all valid, paid kind:1018 events. Deduplication by pubkey is performed by clients during result aggregation.
- **The per-vote price is small.** The relay's flat 1 base unit is not, on its own, a deterrent. Treat the channel requirement and the attributability of a funded payer as the real defences.

## Economic Dynamics of Polling on TOON

### Poll Creation as Investment

Creating a poll on TOON is a paid write from a funded channel. That is inexpensive but not free, and not anonymous to the payer. The friction filters out:

- Engagement-bait polls designed solely to generate interactions
- Duplicate polls on the same topic
- Frivolous questions that waste voters' attention and writes

When someone creates a poll on TOON, they are investing in the question and implicitly asking others to spend a write on the answer.

### Vote Cost as Participation Threshold

Each vote is a paid write. This creates a participation threshold that is procedural more than monetary:

- Voters with no funded channel cannot vote at all
- Voters who are indifferent will not bother spending a write
- The result is a higher-quality signal of genuine sentiment than free polls where casual clicks inflate results

### Timed Polls and Urgency Economics

Polls with `endsAt` tags create time-bounded signals:

- The total participation in a poll is determined by both the number of voters and the time window
- Shorter windows concentrate participation, creating a more decisive result
- Longer windows allow broader participation but may dilute urgency
- The cost per vote remains constant regardless of timing, and of the vote's size

### Poll Results as Weighted Signals

On TOON, poll results carry more weight than on free platforms because:

- Every vote represents a paid decision from a funded channel, not a casual click
- The write cost prevents mass-voting by disengaged participants
- Results can be compared across polls by the number of distinct paying voters, not just by raw vote count

## Integration with Protocol Core

For the complete TOON write model, read model, and route pricing details, refer to `skills/nostr-protocol-core/references/toon-protocol-context.md`. This file covers poll-specific extensions; the protocol core covers the foundational mechanics shared by all event kinds.
