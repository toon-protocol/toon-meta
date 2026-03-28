# Git-Arweave Integration Specification

> **Why this reference exists:** This skill bridges `git-objects` (binary format) and `git-collaboration` (kind:5094 DVM requests) by focusing on the Arweave-specific integration layer. Agents need to understand how git objects are mapped to Arweave transactions, how to resolve SHA-1 hashes to transaction IDs, how manifest transactions provide repository-level entry points, and how to navigate the git DAG stored on Arweave. This file covers the Arweave tag schema, GraphQL query patterns, resolution flows, and upload methods.

## Arweave Tag Schema for Git Objects

Every git object uploaded to Arweave is tagged with metadata that enables discovery and resolution. These tags are set by the DVM provider when uploading the object to Arweave (not by the kind:5094 event directly, though the kind:5094 event carries the same tag names for the DVM provider to use).

### Required Arweave Tags

| Tag Name | Value | Purpose |
|----------|-------|---------|
| `Git-SHA` | 40-character hex SHA-1 hash | Content address of the git object. Primary resolution key. |
| `Git-Type` | `blob`, `tree`, or `commit` | Git object type. Enables type-filtered queries. |
| `Repo` | Repository identifier string | Links the object to a specific repository. Matches the `d` tag of kind:30617. |
| `Content-Type` | `application/octet-stream` | MIME type for the binary git object data. |

### Optional Arweave Tags

| Tag Name | Value | Purpose |
|----------|-------|---------|
| `App-Name` | `TOON-Git` | Application identifier for Arweave ecosystem discovery. |
| `App-Version` | Version string (e.g., `1.0.0`) | Protocol version for forward compatibility. |
| `Branch` | Branch name (e.g., `main`) | Associates the object with a specific branch (typically on commits). |
| `Manifest-For` | Repository identifier | Present on manifest transactions to identify the repository. |

## SHA Resolution via Arweave GraphQL

### Basic SHA Resolution

Given a git SHA-1 hash, resolve it to an Arweave transaction ID:

```graphql
query ResolveSHA($sha: String!) {
  transactions(
    tags: [
      { name: "Git-SHA", values: [$sha] }
    ]
    first: 1
  ) {
    edges {
      node {
        id
        tags {
          name
          value
        }
      }
    }
  }
}
```

**Variables:**
```json
{ "sha": "95d09f2b10159347eece71399a7e2e907ea3df4f" }
```

**Result:** The `node.id` field is the Arweave transaction ID. Access the object at `https://arweave.net/<node.id>`.

### SHA Resolution with Repository Filter

When the same content exists across multiple repositories (common for blobs), filter by repository:

```graphql
query ResolveSHAInRepo($sha: String!, $repo: String!) {
  transactions(
    tags: [
      { name: "Git-SHA", values: [$sha] },
      { name: "Repo", values: [$repo] }
    ]
    first: 1
  ) {
    edges {
      node {
        id
      }
    }
  }
}
```

### Type-Filtered Queries

Find all objects of a specific type for a repository:

```graphql
query RepoBlobs($repo: String!) {
  transactions(
    tags: [
      { name: "Repo", values: [$repo] },
      { name: "Git-Type", values: ["blob"] }
    ]
    first: 100
  ) {
    edges {
      node {
        id
        tags {
          name
          value
        }
      }
    }
  }
}
```

### Paginated Queries

For repositories with many objects, use cursor-based pagination:

```graphql
query RepoBlobsPaginated($repo: String!, $cursor: String) {
  transactions(
    tags: [
      { name: "Repo", values: [$repo] },
      { name: "Git-Type", values: ["blob"] }
    ]
    first: 100
    after: $cursor
  ) {
    pageInfo {
      hasNextPage
    }
    edges {
      cursor
      node {
        id
        tags {
          name
          value
        }
      }
    }
  }
}
```

### Deduplication Check

Before uploading a git object, check if it already exists on Arweave:

```graphql
query CheckDuplicate($sha: String!, $repo: String!) {
  transactions(
    tags: [
      { name: "Git-SHA", values: [$sha] },
      { name: "Repo", values: [$repo] }
    ]
    first: 1
  ) {
    edges {
      node {
        id
      }
    }
  }
}
```

If `edges` is non-empty, the object already exists. Skip the upload to save the kind:5094 event cost.

## Arweave GraphQL Endpoint

The standard Arweave GraphQL endpoint is:

