# Bootstrap Test Status

## ✅ What's Working

1. **Local Build Workflow** - 5 second iterations!
   - `pnpm build` rebuilds packages instantly
   - No Docker image builds needed
   - Direct Node process execution

2. **Connector Peer1 Infrastructure**
   - ✅ Starts successfully
   - ✅ Health API on port 8081
   - ✅ Admin API on port 8091
   - ✅ BTP server on port 3051
   - ✅ Explorer on port 3011

3. **Connector Peer2 Infrastructure**
   - ✅ Starts successfully
   - ✅ Health API on port 8082
   - ✅ Admin API on port 8092
   - ✅ BTP server on port 3052
   - ✅ Explorer disabled (avoided port conflict)

4. **Crosstown Genesis (Peer1)**
   - ✅ Nostr relay started on port 7101
   - ✅ BLS HTTP server on port 3101
   - ✅ Published kind:10032 to local relay
   - ✅ Responding to health checks

5. **Bootstrap Discovery**
   - ✅ Peer2 queries Peer1's relay
   - ✅ Peer2 receives kind:10032 event
   - ✅ Peer2 parses ILP peer info
   - ✅ Peer2 calls connector Admin API

## ❌ Current Blocker

**Connector Admin API rejects empty authToken**

```
Failed to register peer: Admin API error (POST http://localhost:8092/admin/peers):
400 Bad Request - {"error":"Bad request","message":"Missing or invalid authToken"}
```

### Root Cause

The **connector's Admin API server-side** validates authToken and rejects empty strings.

**Client-side (Crosstown):** ✅ Fixed - allows empty string
**Server-side (Connector):** ❌ Blocking - rejects empty string

### Location of Server-Side Validation

The validation is in the **connector** project (separate repo):
```
../connector/packages/connector/src/http/admin-api.ts
```

The connector's POST /admin/peers endpoint validates the request body and rejects:
- Missing authToken
- Empty authToken

### Required Fix (Connector Side)

Update the connector's Admin API to accept empty authToken for BTP peers that don't require authentication:

```typescript
// In connector/packages/connector/src/http/admin-api.ts
// Change validation from:
if (!authToken || authToken.trim() === '') {
  throw new Error('authToken is required')
}

// To:
if (authToken === undefined || authToken === null) {
  throw new Error('authToken must be provided (can be empty string)')
}
```

## Bootstrap Flow Progress

```
1. Discovery (Nostr)          ✅
   ├─ Peer1 publishes kind:10032     ✅
   └─ Peer2 discovers via relay       ✅

2. Peer Registration           ❌ BLOCKED
   ├─ Peer2 calls Admin API           ✅
   ├─ With authToken: ''              ✅
   └─ Connector rejects empty auth    ❌ ← BLOCKER

3. BTP Connection              ⬜ NOT REACHED
   └─ Awaiting peer registration

4. SPSP Handshake (via ILP)    ⬜ NOT REACHED
   └─ Awaiting BTP connection

5. Payment Channels            ⬜ NOT REACHED
   └─ Awaiting SPSP

6. Announce (via ILP)          ⬜ NOT REACHED
   └─ Awaiting BTP connection
```

## Next Steps

### Option 1: Fix Connector (Recommended)
Update the connector's Admin API to accept empty authToken.

**File:** `../connector/packages/connector/src/http/admin-api.ts`

### Option 2: Workaround (Temporary)
Use a dummy authToken like `"no-auth"` instead of empty string.

**Impact:** Not architecturally correct - BTP shouldn't require auth for Crosstown's use case.

### Option 3: Direct BTP Configuration
Skip the Admin API and configure BTP peers directly via config file.

**Impact:** Defeats the purpose of dynamic bootstrap.

## Files Created

### Working Scripts
- ✅ `run-local-bootstrap-test.sh` - Comprehensive test script
- ✅ `dev-connector-peer1.sh` - Start connector peer1
- ✅ `dev-connector-peer2.sh` - Start connector peer2
- ✅ `dev-peer1.sh` - Start crosstown peer1
- ✅ `dev-peer2.sh` - Start crosstown peer2

### Configuration
- ✅ `config/connector-peer1.yaml` - Connector peer1 config
- ✅ `config/connector-peer2.yaml` - Connector peer2 config

### Documentation
- ✅ `LOCAL-DEV-SETUP.md` - Local development guide
- ✅ `ARCHITECTURE-FIX-SUMMARY.md` - Architecture explanation
- ✅ `BOOTSTRAP-STATUS.md` - This file

## Verification Commands

```bash
# Check genesis health
curl http://localhost:3101/health | jq .

# Check connector peers
curl http://localhost:8092/admin/peers | jq .

# Check BTP status
curl http://localhost:8092/admin/peers | jq '.peers[] | select(.connected == true)'

# View logs
tail -f /tmp/crosstown-peer1.log
tail -f /tmp/crosstown-peer2.log
tail -f /tmp/connector-peer1.log
tail -f /tmp/connector-peer2.log
```

## Test Results Summary

**Date:** 2026-02-21
**Test Script:** `run-local-bootstrap-test.sh`
**Build Time:** ~5 seconds (vs 5-10 minutes with Docker)

### What Works
✅ All 4 processes start and run successfully:
   - Connector Peer1 (ports 8081, 8091, 3051, 3011)
   - Connector Peer2 (ports 8082, 8092, 3052)
   - Crosstown Peer1 (ports 3101, 7101)
   - Crosstown Peer2 (ports 3102, 7102)

✅ Discovery flow complete:
   - Peer1 publishes kind:10032 event
   - Peer2 discovers peer1 via Nostr relay
   - Peer2 extracts ILP address and BTP endpoint

✅ Infrastructure communication:
   - Crosstown can reach connector Admin API
   - No "fetch failed" errors

### What's Blocked

❌ **Peer Registration** - Connector Admin API returns:
```
400 Bad Request - {"error":"Bad request","message":"Missing or invalid authToken"}
```

This blocks the entire flow:
- ❌ BTP connection can't be established (no peer registered)
- ❌ SPSP handshake fails with "F02 No route to destination"
- ❌ Payment channels can't be opened
- ❌ Announce can't be sent

## Root Cause

The crosstown bootstrap flow is **working correctly** up to the point where it calls the connector's Admin API.

The **blocker is in the connector project** - its Admin API server-side validation rejects empty authToken.

**This is a connector issue, not a crosstown issue.**

The crosstown code correctly sends `authToken: ''` (empty string) because BTP doesn't require authentication for this use case. The client-side validation in crosstown was already fixed to accept empty strings. The server-side connector code needs the same fix.
