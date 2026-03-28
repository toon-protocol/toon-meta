---
name: git-identity
description: Git identity and authorization on Nostr and TOON Protocol. Covers
  pubkey-only identity ("how does git identity work on Nostr?", "pubkey git identity",
  secp256k1 keypair, no email/password), maintainer authorization ("maintainer
  authorization", "who can merge on Nostr?", kind:30617 maintainers tag, authorized
  pubkeys), permission model ("git permissions on TOON", "who can submit a patch?",
  anyone can contribute, only maintainers merge/close), Nostr pubkey to git author
  mapping ("how do I map a pubkey to a git author?", "<pubkey>@nostr", hex pubkey
  author), and fork identity ("how do personal forks work?", "personal-fork" tag,
  fork identity). Implements the identity and authorization layer of NIP-34 on
  TOON's ILP-gated relay network where identity verification is free (read) but
  maintainer list updates cost per-byte.
---

# Git Identity (TOON)

Identity and authorization model for decentralized git collaboration on the TOON network. Covers how Nostr's pubkey-only identity maps to git concepts, how maintainer authorization works via kind:30617's `maintainers` tag, the permission model for all NIP-34 operations, the convention for mapping Nostr pubkeys to git author fields, and how personal forks establish independent identity. On TOON, verifying someone's identity or checking their maintainer status is free (reading), but updating the maintainer list costs per-byte because it requires republishing the kind:30617 repository announcement.

## Identity Model

Nostr uses secp256k1 keypairs for identity. There are no usernames, emails, or passwords -- the 32-byte hex pubkey IS the identity. This maps cleanly to git collaboration:

- **Every event is signed** by the author's private key. The pubkey in the event header is cryptographically bound to the content. No impersonation is possible without the private key.
- **No registration** is needed. Anyone with a keypair can submit patches, open issues, or comment. The relay does not maintain an account database.
- **Identity is portable.** The same keypair works across all relays. A contributor's history follows their pubkey, not a relay-specific account.
- **Display names are optional.** A kind:0 profile can attach a human-readable name, but the pubkey remains the canonical identifier. Two users can have the same display name -- the pubkey disambiguates.

## Maintainer Authorization

The kind:30617 repository announcement includes an optional `maintainers` tag listing authorized pubkeys:

```
["maintainers", "<pubkey-hex-1>", "<pubkey-hex-2>", ...]
```

Maintainer status grants two exclusive privileges:

1. **Merge** (kind:1631) -- Only maintainers can publish "applied/merged" status events for patches and PRs.
2. **Close** (kind:1632) -- Only maintainers can close patches, PRs, and issues they did not author.

The repository creator (the pubkey that signed the kind:30617 event) is always implicitly a maintainer, even if not listed in the `maintainers` tag. Maintainer pubkeys are hex-encoded (64 characters), not npub-encoded.

**Updating the maintainer list** requires republishing the entire kind:30617 event with the updated `maintainers` tag. Because kind:30617 is a parameterized replaceable event, the new version replaces the old one. On TOON, this costs `basePricePerByte * serializedEventBytes`.

## Permission Model

NIP-34 defines a clear permission matrix based on identity:

| Operation | Who Can Do It | Event Kind |
|-----------|---------------|------------|
| Announce a repository | Anyone (becomes creator) | kind:30617 |
| Update repository state | Repository creator only | kind:30618 |
| Submit a patch | Anyone | kind:1617 |
| Open a pull request | Anyone | kind:1618 |
| Update a PR | PR author only | kind:1619 |
| Open an issue | Anyone | kind:1621 |
| Comment on anything | Anyone | kind:1622 |
| Set status to "open" | Author or maintainer | kind:1630 |
| Merge (applied) | Maintainer only | kind:1631 |
| Close | Author or maintainer | kind:1632 |
| Set draft | Author only | kind:1633 |

**Key rules:**

- **Anyone can contribute.** Patches (kind:1617), PRs (kind:1618), issues (kind:1621), and comments (kind:1622) are permissionless. On TOON, the ILP payment is the only barrier -- no access control list is needed.
- **Only maintainers control merges.** A non-maintainer publishing a kind:1631 event is invalid -- clients should ignore it.
- **Authors control their own items.** A patch author can close their own patch. An issue author can close their own issue. But they cannot merge -- that requires maintainer status.
- **The most recent valid status wins.** When multiple status events exist for the same target, the most recent one from an authorized pubkey (maintainer or author, depending on the operation) is canonical.

## Nostr Pubkey to Git Author Mapping

When constructing git commit objects for Nostr-based collaboration, the convention maps Nostr identity to git author fields:

- **Author name:** The hex pubkey, or a `name`/`display_name` from the user's kind:0 profile if available.
- **Author email:** `<hex-pubkey>@nostr` -- a synthetic email address that encodes the Nostr identity.

```
author abc123...def456 <abc123...def456@nostr> 1711500000 +0000
committer abc123...def456 <abc123...def456@nostr> 1711500000 +0000
```

If a kind:0 profile provides a display name:

```
author Alice <abc123...def456@nostr> 1711500000 +0000
```

The `@nostr` email convention ensures that git tools (log, blame, shortlog) can display a recognizable identity while preserving the cryptographic binding to the Nostr pubkey. The email field is the authoritative identifier -- the name field is cosmetic.

## Fork Identity

Personal forks use the `["t", "personal-fork"]` topic tag on their kind:30617 announcement. This distinguishes forks from original repositories:

- A fork's kind:30617 has a different author pubkey than the upstream repository.
- The `personal-fork` tag signals that this is a derived project, not an independent creation.
- Fork maintainer lists are independent -- the fork creator controls their own `maintainers` tag.
- PRs from forks reference the upstream repository via the `a` tag on the kind:1618 event.

## TOON Write Model

Identity-related writes on TOON go through `publishEvent()` from `@toon-protocol/client`. The key write operation is updating the `maintainers` tag by republishing kind:30617. Never use raw WebSocket writes -- the relay requires ILP payment.

**Fee implications:**
- Updating the maintainer list requires republishing the entire kind:30617 event (~500-2000 bytes, ~$0.005-$0.02 at default pricing).
- Status events (kind:1630-1633) that enforce authorization are small and cheap (~$0.002-$0.004).
- Submitting patches, PRs, and issues costs per-byte regardless of identity -- anyone pays the same rate.

For the full fee formula and publishing flow, read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`.

## TOON Read Model

All identity verification is free on TOON -- reading events costs nothing:

- **Check maintainer status:** Subscribe to kind:30617 for the target repository, read the `maintainers` tag.
- **Verify event authorship:** Check the `pubkey` field of any event -- it is cryptographically signed.
- **Resolve display names:** Subscribe to kind:0 for a pubkey to get profile metadata.
- **Validate status events:** Check that the pubkey on a kind:1631 (merge) event belongs to a listed maintainer.

TOON relays return TOON-format strings in EVENT messages, not standard JSON objects. Use the TOON decoder to parse events. For TOON format parsing details, read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`.

## Social Context

Identity and authorization intersect with git collaboration norms. The pubkey-only model creates both freedom and responsibility.

**Maintainer governance:**
- Adding a maintainer is a trust decision. The maintainer list is publicly visible and cryptographically verifiable -- anyone can read the kind:30617 event to see who has merge authority.
- Removing a maintainer by republishing kind:30617 without their pubkey is immediate and unambiguous. There is no "revoke access" flow -- the updated event replaces the old one.
- Rotate maintainers thoughtfully. Each update costs money on TOON and requires republishing the full repository announcement.

**Permission boundaries:**
- Non-maintainers publishing merge events (kind:1631) is a protocol violation. Clients should ignore such events, but the relay will still accept and store them (the relay does not enforce authorization -- it only enforces ILP payment).
- Status wars (repeatedly re-opening/closing the same item) waste money on TOON. The per-byte cost discourages this, but maintainers should still be judicious.

**Identity trust signals:**
- A pubkey with a kind:0 profile, NIP-05 verification, and contribution history is more trustworthy than a bare pubkey with no history.
- The `maintainers` tag is the sole source of truth for merge authority -- social reputation is important but does not substitute for explicit authorization.

**Anti-patterns to avoid:**
- Adding untrusted pubkeys to the maintainer list -- a malicious maintainer can merge harmful patches
- Publishing merge events (kind:1631) without maintainer status -- these are invalid and waste ILP payment
- Assuming display names are unique or stable -- always verify by pubkey
- Ignoring the `personal-fork` tag when evaluating repository origin

For deeper social judgment guidance, see `nostr-social-intelligence`. For profile metadata and NIP-05 verification, see `social-identity`. For reaction mechanics on git collaboration events, see `social-interactions`.

## When to Read Each Reference

Read the appropriate reference file based on the situation:

- **Identity model, authorization rules, and the complete permission matrix** -- Read [nip-spec.md](references/nip-spec.md) for the full specification of how pubkey identity maps to git operations and who can do what.
- **Step-by-step workflows for verifying identity, checking permissions, and managing maintainers** -- Read [scenarios.md](references/scenarios.md) for verifying maintainer status, checking merge permission, mapping pubkeys to authors, and updating the maintainer list.
- **TOON-specific identity costs and read/write economics** -- Read [toon-extensions.md](references/toon-extensions.md) for identity verification costs (free reads), maintainer update costs, and the economic model of permissionless contribution.

### Cross-Skill References

- **Full NIP-34 git collaboration event kinds and workflows** -- See `git-collaboration` for kind:30617 repository announcements, patches, PRs, issues, comments, and status events.
- **Nostr profile metadata and NIP-05 DNS verification** -- See `social-identity` for kind:0 profiles, display names, and external identity linking that supplements pubkey identity.
- **TOON write model, read model, and fee calculation details** -- Read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md` (canonical protocol reference, D9-010).
- **Content control and event deletion** -- See `content-control` for NIP-09 deletion requests and NIP-70 protected events that interact with maintainer authority.
