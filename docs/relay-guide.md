# Relay Guide

`@toon-protocol/town` is the production relay launcher (pending rename to `@toon-protocol/relay`) built on `@toon-protocol/relay` and `@toon-protocol/sdk`. It provides a complete Nostr relay with an embedded ILP connector, payment validation, SQLite storage, WebSocket serving, and automatic bootstrap — all in a single function call or CLI command.

## Where the Relay Launcher Sits in the Stack

```
@toon-protocol/town (pending rename to @toon-protocol/relay)
├── startTown() / CLI          ← You configure here
├── @toon-protocol/sdk             ← Verification, pricing, handlers
│   └── @toon-protocol/core        ← Bootstrap, discovery
├── @toon-protocol/relay           ← WebSocket relay, event store
└── Embedded ILP Connector     ← Payment routing (included)
```

The relay launcher composes everything the SDK provides into an opinionated, ready-to-run relay. The ILP connector is embedded by default — no external connector needed. If you need custom handlers or different storage, use the [SDK](sdk-guide.md) directly.

## Quick Start

### CLI

```bash
npx @toon-protocol/town \
  --mnemonic "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
```

### Programmatic

```typescript
import { startTown } from '@toon-protocol/town';

const relay = await startTown({
  mnemonic: 'abandon abandon abandon ...',
});

console.log(`Relay running on ws://localhost:${relay.config.relayPort}`);
console.log(`BLS running on http://localhost:${relay.config.blsPort}`);
console.log(`Pubkey: ${relay.pubkey}`);
console.log(`Peers: ${relay.bootstrapResult.peerCount}`);

// Later...
await relay.stop();
```

## Configuration

### TownConfig

| Option | Type | Default | Required | Purpose |
|--------|------|---------|----------|---------|
| `mnemonic` | `string` | — | One of two | BIP-39 mnemonic for identity |
| `secretKey` | `Uint8Array` | — | One of two | Raw 32-byte secret key |
| `relayPort` | `number` | `7100` | No | WebSocket relay port |
| `blsPort` | `number` | `3100` | No | BLS HTTP server port |
| `basePricePerByte` | `bigint` | `10n` | No | Price per byte of event data |
| `knownPeers` | `KnownPeer[]` | `[]` | No | Seed peers for bootstrap |
| `dataDir` | `string` | `./data` | No | SQLite database directory |
| `devMode` | `boolean` | `false` | No | Skip verification and pricing |
| `connectorUrl` | `string` | — | No | Use an external connector instead of embedded |
| `connectorAdminUrl` | `string` | connectorUrl port+1 | No | Connector admin endpoint (external mode) |
| `chainRpcUrls` | `Record<string, string>` | — | No | RPC URLs per chain |
| `tokenNetworks` | `Record<string, string>` | — | No | TokenNetwork contract per chain |
| `preferredTokens` | `Record<string, string>` | — | No | Preferred token per chain |
| `announcementTtlSeconds` | `number` | `3600` | No | NIP-40 TTL for the kind:10032 announcement; re-published at half this interval. `0` disables the expiration tag + heartbeat |

Provide exactly one of `mnemonic` or `secretKey` — not both, not neither.

The node stamps its `kind:10032` announcement with a NIP-40 `expiration`
(`created_at + announcementTtlSeconds`) and re-publishes on a heartbeat at half
the TTL. A live apex keeps a fresh announcement; once it stops, the last one
expires so discovery clients skip its now-unreachable BTP endpoint instead of
failing against it (issue #261). Set `0` to advertise a non-expiring
announcement (legacy behavior).

### Environment Variables

| Variable | Maps to |
|----------|---------|
| `TOON_MNEMONIC` | `--mnemonic` |
| `TOON_SECRET_KEY` | `--secret-key` |
| `TOON_CONNECTOR_URL` | `--connector-url` |
| `TOON_RELAY_PORT` | `--relay-port` |
| `TOON_BLS_PORT` | `--bls-port` |
| `TOON_DATA_DIR` | `--data-dir` |
| `TOON_DEV_MODE` | `--dev-mode` |
| `TOON_KNOWN_PEERS` | `--known-peers` (JSON array) |
| `TOON_ANNOUNCEMENT_TTL_SECONDS` | `announcementTtlSeconds` (NIP-40 kind:10032 TTL; default `3600`, `0` disables) |

### CLI Flags

```
npx @toon-protocol/town [options]

Options:
  --mnemonic <phrase>          BIP-39 mnemonic for node identity
  --secret-key <hex>           64-char hex secret key (alternative to mnemonic)
  --connector-url <url>        ILP connector HTTP endpoint (omit for embedded connector)
  --connector-admin-url <url>  Connector admin endpoint
  --relay-port <port>          WebSocket relay port (default: 7100)
  --bls-port <port>            BLS HTTP port (default: 3100)
  --data-dir <path>            Data directory (default: ./data)
  --known-peers <json>         JSON array of seed peers
  --dev-mode                   Skip verification and pricing
  --help                       Show help
```

## What Happens on Start

When `startTown()` is called, it performs these steps in order:

1. Validate identity (mnemonic XOR secretKey — exactly one required)
2. Derive identity (Nostr pubkey + EVM address from key)
3. Resolve config with defaults
4. Create data directory
5. Initialize SQLite event store
6. Start embedded ILP connector (or connect to external if `connectorUrl` provided)
7. Configure settlement (if chain info provided)
8. Build SDK pipeline (verify → price → dispatch)
9. Set up bootstrap service
10. Start BLS HTTP server (Hono — `/health` and `/handle-packet`)
11. Start WebSocket relay (NostrRelayServer — NIP-01)
12. Track running state
13. Execute bootstrap (discover peers, register, announce)
14. Set up outbound subscription tracking
15. Return `TownInstance`

## TownInstance API

### `isRunning(): boolean`

Check if the relay is currently running.

### `stop(): Promise<void>`

Gracefully shut down all services — close WebSocket connections, stop HTTP server, clean up subscriptions.

### `subscribe(relayUrl, filter): TownSubscription`

Open a WebSocket subscription to a remote relay. Received events are stored in the local event store.

```typescript
const sub = relay.subscribe('ws://other-relay:7100', { kinds: [1] });
console.log(sub.isActive());  // true
sub.close();
```

Validates WebSocket URL scheme (must be `ws://` or `wss://`). Throws if relay is not running.

Subscriptions are tracked and cleaned up automatically when `relay.stop()` is called.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `pubkey` | `string` | Node's Nostr public key |
| `evmAddress` | `string` | Node's EVM address |
| `config` | `ResolvedTownConfig` | Resolved configuration with defaults |
| `bootstrapResult` | `{ peerCount, channelCount }` | Bootstrap outcome |

## Event Storage

Relay uses `createEventStorageHandler()` to handle incoming events:

1. Decode TOON payload to NostrEvent
2. Store in SQLite via EventStore
3. Accept with event metadata

All cross-cutting concerns — signature verification, pricing, self-write bypass — are handled by the SDK pipeline before the handler runs. The handler itself is ~15 lines of logic.

## Health Endpoint

`GET /health` on the BLS port returns:

```json
{
  "phase": "running",
  "peerCount": 3,
  "discoveredPeerCount": 5,
  "channelCount": 2
}
```

Phases progress: `starting` → `bootstrapping` → `running`

## Exposed Ports

| Port | Service | Protocol | Purpose |
|------|---------|----------|---------|
| 7100 (default) | Nostr Relay | WebSocket | Event reads (NIP-01) — free |
| 3100 (default) | BLS | HTTP | `/health` and `/handle-packet` — ILP validation |
