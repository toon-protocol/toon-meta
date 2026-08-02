// Diagnostic: one subscriber conn printing every frame's latency, one writer conn pacing frames.
import { DbConnection } from './bindings/index';

const nowMicros = () => (performance.timeOrigin + performance.now()) * 1000;

const sub = DbConnection.builder()
  .withUri('ws://127.0.0.1:3000')
  .withDatabaseName('relaybench')
  .withLightMode(process.env.LIGHT !== '0')
  .onConnect((c: DbConnection) => {
    c.subscriptionBuilder()
      .onApplied(() => start())
      .subscribe(['SELECT * FROM frames']);
  })
  .build();

sub.db.frames.onInsert((_ctx: unknown, row: any) => {
  console.log(`seq=${row.seq} lat_us=${Math.round(nowMicros() - Number(row.sentAt))}`);
});

function start() {
  const writer = DbConnection.builder()
    .withUri('ws://127.0.0.1:3000')
    .withDatabaseName('relaybench')
    .onConnect(async (c: DbConnection) => {
      for (let i = 1; i <= 60; i++) {
        (c.reducers as any).postFrame({ session: 9, seq: BigInt(i), sentAt: BigInt(Math.round(nowMicros())), payload: 'y'.repeat(160) });
        await new Promise((r) => setTimeout(r, 50));
      }
      setTimeout(() => process.exit(0), 1000);
    })
    .build();
}
