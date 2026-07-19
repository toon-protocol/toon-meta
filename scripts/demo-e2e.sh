#!/usr/bin/env bash
# demo-e2e.sh — the Rig public-chains demo, end to end.
#
# Walks the full demo: create a repo, rig init/commit/push (paid write with
# settlement on a public chain), deploy the permaweb site, buy an ArNS name
# through the store DVM (kind:5095 buyfor), and point the name at the site.
#
# Prereqs:
#   - rig >= 2.10.2 on PATH (npm i -g @toon-protocol/rig)
#     plus the optional ArNS deps next to it:
#     npm i -g @ar.io/sdk @ar.io/solana-contracts @solana/kit
#   - ~/.toon-client/config.json: keep it MINIMAL (network/btpUrl/relayUrl/
#     faucetUrl/destination/keystore) so settlement params derive from the
#     apex kind:10032 announce. Required extras (verified 2026-07-19):
#       "feePerEvent": "1000"            (matches the announced route price)
#       "chainRpcUrls": {                (consistent single-backend EVM RPC —
#         "evm:84532": "https://base-sepolia-rpc.publicnode.com",
#         "mina:devnet": "https://api.minascan.io/node/devnet/v1/graphql" }
#       "minaChannel": {                 (rig cannot derive this from announce)
#         "graphqlUrl": "https://api.minascan.io/node/devnet/v1/graphql",
#         "zkAppAddress": "<the announced tokenNetworks['mina:devnet']>",
#         "tokenId": "<the mock-USDC tokenId>", "networkId": "devnet" }
#     Do NOT set supportedChains/tokenNetworks/preferredTokens explicitly —
#     that bypasses announce-derived route prices (F06 rejections).
#   - Chain pinning uses the ANNOUNCED spellings: evm:84532, solana:devnet,
#     mina:devnet. Stale ~/.toon-client/rig-topology-cache.json can mask
#     config changes — delete it after editing config.
#   - A funded identity: `rig fund` (faucet drips USDC on all three chains;
#     https://faucet.devnet.toonprotocol.dev)
#
# Usage:
#   ./demo-e2e.sh <repo-dir> [arns-name]
#   CHAIN=solana:devnet ./demo-e2e.sh /tmp/rig-demo my-demo-name
# ArNS names: ~13+ chars keeps the lease under the store DVM's ARIO float.
set -euo pipefail

REPO_DIR=${1:?usage: demo-e2e.sh <repo-dir> [arns-name]}
ARNS_NAME=${2:-}
CHAIN=${CHAIN:-}            # pin a settlement chain, e.g. evm:base:84532
DVM_URL=${DVM_URL:-https://dvm.devnet.toonprotocol.dev}
RELAY=${RELAY:-wss://relay-ws.devnet.toonprotocol.dev}

step() { printf '\n\033[1m== %s\033[0m\n' "$*"; }

step "0/6 balances"
rig balance

step "1/6 repo + rig init"
mkdir -p "$REPO_DIR" && cd "$REPO_DIR"
git init -q 2>/dev/null || true
if [ ! -f README.md ]; then
  printf '# %s\n\nPushed with rig over TOON, settling on public chains.\n' \
    "$(basename "$REPO_DIR")" > README.md
  git add -A && git commit -q -m "feat: initial commit"
fi
rig init
rig remote add origin "$RELAY" 2>/dev/null || true

step "2/6 paid push (git objects -> Arweave, refs -> relay, Rig page)"
${CHAIN:+TOON_CLIENT_CHAIN=$CHAIN} rig push --yes

step "3/6 permaweb site"
rig site publish --yes
rig site url

if [ -n "$ARNS_NAME" ]; then
  step "4/6 ArNS: brokered buy through the store DVM (kind:5095)"
  rig name buy "$ARNS_NAME" --network devnet --via "$DVM_URL" --yes

  step "5/6 ArNS: point the name at the site manifest (kind:5096 gas-station)"
  MANIFEST_TX=$(rig site url | grep -oE '[A-Za-z0-9_-]{43}' | head -1)
  rig name set "$ARNS_NAME" "$MANIFEST_TX" --network devnet --via "$DVM_URL" --yes

  step "6/6 verify"
  rig name status "$ARNS_NAME" --network devnet
  echo "resolves at: https://$ARNS_NAME.ar-io.dev/"
else
  step "4-6/6 skipped (no arns-name argument)"
fi

step "done — settlement receipts"
rig channel list
rig balance
