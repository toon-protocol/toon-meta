# toon-meta

Cross-cutting assets for the **TOON Protocol** — the shared **context hub** and **agent-skills source**, kept independent of any product repo.

## Quickstart — send your first paid packet

The live devnet settles on **public chains** (exact-match chain ids: `evm:84532` ·
`solana:devnet` · `mina:devnet`). The fastest path from zero to a paid write:

1. `npm i -g @toon-protocol/rig` and follow the
   [rig README](https://github.com/toon-protocol/toon-client/blob/main/packages/rig/README.md)
   (steps 1–8: identity → remote → fund → push). Its
   ["Devnet reference (public chains)"](https://github.com/toon-protocol/toon-client/blob/main/packages/rig/README.md#devnet-reference-public-chains)
   section has every endpoint and contract address.
2. Fund a wallet at **<https://faucet.devnet.toonprotocol.dev>** (web UI, all
   three chains) or `rig fund`.
3. The exact client config + full address book:
   [docs/deployment.md → "Pointing a client at the devnet"](./docs/deployment.md#pointing-a-client-at-the-devnet-rig-standalone).
   The scripted end-to-end demo (push → permaweb site → ArNS name):
   [`scripts/demo-e2e.sh`](./scripts/demo-e2e.sh).

## Contents

- **[`context/`](./context/)** — the curated **context architecture**: [context](./context/context.md) · [architecture](./context/architecture.md) · [repos](./context/repos.md) · [decisions](./context/decisions.md) · [glossary](./context/glossary.md). **Start at [`context/context.md`](./context/context.md).**
- **[`skills/`](./skills/)** — the shared Claude Agent Skills (NIP-on-TOON, Interledger RFC localized to TOON's claim-over-BTP model, git-on-Nostr, content/social, dev utilities), published as the **`toon-skills`** plugin. Product-specific skills (e.g. `toon-client`) ship in their own product plugins. Includes the **agent backlog loops** — `backlog-manager` (triage), `issue-decomposer` (splits oversized `agent:split` tickets into executor-sized children), and `issue-executor` (implements `agent:ready` tickets).
- **[`templates/agent-loops/`](./templates/agent-loops/)** — copy-in GitHub Actions workflows that run the four backlog loops (manager → executor → reviewer → decomposer) per repo, **billed to your Claude Max plan**. See its [README](./templates/agent-loops/README.md) for setup, prerequisites, and the dry-run→apply rollout.
- **[`docs/`](./docs/)** — deep protocol/implementation reference (protocol.md, settlement.md, architecture.md, bootstrap.md, guides). New here: **[deploy-app-guide.md](./docs/deploy-app-guide.md)** — how to deploy/monetize an app with TOON (payment-proxy + native-node paths, with shipped-vs-in-progress status).

## Using the shared skills in another repo

```
/plugin marketplace add toon-protocol/toon-meta
/plugin install toon-skills@toon-meta
```

Each TOON code repo's `CLAUDE.md` links here for shared context.

> Extracted from the TOON monorepo with git history preserved. The BMAD framework skills and the raw `_bmad-output/` planning dump were removed in favor of the curated `context/` above.
