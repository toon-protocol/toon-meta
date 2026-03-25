# Rig Guide

The Rig (`@toon-protocol/rig`) is a decentralized, read-only git interface for the TOON Protocol. It runs entirely in the browser as a static SPA — no backend, no accounts, no servers. Repository metadata is fetched from TOON relays via Nostr events (NIP-34), and git objects (commits, trees, blobs) are fetched directly from Arweave gateways.

The Rig itself can be deployed to Arweave, making the entire stack — data and UI — permanent and decentralized.

## How It Works

```
Browser (The Rig)
├── WebSocket ──► TOON Relay            ← NIP-34 events (repos, refs, issues, PRs)
└── HTTPS ─────► Arweave Gateway        ← Git objects (commits, trees, blobs)
```

1. The Rig connects to a TOON relay via WebSocket
2. It queries for `kind:30617` (repository announcements) to discover repos
3. When you navigate into a repo, it fetches `kind:30618` (refs) to resolve branch names to commit SHAs
4. Commit SHAs are resolved to Arweave transaction IDs via GraphQL or pre-cached mappings from the refs event
5. Git objects are fetched from Arweave gateways and parsed in the browser

All reads are free — the relay is ILP-gated for writes, but subscriptions cost nothing.

## Quick Start

### Development

```bash
cd packages/rig
pnpm dev
```

Opens a Vite dev server. By default connects to `wss://localhost:7100` — override with `VITE_DEFAULT_RELAY`:

```bash
VITE_DEFAULT_RELAY=wss://relay.example pnpm dev
```

### Production Build

```bash
cd packages/rig
pnpm build
```

Output goes to `packages/rig/dist/` — a static directory you can serve from anywhere.

### Deploy to Arweave

```bash
# Free tier (testing, <=100KB per file)
node scripts/deploy-forge-ui.mjs --dev

# Paid (no size limit, requires Arweave JWK wallet with Turbo credits)
node scripts/deploy-forge-ui.mjs --wallet ~/.arweave/wallet.json --confirm

# Dry run (build only, no upload)
node scripts/deploy-forge-ui.mjs --dry-run
```

The deploy script builds the SPA, uploads each file to Arweave via ArDrive Turbo, and creates a path manifest. The result is a single Arweave transaction ID that serves the entire app:

```
https://ar-io.dev/<manifest-txId>/#relay=wss://relay.example
```

Bake in a default relay at build time:

```bash
VITE_DEFAULT_RELAY=wss://relay.toon-protocol.org node scripts/deploy-forge-ui.mjs --dev
```

## Relay Configuration

The Rig resolves its relay URL in priority order:

1. **URL hash fragment** — `#relay=wss://relay.example` (preferred — shareable, works on all Arweave gateways)
2. **Query parameter** — `?relay=wss://relay.example` (legacy — auto-migrated to hash)
3. **Build-time default** — `VITE_DEFAULT_RELAY` env var baked into the Vite build

The hash fragment is ideal for Arweave deployments because it's part of the URL (shareable, bookmarkable) but not sent to the server.

## Features

### Repository Browsing

| View | Route | Source |
|------|-------|--------|
| Repository list | `/` | `kind:30617` events from relay |
| File tree | `/<owner>/<repo>/tree/<ref>/<path>` | Git tree objects from Arweave |
| File content | `/<owner>/<repo>/blob/<ref>/<path>` | Git blob objects from Arweave |
| Commit log | `/<owner>/<repo>/commits/<ref>` | Commit chain walking on Arweave |
| Commit diff | `/<owner>/<repo>/commit/<sha>` | Unified diff between tree snapshots |
| Blame | `/<owner>/<repo>/blame/<ref>/<path>` | Per-line commit attribution |

### Issues and Pull Requests

| View | Route | Source |
|------|-------|--------|
| Issue list | `/<owner>/<repo>/issues` | `kind:1621` events |
| Issue detail | `/<owner>/<repo>/issues/<eventId>` | `kind:1621` + `kind:1622` comments |
| PR list | `/<owner>/<repo>/pulls` | `kind:1617` events |
| PR detail | `/<owner>/<repo>/pulls/<eventId>` | `kind:1617` + status (`kind:1630`-`1633`) |

