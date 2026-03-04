---
stepsCompleted: ['context-load', 'category-assessment', 'gate-decision', 'output']
lastStep: 'output'
lastSaved: '2026-03-04'
---

# NFR Assessment: Crosstown SDK (3 Epics)

**Based on ADR Quality Readiness Checklist (8 categories, 29 criteria)**
**Date:** 2026-03-04
**Author:** Jonathan (TEA Master Test Architect)
**Scope:** All 3 epics — SDK, Town, Rig
**Architecture Reference:** `_bmad-output/planning-artifacts/architecture.md`
**NFRs Reference:** `_bmad-output/planning-artifacts/epics.md` (NFR-SDK-1 through NFR-SDK-7)

---

## Assessment Summary

| Category | Status | Criteria Met | Evidence | Next Action |
|----------|--------|-------------|----------|-------------|
| 1. Testability & Automation | ✅ PASS | 4/4 | API-first design, structural typing, seeding via factories, sample requests in stories | None |
| 2. Test Data Strategy | ✅ PASS | 3/3 | Faker-based factories, no production data, auto-cleanup in tests | None |
| 3. Scalability & Availability | ⬜ N/A | 0/4 | Single-node protocol SDK; no SLA targets defined | Intentionally deferred |
| 4. Disaster Recovery | ⬜ N/A | 0/3 | Development tooling; no production DR requirements | Intentionally deferred |
| 5. Security | ⚠️ CONCERNS | 3/4 | Schnorr auth, NIP-44 encryption, input validation; no secrets management policy | Document devMode policy |
| 6. Monitorability & Debuggability | ⚠️ CONCERNS | 2/4 | Structured error hierarchy, configurable logging; no metrics endpoint, no tracing | Add health check endpoint |
| 7. QoS & QoE | ⚠️ CONCERNS | 1/4 | No latency SLOs defined; no rate limiting; graceful degradation partial | Define pipeline SLOs |
| 8. Deployability | ✅ PASS | 3/3 | Docker images, npm publish, CLI entrypoints; no DB migrations needed | None |

**Overall:** 16/22 applicable criteria met (73%) → **⚠️ CONCERNS**

**Gate Decision:** **CONCERNS** — 3 categories need attention before GA. No blockers for development phase.

---

## Detailed Assessment

### 1. Testability & Automation (4/4 criteria met) ✅ PASS

**Question:** Can we verify this effectively without manual toil?

| Criterion | Status | Evidence | Gap/Action |
|-----------|--------|----------|------------|
| **Isolation:** Can service be tested with deps mocked? | ✅ | ConnectorNodeLike structural typing enables mocked connector injection; TOON codec is pure function | N/A |
| **Headless:** 100% business logic accessible via API? | ✅ | `POST /handle-packet` is the only ingress; all SDK logic is programmable API (createNode, .on, ctx.accept/reject) | N/A |
| **State Control:** Seeding APIs to inject data states? | ✅ | Factory functions (createSignedToonPayload, createPaymentRequest); Anvil deterministic state; Faucet for wallet funding | N/A |
| **Sample Requests:** Valid/invalid examples provided? | ✅ | Every story has explicit acceptance criteria with given/when/then; ATDD checklist provides 83 test scenarios | N/A |

**Assessment:** Excellent testability. The structural typing pattern (`ConnectorNodeLike`) enables real-infra-first testing while allowing isolation when needed. Pure functions (TOON codec, pricing calc) are trivially testable. No mocks needed for most tests — use real crypto, real TOON codec, real local infra.

---

### 2. Test Data Strategy (3/3 criteria met) ✅ PASS

| Criterion | Status | Evidence | Gap/Action |
|-----------|--------|----------|------------|
| **Segregation:** Test data isolated from prod? | ✅ | Anvil is a local dev chain (not mainnet); each test creates fresh keypairs | N/A |
| **Generation:** Synthetic data, no prod data? | ✅ | nostr-tools `generateSecretKey()` for keys; @scure/bip39 for mnemonics; factory functions for all fixtures | N/A |
| **Teardown:** Cleanup after tests? | ✅ | SQLite :memory: databases destroyed on test exit; Anvil state resets between tests; no persistent side effects | N/A |

**Assessment:** Strong. Real crypto libraries generate unique test data per run. No production data dependency. Ephemeral infrastructure (SQLite :memory:, Anvil local chain) means no cleanup needed.

---

### 3. Scalability & Availability (N/A — intentionally deferred)

