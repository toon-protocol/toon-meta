# Video-over-ILP prototype — measured results (2026-08-02)

Question: can the TOON paid-ephemeral-write pipeline (per-event ILP-paid Nostr
publishes over one BTP session → connector → relay → free NIP-01 subscribers)
carry **streaming HD video**, and where does it break?

Extends the huddle-audio prototype (`proto/huddle-multi-speaker`, Phases A–H:
160-byte Opus frames at 50fps) to video-scale load: synthetic encoded-video
events (6–200 KB, keyframe spikes) at 2.5–5 Mbps. No codec — the synthesizer
(`gen.mjs`) reproduces the *size/timing shape* of H.264-ish output:
30fps, 2s GOP, keyframe = 10× delta frame, ±15% jitter, seeded/deterministic.

## Verdict

**POSSIBLE: yes, comfortably** — this is the headline surprise. Both 720p
(2.5 Mbps) and 1080p (5 Mbps) streamed through the **live devnet edge** with
**100% frame delivery, zero failures of any kind** (no 503s, no F01s, no R00s)
and e2e p50 ≈ 75 ms. The pipeline that struggled to carry three voice streams
in Phase F carries an HD video stream today, because video inverts the load
shape: audio was event-rate-heavy and byte-light (50 ev/s × 160 B); video is
byte-heavy and event-rate-light (30 ev/s × 10–20 KB), and **every ceiling this
pipeline has is an events/sec ceiling, not a bytes ceiling.**

**PRACTICAL, against a 400 ms live-video budget, one stream, frame-per-event:**

- **720p: YES** — 96.4% of frames ≤400 ms (99.6% ≤1 s) on the untuned public
  devnet edge, over a residential uplink.
- **1080p: MARGINAL** — 91.4% ≤400 ms (98.6% ≤1 s). Delivery is perfect;
  what misses the bar is keyframe serialization tail (~180 KB keyframes take
  ~250–600 ms through the ~11 Mbps measured wire path). A 95% bar fails today.
- **≥8 Mbps: NO** on this path — 86.3% ≤400 ms at 8 Mbps and degrading; the
  measured serialized throughput ceiling is ~11 Mbps wire (which includes the
  test sender's residential uplink — the edge-side ceiling is *at least* this,
  and the local stack sustained 40 Mbps, so the bottleneck is likely the
  access network, not TOON).

**NOT PRACTICAL (unchanged from audio): anything that raises events/sec.**
Chunking video into 16 KB events — the "safe MTU" instinct — made 1080p
*collapse* (30.2% ≤400 ms at just 60 ev/s), and the local ceiling hunt
reproduced the audio phases' per-session admission wall at **~125–150 ev/s
regardless of event size** (150 ev/s of 10 KB events collapses while
30 ev/s of 165 KB events — 40 Mbps! — sails through at 95.7% in-budget).

## Setup (as run)

- **Local stack** (all numbers labeled `l*`): the connector repo's deployment
  rehearsal (`deploy/connector-rust/local-stack/` on `feat/btp-client-ingress`)
  — the **exact devnet images**: connector `rust-sha-bb8e12c` (BTP client
  ingress, connector#680) + relay `latest` = `sha-dd881d9` (relay#87 WASM
  schnorr verify — startup log `event signature verify: libsecp256k1-wasm`),
  settling on a local anvil (chain 31337, mock USDC, TokenNetworkRegistry).
  Real money path end-to-end: fresh NIP-06 identity, on-chain channel open,
  per-event `signBalanceProof` claims, price 1000 units/event. WSL2 host,
  16 cores.
