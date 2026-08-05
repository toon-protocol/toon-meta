import { useState, type ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useDashboard, RELAY_COUNT, type Dashboard } from '@/lib/hooks'
import {
  NODES, LINKS, INBOUND_LINK, C, chainColor, kindColor, kindLabel, packetDesc,
  trunc, ago, walletRows, gasWarn, NATIVE, EXPL, copy, crossOrigin,
  LIVE_LABEL, LIVE_DOT, RETIRED_TELEMETRY, type NodeKey, type NostrEvent,
} from '@/lib/toon'

type Detail = { badge?:string; badgeColor?:string; title:string; fields:[string,ReactNode][]; content?:string; raw:unknown }

// ── small primitives ──
function ColorBadge({ color, children }: { color:string; children:ReactNode }) {
  return <span className="tnum inline-block rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold whitespace-nowrap" style={{ background:color, color:'#04121a' }}>{children}</span>
}
function Copy({ v }: { v:string }) {
  return <button className="ml-1.5 text-[11px] text-muted-foreground underline decoration-dotted hover:text-foreground" onClick={()=>copy(v)}>copy</button>
}
function Addr({ chain, addr }: { chain:string; addr:string }) {
  return <span className="font-mono text-[11.5px]"><a href={EXPL[chain]?.(addr)} target="_blank" rel="noopener" className="text-amber-400 no-underline hover:underline">{trunc(addr,8,6)} ↗</a><Copy v={addr} /></span>
}

// ── packet row ──
function PacketRow({ ev, onClick }: { ev:NostrEvent; onClick:()=>void }) {
  const d = packetDesc(ev)
  return (
    <div onClick={onClick} className={'flex cursor-pointer items-center gap-2.5 border-b border-border/60 px-2 py-1.5 text-[12.5px] hover:bg-accent ' + (ev._fresh?'anim-slidein':'')}>
      <span className="rounded-md px-2 py-0.5 text-[11px] font-bold text-center min-w-[104px]" style={{ background:kindColor(ev.kind), color:'#04121a' }}>{kindLabel(ev.kind)}</span>
      <span className="min-w-0 flex-1 truncate">{d.line}</span>
      <span className="rounded-full border border-border px-1.5 text-[10.5px] text-muted-foreground whitespace-nowrap">{ev._src}</span>
      <span className="tnum text-[11px] text-muted-foreground whitespace-nowrap">{ago(ev.created_at*1000)}</span>
    </div>
  )
}

// ── node card ──
function GasChip({ chain, v, err }: { chain:string; v?:number; err?:string }) {
  const low = gasWarn(chain, v)
  const label = err ? '—' : v==null ? '…' : (v<1?v.toFixed(3):v.toFixed(2))
  return <span className={'tnum rounded-md border px-1.5 py-0.5 text-[11px] ' + (low ? 'border-rose-500 bg-rose-500 font-semibold text-[#04121a]' : 'border-border bg-muted/40 text-muted-foreground')}>{NATIVE[chain]} {label}{low?' ⚠':''}</span>
}
// The liveness line is deliberately wordy. A coloured dot alone cannot say
// whether it means "this connector is serving" or "this host answered but
// would not let us read the answer", and those are the two different things
// this page can actually establish.
function LiveLine({ dash, nk }: { dash:Dashboard; nk:NodeKey }) {
  const n = NODES.find(x=>x.key===nk)!; const l = dash.node[nk]
  const state = l?.state ?? 'probing'
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className={'h-2.5 w-2.5 shrink-0 rounded-full '+LIVE_DOT[state]} />
        <h2 className="text-[15.5px] font-semibold">{n.name}</h2>
        <span className="ml-auto text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{LIVE_LABEL[state]}</span>
      </div>
      <div className="mt-1 text-[11.5px] leading-snug text-muted-foreground">
        <span className="font-mono text-[11px] text-foreground/70">GET /ilp/identity</span> — {l?.detail || 'no probe yet'}
      </div>
      {l?.publicKey && <div className="mt-1 font-mono text-[11px] text-muted-foreground">key {trunc(l.publicKey,10,6)}<Copy v={l.publicKey} /></div>}
    </div>
  )
}

