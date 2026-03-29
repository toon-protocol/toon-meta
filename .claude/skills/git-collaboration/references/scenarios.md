# Git Collaboration Scenarios

> **Why this reference exists:** Agents need step-by-step workflows for common git collaboration operations on TOON. Each scenario shows the complete flow from intent to published event, including TOON-specific considerations like fee calculation, the publishEvent API, and economic incentives for keeping diffs minimal. These scenarios bridge the gap between knowing the NIP-34 event kinds (nip-spec.md) and knowing the TOON publishing mechanics (toon-extensions.md).

## Scenario 1: Announcing a Repository (kind:30617)

**When:** A maintainer wants to publish a new repository to the TOON network for decentralized collaboration.

**Why this matters:** The repository announcement is the anchor event for all collaboration. Patches, PRs, issues, and status events all reference the repository address (`30617:<pubkey>:<repo-id>`). On TOON, announcing a repository is an economic commitment to maintaining a project.

### Steps

1. **Choose a repository identifier.** Pick a unique `d` tag value (e.g., `my-project`). This is permanent -- the repository address is derived from it.

2. **Construct the kind:30617 event.** Content can be repository description text (or empty; clients also check the `description` tag). Add required and optional tags:
   ```json
   {
     "kind": 30617,
     "content": "A decentralized application framework",
     "tags": [
       ["d", "my-project"],
       ["name", "My Project"],
       ["description", "A decentralized application framework"],
       ["clone", "https://github.com/user/my-project.git"],
       ["clone", "git://git.example.com/my-project.git"],
       ["web", "https://github.com/user/my-project"],
       ["relays", "wss://relay.toon.example"],
       ["maintainers", "<your-pubkey-hex>", "<co-maintainer-pubkey-hex>"],
       ["t", "framework"],
       ["t", "typescript"]
     ]
   }
   ```

3. **Sign the event** using your Nostr private key.

4. **Calculate the fee.** A full repository announcement is approximately 400-500 bytes (~$0.004-$0.005 at default `basePricePerByte`).

5. **Publish via `publishEvent()`** from `@toon-protocol/client`.

6. **Record the repository address.** It is `30617:<your-pubkey>:my-project`. Share this with contributors so they can submit patches, PRs, and issues.

### Considerations

- Include all clone URLs so contributors can fetch code regardless of their preferred protocol.
- List all maintainers in the `maintainers` tag -- this determines who can authoritatively merge and close.
- Use topic tags (`t`) for discoverability. Contributors searching for TypeScript projects will find yours.
- This is a parameterized replaceable event. You can update metadata later at the same per-byte cost.

## Scenario 2: Publishing Repository State (kind:30618)

**When:** A maintainer wants to publish the current branch heads and tags after pushing changes.

### Steps

1. **Determine current refs.** Run `git show-ref` to get branch heads and tags.

2. **Construct the kind:30618 event:**
   ```json
   {
     "kind": 30618,
     "content": "",
     "tags": [
       ["d", "my-project"],
       ["refs/heads/main", "abc123def456..."],
       ["refs/heads/develop", "789ghi012jkl..."],
       ["refs/tags/v1.0.0", "mno345pqr678..."],
       ["HEAD", "ref: refs/heads/main"]
     ]
   }
   ```

3. **Sign, calculate fee (~200-800 bytes, ~$0.002-$0.008), and publish** via `publishEvent()`.

### Considerations

- Publish state after every push to keep the network's view of your repository current.
- This is parameterized replaceable -- each update replaces the previous state event.
- Omitting all ref tags signals you have ceased tracking the repository.

## Scenario 3: Submitting a Patch (kind:1617)

**When:** A contributor wants to submit a code change to a repository as a patch.

**Why this matters:** Patches are the primary code contribution mechanism in NIP-34. On TOON, patches cost per-byte because the content contains full `git format-patch` output, so keep diffs focused and minimal.

### Steps

1. **Generate the patch.** Run `git format-patch -1 HEAD` (or `-N` for a series). This produces the patch text.

