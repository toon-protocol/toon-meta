# 3. Tech Stack

## 3.1 Cloud Infrastructure

- **Provider:** N/A (Library - runs in consumer's environment)
- **Key Services:** None required; library is infrastructure-agnostic
- **Deployment Regions:** Consumer-determined

## 3.2 Technology Stack Table

| Category | Technology | Version | Purpose | Rationale |
|----------|------------|---------|---------|-----------|
| **Language** | TypeScript | 5.3.x | Primary development language | PRD requirement; strong typing for complex protocol work |
| **Runtime** | Node.js | 20.x LTS | Primary runtime | LTS stability; ESM support; PRD requirement (18+) |
| **Runtime** | Modern Browsers | ESM | Secondary runtime | PRD requirement for browser compatibility |
| **Nostr Library** | nostr-tools | 2.x | Nostr protocol operations | PRD requirement; official reference implementation |
| **Encryption** | @noble/ciphers | 0.5.x | NIP-44 encryption | Used by nostr-tools for encrypted DMs |
| **Database** | better-sqlite3 | 9.x | Relay event storage | Synchronous API; excellent performance; single-file |
| **WebSocket** | ws | 8.x | Relay WebSocket server | Standard Node.js WebSocket library |
| **HTTP Server** | Hono | 4.x | BLS HTTP endpoints | Lightweight; TypeScript-first; works everywhere |
| **Build Tool** | tsup | 8.x | Library bundling | ESM/CJS dual output; minimal config |
| **Package Manager** | pnpm | 8.x | Monorepo management | Efficient disk usage; workspace support |
| **Test Framework** | Vitest | 1.x | Unit testing | Fast; native ESM; PRD requirement |
| **Linting** | ESLint | 8.x | Code quality | TypeScript support; ecosystem standard |
| **Formatting** | Prettier | 3.x | Code formatting | Consistent style; zero-config |

---
