# Node Operator Guide — run a TOON node and join the network

TOON is a **composable payment layer — like nginx for your app**: drop a connector in front of a
service, and messages-and-money become one packet. This guide is the operator front-door. It takes
you from zero to a running node, **peered with a neighbour**, and on to your own app behind TOON.

It leans on the runnable bundles that exist today and links back to them rather than duplicating
commands. **`deploy/node-quickstart/` and `deploy/pay-edge/` were deleted on 2026-08-05** — both ran
the TypeScript connector at `connector:3.44.0`, whose source, workflow and image are all gone, so
their first command could not succeed. What replaced them:

| you want | go here |
|---|---|
| a connector, any shape (relay front, payment proxy, store front) | connector [`deploy/connector-rust/`](https://github.com/toon-protocol/connector/tree/main/deploy/connector-rust) — the only bundle that repo still ships |
| a paid relay node | [`relay`'s own `deploy/`](https://github.com/toon-protocol/relay/tree/main/deploy) — Caddy + a `relay-connector` image with the config baked in |
| a paid Arweave store node | [`store`'s own `deploy/`](https://github.com/toon-protocol/store/tree/main/deploy) |
| two connectors peered | connector [`docs/operators/btp-peer-transport-bringup.md`](https://github.com/toon-protocol/connector/blob/main/docs/operators/btp-peer-transport-bringup.md) |

**Running against the live devnet?** Check [`docs/operators/`](./operators/) for notices —
dated announcements about changes you may need to act on. Current:
[apex settlement identity rotated](./operators/2026-07-31-apex-settlement-identity-rotation.md)
(2026-07-31; affects anyone holding an open Base Sepolia channel with the apex — which was itself
destroyed 2026-08-14, so those channels can only be settled unilaterally).

> **30-second model.** A *write* is an ILP packet carrying a TOON-encoded Nostr event plus a signed
> payment-channel **claim**. A **connector** validates the claim, takes a fee, and forwards to the
> app behind it. **Reads are free** Nostr WS and never touch the connector.
> See [`context/context.md`](../context/context.md).

## 1. Pick your node

| You want to… | Node type | Path |
|--------------|-----------|------|
| Run a **paid Nostr relay** (pay-per-event publish, free reads) | **relay** | §2 · [`relay/deploy/`](https://github.com/toon-protocol/relay/tree/main/deploy) |
| Sell **permanent storage** (NIP-90 Arweave DVM, kind:5094) | **store** | §6 · [`store/deploy/`](https://github.com/toon-protocol/store/tree/main/deploy) |
| Run a **multi-chain swap** peer (pay asset A, get a claim for B) | **swap** | build on `@toon-protocol/sdk` — [sdk-guide](./sdk-guide.md) |
| **Monetize an existing HTTP app** with zero code changes | connector as **payment proxy** | §5 · [`deploy/connector-rust/`](https://github.com/toon-protocol/connector/tree/main/deploy/connector-rust) with a `[[routes]]` `handler_url` |

This guide walks the **relay** path end-to-end because it is the simplest complete node; the shape
(a connector in front of a payment-oblivious app, plus peering) is identical for store/swap.

> Two other ways to get a relay exist and are documented elsewhere: the one-command npm CLI
> `npx @toon-protocol/town --mnemonic "…"` ([town-guide](./town-guide.md), no Docker — but it embeds
> the retired TypeScript connector, see [deployment.md](./deployment.md#town-cli)), and building
> a custom native service on `@toon-protocol/sdk` ([sdk-guide](./sdk-guide.md)). This guide is the
> **Docker-image + peering** path.

## 2. Run one node

```bash
git clone https://github.com/toon-protocol/relay && cd relay/deploy
cp .env.example .env        # EDGE_HOST, READ_HOST, ACME_EMAIL
docker compose up -d
```

That brings up Caddy (auto-HTTPS, two names) in front of a `relay-connector` image with its
`connector.toml` baked in, plus the relay app. The relay's write port (3100) is deliberately absent
from every route — it is the **payment-oblivious** surface, and a public path to it is a free door.
Full detail is in that bundle's README.

There is **no environment-variable layer** in the Rust connector: `TOON_MNEMONIC`, `CONFIG_FILE`
and `NODE_TLS_REJECT_UNAUTHORIZED` do nothing. Every value comes from one TOML file, and identities
are mounted key files
([connector ADR 0009](https://github.com/toon-protocol/connector/blob/main/docs/adr/0009-one-typed-config-file-no-environment-layer.md)).

**See it working:**
- Ask the node what it is: `GET https://<EDGE_HOST>/ilp` returns its **self-description** — ILP
  addresses, routes and prices, settlement chains and contracts, edge identity — with no packet and
  no encoder ([ADR 0050](https://github.com/toon-protocol/connector/blob/main/docs/adr/0050-a-connectors-url-resolves-to-its-self-description.md)).
  This replaces the kind:10032 announce, which is **removed**: a connector answers, it does not
  announce, and it must work with no relay in the world
  ([ADR 0046](https://github.com/toon-protocol/connector/blob/main/docs/adr/0046-the-kind-10032-announce-is-removed-a-connector-needs-no-relay.md)).
- Paid write path: `POST https://<EDGE_HOST>/ilp`. A payer is not plain `curl` — use `rig`.
- Free read path: the relay's Nostr WS at `READ_HOST`.

## 3. Watch it: the operator surface

The connector serves an **operator surface** that splits read from write
([connector ADR 0008](https://github.com/toon-protocol/connector/blob/main/docs/adr/0008-operator-surface-splits-read-from-write.md)),
plus an authenticated `GET /metrics`
([ADR 0014](https://github.com/toon-protocol/connector/blob/main/docs/adr/0014-metrics-surface-and-packet-correlated-logs.md)),
and a dashboard the surface serves and signs in the browser
([ADR 0066](https://github.com/toon-protocol/connector/blob/main/docs/adr/0066-the-operator-dashboard-is-a-page-the-surface-serves-and-signs-in-the-browser.md)).

It **refuses to start without a bearer token and write keys**, so there is no unauthenticated shape
to point a public page at. The old `/admin/metrics.json`, `/admin/earnings.json`, `/admin/peers`,
`/admin/routes` and `/admin/channels` endpoints belonged to the TypeScript connector and are gone —
the last four leaked peer ids, on-chain channel ids and per-route settlement addresses to the
anonymous internet, which ADR 0008 never sanctioned. Bind the surface to a private interface.

## 4. Peer with a neighbour

A node reaches another in **two** ways: a `[[peers]]` row in its one TOML config file, or a
**runtime peering established from a URL** —

```bash
curl -sX POST https://<EDGE_HOST>/peers \
  -H "authorization: Bearer $OPERATOR_TOKEN" \
  -d '{"id":"g.example","url":"https://edge.example.com/ilp","fee":"1","max_packet_amount":"100000"}'
```

The connector `GET`s that URL's self-description, **derives** the payment channel from the two
participants, opens it on chain if it is not already open, registers both halves of the channel
binding and writes a durable runtime peering
([connector ADR 0058](https://github.com/toon-protocol/connector/blob/main/docs/adr/0058-a-peering-is-established-from-a-url.md),
[ADR 0059](https://github.com/toon-protocol/connector/blob/main/docs/adr/0059-a-channel-is-derived-from-its-participants.md),
[ADR 0060](https://github.com/toon-protocol/connector/blob/main/docs/adr/0060-a-claim-proves-a-peering-and-the-shared-secret-is-deleted.md)).
Identity is trust-on-first-use. A runtime row **never shadows the config file**
([ADR 0034](https://github.com/toon-protocol/connector/blob/main/docs/adr/0034-a-runtime-peer-route-table-never-shadows-the-config-file.md)).

Three things every operator must internalise:

- **Peering is a capital decision, not a discovery step.** Reading a stranger's self-description is
  free; opening a funded channel is peering.
- **A packet carries its claim.** A PREPARE arrives with its covering claim or it is greeted
  ([ADR 0042](https://github.com/toon-protocol/connector/blob/main/docs/adr/0042-a-packet-carries-its-claim.md)).
  Nothing is owed between packets, so there is no window for a counterparty to walk away inside.
  (ADR 0031 stated this for the peer role first and is **superseded by 0042**, which restates it
  for every role — cite 0042.)
- **Do not pin `:rust-release`.** It is frozen at `rust-sha-8708caf`, which predates connector#1230:
  on it a peering established by `POST /peers` can accept a claim but can never sign one, so every
  forward over a runtime peering is refused `T00`. The node serves, and quietly cannot pay.

The **peer role** and the **client role** are two separate claim books, not two wires: the raw-TCP
peer carriage was deleted, and peers now carry packets over BTP or HTTP
([ADR 0027](https://github.com/toon-protocol/connector/blob/main/docs/adr/0027-connectors-peer-over-btp-or-http-and-the-raw-tcp-peer-wire-is-deleted.md)).

Want your node **found** by others? There is no announce to publish
([ADR 0046](https://github.com/toon-protocol/connector/blob/main/docs/adr/0046-the-kind-10032-announce-is-removed-a-connector-needs-no-relay.md)) —
a node answers at its URL and nothing else. The naming design space is the
[peering & naming RFC](./rfc-peering-naming.md).

## 5. Put your own app behind TOON (the proxy path)

To monetize an existing HTTP service instead of running a relay, use the connector as a **payment
proxy** — the way nginx fronts TLS. Take
[`deploy/connector-rust/`](https://github.com/toon-protocol/connector/tree/main/deploy/connector-rust)
and give it a `[[routes]]` entry whose `handler_url` is your app: agents onboard via x402, pay
one-shot over ILP-over-HTTP, and your **app** never changes — it stays payment-oblivious and the
connector never parses the payload
([connector ADR 0016](https://github.com/toon-protocol/connector/blob/main/docs/adr/0016-payload-opacity-is-a-property-of-carriage.md)).
A verified payment is **stated to the app** in headers
([ADR 0040](https://github.com/toon-protocol/connector/blob/main/docs/adr/0040-a-verified-payment-is-stated-to-the-app.md)),
and a route declares its request shape without the connector reading it
([ADR 0067](https://github.com/toon-protocol/connector/blob/main/docs/adr/0067-a-route-declares-its-request-shape-and-the-connector-never-reads-it.md)).
The handler contract is in the connector
[README](https://github.com/toon-protocol/connector/blob/main/README.md). Background:
[deploy-app-guide](./deploy-app-guide.md), [payment-proxy.md](./payment-proxy.md).

## 6. Store (Arweave DVM) node

The **store** node (kind:5094 pay-to-store, FULFILL returns the Arweave tx id) runs live on the
devnet from [`store`'s own `deploy/`](https://github.com/toon-protocol/store/tree/main/deploy). Its
box answers `g.toon.store` and `g.toon.relay.store`, each priced as a **schedule** — base 1000 plus
10 per **KiB** of payload
([connector ADR 0065, *a price is a schedule over payload length*](https://github.com/toon-protocol/connector/blob/main/docs/adr/0065-a-price-is-a-schedule-over-payload-length.md)).
`ario` is the box label and hostname, not an ILP address; there is no `g.toon.ario` route.

## 7. Two things that will bite you

**1. Your repo pins the connector — the connector repo does not deploy you.**
[Connector ADR 0068](https://github.com/toon-protocol/connector/blob/main/docs/adr/0068-a-node-repository-pins-the-connector-nothing-here-moves-a-tag-onto-a-box.md)
inverted the old model: a **node repository** names the connector image it runs, by release handle,
in exactly one guarded place in its own `deploy/` bundle — relay in `deploy/Dockerfile`'s
`ARG CONNECTOR_TAG`, store and gas-station in `deploy/docker-compose.yml`. The connector repo builds
and cuts a release (a human `workflow_dispatch`, dated handle like `2026.08.21.1`, never semver) and
stops there. `promote-to-fleet.yml` is deleted; `fleet-ops.yml` and `devnet-manage.sh` no longer
touch relay or store, because they were writing to `/root/connector/...` — a path those boxes stopped
reading — and then re-reading that dead path to "confirm" the write. It reported green every time.
Pin an immutable `rust-sha-…`; `fleet-pin-drift.yml` watches the three repos read-only and files a
`needs:human` issue if any of them pins a floating tag.

**2. The Solana payment-channel program cannot be upgraded.** Its upgrade authority is the lost
2026-07-18 deployer key. Any change to the program is a **fresh deploy at a new program id**, and
[ADR 0053](https://github.com/toon-protocol/connector/blob/main/docs/adr/0053-a-solana-claim-binds-its-domain-the-way-an-evm-claim-does.md)
binds the settlement program into a claim's signed message — so a new id is a **new claim domain**
and every open channel on the old program must be drained or abandoned first. Plan it as a
migration. Detail: [deployment.md → Two standing hazards](./deployment.md#two-standing-hazards).

## Naming note

The live devnet spells addresses `g.toon.<type>` — `g.toon.relay`, `g.toon.store`, `g.toon.gas`.
Legacy `g.proxy.*` and `g.connector.*` spellings in older documents are a pending cleanup, not a
second scheme. When you write your own config, pick your own root and stay consistent with it.

## Where things live

| Asset | Repo · path |
|-------|-------------|
| Run a relay node (compose + Caddy + baked config) | `relay` · [`deploy/`](https://github.com/toon-protocol/relay/tree/main/deploy) |
| Run an Arweave store node | `store` · [`deploy/`](https://github.com/toon-protocol/store/tree/main/deploy) |
| A bare connector (payment proxy, or a front for your own app) | `connector` · [`deploy/connector-rust/`](https://github.com/toon-protocol/connector/tree/main/deploy/connector-rust) |
| App / handler contract | `connector` · [README](https://github.com/toon-protocol/connector/blob/main/README.md) |
| Discovery, peering & naming design | `toon-meta` · [rfc-peering-naming.md](./rfc-peering-naming.md) |
| One-command npm relay (no Docker) | [town-guide.md](./town-guide.md) |
| Build a custom native service | [sdk-guide.md](./sdk-guide.md) |
| Live devnet endpoints + contracts | [deployment.md](./deployment.md) |
| Known DX gaps (the nginx-grade backlog) | [dx-findings.md](./dx-findings.md) |
