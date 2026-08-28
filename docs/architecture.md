# Architecture

The **cross-repo** picture: who owns what, and how a node is composed. Connector internals are not restated here — read [`connector/docs/architecture/source-tree.md`](https://github.com/toon-protocol/connector/blob/main/docs/architecture/source-tree.md), and [`connector/CONTEXT.md`](https://github.com/toon-protocol/connector/blob/main/CONTEXT.md) for the vocabulary.

## Two roles, and there is no third

> **The connector terminates payments the way nginx terminates SSL.** Value arrives wrapped in a protocol the app never speaks; at the last hop the connector unwraps it, verifies it, and hands the app ordinary HTTP that was already paid for.

| Role | What it is |
|------|-----------|
| **Connector** | A paid reverse proxy. Routes, prices, takes the claim, derives the fulfilment, and makes one HTTP request of the app. One static Rust binary reading one TOML file. |
| **App** | The payment-oblivious origin server behind a **route termination**. Settles nothing, holds no channel, is never told which destination was addressed. It *is* told who paid — `X-TOON-Payer` / `X-TOON-Amount` / `X-TOON-Chain` — and only when this connector took the payment itself (ADR 0040). |

The connector is **not a library the app imports**. There is no in-process mode, no `createNode({...})`, and no mnemonic anywhere: every key it holds is a path, never a value.

## Who owns what

| Repo | Owns | Shape |
|------|------|-------|
| [`connector`](https://github.com/toon-protocol/connector) | The protocol, the ADRs, the Rust connector binary, the EVM contracts and the Solana program | image + contracts |
| [`relay`](https://github.com/toon-protocol/relay) | A Nostr relay you get paid to write to — free NIP-01 reads, paid writes | app + `deploy/` |
| [`store`](https://github.com/toon-protocol/store) | A paid Arweave blob store; the worked example of putting any app behind the connector | app + `deploy/` |
| [`gas-station`](https://github.com/toon-protocol/gas-station) | Pays other people's gas — Solana fee-payer co-sign, EVM ERC-2771 relaying | app |
| [`swap`](https://github.com/toon-protocol/swap) | The relay-mediated rolling swap: cross-chain claim exchange over gift-wrapped relay writes | npm + CLI |
| [`toon-client`](https://github.com/toon-protocol/toon-client) | `@toon-protocol/client` — the payer library | npm |
| [`rig`](https://github.com/toon-protocol/rig) | The git-to-TOON write path and its read UI | npm + CLI |
| [`buzz`](https://github.com/toon-protocol/buzz) | A workspace for humans and agents, on a relay you own | app |
| [`toon`](https://github.com/toon-protocol/toon) | `@toon-protocol/core`, `sdk`, `settlement-digest` — TypeScript libraries | npm |
| [`toon-meta`](https://github.com/toon-protocol/toon-meta) | This repo: shared context, agent skills, cross-repo docs | plugin |

ADR 0017: **the TypeScript connector was a prototype, not a reference implementation**, and it is deleted. There is one connector.

## How a node composes

A node repository is **its app plus a pinned connector**, wired in its own `deploy/` bundle (ADR 0068). This repository builds and releases the connector; nothing in it moves a tag onto a box.

```
                    ┌─────────────────────────────────────┐
 client ── pays ──▶ │  connector          app             │
                    │  (route, price,  ─▶ (plain HTTP,    │
                    │   claim, seal)      already paid)   │
                    └─────────────────────────────────────┘
                       one box, one deploy/ bundle
```

The pin is one literal, guarded, in exactly one place:

| Repo | Pin |
|------|-----|
| `relay` | `deploy/Dockerfile`: `ARG CONNECTOR_TAG=rust-sha-…`, with `connector.toml` **baked** into a `relay-connector` image — so adopting a newer connector and changing the config it reads are the same reviewed commit. |
| `store` | `deploy/docker-compose.yml`: `ghcr.io/toon-protocol/connector:rust-<handle>`, config rendered from `connector.toml.template`. |

Pin an exact build handle, never a floating tag. Because the binary and the box's TOML are a matched pair in both directions, **adding a required config key is a breaking deploy**: land the config first, then bump the pin.

## Data flow

**Write (paid).** Client seals a payload to the terminating connector's identity key and sends a PREPARE carrying its **covering claim** (ADR 0042). The connector routes it, takes the charge, opens the wrap, makes exactly one HTTP request of the app, seals the app's complete response back, and derives the fulfilment itself (ADR 0019). The app supplies nothing toward the fulfilment — which is why an app that knows nothing about payment cannot leak, forge or withhold one.

A `404` from the app is a real answer: it rides home on a FULFILL and costs the same as a `200`. Only unreachability or a refused target produces a reject.

**Read (free).** Straight to the app. The relay serves NIP-01 over WebSocket to any Nostr client; no packet, no claim, no connector.

## Running one

| Path | What |
|------|------|
| [`connector/README.md`](https://github.com/toon-protocol/connector/blob/main/README.md) | Run a node, put your app behind it, get paid, peer it — in that order. |
| [`connector/local/`](https://github.com/toon-protocol/connector/tree/main/local) | The shipped image against real chains: `make local-verify`. |
| [`connector/docs/protocol/configuration-spec.md`](https://github.com/toon-protocol/connector/blob/main/docs/protocol/configuration-spec.md) | Every config key and what it binds. |
| [`docs/node-operator-guide.md`](./node-operator-guide.md) | This repo's operator front door. |
| [`docs/protocol.md`](./protocol.md) · [`docs/settlement.md`](./settlement.md) | The pointer maps for protocol law and settlement. |

## Retired — do not rebuild

| Thing | What killed it |
|-------|----------------|
| A "discovery layer" over kind:10032 | ADR 0046 removed the announce; ADR 0050 puts the facts on a `GET` of the node's own URL. |
| Addresses derived from peering topology, `feePerByte` | An address is self-asserted; a fee attaches to the peering (ADR 0061) and a price is a schedule (ADR 0065, *a price is a schedule*). |
| `@toon-protocol/bls` and the term "Business Logic Server" | The word is **app**. It never was a third role. |
| Embedded/in-process mode, `createNode({...})`, `--mnemonic` | The connector is one static binary reading one TOML file; every key is a path. |
| `./scripts/sdk-e2e-infra.sh`, port 19100 | Replaced by `connector/local/` + `make local-verify`. |
| One-Call API (`npx @toon-protocol/town`) | The `town` package is not the deployment path; a node repo's own `deploy/` bundle is (ADR 0068). |
| "Only sha256(data) for transfer-id" | A packet carries a real **condition**, and `condition = sha256(fulfilment)`. |
| "Each hop deducts its fee and forwards the rest" as the whole story | Every PREPARE carries its own covering claim (ADR 0042); nothing is owed between packets. |
