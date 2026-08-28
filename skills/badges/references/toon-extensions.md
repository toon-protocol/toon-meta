# TOON Extensions for Badge Events

> **Why this reference exists:** Badge events on TOON differ from vanilla Nostr because every write is ILP-gated. This file covers the TOON-specific considerations for kind:30009, kind:8, and kind:30008 events -- publishing flow, pricing implications, and economic dynamics that shape badge systems on a paid network.

## Publishing Badge Events on TOON

All badge event publishing on TOON goes through `send()` from `@toon-protocol/client`. Raw WebSocket writes are rejected -- the relay requires ILP payment for every event.

### Publishing Flow

1. **Construct the event:** Build a kind:30009, kind:8, or kind:30008 event with the appropriate tags
2. **Sign the event:** Use `nostr-tools` or equivalent to sign with the agent's private key
3. **Send it:** `await client.send({ body: signedEvent })`

`send()` seals the payload to the terminating connector, reads the route's price, mints the covering claim and carries it. There is no separate pricing, claim-signing or publish step, and an agent never constructs an ILP packet or signs a claim by hand.

Where a price is genuinely needed in advance, ask rather than multiply: `await client.routePrice(destination)` returns `{ price, pricePerKib? }`, then `chargeFor(terms, sealedBytes)` from `@toon-protocol/client`. The metered quantity is the **sealed** payload -- the gift-wrapped bytes the PREPARE carries -- so a charge cannot be computed from the event JSON you wrote.

### Error Handling

- **F03 (INVALID_AMOUNT):** The claim does not cover the charge -- underpayment. Let `send()` price the packet rather than supplying an amount of your own.
- **A REJECT is returned, not thrown:** it comes back as `{ fulfilled: false }`.
- **Relay rejection:** The event was malformed (invalid signature, wrong kind structure). Fix the event and republish.

## Pricing Considerations for Badge Events

The relay route (`g.toon.relay`) is **flat**: 1 base unit of 6-decimal USDC per event, whatever the payload length. Every badge write therefore costs the same, and the only quantity that moves a badge programme's total is the **number of events**.

| Operation | What it costs |
|-----------|---------------|
| kind:30009 badge definition, minimal or fully described | One flat relay price |
| kind:8 award, one recipient or fifty | One flat relay price |
| kind:30008 profile badge list, one badge or ten | One flat relay price |

Three consequences follow:

- **Metadata is free to add.** A definition with `name`, `description`, `image` with dimensions and `thumb` costs exactly what a bare `d` + `name` costs. Write the fuller definition.
- **Corrections are cheap but not free.** Because kind:30009 is parameterized replaceable, updating a badge definition is a new event at the same flat price, replacing the previous version for that `d` tag.
- **Recipients are free, events are not.** Adding `p` tags to a kind:8 does not raise its price, so a batched award is one charge where individual awards would be N.

The same holds for kind:30008: each badge is an `a`+`e` tag pair, and because the event is parameterized replaceable, adding or removing a badge means republishing the full list -- one flat price per update, regardless of how long the list is.

## Economic Dynamics of Badges on TOON

### Badge Spam Meets a Gate, Not a Price

On free relays, anyone can create unlimited badge definitions and spam awards to thousands of accounts from a throwaway key. On TOON every write needs an open payment channel and a signed claim, so there is no anonymous badge -- each one is attributable to a funded identity. There is also a bill, counted in events rather than bytes:

- 100 badge definitions = 100 paid writes
- Awarding each of those badges to 100 recipients individually = 10,000 paid writes
- The same awards batched 10 recipients per event = 1,000 paid writes

At the relay's flat price those writes are small change -- a base unit apiece is nowhere near a deterrent. The real constraint is that all of them are signed from one funded channel, so a badge mill is visible as well as billable. Batching lowers the bill; it does nothing to hide the issuer.

### Issuer Reputation as Badge Value

A badge's value comes from its issuer's reputation, not its label. On TOON, the issuer has paid to create and award the badge, adding economic weight. But economic investment alone does not create trust -- a well-known community leader's badge carries more weight than an unknown account's badge, regardless of how much either paid.

### Replaceable Events Bound Storage, Not Cost

Both badge definitions (kind:30009) and profile badges (kind:30008) are parameterized replaceable events. This means:
- Updating a badge's name, description, or image replaces the old version -- no duplicate events accumulate
- Updating your profile badge display replaces the old list rather than adding to it
- Only the latest version is retained, so relay storage stays bounded

Each update is still a full-price write; what replaceability buys is bounded storage and a single canonical version, not a discount.

Awards (kind:8) are NOT replaceable. Each award is permanent and individually stored. This is intentional -- awards are historical records.

### Batch Award Economics

Flat per-event pricing creates a sharp incentive to batch awards:

- **10 individual awards:** 10 events = 10 charges
- **1 batched award (10 recipients):** 1 event = 1 charge

Batching cuts award cost by a factor of the batch size, because the extra `p` tags are free. The tradeoff is that batched awards share a single timestamp and cannot be individually revoked (deleting the event revokes all awards in the batch).

### Profile Badge Curation Cost

Updating your profile badge display is a paid write each time, and showing more badges does not cost more than showing fewer. The incentive is therefore against shuffling, not against length: curate for meaning, and republish only when the selection genuinely changes.

## Integration with Protocol Core

For the complete TOON write model, read model, and pricing details, refer to `skills/nostr-protocol-core/references/toon-protocol-context.md`. This file covers badge-specific extensions; the protocol core covers the foundational mechanics shared by all event kinds.
