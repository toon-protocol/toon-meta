// SpacetimeDB subscriber worker: opens CONNS connections, each subscribing to
// the same query, records delivery latency (writer clock stamp -> onInsert).
// Prints READY when all subscriptions are applied; on stdin "REPORT" prints
// RESULT <json> and exits.
import { DbConnection } from './bindings/index';
import * as readline from 'node:readline';

const CONNS = Number(process.env.CONNS ?? '10');
const TABLE = (process.env.TABLE ?? 'frames') as 'frames' | 'events';
const URI = process.env.STDB_URI ?? 'ws://127.0.0.1:3000';
const LIGHT = process.env.LIGHT !== '0';

const QUERY = TABLE === 'frames' ? 'SELECT * FROM frames' : 'SELECT * FROM events';

function nowMicros(): number {
  return (performance.timeOrigin + performance.now()) * 1000;
}

const startMicros = nowMicros();
const latencies: number[] = [];
let count = 0;
let stale = 0; // rows stamped before this worker started (initial snapshot)
let ready = 0;
let errors = 0;

function onRow(row: { sentAt: bigint }) {
  const sent = Number(row.sentAt);
  if (sent < startMicros) {
    stale++;
    return;
  }
  count++;
  latencies.push(nowMicros() - sent);
}

for (let i = 0; i < CONNS; i++) {
  const builder = DbConnection.builder()
    .withUri(URI)
    .withDatabaseName('relaybench')
    .withLightMode(LIGHT)
    .onConnect((c: DbConnection) => {
      c.subscriptionBuilder()
        .onApplied(() => {
          ready++;
          if (ready === CONNS) console.log('READY');
        })
        .onError(() => {
          errors++;
        })
        .subscribe([QUERY]);
    })
    .onConnectError(() => {
      errors++;
      console.log('CONNECT_ERROR');
    });
  const conn = builder.build();
  if (TABLE === 'frames') conn.db.frames.onInsert((_ctx: unknown, row: any) => onRow(row));
  else conn.db.events.onInsert((_ctx: unknown, row: any) => onRow(row));
}

const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  if (line.trim() !== 'REPORT') return;
  latencies.sort((a, b) => a - b);
  const pick = (q: number) => (latencies.length ? latencies[Math.min(latencies.length - 1, Math.floor(q * latencies.length))] : null);
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
