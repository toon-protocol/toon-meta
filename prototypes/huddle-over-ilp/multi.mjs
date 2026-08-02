// Phase F: multi-speaker aggregate validation (buzz#10 / toon-meta#256).
//
// N concurrent BTP sessions, each its own NIP-06 identity + its own funded
// payment channel, each publishing 50 audio-sized frames/sec at the live
// devnet Rust edge. Measures per-session delivery %, within-150ms %, failure
// taxonomy, and cross-session interference vs the single-session baseline.
//
//   SESSIONS=3 SECONDS=60 LABEL=n3 node prototypes/huddle-over-ilp/multi.mjs
//
// Each session runs in its OWN child process (own event loop, own BTP socket,
// own free NIP-01 subscriber WS) so that N speakers are genuinely concurrent
// rather than time-slicing one JS thread — a single-process harness would
// measure the harness, not the edge. The parent gates every child on a shared
// wall-clock start so the sessions overlap for the whole run.
//
// Wiring is inherited verbatim from run.mjs (BTP transport, Phase D rerun).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fork } from 'node:child_process';
import os from 'node:os';
import {
  ToonClient,
  deriveFullIdentity,
  readSolanaTokenBalance,
} from '@toon-protocol/client';
import { encodeEventToToon, decodeEventFromToon } from '@toon-protocol/core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STATE = path.join(HERE, 'state-multi');
const RESULTS = path.join(HERE, 'results-multi');

// ── live topology (kind:10032 announce, refetched 2026-08-02) ───────────────
const RELAY_WS = 'wss://relay-ws.devnet.toonprotocol.dev';
const APEX_BTP = 'wss://proxy.devnet.toonprotocol.dev/rust/ilp/btp';
const CONNECTOR_URL = 'https://proxy.devnet.toonprotocol.dev/rust';
const GENESIS_PEER_PUBKEY = '3f12da6d0cf10c91094894b88fc520757fc2860a1a5efb6664d3340ff97cfe40';
const DEST_ANCHOR = 'g.toon.relay';
const PUBLISH_DEST = 'g.toon.relay';

const CHAINS = {
  evm: {
    key: 'evm:84532',
    usdc: '0x49beE1Bca5d15Fb0963117923403F9498119a9Ce',
    tokenNetwork: '0x1E95493fEF46707E034b4a1945f25a8C76A1823D',
    // NOT https://sepolia.base.org — that is a stale-read load balancer whose
    // lagging replicas make openChannel->setTotalDeposit revert with
    // InvalidChannelState (0xf806e9d9). Same default core's base-sepolia preset uses.
    rpc: 'https://base-sepolia-rpc.publicnode.com',
  },
  solana: {
    key: 'solana:devnet',
    usdc: 'xyc5J8MgKFiEN13PnfftdXxUzYH34FEvw1LCrFwN7in',
    tokenNetwork: '2aEVJ8koKD8LTZrLRSGtAtU7LBt4e7QjjCgf1kzQ7Rip',
    rpc: 'https://api.devnet.solana.com',
  },
};

// Phase I (post relay d80f279 / connector 0b39f3e3): SOLANA sessions — first
// phase off the EVM chain. 20 identities (sessions 0-9 reuse the Phase G
// mnemonics' solana keys, 10-19 fresh), each faucet-funded on PUBLIC Solana
// devnet (0.03 SOL gas + 1000 USDC of the announced mint xyc5J8Mg…). The
// self-hosted validator is gone (endpoints.json 2026-07-19 cutover); the live
// kind:10032 announce advertises program 2aEVJ8ko… / mint xyc5J8Mg… on
// solana:devnet, matching CHAINS.solana. Deposit is env-overridable for the
// single-session high-rate run (frames cost 1000 units each).
const SPECS = Array.from({ length: 20 }, (_, i) => ({
  chain: 'solana',
  mnemonic: `session${i}.mnemonic.txt`,
  store: `session${i}.sol.channels.json`,
  deposit: process.env.DEPOSIT ?? '10000000',
}));

const KIND = 20001;
const TAG = 'huddle-multi';
const FRAME_BYTES = 160;
const BUDGET_MS = 150;

