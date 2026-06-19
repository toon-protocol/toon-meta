# E2E Demo Runbook — SocialFi + DeFi journey on 3 testnets

Runs a **hub (direct BTP)** against Base Sepolia / Solana devnet / Mina devnet,
exercises the full SocialFi + DeFi journey with a client-side agent, and captures
on-chain settlement receipts. Treasury wallet, small/bounded amounts.

**Phase 2 addendum** (§6) re-runs the same journey with the hub behind the anyone
proxy (`.anon`).

**Dependencies:** WS1 hub preset (`hub#15`) must be merged before the
`--preset demo` flag is available. WS5 journey orchestrator (`toon-client#19`)
must be merged before `run-journey` works. WS7 mcp-use harness (`toon-client#21`)
enables CI-driven runs. See [toon-meta#22](https://github.com/toon-protocol/toon-meta/issues/22).

---

## 1. Prerequisites

- Docker Desktop (or Docker Engine + Compose plugin) — hub containers
- Node.js ≥ 20 and pnpm
- Treasury wallet seeded and faucet-funded — see [`docs/treasury-funding.md`](./treasury-funding.md)
- Deployed testnet contracts in `e2e/testnets.json` — see [`docs/e2e-testnets.md`](./e2e-testnets.md)

Confirm the treasury addresses have been funded before starting:

```bash
source .env.demo.local
npx @toon-protocol/townhouse wallet show   # prints addresses
```

---

## 2. Stand up the hub (Phase 1 — direct BTP)

The demo preset wires the hub for testnet settlement against all three chains,
loads the treasury wallet, and enables relay + store + swap child nodes.

```bash
# 2a. Initialise (one-time per wallet; safe to re-run after `down --purge`)
TOWNHOUSE_MNEMONIC="$TOWNHOUSE_MNEMONIC" \
  npx @toon-protocol/townhouse init --preset demo --network testnet

# 2b. Boot the stack (pulls images, starts connector + relay + store + swap + API)
TOWNHOUSE_MNEMONIC="$TOWNHOUSE_MNEMONIC" \
  npx @toon-protocol/townhouse up
```

`up` exits once Docker containers are healthy (typically 2–3 minutes on first
pull). The Fastify API becomes reachable at `http://localhost:9400`.

Wait for the hub to report `phase: running`:

```bash
curl -s http://localhost:9400/health | jq .
# Expected:
# {
#   "phase": "running",
#   "peerCount": 1,
#   "discoveredPeerCount": 1,
#   "channelCount": 0
# }
```

Check child node status:

```bash
curl -s http://localhost:9400/api/nodes | jq '.[] | {type, status}'
# Expected: relay → running, store → running, swap → running
```

---

## 3. Start the client daemon

The client agent runs as a long-lived daemon (`toon-clientd`) with its own
identity and wallet. Start it in a separate terminal or as a background process:

```bash
# In a new terminal
TOON_MNEMONIC="$TOON_CLIENT_MNEMONIC" \
  npx @toon-protocol/client-mcp run &

# Confirm the daemon is up
npx @toon-protocol/client-mcp status
# Expected: { "phase": "running", "hubUrl": "http://localhost:9400", ... }
```

Register the client MCP server with Claude Code for interactive demo driving:

```bash
claude mcp add toon \
  -e TOON_MNEMONIC="$TOON_CLIENT_MNEMONIC" \
  -- npx @toon-protocol/client-mcp
```

Or add to `claude_desktop_config.json` for Claude Desktop:

```json
{
  "mcpServers": {
    "toon": {
      "command": "npx",
      "args": ["-y", "@toon-protocol/client-mcp"],
      "env": {
        "TOON_MNEMONIC": "<client mnemonic>",
        "TOON_HUB_URL": "http://localhost:9400"
      }
    }
  }
}
```

---

## 4. Run the SocialFi + DeFi journey

### Option A — journey orchestrator (WS5)

Once `toon-client#19` ships, the orchestrator runs the full journey end-to-end:

```bash
npx @toon-protocol/client-mcp run-journey \
  --hub http://localhost:9400 \
  --journey socialfi-defi \
  --network testnet
```

The orchestrator drives: channel open → profile create → note publish (relay) →
media upload (store/DVM) → swap (cross-chain) → settlement → read-back.

### Option B — step-by-step via MCP tools

Drive each step manually through the `toon` MCP server registered in §3.

**SocialFi steps:**

| Step | MCP tool | What it does |
|------|----------|-------------|
| Open payment channel | `toon_channel_open` | Deposits USDC into TokenNetwork on the negotiated chain |
| Create profile | `toon_profile_create` | Publishes a kind:0 Nostr profile (paid write) |
| Publish note | `toon_note_publish` | Publishes a kind:1 note; returns FULFILL + receipt |
| Upload media | `toon_store_upload` | Sends a kind:5094 DVM request to store a file on Arweave |
| Follow | `toon_follow` | Publishes a kind:3 contact list update |
| Read back | `toon_note_list` | Subscribes (free) and returns stored notes |

**DeFi steps:**

| Step | MCP tool | What it does |
|------|----------|-------------|
| Check balances | `toon_balance` | Shows on-chain + channel balances per chain |
| Swap | `toon_swap` | Pays asset A, receives signed claim redeemable for asset B |
| Settlement status | `toon_settlement_status` | Polls for on-chain settlement transaction |

---

## 5. Observe on-chain receipts

Each paid write returns a `FULFILL` response with receipt metadata. The hub
auto-settles on-chain once per-channel thresholds are crossed.

| Chain | What to observe | How |
|-------|----------------|-----|
| **Base Sepolia** | `claimFromChannel` call on TokenNetwork; channel `nonce` increments | [Blockscout](https://base-sepolia.blockscout.com) or `cast logs --address <tokenNetworkAddress> --rpc-url https://sepolia.base.org` |
| **Solana devnet** | `claim_from_channel` instruction on the channel PDA | [Solana Explorer (devnet)](https://explorer.solana.com/?cluster=devnet) — paste channel PDA address |
| **Mina devnet** | zkApp `nonceField` advances 0 → 1 on first settled publish | [Minascan devnet](https://minascan.io/devnet/home) — paste `zkAppAddress` from `e2e/testnets.json` |

Check settlement status via the hub API:

```bash
# List open channels + last-settled nonce
curl -s http://localhost:9400/api/channels | jq '.[] | {chain, nonce, settledAt}'
```

Check settlement status via the client MCP tool:

```
toon_settlement_status chain="evm:base:84532"
# → { "chain": "evm:base:84532", "nonce": 1, "txHash": "0x...", "settledAt": "..." }
```

Expected receipt sequence for a full SocialFi + DeFi run:

1. Client opens channel → on-chain `openChannel` tx (EVM/Solana/Mina)
2. Client publishes note → FULFILL with `eventId`
3. Client uploads media → FULFILL with Arweave `txId` (DVM kind:6094)
4. Client swaps → FULFILL with signed swap claim
5. Hub triggers settlement → `claimFromChannel` on-chain (nonce 0 → 1)

---

## 6. Teardown

```bash
# Stop hub containers (preserves wallet + data)
TOWNHOUSE_MNEMONIC="$TOWNHOUSE_MNEMONIC" \
  npx @toon-protocol/townhouse down

# Stop client daemon
pkill -f "client-mcp run" || true
```

For full wallet reset: `townhouse down --purge` (removes the data dir; next
`init` generates a fresh identity).

See [`docs/treasury-funding.md`](./treasury-funding.md) §Teardown for on-chain
channel cleanup and fund recovery.

---

## Phase 2 addendum — hub behind the anyone proxy

> **Requires:** hub#16 (ATOR transport + sidecar) and hub#17 (peer-exchange +
> ATOR timeout profile) merged into the hub repo. Until those ship, skip this
> section and use Phase 1 (direct BTP only).

The anyone proxy / ATOR network allows clients to reach the hub over a `.anon`
hidden-service address without knowing the hub's IP. Phase 2 exercises the same
SocialFi + DeFi journey with the hub behind this transport.

### Enable the anyone proxy (HS mode)

```bash
# Option A — re-initialise with HS preset (full teardown required)
TOWNHOUSE_MNEMONIC="$TOWNHOUSE_MNEMONIC" \
  npx @toon-protocol/townhouse down --purge

TOWNHOUSE_MNEMONIC="$TOWNHOUSE_MNEMONIC" \
  npx @toon-protocol/townhouse init --preset demo --network testnet \
    --transport hidden-service

TOWNHOUSE_MNEMONIC="$TOWNHOUSE_MNEMONIC" \
  npx @toon-protocol/townhouse hs up

# Option B — switch a running direct hub to HS (no teardown)
npx @toon-protocol/townhouse hs enable
```

`hs up` / `hs enable` starts the ATOR sidecar, generates a `.anon` hostname,
and re-announces the hub's kind:10032 peer-info with the new BTP endpoint.

### Retrieve the .anon hostname

```bash
curl -s http://localhost:9400/api/transport | jq '.anonHostname'
# → "abc123xyz.anon"
```

Or via the connector endpoint (hub#15 / `connector#151`):

```bash
curl -s http://localhost:9400/api/anon-hostname
```

### Connect the client via .anon

Update the client daemon to peer with the hub's `.anon` address:

```bash
TOON_MNEMONIC="$TOON_CLIENT_MNEMONIC" \
TOON_HUB_URL="btp+wss://abc123xyz.anon" \
  npx @toon-protocol/client-mcp run
```

The client discovers the `.anon` BTP endpoint from the hub's kind:10032
announcement — no manual URL override required if the client is already peered
with the hub's relay.

### Re-run the journey

Same steps as §4 (Option A or B). The FULFILL receipts are identical; the
transport layer is transparent to the client tools.

On-chain receipts (§5) remain the same — settlement lands on Base Sepolia /
Solana devnet / Mina devnet regardless of the BTP transport.

### Verify .anon transport is active

```bash
curl -s http://localhost:9400/api/transport | jq .
# Expected:
# {
#   "transport": "hidden-service",
#   "anonHostname": "abc123xyz.anon",
#   "status": "active"
# }
```

---

## Troubleshooting

**Hub won't start (`up` exits non-zero):**
```bash
docker compose -p townhouse logs --tail 50
```
Common causes: Docker daemon not running; port 9400 / 7100 / 3100 already in use;
missing `e2e/testnets.json` contract addresses.

**Client gets `REJECT` on every packet:**
- Confirm the hub is `phase: running` via `GET /health`.
- Confirm the client has an open, funded channel (`toon_channel_open` first).
- Check that the channel is on the same chain the hub advertised in its kind:10032.

**Settlement not appearing on-chain:**
- Settlement is threshold-gated (default: after N packets / Y USDC equivalent).
  Send a few more paid writes to cross the threshold.
- On Mina devnet: the zkApp must be deployed **bare** (see `docs/e2e-testnets.md`
  §Mina devnet). A deployer-initialized zkApp will reject every `claimFromChannel`.

**Solana devnet reset:**
- Devnet resets periodically. Re-run `scripts/deploy-e2e-testnet-solana.sh` to
  redeploy the program, then re-fund peer addresses with `scripts/fund-e2e-peers.mjs`.

**.anon hostname not showing (Phase 2):**
- ATOR sidecar takes 60–120 s to bootstrap. Retry `GET /api/transport` after 2 min.
- Confirm hub#16/hub#17 are merged and the image includes the ATOR sidecar.
