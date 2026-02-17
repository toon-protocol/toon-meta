# 13. Test Strategy and Standards

## 13.1 Testing Philosophy

- **Approach:** Test-after with comprehensive coverage for public APIs
- **Coverage Goals:** >80% line coverage for core and BLS packages
- **Test Pyramid:** Unit-heavy; integration tests for bootstrap flows

## 13.2 Test Types and Organization

### Unit Tests

- **Framework:** Vitest ^1.x
- **Config:** `vitest.config.ts` (root)
- **File Convention:** `*.test.ts` co-located with source
- **Location:** Same directory as source file
- **Mocking Library:** Vitest built-in mocking (`vi.fn()`, `vi.mock()`)
- **Coverage Requirement:** >80% for public APIs

**Requirements:**
- All public methods have unit tests
- Edge cases and error conditions covered
- SimplePool always mocked (never live relays)
- Follow AAA pattern (Arrange, Act, Assert)

### Integration Tests

- **Config:** `vitest.integration.config.ts` (root)
- **Scope:** Multi-component bootstrap flows, five-peer bootstrap test
- **Location:** `packages/*/src/__integration__/`
- **Test Infrastructure:**
  - **Mocked Connectors:** In-memory connector simulation
  - **SQLite:** In-memory for unit tests, file-based for integration
  - **Nostr Relay:** Mocked SimplePool (no live relays)

### E2E Tests

- **Not in current scope** — planned for post-Epic 11

## 13.3 Test Data Management

- **Strategy:** Factory functions for test fixtures
- **Fixtures:** In test files or `__fixtures__/` directories
- **Factories:** Helper functions creating valid test events with proper signatures
- **JSON Fixtures:** `genesis-peers.json`, `testnet-wallets.json`
- **Cleanup:** Vitest handles; in-memory stores reset per test

## 13.4 Continuous Testing

- **CI Integration:** GitHub Actions runs `pnpm test` on all PRs
- **Performance Tests:** Not in current scope
- **Security Tests:** npm audit in CI

---
