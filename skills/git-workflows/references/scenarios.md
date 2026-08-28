# Git Workflow Scenarios

> **Why this reference exists:** Agents need complete end-to-end workflow recipes for git operations on TOON. Each scenario shows every step from intent to verified result, including every `client.send()` call, what its route charges, git object construction, Arweave uploads, and verification. These workflows compose operations from `git-collaboration` (NIP-34 events), `git-objects` (binary format), and Arweave resolution into seamless recipes.

## Scenario 1: Create a Repository (End-to-End)

**When:** A maintainer wants to create a new repository on TOON with initial files stored permanently on Arweave.

**Why this matters:** Creating a repository is the most complex git workflow on TOON because it spans all three layers: announcing the repository (social), constructing git objects (data), uploading to Arweave (persistence), and publishing state (social). This scenario walks through every step and every `client.send()` call.

### Prerequisites

- A TOON client with an open channel:

  ```typescript
  const client = await ToonClient.create({
    connector: 'https://proxy.relay.devnet.toonprotocol.dev',
    mnemonic: process.env.TOON_MNEMONIC,
  });
  await client.channel.open({ deposit: 100_000n });
  ```

- A Nostr keypair for signing events
- Nothing else. `client.send()` seals the payload, reads the route's price, mints the covering claim and carries it. If you want a route's price up front, ask the node: `await client.routePrice('g.toon.relay')`, or read its free self-description at `GET /ilp`.

### Step 1: Announce the Repository (kind:30617)

Publish a repository announcement event to declare the project on the network.

```typescript
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools';

const sk = generateSecretKey();
const pk = getPublicKey(sk);
const repoId = 'my-project';

const repoAnnouncement = finalizeEvent({
  kind: 30617,
  created_at: Math.floor(Date.now() / 1000),
  content: 'A decentralized application framework',
  tags: [
    ['d', repoId],
    ['name', 'My Project'],
    ['description', 'A decentralized application framework'],
    ['clone', 'https://github.com/user/my-project.git'],
    ['web', 'https://github.com/user/my-project'],
    ['relays', 'wss://relay.toon.example'],
    ['maintainers', pk],
    ['t', 'typescript'],
    ['t', 'framework'],
  ],
}, sk);

await client.send({ body: repoAnnouncement });

// Record the repository address for future reference
const repoAddress = `30617:${pk}:${repoId}`;
```

**Price:** 1 base unit. The `g.toon.relay` route is flat, so the announcement's length does not matter.

### Step 2: Construct Git Objects

Build the git objects for the initial repository content. Assume a simple repo with one file: `README.md` containing `"# My Project\n"`.

```typescript
import { createHash } from 'crypto';

// Step 2a: Create the blob (file content)
const readmeContent = Buffer.from('# My Project\n');
const blobHeader = Buffer.from(`blob ${readmeContent.length}\0`);
const blobObject = Buffer.concat([blobHeader, readmeContent]);
const blobSha = createHash('sha1').update(blobObject).digest('hex');
// blobSha = 'c14e4e2...' (depends on exact content)

// Step 2b: Create the tree (directory listing)
const treeEntry = Buffer.concat([
  Buffer.from('100644 README.md\0'),
  Buffer.from(blobSha, 'hex'),  // 20-byte raw binary SHA-1
]);
const treeHeader = Buffer.from(`tree ${treeEntry.length}\0`);
const treeObject = Buffer.concat([treeHeader, treeEntry]);
const treeSha = createHash('sha1').update(treeObject).digest('hex');

// Step 2c: Create the commit
const timestamp = Math.floor(Date.now() / 1000);
const commitContent = [
  `tree ${treeSha}`,
  `author ${pk} <${pk}@nostr> ${timestamp} +0000`,
  `committer ${pk} <${pk}@nostr> ${timestamp} +0000`,
  '',
  'Initial commit',
  '',
].join('\n');
const commitContentBuf = Buffer.from(commitContent);
const commitHeader = Buffer.from(`commit ${commitContentBuf.length}\0`);
const commitObject = Buffer.concat([commitHeader, commitContentBuf]);
const commitSha = createHash('sha1').update(commitObject).digest('hex');
```

**Cost:** None (local computation only).

### Step 3: Upload Git Objects to Arweave (kind:5094)

Upload objects in dependency order: blob first, then tree, then commit. Each upload is a kind:5094 DVM request.

