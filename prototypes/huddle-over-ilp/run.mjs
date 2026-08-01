// Throwaway prototype: can live huddle audio frames stream over TOON
// (per-frame ILP-paid Nostr publishes) via the live devnet, and is it practical?
//
//   node prototypes/huddle-over-ilp/run.mjs
//
// Phases: SERIAL (200 sequential publishes), PACED (50fps x 30s fire-and-forget),
// FLOOD (uncapped pipelining for 10s). Subscriber = second free NIP-01 WS
// connection to the relay; frames carry seq + wall-clock send time in content.
//
// Fresh NIP-06 identity from a generated mnemonic; faucet-funded; self-opened
// EVM (base-sepolia USDC) payment channel. NEVER touches the daemon's key/channel.
//
// Wiring follows rig's live-proven standalone mode (~/Documents/rig
// packages/rig/src/cli/standalone-mode.ts): ILP-over-HTTP proxy uplink (no BTP
// socket), dummy ilpInfo, hand-wired chain maps (never network:'devnet'),
// post-start peerNegotiations back-fill, live kind:10032 announce as topology
// authority.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ToonClient,
  generateMnemonic,
  deriveFullIdentity,
  fundWallet,
  readSolanaTokenBalance,
  readSolanaNativeBalance,
} from '@toon-protocol/client';
import { encodeEventToToon, decodeEventFromToon } from '@toon-protocol/core';

// ---------------------------------------------------------------------------
// Live devnet topology — values read from the live kind:10032 self-announce
// (fetched 2026-07-31; the announce is authoritative over any preset).
// Announce (payment peer 2813187e…): ilpAddress g.toon.relay, os.publish price
// 1000 @ USDC scale 6, settlement evm:84532 (base-sepolia).
// ---------------------------------------------------------------------------
const RELAY_WS = 'wss://relay-ws.devnet.toonprotocol.dev';
const PROXY_URL = 'https://proxy.devnet.toonprotocol.dev/rust/ilp'; // ILP-over-HTTP uplink
// Client-facing BTP websocket ingress (rust-sha-bb8e12c, connector#680):
// binary BTP frames, empty-secret auth MESSAGE, `payment-channel-claim`
// protocolData JSON -> same ClientClaimGate as HTTP; strictly in-arrival-order
// processing per session. Bypasses nginx limit_req (only the upgrade request
// is rate-limited).
const APEX_BTP = 'wss://proxy.devnet.toonprotocol.dev/rust/ilp/btp';
// NOT the genesis-seed pubkey 2813187e… — that identity's announce is STALE
// (also claims g.toon.relay); the LIVE Rust edge identity is 3f12da6d… (its
// announce settlement addresses match the connector's live x402 challenge).
// Anchoring the channel to the stale peer yields F01 "no record of channel".
const GENESIS_PEER_PUBKEY = '3f12da6d0cf10c91094894b88fc520757fc2860a1a5efb6664d3340ff97cfe40';
const DEST_ANCHOR = 'g.toon.relay'; // announce ilpAddress (channel anchor)
const PUBLISH_DEST = 'g.toon.relay'; // announce routes.publish
const FAUCET = 'https://faucet.devnet.toonprotocol.dev';
// Settlement pivoted EVM -> Solana: the TOON faucet is USDC-only on every
// chain (no native gas), base-sepolia ETH faucets are captcha-gated, but
// devnet SOL is obtainable (airdrop / manual send). Announce + core preset
// agree on all solana:devnet params.
const RPC = 'https://api.devnet.solana.com';
const USDC = 'xyc5J8MgKFiEN13PnfftdXxUzYH34FEvw1LCrFwN7in'; // SPL USDC mint (announce preferredTokens)
const TOKEN_NETWORK = '2aEVJ8koKD8LTZrLRSGtAtU7LBt4e7QjjCgf1kzQ7Rip'; // channel program (announce tokenNetworks)
const CHAIN_KEYS = ['solana:devnet'];

