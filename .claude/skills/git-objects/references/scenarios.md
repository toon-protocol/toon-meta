# Git Object Construction Scenarios

> **Why this reference exists:** Agents need step-by-step workflows for constructing git objects that will be uploaded to Arweave via kind:5094. Each scenario shows the complete flow from raw data to a valid, SHA-1-addressed git object ready for base64 encoding and DVM upload. These scenarios bridge the gap between knowing the binary format (nip-spec.md) and knowing the TOON upload mechanics (toon-extensions.md).

## Scenario 1: Constructing a Git Blob

**When:** An agent needs to store a file's content as a git blob object for upload to Arweave.

**Why this matters:** Blobs are the most common git object type -- every file in a repository is stored as a blob. On TOON, the blob's binary size directly affects the kind:5094 upload cost because the base64-encoded blob goes into the event's `i` tag.

### Steps

1. **Read the file content as raw bytes.** For a file containing `"hello world\n"` (with a trailing newline), this is 12 bytes.

2. **Construct the header.** The header is `blob ` + the decimal byte count + a null byte:
   ```
   "blob 12\0"
   ```
   This is 8 bytes: `b`(0x62), `l`(0x6C), `o`(0x6F), `b`(0x62), ` `(0x20), `1`(0x31), `2`(0x32), `\0`(0x00).

3. **Concatenate header and content.**
   ```
   "blob 12\0hello world\n"
   ```
   Total: 20 bytes.

4. **Compute the SHA-1 hash** of the full 20-byte sequence:
   ```
   SHA-1 = 95d09f2b10159347eece71399a7e2e907ea3df4f
   ```

5. **Base64-encode the 20-byte object** for the kind:5094 `i` tag payload.

6. **Upload via kind:5094** with `Git-SHA` set to `95d09f2b10159347eece71399a7e2e907ea3df4f`, `Git-Type` set to `blob`, and `Repo` set to the repository identifier. See `git-collaboration` for the kind:5094 event format.

### TypeScript Example

```typescript
import { createHash } from 'crypto';

function createGitBlob(content: Buffer): { object: Buffer; sha1: string } {
  const header = Buffer.from(`blob ${content.length}\0`);
  const object = Buffer.concat([header, content]);
  const sha1 = createHash('sha1').update(object).digest('hex');
  return { object, sha1 };
}

// Usage
const fileContent = Buffer.from('hello world\n');
const { object, sha1 } = createGitBlob(fileContent);
// sha1 = '95d09f2b10159347eece71399a7e2e907ea3df4f'
// object.toString('base64') for the kind:5094 i tag
```

### Considerations

- Blob content can be any binary data -- text files, images, compiled binaries. The format does not change.
- An empty file produces a valid blob: `"blob 0\0"` with SHA-1 `e69de29bb2d1d6434b8b29ae775ad8c2e48c5391`.
- Two files with identical content produce the same blob SHA-1, enabling deduplication on Arweave. Before uploading, check if the SHA-1 already exists on Arweave via GraphQL query on the `Git-SHA` tag.

## Scenario 2: Constructing a Git Tree

**When:** An agent needs to represent a directory's contents as a git tree object, referencing previously uploaded blobs and subtrees.

**Why this matters:** Trees are how git represents directory structure. A tree references blob SHA-1s (for files) and other tree SHA-1s (for subdirectories). All referenced objects must exist on Arweave before uploading the tree -- upload order matters.

### Steps

1. **Gather the directory entries.** For a directory containing:
   - `README.md` (regular file, blob SHA-1: `95d09f2b10159347eece71399a7e2e907ea3df4f`)
   - `src/` (subdirectory, tree SHA-1: `a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0`)

2. **Sort entries by name** using git's sorting rules. For sort comparison, append `/` to directory names:
   - `README.md` sorts as `"README.md"` -- before `"src/"`
   - `src` sorts as `"src/"` -- after `"README.md"`

   Sorted order: `README.md`, `src`.

3. **Construct each entry.** Each entry is `<mode> <name>\0<20-byte-raw-sha1>`:

   Entry 1 (README.md):
   ```
   "100644 README.md\0" + <20 raw bytes of 95d09f...>
   ```
   Size: 18 + 20 = 38 bytes

   Entry 2 (src):
   ```
   "40000 src\0" + <20 raw bytes of a1b2c3...>
   ```
   Size: 10 + 20 = 30 bytes

4. **Concatenate all entries.** Total content: 68 bytes.

5. **Construct the header:** `"tree 68\0"` (8 bytes).

6. **Concatenate header and content.** Total object: 76 bytes.

7. **Compute SHA-1** of the full 76-byte object.

8. **Base64-encode and upload via kind:5094** with `Git-Type` set to `tree`.

### TypeScript Example

