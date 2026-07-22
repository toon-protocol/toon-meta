# Deployment

## Prerequisites

- Docker & Docker Compose
- Node.js >= 20
- pnpm 8.15.0 (`corepack enable && corepack prepare pnpm@8.15.0 --activate`)
- Connector contracts repo cloned at `../connector` (required for SDK E2E infrastructure)

## Building from Source

```bash
git clone https://github.com/toon-protocol/town.git
cd toon

pnpm install        # Install dependencies
pnpm build          # Build all packages
pnpm test           # Run tests (optional)
pnpm lint           # Lint (optional)
pnpm format         # Format (optional)
```

## SDK E2E Infrastructure

Deploy a controlled 2-peer setup with Anvil for local development and testing:

```bash
./scripts/sdk-e2e-infra.sh up
```

To stop the infrastructure:

```bash
./scripts/sdk-e2e-infra.sh down
```

**Services started:**

| Service | URL | Purpose |
|---------|-----|---------|
| Anvil | http://localhost:18545 | Local EVM chain (chain ID 31337) |
| Peer 1 BLS | http://localhost:19100 | ILP packet validation |
| Peer 1 Relay | ws://localhost:19700 | Nostr WebSocket |
| Peer 2 BLS | http://localhost:19110 | ILP packet validation |
| Peer 2 Relay | ws://localhost:19710 | Nostr WebSocket |

## Linode Devnet — LIVE (public-chain settlement)

The devnet runs on **three Linode boxes** (sandbox entry + relay/proxy/faucet + Arweave store DVM)
and settles on **public networks** — Base Sepolia, Solana devnet, and Mina
devnet. The three self-hosted blockchain boxes (Anvil, solana-test-validator,
Mina lightnet) were **deleted on 2026-07-19** as part of the public-chain
cutover. DNS is Porkbun-managed; endpoints are under
`*.devnet.toonprotocol.dev` with trusted Let's Encrypt TLS.

### Node layout

Three connector nodes form a **cross-currency multi-hop** path. A client pays the
sandbox entry in **Mina USDC**; each connector hop settles with the next in a
different chain (**Mina → Base → Solana**), terminating at the ario store DVM.

| Node | Linode label | IP | Plan | Role |
|------|-------------|-----|------|------|
| Sandbox apex (client entry: connector + relay) | `toon-relay-test` | `50.116.48.49` | g6-standard-2 (4 GB) | accepts **Mina USDC** from clients; settles **Base** with `toon` |
| TOON apex (connector + relay + faucet) | `toon` | `104.237.150.177` | g6-standard-1 (2 GB) | settles **Base** with sandbox; settles **Solana** with `ario` |
| Store (connector + Arweave DVM + ARIO gas station) | `ario` | `45.79.173.113` | g6-standard-1 (2 GB) | terminates `g.toon.ario`; receives **Sol USDC** |

