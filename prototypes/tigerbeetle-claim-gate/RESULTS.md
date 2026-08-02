# TigerBeetle vs the in-place claim-gate fix — prototype results

**Question.** Would TigerBeetle meaningfully beat the planned in-place fixes for the
connector's payment-claim accounting path (connector#686 bottleneck A: global
watermarks RwLock held across a per-claim `FileJournal` append+fsync,
claim_gate.rs:429-467 / journal.rs:183-188)?

**Verdict: NOT-PRACTICAL (today) — the in-place fix wins on every axis that is
currently binding; TigerBeetle is POSSIBLE and worth revisiting only if/when the
connector wants a real cross-channel double-entry ledger AND the official Rust
client ships.** Details and measured numbers below.

## What was benchmarked

Local only (this machine: 16-core x86_64, WSL2, ext4; fsync p50 ~5.6 ms — a slow
disk, which if anything *flatters* batching solutions). Nothing touched devnet.

1. **TigerBeetle 0.17.9**, single replica, `--development`, on 127.0.0.1:3033,
   driven by the official `tigerbeetle-node` client (`bench-tb.cjs`).
   Mapping: one TB account per payment channel (debit side), one connector
   revenue account (credit side); each accepted claim delta = one transfer with
   `user_data_64` = claim nonce and `id` = f(channel, nonce) for idempotency.
2. **Counterfactual** (`counterfactual/`, std-only Rust): the *planned* in-place
   fix — brief write lock (watermark re-check + advance + enqueue, so journal
   order == watermark order), group-commit writer thread (batched write, one
   fsync per batch), claim ACKed only after its batch is durable. Same journal
   line format as `connector-runtime/src/journal.rs`, same
   durable-before-visible ordering as ADR 0005.
3. **Baseline**: the current broken shape (per-claim fsync under the global
   write lock), for context.

Signature verification is excluded from all three (it is outside the lock in the
real gate and identical across designs). The monotonic nonce watermark check is
app-side in *both* designs — see "mapping" below.

## How the claim gate maps onto TigerBeetle

- **Claims-as-transfers works cleanly for the money part.** Channel account →
  revenue account, amount = cumulative delta. TB natively enforces double-entry
  balance, `debits_must_not_exceed_credits` (channel cannot spend past its
  deposit — the collateral check the gate currently does with a chain read
  could become a native rejection against a deposit-funded TB account), and
  permanent transfer-`id` idempotency (id = hash(channel, nonce) gives replay
  rejection of an *exact* duplicate for free, across restarts).
- **Monotonic nonce watermarks do NOT fit TB's transfer model.** TB has no
  "reject unless user_data_64 > max(user_data_64) for this account" invariant.
  The strictly-advancing nonce + strictly-advancing cumulative check stays
  app-side (in-memory map), exactly as today. TB replaces only the journal
  (durability), not the gate (policy). `user_data_64` carries the nonce for
  audit; linked/pending transfers add nothing here.
- **Hot path shape**: read-check (in-memory) → submit transfer → on ack, advance
  watermark. So the gate's read-check-update does NOT become "one TB op"; it
  becomes the same in-memory check plus a TB round-trip *instead of* a journal
  fsync. The concurrency-correctness burden (two claims racing on one channel)
  stays in the connector either way.
- **What you'd lose**: the journal's replay semantics. Today
  `FileJournal::read_all` + the `Projection` fold *is* the restart story, one
  human-readable file, no service dependency. With TB, restart recovery means
  querying TB for per-channel maxima (`user_data_64` is not indexed for max;
  you'd scan `get_account_transfers` per channel or keep a snapshot), and the
  claim *signature* — which the journal retains because "only the claim itself
  is redeemable" (issue #425) — does not fit in a transfer (128+64+32 bits of
  user_data vs a 65-byte secp256k1 signature). A side-store for signatures
  would still be required. TB cannot replace the journal outright.

## Measured numbers

Disk fsync floor (this box): **p50 5.6 ms, p99 8.6 ms** (`fsync-probe`, 200
sequential append+fsync). Every durable-per-claim design pays this somewhere.

### Throughput (sustained, 10 s runs)

