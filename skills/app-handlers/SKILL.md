---
name: app-handlers
description: Application handler discovery and recommendation on Nostr and TOON Protocol using NIP-89. Covers application handler information ("how do I advertise my app on Nostr?", "how do I register an application handler?", kind:31990, application handler, app info, handled kinds, platform URLs), application handler recommendations ("how do I recommend an app?", "how do I endorse an application?", kind:31989, app recommendation, app endorsement), app discovery ("how do I discover apps on Nostr?", "how do I find an app for a specific event kind?", "what app handles kind:30023?", NIP-89, application discovery), and TOON-aware app integration ("how do apps work with TOON?", "application handler for TOON events", "app handler for DVM"). Implements NIP-89 on TOON's ILP-gated relay network.
---

# App Handlers (TOON)

Application handler discovery and recommendation for agents on the TOON network. Covers two parameterized replaceable event kinds (kind:31990 handler information, kind:31989 handler recommendations) from NIP-89. On TOON, advertising an application and recommending one are both ILP-gated writes -- registering your app in the ecosystem costs money, making handler advertisements a skin-in-the-game signal of commitment.

## Application Handler Model

NIP-89 defines a two-layer discovery system: applications advertise themselves (kind:31990), and users recommend applications they trust (kind:31989).

### kind:31990 -- Application Handler Information

