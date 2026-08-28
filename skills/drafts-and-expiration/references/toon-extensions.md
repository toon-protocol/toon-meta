# TOON Extensions for Drafts and Expiration

> **Why this reference exists:** Draft events and expiration timestamps on TOON differ from vanilla Nostr because every write is ILP-gated. This file covers the TOON-specific considerations for kind:31234 draft events and the expiration tag -- publishing flow, what a save actually costs, and the economic dynamics that shape drafting and expiration on a paid network.

## Publishing Draft Events on TOON

All draft event publishing on TOON goes through `client.send()` from `@toon-protocol/client`. Raw WebSocket writes are rejected -- the relay requires ILP payment for every event.

### Publishing Flow

1. **Construct the event:** Build a kind:31234 event with `d` tag (draft identifier), `k` tag (target kind), content, and optional tags
2. **Encrypt the content (recommended):** Use NIP-44 self-encryption so only you can read the draft
3. **Sign the event:** Use `nostr-tools` or equivalent to sign with the agent's private key
4. **Send it:** `await client.send({ body: signedEvent })`

`send()` seals the payload to the terminating connector, reads the route's price, mints the covering claim and carries it -- there is no separate pricing, claim-signing or publish step, and agents never construct ILP packets. TOON format is the encoding of those sealed write bytes, and only of those: reads come back as ordinary NIP-01 JSON. A REJECT comes back as `{ fulfilled: false }`; it is never thrown.

### Error Handling

- **F03 (INVALID_AMOUNT):** the claim did not cover the charge -- underpayment. This is what you get for working a charge out from the event JSON you wrote: the metered quantity is the **sealed** payload, larger by the envelope and the wrap. Let `send()` price the packet.
- **T04:** the amount is over the peering's cap. The reject message states the cap -- that is the only way a sender learns it.
- **Relay rejection:** The event was malformed (invalid signature, wrong kind structure). Fix the event and republish.

## What Drafts and Expiration Cost

The relay's route (`g.toon.relay`) is flat-priced: **1 base unit of 6-decimal USDC per event**, whatever the event contains. Every operation in the draft lifecycle is one event, so each one is charged 1:

| Operation | Kind | Charge |
|-----------|------|--------|
| Save a draft (any length, encrypted or not) | 31234 | 1 base unit |
| Publish the final event | target kind | 1 base unit |
| Delete the draft | 5 | 1 base unit |
| Add an expiration tag to any of the above | -- | no change |

Content length, NIP-44 encryption overhead and the ~25-byte expiration tag all change the event's size and none of them change the charge. The only number that moves is the **count of writes**.

Where a route is priced by length -- blob storage on `g.toon.store` is `1000 + 10 per KiB` -- ask the node for its terms rather than guessing:

```ts
const terms = await client.routePrice('g.toon.store'); // { price, pricePerKib? }
```

then `chargeFor(terms, sealedBytes)` from `@toon-protocol/client`. A node's free, unauthenticated `GET /ilp` self-description carries the same facts for every route -- a connector answers, it never announces. The metered quantity is the **sealed** payload the PREPARE carries, so a charge cannot be computed from the event JSON you wrote. In the ordinary case you need neither call: `send()` prices the packet itself.

## Economic Dynamics of Drafts on TOON

### The Draft Lifecycle Is Counted in Writes

| Workflow | Writes | Charge |
|----------|--------|--------|
| Compose locally, save once, publish, delete draft | 3 | 3 base units |
| Three checkpoints, publish, delete draft | 5 | 5 base units |
| Autosave every keystroke through a session, publish, delete | 100+ | 100+ base units |

Even the last row is a hundredth of a cent. The bill is not the argument against autosaving.

### Compose Locally, Save Checkpoints

The reason to compose in a local editor and save at meaningful checkpoints is not the price of a write. It is that every save is a signed, published event: it lands under your pubkey on a relay other software reads and indexes, it burns a claim nonce on your channel, and it is a network round trip in the middle of your writing. Save when you want cross-device access or a backup, and publish when ready.

### Encryption Costs Nothing Extra

NIP-44 encryption adds roughly 50-100 bytes of overhead (nonce, MAC, padding) to a draft. On the relay's flat-priced route that overhead is charged nothing at all, so there is no cost argument against encrypting a draft -- only the privacy argument for it. Encrypt drafts.

### Parameterized Replaceable Keeps the Relay Small

kind:31234 is parameterized replaceable, meaning each draft save with the same `d` tag replaces the previous version:
- You pay per save, but the relay only stores the latest version
- No growing storage burden over iterations
- Each save is independent -- if a save fails, the previous version is still intact

The saving here is the relay's storage, not your bill: ten checkpoint saves cost ten writes whether the relay keeps one version or ten.

### Expiration Eliminates a Write

Using the expiration tag removes the need for a separate deletion event:

| Pattern | Events Published | Charge |
|---------|-----------------|--------|
| Publish, then delete later with kind:5 | 2 events | 2 base units |
| Publish with expiration | 1 event | 1 base unit |
| **Savings** | 1 fewer event | **1 base unit, and no cleanup to remember** |

The tag itself is free. What it buys is one write fewer and one less thing to forget.

### Expiration Saves Relay Storage

On TOON, relay storage is a real cost. Expired events are automatically purged, which:
- Reduces the relay's storage burden
- Aligns author intent (temporary content) with relay economics
- Is considered good network citizenship
- May factor into future relay pricing decisions (relays could offer discounts for expiring content)

### Stale Drafts Are Clutter

Drafts left on the relay after publishing the final event waste storage and confuse anyone reading your event stream. Always clean up:
1. Publish the final event
2. Delete the draft with kind:5
3. Or set an expiration on the draft itself so it auto-cleans if you forget

Setting a generous expiration on drafts (e.g., 30 days) is a safety net against stale drafts:

```
["expiration", "<timestamp-30-days-from-now>"]
```

It costs nothing extra and prevents indefinite draft accumulation.

## Integration with Protocol Core

For the complete TOON write model, read model, and route-pricing details, refer to `skills/nostr-protocol-core/references/toon-protocol-context.md`. This file covers draft-and-expiration-specific extensions; the protocol core covers the foundational mechanics shared by all event kinds.
