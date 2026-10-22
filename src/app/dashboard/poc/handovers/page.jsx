'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth'
import { API } from '@/lib/api'
import {
  Car, ArrowDownToLine, ArrowUpFromLine, Fuel, Gauge,
  User, MapPin, X, ChevronLeft, ChevronRight, Search, Camera,
  Clock, AlertTriangle, ArrowLeftRight, CalendarDays, Filter,
} from 'lucide-react'

const FUEL_LABEL = { empty:'Empty', quarter:'1/4', half:'1/2', three_quarter:'3/4', full:'Full' }
const hdr = () => ({ Authorization:`Bearer ${localStorage.getItem('gcd_token')}` })

const STATUS_META = {
  pending_acceptance: { label:'Pending',    color:'#D97706', bg:'#FEF3C7', border:'#FDE68A' },
  accepted:           { label:'Accepted',   color:'#2563EB', bg:'#EFF6FF', border:'#BFDBFE' },
  completed:          { label:'Completed',  color:'#059669', bg:'#ECFDF5', border:'#A7F3D0' },
  poc_pending:        { label:'POC Review', color:'#7C3AED', bg:'#F5F3FF', border:'#DDD6FE' },
  rejected:           { label:'Rejected',   color:'#DC2626', bg:'#FEF2F2', border:'#FCA5A5' },
}

