# Micro Perps on TOON — is a fractional-perp share market practical, and is there a business model?

**Status:** Research note · **Date:** 2026-08-21 · **Audience:** owner, protocol design

The proposal under evaluation:

> A smart contract owns a **single** long or short perpetual-futures position on a real venue
> (Solana, or an EVM chain like Base). **Shares in that position** are then bought and sold
> **off-chain as ILP packets / payment-channel claims** on TOON's rails, so participants can take
> and exit micro-exposure without touching the venue or paying gas per trade. Entry/exit of the
> underlying happens on-chain; the share trading happens in packets.

Everything below is cited to a primary source: an official venue doc/spec, contract source, or a
`file:line` in this org's repos. Where a source does not state something, this note says "docs do
not state" rather than inferring. A short **[What I could not verify](#what-i-could-not-verify)**
section at the end lists every gap.

---

## 0. Verdict up front

**Not practical as proposed; a narrower version is.**

The share layer is the problem, not the venue leg. A contract *can* own a real perp position — on
Hyperliquid this is explicit and supported (§2). But a TOON payment-channel claim transfers value,
not rights: it is a cumulative watermark over one channel between one pair, with no field for a
share, no expiry and no condition (§3.1). The hashlock that does work is packet-level and shipped
(proven live 2026-08-16), but it gates the *packet*, not the on-chain redeemability of a claim —
`TokenNetwork.sol` carries `lockedAmount` / `locksRoot` fields explicitly marked *"unused"*, and the
ticket to wire them is open, `needs:human`, and blocked behind an unmerged PR (§3.2). So a "share"
can only be an operator database row, which makes every holder an unsecured creditor of a custodian
running on a rail that has **no mainnet settlement** and whose **unilateral-exit path has never been
observed working on any chain** (§4).

The business case is weaker still for an unexpected reason: **both candidate chains already ship this
product.** Hyperliquid's docs recommend a tokenized ERC-4626 vault trading via CoreWriter as the way
to fractionalize a position, and Drift's own team ships `drift-vaults`, which makes a PDA the
position authority and holds depositor shares on-chain (§5.1). Both give holders enforceable,
redeemable, trustlessly-priced shares. That is strictly better than an off-chain IOU.

Two premise corrections: **"perps venues impose a minimum order size" is not universally true** —
dYdX v4, Drift and Synthetix V3 impose none, and the floors that do bind are fixed *per-order* costs
that pooling genuinely does destroy (§1.3). And **Base is the wrong chain**: GMX V2 is not deployed
there and Synthetix V3's Base deployment was deprecated with positions force-closed in July 2025.
Of every venue surveyed, only **Drift/Velocity on Solana** lets a contract close its own position
synchronously with no keeper (§2.1).

What survives is real but smaller. TOON clears a payment for **1 µUSDC — one millionth of a dollar,
verified live, sustained at 49 fps** (§4.1). Nothing else does that. The practical product is
therefore **TOON as the quote tape and netting layer for shares that live on-chain** (§7A), or
**micro *swaps* rather than micro *perps*** — already proven end to end and needing no new
primitive (§7B). Full reasoning in §7.

---

## 1. The floor, quantified

### 1.1 Protocol-declared minimums

**Hyperliquid — $10 minimum order value.** Stated in the API error table
([`/for-developers/api/error-responses`](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/error-responses)):

> `| Order | MinTradeNtl | Order must have minimum value of $10. |`
> `| Order | MinTradeSpotNtl | Order must have minimum value of 10 {quote_token}. |`

The same string appears as a live rejection example on
[`/for-developers/api/exchange-endpoint`](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint):
`"error":"Order must have minimum value of $10."`. Size is additionally quantized to the asset's
`szDecimals` ([`/for-developers/api/tick-and-lot-size`](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/tick-and-lot-size)):
*"Sizes are rounded to the `szDecimals` of that asset. For example, if `szDecimals = 3` then `1.001`
is a valid size but `1.0001` is not."* TWAP orders carry a separate, higher floor — *"a $100 minimum
total order size"* ([`/trading/order-types`](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/order-types)).

**Drift (now Velocity) — no published minimum; it is a per-market on-chain field.** `docs.drift.trade`
now 307-redirects to `docs.velocity.exchange`, and `github.com/drift-labs/protocol-v2` redirects to
`velocity-exchange/protocol-v2`; the program id is unchanged
(`declare_id!("dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH")`, `programs/drift/src/lib.rs:65`). The
minimum lives in the market account, not in a constant
(`programs/drift/src/state/perp_market.rs`, struct `AMM`, L1252-1260):

```rust
/// the base step size (increment) of orders
pub order_step_size: u64,
/// the price tick size of orders
pub order_tick_size: u64,
/// the minimum base size of an order
pub min_order_size: u64,
```

Enforcement is at `programs/drift/src/validation/order.rs:338-365`, and the first clause is
load-bearing for this design:

```rust
validate!(
    reduce_only_or_jit_maker || order.base_asset_amount >= min_order_size,
    ErrorCode::InvalidOrderMinOrderSize,
```

**Reduce-only orders are exempt from `min_order_size`** (though not from step-size alignment) — so a
sub-minimum position can always be closed. That is the carve-out Hyperliquid's docs do not state, and
it is materially better for a fractional design. There is **no global `MIN_ORDER_SIZE` constant**;
at market creation `instructions/admin.rs:335` sets `min_order_size: order_step_size`, both admin
parameters. The docs decline to publish per-market values:
`docs.velocity.exchange/trading/market-specs` says only that *"order sizes must be a multiple of the
step size and prices a multiple of the tick size"* and that *"the authoritative value for a given
market is shown in-app and on-chain."* **So the real minimum for SOL-PERP or BTC-PERP is not
knowable from documentation — it must be read from the on-chain `PerpMarket` account.**

Minimum deposit is only a zero-check (`instructions/user.rs:697`,
`if amount == 0 { return Err(ErrorCode::InsufficientDeposit.into()); }`); there is no
`MIN_COLLATERAL` constant. The nearest thing to a dust tax is
`OPEN_ORDER_MARGIN_REQUIREMENT = QUOTE_PRECISION / 100` — **$0.01 of margin per resting order**.

**Jupiter Perps — $10 minimum collateral.** Jupiter's own CLI repo documents it
(`raw.githubusercontent.com/jup-ag/cli/main/docs/perps.md`): *"Minimum collateral is $10 for new
positions."* Leverage runs *"1.1x – 250x"*. A **minimum position size is not stated** in
`docs.jup.ag/user-docs/trade/perps.md` or its fees page.

**Zeta is not a deployable venue.** `docs.zeta.markets` states: *"Zeta Markets has ceased operating
as of May 2025."* (Historical specs, for reference only: minimum lot sizes *"SOL 0.1, BTC 0.001,
ETH 0.01"*, max leverage 20x.)

#### The Base premise does not survive contact with the docs

The proposal names "an EVM chain like Base". Two of the three obvious Base venues are not available:

