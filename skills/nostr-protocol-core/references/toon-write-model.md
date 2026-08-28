# TOON Write Model

## Why Writes Cost Money

TOON gates writes behind payment. The relay is an ordinary Nostr app sitting behind a **connector**, and the connector terminates payment the way nginx terminates SSL: by the time the relay sees a write, it is ordinary HTTP that was already paid for. There is no proof-of-work, no relay authentication handshake, and no Lightning wallet — a claim authorises, and that is the whole gate.

Be precise about what that gate is. The price is small — `g.toon.relay` charges **1 base unit** of 6-decimal USDC, a millionth of a dollar — so payment does not *deter* a determined writer. What it does is require a covering claim on a **funded payment channel** for every single write: friction, attribution and a settlement trail, rather than a price barrier.

Note the shape of the cost. A price attaches to a **route**, and on the live relay route it is **flat per packet**: writing costs the same whether you write ten words or ten thousand. What you pay for is how often you write, not how much.

## Asking What a Route Costs

A connector **answers**; it never announces. Everything you need is on one free, unauthenticated document — the node's **self-description**, served from `GET /ilp` on its own URL (connector ADR 0050). It carries the node's addresses, its settlement facts, and every route's price.

```typescript
const terms = await client.routePrice('g.toon.relay');
// { price: 1n }                  — flat
// { price: 1000n, pricePerKib: 10n } — metered, on a route like g.toon.store
// null                            — this node terminates no matching route
```

`null` is an **answer**, not a failure: it means "I do not terminate that". A connector that could not be reached throws instead, so the two are never confused.

If you want the figure a packet would actually carry, hand those terms to `chargeFor`:

```typescript
import { chargeFor } from '@toon-protocol/client';
const amount = chargeFor(terms, sealedBytes);
```

**You almost never need to do this.** `send()` calls `chargeFor` itself. Reach for it only when you must show a user a price before committing.

**You cannot compute the charge yourself.** The metered quantity is the **sealed** payload — the gift-wrapped bytes the PREPARE carries — not your event JSON, which is smaller by the envelope and the wrap. Ask; do not multiply. And the unit is a **kibibyte**: a per-byte price never existed on TOON.

Prices are whole counts of the settlement token's smallest unit. USDC is 6-decimal, so `1_000_000` = $1 and the relay route's price of `1` is one millionth of a dollar.

**Retired:** `basePricePerByte`, `feePerByte`, `kind:10032` peer info, a `/health` pricing endpoint, `kind:10035` / `SkillDescriptor` per-kind pricing, `resolveRouteFees()`, `calculateRouteAmount()` and LCA route resolution. ADR 0046 removed the announce; ADR 0061 and ADR 0065 replaced the money model. The cost of a multi-hop path is discovered from a probe's reject, not computed from a fee table.

## Publishing with `@toon-protocol/client`

The transport for agents is `@toon-protocol/client`. Build and sign the event as you would for any relay, then send it:

```typescript
import { ToonClient } from '@toon-protocol/client';
import { finalizeEvent } from 'nostr-tools/pure';

const client = await ToonClient.create({
  connector: 'https://proxy.relay.devnet.toonprotocol.dev',
  mnemonic: process.env.TOON_MNEMONIC,
});

await client.channel.open({ deposit: 100_000n });

const signedEvent = finalizeEvent(
  { kind: 1, content: 'Hello from TOON!', tags: [], created_at: Math.floor(Date.now() / 1000) },
  secretKey
);

// The node's own published address
const answer = await client.send({ body: signedEvent });

// Or name a route yourself
const stored = await client.send('g.toon.relay.store', { body: blob });
```

`send()` does all of it in order: it seals the payload to the connector that **terminates** the route, asks that connector the price, charges it against the sealed bytes, ensures a channel, signs a claim for exactly that amount, picks a carriage, and reads the sealed answer back. A caller never prices a packet by hand, never signs a claim by hand, and never constructs an ILP packet.

### API Signature

