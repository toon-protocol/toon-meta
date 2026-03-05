---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-03-03'
inputDocuments:
  - docs/prd/index.md
  - docs/prd/1-goals-and-background-context.md
  - docs/prd/2-requirements.md
  - docs/prd/3-technical-assumptions.md
  - docs/prd/6-checklist-results-report.md
  - docs/prd/7-next-steps.md
  - docs/brief.md
  - docs/architecture/index.md
  - docs/architecture/1-introduction.md
  - docs/architecture/2-high-level-architecture.md
  - docs/architecture/3-tech-stack.md
  - docs/architecture/4-data-models.md
  - docs/architecture/5-components.md
  - docs/architecture/6-external-apis.md
  - docs/architecture/7-core-workflows.md
  - docs/architecture/8-database-schema.md
  - docs/architecture/9-source-tree.md
  - docs/architecture/10-infrastructure-and-deployment.md
  - docs/architecture/11-error-handling-strategy.md
  - docs/architecture/12-coding-standards.md
  - docs/architecture/13-test-strategy-and-standards.md
  - docs/architecture/14-security.md
  - docs/architecture/crosstown-service-protocol.md
  - _bmad-output/project-context.md
  - _bmad-output/planning-artifacts/epics.md
workflowType: 'architecture'
project_name: 'crosstown'
user_name: 'Jonathan'
date: '2026-03-03'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
The SDK epics introduce 24 FRs organized across three domains:

- **TOON Codec Prerequisite (FR-SDK-0, 1 FR):** Extract TOON encoder, decoder, and shallow parser to @crosstown/core
- **SDK Core (FR-SDK-1 to FR-SDK-NEW-1, 14 FRs):** Node composition, handler registry, TOON-native context, signature verification, pricing validation, PaymentHandler bridge, connector lifecycle, network discovery, dev mode, unified identity
- **NIP-34 Git Forge (FR-NIP34-1 to FR-NIP34-6, 6 FRs):** Git HTTP backend, pubkey-native identity, read-only web UI, PR lifecycle, relay-sourced issues/PRs, package publishing
- **Relay Publishing (FR-RELAY-1, 1 FR):** Publish @crosstown/town package

These build on the existing 66 FRs from the PRD (Epics 1-17), with the SDK replacing the manual composition patterns from Epics 5-10.

**Non-Functional Requirements:**
7 new NFRs (NFR-SDK-1 to NFR-SDK-7) supplement the existing 15:

- TypeScript strict mode, Node.js 24.x, ESM (consistent with existing)
- > 80% line coverage for public APIs (consistent)
- Developer integration time <30 minutes / ~10 lines of code (new — defines SDK ergonomics)
- Structural typing for ConnectorNode (consistent pattern)
- Minimal package dependencies (new — constrains SDK surface)
- Mocked tests with no live dependencies (consistent)

**Scale & Complexity:**

- Primary domain: Backend protocol SDK with web UI rendering
- Complexity level: High
- Estimated architectural components: 8 packages (sdk, town, rig, core, bls, relay, client, connector)
- Total stories: 24 across 3 epics (Epic 1: 12, Epic 2: 5, Epic 3: 12)
- Validation benchmark: SDK-based relay entrypoint targets <100 lines of handler logic vs ~300 lines in current `docker/src/entrypoint.ts`

### Technical Constraints & Dependencies

- **Must remain E2E compatible:** SDK-based relay must pass all existing genesis-bootstrap-with-channels tests
- **Connector structural typing:** SDK must NOT import `@crosstown/connector` directly. It accepts a `ConnectorNodeLike` at construction time, continuing the existing `*Like` interface pattern. This keeps the connector as an optional peer dependency.
- **TOON codec dependency:** The epics doc lists `@crosstown/relay` as an SDK dependency "for TOON codec" — this is architecturally incorrect. The TOON codec lives in `@crosstown/bls`. SDK depending on relay would create circular dependencies when `@crosstown/town` (built on SDK) provides relay functionality. **Resolution: SDK depends on `@crosstown/bls` for TOON codec, or the codec is extracted to `@crosstown/core` or a standalone package.**
- **System dependency for Rig:** `git` binary must be in PATH (child_process spawning)
- **No Go dependency:** Rig is pure TypeScript — mechanical template port from Forgejo's Go HTML
- **Crypto libraries:** @scure/bip39, @scure/bip32 for seed phrase identity derivation
- **Template engine:** EJS or Eta for Rig web UI rendering
- **HTTP framework:** Express or Fastify for Rig HTTP endpoints
- **Existing patterns preserved:** TOON DI via config callbacks, structural `*Like` types, ESM with .js extensions

### Cross-Cutting Concerns Identified

1. **Unified Identity:** Single secp256k1 key → Nostr pubkey + EVM address, derived from BIP-39 mnemonic via NIP-06 path. Affects SDK, Town, Rig, and all settlement operations.
2. **TOON Pipeline (correctness-critical ordering):** Raw TOON → shallow extract `{kind, pubkey, id, sig}` → Schnorr verify → route to handler → optional lazy `decode()`. This ordering is a correctness requirement, not just a performance optimization. Signature verification must operate on shallow-parsed fields from the serialized event bytes — decoding first and then verifying would trust the decode.
3. **Verification Pipeline:** Schnorr signature verification before handler dispatch, with dev mode bypass. Must work with shallow TOON parse data only (`id`, `pubkey`, `sig` + serialized event bytes).
4. **Pricing Abstraction:** Per-byte base + per-kind overrides + self-write bypass. SDK internalizes what BLS currently does manually.
5. **Transit Semantics:** `isTransit` flag determines fire-and-forget (intermediate hop) vs await (final hop) behavior in the PaymentHandler bridge.
6. **Dev Mode:** Cross-cutting toggle that skips verification, bypasses pricing, and enables verbose logging for local development.
7. **Lifecycle Management:** `start()`/`stop()` must coordinate connector, bootstrap, relay monitor, and handler teardown.
8. **Package Layering:** sdk depends on core+bls; town depends on sdk; rig depends on sdk+core. Circular dependencies must be avoided. The relay package remains a peer of sdk, not a dependency.

