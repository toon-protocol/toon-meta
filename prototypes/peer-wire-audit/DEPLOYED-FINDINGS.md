# DEPLOYED-FINDINGS — what is actually running on the TOON devnet

Read-only audit, 2026-08-03 ~22:15 UTC. Nothing was changed, deployed, restarted or
edited on any box.

> **Redacted for the public repo.** Host and client IP addresses are written as
> `<apex-ip>`, `<store-ip>` and `<client-a>`/`<client-b>`/`<client-c>`. The real
> values are in project memory, following this audit's existing `root@<ip>`
> convention. `<client-a>` and `<client-b>` are in the same residential /24.

**Access achieved.** There is no `~/.ssh/config` and no `linode-cli`, but
`connector/infra/devnet-manage.sh` shows the access pattern (`ssh -i ~/.ssh/id_rsa
root@<ip>`), and the box IPs are recorded in project memory. Passwordless root SSH
worked to both boxes. Every fact below marked **OBSERVED** was read off a live box in
this session; every fact marked **INTENDED** comes from repo config only.

| Label | Meaning |
|---|---|
| **OBSERVED** | read from the live box (docker inspect / bind-mounted config / container logs / `ss -ltnp`) |
| **INTENDED** | read from the repo's committed deploy files — NOT confirmed live |

---

## BOTTOM LINE

**1. The live connector↔connector wire is BTP over `wss://…:443` — and it is spoken by
two *TypeScript* connectors, not by the Rust ones.** (OBSERVED)

There is exactly one live peering relationship on the devnet right now:

```
store box TS connector (nodeId: connector, <store-ip>)
    --- BTP  wss://proxy.devnet.toonprotocol.dev:443 --->
apex box TS connector (nodeId: toon-devnet-proxy, <apex-ip>)
```

It is active and carrying real paid packets on a 5-minute cadence (the store box's
kind:10032 self-announce, 2000 → 1998 after a 0.1% fee, FULFILLed, with Solana claims
verified on arrival). Observed continuously in both containers' logs.

**The Rust connector has no peers at all.** The live apex `connector-rust.toml` contains
**zero `[[peers]]` entries** and zero forwarded routes. It is a single connector with
clients hanging off it; its "store leg" is not a peering at all but a plain outbound
**HTTPS POST** to `https://proxy.store.devnet.toonprotocol.dev/store`. The custom raw-TCP
peer wire is not configured, not listening, and not in use anywhere on the fleet — but it
was never *replaced by BTP between Rust nodes*; the Rust fleet simply has no
node-to-node wire in production. `peer-claims.log` on the Rust state volume is
**0 bytes** (OBSERVED) — no peer-wire claim has ever been written.

So the owner's belief is **half right**: BTP-over-443 is indeed the only inter-connector
wire in the live fleet and the raw peer wire is dead — but the BTP link is a
**TypeScript↔TypeScript** link, and the Rust fleet is single-node.

**2. Yes — TypeScript connectors are still live, on BOTH boxes.** (OBSERVED)
`ghcr.io/toon-protocol/connector:3.36.3-solchan.0` runs on the apex box *and* the store
box, and it is the connector that answers the **default** public client edge
(`https://proxy.devnet.toonprotocol.dev/` → `http://connector:3000`). The Rust connector
is reachable only under the `/rust/ilp` and `/rust/ilp/btp` paths. The store box runs
**no Rust connector at all**.

**3. The Rust apex's relay price was cut from 1000 → 1 twenty hours ago** and the Rust
edge has served **zero packets since**. (OBSERVED)

---

## 1. What is actually running

### Apex box — Linode label `toon`, `<apex-ip>`, DNS `proxy.devnet.toonprotocol.dev`, `relay-ws.devnet.toonprotocol.dev`, `faucet.devnet.toonprotocol.dev`

OBSERVED — `docker ps` + `docker inspect`:

| Container | Image | Impl | Image built | Container started |
|---|---|---|---|---|
| `linode-node-connector-rust-1` | `ghcr.io/toon-protocol/connector:rust-sha-59e167f` | **Rust** | 2026-08-03T01:23:44Z (rev `59e167f271dd…`) | **2026-08-03T02:01:55Z** |
| `linode-node-connector-1` | `ghcr.io/toon-protocol/connector:3.36.3-solchan.0` | **TypeScript** | 2026-07-20T21:10:28Z (rev `c449a66e…`) | 2026-08-01T13:47:33Z |
| `linode-node-relay-1` | `ghcr.io/toon-protocol/relay:sha-d80f279` | — | — | up 25h |
| `linode-node-announcer-1` | `linode-node-announcer` (local build) | — | — | up 2d |
| `linode-node-faucet-1` | `linode-node-faucet` (local build) | — | — | up 2d |
| `linode-node-nginx-1` | `nginx:alpine` | — | — | up 13d |
| `linode-node-certbot-1` | `certbot/certbot` | — | — | up 13d |

