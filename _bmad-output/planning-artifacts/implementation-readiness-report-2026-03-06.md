---
stepsCompleted:
  - step-01-document-discovery
  - step-02-prd-analysis
  - step-03-epic-coverage-validation
  - step-04-ux-alignment
  - step-05-epic-quality-review
  - step-06-final-assessment
filesIncluded:
  - architecture.md
  - epics.md
  - test-design-epic-1.md
  - test-design-epic-2.md
scope: "Epics 3 and 4"
---

# Implementation Readiness Assessment Report

**Date:** 2026-03-06
**Project:** toon
**Scope:** Epics 3 and 4

## Document Inventory

### Documents Found
| Document Type | File | Status |
|---|---|---|
| Architecture | `architecture.md` | Found |
| Epics & Stories | `epics.md` | Found |
| Test Design (Epic 1) | `test-design-epic-1.md` | Found |
| Test Design (Epic 2) | `test-design-epic-2.md` | Found |

### Documents Not Found
| Document Type | Impact |
|---|---|
| PRD | Will limit requirements traceability |
| UX Design | Will limit UX validation |

### Supporting Research
- `research/technical-marlin-integration-research-2026-03-05.md`
- `research/marlin-party-mode-decisions-2026-03-05.md`
- `research/technical-nodejs-typescript-git-hosting-alternatives-to-forgejo-research-2026-03-03.md`
- `research/toon-byte-testing-pattern.md`

## PRD Analysis

**Status: PRD NOT FOUND**

No PRD document exists in the planning artifacts. Requirements traceability will be assessed against the architecture document and the epic/story definitions themselves.

### Functional Requirements
- Cannot be extracted — no PRD exists

### Non-Functional Requirements
- Cannot be extracted — no PRD exists

### PRD Completeness Assessment
**GAP:** The absence of a PRD means there is no single source of truth for requirements. Epic coverage validation in the next step will rely on the architecture document and internal epic consistency.

**Note:** The epics document itself contains a Requirements Inventory section and explicitly states it "supersedes docs/prd/ (v3.0, 2026-02-17) as the requirements baseline for the SDK phase." FRs are extracted from this inventory.

### Extracted Functional Requirements (Epics 3 & 4 Scope)

**Epic 3 — Production Protocol Economics (6 FRs):**
- FR-PROD-1: USDC as sole user-facing payment token, replacing AGENT dev token
- FR-PROD-2: Multi-environment chain config — Anvil / Arbitrum Sepolia / Arbitrum One with env var overrides
- FR-PROD-3: x402 /publish endpoint — HTTP 402 negotiation with EIP-3009 gasless USDC authorization, constructs ILP PREPARE packets
- FR-PROD-4: Seed relay discovery — kind:10036 events on public Nostr relays, replaces genesis hub-and-spoke
- FR-PROD-5: kind:10035 service discovery events — machine-readable pricing, capabilities, endpoint advertisement
- FR-PROD-6: Enriched /health endpoint — peer count, channel count, pricing, service capabilities

**Epic 4 — Marlin TEE Deployment (6 FRs):**
- FR-TEE-1: Oyster CVM packaging — Docker image adapted for Marlin Oyster with attestation server config
- FR-TEE-2: kind:10033 TEE attestation events — PCR values, enclave image hash, attestation documents
- FR-TEE-3: Attestation-aware peering — BootstrapService verifies kind:10033, prefers attested peers
- FR-TEE-4: Nautilus KMS identity — persistent enclave-bound Nostr keypairs, identity tied to code integrity
- FR-TEE-5: Nix reproducible builds — deterministic PCR values, CI reproducibility verification
- FR-TEE-6: Attestation-first seed relay bootstrap — kind:10033 verification integrated into seed relay flow

**Total FRs in scope: 12**

## Epic Coverage Validation

### Coverage Matrix