### Architectural Trade-offs Identified

1. **Rig relay-sourced data (dependency inversion):** The Rig has no local issue/PR database — it queries the relay for NIP-34 events at render time. This simplifies the Rig dramatically (no database migrations, no sync logic) but couples Rig issue/PR availability to relay availability. This is an explicit trade-off that should be acknowledged in the Rig's architecture.

### SDK Pipeline Test Strategy

The SDK introduces pipeline stages between connector and business logic. Each stage needs targeted testing:

| Level       | Scope                                                                           | What It Catches             |
| ----------- | ------------------------------------------------------------------------------- | --------------------------- |
| Unit        | HandlerRegistry routing (kind match, default fallback, F00 on no match)         | Dispatch correctness        |
| Unit        | Signature verification pipeline (valid/invalid/devMode skip)                    | Auth bypass bugs            |
| Unit        | Pricing validation (per-byte, per-kind, self-write bypass, F04 rejection)       | Payment logic errors        |
| Unit        | PaymentHandler bridge (isTransit fire-and-forget vs await)                      | Flow control bugs           |
| Integration | Full pipeline: TOON → shallow parse → verify → price → dispatch → accept/reject | Stage interaction bugs      |
| E2E         | Existing genesis-bootstrap test against SDK-built relay                         | Regression from replacement |

Lower test levels first — the E2E test catches regressions but unit tests catch them faster and tell you _where_.

## Starter Template Evaluation

### Primary Technology Domain

Backend protocol SDK (TypeScript/Node.js monorepo) — existing project.

### Starter Options Considered

**Decision: No starter template.** This is an existing project with established infrastructure. The architecture document (v0.1, 2026-02-05) established "no starter template" as a deliberate decision due to the specialized Nostr + ILP requirements.

### Existing Project Foundation

**Rationale:** The monorepo already has 7+ packages with consistent tooling. New packages (sdk, town, rig) follow the same patterns. No external starter provides value for this use case.

**Architectural Decisions Already Established:**

**Language & Runtime:**

- TypeScript ^5.3 (strict: true, noUncheckedIndexedAccess, noImplicitOverride)
- Node.js 24.x, ESM-only ("type": "module")
- moduleResolution: "bundler" for tsup/esbuild compatibility

**Build Tooling:**

- tsup ^8.0 for ESM library bundling
- pnpm workspaces for monorepo management
- tsconfig.json extending root config per package

**Testing Framework:**

- Vitest ^1.0 with co-located \*.test.ts files
- Integration tests in **integration**/ directories
- E2E tests in packages/client/tests/e2e/
- Mocked SimplePool — no live relay dependencies

**Code Quality:**

- ESLint 9.x (flat config) with typescript-eslint strict + stylistic
- Prettier 3.x (semi, singleQuote, tabWidth 2, trailingComma es5)
- No explicit `any` — use `unknown` with type guards

**Code Organization:**

- packages/\*/src/index.ts exports all public APIs
- PascalCase files for classes, kebab-case for utilities
- Constants in UPPER_SNAKE_CASE
- Structural `*Like` types for cross-package interfaces

**New Package Setup Pattern:**
Each new package (sdk, town, rig) will be initialized with:

1. Directory in packages/
2. package.json with "type": "module", workspace dependencies
3. tsconfig.json extending root
4. tsup.config.ts for ESM build
5. src/index.ts with public API exports

**New Dependencies for SDK Epics:**

| Dependency           | Package | Purpose                               |
| -------------------- | ------- | ------------------------------------- |
| @scure/bip39         | sdk     | BIP-39 mnemonic generation/validation |
| @scure/bip32         | sdk     | BIP-32 HD key derivation              |
| eta (or ejs)         | rig     | Template engine for web UI            |
| express (or fastify) | rig     | HTTP server for web UI + git backend  |

**Note:** Dependency versions should be verified at implementation time. The @scure libraries are from the same author as @noble/curves (used by nostr-tools), ensuring cryptographic consistency.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**

1. TOON codec extracted to @crosstown/core (unblocks SDK dependency graph)
2. SDK identity module location (unblocks Story 1.1)
3. PaymentHandler bridge pattern with isTransit semantics (unblocks Story 1.6)

**Important Decisions (Shape Architecture):** 4. Rig HTTP framework (Express) 5. Rig template engine (Eta) 6. Git backend approach (child_process + git binary) 7. Rig data strategy (pure relay query + SQLite for repo metadata)

**Deferred Decisions (Post-MVP):**

- Rig event caching layer (if relay latency becomes a UX problem)
- Rig offline mode (if needed)
- Multi-relay redundancy for Rig queries

### Decision 1: TOON Codec Location

