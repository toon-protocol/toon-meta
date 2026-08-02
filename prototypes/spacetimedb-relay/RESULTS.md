# proto/spacetimedb-relay — would SpacetimeDB beat the relay's planned in-place fixes?

**Question.** The TOON relay's store+broadcast role has a known future wall:
ephemeral fan-out (speakers × listeners × 50 fps WS sends) and growing
persistent write load. Would replacing the relay's storage+broadcast core with
SpacetimeDB (in-memory relational tables + WASM reducers + incremental SQL
subscriptions over WS) meaningfully beat the CURRENT relay plus its planned
cheap fixes (skip-verify for paid ephemeral kinds, worker-pool verify,
config bumps)?

**Verdict: NOT-PRACTICAL today; the subscription engine is real but it does
not beat the relay where the relay actually hurts, and the ephemeral path
re-acquires the disk-I/O problem relay#84 just removed.** Details below;
top-line reasons at the end.

Date: 2026-08-02. SpacetimeDB 2.7.1 (official `clockworklabs/spacetime:latest`
docker image; server == CLI == TS SDK version). Relay: the deployed image
`ghcr.io/toon-protocol/relay:sha-dd881d9` in `TOON_DEV_MODE=true` (== the
planned skip-verify ephemeral path; schnorr verify excluded on BOTH sides —
in an adoption it would live in the NIP-01 protocol shim, exactly like the
connector today). Both servers `--cpus=2` (devnet box shape), clients on the
remaining 14 host cores, all loopback (WSL2, 16-core, NVMe). Raw per-scenario
JSON in `bench/results/`.

---

## 1. Research summary (primary sources, verified against the repo)

