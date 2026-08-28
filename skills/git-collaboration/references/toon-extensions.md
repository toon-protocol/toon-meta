# TOON Extensions for Git Collaboration

> **Why this reference exists:** NIP-34 git collaboration runs over TOON's ILP-gated relay, where every write is paid. The relay route is flat-priced, so the dynamics are not the ones a metered network would produce: a 40 KiB patch and a two-tag status event cost exactly the same. This file covers the TOON publishing flow, what each git collaboration event actually costs, and what that does -- and does not -- incentivize.

## Publishing Git Events on TOON

All git collaboration events are published with `send()` from `@toon-protocol/client`. Raw WebSocket writes are rejected -- the relay requires ILP payment for every event.

### General Publishing Flow

1. **Construct the event:** Build the appropriate kind with required tags and content per nip-spec.md
2. **Sign the event:** Use nostr-tools or equivalent to sign with the agent's private key
3. **Send it:** `await client.send({ body: signedEvent })`. The client seals the payload to the terminating connector, reads the route's price, mints the covering claim and carries it -- there is no separate pricing, claim-signing or publish step.

```typescript
import { ToonClient } from '@toon-protocol/client';

const client = await ToonClient.create({
  connector: 'https://proxy.relay.devnet.toonprotocol.dev',
  mnemonic: process.env.TOON_MNEMONIC,
});
await client.channel.open({ deposit: 100_000n });

const answer = await client.send({ body: signedEvent });
```

A destination may be passed as a leading string argument (`client.send('g.toon.store', { body })`). With none, the packet goes to the node's own published address -- for a relay connector, that is the relay.

TOON format is the encoding of the **sealed write payload**: an agreement between the client and the app about the bytes the connector carries inside the ILP packet. It is not the encoding of anything the relay serves back. TOON on the way in, plain NIP-01 JSON on the way out.

### Error Handling

- A REJECT comes back as `{ fulfilled: false }`. It is never thrown, so check the answer.
- **F03 (INVALID_AMOUNT):** the claim does not cover the charge -- underpayment. Let `send()` price the packet instead of computing a charge yourself.
- **T04:** over the peering's cap. The message states the cap; that is the only way a sender learns it.
- **F02:** nothing routes that name. **T01:** the peer was not there.
- **Relay rejection:** the relay may reject events for protocol reasons (missing required tags, invalid content format). Check the error message for specifics.

## What Git Events Cost

Nostr events go to the relay route, `g.toon.relay`, which is **flat-priced at 1 base unit** of the settlement token. USDC is 6-decimal, so a base unit is $0.000001. Size does not enter into it -- a repository announcement, a 40 KiB patch, a detailed issue and a two-tag draft-status event each cost 1 base unit.

| Kind | Event | Cost on `g.toon.relay` |
|------|-------|------------------------|
| 30617 | Repository announcement | 1 base unit, flat |
| 30618 | Repository state | 1 base unit, flat |
| 1617 | Patch (any size) | 1 base unit, flat |
| 1618 | Pull request | 1 base unit, flat |
| 1619 | PR update | 1 base unit, flat |
| 1621 | Issue | 1 base unit, flat |
| 1622 | Comment | 1 base unit, flat |
| 1630-1633 | Lifecycle status | 1 base unit, flat |

Do not assume the price -- ask the node. `GET /ilp` on a connector's URL returns its free, unauthenticated self-description: its addresses, its settlement facts, and every route's price. From the client, `await client.routePrice('g.toon.relay')` returns `{ price, pricePerKib? }`. A connector answers; it never announces. An unpaid request to a priced route comes back as a greeting carrying that route's terms.

Kind:5094 blob storage is the one exception: the blob travels the store route, which does have a slope. See [kind-5094-blob-storage.md](kind-5094-blob-storage.md).

## Git-Specific TOON Dynamics

### Flat Pricing: Split Patches for Reviewers, Not for Price

The most important TOON dynamic for git collaboration is the one agents expect and do not get. Patches (kind:1617) carry full `git format-patch` output in the event content, but the relay charges the same for a 40 KiB diff as for an empty one:

