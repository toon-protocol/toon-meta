# proto/spacetimedb-relay

Throwaway prototype answering: **would SpacetimeDB meaningfully beat the
planned in-place fixes for the TOON relay's store+broadcast role?**

Verdict and measured numbers in [RESULTS.md](./RESULTS.md).

## Layout

- `module/` — minimal SpacetimeDB Rust module: `events` (persistent table,
  regular Nostr kinds) + `frames` (event table, ephemeral kinds 20000–29999),
  with `post_event` / `post_frame` reducers. No verify in the module (the
  honest counterfactual relay runs `TOON_DEV_MODE=true`, i.e. the planned
  skip-verify-for-paid-ephemeral fix; in a real adoption schnorr verify would
  live in the NIP-01 protocol shim in front, exactly like today's connector).
- `bench/` — harness:
  - `stdb-sub.ts` / `stdb-writer.ts` — SpacetimeDB clients (official
    `spacetimedb@2.7.1` TS SDK, generated bindings in `bench/bindings/`).
  - `relay-sub.mjs` / `relay-writer.mjs` — NIP-01 WS subscribers + POST
    /write writer against the deployed relay image.
  - `orchestrate.mjs` — spawns N subscriber conns across worker processes +
    one writer, samples server CPU via `docker stats`, aggregates latency.
  - `run-matrix.mjs` — the scenario matrix; writes `results/<system>/*.json`.
  - `diag*.ts` — latency-diagnosis one-offs (fsync isolation, burst shape).

## Reproduce

```bash
# SpacetimeDB 2.7.1 (server == CLI == SDK), official image
docker run -d --name stdb --cpus=2 -p 127.0.0.1:3000:3000 \
  clockworklabs/spacetime:latest start --listen-addr 0.0.0.0:3000
spacetime publish -s http://127.0.0.1:3000 -p module relaybench

# The relay actually deployed on devnet (sha-dd881d9), dev mode = planned skip-verify fix
docker run -d --name toonrelay --cpus=2 -p 127.0.0.1:7100:7100 -p 127.0.0.1:3100:3100 \
  -e TOON_DEV_MODE=true -e NOSTR_SECRET_KEY=<64-hex> \
  ghcr.io/toon-protocol/relay:sha-dd881d9

cd bench && npm install
node run-matrix.mjs stdb    # writes results/stdb/
node run-matrix.mjs relay   # writes results/relay/
```

Both containers capped at `--cpus=2` (the devnet relay box shape); clients ran
uncapped on the remaining 14 host cores. Everything loopback on one machine
(WSL2, 16-core, NVMe) — cross-host NIC effects are out of scope; this measures
server CPU + protocol + storage cost, which is where the fan-out wall lives.
