# TOON Extensions for Git Workflows

> **Why this reference exists:** Each git workflow on TOON involves multiple `client.send()` calls across different event kinds, and they do not all terminate at the same place. This file gives the whole-workflow price breakdown, route by route, and the optimization strategies that still hold once the relay's price is flat. It answers the economic questions an agent actually faces: should I submit a patch or a PR? Should I upload all objects or deduplicate first?

## The Two Routes a Git Workflow Touches

Probed 2026-08-28. Prices are in the settlement token's smallest unit; USDC is 6-decimal, so `1_000_000` = $1.

| Route | Price | What it carries |
|-------|-------|-----------------|
| `g.toon.relay` | **1 base unit, flat** | every NIP-34 Nostr event: kind:30617, kind:30618, kind:1617, kind:1618, kind:1621, kind:1622, kind:1630-1633 |
| `g.toon.store` / `g.toon.relay.store` | **1000 + 10 per KiB** of sealed payload | git objects pushed as blobs (kind:5094) |

Everything in a git workflow that is a Nostr event costs the same 1 base unit, whatever its size. Only git objects climb a slope, and the length that counts is the **sealed** payload the PREPARE carries -- not the event JSON you built, which is smaller by the envelope and the wrap. You therefore cannot compute a charge from your own event. Let `client.send()` price the packet, or ask: `await client.routePrice(destination)` returns `{ price, pricePerKib? }` and `chargeFor(terms, sealedBytes)` turns that into a charge.

## Total Workflow Costs

### Workflow 1: Create a Repository

| Step | Event Kind | Count | Route | Price |
|------|-----------|-------|-------|-------|
| Announce repo | kind:30617 | 1 | relay | 1 |
| Upload blobs | kind:5094 | N blobs | store | 1000 + 10/KiB each |
| Upload trees | kind:5094 | N trees | store | ~1010 each (trees are small) |
| Upload commit | kind:5094 | 1 | store | ~1010 |
| Publish state | kind:30618 | 1 | relay | 1 |

The two relay writes are rounding error. The whole cost of creating a repository is the object uploads, and it is dominated by the store route's 1000-unit flat component times the number of objects -- so **object count matters more than repository size** until the files get large. A one-file repository is 3 store writes plus 2 relay writes, roughly 3032 base units (~$0.003). Base64 encoding inflates the payload by ~33% before sealing, which shows up on the per-kibibyte slope.

### Workflow 2: Submit a Patch

One kind:1617 event on the relay: **1 base unit**. A patch series of N patches (plus a cover letter) is N+1 relay writes.

Patch size no longer affects price at all. A one-line fix and a 50 KB monolithic refactor both cost 1 base unit. Any advice to keep patches small is now about reviewability, not money.

### Workflow 3: Merge a Patch

| Step | Event Kind | Count | Route | Price |
|------|-----------|-------|-------|-------|
| Upload new blobs | kind:5094 | N changed | store | 1000 + 10/KiB each |
| Upload new trees | kind:5094 | N changed | store | ~1010 each |
| Upload new commit | kind:5094 | 1 | store | ~1010 |
| Publish merge status | kind:1631 | 1 | relay | 1 |
| Update state | kind:30618 | 1 | relay | 1 |

**Key insight:** the maintainer pays for the merge, not the contributor -- and what the maintainer pays for is the object uploads. A merge touching 1 file is ~3 store writes; one touching 50 files is ~50+ store writes. Deduplication is what keeps that number down.

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

Both are single relay writes at 1 base unit. A kind:1617 carrying a 50 KB diff and a kind:1618 carrying a paragraph of markdown cost exactly the same.

**Decision rule:** choose on workflow grounds, not price. A patch is self-contained and reviewable from the event alone; a PR points at an external clone URL that has to stay reachable. The old advice -- "use a PR for large contributions because the diff would be expensive" -- is no longer true.

### Upload-First vs Patch-Only

