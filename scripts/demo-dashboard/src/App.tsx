import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useDashboard, useNodeDetail, type Dashboard } from '@/lib/hooks'
import {
  NODES, LINKS, INBOUND_LINK, NODE_RELAY, C, asset, chainColor, kindColor, kindLabel, packetDesc,
  trunc, fmtAmt, ago, upt, claimId, walletRows, gasWarn, NATIVE, EXPL, copy,
  SETTLE_THRESHOLD, SETTLE_TIMEOUT, type NodeKey, type Claim, type NostrEvent,
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

// ── recent-claim / packet rows ──
function ClaimRow({ c, withPeer, onClick }: { c:Claim; withPeer?:boolean; onClick:()=>void }) {
  const a = asset(c.assetCode); const amt = Number(c.amount)
  return (
    <div onClick={onClick} className="flex cursor-pointer items-center gap-1.5 rounded-md px-1 py-[3px] text-xs tnum hover:bg-accent">
      <ColorBadge color={a.color}>{a.net} {a.sym}</ColorBadge>
      {amt>0 ? <span className="font-semibold">{fmtAmt(c.amount)} {a.sym}</span> : <span className="text-muted-foreground text-[11px]">settle ✓</span>}
      <span className="text-muted-foreground text-[11px]">{c.direction}</span>
      {withPeer && <span className="font-mono text-[11px] text-muted-foreground" title={c.peerId}>{trunc(c.peerId,10,6)}</span>}
      <span className="ml-auto text-[11px] text-muted-foreground">{ago(c.at)}</span>
    </div>
  )
}
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
function NodeCard({ dash, nk, onOpen, onClaim }: { dash:Dashboard; nk:NodeKey; onOpen:()=>void; onClaim:(c:Claim)=>void }) {
  const n = NODES.find(x=>x.key===nk)!; const st = dash.node[nk]
  const agg = st?.metrics?.aggregate; const claims = (st?.earnings?.recentClaims||[]).slice(0,4)
  const bumpRef = useRef<HTMLDivElement>(null); const hitRef = useRef<HTMLDivElement>(null)
  const pulse = dash.pulse[nk]
  useEffect(() => { if (pulse>0) {
    bumpRef.current?.classList.remove('anim-bump'); void bumpRef.current?.offsetWidth; bumpRef.current?.classList.add('anim-bump')
    hitRef.current?.classList.add('node-hit'); const t=setTimeout(()=>hitRef.current?.classList.remove('node-hit'),700); return ()=>clearTimeout(t)
  } }, [pulse])
  return (
    <Card ref={hitRef} onClick={onOpen} tabIndex={0} role="button"
      className="group relative min-w-[210px] cursor-pointer gap-0 p-4 transition-colors hover:border-ring/60">
      <div className="absolute right-4 top-4 text-[11px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">details →</div>
      <div className="flex items-center gap-2"><span className={'h-2.5 w-2.5 rounded-full '+(st?.up?'bg-emerald-400':'bg-rose-500')} /><h2 className="text-[15.5px] font-semibold">{n.name}</h2></div>
      <div className="mt-0.5 font-mono text-xs text-amber-400">{n.nid} · {n.ip}</div>
      <div className="my-2 min-h-8 text-xs text-muted-foreground">{n.role}</div>
      <div className="mb-2 flex items-end gap-4">
        <div><div ref={bumpRef} className="tnum text-[32px] font-bold leading-none">{(agg?.packetsForwarded||0).toLocaleString()}</div><div className="text-[11px] uppercase tracking-wide text-muted-foreground">forwarded</div></div>
        <div><div className={'text-base font-semibold '+((agg?.packetsRejected||0)>0?'text-rose-400':'text-muted-foreground')}>{(agg?.packetsRejected||0).toLocaleString()}</div><div className="text-[11px] uppercase tracking-wide text-muted-foreground">rejected</div></div>
      </div>
      <div className="mb-2 flex items-center gap-1.5 rounded-lg border border-amber-300/20 bg-amber-300/[0.06] px-2 py-1.5">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">net settled · session</span>
        <span className="tnum ml-auto font-bold text-amber-300">{fmtAmt(dash.profit[nk])} USDC</span>
      </div>
      <div className="mb-2 flex flex-wrap gap-1.5">{walletRows(nk).filter(w=>w.role==='settlement').map(w => <GasChip key={w.addr} chain={w.chain} v={dash.bal[w.addr]?.native} err={dash.bal[w.addr]?.err} />)}</div>
      <Separator />
      <div className="mt-2 flex justify-between text-[11.5px] text-muted-foreground"><span>uptime {upt(st?.metrics?.uptimeSeconds)}</span><span>{((agg?.bytesSent||0)/1024).toFixed(1)} KB</span></div>
      <div className="mt-2 border-t border-border pt-2">
        <div className="mb-1 text-[10.5px] uppercase tracking-wide text-muted-foreground">peers</div>
        {(st?.metrics?.peers||[]).map(p => (
          <div key={p.peerId} className="flex items-center gap-1.5 py-0.5 text-xs">
            <span className={'h-[7px] w-[7px] rounded-full '+(p.connected?'bg-emerald-400':'bg-rose-500')} />
            <span className="truncate font-mono text-[11.5px]" title={p.peerId}>{p.peerId}</span>
            <span className="tnum ml-auto text-muted-foreground">{(p.packetsForwarded||0).toLocaleString()} fwd</span>
          </div>
        ))}
      </div>
      <div className="mt-2 min-h-[52px] border-t border-border pt-2" onClick={e=>e.stopPropagation()}>
        <div className="mb-1 text-[10.5px] uppercase tracking-wide text-muted-foreground">recent claims</div>
        {claims.length ? claims.map((c,i) => <ClaimRow key={claimId(c)+i} c={c} onClick={()=>onClaim(c)} />) : <div className="text-xs italic text-muted-foreground">no claims yet</div>}
      </div>
    </Card>
  )
}

function LinkCol({ which, count }: { which:'mina'|'base'|'sol'; count:number }) {
  const L = LINKS[which]; const railRef = useRef<HTMLDivElement>(null); const first = useRef(true)
  useEffect(() => { if (first.current){ first.current=false; return }
    railRef.current?.classList.remove('go'); void railRef.current?.offsetWidth; railRef.current?.classList.add('go') }, [count])
  return (
    <div className="flex min-w-[120px] flex-col items-center justify-center px-1.5">
      <div className="mb-2.5 rounded-full px-2.5 py-[3px] text-[11px] font-semibold" style={{ background:L.color, color:'#04121a' }}>{L.label}</div>
      <div className="relative h-[3px] w-full rounded-[3px]" style={{ background:'var(--border)' }}>
        <div className="absolute inset-0 rounded-[3px]" style={{ background:L.color, opacity:.35 }} />
        <div ref={railRef} className="link-spark absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full" style={{ background:L.color, boxShadow:`0 0 10px ${L.color}`, left:0, opacity:0 }} />
      </div>
      <div className="mt-2 text-center text-[10.5px] leading-tight text-muted-foreground"><span className="tnum">{count}</span> pkts<br/>{L.chain}</div>
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
        <span className="ml-auto flex items-center gap-1.5 text-[11.5px] text-muted-foreground"><i className={'inline-block h-2 w-2 rounded-full '+(dash.relaysUp>0?'bg-emerald-400':'bg-muted-foreground')} />{dash.relaysUp>0?`${dash.relaysUp}/2 relays live`:'connecting…'}</span>
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
function NodeDialog({ dash, nk, onClose, onPacket, onClaim }: { dash:Dashboard; nk:NodeKey|null; onClose:()=>void; onPacket:(ev:NostrEvent)=>void; onClaim:(c:Claim)=>void }) {
  const d = useNodeDetail(!!nk, nk)
  const n = nk ? NODES.find(x=>x.key===nk)! : null
  const st = nk ? dash.node[nk] : undefined; const agg = st?.metrics?.aggregate
  const claims = (st?.earnings?.recentClaims||[]); const nodePackets = nk ? dash.packets.filter(e => e._src===NODE_RELAY[nk]).slice(0,25) : []
  const byPeer:Record<string,number> = {}; for (const c of claims) if (Number(c.amount)>0) byPeer[c.peerId] = Math.max(byPeer[c.peerId]||0, Number(c.amount))
  return (
    <Dialog open={!!nk} onOpenChange={o=>{ if(!o) onClose() }}>
      <DialogContent className="max-w-[95vw] sm:max-w-[900px] max-h-[88vh] overflow-y-auto">
        {n && nk && <>
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2.5 text-[19px]"><span className={'h-2.5 w-2.5 rounded-full '+(st?.up?'bg-emerald-400':'bg-muted-foreground')} />{n.name}<span className="font-mono text-[12.5px] font-normal text-amber-400">{n.nid} · {n.ip}</span></DialogTitle>
        </DialogHeader>
        <div className="text-[13px] text-muted-foreground">{n.role}</div>
        <div className="flex flex-wrap gap-6">
          {[['forwarded',(agg?.packetsForwarded||0).toLocaleString()],['rejected',(agg?.packetsRejected||0).toLocaleString()]].map(([l,v]) => <div key={l}><div className="tnum text-2xl font-bold">{v}</div><div className="text-[10.5px] uppercase tracking-wide text-muted-foreground">{l}</div></div>)}
          <div><div className="tnum text-2xl font-bold text-amber-300">{fmtAmt(dash.profit[nk])} <span className="text-[13px] text-muted-foreground">USDC</span></div><div className="text-[10.5px] uppercase tracking-wide text-muted-foreground">net settled · session</div></div>
          <div><div className="tnum text-2xl font-bold">{((agg?.bytesSent||0)/1024).toFixed(1)}<span className="text-[13px] text-muted-foreground"> KB</span></div><div className="text-[10.5px] uppercase tracking-wide text-muted-foreground">bytes</div></div>
          <div><div className="tnum text-2xl font-bold">{upt(st?.metrics?.uptimeSeconds)}</div><div className="text-[10.5px] uppercase tracking-wide text-muted-foreground">uptime</div></div>
        </div>

        <Sec title="Routes resolved" hint={d.routeCount!=null?`· ${d.routeCount} routes`:''}>
          <Table><TableHeader><TableRow><TableHead>prefix</TableHead><TableHead>next hop</TableHead><TableHead>termination / settlement</TableHead></TableRow></TableHeader>
            <TableBody>{(d.routes||[]).map(rt => (
              <TableRow key={rt.prefix}><TableCell className="font-mono text-amber-400">{rt.prefix}</TableCell><TableCell className="font-mono">{rt.nextHop}</TableCell>
                <TableCell>{rt.termination ? <div className="text-[12px]">upstream <span className="font-mono">{rt.termination.upstream}</span> · price <b>{rt.termination.price}</b>
                  <div className="mt-1 flex flex-wrap gap-1">{rt.termination.chains.map(c => <ColorBadge key={c} color={chainColor(c)}>{c}</ColorBadge>)}</div>
                  <div className="mt-1">{Object.entries(rt.termination.settlementAddresses||{}).map(([c,a]) => <div key={c} className="font-mono text-[11.5px] text-muted-foreground">{c}: <button className="underline decoration-dotted" onClick={()=>copy(a)}>{trunc(a,8,6)}</button></div>)}</div>
                </div> : <span className="text-muted-foreground">transit route</span>}</TableCell></TableRow>))}</TableBody></Table>
        </Sec>

        <Sec title="Settlement channels" hint={d.channels?`· ${d.channels.length} open`:''}>
          <Table><TableHeader><TableRow><TableHead>chain</TableHead><TableHead>channel id</TableHead><TableHead>peer</TableHead><TableHead>status</TableHead><TableHead>deposit</TableHead><TableHead>last activity</TableHead></TableRow></TableHeader>
            <TableBody>{(d.channels||[]).map(c => (
              <TableRow key={c.channelId}><TableCell><ColorBadge color={chainColor(c.chain)}>{c.chain}</ColorBadge></TableCell>
                <TableCell className="cursor-pointer font-mono" title={c.channelId} onClick={()=>copy(c.channelId)}>{trunc(c.channelId,10,6)}</TableCell>
                <TableCell className="font-mono">{trunc(c.peerId,12,6)}</TableCell>
                <TableCell className={c.status==='open'?'text-emerald-400':'text-rose-400'}>{c.status}</TableCell>
                <TableCell>{c.deposit&&c.deposit!=='unknown'&&c.deposit!=='0'?fmtAmt(c.deposit)+' USDC':'—'}</TableCell>
                <TableCell className="text-muted-foreground">{c.lastActivity?ago(c.lastActivity)+' ago':'—'}</TableCell></TableRow>))}</TableBody></Table>
        </Sec>

        <Sec title="Wallets & balances" hint="· top-up targets (live on-chain)">
          <Table><TableHeader><TableRow><TableHead>wallet</TableHead><TableHead>chain</TableHead><TableHead>address</TableHead><TableHead>native gas</TableHead><TableHead>token</TableHead></TableRow></TableHeader>
            <TableBody>{walletRows(nk).map(w => { const b = dash.bal[w.addr]||{}; const low = gasWarn(w.chain, b.native)
              return <TableRow key={w.addr}><TableCell>{w.role}</TableCell><TableCell><ColorBadge color={chainColor(w.chain)}>{w.chain}</ColorBadge></TableCell><TableCell><Addr chain={w.chain} addr={w.addr} /></TableCell>
                <TableCell>{b.err?<span className="text-muted-foreground">rpc err</span>:b.native==null?'…':<b className={low?'text-rose-400':''}>{(b.native<1?b.native.toFixed(4):b.native.toFixed(3))} {NATIVE[w.chain]}{low?' ⚠ low':''}</b>}</TableCell>
                <TableCell>{w.ario ? (b.ario==null?'…':<b className="text-amber-500">{(b.ario||0).toLocaleString(undefined,{maximumFractionDigits:2})} ARIO</b>) : (b.usdc!=null?`${b.usdc.toLocaleString(undefined,{maximumFractionDigits:2})} USDC`:'—')}</TableCell></TableRow> })}</TableBody></Table>
        </Sec>

        <Sec title="Settlement policy">
          <div className="text-[12.5px]">on-chain settle at <b>≥ {SETTLE_THRESHOLD/1e6} USDC</b> unsettled per channel <span className="text-muted-foreground">(threshold {SETTLE_THRESHOLD} base units)</span> — or every <b>{SETTLE_TIMEOUT/60} min</b> (settlementTimeoutSecs {SETTLE_TIMEOUT})</div>
          <Table className="mt-2"><TableHeader><TableRow><TableHead>counterparty</TableHead><TableHead>largest recent claim</TableHead><TableHead className="w-[200px]">proximity</TableHead></TableRow></TableHeader>
            <TableBody>{Object.entries(byPeer).slice(0,6).map(([p,a]) => { const frac=Math.min(1,a/SETTLE_THRESHOLD)
              return <TableRow key={p}><TableCell className="font-mono">{trunc(p,12,6)}</TableCell><TableCell>{fmtAmt(a)} USDC</TableCell>
                <TableCell><Progress value={frac*100} className="h-2" /><span className="text-[11px] text-muted-foreground">{frac>=1?'≥ threshold · settles promptly':`${(frac*100).toFixed(0)}% of threshold`}</span></TableCell></TableRow> })}</TableBody></Table>
          <div className="mt-2 text-[11.5px] text-muted-foreground">The connector's <b>live unsettled balance</b> is not exposed by the 3.36.x admin API — the bar shows the largest recent claim vs the threshold as a proximity proxy, not the exact pending amount.</div>
        </Sec>

        <Sec title="Peers">
          <Table><TableHeader><TableRow><TableHead>peer · connected</TableHead><TableHead>ILP addresses</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>{(d.peers||[]).map(p => <TableRow key={p.id}><TableCell><span className={'mr-1 inline-block h-2 w-2 rounded-full '+(p.connected?'bg-emerald-400':'bg-rose-500')} /><span className="font-mono">{p.id}</span></TableCell><TableCell className="font-mono text-[11.5px]">{(p.ilpAddresses||[]).join('  ')}</TableCell><TableCell>{p.routeCount} routes</TableCell></TableRow>)}</TableBody></Table>
        </Sec>

        <Sec title="Packets · relay events" hint="· kind-labelled, click for full data">
          <div className="max-h-[280px] overflow-y-auto rounded-md border border-border">
            {nodePackets.length ? nodePackets.map(ev => <PacketRow key={ev.id} ev={ev} onClick={()=>onPacket(ev)} />) : <div className="p-2 text-xs italic text-muted-foreground">no packets seen yet on this node's relay</div>}
          </div>
        </Sec>

        <Sec title="Settlement claims" hint="· money, click a row for full data">
          {claims.length ? claims.slice(0,40).map((c,i) => <ClaimRow key={claimId(c)+i} c={c} withPeer onClick={()=>onClaim(c)} />) : <div className="text-xs italic text-muted-foreground">no claims yet</div>}
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
  const openClaim = (c:Claim) => { const a = asset(c.assetCode)
    setDetail({ badge:'settlement claim', badgeColor:a.color, title:`${a.net} ${a.sym} · ${c.direction}`, raw:c, fields:[
      ['direction', c.direction],
      ['amount', Number(c.amount)>0 ? <><b>{fmtAmt(c.amount)} {a.sym}</b> <span className="text-muted-foreground">({c.amount} base units, scale {c.assetScale})</span></> : 'settle ✓ (amount untracked on this leg)'],
      ['asset', `${a.net} ${a.sym}`],
      ['assetCode', <span className="cursor-pointer font-mono underline decoration-dotted" onClick={()=>copy(c.assetCode)}>{c.assetCode}</span>],
      ['counterparty', <span className="cursor-pointer font-mono underline decoration-dotted" onClick={()=>copy(c.peerId)}>{c.peerId}</span>],
      ['settled at', `${c.at} (${ago(c.at)} ago)`],
    ] }) }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-[1320px] px-5 pb-16 pt-6">
        <header className="mb-1 flex flex-wrap items-baseline gap-3.5">
          <h1 className="text-[19px] font-semibold tracking-tight">TOON devnet · live packet flow</h1>
          <span className="text-[13px] text-muted-foreground">cross-currency multihop · Mina → Base → Solana → Arweave · click any node or packet for detail</span>
          <span className="ml-auto flex items-center gap-2 text-[12.5px] text-muted-foreground"><span className={'h-2 w-2 rounded-full '+(dash.live?'bg-emerald-400 anim-beat':'bg-muted-foreground')} />{dash.live?`live · ${dash.lastPoll}`:'connecting…'}</span>
        </header>

        <Card className="mt-4 flex-row flex-wrap items-center gap-6 p-4">
          <div><div className="tnum text-[26px] font-bold text-amber-300">{fmtAmt(dash.totals.profit)}<span className="ml-1 text-sm font-semibold text-muted-foreground">USDC</span></div><div className="text-[10.5px] uppercase tracking-wide text-muted-foreground">network profit · session (net settled)</div></div>
          <div><div className="tnum text-[26px] font-bold" style={{ color:C.pulse }}>{dash.totals.packets.toLocaleString()}</div><div className="text-[10.5px] uppercase tracking-wide text-muted-foreground">packets forwarded · all nodes</div></div>
          {dash.low>0 && <div className="text-[13px] font-semibold text-rose-400">⚠ {dash.low} wallet{dash.low>1?'s':''} low on gas</div>}
          <div className="ml-auto flex flex-wrap gap-3.5 text-xs text-muted-foreground">{NODES.map(n => <span key={n.key} className="tnum">{n.name.split(' ')[0]} <b className="text-foreground">{fmtAmt(dash.profit[n.key])}</b></span>)}</div>
        </Card>

        <div className="mt-5 grid items-stretch gap-2 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)]">
          <NodeCard dash={dash} nk="sandbox" onOpen={()=>setNodeKey('sandbox')} onClaim={openClaim} />
          <LinkCol which={INBOUND_LINK.toon} count={dash.linkCount.base} />
          <NodeCard dash={dash} nk="toon" onOpen={()=>setNodeKey('toon')} onClaim={openClaim} />
          <LinkCol which={INBOUND_LINK.ario} count={dash.linkCount.sol} />
          <NodeCard dash={dash} nk="ario" onOpen={()=>setNodeKey('ario')} onClaim={openClaim} />
        </div>

        <LivePackets dash={dash} onPacket={openPacket} />

        <Card className="mt-4 gap-0 p-4 font-mono text-[12px] leading-relaxed text-muted-foreground">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Route &amp; settlement</div>
          <div><span className="text-amber-400">client → sandbox</span> · <b className="text-foreground">Mina devnet USDC</b> · pays wss://proxy.sandbox.devnet.toonprotocol.dev</div>
          <div><span className="text-amber-400">sandbox ↔ toon</span> · <b className="text-foreground">Base Sepolia USDC</b> · evm:84532</div>
          <div><span className="text-amber-400">toon ↔ ario</span> · <b className="text-foreground">Solana devnet USDC</b> · solana:devnet · shared channel 5z6znXjH…</div>
          <div><span className="text-amber-400">termination</span> · <b className="text-foreground">g.toon.ario</b> · Arweave DVM (kind:5094 pay-to-store)</div>
        </Card>

        <footer className="mt-6 text-center text-[11.5px] text-muted-foreground">read-only telemetry · /admin/{'{'}metrics,earnings,routes,peers,channels{'}'} @1.5s · packets via relay Nostr WS · balances via chain RPCs @45s · profit accumulates from claims since load</footer>
      </div>

      <NodeDialog dash={dash} nk={nodeKey} onClose={()=>setNodeKey(null)} onPacket={openPacket} onClaim={openClaim} />
      <DetailDialog detail={detail} onClose={()=>setDetail(null)} />
    </div>
  )
}
