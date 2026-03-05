# API Contracts - @crosstown/faucet

**Package:** `@crosstown/faucet`
**Type:** Backend Service
**Description:** Token faucet for local Crosstown development (ETH + AGENT tokens)

---

## HTTP API Endpoints

### GET /health

Health check endpoint.

**Response (200):**

```json
{
  "status": "ok",
  "tokenAddress": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  "tokenReady": true
}
```

---

### GET /api/info

Get faucet configuration and balances.

**Response (200):**

```json
{
  "ethAmount": "100",
  "tokenAmount": "10000",
  "tokenSymbol": "AGENT",
  "tokenAddress": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  "rateLimitHours": 1,
  "faucet Balances": {
    "eth": "10000.0",
    "token": "1000000.0"
  },
  "ready": true
}
```

---

### POST /api/request

Request tokens from the faucet.

**Request Body:**

```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "transactions": {
    "eth": {
      "hash": "0xabc123...",
      "amount": "100"
    },
    "token": {
      "hash": "0xdef456...",
      "amount": "10000",
      "symbol": "AGENT"
    }
  }
}
```

**Error Responses:**

**400 - Invalid Address:**

```json
{
  "error": "Invalid Ethereum address"
}
```

**429 - Rate Limited:**

```json
{
  "error": "Rate limit exceeded",
  "message": "Please wait 45 minutes before requesting again",
  "waitMinutes": 45
}
```

**503 - Token Not Ready:**

```json
{
  "error": "Token contract not yet deployed",
  "message": "Please wait for contract deployment to complete"
}
```

**500 - Server Error:**

```json
{
  "error": "Faucet request failed",
  "message": "<error details>"
}
```

---

## Configuration

### Environment Variables

- `PORT` - HTTP port (default: 3500)
- `RPC_URL` - Ethereum RPC URL (default: `http://anvil:8545`)
- `ETH_PRIVATE_KEY` - Private key for ETH distribution (Anvil Account #1)
- `TOKEN_PRIVATE_KEY` - Private key for token distribution (Anvil Account #0/deployer)
- `TOKEN_ADDRESS` - ERC20 token contract address (required)
- `ETH_AMOUNT` - ETH per drip (default: "100")
- `TOKEN_AMOUNT` - Tokens per drip (default: "10000")
- `RATE_LIMIT_HOURS` - Hours between requests per address (default: 1)

### Default Amounts

- **ETH:** 100 ETH per request
- **AGENT Tokens:** 10,000 tokens per request
- **Rate Limit:** 1 request per address per hour

---

## Rate Limiting

- Tracked by Ethereum address (case-insensitive)
- In-memory tracking (resets on server restart)
- Configurable via `RATE_LIMIT_HOURS`
- Returns `waitMinutes` in error response when rate-limited

---

## Token Contract Interface

Uses standard ERC20 ABI:

- `transfer(address to, uint256 amount) returns (bool)`
- `balanceOf(address account) view returns (uint256)`
- `decimals() view returns (uint8)`
- `symbol() view returns (string)`

---

## Usage Example

### Request Tokens (cURL)

```bash
curl -X POST http://localhost:3500/api/request \
  -H "Content-Type: application/json" \
  -d '{"address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"}'
```

### Get Faucet Info

```bash
curl http://localhost:3500/api/info
```

---

## Notes

- **Development Only:** This faucet is for local development/testing
- **Anvil Defaults:** Uses Anvil's default accounts for funding
- **No Authentication:** Public endpoint (use firewall rules for security)
- **Static Frontend:** Serves static HTML UI from `/public` directory

---

**Generated:** 2026-02-26
**Last Updated:** 2026-02-26
