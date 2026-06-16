# context/

The curated, agent-loadable **context architecture** for the TOON Protocol — the single place to understand the system without reading every repo. Replaces the old BMAD `project-context.md`.

| Doc | What it covers |
|-----|----------------|
| [context.md](./context.md) | **Start here** — what TOON is, node types, current state, how to use this repo |
| [architecture.md](./architecture.md) | System & repo architecture, runtime payment flow, load-bearing invariants, payment model, key event kinds |
| [repos.md](./repos.md) | Repo map, ownership, dependency graph, coupling rules, follow-ups |
| [decisions.md](./decisions.md) | Durable architectural decisions (ADR-lite: decision → why) |
| [contracts.md](./contracts.md) | Inter-repo contracts — how the repos talk + where each wire/type contract's source of truth lives |
| [glossary.md](./glossary.md) | ILP + TOON + Nostr terms |

For deep protocol/implementation reference, see [`../docs/`](../docs/) (protocol.md, settlement.md, architecture.md, bootstrap.md, guides). For the agent skills, see [`../skills/`](../skills/) (installable via the `toon-skills` plugin).
