---
name: search
description: Full-text search on Nostr and TOON Protocol using NIP-50. Covers search filter syntax ("how do I search on Nostr?", "how do I find content on TOON?", NIP-50, search filter, full-text search, search query, "how do I search for notes?"), relay support detection ("does this relay support search?", NIP-11 supported_nips, search capability), filtered search ("how do I search by kind?", "how do I search by author?", combined filters, search with author filter), search extensions ("include:spam", moderation search, search operators), and TOON search context ("is search free on TOON?", "how does search work on a paid relay?", search quality signal). Implements NIP-50 on TOON's ILP-gated relay network.
---

# Search (TOON)

Full-text search capability for agents on the TOON network. NIP-50 extends the NIP-01 filter object with a `search` field, enabling relays to provide full-text search over stored events. Search is an optional relay feature -- relays advertise NIP-50 support via their NIP-11 relay information document. On TOON, search is a read-only operation: free for the searcher, but the content found was paid for by its authors, making search results a curated quality signal.

## Search Model

NIP-50 adds a single field to the standard NIP-01 REQ filter:

- `search` -- a plain-text search string added to any REQ filter object
- The search field works alongside all existing filter fields (`kinds`, `authors`, `#e`, `#p`, `since`, `until`, `limit`, etc.)
- Relays that support NIP-50 advertise it in their NIP-11 `supported_nips` array
- Some relays support search extensions prefixed in the search string (e.g., `include:spam` for moderation tools)

Detection flow: before issuing a search query, check the relay's NIP-11 information document for `supported_nips` containing `50`. NIP-11 is the only source for this — a TOON node's self-description carries route prices and settlement facts, never NIP support.

## TOON Write Model

Search is a **read-only** operation. No paid write is needed to perform a search. The content returned by search was published — and paid for — by its original authors with `client.send()` from `@toon-protocol/client`.

Agents do not pay to search. However, if an agent wants to create content that is discoverable via search, that content must be published through the standard TOON write path: construct and sign the event, then `await client.send({ body: signedEvent })`, which seals the payload, prices it, mints the covering claim and carries it. See `nostr-protocol-core` for that flow.

## Reading (free, plain NIP-01)

Search uses the standard NIP-01 REQ subscription mechanism with the `search` field added to the filter. Reading is free on TOON -- no ILP payment for subscriptions or queries.

Reads are free and speak plain NIP-01: the relay returns standard JSON `EVENT` messages, so parse them as ordinary Nostr events. TOON encodes the **write** payload sealed inside the ILP packet, never a relay response. The search response follows the same EVENT/EOSE pattern as any NIP-01 subscription:

1. Send a REQ message with a filter containing the `search` field
2. Receive EVENT messages matching the search criteria
3. Receive EOSE (End of Stored Events) to signal completion of stored results
4. Optionally keep the subscription open for new events matching the search

For the write payload's TOON encoding, read `skills/nostr-protocol-core/references/toon-protocol-context.md`.

## Social Context

Search on TOON has a distinctive property, and it is narrower than it first looks: every piece of content found via search arrived with a signed claim on a funded payment channel, so every result is attributable to a settlement identity. That is a gate, not a deterrent -- the relay charges 1 base unit of 6-decimal USDC, so nothing in the index was expensive to put there. Trust the attribution; do not infer effort or quality from the fact that something was paid for.

Search responsibly. Content found via search was published to specific relays by authors who paid for that privilege. Respect the context in which content was published.

Search results from TOON relays surface content published under attributable identities. Treat found content with the same respect -- and the same scepticism -- you would give to content you discovered organically.

**Anti-patterns to avoid:**
- Mass scraping via search queries -- running broad, automated searches to bulk-harvest content undermines the network and may trigger relay rate limiting
- Using search to find content for targeted harassment -- search is a discovery tool, not a weapon
- Assuming search is comprehensive -- NIP-50 support is optional and relay-specific; not all content on all relays is searchable
- Ignoring relay capabilities -- always check NIP-11 `supported_nips` before issuing search queries to avoid errors

For deeper social judgment guidance on engagement with discovered content, see `nostr-social-intelligence`.

## When to Read Each Reference

Read the appropriate reference file based on the situation:

- **Understanding NIP-50 search filter syntax, relay support detection, and search extensions** -- Read [nip-spec.md](references/nip-spec.md) for the full NIP-50 specification.
- **Step-by-step search workflows** -- Read [scenarios.md](references/scenarios.md) for basic text search, filtered search, checking relay support, and author-scoped search.
- **Understanding TOON-specific search behavior, quality signals, and capability detection** -- Read [toon-extensions.md](references/toon-extensions.md) for paid-write search considerations.
- **TOON read model, format parsing, and subscription mechanics** -- Read `skills/nostr-protocol-core/references/toon-protocol-context.md` (canonical protocol reference, D9-010).
- **Checking relay capabilities and NIP-11 support detection** -- See `relay-discovery` for NIP-11 relay information document parsing and NIP-50 support verification.
- **Referencing content found via search** -- See `content-references` for constructing `nostr:` URIs to link to discovered events.
