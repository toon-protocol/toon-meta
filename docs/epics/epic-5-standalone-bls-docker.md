# Epic 5: Standalone BLS Docker Image

**Goal:** Create a standalone, lightweight Docker image for the Business Logic Server (BLS) that implements the standard BLS contract (`/health`, `/handle-payment`) and can be referenced by any ILP agent-runtime. This image serves as both a production-ready reference implementation and a boilerplate for developers to create custom BLS implementations.

## Configuration

| Setting | Value | Notes |
|---------|-------|-------|
| Docker Hub Organization | `di3twater` | |
| Image Name | `crosstown-bls` | |
| Default Port | `3100` | BLS HTTP API |
| Data Volume | `/data` | SQLite database storage |

## Background

The agent-runtime is an external project that orchestrates ILP connectors and agents. It needs a BLS service to handle payment verification for event storage. By publishing a standardized BLS Docker image:

1. **Plug-and-play integration** - agent-runtime can reference the image in docker-compose or K8s manifests
2. **Separation of concerns** - BLS logic is decoupled from the relay and agent-runtime
3. **Developer flexibility** - Developers can create custom BLS implementations as long as they conform to the interface
4. **Reference implementation** - Serves as the canonical example of BLS contract compliance

## BLS Contract Specification

### Required Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check for container orchestration |
| `/handle-payment` | POST | Verify ILP payment and process event storage |

### GET /health

**Response (200 OK):**
```json
{
  "status": "healthy",
  "nodeId": "string",
  "pubkey": "string (hex, 64 chars)",
  "ilpAddress": "string (e.g., g.crosstown.node1)",
  "timestamp": 1234567890
}
```

### POST /handle-payment

**Request Body:**
```json
{
  "amount": "string (numeric, in base units)",
  "destination": "string (ILP address)",
  "data": "string (base64-encoded TOON event)"
}
```

**Success Response (200 OK):**
```json
{
  "accept": true,
  "fulfillment": "string (base64, SHA-256 of event ID)",
  "metadata": {
    "eventId": "string",
    "storedAt": 1234567890
  }
}
```

**Rejection Response (400/500):**
```json
{
  "accept": false,
  "code": "string (ILP error code: F00, F06, T00)",
  "message": "string",
  "metadata": {
    "required": "string (amount required)",
    "received": "string (amount received)"
  }
}
```

### ILP Error Codes

| Code | Name | Description |
|------|------|-------------|
| F00 | BAD_REQUEST | Malformed request or invalid TOON data |
| F06 | INSUFFICIENT_AMOUNT | Payment amount below required price |
| T00 | INTERNAL_ERROR | Server-side error during processing |

---

## Story 5.1: Extract BLS into Standalone Package

**As a** maintainer,
**I want** the BLS server extracted into a standalone, independently deployable module,
**so that** it can be containerized without bundling the relay or bootstrap services.

**Acceptance Criteria:**
1. Create `/packages/bls/` directory with its own `package.json`
2. Move/refactor `BusinessLogicServer` from `packages/relay/src/bls/` to new package
3. BLS package has minimal dependencies (Hono, crypto, TOON decoder)
4. BLS package exports `createBlsServer(config: BlsConfig): Server`
5. Package includes standalone entrypoint (`src/entrypoint.ts`) for Docker
6. Existing `packages/relay` can optionally depend on `@crosstown/bls`
7. Unit tests pass in the new package location
8. Package builds independently with `pnpm build`

---

## Story 5.2: BLS Docker Image Build Configuration

**As a** DevOps engineer,
**I want** a Dockerfile that builds a minimal BLS-only container,
**so that** the image is small, secure, and fast to pull.

**Acceptance Criteria:**
1. Create `/packages/bls/Dockerfile` with multi-stage build
2. Base image: `node:20-alpine` (smaller than `node:20-slim`)
3. Final image size < 150MB
4. Image exposes only port 3100 (BLS HTTP)
5. `VOLUME /data` declared for persistent storage mount point
6. Health check configured: `GET http://localhost:3100/health` every 30s
7. Non-root user for security (e.g., `node` user)
8. `docker build` succeeds from repo root
9. Container starts and responds to health check

---

## Story 5.3: Environment Variable Configuration

**As a** relay operator,
**I want** the BLS container configurable via environment variables,
**so that** I can customize behavior without rebuilding the image.

**Acceptance Criteria:**
1. Environment variables documented in README:
   - `NODE_ID` (required): Unique node identifier
   - `NOSTR_SECRET_KEY` (required): 64-char hex Nostr secret key
   - `ILP_ADDRESS` (required): Node's ILP address (e.g., `g.crosstown.node1`)
   - `BLS_PORT` (optional): HTTP port, default `3100`
   - `BASE_PRICE_PER_BYTE` (optional): Pricing rate, default `10`
   - `OWNER_PUBKEY` (optional): Pubkey for self-write bypass
   - `DATA_DIR` (optional): Directory for SQLite database, default `/data`
2. Container fails fast with descriptive error if required vars missing
3. Configuration logged on startup (secrets masked)
4. Unit tests verify config parsing and validation

---

## Story 5.4: Volume-Based Event Storage

**As a** BLS operator,
**I want** the standalone BLS to persist events to a mounted volume,
**so that** events survive container restarts.

**Acceptance Criteria:**
1. BLS uses SQLite database for event storage
2. Database file stored at configurable path (default: `/data/events.db`)
3. Container expects volume mount at `/data`
4. Events persisted after successful payment verification
5. Database schema matches existing `SqliteEventStore` implementation
6. Graceful handling if volume not mounted (logs warning, uses in-memory fallback)
7. Environment variable `DATA_DIR` allows customizing data path
8. Unit tests verify persistence across simulated restarts

