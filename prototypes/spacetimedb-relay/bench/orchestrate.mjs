// Orchestrator: spawns subscriber workers + writer, samples server CPU via
// `docker stats`, aggregates results.
//
//   node orchestrate.mjs <stdb|relay> <scenario-json>
//
// scenario json: { name, subs, subProcs, writer: {MODE,RATE,DUR_MS,SIZE,COUNT,INFLIGHT}, table|kind }
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const [system, scenarioJson] = process.argv.slice(2);
const sc = JSON.parse(scenarioJson);
const CONTAINER = system === 'stdb' ? 'stdb' : 'toonrelay';

const subProcs = sc.subProcs ?? Math.min(8, Math.max(1, Math.ceil(sc.subs / 64)));
const perProc = [];
for (let i = 0; i < subProcs; i++) perProc.push(0);
for (let i = 0; i < sc.subs; i++) perProc[i % subProcs]++;

function spawnSub(conns) {
  const env = { ...process.env, CONNS: String(conns) };
  if (system === 'stdb') {
    env.TABLE = sc.table ?? 'frames';
    return spawn('npx', ['tsx', path.join(__dirname, 'stdb-sub.ts')], { env, stdio: ['pipe', 'pipe', 'inherit'] });
  }
  env.KIND = String(sc.kind ?? 20001);
  return spawn('node', [path.join(__dirname, 'relay-sub.mjs')], { env, stdio: ['pipe', 'pipe', 'inherit'] });
}

function spawnWriter() {
  const env = { ...process.env, ...Object.fromEntries(Object.entries(sc.writer).map(([k, v]) => [k, String(v)])) };
  if (system === 'stdb') {
    env.TABLE = sc.table ?? 'frames';
    return spawn('npx', ['tsx', path.join(__dirname, 'stdb-writer.ts')], { env, stdio: ['ignore', 'pipe', 'inherit'] });
  }
  env.KIND = String(sc.kind ?? 20001);
  return spawn('node', [path.join(__dirname, 'relay-writer.mjs')], { env, stdio: ['ignore', 'pipe', 'inherit'] });
}

function lineReader(stream, cb) {
  let buf = '';
  stream.on('data', (d) => {
    buf += d.toString();
    let idx;
    while ((idx = buf.indexOf('\n')) >= 0) {
      cb(buf.slice(0, idx));
      buf = buf.slice(idx + 1);
    }
  });
}

async function main() {
  const subs = perProc.filter((n) => n > 0).map((n) => spawnSub(n));
  // Capture exit promises at spawn time so an early-dead child can't hang us.
  const subExits = subs.map((p) => new Promise((resolve) => p.once('exit', resolve)));
  let readyCount = 0;
  const subResults = [];
  const readyPromise = new Promise((resolve) => {
    for (const p of subs) {
      lineReader(p.stdout, (line) => {
        if (line === 'READY') {
          readyCount++;
          if (readyCount === subs.length) resolve();
        } else if (line.startsWith('RESULT ')) {
          subResults.push(JSON.parse(line.slice(7)));
        } else if (line.startsWith('CONNECT_ERROR')) {
          console.error('sub connect error:', line);
        }
      });
    }
  });
  const readyTimeout = new Promise((_, rej) => setTimeout(() => rej(new Error('subs not ready in 120s')), 120000));
  await Promise.race([readyPromise, readyTimeout]);
  console.error(`[orch] ${sc.subs} subscribers ready across ${subs.length} procs`);

  // CPU sampler
  const cpuSamples = [];
  const stats = spawn('docker', ['stats', '--format', '{{.CPUPerc}}', CONTAINER], { stdio: ['ignore', 'pipe', 'ignore'] });
  lineReader(stats.stdout, (line) => {
    const m = line.replace(/\x1b\[[0-9;]*[a-zA-Z]|\x1b\[2J|\x1b\[H/g, '').match(/([\d.]+)%/);
    if (m) cpuSamples.push(Number(m[1]));
  });

  await new Promise((r) => setTimeout(r, 1500)); // settle + get baseline samples
  const baselineIdx = cpuSamples.length;

  const writer = spawnWriter();
  let wresult = null;
  lineReader(writer.stdout, (line) => {
    if (line.startsWith('WRESULT ')) wresult = JSON.parse(line.slice(8));
  });
  await new Promise((resolve) => writer.on('exit', resolve));
  const runIdx = cpuSamples.length;
  await new Promise((r) => setTimeout(r, 2000)); // let deliveries drain

  for (const p of subs) {
    try {
      p.stdin.write('REPORT\n');
    } catch {
      // sub already dead; its exit promise is already resolved
    }
  }
  await Promise.race([
    Promise.all(subExits),
    new Promise((_, rej) => setTimeout(() => rej(new Error('subs did not report in 60s')), 60000)),
  ]);
  stats.kill();

  const runCpu = cpuSamples.slice(baselineIdx, runIdx);
  const agg = {
    scenario: sc.name,
    system,
    subs: sc.subs,
    writer: wresult,
    delivery: {
      totalReceived: subResults.reduce((a, r) => a + r.count, 0),
      expectedPerSub: wresult ? wresult.sent : null,
      stale: subResults.reduce((a, r) => a + r.stale, 0),
      errors: subResults.reduce((a, r) => a + r.errors, 0),
      p50us: median(subResults.map((r) => r.p50).filter((x) => x != null)),
      p90us: median(subResults.map((r) => r.p90).filter((x) => x != null)),
      p99us: max(subResults.map((r) => r.p99).filter((x) => x != null)),
      maxus: max(subResults.map((r) => r.max).filter((x) => x != null)),
    },
    serverCpu: {
      samples: runCpu.length,
      avg: runCpu.length ? +(runCpu.reduce((a, b) => a + b, 0) / runCpu.length).toFixed(1) : null,
      max: runCpu.length ? Math.max(...runCpu) : null,
    },
    perProc: subResults,
  };
  console.log(JSON.stringify(agg, null, 2));
  process.exit(0);
}

const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const max = (xs) => (xs.length ? Math.max(...xs) : null);

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
