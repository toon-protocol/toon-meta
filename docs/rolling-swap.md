# Rolling Swap — re-priced coupled micro-packets, adaptive sizing, batched settlement

**Status:** Design spec (pre-implementation, except §4: the `maxRateAge` guard is prototyped and calibrated — swap#48/swap#53, reconciled into §4/§4.1) · **Scope:** cross-chain swap path across `@toon-protocol/swap`, `@toon-protocol/sdk`, the connector, and toon-client · **Audience:** swap-node (maker) operators, SDK implementers, client integrators

This document is the design spec for the rolling cross-chain swap
([toon-meta#145](https://github.com/toon-protocol/toon-meta/issues/145)): a large swap executed
as a stream of many small ILP packets, each **re-priced at the maker's fresh quote** and
**coupled to a single fulfillment condition** so the two legs — asset A on chain A, asset B on
chain B — commit or fail together, packet by packet. It replaces the custodial claim-issuance
model (`@toon-protocol/swap`'s `mill.ts` + `MultiChainClaimIssuer`) on the swap path. Risk
mitigation comes from one primitive — packetization — not from a held price or a separate
escrow: because each packet re-prices at the current rate and is loss-bounded to a single
packet window, neither side ever carries a stale-price option larger than one δ. This is the
ILP/STREAM risk model (rfc-0029) pointed at a cross-*currency*, cross-*chain* trade.

**Terminology.** The component historically called "the mill" is the **swap node** (its
counterparty role: the **maker**); the mill vocabulary is retired. `mill`-named identifiers
below (`mill.ts`, `MillInventory`, …) appear only in code citations pinned to
`@toon-protocol/swap` 0.1.0, where the shipped code still uses the old names — the code
rename (`SwapNodeConfig`/`startSwapNode`, `SWAP_*` env) is landing in parallel.

The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are to be interpreted as in RFC 2119.

**Acceptance for this spec:** a fresh reader can implement a rolling-swap maker and a
rolling-swap sender against the extension points named in §3–§8 and understand exactly what
changes relative to the deployed swap node, end to end, without asking questions. If you find
yourself asking one, that is a bug in this document — file it.

**Version pins.** All `file:line` references below were verified 2026-07-12 against:
`@toon-protocol/swap` 0.1.0 (pins `@toon-protocol/sdk` ^0.5.0 and `@toon-protocol/connector`
^3.10.0), `@toon-protocol/sdk` 1.0.1 at `toon` HEAD, `@toon-protocol/connector` 3.28.3 at
`connector` HEAD, and toon-client HEAD (`packages/client` and `packages/client-mcp` both pin
sdk ^0.5.0). The 0.5.x/1.x split is itself a migration hazard — see §10.1.

---

## 1. Motivation — what the custodial swap node actually does today

The current swap node is a **custodial, pre-funded, single-maker FX desk**. A sender streams
NIP-59 gift-wrapped fill requests at it; per packet, the swap node debits its own asset-B inventory
and returns a signed chain-B balance proof *inside the FULFILL `data`*
(`swap/src/claim-issuer.ts:143-250`, metadata assembly `sdk/src/swap-handler.ts:781-805`).
Three structural problems, each grounded in the shipped code:

### 1.1 Delivery-atomic, not value-atomic — and in the deployed client, not even verified

The intended guarantee is that the sender's chain-A payment only commits if the swap node returns a
FULFILL. But nothing binds the *value* of what comes back: by the time the sender can inspect
the returned claim, chain A has committed. All of the `chainRecipient` and signer-address
validation in `claim-issuer.ts:157-170` is verify-after-commit, not enforcement.

The deployed reality is weaker still, in two ways:

- **There is no hashlock on the sender's leg at all.** The leg-A ILP PREPARE carries an
  **all-zero `executionCondition`** (`toon-client/packages/client/src/adapters/HttpIlpClient.ts:212`;
  same on the BTP path, `BtpRuntimeClient.ts:198,252`; `btp/protocol.ts:228` comments "Skip
  32-byte fulfillment (unused in TOON)"), and the connector's verify path explicitly skips
  zero conditions (`connector/src/core/packet-handler.ts:1556-1558`). "The ILP condition
  guarantees delivery" is aspirational: today nobody client-side generates a condition
  preimage, so even *delivery*-atomicity is unenforced on the sender leg. End-to-end
  conditions (§3) are **new behavior**, not a reuse of existing behavior.
- **The deployed client verifies nothing.** `ClientRunner.swap`
  (`toon-client/packages/client-mcp/src/daemon/client-runner.ts:1442-1482`) wires neither
  `onPacket` nor `rateDeviationThreshold`, performs no signature, channelId, nonce, or amount
  validation, and returns the swap node's claims to the MCP caller as base64. The SDK's settlement
  verifier (`sdk/src/settlement/build-settlement-tx.ts:76-478`) and `verifyAccumulatedClaim`
  (`:495-562`) have **zero call sites in toon-client**. If the swap node returns a bogus claim,
  leg A is committed, and there is no error path, rollback, or refund. The epic's
  "verify-after-commit" critique is *understated* for the deployed client: it is
  no-verify-at-all.

### 1.2 Inventory is a honeypot sized to notional

The operator pre-funds `SwapNodeConfig.inventory` (formerly `MillConfig`) per chain (`swap/src/mill.ts:228`, seeded at
`:755-766`); every issued claim permanently debits `available` by the full `targetAmount`
(`swap/src/inventory.ts:75-98`), and `credit` is only ever called for rollbacks
(`claim-issuer.ts:187,207`). There is no refill loop, no rebalancing, no top-up path anywhere
in the repo. The pool must therefore be sized to the **total notional flow** the swap node expects
to fill, on every chain it supports, held hot behind one mnemonic (`swap/src/wallet.ts:2-10`).
That is a cross-chain custodial honeypot plus capital drag, and it is all in-memory, lost on
restart (`swap/src/channel-state.ts:18`).

### 1.3 Single maker

The rate is a **static decimal string** in the swap node's kind:10032 event
(`SwapPair.rate`, `toon/packages/core/src/types.ts:71-82`, published at
`swap/src/mill.ts:1380-1409`). The live-rate hook `rateProvider`
(`sdk/src/swap-handler.ts:158`, called per packet at `:667-678`) is wired by nothing — the
swap CLI never sets it, so deployed swap nodes price at the config-frozen rate. Client-side, the
pair (including the rate) is a caller-supplied MCP parameter
(`toon-client/packages/client-mcp/src/mcp-tools.ts:392-443`); the client repo contains no code
that fetches a quote from anywhere. One quote source, no price competition, a censorship
point, and a single point of failure — which the #96 multi-chain payout path leans on
entirely.

Rolling coupled packets fix 1.1 directly (coupling means a maker cannot take leg A and stall
leg B beyond a bounded window), shrink 1.2 from notional to the in-flight window (§8), and set
up a fix for 1.3 by dropping the per-maker capital bar so a competitive maker board becomes
viable (explicitly a fast-follow, §12).

---

## 2. Protocol overview

### 2.1 Terms

| Term | Meaning | Owned by |
|---|---|---|
| `δ` (delta) | Packet size, in source-asset (A) units | sender controller (§6) |
| `W` | In-flight window: max unfulfilled packets outstanding | sender controller (§6) |
| `R_i` | Maker's fresh quote applied to packet *i* (asset-B units per asset-A unit, decimal string) | maker |
| `spread` | Maker's advertised two-sided spread, from its quote board (§2.3) | maker |
| `ε` | Freshness tolerance: per-packet slippage budget, a **fraction of the advertised half-spread** — never an absolute rate | sender, derived |
| `v` | Quote-tape volatility: EWMA of `abs(ΔR)/R` per second, measured from the tape (§7) | sender, measured |
| `τ` | Measured packet round-trip time, seconds | sender, measured |
| `maxRateAge` | Maker's own freshness bound on its rate source | maker (§4) |
| `minExchangeRate` | Sender's hard floor on per-packet effective rate | sender (§5) |
| `P_i` / `C_i` | Per-packet fulfillment preimage / condition, `C_i = sha256(P_i)` | sender mints (§3) |
| `streamNonce` | Random 16-byte session id minted at RFQ, referenced by every fill packet | sender |

### 2.2 Packet lifecycle

A rolling swap is one **RFQ round trip** followed by a **stream of fill packets**. The split
is deliberate: NIP-59 gift wrap (and its `SWAP_MNEMONIC` — formerly `MILL_MNEMONIC` — recipient footgun,
`toon-meta/docs/protocol.md:28-46`) stays on the occasional negotiation message; the frequent
fill packets are plain ILP packets — unwrapped channel advances under the shared condition.
This keeps the hot path off Nostr.

| Phase | Frequency | Carrier | Envelope | Contents |
|---|---|---|---|---|
| RFQ request | once per session (re-issued after staleness rejects, sender's option) | paid ILP write, NIP-59 gift wrap to the maker pubkey | rumor kind:20033 → seal → kind:1059 | pair, size hint, `chainRecipient`, `streamNonce`, sender chain-B pubkeys |
| RFQ response | once per request | NIP-59 gift wrap back to the RFQ's reply key | rumor kind:20034 | quote `R₀`, `spread`, `maxRateAge`, `minAmount`/`maxAmount`, quote expiry |
| Fill packet leg A | many (one per δ) | ILP PREPARE sender→apex→maker, condition `C_i` | plain TOON payload, **no gift wrap** | `streamNonce`, `seq`, amount δ; leg-A channel claim attached as today |
| Fill packet leg B | one per leg A | ILP PREPARE maker→apex→sender, **same condition `C_i`** | plain TOON payload | `streamNonce`, `seq`, chain-B cumulative claim for `⌊δ·R_i⌋` |
| Fulfill | one per coupled pair | leg-B FULFILL (sender reveals `P_i`) then leg-A FULFILL (maker relays `P_i`) | FULFILL `data` | quote-tape record + receipt (§7) |

Framing note: **today no quote travels at all** — the kind:20032 gift wrap carries the *fill
request* against a static advertised rate (`buildSwapRumor`, `sdk/src/stream-swap.ts:320-354`).
The RFQ round trip above is new protocol behavior, not preservation of an existing one. The
existing kind:20032 fill rumor is superseded on this path by the unwrapped fill format;
session-scoped fields (`chainRecipient`, pair) move into the RFQ so per-fill packets carry
only `{streamNonce, seq, amount, C_i}` — smaller, and the chain-B recipient address is not
re-broadcast in plaintext on every packet.

### 2.3 Where the pieces land in the existing code

| Piece | Extension point |
|---|---|
| Maker termination (replaces `issueClaim`-in-FULFILL) | `setPacketHandler` → `localDeliveryHandler` dispatch (`connector/src/core/packet-handler.ts:390-398`, `:1178-1207`; swap-node registration `swap/src/mill.ts:1138-1146`) |
| Maker fresh quote | the existing per-packet `rateProvider` hook (`sdk/src/swap-handler.ts:667-678`) — finally wired |
| Staleness reject | inbound gate: `InboundClaimValidatorFn` before the packet handler (`connector/src/btp/btp-server.ts:905-941`) — see §4 for why the *gate*, not the handler (prototyped at the handler seam in swap#53; calibrated defaults in §4.1) |
| Maker leg-B egress | `ConnectorNode.sendPacket` (`connector/src/core/connector-node.ts:593-635`), same path the swap node already uses for kind:10032 publishes |
| Condition pass-through | existing skip-if-nonzero at `packet-handler.ts:1512-1519`; verify at `:1554-1594` (§3, R3/R6) |
| Sender controller | `streamSwapControlled` pause/resume + per-packet `onPacket` (`sdk/src/stream-swap.ts:824-909`, `:1230-1271`) |
| Quote tape carrier | the FULFILL accept-metadata dict (`sdk/src/swap-handler.ts:781-805`) — additive fields (§7) |

---

## 3. The shared condition — normative rules

One condition per packet couples both legs. The commit act is the **sender's reveal of the
preimage after verifying the leg-B claim** — this is the inversion that turns
verify-after-commit (§1.1) into verify-before-commit.

**Normative rules:**

- **R1.** The sender MUST mint a fresh random 32-byte preimage `P_i` per fill packet and set
  `C_i = sha256(P_i)`. Fresh per packet because reveal is the commit act: a reused preimage
  lets any observer of packet *i* fulfill packet *i+1* without the sender's consent.
- **R2.** The leg-A PREPARE MUST carry `C_i` as its `executionCondition`, replacing today's
  all-zero condition (`HttpIlpClient.ts:212`, `BtpRuntimeClient.ts:198,252`). A zero condition
  is skipped by the connector's verifier (`packet-handler.ts:1556-1558`), so with zero there
  is no coupling at all.
- **R3.** Connectors MUST pass a non-zero upstream condition through unchanged and MUST NOT
  substitute their own HKDF-derived condition. The forward path already behaves this way — it
  only sets its own condition when the packet doesn't carry a non-zero one
  (`packet-handler.ts:1512-1519`) — this rule pins that behavior as load-bearing. This is how
  the sender-minted condition composes with the connector's existing HKDF/ECDH scheme
  (`connector/src/settlement/privacy/nip59-claim-wrapper.ts:446-474`): the HKDF condition is
  the *default* when no end-to-end condition exists; a rolling-swap packet always carries one,
  so the HKDF path is bypassed by the connector's own precedence rule, hop by hop.
- **R4.** The maker MUST copy `C_i` unchanged onto the leg-B PREPARE. One condition across
  both legs is the entire coupling mechanism; distinct conditions reintroduce the stall
  window.
- **R5.** The sender MUST verify the leg-B claim **before** revealing `P_i`, and MUST NOT
  reveal `P_i` otherwise. Verification is: (a) per-chain signature over the canonical hash
  layout in `@toon-protocol/core` (`toon/packages/sdk/src/settlement/hashes.ts:19-27`),
  (b) `recipient` equals the session `chainRecipient` (EVM case-insensitive, matching the
  existing anti-substitution check at `stream-swap.ts:1098-1119`), (c) nonce and
  `cumulativeAmount` strictly monotone over the session, (d) effective rate
  `Δcumulative / δ ≥ minExchangeRate` (§5). This is the only point in the protocol where
  value-atomicity is enforced, which is why every check sits before the reveal.
- **R6.** The maker MUST fulfill leg A only with the `P_i` learned from the leg-B FULFILL.
  The connector's existing check `sha256(fulfillment) == executionCondition` with F99 on
  mismatch (`packet-handler.ts:1554-1594`) then holds the maker to it. The local-delivery
  preimage-injection path (`packet-handler.ts:1191-1196`, derivation `:427-450`) MUST NOT
  substitute its NIP-59/HKDF-derived preimage when the PREPARE carried a sender-minted
  non-zero condition — the injected preimage would fail R6's hash check and turn every
  coupled packet into an F99.
- **R7.** Leg-A `expiresAt` MUST cover the leg-B round trip plus the maker's processing
  budget (`expiresAt_A ≥ now + 2τ_est + makerBudget`), and the maker MUST set leg-B
  `expiresAt < expiresAt_A` so the inner leg always resolves first. Today this cannot be
  expressed: `BuildIlpPrepareParams.expiresAt` is accepted and silently dropped
  (`toon/packages/core/src/x402/build-ilp-prepare.ts:25` vs `:55-63`), with the actual expiry
  transport-set from the client timeout (`HttpIlpClient.ts:213`). Fixing that plumbing is a
  prerequisite (§10.2).
- **R8.** A channel claim attached to a PREPARE that terminates in a REJECT MUST NOT advance
  the redeemable watermark on the receiving side. For staleness rejects this is enforced
  structurally by rejecting at the inbound gate *before* claim ingestion (§4); for
  post-ingestion failures see the exposure accounting below.

### 3.1 Who moves first, and the residual exposure — stated honestly

The leg-A claim rides the PREPARE (in the `ILP-Payment-Channel-Claim` header today,
`HttpIlpClient.ts:221-225`), so for in-flight packets the maker's side holds a signed leg-A
claim before the sender holds a verified leg-B claim. TOON balance proofs are unconditional
signatures — the ILP condition gates the *packet*, not the on-chain redeemability of a claim
that was already ingested. A Byzantine maker can therefore bank the in-flight leg-A advances
and stall.

This is the designed residual, not an oversight: **worst-case unrecovered sender exposure is
`δ·W`** — the in-flight window — after which R5 gives the sender nothing further to lose (it
stops revealing preimages and halts the stream). The epic's risk thesis is exactly this bound:
loss limited to the packet window, kept small by the controller (§6), attributable via the
receipt trail (§7), and priced against the maker's own stake in future flow. Binding claim
redemption itself to the preimage (HTLC-style claims, requiring contract changes on every
chain) is the option-3 intent+settlement escrow layer and an explicit non-goal here (§12).

On a failed packet the sender's already-signed leg-A claim covers value that was never
delivered. The sender MUST NOT paper over the gap by re-signing a lower cumulative at a higher
nonce — the settlement verifier requires cumulative monotone in nonce
(`build-settlement-tx.ts:321-389`) and would reject the stream. Instead the sender MUST treat
the shortfall as maker debt in its session ledger: it MAY continue streaming (stacking new
value on top of the debt) only while `debt ≤ δ`, and MUST halt the session once debt exceeds
one packet. One packet of tolerated debt, never more, is what "loss-bounded to a single
packet" means operationally.

### 3.2 Sender-side leg-B termination is new client surface

Leg B is a real ILP packet addressed to the sender, so the sender's daemon must terminate
inbound packets and ingest received claims. **No such path exists in toon-client today** — not
for this protocol, not for anything: received chain-B claims are currently returned to the MCP
caller as base64 and never persisted, verified, or settled (`client-runner.ts:1459-1481`; zero
`buildSettlementTx`/`verifyAccumulatedClaim` call sites). This is a hard dependency of the
rolling engine, tracked as its own story under #145, and nothing in this spec silently assumes
it. The natural shape is the daemon registering a local-delivery handler the same way the swap node
does (`setPacketHandler`, §2.3) on a lightweight embedded child node, with received claims
persisted beside `ChannelStore` (`toon-client/packages/client/src/channel/ChannelStore.ts:3-91`).

---

## 4. Maker staleness reject (`maxRateAge`)

The maker-side guard. If the maker's rate source has not updated within `maxRateAge`, the
maker MUST reject incoming fill packets rather than fill at the stale `R` — otherwise a sender
who observes the market moving faster than the maker's feed farms the difference packet by
packet. This is the newest behavior in the stack and the hinge the fairness argument hangs on.

**Normative rules:**

- The maker MUST reject any fill packet when `now − lastRateUpdate > maxRateAge`, where
  `lastRateUpdate` is the timestamp of its own rate source's latest tick for the pair. The
  bound is on the *maker's own feed*, not on anything the sender claims — the sender never
  prices packets in rolling mode, so there is nothing sender-side to age-check.
- The reject MUST be **benign and machine-readable**. The contract as implemented
  ([swap#53](https://github.com/toon-protocol/swap/pull/53)): handler-level code `T99`
  (temporary, application layer — the T-class tells the sender "retry later" as opposed to
  the F-class "don't retry"), `message` the bare token `stale_rate`, and base64-JSON
  `data = {"reason":"stale_rate","maxRateAgeMs":…,"lastRateAt":…,"pair":…}`
  (`lastRateAt: null` = feed never ticked). The swap handler's existing reject-code ladder
  (`sdk/src/swap-handler.ts:206-237`, reverse-mapped at `swap/src/mill.ts:1118-1130`) gains
  this entry. **The sender's authoritative discriminator is `data.reason === "stale_rate"`
  (fallback: `message === "stale_rate"`), never the wire code.** Connector caveat: the
  published connector (≤ 3.20.1) has no `stale_rate`/T99 entry in its `REJECT_CODE_MAP`, and
  an unmapped semantic would collapse to F99 — F-class, "don't retry", inverting the benign
  contract — so the prototype pins the semantic reason to `timeout` and the wire code is
  currently **T00** (still T-class, retryable). A connector follow-up PR adds
  `stale_rate: 'T99'` to the map; until it ships, senders MUST NOT key any behavior off
  seeing `T99` on the wire.
- The reject MUST be enforced at the **inbound gate** — the `InboundClaimValidatorFn` that
  runs before the packet handler (`connector/src/btp/btp-server.ts:905-941`, semantics in
  `connector/src/btp/inbound-claim-validator.ts:124-288`) — not in the swap handler. At the
  gate the leg-A claim has not yet been ingested, so a staleness reject leaves no watermark
  advance and no maker debt (R8). Rejecting later, in the handler, would strand a live claim
  on every feed hiccup. *Implementation status:* the swap#53 prototype enforces the bound at
  the **handler seam** (a decorator ahead of replay reservation, pricing, inventory debit,
  and leg-B claim issuance) — so prototype rejects today still leave the leg-A claim
  ingested, exactly the R8 hazard this rule exists to close. The calibration confirmed the
  gate as final placement and surfaced what it needs: at the gate the packet is an opaque
  gift wrap, so the gate needs the swap node's unwrap capability, a coarser per-destination
  scope, or the toon#82 on-wire rate timestamp to resolve the pair. Moving there is blocked
  on the connector publish pipeline (nothing past 3.20.1 is published).
- `maxRateAge` is a **maker-owned, per-chain-pair config knob**, advertised in the RFQ
  response (§2.2) alongside the spread — not a protocol constant. The calibration confirmed
  this design point empirically: the bound alone cannot make a slow-feed maker whole
  (§4.1, finding 3), so it is co-tuned with the advertised spread per maker and per pair.
  What was the epic's highest-risk open question (too loose → slow-feed makers farmed; too
  tight → Mina swaps stall on constant rejects) is now answered — under simulated feeds —
  by the [swap#48](https://github.com/toon-protocol/swap/issues/48) calibration; see §4.1
  for the recommended defaults. (An earlier revision of this document suggested "low
  hundreds of ms on Base-class chains" as an indicative starting point. That intuition was
  wrong: 100 ms against a realistic ~250 ms Base-class feed is a 65% reject storm. Superseded
  by §4.1.)

**Sender response:** a `stale_rate` reject is not an error. The sender SHOULD back off
briefly (≥ one `maxRateAge`), MAY re-issue the RFQ for a fresh board quote, and MUST count the
event in the controller as a shrink signal (§6). Preimage `P_i` is discarded; `seq` is not
reused.

### 4.1 Calibration — recommended defaults (empirical, simulated feeds)

**Status: empirical, not normative.** Everything in this subsection comes from the swap#48
calibration prototype (writeup:
[swap#48 calibration comment](https://github.com/toon-protocol/swap/issues/48#issuecomment-4952509158);
harness in [swap#53](https://github.com/toon-protocol/swap/pull/53),
`packages/swap/src/max-rate-age.calibration.test.ts`) — a seeded, deterministic
**simulation**: lognormal feed-tick intervals with an occasional-gap tail, Poisson fill
arrivals, reject iff quote age > A at arrival, staleness exposure of an accepted fill
proxied as σ·√age bps (calm σ = 1 bps/√s ≈ 60% annualized; burst = 10×, which is when
farming actually pays). **Live-devnet measurement against a real Mina-class feed is the
remaining follow-up** before the rolling engine hard-depends on the guard. The defaults
below are maker-advisory starting points (exported as `RECOMMENDED_MAX_RATE_AGE_MS`,
assertion-pinned in the harness), not protocol constants.

| chain class | recommended `maxRateAge` | reject rate | worst burst exposure |
|---|---|---|---|
| evm (Base-class, ~250 ms median tick) | **1500 ms** | 0.22% | 12.2 bps |
| solana (~500 ms median tick) | **3000 ms** | 0.62% | 17.3 bps |
| mina (~4 s median tick, heavy gap tail) | **15000 ms** | 1.51% | 38.7 bps |

What the curves say:

1. **Rule of thumb: `A ≈ 4–6× the feed's median tick interval ≈ its p99 gap`** — the knee of
   every measured curve. Below it, rejects explode: 100 ms on a ~250 ms Base-class feed is
   64.8% rejects, and even 2× the median cadence (500 ms) still bounces ~5% of fresh
   traffic.
2. **There is a knee, not a monotone tradeoff.** Past the feed's gap tail, rejects go to ~0
   while the farmable staleness exposure keeps growing ~√A: loosening mina 20 s → 60 s buys
   0.48% → ~0% rejects but grows the worst-case burst budget 44.7 → 77.5 bps. Bounds looser
   than the knee are pure adversary subsidy.
3. **`maxRateAge` alone cannot make a slow chain safe.** Even at the recommended Mina bound,
   burst-volatility worst-case staleness (~39 bps) exceeds a typical 10–30 bps half-spread.
   The residual must be priced by the maker's advertised spread and absorbed by the §6
   controller shrinking δ on `stale_rate` signals — which is why the bound stays a
   maker-owned knob co-tuned with the spread rather than a protocol constant.
4. **The worked example's regime is routine, not a fluke.** On a Mina-class feed a 10 s
   bound rejects ~4× more than 15 s (5.85% vs 1.51%); 12.6 s feed gaps are ordinary events
   in that regime (the §11 tape's reject is a genuine 16.8 s blackout). Stalls are bounded,
   not fatal: the worst stall equals the worst feed blackout beyond the bound (tens of
   seconds on Mina-class), and the sender backoff (≥ one `maxRateAge`) rides through it.

---

## 5. Sender floor (`minExchangeRate`)

The sender-side guard, per rfc-0029: a hard cap on the worst-case fill.

**Normative rules:**

- The sender MUST fix `minExchangeRate` at session start — derived from the RFQ quote `R₀`
  minus its slippage tolerance — and MUST enforce it per packet at R5(d), *before* revealing
  `P_i`. Enforcing pre-reveal is the whole point: this is the one check that runs before value
  commits.
- `minExchangeRate` MUST NOT be relaxed by any controller signal. The controller (§6) is an
  efficiency mechanism; the floor is the safety mechanism, and coupling them would let a calm
  tape talk the sender into a worse worst case — precisely the adversarial-tape attack the
  epic flags.
- The floor value MUST NOT be disclosed to the maker (no tag on the RFQ or fill packets).
  Disclosing it invites quoting exactly at the floor.
- A leg-B claim below the floor is rejected exactly like any other R5 failure: no reveal,
  benign leg-B reject (`F99`, `data.reason = "below_floor"` — F-class, because retrying the
  same claim cannot succeed), packet fails, controller shrink signal.

Today's nearest analogue — `rateDeviationThreshold` + `onPacket`
(`stream-swap.ts:1150-1196`, `:1286-1293`) — is soft, post-hoc, computed from the maker's
self-reported `targetAmount`, and not wired by the daemon (`client-runner.ts:1446-1457`). It
is superseded by the floor, not extended.

---

## 6. Adaptive controller — δ and W

Two knobs, managed separately: δ (packet size) bounds *per-packet pick-off risk*; W (in-flight
window) bounds *timing/liveness risk* and, per §3.1, the worst-case unrecovered exposure
`δ·W`. The controller runs sender-side in the SDK, at the `streamSwapControlled` seam (§2.3).

**Normative rules:**

- **The cap.** `delta_cap = ε / (v·τ)`, recomputed per packet from measured state, and
  `δ ≤ delta_cap` always. Unit convention: δ and `delta_cap` are fractions of the session's
  remaining notional; `v·τ` is the expected fractional rate drift while one packet is in
  flight; ε is the per-packet slippage budget as a fraction of the advertised half-spread
  (default `ε = 0.5 × halfSpread`). The cap enforces — rather than assumes — "small enough to
  measure the price change": value at risk to one stale quote, `δ × (v·τ)`, stays within ε.
- **ε is spread-denominated, never absolute.** The half-spread is already on the wire in the
  RFQ response, so ε self-calibrates per chain and per maker from quantities the sender
  already has; an absolute-rate ε would need per-pair hand-tuning and would rot.
- **Inputs are measured, not trusted.** `v` is an EWMA of `abs(R_i − R_{i−1})/R_{i−1}` per
  second read off the quote tape (§7); `τ` is an EWMA of observed round-trip times; both
  update on every fulfilled packet. A maker can paint its own tape calm — which is why the
  floor (§5) holds standalone and is never relaxed.
- **Asymmetric adjustment, one knob per step.** On a shrink signal (a `stale_rate`
  reject (§4), an R5 failure, or realized per-packet slip `> ε`): multiplicative —
  `δ ← max(δ_min, δ/2)`, or if the signal was a timeout/expiry, `W ← max(1, ⌈W/2⌉)`. On a
  clean streak of `K = 16` consecutive fulfills: additive — `δ ← min(delta_cap, δ + δ_0)` or
  `W ← min(W_max, W + 1)`, alternating, never both in one step. One knob per step keeps
  cause and effect attributable; the TCP-style asymmetry means one bad event undoes many good
  ones, which is the correct prior against an adversarial counterparty.
- **Cold start ramps.** With no persisted state for the tuple: `δ_0 = min(delta_cap,
  notional/256, maker maxAmount)`, `W_0 = 1`. Until the first shrink signal ever observed for
  the tuple, the widen step MAY be multiplicative (`δ ← min(delta_cap, 2δ)` per clean streak)
  — slow-start — dropping to additive permanently after the first loss event. The ramp doubles
  as trust-building with an unknown maker: early packets are cheap probes.
- **State is per-(chain, maker, pair) and persisted.** Key
  `${chain}:${makerPubkey}:${from}:${to}`, value `{delta, W, vEwma, tauEwma, cleanStreak,
  everShrunk, updatedAt}`, persisted beside `ChannelStore` (`JsonFileChannelStore` pattern,
  `ChannelStore.ts:3-91`). Per-tuple state is how the same code runs fast on Base and cautious
  on Mina — the regime is discovered, not hard-coded to the worst chain.

---

## 7. Quote tape and receipts

**Both are new. No STREAM, `minExchangeRate`, rfc-0029, or rfc-0039 implementation exists in
any of the four repos** — verified by exhaustive grep across `swap`, `toon`, `connector`, and
`toon-client` (zero hits, checked twice). The nearest analogue is the hand-rolled
packetization in `streamSwap` (`stream-swap.ts:286-310`). What follows defines the TOON-native
equivalents; it does not import rfc-0039's wire format.

### 7.1 The quote tape

Each fulfilled packet's accept-metadata dict — today
`{claim, ephemeralPubkey, targetAmount, claimId?, channelId, nonce, cumulativeAmount,
recipient, swapSignerAddress}` (`swap-handler.ts:781-805`) — gains two additive fields:

| Field | Type | Meaning |
|---|---|---|
| `rate` | decimal string | `R_i`, the maker's quote actually applied to this packet |
| `rateTimestamp` | unix ms | when the maker's rate source produced `R_i` |

The sequence `(R_1, t_1), (R_2, t_2), …` **is the price tape**: the execution is its own price
instrument. The controller reads `v` from it; the sender cross-checks each packet's
`Δcumulative` against `⌊δ · R_i⌋` (truncation toward zero, matching `applyRate`,
`swap-handler.ts:349-383`); no oracle, no rate probing, no information leak beyond the fills
themselves. `decodeFulfillMetadata` MUST be extended to parse both fields and MUST surface a
malformed tape entry as a packet-level error — the existing decoder silently drops malformed
settlement fields (`stream-swap.ts:522-581`, per #153), and a silently missing tape would
starve the controller while the stream runs blind.

### 7.2 Receipts

Per fulfilled packet the maker MUST include a compact signed receipt in the accept-metadata:

```json
{
  "receipt": {
    "v": 1,
    "streamNonce": "…16 bytes hex…",
    "seq": 42,
    "cumulativeDelivered": "168070000000",
    "rate": "4.0007",
    "rateTimestamp": 1783936201437,
    "sig": "…maker chain-B signer over the canonical encoding…"
  }
}
```

`cumulativeDelivered` is the running total of asset B delivered in the session, signed by the
same per-chain signer key that signs the chain-B balance proofs
(`swap/src/payment-channel-signer.ts`), so a receipt is checkable against the claim stream.
This is the rfc-0039 role — a transferable, monotonically-growing proof of delivered value —
without the STREAM framing: the audit/dispute artifact today (it makes the §3.1 maker-debt
bound *provable* to a third party, e.g. a future maker board's reputation layer), and the
natural input to an escrow layer later. Receipts are session-scoped via `streamNonce`; the
latest receipt supersedes all earlier ones, mirroring the highest-nonce rule for claims.

---

## 8. Inventory → in-flight window

The rolling model shrinks the maker's required asset-B float from notional (§1.2) to:

```
required_B(chain, asset) = δ_max·W_max · R      (in-flight reservation ceiling)
                         + Σ_channels (cumulativeSigned − lastSettledWatermark)   (unsettled)
```

**What changes, in `inventory.ts` / `channel-state.ts` terms:**

- `MillInventory.debit` (`inventory.ts:75-98`) stops being a permanent per-claim debit against
  a notional pre-fund. It becomes a **reservation** taken when the leg-B claim is signed
  (bounded by the advertised in-flight ceiling, which the maker MUST enforce per session —
  this is what makes the honeypot small by construction rather than by operator discipline)
  and **released back on settlement confirmation**, hooked off the existing
  `SettlementEvent` emission (`swap/src/settlement-event.ts:19-63`). `credit`
  (`inventory.ts:104-130`) stops being rollback-only: settle-and-recycle replaces manual
  refill.
- `MillChannelState.reserve/release` (`channel-state.ts:156-201`) semantics are unchanged —
  nonce+1, cumulative watermark — but the state MUST be persisted. Today everything is
  in-memory and lost on restart (`channel-state.ts:18`), and a crash mid-stream
  desynchronizes the swap node's watermark from claims already handed out. The rolling engine
  hands out claims continuously; **persistence is a prerequisite, not an improvement**
  (§10.2).
- `resolveChannel`'s sticky sender→channel binding (`channel-state.ts:123-150`) is kept, and
  its known capacity bug — the doc comment promises "first channel with sufficient capacity"
  but the code checks only *unbound* (`channel-state.ts:12` vs `:141-149`) — must be fixed,
  since per-session in-flight ceilings are meaningless against a channel that couldn't cover
  them.

The maker's capital exposure per session is symmetric to the sender's (§3.1): at most the
in-flight window of leg-B claims revealed against leg-A claims not yet fulfilled, plus the
unsettled balance already earned. No cross-chain rebalancing loop is required by this spec;
what was a notional-sized pre-fund becomes working capital cycling through settlement.

---

## 9. Settlement — unchanged, with two named dependencies

Packetization is entirely off-chain; the chain sees only the envelope. Nothing in this spec
touches the settlement layer (see `settlement.md`):

- Every claim on both legs is a **cumulative watermark** (monotone nonce, cumulative amount),
  so N micro-swap advances net to **one settlement per chain**: `buildSettlementTx` redeems
  only the highest-nonce claim per `(chain, channelId)` (`build-settlement-tx.ts:371-394`);
  superseded claims are informational. The swap-node E2E already demonstrates the minimum —
  one `closeChannel` with the final nonce/transferredAmount
  (`swap/tests/e2e/docker-swap-flow-evm-e2e.test.ts:341-402`). The client-side leg-A channel
  has the same property (`ChannelManager.signBalanceProof`,
  `toon-client/packages/client/src/channel/ChannelManager.ts:279-338`).
- The **proxy-apex auto-drive** carries redemption: `ClaimReceiver` ingest/verify
  (`connector/src/settlement/claim-receiver.ts:122-231`), threshold-triggered
  `SettlementMonitor` → `SettlementExecutor.claimFromChannel`
  (`settlement-monitor.ts:1-102`, `settlement-executor.ts:184,736`), plus the polling
  `ClaimRedemptionService` (`claim-redemption-service.ts:4-241`).

**Two dependencies this spec names rather than assumes:**

1. **Receive-side ingestion in the client does not exist** (§3.2). The "N advances → one
   settlement" netting is *implemented* only on the paying side today; the receiving side's
   settle path exists only as uncalled SDK library code. The sender cannot realize its
   delivered asset B without it.
2. **Mina co-sign on the B leg.** Redeeming a Mina channel claim requires both `signatureA`
   and `signatureB` (`connector/src/settlement/mina-payment-channel-sdk.ts:1199-1240`). As
   chain-B *recipient*, the sender must contribute a co-signature to redeem — and no
   receive-side Mina co-sign path exists in toon-client (the existing client Mina signer is
   payer-side only, `toon-client/packages/client/src/signing/mina-signer.ts:205-262`). A
   Mina-destination rolling swap is blocked on this; EVM and Solana destinations are not.
   Relatedly, the swap node's Mina signer silently falls back to a **fake sha256 "signature"**
   when the `mina-signer` peer dep is absent (`swap/src/payment-channel-signer.ts:253-263`) —
   R5(a) verification on the sender side catches this before any reveal, which is a good
   sanity check that the coupling is doing its job.

---

## 10. Migration from claim-in-FULFILL

### 10.1 The sdk 0.5.x → 1.x wire drift comes first

The deployed swap node and the deployed client both pin `@toon-protocol/sdk` ^0.5.0
(`swap/packages/swap/package.json:61-63`; `toon-client/packages/client/package.json:73`),
which puts `millSignerAddress`/`millPubkey` on the wire. SDK HEAD (1.0.1) renamed the
vocabulary to `swapSignerAddress`/`swapPubkey` (commit `af4cd24`, toon#48) **with no wire
back-compat and no alias**. The failure mode is nasty because it is silent:
`decodeFulfillMetadata` drops unknown/missing settlement fields without error
(`stream-swap.ts:522-581`), so a one-sided upgrade keeps accumulating claims that only fail
much later, at settlement, with `MISSING_SETTLEMENT_METADATA`
(`build-settlement-tx.ts:97-112`).

**Rule: the fleet MUST cross the rename before or with the rolling rollout** — either both
sides move to 1.x together, or an alias reader (accept both names, emit the new one) ships
first. The rolling engine's new metadata fields (§7) will be authored against 1.x vocabulary
only; do not fork the spec to the old names.

### 10.2 Prerequisites (hazards if skipped)

| # | Prerequisite | Why it blocks | Where |
|---|---|---|---|
| P1 | `expiresAt` plumbing through `wrapSwapPacketToToon`/`buildIlpPrepare` | R7's leg-A/leg-B timeout ordering is inexpressible today — the param is accepted and dropped (`build-ilp-prepare.ts:25` vs `:55-63`) | toon/core |
| P2 | Maker state persistence (channel watermarks, inventory, replay LRU) | continuous claim issuance + volatile watermarks = desync on every restart (`channel-state.ts:18`; replay LRU `swap-handler.ts:194-330`) | swap |
| P3 | Client inbound packet termination + received-claim ingestion | leg B has nowhere to land (§3.2) | toon-client |
| P4 | sdk 1.x wire vocabulary on both sides | silent-drop → late settlement failure (§10.1) | all |
| P5 | Sender-side condition generation end-to-end | today's all-zero condition means R2/R3 exercise code paths (`packet-handler.ts:1512-1519`, `:1554-1594`) that the sender leg has never used | toon-client, connector |

### 10.3 Cutover sequence

1. Land P1–P5. P5 can ship dark: a sender that sets real conditions against a legacy swap node
   still works, because the legacy swap node's FULFILL path injects the NIP-59-derived preimage
   (`packet-handler.ts:1191-1196`) — but note it will F99 if the condition doesn't match that
   derivation, so dark-shipping means *sending* the condition field end-to-end while gating
   enforcement behind the session type.
2. Ship the maker rolling engine behind a protocol tag: RFQ (kind:20033) advertises
   `proto: "rolling/1"`. A maker without it is legacy; `toon_swap` keeps the legacy path until
   the RFQ succeeds.
3. Ship the sender engine (controller, floor, verify-before-reveal, tape/receipt reader).
4. Re-point the #96 swarm-market payout path from single-issued-claim to a rolling session per
   winner (spike story on the epic).
5. Retire `issueClaim`-in-FULFILL: `MultiChainClaimIssuer` remains as the leg-B claim signer
   (the per-chain signers and wallet stay), but the claim-in-FULFILL response shape is
   removed. Until step 5, both wire shapes coexist behind the RFQ tag; there is no in-place
   ambiguity because legacy fills are gift-wrapped kind:20032 and rolling fills are unwrapped
   with a `streamNonce`.

---

## 11. Worked example — 100 USDC on Base → MINA, packet by packet

Setup. Sender swaps **100 USDC (Base, 6 decimals = 100,000,000 units)** into **MINA (9
decimals)**. It has controller state for `(base, makerX, USDC→MINA)` from prior sessions:
`δ = 8 USDC`, `W = 2`, `vEwma = 4 bps/s`, `τEwma = 2.0 s`, `everShrunk = true` (additive
widen only).

**Step 1 — RFQ.** Sender mints `streamNonce = 0x9f…e2`, gift-wraps a kind:20033 to the maker's
kind:10032 pubkey with pair `USDC:base → MINA:mina`, size hint 100 USDC, its Mina
`chainRecipient`. Maker answers (kind:20034): `R₀ = 4.0000 MINA/USDC`, `spread = 40 bps`,
`maxRateAge = 15 s` (the calibrated Mina-class default, §4.1), `maxAmount = 25 USDC`/packet,
quote expiry 60 s.

**Step 2 — Sender arms the guards.**
- Floor: `minExchangeRate = R₀ × (1 − 50 bps) = 3.9800` — fixed for the session, never moves.
- ε: `0.5 × halfSpread = 0.5 × 20 bps = 10 bps = 0.0010`.
- Cap: `delta_cap = ε/(v·τ) = 0.0010 / (0.0004 × 2.0) = 1.25` → the cap exceeds the remaining
  notional (calm regime); the binding limits are the persisted `δ = 8` and the maker's 25.

**Step 3 — The stream.** `W = 2`, so up to two coupled packets in flight. Per packet *i* the
sender mints `P_i`, sends leg A (8 USDC, condition `C_i`, leg-A claim at cumulative
`8i` USDC); the maker prices at fresh `R_i`, sends leg B (`⌊8 × R_i⌋` MINA cumulative claim,
same `C_i`); the sender verifies (R5: signature, recipient, monotone, `R_i ≥ 3.9800`) and
reveals `P_i`; the maker relays `P_i` as the leg-A fulfillment. The tape:

| seq | δ (USDC) | `R_i` | `rateTimestamp` age | leg-B Δ (MINA) | cum A (USDC) | cum B (MINA) | outcome |
|---|---|---|---|---|---|---|---|
| 1 | 8 | 4.0012 | 0.4 s | 32.0096 | 8 | 32.0096 | FULFILL |
| 2 | 8 | 4.0009 | 1.1 s | 32.0072 | 16 | 64.0168 | FULFILL |
| 3–8 | 8 × 6 | 4.0011 … 3.9998 | < 2 s | 192.005 | 64 | 256.022 | FULFILL ×6 |
| 9 | 8 | — | **16.8 s** | — | 64* | 256.022 | **reject `stale_rate`** |
| 10 | 4 | 4.0031 | 0.3 s | 16.0124 | 68 | 272.034 | FULFILL |
| 11–17 | 4 × 7 | ≈ 4.0007 | < 2 s | 112.020 | 96 | 384.054 | FULFILL ×7 |
| 18 | 4 | 4.0004 | 0.8 s | 16.0016 | 100 | 400.056 | FULFILL (final) |

(Row 3–8 and 11–17 are elided ranges; every packet is individually priced and coupled.
Numbers illustrative; leg-B units truncate toward zero per `applyRate`.)

**Step 4 — The staleness reject, in detail (seq 9).** The maker's Mina feed blacks out: its
last tick is 16.8 s old > `maxRateAge = 15 s`. (Routine 12.6 s gaps — ordinary in this
regime per the §4.1 calibration — sail *under* the 15 s bound; at the calibrated default a
Mina-class maker bounces ~1.5% of fills, versus ~4× that at the 10 s bound an earlier
revision of this example used.) The inbound gate rejects **before claim ingestion** (§4), so
the seq-9 leg-A claim never lands — cumulative A stays 64 (marked * above), no maker debt,
`P_9` discarded. The sender receives the benign staleness reject and discriminates on
`data.reason === "stale_rate"` (wire code T00 on today's connector, T99 once the connector's
`REJECT_CODE_MAP` follow-up ships — §4), backs off 15 s, and applies the shrink knob:
`δ ← max(δ_min, 8/2) = 4 USDC`. One knob, one step: `W` stays 2.

**Step 5 — Recovery and completion.** The feed resumes; packets 10–18 fill at δ = 4. After
`K = 16` clean fulfills the controller would widen additively (`δ ← 4 + δ_0`), but the session
ends first. Realized session rate: `400.056 / 100 = 4.00056` — every packet individually
cleared the 3.9800 floor, and the sender verified each leg-B claim *before* revealing its
preimage. Had the maker under-delivered on any packet, the sender's loss ceiling for the whole
session was `δ·W = 16 USDC` at the start, `8 USDC` after the shrink.

**Step 6 — Netting.** 17 fulfilled packets produced 17 claim advances per leg, and exactly
two settlements:
- **Base (leg A):** the apex auto-drive redeems only the highest-nonce leg-A claim —
  `nonce = 17, transferredAmount = 100 USDC` — one `TokenNetwork` transaction. The 16
  superseded claims are informational.
- **Mina (leg B):** one `claimFromChannel` with `cumulativeDelivered = 400.056 MINA`,
  requiring the sender's receive-side co-signature (§9 dependency 2) alongside the apex key.
  The 17 receipts (§7.2), latest superseding, are the sender's portable proof of delivered B
  if the maker disputes.

---

## 12. Explicit non-goals

Carried over from #145's out-of-scope list, so nobody looks for them here:

- **Slashable maker bonds / per-chain escrow** — the option-3 intent+settlement layer that
  would close the §3.1 residual by making claim redemption preimage-gated. Deferred until
  quote sizes justify it; owned by the epic's open-questions track on #145.
- **All-or-nothing swap mode** — exact-invoice swaps where the last packet tips a hold/commit,
  reintroducing atomicity tension. Default here is partial-ok (a good running-rate fill on
  what filled). To be scoped as its own issue off #145.
- **Public maker auction UI** — out of scope for the epic entirely.
- **Maker board (competitive RFQ, option 2)** — deliberately a **fast-follow**, not part of
  this spec: everything here is single-maker-capable but board-shaped (RFQ round trip,
  spread-denominated ε, per-maker controller state, receipts as reputation input,
  pay-to-write Sybil resistance on quote requests). Sequence per #145: land the rolling
  engine sender→known-maker first; the board reuses the capability-market coordination
  pattern.

## 13. Related

- [toon-meta#145](https://github.com/toon-protocol/toon-meta/issues/145) — the rolling-swap epic (this document's owner; decided context and open spikes)
- [swap#48](https://github.com/toon-protocol/swap/issues/48) — `maxRateAge` prototype + calibration; the [calibration writeup](https://github.com/toon-protocol/swap/issues/48#issuecomment-4952509158) is the empirical source for §4.1 · [swap#53](https://github.com/toon-protocol/swap/pull/53) — the prototype + seeded calibration harness (`packages/swap/src/max-rate-age.calibration.test.ts`)
- [toon-meta#96](https://github.com/toon-protocol/toon-meta/issues/96) — swarm-market multi-chain payout path; upgrades from single-issued-claim to rolling coupled packets (step 4 of §10.3)
- [toon-meta#84](https://github.com/toon-protocol/toon-meta/issues/84) / [toon-protocol/capability-market](https://github.com/toon-protocol/capability-market) — sibling coordination design; the maker board reuses its NIP-34/pay-to-write pattern
- [Interledger rfc-0029](https://interledger.org/rfcs/0029-stream/) (STREAM) — the packetized-payment risk model this design instantiates; [rfc-0039](https://interledger.org/rfcs/0039-stream-receipts/) (STREAM receipts) — the role §7.2's receipts play. Neither has an existing implementation in this stack (§7).
- [`docs/settlement.md`](./settlement.md) — payment channels, multi-chain claim shapes, proxy-apex auto-drive (§9 builds on it unchanged)
- [`docs/protocol.md`](./protocol.md) — NIP-59 gift-wrap mechanics and the `SWAP_MNEMONIC` recipient footgun (§2.2 keeps gift wrap on the RFQ only)