```typescript
import { createHash } from 'crypto';

interface TreeEntry {
  mode: string;    // '100644', '100755', '40000', '120000', '160000'
  name: string;    // filename (no path separators)
  sha1: string;    // 40-char hex SHA-1 of referenced object
}

function createGitTree(entries: TreeEntry[]): { object: Buffer; sha1: string } {
  // Sort entries: directories get '/' appended for comparison only
  const sorted = [...entries].sort((a, b) => {
    const nameA = a.mode === '40000' ? a.name + '/' : a.name;
    const nameB = b.mode === '40000' ? b.name + '/' : b.name;
    return nameA < nameB ? -1 : nameA > nameB ? 1 : 0;
  });

  // Construct entry buffers
  const entryBuffers = sorted.map(entry => {
    const modeName = Buffer.from(`${entry.mode} ${entry.name}\0`);
    // Convert hex SHA-1 to raw 20-byte binary
    const rawSha1 = Buffer.from(entry.sha1, 'hex');
    return Buffer.concat([modeName, rawSha1]);
  });

  const content = Buffer.concat(entryBuffers);
  const header = Buffer.from(`tree ${content.length}\0`);
  const object = Buffer.concat([header, content]);
  const sha1 = createHash('sha1').update(object).digest('hex');
  return { object, sha1 };
}

// Usage
const { object, sha1 } = createGitTree([
  { mode: '100644', name: 'README.md', sha1: '95d09f2b10159347eece71399a7e2e907ea3df4f' },
  { mode: '40000', name: 'src', sha1: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0' },
]);
```

### Considerations

- **Upload order:** All blobs referenced by the tree must be uploaded to Arweave first. Then subtrees. Then this tree. Bottom-up order ensures all references resolve.
- **Raw binary SHA-1:** The 20-byte SHA-1 in tree entries is raw binary, NOT the 40-character hex string. This is the most common mistake. Use `Buffer.from(hexSha1, 'hex')` to convert.
- **Sorting is mandatory.** Unsorted tree entries produce a different SHA-1 than git expects, making the object incompatible with standard git tooling.
- **Mode encoding:** Git omits unnecessary leading zeros in some modes. `040000` is stored as `40000`. `100644` and `100755` keep all six digits.

## Scenario 3: Constructing a Git Commit

**When:** An agent needs to create a commit object pointing to a tree snapshot, with author/committer metadata derived from a Nostr identity.

**Why this matters:** Commits tie together the tree (snapshot), parent history, and authorship. On TOON, the Nostr pubkey is mapped to git author fields, creating a verifiable link between Nostr identity and git history.

### Steps

1. **Gather commit data:**
   - Root tree SHA-1: `4b825dc642cb6eb9a060e54bf899d69f7638d87a`
   - Parent commit SHA-1: `0123456789abcdef0123456789abcdef01234567` (omit for initial commit)
   - Author Nostr pubkey: `abc123def456789abc123def456789abc123def456789abc123def456789abcd`
   - Timestamp: `1711500000` (Unix epoch seconds)
   - Message: `"Add README and src directory"`

2. **Map Nostr pubkey to git author.** Use the hex pubkey as the name and `<pubkey>@nostr` as the email:
   ```
   abc123de...9abcd <abc123de...9abcd@nostr> 1711500000 +0000
   ```
   If a kind:0 profile is available with a display name, prefer that for readability:
   ```
   Alice <abc123de...9abcd@nostr> 1711500000 +0000
   ```

3. **Construct the commit content** (everything after the header null byte):
   ```
   tree 4b825dc642cb6eb9a060e54bf899d69f7638d87a
   parent 0123456789abcdef0123456789abcdef01234567
   author Alice <abc123de...9abcd@nostr> 1711500000 +0000
   committer Alice <abc123de...9abcd@nostr> 1711500000 +0000

   Add README and src directory
   ```
   Note: blank line between headers and message. Message ends with a newline.

4. **Count the content bytes.** The content is the complete text above (all header lines, blank line, and message with trailing newline).

5. **Construct the header:** `"commit <size>\0"` where `<size>` is the decimal byte count.

6. **Concatenate and compute SHA-1.**

7. **Base64-encode and upload via kind:5094** with `Git-Type` set to `commit`.

### TypeScript Example

