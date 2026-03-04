---
stepsCompleted:
  [
    'step-01-detect-mode',
    'step-02-load-context',
    'step-03-risk-and-testability',
    'step-04-coverage-plan',
    'step-05-generate-output',
  ]
lastStep: 'step-05-generate-output'
lastSaved: '2026-03-03'
workflowType: 'testarch-test-design'
inputDocuments:
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/epics.md
  - docs/architecture/crosstown-service-protocol.md
---

# Test Design for QA: Crosstown SDK

**Purpose:** Test execution recipe for QA team. Defines what to test, how to test it, and what QA needs from other teams.

**Date:** 2026-03-03
**Author:** TEA Master Test Architect
**Status:** Draft
**Project:** Crosstown

**Related:** See Architecture doc (`test-design-architecture.md`) for testability concerns and architectural blockers.

---

## Executive Summary

**Scope:** Full test coverage for 3 epics (SDK, Town, Rig) spanning 29 stories and 8 packages.

**Risk Summary:**

- Total Risks: 14 (6 high-priority score >=6, 5 medium, 3 low)
- Critical Categories: TECH (pipeline ordering, codec extraction, regression), SEC (verification bypass, git injection)

**Coverage Summary:**

- P0 tests: ~12 (critical paths, security)
- P1 tests: ~28 (important features, integration)
- P2 tests: ~11 (edge cases, regression)
- P3 tests: ~2 (exploratory)
- **Total**: ~53 tests (~1.5-3 weeks with 1 QA)

---

## Not in Scope

| Item                                         | Reasoning                                                                                                       | Mitigation                                        |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| **Connector internals**                      | Connector is a separate package with its own test suite; SDK interfaces via `ConnectorNodeLike` structural type | Validated at integration boundary via R-007 tests |
| **Rig admin panels / OAuth / notifications** | Explicitly excluded from Forgejo template port scope (read-only code browsing only)                             | Not in requirements; deferred post-MVP            |
| **Multi-relay redundancy**                   | Deferred architectural decision                                                                                 | Rig graceful degradation tested (R-009)           |
| **Performance / load testing**               | No NFR defines RPS or throughput targets for SDK                                                                | Monitor during E2E; add if NFRs introduced        |
| **Rig offline mode**                         | Deferred architectural decision                                                                                 | N/A                                               |

---

## Dependencies & Test Blockers

### Backend/Architecture Dependencies (Pre-Implementation)

**Source:** See Architecture doc "Quick Guide" for detailed mitigation plans.

1. **TOON Codec Extraction (Story 1.0)** - Dev - Pre-Epic 1
   - QA needs TOON encode/decode/shallow-parse in `@crosstown/core`
   - Blocks all SDK unit tests that use TOON data

2. **Pipeline Stage Ordering Invariant (R-001)** - Architecture - Pre-Implementation
   - QA needs documented invariant to write ordering assertions
   - Blocks P0-001 and P0-002 test implementation

### QA Infrastructure Setup

1. **Test Data Factories** - QA
   - TOON event factory (valid/invalid signatures, various kinds)
   - Nostr keypair factory (BIP-39 mnemonic, derived keys)
   - ILP packet factory (configurable amount, destination, transit flag)
   - Auto-cleanup fixtures for test isolation

2. **Test Environments** - QA/DevOps
   - **Local**: Vitest with mocked ConnectorNodeLike (unit + integration)
   - **CI/CD**: GitHub Actions running `pnpm -r test` on every PR
   - **E2E**: Genesis node deployment via `deploy-genesis-node.sh` (nightly)