function NodeCard({ dash, nk, onOpen }: { dash:Dashboard; nk:NodeKey; onOpen:()=>void }) {
  const n = NODES.find(x=>x.key===nk)!
  return (
    <Card onClick={onOpen} tabIndex={0} role="button"
      className="group relative min-w-[210px] cursor-pointer gap-0 p-4 transition-colors hover:border-ring/60">
      <div className="absolute right-4 top-9 text-[11px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">details →</div>
      <LiveLine dash={dash} nk={nk} />
      <div className="mt-2 font-mono text-xs text-amber-400">{n.nid} · {n.ip}</div>
      <div className="mt-1 font-mono text-[11px] text-muted-foreground">{crossOrigin(n.base) ? n.base.replace(/^https:\/\//,'') : 'this origin'}</div>
      <div className="my-2 min-h-8 text-xs text-muted-foreground">{n.role}</div>
      <Separator />
      <div className="mt-2.5">
        <div className="mb-1.5 text-[10.5px] uppercase tracking-wide text-muted-foreground">settlement wallets · live on-chain</div>
        <div className="flex flex-wrap gap-1.5">{walletRows(nk).filter(w=>w.role==='settlement').map(w => <GasChip key={w.addr} chain={w.chain} v={dash.bal[w.addr]?.native} err={dash.bal[w.addr]?.err} />)}</div>
      </div>
    </Card>
  )
}

// Static topology, not a live feed. The travelling spark and the packet tally
// were both driven by the delta in metrics.json's packetsForwarded; with no
// counter to difference, an animated rail would be pure decoration implying
// traffic nobody is measuring. The leg itself is still a true fact about how
// these two nodes settle, so the label stays and the motion goes.
function LinkCol({ which }: { which:'mina'|'base'|'sol' }) {
  const L = LINKS[which]
  return (
    <div className="flex min-w-[120px] flex-col items-center justify-center px-1.5">
      <div className="mb-2.5 rounded-full px-2.5 py-[3px] text-[11px] font-semibold" style={{ background:L.color, color:'#04121a' }}>{L.label}</div>
      <div className="relative h-[3px] w-full rounded-[3px]" style={{ background:'var(--border)' }}>
        <div className="absolute inset-0 rounded-[3px]" style={{ background:L.color, opacity:.35 }} />
      </div>
      <div className="mt-2 text-center text-[10.5px] leading-tight text-muted-foreground">{L.chain}<br/><span className="opacity-70">throughput not measurable</span></div>
    </div>
  )
}

// ── live packets panel ──
function LivePackets({ dash, onPacket }: { dash:Dashboard; onPacket:(ev:NostrEvent)=>void }) {
  return (
    <Card className="mt-6 gap-0 p-4">
      <div className="mb-2 flex items-center gap-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Live packets</h3>
        <span className="text-[11.5px] text-muted-foreground">Nostr events carried through the connectors — kind-labelled, click for full data</span>
        <span className="ml-auto flex items-center gap-1.5 text-[11.5px] text-muted-foreground"><i className={'inline-block h-2 w-2 rounded-full '+(dash.relaysUp>0?'bg-emerald-400':'bg-muted-foreground')} />{dash.relaysUp>0?`${dash.relaysUp}/${RELAY_COUNT} relay${RELAY_COUNT>1?'s':''} live`:'connecting…'}</span>
      </div>
      <ScrollArea className="h-[340px]">
        {dash.packets.length ? dash.packets.slice(0,60).map(ev => <PacketRow key={ev.id} ev={ev} onClick={()=>onPacket(ev)} />)
          : <div className="p-2.5 text-xs italic text-muted-foreground">waiting for packets…</div>}
      </ScrollArea>
    </Card>
  )
}

// ── node detail dialog ──
function Sec({ title, hint, children }: { title:string; hint?:string; children:ReactNode }) {
  return <div className="mt-5"><h3 className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">{title}{hint && <span className="ml-1 font-normal normal-case tracking-normal text-muted-foreground/70">{hint}</span>}</h3>{children}</div>
}
function NodeDialog({ dash, nk, onClose }: { dash:Dashboard; nk:NodeKey|null; onClose:()=>void }) {
  const n = nk ? NODES.find(x=>x.key===nk)! : null
  const l = nk ? dash.node[nk] : undefined
  return (
    <Dialog open={!!nk} onOpenChange={o=>{ if(!o) onClose() }}>
      <DialogContent className="max-w-[95vw] sm:max-w-[900px] max-h-[88vh] overflow-y-auto">
        {n && nk && <>
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2.5 text-[19px]"><span className={'h-2.5 w-2.5 rounded-full '+LIVE_DOT[l?.state ?? 'probing']} />{n.name}<span className="font-mono text-[12.5px] font-normal text-amber-400">{n.nid} · {n.ip}</span></DialogTitle>
        </DialogHeader>
        <div className="text-[13px] text-muted-foreground">{n.role}</div>

        <Sec title="Liveness" hint="· the only health signal this page can still read">
          <div className="rounded-lg border border-border bg-muted/20 p-3 text-[12.5px]">
            <div className="flex items-center gap-2"><span className={'h-2.5 w-2.5 rounded-full '+LIVE_DOT[l?.state ?? 'probing']} /><b>{LIVE_LABEL[l?.state ?? 'probing']}</b>
              <span className="text-muted-foreground">— {l?.detail}</span></div>
            <div className="mt-2 text-muted-foreground">probe <span className="font-mono text-foreground/80">GET {n.base || '(this origin)'}/ilp/identity</span> · {crossOrigin(n.base)
              ? 'cross-origin from this page, and that endpoint sends no Access-Control-Allow-Origin, so the browser may not read the response. The probe therefore only establishes that the host answered.'
              : 'same origin as this page, so the response is fully readable — a 200 with a public key proves the connector is serving and has loaded its signer key.'}</div>
            {l?.publicKey && <div className="mt-2 font-mono text-[11.5px]">publicKey <button className="underline decoration-dotted" onClick={()=>copy(l.publicKey!)}>{trunc(l.publicKey,14,10)}</button></div>}
            {l?.checkedAt && <div className="mt-1 text-[11.5px] text-muted-foreground">checked {ago(l.checkedAt)} ago</div>}
          </div>
        </Sec>

        <Sec title="Retired telemetry" hint="· why this dialog is shorter than it used to be">
          <div className="rounded-lg border border-amber-300/20 bg-amber-300/[0.06] p-3 text-[12.5px] text-muted-foreground">
            <div>{RETIRED_TELEMETRY}</div>
            <div className="mt-2">Gone from this dialog: <span className="font-mono text-[11.5px]">routes</span>, <span className="font-mono text-[11.5px]">peers</span>, <span className="font-mono text-[11.5px]">channels</span> (404 since connector#665 narrowed the public nginx allowlist) and the packet/claim counters from <span className="font-mono text-[11.5px]">metrics.json</span>/<span className="font-mono text-[11.5px]">earnings.json</span> (502 since the TypeScript connectors were stopped; the Rust connector exposes no unauthenticated equivalent).</div>
          </div>
        </Sec>

        <Sec title="Wallets & balances" hint="· top-up targets (live on-chain)">
          <Table><TableHeader><TableRow><TableHead>wallet</TableHead><TableHead>chain</TableHead><TableHead>address</TableHead><TableHead>native gas</TableHead><TableHead>token</TableHead></TableRow></TableHeader>
            <TableBody>{walletRows(nk).map(w => { const b = dash.bal[w.addr]||{}; const low = gasWarn(w.chain, b.native)
              return <TableRow key={w.addr}><TableCell>{w.role}</TableCell><TableCell><ColorBadge color={chainColor(w.chain)}>{w.chain}</ColorBadge></TableCell><TableCell><Addr chain={w.chain} addr={w.addr} /></TableCell>
                <TableCell>{b.err?<span className="text-muted-foreground">rpc err</span>:b.native==null?'…':<b className={low?'text-rose-400':''}>{(b.native<1?b.native.toFixed(4):b.native.toFixed(3))} {NATIVE[w.chain]}{low?' ⚠ low':''}</b>}</TableCell>
                <TableCell>{w.ario ? (b.ario==null?'…':<b className="text-amber-500">{(b.ario||0).toLocaleString(undefined,{maximumFractionDigits:2})} ARIO</b>) : (b.usdc!=null?`${b.usdc.toLocaleString(undefined,{maximumFractionDigits:2})} USDC`:'—')}</TableCell></TableRow> })}</TableBody></Table>
        </Sec>

        </>}
      </DialogContent>
    </Dialog>
  )
}

// ── generic detail dialog (packet / claim) ──
function DetailDialog({ detail, onClose }: { detail:Detail|null; onClose:()=>void }) {
  let content = detail?.content; if (content){ try { content = JSON.stringify(JSON.parse(content), null, 2) } catch {} }
  return (
    <Dialog open={!!detail} onOpenChange={o=>{ if(!o) onClose() }}>
      <DialogContent className="max-w-[95vw] sm:max-w-[640px] max-h-[88vh] overflow-y-auto">
        {detail && <>
        <DialogHeader><DialogTitle className="flex items-center gap-2.5 text-[17px]">{detail.badge && <span className="rounded-md px-1.5 py-0.5 text-xs font-semibold" style={{ background:detail.badgeColor||C.gold, color:'#04121a' }}>{detail.badge}</span>}{detail.title}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-[130px_1fr] gap-x-3.5 gap-y-1.5 text-[12.5px]">{detail.fields.map(([k,v],i) => <div key={i} className="contents"><div className="text-muted-foreground">{k}</div><div className="break-all">{v}</div></div>)}</div>
        {content && <div><h3 className="mt-3.5 text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">content</h3><pre className="mt-1 max-h-[300px] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-black/30 p-3 font-mono text-[11.5px]">{content}</pre></div>}
        <h3 className="mt-3.5 text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">raw</h3>
        <pre className="mt-1 max-h-[300px] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-black/30 p-3 font-mono text-[11.5px]">{JSON.stringify(detail.raw, null, 2)}</pre>
        </>}
      </DialogContent>
    </Dialog>
  )
}

// ── app ──
export default function App() {
  const dash = useDashboard()
  const [nodeKey, setNodeKey] = useState<NodeKey|null>(null)
  const [detail, setDetail] = useState<Detail|null>(null)

  const openPacket = (ev:NostrEvent) => { const d = packetDesc(ev)
    setDetail({ badge:kindLabel(ev.kind), badgeColor:kindColor(ev.kind), title:d.title, content:ev.content, raw:ev, fields:[
      ['kind', `${ev.kind}`],
      ['relay', ev._src ?? '—'],
      ['event id', <span className="cursor-pointer font-mono underline decoration-dotted" onClick={()=>copy(ev.id)}>{trunc(ev.id,12,10)}</span>],
      ['author', <span className="cursor-pointer font-mono underline decoration-dotted" onClick={()=>copy(ev.pubkey)}>{trunc(ev.pubkey,12,10)}</span>],
      ['created', `${new Date(ev.created_at*1000).toISOString()} (${ago(ev.created_at*1000)} ago)`],
      ['tags', (ev.tags||[]).length ? <span className="font-mono text-[11.5px]">{(ev.tags||[]).slice(0,12).map(t=>JSON.stringify(t)).join('  ')}</span> : '—'],
    ] }) }
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-[1320px] px-5 pb-16 pt-6">
        <header className="mb-1 flex flex-wrap items-baseline gap-3.5">
          <h1 className="text-[19px] font-semibold tracking-tight">TOON devnet · node health &amp; relay stream</h1>
          <span className="text-[13px] text-muted-foreground">cross-currency multihop · client USDC → Solana → Arweave · click any node or packet for detail</span>
          <span className="ml-auto flex items-center gap-2 text-[12.5px] text-muted-foreground"><span className={'h-2 w-2 rounded-full '+(dash.live?'bg-emerald-400 anim-beat':'bg-muted-foreground')} />{dash.live?`probed · ${dash.lastPoll}`:'connecting…'}</span>
        </header>

        <Card className="mt-4 gap-0 border-amber-300/20 bg-amber-300/[0.05] p-3.5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-300/90">What this page can still see</div>
          <div className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
            {RETIRED_TELEMETRY} Live now: a per-node <span className="font-mono text-[11.5px] text-foreground/80">GET /ilp/identity</span> liveness probe, the relay's Nostr event stream, and on-chain wallet balances.
            {dash.low>0 && <span className="ml-1.5 font-semibold text-rose-400">⚠ {dash.low} wallet{dash.low>1?'s':''} low on gas.</span>}
          </div>
        </Card>

        <div className="mt-5 grid items-stretch gap-2 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          <NodeCard dash={dash} nk="toon" onOpen={()=>setNodeKey('toon')} />
          <LinkCol which={INBOUND_LINK.ario} />
          <NodeCard dash={dash} nk="ario" onOpen={()=>setNodeKey('ario')} />
        </div>

        <LivePackets dash={dash} onPacket={openPacket} />

        <Card className="mt-4 gap-0 p-4 font-mono text-[12px] leading-relaxed text-muted-foreground">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Route &amp; settlement</div>
          <div><span className="text-amber-400">client → toon</span> · <b className="text-foreground">Base Sepolia USDC</b> by default (Solana via <code>rig chain set</code>) · pays wss://proxy.devnet.toonprotocol.dev</div>
          <div><span className="text-amber-400">toon ↔ ario</span> · <b className="text-foreground">Solana devnet USDC</b> · solana:devnet · peered over BTP</div>
          <div><span className="text-amber-400">termination</span> · <b className="text-foreground">g.toon.ario</b> · Arweave store (kind:5094 pay-to-store) · proxy.ario.devnet.toonprotocol.dev</div>
        </Card>

        <footer className="mt-6 text-center text-[11.5px] text-muted-foreground">liveness via GET /ilp/identity @10s · packets via relay Nostr WS · balances via chain RPCs @45s · the connector admin API is no longer publicly readable, so no packet or settlement counters are shown</footer>
      </div>

      <NodeDialog dash={dash} nk={nodeKey} onClose={()=>setNodeKey(null)} />
      <DetailDialog detail={detail} onClose={()=>setDetail(null)} />
    </div>
  )
}
