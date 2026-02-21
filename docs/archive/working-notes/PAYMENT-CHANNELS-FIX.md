# Payment Channels Not Working - Root Cause & Fix

## Problem Summary
Payment channels and settlement infrastructure are **NOT enabled** even though auto-deployment is configured.

## Root Causes

### 1. Contract Deployer Issues
- **Volume mounted as read-only** (`:ro`) - forge can't write broadcast artifacts
- **Fails silently** - exits with code 0 but produces no output
- **Path issue** - `../connector/packages/contracts` may not resolve correctly

### 2. Anvil State Loss
- Anvil is **ephemeral** - loses all state on restart
- Contracts deployed successfully earlier but lost when Anvil restarted
- Need persistent state or auto-redeploy

### 3. Missing Environment Variables
Even if contracts deploy successfully, the connector and crosstown don't know the addresses:
- `BASE_TOKEN_ADDRESS` not set
- `BASE_REGISTRY_ADDRESS` (TokenNetwork address) not set

## Deployed Contract Addresses (From Last Successful Deployment)
```
AGENT Token (MockERC20):  0x5FbDB2315678afecb367f032d93F642f64180aa3
TokenNetwork:             0xe7f1725e7734ce288f8367e1bb143e90bb3f0512
```

## Fixes Required

### Fix 1: Update docker-compose-with-local.yml

```yaml
  contract-deployer:
    image: ghcr.io/foundry-rs/foundry:latest
    container_name: crosstown-contract-deployer
    working_dir: /contracts
    environment:
      BASE_RPC_URL: http://anvil:8545
    volumes:
      # FIX: Remove :ro to allow writing broadcast artifacts
      - /Users/jonathangreen/Documents/connector/packages/contracts:/contracts
    networks:
      - crosstown-network
    depends_on:
      anvil:
        condition: service_healthy
    command: >
      sh -c '
        echo "Deploying contracts to local Anvil...";
        forge script script/DeployLocal.s.sol:DeployLocalScript --rpc-url http://anvil:8545 --broadcast;
        echo "";
        echo "=== DEPLOYMENT COMPLETE ===";
        cat broadcast/DeployLocal.s.sol/31337/run-latest.json | grep -A1 "AGENT_TOKEN_ADDRESS\\|TOKEN_NETWORK_ADDRESS" || echo "Check logs for addresses";
        echo "====================================";
      '
    restart: "no"
```

### Fix 2: Extract and Set Contract Addresses

After deployment, extract addresses and set in environment:

```bash
# Method 1: Parse from broadcast artifacts
cd /Users/jonathangreen/Documents/connector/packages/contracts
AGENT_TOKEN=$(cat broadcast/DeployLocal.s.sol/31337/run-latest.json | jq -r '.transactions[0].contractAddress')
TOKEN_NETWORK=$(cat broadcast/DeployLocal.s.sol/31337/run-latest.json | jq -r '.transactions[1].contractAddress')

echo "AGENT_TOKEN_ADDRESS=$AGENT_TOKEN"
echo "TOKEN_NETWORK_ADDRESS=$TOKEN_NETWORK"

# Method 2: Check deployment logs
docker logs crosstown-contract-deployer 2>&1 | grep "deployed to"
```

### Fix 3: Configure Connector and Crosstown

Update docker-compose-with-local.yml:

```yaml
  connector:
    environment:
      BASE_TOKEN_ADDRESS: "0x5FbDB2315678afecb367f032d93F642f64180aa3"
      BASE_REGISTRY_ADDRESS: "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512"
      # ... other env vars

  crosstown:
    environment:
      # If crosstown needs these too
      BASE_TOKEN_ADDRESS: "0x5FbDB2315678afecb367f032d93F642f64180aa3"
      BASE_REGISTRY_ADDRESS: "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512"
      # ... other env vars
```

## Quick Fix (Manual Deployment)

```bash
# 1. Stop stack
docker compose -f docker-compose-with-local.yml down

# 2. Deploy contracts manually
docker run --rm --network crosstown_crosstown-network \
  -v /Users/jonathangreen/Documents/connector/packages/contracts:/contracts \
  -w /contracts \
  ghcr.io/foundry-rs/foundry:latest \
  bash -c 'forge script script/DeployLocal.s.sol:DeployLocalScript --rpc-url http://anvil:8545 --broadcast && \
    echo "=== CONTRACT ADDRESSES ===" && \
    echo "AGENT_TOKEN=$(cat broadcast/DeployLocal.s.sol/31337/run-latest.json | jq -r \".transactions[0].contractAddress\")" && \
    echo "TOKEN_NETWORK=$(cat broadcast/DeployLocal.s.sol/31337/run-latest.json | jq -r \".transactions[1].contractAddress\")"'

# 3. Update .env or docker-compose with addresses
# 4. Restart stack
docker compose -f docker-compose-with-local.yml up -d
```

## Verification

After fixes, verify:

```bash
# 1. Check contracts are deployed
curl -s http://localhost:8545 -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_getCode","params":["0x5FbDB2315678afecb367f032d93F642f64180aa3", "latest"],"id":1}' \
  | jq -r '.result' | head -c 10
# Should output: 0x60806040... (not 0x)

# 2. Check settlement infrastructure
curl -s http://localhost:8081/admin/channels | jq
# Should NOT return "Settlement infrastructure not enabled"

# 3. Check connector knows about addresses
docker logs crosstown-connector 2>&1 | grep -i "base\|token\|registry"
```

## Long-term Solution

**Option A**: Use Anvil with persistent state
```yaml
anvil:
  command: ["anvil", "--host", "0.0.0.0", "--state", "/data/anvil-state.json", "--state-interval", "10"]
  volumes:
    - anvil-data:/data
```

**Option B**: Auto-deploy on every startup
- Remove `:ro` from deployer volume
- Add init container or startup script to connector that waits for contracts
- Parse deployment addresses automatically and set env vars

**Option C**: Use deterministic deployment
- Deploy with CREATE2 for deterministic addresses
- Hard-code known addresses in docker-compose
