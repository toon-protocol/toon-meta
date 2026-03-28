# TOON Extensions for Search

> **Why this reference exists:** Search on TOON differs from vanilla Nostr because the ILP-gated relay model creates a natural quality filter. This file covers the TOON-specific considerations for full-text search -- the free read model, the quality signal from paid content, relay capability detection via the TOON `/health` endpoint, and TOON-format response parsing for search results.

## Search Is Free on TOON

Search is a read-only operation. No ILP payment is required to issue search queries or receive search results. The TOON economic model is "pay to write, free to read" -- this applies fully to search:

- **Searching costs nothing.** Agents can issue as many search queries as the relay allows without any ILP payment.
- **Reading search results costs nothing.** EVENT messages received in response to search queries are free to consume.
- **The content found was paid for.** Every event returned by a search query was published by an author who paid the ILP fee (`basePricePerByte * serializedEventBytes`). This is the source of the quality signal.

### No publishEvent() for Search

Search does not use `publishEvent()` from `@toon-protocol/client`. Search queries are sent as standard NIP-01 REQ messages over the WebSocket connection. The ILP payment pipeline is not involved in search operations.

If an agent wants to publish content that will be discoverable via search, that content must go through the standard TOON write path -- see `nostr-protocol-core` for the `publishEvent()` flow and fee calculation.

## Quality Signal from Paid Content

On a free Nostr relay, search results may include spam, low-effort posts, and noise. On TOON's ILP-gated relay, every piece of searchable content was paid for by its author. This creates a natural quality filter:

- **Economic barrier to spam.** Spammers must pay per-byte to publish, making mass spam economically unviable.
- **Author investment signal.** Content that appears in search results represents an economic commitment by the author. Longer, more detailed content costs more to publish, so its presence signals the author valued it enough to pay.
- **Higher signal-to-noise ratio.** Search results on TOON relays tend to be more substantive than on free relays because the cost barrier discourages low-effort content.

This quality signal is implicit -- TOON relays do not annotate search results with fee information. The quality improvement comes from the publishing barrier itself, not from any explicit ranking mechanism.

## TOON Relay Search Capability Detection

### Standard NIP-11 Detection

Check the relay's NIP-11 information document for NIP-50 support:

1. HTTP GET the relay URL with `Accept: application/nostr+json` header
2. Parse the `supported_nips` array
3. Check for `50` in the array

### TOON /health Endpoint

TOON relays expose an enriched `/health` endpoint (e.g., `http://localhost:3100/health`) that returns relay capabilities including:

- **Pricing information:** `basePricePerByte` and fee structure (relevant for publishing discoverable content, not for search itself)
- **ILP capabilities:** Connector status, payment channel information
- **Chain configuration:** Settlement chain, token network details
- **x402 status:** HTTP 402 payment endpoint status
- **TEE attestation:** Trusted execution environment status

The `/health` endpoint provides a superset of NIP-11 information. For search capability detection, the NIP-11 `supported_nips` check remains the canonical method, but the `/health` endpoint can provide additional context about the relay's overall capabilities.

### Capability Caching

Relay capabilities change infrequently. Cache the NIP-50 support status for each relay to avoid repeated NIP-11 or `/health` fetches. A reasonable cache TTL is 1-24 hours depending on the agent's requirements.

## Parsing Search Results in TOON Format

TOON relays return TOON-format strings in EVENT messages, not standard JSON objects. Search results follow the same format as any other EVENT message from a TOON relay.

### Parsing Flow

1. **Receive EVENT messages** from the search subscription
2. **Decode TOON-format strings** using the TOON decoder to extract event fields (`id`, `pubkey`, `created_at`, `kind`, `tags`, `content`, `sig`)
3. **Process the decoded events** as standard Nostr events -- extract content, tags, and metadata
4. **Receive EOSE** to know when all stored matches have been sent

### Search Result Processing

After decoding search results:

- **Extract content** from the `content` field for display or further processing
- **Parse tags** for metadata (title, summary, d-tag for articles, p-tags for mentions, etc.)
- **Resolve references** within found content using the `content-references` skill for `nostr:` URI extraction
- **Check event kind** to determine the content type (kind:1 for notes, kind:30023 for articles, etc.)

For complete TOON format parsing details, refer to `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`.

## Integration with Other Skills

- **relay-discovery:** Use NIP-11 parsing from the relay-discovery skill to detect NIP-50 support before issuing search queries.
- **content-references:** Use the content-references skill to construct `nostr:` URIs for referencing content found via search.
- **nostr-protocol-core:** The canonical reference for TOON format parsing, subscription mechanics, and the overall read model.
