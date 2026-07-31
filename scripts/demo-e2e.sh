#!/usr/bin/env bash
# demo-e2e.sh — the Rig public-chains demo, end to end.
#
# Walks the full demo: create a repo, rig init/commit/push (paid write with
# settlement on a public chain), deploy the permaweb site, buy an ArNS name
# through the store DVM (kind:5095 buyfor), and point the name at the site.
#
# Prereqs:
#   - rig >= 2.13.0 on PATH (npm i -g @toon-protocol/rig)
#     plus the optional ArNS deps next to it:
#     npm i -g @ar.io/sdk @ar.io/solana-contracts @solana/kit
#   - ZERO config needed on the apex path: relay/ingress come from the
#     genesis seed or announce, chain params from core presets + announce,
#     the faucet is inferred, the devnet DVM is the default --via, and the
#     Mina per-pair zkApp auto-deploys on first use. (A hand-written
#     ~/.toon-client/config.json still wins field-by-field; after editing
#     one, delete ~/.toon-client/rig-topology-cache.json.)
#   - A funded identity: FUND=1 runs `rig fund` for you (USDC on all three
#     chains; https://faucet.devnet.toonprotocol.dev). GAS is assumed —
#     hold a little ETH (Base Sepolia) and SOL.
#
# Usage:
#   ./demo-e2e.sh <repo-dir> [arns-name]
#   CHAIN=solana:devnet ./demo-e2e.sh /tmp/rig-demo my-demo-name
#   FUND=1 ./demo-e2e.sh /tmp/rig-demo                 # faucet drip first
# Chain pinning uses the ANNOUNCED spellings: evm:84532, solana:devnet,
# mina:devnet. ArNS names: ~13+ chars keeps the lease under the DVM's float.
#
# The fleet is two boxes: the client pays the `toon` apex, which settles Solana
# with the `ario` store DVM (toon → ario). The sandbox entry box that once
# fronted a Mina entry leg was decommissioned 2026-07-31 and is no longer
# needed, so ENTRY/sandbox handling is gone from this script.
set -euo pipefail

REPO_DIR=${1:?usage: demo-e2e.sh <repo-dir> [arns-name]}
ARNS_NAME=${2:-}
CHAIN=${CHAIN:-}            # pin a settlement chain, e.g. evm:84532
FUND=${FUND:-}              # non-empty: run `rig fund` before the demo
DVM_URL=${DVM_URL:-}        # optional --via override (rig defaults it on devnet)
RELAY=${RELAY:-wss://relay-ws.devnet.toonprotocol.dev}

step() { printf '\n\033[1m== %s\033[0m\n' "$*"; }

if [ -n "$FUND" ]; then
  step "0a/6 faucet drip (USDC, all chains — gas is assumed)"
  rig fund
fi

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
# The repo's git origin is the relay it publishes through — it OVERRIDES the
# config relayUrl, so pin it here (override with RELAY=<wss://…>).
rig remote add origin "$RELAY" 2>/dev/null || true

step "2/6 paid push (git objects -> Arweave, refs -> relay, Rig page)"
${CHAIN:+TOON_CLIENT_CHAIN=$CHAIN} rig push --yes

step "3/6 permaweb site"
rig site publish --yes
rig site url

if [ -n "$ARNS_NAME" ]; then
  step "4/6 ArNS: brokered buy through the store DVM (kind:5095)"
  rig name buy "$ARNS_NAME" --network devnet ${DVM_URL:+--via "$DVM_URL"} --yes

  step "5/6 ArNS: point the name at the site manifest (kind:5096 gas-station)"
  MANIFEST_TX=$(rig site url | grep -oE '[A-Za-z0-9_-]{43}' | head -1)
  rig name set "$ARNS_NAME" "$MANIFEST_TX" --network devnet ${DVM_URL:+--via "$DVM_URL"} --yes

  step "6/6 verify"
  rig name status "$ARNS_NAME" --network devnet
  echo "resolves at: https://$ARNS_NAME.ar-io.dev/"
else
  step "4-6/6 skipped (no arns-name argument)"
fi

step "done — settlement receipts"
rig channels
rig balance
