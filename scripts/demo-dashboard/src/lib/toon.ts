// ── TOON devnet dashboard data layer (constants, types, formatters, fetchers) ──
export const C = { mina:'#e94a8c', base:'#3d7bff', sol:'#14f195', ar:'#f5a623',
  ok:'#28d17c', bad:'#ff5c6c', warn:'#ffb347', gold:'#ffd479', pulse:'#7cf3c0', dim:'#5b6779' }

export type Metrics = { uptimeSeconds:number; aggregate:{ packetsForwarded:number; packetsRejected:number; bytesSent:number; packetsLocallyDelivered:number }; peers:PeerStat[]; timestamp:string }
export type PeerStat = { peerId:string; connected:boolean; packetsForwarded:number; packetsRejected:number; bytesSent:number; lastPacketAt?:string }
export type Claim = { peerId:string; assetCode:string; assetScale:number; amount:string; direction:string; at:string }
export type Earnings = { uptimeSeconds:number; recentClaims:Claim[] }
export type Route = { prefix:string; nextHop:string; priority:number; termination?:{ upstream:string; price:string; chains:string[]; ilpAddress:string; settlementAddresses:Record<string,string> } }
export type Peer = { id:string; connected:boolean; ilpAddresses:string[]; routeCount:number }
export type Channel = { channelId:string; peerId:string; chain:string; status:string; deposit:string; lastActivity:string }
export type NostrEvent = { id:string; pubkey:string; kind:number; content:string; tags:string[][]; created_at:number; sig:string; _src?:string; _fresh?:boolean }

// The fleet is two boxes: the apex (client entry + relay + faucet) and the ario
// store, which terminates the route. The former sandbox entry box was
// decommissioned 2026-07-31 — it is no longer needed and no longer exists.
export type NodeKey = 'toon' | 'ario'
export type NodeDef = { key:NodeKey; name:string; nid:string; ip:string; role:string; base:string }
export const ORIGIN = typeof location !== 'undefined' ? location.origin : ''
export const NODES: NodeDef[] = [
  { key:'toon', name:'TOON apex', nid:'g.toon', ip:'104.237.150.177', role:'client entry — accepts Base / Solana USDC; settles Solana with ario; hosts relay + faucet', base:ORIGIN },
  { key:'ario', name:'Store · ario', nid:'g.toon.ario', ip:'45.79.173.113', role:'terminates the route — Arweave DVM, receives Sol USDC', base:'https://dvm.devnet.toonprotocol.dev' },
]
// Chain vocabulary for a settlement leg. `mina` still names a live devnet chain
// — the apex and ario both hold Mina settlement wallets, which the balance table
// below still reads — but no leg in the fleet settles in Mina today, so no drawn
// link currently carries the mina label. The Mina *entry* leg was only ever
// exercised through the retired sandbox entry box.
export const LINKS = {
  mina:{ label:'Mina USDC', color:C.mina, chain:'mina:devnet' },
  base:{ label:'Base USDC', color:C.base, chain:'evm:84532' },
  sol :{ label:'Sol USDC',  color:C.sol,  chain:'solana:devnet' },
} as const
export type LinkKey = keyof typeof LINKS
// INBOUND_LINK[n] = the chain the leg *entering* n settles on. The head of the
// chain (toon) has no upstream node card, so its inbound leg — the client entry,
// chain-selectable via `rig chain set`, Base by default — is counted but not
// drawn; only ario's link column appears in the flow strip.
export const INBOUND_LINK: Record<NodeKey,Extract<LinkKey,'base'|'sol'>> = { toon:'base', ario:'sol' }
export const NODE_RELAY: Record<NodeKey,string> = { toon:'toon', ario:'toon' }

const ASSETS: Record<string,{sym:string;net:string;color:string}> = {
  '0x49bee1bca5d15fb0963117923403f9498119a9ce':{sym:'USDC',net:'Base',color:C.base},
  'xyc5J8MgKFiEN13PnfftdXxUzYH34FEvw1LCrFwN7in':{sym:'USDC',net:'Solana',color:C.sol},
  '2aEVJ8koKD8LTZrLRSGtAtU7LBt4e7QjjCgf1kzQ7Rip':{sym:'USDC',net:'Solana',color:C.sol},
  'B62qqN1Pu3kF2KGmqLA8EwpqfWrnFTVZJGDSDHQuQRoVt5BCFjhNz3d':{sym:'USDC',net:'Mina',color:C.mina},
  'MINA':{sym:'USDC',net:'Mina',color:C.mina},
}
export function asset(code?:string){ if(!code) return {sym:'?',net:'?',color:C.dim}; return ASSETS[code] || ASSETS[code.toLowerCase()] || {sym:'?',net:trunc(code),color:C.dim} }

