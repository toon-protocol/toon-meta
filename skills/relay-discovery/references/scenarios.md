# Relay Discovery Scenarios

> **Why this reference exists:** Agents need step-by-step workflows for common relay discovery operations on TOON. Each scenario shows the complete flow from intent to result, including TOON-specific considerations like the node self-description and the `send()` API for relay lists. Reads themselves are ordinary: the relay speaks plain NIP-01 and returns standard JSON. These scenarios bridge the gap between knowing the NIP-11/65/66 specifications (nip-spec.md) and knowing the TOON publishing mechanics (toon-extensions.md).

## Scenario 1: Querying a Relay's NIP-11 Information

**When:** An agent wants to check a relay's capabilities before connecting via WebSocket.

**Why this matters:** NIP-11 tells you what a relay supports -- which NIPs, what limitations, whether payment is required. On TOON, all relays require payment, but NIP-11 also reveals message size limits, supported event kinds, and relay identity.

### Steps

1. **Determine the HTTP URL.** Replace the WebSocket scheme with HTTPS: `wss://relay.example.com` becomes `https://relay.example.com`.

2. **Send an HTTP GET request** with the header `Accept: application/nostr+json`. This header is critical -- without it, the relay may return HTML instead of JSON.

3. **Parse the JSON response.** Extract key fields: `supported_nips` (what the relay supports), `limitation` (size and rate constraints), `payment_required` (always `true` on TOON), and `fees`.

4. **Check `supported_nips`** before attempting to use specific event kinds. For example, verify NIP-28 support before creating chat channels, or NIP-65 support before publishing relay lists.

5. **Check `limitation`** for `max_message_length` and `max_content_length` to ensure your events will fit.

### Considerations

- Always include the `Accept: application/nostr+json` header. This is the most common error when querying NIP-11.
- NIP-11 is an HTTP endpoint, not a Nostr event. No WebSocket connection or ILP payment is needed.
- NIP-11 tells you *that* payment is required (`limitation.payment_required`). It does not tell you *how much*. For price, ILP addresses and settlement facts, ask the connector in front of the relay -- see Scenario 2.

## Scenario 2: Asking a Node What It Charges

**When:** An agent wants a relay's write price, its ILP addresses, or its settlement facts.

**Why this matters:** **A connector answers; it never announces.** No event carries a node's price and no registry collects them -- you ask the node directly. Its **self-description** is the single free, unauthenticated document that holds all of it (connector ADR 0050).

### Steps

1. **Send an HTTP GET** to the connector's `/ilp`, e.g. `https://proxy.relay.devnet.toonprotocol.dev/ilp`. No special headers. Note this is the **connector's** URL, not the relay app's -- the relay does not know its own price.

2. **Read the route table.** Every route the node terminates appears with its price: a base figure, plus a `pricePerKib` when the route meters by size. Longest matching prefix wins.

3. **Read the settlement facts** -- chain, token and decimals. Settlement is USDC on Base Sepolia (`evm:84532`) and Solana devnet.

4. **Read the sealing key.** A payload must be sealed to the connector that *terminates* the route.

From the client, the same two questions:

```typescript
const description = await client.describe();            // the whole document
const terms = await client.routePrice('g.toon.relay');  // one route's terms
```

`null` from `routePrice` is an **answer** -- "I do not terminate that" -- not a failure. A connector that could not be reached throws instead.

5. **If you need the exact figure a packet will carry,** hand the terms to `chargeFor(terms, sealedBytes)`. You will rarely need to: `send()` calls it for you and pays the full charge without being asked.

### Considerations

- No payment is required. `GET /ilp` is free and unauthenticated.
- **An unpaid request to a priced route gets a greeting** -- that route's terms, never the work.
- You **cannot** compute a charge from your own event. The metered quantity is the **sealed** payload, not the event JSON, which is smaller by the envelope and the wrap. Ask, do not multiply. The unit is a **kibibyte**; a per-byte price never existed.
- The relay app's own `GET /health` is a container healthcheck -- `status`, `pubkey`, `capabilities`, `version`, `timestamp`. It carries no pricing, no ILP address and no chain configuration, because the relay does not know them.
- **Retired:** `kind:10032` peer info, `kind:10035` / `SkillDescriptor`, a `/health` endpoint returning pricing, and `basePricePerByte`. ADR 0046 removed the announce; ADR 0061 and ADR 0065 replaced the money model.

## Scenario 3: Publishing Your Relay List (kind:10002)

**When:** An agent wants to publish its relay preferences so other users and clients can discover where it reads and writes.

**Why this matters:** Your relay list is a public declaration of which relays you use. On TOON, publishing it costs one packet, so batch changes rather than republishing per change.

### Steps

1. **Compile your relay list.** Decide which relays you use for reading, writing, or both. Include only relays you actively use.

2. **Construct the kind:10002 event.** Add `r` tags for each relay:
   - `["r", "wss://relay1.example.com"]` -- used for both read and write
   - `["r", "wss://relay2.example.com", "read"]` -- read only
   - `["r", "wss://relay3.example.com", "write"]` -- write only

   Set content to empty string (`""`).

3. **Sign the event** using your Nostr private key.

4. **Send it.** `await client.send({ body: signedEvent })` from `@toon-protocol/client`. `send()` seals the payload, asks the connector the route's price, mints the covering claim and carries it -- you do not price the packet and do not sign a claim by hand.

   A refusal comes back as `{ fulfilled: false, code, message }` and is never thrown. `F03` means the claim did not cover the charge; there is no `F04`.

### Considerations

