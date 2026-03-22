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
lastSaved: '2026-03-22'
---

# Test Design: Epic 8 — The Rig (Arweave DVM + Forge-UI)

**Date:** 2026-03-22
**Author:** Jonathan
**Status:** Draft

---

## Executive Summary

**Scope:** Full test design for Epic 8 — The Rig. 7 stories (8.0-8.6) covering: Arweave Storage DVM provider (kind:5094), Forge-UI static web frontend (5 stories), and Arweave deployment (dogfooding). This epic introduces the first client-side web application in the monorepo and the first external dependency on Arweave infrastructure.

**Risk Summary:**

- Total risks identified: 12
- High-priority risks (>=6): 4
- Critical categories: EXT (3 risks), DATA (2 risks), TECH (2 risks)

**Coverage Summary:**

- P0 scenarios: 14 (~25-40 hours)
- P1 scenarios: 16 (~20-35 hours)
- P2/P3 scenarios: 12 (~8-15 hours)
- **Total effort**: ~53-90 hours (~2-3 weeks)

---

## Not in Scope

| Item | Reasoning | Mitigation |
| --- | --- | --- |
| **NIP-34 agent skill (git protocol knowledge)** | Moved to Epic 9 (Stories 9.26-9.30) | Forge-UI consumes event structures defined by Epic 9 skills; tested via mock data |
| **Write operations in Forge-UI** | Forge-UI is read-only; writes require a TOON agent/client | Banner explains write requirements |
| **NIP-90 DVM code review** | Architecturally enabled but explicitly out of Epic 8 scope | Future epic |
| **ArNS name registration** | Optional deployment enhancement; tx ID access is sufficient | Document ArNS as post-deploy step |
| **Performance/load testing for Arweave gateway** | External service; no SLA we control | Monitor latency in production |
| **Multi-relay failover for Forge-UI** | Single relay is accepted trade-off for MVP | URL parameter allows switching relays |

---

## 1. Risk Inventory

### High-Priority Risks (Score >= 6)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| E8-R001 | EXT | **Arweave upload reliability** — ArDrive/Turbo SDK upload may fail silently, return invalid tx IDs, or timeout. Free tier (≤100KB) has undocumented rate limits. Network congestion can delay finality. | 3 | 2 | 6 | Retry with exponential backoff; verify tx ID via gateway fetch; timeout per upload; integration tests use real ArDrive free tier | Dev | Story 8.0 |
| E8-R002 | EXT | **`@ardrive/turbo-sdk` vulnerability surface** — 31 known vulnerabilities in dependency tree. SDK is the sole upload path to Arweave. Breaking changes or CVEs could block uploads. | 2 | 3 | 6 | Pin exact version; `pnpm audit` in CI; isolate turbo-sdk behind adapter interface for future replacement; static analysis test for dependency count | Dev | Story 8.0 |
| E8-R003 | DATA | **Chunked upload state management** — Provider accumulates chunks in memory keyed by `uploadId`. Missing chunks, duplicate chunks, out-of-order arrival, timeout races, and memory exhaustion from abandoned uploads. | 3 | 2 | 6 | Unit test all chunk state transitions; timeout sweeper for partial uploads; memory cap per uploadId; integration test with deliberate chunk loss | Dev | Story 8.0 |
| E8-R004 | DATA | **Git object parsing correctness** — Forge-UI parses raw git objects (tree, commit, blob) fetched from Arweave. Incorrect parsing breaks file tree, commit log, diff, and blame. No git binary available in browser. | 2 | 3 | 6 | Comprehensive unit tests with real git object fixtures; roundtrip tests (create object → upload → parse); edge cases (binary blobs, large trees, merge commits, unicode paths) | Dev | Stories 8.2-8.4 |

### Medium-Priority Risks (Score 3-4)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E8-R005 | TECH | **First web app in monorepo** — No existing browser build pipeline, test infrastructure, or component test patterns. Build tool selection (Vite likely) introduces new toolchain. | 2 | 2 | 4 | Establish browser vitest config in Story 8.1; use jsdom or happy-dom for unit tests; defer headless browser tests to P2 | Dev |
| E8-R006 | DATA | **NIP-34 TOON encoding/decoding** — kind:30617, 1617, 1621, 1622, 1618, 1619, 1630-1633, 30618 events must roundtrip through TOON codec. Forge-UI reads TOON-format responses from relay. | 2 | 2 | 4 | Builder/parser roundtrip tests for each NIP-34 kind; Forge-UI queries tested against TOON-encoded mock data | Dev |
| E8-R007 | EXT | **Arweave gateway availability** — Forge-UI depends on `arweave.net` or `gateway.irys.xyz` at runtime. Gateway downtime = broken file tree/blob views. | 2 | 2 | 4 | Fallback gateway list; graceful degradation with "content unavailable" message; gateway health check on app load | Dev |
| E8-R008 | TECH | **Tree-to-tree diff computation in browser** — No `git diff` available. Must implement tree comparison and unified diff generation in JavaScript. Expensive for large trees. | 2 | 2 | 4 | Unit test diff algorithm with known git fixtures; progressive loading for large diffs; cap diff size | Dev |
| E8-R009 | TECH | **Blame computation performance** — Walking commit history from Arweave requires sequential fetches (commit → parent → ...). Blame for files with long history may timeout or OOM. | 2 | 2 | 4 | Depth limit on blame walks; caching of fetched objects; progressive rendering; unit test with bounded history | Dev |

