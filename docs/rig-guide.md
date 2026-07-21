# Rig Guide

The Rig (`@toon-protocol/rig-web`) is a **decentralized control plane** for the TOON Protocol that runs entirely in the browser as a static SPA — no backend, no accounts, no servers. The standing deployment is **<https://toon-protocol.github.io/toon-client/>** (interim GitHub Pages host, devnet-pointed; the Arweave-permanent deploy is pending a funded Turbo JWK — see [Deploy](#deploy)). (The npm name `@toon-protocol/rig` belongs to the *write-path* package that ships the `rig` CLI — see [the write path](#writing-to-the-rig--the-write-path) below.)

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
cd packages/rig-web
pnpm dev
```

Opens a Vite dev server. By default connects to `ws://localhost:7100` — override with `VITE_DEFAULT_RELAY`:

```bash
VITE_DEFAULT_RELAY=wss://relay.example pnpm dev
```

### Production Build

```bash
cd packages/rig-web
pnpm build
```

Output goes to `packages/rig-web/dist/` — a static directory you can serve from anywhere.

### Deploy

The build output is a plain static directory — serve `packages/rig-web/dist/` from any static host (nginx, Caddy, object storage, an Arweave gateway).

The **standing deployment** is GitHub Pages: <https://toon-protocol.github.io/toon-client/> — the devnet-pointed build on the `gh-pages` branch. This is the interim, centralized host; the Arweave-permanent deploy is currently blocked on a funded Turbo JWK (the free ArDrive Turbo tier caps single files at 105 KiB, which four build outputs exceed) — see `packages/rig-web/README.md` for the unblock details. Point the deployed SPA at any relay without rebuilding: `…/toon-client/#relay=wss://relay.example`.

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

