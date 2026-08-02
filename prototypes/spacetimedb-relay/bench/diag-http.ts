import { DbConnection } from './bindings/index';
const nowMicros = () => (performance.timeOrigin + performance.now()) * 1000;
const sub = DbConnection.builder()
  .withUri('ws://127.0.0.1:3000').withDatabaseName('relaybench').withLightMode(true)
  .onConnect((c: DbConnection) => { c.subscriptionBuilder().onApplied(() => start()).subscribe(['SELECT * FROM frames']); })
  .build();
sub.db.frames.onInsert((_ctx: unknown, row: any) => {
  console.log(`seq=${row.seq} lat_us=${Math.round(nowMicros() - Number(row.sentAt))}`);
});
async function start() {
  for (let i = 1; i <= 60; i++) {
    const args = JSON.stringify([9, i, Math.round(nowMicros()), 'y'.repeat(160)]);
    await fetch('http://127.0.0.1:3000/v1/database/relaybench/call/post_frame', { method: 'POST', headers: { 'content-type': 'application/json' }, body: args });
    await new Promise((r) => setTimeout(r, 50));
  }
  setTimeout(() => process.exit(0), 1000);
}
