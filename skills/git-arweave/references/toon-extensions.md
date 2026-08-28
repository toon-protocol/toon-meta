# TOON Extensions for Git-Arweave Integration

> **Why this reference exists:** Git-Arweave integration on TOON involves a dual-cost model unique to the protocol: the price of the kind:5094 write to the store route (paid via ILP) and the Arweave permanent storage cost (handled by the DVM provider). This file covers the TOON-specific economics, how the store route is priced, free dev upload paths, cost optimization strategies, and the relationship between the DVM prepaid model and Arweave storage pricing.

## Dual-Cost Model

Every git object upload to Arweave via TOON incurs two separate costs:

### 1. The Store Route's Price (kind:5094 Event)

Blob storage terminates at `g.toon.store` (also reachable as `g.toon.relay.store`). Unlike the relay's flat route, the store route's price is a **schedule over payload length**: `1000 + 10 * ceil(sealedBytes / 1024)`, in base units of 6-dp USDC. A small object is ~1010 base units, about $0.00101.

The metered quantity is the **sealed** payload -- the gift-wrapped bytes the PREPARE carries -- not the event JSON and not the file you started from. It is larger than both, by the envelope and the wrap. You therefore cannot work out the charge from the base64 length of your `i` tag, and you should not try.

Two consequences worth holding on to:

- **The store route is the one place where size moves the price.** Nostr events on `g.toon.relay` are flat at 1 base unit regardless of length; a kind:5094 blob write is not. Every KiB is another 10 base units.
- **Ask, do not multiply.** `await client.routePrice('g.toon.store')` returns `{ price, pricePerKib }`, and `chargeFor(terms, sealedBytes)` from `@toon-protocol/client` turns those terms into a charge. `chargeFor` is the only thing that should decide what goes on a claim. In the ordinary case you need neither: `send()` prices the packet itself.

### 2. Arweave Storage Cost (DVM Provider Fee)

The DVM provider charges for permanently storing the object on Arweave. This cost is covered by the `bid` tag amount in the kind:5094 event. To learn what a provider's node charges, read its own `GET /ilp` self-description -- free and unauthenticated, listing its addresses, settlement facts and every route's price. A connector answers; it never announces.

Arweave storage costs are relatively low for small objects:
- Objects under 100KB: effectively free via `TurboFactory.unauthenticated()` (dev mode)
- Larger objects: priced by the Arweave network based on data size and current network conditions

### Total Cost

```
Total Upload Cost = store route price + DVM provider fee
                  = chargeFor(routePrice('g.toon.store'), sealedBytes) + the bid covering Arweave storage
```

Both components grow with object size: the store route by the KiB of sealed payload, the Arweave fee by the binary size.

## Publishing Flow on TOON

All git-Arweave uploads go through `client.send()` from `@toon-protocol/client`. Raw WebSocket writes are rejected -- the store route requires ILP payment.

### Step-by-Step Flow

1. **Construct the git object** in binary format (see `git-objects` skill)
2. **Compute SHA-1** of the complete binary object
3. **Check Arweave for duplicates** via GraphQL query on `Git-SHA` tag (see nip-spec.md)
4. **Base64-encode** the binary object
5. **Construct the kind:5094 event** with required tags
6. **Sign the event** with the agent's Nostr private key
7. **Send it**: `await client.send('g.toon.store', { body: signedEvent })`. The client seals the payload to the terminating connector, reads the route's price, mints the covering claim and carries it -- there is no separate pricing, claim-signing or publish step.
8. **Subscribe to kind:6094** for the DVM result containing the Arweave transaction ID

### Error Handling

A REJECT comes back as `{ fulfilled: false }`; it is never thrown.

- **F03 (INVALID_AMOUNT):** the claim does not cover the charge -- underpayment. Let `send()` price the packet, or size the claim with `chargeFor(terms, sealedBytes)`; never from your own byte count.
- **T04:** over the peering's cap. The message states the cap; that is the only way a sender learns it.
- **F02 / T01:** nothing routes that name, or the peer was not there.
- **Store rejection:** malformed event (invalid signature, missing required tags). Fix and resend.
- **DVM failure (kind:7000 with error status):** The Arweave upload provider could not store the object. Check the error content for details (insufficient bid, upload failure, rate limit).
- **DVM timeout:** No kind:6094 or kind:7000 response within expected timeframe. The DVM provider may be offline. Try a different provider or retry.

