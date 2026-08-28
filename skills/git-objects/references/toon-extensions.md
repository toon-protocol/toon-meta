# TOON Extensions for Git Objects

> **Why this reference exists:** Git objects on TOON are uploaded to Arweave via kind:5094 DVM requests. This file covers the TOON-specific considerations for git object construction and upload -- the relationship between binary object format and kind:5094 events, base64 encoding overhead, upload ordering constraints, deduplication via content-addressed SHA-1, and how the store route prices git object uploads.

## Relationship to kind:5094 Uploads

Git objects are not Nostr event kinds themselves. They are binary payloads uploaded to Arweave through the DVM pipeline using kind:5094 blob storage requests. The flow:

1. **Construct** the git object in binary format (blob, tree, or commit)
2. **Compute** its SHA-1 hash for content addressing
3. **Base64-encode** the binary object for the kind:5094 `i` tag payload
4. **Send** the kind:5094 request with `client.send()` from `@toon-protocol/client`

The kind:5094 event carries TOON-specific tags that link the Arweave upload to the git object graph:

| Tag | Purpose | Example |
|-----|---------|---------|
| `Git-SHA` | Content address of the git object | `95d09f2b10159347eece71399a7e2e907ea3df4f` |
| `Git-Type` | Object type | `blob`, `tree`, or `commit` |
| `Repo` | Repository identifier | `toon-sdk` |
| `Content-Type` | MIME type for Arweave | `application/octet-stream` |

See the `git-collaboration` skill for the complete kind:5094 event structure and tag format.

## Publishing Flow on TOON

All git object uploads go through `client.send()` from `@toon-protocol/client`. Raw WebSocket writes are rejected -- the route requires ILP payment. TOON format is the encoding of the sealed write payload the connector carries; it is not how a relay answers a read, which is plain NIP-01 JSON.

### Upload Flow

1. **Construct the git object binary** (see nip-spec.md and scenarios.md)
2. **Compute SHA-1** of the complete binary object
3. **Check Arweave for duplicates** -- query by `Git-SHA` tag to avoid paying for an object that already exists
4. **Base64-encode** the binary object
5. **Construct the kind:5094 event** with `i` tag containing the base64 payload, plus `Git-SHA`, `Git-Type`, and `Repo` tags
6. **Sign the event** with the agent's Nostr private key
7. **Send it:** `await client.send('g.toon.store', { body: signedEvent })`. The client seals the payload to the terminating connector, reads the route's price, mints the covering claim and carries it -- there is no separate pricing, claim-signing or publish step.

If you need the price before you send, `await client.routePrice('g.toon.store')` returns `{ price, pricePerKib? }` and `chargeFor(terms, sealedBytes)` from `@toon-protocol/client` turns that into a charge. The metered quantity is the **sealed** payload the PREPARE carries, not the event JSON you built, so you cannot compute the charge from your own event's length. A node's full self-description, including every route's price, is free at `GET /ilp`; an unpaid request to a priced route comes back as a greeting carrying that route's terms.

### Error Handling

- **F03 (INVALID_AMOUNT):** the claim does not cover the charge -- underpayment. Let `client.send()` price the packet rather than supplying an amount by hand.
- **T04:** over the peering's cap. The reject message states the cap, which is the only way a sender learns it.
- **F02:** nothing routes that name. **T01:** the peer was not there.
- **Route rejection:** Malformed event (invalid signature, missing tags). Fix and resend.
- **DVM failure (kind:7000 error):** The Arweave upload provider could not store the object. Check the error content for details.

A REJECT comes back as `{ fulfilled: false }` and is never thrown.

## Base64 Encoding Overhead

Git objects are binary data, but the kind:5094 `i` tag carries them as base64-encoded strings. Base64 encoding increases data size by approximately 33%:

| Binary Size | Base64 Size | Overhead |
|------------|------------|----------|
| 100 bytes | ~136 bytes | +36 bytes |
| 1 KB | ~1.37 KB | +370 bytes |
| 10 KB | ~13.7 KB | +3.7 KB |
| 100 KB | ~137 KB | +37 KB |
| 1 MB | ~1.37 MB | +370 KB |

This overhead directly increases the sealed payload the PREPARE carries, and the store route's price rises with each kibibyte of it. The base64 payload dominates the event size for all but the smallest objects.

## How the Store Route Prices Git Object Uploads

A kind:5094 upload terminates at the store route (`g.toon.store` / `g.toon.relay.store`). Probed 2026-08-28 its price is **1000 + 10 per KiB** of sealed payload, in base units of 6-decimal USDC (`1_000_000` = $1). A small object is therefore around 1010 base units, roughly $0.00101.

Two things follow. First, the price is a schedule over payload length in kibibytes, so a bigger object really does cost more -- unlike a Nostr event on the relay, which is flat-priced. Second, the length that counts is the **sealed** payload, so the arithmetic is not yours to do: ask with `routePrice()` / `chargeFor()`, or just let `client.send()` price the packet.

The Arweave storage itself is the DVM provider's charge, quoted in the provider's own job feedback. The prepaid model means the job request payment covers both the route's price and the provider's compute/storage.

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

If the query returns results, the object already exists on Arweave. Skip the upload and save the whole store-route charge. This is especially valuable for blobs -- identical file contents across repositories or branches share the same SHA-1.

## Economic Dynamics of Git Object Storage on TOON

### The Store Route's Slope Rewards Small Commits

The store route's price rises with each kibibyte of sealed payload, so object size is a real cost:

- **Minimal diffs** -- change only what needs changing. A large refactoring commit produces more and bigger blobs.
- **Compact file formats** -- prefer text over binary when practical. Binary blobs (images, compiled assets) are expensive.
- **Deduplication awareness** -- unchanged files between commits produce the same blob SHA-1 and do not need re-uploading.

The kind:1617, kind:30617 and kind:30618 events that reference these objects go to the relay instead, where the price is flat at 1 base unit and size makes no difference at all.

### Permanent Storage vs Temporary Cost

Arweave provides permanent storage. The upload cost is one-time -- once an object is on Arweave, it persists indefinitely with no ongoing charge. The store route's price is charged once too, when the kind:5094 request is sent. This model favors infrequent, well-considered uploads over rapid iteration.

### Price Comparison: Git Object Types

Commits and trees are small, so they sit near the store route's flat component (~1000 base units each). Blobs vary enormously with file size, and only they climb the per-kibibyte slope. A repository of many small text files is far cheaper to upload than one carrying large binary assets, and the Arweave provider's own charge scales the same way.

For a real figure, read the price off the route -- `await client.routePrice('g.toon.store')` -- rather than extrapolating from an object count.

## Integration with Protocol Core

For the complete TOON write model, read model, and route pricing details, refer to `skills/nostr-protocol-core/references/toon-protocol-context.md`. This file covers git-object-specific upload economics; the protocol core covers the foundational mechanics shared by all event kinds.
