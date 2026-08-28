// ── TOON devnet dashboard data layer (constants, types, formatters, fetchers) ──
export const C = { base:'#3d7bff', sol:'#14f195', ar:'#f5a623',
  ok:'#28d17c', bad:'#ff5c6c', warn:'#ffb347', gold:'#ffd479', pulse:'#7cf3c0', dim:'#5b6779' }

export type NostrEvent = { id:string; pubkey:string; kind:number; content:string; tags:string[][]; created_at:number; sig:string; _src?:string; _fresh?:boolean }

// ── what this page can and cannot see ───────────────────────────────────────
// Every counter this dashboard used to show came from the TypeScript
// connector's admin API. That surface is gone:
//
//   /admin/earnings.json, /admin/routes, /admin/peers, /admin/channels
//        404 since connector#665 deliberately narrowed the public nginx
//        allowlist to metrics.json alone -- the other four leaked peer ids,
//        on-chain channel ids and per-route settlement addresses to the
//        anonymous internet, which connector ADR 0008 never sanctioned.
//   /admin/metrics.json
//        502 since the TypeScript connectors were stopped on 2026-08-04. The
//        Rust connector that replaced them has no equivalent: ADR 0014 omits
//        per-peer metrics on purpose, and ADR 0008 makes the operator surface
//        refuse to start without a bearer token AND write keys, so there is no
//        unauthenticated shape left to point this page at. connector#776
//        retires the nginx block itself.
//
// So the packet counters, "recent claims", "net settled - session", and the
// routes/peers/channels node-detail tables have no data source and are gone
// rather than silently rendering zeros. What is left is genuinely live: the
// relay's Nostr WS stream (free reads) and on-chain balance reads.
export const RETIRED_TELEMETRY = 'Packet counters, settlement claims and the routes/peers/channels tables came from the TypeScript connector admin API, which no longer exists. Rather than render zeros, this page now shows only what it can actually observe.'

// STALE NODE SET: this page still models the fleet as apex + ario. The apex
// (`toon`, 104.237.150.177) was DESTROYED 2026-08-14 and proxy.devnet.* does not
// connect; the relay (proxy.relay.devnet.toonprotocol.dev) is the write ingress
// now, and a `gas` box joined 2026-08-27. The store box's ILP addresses are
// `g.toon.store` / `g.toon.relay.store` — `ario` is a box label, not a route.
export type NodeKey = 'toon' | 'ario'
export type NodeDef = { key:NodeKey; name:string; nid:string; ip:string; role:string; base:string }
export const ORIGIN = typeof location !== 'undefined' ? location.origin : ''
export const NODES: NodeDef[] = [
  { key:'toon', name:'TOON apex', nid:'g.toon', ip:'104.237.150.177', role:'client entry — accepts Base / Solana USDC; settles Solana with ario; hosts relay + faucet', base:ORIGIN },
  // The store box's paid edge was renamed to proxy.ario.* in connector#774.
  // The old proxy.store.* alias still resolves and the older dvm.* name no
  // longer answers at all; proxy.ario.* is the canonical name.
  { key:'ario', name:'Store · ario', nid:'g.toon.store', ip:'45.79.173.113', role:'terminates the route — Arweave DVM; g.toon.store + g.toon.relay.store, priced 1000 + 10/KiB', base:'https://proxy.ario.devnet.toonprotocol.dev' },
]
// Chain vocabulary for a settlement leg. Two chains, and only two: Mina left the
// connector repository with connector ADR 0065 (built #1205) — the zkApp, the
// tooling and the faucet's Mina legs are all deleted. What survives, and must
// NOT be "cleaned up", is the connector's refusal of a claim whose `blockchain`
// is `mina`, by name (connector ADR 0002): that is wire behaviour owed to
// toon-client, not Mina support.
export const LINKS = {
  base:{ label:'Base USDC', color:C.base, chain:'evm:84532' },
  sol :{ label:'Sol USDC',  color:C.sol,  chain:'solana:devnet' },
} as const
export type LinkKey = keyof typeof LINKS
// INBOUND_LINK[n] = the chain the leg *entering* n settles on. The head of the
// chain (toon) has no upstream node card, so its inbound leg — the client entry,
// chain-selectable via `rig chain set`, Base by default — is counted but not
// drawn; only ario's link column appears in the flow strip.
export const INBOUND_LINK: Record<NodeKey,Extract<LinkKey,'base'|'sol'>> = { toon:'base', ario:'sol' }

