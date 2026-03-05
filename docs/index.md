# Crosstown Project Documentation Index

**Project Type:** Monorepo (pnpm workspaces)
**Architecture:** ILP-gated Nostr relay with payment channels
**Primary Language:** TypeScript 5.3+ / Node.js v24
**Last Updated:** 2026-02-26

---

## Quick Reference

### Technology Stack

| Layer                 | Technology                     | Purpose                             |
| --------------------- | ------------------------------ | ----------------------------------- |
| **Runtime**           | Node.js v24, pnpm 8.15         | JavaScript runtime, package manager |
| **Language**          | TypeScript 5.3+, ES2022        | Type-safe development               |
| **Backend Framework** | Hono, Express.js               | HTTP/WebSocket servers              |
| **Database**          | SQLite (better-sqlite3)        | Event storage                       |
| **Protocol**          | Nostr (NIP-01, NIP-02, NIP-44) | Decentralized messaging             |
| **Payments**          | ILP (Interledger Protocol)     | Micropayments                       |
| **Blockchain**        | Ethereum (viem, ethers.js)     | Payment channels, settlement        |
| **Data Format**       | TOON                           | Agent-friendly event encoding       |
| **Testing**           | Vitest                         | Unit + integration tests            |

### Package Structure

| Package                  | Type     | Description                             |
| ------------------------ | -------- | --------------------------------------- |
| **@crosstown/relay**     | Backend  | ILP-gated Nostr relay (WebSocket + BLS) |
| **@crosstown/bls**       | Backend  | Standalone Business Logic Server        |
| **@crosstown/faucet**    | Backend  | Token faucet (ETH + AGENT tokens)       |
| **@crosstown/git-proxy** | Backend  | ILP-gated Git HTTP proxy                |
| **@crosstown/core**      | Library  | Core protocol implementation            |
| **@crosstown/client**    | Library  | Client SDK with payment automation      |
| **@crosstown/examples**  | Examples | Demo applications                       |

---

## Project Overview

- [Project Overview](./project-overview.md) _(To be generated)_
- [README](../README.md) - Main project documentation
- [Quickstart Guide](../QUICKSTART.md) - Get started quickly
- [Setup Guide](../SETUP-GUIDE.md) - Detailed setup instructions
- [Architecture Overview](../ARCHITECTURE.md) - System architecture

---

## Generated API Documentation

### Backend Services

- **[Relay API Contracts](./api-contracts-relay.md)** - WebSocket relay + BLS endpoints
  - NIP-01 WebSocket API (REQ/EVENT/CLOSE)
  - Business Logic Server HTTP API (POST /handle-packet, GET /health)
  - TOON-native event format
  - SQLite event storage schema

- **[BLS API Contracts](./api-contracts-bls.md)** - Standalone BLS server
  - ILP payment verification
  - Same API as relay BLS component
  - Environment-based configuration

- **[Faucet API Contracts](./api-contracts-faucet.md)** - Token faucet service
  - POST /api/request - Request ETH + AGENT tokens
  - GET /api/info - Faucet configuration
  - Rate limiting (1 hour default)

- **[Git Proxy API Contracts](./api-contracts-git-proxy.md)** - ILP-gated Git operations
  - Proxies Git HTTP operations to Forgejo
  - Payment gate for push operations
  - Free clone/pull, paid push

### Libraries

- **[Component Library Documentation](./component-library-documentation.md)** - Core, Client, Examples
  - `@crosstown/core` - Peer discovery, SPSP, bootstrap
  - `@crosstown/client` - Client SDK with payment automation
  - `@crosstown/examples` - Demo applications

---

## Planning & Requirements (Existing Docs)

### Product Requirements

- **[PRD Index](./prd/index.md)** - Product Requirements Document (sharded)
  - [Goals & Background](./prd/1-goals-and-background-context.md)
  - [Requirements](./prd/2-requirements.md)
  - [Technical Assumptions](./prd/3-technical-assumptions.md)
  - [Next Steps](./prd/7-next-steps.md)

### Architecture Documentation (Sharded)

- **[Architecture](./architecture/)** - Detailed architecture documentation
  - [Data Models](./architecture/4-data-models.md)
  - [External APIs](./architecture/6-external-apis.md)
  - [Core Workflows](./architecture/7-core-workflows.md)
  - [Database Schema](./architecture/8-database-schema.md)
  - [Infrastructure & Deployment](./architecture/10-infrastructure-and-deployment.md)
  - [Error Handling Strategy](./architecture/11-error-handling-strategy.md)
  - [Coding Standards](./architecture/12-coding-standards.md)
  - [Test Strategy](./architecture/13-test-strategy-and-standards.md)
  - [Security](./architecture/14-security.md)
  - [Payment Channel Reference](./architecture/payment-channel-reference.md)

