---
project_name: 'crosstown'
user_name: 'Jonathan'
date: '2026-03-05'
sections_completed:
  [
    'technology_stack',
    'language_rules',
    'framework_rules',
    'testing_rules',
    'code_quality',
    'workflow_rules',
    'critical_rules',
  ]
status: 'complete'
rule_count: 196
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

**Core Technologies:**

- **Runtime:** Node.js >=20 (24.x for local development)
- **Language:** TypeScript ^5.3 (ES2022 target, ESNext modules, bundler resolution)
- **Package Manager:** pnpm 8.15.0
- **Module System:** ESM-only (`"type": "module"` in all packages)

**Build & Development:**

- **Build Tool:** tsup ^8.0 (ESM output, dts generation, sourcemaps)
- **Linting:** ESLint ^9.0 (flat config) with typescript-eslint (strict + stylistic)
- **Formatting:** Prettier ^3.2
- **Testing:** Vitest ^1.0

**Key Dependencies:**

- **Nostr:** nostr-tools ^2.20.0
- **TOON Format:** @toon-format/toon ^1.0 (in @crosstown/core)
- **Cryptography:** @noble/curves ^2.0 (secp256k1 Schnorr), @noble/hashes ^2.0 (keccak, sha3)
- **Identity:** @scure/bip39 ^2.0 (mnemonic), @scure/bip32 ^2.0 (HD derivation)
- **Database:** better-sqlite3 ^11.0
- **WebSockets:** ws ^8.0
- **Web Framework:** hono ^4.0 (BLS HTTP API)
- **Ethereum:** viem ^2.0 (client package)
- **ILP Connector:** @agent-society/connector ^1.2.0 (optional peer dependency)

**TypeScript Compiler Options (Critical):**

- `strict: true` -- All strict checks enabled
- `noUncheckedIndexedAccess: true` -- Index access returns `T | undefined`
- `noImplicitOverride: true` -- Must use `override` keyword
- `noPropertyAccessFromIndexSignature: true` -- Use bracket notation for index signatures
- `moduleResolution: "bundler"` -- Modern resolution for tsup/esbuild

**Version Constraints:**

- nostr-tools must stay at 2.x (breaking changes in 3.x)
- TOON format is 1.x (critical for relay compatibility)
- @noble/curves and @scure libraries share the same secp256k1 implementation as nostr-tools' @noble/curves dependency

## Project Structure (Post-Epic 1)

```
crosstown/
├── packages/
│   ├── sdk/          # @crosstown/sdk -- SDK for building ILP-gated Nostr services (Epic 1 deliverable)
│   ├── core/         # @crosstown/core -- Shared protocol logic, TOON codec, bootstrap, discovery, SPSP
│   ├── bls/          # @crosstown/bls -- Business Logic Server (payment validation, event storage)
│   ├── relay/        # @crosstown/relay -- Nostr relay + TOON encoding
│   ├── client/       # @crosstown/client -- Client SDK with payment channel support
│   ├── faucet/       # @crosstown/faucet -- Token distribution for testing (plain JS)
│   ├── examples/     # @crosstown/examples -- Demo applications
│   ├── rig/          # @crosstown/rig -- (placeholder, Epic 3, not yet implemented)
│   └── town/         # @crosstown/town -- (placeholder, Epic 2, not yet implemented)
├── docker/           # Container entrypoint (pnpm workspace member)
├── deploy-genesis-node.sh
└── deploy-peers.sh
```

**Package Dependency Graph:**

```
@crosstown/core          <-- foundation (TOON codec, types, bootstrap, discovery, SPSP)
    ^          ^
@crosstown/bls    @crosstown/sdk    <-- siblings, both depend on core
                      ^
              +-------+--------+
@crosstown/town (+ bls)    @crosstown/rig    <-- (future, Epic 2 & 3)
```

**Boundary Rules:**

- SDK imports core only -- never relay or bls directly
- Town and Rig import SDK -- never core/bls directly (except core types)
- No package imports from town or rig (they are leaf nodes)
- Connector accessed only through `EmbeddableConnectorLike` structural type

## @crosstown/sdk (Epic 1 -- Complete)

The SDK is the main deliverable of Epic 1. It provides a developer-facing abstraction for building ILP-gated Nostr services with the Crosstown protocol.

**SDK Source Files:**

