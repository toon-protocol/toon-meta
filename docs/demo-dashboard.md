# Public demo dashboard — live packet flow

A single public page that visualises the [cross-currency multihop demo](demo-day-runbook.md)
(rig → **toon** → **ario**) with live per-hop packet counts, a
Nostr-event packet stream, and accumulated settlement — so packets can be shown
hopping through each connector during a live `rig push`, without SSH + port
forwarding to each box's admin dashboard.

> **Stale against the live fleet.** This document still describes the apex +
> `ario` two-box shape and the TypeScript connector's `/admin/*` telemetry. Both
> are gone: the apex was destroyed 2026-08-14, the devnet is four boxes (relay,
> store, gas, faucet) with the relay as write ingress, and the `/admin/*`
> endpoints this page polled belonged to the TypeScript connector. The code in
> `scripts/demo-dashboard/` already says so (`RETIRED_TELEMETRY`, and the
> `STALE NODE SET` note in `src/lib/toon.ts`); this prose has not caught up. The
> chain and address facts below were corrected 2026-08-28.

The fleet was **two boxes** when this was written: the `toon` apex (client entry,
relay, faucet) and the `ario` store (Arweave DVM, route termination). A third box
— the sandbox entry — was **decommissioned on 2026-07-31**.

**Live at:** `https://faucet.devnet.toonprotocol.dev/dash`

Source: [`scripts/demo-dashboard/`](../scripts/demo-dashboard) — a Vite + React +
Tailwind + **shadcn/ui** app (built to a static bundle) · nginx snippet:
[`scripts/demo-dashboard/nginx-telemetry.conf`](../scripts/demo-dashboard/nginx-telemetry.conf).

