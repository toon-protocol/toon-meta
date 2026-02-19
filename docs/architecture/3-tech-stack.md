# 3. Tech Stack

## 3.1 Cloud Infrastructure

- **Provider:** N/A (Library - runs in consumer's environment)
- **Container Runtime:** Docker (optional, for standalone BLS+relay deployment)
- **Key Services:** None required; library is infrastructure-agnostic
- **Deployment Regions:** Consumer-determined

## 3.2 Technology Stack Table

| Category | Technology | Version | Purpose | Rationale |
|----------|------------|---------|---------|-----------|
| **Language** | TypeScript | ^5.3.x | Primary development language | PRD requirement; strong typing for complex protocol work |
| **Runtime** | Node.js | 24.x | Primary runtime | LTS stability; ESM support; PRD requirement (18+) |
| **Nostr Library** | nostr-tools | ^2.20.x | Nostr protocol operations | PRD requirement; official reference implementation |
| **Encryption** | @noble/ciphers | 0.5.x | NIP-44 encryption | Used by nostr-tools for encrypted DMs/SPSP |
| **TOON Encoding** | @toon-format/toon | 1.x | Encode Nostr events for ILP packet data | Standard format for embedding events in ILP PREPARE/FULFILL |
| **Database** | better-sqlite3 | ^11.x | BLS/relay event storage | Synchronous API; excellent performance; single-file |
| **WebSocket** | ws | 8.x | Relay WebSocket server | Standard Node.js WebSocket library |
| **HTTP Server** | Hono | ^4.x | BLS HTTP endpoints | Lightweight; TypeScript-first; works everywhere |
| **Build Tool** | tsup | 8.x | Library bundling | ESM/CJS dual output; minimal config |
| **Package Manager** | pnpm | >=8 | Monorepo management | Efficient disk usage; workspace support |
| **Test Framework** | Vitest | ^1.x | Unit and integration testing | Fast; native ESM; PRD requirement |
| **Linting** | ESLint | ^9.x | Code quality | Flat config; TypeScript support; ecosystem standard |
| **Formatting** | Prettier | ^3.2.x | Code formatting | Consistent style; zero-config |
| **Container** | Docker | - | Standalone BLS+relay deployment | Reproducible builds; production deployment |
| **AI SDK** | Vercel AI SDK | v6.x | LLM integration for agent runtime (planned) | Multi-model support; structured output via Zod; lightweight |

---
