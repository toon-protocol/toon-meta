import { useEffect, useRef, useState } from 'react'
import { NODES, walletRows, readBal, fetchJSON, claimId, gasWarn,
  type NodeKey, type Metrics, type Earnings, type Route, type Peer, type Channel, type NostrEvent, type Bal } from './toon'

type NodeState = { metrics?:Metrics; earnings?:Earnings; up:boolean; fwd:number }
const RELAYS = [ { url:'wss://relay-ws.devnet.toonprotocol.dev', tag:'toon' }, { url:'wss://relay-ws.sandbox.devnet.toonprotocol.dev', tag:'sandbox' } ]

export type Dashboard = ReturnType<typeof useDashboard>

export function useDashboard(){
  const [, force] = useState(0); const render = () => force(x => x + 1)
  const r = useRef({
    node: {} as Record<NodeKey, NodeState>,
    profit: { sandbox:0, toon:0, ario:0 } as Record<NodeKey, number>,
    seen: { sandbox:new Set<string>(), toon:new Set<string>(), ario:new Set<string>() } as Record<NodeKey, Set<string>>,
    prevFwd: {} as Record<string, number>,
    linkCount: { mina:0, base:0, sol:0 } as Record<'mina'|'base'|'sol', number>,
    pulse: { sandbox:0, toon:0, ario:0 } as Record<NodeKey, number>,
    packets: [] as NostrEvent[],
    pById: new Map<string, NostrEvent>(),
    firstBatch: true,
    relaysUp: 0,
    bal: {} as Record<string, Bal>,
    live: false, lastPoll: '',
  }).current

  useEffect(() => {
    let alive = true
    async function poll(){
      await Promise.allSettled(NODES.map(async n => {
        const [m, e] = await Promise.allSettled([ fetchJSON<Metrics>(n.base,'/admin/metrics.json'), fetchJSON<Earnings>(n.base,'/admin/earnings.json') ])
        const st = r.node[n.key] || (r.node[n.key] = { up:false, fwd:0 })
        if (m.status === 'fulfilled') {
          st.metrics = m.value; st.up = true
          const fwd = m.value.aggregate?.packetsForwarded || 0
          if (r.prevFwd[n.key] != null && fwd > r.prevFwd[n.key]) {
            r.pulse[n.key]++
            r.linkCount[({ sandbox:'mina', toon:'base', ario:'sol' } as const)[n.key]]++
          }
          st.fwd = fwd; r.prevFwd[n.key] = fwd
        } else st.up = false
        if (e.status === 'fulfilled') {
          st.earnings = e.value
          const seen = r.seen[n.key]
          for (const c of (e.value.recentClaims || [])) { const id = claimId(c); if (seen.has(id)) continue; seen.add(id)
            const amt = Number(c.amount) || 0; if (!amt) continue
            r.profit[n.key] += (c.direction === 'outbound' ? -amt : amt) }
        }
      }))
      r.live = NODES.some(n => r.node[n.key]?.up); r.lastPoll = new Date().toLocaleTimeString()
      if (alive) render()
    }
    poll(); const id = setInterval(poll, 1500)
    return () => { alive = false; clearInterval(id) }
  }, [])

  // relays (Nostr WS)
  useEffect(() => {
    let alive = true; const sockets: WebSocket[] = []
    function addPacket(ev:NostrEvent, src:string){ if (r.pById.has(ev.id)) return; ev._src = src; ev._fresh = !r.firstBatch
      r.pById.set(ev.id, ev); r.packets.push(ev); r.packets.sort((a,b)=>b.created_at-a.created_at)
      if (r.packets.length > 80){ const rm = r.packets.pop()!; r.pById.delete(rm.id) }; render() }
    function connect(relay:{url:string;tag:string}){ if(!alive) return; let ws:WebSocket
      try { ws = new WebSocket(relay.url) } catch { setTimeout(()=>connect(relay),3000); return }
      sockets.push(ws)
      ws.onopen = () => { r.relaysUp++; render(); ws.send(JSON.stringify(['REQ','dash-'+relay.tag,{limit:25}])) }
      ws.onmessage = m => { try { const a = JSON.parse(m.data); if (a[0]==='EVENT') addPacket(a[2], relay.tag); if (a[0]==='EOSE') r.firstBatch = false } catch {} }
      ws.onclose = () => { r.relaysUp = Math.max(0, r.relaysUp-1); render(); if (alive) setTimeout(()=>connect(relay),3000) }
      ws.onerror = () => { try { ws.close() } catch {} }
    }
    RELAYS.forEach(connect)
    return () => { alive = false; sockets.forEach(s => { try { s.close() } catch {} }) }
  }, [])

  // balances (chain RPCs)
  useEffect(() => {
    let alive = true
    async function fetchBalances(){
      await Promise.allSettled((['sandbox','toon','ario'] as NodeKey[]).map(async key => {
        await Promise.allSettled(walletRows(key).map(async row => { r.bal[row.addr] = await readBal(row.chain, row.addr, row.ario) }))
        if (alive) render()
      }))
    }
    fetchBalances(); const id = setInterval(fetchBalances, 45000)
    return () => { alive = false; clearInterval(id) }
  }, [])

  const totals = { profit: r.profit.sandbox + r.profit.toon + r.profit.ario, packets: NODES.reduce((s,n)=> s + (r.node[n.key]?.fwd||0), 0) }
  let low = 0; for (const key of ['sandbox','toon','ario'] as NodeKey[]) for (const row of walletRows(key)){ const b = r.bal[row.addr]; if (b && !b.err && gasWarn(row.chain, b.native)) low++ }
  return { node:r.node, profit:r.profit, linkCount:r.linkCount, pulse:r.pulse, packets:r.packets, relaysUp:r.relaysUp, bal:r.bal, totals, low, live:r.live, lastPoll:r.lastPoll }
}

// per-node routes/peers/channels while the detail dialog is open
export function useNodeDetail(open:boolean, key:NodeKey|null){
  const [d, setD] = useState<{ routes?:Route[]; routeCount?:number; peers?:Peer[]; channels?:Channel[] }>({})
  useEffect(() => {
    if (!open || !key) return; let alive = true
    const base = NODES.find(n => n.key === key)!.base
    async function go(){ const [ro, pe, ch] = await Promise.allSettled([
        fetchJSON(base,'/admin/routes'), fetchJSON(base,'/admin/peers'), fetchJSON<Channel[]>(base,'/admin/channels') ])
      if (!alive) return
      setD({ routes: ro.status==='fulfilled'?ro.value.routes:undefined, routeCount: ro.status==='fulfilled'?ro.value.routeCount:undefined,
        peers: pe.status==='fulfilled'?pe.value.peers:undefined, channels: ch.status==='fulfilled'?ch.value:undefined }) }
    go(); const id = setInterval(go, 1500)
    return () => { alive = false; clearInterval(id) }
  }, [open, key])
  return d
}
