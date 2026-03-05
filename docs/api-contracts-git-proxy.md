# API Contracts - @crosstown/git-proxy

**Package:** `@crosstown/git-proxy`
**Type:** Backend Service (HTTP Proxy)
**Description:** ILP-gated Git HTTP proxy for Forgejo

---

## Architecture

```
Git Client → Git Proxy (payment gate) → Forgejo Server
```

1. Client sends Git request → Proxy
2. Proxy calculates price based on operation type
3. Proxy requires ILP payment proof in header
4. Proxy validates payment with BLS
5. Proxy forwards request to Forgejo
6. Proxy streams response back to client

---

## HTTP API Endpoints

### GET /health

Health check endpoint.

**Response (200):**

```json
{
  "status": "healthy",
  "service": "git-proxy",
  "nodeId": "peer1",
  "upstreamUrl": "http://forgejo:3000"
}
```

---

### ALL /\* (Git HTTP Proxy)

Proxies all Git HTTP operations to upstream Forgejo server.

**Supported Git Operations:**

- `GET /<repo>.git/info/refs?service=git-upload-pack` - Clone/Pull initiation
- `POST /<repo>.git/git-upload-pack` - Clone/Pull data transfer
- `GET /<repo>.git/info/refs?service=git-receive-pack` - Push initiation
- `POST /<repo>.git/git-receive-pack` - Push data transfer

**Request Headers:**

- `X-ILP-Payment-Proof` - ILP payment receipt (required for paid operations)
- Standard Git HTTP headers (User-Agent, Content-Type, etc.)

**Free Operations (No Payment Required):**

- Read operations (clone, pull, fetch)

**Paid Operations:**

- Write operations (push)
- Calculated based on: `writePrice + (contentLength * pricePerKb / 1024)`

---

## Payment Flow

### Step 1: Initial Request (No Payment)

**Request:**

```http
POST /owner/repo.git/git-receive-pack HTTP/1.1
Content-Length: 5000
```

**Response (402 Payment Required):**

```json
{
  "error": "Payment required",
  "operation": "push",
  "repository": "owner/repo",
  "price": "5500",
  "message": "Include X-ILP-Payment-Proof header with payment receipt"
}
```

### Step 2: Request with Payment

**Request:**

```http
POST /owner/repo.git/git-receive-pack HTTP/1.1
Content-Length: 5000
X-ILP-Payment-Proof: <base64-encoded-ilp-receipt>
```

**Response:**

- **200-299:** Proxy successful, forwards Forgejo response
- **402:** Payment invalid or insufficient
- **403:** Rejected non-Git path
- **502:** Upstream proxy error

---

## Pricing Model

### GitPaymentCalculator

**Operation Types:**

- `clone` - Free (readPrice = 0)
- `pull` - Free (readPrice = 0)
- `push` - Paid (writePrice + size-based fee)
- `unknown` - Free (default)

**Price Calculation:**

```typescript
if (operation === 'push') {
  price = writePrice + (contentLength * pricePerKb) / 1024;
} else {
  price = 0n; // Read operations are free
}
```

**Default Pricing:**

- `readPrice`: 0 (free)
- `writePrice`: 1000 (base fee for push)
- `pricePerKb`: 100 (additional fee per KB pushed)

---

## Configuration

### GitProxyConfig

```typescript
{
  port: number;                 // Proxy server port
  upstreamUrl: string;          // Forgejo server URL
  blsUrl: string;               // BLS validation endpoint
  nodeId: string;               // Node identifier
  verbose?: boolean;            // Enable verbose logging
  rejectNonGit?: boolean;       // Reject non-Git HTTP paths
  pricing: {
    readPrice: bigint;          // Price for clone/pull (default: 0n)
    writePrice: bigint;         // Base price for push (default: 1000n)
    pricePerKb: bigint;         // Price per KB pushed (default: 100n)
  }
}
```

### Environment Variables

- `GIT_PROXY_PORT` - HTTP port (default: 3002)
- `FORGEJO_URL` - Upstream Forgejo URL (required)
- `BLS_URL` - BLS validation endpoint (required)
- `NODE_ID` - Node identifier (required)
- `VERBOSE` - Enable verbose logging (default: false)
- `REJECT_NON_GIT` - Reject non-Git paths (default: true)

---

## Payment Validation

### BLS Integration

**Validation Request to BLS:**

```http
POST <blsUrl>/validate-payment
Content-Type: application/json

{
  "proof": "<payment-proof>",
  "expectedAmount": "5500"
}
```

**BLS Response:**

```json
{
  "valid": true,
  "amount": "5500"
}
```

---

## Error Handling

### 402 Payment Required

Returned when:

- No `X-ILP-Payment-Proof` header provided for paid operation
- Payment proof validation fails
- Payment amount insufficient

### 403 Forbidden

Returned when:

- `rejectNonGit` enabled and path is not a Git operation
- Provides web UI redirect message

### 502 Bad Gateway

Returned when:

- Upstream Forgejo server unreachable
- Proxy error during request forwarding

---

## Security Features

- **Payment Gate:** Requires ILP payment for write operations
- **Path Validation:** Optionally rejects non-Git HTTP paths
- **Header Filtering:** Removes hop-by-hop and payment headers before proxying
- **Streaming:** Streams large Git pack responses efficiently

---

## Integration Example

### Git Client Configuration

```bash
# Configure Git to use proxy
git config http.proxy http://localhost:3002

# Clone via proxy (free operation)
git clone http://localhost:3002/owner/repo.git

# Push via proxy (requires payment proof in header)
# Payment handling is done by ILP-enabled Git client
git push origin main
```

---

## Architecture Notes

- **Stateless:** No persistent storage, validates each request independently
- **Streaming Proxy:** Efficiently handles large Git pack files
- **BLS-Dependent:** Requires separate BLS instance for payment validation
- **Forgejo-Specific:** Designed for Forgejo but compatible with standard Git HTTP protocol

---

**Generated:** 2026-02-26
**Last Updated:** 2026-02-26
