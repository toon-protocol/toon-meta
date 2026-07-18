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

## Linode Devnet — LIVE

A public, self-hosted multi-chain devnet hosted on **four dedicated Linode nodes** —
one per chain plus a TOON connector node. Used by the operator dashboard, demos,
and anyone building against TOON without standing up local infrastructure.
DNS is Porkbun-managed; all endpoints are under `*.devnet.toonprotocol.dev` with
trusted Let's Encrypt TLS.

### Node layout

| Node | Linode label | IP | Plan |
|------|-------------|-----|------|
| EVM (Anvil) | `toon-devnet-evm` | `104.237.150.131` | g6-standard-1 (2 GB) |
| Solana | `toon-devnet-sol` | `104.237.150.132` | g6-standard-2 (4 GB) |
| Mina lightnet | `toon-devnet-mina` | `172.104.27.242` | g6-standard-4 (8 GB) |
| TOON connector | `toon` | `104.237.150.177` | g6-standard-1 (2 GB) |

### Endpoints

`<box>` = `devnet.toonprotocol.dev`

| Service | Endpoint | Node | Notes |
|---------|----------|------|-------|
| EVM RPC | `https://evm-rpc.<box>` | toon-devnet-evm | Anvil chain-id **31337** |
| Solana RPC | `https://solana-rpc.<box>` | toon-devnet-sol | `solana-test-validator` |
| Solana WS | `wss://solana-ws.<box>` | toon-devnet-sol | WebSocket subscription endpoint |
| Mina GraphQL | `https://mina.<box>/graphql` | toon-devnet-mina | Mina lightnet (`PROOF_LEVEL=none`) |
| Mina accounts | `https://mina-accounts.<box>` | toon-devnet-mina | Lightnet accounts manager |
| Relay | `wss://relay-ws.<box>` | toon | Nostr WebSocket (oblivious relay, free read) |
| Payment proxy | `https://proxy.<box>` | toon | ILP-over-HTTP ingress (`g.proxy.relay`) |
| Faucet | `https://faucet.<box>` | toon | Multi-chain faucet — see routes below |

> **TLS:** all endpoints serve **trusted Let's Encrypt certs** (one cert per node).
> No `NODE_TLS_REJECT_UNAUTHORIZED=0` needed.

### Deployed settlement contracts

The payment-channel programs/contracts and the USDC token on each chain.
**USDC is 6-decimal on every chain** (uniform claim base units). Verified by a
full paid round-trip per chain (channel open + deposit → per-packet claim →
`POST /ilp` FULFILL → relay read-back → on-chain redemption).

> **Authoritative runtime source (connector ≥ 3.33.0, deployed 2026-07-16):**
> the apex's kind:10032 announce on `wss://relay-ws.devnet.toonprotocol.dev`
> now carries per-chain `tokenNetworks` (TokenNetwork contract on EVM,
> payment-channel program on Solana, PaymentChannel zkApp on Mina) and
> `preferredTokens` (ERC-20 / SPL mint / token-owner zkApp) — clients should
> derive settlement parameters from the announce (connector#331,
> toon-client#378). This table is a human-readable snapshot.

| Chain | What | Address |
|-------|------|---------|
| EVM (anvil 31337) | TokenNetworkRegistry | `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512` |
| EVM (anvil 31337) | TokenNetwork (runtime-resolved) | `0xCafac3dD18aC6c6e92c921884f9E4176737C052c` |
| EVM (anvil 31337) | Mock USDC (ERC-20, 6dp) | `0x5FbDB2315678afecb367f032d93F642f64180aa3` |
| Solana (devnet) | Payment-channel **program** | `D2Z35z8ShA4K7odczUysBYRP5hXQGDp6r5c2EBSxRsHh` |
| Solana (devnet) | Mock USDC SPL **mint** (6dp) | `H8HSreUF2s8r8hem4qMttE3bWYCpFuh71jbuos5bA77H` |
| Mina (box lightnet) | **PaymentChannel** zkApp | `B62qoMNmZQQYSxuoNx42JnZtNZwHfwL16wxUYNEuLGyrVq1bXfS15Rn` |
| Mina (box lightnet) | USDC **FungibleToken** zkApp (6dp) | `B62qjfa5osSnjaAhgiJTu5WRg7RCw66mY6bhaxZecyMTTtESKBwQ4x3` |
| Mina (box lightnet) | USDC **tokenId** | `26807032406297178681731937210594998657168795100878204131916024453275711913842` |
| Mina (public devnet) | USDC **FungibleToken** zkApp (6dp, 2026-07-17) | `B62qmM6queHpUAWW1G6Hkb5MCEk1xKZ2wmydVdke4LvtZ8mL3AYkRKw` |
| Mina (public devnet) | USDC **FungibleTokenAdmin** contract | `B62qkHwT6qbkqyyrxVs8cPBmmVJTVX5es63DKZK9vewNWRD2Vs5jE2k` |
| Mina (public devnet) | USDC **tokenId** | `11023656268526876025673184191684945855837551514830012586280356683923962762116` |

> **Public Mina devnet USDC (2026-07-17 redeploy):** deployed with the
> connector#352 single-o1js-instance tooling (deploy tx
> `5JuNDoaPZEg1WCybyD9sAG8Kc4sSKRbwBxYTu3DTse6fytt4GTx6`;
> `UsdcChannelToken` vk hash
> `9692307225143487166733467413506207145324336685411164992097971188215422741850`,
> `FungibleTokenAdmin` vk hash
> `18691595165066726042633902806776623651617801388146374388725017604854573364243`).
> The **mint authority is a session throwaway key** — treat this instance as
> an e2e deployment; a durable shared devnet token needs one redeploy with an
> operator-held admin key. The older public-devnet zkApps
> (`B62qqwnm9NZs…` / tokenId `13770394…0748`) remain live for the roundtrip
> harness. **PaymentChannel on the public devnet has no canonical address** —
> the zkApp address *is* the channel id, deployed per channel (e.g. the
> 2026-07-17 e2e instances: native-MINA channel
> `B62qprWmyvrhCcEjDTCasRfyYX7dQtNicnE9MXJdrFzcyEhxYHhCxCd`, plus a
> USDC-denominated channel paid through with `assertClaimTokenId` active).

