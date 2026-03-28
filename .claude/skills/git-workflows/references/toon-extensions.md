# TOON Extensions for Git Workflows

> **Why this reference exists:** Each git workflow on TOON involves multiple `publishEvent()` calls across different event kinds. This file provides total workflow cost breakdowns, cost comparison tables, and optimization strategies that span the full workflow rather than individual events. Understanding the total cost of a workflow helps agents make economic decisions: should I submit a patch or a PR? Should I upload all objects or deduplicate first? Is this repository worth creating on-chain?

## Total Workflow Costs

Default `basePricePerByte` = 10n ($0.00001/byte).

### Workflow 1: Create a Repository

| Step | Event Kind | Count | Approximate Cost |
|------|-----------|-------|-----------------|
| Announce repo | kind:30617 | 1 | ~$0.004-$0.005 |
| Upload blobs | kind:5094 | N blobs | ~$0.005-$0.15 each |
| Upload trees | kind:5094 | N trees | ~$0.005-$0.008 each |
| Upload commit | kind:5094 | 1 | ~$0.005-$0.008 |
| Publish state | kind:30618 | 1 | ~$0.002-$0.004 |

**Total by repository size:**

| Repository Profile | Files | Total Bytes | publishEvent() Calls | Estimated Total Cost |
|-------------------|-------|------------|---------------------|---------------------|
| Tiny (1 file, README) | 1 | ~100 bytes | 4 | ~$0.02-$0.03 |
| Small (10 files, ~50KB) | 10 | ~50 KB | ~14 | ~$0.10-$0.20 |
| Medium (50 files, ~200KB) | 50 | ~200 KB | ~54 | ~$0.50-$1.00 |
| Large (200 files, ~1MB) | 200 | ~1 MB | ~204 | ~$2.50-$5.00 |
| Binary-heavy (images, assets) | varies | ~10 MB | varies | ~$25-$50 |

The dominant cost is blob uploads. Each blob's kind:5094 event carries base64-encoded content (~33% overhead), and the relay fee is `basePricePerByte * eventBytes`.

### Workflow 2: Submit a Patch

| Step | Event Kind | Count | Approximate Cost |
|------|-----------|-------|-----------------|
| Publish patch | kind:1617 | 1 (or N for series) | ~$0.005-$0.50 each |

**Total by patch size:**

| Patch Profile | Diff Size | Event Size | Cost |
|--------------|----------|-----------|------|
| Trivial fix (1-5 lines) | ~200 bytes | ~500 bytes | ~$0.005 |
| Small fix (10-30 lines) | ~1 KB | ~1.5 KB | ~$0.015 |
| Medium feature (50-100 lines) | ~5 KB | ~5.5 KB | ~$0.055 |
| Large feature (200-500 lines) | ~20 KB | ~20.5 KB | ~$0.205 |
| Monolithic refactor (1000+ lines) | ~50 KB | ~50.5 KB | ~$0.505 |

**Patch series cost = SUM(individual patch costs).** A 3-patch series with small fixes costs ~$0.045 total.

### Workflow 3: Merge a Patch

| Step | Event Kind | Count | Approximate Cost |
|------|-----------|-------|-----------------|
| Upload new blobs | kind:5094 | N changed | ~$0.005-$0.15 each |
| Upload new trees | kind:5094 | N changed | ~$0.005-$0.008 each |
| Upload new commit | kind:5094 | 1 | ~$0.005-$0.008 |
| Publish merge status | kind:1631 | 1 | ~$0.003-$0.004 |
| Update state | kind:30618 | 1 | ~$0.002-$0.004 |

**Total by merge complexity:**

| Merge Profile | Changed Files | publishEvent() Calls | Estimated Total Cost |
|--------------|--------------|---------------------|---------------------|
| Trivial (1 file changed) | 1 | 5 | ~$0.020-$0.030 |
| Small (3 files changed) | 3 | 7 | ~$0.030-$0.060 |
| Medium (10 files changed) | 10 | 14 | ~$0.060-$0.150 |
| Large (50 files changed) | 50 | 54 | ~$0.300-$0.800 |

**Key insight:** The maintainer pays for the merge, not the contributor. Merging a large patch is expensive because the maintainer must upload all new git objects to Arweave.

### Workflow 4: Fetch a File from Arweave

| Step | Operation | Cost |
|------|----------|------|
| Read state | NIP-01 subscription | FREE |
| Resolve SHAs | Arweave GraphQL | FREE |
| Download objects | Arweave gateway | FREE |
| **Total** | | **$0.00** |

Fetching is entirely free. Pay to write, free to read.

## Workflow Cost Comparisons

### Patch vs Pull Request

| Contribution Type | Content | Typical Size | Cost |
|------------------|---------|-------------|------|
| Patch (kind:1617) | Full diff in event content | 500-50000 bytes | $0.005-$0.50 |
| Pull Request (kind:1618) | Markdown description only | 400-1000 bytes | $0.004-$0.01 |

