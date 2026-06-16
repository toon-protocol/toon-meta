# Git Identity Scenarios

> **Why this reference exists:** Agents need step-by-step workflows for verifying identity, checking authorization, mapping pubkeys to git authors, and managing maintainer lists. Each scenario shows the complete flow from the question ("can this pubkey merge?") to the answer, including the TOON relay interactions and cost implications.

## Scenario 1: Verify Maintainer Status

**When:** An agent needs to check whether a specific pubkey has maintainer authority for a repository before trusting a merge event or deciding whether to publish a status event.

**Why this matters:** Trusting an unauthorized kind:1631 (merge) event could lead to accepting unreviewed code. On TOON, reading the repository announcement to verify maintainer status is free.

### Steps

1. **Identify the repository address.** The repository address format is `30617:<creator-pubkey>:<d-tag-value>`. You need the creator's pubkey and the repository's `d` tag identifier.

2. **Subscribe to the repository announcement.** Query the relay for kind:30617 with the creator's pubkey as the author and the repository identifier as the `#d` filter:
   ```json
   ["REQ", "sub-id", { "kinds": [30617], "authors": ["<creator-pubkey>"], "#d": ["<repo-id>"] }]
   ```
   This is a read operation -- free on TOON.

3. **Extract the maintainer list.** From the returned kind:30617 event:
   - The event's `pubkey` field is the creator (always a maintainer).
   - Find the `maintainers` tag: `["maintainers", "<pk1>", "<pk2>", ...]`.
   - If no `maintainers` tag exists, only the creator has maintainer authority.

4. **Check the target pubkey.** The pubkey is a maintainer if:
   - It matches the event's `pubkey` field (creator), OR
   - It appears in the `maintainers` tag values.

5. **Cache the result.** Subscribe to kind:30617 updates for the repository to detect maintainer list changes. The maintainer list can change at any time via a republished kind:30617.

### Cost

Zero. Maintainer verification is purely a read operation.

## Scenario 2: Check Merge Permission Before Publishing

**When:** An agent wants to publish a kind:1631 (applied/merged) status event and needs to confirm it has the authority to do so.

**Why this matters:** Publishing an unauthorized merge event wastes ILP payment (the relay accepts it but clients should ignore it) and pollutes the event stream. Checking first avoids wasting money.

### Steps

1. **Determine the agent's pubkey.** The agent's signing key determines its pubkey.

2. **Verify maintainer status.** Follow Scenario 1 to check whether the agent's pubkey is in the maintainer list.

3. **If authorized, publish the merge event:**
   ```javascript
   const mergeEvent = {
     kind: 1631,
     content: '',
     tags: [
       ['e', '<target-event-id>', '<relay-url>', 'root'],
       ['e', '<target-event-id>', '<relay-url>', 'reply'],
       ['p', '<target-event-author>'],
       ['k', '<target-event-kind>'],  // '1617' for patch, '1618' for PR
       // For patches: applied-as-commits tags
       ['applied-as-commits', '<commit-sha-1>', '<commit-sha-2>']
     ]
   };
   await client.publishEvent(mergeEvent);
   ```

4. **If not authorized, do not publish.** Instead, consider:
   - Commenting (kind:1622) with a review approval -- anyone can comment.
   - Reacting (kind:7) with a positive reaction -- anyone can react.
   - Contacting a maintainer to request the merge.

### Cost

- Checking permission: free (read).
- Publishing the merge event (if authorized): ~$0.002-$0.004 at default pricing (status events are small).
- Publishing an unauthorized merge event: same cost, but wasted -- clients will ignore it.

## Scenario 3: Map Nostr Pubkey to Git Author

**When:** An agent is constructing a git commit object and needs to fill in the author and committer fields using Nostr identity.

**Why this matters:** The `<pubkey>@nostr` email convention ensures that git tools can display the identity and that the commit is traceable back to the Nostr pubkey. Using a consistent convention enables cross-repository identity resolution.

### Steps

1. **Get the hex pubkey.** The pubkey is always available from the Nostr event or the agent's keypair. It is a 64-character hex string.

2. **Optionally resolve a display name.** Query the relay for the kind:0 profile:
   ```json
   ["REQ", "sub-id", { "kinds": [0], "authors": ["<pubkey>"] }]
   ```
   If a kind:0 exists, parse the JSON content for `display_name` or `name` fields.

