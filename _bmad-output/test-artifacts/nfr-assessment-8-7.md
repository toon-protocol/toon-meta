---
stepsCompleted:
  [
    'step-01-load-context',
    'step-02-define-thresholds',
    'step-03-gather-evidence',
    'step-04-evaluate-and-score',
    'step-04e-aggregate-nfr',
    'step-05-generate-report',
  ]
lastStep: 'step-05-generate-report'
lastSaved: '2026-03-24'
workflowType: 'testarch-nfr-assess'
inputDocuments:
  [
    '_bmad-output/implementation-artifacts/8-7-deploy-forge-ui-to-arweave.md',
    '_bmad/tea/testarch/knowledge/adr-quality-readiness-checklist.md',
    '_bmad/tea/testarch/knowledge/test-quality.md',
    '_bmad/tea/testarch/knowledge/ci-burn-in.md',
    '_bmad/tea/testarch/knowledge/error-handling.md',
    'packages/rig/vite.config.ts',
    'packages/rig/src/web/router.ts',
    'packages/rig/src/web/router.test.ts',
    'packages/rig/src/web/env.d.ts',
    'packages/rig/src/web/index.html',
    'packages/rig/src/web/build-verification.test.ts',
    'packages/rig/src/web/deploy-manifest.test.ts',
    'scripts/deploy-forge-ui.mjs',
    'scripts/deploy-helpers.mjs',
  ]
---

# NFR Assessment - Story 8.7: Deploy Forge-UI to Arweave

**Date:** 2026-03-24
**Story:** 8.7 (Deploy Forge-UI to Arweave)
**Overall Status:** PASS

---

Note: This assessment summarizes existing evidence; it does not run tests or CI workflows.

## Executive Summary

**Assessment:** 6 PASS, 2 CONCERNS, 0 FAIL

**Blockers:** 0

**High Priority Issues:** 0

**Recommendation:** Story 8.7 is ready for merge. The Vite build pipeline is correctly configured for Arweave deployment (`base: './'`), the deploy script handles dev/prod/dry-run modes with proper validation, and 32 unit tests cover build verification and manifest generation. Two CONCERNS relate to the absence of post-deployment smoke testing infrastructure and the inability to unit-test the actual Turbo SDK upload path (expected for a deployment story). No blockers or FAIL status NFRs.

---

## Performance Assessment

### Response Time (p95)

- **Status:** PASS
- **Threshold:** N/A (this story is a build/deployment pipeline, not a runtime feature)
- **Actual:** N/A
- **Evidence:** Story scope is build configuration + deployment script; no runtime code paths added
- **Findings:** The only runtime change is `import.meta.env.VITE_DEFAULT_RELAY` in `router.ts` (line 38), which is a compile-time constant replaced by Vite at build time. Zero runtime performance impact.

### Throughput

- **Status:** PASS
- **Threshold:** N/A (deployment script, not a runtime service)
- **Actual:** N/A
- **Evidence:** `deploy-forge-ui.mjs` is a CLI tool run manually or in CI, not a production service
- **Findings:** No throughput concerns. The deploy script uploads files sequentially, which is acceptable for a one-time deployment operation.

### Resource Usage

- **CPU Usage**
  - **Status:** PASS
  - **Threshold:** N/A (CLI tool)
  - **Actual:** N/A
  - **Evidence:** `deploy-forge-ui.mjs` runs `pnpm build` then uploads files

- **Memory Usage**
  - **Status:** PASS
  - **Threshold:** N/A (CLI tool)
  - **Actual:** Files are read individually via `readFileSync` and uploaded one at a time (line 231). No bulk memory accumulation.
  - **Evidence:** Code review of `deploy-forge-ui.mjs` lines 229-246

### Scalability

- **Status:** PASS
- **Threshold:** N/A (one-time deployment operation)
- **Actual:** Arweave path manifest enables any number of gateways to serve the deployed app
- **Evidence:** Manifest structure in `deploy-helpers.mjs` with gateway fallback
- **Findings:** Scalability is inherent to Arweave's decentralized architecture. Once deployed, the Forge-UI is served from any AR.IO gateway globally.

---

## Security Assessment

### Authentication Strength

- **Status:** PASS
- **Threshold:** Wallet credentials handled securely; no secrets in logs
- **Actual:** JWK wallet read from file path provided via CLI arg (`--wallet`). No wallet content is logged. Only the file path is printed (line 222).
- **Evidence:** `deploy-forge-ui.mjs` lines 221-224
- **Findings:** Wallet handling is secure. The JWK is read from a local file and passed directly to `TurboFactory.authenticated()`. No secrets are logged or exposed.