**Decision rule:** Use patches for small, focused changes (<5KB diff). Use PRs for large contributions where the diff would be expensive. PRs are always cheaper because the actual code is fetched via clone URL, not embedded in the event.

### Upload-First vs Patch-Only

Two strategies for contributing code:

| Strategy | How It Works | Cost Structure |
|----------|-------------|---------------|
| **Patch-only** | Submit kind:1617 with diff; maintainer applies and uploads objects | Contributor pays patch cost; maintainer pays Arweave upload |
| **Upload-first** | Upload objects to Arweave via kind:5094, then submit kind:1618 PR pointing to them | Contributor pays Arweave upload + PR cost; maintainer pays only status + state update |

**Patch-only is cheaper for contributors** but shifts the upload cost to maintainers. Upload-first is more self-service but requires the contributor to pay for Arweave storage.

### Single Patch vs Patch Series

| Approach | Total Diff Size | Overhead | Cost |
|----------|---------------|----------|------|
| 1 monolithic patch (50KB) | 50 KB | 1 event overhead | ~$0.505 |
| 5 focused patches (10KB each) | 50 KB | 5 event overheads (~2.5KB) | ~$0.525 |

Splitting into a series adds ~5% overhead from event metadata duplication but dramatically improves reviewability. The marginal cost of better review structure is negligible.

## Cost Optimization Strategies

### 1. SHA-1 Deduplication (Saves 20-80% on Arweave Uploads)

Before uploading any git object via kind:5094, check if it already exists on Arweave:

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

If results exist, skip the upload. This is especially valuable for:
- **Unchanged files between commits** -- same blob SHA, no re-upload needed
- **Shared dependencies** -- common library files across repositories
- **Tree objects** -- directory structures that did not change

In a typical merge of 3 files in a 50-file repository, deduplication skips ~47 blob uploads and ~8 tree uploads, saving ~90% of upload costs.

### 2. Minimal Diffs (Saves 50-90% on Patch Costs)

Every byte of diff content costs money. Optimization techniques:

- **Avoid whitespace-only changes.** Reformatting adds bytes without value.
- **Split large changes into focused patches.** Easier to review and same total cost.
- **Write concise commit messages.** The message is part of the `git format-patch` output.
- **Use PRs for large contributions.** A markdown description is far cheaper than embedding a 50KB diff.

### 3. Batch Object Uploads (Saves Round-Trip Overhead)

When creating a repository or merging a large patch, upload all objects in a single session:

1. Collect all unique objects to upload
2. Check Arweave for duplicates in bulk (one GraphQL query with multiple SHA values)
3. Upload only missing objects
4. Publish state only after all uploads succeed

This avoids partial state where some objects are on Arweave but the state event references objects that are not yet available.

### 4. Replaceable Events Are Free Updates

kind:30617 (repo announcement) and kind:30618 (repo state) are parameterized replaceable events. Updates replace the previous version at the same per-byte cost -- you do not pay for accumulated history. Update metadata freely without worrying about cost accumulation.

### 5. Status Events Are Cheap -- Use Them

Status events (kind:1630-1633) cost ~$0.002-$0.004. Never skip lifecycle management to save money. Close resolved issues, merge applied patches, and mark works-in-progress as draft. The cost is negligible compared to the organizational value.

## Multi-Hop Cost Considerations

On multi-hop TOON routes, each intermediate connector adds a fee:

```
totalAmount = basePricePerByte * bytes + SUM(hopFees[i] * bytes)
```

For git workflows with many `publishEvent()` calls, multi-hop routing compounds the overhead. Optimization: connect to the relay directly (single hop) when performing bulk operations like repository creation or merge uploads.

## Reading Git Events on TOON

All reading operations are free. Common filters for git workflow verification:

**Verify repository was announced:**
```json
{"kinds": [30617], "authors": ["<maintainer-pubkey>"], "#d": ["<repo-id>"]}
```

**Verify state was published:**
```json
{"kinds": [30618], "authors": ["<maintainer-pubkey>"], "#d": ["<repo-id>"]}
```

**Verify patch was accepted:**
```json
{"kinds": [1617], "authors": ["<contributor-pubkey>"], "#a": ["30617:<maintainer-pubkey>:<repo-id>"]}
```

**Check merge status:**
```json
{"kinds": [1631], "#e": ["<patch-event-id>"]}
```

**List Arweave uploads for a repo:**
```json
{"kinds": [5094], "#Repo": ["<repo-id>"]}
```

TOON relays return TOON-format strings in EVENT messages, not standard JSON objects. Use the TOON decoder to parse responses.

## Integration with Protocol Core

For the complete TOON write model, read model, and fee calculation details, refer to `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`. This file covers workflow-level cost aggregation; the protocol core covers the foundational mechanics shared by all event kinds.