const FPS = Number(process.env.FPS ?? 50);
const SECONDS = Number(process.env.SECONDS ?? 60);
const SESSIONS = Number(process.env.SESSIONS ?? 3);
const LABEL = process.env.LABEL ?? `n${SESSIONS}`;

// ── stats helpers ──────────────────────────────────────────────────────────
const nowNs = () => process.hrtime.bigint();
const msOf = (ns) => Number(ns) / 1e6;
const pct = (arr, p) => {
  if (!arr.length) return NaN;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};
const sleep = (n) => new Promise((r) => setTimeout(r, n));
const r1 = (n) => (Number.isFinite(n) ? Math.round(n * 10) / 10 : null);

// ───────────────────────────────────────────────────────────────────────────
// CHILD: one speaker session
// ───────────────────────────────────────────────────────────────────────────
class Subscriber {
  constructor(pubkey) {
    this.pubkey = pubkey;
    this.received = new Map();
    this.doubleEncoded = 0;
    this.singleEncoded = 0;
  }
  async start() {
    this.ws = new WebSocket(RELAY_WS);
    await new Promise((res, rej) => {
      this.ws.onopen = res;
      this.ws.onerror = (e) => rej(new Error(`subscriber WS error: ${e.message ?? e}`));
    });
    this.ws.onmessage = (ev) => this.handle(ev.data.toString());
    this.ws.onclose = () => console.error('[sub] WS closed');
    this.ws.send(JSON.stringify(['REQ', 'huddle', {
      kinds: [KIND], authors: [this.pubkey], since: Math.floor(Date.now() / 1000) - 5,
    }]));
  }
  handle(raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
      if (typeof msg === 'string') { this.doubleEncoded++; msg = JSON.parse(msg); }
      else this.singleEncoded++;
    } catch { return; }
    if (!Array.isArray(msg) || msg[0] !== 'EVENT') return;
    let evt = msg[2];
    if (typeof evt === 'string') { try { evt = JSON.parse(evt); } catch { return; } }
    let content;
    try { content = JSON.parse(evt.content); } catch { return; }
    if (content?.t !== TAG || content.seq === undefined) return;
    if (this.received.has(content.seq)) return;
    this.received.set(content.seq, { recvWall: Date.now() });
  }
  stop() { try { this.ws?.close(); } catch {} }
}

function buildConfig(spec, mnemonic) {
  const chain = CHAINS[spec.chain];
  const keyed = (v) => ({ [chain.key]: v });
  return {
    connectorUrl: CONNECTOR_URL,
    btpUrl: APEX_BTP,
    btpAuthToken: '',
    mnemonic,
    mnemonicAccountIndex: 0,
    ilpInfo: {
      pubkey: '00'.repeat(32),
      ilpAddress: 'g.toon.client',
      btpEndpoint: APEX_BTP,
      assetCode: 'USD',
      assetScale: 6,
    },
    toonEncoder: encodeEventToToon,
    toonDecoder: decodeEventFromToon,
    destinationAddress: DEST_ANCHOR,
    relayUrl: '',
    knownPeers: [{ pubkey: GENESIS_PEER_PUBKEY, relayUrl: RELAY_WS, btpEndpoint: APEX_BTP }],
    channelStorePath: path.join(STATE, spec.store),
    supportedChains: [chain.key],
    preferredTokens: keyed(chain.usdc),
    tokenNetworks: keyed(chain.tokenNetwork),
    chainRpcUrls: keyed(chain.rpc),
    ...(spec.chain === 'solana'
      ? { solanaChannel: { rpcUrl: chain.rpc, programId: chain.tokenNetwork, tokenMint: chain.usdc } }
      : {}),
    initialDeposit: spec.deposit,
  };
}

function patchNegotiations(client, spec) {
  const chain = CHAINS[spec.chain];
  const negotiations = client.peerNegotiations;
  if (!(negotiations instanceof Map)) return;
  for (const n of negotiations.values()) {
    if (!n.tokenNetwork) n.tokenNetwork = chain.tokenNetwork;
    if (!n.tokenAddress) n.tokenAddress = chain.usdc;
  }
}

