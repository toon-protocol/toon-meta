# Git Identity and Authorization Specification

> **Why this reference exists:** Agents need to understand how Nostr's pubkey-only identity model maps to git collaboration concepts, who is authorized to perform which operations, and how the maintainer list in kind:30617 controls merge and close permissions. This file covers the identity model, authorization rules, and the complete permission matrix for NIP-34 operations.

## Identity Model

Nostr identity is a secp256k1 keypair. The 32-byte hex public key (64 hex characters) is the sole identifier. There is no registration, no email, no password, no OAuth flow. Identity properties:

| Property | Description |
|----------|-------------|
| **Keypair generation** | Generate a secp256k1 private key (32 random bytes). Derive the public key. The hex-encoded public key is the identity. |
| **Event signing** | Every Nostr event includes a `pubkey` field and a Schnorr signature (`sig`) over the event ID. The signature cryptographically binds the event to the author. |
| **No impersonation** | Without the private key, no one can produce a valid signature for a pubkey. Event authorship is unforgeable. |
| **Portability** | The same keypair works on any relay. Identity is not relay-specific -- a contributor's history follows their pubkey across the network. |
| **Display names** | Optional. A kind:0 profile event can attach a `name`, `display_name`, `picture`, and other metadata. But the pubkey remains the canonical identifier. Two users can share the same display name -- the pubkey disambiguates. |
| **NIP-05 verification** | Optional DNS-based verification (`user@domain`) that proves domain control. Does not affect authorization -- it is a trust signal only. |
| **npub encoding** | The hex pubkey can be encoded as an `npub1...` bech32 string (NIP-19) for human-readable display. The hex form is used in event tags and the `maintainers` tag. |

### Identity in Git Context

Traditional git uses name + email for author identity. Nostr-based git maps this differently:

| Git concept | Traditional | Nostr/NIP-34 |
|-------------|-------------|--------------|
| Author identity | `name <email>` | 32-byte hex pubkey (event `pubkey` field) |
| Authentication | SSH key, HTTPS token | Schnorr signature on every event |
| Authorization | Server-side ACLs | `maintainers` tag in kind:30617 |
| Account creation | Register on hosting platform | Generate a keypair locally |
| Identity verification | Email confirmation | NIP-05 DNS verification (optional) |
| Display name | Git config `user.name` | kind:0 profile `name` field (optional) |

## Maintainer Authorization

### The `maintainers` Tag

The kind:30617 repository announcement event may include a `maintainers` tag:

```json
["maintainers", "<pubkey-hex-1>", "<pubkey-hex-2>", "<pubkey-hex-3>"]
```