### Low-Priority Risks (Score 1-2)

| Risk ID | Category | Description | Probability | Impact | Score | Action |
| --- | --- | --- | --- | --- | --- | --- |
| E8-R010 | BUS | **Forgejo template port fidelity** — Visual differences between Forgejo Go templates and client-side JS port | 1 | 2 | 2 | Monitor; pixel comparison is out of scope |
| E8-R011 | OPS | **Arweave deployment of SPA** — kind:5094 dogfooding requires manifest transaction for multi-file SPA | 1 | 2 | 2 | Integration test: upload + retrieve single HTML file first |
| E8-R012 | TECH | **Prepaid DVM pricing validation** — `ctx.amount < kindPricing[5094] * rawBytes.length` edge cases (zero-length blob, overflow, floating point) | 1 | 2 | 2 | Unit test boundary values |

### Risk Category Legend

- **TECH**: Technical/Architecture (flaws, integration, scalability)
- **EXT**: External Dependencies (third-party services, SDKs, availability)
- **DATA**: Data Integrity (parsing, state management, encoding)
- **BUS**: Business Impact (UX, logic errors)
- **OPS**: Operations (deployment, config)

---

## 2. Test Strategy Per Story

### Story 8.0: Arweave Storage DVM Provider (kind:5094)

**Unit Test Targets:**

| Test ID | Target | Description | Risk Link |
| --- | --- | --- | --- |
| 8.0-UNIT-001 | `buildBlobStorageRequest()` | Produces valid kind:5094 event with base64 blob in `i` tag | — |
| 8.0-UNIT-002 | `parseBlobStorageRequest()` | Roundtrip: build → parse returns original `{ blobData, contentType }` | — |
| 8.0-UNIT-003 | `parseBlobStorageRequest()` | Returns null for malformed events (missing `i` tag, invalid base64, wrong kind) | E8-R003 |
| 8.0-UNIT-004 | Pricing validator | Rejects when `ctx.amount < kindPricing[5094] * rawBytes.length` with F04 | E8-R012 |
| 8.0-UNIT-005 | Pricing validator | Accepts when `ctx.amount >= kindPricing[5094] * rawBytes.length` | — |
| 8.0-UNIT-006 | Pricing validator | Edge cases: zero-length blob, maximum size blob, exact boundary | E8-R012 |
| 8.0-UNIT-007 | Chunk state manager | Tracks chunks by `uploadId` with `chunkIndex` and `totalChunks` | E8-R003 |
| 8.0-UNIT-008 | Chunk state manager | Detects all-chunks-received and triggers assembly | E8-R003 |
| 8.0-UNIT-009 | Chunk state manager | Duplicate chunk index rejected gracefully | E8-R003 |
| 8.0-UNIT-010 | Chunk state manager | Timeout sweeper discards partial uploads after expiry | E8-R003 |
| 8.0-UNIT-011 | Chunk state manager | Memory cap: rejects new uploads when too many active uploadIds | E8-R003 |
| 8.0-UNIT-012 | Service discovery | `SkillDescriptor` includes `kinds: [5094]` and `pricing` | — |
| 8.0-UNIT-013 | Turbo adapter | Adapter interface wraps `TurboAuthenticatedClient.uploadFile()` | E8-R002 |

**Integration Test Targets:**

| Test ID | Target | Description | Risk Link |
| --- | --- | --- | --- |
| 8.0-INT-001 | Single-packet upload | Real ArDrive/Turbo free tier (≤100KB payload) → verify tx ID in FULFILL → fetch from `arweave.net/<tx-id>` returns original bytes | E8-R001 |
| 8.0-INT-002 | Chunked upload | Multiple small chunks (each ≤100KB, free tier) → verify assembly → final FULFILL contains tx ID | E8-R001, E8-R003 |
| 8.0-INT-003 | Chunk timeout | Send partial chunks, wait for timeout, verify discard (no Arweave upload) | E8-R003 |
| 8.0-INT-004 | Service discovery flow | Provider publishes kind:10035 → client queries → discovers pricing → sends kind:5094 with correct amount | — |
| 8.0-INT-005 | Insufficient payment rejection | Send kind:5094 with underpayment → F04 rejection → no Arweave upload | — |

