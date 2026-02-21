# Nostr SPSP Bootstrap Implementation

**Status**: In Progress
**Date**: 2026-02-20

## Overview

We're implementing the proper Nostr SPSP bootstrap flow for the Crosstown multi-peer network. This replaces the manual HTTP API approach with automatic peer discovery and registration via Nostr.

## Architecture

### Current (Manual) Approach ❌
```
User → HTTP Admin API → Register Peers → Add BTP Secrets to ENV
```

- Requires manual peer registration
- Requires hardcoded BTP secrets in docker-compose
- Bypasses the Nostr/SPSP layer entirely

### Target (Nostr SPSP) Approach ✅
```
Genesis Peer → Publish kind:10032 → Nostr Relay
                                       ↓
Joiner Peer → Query Relay → Discover Genesis → Send SPSP Request (kind:23194)
                                                         ↓
                                Genesis → Respond SPSP (kind:23195) with sharedSecret + channelId
                                                         ↓
Joiner Peer → Register Peer with Connector Admin API (using sharedSecret from SPSP)
```

- Automatic peer discovery via Nostr
- Shared secrets exchanged via encrypted SPSP messages
- Payment channels opened during handshake
- No manual configuration needed

## Implementation Status

### ✅ Completed

1. **HTTP Connector Clients** (`packages/core/src/bootstrap/`)
   - `http-connector-admin.ts`: Register/remove peers via HTTP Admin API
   - `http-runtime-client.ts`: Send ILP packets via HTTP
   - `http-channel-client.ts`: Open payment channels via HTTP

2. **Bootstrap Entrypoint** (`packages/bls/src/entrypoint-with-bootstrap.ts`)
   - Integrates BLS + Nostr Relay + CrosstownNode with BootstrapService
   - SPSP request/response handler
   - Payment channel negotiation during handshake
   - Automatic connector registration after SPSP

### ⚠️ In Progress

1. **TypeScript Compilation**
   - Some type mismatches between @crosstown/relay and @crosstown/core
   - Need to align HandlePacketResponse types

2. **Docker Integration**
   - Need to update Dockerfile to use new entrypoint
   - Need to update docker-compose with proper environment variables

### ❌ Todo

1. **Testing**
   - Build and deploy new BLS image
   - Start multi-peer network
   - Verify genesis peer publishes kind:10032
   - Verify joiners discover and handshake
   - Verify payment channels open
   - Verify packets flow through BTP (not local delivery)

2. **Settlement Verification**
   - Send packets to exceed threshold
   - Verify signed claims generation
   - Verify settlement triggers
   - Verify on-chain balance changes

## Bootstrap Flow Detail

### Phase 1: Discovery
1. Genesis peer starts, publishes kind:10032 to Nostr relay:
   ```json
   {
     "kind": 10032,
     "content": {
       "ilpAddress": "g.crosstown.peer1",
       "btpEndpoint": "ws://connector-peer1:3000",
       "supportedChains": ["evm:base:31337"],
       "settlementAddresses": {
         "evm:base:31337": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
       }
     }
   }
   ```

2. Joiner peers connect to genesis relay, query for kind:10032 events
3. BootstrapService discovers genesis peer from event

### Phase 2: Handshake (SPSP)
1. Joiner sends SPSP request (kind:23194) to genesis peer's ILP address
   ```typescript
   {
     kind: 23194,
     content: encrypted({
       requestId: "uuid",
       settlementInfo: {
         supportedChains: ["evm:base:31337"],
         settlementAddresses: { ... },
         preferredTokens: { ... }
       }
     })
   }
   ```

2. Genesis receives SPSP request, decrypts it
3. Genesis negotiates settlement chain and opens payment channel
4. Genesis responds with SPSP response (kind:23195):
   ```typescript
   {
     kind: 23195,
     content: encrypted({
       requestId: "uuid",
       destinationAccount: "g.crosstown.peer1",
       sharedSecret: "base64-encoded-secret",
       negotiatedChain: "evm:base:31337",
       channelId: "ch-peer2-1",
       settlementAddress: "0x3C44...",
       tokenAddress: "0x5FbDB...",
       tokenNetworkAddress: "0xe7f17..."
     })
   }
   ```

