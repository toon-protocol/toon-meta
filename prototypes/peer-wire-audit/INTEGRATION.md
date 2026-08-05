# Peer-carriage integration branch

Merge-and-verify of the five open peer-carriage PRs onto one branch, run against the full
`rust-gate` exactly as CI runs it.

- **Repo:** `github.com/toon-protocol/connector`
- **Branch:** `integration/peer-carriage`, branched from `origin/main` @ `87595db7`
- **Head:** `8c5d5d72` (pushed; **no PR opened, nothing merged to `main`**)
- **Date:** 2026-08-03

## Merge order

| # | Branch | PR | Merge commit | What it is |
| - | ------ | -- | ------------ | ---------- |
| 1 | `adr/btp-peer-transport` | #675 | `ec8b833d` | ADR 0027 + the bring-up runbook (docs) |
| 2 | `spec/peer-carriage` | #720 | `129626ec` | `docs/protocol/peer-carriage-spec.md` (docs) |
| 3 | `refactor/btp-codec-extraction` | #717 | `688c4b7f` | BTP codec → new leaf crate `crates/connector-btp` |
| 4 | `feat/delete-peer-wire` | #718 | `dd04b679` | deletes the raw-TCP peer wire, keeps the `PeerTransport` port |
| 5 | `feat/peer-config-schema` | #723 | `8c5d5d72` | peer config schema + its ten named load-time errors |

Merges 1 and 2 were clean. Merges 3, 4 and 5 conflicted.

## Conflicts and resolutions

### Unexpected — merge 3 (#717) vs `main`

**`crates/connector-client-edge/src/btp.rs` — two content conflicts. Not on the predicted list.**

`main` moved forward after #717 was cut: `87595db7` ("RALPH: client session registry with fencing
generations", issue #698) edited the very types #717 was in the middle of relocating. `main` raised
`OutboundRequests` / `BtpSessionHandle` from private to `pub(crate)` and added a session-registry
bind/touch/unbind path that *calls* `BtpSessionHandle::new` from production code; #717 deleted those
same definitions from `btp.rs` and re-homed them in `crates/connector-btp/src/session.rs` as fully
`pub`.

