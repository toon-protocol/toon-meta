// TOON relay writer: paced / burst / max POST /write, dev-mode (no verify),
// matching the planned "skip verify for paid ephemeral kinds" relay.
// Event content starts with a 16-digit micros timestamp; dummy id/sig
// (dev mode verifies neither; upstream payment/verify is the connector's job
// in prod and a shim's job in the SpacetimeDB scenario — excluded both sides).
import http from 'node:http';

const MODE = process.env.MODE ?? 'paced';
const RATE = Number(process.env.RATE ?? '50');
const DUR_MS = Number(process.env.DUR_MS ?? '30000');
const SIZE = Number(process.env.SIZE ?? '160');
const COUNT = Number(process.env.COUNT ?? '1000');
const KIND = Number(process.env.KIND ?? '20001');
const INFLIGHT = Number(process.env.INFLIGHT ?? '64');
const URL = process.env.RELAY_WRITE ?? 'http://127.0.0.1:3100/write';

const agent = new http.Agent({ keepAlive: true, maxSockets: INFLIGHT });
const { hostname, port, pathname } = new URL2(URL);
function URL2(u) {
  const p = new globalThis.URL(u);
  return { hostname: p.hostname, port: p.port, pathname: p.pathname };
}

function nowMicros() {
  return (performance.timeOrigin + performance.now()) * 1000;
}

let seq = 0;
function makeEvent() {
  seq++;
  const sentAt = String(Math.round(nowMicros())).padStart(16, '0');
  const content = (sentAt + ':' + 'x'.repeat(SIZE)).slice(0, Math.max(SIZE, 17));
  return {
    id: String(seq).padStart(64, 'a'),
    pubkey: 'b'.repeat(64),
    created_at: Math.floor(Date.now() / 1000),
    kind: KIND,
    tags: [],
    content,
    sig: 'c'.repeat(128),
  };
}

function post(event) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ event });
    const req = http.request(
      { hostname, port, path: pathname, method: 'POST', agent, headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) } },
      (res) => {
        res.resume();
        res.on('end', () => (res.statusCode === 200 ? resolve() : reject(new Error('status ' + res.statusCode))));
      }
    );
    req.on('error', reject);
    req.end(body);
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ackLat = [];
let sent = 0;
let acked = 0;
let failed = 0;

async function main() {
  const t0 = performance.now();
  if (MODE === 'paced') {
    const interval = 1000 / RATE;
    while (performance.now() - t0 < DUR_MS) {
      const target = t0 + sent * interval;
      const now = performance.now();
      if (now < target) await sleep(target - now);
      sent++;
      post(makeEvent())
        .then(() => acked++)
        .catch(() => failed++);
    }
    while (acked + failed < sent && performance.now() - t0 < DUR_MS + 30000) await sleep(5);
  } else if (MODE === 'burst') {
    const promises = [];
    for (let i = 0; i < COUNT; i++) {
      const s = nowMicros();
      sent++;
      promises.push(
        post(makeEvent())
          .then(() => {
            acked++;
            ackLat.push(nowMicros() - s);
          })
          .catch(() => failed++)
      );
    }
    await Promise.allSettled(promises);
  } else if (MODE === 'max') {
    let inflight = 0;
    while (performance.now() - t0 < DUR_MS) {
      while (inflight < INFLIGHT && performance.now() - t0 < DUR_MS) {
        inflight++;
        sent++;
        const s = nowMicros();
        post(makeEvent())
          .then(() => {
            acked++;
            ackLat.push(nowMicros() - s);
          })
          .catch(() => failed++)
          .finally(() => inflight--);
      }
      await sleep(1);
    }
    while (inflight > 0 && performance.now() - t0 < DUR_MS + 30000) await sleep(5);
  }
  const wallMs = performance.now() - t0;
  ackLat.sort((a, b) => a - b);
  const pick = (q) => (ackLat.length ? ackLat[Math.min(ackLat.length - 1, Math.floor(q * ackLat.length))] : null);
  console.log(
    'WRESULT ' +
      JSON.stringify({
        mode: MODE,
        sent,
        acked,
        failed,
        wallMs,
        sentPerSec: (sent / wallMs) * 1000,
        ackedPerSec: (acked / wallMs) * 1000,
        ackP50: pick(0.5),
        ackP99: pick(0.99),
      })
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
