# Huddle-over-ILP prototype — measured results (2026-07-31)

Question: can live huddle audio frames (one ~160-byte Opus frame per 20ms, i.e.
50 fps per speaker) be streamed over TOON as per-frame ILP-paid Nostr publishes
through the live devnet, and is it practical against a 150ms playout budget,
50 fps sustained, <5% loss?

## Verdict

**POSSIBLE: yes** — frames flow end-to-end (paid publish through the Rust apex →
relay → free subscriber WS); delivered frames arrive in ~72–86ms e2e median/p90,
well inside the 150ms playout budget.

**PRACTICAL: no over per-request HTTP — YES over BTP** (final, see Phase D
rerun): ILP-over-HTTP sustained only ~16.5 accepted fps with 35.6% admission
loss at 50fps offered (nginx 503s + F01 nonce races); the BTP client ingress
delivered **100% of 50fps frames, 99.3% within the 150ms budget, zero
failures, ~140fps headroom** on the untuned public edge. Cost at the devnet
price is ~3 USDC/speaker-minute (operator-set; 0.003 USDC at dust pricing).

**…for ONE speaker. See Phase F (multi-speaker, buzz#10): the ~140fps
headroom turns out to be a GLOBAL ceiling shared by all sessions, not a
per-session one. At N=3 concurrent speakers only 73.6% of frames land inside
the 150ms budget (bar: 95%) and at N=5 the pipeline queues to ~27s and starts
expiring packets. Multi-speaker verdict: NO-GO.**

## Setup (as run)

- Fresh NIP-06 identity from a generated mnemonic (never the daemon's key).
  Nostr pubkey `2dd3cde3…`, Solana addr `4n3Mhmp…`.
- Uplink: ILP-over-HTTP `https://proxy.devnet.toonprotocol.dev/rust/ilp`
  (rig's proven standalone path; no BTP socket).
- Write route `g.toon.relay` (live kind:10032 announce; the `g.proxy.*` names in
  older notes are retired). Fee quoted live via `getRoutePrice`: **1000 base
  units = 0.001 USDC/event**.
- Settlement: **solana:devnet** (program `2aEVJ8ko…`, SPL USDC `xyc5J8Mg…`),
  channel `BbNGg9EFpqcVZjw4kUFthnmcrxab4Cgs7U32eSfU7JDF`, initialDeposit 4 USDC,
  opened on-chain in **2713ms**.
- Subscriber: second, free NIP-01 WS to `wss://relay-ws.devnet.toonprotocol.dev`;
  frames correlated by seq + wall-clock send time embedded in event content.
- Frame kind: **ephemeral 20001 worked end-to-end** (accepted by connector AND
  relayed live to the subscriber) — no kind-1 fallback needed.
- All 1335 delivered EVENT frames arrived **single-JSON-encoded** (the historic
  double-encoding gotcha did not reproduce; handler supported both).

## Phase A — SERIAL (200 sequential publishes)

| metric | p50 | p90 | p99 | max |
|---|---|---|---|---|
| publish RTT (claim sign → FULFILL) | 73.8ms | 89.7ms | 107.6ms | ~120ms |
| e2e (publish start → subscriber recv) | 74ms | 87ms | 580ms | 580ms |

Delivered **200/200 (100%)**, publish failures **0**. Serialized capacity
implied by RTT: ~13.5 fps.

## Phase B — PACED (50 fps × 30s, 1500 frames, fire-and-forget)

| metric | value |
|---|---|
| sent | 1500 in 34.4s (effective 43.5 fps — timer couldn't hold 50) |
| delivered | **966/1500 (64.4%)** → **loss 35.6%** |
| within 150ms budget | 956/1500 (63.7%) — but **956/966 = 99% of *delivered*** |
| e2e latency (delivered) | p50 72ms / p90 86ms / p99 151ms / max 727ms |
| publish RTT (accepted) | p50 76.9ms / p90 89.1ms / p99 126.7ms |
| max in-flight | 8 |
| publish failures | 534 = 502× connector-front 503 + 32× F01 nonce reject |

## Phase C — FLOOD (10s, pipeline cap 64)

| metric | value |
|---|---|
| sent | 1816 |
| completed (paid + FULFILLed) | 167 → **sustained 16.5 frames/sec** |
| failures | 1649 = 1456× nginx 503 + 193× F01 nonce reject |
| subscriber saw | 167/1816 (all completed frames delivered) |
| publish RTT under flood | p50 311.8ms / p90 566.3ms / p99 971.7ms |

## Cost

- Fee per frame: 1000 base units = **0.001 USDC**
- Speaker-minute (50fps × 60s = 3000 frames): **3 USDC/minute** (~180 USDC/hour
  per speaker). Rejected writes are not charged (claim refused = no spend);
  the run paid for exactly the 1335 accepted events ≈ 1.335 USDC.

## Failure modes observed (dominant first)

1. **nginx 503 (connector HTTP front-end backpressure/rate limit)** — 1958 of
   2183 total failures across paced+flood. The Rust connector's nginx front
   sheds load well below 50 rps on POST /ilp; this, not ILP/claim mechanics, is
   the throughput ceiling (16.5 fps sustained).
2. **F01 "claim rejected: nonce does not advance"** — 225 total. The client's
   `signBalanceProof` allocates strictly increasing nonces synchronously, but
   concurrent in-flight HTTP posts arrive out of order and the connector
   enforces monotonic claims. Any pipelined-publish design needs claim batching
   or an ordered send queue.
3. **Zero relay-side loss**: every publish the connector accepted reached the
   subscriber; e2e delivery of accepted frames is fast (p50 ~72ms) and 99%
   within budget. Loss is entirely an admission problem, not a fan-out problem.
4. **Onboarding gotchas** (cost a full run each):
   - The TOON devnet faucet is **USDC-only on every chain** (EVM leg gave 0
     gas despite docs; Solana leg returned `mode:"usdc-only"`, sol skipped).
     Public base-sepolia faucets are captcha-gated and the public Solana
     airdrop was rate-limited → a fresh scripted identity **cannot self-fund
     native gas**; this run needed a manual 0.5 SOL send.
   - Two live kind:10032 announces both claim ILP address `g.toon.relay`: the
     genesis-seed identity `2813187e…` (stale) and the live Rust edge
     `3f12da6d…`. Anchoring the channel to the stale pubkey opens a real
     on-chain channel the live connector has no record of → every write dies
     with F01 "names a channel this connector has no record of" (4 USDC deposit
     stranded). The x402 challenge's settlement addresses identify the live one.

## Phase D — BTP transport (2026-07-31, follow-up)

Hypothesis: the nginx-503 admission ceiling and the F01 out-of-order-claim
races are HTTP-ingress artifacts; one persistent ordered BTP WebSocket should
remove both and clear the 50fps bar (latency was already fine).

**Verdict: PRACTICAL-over-BTP: unmeasurable** — the BTP *session* to the live
edge works, but its ingress cannot terminate client paid writes today, so no
frame ever flowed and no throughput could be measured.

What was established (run with `TRANSPORT=btp`, same identity, channel
`BbNGg9EF…` auto-resumed from `state/channels.json` in 39–57ms — no second
deposit):

| step | result |
|---|---|
| wss session to `wss://proxy.devnet.toonprotocol.dev:443` | connects + authenticates (empty `btpAuthToken` accepted) |
| ILP prepares over the socket | flow, and structured ILP rejects come back — the BTP conversation itself is healthy |
| bootstrap self-announce | `F06 No payment channel claim attached` (expected: devnet edges charge for announces; HTTP mode 402s the same way — not transport evidence) |
| paid publish (ephemeral 20001 AND kind-1 fallback) | **`F01 Invalid HTTP envelope: malformed request-line: "<ciphertext>"`** every time |

Root cause: over HTTP, the edge unwraps the client's sealed (giftwrapped)
request envelope and reads the claim from the request header before handing a
plaintext HTTP envelope to the relay termination. The Rust edge's **BTP
ingress has neither middleware** — it forwards `prepare.data` verbatim, so the
relay's envelope parser receives raw ciphertext (the F01 above) and claims
have no header to ride in (the F06). Same wire-drift family as the known
TS-vs-Rust cutover blocker. Client-side wiring notes for whoever picks this
up: `btpUrl` + empty `btpAuthToken` + **real** `connectorUrl`
(`https://proxy.devnet.toonprotocol.dev/rust`) is required — rig's dummy
`connectorUrl` convention breaks `publishEvent`'s `GET /ilp/identity`
envelope-sealing step with "bad port".

The HTTP→WS upgrade path is not an alternative today either: the client's
`upgradeToBtp` is only wired into the h402/x402 flow, v1 explicitly still
sends the actual write as one-shot HTTP POST after upgrading, and the edge
answers 405 to an Upgrade GET on `/rust/ilp`.

**Connector ticket material:** add giftwrap-unwrap + claim extraction to the
Rust edge's BTP ingress (parity with HTTP `/ilp`); until then client-facing
BTP cannot carry paid writes.

*Phase D correction (post-run root-cause, 2026-07-31): the "Rust edge's BTP
ingress" framing above is wrong — the Rust connector has NO BTP ingress at
all. The wss front door at `wss://proxy.devnet.toonprotocol.dev:443` is the
retired TypeScript connector (`connector:3.36.3-solchan.0`), which cannot
read the modern sealed envelope; the F01 came from ITS termination. Findings
+ what parity actually needs: connector draft PR #674,
`docs/btp-client-ingress-findings.md`.*

## Phase E — HTTP admission with the nginx limiter lifted (2026-08-01)

Question: was the 16.5fps / 64.4%-delivered ceiling just nginx's
`limit_req zone=node rate=30r/s burst=60` on `POST /rust/ilp`, and what
limiter appears next?

Config delta (temporary, on the `toon` box, restored byte-identical after
the run — verified by md5 + a burst probe seeing 503s again): added a
separate `limit_req_zone … zone=phasee:10m rate=500r/s` and pointed ONLY the
`location /rust/ilp` block at it (`burst=1000 nodelay`); every other
location stayed on the untouched `zone=node`. nginx reload, no container
restart. Same harness, same identity, same resumed channel (`BbNGg9EF…`,
resume 157ms), same fee (1000 units). Raw log: `run6-phaseE.log`.

| metric | baseline (Phase B/C) | Phase E (limiter lifted) |
|---|---|---|
| paced 50fps×30s delivered | 966/1500 (64.4%) | **1458/1500 (97.2%)** |
| paced within 150ms budget | 63.7% of sent | **96.6% of sent** |
| paced failures | 534 (502× nginx 503, 32× F01 nonce) | **42 (ALL F01 nonce, zero 503)** |
| paced e2e p50/p90/p99 | 72 / 86 / 151 ms | **66 / 73 / 133 ms** |
| paced max in-flight | 8 | 8 (emergent, RTT-bound) |
| flood sustained admitted fps (cap 64) | 16.5 | **36.1** |
| flood failures | 1649 (1456× 503, 193× F01) | **1271 (ALL F01 nonce, zero 503)** |
| flood RTT p50/p90 | 312 / 566 ms | 324 / 372 ms |
| serial RTT p50/p90 | 73.8 / 89.7 ms | 72.3 / 80.1 ms |

**New dominant limiter: F01 "claim rejected: nonce does not advance" —
out-of-order claim arrival under HTTP concurrency.** Every single Phase E
failure (42 paced + 1271 flood) is that one error; nginx 503s went from
1958 to zero. The connector itself is not CPU-bound at this load (serial
and paced RTTs *improved* slightly; flood RTT p90 dropped 566→372ms).
The claim pipeline admits everything whose nonce arrives in order; pipelined
posts racing each other are the entire remaining loss.

**Implication for the huddle verdict: at 50fps offered load, paid per-frame
audio now 97.2% clears admission** — 2.8% loss (target <5%) and 96.6%
within the 150ms budget, i.e. the PRACTICAL verdict flips to **yes at
~43–50fps paced** once the front door is opened, for a single speaker on
the shared devnet box. Uncoordinated bursting (flood) still halves
throughput via nonce races, so a production client needs an ordered send
queue or claim batching (one claim per N frames) — the same fix Phase B/C
already pointed at. The nginx limit itself is an operator policy question
(it protects the shared box; this test only shows the connector behind it
has ≥3× the admitted headroom nginx was allowing).

The measured 1000 units/frame is the shared devnet edge's announced price, not
a protocol constant. At a dust price of 1 unit (1 micro-USDC) per frame:
0.003 USDC per speaker-minute, ~0.27 USDC for a 3-speaker 30-minute huddle —
unit economics stop being the blocker; admission throughput remains the one.
(The shared devnet edge's price was deliberately left untouched.)

## Phase D rerun — BTP client ingress, measured (2026-08-01)

The connector shipped a real client-facing BTP websocket ingress
(`wss://proxy.devnet.toonprotocol.dev/rust/ilp/btp`, image rust-sha-bb8e12c,
connector#680): binary BTP frames, empty-secret auth, `payment-channel-claim`
protocolData into the same ClientClaimGate as HTTP, **strictly in-arrival-order
processing per session**, and BTP frames bypass nginx `limit_req` (only the
one upgrade request is rate-limited). Same harness, same identity, channel
`BbNGg9EF…` resumed (57ms; topped up to 20 USDC deposit). Untuned public
edge. Raw log: `run7-btp.log`.

Three-way comparison (same methodology, same 160B ephemeral-20001 frames):

| metric | HTTP baseline (B/C) | HTTP, nginx lifted (E) | **BTP, untuned edge (D)** |
|---|---|---|---|
| serial RTT p50/p90/p99 | 73.8 / 89.7 / 107.6 ms | 72.3 / 80.1 / — ms | **65.4 / 76.4 / 87.3 ms** |
| paced 50fps×30s delivered | 966/1500 (64.4%) | 1458/1500 (97.2%) | **1500/1500 (100%)** |
| paced within 150ms | 63.7% | 96.6% | **99.3%** |
| paced e2e p50/p90/p99 | 72 / 86 / 151 ms | 66 / 73 / 133 ms | **66 / 80 / 129 ms** |
| paced failures | 534 (502× 503, 32× F01) | 42 (all F01) | **0** |
| flood sustained admitted fps | 16.5 | 36.1 | **139.8** |
| flood failures | 1649 (1456× 503, 193× F01) | 1271 (all F01) | **0** (1454/1454) |
| flood RTT p50/p90 | 312 / 566 ms | 324 / 372 ms | 429 / 471 ms (queue depth 64) |
| stretch paced 100fps×10s | — | — | 1000/1000 delivered, 0 failures; e2e p50 394ms, 40.2% within 150ms (queueing, harness timer held only 67.7fps offered) |

Failure breakdown over BTP: **zero 503 (by construction — no nginx on the
frame path) and zero F01 across all 4156 delivered events** — the ordered
session eliminates the nonce races exactly as hypothesized. The new limiter
is benign queueing: at flood depth 64 the socket sustains ~140 admitted
fps with RTT ~430ms; at 100fps offered the delay (not loss) blows the 150ms
playout budget. 50fps voice cadence sits comfortably inside both budgets.

**PRACTICAL-over-BTP: YES** — at 50fps offered load the untuned public edge
delivered 100% of frames with 99.3% inside the 150ms playout budget and zero
failures of any kind; throughput headroom is ~2.8× voice cadence per session.

Economics unchanged: 1000 units/frame is the operator-set devnet price
(3 USDC/speaker-minute as measured); at a 1 micro-USDC dust price:
0.003 USDC per speaker-minute, ~0.27 USDC for a 3-speaker 30-minute huddle.

## What "practical" would need

- Connector front-end admitting ≥50 rps/client on POST /ilp (or a persistent
  BTP/WebSocket ingress instead of per-frame HTTP), plus ordered/batched claim
  submission to kill the F01 races. Latency is already fine; unit economics
  (0.001 USDC × 3000/min) would also need a ~100× cheaper audio-frame price
  class or claim aggregation (one claim per N frames).

## Phase F — multi-speaker aggregate (2026-08-02, buzz#10)

Everything above measures **one** speaker. A huddle has several talking at
once, so ADR 0003 (buzz fork) gates huddle implementation on a multi-speaker
measurement: **≥95% of each speaker's frames delivered within 150ms, per
session, at N=3 concurrent speakers**, with N=5 reported as headroom.

### Verdict

> **NO-GO.** At N=3 concurrent 50fps speakers the live devnet edge delivered
> **100% of frames but only 73.6% of them within the 150ms playout budget**
> (per-session 75.1% / 71.7% / 74.1%) — against a 95% bar. N=2 also misses
> (90.6%). N=5 collapses to **0.1% within budget**, with e2e medians of
> 5.7–27 seconds and 372 frames hard-failing on ILP `R00 prepare has expired`.
>
> Per ADR 0003 the fallback applies: **the admission + room design must be
> re-planned before huddle code is written.** Per-frame paid publishes, one
> ILP packet per 20ms of audio per speaker, do not survive contact with more
> than one speaker on today's edge.

The single-speaker Phase D result is **not** in question — it reproduced on
the same day, on the same edge, to within 0.1pp (see control runs). What
Phase F shows is that the ~140fps ceiling measured in Phase D is a **shared,
global ceiling, not a per-session one**: concurrent sessions divide it rather
than each getting their own.

### Setup (as run)

- Edge image (recorded from the box, read-only `docker ps`):
  **`ghcr.io/toon-protocol/connector:rust-sha-bb8e12c`** — the same
  deployed-not-merged Rust image as the Phase D rerun (connector#680; the
  BTP client ingress is live on devnet but the PR is not merged).
  Relay alongside it: `ghcr.io/toon-protocol/relay:sha-a8693a9`.
  Edge identity `GET /rust/ilp/identity` → `connector-signer`
  `0x040a2a82eaae34a8…` (unchanged from Phase D).
- Uplink per session: `wss://proxy.devnet.toonprotocol.dev/rust/ilp/btp`.
  Route `g.toon.relay`, live-quoted price **1000 base units/frame**
  (unchanged, operator-set), ephemeral kind 20001, 160-byte payload.
- **Each session is its own OS process** — own event loop, own BTP socket, own
  NIP-06 identity, own payment channel, own free NIP-01 subscriber WS. A
  single-process harness would have measured Node's event loop, not the edge.
  The parent gates all children on a shared wall-clock start.
- Sessions 0–3: fresh base-sepolia (`evm:84532`) identities, self-served from
  the faucet (`POST /api/base-sepolia/request` → 1000 USDC + 0.001 ETH gas),
  20 USDC channel collateral each. Session 4: the **Phase-D Solana identity**
  reusing its already-open channel `BbNGg9EF…` — see the faucet note below.
- Harness: `multi.mjs` (`SESSIONS=n SECONDS=60 LABEL=… node multi.mjs`);
  raw per-run JSON in `results-multi/`, console logs in `logs-*.txt`,
  edge CPU samples in `edge-cpu-*.txt`.

### Control — single session, same day, same edge

| run | pacer | delivered | within 150ms | e2e p50/p90/p99 | max in-flight |
|---|---|---|---|---|---|
| Phase D BTP baseline (2026-08-01) | catch-up | 1500/1500 (100%) | 99.3% | 66 / 80 / 129 ms | 9 |
| `control-post` (2026-08-02) | drop-late | 1417/1417 (100%) | **99.4%** | 65 / 68 / 126 ms | 8 |
| `control-pre` (2026-08-02) | catch-up | 1500/1500 (100%) | 91.9% | 75 / 105 / 1034 ms | 46 |

**No baseline drift.** The single-speaker path is exactly where Phase D left
it. The 91.9% outlier is a *harness* artifact, and fixing it matters for
reading the N>1 numbers: the original pacer computed each frame's slot as
`t0 + n·20ms` and, after a host stall, fired all missed slots back-to-back.
That catch-up burst is not what a microphone does — a real capture drops the
frames it missed. The pacer now **skips late slots** and reports them
(`skipped`), which is why offered rate reads ~47.3fps rather than 50: the WSL2
host loses ~5% of 20ms slots to its own scheduler. All N=2/3/5 headline
numbers below use the drop-late pacer.

### Runs — 60s sustained, 50fps offered per session, all sessions concurrent

Per-session (drop-late pacer; `sent` excludes host-skipped slots):

| run | session | chain | sent | delivered | within 150ms | e2e p50/p90/p99 | max in-flight | failures |
|---|---|---|---|---|---|---|---|---|
| N=2 | s0 | evm | 2837 | 100% | **90.5%** | 73 / 130 / 1241 ms | 65 | 0 |
| N=2 | s1 | evm | 2837 | 100% | **90.7%** | 68 / 124 / 1231 ms | 64 | 0 |
| **N=3** | s0 | evm | 2838 | 100% | **75.1%** | 79 / 1836 / 2766 ms | 139 | 0 |
| **N=3** | s1 | evm | 2838 | 100% | **71.7%** | 76 / 2785 / 4884 ms | 166 | 0 |
| **N=3** | s2 | evm | 2838 | 100% | **74.1%** | 77 / 505 / 1465 ms | 76 | 0 |
| N=5 | s0 | evm | 2837 | 100% | 0.1% | 5686 / 18580 / 23813 ms | 576 | 0 |
| N=5 | s1 | evm | 2837 | 92.8% | 0.0% | 26997 / 29319 / 29635 ms | 1407 | 203 R00 |
| N=5 | s2 | evm | 2837 | 100% | 0.1% | 5655 / 18007 / 23271 ms | 561 | 0 |
| N=5 | s3 | evm | 2837 | 100% | 0.1% | 5649 / 10797 / 11402 ms | 507 | 0 |
| N=5 | s4 | solana | 2837 | 94.0% | 0.1% | 27052 / 29312 / 29554 ms | 1401 | 169 R00 |

Aggregate, against the single-speaker control:

| run | offered (aggregate) | delivered | within 150ms | failures | verdict vs 95% bar |
|---|---|---|---|---|---|
| N=1 control | 47.2 fps | 100% | **99.4%** | 0 | pass |
| N=2 | 94.6 fps | 100% | **90.6%** | 0 | fail |
| **N=3 (the bar)** | **141.9 fps** | **100%** | **73.6%** | **0** | **FAIL** |
| N=5 | 236.4 fps | 97.4% | **0.1%** | 372 (all R00) | fail |

Two earlier N=3 runs on the catch-up pacer (`n3`, `n3b`) scored 48.7% and
53.0% within budget — same conclusion, worse artifact. The N=3 result is
reproducible across three independent runs.

### Cross-session interference

Sessions do **not** get independent capacity — they contend for one:

- N=1 → N=2 → N=3 costs each speaker 99.4% → 90.6% → 73.6% within budget.
  Nobody is starved unfairly at N≤3 (the three N=3 sessions land within 3.4pp
  of each other), but everybody degrades together.
- At N=5 the contention turns unfair: two sessions (s1, s4) fell into a
  ~27-second standing queue and started losing frames to the 30-second ILP
  prepare expiry, while the other three sat at ~5.7s. Which sessions lose is
  arbitrary — in the first N=5 run it was s0 and s4.
- Delivery is essentially lossless until the queue exceeds the ILP expiry.
  **The failure mode is delay, not loss** — the relay fan-out never dropped a
  frame it accepted, at any N. Every one of the 921 + 372 failures across both
  N=5 runs is `R00 prepare has expired`; there were **zero nginx 503s and zero
  F01 nonce rejects at any N** (the BTP ingress's ordered per-session
  processing continues to hold, as Phase D found).

### Where the ceiling is — and what it is not

Edge CPU sampled on the box during each run (`docker stats`, 100% = one core):

| run | offered aggregate | relay CPU | rust connector CPU | admitted ≈ |
|---|---|---|---|---|
| N=1 | 47 fps | ~25% | ~4.9% | 47 fps |
| N=2 | 95 fps | ~42% | ~8.8% | 95 fps |
| N=3 | 142 fps | ~65% | ~12.5% | ~142 fps |
| N=5 | 236 fps | **~69%** | ~13.3% | **~150 fps** |

The tell is the last row: pushing offered load from 142 → 236 fps moved relay
CPU by 4 points and connector CPU by 1. **Neither service is CPU-saturated;
the pipeline simply refuses to admit more than ~140–150 frames/sec in
aggregate** — the same number Phase D measured as a *single session's* flood
ceiling (139.8 fps). That ceiling is global. Five speakers do not get 5×140fps,
they get one 140fps pipe and a 236fps offered load, so the excess becomes an
unbounded queue that grows until frames hit the 30s expiry.

It is not the harness: the client box (16 cores) never exceeded 1.7 loadavg,
and each session ran in its own process.

N=3's 142fps offered sits right *at* the ceiling, which is why it looks
bimodal rather than broken — long stretches at a healthy 66–79ms p50 and 100%
in-budget, punctuated by multi-second excursions that take 10–20s to drain
because there is no spare capacity to drain them with:

```
N=3 s1, e2e p50 / % within 150ms, in 5s buckets:
  0s: 79ms/100%   5s: 79ms/100%   10s: 2746ms/8%   15s: 4788ms/0%
 20s: 1665ms/0%  25s: 164ms/46%   30s: 66ms/100%   35s: 66ms/100%
 40s: 68ms/100%  45s: 69ms/96%    50s: 67ms/97%    55s: 69ms/99%
```

N=5 shows no such recovery — p50 climbs monotonically from 0.5s to ~29s and
stays pinned at the expiry ceiling.

### Cost

Frames are still priced at the operator-set 1000 base units (0.001 USDC).
Phase F burned **~64 devnet USDC** in frame fees across 9 runs (~64k paid
frames) and locked **~520 devnet USDC** of channel collateral in 26 abandoned
devnet channels. That is faucet money (1000 USDC self-served per address) with
no real value, but it is far above the ~1 USDC the brief anticipated, because
**the shared edge's announced price was deliberately left untouched** (Phase E
set the same precedent). At the dust price the huddle design actually assumes
(1 micro-USDC/frame) the identical workload costs **0.064 USDC**, and a
3-speaker 30-minute huddle costs ~0.27 USDC. Economics remain a non-blocker;
admission remains the blocker.

### What would have to change before this bar can be met

Not a tuning problem — a design problem, which is what ADR 0003's fallback
anticipates:

1. **The ~150fps global admission ceiling has to be understood and lifted**,
   or the design must live under it. At 50fps/speaker it budgets **one**
   speaker with margin, three at the edge of collapse. The ceiling is not CPU,
   so it is a serialization point (per-connection or per-relay-write ordering)
   — a connector/relay profiling ticket, not a client fix.
2. **Frames must stop being one paid ILP packet each.** Batching N frames per
   packet/claim (e.g. 5 × 20ms = 100ms per packet) cuts offered packet rate
   5× and fits 3 speakers under today's ceiling with the playout budget
   intact. This is the same claim-aggregation fix Phases B/C/E already pointed
   at, now load-bearing rather than economic.
3. **Admission control / a room abstraction is required, not optional.** The
   observed overload mode is an unbounded queue that silently converts a
   150ms-budget medium into a 30-second one and then starts expiring packets.
   A huddle needs a bounded send window with local frame-dropping (audio
   should drop, never queue) and a per-room admitted-speaker cap.

### Reproducing

```
cd prototypes/huddle-over-ilp && npm install
node gen-identities.mjs state-multi 5     # NIP-06 identities (5 addresses)
# fund each EVM address: POST https://faucet.devnet.toonprotocol.dev/api/base-sepolia/request
SESSIONS=1 SECONDS=30 LABEL=control node multi.mjs
SESSIONS=3 SECONDS=60 LABEL=n3      node multi.mjs
SESSIONS=5 SECONDS=60 LABEL=n5      node multi.mjs
```

### Onboarding gotchas hit this round (for the next run)

- **The faucet's base-sepolia ETH leg ran dry mid-setup.** Addresses 1–4 got
  `eth.dripped: true` (0.001 ETH); the 5th got
  `{"dripped":false,"skipped":true,"reason":"faucet ETH balance below
  reserve+drip; mint still succeeded"}` — USDC still minted, gas did not.
  Session 4 therefore reused the Phase-D Solana identity and its existing
  channel instead of opening a fresh base-sepolia one (which is also why one
  N=5 row reads `solana`; it behaved indistinguishably from its EVM peers).
  **The faucet's ETH reserve needs topping up before the next multi-identity
  run.** 0.001 ETH covers ~480 channel opens, so the drip size is fine — the
  reserve is not.
- **Do not use `https://sepolia.base.org` as the base-sepolia RPC.** It is a
  stale-read load balancer: `openChannel` → `setTotalDeposit` reverts with
  `InvalidChannelState()` (`0xf806e9d9`) because the follow-up read lands on a
  lagging replica. Use `https://base-sepolia-rpc.publicnode.com` (what core's
  `base-sepolia` preset already defaults to, with the gotcha documented in the
  preset comment — worth reading before hand-wiring `chainRpcUrls`).
- **EVM `openChannel` does not resume from `channelStorePath`; Solana does.**
  Every EVM run opened a *new* on-chain channel and deposited fresh collateral
  (26 channels over 9 runs), while session 4 resumed `BbNGg9EF…` every time in
  <100ms. Harmless on devnet, expensive anywhere else — worth a client ticket.
- EVM channel open costs ~2.1×10⁻⁶ ETH and ~6–14s wall-clock on base-sepolia.
- All Phase F EVENT frames arrived **single**-JSON-encoded; the historic
  double-encoding gotcha did not reproduce (handler still supports both).

## Phase G — post-relay#84 re-measure (2026-08-02, buzz#23 / connector#685)

relay PR #84 (merged 2026-08-02, deployed the same hour) removed the per-event
disk serialization from the paid-write path: ephemeral kinds (20000–29999) are
now broadcast-only (no disk), SQLite moved to WAL + `synchronous=NORMAL`, and
the insert is prepared once. This phase re-runs the Phase F harness against the
new relay to re-test the ADR 0003 bar and locate the next ceiling
(relay#85 / connector#686 predicted schnorr verify on the relay event loop,
~250–700 fps).

### Verdict

> **The ~150 fps global admission ceiling is GONE** (connector#685 fixed):
> N=5 (242 fps aggregate) now delivers 100% with **95.6% within 150 ms** —
> the same load that collapsed to 0.1% in Phase F.
>
> **The ADR 0003 bar at N=3 is now AT the line but not reliably above it.**
> Four independent N=3 runs scored 94.4 / 97.1 / 87.1 / 95.8 % aggregate
> within-150ms (per-session minimums 94.0 / 96.7 / 82.4 / 94.7 %): one run
> passes every session ≥95%, the median run sits within ~1pp of the bar, and
> one run dipped on a multi-second tail excursion. The failure mode has
> changed in kind: Phase F's structural queue collapse (10–20 s at zero
> in-budget capacity, excess load converting into 30 s standing queues) is
> gone; what remains is intermittent tail jitter — a few seconds per minute
> where p50 stays ~70–90 ms but the p90+ tail spreads to 200–1200 ms and
> drains within 1–2 buckets.
>
> **The next ceiling is ~240–260 fps aggregate and it is now CPU** — the
> bottom of the relay#85 / connector#686 prediction band.

### Deploy under test

- Relay image **`ghcr.io/toon-protocol/relay:sha-6ed12ab`** (merge commit of
  relay#84), swapped in on the `toon` box at 15:12Z by editing only the relay
  service pin in `docker-compose.node.yml` (backup kept on-box;
  bind-mounted connector configs untouched). Connector unchanged:
  `ghcr.io/toon-protocol/connector:rust-sha-bb8e12c`; edge identity unchanged
  (`connector-signer` `0x040a2a82eaae34a8…`).
- kind:10032 announce situation verified post-deploy: apex announcer
  (`30fdd01d…`) fresh + unexpired claiming `g.toon.relay` with the live edge
  identity; store box (`49c5311d…`) fresh claiming `g.toon.ario`; the old
  stale announces (`2813187e…`, `3f12da6d…`, `1e0fdc9d…`) remain visible but
  NIP-40-expired. No dual-live-announce regression.
- Smoke (1×10 s): 455/455 delivered, 98.2% ≤150 ms, zero failures — paid
  write path green through the new relay before any measurement run.

### Setup deltas vs Phase F

- 10 fresh base-sepolia identities (`SPECS` is now generated, all-EVM).
  The faucet's ETH leg was **still dry** (USDC minted, `eth` leg skipped on
  all 10) — gas hand-sent from the fleet settlement wallet
  (0.0003 ETH each), which remains the Phase F follow-up to fix.
- Same drop-late pacer, same kind 20001 / 160 B frames, same 1000-unit price,
  same per-session child processes, 60 s runs.

### Runs — 60 s sustained, 50 fps offered per session

| run | aggregate offered | delivered | within 150ms (agg) | per-session in150 | failures |
|---|---|---|---|---|---|
| smoke-g (N=1, 10 s) | 45.5 fps | 100% | 98.2% | 98.2 | 0 |
| n3-g | 145.5 fps | 100% | 94.4% | 94.0 / 95.0 / 94.3 | 0 |
| n3b-g | 145.5 fps | 100% | **97.1%** | 97.7 / 97.0 / 96.7 | 0 |
| n3c-g | 145.6 fps | 100% | 87.1% | 91.3 / 82.4 / 87.5 | 0 |
| n3d-g | 145.7 fps | 100% | 95.8% | 97.7 / 94.9 / 94.7 | 0 |
| **n5-g** | **242.4 fps** | **100%** | **95.6%** | 96.7 / 94.9 / 96.7 / 94.3 / 95.5 | 0 |
| n10-g | 484.9 fps | 79.2% | 0.1% | ~0 everywhere | 6053 (all R00) |

Phase F → Phase G at the same offered load: N=3 73.6% → 87–97% (median ~95%);
N=5 **0.1% → 95.6%**. Zero 503s and zero F01s at any N (ordered BTP still
holds); every hard failure at N=10 is `R00 prepare has expired`, exactly as
the old ceiling failed — just at ~3× the load.

### Where the new ceiling is

Edge CPU sampled on the box during each run (`docker stats`, 100% = one core;
the `toon` box is a 1-vCPU g6-standard-1):

| run | offered aggregate | relay CPU avg/max | rust connector avg/max | outcome |
|---|---|---|---|---|
| n3-g | 145 fps | 39% / 69% | 9% / 19% | healthy |
| n5-g | 242 fps | 55% / 86% | 15% / 22% | healthy (95.6% in budget) |
| n10-g | 485 fps | **71% / 94%** | 19% / 34% | collapse; admits ~240–260 fps |

At N=10 the relay process pins ~94% of the core while admitting
~240–260 fps (23,038 frames delivered over a ~95 s window) and the excess
becomes the familiar unbounded queue → 30 s R00 expiry. Unlike Phase F —
where the relay refused >150 fps at 65–69% CPU (a serialization limit, i.e.
the per-event fsync #84 removed) — the pipeline is now **CPU-bound on the
relay's single-threaded event loop**. Measured ceiling ~240–260 fps sits at
the bottom of the relay#85 / connector#686 prediction (~250–700 fps, schnorr
verify on the event loop). Candidate contributors on the same event loop:
per-event schnorr verify (relay#85), plus the relay's multi-line per-message
`console.log`ging through docker's json-file driver — which is itself
per-event disk I/O that #84 did not remove.

The N≤5 tail excursions are consistent with the same event loop stalling
briefly (GC or log flush; Linode CPU steal was ruled out — sampled ≤5.2%
during a run with excursions, ~0.2% typical). Load is not the trigger: N=5
scored better than three of four N=3 runs.

### Cost

~73 devnet USDC in frame fees across 7 runs (~73k paid frames at the
operator's 1000-unit price), ~560 USDC collateral locked across 28 abandoned
channels (EVM `openChannel` still does not resume from `channelStorePath` —
toon-client#489 remains open and remains the dominant devnet-USDC sink).

### What this means for buzz#23 (ADR 0003)

1. The **structural** blocker is fixed: three speakers no longer divide a
   ~150 fps pipe; N=5 clears the bar outright and N=3's median run sits at it.
2. Strictly, ≥95%-per-session at N=3 was met in **1 of 4 runs** — the bar is
   not *reliably* cleared while the residual event-loop tail jitter exists.
   The gap is ~1–3pp of tail, not a design-level ceiling; relay#85 (verify
   off the event loop) and silencing the relay's per-message logging are the
   obvious next moves, both relay-side and both measurable with this same
   harness unchanged.
3. Headroom math still budgets tightly: a 3-speaker huddle offers ~150 fps
   against a ~250 fps ceiling (1.7× margin at N=3, none at N=5 speakers).
   Frame batching (Phase F recommendation #2) remains the lever that buys an
   order of magnitude.