- **Resolution:** #717's side wins for both hunks — the types now live in `connector-btp`, which
  already exposes them `pub` (a superset of what `main` needed). Two follow-on edits were required
  to make `main`'s newer code compile against the moved definitions:
  - `btp.rs`: added `BtpSessionHandle` to the `use connector_btp::{…}` list (production code now
    calls it; #717 had only imported it in tests).
  - `session_registry.rs` (a file #717 never saw, added by `main` in `87595db7`): repointed
    `use crate::btp::{BtpFrame, BtpSessionHandle, OriginateError, ProtocolData}` and
    `use crate::btp::{decode_frame, OutboundRequests}` to `use connector_btp::{…}`.

  Two `use` lines and one import list. No logic changed on either side.

**Why this matters:** #717 has *not* been rebased since `87595db7` landed. It will hit this exact
conflict against `main` on its own, and `session_registry.rs` will not compile without the import
fix. See the verdict.

### Predicted — merge 4 (#718)

- **`docs/protocol/peer-wire-spec.md`, #675 vs #718.** #675 banners §1–§2 as superseded; #718
  deletes §1–§2 and replaces them with a "What this document is now" preamble.
  **Resolved:** #718's deletion wins, with the two pieces of #675's banner that the preamble did not
  already carry folded into it — (a) the `Originally: normative, version 1 — clean-room design per
  ADR 0003` provenance line, restored to the status block, and (b) the concrete BTP mapping
  ("on the BTP carriage a FLUSH is a TRANSFER, and a CLAIM_ACK is a `claim-ack` protocolData entry
  on the RESPONSE"), which #718 had reduced to "the two whose mapping is not obvious".
  §3–§6 and their numbering are byte-untouched; verified the headings still read
  `## 3.` … `### 3.6`, `## 4.`, `## 5.` … `### 5.3`, `## 6.`.
- **#720's deferred cross-link.** Added, now that both are in one tree: a short paragraph in
  `peer-wire-spec.md`'s preamble pointing at `peer-carriage-spec.md` as normative for the carriages
  and noting that it sits beside §3–§6 and supersedes nothing in them.
- **`tests/two_connectors_and_a_stub_app.rs`.** Deleted on both #718 and #723; delete/delete merged
  clean, no conflict. Its surviving assertion is present exactly once, as
  `exits_non_zero_when_a_peer_route_names_an_unconfigured_peer_id` in `refuses_to_start.rs`.

### Predicted — merge 5 (#723)

Seven files conflicted. All resolved without new behaviour.

| File | Resolution |
| ---- | ---------- |
| `connector-config/src/peer.rs` | **#723 wins wholesale.** #723's rewrite already subsumes #718's: it drops `addr: String`/`SocketAddr`, keeps `addr: Option<toml::Value>` as a parsed-and-rejected field, and returns `ConfigError::PeerAddrRemoved`. Nothing of #718's was lost. |
| `connector-config/src/error.rs` | **Keep-one-copy, as predicted.** Both branches define `PeerAddrRemoved { id: String }` with a byte-identical `#[error(...)]` message (verified character-for-character across the conflict hunk). Kept #723's copy — exactly one `PeerAddrRemoved` and exactly one `PeerWireAddrRemoved` remain. Also dropped #723's retained `InvalidPeerWireAddr` variant, because #718 deletes the listener that constructed it; it is dead on the merged tree. |
| `connector-cli/src/runtime.rs` | **#718 supersedes**, as predicted: `let peer_transport = InProcessPeerTransport::new();`. #723's explanatory comment was kept (it is the better comment) with its `NetworkPeerTransport` reference corrected. |
| `connector-config/src/config.rs` | Ten hunks. #723's schema wins everywhere (`peer_expose`, `peer_channels`, the `PeerExposure`/`PeerCarriage` accessors, its richer `peering_config` test fixture and its own `rejects_a_duplicate_peer_id`), **except** for `peer_wire_addr`, where #718 wins: the raw field stays `Option<toml::Value>` and rejects, the `Config::peer_wire_addr()` accessor and struct field stay deleted, and `a_config_using_every_supported_section_still_loads` had its `peer_wire_addr = "127.0.0.1:4001"` line and its `assert!(config.peer_wire_addr().is_some())` removed. This is the reconciliation #723's own `PeerWireAddrRemoved` doc comment predicts ("defined here, constructed there"). |
| `connector-bin/tests/refuses_to_start.rs` | Both branches independently added the same two tests. Deduplicated: all four peer tests present exactly once — `exits_non_zero_when_a_peer_route_names_an_unconfigured_peer_id`, `exits_non_zero_when_a_stale_peer_entry_sets_addr`, `exits_non_zero_when_a_stale_config_sets_peer_wire_addr` (#718 only), `exits_non_zero_when_a_peer_configures_no_credential` (#723 only). The two section-header comments were merged into one. |
| `deploy/connector-rust/README.md` | Both rewrote the same paragraph. Merged: #723's "here is how to peer" instructions (`peer_expose`, `endpoint`, `credential`, `[[peer_channels]]`) plus #718's statement that `peer_wire_addr` and `[[peers]].addr` are now hard load errors. |
| `docs/operators/btp-peer-transport-bringup.md` | **Add/add.** Two genuinely different documents with the same filename: #675 wrote an operator *runbook* for the first Rust peer link; #723 wrote the *config-surface reference* that every load-time error message points at. Both are needed and neither subsumes the other. Merged into one file — #675's runbook, then a `# The peer config surface` half carrying #723's content whole. While merging, fixed a link #723 had wrong: it cited `0027-connectors-peer-over-btp-and-the-raw-tcp-peer-wire-is-deleted.md`, but #675's later commit renamed the ADR to `0027-connectors-peer-over-btp-**or-http**-and-the-raw-tcp-peer-wire-is-deleted.md`. |

Nothing was deleted to get green. Two test *assertions* were removed, both because they assert on a
field #718 deliberately deletes (`config.peer_wire_addr()`); the behaviour they used to cover is
covered by #718's replacement test `rejects_a_config_that_still_sets_peer_wire_addr`.

## Gate output

Run in the integration worktree at `8c5d5d72`, exactly as CI runs them.

| Command | Result |
| ------- | ------ |
| `cargo fmt --all --check` | **pass** (exit 0, no diff) |
| `cargo build --workspace` | **pass** (exit 0; only the pre-existing `packages/solana-program` warnings, unchanged from `main`) |
| `cargo test --workspace --exclude payment-channel` | **pass** — 46 suites, **929 passed, 0 failed**, 3 ignored |
| `cargo clippy --workspace --exclude payment-channel --all-targets -- -D warnings` | **pass** (exit 0, no warnings) |

For reference, the same suite was also green at the intermediate merges: 30 binaries / 0 failures
after #717, and again after #718.

## Verdict

**The five PRs can be merged to `main` in this order — but #717 needs a fix first, and #723 needs
one line removed. The other three are safe as they stand.**

### Blocking: #717 (`refactor/btp-codec-extraction`)

**Needs a rebase onto `main` before merge.** It was cut before `87595db7` (issue #698, the client
session registry) and does not contain it. Merging it as-is produces:

1. Two content conflicts in `crates/connector-client-edge/src/btp.rs` — mechanical, resolved by
   taking #717's side.
2. **A compile failure that the conflict resolution alone does not fix.** `session_registry.rs` is a
   file #717 has never seen; it imports `BtpSessionHandle`, `OriginateError`, `BtpFrame`,
   `ProtocolData`, `decode_frame` and `OutboundRequests` from `crate::btp`, and after #717 those
   names are no longer re-exported from that module. Two `use` lines must be repointed at
   `connector_btp`. `main`'s new production call to `BtpSessionHandle::new` also needs that name
   added to `btp.rs`'s import list.

None of it is hard, but it is not something a merge-conflict resolver will produce by accident, and
a merge queue that auto-resolves will hand `main` a red build. The exact three-line fix is in
`8c5d5d72`'s history and can be cherry-picked onto #717.

### Blocking (one line): #723 (`feat/peer-config-schema`)

#723 is correct **only after** #718 lands. On its own it keeps `peer_wire_addr` working
(`InvalidPeerWireAddr`, a live accessor, and a test fixture that sets the field and asserts it
parses) while also defining `PeerWireAddrRemoved` for #718 to construct. That is deliberate and
documented in the code. The consequence for a merge to `main`:

- **Merged after #718 (this order): fine**, but the merge is not automatic — the resolver must know
  that #718 wins on every `peer_wire_addr` question. Specifically, `a_config_using_every_supported_section_still_loads`
  must lose its `peer_wire_addr = "127.0.0.1:4001"` line and its `assert!(config.peer_wire_addr().is_some())`,
  and the `InvalidPeerWireAddr` variant must go. Left alone, that test fails loudly (the config no
  longer loads) — it will not pass silently, which is the good failure mode.
- **Merged before #718: `main` briefly ships a live `peer_wire_addr` that binds a listener for a
  transport that still exists.** Harmless but pointless. Keep the stated order.

Recommended: after #718 lands, push the `peer_wire_addr` cleanup onto #723 so its own CI proves it,
rather than discovering it in the merge.

### Non-blocking: #675, #720, #718

- **#675** merges clean and is docs-only.
- **#720** merges clean and is a single new file. Its one deferred follow-up — the cross-link into
  `peer-wire-spec.md` — is done on this branch and should be carried over by whichever of #718/#720
  lands second.
- **#718** conflicts only with #675, and only in `peer-wire-spec.md`'s header block. The resolution
  is judgement, not mechanics: #718's deletion is right, but #675's ADR-0003 provenance line and its
  concrete FLUSH→TRANSFER / CLAIM_ACK→`claim-ack`-on-RESPONSE mapping are content that exists
  nowhere else and must be carried into #718's preamble. Take this branch's version of that header.

### Smaller things worth fixing

1. **Duplicate filename, two documents.** #675 and #723 both create
   `docs/operators/btp-peer-transport-bringup.md` with entirely different content. Neither PR's
   author appears to know the other exists at that path. Merged here, but it should be a deliberate
   decision (one file with two halves, as done here, or split into
   `btp-peer-transport-bringup.md` + `peer-config-reference.md`) rather than whatever the second
   merge happens to produce.
2. **Broken ADR link in #723.** It cites the pre-rename ADR filename
   (`0027-connectors-peer-over-btp-and-…`); #675 renamed it to
   `0027-connectors-peer-over-btp-or-http-and-…`. Fixed here.
3. **Doc/implementation drift on the expose field.** #675's runbook says `[peers].expose`; #723
   implements the top-level `peer_expose` (and explains why TOML forces it). The runbook half of the
   merged bring-up doc still says `[peers].expose` in its Preconditions section — worth a one-line
   correction on #675 or a follow-up.
4. **Duplicated tests across #718 and #723.** `exits_non_zero_when_a_peer_route_names_an_unconfigured_peer_id`
   and `exits_non_zero_when_a_stale_peer_entry_sets_addr` were each written twice, independently,
   from the same deleted `two_connectors_and_a_stub_app.rs`. Merging in either order produces a
   conflict that a careless resolution turns into a duplicate-symbol compile error. Deduplicated
   here.
