# TOON Extensions for Git Collaboration

> **Why this reference exists:** NIP-34 git collaboration interacts with TOON's ILP-gated economics in ways that create unique dynamics absent from free Nostr relays. Patches cost per-byte so large diffs are expensive, incentivizing focused contributions. Repository announcements are economic commitments to maintaining a project. Comments cost money, encouraging substantive code review. This file covers the TOON-specific publishing flow, fee tables, and economic implications for each git collaboration event kind.

## Publishing Git Events on TOON

All git collaboration event publishing on TOON goes through `publishEvent()` from `@toon-protocol/client`. Raw WebSocket writes are rejected -- the relay requires ILP payment for every event.

### General Publishing Flow

1. **Construct the event:** Build the appropriate kind with required tags and content per nip-spec.md
2. **Sign the event:** Use nostr-tools or equivalent to sign with the agent's private key
3. **Discover pricing:** Check the relay's `basePricePerByte` from kind:10032 peer info or the `/health` endpoint
4. **Calculate fee:** `basePricePerByte * serializedEventBytes`
5. **Sign a balance proof:** `client.signBalanceProof(channelId, amount)`
6. **Publish:** `client.publishEvent(signedEvent, { destination, claim })`

### Error Handling

- **F04 (Insufficient Payment):** The calculated amount was too low. Recalculate with actual serialized size.
- **Relay rejection:** The relay may reject events for protocol reasons (missing required tags, invalid content format). Check the error message for specifics.

## Fee Tables by Event Kind

Default `basePricePerByte` = 10n ($0.00001/byte).

### Repository Management

| Kind | Event | Approximate Size | Cost at 10n/byte |
|------|-------|-----------------|------------------|
| 30617 | Repo announcement (minimal) | ~300-400 bytes | ~$0.003-$0.004 |
| 30617 | Repo announcement (full metadata) | ~400-500 bytes | ~$0.004-$0.005 |
| 30618 | Repo state (few branches) | ~200-400 bytes | ~$0.002-$0.004 |
| 30618 | Repo state (many branches/tags) | ~400-800 bytes | ~$0.004-$0.008 |

Repository announcements and state are parameterized replaceable events. Updates replace the previous version at the same per-byte cost -- you do not accumulate costs from previous versions.

### Code Contribution

| Kind | Event | Approximate Size | Cost at 10n/byte |
|------|-------|-----------------|------------------|
| 1617 | Patch (small fix, <50 lines) | ~500-2000 bytes | ~$0.005-$0.02 |
| 1617 | Patch (medium feature) | ~2000-10000 bytes | ~$0.02-$0.10 |
| 1617 | Patch (large refactor) | ~10000-50000 bytes | ~$0.10-$0.50 |
| 1618 | Pull request | ~400-1000 bytes | ~$0.004-$0.01 |
| 1619 | PR update | ~300-500 bytes | ~$0.003-$0.005 |

Patches (kind:1617) are the most expensive git collaboration events because the content contains full `git format-patch` output. Keep diffs minimal and focused. A 50KB patch costs ~$0.50, so splitting large changes into smaller patches saves money and improves reviewability.

Pull requests (kind:1618) are cheaper because content is just a markdown description, not the full diff. The actual code is fetched via the clone URL.

### Issue Tracking

| Kind | Event | Approximate Size | Cost at 10n/byte |
|------|-------|-----------------|------------------|
| 1621 | Issue (concise bug report) | ~300-800 bytes | ~$0.003-$0.008 |
| 1621 | Issue (detailed with reproduction steps) | ~800-2000 bytes | ~$0.008-$0.02 |
| 1622 | Comment (short feedback) | ~200-400 bytes | ~$0.002-$0.004 |
| 1622 | Comment (detailed code review) | ~400-1000 bytes | ~$0.004-$0.01 |

Issues and comments cost per-byte, incentivizing focused, substantive content. A detailed issue with reproduction steps costs more but is more valuable than a vague one-liner.

### Lifecycle Status

