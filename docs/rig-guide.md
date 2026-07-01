# Rig Guide

The Rig (`@toon-protocol/rig`) is a **decentralized control plane** for the TOON Protocol that runs entirely in the browser as a static SPA — no backend, no accounts, no servers.

Mechanically, the Rig is just a frontend that **interprets events**. State on TOON lives as Nostr events carried over the wire as packets — writes are ILP-paid PREPARE packets into a relay, reads are free WebSocket subscriptions — and the bulky git objects (commits, trees, blobs) are fetched from Arweave gateways. The Rig subscribes, decodes those events, and renders them. There is no server deciding what the data means; the frontend does.

The Rig itself can be deployed to Arweave, making the entire stack — data and UI — permanent and decentralized.

The UI is branded **"The Rig"** (a cleanup PR is renaming the remaining "TOON Forge" branding in the header and page title to match).

## Not a GitHub clone

Today the Rig interprets the **NIP-34 git event vocabulary** (repository announcements, refs, issues, patches) backed by git objects stored on Arweave, so it *presents* as a read-only git forge. But it is not a GitHub clone, and "git host" is not the ceiling of what it is:

- **The data is events, not a repository on a server.** Repos, refs, issues, and PRs are all Nostr events delivered as packets. No origin server holds the canonical state — the relay plus Arweave are the substrate, and any frontend can subscribe to the same events and interpret them however it wants.
- **NIP-34 is one vocabulary, not the product.** The git kinds are simply the first event schema the Rig knows how to render. The same subscribe-decode-render engine can drive any coordination surface built from TOON events.
- **Because it lives on TOON Protocol, it is a decentralized control plane.** Paid, signed, permanent events + a frontend that interprets them gives you a way to observe and coordinate distributed state — repositories today; agents, deployments, and other resources next — with no central control server. The git forge is the first *view* onto that control plane, not its definition.

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

### Deploy

The build output is a plain static directory — serve `packages/rig/dist/` from any static host (nginx, Caddy, object storage, an Arweave gateway).

For a fully decentralized deployment, upload the built files to Arweave (e.g. via ArDrive Turbo) and create a path manifest; the manifest's transaction ID then serves the entire app from any gateway:

```
https://ar-io.dev/<manifest-txId>/#relay=wss://relay.example
```

> Note: the old dedicated deploy script (`scripts/deploy-forge-ui.mjs`) no longer ships in `toon-client` — deployment is just "build, then publish `dist/`" via whatever static/Arweave tooling you prefer.

Bake in a default relay at build time:

```bash
VITE_DEFAULT_RELAY=wss://relay.toon-protocol.org pnpm build
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

**Arweave Gateways (HTTPS)** — the gateway preference list is no longer hardcoded in the Rig: it is owned by the shared **`@toon-protocol/arweave`** package (the single source of truth for gateway ordering and fetch timeouts, also used by `views` and the `client-mcp` daemon). The default order is `ar-io.dev` (primary) → `arweave.net` → `permagate.io`, with automatic failover. The list can be overridden — the `client-mcp` daemon honors the `TOON_CLIENT_ARWEAVE_GATEWAYS` env var (comma-separated); the browser Rig uses the package defaults.

SHA-to-txId resolution uses Arweave GraphQL, filtered by `Git-SHA` and `Repo` tags. Results are cached in-memory (bounded to 10,000 entries). When `kind:30618` events include `arweave` tags with pre-mapped SHA→txId pairs, the Rig seeds its cache directly — avoiding the GraphQL indexing delay after fresh uploads.

### Browser-Only Stack

The Rig was rewritten as a **React 19 + shadcn/ui SPA** (React Router 7, Radix UI primitives, Tailwind CSS 4, Shiki for syntax highlighting), sharing `@toon-protocol/views` components and the `@toon-protocol/arweave` gateway package. `@toon-format/toon` decodes TOON-format relay responses.

What still matters is what *hasn't* changed: it is **browser-only**. There is no backend, no server-side rendering, no Node.js runtime — the build output is static files, and all data access is native `fetch()` (Arweave) and `WebSocket` (relay) from the browser. No origin server holds or interprets the state.

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

Write operations go through a TOON client paying the connector payment proxy: NIP-34 events are published to the relay (paid ILP writes), and git objects are uploaded to the Arweave store (a paid `POST /store` to the payment-oblivious store backend behind the proxy). The Rig itself stays read-only — clients that hold keys and pay (CLI / MCP) do the writing.

## Agent Orchestration — the Next Vocabulary

NIP-34 git is the Rig's first event vocabulary, not its last. The **verifiable swarm-market epic** ([toon-meta#84](https://github.com/toon-protocol/toon-meta/issues/84)) is the incentive layer of this same control plane: propositions about agent work ("bug #142 merged by Friday") become parimutuel markets whose stakes stay escrowed in the betters' own payment channels, and **resolver DVMs** decide the outcome by evaluating a frozen predicate over the signed NIP-34 event log — the **same events the Rig renders are the oracle log**. A worker's YES bet doubles as task claim, lock, and delivery bond; doubters' NO stakes fund the work.

Nothing new is needed on the read side: the Rig remains the read-only view onto that control plane, rendering the tasks, claims, and lifecycle events that the resolvers later read as evidence. Writes (bets, claims, work products) happen via CLI/MCP clients that hold keys and pay over ILP, exactly as with git writes above.