Implementation confirmed from image entrypoints (OBSERVED):

```
rust-sha-59e167f          → [/usr/local/bin/connector] [/app/config/connector.toml]
3.36.3-solchan.0          → [docker-entrypoint.sh] [node packages/connector/dist/main.js]
```

Compose project files in use (OBSERVED, from the container's
`com.docker.compose.project.config_files` label):
`infra/linode-node/docker-compose.node.yml` + `docker-compose.node.rust.yml` +
`docker-compose.node.announcer.yml`.

### Store box — Linode label `toon-devnet-store`, `<store-ip>`, hostname `ario`, DNS `proxy.store.devnet.toonprotocol.dev`, `dvm.devnet.toonprotocol.dev`

OBSERVED:

| Container | Image | Impl | Started |
|---|---|---|---|
| `linode-store-connector-1` | `ghcr.io/toon-protocol/connector:3.36.3-solchan.0` | **TypeScript** | 2026-07-31T20:32:00Z |
| `linode-store-store-1` | `ghcr.io/toon-protocol/store:latest` | — | 2026-07-31T20:32:00Z |
| `linode-store-nginx-1` | `nginx:alpine` | — | up 13d |
| `linode-store-certbot-1` | `certbot/certbot` | — | up 13d |

Compose file in use: `infra/linode-store/docker-compose.store.yml` — the **non-rust**
variant. `ls /root/connector/infra/linode-store/` shows **no `docker-compose.store.rust.yml`
on the box at all** and no `connector-rust.toml`. The store box has never run Rust.

### Repo vs box drift (box leads repo, as expected)

| Thing | Repo `main` (INTENDED) | Live box (OBSERVED) |
|---|---|---|
| apex TS image | `infra/linode-node/docker-compose.node.yml:9` → `connector:3.36.1` | `connector:3.36.3-solchan.0` |
| apex Rust image | repo pins `rust-sha-18413d9` | `rust-sha-59e167f` |
| apex Rust `g.toon.relay` price | `price = 1000` | **`price = 1`** |
| apex TS EVM rpcUrl | `https://base-sepolia-rpc.publicnode.com` | `https://sepolia.base.org` |
| apex TS `selfAnnounce.enabled` | `true` | **`false`** (disabled 2026-08-01) |
| store peer chain | repo comment claims `solana:devnet` corrected | box: `chain: solana:devnet` ✔ |

The box's `/root/connector` checkout is on `05fa3ee7` ("rename devnet apex g.proxy →
g.toon") with `infra/linode-node/{connector.yaml,docker-compose.node.yml,nginx/conf.d/node.conf}`
locally modified and `connector-rust.toml` **untracked** — i.e. the Rust config exists
only on the box in this checkout. (OBSERVED)

---

## 2. Which wire do the connectors use to reach each other? — the central question

### 2a. The Rust apex has NO peers and NO peer wire

OBSERVED — live `/root/connector/infra/linode-node/connector-rust.toml` (13337 bytes,
mtime 2026-08-03 02:01). The complete set of top-level sections is:

```
client_edge_addr = "0.0.0.0:4000"
state_dir        = "/app/state"
[signer]
[[routes]]  prefix = "g.toon.relay"
[[routes]]  prefix = "g.toon.ario"
[[routes]]  prefix = "g.toon.store"
[settlement.evm] / [settlement.evm.key]
[settlement.solana] / [settlement.solana.key]
```

There is **no `[[peers]]` table**, no peer listener setting, and no route with a
peer next-hop. Every route is a local termination at an `handler_url`:

```toml
[[routes]]
prefix = "g.toon.relay"
handler_url = "http://relay:3100/write"
price = 1

[[routes]]
prefix = "g.toon.ario"
handler_url = "https://proxy.store.devnet.toonprotocol.dev/store"
price = 1000

[[routes]]
prefix = "g.toon.store"
handler_url = "https://proxy.store.devnet.toonprotocol.dev/store"
price = 1000
```