| Kind | Event | Approximate Size | Cost at 10n/byte |
|------|-------|-----------------|------------------|
| 1630 | Status: Open | ~200-300 bytes | ~$0.002-$0.003 |
| 1631 | Status: Applied/Merged (with commit refs) | ~300-400 bytes | ~$0.003-$0.004 |
| 1632 | Status: Closed | ~200-300 bytes | ~$0.002-$0.003 |
| 1633 | Status: Draft | ~200-300 bytes | ~$0.002-$0.003 |

Status events are the cheapest git collaboration events. Lifecycle management is affordable even for active projects with many open PRs and issues.

### Arweave Blob Storage

| Kind | Event | Approximate Size | Cost at 10n/byte |
|------|-------|-----------------|------------------|
| 5094 | Small blob (<1KB) | ~500-1500 bytes | ~$0.005-$0.015 |
| 5094 | Medium blob (1-10KB) | ~1500-12000 bytes | ~$0.015-$0.12 |
| 5094 | Large blob (10-100KB) | ~12000-110000 bytes | ~$0.12-$1.10 |

Kind:5094 DVM requests carry the git object as content. The TOON relay fee covers the Nostr event publication; the Arweave storage fee is separate and handled by the DVM provider. Free uploads up to 100KB are available in dev mode via `TurboFactory.unauthenticated()`.

## Git-Specific TOON Dynamics

### Patches Cost Per-Byte: Keep Diffs Minimal

The most important TOON dynamic for git collaboration: patches (kind:1617) contain full `git format-patch` output in the event content. Every byte of diff, commit message, and patch metadata costs money. This creates strong economic incentives:

- **Split large changes into focused patches.** A 50KB monolithic patch costs ~$0.50. Five 10KB patches cost ~$0.50 total but are individually reviewable.
- **Avoid unnecessary whitespace changes.** Reformatting files inflates patch size without adding value.
- **Write concise commit messages.** The commit message is part of the patch content and costs per-byte.
- **Use PRs for large contributions.** A kind:1618 PR is cheaper (~$0.004-$0.01) because the content is just a markdown description. Reviewers fetch the actual code via the clone URL.

### Replaceable Events Save Money

Repository announcements (kind:30617) and state (kind:30618) are parameterized replaceable events. When you update repository metadata or publish new branch heads, the new event replaces the old one. You pay only for the current version, not accumulated history.

### Comments as Investment

On free Nostr relays, comments are cheap and often low-quality. On TOON, every comment (kind:1622) costs per-byte. This economic friction encourages:

- **Substantive code review** over drive-by "LGTM" comments
- **Consolidated feedback** (one detailed comment instead of many small ones)
- **Constructive criticism** with suggested fixes rather than vague complaints

### Status Events Are Cheap

Status events (kind:1630-1633) are small (~200-400 bytes) and affordable (~$0.002-$0.004). Lifecycle management should never be avoided due to cost concerns. Close resolved issues, merge applied patches, and mark works-in-progress as draft.

## Reading Git Events on TOON

Reading is free on TOON. Use NIP-01 filters to subscribe to git collaboration events.

### Common Filters

**Discover repositories:**
```json
{"kinds": [30617]}
```

**Get a specific repository's state:**
```json
{"kinds": [30618], "authors": ["<maintainer-pubkey>"], "#d": ["<repo-id>"]}
```

**Get all patches for a repository:**
```json
{"kinds": [1617], "#a": ["30617:<pubkey>:<repo-id>"]}
```

**Get all PRs for a repository:**
```json
{"kinds": [1618], "#a": ["30617:<pubkey>:<repo-id>"]}
```

**Get all issues for a repository:**
```json
{"kinds": [1621], "#a": ["30617:<pubkey>:<repo-id>"]}
```

**Get comments on a specific issue/PR/patch:**
```json
{"kinds": [1622], "#e": ["<event-id>"]}
```

**Get status of a specific event:**
```json
{"kinds": [1630, 1631, 1632, 1633], "#e": ["<event-id>"]}
```

**Get Arweave blobs for a repository:**
```json
{"kinds": [5094], "#Repo": ["<repo-id>"]}
```

TOON relays return TOON-format strings in EVENT messages, not standard JSON objects. Use the TOON decoder to parse event data.

For full TOON format parsing details, read `.claude/skills/nostr-protocol-core/references/toon-protocol-context.md`.
