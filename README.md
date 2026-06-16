# toon-meta

Cross-cutting assets for the **TOON Protocol** — the shared **context hub** and **agent-skills source**, kept independent of any product repo.

## Contents

- **[`context/`](./context/)** — the curated **context architecture**: [context](./context/context.md) · [architecture](./context/architecture.md) · [repos](./context/repos.md) · [decisions](./context/decisions.md) · [glossary](./context/glossary.md). **Start at [`context/context.md`](./context/context.md).**
- **[`skills/`](./skills/)** — the shared Claude Agent Skills (NIP-on-TOON, Interledger RFC localized to TOON's claim-over-BTP model, git-on-Nostr, content/social, dev utilities), published as the **`toon-skills`** plugin. Product skills (`toon-client`, `townhouse-operator`) ship in their own product plugins (`toon-client`, `hub`).
- **[`docs/`](./docs/)** — deep protocol/implementation reference (protocol.md, settlement.md, architecture.md, bootstrap.md, guides).

## Using the shared skills in another repo

```
/plugin marketplace add toon-protocol/toon-meta
/plugin install toon-skills@toon-meta
```

Each TOON code repo's `CLAUDE.md` links here for shared context.

> Extracted from the TOON monorepo with git history preserved. The BMAD framework skills and the raw `_bmad-output/` planning dump were removed in favor of the curated `context/` above.
