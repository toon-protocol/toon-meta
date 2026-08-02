import { DbConnection } from './bindings/index';
const nowMicros = () => (performance.timeOrigin + performance.now()) * 1000;
const sub = DbConnection.builder()
  .withUri('ws://127.0.0.1:3000').withDatabaseName('relaybench').withLightMode(true)
  .onConnect((c: DbConnection) => { c.subscriptionBuilder().onApplied(() => start()).subscribe(['SELECT * FROM frames']); })
  .build();
let got = 0;
sub.db.frames.onInsert((_ctx: unknown, row: any) => {
  got++;
  console.log(`recv seq=${row.seq} lat_us=${Math.round(nowMicros() - Number(row.sentAt))}`);
  if (got === 100) setTimeout(() => process.exit(0), 500);
});
function start() {
  const w = DbConnection.builder().withUri('ws://127.0.0.1:3000').withDatabaseName('relaybench')
    .onConnect((c: DbConnection) => {
      const t0 = nowMicros();
      for (let i = 1; i <= 100; i++) {
        (c.reducers as any).postFrame({ session: 8, seq: BigInt(i), sentAt: BigInt(Math.round(nowMicros())), payload: 'z'.repeat(160) });
      }
      console.log(`sent 100 in ${Math.round(nowMicros() - t0)}us`);
    }).build();
}
