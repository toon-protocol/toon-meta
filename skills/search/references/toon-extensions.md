# TOON Extensions for Search

> **Why this reference exists:** Search on TOON differs from vanilla Nostr because paid writes put an admission gate in front of the corpus. This file covers the TOON-specific considerations for full-text search -- the free read model, the gate that paid writes put in front of the corpus, relay capability detection via NIP-11, and what a search response actually looks like.

## Search Is Free on TOON

Search is a read-only operation. No payment is required to issue search queries or receive search results. The TOON economic model is "pay to write, free to read" -- this applies fully to search:

- **Searching costs nothing.** Agents can issue as many search queries as the relay allows without any payment.
- **Reading search results costs nothing.** EVENT messages received in response to search queries are free to consume.
- **The content found was paid for.** Every event returned by a search query was published by an author who paid what the relay's route charges for a write. This is the source of the quality signal.

### No Paid Write for Search

Search does not use `client.send()` from `@toon-protocol/client`. Search queries are sent as standard NIP-01 REQ messages over the WebSocket connection. The payment pipeline is not involved in search operations.

If an agent wants to publish content that will be discoverable via search, that content must go through the standard TOON write path: construct and sign the event, then `await client.send({ body: signedEvent })` — the client seals the payload, prices it, mints the covering claim and carries it. See `nostr-protocol-core` for that flow.

## The Gate in Front of the Corpus

It is tempting to say that paying for writes prices spam out of the index. It does not. `g.toon.relay` charges **1 base unit** of 6-decimal USDC -- $0.000001 -- so a million spam events cost a dollar. Any claim that the price deters anything is off by orders of magnitude, and an agent that repeats it will over-trust what it finds.

What paid writes actually give a search corpus is a **gate**, and the honest version is worth stating:

- **Every result is attributable.** A searchable event arrived with a signed claim on an open payment channel, so it is traceable to a settlement identity that somebody provisioned and funded. Nothing in the index came from an anonymous free-tier connection.
- **Publishers are provisioned, not priced.** Bulk publishing is bounded by how many funded channels an actor can stand up and how fast a channel can carry claims -- not by a budget. Treat "it was paid for" as evidence of identity, not of effort.
- **There is no ranking signal here.** TOON relays do not annotate search results with what was paid, and nothing in a result tells you an author cared. Whatever quality difference exists comes from the admission gate, not from a price.

Use this the way it deserves: as a reason to trust *attribution*, and as no reason at all to skip your own judgement about content.

## TOON Relay Search Capability Detection

### Standard NIP-11 Detection

Check the relay's NIP-11 information document for NIP-50 support:

1. HTTP GET the relay URL with `Accept: application/nostr+json` header
2. Parse the `supported_nips` array
3. Check for `50` in the array

### The Node's Self-Description

A TOON node answers a free, unauthenticated `GET /ilp` on its own URL with its **self-description**: its ILP addresses, its settlement facts (chain, token, decimals) and **every route's price**. A connector answers when asked; it never announces, so this is where a would-be publisher learns what a write costs.

What the self-description does **not** carry is NIP support. It says nothing about `supported_nips`, so it cannot tell you whether a relay implements NIP-50. For search capability detection, the NIP-11 `supported_nips` check is the only method.

The `/health` price endpoint and `basePricePerByte` were both removed along with the `kind:10032` announce. A price belongs to a terminated route and is charged over the **sealed** payload, per kibibyte — never per byte.

### Capability Caching

Relay capabilities change infrequently. Cache the NIP-50 support status for each relay to avoid repeated NIP-11 fetches. A reasonable cache TTL is 1-24 hours depending on the agent's requirements.

## Reading Search Results

Reads are free and speak plain NIP-01: the relay returns standard JSON `EVENT` messages, so parse them as ordinary Nostr events. TOON encodes the **write** payload sealed inside the ILP packet, never a relay response. Search results follow the same shape as any other EVENT message from the relay.

### Parsing Flow

1. **Receive EVENT messages** from the search subscription
2. **Read the JSON event** straight off the wire -- `id`, `pubkey`, `created_at`, `kind`, `tags`, `content`, `sig` are already there, with no decoding step
3. **Process the decoded events** as standard Nostr events -- extract content, tags, and metadata
4. **Receive EOSE** to know when all stored matches have been sent

### Search Result Processing

After decoding search results:

- **Extract content** from the `content` field for display or further processing
- **Parse tags** for metadata (title, summary, d-tag for articles, p-tags for mentions, etc.)
- **Resolve references** within found content using the `content-references` skill for `nostr:` URI extraction
- **Check event kind** to determine the content type (kind:1 for notes, kind:30023 for articles, etc.)

For the write payload's TOON encoding, refer to `skills/nostr-protocol-core/references/toon-protocol-context.md`.

## Integration with Other Skills

- **relay-discovery:** Use NIP-11 parsing from the relay-discovery skill to detect NIP-50 support before issuing search queries.
- **content-references:** Use the content-references skill to construct `nostr:` URIs for referencing content found via search.
- **nostr-protocol-core:** The canonical reference for the write path, subscription mechanics, and the overall read model.
