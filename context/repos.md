# Repo Map & Ownership

TOON is a **polyrepo** under the `toon-protocol` GitHub org. Libraries are shared via **npm** (semver); deployments are composed in each node repo's own `deploy/`, which **pins the connector image** it runs (connector ADR 0068).

| Repo | Packages / contents | Publishes | Owner |
|------|---------------------|-----------|-------|
| **connector** | the ILP payment engine (Rust) + on-chain contracts/programs, the ADR folder and `CONTEXT.md` that own protocol law, and `vectors/wire-vectors.json` | **image only** — `ghcr.io/toon-protocol/connector:rust-main` + dated release handles. **No npm package.** | Payments |
| **toon** | `@toon-protocol/core`, `@toon-protocol/sdk` | npm libs (no image/CLI) | Platform |
| **relay** | `@toon-protocol/relay` — the Nostr relay app | npm + `relay` image (+ a `relay-connector` image it builds) | Relay |
| **store** | Arweave app (`Dockerfile.store` + entrypoint); kind:5094 blob storage, kind:5095 ArNS buy | `store` image | Store |
| **gas-station** | `@toon-protocol/gas-station` — kind:5096 Solana fee-payer co-sign, kind:5098 EVM ERC-2771 relayer; extracted from `store` 2026-08-27 (store#105) | `gas-station` image | Store |
| **swap** | `@toon-protocol/swap` | npm + `swap` image | Swap |
| **toon-client** | the two official client implementations over `@toon-protocol/client`: `@toon-protocol/client-mcp` (`toon-clientd` + the `toon_*`/`toon_git_*` MCP tools) and `@toon-protocol/rig` (the `rig` CLI); plus `@toon-protocol/rig-web`, `@toon-protocol/views`, `@toon-protocol/arweave` | npm + plugin | Client |
| **rig** | the standalone Rig repo (history-preserved extraction; the canonical `rig` npm publisher) | npm | Client |
| **toon-meta** | this repo — shared skills, `context/`, `FACTORY.md`, org docs | the `toon-skills` plugin | Cross-cutting |
| **buzz** · **fractal** · **Forge** | product / factory repos, registered in `FACTORY.md` | per repo | per repo |
| **capability-market** | `CapabilityMarket.sol` parimutuel escrow (Foundry, Base) + RISC Zero sealed-predicate toolchain — [toon-meta#84](https://github.com/toon-protocol/toon-meta/issues/84). **Archived.** | on-chain deployments only | — |
| **swarm** | `@toon-protocol/swarm` — capability-market miner | npm CLI (`swarm` bin) | — |

## Dependency direction

```
connector (image)  ◄── pinned by ──  relay · store · gas-station   (ADR 0068: the NODE repo pins,
                                       each in its own deploy/,      never the other way round)

toon (core, sdk) ──npm──► relay · store · gas-station · swap · toon-client
connector/vectors/wire-vectors.json ──replayed by──► toon-client · rig · swap
```

Strictly downward, and the connector depends on **none** of them. It does not consume the TypeScript libraries, does not deploy the fleet, and holds no credential into another repo's deploy state.

## Coupling rules

- **A node repository pins the connector**, by release handle, in exactly one guarded place in its own `deploy/`: relay's `deploy/Dockerfile` (`CONNECTOR_TAG`), store's and gas-station's `deploy/docker-compose.yml`. Because a binary and a box's mounted TOML are a matched pair, **adding a required config key is a breaking deploy** — land the config, then bump the pin.
- **The connector configures from one typed TOML file**; there is no environment-variable layer, and `RUST_LOG` is the only env var read (ADR 0009). `PROXY_*` does not exist.
- **npm semver** replaces in-tree `workspace:*` for the library layer. Publish with **`pnpm publish`** — never `npm publish` (it shipped the broken `sdk@0.5.0`/`town@0.4.0`).
- **Every app is payment-oblivious.** It gets ordinary HTTP plus `X-TOON-Payer`/`X-TOON-Amount`/`X-TOON-Chain` when the delivering connector took the payment (ADR 0040). No app verifies a claim.
- **Agent context** is shared via this repo: each code repo's `CLAUDE.md` links here; the `toon-skills` plugin distributes the shared skills.

## Dev environment

All code repos pin their toolchain with Devbox per the [dev-environment.md](./dev-environment.md) standard (base = Node 22 + `pnpm_8`@8.15.9, `disable_plugin` on nodejs; chain tooling opt-in). **Adoption complete** — every code repo has `devbox.json` + a non-gating `devbox-validate` job on `main`:

| Repo | Devbox toolchain |
|------|------------------|
| **connector** | ✅ reference impl — Node + Rust + Foundry + Solana |
| swap | ✅ base + Foundry (`anvil` for integration tests) |
| toon · relay · store · gas-station · toon-client | ✅ base-only (pure TS) |
| toon-meta | n/a (no build step) |

Rolled out via the `#1` ticket in each repo (epic [toon-meta#11](https://github.com/toon-protocol/toon-meta/issues/11)). The canary surfaced two devbox 0.17.3 gotchas now baked into the standard: the nodejs corepack plugin crashes on `"type": "module"` repos (→ `disable_plugin`), and `--frozen-lockfile` trips pre-existing lockfile drift (→ `--no-frozen-lockfile`, matching each repo's own CI).

## Archived / not migrated

The pet-game packages (`pet-dvm`, `pet-circuit`, the game `mina-zkapp`, `memvid-node`) and `examples` stay in the archived original monorepo. **`@toon-protocol/mina-zkapp` is gone** — Mina left the connector repository (ADR 0065-mina); the zkApp deployed on Mina devnet is unaffected, but nothing here builds or publishes it. `@toon-protocol/shared` is likewise gone (`packages/shared` in the connector tree is untracked build output), and there is no `@toon-protocol/connector`.

## Package names (final)

`@toon-protocol/swap` is the live swap package; `@toon-protocol/mill` is fully gone (404). The former operator product (`@toon-protocol/hub`/`hub-web`/`hub-mcp`) is removed — the paid-proxy role lives in the connector itself (completed 2026-06-22, issue #44). On the wire the fleet's nodes claim `g.toon.relay`, `g.toon.store` and `g.toon.gas`; that is a **naming convention, not law** — an ILP address is self-asserted, nothing allocates one, and **nothing answers at `g.toon`**. There is no apex and no `PROXY_*` env prefix. The `town`/`mill`/`dvm` node-**type** terms are a separate axis; `dvm` has been dropped in favour of `store`.

## Outstanding follow-ups

`connector/docs/devnet-pricing.md` is behind the fleet — it still names `g.toon.ario` (a box label; the box terminates `g.toon.store` and `g.toon.relay.store`), still shows the store as flat when it serves `base = 1000, per_kib = 10`, and does not know about the gas box. Tracked as [connector#1250](https://github.com/toon-protocol/connector/issues/1250); `docs/mesh-compute-job-protocol.md` and `docs/micro-perps-research.md` cite it as the price authority and want the same correction once it lands. Also open: two ADRs share the number 0065 in the connector ([connector#1249](https://github.com/toon-protocol/connector/issues/1249)) — cite that one by title. Otherwise: image-publish workflow parity across the newer repos, and per-repo `CLAUDE.md` alignment to this folder.