| Attribute | Value                                                                                            |
| --------- | ------------------------------------------------------------------------------------------------ |
| Decision  | Extract TOON encoder/decoder to `@crosstown/core`                                                |
| Rationale | Avoids circular dependency: SDK → relay → SDK. Core is the shared foundation. Codec is ~100 LOC. |
| Affects   | SDK, BLS, relay (import path change), core (new @toon-format/toon dependency)                    |
| Version   | @toon-format/toon ^1.0 (existing, no change)                                                     |

### Decision 2: Rig HTTP Framework

| Attribute | Value                                                                                                                                                                           |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Decision  | Express ^5.2                                                                                                                                                                    |
| Rationale | Most mature ecosystem for template rendering, static files, and CGI-style git backend proxying. Eta integration is trivial. Express 5 is now the npm default with LTS timeline. |
| Affects   | Rig package only                                                                                                                                                                |
| Version   | express ^5.2, @types/express (latest)                                                                                                                                           |

### Decision 3: Rig Template Engine

| Attribute | Value                                                                                                                  |
| --------- | ---------------------------------------------------------------------------------------------------------------------- |
| Decision  | Eta ^4.5                                                                                                               |
| Rationale | TypeScript-native, faster than EJS, actively maintained, small bundle. Modern replacement for EJS by the same concept. |
| Affects   | Rig web UI rendering                                                                                                   |
| Version   | eta ^4.5                                                                                                               |

### Decision 4: Git Backend Approach

| Attribute  | Value                                                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Decision   | `child_process` + system `git` binary                                                                                                             |
| Rationale  | Battle-tested by Forgejo/GitLab/Gitea. Reliable for all git operations (init, am, merge, blame, http-backend). Epics doc specifies this approach. |
| Affects    | Rig package. System requirement: git must be in PATH.                                                                                             |
| Constraint | Rig startup must verify git availability and log version. Exit with clear error if missing.                                                       |

### Decision 5a: Rig Issue/PR Data Source

| Attribute | Value                                                                                                                          |
| --------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Decision  | Pure relay query at render time                                                                                                |
| Rationale | Simplest approach. No local state, no sync logic. Accepts trade-off that Rig issue/PR rendering depends on relay availability. |
| Affects   | Rig web UI pages (issues, PRs, comments)                                                                                       |
| Trade-off | Page load latency coupled to relay. Acknowledged. Can add caching layer later if needed.                                       |

### Decision 5b: Rig Repository Metadata Storage

| Attribute | Value                                                                                                                                     |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Decision  | SQLite via better-sqlite3                                                                                                                 |
| Rationale | Consistent with existing BLS pattern. Supports queries (list repos, filter by owner pubkey). Synchronous API fits request/response cycle. |
| Affects   | Rig package                                                                                                                               |
| Version   | better-sqlite3 ^11.0 (existing, no change)                                                                                                |

### Decision 6: Identity Module Location

| Attribute | Value                                                                                                                |
| --------- | -------------------------------------------------------------------------------------------------------------------- |
| Decision  | Identity functions in `@crosstown/sdk`                                                                               |
| Rationale | Identity is an SDK concern per Story 1.1. Town and Rig both depend on SDK, so no access issue. Keeps core unchanged. |
| Affects   | SDK package                                                                                                          |
| Version   | @scure/bip39 ^2.0, @scure/bip32 ^2.0                                                                                 |

### Decision Impact Analysis

**Implementation Sequence:**

1. Extract TOON codec to core (unblocks everything)
2. SDK identity module (Story 1.1, foundational)
3. SDK handler registry + context (Stories 1.2-1.3)
4. SDK verification + pricing pipelines (Stories 1.4-1.5)
5. SDK PaymentHandler bridge + createNode (Stories 1.6-1.7)
6. Town relay reimplementation (Epic 2, validates SDK)
7. Rig HTTP + git backend + web UI (Epic 3)

**Cross-Component Dependencies:**

- TOON codec extraction (Decision 1) → must complete before SDK development begins
- SDK identity (Decision 6) → used by Town and Rig for node identity
- Express + Eta (Decisions 2-3) → isolated to Rig, no cross-package impact
- SQLite for Rig metadata (Decision 5b) → same pattern as BLS, no new learning curve

## Implementation Patterns & Consistency Rules

### Critical Conflict Points Identified

9 areas where AI agents could make different choices for the new SDK/Town/Rig packages. All resolved below. Existing project-context rules (148 rules) remain in effect — these patterns supplement, not replace.

### SDK API Patterns

**Pattern 1: Handler Function Signature**

Handlers use void return with `ctx` methods. The handler calls `ctx.accept()` or `ctx.reject()` — it does not return a response object.

```typescript
// CORRECT
node.on(30617, async (ctx: HandlerContext) => {
  const event = ctx.decode();
  await processRepo(event);
  ctx.accept({ eventId: event.id });
});

// WRONG — do not return response objects
node.on(30617, async (ctx) => {
  return { accept: true, fulfillment: '...' };
});
```

**Pattern 2: Handler Registration Chaining**

Handler registration is chainable (builder pattern) for ergonomic node setup:

```typescript
// CORRECT — chainable
const node = createNode(config)
  .on(30617, repoHandler)
  .on(1617, patchHandler)
  .on(1621, issueHandler)
  .onDefault(rejectUnknown);

// ALSO CORRECT — sequential
const node = createNode(config);
node.on(30617, repoHandler);
node.on(1617, patchHandler);
node.onDefault(rejectUnknown);
```

**Pattern 3: Shallow TOON Parse Type**

The shallow parser extracts routing metadata without full decode. Standard return type in `@crosstown/core`:

```typescript
interface ToonRoutingMeta {
  kind: number;
  pubkey: string;
  id: string;
  sig: string;
  rawBytes: Uint8Array; // Original bytes for Schnorr verification
}
```

Location: `packages/core/src/toon/shallow-parse.ts` alongside the TOON codec.

**Pattern 4: Lifecycle Event Emission**

SDK uses typed callbacks (consistent with existing `BootstrapEvent` discriminated union pattern), NOT Node.js EventEmitter:

```typescript
// CORRECT — typed callback, string event name
node.on('bootstrap', (event: BootstrapEvent) => {
  if (event.type === 'phase-change') { ... }
});

// Handler registration uses number (kind), not string
node.on(30617, handler);  // This is handler registration, not event listener

// WRONG — do not use EventEmitter
node.emit('bootstrap', event);  // No EventEmitter
```

Disambiguation: `node.on(number, ...)` = handler registration. `node.on(string, ...)` = lifecycle event listener.

### SDK Error Types

**Pattern 5: Error Hierarchy**

All SDK errors extend `CrosstownError` from `@crosstown/core`:

```typescript
// New SDK error classes
class NodeError extends CrosstownError {} // Lifecycle: already started, already stopped
class HandlerError extends CrosstownError {} // Handler dispatch failures
class VerificationError extends CrosstownError {} // Schnorr verification failures
class PricingError extends CrosstownError {} // Payment validation failures
```

Error code mapping to ILP:

- `VerificationError` → ILP `F06` (unexpected payment)
- `PricingError` → ILP `F04` (insufficient amount)
- `HandlerError` → ILP `T00` (internal error)
- No matching handler → ILP `F00` (bad request)

### Rig Patterns

**Pattern 6: Express Route Organization**

Feature-based route files, one per domain:

```
packages/rig/src/routes/
├── repos.ts          # Repository list, tree, blob, blame
├── commits.ts        # Commit log, commit diff
├── issues.ts         # Issue list, issue detail, comments
├── pulls.ts          # PR list, PR detail, status
└── git-backend.ts    # git-http-backend CGI proxy (clone/fetch)
```

Each file exports an Express Router. Mounted in `app.ts`:

```typescript
app.use('/', repoRoutes);
app.use('/', commitRoutes);
app.use('/', issueRoutes);
app.use('/', pullRoutes);
app.use('/', gitBackendRoutes);
```

**Pattern 7: Eta Template Location & Naming**

```
packages/rig/views/
├── layout.eta                 # Shared HTML shell
├── repos/
│   ├── list.eta               # Repository list page
│   ├── tree.eta               # File tree view
│   ├── blob.eta               # File content view
│   └── blame.eta              # Blame view
├── commits/
│   ├── log.eta                # Commit history
│   └── diff.eta               # Commit diff view
├── issues/
│   ├── list.eta               # Issue list
│   └── detail.eta             # Issue with comments
├── pulls/
│   ├── list.eta               # PR list
│   └── detail.eta             # PR with status + comments
└── partials/
    ├── header.eta             # Navigation header
    ├── pubkey.eta             # Pubkey display (with kind:0 enrichment)
    └── pagination.eta         # Pagination component
```

Naming: kebab-case directories, kebab-case files, `.eta` extension.

**Pattern 8: Git Operations Module**

Stateless functions taking `repoPath` as a parameter. Located at `packages/rig/src/git/`:

```typescript
// packages/rig/src/git/operations.ts
export async function initRepo(repoPath: string, bare: boolean): Promise<void>;
export async function applyPatch(
  repoPath: string,
  patchContent: string
): Promise<void>;
export async function merge(
  repoPath: string,
  branch: string,
  authorPubkey: string
): Promise<void>;
export async function lsTree(
  repoPath: string,
  ref: string,
  path?: string
): Promise<TreeEntry[]>;
export async function showBlob(
  repoPath: string,
  ref: string,
  path: string
): Promise<string>;
export async function log(
  repoPath: string,
  ref: string,
  limit?: number
): Promise<CommitEntry[]>;
export async function diff(repoPath: string, sha: string): Promise<string>;
export async function blame(
  repoPath: string,
  ref: string,
  path: string
): Promise<BlameLine[]>;

// packages/rig/src/git/http-backend.ts
export function createGitHttpBackend(repoDir: string): express.RequestHandler;
```

All functions use `child_process.execFile` (not `exec`) for safety. Errors throw `RigError extends CrosstownError`.

**Pattern 9: Relay Query Functions**

Dedicated query module for Rig relay interactions:

```typescript
// packages/rig/src/relay/queries.ts
export async function queryIssues(
  pool: SimplePool,
  relayUrl: string,
  repoEventId: string
): Promise<NostrEvent[]>;
export async function queryPullRequests(
  pool: SimplePool,
  relayUrl: string,
  repoEventId: string
): Promise<NostrEvent[]>;
export async function queryComments(
  pool: SimplePool,
  relayUrl: string,
  parentEventId: string
): Promise<NostrEvent[]>;
export async function queryProfile(
  pool: SimplePool,
  relayUrl: string,
  pubkey: string
): Promise<NostrEvent | null>;
```

Returns decoded `NostrEvent` arrays (not TOON — the UI needs structured data). Uses `nostr-tools` SimplePool internally.

### Enforcement Guidelines

**All AI Agents MUST:**

