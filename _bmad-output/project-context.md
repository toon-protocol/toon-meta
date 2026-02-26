---
project_name: 'crosstown'
user_name: 'Jonathan'
date: '2026-02-26'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'code_quality', 'workflow_rules', 'critical_rules']
status: 'complete'
rule_count: 148
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

**Core Technologies:**
- **Runtime:** Node.js ≥20
- **Language:** TypeScript ^5.3 (ES2022 target, ESNext modules, bundler resolution)
- **Package Manager:** pnpm 8.15.0
- **Module System:** ESM-only (`"type": "module"` in all packages)

**Build & Development:**
- **Build Tool:** tsup ^8.0
- **Linting:** ESLint ^9.0 (flat config) with typescript-eslint (strict + stylistic)
- **Formatting:** Prettier ^3.2
- **Testing:** Vitest ^1.0

**Key Dependencies:**
- **Nostr:** nostr-tools ^2.20.0
- **TOON Format:** @toon-format/toon ^1.0
- **Database:** better-sqlite3 ^11.0
- **WebSockets:** ws ^8.0
- **Web Framework:** hono ^4.0
- **Ethereum:** viem ^2.0
- **ILP Connector:** @agent-society/connector ^1.2.0 (peer dependency, optional)

**TypeScript Compiler Options (Critical):**
- `strict: true` — All strict checks enabled
- `noUncheckedIndexedAccess: true` — Index access returns `T | undefined`
- `noImplicitOverride: true` — Must use `override` keyword
- `noPropertyAccessFromIndexSignature: true` — Use bracket notation for index signatures
- `moduleResolution: "bundler"` — Modern resolution for tsup/esbuild

**Version Constraints:**
- Node.js 24.x for local development (24.6.0 on Darwin)
- nostr-tools must stay at 2.x (breaking changes in 3.x)
- TOON format is 1.x (critical for relay compatibility)

## Critical Implementation Rules

### Language-Specific Rules (TypeScript)

**Type Safety:**
- **Never use `any` type** — Use `unknown` with type guards instead (enforced by ESLint)
- **Always use consistent type imports** — `import type { Foo } from './types.js'` (ESLint rule: `@typescript-eslint/consistent-type-imports`)
- **Index access returns `T | undefined`** — Due to `noUncheckedIndexedAccess`, always handle undefined when accessing arrays/objects by index
- **Use bracket notation for index signatures** — Due to `noPropertyAccessFromIndexSignature`, use `obj['key']` not `obj.key` for index signature types

**Import/Export Patterns:**
- **Always use `.js` extensions in imports** — ESM requires explicit extensions: `import { foo } from './bar.js'` (not `.ts`)
- **Export all public APIs from package `index.ts`** — Every package must export its public interface through `src/index.ts`
- **Use structural typing for cross-package interfaces** — Suffix with `Like` (e.g., `ConnectorNodeLike`, `ConnectorAdminLike`) to keep peer dependencies optional
- **No re-exporting types from `nostr-tools`** — Use nostr-tools types directly, don't redefine

**Error Handling:**
- **Use custom error classes from `@crosstown/core`** — `CrosstownError`, `InvalidEventError`, `PeerDiscoveryError`, `SpspError`, `SpspTimeoutError`
- **All async operations must handle errors** — No unhandled promise rejections
- **Validate external data at boundaries** — Always validate Nostr event signatures before processing

**TOON Format Handling (Critical):**
- **Events are TOON strings, not JSON objects** — The relay returns TOON format strings in EVENT messages
- **Use DI for TOON codecs** — Pass encoder/decoder as config callbacks to avoid circular dependencies
- **Never assume JSON.parse will work on event data** — Must use TOON decoder

### Framework-Specific Rules

**Nostr (nostr-tools):**
- **Always mock SimplePool in tests** — Never connect to live relays in unit or integration tests (use `vi.mock('nostr-tools')`)
- **Validate event signatures before processing** — Never trust unsigned/unverified Nostr events
- **Use proper event kinds** — Kind 10032 (ILP Peer Info), Kind 23194 (SPSP Request), Kind 23195 (SPSP Response)
- **NIP-44 encryption for SPSP** — SPSP request/response use NIP-44 encrypted DMs to protect shared secrets
- **SimplePool `ReferenceError: window is not defined` is non-fatal** — This error appears in Node.js but doesn't break functionality

**Hono (Web Framework):**
- **BLS uses Hono for HTTP endpoints** — Business Logic Server exposes HTTP API using `@hono/node-server`
- **CORS enabled by default** — BLS accepts cross-origin requests
- **JSON and TOON responses** — API endpoints return both JSON metadata and TOON-encoded events

**SQLite (better-sqlite3):**
- **In-memory for unit tests** — Use `:memory:` database for fast, isolated tests
- **File-based for integration tests** — Use temporary file paths for integration testing
- **Synchronous API** — better-sqlite3 uses sync methods, no need for async/await
- **Proper cleanup** — Always call `db.close()` in test teardown or finally blocks

