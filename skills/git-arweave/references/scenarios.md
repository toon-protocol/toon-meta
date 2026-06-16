# Git-Arweave Integration Scenarios

> **Why this reference exists:** Agents need step-by-step workflows for uploading git objects to Arweave, resolving SHA-1 hashes to Arweave transaction IDs, navigating the git DAG stored on Arweave, and performing bulk repository uploads. Each scenario shows the complete flow with code examples, including TOON fee calculations and deduplication checks. These scenarios bridge the gap between knowing the Arweave integration specification (nip-spec.md) and understanding the TOON economics (toon-extensions.md).

## Scenario 1: Upload a Blob to Arweave

**When:** An agent has constructed a git blob (see `git-objects` skill) and needs to store it permanently on Arweave via TOON.

**Why this matters:** Blobs are the most common git object type. Every file in a repository is a blob. Uploading a blob is the foundational operation -- trees and commits reference blobs, so blobs must be uploaded first.

### Steps

1. **Construct the git blob and compute its SHA-1.** For a file containing `"hello world\n"`:

   ```typescript
   import { createHash } from 'crypto';

   const content = Buffer.from('hello world\n');
   const header = Buffer.from(`blob ${content.length}\0`);
   const gitObject = Buffer.concat([header, content]);
   const sha1 = createHash('sha1').update(gitObject).digest('hex');
   // sha1 = '95d09f2b10159347eece71399a7e2e907ea3df4f'
   ```

2. **Check Arweave for duplicates.** Query the Arweave GraphQL endpoint to see if this SHA already exists:

   ```typescript
   const query = `
     query {
       transactions(
         tags: [
           { name: "Git-SHA", values: ["${sha1}"] },
           { name: "Repo", values: ["my-repo"] }
         ]
         first: 1
       ) {
         edges { node { id } }
       }
     }
   `;

   const response = await fetch('https://arweave.net/graphql', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ query })
   });

   const result = await response.json();
   if (result.data.transactions.edges.length > 0) {
     const existingTxId = result.data.transactions.edges[0].node.id;
     console.log(`Blob already exists at https://arweave.net/${existingTxId}`);
     return; // Skip upload -- save money
   }
   ```

3. **Base64-encode the git object.** The kind:5094 `i` tag carries base64-encoded data:

   ```typescript
   const base64Payload = gitObject.toString('base64');
   // ~33% size increase: 20 bytes -> ~28 base64 characters
   ```

4. **Construct the kind:5094 event.**

   ```typescript
   const event = {
     kind: 5094,
     content: '',
     tags: [
       ['i', base64Payload, 'blob'],
       ['bid', '1000', 'usdc'],
       ['output', 'application/octet-stream'],
       ['Git-SHA', sha1],
       ['Git-Type', 'blob'],
       ['Repo', 'my-repo']
     ]
   };
   ```

5. **Sign and publish via TOON.**

   ```typescript
   const signedEvent = await signEvent(event, privateKey);
   // Fee = basePricePerByte * serializedEventBytes
   // For this small blob: ~350 bytes * 10n = ~$0.004
   await client.publishEvent(signedEvent, { destination, claim });
   ```

6. **Subscribe to the DVM result.** The DVM provider returns the Arweave transaction ID in a kind:6094 event:

   ```typescript
   // Subscribe to kind:6094 referencing the original event
   const filter = { kinds: [6094], '#e': [signedEvent.id] };
   // Result event content contains the Arweave tx-id
   // Access the blob at: https://arweave.net/<tx-id>
   ```

### Cost Breakdown

| Component | Size | Cost |
|-----------|------|------|
| Git object (binary) | 20 bytes | -- |
| Base64 payload | 28 bytes | -- |
| kind:5094 event (with tags) | ~350 bytes | ~$0.004 (relay fee) |
| Arweave storage | 20 bytes | Covered by bid amount |
| **Total TOON relay cost** | | **~$0.004** |

## Scenario 2: Resolve a SHA to an Arweave Transaction ID

**When:** An agent has a git SHA-1 hash (from a commit's `tree` field, a tree entry, or a kind:30618 repo state event) and needs to fetch the corresponding object from Arweave.

**Why this matters:** SHA resolution is the fundamental read operation for navigating git data on Arweave. Every DAG traversal step requires resolving a SHA to a transaction ID.

### Steps

1. **Query Arweave GraphQL by Git-SHA tag.**

   ```typescript
   const sha = '95d09f2b10159347eece71399a7e2e907ea3df4f';
   const repo = 'my-repo';

   const query = `
     query {
       transactions(
         tags: [
           { name: "Git-SHA", values: ["${sha}"] },
           { name: "Repo", values: ["${repo}"] }
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
   `;

   const response = await fetch('https://arweave.net/graphql', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ query })
   });

   const result = await response.json();
   const txId = result.data.transactions.edges[0]?.node.id;
   ```

2. **Fetch the object from the Arweave gateway.**

   ```typescript
   if (!txId) {
     throw new Error(`Git object ${sha} not found on Arweave for repo ${repo}`);
   }

   const objectUrl = `https://arweave.net/${txId}`;
   const objectResponse = await fetch(objectUrl);
   const objectBuffer = Buffer.from(await objectResponse.arrayBuffer());
   ```

3. **Verify the SHA-1 hash.** Always verify that the downloaded object matches the expected SHA:

   ```typescript
   const computedSha = createHash('sha1').update(objectBuffer).digest('hex');
   if (computedSha !== sha) {
     throw new Error(`SHA mismatch: expected ${sha}, got ${computedSha}`);
   }
   ```

4. **Parse the git object.** Extract the type and content from the binary envelope:

   ```typescript
   const nullIndex = objectBuffer.indexOf(0x00);
   const header = objectBuffer.subarray(0, nullIndex).toString('utf-8');
   const [type, sizeStr] = header.split(' ');
   const content = objectBuffer.subarray(nullIndex + 1);
   // type = 'blob', 'tree', or 'commit'
   // content = the type-specific payload
   ```

### Alternative: Manifest-Based Resolution

If a manifest transaction exists for the repository, resolve via path instead of GraphQL:

```typescript
// Get the manifest transaction ID (one-time query)
const manifestQuery = `
  query {
    transactions(
      tags: [
        { name: "Manifest-For", values: ["${repo}"] },
        { name: "Type", values: ["manifest"] }
      ]
      sort: HEIGHT_DESC
      first: 1
    ) {
      edges { node { id } }
    }
  }
`;
// ... fetch and parse ...
const manifestTxId = manifestResult.data.transactions.edges[0].node.id;