## Free Dev Uploads (TurboFactory.unauthenticated)

> **WARNING: Dev-only path.** Direct TurboFactory uploads bypass the TOON relay and DVM provider entirely. Objects uploaded this way are **NOT discoverable** via TOON relay queries (no kind:5094 event exists on the relay), other TOON agents cannot find them via standard NIP-01 filters, and no DVM provider earns fees. Use the kind:5094 DVM path via `client.send()` for production — it ensures objects are discoverable, the upload is tracked on the relay, and the DVM provider handles Arweave storage reliably.

For development and testing only, `@ardrive/turbo-sdk` provides free uploads up to 100KB per object via `TurboFactory.unauthenticated()`. This uploads directly to Arweave, bypassing the TOON network.

### When to Use Free Dev Uploads

- **Development and testing** -- iterating on git object construction without paying the store route
- **Proof of concept** -- validating SHA-1 computation and Arweave resolution before committing to the DVM path

### Limitations

- **Not discoverable on TOON** -- no kind:5094 event on the relay means other agents cannot find these objects via relay queries
- **No DVM tracking** -- no kind:6094 result event, no kind:7000 feedback, no audit trail
- Maximum 100KB per upload (base64-encoded size, not binary size)
- Rate-limited by Turbo service
- No wallet or credits required
- **Not suitable for production** -- always use the kind:5094 DVM path for production workloads

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

| Path | Store Route Price | Arweave Cost | Total | Discoverability |
|------|------------------|-------------|-------|-----------------|
| DVM (kind:5094) | Yes, metered by KiB of sealed payload | Covered by bid | Route price + bid | Via TOON relay + Arweave |
| Direct (turbo-sdk) | None | Wallet/credits | Arweave only | Arweave only |

The DVM path is the standard TOON flow -- it creates a discoverable record on the TOON relay and handles Arweave upload via the provider. Direct uploads are cheaper but bypass the network.

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

**Why this matters on TOON:** Every duplicate upload wastes both the store route's price and the Arweave storage fee. SHA-1 content addressing means identical file contents across branches, commits, or repositories produce the same hash. A file that has not changed between commits does not need re-uploading.

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
- Large binary files dominate upload cost -- the store route adds 10 base units for every KiB of sealed payload, so a megabyte-scale asset is three orders of magnitude past the 1000-unit base

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

## Estimating a Repository Upload

A bulk upload has two shapes to it: a fixed 1000 base units for every kind:5094 object you send, plus 10 base units for every KiB of sealed payload across all of them. So a repository of many tiny objects is dominated by the per-object base, while a repository of a few large binaries is dominated by the KiB term.

You cannot turn that into a dollar figure from the working tree, because the metered length is the sealed payload rather than the files or the base64 in the `i` tag. To estimate before committing to a bulk upload, seal and price one representative object -- `routePrice('g.toon.store')` for the terms and `chargeFor(terms, sealedBytes)` for that object's charge -- then scale by the object count, and compare against the `bid` amounts the providers want for Arweave storage.

**Key insight:** the store route's price dominates total cost for most repositories; Arweave permanent storage is comparatively cheap.

## Permanent Storage Economics

Arweave provides permanent storage -- objects persist indefinitely with no ongoing fees. This fundamentally changes the economics compared to traditional hosting:

- **One-time cost:** Pay once for the upload; the object is available forever at `https://arweave.net/<tx-id>`
- **No renewal fees:** Unlike traditional storage, there is no monthly or annual cost
- **Immutable:** Once uploaded, the object cannot be modified or deleted -- only superseded by new versions
- **Content-addressed:** The SHA-1 hash in the `Git-SHA` tag provides a verifiable link between the git object graph and Arweave storage

This model favors well-considered, infrequent uploads. On TOON, the store route's metered price further incentivizes uploading only necessary, minimal objects -- aligning with git best practices of small, focused commits.

## Integration with Protocol Core

For the complete TOON write model, read model, and route-pricing details, refer to `skills/nostr-protocol-core/references/toon-protocol-context.md`. This file covers git-Arweave-specific upload economics; the protocol core covers the foundational mechanics shared by all event kinds.

For the kind:5094 event structure and tag format, see the `git-collaboration` skill's `kind-5094-blob-storage.md` reference.

For git object binary construction (blob, tree, commit format), see the `git-objects` skill.
