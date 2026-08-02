// TOON relay subscriber worker: CONNS NIP-01 WebSocket subscriptions on the
// same filter, records delivery latency (sent_at micros embedded in content).
// Prints READY when all subs got EOSE; on stdin "REPORT" prints RESULT <json>.
import WebSocket from 'ws';
import * as readline from 'node:readline';

const CONNS = Number(process.env.CONNS ?? '10');
const KIND = Number(process.env.KIND ?? '20001');
const URL = process.env.RELAY_WS ?? 'ws://127.0.0.1:7100';

function nowMicros() {
  return (performance.timeOrigin + performance.now()) * 1000;
}

const startMicros = nowMicros();
const latencies = [];
let count = 0;
let stale = 0;
let ready = 0;
let errors = 0;

for (let i = 0; i < CONNS; i++) {
  const ws = new WebSocket(URL);
  ws.on('open', () => {
    ws.send(JSON.stringify(['REQ', `sub${i}`, { kinds: [KIND] }]));
  });
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg[0] === 'EOSE') {
      ready++;
      if (ready === CONNS) console.log('READY');
      return;
    }
    if (msg[0] !== 'EVENT') return;
    const sent = Number(msg[2].content.slice(0, 16)); // 16-digit micros stamp
    if (sent < startMicros) {
      stale++;
      return;
    }
    count++;
    latencies.push(nowMicros() - sent);
  });
  ws.on('error', (e) => {
    errors++;
    console.log('CONNECT_ERROR ' + e.message);
  });
}

const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  if (line.trim() !== 'REPORT') return;
  latencies.sort((a, b) => a - b);
  const pick = (q) => (latencies.length ? latencies[Math.min(latencies.length - 1, Math.floor(q * latencies.length))] : null);
  console.log(
    'RESULT ' +
      JSON.stringify({
        conns: CONNS,
        count,
        stale,
        errors,
        p50: pick(0.5),
        p90: pick(0.9),
        p99: pick(0.99),
        max: latencies.length ? latencies[latencies.length - 1] : null,
      })
  );
  process.exit(0);
});