The file's own header states the design decision explicitly (quoted verbatim from the
live box):

> ```
> # The store box is another TOON node on the network, reached the way any
> # peer on the open internet would be — so the inter-node link is public,
> # carried over https and TLS-terminated by the store box's own nginx
> # (proxy.store.devnet.toonprotocol.dev, certbot-managed like this box's
> # hosts), the same shape as the TypeScript fleet's connector↔connector
> # links (BTP over wss://…:443). Both store routes below terminate at that
> # public https URL; no private segment exists between the boxes and none
> # is required.
> #
> # What this deliberately is NOT: the ADR 0003 peer wire with a store-side
> # Rust connector behind it — twice over.
> #
> #   * The peer wire cannot carry a public link (issue #623): raw-TCP
> #     custom framing (nothing nginx can TLS-terminate), no TLS of its own
> #     by ADR 0003's design, and SocketAddr-only [[peers]] addressing with
> #     nothing to hang a handshake on. …
> #   * The PAID forwarded path is structurally unwired anyway (issue #620):
> #     the client edge prices only locally-terminated routes (a peer route
> #     greets nothing and charges nothing), the terminating side never
> #     charges its `price` for a peer-wire arrival, and ADR 0024's peer
> #     claims cannot be configured from any connector.toml. A peer-forwarded
> #     g.toon.store would have served the store app FOR FREE end to end.
> ```

So the Rust "inter-node link" is **not a peering and not BTP** — it is an unauthenticated
`POST https://…/store` from the connector's `HttpAppClient`. It carries no ILP packet
between connectors, no peer claim, and no settlement.

Corroborating evidence (OBSERVED): on the Rust state volume
`/var/lib/docker/volumes/linode-node_connector_rust_state/_data/`:

```
-rw-r--r-- 1 10001 10001 134767150 Aug  3 02:02 client-edge-claims.log
-rw-r--r-- 1 10001 10001         0 Jul 29 21:52 peer-claims.log      ← 0 bytes, never written
```

### 2b. The only live peering is TypeScript↔TypeScript, over BTP on 443

OBSERVED — apex TS `/root/connector/infra/linode-node/connector.yaml`:

```yaml
nodeId: toon-devnet-proxy
btpServerPort: 3000
healthCheckPort: 8080

peers:
  - id: store-box
    url: wss://proxy.store.devnet.toonprotocol.dev:443
    relation: peer
    authToken: ''
    chain: solana:devnet
    settlementAddress: 'W6yK72j365eK7t4Qj5An1AaYtUEJcJK7TBPvGeDk1LV'
```

OBSERVED — store TS `/root/connector/infra/linode-store/connector.yaml`:

```yaml
nodeId: connector
btpServerPort: 3000
healthCheckPort: 8080

peers:
  - id: relay-connector
    url: wss://proxy.devnet.toonprotocol.dev:443
    relation: peer
    authToken: ''
    chain: solana:devnet
    settlementAddress: 'HgNmgJYrZFrx9DZgMopKa9971zGXW3hPL32Wsc6KzF6'
```

Both sides are `wss://…:443` — **BTP**, TLS-terminated by each box's nginx and proxied to
`http://connector:3000` (nginx `location /` with `Upgrade`/`Connection` headers). No bare
`host:custom-port` peer address exists anywhere in the live configs.

**This peering is live right now** — OBSERVED in the container logs, 5-minute cadence:

store box (`linode-store-connector-1`):
```
"destination":"g.toon.relay","amount":"2000","fromPeerId":"connector"      msg:"Packet received"
"destination":"g.toon.relay","selectedPeer":"relay-connector"              msg:"Routing decision"
"incomingAmount":"2000","outgoingAmount":"1998","connectorFee":"2"         msg:"Settlement transfers recorded"
"event":"btp_forward","destination":"g.toon.relay","amount":"1998","peerId":"relay-connector"
                                                                          msg:"Forwarding packet to peer via BTP"
"event":"btp_forward_success","peerId":"relay-connector","responseType":13 msg:"Received response from peer via BTP"
```

apex box (`linode-node-connector-1`), same packets arriving:
```
"packetType":"PREPARE","destination":"g.toon.relay","amount":"1998","fromPeerId":"connector"
"destination":"g.toon.relay","reason":"local delivery"    msg:"Delivering packet locally"
"component":"HttpProxyHandler","url":"http://relay:3100/write","status":200,"payer":"connector"
"component":"BTPServer","peerId":"connector","event":"btp_response_sent","responseType":"FULFILL"
"protocol":"claim-receiver","blockchain":"solana"         msg:"Claim verified and stored"
```