| FR | Requirement Summary | Story Coverage | Architecture Support | Status |
|---|---|---|---|---|
| FR-PROD-1 | USDC token migration | Story 3.1 | Decision 10 (Mock USDC), `docker/scripts/deploy-usdc.ts` | Covered |
| FR-PROD-2 | Multi-chain configuration | Story 3.2 | Decision 8 (Chain presets), `core/chain/presets.ts` | Covered |
| FR-PROD-3 | x402 /publish endpoint | Story 3.3 | Decisions 7, 9, Pattern 13, `town/http/publish.ts` | Covered |
| FR-PROD-4 | Seed relay discovery | Story 3.4 | `town/discovery/seed-relay.ts`, `core/events/seed-relay.ts` | Covered |
| FR-PROD-5 | kind:10035 service discovery | Story 3.5 | `town/discovery/service-discovery.ts`, `core/events/service-discovery.ts` | Covered |
| FR-PROD-6 | Enriched /health | Story 3.6 | Pattern 15, `town/http/health.ts` | Covered |
| FR-TEE-1 | Oyster CVM packaging | Story 4.1 | Decision 11, `docker/docker-compose-oyster.yml` | Covered |
| FR-TEE-2 | TEE attestation events | Story 4.2 | Decision 12, Pattern 14, `core/events/attestation.ts` | Covered |
| FR-TEE-3 | Attestation-aware peering | Story 4.3 | `core/bootstrap/` extension | Covered |
| FR-TEE-4 | Nautilus KMS identity | Story 4.4 | `docker/src/entrypoint.ts` KMS integration | Covered |
| FR-TEE-5 | Nix reproducible builds | Story 4.5 | Decision 11 constraint, `docker/Dockerfile.nix` | Covered |
| FR-TEE-6 | Attestation-first bootstrap | Story 4.6 | `core/bootstrap/` seed relay + attestation verification | Covered |

### Coverage Statistics

- Total FRs in scope: 12
- FRs covered in stories: 12
- Coverage percentage: **100%**
- All FRs have 1:1 story mapping with architecture file location support

## UX Alignment Assessment

### UX Document Status

**Not Found** — No UX design document exists in planning artifacts.

### UX Relevance to Epics 3 & 4

**Not Required.** Both epics are backend protocol and infrastructure work:

- **Epic 3** (Production Protocol Economics): USDC migration, chain configuration, x402 HTTP endpoint, seed relay discovery, service discovery events, /health endpoint — all programmatic APIs consumed by machines, agents, and SDK clients. No visual UI.
- **Epic 4** (Marlin TEE Deployment): CVM packaging, attestation events, peering logic, KMS identity, Nix builds — entirely infrastructure/DevOps. No visual UI.

### Warnings

- **None for Epics 3 & 4.** UX documentation would be needed for Epic 5 (The Rig — web UI with Eta templates), but that is out of scope for this assessment.
- The `/health` endpoint (Story 3.6) returns JSON — it is a machine-readable API, not a user-facing page.

## Epic Quality Review

### Epic 3: Production Protocol Economics

**Best Practices Compliance:**

- [x] Epic delivers user value — operators deploy with real USDC, agents publish via x402
- [x] Epic can function independently — works without Epic 4 (TEE)
- [x] Stories appropriately sized — 5 of 6 are well-sized (see Story 3.3 note below)
- [x] No forward dependencies — all dependencies are backward (within-epic or to prior epics)
- [x] Clear acceptance criteria — all 6 stories have Given/When/Then ACs
- [x] Traceability to FRs maintained — 1:1 mapping

**Dependency DAG (clean, no cycles):**
```
3.1 (USDC) ──────────────> 3.2 (Chain) ──> 3.3 (x402)
  │
  ├──> 3.5 (Service Discovery) ──> 3.6 (/health)
  │
3.4 (Seed Relay — no internal deps)
```

### Epic 4: Marlin TEE Deployment

**Best Practices Compliance:**

- [x] Epic delivers user value — one-command TEE deployment with attestation trust
- [x] Epic can function independently — backward deps only (Epic 3 Story 3.4 for Story 4.6)
- [ ] **Stories NOT appropriately sized — placeholders only, not decomposed**
- [ ] **No acceptance criteria — all 6 stories lack Given/When/Then ACs**
- [x] Traceability to FRs maintained — 1:1 mapping
- [ ] **No test approach documented for any story**

---

### Quality Findings

#### Critical Violations

**None.**

#### Major Issues

**MAJOR-1: Epic 4 stories are not decomposed.**
The epics document explicitly states: "Stories: TBD (to be decomposed when epic starts)." Stories 4.1-4.6 are 1-2 sentence placeholders without:
- Given/When/Then acceptance criteria
- Detailed dependency specifications
- Test approach notes
- Error condition coverage
- Clear sizing information

**Impact:** Epic 4 is NOT implementation-ready. Stories must be fully decomposed before development begins.
**Remediation:** Run the BMAD `epic-start` workflow for Epic 4 to decompose stories with full acceptance criteria before any implementation.

**MAJOR-2: No test design exists for Epics 3 or 4.**
Test design documents exist for Epics 1 and 2 (`test-design-epic-1.md`, `test-design-epic-2.md`) but none for Epics 3 or 4.
**Remediation:** Create test design documents as part of the `epic-start` workflow for each epic.