- **Model.** In-memory relational tables; modules (Rust/C#/TypeScript/C++)
  compiled to WASM run inside the DB; reducers are the only write API;
  clients subscribe to a SQL subset over WS (BSATN binary or JSON encoding)
  and get incremental row deltas. Subscription SQL: `SELECT * FROM t [WHERE
  …]`, whole-row projections only, joins of **exactly two tables** with
  **indexes required on both join columns**, no LIMIT/aggregates/arithmetic.
- **Durability (the crux).** A segmented commitlog with an *asynchronous
  write-behind* actor: commits enter committed state, subscribers are
  notified **without waiting for fsync**, and a durability task drains a
  bounded queue in batches (default 4096) with one `flush_and_sync` per
  drained batch. No per-tx fsync, no configurable fsync policy. Snapshots
  every 1M transactions.
- **Ephemeral mechanism exists — but it journals anyway.** `event` tables
  (v2 protocol): rows live only inside the transaction, are broadcast to
  subscribers at commit, never enter committed state or snapshots, clients
  get only `on_insert`. **But the docs are explicit: "The inserts are still
  recorded in the commitlog, so a full history of events is preserved"** —
  and reducer args are journaled per-tx besides. The only genuinely
  non-journaled tables are internal view-backing state; there is no
  user-facing "don't persist this" flag. → **SpacetimeDB cannot do
  non-durable broadcast. Every ephemeral frame is written to disk.**
  Measured below: ~475–490 B/frame journaled for 160 B frames; **~809 MB of
  commitlog in 15 s** for 16 KB video frames at max ingest — for data whose
  entire purpose is to never be stored.
- **Subscription engine.** Genuinely smarter than a per-subscriber linear
  scan: queries are canonicalized and deduped by hash (N subscribers to the
  same SQL = one evaluation + fan-out), and parameterized queries (`WHERE col
  = value`) are indexed by `(table, col, value)` so each delta row hash-looks-up
  only candidate queries. No published fan-out benchmarks.
- **Licensing.** Still **BSL 1.1** (not OSS until each version's change date;
  2.7.1 converts to AGPLv3-with-linking-exception on **2031-07-26**).
  Additional Use Grant: **"no more than one SpacetimeDB instance in
  production"** and no offering it as a database service. A TOON fleet
  (apex relay + store + community operators) is multiple production
  instances unless each independent operator counts as their own licensee —
  legally gray, and per-node commercial licensing otherwise.
- **Self-host/ops.** Official docker image, single Rust binary, all state in
  RAM + commitlog on disk; self-hosting guide is single-node systemd+nginx;
  HA/replication is Maincloud/enterprise territory (and the license's
  one-instance grant points the same way). Release cadence ~2–4 weeks; TS SDK
  first-party and version-locked to the server.

## 2. Honest protocol mapping

- **Events as rows + insert reducers**: clean. `events` table (persistent
  kinds) + `frames` event table (NIP-16 20000–29999) + two reducers ≈ 70
  lines of Rust; compiled and published first try.
- **NIP-01 filters → subscription SQL**: `kinds`/`authors`/`since`/`until`
  map to indexed `WHERE` clauses (OR-lists inline). **Tag filters** (`#e`,
  `#p`) need a side `event_tags(event_id, name, value)` table and the
  two-table semijoin form — allowed, index-required, but each REQ filter
  becomes its own subscription query and multi-condition filters push at the
  edges of the two-table limit. **No `limit`**: subscriptions have no LIMIT,
  so a NIP-01 REQ's initial snapshot is unbounded and the shim must trim.
  **No prefix matching** (NIP-01 id/author prefixes): no LIKE in the
  subscription language. Event tables **cannot** be the join side, so tag
  filtering *ephemeral* kinds via a tags side-table is not expressible —
  the shim would filter client-side.
- **Protocol shim is mandatory**: NIP-01 WS must be preserved, so a
  TS/whatever front process would hold every client WS, translate REQ→SQL
  subscriptions (or subscribe broadly and filter in the shim), verify
  schnorr, and re-serialize rows→EVENT frames. That shim re-introduces a
  per-subscriber serialize+send loop — i.e. the exact cost center the relay
  already is — unless it subscribes once per distinct filter and multicasts,
  which is precisely the optimization the relay could do in-place.

## 3. Measured numbers

### (b) Fan-out matrix — 1 writer, 50 ev/s, 160 B ephemeral frames, 30 s

| subs | system | delivered | p50 | p99 | server CPU avg/max | disk growth |
|---|---|---|---|---|---|---|
| 10  | relay | 100% | **1.5 ms** | **2.5 ms** | 7.8 / 12.5% | 0 (no data dir) |
| 10  | stdb  | 99.9% | 7.1 ms | 11.3 ms | 7.6 / 8.6% | 733 KB (~488 B/frame) |
| 100 | relay | 100% | **2.7 ms** | **5.0 ms** | 19.4 / 25.5% | 0 |
| 100 | stdb  | 99.9% | 4.5–7.8 ms | 35–58 ms | 20.9 / 27.4% | 914 KB |
| 500 | relay* | 100% | 9.4 ms | 64.3 ms | 85.2 / **97.9%** (1-core pinned) | 0 |
| 500 | stdb  | 99.9% | **6.8 ms** | **38.3 ms** | 80.5 / 117% (multi-core) | 1.7 MB |

\* the deployed relay image hard-caps `maxConnections: 100` (default, no env
override — >100 subscribers is impossible on the stock image). The s500 row
ran the same image's code via `serve-uncapped.mjs` with only that default
raised. First stdb-s10 run showed p99 119 ms cold-start (first run after
publish); rerun shown.

**stdb-on-tmpfs control (fanout-s100): p50 2.3 ms / p99 4.0 ms — identical
to the relay.** The entire steady-state latency gap is the commitlog disk
write in the ephemeral path (isolated single-commit: p50 ~7.3 ms on disk vs
~1.4 ms on tmpfs). SpacetimeDB pays per-frame disk I/O that the relay's
ephemeral path (zero disk writes, verified: no data dir even created) does
not — the same class of cost relay#84 removed, in async-batched rather than
synchronous form.

CPU at equal offered load is **statistically identical** (both ~8% at s10,
~20% at s100, ~80–85% at s500). The query-dedup engine does not save CPU
here because the cost is per-subscriber WS sends, which both systems pay
N times.

### (a) Sustained insert→delivery ceilings (closed loop, 64 in-flight, 15 s)

| scenario | relay | stdb |
|---|---|---|
| 160 B ephemeral, 1 sub | 2,941 ev/s @ **101% CPU** (event loop pinned), ack p50 19.4 ms | **4,638 ev/s @ 22.6% CPU**, ack p50 11.3 ms |
| 16 KB ephemeral, 1 sub | 2,322 ev/s @ 100% CPU | 1,639 ev/s @ 32.9% CPU, **+809 MB commitlog in 15 s** |
| 160 B ephemeral, 100 subs | admits **327 ev/s**, **100% delivered** (~33k msg/s), p50 192 ms | admits 3,223 ev/s but **74.6% delivered**, p50 **15.2 s** queues, CPU 125–155% |
| 256 B persistent, 1 sub | 2,073 ev/s @ 78% CPU (sqlite WAL) | **5,121 ev/s @ 27.7% CPU** |

The 100-sub saturation row is the architectural difference in one line: the
relay's synchronous broadcast self-throttles admission (100% delivery, no
queue), SpacetimeDB decouples admission from fan-out and lets subscriber
queues explode (no backpressure coupling). Peak drain measured ~80k msg/s
(vs relay ~33k/core) — the engine is faster, but unbounded latency under
overload is the huddle failure mode (a late audio frame is a lost frame).

