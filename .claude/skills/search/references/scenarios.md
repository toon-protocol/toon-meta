# Search Scenarios

> **Why this reference exists:** Agents need step-by-step workflows for common search operations on TOON. Each scenario shows the complete flow from intent to results, including TOON-specific considerations like relay capability detection and TOON-format response parsing. These scenarios bridge the gap between knowing the NIP-50 filter syntax (nip-spec.md) and knowing the TOON read mechanics (toon-extensions.md).

## Scenario 1: Basic Text Search

**When:** An agent wants to find notes containing specific text on a TOON relay.

**Why this matters:** Basic text search is the most common NIP-50 operation. On TOON, search is free (read-only) and results tend to be higher quality because content was paid to publish.

### Steps

1. **Check relay support.** Fetch the relay's NIP-11 information document (HTTP GET with `Accept: application/nostr+json` header). Verify `50` is in the `supported_nips` array. On TOON, also check the `/health` endpoint for search capability information.

2. **Construct the search filter.** Build a NIP-01 filter object with a `search` field:
   ```json
   {
     "kinds": [1],
     "search": "decentralized identity",
     "limit": 20
   }
   ```

3. **Send the REQ message.** Send `["REQ", "<subscription_id>", <filter>]` over the WebSocket connection to the relay.

4. **Receive and parse results.** The relay sends EVENT messages for each match, followed by EOSE. On TOON, EVENT messages contain TOON-format strings, not standard JSON -- decode using the TOON decoder before processing.

5. **Close the subscription.** Send `["CLOSE", "<subscription_id>"]` when done, unless you want to receive new events matching the search in real time.

### Considerations

- Search is a read-only operation -- no `publishEvent()` call and no ILP payment needed.
- TOON relay search results represent content that authors paid to publish, providing a natural quality filter.
- Set a reasonable `limit` to avoid receiving excessive results. Start with 20-50 and paginate if needed.

## Scenario 2: Filtered Search (Kind + Author + Search)

**When:** An agent wants to search for content by a specific author within a specific event kind.

**Why this matters:** Combining search with kind and author filters narrows results efficiently. This is useful for finding specific articles or notes from known authors.

### Steps

1. **Verify NIP-50 support** on the target relay (same as Scenario 1).

2. **Construct a combined filter.** Add `kinds`, `authors`, and `search` fields:
   ```json
   {
     "kinds": [30023],
     "authors": ["a1b2c3d4...hex-pubkey..."],
     "search": "payment channels",
     "limit": 10
   }
   ```

3. **Send the REQ message.** The relay applies all filter criteria: only kind:30023 events, by the specified author, containing "payment channels" in the searchable text.

4. **Parse TOON-format results.** Decode each EVENT message using the TOON decoder. Extract article metadata (title, summary, d-tag) from the event tags.

5. **Close the subscription** when done.

### Considerations

- Combining filters reduces the result set, making search more targeted and efficient.
- For kind:30023 articles, the `d` tag value serves as the article identifier. Use this with an `naddr1` reference to link to discovered articles (see `content-references` skill).
- Author pubkeys must be in 32-byte hex format in the filter, not bech32 npub1 format.

## Scenario 3: Checking Relay NIP-50 Support

**When:** An agent needs to determine whether a specific relay supports full-text search before issuing queries.

**Why this matters:** Sending search queries to relays that do not support NIP-50 produces unpredictable results -- the relay may ignore the `search` field entirely (returning unfiltered results), return an error NOTICE, or close the connection.

### Steps

1. **Fetch the NIP-11 document.** Make an HTTP GET request to the relay's WebSocket URL with the `Accept: application/nostr+json` header:
   - For `wss://relay.example.com`, GET `https://relay.example.com` with header `Accept: application/nostr+json`

2. **Parse the response.** The NIP-11 document is a JSON object with relay metadata.

3. **Check `supported_nips`.** Look for `50` in the `supported_nips` array:
   ```json
   {
     "supported_nips": [1, 2, 11, 50],
     "name": "Example Relay"
   }
   ```
   If `50` is present, the relay supports NIP-50 search.

4. **On TOON relays, check the `/health` endpoint.** TOON relays expose an enriched health endpoint at `/health` that includes relay capabilities, pricing, and ILP configuration. This can provide additional search capability information beyond the standard NIP-11 document.

5. **Cache the result.** Relay capabilities change infrequently. Cache the NIP-50 support status for each relay to avoid repeated NIP-11 fetches.

### Considerations

- Not all relays support NIP-50. Always check before issuing search queries.
- The NIP-11 document may also include other useful information: `payment_required`, `limitation` (rate limits, max message size), and relay software/version.
- For relay discovery and NIP-11 parsing details, see the `relay-discovery` skill.
- Some relays may support search but not advertise it in NIP-11. This is rare and unreliable -- treat NIP-11 as the source of truth.

## Scenario 4: Search with Time Range Filter

**When:** An agent wants to search for content within a specific time period.

**Why this matters:** Time-scoped search is essential for finding recent discussions, tracking topics over time, or avoiding stale results. Combining `search` with `since` and `until` creates a powerful temporal query.

### Steps

1. **Verify NIP-50 support** on the target relay.

2. **Construct a time-bounded search filter.** Use `since` and `until` with Unix timestamps:
   ```json
   {
     "kinds": [1, 30023],
     "search": "TOON protocol",
     "since": 1709251200,
     "until": 1711929600,
     "limit": 50
   }
   ```

3. **Send the REQ message.** The relay searches across kind:1 notes and kind:30023 articles within the specified time range.

4. **Parse TOON-format results.** Decode each EVENT message. The `created_at` field in each event confirms the timestamp falls within the requested range.

5. **Paginate if needed.** If the result count equals the `limit`, there may be more results. Adjust `until` to the `created_at` of the last received event and repeat the query to fetch the next page.

### Considerations

- `since` and `until` are Unix timestamps (seconds since epoch). Ensure correct format -- millisecond timestamps will produce no results.
- Searching across multiple kinds (e.g., `[1, 30023]`) returns a mixed result set. Filter by kind client-side if you need kind-specific processing.
- Time-range search is particularly useful on TOON because paid content tends to be more substantive and worth discovering through temporal queries.
- Reading search results is always free on TOON, regardless of how many results are returned or how many queries are made.