const EPHEMERAL_KIND = 20001; // try ephemeral first; fall back to kind 1
const FALLBACK_KIND = 1;
const TAG = 'huddle-proto';
const FRAME_BYTES = 160; // ~20ms Opus payload

let PUBLISH_PRICE = 1000n; // announced os.publish price; re-quoted live at startup

// Phase D: TRANSPORT=btp runs the same measurement over a persistent BTP
// WebSocket to the apex instead of per-request ILP-over-HTTP. Hypothesis:
// the nginx-503 admission ceiling and F01 out-of-order-claim races are
// HTTP-ingress artifacts an ordered socket removes.
const TRANSPORT = process.env.TRANSPORT === 'btp' ? 'btp' : 'http';
const PROBE_ONLY = process.env.PROBE_ONLY === '1'; // exit after the kind probe
const STRETCH = process.env.STRETCH === '1'; // extra paced 100fps x 10s phase

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const nowNs = () => process.hrtime.bigint();
const ms = (ns) => Number(ns) / 1e6;
const pct = (arr, p) => {
  if (arr.length === 0) return NaN;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};
const fmt = (n) => (Number.isFinite(n) ? n.toFixed(1) : 'n/a');
const stats = (arr) =>
  arr.length === 0
    ? 'n=0'
    : `n=${arr.length} p50=${fmt(pct(arr, 50))}ms p90=${fmt(pct(arr, 90))}ms p99=${fmt(pct(arr, 99))}ms max=${fmt(Math.max(...arr))}ms`;
const randomPayload = () =>
  Buffer.from(crypto.getRandomValues(new Uint8Array(FRAME_BYTES))).toString('base64');
const sleep = (msec) => new Promise((r) => setTimeout(r, msec));

// ---------------------------------------------------------------------------
// Subscriber: free NIP-01 WS, second connection. Handles single- AND
// double-JSON-encoded EVENT frames (devnet relay historically double-encodes).
// Correlates frames by seq embedded in event content.
// ---------------------------------------------------------------------------
class Subscriber {
  constructor(pubkey) {
    this.pubkey = pubkey;
    this.received = new Map(); // seq -> { recvNs, recvWall }
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
    this.ws.onerror = (e) => console.error('[sub] WS error', e.message ?? e);
    this.ws.onclose = () => console.error('[sub] WS closed');
    this.ws.send(
      JSON.stringify([
        'REQ',
        'huddle',
        {
          kinds: [EPHEMERAL_KIND, FALLBACK_KIND],
          authors: [this.pubkey],
          since: Math.floor(Date.now() / 1000) - 5,
        },
      ])
    );
  }
  handle(raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
      if (typeof msg === 'string') {
        this.doubleEncoded++;
        msg = JSON.parse(msg); // devnet double-encoding gotcha
      } else {
        this.singleEncoded++;
      }
    } catch {
      return;
    }
    if (!Array.isArray(msg) || msg[0] !== 'EVENT') return;
    let evt = msg[2];
    if (typeof evt === 'string') {
      try { evt = JSON.parse(evt); } catch { return; }
    }
    let content;
    try { content = JSON.parse(evt.content); } catch { return; }
    if (content?.t !== TAG || content.seq === undefined) return;
    if (this.received.has(content.seq)) return; // dedupe
    this.received.set(content.seq, { recvNs: nowNs(), recvWall: Date.now(), sentWall: content.sw });
  }
  stop() { try { this.ws?.close(); } catch {} }
}

