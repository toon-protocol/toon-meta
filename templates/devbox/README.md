# Devbox template — adopt the org dev-environment standard

Copyable starting files for putting a repo on the org's pinned toolchain. The standard
and rationale live in [`../../context/dev-environment.md`](../../context/dev-environment.md);
**connector** is the worked reference implementation.

| File | Goes to | Purpose |
|------|---------|---------|
| `devbox.json` | repo root | base toolchain (Node + pnpm) + build/lint/test scripts |
| `ci-devbox-validate.yml` | a job in `.github/workflows/ci.yml` | non-gating CI validation |
| `README-devbox.md` | the repo's README | "Getting started with Devbox" section |

## Adoption steps

1. Copy `devbox.json` to the repo root (object package form). Keep `nodejs@22` with
   `disable_plugin: true` and `pnpm_8@8.15.9` (org standard — see
   [`../../context/dev-environment.md`](../../context/dev-environment.md)); align the
   `build`/`lint`/`test` scripts to the repo's real targets (shell out to `make`/`just` if
   that's where they live). In the same PR bump the repo's `engines.node` → `>=22` and any
   `node-version:` in `ci.yml`/`release.yml` → `22` so the manifest, CI, and devbox agree.
   **`disable_plugin: true` on nodejs is required** — without it devbox's corepack init
   script crashes on `"type": "module"` repos (every TOON TS repo); see the standard's
   "Base toolchain" note. A non-`type:module` repo (e.g. connector) may omit it.
   **Also bump pnpm `8.15.0` → `8.15.9` everywhere** it appears — `package.json`
   `packageManager` and every `pnpm/action-setup` `version:` in `ci.yml` *and* `release.yml`
   — so all of them match what devbox resolves (`pnpm_8` → `8.15.9`).
2. **Chain tooling (only if the repo compiles contracts/programs):** add the relevant
   opt-in block below to `devbox.json`, and uncomment the matching assertions + Solana
   cache step in the CI job. Base-only repos (toon, relay, store, hub, toon-client) skip
   this entirely; **swap** adds only `foundry` (for `anvil`), no Rust/Solana.
3. Paste the `devbox-validate` job from `ci-devbox-validate.yml` into the repo's CI
   workflow. Keep it **non-gating** (not in any `ci-status` `needs:`).
4. Paste `README-devbox.md` into the repo README; fill in `<PNPM_VERSION>`.
5. Generate the lockfile and commit it. Install the Devbox CLI if absent
   (`curl -fsSL https://get.jetify.com/devbox | bash -s -- -f`), run `devbox install`, and
   **commit `devbox.lock` alongside `devbox.json`.** Do NOT rely on CI to commit the lock
   back to the branch — `devbox-validate` is read-only. (If Devbox genuinely can't run in
   your environment, commit `devbox.json` alone and note it; the lock can follow.)
6. Gitignore the Nix dir: add `.devbox/` to `.gitignore`.

## Opt-in chain blocks (lifted from `connector/devbox.json`)

Add to the `packages` object (`swap` needs only `foundry`; `connector` uses all three plus
Rust/Solana):

```json
"foundry": { "version": "1.7.1" },
"rustup":  { "version": "1.29.0" },
"jq":      { "version": "1.7.1" }
```

Add to `shell.init_hook`:

```json
"rustup default stable 2>/dev/null || true",
"rustup component add rustfmt clippy 2>/dev/null || true",
"rustup target add bpfel-unknown-unknown 2>/dev/null || true",
"export PATH=\"$HOME/.local/share/solana/install/active_release/bin:$PATH\"",
"command -v solana >/dev/null 2>&1 || sh -c \"$(curl -sSfL https://release.anza.xyz/v3.1.12/install)\""
```

Add to `shell.scripts` (adjust paths):

```json
"solana-build": "cd packages/solana-program && cargo build-sbf --tools-version v1.52",
"forge-build": "cd packages/contracts && forge build"
```

## Verify locally

```bash
jq . devbox.json        # valid JSON
devbox install          # resolves packages, writes devbox.lock
devbox run build        # smoke the build inside the pinned shell
```
