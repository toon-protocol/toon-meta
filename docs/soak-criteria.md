# Soak Criteria — Settlement Layer

This document answers the "how much live exercise is enough" question that
[#179](https://github.com/toon-protocol/toon-meta/issues/179)'s checklist
left unchecked: *"Define soak criteria explicitly: what must run green, on
which public testnets, for how long (channels opened/closed, claims
redeemed, coop-close + rescue paths exercised)."* It is a documentation
deliverable only — no deploys, no key handling, no funds move as a result of
writing it down. Whether a given family has *met* the bar stays a human
judgment call; this document only fixes what the bar is.

It covers the three settlement families TOON supports today: **EVM**
(currently Base Sepolia; Base mainnet at cutover, per
[connector#388](https://github.com/toon-protocol/connector/issues/388)),
**Solana** (devnet; mainnet path per
[connector#834](https://github.com/toon-protocol/connector/issues/834)),
and **Mina** (devnet). See [settlement.md](./settlement.md) for the
per-chain claim shapes and [deployment.md](./deployment.md) for the live
devnet's addresses and endpoints.

## 1. Paths that must be exercised live

`RollingSwapChannelSecurity.t.sol` (connector repo) covers these
in-unit — signed, deterministic, no chain latency or public-RPC flake. The
soak is the live counterpart: the same lifecycle, on the real public
network, with real (if valueless, on testnets) transactions.

| Path | EVM (Base Sepolia) | Solana (devnet) | Mina (devnet) |
|------|---------------------|------------------|-----------------|
| Channel open | `openChannel` on `TokenNetwork` | channel PDA created on the payment-channel program | client-build `PaymentChannel` zkApp deployed (one per participant pair — [deploy-app-guide.md](./deploy-app-guide.md)) |
| Per-claim update | signed EIP-712 balance proof accepted, `claimFromChannel` advances `claimedAmounts` | Ed25519 balance proof, `CLAIM_FROM_CHANNEL` advances the on-chain watermark | Pallas-Schnorr claim, apex co-signs, `claimFromChannel` advances nonce + balance commitment |
| Channel close | `closeChannel` (either participant), 24h challenge period | channel closed on the program | zkApp `settle()` path invoked |
| Claim redeemed / recipient credited | on `claimFromChannel`, net balance settles on `TokenNetwork` | at channel close, `SETTLE_CHANNEL` (vault → recipient ATA) | at channel close, Story 34.4 fund-custody zkApp `settle()` (vault → participants) |
| Coop-close | both-signed close digest (`coopCloseHashEvm` et al. in `@toon-protocol/settlement-digest`) accepted | equivalent cooperative-close message accepted | equivalent cooperative-close message accepted |
| Rescue (unilateral exit, no counterparty cooperation) | `closeChannel` + `settleChannel` callable by a single participant with no signature from the other side — **not yet observed**. The [2026-07-31 apex identity rotation notice](./operators/2026-07-31-apex-settlement-identity-rotation.md) records that the eight channels left open against the retired apex identity *can* be exited this way (apex-side deposit is zero on all eight, so only the counterparty's own funds are at stake) — that is a capability, not an observation. A fresh on-chain read confirms none have been: at block `45280864` (2026-08-10T02:46:56Z), all eight still read `state == 1` (`Opened`), `closedAt == 0`, unchanged from the notice's own block-`44877814` baseline. What would prove this row: any one of those eight (or a new channel) taken through `closeChannel` then `settleChannel` by a single participant, cited by block height and the resulting `state == 3` (`Settled`). | equivalent unilateral close/settle instruction on the program | equivalent unilateral path on the zkApp |

Every path in the table needs at least one live, on-chain observation before
a family's soak clock can be said to have started at all. Repetition against
the volume/duration bar (§3) only counts paths that have already been proven
to work at least once.

## 2. Network

Public devnet/testnet only, named explicitly — never a local validator. The
fleet has run no self-hosted blockchain infrastructure since 2026-07-19,
when the Anvil / `solana-test-validator` / Mina lightnet boxes were deleted
as part of the public-chain cutover
([deployment.md → Linode Devnet](./deployment.md#linode-devnet--live-public-chain-settlement)).

| Family | Network | Chain id (announced) | RPC |
|--------|---------|-----------------------|-----|
| EVM | Base Sepolia | `evm:84532` | `https://sepolia.base.org` (prefer `https://base-sepolia-rpc.publicnode.com` for channel operations — the official LB serves stale reads) |
| Solana | Solana devnet (public cluster) | `solana:devnet` | `https://api.devnet.solana.com` |
| Mina | Mina devnet (public) | `mina:devnet` | `https://api.minascan.io/node/devnet/v1/graphql` |

Contract/program addresses are the live devnet apex's kind:10032 announce
(authoritative at runtime); see
[deployment.md → Deployed settlement contracts](./deployment.md#deployed-settlement-contracts-public-networks-verified-2026-07-19)
for the current snapshot.

## 3. Volume and duration bar

**Settled 2026-08-09** (owner decision, condensed from the ticket thread —
it fixes the unit the rest of this section builds on):

> The bar measures BREADTH, not throughput. **N distinct channels opened and
> settled by M distinct identities over D days, with zero unexplained
> F-class rejects.** Not sustained packets-per-second. It targets the
> failure mode that actually occurred — all three defects that surfaced in
> one week (connector#582, #646, #662) were correctness bugs across
> *distinct channel lifecycles*, not throughput bugs. Throughput has its own
> owners (connector#685, relay#85) and is deliberately kept out of this bar.

That fixes the unit; the numeric values are this document's job to propose.
All three families use the same shape of bar — a family is not exempt from
soaking just because its instrument is newer. §1's rule binds here too: a
family's clock cannot be said to be running until every path in its §1 row
has at least one live observation — as of this writing that is true of
**two** families, not one. Mina is missing a full cycle; EVM is missing
just the rescue path (§1), which changes the arithmetic below but not the
gating rule.

| Family | N (distinct channels) | M (distinct identities) | D (days) | Notes |
|--------|------------------------|---------------------------|----------|-------|
| EVM (Base Sepolia) | ≥ 20 | ≥ 10 | ≥ 14 consecutive, **starting only after §1's rescue gap closes** | Baseline plausibility: the fleet has already put **19** channels through a complete open/claim/close/settle lifecycle in the ordinary course of devnet operation, closed and settled by the apex on 2026-07-30 — well inside this bar's N and D (19 + 8 = 27 channels total exist against the retired apex identity, but only those 19 completed a full lifecycle; the other eight are §1's Rescue row, addressed there). The 19 give the volume/duration bar real baseline plausibility, but per §1's own rule the EVM clock cannot be said to have started until at least one live rescue is observed. |
| Solana (devnet) | ≥ 20 | ≥ 10 | ≥ 14 consecutive | The Solana-settling client is new as of this week (2026-08-09) — see [#307](https://github.com/toon-protocol/toon-meta/issues/307)'s own thread: one independent node with six consecutive paid writes on one channel, one third-party-funded `g.toon.ario` job, one `g.toon.relay` channel resolved purely from chain. That is real evidence against §1's per-path checklist but nowhere near this bar's N/M; the clock on this family starts now, not retroactively. |
| Mina (devnet) | ≥ 20 | ≥ 10 | ≥ 14 consecutive, **starting only after the prerequisite below is met** | **Prerequisite:** at least one full live open → close/settle cycle against the apex. `deployment.md` notes the Mina client-entry leg "was only ever exercised through the retired sandbox entry, so it is unproven against the apex — the demoed paths are Base Sepolia and Solana." Until that single cycle is observed, §1's Mina row is not yet checked off, and no soak window can be running. |

"Unexplained" F-class reject, precisely: a REJECT whose error code
(`F01`/`F03`/`F04`/`F06`/`F08`/`F99` — see
[protocol.md](./protocol.md#validation-pipeline),
[two-node-architecture.md](./two-node-architecture.md) for `F03`, and
[rolling-swap.md](./rolling-swap.md) for `F99`) does not map to a
documented, expected cause (insufficient payment on a genuinely underpriced
packet, a stale nonce that a client retry resolves, a deliberately malformed
test-vector packet, etc.). connector#869 — a packet rejected for envelope
shape after the claim watermark had already advanced, charging the sender in
full for a rejected packet — is the shape of thing this bar exists to catch:
it is exactly a reject that looked routine (an F-class envelope-shape
rejection) but was not, once someone checked whether the charge and the
reject agreed. A reject only counts as "explained" once someone has
confirmed the charge/delivery outcome it produced was the *intended* one,
not merely that its error code has a known meaning.

## 4. What counts as evidence

Prefer counters and endpoints the fleet already emits over new
instrumentation. Per acceptance criterion, if a bar element has no existing
source this section says so plainly rather than assuming one.

| Bar element | Evidence source | Already exists? |
|-------------|------------------|-------------------|
| Per-claim activity (signed/accepted/fulfilled) | `outbound_claim_signed` / `inbound_claim_accepted` / `inbound_fulfillment_recorded` counters — the same ones used in connector#774's verification block | Yes |
| Per-channel payer-side state (nonce, cumulative claimed, deposit) | `/ilp/claim-state` — challenge-authenticated, so only a channel's own counterparty can read it; a record that does not depend on trusting the node's own counters | Yes |
| Distinct channel count, EVM | `ChannelOpened` events on the `TokenNetwork` contract, filtered by address — the same query the [2026-07-31 notice](./operators/2026-07-31-apex-settlement-identity-rotation.md) tells counterparties to use to find their own channel ids | Yes |
| Distinct channel count, Solana | channel PDAs owned by the payment-channel program (`getProgramAccounts`) | Yes |
| Distinct channel count, Mina | deployed `PaymentChannel` zkApp accounts (one per participant pair; deploy records tracked in `~/.toon-client/keys/rig-mina-zkapps.json` per operator) | Yes, but the record today is a single operator's local file, not a query anyone can run independently. **The one new counter/index this document identifies as missing:** a public or fleet-side index of deployed Mina zkApp addresses (or an on-chain discovery query equivalent to `ChannelOpened`/`getProgramAccounts`), so a reviewer can verify Mina breadth without trusting the deploying operator's own bookkeeping. |
| Distinct identity count (M) | the counterparty address/pubkey on each distinct channel found via the above — no separate counter, derived from the same per-channel enumeration | Derived, not separate |
| Unexplained F-class rejects | REJECT logs with `code` + `data.reason`, cross-checked against the claim-state / claim-signed counters above for each rejected packet's charge outcome | Yes (logs exist per [protocol.md](./protocol.md) and [rolling-swap.md](./rolling-swap.md)'s F-class discussion); no dedicated "unexplained-reject" counter exists — classifying a reject as explained/unexplained is a manual cross-check today, not an automated gate |

A reviewer confirming the bar was met, per family: pull the distinct-channel
list for the window (§4 row 3/4/5), confirm the count and identity count
clear §3's N/M, confirm the window clears D, and walk every REJECT logged in
the window against the claim-state/claim-signed record for that channel to
confirm none are unexplained.

## 5. What resets the clock

**Settled 2026-08-09** (owner decision):

> **Resets:** any change to the on-chain program bytecode, or to the code
> that produces or validates balance proofs — claim signing, claim
> bounding, settlement-destination validation.
>
> **Does not reset:** every other backend change.

The soak exists to prove the thing that cannot be patched retroactively:
money already settled under the old rules. A backend fix is deployable and
revertible and does not invalidate settled history — unless it changed what
was signed or how a claim was bounded, in which case that history was
produced under different semantics and does not count toward the bar. A
reset-on-any-change rule would mean the window never closes: the Solana
program alone took three correctness fixes in one week
(connector#582, #646, #662), and under a strict rule "not ready" would have
stayed permanently unfalsifiable — precisely the failure this ticket exists
to end.

Chain-specific notes on what triggers the on-chain-bytecode half of the
rule:

- **EVM / Solana:** an upgrade to the deployed program is unambiguous — the
  devnet Solana program has already been upgraded in place once on the same
  program id (105,128 → 109,401 bytes, per
  [#307](https://github.com/toon-protocol/toon-meta/issues/307)'s own
  thread), which is exactly the kind of event that resets the clock.
- **Mina:** [treasury-funding.md](./treasury-funding.md) notes the zkApp is
  **re-deployed on each devnet reset**. Since a devnet reset always produces
  a new zkApp account (a new on-chain program instance, not a patch to the
  existing one), it resets the clock by the same rule as an EVM/Solana
  program upgrade — not as an exception to it.

## Status

- §1, §2, §4: answerable from the repo, filled in above.
- §3, §5: owner decisions, settled 2026-08-09 and reproduced above (§5's
  reset rule verbatim, §3's unit condensed), with numeric values proposed
  here per family.
- #179's "Define soak criteria explicitly" checklist item can be checked
  with a link to this document. #179 itself is closed (retired
  2026-08-08); the live successor tickets are connector#388 (Base mainnet),
  connector#834 (Solana mainnet), connector#835 (Solana rent costs), and
  this ticket.
- Whether any family has *met* the bar in §3 is not decided here and stays
  a human call, per this ticket's explicit scope. As of this writing, two
  of the three families have a §1 gap that means their clock has not
  started at all: EVM's rescue path (§1, §3) and Mina's full open→close
  cycle (§3). Neither is a reason to lower the bar — they are the bar
  doing its job.