// ---------------------------------------------------------------------------
// Client wiring
// ---------------------------------------------------------------------------
function buildConfig(mnemonic, initialDeposit) {
  const keyed = (v) => Object.fromEntries(CHAIN_KEYS.map((k) => [k, v]));
  return {
    // BTP mode: no proxyUrl (HTTP wins whenever an httpEndpoint exists).
    // connectorUrl must still be the REAL edge base: publishEvent fetches
    // GET <connectorUrl>/ilp/identity to seal the response envelope even
    // when the ILP packets ride BTP (rig's dummy-URL convention breaks it).
    ...(TRANSPORT === 'btp'
      ? {
          connectorUrl: 'https://proxy.devnet.toonprotocol.dev/rust',
          btpUrl: APEX_BTP,
          btpAuthToken: '',
        }
      : { proxyUrl: PROXY_URL }),
    mnemonic,
    mnemonicAccountIndex: 0,
    ilpInfo: {
      pubkey: '00'.repeat(32),
      ilpAddress: 'g.toon.client',
      btpEndpoint: TRANSPORT === 'btp' ? APEX_BTP : '',
      assetCode: 'USD',
      assetScale: 6,
    },
    toonEncoder: encodeEventToToon,
    toonDecoder: decodeEventFromToon,
    destinationAddress: DEST_ANCHOR,
    relayUrl: '', // deliberate: knownPeers[i].relayUrl is what bootstrap queries
    knownPeers: [
      { pubkey: GENESIS_PEER_PUBKEY, relayUrl: RELAY_WS, btpEndpoint: APEX_BTP },
    ],
    channelStorePath: path.join(HERE, 'state', 'channels.json'),
    supportedChains: [...CHAIN_KEYS],
    preferredTokens: keyed(USDC),
    tokenNetworks: keyed(TOKEN_NETWORK),
    chainRpcUrls: keyed(RPC),
    solanaChannel: { rpcUrl: RPC, programId: TOKEN_NETWORK, tokenMint: USDC },
    initialDeposit,
  };
}

/** rig's #260 negotiationFallbacks patch: back-fill announce gaps post-start. */
function patchNegotiations(client) {
  const negotiations = client.peerNegotiations;
  if (!(negotiations instanceof Map)) {
    console.warn('WARN: client.peerNegotiations not exposed — channel open may fail');
    return;
  }
  for (const n of negotiations.values()) {
    if (!n.tokenNetwork) n.tokenNetwork = TOKEN_NETWORK;
    if (!n.tokenAddress) n.tokenAddress = USDC;
  }
  console.log('negotiations:', [...negotiations.entries()].map(([k, n]) =>
    `${k.slice(0, 8)}:${n.chain} tn=${n.tokenNetwork?.slice(0, 10)}`).join(' | '));
}

async function usdcBalance(owner) {
  const b = await readSolanaTokenBalance({ rpcUrl: RPC, mint: USDC, owner });
  return BigInt(b.balance ?? b.amount ?? 0);
}

async function solBalance(owner) {
  const g = await readSolanaNativeBalance({ rpcUrl: RPC, owner });
  return BigInt(g.amount ?? g.balance ?? 0);
}

async function fundAndWait(solAddress) {
  console.log('requesting faucet drip for', solAddress, '...');
  const before = await usdcBalance(solAddress).catch(() => 0n);
  try {
    await fundWallet(FAUCET, solAddress, 'solana', { timeout: 90_000 });
    console.log('faucet drip request accepted');
  } catch (err) {
    console.error('faucet drip request FAILED:', err.message);
  }
  // Poll until USDC lands.
  const deadline = Date.now() + 120_000;
  let bal = before;
  while (Date.now() < deadline) {
    bal = await usdcBalance(solAddress).catch(() => bal);
    if (bal > before && bal > 0n) break;
    await sleep(3000);
  }
  const gas = await solBalance(solAddress).catch(() => 0n);
  console.log(`balances after drip: USDC=${bal} (base units) SOL=${gas} lamports`);
  return { usdc: bal, gas };
}