3. **Anvil + Faucet Container Infrastructure** - DevOps
   - **Anvil container** (`docker-compose-genesis.yml`): Foundry-based local blockchain with deterministic contract deployment via `DeployLocal.s.sol`
     - Deterministic addresses: AGENT Token (`0x5FbDB2315678afecb367f032d93F642f64180aa3`), TokenNetworkRegistry (`0xe7f1725e7734ce288f8367e1bb143e90bb3f0512`), TokenNetwork (`0xCafac3dD18aC6c6e92c921884f9E4176737C052c`)
     - Chain ID: 31337, 10 pre-funded accounts with 10,000 ETH each
     - Health check: `cast client --rpc-url http://localhost:8545`
   - **Faucet container** (`packages/faucet/`): Express.js service distributing ETH + AGENT tokens
     - Port 3500, rate-limited per address
     - API: `POST /api/request` with `{address}` body, `GET /health`
     - Uses Account #0 (deployer) for token transfers, Account #1 for ETH distribution
   - **Required for**: Payment channel integration tests (R-005), E2E regression tests (R-006)
   - **Setup**: `./deploy-genesis-node.sh` orchestrates Anvil, Faucet, Connector, and Crosstown Node
   - **Note**: `deploy-genesis-node.sh` and `docker-compose-genesis.yml` currently deploy the pre-SDK relay/BLS image. Once Epic 2 (Town) replaces the relay with an SDK-based implementation, these deployment scripts will need updating to use the new `@crosstown/town` Docker image. E2E test infrastructure should track this transition.

**Example Vitest factory pattern:**

```typescript
import { describe, it, expect } from 'vitest';
import { encodeToon, decodeToon, shallowParseToon } from '@crosstown/core';

// Factory: create a valid TOON-encoded Nostr event
function createTestToonEvent(overrides?: Partial<NostrEvent>): {
  toonBytes: Uint8Array;
  event: NostrEvent;
} {
  const event = {
    kind: 1,
    pubkey: 'ab'.repeat(32),
    id: 'cd'.repeat(32),
    sig: 'ef'.repeat(64),
    content: 'test content',
    created_at: Math.floor(Date.now() / 1000),
    tags: [],
    ...overrides,
  };
  return { toonBytes: encodeToon(event), event };
}

describe('TOON shallow parse', () => {
  it('extracts routing metadata without full decode', () => {
    const { toonBytes, event } = createTestToonEvent({ kind: 30617 });
    const meta = shallowParseToon(toonBytes);

    expect(meta.kind).toBe(30617);
    expect(meta.pubkey).toBe(event.pubkey);
    expect(meta.id).toBe(event.id);
    expect(meta.sig).toBe(event.sig);
    expect(meta.rawBytes).toEqual(toonBytes);
  });
});
```

---

## Risk Assessment

**Note:** Full risk details in Architecture doc. This section summarizes risks relevant to QA test planning.

### High-Priority Risks (Score >=6)

| Risk ID   | Category | Description                      | Score | QA Test Coverage                                                           |
| --------- | -------- | -------------------------------- | ----- | -------------------------------------------------------------------------- |
| **R-001** | TECH     | TOON pipeline stage ordering     | **9** | P0-001 (unit: shallow parse), P0-002 (integration: full pipeline ordering) |
| **R-002** | SEC      | Schnorr verification bypass      | **6** | P0-003 (unit: invalid sig rejected), P0-004 (unit: devMode=false enforced) |
| **R-003** | TECH     | TOON codec extraction regression | **6** | P0-005 (unit: roundtrip), P0-006 (integration: BLS+relay imports)          |
| **R-004** | SEC      | Git command injection in Rig     | **6** | P0-007 (unit: execFile used), P0-008 (unit: input sanitization)            |
| **R-005** | DATA     | Payment channel state integrity  | **6** | P0-009 (integration: channel lifecycle), P0-010 (integration: nonce retry) |
| **R-006** | TECH     | SDK replacement E2E regression   | **6** | P0-011, P0-012 (E2E: genesis-bootstrap + event publish)                    |

### Medium/Low-Priority Risks