// ── Lightbox ──────────────────────────────────────────────────────
function Lightbox({ photos, startIdx, onClose }) {
  const [idx, setIdx] = useState(startIdx || 0)
  const list = photos.filter(Boolean)
  const prev = useCallback(() => setIdx(i => Math.max(0, i - 1)), [])
  const next = useCallback(() => setIdx(i => Math.min(list.length - 1, i + 1)), [list.length])
  useEffect(() => {
    const fn = e => {
      if (e.key === 'ArrowLeft')  prev()
      if (e.key === 'ArrowRight') next()
      if (e.key === 'Escape')     onClose()
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [prev, next, onClose])
  if (!list.length) return null
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.94)', zIndex:9999, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}
      onClick={onClose}>
      <button onClick={onClose}
        style={{ position:'absolute', top:16, right:16, background:'rgba(255,255,255,0.15)', border:'none', borderRadius:'50%', width:40, height:40, color:'white', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <X size={20}/>
      </button>
      <div style={{ position:'relative' }} onClick={e=>e.stopPropagation()}>
        <img src={list[idx]} alt={`Photo ${idx+1}`}
          style={{ maxWidth:'88vw', maxHeight:'78vh', objectFit:'contain', borderRadius:12, boxShadow:'0 8px 40px rgba(0,0,0,0.6)' }}/>
        {idx > 0 && (
          <button onClick={prev}
            style={{ position:'absolute', left:-50, top:'50%', transform:'translateY(-50%)', background:'rgba(255,255,255,0.15)', border:'none', borderRadius:'50%', width:38, height:38, color:'white', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <ChevronLeft size={20}/>
          </button>
        )}
        {idx < list.length - 1 && (
          <button onClick={next}
            style={{ position:'absolute', right:-50, top:'50%', transform:'translateY(-50%)', background:'rgba(255,255,255,0.15)', border:'none', borderRadius:'50%', width:38, height:38, color:'white', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <ChevronRight size={20}/>
          </button>
        )}
      </div>
      <div style={{ marginTop:20, display:'flex', alignItems:'center', gap:10 }} onClick={e=>e.stopPropagation()}>
        <span style={{ color:'rgba(255,255,255,0.6)', fontSize:13 }}>{idx+1} / {list.length}</span>
        <div style={{ display:'flex', gap:6 }}>
          {list.map((url, i) => (
            <div key={i} onClick={()=>setIdx(i)}
              style={{ width:46, height:46, borderRadius:7, overflow:'hidden', cursor:'pointer', border:`2px solid ${i===idx?'white':'transparent'}`, opacity:i===idx?1:0.5, transition:'all 0.15s' }}>
              <img src={url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Handover Card ─────────────────────────────────────────────────
function HandoverCard({ h, onPhoto }) {
  const isReceived  = h.type === 'received'
  const isRejected  = h.status === 'rejected'
  const isPending   = h.status === 'pending_acceptance'
  const isAccepted  = h.status === 'accepted'
  const photos      = [h.photo_1, h.photo_2, h.photo_3, h.photo_4].filter(Boolean)
  const sm          = STATUS_META[h.status] || STATUS_META.completed
  const accentColor = isRejected ? '#DC2626' : isPending ? '#D97706' : isAccepted ? '#3B82F6' : isReceived ? '#059669' : '#EF4444'

  const dateStr = new Date(h.submitted_at).toLocaleString('en-AE', {
    day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'
  })

  return (
    <div className="hv-card">
      {/* Left accent bar */}
      <div className="hv-card-accent" style={{ background: accentColor }}/>

      <div className="hv-card-body">
        {/* Top row: plate + badges + date */}
        <div className="hv-card-top">
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div className="hv-card-icon" style={{ background:`${accentColor}18`, border:`1.5px solid ${accentColor}30` }}>
              {isReceived
                ? <ArrowDownToLine size={16} color={accentColor}/>
                : <ArrowUpFromLine size={16} color={accentColor}/>}
            </div>
            <div>
              <div className="hv-plate">{h.vehicle_plate || h.plate || '—'}</div>
              {(h.make || h.model) && (
                <div className="hv-make">{[h.make, h.model].filter(Boolean).join(' ')}</div>
              )}
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, flexShrink:0 }}>
            <span className="hv-badge" style={{ background:sm.bg, color:sm.color, border:`1px solid ${sm.border}` }}>
              {sm.label}
            </span>
            <span className="hv-type-badge" style={{ color: isReceived?'#059669':'#EF4444', background: isReceived?'#ECFDF5':'#FEF2F2' }}>
              {isReceived ? '↓ IN' : '↑ OUT'}
            </span>
            <span className="hv-date">{dateStr}</span>
          </div>
        </div>

        {/* Detail chips */}
        <div className="hv-chips">
          {[
            { icon:<User size={10}/>,        label:'Driver',  value: h.emp_name || '—' },
            { icon:<MapPin size={10}/>,      label:'Station', value: h.station_code || h.vehicle_station || '—' },
            { icon:<Fuel size={10}/>,        label:'Fuel',    value: FUEL_LABEL[h.fuel_level] || h.fuel_level || '—' },
            { icon:<Gauge size={10}/>,       label:'ODO',     value: h.odometer ? `${Number(h.odometer).toLocaleString()} km` : '—' },
          ].map(c => (
            <div key={c.label} className="hv-chip">
              <div className="hv-chip-label">{c.icon} {c.label}</div>
              <div className="hv-chip-val">{c.value}</div>
            </div>
          ))}
        </div>

        {/* Receiver row */}
        {h.type === 'returned' && (h.receiver_name || h.receiver_emp_id) && (
          <div className="hv-receiver">
            <ArrowLeftRight size={11} color="var(--text-muted)"/>
            <span style={{ color:'var(--text-muted)', fontSize:11 }}>To:</span>
            <strong style={{ color:'var(--text)', fontSize:12 }}>{h.receiver_name || h.receiver_emp_id}</strong>
            {isPending && <span className="hv-receiver-badge" style={{ color:'#D97706', background:'#FEF3C7' }}>Awaiting acceptance</span>}
            {isAccepted && <span className="hv-receiver-badge" style={{ color:'#2563EB', background:'#EFF6FF' }}>Photos pending</span>}
          </div>
        )}

        {/* Ref / handover person */}
        {(h.handover_from || h.handover_to) && (
          <div style={{ fontSize:11.5, color:'var(--text-sub)' }}>
            <span style={{ color:'var(--text-muted)' }}>{isReceived ? 'From:' : 'Ref:'}</span>{' '}
            <strong style={{ color:'var(--text)' }}>{h.handover_from || h.handover_to}</strong>
          </div>
        )}

        {/* Rejection note */}
        {isRejected && h.condition_note && (
          <div className="hv-rejection-note">
            <AlertTriangle size={12}/> {h.condition_note}
          </div>
        )}

        {/* Condition note (non-rejected) */}
        {!isRejected && h.condition_note && (
          <div className="hv-note">{h.condition_note}</div>
        )}

        {/* Photos */}
        {isPending || isAccepted ? (
          <div className="hv-photos-pending">
            <Clock size={12}/> Photos available after {isAccepted ? 'completion' : 'acceptance'}
          </div>
        ) : photos.length === 0 ? (
          <div className="hv-photos-empty"><Camera size={12}/> No photos</div>
        ) : (
          <div style={{ display:'flex', gap:5, alignItems:'center', flexWrap:'wrap' }}>
            {photos.map((url, i) => (
              <div key={i} onClick={() => onPhoto(photos, i)} className="hv-thumb">
                <img src={url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} loading="lazy"/>
              </div>
            ))}
            <span style={{ fontSize:10.5, color:'var(--text-muted)', marginLeft:2 }}>
              {photos.length} photo{photos.length>1?'s':''}
              {h.photos_expire_at ? ` · expires ${new Date(h.photos_expire_at).toLocaleDateString('en-AE',{day:'numeric',month:'short'})}` : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────
export default function HandoversPage() {
  const { user }   = useAuth()
  const [handovers,    setHandovers]    = useState([])
  const [loading,      setLoading]      = useState(true)
  const [mainTab,      setMainTab]      = useState('active')   // 'active' | 'rejected'
  const [typeFilter,   setTypeFilter]   = useState('all')      // 'all' | 'received' | 'returned'
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFilter,   setDateFilter]   = useState('today')
  const [search,       setSearch]       = useState('')
  const [lightbox,     setLightbox]     = useState(null)

  useEffect(() => {
    fetch(`${API}/api/handovers`, { headers: hdr() })
      .then(r => r.json())
      .then(d => setHandovers(d.handovers || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const now = new Date()

  const applyDateFilter = (list) => {
    if (dateFilter === 'today') return list.filter(h => new Date(h.submitted_at).toDateString() === now.toDateString())
    if (dateFilter === 'week')  return list.filter(h => (now - new Date(h.submitted_at)) / 86400000 <= 7)
    return list
  }

  const applySearch = (list) => {
    if (!search) return list
    const q = search.toLowerCase()
    return list.filter(h =>
      (h.vehicle_plate||h.plate||'').toLowerCase().includes(q) ||
      (h.emp_name||'').toLowerCase().includes(q) ||
      (h.receiver_name||'').toLowerCase().includes(q) ||
      (h.station_code||'').toLowerCase().includes(q) ||
      (h.handover_from||'').toLowerCase().includes(q) ||
      (h.handover_to||'').toLowerCase().includes(q)
    )
  }

  // Separate rejected from active
  const activeAll   = handovers.filter(h => h.status !== 'rejected')
  const rejectedAll = handovers.filter(h => h.status === 'rejected')

  const activeFiltered = applySearch(applyDateFilter(
    activeAll.filter(h => {
      if (typeFilter !== 'all'   && h.type   !== typeFilter)   return false
      if (statusFilter !== 'all' && h.status !== statusFilter) return false
      return true
    })
  ))

  const rejectedFiltered = applySearch(applyDateFilter(rejectedAll))

  const displayed = mainTab === 'rejected' ? rejectedFiltered : activeFiltered

  const counts = {
    total:    activeAll.length,
    received: activeAll.filter(h => h.type === 'received').length,
    returned: activeAll.filter(h => h.type === 'returned').length,
    pending:  activeAll.filter(h => h.status === 'pending_acceptance').length,
    rejected: rejectedAll.length,
  }

  return (
    <>
      <style>{`
        /* ── Hero ── */
        .hv-hero {
          background: var(--hero-bg);
          border-radius: 20px;
          padding: 24px 24px 20px;
          position: relative;
          overflow: hidden;
          margin-bottom: 16px;
        }
        .hv-hero::before {
          content:'';
          position:absolute;
          top:-60px; right:-60px;
          width:220px; height:220px;
          border-radius:50%;
          background:rgba(59,130,246,0.08);
          pointer-events:none;
        }
        .hv-hero::after {
          content:'';
          position:absolute;
          bottom:-40px; left:40px;
          width:160px; height:160px;
          border-radius:50%;
          background:rgba(99,102,241,0.06);
          pointer-events:none;
        }
        .hv-hero-title { font-weight:900; font-size:22px; color:#fff; margin:0; letter-spacing:-0.02em; }
        .hv-hero-sub   { font-size:12px; color:rgba(255,255,255,0.45); margin-top:3px; }
        .hv-kpi-grid {
          display:grid;
          grid-template-columns:repeat(4,1fr);
          gap:10px;
          margin-top:18px;
        }
        .hv-kpi {
          background:rgba(255,255,255,0.07);
          border:1px solid rgba(255,255,255,0.1);
          border-radius:12px;
          padding:12px 10px;
          text-align:center;
        }
        .hv-kpi-val  { font-size:26px; font-weight:900; letter-spacing:-0.05em; line-height:1; }
        .hv-kpi-lbl  { font-size:10px; font-weight:600; color:rgba(255,255,255,0.5); margin-top:4px; text-transform:uppercase; letter-spacing:0.06em; }

        /* ── Main tabs ── */
        .hv-tabs {
          display:flex;
          background:var(--bg-alt);
          border:1px solid var(--border);
          border-radius:12px;
          padding:4px;
          gap:4px;
          margin-bottom:12px;
        }
        .hv-tab {
          flex:1;
          padding:9px 12px;
          border-radius:9px;
          border:none;
          font-family:inherit;
          font-size:13px;
          font-weight:600;
          cursor:pointer;
          transition:all 0.15s;
          display:flex;
          align-items:center;
          justify-content:center;
          gap:6px;
        }
        .hv-tab-count {
          font-size:10px;
          font-weight:800;
          padding:1px 6px;
          border-radius:10px;
          line-height:1.4;
        }

        /* ── Filter bar ── */
        .hv-filters { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:10px; }
        .hv-search-wrap { flex:1; min-width:160px; position:relative; }
        .hv-search-icon { position:absolute; left:10px; top:50%; transform:translateY(-50%); color:var(--text-muted); pointer-events:none; }
        .hv-search { width:100%; padding:9px 10px 9px 32px; border-radius:10px; border:1px solid var(--border); background:var(--card); color:var(--text); font-size:13px; font-family:inherit; box-sizing:border-box; outline:none; }
        .hv-seg { display:flex; background:var(--bg-alt); border:1px solid var(--border); border-radius:10px; padding:3px; gap:2px; }
        .hv-seg-btn { padding:7px 12px; border-radius:8px; border:none; font-family:inherit; font-size:12px; font-weight:500; cursor:pointer; transition:all 0.15s; white-space:nowrap; }
        .hv-seg-btn.active { background:var(--card); font-weight:700; box-shadow:0 1px 4px rgba(0,0,0,0.1); }

        /* ── Card ── */
        .hv-card {
          background:var(--card);
          border:1px solid var(--border);
          border-radius:16px;
          overflow:hidden;
          display:flex;
          transition:box-shadow 0.15s, transform 0.15s;
        }
        .hv-card:hover { box-shadow:0 4px 16px rgba(0,0,0,0.08); transform:translateY(-1px); }
        .hv-card-accent { width:4px; flex-shrink:0; }
        .hv-card-body   { flex:1; padding:14px 16px; display:flex; flex-direction:column; gap:10px; min-width:0; }
        .hv-card-top    { display:flex; justify-content:space-between; align-items:flex-start; gap:8px; }
        .hv-card-icon   { width:40px; height:40px; border-radius:11px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .hv-plate       { font-weight:900; font-size:17px; color:var(--text); letter-spacing:0.02em; }
        .hv-make        { font-size:11px; color:var(--text-muted); margin-top:1px; }
        .hv-badge       { font-size:11px; font-weight:700; padding:3px 10px; border-radius:20px; white-space:nowrap; }
        .hv-type-badge  { font-size:10px; font-weight:800; padding:2px 8px; border-radius:20px; white-space:nowrap; letter-spacing:0.04em; }
        .hv-date        { font-size:10.5px; color:var(--text-muted); }
        .hv-chips       { display:grid; grid-template-columns:repeat(4,1fr); gap:6px; }
        .hv-chip        { background:var(--bg-alt); border-radius:8px; padding:6px 8px; }
        .hv-chip-label  { font-size:9px; color:var(--text-muted); font-weight:700; display:flex; align-items:center; gap:2px; text-transform:uppercase; letter-spacing:0.04em; margin-bottom:2px; }
        .hv-chip-val    { font-size:12px; color:var(--text); font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .hv-receiver    { display:flex; align-items:center; gap:6px; background:var(--bg-alt); border-radius:8px; padding:7px 10px; flex-wrap:wrap; }
        .hv-receiver-badge { font-size:10px; font-weight:700; padding:2px 8px; border-radius:20px; margin-left:auto; }
        .hv-rejection-note { display:flex; align-items:center; gap:6px; background:#FEF2F2; border:1px solid #FCA5A5; border-radius:8px; padding:8px 10px; font-size:12px; color:#DC2626; font-weight:500; }
        .hv-note        { background:#FFFBEB; border:1px solid #FDE68A; border-radius:8px; padding:7px 10px; font-size:11.5px; color:#92400E; }
        .hv-photos-pending { display:flex; align-items:center; gap:6px; color:var(--text-muted); font-size:11.5px; }
        .hv-photos-empty   { display:flex; align-items:center; gap:6px; color:var(--text-muted); font-size:11.5px; opacity:0.6; }
        .hv-thumb {
          width:52px; height:52px; border-radius:8px; overflow:hidden; cursor:pointer;
          border:1.5px solid var(--border); flex-shrink:0;
          transition:transform 0.15s;
        }
        .hv-thumb:hover { transform:scale(1.05); }

        /* ── Skeleton ── */
        .hv-skel { background:var(--card); border:1px solid var(--border); border-radius:16px; height:160px; animation:pulse 1.5s ease infinite; }

        /* ── Mobile ── */
        @media (max-width:768px) {
          .hv-hero         { padding:18px 16px 16px; border-radius:16px; }
          .hv-hero-title   { font-size:18px; }
          .hv-kpi-grid     { grid-template-columns:repeat(2,1fr); gap:8px; margin-top:14px; }
          .hv-kpi-val      { font-size:22px; }
          .hv-chips        { grid-template-columns:repeat(2,1fr); }
          .hv-filters      { gap:6px; }
          .hv-seg-btn      { padding:7px 8px; font-size:11.5px; }
          .hv-card-top     { flex-wrap:wrap; }
          .hv-tab          { font-size:12px; padding:8px 10px; }
        }
        @media (max-width:480px) {
          .hv-plate        { font-size:15px; }
          .hv-card-body    { padding:12px; gap:8px; }
          .hv-chip-val     { font-size:11px; }
        }
      `}</style>

      {/* ── Hero ── */}
      <div className="hv-hero">
        <div style={{ position:'relative', zIndex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:2 }}>
            <div style={{ width:38, height:38, borderRadius:11, background:'rgba(255,255,255,0.12)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <ArrowLeftRight size={18} color="#93C5FD"/>
            </div>
            <div>
              <h1 className="hv-hero-title">Vehicle Handovers</h1>
              <div className="hv-hero-sub">
                {new Date().toLocaleDateString('en-AE',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
              </div>
            </div>
          </div>

          <div className="hv-kpi-grid">
            {[
              { label:'Total',    value:counts.total,    color:'#93C5FD' },
              { label:'Received', value:counts.received, color:'#6EE7B7' },
              { label:'Returned', value:counts.returned, color:'#FCA5A5' },
              { label:'Pending',  value:counts.pending,  color:'#FCD34D' },
            ].map(s => (
              <div key={s.label} className="hv-kpi">
                <div className="hv-kpi-val" style={{ color:s.color }}>{s.value}</div>
                <div className="hv-kpi-lbl">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main tabs: Active vs Rejected ── */}
      <div className="hv-tabs">
        <button className="hv-tab" onClick={() => setMainTab('active')}
          style={{ background: mainTab==='active' ? 'var(--card)' : 'transparent', color: mainTab==='active' ? 'var(--text)' : 'var(--text-muted)', boxShadow: mainTab==='active' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}>
          <ArrowLeftRight size={14}/> Handovers
          <span className="hv-tab-count" style={{ background: mainTab==='active'?'#6366F118':'var(--bg-alt)', color: mainTab==='active'?'#6366F1':'var(--text-muted)' }}>
            {counts.total}
          </span>
        </button>
        <button className="hv-tab" onClick={() => setMainTab('rejected')}
          style={{ background: mainTab==='rejected' ? '#FEF2F2' : 'transparent', color: mainTab==='rejected' ? '#DC2626' : 'var(--text-muted)', boxShadow: mainTab==='rejected' ? '0 1px 4px rgba(220,38,38,0.12)' : 'none' }}>
          <AlertTriangle size={14}/> Rejected
          {counts.rejected > 0 && (
            <span className="hv-tab-count" style={{ background:'#FEF2F2', color:'#DC2626' }}>{counts.rejected}</span>
          )}
        </button>
      </div>

      {/* ── Filters ── */}
      <div className="hv-filters">
        <div className="hv-search-wrap">
          <Search size={13} className="hv-search-icon"/>
          <input className="hv-search" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Plate, driver, station…"/>
        </div>
        <div className="hv-seg">
          {[['all','All time'],['today','Today'],['week','This week']].map(([v,l]) => (
            <button key={v} className={`hv-seg-btn${dateFilter===v?' active':''}`}
              onClick={() => setDateFilter(v)}
              style={{ color: dateFilter===v ? 'var(--text)' : 'var(--text-muted)' }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* ── Sub-filters (active tab only) ── */}
      {mainTab === 'active' && (
        <div className="hv-filters" style={{ marginBottom:14 }}>
          <div className="hv-seg">
            {[['all','All'],['received','↓ In'],['returned','↑ Out']].map(([v,l]) => (
              <button key={v} className={`hv-seg-btn${typeFilter===v?' active':''}`}
                onClick={() => setTypeFilter(v)}
                style={{ color: typeFilter===v ? 'var(--text)' : 'var(--text-muted)' }}>
                {l}
              </button>
            ))}
          </div>
          <div className="hv-seg">
            {[['all','All Status'],['pending_acceptance','Pending'],['accepted','Accepted'],['completed','Completed']].map(([v,l]) => (
              <button key={v} className={`hv-seg-btn${statusFilter===v?' active':''}`}
                onClick={() => setStatusFilter(v)}
                style={{ color: statusFilter===v ? (STATUS_META[v]?.color || 'var(--text)') : 'var(--text-muted)' }}>
                {l}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Count label ── */}
      {!loading && (
        <div style={{ fontSize:11.5, color:'var(--text-muted)', marginBottom:10, fontWeight:500 }}>
          {displayed.length} record{displayed.length !== 1 ? 's' : ''}
          {mainTab === 'rejected' ? ' rejected' : dateFilter==='today' ? ' today' : ''}
        </div>
      )}

      {/* ── List ── */}
      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {[1,2,3].map(i => <div key={i} className="hv-skel"/>)}
        </div>
      ) : displayed.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--text-muted)' }}>
          {mainTab === 'rejected'
            ? <><AlertTriangle size={40} style={{ margin:'0 auto 12px', display:'block', opacity:0.2, color:'#DC2626' }}/>
                <div style={{ fontWeight:700, fontSize:14 }}>No rejected handovers</div>
                <div style={{ fontSize:12, marginTop:4 }}>Rejected handovers will appear here</div></>
            : <><Car size={40} style={{ margin:'0 auto 12px', display:'block', opacity:0.2 }}/>
                <div style={{ fontWeight:700, fontSize:14 }}>No handovers found</div>
                <div style={{ fontSize:12, marginTop:4 }}>Try adjusting your filters</div></>
          }
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {displayed.map(h => (
            <HandoverCard key={h.id} h={h} onPhoto={(photos, i) => setLightbox({ photos, startIdx: i })}/>
          ))}
        </div>
      )}

      {lightbox && (
        <Lightbox photos={lightbox.photos} startIdx={lightbox.startIdx} onClose={() => setLightbox(null)}/>
      )}
    </>
  )
}
