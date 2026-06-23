# toon-meta

Cross-cutting assets for the **TOON Protocol** — the shared **context hub** and **agent-skills source**, kept independent of any product repo.

## Contents

- **[`context/`](./context/)** — the curated **context architecture**: [context](./context/context.md) · [architecture](./context/architecture.md) · [repos](./context/repos.md) · [decisions](./context/decisions.md) · [glossary](./context/glossary.md). **Start at [`context/context.md`](./context/context.md).**
- **[`skills/`](./skills/)** — the shared Claude Agent Skills (NIP-on-TOON, Interledger RFC localized to TOON's claim-over-BTP model, git-on-Nostr, content/social, dev utilities), published as the **`toon-skills`** plugin. Product-specific skills (e.g. `toon-client`) ship in their own product plugins. Includes the **agent backlog loops** — `backlog-manager` (triage), `issue-decomposer` (splits oversized `agent:split` tickets into executor-sized children), and `issue-executor` (implements `agent:ready` tickets).
- **[`templates/agent-loops/`](./templates/agent-loops/)** — copy-in GitHub Actions workflows that run the three backlog loops (manager → executor → reviewer) per repo, **billed to your Claude Max plan**. See its [README](./templates/agent-loops/README.md) for setup, prerequisites, and the dry-run→apply rollout.
- **[`docs/`](./docs/)** — deep protocol/implementation reference (protocol.md, settlement.md, architecture.md, bootstrap.md, guides). New here: **[deploy-app-guide.md](./docs/deploy-app-guide.md)** — how to deploy/monetize an app with TOON (payment-proxy + native-node paths, with shipped-vs-in-progress status).

## Using the shared skills in another repo

```
/plugin marketplace add toon-protocol/toon-meta
/plugin install toon-skills@toon-meta
```

Each TOON code repo's `CLAUDE.md` links here for shared context.

> Extracted from the TOON monorepo with git history preserved. The BMAD framework skills and the raw `_bmad-output/` planning dump were removed in favor of the curated `context/` above.