**E2E Test Targets:**

| Test ID | Target | Description | Risk Link |
| --- | --- | --- | --- |
| 8.0-E2E-001 | Full DVM lifecycle | Docker infra (`sdk-e2e-infra.sh`) + Arweave DVM handler on one peer → client sends kind:5094 via ILP → provider uploads to ArDrive/Turbo (real Arweave) → client receives tx ID → verify retrieval | E8-R001 |
| 8.0-E2E-002 | Chunked DVM lifecycle | Same as above but with chunked upload (blob > 512KB split into chunks) | E8-R001, E8-R003 |

**ATDD Stubs:**

- `packages/core/src/events/arweave-storage-builders.test.ts` — builder/parser roundtrip
- `packages/core/src/events/arweave-storage-parsers.test.ts` — malformed input handling
- `packages/sdk/src/handlers/arweave-dvm-handler.test.ts` — handler unit tests (pricing, chunk state)
- `packages/sdk/src/__integration__/arweave-dvm-upload.test.ts` — real ArDrive integration
- `packages/sdk/tests/e2e/docker-arweave-dvm-e2e.test.ts` — Docker E2E

---

### Story 8.1: Forge-UI — Layout and Repository List

**Unit Test Targets:**

| Test ID | Target | Description | Risk Link |
| --- | --- | --- | --- |
| 8.1-UNIT-001 | Relay query builder | Produces correct filter for kind:30617 events | E8-R006 |
| 8.1-UNIT-002 | Repo list renderer | Given kind:30617 events, renders name, description, owner, default branch | — |
| 8.1-UNIT-003 | Repo list renderer | Empty state when no repos exist | — |
| 8.1-UNIT-004 | Profile enrichment | Fetches kind:0 for pubkey; missing profile falls back to truncated npub | — |
| 8.1-UNIT-005 | Relay URL config | Configurable via URL parameter or settings | — |
| 8.1-UNIT-006 | TOON format parsing | Correctly decodes TOON-encoded kind:30617 from relay WebSocket | E8-R006 |

**Integration Test Targets:**

| Test ID | Target | Description | Risk Link |
| --- | --- | --- | --- |
| 8.1-INT-001 | Static HTML renders repo list | Build app → inject mock relay data → verify DOM contains expected repos | E8-R005 |
| 8.1-INT-002 | Navigation | Click repo name → navigates to file tree view | — |

**ATDD Stubs:**

- `packages/rig/src/web/repo-list.test.ts` — unit tests
- `packages/rig/src/web/relay-query.test.ts` — relay query builder
- `packages/rig/src/web/__integration__/repo-list-render.test.ts` — DOM render

---

### Story 8.2: Forge-UI — File Tree and Blob View

**Unit Test Targets:**

| Test ID | Target | Description | Risk Link |
| --- | --- | --- | --- |
| 8.2-UNIT-001 | Git tree object parser | Parses raw tree bytes into `{ mode, name, sha }[]` entries | E8-R004 |
| 8.2-UNIT-002 | Git tree object parser | Handles edge cases: empty tree, unicode filenames, symlinks, submodules | E8-R004 |
| 8.2-UNIT-003 | Git commit object parser | Extracts tree SHA, parent SHAs, author, committer, message | E8-R004 |
| 8.2-UNIT-004 | Git blob display | Raw bytes → UTF-8 text with syntax highlighting | — |
| 8.2-UNIT-005 | Git blob display | Binary blob detection → "binary file" message | E8-R004 |
| 8.2-UNIT-006 | Arweave fetch | Constructs correct URL from tx ID; handles 404 | E8-R007 |
| 8.2-UNIT-007 | Ref resolution | kind:30618 → commit SHA → tree SHA chain | E8-R006 |

**Integration Test Targets:**

| Test ID | Target | Description | Risk Link |
| --- | --- | --- | --- |
| 8.2-INT-001 | Tree navigation | Mock Arweave data → render directory listing → click directory → render subtree | E8-R004 |
| 8.2-INT-002 | Blob view | Mock Arweave data → click file → render syntax-highlighted content | — |
| 8.2-INT-003 | Gateway fallback | Primary gateway 404 → fallback gateway returns data | E8-R007 |

**ATDD Stubs:**

- `packages/rig/src/git/tree-parser.test.ts` — tree object parsing
- `packages/rig/src/git/commit-parser.test.ts` — commit object parsing
- `packages/rig/src/git/blob-display.test.ts` — blob rendering logic
- `packages/rig/src/web/file-tree.test.ts` — tree view component