export const KIND: Record<number,string> = { 1:'note',3:'contacts',4:'dm',1063:'file-meta',1111:'comment',
  10032:'route-announce',10002:'relay-list',30617:'repo-announce',30618:'repo-state',1617:'patch',1621:'issue',1630:'status',
  5094:'store-request',5095:'arns-buy',5096:'gas-station',6094:'store-result',6095:'arns-result',6096:'gas-result',7000:'dvm-status' }
export const kindLabel = (k:number) => 'kind:'+k+(KIND[k]?' · '+KIND[k]:'')
export function kindColor(k:number){ if(k>=5000&&k<7000)return C.ar; if(k===7000)return C.warn; if(k>=30000||k===1617||k===1621||k===1630)return C.sol; if(k===10032||k===10002)return C.dim; if(k===1||k===1111)return C.base; return C.gold }
export function chainColor(c?:string){ c=(c||'').toLowerCase(); if(c.startsWith('evm'))return C.base; if(c.startsWith('sol'))return C.sol; return C.dim }

export function trunc(s?:string,h=6,t=4){ s=String(s||''); return s.length>h+t+1 ? s.slice(0,h)+'…'+s.slice(-t) : s }
export function ago(ts:string|number){ const s=Math.max(0,(Date.now()-new Date(ts).getTime())/1000); if(s<60)return Math.floor(s)+'s'; if(s<3600)return Math.floor(s/60)+'m'; if(s<86400)return Math.floor(s/3600)+'h'; return Math.floor(s/86400)+'d' }
export function packetDesc(ev:NostrEvent){ let c:any={}; try{ c=JSON.parse(ev.content) }catch{}
  if(ev.kind===10032) return { title:'route announce · '+(c.ilpAddress||''), line:(c.ilpAddress||'') }
  if(ev.kind===30617||ev.kind===30618){ const d=(ev.tags||[]).find(t=>t[0]==='d'); return { title:'git '+(KIND[ev.kind]||'')+(d?' · '+d[1]:''), line:'repo '+(d?d[1]:'') } }
  if(ev.kind>=5000&&ev.kind<7000) return { title:(KIND[ev.kind]||'DVM job'), line:String(ev.content).slice(0,60) }
  if(ev.kind===1) return { title:'note', line:String(ev.content).slice(0,80) }
  return { title:KIND[ev.kind]||('kind:'+ev.kind), line:String(ev.content).slice(0,70) }
}

// ── wallets & balances ──
export const RPC = { base:'https://base-sepolia-rpc.publicnode.com', sol:'https://api.devnet.solana.com' }
const BASE_USDC='0x49beE1Bca5d15Fb0963117923403F9498119a9Ce'
// Mock USDC on public Solana devnet, re-minted 2026-08-27: the previous mint
// (xyc5J8Mg…) is still on chain but its mint AUTHORITY is lost, so it can never
// be refilled. Canonical: connector/infra/linode/endpoints.json.
const SOL_USDC='34eSxY7qxQ4GzyhDJ8GpUcTz1WWzruGbJbR8q6TtxfQU'
export const ARIO_MINT='6vTw5CysRXQ4ybbHkDUiisHWVsBeMtUzYvJqs2iqHyaN'
export const NATIVE: Record<string,string> = { base:'ETH', sol:'SOL' }
export const GAS_FLOOR: Record<string,number> = { base:0.005, sol:0.1 }
export const EXPL: Record<string,(a:string)=>string> = { base:a=>`https://sepolia.basescan.org/address/${a}`, sol:a=>`https://explorer.solana.com/address/${a}?cluster=devnet` }
export type WalletRow = { role:string; chain:'base'|'sol'; addr:string; ario?:boolean }
const WALLETS: Record<NodeKey,{settle:Partial<Record<'base'|'sol',string>>; extra?:WalletRow[]}> = {
  toon:{ settle:{ base:'0xF29fD62C4848B9573C9b90adbF61b664F386d9CF', sol:'HgNmgJYrZFrx9DZgMopKa9971zGXW3hPL32Wsc6KzF6' } },
  ario:{ settle:{ base:'0x6B6c2DACf7Ac1F1273F72beF2E6084F9Ee6D3bff', sol:'W6yK72j365eK7t4Qj5An1AaYtUEJcJK7TBPvGeDk1LV' },
    // Both rotated 2026-07-31: the gas-station key had been committed to the
    // public repo, and the ARNS DVM key was swept alongside it. Old addresses
    // are drained -- monitoring them would show a permanently empty wallet.
    extra:[ {role:'ArNS DVM · ARIO', chain:'sol', addr:'BvX569bcuxh27uc14xcFEjYvf4RkN1dgYgrqX3YjVdYe', ario:true},
            {role:'gas station', chain:'sol', addr:'66oMXXhCFT6EhqE7LeGhbMXvV1PZyxatFZ74zvHfKCfr'} ] },
}
export function walletRows(key:NodeKey):WalletRow[]{ const w=WALLETS[key]; const rows:WalletRow[]=[];
  for(const ch of ['base','sol'] as const) if(w.settle[ch]) rows.push({role:'settlement',chain:ch,addr:w.settle[ch]!});
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
    return {}
  }catch(e:any){ return { err:e?.message||'err' } }
}
export function copy(t:string){ if(navigator.clipboard) navigator.clipboard.writeText(t) }

