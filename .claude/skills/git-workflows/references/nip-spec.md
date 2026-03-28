# Git Workflow Integration Reference

> **Why this reference exists:** Git on TOON spans three distinct systems -- NIP-34 collaboration events (social layer), git object binary format (data layer), and Arweave permanent storage (persistence layer). This file explains how these three systems compose into a complete decentralized git hosting stack, with the event flow and data dependencies that connect them.

## Three-Layer Architecture

### Layer 1: NIP-34 Collaboration Events (Social Layer)

NIP-34 defines the social and coordination events for decentralized git. These are Nostr events published to TOON relays via `publishEvent()`.

| Kind | Purpose | Event Type |
|------|---------|------------|
| 30617 | Repository announcement | Parameterized replaceable |
| 30618 | Repository state (branch heads, tags) | Parameterized replaceable |
| 1617 | Patch (git format-patch output) | Regular |
| 1618 | Pull request | Regular |
| 1619 | PR update (branch tip change) | Regular |
| 1621 | Issue | Regular |
| 1622 | Comment | Regular |
| 1630 | Status: Open | Regular |
| 1631 | Status: Applied/Merged | Regular |
| 1632 | Status: Closed | Regular |
| 1633 | Status: Draft | Regular |

For detailed tag formats and validation rules per kind, see the `git-collaboration` skill.

### Layer 2: Git Object Binary Format (Data Layer)

Git objects are the actual repository content -- file data (blobs), directory structure (trees), and history (commits). They are not Nostr events; they are binary payloads constructed according to git's content-addressed format.

| Object Type | Contains | References |
|-------------|----------|------------|
| Blob | Raw file content | Nothing (leaf node) |
| Tree | Directory entries (mode, name, SHA-1) | Blobs and subtrees |
| Commit | Tree SHA-1, parent SHA-1s, author, message | One tree, zero or more parent commits |

Every object is addressed by the SHA-1 hash of its complete binary representation (`<type> <size>\0<content>`).

For binary construction rules and TypeScript examples, see the `git-objects` skill.

### Layer 3: Arweave Permanent Storage (Persistence Layer)

Arweave provides permanent, content-addressed storage for git objects. Objects are uploaded via kind:5094 DVM requests (NIP-90), which carry the base64-encoded binary object.

| Component | Purpose |
|-----------|---------|
| kind:5094 event | DVM job request carrying base64-encoded git object |
| `Git-SHA` tag | Content address for resolution |
| `Git-Type` tag | Object type (blob, tree, commit) |
| `Repo` tag | Repository identifier |
| Arweave GraphQL | Query by tags to resolve SHA to transaction ID |
| Gateway URL | `https://arweave.net/<tx-id>` for direct download |

## How the Three Layers Connect

### Create Repository Flow

```
1. kind:30617 (announce repo)     ─── Layer 1: Social
2. Construct blob/tree/commit     ─── Layer 2: Data
3. kind:5094 (upload to Arweave)  ─── Layer 3: Persistence (via Layer 1 event)
4. kind:30618 (publish state)     ─── Layer 1: Social
```

The repository announcement (Step 1) establishes the social identity. Git objects (Step 2) are the actual data. kind:5094 events (Step 3) bridge Layer 1 and Layer 3 -- they are Nostr events carrying git object payloads to Arweave. The state event (Step 4) maps branch names to commit SHA-1s, connecting the social layer to the data layer.

### Submit Patch Flow

```
1. git format-patch               ─── Layer 2: Data (diff generation)
2. kind:1617 (publish patch)      ─── Layer 1: Social (carries diff in content)
```

Patches embed git data directly in the Nostr event content. No Arweave upload is needed -- the diff is small enough to live in the event itself. This is why patches cost per-byte on TOON: the diff is the payload.

### Merge Patch Flow

```
1. Apply patch locally            ─── Layer 2: Data (local git operations)
2. Construct new commit/tree      ─── Layer 2: Data
3. kind:5094 (upload new objects) ─── Layer 3: Persistence
4. kind:1631 (status: merged)    ─── Layer 1: Social
5. kind:30618 (update state)     ─── Layer 1: Social
```

Merging spans all three layers. The maintainer applies the patch locally (Layer 2), uploads new objects to Arweave (Layer 3), then publishes status and state events (Layer 1).

### Fetch File Flow

```
1. kind:30618 (read state)       ─── Layer 1: Social (get commit SHA)
2. Arweave GraphQL (resolve SHA) ─── Layer 3: Persistence (get tx-id)
3. Gateway download              ─── Layer 3: Persistence (get binary)
4. Parse git object              ─── Layer 2: Data (decode blob/tree/commit)
```

Fetching reads across layers in reverse: social layer provides the entry point (branch head SHA), persistence layer provides the data, and the data layer format provides the decoding rules.

## Data Dependencies and Upload Ordering

Git objects form a directed acyclic graph (DAG). When uploading to Arweave, dependencies must be uploaded first:

```
blob (file content)
  ^
  |  referenced by SHA-1
tree (directory listing)
  ^
  |  referenced by SHA-1
commit (snapshot + history)
  ^
  |  referenced by SHA-1
kind:30618 state (branch heads)
```

Upload order: blobs first, then trees (bottom-up from leaf directories), then commits, then publish state. Violating this order means a tree or commit references objects that do not yet exist on Arweave.

## Event Kind Cross-References

| Workflow Step | Event Kind | Skill Reference |
|--------------|------------|-----------------|
| Announce repo | kind:30617 | `git-collaboration` |
| Publish state | kind:30618 | `git-collaboration` |
| Submit patch | kind:1617 | `git-collaboration` |
| Upload object | kind:5094 | `git-collaboration`, `git-objects` |
| Set status | kind:1630-1633 | `git-collaboration` |
| Discover pricing | kind:10032 | `relay-discovery` |
| DVM provider | kind:10035 | `dvm-protocol` |

## Arweave Resolution Protocol

To resolve a git SHA to its Arweave content:

### GraphQL Query

```graphql
query {
  transactions(
    tags: [
      { name: "Git-SHA", values: ["<sha1-hex>"] },
      { name: "Repo", values: ["<repo-identifier>"] }
    ]
  ) {
    edges {
      node {
        id
        tags { name value }
      }
    }
  }
}
```

### Gateway Download

```
https://arweave.net/<transaction-id>
```

The downloaded content is the raw git object binary. Parse it by reading the type header, null byte, and content according to the git object format.

### Deduplication

SHA-1 content addressing enables deduplication. Before uploading any object via kind:5094, query Arweave by `Git-SHA` tag. If the object already exists, skip the upload to save the kind:5094 relay write fee.