### Video-shaped paced runs (16 KB @ 50 fps)

| scenario | relay | stdb |
|---|---|---|
| 10 subs | 100%, p50 2.2 / p99 3.6 ms, CPU 13.5% | 99.9%, p50 9.3 / p99 15.2 ms, CPU 8.2% |
| 100 subs (80 MB/s) | **100%, p50 11.6 / p99 17.4 ms**, CPU 72.6% | 8 client procs: 91.7%, p50 3.0 s (client-decode-bound); 20 procs: 99.9%, p50 14.7 ms, **p99 469 ms**, CPU 43.1% |

Server CPU favors stdb at 16 KB payloads (Rust vs JSON-stringify-per-sub),
but its TS-SDK BSATN decode is expensive client-side (needed 20 client procs
where the relay's JSON needed 8) and the delivery tail stays ~27× worse.

### (c) 1k-event persistent burst

| metric | relay | stdb |
|---|---|---|
| burst absorbed in | 818 ms | **81 ms** |
| write-ack p50 / p99 | 431 / 774 ms | **71 / 74 ms** |
| delivery to 1 sub | 100% | 100% |

stdb absorbs the burst ~10× faster (group-commit batching vs per-POST
round-trips through the single event loop).

## 4. What SpacetimeDB does NOT solve

Per Phase G/H measurements (prototypes/huddle-over-ilp/RESULTS.md), the live
system's binding constraints are **connector-side admission and the shared
1-vCPU box**, not relay broadcast: at 486 fps offered, the relay sits at
34.5% CPU with 100% delivery, and the next contention is relay+connector
jointly exceeding the single core. Swapping the relay's core for SpacetimeDB
changes none of that — and adds a shim process on the same box.

## 5. Verdict — NOT-PRACTICAL (against the honest counterfactual)

Top reasons:

1. **The ephemeral path re-acquires disk I/O by design.** Event tables are
   broadcast-shaped but journaled ("inserts are still recorded in the
   commitlog" — docs, verified by measurement: ~490 B/frame small, 2× write
   amplification for video, 809 MB/15 s at max video ingest, no opt-out).
   Steady-state fan-out latency is 2–10× worse than the relay's on identical
   hardware purely because of this (tmpfs control collapses the gap to zero).
   The relay's broadcast-only ephemeral path writes nothing, ever.
2. **At the actual fan-out wall the win isn't there.** Equal CPU at equal
   load; the relay delivers 100% with tighter tails through 500×50 fps; under
   deliberate overload stdb trades delivery (74.6%, 15 s queues) for
   admission. Its real ceiling advantage (multi-core, ~80k msg/s drain vs
   ~33k/core) is reachable in-place by cheaper means: serialize-once +
   multicast in the broadcast loop, a worker/cluster split, or an SFU-style
   fan-out tier for huddles — none of which require a new database, a BSL
   license, or a protocol shim.
3. **Adoption cost is a full protocol rewrite behind a shim + a license
   problem.** NIP-01 must be preserved, so every client WS still terminates
   in a Node shim doing per-subscriber sends (the very loop being replaced);
   tag-filter subscriptions hit the two-table-join edge, ephemeral tag
   filters and NIP-01 limit/prefix semantics don't map at all; sqlite (WAL,
   battle-tested, trivially backed up) is swapped for a commitlog+snapshot
   store; and BSL 1.1's one-production-instance grant is a poor fit for a
   multi-operator relay fleet until the 2031 AGPL conversion.

Where SpacetimeDB genuinely shines in these measurements — **persistent
write throughput (5,121 ev/s at 27.7% CPU vs 2,073 at 78%) and burst
absorption (10×)** — is real headroom for the >1k/s agent-writer future, but
the relay is not near that wall (2k/s today on 2 vCPUs with dev-mode writes),
and per-event costs upstream (payment, verify, connector) dominate long
before sqlite does. If that wall ever arrives, the cheaper first moves are a
write-batching POST surface and moving verify off the loop (already planned),
not a storage-engine replacement.

**POSSIBLE** (the mapping works, a shim could ship), but **NOT-PRACTICAL**
versus the relay + its planned cheap fixes. Two specific relay follow-ups
this prototype motivates regardless of SpacetimeDB:

- raise/parameterize `maxConnections` (stock default 100 makes >100
  listeners impossible — this bites long before any engine choice), and
- serialize-once broadcast (cache the `["EVENT",…]` JSON per event instead
  of stringifying per subscriber) — the relay's s500 run pinned its single
  core at 85% mostly doing N identical stringifies.

## Cost

$0 — everything local (docker + npm/cargo installs). No devnet, no funded
identities, no chain writes.
