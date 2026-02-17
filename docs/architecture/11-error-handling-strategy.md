# 11. Error Handling Strategy

## 11.1 General Approach

- **Error Model:** Custom error classes extending Error with error codes and cause chaining
- **Exception Hierarchies:** Separate hierarchies per package
- **Error Propagation:** Errors thrown from library; consumers handle

**Core Package (`@crosstown/core`):**
```typescript
class CrosstownError extends Error {
  constructor(message: string, public readonly code: string, cause?: Error) {
    super(message, { cause });
  }
}

class InvalidEventError extends CrosstownError {}      // INVALID_EVENT
class PeerDiscoveryError extends CrosstownError {}      // PEER_DISCOVERY_FAILED
class SpspError extends CrosstownError {}               // SPSP_FAILED
class SpspTimeoutError extends CrosstownError {}        // SPSP_TIMEOUT
class TrustCalculationError extends CrosstownError {}   // TRUST_CALCULATION_FAILED
```

**BLS Package (`@crosstown/bls`):**
```typescript
class BlsBaseError extends Error {
  constructor(message: string, public code: string) {}
}

class BlsError extends BlsBaseError {}        // BLS_ERROR
class ConfigError extends BlsBaseError {}     // CONFIG_ERROR
```

**ILP Error Codes (BLS):** `F00` (bad request), `F06` (insufficient amount), `T00` (internal error)

## 11.2 Logging Standards

- **Library (core):** No built-in logging; throws descriptive errors with context
- **BLS Package:** Uses console with structured output; consumers can replace
- **Docker Entrypoint:** Console logging with environment-configurable levels

## 11.3 Error Handling Patterns

### External API Errors (Nostr Relays)

- **Retry Policy:** Query multiple relays; continue on individual failures
- **Circuit Breaker:** Not implemented; rely on relay redundancy
- **Timeout Configuration:** Configurable per operation (default 10s for SPSP, 5s for discovery)
- **Error Translation:** Relay errors wrapped in library error types

### Business Logic Errors

- **Custom Exceptions:** `InvalidEventError`, `SpspTimeoutError`, `PeerDiscoveryError`, `BlsError`
- **Error Codes:** `INVALID_EVENT`, `SPSP_TIMEOUT`, `PEER_DISCOVERY_FAILED`, `BLS_ERROR`, `CONFIG_ERROR`
- **ILP Error Mapping:** BLS maps domain errors to ILP error codes (F00, F06, T00)

### Bootstrap Errors

- **Event-Based:** Bootstrap emits typed events for phase failures (`bootstrap:handshake-failed`, `bootstrap:announce-failed`)
- **Partial Success:** Bootstrap continues with remaining peers if individual peers fail
- **Phase Rollback:** Failed phase transitions emit events; consumers decide retry strategy

### Data Consistency

- **Transaction Strategy:** SQLite transactions for relay event storage
- **Compensation Logic:** N/A (single-operation writes)
- **Idempotency:** Events identified by hash; duplicate writes ignored

---
