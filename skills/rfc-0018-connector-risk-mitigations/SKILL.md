---
name: rfc-0018-connector-risk-mitigations
description: How TOON Protocol's connector implements Interledger RFC 0018 - Connector Risk Mitigations. Use when users ask about TOON connector security, rate limiting, abuse prevention, admin-API protection, fraud detection, or privacy controls. Also covers generic connector-risk, security-control, and rate-limiting questions. Triggers on 'connector risk', 'connector security', 'rate limiting', 'abuse prevention', or 'how does TOON protect the connector'.
---

# RFC 0018: Connector Risk Mitigations on TOON

Implements RFC 0018 risk-control principles in the TOON connector (`@toon-protocol/connector`). Because TOON's value layer is signed payment-channel claims (not float-carrying HTLC forwarding), its risk surface is mostly abuse/DoS and key-handling rather than in-flight payment liquidity risk.

## TOON's actual risk controls

These are the real controls in the connector's `security/` tree — name these, not generic advice:

- **Token-bucket rate limiting** (`security/rate-limiter.ts`, `token-bucket.ts`, `rate-limit-config.ts`) — caps packet/connection rate per peer to blunt write-spam and DoS.
- **Fraud detection** (`security/fraud-detector.ts`) and a **reputation tracker** (`security/reputation-tracker.ts`) / **violation counter** (`security/violation-counter.ts`) — flag and penalize misbehaving peers.
- **Audit logging** (`security/audit-logger.ts`) and **alerting** (`security/alert-notifier.ts`) — tamper-evident record of value-bearing events and operator alerts.
- **Key management & rotation** (`security/key-manager.ts`, `key-manager-signer.ts`, `key-rotation-manager.ts`) — the connector holds the signer keys that validate/redeem claims; rotation limits key-compromise blast radius.
- **Admin-API protection** — the control-plane HTTP API (`http/admin-api.ts`) is gated by `adminApi.apiKey`. The admin API is the highest-value attack surface (it mutates peers/routes), so it is never the ILP transport (see `rfc-0035`).
- **Claim validation at ingress** (`btp/inbound-claim-validator.ts`) — the primary financial control: every value-bearing packet's signed balance proof is verified against a known channel before forwarding; a regressed nonce or bad signature is rejected.
- **Privacy overlay** — optional ATOR `.anon` hidden-service transport hides operator/client network location.

## Key risk insight for TOON

The biggest *misconfiguration* risk isn't covered by RFC 0018's generic advice: a mis-tagged child (wrong `relation` / parent tag) causes paid traffic to be rejected (F06/T00). That's an operational correctness control, surfaced via the connector logs and the townhouse `RUNBOOK.md`, not a fraud control.

## Common Topics
- Token-bucket rate limiting (`security/rate-limiter.ts`)
- Fraud detection, reputation, violation counting
- Audit logging + alerting
- Key management/rotation for claim signers
- Admin-API `apiKey` gating; ingress claim validation
- ATOR privacy overlay
