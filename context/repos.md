# Repo Map & Ownership

TOON is a **polyrepo** under the `toon-protocol` GitHub org. Code is shared via **npm** (semver); deployment composition via **pinned Docker image digests**.

| Repo | Packages / contents | Publishes | Owner |
|------|---------------------|-----------|-------|
| **toon** | `@toon-protocol/core`, `@toon-protocol/sdk` | npm libs (no image/CLI) | Platform |
| **relay** | `@toon-protocol/relay`, `@toon-protocol/bls` (+ `town` launcher code-merge pending) | npm + `relay` image | Relay |
| **swap** | `@toon-protocol/swap` | npm + `swap` image | Swap |
| **store** | Arweave DVM build context (`Dockerfile.dvm` + entrypoint over sdk handler) | `store` image | Store |
| **toon-client** | `@toon-protocol/client`, `@toon-protocol/client-mcp`, `@toon-protocol/rig`, `@toon-protocol/views` | npm + plugin | Client |
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
- **Payment proxy.** The `connector` can act as a payment **proxy server** in front of any HTTP backend (onboard via x402 → transparent HTTP-in-ILP → HTTP→BTP upgrade). **Path A core is shipped on connector `main`** (proxy handler, x402 greeting, `h402Fetch`, RFC 9421, `RouteTermination`; proven live at `connector.pay.toonprotocol.dev`); only the devnet roundtrip harness (PR #245) and the `deploy/pay-edge/` bundle (PR #246) remain open PRs. See [`docs/payment-proxy.md`](../docs/payment-proxy.md).

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

`mill→swap` is the active published swap-package name, and cross-repo deps resolve cleanly. `@toon-protocol/mill` is fully gone (404); `@toon-protocol/swap` is the live swap package. The former operator product — `@toon-protocol/townhouse`, later renamed `@toon-protocol/hub`/`hub-web`/`hub-mcp` — is **removed**: the proxy-server role now lives in the **connector** itself. `@toon-protocol/townhouse` was already deprecated/redirected (completed 2026-06-22, issue #44), and the `hub*` packages are likewise deprecated. The wire vocabulary's **canonical term** is apex nodeId **`g.connector`**, child addresses `g.connector.<type>`, vhost `connector.<domain>/ilp` — used by the code, infra, and live edge. **Pending cleanup:** `origin/main` still carries ~60 legacy **`g.townhouse`** references to purge in favor of `g.connector` (and stray `terminator` from the older retired name); that is a naming-cleanup follow-up, not a "proxy rename". The `town`/`mill`/`dvm` node-**type** terms are a separate naming axis and remain live wire-protocol identifiers, left intact. Epic [toon-meta#42](https://github.com/toon-protocol/toon-meta/issues/42) swept the last stale `@toon-protocol/mill` ref in `store`.

## Outstanding follow-ups

`town→relay` code merge (launcher still a separate repo), `store` trim-to-dvm, image-publish workflows + connector image-manifest, optional `TransportConfig` decoupling. See the split plan / repo `CLAUDE.md`s.
