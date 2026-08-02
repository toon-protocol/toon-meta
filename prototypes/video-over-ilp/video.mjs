// Throwaway prototype: can the TOON paid-ephemeral-write pipeline carry
// streaming HD video, and where does it break?
//
// Extends the huddle-over-ilp harness (proto/huddle-multi-speaker) to
// video-scale load: same transport machinery (one BTP session to the
// connector edge, per-event payment-channel claims, free NIP-01 subscriber
// on the relay), but the frames are synthetic ENCODED-VIDEO-shaped events
// (see gen.mjs) instead of 160-byte Opus packets.
//
// Modes:
//   MODE=ladder                       serial payload-size ladder (find the byte ceiling)
//   MODE=stream PROFILE=720p STRATEGY=frame|chunk|batch [CHUNK_BYTES=16384]
//               [BATCH_MS=100] [SECONDS=30] [LABEL=x]   paced stream run
// Target:
//   TARGET=local  (default) local-stack: connector-rust + relay:latest + anvil
//   TARGET=devnet live devnet edge (COORDINATE FIRST — see RESULTS.md)

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ToonClient, generateMnemonic, deriveFullIdentity } from '@toon-protocol/client';
import { encodeEventToToon, decodeEventFromToon } from '@toon-protocol/core';
import { PROFILES, frameSchedule, buildEvents, mulberry32 } from './gen.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TARGET = process.env.TARGET ?? 'local';
const MODE = process.env.MODE ?? 'stream';
const PROFILE = { ...PROFILES[process.env.PROFILE ?? '720p'] };
if (process.env.MBPS) PROFILE.mbps = Number(process.env.MBPS);
if (process.env.FPS) PROFILE.fps = Number(process.env.FPS);
if (process.env.MBPS || process.env.FPS)
  PROFILE.name = `${PROFILE.name}-${PROFILE.mbps}Mbps-${PROFILE.fps}fps`;
const STRATEGY = process.env.STRATEGY ?? 'frame';
const CHUNK_BYTES = Number(process.env.CHUNK_BYTES ?? 16384);
const BATCH_MS = Number(process.env.BATCH_MS ?? 100);
const SECONDS = Number(process.env.SECONDS ?? 30);
const LABEL = process.env.LABEL ?? `${TARGET}-${PROFILE.name}-${STRATEGY}`;
const KIND = 20002; // ephemeral (NIP-16): broadcast-only since relay#84
const TAG = 'video-ilp';
const BUDGET_MS = 400; // "live video" bar (audio used 150ms)
const RESULTS = path.join(HERE, TARGET === 'local' ? 'results-local' : 'results-devnet');

// ── topology ───────────────────────────────────────────────────────────────
const TOPO =
  TARGET === 'local'
    ? {
        relayWs: 'ws://127.0.0.1:7100',
        btp: 'ws://127.0.0.1:3000/ilp/btp',
        connectorUrl: 'http://127.0.0.1:3000',
        dest: 'g.local.relay',
        chainKey: 'evm:31337',
        usdc: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
        tokenNetwork: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512', // TokenNetworkRegistry
        rpc: 'http://127.0.0.1:8545',
        stateDir: path.join(HERE, 'state-local'),
        deposit: '500000000', // 500 USDC of anvil monopoly money
      }
    : {
        relayWs: 'wss://relay-ws.devnet.toonprotocol.dev',
        btp: 'wss://proxy.devnet.toonprotocol.dev/rust/ilp/btp',
        connectorUrl: 'https://proxy.devnet.toonprotocol.dev/rust',
        dest: 'g.toon.relay',
        peerPubkey: '3f12da6d0cf10c91094894b88fc520757fc2860a1a5efb6664d3340ff97cfe40',
        chainKey: 'evm:84532',
        usdc: '0x49beE1Bca5d15Fb0963117923403F9498119a9Ce',
        tokenNetwork: '0x1E95493fEF46707E034b4a1945f25a8C76A1823D',
        rpc: 'https://base-sepolia-rpc.publicnode.com',
        // Reuse ONE Phase G/H funded identity (faucet ETH is dry — do NOT mint identities)
        stateDir:
          process.env.DEVNET_STATE ??
          path.join(os.homedir(), '.config', 'toon-huddle-harness', 'state-multi-phase-g'),
        mnemonicFile: process.env.DEVNET_MNEMONIC_FILE ?? 'session0.mnemonic.txt',
        deposit: process.env.DEVNET_DEPOSIT ?? '50000000', // 50 USDC — video burns fees fast
      };

