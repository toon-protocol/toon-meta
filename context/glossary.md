# Glossary (cross-repo)

**Connector vocabulary is not defined here.** Its canonical home is
[`connector/CONTEXT.md`](https://github.com/toon-protocol/connector/blob/main/CONTEXT.md), a bounded-context glossary, with the reasoning in [`connector/docs/adr/`](https://github.com/toon-protocol/connector/blob/main/docs/adr/README.md) (69 status-tracked records). Defined there and deliberately **not** restated here: connector, app, handler, packet, condition, fulfilment, ILP address, route, path, peering, peer carriage, peer role, self-description, greeting, route termination, envelope, gift wrap, claim, covering claim, payment channel, nonce, watermark, cap, fee, price, charge, cost, settlement, operator surface. Where this file and that one disagree, **that one wins**.

The one sentence to carry into everything below: **the connector terminates payments the way nginx terminates SSL** — it is a paid reverse proxy, and there are exactly two roles, **connector** and **app**.

## Cross-repo terms

**`g.toon…` addresses** — the fleet's nodes claim addresses beneath `g.toon` (`g.toon.relay`, `g.toon.store`). An ILP address is **self-asserted — a claim, not a grant**: nothing allocates one, and reachability is the only registry. **Nothing answers at `g.toon` itself** — there is no apex, and the apex box was destroyed 2026-08-14. A name beneath a peer's address is a courtesy that keeps their table small, never a delegation.

**TOON codec** — binary encoding of a Nostr event for an ILP packet's payload (`encodeEventToToon` / `decodeEventFromToon`, in `@toon-protocol/core`).

**Nostr** — the event/relay protocol the relay app speaks. TOON gates *writes* behind payment **at the connector in front of the relay**; reads are free Nostr WS (NIP-01) and never touch a connector.

**NIP** — Nostr Improvement Proposal. The relay app implements many (see the NIP skills).

**DVM** — Data Vending Machine (NIP-90). Pay a kind:5xxx request, get a kind:6xxx result. Live: **kind:5094** (Arweave blob storage — the `store` app) and **kind:5096 / 5098** (Solana fee-payer co-sign / EVM ERC-2771 relay — the `gas-station` app).

**relay · store · swap · gas-station** — the TOON **apps**: payment-oblivious HTTP origin servers, each its own repo and image, each behind its own connector. Formerly town / dvm / mill / —.

**Vectors** — `connector/vectors/wire-vectors.json`, the normative cross-repo wire contract, replayed as its own suite by toon-client, rig and swap. **Vectors are normative; prose is not** (connector ADR 0021). See [contracts.md](./contracts.md).

**Rig** — the git-native official TOON client implementation, peer of the agent-host client (`toon-clientd` + the `toon_*`/`toon_git_*` MCP tools); both build on `@toon-protocol/client`. Two surfaces: the **`rig` CLI** (`@toon-protocol/rig`, standalone, no daemon — relays as real git origins, the full money lifecycle, strict `--json`) and the **rig-web SPA** (`@toon-protocol/rig-web`, browser-only free-read surface, <https://toon-protocol.github.io/toon-client/>). It speaks NIP-34's git vocabulary, so it resembles a read-only forge, but is not a GitHub clone: state lives as paid, permanent events on TOON. Writes enter through the paying clients, never the SPA. See [docs/rig-guide.md](../docs/rig-guide.md).

## One collision, reconciled deliberately

**"Control plane"** means the **Rig's event space** — the shared, signed TOON event log and the views over it — and nothing else in this org. `connector/README.md` uses it as a section heading for the **operator surface**; that use is banned by the connector's own `CONTEXT.md`, so **the operator surface is never called a control plane here**. The `toon-clientd` daemon's loopback HTTP surface is the **control API**, also not a control plane.

## Retired terms — do not rebuild

| Term | Retired by | What to say instead |
|---|---|---|
| **peer wire** | connector ADR 0027 | **peer carriage** (where the bytes ride) / **peer role** (an interaction's authority). The raw-TCP wire is deleted; there are two carriages, BTP over `wss://` and ILP-over-HTTP over `https://`. |
| **exposure** | connector ADR 0033 | nothing — a packet carries its own claim (ADR 0042), so nothing is owed between packets and nothing accumulates. |
| **ceiling** | connector ADR 0033 | **cap** — the most one packet may carry to one peer, discovered by its `T04`, set from outside (ADR 0049). Never a bound on an accumulation. |
| **minimum delivery** | connector ADR 0057 | nothing — the claim a hop mints for the forwarded value bounds erosion. The field, its carriage bindings and its vectors are deleted. |
| **flush** | connector ADR 0033 | nothing. |
| **apex** · **parent / child** · **free-forward** · `relation:'child'` · `TOON_PARENT_PEER_ID` | apex destroyed 2026-08-14 | every hop is a **peering** an operator wrote down; every PREPARE carries its covering claim and pays that peering's flat fee. |
| **balance proof** | connector CONTEXT.md | **claim**. |
| **BLS** / Business Logic Server / agent runtime / backend | connector CONTEXT.md | **app**. |
| **admin** / **control plane** (for the node's own surface) | connector CONTEXT.md | **operator surface**. |
| **402 / x402** (for the unpaid answer) | connector CONTEXT.md | **greeting** — that route's terms, in band. |
| **SkillDescriptor (kind:10035)** | connector ADR 0046 / 0065 | a route's terms come from the node itself — its **self-description** (`GET /ilp`) and its **greeting**. No event advertises a price; grep finds kind:10035 in no repo in the fleet. |
| **per-byte price** | connector ADR 0065 | a **price is a schedule over payload length**, `base + per_kib × ceil(len/1024)`. The unit is a kibibyte. |