```typescript
import { createHash } from 'crypto';

interface CommitData {
  treeSha: string;         // hex SHA-1 of root tree
  parentShas: string[];    // hex SHA-1s of parent commits (empty for initial)
  authorName: string;      // display name or hex pubkey
  authorEmail: string;     // typically <pubkey>@nostr
  authorTimestamp: number;  // Unix epoch seconds
  authorTz: string;        // e.g., '+0000'
  committerName: string;
  committerEmail: string;
  committerTimestamp: number;
  committerTz: string;
  message: string;
}

function createGitCommit(data: CommitData): { object: Buffer; sha1: string } {
  let content = `tree ${data.treeSha}\n`;
  for (const parent of data.parentShas) {
    content += `parent ${parent}\n`;
  }
  content += `author ${data.authorName} <${data.authorEmail}> ${data.authorTimestamp} ${data.authorTz}\n`;
  content += `committer ${data.committerName} <${data.committerEmail}> ${data.committerTimestamp} ${data.committerTz}\n`;
  content += `\n${data.message}\n`;

  const contentBuf = Buffer.from(content);
  const header = Buffer.from(`commit ${contentBuf.length}\0`);
  const object = Buffer.concat([header, contentBuf]);
  const sha1 = createHash('sha1').update(object).digest('hex');
  return { object, sha1 };
}

// Usage with Nostr pubkey mapping
const pubkey = 'abc123def456789abc123def456789abc123def456789abc123def456789abcd';
const { object, sha1 } = createGitCommit({
  treeSha: '4b825dc642cb6eb9a060e54bf899d69f7638d87a',
  parentShas: ['0123456789abcdef0123456789abcdef01234567'],
  authorName: 'Alice',  // from kind:0 profile, or use pubkey
  authorEmail: `${pubkey}@nostr`,
  authorTimestamp: 1711500000,
  authorTz: '+0000',
  committerName: 'Alice',
  committerEmail: `${pubkey}@nostr`,
  committerTimestamp: 1711500000,
  committerTz: '+0000',
  message: 'Add README and src directory',
});
```

### Considerations

- **SHA-1 encoding differs from trees:** Commit objects use hex-encoded SHA-1 (40 ASCII characters) for tree and parent references. Tree entries use raw 20-byte binary. This is a critical difference.
- **Initial commits have no parent line.** Simply omit the `parent` header entirely -- do not include an empty parent line.
- **Merge commits have multiple parent lines.** List them in order, one per line.
- **Author vs committer:** In standard git, the author wrote the change and the committer applied it. For TOON-native commits, author and committer are typically the same Nostr identity.
- **Timezone format:** Always use `+HHMM` or `-HHMM` format. UTC is `+0000`. Do not use `Z` or timezone names.
- **Upload order:** The tree referenced by the commit must already be on Arweave. The commit is always uploaded last in the object graph.

## Scenario 4: Computing and Verifying SHA-1

**When:** An agent needs to verify that a constructed git object produces the expected SHA-1 hash, or needs to compute the hash for deduplication checking before upload.

**Why this matters:** SHA-1 is the content address for git objects. A wrong SHA-1 means the object cannot be found or verified by standard git tooling. On TOON, the `Git-SHA` tag in kind:5094 events must match the actual SHA-1 of the uploaded object.

### Steps

1. **Construct the complete object** including the type header, size, null byte, and content (as described in Scenarios 1-3).

2. **Compute SHA-1** of the full byte sequence:
   ```typescript
   import { createHash } from 'crypto';
   const sha1 = createHash('sha1').update(objectBuffer).digest('hex');
   ```

3. **Verify against git** (if the object corresponds to a local file):
   ```bash
   # For blobs -- hash a file's content
   git hash-object path/to/file

   # For any object -- hash from stdin with explicit type
   git hash-object -t blob --stdin < path/to/file
   ```

4. **Check Arweave for duplicates** before uploading. Query by `Git-SHA` tag:
   ```graphql
   query {
     transactions(
       tags: [
         { name: "Git-SHA", values: ["95d09f2b10159347eece71399a7e2e907ea3df4f"] },
         { name: "Repo", values: ["toon-sdk"] }
       ]
     ) {
       edges { node { id } }
     }
   }
   ```
   If the query returns results, the object already exists on Arweave -- skip the upload to save the kind:5094 event cost.

5. **Set the `Git-SHA` tag** in the kind:5094 event to the computed SHA-1.

### Common Verification Failures

| Symptom | Cause | Fix |
|---------|-------|-----|
| SHA-1 mismatch vs `git hash-object` | Wrong size in header (using total size instead of content size) | Use `content.length`, not `header.length + content.length` |
| SHA-1 mismatch for tree | Hex SHA-1 in entry instead of raw binary | Use `Buffer.from(hexSha1, 'hex')` for 20-byte raw |
| SHA-1 mismatch for tree | Entries not sorted | Apply directory-suffix sorting rule |
| SHA-1 mismatch for commit | `\r\n` line endings | Use `\n` only |
| SHA-1 mismatch for commit | Missing trailing newline on message | Append `\n` to message |
| SHA-1 mismatch for commit | Missing blank line before message | Ensure `\n\n` between last header and message |

### Considerations

- SHA-1 is deterministic: the same input always produces the same hash. If your hash does not match `git hash-object`, the binary representation is wrong.
- Content-addressing enables deduplication. Before paying for a kind:5094 upload, always check if the SHA-1 already exists on Arweave for the target repository.
- The `Git-SHA` tag in kind:5094 events MUST match the actual SHA-1 of the uploaded binary. A mismatch means the object cannot be resolved by SHA-1 later.
