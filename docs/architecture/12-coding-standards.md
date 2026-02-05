# 12. Coding Standards

## 12.1 Core Standards

- **Languages & Runtimes:** TypeScript 5.3.x (strict mode), Node.js 20.x LTS
- **Style & Linting:** ESLint + Prettier (config in repo root)
- **Test Organization:** Co-located `*.test.ts` files next to source

## 12.2 Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Files | kebab-case | `peer-discovery.ts` |
| Classes | PascalCase | `NostrPeerDiscovery` |
| Interfaces | PascalCase with I- prefix optional | `IlpPeerInfo` or `IIlpPeerInfo` |
| Functions | camelCase | `discoverPeers` |
| Constants | UPPER_SNAKE_CASE | `ILP_PEER_INFO_KIND` |
| Type aliases | PascalCase | `TrustScore` |

## 12.3 Critical Rules

- **Never use `any`:** Use `unknown` and type guards instead
- **Always mock SimplePool in tests:** No live relay dependencies in CI
- **Export from index.ts:** All public APIs exported from package index
- **Use nostr-tools types:** Don't redefine Nostr event types
- **Validate event signatures:** Never trust unsigned/unverified events

---