| Strategy | How It Works | Who pays what |
|----------|-------------|---------------|
| **Patch-only** | Submit kind:1617 with diff; maintainer applies and uploads objects | Contributor pays 1 base unit; maintainer pays every store write |
| **Upload-first** | Upload objects via kind:5094, then submit a kind:1618 PR pointing at them | Contributor pays the store writes plus 1 base unit; maintainer pays 2 base units |

The asymmetry is real and it is entirely in the store route. Patch-only is nearly free for the contributor and puts the whole upload bill on the maintainer.

### Single Patch vs Patch Series

A monolithic 50 KB patch is 1 relay write. Five focused 10 KB patches are 5 relay writes -- 5 base units instead of 1. The difference is five millionths of a dollar, against a large gain in reviewability. Split freely.

## Cost Optimization Strategies

### 1. SHA-1 Deduplication (the one that actually saves money)

Before uploading any git object via kind:5094, check whether it already exists on Arweave:

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

If results exist, skip the upload and avoid a whole store-route charge. This is especially valuable for:
- **Unchanged files between commits** -- same blob SHA, no re-upload needed
- **Shared dependencies** -- common library files across repositories
- **Tree objects** -- directory structures that did not change

In a typical merge of 3 files in a 50-file repository, deduplication skips ~47 blob uploads and ~8 tree uploads. Since each skipped upload avoids at least the store route's 1000-unit flat component, this is by far the largest saving available in any git workflow.

### 2. Minimal Diffs (a review argument, not a price argument)

Diff size does not change what a patch costs -- the relay route is flat. Keep diffs minimal anyway:

- **Avoid whitespace-only changes.** Reformatting buries the real change.
- **Split large changes into focused patches.** Easier to review, and five relay writes cost five base units.
- **Write concise commit messages.** The message ships in the `git format-patch` output and in the commit object, which *is* metered on the store route.

Where diff size does cost money is downstream: a bigger change produces more and larger git objects for whoever merges it.

### 3. Batch Object Uploads

When creating a repository or merging a large patch, upload all objects in a single session:

1. Collect all unique objects to upload
2. Check Arweave for duplicates in bulk (one GraphQL query with multiple SHA values)
3. Upload only missing objects
4. Publish state only after all uploads succeed

This avoids partial state where some objects are on Arweave but the state event references objects that are not yet available.

### 4. Replaceable Events Are Cheap Updates

kind:30617 (repo announcement) and kind:30618 (repo state) are parameterized replaceable events. Each update is one flat relay write and the relay retains one version, so you never pay for accumulated history. Update metadata freely.

### 5. Status Events Are Cheap -- Use Them

Status events (kind:1630-1633) cost 1 base unit, like everything else on the relay. Never skip lifecycle management to save money. Close resolved issues, merge applied patches, and mark works-in-progress as draft.

## Multi-Hop Considerations

A **fee** is flat per packet and belongs to the peering -- never per-route, and it does not scale with payload length. So a multi-hop route adds a fixed amount per packet, whatever the packet carries:

```
totalAmount = routePrice(destination, sealedBytes) + SUM(hopFee[i])
```

For workflows with many `client.send()` calls the hop fees add up once per packet, never scaling with the payload's length. Two rejects tell you when a hop is the problem: `T04` means you are over the peering's cap, and the message states the cap -- the only way a sender learns it; `R01` means this hop's fee alone exceeds the arriving amount. A REJECT comes back as `{ fulfilled: false }` and is never thrown.

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

These are free plain NIP-01 reads: the relay returns standard JSON `EVENT` messages, no decoder and no connector in the path. TOON format applies only to the sealed write payload described above.

## Integration with Protocol Core

For the complete TOON write model, read model, and route pricing details, refer to `skills/nostr-protocol-core/references/toon-protocol-context.md`. This file covers workflow-level cost aggregation; the protocol core covers the foundational mechanics shared by all event kinds.
