# Nostr SPSP Bootstrap Test Plan

## Overview
This test verifies the Nostr SPSP bootstrap flow works end-to-end with encrypted shared secrets and automatic payment channel creation.

## Prerequisites
✅ All packages build successfully
✅ Docker image `crosstown:bootstrap` built
✅ Connector image `connector:1.19.1` available
✅ Anvil + Token Faucet ready

## Test Phases

### Phase 1: Genesis Peer Startup
**Expected Behavior:**
1. ✅ Peer1 starts with `ENTRYPOINT=entrypoint-with-bootstrap.js`
2. ✅ Nostr relay starts on port 7100
3. ✅ BLS starts on port 3100
4. ✅ CrosstownNode initializes with BootstrapService
5. ✅ Genesis publishes kind:10032 (ILP Peer Info) to relay
6. ✅ No bootstrap peers configured (BOOTSTRAP_PEERS="")
7. ✅ SPSP handler configured with `spspMinPrice=0` (free handshakes)

**Verification:**
```bash
# Check genesis logs
docker logs crosstown-peer1 | grep -E "kind:10032|bootstrap|relay|BLS started"

# Query relay for kind:10032
curl "ws://localhost:7101" # Should see kind:10032 event

# Check health
curl http://localhost:3101/health
```

### Phase 2: Joiner Peer Discovery
**Expected Behavior:**
1. ✅ Peer2 starts with bootstrap config:
   - `BOOTSTRAP_RELAYS=ws://crosstown-peer1:7100`
   - `BOOTSTRAP_PEERS={peer1-pubkey}`
2. ✅ CrosstownNode connects to genesis relay
3. ✅ RelayMonitor discovers genesis kind:10032 event
4. ✅ BootstrapService enters Phase 1: Discovery
5. ✅ Event emitted: `{type: 'bootstrap:peer-discovered', peerPubkey: '...'}`

**Verification:**
```bash
# Check peer2 logs for discovery
docker logs crosstown-peer2 | grep -E "peer-discovered|kind:10032|Discovery"

# Should see discovery event
```

### Phase 3: SPSP Handshake (The Critical Part!)
**Expected Behavior:**
1. ✅ BootstrapService enters Phase 2: Handshake
2. ✅ Peer2 builds SPSP request (kind:23194):
   - Encrypts payload with NIP-44
   - Includes settlement info (EVM address, chains, tokens)
   - Sends to genesis ILP address via ILP PREPARE packet
3. ✅ Genesis receives TOON-encoded SPSP request
4. ✅ Genesis decrypts with NIP-44
5. ✅ Genesis calls `negotiateAndOpenChannel()`:
   - Negotiates settlement chain (evm:base:31337)
   - Calls connector Admin API: `POST /admin/channels`
   - Opens payment channel with initial deposit
6. ✅ Genesis builds SPSP response (kind:23195):
   - Encrypts with NIP-44
   - Includes `sharedSecret`, `channelId`, settlement info
   - Returns in ILP FULFILL data field
7. ✅ Peer2 receives FULFILL with SPSP response
8. ✅ Peer2 decrypts SPSP response
9. ✅ Peer2 extracts `sharedSecret` and `channelId`
10. ✅ Peer2 calls connector Admin API:
    ```json
    POST /admin/peers
    {
      "id": "nostr-{genesis-pubkey-prefix}",
      "url": "ws://connector-peer1:3000",
      "authToken": JSON.stringify({
        "peerId": "nostr-...",
        "secret": sharedSecret  // from SPSP response!
      }),
      "routes": [{
        "prefix": "g.crosstown.peer1",
        "priority": 0
      }],
      "settlement": {
        "preference": "evm",
        "channelId": "ch-...",  // from SPSP response!
        "evmAddress": "0x3C44...",
        "chainId": 31337
      }
    }
    ```
11. ✅ BTP connection established using SPSP sharedSecret
12. ✅ Event emitted: `{type: 'bootstrap:channel-opened', channelId: '...', negotiatedChain: 'evm:base:31337'}`

**Verification:**
```bash
# Watch SPSP handshake in peer2 logs
docker logs -f crosstown-peer2 | grep -E "SPSP|handshake|channel-opened|sharedSecret"

# Check genesis SPSP handling
docker logs -f crosstown-peer1 | grep -E "SPSP request from|Payment channel opened"

# Verify peer registered in connector
curl http://localhost:8092/admin/peers | jq '.[] | select(.peerId | startswith("nostr-"))'

# Verify payment channel created
curl http://localhost:8091/admin/channels | jq '.'
curl http://localhost:8092/admin/channels | jq '.'

# Check BTP connection
docker logs connector-peer2 | grep -E "BTP|authenticated|connected"
```

### Phase 4: Announcement
**Expected Behavior:**
1. ✅ BootstrapService enters Phase 3: Announce
2. ✅ Peer2 publishes own kind:10032 event to genesis relay
3. ✅ Genesis RelayMonitor sees peer2's kind:10032
4. ✅ Event emitted: `{type: 'bootstrap:announced', destination: '...'}`

