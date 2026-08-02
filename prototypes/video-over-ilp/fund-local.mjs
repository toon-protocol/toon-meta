// Fund the harness's local NIP-06 identity on the local-stack anvil:
// 10 ETH for gas + 10,000 mock USDC for channel collateral + frame fees.
// anvil account 0 is unlocked and owns the settlement topology.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateMnemonic, deriveFullIdentity } from '@toon-protocol/client';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STATE = path.join(HERE, 'state-local');
const RPC = 'http://127.0.0.1:8545';
const USDC = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const ACC0 = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

fs.mkdirSync(STATE, { recursive: true });
const mf = path.join(STATE, 'mnemonic.txt');
if (!fs.existsSync(mf)) fs.writeFileSync(mf, generateMnemonic());
const mnemonic = fs.readFileSync(mf, 'utf8').trim();
const id = await deriveFullIdentity(mnemonic, 0);
const addr = id.evm.address;
console.log('funding', addr, 'nostr', id.nostr.pubkey.slice(0, 12));

let rpcId = 1;
async function rpc(method, params) {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: rpcId++, method, params }),
  });
  const j = await res.json();
  if (j.error) throw new Error(`${method}: ${JSON.stringify(j.error)}`);
  return j.result;
}

// 10 ETH
await rpc('eth_sendTransaction', [
  { from: ACC0, to: addr, value: '0x' + (10n * 10n ** 18n).toString(16) },
]);
// 10,000 USDC (6 dec). MockERC20: try mint(address,uint256), else transfer.
const amount = (10_000n * 10n ** 6n).toString(16).padStart(64, '0');
const dest = addr.slice(2).toLowerCase().padStart(64, '0');
try {
  await rpc('eth_sendTransaction', [
    { from: ACC0, to: USDC, data: '0x40c10f19' + dest + amount }, // mint
  ]);
  console.log('minted');
} catch (e) {
  console.log('mint failed, transferring instead:', e.message.slice(0, 80));
  await rpc('eth_sendTransaction', [
    { from: ACC0, to: USDC, data: '0xa9059cbb' + dest + amount }, // transfer
  ]);
}
await new Promise((r) => setTimeout(r, 500));
const bal = await rpc('eth_call', [
  { to: USDC, data: '0x70a08231' + dest },
  'latest',
]);
console.log('USDC balance:', Number(BigInt(bal)) / 1e6);
const eth = await rpc('eth_getBalance', [addr, 'latest']);
console.log('ETH balance:', Number(BigInt(eth)) / 1e18);