```
packages/sdk/src/
├── index.ts                    # Public API exports
├── identity.ts                 # generateMnemonic(), fromMnemonic(), fromSecretKey()
├── errors.ts                   # IdentityError, NodeError, HandlerError, VerificationError, PricingError
├── handler-registry.ts         # HandlerRegistry: .on(kind), .onDefault(), dispatch()
├── handler-context.ts          # HandlerContext: toon, kind, pubkey, amount, decode(), accept(), reject()
├── verification-pipeline.ts    # Schnorr verification (or devMode skip)
├── pricing-validator.ts        # Per-byte, per-kind pricing with self-write bypass
├── payment-handler-bridge.ts   # isTransit fire-and-forget vs await semantics
├── create-node.ts              # createNode() composition + ServiceNode lifecycle
├── event-storage-handler.ts    # Stub -- for Epic 2 (Town)
├── spsp-handshake-handler.ts   # Stub -- for Epic 2 (Town)
└── __integration__/
    ├── create-node.test.ts
    └── network-discovery.test.ts
```

**SDK Public API:**

```typescript
// Identity
generateMnemonic(): string
fromMnemonic(mnemonic: string, options?: FromMnemonicOptions): NodeIdentity
fromSecretKey(secretKey: Uint8Array): NodeIdentity

// Node composition
createNode(config: NodeConfig): ServiceNode

// ServiceNode interface
interface ServiceNode {
  pubkey: string;
  evmAddress: string;
  connector: EmbeddableConnectorLike;
  channelClient: ConnectorChannelClient | null;
  on(kind: number, handler: Handler): ServiceNode;        // handler registration
  on(event: 'bootstrap', listener: BootstrapEventListener): ServiceNode;  // lifecycle
  onDefault(handler: Handler): ServiceNode;
  start(): Promise<StartResult>;
  stop(): Promise<void>;
  peerWith(pubkey: string): Promise<void>;
}
```

**SDK Pipeline (Packet Processing Order):**

```
ILP Packet -> ConnectorNode.setPacketHandler()
  -> Size limit check (1MB base64)
    -> Shallow TOON parse (ToonRoutingMeta)
      -> Schnorr signature verification (or devMode skip)
        -> Pricing validation (or self-write bypass, or devMode skip)
          -> HandlerRegistry.dispatch(kind)
            -> Handler(ctx) -> ctx.accept()/ctx.reject()
              -> HandlePacketResponse back to connector
```

## Critical Implementation Rules

### Language-Specific Rules (TypeScript)

**Type Safety:**

- **Never use `any` type** -- Use `unknown` with type guards instead (enforced by ESLint)
- **Always use consistent type imports** -- `import type { Foo } from './types.js'` (ESLint rule: `@typescript-eslint/consistent-type-imports`)
- **Index access returns `T | undefined`** -- Due to `noUncheckedIndexedAccess`, always handle undefined when accessing arrays/objects by index
- **Use bracket notation for index signatures** -- Due to `noPropertyAccessFromIndexSignature`, use `obj['key']` not `obj.key` for index signature types

**Import/Export Patterns:**

