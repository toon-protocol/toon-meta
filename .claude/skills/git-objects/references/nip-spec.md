# Git Object Binary Format Specification

> **Why this reference exists:** Agents constructing git objects for upload to Arweave via kind:5094 need precise binary format rules. Malformed objects waste ILP payment on events the DVM cannot process. This file covers the exact byte-level construction of blob, tree, and commit objects, including the common pitfalls (raw vs hex SHA-1 in trees, entry sorting, null byte placement).

## Universal Object Envelope

Every git object uses the same binary envelope:

```
<type> <size>\0<content>
```

| Component | Description | Encoding |
|-----------|-------------|----------|
| `<type>` | Object type string | ASCII: `blob`, `tree`, or `commit` |
| ` ` | Space separator | ASCII 0x20 |
| `<size>` | Byte length of `<content>` | Decimal ASCII string (e.g., `"12"`, `"4096"`) |
| `\0` | Null byte separator | Binary 0x00 |
| `<content>` | Type-specific payload | Raw bytes (type-dependent format) |

The SHA-1 hash is computed over the entire envelope: `SHA-1(type + " " + size + "\0" + content)`.

**Critical:** `<size>` is the byte length of `<content>` only, NOT the total object size including the header. The decimal string representation is used (not binary-encoded integer).

## Blob Objects

### Format

```
blob <size>\0<raw-file-content>
```

Blobs store raw file content with no additional structure. The content can be any binary data -- text files, images, compiled binaries, etc.

### Construction Rules

1. Read the file content as raw bytes
2. Count the byte length of the content
3. Construct the header: `"blob "` + decimal byte count + null byte
4. Concatenate header + content
5. SHA-1 hash the full concatenation

### Worked Example

File content: `"hello world\n"` (12 bytes, where `\n` is a single newline byte 0x0A)

```
Header:  "blob 12\0"          (8 bytes: b,l,o,b,0x20,0x31,0x32,0x00)
Content: "hello world\n"      (12 bytes)
Total:   20 bytes
```

SHA-1: `95d09f2b10159347eece71399a7e2e907ea3df4f`

### Validation

- Content can be empty (0 bytes). Header would be `"blob 0\0"`.
- There is no filename, mode, or metadata in a blob. That information belongs to the tree entry that references the blob.
- Blob SHA-1 depends only on file content. Two files with identical content always produce the same blob SHA-1, regardless of filename or location.

## Tree Objects

### Format

```
tree <size>\0<entry1><entry2>...<entryN>
```

Each entry:

```
<mode> <name>\0<20-byte-raw-sha1>
```

### Entry Components

| Component | Description | Encoding |
|-----------|-------------|----------|
| `<mode>` | File mode (octal) | ASCII string, NO leading zeros except for standard modes |
| ` ` | Space separator | ASCII 0x20 |
| `<name>` | Entry name (filename or dirname) | Raw bytes (typically UTF-8), no path separators |
| `\0` | Null byte separator | Binary 0x00 |
| `<20-byte-raw-sha1>` | SHA-1 of referenced object | **Raw 20 binary bytes, NOT hex-encoded** |

### File Modes

| Mode | Meaning | Referenced Object Type |
|------|---------|----------------------|
| `100644` | Regular file (non-executable) | blob |
| `100755` | Executable file | blob |
| `040000` | Subdirectory | tree |
| `120000` | Symbolic link | blob (link target as content) |
| `160000` | Gitlink (submodule commit) | commit (in submodule) |

**Note on mode encoding:** Git stores modes without unnecessary leading zeros in the ASCII representation. `040000` is stored as `40000` (5 chars), `100644` as `100644` (6 chars), `100755` as `100755` (6 chars). However, when constructing trees programmatically, using the full representation (e.g., `"040000"`) also works because git's parser is permissive on read.

### Entry Sorting Rules

Tree entries MUST be sorted. Git uses a specific byte-wise sorting algorithm:

1. For sorting purposes only, directory entries (mode `040000`) have `/` appended to their name
2. Entries are sorted by these augmented names using raw byte comparison
3. The stored name does NOT include the trailing `/` -- it is only used for sort comparison

Example sort order:
```
"file.c"      (mode 100644, sorts as "file.c")
"include"     (mode 040000, sorts as "include/")
"include.h"   (mode 100644, sorts as "include.h")
"src"         (mode 040000, sorts as "src/")
```

Without the directory `/` suffix rule, `include` would sort before `include.h`. With the rule, `include/` sorts after `include.h` in byte order, producing a different (and correct) result.

### Critical: Raw Binary SHA-1

The 20-byte SHA-1 in tree entries is raw binary, NOT the 40-character hex string. This is the most common mistake when constructing tree objects programmatically.

```
Hex SHA-1:    "95d09f2b10159347eece71399a7e2e907ea3df4f" (40 chars, 40 bytes as ASCII)
Raw SHA-1:    0x95 0xd0 0x9f 0x2b ... 0x4f                (20 bytes binary)
```

