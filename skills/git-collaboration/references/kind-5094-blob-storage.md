# Kind:5094 — Arweave Blob Storage DVM

> **Progressive disclosure:** This is a Level 3 per-kind reference for kind:5094. For the full NIP-34 overview, see [nip-spec.md](nip-spec.md). For TOON economics, see [toon-extensions.md](toon-extensions.md).

## Purpose

Uploads git objects (blob, tree, commit) to Arweave via DVM job request. **Note:** kind:5094 is NOT a NIP-34 kind — it is a NIP-90 DVM job request kind used for Arweave blob storage, included as a cross-NIP reference because git collaboration depends on blob storage.

## Event Type

**Regular** (DVM job request).

## Content

Empty string (blob data goes in the `i` tag).

## Required Tags

Per TOON codebase (`packages/core/src/events/arweave-storage.ts`):

| Tag | Format | Description |
|-----|--------|-------------|
| `i` | `["i", "<base64-encoded-blob>", "blob"]` | Base64-encoded blob data with type marker |
| `bid` | `["bid", "<amount>", "usdc"]` | Bid amount in USDC micro-units |
| `output` | `["output", "<content-type>"]` | Expected output MIME type (e.g., `application/octet-stream`) |

## Optional Tags — Chunked Uploads

| Tag | Format | Description |
|-----|--------|-------------|
| `param` | `["param", "uploadId", "<uuid>"]` | Upload session ID |
| `param` | `["param", "chunkIndex", "<index>"]` | Chunk index (0-based) |
| `param` | `["param", "totalChunks", "<count>"]` | Total chunks in upload |
| `param` | `["param", "contentType", "<mime>"]` | Content MIME type |

## Git-Specific Tags (for Arweave Resolution)

| Tag | Format | Description |
|-----|--------|-------------|
| `Git-SHA` | `["Git-SHA", "<sha-hash>"]` | Content-addressed SHA hash of the git object |
| `Git-Type` | `["Git-Type", "<type>"]` | Git object type: `blob`, `tree`, or `commit` |
| `Repo` | `["Repo", "<repo-identifier>"]` | Repository identifier |

## Resolution

- Arweave GraphQL queries by `Git-SHA`, `Git-Type`, and `Repo` tags
- Manifest transactions for repository-level resolution
- Gateway URLs: `https://arweave.net/<tx-id>`
- **Production**: Use the kind:5094 DVM path via `client.send()` -- the DVM provider handles the Arweave upload, and objects are discoverable on the TOON relay
- **Dev-only**: Free uploads up to 100KB via `TurboFactory.unauthenticated()` -- bypasses TOON relay entirely, objects NOT discoverable by other agents

## TOON Write Model

Blob storage is the one git collaboration flow with more than one price in it:

- **The kind:5094 job-request event** goes to the relay route, `g.toon.relay`, which is flat-priced at **1 base unit** of 6-decimal USDC whatever the event's size.
- **The blob carried over the store route** — `g.toon.store`, also reachable as `g.toon.relay.store` — is priced **`1000 + 10 per KiB`** in base units. This is the one live route with a slope.
- **Arweave storage** is a separate fee again, settled by the DVM provider, not by the TOON route.

The metered quantity on the store route is the **sealed** payload: the gift-wrapped bytes the PREPARE actually carries, not the git object you read off disk. The seal adds the envelope and the wrap, so the charge cannot be derived from the object's own size — do not multiply, ask:

```typescript
import { chargeFor } from '@toon-protocol/client';

const terms = await client.routePrice('g.toon.store'); // { price, pricePerKib }
const charge = chargeFor(terms, sealedBytes);
```

In the ordinary case you need neither call: `client.send('g.toon.store', { body })` seals the payload, reads the route's price, mints the covering claim and carries it. A small blob settles at roughly 1010 base units (about $0.00101).

### Example 1: Upload a Git Blob

```typescript
const blobContent = Buffer.from(fileContent).toString('base64');

const event = {
  kind: 5094,
  content: '',
  tags: [
    ['i', blobContent, 'blob'],
    ['bid', '1000', 'usdc'],
    ['output', 'application/octet-stream'],
    ['Git-SHA', 'abc123def456...'],
    ['Git-Type', 'blob'],
    ['Repo', 'toon-sdk']
  ]
};

// Sign, then send -- the client seals it, prices the route and mints the claim
await client.send({ body: signedEvent });
// Wait for DVM response with Arweave tx-id
```

### Example 2: Upload a Git Tree

```typescript
const event = {
  kind: 5094,
  content: '',
  tags: [
    ['i', treeContent, 'blob'],
    ['bid', '500', 'usdc'],
    ['output', 'application/octet-stream'],
    ['Git-SHA', '789ghi012jkl...'],
    ['Git-Type', 'tree'],
    ['Repo', 'toon-sdk']
  ]
};
```

### Example 3: Chunked Upload (Large File)

```typescript
const event = {
  kind: 5094,
  content: '',
  tags: [
    ['i', chunk0Content, 'blob'],
    ['bid', '5000', 'usdc'],
    ['output', 'application/octet-stream'],
    ['param', 'uploadId', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'],
    ['param', 'chunkIndex', '0'],
    ['param', 'totalChunks', '5'],
    ['param', 'contentType', 'application/octet-stream'],
    ['Git-SHA', 'mno345pqr678...'],
    ['Git-Type', 'blob'],
    ['Repo', 'toon-sdk']
  ]
};
```

## Reading (free, plain NIP-01)

Reading is free. Get Arweave blobs for a repository:

```json
{"kinds": [5094], "#Repo": ["<repo-id>"]}
```

The relay answers reads with ordinary NIP-01 `EVENT` messages in plain JSON -- any Nostr client can parse them, and a free read never touches a connector.

Upload objects bottom-up: blobs first, then trees, then commits. This ensures all referenced objects exist before the referencing object.

## Event Structure (JSON)

```json
{
  "kind": 5094,
  "pubkey": "<hex-pubkey>",
  "created_at": 1711500000,
  "tags": [],
  "content": ""
}
```

## Filter Pattern

```json
{"kinds": [5094]}
```
