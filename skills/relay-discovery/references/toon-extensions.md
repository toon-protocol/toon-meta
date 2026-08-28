# TOON Extensions for Relay Discovery

> **Why this reference exists:** On TOON, "where do I read?" and "what does writing cost?" are two questions with two different answers, served by two different processes. NIP-11/65/66 answer the first, exactly as they do on any Nostr network. The second is answered by the **connector** in front of the relay, on its self-description. This file covers that split, the mechanics of each surface, and the machinery that was removed so you do not go looking for it.

## The Two Surfaces

| Question | Ask | Costs |
|----------|-----|-------|
| What relays exist, and are they up? | NIP-65 lists, NIP-66 monitors, NIP-11 documents | free |
| What does this relay's write route cost? | the fronting connector's `GET /ilp` | free |
| Is the relay process alive? | the relay app's `GET /health` | free |

Nothing in the first row involves a connector at all. Reads are free Nostr WebSocket, and finding somewhere to read from is the ordinary Nostr problem.

## The Node Self-Description (`GET /ilp`)

**A connector answers; it never announces** (connector ADR 0022, ADR 0046). Its self-description is a free, unauthenticated HTTP GET on its own URL (ADR 0050), and it is the *only* place a node's payment facts come from:

```
GET https://proxy.relay.devnet.toonprotocol.dev/ilp
```

It carries the node's ILP addresses, its settlement facts (chain, token, decimals), the key a payload must be **sealed** to, and **every route's price**.

From `@toon-protocol/client`, the same question has two shapes:

```typescript
const description = await client.describe();               // the whole document
const terms = await client.routePrice('g.toon.relay');     // one route's terms
// { price: 1n }                       — flat
// { price: 1000n, pricePerKib: 10n }  — metered
// null                                 — this node terminates no matching route
```

`null` is an **answer** -- "I do not terminate that" -- not a failure. A connector that could not be reached throws instead.

An unpaid request to a priced route is answered with a **greeting** carrying that route's terms, never the work.

### Live Devnet Routes

Probed 2026-08-28 from each node's `GET /ilp`:

| Destination | Terminates at | Price (base units of 6-dp USDC) |
|-------------|---------------|--------------------------------|
| `g.toon.relay` | relay box, `https://proxy.relay.devnet.toonprotocol.dev/ilp` | **1**, flat |
| `g.toon.store`, `g.toon.relay.store` | store box, `https://proxy.ario.devnet.toonprotocol.dev/ilp` | **base 1000, plus 10 per KiB** |
| `g.toon.gas` | gas box, `https://proxy.gas.devnet.toonprotocol.dev/ilp` | **1000** |

Ask the node rather than trusting this table -- a node's own self-description is the authority.

An ILP address is **self-asserted -- a claim, not a grant**. Nothing allocates one, no registry records one, and reachability is the only registry there is. **Nothing answers at `g.toon` itself** (the apex was destroyed 2026-08-14), and every `g.proxy…` address is dead.

## The Relay's `/health` Is Liveness Only

The relay app serves `GET /health` on its write port, but it is the container healthcheck, not a discovery surface. The relay is a plain read/write app with no payment, connector or settlement layer of its own, so the response is deliberately minimal:

```json
{
  "status": "healthy",
  "pubkey": "<64-char hex>",
  "capabilities": ["relay"],
  "version": "<software version>",
  "timestamp": 1756400000000
}
```

That is the whole document. It carries **no pricing, no ILP address, no chain configuration, no peer or channel counts, and no attestation state** -- the relay does not know any of those things. Use it to answer "is the process up?", and nothing else.

## `payment_required` in NIP-11

On TOON relays, `limitation.payment_required` is `true`. Every write must arrive through the connector carrying a covering claim; there are no free writes. Reading is always free.

NIP-11 tells you *that* payment is required. It does not tell you *how much* -- that figure is on the connector's self-description, not in the relay information document.

## Publishing kind:10002 Relay Lists on TOON

