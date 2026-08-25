'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  AlertCircle, RefreshCw, ExternalLink, ChevronRight, ShieldCheck, ArrowUp, ArrowDown,
} from 'lucide-react'

import { docApi } from '@/lib/api'
import { DOC_TYPES } from '@/components/documents/DocModal'

const docMap  = Object.fromEntries(DOC_TYPES.map(d => [d.v, d]))
// Groups render in this fixed identity-document order (matches DOC_TYPES),
// not alphabetically or by whichever type happened to load first.
const DOC_ORDER = DOC_TYPES.map(d => d.v)

// Same three severities the notification bell uses, plus a fourth tier for the
// 31-90 day horizon the bell never loads.
const SEV = {
  expired:  { c:'#C0392B', bg:'#FEF2F2', bc:'#FCA5A5', label:'Expired'  },
  critical: { c:'#D97706', bg:'#FFFBEB', bc:'#FDE68A', label:'Critical' },
  warning:  { c:'#1D6FA4', bg:'#EFF6FF', bc:'#BFDBFE', label:'Expiring' },
  soon:     { c:'#047857', bg:'#F0FDF4', bc:'#A7F3D0', label:'Upcoming' },
}

const SORT_OPTIONS = [
  { v:'expiry', l:'Sort: Expiry Date'    },
  { v:'name',   l:'Sort: Employee Name'  },
]
// Ascending direction per field: soonest-expiring first for dates, A→Z for names.
function sortComparator(sortBy) {
  return sortBy === 'name'
    ? (a, b) => (a.emp_name || '').localeCompare(b.emp_name || '')
    : (a, b) => a.days - b.days
}

// employees.role is stored capitalized ('Driver'/'Admin'/'Manager'/'POC') —
// compare case-insensitively rather than assuming exact casing.
function isDA(role) { return (role || '').toLowerCase() === 'driver' }
// "DA" reads better than "Driver" for this org's terminology; other roles
// (Admin/Manager/POC) already display fine as-is.
function roleLabel(role) { return isDA(role) ? 'DA' : (role || '') }

function initials(name) {
  return (name||'?').trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase()
}

// Section header for a document-type group — the list is organized primarily
// by document type (not a flat urgency feed), so each group needs a clear,
// scannable label before its rows.
function GroupHeader({ doc, items }) {
  const expiredCount = items.filter(i => i.days < 0).length
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'2px 2px 2px' }}>
      <div style={{
        width:32, height:32, borderRadius:10, flexShrink:0,
        background:doc.bg, border:`1.5px solid ${doc.c}40`,
        display:'flex', alignItems:'center', justifyContent:'center', fontSize:15,
      }}>
        {doc.e}
      </div>
      <span style={{ fontWeight:800, fontSize:14.5, color:doc.c, letterSpacing:'-0.01em' }}>{doc.l}</span>
      <span style={{
        fontSize:10.5, fontWeight:800, color:'var(--text-muted)', background:'var(--bg-alt)',
        border:'1px solid var(--border)', borderRadius:20, padding:'2px 9px',
      }}>{items.length}</span>
      {expiredCount > 0 && (
        <span style={{
          fontSize:10.5, fontWeight:800, color:'#C0392B', background:'#FEF2F2',
          border:'1px solid #FCA5A5', borderRadius:20, padding:'2px 9px',
        }}>{expiredCount} expired</span>
      )}
      <div style={{ flex:1, height:1, background:'var(--border)' }}/>
    </div>
  )
}

function ExpiryRow({ item }) {
  const sev    = SEV[item.severity] || SEV.warning
  const doc    = docMap[item.doc_type] || docMap.other
  const abs    = Math.abs(item.days)
  const file   = item.signed_url || item.drive_link
  const urgent = item.days <= 30

  return (
    <div style={{
      display:'flex', alignItems:'center', gap:14, flexWrap:'wrap',
      background:'var(--card)',
      border:`1px solid ${urgent ? sev.bc : 'var(--border)'}`,
      borderLeft:`4px solid ${sev.c}`,
      borderRadius:16, padding:'14px 18px 14px 16px',
      boxShadow:'var(--shadow)', transition:'box-shadow 0.18s, transform 0.18s',
    }}
      onMouseEnter={e=>{ e.currentTarget.style.boxShadow='var(--shadow-md)'; e.currentTarget.style.transform='translateY(-1px)' }}
      onMouseLeave={e=>{ e.currentTarget.style.boxShadow='var(--shadow)'; e.currentTarget.style.transform='translateY(0)' }}>

      <div style={{
        width:42, height:42, borderRadius:13, flexShrink:0, position:'relative',
        background:doc.bg, border:`1.5px solid ${doc.c}33`,
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:14.5, fontWeight:800, color:doc.c,
      }}>
        {initials(item.emp_name)}
        <span style={{
          position:'absolute', bottom:-4, right:-4, width:18, height:18, borderRadius:'50%',
          background:'var(--card)', border:'1.5px solid var(--card)',
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:10,
        }}>{doc.e}</span>
      </div>

      <div style={{ flex:1, minWidth:170 }}>
        <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap' }}>
          <span style={{ fontWeight:800, fontSize:14.5, color:'var(--text)' }}>{item.emp_name}</span>
          {item.source === 'file' && (
            <span style={{ fontSize:9.5, fontWeight:700, color:'var(--text-muted)', background:'var(--bg-alt)', border:'1px solid var(--border)', borderRadius:6, padding:'1px 7px' }}>
              From upload
            </span>
          )}
        </div>
        <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginTop:5 }}>
          <span style={{ fontSize:10.5, color:'var(--text-sub)', background:'var(--bg-alt)', border:'1px solid var(--border)', borderRadius:6, padding:'2px 9px' }}>
            {roleLabel(item.role)}
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
            display:'flex', alignItems:'center', gap:5, padding:'7px 13px', borderRadius:10,
            background:'#EFF6FF', border:'1px solid #BFDBFE', color:'#1D4ED8',
            fontSize:12, fontWeight:700, textDecoration:'none', whiteSpace:'nowrap',
          }}>
            <ExternalLink size={12}/> View file
          </a>
        )}
        <a href={`/dashboard/hr/employees/${item.emp_id}`} style={{
          display:'flex', alignItems:'center', gap:4, padding:'7px 13px', borderRadius:10,
          background:'var(--bg-alt)', border:'1px solid var(--border)', color:'var(--text-sub)',
          fontSize:12, fontWeight:700, textDecoration:'none', whiteSpace:'nowrap',
        }}>
          Open employee <ChevronRight size={12}/>
        </a>
      </div>
    </div>
  )
}