### Epics & Stories

- **[Epics](./epics/)** - Epic specifications (~10 active epics)
  - [Epic 1: Foundation & Peer Discovery](./epics/epic-1-foundation-peer-discovery.md)
  - [Epic 2: SPSP over Nostr](./epics/epic-2-spsp-over-nostr.md)
  - [Epic 3: Social Trust Engine](./epics/epic-3-social-trust-engine.md)
  - [Epic 4: ILP-Gated Relay](./epics/epic-4-ilp-gated-relay.md)
  - [Epic 5: Standalone BLS + Docker](./epics/epic-5-standalone-bls-docker.md)
  - [Epic 6: Decentralized Peer Discovery](./epics/epic-6-decentralized-peer-discovery.md)
  - [Epic 7: SPSP Settlement Negotiation](./epics/epic-7-spsp-settlement-negotiation.md)
  - [Epic 8: Nostr Network Bootstrap](./epics/epic-8-nostr-network-bootstrap.md)
  - [Epic 9: NPM Package Publishing](./epics/epic-9-npm-package-publishing.md)
  - [Epic 10: Embedded Connector Integration](./epics/epic-10-embedded-connector-integration.md)

- **[Stories](./stories/)** - User story specifications (~40+ stories)

### Research & Analysis

- **[Research](./research/)** - Technical research reports
  - [NIP Use Cases Deep Research](./research/deep-research-nip-use-cases-results.md)

- **[Integration Research](../)**
  - [Crosstown Marlin Integration Plan](../CROSSTOWN-MARLIN-INTEGRATION-PLAN.md)
  - [Crosstown Marlin Economics](../CROSSTOWN-MARLIN-ECONOMICS.md)
  - [Crosstown Oyster CVM Research](../CROSSTOWN-OYSTER-CVM-RESEARCH.md)
  - [ElizaOS Integration Handoff](../ELIZAOS-INTEGRATION-HANDOFF.md)

---

## Development & Operations

### Getting Started

**Prerequisites:**

- Node.js >= 20 (recommend v24)
- pnpm >= 8
- Docker + Docker Compose (for deployment)
- Foundry/Anvil (for local blockchain)

**Installation:**

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

### Development Commands

**Build:**

```bash
pnpm build                 # Build all packages
cd packages/relay && pnpm build   # Build specific package
```

**Testing:**

```bash
pnpm test                  # Run all tests
pnpm test:coverage         # With coverage
cd packages/client && pnpm test:e2e  # E2E tests
```

**Linting:**

```bash
pnpm lint                  # Check code style
pnpm format                # Format code
```

**Demos:**

```bash
pnpm demo:ilp-gated-relay  # Run ILP-gated relay demo
```

### Deployment

**Local Development (Genesis Node):**

```bash
./deploy-genesis-node.sh
# Deploys: Anvil, Relay (7100), BLS (3100), Connector (8080), Faucet (3500)
```

**Peer Network:**

```bash
./deploy-peers.sh 3        # Deploy 3 peer nodes
# Auto-funds wallets, configures Forgejo, runs bootstrap
```

**Docker Compose Configurations:**

- `docker-compose-read-only-git.yml` - Genesis node
- `docker-compose-peer1.yml` - Peer 1
- `docker-compose-full-stack.yml` - Complete stack

**Port Assignments:**

- Genesis: BLS 3100, Relay 7100, Connector 8080, Faucet 3500
- Peer N: BLS 3100+N*10, Relay 7100+N*10, Connector 8080+N\*10

### Testing Strategy

- **Unit Tests:** Vitest (packages/_/src/\*\*/_.test.ts)
- **Integration Tests:** Vitest integration config
- **E2E Tests:** packages/client E2E tests
- **Test Scripts:** `test-*.sh`, `test-*.mjs` in root

**Key Test Scripts:**

- `test-payment-channels.sh` - Payment channel flow
- `test-nip34.sh` - NIP-34 Git integration
- `fresh-bootstrap-test.sh` - Bootstrap flow

### CI/CD

**GitHub Workflows:**

- `.github/workflows/**` - CI pipelines _(To be documented)_

---

## Configuration & Contracts

### Smart Contracts (Anvil/Local)

**Deterministic Addresses:**