```
https://arweave.net/graphql
```

Alternative gateways:
- `https://ar-io.net/graphql`
- `https://g8way.io/graphql`

All gateways serve the same data from the Arweave blockweave.

## Gateway URLs

Once you have an Arweave transaction ID, access the raw data at:

```
https://arweave.net/<transaction-id>
```

The response is the raw binary git object data (the same bytes that were base64-encoded in the kind:5094 `i` tag).

## Manifest Transactions

A manifest transaction is a special Arweave transaction that links multiple objects under a single entry point. For git repositories, a manifest provides a repository-level index of all uploaded objects.

### Manifest Structure

```json
{
  "manifest": "arweave/paths",
  "version": "0.2.0",
  "index": {
    "path": "HEAD"
  },
  "paths": {
    "objects/95/d09f2b10159347eece71399a7e2e907ea3df4f": {
      "id": "<arweave-tx-id-for-blob>"
    },
    "objects/4b/825dc642cb6eb9a060e54bf8d69288fbee4904": {
      "id": "<arweave-tx-id-for-tree>"
    },
    "objects/ab/cdef1234567890abcdef1234567890abcdef12": {
      "id": "<arweave-tx-id-for-commit>"
    },
    "HEAD": {
      "id": "<arweave-tx-id-for-head-commit>"
    },
    "refs/heads/main": {
      "id": "<arweave-tx-id-for-main-branch-commit>"
    }
  }
}
```

### Manifest Tags

| Tag Name | Value | Purpose |
|----------|-------|---------|
| `Manifest-For` | Repository identifier | Links the manifest to a repository |
| `Repo` | Repository identifier | Same as individual objects, for query consistency |
| `App-Name` | `TOON-Git` | Application identifier |
| `Type` | `manifest` | Distinguishes manifest from object transactions |

### Manifest Resolution

Find the manifest for a repository:

```graphql
query RepoManifest($repo: String!) {
  transactions(
    tags: [
      { name: "Manifest-For", values: [$repo] },
      { name: "Type", values: ["manifest"] }
    ]
    sort: HEIGHT_DESC
    first: 1
  ) {
    edges {
      node {
        id
      }
    }
  }
}
```

The most recent manifest (sorted by block height descending) is the current repository state. Access individual objects via the manifest path:

```
https://arweave.net/<manifest-tx-id>/objects/95/d09f2b10159347eece71399a7e2e907ea3df4f
```

### Manifest Benefits

- **Single query** to discover the entire repository instead of N individual SHA queries
- **Path-based access** using standard git object path conventions (`objects/<first-2-chars>/<remaining-38-chars>`)
- **Branch references** accessible via `refs/heads/<branch-name>`
- **HEAD pointer** for the default branch

## Upload Flow Detail

### Step 1: Construct and Hash the Git Object

Use the `git-objects` skill to construct the binary object and compute its SHA-1. The object types are:

- **Blob:** `blob <size>\0<content>` -- raw file content
- **Tree:** `tree <size>\0<entries>` -- directory listing with mode, name, raw 20-byte SHA-1 per entry
- **Commit:** `commit <size>\0<headers>\n\n<message>` -- tree ref, parents, author, committer, message

### Step 2: Check Arweave for Duplicates

Query Arweave GraphQL with the `Git-SHA` tag. If the object exists, skip the upload.

### Step 3: Base64-Encode

Convert the binary git object to base64 for the kind:5094 `i` tag:

```typescript
const base64Payload = gitObjectBuffer.toString('base64');
```

Base64 increases size by ~33%. This overhead directly affects the kind:5094 event size and TOON relay write fee.

### Step 4: Construct the kind:5094 Event

See the `git-collaboration` skill for the complete kind:5094 event structure. Key tags:

```typescript
const event = {
  kind: 5094,
  content: '',
  tags: [
    ['i', base64Payload, 'blob'],
    ['bid', '1000', 'usdc'],
    ['output', 'application/octet-stream'],
    ['Git-SHA', sha1Hex],
    ['Git-Type', objectType], // 'blob', 'tree', or 'commit'
    ['Repo', repoIdentifier]
  ]
};
```

### Step 5: Publish via TOON

Publish the kind:5094 event via `publishEvent()` from `@toon-protocol/client`. The relay charges `basePricePerByte * serializedEventBytes`.

### Step 6: Receive DVM Result

