# 3. Technical Assumptions

## 3.1 Repository Structure: Monorepo

The project will use a monorepo structure with packages for:
- `@agent-society/core` - Main protocol library
- `@agent-society/relay` - ILP-gated relay reference implementation
- `@agent-society/examples` - Integration examples

**Rationale:** Monorepo simplifies dependency management between packages and enables atomic changes across the library and relay implementation.

## 3.2 Service Architecture

This is a **library** (not a service). Agents import and use directly. The ILP-gated relay reference implementation is a standalone process that agents can run alongside their ILP connector.

Two integration patterns are supported:
1. **Separate Processes:** Library runs in agent process, communicates with connector via Admin API
2. **Embedded:** Library embedded directly in custom connector implementations

**Rationale:** Library architecture gives maximum flexibility to agent developers while the relay reference provides a complete working example.

## 3.3 Testing Requirements

- **Unit Tests:** Required for all public APIs using Vitest with mocked SimplePool
- **Integration Tests:** Optional tests against local relay for development (not CI)
- **No E2E Tests:** Live relay testing is out of scope for MVP

**Rationale:** Mocked tests ensure CI reliability without external dependencies. Developers can optionally run integration tests locally.

## 3.4 Additional Technical Assumptions

- Agents own their Nostr keypairs; the library does not manage keys
- NIP-44 encryption is stable and supported by nostr-tools
- agent-runtime Admin API remains stable for peer/route management
- Nostr relays reliably serve replaceable events (kind:10032, kind:10047)
- TOON encoding library is available or will be implemented
- Standard npm/TypeScript toolchain for builds

---
