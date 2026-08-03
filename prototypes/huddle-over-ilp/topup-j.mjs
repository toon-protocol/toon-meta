// Phase J helper: top up a set of sessions' resumed Solana channels.
//   node topup-j.mjs "3,4" 15000000   → +15 USDC each for sessions 3 and 4
// Generalized from topup-s0.mjs (same wiring); sessions run sequentially to
// spare api.devnet.solana.com's rate limits.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ToonClient } from '@toon-protocol/client';
import { encodeEventToToon, decodeEventFromToon } from '@toon-protocol/core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STATE = path.join(HERE, 'state-multi');
const RELAY_WS = 'wss://relay-ws.devnet.toonprotocol.dev';
const APEX_BTP = 'wss://proxy.devnet.toonprotocol.dev/rust/ilp/btp';
const CONNECTOR_URL = 'https://proxy.devnet.toonprotocol.dev/rust';
const GENESIS_PEER_PUBKEY = '3f12da6d0cf10c91094894b88fc520757fc2860a1a5efb6664d3340ff97cfe40';

const SESSIONS = (process.argv[2] ?? '').split(',').map((s) => Number(s.trim())).filter((n) => Number.isInteger(n));
const AMOUNT = process.argv[3];
if (!SESSIONS.length || !AMOUNT) {
  console.error('usage: node topup-j.mjs "3,4" 15000000');
  process.exit(1);
}

const chain = {
  key: 'solana:devnet',
  usdc: 'xyc5J8MgKFiEN13PnfftdXxUzYH34FEvw1LCrFwN7in',
  tokenNetwork: '2aEVJ8koKD8LTZrLRSGtAtU7LBt4e7QjjCgf1kzQ7Rip',
  rpc: 'https://api.devnet.solana.com',
};

for (const idx of SESSIONS) {
  const mnemonic = fs.readFileSync(path.join(STATE, `session${idx}.mnemonic.txt`), 'utf8').trim();
  const client = new ToonClient({
    connectorUrl: CONNECTOR_URL,
    btpUrl: APEX_BTP,
    btpAuthToken: '',
    mnemonic,
    mnemonicAccountIndex: 0,
    ilpInfo: {
      pubkey: '00'.repeat(32),
      ilpAddress: 'g.toon.client',
      btpEndpoint: APEX_BTP,
      assetCode: 'USD',
      assetScale: 6,
    },
    toonEncoder: encodeEventToToon,
    toonDecoder: decodeEventFromToon,
    destinationAddress: 'g.toon.relay',
    relayUrl: '',
    knownPeers: [{ pubkey: GENESIS_PEER_PUBKEY, relayUrl: RELAY_WS, btpEndpoint: APEX_BTP }],
    channelStorePath: path.join(STATE, `session${idx}.sol.channels.json`),
    supportedChains: [chain.key],
    preferredTokens: { [chain.key]: chain.usdc },
    tokenNetworks: { [chain.key]: chain.tokenNetwork },
    chainRpcUrls: { [chain.key]: chain.rpc },
    solanaChannel: { rpcUrl: chain.rpc, programId: chain.tokenNetwork, tokenMint: chain.usdc },
    initialDeposit: '10000000',
  });
  await client.start();
  try {
    const channelId = await client.openChannel('g.toon.relay');
    console.log(`[s${idx}] resumed channel:`, channelId);
    const res = await client.depositToChannel(channelId, AMOUNT);
    console.log(`[s${idx}] deposit result:`, res);
  } catch (err) {
    console.error(`[s${idx}] TOPUP FAILED:`, err.message);
    process.exitCode = 1;
  } finally {
    try { await client.stop(); } catch {}
  }
}
process.exit(process.exitCode ?? 0);
