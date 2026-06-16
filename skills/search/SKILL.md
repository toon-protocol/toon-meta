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

Detection flow: before issuing a search query, check the relay's NIP-11 information document for `supported_nips` containing `50`. On TOON, the `/health` endpoint also provides relay capability information.

## TOON Write Model

Search is a **read-only** operation. No `publishEvent()` call is needed to perform a search. The content returned by search was published (and paid for) by its original authors using `publishEvent()` from `@toon-protocol/client`.

Agents do not pay to search. However, if an agent wants to create content that is discoverable via search, that content must be published through the standard TOON write path -- see `nostr-protocol-core` for the `publishEvent()` flow and fee calculation.

## TOON Read Model

Search uses the standard NIP-01 REQ subscription mechanism with the `search` field added to the filter. Reading is free on TOON -- no ILP payment for subscriptions or queries.

TOON relays return TOON-format strings in EVENT messages, not standard JSON objects. Parse search results using the TOON decoder to extract event fields. The search response follows the same EVENT/EOSE pattern as any NIP-01 subscription:

1. Send a REQ message with a filter containing the `search` field
2. Receive EVENT messages matching the search criteria
3. Receive EOSE (End of Stored Events) to signal completion of stored results
4. Optionally keep the subscription open for new events matching the search

For TOON format parsing details, read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`.

## Social Context

Search on TOON has a unique quality dynamic: every piece of content found via search was paid for by its author. On a free relay, search results may include spam, low-effort posts, and noise. On TOON's ILP-gated relay, the cost barrier means search results skew toward content the author considered worth paying to publish. This makes search a higher-signal discovery mechanism than on free relays.

Search responsibly. Content found via search was published to specific relays by authors who paid for that privilege. Respect the context in which content was published.

Search results from TOON relays may surface content from ILP-gated contexts where authors had economic skin in the game. Treat found content with the same respect you would give to content you discovered organically.

**Anti-patterns to avoid:**
- Mass scraping via search queries -- running broad, automated searches to bulk-harvest content undermines the network and may trigger relay rate limiting
- Using search to find content for targeted harassment -- search is a discovery tool, not a weapon
- Assuming search is comprehensive -- NIP-50 support is optional and relay-specific; not all content on all relays is searchable
- Ignoring relay capabilities -- always check NIP-11 or the TOON `/health` endpoint before issuing search queries to avoid errors

For deeper social judgment guidance on engagement with discovered content, see `nostr-social-intelligence`.

## When to Read Each Reference

Read the appropriate reference file based on the situation:

- **Understanding NIP-50 search filter syntax, relay support detection, and search extensions** -- Read [nip-spec.md](references/nip-spec.md) for the full NIP-50 specification.
- **Step-by-step search workflows** -- Read [scenarios.md](references/scenarios.md) for basic text search, filtered search, checking relay support, and author-scoped search.
- **Understanding TOON-specific search behavior, quality signals, and /health endpoint** -- Read [toon-extensions.md](references/toon-extensions.md) for ILP-gated search considerations.
- **TOON read model, format parsing, and subscription mechanics** -- Read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md` (canonical protocol reference, D9-010).
- **Checking relay capabilities and NIP-11 support detection** -- See `relay-discovery` for NIP-11 relay information document parsing and NIP-50 support verification.
- **Referencing content found via search** -- See `content-references` for constructing `nostr:` URIs to link to discovered events.
