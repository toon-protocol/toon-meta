# Public demo dashboard — live packet flow

A single public page that visualises the [cross-currency multihop demo](demo-day-runbook.md)
(rig → **sandbox** → **toon** → **ario**) with live per-hop packet counts, a
Nostr-event packet stream, and accumulated settlement — so packets can be shown
hopping through each connector during a live `rig push`, without SSH + port
forwarding to each box's admin dashboard.

**Live at:** `https://faucet.devnet.toonprotocol.dev/dash`

Source: [`scripts/demo-dashboard/index.html`](../scripts/demo-dashboard/index.html)
(self-contained — no build, no external deps) · nginx snippet:
[`scripts/demo-dashboard/nginx-telemetry.conf`](../scripts/demo-dashboard/nginx-telemetry.conf).

## What it shows

- **Flow strip** — the three connectors as a chain (Mina → Base → Solana →
  Arweave). Each node card shows live `packetsForwarded` / `packetsRejected`,
  uptime, peers, recent claims, and **net settled · session**. The inter-node
  links spark and their counters tick when `packetsForwarded` advances.
- **Network profit (session)** — header total + per-node breakdown (see the
  profit caveat below).
- **Live packets** — a Nostr-event stream from the relays, each row labelled
  with its `kind` (e.g. `kind:30617 · repo-announce`, `kind:10032 ·
  route-announce`, `kind:5094 · store-request`); click any row for the full
  event (pretty-printed `content` + raw JSON).
- **Node detail modal** — click a node for its resolved **routes** (prefix →
  nextHop, price, chains, per-chain settlement addresses), **settlement
  channels** (id / chain / status / deposit / last activity), **peers** (ILP
  addresses), and the full **packet log**; claim rows are clickable for the
  full settlement-claim data.

## Architecture

The page is static HTML served by the TOON apex box's nginx at `/dash`. It pulls
live data from two sources, both already public:

1. **Connector admin telemetry** (per box) — read-only JSON from each
   connector's admin API (`:8081`, container-internal), surfaced through nginx:
   - `toon`   → `https://faucet.devnet.toonprotocol.dev/admin/*` (same origin)
   - `sandbox`→ `https://relay-ws.sandbox.devnet.toonprotocol.dev/admin/*`
   - `ario`   → `https://dvm.devnet.toonprotocol.dev/admin/*`

   Only `/admin/{metrics.json,earnings.json,routes,peers,channels}` are proxied,
   **GET-only**, CORS-locked to the dashboard origin. Mutating admin routes
   (`POST /admin/peers`, `PUT /admin/desired-state`, …) are deliberately not
   proxied. See the nginx snippet.

2. **Relay Nostr WS** — the browser opens WebSockets directly to
   `wss://relay-ws.devnet.toonprotocol.dev` and
   `wss://relay-ws.sandbox.devnet.toonprotocol.dev` (already public; no CORS /
   nginx change needed) and `REQ`s recent events. This is the only real source
   of packet **kind** and payload — the connector forwards opaque packets and
   cannot decode the Nostr event.

## Two caveats (both are connector-version limitations, not the dashboard)

The devnet boxes run connector `3.36.3-solchan.0` (pinned; 3.40.x runaway-CPUs
the 2 GB boxes):

- **Profit accumulates client-side, since page load** — the connector does not
  expose all-time fees (`connectorFees` / `peers[].byAsset` are empty). The page
  sums net settled (inbound − outbound, USDC 6dp) per node from the claim stream
  as it observes it; a reload resets it.
- **Sandbox Mina entry-leg amounts are untracked** — Mina claims report
  `assetCode:"MINA"` with `amount:0`, so the sandbox's claim rows show
  `settle ✓` (not a value) and its session profit reads ~0. Base and Solana legs
  report exact USDC amounts.

## Deploy

Per box, add the read-only telemetry `location` to the `listen 443 ssl` block of
its `node.conf` (see snippet), then on the TOON apex box also add the `/dash`
page block and drop the page in:

```sh
# TOON apex box (104.237.150.177):
CD=/root/connector/infra/linode-node/nginx/conf.d
mkdir -p $CD/dashsite && cp index.html $CD/dashsite/index.html
# ...edit $CD/node.conf per the snippet...
docker exec linode-node-nginx-1 nginx -t && docker exec linode-node-nginx-1 nginx -s reload

# sandbox (50.116.48.49) and ario (45.79.173.113): telemetry location only, then
docker exec <box>-nginx-1 nginx -t && docker exec <box>-nginx-1 nginx -s reload
```

Box IPs / hostnames / connector layout: [deployment.md](deployment.md).

## Teardown (after demo day)

The exposure is temporary. Each box's original `node.conf` was backed up as
`node.conf.pre-dash-bak`; restore it, remove `conf.d/dashsite` on the toon box,
then `nginx -t && nginx -s reload`. That closes the public `/admin/*` telemetry
and the `/dash` page.
