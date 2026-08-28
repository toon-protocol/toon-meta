# Inter-repo Contracts

How the TOON repos hold each other to account, and where each contract's **source of truth** lives.

**The old premise of this page is dead.** Published `.d.ts` + semver, `@toon-protocol/shared`, the `/handle-packet` `PaymentRequest`/`PaymentResponse` DTOs, their zod schemas and the admin-DTO unification programme were the cross-repo contract until the Rust connector replaced them. `@toon-protocol/connector`, `@toon-protocol/shared` and `@toon-protocol/mina-zkapp` are gone; `packages/shared` in the connector tree is untracked build output. `localDelivery`, `POST /handle-packet`, `PaymentRequest`, `ConnectorNode`, `ClaimReceiver` and `SettlementMonitor` are all deleted. Nothing below replaces them with a type — the contracts are now **replayable artifacts** and **live documents**.

## 1. The wire contract — vectors

`connector/vectors/wire-vectors.json`. A committed set of input/output pairs — an encoded packet, a wrapped packet, an envelope, a condition, the fulfilment it derives, a claim — generated from the properties, never captured from what an implementation happened to emit.

**Vectors are normative; prose is not** ([ADR 0021](https://github.com/toon-protocol/connector/blob/main/docs/adr/0021-vectors-are-normative-prose-is-not.md)) — the tiebreaker for every protocol question across every repo.

| | |
|---|---|
| Suites | `envelope`, `giftwrap`, `fulfilment`, `claim`, `peer_carriage`, `channel_control_declaration` |
| Schema | **4** — the peer-claim schema since the shared secret was deleted (ADR 0060) |
| Replayed by | `toon-client` (`packages/client/src/wire/`, refreshed by `scripts/refresh-wire-vectors.mjs`), `rig`, `swap` |
| Conformance means | reproducing them. An implementation that passes its own tests and fails a vector is wrong. |

A behavioural rule with no vector yet is **normative prose until its vector lands** (ADR 0045).

## 2. The protocol reference — vendored RFCs

Ten Interledger RFCs live under `connector/docs/rfcs/`, **vendored verbatim at a pinned upstream commit**, each beneath a TOON profile naming the departures and the record that governs each ([ADR 0062](https://github.com/toon-protocol/connector/blob/main/docs/adr/0062-an-rfc-is-vendored-verbatim-and-profiled-never-forked.md)). An RFC is never forked.

Precedence, highest first: **vectors → ADRs → `docs/protocol/` → a TOON profile → the RFC body.**

The largest deliberate departure: the packet is **TOON's dialect, not RFC 0027's** — ILPv4 semantics, TOON encoding, not byte-compatible, ratified rather than tolerated ([ADR 0063](https://github.com/toon-protocol/connector/blob/main/docs/adr/0063-the-ilp-packet-is-toons-dialect-not-rfc-0027s.md)).

## 3. The inter-node contract — the self-description

A connector answers a `GET` on its own URL with **one document holding every public fact about it** ([ADR 0050](https://github.com/toon-protocol/connector/blob/main/docs/adr/0050-a-connectors-url-resolves-to-its-self-description.md)): its ILP addresses, its HTTP and BTP endpoints, its peer carriages, the key a packet is sealed to, per chain what opening a channel takes, and what each of its routes costs. Free, unauthenticated, generated from live configuration, never a place a write is accepted.

- It is **the whole of what one operator must give another to be peered with** — a peering is established by `POST /peers {id, url, fee, max_packet_amount}` naming that URL, and identity is trust-on-first-use ([ADR 0058](https://github.com/toon-protocol/connector/blob/main/docs/adr/0058-a-peering-is-established-from-a-url.md)).
- An unpaid request to a priced route gets a **greeting** — that route's terms — which is a projection of the same document, so enforcement can never run ahead of what is published.
- A route may publish a `request` table naming what a client must send; the connector republishes it verbatim and reads none of its keys ([ADR 0067](https://github.com/toon-protocol/connector/blob/main/docs/adr/0067-a-route-declares-its-request-shape-and-the-connector-never-reads-it.md)).
- There is **no announce**. kind:10032 is removed (ADR 0046, retiring ADR 0030). A node answers; it never pushes.

Consumers should read a node's live figures from its self-description rather than pinning them here. Devnet chain endpoints, tokens and program ids are hand-maintained in `connector/infra/linode/endpoints.json`.

## 4. The deployment contract — the image pin

**A node repository pins the connector; nothing in the connector moves a tag onto a box** ([ADR 0068](https://github.com/toon-protocol/connector/blob/main/docs/adr/0068-a-node-repository-pins-the-connector-nothing-here-moves-a-tag-onto-a-box.md)). The direction is the opposite of what this repo used to record.

| Repo | Pins the connector at | Guarded by |
|---|---|---|
| `relay` | `deploy/Dockerfile` — `FROM ghcr.io/toon-protocol/connector:${CONNECTOR_TAG}` | a test in that repo |
| `store` | `deploy/docker-compose.yml` — `image: ghcr.io/toon-protocol/connector:rust-<handle>` | a test in that repo |
| `gas-station` | `deploy/docker-compose.yml` — same shape | a test in that repo |

The connector repo builds the image and cuts a dated release handle (`release-connector.yml`); it does not deploy. `promote-to-fleet.yml` is deleted, and ADR 0068 carries a falsifier that fails if it returns. Because a binary and a box's mounted TOML are a matched pair, **adding a required config key is a breaking deploy**: land the config, then bump the pin.

## 5. Still library-shaped

| Seam | Source of truth |
|---|---|
| TOON event codec (event ↔ bytes) | `@toon-protocol/core` (`toon/`) |
| Nostr event kinds + tags (10035, 5094/6094, 5096/5098) | `@toon-protocol/core` (`events/`, builders) |
| Client behaviour (claims, channels, packets) | `@toon-protocol/client` — and the vectors above, which it replays |
| MCP tool schemas | the `client-mcp` package (product-local) |

Publish these with **`pnpm publish`** / changesets, never `npm publish` — the latter shipped unresolved `workspace:*` and made `sdk@0.5.0`/`town@0.4.0` uninstallable.
