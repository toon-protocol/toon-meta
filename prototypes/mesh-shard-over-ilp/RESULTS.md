# mesh-shard-over-ilp — can a pipeline-parallel LLM shard boundary ride TOON's paid wire?

**Date:** 2026-08-03 · **Host:** WSL2, Linux 6.6.114.1, 16 cores, 15 GB RAM, ext4 on `/dev/sdd` (WSL2 VHD, `data=ordered`), `/dev/shm` tmpfs
**Connector under test:** `/home/jonathan/Documents/connector` @ `59e167f2`, release build, real compiled `connector` binary in a real process
**Everything below is loopback. Nothing touched devnet. Nothing outside `prototypes/` was modified.**

---

## BOTTOM LINE

**The ~20.6 ms is not reproduced, and it was never one packet.** A real paid ILP packet — signed EIP‑712 claim, verified, journaled, gift‑wrap opened, delivered to a real HTTP app, fulfilment sealed and returned — costs **2.2 ms at p50 on loopback**, with a **5.2 ms mean** and a **75 ms p99**.

**What dominates it: one `fsync` per packet.** Not crypto, not encoding, not the socket.

| | 16 KB payload, p50 | share of paid path |
|---|---|---|
| loopback socket RTT (WS, measured) | 0.09 ms | 4% |
| free packet through the whole connector (no claim, no journal) | **0.39 ms** | 18% |
| add the claim: parse + ECDSA recover + watermark + durable write on **tmpfs** | **0.62 ms** | 28% (i.e. +0.23 ms for all payment crypto) |
| add the claim with the journal on **disk** | **2.22 ms** | 100% |
| ⇒ attributable to `fdatasync` alone | **1.60 ms p50 / ~4.6 ms mean / ~74 ms p99** | **72% of p50, 88% of the mean, 99% of the p99** |

Isolating the syscall confirms it: a bare `write()` to the journal file is **1.0 µs**; `write() + sync_data()` is **1 549 µs** — a **1 550×** step, and the single largest number anywhere in this prototype.

**Is it fixable?** Partly, and the unfixable part is exactly the part that bites pipeline decoding.