To convert: parse the hex string as pairs of hex digits, each pair becoming one byte.

### Worked Example

A tree with two entries:

| Mode | Name | SHA-1 (hex) |
|------|------|-------------|
| `100644` | `README.md` | `95d09f2b10159347eece71399a7e2e907ea3df4f` |
| `040000` | `src` | `a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0` |

Sorted order: `README.md` (file) then `src` (directory) -- `README.md` < `src/` in byte order.

```
Entry 1: "100644 README.md\0" + <20 raw bytes of 95d09f...>   (29 + 20 = 49 bytes)
Entry 2: "40000 src\0" + <20 raw bytes of a1b2c3...>          (10 + 20 = 30 bytes)
Content: 79 bytes total
Header:  "tree 79\0"
```

### Tree Size Calculation

The `<size>` in the header is the total byte length of all concatenated entries. Each entry contributes:

```
length(mode_string) + 1 (space) + length(name_bytes) + 1 (null) + 20 (raw SHA-1)
```

For a `100644` mode entry named `file.txt`: `6 + 1 + 8 + 1 + 20 = 36 bytes`

## Commit Objects

### Format

```
commit <size>\0<headers>\n\n<message>
```

### Header Lines

Headers appear in a specific order, separated by newlines (`\n`, 0x0A):

```
tree <tree-sha-hex>
parent <parent-sha-hex>
author <name> <email> <timestamp> <timezone>
committer <name> <email> <timestamp> <timezone>
```

| Header | Required | Repeatable | Description |
|--------|----------|------------|-------------|
| `tree` | Yes | No | Hex-encoded SHA-1 of root tree object (40 chars) |
| `parent` | No | Yes | Hex-encoded SHA-1 of parent commit (40 chars) |
| `author` | Yes | No | Who authored the change |
| `committer` | Yes | No | Who committed the change |
| `gpgsig` | No | No | PGP signature (multi-line, indented with single space) |

**Important:** SHA-1 values in commits are hex-encoded (40 ASCII characters), unlike tree entries which use raw 20-byte binary. This is a crucial difference.

### Parent Commits

- **Initial commit:** No `parent` line
- **Normal commit:** One `parent` line
- **Merge commit:** Two or more `parent` lines, one per parent, in order

### Author/Committer Format

```
<name> <<email>> <unix-timestamp> <timezone>
```

| Component | Description | Example |
|-----------|-------------|---------|
| `<name>` | Display name | `Alice` |
| `<email>` | Email in angle brackets | `<alice@example.com>` |
| `<unix-timestamp>` | Seconds since Unix epoch | `1711500000` |
| `<timezone>` | UTC offset | `+0000`, `-0500`, `+0530` |

The angle brackets around the email are literal characters in the format.

### Commit Message

The message follows the headers, separated by exactly one blank line (`\n\n`). The blank line is the delimiter -- the message content starts on the line after it. The message may contain multiple lines and typically ends with a newline.

### Worked Example

```
tree 4b825dc642cb6eb9a060e54bf899d69f7638d87a
parent 0123456789abcdef0123456789abcdef01234567
author Alice <alice@nostr> 1711500000 +0000
committer Alice <alice@nostr> 1711500000 +0000

Initial implementation of the feature
```

The content (everything after the null byte in the header) includes all header lines, the blank line, and the message. Count those bytes for the `<size>` field.

### GPG Signature Format

When present, the `gpgsig` header spans multiple lines. Continuation lines are indented with a single space:

```
gpgsig -----BEGIN PGP SIGNATURE-----
 <base64 line 1>
 <base64 line 2>
 ...
 -----END PGP SIGNATURE-----
```

The space at the beginning of each continuation line is part of the format. The signature appears between the `committer` line and the blank line before the message.

## SHA-1 Computation

### Algorithm

1. Construct the full object bytes: `type + " " + size + "\0" + content`
2. Feed the entire byte sequence to SHA-1
3. The resulting 20-byte hash is the object identifier

### Properties

- **Deterministic:** Same content always produces the same hash
- **Content-addressed:** The hash IS the address -- no separate naming required
- **Deduplication:** Identical blobs across repositories share the same SHA-1, enabling deduplication on Arweave

### Verification

To verify a constructed object, compare its computed SHA-1 against `git hash-object`:

```bash
# For blobs:
echo -n "hello world" | git hash-object --stdin
# Output: 95d09f2b10159347eece71399a7e2e907ea3df4f

# For any object type:
git hash-object -t blob <file>
git hash-object -t tree <file>
git hash-object -t commit <file>
```

### Common Mistakes

1. **Wrong size:** Using total object size instead of content-only size
2. **Hex SHA-1 in trees:** Using 40-byte hex string instead of 20-byte raw binary in tree entries
3. **Missing null byte:** Forgetting the `\0` between header and content
4. **Wrong newline:** Using `\r\n` instead of `\n` in commit objects
5. **Unsorted tree entries:** Not applying the directory-suffix sorting rule
6. **Size as binary:** Encoding the size as a binary integer instead of decimal ASCII string