- **Devnet** (`d*`): same harness, `TARGET=devnet` — BTP
  `wss://proxy.devnet.toonprotocol.dev/rust/ilp/btp`, route `g.toon.relay`
  (live-quoted 1000 units/event), subscriber on
  `wss://relay-ws.devnet.toonprotocol.dev`. Same deployed images as above
  (relay `sha-dd881d9` deployed 16:31Z, per the Phase H comment on
  connector#685). Identity: **session0 of the Phase G/H funded set**
  (`~/.config/toon-huddle-harness/state-multi-phase-g/`), per the
  coordination rule (faucet ETH dry; no new identities minted).
  **Devnet runs started only after Phase H results were posted**
  (connector#685 comment 16:44Z + `results-multi/*-h.json` on
  `proto/huddle-multi-speaker`).
- Frame kind: **ephemeral 20002** (broadcast-only since relay#84, no disk).
  All EVENT frames arrived single-JSON-encoded (the historic double-encode
  gotcha did not reproduce; the handler supports both).
- e2e latency = synthetic capture instant → subscriber receipt of the *last*
  event carrying any part of the frame (so batching/chunking delay and send
  queueing are charged honestly). Budget: **400 ms** ("live" video) with 1 s
  also reported; audio's bar was 150 ms.
- Harness artifact to keep in mind: every run (local AND devnet) shows one
  ~470–550 ms sender-side stall (`sendLagMax`, WSL2/GC), which is most of the
  p99/max tail in otherwise-clean local runs.

## Q1 — Chunking strategy: one event per encoded frame wins

| strategy | events/s | avg KB/ev | devnet 1080p ≤400ms | devnet 720p ≤400ms |
|---|---|---|---|---|
| **frame** (1 ev per encoded frame) | 30 | 10.3 / 20.6 | **91.4%** | **96.4%** |
| chunk16 (≤16 KB events) | 33–60 | 9–10 | 30.2% | 95.3% |
| batch100 (100 ms buckets) | 10 | 31 / 62 | 47.2% | 87.6% |

- **There is no message-size ceiling to chunk around.** The size ladder
  (`MODE=ladder`) pushed single events of 1 KB → **8 MB payload (11 MB wire)
  through the full local paid path, and 1 MB payload (1.4 MB wire) through
  the live devnet edge — all accepted, all delivered.** Relay: Hono JSON body
  with no size cap + `ws` default 100 MiB; BTP ingress: tokio-tungstenite
  defaults (16 MiB frame / 64 MiB message) — the first hard wall would be
  ~16 MiB, 100× above a keyframe.
- Cost per event is flat (1000 units regardless of size), and admission cost
  per event is ~7 ms of ordered per-session pipeline regardless of size — so
  **splitting a frame into N events multiplies both its price and its
  admission cost by N for zero benefit**. chunk16 at 1080p (60 ev/s) hit the
  per-event serialization wall and queued to seconds.
- Batching under-performs its theory: it saves cost (⅓) but adds its bucket
  latency plus a *burst* serialization spike (a 100 ms bucket containing a
  keyframe is ~190 KB → ~250 ms wire time at 11 Mbps), which blew the 400 ms
  budget at 1080p. Batching is the cost lever **only** where the latency
  budget is ≥1–2 s (VOD-ish / restream), not for live.

**Recommendation: one event per encoded video frame.** It is simultaneously
the lowest-latency, lowest-events/sec-per-Mbps, and (per byte) cheapest of
the strategies that meet the budget. Only revisit if per-event pricing makes
30 ev/min·s uneconomic — then GOP-batch at ≥500 ms buckets for non-live use.

## Q2 — Throughput: where one BTP session caps

Measured per-session behavior fits a simple serial-pipeline model:
**~7 ms fixed cost per event + per-byte wire time**, processed strictly
in-order per session (the BTP ingress design).

| probe (local, frame strategy) | ev/s | Mbps | ≤400ms | outcome |
|---|---|---|---|---|
| 1080p | 30 | 5.1 | 98.3% | clean |
| 10 Mbps × 30fps (41 KB/ev) | 30 | 10.1 | 97.3% | clean |
| **40 Mbps × 30fps (165 KB/ev)** | 30 | 40.4 | **95.7%** | clean — bytes are cheap |
| 8.3 Mbps × 100fps (10 KB/ev) | 100 | 8.3 | 93.1% | tail excursions |
| 10.4 Mbps × 125fps | 125 | 10.4 | 90.9% | at the edge |
| 12.4 Mbps × **150fps** | 150 | 12.4 | **29.1%** | standing queue (RTT p50 ~1 s) |
| 16.6 Mbps × 200fps | 200 | 16.6 | 0% | queue → 21–33 s (RTT ≈ e2e; 3.5k in flight) |

- **The per-session admission ceiling is ~125–150 events/s and is
  size-independent** — the same ~140/s wall Phase D measured with 160 B audio
  frames, reproduced locally with 10 KB video frames while relay CPU sat at
  ~15–42% and connector at ~9–26% (nobody CPU-bound; it is the ordered
  per-event pipeline). Queue forms *inside* the paid path (publish→FULFILL),
  not in the sender.
- **Byte ceiling, local: ≥40 Mbps sustained** (30 × 165 KB events, 100%
  delivered, 95.7% ≤400 ms) — per-byte serial cost ~0.15 ms/KB (~53 Mbps).
- **Byte ceiling, devnet path: ~11 Mbps wire** — ladder slope ~0.7 ms/KB
  (80 ms + size/1.4 MB/s), and the 8 Mbps stream run (10.5 Mbps wire) showed
  86.3% ≤400 ms with keyframe-tail growth. This measurement **includes a
  residential uplink**; the edge itself demonstrably clears 40 Mbps of the
  identical work locally on the same images. Bracketing the true edge byte
  ceiling needs a sender with datacenter uplink (ticket below).
- Wire expansion: **1.3–1.4×** offered video bytes → Nostr wire bytes
  (base64 content + JSON envelope), before TLS. A 5 Mbps stream is ~7 Mbps
  on every hop, including every fan-out leg.

## Q3 — Latency/jitter at 720p and 1080p (devnet, frame strategy, 30 s)

| metric | 720p @2.5 Mbps | 1080p @5 Mbps | 8 Mbps probe |
|---|---|---|---|
| frames delivered | **100%** (900/900) | **100%** (900/900) | 100% |
| e2e p50 | 73.7 ms | 77 ms | 89.3 ms |
| e2e p95 | 242 ms | 596 ms | 696 ms |
| e2e p99 | 882 ms | 1096 ms | 1191 ms |
| ≤400 ms (live bar) | **96.4%** | **91.4%** | 86.3% |
| ≤1 s | 99.6% | 98.6% | 97.5% |
| event RTT p50 | 75.8 ms | 76.3 ms | 77 ms |
| failures | 0 | 0 | 0 |

The p50 is audio-identical (~75 ms — the path's fixed cost). What separates
720p from 1080p is purely the **keyframe tail**: a ~180 KB keyframe (250 KB
wire) needs ~180 ms of wire time at the measured 11 Mbps path on top of the
75 ms floor, and delta frames queued behind it inherit the delay (ordered
session). Local runs — where wire time is negligible — put both resolutions
at 97.6–98.3% ≤400 ms with p95 ≈ 19–23 ms, i.e. **the jitter is bandwidth
physics, not pipeline behavior.** Delay, never loss: every accepted event
was delivered in every run of this prototype, matching all audio phases.

## Q4 — Cost

Flat per-event pricing (route price 1000 units = 0.001 USDC/event on devnet,
operator-set; "dust" = 1 unit/event as in the audio phases):

| stream | ev/min | devnet price /min | dust price /min | video MB/min | devnet USDC/GB |
|---|---|---|---|---|---|
| audio 50fps (Phase D ref) | 3000 | 3.0 | 0.003 | 0.6 | ~5000 |
| **720p frame** | 1800 | **1.8** | **0.0018** | 18.75 | 96 |
| 1080p frame | 1800 | 1.8 | 0.0018 | 37.5 | 48 |
| 1080p chunk16 | 3600 | 3.6 | 0.0036 | 37.5 | 96 |
| 1080p batch100 | 600 | 0.6 | 0.0006 | 37.5 | 16 |

- **An HD video-minute is CHEAPER than an audio-minute** (1.8 vs 3.0 USDC at
  devnet prices; 0.0018 vs 0.003 at dust) because price counts events, not
  bytes, and video ships fewer, bigger events. Yes-there-is-a-sane-chunking:
  frame-per-event is already sane at dust pricing (~0.11 USDC/hour).
- This is also the broken part: **per-byte price is 100× lower for video than
  audio (96 vs ~5000 USDC/GB) and →0 as events grow.** A relay whose real
  marginal cost is bytes (egress, fan-out CPU) is selling 165 KB keyframes
  and 160 B opus frames at the same price — an economic DoS invitation and a
  mispricing that per-KB (or price-per-event-size-class) route pricing must
  fix before video traffic is welcome.
- Measured devnet spend this prototype: **~5.9 USDC in frame fees**
  (~5,850 paid events across ladder + 7 stream runs) + **~80 USDC collateral
  locked** in 8 abandoned 10-USDC channels (EVM `openChannel` still opens a
  fresh channel every process — toon-client#489, still the dominant devnet
  USDC sink).

## Q5 — Fan-out projection (arithmetic, not measurement)

Local calibration: broadcast fan-out is a per-listener `ws.send` of the full
wire frame — 25 local listeners of a 5 Mbps stream cost the relay ~18% of a
desktop core (≈0.5%·core/listener) and delivered 25 × 601/601 events; egress
was 428 MB in 20 s (~171 Mbps) with zero loss. Scaling a **5 Mbps (7 Mbps
wire) stream** on the devnet `toon` box (Linode g6-standard-1: 1 vCPU,
~2 Gbps egress, **2 TB/mo transfer**):

| bound | listeners | notes |
|---|---|---|
| NIC 2 Gbps | **~285** | 7 Mbps × L |
| relay CPU (1 vCPU, connector needs ~25%) | **~60–150** | 0.5%·core/listener on a fast core; the weaker shared vCPU lands at the low end — binds before the NIC |
| **transfer quota 2 TB/mo** | **~1 sustained** | one full-time listener = 2.3 TB/mo; 285 listeners burn the month's quota in ~2.2 hours |

Fan-out is where video stops being a protocol question and becomes an
infrastructure/economics one: the paid ingest of one stream is ~7 Mbps, but
an audience multiplies *unpaid* egress linearly — reads are free by design,
so at current pricing **the operator's dominant cost (egress) is exactly the
thing nobody pays for.**

## Failure modes / observations

1. **Zero hard failures anywhere** — no 503 (BTP bypasses nginx), no F01
   nonce races (ordered session), no R00 expiry (offered load stayed under
   the event-rate wall in all realistic runs). Overload (≥150 ev/s) presents
   as the familiar unbounded queue: delay grows to tens of seconds before
   anything is lost — same shape as audio Phases F/G, now with KB events.
2. Payloads to 8 MB/event traverse the whole paid path; the pipeline's first
   byte-size wall (~16 MiB BTP frame default) is far beyond video needs.
3. Relay's ephemeral (`kind 20002`) broadcast-only path held 100% delivery
   at 40 Mbps locally at ≤30% of one core — post-relay#84/#87 the relay is
   not video's bottleneck at single-stream scale.
4. Sender-side costs are real at video scale: sha256+schnorr sign + seal +
   base64 of 10–200 KB events, plus one ~0.5 s GC/scheduler stall per run
   (harness artifact, bounded by `sendLagMax`).

## What video would force (ticket-shaped)

- **relay/connector: per-byte (or size-classed) route pricing.** Flat
  price/event ⇒ video pays 100× less per GB than audio; egress-dominated
  operators are uncompensated. Quote `price = base + perKB × size` in the
  route announce + x402 challenge, enforce at the claim gate.
- **connector#686 follow-up: lift the ~125–150 ev/s per-session ordered
  pipeline wall** (size-independent, not CPU — reproduced locally at idle).
  Claim-gate pipelining/batch verify. Video fits under it today only because
  frame-per-event needs ~30 ev/s.
- **edge byte-ceiling bracket:** rerun `MODE=ladder`/8 Mbps+ streams from a
  datacenter-uplink sender to separate the edge's true per-byte cost from
  residential last-mile (~11 Mbps measured here, 40 Mbps proven locally).
- **binary payload path:** base64-in-JSON burns 1.33× on every hop (ingest,
  broadcast, every listener). NIP-XX binary frames over WS — or carry video
  payloads out-of-band via the store/ario media path with only references in
  events — before any fan-out work.
- **fan-out tier:** free-read broadcast from the 1-vCPU relay box caps at
  ~60–150 listeners CPU-wise and ~1 sustained listener transfer-quota-wise.
  A video audience needs a distribution layer (relay mesh / CDN egress that
  is itself paid, e.g. paid subscriptions), not a bigger box.
- **toon-client#489 (existing):** EVM `openChannel` non-resume strands
  deposit per process; at video deposit sizes this bleeds collateral fast.
- **claim aggregation (carried from audio phases):** one claim per N events
  remains the right cost/admission lever for any event-rate-heavy media.

## Reproducing

```sh
cd prototypes/video-over-ilp && npm install

# local stack (exact devnet images; see connector repo feat/btp-client-ingress):
#   make anvil-up                      # connector repo: anvil + contracts
#   deploy/connector-rust/local-stack: prepare.sh, tag connector image, compose up
node fund-local.mjs                              # fund the harness identity on anvil
MODE=ladder LABEL=local node video.mjs           # byte-ceiling ladder
MODE=stream PROFILE=720p STRATEGY=frame SECONDS=30 LABEL=x node video.mjs
# strategies: STRATEGY=frame | chunk CHUNK_BYTES=16384 | batch BATCH_MS=100
# ceiling hunts: MBPS=12.45 FPS=150 ...  fan-out: SUBS=25
# devnet (COORDINATE FIRST; uses Phase G/H session0 identity):
TARGET=devnet DEVNET_DEPOSIT=10000000 MODE=stream ... node video.mjs
```

Raw run JSONs in `results-local/` and `results-devnet/` (per-run summary,
5 s e2e buckets, error taxonomy, spend), CPU samples in
`results-local/cpu-*.txt`, console logs in `*/log-*.txt`.