**Rationale:** The SDK is a single-node development library, not a horizontally scaled service. Town and Rig are single-instance services with no SLA requirements defined. Scalability concerns are deferred to post-MVP.

**If SLAs are defined later**, assess:
- Statelessness of handler pipeline (currently stateless — ✅)
- Connector connection pool limits
- Relay WebSocket connection scaling for Rig
- SQLite write contention under concurrent event processing

---

### 4. Disaster Recovery (N/A — intentionally deferred)

**Rationale:** Development-phase tooling with local Anvil chain and ephemeral state. No production deployment targets defined yet. DR requirements should be revisited when Town/Rig are deployed to public networks.

---

### 5. Security (3/4 criteria met) ⚠️ CONCERNS

| Criterion | Status | Evidence | Gap/Action |
|-----------|--------|----------|------------|
| **AuthN/AuthZ:** Standard auth protocol? | ✅ | Schnorr signature verification (BIP-340) on every incoming event; pubkey-based identity (no passwords); devMode bypass is config-only | N/A |
| **Encryption:** Data encrypted in transit? | ✅ | NIP-44 encryption for SPSP request/response (shared secret exchange); BTP WebSocket for connector peering | N/A |
| **Secrets:** Keys stored securely? | ⚠️ | Secret keys derived from BIP-39 mnemonics; no guidance on mnemonic storage (env var? file? vault?) | **Document mnemonic storage policy** |
| **Input Validation:** Inputs sanitized? | ✅ | Rig uses `execFile` (not `exec`) for git operations; path traversal prevention; Eta auto-escaping for XSS | N/A |

**Concern: Mnemonic/Secret Key Storage**

The SDK accepts `secretKey` or `mnemonic` in config, but there's no guidance on how operators should store these secrets in production:
- **Risk:** Mnemonics in env vars leak to process listings, logs, or container inspect
- **Recommendation:** Document recommended storage (encrypted file, HSM, or vault) in SDK README
- **Priority:** P2 (documentation, not code change)
- **Owner:** Dev

---

### 6. Monitorability, Debuggability & Manageability (2/4 criteria met) ⚠️ CONCERNS

| Criterion | Status | Evidence | Gap/Action |
|-----------|--------|----------|------------|
| **Tracing:** Distributed tracing? | ⚠️ | No W3C Trace Context; ILP packets have `paymentId` but no cross-service correlation | **Add paymentId to handler logs** |
| **Logs:** Dynamic log levels? | ✅ | Dev mode enables verbose logging; production has structured error hierarchy (CrosstownError → NodeError/HandlerError/etc.) | N/A |
| **Metrics:** RED metrics exposed? | ⚠️ | No /metrics endpoint; no packet rate/error/duration tracking | **Add optional metrics callback** |
| **Config:** Externalized configuration? | ✅ | NodeConfig/TownConfig/RigConfig accept all config at construction; CLI flags and env vars supported | N/A |

**Concerns:**

1. **No metrics endpoint:** The SDK doesn't expose rate/error/duration metrics. For Town and Rig as deployed services, operators need visibility.
   - **Recommendation:** Add optional `onMetrics(event)` callback to NodeConfig; Town/Rig expose `/health` endpoint
   - **Priority:** P2 (post-MVP)
   - **Owner:** Dev

2. **No distributed tracing:** ILP packets have `paymentId` but this isn't propagated to handler logs or responses.
   - **Recommendation:** Include `paymentId` in HandlerContext and default log output
   - **Priority:** P3 (nice-to-have)
   - **Owner:** Dev

---

### 7. QoS & QoE (1/4 criteria met) ⚠️ CONCERNS

| Criterion | Status | Evidence | Gap/Action |
|-----------|--------|----------|------------|
| **Latency:** P95/P99 targets? | ⚠️ | No SLOs defined for pipeline latency (verify → price → dispatch) | **Define pipeline SLOs** |
| **Throttling:** Rate limiting? | ⚠️ | No built-in rate limiting; relies on connector-level flow control | **Consider per-pubkey rate limiting** |
| **Perceived Performance:** Loading feedback? | ⬜ N/A | Backend SDK, no UI | N/A |
| **Degradation:** Graceful error messages? | ✅ | ILP error codes (F00, F04, F06, T00) provide structured rejection; Rig relay queries degrade gracefully | N/A |

**Concerns:**

1. **No pipeline latency SLOs:** The SDK pipeline (shallow parse → verify → price → dispatch) has no defined latency targets. For a micropayment system, latency matters.
   - **Recommendation:** Benchmark pipeline latency; define P95 target (suggest <10ms for pipeline, excluding handler)
   - **Priority:** P3 (post-MVP, measure first)
   - **Owner:** Dev

