---
name: git-arweave
description: Git-Arweave integration on TOON Protocol. Covers upload flow ("how do I
  upload git objects to Arweave?", "git Arweave integration", construct git object,
  base64 encode, kind:5094 DVM request, Git-SHA Git-Type Repo tags, publishEvent,
  DVM provider uploads to Arweave), SHA resolution ("how do I resolve a git SHA on
  Arweave?", "SHA resolution", Arweave GraphQL queries by Git-SHA tag, transaction
  ID, gateway URL), manifest transactions ("how do repository manifests work?",
  repository-level manifests linking all objects, manifest transaction), DAG navigation
  ("how do I navigate a git DAG on Arweave?", "DAG navigation", kind:30618 repo state,
  commit SHA, tree SHA, blob SHA, resolve each via Arweave), gateway URLs
  ("https://arweave.net/<tx-id>", Arweave gateway), free dev uploads (TurboFactory
  unauthenticated, 100KB limit), and authenticated uploads (@ardrive/turbo-sdk).
  Reference skill bridging git-objects (binary format) and git-collaboration
  (kind:5094 uploads).
---

# Git-Arweave Integration (TOON)

Reference skill for how git objects map to Arweave transactions and how to navigate the DAG on Arweave. This skill bridges `git-objects` (binary format construction) and `git-collaboration` (kind:5094 DVM upload mechanics), focusing on the Arweave-specific layer: upload flows, SHA-to-transaction resolution, manifest transactions, DAG navigation, and gateway access patterns.

On TOON, uploading git objects to Arweave involves two cost components: the TOON relay write fee for the kind:5094 event (per-byte ILP payment) and the Arweave permanent storage cost handled by the DVM provider. Understanding the integration layer helps agents optimize uploads, resolve objects efficiently, and navigate repository DAGs stored on Arweave.

## Upload Flow Overview

The upload flow connects git object construction to Arweave permanent storage:

1. **Construct** the git object in binary format (blob, tree, or commit) -- see `git-objects` skill
2. **Compute** its SHA-1 hash for content addressing -- see `git-objects` skill
3. **Check Arweave** for duplicates via GraphQL query on `Git-SHA` tag -- saves money if already uploaded
4. **Base64-encode** the binary object for the kind:5094 `i` tag payload (~33% size increase)
5. **Construct** the kind:5094 DVM request event with `Git-SHA`, `Git-Type`, and `Repo` tags -- see `git-collaboration` skill
6. **Publish** the kind:5094 event via `publishEvent()` from `@toon-protocol/client` (ILP payment)
7. **DVM provider** receives the job, uploads the object to Arweave, returns the Arweave transaction ID in a kind:6094 result
8. **Resolve** the object at `https://arweave.net/<tx-id>`

Upload order matters: blobs first, then trees, then commits. This ensures all referenced objects exist on Arweave before the referencing object.

## SHA Resolution

Every git object on Arweave is tagged with its `Git-SHA`, enabling resolution from SHA-1 hash to Arweave transaction ID:

```graphql
query {
  transactions(
    tags: [
      { name: "Git-SHA", values: ["95d09f2b10159347eece71399a7e2e907ea3df4f"] }
    ]
  ) {
    edges { node { id } }
  }
}
```

Once you have the transaction ID, access the object at `https://arweave.net/<tx-id>`.

## DAG Navigation

A git repository on Arweave is a graph of objects navigated via SHA references:

1. **Start** at kind:30618 (repo state) -- lists branch heads as commit SHA-1s
2. **Resolve** the commit SHA via Arweave GraphQL `Git-SHA` query -- get the commit object
3. **Parse** the commit to extract the `tree` SHA and `parent` SHA(s)
4. **Resolve** the tree SHA -- get the tree object listing directory entries
5. **Parse** tree entries to extract blob SHA-1s and subtree SHA-1s
6. **Resolve** each blob or subtree recursively

Each resolution step is an Arweave GraphQL query by `Git-SHA` tag followed by a gateway fetch.

## Arweave Upload Methods

- **kind:5094 DVM path (recommended)**: Publish a kind:5094 event via `publishEvent()` -- the DVM provider handles the Arweave upload. Objects are discoverable on the TOON relay, tracked via kind:6094 results, and other agents can find them via standard NIP-01 filters. **Always use this for production.**
- **Free dev uploads** (dev-only, up to 100KB): `TurboFactory.unauthenticated()` from `@ardrive/turbo-sdk` -- bypasses TOON relay entirely. Objects are NOT discoverable by other agents on the network. Use only for testing SHA-1 computation and Arweave resolution.

## Social Context

Git-Arweave integration is an infrastructure concern that affects the economics of decentralized git collaboration. On TOON:

- **Deduplication is economically important.** Always check Arweave for existing objects before uploading. Identical file contents across branches or repositories share the same SHA-1, so duplicate uploads waste money.
- **Upload ordering affects resolution reliability.** If a tree references a blob that has not yet been uploaded, the DAG cannot be fully traversed. Upload bottom-up: blobs, trees, commits.
- **Manifest transactions reduce resolution cost.** Instead of N individual GraphQL queries to resolve a repository, a manifest transaction provides a single entry point linking all objects.
- **Permanent storage means one-time cost.** Unlike traditional hosting, Arweave storage persists indefinitely. The upload cost (TOON relay fee + Arweave storage) is a one-time investment.

## When to Read Each Reference

Read the appropriate reference file based on the situation:

- **Upload flow details, Arweave tag schema, GraphQL queries, and resolution patterns** -- Read [nip-spec.md](references/nip-spec.md) for the complete Arweave integration specification.
- **Step-by-step scenarios for upload, resolution, DAG navigation, and bulk upload** -- Read [scenarios.md](references/scenarios.md) for worked examples with code.
- **TOON fee structure, free dev uploads, and dual-cost model** -- Read [toon-extensions.md](references/toon-extensions.md) for TOON-specific economics and cost optimization.

### Cross-Skill References

- **Git object binary format (blob, tree, commit construction)** -- See `git-objects` for how to construct the binary objects that get uploaded.
- **kind:5094 DVM request event format** -- See `git-collaboration` for the complete kind:5094 event structure, required tags, and chunked upload support.
- **NIP-73 external content IDs (arweave:tx: references)** -- See `media-and-files` for referencing Arweave content in Nostr events.
- **TOON write model, read model, and fee calculation details** -- Read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md` (canonical protocol reference, D9-010).
- **DVM protocol mechanics (job requests, results, feedback)** -- See `dvm-protocol` for the NIP-90 DVM lifecycle that kind:5094 participates in.