- Each value is a 64-character hex-encoded secp256k1 public key.
- The tag is optional. If omitted, only the repository creator (the event's `pubkey` field) has maintainer authority.
- The repository creator is always implicitly a maintainer, even if not listed in the `maintainers` tag.
- npub-encoded keys are NOT used in the `maintainers` tag -- always hex.

### Maintainer Verification Algorithm

To check if a pubkey has maintainer authority for a repository:

1. Fetch the most recent kind:30617 event for the repository (filter by `#d` tag and author pubkey).
2. Extract the `pubkey` field (repository creator) and the `maintainers` tag values.
3. The pubkey is a maintainer if:
   - It matches the event's `pubkey` field (creator), OR
   - It appears in the `maintainers` tag values.

```
isMaintainer(targetPubkey, repoEvent) =
  targetPubkey === repoEvent.pubkey ||
  repoEvent.tags.find(t => t[0] === 'maintainers')?.slice(1).includes(targetPubkey)
```

### Updating the Maintainer List

Because kind:30617 is a parameterized replaceable event, updating the maintainer list requires republishing the entire event with the same `d` tag. The new event replaces the old one. Steps:

1. Construct a new kind:30617 event with the same `d` tag as the existing announcement.
2. Include all existing tags (name, description, clone URLs, relays, etc.).
3. Set the `maintainers` tag to the updated list of hex pubkeys.
4. Sign and publish via `publishEvent()`.

Only the repository creator can update the announcement (it must be signed by the same pubkey). A maintainer who is not the creator cannot modify the maintainer list.

## Permission Matrix

The complete permission model for NIP-34 operations:

### Repository Management

| Operation | Event Kind | Who Can Do It | Authorization Check |
|-----------|------------|---------------|---------------------|
| Announce repository | kind:30617 | Anyone | No check -- the signer becomes the creator |
| Update announcement | kind:30617 | Creator only | Event must be signed by the original creator's pubkey |
| Publish repo state | kind:30618 | Creator only | Event must be signed by the original creator's pubkey |

### Code Contribution

| Operation | Event Kind | Who Can Do It | Authorization Check |
|-----------|------------|---------------|---------------------|
| Submit patch | kind:1617 | Anyone | No check -- permissionless |
| Open pull request | kind:1618 | Anyone | No check -- permissionless |
| Update PR branch tip | kind:1619 | PR author only | Event `pubkey` must match original kind:1618 `pubkey` |

### Issue Tracking

| Operation | Event Kind | Who Can Do It | Authorization Check |
|-----------|------------|---------------|---------------------|
| Open issue | kind:1621 | Anyone | No check -- permissionless |
| Comment | kind:1622 | Anyone | No check -- permissionless |

### Lifecycle Status

| Operation | Event Kind | Who Can Do It | Authorization Check |
|-----------|------------|---------------|---------------------|
| Set "open" | kind:1630 | Author or maintainer | `pubkey` is item author OR listed in `maintainers` |
| Set "applied/merged" | kind:1631 | Maintainer only | `pubkey` is in `maintainers` or is creator |
| Set "closed" | kind:1632 | Author or maintainer | `pubkey` is item author OR listed in `maintainers` |
| Set "draft" | kind:1633 | Author only | `pubkey` must match original item `pubkey` |

### Authorization Enforcement

**Critical:** The TOON relay does NOT enforce authorization rules. The relay accepts any validly signed event with sufficient ILP payment. Authorization is enforced at the client/application layer:

- Clients should verify that kind:1631 (merge) events come from a maintainer before treating them as authoritative.
- A non-maintainer publishing a kind:1631 event is a protocol violation, but the relay will still store it.
- The "most recent valid status wins" rule applies -- when conflicting status events exist, the most recent one from an authorized pubkey is canonical.

## Status Event Conflict Resolution

When multiple status events exist for the same target:

1. Filter to only status events referencing the target (via `e` tag).
2. For each status event, verify the author is authorized for that status type (see permission matrix).
3. Discard unauthorized status events (e.g., a non-maintainer's kind:1631).
4. Among the remaining authorized events, the one with the highest `created_at` timestamp wins.
5. If timestamps are equal, the event with the lexicographically lower event ID wins (tiebreaker).

## Fork Identity

Personal forks establish independent identity while maintaining a link to the upstream:

| Aspect | Original Repository | Personal Fork |
|--------|-------------------|---------------|
| Creator pubkey | Original maintainer | Fork creator |
| `d` tag | Original identifier | May reuse or create new |
| `maintainers` tag | Original team | Fork creator's team |
| `["t", "personal-fork"]` | Absent | Present |
| `a` tag on PRs | Self-referencing | Points to upstream `30617:<upstream-pubkey>:<repo-id>` |

The `personal-fork` tag signals to clients that this repository is derived from another project. It does not affect permissions -- the fork has its own independent maintainer list.

## Nostr Pubkey to Git Author Mapping

When constructing git commit objects for Nostr-native repositories:

### Convention

| Git field | Value | Source |
|-----------|-------|--------|
| Author name | Hex pubkey or kind:0 `name`/`display_name` | Pubkey is always available; kind:0 is optional |
| Author email | `<hex-pubkey>@nostr` | Synthetic email encoding Nostr identity |
| Committer name | Same as author (or maintainer's identity for merges) | Depends on who creates the merge commit |
| Committer email | `<hex-pubkey>@nostr` | Same convention |
| Timestamp | Unix epoch seconds | From the Nostr event `created_at` or current time |
| Timezone | `+0000` (UTC) | Convention for Nostr-native commits |

### Examples

Bare pubkey (no kind:0 profile):
```
author abc123def456...789 <abc123def456...789@nostr> 1711500000 +0000
committer abc123def456...789 <abc123def456...789@nostr> 1711500000 +0000
```

With kind:0 display name:
```
author Alice <abc123def456...789@nostr> 1711500000 +0000
committer Alice <abc123def456...789@nostr> 1711500000 +0000
```

Merge commit (maintainer as committer, patch author as author):
```
author PatchAuthor <patch-author-pubkey@nostr> 1711500000 +0000
committer MaintainerName <maintainer-pubkey@nostr> 1711500500 +0000
```

### Resolution Priority

1. If kind:0 profile has `display_name`, use it as the name field.
2. If kind:0 profile has `name` (but no `display_name`), use it.
3. If no kind:0 profile exists, use the hex pubkey as the name.
4. The email field always uses `<hex-pubkey>@nostr` regardless of profile availability.
