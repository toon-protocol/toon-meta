---
stepsCompleted: ['step-01-preflight']
lastStep: 'step-01-preflight'
lastSaved: '2026-03-03'
---

# Test Framework Setup Progress

## Step 1: Preflight Checks

### Stack Detection

- **Detected stack**: `backend` (TypeScript/Node.js monorepo)
- No frontend framework detected (no React, Vue, Angular, Next.js)
- No backend manifests for other languages (no pyproject.toml, go.mod, pom.xml, etc.)
- Pure TypeScript/Node.js with pnpm workspaces

### Prerequisites Validation

- `package.json` exists at project root
- No conflicting E2E framework (no playwright.config._, no cypress.config._)
- Existing test framework: **Vitest ^1.0** already configured
  - Root vitest.config.ts (unit tests: packages/_/src/\*\*/_.test.ts)
  - packages/client/vitest.config.ts (client unit tests)
  - packages/client/vitest.e2e.config.ts (E2E: tests/e2e/\*_/_.test.ts)
- ~65 co-located unit test files across core, bls, relay, client, sdk
- 1 E2E test: packages/client/tests/e2e/genesis-bootstrap-with-channels.test.ts

### Project Context

- **Project type**: TypeScript monorepo (pnpm workspaces)
- **Bundler**: tsup (ESM library bundling)
- **Runtime**: Node.js >=20, ESM-only
- **Package manager**: pnpm 8.15.0
- **Test runner**: Vitest ^1.0
- **Packages**: client, core, relay, bls, faucet, git-proxy, examples, sdk
- **Architecture doc**: \_bmad-output/planning-artifacts/architecture.md (3 epics, SDK pipeline)
- **Auth**: ILP payment validation, Schnorr signatures, EVM payment channels
- **APIs**: WebSocket (Nostr relay), HTTP (connector, BLS, faucet), blockchain RPC (Anvil)

### Key Finding

Project already has a mature Vitest-based test framework with extensive unit and E2E coverage. This is a backend protocol SDK — Playwright/Cypress browser testing is not applicable.
