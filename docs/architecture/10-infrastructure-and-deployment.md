# 10. Infrastructure and Deployment

## 10.1 Infrastructure as Code

- **Tool:** Docker for containerized deployment
- **Location:** `docker/Dockerfile`
- **Approach:** Library packages published to npm; Docker image for standalone relay+BLS deployment

## 10.2 Deployment Strategy

- **Strategy:** Dual deployment -- npm packages + Docker images
- **CI/CD Platform:** GitHub Actions
- **Pipeline Configuration:** `.github/workflows/ci.yml`

**npm Publishing Flow:**
1. Version bump in package.json files (coordinated across packages)
2. Create git tag
3. GitHub Actions builds and tests
4. Publish to npm registry (@crosstown/core, @crosstown/bls, @crosstown/relay)

**Docker Publishing Flow:**
1. Build from `docker/Dockerfile`
2. Image includes BLS + relay + bootstrap entrypoint
3. Configure via environment variables

## 10.3 Environments

- **Development:** Local development with mocked relays and in-memory stores
- **Integration Testing:** Five-peer bootstrap test with mocked connectors (`vitest.integration.config.ts`)
- **CI:** GitHub Actions runners with full test suite
- **npm Registry:** Published packages for consumers
- **Docker:** Standalone container deployment

## 10.4 Environment Promotion Flow

```
Local Dev → PR → main branch → Tagged Release → npm publish / Docker build
     ↓         ↓                     ↓                    ↓
  Unit Tests  CI Tests         Publish to npm       Push Docker image
  Integration                                       (manual trigger)
```

## 10.5 Rollback Strategy

- **npm:** npm unpublish (within 72 hours) or deprecate + new patch version
- **Docker:** Tag previous image version; roll back container
- **Trigger Conditions:** Critical bugs, security vulnerabilities, broken builds
- **Recovery Time Objective:** < 1 hour for npm deprecation + patch

---
