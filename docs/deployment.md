# Deployment

## Prerequisites

- Docker & Docker Compose
- Node.js >= 20
- pnpm 8.15.0 (`corepack enable && corepack prepare pnpm@8.15.0 --activate`)
- Connector contracts repo cloned at `../connector` (required for genesis deployment)

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

## Genesis Node

Deploy a complete genesis stack with Anvil, connector, relay, and faucet:

```bash
./deploy-genesis-node.sh
```

To reset and redeploy from scratch:

```bash
./deploy-genesis-node.sh --reset
```

**Services started:**

| Service | URL | Purpose |
|---------|-----|---------|
| BLS | http://localhost:3100 | ILP packet validation |
| Relay | ws://localhost:7100 | Nostr WebSocket |
| Connector | http://localhost:8080 | ILP routing |
| Anvil | http://localhost:8545 | Local EVM chain (chain ID 31337) |
| Faucet | http://localhost:3500 | Test token distribution |

## Peer Nodes

Deploy additional peers that auto-fund, configure, and bootstrap:

```bash
./deploy-peers.sh 3    # Deploy 3 peer nodes
```

Peer N gets ports offset by N*10:

| Peer | BLS | Relay | Connector |
|------|-----|-------|-----------|
| Peer 1 | 3110 | 7110 | 8090 |
| Peer 2 | 3120 | 7120 | 8100 |
| Peer 3 | 3130 | 7130 | 8110 |

## Town CLI

Run a relay with one command (no Docker required):

```bash
npx @toon-protocol/town --mnemonic "your twelve word mnemonic phrase here"
```

Town embeds its own ILP connector by default — no external connector needed. See the [Town Guide](town-guide.md) for full CLI reference and environment variables.

## Docker Standalone

Build and run as a standalone microservice:

```bash
docker build -f docker/Dockerfile -t toon .
docker run -p 3100:3100 -p 7100:7100 \
  -e TOON_MNEMONIC="your twelve word mnemonic phrase here" \
  -e TOON_KNOWN_PEERS='[{"pubkey":"ab12...","relayUrl":"ws://seed.example.com:7100","btpEndpoint":"ws://seed.example.com:3000"}]' \
  toon
```

## Health Checks

```bash
curl http://localhost:3100/health   # BLS
curl http://localhost:8545           # Anvil (returns error object = healthy)
curl http://localhost:3500/health   # Faucet
```

The relay (port 7100) is WebSocket-only — no HTTP health endpoint.

## View Logs

```bash
docker compose -p toon-genesis -f docker-compose-genesis.yml logs -f
docker compose -p toon-genesis -f docker-compose-genesis.yml logs -f toon  # Node only
```

## E2E Testing

```bash
# Client E2E (requires running genesis node)
cd packages/client && pnpm test:e2e

# Town E2E (requires genesis infrastructure)
cd packages/town && pnpm test:e2e
```

## Troubleshooting

**Genesis node won't start:**

1. Check Docker is running: `docker ps`
2. Verify connector repo: `ls ../connector/packages/contracts`
3. Check logs: `docker compose -p toon-genesis -f docker-compose-genesis.yml logs toon`

**Tests failing:**

1. Verify genesis is up: `curl http://localhost:3100/health`
2. Check Anvil: `curl http://localhost:8545`
3. Reset: `./deploy-genesis-node.sh --reset`

**Port conflicts:**

Use `lsof -i :<port>` to find conflicting processes. See port tables above for expected assignments.