#### Minor Concerns

**MINOR-1: Epic titles are technical, not user-centric.**
- "Production Protocol Economics" could be "Operators deploy with real USDC on Arbitrum"
- "Marlin TEE Deployment" could be "Operators deploy trusted nodes with one command"
**Impact:** Low — the epic descriptions compensate with clear value statements.

**MINOR-2: Story 3.3 (x402 /publish) is potentially oversized.**
This story includes: HTTP 402 negotiation, EIP-3009 signature verification, on-chain USDC settlement, ILP PREPARE construction, multi-hop pricing query, and response handling. It has 6 ACs and spans significant technical scope.
**Impact:** May need splitting during sprint planning if it exceeds a single sprint.
**Remediation:** Consider splitting into (a) EIP-3009 verification + settlement and (b) ILP PREPARE construction + routing. Or accept as-is if sprint velocity allows.

**MINOR-3: Architecture deferred decisions for Epic 4.**
The architecture document notes 3 deferred decisions:
- Nautilus KMS integration specifics — depends on Marlin SDK version
- Nix build configuration — depends on final Docker image structure
- PCR measurement registry — depends on attestation verification contract

These are expected to be resolved during Epic 4's `epic-start` workflow but represent open questions.

### Recommendations Summary

| Priority | Issue | Action |
|---|---|---|
| **High** | Epic 4 stories not decomposed | Run `epic-start` for Epic 4 before implementation |
| **High** | No test design for Epics 3 or 4 | Create test design during `epic-start` for each |
| **Medium** | Story 3.3 potentially oversized | Review during sprint planning, consider splitting |
| **Low** | Epic titles are technical | Optional — descriptions provide adequate context |
| **Low** | Deferred architecture decisions for Epic 4 | Resolve during Epic 4 `epic-start` |

## Summary and Recommendations

### Overall Readiness Status

**Epic 3: READY** — Fully decomposed with 6 stories, complete acceptance criteria, clean dependency DAG, 100% FR coverage, and full architecture support (Decisions 7-10, Patterns 10-13). Can proceed to `epic-start` and implementation.

**Epic 4: NEEDS WORK** — FR coverage and architecture support are solid, but stories are placeholders only. Must be fully decomposed with acceptance criteria before implementation begins.

### Critical Issues Requiring Immediate Action

1. **Epic 4 stories must be decomposed** — This is the only blocking issue. Run `epic-start` for Epic 4 to produce full Given/When/Then acceptance criteria, dependency specifications, and test approach notes for all 6 stories. The high-level FR-to-story mapping is correct; the gap is in story detail, not coverage.

### Recommended Next Steps

1. **Epic 3:** Run `epic-start` to create test design, establish baseline, and begin implementation. All planning artifacts are sufficient.
2. **Epic 4:** Run `epic-start` to decompose Stories 4.1-4.6 with full acceptance criteria, resolve the 3 deferred architecture decisions (Nautilus KMS specifics, Nix build config, PCR measurement registry), and create test design.
3. **Story 3.3 sizing:** Review during sprint planning. If too large, split into (a) EIP-3009 verification + on-chain settlement and (b) ILP PREPARE construction + x402 HTTP handling.
4. **Sequencing:** Epic 3 can start immediately (after Epic 2 completion). Epic 4 story decomposition can happen in parallel with Epic 3 development.

### Assessment Scorecard

| Dimension | Epic 3 | Epic 4 |
|---|---|---|
| FR Coverage | 6/6 (100%) | 6/6 (100%) |
| Architecture Support | Full (Decisions 7-10, Patterns 10-13) | Full (Decisions 11-12, Patterns 14-16) |
| Story Decomposition | Complete (6 stories with ACs) | **Placeholders only** |
| Acceptance Criteria | All Given/When/Then | **Missing** |
| Dependencies | Clean backward DAG | Backward to Epic 3 (OK) |
| Test Design | **Missing** (create during epic-start) | **Missing** (create during epic-start) |
| UX Requirements | N/A (backend/protocol) | N/A (infrastructure) |

### Final Note

This assessment identified **5 issues** across **3 severity categories** (0 critical violations, 2 major issues, 3 minor concerns). The major issues are actionable through the standard BMAD `epic-start` workflow. Epic 3 is implementation-ready pending test design creation. Epic 4 requires story decomposition before implementation can begin.

**Assessed by:** Implementation Readiness Workflow
**Date:** 2026-03-06
**Scope:** Epics 3 and 4 of the TOON SDK epic breakdown
