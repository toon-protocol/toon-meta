#!/usr/bin/env node
// TigerBeetle claim-gate benchmark.
//
// Maps the connector's ClientClaimGate hot path onto TigerBeetle:
//   - one TB account per payment channel (debit side, funded by a faucet)
//   - one connector revenue account (credit side)
//   - each accepted claim delta = one transfer channel->revenue,
//     user_data_64 = claim nonce, id = (channel << 64 | nonce) for idempotency
//   - the monotonic nonce/cumulative watermark check stays APP-SIDE
//     (in-memory map, checked before submit) -- TB cannot express
//     "nonce strictly advances", it gives duplicate-id rejection and
//     debits_must_not_exceed_credits natively.
//
// Modes:
//   node bench-tb.js setup <nChannels>
//   node bench-tb.js throughput <sessions> <batchSize> <seconds>
//   node bench-tb.js latency <sessions> <ratePerSession> <seconds>
//
// Requires a running single-replica TigerBeetle on 127.0.0.1:3033.

const {
  createClient,
  CreateAccountStatus,
  CreateTransferStatus,
} = require("tigerbeetle-node");

const LEDGER = 1;
const CODE = 1;
const REVENUE = 1n;
const FAUCET = 2n;
const CHANNEL_BASE = 100n;
const CLAIM_AMOUNT = 20n; // matches devnet announcePrice-ish per-event price

const client = createClient({
  cluster_id: 0n,
  replica_addresses: ["127.0.0.1:3033"],
});

function account(id) {
  return {
    id,
    debits_pending: 0n,
    debits_posted: 0n,
    credits_pending: 0n,
    credits_posted: 0n,
    user_data_128: 0n,
    user_data_64: 0n,
    user_data_32: 0,
    reserved: 0,
    ledger: LEDGER,
    code: CODE,
    flags: 0,
    timestamp: 0n,
  };
}

function transfer(id, channelId, amount, nonce) {
  return {
    id,
    debit_account_id: channelId,
    credit_account_id: REVENUE,
    amount,
    pending_id: 0n,
    user_data_128: 0n,
    user_data_64: nonce,
    user_data_32: 0,
    timeout: 0,
    ledger: LEDGER,
    code: CODE,
    flags: 0,
    timestamp: 0n,
  };
}

// Unique transfer id: run-epoch in the high bits so reruns never collide,
// then channel and nonce. (In prod: 128-bit id = hash(channel_id, nonce)
// would give cross-restart idempotency.)
const RUN = BigInt(Date.now()) << 80n;
function transferId(channel, nonce) {
  return RUN | (channel << 40n) | nonce;
}

function percentile(sorted, p) {
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length * p) / 100))];
}

async function setup(nChannels) {
  const accounts = [account(REVENUE), account(FAUCET)];
  for (let i = 0; i < nChannels; i++) accounts.push(account(CHANNEL_BASE + BigInt(i)));
  // tigerbeetle-node 0.17.x returns one result per event; 0xFFFFFFFF = ok.
  const OK = 4294967295;
  const errs = await client.createAccounts(accounts);
  for (const e of errs) {
    if (e.status !== OK && e.status !== CreateAccountStatus.exists) {
      throw new Error(`createAccounts: ${CreateAccountStatus[e.status]}`);
    }
  }
  console.log(`accounts ready: revenue, faucet, ${nChannels} channels`);
}

async function throughput(sessions, batchSize, seconds) {
  const deadline = Date.now() + seconds * 1000;
  let done = 0;
  let rejected = 0;
  const watermarks = new Map(); // app-side nonce watermark, kept for shape honesty

  async function session(s) {
    const channel = CHANNEL_BASE + BigInt(s);
    let nonce = watermarks.get(s) ?? 0n;
    while (Date.now() < deadline) {
      const batch = [];
      for (let i = 0; i < batchSize; i++) {
        nonce += 1n; // app-side monotonic check + advance
        batch.push(transfer(transferId(channel, nonce), channel, CLAIM_AMOUNT, nonce));
      }
      const results = await client.createTransfers(batch);
      const bad = results.filter((r) => r.status !== 4294967295).length;
      rejected += bad;
      done += batch.length - bad;
      watermarks.set(s, nonce);
    }
  }

  const t0 = process.hrtime.bigint();
  await Promise.all(Array.from({ length: sessions }, (_, s) => session(s)));
  const dt = Number(process.hrtime.bigint() - t0) / 1e9;
  console.log(
    JSON.stringify({
      mode: "throughput",
      sessions,
      batchSize,
      seconds: +dt.toFixed(2),
      transfers: done,
      rejected,
      tps: Math.round(done / dt),
    })
  );
}

async function latency(sessions, rate, seconds) {
  const intervalMs = 1000 / rate;
  const lats = [];
  let rejected = 0;

  async function session(s) {
    const channel = CHANNEL_BASE + BigInt(s);
    let nonce = 0n;
    const n = Math.floor(rate * seconds);
    const start = Date.now();
    for (let i = 0; i < n; i++) {
      const target = start + i * intervalMs;
      const wait = target - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      nonce += 1n;
      const t0 = process.hrtime.bigint();
      const results = await client.createTransfers([
        transfer(transferId(channel, nonce), channel, CLAIM_AMOUNT, nonce),
      ]);
      const dt = Number(process.hrtime.bigint() - t0) / 1e6; // ms
      rejected += results.filter((r) => r.status !== 4294967295).length;
      lats.push(dt);
    }
  }

  await Promise.all(Array.from({ length: sessions }, (_, s) => session(s)));
  lats.sort((a, b) => a - b);
  console.log(
    JSON.stringify({
      mode: "latency",
      sessions,
      ratePerSession: rate,
      claims: lats.length,
      rejected,
      p50_ms: +percentile(lats, 50).toFixed(3),
      p95_ms: +percentile(lats, 95).toFixed(3),
      p99_ms: +percentile(lats, 99).toFixed(3),
      max_ms: +lats[lats.length - 1].toFixed(3),
    })
  );
}

async function main() {
  const [mode, a, b, c] = process.argv.slice(2);
  if (mode === "setup") await setup(Number(a ?? 64));
  else if (mode === "throughput") await throughput(Number(a), Number(b), Number(c ?? 10));
  else if (mode === "latency") await latency(Number(a), Number(b), Number(c ?? 10));
  else {
    console.error("usage: setup <n> | throughput <sessions> <batch> <sec> | latency <sessions> <rate> <sec>");
    process.exit(1);
  }
  client.destroy();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