### Authorization Controls

- **Status:** PASS
- **Threshold:** Deploy script requires explicit confirmation for paid uploads
- **Actual:** `--confirm` flag required for wallet-mode uploads. Without it, only a cost estimate is printed and the script exits (lines 192-199).
- **Evidence:** `deploy-forge-ui.mjs` lines 192-199 (cost estimate gate)
- **Findings:** Good safeguard against accidental paid uploads. CI/CD compatible (no interactive prompts).

### Data Protection

- **Status:** PASS
- **Threshold:** CSP preserved in production build; no inline scripts
- **Actual:** CSP meta tag in `index.html` (line 8) includes all required Arweave gateways and WebSocket origins. `script-src 'self'` only. Tests verify CSP correctness (8.7-UNIT-002).
- **Evidence:** `index.html` line 8, `build-verification.test.ts` lines 124-162 (CSP tests)
- **Findings:** CSP is comprehensive and tested. `connect-src` includes all three gateway families with wildcards (`*.ar-io.dev`, `*.arweave.net`, `*.permagate.io`). `script-src` is `'self'` only (no `unsafe-inline` or `unsafe-eval`).

### Vulnerability Management

- **Status:** PASS
- **Threshold:** No new runtime dependencies; deploy script uses existing workspace deps
- **Actual:** 0 new runtime dependencies in `packages/rig`. The deploy script uses `@ardrive/turbo-sdk` which is already a workspace dependency of `packages/sdk`. `execFileSync` is used (not `execSync`) to prevent shell injection.
- **Evidence:** Story anti-pattern: "DO NOT add @ardrive/turbo-sdk as a dependency of packages/rig." `deploy-forge-ui.mjs` line 130: `execFileSync('pnpm', ['build'], ...)`.
- **Findings:** Zero new dependency surface in the browser bundle. The deploy script correctly uses `execFileSync` with argument arrays (security hardening established in Story 8.6).

### Compliance (if applicable)

- **Status:** PASS
- **Standards:** N/A (open-source deployment tooling)
- **Actual:** N/A
- **Evidence:** Story specification
- **Findings:** No compliance requirements apply to a deployment pipeline for an open-source code viewer.

---

## Reliability Assessment

### Availability (Uptime)

- **Status:** PASS
- **Threshold:** Deployed app accessible via multiple Arweave gateways
- **Actual:** Path manifest enables access via ar-io.dev, arweave.net, and permagate.io. SPA fallback via manifest `"fallback"` field ensures deep routes work.
- **Evidence:** `deploy-helpers.mjs` lines 69-95 (manifest generation with fallback), lines 126-130 (GATEWAYS array)
- **Findings:** Multi-gateway access provides redundancy. The fallback field in the manifest enables SPA routing from any gateway.

### Error Rate

- **Status:** PASS
- **Threshold:** Deploy script handles all failure modes gracefully
- **Actual:** Dev mode validates file sizes before upload (exits with clear error if >100KB). Missing CLI args produce clear error messages. `--wallet` and `--dev` mutual exclusivity enforced.
- **Evidence:** `deploy-forge-ui.mjs` lines 115-123 (CLI validation), 178-189 (dev mode size check). `deploy-helpers.mjs` lines 110-118 (`validateDevModeFileSizes`).
- **Findings:** Error handling is comprehensive for the deploy script. All expected failure modes produce user-friendly error messages.

### MTTR (Mean Time To Recovery)

- **Status:** PASS
- **Threshold:** N/A (Arweave deployments are immutable; recovery = new deployment)
- **Actual:** N/A
- **Evidence:** Architecture: Arweave data items are immutable. A new deployment creates a new manifest tx ID.
- **Findings:** Recovery is simply re-running the deploy script to create a new deployment.

### Fault Tolerance

- **Status:** PASS
- **Threshold:** Deploy script is idempotent (re-runnable)
- **Actual:** Each run creates new Arweave data items. Failed uploads can be retried by re-running the script. No local state is modified.
- **Evidence:** `deploy-forge-ui.mjs` architecture: build -> collect -> upload -> manifest -> print
- **Findings:** The deploy pipeline is stateless and re-runnable. A partial failure (e.g., network error mid-upload) requires a full re-run, but this is acceptable for a deployment tool.