PR status kinds follow NIP-34: `1630` (Open), `1631` (Applied/Merged), `1632` (Closed), `1633` (Draft).

### README Rendering

The Rig detects `README.md` (or `readme.md`, `README`, `README.txt`) in the repository root and renders it with full GitHub-Flavored Markdown support. HTML is sanitized — dangerous tags (`script`, `iframe`, `form`) and attributes (`on*` handlers, `javascript:` URLs) are stripped. Relative image paths are resolved through the git tree.

## Architecture

### Data Sources

**TOON Relay (WebSocket)** — The Rig queries for these Nostr event kinds:

| Kind | NIP | Purpose |
|------|-----|---------|
| `30617` | NIP-34 | Repository announcements (name, description, owner, branches) |
| `30618` | NIP-34 | Repository refs (branch → commit SHA mappings, optional Arweave txId cache) |
| `1621` | NIP-34 | Issues |
| `1622` | NIP-34 | Comments (on issues and PRs) |
| `1617` | NIP-34 | Patches / pull requests |
| `1630`-`1633` | NIP-34 | PR status (open, merged, closed, draft) |
| `0` | NIP-01 | User profiles (for display names) |

**Arweave Gateways (HTTPS)** — Git objects are fetched with fallback across three gateways:

1. `ar-io.dev` (primary)
2. `arweave.net` (fallback)
3. `permagate.io` (fallback)

SHA-to-txId resolution uses Arweave GraphQL, filtered by `Git-SHA` and `Repo` tags. Results are cached in-memory (bounded to 10,000 entries). When `kind:30618` events include `arweave` tags with pre-mapped SHA→txId pairs, the Rig seeds its cache directly — avoiding the GraphQL indexing delay after fresh uploads.

### No External Dependencies

The Rig has exactly two runtime dependencies:

- `@toon-format/toon` — Decodes TOON format relay responses
- `marked` — Markdown rendering

No React, no framework, no nostr-tools, no Node.js APIs. Everything runs in the browser with native `fetch()` and `WebSocket`.

### Security

- **CSP headers** — `script-src 'self'` (no inline scripts), `connect-src` allowlisted to relay and Arweave gateway origins
- **HTML sanitization** — All user content (repo names, descriptions, issue bodies, comments) is escaped. Markdown rendering strips dangerous tags and attributes
- **GraphQL injection prevention** — SHA and repo strings are sanitized before inclusion in queries
- **Path traversal prevention** — URL path segments are validated; no `..` or absolute paths

## NIP-34 Event Structure

### Repository Announcement (`kind:30617`)

```json
{
  "kind": 30617,
  "tags": [
    ["d", "my-repo"],
    ["name", "My Repository"],
    ["description", "A decentralized project"],
    ["r", "main", "HEAD"],
    ["clone", "https://github.com/user/my-repo"],
    ["web", "https://my-repo.example"]
  ],
  "content": ""
}
```

### Repository Refs (`kind:30618`)

```json
{
  "kind": 30618,
  "tags": [
    ["d", "my-repo"],
    ["r", "main", "abc123..."],
    ["r", "develop", "def456..."],
    ["arweave", "abc123...", "ArweaveTxId1"],
    ["arweave", "def456...", "ArweaveTxId2"]
  ],
  "content": ""
}
```

The optional `arweave` tags map git SHAs to Arweave transaction IDs, allowing the Rig to skip GraphQL resolution for known objects.

## What's Not Implemented Yet

The Rig is currently **read-only**. These capabilities are stubbed for future phases:

- Creating repositories
- Filing issues and comments
- Submitting pull requests
- Git push / receive-pack
- Git clone / upload-pack (read-only serving)

Write operations will require a TOON client (with ILP payments) to publish NIP-34 events to the relay and upload git objects to Arweave via the blob storage DVM.