---

### Story 8.3: Forge-UI — Commit Log and Diff View

**Unit Test Targets:**

| Test ID | Target | Description | Risk Link |
| --- | --- | --- | --- |
| 8.3-UNIT-001 | Commit chain walker | Walks parent chain from Arweave (commit → parent → ...) up to depth limit | — |
| 8.3-UNIT-002 | Commit chain walker | Handles merge commits (multiple parents) | E8-R004 |
| 8.3-UNIT-003 | Commit log renderer | Renders hash, message, author pubkey, date for each commit | — |
| 8.3-UNIT-004 | Tree-to-tree diff | Computes additions/deletions between two tree objects | E8-R008 |
| 8.3-UNIT-005 | Tree-to-tree diff | Handles renamed files, new files, deleted files | E8-R008 |
| 8.3-UNIT-006 | Tree-to-tree diff | Handles nested directory changes | E8-R008 |
| 8.3-UNIT-007 | Unified diff formatter | Produces syntax-highlighted unified diff output | — |

**Integration Test Targets:**

| Test ID | Target | Description | Risk Link |
| --- | --- | --- | --- |
| 8.3-INT-001 | Commit log render | Mock Arweave commit chain → render log with correct ordering | — |
| 8.3-INT-002 | Diff render | Mock Arweave trees → render diff with correct additions/deletions | E8-R008 |

**ATDD Stubs:**

- `packages/rig/src/git/commit-walker.test.ts` — chain walking
- `packages/rig/src/git/tree-diff.test.ts` — diff computation
- `packages/rig/src/web/commit-log.test.ts` — log view
- `packages/rig/src/web/diff-view.test.ts` — diff view

---

### Story 8.4: Forge-UI — Blame View

**Unit Test Targets:**

| Test ID | Target | Description | Risk Link |
| --- | --- | --- | --- |
| 8.4-UNIT-001 | Blame algorithm | Correct line attribution for single-commit file | — |
| 8.4-UNIT-002 | Blame algorithm | Correct attribution across multiple commits modifying same file | E8-R009 |
| 8.4-UNIT-003 | Blame algorithm | Respects depth limit; reports "beyond limit" for old lines | E8-R009 |
| 8.4-UNIT-004 | Blame renderer | Each line shows commit hash, author pubkey, date | — |
| 8.4-UNIT-005 | Blame algorithm | Handles file rename across commits | E8-R009 |

**Integration Test Targets:**

| Test ID | Target | Description | Risk Link |
| --- | --- | --- | --- |
| 8.4-INT-001 | Blame view render | Mock Arweave history → render blame with correct attributions | E8-R009 |

**ATDD Stubs:**

- `packages/rig/src/git/blame.test.ts` — blame algorithm
- `packages/rig/src/web/blame-view.test.ts` — blame view

---

### Story 8.5: Forge-UI — Issues and PRs from Relay

**Unit Test Targets:**

| Test ID | Target | Description | Risk Link |
| --- | --- | --- | --- |
| 8.5-UNIT-001 | Issue query builder | Produces correct relay filter for kind:1621 tagged with repo event ID | E8-R006 |
| 8.5-UNIT-002 | Comment query builder | Produces correct filter for kind:1622 referencing issue | E8-R006 |
| 8.5-UNIT-003 | PR query builder | Produces correct filter for kind:1617/1618 tagged with repo | E8-R006 |
| 8.5-UNIT-004 | Status resolver | Determines PR status from latest kind:1630-1633 event | E8-R006 |
| 8.5-UNIT-005 | Issue renderer | Renders title, markdown content, author, date | — |
| 8.5-UNIT-006 | Comment thread renderer | Renders kind:1622 replies in chronological order | — |
| 8.5-UNIT-007 | Markdown renderer | Renders markdown safely (no XSS from event content) | — |
| 8.5-UNIT-008 | Contribution banner | Displays when visitor cannot write (no TOON agent) | — |

**Integration Test Targets:**

| Test ID | Target | Description | Risk Link |
| --- | --- | --- | --- |
| 8.5-INT-001 | Issues list render | Mock TOON-encoded relay data → render issues with correct metadata | E8-R006 |
| 8.5-INT-002 | PR list render | Mock relay data → render PRs with status from kind:1630-1633 | E8-R006 |
| 8.5-INT-003 | Relay unavailable | Relay timeout → graceful degradation message | E8-R007 |

**ATDD Stubs:**

- `packages/rig/src/web/issues.test.ts` — issue/comment rendering
- `packages/rig/src/web/pull-requests.test.ts` — PR rendering
- `packages/rig/src/web/relay-queries.test.ts` — NIP-34 query builders

---

### Story 8.6: Deploy Forge-UI to Arweave

**Integration Test Targets:**

