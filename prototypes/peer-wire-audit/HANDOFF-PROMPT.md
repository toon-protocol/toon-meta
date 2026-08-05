# Handoff prompt — paste this into a new session

Working dir: `~/Documents/toon-meta`. Repos: `~/Documents/{connector,buzz,toon-client,rig}`.

> **Redacted for the public repo.** Host and client IP addresses are written as
> `<apex-ip>`, `<store-ip>` and `<client-a>`/`<client-b>`/`<client-c>`. The real
> values are in project memory, following this audit's existing `root@<ip>`
> convention. `<client-a>` and `<client-b>` are in the same residential /24.

## What you're picking up

Two threads ran in the previous session. Read `prototypes/peer-wire-audit/` first — it has the audits, the deployment plan and the integration notes.

**Thread 1 — mesh-compute earning (filed, dormant).** Epic `toon-meta#265` with children `toon-meta#266`, `connector#709`, `toon-client#499`, `buzz#90–96`. Fully grilled and specified; nothing started. `connector#709` (the prepaid window) is the highest-value ticket in it and has no dependencies. Prototype evidence in `prototypes/mesh-shard-over-ilp/RESULTS.md`. Memory file: `mesh-compute-earning-epic.md`.

**Thread 2 — the peer-transport migration (active, this is the live work).** The custom raw-TCP peer wire is deleted and replaced by BTP + ILP-over-HTTP, operator-selectable. Eleven PRs merged, `main` green.

Merged: ADR 0027 (#675) · carriage spec (#720) · BTP codec extracted to `connector-btp` (#717) · **peer wire deleted** (#718) · peer config schema (#723) · role-by-auth (#730) · BTP carriage (#731) · HTTP carriage (#733) · Solana inbound peer claims (#738).

Open: `#741` two-connector e2e · `#740` cutover runbook (filed by the sandcastle runner) · `#715` store-box Rust deploy · `#742` outbound Solana claims · `#674` docs.

Critical path: **`connector#678` (bring-up)**. Then `#729` (paired vectors), `#742`, `#714` (TS retirement).

## The finding that matters most

`connector-peer-btp` and `connector-peer-http` are workspace members that **no binary depends on**. Neither `connector-cli` nor `connector-bin` lists either in its `Cargo.toml`, and the client edge router has no `Toon-Peer-Auth` read, no `claim-ack` emission and no `decide_role` call. Everything merged compiles, tests, and is **unreachable from a running connector**. `#678` owns three gaps, documented with file-level evidence in `crates/connector-bin/tests/two_connectors_peer.rs`'s header: no accept side bound to a socket, no dial side built from config, and no TLS story for a peer endpoint (`[[peers]].endpoint` accepts only `wss://`/`https://`, so a connector cannot dial plaintext loopback even in a test).

## PRODUCTION AUTHORIZATION — you have it

You are authorized to deploy to the Linode devnet and to execute the cutover, without asking me first. Boxes: apex `root@<apex-ip>`, store `root@<store-ip>`, key `~/.ssh/id_rsa`. Follow `prototypes/peer-wire-audit/DEPLOYMENT-PLAN.md`.

Specifically authorized: stand up the Rust connector on the store box (#715); shift the apex's default public edge from TypeScript to Rust; drain and stop the TypeScript connectors; retire the `/rust/` URL prefix once clients have migrated; and reconcile the hand-edited on-box configs back into the repo.

**Two hard preconditions, which are engineering requirements and not permission gates:**

1. **Before deleting any GHCR tag, `docker save` the four TypeScript connector digests to disk and verify the archives.** That image came from an unmerged branch, `main` deleted its source, and its build workflow is in state `deleted` — **it cannot be rebuilt.** Losing those tags is unrecoverable.
2. **Do not remove TypeScript until a paid write increments `CLAIMS()` on *both* boxes.** The Rust store leg currently points `handler_url` at the store's public URL, which bypasses the store's connector entirely — the apex keeps the money and no claim is written. Retiring TS before that is fixed is not behaviour-preserving.

Roll forward through the reversible steps freely. Tell me what you did afterwards rather than asking beforehand.

## Things that will bite you

- **CI runs six checks, not four.** `Lint and Format Check` runs `npm run format:check` → `prettier --check "**/*.{ts,tsx,js,json,md}"`, which the cargo gate does not cover. It failed five PRs in this epic because most output was Markdown. Run it before every push.
- **Agents get killed mid-run** — seven times in the last session. Instruct every agent to **push a skeleton commit within its first few minutes and push after every increment**. Every agent that batched its push lost everything; every one that pushed early kept its work. Give each agent its own `git worktree` — two agents in one checkout will corrupt each other's branch state.
- **`gh issue view` and `gh pr edit` fail** in this org on a projectCards GraphQL deprecation. Use `gh issue view --json <fields>` for reads and `gh api -X PATCH` for writes, and verify the write landed.
- **Local `prettier` in a bare worktree lies** — no `node_modules`, so it flags files CI does not. CI is the authority; I wrongly reported `main` as failing on this basis.
- **The boxes lead the repo.** `connector-rust.toml` is untracked in the apex checkout, the announcer's compose overlay has no repo source, and `devnet-manage.sh`'s image pins are stale enough to roll production *backwards*. The apex's `g.toon.relay` price was hand-edited from 1000 to 1 µUSDC and the file's own comment still says 1000.
- **`ClaimBook` signs only EVM.** #738 verifies inbound Solana peer claims; #742 is the outbound half. Establish which direction value flows before bring-up assumes either.

## How I want you to work

Act rather than ask. Verify claims against the repo instead of trusting summaries — several "facts" in the last session did not survive contact with the code, including two of mine. When you find something that contradicts a plan, say so plainly and adjust. Report what actually happened, including what failed.

Start by reading `prototypes/peer-wire-audit/DEPLOYMENT-PLAN.md` and `connector#678`, then get the peer carriages reachable from a running binary.