export const KIND: Record<number,string> = { 1:'note',3:'contacts',4:'dm',1063:'file-meta',1111:'comment',
  10032:'route-announce',10002:'relay-list',30617:'repo-announce',30618:'repo-state',1617:'patch',1621:'issue',1630:'status',
  5094:'store-request',5095:'arns-buy',5096:'gas-station',6094:'store-result',6095:'arns-result',6096:'gas-result',7000:'dvm-status' }
export const kindLabel = (k:number) => 'kind:'+k+(KIND[k]?' · '+KIND[k]:'')
export function kindColor(k:number){ if(k>=5000&&k<7000)return C.ar; if(k===7000)return C.warn; if(k>=30000||k===1617||k===1621||k===1630)return C.sol; if(k===10032||k===10002)return C.dim; if(k===1||k===1111)return C.base; return C.gold }
export function chainColor(c?:string){ c=(c||'').toLowerCase(); if(c.startsWith('evm'))return C.base; if(c.startsWith('sol'))return C.sol; if(c.startsWith('mina'))return C.mina; return C.dim }

export function trunc(s?:string,h=6,t=4){ s=String(s||''); return s.length>h+t+1 ? s.slice(0,h)+'…'+s.slice(-t) : s }
export function fmtAmt(a:string|number){ const n=Number(a); if(!isFinite(n)) return String(a); return (n/1e6).toLocaleString(undefined,{maximumFractionDigits:4}) }
export function ago(ts:string|number){ const s=Math.max(0,(Date.now()-new Date(ts).getTime())/1000); if(s<60)return Math.floor(s)+'s'; if(s<3600)return Math.floor(s/60)+'m'; if(s<86400)return Math.floor(s/3600)+'h'; return Math.floor(s/86400)+'d' }
export function upt(s?:number){ if(s==null)return '—'; const d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60); return d?`${d}d ${h}h`:h?`${h}h ${m}m`:`${m}m` }
export function claimId(c:Claim){ return c.peerId+'|'+c.at+'|'+c.amount+'|'+c.direction }
export function packetDesc(ev:NostrEvent){ let c:any={}; try{ c=JSON.parse(ev.content) }catch{}
  if(ev.kind===10032) return { title:'route announce · '+(c.ilpAddress||''), line:(c.ilpAddress||'') }
  if(ev.kind===30617||ev.kind===30618){ const d=(ev.tags||[]).find(t=>t[0]==='d'); return { title:'git '+(KIND[ev.kind]||'')+(d?' · '+d[1]:''), line:'repo '+(d?d[1]:'') } }
  if(ev.kind>=5000&&ev.kind<7000) return { title:(KIND[ev.kind]||'DVM job'), line:String(ev.content).slice(0,60) }
  if(ev.kind===1) return { title:'note', line:String(ev.content).slice(0,80) }
  return { title:KIND[ev.kind]||('kind:'+ev.kind), line:String(ev.content).slice(0,70) }
}

// ── wallets & balances ──
export const RPC = { base:'https://base-sepolia-rpc.publicnode.com', sol:'https://api.devnet.solana.com', mina:'https://api.minascan.io/node/devnet/v1/graphql' }
const BASE_USDC='0x49beE1Bca5d15Fb0963117923403F9498119a9Ce'
const SOL_USDC='xyc5J8MgKFiEN13PnfftdXxUzYH34FEvw1LCrFwN7in'
export const ARIO_MINT='6vTw5CysRXQ4ybbHkDUiisHWVsBeMtUzYvJqs2iqHyaN'
export const NATIVE: Record<string,string> = { base:'ETH', sol:'SOL', mina:'MINA' }
export const GAS_FLOOR: Record<string,number> = { base:0.005, sol:0.1, mina:1 }
export const EXPL: Record<string,(a:string)=>string> = { base:a=>`https://sepolia.basescan.org/address/${a}`, sol:a=>`https://explorer.solana.com/address/${a}?cluster=devnet`, mina:a=>`https://minascan.io/devnet/account/${a}` }
export const SETTLE_THRESHOLD=5000, SETTLE_TIMEOUT=3600