**Verification:**
```bash
# Check peer2 announcement
docker logs crosstown-peer2 | grep -E "announced|kind:10032"

# Query relay for peer2's kind:10032
# Should see 2 kind:10032 events now (genesis + peer2)
```

### Phase 5: Packet Routing (NOT Local Delivery!)
**Expected Behavior:**
1. ✅ Send Nostr event from peer1 to peer2
2. ✅ Packet routes through **BTP** (ws://connector-peer2:3000)
3. ✅ **NOT** through local delivery (http://crosstown-peer2:3100)
4. ✅ Signed claims generated
5. ✅ Settlement tracking updated

**Test Script:**
```javascript
// Send test event peer1 → peer2
const event = {
  kind: 1,
  content: "Test bootstrap flow",
  tags: [],
  created_at: Math.floor(Date.now() / 1000),
};

// Send via peer1 BLS
fetch('http://localhost:3101/publish', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ event, destination: 'g.crosstown.peer2' }),
});
```

**Verification:**
```bash
# Check connector logs for BTP packet routing (NOT local delivery)
docker logs connector-peer1 | grep -E "BTP.*peer2|sendPacket.*g.crosstown.peer2"

# Should NOT see local delivery
docker logs connector-peer1 | grep "local delivery" # Should be empty or only internal

# Check settlement state changes
curl http://localhost:8091/admin/settlement/states | jq '.'
curl http://localhost:8092/admin/settlement/states | jq '.'
```

### Phase 6: Settlement Trigger
**Expected Behavior:**
1. ✅ Send enough packets to exceed threshold (5000 units)
2. ✅ Signed claims accumulated
3. ✅ Settlement triggered automatically
4. ✅ On-chain transaction submitted
5. ✅ Blockchain block mined
6. ✅ Wallet balances change
7. ✅ Payment channel balances updated

**Verification:**
```bash
# Send 100 packets (each ~100 units = 10,000 total > 5000 threshold)
for i in {1..100}; do
  # Send event
  node send-test-event.mjs
  sleep 0.1
done

# Check settlement occurred
curl http://localhost:8091/admin/settlement/states | jq '.[] | select(.state != "IDLE")'

# Check blockchain activity
cast logs --address 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512 --rpc-url http://localhost:8545

# Check block height increased
cast block-number --rpc-url http://localhost:8545

# Check wallet balance changes
cast balance 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC --rpc-url http://localhost:8545
cast balance 0x90F79bf6EB2c4f870365E785982E1f101E93b906 --rpc-url http://localhost:8545
```

## Success Criteria

| Criteria | Status |
|----------|--------|
| Genesis publishes kind:10032 | ⬜ |
| Joiner discovers genesis | ⬜ |
| SPSP request encrypted (NIP-44) | ⬜ |
| SPSP response encrypted (NIP-44) | ⬜ |
| SharedSecret exchanged securely | ⬜ |
| Payment channel opens during handshake | ⬜ |
| BTP peer registered with SPSP secret | ⬜ |
| BTP connection established | ⬜ |
| Packets route via BTP (not local delivery) | ⬜ |
| Signed claims generated | ⬜ |
| Settlement triggers at threshold | ⬜ |
| On-chain transaction confirmed | ⬜ |
| Balances updated on-chain | ⬜ |

## Common Issues & Debugging

### Issue: Genesis doesn't publish kind:10032
**Debug:**
```bash
docker logs crosstown-peer1 | grep -i error
# Check if relay started
docker logs crosstown-peer1 | grep "Nostr relay started"
```

### Issue: Joiner doesn't discover genesis
**Debug:**
```bash
# Check relay connectivity
docker exec crosstown-peer2 wget -qO- http://crosstown-peer1:7100/health
# Check BOOTSTRAP_PEERS pubkey matches genesis
docker exec crosstown-peer1 env | grep NOSTR_SECRET_KEY
```

### Issue: SPSP handshake fails
**Debug:**
```bash
# Check SPSP pricing (should be 0 for genesis)
docker logs crosstown-peer1 | grep "SPSP rejected"
# Check NIP-44 encryption
docker logs crosstown-peer2 | grep "SPSP.*decrypt"
```

### Issue: BTP authentication fails
**Debug:**
```bash
# Check sharedSecret was extracted
docker logs crosstown-peer2 | grep "sharedSecret"
# Check connector BTP logs
docker logs connector-peer1 | grep "BTP.*auth"
docker logs connector-peer2 | grep "BTP.*auth"
```

### Issue: Packets go through local delivery
**Debug:**
```bash
# Check routing table
curl http://localhost:8092/admin/routes | jq '.'
# Should show route to g.crosstown.peer1 via BTP peer
```

## Next Steps After Success
1. Add peers 3 & 4 to test mesh network
2. Test multi-hop routing (peer1 → peer2 → peer3 → peer4)
3. Test settlement with multiple peers
4. Measure performance and latency
5. Test failure scenarios (peer offline, relay down, etc.)