2. **For a single patch, construct the kind:1617 event:**
   ```json
   {
     "kind": 1617,
     "content": "From abc123 Mon Sep 17 00:00:00 2001\nFrom: Author <author@example.com>\nDate: ...\nSubject: [PATCH] Fix null check in parser\n\n---\n src/parser.ts | 3 ++-\n 1 file changed, 2 insertions(+), 1 deletion(-)\n\ndiff --git a/src/parser.ts b/src/parser.ts\n...",
     "tags": [
       ["a", "30617:<maintainer-pubkey>:my-project"],
       ["r", "<earliest-unique-commit>"],
       ["p", "<maintainer-pubkey>"],
       ["t", "root"],
       ["commit", "<commit-hash>"],
       ["parent-commit", "<parent-commit-hash>"]
     ]
   }
   ```

3. **For a patch series (multiple patches):**
   - First patch gets `["t", "root"]` tag
   - Subsequent patches use `["e", "<previous-patch-event-id>", "", "reply"]` to thread

4. **Sign the event** using your Nostr private key.

5. **Calculate the fee.** A small patch is ~500-2000 bytes (~$0.005-$0.02). A large patch can be 10-50KB (~$0.10-$0.50). Consider splitting large changes.

6. **Publish via `publishEvent()`** from `@toon-protocol/client`.

### Considerations

- Keep patches focused. A 50KB patch costs ~$0.50. Five 10KB patches cost the same total but are individually reviewable.
- Avoid unnecessary whitespace changes -- they inflate patch size without adding value.
- Use a cover letter (first patch with `["t", "root"]`) for multi-patch series to explain the overall change.
- Write concise commit messages -- they are part of the patch content and cost per-byte.

## Scenario 4: Creating a Pull Request (kind:1618)

**When:** A contributor wants to request merging a branch with multiple commits.

**Why this matters:** PRs are cheaper than patches on TOON because the content is a markdown description, not the full diff. Reviewers fetch the code via clone URLs.

### Steps

1. **Push your branch** to a publicly accessible repository.

2. **Construct the kind:1618 event:**
   ```json
   {
     "kind": 1618,
     "content": "## Summary\n\nAdds WebSocket reconnection logic with exponential backoff.\n\n## Changes\n\n- New `reconnect()` method with configurable retry limits\n- Backoff starts at 1s, doubles up to 30s\n- Added tests for reconnection scenarios\n\n## Test Plan\n\n- `pnpm test` passes\n- Manual testing against local relay",
     "tags": [
       ["a", "30617:<maintainer-pubkey>:my-project"],
       ["r", "<earliest-unique-commit>"],
       ["c", "<branch-tip-commit>"],
       ["clone", "https://github.com/contributor/my-project.git"],
       ["p", "<maintainer-pubkey>"],
       ["subject", "Add WebSocket reconnection with exponential backoff"],
       ["branch-name", "feature/ws-reconnect"]
     ]
   }
   ```

3. **Sign the event.**

4. **Calculate the fee.** A PR is approximately 400-1000 bytes (~$0.004-$0.01).

5. **Publish via `publishEvent()`** from `@toon-protocol/client`.

6. **Push the tip to `refs/nostr/<event-id>`** so reviewers can fetch it by event ID.

### Considerations

- Use PRs instead of patches for large contributions -- the markdown description is much cheaper than embedding the full diff.
- Write a clear subject line and description. Reviewers see this before fetching the code.
- Include at least one clone URL so reviewers can fetch the branch.

## Scenario 5: Opening an Issue (kind:1621)

**When:** Someone wants to report a bug, request a feature, or open a discussion topic on a repository.

### Steps

1. **Construct the kind:1621 event:**
   ```json
   {
     "kind": 1621,
     "content": "## Bug Report\n\n**Expected:** Parser handles empty input gracefully\n**Actual:** Throws uncaught TypeError on line 42\n\n## Steps to Reproduce\n\n1. Call `parse('')`\n2. Observe TypeError: Cannot read property 'length' of undefined\n\n## Environment\n\n- Node.js 20.11\n- Package version 1.2.3",
     "tags": [
       ["a", "30617:<maintainer-pubkey>:my-project"],
       ["p", "<maintainer-pubkey>"],
       ["subject", "Parser crashes on empty input"],
       ["t", "bug"]
     ]
   }
   ```

2. **Sign, calculate fee (~300-2000 bytes, ~$0.003-$0.02), and publish** via `publishEvent()`.

