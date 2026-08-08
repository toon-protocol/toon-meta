# Two-node target architecture: relay + store, carrying for each other

**Status:** target architecture. Owner-decided 2026-08-07 ([toon-meta#314](https://github.com/toon-protocol/toon-meta/issues/314), part of [#262](https://github.com/toon-protocol/toon-meta/issues/262)). Not up for re-derivation — this document writes it down precisely, it does not argue for it.

**Scope:** three boxes, two connectors, one bidirectional payment channel between them, a faucet with no connector at all, and the retirement of `g.toon` as a node.

> **Unreconciled, as of 2026-08-07.** Three things landed or were found while this was being written. They are flagged here rather than folded in, because two of them are owner decisions that conflict and only the owner can settle which one stands.
>
> 1. **The faucet's destination is contested.** §4 places the faucet on its **own** Linode with **no** connector, per [#314](https://github.com/toon-protocol/toon-meta/issues/314)'s own §4. Connector PR [#892](https://github.com/toon-protocol/connector/pull/892) (open) instead moves the faucet **onto the relay box**, alongside that box's connector, citing [toon-meta#310](https://github.com/toon-protocol/toon-meta/issues/310) — an open, earlier spec for the same retirement. #892 also keeps `MINA_FAUCET_KEY` and the native-MINA leg that §4.6 drops. **§4 is written to #314 and has not been changed to match #892.**
> 2. **The genesis seed's pubkey may not need to change.** §5.3 lists the seed's `pubkey` as an edit. Connector PR [#892](https://github.com/toon-protocol/connector/pull/892) gives the relay box `[announce] identity_key_file = "/app/data/announce.key"` so it **adopts box 1's announcer identity** (`30fdd01d…`) — the exact pubkey the committed seed already pins. If #892 merges and the box is cut over, that row drops out of §5.3 and only `ilpAddress` and `btpEndpoint` change.
> 3. **§6.2 step 10 has landed at repo level.** Connector PR [#891](https://github.com/toon-protocol/connector/pull/891) (open) repoints the store box's `[announce] publish_btp_url` from `wss://proxy.devnet.toonprotocol.dev/ilp/btp` to `wss://proxy.relay.devnet.toonprotocol.dev/ilp/btp`. §6.1's producer table and §6.2 step 10 still describe the **live box**, which the repo change does not touch (the bind-mounted file leads). Step 10 remains a human step; its repo half is done.

**This document changes no box.** Every step that touches a live box is a human step in the runbook in §6. Merging a PR against any repo named here rolls nothing: the devnet boxes run hand-tuned, bind-mounted configs that **lead** the repo copies, and `docker compose up -d` does not reload a bind-mounted file — it reports `Running` and changes nothing ([`docs/operators/peer-channel-migration.md:22-28, 47-49`](https://github.com/toon-protocol/connector/blob/main/docs/operators/peer-channel-migration.md), connector repo; the same statement appears in [`docs/adr/0009-one-typed-config-file-no-environment-layer.md:13-14`](https://github.com/toon-protocol/connector/blob/main/docs/adr/0009-one-typed-config-file-no-environment-layer.md) and is asserted as a test rationale in `crates/connector-bin/tests/refuses_to_start.rs:547-548`).

---

## 0. The shape, and the vocabulary

### 0.1 The target

| Box | Linode label | App | Connector | ILP address it terminates |
|-----|-------------|-----|-----------|---------------------------|
| relay | `relay` | Nostr relay | yes | `g.toon.relay` |
| store | `ario` | Arweave store | yes | `g.toon.ario` |
| faucet | *new* | USDC faucet | **no** | — |

The relay's connector and the store's connector **carry for each other for a fee**. `g.toon` ceases to exist as a node, and box 1 (Linode label `toon`, the box that answers to `g.toon` today) retires.

### 0.2 What the codebase does *not* have, so this document does not use it

ILP's parent / child / peer taxonomy **does not exist in this codebase**. There is no `relation` field, no CCP, no route propagation, and no notion of one node being above another.

- A `[[routes]]` row is a prefix plus exactly one of `handler_url` (terminate here) or `peer_id` (forward over that peering) — `resolve_routes` in `crates/connector-config/src/config.rs:279`, shapes in `crates/connector-config/src/route.rs`.
- Prefixes are **opaque strings matched longest-first**, with a segment-boundary rule so `g.toon.relay` does not match `g.toon.relayed`. Selection: `crates/connector-runtime/src/connector.rs:1184-1198` (`max_by_key` over matched prefix length, then priority); the matching predicate is stated again for the announce path at `crates/connector-cli/src/announce.rs:1207-1213`.
- `g.toon` is not a parent of `g.toon.relay` in any code path. It is merely a shorter string that no routing table on the target fleet will contain.

The one place a hierarchy is implied is on the **client** side, in `@toon-protocol/core`:

```ts
// packages/core/src/address/address-assignment.ts:48-50
export function isGenesisNode(config: { ilpAddress?: string }): boolean {
  return config.ilpAddress === ILP_ROOT_PREFIX;
}
// packages/core/src/constants.ts:149
export const ILP_ROOT_PREFIX = 'g.toon';
```

It is a hardcoded exact-string equality, one constant-indirection deep. Nothing on the connector side reads it. §5 says what happens to it.

### 0.3 The routing table *is* the relationship set, and it is enforced at load

There is no separate "who are my peers" concept to keep in sync with routing. `Config::load` refuses, before the process runs:

| Refusal | Meaning | Citation (connector repo) |
|---|---|---|
| `UnknownPeerId` | a `[[routes]]` row names a `peer_id` with no `[[peers]]` entry | `crates/connector-config/src/config.rs:285` |
| `PeerRouteUndeliverable` | the route's next hop is a peering this connector can never originate to | `crates/connector-config/src/config.rs:297` |
| `PeerChannelOrphaned` | a `[[peer_channels]]` row names a peer that does not exist | `crates/connector-config/src/config.rs:308` |
| `PeerChannelUnbound` | a `[[peers]]` entry has no `[[peer_channels]]` row, so it could never take the peer role | `crates/connector-config/src/config.rs:322` |
| `AcceptOnlyPeerWithoutCeiling` | a peering with no `endpoint` and no explicit `ceiling` | `crates/connector-config/src/peer.rs:562` |

Per ADR 0009, an `Err` here stops the process before anything else starts (`crates/connector-config/src/config.rs:252-255`). A misconfigured relationship is a boot failure, not a runtime surprise.

### 0.4 Prose conventions in this document

- "box 1" means the box that answers to `g.toon` today (Linode label `toon`, `infra/linode-node/`). Never "apex", never "router".
- Config keys, peer ids (`apex-store`, `apex-relay`) and ILP addresses are quoted **verbatim** and are never renamed. Where a quoted identifier or file path contains the word "apex", it is an identifier, not prose.
- All money figures are **base units of 6-decimal USDC** — `1000` is 0.001 USDC, `1` is 1 µUSDC ([`docs/devnet-pricing.md:7-11`](https://github.com/toon-protocol/connector/blob/main/docs/devnet-pricing.md)).

---

## 1. Peering, both directions

### 1.1 What a `[[peers]]` row is, exactly

A `[[peers]]` row is **one peering relation**, as seen from the node whose config file it is in — never per carriage and never per connection (`crates/connector-config/src/peer.rs:390-407`). It carries this node's own outbound facts:

- `endpoint` — the URL **this** connector dials to reach the peer. Absent means **accept-only**: this connector never dials, the counterparty dials in (`crates/connector-config/src/peer.rs:414-422`).
- The carriage is decided **solely by the endpoint's scheme** — `wss://` is BTP, `https://` is ILP-over-HTTP. There is no `transport` field on a peering (`crates/connector-config/src/peer.rs:40-49`).
- `credential` — the secret. `PeerCredential::secret()` is documented as "the secret this connector presents when it dials this peer" (`crates/connector-config/src/peer.rs:325-328`).
- `ceiling` — the most unclaimed value this connector will carry for the relation before refusing (`crates/connector-config/src/peer.rs:448-455`).

### 1.2 A correction the spec must carry: the row is two-sided for the **peer role**

It is tempting to say "a `[[peers]]` row is purely the sending node's own outbound config, the counterparty needs no matching row and never sees the secret." **For the peer role that is not what the code does, and building the fleet on it would produce two boxes that silently never peer.**

The same `credential` is also the **inbound admission record**. `PeerCredential::matches()` — "whether `presented` is this peering's configured secret", constant-time (`crates/connector-config/src/peer.rs:305-323`) — is called on the receiving side at `crates/connector-peer-auth/src/credential.rs:115`. The role rule (P1) is: the interaction presented a credential naming a peer id that appears in `[[peers]]`, **and** the presented secret matched that peer's configured secret (`crates/connector-peer-auth/src/lib.rs:16-18`).

The failure mode if you get this wrong is deliberately quiet. An interaction that names a configured peer id with the wrong secret is **not refused** — it is downgraded to the client role, because refusing would make the credential check an oracle for which peer ids are configured (`docs/protocol/peer-carriage-spec.md:150-163`). The spec's own named regression list requires that "a correct `peerId` with a wrong `secret`" reaches no peer handling whatsoever (`docs/protocol/peer-carriage-spec.md:218-232`). To an operator this presents as "peering configured, nothing peers, no error anywhere."

So: **the peer id string and the secret bytes must be identical on both boxes.** What *is* purely one-sided is the `endpoint` (only the dialer has one), the `ceiling`, the `[[routes]]` rows, and the prices.

The version of the claim that **is** true, and that §2b depends on, is about **carriage bought at the client edge**: paying another node's client edge as an ordinary client requires no shared credential and no row on either side. That is exactly what the store box does today (§2b.4).

### 1.3 Which rows go on which box

The relay↔store relation is **new**. It is not `apex-store` and not `apex-relay` — those two ids name box 1's relations and are not renamed, reused, or repointed by this spec. The new relation's id is **`relay-store`**, and it is the only new identifier this document introduces. It must be byte-identical in both files, per §1.2.

**The relay box dials; the store box accepts.** One `wss://` session, and a dialed BTP session is symmetric — either side may originate on it once established (`docs/protocol/peer-carriage-spec.md:279-289`, and in code `let can_originate = endpoint.is_some() || expose.exposes(PeerCarriage::Btp);` at `crates/connector-config/src/peer.rs:565`). This is what makes "carry for each other" possible over a single connection. Both boxes already set `peer_expose = "btp"` (`infra/linode-relay/connector-rust.toml:73`, `infra/linode-store/connector-rust.toml:211`), so the store box's accept-only row still passes the `PeerRouteUndeliverable` check on its own forwarding route.

**Relay box — `infra/linode-relay/connector-rust.toml`, rows to ADD:**

```toml
[[peers]]
id = "relay-store"
# This box dials. `wss://` selects BTP; the session is symmetric once up,
# so the store box originates back over this same connection.
endpoint = "wss://proxy.ario.devnet.toonprotocol.dev/ilp/btp"
credential = { secret_file = "/app/data/relay-store.secret" }
ceiling = 1000000
flush_interval_ms = 5000

[[peer_channels]]
peer_id = "relay-store"
channel_id = "0x<the new relay<->store channel, §3>"
counterparty_key = "0x<the STORE box's EVM settlement address>"
chain_id = 84532
token_network = "0xa79C3b1dbcEA00a6d84735a134395D8eF6D6a478"

[[routes]]
prefix = "g.toon.ario"
peer_id = "relay-store"
price = 1001
fee = 1
```

**Store box — `infra/linode-store/connector-rust.toml`, rows to ADD:**

```toml
[[peers]]
id = "relay-store"
# No `endpoint`: accept-only. The relay box dials in, and this box originates
# on that session. `ceiling` is therefore MANDATORY
# (ConfigError::AcceptOnlyPeerWithoutCeiling).
credential = { secret_file = "/app/data/relay-store.secret" }
ceiling = 1000000

[[peer_channels]]
peer_id = "relay-store"
channel_id = "0x<the SAME channel id as above, §3>"
counterparty_key = "0x<the RELAY box's EVM settlement address>"
chain_id = 84532
token_network = "0xa79C3b1dbcEA00a6d84735a134395D8eF6D6a478"

[[routes]]
prefix = "g.toon.relay"
peer_id = "relay-store"
price = 2
fee = 1
```

Notes on the shapes above, each checked against the loader:

1. **`counterparty_key` differs between the two files, `channel_id` does not.** `counterparty_key` is "the address whose signature this node accepts on a peer claim for this channel — never the claim's own self-declared signer" (`crates/connector-config/src/peer_channel.rs:113-118`). Each box names the *other* box's settlement address. `channel_id` is one on-chain identifier, written identically in both files. See §3.
2. **The channel id may not also appear in `[[client_channels]]`** on either box — peer and client watermarks are separate namespaces and one channel in both would let a claim be counted as credit twice (`ConfigError::ChannelInBothNamespaces`, `docs/protocol/peer-carriage-spec.md:198-206`).
3. **The store box's `[[peers]]` row must carry an explicit `ceiling`.** With no `endpoint` there is no live session to read liveness from and a defaulted ceiling would be an unowned credit decision (`crates/connector-config/src/peer.rs:557-563`).
4. **`transport` is illegal on a `peer_id` route** — `ConfigError::PeerRouteHasTransport` (`crates/connector-config/src/error.rs:125`). The relay box's existing `transport = "btp"` pin stays on its own terminating `g.toon.relay` route (`infra/linode-relay/connector-rust.toml:205`) and does not move to either new forwarding row.
5. **`price` is required on a forwarded route** — `ConfigError::PeerRouteMissingPrice`, per ADR 0028. A forwarded route is never *silently* free.

### 1.4 Rows to DELETE, and when

The `apex-relay` rows on the relay box (`infra/linode-relay/connector-rust.toml:78-102`) and the `apex-store` rows on the store box (`infra/linode-store/connector-rust.toml:216-258`) describe relations to box 1. They are removed **only in the last step of §6**, after box 1 stops carrying traffic — not before. Removing a `[[peers]]` row while a `[[routes]]` row still names it is `UnknownPeerId` and the connector will not boot (§0.3).

---

## 2. Fee and price arithmetic, both ways

### 2.1 The three rules the numbers must satisfy

All three are already implemented; none of them is new to this spec.

**R1 — the client edge charges `price`, and a forwarded packet never carries more than it was paid for.** `price` on a `peer_id` route is what this connector's own client edge charges a client for that prefix; `fee` is what this hop retains. The intended arithmetic is `amount == price`, and a client declaring more is refused `F03_INVALID_AMOUNT` (ADR 0028; `over_carried_reject` at `crates/connector-client-edge/src/lib.rs:1050-1057`).

**R2 — a hop forwards `amount − fee`.** `amount_after_fee(amount, fee, minimum_delivery)` is `amount.checked_sub(fee)`, then `R01_INSUFFICIENT_SOURCE_AMOUNT` if the result is below the sender's declared minimum delivery (`crates/connector-domain/src/fee.rs:19-22`, called from `crates/connector-runtime/src/connector.rs:976-978`; the normative statement is `docs/protocol/peer-wire-spec.md:200-204`).

**R3 — the terminating side charges its own price on a peer-wire arrival.** A peer-role PREPARE resolving to one of this connector's own priced terminated routes is refused `F03_INVALID_AMOUNT`, with `accumulatedCost = 0`, before the app is ever consulted, if `prepare.amount < route.price` (ADR 0029; `crates/connector-runtime/src/connector.rs:691-706`).

**The invariant is therefore `forwarding price − forwarding fee ≥ terminating price`, per direction.** A short forward is not a subsidy — it is an `F03` on *every single write* ([`docs/devnet-pricing.md:73-79`](https://github.com/toon-protocol/connector/blob/main/docs/devnet-pricing.md)).

### 2.2 Direction A — a client publishes to the store, entering at the relay box

| Step | Node | Number | Rule |
|---|---|---|---|
| Client pays the relay box's client edge for `g.toon.ario` | relay | `1001` | R1 |
| Relay box retains | relay | `fee = 1` | R2 |
| Relay box forwards over `relay-store` | → | `1001 − 1 = 1000` | R2 |
| Store box's terminating `g.toon.ario` price | store | `1000` | R3 |

Check: **`1001 − 1 = 1000 ≥ 1000`** ✓ — with equality, which is the intended shape (`amount == price` at each hop).

Compare the current fleet: a client pays box 1 `1002` for the same prefix, box 1 retains `2`, forwards `1000` (`infra/linode-node/connector-rust.toml:157,173,184,187`; guarded as `EXPECTED_APEX_FORWARD_PRICE = 1002` / `EXPECTED_APEX_FORWARD_FEE = 2` at `crates/connector-bin/tests/devnet_configs_load.rs:238,242`). The target lowers the client's cost for this prefix from `1002` to `1001`, because the relay box takes `1` where box 1 took `2`. The store box's `1000` is unchanged (`infra/linode-store/connector-rust.toml:354-356`; `EXPECTED_STORE_PRICE = 1000` at `crates/connector-bin/tests/devnet_configs_load.rs:200`).

### 2.3 Direction B — a client (or the store box) publishes to the relay, entering at the store box

| Step | Node | Number | Rule |
|---|---|---|---|
| Payer pays the store box's client edge for `g.toon.relay` | store | `2` | R1 |
| Store box retains | store | `fee = 1` | R2 |
| Store box forwards over `relay-store` | → | `2 − 1 = 1` | R2 |
| Relay box's terminating `g.toon.relay` price | relay | `1` | R3 |

Check: **`2 − 1 = 1 ≥ 1`** ✓ — again with equality.

The relay box's terminating price stays at `1`. That is not an oversight to be "fixed": `g.toon.relay` carries buzz huddles at 49 frames per second, so 1 µUSDC is a coherent per-frame price and 0.001 USDC per frame is not — an owner decision of 2026-08-04 ([`docs/devnet-pricing.md:48-53`](https://github.com/toon-protocol/connector/blob/main/docs/devnet-pricing.md); `EXPECTED_RELAY_PRICE = 1` at `crates/connector-bin/tests/devnet_configs_load.rs:227`).

**The store box's `fee = 1` doubles the per-frame cost for a payer entering at the store box (1 → 2 µUSDC).** That is a real consequence and it is acceptable here only because nothing routes huddle frames through the store box — huddle clients enter at the relay box, where `g.toon.relay` terminates locally at `price = 1` with no forward at all. If a huddle payer ever needs to enter at the store box, revisit this number rather than discovering it at 49 fps.

### 2.4 Why the two directions are not symmetric

Because the two terminating prices are not symmetric (`1000` vs `1`), and both fees are `1`. The relay→store fee is 0.1% of the packet; the store→relay fee is 100% of it. That is what `fee = 1 each way` means when one route is a per-frame stream and the other is a one-shot upload; it is stated here so a later reader does not "correct" one of them into the other.

### 2.5 What else must move with these numbers

- [`docs/devnet-pricing.md`](https://github.com/toon-protocol/connector/blob/main/docs/devnet-pricing.md) is the committed source of truth for what every devnet route charges. Its table (lines 16-21) must gain the two new rows and lose box 1's two.
- `crates/connector-bin/tests/devnet_configs_load.rs` pins the figures as named constants (`EXPECTED_STORE_PRICE:200`, `EXPECTED_RELAY_PRICE:227`, `EXPECTED_APEX_FORWARD_PRICE:238`, `EXPECTED_APEX_FORWARD_FEE:242`, `EXPECTED_RELAY_FORWARD_PRICE:253`, `EXPECTED_RELAY_FORWARD_FEE:262`) and loads all three box configs by `include_str!` (`:123-125`). Two of those constants describe box 1 and are deleted with it; two new ones (`1001`/`1` and `2`/`1`) take their place.

---

## 2b. How carriage is obtained — **SWAPPABLE, superseded by [connector#867](https://github.com/toon-protocol/connector/issues/867) if it lands**

> **Boundary.** This subsection is the whole of how the relay box and the store box come to carry for each other. Nothing outside it assumes *how* carriage was arranged — §1 says which rows exist, §2 says what the numbers must satisfy, §3 says the channel is one bidirectional channel, §§4-6 do not depend on carriage at all. If #867 lands, **replace this subsection and the row inventory in §2b.2 only**; §§1-6 keep their meaning.

### 2b.1 Today's mechanism: hand-wired bilateral peering

Carriage is arranged **out of band, by an operator**, and consists of exactly four artifacts per relation:

1. a shared `{peerId, secret}` pair, copied to both boxes by a human;
2. a `[[peers]]` row on each box naming that id (§1.3);
3. a `[[peer_channels]]` row on each box binding that id to one on-chain channel (§3);
4. a `[[routes]]` row with `peer_id` and a `price`/`fee` on each box (§2).

There is no runtime path that creates any of them. The operator surface exposes `/peers` as **GET only** (`crates/connector-operator/src/lib.rs:118`), and the peer set is fixed at load — an unknown peer id is a boot failure (`crates/connector-config/src/config.rs:285`). Peering is a config-file fact, full stop.

### 2b.2 The complete inventory this subsection owns

Everything #867 would make unnecessary as a hand-copied artifact:

| Artifact | Relay box | Store box |
|---|---|---|
| `[[peers]] id = "relay-store"` | with `endpoint` | accept-only, explicit `ceiling` |
| `credential = { secret_file = … }` | `/app/data/relay-store.secret` | `/app/data/relay-store.secret` (same bytes) |
| `[[peer_channels]] peer_id = "relay-store"` | `counterparty_key` = store's address | `counterparty_key` = relay's address |
| Forwarding `[[routes]]` row | `g.toon.ario`, 1001/1 | `g.toon.relay`, 2/1 |

The secret bytes are gitignored and live only on the boxes; the peering itself is tracked in git (the convention box 1's own file states, `infra/linode-node/connector-rust.toml:227-229`).

### 2b.3 What #867 would change, and what it would not

[connector#867](https://github.com/toon-protocol/connector/issues/867) — *"Sell peering: a priced peer route that adds the payer to the routing table, instead of an out-of-band {peerId, secret}"*, **open** — would make peering a **discoverable purchase**: a node exposes a priced route that, when paid, inserts the payer into its own `[[peers]]` and `[[peer_channels]]` tables. The buy side already exists as `pay_the_through_url` (`crates/connector-cli/src/announce.rs:1487-1590`).

If it lands, artifacts 1-3 in §2b.1 stop being hand-copied and become a runtime purchase, sequenced *on-chain channel open → pay the peer route naming the channel id → seller inserts both rows*. Artifact 4 — the buying node's own forwarding `[[routes]]` row and its `price`/`fee` — is a local pricing decision either way and stays where §2 puts it.

Two things #867 explicitly does **not** remove, per the issue: the `{peerId, secret}` credential itself (a peer PREPARE may legally carry no claim, so the role cannot ride on a signature), and the need for a durable, restart-surviving mutable peer table with defined precedence against the config file — which does not exist today.

### 2b.4 The escape hatch that already works, and is already in production

**A node can pay another node's app without any peering at all**, by paying its client edge as an ordinary client. This requires no shared credential, no `[[peers]]` row on either side, and no `[[peer_channels]]` row. It is ADR 0028's world: a route is priced at the client edge, and the client edge cannot tell a peer-role payer from any other.

The store box does exactly this today. Its `[announce]` block pays box 1 as a client — `publish_to = "g.toon.relay"`, `publish_btp_url = "wss://proxy.devnet.toonprotocol.dev/ilp/btp"`, and a `pay_channel` that is **deliberately not** a `[[client_channels]]` row, because that table is channels this node *receives* on and one channel in both roles is the `ChannelInBothNamespaces` collision (`infra/linode-store/connector-rust.toml:291-349`, with the reasoning in the file's own comments).

**Live corroboration (do not contradict):** an `apex-store` peering exists between box 1 and the store box, but its deposit on channel `0x0bfd0b88…` is 0, so a claim there fails `InsufficientHeadroom` and the announce falls back to a client channel. The refusal is deliberate and quotes the number: a claim above what has actually been deposited could never be redeemed on chain, so it is refused up front rather than bought (`crates/connector-cli/src/announce.rs:1548-1556`).

This matters to the swap in two ways. It is the fallback if the `relay-store` peering is not ready when box 1 goes away — the two boxes can pay each other as clients at the same prices, earning no carriage fee but delivering every packet. And it is the reason §§3-6 do not need to know how carriage was arranged.

---

## 3. One bidirectional relay↔store channel, and both deposits

### 3.1 Channels are bidirectional by design, on both chains

**One `channelId`, two per-participant legs, each with its own deposit, nonce and ratchet.** This is a property of the deployed contracts, not a convention.

**EVM** — `packages/contracts/src/TokenNetwork.sol`:

```solidity
// :62-67
struct ParticipantState {
    uint256 deposit;            /// Total deposited by participant
    uint256 nonce;              /// Monotonically increasing state counter
    uint256 transferredAmount;  /// Cumulative amount sent to counterparty
}
// :82-83
mapping(bytes32 => mapping(address => ParticipantState)) public participants;
```

`setTotalDeposit(channelId, participant, totalDeposit)` credits **one named participant's** leg (`:255-296`). `claimFromChannel` recovers the signer, requires it to be the counterparty, checks `balanceProof.nonce > participants[channelId][counterparty].nonce`, and requires `counterpartyState.deposit >= newTransferred` — reverting `InsufficientChannelBalance` otherwise (`:337-352`). Each direction of payment is judged **entirely against the paying participant's own leg**.

**Solana** — `packages/solana-program/src/state.rs:74-88`: one `ChannelState` PDA holds `participant_a`, `participant_b`, `deposit_a`, `deposit_b`, `transferred_amount_a`, `transferred_amount_b`, `nonce_a`, `nonce_b`. Same shape, same conclusion.

**Therefore:** a `(10 USDC, 0)` state is a **funding condition** — one leg funded, the other not — and never evidence of a missing channel. **Do not specify two channels where one is needed.**

### 3.2 The config side agrees: one row, one channel id, per relation per box

`[[peer_channels]]` has one row per peering relation on each box. It names `channel_id` (canonicalized to lowercase `0x`-hex however the operator wrote it — "the same value a peer claim names the channel by", `crates/connector-config/src/peer_channel.rs:100-110`) and `counterparty_key` (the address whose signature *this* node accepts on an inbound claim, `:112-118`). The two boxes therefore write the **same** `channel_id` and **different** `counterparty_key` values. There is no second row and no second id.

The runtime enforces exactly that reading. `ClaimBook`'s `counterparties` map is documented as "the EVM address whose signature this connector accepts on a claim for that channel — **recovered from the signature** … never the claim's own self-declared field" (`crates/connector-runtime/src/claim.rs:438-442`), and `ClaimBook::verify_signature` returns `UnknownChannel` when the channel or its counterparty is unconfigured and `SignatureInvalid` when the recovered signer does not match — on both the EVM and the Solana arm (`crates/connector-runtime/src/claim.rs:1055-1089`). A `counterparty_key` naming the wrong box does not mis-credit; it refuses.

For reference, the Solana shape uses `channel_account` (the PDA) and `program_id` instead of `channel_id`/`chain_id`/`token_network`, selected by `#[serde(untagged)]`; the two shapes are `deny_unknown_fields` and can never blend (`crates/connector-config/src/peer_channel.rs:9-77`).

### 3.3 The channel this spec calls for

**Open a NEW channel between the relay box's settlement identity and the store box's settlement identity.** Existing channel `0x62c81d83…` is to be **LEFT ALONE** — it is not repurposed, not redeposited, and not renamed by this spec.

Chain: **Base Sepolia (`chain_id = 84532`)**, `token_network = "0xa79C3b1dbcEA00a6d84735a134395D8eF6D6a478"` — the pair both boxes already carry on their existing peer-channel rows (`infra/linode-relay/connector-rust.toml:101-102`, `infra/linode-store/connector-rust.toml:257-258`).

Nothing on chain prevents a second channel between the same pair — `openChannel` derives `channelId = keccak256(p1, p2, channelCounter)` from an incrementing counter, so `ChannelAlreadyExists` cannot fire in practice (`packages/contracts/src/TokenNetwork.sol:214-246`). One channel is nonetheless what this spec calls for, because one channel is what the two legs already give you.

### 3.4 Both deposits, and why both are needed

| Leg | Depositor | Pays for | Must cover |
|---|---|---|---|
| relay leg | relay box | `g.toon.ario` forwards to the store box | `1000` per forwarded packet, cumulative |
| store leg | store box | `g.toon.relay` forwards to the relay box | `1` per forwarded packet, cumulative |

Both legs must be funded before either direction can be claimed. Funding one leg and calling the channel "open" reproduces exactly the `apex-store` condition described in §2b.4: the peering exists, the config loads, and every claim in the unfunded direction fails.

**Sizing.** Deposits are cumulative, not per-packet, and a claim is refused at `claimed > deposited` (`ClaimIngestRejection::Undercollateralized`, `crates/connector-client-edge/src/claim_gate.rs:211-224, 1250-1258`). Size each leg for the traffic it *pays for*, which is the opposite of the traffic it earns from. Both boxes' existing rows carry `ceiling = 1000000`; the deposit and the ceiling are independent bounds and both apply.

**Verification before either box is restarted with the new rows:** read both legs on chain (`participants(channelId, relayAddress).deposit` and `participants(channelId, storeAddress).deposit`) and confirm **both are non-zero**. `ChannelNewDeposit(channelId, participant, totalDeposit)` is emitted per leg (`packages/contracts/src/TokenNetwork.sol:148`), so a one-leg funding is visible as exactly one event.

---

## 4. The faucet, on its own Linode, with no connector

### 4.1 What it is today

The faucet is an Express HTTP service on port `3500` (`packages/faucet/src/index.js:14-15`, `packages/faucet/Dockerfile:55`), with a static web UI at `/` (`packages/faucet/src/index.js:40`). Its dependencies are `express`, `ethers`, `cors`, `@solana/web3.js`, `@solana/spl-token`, `mina-signer`, `o1js`, `mina-fungible-token` (`packages/faucet/package.json:12-21`). **There is no connector package, no ILP, and no BTP anywhere in it**, and its compose service declares no `depends_on` against the connector (`infra/linode-node/docker-compose.node.yml:45-111`).

It runs on box 1 today: `infra/linode-node/docker-compose.node.yml:2` ("connector node — proxy + faucet + TLS"), service at `:45`, published `3500:3500` at `:103-104`, fronted by nginx at `infra/linode-node/nginx/conf.d/node.conf:29` (`faucet.devnet.toonprotocol.dev → http://faucet:3500`) and named in that box's `server_name` at `:56`. Both other boxes explicitly exclude it (`infra/linode-store/bootstrap.sh:5`, `infra/linode-relay/bootstrap.sh:6`).

### 4.2 What moves off box 1

The `faucet` compose service, its image build (`packages/faucet/Dockerfile`), the `faucet.devnet.toonprotocol.dev` nginx server block, and the DNS record `infra/devnet-manage.sh:294` currently points at box 1's IP.

### 4.3 What the new box needs

| Need | Detail | Precedent |
|---|---|---|
| A Linode | New label; add to `NODE_LABELS`/`NODE_TYPES` in `infra/devnet-manage.sh:63-65` | the relay box's own row |
| A DNS name | `faucet.devnet.toonprotocol.dev`, repointed to the new IP | `infra/devnet-manage.sh:294` |
| A certificate | Its **own** lineage, one cert per name — `certonly --webroot -w /var/www/certbot --cert-name faucet.devnet.toonprotocol.dev` | `infra/linode-relay/init-letsencrypt.sh:13-24`, which does exactly this and says why (#830: "ONE CERTIFICATE PER NAME — two independent certbot requests, deliberately NOT one two-SAN request … Certbot's SAN request is all-or-nothing") |
| A renewer | The `certbot` sidecar loop and the nginx reload loop | `infra/linode-node/docker-compose.node.yml:127-142` |
| A bootstrap script | `bootstrap.sh` + `nginx/node.conf.template` rendered on the box with `envsubst` | `infra/linode-node/bootstrap.sh:31-33` |
| **Keys generated ON the box** | See §4.4 | `infra/linode-node/.env.example:33-35`: "The admin key can mint unlimited USDC, so it lives only here on the box, never in git." |

Use the **"Who does what" table** format from `docs/operators/relay-box-bringup.md:32-44` (repo-side vs human-on-the-box) for the runbook. That precedent exists because this exact class of move was done for the relay box.

### 4.4 Keys: generated on the box, never in git, never copied from box 1

Provisioning is authorized. **Generate fresh keys on the new box** rather than moving box 1's — a key that has been copied is a key that exists in two places for as long as the old box does.

| Secret | Env var | Shape |
|---|---|---|
| Base Sepolia funding key | `BASE_SEPOLIA_FAUCET_KEY` | EVM `0x` key (`infra/linode-node/.env.example:41-46`, "NEVER commit this to git") |
| Solana treasury keypair | `SOLANA_FAUCET_KEYPAIR` | bind-mounted keypair **file** (`infra/linode-node/docker-compose.node.yml:64, 101-102`) |
| Mina USDC treasury/admin key | `MINA_USDC_TREASURY_KEY` (legacy alias `MINA_USDC_ADMIN_KEY`) | base58 (`infra/linode-node/.env.example:33-35`) |
| Mina native treasury key | `MINA_FAUCET_KEY` | base58 (`infra/linode-node/.env.example:29`) — **not needed**, see §4.6 |

The mint authorities themselves must then be transferred to the new keys, or the new box funded from the old, before the old box is destroyed. That is a live, human step and it is ordered explicitly in §6.

### 4.5 What the faucet must NOT have

**A connector.** No `connector-rust` service, no `connector-rust.toml`, no `[[peers]]` row anywhere naming it, no ILP address, and no `[[routes]]` row on either connector that mentions it. It is reached over plain HTTPS, by humans and by client bootstrap code, and it is not a node on the network. Nothing in §§1-3 applies to it.

Consequently it also has no signer key, no settlement key, no state directory, and no payment channel.

### 4.6 USDC only

Today the faucet dispenses gas as well as USDC. On the new box it dispenses **USDC only** — SOL or ETH means printing the address and asking a human.

| Route | Line | Disposition on the new box |
|---|---|---|
| `POST /api/base-sepolia/request` | `packages/faucet/src/index.js:491` | **KEEP.** Mints mock USDC, plus a *best-effort* ETH gas drip which is **already disabled by default**: `BASE_SEPOLIA_ETH_AMOUNT` defaults to `'0'` (`packages/faucet/src/base-sepolia.js:34-35`). Pin it to `0` explicitly. |
| `POST /api/solana/usdc-request` | `packages/faucet/src/index.js:418` | **KEEP.** USDC only, no SOL leg. |
| `POST /api/mina/usdc-request` | `packages/faucet/src/index.js:684` | **KEEP.** Mina USDC only. |
| `POST /api/solana/request` | `packages/faucet/src/index.js:349` | **DROP.** Dispenses SOL (`SOLANA_SOL_AMOUNT`, default `0.03`, `packages/faucet/src/solana.js:52`) alongside USDC. |
| `POST /api/mina/request` | `packages/faucet/src/index.js:552` | **DROP.** Dispenses native MINA (`MINA_DRIP_AMOUNT`, default `5`, `packages/faucet/src/mina.js:49`). |
| `POST /api/request` | `packages/faucet/src/index.js:315` | **DROP.** Local anvil ETH + ERC20; already self-declared `local: true, deprecated: true` (`:223-226`). |
| `GET /health`, `GET /api/info` | `:174`, `:183` | **KEEP.** `/api/info`'s capability map (`:221-249`) must stop advertising the dropped legs, and the web UI (`packages/faucet/public/index.html`) must stop offering them. |

Dropping the two native-token routes also drops `MINA_FAUCET_KEY` (§4.4) and the SOL-dispensing half of the Solana key's job from the new box's secret set.

---

## 5. Client defaults, the genesis seed, and the republish chain

### 5.1 Why anything client-side has to change at all

The committed genesis seed names `g.toon` as its ILP anchor and box 1 as its BTP door. Once box 1 is gone, that seed is wrong — `@toon-protocol/core`, `packages/core/src/discovery/genesis-peers.json`, whole file:

```json
[
  {
    "pubkey": "30fdd01d55c3efeb4c19c2cbeda8247cbc40ae9b15c026e9a301a263001fa7a9",
    "relayUrl": "wss://relay-ws.devnet.toonprotocol.dev",
    "ilpAddress": "g.toon",
    "btpEndpoint": "wss://proxy.devnet.toonprotocol.dev/ilp/btp"
  }
]
```

`relayUrl` already points at the relay box (`relay-ws.devnet.toonprotocol.dev` resolves to `97.107.134.182`, served there with its own cert lineage; `infra/devnet-manage.sh:316` and `infra/linode-relay/nginx/conf.d/node.conf:28,162,164-165`). `ilpAddress` and `btpEndpoint` do not.

The loader has **no hardcoded fallback peer** — an empty or invalid seed yields `[]` (`packages/core/src/discovery/GenesisPeerLoader.ts:67-101`). The daemon's chain from the seed is:

```ts
// packages/client-mcp/src/daemon/config.ts:380-396 (toon-client)
const genesisSeed = GenesisPeerLoader.loadGenesisPeers()[0];
const relayUrl = process.env['TOON_CLIENT_RELAY_URL'] ?? file.relayUrl
  ?? genesisSeed?.relayUrl ?? 'ws://localhost:7100';
const destination = process.env['TOON_CLIENT_DESTINATION'] ?? file.destination
  ?? genesisSeed?.ilpAddress ?? 'g.toon';   // last-resort literal
```

### 5.2 The one hazard: a single anchor cannot name two terminating routes

`deriveRouteDestinations(anchor)` splits publish from store **only** when the anchor ends `….relay.store` (`packages/client-mcp/src/daemon/config.ts:344-354`, toon-client):

```ts
const segs = anchor.split('.');
if (segs.at(-1) === 'store' && segs.at(-2) === 'relay') { … }
return { publish: anchor, store: anchor };
```

The target fleet's two terminating addresses are `g.toon.relay` and `g.toon.**ario**`. No single anchor produces that pair — `ario` is not `store`. Setting the seed's `ilpAddress` to `g.toon.relay` makes **uploads** default to `g.toon.relay` too, which routes a `/store` job into the relay's write handler.

(Today the anchor is bare `g.toon`, which also fails the pattern, so publish and store both default to `g.toon` and box 1's routing table separates them. Retiring box 1 removes the thing that was covering for the client.)

Two mechanisms already exist to fix this, and at least one must be used:

1. **The kind:10032 announce already carries the split.** The relay box's `[announce]` block declares `route_publish = "g.toon.relay"` and `route_store = "g.toon.ario"` (`infra/linode-relay/connector-rust.toml:176-177`), emitted as `routes: RouteHints { publish, store }` (`crates/connector-cli/src/announce.rs:562-566`, field at `:460`). `rig`'s standalone bootstrap **already parses it** (`packages/rig/src/standalone/network-bootstrap.ts:174-177, 309-316`, toon-client). The client-mcp daemon path does **not** — there is no `routes`/`routePublish` read anywhere under `packages/client-mcp/src/daemon/`.
2. **Explicit config/env.** `TOON_CLIENT_PUBLISH_DESTINATION` and `TOON_CLIENT_STORE_DESTINATION` both win over the derived values (`packages/client-mcp/src/daemon/config.ts:403-411`).

**Decision for this spec:** the seed's `ilpAddress` becomes `g.toon.relay` and the daemon gains the announce-driven split (mechanism 1), matching what `rig` already does. Mechanism 2 is the fallback if the daemon change is not ready.

### 5.3 The full edit list

**`@toon-protocol/core` (repo `toon`):**

| File:line | Today | Target |
|---|---|---|
| `packages/core/src/discovery/genesis-peers.json:5` | `"ilpAddress": "g.toon"` | `"g.toon.relay"` |
| `packages/core/src/discovery/genesis-peers.json:6` | `"btpEndpoint": "wss://proxy.devnet.toonprotocol.dev/ilp/btp"` | `wss://proxy.relay.devnet.toonprotocol.dev/ilp/btp` |
| `packages/core/src/discovery/genesis-peers.json:3` | `"pubkey": "30fdd01d…"` | the **relay box's** announce pubkey |
| `packages/core/src/constants.ts:149` | `ILP_ROOT_PREFIX = 'g.toon'` | see §5.4 |
| `packages/sdk/src/prefix-claim-handler.ts:97` | defaults to `'g.toon'` | follows `ILP_ROOT_PREFIX` |

Two committed tests pin the current values and will fail loudly, which is the point: `packages/core/src/discovery/GenesisPeerLoader.test.ts:158-171` (`it('pins the live devnet apex identity')`, asserting `ilpAddress: 'g.toon'` at `:168`) and `packages/core/src/address/derive-child-address.test.ts:74` (`expect(ILP_ROOT_PREFIX).toBe('g.toon')`).

**`@toon-protocol/client` + `@toon-protocol/client-mcp` + `@toon-protocol/rig` (repo `toon-client`):**

| File:line | Today |
|---|---|
| `packages/client-mcp/src/daemon/config.ts:396` | last-resort literal `'g.toon'` |
| `packages/client-mcp/src/daemon/config.ts:344-354` | `deriveRouteDestinations`, §5.2 |
| `packages/client-mcp/src/daemon/config.ts:466` | `ilpAddress: 'g.toon.client'` (the client's own self-declared identity — cosmetic, but it names the retired prefix) |
| `packages/client/src/config.ts:425,429,432` | `config.ilpInfo?.ilpAddress \|\| 'g.toon.relay'` — **already correct**, no change |
| `packages/client/src/config.ts:451` | default `relayUrl: 'wss://relay-ws.devnet.toonprotocol.dev'` — **already correct**, no change |
| `packages/rig/src/cli/standalone-mode.ts:159` | `OFFICIAL_PROXY_URL = 'https://proxy.devnet.toonprotocol.dev/rust/ilp'` — **box 1**, must repoint |
| `packages/rig/src/cli/standalone-mode.ts:162` | `OFFICIAL_PUBLISH_DESTINATION = 'g.toon.relay'` — **already correct**, no change |
| `packages/client-mcp/src/e2e/devnet.ts:33` | `proxyUrl: 'https://proxy.devnet.toonprotocol.dev'` — **box 1**, must repoint |

`docs/operators/rust-cutover-runbook.md:311-315` (connector repo) already lists client-side URLs hardcoded to `https://proxy.devnet.toonprotocol.dev/rust/ilp`, including in `buzz`'s desktop build. Those are a hard blocker on §6's irreversible steps, not a follow-up.

### 5.4 `ILP_ROOT_PREFIX` and `isGenesisNode`

`ILP_ROOT_PREFIX = 'g.toon'` is the string `isGenesisNode` compares against (§0.2). After retirement, **the prefix `g.toon` still exists as a namespace** — `g.toon.relay` and `g.toon.ario` both live under it — but **no node answers to `g.toon` exactly**, so `isGenesisNode` becomes a predicate that is never true for any live node.

Leave the constant as `'g.toon'`. Changing it would rename every address in the fleet, which this spec explicitly does not do. What must change is any code that treats "there is a genesis node" as a reachable state. `docs/protocol.md:119` in this repo asserts "The genesis node IS `g.toon`" — that sentence becomes false and must be corrected in the same change.

### 5.5 The republish chain, in order

A core-only republish reaches nobody. `client-mcp` **inlines** core at build time — `tsup.config.ts:47-51` lists `@toon-protocol/core` under `noExternal` — so the seed is frozen into each published `client-mcp` bundle. Verified in the local pnpm store: `@toon-protocol/core@3.1.4`'s dist bakes `g.proxy`; `3.2.0`/`3.2.1` bake `g.toon`.

**Order (all three, in this order):**

1. **`@toon-protocol/core`** (repo `toon`, currently `3.2.0`) — the seed, the tests, `ILP_ROOT_PREFIX`'s callers. Publish to npm.
2. **`@toon-protocol/client`** (repo `toon-client`, currently `0.29.0`) — depends on `"@toon-protocol/core": "^3.2.0"` (`packages/client/package.json:65`). A caret range, so a fresh install picks the new core up; publish anyway so the range floor moves.
3. **`@toon-protocol/client-mcp`** (repo `toon-client`, currently `0.36.5`) — **this is the one that reaches Claude Desktop.** Depends on `client` via `workspace:*` and on core via `^3.2.0` (`packages/client-mcp/package.json:52-57`). Rebuild and republish; the rebuild is what re-bakes the seed.

`@toon-protocol/rig` (`3.1.6`) also depends on both and needs the same treatment for its `OFFICIAL_PROXY_URL` (§5.3).

**Changesets:** `toon`'s `.changeset/config.json:5-6` has no fixed group. `toon-client`'s has exactly one — `"fixed": [["@toon-protocol/views", "@toon-protocol/client-mcp"]]` — so republishing `client-mcp` drags `@toon-protocol/views` to the same version. `@toon-protocol/client` and `@toon-protocol/rig` version independently.

**Precedent:** `toon-client/.changeset/republish-clients-live-genesis.md` did this exact dance for the `g.proxy` → `g.toon` seed change, and its body states the mechanism: "`client-mcp` inlines the genesis peer seed at build time, so the published `0.36.5` bundle carried `core@3.1.4`'s retired values." Follow it.

---

## 6. Box 1's retirement

### 6.1 The trap this runbook exists to encode

**Moving a read surface strands the writers pointed at the old one.** It has already bitten this fleet once. After any DNS or topology move, re-verify that **every producer still lands where the consumer reads** — not merely that the consumer endpoint answers. A consumer that answers `200` proves nothing about whether anything is still writing to it.

The known producers pointed at box 1 today, each of which strands silently:

| Producer | Points at | Citation |
|---|---|---|
| The store box's scheduled `connector announce` | `publish_btp_url = "wss://proxy.devnet.toonprotocol.dev/ilp/btp"`, paying box 1's client edge from `pay_channel` | `infra/linode-store/connector-rust.toml:332,349` |
| The store box's announce target | `publish_to = "g.toon.relay"` — resolved **through box 1** today | `infra/linode-store/connector-rust.toml:301` |
| Every shipped client | genesis seed `btpEndpoint`, `rig`'s `OFFICIAL_PROXY_URL`, `buzz`'s desktop build | §5.3 |
| Box 1's own announcer sidecar | publishes `g.toon` as a discoverable node | `infra/linode-node/docker-compose.node.announcer.yml:109` |

**And before moving any DNS record: read the TLS lineage's renewal conf `webroot_map` and the certificate's SANs on the box.** A lineage's primary name is not its only name. Box 1's lineage is `proxy.devnet.toonprotocol.dev` and it covers **two** names — `DOMAINS=("proxy.${DOMAIN}" "faucet.${DOMAIN}")` with `--cert-name "${PRIMARY}"` (`infra/linode-node/init-letsencrypt.sh:12,19-20,83-89`). Moving `faucet.devnet.toonprotocol.dev` (§4) without splitting it out of that lineage breaks renewal for `proxy.devnet.toonprotocol.dev` **silently, roughly 60 days later**. No `webroot_map` string exists anywhere in the connector repo — that file lives only at `/etc/letsencrypt/renewal/<lineage>.conf` on the box, so this is a read-on-the-box step, not a repo grep. The relay box's own script already encodes the lesson: one certificate per name, two independent requests, deliberately not one two-SAN request (`infra/linode-relay/init-letsencrypt.sh:13-24`, issue #830).

### 6.2 The ordered runbook

Steps marked **[IRREVERSIBLE]** destroy state or a name. Each is preceded by the verification that must pass live first. The general precedent for the conditions is `docs/operators/prefix-retirement-checklist.md:12-33` (connector repo): no traffic reaching the old prefix, **and** every known client repointed.

**Phase A — build the new relationship alongside the old (nothing retires).**

1. Land the repo changes: `[[peers]]`/`[[peer_channels]]`/`[[routes]]` rows from §1.3 on both box configs, the two new pricing constants in `crates/connector-bin/tests/devnet_configs_load.rs`, and the `docs/devnet-pricing.md` rows. Merging rolls nothing.
2. Generate the `relay-store` secret once, write identical bytes to `/app/data/relay-store.secret` on **both** boxes.
3. Open the new relay↔store channel (§3.3) and fund **both** legs (§3.4).
4. Copy the real `channel_id` and each box's `counterparty_key` into the bind-mounted config on each box. Restart with `docker compose restart connector-rust` on both — `up -d` does not reload a bind mount.
5. **Verify before proceeding:** both connectors booted (a wrong peer id, an unbound channel or a missing ceiling is a boot failure, §0.3); `GET /ilp/routes/price?destination=g.toon.ario` on the relay box answers `1001`; `GET /ilp/routes/price?destination=g.toon.relay` on the store box answers `2`; both on-chain deposit legs are non-zero; and a real paid write succeeds **in each direction** through the new peering.

**Phase B — move the faucet (§4).**

6. Stand up the new faucet box with fresh keys, its own cert lineage for `faucet.devnet.toonprotocol.dev`, and the USDC-only route set.
7. **Before repointing DNS:** read `/etc/letsencrypt/renewal/proxy.devnet.toonprotocol.dev.conf` on box 1, confirm which names its `webroot_map` covers, and split `faucet.*` out of that lineage (§6.1).
8. **Verify:** the new box serves `faucet.devnet.toonprotocol.dev` with a valid chain; a USDC drip succeeds on each supported chain; the dropped gas routes return a clear error; box 1's `proxy.*` certificate still renews (`certbot renew --dry-run` on box 1).
9. **[IRREVERSIBLE]** Repoint the `faucet.devnet` DNS record to the new box. Stop the `faucet` service on box 1 only after the new one has served real traffic.

**Phase C — repoint every producer off box 1 (§5).**

10. Repoint the store box's announce: `publish_btp_url` to the relay box's BTP door, or drop it in favour of `--via-own-routing` now that the store box has its own route to `g.toon.relay`. Restart, and confirm the next scheduled announce lands.
11. Publish the client chain in order: `core` → `client` → `client-mcp` (§5.5), including the announce-driven publish/store split (§5.2).
12. Repoint `rig`'s `OFFICIAL_PROXY_URL` and the `buzz` desktop build's hardcoded URL (`docs/operators/rust-cutover-runbook.md:311-315`).
13. **Verify:** a freshly installed `client-mcp` — not a cached one — bootstraps, reads, publishes **and** uploads with no environment overrides, and its uploads land at `g.toon.ario` rather than at the relay's write handler. This is the step that catches §5.2.

**Phase D — prove box 1 is idle.**

14. Watch box 1's connector logs and nginx access logs for a **full traffic cycle** (at minimum, long enough to span the store box's announce schedule and any daily client job). Zero packets to `g.toon.relay` or `g.toon.ario`, zero client-edge greetings.
15. Stop box 1's announcer sidecar so `g.toon` stops being advertised as discoverable. Confirm the relay box's and store box's own announces are current and that a client discovering from scratch never learns about box 1.
16. **Verify:** with box 1's connector **stopped but the box still running**, every acceptance path in step 13 still passes. This is the reversible dress rehearsal for step 18, and skipping it is how a stranded producer is discovered after the box is gone.

**Phase E — retire.**

17. Remove the `apex-relay` rows from the relay box's config and the `apex-store` rows from the store box's config (§1.4), then restart both. Order matters: a `[[routes]]` row naming a deleted peer is `UnknownPeerId` and the connector will not boot.
18. **[IRREVERSIBLE]** Delete the `proxy.devnet.toonprotocol.dev` DNS record and destroy the box 1 Linode. Remove its rows from `infra/devnet-manage.sh:63-65,293-294`, delete `infra/linode-node/`, and delete box 1's rows from `docs/devnet-pricing.md` and from `crates/connector-bin/tests/devnet_configs_load.rs`.
19. Settle or close the box 1 channels that this spec left alone, as a separate, later decision. Nothing in §§1-5 depends on it.

### 6.3 What remains true after retirement

- The **prefix** `g.toon` survives; the **node** does not. `g.toon.relay` and `g.toon.ario` are unchanged strings, matched longest-first against two routing tables instead of three (§0.2).
- `isGenesisNode` becomes a predicate no live node satisfies (§5.4).
- There is one connector↔connector peering in the fleet — `relay-store` — and one bidirectional channel behind it, with two funded legs (§3).
- Discovery is per-node: each box announces itself, from the box that holds its own identity key, as a one-shot operator command paid through that node's own routing (ADR 0030, connector repo).

---

## Appendix — citation index

All connector-repo citations were read at commit `275ff37` of `github.com/toon-protocol/connector`. All `toon` / `toon-client` citations were read in the local working trees of those repos on 2026-08-07. **Line numbers drift; re-verify before acting on any single line.**

| Claim | Where it is verified |
|---|---|
| Routing table is the relationship set, enforced at load | `crates/connector-config/src/config.rs:252-255, 285, 297, 308, 322` |
| A `[[peers]]` row's secret is presented outbound **and** matched inbound | `crates/connector-config/src/peer.rs:305-328`; `crates/connector-peer-auth/src/credential.rs:115`; `crates/connector-peer-auth/src/lib.rs:16-18` |
| Wrong secret downgrades to client role, silently | `docs/protocol/peer-carriage-spec.md:150-163, 218-232` |
| A dialed BTP session is symmetric | `docs/protocol/peer-carriage-spec.md:279-289`; `crates/connector-config/src/peer.rs:565` |
| Accept-only peering requires an explicit ceiling | `crates/connector-config/src/peer.rs:557-563` |
| Longest-prefix matching, segment-boundary rule | `crates/connector-runtime/src/connector.rs:1184-1198`; `crates/connector-cli/src/announce.rs:1207-1213` |
| Client edge charges `price`; over-carry is `F03` | ADR 0028; `crates/connector-client-edge/src/lib.rs:1050-1057` |
| A hop forwards `amount − fee` | `crates/connector-domain/src/fee.rs:19-22`; `docs/protocol/peer-wire-spec.md:200-204` |
| Terminating side charges its price on peer arrival | ADR 0029; `crates/connector-runtime/src/connector.rs:691-706` |
| Current devnet prices | `docs/devnet-pricing.md:16-21`; `crates/connector-bin/tests/devnet_configs_load.rs:200,227,238,242,253,262` |
| One channel id, two per-participant legs (EVM) | `packages/contracts/src/TokenNetwork.sol:62-67, 82-83, 255-296, 337-352` |
| One channel account, two legs (Solana) | `packages/solana-program/src/state.rs:74-88` |
| Accepted counterparty is recovered from the signature, never self-declared | `crates/connector-runtime/src/claim.rs:438-442, 1055-1089` |
| Claim above deposit is refused | `crates/connector-cli/src/announce.rs:1548-1556`; `crates/connector-client-edge/src/claim_gate.rs:211-224, 1250-1258` |
| Store box pays box 1 as a client | `infra/linode-store/connector-rust.toml:291-349` |
| Faucet has no connector; runs on box 1; dispenses gas today | `packages/faucet/package.json:12-21`; `infra/linode-node/docker-compose.node.yml:45-111`; `packages/faucet/src/index.js:315,349,418,491,552,684` |
| Cert lineage covers more than its primary name | `infra/linode-node/init-letsencrypt.sh:12,19-20,83-89`; `infra/linode-relay/init-letsencrypt.sh:13-24` |
| Boxes run bind-mounted config; merging rolls nothing | `docs/operators/peer-channel-migration.md:22-28, 47-49`; ADR 0009 `:13-14` |
| Genesis seed, loader, `isGenesisNode` | `toon`: `packages/core/src/discovery/genesis-peers.json`, `GenesisPeerLoader.ts:67-101`, `constants.ts:149`, `address-assignment.ts:48-50` |
| Seed is inlined into `client-mcp` at build time | `toon-client`: `packages/client-mcp/tsup.config.ts:47-51` |
| Publish/store destination derivation | `toon-client`: `packages/client-mcp/src/daemon/config.ts:344-354, 380-411` |
| The announce carries the publish/store split; `rig` reads it | `crates/connector-cli/src/announce.rs:460, 562-566`; `infra/linode-relay/connector-rust.toml:176-177`; `toon-client`: `packages/rig/src/standalone/network-bootstrap.ts:174-177, 309-316` |
| connector#867 supersedes §2b | [connector#867](https://github.com/toon-protocol/connector/issues/867) |