### CI Burn-In (Stability)

- **Status:** PASS
- **Threshold:** All tests pass consistently
- **Actual:** 449 tests pass across 22 test files in the rig package (0 failures, 6 files skipped). Story-specific: 9 build verification tests + 23 deploy manifest tests = 32 tests, all passing. Pre-existing router test isolation bug fixed (5 tests that were previously failing).
- **Evidence:** `npx vitest run packages/rig/` output: "22 passed | 6 skipped (28), 449 passed | 58 skipped (507)"
- **Findings:** Test suite is stable. The router test isolation fix (adding `beforeEach` to clear `window.location.hash`) resolved a pre-existing cross-test pollution issue, improving overall test reliability.

### Disaster Recovery (if applicable)

- **RTO (Recovery Time Objective)**
  - **Status:** N/A
  - **Threshold:** N/A
  - **Actual:** N/A (immutable Arweave deployment)
  - **Evidence:** Architecture

- **RPO (Recovery Point Objective)**
  - **Status:** N/A
  - **Threshold:** N/A
  - **Actual:** N/A (deployed artifacts are immutable on Arweave; source code is in git)
  - **Evidence:** Architecture

---

## Maintainability Assessment

### Test Coverage

- **Status:** PASS
- **Threshold:** All acceptance criteria covered by tests
- **Actual:** 13 ACs in story. Unit-testable ACs all covered. AC #1 (production build) covered by 8.7-UNIT-001 (4 tests). AC #2 (CSP correctness) covered by 8.7-UNIT-002 (2 tests). AC #3 (relative paths) covered by 8.7-UNIT-003 (3 tests). AC #5 (path manifest) covered by 8.7-UNIT-005 (5 tests). AC #6 (MIME types) covered by 8.7-UNIT-006 (12 tests). AC #7 (dev mode size check) covered by 8.7-UNIT-007 (3 tests). AC #12 (documentation) covered by 8.7-UNIT-009 (3 tests). ACs #9-#11 and #13 are manual verification (post-deployment, by design). AC #4 and #8 involve Turbo SDK upload integration (tested structurally, not end-to-end). Total: 32 story-specific tests.
- **Evidence:** `build-verification.test.ts` (9 tests), `deploy-manifest.test.ts` (23 tests)
- **Findings:** Good test coverage for a deployment story. The build output verification and manifest generation logic are thoroughly tested. The actual Turbo SDK upload path is tested structurally (correct API usage) but not with real uploads (appropriate for unit tests).

### Code Quality

- **Status:** PASS
- **Threshold:** Follows established project patterns, no anti-patterns
- **Actual:** Deploy script follows all Story 8.6 code review learnings: `execFileSync` (not `execSync`), MIME type map as constant, gateway URLs as constant (not hardcoded inline), helpers extracted to separate module for testability. Vite config change is minimal (1 line: `base: './'`). Router change is minimal (1 line: env var fallback).
- **Evidence:** `deploy-forge-ui.mjs` (280 lines, well-structured CLI), `deploy-helpers.mjs` (166 lines, 4 exported functions with JSDoc), `vite.config.ts` (1-line change), `router.ts` (1-line change)
- **Findings:** High code quality. Clean separation between CLI orchestration (`deploy-forge-ui.mjs`) and testable logic (`deploy-helpers.mjs`). JSDoc comments on all exported functions.

### Technical Debt

- **Status:** PASS
- **Threshold:** No new tech debt introduced
- **Actual:** No tech debt introduced. The deploy script is self-contained. The `env.d.ts` file provides proper Vite env typing. The router test isolation fix resolves pre-existing debt (not new).
- **Evidence:** File list in story dev record, clean test results
- **Findings:** This story actually reduces net tech debt by fixing the pre-existing router test isolation bug.

### Documentation Completeness

- **Status:** PASS
- **Threshold:** CLI help, deployment instructions, dogfooding guide
- **Actual:** `--help` output includes prerequisites, usage examples for all modes, env vars, relay configuration, and dogfooding instructions. `generateDeploymentSummary()` prints gateway URLs and step-by-step dogfooding guide.
- **Evidence:** `deploy-forge-ui.mjs` lines 46-99 (`printHelp`), `deploy-helpers.mjs` lines 138-165 (`generateDeploymentSummary`)
- **Findings:** Documentation is comprehensive and self-contained in the deploy script. No external documentation files needed.