### Considerations

- Use the `subject` tag for a clear title. It costs a few extra bytes but aids discoverability.
- Add `t` tags for labels (`bug`, `enhancement`, `question`) to help maintainers triage.
- On TOON, detailed issues cost more but are more valuable. Include reproduction steps.

## Scenario 6: Commenting on a PR (kind:1622)

**When:** A reviewer wants to provide feedback on a pull request, patch, or issue.

### Steps

1. **Construct the kind:1622 event:**
   ```json
   {
     "kind": 1622,
     "content": "The backoff logic looks correct, but consider capping the retry count at 5 to avoid infinite reconnection attempts in network-down scenarios. Also, the `maxDelay` of 30s seems reasonable for most use cases.\n\nSuggested change in `reconnect()`:\n```ts\nif (this.retryCount >= this.maxRetries) {\n  this.emit('connection-failed');\n  return;\n}\n```",
     "tags": [
       ["e", "<pr-event-id>", "", "reply"],
       ["p", "<pr-author-pubkey>"],
       ["a", "30617:<maintainer-pubkey>:my-project"]
     ]
   }
   ```

2. **Sign, calculate fee (~200-1000 bytes, ~$0.002-$0.01), and publish** via `publishEvent()`.

### Considerations

- Consolidate feedback into one detailed comment rather than many short ones. Each event has fixed tag overhead on top of content costs.
- Include specific suggestions with code snippets. Constructive feedback is worth the per-byte cost.
- Use the `a` tag for repository context so clients can display the comment in the right repository.

## Scenario 7: Uploading Git Objects to Arweave (kind:5094)

**When:** A maintainer or contributor wants to store git objects permanently on Arweave for decentralized access.

**Why this matters:** Arweave provides permanent, content-addressed storage for git objects. Combined with NIP-34 repository announcements and state, this enables fully decentralized git hosting without dependence on any single server.

### Steps

1. **Extract the git object.** Use `git cat-file -p <sha>` to get the object content.

2. **Construct the kind:5094 DVM job request.** Content is empty; blob data goes in the `i` tag as base64:
   ```json
   {
     "kind": 5094,
     "content": "",
     "tags": [
       ["i", "<base64-encoded-git-object>", "blob"],
       ["bid", "<amount>", "usdc"],
       ["output", "application/octet-stream"],
       ["Git-SHA", "abc123def456..."],
       ["Git-Type", "blob"],
       ["Repo", "my-project"]
     ]
   }
   ```

3. **Sign, calculate fee, and publish** via `publishEvent()`. The TOON relay fee covers the Nostr event; Arweave storage is handled by the DVM provider.

4. **Wait for DVM response.** The DVM provider uploads to Arweave and publishes a result event with the Arweave transaction ID.

5. **Resolve the object.** Use Arweave GraphQL to query by `Git-SHA` tag, or access directly via `https://arweave.net/<tx-id>`.

### Upload Flows by Object Type

**Blob (file content):**
```json
{"content": "", "tags": [["i", "<base64>", "blob"], ["bid", "<amount>", "usdc"], ["output", "application/octet-stream"], ["Git-SHA", "<sha>"], ["Git-Type", "blob"], ["Repo", "my-project"]]}
```

**Tree (directory listing):**
```json
{"content": "", "tags": [["i", "<base64>", "blob"], ["bid", "<amount>", "usdc"], ["output", "application/octet-stream"], ["Git-SHA", "<sha>"], ["Git-Type", "tree"], ["Repo", "my-project"]]}
```

**Commit (commit object):**
```json
{"content": "", "tags": [["i", "<base64>", "blob"], ["bid", "<amount>", "usdc"], ["output", "application/octet-stream"], ["Git-SHA", "<sha>"], ["Git-Type", "commit"], ["Repo", "my-project"]]}
```

### Considerations

- Free uploads up to 100KB via `TurboFactory.unauthenticated()` in dev mode.
- For production, use authenticated uploads via `@ardrive/turbo-sdk` with a funded wallet.
- Git objects are content-addressed by SHA hash. The same object uploaded twice resolves to the same Arweave transaction.
- Upload objects bottom-up: blobs first, then trees, then commits. This ensures all referenced objects exist before the referencing object.