| Test ID | Target | Description | Risk Link |
| --- | --- | --- | --- |
| 8.6-INT-001 | Build + upload | Build Forge-UI → upload via kind:5094 → verify Arweave tx ID returned | E8-R011 |
| 8.6-INT-002 | Manifest transaction | Multi-file SPA (HTML + JS + CSS) uploaded as manifest → accessible via single base URL | E8-R011 |
| 8.6-INT-003 | Accessibility verification | Fetch `arweave.net/<tx-id>` → HTML loads → relay query executes | E8-R001 |

**E2E Test Targets:**

| Test ID | Target | Description | Risk Link |
| --- | --- | --- | --- |
| 8.6-E2E-001 | Dogfooding | Deploy Forge-UI → browse TOON Protocol repo via deployed URL | — |

**ATDD Stubs:**

- `packages/rig/src/deploy/arweave-deploy.test.ts` — deployment logic

---

## 3. Cross-Story Test Concerns

### Arweave Gateway Mock Strategy

**Problem:** Integration tests need Arweave data but should not depend on live gateway availability in CI.

**Strategy — Two tiers:**

1. **Unit tests:** Mock all Arweave fetches. Use fixture files containing real git objects serialized as raw bytes. Mock `fetch()` or the Turbo adapter interface.

2. **Integration tests (Story 8.0 uploads):** Use **real ArDrive/Turbo free tier** (≤100KB payloads). These tests verify the actual upload/retrieve path. Mark as `skipIfArweaveUnavailable()` for CI resilience. This follows the project's no-mock integration policy — Arweave is the infrastructure boundary being tested.

3. **Integration tests (Stories 8.1-8.5 Forge-UI reads):** Use a **local HTTP mock server** (e.g., `msw` or a simple Hono dev server) returning fixture data at `http://localhost:<port>/<tx-id>`. This is acceptable because Forge-UI's Arweave gateway URL is already configurable — pointing it to a local fixture server is configuration, not mocking.

### Relay Mock Strategy for NIP-34 Events

**Problem:** Forge-UI queries relays for NIP-34 events (kind:30617, 1617, 1621, etc.) which are not yet implemented (Epic 9 defines them).

**Strategy:**

1. **Unit tests:** Mock WebSocket relay responses with TOON-encoded fixture events. Use `vi.mock()` for the relay client.

2. **Integration tests:** Use a **local relay container** from `sdk-e2e-infra.sh` with pre-seeded NIP-34 events. Seed events via the client's `publishEvent()` before test execution. This tests the real TOON encoding/decoding path.

3. **Event fixtures:** Create a shared fixture module `packages/rig/tests/fixtures/nip34-events.ts` exporting factory functions: `createRepoEvent()`, `createIssueEvent()`, `createPatchEvent()`, `createPREvent()`, `createStatusEvent()`, `createRefEvent()`, `createCommentEvent()`.

### Git Object Fixture Generation

**Problem:** Forge-UI parses raw git objects without a git binary. Need real git object bytes for test fixtures.

**Strategy:**

1. **Generate fixtures from real git repos.** Create a script `packages/rig/tests/fixtures/generate-git-fixtures.sh` that:
   - Creates a temporary git repo with known commits, trees, blobs
   - Extracts raw objects via `git cat-file` into fixture files
   - Outputs fixture metadata (SHA → type → file path mapping)

2. **Fixture catalog:**
   - `tree-simple.bin` — flat directory with 3 files
   - `tree-nested.bin` — directory with subdirectories
   - `tree-unicode.bin` — filenames with unicode characters
   - `tree-empty.bin` — empty tree
   - `commit-simple.bin` — single parent commit
   - `commit-merge.bin` — merge commit (2 parents)
   - `commit-root.bin` — root commit (no parent)
   - `blob-text.bin` — UTF-8 source code
   - `blob-binary.bin` — binary file (image/compiled)
   - `blob-empty.bin` — empty file

3. **Check fixtures into repo** at `packages/rig/tests/fixtures/git-objects/`. Binary fixtures are small (<1KB each) and deterministic.

### Browser Testing Strategy for Forge-UI

**Problem:** First web app in the monorepo. No existing browser test infrastructure.

**Strategy — Three levels:**

1. **Unit tests (vitest + jsdom/happy-dom):** All rendering logic, parsers, and state management tested in Node.js with DOM emulation. This is the primary test tier. Configure via `packages/rig/vitest.config.ts` with `environment: 'jsdom'`.

2. **Component integration tests (vitest + jsdom):** Full page renders with mock data injection. Tests DOM structure, navigation, and event handling. No real browser needed.