```typescript
import { ToonClient } from '@toon-protocol/client';
import { finalizeEvent } from 'nostr-tools/pure';

const client = await ToonClient.create({
  connector: 'https://proxy.relay.devnet.toonprotocol.dev',
  mnemonic: process.env.TOON_MNEMONIC,
});

const signedEvent = finalizeEvent(
  {
    kind: 10002,
    tags: [
      ['r', 'wss://relay1.example.com'],
      ['r', 'wss://relay2.example.com', 'read'],
      ['r', 'wss://relay3.example.com', 'write'],
    ],
    content: '',
    created_at: Math.floor(Date.now() / 1000),
  },
  secretKey
);

const answer = await client.send({ body: signedEvent });
```

Two steps: build and sign the event, then `send()` it. `send()` seals the payload to the terminating connector, asks that connector the route's price, charges it against the **sealed** bytes, mints a covering claim for exactly that amount, and carries it. You never price the packet yourself and never sign a claim by hand.

**Retired -- these do not exist, and code calling them calls nothing:** `publishEvent()`, a caller-facing `signBalanceProof()`, `basePricePerByte`, `feePerByte`, `kind:10032` peer info, and a `/health` endpoint carrying pricing.

### Reading the Answer

A refusal is **returned, never thrown**:

```typescript
if (!answer.fulfilled) {
  console.error(answer.code, answer.message);
}
```

- **`F03` INVALID_AMOUNT** -- the claim did not cover the charge. This is underpayment; the reject carries the real figure. **There is no `F04`.**
- **`T04`** -- over the peering's cap. The message states the cap, which is the only way a sender learns it.
- **`F02`** -- nothing routes that name.
- **Relay rejection** -- a malformed `r` tag or an invalid relay URL comes back as the *app's* HTTP status on a `fulfilled: true` answer. It cost what a success costs.

## What a Relay List Costs

One packet. On `g.toon.relay` the price is **flat at 1 base unit of 6-dp USDC**, so:

| List Size | Cost |
|-----------|------|
| 3 relays | 1 base unit |
| 5 relays | 1 base unit |
| 30 relays | 1 base unit |

Length is free. Byte-counting your `r` tags saves nothing, and dropping a read/write marker to save eight bytes saves nothing.

### What Actually Reduces Cost

- **Batch updates.** Combine all relay changes into one kind:10002 event. Five incremental republishes cost five packets; one batched republish costs one. This is the only lever there is.
- **Do not republish to no purpose.** kind:10002 is replaceable, so a republish that changes nothing still costs a packet.

Keeping the list short and accurate is still right -- it just is not a cost argument. It is a correctness argument: the list is a public statement about which relays you actually use.

If you need the figure before committing, ask:

```typescript
import { chargeFor } from '@toon-protocol/client';
const terms = await client.routePrice('g.toon.relay');
const amount = chargeFor(terms, sealedBytes);
```

`chargeFor` is the only thing that should decide what goes on a claim, and `send()` calls it for you. Note that the metered quantity is the **sealed** payload -- the gift-wrapped bytes the PREPARE carries, not your event JSON, which is smaller by the envelope and the wrap. You therefore cannot compute a charge from the event you wrote, even in principle. And the unit is a **kibibyte**: a per-byte price never existed on TOON.

## NIP-11 vs the Self-Description

| Feature | NIP-11 (relay app) | Self-description (connector) |
|---------|-------------------|------------------------------|
| Protocol | HTTP GET with `Accept: application/nostr+json` | HTTP GET on the connector's URL, no special headers |
| URL | the relay's WebSocket URL, scheme replaced | `https://<connector-host>/ilp` |
| Served by | the relay app | the connector in front of it |
| Payment info | `limitation.payment_required`, `fees` -- *that* payment is needed | every route's **price** -- *how much* |
| Addresses | none | the node's ILP addresses |
| Settlement | none | chain, token, decimals |
| Sealing key | none | the key a payload must be sealed to |
| Cost to query | free | free |

