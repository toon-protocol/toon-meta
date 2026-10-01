# Factory template — the AFK factory for a new repo

The files a repo needs to run the **AFK factory**: an issue labelled `ready-for-agent` is
implemented and reviewed by agents in a sandbox, and comes back as a PR labelled
`ready-for-human`. A human merges. This is the factory relay, store, connector and the
other execution repos run since they left the central fleet; `FACTORY.md` at the root of
this repo describes that older fleet, not this.

Install it with the `bootstrap-factory` skill
([`skills/bootstrap-factory/`](../../skills/bootstrap-factory/SKILL.md)), which copies these
files, creates the triage labels and checks the secrets. Copying by hand works too.

| File | Goes to | Purpose |
|------|---------|---------|
| `.sandcastle/` | `.sandcastle/` | the runner: picks ready issues, runs implement → review → gate → push → PR |
| `.github/workflows/agent-implement.yml` | same path | starts the runner on `ready-for-agent`, on an issue closing, and every two hours |
| `.github/workflows/close-linked-issues.yml` | same path | closes the issues a merged PR closes, so blocked tickets become ready |

## What changes per repo

- `__REPO__` in `agent-implement.yml` becomes the repo's name, lowercased: the tag
  sandcastle derives for its image from the checkout directory.
- The `## This repository` section of `.sandcastle/implement-prompt.md` gains the repo's
  own facts.

Everything else is identical in every factory repo. Change it here first, then in the repos.

## What the runner assumes

- The default branch is `main`.
- The org secrets `APP_ID`, `APP_PRIVATE_KEY` and `CLAUDE_CODE_OAUTH_TOKEN`, and the GitHub
  App behind `APP_ID` installed on the repo.
- The five canonical triage labels exist under their default names.
- The gate is the `run:` steps of the `gate` job (else `checks`) in the repo's
  `.github/workflows/ci.yml` on `main`. With no such job the gate runs nothing and says so
  (`gateFromCi` in `.sandcastle/run-gate.ts`).

The runner is self-contained: `.sandcastle/package.json` is its only Node manifest, so it
works in a repo of any stack. Its own checks, from `.sandcastle/`: `npm ci`, `npm test`,
`npm run typecheck`.