Settlement links (per-peer `chain:` in each `connector.yaml`): sandbox↔toon on
`evm:84532`; toon↔ario on `solana:devnet` (one shared bidirectional Solana channel
`5z6znXjH…`). The sandbox forwards `g.toon.relay` / `g.toon.ario` / `g.toon.relay.ario`
up to `toon`. Per-peer non-EVM channel settlement requires the connector fix on the
`3.36.x` line (image `3.36.3-solchan.0`); see the `fix/channelmanager-open-3.36` branch.
Clients pay the sandbox in Mina against a **dedicated** client-build PaymentChannel
zkApp (one zkApp per participant pair — the apex's cannot be reused). rig ≥ 2.13.0
deploys this zkApp **automatically** on the first Mina channel open (or explicitly
via `rig channel deploy-zkapp`); the zkApp key is recorded in
`~/.toon-client/keys/rig-mina-zkapps.json`.

### Endpoints

`<box>` = `devnet.toonprotocol.dev`

| Service | Endpoint | Node | Notes |
|---------|----------|------|-------|
| Relay | `wss://relay-ws.<box>` | toon | Nostr WebSocket (oblivious relay, free read) |
| Payment proxy | `https://proxy.<box>` / `wss://proxy.<box>:443` | toon | ILP ingress (`g.toon.relay`) |
| Faucet (+ frontend) | `https://faucet.<box>` | toon | Multi-chain faucet, 3-chain web UI at `/` |
| Store ILP edge | `https://proxy.store.<box>/ilp` | store | route `g.toon.ario` |
| Store DVM | `https://dvm.<box>` | store | `/health`; `/store` = payment-oblivious job route (kind:5094/5095/5096) |
| Sandbox relay | `wss://relay-ws.sandbox.<box>` | sandbox | Mina-only multihop entry (demo path); switch with `rig entry sandbox` |
| Sandbox payment proxy | `wss://proxy.sandbox.<box>:443` | sandbox | ILP ingress accepting **Mina USDC only**; forwards `g.toon.*` to `toon` |

Retired endpoints (DNS records pending removal): `evm-rpc.*`, `solana-rpc.*`,
`solana-ws.*`, `mina.*`, `mina-accounts.*`. `store.<box>` was never wired
(parked at the registrar) — use `dvm.<box>` / `proxy.store.<box>`.

Public chain RPCs (no self-hosted chain infra):

| Chain | Chain id (announced) | RPC |
|-------|----------------------|-----|
| EVM Base Sepolia | `evm:84532` | `https://sepolia.base.org` (channel-open flows prefer a single-backend RPC, e.g. `https://base-sepolia-rpc.publicnode.com` — the official LB serves stale reads that break open→deposit sequencing) |
| Solana devnet | `solana:devnet` | `https://api.devnet.solana.com` |
| Mina devnet | `mina:devnet` | `https://api.minascan.io/node/devnet/v1/graphql` |

### Deployed settlement contracts (public networks, verified 2026-07-19)

**USDC is 6-decimal on every chain** (uniform claim base units). Verified by
paid `rig push` round-trips per chain (channel open → per-packet claims →
FULFILL → relay read-back; Solana claims redeemed on-chain).

> **Authoritative runtime source:** the apex's kind:10032 announce on
> `wss://relay-ws.devnet.toonprotocol.dev` carries `supportedChains`,
> `settlementAddresses`, `tokenNetworks`, `preferredTokens`, and per-route
> `capabilities` prices — clients derive settlement parameters from the
> announce. This table is a human-readable snapshot.

| Chain | What | Address |
|-------|------|---------|
| Base Sepolia | TokenNetworkRegistry | `0xcC9079adE929b168B54145f6d25262b64FAB9D5b` |
| Base Sepolia | TokenNetwork (runtime-resolved) | `0x1E95493fEF46707E034b4a1945f25a8C76A1823D` |
| Base Sepolia | Mock USDC (ERC-20, 6dp, **ungated mint**) | `0x49beE1Bca5d15Fb0963117923403F9498119a9Ce` |
| Solana devnet | Payment-channel **program** | `2aEVJ8koKD8LTZrLRSGtAtU7LBt4e7QjjCgf1kzQ7Rip` |
| Solana devnet | Mock USDC SPL **mint** (6dp) | `xyc5J8MgKFiEN13PnfftdXxUzYH34FEvw1LCrFwN7in` |
| Mina devnet | **PaymentChannel** zkApp (bare, client-build vk) | `B62qmgPhv2Xo6QVEtwjLja8UZJUtu8yapRFAR6gaoGtbM9zE5hG7Tkf` |
| Mina devnet | Rate-limited mock USDC token (6dp, permissionless mint 1000/addr/24h) | `B62qqN1Pu3kF2KGmqLA8EwpqfWrnFTVZJGDSDHQuQRoVt5BCFjhNz3d` |
| Mina devnet | USDC **tokenId** | `9497120696276615621907376728658022802954262638363646162765282600447713419198` |

> **Mina vk gotcha (cost a redeploy):** the PaymentChannel zkApp MUST be
> deployed from the **client-side build** (`@toon-protocol/mina-zkapp@0.1.1`
> npm package + o1js 2.14.0, BARE — no `initializeChannel`) or the client's
> channel-open proof fails with "Stale verification key". The connector repo's
> local `packages/mina-zkapp` dist has drifted from the published 0.1.1
> (same version, different vk). Deploy records + zkApp key:
> `~/.toon-client/keys/mina-zkapp-client-deploy.json` (operator Mac).
> Mina USDC deploy record: `~/.toon-client/keys/usdc-rl-deploy.json`.

### Faucet routes (`https://faucet.devnet.toonprotocol.dev`)

| Method & path | Body | Drips |
|---------------|------|-------|
| `POST /api/base-sepolia/request` | `{address}` | 1000 USDC (ungated on-chain mint; faucet key only pays gas — **no ETH drip**, fund gas separately) |
| `POST /api/solana/request` | `{address}` | 2 SOL airdrop + 1000 USDC treasury transfer. The airdrop is **skipped** when the recipient already holds SOL, and a **failed** airdrop (public devnet quota/dry) no longer aborts the USDC transfer |
| `POST /api/solana/usdc-request` | `{address}` | **USDC only, no airdrop** — treasury-funded token transfer. Works even when the devnet airdrop is dry and when the recipient holds 0 SOL. Use for addresses already funded with SOL |
| `POST /api/mina/request` | `{address}` | 5 MINA + USDC (treasury self-mint on the rate-limited token) |
| `POST /api/mina/usdc-request` | `{address}` | **USDC only** — treasury transfer, no native MINA leg (rate-limited ~1000/24h) |
| `GET /api/info` | — | machine-readable per-chain config (routes, `usdcMint`/`tokenAddress`, `ready`, drip amounts) — **query this to discover live addresses** |
| `POST /api/request` | `{address}` | **deprecated** legacy anvil leg (`local:true`, dead). ⚠️ Stale clients (e.g. older `rig fund`) hit this by mistake — use the `/api/base-sepolia/request` route for public EVM USDC |

> **Airdrop coupling (fixed).** The Solana `/api/solana/request` leg used to abort the whole
> request (and thus the USDC transfer) whenever the public Solana devnet airdrop was
> rate-limited/dry (`429 "airdrop faucet has run dry"`). The USDC transfer is treasury-funded and
> independent of that airdrop, so it is now decoupled: the airdrop is skipped for already-funded
> recipients and tolerated on failure, and `POST /api/solana/usdc-request` drips USDC with no
> airdrop leg at all. (connector `packages/faucet/src/solana.js`.)

The web frontend at `/` exposes all three public chains. Treasuries:
Mina `B62qmVAwZb65H8Kv9wc2yhZJSirNcuq2FuhsrXdB8uM2W1AiQqJJmUD` (top up via
https://faucet.minaprotocol.com), Solana `AEPoA5xTTJY9SR8c5CfsemFGC5TmxQBe6Xf6wewEtnYa`
(mint authority; keypair at `~/.toon-client/keys/solana-usdc-treasury.json` and
`/root/keys/solana-usdc-treasury.json` on the toon box), Base Sepolia faucet key
`0x6bafedaF18FF62f0a63dd0148bafa163204627F6` (needs only gas ETH).
**Never send transactions from the faucet's hot keys manually while the
service is live — it desyncs the faucet's nonce manager.**

### Pointing a client at the devnet (rig standalone)

With `rig >= 2.13.0` **no `config.json` is needed at all** on the apex path:

- relay + payment ingress come from core's committed genesis seed (the live
  devnet apex), or a live kind:10032 announce once discovered;
- `rig fund` infers devnet (and the faucet URL) from the same seed on a truly
  fresh install;
- chain RPCs, tokens, TokenNetworks, and the Solana/Mina channel params derive
  from the announce + core 3.1.2 presets;
- on Mina, the first channel open **auto-deploys** the identity's dedicated
  PaymentChannel zkApp (single-pair; key saved under
  `~/.toon-client/keys/rig-mina-zkapps.json`; pre-deploy with
  `rig channel deploy-zkapp` to keep the first paid write fast).

Steering knobs (all free, local-config writes):

- `rig chain set <evm|sol|mina>` — which chain/USDC settles paid writes
  (per-run override: `TOON_CLIENT_CHAIN=evm:84532|solana:devnet|mina:devnet`,
  announced spellings).
- `rig entry <apex|sandbox|url>` — which entry node to pay through.
  `rig entry sandbox` targets the Mina-only multihop entry and auto-clears the
  topology cache. NOTE: a repo publishes to its git `origin` relay, which
  overrides config — after switching, `rig remote add origin
  wss://relay-ws.sandbox.devnet.toonprotocol.dev` (or use a fresh repo).
- `rig channels` — the recorded payment channels (`rig balance` for wallets).

Manual overrides remain available for self-hosted networks — the pre-2.13
shape (btpUrl/relayUrl/faucetUrl/chainRpcUrls/minaChannel fields in
`~/.toon-client/config.json`) still wins over every derived value. Do **not**
set `supportedChains`/`tokenNetworks`/`preferredTokens` explicitly — explicit
topology bypasses announce-derived route prices and reintroduces F06
rejections. After HAND-editing config, delete
`~/.toon-client/rig-topology-cache.json` (cached topology can mask edits;
`rig entry` does this for you).

The end-to-end demo flow (fund → push → site → ArNS name) is scripted in
[`scripts/demo-e2e.sh`](../scripts/demo-e2e.sh); the demo-day command sequence
lives in [`docs/demo-day-runbook.md`](demo-day-runbook.md).

### Operating the devnet

The two boxes are managed from the connector repo checkouts on the boxes
themselves (`/root/connector`, branches `feat/devnet-multi-node` /
`feat/devnet-store-node`; compose files `infra/linode-node/docker-compose.node.yml`
and `infra/linode-store/docker-compose.store.yml`). `infra/devnet-manage.sh`
still automates provisioning but its chain-box legs are now historical.

> **Restart order matters:** connector 3.36.x downstream BTP clients give up
> permanently after 5 reconnect retries (~60 s). After any apex connector
> restart, `docker restart linode-store-connector-1` on the store box.

### Path A reference deployment — `deploy/pay-edge/` (separate box)

The Path A payment-proxy app deployment is a **separate box** from the chains box
above. Its reusable artifact is the connector repo's **`deploy/pay-edge/`** bundle:
`docker-compose.yml` + `docker-compose.caddy.yml` (Caddy auto-HTTPS publishing only
80/443; the connector port is unpublished via `ports: !reset []`) + `connector.yaml`
+ `.env.example` (primary knob `TOON_MNEMONIC`) + `prove-roundtrip.ts` + `README.md`.

On a box with wildcard DNS + ports 80/443: set a 3-line Caddyfile and `.env`, then
`docker compose -f docker-compose.yml -f docker-compose.caddy.yml up -d`; Caddy
issues a **trusted** cert in ~6s. This is **proven live** at
**`https://connector.pay.toonprotocol.dev/ilp`** — a generic, payment-oblivious
backend fronted by the connector proxy, verified by a real paid round-trip (paid
`POST /ilp` → FULFILL with injected `x-toon-*` headers; unpaid → 402; real on-chain
USDC settlement). The Path A **core is shipped on connector `main`**; the
`deploy/pay-edge/` bundle itself shipped via connector PR #252 (merged; supersedes
closed connector PR #246), and the devnet multi-chain roundtrip harness shipped via
connector PR #245 (merged). See
[deploy-app-guide.md → Path A](deploy-app-guide.md#path-a--payment-proxy-front-an-http-app).

## Town CLI

Run a relay with one command (no Docker required):

```bash
npx @toon-protocol/town --mnemonic "your twelve word mnemonic phrase here"
```

Town embeds its own ILP connector by default — no external connector needed. See the [Town Guide](town-guide.md) for full CLI reference and environment variables.

## Health Checks

```bash
curl http://localhost:19100/health   # Peer 1 BLS
curl http://localhost:19110/health   # Peer 2 BLS
curl http://localhost:18545           # Anvil (returns error object = healthy)
```

The relay ports (19700, 19710) are WebSocket-only — no HTTP health endpoint.

## View Logs

```bash
docker compose -p toon-sdk-e2e -f docker-compose-sdk-e2e.yml logs -f
```

## E2E Testing

```bash
# SDK E2E (requires SDK E2E infrastructure)
cd packages/sdk && pnpm test:e2e:docker

# Client E2E (requires SDK E2E infrastructure)
cd packages/client && pnpm test:e2e

# Town E2E (requires SDK E2E infrastructure)
cd packages/town && pnpm test:e2e
```

## Troubleshooting

**Infrastructure won't start:**

1. Check Docker is running: `docker ps`
2. Verify connector repo: `ls ../connector/packages/contracts`
3. Check logs: `docker compose -p toon-sdk-e2e -f docker-compose-sdk-e2e.yml logs`

**Tests failing:**

1. Verify infrastructure is up: `curl http://localhost:19100/health`
2. Check Anvil: `curl http://localhost:18545`
3. Restart: `./scripts/sdk-e2e-infra.sh down && ./scripts/sdk-e2e-infra.sh up`

**Port conflicts:**

Use `lsof -i :<port>` to find conflicting processes. See port tables above for expected assignments.