3. **Headless browser tests (P2 — Playwright, deferred):** Full build → serve → Playwright navigate. Validates that the built SPA actually loads, renders, and navigates. Expensive, slow, and deferred to P2 priority. If implemented, uses a dedicated `vitest.browser.config.ts` or `playwright.config.ts`.

**Build tool:** Vite (standard for static SPA, aligns with vitest ecosystem). ESM output, single `index.html` entry point.

---

## 4. Quality Gates

### Per-Story Pass/Fail Criteria

| Story | Gate | Pass Criteria |
| --- | --- | --- |
| 8.0 | **Builder/Parser roundtrip** | `buildBlobStorageRequest()` → `parseBlobStorageRequest()` returns identical data for all test vectors |
| 8.0 | **Pricing validation** | F04 for underpayment, accept for exact/overpayment, edge cases pass |
| 8.0 | **Chunk state management** | All chunk lifecycle tests pass (add, complete, duplicate, timeout, memory cap) |
| 8.0 | **Real Arweave upload** | At least one integration test uploads ≤100KB blob to real ArDrive/Turbo and retrieves it |
| 8.1 | **Repo list renders** | kind:30617 events produce correct DOM output with name, description, owner |
| 8.2 | **Git object parsing** | All fixture objects (tree, commit, blob) parse correctly |
| 8.2 | **File tree navigation** | Tree → subtree → blob navigation chain works |
| 8.3 | **Diff computation** | Tree-to-tree diff matches expected output for all fixture pairs |
| 8.4 | **Blame attribution** | Line-level blame matches expected commit SHAs for test fixtures |
| 8.5 | **NIP-34 event rendering** | Issues, PRs, comments render from TOON-encoded relay data |
| 8.6 | **SPA deployment** | Built SPA uploads to Arweave and is accessible via gateway URL |

### Epic-Level Quality Gates

| Gate | Criteria | Required for Epic Completion |
| --- | --- | --- |
| **All P0 tests passing** | 100% of P0 scenarios green | Yes |
| **All P1 tests passing** | 100% of P1 scenarios green (or failures triaged with waivers) | Yes |
| **No open critical/high bugs** | Zero unresolved bugs with severity >= high | Yes |
| **Real Arweave roundtrip** | At least 1 E2E test proving upload → retrieve via ArDrive/Turbo on real Arweave | Yes |
| **Git object parser coverage** | All fixture types (tree, commit, blob) covered by unit tests | Yes |
| **Turbo SDK adapter isolation** | `@ardrive/turbo-sdk` accessed only through adapter interface (static analysis test) | Yes |
| **XSS prevention** | Markdown rendering sanitized; no raw HTML injection from event content | Yes |
| **Forge-UI builds and serves** | `pnpm build` in `packages/rig` produces a working static SPA | Yes |

### Entry Criteria

- [ ] Epics 1-7 complete (SDK, relay, payment channels, TEE, DVM, advanced DVM, ILP addressing)
- [ ] `@ardrive/turbo-sdk` installed and importable
- [ ] ArDrive/Turbo free tier confirmed working for ≤100KB uploads
- [ ] NIP-34 event kind numbers finalized (from Epic 9 skill definitions or NIP-34 spec)
- [ ] Git object fixture generation script working
- [ ] Vitest browser environment (jsdom) configured for `packages/rig`

### Exit Criteria

- [ ] All P0 tests passing (100%)
- [ ] All P1 tests passing (or failures triaged with waivers)
- [ ] No open high-priority / high-severity bugs
- [ ] All EXT-category risks (E8-R001, E8-R002) have passing mitigation tests
- [ ] Forge-UI deployed to Arweave and accessible (Story 8.6)
- [ ] Test coverage agreed as sufficient by team review

---

## 5. Risk Mitigations

### E8-R001: Arweave Upload Reliability

**Test approach:**
- **8.0-INT-001** uses real ArDrive/Turbo free tier — this is the definitive reliability test
- Upload retry logic unit tested with mock failures (timeout, network error, 5xx response)
- Verify tx ID format (43-character base64url) before returning in FULFILL
- Gateway fetch verification: after upload, immediately fetch from `arweave.net/<tx-id>` and compare bytes
- Integration test tagged `@arweave-real` for selective CI execution (may skip in fast CI, run in nightly)

### E8-R002: `@ardrive/turbo-sdk` Vulnerability Surface

**Test approach:**
- **Static analysis test:** `turbo-sdk-isolation.test.ts` greps source files to verify `@ardrive/turbo-sdk` is only imported in the adapter module (not scattered across codebase)
- **Adapter interface test:** Verify `ArweaveUploader` interface is the only boundary; no direct Turbo types leak into handler signatures
- **`pnpm audit` gate:** CI fails on new critical/high vulnerabilities in `@ardrive/turbo-sdk` subtree
- **Pin exact version** in `package.json` (not `^` range)