1. Use `ctx.accept()`/`ctx.reject()` in handlers — never return response objects
2. Use `child_process.execFile` (not `exec`) for all git operations in the Rig
3. Place TOON shallow parse types in `@crosstown/core`, not SDK
4. Extend `CrosstownError` for all new error classes
5. Use feature-based route files for Rig Express routes
6. Follow existing project-context rules for all naming, imports, types, and testing

### Anti-Patterns

```typescript
// WRONG: any type
function handleEvent(ctx: any) { ... }

// WRONG: exec instead of execFile (command injection risk)
exec(`git log ${repoPath}`);

// WRONG: Full TOON decode before verification
const event = decodeToon(data);  // Decodes everything
verifyEvent(event);               // Trusts the decode
// CORRECT: Shallow parse → verify → then optional full decode

// WRONG: New error hierarchy disconnected from core
class SdkError extends Error { ... }  // Don't do this

// WRONG: Returning response from handler
node.on(1, async (ctx) => { return { accept: true }; });  // Use ctx.accept()
```

## Project Structure & Boundaries

### Modified Package: @crosstown/core (TOON codec extraction)

```
packages/core/src/
├── ... (existing modules unchanged)
├── toon/                          # NEW — extracted from @crosstown/bls
│   ├── index.ts                   # Re-exports encoder, decoder, shallow-parse
│   ├── encoder.ts                 # Nostr event → TOON bytes (moved from bls)
│   ├── decoder.ts                 # TOON bytes → Nostr event (moved from bls)
│   └── shallow-parse.ts           # NEW — ToonRoutingMeta extraction without full decode
```

### New Package: @crosstown/sdk (Epic 1)

```
packages/sdk/
├── package.json                   # ESM, peer dep on @crosstown/connector
├── tsconfig.json                  # Extends root
├── tsup.config.ts                 # ESM build
├── src/
│   ├── index.ts                   # Public API: createNode, identity fns, types
│   ├── types.ts                   # NodeConfig, ServiceNode, HandlerContext, StartResult
│   ├── errors.ts                  # NodeError, HandlerError, VerificationError, PricingError
│   ├── identity.ts                # Story 1.1: generateMnemonic, fromMnemonic, fromSecretKey
│   ├── identity.test.ts
│   ├── HandlerRegistry.ts         # Story 1.2: .on(kind), .onDefault(), kind routing
│   ├── HandlerRegistry.test.ts
│   ├── HandlerContext.ts          # Story 1.3: toon, kind, pubkey, amount, decode(), accept(), reject()
│   ├── HandlerContext.test.ts
│   ├── verification.ts            # Story 1.4: Schnorr pipeline using ToonRoutingMeta
│   ├── verification.test.ts
│   ├── pricing.ts                 # Story 1.5: per-byte, per-kind, self-write bypass
│   ├── pricing.test.ts
│   ├── PaymentHandlerBridge.ts    # Story 1.6: isTransit fire-and-forget vs await
│   ├── PaymentHandlerBridge.test.ts
│   ├── ServiceNode.ts             # Story 1.7: createNode(), start(), stop(), lifecycle
│   ├── ServiceNode.test.ts
│   └── __integration__/
│       └── full-pipeline.test.ts  # Integration: TOON → parse → verify → price → dispatch
```

### New Package: @crosstown/town (Epic 2)

```
packages/town/
├── package.json                   # Depends on @crosstown/sdk, @crosstown/core
├── tsconfig.json
├── tsup.config.ts
├── src/
│   ├── index.ts                   # Public API: startTown, TownConfig
│   ├── types.ts                   # TownConfig
│   ├── town.ts                    # startTown() — creates SDK node with relay handlers
│   ├── cli.ts                     # CLI entrypoint: npx @crosstown/town
│   ├── handlers/
│   │   ├── index.ts
│   │   ├── event-storage.ts       # Story 2.1: decode → store → accept
│   │   ├── event-storage.test.ts
│   │   ├── spsp-handshake.ts      # Story 2.2: decode → negotiate → channel → accept
│   │   └── spsp-handshake.test.ts
│   └── __integration__/
│       └── relay-sdk.test.ts      # Story 2.3: SDK-based relay E2E validation
├── Dockerfile                     # Docker image for container deployment
```

### New Package: @crosstown/rig (Epic 3)

