# 12. Coding Standards

## 12.1 Core Standards

- **Languages & Runtimes:** TypeScript ^5.3.x (strict mode), Node.js 24.x
- **Style & Linting:** ESLint 9.x (flat config) + Prettier 3.x (config in repo root)
- **Test Organization:** Co-located `*.test.ts` files next to source; integration tests in `__integration__/`

## 12.2 Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Files (source) | PascalCase for classes, kebab-case for utilities | `BusinessLogicServer.ts`, `credit-limit.ts` |
| Files (test) | Match source with `.test.ts` suffix | `BusinessLogicServer.test.ts` |
| Classes | PascalCase | `SocialPeerDiscovery` |
| Interfaces | PascalCase (no I- prefix by convention) | `IlpPeerInfo`, `HandlePacketRequest` |
| Functions | camelCase | `discoverPeers`, `createCrosstownNode` |
| Constants | UPPER_SNAKE_CASE | `ILP_PEER_INFO_KIND`, `SPSP_REQUEST_KIND` |
| Type aliases | PascalCase | `TrustScore`, `BootstrapPhase` |
| Event types | Discriminated unions with `type` field | `BootstrapEvent` |

## 12.3 Critical Rules

- **Never use `any`:** Use `unknown` and type guards instead
- **Always mock SimplePool in tests:** No live relay dependencies in CI
- **Export from index.ts:** All public APIs exported from package index
- **Use nostr-tools types:** Don't redefine Nostr event types
- **Validate event signatures:** Never trust unsigned/unverified events
- **Structural typing for cross-package interfaces:** Use `ConnectorNodeLike` instead of direct import to keep `@agent-runtime/connector` as optional peer dep
- **DI for cross-package codecs:** Pass TOON encoder/decoder as config callbacks to avoid circular dependencies

---
