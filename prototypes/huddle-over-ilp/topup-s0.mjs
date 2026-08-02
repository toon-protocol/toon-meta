// One-off Phase I helper: top up session0's resumed Solana channel.
// (Deposit was 10 USDC from the pre-deploy probe; the full ladder + the
// single-session high-rate run needs ~35 USDC of claim headroom.)
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

const CHANNEL_ID = 'EadiuYCvFbJa5cwE1cHGtNf4tYP1qcj1BnmgtdYLv17a';
const AMOUNT = process.argv[2] ?? '40000000'; // +40 USDC

const chain = {
  key: 'solana:devnet',
  usdc: 'xyc5J8MgKFiEN13PnfftdXxUzYH34FEvw1LCrFwN7in',
  tokenNetwork: '2aEVJ8koKD8LTZrLRSGtAtU7LBt4e7QjjCgf1kzQ7Rip',
  rpc: 'https://api.devnet.solana.com',
};
const mnemonic = fs.readFileSync(path.join(STATE, 'session0.mnemonic.txt'), 'utf8').trim();
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
  channelStorePath: path.join(STATE, 'session0.sol.channels.json'),
  supportedChains: [chain.key],
  preferredTokens: { [chain.key]: chain.usdc },
  tokenNetworks: { [chain.key]: chain.tokenNetwork },
  chainRpcUrls: { [chain.key]: chain.rpc },
  solanaChannel: { rpcUrl: chain.rpc, programId: chain.tokenNetwork, tokenMint: chain.usdc },
  initialDeposit: '10000000',
});
await client.start();
try {
  // Resume (register) the channel first — depositToChannel only works on a
  // tracked channel, and tracking is populated by openChannel's resume path.
  const channelId = await client.openChannel('g.toon.relay');
  console.log('resumed channel:', channelId);
  if (channelId !== CHANNEL_ID) throw new Error(`unexpected channel ${channelId}`);
  const res = await client.depositToChannel(CHANNEL_ID, AMOUNT);
  console.log('deposit result:', res);
} finally {
  try { await client.stop(); } catch {}
}
process.exit(0);