// ── helpers ────────────────────────────────────────────────────────────────
const nowNs = () => process.hrtime.bigint();
const msOf = (ns) => Number(ns) / 1e6;
const pct = (arr, p) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};
const r1 = (n) => (Number.isFinite(n) ? Math.round(n * 10) / 10 : null);
const sleep = (n) => new Promise((r) => setTimeout(r, n));

// One shared random buffer sliced per event: payload CONTENT is irrelevant,
// allocation cost is not. Seeded so runs are reproducible.
const POOL = (() => {
  const rnd = mulberry32(0x51de0);
  const b = Buffer.alloc(1 << 20);
  for (let i = 0; i < b.length; i += 4) b.writeUInt32LE((rnd() * 0x100000000) >>> 0, i);
  return b;
})();
const payloadB64 = (bytes) => {
  const start = bytes % 4096;
  if (start + bytes <= POOL.length) return POOL.subarray(start, start + bytes).toString('base64');
  const n = Math.ceil((start + bytes) / POOL.length) + 1;
  return Buffer.concat(Array(n).fill(POOL)).subarray(start, start + bytes).toString('base64');
};

// ── subscriber: free NIP-01 WS (handles the historic double-encode gotcha) ──
class Subscriber {
  constructor(url, pubkey) {
    this.url = url;
    this.pubkey = pubkey;
    this.received = new Map(); // seq -> recvWall
    this.bytes = 0;
    this.single = 0;
    this.double = 0;
  }
  async start() {
    this.ws = new WebSocket(this.url);
    await new Promise((res, rej) => {
      this.ws.onopen = res;
      this.ws.onerror = (e) => rej(new Error(`subscriber WS: ${e.message ?? e}`));
    });
    this.ws.onmessage = (ev) => this.handle(ev.data.toString());
    this.ws.onclose = () => console.error('[sub] WS closed');
    this.ws.send(
      JSON.stringify([
        'REQ',
        'video',
        { kinds: [KIND], authors: [this.pubkey], since: Math.floor(Date.now() / 1000) - 5 },
      ])
    );
  }
  handle(raw) {
    const recvWall = Date.now();
    let msg;
    try {
      msg = JSON.parse(raw);
      if (typeof msg === 'string') {
        this.double++;
        msg = JSON.parse(msg);
      } else this.single++;
    } catch {
      return;
    }
    if (!Array.isArray(msg) || msg[0] !== 'EVENT') return;
    let evt = msg[2];
    if (typeof evt === 'string') {
      try {
        evt = JSON.parse(evt);
      } catch {
        return;
      }
    }
    let content;
    try {
      content = JSON.parse(evt.content);
    } catch {
      return;
    }
    if (content?.t !== TAG || content.q === undefined) return;
    if (this.received.has(content.q)) return;
    this.received.set(content.q, recvWall);
    this.bytes += raw.length;
  }
  stop() {
    try {
      this.ws?.close();
    } catch {}
  }
}

// ── client wiring (inherited from multi.mjs, Phase D-G proven) ─────────────
async function makeClient() {
  fs.mkdirSync(TOPO.stateDir, { recursive: true });
  let mnemonic;
  if (TARGET === 'local') {
    const mf = path.join(TOPO.stateDir, 'mnemonic.txt');
    if (!fs.existsSync(mf)) fs.writeFileSync(mf, generateMnemonic());
    mnemonic = fs.readFileSync(mf, 'utf8').trim();
  } else {
    mnemonic = fs.readFileSync(path.join(TOPO.stateDir, TOPO.mnemonicFile), 'utf8').trim();
  }
  const id = await deriveFullIdentity(mnemonic, 0);

  let peerPubkey = TOPO.peerPubkey;
  if (!peerPubkey) {
    // local edge identity: x-only pubkey = x coordinate of the uncompressed key
    const res = await fetch(`${TOPO.connectorUrl}/ilp/identity`);
    const idn = await res.json();
    peerPubkey = idn.publicKey.slice(4, 68);
  }

  const client = new ToonClient({
    connectorUrl: TOPO.connectorUrl,
    btpUrl: TOPO.btp,
    btpAuthToken: '',
    mnemonic,
    mnemonicAccountIndex: 0,
    ilpInfo: {
      pubkey: '00'.repeat(32),
      ilpAddress: 'g.toon.client',
      btpEndpoint: TOPO.btp,
      assetCode: 'USD',
      assetScale: 6,
    },
    toonEncoder: encodeEventToToon,
    toonDecoder: decodeEventFromToon,
    destinationAddress: TOPO.dest,
    relayUrl: '',
    knownPeers: [{ pubkey: peerPubkey, relayUrl: TOPO.relayWs, btpEndpoint: TOPO.btp }],
    channelStorePath: path.join(TOPO.stateDir, 'channels.json'),
    supportedChains: [TOPO.chainKey],
    preferredTokens: { [TOPO.chainKey]: TOPO.usdc },
    tokenNetworks: { [TOPO.chainKey]: TOPO.tokenNetwork },
    chainRpcUrls: { [TOPO.chainKey]: TOPO.rpc },
    initialDeposit: TOPO.deposit,
  });
  await client.start();
  // post-start negotiation back-fill (rig's standalone-mode gotcha)
  const negotiations = client.peerNegotiations;
  if (negotiations instanceof Map)
    for (const n of negotiations.values()) {
      if (!n.tokenNetwork) n.tokenNetwork = TOPO.tokenNetwork;
      if (!n.tokenAddress) n.tokenAddress = TOPO.usdc;
    }

  let price = 1000n;
  try {
    const q = await client.getRoutePrice(TOPO.dest);
    if (q !== null && q !== undefined) price = BigInt(q);
  } catch (err) {
    console.log('getRoutePrice failed, assuming 1000:', err.message);
  }
  const tOpen = Date.now();
  const channelId = await client.openChannel(TOPO.dest);
  console.log(`channel ${channelId} (${Date.now() - tOpen}ms) price=${price} payer=${id.evm.address}`);
  return { client, id, price, channelId };
}