3. **Construct the author line.** Use the resolution priority:
   - If `display_name` exists: `author <display_name> <<pubkey>@nostr> <timestamp> +0000`
   - If only `name` exists: `author <name> <<pubkey>@nostr> <timestamp> +0000`
   - If no profile: `author <pubkey> <<pubkey>@nostr> <timestamp> +0000`

4. **Construct the committer line.** For most cases, use the same identity as the author. For merge commits, the committer is the maintainer performing the merge, and the author is the patch/PR contributor.

5. **Use UTC timezone.** The convention for Nostr-native commits is `+0000` (UTC). The timestamp is Unix epoch seconds from the event's `created_at` or the current time.

### Cost

- Resolving the display name: free (read from relay).
- The git author mapping itself has no direct cost -- it affects the commit object size, which affects the kind:5094 upload cost.

## Scenario 4: Manage the Maintainer List

**When:** A repository creator needs to add or remove maintainers from their repository.

**Why this matters:** The maintainer list controls who can merge patches and close issues. Adding an untrusted maintainer is a security risk. On TOON, each maintainer list update costs per-byte because the entire kind:30617 event must be republished.

### Steps

#### Adding a Maintainer

1. **Fetch the current kind:30617 event.** Subscribe to your own repository announcement:
   ```json
   ["REQ", "sub-id", { "kinds": [30617], "authors": ["<your-pubkey>"], "#d": ["<repo-id>"] }]
   ```

2. **Verify the new maintainer's identity.** Before adding a pubkey:
   - Check their kind:0 profile for NIP-05 verification.
   - Review their contribution history (patches, PRs, comments).
   - Confirm the pubkey through an out-of-band channel if possible.

3. **Construct the updated event.** Copy all existing tags from the current kind:30617. Update the `maintainers` tag to include the new pubkey:
   ```json
   ["maintainers", "<existing-pk-1>", "<existing-pk-2>", "<new-pk>"]
   ```

4. **Publish via `publishEvent()`.** The new event replaces the old one because kind:30617 is parameterized replaceable (same `d` tag + same author = replacement).

#### Removing a Maintainer

1. **Fetch the current kind:30617 event** (same as above).

2. **Construct the updated event.** Remove the target pubkey from the `maintainers` tag. If the `maintainers` tag would be empty, omit it entirely (the creator is always implicitly a maintainer).

3. **Publish via `publishEvent()`.** The removal is immediate -- the old event is replaced.

**Important:** Only the repository creator (the pubkey that originally signed the kind:30617) can update the maintainer list. A maintainer who is not the creator cannot modify the list.

### Cost

Each maintainer list update costs `basePricePerByte * serializedEventBytes`. A typical kind:30617 event is 500-2000 bytes, costing ~$0.005-$0.02 at default pricing. The cost is the same whether adding or removing -- the full event is republished.

## Scenario 5: Validate a Status Event Chain

**When:** An agent encounters multiple conflicting status events for a patch or PR and needs to determine the canonical status.

**Why this matters:** Multiple status events can exist for the same target -- an author might re-open a closed issue, or a maintainer might close a PR that another maintainer re-opened. The correct status is determined by authorization rules and timestamps.

### Steps

1. **Fetch all status events for the target.** Subscribe to kind:1630-1633 referencing the target event:
   ```json
   ["REQ", "sub-id", { "kinds": [1630, 1631, 1632, 1633], "#e": ["<target-event-id>"] }]
   ```

2. **Fetch the repository announcement** to get the maintainer list (Scenario 1).

3. **Fetch the target event** to identify the original author.

4. **Filter for authorized events.** For each status event, check:
   - kind:1630 (open): author must be the target event author OR a maintainer.
   - kind:1631 (merged): author must be a maintainer.
   - kind:1632 (closed): author must be the target event author OR a maintainer.
   - kind:1633 (draft): author must be the target event author.
   - Discard any status event from an unauthorized pubkey.

5. **Select the most recent authorized event.** Among the remaining events, the one with the highest `created_at` timestamp is the canonical status.

6. **Handle timestamp ties.** If two authorized status events share the same `created_at`, use the lexicographically lower event ID as a tiebreaker.

### Cost

Zero for reading the status chain. The relay serves these events for free.
