# TOON Extensions for Git-Arweave Integration

> **Why this reference exists:** Git-Arweave integration on TOON involves a dual-cost model unique to the protocol: the TOON relay write fee for the kind:5094 event (paid via ILP) and the Arweave permanent storage cost (handled by the DVM provider). This file covers the TOON-specific economics, fee calculations, free dev upload paths, cost optimization strategies, and the relationship between the DVM prepaid model and Arweave storage pricing.

## Dual-Cost Model

Every git object upload to Arweave via TOON incurs two separate costs:

### 1. TOON Relay Write Fee (kind:5094 Event)

The relay charges `basePricePerByte * serializedEventBytes` for publishing the kind:5094 DVM request. This fee is paid via ILP through the TOON payment channel.

The kind:5094 event size is dominated by the base64-encoded git object in the `i` tag. Base64 encoding adds ~33% overhead:

| Binary Object Size | Base64 Size | Event Size (with tags) | Relay Fee at 10n/byte |
|-------------------|-------------|----------------------|----------------------|
| 100 bytes | ~136 bytes | ~350 bytes | ~$0.004 |
| 1 KB | ~1.37 KB | ~1.6 KB | ~$0.016 |
| 10 KB | ~13.7 KB | ~14 KB | ~$0.14 |
| 50 KB | ~68.5 KB | ~69 KB | ~$0.69 |
| 100 KB | ~137 KB | ~137 KB | ~$1.37 |

### 2. Arweave Storage Cost (DVM Provider Fee)

The DVM provider charges for permanently storing the object on Arweave. This cost is covered by the `bid` tag amount in the kind:5094 event. The provider's pricing is advertised in their kind:10035 SkillDescriptor.

Arweave storage costs are relatively low for small objects:
- Objects under 100KB: effectively free via `TurboFactory.unauthenticated()` (dev mode)
- Larger objects: priced by the Arweave network based on data size and current network conditions

### Total Cost Formula

```
Total Upload Cost = TOON Relay Fee + DVM Provider Fee
                  = (basePricePerByte * kind5094EventBytes) + (provider's Arweave storage markup)
```

Both components scale linearly with object size. The relay fee scales with the base64-encoded size (larger than binary), while the Arweave fee scales with the binary size.

## Publishing Flow on TOON

All git-Arweave uploads go through `publishEvent()` from `@toon-protocol/client`. Raw WebSocket writes are rejected -- the relay requires ILP payment.

### Step-by-Step Flow

1. **Construct the git object** in binary format (see `git-objects` skill)
2. **Compute SHA-1** of the complete binary object
3. **Check Arweave for duplicates** via GraphQL query on `Git-SHA` tag (see nip-spec.md)
4. **Base64-encode** the binary object
5. **Construct the kind:5094 event** with required tags
6. **Sign the event** with the agent's Nostr private key
7. **Discover pricing** from the relay's `basePricePerByte` (via `/health` endpoint or kind:10032)
8. **Calculate fee**: `basePricePerByte * serializedEventBytes`
9. **Sign balance proof**: `client.signBalanceProof(channelId, amount)`
10. **Publish**: `client.publishEvent(signedEvent, { destination, claim })`
11. **Subscribe to kind:6094** for the DVM result containing the Arweave transaction ID

### Error Handling

- **F04 (Insufficient Payment):** The calculated amount was too low. Recalculate with actual serialized size and retry.
- **Relay rejection:** Malformed event (invalid signature, missing required tags). Fix and republish.
- **DVM failure (kind:7000 with error status):** The Arweave upload provider could not store the object. Check the error content for details (insufficient bid, upload failure, rate limit).
- **DVM timeout:** No kind:6094 or kind:7000 response within expected timeframe. The DVM provider may be offline. Try a different provider or retry.

## Free Dev Uploads (TurboFactory.unauthenticated)

For development and testing, `@ardrive/turbo-sdk` provides free uploads up to 100KB per object via `TurboFactory.unauthenticated()`. This bypasses the DVM provider entirely -- the agent uploads directly to Arweave.

### When to Use Free Dev Uploads

- **Development and testing** -- iterating on git object construction without paying TOON relay fees
- **Small repositories** -- projects where all files are under 100KB each
- **Proof of concept** -- validating the upload/resolution flow before committing to production

### Limitations

- Maximum 100KB per upload (base64-encoded size, not binary size)
- Rate-limited by Turbo service
- No wallet or credits required
- Not suitable for production workloads with large files

### Example

