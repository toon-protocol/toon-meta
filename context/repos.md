# Repo Map & Ownership

TOON is a **polyrepo** under the `toon-protocol` GitHub org. Code is shared via **npm** (semver); deployment composition via **pinned Docker image digests**.

| Repo | Packages / contents | Publishes | Owner |
|------|---------------------|-----------|-------|
| **toon** | `@toon-protocol/core`, `@toon-protocol/sdk` | npm libs (no image/CLI) | Platform |
| **relay** | `@toon-protocol/relay`, `@toon-protocol/bls` (+ `town` launcher code-merge pending) | npm + `relay` image | Relay |
| **swap** | `@toon-protocol/swap` | npm + `swap` image | Swap |
| **store** | Arweave DVM build context (`Dockerfile.dvm` + entrypoint over sdk handler) | `store` image | Store |
| **hub** | `@toon-protocol/hub`, `@toon-protocol/hub-web`, `@toon-protocol/hub-mcp` | npm + `hub-api` image + plugin | Operator |
| **toon-client** | `@toon-protocol/client`, `@toon-protocol/client-mcp`, `@toon-protocol/rig`, `@toon-protocol/views` | npm + plugin | Client |
| **toon-meta** | this repo — shared skills, context, docs | the `toon-skills` plugin | Cross-cutting |
| **connector** *(pre-existing)* | the ILP payment engine + on-chain contracts/programs/zkApp + `@toon-protocol/mina-zkapp` | npm `@toon-protocol/connector`, `shared`, `mina-zkapp` + image | Payments |

## Dependency direction

```
connector ◄─ (optional peer) ─ toon (core, sdk) ─► relay · swap · store · client ─► hub
```
Strictly downward. `hub` consumes the libs from npm **and** pins child node image digests.

## Coupling rules

- **npm semver** replaces in-tree `workspace:*`. Publish with **`pnpm publish`** (rewrites the workspace protocol) — **never `npm publish`** (it shipped the broken `sdk@0.5.0`/`town@0.4.0`).
- **`hub` pins image digests** for relay/swap/store (+ connector), validated by a preflight against `constants.ts`.
- **Agent context** is shared via this repo: `CLAUDE.md` in each code repo links here; the `toon-skills` plugin distributes the shared skills.

## Dev environment

All code repos pin their toolchain with Devbox per the [dev-environment.md](./dev-environment.md)
standard (base = Node 22 + pnpm 8.15.0; chain tooling opt-in). Adoption status:

| Repo | Devbox status |
|------|---------------|
| **connector** | ✅ adopted (reference impl: Node + Rust + Foundry + Solana) |
| swap | ⏳ pending — base + Foundry (`anvil` for integration tests) |
| toon · relay · store · hub · toon-client | ⏳ pending — base-only (pure TS) |
| toon-meta | n/a (no build step) |

Rollout via the `#1` ticket in each repo (epic [toon-meta#11](https://github.com/toon-protocol/toon-meta/issues/11)); the stalled `agent/*-devbox` branches are superseded by the template.

## Archived / not migrated

The pet-game packages (`pet-dvm`, `pet-circuit`, `mina-zkapp` [the game one], `memvid-node`) and `faucet`/`examples` stay in the archived original monorepo. The **connector** owns the canonical settlement `@toon-protocol/mina-zkapp`.

## Package names (final)

The split + rename is complete on npm: `mill→swap` and `townhouse→hub`/`hub-web`/`hub-mcp` are the published names. Cross-repo deps resolve cleanly against published versions. Epic [toon-meta#42](https://github.com/toon-protocol/toon-meta/issues/42) swept the last stale `@toon-protocol/mill` ref in `store` and scrubbed residual `town`/`townhouse`/`mill` **metadata** (`repository.url`s, hub workspace dirs, descriptions). Note: `g.townhouse.*` ILP node-ids, `TOWNHOUSE_*` env vars, and `town`/`mill`/`dvm` node-type terms are **live wire-protocol identifiers**, not old names — left intact.

## Outstanding follow-ups

`town→relay` code merge (launcher still a separate repo), `store` trim-to-dvm, image-publish workflows + hub image-manifest, optional `TransportConfig` decoupling. See the split plan / repo `CLAUDE.md`s.
