# Peer wire audit — `toon-protocol/connector`

Read-only audit, 2026-08-03. Local checkout `/home/jonathan/Documents/connector`, branch `main`,
HEAD `59e167f2` (PR #692). Nothing was changed, fetched, pushed or filed.

> **Checkout freshness caveat.** Local `main` and `origin/main` are both at `59e167f2`. Two PRs
> merged upstream after that point (#702 at `3536cca0`, 2026-08-03T20:15Z; #704, 2026-08-03T21:26Z)
> and are **not** in this working copy. Their file lists were read from the GitHub API instead of
> from disk; both are noted where relevant. Neither touches the peer path.

---

## BOTTOM LINE

**Yes — the custom raw-TCP peer wire is still the one and only connector↔connector transport in the
Rust connector. It is not dead, not partially migrated, and there is no BTP peer transport in the
repo, on any branch, in any config, or behind any flag.**

There is exactly one `PeerTransport` production implementation (`NetworkPeerTransport`, raw
`tokio::net::TcpStream`), it is constructed unconditionally, and the peer config schema has no
transport field and refuses unknown keys. BTP exists in this repo only on the **client edge**
(`GET /ilp/btp`), and the module that implements it states in its own header that peers never enter
it.

### What the owner is probably remembering

Three real things, none of which is "the peer wire was removed":

1. **An ADR that was written but never merged.** On 2026-07-31 an ADR 0026 draft titled
   *"Connectors peer over BTP; the clean-room peer wire is retired"* was committed on branch
   `adr/btp-peer-transport` (`370d53a3`, plus `fa518660`) and opened as **PR #675 — still OPEN,
   unmerged**. It reads as a completed decision. It is a proposal.
2. **A different ADR 0026 with a nearly opposite title landed instead.** Two days later PR #680
   merged `37440320` carrying
   `docs/adr/0026-client-btp-rides-the-client-edge-peers-stay-on-the-peer-wire.md`. The ADR number
   0026 is shared by both documents; only the second one is in `main`. Anyone recalling "ADR 0026,
   BTP, connectors" without the title could easily remember the wrong one.
3. **The retired TypeScript fleet genuinely did peer over BTP** on `wss://…:443` — e.g.
   `06477357 fix(infra): add :443 to peer BTP urls`, `e08d846b feat(infra): env-required store seed
   + no-auth BTP authToken on peers`, `8119655c feat(infra): peer the store box to the apex`. That
   behaviour was real, and it was deleted along with the TS connector (PR #543, `2d981565`). The
   Rust rewrite did not carry it forward — ADR 0003 deliberately replaced it.

A fourth, smaller confusion risk: PR #704 (merged upstream today, not in this checkout) is titled
*"Per-route transport policy (relay BTP-only, store both)"* and adds a `transport` policy to
`connector-config`'s **route** schema. That is a *client-carriage* policy on terminated routes
(HTTP vs BTP for paying clients). It is not a peer transport selector.

### Correction to the premises in the request

- **connector#697 is CLOSED and shipped, not "open and unstarted."** PR #702 ("BTP: implement
  RFC-0023's symmetric grammar — server-originated MESSAGE + TRANSFER") merged 2026-08-03T20:15Z at
  `3536cca0`. It changed only `connector-client-edge/src/btp.rs`, its tests, ADR 0026 and
  `client-edge-spec.md` — still client-edge only. So the "deployed dialect only, no TRANSFER"
  characterisation is now stale upstream, though it is still accurate for this checkout.
- **connector#711 substantially duplicates existing open work.** PR #675 + issues #676/#677/#678/#679
  (all OPEN, all filed 2026-08-01) already propose exactly "reverse ADR 0003, peers on BTP", with a
  written ADR, a four-phase operator migration plan, and per-phase tickets. #711 asks for the
  decision record that #675 *is*. #711 does add one argument #675 does not make — that an open
  third-party market falsifies ADR 0003's "both ends are operator-controlled" premise — so the right
  move is probably to merge the two threads rather than close either blind.

---

## 1. Is the custom peer wire live?

### 1.1 The wire itself

`crates/connector-runtime/src/peer_wire.rs` — 102 lines, hand-numbered frame types:

```
crates/connector-runtime/src/peer_wire.rs:15-19
    pub const FRAME_TYPE_PREPARE:   u8 = 0x01;
    pub const FRAME_TYPE_FULFILL:   u8 = 0x02;
    pub const FRAME_TYPE_REJECT:    u8 = 0x03;
    pub const FRAME_TYPE_FLUSH:     u8 = 0x04;
    pub const FRAME_TYPE_CLAIM_ACK: u8 = 0x05;
```

Framing is `u8 type || 16-byte correlationId || u32 length || payload`
(`peer_wire.rs:37-70`), with a 16 MiB cap at `peer_wire.rs:25`.

The spec's own disclaimer is intact and unamended:

```
docs/protocol/peer-wire-spec.md:13-14
    This is a from-scratch design — it does not port
    BTP (RFC-0023) or its framing — …
```

`docs/protocol/peer-wire-spec.md:2` still reads **"Status: Normative, version 1"**.

### 1.2 It is raw TCP, both directions

`crates/connector-runtime/src/network_peer_transport.rs`:

- `:25` — `use tokio::net::{TcpListener, TcpStream};`
- `:53` — `stream: Mutex<Option<TcpStream>>` (one connection per peer, behind a mutex)
- `:92` — `TcpStream::connect(self.addr).await` (dial side)
- `:352` — `TcpListener::bind(addr).await?` (`PeerWireServer::bind`, accept side)

No websocket, no TLS, no HTTP upgrade anywhere in the file.

### 1.3 The real call graph — one implementation, wired unconditionally

Port: `crates/connector-runtime/src/peer_transport.rs` defines `trait PeerTransport`. Its module doc
(`:1-9`) names exactly two implementations: `InProcessPeerTransport` (test double, in that same
file) and `NetworkPeerTransport` (the network one). Exports at
`crates/connector-runtime/src/lib.rs:30` and `:36`.

Production construction — `crates/connector-cli/src/runtime.rs`:

```
runtime.rs:530-543
    let mut peer_transport = NetworkPeerTransport::new();
    for peer in config.peers() {
        peer_transport.add_peer(peer.id().to_string(), peer.addr());
    }
    …
    let mut connector = Connector::new(
        config.routes().to_vec(),
        peer_routes,
        Arc::new(HttpAppClient::new()),
        Arc::new(peer_transport),      // ← the only choice
        Arc::new(SystemClock),
    )
```

Accept side — `crates/connector-cli/src/lib.rs:101-109`:

```rust
let peer_wire_server = match config.peer_wire_addr() {
    Some(addr) => Some(PeerWireServer::bind(addr, runtime.connector.clone()).await …),
    None => None,
};
```

The only branch is *whether to listen at all*, never *what protocol to listen with*.

`crates/connector-bin/src/main.rs` calls `connector_cli::run` and makes no transport decision (ADR
0001; see `connector-cli/src/lib.rs:90-94`).

Forwarding path: `connector-runtime/src/connector.rs:235` holds `peer_transport: Arc<dyn
PeerTransport>`; `:819` `forward_via_peer_route(...)`; `:740` `self.peer_transport.flush(&peer_id,
claim)`. All of it lands on `NetworkPeerTransport`.

### 1.4 Is there a config switch? No

`crates/connector-config/src/peer.rs:16-21` is the whole `[[peers]]` schema:

```rust
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct RawPeer {
    id: String,
    addr: String,
}
```

`deny_unknown_fields` means a `transport = "btp"` key in `connector.toml` is a hard config-load
error. `PeerConfig::addr()` returns `std::net::SocketAddr` (`peer.rs:41-43`), and
`resolve_peers` rejects anything that is not a parseable socket address (`peer.rs:54-61`) — a
`wss://` URL cannot even be expressed.

The only BTP-shaped key in the entire config crate is `btp_session_window`
(`connector-config/src/config.rs:134`, `:187`, `:333-334`, `:453`), which bounds in-flight frames on
one **client** BTP session (issue #688). Nothing else.

### 1.5 …and no production link runs on it anyway

Worth recording because it cuts both ways. The devnet apex config states outright that the
inter-node leg is *not* a peer link:

```
infra/linode-node/connector-rust.toml:36-58 (abridged)
    ── The store leg is a TERMINATED route over a PUBLIC TLS link (#600) ─────
    … the inter-node link is public, carried over https and TLS-terminated by
    the store box's own nginx …, the same shape as the TypeScript fleet's
    connector↔connector links (BTP over wss://…:443).

    What this deliberately is NOT: the ADR 0003 peer wire …
      * The peer wire cannot carry a public link (issue #623): raw-TCP custom
        framing (nothing nginx can TLS-terminate), no TLS of its own by ADR
        0003's design, and SocketAddr-only [[peers]] addressing …
      * The PAID forwarded path is structurally unwired anyway (issue #620) …
```

The store box config does still configure the accepting side —
`infra/linode-store/connector-rust.toml:58` `peer_wire_addr = "0.0.0.0:4001"` — with the comment at
`:39-40` that it "never dials out itself, so there is no `[[peers]]` section here."

Blocking issues, both **OPEN**:
- **#623** — "The peer wire cannot carry a public inter-node link: raw-TCP framing, no TLS,
  SocketAddr-only dialing"
- **#620** — "The paid forwarded path is structurally unwired: peer routes greet nothing, charge
  nothing, and ADR 0024 claims cannot be configured"

So: the peer wire is **the live and only** connector↔connector code path, and simultaneously
**carries zero production traffic**. Both statements are true. If the owner is remembering "we don't
use the peer wire on devnet", that part is correct — but the reason is that the fleet terminates an
HTTP route over public TLS, not that peers moved to BTP.

---

## 2. Git history — was a migration attempted?

### 2.1 The abandoned branch (the likely source of the belief)

```
branch adr/btp-peer-transport   (local, unmerged, not contained in main)
  fa518660  2026-07-31  docs: cross-link the migration phases to issues #676-#679
  370d53a3  2026-07-31  docs: ADR 0026 — connectors peer over BTP; the clean-room peer wire is retired
```

`git branch --contains 370d53a3` → `adr/btp-peer-transport` only. Files added by `370d53a3`:

- `docs/adr/0026-connectors-peer-over-btp-the-clean-room-peer-wire-is-retired.md` (+147)
- `docs/operators/btp-peer-transport-migration.md` (+169)

**Docs only — zero lines of Rust.** No dual-stack, no BTP peer transport, no config schema. From the
draft ADR's own text:

> "Connector↔connector links run over BTP on `wss://` URLs … `[[peers]]` addresses become URLs.
> `peer_wire.rs`, `network_peer_transport.rs` and the raw-TCP listener are deleted once nothing
> configures them."

Note the tense: that is the proposed **end state**, not a description of the code. PR **#675 is
OPEN** (created 2026-08-01T02:07Z), and its own body says *"Docs only — no implementation, no
deploys"* and *"Do not merge without review; the ADR reverses a recorded decision."*

Its four implementation issues are **all OPEN and unstarted**:

| Issue | Title | State |
|---|---|---|
| #676 | BTP peer transport phase 1: dual-stack — accept and dial BTP alongside the raw-TCP peer wire | OPEN |
| #677 | phase 2: config schema for BTP peers (`[[peers]]` URLs, credentials, `[[peer_channels]]`) | OPEN |
| #678 | phase 3: devnet cutover — apex↔store becomes the first real Rust peer link, over wss | OPEN |
| #679 | phase 4: remove `peer_wire.rs` and the raw-TCP transport | OPEN |

`git log -S` / `--grep` across `--all` finds no commit on any branch adding a BTP peer transport, and
no revert of one. The only BTP implementation commits in the Rust era are client-edge ones (`bb8e12c9`
→ `37440320` #680; `394a27bc` → `0b39f3e3` #689).

### 2.2 The ADR timeline

| ADR | Title | Landed | Commit |
|---|---|---|---|
| 0003 | Clean-room peer wire, versioned client edge | 2026-07-25 | `69815282` (#433) |
| 0017 | The TypeScript connector is a prototype | 2026-07-28 | `d4fac5d9` (#516/#532) |
| 0024 | Peer-wire claims sign the EIP-712 balance proof | 2026-07-28 → 07-29 | `3f614c84` (#583), `37f5166c` (#598) |
| 0025 | An envelope target is confined beneath the handler path | 2026-07-29 | `6eaf92a0` (#597) |
| **0026** | **Client BTP rides the client edge; peers stay on the peer wire** | **2026-08-02** | **`37440320` (#680)**, amended by `3536cca0` (#702) |
| *0026 (rival)* | *Connectors peer over BTP; the clean-room peer wire is retired* | *never* | *`370d53a3`, PR #675 OPEN* |

**0026 (merged) is the newest ADR in the repo.** `grep -rn "supersed" docs/adr/*.md` shows the only
supersession chain is 0016 → 0017 (`0016-…md:3-8`, `0017-…md:4`, `0013-…md:36`). **Nothing supersedes
ADR 0003, and nothing supersedes the merged ADR 0026.** The peer-wire decision has never been
reversed in `main`.

The merged 0026 is explicit, and it is the most recent word on the subject:

```
docs/adr/0026-client-btp-rides-the-client-edge-peers-stay-on-the-peer-wire.md:5-8
    It is a second carriage for the client edge's existing pipeline, not a
    second pipeline. Peers never use it: connector↔connector traffic stays on
    the raw-TCP peer wire (`peer_wire.rs`, `docs/protocol/peer-wire-spec.md`),
    unchanged.
```

and its rationale depends on the split holding:

```
…:20-23
    every BTP session is a client session by construction, because peers speak
    a different protocol on a different listener. No client middleware can leak
    onto peer traffic; no peer trust can leak onto client sessions.
```

(That is also the invariant #711/#675 would be giving up — the draft ADR names its replacement
"role-by-auth".)

### 2.3 Does anything already propose peers-on-BTP?

Yes, and it predates #711 by two days: **PR #675 + issues #676–#679** (2026-08-01). #711
(2026-08-03T22:02Z, OPEN) asks for "an ADR that supersedes or reaffirms 0003" — which is literally
the artifact sitting unmerged in #675. #711's distinct contribution is the market/NAT argument:
ADR 0003's load-bearing premise is *"both ends of the peer wire are operator-controlled"*, and a
third-party operator falsifies it; plus the observation that RFC-0023 was written **for** the peer
case. Recommend cross-linking rather than closing either.

---

## 3. Where BTP actually exists in this repo

**Client edge only.**

- Implementation: `crates/connector-client-edge/src/btp.rs` (714 lines).
- Route: `crates/connector-client-edge/src/lib.rs:254` —
  `.route("/ilp/btp", get(btp::handle_btp_upgrade))`, mounted alongside `:253`
  `.route("/ilp", post(handle_ilp))` on the same router / same bind address.
- Wired in `crates/connector-cli/src/runtime.rs:797` via
  `connector_client_edge::router_with_gate_terms_and_btp_window(...)`, window from
  `config.btp_session_window()` (`runtime.rs:809`).
- Tests: `crates/connector-client-edge/tests/btp_session.rs`.

The module header states the separation as a construction-level fact:

```
crates/connector-client-edge/src/btp.rs:6-8
    Peers never enter here: connector↔connector traffic is the raw-TCP peer
    wire, so every session this module serves is a client session by
    construction.
```

`grep -rl "btp\|BTP" crates/` returns nine files: `client-edge/src/btp.rs`,
`client-edge/src/lib.rs`, `client-edge/src/claim_gate.rs`, `client-edge/tests/btp_session.rs`,
`cli/src/runtime.rs`, `config/src/config.rs`, `config/src/error.rs`, `domain/src/packet.rs`,
`domain/src/client_claim.rs`. **Not one of `peer_wire.rs`, `peer_transport.rs`,
`network_peer_transport.rs`, `connector-config/src/peer.rs` mentions BTP at all.**

### Dialect

In this checkout it is the deployed `@toon-protocol/client` dialect, not RFC-23:

```
crates/connector-client-edge/src/btp.rs:10-12
    The frame grammar is the deployed `@toon-protocol/client` dialect
    (`btp/protocol.ts`), NOT RFC-23's full grammar …

crates/connector-client-edge/src/btp.rs:50-52
    const BTP_RESPONSE: u8 = 1;
    const BTP_ERROR:    u8 = 2;
    const BTP_MESSAGE:  u8 = 6;
```

with `btp.rs:48-49` noting the server "never originates a requestId", and the merged ADR 0026
(`:43-51`) justifying the choice — "MESSAGE/RESPONSE/ERROR only, no TRANSFER".

**Upstream this has already changed.** connector#697 ("BTP: implement RFC-0023's symmetric grammar —
server-originated MESSAGE + TRANSFER") is **CLOSED**, delivered by PR **#702, merged 2026-08-03T20:15Z**
at `3536cca0` (`btp.rs` +593/−28, `btp_session.rs` +109/−5, ADR 0026 +15, `client-edge-spec.md`
+30/−7). It is not in this checkout. Even so, it remains **client-edge-only** — it adds no peer file.

Also merged upstream and absent here: **PR #704 / issue #701**, "Per-route transport policy (relay
BTP-only, store both)". It touches `connector-config/src/route.rs` (+334), `config.rs`, `error.rs`,
`client-edge/src/lib.rs`, `client-edge/src/btp.rs`, `connector-runtime/src/connector.rs` (+72) and
`infra/linode-node/connector-rust.toml`. This adds the repo's **first** transport-selection config —
but per issue #701 it is "which transports a given **terminated route** accepts" for *clients*,
defaulting to both. It does not touch `[[peers]]`, `peer.rs`, or `NetworkPeerTransport`. If a
"transport policy now exists in config" memory is in play, this is it, and it is not about peers.

---

## 4. TypeScript footprint in this repo

**There is no TypeScript connector left.** It was removed in two steps:

- `c4a4ad10` (PR #465, 2026-07-26) — "feat(connector)!: TypeScript client shim — remove the embedded
  ConnectorNode"
- `2d981565` (PR #543, 2026-07-28) — "chore: retire the TypeScript connector and its npm/CI
  machinery (ADR 0017)"

`git ls-files packages/connector` returns nothing. ADR 0017 records that even v1's format "survives
only as compiled JavaScript … its source deleted in `c4a4ad1`".

### What TS/JS remains

81 tracked `.ts`/`.tsx`/`.js` files (excluding vendored `packages/contracts/lib/openzeppelin-contracts`,
which is a forge submodule, not our code):

| Path | Files | What it is | Connector impl? |
|---|---|---|---|
| `packages/mina-zkapp/` | 31 | o1js zkApp for the Mina USDC faucet | No — chain artifact |
| `packages/announcer/` | 15 | `kind:10032` announcer sidecar for the Rust edge (PRs #681/#683/#684) | No — sidecar |
| `.sandcastle/` | 8 | Sandcastle factory agent runners (`main.ts`, `agent-implement-issue.ts`, `agent-review-pr.ts`) | No — CI tooling |
| `packages/mina-usdc-faucet-web/` | 13 | faucet dApp front end | No |
| `packages/faucet/` | 11 | devnet faucet service + tests | No |
| `tools/mina/` | 4 | Mina ops scripts | No |
| `tools/fund-peers/src/` | 1 | devnet peer-funding script | No |
| `packages/contracts/test/integration/` | 1 | Solidity test helper | No |
| root `jest.config.js`, `babel.config.js` | 2 | test harness for the above | No |

Untracked build leftovers on disk only (`git ls-files` returns nothing for them): `packages/shared/`
(just `dist/` + `node_modules/`) and `tools/send-packet/` (same). These are stale artifacts from the
TS era — the sources are gone, only the build output was never cleaned off the working copy.
`tools/solana/` is a single `deploy.sh`; `packages/solana-program/` is Rust.

CI is explicit about the split — `.github/workflows/ci.yml:12-15`:

> "The connector itself is Rust (ADR 0017) — `rust-gate` below is this repo's real gate. The npm
> surface that remains is devnet tooling only (the faucet, its Mina zkApp, the faucet dApp, and
> `tools/fund-peers`), so this job just keeps it lint-clean and formatted."

Root `package.json` agrees: `"private": true`, description *"Rust connector — plus the devnet faucet
tooling and Solidity contracts it is exercised against"*, workspaces limited to
`packages/announcer`, `packages/faucet`, `packages/mina-usdc-faucet-web`, `packages/mina-zkapp`,
`tools/fund-peers`.

### npm packages this repo publishes

| Package | Version | Published? | Kind |
|---|---|---|---|
| `connector` (root) | 3.3.0 | **No** — `private: true` | workspace root |
| `@toon-protocol/mina-zkapp` | 0.1.1 | **Yes** — `publishConfig.access: public`, via the manual `publish:mina-zkapp` script | Mina zkApp (chain artifact) |
| `@toon-protocol/announcer` | 0.1.0 | No — `private: true` | discovery sidecar |
| `@toon-protocol/faucet` | 1.0.0 | Not published (no CI publish job; devnet-internal) | devnet tooling |
| `@toon-protocol/mina-usdc-faucet-web` | 0.1.0 | No — `private: true` | dApp |
| `@toon-protocol/fund-peers` | 0.1.0 | Not published | devnet script |

**None of these is a connector implementation.** `.github/workflows/` contains no npm-publish job at
all; the only publishing workflow is `publish-connector-rust-image.yml` (the Rust Docker image).
`publish:mina-zkapp` in root `package.json` is a manual, human-invoked script.

### What purging TS from this repo would involve

Small, and not on the critical path for anything about the peer wire.

1. **Free wins now.** Delete the untracked `packages/shared/` and `tools/send-packet/` leftovers
   (working-copy hygiene, zero tracked files). Nothing references them.
2. **Move, don't delete, the three real assets.** `packages/mina-zkapp` (the only published npm
   artifact; a Mina zkApp is a chain artifact that has to live somewhere), `packages/faucet` +
   `packages/mina-usdc-faucet-web` (devnet operations), and `packages/announcer` (a running devnet
   sidecar, PR #683). Each would need its own repo or a shared `toon-devnet-tooling` repo, plus a
   new publish path for `@toon-protocol/mina-zkapp`.
3. **`.sandcastle/` cannot go** while the software-factory runners are TS and this repo is a factory
   row. That alone keeps Node, `tsx`, `typescript`, `eslint` and `prettier` in root devDependencies.
4. **Then the toolchain drops out:** root `package.json` workspaces, `jest.config.js`,
   `babel.config.js`, `tsconfig.base.json`, `.eslintrc.json` / `.eslintignore`,
   `.prettierrc.json` / `.prettierignore`, `package-lock.json` + `pnpm-lock.yaml` (two lockfiles
   coexist today), `.nvmrc`, `patch-package`/`postinstall`, the `lint-staged` block, and the
   `lint-and-format` + `security` (npm audit / Snyk) jobs in `ci.yml` — which would also need
   `ci-status` rewired.
5. **Net effect on the connector: none.** No Rust crate depends on any TS package. This is a
   repo-hygiene exercise, not an architectural one.

---

## Evidence index

Files read (all absolute, in `/home/jonathan/Documents/connector`):

- `crates/connector-runtime/src/peer_wire.rs`
- `crates/connector-runtime/src/peer_transport.rs`
- `crates/connector-runtime/src/network_peer_transport.rs`
- `crates/connector-runtime/src/connector.rs`, `.../lib.rs`
- `crates/connector-config/src/peer.rs`, `.../config.rs`, `.../error.rs`
- `crates/connector-cli/src/runtime.rs`, `.../lib.rs`
- `crates/connector-client-edge/src/btp.rs`, `.../lib.rs`
- `docs/protocol/peer-wire-spec.md`
- `docs/adr/0003-…md`, `0017-…md`, `0026-client-btp-rides-the-client-edge-peers-stay-on-the-peer-wire.md`
- `git show 370d53a3:docs/adr/0026-connectors-peer-over-btp-the-clean-room-peer-wire-is-retired.md`
- `infra/linode-node/connector-rust.toml`, `infra/linode-store/connector-rust.toml`
- `.github/workflows/ci.yml`, root `package.json`, all `packages/*/package.json`

Commits: `59e167f2` (HEAD) · `370d53a3`, `fa518660` (unmerged ADR branch) · `37440320`, `bb8e12c9`
(merged ADR 0026 / client BTP) · `3536cca0` (#702, upstream only) · `2d981565` (#543, TS retirement)
· `c4a4ad10` (#465) · `69815282` (#433, ADR 0003) · `d4fac5d9` (#532, ADR 0017) · `37f5166c` (#598).

GitHub state as of 2026-08-03: PR #675 OPEN · issues #676/#677/#678/#679 OPEN · #620 OPEN · #623 OPEN
· #711 OPEN · #697 CLOSED (PR #702 MERGED) · #701 CLOSED (PR #704 MERGED) · PR #680, #689, #543, #465
MERGED.