let seqCounter = 0;
function makeFrame(kind, client) {
  const seq = seqCounter++;
  const sentNs = nowNs();
  const sentWall = Date.now();
  const event = client.signEvent({
    kind,
    created_at: Math.floor(sentWall / 1000),
    tags: [['t', TAG]],
    content: JSON.stringify({ t: TAG, seq, sw: sentWall, d: randomPayload() }),
  });
  return { seq, sentNs, sentWall, event };
}

async function publishFrame(client, channelId, kind) {
  const frame = makeFrame(kind, client);
  const claim = await client.signBalanceProof(channelId, PUBLISH_PRICE);
  const result = await client.publishEvent(frame.event, {
    destination: PUBLISH_DEST,
    claim,
    ilpAmount: PUBLISH_PRICE,
  });
  frame.doneNs = nowNs();
  frame.ok = result.success === true;
  if (!frame.ok) frame.error = `${result.error ?? ''} code=${result.code ?? ''} refusedBy=${result.refusedBy ?? ''}`;
  return frame;
}

// ---------------------------------------------------------------------------
// Phases
// ---------------------------------------------------------------------------
async function phaseSerial(client, channelId, sub, kind, count) {
  console.log(`\n=== PHASE A: SERIAL x${count} (kind ${kind}) ===`);
  const rtts = [];
  const e2es = [];
  let failures = 0;
  const frames = [];
  for (let i = 0; i < count; i++) {
    try {
      const f = await publishFrame(client, channelId, kind);
      frames.push(f);
      if (f.ok) rtts.push(ms(f.doneNs - f.sentNs));
      else { failures++; if (failures <= 3) console.error(`  [serial] publish fail seq=${f.seq}: ${f.error}`); }
    } catch (err) {
      failures++;
      if (failures <= 3) console.error(`  [serial] publish threw: ${err.message}`);
    }
  }
  await sleep(3000); // let stragglers arrive
  for (const f of frames) {
    const rec = sub.received.get(f.seq);
    if (rec) e2es.push(rec.recvWall - f.sentWall);
  }
  const delivered = e2es.length;
  console.log(`publish RTT: ${stats(rtts)}`);
  console.log(`e2e (publish->subscriber): ${stats(e2es)}`);
  console.log(`delivered ${delivered}/${count} (${((delivered / count) * 100).toFixed(1)}%), publish failures: ${failures}`);
  return { rtts, e2es, delivered, count, failures };
}

async function phasePaced(client, channelId, sub, kind, fps, seconds) {
  const total = fps * seconds;
  const tickMs = 1000 / fps;
  console.log(`\n=== PHASE B: PACED ${fps}fps x ${seconds}s (${total} frames, kind ${kind}) ===`);
  const frames = new Map();
  let inFlight = 0, maxInFlight = 0, failures = 0, sent = 0;
  const errors = new Map();
  const start = Date.now();
  await new Promise((resolve) => {
    const timer = setInterval(() => {
      if (sent >= total) { clearInterval(timer); resolve(); return; }
      sent++;
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      const frame = makeFrame(kind, client);
      frames.set(frame.seq, frame);
      (async () => {
        try {
          const claim = await client.signBalanceProof(channelId, PUBLISH_PRICE);
          const result = await client.publishEvent(frame.event, {
            destination: PUBLISH_DEST, claim, ilpAmount: PUBLISH_PRICE,
          });
          frame.doneNs = nowNs();
          frame.ok = result.success === true;
          if (!frame.ok) {
            failures++;
            const k = `${result.error ?? ''} code=${result.code ?? ''}`.slice(0, 90);
            errors.set(k, (errors.get(k) ?? 0) + 1);
          }
        } catch (err) {
          failures++;
          const k = String(err.message).slice(0, 90);
          errors.set(k, (errors.get(k) ?? 0) + 1);
        } finally { inFlight--; }
      })();
    }, tickMs);
  });
  // drain
  const drainStart = Date.now();
  while (inFlight > 0 && Date.now() - drainStart < 30000) await sleep(100);
  await sleep(3000);
  const wallDur = (Date.now() - start) / 1000;

  const e2es = [], rtts = [];
  let deliveredIn150 = 0;
  for (const f of frames.values()) {
    if (f.doneNs) rtts.push(ms(f.doneNs - f.sentNs));
    const rec = sub.received.get(f.seq);
    if (rec) {
      const e2e = rec.recvWall - f.sentWall;
      e2es.push(e2e);
      if (e2e <= 150) deliveredIn150++;
    }
  }
  const delivered = e2es.length;
  console.log(`sent ${sent} in ${wallDur.toFixed(1)}s (target ${seconds}s) — effective send rate ${(sent / wallDur).toFixed(1)}fps`);
  console.log(`publish RTT: ${stats(rtts)}`);
  console.log(`e2e: ${stats(e2es)}`);
  console.log(`delivered: ${delivered}/${sent} (${((delivered / sent) * 100).toFixed(1)}%) | within 150ms: ${deliveredIn150}/${sent} (${((deliveredIn150 / sent) * 100).toFixed(1)}%)`);
  console.log(`max in-flight: ${maxInFlight} | publish failures: ${failures}`);
  if (errors.size) console.log('errors:', Object.fromEntries(errors));
  return { sent, delivered, deliveredIn150, e2es, rtts, maxInFlight, failures, errors, wallDur };
}