**ILP Connector Integration:**
- **@agent-society/connector is an optional peer dependency** — Not required for core/relay packages
- **Use structural typing (`*Like` interfaces)** — `ConnectorNodeLike`, `ConnectorAdminLike`, `ConnectorChannelLike` for loose coupling
- **Bootstrap requires connector** — BootstrapService needs a connector instance to function

### Testing Rules

**Test Organization:**
- **Co-locate unit tests** — `*.test.ts` files next to source files in same directory
- **Integration tests in `__integration__/`** — Multi-component tests go in `packages/*/src/__integration__/`
- **E2E tests use separate config** — `vitest.e2e.config.ts` for end-to-end tests (e.g., `packages/client/tests/e2e/`)
- **Test file naming** — Match source file name with `.test.ts` suffix (e.g., `BusinessLogicServer.test.ts`)

**Test Framework (Vitest):**
- **Use Vitest built-in mocking** — `vi.fn()`, `vi.mock()`, `vi.spyOn()` (not jest)
- **Follow AAA pattern** — Arrange, Act, Assert structure in all tests
- **Use describe/it blocks** — Group related tests with `describe()`, individual tests with `it()`
- **Async test handling** — Use `async` functions, properly await all promises

**Mock Usage:**
- **Always mock SimplePool** — Use `vi.mock('nostr-tools')` to prevent live relay connections
- **Mock external dependencies** — HTTP clients, file system, network calls must be mocked in unit tests
- **Factory functions for test data** — Create helper functions for generating valid test events with proper signatures
- **In-memory databases for unit tests** — Use SQLite `:memory:` for isolated, fast tests

**Test Coverage:**
- **Target >80% line coverage** — Especially for core and BLS packages
- **All public methods must have tests** — Every exported function/class needs unit tests
- **Edge cases and error conditions** — Test failure paths, boundary conditions, invalid inputs
- **Integration tests for bootstrap flows** — Multi-peer bootstrap scenarios require integration tests

**Critical Testing Rules:**
- **No live relays in CI** — Tests must pass without external network dependencies
- **Cleanup resources in teardown** — Close database connections, clear mocks with `vi.clearAllMocks()`
- **Test isolation** — Each test should be independent, no shared state between tests
- **Deterministic test data** — Use fixed timestamps, keys, and IDs (not random values)

### Code Quality & Style Rules

**ESLint Configuration:**
- **Flat config format** — Using ESLint 9.x flat config (`eslint.config.js`)
- **TypeScript strict rules** — `@typescript-eslint/strict` and `@typescript-eslint/stylistic` configs
- **No explicit `any`** — `@typescript-eslint/no-explicit-any: 'error'`
- **Unused vars pattern** — Prefix with underscore: `{ argsIgnorePattern: '^_', varsIgnorePattern: '^_' }`
- **Consistent type imports** — `@typescript-eslint/consistent-type-imports` with `prefer: 'type-imports'`
- **No explicit return types** — `@typescript-eslint/explicit-function-return-type: 'off'` (rely on inference)

**Prettier Configuration:**
- **Semi-colons:** Required (`semi: true`)
- **Quotes:** Single quotes (`singleQuote: true`)
- **Tab Width:** 2 spaces (`tabWidth: 2`)
- **Trailing Commas:** ES5 style (`trailingComma: 'es5'`)
- **Line Width:** 80 characters (`printWidth: 80`)
- **Bracket Spacing:** Enabled (`bracketSpacing: true`)
- **Arrow Parens:** Always (`arrowParens: 'always'`)
- **Line Endings:** LF (`endOfLine: 'lf'`)

**Naming Conventions:**
- **Files (source):** PascalCase for classes, kebab-case for utilities (`BusinessLogicServer.ts`, `credit-limit.ts`)
- **Files (test):** Match source with `.test.ts` suffix (`BusinessLogicServer.test.ts`)
- **Classes:** PascalCase (`SocialPeerDiscovery`)
- **Interfaces:** PascalCase, no `I-` prefix (`IlpPeerInfo`, `HandlePacketRequest`)
- **Functions:** camelCase (`discoverPeers`, `createCrosstownNode`)
- **Constants:** UPPER_SNAKE_CASE (`ILP_PEER_INFO_KIND`, `SPSP_REQUEST_KIND`)
- **Type aliases:** PascalCase (`TrustScore`, `BootstrapPhase`)
- **Event types:** Discriminated unions with `type` field (`BootstrapEvent`)

**Code Organization:**
- **Monorepo structure** — Packages in `packages/*/` directory
- **Index exports** — All public APIs exported from `packages/*/src/index.ts`
- **Type definitions** — Define types in `types.ts` or alongside implementation
- **Constants file** — Event kinds and constants in `constants.ts`
- **Error classes** — Custom errors in `errors.ts`

**Documentation:**
- **JSDoc for public APIs** — Document exported functions, classes, and interfaces
- **Inline comments for complex logic** — Explain non-obvious implementation details
- **No redundant comments** — Don't comment obvious code

### Development Workflow Rules