// ── liveness ────────────────────────────────────────────────────────────────
// `up` used to mean "GET /admin/metrics.json succeeded", which now means
// "false" on both boxes. The replacement signal is GET /ilp/identity: it is
// unauthenticated, free, and answers 200 with the connector's public key only
// once the process is serving AND has read its signer key file -- a strictly
// stronger claim than a counters fetch.
//
// The catch, verified in a browser against the deployed page rather than with
// curl: /ilp/identity carries NO Access-Control-Allow-Origin header, so only
// the box actually serving this page can be probed for real. From the apex
// origin, a cross-origin fetch to the store box rejects with a bare
// `TypeError: Failed to fetch` -- indistinguishable from the box being down.
// Rendering that as a red dot would recreate the exact bug this page is being
// fixed for, so we do not.
//
// Instead each node is probed as hard as its origin allows, and the UI says
// which of the two it got:
//
//   same-origin  -> read /ilp/identity. 200 + publicKey = `up`. Definitive.
//   cross-origin -> `mode:'no-cors'` reachability probe. The response is
//                   opaque (status is always 0, body unreadable), so this
//                   proves the host terminates TLS and answered *something*
//                   -- `reachable`, not `up`. It cannot tell 200 from 502.
//                   It does still catch a decommissioned box: the retired
//                   sandbox host rejects here, because its DNS now lands on
//                   parking IPs with no valid cert for the name.
//
// To upgrade the store box to a true `up`, add this page's origin to an
// Access-Control-Allow-Origin header on its `location /ilp/identity` -- that
// lives in the connector repo's nginx conf, not here.
export type LiveState = 'probing' | 'up' | 'reachable' | 'down'
export type Liveness = { state:LiveState; publicKey?:string; detail:string; checkedAt?:number }
export const crossOrigin = (base:string) => !!base && base !== ORIGIN

export async function probeLiveness(base:string):Promise<Liveness>{
  const url = base + '/ilp/identity', at = Date.now()
  const ctrl = new AbortController(); const t = setTimeout(()=>ctrl.abort(), 8000)
  try {
    if (crossOrigin(base)) {
      await fetch(url, { mode:'no-cors', cache:'no-store', signal:ctrl.signal })
      return { state:'reachable', detail:'host answered — response is opaque (no CORS), so its connector state is not readable from this page', checkedAt:at }
    }
    const r = await fetch(url, { cache:'no-store', signal:ctrl.signal })
    if (!r.ok) return { state:'down', detail:`/ilp/identity returned ${r.status}`, checkedAt:at }
    const j = await r.json() as { publicKey?:string }
    if (!j?.publicKey) return { state:'down', detail:'/ilp/identity answered without a public key', checkedAt:at }
    return { state:'up', publicKey:j.publicKey, detail:'serving, and its signer key is loaded', checkedAt:at }
  } catch {
    return { state:'down', detail:'no response — host unreachable or TLS failed', checkedAt:at }
  } finally { clearTimeout(t) }
}

export const LIVE_LABEL: Record<LiveState,string> = { probing:'checking…', up:'up', reachable:'reachable', down:'down' }
export const LIVE_DOT: Record<LiveState,string> = { probing:'bg-muted-foreground', up:'bg-emerald-400', reachable:'bg-amber-400', down:'bg-rose-500' }