Query NIP-11 for relay identity and capability constraints; query the self-description for anything to do with payment. They are served by different processes and neither is a substitute for the other.

## Reading Relay Discovery Events

**Reads speak plain NIP-01.** The relay returns **standard JSON** `EVENT` messages -- `["EVENT", <subId>, {id, pubkey, created_at, kind, tags, content, sig}]` -- so any ordinary Nostr client reads a TOON relay with no decoder and no TOON dependency. Reading is free: no payment, no claim, no connector.

When reading kind:10002, kind:30166, kind:10166, or kind:10066 events:

1. **`JSON.parse` the message** as you would on any relay. There is nothing to decode.
2. **For kind:10002,** extract `r` tags to build the relay list with read/write markers.
3. **For kind:30166,** extract `d`, `n`, `N`, `R`, `T`, `s`, and `rtt` tags for relay monitoring data.
4. **For kind:10166,** extract `timeout` and `frequency` tags for monitor parameters.

**Do not import `@toon-format/toon` for reads.** TOON is the encoding of the **write payload** -- an agreement between a client and an app about the bytes the connector carries **sealed** inside the ILP packet, which the connector never opens. It is not what a relay serves on a read. **TOON on the way in, plain NIP-01 JSON on the way out.**

**Important:** `nostr-tools` SimplePool does NOT work in Node.js containers -- it lacks a global WebSocket. Use direct WebSocket connections for reads.

## Bootstrapping: There Is No Seed Event

kind:10036 "seed relay list" was a TOON-specific bootstrap event. **Nothing on the fleet publishes or consumes it.** The event type survives in the legacy `@toon-protocol/core` package, but no relay emits one and no client looks for one, so a kind:10036 subscription never fires.

An agent bootstraps from a **URL a person gave it**:

```typescript
const client = await ToonClient.create({ connector: 'https://…', mnemonic });
```

From that one URL, `GET /ilp` yields everything else, and `send()` with no destination goes to the address that node published for itself. Configuring a client is then just a URL, which is the thing a person actually has.

Widening from one known node to many is a **controller's** problem. Copying self-descriptions into a discovery network is work done outside the connector by definition -- the connector has no idea where it would publish to, which is precisely why it answers instead of announcing.

### Minimal Write Model

This skill is read-focused. Only kind:10002 relay list events are agent-writable. NIP-11 and the self-description are free HTTP GETs. NIP-66 monitoring events (kind:10166, kind:30166, kind:10066) are published by relay monitor operators, not end-user agents. Agents therefore spend almost nothing on relay discovery: reading is free, and the only write is the occasional kind:10002 update.

## Relay Evaluation Criteria

When comparing relays:

- **Price** -- ask each fronting connector, `client.routePrice(destination)` or `GET /ilp`. There is no table to look this up in and no event that carries it.
- **Settlement compatibility** -- the self-description states the node's chains and tokens. Settlement is USDC on Base Sepolia (`evm:84532`) and Solana devnet.
- **Liveness** -- NIP-66 kind:30166 `rtt` tags for latency, and the relay's own `/health` for a direct liveness check.
- **Reachability** -- an ILP address is self-asserted, so the only proof a node serves a route is that it answers for it. Probe rather than assume.

**Retired as criteria:** `basePricePerByte` comparison, TEE attestation state (`tee.attested`, `pcr0`, Oyster/Nitro enclave fields), `peerCount` / `discoveredPeerCount` / `channelCount`, `x402` availability, and a `chain` preset name such as `"arbitrum-sepolia"`. None of these appears on any live surface. Arbitrum was never the fleet's chain.

## Integration with Protocol Core

For the complete TOON write model, read model, and pricing details, refer to `skills/nostr-protocol-core/references/toon-protocol-context.md`. This file covers relay-discovery-specific extensions; the protocol core covers foundational mechanics shared by all event kinds.
