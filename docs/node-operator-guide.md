# Node Operator Guide — run a TOON node and join the network

TOON is a **composable payment layer — like nginx for your app**: drop a connector in front of a
service, and messages-and-money become one packet. This guide is the operator front-door. It takes
you from zero to a running node, **peered with a neighbour**, and on to your own app behind TOON.

It leans on two runnable bundles in the connector repo — [`deploy/node-quickstart/`](https://github.com/toon-protocol/connector/tree/main/deploy/node-quickstart)
(run a relay node) and [`deploy/pay-edge/`](https://github.com/toon-protocol/connector/tree/main/deploy/pay-edge)
(front your own HTTP app) — and links back to them at each step rather than duplicating commands.

> **30-second model.** A *write* is an ILP packet carrying a TOON-encoded Nostr event plus a signed
> payment-channel claim. A **connector** (apex nodeId `g.proxy`) validates the claim, takes a fee,
> and free-forwards to a **child** node. **Reads are free** Nostr WS and never touch the connector.
> See [`context/context.md`](../context/context.md).

## 1. Pick your node

| You want to… | Node type | Path |
|--------------|-----------|------|
| Run a **paid Nostr relay** (pay-per-event publish, free reads) | **relay** (`g.proxy.relay`) | §2 · [`deploy/node-quickstart/`](https://github.com/toon-protocol/connector/tree/main/deploy/node-quickstart) |
| Sell **permanent storage** (NIP-90 Arweave DVM, kind:5094) | **store** (`g.proxy.store`) | §6 — *round-trip fix in progress* |
| Run a **multi-chain swap** peer (pay asset A, get a claim for B) | **swap** (`g.proxy.swap`) | build on `@toon-protocol/sdk` — [sdk-guide](./sdk-guide.md) |
| **Monetize an existing HTTP app** with zero code changes | connector as **payment proxy** | §5 · [`deploy/pay-edge/`](https://github.com/toon-protocol/connector/tree/main/deploy/pay-edge) |

This guide walks the **relay** path end-to-end because it is the simplest complete node; the shape
(connector apex + child route + peering) is identical for store/swap.

> Two other ways to get a relay exist and are documented elsewhere: the one-command npm CLI
> `npx @toon-protocol/town --mnemonic "…"` ([town-guide](./town-guide.md), no Docker), and building
> a custom native service on `@toon-protocol/sdk` ([sdk-guide](./sdk-guide.md)). This guide is the
> **Docker-image + peering** path — the one that was previously scattered.

## 2. Run one node

```bash
git clone https://github.com/toon-protocol/connector && cd connector/deploy/node-quickstart
cp .env.example .env        # optional for a first run
docker compose up -d
./verify.sh
```

That brings up a connector (`g.proxy`) + relay (`g.proxy.relay`) pointed at the live public devnet
(Base Sepolia). The node boots with an unfunded default key — enough to serve free reads and the
operator dashboard; a **paid** write needs `TOON_MNEMONIC` set and funded (below). `verify.sh` checks
`/health`, the operator dashboard, and `/admin/metrics.json`. Full detail is in the bundle's
[README](https://github.com/toon-protocol/connector/blob/main/deploy/node-quickstart/README.md).

**See it working:**
- Paid write path: `POST http://127.0.0.1:3000/ilp` (see §4 of the bundle README — a payer is not
  plain `curl`; use `rig` or the in-repo prover).
- Free read path: the relay's Nostr WS (`relay:7100` on the compose net) — front it with TLS to
  serve public reads.

## 3. Watch it: the operator dashboard

```
http://127.0.0.1:8081/admin/dashboard
```

A dependency-free page served by the connector's own admin API. Tiles: **throughput**
(packets/sec forwarded vs rejected), **reject rate**, **estimated earnings** (fees + per-peer/asset
volume), **peers** (connected, discovered-vs-funded), **node** (uptime + health). It polls
`/admin/metrics.json` at 1 Hz and `/admin/earnings.json` — the same data the `townhouse-web`
operator UI uses. It ships with the node; there's nothing to deploy.

## 4. Peer with a neighbour

A node is reachable to others in **three** ways: static YAML `peers[]`/`routes[]`, the admin API
(`POST /admin/peers`), or automatic **link-state route-learning over Nostr `kind:10032`**. The
quickstart demonstrates the static path on one machine:

```bash
docker compose --profile peer up -d      # adds a second connector+relay that peers with the first
./verify.sh --peer
# Check from the DIALER — node B lists the session it opened to node A:
curl -s http://127.0.0.1:8083/admin/peers | jq   # → g.proxy, connected: true
```

`/admin/peers` lists a node's **outbound** peers, so the link shows on node B (the dialer); node A
accepts the inbound session at its BTP server but surfaces it in its logs (`btp_auth … g.peer …
success:true`), not in `/admin/peers`.

The [bundle README §4](https://github.com/toon-protocol/connector/blob/main/deploy/node-quickstart/README.md)
walks the peer-config schema (`id` / `url` / `relation` / `nextHop`) and the cross-node routing demo.
Two things every operator must internalise:

- **Discovered ≠ peered.** Reading a neighbour's `kind:10032` announce is *free discovery*; opening a
  funded bilateral channel is *peering* — a deliberate capital decision (`autoRegister` is off by
  design).
- **Restart-order footgun.** A BTP client gives up after ~5 retries (~60 s); after restarting an
  upstream, restart the downstream so it re-dials (see [deployment.md](./deployment.md)).

Want your node **found automatically** by others (link-state learning), or to **own a global name**
for it? That's the design space of the [peering & naming RFC](./rfc-peering-naming.md).

## 5. Put your own app behind TOON (the proxy path)

To monetize an existing HTTP service instead of running a relay, use the connector as a **payment
proxy** — the way nginx fronts TLS. [`deploy/pay-edge/`](https://github.com/toon-protocol/connector/tree/main/deploy/pay-edge)
is the drop-in: put the connector in front of any payment-oblivious HTTP backend, agents onboard via
x402, pay one-shot over ILP-over-HTTP, and your backend never changes. The contract your app
implements (or, for a native node, the handler contract `POST /handle-packet` / `GET /health`) is in
the connector [README "Writing Your Own App"](https://github.com/toon-protocol/connector/blob/main/README.md).
Same connector image, a different `route.upstream`. Background: [deploy-app-guide](./deploy-app-guide.md),
[payment-proxy.md](./payment-proxy.md).

## 6. Store (Arweave DVM) node — status

The **store** node (`g.proxy.store`, kind:5094 pay-to-store, FULFILL returns the Arweave tx id) has a
published image, but its **paid round-trip is currently blocked** by a connector↔SDK payload-format
skew — see [handoff-arweave-dvm-deploy.md](./handoff-arweave-dvm-deploy.md). Discovery and
channel-open work; the job doesn't yet reach the DVM handler. A `store` service will be added to the
`node-quickstart` bundle once that lands. Until then, treat store as **available, round-trip fix in
progress** — don't wire it into a production apex expecting paid stores to complete.

## Naming note (`g.proxy` vs `g.connector`)

This guide uses the canonical live-devnet spelling: apex nodeId **`g.proxy`**, children
`g.proxy.<type>`, env prefix `PROXY_*`. You will still see legacy `g.connector.echo` in the pay-edge
example — that spelling is a [pending cleanup](../context/repos.md), not a second scheme. When you
write your own config, use `g.proxy`.

## Where things live

| Asset | Repo · path |
|-------|-------------|
| Run a relay node (compose + config + verify) | `connector` · [`deploy/node-quickstart/`](https://github.com/toon-protocol/connector/tree/main/deploy/node-quickstart) |
| Front your own app (payment proxy) | `connector` · [`deploy/pay-edge/`](https://github.com/toon-protocol/connector/tree/main/deploy/pay-edge) |
| App / handler contract | `connector` · [README](https://github.com/toon-protocol/connector/blob/main/README.md) |
| Discovery, peering & naming design | `toon-meta` · [rfc-peering-naming.md](./rfc-peering-naming.md) |
| One-command npm relay (no Docker) | [town-guide.md](./town-guide.md) |
| Build a custom native service | [sdk-guide.md](./sdk-guide.md) |
| Live devnet endpoints + contracts | [deployment.md](./deployment.md) |
| Known DX gaps (the nginx-grade backlog) | [dx-findings.md](./dx-findings.md) |