- kind:10002 is a replaceable event. Each new publication replaces the previous relay list entirely.
- Each update costs **one packet**. On `g.toon.relay` the price is flat at 1 base unit of 6-dp USDC, so a three-relay list and a thirty-relay list cost exactly the same. Batch all relay changes into a single update -- the saving is in the number of writes, not their size.
- Omit the read/write marker when a relay serves both purposes; it defaults to both. This is a clarity choice, not a cost saving.
- Only list relays you actively use. A bloated relay list misleads clients about your preferences -- that is the reason to trim it, not the bytes.

## Scenario 4: Discovering Another User's Relays (kind:10002)

**When:** An agent wants to find which relays a specific user reads from and writes to, in order to deliver messages or fetch their events.

**Why this matters:** Knowing a user's relay list enables efficient event delivery and discovery. Rather than broadcasting to every known relay, you can target only the relays where the user is active.

### Steps

1. **Subscribe to kind:10002 events** from the target user. Filter: `{ "kinds": [10002], "authors": ["<target-user-hex-pubkey>"] }`.

2. **Parse the standard JSON response.** The relay speaks plain NIP-01 and returns a standard JSON event -- there is nothing to decode.

3. **Extract `r` tags.** Each `r` tag specifies a relay URL and optional read/write marker.

4. **Build a relay map:**
   - Tags with no marker or both capabilities: use for both reading the user's events and sending events to them
   - Tags with `"read"` marker: the user reads from this relay -- publish events here if you want them to see your content
   - Tags with `"write"` marker: the user writes to this relay -- subscribe here to read their events

5. **Connect to relevant relays.** For fetching the user's events, connect to their `write` and unmarked relays. For sending them content, publish to their `read` and unmarked relays.

### Considerations

- Reading kind:10002 events is free on TOON -- no ILP payment required.
- Since kind:10002 is a replaceable event, you will receive at most one event (the latest).
- If a user has not published a kind:10002 event, you cannot determine their relay preferences programmatically. Fall back to known relays.
- `nostr-tools` SimplePool does NOT work in Node.js containers. Use direct WebSocket connections or the TOON client.

## Scenario 5: Monitoring Relay Liveness via NIP-66

**When:** An agent wants to discover which relays are online, their response times, and their capabilities, using data from relay monitor services.

**Why this matters:** NIP-66 provides systematic relay health data published by dedicated monitor services. This enables agents to make informed relay selection decisions based on liveness, latency, and capabilities.

### Steps

1. **Find active relay monitors.** Subscribe with filter: `{ "kinds": [10166] }`. This returns monitor registration events with their timeout and frequency parameters.

2. **Discover monitored relays.** For a specific monitor, subscribe with filter: `{ "kinds": [10066], "authors": ["<monitor-hex-pubkey>"] }`. This returns the list of relays the monitor tracks.

3. **Get relay status data.** Subscribe with filter: `{ "kinds": [30166] }` to receive relay discovery events. Each kind:30166 event contains a snapshot of a relay's status.

4. **Parse the standard JSON responses.** kind:30166 events arrive as ordinary NIP-01 JSON -- no decoder needed.

5. **Extract status information from tags:**
   - `d` tag: relay URL
   - `s` tag: status (`"online"` or `"offline"`)
   - `rtt` tags: round-trip times for open, read, and write operations
   - `N` tags: supported NIP numbers
   - `T` tags: relay type (e.g., `"pay-to-relay"` for TOON relays)
   - `n` tag: network type (`"clearnet"` or `"tor"`)

6. **Filter for TOON-compatible relays.** Look for relays with `["T", "pay-to-relay"]` tags to find ILP-gated relays.

7. **Sort by latency.** Use `rtt` tag values to rank relays by response time for your use case.

### Considerations

- All NIP-66 reading is free on TOON.
- kind:30166 is a parameterized replaceable event keyed by the relay URL (`d` tag). You receive the latest snapshot per relay per monitor.
- NIP-66 data is published by third-party monitor services, not by the relays themselves. Trust the monitor's reputation.
- NIP-66 carries no pricing. For a relay's price, ask the connector in front of it: `GET /ilp`, or `client.routePrice()`.

## Scenario 6: Finding Pay-to-Relay Relays

**When:** An agent wants to discover all ILP-gated relays in the network, such as when building a relay selection UI or choosing where to publish.

**Why this matters:** TOON relays are pay-to-relay by nature. Finding them via NIP-66 monitoring data enables agents to build a map of the paid relay network.

### Steps

1. **Subscribe to kind:30166 events with a tag filter.** Filter: `{ "kinds": [30166], "#T": ["pay-to-relay"] }`. This returns only relay discovery events tagged as pay-to-relay.

2. **Parse the standard JSON responses.** Events arrive as ordinary NIP-01 JSON -- no decoder needed.

3. **For each discovered relay, extract the URL** from the `d` tag.

4. **Ask each relay's fronting connector** for its self-description (`GET /ilp`) to get its price, addresses and settlement facts.

5. **Compare relays** based on:
   - the write route's **price** -- from `client.routePrice(destination)`; note a flat route charges the same whatever you write
   - `peerCount` / `channelCount` -- more peers indicate better network connectivity
   - **settlement compatibility** -- the self-description states the node's chains and tokens (USDC on Base Sepolia `evm:84532` and Solana devnet)
   - `tee.attested` and `tee.state` -- prefer attested relays with `"valid"` state for sensitive operations
   - `rtt` values from kind:30166 -- lower latency is better

6. **Select relays** based on your criteria and update your kind:10002 relay list if appropriate.

### Considerations

- Combining NIP-66 monitoring data with the fronting connector's self-description gives the most complete picture of a TOON relay: liveness from one, price from the other.
- Not every `pay-to-relay` relay is a TOON relay -- the `T` tag is a general classifier. Verify by asking for a self-description: a node that answers `GET /ilp` with route prices is one; a node that does not, is not.
- Relay selection is a public signal. The relays you list in kind:10002 reflect your network preferences.
