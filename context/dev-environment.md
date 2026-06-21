# Dev Environment Standard

The single source of truth for how every `toon-protocol` **code** repo pins its local +
CI toolchain. The goal is reproducibility: the toolchain you build with locally is the
toolchain CI builds with, byte-for-byte.

## The standard: Devbox

Every code repo pins its toolchain with a committed **[Devbox](https://github.com/jetify-com/devbox)**
`devbox.json` (+ generated `devbox.lock`), and validates it in CI with a non-gating
**`devbox-validate`** job. **[connector](https://github.com/toon-protocol/connector)** is
the reference implementation — copy its shape, not its exact package set.

Copyable starting files live in [`../templates/devbox/`](../templates/devbox/). Adopt them
per repo; do not hand-roll a divergent setup.

## Base toolchain (every repo)

| Tool | Pin | Notes |
|------|-----|-------|
| Node | `nodejs@22` | **org standard — matches connector (`22.11.0`).** Resolves the Node 20 EOL / nixpkgs-insecure problem (see [Decisions](#decisions)). The rollout bumps each repo's `engines.node` to `>=22` and its CI/release `node-version` to `22` in the same PR. |
| pnpm | `pnpm@8.15.0` | org package manager (`package.json` `packageManager`), pinned as a Devbox package — `pnpm publish` rewrites `workspace:*`, see [repos.md](./repos.md). |

`devbox.lock` fixes the exact resolved build. If a repo declares no `packageManager` (e.g.
`store`), set it to `pnpm@8.15.0` to match its siblings in the same PR. Base devbox `scripts`:

```
build: pnpm install --frozen-lockfile && pnpm build
lint:  pnpm lint
test:  pnpm test
```

A repo whose real targets live in a `Makefile`/`justfile` should have its devbox scripts
shell out to those (e.g. `test: make test`) so there is exactly one definition of each
target.

## Opt-in chain tooling (only where used)

Add these **only** in a repo that actually compiles contracts/programs. Don't ship an
unused Rust/Solana toolchain to a pure-TS repo — it just slows cold installs.

| Repo | Base | + Rust | + Foundry | + Solana CLI | Why |
|------|:----:|:------:|:---------:|:------------:|-----|
| toon | ✓ | | | | pure TS |
| relay | ✓ | | | | pure TS |
| store | ✓ | | | | pure TS (Arweave DVM; no `forge`/`solana` in the build) |
| hub | ✓ | | | | pure TS |
| toon-client | ✓ | | | | pure TS |
| swap | ✓ | | ✓ | | no Rust/Solana program; `anvil` is used by `test:integration:anvil` |
| **connector** | ✓ | ✓ | ✓ | ✓ | multi-chain: Solana SBF program + EVM contracts |

The matrix is grounded in each repo's actual build, not the original epic's first guess:
`swap`/`store` were initially slated for the full chain toolchain, but repo inspection
found `store` is pure TS and `swap` needs only Foundry (`anvil`) — no Rust/Solana SBF.

The Rust/Foundry/Solana blocks (packages + `init_hook` + `solana-build`/`forge-build`
scripts) are lifted verbatim from `connector/devbox.json` — see the template's commented
opt-in sections. Solana is installed by the `init_hook` (via `release.anza.xyz`), not Nix.

## Lock file (`devbox.lock`)

The rollout PR **commits both `devbox.json` and a generated `devbox.lock`.** The agent
producing the PR generates the lock itself — it installs the Devbox CLI in its run
(`curl -fsSL https://get.jetify.com/devbox | bash -s -- -f`) and runs `devbox install`,
then commits the result.

**The `devbox-validate` CI job is read-only — it must never commit `devbox.lock` back to
the PR branch.** That write-back pattern (CI mutating the PR branch, which needs branch
write access) is rejected: it got an early rollout PR closed. If the agent genuinely
cannot run Devbox in its environment, commit `devbox.json` alone and say so in the PR —
`devbox`/`devbox-validate` still resolve from `devbox.json`, and the non-gating job won't
block the merge; a lock can be added in a follow-up. Never wire CI to commit it.

## CI validation

Add the `devbox-validate` job from [`../templates/devbox/ci-devbox-validate.yml`](../templates/devbox/ci-devbox-validate.yml):

- `jetify-com/devbox-install-action@v0.15.0` with `enable-cache: true`
- an **assert-versions** step (only assert the tools the repo actually pins)
- a `devbox run -- ...` **smoke build**

Keep it **non-gating** (not in `ci-status` `needs:`) so a Nix/devbox hiccup never blocks a
merge — it's a bake-in signal, not a gate.

## Decisions

- **Node 22 org-wide (2026-06-21).** The rollout deadlocked on Node 20 vs 22: the six TS
  repos declared `>=20`, but Node 20 reached EOL (April 2026) and nixpkgs now flags
  `nodejs@20` as insecure, so Devbox can't pin it without an insecure-override. Resolution:
  **standardize on Node 22**, matching the connector pilot (`22.11.0`). Each rollout PR
  bumps `engines.node` → `>=22` and CI/release `node-version` → `22`. `store`'s
  `Dockerfile.dvm` runtime image stays `node:20-alpine` (a separate image-versioning
  follow-up, out of scope for devbox adoption).

## Known divergence (not part of devbox adoption)

- **connector uses `npm` scripts.** connector's devbox `scripts` call `npm ci` / `npm run
  build`, while the org package-manager standard is **pnpm** (per [repos.md](./repos.md),
  `pnpm publish`). New adoptions use pnpm; reconciling connector to pnpm is tracked
  separately — **do not change connector's devbox scripts as part of a rollout ticket.**

## See also

- [`../templates/devbox/`](../templates/devbox/) — copyable `devbox.json`, CI job, README section
- `connector/devbox.json`, `connector/README.md` ("Getting started with Devbox") — worked example
- [repos.md](./repos.md) — per-repo devbox adoption status