export default function DocumentExpiryPage() {
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [err,     setErr]     = useState(null)
  const [sortBy,  setSortBy]  = useState('expiry')
  const [sortDir, setSortDir] = useState('asc')

  const load = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      const d = await docApi.expiryOverview(90)
      setItems(d.items || [])
    } catch (e) { setErr(e.message) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // Primary sort is by document type (grouped, in identity-document order);
  // each group is then sorted by the chosen field/direction.
  const grouped = useMemo(() => {
    const byType = new Map()
    for (const item of items) {
      if (!byType.has(item.doc_type)) byType.set(item.doc_type, [])
      byType.get(item.doc_type).push(item)
    }
    const cmp = sortComparator(sortBy)
    for (const list of byType.values()) {
      list.sort((a, b) => sortDir === 'asc' ? cmp(a, b) : -cmp(a, b))
    }
    return DOC_ORDER
      .filter(t => byType.has(t))
      .map(t => ({ type: t, doc: docMap[t] || docMap.other, items: byType.get(t) }))
  }, [items, sortBy, sortDir])

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* ── Header ── */}
      <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:18, overflow:'hidden', boxShadow:'var(--shadow)' }}>
        <div style={{ height:4, background:'linear-gradient(90deg,#B8934A,#E8C97A,#B8934A)' }}/>
        <div className="page-header" style={{ padding:'18px 22px', margin:0 }}>
          <div>
            <h1 style={{ fontWeight:900, fontSize:22, color:'var(--text)', margin:0, letterSpacing:'-0.03em' }}>Document Expiry</h1>
            <p style={{ fontSize:12.5, color:'var(--text-muted)', marginTop:2 }}>Employee visa, license, ILOE &amp; uploaded document renewals — grouped by document type, next 90 days</p>
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

      {/* ── Sort ── */}
      {items.length > 0 && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:8 }}>
          <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{
            padding:'8px 14px', borderRadius:20, border:'1.5px solid var(--border)',
            background:'var(--card)', color:'var(--text)', fontSize:12.5, fontWeight:700,
            fontFamily:'inherit', cursor:'pointer', outline:'none',
          }}>
            {SORT_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
          <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
            title={sortDir === 'asc' ? 'Ascending — click to reverse' : 'Descending — click to reverse'}
            style={{ width:34, height:34, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:'50%', border:'1.5px solid var(--border)', background:'var(--card)', color:'var(--text)', cursor:'pointer' }}>
            {sortDir === 'asc' ? <ArrowUp size={13}/> : <ArrowDown size={13}/>}
          </button>
        </div>
      )}

      {/* ── List, grouped by document type ── */}
      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {[1,2,3,4].map(i => <div key={i} className="sk" style={{ height:86, borderRadius:16 }}/>)}
        </div>
      ) : items.length === 0 ? (
        <div style={{ textAlign:'center', padding:'80px 20px', background:'var(--card)', border:'1px solid var(--border)', borderRadius:16 }}>
          <div style={{ width:64, height:64, borderRadius:18, background:'linear-gradient(135deg,#F0FDF4,#DCFCE7)', border:'1px solid #A7F3D0', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
            <ShieldCheck size={28} color="#047857"/>
          </div>
          <div style={{ fontWeight:800, fontSize:16, color:'var(--text-sub)' }}>All clear</div>
          <div style={{ fontSize:12.5, color:'var(--text-muted)', marginTop:4 }}>No documents expiring in the next 90 days</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:22 }}>
          {grouped.map(g => (
            <div key={g.type} style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <GroupHeader doc={g.doc} items={g.items}/>
              {g.items.map(item => (
                <ExpiryRow key={`${item.emp_id}:${item.doc_type}`} item={item}/>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
