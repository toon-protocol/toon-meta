---
name: relay-discovery
description: Relay discovery and network navigation on Nostr and TOON Protocol using
  NIP-11, NIP-65, and NIP-66. Covers relay information ("what relays are available?",
  "how do I check relay capabilities?", NIP-11, relay information document,
  supported_nips, payment_required), relay list metadata ("how do I publish my relay
  list?", kind:10002, relay list, r tag, read relay, write relay), relay monitoring
  ("how do I monitor relay health?", kind:30166, kind:10166, kind:10066, NIP-66
  relay discovery), finding a TOON relay's payment facts ("what does this relay
  charge?", "how do I find a node's price?", self-description, GET /ilp, route
  price), and relay evaluation ("how do I find a good relay?", "which relay should I
  use?", compare relays). Implements NIP-11, NIP-65, and NIP-66 on TOON's
  pay-to-write relay network.
---

# Relay Discovery (TOON)

Relay discovery and network navigation for agents on the TOON network. Covers NIP-11 (Relay Information Document) for querying relay capabilities via HTTP, NIP-65 (Relay List Metadata) for publishing and reading user relay preferences (kind:10002), and NIP-66 (Relay Discovery and Liveness Monitoring) for systematic relay health tracking. This is primarily a read-focused skill -- only kind:10002 relay list events are agent-writable.

## Read the Split First

Discovery on TOON is two separate questions with two separate answers, and conflating them is the single commonest mistake.

**Finding a relay to read from is the ordinary Nostr problem**, solved the ordinary Nostr way: NIP-65 relay lists, NIP-66 monitors, NIP-11 documents, word of mouth. Reads are free and **never touch a connector at all**. Nothing about that changed on TOON.

**Finding out what a relay charges is a different question with a different answer.** A TOON relay is an app sitting behind a **connector**, and the connector is what holds the price. You get it by asking that connector: `GET /ilp` on its URL returns its **self-description** -- addresses, settlement facts, every route's price. Free, unauthenticated (connector ADR 0050).

**A connector answers; it never announces.** There is no event that carries a node's price, no registry that collects them, and no mechanism by which a connector could publish one -- it has no idea where it would publish to. Copying self-descriptions into a discovery network is a **controller's** job, something built outside the connector by definition. If you are looking for the thing that used to do this automatically, it was removed on purpose and nothing replaced it in the connector.

**Retired:** `kind:10032` ILP peer info (ADR 0046 removed the announce), `kind:10035` / `SkillDescriptor` service discovery, `kind:10036` seed relay lists, and a `/health` endpoint carrying pricing. Do not subscribe for these kinds -- nothing publishes them.

## Relay Information (NIP-11)

NIP-11 defines the Relay Information Document, an HTTP GET endpoint that returns JSON metadata about a relay's capabilities. Send a GET request with `Accept: application/nostr+json` header to the relay's WebSocket URL (replacing `wss://` with `https://`).

### Standard NIP-11 Fields

- `name` -- Relay name
- `description` -- Relay description
- `pubkey` -- Relay operator's pubkey
- `contact` -- Operator contact
- `supported_nips` -- Array of supported NIP numbers
- `software` -- Relay software identifier
- `version` -- Software version
- `limitation` -- Object with `max_message_length`, `max_subscriptions`, `max_filters`, `auth_required`, `payment_required`, `restricted_writes`, etc.
- `limitation.payment_required` -- Boolean indicating if the relay requires payment (critical for TOON -- always `true`). This field is inside the `limitation` object, not top-level.
- `retention` -- Array of retention policy objects
- `fees` -- Payment fee structure

### The Relay's /health Endpoint Is Liveness Only

The relay app does serve `GET /health` on its write port, but it is a container healthcheck, not a discovery surface. The relay is a plain read/write app with no payment, connector or settlement layer of its own, so the response is deliberately minimal:

```json
{
  "status": "healthy",
  "pubkey": "<64-char hex>",
  "capabilities": ["relay"],
  "version": "<software version>",
  "timestamp": 1756400000000
}
```

That is the whole document. **It carries no pricing, no ILP address, no chain configuration and no attestation state**, because the relay does not know any of those things -- the connector in front of it does. Do not read a price from `/health`; there has never been one there to read on the deployed relay.

### Payment Facts Come From the Connector

Ask the connector that fronts the relay:

```
GET https://proxy.relay.devnet.toonprotocol.dev/ilp
```

The **self-description** it returns carries the node's ILP addresses, its settlement facts (chain, token, decimals) and every route's price. From the client, the same question is `client.describe()`, or `client.routePrice(destination)` for one route's terms.

An unpaid request to a priced route is answered with a **greeting** carrying that route's terms -- never the work. The word is *greeting*.

**Live devnet**, probed 2026-08-28:

| Destination | Terminates at | Price (base units of 6-dp USDC) |
|-------------|---------------|--------------------------------|
| `g.toon.relay` | relay box | **1**, flat |
| `g.toon.store`, `g.toon.relay.store` | store box | **base 1000, plus 10 per KiB** |
| `g.toon.gas` | gas box | **1000** |

Ask the node rather than trusting this table. An ILP address is **self-asserted -- a claim, not a grant** -- so reachability is the only registry there is. **Nothing answers at `g.toon` itself** (the apex was destroyed 2026-08-14), and every `g.proxy…` address is dead.

## Relay List Metadata (NIP-65)

NIP-65 defines kind:10002 events for publishing a user's relay preferences. Each relay is listed with an optional read/write marker.

### kind:10002 Structure

```json
{
  "kind": 10002,
  "tags": [
    ["r", "wss://relay1.example.com", "read"],
    ["r", "wss://relay2.example.com", "write"],
    ["r", "wss://relay3.example.com"]
  ],
  "content": ""
}
```

- `r` tag with no marker: relay used for both read and write
- `r` tag with `read`: relay used only for reading
- `r` tag with `write`: relay used only for writing

kind:10002 is a replaceable event -- publishing a new one replaces the previous relay list.

## Relay Discovery and Liveness (NIP-66)

NIP-66 defines events for systematic relay monitoring:

- **kind:30166 (Relay Discovery)** -- Published by relay monitors, contains relay metadata snapshots with `d` tag set to the relay URL
- **kind:10166 (Relay Monitor Registration)** -- Published by monitors to register themselves
- **kind:10066 (Relay List for Monitoring)** -- List of relays being monitored

### NIP-66 Tag Structures

kind:30166 tags: `["d", "wss://relay.example.com"]`, `["n", "clearnet"]` or `["n", "tor"]`, `["N", "11"]` (supported NIPs), `["R", "read"]`/`["R", "write"]` (relay type), `["T", "pay-to-relay"]` (relay tags).

kind:10166 tags: `["timeout", "open", "5000"]`, `["timeout", "read", "15000"]`, `["timeout", "write", "15000"]`, `["frequency", "3600"]` (check interval in seconds).

## TOON Write Model

Only kind:10002 relay list events are agent-writable in this skill. Publish with `await client.send({ body: signedEvent })` from `@toon-protocol/client` -- `send()` seals the payload, asks the connector the route's price, mints the covering claim and carries it.

Publishing your relay list costs one packet. On `g.toon.relay` the price is **flat**, so a list of three relays and a list of thirty cost exactly the same: what you pay for is the act of republishing, not the size of the list.

For the publishing flow in full, read `skills/nostr-protocol-core/references/toon-protocol-context.md`.

## Reading (free, plain NIP-01)

Query NIP-11 relay information via HTTP GET. Subscribe to kind:10002 events to discover user relay preferences. Subscribe to kind:30166 events for relay monitoring data. **Reads speak plain NIP-01** -- the relay returns standard JSON `EVENT` messages, so no decoder is needed and any ordinary Nostr client works. Reading is free and never touches a connector.

TOON encoding applies to the **write payload** the connector carries sealed, not to a read response: TOON on the way in, plain NIP-01 JSON on the way out.

**Important:** `nostr-tools` SimplePool does NOT work in Node.js containers (no global WebSocket + TOON format incompatible). Use direct WebSocket connections or the TOON client for relay communication.

For the read/write encoding split in full, read `skills/nostr-protocol-core/references/toon-read-model.md`.

## Bootstrapping: There Is No Seed Event

kind:10036 "seed relay list" was a TOON-specific bootstrap event. **Nothing on the fleet publishes or consumes it.** The event type survives in the legacy `@toon-protocol/core` package, but no relay emits one and no client looks for one, so subscribing for kind:10036 returns nothing forever.

An agent bootstraps from a **URL a person gave it** -- the connector it is configured against:

```typescript
const client = await ToonClient.create({
  connector: 'https://proxy.relay.devnet.toonprotocol.dev',
  mnemonic: process.env.TOON_MNEMONIC,
});
```

From that one URL, `GET /ilp` yields everything else, and `send()` with no destination goes to the address that node published for itself. Configuring a client is then just a URL, which is the thing a person actually has. Widening from one known node to many is a **controller's** problem, not the connector's and not this skill's.

## Social Context

Relay choice matters on TOON. A paid relay signals commitment -- every writer holds a funded payment channel and every write draws a claim against it, which is a real barrier to entry that free relays do not have. Be honest about its size, though: the relay route charges 1 base unit of 6-decimal USDC, so this is a **gate**, not a price that deters anyone. What it buys is attribution and a settlement trail. When recommending relays, present the economic model that way.

Choosing the right relays directly impacts content visibility and audience reach. Publishing to well-connected relays increases the likelihood that other agents and clients will see your events. Conversely, publishing only to obscure or poorly-connected relays limits your reach.

Relay diversity provides resilience against downtime and censorship. Using multiple relays across different operators and geographic regions ensures events remain accessible even if one relay goes offline. Avoid depending on a single relay for all read and write operations.

Relay selection also affects cost -- different relays sit behind different connectors and price their routes differently. Compare by asking each one: `GET /ilp`, or `client.routePrice()`. There is no table to look the answer up in.

Publishing your relay list (kind:10002) is a public statement about which relays you trust and use. Keep it accurate and up to date. Each republish costs one packet, so batch relay changes into a single update rather than republishing per change -- the saving is in the number of writes, not in their size.

**Anti-patterns to avoid:**
- Querying NIP-11 without the `Accept: application/nostr+json` header -- may return HTML instead of JSON
- Assuming all relays support the same NIPs -- always check `supported_nips` first
- Ignoring `payment_required: true` on TOON relays -- every write must arrive through the connector carrying a covering claim
- Publishing kind:10002 updates for every individual relay change -- batch changes into a single replaceable event; you pay per write, and length is free
- Looking for pricing on the relay -- neither NIP-11 nor the relay's `/health` carries a price. Ask the connector in front of it: `GET /ilp`
- Reaching for `@toon-format/toon` to parse a relay subscription -- relay reads are standard JSON and there is nothing to decode
- Using `nostr-tools` SimplePool in Node.js containers -- it lacks a global WebSocket
- Subscribing for kind:10032, kind:10035 or kind:10036 -- these were removed and nothing publishes them; the subscription simply never fires
- Trusting NIP-66 monitor data without verifying monitor reputation -- kind:30166 events come from third-party monitors, not relays themselves
- Listing relays you do not actively use in kind:10002 -- it misleads clients about your preferences (and on a flat route the extra bytes are free, so length is no excuse for accuracy)

## When to Read Each Reference

Read the appropriate reference file based on the situation:

- **Understanding NIP-11, NIP-65, and NIP-66 specifications** -- Read [nip-spec.md](references/nip-spec.md) for the relay discovery specifications.
- **Finding a node's addresses, price and settlement facts** -- Read [toon-extensions.md](references/toon-extensions.md) for the self-description, `GET /ilp`, and what the relay's own `/health` does and does not carry.
- **Step-by-step relay discovery workflows** -- Read [scenarios.md](references/scenarios.md) for querying relays, publishing relay lists, and monitoring on TOON.
- **TOON write model, read model, and pricing details** -- Read `skills/nostr-protocol-core/references/toon-protocol-context.md` (canonical protocol reference, D9-010).
- **Paying a NIP-90 provider** -- The provider is an app behind a connector like any other; its price is on that connector's `GET /ilp`, not on a kind:10035 announce. See `nostr-protocol-core` for the write flow.
- **Social judgment on relay selection** -- See `nostr-social-intelligence` for base social intelligence guidance.
- **Identity and relay list overlap** -- See `social-identity` for kind:0 profiles, which complement kind:10002 relay lists as identity declarations.
- **Relay sets for curation** -- See `lists-and-labels` for NIP-51 relay sets (kind:30002) which organize relays by purpose beyond the basic kind:10002 relay list.
- **Content references in relay contexts** -- See `content-references` for nostr: URI scheme used in relay-related event references.
