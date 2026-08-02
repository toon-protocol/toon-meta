// Runs the full scenario matrix for one system and writes results/<name>.json.
//   node run-matrix.mjs <stdb|relay> [filter-substring]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const [system, filter] = process.argv.slice(2);
const resultsDir = path.join(__dirname, 'results', system);
fs.mkdirSync(resultsDir, { recursive: true });

const F = { table: 'frames', kind: 20001 }; // ephemeral path
const P = { table: 'events', kind: 1 }; // persistent path

const scenarios = [
  // (b) fan-out matrix: 1 writer, 50 rows/sec, 160B ephemeral frames, 30s
  { name: 'fanout-s10', subs: 10, ...F, writer: { MODE: 'paced', RATE: 50, DUR_MS: 30000, SIZE: 160 } },
  { name: 'fanout-s100', subs: 100, ...F, writer: { MODE: 'paced', RATE: 50, DUR_MS: 30000, SIZE: 160 } },
  { name: 'fanout-s500', subs: 500, ...F, writer: { MODE: 'paced', RATE: 50, DUR_MS: 30000, SIZE: 160 } },
  // (a) video-shaped rows: 16KB at 50fps (~6.5 Mbps stream)
  { name: 'video-s10', subs: 10, ...F, writer: { MODE: 'paced', RATE: 50, DUR_MS: 20000, SIZE: 16384 } },
  { name: 'video-s100', subs: 100, ...F, writer: { MODE: 'paced', RATE: 50, DUR_MS: 20000, SIZE: 16384 } },
  // (a) sustained max insert->delivery rate, 1 subscriber
  { name: 'max-s1-160B', subs: 1, ...F, writer: { MODE: 'max', DUR_MS: 15000, SIZE: 160, INFLIGHT: 64 } },
  { name: 'max-s1-16K', subs: 1, ...F, writer: { MODE: 'max', DUR_MS: 15000, SIZE: 16384, INFLIGHT: 64 } },
  // high-fan-out saturation: max rate with 100 subscribers
  { name: 'max-s100-160B', subs: 100, ...F, writer: { MODE: 'max', DUR_MS: 15000, SIZE: 160, INFLIGHT: 64 } },
  // (c) persistent-shaped burst: 1k inserts as fast as accepted
  { name: 'burst1k-persistent', subs: 1, ...P, writer: { MODE: 'burst', COUNT: 1000, SIZE: 256 } },
  // persistent sustained (agent writers >1k/sec?)
  { name: 'max-s1-persistent', subs: 1, ...P, writer: { MODE: 'max', DUR_MS: 15000, SIZE: 256, INFLIGHT: 64 } },
];

function duData() {
  return new Promise((resolve) => {
    const target = system === 'stdb' ? ['exec', 'stdb', 'du', '-sb', '/home/spacetime/.local/share/spacetime/data'] : ['exec', 'toonrelay', 'sh', '-c', 'du -sk /data 2>/dev/null || echo 0'];
    const p = spawn('docker', target);
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    // stdb reports bytes (du -sb); relay reports KB (busybox du -sk) -> normalize to bytes
    p.on('exit', () => {
      const n = Number(out.split('\t')[0].trim());
      if (!Number.isFinite(n)) return resolve(null);
      resolve(system === 'stdb' ? n : n * 1024);
    });
  });
}

async function runOne(sc) {
  const before = await duData();
  const t0 = Date.now();
  return new Promise((resolve) => {
    const p = spawn('node', [path.join(__dirname, 'orchestrate.mjs'), system, JSON.stringify(sc)], { stdio: ['ignore', 'pipe', 'inherit'] });
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.on('exit', async (code) => {
      if (code !== 0) {
        console.error(`scenario ${sc.name} FAILED (${code})`);
        resolve(null);
        return;
      }
      const res = JSON.parse(out);
      res.dataDirBytesBefore = before;
      res.dataDirBytesAfter = await duData();
      res.dataDirGrowth = res.dataDirBytesAfter != null && before != null ? res.dataDirBytesAfter - before : null;
      res.wallMs = Date.now() - t0;
      fs.writeFileSync(path.join(resultsDir, sc.name + '.json'), JSON.stringify(res, null, 2));
      const d = res.delivery;
      const expected = res.writer ? res.writer.sent * sc.subs : 0;
      console.log(
        `${system}/${sc.name}: sent=${res.writer?.sent} delivered=${d.totalReceived}/${expected} (${((d.totalReceived / expected) * 100).toFixed(1)}%) ` +
          `p50=${(d.p50us / 1000).toFixed(1)}ms p99=${(d.p99us / 1000).toFixed(1)}ms cpu avg/max=${res.serverCpu.avg}/${res.serverCpu.max}% growth=${res.dataDirGrowth}B`
      );
      resolve(res);
    });
  });
}

for (const sc of scenarios) {
  if (filter && !sc.name.includes(filter)) continue;
  await runOne(sc);
  await new Promise((r) => setTimeout(r, 3000));
}
