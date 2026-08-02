// Phase F helper: mint N throwaway NIP-06 identities for multi.mjs.
//
//   node gen-identities.mjs state-multi 5
//
// Writes state-multi/session<i>.mnemonic.txt (never overwrites an existing
// one — faucet-funded identities must survive reruns) and prints the addresses
// to fund. Each EVM address needs one faucet call:
//   POST https://faucet.devnet.toonprotocol.dev/api/base-sepolia/request
//   {"address":"0x…"}   -> 1000 devnet USDC + 0.001 ETH gas, 24h/address
// Check `transactions.eth.dripped`: the ETH leg silently reports
// {"dripped":false,"skipped":true} when the faucet reserve is low, and the
// identity is then unusable (USDC but no gas to open a channel with).

import fs from 'node:fs';
import { generateMnemonic, deriveFullIdentity } from '@toon-protocol/client';

const dir = process.argv[2] ?? 'state-multi';
const n = Number(process.argv[3] ?? 5);
fs.mkdirSync(dir, { recursive: true });

const out = [];
for (let i = 0; i < n; i++) {
  const p = `${dir}/session${i}.mnemonic.txt`;
  let mnemonic;
  if (fs.existsSync(p)) mnemonic = fs.readFileSync(p, 'utf8').trim();
  else { mnemonic = generateMnemonic(); fs.writeFileSync(p, mnemonic + '\n'); }
  const id = await deriveFullIdentity(mnemonic, 0);
  out.push({ session: i, nostr: id.nostr.pubkey, evm: id.evm.address, solana: id.solana.publicKey });
}
console.log(JSON.stringify(out, null, 1));
