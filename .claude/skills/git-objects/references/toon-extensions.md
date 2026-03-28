# TOON Extensions for Git Objects

> **Why this reference exists:** Git objects on TOON are uploaded to Arweave via kind:5094 DVM requests. This file covers the TOON-specific considerations for git object construction and upload -- the relationship between binary object format and kind:5094 events, base64 encoding overhead and its cost impact, upload ordering constraints, deduplication via content-addressed SHA-1, and the fee economics of storing git objects on the TOON network.

## Relationship to kind:5094 Uploads

Git objects are not Nostr event kinds themselves. They are binary payloads uploaded to Arweave through the DVM pipeline using kind:5094 blob storage requests. The flow:

1. **Construct** the git object in binary format (blob, tree, or commit)
2. **Compute** its SHA-1 hash for content addressing
3. **Base64-encode** the binary object for the kind:5094 `i` tag payload
4. **Publish** the kind:5094 event via `publishEvent()` from `@toon-protocol/client`

The kind:5094 event carries TOON-specific tags that link the Arweave upload to the git object graph:

| Tag | Purpose | Example |
|-----|---------|---------|
| `Git-SHA` | Content address of the git object | `95d09f2b10159347eece71399a7e2e907ea3df4f` |
| `Git-Type` | Object type | `blob`, `tree`, or `commit` |
| `Repo` | Repository identifier | `toon-sdk` |
| `Content-Type` | MIME type for Arweave | `application/octet-stream` |

See the `git-collaboration` skill for the complete kind:5094 event structure and tag format.

## Publishing Flow on TOON

All git object uploads go through `publishEvent()` from `@toon-protocol/client`. Raw WebSocket writes are rejected -- the relay requires ILP payment.

### Upload Flow

1. **Construct the git object binary** (see nip-spec.md and scenarios.md)
2. **Compute SHA-1** of the complete binary object
3. **Check Arweave for duplicates** -- query by `Git-SHA` tag to avoid paying for an object that already exists
4. **Base64-encode** the binary object
5. **Construct the kind:5094 event** with `i` tag containing the base64 payload, plus `Git-SHA`, `Git-Type`, and `Repo` tags
6. **Sign the event** with the agent's Nostr private key
7. **Discover pricing** from the relay's `basePricePerByte`
8. **Calculate fee**: `basePricePerByte * serializedEventBytes`
9. **Publish** via `publishEvent()`

### Error Handling

- **F04 (Insufficient Payment):** Recalculate with the correct `basePricePerByte` and retry.
- **Relay rejection:** Malformed event (invalid signature, missing tags). Fix and republish.
- **DVM failure (kind:7000 error):** The Arweave upload provider could not store the object. Check the error content for details.

## Base64 Encoding Overhead

Git objects are binary data, but the kind:5094 `i` tag carries them as base64-encoded strings. Base64 encoding increases data size by approximately 33%:

| Binary Size | Base64 Size | Overhead |
|------------|------------|----------|
| 100 bytes | ~136 bytes | +36 bytes |
| 1 KB | ~1.37 KB | +370 bytes |
| 10 KB | ~13.7 KB | +3.7 KB |
| 100 KB | ~137 KB | +37 KB |
| 1 MB | ~1.37 MB | +370 KB |

This overhead directly increases the kind:5094 event size and therefore the ILP relay write fee. The base64 payload dominates the event size for all but the smallest objects.

## Fee Considerations for Git Object Uploads

### kind:5094 Event Cost (Relay Write Fee)

The relay write fee is `basePricePerByte * serializedEventBytes`. The serialized event includes the base64 payload plus all tags and metadata:

| Object Type | Typical Binary Size | Base64 Size | Event Size (with tags) | Approx Cost |
|------------|-------------------|------------|----------------------|-------------|
| Small blob (README) | 100-500 bytes | 136-680 bytes | ~350-900 bytes | ~$0.004-$0.009 |
| Medium blob (source file) | 1-10 KB | 1.4-13.7 KB | ~1.6-14 KB | ~$0.016-$0.14 |
| Large blob (binary/image) | 100 KB-1 MB | 137 KB-1.37 MB | ~137 KB-1.37 MB | ~$1.37-$13.70 |
| Tree (10 entries) | ~400 bytes | ~544 bytes | ~760 bytes | ~$0.008 |
| Tree (50 entries) | ~2 KB | ~2.7 KB | ~2.9 KB | ~$0.029 |
| Commit (no GPG sig) | ~250-400 bytes | ~340-544 bytes | ~560-760 bytes | ~$0.006-$0.008 |

### Arweave Storage Cost (Provider Fee)

The DVM provider charges separately for Arweave permanent storage. This cost is determined by the provider's kindPricing in their kind:10035 SkillDescriptor. On TOON, the prepaid model means the job request payment covers both relay write fee and compute/storage fee.

### Total Cost = Relay Write Fee + Provider Fee

The relay write fee scales with the kind:5094 event size (dominated by base64 payload). The provider fee scales with the binary object size stored on Arweave. Both scale linearly with object size.

## Upload Ordering Constraints

Git objects form a directed acyclic graph (DAG). References must exist on Arweave before the referencing object is uploaded:

1. **Blobs first** -- blobs have no references to other objects
2. **Trees second** -- trees reference blob SHA-1s and subtree SHA-1s
3. **Commits last** -- commits reference tree SHA-1s and parent commit SHA-1s

Uploading out of order means a tree or commit references objects that do not yet exist on Arweave. While the upload may succeed, the object graph cannot be fully resolved until all referenced objects are present.

### Upload Strategy for a Complete Repository Snapshot

1. Identify all unique blobs (file contents)
2. Check Arweave for existing blobs by `Git-SHA` tag -- skip duplicates
3. Upload missing blobs via kind:5094
4. Construct and upload trees (bottom-up: leaf directories first, then parent directories)
5. Construct and upload the commit object last

### Cost Optimization: Deduplication

SHA-1 content addressing enables deduplication. Before uploading any object:

```graphql
query {
  transactions(
    tags: [
      { name: "Git-SHA", values: ["<sha1-hex>"] },
      { name: "Repo", values: ["<repo-identifier>"] }
    ]
  ) {
    edges { node { id } }
  }
}
```

If the query returns results, the object already exists on Arweave. Skip the upload and save the kind:5094 event cost. This is especially valuable for blobs -- identical file contents across repositories or branches share the same SHA-1.

## Economic Dynamics of Git Object Storage on TOON

### Per-Byte Cost Creates Incentive for Small Commits

On TOON, every byte uploaded costs money. This creates natural incentives:

- **Minimal diffs** -- change only what needs changing. Large refactoring commits that touch many files cost proportionally more.
- **Compact file formats** -- prefer text over binary when practical. Binary blobs (images, compiled assets) are expensive.
- **Deduplication awareness** -- unchanged files between commits produce the same blob SHA-1 and do not need re-uploading.

### Permanent Storage vs Temporary Cost

Arweave provides permanent storage. The upload cost is one-time -- once an object is on Arweave, it persists indefinitely with no ongoing fees. The TOON relay write fee is also one-time (the kind:5094 event publication). This model favors infrequent, well-considered uploads over rapid iteration.

### Cost Comparison: Git Object Types

Commits and trees are typically cheap (small events). Blobs vary enormously depending on file size. A repository with many small text files is far cheaper to upload than one with large binary assets.

| Repository Profile | Estimated Upload Cost |
|-------------------|---------------------|
| Small project (10 files, ~50 KB total) | ~$0.10-$0.20 |
| Medium project (100 files, ~500 KB total) | ~$1.00-$2.00 |
| Large project (1000 files, ~5 MB total) | ~$10.00-$20.00 |
| Binary-heavy project (images, assets) | Significantly higher |

These estimates include both relay write fees and approximate Arweave provider fees.

## Integration with Protocol Core

For the complete TOON write model, read model, and fee calculation details, refer to `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`. This file covers git-object-specific upload economics; the protocol core covers the foundational mechanics shared by all event kinds.