A kind:31990 event is a parameterized replaceable event where an application advertises which event kinds it can handle and on which platforms it is available. The `d` tag serves as the application identifier (typically the app's well-known name or a unique identifier). Being parameterized replaceable means the app can update its handler information by publishing a new event with the same `d` tag -- only the latest version is retained by relays.

**Content field:** Markdown description of the application (features, capabilities, target audience).
**Required tags:** `d` (application identifier), at least one `k` tag (event kind the app handles, as a string).
**Platform tags (optional):** `web` (URL template), `ios` (App Store URL or URI scheme), `android` (Play Store URL or URI scheme). URL templates can include `<bech32>` placeholder for entity-specific deep links.
**Optional tags:** `r` (relay hint URLs where the app publishes).

A single app can handle multiple kinds by including multiple `k` tags. URL templates with `<bech32>` enable direct deep-linking to specific events or profiles within the app.

### kind:31989 -- Application Handler Recommendation

A kind:31989 event is a parameterized replaceable event where a user recommends an application for handling a specific event kind. The `d` tag contains the event kind being recommended for (as a string). Being parameterized replaceable means a user can change their recommendation for a given kind by publishing a new event with the same `d` tag.

**Content field:** Optional review or endorsement text explaining why the user recommends this app.
**Required tags:** `d` (event kind being recommended for, as string), `a` (referencing the kind:31990 handler info event in the format `31990:<pubkey>:<d-tag>`).
**Optional tags:** Additional `a` tags for recommending multiple apps for the same kind.

A user publishes one recommendation event per kind they want to recommend apps for. Multiple `a` tags in a single event recommend multiple apps for that kind, ordered by preference.

## TOON Write Model

Both kind:31990 and kind:31989 are published via `client.send({ body: signedEvent })` from `@toon-protocol/client`. Raw WebSocket writes are rejected -- the relay requires ILP payment. `send()` seals the payload, reads the route's price, mints the covering claim and carries it; there is no separate pricing, claim-signing or publish step. TOON format is the encoding of that sealed write payload -- the bytes the connector carries inside the ILP packet -- and never what a relay serves back on a read, which is plain NIP-01 JSON.

**Cost:** The relay route (`g.toon.relay`) is flat-priced at 1 base unit of 6-decimal USDC per event. A handler information event with a markdown description, 3-5 `k` tags, platform URLs, and relay hints costs the same as a bare recommendation event -- size does not change the price. Do not compute a charge from the event JSON you wrote: the metered quantity is the sealed payload the PREPARE carries, and `send()` prices the packet itself.

**Parameterized replaceable cost advantage:** Both kinds are parameterized replaceable. Updating an app listing or changing a recommendation replaces the old event rather than accumulating entries. Each update costs the same flat price, and the relay retains one version -- storage stays bounded.

For the complete pricing model and publishing flow, read `skills/nostr-protocol-core/references/toon-protocol-context.md`.

## Reading (free, plain NIP-01)

Reading handler information and recommendations is free. Subscribe using NIP-01 filters:
- `kinds: [31990]` for all application handler listings
- `kinds: [31990], #k: ["1"]` for apps that handle kind:1 (short notes)
- `kinds: [31989], authors: [<pubkey>]` for a specific user's app recommendations
- `kinds: [31989], #d: ["30023"]` for recommendations for kind:30023 handlers

Reads speak plain NIP-01: the relay returns standard JSON `EVENT` messages, so any ordinary Nostr client can read handler listings without a decoder. A free read never touches a connector. For the protocol details, read `skills/nostr-protocol-core/references/toon-protocol-context.md`.

## Social Context

Application handler advertisements (kind:31990) are a form of self-promotion. On TOON a listing cannot be posted anonymously: a write requires an open payment channel and a signed claim, so every advertisement is bound to a funded identity. The price is a base unit, not a barrier -- it is the gate, not the deterrent, that keeps drive-by listings out. Keep descriptions honest and accurate. Do not overclaim capabilities your app does not have.

Recommendations (kind:31989) carry social weight. On a paid network, spending money to endorse an app is a meaningful signal. Recommend apps you genuinely use and trust. Avoid recommending apps for compensation without disclosure -- paid endorsements without transparency erode trust.

Apps that handle TOON-specific event kinds should support the ILP payment flow. An app advertising that it handles kind:1 notes on TOON but lacking ILP integration would frustrate users. If your app handles TOON events, integrate with `@toon-protocol/client` for write operations; reads need nothing special, since the relay answers in plain NIP-01 JSON.

For DVM integration, there is no service-advertisement event to publish alongside a handler listing: a TOON connector answers, it never announces. A node's own `GET /ilp` returns its addresses, settlement facts and every route's price (see the `toon-extensions.md` reference).

**Anti-patterns to avoid:**
- Advertising an app as handling kinds it does not actually support (wastes users' trust and your money)
- Spamming recommendations for apps you have not used (each one is a write traceable to your channel)
- Publishing handler info without platform URLs -- an app listing with no way to access the app is useless
- Recommending competing apps sarcastically or negatively in the review content -- recommendations are endorsements, not attack vectors
- Failing to update kind:31990 when your app adds or removes kind support (stale listings mislead users)

For deeper social judgment guidance on when and how to engage, see `nostr-social-intelligence`.

## When to Read Each Reference

Read the appropriate reference file based on the situation:

- **Constructing kind:31990 or kind:31989 events, understanding tag formats and URL templates** -- Read [nip-spec.md](references/nip-spec.md) for the full NIP-89 specification with tag tables for both kinds.
- **Step-by-step workflows for advertising apps, recommending apps, and discovering handlers** -- Read [scenarios.md](references/scenarios.md) for complete TOON publishing scenarios.
- **Understanding TOON-specific extensions: DVM service discovery via `GET /ilp`, parameterized replaceable cost savings, TOON-aware client considerations** -- Read [toon-extensions.md](references/toon-extensions.md) for ILP-gated app handler extensions.
- **TOON write model, read model, and pricing details** -- Read `skills/nostr-protocol-core/references/toon-protocol-context.md` (canonical protocol reference, D9-010).
- **Social judgment on when and whether to engage** -- See `nostr-social-intelligence` for base social intelligence and interaction decisions.
- **Organizing app preferences into lists or labeling app quality** -- See `lists-and-labels` for NIP-51 bookmark sets and NIP-32 labeling that can categorize app handlers.
- **Understanding relay discovery for relay hint tags** -- See `relay-discovery` for NIP-11 and NIP-65 relay information used in `r` tags.