const randomPayload = () =>
  Buffer.from(crypto.getRandomValues(new Uint8Array(FRAME_BYTES))).toString('base64');

async function child() {
  const idx = Number(process.env.SESSION_IDX);
  const spec = SPECS[idx];
  const log = (...a) => console.log(`[s${idx}]`, ...a);
  const mnemonic = fs.readFileSync(path.join(STATE, spec.mnemonic), 'utf8').trim();
  const id = await deriveFullIdentity(mnemonic, 0);
  log('identity nostr', id.nostr.pubkey.slice(0, 12), spec.chain === 'evm' ? id.evm.address : id.solana.publicKey);

  const client = new ToonClient(buildConfig(spec, mnemonic));
  await client.start();
  patchNegotiations(client, spec);

  let price = 1000n;
  try {
    const q = await client.getRoutePrice(PUBLISH_DEST);
    if (q !== null && q !== undefined) price = BigInt(q);
  } catch (err) { log('getRoutePrice failed, using 1000:', err.message); }

  // Public-devnet RPC kindness: stagger the on-chain opens so N sessions
  // don't burst api.devnet.solana.com simultaneously (rate-limit 429s would
  // strand deposits). The GO gate below still aligns the measured window.
  await sleep(idx * 1500);
  const tOpen = Date.now();
  const channelId = await client.openChannel(DEST_ANCHOR);
  log(`channel ${channelId} (${Date.now() - tOpen}ms) price=${price}`);

  const sub = new Subscriber(id.nostr.pubkey);
  await sub.start();

  let seqCounter = 0;
  const makeFrame = () => {
    const seq = seqCounter++;
    const sentWall = Date.now();
    const sentNs = nowNs();
    const event = client.signEvent({
      kind: KIND,
      created_at: Math.floor(sentWall / 1000),
      tags: [['t', TAG]],
      content: JSON.stringify({ t: TAG, s: idx, seq, sw: sentWall, d: randomPayload() }),
    });
    return { seq, sentWall, sentNs, event };
  };
  const send = async (frame) => {
    try {
      const claim = await client.signBalanceProof(channelId, price);
      const result = await client.publishEvent(frame.event, {
        destination: PUBLISH_DEST, claim, ilpAmount: price,
      });
      frame.doneNs = nowNs();
      frame.ok = result.success === true;
      if (!frame.ok) frame.err = `${result.error ?? ''} code=${result.code ?? ''}`.slice(0, 110).trim();
    } catch (err) {
      frame.doneNs = nowNs();
      frame.ok = false;
      frame.err = String(err.message).slice(0, 110);
    }
  };

  // warm-up probe (not counted): proves the channel + kind end-to-end
  const probe = makeFrame();
  await send(probe);
  await sleep(2000);
  const probeOk = probe.ok && sub.received.has(probe.seq);
  log('probe ok=', probe.ok, 'delivered=', sub.received.has(probe.seq), probe.err ?? '');
  if (!probeOk) {
    process.send({ type: 'ready', idx, error: `probe failed: ok=${probe.ok} ${probe.err ?? 'not delivered'}` });
  } else {
    process.send({ type: 'ready', idx, channelId, price: price.toString(), chain: spec.chain });
  }

  const startAt = await new Promise((res) => {
    process.on('message', (m) => { if (m.type === 'go') res(m.startAt); });
  });
  while (Date.now() < startAt) await sleep(Math.min(20, startAt - Date.now()));

  // ── paced run: drift-corrected 1/FPS pacing, fire-and-forget ─────────────
  const tickMs = 1000 / FPS;
  const total = FPS * SECONDS;
  const frames = new Map();
  let sent = 0, inFlight = 0, maxInFlight = 0, skipped = 0, slot = 0;
  const t0 = Date.now();
  await new Promise((resolve) => {
    const tick = () => {
      if (slot >= total) return resolve();
      // A real microphone produces one frame per 20ms of wall clock: if the
      // host stalls, those frames are DROPPED, not batched into a catch-up
      // burst. Bursting would inject harness jitter into the edge and be
      // scored as edge latency, so late slots are skipped instead.
      const behind = Math.floor((Date.now() - t0) / tickMs) - slot;
      if (behind > 1) { skipped += behind - 1; slot += behind - 1; }
      slot++;
      const frame = makeFrame();
      frames.set(frame.seq, frame);
      sent++;
      inFlight++;
      if (inFlight > maxInFlight) maxInFlight = inFlight;
      send(frame).finally(() => { inFlight--; });
      setTimeout(tick, Math.max(0, t0 + slot * tickMs - Date.now()));
    };
    tick();
  });
  const offeredWall = (Date.now() - t0) / 1000;
  const drainStart = Date.now();
  while (inFlight > 0 && Date.now() - drainStart < 30000) await sleep(100);
  await sleep(4000); // let the subscriber catch stragglers

  // ── per-session stats ────────────────────────────────────────────────────
  const e2es = [], rtts = [];
  const errors = {};
  let delivered = 0, in150 = 0, failures = 0;
  const perSecond = new Array(SECONDS + 2).fill(0);
  const BUCKET_S = 5; // e2e-vs-time: is the queue standing or growing?
  const buckets = Array.from({ length: Math.ceil(SECONDS / BUCKET_S) }, () => []);
  for (const f of frames.values()) {
    if (f.doneNs) rtts.push(msOf(f.doneNs - f.sentNs));
    if (f.ok === false) {
      failures++;
      errors[f.err ?? 'unknown'] = (errors[f.err ?? 'unknown'] ?? 0) + 1;
    }
    const rec = sub.received.get(f.seq);
    if (rec) {
      delivered++;
      const e2e = rec.recvWall - f.sentWall;
      e2es.push(e2e);
      if (e2e <= BUDGET_MS) in150++;
      const bucket = Math.floor((f.sentWall - t0) / 1000);
      if (bucket >= 0 && bucket < perSecond.length) perSecond[bucket]++;
      const b5 = Math.floor((f.sentWall - t0) / (BUCKET_S * 1000));
      if (b5 >= 0 && b5 < buckets.length) buckets[b5].push(e2e);
    }
  }
  const e2eOverTime = buckets.map((b, i) => ({
    fromSec: i * BUCKET_S,
    n: b.length,
    p50: pct(b, 50),
    p90: pct(b, 90),
    in150Pct: b.length ? (b.filter((x) => x <= BUDGET_MS).length / b.length) * 100 : null,
  }));
  process.send({
    type: 'result',
    idx,
    chain: spec.chain,
    channelId,
    price: price.toString(),
    sent,
    skipped,
    offeredWall,
    offeredFps: sent / offeredWall,
    delivered,
    in150,
    failures,
    errors,
    maxInFlight,
    encodings: { single: sub.singleEncoded, double: sub.doubleEncoded },
    e2e: { p50: pct(e2es, 50), p90: pct(e2es, 90), p99: pct(e2es, 99), max: e2es.length ? Math.max(...e2es) : null },
    rtt: { p50: pct(rtts, 50), p90: pct(rtts, 90), p99: pct(rtts, 99) },
    deliveredPerSecond: perSecond.slice(0, SECONDS),
    e2eOverTime,
    spendBaseUnits: (BigInt(price) * BigInt(delivered)).toString(),
  });
  sub.stop();
  try { await client.stop(); } catch {}
  await sleep(200);
  process.exit(0);
}