> **The telemetry the boxes serve is now `/admin/metrics.json` only**
> ([connector#665](https://github.com/toon-protocol/connector/issues/665)).
> `earnings.json`, `routes`, `peers` and `channels` were reachable
> unauthenticated from anywhere and each carried an identifier that is not
> otherwise public — most sharply `earnings.json`, whose
> `recentClaims[].peerId` is a counterparty's `http:0x…` EVM address joined to
> that claim's amount and timestamp. connector ADR 0008 puts every operator
> read behind a bearer token, so none of it was sanctioned.
>
> The dashboard still renders its flow strip, per-hop packet counters, peer
> lists, balances and the packet stream. What degrades, gracefully: per-node
> **recent claims** and **net settled · session** read zero, and the
> **node-detail modal**'s routes / channels / peers / claims tables render
> empty. The page footer still advertises the old five-endpoint list — it is
> baked into the deployed bundle and corrects itself on the next rebuild.
>
> Restoring those panels wants an authenticated telemetry path, not a widened
> `location`. Do not re-add the four endpoints to the snippet.

## What it shows

- **Flow strip** — the two connectors as a chain (client USDC → Solana →
  Arweave): the apex card, the Solana link column, the store card. Each node card
  shows live `packetsForwarded` / `packetsRejected`, uptime, peers, recent claims,
  and **net settled · session**. The inter-node link sparks and its counter ticks
  when `packetsForwarded` advances. The client's entry leg into the apex has no
  upstream card, so it is counted but not drawn — as the client-entry leg always
  was.
- **Network profit (session)** — header total + per-node breakdown (see the
  profit caveat below).
- **Live packets** — a Nostr-event stream from the apex relay, each row labelled
  with its `kind` (e.g. `kind:30617 · repo-announce`, `kind:10032 ·
  route-announce`, `kind:5094 · store-request`); click any row for the full
  event (pretty-printed `content` + raw JSON).
- **Node detail modal** — click a node for its resolved **routes** (prefix →
  nextHop, price, chains, per-chain settlement addresses), **settlement
  channels** (id / chain / status / deposit / last activity), **wallets &
  balances**, **settlement policy**, **peers** (ILP addresses), a per-node
  **packets** list (relay events, kind-labelled), and the **settlement claims**
  log; packet and claim rows are clickable for their full data.
- **Wallets & balances** — per node, each settlement wallet (Base / Solana)
  with address (copy + explorer link) and **live on-chain balance**
  (native gas + USDC), queried client-side. The **store's ArNS DVM wallet** and
  its **ARIO** token balance (ar.io devnet SPL) and the **gas station** wallet
  are shown too. Node cards carry a compact gas chip that turns red below a
  floor (ETH < 0.005 / SOL < 0.1), and the header flags how many
  wallets are low — the top-up cue.
- **Settlement policy** — the on-chain settle threshold (`defaultThreshold`
  5000 base units = 0.005 USDC) and timeout (`settlementTimeoutSecs` 3600), plus
  a per-counterparty proximity bar. The connector's *live unsettled balance*
  is not exposed by the 3.36.x admin API, so the bar shows the largest recent
  claim vs the threshold as a proxy (stated on the page).

## Architecture

The page is static HTML served by the TOON apex box's nginx at `/dash`. It pulls
live data from two sources, both already public:

1. **Connector admin telemetry** (per box) — read-only JSON from each
   connector's admin API (`:8081`, container-internal), surfaced through nginx:
   - `toon`   → `https://faucet.devnet.toonprotocol.dev/admin/*` (same origin)
   - `ario`   → `https://dvm.devnet.toonprotocol.dev/admin/*`

   Only `/admin/{metrics.json,earnings.json,routes,peers,channels}` are proxied,
   **GET-only**, CORS-locked to the dashboard origin. Mutating admin routes
   (`POST /admin/peers`, `PUT /admin/desired-state`, …) are deliberately not
   proxied. See the nginx snippet.

2. **Relay Nostr WS** — the browser opens a WebSocket directly to
   `wss://relay-ws.devnet.toonprotocol.dev` (already public; no CORS / nginx
   change needed) and `REQ`s recent events. This is the only real source
   of packet **kind** and payload — the connector forwards opaque packets and
   cannot decode the Nostr event. The per-node packets list attributes events
   by relay source; with one relay in the fleet, both nodes read from the toon
   relay (ario publishes to it).

3. **Chain RPCs** — the browser reads wallet balances directly from public RPCs
   (Base Sepolia `base-sepolia-rpc.publicnode.com`, Solana `api.devnet.solana.com`),
   both of which allow browser CORS. Polled every 45 s
   (with an 8 s per-request timeout so one slow RPC can't stall the sweep). ARIO
   balance = the ArNS DVM Solana wallet's holding of SPL mint
   `6vTw5CysRXQ4ybbHkDUiisHWVsBeMtUzYvJqs2iqHyaN`.

## Two caveats (both are connector-version limitations, not the dashboard)

The devnet boxes run connector `3.36.3-solchan.0` (pinned; 3.40.x runaway-CPUs
the 2 GB boxes):

- **Profit accumulates client-side, since page load** — the connector does not
  expose all-time fees (`connectorFees` / `peers[].byAsset` are empty). The page
  sums net settled (inbound − outbound, USDC 6dp) per node from the claim stream
  as it observes it; a reload resets it.
- **Two chains, not three.** Mina left the connector repository with
  [connector ADR 0065](https://github.com/toon-protocol/connector/blob/main/docs/adr/0065-mina-leaves-the-repository.md);
  the dashboard's Mina colour, RPC, wallets, gas floor and balance reader are
  removed. A connector still **refuses a claim whose `blockchain` is `mina` by
  name** ([ADR 0002](https://github.com/toon-protocol/connector/blob/main/docs/adr/0002-drop-mina-from-the-rust-connector.md)) —
  that refusal is wire behaviour owed to `toon-client` and is not to be cleaned
  up.

## Build

```sh
cd scripts/demo-dashboard
npm install          # on Apple Silicon, if the build errors on a missing
                     # rolldown native binding, run: npm i @rolldown/binding-darwin-arm64
npm run build        # → dist/  (Vite base is /dash/, so assets resolve under /dash/)
```

## Deploy

Per box, add the read-only telemetry `location` to the `listen 443 ssl` block of
its `node.conf` (see snippet). On the TOON apex box also add the `/dash` page
block and drop the **built bundle** in (the `conf.d` dir is bind-mounted into the
nginx container, so `dashsite/` is served directly):

```sh
# TOON apex box (104.237.150.177) — serves the page:
CD=/root/connector/infra/linode-node/nginx/conf.d
tar -czf /tmp/dash.tgz -C dist .          # from scripts/demo-dashboard on your Mac; scp to the box
rm -rf $CD/dashsite && mkdir -p $CD/dashsite && tar -xzf /tmp/dash.tgz -C $CD/dashsite
# ...edit $CD/node.conf per the snippet (telemetry + /dash location)...
docker exec linode-node-nginx-1 nginx -t && docker exec linode-node-nginx-1 nginx -s reload

# ario (45.79.173.113): telemetry location only, then
docker exec <box>-nginx-1 nginx -t && docker exec <box>-nginx-1 nginx -s reload
```

The nginx `/dash/` location uses `alias …/dashsite/` with
`try_files $uri $uri/ /dash/index.html`, so the SPA and its `/dash/assets/*`
bundle both resolve. Box IPs / hostnames / connector layout:
[deployment.md](deployment.md).

## Teardown (after demo day)

Demo day is long past and this teardown was never run — which is how four
admin endpoints stayed open to the internet until
[connector#665](https://github.com/toon-protocol/connector/issues/665). The
remaining exposure is `/admin/metrics.json` plus the `/dash` page itself.

Each box's original `node.conf` was backed up as `node.conf.pre-dash-bak` (and
the #665 change left a `node.conf.bak-issue665-<ts>` beside it); restore it,
remove `conf.d/dashsite` on the toon box, then
`nginx -t && nginx -s reload`. That closes the rest.

The third box that also carried this block — the sandbox entry — was
**decommissioned on 2026-07-31**. It no longer exists, so nothing is served from
it and no follow-up is needed there.
