# 14. Security

## 14.1 Input Validation

- **Validation Library:** Zod for runtime validation
- **Validation Location:** At library boundaries (public API methods)
- **Required Rules:**
  - All pubkeys validated as 64-character hex
  - All events verified with nostr-tools `verifyEvent()`
  - ILP addresses validated against format

## 14.2 Authentication & Authorization

- **Auth Method:** Nostr event signatures (Schnorr/secp256k1)
- **Session Management:** N/A (stateless library)
- **Required Patterns:**
  - Always verify event signatures before processing
  - Use NIP-44 encryption for SPSP request/response

## 14.3 Secrets Management

- **Development:** Consumer provides keypairs; library never stores keys
- **Production:** Same as development
- **Code Requirements:**
  - NEVER log private keys or shared secrets
  - Private keys passed as parameters, never stored
  - Shared secrets handled as opaque blobs

## 14.4 API Security

- **Rate Limiting:** N/A (library; consumers implement)
- **CORS Policy:** N/A (library)
- **Security Headers:** N/A (library)
- **HTTPS Enforcement:** Relay consumers should enforce WSS

## 14.5 Data Protection

- **Encryption at Rest:** Consumer responsibility (relay SQLite)
- **Encryption in Transit:** NIP-44 for SPSP; WSS for relay connections
- **PII Handling:** Pubkeys are pseudonymous; no PII collected
- **Logging Restrictions:** Never log private keys, shared secrets, or decrypted payloads

## 14.6 Dependency Security

- **Scanning Tool:** npm audit, Dependabot
- **Update Policy:** Security patches within 48 hours
- **Approval Process:** Dependencies reviewed before adding

## 14.7 Security Testing

- **SAST Tool:** ESLint security rules
- **DAST Tool:** Not applicable (library)
- **Penetration Testing:** Not in MVP scope

---
