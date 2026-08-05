import { useEffect, useRef, useState } from 'react'
import { NODES, walletRows, readBal, probeLiveness, gasWarn,
  type NodeKey, type Liveness, type NostrEvent, type Bal } from './toon'

const RELAYS = [ { url:'wss://relay-ws.devnet.toonprotocol.dev', tag:'toon' } ]
export const RELAY_COUNT = RELAYS.length
const NODE_KEYS = NODES.map(n => n.key)

export type Dashboard = ReturnType<typeof useDashboard>

export function useDashboard(){
  const [, force] = useState(0); const render = () => force(x => x + 1)
  const r = useRef({
    node: Object.fromEntries(NODES.map(n => [n.key, { state:'probing', detail:'' } as Liveness])) as Record<NodeKey, Liveness>,
    packets: [] as NostrEvent[],
    pById: new Map<string, NostrEvent>(),
    firstBatch: true,
    relaysUp: 0,
    bal: {} as Record<string, Bal>,
    lastPoll: '',
  }).current

  // Liveness. Polled at 10s rather than the old 1.5s: this is a health check,
  // not a counter feed, so there is nothing to animate between ticks.
  useEffect(() => {
    let alive = true
    async function poll(){
      await Promise.all(NODES.map(async n => { const l = await probeLiveness(n.base); if (alive) r.node[n.key] = l }))
      r.lastPoll = new Date().toLocaleTimeString()
      if (alive) render()
    }
    poll(); const id = setInterval(poll, 10000)
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
      await Promise.allSettled(NODE_KEYS.map(async key => {
        await Promise.allSettled(walletRows(key).map(async row => { r.bal[row.addr] = await readBal(row.chain, row.addr, row.ario) }))
        if (alive) render()
      }))
    }
    fetchBalances(); const id = setInterval(fetchBalances, 45000)
    return () => { alive = false; clearInterval(id) }
  }, [])

  let low = 0; for (const key of NODE_KEYS) for (const row of walletRows(key)){ const b = r.bal[row.addr]; if (b && !b.err && gasWarn(row.chain, b.native)) low++ }
  // "live" is now the page's own honesty check: at least one node answered a
  // probe at all. It is not a claim about traffic, because no traffic counter
  // is observable any more.
  const live = NODES.some(n => { const s = r.node[n.key]?.state; return s === 'up' || s === 'reachable' })
  return { node:r.node, packets:r.packets, relaysUp:r.relaysUp, bal:r.bal, low, live, lastPoll:r.lastPoll }
}