The DVM provider processes the job and returns a kind:6094 result event containing the Arweave transaction ID. Subscribe to kind:6094 events referencing the original kind:5094 event ID to receive the result.

### Step 7: Verify and Access

Verify the upload by accessing `https://arweave.net/<tx-id>` and confirming the data matches the original git object.

## DAG Navigation Pattern

### Full DAG Traversal: Branch Head to File Content

1. **Get branch head from kind:30618 (repo state):**
   Subscribe to kind:30618 for the repository. The event contains `refs/heads/<branch>` tags with commit SHA-1 values.

2. **Resolve commit SHA to Arweave transaction:**
   ```graphql
   query { transactions(tags: [{ name: "Git-SHA", values: ["<commit-sha>"] }]) { edges { node { id } } } }
   ```

3. **Fetch and parse the commit object:**
   Download from `https://arweave.net/<commit-tx-id>`. Parse the commit to extract:
   - `tree <tree-sha>` -- the root tree of this commit
   - `parent <parent-sha>` -- parent commit(s) for history traversal

4. **Resolve tree SHA to Arweave transaction:**
   Same GraphQL query pattern with the tree SHA.

5. **Fetch and parse the tree object:**
   Download and parse the tree entries. Each entry contains:
   - Mode (file type/permissions)
   - Name (filename)
   - 20-byte raw SHA-1 (reference to blob or subtree)

6. **Resolve blob or subtree SHA:**
   Convert the raw 20-byte SHA-1 to hex and query Arweave. For blobs, download the content. For subtrees, recurse.

### Shortcut: Manifest-Based Navigation

If a manifest transaction exists for the repository, skip individual GraphQL queries:

```
https://arweave.net/<manifest-tx-id>/objects/<sha-prefix>/<sha-remainder>
```

This resolves any object in a single HTTP request via the manifest's path routing.

## Upload Methods

### Free Dev Uploads (up to 100KB)

For development and testing, use unauthenticated Turbo uploads:

```typescript
import { TurboFactory } from '@ardrive/turbo-sdk';

const turbo = TurboFactory.unauthenticated();
const uploadResult = await turbo.uploadFile({
  fileStreamFactory: () => Readable.from(gitObjectBuffer),
  fileSizeFactory: () => gitObjectBuffer.length,
  dataItemOpts: {
    tags: [
      { name: 'Git-SHA', value: sha1Hex },
      { name: 'Git-Type', value: objectType },
      { name: 'Repo', value: repoIdentifier },
      { name: 'Content-Type', value: 'application/octet-stream' },
      { name: 'App-Name', value: 'TOON-Git' }
    ]
  }
});
// uploadResult.id is the Arweave transaction ID
```

**Limitations:**
- Maximum 100KB per upload
- No wallet required
- Suitable for small files and testing only
- Rate-limited

### Authenticated Uploads (Production)

For production workloads or files exceeding 100KB:

```typescript
import { TurboFactory } from '@ardrive/turbo-sdk';
import Arweave from 'arweave';

// From JWK wallet file
const jwk = JSON.parse(fs.readFileSync('wallet.json', 'utf-8'));
const turbo = TurboFactory.authenticated({ privateKey: jwk });

// Or purchase Turbo credits
const { winc } = await turbo.getBalance();

const uploadResult = await turbo.uploadFile({
  fileStreamFactory: () => Readable.from(gitObjectBuffer),
  fileSizeFactory: () => gitObjectBuffer.length,
  dataItemOpts: {
    tags: [
      { name: 'Git-SHA', value: sha1Hex },
      { name: 'Git-Type', value: objectType },
      { name: 'Repo', value: repoIdentifier },
      { name: 'Content-Type', value: 'application/octet-stream' },
      { name: 'App-Name', value: 'TOON-Git' }
    ]
  }
});
```

**Requirements:**
- Arweave JWK wallet or Turbo credits
- No size limit (practical limit ~2GB per transaction)
- Production-grade reliability
- Arweave storage cost applies (paid via wallet balance or Turbo credits)

### DVM Provider Path (Standard TOON Flow)

The standard TOON flow does not require the uploader to have an Arweave wallet. The DVM provider handles the Arweave upload:

1. Client publishes kind:5094 event (pays TOON relay fee)
2. DVM provider receives the job
3. DVM provider uploads to Arweave using their own wallet/credits
4. DVM provider returns the Arweave transaction ID in kind:6094

The DVM provider's Arweave cost is covered by the `bid` tag amount in the kind:5094 event.
