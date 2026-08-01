# Huddle-over-ILP prototype — measured results (2026-07-31)

Question: can live huddle audio frames (one ~160-byte Opus frame per 20ms, i.e.
50 fps per speaker) be streamed over TOON as per-frame ILP-paid Nostr publishes
through the live devnet, and is it practical against a 150ms playout budget,
50 fps sustained, <5% loss?

## Verdict

**POSSIBLE: yes** — frames flow end-to-end (paid publish through the Rust apex →
relay → free subscriber WS); delivered frames arrive in ~72–86ms e2e median/p90,
well inside the 150ms playout budget.

**PRACTICAL: no** — the path sustains only ~16.5 accepted frames/sec under
pipelining (vs 50 required), and at a paced 50fps offered load 35.6% of frames
were refused upstream (7× over the 5% loss bar). Cost is also ~3 USDC (devnet
units) per speaker-minute.

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

## What "practical" would need

- Connector front-end admitting ≥50 rps/client on POST /ilp (or a persistent
  BTP/WebSocket ingress instead of per-frame HTTP), plus ordered/batched claim
  submission to kill the F01 races. Latency is already fine; unit economics
  (0.001 USDC × 3000/min) would also need a ~100× cheaper audio-frame price
  class or claim aggregation (one claim per N frames).
