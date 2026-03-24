# E2E & Skipped Test Debt Triage

**Date:** 2026-03-22
**Source:** Epic 7 retrospective action item #1
**Status:** Triaged -- deferred to dedicated effort (Epic 9 or standalone sprint)

---

## Summary

The monorepo has **112 `it.skip()` tests** across 17 files. Of these, **79 are counted as "skipped"** in the test suite (the remainder are in excluded directories like `__integration__/`). The retro noted ~31 deferred E2E items across Epics 3-7, with zero E2E tests executed for 2 consecutive epics (6 and 7).

The debt falls into three categories:

1. **Rig package ATDD stubs (Epic 8)** -- 92 skipped tests that are intentional red-phase TDD stubs awaiting implementation
2. **Infrastructure-dependent E2E** -- 6 tests requiring live genesis/Docker infrastructure
3. **TEE attestation stubs** -- 5 tests requiring Oyster CVM infrastructure

---

## Detailed Inventory

### Category 1: Rig Package ATDD Stubs (92 skipped)

These are intentional red-phase stubs created for Epic 8 (`@toon-protocol/rig`). They are NOT debt -- they are planned work.

| File | Count | Priority | Description |
|------|-------|----------|-------------|
| `packages/rig/src/git/operations.test.ts` | 19 | P0 | Git operations: execFile safety, path traversal, patch validation |
| `packages/rig/src/web/templates.test.ts` | 14 | P0-P3 | Web templates: XSS escaping, empty state, blame view |
| `packages/rig/src/identity/pubkey-identity.test.ts` | 12 | P0-P2 | Pubkey identity: maintainer auth, git author, kind:0 profile |
| `packages/rig/src/index.test.ts` | 9 | P3 | CLI flag parsing: mnemonic, relay-url, http-port, repo-dir |
| `packages/rig/src/handlers/pr-lifecycle-handler.test.ts` | 7 | P0-P1 | PR lifecycle: merge auth, status transitions |
| `packages/rig/src/handlers/issue-comment-handler.test.ts` | 6 | P1 | Issue/comment handling: accept/reject, decode |
| `packages/rig/src/__integration__/repo-creation.test.ts` | 6 | P0-P1 | Repo creation integration: bare git, metadata, duplicates |
| `packages/rig/src/__integration__/pr-lifecycle.test.ts` | 6 | P0-P1 | PR lifecycle integration: merge, close, draft, open |
| `packages/rig/src/__integration__/web-routes.test.ts` | 6 | P1-P2 | Web routes integration: repo list, file tree, commits |
| `packages/rig/src/__integration__/relay-integration.test.ts` | 5 | P2 | Relay integration: issues, PRs, comments, degradation |
| `packages/rig/src/__integration__/patch-handler.test.ts` | 5 | P0-P1 | Patch handler integration: apply, reject, attribution |
| `packages/rig/src/handlers/repo-creation-handler.test.ts` | 5 | P1-P2 | Repo creation handler: git verify, unsupported kinds |
| `packages/rig/src/__integration__/git-http-backend.test.ts` | 4 | P1-P3 | Git HTTP backend: smart HTTP, fetch, 404, push rejection |

**Action:** These will be implemented as part of Epic 8 stories. No separate effort needed.

### Category 2: Infrastructure-Dependent E2E (7 skipped)

These tests require live infrastructure (genesis node, Anvil, Docker peers) to execute.

| File | Count | Priority | Description |
|------|-------|----------|-------------|
| `packages/town/src/handlers/x402-publish-handler.test.ts` | 1 | P3 | Full x402 E2E: Anvil + Faucet + Connector + Relay |
| `packages/core/src/discovery/seed-relay-discovery.test.ts` | 1 | P3 | Seed relay discovery with live genesis node |
| `packages/core/src/bootstrap/attestation-bootstrap.test.ts` | 5 | P3 | Docker compose validation, process readiness, CVM deployment |

**Action:** Defer to dedicated E2E infrastructure sprint. These require `./deploy-genesis-node.sh` or `./scripts/sdk-e2e-infra.sh up` running. Consider adding a CI job that spins up infrastructure and runs these.

### Category 3: Nix Build Reference (1 mention, not actually skipped)

| File | Count | Description |
|------|-------|-------------|
| `packages/core/src/build/nix-reproducibility.test.ts` | 1 | Comment mentions `it.skip()` in TDD history; tests are now active |

**Action:** None -- this is resolved. The `it.skip()` reference is in a comment only.

---

## Epics Contributing Debt

| Epic | Contribution | Notes |
|------|-------------|-------|
| Epic 3 (TEE) | 5 attestation stubs | Require Oyster CVM or Docker infrastructure |
| Epic 4 (Nix/Build) | 0 active debt | Nix tests converted to active in green phase |
| Epic 5 (DVM) | 0 active debt | All DVM tests are active |
| Epic 6 (Coordination) | 0 active debt | Workflow/swarm tests are active |
| Epic 7 (ILP Hierarchy) | 0 active debt | All fee/address tests are active |
| Epic 8 (Rig) | 92 ATDD stubs | Planned work, not debt |

---

## Recommendations

1. **Do NOT count rig ATDD stubs as debt** -- they are planned Epic 8 work
2. **True E2E debt is 6 tests** (x402 + seed relay + attestation) requiring live infra
3. **Add CI E2E job** that runs `sdk-e2e-infra.sh up` and executes Docker E2E tests on PR merge
4. **Track the 79 "skipped" count** -- it should decrease as Epic 8 progresses
5. **Epic 9+ should not ship with >5 new skipped tests** without explicit retro acknowledgment