```typescript
// Step 3a: Check Arweave for duplicates (optional optimization)
// Query: { tags: [{ name: "Git-SHA", values: [blobSha] }, { name: "Repo", values: [repoId] }] }
// If found, skip upload for that object.

// Step 3b: Upload the blob
const blobEvent = finalizeEvent({
  kind: 5094,
  created_at: Math.floor(Date.now() / 1000),
  content: '',
  tags: [
    ['i', blobObject.toString('base64'), 'blob'],
    ['bid', '1000', 'usdc'],
    ['output', 'application/octet-stream'],
    ['Git-SHA', blobSha],
    ['Git-Type', 'blob'],
    ['Repo', repoId],
  ],
}, sk);

await client.send('g.toon.store', { body: blobEvent });

// Step 3c: Upload the tree
const treeEvent = finalizeEvent({
  kind: 5094,
  created_at: Math.floor(Date.now() / 1000),
  content: '',
  tags: [
    ['i', treeObject.toString('base64'), 'blob'],
    ['bid', '500', 'usdc'],
    ['output', 'application/octet-stream'],
    ['Git-SHA', treeSha],
    ['Git-Type', 'tree'],
    ['Repo', repoId],
  ],
}, sk);

await client.send('g.toon.store', { body: treeEvent });

// Step 3d: Upload the commit
const commitEvent = finalizeEvent({
  kind: 5094,
  created_at: Math.floor(Date.now() / 1000),
  content: '',
  tags: [
    ['i', commitObject.toString('base64'), 'blob'],
    ['bid', '500', 'usdc'],
    ['output', 'application/octet-stream'],
    ['Git-SHA', commitSha],
    ['Git-Type', 'commit'],
    ['Repo', repoId],
  ],
}, sk);

await client.send('g.toon.store', { body: commitEvent });
```

**Price per object:** the store route charges `1000 + 10 per KiB` of sealed payload, so a small README blob is around 1010 base units (~$0.00101) and a large binary costs proportionally more. The metered length is the sealed payload the PREPARE carries, not the JSON above, so let `client.send()` price it.

### Step 4: Publish Repository State (kind:30618)

After all objects are on Arweave, publish the branch heads so others can discover the current state.

```typescript
const repoState = finalizeEvent({
  kind: 30618,
  created_at: Math.floor(Date.now() / 1000),
  content: '',
  tags: [
    ['d', repoId],
    ['refs/heads/main', commitSha],
    ['HEAD', 'ref: refs/heads/main'],
  ],
}, sk);

await client.send({ body: repoState });
```

**Price:** 1 base unit, flat.

### Total Cost Summary

| Step | Event Kind | Route | Price |
|------|-----------|-------|-------|
| 1. Announce repo | kind:30617 | relay | 1 |
| 2. Construct objects | (local) | -- | 0 |
| 3a. Upload blob | kind:5094 | store | ~1010 |
| 3b. Upload tree | kind:5094 | store | ~1010 |
| 3c. Upload commit | kind:5094 | store | ~1010 |
| 4. Publish state | kind:30618 | relay | 1 |
| **Total** | **5 `client.send()` calls** | | **~3032 base units (~$0.003)** |

The object uploads are the whole bill; the two relay writes are a rounding error.

---

## Scenario 2: Submit a Patch (End-to-End)

**When:** A contributor wants to submit a code change to an existing repository.

**Why this matters:** Patches are the primary contribution mechanism. On TOON a patch is one relay write at a flat 1 base unit, however long the `git format-patch` output is. This scenario shows the complete flow from generating a diff to sending the paid event.

### Prerequisites

- The repository address (e.g., `30617:<maintainer-pubkey>:my-project`)
- A local clone of the repository with changes committed
- A TOON client connected to a relay

### Step 1: Generate the Patch

```bash
# Generate patch output for the latest commit
git format-patch -1 HEAD --stdout > my-patch.txt
```

This produces output like:

```
From abc123def456 Mon Sep 17 00:00:00 2001
From: Contributor <contributor@example.com>
Date: Thu, 27 Mar 2026 10:00:00 +0000
Subject: [PATCH] Fix null check in parser

Fixes a bug where empty input causes a TypeError.
---
 src/parser.ts | 3 ++-
 1 file changed, 2 insertions(+), 1 deletion(-)

diff --git a/src/parser.ts b/src/parser.ts
index abc1234..def5678 100644
--- a/src/parser.ts
+++ b/src/parser.ts
@@ -10,7 +10,8 @@
 export function parse(input: string) {
-  const tokens = input.split(' ');
+  if (!input) return [];
+  const tokens = input.split(' ');
   return tokens;
 }
--
2.42.0
```

### Step 2: Construct the kind:1617 Event