function makeSender(client, channelId, price) {
  return async function send(rec, contentObj) {
    rec.sentWall = Date.now();
    rec.sentNs = nowNs();
    try {
      const event = client.signEvent({
        kind: KIND,
        created_at: Math.floor(rec.sentWall / 1000),
        tags: [['t', TAG]],
        content: JSON.stringify(contentObj),
      });
      rec.wireBytes = JSON.stringify(event).length;
      const claim = await client.signBalanceProof(channelId, price);
      const result = await client.publishEvent(event, {
        destination: TOPO.dest,
        claim,
        ilpAmount: price,
      });
      rec.doneNs = nowNs();
      rec.ok = result.success === true;
      if (!rec.ok) rec.err = `${result.error ?? ''} code=${result.code ?? ''}`.slice(0, 140).trim();
    } catch (err) {
      rec.doneNs = nowNs();
      rec.ok = false;
      rec.err = String(err.message).slice(0, 140);
    }
  };
}

// ── MODE=ladder: serial payload-size ladder ────────────────────────────────
async function ladder() {
  const { client, id, price, channelId } = await makeClient();
  const sub = new Subscriber(TOPO.relayWs, id.nostr.pubkey);
  await sub.start();
  const send = makeSender(client, channelId, price);
  const sizes = (process.env.SIZES ?? '1,2,4,8,16,32,64,96,128,192,256,384,512')
    .split(',')
    .map((k) => Number(k) * 1024);
  const REPS = 5;
  const rows = [];
  let seq = 0;
  for (const size of sizes) {
    const rtts = [];
    let ok = 0,
      delivered = 0,
      err = null,
      wire = 0;
    for (let i = 0; i < REPS; i++) {
      const q = seq++;
      const rec = {};
      await send(rec, { t: TAG, q, sw: Date.now(), d: payloadB64(size) });
      if (rec.ok) {
        ok++;
        rtts.push(msOf(rec.doneNs - rec.sentNs));
      } else err = rec.err;
      wire = rec.wireBytes ?? wire;
      await sleep(60);
      if (sub.received.has(q)) delivered++;
    }
    await sleep(800);
    let late = 0;
    for (let q = seq - REPS; q < seq; q++) if (sub.received.has(q)) late++;
    rows.push({
      sizeKB: size / 1024,
      wireBytes: wire,
      ok: `${ok}/${REPS}`,
      delivered: `${late}/${REPS}`,
      rttP50: r1(pct(rtts, 50)),
      rttMax: r1(rtts.length ? Math.max(...rtts) : null),
      err,
    });
    console.log(rows.at(-1));
    if (ok === 0) break; // ceiling found
  }
  fs.mkdirSync(RESULTS, { recursive: true });
  const out = path.join(RESULTS, `ladder-${LABEL}.json`);
  fs.writeFileSync(out, JSON.stringify({ target: TARGET, price: price.toString(), rows }, null, 1));
  console.log('wrote', out);
  sub.stop();
  try {
    await client.stop();
  } catch {}
  process.exit(0);
}