export type WalletRow = { role:string; chain:'base'|'sol'|'mina'; addr:string; ario?:boolean }
const WALLETS: Record<NodeKey,{settle:Partial<Record<'base'|'sol'|'mina',string>>; extra?:WalletRow[]}> = {
  toon:{ settle:{ base:'0xF29fD62C4848B9573C9b90adbF61b664F386d9CF', sol:'HgNmgJYrZFrx9DZgMopKa9971zGXW3hPL32Wsc6KzF6', mina:'B62qkEx3MsKtaEJqJMg8ZC2eXtz8FNpZy4huVpBnnUHVRUEf5f1vqdq' } },
  ario:{ settle:{ base:'0x6B6c2DACf7Ac1F1273F72beF2E6084F9Ee6D3bff', sol:'W6yK72j365eK7t4Qj5An1AaYtUEJcJK7TBPvGeDk1LV', mina:'B62qkWSoKW4ewE2Wn7ibgtXz6TV72L22YVGoz2bL5x3yu4FsUipdQG8' },
    // Both rotated 2026-07-31: the gas-station key had been committed to the
    // public repo, and the ARNS DVM key was swept alongside it. Old addresses
    // are drained -- monitoring them would show a permanently empty wallet.
    extra:[ {role:'ArNS DVM · ARIO', chain:'sol', addr:'BvX569bcuxh27uc14xcFEjYvf4RkN1dgYgrqX3YjVdYe', ario:true},
            {role:'gas station', chain:'sol', addr:'66oMXXhCFT6EhqE7LeGhbMXvV1PZyxatFZ74zvHfKCfr'} ] },
}
export function walletRows(key:NodeKey):WalletRow[]{ const w=WALLETS[key]; const rows:WalletRow[]=[];
  for(const ch of ['base','sol','mina'] as const) if(w.settle[ch]) rows.push({role:'settlement',chain:ch,addr:w.settle[ch]!});
  for(const x of (w.extra||[])) rows.push(x); return rows }
export function gasWarn(chain:string,v?:number){ return v!=null && v<GAS_FLOOR[chain] }

export type Bal = { native?:number; usdc?:number; ario?:number; err?:string }
async function rpc(url:string,body:any){ const ctrl=new AbortController(); const t=setTimeout(()=>ctrl.abort(),8000)
  try{ const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:ctrl.signal}); return r.json() }
  finally{ clearTimeout(t) } }
export async function readBal(chain:string,addr:string,wantArio?:boolean):Promise<Bal>{
  try{
    if(chain==='base'){ const b=await rpc(RPC.base,{jsonrpc:'2.0',id:1,method:'eth_getBalance',params:[addr,'latest']})
      const data='0x70a08231'+addr.slice(2).toLowerCase().padStart(64,'0')
      const u=await rpc(RPC.base,{jsonrpc:'2.0',id:2,method:'eth_call',params:[{to:BASE_USDC,data},'latest']})
      return { native:parseInt(b.result||'0x0',16)/1e18, usdc:parseInt(u.result||'0x0',16)/1e6 } }
    if(chain==='sol'){ const b=await rpc(RPC.sol,{jsonrpc:'2.0',id:1,method:'getBalance',params:[addr]})
      const t=await rpc(RPC.sol,{jsonrpc:'2.0',id:2,method:'getTokenAccountsByOwner',params:[addr,{programId:'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'},{encoding:'jsonParsed'}]})
      let usdc=0,ario=0; for(const a of (t.result?.value||[])){ const i=a.account.data.parsed.info; const amt=i.tokenAmount.uiAmount||0
        if(i.mint===SOL_USDC) usdc+=amt; if(i.mint===ARIO_MINT) ario+=amt }
      return { native:(b.result?.value||0)/1e9, usdc, ario:wantArio?ario:undefined } }
    if(chain==='mina'){ const r=await rpc(RPC.mina,{query:`{account(publicKey:"${addr}"){balance{total}}}`})
      return { native:Number(r.data?.account?.balance?.total||0)/1e9 } }
    return {}
  }catch(e:any){ return { err:e?.message||'err' } }
}
export async function fetchJSON<T=any>(base:string,path:string):Promise<T>{ const r=await fetch(base+path,{cache:'no-store'}); if(!r.ok) throw new Error(String(r.status)); return r.json() }
export function copy(t:string){ if(navigator.clipboard) navigator.clipboard.writeText(t) }