| Risk ID | Category | Description                               | Score | QA Test Coverage                            |
| ------- | -------- | ----------------------------------------- | ----- | ------------------------------------------- |
| R-007   | TECH     | ConnectorNodeLike structural typing drift | 4     | P1-014 (integration: type matching)         |
| R-008   | TECH     | Transit semantics misrouting              | 3     | P1-011, P1-012 (unit: both paths)           |
| R-009   | OPS      | Rig relay dependency for issues/PRs       | 4     | P1-027 (integration: relay query rendering) |
| R-010   | BUS      | Self-write pricing bypass edge cases      | 3     | P1-008, P1-010 (unit: pricing + bypass)     |
| R-011   | TECH     | BIP-39/NIP-06 derivation interop          | 3     | P1-017, P1-018 (unit: key derivation)       |
| R-012   | BUS      | Eta template port fidelity                | 2     | P2-010 (integration: view rendering)        |
| R-013   | DATA     | SQLite schema evolution                   | 2     | P3-002 (unit: CRUD)                         |
| R-014   | OPS      | Package ESM export config                 | 1     | P3-001 (unit: exports valid)                |

---

## Entry Criteria

**QA testing cannot begin until ALL of the following are met:**

- [ ] TOON codec extraction to `@crosstown/core` complete (Story 1.0)
- [ ] Pipeline stage ordering invariant documented in ADR
- [ ] Test data factories created (TOON events, keypairs, ILP packets)
- [ ] Vitest configured in new packages (sdk, town, rig)
- [ ] For E2E tests: Genesis node deployable via `deploy-genesis-node.sh`
- [ ] For channel tests: Anvil + Faucet containers operational with deterministic addresses

## Exit Criteria

**Testing phase is complete when ALL of the following are met:**

- [ ] All P0 tests passing (100% required)
- [ ] All P1 tests passing (>=95%, failures triaged)
- [ ] No open high-severity bugs in P0/P1 scope
- [ ] > 80% line coverage for SDK public APIs (NFR-SDK-3)
- [ ] E2E regression suite passes against SDK-based relay

---

## Test Coverage Plan

**IMPORTANT:** P0/P1/P2/P3 = **priority and risk level** (what to focus on if time-constrained), NOT execution timing. See "Execution Strategy" for when tests run.

### P0 (Critical)

**Criteria:** Blocks core functionality + High risk (>=6) + No workaround + Affects all SDK consumers

| Test ID    | Requirement                                                        | Test Level  | Risk Link | Notes                                 |
| ---------- | ------------------------------------------------------------------ | ----------- | --------- | ------------------------------------- |
| **P0-001** | TOON shallow parse extracts kind/pubkey/id/sig without full decode | Unit        | R-001     | Verify rawBytes preserved             |
| **P0-002** | Full pipeline ordering: parse -> verify -> price -> dispatch       | Integration | R-001     | Invalid sig = handler never invoked   |
| **P0-003** | Schnorr verification rejects invalid signatures with F06           | Unit        | R-002     | Use nostr-tools test vectors          |
| **P0-004** | devMode=false enforces verification (no bypass leak)               | Unit        | R-002     | Explicit production config test       |
| **P0-005** | TOON codec encode/decode roundtrip from @crosstown/core            | Unit        | R-003     | Replaces existing BLS codec tests     |
| **P0-006** | BLS + relay imports work after codec extraction to core            | Integration | R-003     | Run `pnpm -r test` post-move          |
| **P0-007** | All git operations use execFile (not exec)                         | Unit        | R-004     | Static analysis + runtime test        |
| **P0-008** | Git input sanitization rejects shell metacharacters                | Unit        | R-004     | Path traversal, semicolons, backticks |
| **P0-009** | Payment channel open/deposit/balance-proof lifecycle               | Integration | R-005     | Requires Anvil container              |
| **P0-010** | Nonce conflict retry for on-chain operations                       | Integration | R-005     | Simulate concurrent transactions      |
| **P0-011** | SDK-based relay passes genesis-bootstrap-with-channels E2E         | E2E         | R-006     | Requires full genesis deployment      |
| **P0-012** | SDK-based relay event publish + query cycle                        | E2E         | R-006     | Validates TOON-native storage         |

**Total P0:** ~12 tests

---

### P1 (High)

