'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  AlertCircle, RefreshCw, Search, ExternalLink, ChevronRight, ShieldCheck,
} from 'lucide-react'

import { docApi } from '@/lib/api'
import { DOC_TYPES } from '@/components/documents/DocModal'

const docMap = Object.fromEntries(DOC_TYPES.map(d => [d.v, d]))

// Same three severities the notification bell uses, plus a fourth tier for the
// 31-90 day horizon the bell never loads.
const SEV = {
  expired:  { c:'#C0392B', bg:'#FEF2F2', bc:'#FCA5A5', label:'Expired'  },
  critical: { c:'#D97706', bg:'#FFFBEB', bc:'#FDE68A', label:'Critical' },
  warning:  { c:'#1D6FA4', bg:'#EFF6FF', bc:'#BFDBFE', label:'Expiring' },
  soon:     { c:'#047857', bg:'#F0FDF4', bc:'#A7F3D0', label:'Upcoming' },
}

// Cumulative windows — "≤60d" includes everything already expired and ≤30d.
const WINDOWS = [
  { v:'all',     l:'All',        emoji:'',   match:()=>true },
  { v:'expired', l:'Expired',    emoji:'🔴', match:i=>i.days < 0 },
  { v:'30',      l:'≤ 30 days',  emoji:'🟠', match:i=>i.days <= 30 },
  { v:'60',      l:'≤ 60 days',  emoji:'🟡', match:i=>i.days <= 60 },
  { v:'90',      l:'≤ 90 days',  emoji:'🔵', match:i=>i.days <= 90 },
]

const WHO = [
  { v:'all',     l:'Everyone' },
  { v:'drivers', l:'Drivers'  },
  { v:'staff',   l:'Staff'    },
]

function initials(name) {
  return (name||'?').trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase()
}

function Pill({ active, onClick, children, count, color }) {
  return (
    <button onClick={onClick} style={{
      display:'flex', alignItems:'center', gap:6,
      padding:'7px 14px', borderRadius:20, cursor:'pointer',
      border:`1px solid ${active ? (color||'#B8860B') : 'var(--border)'}`,
      background: active ? (color||'#B8860B') : 'var(--card)',
      color: active ? '#fff' : 'var(--text-sub)',
      fontSize:12, fontWeight:700, fontFamily:'Poppins,sans-serif',
      whiteSpace:'nowrap', transition:'all 0.15s',
    }}>
      {children}
      {count !== undefined && (
        <span style={{
          background: active ? 'rgba(255,255,255,0.25)' : 'var(--bg-alt)',
          color: active ? '#fff' : 'var(--text-muted)',
          borderRadius:20, padding:'1px 7px', fontSize:10, fontWeight:800,
        }}>{count}</span>
      )}
    </button>
  )
}

