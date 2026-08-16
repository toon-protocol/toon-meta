# Legacy swap removal — touchpoint inventory and staged plan

**Status:** plan of record for [ADR 0003](adr/0003-the-rolling-swap-is-the-only-swap.md) ·
**Scope:** `swap`, `toon-client`, `toon` (the sdk), `connector` · **Audience:** whoever
implements a stage

ADR 0003 decides *that* the legacy claim-in-FULFILL swap path is removed. This document is
*how*: what exists, in what order it goes, and how each step is observed before the next one
starts.

The work is tracked by epic
[toon-meta#411](https://github.com/toon-protocol/toon-meta/issues/411) and its twelve children;
the stage headings below carry their ticket numbers. Dependencies are encoded in each child's
`## Blocked by` section, which is what the dispatcher actually reads.

**The hard constraint: there is no window in which swapping is broken.** Every stage is
independently shippable and independently revertible, and the two removal stages are ordered so
that the sender stops emitting legacy strictly before the maker stops accepting it.

All `file:line` references verified 2026-08-16 against `swap` @ `20985cd`, `toon` sdk 3.1.8,
`toon-client` @ HEAD, `connector` @ HEAD.

---

## 1. What "legacy" means, precisely

The discriminator is one line of code. From `swap/packages/swap/src/swap-node.ts:1830-1837`,
the maker's own dispatch table:

| `executionCondition` | payload        | path                          |
| -------------------- | -------------- | ----------------------------- |
| absent / all-zero    | TOON/gift-wrap | **LEGACY**                    |
| absent / all-zero    | rolling fill   | reject F99 condition_required |
| non-zero (32B)       | rolling fill   | rolling engine (coupled legs) |
| non-zero (32B)       | anything else  | reject F99                    |

A **legacy** swap is: an all-zero-condition ILP PREPARE whose data is a kind:1059 gift wrap
whose inner rumor is **kind:20032**. The maker debits inventory and returns a signed chain-B
balance proof in the FULFILL `data`.

A **rolling RFQ** is the *same* outer shape — all-zero condition, kind:1059 gift wrap — whose
inner rumor is **kind:20033**. It is built by the same SDK primitives
(`wrapSwapPacketToToon` / `buildAndWrapPacket`) precisely so that it lands on the same seam.

### 1.1 The seam, and what is safe to cut

`swap/packages/swap/src/swap-node.ts:1912-1921`:

```ts
// Rolling RFQ (spec §2.2) — a zero-condition kind:1059 gift wrap, exactly
// like a legacy swap request, distinguished ONLY by its inner rumor kind
// (20033). It therefore has to be sniffed here, before the legacy branch,
// by unwrapping and reading that kind. `handle()` returns null for
// everything it cannot positively identify as an RFQ (including any unwrap
// failure), so the legacy path below stays byte-for-byte as it was.
const rfq = await rfqIntake.handle(request.data);
if (rfq) return rfq as HandlePacketResponse;

// Legacy path (zero-condition gift-wrap) — unchanged below.
```

**This answers the "is it just a branch?" question: yes, but only from `:1921` down.** The RFQ
intake at `:1918` sits *ahead* of the legacy branch and is fully independent of it. Removing
legacy means replacing the fall-through at `:1921` with a terminal, named reject — it does not
touch RFQ arrival.

Three things are **shared** and must survive:

1. **The zero-condition local-delivery seam itself.** The RFQ rides on it. It is not a legacy
   artefact.
2. **The gift-wrap primitives** — `wrapSwapPacketToToon`, `buildAndWrapPacket`,
   `unwrapSwapPacket`. The RFQ is built with them byte-for-byte.
3. **`applyRate`** (`toon/packages/sdk/src/swap-handler.ts:568`). It lives in the *legacy* file
   but has two **rolling** importers: `toon/packages/sdk/src/adaptive-controller.ts:52` and
   `swap/packages/swap/src/rolling-engine.ts:78`. Deleting `swap-handler.ts` without relocating
   `applyRate` first breaks the rolling engine. This is the single most dangerous edge in the
   whole removal.

---

## 2. Touchpoint inventory

### 2.1 `swap` — `@toon-protocol/swap` 2.1.0 (published)

| Kind        | Location                                                        | Disposition                                                            |
| ----------- | --------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Intake seam | `packages/swap/src/swap-node.ts:1921-1992`                      | **DELETE** — replace fall-through with a named terminal reject          |
| Wiring      | `packages/swap/src/swap-node.ts:36`, `:86`, `:1442`, `:1471`    | **DELETE** — `createSwapHandler` / `withMaxRateAge` import + wiring     |
| Reject      | `packages/swap/src/swap-node.ts:1880-1889`                      | **DELETE** — `CONDITION_UNSUPPORTED_LEGACY`, unreachable once legacy is |
| Public API  | `packages/swap/src/index.ts:215`                                | **DELETE** — `export { createSwapHandler } from '@toon-protocol/sdk'`   |
| Public API  | `packages/swap/src/index.ts:129`                                | **DELETE** — `withMaxRateAge`                                           |
| Staleness   | `packages/swap/src/rate-staleness.ts:462-485`                   | **DELETE** `withMaxRateAge` (a legacy-handler decorator)                |
| Staleness   | rest of `rate-staleness.ts`                                     | **KEEP** — the rolling engine has its own `stale_rate` refusal          |
| Refusal     | `packages/swap/src/claim-refusal.ts:283`                        | **DELETE** — wraps the issuer handed to `createSwapHandler`             |
| Issuer      | `MultiChainClaimIssuer` — `issueClaim`                          | **DELETE the method**, **KEEP the class** (leg-B claim signer)          |
| Inventory   | `SwapInventory` — `debit` / `credit` / `refundDebit`            | **DELETE the methods**, **KEEP the class** (the rolling window's capital) |
| Config      | `rolling.rfq.enabled`                                           | **DELETE the knob** — it becomes a footgun that disables the only path  |
| Tests       | legacy unit suites + `swap-flow*.integration.test.ts` + `tests/fixtures/fixture-topology.ts` | **DELETE**                             |
| Tests       | `packages/swap/tests/e2e/` (10 Docker suites)                   | **PORT FIRST** — all drive `streamSwap`; see §4 Stage 2c                |
| Gate        | `.sandcastle/gate-baseline.json`                                | **REBASELINE** after each deletion stage                                |
| Docs        | `CLAUDE.md`, `README.md`, `deploy/` README                      | Re-doctrine `inventory`; correct stale "never published" claims          |

`docs/rolling-swap.md` §10.3 step 5 already predicted this split: *"`MultiChainClaimIssuer`
remains as the leg-B claim signer (the per-chain signers and wallet stay), but the
claim-in-FULFILL response shape is removed."* The plan honours it.

### 2.2 `toon-client` — `@toon-protocol/client` 0.29.8 (published), `client-mcp` (unpublished)

| Kind            | Location                                                       | Disposition                                                        |
| --------------- | -------------------------------------------------------------- | ------------------------------------------------------------------ |
| Fallback select | `packages/client-mcp/src/daemon/client-runner.ts:2159-2167`    | **CHANGE then DELETE** — probe → rolling, else fall through         |
| Legacy body     | `ClientRunner.swap` legacy half, below the fall-through        | **DELETE**                                                          |
| Legacy sender   | `streamSwap` import from `@toon-protocol/sdk`                  | **DELETE**                                                          |
| Controller      | `createSwapController` (adaptive δ/W)                          | **PORT or DROP** — legacy-only today; see Stage 2b                  |
| Mode            | `rolling: 'auto' \| 'require' \| 'off'`                        | Default `'auto'` → `'require'`; then collapse the enum              |
| Tools           | `toon_swap_claims`, `toon_swap_settle`                         | **KEEP** — already path-agnostic                                    |
| Tests           | `swap-wire-compat.test.ts` and legacy `swap` runner suites     | **DELETE**                                                          |
| Docs            | `SKILL.md`, `tool-reference.md`, MCP tool descriptions, control-api JSDoc | **AMEND**                                                |

**Parity gaps — rolling does not yet do these, legacy does.** They gate the client removal:

- the adaptive δ/W controller (`controller` / `packetCount` request options),
- per-packet `packets[]` telemetry on `SwapResponse`,
- `errors[]` / `abortReason` / `LOCAL_SEND_FAILED` local-failure diagnostics,
- `timeoutMs` on the fill loop.

### 2.3 `toon` — `@toon-protocol/sdk` 3.1.8 on disk (3.2.0 pending)

| Kind         | Location                                             | Disposition                                                    |
| ------------ | ---------------------------------------------------- | -------------------------------------------------------------- |
| Handler      | `packages/sdk/src/swap-handler.ts:764` `createSwapHandler` | **DELETE** — the published symbol; forces a **major**      |
| Handler file | rest of `swap-handler.ts`                            | **DELETE**, except `applyRate`                                   |
| **Shared**   | `packages/sdk/src/swap-handler.ts:568` `applyRate`   | **RELOCATE FIRST** — rolling importers at `adaptive-controller.ts:52`, `swap/rolling-engine.ts:78` |
| Legacy sender| `packages/sdk/src/stream-swap.ts` (`streamSwap`)     | **DELETE**                                                       |
| **Shared**   | `packages/sdk/src/stream-swap.ts:315` `AccumulatedClaim` | **RELOCATE FIRST** — settlement type, not a legacy type      |
| Barrel       | `packages/sdk/src/index.ts:157`, `:174`              | **AMEND** the `./swap-handler.js` re-exports                     |
| API guard    | `packages/sdk/src/index.test.ts:120-188`             | **AMEND** — frozen public-API list                               |
| Tests        | `swap-handler.test.ts`                               | **RE-HOME** its quote-tape / receipts assertions, then delete    |
| Scripts      | `scripts/swap.mjs`, `scripts/swap-mina.mjs`, `scripts/README.md` | **DELETE**                                          |
| **Shared**   | `wrapSwapPacketToToon`, `buildAndWrapPacket`, `unwrapSwapPacket` | **KEEP** — the RFQ rides on them                     |
| **Shared**   | `build-settlement-tx.ts`, `verifyAccumulatedClaim`   | **KEEP** — settlement is path-agnostic                           |

### 2.4 `connector` — no code change

The connector is **swap-agnostic**, and this is a finding rather than an omission.

- The Rust connector deleted the legacy condition class with the TypeScript prototype
  (connector#465 / #543) and inverts it: an all-zero condition is invalid outright
  (ADR 0019).
- Zero-condition support that remains is for the **announcer's unpaid bootstrap greeting
  probe** — unrelated to swap. It **must not** be removed as part of this work.
- No `g.toon.swap.*` special-casing, no swap-shaped price, route or address rule.

Docs hygiene only:

- `docs/local-delivery-fulfillment-contract.md` — retire the legacy class,
- `docs/peer-wire-spec.md` §3.1 — drop the carve-out,
- stale `mill` vocabulary in ADRs 0001 / 0003 / 0013 / 0027 and the prefix-retirement checklist.

Fleet config `infra/linode-relay/swap.config.json` needs no change for the removal, but its
`swapPairs` is a **placeholder** same-chain USDC-at-parity pair by its own admission.

---

## 3. The observability gate

ADR 0003 requires that nothing is deleted before its replacement is *observed* working.
swap#137 made that possible — it installed a real JSON-line logger on the deployed maker, where
previously `cli.ts` supplied no `config.logger` and every log statement in the swap node and in
the SDK handler was a no-op.

But swap#137 logs **refusals**, not **admissions**: `swap.claim.refused`,
`swap.channelState.reserve_refused`, `swap.issueClaim.channel_reserve_failed`,
`swap.packet.dispatch_failed`. There is no event on the success path that says which protocol
served a swap. **"No legacy traffic for N days" is therefore not measurable today** — which is
why Stage 0 exists and why it is first.

---

## 4. The stages

Each stage names what it removes, what it is blocked by, how it is reverted, and the
**observable** condition that must hold before the next stage starts.

### Stage 0 — Make legacy traffic countable (`swap`, removes nothing) — swap#152

Emit a structured intake event at the dispatch seam classifying every arrival:
`legacy` (inner kind 20032) · `rolling-rfq` (20033) · `rolling-fill` · `refused`, with the
peer and pair. Ship it on `swap:release`.

- **Blocked by:** nothing.
- **Exit criterion:** the deployed `g.toon.swap.maker` emits the event, and a per-path count is
  readable from the box's logs for a full day.
- **Revert:** delete a log line.

### Stage 1 — Make the client's fallback loud (`toon-client`, removes nothing) — toon-client#595

Flip `swapDefaults.rolling` from `'auto'` to `'require'`. Every fallback reason becomes an
actionable error naming the maker pubkey, its ILP address and the reason. `'auto'` remains
available as an explicit opt-in for exactly one release.

This is the stage that satisfies ADR 0003's rule that the loud failure ships **before** the
maker's intake is removed.

- **Blocked by:** nothing (independent of Stage 0).
- **Exit criterion:** `toon_swap` against a maker that does not answer an RFQ throws with the
  named reason; an explicit `rolling: 'auto'` still falls back; a live devnet swap against
  `g.toon.swap.maker` still completes and settles.
- **Revert:** change one default back.

### Stage 2 — Close the parity gaps (removes nothing) — toon-client#596, toon-client#597, swap#153

- **2a `toon-client`** — port `timeoutMs`, `errors[]` / `abortReason` / `LOCAL_SEND_FAILED`,
  and per-packet `packets[]` telemetry onto the rolling path.
- **2b `toon-client`** — port the adaptive δ/W controller onto the rolling path, **or** record
  the decision to drop it. Rolling has its own sizing story; dropping may be correct, but it
  must be a decision, not an accident.
- **2c `swap`** — port the ten Docker cross-chain E2E suites in `packages/swap/tests/e2e/` from
  `streamSwap` to rolling. **This is the stage most likely to be skipped and most damaging to
  skip**: those suites are the project's only multi-chain end-to-end swap coverage, and they
  were themselves restored only weeks ago by swap#106.

- **Blocked by:** Stage 1 (2a/2b — same surface).
- **Exit criterion:** the rolling `SwapResponse` carries the same observable fields as the
  legacy one; the ported Docker E2E matrix is green in CI.
- **Revert:** additive; revert the PR.

### Stage 3 — Relocate the shared symbols (`toon`, minor, removes nothing) — toon#210

Move `applyRate` / `ApplyRateParams` out of `swap-handler.ts` and `AccumulatedClaim` out of
`stream-swap.ts` into their own modules, re-exporting from the same barrel paths so nothing
observable changes. Re-home `swap-handler.test.ts`'s quote-tape and receipts assertions.

Ship as **sdk 3.3.0 (minor)**. After this, `swap-handler.ts` and `stream-swap.ts` have **no
non-legacy importers**, which is the precondition that makes Stage 7 a mechanical deletion.

- **Blocked by:** nothing.
- **Exit criterion:** `swap-handler.ts` / `stream-swap.ts` import graph shows only legacy
  consumers; `index.test.ts`'s frozen public-API list is byte-identical; `swap` and
  `toon-client` build unchanged against 3.3.0.
- **Revert:** pure move; revert the PR.

### Stage 4 — The client stops sending legacy (`toon-client`, **removal #1**) — toon-client#598

Delete the legacy body of `ClientRunner.swap`, the `streamSwap` import, `createSwapController`
if 2b dropped it, and `swap-wire-compat.test.ts`. The `rolling` enum collapses.
`@toon-protocol/client` → **0.30.0**.

- **Blocked by:** Stage 1, Stage 2a/2b, **and Stage 0's exit criterion** (a measured legacy
  count, so we know what we are switching off).
- **Exit criterion:** no `streamSwap` import anywhere in `toon-client`; a live devnet rolling
  swap against `g.toon.swap.maker` completes and settles on chain.
- **Revert:** revert the PR — makers still accept legacy, so a reverted client works
  immediately. This is why the client goes first.

### Stage 5 — The maker stops accepting legacy (`swap`, **removal #2**) — swap#154

Delete `swap-node.ts:1921-1992` and the `createSwapHandler` / `withMaxRateAge` wiring; make
`rfqIntake.handle()` terminal, so a zero-condition gift wrap whose inner rumor is not kind:20033
gets a named reject. Remove the `rolling.rfq.enabled` knob. Delete the legacy unit and
integration suites and `fixture-topology.ts`. Rebaseline `.sandcastle/gate-baseline.json`.

- **Blocked by:** Stage 4, Stage 2c, **and Stage 0's measured gate — no legacy intake observed
  on the deployed maker for N consecutive days** (N to be set when Stage 0 produces its first
  baseline; it is a real reading, not a guess).
- **Deploy note:** merging this moves `swap:release` and the relay box's label-scoped Watchtower
  recreates `swap-node` within ~60 s. The ADR 0041 config gate — which boots the new image
  against `connector`'s committed `infra/linode-relay/swap.config.json` — is what stands between
  this merge and a crash-looped live maker. Do not bypass it.
- **Exit criterion:** the maker refuses an inner-kind-20032 arrival with a named reason; a live
  rolling swap still completes; the release gate passes.
- **Revert:** revert the PR and re-move the tag. Because Stage 4 already shipped, no client in
  our fleet is emitting legacy while this is in flight.

### Stage 6 — `@toon-protocol/swap` drops the legacy API (major) — swap#155

Delete `issueClaim`, `SwapInventory.debit` / `credit` / `refundDebit`, `withMaxRateAge`,
`createClaimRefusalDiagnostics` and the `createSwapHandler` re-export at `index.ts:215`.
`MultiChainClaimIssuer` and `SwapInventory` **stay**. → **swap 3.0.0**.

- **Blocked by:** Stage 5.
- **Exit criterion:** 3.0.0 published with a migration note; the fleet image builds from it.

### Stage 7 — The SDK withdraws `createSwapHandler` (major) — toon#211

Delete `swap-handler.ts` (minus the already-relocated `applyRate`), `stream-swap.ts` (minus the
already-relocated `AccumulatedClaim`), the barrel re-exports, `scripts/swap*.mjs`, and amend the
frozen public-API list. → **sdk 4.0.0**, shipped with a migration note naming `startSwapNode`
as the supported way to run a maker.

- **Blocked by:** Stage 3 (relocation), Stage 4 and Stage 6 (no importers left).
- **Exit criterion:** 4.0.0 published; `swap` and `toon-client` build and their gates pass
  against it.

### Stage 8 — Docs and vocabulary — connector#1024, toon-client#599

Retire the connector's legacy local-delivery class and peer-wire carve-out, clean the residual
`mill` vocabulary, amend the client's SKILL/tool docs, and mark `docs/rolling-swap.md` §10 as
superseded history.

- **Blocked by:** Stage 7.
- **Exit criterion:** no document describes the legacy path as available.

---

## 5. Known-unretractable litter: the `g.toon.swap.sol` announce

This is **not** a blocker for any stage — see ADR 0003 — but it does not go away, and the plan
should not pretend otherwise.

The relay treats kind:10032 as parameterized-replaceable and implements **neither NIP-40 expiry
nor NIP-09 deletion**. The only way to clear the slot is a newer event signed by the original
key, and that key was ephemeral scratchpad material that appears to be gone. So a
permanently-unsatisfiable Solana→EVM swap pair — advertising a token that does not exist on the
chain it names, at a loopback endpoint — will be served to every discovering client for as long
as the relay keeps the event.

Because the key-side fix is unavailable, the mitigations are relay-side and client-side, and
both are tracked as separate follow-ups filed alongside this plan:

- a relay expiry / deletion path for replaceable announces, and
- a client-side discovery filter that skips an announce whose `btpEndpoint` resolves to a
  loopback or private address.

The second is the one that actually protects users, and it protects them against *any* future
scratchpad rig that announces to a live relay — not just this one.

## 6. What this plan does not fix

- **Cross-chain swap on devnet is down and stays down.** `g.toon.swap.maker` is EVM-only with a
  placeholder pair. Restoring it is a maker configuration, liquidity and business decision,
  independent of this work.
- **Rolling-incapable clients published to npm** cannot be observed or migrated, only
  announced to. Stage 6 and Stage 7's migration notes are the entire mitigation.
