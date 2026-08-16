# The rolling swap is the only swap

**Status:** accepted

## Context

TOON has carried **two** cross-chain swap protocols since the rolling swap landed.

**The legacy path** — the custodial claim-issuance model, historically "the mill". A sender
gift-wraps a kind:20032 rumor to the maker, pays one leg-A ILP packet with an **all-zero
execution condition**, and the maker debits its own pre-funded asset-B inventory and returns a
signed chain-B balance proof inside the FULFILL `data`. The maker-side handler is
`createSwapHandler`, published from `@toon-protocol/sdk`; the intake is a branch of
`handlePacket` in `swap/packages/swap/src/swap-node.ts`.

**The rolling path** — [`docs/rolling-swap.md`](../rolling-swap.md), epic
[#145](https://github.com/toon-protocol/toon-meta/issues/145) and
[#394](https://github.com/toon-protocol/toon-meta/issues/394). A sender opens a session with a
kind:20033 RFQ, the maker answers kind:20034 with a live quote, and the swap then runs as a
stream of small packets, each **re-priced at the maker's fresh quote** and **coupled to a real
sender-chosen execution condition** so the two legs commit or fail together, packet by packet.

The legacy path's problems are structural, not incidental, and `docs/rolling-swap.md` §1 grounds
each in shipped code:

- **It is not value-atomic, and in the deployed client it is not even verified.** The leg-A
  PREPARE carries an all-zero condition, so nothing binds the value of what comes back. All of
  the recipient and signer validation is verify-*after*-commit. The deployed client wired
  neither `onPacket` nor `rateDeviationThreshold` and called none of the SDK's settlement
  verifiers: if the maker returned a bogus claim, leg A was already committed and there was no
  error path, rollback, or refund.
- **Its inventory is a honeypot sized to notional.** Every issued claim permanently debits
  `available` by the full target amount, `credit` is only ever called for rollbacks, and there
  is no refill or rebalancing loop anywhere. The pool must be sized to the maker's total
  expected flow, on every chain, behind one mnemonic — and it was in-memory, lost on restart.
  swap#138 and swap#141 are that defect surfacing.
- **It has no price discipline.** There is no re-quote, no staleness bound, no sender floor and
  no per-packet loss bound. A held price is a free option written by whichever side moves last.

Rolling replaces all three with one primitive — packetization — and closes the condition hole
outright. As of 2026-08-16 it is proven end to end: a stock client completed a rolling swap
against the deployed maker (`rolling: { probed: true, used: true }`, 3000 units in, 3000 out,
leg-B redeem settled on chain).

Keeping both is now the expensive option. Every entry-seam change has to be reasoned about
twice; `swap-node.ts`'s `handlePacket` already carries a four-row dispatch table whose sole
purpose is to keep the two shapes from colliding, and swap#115 exists only because the legacy
handler cannot mint a sender-chosen preimage. The client carries a **silent and total**
fallback (toon-client#591, `client-runner.ts:2159-2167`) whose entire job is to cope with makers
that predate rolling: five separate conditions — including any RFQ probe failure at all — select
the legacy body, and one of them (`rolling: 'off'`) does it without even leaving a `rolling`
note on the response. Two protocols also means two answers to every security question —
swap#123's cross-chain over-extension is a leg-A solvency question the legacy path frames
differently from the rolling path.

## Decision

**TOON supports the rolling swap protocol only. The legacy claim-in-FULFILL swap path is
removed from every repo, and `createSwapHandler` is withdrawn from the published SDK.**

The end state:

1. **Wire.** A maker answers kind:20033 RFQs and rolling fills coupled to a real 32-byte
   sender-chosen execution condition. A zero-condition gift-wrap whose inner rumor is *not*
   kind:20033 is refused with a named, machine-readable reason — it is no longer a swap request.
   Inner rumor kind 20032 is retired.
2. **SDK.** `@toon-protocol/sdk` no longer exports `createSwapHandler` or the legacy handler
   types. This is a **breaking change and ships as a major** (`4.0.0`). The gift-wrap and
   packet-building primitives the RFQ itself rides on — `wrapSwapPacketToToon`,
   `buildAndWrapPacket`, `unwrapSwapPacket` — are **shared** and stay.
3. **Client.** `toon_swap` runs the rolling protocol unconditionally. The `rolling` option's
   default moves from `"auto"` to `"require"`: a maker that does not answer an RFQ produces a
   **loud, actionable failure naming the maker and the reason**, not a silent downgrade. The
   `"auto"` mode and the legacy sender are removed.
4. **Connector.** No change. The Rust connector deleted the legacy condition class with the
   TypeScript prototype (connector#465/#543) and already inverts it: an all-zero condition is
   invalid outright (ADR 0019). Zero-condition *support* survives for an unrelated reason — the
   announcer's unpaid bootstrap greeting probe — and that is not a swap path.
5. **Docs.** `docs/rolling-swap.md` §10 becomes history rather than a plan; the connector's
   `docs/local-delivery-fulfillment-contract.md` legacy class and `peer-wire-spec.md` §3.1's
   carve-out are retired.

**The removal is staged, and the ordering constraint is absolute: there must be no window in
which swapping is broken.** The staging, its exit criteria and its blockers are held in the
epic that implements this record, not here. Two rules bind that plan:

- **Nothing is deleted before its replacement is observed working in production**, and
  "observed" means measured against maker telemetry, not asserted.
- **The client's loud failure ships before the maker's legacy intake is removed**, so the first
  thing a stranded caller meets is a diagnosis, not a timeout.

## Considered options

**Keep legacy as a compatibility fallback indefinitely.** Cheapest today and rejected: the
fallback is precisely what makes the legacy path's weakest property — verify-after-commit
against an unbounded held price — reachable *by default*, silently, from a client that asked for
a rolling swap. A fallback to a strictly less safe protocol is not a safety net.

**Keep legacy behind an explicit opt-in flag.** Rejected on the same grounds one step removed:
it retains every line of the code, every test, every published symbol, and the whole two-shape
entry seam, in exchange for an escape hatch whose only correct use is talking to a maker that
should be upgraded instead. The maintenance cost is the entire cost of keeping the path; the
flag saves none of it.

**Keep `createSwapHandler` exported as a deprecated no-op shim to avoid a major.** Rejected: the
symbol's contract is "issue a claim from inventory". A shim that throws is a major in behaviour
while pretending to be a minor in semver, and it strands the caller later and less legibly than
a missing export does at install time.

**Delete everything at once across the four repos.** Rejected: it strands the fleet. Legacy is
the path that worked until hours ago; rolling produced two route-shaped failures on its first
live day (swap#148). A single-commit removal has no reversible step and no observation point.

## Consequences

- **Rolling is heavier for a single small swap, and we accept that.** Legacy was one packet.
  Rolling is an RFQ round trip *plus* a session *plus* at least one coupled fill — three packet
  round trips minimum, a maker-side session record, and a sender-side controller, to move an
  amount legacy moved in one. For a one-shot fill this is strictly more work for strictly the
  same delivered value. We take it because the extra work *is* the safety: the RFQ is what makes
  the price fresh and attributable, and the condition is what makes the legs atomic. A cheaper
  single-packet mode can be reintroduced later as a rolling *session shape* — it must not be
  reintroduced as a second protocol.
- **`@toon-protocol/sdk` 4.0.0 breaks any third-party maker.** There is no in-repo consumer we
  do not control, but the package is public. The major must ship with a migration note that
  names `startSwapNode` as the supported way to run a maker.
- **`@toon-protocol/client` 0.29.8 and `@toon-protocol/rig` are already published**, so
  rolling-incapable clients exist in the wild and older deployed daemons hold them. Removing the
  maker's legacy intake makes those clients fail. They fail *today* against a maker with no
  inventory; after removal they fail immediately and with a reason. `@toon-protocol/client-mcp`
  is deliberately unpublished, so the MCP surface is rebuilt from source and carries no such
  tail.
- **Legacy has no remaining live consumer on devnet.** Two swap makers announce on the devnet
  relay, and neither one needs the legacy path:
  - `g.toon.swap.maker` (`43d7e7a9…`) is the deployed fleet maker. It is **already
    rolling-capable** — post-swap#134/#135 its kind:10032 carries `swapVerifyingContracts`, it
    auto-updates on the `swap:release` tag, and a full rolling swap against it was verified end
    to end (3000 → 3000, claims verified, leg-B redeem settled on chain).
  - `g.toon.swap.sol` (`b23599a6…`) is a **ghost**. Its `btpEndpoint` is the loopback literal
    `ws://127.0.0.1:3401`; nothing off the machine it ran on could ever dial it. It was a
    throwaway proof rig for swap#105 run from a scratchpad on an operator workstation, never in
    `infra/`, never handed to the factory, with zero hits across 200 commits of five repos. It
    has not existed since 2026-08-15. Its announce was hand-enriched and re-signed — the maker
    code path cannot emit that shape — and its advertised Solana token does not exist on public
    Solana devnet, so the "only Solana→EVM pair" was **unsatisfiable from the moment it was
    published**. It is also not a legacy consumer: a missing `swapVerifyingContracts` is a hard
    client-side reject (`MISSING_SWAP_VERIFYING_CONTRACT`), not a fallback trigger. Fallback keys
    on the RFQ probe outcome alone.

  So no devnet counterparty is stranded by this decision.
- **The real compatibility question is published clients, not devnet.**
  `@toon-protocol/client@0.29.8` and `@toon-protocol/rig` are on npm and
  `@toon-protocol/sdk@3.x` exports `createSwapHandler`, so rolling-incapable senders and
  legacy makers may exist outside our fleet. We cannot observe them, and no amount of maker
  telemetry will find them. They are handled by *announcement* — a major version, a migration
  note, and a loud named failure — not by keeping the code.
- **Cross-chain swap on devnet is already down, and this decision does not cause that.**
  `g.toon.swap.maker` announces `supportedChains: ["evm:84532"]` and a **placeholder**
  same-chain USDC-at-parity pair; `connector/infra/linode-relay/swap.config.json` says in its
  own comment that the real pair "is a business decision toon-meta#402 does not pin; a human
  must replace this before the maker is useful." Restoring cross-chain swap is a maker
  configuration and liquidity problem that exists independently of this record.
- **The ghost announce cannot be retracted, and will mislead clients indefinitely.** The relay
  treats kind:10032 as parameterized-replaceable and implements neither NIP-40 expiry nor NIP-09
  deletion, so the only way to clear the slot is to publish a newer event **from the original
  signing key** — which was ephemeral and appears to be gone. This is a known-unretractable
  litter item. The mitigation is therefore client-side and relay-side rather than
  key-side, and is tracked separately from this decision.
- **`@toon-protocol/swap` 2.1.0 is published too, and also takes a major.** `createSwapHandler`,
  `withMaxRateAge` and `createClaimRefusalDiagnostics` are re-exported from it.
  `MultiChainClaimIssuer` and `SwapInventory` **survive** — they are the leg-B claim signer and
  the rolling window's capital, exactly as `docs/rolling-swap.md` §10.3 step 5 anticipated. Only
  their legacy methods (`issueClaim`, `debit`, `credit`, `refundDebit`) go.
- **The whole Docker cross-chain E2E harness is legacy, and rolling has no equivalent.** All ten
  suites in `swap/packages/swap/tests/e2e/` drive the SDK's `streamSwap` zero-condition sender,
  and they were *restored* only weeks ago by swap#106. Deleting them without porting first would
  leave the project with **no** multi-chain end-to-end swap coverage at all. Porting the harness
  to rolling is therefore a prerequisite stage, not cleanup after the fact.
- **Rolling is younger and thinner, and the staging must respect that.** Its first live day
  produced an unroutable leg B to a direct-dialled sender and a value-bearing forward to a
  non-`child` next hop. Both are fixed, but the correct inference is that the removal stages are
  ordered by *observation*, not by calendar.
- **Four client capabilities exist only on the legacy path and must be ported or consciously
  dropped**: the adaptive δ/W controller, the per-packet `packets[]` telemetry, the
  `errors[]`/`abortReason`/`LOCAL_SEND_FAILED` local-failure diagnostics, and `timeoutMs` on the
  fill loop. Claims listing and settlement are already path-agnostic, so `toon_swap_claims` and
  `toon_swap_settle` need no work.

## Related

- [`docs/legacy-swap-removal.md`](../legacy-swap-removal.md) — the plan of record that
  implements this decision: the full touchpoint inventory with `file:line`, the stages, and the
  exit criterion for each. Epic
  [#411](https://github.com/toon-protocol/toon-meta/issues/411) tracks the work.
- [`docs/rolling-swap.md`](../rolling-swap.md) — the rolling protocol spec; §1 is the legacy
  critique this record rests on, §10 is the migration it supersedes.
- connector ADR
  [0019](https://github.com/toon-protocol/connector/blob/main/docs/adr/0019-a-terminating-connector-derives-the-fulfilment.md)
  — the Rust connector already deleted the legacy condition class.
- connector ADR
  [0032](https://github.com/toon-protocol/connector/blob/main/docs/adr/0032-a-client-destination-is-never-a-route-termination.md)
  — the law that makes rolling's leg-B return to a direct-dialled sender legal.
- Epics [#145](https://github.com/toon-protocol/toon-meta/issues/145) and
  [#394](https://github.com/toon-protocol/toon-meta/issues/394).
