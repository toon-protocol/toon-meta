# Repo Map & Ownership

TOON is a **polyrepo** under the `toon-protocol` GitHub org. Code is shared via **npm** (semver); deployment composition via **pinned Docker image digests**.

| Repo | Packages / contents | Publishes | Owner |
|------|---------------------|-----------|-------|
| **toon** | `@toon-protocol/core`, `@toon-protocol/sdk` | npm libs (no image/CLI) | Platform |
| **relay** | `@toon-protocol/relay`, `@toon-protocol/bls` (+ `town` launcher code-merge pending) | npm + `relay` image | Relay |
| **swap** | `@toon-protocol/swap` | npm + `swap` image | Swap |
| **store** | Arweave DVM build context (`Dockerfile.dvm` + entrypoint over sdk handler) | `store` image | Store |
| **toon-client** | the two **official TOON client implementations**, both over `@toon-protocol/client`: `@toon-protocol/client-mcp` (`toon-clientd` + the `toon_*`/`toon_git_*` MCP tools — the agent-host client) and `@toon-protocol/rig` (the `rig` CLI — the git-native client, standalone/daemon-free; replaces the deprecated `@toon-protocol/git`); plus `@toon-protocol/rig-web` (the Rig SPA read surface), `@toon-protocol/views`, `@toon-protocol/arweave` | npm + plugin | Client |
| **toon-meta** | this repo — shared skills, context, docs | the `toon-skills` plugin | Cross-cutting |
| **connector** *(pre-existing)* | the ILP payment engine + on-chain contracts/programs/zkApp + `@toon-protocol/mina-zkapp` | npm `@toon-protocol/connector`, `shared`, `mina-zkapp` + image | Payments |

## Dependency direction

```
connector ◄─ (optional peer) ─ toon (core, sdk) ─► relay · swap · store · client
```
Strictly downward. The **connector** — the proxy-server layer at the edge — consumes the libs from npm **and** pins the child node image digests for a deployment.

## Coupling rules

- **npm semver** replaces in-tree `workspace:*`. Publish with **`pnpm publish`** (rewrites the workspace protocol) — **never `npm publish`** (it shipped the broken `sdk@0.5.0`/`town@0.4.0`).
- **The connector pins image digests** for relay/swap/store, validated by a preflight against `constants.ts`.
- **Agent context** is shared via this repo: `CLAUDE.md` in each code repo links here; the `toon-skills` plugin distributes the shared skills.
- **Payment proxy.** The `connector` can act as a payment **proxy server** in front of any HTTP backend (onboard via x402 → transparent HTTP-in-ILP → HTTP→BTP upgrade). **Path A core is shipped on connector `main`** (proxy handler, x402 greeting, `h402Fetch`, RFC 9421, `RouteTermination`; proven live at `connector.pay.toonprotocol.dev`); the devnet roundtrip harness (PR #245, merged) and the `deploy/pay-edge/` bundle (PR #252, merged; supersedes closed PR #246) have also shipped. See [`docs/payment-proxy.md`](../docs/payment-proxy.md).

## Dev environment

All code repos pin their toolchain with Devbox per the [dev-environment.md](./dev-environment.md)
standard (base = Node 22 + `pnpm_8`@8.15.9, `disable_plugin` on nodejs; chain tooling opt-in).
**Adoption complete — all 6 code repos have `devbox.json` + a non-gating `devbox-validate` job on `main`:**

| Repo | Devbox toolchain |
|------|------------------|
| **connector** | ✅ reference impl — Node + Rust + Foundry + Solana |
| swap | ✅ base + Foundry (`anvil` for integration tests) |
| connector · toon · relay · store · toon-client | ✅ base-only (pure TS), except connector/swap above |
| toon-meta | n/a (no build step) |

Rolled out via the `#1` ticket in each repo (epic [toon-meta#11](https://github.com/toon-protocol/toon-meta/issues/11)). The canary surfaced two devbox 0.17.3 gotchas now baked into the standard: the nodejs corepack plugin crashes on `"type": "module"` repos (→ `disable_plugin`), and `--frozen-lockfile` trips pre-existing lockfile drift (→ `--no-frozen-lockfile`, matching each repo's own CI).

## Archived / not migrated

The pet-game packages (`pet-dvm`, `pet-circuit`, `mina-zkapp` [the game one], `memvid-node`) and `faucet`/`examples` stay in the archived original monorepo. The **connector** owns the canonical settlement `@toon-protocol/mina-zkapp`.

## Package names (final)

`mill→swap` is the active published swap-package name, and cross-repo deps resolve cleanly. `@toon-protocol/mill` is fully gone (404); `@toon-protocol/swap` is the live swap package. The former operator product (`@toon-protocol/hub`/`hub-web`/`hub-mcp`) is **removed**: the proxy-server role now lives in the **connector** itself. The hub packages are deprecated (completed 2026-06-22, issue #44). The wire vocabulary's **canonical term** is apex nodeId **`g.proxy`**, child addresses `g.proxy.<type>` (e.g. `g.proxy.relay`), env prefix `PROXY_*` — used by the live devnet and the epic-44 docs. "Connector" remains the repo/product name; only the on-wire nodeId + env prefix are the `g.proxy` axis. Live ILP edges include `connector.pay.toonprotocol.dev/ilp` and `proxy.store.devnet.toonprotocol.dev/ilp` (no single canonical vhost scheme). **Pending cleanup:** purge remaining legacy `g.connector` references in favor of `g.proxy`; that is a naming-cleanup follow-up, not a "proxy rename". The `town`/`mill`/`dvm` node-**type** terms are a separate naming axis and remain live wire-protocol identifiers, left intact. Epic [toon-meta#42](https://github.com/toon-protocol/toon-meta/issues/42) swept the last stale `@toon-protocol/mill` ref in `store`.

## Outstanding follow-ups

`town→relay` code merge (launcher still a separate repo), `store` trim-to-dvm, image-publish workflows + connector image-manifest, optional `TransportConfig` decoupling. See the split plan / repo `CLAUDE.md`s.
