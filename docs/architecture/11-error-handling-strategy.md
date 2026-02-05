# 11. Error Handling Strategy

## 11.1 General Approach

- **Error Model:** Custom error classes extending Error with error codes
- **Exception Hierarchy:** `AgentSocietyError` base class with specific subclasses
- **Error Propagation:** Errors thrown from library; consumers handle

```typescript
class AgentSocietyError extends Error {
  constructor(
    message: string,
    public code: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'AgentSocietyError';
  }
}

class PeerDiscoveryError extends AgentSocietyError {}
class SpspError extends AgentSocietyError {}
class TrustCalculationError extends AgentSocietyError {}
class RelayError extends AgentSocietyError {}
```

## 11.2 Logging Standards

- **Library:** No built-in logging (library consumers configure their own)
- **Format:** Library throws descriptive errors with context
- **Relay Package:** Uses console with structured output; consumers can replace

## 11.3 Error Handling Patterns

### External API Errors (Nostr Relays)

- **Retry Policy:** Query multiple relays; continue on individual failures
- **Circuit Breaker:** Not implemented in MVP; rely on relay redundancy
- **Timeout Configuration:** Configurable per operation (default 10s for SPSP)
- **Error Translation:** Relay errors wrapped in library error types

### Business Logic Errors

- **Custom Exceptions:** `PeerNotFoundError`, `SpspTimeoutError`, `InvalidEventError`
- **User-Facing Errors:** Descriptive messages with error codes
- **Error Codes:** `PEER_NOT_FOUND`, `SPSP_TIMEOUT`, `INVALID_EVENT`, etc.

### Data Consistency

- **Transaction Strategy:** SQLite transactions for relay event storage
- **Compensation Logic:** N/A (single-operation writes)
- **Idempotency:** Events identified by hash; duplicate writes ignored

---
