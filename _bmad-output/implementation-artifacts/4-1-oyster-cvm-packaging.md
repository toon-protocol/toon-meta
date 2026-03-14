# Story 4.1: Oyster CVM Packaging

Status: done

## Story

As a **relay operator**,
I want the Crosstown Docker image packaged for deployment on Marlin Oyster CVM with attestation server configuration and proxy endpoint mapping,
So that I can deploy a TEE-attested Crosstown relay to the Oyster marketplace with a single command.

**FRs covered:** FR-TEE-1 (The Crosstown Docker image SHALL be packaged for deployment on Marlin Oyster CVM with attestation server configuration and proxy endpoint mapping)

**Dependencies:** Epic 3 complete (confirmed -- commit `d9e11c8`). This is the first story in Epic 4. No dependencies on other Epic 4 stories.

**Decision sources:**
- Decision 3: Phase 1 confirmed -- Docker image for Oyster CVM
- Decision 4: Marlin integration is a dedicated epic
- Decision 10: Epic thesis -- "From repository to one-command *service* deployment on Marlin Oyster"
- Decision 11: Autonomous agent readiness as architectural invariant (deterministic bootstrap, programmatic deployment)

**Research source:** [Marlin Integration Technical Research](../planning-artifacts/research/technical-marlin-integration-research-2026-03-05.md) -- Deployment Architecture Option A (Full-Stack Enclave)

## Acceptance Criteria

1. Given the existing `docker/Dockerfile`, when I create `docker/docker-compose-oyster.yml`, then it defines the correct services (`crosstown` and `attestation-server`), ports (relay WS 7100, BLS HTTP 3100, attestation HTTP 1300), and images for Oyster CVM deployment. The compose file references the existing `crosstown:optimized` image and adds an attestation server sidecar.

2. Given the need for multi-process orchestration inside a single Oyster CVM container, when I create `docker/supervisord.conf`, then it defines process priorities for the Crosstown node process (priority=10, starts first -- runs both relay WS and BLS HTTP via `entrypoint-town.js`) and the attestation server process (priority=20, starts second -- must not publish before the relay is accepting connections). **Note:** The connector is NOT managed by supervisord -- in Oyster CVM Full-Stack mode, the existing `entrypoint-town.ts` connects to an external connector via `CONNECTOR_URL`/`CONNECTOR_ADMIN_URL` env vars (same as the current genesis Docker deployment pattern).

3. Given a node deployed to Oyster CVM, when the Crosstown node process and attestation server process have both started, then both processes are running and healthy. The relay answers WebSocket connections on port 7100, the BLS answers HTTP on port 3100 (both from the Crosstown node process), and the attestation server answers HTTP on port 1300.

4. Given the Oyster CVM deployment model uses `oyster-cvm build --docker-compose`, when the compose file is processed, then it produces valid PCR measurements that can be verified with `oyster-cvm verify`. The compose file must be compatible with the `oyster-cvm` CLI tool. **Note:** Actual PCR verification is deferred until Oyster CVM tooling is available in CI. This AC is validated by structural compatibility (correct YAML format, valid image references) in this story.

5. Given the existing `docker/Dockerfile` and the Oyster CVM networking model (vsock proxy), when the Crosstown image runs inside an enclave, then no application-level code changes are needed -- the existing relay, BLS, and connector work unmodified behind Marlin's dual-proxy architecture (inbound proxy for external connections, outbound proxy for enclave-to-internet).

## Tasks / Subtasks

