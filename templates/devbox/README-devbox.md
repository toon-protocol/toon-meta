<!--
Paste this section into the repo's README.md (under a "Development" / "Getting
started" heading). Trim the chain-tool lines if the repo is base-only. Replace
`<NODE_VERSION>`/`<PNPM_VERSION>` with the repo's pins (devbox.json / package.json
`engines.node` + `packageManager`).
-->

### Getting started with Devbox

[Devbox](https://github.com/jetify-com/devbox) pins the local toolchain to the exact
versions CI uses — Node `<NODE_VERSION>` and pnpm `<PNPM_VERSION>` — so `pnpm build`,
`pnpm test`, and `pnpm lint` run in a reproducible shell without touching your system
packages.

**Prerequisites:** [Install devbox](https://www.jetify.com/devbox/docs/installing_devbox/) (one-liner).

```bash
# Enter the pinned shell (downloads packages on first run via Nix)
devbox shell

# Inside the devbox shell, all tools are on PATH:
node --version    # <NODE_VERSION>
pnpm --version    # <PNPM_VERSION>

# Run the standard targets (defined as devbox scripts)
devbox run build  # pnpm install --frozen-lockfile && pnpm build
devbox run lint
devbox run test
```

`.devbox/` (the Nix symlink/cache dir) is gitignored; `devbox.json` and `devbox.lock`
are committed.

<!--
CHAIN-TOOL REPOS (e.g. connector): also document the extra toolchain, e.g.
  cargo --version   # rust stable
  solana --version  # 3.1.12 (installed via init_hook on first shell entry)
  forge --version   # foundry
and the existing-Solana-install caveat:
  The init_hook only installs Solana CLI if none is on $PATH. To force the pinned
  version, `rm -rf ~/.local/share/solana` before `devbox shell`.
-->
