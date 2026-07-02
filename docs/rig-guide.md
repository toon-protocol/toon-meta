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

All reads are free — the relay is ILP-gated for writes, but subscriptions cost nothing. The write side of the same substrate — how repos, issues, and PRs get *into* those events — is covered in [Writing to the Rig](#writing-to-the-rig--the-write-path) below.

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

## Writing to the Rig — the Write Path

The Rig SPA itself stays read-only — it holds no keys and pays for nothing. Writes come from **clients that hold keys and pay** the connector payment proxy: NIP-34 events are published to the relay (paid ILP writes), and git objects are uploaded to the Arweave store (a paid `POST /store` to the payment-oblivious store backend behind the proxy). That write path is **shipped** ([toon-client#222](https://github.com/toon-protocol/toon-client/issues/222)), on two surfaces:

- **The `rig` CLI** — shipped by [`@toon-protocol/git`](https://github.com/toon-protocol/toon-client/tree/main/packages/git): `rig push`, `rig issue create`, `rig comment`, `rig pr create`, `rig status`.
- **The `toon_git_*` MCP tools** — shipped by `@toon-protocol/client-mcp`, so Claude (Code or Desktop) drives the same path: `toon_git_push`, `toon_git_issue`, `toon_git_comment`, `toon_git_patch`, `toon_git_status`.

Both follow the same discipline: **estimate → confirm → execute**. Every write quotes its fee before spending, and every write is **permanent and non-refundable** — events cannot be unpublished, uploads cannot be deleted.

### Install & prerequisites

1. **Node 22+ and `git`** on PATH — the CLI reads your local repository with real git plumbing.
2. **The CLI:** `npm install -g @toon-protocol/git` (ships the `rig` bin).
3. **A TOON identity that can pay**, in one of two forms:
   - **Daemon** — a running `toon-clientd` (from `@toon-protocol/client-mcp`) on loopback. The daemon's key signs everything, so *the daemon identity is the repo owner*. This is also the identity the `toon_git_*` MCP tools use.
   - **Standalone** — your own BIP-39 seed phrase in `TOON_CLIENT_MNEMONIC` (or a `mnemonic`/`keystorePath` entry in `~/.toon-client/config.json`); an embedded client is built per run.

**Funding is owner-side — there is no x402 onboarding in this path.** The repo owner self-funds a payment channel before the first push, using the existing client flows: `toon_fund_wallet` (get funds onto the settlement chain) and `toon_open_channel` (open the channel writes spend from). `rig` then spends from the channel your daemon (or standalone identity) already holds; if you can `toon_publish`, you can `rig push`.

### First push

From inside any git repository:

```sh
rig push
```

The CLI picks a publisher mode (see [Limits & modes](#limits--modes-v1)), plans the push against the relay's current remote state, and renders the fee table before anything is spent:

```
Push plan for repo "demo" (daemon mode) — first push, will announce (kind:30617)
Refs:
  refs/heads/main  (none) → a1b2c3d  (create)
Objects: 9 to upload (14,210 bytes)
Fees (base units):
  upload   9 object(s), 14,210 bytes   14,210
  events   2 event(s)   4,000
  total    18,210
Writes are permanent and non-refundable.
Proceed with paid push (total 18210 base units)? [y/N]
```

On confirm, three things happen, in dependency-safe order:

1. **Object uploads** — each missing commit/tree/blob/tag is uploaded to the Arweave store as a paid `kind:5094` store write tagged `Git-SHA` / `Git-Type` / `Repo` (raw content only; the store re-derives the git envelope). Ref tips upload last, so a crashed push never leaves a ref pointing at a missing object — re-running resumes idempotently.
2. **`kind:30617` announcement** — first push only: the repository announcement that makes the repo appear in the Rig's repo list.
3. **One cumulative `kind:30618` refs event** — branch → SHA mappings plus the full `arweave` sha→txId map, so the Rig resolves every object without waiting on Arweave GraphQL indexing. The repo is browsable in the Rig immediately.

After the first successful push, `rig` persists the repo address into the repository's git config:

| Key | Meaning |
|-----|---------|
| `toon.repoid` | repository id — the NIP-34 `d` tag (default: the repo directory name) |
| `toon.owner` | owner pubkey — the identity that signed the push |
| `toon.relay` | relay URL(s) pushed to |

These keys make the follow-up commands flag-free: the `a`-tag address (`30617:<owner>:<repoId>`) is read from git config; `--repo-id`/`--owner` override it (use `--owner` for repos you don't own).

Common variants:

```sh
rig push main v1.0.0 --yes                 # specific refs, skip the confirm prompt
rig push --all --tags                      # every local branch and tag
rig push --json                            # machine-readable estimate — nothing executed
rig push --json --yes                      # machine-readable execute (agents)
rig push --force                           # allow non-fast-forward (overwrites remote history)
rig push --relay wss://relay.example --repo-id demo   # override the defaults
```

### Issues, PRs, and status — from the CLI

The single-event subcommands follow the same paid-write discipline as push: the flat per-event fee is quoted (daemon `/status` `feePerEvent`, or the standalone fee rates) and confirmed before publishing; `--yes` skips the prompt (required when stdin is not a TTY), `--json` without `--yes` is a free estimate.

```sh
rig issue create --title "Fix the flux" --body "It broke."   # kind:1621
echo "longer body" | rig issue create --title t --yes        # body via stdin
rig comment <root-event-id> --body "Nice catch."             # kind:1622
rig pr create --title "Add feature" --range main..feature    # kind:1617 with
                                                             # REAL format-patch text
rig pr create --title "Backport" --patch-file fix.patch      # pre-generated patch
rig status <event-id> applied                                # kind:1631
```

- `rig issue create` — body from `--body`, `--body-file`, or piped stdin; `--label` is repeatable.
- `rig comment <root-event-id>` — comments on an issue or patch; `--parent-author` and `--marker root|reply` control NIP-34 threading.
- `rig pr create` — `--range` runs real `git format-patch --stdout` locally and derives the `commit`/`parent-commit` tags; a multi-commit range publishes ONE kind:1617 event carrying the whole series (cover-letter threading is out of scope in v1).
- `rig status <event-id> <open|applied|closed|draft>` — kind:1630–1633, with the repo `a` tag attached so readers can scope a status stream to the repository.

### …and from Claude — the `toon_git_*` MCP tools

The daemon exposes the same path over MCP, so an agent can push repos and file issues/PRs conversationally. The confirm gate becomes tool-call policy:

- **`toon_git_push`** is two-step: call with `dry_run: true` first (free — plans the push and returns the itemized fee table), quote `estimate.totalFee` to the user, then call again with `confirm: true` to execute. A push without `confirm: true` is rejected by the daemon.
- **`toon_git_issue` / `toon_git_comment` / `toon_git_patch` / `toon_git_status`** each spend one flat per-event channel claim; the agent quotes `feePerEvent` (via `toon_status`) and confirms with the user before calling.

The daemon's key signs, so the daemon identity is the repo owner — same as daemon-mode `rig`, and the two share the underlying `/git/*` control routes.

### Cost model

- **Uploads are per-byte:** object bytes × the store's per-byte rate. **Events are flat:** one fixed `feePerEvent` per publish, regardless of event size. All fees are in base units of the channel asset, itemized in the plan before you confirm.
- **Writes are permanent and non-refundable.** Arweave storage is permanent by design, and relay events cannot be unpublished. Treat the confirm prompt accordingly.
- **Delta pushes skip known objects.** Uploads are content-addressed: the plan subtracts everything already on Arweave (via the `kind:30618` `arweave` map and a Git-SHA GraphQL fallback), so a re-push never re-pays for objects the store already has. A push with nothing new is a free no-op (`Everything up-to-date — nothing to push (and nothing paid).`), and a crashed push resumes without double-paying.
- **Estimates are free.** `--json` without `--yes` (CLI) and `dry_run: true` (MCP) plan and price without paying.

### Limits & modes (v1)

- **95KB object cap.** Any single git object over 95KB is a hard error at plan time — nothing is uploaded or paid. The paid large-object path is tracked in [toon-client#235](https://github.com/toon-protocol/toon-client/issues/235); until then, keep big binaries out of pushed history.
- **Mode selection.** Explicit `--daemon`/`--standalone` flags win; otherwise `rig` probes the `toon-clientd` loopback `/status` — reachable and reporting an identity ⇒ daemon; else standalone when a mnemonic source exists; else a hard error naming both remediations.
- **Standalone is single-relay.** The standalone publisher publishes to exactly one relay and refuses a plural relay list up front, before anything is paid. Daemon mode publishes via its apex and accepts multiple relays.
- **The nonce guard (why standalone is careful).** A payment channel's balance proof is a *cumulative* watermark — two writers signing claims on the same channel from separate processes keep independent counters, race the watermark, and can double-charge. Standalone mode therefore refuses to run while a daemon with the **same identity** is up (a daemon on a different identity holds different channels and is harmless), and takes a per-pubkey advisory lockfile under `~/.toon-client` so two standalone processes can't race each other either.
- **Still not implemented:** native git transports (`git push`/`git clone` via receive-pack/upload-pack — writes go through `rig`, reads through the Rig and Arweave gateways) and ref deletion.

## Agent Orchestration — the Next Vocabulary

NIP-34 git is the Rig's first event vocabulary, not its last. The **verifiable swarm-market epic** ([toon-meta#84](https://github.com/toon-protocol/toon-meta/issues/84)) is the incentive layer of this same control plane: propositions about agent work ("bug #142 merged by Friday") become parimutuel markets whose stakes stay escrowed in the betters' own payment channels, and **resolver DVMs** decide the outcome by evaluating a frozen predicate over the signed NIP-34 event log — the **same events the Rig renders are the oracle log**. A worker's YES bet doubles as task claim, lock, and delivery bond; doubters' NO stakes fund the work.

Nothing new is needed on the read side: the Rig remains the read-only view onto that control plane, rendering the tasks, claims, and lifecycle events that the resolvers later read as evidence. And the write side already exists: bets, claims, and work products are published the same way the shipped git write path ([toon-client#222](https://github.com/toon-protocol/toon-client/issues/222)) publishes pushes and issues — CLI/MCP clients that hold keys and pay over ILP, estimate → confirm → execute.
