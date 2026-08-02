// Smoke test: connect, subscribe to frames + events, try reducer call conventions.
import { DbConnection } from './bindings/index';

function nowMicros(): bigint {
  return BigInt(Math.round((performance.timeOrigin + performance.now()) * 1000));
}

const conn = DbConnection.builder()
  .withUri('ws://127.0.0.1:3000')
  .withDatabaseName('relaybench')
  .onConnect((c: DbConnection) => {
    console.log('connected');
    c.subscriptionBuilder()
      .onApplied(() => {
        console.log('subscribed');
        // Try object-style call
        try {
          (c.reducers as any).postFrame({ session: 1, seq: 1n, sentAt: nowMicros(), payload: 'obj-style' });
          console.log('object-style call did not throw');
        } catch (e) {
          console.log('object-style threw:', (e as Error).message);
        }
        // Try positional call
        try {
          (c.reducers as any).postFrame(1, 2n, nowMicros(), 'positional-style');
          console.log('positional-style call did not throw');
        } catch (e) {
          console.log('positional-style threw:', (e as Error).message);
        }
      })
      .subscribe(['SELECT * FROM frames']);
  })
  .onConnectError((_ctx: unknown, err: Error) => {
    console.error('connect error', err);
    process.exit(1);
  })
  .build();

conn.db.frames.onInsert((_ctx: unknown, row: any) => {
  const lat = Number(nowMicros() - row.sentAt);
  console.log('got frame:', row.payload, 'latency us:', lat);
});

setTimeout(() => {
  console.log('done');
  process.exit(0);
}, 4000);
