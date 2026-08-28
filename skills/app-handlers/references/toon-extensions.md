# TOON Extensions for App Handlers

> **Why this reference exists:** Application handlers on TOON differ from vanilla Nostr because writes are ILP-gated and services describe themselves over ILP rather than through an advertisement event. This file covers TOON-specific considerations for publishing handler information and recommendations, DVM service discovery, parameterized replaceable cost advantages, and building TOON-aware application handlers.

## Publishing App Handler Events on TOON

All event publishing on TOON goes through `send()` from `@toon-protocol/client`. Raw WebSocket writes are rejected -- the relay requires ILP payment for every event.

### Publishing Flow for kind:31990 (Handler Information)

1. **Construct the event:** Build the kind:31990 event with `d` tag (app identifier), `k` tags (handled kinds), platform URL tags, relay hint tags, and markdown content description.
2. **Sign the event:** Use nostr-tools or equivalent to sign with the application publisher's private key.
3. **Send it:** `await client.send({ body: signedEvent })`. The client seals the payload to the terminating connector, reads the route's price, mints the covering claim and carries it -- there is no separate pricing, claim-signing or publish step.

### Publishing Flow for kind:31989 (Recommendation)

1. **Construct the event:** Build the kind:31989 event with `d` tag (recommended-for kind), `a` tag(s) referencing kind:31990 handler events, and optional review text in content.
2. **Sign the event.**
3. **Send it:** `await client.send({ body: signedEvent })`, exactly as for kind:31990. The relay route is flat-priced, so the recommendation costs the same as the handler listing.

### Pricing the Write

The relay route (`g.toon.relay`) is flat: **1 base unit of 6-decimal USDC per event**, whatever the payload length. Where you genuinely need the price in advance, ask rather than multiply: `await client.routePrice(destination)` returns `{ price, pricePerKib? }`, then `chargeFor(terms, sealedBytes)` from `@toon-protocol/client`. The metered quantity is the **sealed** payload -- the gift-wrapped bytes the PREPARE carries -- so a charge cannot be computed from the event JSON you wrote. TOON format is the encoding of that sealed write payload; it is not what a relay serves on a read.

### Error Handling

- **F03 (INVALID_AMOUNT):** The claim does not cover the charge -- underpayment. Let `send()` price the packet rather than supplying an amount of your own.
- **A REJECT is returned, not thrown:** it comes back as `{ fulfilled: false }`.
- **Relay rejection:** Malformed event (invalid signature, missing required tags). Fix and republish.

## Parameterized Replaceable Cost Advantages

Both kind:31990 and kind:31989 are parameterized replaceable events. This has significant cost implications on TOON:

### Update Economics

- **No accumulation cost:** Updating an app listing or changing a recommendation replaces the old event. You pay per update, but the relay stores only one version per pubkey + kind + d-tag combination.
- **Predictable storage:** Unlike regular events that accumulate indefinitely, parameterized replaceable events have bounded storage. An app that updates its listing 100 times still occupies one event slot.
- **Version cost:** Each update costs the same flat relay price. An app that frequently updates its listing will spend more in aggregate, but a longer listing costs no more than a short one.

### Comparison with Non-Replaceable Events

| Aspect | Parameterized Replaceable (kind:31990/31989) | Regular Events |
|--------|----------------------------------------------|----------------|
| Storage | One event per pubkey + d-tag | Accumulates |
| Update cost | Flat relay price per update | Flat relay price per post |
| Delete | Replace with empty or use NIP-09 | NIP-09 only |
| Addressing | `naddr1` (kind + pubkey + d-tag) | `nevent1` (event ID) |

## DVM Service Discovery

There is no service-advertisement event to pair with a kind:31990 listing. A TOON connector **answers, it never announces**: `GET /ilp` on a node's URL returns its self-description -- its addresses, its settlement facts (chain, token, decimals) and every route's price. It is free and unauthenticated. An unpaid request to a priced route is answered with a **greeting** carrying that route's terms.

So the division is: NIP-89 advertises the user-facing app and which event kinds its UI handles; the DVM's own connector answers for the compute service and what it charges. To learn a DVM's price, fetch its `GET /ilp` (or ask the client: `await client.routePrice(destination)`) -- do not look for it in an event.

To find apps that handle a DVM kind, the ordinary NIP-89 query still applies:

```json
["REQ", "dvm-apps", { "kinds": [31990], "#k": ["5600"] }]
```

## Building TOON-Aware Application Handlers

Applications that advertise handling TOON-specific event kinds must support TOON's unique requirements:

### Write Support

If an app's kind:31990 event includes `["web", "...", "write"]` for event kinds on TOON, the app must integrate with `@toon-protocol/client` for publishing. Specifically:

- **ILP payment flow:** The app calls `client.send({ body: signedEvent })`, which seals, prices and mints the claim. The app never builds an ILP packet and never signs a claim by hand.
- **Error handling:** The app must handle F03 (INVALID_AMOUNT, i.e. underpayment) and relay rejections gracefully, remembering that a REJECT is returned as `{ fulfilled: false }` rather than thrown.
- **Payment channel management:** The app should manage payment channels or guide users through channel setup.

### Read Support

If an app handles reading TOON events:

- **Plain NIP-01 reads:** The relay returns standard JSON `EVENT` messages. No decoder, and no TOON-specific read path -- an ordinary Nostr client library is enough.
- **Free reads:** Reading is free on TOON -- no ILP payment needed for subscriptions or queries, and a free read never touches a connector.

### Advertising TOON Support

Apps that support TOON should indicate this in their kind:31990 content description. There is no standardized tag for TOON support, so include it in the markdown:

```markdown
# MyTOONApp

A TOON-native Nostr client with full ILP payment integration.

## TOON Support
- ILP-gated publishing, priced by the client
- Payment channel management
- Plain NIP-01 reads, multi-relay routing
```

Additionally, include TOON relay URLs in `r` tags to signal where the app operates:

```json
["r", "wss://relay.toon-protocol.com"]
```

## Reading App Handler Events from TOON Relays

The relay answers reads in plain NIP-01 -- standard JSON `EVENT` messages. To extract app handler information:

1. **Parse the `d` tag** to identify the application or the recommended-for kind.
2. **Extract `k` tags** (for kind:31990) to determine handled kinds.
3. **Parse platform URL tags** (`web`, `ios`, `android`) to extract access URLs.
4. **Parse `a` tags** (for kind:31989) to identify recommended apps.
5. **Read the content field** for the app description or review text.

All reads are free on TOON -- no ILP payment needed.

## Integration with Protocol Core

For the complete TOON write model, read model, and pricing details, refer to `skills/nostr-protocol-core/references/toon-protocol-context.md`. This file covers app-handler-specific extensions; the protocol core covers the foundational mechanics shared by all event kinds.