```
packages/rig/
├── package.json                   # Depends on @crosstown/sdk, @crosstown/core, express, eta
├── tsconfig.json
├── tsup.config.ts
├── src/
│   ├── index.ts                   # Public API: startRig, RigConfig
│   ├── types.ts                   # RigConfig, TreeEntry, CommitEntry, BlameLine
│   ├── errors.ts                  # RigError extends CrosstownError
│   ├── rig.ts                     # startRig() — creates SDK node + Express app
│   ├── cli.ts                     # CLI entrypoint: npx @crosstown/rig
│   ├── app.ts                     # Express app setup, middleware, route mounting
│   ├── handlers/                  # NIP-34 ILP packet handlers (Story 3.1, 3.4)
│   │   ├── index.ts
│   │   ├── repo-announcement.ts   # kind:30617 → git init --bare
│   │   ├── repo-announcement.test.ts
│   │   ├── patch.ts               # kind:1617 → git am/apply
│   │   ├── patch.test.ts
│   │   ├── issue.ts               # kind:1621 → acknowledge (stored on relay)
│   │   ├── issue.test.ts
│   │   ├── comment.ts             # kind:1622 → acknowledge (stored on relay)
│   │   ├── comment.test.ts
│   │   ├── status.ts              # kinds 1630-1633 → PR lifecycle (Story 3.4)
│   │   └── status.test.ts
│   ├── git/                       # Git operations (Story 3.1)
│   │   ├── index.ts
│   │   ├── operations.ts          # initRepo, applyPatch, merge, lsTree, showBlob, log, diff, blame
│   │   ├── operations.test.ts
│   │   ├── http-backend.ts        # Express middleware: git-http-backend CGI proxy
│   │   └── http-backend.test.ts
│   ├── routes/                    # Express routes (Story 3.3, 3.5)
│   │   ├── repos.ts               # /{owner}/{repo}, tree, blob, blame
│   │   ├── commits.ts             # /{owner}/{repo}/commits, /commit/{sha}
│   │   ├── issues.ts              # /{owner}/{repo}/issues, /issues/{id}
│   │   ├── pulls.ts               # /{owner}/{repo}/pulls, /pulls/{id}
│   │   └── git-backend.ts         # /{owner}/{repo}.git/* (clone/fetch)
│   ├── relay/                     # Relay queries for UI data (Story 3.5)
│   │   ├── queries.ts             # queryIssues, queryPullRequests, queryComments, queryProfile
│   │   └── queries.test.ts
│   ├── identity/                  # Pubkey display (Story 3.2)
│   │   ├── pubkey-display.ts      # npub formatting, kind:0 profile enrichment
│   │   └── pubkey-display.test.ts
│   └── db/                        # Repository metadata SQLite (Decision 5b)
│       ├── schema.ts              # CREATE TABLE repos, indexes
│       ├── RepoMetadataStore.ts   # CRUD for repository metadata
│       └── RepoMetadataStore.test.ts
├── views/                         # Eta templates (Story 3.3, 3.5)
│   ├── layout.eta
│   ├── repos/
│   │   ├── list.eta
│   │   ├── tree.eta
│   │   ├── blob.eta
│   │   └── blame.eta
│   ├── commits/
│   │   ├── log.eta
│   │   └── diff.eta
│   ├── issues/
│   │   ├── list.eta
│   │   └── detail.eta
│   ├── pulls/
│   │   ├── list.eta
│   │   └── detail.eta
│   └── partials/
│       ├── header.eta
│       ├── pubkey.eta
│       └── pagination.eta
├── public/                        # Static assets (CSS, icons)
│   └── css/
│       └── style.css
├── Dockerfile                     # Docker image
```

### Architectural Boundaries

**Package Dependency Graph:**

```
@crosstown/core          ← foundation (TOON codec, types, bootstrap, discovery, SPSP)
    ↑
@crosstown/bls           ← payment validation, event storage, pricing
    ↑
@crosstown/sdk           ← developer-facing abstraction (identity, handlers, pipeline)
    ↑          ↑
@crosstown/town    @crosstown/rig    ← concrete service nodes
```

**Boundary Rules:**

- SDK imports core and bls — never relay directly
- Town and Rig import SDK — never core/bls directly (except core types)
- No package imports from town or rig (they are leaf nodes)
- Connector accessed only through `ConnectorNodeLike` structural type

**Data Flow (SDK Pipeline):**

```
ILP Packet → ConnectorNode.setPacketHandler()
  → PaymentHandlerBridge (isTransit check)
    → Shallow TOON parse (ToonRoutingMeta)
      → Schnorr verification (or devMode skip)
        → Pricing validation (or self-write bypass)
          → HandlerRegistry.dispatch(kind)
            → Handler(ctx) → ctx.accept()/reject()
              → HandlePacketResponse back to connector
```

### Requirements to Structure Mapping

| Epic/Story                          | Package | Primary Files                                                                              |
| ----------------------------------- | ------- | ------------------------------------------------------------------------------------------ |
| **Epic 1: SDK**                     |         |                                                                                            |
| Story 1.0: TOON codec extraction    | core    | `toon/encoder.ts`, `toon/decoder.ts`, `toon/shallow-parse.ts`                              |
| Story 1.1: Identity                 | sdk     | `identity.ts`                                                                              |
| Story 1.2: Handler Registry         | sdk     | `HandlerRegistry.ts`                                                                       |
| Story 1.3: HandlerContext           | sdk     | `HandlerContext.ts`                                                                        |
| Story 1.4: Verification             | sdk     | `verification.ts`                                                                          |
| Story 1.5: Pricing                  | sdk     | `pricing.ts`                                                                               |
| Story 1.6: PaymentHandler Bridge    | sdk     | `PaymentHandlerBridge.ts`                                                                  |
| Story 1.7: createNode + lifecycle   | sdk     | `ServiceNode.ts`                                                                           |
| Story 1.8: Connector methods        | sdk     | `ServiceNode.ts` (exposes connector)                                                       |
| Story 1.9: Bootstrap integration    | sdk     | `ServiceNode.ts` (wires BootstrapService)                                                  |
| Story 1.10: Dev mode                | sdk     | `verification.ts`, `pricing.ts`, `ServiceNode.ts`                                          |
| Story 1.11: Package setup           | sdk     | `package.json`, `index.ts`                                                                 |
| **Epic 2: Town**                    |         |                                                                                            |
| Story 2.1: Event storage handler    | town    | `handlers/event-storage.ts`                                                                |
| Story 2.2: SPSP handler             | town    | `handlers/spsp-handshake.ts`                                                               |
| Story 2.3: E2E validation           | client  | `tests/e2e/` (existing)                                                                    |
| Story 2.4: Remove git-proxy         | root    | Delete `packages/git-proxy/`                                                               |
| Story 2.5: Publish town             | town    | `town.ts`, `cli.ts`, `Dockerfile`                                                          |
| **Epic 3: Rig**                     |         |                                                                                            |
| Story 3.1: SDK node + repo creation | rig     | `handlers/repo-announcement.ts`, `git/operations.ts` (initRepo)                            |
| Story 3.2: Patch handler            | rig     | `handlers/patch.ts`, `git/operations.ts` (applyPatch)                                      |
| Story 3.3: Issue + comment handlers | rig     | `handlers/issue.ts`, `handlers/comment.ts`                                                 |
| Story 3.4: Git HTTP backend         | rig     | `git/http-backend.ts`, `routes/git-backend.ts`                                             |
| Story 3.5: Pubkey identity          | rig     | `identity/pubkey-display.ts`                                                               |
| Story 3.6: PR lifecycle             | rig     | `handlers/status.ts`                                                                       |
| Story 3.7: Layout + repo list       | rig     | `routes/repos.ts` (list), `views/layout.eta`, `views/repos/list.eta`                       |
| Story 3.8: File tree + blob view    | rig     | `routes/repos.ts` (tree/blob), `views/repos/tree.eta`, `views/repos/blob.eta`              |
| Story 3.9: Commit log + diff        | rig     | `routes/commits.ts`, `views/commits/log.eta`, `views/commits/diff.eta`                     |
| Story 3.10: Blame view              | rig     | `routes/repos.ts` (blame), `views/repos/blame.eta`                                         |
| Story 3.11: Issues/PRs from relay   | rig     | `relay/queries.ts`, `routes/issues.ts`, `routes/pulls.ts`, `views/issues/`, `views/pulls/` |
| Story 3.12: Publish rig             | rig     | `rig.ts`, `cli.ts`, `Dockerfile`                                                           |