```typescript
import { readFileSync } from 'fs';

const patchContent = readFileSync('my-patch.txt', 'utf-8');
const maintainerPubkey = '<maintainer-pubkey-hex>';
const repoAddress = `30617:${maintainerPubkey}:my-project`;

// Get the commit hashes from git
// git rev-parse HEAD => commit hash
// git rev-parse HEAD^ => parent commit hash
const commitHash = '<commit-hash>';
const parentHash = '<parent-commit-hash>';

const patchEvent = finalizeEvent({
  kind: 1617,
  created_at: Math.floor(Date.now() / 1000),
  content: patchContent,
  tags: [
    ['a', repoAddress],
    ['r', parentHash],          // earliest unique commit (base)
    ['p', maintainerPubkey],     // notify maintainer
    ['t', 'root'],               // first (or only) patch in series
    ['commit', commitHash],
    ['parent-commit', parentHash],
    ['subject', 'Fix null check in parser'],
  ],
}, sk);
```

### Step 3: Send It

```typescript
const answer = await client.send({ body: patchEvent });
// answer.fulfilled === false on a REJECT -- a reject is returned, never thrown
```

The client seals the payload to the terminating connector, reads the route's price, mints the covering claim and carries it. There is no separate pricing, claim-signing or publish step.

### Step 4: Verify Publication

```typescript
// Subscribe to confirm the event was accepted (reading is free)
client.subscribe([
  { kinds: [1617], authors: [pk], '#a': [repoAddress], limit: 1 }
]);
```

### What It Costs

**1 base unit of 6-decimal USDC**, whatever the diff's size. A 500-byte one-line fix and a 50 KB refactor are priced identically, because the `g.toon.relay` route is flat.

This kills the old optimization. A kind:1618 PR is also 1 base unit, so it is no longer cheaper than a large patch -- choose between them on review workflow, not price.

### Patch Series (Multiple Patches)

For multi-commit contributions, submit a patch series with NIP-10 threading:

```typescript
// Patch 1: cover letter (root)
const coverLetter = finalizeEvent({
  kind: 1617,
  content: 'From abc123...\nSubject: [PATCH 0/3] Parser improvements\n\nThis series fixes...',
  tags: [
    ['a', repoAddress],
    ['r', baseCommitHash],
    ['p', maintainerPubkey],
    ['t', 'root'],
  ],
}, sk);
await client.send({ body: coverLetter });

// Patch 2: first change (reply to cover letter)
const patch2 = finalizeEvent({
  kind: 1617,
  content: 'From def456...\nSubject: [PATCH 1/3] Add null check\n...',
  tags: [
    ['a', repoAddress],
    ['e', coverLetter.id, '', 'reply'],
    ['p', maintainerPubkey],
    ['commit', commit1Hash],
    ['parent-commit', baseCommitHash],
  ],
}, sk);
await client.send({ body: patch2 });

// Patch 3: second change (reply to previous patch)
const patch3 = finalizeEvent({
  kind: 1617,
  content: 'From ghi789...\nSubject: [PATCH 2/3] Add input validation\n...',
  tags: [
    ['a', repoAddress],
    ['e', patch2.id, '', 'reply'],
    ['p', maintainerPubkey],
    ['commit', commit2Hash],
    ['parent-commit', commit1Hash],
  ],
}, sk);
await client.send({ body: patch3 });
```

Each patch in the series is its own relay write at 1 base unit, so a 3-patch series costs 3. Split for reviewability -- the price barely moves.

---

## Scenario 3: Merge a Patch (End-to-End)

**When:** A maintainer wants to apply a submitted patch, update the repository state, and upload the new git objects to Arweave.

**Why this matters:** Merging a patch requires coordinating across all three layers: applying the diff locally (data), uploading new objects to Arweave (persistence), publishing status and state events (social). The maintainer pays for the status event, the state update and every new Arweave upload -- and the uploads are almost the entire bill.

### Prerequisites

- The maintainer is listed in the kind:30617 `maintainers` tag
- The patch event ID and content are available
- A local clone of the repository

### Step 1: Apply the Patch Locally

```bash
# Extract the patch content from the kind:1617 event
# Apply it to the local repository
git am < patch-content.txt
# Or: git apply patch-content.txt && git commit

# Record the new commit hash
git rev-parse HEAD  # => new_commit_sha
```

### Step 2: Construct and Upload New Git Objects (kind:5094)

After applying the patch, new blob, tree, and commit objects exist locally. Upload only the NEW objects -- unchanged files share the same SHA-1 and already exist on Arweave.

