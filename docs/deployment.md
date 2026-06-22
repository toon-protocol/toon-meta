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

A public, self-hosted multi-chain devnet hosted on a Linode box we control. It is
**live now** at `devnet.toonprotocol.dev` — used by the operator dashboard, demos,
and anyone who wants to test against TOON without standing up local infrastructure.
Peers point a TOON node/SDK at these stable TLS endpoints. **Replaces the former
Akash devnet.**

- Host: Linode `toon-devnet` (2GB), IP `69.164.211.211`, domain
  `devnet.toonprotocol.dev` (Porkbun `*.devnet` A-record → the IP).
  No-domain fallback: `*.69-164-211-211.sslip.io`.
- Provisioned/redeployed by the connector `devnet-deploy` GitHub Actions workflow
  (linode-cli, `LINODE_CLI_TOKEN`).

> **TLS note:** certs are currently **self-signed** (Let's Encrypt duplicate-cert
> rate-limit from repeated redeploys; a cert-persistence fix is in progress). The
> endpoints work — clients may need to accept the cert until it re-issues trusted.

### Endpoints

| Service | Public endpoint | Notes |
|---------|-----------------|-------|
| EVM RPC | `https://evm-rpc.devnet.toonprotocol.dev` | anvil, chain-id **31337**, Mock USDC `0x5FbDB2315678afecb367f032d93F642f64180aa3` (**6 decimals**) + `TokenNetworkRegistry`, auto-deployed |
| Solana RPC | `https://solana-rpc.devnet.toonprotocol.dev` (+ WS `wss://solana-ws.devnet.toonprotocol.dev`) | `solana-test-validator`, mock USDC SPL mint `H8HSreUF2s8r8hem4qMttE3bWYCpFuh71jbuos5bA77H` (**6 decimals**) |
| Mina | `https://mina.devnet.toonprotocol.dev/graphql` | **proxy to the public Mina devnet** — no node hosted |
| Faucet | `https://faucet.devnet.toonprotocol.dev` | multi-chain faucet — see routes below |

### Faucet routes

| Method & path | Body | Drips |
|---------------|------|-------|
| `POST /api/request` | `{address}` | 100 ETH + 10k USDC (EVM) |
| `POST /api/solana/request` | `{address}` | SOL + USDC (Solana) |
| `POST /api/mina/request` | `{address}` | native MINA (treasury-funded; **USDC-on-Mina deferred — not live**) |

The Mina faucet treasury (top up when low) is
`B62qqEMaUpm1aZ5M2weUoGXQRGbF3j6VjEtaEdzfM1NAWmeHnywiC2P`.

### Pointing a node/SDK at the devnet

Configure the `chainRpcUrls` map so the node/SDK talks to the live endpoints:

```jsonc
{
  "chainRpcUrls": {
    "evm:anvil:31337": "https://evm-rpc.devnet.toonprotocol.dev",
    "solana:devnet":   "https://solana-rpc.devnet.toonprotocol.dev",
    "mina:devnet":     "https://mina.devnet.toonprotocol.dev/graphql"
  }
}
```

### Operating it

The deployment is a thin overlay (`connector/infra/linode/`) on connector's
existing `docker-compose.yml` — it runs the `evm` + `solana` profiles and puts
nginx + Let's Encrypt in front. For run order, reset semantics, security
(Docker-bypasses-ufw firewalling), and known gaps, see
[`connector/infra/linode/README.md`](https://github.com/toon-protocol/connector/tree/main/infra/linode).

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
