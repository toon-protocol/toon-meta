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
standard (base = Node 22 + `pnpm_8`@8.15.9, `disable_plugin` on nodejs; chain tooling opt-in).
**Adoption complete — all 7 code repos have `devbox.json` + a non-gating `devbox-validate` job on `main`:**

| Repo | Devbox toolchain |
|------|------------------|
| **connector** | ✅ reference impl — Node + Rust + Foundry + Solana |
| swap | ✅ base + Foundry (`anvil` for integration tests) |
| connector · toon · relay · store · hub · toon-client | ✅ base-only (pure TS), except connector/swap above |
| toon-meta | n/a (no build step) |

Rolled out via the `#1` ticket in each repo (epic [toon-meta#11](https://github.com/toon-protocol/toon-meta/issues/11)). The canary surfaced two devbox 0.17.3 gotchas now baked into the standard: the nodejs corepack plugin crashes on `"type": "module"` repos (→ `disable_plugin`), and `--frozen-lockfile` trips pre-existing lockfile drift (→ `--no-frozen-lockfile`, matching each repo's own CI).

## Archived / not migrated

The pet-game packages (`pet-dvm`, `pet-circuit`, `mina-zkapp` [the game one], `memvid-node`) and `faucet`/`examples` stay in the archived original monorepo. The **connector** owns the canonical settlement `@toon-protocol/mina-zkapp`.

## Package names (final)

`mill→swap` and `townhouse→hub`/`hub-web`/`hub-mcp` are the active published names, and cross-repo deps resolve cleanly against them. `@toon-protocol/mill` is fully gone (404); `@toon-protocol/swap` and `@toon-protocol/hub` are the live packages. **Not yet done:** the old `@toon-protocol/townhouse` package is still live on npm (last at `0.34.3`, undeprecated) — the deprecate-redirect is still pending (see follow-ups). Epic [toon-meta#42](https://github.com/toon-protocol/toon-meta/issues/42) swept the last stale `@toon-protocol/mill` ref in `store` and scrubbed residual `town`/`townhouse`/`mill` **metadata** (`repository.url`s, hub workspace dirs, descriptions). Note: `g.townhouse.*` ILP node-ids, `TOWNHOUSE_*` env vars, and `town`/`mill`/`dvm` node-type terms are **live wire-protocol identifiers**, not old names — left intact.

## Outstanding follow-ups

Deprecate/redirect the still-live old `@toon-protocol/townhouse` npm package, `town→relay` code merge (launcher still a separate repo), `store` trim-to-dvm, image-publish workflows + hub image-manifest, optional `TransportConfig` decoupling. See the split plan / repo `CLAUDE.md`s.