async function phaseFlood(client, channelId, sub, kind, seconds, budgetFrames, maxPipeline = 64) {
  console.log(`\n=== PHASE C: FLOOD ${seconds}s (pipeline cap ${maxPipeline}, budget ${budgetFrames} frames, kind ${kind}) ===`);
  const frames = new Map();
  let inFlight = 0, completed = 0, failures = 0, sent = 0;
  const deadline = Date.now() + seconds * 1000;
  const errors = new Map();
  const start = Date.now();
  await new Promise((resolve) => {
    let done = false;
    const finish = () => { if (!done && inFlight === 0) { done = true; resolve(); } };
    const pump = () => {
      while (inFlight < maxPipeline && Date.now() < deadline && sent < budgetFrames) {
        sent++;
        inFlight++;
        const frame = makeFrame(kind, client);
        frames.set(frame.seq, frame);
        (async () => {
          try {
            const claim = await client.signBalanceProof(channelId, PUBLISH_PRICE);
            const result = await client.publishEvent(frame.event, {
              destination: PUBLISH_DEST, claim, ilpAmount: PUBLISH_PRICE,
            });
            frame.doneNs = nowNs();
            if (result.success === true) completed++;
            else { failures++; const k = `${result.error ?? ''} code=${result.code ?? ''}`.slice(0, 90); errors.set(k, (errors.get(k) ?? 0) + 1); }
          } catch (err) {
            failures++;
            const k = String(err.message).slice(0, 90);
            errors.set(k, (errors.get(k) ?? 0) + 1);
          } finally {
            inFlight--;
            if (Date.now() < deadline && sent < budgetFrames) setImmediate(pump);
            else finish();
          }
        })();
      }
      if (inFlight === 0) finish();
    };
    pump();
  });
  const wallDur = (Date.now() - start) / 1000;
  await sleep(3000);
  let deliveredCount = 0;
  const rtts = [];
  for (const f of frames.values()) {
    if (f.doneNs) rtts.push(ms(f.doneNs - f.sentNs));
    if (sub.received.has(f.seq)) deliveredCount++;
  }
  console.log(`sent ${sent}, completed ${completed}, failures ${failures} in ${wallDur.toFixed(1)}s`);
  console.log(`sustained completed throughput: ${(completed / wallDur).toFixed(1)} frames/sec`);
  console.log(`subscriber saw ${deliveredCount}/${sent}`);
  console.log(`publish RTT under flood: ${stats(rtts)}`);
  if (errors.size) console.log('errors:', Object.fromEntries(errors));
  return { sent, completed, failures, wallDur, deliveredCount, rtts, errors };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('=== huddle-over-ilp prototype ===');
  console.log('transport:', TRANSPORT, '| relay:', RELAY_WS, '| uplink:',
    TRANSPORT === 'btp' ? APEX_BTP : PROXY_URL, '| publish dest:', PUBLISH_DEST);
  fs.mkdirSync(path.join(HERE, 'state'), { recursive: true });

  // ── fresh identity (persisted across reruns so faucet funds aren't stranded) ──
  const mnemonicPath = path.join(HERE, 'state', 'mnemonic.txt');
  let mnemonic;
  if (fs.existsSync(mnemonicPath)) {
    mnemonic = fs.readFileSync(mnemonicPath, 'utf8').trim();
    console.log('reusing persisted throwaway identity from state/mnemonic.txt');
  } else {
    mnemonic = generateMnemonic();
    fs.writeFileSync(mnemonicPath, mnemonic + '\n');
  }
  const id = await deriveFullIdentity(mnemonic, 0);
  console.log('identity — nostr pubkey:', id.nostr.pubkey);
  console.log('solana address:', id.solana.publicKey);

  // ── faucet (skipped when the wallet is already funded) ──
  const owner = id.solana.publicKey;
  let usdc = await usdcBalance(owner).catch(() => 0n);
  let gas = await solBalance(owner).catch(() => 0n);
  console.log(`pre-run balances: USDC=${usdc} SOL=${gas} lamports`);
  if (usdc < 2_500_000n) {
    ({ usdc, gas } = await fundAndWait(owner));
    if (usdc === 0n) {
      console.log('no USDC after first drip; retrying once...');
      ({ usdc, gas } = await fundAndWait(owner));
    }
  }
  if (usdc === 0n) throw new Error('faucet produced no USDC — cannot fund channel');
  if (gas === 0n) console.warn('WARN: zero native SOL — on-chain channel open will likely fail');

  // ── budget: keep a little USDC back; cap deposit at 4 USDC ──
  const deposit = usdc > 4_000_000n ? 4_000_000n : usdc;
  console.log(`channel initialDeposit: ${deposit} base units (${Number(deposit) / 1e6} USDC)`);

  // ── client ──
  const client = new ToonClient(buildConfig(mnemonic, deposit.toString()));
  console.log(`starting client (${TRANSPORT === 'btp' ? 'BTP websocket' : 'ILP-over-HTTP'} uplink)...`);
  await client.start();
  patchNegotiations(client);

  // live fee quote
  try {
    const quoted = await client.getRoutePrice(PUBLISH_DEST);
    if (quoted !== null && quoted !== undefined) PUBLISH_PRICE = quoted;
  } catch (err) {
    console.warn('getRoutePrice failed, using announced 1000:', err.message);
  }
  console.log(`fee per event (live quote): ${PUBLISH_PRICE} base units = ${Number(PUBLISH_PRICE) / 1e6} USDC`);
  const affordable = Number(deposit / (PUBLISH_PRICE === 0n ? 1n : PUBLISH_PRICE));
  console.log(`affordable events at this fee: ~${affordable}`);

  console.log('opening channel to', DEST_ANCHOR, '...');
  const t0 = Date.now();
  const channelId = await client.openChannel(DEST_ANCHOR);
  console.log(`channel open: ${channelId} (${Date.now() - t0}ms)`);

  // ── subscriber (second, free WS) ──
  const sub = new Subscriber(id.nostr.pubkey);
  await sub.start();
  console.log('subscriber connected (second WS)');

  // ── kind probe: ephemeral first, fallback kind 1 ──
  let kind = EPHEMERAL_KIND;
  console.log(`\nprobing ephemeral kind ${EPHEMERAL_KIND}...`);
  try {
    const probe = await publishFrame(client, channelId, EPHEMERAL_KIND);
    await sleep(2500);
    if (probe.ok && sub.received.has(probe.seq)) {
      console.log('ephemeral kind works end-to-end');
    } else {
      console.log(`ephemeral: publishOk=${probe.ok} err=${probe.error ?? 'none'} subscriberSaw=${sub.received.has(probe.seq)} -> falling back to kind 1`);
      kind = FALLBACK_KIND;
    }
  } catch (err) {
    console.log(`ephemeral probe threw (${err.message}) -> falling back to kind 1`);
    kind = FALLBACK_KIND;
  }
  if (kind === FALLBACK_KIND) {
    const probe2 = await publishFrame(client, channelId, FALLBACK_KIND);
    await sleep(2500);
    console.log(`kind 1 probe: publishOk=${probe2.ok} err=${probe2.error ?? 'none'} subscriberSaw=${sub.received.has(probe2.seq)}`);
    if (!probe2.ok) throw new Error(`kind 1 probe also failed: ${probe2.error}`);
  }

  if (PROBE_ONLY) {
    console.log('\nPROBE_ONLY=1 — probe verified, exiting before phases.');
    sub.stop();
    if (client.isStarted?.() !== false) await client.stop();
    process.exit(0);
  }

  // ── budget-aware phase plan ──
  let serialCount = 200, pacedSeconds = 30;
  if (affordable < 2400) {
    pacedSeconds = affordable >= 1200 ? 10 : 5;
    if (affordable < 600) serialCount = 100;
    console.log(`NOTE: budget-limited run — serial=${serialCount}, paced=${pacedSeconds}s`);
  }

  const serial = await phaseSerial(client, channelId, sub, kind, serialCount);
  const paced = await phasePaced(client, channelId, sub, kind, 50, pacedSeconds);
  const floodBudget = Math.max(0, affordable - seqCounter - 50);
  const flood = await phaseFlood(client, channelId, sub, kind, 10, floodBudget);
  let stretch = null;
  if (STRETCH) stretch = await phasePaced(client, channelId, sub, kind, 100, 10);

  // ── summary ──
  console.log('\n=== SUMMARY ===');
  console.log('fee per event:', PUBLISH_PRICE.toString(), 'base units =', Number(PUBLISH_PRICE) / 1e6, 'USDC');
  console.log('cost per speaker-minute (3000 frames):', (Number(PUBLISH_PRICE) * 3000) / 1e6, 'USDC');
  console.log('subscriber frame encodings — single:', sub.singleEncoded, 'double:', sub.doubleEncoded);
  console.log(JSON.stringify({
    kind,
    feePerEvent: PUBLISH_PRICE.toString(),
    serial: { delivered: serial.delivered, count: serial.count, failures: serial.failures,
      rtt: { p50: pct(serial.rtts, 50), p90: pct(serial.rtts, 90), p99: pct(serial.rtts, 99) },
      e2e: { p50: pct(serial.e2es, 50), p90: pct(serial.e2es, 90), p99: pct(serial.e2es, 99) } },
    paced: { sent: paced.sent, delivered: paced.delivered, in150: paced.deliveredIn150,
      maxInFlight: paced.maxInFlight, failures: paced.failures,
      e2e: { p50: pct(paced.e2es, 50), p90: pct(paced.e2es, 90), p99: pct(paced.e2es, 99) } },
    flood: { sent: flood.sent, completed: flood.completed, failures: flood.failures,
      sustainedFps: flood.completed / flood.wallDur },
    ...(stretch ? { stretch100: { sent: stretch.sent, delivered: stretch.delivered,
      in150: stretch.deliveredIn150, failures: stretch.failures,
      e2e: { p50: pct(stretch.e2es, 50), p90: pct(stretch.e2es, 90), p99: pct(stretch.e2es, 99) } } } : {}),
  }, null, 1));

  sub.stop();
  if (client.isStarted?.() !== false) await client.stop();
  process.exit(0);
}

main().catch((err) => {
  console.error('\nFATAL:', err);
  process.exit(1);
});