// ───────────────────────────────────────────────────────────────────────────
// PARENT: orchestrate N children on a shared wall clock
// ───────────────────────────────────────────────────────────────────────────
async function parent() {
  fs.mkdirSync(RESULTS, { recursive: true });
  console.log(`=== Phase F multi-speaker: N=${SESSIONS} @ ${FPS}fps x ${SECONDS}s (label ${LABEL}) ===`);
  console.log('edge:', APEX_BTP, '| relay:', RELAY_WS);
  const kids = [];
  const ready = new Map();
  const results = new Map();
  const self = fileURLToPath(import.meta.url);

  const allResults = new Promise((resolve) => {
    for (let i = 0; i < SESSIONS; i++) {
      const kid = fork(self, [], {
        env: { ...process.env, ROLE: 'child', SESSION_IDX: String(i), FPS: String(FPS), SECONDS: String(SECONDS) },
        stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
      });
      kids.push(kid);
      kid.on('message', (m) => {
        if (m.type === 'ready') {
          ready.set(m.idx, m);
          console.log(`ready s${m.idx} (${ready.size}/${SESSIONS})`, m.error ?? `${m.chain} ${m.channelId} price=${m.price}`);
          if (ready.size === SESSIONS) {
            const bad = [...ready.values()].filter((r) => r.error);
            if (bad.length) { console.error('ABORT — sessions failed setup:', bad); process.exit(1); }
            const startAt = Date.now() + 4000;
            console.log(`GO at ${new Date(startAt).toISOString()}`);
            for (const k of kids) k.send({ type: 'go', startAt });
          }
        } else if (m.type === 'result') {
          results.set(m.idx, m);
          if (results.size === SESSIONS) resolve();
        }
      });
      kid.on('exit', (code) => { if (code !== 0) console.error(`s${i} exited ${code}`); });
    }
  });

  const wallStart = new Date().toISOString();
  // Local-CPU sanity: N speakers must be limited by the edge, not by this box.
  const load = [];
  const loadTimer = setInterval(() => load.push(r1(os.loadavg()[0])), 5000);
  await allResults;
  clearInterval(loadTimer);
  const wallEnd = new Date().toISOString();
  for (const k of kids) { try { k.kill(); } catch {} }

  const rows = [...results.values()].sort((a, b) => a.idx - b.idx);
  const agg = rows.reduce((a, r) => ({
    sent: a.sent + r.sent, delivered: a.delivered + r.delivered,
    in150: a.in150 + r.in150, failures: a.failures + r.failures,
    spend: a.spend + BigInt(r.spendBaseUnits),
  }), { sent: 0, delivered: 0, in150: 0, failures: 0, spend: 0n });
  const allErrors = {};
  for (const r of rows) for (const [k, v] of Object.entries(r.errors)) allErrors[k] = (allErrors[k] ?? 0) + v;

  console.log('\n=== PER-SESSION ===');
  for (const r of rows) {
    console.log(`s${r.idx} [${r.chain}] sent=${r.sent} offered=${r1(r.offeredFps)}fps skipped=${r.skipped} delivered=${r.delivered} (${r1((r.delivered / r.sent) * 100)}%) in150=${r.in150} (${r1((r.in150 / r.sent) * 100)}%) fail=${r.failures} e2e p50/p90/p99=${r1(r.e2e.p50)}/${r1(r.e2e.p90)}/${r1(r.e2e.p99)}ms rtt p50/p90=${r1(r.rtt.p50)}/${r1(r.rtt.p90)}ms maxInFlight=${r.maxInFlight}`);
  }
  console.log('\n=== AGGREGATE ===');
  console.log(`offered ${agg.sent} frames (${r1(agg.sent / SECONDS)} fps aggregate) | delivered ${agg.delivered} (${r1((agg.delivered / agg.sent) * 100)}%) | within 150ms ${agg.in150} (${r1((agg.in150 / agg.sent) * 100)}%) | failures ${agg.failures}`);
  console.log('errors:', Object.keys(allErrors).length ? allErrors : 'none');
  console.log(`spend: ${agg.spend} base units = ${Number(agg.spend) / 1e6} USDC`);

  console.log('local 1-min loadavg samples (16 cores):', load.join(' '));
  const out = { label: LABEL, sessions: SESSIONS, fps: FPS, seconds: SECONDS, wallStart, wallEnd,
    cores: os.cpus().length, loadavg: load,
    aggregate: { ...agg, spend: agg.spend.toString() }, errors: allErrors, perSession: rows };
  fs.writeFileSync(path.join(RESULTS, `${LABEL}.json`), JSON.stringify(out, null, 1));
  console.log('wrote', path.join(RESULTS, `${LABEL}.json`));
  process.exit(0);
}

if (process.env.ROLE === 'child') {
  child().catch((err) => { console.error(`[s${process.env.SESSION_IDX}] FATAL`, err); process.exit(2); });
} else {
  parent().catch((err) => { console.error('FATAL', err); process.exit(1); });
}
