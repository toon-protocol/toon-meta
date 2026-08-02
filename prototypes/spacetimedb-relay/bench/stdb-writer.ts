// SpacetimeDB writer: paced or burst reducer calls.
//   MODE=paced RATE=50 DUR_MS=30000 SIZE=160 TABLE=frames
//   MODE=burst COUNT=1000 SIZE=256 TABLE=events
//   MODE=max   DUR_MS=10000 SIZE=160 TABLE=frames INFLIGHT=64   (closed-loop max throughput)
// "ack" = the writer's own row arriving back on its own subscription
// (commit + subscription broadcast complete — comparable to the relay's POST
// /write 200, which also returns only after store + broadcast).
// Prints WRESULT <json> at the end.
import { DbConnection } from './bindings/index';

const MODE = process.env.MODE ?? 'paced';
const RATE = Number(process.env.RATE ?? '50');
const DUR_MS = Number(process.env.DUR_MS ?? '30000');
const SIZE = Number(process.env.SIZE ?? '160');
const COUNT = Number(process.env.COUNT ?? '1000');
const TABLE = (process.env.TABLE ?? 'frames') as 'frames' | 'events';
const INFLIGHT = Number(process.env.INFLIGHT ?? '64');
const URI = process.env.STDB_URI ?? 'ws://127.0.0.1:3000';

const payload = 'x'.repeat(SIZE);
const SESSION = process.pid >>> 0; // unique writer marker
const AUTHOR = `bench-writer-${process.pid}`.padEnd(64, '0');

const nowUs = () => (performance.timeOrigin + performance.now()) * 1000;

let seq = 0n;
let acked = 0;
const ackLat: number[] = [];
const sentAtBySeq = new Map<string, number>();

function send(c: DbConnection) {
  seq++;
  const stamp = Math.round(nowUs());
  sentAtBySeq.set(String(seq), stamp);
  if (TABLE === 'frames') {
    (c.reducers as any).postFrame({ session: SESSION, seq, sentAt: BigInt(stamp), payload });
  } else {
    (c.reducers as any).postEvent({
      kind: 1,
      author: AUTHOR,
      createdAt: BigInt(Math.floor(stamp / 1000000)),
      content: payload,
      sentAt: BigInt(stamp),
    });
  }
}

function onOwnRow(row: any) {
  const mine = TABLE === 'frames' ? row.session === SESSION : row.author === AUTHOR;
  if (!mine) return;
  acked++;
  const key = TABLE === 'frames' ? String(row.seq) : null;
  const sentStamp = key ? sentAtBySeq.get(key) : Number(row.sentAt);
  if (sentStamp !== undefined && sentStamp !== null) {
    ackLat.push(nowUs() - sentStamp);
    if (key) sentAtBySeq.delete(key);
  }
}

const QUERY = TABLE === 'frames' ? 'SELECT * FROM frames' : 'SELECT * FROM events';

const conn = DbConnection.builder()
  .withUri(URI)
  .withDatabaseName('relaybench')
  .withLightMode(true)
  .onConnect((c: DbConnection) => {
    c.subscriptionBuilder()
      .onApplied(() => {
        run(c).catch((e) => {
          console.error('writer failed', e);
          process.exit(1);
        });
      })
      .subscribe([QUERY]);
  })
  .onConnectError((_ctx: unknown, err: Error) => {
    console.error('connect error', err);
    process.exit(1);
  })
  .build();

if (TABLE === 'frames') conn.db.frames.onInsert((_ctx: unknown, row: any) => onOwnRow(row));
else conn.db.events.onInsert((_ctx: unknown, row: any) => onOwnRow(row));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function run(c: DbConnection) {
  const t0 = performance.now();
  let sent = 0;
  if (MODE === 'paced') {
    const interval = 1000 / RATE;
    while (performance.now() - t0 < DUR_MS) {
      const target = t0 + sent * interval;
      const now = performance.now();
      if (now < target) await sleep(target - now);
      send(c);
      sent++;
    }
  } else if (MODE === 'burst') {
    for (let i = 0; i < COUNT; i++) {
      send(c);
      sent++;
    }
    const deadline = performance.now() + 60000;
    while (acked < COUNT && performance.now() < deadline) await sleep(5);
  } else if (MODE === 'max') {
    while (performance.now() - t0 < DUR_MS) {
      while (sent - acked < INFLIGHT && performance.now() - t0 < DUR_MS) {
        send(c);
        sent++;
      }
      await sleep(1);
    }
    const deadline = performance.now() + 30000;
    while (acked < sent && performance.now() < deadline) await sleep(5);
  }
  const wallMs = performance.now() - t0;
  ackLat.sort((a, b) => a - b);
  const pick = (q: number) => (ackLat.length ? ackLat[Math.min(ackLat.length - 1, Math.floor(q * ackLat.length))] : null);
  console.log(
    'WRESULT ' +
      JSON.stringify({
        mode: MODE,
        sent,
        acked,
        wallMs,
        sentPerSec: (sent / wallMs) * 1000,
        ackedPerSec: (acked / wallMs) * 1000,
        ackP50: pick(0.5),
        ackP99: pick(0.99),
      })
  );
  process.exit(0);
}