5. Joiner receives SPSP response, extracts sharedSecret and channelId
6. **Joiner calls Connector Admin API** to register genesis as peer:
   ```typescript
   POST /admin/peers
   {
     id: "nostr-{genesisPubkey-prefix}",
     url: "ws://connector-peer1:3000",
     authToken: JSON.stringify({
       peerId: "nostr-{genesisPubkey-prefix}",
       secret: sharedSecret  // from SPSP response
     }),
     routes: [
       { prefix: "g.crosstown.peer1", priority: 0 }
     ],
     settlement: {
       preference: "evm",
       channelId: "ch-peer2-1",  // from SPSP response
       ...
     }
   }
   ```

### Phase 3: Announce
1. Joiner publishes own kind:10032 event to relay
2. Genesis and other peers discover new joiner
3. Network forms mesh topology

## Key Differences from Manual Approach

| Aspect | Manual | Nostr SPSP |
|--------|--------|------------|
| **Peer Discovery** | Hardcoded in docker-compose | Automatic via Nostr relay |
| **Shared Secret** | ENV variable `BTP_PEER_X_SECRET` | Exchanged via SPSP (kind:23195) |
| **Payment Channels** | Manual HTTP POST to /admin/channels | Automatic during SPSP handshake |
| **Connector Registration** | Manual HTTP POST to /admin/peers | Automatic after SPSP response |
| **Scalability** | Must update all configs to add peer | New peer joins by connecting to relay |

## Environment Variables

### Genesis Peer (peer1)
```bash
NODE_ID=peer1
NOSTR_SECRET_KEY=d5c4f02f7c0f9c8e7a6b5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a
ILP_ADDRESS=g.crosstown.peer1
CONNECTOR_ADMIN_URL=http://connector-peer1:8081
CONNECTOR_URL=http://connector-peer1:8080
BTP_ENDPOINT=ws://connector-peer1:3000
BLS_PORT=3100
WS_PORT=7100
SPSP_MIN_PRICE=0  # Accept free bootstrap handshakes
PEER_EVM_ADDRESS=0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
M2M_TOKEN_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
TOKEN_NETWORK_REGISTRY=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
INITIAL_DEPOSIT=100000
BTP_SECRET=crosstown-network-secret-2026
```

### Joiner Peer (peer2)
```bash
NODE_ID=peer2
NOSTR_SECRET_KEY=a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2
ILP_ADDRESS=g.crosstown.peer2
CONNECTOR_ADMIN_URL=http://connector-peer2:8081
CONNECTOR_URL=http://connector-peer2:8080
BTP_ENDPOINT=ws://connector-peer2:3000
BLS_PORT=3100
WS_PORT=7100
BOOTSTRAP_RELAYS=ws://crosstown-peer1:7100
BOOTSTRAP_PEERS={peer1-pubkey}  # Computed from NOSTR_SECRET_KEY
PEER_EVM_ADDRESS=0x90F79bf6EB2c4f870365E785982E1f101E93b906
M2M_TOKEN_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
TOKEN_NETWORK_REGISTRY=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
INITIAL_DEPOSIT=100000
BTP_SECRET=crosstown-network-secret-2026
```

## Next Steps

1. Fix TypeScript compilation errors in @crosstown/core
2. Build BLS with new entrypoint
3. Update docker-compose to use new image
4. Remove manual BTP_PEER_X_SECRET environment variables
5. Test full bootstrap flow
6. Verify settlement with signed claims and on-chain balance changes

## Files Created/Modified

### New Files
- `packages/core/src/bootstrap/http-connector-admin.ts`
- `packages/core/src/bootstrap/http-runtime-client.ts`
- `packages/core/src/bootstrap/http-channel-client.ts`
- `packages/bls/src/entrypoint-with-bootstrap.ts`
- `test-btp-network-settlement.mjs` (test script)

### Modified Files
- `packages/core/src/bootstrap/index.ts` (added HTTP client exports)
- `docker-compose-multi-peer.yml` (added BTP_PEER_X_SECRET env vars - to be removed once bootstrap works)

## References

- Five-Peer Bootstrap Test: `packages/core/src/__integration__/five-peer-bootstrap.test.ts`
- CLAUDE.md: Crosstown architecture and design decisions
- Connector Admin API: `packages/connector/src/http/admin-api.ts`
- BTP Server Authentication: `packages/connector/src/btp/btp-server.ts`