- **AGENT Token:** `0x5FbDB2315678afecb367f032d93F642f64180aa3`
- **TokenNetworkRegistry:** `0xe7f1725e7734ce288f8367e1bb143e90bb3f0512`
- **Deployer Account:** `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`

**Deployment:**

```bash
./deploy-contracts.sh      # Deploy to local Anvil
```

### Environment Variables

**BLS Configuration:**

- `NODE_ID` - Unique node identifier
- `NOSTR_SECRET_KEY` - 64-char hex secret key
- `ILP_ADDRESS` - ILP address (format: `g.domain.subdomain`)
- `BLS_PORT` - HTTP port (default: 3100)
- `BLS_BASE_PRICE_PER_BYTE` - Base price per byte
- `OWNER_PUBKEY` - Owner pubkey (self-write bypass)
- `DATA_DIR` - SQLite directory (default: `/data`)

**See:** [api-contracts-bls.md](./api-contracts-bls.md#environment-variables) for complete list

---

## Security & Testing

- **[Security Documentation](../SECURITY.md)** - Security considerations
- **[Testing Guide](../TESTING.md)** - Testing documentation
- **[Testing Summary](../TESTING-SUMMARY.md)** - Test results summary

---

## Integration Guides

### NIP-34 Git Integration

- [NIP-34 Integration](../NIP-34-INTEGRATION.md) - Git repository integration
- [NIP-34 Test Results](../NIP34-COMPLETE-TEST-RESULTS.md)
- [NIP-34 Patch PR Success](../NIP34-PATCH-PR-SUCCESS.md)

### Payment Channels

- [Payment Channels Success](../PAYMENT-CHANNELS-SUCCESS.md) - Channel implementation
- [Payment Channels Progress](../PAYMENT-CHANNELS-PROGRESS.md)
- [ILP-Gated Git Summary](../ILP-GATED-GIT-SUMMARY.md)

### Connector Deployment

- [Connector Deployment Success](../CONNECTOR-DEPLOYMENT-SUCCESS.md)
- [Bootstrap Test Results](../BOOTSTRAP-TEST-RESULTS.md)

---

## AI-Assisted Development

### Using This Documentation with AI

This documentation is optimized for AI code assistants like Claude Code. When working on Crosstown:

**For New Features:**

1. Review [PRD](./prd/index.md) for project goals
2. Check [Architecture](./architecture/) for system design
3. Reference [API Contracts](./api-contracts-relay.md) for interfaces
4. Review relevant [Epic](./epics/) for context

**For Bug Fixes:**

1. Check [Component Library Documentation](./component-library-documentation.md) for module exports
2. Review [API Contracts](./api-contracts-relay.md) for expected behavior
3. Check [Testing Guide](../TESTING.md) for test patterns

**For Integration:**

1. Review [Integration Patterns](./component-library-documentation.md#integration-patterns)
2. Check [Examples](./component-library-documentation.md#crosstown-examples) for reference implementations
3. Reference [API Contracts](./api-contracts-relay.md) for interfaces

### Project Context (CLAUDE.md)

See [../CLAUDE.md](../CLAUDE.md) for project-specific AI instructions and guidelines.

---

## Additional Resources

### Documentation Index

- [Documentation Index](../DOCUMENTATION-INDEX.md) - Alternative navigation

### Archive

- [Archive](./archive/) - Archived documentation and research
  - Deprecated epics (11-17)
  - Historical agent runtime integration docs
  - Previous research reports

---

## Contributing

### Code Standards

- **TypeScript:** Strict mode, ES2022 target
- **Formatting:** Prettier (see .prettierrc)
- **Linting:** ESLint (see eslint.config.js)
- **Testing:** Write tests for new features

### Git Workflow

**Branches:**

- `main` - Production branch
- Feature branches - Create from `main`

**Commits:**

- Follow conventional commits format
- Sign commits when possible

**Pull Requests:**

- Reference related Epic/Story
- Include tests
- Update documentation

---

## Support & Community

### Issues & Questions

- **GitHub Issues:** [github.com/ALLiDoizCode/crosstown/issues](https://github.com/ALLiDoizCode/crosstown)
- **Documentation:** This index and linked documents

### Project Status

**Current Branch:** BMAD_V6
**Recent Commits:**

- feat: upgrade to BMAD v6 with optimized project context
- feat: add keypair management, BTP transport, on-chain channels
- docs: add Marlin Oyster CVM integration research

---

**Generated:** 2026-02-26 by Claude Code (BMAD Document Project Workflow)
**Workflow Version:** 1.2.0
**Scan Level:** Exhaustive