The traffic is the store box's own kind:10032 self-announce, which is still **enabled**
on the store box (`selfAnnounce.enabled: true`, `announceTo: g.toon.relay`,
`announcePrice: '2000'`) while the apex's own self-announce was **disabled**
(`enabled: false  # DISABLED 2026-08-01: harmful zombie announce replaced by announcer
sidecar (connector#681)`).

### 2c. Listeners actually open

OBSERVED — `ss -ltnp` on the **apex** box:

```
0.0.0.0:80    docker-proxy   nginx
0.0.0.0:443   docker-proxy   nginx   (TLS front for everything, incl. BTP upgrade)
0.0.0.0:3000  docker-proxy   TS connector — BTP server (btpServerPort) + ILP HTTP ingress
0.0.0.0:8080  docker-proxy   TS connector — health
0.0.0.0:3500  docker-proxy   faucet
127.0.0.1:4000 docker-proxy  Rust connector client edge — LOCALHOST ONLY
0.0.0.0:22    sshd
```

- The TS connector's admin API (`:8081`) is **not** host-published — nginx reaches it on
  the docker network and exposes only `GET /admin/metrics.json`; everything else under
  `/admin` returns 404.
- The Rust connector binds `0.0.0.0:4000` **inside its container** but the host publish is
  `127.0.0.1:4000` — it is reachable from the internet only through nginx.
- **No peer-wire listener is open on either box.** No custom port beyond the ones above.

OBSERVED — `ss -ltnp` on the **store** box: `80`, `443`, `3000` (TS connector BTP+ILP),
`8080` (health), `22`. Nothing else. No Rust, no peer wire.

### 2d. Which edge do clients hit?

OBSERVED — apex nginx `/root/connector/infra/linode-node/nginx/conf.d/node.conf`:

```nginx
map $host $backend {
    default                            "";
    relay-ws.devnet.toonprotocol.dev   "http://relay:7100";
    proxy.devnet.toonprotocol.dev      "http://connector:3000";   # ← TypeScript
    faucet.devnet.toonprotocol.dev     "http://faucet:3500";
}

location /rust/ilp {                                   # ← Rust HTTP client edge
    set $rust_edge http://connector-rust:4000;
    proxy_pass $rust_edge;
}

location = /rust/ilp/btp {                             # ← Rust CLIENT-edge BTP websocket
    set $rust_btp http://connector-rust:4000/ilp/btp;  #    (client-edge-spec §1.9, PR #680)
    proxy_pass $rust_btp;
    proxy_set_header Upgrade $http_upgrade;
}

location / {                                           # ← everything else → TypeScript
    proxy_pass $backend;
    proxy_set_header Upgrade $http_upgrade;
}
```

So there are three edges in front of the apex:

| URL | Impl | Transport |
|---|---|---|
| `https://proxy.devnet.toonprotocol.dev/ilp` (and `/`, and the `wss://…:443` peer URL) | **TypeScript** | ILP-over-HTTP **and** BTP websocket |
| `https://proxy.devnet.toonprotocol.dev/rust/ilp` | **Rust** | ILP-over-HTTP |
| `wss://proxy.devnet.toonprotocol.dev/rust/ilp/btp` | **Rust** | **client-edge** BTP websocket |

Note the Rust BTP websocket is a **client edge**, not a peer wire — it terminates client
sessions, it does not connect two connectors.