**GMX V2 is not deployed on Base.** [docs.gmx.io/docs/trading/overview](https://docs.gmx.io/docs/trading/overview/):

> Other chains (Ethereum, Base, BNB) | ❌ No GMX markets | ✅ Arbitrum markets
> The GMX Account lets you trade on GMX from chains that don't have GMX markets deployed, such as
> Ethereum, Base, or BNB… **Arbitrum is the only supported settlement chain** — all trades through
> the GMX Account execute on Arbitrum markets.

Source agrees: `config/chains.ts` has
`export const EXISTING_MAINNET_DEPLOYMENTS = ["arbitrum", "avalanche", "botanix"];`, with Base
appearing only as a LayerZero *source* chain (`srcChainIds: { 8453: true }`).

**Synthetix V3 on Base is deprecated and its positions were force-closed.**
[docs.synthetix.io/legacy-migration/base-positions](https://docs.synthetix.io/legacy-migration/base-positions):

> If you previously held a position on **Base** through **Synthetix V3**, please note that
> **support for Base has been deprecated**. … Positions on Base were **closed as part of the
> deprecation process**.

And [docs.synthetix.io/deposits-withdrawals/slp-vault](https://docs.synthetix.io/deposits-withdrawals/slp-vault):
*"Base | Deprecated July 7, 2025. Collateral is being returned to wallets within 2 weeks of
deprecation."*

**Perennial V2 is on Base** (`packages/deploy/deployments/base/.chainId` → `8453`, `MarketFactory` at
`0xE04290314A35f5c29D0b0f7dA0C1499a0ecC44F7`), but **`docs.perennial.finance` no longer resolves**
(NXDOMAIN), so every Perennial figure below is from contract source or in-repo deploy config, not
from documentation.

#### EVM minimums

| Venue | Minimum | Source |
|---|---|---|
| **Perennial V2** | `minMargin`, deploy default **`parseUnits('10', 6)`** = 10 USD. **No minimum position size.** Natspec: *"The minimum fixed amount that is required to open a position"* | `packages/core` RiskParameter; deploy config |
| **GMX V2** | `MIN_COLLATERAL_USD` is a **liquidation floor, not a create-order gate** — `if (info.remainingCollateralUsd < info.minCollateralUsd) { return (true, "min collateral", info); }` (`PositionUtils.sol`). Capped at 10 USD by `ConfigUtils.sol`; deploy config `decimalToFloat(1)`. Separately `MIN_POSITION_SIZE_USD` exists, enforced **on increase only**, deploy config `decimalToFloat(1)` — **the docs do not state it at all** | source only |
| **Synthetix V3** | `minimumPositionMargin` — *"minimum position value in USD, this is a constant value added to position margin requirements"*, applied as `initialMargin = notional.mulDecimal(initialMarginRatio) + self.minimumPositionMargin`. **No minimum order size exists** — grep for `minimumOrderSize`/`minOrderSize`/`minTradeSize` returns zero hits; only `error ZeroSizeOrder()` | source only (Base deprecated) |
| **dYdX v4** | **No minimum notional and no absolute minimum size** — only a step lattice. `minOrderBaseQuantums` was *removed* (migration `20230905160352_remove_min_order_base_quantums.ts`); `clob_pair.go` now returns `GetClobPairMinOrderBaseQuantums()` = `StepBaseQuantums`. Enforcement: `if order.Quantums%clobPair.StepBaseQuantums != 0`. Live BTC-USD: `stepSize: "0.0001"` | source + live indexer |
| **Aevo** | `GET /markets` returns `min_order_value`. Live ETH-PERP: `"price_step":"0.01","amount_step":"0.01","min_order_value":"10","max_leverage":"20"` | API reference |

**A useful pattern: several venues have no nominal minimum at all.** dYdX v4 and Synthetix V3 impose
only a step lattice and a margin constant. So "perps venues impose a minimum order size" is **not
universally true** — it is true of Hyperliquid ($10), Jupiter ($10 collateral) and Aevo ($10), and
false of dYdX v4, Drift and Synthetix V3, where the floor is purely economic.

#### The EVM cost that actually sets the floor: the fixed per-order keeper fee

This is the finding that matters most for §1.2's thesis, and it is only visible in source.

**GMX V2's execution fee is size-independent.** The two-step model is documented
([docs.gmx.io/docs/api/contracts/architecture](https://docs.gmx.io/docs/api/contracts/architecture/)):
*"Phase 1 — Request: The user submits a transaction… Phase 2 — Execution: A keeper observes the
request, fetches signed oracle prices… and submits an execution transaction."* The fee is
*"`tx.gasprice * GasUtils.adjustGasLimitForEstimate(dataStore, estimatedGasLimit, oraclePriceCount)`"*
([docs.gmx.io/docs/api/contracts/fees](https://docs.gmx.io/docs/api/contracts/fees/)), with excess
refunded. **`estimateExecuteIncreaseOrderGasLimit` takes only `swapPath.length` and
`callbackGasLimit` — `sizeDeltaUsd` never enters it.** Deploy config sets
`increaseOrderGasLimit: 3_900_000, decreaseOrderGasLimit: 3_900_000` (Arbitrum overrides to 3M/3M).
An absolute ETH cost against a ~3–3.9M gas limit, paid per open *and* per close, regardless of
whether the position is $1 or $1M. **That, not any declared minimum, is GMX's real floor.**

**Perennial V2's settlement fee is likewise fixed.** Natspec calls it *"The **fixed** settlement fee
of the request"* (contrasted with *"relative… percentage"* for `oracleFee`); it is
`syncFee + asyncFee * callbacks`; and `_accumulateSettlementFee` divides by **order count, never
notional**. Capped by `maxSettlementFee`, deploy value `parseUnits('2', 6)` = 2 USD. Keeper sizing
in deploy config, with the authors' own comments: commit ≈ `788_000n // Compute Gas` +
`35_200n // Calldata Gas` at `parseEther('1.05') // Compute Multiplier`; settle ≈ `316_000n` +
`6_000n`.

**Synthetix V3's settlement reward is not purely fixed** — it is
`KeeperCosts.load().getSettlementKeeperCosts() + strategy.settlementReward`, i.e. a per-strategy
sUSD constant **plus** a live gas-oracle-derived component. (`minKeeperRewardUsd`/`maxKeeperRewardUsd`
cap *liquidations*, not settlement.)

**dYdX v4 is the outlier: order placement is genuinely gasless.** A `FreeInfiniteGasDecorator` sits
in the ante handler with the source comment *"there is no gas fee charged for CLOB transactions"*;
docs confirm *"Subaccounts do not require gas (no gas is used for trading)"*. No keeper, no absolute
per-order fee — all cost is bps of notional (taker 5.0 bps → 2.5 bps by tier). **Aevo is similar at
the order level** (*"Creating an order"* and *"Cancelling an order"* are listed under *"What does not
incur gas fees"*; *"Settling trades - fees are borne by the exchange"*) but charges **25 USDC to
withdraw** to Ethereum — the boundary cost again.

**Oracle costs are currently near zero, but for unstable reasons.**
[docs.pyth.network/price-feeds/core/current-fees](https://docs.pyth.network/price-feeds/core/current-fees):

> Following OP-PIP-128, the Pyth Core update fee is being set to **0** across all mainnet EVM chains
> as part of the Pyth Core sunset. Passing `0` as `msg.value` to `updatePriceFeeds` is sufficient on
> every network listed below… | Base | 0 **ETH** |

The same page warns of a *"Pyth Core upgrade August 26, 2026… Every Core user will need an API Key."*
So the zero is a sunset artifact, not a stable property — the historical default was
*"1 of the smallest denomination of the blockchain's native token (e.g., 1 wei on Ethereum)"*.
Chainlink Data Streams (GMX V2's oracle) has likewise moved off per-call billing:
*"The pay-per-verification billing model has been deprecated"*
([docs.chain.link/data-streams/billing](https://docs.chain.link/data-streams/billing)), and *"Your
contract does not need to quote or approve a per-verification fee before calling `verify()`"*.
**Neither zero should be modelled as permanent.**

#### EVM position fees

GMX V2 ([docs.gmx.io/docs/trading/fees](https://docs.gmx.io/docs/trading/fees/)): *"The position fee
is 0.04% or 0.06% of the position size"* — 0.04% if the trade reduces the long/short imbalance,
0.06% if it increases it. dYdX v4: taker 5.0 bps → 2.5 bps by tier. Aevo: taker 0.08% / maker 0.05%.

### 1.2 The floors that bite harder than the declared minimum

This is the part the proposal's premise gets wrong. The nominal order minimum is rarely what makes
micro-exposure uneconomic; the **fixed, non-proportional costs** are, because they do not shrink
with position size.

**Hyperliquid's fixed costs:**

| Cost | Amount | When | Source |
|---|---|---|---|
| Account activation | **1 quote token (e.g. 1 USDC)** — *"New HyperCore accounts require 1 quote token … of fees for the first transaction which has the new account as destination address."* Also: *"Unactivated accounts cannot send CoreWriter actions."* | once per account | [`/for-developers/api/activation-gas-fee`](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/activation-gas-fee) |
| Withdrawal | **$1** — *"There is a $1 fee for withdrawing at the time of this writing and withdrawals take approximately 5 minutes to finalize."* | per withdrawal | [`/for-developers/api/exchange-endpoint`](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint) |
| Bridge deposit minimum | **5 USDC** — *"The minimum deposit amount is 5 USDC. If you send an amount less than this, it will not be credited and be lost forever."* | per deposit | [`/for-developers/api/usdc`](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/usdc) |
| CoreWriter gas | *"It burns ~25,000 gas before emitting a log … In practice the gas usage for a basic call will be ~47000."* | per action from a contract | [`/for-developers/hyperevm/interacting-with-hypercore`](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/hyperevm/interacting-with-hypercore) |
| Legacy vault creation | **10,000 USDC gas fee** — *"Creating a vault requires a 10k USDC gas fee"* | once, legacy HyperCore vaults only | [`/hypercore/vaults/for-vault-leaders-legacy`](https://hyperliquid.gitbook.io/hyperliquid-docs/hypercore/vaults/for-vault-leaders-legacy) |

Trading fees themselves are **purely proportional** — tier 0 is *0.045% taker / 0.015% maker*, best
tier *0.024% / 0.000%* ([`/trading/fees`](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/fees))
— and no per-order or per-fill flat fee is documented anywhere. So on the *trading* leg Hyperliquid
is genuinely friendly to small size. It is the **boundary** (activate, deposit, withdraw) that is
fixed-cost.

**Solana's fixed costs — rent is the one nobody advertises, and it cuts *for* the proposal.**
Solana's rent-exemption formula is `(account_size + 128) * 3,480 lamports/byte-year * 2 years`
([solana.com/docs/core/accounts](https://solana.com/docs/core/accounts)). Drift's `User::SIZE = 4376`
(`state/user.rs:65`) and `UserStats::SIZE = 240` (`:2025`). The arithmetic below is **derived, not
quoted**:

| Account | Rent-exempt deposit |
|---|---|
| Drift `User` (4376 B) | 31,347,840 lamports = **0.03135 SOL** |
| Drift `UserStats` (240 B) | 2,561,280 lamports = **0.00256 SOL** |
| **Drift first-time total** | **≈0.0339 SOL** |
| SPL token account (165 B) | **0.00204 SOL** |

Plus a base transaction fee of *"5,000 lamports per signature"*
([solana.com/docs/core/fees](https://solana.com/docs/core/fees)), and priority fees computed as
`ceil(compute_unit_price * compute_unit_limit / 1,000,000)` lamports. Jupiter states only that
*"A small SOL amount is used as rent to create an escrow account (PDA) when opening a position.
This rent is returned when the position is closed"* — amount not stated.

**Note carefully who pays this.** ~0.034 SOL locked per Drift participant would be brutal if every
shareholder needed their own account — but in the proposal **only the contract is a participant**.
One `User` account amortizes across every shareholder. This is the single strongest argument *for*
the pooled-position architecture, and it is a genuine one: the per-participant account cost on
Solana is exactly the kind of fixed floor that pooling is good at destroying.

**Fee schedules (proportional, no flat per-order fee on either Solana venue):**

| Venue | Taker | Maker | Source |
|---|---|---|---|
| Drift/Velocity tier 0 (<$2M 30d) | 0.035% | −0.0025% rebate | `docs.velocity.exchange/trading/trading-fees` |
| Drift/Velocity tier 5 (≥$200M) | 0.020% | −0.0025% rebate ("flat across every tier") | same |
| Jupiter Perps | **0.06% flat on trade size, opening *or* closing** | — | `docs.jup.ag/user-docs/trade/perps/fees.md` |

⚠️ **Drift's source-level defaults contradict its live docs**: `state/state.rs:265` `perps_default()`
sets tier 0 to 10 bps taker / 2 bps rebate, against the docs' 3.5 bps / 0.25 bps. The `Default` impls
are not the deployed schedule — `State.fee_structure` on-chain is the only authority. Same caveat for
liquidation: `liquidator_fee` / `if_liquidation_fee` are per-market `u32` values, **default 0 in
source, and no figure is published in the docs**.

**Liquidation severity differs sharply.** Jupiter is total: *"all remaining collateral is collected
by the protocol and distributed to the JLP"* (`.../perps/fees.md`). Drift ramps a liquidator fee
(`MAX_LIQUIDATION_MULTIPLIER = 3`, `LIQUIDATION_FEE_INCREASE_PER_SLOT` = *".01 bps per slot"*), with
live values on-chain only. For a pooled share design, Jupiter's rule means a liquidation zeroes
every shareholder simultaneously.

**Drift funding: the docs do not state the formula or the cap.** `funding_period` is a per-market
`i64` in seconds (`perp_market.rs:1250`, with `ONE_HOUR = 3600`), and the Velocity funding-rates
docs page reads *"Coming soon."* Jupiter charges *"Borrow fees compound hourly and are deducted from
the position's collateral."*

**Funding accrual granularity.** Funding is hourly and discrete, not continuous
([`/trading/funding`](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/funding)):

> The funding rate on Hyperliquid is paid every hour. The funding rate is added or subtracted from
> the balance of contract holders at the funding interval.
> … funding is paid every hour at one eighth of the computed rate for each hour.
> Note that the funding payment at the end of the interval is `position_size * oracle_price *
> funding_rate`. In particular, the spot oracle price is used to convert the position size to
> notional value, *not the mark price.*

Funding is *"purely peer-to-peer and no fees are collected on the payments"* and is capped at
*"4%/hour"*. The interest component is *"0.01% every 8 hours, which is 0.00125% every hour"*. **The
docs state no rounding or minimum increment on the funding payment** — see "what I could not
verify" — which is a live question for a micro-share whose hourly pro-rata funding could be
sub-µUSDC.

**Liquidation buffer.** Maintenance margin is *"half of the initial margin at max leverage"*, which
*"varies from 3-40x. In other words, the maintenance margin is between 1.25% (for 40x max leverage
assets) and 16.7% (for 3x max leverage assets)"*
([`/trading/liquidations`](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/liquidations)).
There is no clearance fee — *"Unlike CEXs there is no clearance fee on liquidations"* — but the
backstop path forfeits margin: *"If the account equity drops below 2/3 of the maintenance margin
without successful liquidation through the book, a backstop liquidation happens through the
liquidator vault"* and *"During backstop liquidation, the maintenance margin is not returned to the
user."* Positions over 100k USDC are only partially liquidated (20% per pass, with a *"cooldown
period of 30 seconds"*).

### 1.3 The real economic floor vs. the protocol-declared minimum

Pulling the venues together:

| Venue | Declared minimum | The floor that actually binds |
|---|---|---|
| Hyperliquid | **$10** order notional | **$1 withdrawal + 5 USDC deposit min + 1 USDC activation** — boundary costs |
| Drift/Velocity | per-market `min_order_size`, **not published**; reduce-only exempt | **≈0.0339 SOL rent per participant account** + $0.01 margin per resting order |
| Jupiter Perps | **$10** collateral | 0.06% flat open *and* close + keeper dependency |
| GMX V2 | none as a gate (`MIN_POSITION_SIZE_USD` deploy default 1 USD, undocumented) | **fixed ETH execution fee against a ~3–3.9M gas limit, per open and per close** |
| Perennial V2 | `minMargin` 10 USD | **fixed settlement fee, capped 2 USD, charged per order — including invalidated ones** |
| Synthetix V3 | none; `minimumPositionMargin` constant | `settlementReward` + live gas cost, per commit/settle cycle |
| dYdX v4 | **none** — step lattice only | genuinely just bps of notional (gasless) |
| Aevo | **$10** `min_order_value` | **25 USDC** to withdraw to Ethereum |

**Three conclusions the proposal's premise gets wrong or half-right.**

1. **"Perps venues impose a minimum order size" is not universally true.** dYdX v4, Drift and
   Synthetix V3 impose no minimum notional at all. The premise holds for Hyperliquid, Jupiter and
   Aevo and fails for the rest.
2. **Where a floor exists, it is almost never the declared minimum.** It is a *fixed, absolute,
   size-independent* cost — a keeper execution fee, a settlement fee, an account rent deposit, a
   withdrawal fee. GMX's is the clearest case: `sizeDeltaUsd` never enters the gas estimate, so a $1
   position pays the same execution fee as a $1M one. **This is the correct target for a
   fractionalization design, and it is exactly the cost that pooling destroys** — one contract pays
   the fixed fee once and amortizes it across all shareholders. That is a genuine, defensible
   rationale for the architecture.
3. **But pooling does not touch the *participant's* boundary cost.** A shareholder who ultimately
   wants their money outside the system still pays a withdrawal fee ($1 Hyperliquid, 25 USDC Aevo)
   and still faces a deposit minimum (5 USDC Hyperliquid). At a 10% cost tolerance that puts the
   **minimum sensible participation back at roughly $10–50** — the same order of magnitude the
   proposal set out to defeat. The floor did not disappear; it moved from the venue's order book to
   the system's edge.

The escape from (3) is a participant who *never crosses the boundary* — who keeps value inside TOON
and spends it inside TOON. That is the agent case, and it is the only case where this design's
economics genuinely clear. §5.4 asks whether that customer actually exists.

## 2. Can a contract hold the position?

**Hyperliquid: yes, explicitly and by design.** The mechanism is the `CoreWriter` system contract
([`/for-developers/hyperevm/interacting-with-hypercore`](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/hyperevm/interacting-with-hypercore)):

> A system contract is available at `0x3333333333333333333333333333333333333333` for sending
> transactions from the HyperEVM to HyperCore.

And the contract acts as **its own HyperCore account**, not as a signer for someone else's:

> Below is an example contract that would send an action on behalf of its own contract address on
> HyperCore…

Action ID `1` is a limit order, ABI-encoded as `(uint32 asset, bool isBuy, uint64 limitPx, uint64 sz,
bool reduceOnly, uint8 encodedTif, uint128 cloid)`, with `limitPx` and `sz` sent as `10^8 ×` the
human-readable value. The contract can also read its own state trustlessly via read precompiles from
`0x…0800`, covering *"perps positions, spot balances, vault equity, staking delegations, oracle
prices, and the L1 block number"*, whose values are *"guaranteed to match the latest HyperCore state
at the time the EVM block is constructed"*, at a gas cost of `2000 + 65 * (input_len + output_len)`.
Hyperliquid's own vision statement makes the intent explicit
([`/hyperevm`](https://hyperliquid.gitbook.io/hyperliquid-docs/hyperevm)): *"The lending smart
contract can send orders directly swapping XYZ and ABC on the HyperCore order books using a write
system contract."*

**Three constraints that matter for this design:**

1. **Actions are asynchronous and deliberately delayed.** *"To prevent any potential latency
   advantages for using HyperEVM to bypass the L1 mempool, order actions and vault transfers sent
   from CoreWriter are delayed onchain for a few seconds."* CoreWriter emits a log; there is **no
   return value and no synchronous success/failure** to the calling contract. A contract cannot
   know within its own transaction whether its close order filled — which is precisely the
   "can it reliably close under stress" question, and the answer is "not synchronously."
2. **The account must be activated before the EVM block is built.**
   ([`/for-developers/hyperevm/interaction-timings`](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/hyperevm/interaction-timings)):
   *"the account performing the CoreWriter action must exist on HyperCore before the EVM block is
   built. An EVM → Core transfer to initialize the account in the same block will still result in
   the CoreWriter action being rejected."* Ordering within a block is: L1 block built → EVM block
   built → EVM→Core transfers → CoreWriter actions.
3. **Sub-accounts are gated on volume, so they are not a fractionalization primitive.**
   ([`/trading/sub-accounts`](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/sub-accounts)):
   *"Up to 10 sub-accounts can be created after reaching $100,000 in volume."* A new operator has
   none.

**And the decisive one: Hyperliquid recommends a tokenized vault contract for exactly this use
case** — see §5.1, because it is a business-model fact more than a technical one.

**Drift (Velocity): yes — and this is the cleanest answer of any venue surveyed.** The authority
check is a bare pubkey comparison with no `executable` check and no owner constraint
(`programs/drift/src/instructions/constraints.rs:17`):

```rust
pub fn can_sign_for_user(user: &AccountLoader<User>, signer: &Signer) -> anchor_lang::Result<bool> {
    user.load().map(|user| {
        user.authority.eq(signer.key)
            || (user.delegate.eq(signer.key) && !user.delegate.eq(&Pubkey::default()))
    })
}
```

`PlaceOrder` requires `authority: Signer<'info>` (`instructions/user.rs:4864-4873`), and a PDA
satisfies `is_signer` via `invoke_signed`. The program ships the Anchor CPI surface
(`Cargo.toml`: `cpi = ["no-entrypoint"]`). **This is not theoretical — Drift's own first-party vault
program does exactly it** (`drift-labs/drift-vaults`, `initialize_vault.rs:123-140`):

```rust
let cpi_accounts = InitializeUser {
    ...
    authority: self.accounts.vault.to_account_info().clone(),
};
let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signers);
drift::cpi::initialize_user(cpi_ctx, sub_account_id, name)?;
```

The vault PDA *is* the Drift `User.authority`. Two nuances: a **delegate is not a substitute for the
authority** — `state/user.rs:74` describes it as *"An addresses that can control the account on the
authority's behalf. Has limited power, cant withdraw"*, and `Withdraw` uses `has_one = authority` —
and `InitializeUser` takes `authority` as a plain `AccountInfo` so a `User` can be created for a PDA
without that PDA signing.

**Critically, Drift needs no keeper to close.** `place_and_take_perp_order`
(`instructions/user.rs:2740`, context at `:4973`) has **no filler account at all** — the user places
and fills atomically in one instruction. `FillOrder` (`instructions/keeper.rs:3768`) is separately
permissionless. **So a program can open and close a position in a single CPI, synchronously, with a
deterministic success/failure return.** That is strictly better than Hyperliquid's asynchronous,
few-seconds-delayed, no-return-value CoreWriter path (§2 above) for the one operation that matters
most: closing under stress.

**Jupiter Perps: effectively no.** *"Every trade on Jupiter Perps requires two onchain
transactions"* — the trader submits a `PositionRequest` PDA, then *"a keeper (an automated offchain
service run by Jupiter) detects the request, validates it, and executes the trade"*
(`docs.jup.ag/user-docs/trade/perps.md`). A program can submit the request leg, but **execution is
asynchronous and performed by Jupiter's keepers in both directions, including closing.** What
happens when a keeper cannot fulfil — slippage, expiry, refund — **the docs do not state.** For a
design whose entire risk hinges on being able to close, an undocumented keeper-failure path is
disqualifying.

**Zeta: shut down** (May 2025), so its documented CPI interface is moot.

**GMX V2: yes, unrestricted — and callbacks exist specifically for contracts.**
`ExchangeRouter.createOrder` does `address account = msg.sender;` and the only validation is
`AccountUtils.validateAccount(account)`, a non-zero check. An `isContract()` helper exists in the
codebase but is **never applied to `account`**; a repo-wide grep for `tx.origin` returns 5 hits, all
in simulation/estimateGas plumbing, with no EOA gate. `CallbackUtils.sol` states the intent:
*"to allow for better composability with other contracts, a callback contract can be specified to be
called after request executions or cancellations"*, exposing `afterOrderExecution` /
`afterOrderCancellation` / `afterOrderFrozen`, plus `IGasFeeCallbackReceiver.refundExecutionFee` so a
contract can receive the execution-fee refund. One caveat: smart wallets are blocked from Express /
One-Click Trading, but that is a **front-end** restriction, not a `createOrder` restriction.

**Synthetix V3: yes, but the contract MUST implement `onERC721Received`.** Positions are held by an
account NFT: `createAccount` uses `accountTokenModule.safeMint(...)`, and `_checkOnERC721Received`
reverts `InvalidTransferRecipient(to)` for a contract that does not return the magic selector. There
is no EOA restriction otherwise (grep for `tx.origin` / `isContract(msg.sender)` returns zero hits),
and the RBAC permissions (`PERPS_COMMIT_ASYNC_ORDER`, `PERPS_MODIFY_COLLATERAL`) take a plain
`address` with only a zero-address guard. Moot on Base, given the deprecation.

**Perennial V2: yes, proven in-repo.** `market.update(address(this), ...)` is exactly what
`Vault.sol` does, and a Vault is deployed on Base. `MarketFactory` carries `operators`, `signers` and
protocol-wide `extensions`, and `Verifier` uses OpenZeppelin's `SignatureChecker.isValidSignatureNow`
— so a contract can be the *signer* as well as the owner. No `tx.origin` / `extcodesize` /
`isContract` anywhere in the account path. Note that Collateral Accounts are **not** the route:
`Account.sol` calls `market.update(owner, ...)`, so it holds collateral *for* the owner rather than
owning the position itself.

**dYdX v4: no.** The owner is a Cosmos `AddressString` plus a subaccount number. There is no CosmWasm
and no EVM — a code search for `wasmd` in `v4-chain` returns zero results — and the docs state
*"Only the main account can send transactions on behalf of a subaccount"*. The closest primitive is
Permissioned Keys, which is signing delegation, not contract ownership. **So the venue with the best
micro-order economics (gasless, no minimum notional) is the one venue where a contract cannot own
the position.** That is an unfortunate and consequential pairing for this design.

**Aevo: docs do not state.** Registration is `eth_sign` by the account key delegating to a randomly
generated EOA `signing_key` that EIP-712-signs orders; ERC-1271 is not mentioned anywhere in the API
reference.

### 2.1 Oracle and keeper failure — can the position get stuck open?

This is the risk that decides whether the contract can be trusted with pooled collateral, and Drift's
source answers it better than any doc does.

Drift's staleness guards default to `slots_before_stale_for_amm: 10` (~5s),
`slots_before_stale_for_margin: 120` (~60s), `confidence_interval_max_size: 20_000` (2% of price),
`too_volatile_ratio: 5` (`state/state.rs:171-183`; live values are admin-set on-chain).
**Closing is explicitly privileged over opening** (`controller/orders.rs:2096`):

```rust
if oracle_stale_for_margin {
    validate!(
        user_order_position_decreasing || !maker_risk_increasing,
        ErrorCode::InvalidOracle,
        "taker or maker must be reducing position if oracle stale for margin"
    )?;
```

And `is_oracle_valid_for_action` (`math/oracle.rs:147`) is graduated: `FillOrderAmmImmediate` demands
a fully `Valid` oracle, but `FillOrderMatch` only rejects `NonPositive | TooVolatile | TooUncertain`.
So a stale oracle kills AMM fills while maker-matched fills still work.

**The residual stuck-open risk is real and undocumented.** In the `NonPositive` / `TooVolatile` /
`TooUncertain` regime there is **no fill path at all** — the contract cannot close. Velocity's docs
do not address this case, and neither does any Jupiter page address keeper downtime. For a pooled
position this is the scenario where shareholders discover their exposure is unhedgeable at exactly
the moment it matters. It is not a reason not to build, but it must be priced, and it cannot be
priced from documentation.

**Perennial V2 has the same hole, and it is explicit in source.** A stale oracle means a holder
**cannot close**: `revert IMarket.MarketStalePriceError()` permits only collateral deposits or
no-position actions. Liquidations are exempt (`if (newOrder.protected()) return;`) — so the protocol
can close your position against you while you cannot close it yourself. Two further source-only
findings worth carrying: after `timeout` (deploy default 30s) anyone can commit with empty data and
the version finalises **invalid**, carrying the last price forward, and **a pending order on an
invalid version is erased** (`invalidate()` zeroes the position delta) — the order silently does not
happen. Meanwhile **the settlement fee is still charged on an invalidated order**:
`_accumulateSettlementFee` has no `valid` check, unlike `_accumulateLiquidationFee` immediately below
it, which does. And there is **no market-level order cancellation at all** — grep of
`Market.sol`/`IMarket.sol` for `cancel` returns zero hits; cancellation exists only for trigger
orders and signed-message nonces.

**GMX V2's failure mode is fee attrition rather than permanent lock.** Market orders that fail are
**cancelled**; limit/trigger orders are **frozen** — *"If an order cannot be fulfilled at execution
time… the order is frozen rather than cancelled. This prevents gaming where a user could create a
limit order with size greater than available pool liquidity, wait for the trigger price to be hit,
then deposit into the pool…"*. Critically, `freezeOrder` calls `order.setExecutionFee(0)`: the frozen
order's fee is paid to the freezing keeper and must be **topped up via `updateOrder`** to retry.
Market orders cannot be cancelled for `REQUEST_EXPIRATION_TIME` (300s in config; the docs say only
*"a configured delay"*). Oracle and keeper errors always revert rather than cancel
(`validateNonKeeperError`). The docs concede: *"During downtime of the blockchain or oracle, orders
may be executed at significantly different prices or may not execute."* No permanent stuck-position
mechanism, but repeated retry with fee loss each time.

**Synthetix V3: an unsettled order expires harmlessly, but blocks the account.** No keeper is paid
and the trader is not charged, **but the account cannot commit a new order until the full window
elapses** (`PendingOrderExists`). `cancelOrder` is not an escape hatch — it is valid only *inside*
the window and only when the fill price exceeded the acceptable price. The real risk is structural:
**closing is itself a commit/settle cycle**, so every exit inherits the same two-step latency and
failure surface as an entry.

**Summary of the closing-under-stress question**, which is the one that decides whether pooled
collateral is safe:

| Venue | Contract can own? | Can it close synchronously? | Stuck-open risk |
|---|---|---|---|
| **Drift/Velocity** | ✅ yes (PDA as `User.authority`, proven by `drift-vaults`) | ✅ **yes** — `place_and_take_perp_order`, no keeper | oracle `NonPositive`/`TooVolatile`/`TooUncertain` → no fill path |
| **Hyperliquid** | ✅ yes (CoreWriter, own HyperCore account) | ❌ no — async, *"delayed onchain for a few seconds"*, no return value | docs do not state a keeper-failure path |
| **Perennial V2** (on Base) | ✅ yes (`Vault.sol` does it) | ❌ no — commit/settle two-step | ✅ explicit: `MarketStalePriceError` blocks close, liquidation exempt |
| **GMX V2** (not on Base) | ✅ yes, unrestricted | ❌ no — keeper-executed | retry with fee attrition; no permanent lock |
| **Synthetix V3** | ✅ yes (must implement `onERC721Received`) | ❌ no — commit/settle | account blocked by `PendingOrderExists` |
| **Jupiter Perps** | ⚠️ request only | ❌ no — keeper both directions | keeper-failure path **undocumented** |
| **dYdX v4** | ❌ **no** | n/a | n/a |
| **Aevo** | ❓ docs do not state | n/a | n/a |

**Only one venue surveyed lets a contract close its own position synchronously: Drift/Velocity on
Solana.** If any version of this design proceeds, that is the venue, and the reason is this table
rather than fees or minimums.

---

## 3. The share layer over packets — what TOON can actually express

This is the section that decides the design, and it is the one where the repo, rather than the
venues, supplies the answer. The short version: **TOON has no primitive that transfers a right.**
It has one primitive that transfers *value*, plus a packet-level hashlock that can make a value
transfer conditional on a *message* being revealed within a few hundred milliseconds. A share in a
position is a right, held for minutes to days, whose value moves continuously. The gap between
those two things is the whole problem.

### 3.1 What a claim is

A TOON payment is a **payment-channel balance proof** — a signed cumulative watermark, not a
message with semantics. The per-chain shapes are pinned in `docs/settlement.md:425-429`:

| Chain | Claim fields |
|---|---|
| EVM | `{ blockchain:'evm', channelId, nonce, transferredAmount, signature }`, EIP-712 over `keccak256(channelId ‖ cumulativeAmount ‖ nonce ‖ recipient)` |
| Solana | `{ blockchain:'solana', channelAccount (PDA), programId, nonce, transferredAmount, signature, signerPublicKey }` |
| Mina | `{ blockchain:'mina', zkAppAddress, tokenId, balanceCommitment, salt, nonce, proof, signerPublicKey }` |

Note what is **not** in there: no asset identifier beyond the channel's single token, no
quantity-of-a-thing, no reference to an external position, no expiry, no condition. A claim says
exactly one thing: *"of the money I deposited in channel X, cumulative amount Y is now yours, at
nonce N."* `docs/rolling-swap.md:522-524` confirms the semantics — every claim is a **cumulative
watermark** and `buildSettlementTx` redeems **only the highest-nonce claim per `(chain,
channelId)`**; superseded claims are informational.

Two consequences follow immediately:

1. **A claim cannot represent a share.** There is no field to put "0.004 of the BTC-PERP position
   at entry mark 61,240" into. Any share ledger has to live *outside* the claim, in an operator
   database or in Nostr events, with the claim doing nothing but paying for it.
2. **Cumulative-monotone means the claim direction is one-way per channel.** A channel is opened
   unilaterally between a participant *pair* and the TokenNetwork "enforces one open channel per
   participant pair" (`docs/settlement.md:397-401`). A share buyer paying the operator and later
   being *paid back* on exit is not one channel advancing — it is either a second channel in the
   opposite direction, or an on-chain settlement. The claim rail is a **meter**, not a
   book.

### 3.2 The hashlock is real, but it is packet-level only

This is the single most important repo fact for the proposal, and it cuts both ways.

**It is real.** The ILP execution condition (`sha256(preimage)`) works end to end. The rolling swap
made it load-bearing: the sender mints a fresh 32-byte preimage per packet and sets
`C_i = sha256(P_i)` as the PREPARE's `executionCondition`; the maker copies `C_i` unchanged to leg
B; the sender verifies the leg-B claim **before** revealing `P_i`
(`docs/rolling-swap.md:163-207`, rules R1–R6). The connector enforces
`sha256(fulfillment) == executionCondition` and now rejects an all-zero condition outright
(ADR 0019, cited at `docs/adr/0003-the-rolling-swap-is-the-only-swap.md:70-74`). ADR 0003 records
this as proven live: *"As of 2026-08-16 it is proven end to end: a stock client completed a rolling
swap against the deployed maker (`rolling: { probed: true, used: true }`, 3000 units in, 3000 out,
leg-B redeem settled on chain)"* (`docs/adr/0003-the-rolling-swap-is-the-only-swap.md:44-47`). A
generic reusable helper exists in the client:
`toon-client/packages/client/src/hashlock-delivery.ts` mints `condition = sha256(key)` where `key`
is both the AEAD decryption key and the ILP fulfillment — *"Neither party moves first, because
there is no first"* (`hashlock-delivery.ts:1-29`).

**It does not reach the money.** `docs/rolling-swap.md:220-224` states the limit in its own words:

> TOON balance proofs are unconditional signatures — the ILP condition gates the *packet*, not the
> on-chain redeemability of a claim that was already ingested. A Byzantine maker can therefore bank
> the in-flight leg-A advances and stall.

And `docs/payment-proxy.md:251-253` says the same from the connector side: *"(On-chain HTLC escrow
remains absent — atomicity here is packet-level, not an on-chain hashlock.)"* Making claim
redemption itself preimage-gated is an **explicit non-goal**: *"Slashable maker bonds / per-chain
escrow — the option-3 intent+settlement layer that would close the §3.1 residual by making claim
redemption preimage-gated. Deferred"* (`docs/rolling-swap.md:676-679`).

So the strongest atomicity TOON offers is: *this packet's payment commits only if the counterparty
reveals a secret within the packet's expiry.* That is enough to buy a **byte** (a decryption key, an
event, an API response). It is not enough to buy a **position** that must be honoured hours later.

**The settlement contracts confirm this independently.** `RollingSwapChannel.sol` — the newest
settlement contract, deployed for the rolling swap — has no preimage-gated redemption path at all;
its `updateBalance(channelId, cumulativeAmount, nonce, recipient, signature)` is a bare balance
proof, and every occurrence of the word "preimage" in that file refers to the EIP-712 *digest*
preimage, not a hashlock (`connector/packages/contracts/src/RollingSwapChannel.sol:244-254,447-462`).

`TokenNetwork.sol` is more interesting: the HTLC fields **exist in the signed struct and are
explicitly dead**.

```solidity
// connector/packages/contracts/src/TokenNetwork.sol:42
"BalanceProof(bytes32 channelId,uint256 nonce,uint256 transferredAmount,uint256 lockedAmount,bytes32 locksRoot)"

// :58-59
uint256 lockedAmount; /// Amount in pending HTLCs (unused in Story 8.4)
bytes32 locksRoot;    /// Merkle root of hash-locked transfers (unused in Story 8.4)
```

So the scaffolding for conditional claims was designed in and never wired up. The ticket to wire it
is **connector#1031, "A covered forward locks value, it does not transfer it: restore conditional
payment on the peer path"** — currently **OPEN** and labelled `needs:human` + `tracking`. Its body
states the intent plainly: *"the covering claim keeps riding the PREPARE (satisfying ADR 0031) but
**locks** its value; the preimage releases it; a reject or expiry releases it back"*, and notes that
*"A locking claim is signature-shape-compatible with today's."* It is further blocked behind
connector PR **#1019**, which is **OPEN and unmerged** — so the "covered forward" premise the epic
responds to is not even live on `main` yet.

**Net:** conditional payment at the claim-redemption layer is *designed, dormant, and awaiting a
human decision*. It is not available to build on today, and its arrival date is not in anyone's
plan of record. This is the caveat the brief asked to be checked rather than repeated, and the
check confirms it — with the refinement that the packet-level hashlock **is** shipped and proven,
and only the claim-level one is missing.

**One correction worth flagging (updated 2026-08-28):** connector#1031's body states *"ADR 0002
already dropped Mina from the Rust connector."* Mina has since left the connector repository
altogether — [ADR 0065](https://github.com/toon-protocol/connector/blob/main/docs/adr/0065-mina-leaves-the-repository.md),
built connector#1205 — so there are **two** settlement families, EVM and Solana. Anything in this
note about Mina describes the retired TypeScript connector, not the fleet. The quotations below
from `soak-criteria.md` are quoted as they read at the time; that document has since dropped its
Mina column. The connector's refusal of a `mina` claim **by name** survives on purpose
([ADR 0002](https://github.com/toon-protocol/connector/blob/main/docs/adr/0002-drop-mina-from-the-rust-connector.md)) —
wire behaviour owed to `toon-client`, not a leftover to clean up.

### 3.3 Therefore: what a "share" would have to be

Given the above, a share can only be one of three things, and all three are worse than they sound.

**(a) A database row the operator keeps.** The buyer sends a packet paying for the share; the
operator credits a row. The packet is a *purchase receipt*, nothing more. This is what the rails
actually support today with zero new primitives — and it means the operator is a custodian holding
an unsecured IOU. Exit is a promise, not a mechanism.

**(b) A Nostr event the operator signs.** Marginally better: the share becomes a publicly auditable
artifact. TOON's write path is already exactly this shape — pay a packet, get an event stored, get
a FULFILL as proof of storage (`docs/protocol.md:294-308`). The operator's signature over "0.004
units, holder pubkey P, entry mark M" is *evidence*, not *enforcement*: nothing stops the operator
signing a contradictory event, and the relay implements **neither NIP-40 expiry nor NIP-09
deletion** for replaceable events, which ADR 0003 flags as producing permanently unretractable
announcements (`docs/adr/0003-the-rolling-swap-is-the-only-swap.md:169-175`). Evidence that cannot
be corrected is a liability for a live position ledger.

**(c) A hashlocked delivery of a signed exit authorization.** The one genuinely TOON-native
construction. On exit, buyer pays a packet whose condition is `sha256(key)`; operator's fulfillment
reveals `key`, which decrypts a signed message authorizing the buyer to withdraw. This gets you
*delivery* atomicity on the authorization — but the authorization still has to be honoured by
something. If it is honoured by the operator, we are back to (a). If it is honoured by a contract,
then the contract needs a per-shareholder withdrawal path, which is on-chain gas per exit — which
is exactly the cost the design was invented to avoid.

**There is no fourth option on current rails.** Delivery-versus-payment for a right whose value
moves requires the payment leg and the right leg to settle atomically on a ledger that both parties
can enforce against. TOON's ledger enforcement is per-channel value only.

### 3.4 The specific breakages

**Pricing shares while the mark moves.** The rolling swap already solved a version of this problem
and its solution is instructive about the cost. It refuses to hold a price: every packet is
re-quoted, because *"A held price is a free option written by whichever side moves last"*
(`docs/adr/0003-the-rolling-swap-is-the-only-swap.md:38-40`). The machinery required is an RFQ round
trip (kind:20033) plus a quote answer (kind:20034) plus at least one coupled fill — ADR 0003 is
blunt that this is *"three packet round trips minimum, a maker-side session record, and a
sender-side controller, to move an amount legacy moved in one"*
(`docs/adr/0003-the-rolling-swap-is-the-only-swap.md:113-121`). A share market has strictly the same
free-option problem — a shareholder who can hit a stale price when the perp mark jumps is
extracting from every other shareholder — so it inherits the same three-round-trip minimum, plus a
freshness bound tied to the venue's oracle, which the operator does not control.

**Who is the counterparty.** In the proposal there is exactly one position, so shares are claims on
one pot. Every share buy must be matched by either (i) the contract increasing its position size on
the venue — an on-chain transaction, gas and keeper fees per rebalance, defeating the premise — or
(ii) another shareholder selling. (ii) makes the operator a matching engine with an inventory
problem, and the rolling-swap doc names exactly this failure mode in its predecessor: inventory
*"sized to notional"*, *"a cross-chain custodial honeypot plus capital drag"*, with *"no refill
loop, no rebalancing, no top-up path anywhere in the repo"* and state held *"in-memory, lost on
restart"* (`docs/rolling-swap.md:72-82`). The org has already been burned by exactly this shape.

**What stops a share seller walking.** Nothing on current rails, because the seller's obligation is
not collateralized anywhere the buyer can reach. The rolling swap's honest answer to the analogous
question is a *bound*, not a guarantee: *"worst-case unrecovered sender exposure is `δ·W`"* — the
in-flight window — after which the honest party stops revealing preimages and halts
(`docs/rolling-swap.md:225-232`). A share market can adopt the same discipline (cap exposure at one
packet, halt on debt > δ), but note what that implies: **the maximum trustless trade size is one
packet**, and everything above it is credit.

**Exit is best-effort, not guaranteed.** Even with a cooperative operator, exit terminates in an
on-chain settlement, and the settlement layer's own soak document says the unilateral-exit path has
never been observed working — see §4.

**Liquidation of the underlying while shares are outstanding.** The contract's position gets
liquidated; the pot is now worth a fraction or zero. Shareholders hold off-chain claims against a
pot that no longer exists. There is no on-chain event a shareholder can act on, because their share
was never on-chain. The best available outcome is that the operator publishes a signed
"liquidated at mark M" event and everyone's row is marked down — which is a *notification*, not a
*settlement*. Worse: between the liquidation block and the operator's publication, the operator
knows and shareholders do not, and the operator can still accept share purchases. That window is an
information asymmetry the design has no way to close, because the share ledger is not on the chain
where the liquidation happens.

---

## 4. Risk / custody model — name it plainly

**The operator is a custodian, and the product is an unregistered pooled investment vehicle.** That
is not a rhetorical framing; it follows mechanically from §3. The contract holds real collateral.
Shareholders hold off-chain records. The only thing binding the two is the operator's conduct.

The repo's own settlement layer makes this worse rather than better in four specific ways, each
verifiable:

**(a) TOON settlement is testnet-only today.** `docs/soak-criteria.md:12-19` lists the three
families as **EVM (currently Base Sepolia; Base mainnet at cutover, per connector#388)**, **Solana
(devnet; mainnet path per connector#834)**, and **Mina (devnet)**. There is no mainnet TOON
settlement. A perps position, by contrast, must be on mainnet to be worth anything. The product
therefore requires a mainnet settlement cutover that is currently an open ticket in another repo.
(Memory note, not repo-verified: the owner placed mainnet work **on hold**.)

**(b) The unilateral exit path has never been observed working on any chain.**
`docs/soak-criteria.md:236-245` states: *"As of this writing, all three families have a §1 gap that
means no clock has started at all: EVM's rescue path (§1, §3), Solana's close/coop-close/rescue
paths (§1, §3), and Mina's full open→close cycle (§3)."* The §1 table marks **Rescue (unilateral
exit, no counterparty cooperation)** as *"not yet observed"* for EVM and Solana
(`docs/soak-criteria.md:34-36`). For a custody product this is the single most load-bearing path:
it is precisely what a shareholder needs when the operator vanishes. It is untested.

**(c) The EVM channel has a minimum 1-hour challenge period.** `TokenNetwork.sol:38` sets
`MIN_SETTLEMENT_TIMEOUT = 1 hours`, and `closeChannel` *"Starts the challenge period during which
the receiver"* may still claim (`TokenNetwork.sol:369-372`). The newer `RollingSwapChannel.sol` is
stricter still: `MIN_CHALLENGE_PERIOD = 1 days` (`RollingSwapChannel.sol:80`), enforced in the
constructor (`:178`) and in `withdrawRemainder` (`:385`, `revert ChallengeNotExpired()`). So the
uncooperative exit is a **minimum 24-hour lockup**. That is several lifetimes for a leveraged perp
position, and it is the exact scenario a shareholder faces when the operator stops answering.

**(d) The TokenNetwork owner can drain the contract.** `TokenNetwork.sol:463-475`:

```solidity
function emergencyWithdraw(bytes32 channelId, address recipient) external onlyOwner {
    if (!paused()) revert ContractNotPaused();
    uint256 lockedAmount = IERC20(token).balanceOf(address(this));
    IERC20(token).safeTransfer(recipient, lockedAmount);
```

The owner can `pause()` (`TokenNetwork.sol:480-482`) and then transfer **the contract's entire
token balance** — not the named channel's balance, the whole contract's — to any recipient. This is
a documented last-resort recovery hatch, and for a testnet micropayment rail it is a defensible
design choice. For a rail holding third-party trading collateral it is an unmitigated
owner-key custody risk that no shareholder can opt out of. Any serious version of this product needs
either a different settlement contract or a credible owner-key governance story.

One thing does work in the proposal's favour: `openChannel` uses `_msgSender()` with no EOA check
(`TokenNetwork.sol:214-215`), so **a smart contract can be a TOON channel participant**. The
position-owning contract could in principle hold its own channel. That is necessary but nowhere near
sufficient.

**Failure mode when the operator vanishes mid-position.** Concretely: the venue position stays open
and continues to accrue funding and to be liquidatable. Nobody can close it, because the closing
authority is the operator's key (or a keeper the operator configured). Shareholders' claims are rows
in a server that is off. Their TOON channels can in principle be force-closed — via a path that has
never been exercised — recovering only whatever undelivered channel balance remains, which is *not*
their share of the position. The honest description is: **shareholders are unsecured creditors of an
operator, holding exposure to an asset they cannot see, cannot value, and cannot liquidate.**

### 4.1 The one number that is genuinely in the proposal's favour

Before the negatives swamp the note: **TOON's per-packet cost is real, verified, and extremely
low.** The connector's pricing doc is explicit and guarded by CI constants
(figures as of this note's date; `connector/docs/devnet-pricing.md` is history rather than a price list — connector#1250 — and the authority is each node repo's `deploy/` bundle plus the live `GET /ilp`):

| Route | Price | Where | Guarded by |
|---|---|---|---|
| relay `g.toon.relay` — terminate | **1 µUSDC** | `infra/linode-relay/connector-rust.toml` | `EXPECTED_RELAY_PRICE` |
| store `g.toon.store` — terminate | **1000 µUSDC** base (now `+ 10/KiB`) | `store/deploy/connector.toml.template` | that repo's bundle test |

Prices are base units of 6-decimal USDC, so **1 µUSDC = $0.000001 per packet**, and the doc records
it verified live on 2026-08-14 post-cutover via `GET /ilp/routes/price`. The rationale given is
directly relevant: *"`g.toon.relay` carries buzz huddles, which is per-audio-frame at 49 fps over
BTP… 1 µUSDC is a coherent per-frame price."*

That is the strong form of the proposal's premise, and it survives scrutiny: **TOON really can
clear a payment per event at 49 Hz for a millionth of a dollar.** No perps venue can do anything
remotely like that. If the product's bottleneck were transaction cost, TOON would win by four to six
orders of magnitude. The rest of this note is about the fact that the bottleneck is *not*
transaction cost — it is custody, enforceability, and the venue's own floors.

---

## 5. Business model

### 5.1 The uncomfortable finding: the venue already ships this

Before pricing anything, the competitive fact. **Hyperliquid's own docs name a tokenized vault
trading via CoreWriter as the sanctioned way to fractionalize a HyperCore position**, and say so in
terms that read like a description of the proposal
([`/hypercore/vaults`](https://hyperliquid.gitbook.io/hyperliquid-docs/hypercore/vaults)):

> Vaults are a general case of the powerful functionality that HyperEVM enables via CoreWriter and
> precompiles. Builders can create and tokenize vaults on the HyperEVM with fully customizable
> accounting. Builders can follow specs such as https://eips.ethereum.org/EIPS/eip-4626 with the
> added benefit of trustless read and write operations on HyperCore. … The net result is fully
> onchain accounting via precompiles, and full access to Core features including spot and HIP-3 in
> all quote assets.

**And Solana has the same answer already shipped.** Drift's own first-party `drift-vaults` program
makes a PDA the `User.authority` and manages depositor shares
(`drift-labs/drift-vaults`, `initialize_vault.rs:123-140`, quoted in §2). So on *both* candidate
chains, the venue or its core team has already built the pooled-position-with-shares product. The
proposal is not entering an empty field; it is entering a field where the incumbent is the venue
itself, holding shares on-chain.

That construction beats the proposal on the two things that matter most:

- **Shares are enforceable.** An ERC-4626 share is an on-chain token with an on-chain redemption
  function. A TOON share is a row in the operator's database (§3.3). The failure mode in §4 —
  operator vanishes, shareholders are unsecured creditors — simply does not exist for a 4626 vault.
- **Share accounting reads the real position trustlessly.** Hyperliquid's read precompiles at
  `0x…0800` expose *"perps positions, spot balances, vault equity, staking delegations, oracle
  prices"* and are *"guaranteed to match the latest HyperCore state at the time the EVM block is
  constructed"*
  ([`/for-developers/hyperevm/interacting-with-hypercore`](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/hyperevm/interacting-with-hypercore)).
  The operator cannot misreport the mark, because the contract reads it itself.

And there is **no protocol-imposed minimum deposit** for a depositor into a vault (the legacy
HyperCore vault's `100 USDC` figure is the *leader's* seed requirement, and the depositor page states
no minimum — see "what I could not verify"). So the premise "perps venues impose a floor that blocks
micro-exposure" is **already false for the fractional-share case on Hyperliquid**: the $10
`MinTradeNtl` binds the *vault's* orders, not the *depositor's* subscription.

**This does not kill the idea. It relocates it.** If shares are already fractional and enforceable
on-chain, the only remaining thing TOON can sell is **the cost and latency of moving a share**. That
is a much narrower product than "fractional perps", and it is the honest version of the pitch.

### 5.2 So price the actual product: share transfer, not share issuance

The defensible claim is arithmetic:

| Rail | Cost per share transfer | Source |
|---|---|---|
| TOON packet (relay terminate) | **1 µUSDC = $0.000001** | `connector/docs/devnet-pricing.md`, verified live 2026-08-14 |
| ERC-4626 share transfer on HyperEVM | one EVM `transfer` — gas, not stated in Hyperliquid docs | docs do not state |
| CoreWriter action (position change) | *"~25,000 gas … in practice ~47000"* + a *"few seconds"* delay | `/for-developers/hyperevm/interacting-with-hypercore` |

Even taking a generous $0.001 for an L2 ERC-20 transfer, TOON is ~1000× cheaper per transfer. That
is the entire moat, and it is real. The question is whether anyone needs 1000 share transfers.

**Round-trip cost of one TOON share trade.** §3.4 established that a share trade cannot be one
packet — it inherits the rolling swap's structure, which ADR 0003 puts at *"three packet round trips
minimum"* (`docs/adr/0003-the-rolling-swap-is-the-only-swap.md:113-121`): RFQ (kind:20033), quote
(kind:20034), coupled fill. At 1 µUSDC per terminated packet and, say, 6 packets for three
round trips, the **rail cost of a share trade is ~6 µUSDC ($0.000006)**. Call it 10 µUSDC with
overhead. This is not the constraint on anything.

**What the constraint actually is.** Every cost that bites is at the boundary, not in the packets:

| Cost | Amount | Frequency | Source |
|---|---|---|---|
| HyperCore account activation | **1 quote token (e.g. 1 USDC)** | once per new account | `/for-developers/api/activation-gas-fee` |
| Withdrawal from Hyperliquid | **$1** | per withdrawal | `/for-developers/api/exchange-endpoint` |
| Bridge deposit minimum | **5 USDC** ("If you send an amount less than this, it will not be credited and be lost forever") | per deposit | `/for-developers/api/usdc` |
| Taker fee, tier 0 | **4.5 bps** of notional | per position change | `/trading/fees` |
| Funding | hourly, `position_size * oracle_price * funding_rate`, capped 4%/hr | every hour, unconditionally | `/trading/funding` |
| TOON channel open + on-chain settle | EVM gas ×2 | per shareholder, per lifecycle | `docs/settlement.md:397-401` |

**The real economic floor is the $1 withdrawal fee and the 5 USDC deposit minimum, not the $10 order
minimum.** A shareholder who wants to end up with money in their own hands must cross the venue
boundary, and that costs ~$1 in fixed fees plus a 5 USDC deposit floor. For a position share to be
worth the boundary crossing at, say, a 10% cost tolerance, the position must be **≥ $10–50**. That is
*the same order of magnitude as the $10 minimum the proposal set out to defeat.* The floor did not
move; it changed which line item it appears on.

The escape is that a shareholder who never crosses the boundary — who keeps value inside TOON and
spends it on TOON — pays none of that. Which is precisely the agent case, §5.4.

### 5.3 Revenue: who pays and what the take is

Four candidate models, priced against the above.

**(a) Spread on share entry/exit.** The natural one, and the only one that scales with value rather
than volume. If the operator quotes shares two-sided at a 10 bps spread around the read-precompile
mark, a $100 share round trip yields $0.10 gross, against a rail cost of $0.00001 and a venue taker
cost of 4.5 bps *if the operator has to rebalance the underlying* (it usually will not, if buys and
sells net). Gross margin is excellent; the problem is inventory, not margin — the operator is warehousing
the imbalance and, per `docs/rolling-swap.md:72-82`, the org has already shipped and been burned by
exactly that shape ("sized to notional", "a cross-chain custodial honeypot plus capital drag").

**(b) Per-packet fee.** Charge a markup on the rail. At 1 µUSDC true cost, even a 100× markup is
100 µUSDC = $0.0001 per packet. To earn $1,000/month you need **10 million paid packets/month**
(~4 packets/second sustained). That is not absurd — the relay route was priced at 1 µUSDC precisely
because buzz runs *"per-audio-frame at 49 fps"* (`connector/docs/devnet-pricing.md`) — but it means
the business is a **volume business in machine traffic**, not a fee business in human trades. Any
model that assumes humans generate the packets fails by three orders of magnitude.

**(c) Funding pass-through with a rake.** The operator receives/pays funding hourly on the whole
position and re-distributes pro-rata, keeping a slice. This is genuinely attractive because funding
is *"paid every hour"* and *"purely peer-to-peer and no fees are collected on the payments"*
(`/trading/funding`) — the operator is inserting a fee where the venue charges none. But it is also
the model that most clearly makes the operator a fund manager rather than an exchange, with the §6
consequences.

**(d) Subscription.** Sidesteps per-trade economics and the securities-y "take a cut of returns"
framing. Weakest fit for an agent customer with a $0.50 balance.

**The realistic composite** is (a) + (c): a spread on entry/exit plus a funding rake, which is
structurally what Hyperliquid's legacy vaults already charge as *"10% of the total profits"*
(`/hypercore/vaults/hypercore-vaults-legacy`). Note that number as the market-clearing benchmark:
**a competing product must beat a 10% profit share, and HLP charges zero** (*"protocol vaults do not
have any fees or profit share"*).

### 5.4 Who is the customer — and is agent demand real?

**Retail micro-traders: no.** §5.2 shows the boundary-crossing cost puts the effective floor back at
$10–50, and the shareholder gets a custodial IOU (§4) instead of the enforceable ERC-4626 share the
same venue already offers. A retail user is strictly worse off. There is no product here.

**Autonomous agents with tiny balances: the only version worth arguing for, and it needs a real
demand test.** The TOON-native case is an agent that already holds micro-USDC on a TOON channel,
earns and spends inside TOON, and wants to park or hedge value without ever touching a chain. For
that agent the boundary costs vanish, the 1 µUSDC packet is native, and the $10 venue minimum is
irrelevant because it never places a venue order.

The repo shows the substrate for this exists and is being built: `toon-meta#261` ("Epic: agent fleet
money — every agent a wallet, one place to manage N") is **CLOSED**, i.e. shipped; `toon-meta#265`
("Epic: mesh-compute earning — sell GPU inference as a DVM, paid over ILP") is **OPEN**. So agents
with their own wallets and their own earnings are a real, current org direction, not a hypothetical.

But be honest about the demand step. **An agent needs a reason to want price exposure.** The
plausible ones are thin:

- *Hedging a denominated obligation.* An agent that has quoted a fixed USDC price for future compute
  and pays costs in a volatile asset has a genuine hedging need. This is real but narrow, and the
  natural hedge is a spot swap — which TOON **already has**, as the rolling swap.
- *Treasury yield on an idle balance.* An agent holding µUSDC between jobs might want yield. But the
  yield-bearing thing it wants is a money-market position, not a leveraged perp; a perp adds
  liquidation risk to an agent that cannot post more margin.
- *Speculation.* An agent speculating on price with its operating float is a bug, not a customer.

**Assessment: agent demand for micro *perps* is currently wishful.** Agent demand for micro
*payments* is demonstrated (49 fps huddles at 1 µUSDC). Agent demand for micro *swaps* is
demonstrated (the rolling swap, proven live 2026-08-16). Nothing in the repo demonstrates an agent
wanting leveraged directional exposure, and the mechanism analysis in §3–§4 says that is the one we
are worst equipped to give them safely. The right inference is not "build it and they will come" —
it is "the adjacent thing they already want is the swap, and it already works."

## 6. Regulatory reality

One paragraph, naming the exposure rather than resolving it. Selling fractional interests in a
single pooled leveraged derivatives position, to third parties, where a manager holds the collateral
and the buyers hold off-chain records, has the classic elements of (i) an **unregistered securities
offering** — the share is an investment of money in a common enterprise with profits derived from
the manager's efforts, which is the entire Howey construction, and pooling is what makes it a
*common* enterprise rather than a bilateral swap; (ii) **unregistered commodity-pool operation and
commodity-trading advice** — in the US, pooling participant funds to trade leveraged derivatives is
CPO/CTA territory under the CEA regardless of what the instrument is called on-chain, and CFTC
enforcement against DeFi perps venues has not treated "it's a smart contract" as dispositive;
(iii) **offering leveraged derivatives to retail**, which is separately restricted or prohibited in
most major jurisdictions (the EU, UK and Japan all restrict retail leverage; the UK bans retail
crypto derivatives outright) and is not cured by the position being fractional; and (iv) **money
transmission / custody**, because §4 establishes the operator is holding customer collateral. The
"it's just agents, not people" framing does **not** obviously help: the agent has a principal, that
principal is a person or a company, and the funds are theirs. The genuinely lower-exposure shape is
the one where the operator never holds a customer's money and never exercises discretion — which is
the ERC-4626-vault-plus-TOON-transport shape in §7, not the operator-as-custodian shape in the
original proposal. This is a naming of exposure, not legal advice, and any real attempt needs
counsel before a line of the share ledger is written.

## 7. Verdict

**Not practical as proposed.** The design's load-bearing assumption — that a share in a position can
be bought and sold as an ILP packet — is not supported by TOON's primitives, and the gap is
structural rather than a missing feature. A TOON claim transfers *value* on one channel between one
pair (§3.1); it has no field for a right, no expiry, no condition. The hashlock that *does* work is
packet-level and lives for the duration of a PREPARE, not for the life of a position, and the
settlement contracts confirm it: `RollingSwapChannel.sol` has no preimage-gated redemption, and
`TokenNetwork.sol` carries `lockedAmount` / `locksRoot` fields explicitly commented *"unused"*
(§3.2). Making claims conditional is an open, `needs:human`, blocked-behind-an-unmerged-PR ticket
(connector#1031), not a primitive to build on. Meanwhile Hyperliquid's own docs recommend a
tokenized ERC-4626 vault trading via CoreWriter as the way to fractionalize a position (§5.1) —
which delivers enforceable, on-chain, trustlessly-priced shares with no depositor minimum, i.e. it
already solves the problem the proposal was invented for, better.

Two premise corrections worth stating separately, because they change the shape of any follow-up:
**the venue leg is fine, and Base is the wrong chain for it.** GMX V2 is not deployed on Base and
Synthetix V3's Base deployment was deprecated with positions force-closed in July 2025 (§1.1). Of
every venue surveyed, **only Drift/Velocity on Solana lets a contract close its own position
synchronously, in one CPI, with no keeper** (§2.1 table) — and Drift additionally exempts reduce-only
orders from `min_order_size`, so a sub-minimum position can always be unwound. If this is built, it
is built on Solana against Drift, not on Base.

### Top 3 blockers

1. **A TOON packet cannot carry a right, and cannot be made to.** Shares would have to be operator
   database rows or operator-signed Nostr events (§3.3), which makes every shareholder an unsecured
   creditor. Fixing this means claim-level HTLCs — dormant in the contract, unimplemented, and an
   explicit non-goal in `docs/rolling-swap.md:676-679`.
2. **TOON has no mainnet settlement, and the unilateral-exit path has never been observed working on
   any chain.** `docs/soak-criteria.md:12-19` puts all three families on testnets;
   `:236-245` states *"all three families have a §1 gap that means no clock has started at all"*,
   with EVM and Solana rescue paths marked "not yet observed". Add a minimum 24-hour challenge
   period (`RollingSwapChannel.sol:80`) and an owner-only `emergencyWithdraw` that can drain the
   whole TokenNetwork balance (`TokenNetwork.sol:463-475`), and this rail cannot responsibly hold
   third-party trading collateral today (§4).
3. **The economics do not clear, and the customer may not exist.** Pooling genuinely destroys the
   fixed per-order costs that bind at the venue (§1.3 conclusion 2) — that part of the thesis is
   correct. But it does not touch the *participant's* boundary costs: $1 withdrawal, 5 USDC deposit
   minimum, ~1 USDC activation on Hyperliquid; 25 USDC withdrawal on Aevo. Those put the effective
   floor back at $10–50 for anyone who cashes out (§1.3, §5.2), the same floor the design targeted.
   The only customer for whom the floor genuinely vanishes is an agent that never leaves TOON, and
   nothing in the repo demonstrates agent demand for *leveraged directional exposure* — only for
   micropayments and swaps, both of which already work (§5.4).

### The narrower version that IS practical

Two of them, in increasing ambition.

**(A) TOON as the transport for shares that live on-chain — the honest reframe.** Issue shares as an
ERC-4626 vault on HyperEVM (or the equivalent on the chosen venue), exactly as the venue recommends.
The shares are enforceable, redeemable, and priced from read precompiles with no operator
discretion. Then use TOON for the thing TOON is genuinely best in the world at: **the quote tape,
the order flow, and the intra-session netting.** Quotes stream at 1 µUSDC per packet
(`connector/docs/devnet-pricing.md`, verified live at 49 fps); trades net off-chain across a session
and touch the chain once, at settlement, using exactly the cumulative-watermark property TOON
already has (`docs/rolling-swap.md:522-524`, *"N micro-swap advances net to one settlement per
chain"*). This keeps the custody on-chain where it belongs and sells the millionth-of-a-dollar
packet where it wins. It is a smaller claim than "fractional perps" and it is true.

**(B) The thing already half-built: micro *swaps*, not micro *perps*.** The rolling swap is proven
live end to end as of 2026-08-16 (ADR 0003), is loss-bounded to one packet window by design
(`docs/rolling-swap.md:225-232`), and needs no new primitive. Its named gaps are concrete and
small — receive-side claim ingestion in the client, and a maker board to replace the single maker
(`docs/rolling-swap.md:539-545`, `:684-690`). Spot exposure at packet granularity is a real product
for an agent with a µUSDC balance and a denominated obligation; leveraged exposure is not. If the
motivation behind the perps idea is "let agents take positions in tiny size," the swap path gets
most of that value with none of §3's structural problem and none of §6's regulatory surface.

**What would have to change for the original design to become practical:** claim-level conditional
payment shipped (connector#1031), mainnet settlement live on at least one chain with the rescue path
soak-proven, and a governance answer for `emergencyWithdraw`. That is a multi-quarter program in
another repo, and it should be judged on its own merits rather than as a prerequisite for this.

## What I could not verify

Listed so a skeptical reader knows exactly where the note is thinner than it reads.

**Hyperliquid — the docs are silent on:**

1. Whether **reduce-only / position-closing orders are exempt from the `$10 MinTradeNtl`**. I
   checked the error-response table, the order-types page, and the official Python SDK; the
   error is listed unconditionally and no carve-out is stated. This matters: without a carve-out,
   a position cannot be *unwound* in increments below $10 either, which caps how finely a
   share-redemption can be hedged.
2. Any **rounding or granularity floor on funding payments**. Funding is `position_size *
   oracle_price * funding_rate` charged hourly, but no minimum increment is documented. Whether a
   sub-cent pro-rata funding share rounds to zero is therefore unknown, and it is a real question
   for micro-shares.
3. Whether an **approved API/agent wallet may itself be a smart contract** (EIP-1271). EIP-1271 does
   not appear anywhere in the Hyperliquid docs. The *supported* contract path is a contract acting
   as its own HyperCore account via CoreWriter, which is sufficient for this design.
4. A **minimum perps account collateral**. Only the 5 USDC bridge-deposit minimum and the
   1-quote-token activation fee are documented.
5. A **minimum vault deposit for a depositor** (as opposed to the leader's 100 USDC seed). The
   depositor page gives only an illustrative "let's say you deposit 100 USDC". §5.1's claim that
   there is no depositor minimum rests on the *absence* of a stated one, not on a positive
   statement — treat it as "not stated" rather than "confirmed zero".
6. **Gas cost of an ERC-4626 share transfer on HyperEVM** in dollar terms. §5.2's comparison uses a
   generous $0.001 placeholder that is *my assumption, not a cited figure*. The 1000× ratio is
   therefore illustrative. The CoreWriter figure (~47,000 gas) *is* cited.

**Solana venues:**

13. **Drift/Velocity's actual `min_order_size` for any real market.** It is a per-market on-chain
    field and the docs explicitly decline to publish it (*"the authoritative value for a given market
    is shown in-app and on-chain"*). Every statement here about Drift minimums is about the
    *mechanism*, not a number. **You must read the `PerpMarket` account to know the floor.**
14. **Drift's live fee and liquidation parameters.** The source `Default` impls demonstrably
    disagree with the live docs (`state/state.rs:265` gives 10 bps taker vs the docs' 3.5 bps), and
    `liquidator_fee` / `if_liquidation_fee` default to 0 in source with no published figure. Treat
    on-chain `State.fee_structure` as the only authority.
15. **Drift's funding formula and cap.** The Velocity funding-rates docs page reads *"Coming soon."*
    Only `funding_period` (a per-market `i64`) is visible.
16. **The Solana rent figures in §1.2 are my arithmetic**, derived from Solana's published formula
    and Drift's `SIZE` constants — they are not quoted from any doc.
17. **Jupiter's keeper-failure behaviour** — slippage, expiry, refund — is not stated on any page I
    could reach; `station.jup.ag` guides 301 to `developers.jup.ag`, which 404s.
18. **A source-tree caveat on Drift:** commit `e32903b` ("comment out all ixs", 2026-04-01) comments
    out the entire `#[program]` block on master and in tag `v2.162.0`. The `#[derive(Accounts)]`
    contexts and `handle_*` handlers quoted here are live, but anyone re-checking should expect the
    dispatch block to look disabled.

**EVM venues:**

19. **Perennial and Synthetix figures are deploy-time defaults or code constants, not live chain
    state.** Both projects set live parameters by governance/coordinator calls.
    `docs.perennial.finance` does not resolve at all, so there is no documentation to cross-check
    against. Synthetix's docs corpus was grepped for `andromeda`, `commitOrder`, `settlementReward`,
    `minimumPositionMargin`, `Pyth`, `keeper` — zero hits for all of them.
20. **GMX's live `DataStore` values.** Arbitrum overrides several gas constants
    (`estimatedGasFeeBaseAmount: false` etc.), so the deploy-config gas limits quoted are not
    necessarily what a live order pays.
21. **A possible latent bug in Perennial's Base keeper config** was flagged during research — the
    non-Arbitrum branch appears to mix Base's calldata constant with
    `L1_GAS_BUFFERS.arbitrum.commitIncrement`. I have **not** independently confirmed this and it
    should not be relied on or reported upstream without a second look.
22. **Aevo contract ownership** — ERC-1271 appears nowhere in the API reference; the docs do not
    state whether a contract can be an account owner.

**Oracles:**

23. **Both zero oracle fees are migration artifacts, and I could not establish a stable rate.**
    Pyth's fee on Base is currently 0, but explicitly *"as part of the Pyth Core sunset"*, with a
    *"Pyth Core upgrade August 26, 2026… Every Core user will need an API Key"* warning on the same
    page. Chainlink Data Streams' *"pay-per-verification billing model has been deprecated"* in
    favour of a subscription whose price is "contact us". **Neither should be modelled as a
    permanent zero**, and the post-migration cost is the number that would actually set the oracle
    floor for a Pyth- or Chainlink-settled venue. I could not obtain it.

**TOON side:**

7. **Per-packet round-trip latency.** I found no figure in any repo doc. A prior measurement of
   ~20.6 ms/packet on loopback exists in operator memory but is not in the repo and I did not
   re-measure it. Every latency statement in this note is therefore qualitative.
8. **On-chain settlement gas cost per channel open/close**, in dollars. The mechanics are cited
   (`openChannel`, `closeChannel`, `settleChannel`, challenge periods); the cost is not stated in
   any repo doc I read.
9. **Whether mainnet TOON settlement is formally on hold.** `docs/soak-criteria.md` establishes that
   all three families are testnet and that connector#388/#834 are the open mainnet tickets. The
   stronger claim — that the owner *paused* mainnet work — comes from operator memory, not from a
   repo document, and is flagged as such in §4(a).
10. **Solana and Mina channel-participant contract-compatibility.** I verified from source that EVM
    `TokenNetwork.openChannel` uses `_msgSender()` with no EOA restriction. I did **not** check
    whether the Solana payment-channel program or the Mina zkApp permit a program/contract
    participant. Do not assume the EVM finding generalizes.
11. **The `1 µUSDC` relay price is a devnet figure.** It is verified live and CI-guarded, but on
    devnet infrastructure with no mainnet cost basis behind it. Whether a mainnet relay could hold
    that price while covering real settlement gas is unestablished, and it is the single number the
    §5.2 argument leans on hardest.
