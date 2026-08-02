#!/usr/bin/env bash
# Full benchmark matrix. Assumes:
#   - TigerBeetle single replica on 127.0.0.1:3033 (see RESULTS.md)
#   - NODE_PATH points at a node_modules containing tigerbeetle-node
#   - counterfactual built: (cd counterfactual && cargo build --release)
set -euo pipefail
cd "$(dirname "$0")"
CF=counterfactual/target/release/claim-gate-counterfactual
OUT=${1:-results.jsonl}
: > "$OUT"

echo "== disk fsync floor ==" | tee -a "$OUT"
$CF fsync-probe | tee -a "$OUT"

echo "== counterfactual: CURRENT shape (per-claim fsync under global lock) ==" | tee -a "$OUT"
for s in 1 16 64; do $CF current $s 10 | tee -a "$OUT"; done

echo "== counterfactual: FIXED shape (group commit outside lock) ==" | tee -a "$OUT"
for s in 1 16 64 256; do $CF fixed $s 10 | tee -a "$OUT"; done

echo "== counterfactual latency (paced) ==" | tee -a "$OUT"
$CF latency-current 10 50 15 | tee -a "$OUT"
$CF latency-fixed 1 50 15 | tee -a "$OUT"
$CF latency-fixed 10 50 15 | tee -a "$OUT"
$CF latency-fixed 40 50 15 | tee -a "$OUT"

echo "== tigerbeetle throughput ==" | tee -a "$OUT"
node bench-tb.cjs setup 64
# NOTE: under `tigerbeetle start --development` the max batch is 253 transfers
# per request (smaller message body); production default is 8189.
for cfg in "1 1" "16 1" "1 64" "16 64" "1 253" "16 253" "64 253"; do
  node bench-tb.cjs throughput $cfg 10 | tee -a "$OUT"
done

echo "== tigerbeetle latency (paced, single-transfer requests) ==" | tee -a "$OUT"
node bench-tb.cjs latency 1 50 20 | tee -a "$OUT"
node bench-tb.cjs latency 10 50 20 | tee -a "$OUT"
node bench-tb.cjs latency 40 50 20 | tee -a "$OUT"