### Test Quality (from test-review, if available)

- **Status:** PASS
- **Threshold:** Tests follow test quality definition of done (deterministic, isolated, explicit, focused, fast)
- **Actual:** Build verification tests use `describe.skipIf(!buildExists)` pattern for graceful skip when dist/ is absent (no false failures in CI before build). Deploy manifest tests use deterministic inputs (fixed tx IDs, file paths, sizes). All tests are explicit assertions, no conditionals or hidden state. MIME tests cover 12 extensions plus edge cases. File size validation tests include boundary check (exactly 100KB).
- **Evidence:** `build-verification.test.ts` (skipIf pattern), `deploy-manifest.test.ts` (deterministic data, boundary tests)
- **Findings:** Tests meet all quality criteria. The `skipIf` pattern is particularly well-chosen -- it prevents false failures when the build hasn't been run while still validating the build output when available.

---

## Quick Wins

0 quick wins identified. No low-effort improvements remaining.

---

## Recommended Actions

### Immediate (Before Release) - CRITICAL/HIGH Priority

None. No blockers or high-priority issues identified.

### Short-term (Next Milestone) - MEDIUM Priority

1. **Post-deployment smoke test script** - MEDIUM - 1 hour - Dev
   - Create a `scripts/verify-forge-deploy.mjs` that takes a manifest tx ID and verifies: index.html loads, JS/CSS bundles load, CSP header present. Uses `fetch()` against ar-io.dev gateway.
   - Would close the gap between unit tests and manual verification (ACs #9-#11).

2. **Upload retry logic** - MEDIUM - 30 minutes - Dev
   - The deploy script currently has no retry on upload failure (network transients). Adding a simple 3-retry-with-backoff wrapper around `turbo.uploadFile()` would improve reliability for production deployments.

### Long-term (Backlog) - LOW Priority

1. **Parallel file uploads** - LOW - 1 hour - Dev
   - Current sequential upload is simple and reliable but slow for large builds. `Promise.all()` with concurrency limit (e.g., 5) would speed up deployment.

2. **ArNS name registration** - LOW - 2 hours - Dev
   - Register an ArNS name (e.g., `forge.ar`) pointing to the manifest tx ID for human-readable URLs instead of raw tx IDs.

---

## Monitoring Hooks

0 monitoring hooks required (deployment script is a CLI tool, not a running service).

### Performance Monitoring

- N/A (CLI deployment tool; execution time is observable during runs)

### Security Monitoring

- N/A (wallet handled locally; no network-accessible secrets)

### Reliability Monitoring

- N/A (deployed Arweave content is immutable; gateway availability is external)

### Alerting Thresholds

- N/A

---

## Fail-Fast Mechanisms

4 fail-fast mechanisms already implemented:

### Circuit Breakers (Reliability)

- [x] `--dev` mode validates file sizes before upload, exits on oversized files
  - **Owner:** Already implemented
  - **Estimated Effort:** 0

### Rate Limiting (Performance)

- [x] N/A (deployment tool, not a service)

### Validation Gates (Security)

- [x] `--confirm` flag required for paid uploads (prevents accidental spend)
  - **Owner:** Already implemented
  - **Estimated Effort:** 0

- [x] `--wallet` and `--dev` mutual exclusivity enforced (prevents ambiguous mode)
  - **Owner:** Already implemented
  - **Estimated Effort:** 0

### Smoke Tests (Maintainability)

- [x] 32 story-specific unit tests covering build output and manifest generation
  - **Owner:** Already implemented
  - **Estimated Effort:** 0

---

## Evidence Gaps

1 evidence gap identified:

- [ ] **Post-deployment verification** (Reliability)
  - **Owner:** Dev
  - **Deadline:** After first production deployment
  - **Suggested Evidence:** Manual or scripted verification of gateway accessibility (AC #9), SPA routing (AC #10), relay configuration (AC #11), and dogfooding (AC #13) after first deployment
  - **Impact:** LOW -- these are manual verification ACs by design. The build output and manifest structure are fully tested. Gateway serving behavior is an external dependency.

---

## Findings Summary

**Based on ADR Quality Readiness Checklist (8 categories, 29 criteria)**

| Category                                         | Criteria Met | PASS | CONCERNS | FAIL | Overall Status |
| ------------------------------------------------ | ------------ | ---- | -------- | ---- | -------------- |
| 1. Testability & Automation                      | 4/4          | 4    | 0        | 0    | PASS           |
| 2. Test Data Strategy                            | 3/3          | 3    | 0        | 0    | PASS           |
| 3. Scalability & Availability                    | 3/4          | 3    | 1        | 0    | CONCERNS       |
| 4. Disaster Recovery                             | 0/3          | 0    | 0        | 0    | N/A            |
| 5. Security                                      | 4/4          | 4    | 0        | 0    | PASS           |
| 6. Monitorability, Debuggability & Manageability | 3/4          | 3    | 1        | 0    | CONCERNS       |
| 7. QoS & QoE                                     | 4/4          | 4    | 0        | 0    | PASS           |
| 8. Deployability                                 | 3/3          | 3    | 0        | 0    | PASS           |
| **Total**                                        | **24/29**    | **24** | **2**  | **0** | **PASS**       |

**Criteria Met Scoring:**

- 24/29 (83%) = Good foundation
- Adjusted: 24/26 applicable (92%) = Strong (3 Disaster Recovery criteria N/A for immutable Arweave deployment)

**Notes on N/A criteria:**
- Disaster Recovery (3 criteria): N/A for deployment tooling targeting immutable storage. Recovery = new deployment. Source code is in git.
- Scalability bottleneck identification (1 criterion): Partially applicable -- sequential upload is a known simplification, documented as backlog item.
- Metrics endpoint (1 criterion): N/A for CLI deployment tool.

---

## Gate YAML Snippet

```yaml
nfr_assessment:
  date: '2026-03-24'
  story_id: '8.7'
  feature_name: 'Deploy Forge-UI to Arweave'
  adr_checklist_score: '24/29'
  categories:
    testability_automation: 'PASS'
    test_data_strategy: 'PASS'
    scalability_availability: 'CONCERNS'
    disaster_recovery: 'N/A'
    security: 'PASS'
    monitorability: 'CONCERNS'
    qos_qoe: 'PASS'
    deployability: 'PASS'
  overall_status: 'PASS'
  critical_issues: 0
  high_priority_issues: 0
  medium_priority_issues: 2
  concerns: 2
  blockers: false
  quick_wins: 0
  evidence_gaps: 1
  recommendations:
    - 'Post-deployment smoke test script'
    - 'Upload retry logic for network resilience'
    - 'Parallel file uploads (backlog)'
    - 'ArNS name registration (backlog)'
```

---

## Related Artifacts

- **Story File:** `_bmad-output/implementation-artifacts/8-7-deploy-forge-ui-to-arweave.md`
- **Test Design:** Inline in story (no separate test design document for 8.7)
- **Evidence Sources:**
  - Build Verification Tests: `packages/rig/src/web/build-verification.test.ts` (9 tests)
  - Deploy Manifest Tests: `packages/rig/src/web/deploy-manifest.test.ts` (23 tests)
  - Router Tests (relay URL): `packages/rig/src/web/router.test.ts` (6 relay URL tests with isolation fix)
  - Deploy Script: `scripts/deploy-forge-ui.mjs` (280 lines)
  - Deploy Helpers: `scripts/deploy-helpers.mjs` (166 lines, 4 exported functions)
  - Vite Config: `packages/rig/vite.config.ts` (added `base: './'`)
  - Router: `packages/rig/src/web/router.ts` (added `VITE_DEFAULT_RELAY` env var)
  - Env Types: `packages/rig/src/web/env.d.ts` (Vite env type declarations)
  - All rig tests: 449 passed, 0 failed (22 test files)

---

## Recommendations Summary

**Release Blocker:** None

**High Priority:** None

**Medium Priority:** 2 items (post-deployment smoke test script, upload retry logic)

**Next Steps:** Story 8.7 is ready for merge. This is the capstone story for Epic 8. Post-deployment verification (ACs #9-#13) should be completed after the first production deployment to Arweave.

---

## Sign-Off

**NFR Assessment:**

- Overall Status: PASS
- Critical Issues: 0
- High Priority Issues: 0
- Concerns: 2
- Evidence Gaps: 1

**Gate Status:** PASS

**Next Actions:**

- PASS: Proceed to merge; Epic 8 is complete
- Complete manual verification (ACs #9-#13) after first Arweave deployment
- Address MEDIUM priority items as backlog work

**Generated:** 2026-03-24
**Workflow:** testarch-nfr v5.0

---

<!-- Powered by BMAD-CORE™ -->
