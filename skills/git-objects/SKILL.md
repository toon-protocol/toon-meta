---
name: git-objects
description: Git object binary format reference for TOON Protocol. Covers blob format
  ("how do I create a git blob?", "blob header format", blob size null-byte content),
  tree format ("how do I construct a git tree?", "tree entry format", mode name sha1,
  sorted entries), commit format ("how do I build a git commit object?", "commit
  header format", tree parent author committer message), SHA-1 computation ("how is
  a git SHA-1 computed?", "git object hash", "content-addressed storage", SHA-1 of
  header plus content), Nostr pubkey to git author mapping ("how do I map a Nostr
  pubkey to a git author?", "hex pubkey author format"), and git object construction
  for Arweave upload ("how do I prepare git objects for kind:5094?", "git objects on
  Arweave", "content-addressed git storage"). This is a REFERENCE skill -- git objects
  are uploaded to Arweave via kind:5094 DVM requests (see git-collaboration skill).
---

# Git Object Format (TOON)

Binary format reference for git objects used in TOON's decentralized git collaboration. Covers the three core git object types (blob, tree, commit), their binary construction, SHA-1 content addressing, and the relationship between Nostr identity and git authorship. This is a knowledge skill -- git objects are not Nostr event kinds themselves, but they are the payload uploaded to Arweave via kind:5094 DVM requests (see `git-collaboration` for the upload mechanism).

On TOON, git objects uploaded via kind:5094 cost per-byte for the Nostr event (which carries the base64-encoded object), plus Arweave storage costs handled by the DVM provider. Understanding the binary format helps agents construct valid objects and predict upload costs.

## Git Object Model

Git uses three core object types, all content-addressed by SHA-1:

1. **Blob** -- Stores file content. No metadata about filename or permissions (that belongs to trees).
2. **Tree** -- Stores directory listings. Each entry maps a filename + mode to a blob or subtree SHA-1.
3. **Commit** -- Points to a tree (the snapshot) and zero or more parent commits, plus author/committer metadata and a message.

Every git object follows the same binary envelope:

```
<type> <size>\0<content>
```

Where `<type>` is `blob`, `tree`, or `commit`, `<size>` is the decimal ASCII string of the content length in bytes, `\0` is a null byte, and `<content>` is the type-specific payload. The SHA-1 hash of the entire envelope (header + null byte + content) is the object's address.

## Blob Format

```
blob <size>\0<content>
```

- `<size>`: decimal string of `<content>` byte length
- `<content>`: raw file content (any binary data)

Example: the string `"hello world\n"` (12 bytes) produces:

```
blob 12\0hello world\n
```

SHA-1: `95d09f2b10159347eece71399a7e2e907ea3df4f`

Blobs are the leaves of the git object graph. They contain no metadata -- the filename, permissions, and directory structure are recorded in the tree that references the blob.

## Tree Format

```
tree <size>\0<entries>
```

Each entry is:

```
<mode> <name>\0<20-byte-sha1>
```

- `<mode>`: octal file mode as ASCII string
  - `100644` -- regular file
  - `100755` -- executable file
  - `040000` -- subdirectory (tree)
  - `120000` -- symbolic link
  - `160000` -- gitlink (submodule)
- `<name>`: filename (no path separators, just the entry name)
- `\0`: null byte separator
- `<20-byte-sha1>`: raw 20-byte SHA-1 hash of the referenced object (NOT hex-encoded -- raw binary bytes)

**Critical:** Tree entries must be sorted by name using the byte-wise sorting rules git uses. For directory entries (mode `040000`), git appends a `/` to the name for sorting purposes only (the stored name does not include `/`). Entries are concatenated with no separator between them.

The `<size>` in the header is the total byte length of all concatenated entries.

## Commit Format

```
commit <size>\0tree <tree-sha>\n[parent <parent-sha>\n]*author <name> <email> <timestamp> <timezone>\ncommitter <name> <email> <timestamp> <timezone>\n[gpgsig -----BEGIN PGP SIGNATURE-----\n...\n-----END PGP SIGNATURE-----\n]\n<message>
```

- `tree <tree-sha>`: hex-encoded SHA-1 of the root tree (required, exactly one)
- `parent <parent-sha>`: hex-encoded SHA-1 of each parent commit (zero for initial commit, one for normal, two+ for merge)
- `author <name> <email> <timestamp> <timezone>`: who wrote the change
- `committer <name> <email> <timestamp> <timezone>`: who committed the change
- `<timestamp>`: Unix epoch seconds as decimal string
- `<timezone>`: UTC offset as `+HHMM` or `-HHMM` (e.g., `+0000` for UTC)
- `<message>`: commit message text, preceded by a blank line (`\n\n` after the last header line)

Note: SHA-1 values in commit objects are hex-encoded (40 characters), unlike tree entries which use raw 20-byte binary SHA-1.

## SHA-1 Computation

Every git object is identified by the SHA-1 hash of its complete binary representation (header + null byte + content):

```
SHA-1("blob 12\0hello world\n") = 95d09f2b10159347eece71399a7e2e907ea3df4f
```

Steps to compute:
1. Determine the object type (`blob`, `tree`, or `commit`)
2. Compute the byte length of the content
3. Construct the header: `<type> <size>\0`
4. Concatenate header + content
5. Compute SHA-1 of the full byte sequence

SHA-1 makes git objects content-addressed: identical content always produces the same hash, enabling deduplication across repositories and Arweave uploads.

## Nostr Pubkey to Git Author Mapping

When constructing commit objects for TOON/Nostr-based git collaboration, map the Nostr hex pubkey to git author fields:

- **Name**: the hex pubkey (or a display name from the user's kind:0 profile if available)
- **Email**: `<hex-pubkey>@nostr` (convention for Nostr-native commits)

Example for pubkey `abc123...def456`:

```
author abc123...def456 <abc123...def456@nostr> 1711500000 +0000
committer abc123...def456 <abc123...def456@nostr> 1711500000 +0000
```

If the user has a kind:0 profile with a `name` or `display_name` field, prefer that for readability:

```
author Alice <abc123...def456@nostr> 1711500000 +0000
```

## Relationship to kind:5094

Git objects are uploaded to Arweave via kind:5094 DVM requests (defined in the `git-collaboration` skill). The upload flow:

1. **Construct** the git object in binary format (this skill)
2. **Compute** its SHA-1 hash (this skill)
3. **Base64-encode** the binary object for the kind:5094 `i` tag
4. **Publish** the kind:5094 event with `Git-SHA`, `Git-Type`, and `Repo` tags (see `git-collaboration`)

Upload order matters: blobs first, then trees (which reference blob SHA-1s), then commits (which reference tree SHA-1s). This ensures all referenced objects exist on Arweave before the referencing object.

## When to Read Each Reference

Read the appropriate reference file based on the situation:

- **Detailed binary format specifications for blob, tree, and commit objects** -- Read [nip-spec.md](references/nip-spec.md) for complete binary construction rules, byte layouts, and validation constraints.
- **Step-by-step construction workflows with code examples** -- Read [scenarios.md](references/scenarios.md) for constructing blobs, trees, commits, and computing SHA-1 hashes.
- **Relationship to kind:5094 Arweave uploads and TOON fee implications** -- Read [toon-extensions.md](references/toon-extensions.md) for upload flow, base64 encoding overhead, and cost calculations.

### Cross-Skill References

- **Uploading git objects to Arweave (kind:5094 DVM requests)** -- See `git-collaboration` for the kind:5094 event format, DVM request construction, and Arweave upload mechanics.
- **Arweave content references and file metadata** -- See `media-and-files` for NIP-73 `arweave:tx:` external content IDs and NIP-94 file metadata.
- **TOON write model, read model, and fee calculation details** -- Read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md` (canonical protocol reference, D9-010).
- **Nostr identity and profile metadata** -- See `social-identity` for kind:0 profile metadata used in Nostr pubkey to git author mapping.

## Social Context

Git objects represent the underlying data structures of version-controlled code. On TOON, uploading git objects to Arweave via kind:5094 costs per-byte, so constructing objects correctly matters -- malformed objects waste storage fees and break content-addressed resolution. Blob, tree, and commit objects each follow strict binary formats that must be respected for SHA-1 hashes to match. When collaborating on a paid network, correct object construction ensures that references between objects (trees pointing to blobs, commits pointing to trees) resolve properly for all participants.