```typescript
import { TurboFactory } from '@ardrive/turbo-sdk';
import { Readable } from 'stream';

const turbo = TurboFactory.unauthenticated();

const uploadResult = await turbo.uploadFile({
  fileStreamFactory: () => Readable.from(gitObjectBuffer),
  fileSizeFactory: () => gitObjectBuffer.length,
  dataItemOpts: {
    tags: [
      { name: 'Git-SHA', value: sha1Hex },
      { name: 'Git-Type', value: 'blob' },
      { name: 'Repo', value: 'my-repo' },
      { name: 'Content-Type', value: 'application/octet-stream' },
      { name: 'App-Name', value: 'TOON-Git' }
    ]
  }
});

console.log(`Uploaded to: https://arweave.net/${uploadResult.id}`);
```

**Note:** Free dev uploads bypass the TOON relay entirely. The object is on Arweave but there is no kind:5094 event on the TOON relay. This means the object is not discoverable via TOON relay subscriptions -- only via Arweave GraphQL queries on the `Git-SHA` tag.

## Authenticated Uploads (Production)

For production workloads or files exceeding 100KB, use authenticated uploads via `@ardrive/turbo-sdk` with an Arweave JWK wallet or purchased Turbo credits.

### Cost Comparison: DVM Path vs Direct Upload

| Path | TOON Relay Fee | Arweave Cost | Total | Discoverability |
|------|---------------|-------------|-------|-----------------|
| DVM (kind:5094) | Yes (per-byte) | Covered by bid | Relay fee + bid | Via TOON relay + Arweave |
| Direct (turbo-sdk) | No | Wallet/credits | Arweave only | Arweave only |

The DVM path is the standard TOON flow -- it creates a discoverable record on the TOON relay and handles Arweave upload via the provider. Direct uploads are cheaper but bypass the relay.

## Cost Optimization Strategies

### 1. Deduplication (Most Important)

Before uploading any object, check Arweave for existing copies:

```graphql
query {
  transactions(
    tags: [
      { name: "Git-SHA", values: ["<sha1-hex>"] },
      { name: "Repo", values: ["<repo-id>"] }
    ]
    first: 1
  ) {
    edges { node { id } }
  }
}
```

If results exist, skip the upload. Savings: 100% of the upload cost for that object.

**Why this matters on TOON:** Every duplicate upload wastes both the TOON relay fee and the Arweave storage fee. SHA-1 content addressing means identical file contents across branches, commits, or repositories produce the same hash. A file that has not changed between commits does not need re-uploading.

### 2. Upload Ordering

Upload objects bottom-up: blobs first, trees second, commits last. This ensures:
- All referenced objects exist before the referencing object
- If an upload fails mid-way, the uploaded objects are still valid and reusable
- Trees and commits can reference already-uploaded blobs without re-upload

### 3. Exclude Unnecessary Files

Before bulk uploading a repository:
- Skip build artifacts, `node_modules`, compiled binaries
- Skip files matching `.gitignore` patterns
- Consider whether binary assets (images, fonts) need to be on Arweave
- Large binary files dominate upload cost -- a 1MB image costs ~$13.70 in relay fees alone

### 4. Incremental Uploads

After the initial repository upload, only upload changed objects:
- Compare the new commit's tree with the previous commit's tree
- Identify new or modified blobs (different SHA-1)
- Upload only the new blobs, the new tree(s), and the new commit
- Unchanged blobs share the same SHA-1 and already exist on Arweave

### 5. Batch Deduplication Queries

When uploading multiple objects, batch the deduplication queries:

```graphql
query {
  transactions(
    tags: [
      { name: "Git-SHA", values: ["sha1", "sha2", "sha3", ...] },
      { name: "Repo", values: ["my-repo"] }
    ]
    first: 100
  ) {
    edges {
      node {
        tags { name value }
      }
    }
  }
}
```

This reduces the number of GraphQL queries from N to ceil(N/100).

### 6. Manifest Transactions

For repositories with many objects, create a manifest transaction after uploading all objects. Benefits:
- Single entry point for the entire repository
- Path-based resolution (no individual GraphQL queries needed)
- Cheaper resolution for consumers navigating the DAG

## Cost Estimates by Repository Profile

| Profile | Files | Total Size | Relay Fees | Arweave Storage | Total Estimate |
|---------|-------|-----------|------------|-----------------|----------------|
| Micro (3 files, 5KB) | 3 blobs + 1 tree + 1 commit | ~7KB | ~$0.03 | ~$0.001 | ~$0.03 |
| Small (20 files, 50KB) | ~25 objects | ~70KB base64 | ~$0.20 | ~$0.005 | ~$0.21 |
| Medium (100 files, 500KB) | ~120 objects | ~700KB base64 | ~$2.00 | ~$0.05 | ~$2.05 |
| Large (500 files, 5MB) | ~600 objects | ~7MB base64 | ~$20.00 | ~$0.50 | ~$20.50 |
| Binary-heavy (100 files, 50MB) | ~120 objects | ~70MB base64 | ~$200.00 | ~$5.00 | ~$205.00 |

**Key insight:** The TOON relay fee dominates total cost for most repositories. This is because the relay fee is based on the base64-encoded event size, which is ~33% larger than the binary object. Arweave permanent storage is comparatively cheap.

## Permanent Storage Economics

Arweave provides permanent storage -- objects persist indefinitely with no ongoing fees. This fundamentally changes the economics compared to traditional hosting:

- **One-time cost:** Pay once for the upload; the object is available forever at `https://arweave.net/<tx-id>`
- **No renewal fees:** Unlike traditional storage, there is no monthly or annual cost
- **Immutable:** Once uploaded, the object cannot be modified or deleted -- only superseded by new versions
- **Content-addressed:** The SHA-1 hash in the `Git-SHA` tag provides a verifiable link between the git object graph and Arweave storage

This model favors well-considered, infrequent uploads. On TOON, the per-byte cost of the kind:5094 event further incentivizes uploading only necessary, minimal objects -- aligning with git best practices of small, focused commits.

## Integration with Protocol Core

For the complete TOON write model, read model, and fee calculation details, refer to `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`. This file covers git-Arweave-specific upload economics; the protocol core covers the foundational mechanics shared by all event kinds.

For the kind:5094 event structure and tag format, see the `git-collaboration` skill's `kind-5094-arweave-blob.md` reference.

For git object binary construction (blob, tree, commit format), see the `git-objects` skill.