| design | config | claims/s |
|---|---|---|
| current shape (baseline) | 1 / 16 / 64 sessions | **181 / 178 / 181** (fsync-serialized, flat) |
| in-place fix (group commit) | 1 session | 180 (per-session floor = 1/fsync, = bottleneck B's per-session ordering) |
| in-place fix (group commit) | 16 sessions | **2 516** (avg batch fill 14.4) |
| in-place fix (group commit) | 64 sessions | **9 917** (fill 63.7) |
| in-place fix (group commit) | 256 sessions | **25 988** (fill 255) |
| TigerBeetle | 1 sess × batch 1 | 113 |
| TigerBeetle | 16 sess × batch 1 | 910 (client coalesces concurrent requests) |
| TigerBeetle | 1 / 16 sess × batch 64 | 4 371 / 11 567 |
| TigerBeetle | 1 sess × batch 253 | 13 237 |
| TigerBeetle | 16 sess × batch 253 | **19 911** |
| TigerBeetle | 64 sess × batch 253 | 10 031 (degrades under submit contention) |

(`--development` caps TB at **253 transfers/request** — production message size
allows 8189, so TB's *peak* here understates a production deployment; its
low-batch-fill numbers do not.)

Headline: **both group-commit designs land in the same class (~20–26k/s peak on
this disk), 100–140× the current shape's 180/s.** TB does not beat the in-place
fix on throughput; both amortize the same fsync. The target (>10k claims/s
network-wide) is cleared by either.

### Latency per claim (paced, huddle-realistic, single-claim submits)

| design | load | p50 | p95 | p99 | max |
|---|---|---|---|---|---|
| current shape (baseline) | 10 sess × 50/s | 46.8 ms | 133 ms | 264 ms | 1 044 ms |
| in-place fix | 1 sess × 50/s | 5.5 ms | 7.4 ms | 30 ms | 97 ms |
| in-place fix | 10 sess × 50/s | **10.3 ms** | 12.3 ms | **17.1 ms** | 79 ms |
| in-place fix | 40 sess × 50/s (2 000/s) | **10.5 ms** | 12.9 ms | **17.5 ms** | 80 ms |
| TigerBeetle | 1 sess × 50/s | 5.4 ms | 7.4 ms | 29.8 ms | 607 ms |
| TigerBeetle | 10 sess × 50/s | **10.3 ms** | 14.2 ms | **27.8 ms** | 612 ms |
| TigerBeetle | 40 sess × 50/s (2 000/s) | **10.3 ms** | 16.1 ms | **35.2 ms** | 613 ms |

Reading: at huddle load the two designs are **identical at p50** (~10.3 ms —
both are one-to-two disk fsyncs; a claim arrives mid-batch and waits out the
in-flight commit plus its own). TB's tail is *worse*: p99 28–35 ms vs 17 ms,
and a recurring ~600 ms worst-case stall (LSM compaction / dev-mode single
replica) vs 80 ms for the plain journal. Both fit the 150 ms huddle audio
budget at p99; TB's max does not. On production NVMe (fsync well under 1 ms)
both p50s drop proportionally — the *ordering* of the two designs would not
change, because they bottleneck on the same syscall.

## Rust client status (adoption-critical)

- crates.io `tigerbeetle` is a **0.0.1 placeholder from 2023-05** (1.7k
  downloads). Verified 2026-08-02.
- An **official in-tree Rust client now exists**
  (`tigerbeetle/tigerbeetle:src/clients/rust`, crate name `tigerbeetle`,
  version `0.0.0`, docs pages live) but its own README's setup sample uses
  `tigerbeetle.path = "../.."` — i.e. **not yet published** to crates.io.
  Recent repo activity (issues #3870/#3876, 2026) shows it landing now;
  CI "don't validate rust client sample yet" (#3821) shows it is not done.
- The practical crate today is community **`tigerbeetle-unofficial`**
  (0.14.28+0.16.78, updated 2026-03, 189k downloads) — safe bindings over the
  official `tb_client` C library, but pinned to tb_client **0.16.78** while the
  current server is **0.17.x**; TB's client/server compatibility window is
  bounded (clients must not be newer than replicas, and replicas drop old
  clients over time), so you would be version-locked to a community release
  cadence for a money-path dependency. TB is also **pre-1.0** with explicit
  license to break (tracking issue #2231).

**Rust client verdict: not adoption-ready for a money path in 2026-08.** The
official client is weeks-to-months from being consumable from crates.io; the
community crate works but adds a second maintainer's cadence between you and
every server upgrade.

## Operational footprint

- Production TB wants **6 replicas** (quorum 3) on independent fault domains and
  6–32 GiB RAM each; single-replica `--development` mode exists but a
  single-replica production ledger is *worse* durability than today's
  fsync'd journal-on-the-box (same single disk, plus a network hop and a new
  process to babysit). An honest TB adoption for the devnet fleet (2 boxes)
  is either dishonest (1 replica) or a topology change (3–6 replicas).
- Single preallocated data file (~1.1 GiB at dev defaults), Docker image
  available, Apache 2.0, weekly releases, multiversion-binary upgrades,
  Jepsen-tested (0.16.x: strong results, some crashes fixed by 0.16.29+),
  VOPR-fuzzed. Durability *quality* is genuinely a tier above a hand-rolled
  journal — when replicated.

## Could TB unify settlement + swap accounting?

Scanned the connector (read-only): peer-wire settlement state is
`ClaimBook`/`OutboundLedger` + the same `JournalEntry` alphabet folded by
`Projection` (four one-sided BTreeMaps, no debit/credit postings); the client
edge keeps a **second** FileJournal with its own replay; on-chain
deposited/redeemed truth is fetched from `connector-settlement` backends and
**never journaled locally** — nothing reconciles claims-signed against
value-actually-settled; rolling-swap accounting lives only in
`RollingSwapChannel.sol` on-chain, with no Rust-side ledger at all.

So yes — the connector's money state is genuinely ledger-shaped and currently
fragmented across two journal files, an in-memory projection, chain reads, and
Solidity storage, and a double-entry ledger (channel escrow / revenue / peer
payable / settlement clearing accounts, pending transfers for
in-flight settlements) is the *right abstraction* for unifying it. That is the
real argument for TB — but it is an architecture epic (new service, migration of
live channel state, new restart semantics, signature side-store), not a fix for
bottleneck A, and none of it is blocked on adopting TB today: the same
unification could be done on the existing journal by adding entry variants
(settle/redeem/deposit) first, keeping TB as a later backend swap.

## Adoption verdict

**NOT-PRACTICAL** as a response to the measured bottlenecks; **POSSIBLE** as a
future ledger consolidation.

1. **The in-place fix already clears the target with the same durability
   semantics and zero new moving parts** — measured 26k claims/s peak vs TB's
   20k, identical 10.3 ms p50 at huddle load, and a *better* tail (p99 17 ms
   vs 28–35 ms, max 80 ms vs ~600 ms). Group commit
   is the same trick TB uses, applied to the journal you already have; nobody
   waits on a network hop, restart replay keeps working, and it ships as a
   ~200-line change inside `ClientClaimGate` + `FileJournal`.
2. **The Rust client is the killing blocker regardless of performance**:
   official client unpublished, community crate version-locked behind the
   server, database pre-1.0 with a bounded client-compat window — on the path
   that moves money.
3. **TB doesn't actually absorb the hard part of the gate.** Monotonic
   watermark policy, per-channel serialization, and signature retention all
   stay in the connector; TB would replace only the fsync — the one part the
   in-place fix already makes cheap — while adding a stateful service that
   honest durability sizes at 3–6 replicas.

**Integration cost estimate** (if adopted anyway): new fleet service (compose +
image + ops runbook) ~1 wk; claim-gate rewrite + signature side-store + restart
recovery from TB queries ~1–2 wk; migration of live channel watermarks and
dual-write soak ~1 wk; Rust client risk unbounded until the official crate
ships. Call it **3–4 weeks + an unbounded dependency risk**, vs **days** for
connector#686 as planned.

**What would change the verdict**: official Rust `tigerbeetle` crate published
and stable through 2+ server upgrades, AND a decision to build the unified
double-entry ledger (settlement reconciliation + swap legs) as its own epic —
at that point TB is the obvious backend and the audit-trail/invariant gains
(native overdraft protection per channel deposit, cluster-wide balance
invariants, permanent idempotency) are real.

## Reproducing

```sh
# TigerBeetle single replica (binary from github releases, v0.17.9)
./tigerbeetle format --cluster=0 --replica=0 --replica-count=1 --development 0_0.tigerbeetle
./tigerbeetle start --addresses=127.0.0.1:3033 --development 0_0.tigerbeetle

npm install tigerbeetle-node        # anywhere; export NODE_PATH accordingly
(cd counterfactual && cargo build --release)
./run-matrix.sh results.jsonl
```