// ── MODE=stream: paced video-shaped run ────────────────────────────────────
async function stream() {
  console.log(
    `=== video-over-ilp: ${TARGET} ${PROFILE.name}@${PROFILE.mbps}Mbps ${STRATEGY}` +
      `${STRATEGY === 'chunk' ? `(${CHUNK_BYTES}B)` : STRATEGY === 'batch' ? `(${BATCH_MS}ms)` : ''}` +
      ` x ${SECONDS}s (label ${LABEL}) ===`
  );
  const frames = frameSchedule(PROFILE, SECONDS, 7);
  const events = buildEvents(STRATEGY, frames, { chunkBytes: CHUNK_BYTES, batchMs: BATCH_MS });
  const offeredBytes = events.reduce((a, e) => a + e.payloadBytes, 0);
  console.log(
    `schedule: ${frames.length} frames -> ${events.length} events, ` +
      `${r1(events.length / SECONDS)} ev/s, avg ${r1(offeredBytes / events.length / 1024)}KB/ev, ` +
      `offered ${r1((offeredBytes * 8) / SECONDS / 1e6)}Mbps`
  );
  // pre-render payloads (base64 of pooled random bytes) so the send loop
  // does no bulk allocation
  const payloads = events.map((e) => payloadB64(e.payloadBytes));

  const { client, id, price, channelId } = await makeClient();
  const sub = new Subscriber(TOPO.relayWs, id.nostr.pubkey);
  await sub.start();
  // fan-out: SUBS-1 extra free listeners (local relay CPU / per-listener cost)
  const extraSubs = [];
  for (let i = 1; i < Number(process.env.SUBS ?? 1); i++) {
    const s = new Subscriber(TOPO.relayWs, id.nostr.pubkey);
    await s.start();
    extraSubs.push(s);
  }
  const send = makeSender(client, channelId, price);

  // warm-up probe
  const probe = {};
  await send(probe, { t: TAG, q: -1, sw: Date.now(), d: payloadB64(1024) });
  await sleep(1500);
  console.log('probe ok=', probe.ok, 'delivered=', sub.received.has(-1), probe.err ?? '');
  if (!probe.ok) {
    console.error('ABORT: probe failed');
    process.exit(1);
  }

  // paced send: fire each event at its scheduled time. Video-encoder
  // semantics: late events still go (encoder output queues, it does not
  // evaporate) — lateness shows up honestly in capture-to-delivery e2e.
  const recs = new Map();
  let inFlight = 0,
    maxInFlight = 0,
    sendLagMax = 0;
  const t0 = Date.now() + 250;
  await sleep(250);
  for (const e of events) {
    const wait = t0 + e.sendAtMs - Date.now();
    if (wait > 0) await sleep(wait);
    const lag = Date.now() - (t0 + e.sendAtMs);
    if (lag > sendLagMax) sendLagMax = lag;
    const rec = { seq: e.seq, scheduledWall: t0 + e.sendAtMs };
    recs.set(e.seq, rec);
    inFlight++;
    if (inFlight > maxInFlight) maxInFlight = inFlight;
    send(rec, { t: TAG, q: e.seq, sw: Date.now(), d: payloads[e.seq] }).finally(() => inFlight--);
  }
  const sendDone = Date.now();
  const drainStart = Date.now();
  while (inFlight > 0 && Date.now() - drainStart < 60000) await sleep(100);
  await sleep(3000);

  // ── analysis ──────────────────────────────────────────────────────────────
  const evRtts = [],
    errors = {};
  let evOk = 0,
    evFail = 0,
    evDelivered = 0,
    wireBytes = 0;
  for (const r of recs.values()) {
    if (r.doneNs && r.sentNs) evRtts.push(msOf(r.doneNs - r.sentNs));
    if (r.ok) evOk++;
    else if (r.ok === false) {
      evFail++;
      errors[r.err ?? 'unknown'] = (errors[r.err ?? 'unknown'] ?? 0) + 1;
    }
    if (sub.received.has(r.seq)) evDelivered++;
    wireBytes += r.wireBytes ?? 0;
  }
  // frame completion: every event that carries part of the frame arrived
  const frameEvents = new Map(); // frameIdx -> [seq]
  for (const e of events)
    for (const f of e.frames) {
      if (!frameEvents.has(f.idx)) frameEvents.set(f.idx, []);
      frameEvents.get(f.idx).push(e.seq);
    }
  const e2es = [];
  let fDelivered = 0,
    fInBudget = 0,
    fIn1s = 0,
    goodputBytes = 0;
  const BUCKET_S = 5;
  const buckets = Array.from({ length: Math.ceil(SECONDS / BUCKET_S) }, () => []);
  for (const f of frames) {
    const seqs = frameEvents.get(f.idx) ?? [];
    const recvs = seqs.map((q) => sub.received.get(q));
    if (recvs.some((r) => r === undefined)) continue;
    fDelivered++;
    goodputBytes += f.bytes;
    const captureWall = t0 + f.captureMs;
    const e2e = Math.max(...recvs) - captureWall;
    e2es.push(e2e);
    if (e2e <= BUDGET_MS) fInBudget++;
    if (e2e <= 1000) fIn1s++;
    const b = Math.floor(f.captureMs / (BUCKET_S * 1000));
    if (b >= 0 && b < buckets.length) buckets[b].push(e2e);
  }
  const runWall = (sendDone - t0) / 1000;
  const summary = {
    label: LABEL,
    target: TARGET,
    profile: PROFILE.name,
    mbps: PROFILE.mbps,
    strategy: STRATEGY,
    chunkBytes: STRATEGY === 'chunk' ? CHUNK_BYTES : undefined,
    batchMs: STRATEGY === 'batch' ? BATCH_MS : undefined,
    seconds: SECONDS,
    price: price.toString(),
    schedule: {
      frames: frames.length,
      events: events.length,
      evPerSec: r1(events.length / SECONDS),
      avgEventKB: r1(offeredBytes / events.length / 1024),
      offeredMbps: r1((offeredBytes * 8) / SECONDS / 1e6),
    },
    eventsOut: {
      ok: evOk,
      failed: evFail,
      delivered: evDelivered,
      errors,
      rtt: { p50: r1(pct(evRtts, 50)), p90: r1(pct(evRtts, 90)), p99: r1(pct(evRtts, 99)) },
      maxInFlight,
      sendLagMaxMs: sendLagMax,
      sendOverrunSec: r1(runWall - SECONDS),
      wireMB: r1(wireBytes / 1e6),
      wireExpansion: r1(wireBytes / offeredBytes),
    },
    framesOut: {
      delivered: fDelivered,
      of: frames.length,
      deliveredPct: r1((fDelivered / frames.length) * 100),
      inBudgetPct: r1((fInBudget / frames.length) * 100),
      in1sPct: r1((fIn1s / frames.length) * 100),
      e2e: {
        p50: r1(pct(e2es, 50)),
        p95: r1(pct(e2es, 95)),
        p99: r1(pct(e2es, 99)),
        max: r1(e2es.length ? Math.max(...e2es) : null),
      },
      goodputMbps: r1((goodputBytes * 8) / Math.max(runWall, SECONDS) / 1e6),
    },
    e2eOverTime: buckets.map((b, i) => ({
      fromSec: i * BUCKET_S,
      n: b.length,
      p50: r1(pct(b, 50)),
      p95: r1(pct(b, 95)),
      inBudgetPct: b.length ? r1((b.filter((x) => x <= BUDGET_MS).length / b.length) * 100) : null,
    })),
    spend: {
      baseUnits: (price * BigInt(evOk)).toString(),
      usdc: Number(price * BigInt(evOk)) / 1e6,
      usdcPerMin: r1((Number(price * BigInt(evOk)) / 1e6) * (60 / SECONDS) * 10) / 10,
      dustUsdcPerMin: (evOk * (60 / SECONDS)) / 1e6,
    },
    encodings: { single: sub.single, double: sub.double },
    subscriberWireMB: r1(sub.bytes / 1e6),
    fanout:
      extraSubs.length > 0
        ? {
            listeners: extraSubs.length + 1,
            perSubDelivered: [sub, ...extraSubs].map((s) => s.received.size),
            totalRelayEgressMB: r1([sub, ...extraSubs].reduce((a, s) => a + s.bytes, 0) / 1e6),
          }
        : undefined,
  };
  console.log(JSON.stringify(summary, null, 1));
  fs.mkdirSync(RESULTS, { recursive: true });
  const out = path.join(RESULTS, `${LABEL}.json`);
  fs.writeFileSync(out, JSON.stringify(summary, null, 1));
  console.log('wrote', out);
  sub.stop();
  try {
    await client.stop();
  } catch {}
  process.exit(0);
}

(MODE === 'ladder' ? ladder() : stream()).catch((err) => {
  console.error('FATAL', err);
  process.exit(1);
});