---

## Story 5.5: Docker Hub Publishing

**As a** DevOps engineer,
**I want** the BLS image published to Docker Hub,
**so that** agent-runtime can pull it without building locally.

**Acceptance Criteria:**
1. GitHub Actions workflow: `.github/workflows/publish-bls.yml`
2. Workflow triggers on:
   - Push to `main` with changes in `packages/bls/`
   - Manual dispatch with version input
   - Git tags matching `bls-v*`
3. Image published to Docker Hub: `di3twater/crosstown-bls`
4. Docker Hub credentials stored as GitHub secrets (`DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`)
5. Image tagged with:
   - `latest` (main branch)
   - `vX.Y.Z` (semantic version from tag)
   - Git SHA for traceability
6. Multi-architecture build: `linux/amd64`, `linux/arm64`
7. Workflow includes vulnerability scan (e.g., Trivy)
8. README includes pull command: `docker pull di3twater/crosstown-bls:latest`

---

## Story 5.6: Docker Compose Integration Example

**As a** developer integrating with agent-runtime,
**I want** example docker-compose configuration,
**so that** I can quickly add the BLS to my stack.

**Acceptance Criteria:**
1. Create `/packages/bls/examples/docker-compose.yml`
2. Example shows BLS service configuration with all env vars
3. Example includes volume mount for persistent storage
4. Example includes health check and restart policy
5. Example shows how to connect BLS to an ILP connector service
6. README explains how to integrate with agent-runtime's compose file
7. Example can be run standalone for testing: `docker compose up`

**Example Structure:**
```yaml
services:
  bls:
    image: di3twater/crosstown-bls:latest
    ports:
      - "3100:3100"
    volumes:
      - bls-data:/data
    environment:
      NODE_ID: my-node
      NOSTR_SECRET_KEY: ${NOSTR_SECRET_KEY}
      ILP_ADDRESS: g.crosstown.my-node
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3100/health"]
      interval: 30s
      timeout: 5s
      retries: 3
    restart: unless-stopped

volumes:
  bls-data:
```

---

## Story 5.7: Kubernetes Manifest Example

**As a** DevOps engineer deploying to Kubernetes,
**I want** example K8s manifests for the BLS,
**so that** I can deploy it alongside agent-runtime in a cluster.

**Acceptance Criteria:**
1. Create `/packages/bls/examples/k8s/` directory
2. Manifests include:
   - `deployment.yaml` - BLS Deployment with resource limits and volume mount
   - `service.yaml` - ClusterIP Service exposing port 3100
   - `configmap.yaml` - Non-secret configuration
   - `secret.yaml` - Template for secrets (NOSTR_SECRET_KEY)
   - `pvc.yaml` - PersistentVolumeClaim for event storage
3. Deployment includes:
   - Liveness probe: `/health`
   - Readiness probe: `/health`
   - Resource requests/limits (CPU: 100m/500m, Memory: 128Mi/256Mi)
   - Volume mount at `/data` from PVC
4. PVC configured with:
   - Storage class placeholder (user configurable)
   - Default size: 1Gi (configurable)
   - Access mode: ReadWriteOnce
5. README with `kubectl apply` instructions
6. Kustomize base for easy customization (optional)

---

## Story 5.8: BLS Contract Documentation

**As a** developer creating a custom BLS,
**I want** clear documentation of the BLS contract,
**so that** I can implement my own BLS that works with agent-runtime.

**Acceptance Criteria:**
1. Create `/packages/bls/docs/BLS-CONTRACT.md`
2. Document specifies:
   - Required endpoints with request/response schemas
   - ILP error codes and when to use each
   - TOON encoding format reference
   - Fulfillment generation algorithm (SHA-256 of event ID)
   - Health check requirements for orchestration
3. Document includes sequence diagram of payment flow
4. Document provides example implementations in pseudocode
5. Link to this doc from main README
6. Document published to GitHub Pages or similar (optional)

---

## Dependencies

- Epic 4 (ILP-Gated Relay) must be complete - provides existing BLS implementation
- TOON encoding utilities from `@crosstown/relay`
- Nostr signature verification from `nostr-tools`

## Success Metrics

1. BLS Docker image builds successfully in CI
2. Image size < 150MB
3. Container passes health checks within 10 seconds of startup
4. agent-runtime can integrate BLS via single docker-compose service entry
5. At least one community developer creates custom BLS using the contract doc

## Out of Scope (Future Enhancements)

- External database integration (PostgreSQL, MySQL, etc.)
- Horizontal scaling / clustering
- Metrics endpoint (`/metrics` for Prometheus)
- Admin API for runtime configuration
- WebSocket endpoint for streaming events

---

## Technical Notes

### Why Standalone Package?

The current BLS in `packages/relay` is tightly coupled to the relay's event store. Extracting it allows:
- Smaller Docker image (no relay code bundled)
- Independent versioning
- Clearer contract boundary
- Easier testing and mocking

### TOON Format

TOON (Text Object Optimized Notation) is used to encode Nostr events into compact binary format for embedding in ILP packets. The BLS must decode TOON to verify event signatures and calculate pricing.

### Fulfillment Generation

The fulfillment is `base64(SHA256(eventId))`. This allows the sender to verify that the specific event was stored by checking the fulfillment against their known event ID.