1. **URL hash fragment** — `#relay=wss://relay.example` (preferred — shareable, works on all Arweave gateways). The SPA uses a hash router, so boot code rewrites the bare fragment in place to the router-safe `#/?relay=…` before the router mounts ([toon-client#266](https://github.com/toon-protocol/toon-client/issues/266)) — both forms work.
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

The Rig SPA itself stays read-only — it holds no keys and pays for nothing. Writes come from **clients that hold keys and pay** the connector payment proxy: NIP-34 events are published to the relay (paid ILP writes), and git objects are uploaded to the Arweave store (a paid `POST /store` to the payment-oblivious store backend behind the proxy). That write path is **shipped** ([toon-client#222](https://github.com/toon-protocol/toon-client/issues/222); git-native v0.2 UX in [toon-client#246](https://github.com/toon-protocol/toon-client/issues/246); official-client parity in [toon-client#261](https://github.com/toon-protocol/toon-client/issues/261)).

### Official client implementations

There are two **official TOON client implementations**, peers of each other, both built over `@toon-protocol/client`:

1. **`toon-clientd` + the `toon_*`/`toon_git_*` MCP tools** — the **agent-host client**. A long-running daemon holds the identity and channels; Claude (Desktop or Code) drives it conversationally over MCP (`@toon-protocol/client-mcp`): `toon_publish`, `toon_fund_wallet`, `toon_open_channel`, and the git verbs `toon_git_push`, `toon_git_issue`, `toon_git_comment`, `toon_git_patch`, `toon_git_status`.
2. **The Rig** — the **git-native client**: the `rig` CLI ([`@toon-protocol/rig`](https://github.com/toon-protocol/toon-client/tree/main/packages/rig), the old `@toon-protocol/git` name is deprecated on npm) plus the read-only rig-web SPA. The CLI is **standalone — no daemon**: it embeds its own payment client, bootstraps the full payment topology from a bare mnemonic (network discovery below), owns the whole money lifecycle (`rig fund`, `rig channel open|close|settle`, `rig balance`), and is a **1:1 git experience with a TOON remote** — it owns the TOON verbs (`rig init`, `rig remote add/remove/list`, `rig push`, `rig issue create`, `rig comment`, `rig pr create`, `rig pr status`, `rig fund`, `rig balance`, `rig channel …`) and **every other command passes through to system git verbatim** (`rig status` IS `git status`).

**When to reach for which:** in an agent host (Claude Desktop/Code) use the daemon + MCP tools — the daemon's key signs and its channels pay, and the confirm gate is tool-call policy. In a terminal, in CI, or anywhere git lives, use the Rig — mnemonic-only bootstrap, no long-running process, and a strict `--json` contract for scripts and agent consumers (stdout carries exactly one JSON document; everything human-facing goes to stderr, so `rig <command> --json | jq` always parses). The Rig is a peer implementation, not a demo: a fresh user with only a mnemonic can install, fund, and transact like any first-class client, daemon-free — the journey was proven end-to-end on devnet ([toon-client#261](https://github.com/toon-protocol/toon-client/issues/261)).

Both follow the same discipline: **estimate → confirm → execute**. Every write quotes its fee before spending, and every write is **permanent and non-refundable** — events cannot be unpublished, uploads cannot be deleted.

### Quickstart

The full fresh-outsider journey, as proven on devnet — the mnemonic, `rig init`, and `rig remote add origin` are the ONLY hand-fed inputs; everything else (uplink, ILP routes, settlement chain, contract addresses) is discovered from the network:

```sh
npm install -g @toon-protocol/rig

# 1. identity — a BIP-39 seed phrase, in your environment…
export RIG_MNEMONIC="abandon abandon … about"
#    …or in a project-local .env (gitignore it!):
echo 'RIG_MNEMONIC="abandon abandon … about"' >> .env

# 2. money (devnet: free faucet drip — works with ZERO config; rig ≥ 2.13
#    infers the devnet faucet from the built-in genesis seed. Elsewhere it
#    prints addresses to fund. Gas is assumed: hold a little ETH/SOL/MINA.)
rig fund
rig balance                  # wallet balances + channel holdings (free)

# 3. one-shot repo setup (free, idempotent)
rig init

# 4. add your relay as an origin — a REAL git remote
#    (the shared devnet relay: wss://relay-ws.devnet.toonprotocol.dev)
rig remote add origin wss://relay.example

# 5. work exactly like git — unowned commands pass through to system git
rig add -p && rig commit -m "fix"

# 6. push (paid) — estimate → confirm → execute, defaults to origin.
#    The first paid command opens the payment channel lazily and records
#    it; later invocations resume the same channel (rig channel list).
rig push
```

Every rig-owned command takes `--json` for machine consumers — the strict contract guarantees exactly one JSON document on stdout with all human-facing output on stderr. The pushed repo is browsable immediately in the standing SPA: <https://toon-protocol.github.io/toon-client/>.

**Steering knobs** (all free — they only write local config):

- `rig chain set <evm|sol|mina>` — pin which chain (and therefore which USDC) settles paid writes; `rig chain` shows the current pick, `rig chain unset` reverts to auto.
- `rig entry <apex|sandbox|url>` — pick the network entry node (payment ingress + relay). `rig entry sandbox` targets the devnet's Mina-only multihop entry (pays Mina; the hops settle Base then Solana) and clears the topology cache for you.
- `rig channels` — shorthand for `rig channel list`.

**Mina note:** the Mina `PaymentChannel` zkApp is single-pair, so each identity needs its own deployment — rig ≥ 2.13.0 **auto-deploys** it on the first Mina channel open (needs ~1.5 MINA gas in the wallet; compile ≈1-3 min + block inclusion ≈3-6 min, one-time). Pre-deploy with `rig channel deploy-zkapp` so the first paid Mina write stays fast.

### Install & prerequisites

1. **Node 22+ and `git`** on PATH — the CLI reads your local repository with real git plumbing, and unowned subcommands are executed by your system git.
2. **The CLI:** `npm install -g @toon-protocol/rig` (ships the `rig` bin). `@toon-protocol/client` — the embedded payment client — is a regular dependency and installs automatically ([toon-client#259](https://github.com/toon-protocol/toon-client/issues/259) made the bare global install work from the registry; it is no longer an optional peer you add yourself). The old `@toon-protocol/git` package is deprecated; uninstall it.
3. **A TOON identity that can pay.** The CLI is **standalone-only** — it embeds its own payment client built from your seed phrase; there is no daemon mode in the CLI (the daemon path lives on as the `toon_git_*` MCP tools). The mnemonic is resolved along one precedence chain — highest first:
   1. `RIG_MNEMONIC` environment variable
   2. `TOON_CLIENT_MNEMONIC` environment variable — deprecated alias for the CLI, warns on stderr; rename it to `RIG_MNEMONIC` (the `toon-clientd` daemon itself still uses `TOON_CLIENT_MNEMONIC` — only the CLI alias is deprecated)
   3. project-local `.env` — found by walking up from the working directory (through the repo root); ONLY the `RIG_MNEMONIC` line is parsed out of it (rig never loads arbitrary env from the file). **Gitignore it** — the phrase must never be committed.
   4. the shared `~/.toon-client` state dir (`TOON_CLIENT_HOME` override): encrypted keystore (`keystorePath` + `TOON_CLIENT_KEYSTORE_PASSWORD`), then the `mnemonic` config field

   Every paid command reports which source is active and the derived pubkey (`Identity: <pubkey> (from …)`, and an `identity` object in `--json` output) — the phrase itself is never printed and never written to git config or any repo file.

**Funding is owner-side — there is no x402 onboarding in this path.** The repo owner self-funds before the first push, and since [toon-client#263](https://github.com/toon-protocol/toon-client/issues/263) the CLI owns the full money lifecycle itself:

- **`rig fund`** — free: drips devnet faucet funds to the active identity's wallet (`--chain evm|solana|mina`); on other networks it prints the derived address(es) to fund externally.
- **`rig balance`** — free: on-chain wallet balances plus recorded payment-channel holdings, reading the actual settlement chain the bootstrap selected.
- **`rig channel list | open | close | settle`** — `list` shows the channels paid commands hold (free); `open` explicitly opens (or resumes) the channel for a peer, with `--deposit` to add collateral; `close` starts the on-chain settlement challenge window; `settle` releases the remaining collateral after it elapses.

You don't have to open a channel by hand: the first paid command opens one lazily, **records it under `~/.toon-client` (`rig-channels.json`), and every later invocation resumes the same channel** instead of opening a new one per run ([toon-client#262](https://github.com/toon-protocol/toon-client/issues/262)). The daemon flows (`toon_fund_wallet`, `toon_open_channel`) remain the MCP-host equivalents; if you can `toon_publish`, you can `rig push`.

### Network bootstrap — zero hand-fed topology

Standalone rig resolves the payment topology — uplink, ILP destinations/routes, settlement chain and its on-chain parameters — **from the network itself**, not from hand-fed constants ([toon-client#264](https://github.com/toon-protocol/toon-client/issues/264)). Per field, first hit wins:

1. **Explicit user config** — env vars / shared client-config file fields (always available as an override).
2. **Live `kind:10032` announce** — the payment peer's `IlpPeerInfo` event discovered on the relay the paid command resolved via `rig remote` (uplink endpoints, ILP channel anchor, supported chains + settlement addresses, publish/store routes).
3. **Genesis seed** — `@toon-protocol/core`'s committed genesis peer seed (core ≥ 2.0.1 ships the live devnet apex), the offline fallback when the relay is unreachable or serves no valid announce.

Settlement-chain selection is equally predictable: explicit config → the chain of the most recently used recorded channel (collateral is already locked there) → the first announced EVM chain where the identity holds a balance → the first announced chain, with a printed rationale. Net effect: a bare mnemonic plus a relay URL is a complete configuration.

### Repo setup — `rig init` and relays as origins

`rig init` is the free, idempotent one-shot setup. It checks you are inside a git repository, resolves and reports the active identity (source + pubkey), and writes the repo address to the repository's **local git config**:

| Key | Meaning |
|-----|---------|
| `toon.repoid` | repository id — the NIP-34 `d` tag (default: the repo directory name; `rig init --repo-id my-repo` to pick one) |
| `toon.owner` | owner pubkey — derived from the resolved identity |

These keys make every follow-up command flag-free: the `a`-tag address (`30617:<owner>:<repoId>`) is read from git config; `--repo-id`/`--owner` override it (use `--owner` for repos you don't own). An unconfigured repo is a clear "run `rig init`" error, and pushing never mutates git config.

Relays are configured as **real git remotes** (`rig remote add` is `git remote add` underneath — `git remote -v` shows them, and remotes added with plain git work too, as long as the URL is `ws://`/`wss://`/`http://`/`https://`):

```sh
rig remote add origin wss://relay.example
rig remote list              # names + URLs; --json for machines
rig remote remove origin
```

Paid commands resolve their relay git-style: an explicit `--relay <url>` (ad-hoc override — bypasses the configured remotes entirely) → a named remote (`rig push staging main`; the event commands take `--remote <name>`) → `origin` → the deprecated v0.1 `git config toon.relay` key as a fallback (paid commands print a one-line deprecation nudge; the key is removed in v0.3, and `rig init` migrates a single `toon.relay` URL to a real `origin` remote automatically) → a clear ``no origin configured — run `rig remote add origin <relay-url>` `` error. **One relay URL per remote:** a remote with multiple URLs (`git remote set-url --add`) is refused before anything is uploaded, published, or paid — rig publishes to exactly one relay per paid command.

### Git passthrough

rig behaves like git; the TOON verbs are additive. Any subcommand rig does not own is executed as `git <args...>` verbatim with inherited stdio (interactive commands, pagers, colors, and prompts all work) and git's exact exit code — `rig status`, `rig add -p`, `rig commit`, `rig log --oneline`, `rig rebase -i` behave exactly like git. rig-owned verbs take precedence: in particular `rig push` is the TOON transport and **shadows `git push`** — plain-git pushes stay available by calling `git push` directly.

### First push

From inside a `rig init`-ed repository with an `origin` relay remote:

```sh
rig push
```

The CLI plans the push against the relay's current remote state and renders the fee table before anything is spent:

```
Push plan for repo "demo" — first push, will announce (kind:30617)
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

Uploads are content-addressed, so a re-push never re-pays for objects the store already has, and a crashed push resumes idempotently.

Common variants — `rig push [remote] [refspecs...]`, resolved git-style (when the first positional matches a configured remote name it is the remote; otherwise it is a refspec and the remote defaults to `origin`):

```sh
rig push main v1.0.0 --yes                 # specific refs, skip the confirm prompt
rig push staging main                      # push via another configured remote
rig push --all --tags                      # every local branch and tag
rig push --json                            # machine-readable estimate — nothing executed
rig push --json --yes                      # machine-readable execute (agents)
rig push --force                           # allow non-fast-forward (overwrites remote history)
rig push --relay wss://relay.example --repo-id demo   # ad-hoc overrides
```

### Issues, PRs, and status — from the CLI

The single-event subcommands follow the same paid-write discipline as push: the flat per-event fee is quoted and confirmed before publishing; `--yes` skips the prompt (required when stdin is not a TTY), `--json` without `--yes` is a free estimate. They use the `rig init` config and resolve their relay the same way as push (`--remote <name>`, default `origin`; `--relay <url>` as ad-hoc override).

```sh
rig issue create --title "Fix the flux" --body "It broke."   # kind:1621
echo "longer body" | rig issue create --title t --yes        # body via stdin
rig comment <root-event-id> --body "Nice catch."             # kind:1622
rig pr create --title "Add feature" --range main..feature    # kind:1617 with
                                                             # REAL format-patch text
rig pr create --title "Backport" --patch-file fix.patch      # pre-generated patch
rig pr status <event-id> applied                             # kind:1631
```

- `rig issue create` — body from `--body`, `--body-file`, or piped stdin; `--label` is repeatable.
- `rig comment <root-event-id>` — comments on an issue or patch; `--parent-author` and `--marker root|reply` control NIP-34 threading.
- `rig pr create` — `--range` runs real `git format-patch --stdout` locally and derives the `commit`/`parent-commit` tags; a multi-commit range publishes ONE kind:1617 event carrying the whole series (cover-letter threading is out of scope in v1).
- `rig pr status <event-id> <open|applied|closed|draft>` — kind:1630–1633, with the repo `a` tag attached so readers can scope a status stream to the repository. **Renamed in v0.2** (BREAKING): this was top-level `rig status <event-id> <state>` in v0.1 — bare `rig status` now passes through to `git status`.

### …and from Claude — the `toon_git_*` MCP tools

The daemon exposes the same path over MCP, so an agent can push repos and file issues/PRs conversationally. The confirm gate becomes tool-call policy:

- **`toon_git_push`** is two-step: call with `dry_run: true` first (free — plans the push and returns the itemized fee table), quote `estimate.totalFee` to the user, then call again with `confirm: true` to execute. A push without `confirm: true` is rejected by the daemon.
- **`toon_git_issue` / `toon_git_comment` / `toon_git_patch` / `toon_git_status`** each spend one flat per-event channel claim; the agent quotes `feePerEvent` (via `toon_status`) and confirms with the user before calling.

The daemon's key signs, so the daemon identity is the repo owner. The daemon's `/git/*` control routes are the MCP host path and are **unaffected by the CLI going standalone-only** — the v0.2 CLI change removed daemon mode from `rig`, not from the daemon.

### Cost model

- **Uploads are per-byte:** object bytes × the store's per-byte rate. **Events are flat:** one fixed `feePerEvent` per publish, regardless of event size. All fees are in base units of the channel asset, itemized in the plan before you confirm.
- **Writes are permanent and non-refundable.** Arweave storage is permanent by design, and relay events cannot be unpublished. Treat the confirm prompt accordingly.
- **Delta pushes skip known objects.** Uploads are content-addressed: the plan subtracts everything already on Arweave (via the `kind:30618` `arweave` map and a Git-SHA GraphQL fallback), so a re-push never re-pays for objects the store already has. A push with nothing new is a free no-op (`Everything up-to-date — nothing to push (and nothing paid).`), and a crashed push resumes without double-paying.
- **Estimates are free.** `--json` without `--yes` (CLI) and `dry_run: true` (MCP) plan and price without paying.

### Limits & guardrails

- **95KB object cap.** Any single git object over 95KB is a hard error at plan time — nothing is uploaded or paid. The paid large-object path is tracked in [toon-client#235](https://github.com/toon-protocol/toon-client/issues/235); until then, keep big binaries out of pushed history.
- **The CLI is standalone-only.** There is no mode selection: the v0.1 `--daemon`/`--standalone` flags and the daemon probe are gone. `rig` always builds its embedded payment client from the resolved mnemonic; hosts that want the daemon's identity use the `toon_git_*` MCP tools instead.
- **One relay per paid command.** The CLI publishes to exactly one relay per paid command and refuses a multi-URL remote up front, before anything is paid. (The daemon MCP path publishes via its apex and accepts multiple relays.)
- **The nonce guard (why the CLI is careful).** A payment channel's balance proof is a *cumulative* watermark — two writers signing claims on the same channel from separate processes keep independent counters, race the watermark, and can double-charge. The CLI therefore refuses to run while a `toon-clientd` daemon with the **same identity** is up (a daemon on a different identity holds different channels and is harmless) — stop the daemon or publish through its `toon_git_*` tools instead — and takes a per-pubkey advisory lockfile under `~/.toon-client` so two CLI processes can't race each other either.
- **Still not implemented:** native git transports (`git push`/`git clone` via receive-pack/upload-pack — writes go through `rig push`, reads through the Rig and Arweave gateways) and ref deletion.

### Migrating from v0.1

| v0.1 | v0.2 |
|------|------|
| `npm install -g @toon-protocol/git` | `npm install -g @toon-protocol/rig` — the old package is deprecated on npm |
| `rig status <event-id> <state>` | `rig pr status <event-id> <state>` (**BREAKING** — bare `rig status` is now `git status`) |
| `git config toon.relay <url>` | `rig remote add origin <url>` — `rig init` migrates a single `toon.relay` automatically; the key still works as a fallback with a deprecation nudge and is removed in v0.3 |
| `TOON_CLIENT_MNEMONIC` (CLI identity) | `RIG_MNEMONIC` — the old name still works as a deprecated alias and warns on stderr |
| daemon mode (`--daemon`, loopback probe) | removed from the CLI — the daemon path is the `toon_git_*` MCP tools, unchanged |

## Agent Orchestration — the Next Vocabulary

NIP-34 git is the Rig's first event vocabulary, not its last. The **verifiable swarm-market epic** ([toon-meta#84](https://github.com/toon-protocol/toon-meta/issues/84)) is the incentive layer of this same control plane: propositions about agent work ("bug #142 merged by Friday") become parimutuel markets whose stakes stay escrowed in the betters' own payment channels, and **resolver DVMs** decide the outcome by evaluating a frozen predicate over the signed NIP-34 event log — the **same events the Rig renders are the oracle log**. A worker's YES bet doubles as task claim, lock, and delivery bond; doubters' NO stakes fund the work.

Nothing new is needed on the read side: the Rig remains the read-only view onto that control plane, rendering the tasks, claims, and lifecycle events that the resolvers later read as evidence. And the write side already exists: bets, claims, and work products are published the same way the shipped git write path ([toon-client#222](https://github.com/toon-protocol/toon-client/issues/222)) publishes pushes and issues — CLI/MCP clients that hold keys and pay over ILP, estimate → confirm → execute.