```typescript
// Identify new objects since the previous commit
// git diff-tree -r HEAD^ HEAD => list of changed blobs
// git rev-parse HEAD^{tree} => new root tree SHA

// Upload new/changed blobs
for (const changedFile of changedFiles) {
  const fileContent = readFileSync(changedFile.path);
  const { object: blobObj, sha1: blobSha } = createGitBlob(fileContent);

  // Check Arweave for duplicate -- skip if already exists
  const exists = await checkArweaveForSha(blobSha, repoId);
  if (exists) continue;

  const blobUploadEvent = finalizeEvent({
    kind: 5094,
    content: '',
    tags: [
      ['i', blobObj.toString('base64'), 'blob'],
      ['bid', '1000', 'usdc'],
      ['output', 'application/octet-stream'],
      ['Git-SHA', blobSha],
      ['Git-Type', 'blob'],
      ['Repo', repoId],
    ],
  }, sk);
  await client.send('g.toon.store', { body: blobUploadEvent });
}

// Upload new tree(s) and commit (same pattern, Git-Type: 'tree' / 'commit')
// Upload order: blobs -> trees -> commit
```

**Price:** each object is a store-route write at `1000 + 10 per KiB` of sealed payload, so it is the object *count* that dominates for text files. A small change (1-5 new blobs, 1-3 new trees, 1 commit) is roughly 3000-9000 base units, about $0.003-$0.009. Skipping duplicates is the only real saving here.

### Step 3: Publish Status Event (kind:1631 -- Applied/Merged)

```typescript
const mergeStatus = finalizeEvent({
  kind: 1631,
  created_at: Math.floor(Date.now() / 1000),
  content: 'Merged -- clean fix, tests pass.',
  tags: [
    ['e', patchEventId],          // reference the patch being merged
    ['p', patchAuthorPubkey],      // notify the contributor
    ['a', repoAddress],            // repository context
    ['applied-as-commits', newCommitSha],  // credit the contributor
  ],
}, sk);

await client.send({ body: mergeStatus });
```

**Price:** 1 base unit. The `applied-as-commits` tags add no charge -- the relay route is flat.

### Step 4: Update Repository State (kind:30618)

```typescript
const updatedState = finalizeEvent({
  kind: 30618,
  created_at: Math.floor(Date.now() / 1000),
  content: '',
  tags: [
    ['d', repoId],
    ['refs/heads/main', newCommitSha],  // updated branch head
    ['HEAD', 'ref: refs/heads/main'],
  ],
}, sk);

await client.send({ body: updatedState });
```

**Price:** 1 base unit, flat.

### Total Cost Summary

| Step | Event Kind | Route | Price |
|------|-----------|-------|-------|
| 1. Apply patch | (local) | -- | 0 |
| 2. Upload new objects | kind:5094 (N events) | store | ~1010 each |
| 3. Publish merge status | kind:1631 | relay | 1 |
| 4. Update state | kind:30618 | relay | 1 |
| **Total** | **2 + N `client.send()` calls** | | **~1000N + 2 base units** |

---

## Scenario 4: Fetch a File from Arweave (End-to-End)

**When:** An agent wants to retrieve a specific file from a TOON-hosted repository stored on Arweave.

**Why this matters:** Fetching is entirely free on TOON. The agent reads the repository state (free), resolves the commit-to-tree-to-blob chain via Arweave GraphQL (free), and downloads from the Arweave gateway (free). This scenario shows the complete resolution chain from branch name to file content.

### Prerequisites

- The repository address (e.g., `30617:<maintainer-pubkey>:my-project`)
- A TOON client connected to a relay (for reading state)
- Access to Arweave GraphQL endpoint (`https://arweave.net/graphql`)

### Step 1: Read Repository State (kind:30618) -- FREE

```typescript
// Subscribe to get the latest state for the repository
client.subscribe([{
  kinds: [30618],
  authors: [maintainerPubkey],
  '#d': [repoId],
  limit: 1,
}]);

// The relay answers with plain NIP-01 JSON -- read the branch heads straight off the event
// Result: { 'refs/heads/main': '<commit-sha>', 'HEAD': 'ref: refs/heads/main' }
const mainCommitSha = stateEvent.tags
  .find(t => t[0] === 'refs/heads/main')?.[1];
```

### Step 2: Resolve Commit SHA via Arweave GraphQL -- FREE