// Resolve any object via manifest path
const shaPrefix = sha.substring(0, 2);
const shaRemainder = sha.substring(2);
const objectUrl = `https://arweave.net/${manifestTxId}/objects/${shaPrefix}/${shaRemainder}`;
const objectResponse = await fetch(objectUrl);
```

### Considerations

- Reading from Arweave is free -- no TOON fees for resolution queries.
- Arweave GraphQL queries may have slight latency after upload (block confirmation time).
- Alternative gateways (`ar-io.net`, `g8way.io`) can be used if the primary gateway is slow.
- Manifest-based resolution is faster (single HTTP request vs GraphQL query) but requires a manifest to exist.

## Scenario 3: Navigate a Repository DAG

**When:** An agent needs to traverse from a branch head to a specific file's content, resolving each git object in the DAG via Arweave.

**Why this matters:** DAG navigation is how agents read repository contents from Arweave. Starting from the authoritative branch state (kind:30618), the agent walks the object graph: commit -> tree -> blob.

### Steps

1. **Get the branch head from kind:30618 (repo state).** Subscribe to the TOON relay for the repository state:

   ```typescript
   // Subscribe to kind:30618 for the repository
   const filter = {
     kinds: [30618],
     authors: ['<maintainer-pubkey>'],
     '#d': ['my-repo']
   };

   // The event contains refs tags:
   // ["refs/heads/main", "<commit-sha-hex>"]
   // ["refs/heads/develop", "<commit-sha-hex>"]
   // ["refs/tags/v1.0.0", "<commit-sha-hex>"]

   const mainBranchSha = event.tags
     .find(t => t[0] === 'refs/heads/main')?.[1];
   // mainBranchSha = 'abcdef1234567890abcdef1234567890abcdef12'
   ```

2. **Resolve the commit SHA on Arweave.**

   ```typescript
   const commitTxId = await resolveGitSHA(mainBranchSha, 'my-repo');
   const commitBuffer = await fetchFromArweave(commitTxId);
   ```

3. **Parse the commit object.** Extract the tree SHA and any parent SHAs:

   ```typescript
   const commitContent = parseGitObject(commitBuffer);
   // commitContent.type = 'commit'
   // Parse the commit text:
   const lines = commitContent.body.toString('utf-8').split('\n');
   const treeSha = lines.find(l => l.startsWith('tree '))?.split(' ')[1];
   const parentShas = lines
     .filter(l => l.startsWith('parent '))
     .map(l => l.split(' ')[1]);
   ```

4. **Resolve the root tree SHA on Arweave.**

   ```typescript
   const treeTxId = await resolveGitSHA(treeSha, 'my-repo');
   const treeBuffer = await fetchFromArweave(treeTxId);
   ```

5. **Parse the tree entries.** Each entry contains mode, name, and a 20-byte raw SHA-1:

   ```typescript
   function parseTreeEntries(treeContent: Buffer): Array<{mode: string, name: string, sha: string}> {
     const entries = [];
     let offset = 0;
     while (offset < treeContent.length) {
       // Find the null byte separating "mode name" from the SHA-1
       const nullIdx = treeContent.indexOf(0x00, offset);
       const modeAndName = treeContent.subarray(offset, nullIdx).toString('utf-8');
       const spaceIdx = modeAndName.indexOf(' ');
       const mode = modeAndName.substring(0, spaceIdx);
       const name = modeAndName.substring(spaceIdx + 1);
       // Next 20 bytes are raw SHA-1
       const rawSha = treeContent.subarray(nullIdx + 1, nullIdx + 21);
       const sha = rawSha.toString('hex');
       entries.push({ mode, name, sha });
       offset = nullIdx + 21;
     }
     return entries;
   }

   const treeContent = parseGitObject(treeBuffer);
   const entries = parseTreeEntries(treeContent.body);
   // entries = [
   //   { mode: '100644', name: 'README.md', sha: '95d09f2b...' },
   //   { mode: '040000', name: 'src', sha: 'a1b2c3d4...' },
   // ]
   ```

6. **Resolve a specific file (blob).** To read `README.md`:

   ```typescript
   const readmeEntry = entries.find(e => e.name === 'README.md');
   const blobTxId = await resolveGitSHA(readmeEntry.sha, 'my-repo');
   const blobBuffer = await fetchFromArweave(blobTxId);
   const blobContent = parseGitObject(blobBuffer);
   const fileContent = blobContent.body.toString('utf-8');
   // fileContent = 'hello world\n'
   ```

7. **Navigate into a subdirectory.** To read files in `src/`:

   ```typescript
   const srcEntry = entries.find(e => e.name === 'src');
   // mode '040000' indicates a subdirectory (tree)
   const srcTreeTxId = await resolveGitSHA(srcEntry.sha, 'my-repo');
   const srcTreeBuffer = await fetchFromArweave(srcTreeTxId);
   const srcEntries = parseTreeEntries(parseGitObject(srcTreeBuffer).body);
   // Continue resolving blobs or subtrees...
   ```

### Helper Functions

```typescript
async function resolveGitSHA(sha: string, repo: string): Promise<string> {
  const query = `
    query {
      transactions(
        tags: [
          { name: "Git-SHA", values: ["${sha}"] },
          { name: "Repo", values: ["${repo}"] }
        ]
        first: 1
      ) {
        edges { node { id } }
      }
    }
  `;
  const response = await fetch('https://arweave.net/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  const result = await response.json();
  const txId = result.data.transactions.edges[0]?.node.id;
  if (!txId) throw new Error(`Git object ${sha} not found on Arweave`);
  return txId;
}

async function fetchFromArweave(txId: string): Promise<Buffer> {
  const response = await fetch(`https://arweave.net/${txId}`);
  return Buffer.from(await response.arrayBuffer());
}

function parseGitObject(buffer: Buffer): { type: string, size: number, body: Buffer } {
  const nullIdx = buffer.indexOf(0x00);
  const header = buffer.subarray(0, nullIdx).toString('utf-8');
  const [type, sizeStr] = header.split(' ');
  return { type, size: parseInt(sizeStr, 10), body: buffer.subarray(nullIdx + 1) };
}
```

### Performance Considerations

- Each DAG traversal step requires an Arweave GraphQL query + gateway fetch (two HTTP requests).
- For a repository with depth D (commit -> tree -> subtree -> ... -> blob), expect 2*D HTTP requests.
- Manifest transactions reduce this to one HTTP request per object (no GraphQL query needed).
- Consider caching resolved SHA -> tx-id mappings locally to avoid repeated queries.
- Reading from Arweave is free -- no TOON relay fees for DAG navigation.

## Scenario 4: Bulk Upload a Repository

**When:** An agent needs to upload an entire repository snapshot (all files, directory structure, and a commit) to Arweave via TOON.

**Why this matters:** Bulk upload is the most expensive operation. Understanding the upload order, deduplication, and cost estimation helps agents plan and budget effectively.

### Steps

1. **Enumerate all files and compute their blob SHA-1s.**

   ```typescript
   import { readdirSync, readFileSync, statSync } from 'fs';
   import { join } from 'path';

   interface FileEntry {
     path: string;
     name: string;
     content: Buffer;
     sha1: string;
     gitObject: Buffer;
   }

   function enumerateFiles(dir: string, prefix = ''): FileEntry[] {
     const entries: FileEntry[] = [];
     for (const name of readdirSync(dir).sort()) {
       const fullPath = join(dir, name);
       const relativePath = prefix ? `${prefix}/${name}` : name;
       if (statSync(fullPath).isDirectory()) {
         entries.push(...enumerateFiles(fullPath, relativePath));
       } else {
         const content = readFileSync(fullPath);
         const header = Buffer.from(`blob ${content.length}\0`);
         const gitObject = Buffer.concat([header, content]);
         const sha1 = createHash('sha1').update(gitObject).digest('hex');
         entries.push({ path: relativePath, name, content, sha1, gitObject });
       }
     }
     return entries;
   }
   ```

2. **Check Arweave for existing objects (batch deduplication).**

   ```typescript
   async function checkExisting(shas: string[], repo: string): Promise<Set<string>> {
     const existing = new Set<string>();
     // Query in batches of 100 SHAs
     for (let i = 0; i < shas.length; i += 100) {
       const batch = shas.slice(i, i + 100);
       const query = `
         query {
           transactions(
             tags: [
               { name: "Git-SHA", values: ${JSON.stringify(batch)} },
               { name: "Repo", values: ["${repo}"] }
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
       `;
       const result = await fetchGraphQL(query);
       for (const edge of result.data.transactions.edges) {
         const shaTag = edge.node.tags.find((t: any) => t.name === 'Git-SHA');
         if (shaTag) existing.add(shaTag.value);
       }
     }
     return existing;
   }

   const allShas = files.map(f => f.sha1);
   const existingOnArweave = await checkExisting(allShas, 'my-repo');
   const filesToUpload = files.filter(f => !existingOnArweave.has(f.sha1));
   console.log(`${existingOnArweave.size} blobs already on Arweave, uploading ${filesToUpload.length}`);
   ```

3. **Upload blobs first.** Upload all file blobs that do not already exist:

   ```typescript
   for (const file of filesToUpload) {
     const base64 = file.gitObject.toString('base64');
     const event = {
       kind: 5094,
       content: '',
       tags: [
         ['i', base64, 'blob'],
         ['bid', '1000', 'usdc'],
         ['output', 'application/octet-stream'],
         ['Git-SHA', file.sha1],
         ['Git-Type', 'blob'],
         ['Repo', 'my-repo']
       ]
     };
     const signed = await signEvent(event, privateKey);
     await client.publishEvent(signed, { destination, claim });
     // Rate-limit to avoid overwhelming the relay/DVM
   }
   ```

4. **Construct and upload trees (bottom-up).** Build directory trees from leaves to root:

   ```typescript
   function buildTree(dirEntries: Array<{mode: string, name: string, sha: string}>): { gitObject: Buffer, sha1: string } {
     // Sort entries per git rules (directories get '/' appended for sorting)
     const sorted = [...dirEntries].sort((a, b) => {
       const aKey = a.mode === '040000' ? a.name + '/' : a.name;
       const bKey = b.mode === '040000' ? b.name + '/' : b.name;
       return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
     });

     const entryBuffers = sorted.map(e => {
       const modeAndName = Buffer.from(`${e.mode} ${e.name}\0`);
       const rawSha = Buffer.from(e.sha, 'hex'); // 20 bytes raw
       return Buffer.concat([modeAndName, rawSha]);
     });

     const treeContent = Buffer.concat(entryBuffers);
     const header = Buffer.from(`tree ${treeContent.length}\0`);
     const gitObject = Buffer.concat([header, treeContent]);
     const sha1 = createHash('sha1').update(gitObject).digest('hex');
     return { gitObject, sha1 };
   }

   // Build leaf directories first, then parent directories, then root
   // Upload each tree via kind:5094 with Git-Type: 'tree'
   ```

5. **Construct and upload the commit.** After all blobs and trees are uploaded:

   ```typescript
   const commitMessage = 'Initial repository upload to Arweave';
   const timestamp = Math.floor(Date.now() / 1000);
   const authorLine = `${displayName} <${pubkeyHex}@nostr> ${timestamp} +0000`;

   const commitBody = [
     `tree ${rootTreeSha}`,
     // parentSha ? `parent ${parentSha}` : '', // omit for initial commit
     `author ${authorLine}`,
     `committer ${authorLine}`,
     '',
     commitMessage + '\n'
   ].filter(Boolean).join('\n');

   const commitContent = Buffer.from(commitBody);
   const commitHeader = Buffer.from(`commit ${commitContent.length}\0`);
   const commitObject = Buffer.concat([commitHeader, commitContent]);
   const commitSha = createHash('sha1').update(commitObject).digest('hex');

   // Upload via kind:5094 with Git-Type: 'commit'
   ```

6. **Update the kind:30618 repo state.** After the commit is on Arweave, publish an updated repo state:

   ```typescript
   const repoState = {
     kind: 30618,
     content: '',
     tags: [
       ['d', 'my-repo'],
       ['refs/heads/main', commitSha],
       // Add more branches/tags as needed
     ]
   };
   const signedState = await signEvent(repoState, privateKey);
   await client.publishEvent(signedState, { destination, claim });
   ```

### Cost Estimation for Bulk Upload

| Repository Profile | Files | Total Binary Size | Base64 Overhead | Approx Relay Fees | Arweave Storage |
|-------------------|-------|------------------|-----------------|-------------------|-----------------|
| Tiny (5 files, 10KB) | 5 blobs + 1 tree + 1 commit | ~13.7KB base64 | ~3.7KB | ~$0.05 | ~$0.001 |
| Small (20 files, 50KB) | 20 blobs + ~5 trees + 1 commit | ~68.5KB base64 | ~18.5KB | ~$0.20 | ~$0.005 |
| Medium (100 files, 500KB) | 100 blobs + ~20 trees + 1 commit | ~685KB base64 | ~185KB | ~$2.00 | ~$0.05 |
| Large (500 files, 5MB) | 500 blobs + ~100 trees + 1 commit | ~6.85MB base64 | ~1.85MB | ~$20.00 | ~$0.50 |

**Cost optimization strategies:**
- Deduplicate before uploading -- identical files share the same SHA-1
- Exclude binary assets (images, compiled files) if not needed on Arweave
- Use `.gitignore`-style filtering to skip build artifacts
- Upload incrementally -- after the initial upload, only new/changed blobs need uploading
- Consider the kind:5094 `bid` amount carefully -- too low may cause DVM providers to reject the job

### Upload Order Summary

```
1. Blobs (no dependencies)
   |
2. Trees (reference blob and subtree SHAs)
   |
3. Commits (reference tree SHA and parent commit SHAs)
   |
4. kind:30618 repo state (reference commit SHA)
```

Violating this order means the DVM provider or Arweave consumers cannot resolve references until the referenced objects are uploaded. The upload succeeds, but the DAG is temporarily incomplete.