### E8-R003: Chunked Upload State Management

**Test approach:**
- **State machine tests** (8.0-UNIT-007 through 8.0-UNIT-011) cover every transition:
  - Empty → first chunk → more chunks → complete → upload → cleanup
  - Empty → first chunk → timeout → discard
  - Duplicate chunk → reject/ignore
  - Too many active uploads → reject new
- **Integration test with deliberate chunk loss** (8.0-INT-003): send 3 of 5 chunks, wait for timeout, verify no Arweave upload occurred and memory freed
- **Deterministic test data:** Fixed `uploadId`, `chunkIndex`, `totalChunks` values (not random)

### E8-R004: Git Object Parsing Correctness

**Test approach:**
- **Real git fixtures** generated from actual git repos (see "Git Object Fixture Generation" above)
- **Roundtrip validation:** For each fixture, compare parsed output against known-good metadata extracted via `git cat-file -p`
- **Edge cases explicitly tested:**
  - Tree with 100+ entries (sorting correctness)
  - Commit with multi-line message, GPG signature block
  - Blob with null bytes (binary detection)
  - Tree entry with mode `120000` (symlink) and `160000` (submodule)
  - Unicode filenames in tree entries (UTF-8 encoding)
- **Cross-reference with `git` binary:** Fixture generation script records expected parse output alongside raw bytes

### E8-R005: First Web App in Monorepo

**Test approach:**
- **Story 8.1 establishes the pattern** before Stories 8.2-8.5 build on it
- `packages/rig/vitest.config.ts` with `environment: 'jsdom'` and `setupFiles` for DOM globals
- `packages/rig/tsconfig.json` includes `"lib": ["es2022", "dom"]` for browser types
- Build verified in CI: `cd packages/rig && pnpm build` produces `dist/` with `index.html`
- No headless browser tests required at P0/P1 — jsdom covers rendering logic

### E8-R006: NIP-34 TOON Encoding/Decoding

**Test approach:**
- **Builder/parser roundtrip tests** for every NIP-34 kind used by Forge-UI:
  - kind:30617 (repo announcement)
  - kind:30618 (refs/branches)
  - kind:1617 (patch), kind:1618 (PR), kind:1619 (PR status update)
  - kind:1621 (issue), kind:1622 (comment)
  - kind:1630-1633 (status events: open/applied/closed/draft)
- Tests verify TOON encode → decode produces identical event structure
- Forge-UI integration tests use TOON-encoded fixture data (not raw JSON) to catch codec bugs

### E8-R007: Arweave Gateway Availability

**Test approach:**
- Unit test: gateway URL construction and fallback list
- Unit test: fetch error handling → "content unavailable" message
- Integration test: primary gateway returns 404 → fallback gateway queried → content displayed
- Gateway health check on app load: non-blocking fetch to known tx ID

---

## Test Coverage Plan (Priority Classification)

### P0 (Critical)

**Criteria:** Blocks core upload path + High risk (>=6) + No workaround.

| Test ID | Requirement | Test Level | Risk Link |
| --- | --- | --- | --- |
| 8.0-UNIT-001 | Builder produces valid kind:5094 event | Unit | — |
| 8.0-UNIT-002 | Parser roundtrip returns original data | Unit | — |
| 8.0-UNIT-004 | Insufficient payment → F04 rejection | Unit | E8-R012 |
| 8.0-UNIT-007 | Chunk state: tracks by uploadId | Unit | E8-R003 |
| 8.0-UNIT-008 | Chunk state: all-received triggers assembly | Unit | E8-R003 |
| 8.0-UNIT-010 | Chunk state: timeout discards partial | Unit | E8-R003 |
| 8.0-UNIT-013 | Turbo adapter wraps SDK correctly | Unit | E8-R002 |
| 8.0-INT-001 | Real Arweave upload + retrieve (single packet) | Integration | E8-R001 |
| 8.2-UNIT-001 | Git tree object parser | Unit | E8-R004 |
| 8.2-UNIT-003 | Git commit object parser | Unit | E8-R004 |
| 8.2-UNIT-005 | Binary blob detection | Unit | E8-R004 |
| 8.3-UNIT-004 | Tree-to-tree diff computation | Unit | E8-R008 |
| 8.5-UNIT-007 | Markdown rendered safely (no XSS) | Unit | — |
| 8.0-STATIC-001 | `@ardrive/turbo-sdk` only imported in adapter module | Static | E8-R002 |

**Total P0**: 14 tests, ~25-40 hours

### P1 (High)

**Criteria:** Core read paths + handler happy paths + Forge-UI rendering