- [x] Task 1: Create `docker/docker-compose-oyster.yml` (AC: #1, #4)
  - [x] Define Oyster CVM deployment manifest with services:
    - `crosstown`: Uses existing `crosstown:optimized` image, exposes BLS (3100) and Relay (7100) ports. Runs the full Crosstown node process (BLS HTTP + Relay WS + Bootstrap) via `entrypoint-town.js`.
    - `attestation-server`: Marlin attestation sidecar (port 1300), publishes `/attestation/raw` endpoint
  - [x] Map ports through Oyster CVM proxy configuration: BLS (3100), Relay (7100), Attestation (1300)
  - [x] Include environment variables for attestation configuration:
    - `ATTESTATION_PORT`: Port for attestation HTTP server (default: 1300)
    - `ATTESTATION_REFRESH_INTERVAL`: Seconds between attestation refreshes (default: 300)
  - [x] Include standard Crosstown env vars for the `crosstown` service: `NODE_ID`, `NOSTR_SECRET_KEY`, `ILP_ADDRESS`, `CONNECTOR_URL`, `CONNECTOR_ADMIN_URL`, `BTP_ENDPOINT`, `BLS_PORT`, `WS_PORT` (see `docker/src/shared.ts` for full list)
  - [x] Ensure compose file is compatible with `oyster-cvm build` CLI tool format
  - [x] Add inline comments explaining Oyster CVM-specific configuration

- [x] Task 2: Create `docker/supervisord.conf` (AC: #2)
  - [x] Configure `supervisord` for multi-process orchestration:
    ```ini
    [supervisord]
    nodaemon=true
    user=root

    [program:crosstown]
    priority=10
    command=node /app/dist/entrypoint-town.js
    user=crosstown
    autorestart=true
    stdout_logfile=/dev/stdout
    stdout_logfile_maxbytes=0
    stderr_logfile=/dev/stderr
    stderr_logfile_maxbytes=0

    [program:attestation]
    priority=20
    command=node /app/dist/attestation-server.js
    user=crosstown
    autorestart=true
    startsecs=5
    stdout_logfile=/dev/stdout
    stdout_logfile_maxbytes=0
    stderr_logfile=/dev/stderr
    stderr_logfile_maxbytes=0
    ```
  - [x] Set `stdout_logfile_maxbytes=0` and `stderr_logfile_maxbytes=0` to prevent log rotation inside enclave (logs go to stdout/stderr for external capture)
  - [x] Use `startsecs=5` on attestation process to allow Crosstown node startup time before attestation begins
  - [x] Run `supervisord` as root but individual programs as `crosstown` user (via `user=crosstown` directive) -- supervisord requires root to switch users

- [x] Task 3: Create `docker/Dockerfile.oyster` (AC: #3, #5)
  - [x] Extend existing `docker/Dockerfile` with Oyster CVM additions:
    - Install `supervisord` in the runtime stage (`apk add --no-cache supervisor`)
    - Copy `supervisord.conf` into the image at `/etc/supervisord.conf`
    - Change CMD from `node /app/dist/entrypoint-town.js` to `supervisord -c /etc/supervisord.conf`
    - Expose attestation port (1300) in addition to existing BLS (3100) and Relay (7100) ports
  - [x] Maintain non-root user (`crosstown`) from existing Dockerfile for process execution (supervisord itself runs as root to manage process users)
  - [x] Preserve HEALTHCHECK targeting BLS port (3100)
  - [x] Keep multi-stage build optimization (Alpine base, ~450MB image size)

- [x] Task 4: Create attestation server placeholder in `docker/src/attestation-server.ts` (AC: #2, #3)
  - [x] Create a minimal HTTP server using Hono (already a dependency in `docker/package.json`) that:
    - Serves `GET /attestation/raw` -- returns placeholder attestation document (in Oyster CVM, this is replaced by the real Marlin attestation proxy)
    - Serves `GET /health` -- returns `{ status: 'ok', tee: false }` when not in TEE, `{ status: 'ok', tee: true }` when `TEE_ENABLED` env var is set
    - Listens on `ATTESTATION_PORT` (default 1300)
  - [x] Add TEE detection via environment variable `TEE_ENABLED` (set by Oyster CVM runtime)
  - [x] Keep this minimal -- real attestation document generation is Story 4.2

- [x] Task 5: Write unit tests for compose file and supervisord validation (AC: #1, #2)
  - [x] Create `packages/core/src/build/oyster-config.test.ts`:
    - T-4.1-01: Validate `docker-compose-oyster.yml` defines correct services (`crosstown`, `attestation-server`), ports (3100, 7100, 1300), and images (parse YAML, assert structure)
    - T-4.1-02: Validate `supervisord.conf` defines correct process priorities (crosstown=10, attestation=20) and correct commands
  - [x] Use static analysis pattern: read config files as strings, parse, and assert structural properties
  - [x] These tests go GREEN in this story (not ATDD stubs -- actual passing tests)
  - [x] Add `yaml` as a devDependency to `packages/core/package.json` for YAML parsing in tests

- [x] Task 6: Verify existing Dockerfile works unmodified behind proxy (AC: #5)
  - [x] Verify that no hardcoded `localhost` references in the entrypoint would conflict with vsock proxy networking (note: `entrypoint-town.ts` uses `0.0.0.0` for server binding and env-var-driven URLs for external connections -- no conflicts expected)
  - [x] Document any proxy-relevant configuration in inline comments within `docker-compose-oyster.yml` (do NOT create a separate README file)

## Dev Notes

### Architecture Context

**Oyster CVM Deployment Model (Full-Stack Enclave -- Option A from research):**
```
+--------------- Oyster CVM ---------------+
|  Crosstown Node Process (priority=10):   |
|    Relay (WS:7100) + BLS (HTTP:3100)     |
|    + Bootstrap Service                   |
|  Attestation Server (priority=20):       |
|    HTTP (:1300) /attestation/raw         |
+-------- vsock proxy --------------------+
         (inbound/outbound)
    Public Internet
```

**Connector is external:** The connector runs outside the Oyster CVM enclave (either on the host or as a separate service). The Crosstown node connects to it via `CONNECTOR_URL` and `CONNECTOR_ADMIN_URL` environment variables, exactly as it does in the current genesis Docker deployment (`docker-compose-genesis.yml`). This is consistent with the research (Option A shows "Connector (internal)" but the existing Docker architecture uses an external connector, and changing that is out of scope for this packaging story).

Marlin's dual-proxy architecture transparently bridges vsock isolation:
- **Inbound proxy**: Accepts external WebSocket/HTTP connections, forwards via vsock to enclave processes
- **Outbound proxy**: Tunnels enclave connections (e.g., RPC calls to Arbitrum, connector admin API) to external endpoints
- **No application code changes needed**: The proxy handles TLS termination, DNS resolution, and port mapping transparently

**Why supervisord?**
Oyster CVM runs a single Docker container. Multiple processes (Crosstown node, attestation server) must be orchestrated within that container. `supervisord` is the standard pattern for multi-process Docker containers in the Marlin ecosystem (see 3DNS case study).

**Why NOT 3 supervisord programs?**
The existing `entrypoint-town.ts` runs both the BLS HTTP server AND the Nostr relay WebSocket server in a single Node.js process. Splitting them would require refactoring the entrypoint, which violates this story's constraint of "no application code changes." The Crosstown node process is therefore a single supervisord program, not two.

### Existing Files to Touch

| File | Action | Purpose |
|------|--------|---------|
| `docker/docker-compose-oyster.yml` | **CREATE** | Oyster CVM deployment manifest |
| `docker/supervisord.conf` | **CREATE** | Multi-process orchestration config |
| `docker/Dockerfile.oyster` | **CREATE** | Extended Dockerfile for Oyster CVM |
| `docker/src/attestation-server.ts` | **CREATE** | Minimal attestation HTTP server placeholder |
| `docker/tsconfig.json` | **MODIFY** | Add attestation-server.ts to compilation (already included via `src/**/*` glob -- verify only) |
| `packages/core/src/build/oyster-config.test.ts` | **CREATE** | Config validation tests |

**No modifications needed to `docker/package.json`:** Hono is already a dependency (`"hono": "^4.11.10"`). The `@hono/node-server` is also already present (`"@hono/node-server": "^1.13.7"`).

### Key Technical Constraints

1. **No application code changes**: The existing relay, BLS, and connector run unmodified inside the enclave. This story is purely configuration and packaging.

2. **Docker image size matters**: Oyster CVM downloads the image on deployment. Keep the Oyster variant minimal -- Alpine base, multi-stage build, ~450MB target.

3. **supervisord inside Alpine**: Use `supervisor` package from Alpine repos (`apk add --no-cache supervisor`). Do NOT install full Python supervisor via pip.

4. **Attestation server is a placeholder**: Story 4.2 implements the real attestation event builder (kind:10033). This story creates the HTTP shell that Story 4.2 will fill with actual attestation document generation.

5. **Port mapping**: Oyster CVM proxy maps ports defined in docker-compose. Standard Crosstown ports (3100, 7100) plus attestation (1300) must all be exposed.

6. **Non-root user**: The existing Dockerfile creates a `crosstown` user (UID 1001). supervisord runs as root (required to switch users) but executes programs as the `crosstown` user via the `user=crosstown` directive.

7. **No Nix yet**: Nix reproducible builds are Story 4.5. This story uses the existing Dockerfile build system. The `Dockerfile.oyster` extends the current build, not replaces it.

8. **Two supervisord programs, not three**: The Crosstown node process (relay + BLS + bootstrap) is a single Node.js process managed by `entrypoint-town.js`. The attestation server is a separate process. The connector is external (not managed by supervisord).

### Anti-Patterns to Avoid

- **DO NOT modify the existing `docker/Dockerfile`** -- create a separate `Dockerfile.oyster` that extends the existing one or duplicates with Oyster-specific additions
- **DO NOT add attestation logic to the main entrypoint** (`entrypoint-town.ts`) -- attestation is a separate process managed by supervisord
- **DO NOT hardcode PCR values or image hashes** -- these are computed at build time by `oyster-cvm build`
- **DO NOT use `exec()` for process management** -- use supervisord config
- **DO NOT create documentation files** (e.g., `README-OYSTER.md`) -- use inline comments in compose file and Dockerfile instead
- **DO NOT implement kind:10033 event building** -- that is Story 4.2
- **DO NOT add a connector process to supervisord** -- the connector is external, accessed via env vars

### ATDD Test Stubs (Pre-existing RED Phase)

The TEA agent has already created RED phase test stubs for Story 4.1:

| Test ID | File | Description | Status |
|---------|------|-------------|--------|
| T-4.1-01 | `packages/core/src/bootstrap/attestation-bootstrap.test.ts` | docker-compose-oyster.yml correct services/ports/images | RED (it.skip) |
| T-4.1-02 | `packages/core/src/bootstrap/attestation-bootstrap.test.ts` | supervisord.conf correct priorities | RED (it.skip) |
| T-4.1-03 | `packages/core/src/bootstrap/attestation-bootstrap.test.ts` | Relay ready before attestation publishes | RED (it.skip) |
| T-4.1-04 | `packages/core/src/bootstrap/attestation-bootstrap.test.ts` | All 3 processes running and healthy | RED (it.skip) |

**ATDD Stub Discrepancies (must be addressed during GREEN phase):**

1. **T-4.1-01 service names wrong:** The ATDD stub asserts services named `relay`, `connector`, `attestation` but the correct service names are `crosstown` and `attestation-server` (only 2 services, not 3). The stub also checks for connector port 8080 which is NOT exposed in the Oyster compose file. The GREEN test in `oyster-config.test.ts` must use the correct service names and ports.

2. **T-4.1-02 priorities wrong:** The ATDD stub asserts 3 supervisord programs (relay=10, connector=20, attestation=30) but the correct configuration is 2 programs (crosstown=10, attestation=20). The GREEN test must use the correct program names and priorities.

3. **T-4.1-04 port assignments wrong:** The ATDD stub assigns attestation health to port 3100 (which is the BLS port) and connector health to port 8080 (which is not exposed). The correct ports are: BLS on 3100 (from Crosstown node process), Relay on 7100 (from Crosstown node process), Attestation on 1300 (from attestation server process).

4. **T-4.1-03 and T-4.1-04 deferred:** These require actual Oyster CVM infrastructure and remain RED stubs. Focus on T-4.1-01 and T-4.1-02 via the dedicated GREEN tests in `oyster-config.test.ts`.

**Decision:** The pre-existing test stubs in `attestation-bootstrap.test.ts` bundle Story 4.1 tests with Story 4.6 tests and contain structural inaccuracies (service names, port numbers, process count). For this story, create a dedicated `packages/core/src/build/oyster-config.test.ts` with GREEN tests that validate the config files with correct expectations. The RED stubs in `attestation-bootstrap.test.ts` remain for future integration/E2E (they will need to be corrected when enabled).

### Test Traceability

| Test ID | Test Name | AC | Location | Priority | Level | Phase |
|---------|-----------|----|-----------|---------:|-------|-------|
| T-4.1-01 | docker-compose-oyster.yml correct services, ports, images | #1, #4 | `packages/core/src/build/oyster-config.test.ts` | P1 | Unit (static) | GREEN |
| T-4.1-02 | supervisord.conf correct process priorities | #2 | `packages/core/src/build/oyster-config.test.ts` | P1 | Unit (static) | GREEN |
| T-4.1-03 | Relay ready before attestation publishes | #2 | `packages/core/src/bootstrap/attestation-bootstrap.test.ts` | P2 | Integration | RED (deferred) |
| T-4.1-04 | All processes running and healthy | #3 | `packages/core/src/bootstrap/attestation-bootstrap.test.ts` | P1 | E2E | RED (deferred) |

### Project Structure Notes

- All config files go in `docker/` directory (alongside existing Dockerfile, docker-compose files)
- Test files for build/config validation go in `packages/core/src/build/` (alongside existing `nix-reproducibility.test.ts` and `reproducibility.test.ts` ATDD stubs)
- The attestation server source goes in `docker/src/` (alongside existing `shared.ts`, `entrypoint-sdk.ts`, `entrypoint-town.ts`)
- No new packages created -- this story adds files to existing `docker/` workspace member and `packages/core/`

### Previous Epic Patterns

**Epic 3 commit pattern:** One commit per story with `feat(story-id): description` format. Example: `feat(3-6): enriched /health endpoint with pricing, capabilities, and chain info`

**Expected commit:** `feat(4-1): Oyster CVM packaging -- docker-compose, supervisord, attestation placeholder`

**Testing pattern from Epic 3:** Static analysis tests that read source/config files and assert structural properties (e.g., `sdk-entrypoint-validation.test.ts`). Use this same pattern for validating `docker-compose-oyster.yml` and `supervisord.conf`.

### References

- [Source: _bmad-output/planning-artifacts/research/technical-marlin-integration-research-2026-03-05.md -- Deployment Topology Options, Option A: Full-Stack Enclave]
- [Source: _bmad-output/planning-artifacts/research/marlin-party-mode-decisions-2026-03-05.md -- Decisions 3, 4, 10, 11]
- [Source: _bmad-output/planning-artifacts/epics.md -- Story 4.1: Oyster CVM Packaging]
- [Source: _bmad-output/test-artifacts/atdd-checklist-epic-4.md -- Story 4.1 test IDs T-4.1-01 through T-4.1-04]
- [Source: _bmad-output/test-artifacts/test-design-epic-4.md -- Risk R-E4-007 (supervisord process ordering)]
- [Source: docker/Dockerfile -- Existing multi-stage build, Alpine base, non-root user]
- [Source: docker-compose-genesis.yml -- Existing compose file pattern for services, ports, healthchecks]
- [Source: docker/src/shared.ts -- Config parsing, `x402Enabled`, `discoveryMode` env var patterns]
- [Source: docker/src/entrypoint-town.ts -- Approach A: single process runs BLS HTTP + Relay WS + Bootstrap]
- [Source: _bmad-output/project-context.md -- Docker Reference Implementation section, entrypoint patterns]

### oyster-cvm CLI Reference

```bash
# Build enclave image (produces PCR values)
oyster-cvm build --docker-compose docker/docker-compose-oyster.yml

# Deploy to Oyster marketplace
oyster-cvm deploy --wallet-key $KEY --duration 1440 --docker-compose docker/docker-compose-oyster.yml

# Verify attestation
oyster-cvm verify --enclave-ip $ENCLAVE_IP --image-id $IMAGE_ID

# Debug mode (console logs visible, changes PCR values)
oyster-cvm deploy --debug --wallet-key $KEY --duration 60 --docker-compose docker/docker-compose-oyster.yml
```

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

No debug sessions required. All tests passed on first run after implementation.

### Completion Notes List

- **Task 1 (docker-compose-oyster.yml):** Created Oyster CVM deployment manifest with 2 services: `crosstown` (image: crosstown:optimized, ports 3100/7100, full env var configuration including NODE_ID, NOSTR_SECRET_KEY, ILP_ADDRESS, connector URLs, pricing, settlement, discovery, x402) and `attestation-server` (image: crosstown:optimized, port 1300, ATTESTATION_PORT and TEE_ENABLED env vars). Inline comments explain Oyster CVM architecture, dual-proxy networking, and external connector pattern.
- **Task 2 (supervisord.conf):** Created supervisord configuration with 2 programs: `crosstown` (priority=10, command=node /app/dist/entrypoint-town.js) and `attestation` (priority=20, command=node /app/dist/attestation-server.js, startsecs=5). Both run as `crosstown` user. supervisord in nodaemon mode. All logs to stdout/stderr with maxbytes=0.
- **Task 3 (Dockerfile.oyster):** Created extended Dockerfile duplicating the builder stage from docker/Dockerfile, adding `supervisor` via apk in runtime stage, copying supervisord.conf to /etc/supervisord.conf, EXPOSE 3100 7100 1300, preserving crosstown user and HEALTHCHECK, CMD set to supervisord.
- **Task 4 (attestation-server.ts):** Created minimal Hono HTTP server with GET /attestation/raw (placeholder attestation document, 503 when not in TEE) and GET /health (returns {status: 'ok', tee: boolean}). Listens on ATTESTATION_PORT (default 1300). TEE detection via TEE_ENABLED env var. Guarded against VITEST import. Exports app for testability.
- **Task 5 (GREEN tests):** Converted all 32 tests from it.skip to it in oyster-config.test.ts. Added `yaml` devDependency to packages/core. Fixed `require('node:path')` lint error by converting to ESM import. All 32 tests pass covering: compose file structure (8), supervisord structure (10), Dockerfile.oyster structure (6), attestation-server.ts placeholder (6), vsock proxy compatibility (2).
- **Task 6 (Verification):** Verified entrypoint-town.ts uses 0.0.0.0 for server binding (via Hono `serve()`), not localhost. External URLs come from env vars via config. `ws://localhost:${port}` references are only for internal relay URLs (default relay URL), which is correct for the vsock proxy model. Full test suite passes: 1590 tests, 0 failures. Lint: 0 errors, 415 warnings (all pre-existing).

### File List

| Path | Action |
|------|--------|
| `docker/docker-compose-oyster.yml` | CREATED |
| `docker/supervisord.conf` | CREATED |
| `docker/Dockerfile.oyster` | CREATED |
| `docker/src/attestation-server.ts` | CREATED |
| `packages/core/src/build/oyster-config.test.ts` | MODIFIED (RED -> GREEN: it.skip -> it, added path import, fixed require lint error) |
| `packages/core/package.json` | MODIFIED (added yaml devDependency) |
| `pnpm-lock.yaml` | MODIFIED (lockfile updated for yaml dep) |

### Change Log

| Date | Summary |
|------|---------|
| 2026-03-14 | Story 4.1 file created. |
| 2026-03-14 | Adversarial review (Claude Opus 4.6, yolo mode): 13 issues found and fixed. [1] AC #1 clarified port numbers (7100, 3100, 1300) explicitly. [2] AC #2 corrected from 3 supervisord programs (relay/connector/attestation) to 2 programs (crosstown/attestation) -- connector is external, not managed by supervisord. Added note explaining why. [3] AC #3 corrected from "all 3 processes" to "both processes" and specified all port numbers explicitly. [4] AC #4 added deferred note -- actual PCR verification requires CVM tooling not available in CI. [5] Task 1 added standard Crosstown env vars requirement and explicit port list. [6] Task 2 completely rewritten with corrected supervisord.conf (2 programs, not 3; crosstown/attestation naming; user=crosstown directives; supervisord nodaemon config; complete command lines). [7] Task 3 clarified supervisord root vs user process model. [8] Task 4 corrected Hono dependency note (already in docker/package.json, not just BLS/Town). [9] Task 5 corrected test expectations (2 services, 2 programs, correct names and priorities). [10] Task 6 removed README-OYSTER.md creation (violates anti-pattern). [11] Files to Touch table corrected: removed docker/package.json (no modification needed), clarified tsconfig.json (already includes src/**/*). [12] Added ATDD stub discrepancies section documenting 4 specific errors in pre-existing RED stubs. [13] Added test traceability table, change log section, architecture context clarifications, and "Why NOT 3 supervisord programs?" explanation. |
| 2026-03-14 | Development complete (Claude Opus 4.6). All 6 tasks implemented. Created 4 new files (docker-compose-oyster.yml, supervisord.conf, Dockerfile.oyster, attestation-server.ts), modified 2 existing files (oyster-config.test.ts RED->GREEN, core package.json for yaml dep). 32 GREEN tests pass. 0 lint errors. 1590 total tests pass (0 regressions). 1 lint issue found and fixed (require() -> ESM import). |

## Code Review Record

### Review Pass #1

| Field | Value |
|-------|-------|
| **Date** | 2026-03-14 |
| **Reviewer Model** | Claude Opus 4.6 (claude-opus-4-6) |
| **Outcome** | Pass with fixes applied |
| **Critical Issues** | 0 |
| **High Issues** | 0 |
| **Medium Issues** | 2 |
| **Low Issues** | 2 |
| **Total Issues** | 4 |

**Issues Found & Fixed:**

| ID | Severity | Description | Resolution |
|----|----------|-------------|------------|
| M1 | Medium | Dockerfile.oyster builder stage duplication — no sync documentation explaining that the builder stage must be kept in sync with docker/Dockerfile | Added documentation comment in Dockerfile.oyster |
| M2 | Medium | Compose file attestation-server service missing `depends_on` — attestation-server should depend on crosstown service to enforce startup ordering | Added `depends_on` to attestation-server service in docker-compose-oyster.yml |
| L1 | Low | `attestationPort` parseInt NaN validation missing in attestation-server.ts — malformed ATTESTATION_PORT env var could produce NaN | Added parseInt NaN guard with fallback to default port |
| L2 | Low | Missing code comment for unused `ATTESTATION_REFRESH_INTERVAL` env var in attestation-server.ts | Added comment explaining the env var is declared for future use (Story 4.2) |

**Review Follow-ups:** None. All issues were fixed during the review pass.

### Review Pass #2

| Field | Value |
|-------|-------|
| **Date** | 2026-03-14 |
| **Reviewer Model** | Claude Opus 4.6 (claude-opus-4-6) |
| **Outcome** | Pass with fixes applied |
| **Critical Issues** | 0 |
| **High Issues** | 0 |
| **Medium Issues** | 2 |
| **Low Issues** | 1 |
| **Total Issues** | 3 |

**Issues Found & Fixed:**

| ID | Severity | Description | Resolution |
|----|----------|-------------|------------|
| M3 | Medium | `attestation-server.ts` port validation only checks NaN -- accepts out-of-range ports (0, -1, 99999). `parseInt` silently truncates trailing non-numeric characters (e.g., `'1300abc'` -> `1300`), but the NaN-only check misses truly invalid port numbers outside 1-65535 | Added port range validation `attestationPort < 1 \|\| attestationPort > 65535` alongside the existing NaN guard |
| M4 | Medium | `docker-compose-oyster.yml` crosstown service missing healthcheck -- `depends_on` for attestation-server only waited for container start, not for BLS HTTP to be healthy. This partially undermined AC #2 (relay ready before attestation starts). Genesis compose file has healthcheck; Oyster compose did not | Added healthcheck to crosstown service matching genesis pattern (`wget /health`). Upgraded `depends_on` from array format to condition format (`service_healthy`) so attestation-server waits for BLS to be genuinely responsive |
| L3 | Low | `attestation-server.ts` TEE detection comment incomplete -- `teeEnabled` is evaluated once at module load time but the comment did not mention this is a one-time evaluation (env var changes after process start are not reflected) | Added clarifying comment: "Evaluated once at startup -- env var changes after process start are not reflected" |

**Review Follow-ups:** None. All issues were fixed during the review pass. All 54 oyster-config tests + 13 attestation-server tests + 45 shared tests pass (0 regressions). 0 lint errors (421 pre-existing warnings).

### Review Pass #3

| Field | Value |
|-------|-------|
| **Date** | 2026-03-14 |
| **Reviewer Model** | Claude Opus 4.6 (claude-opus-4-6) |
| **Outcome** | Pass with fixes applied |
| **Critical Issues** | 0 |
| **High Issues** | 1 |
| **Medium Issues** | 3 |
| **Low Issues** | 3 |
| **Total Issues** | 7 |

**OWASP/Security Scan:** Checked for OWASP Top 10 vulnerabilities, authentication/authorization flaws, injection risks. No critical security vulnerabilities found. Findings M2 (CWE-208 timing side-channel) and M3 (secret in env var) are security-related mitigations.

**Issues Found & Fixed:**

| ID | Severity | Description | Resolution |
|----|----------|-------------|------------|
| H1 | High | Dockerfile.oyster uses `pnpm@latest` (non-deterministic build) -- violates Decision 11 forward constraint on Dockerfile determinism and the project's pinned pnpm version (8.15.0). Critical for Oyster CVM where reproducible builds produce PCR values. | Pinned to `pnpm@8.15.0` with comment explaining sync requirement |
| M1 | Medium | Compose healthcheck hardcodes port 3100 instead of using BLS_PORT env var -- inconsistent with Dockerfile.oyster HEALTHCHECK pattern that uses `${BLS_PORT}` | Changed healthcheck from CMD to CMD-SHELL format with `$${BLS_PORT:-3100}` variable substitution |
| M2 | Medium | Attestation server responses include `Date.now()` timestamp -- potential timing side-channel leakage (CWE-208) in TEE environment. Server timestamps should not be in response bodies for attestation endpoints. | Removed `timestamp` field from `/attestation/raw` response body; updated corresponding test |
| M3 | Medium | `NOSTR_SECRET_KEY` passed as plain environment variable in compose file -- env vars may be visible outside the enclave orchestration layer. Docker secrets or oyster-cvm --env-file is more secure for production TEE deployments. | Added security note comment recommending Docker secrets for production |
| L1 | Low | Dockerfile.oyster builder stage sync comment did not mention version pinning requirement | Addressed by H1 fix -- sync comment now includes version pinning note |
| L2 | Low | Test file uses 80+ lines of redundant dynamic `fs` and `yaml` imports (repeated in every test case) | Converted all dynamic imports to top-level static imports |
| L3 | Low | `supervisord.conf` missing `stopwaitsecs` directive -- Node.js graceful shutdown may need more than the default 10s timeout | Added `stopwaitsecs=15` for crosstown (DB shutdown) and `stopwaitsecs=10` for attestation |

**Review Follow-ups:** None. All issues were fixed during the review pass. All 1612 tests pass (0 regressions). 54 oyster-config tests + 13 attestation-server tests + 45 shared tests all passing. 0 lint errors (421 pre-existing warnings).