**Git/Repository:**
- **Main branch:** `main` (default for PRs)
- **Monorepo with pnpm workspaces** — All packages managed together
- **Conventional commits recommended** — Use prefixes: `feat:`, `fix:`, `docs:`, `test:`
- **Co-authored commits for AI assistance** — Add `Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>` when AI helps
- **Descriptive commit messages** — Focus on "why" not just "what"

**Build & Scripts:**
- **Build all packages:** `pnpm build` (runs `pnpm -r run build` recursively)
- **Test all packages:** `pnpm test` (Vitest)
- **Test with coverage:** `pnpm test:coverage`
- **Lint codebase:** `pnpm lint`
- **Format code:** `pnpm format` (write), `pnpm format:check` (check only)
- **Package-level scripts:** Each package has its own `build`, `test`, `dev` scripts

**Deployment:**
- **Docker Compose for local deployment** — Multiple compose files for different setups
- **Genesis node:** `docker compose -p crosstown-genesis -f docker-compose-read-only-git.yml up -d`
- **Peer nodes:** `./deploy-peers.sh <count>` script for automated peer deployment
- **Port allocation:** Genesis (BLS: 3100, Relay: 7100), Peers (BLS: 3100+N*10, Relay: 7100+N*10)

**Contract Deployment (Anvil):**
- **Deterministic addresses** — Anvil deployment produces consistent contract addresses
- **AGENT Token:** `0x5FbDB2315678afecb367f032d93F642f64180aa3`
- **Registry:** `0xe7f1725e7734ce288f8367e1bb143e90bb3f0512`
- **Deployer Account:** `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` (Anvil Account #0)

**CI/CD:**
- **GitHub Actions** — Runs `pnpm test` on PRs
- **npm audit** — Security checks in CI
- **No live relays** — Tests must pass without external network dependencies

### Critical Don't-Miss Rules

**Anti-Patterns to Avoid:**
- **❌ NEVER use `any` type** — Use `unknown` with type guards (enforced by ESLint)
- **❌ NEVER assume events are JSON** — Relay returns TOON format strings, not JSON objects
- **❌ NEVER connect to live relays in tests** — Always mock SimplePool (use `vi.mock('nostr-tools')`)
- **❌ NEVER skip event signature validation** — Always verify Nostr event signatures before processing
- **❌ NEVER import from peer dependencies directly** — Use structural `*Like` types for cross-package interfaces
- **❌ NEVER use relative imports without `.js` extension** — ESM requires explicit extensions
- **❌ NEVER assume index access is safe** — Due to `noUncheckedIndexedAccess`, always handle `undefined`
- **❌ NEVER use property access on index signatures** — Use bracket notation `obj['key']` not `obj.key`

**Critical Edge Cases:**
- **SimplePool `window is not defined` error is non-fatal** — This ReferenceError appears in Node.js but doesn't break functionality
- **SPSP shared secrets must be encrypted** — Use NIP-44 encryption for SPSP request/response (kinds 23194/23195)
- **Payment amounts must match TOON length** — `publishEvent` amount = `basePricePerByte * toonData.length` (not hardcoded)
- **Relay WebSocket returns TOON strings** — EVENT messages contain TOON strings, not JSON objects
- **Channel nonce conflicts require retry** — Payment channel operations may need retry logic for blockchain transaction conflicts

**Security Rules:**
- **Validate all Nostr event signatures** — Never trust unsigned/unverified events
- **Encrypt sensitive data in SPSP** — SPSP parameters contain shared secrets, must use NIP-44 encryption
- **No secrets in static events** — Don't publish shared secrets as plaintext in kind:10047 (use encrypted request/response)
- **Sanitize user inputs** — Validate and sanitize all external data at boundaries
- **Proper key management** — Private keys for testing only (Anvil deterministic accounts)

**Performance Gotchas:**
- **SQLite synchronous API** — better-sqlite3 blocks the event loop, don't use for high-frequency operations
- **TOON encoding overhead** — TOON format has encoding/decoding cost, cache parsed results when possible
- **WebSocket connection limits** — SimplePool manages connections, don't create multiple pools
- **In-memory stores for unit tests** — Use `:memory:` SQLite for fast tests, file-based only for integration
- **Circular dependency with TOON codecs** — Use DI (pass encoder/decoder as config callbacks) to avoid circular deps

**Architecture-Specific Gotchas:**
- **TOON is the native format** — Events are stored and served as TOON throughout the stack
- **Pay to write, free to read** — Relay gates EVENT writes with ILP micropayments, REQ/EOSE are free
- **Discovery ≠ Peering** — RelayMonitor discovers peers but doesn't auto-peer; use `peerWith()` explicitly
- **Bootstrap creates payment channels** — When settlement is enabled, bootstrap flow automatically opens channels
- **Genesis node ports differ from peers** — Genesis uses base ports (3100, 7100), peers use offset (3100+N*10)

---

## Usage Guidelines

**For AI Agents:**
- Read this file before implementing any code
- Follow ALL rules exactly as documented
- When in doubt, prefer the more restrictive option
- Update this file if new patterns emerge

**For Humans:**
- Keep this file lean and focused on agent needs
- Update when technology stack changes
- Review quarterly for outdated rules
- Remove rules that become obvious over time

Last Updated: 2026-02-26