- **Always use `.js` extensions in imports** -- ESM requires explicit extensions: `import { foo } from './bar.js'` (not `.ts`)
- **Export all public APIs from package `index.ts`** -- Every package must export its public interface through `src/index.ts`
- **Use structural typing for cross-package interfaces** -- Suffix with `Like` (e.g., `EmbeddableConnectorLike`, `ConnectorNodeLike`, `ConnectorAdminLike`) to keep peer dependencies optional
- **No re-exporting types from `nostr-tools`** -- Use nostr-tools types directly, don't redefine
- **Core sub-path exports** -- `@crosstown/core/toon` and `@crosstown/core/nip34` are valid import paths (configured in core's package.json `exports`)

**Error Handling:**

- **Core errors:** `CrosstownError` (base), `InvalidEventError`, `PeerDiscoveryError`, `SpspError`, `SpspTimeoutError`
- **SDK errors (extend CrosstownError):** `IdentityError`, `NodeError`, `HandlerError`, `VerificationError`, `PricingError`
- **Error code mapping to ILP:** VerificationError -> F06, PricingError -> F04, HandlerError -> T00, No handler -> F00
- **All async operations must handle errors** -- No unhandled promise rejections
- **Validate external data at boundaries** -- Always validate Nostr event signatures before processing

**TOON Format Handling (Critical):**

- **TOON codec lives in `@crosstown/core/toon`** -- Extracted from BLS as part of Epic 1 Story 1.0
- **Functions:** `encodeEventToToon()`, `decodeEventFromToon()`, `shallowParseToon()`
- **ToonRoutingMeta** -- Shallow parse returns `{ kind, pubkey, id, sig, rawBytes }` without full decode
- **Events are TOON strings, not JSON objects** -- The relay returns TOON format strings in EVENT messages
- **SDK defaults TOON codec from core** -- `createNode()` defaults to core's encoder/decoder, config can override
- **Never assume JSON.parse will work on event data** -- Must use TOON decoder

### SDK-Specific Rules

**Handler Pattern:**

- **Handlers use void return with `ctx` methods** -- Call `ctx.accept()` or `ctx.reject()`, do NOT return response objects
- **Handler signature:** `(ctx: HandlerContext) => Promise<HandlerResponse>`
- **Handler registration is chainable** -- `createNode(config).on(kind1, h1).on(kind2, h2).onDefault(hd)`
- **`node.on(number, ...)` = handler registration, `node.on(string, ...)` = lifecycle event listener** -- Disambiguated by first argument type

**Identity Module:**

- **NIP-06 derivation path:** `m/44'/1237'/0'/0/{accountIndex}`
- **Unified identity:** Single secp256k1 key produces both Nostr pubkey (x-only Schnorr BIP-340) and EVM address (Keccak-256)
- **Seed zeroing:** `fromMnemonic()` zeros intermediate seed bytes in a `finally` block (best-effort, JS has no secure-erase)
- **Defensive copy:** `fromSecretKey()` and `fromMnemonic()` return a copy of the secret key to prevent external mutation

**Verification Pipeline:**

- **Shallow parse FIRST, verify SECOND** -- Signature verification must operate on shallow-parsed fields from the serialized event bytes. Decoding first and then verifying would trust the decode.
- **Schnorr verify:** Uses `schnorr.verify(sigBytes, msgBytes, pubkeyBytes)` from `@noble/curves/secp256k1`
- **Dev mode skips verification entirely** -- Returns `{ verified: true }` immediately

**Pricing Validator:**

- **Per-byte base price** -- `requiredAmount = rawBytes.length * basePricePerByte` (default 10n per byte)
- **Per-kind overrides** -- `kindPricing` config allows custom pricing for specific event kinds
- **Self-write bypass** -- Events from the node's own pubkey are free (no pricing check)
- **Uses `Object.hasOwn()` for prototype-safe lookup** on kindPricing overrides

**createNode() Composition:**

- **Delegates to `createCrosstownNode()` from core** -- For bootstrap, relay monitor, and lifecycle wiring
- **Wires the full pipeline as `handlePacket` callback** -- Size check -> shallow parse -> verify -> price -> dispatch
- **Config-based handler registration** -- `config.handlers` and `config.defaultHandler` are alternatives to post-creation `.on()`
- **Max payload: 1MB base64** -- `MAX_PAYLOAD_BASE64_LENGTH = 1_048_576`, rejected before allocation (DoS mitigation)
- **Dev mode log sanitization** -- User-controlled fields (amount, destination) are sanitized to prevent log injection

### Framework-Specific Rules

**Nostr (nostr-tools):**

- **Always mock SimplePool in tests** -- Never connect to live relays in unit or integration tests (use `vi.mock('nostr-tools')`)
- **Validate event signatures before processing** -- Never trust unsigned/unverified Nostr events
- **Use proper event kinds** -- Kind 10032 (ILP Peer Info), Kind 23194 (SPSP Request), Kind 23195 (SPSP Response)
- **NIP-44 encryption for SPSP** -- SPSP request/response use NIP-44 encrypted DMs to protect shared secrets
- **SimplePool `ReferenceError: window is not defined` is non-fatal** -- This error appears in Node.js but doesn't break functionality

**Hono (Web Framework):**

- **BLS uses Hono for HTTP endpoints** -- Business Logic Server exposes HTTP API using `@hono/node-server`
- **CORS enabled by default** -- BLS accepts cross-origin requests
- **JSON and TOON responses** -- API endpoints return both JSON metadata and TOON-encoded events

**SQLite (better-sqlite3):**

- **In-memory for unit tests** -- Use `:memory:` database for fast, isolated tests
- **File-based for integration tests** -- Use temporary file paths for integration testing
- **Synchronous API** -- better-sqlite3 uses sync methods, no need for async/await
- **Proper cleanup** -- Always call `db.close()` in test teardown or finally blocks

**ILP Connector Integration:**

- **@agent-society/connector is an optional peer dependency** -- Both core and SDK declare it as optional
- **Use `EmbeddableConnectorLike` structural type** -- Defined in core, combines sendPacket + registerPeer + removePeer + setPacketHandler + optional channel methods
- **Bootstrap requires connector** -- BootstrapService needs a connector instance to function
- **Channel support is optional** -- `openChannel()` and `getChannelState()` are optional methods on `EmbeddableConnectorLike`

### Testing Rules

**Test Organization:**

- **Co-locate unit tests** -- `*.test.ts` files next to source files in same directory
- **Integration tests in `__integration__/`** -- Multi-component tests go in `packages/*/src/__integration__/`
- **SDK integration tests use separate vitest config** -- `vitest.integration.config.ts` with 30s timeout
- **E2E tests use separate config** -- `vitest.e2e.config.ts` for end-to-end tests (e.g., `packages/client/tests/e2e/`)
- **Test file naming** -- Match source file name with `.test.ts` suffix (e.g., `handler-registry.test.ts`)

**Test Framework (Vitest):**

- **Use Vitest built-in mocking** -- `vi.fn()`, `vi.mock()`, `vi.spyOn()` (not jest)
- **Follow AAA pattern** -- Arrange, Act, Assert structure in all tests
- **Use describe/it blocks** -- Group related tests with `describe()`, individual tests with `it()`
- **Async test handling** -- Use `async` functions, properly await all promises

**Mock Usage:**

- **Always mock SimplePool** -- Use `vi.mock('nostr-tools')` to prevent live relay connections
- **Mock external dependencies** -- HTTP clients, file system, network calls must be mocked in unit tests
- **Factory functions for test data** -- Create helper functions for generating valid test events with proper signatures
- **In-memory databases for unit tests** -- Use SQLite `:memory:` for isolated, fast tests
- **SDK tests mock connectors** -- Use structural `EmbeddableConnectorLike` mock with `vi.fn()` for sendPacket, registerPeer, etc.

**Test Coverage:**

- **Target >80% line coverage** -- Especially for core, BLS, and SDK packages
- **All public methods must have tests** -- Every exported function/class needs unit tests
- **Edge cases and error conditions** -- Test failure paths, boundary conditions, invalid inputs
- **Integration tests for bootstrap flows** -- Multi-peer bootstrap scenarios require integration tests

**Critical Testing Rules:**

- **No live relays in CI** -- Tests must pass without external network dependencies
- **Cleanup resources in teardown** -- Close database connections, clear mocks with `vi.clearAllMocks()`
- **Test isolation** -- Each test should be independent, no shared state between tests
- **Deterministic test data** -- Use fixed timestamps, keys, and IDs (not random values)

### Code Quality & Style Rules

**ESLint Configuration:**

- **Flat config format** -- Using ESLint 9.x flat config (`eslint.config.js`)
- **TypeScript strict rules** -- `@typescript-eslint/strict` and `@typescript-eslint/stylistic` configs
- **No explicit `any`** -- `@typescript-eslint/no-explicit-any: 'error'` (relaxed to `warn` in test/example/docker files)
- **Unused vars pattern** -- Prefix with underscore: `{ argsIgnorePattern: '^_', varsIgnorePattern: '^_' }`
- **Consistent type imports** -- `@typescript-eslint/consistent-type-imports` with `prefer: 'type-imports'`
- **No explicit return types** -- `@typescript-eslint/explicit-function-return-type: 'off'` (rely on inference)
- **ESLint ignores** -- `dist/`, `node_modules/`, `coverage/`, `archive/`, `*.js`, `*.mjs`, `packages/rig/`, `packages/town/`

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

- **Files (source):** PascalCase for classes, kebab-case for utilities and SDK modules (`BusinessLogicServer.ts`, `handler-registry.ts`, `create-node.ts`)
- **Files (test):** Match source with `.test.ts` suffix (`handler-registry.test.ts`)
- **Classes:** PascalCase (`SocialPeerDiscovery`, `HandlerRegistry`)
- **Interfaces:** PascalCase, no `I-` prefix (`IlpPeerInfo`, `HandlePacketRequest`, `HandlerContext`)
- **Functions:** camelCase (`discoverPeers`, `createNode`, `createPricingValidator`)
- **Factory functions:** `create*` prefix (`createNode`, `createHandlerContext`, `createVerificationPipeline`, `createPricingValidator`)
- **Constants:** UPPER_SNAKE_CASE (`ILP_PEER_INFO_KIND`, `SPSP_REQUEST_KIND`, `MAX_PAYLOAD_BASE64_LENGTH`)
- **Type aliases:** PascalCase (`TrustScore`, `BootstrapPhase`, `ToonRoutingMeta`)
- **Event types:** Discriminated unions with `type` field (`BootstrapEvent`)

**Code Organization:**

- **Monorepo structure** -- Packages in `packages/*/` directory, docker in `docker/`
- **pnpm workspace** -- `packages/*` and `docker` in `pnpm-workspace.yaml`
- **Index exports** -- All public APIs exported from `packages/*/src/index.ts`
- **Type definitions** -- Define types in `types.ts` or alongside implementation
- **Constants file** -- Event kinds and constants in `constants.ts`
- **Error classes** -- Custom errors in `errors.ts` per package
- **tsconfig.json excludes** -- Root tsconfig excludes `packages/rig` and `packages/town` (not yet implemented)

**Documentation:**

- **JSDoc for public APIs** -- Document exported functions, classes, and interfaces
- **Inline comments for complex logic** -- Explain non-obvious implementation details (e.g., pipeline ordering rationale)
- **No redundant comments** -- Don't comment obvious code

### Development Workflow Rules

**Git/Repository:**

- **Main branch:** `main` (default for PRs)
- **Epic branches:** `epic-N` for feature work (e.g., `epic-1` for SDK)
- **Monorepo with pnpm workspaces** -- All packages managed together
- **Conventional commits** -- Use prefixes: `feat(story):`, `fix:`, `docs:`, `test:`, `refactor:`
- **Story-scoped commits** -- `feat(1-7): implement createNode composition with embedded connector lifecycle`
- **Co-authored commits for AI assistance** -- Add `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>` when AI helps
- **Descriptive commit messages** -- Focus on "why" not just "what"

**Build & Scripts:**

- **Build all packages:** `pnpm build` (runs `pnpm -r run build` recursively)
- **Test all packages:** `pnpm test` (Vitest)
- **Test with coverage:** `pnpm test:coverage`
- **Lint codebase:** `pnpm lint`
- **Format code:** `pnpm format` (write), `pnpm format:check` (check only)
- **Package-level scripts:** Each package has its own `build`, `test`, `dev` scripts
- **SDK integration tests:** `cd packages/sdk && pnpm test:integration`

**Deployment:**

- **Docker Compose for local deployment** -- Multiple compose files for different setups
- **Genesis node:** `docker compose -p crosstown-genesis -f docker-compose-read-only-git.yml up -d`
- **Peer nodes:** `./deploy-peers.sh <count>` script for automated peer deployment
- **Port allocation:** Genesis (BLS: 3100, Relay: 7100), Peers (BLS: 3100+N*10, Relay: 7100+N*10)

**Contract Deployment (Anvil):**

- **Deterministic addresses** -- Anvil deployment produces consistent contract addresses
- **AGENT Token:** `0x5FbDB2315678afecb367f032d93F642f64180aa3`
- **TokenNetworkRegistry:** `0xe7f1725e7734ce288f8367e1bb143e90bb3f0512`
- **TokenNetwork (AGENT):** `0xCafac3dD18aC6c6e92c921884f9E4176737C052c`
- **Deployer Account:** `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` (Anvil Account #0)

**npm Publishing (SDK):**

- **Package name:** `@crosstown/sdk`
- **Access:** public (`publishConfig.access: "public"`)
- **Files:** Only `dist/` directory is published
- **Repository field:** Points to monorepo with `directory: "packages/sdk"`

### Critical Don't-Miss Rules

**Anti-Patterns to Avoid:**

- **NEVER use `any` type** -- Use `unknown` with type guards (enforced by ESLint)
- **NEVER assume events are JSON** -- Relay returns TOON format strings, not JSON objects
- **NEVER connect to live relays in tests** -- Always mock SimplePool (use `vi.mock('nostr-tools')`)
- **NEVER skip event signature validation** -- Always verify Nostr event signatures before processing
- **NEVER import from peer dependencies directly** -- Use structural `*Like` types for cross-package interfaces
- **NEVER use relative imports without `.js` extension** -- ESM requires explicit extensions
- **NEVER assume index access is safe** -- Due to `noUncheckedIndexedAccess`, always handle `undefined`
- **NEVER use property access on index signatures** -- Use bracket notation `obj['key']` not `obj.key`
- **NEVER return response objects from handlers** -- Use `ctx.accept()` / `ctx.reject()` methods
- **NEVER decode TOON before verification** -- Shallow parse first, verify, then optionally decode (correctness requirement)
- **NEVER use `exec()` for git operations** -- Use `execFile()` to prevent command injection (Rig, when implemented)

**Critical Edge Cases:**

- **SimplePool `window is not defined` error is non-fatal** -- This ReferenceError appears in Node.js but doesn't break functionality
- **SPSP shared secrets must be encrypted** -- Use NIP-44 encryption for SPSP request/response (kinds 23194/23195)
- **Payment amounts must match TOON length** -- `publishEvent` amount = `basePricePerByte * toonData.length` (not hardcoded)
- **Relay WebSocket returns TOON strings** -- EVENT messages contain TOON strings, not JSON objects
- **Channel nonce conflicts require retry** -- Payment channel operations may need retry logic for blockchain transaction conflicts
- **SDK stubs for Epic 2** -- `createEventStorageHandler()` and `createSpspHandshakeHandler()` are stubs that throw; they will be implemented in Town (Epic 2)
- **Handler fulfillment is placeholder** -- `ctx.accept()` returns `fulfillment: 'default-fulfillment'`; in production BLS computes SHA-256(eventId)

**Security Rules:**

- **Validate all Nostr event signatures** -- Never trust unsigned/unverified events
- **Encrypt sensitive data in SPSP** -- SPSP parameters contain shared secrets, must use NIP-44 encryption
- **No secrets in static events** -- Don't publish shared secrets as plaintext (use encrypted request/response)
- **Sanitize user inputs** -- Validate and sanitize all external data at boundaries
- **Log sanitization in dev mode** -- User-controlled fields are sanitized via regex to prevent log injection
- **Proper key management** -- Private keys for testing only (Anvil deterministic accounts)
- **Payload size limits** -- 1MB base64 limit on incoming ILP packets (DoS mitigation)
- **Pubkey validation** -- `peerWith()` validates 64-char lowercase hex before delegating to core

**Performance Gotchas:**

- **SQLite synchronous API** -- better-sqlite3 blocks the event loop, don't use for high-frequency operations
- **TOON encoding overhead** -- TOON format has encoding/decoding cost, cache parsed results when possible
- **Lazy decode in HandlerContext** -- `ctx.decode()` caches the decoded event; only decodes on first call
- **Shallow TOON parse is cheaper** -- Use `shallowParseToon()` for routing; full decode only when handler needs it
- **WebSocket connection limits** -- SimplePool manages connections, don't create multiple pools
- **In-memory stores for unit tests** -- Use `:memory:` SQLite for fast tests, file-based only for integration

**Architecture-Specific Gotchas:**

- **TOON is the native format** -- Events are stored and served as TOON throughout the stack
- **TOON codec now in core, not BLS** -- Extracted as Story 1.0; import from `@crosstown/core/toon` or main `@crosstown/core` export
- **Pay to write, free to read** -- Relay gates EVENT writes with ILP micropayments, REQ/EOSE are free
- **Discovery != Peering** -- RelayMonitor discovers peers but doesn't auto-peer; use `peerWith()` explicitly
- **Bootstrap creates payment channels** -- When settlement is enabled, bootstrap flow automatically opens channels
- **Genesis node ports differ from peers** -- Genesis uses base ports (3100, 7100), peers use offset (3100+N*10)
- **SDK depends on core only** -- SDK does NOT depend on BLS or relay; Town (Epic 2) will depend on SDK + BLS
- **EmbeddableConnectorLike is in core, not SDK** -- The structural connector interface is defined in `packages/core/src/compose.ts`

---

## Usage Guidelines

**For AI Agents:**

- Read this file before implementing any code
- Follow ALL rules exactly as documented
- When in doubt, prefer the more restrictive option
- Update this file if new patterns emerge
- Check CLAUDE.md and MEMORY.md for additional project-specific context

**For Humans:**

- Keep this file lean and focused on agent needs
- Update when technology stack changes
- Review quarterly for outdated rules
- Remove rules that become obvious over time

Last Updated: 2026-03-05