* The connector *already* has group commit (`GroupCommitter`, connector issue #686). It amortizes one fsync across every claim that arrived while the previous fsync was in flight — measured: **1 585 µs/entry at batch=1 → 7.7 µs/entry at batch=512**, a 206× improvement.
* **Group commit cannot help a pipeline shard boundary.** Pipeline-parallel decoding is a strictly sequential dependency chain: token *t*'s activation cannot be sent until token *t−1* came back. One in-flight packet per stream means batch size 1 forever. Measured directly: `gate.ingest` serial p50 **1.74 ms**, versus 3 300 claims/sec aggregate at 64 concurrent sessions.
* So the fsync floor is **structural for this workload** under ADR 0005's rule ("the journal is written before value is considered moved") **as long as one packet = one claim**. It is only removable by changing the *unit of payment* — one claim per K tokens, or a prepaid/bounded-exposure window with claims settled off the critical path — not by tuning the journal.
* Everything else on the path is small and would stay small: the whole payment crypto layer (ECDSA recover, claim JSON parse, EIP‑712 digest) is **0.23 ms**, and gift-wrap ECDH+ChaCha is already inside the 0.39 ms free-path baseline.

**Versus direct iroh QUIC** (the floor mesh-llm actually uses), at a 16 KB fp16 activation: iroh **0.26 ms** vs paid BTP **2.22 ms p50** — **8.4× at p50, 20× on the mean, 286× at p99**.

**And the payload question is a non-issue:** one paid ILP packet carried **15 MiB** end to end successfully (ceiling is ~16 MiB — 16 777 216 B resets the session). A 16 KB or 32 KB activation is ~1/1000th of the limit. There is no base64 armoring on the BTP payload path.

---

## 1. Why the prior ~20.6 ms number does not contradict this

The 20.6 ms/packet figure (2026‑07‑12, `swap-latency-measurement`) was measured on a **different thing**: the *rolling-swap protocol* driven through the **TypeScript** `toon-clientd` daemon's `POST /swap`, counting swap-protocol packets end to end (1 pkt 25.5 ms / 4 pkt 85.9 ms / 8 pkt 169.5 ms). That number bundles a JS runtime, the swap handshake, an ephemeral maker, per-swap key derivation and claim issuance — several claims and several journal writes per "packet".

This prototype measures the **connector's own paid-packet path in Rust**. Both can be true. What is now measured rather than assumed is *which layer the milliseconds live in*: the fsync, once per durable claim, ~1.5 ms typical and ~75 ms in the tail on this filesystem.

---

## 2. Tier 1 — per-packet cost breakdown

### 2.1 End-to-end, real connector process (`run3-e2e-btp.log`)

Four configurations of the same binary, so the payment layer is isolated by subtraction. n=300 serial round trips each; only *fulfilled* packets counted.

| case | 1 KB | 16 KB | 32 KB | 64 KB | 256 KB |
|---|---|---|---|---|---|
| **A** free, no journal | 0.332 | 0.390 | 0.449 | 0.567 | 1.559 |
| **B** free, journal armed | 0.341 | 0.399 | 0.437 | 0.547 | 1.657 |
| **C** **paid**, journal on disk | **2.171** | **2.216** | **2.255** | **2.375** | **3.339** |
| **D** paid, journal on `/dev/shm` | 0.573 | 0.615 | 0.668 | 0.770 | 1.602 |

(p50 in ms. Case C means: 5.53 / 5.20 / 5.06 / 5.90 / 6.83 ms. Case C p99: 75.2 / 75.2 / 74.3 / 74.1 / 73.6 ms.)

Read the columns as a causal ladder at 16 KB:

```
0.390 ms   free packet: WS frame → BTP parse → Prepare::decode → route match
           → giftwrap open_request (ECDH) → HTTP POST to the app on loopback
           → seal_response → Fulfill::encode → WS frame back
+0.009 ms   arming the journal, no claims flowing            (B − A, i.e. noise)
+0.225 ms   the entire payment layer minus durability        (D − B)
             = claim JSON parse + EIP-712 digest + ECDSA recover
               + watermark RwLock + group-commit enqueue + tmpfs write/sync
+1.601 ms   ONE fdatasync to a real filesystem               (C − D)  ← p50
+4.57  ms   ...on the mean
+73.4  ms   ...at p99
──────────
 2.216 ms   paid packet, p50
```

### 2.2 Component microbenches (`run1-decomposition.log`)

Same crates the connector runs, called directly.

**Crypto — small.**

| | p50 |
|---|---|
| `evm_balance_proof_digest` (3× Keccak, EIP‑712) | 2.7 µs |
| `libsecp256k1::sign` — client signs the claim | 72 µs |
| `libsecp256k1::recover` — connector verifies it | **131 µs** |
| build the signed claim JSON (client, per packet) | 115 µs |
| giftwrap `seal_request` 16 KB (ECDH + HKDF + ChaCha20) | 128 µs |
| giftwrap `open_request` 16 KB (connector, ECDH + decrypt) | 91 µs |
| giftwrap `seal_response` / `open_response` 16 KB (HKDF only, no 2nd ECDH) | 11 / 9 µs |

Total per-packet crypto on the connector ≈ **0.22 ms** (recover + ECDH + hashing), matching the D−B subtraction above almost exactly. None of it is offloaded to `spawn_blocking` — it runs inline on a tokio worker — but at 0.22 ms that is not the problem.

**ILP OER encode/decode — negligible.** `Prepare::encode` 1.2 µs at 16 KB, `decode` 4.2 µs; `Fulfill` 0.65 / 3.8 µs. Even at 64 KB the worst is 17 µs. Framing overhead is a flat **+72 bytes** on the wire regardless of payload. ADR 0023's canonical-length check re-encodes each varuint to compare (`connector-domain/src/oer.rs:57`), which allocates — visible in principle, invisible in practice.

**The journal — everything.**

| | p50 | p90 | p99 |
|---|---|---|---|
| raw `write()`, no fsync | **1.0 µs** | 1.0 µs | 3.5 µs |
| raw `write()` + `sync_data()` | **1 549 µs** | 1 888 µs | 74 183 µs |
| `FileJournal::append` (one entry, one fsync) | 1 592 µs | 2 015 µs | 71 080 µs |
| `append_batch` batch=1, per entry | 1 585 µs | | |
| `append_batch` batch=8, per entry | 205 µs | | |
| `append_batch` batch=64, per entry | 31 µs | | |
| `append_batch` batch=512, per entry | **7.7 µs** | | |

**`ClientClaimGate::ingest` — the full admission path:**

| | p50 | mean | p99 | aggregate |
|---|---|---|---|---|
| SERIAL, 1 session (**the pipeline shape**) | **1.74 ms** | 4.24 ms | 73.7 ms | ~230 claims/s |
| CONCURRENT, 8 sessions | 3.09 ms | 6.77 ms | 75.0 ms | 1 154 claims/s |
| CONCURRENT, 64 sessions | 6.02 ms | 19.2 ms | 104.6 ms | 3 300 claims/s |
| SERIAL, `InMemoryJournal` (no fsync at all) | **0.189 ms** | 0.197 ms | 0.295 ms | ~5 300 claims/s |

The last row is the punchline in one line: **remove durability and the claim gate is 9× faster and its tail collapses from 74 ms to 0.3 ms.**

The connector's own `claim_gate_throughput` measurement (which exists in-repo precisely because "the fsync floor is the whole subject") reproduces this independently: 203 claims/sec at 1 session, 11 138 at 64.

### 2.3 What the fsync tail actually is

~1–2 % of `fdatasync` calls take **~71–75 ms** on this box. That is the ext4 jbd2 transaction commit on a WSL2 VHD: most fsyncs land inside an open transaction, and the unlucky ones block behind a full journal commit. It is a **filesystem artifact, not a connector bug** — but it is a *class* of artifact that exists on every journaling filesystem, and it is entirely invisible until you put a synchronous durability barrier on a latency-critical path. On a laptop NVMe expect a better p50 (~0.2–1 ms) and a smaller but non-zero tail; on a cloud network-attached volume expect worse. **This p50/p99 gap is modelled forward below, not extrapolated to other hardware.**

### 2.4 Suspects tested and cleared

* **Nagle / `TCP_NODELAY`.** The connector never calls `set_nodelay` anywhere (hyper's `AddrIncoming` defaults it off; the peer wire's `TcpStream`s likewise). I measured it directly: on strict loopback ping-pong, Nagle on vs off is **within noise at every size** (48.6 vs 48.6 µs at 64 B). It is a latent hazard for the peer wire — which does **four** separate `write()` syscalls per frame (`connector-runtime/src/peer_wire.rs:41-44`) and *would* trigger the classic Nagle × delayed-ACK interaction over a real network — but it is **not** where the ms went here.
* **NIP‑44 / NIP‑59 gift-wrapped claims.** Not on the BTP path at all — `btp.rs` reads the `payment-channel-claim` protocolData as raw UTF‑8 JSON. `unwrap_claim` is reachable only from the HTTP carriage's `ilp-payment-channel-claim-wrapped` header. A client using that header adds a second ECDH+ChaCha per packet.
* **ADR 0018 gift-wrap sealing.** On the path, but only at the *terminating* hop, and it costs 91 µs (open) + 11 µs (seal response). A pure forwarding hop never opens the wrap.
* **Sleeps / debounce / poll intervals.** One real sleep is reachable (`lookup_budget.rs:539`, up to 2 s) but only for a *cold, unresolved* channel; a declared channel never reaches it. No timer-based batching on the packet path — the group-commit window is "one fsync duration", not a fixed interval.
* **OER encode/decode.** Microseconds. Not it.
* **Socket time.** 0.09 ms at 16 KB. 4 % of the paid packet.

### 2.5 Structural hazards found by reading, not measured here

Worth flagging because they bite a *multi-hop* shard chain rather than the single-hop case I measured:

* **The peer-wire journal has no group commit.** `ClaimBook::append_and_project` calls `FileJournal::append` (unbatched `sync_data`) up to three times per forwarded packet — `OutboundClaimSigned`, `InboundFulfillmentRecorded`, `InboundClaimAccepted` — from a *sync* fn called inside an `async` fn, with no `spawn_blocking`, and the `OutboundClaimSigned` one happens **while holding the `outbound` `RwLock` write guard**. On the numbers above that is ~1.6 ms × up to 3 per intermediate hop, serialized across all peers.
* **One packet in flight per peer.** `PeerConnection` holds a `tokio::sync::Mutex<Option<TcpStream>>` across both `write_frame().await` and `read_frame().await`, so a peer link is full lockstep with zero pipelining. Per-hop latency is a full RTT and cannot be overlapped.
* **BTP session window = 16.** Once 16 frames are in flight on a session the read loop stalls. Irrelevant to sequential pipeline decode (in-flight = 1), relevant to batched serving.

---

## 3. Tier 2 — payload sizes and limits

### 3.1 The ceiling is ~16 MiB, not 64 KB (`run4-payload-ceiling.log`)

Measured by pushing a single paid packet end to end:

| payload | result |
|---|---|
| 256 KB | ✅ paid p50 3.34 ms |
| 512 KB | ✅ paid p50 5.23 ms |
| 1 MiB | ✅ paid p50 8.92 ms |
| 4 MiB | ✅ paid p50 10.7 ms |
| 8 MiB | ✅ paid p50 19.1 ms |
| 12 MiB | ✅ paid p50 47.3 ms |
| 15 MiB | ✅ paid p50 55.7 ms |
| **16 MiB** | ❌ `ConnectionReset` — session torn down |

So the binding limit is a websocket frame ceiling right at 16 MiB (axum/tungstenite's default max frame size), **not** buzz's `MAX_CONTENT_BYTES = 65536` or `BUZZ_MAX_FRAME_BYTES = 262144` — those are buzz-relay application limits and do not apply to the connector path. The connector's own peer wire declares `MAX_FRAME_LEN = 16 MiB` independently (`peer_wire.rs:25`), consistent with what I observed.

**An fp16 activation is nowhere near this.** 16 KB (hidden dim 8192) is 0.1 % of the ceiling; 32 KB (hidden dim 16384) is 0.2 %.

### 3.2 Scaling with payload size

Latency is nearly flat across the sizes that matter, because the constant dominates:

| payload | free (A) | paid, disk (C) | paid, tmpfs (D) | iroh |
|---|---|---|---|---|
| 1 KB | 0.332 | 2.171 | 0.573 | 0.153 |
| **16 KB** (70B-class) | 0.390 | **2.216** | 0.615 | **0.263** |
| **32 KB** (405B-class) | 0.449 | **2.255** | 0.668 | **0.347** |
| 64 KB | 0.567 | 2.375 | 0.770 | 0.445 |

Going 1 KB → 32 KB costs **+0.084 ms** on the paid path. Going tmpfs → disk costs **+1.60 ms**. **Payload size is 5 % of the story; durability is 95 %.**

### 3.3 Wire expansion — no armoring, small fixed overheads

* ILP OER `Prepare` framing: **+72 bytes**, flat.
* ADR 0018 gift-wrap request: **+126 bytes** (type byte + 65-byte ephemeral pubkey + 32-byte shared secret + 16-byte Poly1305 tag + nonce), flat at every size.
* Gift-wrap response: **+29 bytes**, flat.
* **No base64/hex expansion on the payload.** `Prepare.data` is raw binary and BTP carries it as a binary websocket frame. (The claim JSON *is* text and *is* hex-encoded internally — ~590 bytes per packet of protocolData — but it is fixed-size and does not scale with the activation.)

So a 16 KB activation puts **16 582 bytes** on the wire (16 384 + 126 gift-wrap + 72 ILP). 1.2 % overhead.

---

## 4. Tier 3 — direct iroh QUIC baseline (`run5-iroh-quic.log`)

Two iroh endpoints in one process, `RelayMode::Disabled`, explicit direct loopback address, **one reused bidirectional stream** for every round trip — the shape a shard boundary would actually use. iroh resolved to **1.0.3** (buzz pins 1.0.2; the crate is API-compatible for this benchmark and the difference is immaterial to a loopback RTT).

Cold connect (QUIC + TLS handshake): **1.96 ms**, once.

| payload | iroh QUIC p50 | paid BTP p50 | ratio p50 | paid BTP mean | ratio mean | paid BTP p99 | ratio p99 |
|---|---|---|---|---|---|---|---|
| 64 B | 0.151 | — | — | — | — | — | — |
| 1 KB | 0.153 | 2.171 | **14.2×** | 5.53 | 36× | 75.2 | 492× |
| **16 KB** | **0.263** | **2.216** | **8.4×** | 5.20 | **20×** | 75.2 | **286×** |
| **32 KB** | **0.347** | **2.255** | **6.5×** | 5.06 | 15× | 74.3 | 214× |
| 64 KB | 0.445 | 2.375 | 5.3× | 5.90 | 13× | 74.1 | 166× |
| 256 KB | 1.209 | 3.339 | 2.8× | 6.83 | 5.6× | 73.6 | 61× |

Against the *tmpfs* paid path (the "fsync-free" counterfactual) the ratio at 16 KB is only **2.3×** — i.e. **if the durability barrier were removed from the per-token critical path, the paid wire would be within ~2–3× of raw iroh QUIC.** That is the single most important number for the epic's design space.

Note also: iroh QUIC is itself ~2–3× the raw loopback WS RTT (0.263 vs 0.093 ms at 16 KB) — QUIC's userspace crypto and congestion control are not free either.

---

## 5. Tier 4 — what mesh-llm actually does

mesh-llm v0.74.0 source (`~/.cargo/git/checkouts/mesh-llm-4d3232f868c7e3bb/e60b2fe`, matching buzz's `Cargo.lock`) was read directly. No build was attempted — this is WSL2 with no usable GPU, and reading the wire format was worth more than a failed build.

**It does shard across machines — pipeline-parallel only, no tensor parallelism** (`crates/skippy-topology/src/planning.rs:57-71` carves contiguous layer ranges; a grep for `tensor.parallel` across all Rust code returns zero hits; `docs/EXO_COMPARISON.md:158-165` states it explicitly).

Facts that bear directly on the question:

* **Crossing frequency: one activation frame per stage boundary per decoded token.** Chain is `stage0 → stage1 → … → final`, each hop awaiting a reply. (The docs' claim of "zero inter-device communication during decode" is contradicted by the code.)
* **What crosses: hidden-state activation tensors**, token-major `[token_count, n_embd]`, **default dtype F16**. KV cache stays stage-local and never crosses during decode.
* **Size per decode crossing:** `76 + n_embd × 2` bytes. n_embd 4096 → **~8.2 KB**; n_embd 8192 → **~16.4 KB**. Reply is **~230 bytes**. Prefill chunks are much larger: 128–384 tokens × n_embd × 2 ≈ **1–3 MB per chunk**.
* **Transport: iroh QUIC bidirectional streams, long-lived and reused** — one bi-stream per bridged link, all messages written sequentially into it. No datagrams. `set_nodelay(true)` on the local TCP legs.
* **It assumes a LAN, and enforces it.** `MAX_SPLIT_RTT_MS = 80` — a peer above 80 ms RTT is *ineligible* to host a split stage, and relay-only paths are rejected outright (direct QUIC path required). `DEFAULT_TARGET_DECODE_TPOT_MS = 33`. Its own planner cost model is literally `estimate_decode_network_ms_per_token = max_hop_latency_ms × node_count` (`skippy-coordinator/src/topology.rs:473-479`) — an explicit acknowledgement that per-hop latency multiplies by shard count, every token.
* Decode-frame batching exists but **defaults to disabled** (`SKIPPY_DECODE_BATCH_COLLECTION_US` = 0, capped at 10 ms).

**The confrontation:** mesh-llm's own budget allows `33 ms ÷ N` per hop to hit its default TPOT target. At N=8 that is **4.1 ms per crossing**. Paid BTP at p50 (2.2 ms) fits. Paid BTP on the *mean* (5.2 ms) does not. Paid BTP at p99 (75 ms) is 18× over the per-hop budget and would on its own trip the 80 ms ineligibility gate.

---

## 6. Extrapolation: N shards, a 500-token reply

**Modelled, from measured per-crossing latencies.** Crossings = `(N−1) × 500`. Latency added = `crossings × L`. The tok/s column is an **upper bound that assumes zero model compute** — it isolates the wire+payment cost; real tok/s will be lower.

Per-crossing latency `L` used (all measured at 16 KB, this box):

| variant | L |
|---|---|
| direct iroh QUIC | 0.263 ms |
| paid BTP, journal on tmpfs (fsync-free counterfactual) | 0.615 ms |
| paid BTP, journal on disk — p50 | 2.216 ms |
| paid BTP, journal on disk — mean | 5.199 ms |

### Latency

| N | crossings (500 tok) | iroh | paid, tmpfs | paid, disk p50 | paid, disk mean |
|---|---|---|---|---|---|
| **2** | 500 | 0.13 s · ≤3 802 tok/s | 0.31 s · ≤1 626 | **1.11 s · ≤451** | 2.60 s · ≤192 |
| **4** | 1 500 | 0.39 s · ≤1 267 | 0.92 s · ≤542 | **3.32 s · ≤150** | 7.80 s · ≤64 |
| **8** | 3 500 | 0.92 s · ≤543 | 2.15 s · ≤232 | **7.76 s · ≤64** | 18.20 s · ≤27 |

Read the N=8 disk row as: **7.8 seconds of pure payment-and-transport overhead added to a single 500-token reply**, before the model does any arithmetic — and 18.2 s if you weight by the mean rather than the median. On direct iroh the same figure is 0.92 s.

### Fees

At 1 µUSDC and at 0.001 µUSDC per packet:

| N | crossings | @ 1 µUSDC/pkt | @ 0.001 µUSDC/pkt |
|---|---|---|---|
| 2 | 500 | 500 µUSDC = **$0.000500** | 0.5 µUSDC = $0.0000005 |
| 4 | 1 500 | 1 500 µUSDC = **$0.001500** | 1.5 µUSDC = $0.0000015 |
| 8 | 3 500 | 3 500 µUSDC = **$0.003500** | 3.5 µUSDC = $0.0000035 |

For scale: at 1 µUSDC/packet, N=8 costs **$3.50 per thousand 500-token replies**. That is *cheap* — comparable to or below hosted-inference token pricing. **Money is not the problem here. Latency is.** (For reference, devnet's live announced route price is 1000 base units = 1000 µUSDC = $0.001 per packet, which at N=8 would be **$3.50 per single reply** — that price point is a non-starter and would have to come down ~1000× for this to make sense.)

---

## 7. Verdict on the design question

* **Payload size: not a blocker.** 16 KB / 32 KB activations are ~0.1 % of a ~16 MiB ceiling, and latency is nearly flat from 1 KB to 64 KB. Wire overhead is +198 bytes fixed (72 ILP + 126 gift-wrap) with no armoring expansion.
* **Fees: not a blocker at a sane price** (≤1 µUSDC/packet). A blocker at devnet's current 1000 µUSDC/packet.
* **Latency: the blocker, and it is 88 % one `fdatasync`.** Paid BTP is 8.4× direct iroh at p50 and 286× at p99 for the exact message size mesh-llm sends.
* **The tail is worse than the median and matters more.** Pipeline decode has no slack: every crossing is on the critical path, so a 1–2 % chance of a 75 ms stall per crossing means, at N=8 × 500 tokens = 3 500 crossings, **essentially every reply hits dozens of them**. Expected added time from the tail alone at 1.5 % × 73 ms × 3 500 ≈ **3.8 s per reply**. Tail latency is not a footnote in a sequential chain; it is the dominant term.
* **The fix is architectural, not a tuning knob.** Group commit already exists and already works (206× at batch 512) — it simply has nothing to batch against when the workload is one sequential stream. The lever is to **decouple the payment unit from the packet unit**: one claim per K tokens, or a bounded-exposure prepaid window, with claims journaled off the critical path. The tmpfs row is the measured evidence of the prize: **0.62 ms, within 2.3× of raw iroh.**
* **A separate structural hazard for multi-hop chains:** the peer-wire journal (used on *forwarding* hops, as opposed to the client-edge one I measured) has **no group commit at all** and fsyncs up to three times per forwarded packet, from a sync fn on a tokio worker, once of them under a global write lock. Any topology where the shard hop crosses two connectors rather than terminating at one would be materially worse than the numbers above.

---

## 8. What I could not measure, and why

1. **A real sharded LLM.** mesh-llm was not built and no weights were downloaded — WSL2 box, no usable GPU, and the task explicitly deprioritized this. Everything in §5 is from reading v0.74.0 source, with file:line evidence, not from running it. **The 8.2/16.4 KB activation sizes are computed from mesh-llm's own size formula, not observed on a wire.**
2. **A multi-connector (forwarding) hop.** Every e2e number is a *single* connector terminating at a local HTTP app. The peer-wire path's unbatched triple fsync (§2.5) is read from code and priced using my measured `FileJournal::append` number — **modelled, not measured**.
3. **`strace`/`perf` syscall counts.** Neither is installed and there is no passwordless sudo on this box. I substituted a direct A/B: the same code path with the journal on ext4 vs on tmpfs, plus an isolated `write()` vs `write()+sync_data()` microbench. That answers the same question more directly than a syscall histogram would have.
4. **Real settlement.** No on-chain settlement was exercised (no anvil deployment, no chain reads — `[[client_channels]]` were declared in config with `DepositFloor::Unknown`). All numbers are **off-chain claim latency only**. On-chain settlement is off the per-packet critical path by design, but this prototype proves nothing about it.
5. **Other hardware.** Every fsync number is this box's ext4-on-WSL2-VHD. A laptop NVMe will have a better p50 and a smaller tail; a cloud network volume will be worse. **The p50/p99 gap is the thing to carry forward, not the absolute 1.6 ms.**
6. **WAN behaviour.** All loopback. Adding real network RTT adds equally to *both* the iroh and BTP columns, so the *ratios* above are the pessimistic case for BTP and the *absolute* numbers are the optimistic case for both. Nagle (§2.4) is cleared on loopback but untested over a real link, where the peer wire's 4-writes-per-frame pattern is a genuine hazard.
7. **Client-side signing cost in the real client.** The paying client in production is TypeScript (`@toon-protocol/client`). I measured Rust `libsecp256k1::sign` at 72 µs; the JS equivalent will be slower, and that cost is on the sender's critical path too. **Not measured.**

---

## 9. Files

| file | what |
|---|---|
| `run1-decomposition.log` | component microbenches: crypto, journal/fsync, claim gate, OER, gift-wrap |
| `run2-transport-floor.log` | loopback TCP (nodelay on/off) and WebSocket RTT, no payment layer |
| `run3-e2e-btp.log` | **the headline run** — paid BTP round trips vs a real connector process, 4 configs × 6 payload sizes |
| `run4-payload-ceiling.log` | payload ceiling probe, 512 KB → 64 MiB |
| `run5-iroh-quic.log` | Tier 3 direct iroh QUIC baseline |
| `bench/src/main.rs` | component bench (`cargo run --release -- all`) |
| `bench/src/bin/e2e.rs` | end-to-end harness (`cargo run --release --bin e2e -- <iters> <sizes...>`) |
| `bench/src/bin/transport.rs` | loopback TCP/WS floor |
| `bench/src/bin/iroh_rtt.rs` | iroh QUIC floor |

To re-run: build the connector's `connector` and `stub-app` binaries in release
(`cd ~/Documents/connector && cargo build --release --bin connector --bin stub-app`),
then `cd bench && cargo run --release --bin e2e`.
The bench crate is its own workspace with path deps into the connector repo; it reads that repo but never writes to it.

---
---

## FOLLOW-UP ROUND — does a prepaid window make pipeline sharding fit?

**Date:** 2026-08-03 (same box, same connector rev `59e167f2`, same rules: loopback only, nothing live, nothing modified outside `prototypes/`.)
New logs: `run6-window-dist.log`, `run7-iroh-dist.log`, `run8-apphop.log`. New harness: `bench/src/bin/e2e.rs` (`dist` mode), `bench/src/bin/apphop.rs`, extended `bench/src/bin/iroh_rtt.rs`.

## BOTTOM LINE

**Yes — with a prepaid window, pipeline-sharded inference over BTP fits inside mesh-llm's own latency gate on a wired LAN at every N up to 8 with a 6–7× margin, and still fits on WiFi at N=8 with almost none; paid-per-packet fits at p50 but is killed by its own fsync tail.** The window's measured per-crossing cost is **0.371 ms p50 / 0.498 ms p99 / 0.610 ms p99.9** at a 16 460 B activation, against mesh-llm's own budget of **4.125 ms per hop at N=8**.

Three supporting facts, all measured:

1. **The tail does collapse, completely.** In-window p99 is **0.498 ms** versus paid-per-packet's **2.59–75.2 ms** — up to a **151×** tail improvement — and in-window p99.9 (0.610 ms) is *below* the paid path's p50 (2.03 ms).
2. **What remains at the in-window tail is not the connector.** 93–102 % of the p50→p99.9 growth is accounted for by the two loopback socket legs' own OS/scheduling tail. The connector's own compute contributes **zero measurable tail** (see §F3).
3. **A prepaid window cannot be expressed today** — but the missing piece is one branch and one counter, and the *wire protocol already permits it* (§F2).

---

## F1. Can a prepaid window be expressed today? — **No, and here is exactly why**

**It cannot.** `crates/connector-client-edge/src/btp.rs:474`:

```rust
if claim_json.is_none() && price > 0 {
    // ... F06 "No payment channel claim attached"
```

Every packet on a priced route must carry its own claim, and every admitted claim goes through `ClientClaimGate::admit` → group-commit → **one durable `fdatasync` before service is rendered** (ADR 0005). There is no credit, balance, or window concept anywhere in `connector-client-edge` — a grep for `prepaid|credit|surplus` finds only unrelated prose.

**But the wire protocol already allows overpayment.** `connector-domain/src/claim.rs:84-95`:

```rust
let advanced = cumulative_amount.saturating_sub(prior);
if advanced < price { return Err(ClaimError::Underpayment { advanced, price }); }
```

A claim advancing by *more* than `price` is **accepted**, and the watermark moves to the full amount — the buyer is charged the surplus and receives nothing for it. So today, overpaying is possible and simply burns money: the connector refuses to bank it.

### The smallest change that would express a window

1. Add a per-channel `credit: AtomicU64` beside the watermark. On admitting a claim, `credit += advanced − price` (the surplus `validate_price` already lets through).
2. At `btp.rs:474`, before the F06 reject: if `credit >= price`, `fetch_sub(price)` and fall through with `admitted = None`.
3. Report remaining credit back to the client (the F06 greeting already carries an x402 terms blob; one more field).

**No protocol change, no new claim type, no settlement change.** Crash exposure is bounded and self-limiting in the safe direction: the in-memory `credit` is lost on restart, so it reverts to the last *journaled* watermark — the buyer's paid-for-but-unspent credit is restored, and the connector eats at most one window of already-rendered service.

### What I actually measured, therefore

**A price=0 route with claimless packets** — the free path. This is not a loose analogy: after the change above, an in-window packet takes **the identical code path**. `claim_json.is_none() && price > 0` is false in both cases, `admitted` is `None` in both cases, and `finish_frame` runs identically. The only difference a real window adds is one uncontended atomic compare-and-decrement — **estimated** at 5–20 ns, i.e. ~0.005 % of the measured 0.371 ms. *(That 5–20 ns is an estimate from general knowledge of atomics; it is the only unmeasured number in this section.)*

**Labelled clearly: every "in-window" number below is the free-path proxy, not a built prepaid window.**

---

## F2. Full distributions at mesh-llm's real activation sizes (`run6-window-dist.log`, `run7-iroh-dist.log`)

Payload sizes are mesh-llm's own decode frame, `76 + n_embd × 2` bytes, F16: **8 268 B** (n_embd 4096) and **16 460 B** (n_embd 8192). n = 20 000 per case for the in-window and iroh paths (so p99.9 is 20 samples deep); n = 3 000 for the paid path.

### 8 268 B (n_embd 4096)

| path | p50 | p90 | p99 | **p99.9** | max | mean |
|---|---|---|---|---|---|---|
| direct iroh QUIC | 0.166 | 0.198 | 0.252 | **0.320** | 0.518 | 0.170 |
| **in-window BTP** (proxy) | 0.351 | 0.385 | 0.471 | **0.541** | 3.125 | 0.358 |
| paid-per-packet BTP | 2.086 | 2.437 | 74.336 | **75.493** | 75.951 | 6.361 |
| *control: raw WS echo* | 0.071 | 0.090 | 0.119 | 0.152 | 0.275 | 0.075 |
| *control: connector→app HTTP leg* | 0.071 | 0.087 | 0.116 | 0.167 | 0.296 | 0.073 |

### 16 460 B (n_embd 8192)

| path | p50 | p90 | p99 | **p99.9** | max | mean |
|---|---|---|---|---|---|---|
| direct iroh QUIC | 0.207 | 0.244 | 0.313 | **0.415** | 1.067 | 0.212 |
| **in-window BTP** (proxy) | 0.371 | 0.410 | 0.498 | **0.610** | 1.121 | 0.379 |
| paid-per-packet BTP | 2.029 | 2.161 | 2.592 | **6.687** | 71.410 | 2.108 |
| *control: raw WS echo* | 0.082 | 0.102 | 0.138 | 0.217 | 0.325 | 0.086 |
| *control: connector→app HTTP leg* | 0.073 | 0.089 | 0.118 | 0.183 | 0.336 | 0.076 |

All in ms.

**The tail collapse is the headline.** At 8 268 B the p99 goes from **74.3 ms (paid) to 0.471 ms (in-window)** — **158×**. At 16 460 B this particular paid run got lucky on filesystem state (p99 2.59 ms) but still shows a 71.4 ms max; the earlier `run3` at nearly the same size measured p99 = 75.2 ms.

**Honest caveat on the paid tail: its magnitude is stable, its frequency is not.** The stall is always ~71–76 ms (an ext4 jbd2 transaction commit). How *often* a packet lands in one varied across runs from roughly 0.03 % to 2 %, depending on filesystem state. **Below I use the worst observed p99 (75.2 ms) for gate checks and flag it as worst-observed, not typical.**

### In-window vs iroh, like-for-like at every percentile

| | p50 | p90 | p99 | p99.9 |
|---|---|---|---|---|
| ratio @ 8 268 B | **2.11×** | 1.95× | 1.87× | **1.69×** |
| ratio @ 16 460 B | **1.80×** | 1.68× | 1.59× | **1.47×** |

**The ratio gets *better* at the tail, not worse** — the opposite of the paid path, where the ratio at p99 was 286×. In-window BTP is a constant ~0.18–0.19 ms additive overhead on top of iroh, not a multiplicative one.

---

## F3. What remains at the in-window tail — measured attribution

The in-window path crosses **two** loopback sockets: client→connector (websocket) and connector→app (HTTP). I measured each in isolation (`run8-apphop.log` and the WS-echo control) at the same sizes and the same n = 20 000.

Decomposing the p50→p99.9 *growth* — i.e. the tail itself — at 16 460 B:

| | p50 | p99.9 | tail growth |
|---|---|---|---|
| client↔connector WS leg | 0.082 | 0.217 | +0.135 |
| connector↔app HTTP leg | 0.073 | 0.183 | +0.109 |
| **sum of the two legs** | 0.155 | 0.400 | **+0.245** |
| **whole in-window path** | 0.371 | 0.610 | **+0.239** |
| ⇒ connector's own compute | 0.216 | 0.210 | **−0.006 (zero)** |

Same decomposition at 8 268 B: legs contribute +0.177 of the +0.191 observed growth — **93 %**.

**Conclusion: the in-window tail is entirely the two loopback sockets' own OS scheduling and TCP behaviour. It is not allocation, not tokio task-spawn, not WS framing, not gift-wrap crypto — the connector's ~0.216 ms of compute is flat from p50 to p99.9.** That compute is itself accounted for by the components measured in §2.2 (gift-wrap `open_request` ECDH ≈ 91 µs, `seal_response` ≈ 11 µs, OER encode/decode ≈ 5 µs, plus BTP parse, hyper client and one `tokio::spawn` hop).

This is a much healthier shape than the paid path, whose tail was one enormous bimodal spike. **Nothing here would get worse under load in the way an fsync does.**

---

## F4. Against mesh-llm's own gate

mesh-llm's planner: `estimate_decode_network_ms_per_token = max_hop_latency_ms × node_count`, checked against `TARGET_DECODE_TPOT_MS = 33`; separately `MAX_SPLIT_RTT_MS = 80` makes a peer *ineligible* to host a split stage at all. So the per-hop budget is **33 / N ms**, and the hard gate is **< 80 ms**.

Payload 16 460 B. Crossings for a 500-token reply = (N−1) × 500. tok/s is a **network-only upper bound assuming zero model compute** — it isolates wire cost; real tok/s is lower.

| N | budget (33/N) | path | per-hop (measured) | passes budget? | passes 80 ms gate? | tok/s ceiling | added s / 500 tok |
|---|---|---|---|---|---|---|---|
| **2** | 16.5 ms | (a) iroh p50 | 0.207 | ✅ | ✅ | 4 831 | 0.10 |
| | | (c) **window** p50 / p99.9 | 0.371 / 0.610 | ✅ | ✅ | 2 696 / 1 639 | 0.19 / 0.31 |
| | | (b) paid p50 | 2.029 | ✅ | ✅ | 493 | 1.01 |
| | | (b) paid p99 *(worst obs.)* | 75.2 | ❌ | ⚠️ 75.2 < 80, no margin | 13 | 37.6 |
| **4** | 8.25 ms | (a) iroh p50 | 0.207 | ✅ | ✅ | 1 613 | 0.31 |
| | | (c) **window** p50 / p99.9 | 0.371 / 0.610 | ✅ | ✅ | 899 / 546 | 0.56 / 0.92 |
| | | (b) paid p50 | 2.029 | ✅ | ✅ | 164 | 3.04 |
| | | (b) paid p99 *(worst obs.)* | 75.2 | ❌ | ⚠️ | 4.4 | 112.8 |
| **8** | 4.125 ms | (a) iroh p50 | 0.207 | ✅ (20× margin) | ✅ | 692 | 0.72 |
| | | (c) **window** p50 / p99.9 | 0.371 / 0.610 | ✅ (**6.8×/2.5× margin**) | ✅ | 385 / 234 | 1.30 / 2.13 |
| | | (b) paid p50 | 2.029 | ✅ (2.0× margin) | ✅ | 70 | 7.10 |
| | | (b) paid p99.9 | 6.687 | ❌ | ✅ | 21 | 23.4 |
| | | (b) paid p99 *(worst obs.)* | 75.2 | ❌ | ⚠️ | 1.9 | 263 |

**Read on loopback:** everything passes at p50, even paid-per-packet. **The decision is made entirely at the tail** — and the paid path's tail is 99 % fsync. Prepaid-window passes at *every percentile at every N*, with 6.8× margin at p50 and 2.5× at p99.9 for N=8.

---

## F5. Cost with windowing — N=8, 500 tokens (3 500 crossings), 1 µUSDC/packet

Window `W` = crossings served per paid packet. Paid packets = ⌈3500 / W⌉.

| W | paid packets | **USDC / 500-tok reply** | fsync amortized per crossing | measured+amortized per-hop p50 | max at risk on a crash |
|---|---|---|---|---|---|
| **1** (today) | 3 500 | **$0.003500** | 1.658 ms | 2.029 ms | $0.000001 |
| **100** | 35 | **$0.000035** | 0.0166 ms | 0.388 ms | $0.000100 |
| **1 000** | 4 | **$0.000004** | 0.0017 ms | 0.373 ms | $0.001000 |
| **10 000** | 1 | **$0.000001** | 0.0002 ms | 0.371 ms | $0.010000 |

*(Amortized per-hop = measured in-window p50 0.371 ms + measured fsync delta 1.658 ms ÷ W. The fsync delta is the measured paid−in-window difference at 16 460 B.)*

**Crash exposure is negligible at every useful window size.** At W = 10 000, one full window is **1 ¢**. The direction of the loss is the connector's: on restart the in-memory credit reverts to the last journaled watermark, so the buyer's unspent credit is restored and the connector eats up to one window of service it already rendered. (If instead the connector crashes holding an unspent prepayment, the buyer's exposure is the same ≤1 ¢, recoverable on-chain from the journaled claim.)

**W = 100 already captures 99 % of the available latency win** (2.029 → 0.388 ms) and caps exposure at $0.0001. There is no reason to go past W ≈ 1 000.

---

## F6. LAN reality check — **MODELLED, not measured** (netem unavailable)

`tc` is installed but `tc qdisc add dev lo root netem` returns `RTNETLINK answers: Operation not permitted` — no `CAP_NET_ADMIN`, no passwordless sudo on this box. **I could not inject synthetic delay, so this whole section is modelled from measured loopback numbers plus assumed LAN RTTs. Treat every number in it as modelled.**

### The leg-count question, and why it is *not* 2× as feared

The concern was that BTP takes two network legs (client→connector→client) where iroh takes one. **In TOON's actual deployment model it does not.** Apps run the connector image as their own front payment proxy (relay and store both ship `deploy/docker-compose.yml` = connector + that app; the `apps-on-connector-image` pattern). So a shard boundary is:

```
shard A  --LAN-->  connector (sidecar on B's box)  --loopback-->  shard B
```

**One network leg, same as iroh.** That is precisely the topology I measured: connector and stub-app on one box, client over a socket. The second leg is loopback and is already inside the 0.371 ms.

If instead the connector is a *standalone* box between the shards, it is two network legs and the model below must add `2 × R` to BTP while iroh adds `1 × R`. **That deployment choice, not the protocol, is what decides whether the LAN penalty is 1× or 2×.**

### Modelled, sidecar topology (add one LAN RTT `R` to both paths)

| | wired GbE (R = 0.3 ms) | | WiFi (R = 3 ms) | |
|---|---|---|---|---|
| **N=8, budget 4.125 ms** | per-hop | verdict | per-hop | verdict |
| (a) iroh p50 | 0.507 | ✅ | 3.21 | ✅ |
| (c) **window** p50 | **0.671** | ✅ | **3.37** | ✅ |
| (c) **window** p99.9 | **0.910** | ✅ | **3.61** | ✅ (13 % margin) |
| (b) paid p50 | 2.329 | ✅ | 5.03 | ❌ |
| (b) paid p99.9 | 6.99 | ❌ | 9.69 | ❌ |

*R values are assumptions, not measurements: 0.3 ms is a conventional wired GbE ping RTT, 3 ms a conventional 802.11ac one. Substitute your own.*

**The additive LAN term compresses the iroh-vs-BTP ratio rather than widening it** — at R = 3 ms the window path is only **1.05×** iroh, because both pay the same network. On WiFi at N=8, prepaid-window fits with ~13 % margin and paid-per-packet fails outright. **On WiFi at N=8 the window is the difference between fitting and not fitting.**

**What this section does *not* establish:** real LAN jitter. A WiFi link's own p99.9 can be 10–50× its p50, and that variance would land on *both* paths and could blow the N=8 budget regardless of which one you pick. mesh-llm's `MAX_SPLIT_RTT_MS = 80` gate exists exactly because of this. **Unmeasured and it matters — this is the largest remaining open question.**

---

## F7. Answer, and what would change it

> **With a prepaid window, does pipeline-sharded inference over BTP fit inside mesh-llm's own latency gate on a LAN?**
>
> **Yes, on wired LAN up to at least N=8 with 6.8× margin at p50 and 2.5× at p99.9; yes on WiFi at N=8 but with only ~13 % margin (modelled); and the window is what makes the difference — paid-per-packet fails on its fsync tail at every N.**

Qualifications, in order of how much they could move the answer:

1. **Real LAN jitter is unmeasured** (§F6). It applies to iroh equally, so it does not change the *choice*, but it could change whether N=8 sharding is viable **at all** on WiFi — which is mesh-llm's own concern, not TOON's.
2. **The window is not built.** Everything in F2–F5 measures the free path as a stand-in for a one-branch-plus-one-counter change that does not exist yet (§F1). If that change turns out to require touching the gate's locking, the numbers move.
3. **Single-hop only.** If a shard boundary ever crosses *two* connectors, the peer-wire journal's unbatched triple fsync (§2.5) applies and has no group commit at all — a window at the client edge would not fix it.
4. **Compute is excluded.** Every tok/s figure is a network-only ceiling. Real pipeline decode adds per-stage GPU time, which is the actual dominant term in a working system and which this prototype says nothing about.
5. **One box, one filesystem, one run each.** The paid path's tail frequency varied ~60× across runs (§F2).

### New logs

| file | what |
|---|---|
| `run6-window-dist.log` | in-window vs paid full distributions, n=20 000, at 8 268 B and 16 460 B, with raw WS echo control |
| `run7-iroh-dist.log` | iroh QUIC full distributions, n=20 000, same sizes plus the original sweep |
| `run8-apphop.log` | connector→app loopback HTTP leg in isolation (tail attribution) |

Re-run: `cd bench && cargo run --release --bin e2e -- dist 20000`, `cargo run --release --bin iroh_rtt 20000`, `cargo run --release --bin apphop 20000`.
