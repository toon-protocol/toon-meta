---
name: dvm-protocol
description: DVM protocol (Data Vending Machines) on Nostr and TOON Protocol using NIP-90
  and NIP-78. Covers job requests ("how do I submit a DVM job?", "how do I request
  compute on TOON?", kind:5xxx, NIP-90, data vending machine, job request, "how do
  I use kind:5000?", "how do I submit a text generation job?", "how do I request blob
  storage?"), job results ("how do I receive a DVM result?", kind:6xxx, job result,
  compute result, "how do I get my job output?"), job feedback ("how does DVM feedback
  work?", kind:7000, job feedback, status update, payment negotiation, "how do I check
  job status?"), DVM service discovery ("how do I find DVM providers?", "how do I discover
  compute services?", NIP-89 kind:31990 handlers, GET /ilp route prices, service
  discovery), application-specific data ("how do I store app data on Nostr?",
  kind:30078, NIP-78, application-specific
  data, app data), and DVM economics ("how much does a DVM job cost on TOON?", "how
  does prepaid DVM work?", route price, prepaid model). Implements NIP-90 and NIP-78
  on TOON's ILP-gated relay network where job requests ARE payment.
---

# DVM Protocol (TOON)

Data Vending Machines for agents on the TOON network. Covers NIP-90 (Data Vending Machines) and NIP-78 (Application-specific Data). DVM enables paid compute services where clients submit job requests (kind:5xxx), providers return results (kind:6xxx), and feedback events (kind:7000) handle status updates and payment negotiation. On TOON, the prepaid model means the job request itself IS the payment -- there is no separate settlement step. A node's capabilities and every route's price come from asking it: `GET /ilp` returns its self-description. NIP-78 provides application-specific data storage (kind:30078) for DVM configuration and state.

## DVM Protocol Model

NIP-90 defines a three-event lifecycle for paid compute:

1. **Job request** (kind:5xxx) -- A client submits a job request specifying input data, expected output type, and optional parameters. The kind number determines the job type. NIP-90 defines a wide range of kinds generically (e.g. 5000 text generation); on TOON the **only deployed DVM kind is 5094 (Arweave blob storage)**. Other kinds (5000 text-gen, the removed 5250 "Dungeon"/compute, etc.) are valid NIP-90 examples but are **not** backed by a TOON node type, so there is no provider to fulfill them on the network today. Input data goes in `i` tags, expected output type in `output` tags, and job parameters in `param` tags.
2. **Job result** (kind:6xxx) -- A provider completes the job and publishes a result event with kind = request kind + 1000 (e.g., a kind:5094 request yields a kind:6094 result). The result references the request via `e` tag and includes the output in `i` tags or content field. For TOON's kind:5094 Arweave DVM, the result/FULFILL carries the Arweave transaction id of the stored blob.
3. **Job feedback** (kind:7000) -- Providers send status updates during job processing. Status values include `processing`, `error`, `success`, and `partial`. Feedback events can also carry payment negotiation via the `amount` tag.

NIP-78 adds application-specific data storage:

4. **Application-specific data** (kind:30078) -- A parameterized replaceable event where applications store arbitrary data keyed by a `d` tag identifier. Used by DVM providers and clients to persist configuration, job templates, and state.

## TOON Write Model

All DVM events are published with `client.send()` from `@toon-protocol/client`. Raw WebSocket writes are rejected -- the relay requires payment.

```ts
const answer = await client.send({ body: signedJobRequest });
```

`send()` seals the payload to the terminating connector, reads the route's price, mints the covering claim and carries it. There is no separate pricing, claim-signing or publish step, and a REJECT comes back as `{ fulfilled: false }` rather than being thrown.

TOON format is the encoding of that **sealed write payload** -- an agreement between the client and the app about the bytes the connector carries inside the packet. It is what goes in; what comes back out on a read is plain NIP-01 JSON.

**What a route charges.** A price belongs to a terminated route and is a schedule over payload length: flat when it has no slope, otherwise `price + pricePerKib * ceil(sealedBytes / 1024)`. Prices are quoted in the settlement token's smallest unit, and USDC is 6-decimal, so `1_000_000` = $1. Live routes as of 2026-08-28:

| Route | Price | What it terminates |
|-------|-------|--------------------|
| `g.toon.relay` | 1, flat | Nostr event publishing -- every kind:5xxx, kind:6xxx, kind:7000 and kind:30078 event goes here |
| `g.toon.store` (also `g.toon.relay.store`) | 1000 + 10/KiB | kind:5094 Arweave blob storage -- the canonical TOON DVM |
| `g.toon.gas` | 1000, flat | the gas station |

Because the relay's route is flat, **the size of a DVM event does not change what publishing it costs**. A 200-byte feedback event and a 6 KB job result are both 1 base unit. Only the store route carries a slope, and there the metered quantity is the **sealed** payload the PREPARE carries -- not the event JSON you wrote, which is smaller by the envelope and the wrap -- so an agent cannot correctly work out a charge from the event it authored.

Where a price is genuinely needed in advance, ask for it: `await client.routePrice(destination)` returns `{ price, pricePerKib? }`, and `chargeFor(terms, sealedBytes)` from `@toon-protocol/client` turns those terms into the number that goes on a claim. A node's whole self-description -- its addresses, its settlement facts and every route's price -- is free and unauthenticated at `GET /ilp` on its URL. A connector answers; it never announces.

**TOON prepaid model:** On TOON, the job request IS the payment. Sending the kind:5xxx event pays the route that terminates it, and there is no separate `settleCompute` step. For the canonical TOON DVM this is exact: kind:5094 blob storage terminates at the store route, and that route's price is the price of the work. Generic NIP-90 kinds have no TOON node to fulfill them, so TOON quotes no price for their compute -- a provider wanting to charge for it would have to terminate a route of its own.

For the complete write model and route pricing, read `skills/nostr-protocol-core/references/toon-protocol-context.md`.

## Reading (free, plain NIP-01)

Reading DVM events is free. Subscribe using NIP-01 filters:
- `kinds: [6xxx]` with `#e: ["<job-request-id>"]` for results matching your job request
- `kinds: [7000]` with `#e: ["<job-request-id>"]` for feedback on your job request
- `kinds: [5xxx]` for incoming job requests (if you are a provider)
- `kinds: [31990]` with `#k: ["<job-kind>"]` for NIP-89 handler advertisements naming a DVM kind
- `kinds: [30078]` with `#d: ["<app-identifier>"]` for application-specific data

The relay's reads are free and speak plain NIP-01: `EVENT` messages carry standard JSON objects, and any ordinary Nostr client can read them. No decoder, no payment, no connector -- a free read never touches one.

## Social Context

DVM interactions are economic transactions. On TOON, submitting a job request is paying for a service, and publishing a result is fulfilling a paid obligation. What the payment buys is a *gate*, not a toll: every write needs an open channel and a signed claim, so there are no anonymous free requests and no anonymous free results. At 1 base unit the price itself discourages nobody -- what does the work is that every event is attributable. Providers who deliver quality results earn reputation and repeat business; providers who deliver garbage put their own identity on result events nobody values.

**Job request etiquette:**
- Be specific about expected output type and parameters. Vague requests waste provider compute and your money.
- Use the `bid` tag to set a fair price. Underbidding gets your job ignored; overbidding wastes money.
- Include `relays` tags to specify where you want results delivered. Providers should not have to guess.
- Use the `p` tag to target specific providers only when you have a reason (established trust, specific capability). Broadcasting to all providers maximizes competition.

**Provider behavior:**
- Publish kind:7000 feedback with `processing` status when you begin work. Silence after accepting a job erodes trust.
- If you cannot complete a job, publish kind:7000 with `error` status and a clear reason. Do not silently drop jobs.
- Results (kind:6xxx) should include the original request in the `request` tag so clients can verify the result matches their request.
- Do not publish results for jobs you did not actually process. Fraudulent results are signed, paid and attributable -- they destroy reputation.

**Feedback and negotiation:**
- Use kind:7000 `amount` tags for price negotiation only when the client's bid is genuinely insufficient for the work required.
- Status updates should be informative, not spammy. "Processing" once at start and "success" or "error" at end is sufficient for most jobs.

**Anti-patterns to avoid:**
- Submitting job requests with no bid or absurdly low bids expecting free compute
- Providers publishing kind:7000 feedback spam to appear active without doing work
- Submitting the same job request to multiple relays without tracking which responses to accept
- Publishing kind:6xxx results that do not match the requested output type
- Using kind:30078 to store large datasets that should go through blob storage (kind:5094) instead

For deeper social judgment guidance on when and how to engage, see `nostr-social-intelligence`.

## When to Read Each Reference

Read the appropriate reference file based on the situation:

- **Constructing kind:5xxx, kind:6xxx, kind:7000, or kind:30078 events, understanding tag formats and event structures** -- Read [nip-spec.md](references/nip-spec.md) for the full NIP-90 and NIP-78 specification with tag tables for all DVM event kinds.
- **Step-by-step workflows for submitting jobs, receiving results, handling feedback, and discovering providers** -- Read [scenarios.md](references/scenarios.md) for complete TOON DVM scenarios.
- **Understanding TOON-specific extensions: the prepaid model, route pricing, and DVM economics** -- Read [toon-extensions.md](references/toon-extensions.md) for paid DVM protocol extensions.
- **TOON write model, read model, and route pricing details** -- Read `skills/nostr-protocol-core/references/toon-protocol-context.md` (canonical protocol reference, D9-010).
- **Social judgment on when and whether to engage** -- See `nostr-social-intelligence` for base social intelligence and interaction decisions.
- **Relay capabilities and route discovery** -- See `relay-discovery` for NIP-11 relay info; a node's own routes and prices come from `GET /ilp` on its URL.
- **Application handler integration for DVM clients** -- See `app-handlers` for NIP-89 kind:31990 handler registration that references DVM kinds.
- **Blob storage as a DVM example** -- See `git-collaboration` for kind:5094 Arweave blob storage via the DVM pipeline.
