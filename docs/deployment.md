# Deployment

## Building from source

TOON is a **polyrepo**. There is no `town` monorepo — `github.com/toon-protocol/town`
does not exist, and the archived original monorepo is not what any of this builds
from. Clone the one repo you need:

| What you want | Repo | Build |
|---|---|---|
| the connector (the payment engine) | `toon-protocol/connector` | Rust — `cargo build --release`; the container recipe is [`deploy/connector-rust/`](https://github.com/toon-protocol/connector/tree/main/deploy/connector-rust), the only bundle that repo still ships |
| a relay node (app + its own deploy bundle) | `toon-protocol/relay` | `pnpm install && pnpm build`; `deploy/` |
| an Arweave store node | `toon-protocol/store` | `pnpm install && pnpm build`; `deploy/` |
| a gas station (kind:5096 / kind:5098) | `toon-protocol/gas-station` | `pnpm install && pnpm build`; `deploy/` |
| `@toon-protocol/core` · `sdk` | `toon-protocol/toon` | `pnpm install && pnpm build` |
| the clients (`rig`, `client-mcp`) | `toon-protocol/toon-client` | `pnpm install && pnpm build` |

Every code repo pins its toolchain with Devbox — see
[`context/dev-environment.md`](../context/dev-environment.md). The connector's
own local chain profiles (`docker-compose.yml` + `local/`) are the supported way
to run a disposable EVM/Solana pair for tests; the old `scripts/sdk-e2e-infra.sh`
two-peer harness lived in the monorepo and went with it.

## Linode Devnet — LIVE (public-chain settlement)

**There is no apex.** The `toon` box (`104.237.150.177`) was **destroyed on
2026-08-14** (toon-meta#310/#313); the relay is the fleet's write ingress in its
place. What is left is **four boxes** — relay, store (`ario`), gas, and a
connector-less faucet. Settlement is on **two public networks**, Base Sepolia and
Solana devnet. Verified by live probe 2026-08-28. Mina is gone: the connector deleted `packages/mina-zkapp`, `tools/mina`,
`infra/mina`, the faucet's Mina leg and `docs/mina-deployment.md` under
[connector ADR 0065, *Mina leaves the repository*](https://github.com/toon-protocol/connector/blob/main/docs/adr/0065-mina-leaves-the-repository.md)
(built in connector#1205). Note the connector has **two** ADR 0065s; cite them by title.

> **Do not "clean up" the `mina` claim refusal.** The connector still refuses a
> claim whose `blockchain` is `mina`, **by name**, with
> [ADR 0002](https://github.com/toon-protocol/connector/blob/main/docs/adr/0002-drop-mina-from-the-rust-connector.md)'s
> reason in the error text. That is wire behaviour owed to `toon-client` — an older
> client gets the same answer it got yesterday — and ADR 0065 explicitly preserves
> it. It is not Mina support and it is not dead code.

The three self-hosted blockchain boxes (Anvil, solana-test-validator, Mina
lightnet) were **deleted on 2026-07-19** as part of the public-chain cutover, and
the sandbox entry box (`toon-relay-test`, `50.116.48.49`,
`*.sandbox.devnet.toonprotocol.dev`) was **decommissioned on 2026-07-31**. DNS is
Porkbun-managed; endpoints are under `*.devnet.toonprotocol.dev` with trusted
Let's Encrypt TLS.

### Node layout

A client pays the **relay** in Base or Solana USDC (pinned with `rig chain set`);
the relay is the write ingress, and the store terminates the Arweave route. The
apex hop that used to sit in front of them is gone — each box now answers for
itself.

| Node | Linode label | IP | Plan | ILP addresses (probed 2026-08-28) | Role |
|------|-------------|-----|------|-----------------------------------|------|
| Relay | `relay` | `97.107.134.182` | g6-nanode-1 (1 GB) | `g.toon.relay` | the fleet's write ingress |
| Store | `ario` | `45.79.173.113` | g6-nanode-1 (1 GB) | `g.toon.store`, `g.toon.relay.store` | kind:5094 blob storage, kind:5095 ArNS buy |
| Gas station | `gas` | `45.79.131.21` | g6-nanode-1 (1 GB) | `g.toon.gas`, `g.toon.relay.gas` | kind:5096 Solana fee-payer, kind:5098 EVM relayer |
| Faucet | `faucet` | `173.255.237.8` | g6-standard-2 (4 GB) | — (no connector) | 2-chain USDC faucet |

> **`ario` is a box label and a hostname, not an ILP address.** There is no
> `g.toon.ario` route. `GET https://proxy.ario.devnet.toonprotocol.dev/ilp`
> answers `g.toon.store` / `g.toon.relay.store`, each priced as a **schedule** —
> base 1000 plus 10 per **KiB** of payload
> ([connector ADR 0065, *a price is a schedule over payload length*](https://github.com/toon-protocol/connector/blob/main/docs/adr/0065-a-price-is-a-schedule-over-payload-length.md))
> — not the flat 1000 that `connector/docs/devnet-pricing.md` still records.
> That file is stale (connector#1250). For a per-box price or address, read the
> owning node repo's own `deploy/` bundle, which ADR 0068 made the authority, or
> probe `GET <node>/ilp`. The relay's own answer, probed 2026-08-28:
> `g.toon.relay` 1, `g.toon.relay.ephemeral` 0, `g.toon.relay.gas` 1001,
> `g.toon.relay.store` 1001 + 10/KiB.

Verified against the Linode API on 2026-08-27. Two corrections to what this
table said before: the apex (`toon`, `104.237.150.177`) was destroyed under
toon-meta#310/#313 and is not a box any more, and the surviving boxes were
resized to nanodes — this table had them on the 2GB plan. The faucet box is
oversized for what it now does: dropping Mina removed the o1js circuit compile
that forced the 4 GB plan (connector ADR 0065, *Mina leaves the repository*), so
it is a shrink waiting to happen.

The gas box is new (2026-08-27). It carries the two gas-station kinds that used
to run on `ario`: they were never storage, and a node that spends its own money
on a caller's transaction wants its own funding and its own blast radius. Its
whole deployment is [toon-protocol/gas-station](https://github.com/toon-protocol/gas-station)'s
own `deploy/` directory — there is no `infra/linode-gas/` in the connector
repo, because the app repo carries its own box now.

Settlement runs on `evm:84532` and `solana:devnet` only. The apex↔store
connector↔connector link (`solana:devnet`, shared channel `5z6znXjH…`) went with
the apex; each surviving box now settles with its own counterparties directly.

### Endpoints

`<box>` = `devnet.toonprotocol.dev`

| Service | Endpoint | Node | Notes |
|---------|----------|------|-------|
| Relay reads | `wss://relay-ws.<box>` | relay | Nostr WebSocket (payment-oblivious, free read) |
| Relay ILP edge | `https://proxy.relay.<box>/ilp` · `wss://proxy.relay.<box>/ilp/btp` | relay | the fleet's write entry now that the apex is gone |
| Faucet (+ frontend) | `https://faucet.<box>` | faucet | USDC faucet, **two-chain** web UI at `/` |
| Store ILP edge | `https://proxy.ario.<box>/ilp` | store | routes `g.toon.store`, `g.toon.relay.store` (the `proxy.store.<box>` alias still resolves) |
| Gas-station ILP edge | `https://proxy.gas.<box>/ilp` | gas | routes `g.toon.gas`, `g.toon.relay.gas` |

Dead endpoints, probed 2026-08-28: `proxy.<box>` **does not connect at all** (the
destroyed apex), and `dvm.<box>` resolves to the store box but returns **404**.
Also retired, DNS records pending removal: `relay-ws.sandbox.*`,
`proxy.sandbox.*` (the decommissioned sandbox entry box), `evm-rpc.*`,
`solana-rpc.*`, `solana-ws.*`, `mina.*`, `mina-accounts.*`. `store.<box>` was
never wired (parked at the registrar) — use `proxy.ario.<box>`.

Public chain RPCs (no self-hosted chain infra):

| Chain | Chain id (announced) | RPC |
|-------|----------------------|-----|
| EVM Base Sepolia | `evm:84532` | `https://sepolia.base.org` (channel-open flows prefer a single-backend RPC, e.g. `https://base-sepolia-rpc.publicnode.com` — the official LB serves stale reads that break open→deposit sequencing) |
| Solana devnet | `solana:devnet` | `https://api.devnet.solana.com` |

There is no third chain. `mina:devnet` is not announced, not settled and not
configurable (connector ADR 0065, *Mina leaves the repository*).

### Deployed settlement contracts (public networks, verified 2026-08-28)

**USDC is 6-decimal on both chains** (uniform claim base units — no cross-chain
normalization). Canonical source:
[`connector/infra/linode/endpoints.json`](https://github.com/toon-protocol/connector/blob/main/infra/linode/endpoints.json).

> **Authoritative runtime source:** `GET` a connector's own `/ilp` URL. It
> returns that node's **self-description** — the facts a stranger needs to
> transact with it, as one document, with no ILP packet and no encoder
> ([connector ADR 0050](https://github.com/toon-protocol/connector/blob/main/docs/adr/0050-a-connectors-url-resolves-to-its-self-description.md)).
> The kind:10032 announce that used to carry this was **removed**
> ([ADR 0046](https://github.com/toon-protocol/connector/blob/main/docs/adr/0046-the-kind-10032-announce-is-removed-a-connector-needs-no-relay.md)):
> a connector answers, it does not announce, and it must work with no relay in
> the world. The table below is a human-readable snapshot.

| Chain | What | Address |
|-------|------|---------|
| Base Sepolia (`evm:84532`) | **TokenNetworkRegistry** — this is what a connector is configured with | `0x0c41D9D424d6B075A3cEa1068a694f7847a8CCa5` |
| Base Sepolia | TokenNetwork (USDC) — **derived, not independent** | `0xe9E05dfecfe165266C88d73e61D483612651952a` |
| Base Sepolia | Mock USDC (ERC-20, 6dp, **ungated mint**) | `0x49beE1Bca5d15Fb0963117923403F9498119a9Ce` |
| Solana devnet | Payment-channel **program** | `2aEVJ8koKD8LTZrLRSGtAtU7LBt4e7QjjCgf1kzQ7Rip` |
| Solana devnet | Mock USDC SPL **mint** (6dp) | `34eSxY7qxQ4GzyhDJ8GpUcTz1WWzruGbJbR8q6TtxfQU` |

> **The TokenNetwork row is derived.** A connector is configured with the
> **registry** (`[settlement.evm] contract_address`) and resolves the
> TokenNetwork at boot via `getTokenNetwork(token)`. The two move together or
> this table is lying — and it has lied before: the 2026-08-06 ERC-2771 cutover
> repointed the registry and left the TokenNetwork on the retired contract for
> **three weeks**, and nothing noticed, because only a direct reader of that
> value was pointed at a dead contract. Re-derive rather than copy:
>
> ```bash
> cast call --rpc-url https://base-sepolia-rpc.publicnode.com \
>   0x0c41D9D424d6B075A3cEa1068a694f7847a8CCa5 \
>   "getTokenNetwork(address)(address)" \
>   0x49beE1Bca5d15Fb0963117923403F9498119a9Ce
> ```

**Retired — if you find one of these presented as live config, it is stale:**

| Address | Was |
|---------|-----|
| `0xcC9079adE929b168B54145f6d25262b64FAB9D5b` | registry, pre-2026-08-06 |
| `0x1E95493fEF46707E034b4a1945f25a8C76A1823D` | TokenNetwork, pre-2026-08-06 |
| `0x8263BdD4eB4862395Cb4ef5dA5d637F4b047Eea1` | registry, 2026-08-06 ERC-2771 cutover |
| `0xa79C3b1dbcEA00a6d84735a134395D8eF6D6a478` | TokenNetwork, 2026-08-06 ERC-2771 cutover |
| `xyc5J8MgKFiEN13PnfftdXxUzYH34FEvw1LCrFwN7in` | Solana mock USDC mint, retired 2026-08-27 — **its mint authority is lost**, so it can never be refilled |

Both EVM pairs were retired by the **ADR 0059 derived-channel-id cutover**,
broadcast 2026-08-28 at block 46055303
([connector `docs/evm-deployment.md`](https://github.com/toon-protocol/connector/blob/main/docs/evm-deployment.md),
[ADR 0059](https://github.com/toon-protocol/connector/blob/main/docs/adr/0059-a-channel-is-derived-from-its-participants.md)).
`TokenNetwork` is not upgradeable, so every change to it is a cutover of that
shape.

**2026-07-31 — apex settlement identity rotated.** The apex's EVM settlement
address changed from `0xC0E55cD2…` to `0xF29fD62C4848B9573C9b90adbF61b664F386d9CF`
(Solana and the Nostr identity rotated too). Eight Base Sepolia channels opened
against the old address remain open and inactive; no funds are at risk and each
counterparty can settle unilaterally. Channel ids and the exact `closeChannel` /
`settleChannel` steps: [operator notice](./operators/2026-07-31-apex-settlement-identity-rotation.md).
Those channels are on the **pre-2026-08-06** TokenNetwork above; the apex itself
has since been destroyed.

### Two standing hazards

**1. The Solana payment-channel program cannot be upgraded.** Its upgrade
authority is `AEPoA5xTTJY9SR8c5CfsemFGC5TmxQBe6Xf6wewEtnYa`, the 2026-07-18
deployer key, and that key is **lost** — in no repository, on no machine, in no
surviving scratchpad. Any change to `packages/solana-program/src` is therefore a
**fresh deploy at a new program id**, not an upgrade. That is a migration, not a
release:
[ADR 0053](https://github.com/toon-protocol/connector/blob/main/docs/adr/0053-a-solana-claim-binds-its-domain-the-way-an-evm-claim-does.md)
binds the settlement program into a claim's signed message, so a new program id
is a **new claim domain**, and every open channel on the old program has to be
drained or abandoned first. The same lost key was the retired mint's mint
authority — record:
[`packages/solana-program/deployments/devnet-public.md`](https://github.com/toon-protocol/connector/blob/main/packages/solana-program/deployments/devnet-public.md).

**2. Three boxes, no apex, and the boxes deploy themselves.** The apex was
destroyed 2026-08-14. Relay and store were re-deployed on **2026-08-27** from
their **own** repos' `deploy/` bundles — `docker compose` out of a checkout at
`/root/relay` or `/root/store`, not `/root/connector` — and the relay now runs
**Caddy**, not nginx. `connector/infra/linode-relay/` and
`connector/infra/linode-store/` are **test fixtures, not what the boxes run**;
each directory says so in its own `README.md`, and `devnet_configs_load.rs` still
boots them, which is why they were not deleted. Editing a file there changes
nothing on any box
([ADR 0068](https://github.com/toon-protocol/connector/blob/main/docs/adr/0068-a-node-repository-pins-the-connector-nothing-here-moves-a-tag-onto-a-box.md)).

### Faucet routes (`https://faucet.devnet.toonprotocol.dev`)

**USDC only, on two chains.** The native-token legs are gone: the SOL airdrop was
retired in connector#898 (get devnet SOL from <https://faucet.solana.com>), Base
Sepolia never dripped ETH, and both Mina legs were deleted with
[connector ADR 0065](https://github.com/toon-protocol/connector/blob/main/docs/adr/0065-mina-leaves-the-repository.md).
Retired routes answer `404`, not `503` — `packages/faucet/test/routes.test.js`
pins that.

| Method & path | Body | Drips |
|---------------|------|-------|
| `POST /api/base-sepolia/request` | `{address}` | 1000 USDC. The mock USDC `mint(address,uint256)` is **ungated** — anyone can coin fresh tokens to any address — so the faucet key only pays gas. **No ETH drip**; fund gas separately. Per-address 24h cooldown |
| `POST /api/solana/usdc-request` | `{address}` | USDC only, **no airdrop** — a transfer from the faucet box's own treasury, which is also the mint authority, so the leg cannot run dry. Works with a 0-SOL recipient |
| `GET /api/info` | — | machine-readable per-chain config (routes, `usdcMint`/`tokenAddress`, `ready`, drip amounts) — **query this to discover live addresses** |

Treasuries: Solana `Bg5YF6nCKe8aeJwoyovYpGr7Qj9ViGSXiH9JHE7tH98F` (mint authority
for `34eSxY7q…`, generated **on the faucet box** by
`infra/linode-faucet/generate-solana-treasury.sh`; the private half has never
left that box, and the recovery if the box is lost is to re-run the two scripts
and re-pin the new mint); Base Sepolia faucet key
`0x6bafedaF18FF62f0a63dd0148bafa163204627F6` (needs only gas ETH).
**Never send transactions from the faucet's hot keys manually while the service
is live — it desyncs the faucet's nonce manager.**

The faucet box deploys from `infra/linode-faucet/` in the **connector** repo,
built on-box; it is the one box ADR 0068 leaves under this repo's `fleet-ops.yml`
(`box-status` / `restart` / `deploy` only). It runs no connector.

### Pointing a client at the devnet (rig standalone)

With `rig >= 2.13.0` **no `config.json` is needed** for the normal path:

- relay + payment ingress come from core's committed genesis seed, or from a
  node's own self-description (`GET /ilp`) once discovered — the kind:10032
  announce that used to carry this is removed
  ([connector ADR 0046](https://github.com/toon-protocol/connector/blob/main/docs/adr/0046-the-kind-10032-announce-is-removed-a-connector-needs-no-relay.md),
  [ADR 0050](https://github.com/toon-protocol/connector/blob/main/docs/adr/0050-a-connectors-url-resolves-to-its-self-description.md));
- `rig fund` infers devnet (and the faucet URL) from the same seed on a fresh
  install;
- chain RPCs, tokens, TokenNetworks and the Solana channel params derive from
  that self-description plus core's presets.

Steering knobs (all free, local-config writes):

- `rig chain set <evm|sol>` — which chain's USDC settles paid writes (per-run
  override: `TOON_CLIENT_CHAIN=evm:84532|solana:devnet`). **`mina` is not a
  choice**: the fleet settles two chains, and a connector **refuses a claim
  whose `blockchain` is `mina` by name**
  ([connector ADR 0002](https://github.com/toon-protocol/connector/blob/main/docs/adr/0002-drop-mina-from-the-rust-connector.md),
  preserved deliberately by ADR 0065). rig still carries Mina zkApp plumbing;
  it has no counterparty.
- `rig entry <url>` — which entry node to pay through; auto-clears the topology
  cache. NOTE: a repo publishes to its git `origin` relay, which overrides
  config — after switching, `rig remote add origin <relay>` in the repo (or use
  a fresh repo). The built-in `sandbox` and `apex` aliases point at boxes that no
  longer exist.
- `rig channels` — the recorded payment channels (`rig balance` for wallets).

Manual overrides remain available for self-hosted networks — the pre-2.13 shape
(`btpUrl`/`relayUrl`/`faucetUrl`/`chainRpcUrls` in `~/.toon-client/config.json`)
still wins over every derived value. Do **not** set
`supportedChains`/`tokenNetworks`/`preferredTokens` explicitly — explicit
topology bypasses derived route prices and reintroduces F06 rejections. After
hand-editing config, delete `~/.toon-client/rig-topology-cache.json` (a cached
topology masks edits; `rig entry` does this for you).

The end-to-end demo flow (fund → push → site → ArNS name) is scripted in
[`scripts/demo-e2e.sh`](../scripts/demo-e2e.sh); the demo-day command sequence
lives in [`docs/demo-day-runbook.md`](demo-day-runbook.md).

### Operating the devnet — a node repository pins the connector

[Connector ADR 0068](https://github.com/toon-protocol/connector/blob/main/docs/adr/0068-a-node-repository-pins-the-connector-nothing-here-moves-a-tag-onto-a-box.md)
**inverted the old model.** The connector repo does not pin child-node images
and does not deploy. A **node repository pins the connector**, by release
handle, in exactly one guarded place in its own `deploy/` bundle:

| Repo | Pin of record |
|------|---------------|
| relay | `deploy/Dockerfile` → `ARG CONNECTOR_TAG` (its Watchtower recreates the container in ~60s) |
| store | `deploy/docker-compose.yml` → `image: …/connector:rust-sha-…` |
| gas-station | `deploy/docker-compose.yml` → `image: …/connector:rust-sha-…` |

Each pin is guarded by that repo's own bundle test. The connector repo **builds
and cuts a release** — one human `workflow_dispatch` of `release-connector.yml`,
producing a dated handle like `2026.08.21.1`, deliberately **never semver**
because no crate under `crates/` has a release process and the image will not
claim a stability contract it has not earned. Adopting a build is a node repo's
own reviewed change.

What went with the inversion:

- **`promote-to-fleet.yml` is deleted.** Nothing in the connector repo moves a
  tag onto a box.
- **`fleet-ops.yml` offers only the faucet box**, and `devnet-manage.sh`'s
  relay/store deploy legs are removed. They were `scp`-ing configs to
  `/root/connector/...` — a path neither box reads any more — then re-reading
  that same dead path to "confirm" the write. It passed every time. A false
  green is worse than a failure, and the fix was to remove the write path, not
  to repair it.
- **`:rust-release` is frozen** at `rust-sha-8708caf`, a build that **predates
  connector#1230**: on it a peering established by `POST /peers` can accept a
  claim but never sign one, so every packet forwarded over a runtime peering is
  refused `T00`. It serves, and quietly cannot pay. **Do not pin it.** It is not
  deleted only because GHCR has no untag operation — `rust-release` and
  `rust-sha-8708caf` are two tags on one package version, and deleting the
  version would take the immutable rollback target with it.
- **Drift is watched read-only.** `fleet-pin-drift.yml` holds no credential and
  reaches no box; it fails, and opens a `needs:human` issue, if any of the three
  repos pins `rust-release`, `rust-main` or `latest` instead of an immutable
  `rust-sha-` build, or if the three pins name different builds.

To change what a box runs, open a change in the repo that owns it.

## Town CLI

```bash
npx @toon-protocol/town --mnemonic "your twelve word mnemonic phrase here"
```

See the [Town Guide](town-guide.md). **Caveat:** Town embeds the **TypeScript**
connector, which
[connector ADR 0017](https://github.com/toon-protocol/connector/blob/main/docs/adr/0017-the-typescript-connector-is-a-prototype.md)
made a prototype and whose source and images are deleted. Treat this path as
unverified against the current fleet; the supported connector is the Rust one in
[`deploy/connector-rust/`](https://github.com/toon-protocol/connector/tree/main/deploy/connector-rust).

## Local development

The two-peer `scripts/sdk-e2e-infra.sh` harness, its `Peer 1`/`Peer 2` app
health endpoints and the `toon-sdk-e2e` compose project all belonged to the
monorepo and do not exist here. For a disposable local chain pair, use the
connector repo's own `docker-compose.yml` chain profiles and `local/` — that is
its `local` tier, funded from genesis, with no shared state.