**Criteria:** Important features + Medium risk (3-5) + Common workflows + Core SDK API surface

| Test ID    | Requirement                                                  | Test Level  | Risk Link | Notes                              |
| ---------- | ------------------------------------------------------------ | ----------- | --------- | ---------------------------------- |
| **P1-001** | Handler registry kind-based routing dispatches correctly     | Unit        | -         | Kind match                         |
| **P1-002** | Handler registry onDefault fallback invoked                  | Unit        | -         | No kind match                      |
| **P1-003** | Handler registry F00 on no matching handler                  | Unit        | -         | No default either                  |
| **P1-004** | HandlerContext.toon provides raw TOON without decode         | Unit        | -         | LLM passthrough                    |
| **P1-005** | HandlerContext.decode() lazy evaluation and caching          | Unit        | -         | Second call returns cached         |
| **P1-006** | HandlerContext.accept(data?) correct response format         | Unit        | -         | HandlePacketAcceptResponse         |
| **P1-007** | HandlerContext.reject(code, msg) correct response format     | Unit        | -         | HandlePacketRejectResponse         |
| **P1-008** | Pricing per-byte calculation rejects underpaid with F04      | Unit        | R-010     | amount < bytes \* basePricePerByte |
| **P1-009** | Pricing per-kind override takes precedence                   | Unit        | -         | kindPricing map                    |
| **P1-010** | Self-write bypass (node's own pubkey = free)                 | Unit        | R-010     | Pubkey format normalization        |
| **P1-011** | PaymentHandler bridge isTransit=true fire-and-forget         | Unit        | R-008     | Non-blocking                       |
| **P1-012** | PaymentHandler bridge isTransit=false awaits response        | Unit        | R-008     | Blocking                           |
| **P1-013** | PaymentHandler bridge catches exception -> T00               | Unit        | -         | Unhandled handler throw            |
| **P1-014** | ConnectorNodeLike structural type matches connector API      | Integration | R-007     | Compile-time + runtime             |
| **P1-015** | createNode() composition wires all pipeline stages           | Integration | -         | Smoke test                         |
| **P1-016** | node.start()/stop() lifecycle, double start throws NodeError | Unit        | -         | State machine                      |
| **P1-017** | generateMnemonic() returns valid 12-word BIP-39 mnemonic     | Unit        | R-011     | Validate against BIP-39 wordlist   |
| **P1-018** | fromMnemonic() derives correct NIP-06 path keypair           | Unit        | R-011     | m/44'/1237'/0'/0/0                 |
| **P1-019** | fromMnemonic() with accountIndex derives distinct keys       | Unit        | R-011     | Index 0 != index 1                 |
| **P1-020** | fromSecretKey() derives matching pubkey + evmAddress         | Unit        | -         | Cross-library validation           |
| **P1-021** | Dev mode skips verification + bypasses pricing + logs        | Unit        | -         | All three behaviors                |
| **P1-022** | Town event storage handler: decode -> store -> accept        | Unit        | -         | Story 2.1                          |
| **P1-023** | Town SPSP handshake handler: negotiate -> channel -> accept  | Unit        | -         | Story 2.2                          |
| **P1-024** | Rig repo creation handler (kind:30617 -> git init --bare)    | Unit        | -         | Story 3.1                          |
| **P1-025** | Rig patch handler (kind:1617 -> git am)                      | Unit        | -         | Story 3.2                          |
| **P1-026** | Rig issue/comment handlers acknowledge (kind:1621/1622)      | Unit        | -         | Story 3.3                          |
| **P1-027** | Rig relay query renders issues/PRs in web UI                 | Integration | R-009     | Relay query + Eta render           |
| **P1-028** | Bootstrap + relay monitor discovers and registers peers      | Integration | -         | Story 1.9                          |

**Total P1:** ~28 tests

---

### P2 (Medium)

**Criteria:** Secondary features + Low risk (1-2) + Edge cases + Regression prevention

| Test ID    | Requirement                                            | Test Level  | Risk Link | Notes               |
| ---------- | ------------------------------------------------------ | ----------- | --------- | ------------------- |
| **P2-001** | Handler replacement on duplicate .on(kind) call        | Unit        | -         | Last handler wins   |
| **P2-002** | Schnorr verify with devMode=true skips + logs debug    | Unit        | -         | DevMode behavior    |
| **P2-003** | Pricing default basePricePerByte=10n when unconfigured | Unit        | -         | Sensible default    |
| **P2-004** | node.stop() is idempotent (double stop = no-op)        | Unit        | -         | Lifecycle edge case |
| **P2-005** | Rig git HTTP backend serves clone/fetch (read-only)    | Integration | -         | CGI proxy           |
| **P2-006** | Rig git HTTP backend rejects push                      | Integration | -         | Write via ILP only  |
| **P2-007** | Rig pubkey display with kind:0 profile enrichment      | Unit        | -         | npub formatting     |
| **P2-008** | Rig PR status events (kinds 1630-1633) lifecycle       | Unit        | -         | Story 3.6           |
| **P2-009** | Rig unauthorized pubkey rejected for merge/close       | Unit        | -         | Maintainer check    |
| **P2-010** | Rig web UI renders repo list, tree, blob, blame views  | Integration | R-012     | Eta templates       |
| **P2-011** | node.peerWith(pubkey) manual peering                   | Integration | -         | Story 1.9           |

**Total P2:** ~11 tests

---

### P3 (Low)

**Criteria:** Nice-to-have + Exploratory + Package validation

| Test ID    | Requirement                                           | Test Level | Notes              |
| ---------- | ----------------------------------------------------- | ---------- | ------------------ |
| **P3-001** | Package ESM exports and TypeScript declarations valid | Unit       | All 3 new packages |
| **P3-002** | SQLite repo metadata CRUD operations                  | Unit       | RepoMetadataStore  |

**Total P3:** ~2 tests

---

## Execution Strategy

**Philosophy:** Run everything in PRs unless there's significant infrastructure overhead. Vitest with watch mode is extremely fast for unit/integration tests.

**Organized by TOOL TYPE:**

### Every PR: Vitest Tests (~3-5 min)

**All unit and integration tests** (from any priority level):

- All unit tests using Vitest with mocked ConnectorNodeLike
- Integration tests using Vitest in `__integration__/` directories
- Parallelized across packages via `pnpm -r test`
- Total: ~51 Vitest tests (P0-P3 minus E2E)

**Why run in PRs:** Fast feedback, no infrastructure dependencies, mocked connectors

### Nightly: E2E Tests (~5-10 min)

**All E2E tests requiring genesis node deployment:**

- `genesis-bootstrap-with-channels.test.ts` (P0-011)
- SDK-based relay event publish + query (P0-012)
- Payment channel lifecycle against Anvil (P0-009, P0-010)
- Requires: `deploy-genesis-node.sh` (Anvil + Faucet + Connector + Node)
- Total: ~4 E2E tests

**Why defer to nightly:** Requires Docker infrastructure (Anvil, Faucet, Connector containers)

---

## QA Effort Estimate

**QA test development effort only** (excludes DevOps, Backend, infrastructure work):

| Priority  | Count | Effort Range     | Notes                                                          |
| --------- | ----- | ---------------- | -------------------------------------------------------------- |
| P0        | ~12   | ~15-25 hours     | Complex setup (security, pipeline ordering, Anvil integration) |
| P1        | ~28   | ~20-35 hours     | Standard coverage (handler dispatch, pricing, identity)        |
| P2        | ~11   | ~8-15 hours      | Edge cases, simple validation                                  |
| P3        | ~2    | ~1-3 hours       | Package validation                                             |
| **Total** | ~53   | **~44-78 hours** | **~1.5-3 weeks, 1 QA engineer, full-time**                     |

**Assumptions:**

- Includes test design, implementation, debugging, CI integration
- Excludes ongoing maintenance (~10% effort)
- Assumes test data factories and Vitest config are ready
- P0 E2E tests require more setup time due to Docker infrastructure

---

## Implementation Planning Handoff

| Work Item                                        | Owner  | Dependencies/Notes                    |
| ------------------------------------------------ | ------ | ------------------------------------- |
| TOON event + keypair + ILP packet test factories | QA     | Requires Story 1.0 complete           |
| Vitest config in sdk, town, rig packages         | Dev    | Part of package setup stories         |
| Anvil + Faucet CI pipeline                       | DevOps | Existing `docker-compose-genesis.yml` |
| Git binary availability in CI                    | DevOps | Required for Rig integration tests    |

---

## Interworking & Regression

**Services and components impacted by the SDK:**

| Service/Component        | Impact                                              | Regression Scope                           | Validation Steps                      |
| ------------------------ | --------------------------------------------------- | ------------------------------------------ | ------------------------------------- |
| **@crosstown/core**      | TOON codec moves here from BLS                      | All existing core tests + BLS import tests | `pnpm -r test` after codec extraction |
| **@crosstown/bls**       | TOON codec removed, imports from core               | BLS unit tests must pass with new imports  | P0-006 validates                      |
| **@crosstown/relay**     | May need updated TOON imports                       | Relay tests pass with core imports         | P0-006 validates                      |
| **@crosstown/client**    | No code changes, E2E tests validate SDK             | E2E test suite                             | P0-011, P0-012                        |
| **@crosstown/connector** | No code changes, SDK interfaces via structural type | ConnectorNodeLike compatibility            | P1-014 validates                      |

**Regression test strategy:**

- `pnpm -r test` runs all package unit/integration tests (catches cross-package regressions)
- E2E suite (`genesis-bootstrap-with-channels`) validates full system behavior
- No cross-team coordination needed (single team, monorepo)

---

## Appendix A: Code Examples & Tagging

**Vitest Tags for Selective Execution:**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { HandlerRegistry } from '../HandlerRegistry.js';

// P0 critical test
describe('HandlerRegistry @P0', () => {
  it('dispatches to registered kind handler', () => {
    const registry = new HandlerRegistry();
    const handler = vi.fn();
    registry.on(30617, handler);

    const ctx = createMockContext({ kind: 30617 });
    registry.dispatch(ctx);

    expect(handler).toHaveBeenCalledWith(ctx);
  });
});

// P1 integration test
describe('Full pipeline @P1 @Integration', () => {
  it('TOON -> parse -> verify -> price -> dispatch -> accept', async () => {
    const { toonBytes } = createTestToonEvent({ kind: 1 });
    const node = createTestNode({ basePricePerByte: 10n });

    const response = await node.handlePacket({
      amount: String(toonBytes.length * 10),
      destination: 'g.crosstown.test',
      data: Buffer.from(toonBytes).toString('base64'),
    });

    expect(response.accept).toBe(true);
  });
});
```

**Run specific tags:**

```bash
# Run only P0 tests
pnpm vitest run --reporter verbose --testNamePattern '@P0'

# Run only integration tests
pnpm vitest run --dir src/__integration__

# Run all tests in a package
cd packages/sdk && pnpm test

# Run all tests across monorepo
pnpm -r test
```

---

## Appendix B: Knowledge Base References

- **Risk Governance**: `_bmad/tea/testarch/knowledge/risk-governance.md` - Risk scoring methodology (P x I)
- **Test Levels Framework**: `_bmad/tea/testarch/knowledge/test-levels-framework.md` - Unit vs integration vs E2E selection
- **Test Quality**: `_bmad/tea/testarch/knowledge/test-quality.md` - No hard waits, <300 lines, <1.5 min, self-cleaning
- **ADR Quality Readiness**: `_bmad/tea/testarch/knowledge/adr-quality-readiness-checklist.md` - 8-category NFR framework

---

**Generated by:** BMad TEA Agent
**Workflow:** `_bmad/tea/workflows/testarch/test-design`
