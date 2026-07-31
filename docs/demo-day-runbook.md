# Demo-day runbook — rig on the public-chain devnet

The exact command sequence for the live demo (2026-07-22): paid pushes
settling on **Base Sepolia** and **Solana devnet** through the two-box fleet
(client pays the `toon` apex → `toon` settles Solana with `ario`), then a
permaweb site + ArNS name.

> The sandbox entry box that carried the old Mina entry act was
> **decommissioned on 2026-07-31** — it is no longer needed, and the acts that
> ran against it have been removed from this runbook.

Everything below assumes `@toon-protocol/rig` **>= 2.13.0** — zero config:
no `~/.toon-client/config.json` is needed on the apex path. (Distinct from
the historical `docs/demo-runbook.md`, which drove the retired proxy stack.)

## Preflight — the night before

```sh
npm i -g @toon-protocol/rig @ar.io/sdk @ar.io/solana-contracts @solana/kit
rig --version                       # must be >= 2.13.0

export RIG_MNEMONIC="…"             # the demo identity

rig fund                            # USDC on all 3 chains, zero config
rig balance                         # confirm USDC landed
```

Gas is NOT dripped by `rig fund` — the wallet must already hold:

- a little **ETH on Base Sepolia** (any public Sepolia faucet),
- a little **SOL** (devnet airdrop, or `POST /api/solana/request` while the
  per-IP quota allows).

Stage the demo repo (any repo works; `scripts/demo-e2e.sh` scripts the
whole flow if you prefer one command per act):

```sh
mkdir /tmp/rig-demo && cd /tmp/rig-demo && git init -q
echo '# rig demo' > README.md && git add -A && git commit -qm 'feat: initial'
rig init
rig remote add origin wss://relay-ws.devnet.toonprotocol.dev
```

**Watch it (public dashboard).** Open `https://faucet.devnet.toonprotocol.dev/dash`
on the projector — the live packet-flow view across both connectors
(per-hop packet counts, kind-labelled Nostr packet stream, settlement). Packets
appear as you push. Full detail: [demo-dashboard.md](demo-dashboard.md).

## The three acts

**Act 1 — paid push settling on Base Sepolia (apex entry):**

```sh
rig chain set evm
rig push --yes                      # objects → Arweave, refs → relay
rig channels                        # the recorded channel + claimed amount
```

**Act 2 — same repo, settling on Solana:**

```sh
rig chain set sol
rig push --yes                      # (push something new, or reuse a commit)
```

Narrate the hop: the payment enters at the apex in the client's chosen USDC;
the apex settles Sol USDC with `ario` between themselves; and the store DVM
lands the objects on Arweave.

**Act 3 — permaweb site + ArNS name:**

```sh
rig chain set sol
rig site publish --yes              # ar.io path manifest, one paid write
rig site url
rig name buy <name-13-chars-plus> --network devnet --yes   # DVM is defaulted
rig name set  <name> <manifestTx>  --network devnet --yes
rig name status <name> --network devnet
# resolves at https://<name>.ar-io.dev/ (gateway TTL 3600s)
```

## Warts and one-line fixes

| Symptom | Fix |
|---------|-----|
| `rig push` fails F06 "Stale payment claim: nonce N does not advance" | Known cosmetic desync — just rerun `rig push --yes` (the watermark advances each retry; second pass completes). |
| Push resolves the wrong entry after switching | The repo's git `origin` relay OVERRIDES config: `rig remote add origin <relay>` in the repo, or use a fresh repo. |
| Config was HAND-edited and behavior didn't change | `rm ~/.toon-client/rig-topology-cache.json` (`rig entry`/`rig chain set` clear it for you). |
| Solana faucet airdrop quota exhausted | `curl -X POST https://faucet.devnet.toonprotocol.dev/api/solana/usdc-request -d '{"address":"…"}'` (USDC-only leg) and fund SOL separately. |
| Mina drip slow | Normal — the Mina faucet leg takes ~75-130 s; `rig fund mina` waits. |
| Anything touching the faucet's own wallets | **Never** send txs from the faucet hot keys while the service runs (nonce desync). |
| Tempted to demo Mina | Don't — the Mina entry leg was only ever exercised through the retired sandbox entry, and on-chain Mina SETTLE is vk-drift-blocked and executor-gated besides. Base Sepolia and Solana are the demo. |

Box restart order (if a connector restart is ever needed): after ANY `toon`
apex connector restart, restart the `ario` store connector too (3.36.x BTP
clients give up after 5 retries).
