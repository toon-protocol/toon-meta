# 13. Test Strategy and Standards

## 13.1 Testing Philosophy

- **Approach:** Test-after with comprehensive coverage for public APIs
- **Coverage Goals:** >80% line coverage for core package
- **Test Pyramid:** Unit-heavy; integration tests optional for local dev

## 13.2 Test Types and Organization

### Unit Tests

- **Framework:** Vitest 1.x
- **File Convention:** `*.test.ts` co-located with source
- **Location:** Same directory as source file
- **Mocking Library:** Vitest built-in mocking
- **Coverage Requirement:** >80% for public APIs

**Requirements:**
- All public methods have unit tests
- Edge cases and error conditions covered
- SimplePool always mocked (never live relays)
- Follow AAA pattern (Arrange, Act, Assert)

### Integration Tests

- **Scope:** Local relay integration (not in CI)
- **Location:** `packages/*/src/__integration__/`
- **Test Infrastructure:**
  - **Nostr Relay:** Local relay (optional, dev only)
  - **SQLite:** In-memory for unit tests, file-based for integration

### E2E Tests

- **Not in MVP scope** per PRD Section 3.3

## 13.3 Test Data Management

- **Strategy:** Factory functions for test fixtures
- **Fixtures:** In test files or `__fixtures__/` directories
- **Factories:** Helper functions creating valid test events
- **Cleanup:** Vitest handles; in-memory stores reset per test

## 13.4 Continuous Testing

- **CI Integration:** GitHub Actions runs `pnpm test` on all PRs
- **Performance Tests:** Not in MVP scope
- **Security Tests:** npm audit in CI

---