```typescript
send(request?: SendRequest, options?: SendOptions): Promise<SendResult>;
send(destination: string, request?: SendRequest, options?: SendOptions): Promise<SendResult>;

interface SendRequest {
  method?: string;                                   // default 'POST'
  target?: string;                                   // path beneath the route's handler
  headers?: Record<string, string> | [string, string][];
  body?: string | Uint8Array | object;               // an object also sets content-type: application/json
}

interface SendOptions {
  amount?: bigint;    // override; on a forwarded route, above the price is refused F03
  sealTo?: Uint8Array | string;  // needed only when the addressed node FORWARDS the route
  timeoutMs?: number;
}
```

The destination is **optional**. Omit it and the packet goes to the address the connector published for itself, so configuring a client is just a URL — the thing a person actually has.

`sealTo` matters only for a forwarded destination: a payload must be sealed to the connector that *terminates* the route, and no hop may name that key on another's behalf. Sealing to a forwarder is a confidentiality failure the wire can only report as an undeliverable packet.

**Retired — these do not exist, and code calling them calls nothing:** `publishEvent()`, a caller-facing `signBalanceProof()`, the `bid` safety cap (D7-006), and the DVM amount override (D7-007) as previously described. `SendOptions.amount` exists, but it is an override, not a negotiation.

## Reading the Answer

A refusal is **returned, never thrown**:

```typescript
const answer = await client.send({ body: signedEvent });

if (answer.fulfilled) {
  answer.status;   // the APP's HTTP status — a 404 is a real answer and costs what a 200 costs
  answer.headers;  // [name, value][] — in order, duplicates preserved
  answer.body;
  answer.claim;    // what this packet spent: { channelId, chain, nonce, cumulative, amount }
} else {
  answer.code;     // 'F03' | 'T04' | 'F02' | 'T01' | …
  answer.message;
}
```

## Error Handling

| Code | Means | What to do |
|------|-------|-----------|
| `F03` | INVALID_AMOUNT — the claim does not cover the charge. **This is underpayment.** | Re-ask `routePrice()` and retry; the reject carries the real figure. `send()` normally makes this impossible. |
| `T04` | Over the peering's cap. The message **states the cap** — the only way a sender learns it. | Send less in one packet. It is never carried and never split for you. |
| `R01` | This hop's fee alone exceeds the arriving amount, so nothing would be forwarded. | Send more, or take a shorter path. |
| `F02` | Nothing routes that name. | Check the destination against the node's self-description. |
| `T01` | The peer was not there. | Transport problem, not a payment problem. |

**There is no `F04`.** Underpayment is `F03`.

**The connector never parses the payload.** There is no TOON parse, no signature check and no event-kind dispatch anywhere on the packet path — the terminating connector reads only the envelope. The old five-stage validation pipeline (size → TOON parse → Schnorr → pricing → kind dispatch), and its `F04`/`F06`/`F08` table, were never true of it.

## Simplified Write Model (D9-005)

There is no condition and no fulfilment computation on the client side. Agents never compute SHA-256 double-hashes and never manage ILP conditions. `send()` mints the gift wrap, the execution condition and the shared secret together, so they cannot drift.

## TOON Encoding Is the Write Payload, Not the Read Response

TOON is an agreement between a **client and an app** about the bytes of the write payload — the bytes `send()` seals and the connector carries without ever opening them. That is the whole of its scope on the packet path.

It is **not** what a relay serves on a read. The relay returns **standard JSON** `EVENT` messages and speaks plain NIP-01, so any ordinary Nostr client can read it with no decoder.

**TOON on the way in, plain NIP-01 JSON on the way out.**

## What NOT to Do

Never send events by raw WebSocket EVENT message to the relay app expecting them to be accepted as writes. A write must arrive through the connector in front of the relay, because that is where payment is terminated. Reads are the opposite: `["REQ", …]` straight to the relay app is correct, free, and never touches a connector.

Never reach for `@toon-format/toon` to parse a relay subscription. Nothing on a read is TOON-encoded.
