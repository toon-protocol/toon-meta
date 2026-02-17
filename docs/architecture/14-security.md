# 14. Security

## 14.1 Input Validation

- **Validation Approach:** Regex validation + nostr-tools verification at boundaries
- **Validation Location:** At library boundaries (public API methods, BLS packet handler)
- **Required Rules:**
  - All pubkeys validated as 64-character lowercase hex (`/^[0-9a-f]{64}$/`)
  - All events verified with nostr-tools `verifyEvent()` before processing
  - ILP addresses validated against format
  - TOON-decoded events re-verified after decoding

## 14.2 Authentication & Authorization

- **Auth Method:** Nostr event signatures (Schnorr/secp256k1)
- **Session Management:** N/A (stateless library)
- **Required Patterns:**
  - Always verify event signatures before processing
  - Use NIP-44 encryption for SPSP request/response
  - BLS owner pubkey bypass for self-signed events

## 14.3 Secrets Management

- **Development:** Consumer provides keypairs; library never stores keys
- **Production:** Same as development; Docker entrypoint accepts keys via env vars
- **Code Requirements:**
  - NEVER log private keys or shared secrets
  - Private keys passed as parameters, never stored
  - Shared secrets handled as opaque blobs
  - Settlement addresses and channel IDs are not secret but should not be logged at debug level

## 14.4 API Security

- **Rate Limiting:** N/A for library; Docker deployment should add relay-level rate limiting
- **CORS Policy:** N/A (library; Docker BLS is internal-only)
- **Security Headers:** N/A (library)
- **HTTPS Enforcement:** Relay consumers should enforce WSS

## 14.5 Data Protection

- **Encryption at Rest:** Consumer responsibility (relay SQLite)
- **Encryption in Transit:** NIP-44 for SPSP; WSS for relay connections
- **PII Handling:** Pubkeys are pseudonymous; no PII collected
- **Logging Restrictions:** Never log private keys, shared secrets, or decrypted SPSP payloads

## 14.6 NIP Handler Security (Planned — Epic 11)

- **Content Isolation:** Untrusted event content wrapped with `<untrusted-content>` tags and `^` datamarkers before LLM processing
- **Allowlist Enforcement:** Per-kind action allowlists reject unauthorized actions
- **Rate Limiting:** Per-pubkey, per-kind rate limiting stored in SQLite
- **Audit Logging:** All LLM-decided actions logged with event ID, kind, pubkey, action, timestamp, token usage

## 14.7 Peering Gate Security (Planned -- Epics 12-17)

- **Access Control:** All cross-Town interactions require NIP-02 peering + SPSP handshake. Non-peered pubkeys are rejected at the NIP handler level.
- **Spam Prevention:** The social graph is the spam filter. NIP-13 Proof-of-Work is unnecessary because non-peered nodes cannot submit DVM jobs, patches, or messages.
- **Sybil Resistance:** Creating fake peers requires establishing trust (NIP-02 follows from existing high-trust nodes), making sybil attacks economically infeasible.
- **Payment Escrow:** ILP PREPARE/FULFILL provides atomic escrow for cross-Town work — funds lock before execution, release only on verified delivery.

## 14.8 NIP-46 Remote Signing (Planned -- Epic 12)

- **Key Isolation:** Polecats (ephemeral workers) never hold the Rig's private key. A NIP-46 remote signer daemon holds the key and grants scoped permissions.
- **Scoped Permissions:** Per-kind signing: Polecats can sign kind:30078 (work status), kind:1617 (patches), kind:7000 (DVM feedback). Cannot sign kind:10032 (peer info), kind:23194 (SPSP), kind:9000 (group admin).
- **Revocation:** Rig revokes Polecat signer connection on tmux session death. No lingering signing capability.
- **Compromise Mitigation:** A compromised Polecat can only sign permitted event kinds — cannot modify peering, identity, or payment channels.

## 14.9 Dependency Security

- **Scanning Tool:** npm audit, Dependabot
- **Update Policy:** Security patches within 48 hours
- **Approval Process:** Dependencies reviewed before adding
- **Optional Peer Deps:** `@agent-runtime/connector` is optional to minimize attack surface

## 14.10 Security Testing

- **SAST Tool:** ESLint security rules
- **DAST Tool:** Not applicable (library)
- **Penetration Testing:** Not in current scope

---
