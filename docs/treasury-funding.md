# Treasury Wallet & Demo Funding

The demo runs with **real value on public testnets/devnets** — but always small,
bounded amounts using a **testnet-only** treasury. This doc covers key management,
per-chain faucet sources, spend caps, and teardown.

---

## Key management

One **BIP-39 mnemonic → all chains.** A single dedicated, testnet-only seed
derives keys for EVM (Base Sepolia), Solana (devnet), and Mina (devnet).

### Environment variables

| Variable | Purpose |
|----------|---------|
| `TOWNHOUSE_MNEMONIC` | 12- or 24-word BIP-39 seed for the hub operator wallet. Passed to `townhouse init / up` and the Fastify API container. **Never commit this.** |
| `TOON_SETTLEMENT_PRIVATE_KEY` | **Auto-derived from `TOWNHOUSE_MNEMONIC`; do not set.** Raw hex EVM private key for the hub's on-chain settlement signer (account index 0). The hub derives and injects this automatically when `TOWNHOUSE_MNEMONIC` is set; overriding it manually will conflict with the mnemonic-derived key. |
| `TOON_CLIENT_MNEMONIC` | Separate 12- or 24-word seed for the client-side demo agent (`toon-clientd`). Must be distinct from the hub seed. |

> **Rule:** never reuse a seed that has held mainnet funds. Testnet-only.
> **Rule:** never commit `.env.demo.local` or print private keys. Derive addresses
> only via `townhouse wallet show` or `scripts/e2e-wallet.mjs addresses`.

### Generate fresh seeds

```bash
# Hub treasury seed
node scripts/e2e-wallet.mjs generate   # prints mnemonic (SECRET)
# → paste into TOWNHOUSE_MNEMONIC in .env.demo.local

# Also print addresses to fund:
node scripts/e2e-wallet.mjs addresses

# Client seed (separate run — must be distinct from the hub seed)
node scripts/e2e-wallet.mjs generate   # prints mnemonic (SECRET)
# → paste into TOON_CLIENT_MNEMONIC in .env.demo.local
```

### Local secrets file

Create `.env.demo.local` (gitignored in the hub repo) with your seeds:

```bash
touch .env.demo.local   # add to .gitignore if not already there
```

`.env.demo.local` shape (hub repo root):

```bash
# Hub treasury — operator wallet + settlement key
TOWNHOUSE_MNEMONIC="word1 word2 … word12"

# Client demo agent
TOON_CLIENT_MNEMONIC="word1 word2 … word12"
```

`TOON_SETTLEMENT_PRIVATE_KEY` is derived automatically from `TOWNHOUSE_MNEMONIC`
by `townhouse up`; you do not need to set it manually unless you are passing a
raw key to the connector directly.

---

## Faucet sources & bounded amounts

Fund the **hub treasury** addresses (printed by `townhouse wallet show`) before
running the demo. Each chain has a hard spend cap for a single demo run.

| Chain | Network | Faucet | Gas floor | Token cap |
|-------|---------|--------|-----------|-----------|
| EVM | Base Sepolia (`eip155:84532`) | https://www.alchemy.com/faucets/base-sepolia (also Coinbase, thirdweb, bwarelabs) | 0.01 ETH | 10 Mock USDC |
| Solana | Devnet (`solana:devnet`) | `solana airdrop 1 <address>` or https://faucet.solana.com | 0.05 SOL | 10 Mock USDC SPL |
| Mina | Devnet (`mina:devnet`) | https://faucet.minaprotocol.com | 10 MINA (includes 1 MINA account-creation fee) | — (native only) |

Faucet tips:

- **Base Sepolia:** Alchemy faucet requires a free account and caps at 0.1 ETH/day.
  The hub typically needs ≤ 0.01 ETH per demo run for gas.
- **Solana:** `solana airdrop` works on devnet up to 2 SOL per call. For the
  demo, 0.1 SOL comfortably covers settlement + SPL account creation fees.
- **Mina:** Devnet resets periodically. After a reset, request fresh faucet funds.
  Deployments (zkApp) also need re-running; see `docs/e2e-testnets.md`.

Print the hub treasury addresses to fund:

```bash
source .env.demo.local
npx @toon-protocol/townhouse wallet show
# prints: Nostr pubkey, EVM address, Solana address, Mina address
```

---

## Fund the client

The client agent opens payment channels from its own wallet to the hub. Fund the
**client** addresses separately (same faucets, smaller amounts — the client only
needs gas to open a channel; the hub treasury covers the settlement side):

```bash
# After toon-clientd starts, print client addresses:
npx @toon-protocol/client-mcp wallet show
```

| Chain | Client needs |
|-------|-------------|
| EVM | 0.005 ETH (gas to open channel) + 5 Mock USDC (deposit) |
| Solana | 0.02 SOL (fees + ATA creation) + 5 Mock USDC SPL |
| Mina | 5 MINA (channel deposit + account fee) |

---

## Contract addresses (testnets)

Contract addresses for all three testnets are pinned in `e2e/testnets.json` in
the `toon` monorepo (or the `hub` repo's `deploy/` directory). The demo preset
(`townhouse init --preset demo`) reads them automatically. See
`docs/e2e-testnets.md` for the one-time deployment procedures.

---

## Rotate the treasury

If a seed leaks (low stakes on testnets, but best practice):

1. Generate a new mnemonic (`node scripts/e2e-wallet.mjs generate`).
2. Fund the new addresses from the faucets.
3. Update `TOWNHOUSE_MNEMONIC` and `TOON_CLIENT_MNEMONIC` in `.env.demo.local`
   and in any CI secrets.
4. Run `townhouse down && townhouse init --preset demo` to re-initialise with the
   new wallet.

---

## Teardown & cleanup

The demo runs against testnet infra — nothing permanent to clean up beyond
stopping the Docker stack.

```bash
# Stop hub containers (preserves wallet config + data dir)
npx @toon-protocol/townhouse down

# Full reset (removes wallet config + data dir — generates new identity on next init)
npx @toon-protocol/townhouse down --purge
```

On-chain channels remain open until the settlement timeout expires or a party
submits `closeChannel`. For testnets, this is safe to leave — the testnet is
periodically reset anyway. On Mina devnet, the zkApp is re-deployed on each
devnet reset.

Recover remaining channel balance:

```bash
# Trigger on-chain settlement before teardown (optional, testnet only)
npx @toon-protocol/townhouse wallet withdraw \
  --chain evm:base:84532 \
  --to <your-treasury-address>
```

CI/nightly: the `townhouse down` step in the GH Actions workflow removes
containers; the faucet-funded testnet wallet persists across runs.
