# toon-meta

Cross-cutting, non-code assets for the TOON Protocol, extracted so they have one shared home independent of any product repo:

- **`.claude/skills/`** — the Claude Agent Skills (NIP protocol, Interledger RFC, BMAD, and shared tooling skills). Product-specific skills (`toon-client`, `townhouse-operator`) travel with their product repos.
- **`docs/`** — protocol/architecture documentation.
- **`_bmad-output/`** — planning artifacts, project context, research, and content drafts.

> Extracted from the TOON monorepo with full git history preserved. Reference repo — no build, no npm publish.

## Using the shared skills in another repo

The skills in `skills/` are published as a Claude Code plugin via `.claude-plugin/marketplace.json`. In any TOON repo:

```
/plugin marketplace add toon-protocol/toon-meta
/plugin install toon-skills@toon-meta
```

Product skills (`toon-client`, `townhouse-operator`) are **not** here — they ship in their own product plugins (`toon-plugin` in `toon-client`, `townhouse-plugin` in `hub`).