2. **No rate limiting:** A malicious peer could flood the node with events. Connector has flow control but SDK doesn't limit per-pubkey or per-kind.
   - **Recommendation:** Add optional `maxEventsPerSecond` config; per-pubkey sliding window
   - **Priority:** P2 (post-MVP)
   - **Owner:** Dev

---

### 8. Deployability (3/3 criteria met) ✅ PASS

| Criterion | Status | Evidence | Gap/Action |
|-----------|--------|----------|------------|
| **Zero Downtime:** Supports rolling deploy? | ✅ | Stateless SDK; Town and Rig are single-process with graceful shutdown (node.stop()); Docker image supports restart | N/A |
| **Backward Compatibility:** DB/code separation? | ✅ | SQLite schemas are simple (Town EventStore, Rig RepoMetadataStore); no complex migrations; schema-per-package | N/A |
| **Rollback:** Automated rollback? | ✅ | npm version rollback for package; Docker image tag rollback for deployments; no persistent state to corrupt | N/A |

**Assessment:** Clean deployment model. Single-process services with no external database dependencies. Docker images and npm packages provide versioned rollback. No migration complexity.

---

## NFR-Specific Validation (from epics.md)

| NFR | Criteria | Status | Test Validation |
|-----|----------|--------|----------------|
| NFR-SDK-1: TypeScript strict mode | `strict: true`, `noUncheckedIndexedAccess`, `noImplicitOverride` | ✅ PASS | Compiler enforces; `pnpm -r build` validates |
| NFR-SDK-2: Node.js 24.x ESM | `"type": "module"` in all package.json files | ✅ PASS | Runtime validates; ESM imports tested |
| NFR-SDK-3: >80% line coverage | Public APIs exported from index.ts | ⚠️ CONCERNS | **Not yet measured** — requires implementation first; coverage target in quality gate |
| NFR-SDK-4: <30min integration time | createNode in ~10 lines | ⚠️ CONCERNS | **Not yet measured** — requires SDK usage test; Town entrypoint is the proof |
| NFR-SDK-5: Structural typing for connector | ConnectorNodeLike interface | ✅ PASS | Integration test validates against real connector |
| NFR-SDK-6: No live dependencies in unit tests | Mocked connectors, no relay/blockchain | ✅ PASS | Unit tests use real crypto but no network calls |
| NFR-SDK-7: Minimal package deps | core, nostr-tools, @scure/bip39, @scure/bip32 | ✅ PASS | Dependency audit in package.json |

**Note on NFR-SDK-6 vs "no mocks" philosophy:** NFR-SDK-6 says "mocked connectors with no live relay or blockchain." Jonathan's preference is "avoid mocks, use local infra." These are compatible: **unit tests** use lightweight in-process connector stubs (not HTTP mocks), **integration tests** use real local infrastructure (Anvil, relay, connector). The MockEmbeddedConnector in integration tests implements the real interface — it's a test double, not a mock.

---

## Recommendations Summary

| # | Category | Recommendation | Priority | Owner | Timeline |
|---|----------|---------------|----------|-------|----------|
| 1 | Security | Document mnemonic storage best practices in SDK README | P2 | Dev | Post-Epic 1 |
| 2 | Monitorability | Add `/health` endpoint to Town and Rig | P2 | Dev | Epic 2/3 |
| 3 | Monitorability | Include `paymentId` in HandlerContext and default log output | P3 | Dev | Post-MVP |
| 4 | QoS | Benchmark pipeline latency; define P95 <10ms target | P3 | Dev | Post-MVP |
| 5 | QoS | Add optional per-pubkey rate limiting | P2 | Dev | Post-MVP |

**None of these block development or testing.** All are post-MVP improvements.

---

## Gate Decision

### Overall: ⚠️ CONCERNS

**Rationale:** 16/22 applicable criteria met (73%). Three categories have gaps (Security, Monitorability, QoS), but all gaps are P2/P3 improvements — none block development, testing, or initial deployment.

**To reach PASS:**
1. Document mnemonic storage policy (Security gap)
2. Add /health endpoint to Town and Rig (Monitorability gap)
3. Benchmark and define pipeline latency SLOs (QoS gap)

**Acceptable for development phase.** Re-assess before public npm publish.

---

**Generated by**: BMad TEA Agent - Test Architect Module
**Workflow**: `_bmad/tea/testarch/nfr-assess`
**Version**: 4.0 (BMad v6)