### Cross-Cutting Concerns Location

| Concern                    | Where                                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------ |
| TOON codec + shallow parse | `packages/core/src/toon/`                                                                                    |
| Unified identity           | `packages/sdk/src/identity.ts`                                                                               |
| Error hierarchy            | `packages/core/src/errors.ts` (base), `packages/sdk/src/errors.ts` (SDK), `packages/rig/src/errors.ts` (Rig) |
| Bootstrap + discovery      | `packages/core/src/bootstrap/` (unchanged)                                                                   |
| Event types + builders     | `packages/core/src/events/` (unchanged)                                                                      |
| NIP-34 types               | `packages/core/src/nip34/` (existing, used by Rig)                                                           |

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
All 7 decisions are mutually compatible. Express ^5.2 + Eta ^4.5 integrate cleanly. TOON codec in core (Decision 1) unblocks the dependency graph without version conflicts. SQLite via better-sqlite3 for Rig repo metadata (Decision 5b) matches the existing BLS pattern. @scure/bip39 ^2.0 + @scure/bip32 ^2.0 share the secp256k1 curve implementation with nostr-tools' @noble/curves dependency — no cryptographic library conflicts.

**Pattern Consistency:**
All 9 implementation patterns align with their corresponding decisions. Pattern 3 (ToonRoutingMeta in core) supports Decision 1 (TOON codec in core). Pattern 6 (Express route organization) supports Decision 2. Pattern 8 (git operations via execFile) supports Decision 4. The handler signature pattern (void return + ctx methods) is consistently applied across all examples. Error hierarchy follows a clean tree from CrosstownError through SDK and Rig specializations.

**Structure Alignment:**
Package boundaries are well-defined. The dependency graph is acyclic. ConnectorNodeLike structural typing prevents direct connector imports. All 17 stories map to specific files within their designated packages. No file belongs to multiple stories (clean ownership).

### Requirements Coverage Validation ✅

**Epic/Feature Coverage (24 FRs):**

| FR Range                                            | Stories          | Architecture Support                                      |
| --------------------------------------------------- | ---------------- | --------------------------------------------------------- |
| FR-SDK-0 (1 FR)                                     | Story 1.0        | TOON codec extraction to `packages/core/src/toon/`        |
| FR-SDK-1 through FR-SDK-NEW-1 (14 FRs)              | Stories 1.1–1.11 | All mapped to specific files in `packages/sdk/src/`       |
| FR-SDK-14, FR-SDK-15, FR-SDK-16, FR-RELAY-1 (4 FRs) | Stories 2.1–2.5  | Covered by `packages/town/` + existing E2E suite          |
| FR-NIP34-1 through FR-NIP34-6 (6 FRs)               | Stories 3.1–3.12 | Covered by `packages/rig/` (handlers, git, routes, views) |

All 24 FRs have direct architectural support. No gaps in functional coverage.

**Cross-Epic Dependencies Handled:**

- TOON codec extraction (Epic 0 prerequisite) → enables all three epics
- SDK identity (Epic 1) → used by Town (Epic 2) and Rig (Epic 3)
- SDK handler registry (Epic 1) → consumed by Town and Rig handler implementations
- Implementation sequence (Decision Impact Analysis) explicitly orders these dependencies

**Non-Functional Requirements (7 NFRs):**