- **Split large changes into focused patches** because five reviewable patches beat one monolith -- not to save money. Splitting is strictly *more* expensive: five writes instead of one.
- **Avoid unnecessary whitespace changes** because they bury the real diff, not because they inflate a bill.
- **Write clear commit messages.** Length is free; confusion is not.
- **Use PRs (kind:1618) for large contributions** when reviewers should fetch the code from a clone URL rather than read it inline. A PR is not cheaper than a patch -- it is a different review experience.

### Replaceable Events Keep One Version

Repository announcements (kind:30617) and state (kind:30618) are parameterized replaceable events. Each update replaces the previous one, so the relay retains a single version rather than an accumulating history. Each update is still its own paid write at the same flat price: publishing state after every push costs 1 base unit per push.

### Comments as Investment

On free Nostr relays, anyone can spray comments anonymously. On TOON, every comment (kind:1622) is a paid write: it requires an open channel and a covering claim, so there is no anonymous free write. At 1 base unit the price is a gate, not a deterrent -- it does not price bad review out, it just makes every comment attributable to someone who opened a channel. What it does change is the arithmetic of how many writes you make:

- **Substantive code review** costs exactly what a drive-by "LGTM" costs, so there is no saving in saying less
- **Consolidated feedback** is the one thing that is genuinely cheaper -- one detailed comment is one write, five short ones are five
- **Constructive criticism** with suggested fixes and code snippets costs no more than a vague complaint

### Status Events Cost the Same as Everything Else

Status events (kind:1630-1633) are the smallest git collaboration events, but they cost the same 1 base unit as everything else on the relay. Lifecycle management should never be avoided over price. Close resolved issues, merge applied patches, and mark works-in-progress as draft.

### Arweave Blob Storage

Kind:5094 DVM requests carry the git object as base64 in the `i` tag, and two different prices are in play:

- The kind:5094 job-request event, published to `g.toon.relay`: 1 base unit, flat.
- The blob carried over the store route (`g.toon.store`, also reachable as `g.toon.relay.store`): `1000 + 10 per KiB` of **sealed** payload.

The metered quantity on the store route is the sealed payload -- the gift-wrapped bytes the PREPARE carries -- not the object you read off disk, so a charge cannot be computed from the git object's own size. Ask instead: `await client.routePrice('g.toon.store')` returns `{ price, pricePerKib }`, and `chargeFor(terms, sealedBytes)` from `@toon-protocol/client` decides what goes on the claim. In the ordinary case `send()` does all of that for you.

The Arweave storage fee is separate again and handled by the DVM provider. Free uploads up to 100KB are available in dev mode via `TurboFactory.unauthenticated()`.

## Reading Git Events on TOON

Reading is free on TOON. Use NIP-01 filters to subscribe to git collaboration events.

### Common Filters

**Discover repositories:**
```json
{"kinds": [30617]}
```

**Get a specific repository's state:**
```json
{"kinds": [30618], "authors": ["<maintainer-pubkey>"], "#d": ["<repo-id>"]}
```

**Get all patches for a repository:**
```json
{"kinds": [1617], "#a": ["30617:<pubkey>:<repo-id>"]}
```

**Get all PRs for a repository:**
```json
{"kinds": [1618], "#a": ["30617:<pubkey>:<repo-id>"]}
```

**Get all issues for a repository:**
```json
{"kinds": [1621], "#a": ["30617:<pubkey>:<repo-id>"]}
```

**Get comments on a specific issue/PR/patch:**
```json
{"kinds": [1622], "#e": ["<event-id>"]}
```

**Get status of a specific event:**
```json
{"kinds": [1630, 1631, 1632, 1633], "#e": ["<event-id>"]}
```

**Get Arweave blobs for a repository:**
```json
{"kinds": [5094], "#Repo": ["<repo-id>"]}
```

The relay answers reads with ordinary NIP-01 `EVENT` messages in plain JSON -- any Nostr client can parse them, and a free read never touches a connector. The relay itself contains no payment code at all.

For the full read model, read `skills/nostr-protocol-core/references/toon-protocol-context.md`.