function ExpiryRow({ item }) {
  const sev  = SEV[item.severity] || SEV.warning
  const doc  = docMap[item.doc_type] || docMap.other
  const abs  = Math.abs(item.days)
  const file = item.signed_url || item.drive_link

  return (
    <div style={{
      display:'flex', background:'var(--card)', border:`1px solid ${item.days <= 30 ? sev.bc : 'var(--border)'}`,
      borderRadius:14, overflow:'hidden', boxShadow:'var(--shadow)', transition:'box-shadow 0.15s',
    }}
      onMouseEnter={e=>e.currentTarget.style.boxShadow='var(--shadow-md)'}
      onMouseLeave={e=>e.currentTarget.style.boxShadow='var(--shadow)'}>

      <div style={{ width:5, background:sev.c, flexShrink:0 }}/>

      <div style={{ flex:1, minWidth:0, display:'flex', alignItems:'center', gap:14, padding:'14px 16px', flexWrap:'wrap' }}>

        <div style={{
          width:44, height:44, borderRadius:13, flexShrink:0,
          background:doc.bg, border:`1.5px solid ${doc.c}33`,
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:15, fontWeight:800, color:doc.c,
        }}>
          {initials(item.emp_name)}
        </div>

        <div style={{ flex:1, minWidth:180 }}>
          <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap', marginBottom:4 }}>
            <span style={{
              fontSize:10, fontWeight:800, color:doc.c, background:doc.bg,
              border:`1px solid ${doc.c}33`, borderRadius:6, padding:'1px 8px',
              textTransform:'uppercase', letterSpacing:'0.06em',
            }}>{doc.e} {doc.l}</span>
            {item.source === 'file' && (
              <span style={{ fontSize:9.5, fontWeight:700, color:'var(--text-muted)', background:'var(--bg-alt)', border:'1px solid var(--border)', borderRadius:6, padding:'1px 7px' }}>
                From upload
              </span>
            )}
          </div>
          <div style={{ fontWeight:800, fontSize:14.5, color:'var(--text)', marginBottom:4 }}>{item.emp_name}</div>
          <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
            <span style={{ fontSize:10.5, color:'var(--text-sub)', background:'var(--bg-alt)', border:'1px solid var(--border)', borderRadius:6, padding:'2px 9px', textTransform:'capitalize' }}>
              {(item.role||'').replace(/_/g,' ')}
            </span>
            {item.station_code && (
              <span style={{ fontSize:10.5, fontWeight:700, color:'#B8860B', background:'#FDF6E3', border:'1px solid #E8D9A8', borderRadius:6, padding:'2px 9px' }}>
                {item.station_code}
              </span>
            )}
            <span style={{ fontSize:10.5, color:'var(--text-muted)', background:'var(--bg-alt)', border:'1px solid var(--border)', borderRadius:6, padding:'2px 9px' }}>
              Expires {item.expires_at}
            </span>
          </div>
        </div>

        <div style={{ textAlign:'right', flexShrink:0, minWidth:82 }}>
          <span style={{
            fontSize:10.5, fontWeight:800, color:sev.c, background:sev.bg,
            border:`1px solid ${sev.bc}`, borderRadius:20, padding:'2px 10px', display:'block',
          }}>{sev.label}</span>
          <span style={{ fontSize:11, color:sev.c, fontWeight:700, marginTop:4, display:'block' }}>
            {item.days < 0 ? `${abs}d ago` : `${abs}d left`}
          </span>
        </div>

        <div style={{ display:'flex', gap:7, flexShrink:0, flexWrap:'wrap' }}>
          {file && (
            <a href={file} target="_blank" rel="noreferrer" style={{
              display:'flex', alignItems:'center', gap:5, padding:'7px 13px', borderRadius:9,
              background:'#EFF6FF', border:'1px solid #BFDBFE', color:'#1D4ED8',
              fontSize:12, fontWeight:700, textDecoration:'none', whiteSpace:'nowrap',
            }}>
              <ExternalLink size={12}/> View file
            </a>
          )}
          <a href={`/dashboard/hr/employees/${item.emp_id}`} style={{
            display:'flex', alignItems:'center', gap:4, padding:'7px 13px', borderRadius:9,
            background:'var(--bg-alt)', border:'1px solid var(--border)', color:'var(--text-sub)',
            fontSize:12, fontWeight:700, textDecoration:'none', whiteSpace:'nowrap',
          }}>
            Open employee <ChevronRight size={12}/>
          </a>
        </div>
      </div>
    </div>
  )
}

