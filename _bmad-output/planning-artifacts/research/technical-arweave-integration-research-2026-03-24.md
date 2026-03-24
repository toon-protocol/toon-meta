# Arweave Integration Research for Overmind Protocol

**Date:** 2026-03-24
**Context:** Evaluating Arweave libraries for overmind state persistence (docker-compose, agent-state, event-log, config)

---

## Recommendation: ArDrive Turbo (`@ardrive/turbo-sdk`)

**Package:** `@ardrive/turbo-sdk` v1.41.0
**Status:** Actively maintained, TypeScript-first, well-documented

### Why Turbo

| Factor | arweave-js (L1) | Irys | ArDrive Turbo |
|---|---|---|---|
| Maintained | Yes | Arweave SDK archived | Yes, actively |
| Instant availability | No (~2 min) | Was instant | Yes, instant |
| Multi-token payment | AR only | Deprecated | AR, ETH, SOL, USDC, fiat |
| TypeScript SDK | Basic | Deprecated | First-class, well-typed |
| Node.js support | Yes (18+) | Yes | Yes (CJS + ESM) |

### Critical: Irys is Deprecated for Arweave

Irys pivoted to its own L1 datachain (Nov 2025). The `@irys/sdk` Arweave bundler functionality is deprecated, GitHub repo archived. **Do not adopt Irys.**

### EVM Key Bridge

Turbo's `EthereumSigner` allows paying with ETH/USDC using secp256k1 private keys — same key format TOON already uses. No need for separate Arweave JWK wallet management.

```typescript
import { EthereumSigner, TurboFactory } from '@ardrive/turbo-sdk';
const signer = new EthereumSigner(privateKey);
const turbo = TurboFactory.authenticated({ signer });
```

---

## Cost Model

**Rate:** ~$6.35-$8.00 per GB (one-time, permanent, 200+ years)

| Item | Size | One-time Cost |
|---|---|---|
| Initial state (all files) | ~100 KB | ~$0.0007 |
| Per wake cycle (event log entry) | ~2 KB | ~$0.00001 |
| 1,000 cycles total | ~2 MB | ~$0.014 |
| 10,000 cycles total | ~20 MB | ~$0.14 |

**Storage costs are negligible for this use case.**

---

## Querying & Retrieval

**GraphQL** at `https://arweave.net/graphql` — query by owner + tags:

```graphql
query {
  transactions(
    owners: ["<arweave-address>"],
    tags: [
      { name: "App-Name", values: ["toon-overmind"] },
      { name: "Overmind-Pubkey", values: ["<hex-pubkey>"] },
      { name: "Content-Kind", values: ["agent-state"] }
    ],
    sort: HEIGHT_DESC, first: 10
  ) {
    edges { node { id tags { name value } block { timestamp height } } }
  }
}
```

**Direct reads:** `https://arweave.net/<txId>` — instant, CDN-backed

**Gateway options:** arweave.net (official), Goldsky (high-performance), ar.io (decentralized)

---

## Tag Schema for Overmind State

```
App-Name:        "toon-overmind"
Overmind-Pubkey: "<nostr-npub-hex>"
Content-Kind:    "docker-compose" | "agent-state" | "event-log" | "config"
Cycle-Number:    "<N>"
Version:         "<semver>"
Content-Type:    "application/json" | "application/yaml"
```

---

## Local Development

**ArLocal** (`npx arlocal`) — runs local gateway on port 1984.
- Archived May 2025 but still functional
- Supports GraphQL, tags, data transactions
- Must manually call `/mine` to confirm transactions
- No external dependencies

```typescript
const arweave = Arweave.init({ host: 'localhost', port: 1984, protocol: 'http' });
await fetch('http://localhost:1984/mint/<address>/1000000000000'); // test tokens
await fetch('http://localhost:1984/mine'); // confirm transactions
```

---

## Architecture for Overmind

```
Upload path:     Overmind TEE → @ardrive/turbo-sdk → Arweave (instant via Turbo)
Read path:       Provider → https://arweave.net/<txId> (direct, fast)
Query path:      Any node → arweave.net/graphql (by tags)
Dev/test path:   ArLocal on port 1984 (local, free)
Payment:         USDC via EthereumSigner (reuses TOON wallet keys)
```

---

## Key Risks

- ArLocal archived — no new features, but stable for testing
- L1 confirmation ~2 min (Turbo provides instant availability, settles in background)
- JWK vs secp256k1 key format — Turbo's EthereumSigner bridges this
- Gateway availability — use multiple gateways for redundancy