| NFR                           | Architectural Support                                                 |
| ----------------------------- | --------------------------------------------------------------------- |
| NFR-SDK-1: TypeScript strict  | Starter template: strict: true, noUncheckedIndexedAccess              |
| NFR-SDK-2: Node.js 24.x ESM   | Starter template: "type": "module"                                    |
| NFR-SDK-3: >80% coverage      | Co-located \*.test.ts files for every source file + integration tests |
| NFR-SDK-4: <30min integration | Pattern 2 (builder chaining) + createNode() ergonomics                |
| NFR-SDK-5: Structural typing  | ConnectorNodeLike pattern in types.ts                                 |
| NFR-SDK-6: Mocked tests       | Test strategy: mocked connectors, no live dependencies                |
| NFR-SDK-7: Minimal deps       | Decision 1 removes relay from SDK deps (TOON moves to core)           |

All 7 NFRs are architecturally addressed.

### Implementation Readiness Validation ✅

**Decision Completeness:**

- All 7 decisions include version numbers, rationale, and affected packages
- Decision Impact Analysis provides explicit implementation sequence
- Cross-component dependencies are mapped

**Structure Completeness:**

- 4 package structures fully defined (core modification + sdk + town + rig)
- Every story maps to specific files (Requirements to Structure Mapping table)
- Integration points specified (PaymentHandler bridge, ConnectorNodeLike, relay queries)

**Pattern Completeness:**

- 9 patterns with code examples (correct and incorrect)
- Anti-pattern section documents 5 common mistakes
- Enforcement guidelines provide 6 mandatory rules for AI agents
- Disambiguation rule for `node.on(number)` vs `node.on(string)` prevents the most likely confusion

### Gap Analysis Results

**No Critical Gaps.**

**Important Gaps Resolved:**

1. **SDK → BLS dependency clarified.** The cross-cutting concern #8 originally stated "sdk depends on core+bls" and the dependency graph showed a linear chain (core ← bls ← sdk). With TOON codec moved to core (Decision 1) and pricing created fresh in SDK (Story 1.5), the SDK does not require BLS. The corrected dependency graph:

```
@crosstown/core          ← foundation (TOON codec, types, bootstrap, discovery, SPSP)
    ↑          ↑
@crosstown/bls    @crosstown/sdk    ← siblings, both depend on core
                      ↑
              ┌───────┴────────┐
@crosstown/town (+ bls)    @crosstown/rig
```

Town depends on SDK + BLS (for EventStore). Rig depends on SDK + core. SDK depends on core only.

2. **NFR-SDK-7 relay dependency superseded.** The epics doc lists `@crosstown/relay` as an SDK dependency "for TOON codec." Decision 1 moves TOON to core, making this stale. SDK's actual dependencies: `@crosstown/core`, `nostr-tools`, `@scure/bip39`, `@scure/bip32`. No relay or BLS dependency.

**Nice-to-Have Gaps Noted:**

3. **ConnectorNodeLike type definition** belongs in `packages/sdk/src/types.ts` alongside NodeConfig and ServiceNode.

4. **Rig git-http-backend is read-only** (clone/fetch only). Write operations go through ILP-gated NIP-34 events, not git HTTP push. This is architecturally correct but an explicit note prevents implementation confusion.

### Architecture Completeness Checklist

**✅ Requirements Analysis**

- [x] Project context thoroughly analyzed (23 FRs, 7 NFRs, 148 existing AI rules)
- [x] Scale and complexity assessed (3 epics, 24 stories, 8 packages)
- [x] Technical constraints identified (TOON dependency, connector structural typing, system git)
- [x] Cross-cutting concerns mapped (8 concerns)

**✅ Architectural Decisions**

- [x] Critical decisions documented with versions (7 decisions)
- [x] Technology stack fully specified (Express 5.2, Eta 4.5, better-sqlite3 11, @scure/\* 2.0)
- [x] Integration patterns defined (PaymentHandler bridge, ConnectorNodeLike, relay queries)
- [x] Performance considerations addressed (shallow TOON parse, lazy decode, relay query trade-off)

**✅ Implementation Patterns**

- [x] Naming conventions established (follows existing project-context 148 rules)
- [x] Structure patterns defined (9 patterns with code examples)
- [x] Communication patterns specified (handler context, lifecycle events, error hierarchy)
- [x] Process patterns documented (anti-patterns, enforcement guidelines)

**✅ Project Structure**

- [x] Complete directory structure defined (4 packages, all files listed)
- [x] Component boundaries established (dependency graph, boundary rules)
- [x] Integration points mapped (requirements to structure mapping)
- [x] Requirements to structure mapping complete (24 stories → specific files)

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High — all FRs covered, all NFRs addressed, no critical gaps, coherent decisions

**Key Strengths:**

- Clean dependency graph with no circular dependencies
- Every story maps to specific files (implementation agents won't guess)
- 9 patterns with code examples prevent style divergence
- TOON pipeline ordering explicitly documented as a correctness requirement
- Party Mode feedback (codec dependency, shallow parse ordering, test strategy) integrated

**Areas for Future Enhancement:**

- Rig event caching layer (deferred until relay latency becomes a UX problem)
- Multi-relay redundancy for Rig queries
- Rig offline mode

### Implementation Handoff

**AI Agent Guidelines:**

- Follow all architectural decisions exactly as documented with specified versions
- Use implementation patterns consistently across all components
- Respect project structure and package boundaries (no circular imports)
- Refer to this document for all architectural questions
- Existing project-context rules (148 rules) remain in full effect

**First Implementation Priority:**

1. Extract TOON codec to `@crosstown/core` (unblocks all three epics)
2. SDK identity module — Story 1.1 (`packages/sdk/src/identity.ts`)
3. SDK handler registry + context — Stories 1.2–1.3
4. Continue per Decision Impact Analysis sequence