```typescript
const ARWEAVE_GQL = 'https://arweave.net/graphql';

async function resolveGitSha(sha: string, repo: string): Promise<string | null> {
  const query = `
    query {
      transactions(
        tags: [
          { name: "Git-SHA", values: ["${sha}"] },
          { name: "Repo", values: ["${repo}"] }
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
  `;

  const response = await fetch(ARWEAVE_GQL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  const data = await response.json();
  const edges = data.data.transactions.edges;
  return edges.length > 0 ? edges[0].node.id : null;
}

// Resolve the commit
const commitTxId = await resolveGitSha(mainCommitSha, repoId);
```

### Step 3: Download and Parse the Commit Object -- FREE

```typescript
// Download from Arweave gateway
const commitBinary = await fetch(`https://arweave.net/${commitTxId}`)
  .then(r => r.arrayBuffer())
  .then(ab => Buffer.from(ab));

// Parse the commit object
// Format: "commit <size>\0<content>"
const nullIndex = commitBinary.indexOf(0);
const commitContent = commitBinary.slice(nullIndex + 1).toString('utf-8');

// Extract the root tree SHA from the commit content
const treeShaMatch = commitContent.match(/^tree ([a-f0-9]{40})$/m);
const rootTreeSha = treeShaMatch[1];
```

### Step 4: Resolve and Parse the Tree Object -- FREE

```typescript
const treeTxId = await resolveGitSha(rootTreeSha, repoId);
const treeBinary = await fetch(`https://arweave.net/${treeTxId}`)
  .then(r => r.arrayBuffer())
  .then(ab => Buffer.from(ab));

// Parse the tree object to find the target file
// Format: "tree <size>\0" followed by entries: "<mode> <name>\0<20-byte-sha>"
const treeNullIndex = treeBinary.indexOf(0);
const treeContent = treeBinary.slice(treeNullIndex + 1);

// Parse entries to find README.md
function parseTreeEntries(content: Buffer): Array<{ mode: string; name: string; sha: string }> {
  const entries = [];
  let offset = 0;
  while (offset < content.length) {
    const spaceIdx = content.indexOf(0x20, offset);    // space between mode and name
    const nullIdx = content.indexOf(0x00, spaceIdx);   // null after name
    const mode = content.slice(offset, spaceIdx).toString('utf-8');
    const name = content.slice(spaceIdx + 1, nullIdx).toString('utf-8');
    const sha = content.slice(nullIdx + 1, nullIdx + 21).toString('hex');
    entries.push({ mode, name, sha });
    offset = nullIdx + 21;
  }
  return entries;
}

const entries = parseTreeEntries(treeContent);
const readmeEntry = entries.find(e => e.name === 'README.md');
const readmeBlobSha = readmeEntry.sha;
```

### Step 5: Download the Blob (File Content) -- FREE

```typescript
const blobTxId = await resolveGitSha(readmeBlobSha, repoId);
const blobBinary = await fetch(`https://arweave.net/${blobTxId}`)
  .then(r => r.arrayBuffer())
  .then(ab => Buffer.from(ab));

// Parse the blob object
// Format: "blob <size>\0<content>"
const blobNullIndex = blobBinary.indexOf(0);
const fileContent = blobBinary.slice(blobNullIndex + 1).toString('utf-8');

console.log(fileContent);
// Output: "# My Project\n"
```

### Total Cost Summary

| Step | Operation | Cost |
|------|----------|------|
| 1. Read state | NIP-01 subscription (kind:30618) | FREE |
| 2. Resolve commit SHA | Arweave GraphQL query | FREE |
| 3. Download commit | Arweave gateway GET | FREE |
| 4. Resolve + download tree | Arweave GraphQL + gateway | FREE |
| 5. Resolve + download blob | Arweave GraphQL + gateway | FREE |
| **Total** | **0 `client.send()` calls** | **$0.00** |

### Navigating Subdirectories

For files in subdirectories, resolve the tree chain recursively:

```
root tree -> find "src" entry (mode 40000) -> resolve subtree SHA
  -> subtree -> find "parser.ts" entry (mode 100644) -> resolve blob SHA
    -> blob -> file content
```

Each level requires one Arweave GraphQL query + one gateway download. Deep directory structures require more round trips but remain free.

### Considerations

- Relay reads are free and speak plain NIP-01: a kind:30618 state event arrives as a standard JSON `EVENT` message, parsed like any Nostr event. TOON format is the encoding of a sealed *write* payload, not of a read response.
- Arweave GraphQL queries return the most recent transaction matching the tags. If multiple uploads exist for the same SHA, the content is identical (content-addressed).
- Gateway downloads may have latency for recently uploaded objects. Arweave has a confirmation period before data is permanently available.
- For bulk resolution (entire repository), batch multiple GraphQL queries to reduce round trips.
