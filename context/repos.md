# Repo Map & Ownership

TOON is a **polyrepo** under the `toon-protocol` GitHub org. Code is shared via **npm** (semver); deployment composition via **pinned Docker image digests**.

| Repo | Packages / contents | Publishes | Owner |
|------|---------------------|-----------|-------|
| **toon** | `@toon-protocol/core`, `@toon-protocol/sdk` | npm libs (no image/CLI) | Platform |
| **relay** | `@toon-protocol/relay` (+ `town` launcher, pending merge), `@toon-protocol/bls` | npm + `relay` image | Relay |
| **swap** | `@toon-protocol/mill` (repo named `swap`; pkg rename pending) | npm + `swap` image | Swap |
| **store** | Arweave DVM build context (`Dockerfile.dvm` + entrypoint over sdk handler) | `store` image | Store |
| **hub** | `@toon-protocol/townhouse` (+ web, mcp; rename pending) | npm + `hub-api` image + plugin | Operator |
| **toon-client** | `@toon-protocol/client`, `@toon-protocol/client-mcp`, `rig`, `toon-plugin` | npm + plugin | Client |
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

## Archived / not migrated

The pet-game packages (`pet-dvm`, `pet-circuit`, `mina-zkapp` [the game one], `memvid-node`) and `faucet`/`examples` stay in the archived original monorepo. The **connector** owns the canonical settlement `@toon-protocol/mina-zkapp`.

## Outstanding follow-ups

Package renames (`mill→swap`, `townhouse→hub` + deprecate-redirect), `town→relay` code merge, `store` trim-to-dvm, image-publish workflows + hub image-manifest, optional `TransportConfig` decoupling. See the split plan / repo `CLAUDE.md`s.
