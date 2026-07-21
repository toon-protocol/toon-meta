# Demo-day runbook — rig on the public-chain devnet, all three tokens

The exact command sequence for the live demo (2026-07-22): paid pushes
settling on **Base Sepolia**, **Solana devnet**, and the **Mina multihop**
(client pays Mina at the sandbox entry → sandbox settles Base with `toon` →
`toon` settles Solana with `ario`), then a permaweb site + ArNS name.

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
  per-IP quota allows),
- **≥ ~1.5 MINA** (https://faucet.minaprotocol.com, network *Devnet*) — the
  one-time zkApp auto-deploy costs ~1.1 MINA + fees.

**Pre-open the Mina channel now — never live.** The first Mina open compiles
the PaymentChannel circuit (≈1-3 min) and waits for two block inclusions
(≈3-6 min each: zkApp deploy, then initialize). Do it tonight:

```sh
rig entry sandbox                   # the Mina-only multihop entry
rig chain set mina
rig channel deploy-zkapp --yes      # ~1.1 MINA; key → keys/rig-mina-zkapps.json
rig channel open --yes              # initializes the channel on the zkApp
rig entry apex                      # back to the default for Act 1
```

Also stage the demo repo (any repo works; `scripts/demo-e2e.sh` scripts the
whole flow if you prefer one command per act):

```sh
mkdir /tmp/rig-demo && cd /tmp/rig-demo && git init -q
echo '# rig demo' > README.md && git add -A && git commit -qm 'feat: initial'
rig init
rig remote add origin wss://relay-ws.devnet.toonprotocol.dev
```

## The four acts

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

**Act 3 — the cross-currency multihop (pays Mina at the sandbox):**

```sh
rig entry sandbox                   # baked endpoints; clears topology cache
rig chain set mina
cd /tmp/rig-mina-demo               # a repo whose origin is the SANDBOX relay:
                                    #   rig remote add origin wss://relay-ws.sandbox.devnet.toonprotocol.dev
rig push --yes                      # Mina → sandbox → Base → toon → Sol → ario
```

Narrate the hop: one payment enters in Mina USDC; the connectors settle
Base USDC then Sol USDC between themselves; the store DVM lands the objects
on Arweave.

**Act 4 — permaweb site + ArNS name (back on the apex is fine):**

```sh
rig entry apex && rig chain set sol
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
| Push resolves the wrong entry after switching | The repo's git `origin` relay OVERRIDES config: `rig remote add origin <relay>` in the repo, or use the per-entry repos staged above. |
| Config was HAND-edited and behavior didn't change | `rm ~/.toon-client/rig-topology-cache.json` (`rig entry`/`rig chain set` clear it for you). |
| Solana faucet airdrop quota exhausted | `curl -X POST https://faucet.devnet.toonprotocol.dev/api/solana/usdc-request -d '{"address":"…"}'` (USDC-only leg) and fund SOL separately. |
| Mina drip slow | Normal — the Mina faucet leg takes ~75-130 s; `rig fund mina` waits. |
| Anything touching the faucet's own wallets | **Never** send txs from the faucet hot keys while the service runs (nonce desync). |
| On-chain Mina SETTLE | Do not demo it — connector-side settle against client-deployed zkApps is vk-drift-blocked and executor-gated anyway. Channel open + claims + multihop are the demo. |

Box restart order (if a connector restart is ever needed): after ANY `toon`
apex connector restart, restart the `ario` store connector too (3.36.x BTP
clients give up after 5 retries), then the sandbox connector.