| Test ID | Requirement | Test Level | Risk Link |
| --- | --- | --- | --- |
| 8.0-UNIT-003 | Parser rejects malformed events | Unit | E8-R003 |
| 8.0-UNIT-005 | Accepts valid payment | Unit | — |
| 8.0-UNIT-009 | Duplicate chunk rejected | Unit | E8-R003 |
| 8.0-UNIT-011 | Memory cap on active uploads | Unit | E8-R003 |
| 8.0-UNIT-012 | Service discovery SkillDescriptor | Unit | — |
| 8.0-INT-002 | Chunked upload real Arweave | Integration | E8-R001 |
| 8.0-INT-005 | Insufficient payment integration | Integration | — |
| 8.1-UNIT-001 | Relay query filter for kind:30617 | Unit | E8-R006 |
| 8.1-UNIT-002 | Repo list renderer | Unit | — |
| 8.1-INT-001 | Repo list DOM render | Integration | E8-R005 |
| 8.2-UNIT-002 | Tree parser edge cases | Unit | E8-R004 |
| 8.2-INT-001 | File tree navigation | Integration | E8-R004 |
| 8.3-UNIT-001 | Commit chain walker | Unit | — |
| 8.3-UNIT-005 | Diff: renamed/new/deleted files | Unit | E8-R008 |
| 8.5-UNIT-001 | Issue query filter | Unit | E8-R006 |
| 8.5-INT-001 | Issues list render from TOON data | Integration | E8-R006 |

**Total P1**: 16 tests, ~20-35 hours

### P2 (Medium)

**Criteria:** Secondary features + edge cases + resilience

| Test ID | Requirement | Test Level | Risk Link |
| --- | --- | --- | --- |
| 8.0-UNIT-006 | Pricing edge cases | Unit | E8-R012 |
| 8.0-INT-003 | Chunk timeout integration | Integration | E8-R003 |
| 8.0-INT-004 | Service discovery flow | Integration | — |
| 8.2-UNIT-007 | Ref resolution chain | Unit | E8-R006 |
| 8.2-INT-003 | Gateway fallback | Integration | E8-R007 |
| 8.3-UNIT-002 | Merge commit handling | Unit | E8-R004 |
| 8.4-UNIT-002 | Blame across multiple commits | Unit | E8-R009 |
| 8.4-UNIT-003 | Blame depth limit | Unit | E8-R009 |
| 8.5-INT-002 | PR list with status events | Integration | E8-R006 |
| 8.5-INT-003 | Relay unavailable graceful degradation | Integration | E8-R007 |

**Total P2**: 10 tests, ~6-12 hours

### P3 (Low)

**Criteria:** Nice-to-have + deployment + cosmetic

| Test ID | Requirement | Test Level | Risk Link |
| --- | --- | --- | --- |
| 8.6-INT-001 | Build + upload to Arweave | Integration | E8-R011 |
| 8.6-INT-002 | Manifest transaction for SPA | Integration | E8-R011 |
| 8.1-UNIT-003 | Empty repo list state | Unit | — |
| 8.1-UNIT-005 | Relay URL configuration | Unit | — |
| 8.4-UNIT-005 | Blame across file rename | Unit | E8-R009 |
| 8.5-UNIT-008 | Contribution banner | Unit | — |

**Total P3**: 6 tests, ~4-8 hours

---

## Execution Order

1. **Story 8.0 unit tests first** — builder/parser/chunk state manager. These are pure logic, no infrastructure needed.
2. **Git object fixture generation** — run `generate-git-fixtures.sh` to create test data for Stories 8.2-8.4.
3. **Story 8.0 integration tests** — requires ArDrive/Turbo free tier access. Run early to catch Arweave reliability issues.
4. **Story 8.1 unit + integration** — establishes Forge-UI test patterns (jsdom, DOM assertions).
5. **Stories 8.2-8.4 unit tests** — git object parsing, diff, blame. Use generated fixtures.
6. **Stories 8.2-8.4 integration tests** — DOM rendering with mock Arweave data.
7. **Story 8.5 unit + integration** — relay query builders + NIP-34 event rendering.
8. **Story 8.0 E2E** — Docker infra with Arweave DVM handler. Full ILP path.
9. **Story 8.6** — deployment verification. Last because it depends on all prior stories.

---

## Execution Strategy

| Tier | When | Infrastructure | Duration |
| --- | --- | --- | --- |
| Unit tests | Every PR | None | ~30s |
| Integration (Arweave) | PR + nightly | ArDrive/Turbo free tier (internet required) | ~60s |
| Integration (Forge-UI) | Every PR | None (jsdom + local mock server) | ~15s |
| E2E (Docker) | Nightly | `sdk-e2e-infra.sh up` + Arweave DVM handler | ~120s |
| Deployment (Story 8.6) | Manual / release | ArDrive/Turbo authenticated | ~60s |
