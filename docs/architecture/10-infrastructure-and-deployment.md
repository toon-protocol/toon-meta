# 10. Infrastructure and Deployment

## 10.1 Infrastructure as Code

- **Tool:** N/A (Library package)
- **Location:** N/A
- **Approach:** Library is published to npm; consumers handle their own infrastructure

## 10.2 Deployment Strategy

- **Strategy:** npm package publishing
- **CI/CD Platform:** GitHub Actions
- **Pipeline Configuration:** `.github/workflows/ci.yml`

**Publishing Flow:**
1. Version bump in package.json files
2. Create git tag
3. GitHub Actions builds and tests
4. Publish to npm registry

## 10.3 Environments

- **Development:** Local development with mocked relays
- **CI:** GitHub Actions runners with full test suite
- **npm Registry:** Published packages for consumers

## 10.4 Environment Promotion Flow

```
Local Dev → PR → main branch → Tagged Release → npm publish
     ↓         ↓                     ↓
  Unit Tests  CI Tests            Publish to npm
```

## 10.5 Rollback Strategy

- **Primary Method:** npm unpublish (within 72 hours) or deprecate + new patch version
- **Trigger Conditions:** Critical bugs, security vulnerabilities, broken builds
- **Recovery Time Objective:** < 1 hour for npm deprecation + patch

---
