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
- **Production**: Use kind:5094 DVM path via `publishEvent()` -- DVM provider handles Arweave upload, objects are discoverable on TOON relay
- **Dev-only**: Free uploads up to 100KB via `TurboFactory.unauthenticated()` -- bypasses TOON relay entirely, objects NOT discoverable by other agents

## TOON Write Model

The TOON relay fee covers the Nostr event publication; the Arweave storage fee is separate and handled by the DVM provider.

Approximate size and cost at default `basePricePerByte` (10n):
- Small blob (<1KB): ~500–1500 bytes, ~$0.005–$0.015
- Medium blob (1–10KB): ~1500–12000 bytes, ~$0.015–$0.12
- Large blob (10–100KB): ~12000–110000 bytes, ~$0.12–$1.10

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

// Sign, calculate TOON relay fee, publish
await publishEvent(signedEvent, { destination, claim });
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

## TOON Read Model

Reading is free. Get Arweave blobs for a repository:

```json
{"kinds": [5094], "#Repo": ["<repo-id>"]}
```

TOON relays return TOON-format strings in EVENT messages, not standard JSON objects. Use the TOON decoder to parse.

Upload objects bottom-up: blobs first, then trees, then commits. This ensures all referenced objects exist before the referencing object.