export default function DocumentExpiryPage() {
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [err,     setErr]     = useState(null)
  const [q,       setQ]       = useState('')
  const [win,     setWin]     = useState('all')
  const [who,     setWho]     = useState('all')

  const load = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      const d = await docApi.expiryOverview(90)
      setItems(d.items || [])
    } catch (e) { setErr(e.message) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // The who-filter narrows first so the window pill counts reflect the
  // audience currently on screen, not the whole dataset.
  const scoped = useMemo(() => items.filter(i =>
    who === 'all' ? true : who === 'drivers' ? i.role === 'driver' : i.role !== 'driver'
  ), [items, who])

  const visible = useMemo(() => {
    const w    = WINDOWS.find(x => x.v === win) || WINDOWS[0]
    const term = q.trim().toLowerCase()
    return scoped.filter(i => {
      if (!w.match(i)) return false
      if (!term) return true
      return [i.emp_name, i.station_code, i.label, docMap[i.doc_type]?.l]
        .some(v => (v||'').toLowerCase().includes(term))
    })
  }, [scoped, win, q])

  // Derived from `scoped`, not the server summary, so the cards agree with the
  // pill counts below them when the Drivers/Staff toggle is narrowing the list.
  const s = useMemo(() => {
    const acc = { total: scoped.length, expired:0, critical:0, warning:0, soon:0 }
    for (const i of scoped) if (acc[i.severity] !== undefined) acc[i.severity]++
    return acc
  }, [scoped])

  const expiredNames = [...new Set(scoped.filter(i => i.days < 0).map(i => i.emp_name))]

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* ── Header ── */}
      <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:18, overflow:'hidden', boxShadow:'var(--shadow)' }}>
        <div style={{ height:4, background:'linear-gradient(90deg,#B8934A,#E8C97A,#B8934A)' }}/>
        <div className="page-header" style={{ padding:'18px 22px', margin:0 }}>
          <div>
            <h1 style={{ fontWeight:900, fontSize:22, color:'var(--text)', margin:0, letterSpacing:'-0.03em' }}>Document Expiry</h1>
            <p style={{ fontSize:12.5, color:'var(--text-muted)', marginTop:2 }}>Employee visa, license, ILOE &amp; uploaded document renewals — next 90 days</p>
          </div>
          <div className="page-header-actions">
            <button onClick={load} title="Refresh" style={{ width:36, height:36, borderRadius:'50%', background:'var(--bg-alt)', border:'1px solid var(--border)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <RefreshCw size={14} color="var(--text-muted)" style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}/>
            </button>
          </div>
        </div>
      </div>

      {err && (
        <div style={{ background:'var(--red-bg)', border:'1px solid var(--red-border)', borderRadius:12, padding:'11px 16px', display:'flex', alignItems:'center', gap:10, fontSize:13, color:'var(--red)' }}>
          <AlertCircle size={15}/> {err}
        </div>
      )}

      {/* ── Stats ── */}
      <div className="r-grid-4">
        {[
          { l:'Expired',            v:s.expired,  c:'#DC2626', bg:'#FEF2F2', bc:'#FECACA' },
          { l:'Critical (≤ 7 days)',v:s.critical, c:'#D97706', bg:'#FFFBEB', bc:'#FDE68A' },
          { l:'Expiring ≤ 30 days', v:s.warning,  c:'#1D6FA4', bg:'#EFF6FF', bc:'#BFDBFE' },
          { l:'Upcoming ≤ 90 days', v:s.soon,     c:'#047857', bg:'#F0FDF4', bc:'#A7F3D0' },
        ].map(c=>(
          <div key={c.l} style={{ background:c.bg, border:`1px solid ${c.bc}`, borderRadius:16, padding:'18px 16px', textAlign:'center', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ fontWeight:900, fontSize:30, color:c.c, letterSpacing:'-0.04em', lineHeight:1 }}>{c.v}</div>
            <div style={{ fontSize:11, color:c.c, fontWeight:600, marginTop:7, opacity:0.8 }}>{c.l}</div>
          </div>
        ))}
      </div>

      {/* ── Expired banner ── */}
      {expiredNames.length > 0 && (
        <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:12, padding:'11px 16px', display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
          <AlertCircle size={15} color="#DC2626"/>
          <span style={{ fontSize:13, fontWeight:700, color:'#DC2626' }}>
            {expiredNames.length} employee{expiredNames.length>1?'s have':' has'} expired document{expiredNames.length>1?'s':''}:
          </span>
          <span style={{ fontSize:12.5, color:'#7F1D1D' }}>{expiredNames.join(' · ')}</span>
        </div>
      )}

      {/* ── Controls ── */}
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
          <div style={{ position:'relative', flex:1, minWidth:220, maxWidth:340 }}>
            <Search size={14} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', pointerEvents:'none' }}/>
            <input className="input" style={{ paddingLeft:34 }} value={q} onChange={e=>setQ(e.target.value)}
              placeholder="Search name, station or document…"/>
          </div>
          <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
            {WHO.map(o => (
              <Pill key={o.v} active={who===o.v} onClick={()=>setWho(o.v)}
                count={o.v==='all' ? items.length : items.filter(i => o.v==='drivers' ? i.role==='driver' : i.role!=='driver').length}>
                {o.l}
              </Pill>
            ))}
          </div>
        </div>

        <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
          {WINDOWS.map(w => (
            <Pill key={w.v} active={win===w.v} onClick={()=>setWin(w.v)}
              count={scoped.filter(w.match).length}
              color={w.v==='expired' ? '#DC2626' : undefined}>
              {w.emoji && <span>{w.emoji}</span>}{w.l}
            </Pill>
          ))}
        </div>
      </div>

      {/* ── List ── */}
      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {[1,2,3,4].map(i => <div key={i} className="sk" style={{ height:86, borderRadius:14 }}/>)}
        </div>
      ) : visible.length === 0 ? (
        <div style={{ textAlign:'center', padding:'80px 20px' }}>
          <div style={{ width:64, height:64, borderRadius:18, background:'linear-gradient(135deg,#F0FDF4,#DCFCE7)', border:'1px solid #A7F3D0', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
            <ShieldCheck size={28} color="#047857"/>
          </div>
          <div style={{ fontWeight:800, fontSize:16, color:'var(--text-sub)' }}>
            {items.length === 0 ? 'All clear' : 'Nothing matches this filter'}
          </div>
          <div style={{ fontSize:12.5, color:'var(--text-muted)', marginTop:4 }}>
            {items.length === 0
              ? 'No documents expiring in the next 90 days'
              : 'Try a wider window or clear the search'}
          </div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {visible.map(item => (
            <ExpiryRow key={`${item.emp_id}:${item.doc_type}`} item={item}/>
          ))}
        </div>
      )}
    </div>
  )
}