Discovery points clients at Rust. OBSERVED — `docker-compose.node.announcer.yml`, the
kind:10032 announcer sidecar deployed 2026-08-01 (connector#681/#683, ADR-0022 "the
connector answers, it does not announce"):

```yaml
ANNOUNCER_RUST_EDGE_URL:     http://connector-rust:4000
ANNOUNCER_ILP_ADDRESSES:     g.toon,g.toon.relay
ANNOUNCER_HTTP_ENDPOINT:     https://proxy.devnet.toonprotocol.dev/rust/ilp
ANNOUNCER_BTP_ENDPOINT:      wss://proxy.devnet.toonprotocol.dev/rust/ilp/btp
ANNOUNCER_RELAY_PUBLIC_URL:  wss://relay-ws.devnet.toonprotocol.dev
ANNOUNCER_SOLANA_CHAIN_ID:   solana:devnet
```

Meanwhile the **store box's** own announce still advertises the **TypeScript** endpoints
(`btpEndpoint: wss://proxy.store.devnet.toonprotocol.dev:443`), so both a Rust-edge and a
TS-edge kind:10032 are being published to the same relay.

### 2e. Is the Rust edge carrying traffic?

OBSERVED. Since its restart at **2026-08-03T02:01:58Z**, the Rust connector's entire log
is 2 lines of `connector listening` plus one `packet rejected / F01 / "prepare carries no
execution condition"` every 5 minutes (a healthcheck probe to `g.toon`). **Zero real
packets in ~20 hours.**

It *has* served heavy traffic historically: `client-edge-claims.log` is **134 MB**, last
written **2026-08-03 02:02**, with entries like

```
inbound_claim_accepted    solana:EadiuYCvFbJa5cwE1cHGtNf4tYP1qcj1BnmgtdYLv17a    65513    65014499    da5d1d20…
```

— nonce 65 513, cumulative 65 014 499 base units ⇒ **≈992 units per claim**, i.e. that
whole journal was written while the relay price was 1000.

So right now: the **TypeScript** pair is the only thing moving packets, and the Rust node
is idle behind a price change that has not yet been exercised.

---

## 3. Are any TypeScript connectors still deployed? — YES

OBSERVED, both boxes:

* apex `linode-node-connector-1` = `ghcr.io/toon-protocol/connector:3.36.3-solchan.0`,
  entrypoint `node packages/connector/dist/main.js` — **TypeScript**, up 2 days, and it is
  the connector serving the default public edge and one half of the live BTP peering.
* store `linode-store-connector-1` = same image — **TypeScript**, up 3 days, the only
  connector on that box, and the other half of the live BTP peering.

**Purging TypeScript today would break the only live inter-node link on the devnet**, plus
the default `proxy.devnet.toonprotocol.dev/ilp` client edge and the store box's entire
payment front. The Rust fleet has no substitute for either: no peers, no store-box node.

---

## 4. The packet price

OBSERVED, per box and per route:

### Apex box — Rust connector (`connector-rust.toml`)

| Route | Price (base units, 6-dec USDC) | Note |
|---|---|---|
| `g.toon.relay` → `http://relay:3100/write` | **`1`** | = 1 µUSDC/packet |
| `g.toon.ario` → `https://proxy.store…/store` | `1000` | = 0.001 USDC |
| `g.toon.store` → `https://proxy.store…/store` | `1000` | alias, price must match |

**The `1` is a hand edit made on the box at 2026-08-03 02:01**, followed by a container
restart at 02:01:55. Proof (OBSERVED):

```
$ diff connector-rust.toml.bak-20260803T020136Z connector-rust.toml
130c130
< price = 1000
---
> price = 1
```

and the same single-line difference against repo `main`:

```
$ diff <(git show main:infra/linode-node/connector-rust.toml) <live file>
130c130
< price = 1000
---
> price = 1
```

The surrounding comment block was **not** updated and still asserts the old value — the
live file now reads, contradictorily:

```toml
# Priced at parity with the TypeScript fleet's own g.toon.relay route on
# this same box (infra/linode-node/connector.yaml -- `price: '1000'`):
# … so `1000` here is the identical real-world charge -- 0.001 USDC …
price = 1
```

**Who set it:** not attributable from the box — `/root/.bash_history` has no matching
entry, the change is not in any git commit (the file is untracked in the box checkout),
and there is no `.next`/patch file carrying it. Circumstantially it is the buzz-huddles
price cut (huddles quote 1 µUSDC/frame; toon-meta#256 orchestration deployed the announcer
sidecar on the same box two days earlier). Treat authorship as **unknown / undocumented**.

### Apex box — TypeScript connector (`connector.yaml`)

| Route | Price | Kind |
|---|---|---|
| `g.toon.relay` → `http://relay:3100` | `'1000'` | terminated |
| `g.toon.relay.ario` → nextHop `store-box` | `'1000'` | forwarded over BTP |
| `g.toon.ario` → nextHop `store-box` | `'1000'` | forwarded over BTP |

`settlement.connectorFeePercentage: 0.0` on the apex TS node.

### Store box — TypeScript connector (`connector.yaml`)

| Route | Price | Kind |
|---|---|---|
| `g.toon.ario` → `http://store:3300` | `'1000'` | terminated |
| `g.toon.relay.ario` → `http://store:3300` | `'1000'` | terminated |
| `g.toon.relay` → nextHop `relay-connector` | *(none)* | outbound-only forward |
| `selfAnnounce.announcePrice` | `'2000'` | covers apex 1000 + 0.1% fwd fee |

`settlement.connectorFeePercentage: 0.1` — this is the `2000 → 1998, fee 2` seen live.

**Reconciling the prototype's measurement.** A prototype that measured **1000
µUSDC/packet** was correct for *everything except* the Rust `g.toon.relay` route as of
20 hours ago. Today: Rust relay writes cost **1**; Rust/TS store writes and all TS relay
writes still cost **1000**; a store-originated relay write costs **2000** at source.
The 1 µUSDC figure exists on exactly one route, on one connector, that has served zero
packets since the change.

---

## 5. TS-purge inventory

Two halves: what is **live** (OBSERVED, must be replaced before any purge) and what is
**referenced** (from repo/CI inspection — INTENDED/static).

### A. Live TypeScript connectors — blocking

| Where | What | Why it blocks |
|---|---|---|
| apex `<apex-ip>`, `linode-node-connector-1` | `connector:3.36.3-solchan.0` | serves default `proxy.devnet.toonprotocol.dev` edge; BTP server for the store peering; `g.toon.relay` + `g.toon.ario` routes |
| store `<store-ip>`, `linode-store-connector-1` | `connector:3.36.3-solchan.0` | the **only** connector on the store box; terminates `g.toon.ario`/`g.toon.relay.ario` → `store:3300`; self-announces kind:10032 |
| the peering itself | BTP `wss://…:443` both directions | no Rust equivalent exists — Rust has no `[[peers]]` support wired for a public link (#623) and no paid forward path (#620) |

### B. Still built / published from a TS connector image

| Repo | Artifact | Detail |
|---|---|---|
| **relay** | `ghcr.io/toon-protocol/relay-connector` | `deploy/Dockerfile:16-17` `ARG CONNECTOR_TAG=3.28.0` / `FROM ghcr.io/toon-protocol/connector:${CONNECTOR_TAG}`; CI `.github/workflows/publish-relay-connector-image.yml` job `build-push` line 57. **Rebuilt on every push to main.** Also `deploy/docker-compose.yml:27,32`, `deploy/.env.example:18` |
| **store** | `ghcr.io/toon-protocol/store-connector` | `deploy/Dockerfile:16-17` same shape, `CONNECTOR_TAG=3.28.0`; CI `.github/workflows/publish-store-connector-image.yml` job `build-push` line 58. **Rebuilt on every push to main.** Also `deploy/docker-compose.yml:22,27`, `deploy/.env.example:28` |

These two are the only remaining *automated producers* that depend on the TS image.

### C. Compose / deploy files still pointing at frozen TS image tags

| File | Line | Tag |
|---|---|---|
| `connector/docker-compose.prod.yml` | 37 | `connector:3.44.0` |
| `connector/deploy/pay-edge/docker-compose.yml` | 31 | `${CONNECTOR_IMAGE:-…connector:3.44.0}` |
| `connector/deploy/pay-edge/.env.example` | 36 | `connector:latest` |
| `connector/deploy/node-quickstart/docker-compose.yml` | 38, 90 | `${CONNECTOR_IMAGE:-…connector:3.44.0}` ×2 services |
| `connector/deploy/node-quickstart/.env.example` | 21, 23 | `connector:latest` |
| `connector/infra/linode-node/docker-compose.node.yml` | 9 | `connector:3.36.1` — **this is the live apex TS service** |
| `connector/infra/linode-store/docker-compose.store.yml` | 21 | `connector:3.36.3-solchan.0` — **this is the live store TS service** |
| `town/docker-compose-townhouse.yml` | 23 | digest `sha256:48d2160e…` |
| `town/docker-compose-townhouse-dev.yml` | 43 | `:3.9.0` |
| `town/docker-compose-townhouse-hs.yml` | 227 | `:3.9.0` |
| `town/deploy/akash/townhouse.sdl.yaml` | 90, 116 | `:3.4.1`, `exec node packages/connector/dist/main.js` |
| `hub/packages/hub/src/constants.ts` | 123 | `DEFAULT_CONNECTOR_IMAGE = 'ghcr.io/toon-protocol/connector@sha256:48d2160e…'` |
| `hub/packages/hub/compose/hub-direct.yml` | 83 | `connector${TOON_CONNECTOR_DIGEST}` |
| `hub/packages/hub/compose/hub-hs.yml` | 109 | `connector${TOON_CONNECTOR_DIGEST}` |
| `hub/packages/hub/compose/hub-dev.yml` | 51 | `:3.10.0` |

Plus `town/.github/workflows/publish-townhouse-images.yml` (`CONNECTOR_VERSION_DEFAULT`,
currently `3.10.3`, baked into `image-manifest.json`), `town/.github/workflows/test.yml:193-253`
(`connector-contract-canary`), `town/scripts/townhouse-test-infra.sh:93-109`,
`town/scripts/rerun-earnings-gate.sh:179-228`, `town/scripts/townhouse-e2e-local-hs.sh:212,247`,
`hub/.github/workflows/deploy-hub.yml:197-207`, and ~15 `hub` test fixtures pinning
`:3.3.3`/`:3.4.1`/`:3.5.0`.

### D. npm package `@toon-protocol/connector` — still published

`latest = 4.0.0`, published 2026-07-27. Note v4.0.0's description is *"TypeScript client
for the ILP connector's client edge"* — the v4 line is the **client shim**, not the
connector server; the server line stops at `3.44.2`. Everything downstream pins `^3.x`, so
nothing resolves to 4.0.0.

Real declared dependencies (not lockfile noise):

| Repo | Declaration |
|---|---|
| **store** | `package.json:24` `"@toon-protocol/connector": "^3.10.0"` (runtime dependency; likely dead weight since it ships as an image) |
| **swap** | `packages/swap/package.json:60` `"^3.30.0"` (runtime; real imports in `src/swap-node.ts:31-32`, `src/index.ts:166`, integration/e2e tests) |
| **town** | 7 package.jsons — deps `^3.10.0` in `packages/town`, `packages/mill`, `docker/`, `examples/sdk-example`, `examples/town-example`; optional peer `>=3.3.3` in `packages/core`; devDep + optional peer in `packages/sdk` |
| **toon** | `packages/core/package.json:64,67` optional peer `>=3.3.3`; `packages/sdk/package.json:65,69,77` optional peer + devDep `^3.10.0` |

Lockfile-only (no declared dep, safe): **relay**, **rig**, **toon-client**, **buzz**, **hub**.
Zero references at all: **fractal**, **capability-market**.

### E. Already purged

The TypeScript connector **source** is gone from the connector repo — deleted in commit
`2d981565` "chore: retire the TypeScript connector and its npm/CI machinery (ADR 0017)".
`packages/connector/` no longer exists, the root `package.json` workspaces no longer list
it, there is no `.changeset/`, and the only image-publishing workflow is
`.github/workflows/publish-connector-rust-image.yml` (tags `rust-sha-<short>`, `rust-main`).
So everything in B–D above is **downstream consumption of frozen published artifacts**, not
production of new ones — except relay/store CI, which still rebuild *from* the frozen image
on every merge.

Caveats: `town/packages/mill/` still exists as a stale copy of the pre-rename mill (there is
no separate `mill` repo — it became `swap`, confirmed via `swap` git remote and
`swap/docs/sdk-2x-migration.md`). `connector/.github/workflows/agent-implement.yml:168-173`
and `agent-review.yml:105-106` reference `ghcr.io/toon-protocol/connector:sandcastle-agent` —
an agent-sandbox image squatting on the same GHCR path, unrelated to the TS connector, and
its `docker push` is commented out.

---

## Appendix — commands used (all read-only)

```
ssh -i ~/.ssh/id_rsa root@<apex-ip>    # apex  (Linode label `toon`)
ssh -i ~/.ssh/id_rsa root@<store-ip>      # store (Linode label `toon-devnet-store`)

docker ps --format …
docker inspect <container> --format '{{index .Config.Labels "com.docker.compose.project.config_files"}}…'
docker image inspect <image> --format '{{.Config.Entrypoint}} {{.Config.Cmd}} …'
docker logs --tail N <container>
ss -ltnp
ls -la /root/connector/infra/linode-{node,store}/
diff <box backup> <box live>          # on-box, read-only
scp <box>:/root/connector/infra/… → local scratchpad
git -C /root/connector log/status     # read-only
```

No `docker compose up/down`, no `docker restart`, no writes to any box.
