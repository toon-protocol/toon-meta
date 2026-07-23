# vanilla-pnpm-gate

Shared composite action for the `eslint / typecheck / vitest / build` gate common to the
five vanilla-pnpm repos: **relay, rig, swap, toon-client, toon**. Factored out under the
gate-hardening epic ([#210](https://github.com/toon-protocol/toon-meta/issues/210),
[ADR-0001](../../../docs/adr/0001-gate-priority-and-baseline-freeze.md)) once every repo's
baseline revealed where the per-repo gate shapes genuinely converge vs. diverge.

This is a **design-only** artifact ([#241](https://github.com/toon-protocol/toon-meta/issues/241)):
no consuming repo's `ci.yml` calls it yet. Swapping each repo over is a separate follow-up
per repo under [#232](https://github.com/toon-protocol/toon-meta/issues/232).

## Not included

These stay as separate per-repo jobs/steps and are never folded into this action:

- `devbox-validate` (relay, swap, toon-client, toon — each with its own per-repo tool assertions)
- `changeset` (rig, toon-client)
- toon's `connector-contract-canary` step
- swap's anvil-gated `Integration tests` step

## Inputs

| Name | Description | Default |
|---|---|---|
| `node-version` | Node.js version passed to `actions/setup-node`. | `'22'` |
| `pnpm-version` | pnpm version passed to `pnpm/action-setup`. | `'8.15.9'` |
| `frozen-lockfile` | `'true'` runs `pnpm install --frozen-lockfile`; `'false'` runs `pnpm install --no-frozen-lockfile`. | `'false'` |
| `lint-command` | Shell command that runs lint. | `'pnpm lint'` |
| `lint-continue-on-error` | `'true'` lets the lint step fail without failing the job (soft gate); `'false'` hard-fails the job on lint errors. | `'true'` |
| `build-command` | Shell command that runs the build. | `'pnpm -r build'` |
| `test-command` | Shell command that runs tests. | `'pnpm -r test --if-present'` |

## Usage

Default (relay / rig / swap / toon-client style — soft-gated lint, non-frozen lockfile):

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: toon-protocol/toon-meta/.github/actions/vanilla-pnpm-gate@main
```

toon override (hard-fail lint):

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: toon-protocol/toon-meta/.github/actions/vanilla-pnpm-gate@main
        with:
          lint-continue-on-error: 'false'
```
