// Same relay wiring as startRelay() in the deployed image, with ONE change:
// maxConnections raised 100 -> 2000 (the shipped default caps WS conns at 100,
// which makes a 500-subscriber run impossible on the stock image; treated as a
// "planned cheap fix" — it is a one-line config default).
// Mounted into the deployed image at /app/serve-uncapped.mjs and run with
// `--entrypoint node`, so all relay code is byte-identical to sha-dd881d9.
import { NostrRelayServer, SqliteEventStore, createWriteHandler } from './dist/index.js';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { mkdirSync } from 'node:fs';

mkdirSync('/data', { recursive: true });
const eventStore = new SqliteEventStore('/data/events.db');
const wsRelay = new NostrRelayServer(
  { port: 7100, host: '0.0.0.0', maxConnections: 2000 },
  eventStore
);

const app = new Hono();
const writeHandler = createWriteHandler({
  eventStore,
  devMode: true,
  logWrites: false,
  onStored: (event) => {
    try {
      wsRelay.broadcastEvent(event);
    } catch {
      // Non-broadcastable payloads -- ignore.
    }
  },
});
app.post('/write', (c) => writeHandler.handleWrite(c));
app.get('/health', (c) => c.json({ status: 'ok', uncapped: true }));

serve({ fetch: app.fetch, port: 3100 }, () => console.log('[uncapped] write up on 3100'));
await wsRelay.start();
console.log('[uncapped] ws up on 7100, maxConnections=2000');