> The live apex settles Mina on the **box lightnet**
> (`https://mina.devnet.toonprotocol.dev/graphql`, PaymentChannel deployed
> 2026-06-23); the older public-devnet zkApps
> (`B62qigQwEwBAs…` / `B62qqwnm9NZs…` / tokenId `13770394…0748`) remain live on
> the public Mina devnet for the roundtrip harness. The `PaymentChannel` zkApp
> supports both native MINA (`tokenId = Field(1)`) and the USDC fungible token.
> Public-devnet writes must go to
> `https://api.minascan.io/node/devnet/v1/graphql` directly — the `mina.*` proxy
> 504s on `send()` (it's fine for reads).
>
> **Caveats:** the Solana program id is **non-deterministic** (regenerated each
> `cargo build-sbf` — not a committed keypair) and the validator ledger is
> ephemeral (`--reset`), so a fresh devnet provision needs a re-deploy — since
> connector 3.33.0 the announce picks the new id up automatically from the
> box's `connector.yaml`. The mock-USDC SPL mint and EVM addresses are
> deterministic.

### Faucet routes

| Method & path | Body | Drips |
|---------------|------|-------|
| `POST /api/request` | `{address}` | 100 ETH + 10k USDC (EVM) |
| `POST /api/solana/request` | `{address}` | SOL + USDC (Solana) |
| `POST /api/mina/request` | `{address}` | native MINA only (treasury-funded). USDC-on-Mina **is** now deployed (see contracts above) but the faucet does **not** drip it — transfer USDC from the treasury for channel deposits. |

The Mina faucet treasury (top up when low) is
`B62qqEMaUpm1aZ5M2weUoGXQRGbF3j6VjEtaEdzfM1NAWmeHnywiC2P`.

### Pointing a node/SDK at the devnet

```jsonc
{
  "chainRpcUrls": {
    "evm:31337":     "https://evm-rpc.devnet.toonprotocol.dev",
    "solana:devnet": "https://solana-rpc.devnet.toonprotocol.dev",
    "mina:devnet":   "https://mina.devnet.toonprotocol.dev/graphql"
  },
  "relayUrl":  "wss://relay-ws.devnet.toonprotocol.dev",
  "proxyUrl":  "https://proxy.devnet.toonprotocol.dev",
  "faucetUrl": "https://faucet.devnet.toonprotocol.dev"
}
```

### Operating the devnet

The devnet is managed by `infra/devnet-manage.sh` in the connector repo
(`feat/devnet-multi-node` branch). Use the `/deploy-devnet` Claude Code skill
(`.claude/commands/deploy-devnet.md`) or run the script directly:

```bash
bash ../connector/infra/devnet-manage.sh status    # probe all endpoints
bash ../connector/infra/devnet-manage.sh redeploy  # pull latest + restart
bash ../connector/infra/devnet-manage.sh down      # stop (boxes keep running)
bash ../connector/infra/devnet-manage.sh destroy   # delete all Linode boxes
```

Each chain box runs `connector/infra/linode/` with a per-chain nginx template
(`evm.conf.template`, `sol.conf.template`, `mina.conf.template`).
The TOON node runs `connector/infra/linode-node/` (connector + relay + faucet + nginx).

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
