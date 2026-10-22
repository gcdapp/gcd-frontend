'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth'
import { API } from '@/lib/api'
import { useStation, hdr, VehicleCard, VehicleModal, VSTATUS_COLORS } from '../_components/poc-shared'
import ConfirmDialog from '@/components/ConfirmDialog'
import Link from 'next/link'
import { Truck, Plus, ArrowLeftRight, Check, X, ChevronLeft, Search, MapPin } from 'lucide-react'

const TODAY = () => new Date().toISOString().slice(0, 10)

const FUEL_LABEL = { empty:'Empty', quarter:'¼ Tank', half:'½ Tank', three_quarter:'¾ Tank', full:'Full' }

// Normalise plate for matching — strip spaces, dashes, dots; uppercase
const normPlate = s => String(s || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase()

const CSS = `
  .fl-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(268px,1fr)); gap:14px; }
  .fl-tab { display:flex; align-items:center; justify-content:center; gap:6px; flex:1 0 auto; padding:8px 12px; border-radius:11px; border:none; cursor:pointer; font-weight:500; font-size:12.5px; font-family:inherit; transition:all 0.18s; white-space:nowrap; }
  .fl-tab.active { font-weight:700; background:var(--card); box-shadow:0 1px 6px rgba(0,0,0,0.10); }
  .fl-tab-count { font-size:10px; font-weight:700; padding:1px 6px; border-radius:20px; }
  .fl-skel { background:var(--card); border-radius:16px; animation:fl-pulse 1.4s ease infinite; }
  @keyframes fl-pulse { 0%,100%{opacity:.45} 50%{opacity:.85} }
  @media(max-width:640px){
    .fl-grid { grid-template-columns:1fr !important; }
    .fl-tab  { font-size:11px; padding:7px 8px; }
    .fl-hero-kpi { grid-template-columns:1fr 1fr !important; }
    .fl-hero-top { flex-wrap:wrap; gap:10px; }
    .fl-station-row { flex-wrap:wrap; }
  }
  @media(max-width:900px) and (min-width:641px){
    .fl-grid { grid-template-columns:repeat(2,1fr) !important; }
  }
`

export default function FleetPage() {
  const { user } = useAuth()
  const { station, setStation, canSwitch } = useStation(user)
  const [date,         setDate]         = useState(TODAY())
  const [vehs,         setVehs]         = useState([])
  const [asgns,        setAsgns]        = useState([])
  const [emps,         setEmps]         = useState([])
  const [currentHVs,   setCurrentHVs]   = useState([])
  const [pendingVers,  setPendingVers]  = useState([])
  const [loading,      setLoading]      = useState(true)
  const [enriching,    setEnriching]    = useState(true)
  const [modal,        setModal]        = useState(null)
  const [confirmDlg,   setConfirmDlg]   = useState(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [search,       setSearch]       = useState('')
  const [verifying,    setVerifying]    = useState(null)

  // Phase 3 — Etisalat live tracking, keyed by normalised plate
  // null = not yet fetched (invisible), {} = fetched (may be empty)
  const [tracking, setTracking] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setEnriching(true)
    setAsgns([]); setEmps([]); setCurrentHVs([]); setPendingVers([])
    const h = { headers: { Authorization: `Bearer ${localStorage.getItem('gcd_token')}` } }

    // ── Phase 1: vehicles only (fast, no carry-forward) ──
    try {
      const v = await fetch(`${API}/api/vehicles`, h).then(r => r.json())
      setVehs(v.vehicles || [])
    } catch(e) { console.error(e) }
    setLoading(false)

    // ── Phase 2: enrichment in background ──
    try {
      const [a, e, hv, pv] = await Promise.all([
        fetch(`${API}/api/vehicles/assignments?date=${date}`, h).then(r => r.json()),
        fetch(`${API}/api/employees/for-handover`, h).then(r => r.json()),
        fetch(`${API}/api/handovers/current`, h).then(r => r.ok ? r.json() : { current:[] }),
        fetch(`${API}/api/handovers?status=poc_pending&limit=50`, h).then(r => r.ok ? r.json() : { handovers:[] }),
      ])
      setAsgns(a.assignments || [])
      setEmps(e.employees || [])
      setCurrentHVs(hv.current || [])
      setPendingVers((pv.handovers || []).filter(h => h.status === 'poc_pending' && h.type === 'returned'))
    } catch(e) { console.error(e) }
    setEnriching(false)
  }, [date])

  useEffect(() => { load() }, [load])

  // ── Phase 3: Etisalat live tracking ──────────────────────────────
  // Step 1 — try /etisalat-fleet.json (static Vercel CDN, < 100 ms, no auth).
  //           Populated by running: node backend/scripts/fetch-etisalat-fleet.js
  // Step 2 — if static file is empty/stale, fallback to /api/etisalat/fleet.
  // Never blocks Phase 1 or Phase 2.
  useEffect(() => {
    const ctrl = new AbortController()
    ;(async () => {
      try {
        // ── Fast path: static CDN file ────────────────────────────
        const staticRes = await fetch('/etisalat-fleet.json', { signal: ctrl.signal })
        if (staticRes.ok) {
          const d = await staticRes.json()
          if (d.ok && Array.isArray(d.vehicles) && d.vehicles.length > 0) {
            const map = {}
            for (const veh of d.vehicles) {
              if (veh.plate)   map[normPlate(veh.plate)]   = veh
              if (veh.tw_name) map[normPlate(veh.tw_name)] = map[normPlate(veh.tw_name)] || veh
            }
            setTracking(map)
            return  // done — no API call needed
          }
        }
      } catch (e) {
        if (e.name === 'AbortError') return
      }

      // ── Slow path: backend API (Railway → ThingWorx) ─────────
      try {
        const token = localStorage.getItem('gcd_token')
        const res   = await fetch(`${API}/api/etisalat/fleet`, {
          headers: { Authorization: `Bearer ${token}` },
          signal:  ctrl.signal,
        })
        if (res.ok) {
          const d   = await res.json()
          const map = {}
          for (const veh of (d.vehicles || [])) {
            if (veh.plate)   map[normPlate(veh.plate)]   = veh
            if (veh.tw_name) map[normPlate(veh.tw_name)] = map[normPlate(veh.tw_name)] || veh
          }
          setTracking(map)
        } else {
          setTracking({})
        }
      } catch (e) {
        if (e.name !== 'AbortError') console.error('[etisalat-fleet]', e)
        setTracking({})
      }
    })()
    return () => ctrl.abort()
  }, [])  // once per mount

  async function assignVehicle(vId, eId) {
    try {
      const res = await fetch(`${API}/api/vehicles/assignments`, {
        method:'POST', headers:hdr(),
        body:JSON.stringify({ vehicle_id:vId, emp_id:eId||null, date, station_code:station })
      })
      if (!res.ok) { alert((await res.json()).error||'Failed'); return }
      load()
    } catch { alert('Failed to assign vehicle') }
  }

  async function pocVerify(id, action) {
    setVerifying(id)
    try {
      const res = await fetch(`${API}/api/handovers/${id}/poc-verify`, {
        method:'PATCH', headers:{ ...hdr(), 'Content-Type':'application/json' },
        body:JSON.stringify({ action })
      })
      if (!res.ok) { alert((await res.json()).error || 'Failed'); return }
      load()
    } catch { alert('Failed to verify handover') } finally { setVerifying(null) }
  }

  const active   = vehs.filter(v => v.status === 'active').length
  const grounded = vehs.filter(v => v.status !== 'active').length
  const inUse    = currentHVs.length

  // Count how many vehicles have live GPS from Etisalat
  const liveCount = tracking
    ? vehs.filter(v => tracking[normPlate(v.plate)]).length
    : 0

  const displayVehs = vehs.filter(v => {
    if (filterStatus === 'active') { if (v.status !== 'active') return false }
    else if (filterStatus === 'down')  { if (v.status === 'active') return false }
    else if (filterStatus === 'inuse') { if (!currentHVs.some(h => String(h.vehicle_id)===String(v.id))) return false }
    if (search) {
      const q = search.toLowerCase()
      const a = asgns.find(a => String(a.vehicle_id)===String(v.id))
      if (
        !v.plate?.toLowerCase().includes(q) &&
        !v.make?.toLowerCase().includes(q) &&
        !v.model?.toLowerCase().includes(q) &&
        !a?.driver_name?.toLowerCase().includes(q)
      ) return false
    }
    return true
  })

  const TABS = [
    { id:'all',    label:'All',    count:vehs.length,       activeColor:'#8F6807', activeBg:'#8F680718' },
    { id:'active', label:'Active', count:active,            activeColor:'#2E7D52', activeBg:'#2E7D5218' },
    { id:'down',   label:'Down',   count:grounded,          activeColor:'#C0392B', activeBg:'#C0392B18' },
    { id:'inuse',  label:'In Use', count:inUse,             activeColor:'#6366F1', activeBg:'#6366F118' },
  ]

  return (
    <>
      <style>{CSS}</style>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

        {/* ── Hero ── */}
        <div style={{ background:'linear-gradient(135deg,#0f1623 0%,#1a2535 50%,#1e3a5f 100%)', borderRadius:16, padding:24 }}>

          {/* Back */}
          <Link href="/dashboard/poc"
            style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11.5, color:'rgba(255,255,255,0.45)', marginBottom:16, textDecoration:'none', fontWeight:600, transition:'color 0.15s' }}
            onMouseEnter={e=>e.currentTarget.style.color='rgba(255,255,255,0.8)'}
            onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.45)'}>
            <ChevronLeft size={13}/> POC Station
          </Link>

          {/* Title row */}
          <div className="fl-hero-top" style={{ display:'flex', alignItems:'center', gap:14, marginBottom:20 }}>
            <div style={{ width:46, height:46, borderRadius:14, background:'rgba(59,130,246,0.15)', border:'1.5px solid rgba(59,130,246,0.35)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Truck size={22} color="#60A5FA"/>
            </div>
            <div>
              <div style={{ fontWeight:900, fontSize:20, color:'white', letterSpacing:'-0.02em', lineHeight:1.1 }}>Fleet</div>
              <div style={{ fontSize:12, color:'rgba(255,255,255,0.5)', marginTop:3 }}>Vehicle status, assignments &amp; handover history</div>
            </div>
            <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
              {/* Station pills */}
              {canSwitch && (
                <div className="fl-station-row" style={{ display:'flex', gap:6, alignItems:'center' }}>
                  <MapPin size={12} color="rgba(255,255,255,0.4)"/>
                  {['DDB1','DXE6'].map(s => (
                    <button key={s} onClick={() => setStation(s)}
                      style={{ padding:'5px 14px', borderRadius:20, border:'none', cursor:'pointer', fontFamily:'inherit', fontWeight:700, fontSize:12, transition:'all 0.18s',
                        background: station===s ? '#3B82F6' : 'rgba(255,255,255,0.08)',
                        color: station===s ? 'white' : 'rgba(255,255,255,0.55)',
                        boxShadow: station===s ? '0 2px 8px rgba(59,130,246,0.4)' : 'none',
                      }}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {/* Date */}
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:10, padding:'7px 11px', color:'rgba(255,255,255,0.85)', fontSize:12.5, outline:'none', cursor:'pointer', fontFamily:'inherit' }}/>
            </div>
          </div>

          {/* KPI tiles */}
          <div className="fl-hero-kpi" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
            {[
              { label:'Total Vehicles', val:vehs.length,  color:'#8F6807' },
              { label:'Active',         val:active,        color:'#4ADE80' },
              { label:'Down / Maint.',  val:grounded,      color:'#F87171' },
              { label:'In Use (HV)',    val:inUse,         color:'#818CF8' },
            ].map(k => (
              <div key={k.label} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, padding:'14px 16px' }}>
                <div style={{ fontSize:26, fontWeight:800, color:k.color, lineHeight:1.1 }}>
                  {loading ? <span style={{ opacity:0.3 }}>—</span> : k.val}
                </div>
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', marginTop:4 }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* Etisalat live tracking badge — appears only once tracking data arrives */}
          {liveCount > 0 && (
            <div style={{ marginTop:14, display:'inline-flex', alignItems:'center', gap:7, padding:'6px 13px', borderRadius:20, background:'rgba(16,185,129,0.12)', border:'1px solid rgba(16,185,129,0.3)' }}>
              <span style={{ width:7, height:7, borderRadius:'50%', background:'#34D399', boxShadow:'0 0 0 3px rgba(52,211,153,0.3)', display:'inline-block' }}/>
              <span style={{ fontSize:11.5, fontWeight:700, color:'#34D399' }}>
                Etisalat Live — {liveCount} vehicle{liveCount > 1 ? 's' : ''} tracked
              </span>
            </div>
          )}
        </div>

        {/* ── Search + Add Vehicle ── */}
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <div style={{ flex:1, position:'relative' }}>
            <Search size={14} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', pointerEvents:'none' }}/>
            <input
              style={{ width:'100%', paddingLeft:36, paddingRight:12, paddingTop:10, paddingBottom:10, borderRadius:10, border:'1px solid var(--border)', background:'var(--card)', color:'var(--text)', fontSize:13, fontFamily:'inherit', outline:'none', boxSizing:'border-box' }}
              placeholder="Search plate, make, model or driver…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button onClick={() => setModal('vehicle-add')}
            style={{ display:'flex', alignItems:'center', gap:7, padding:'10px 18px', borderRadius:10, border:'none', background:'#8F6807', color:'white', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit', flexShrink:0, whiteSpace:'nowrap', transition:'background 0.15s' }}
            onMouseEnter={e=>e.currentTarget.style.background='#9a7209'}
            onMouseLeave={e=>e.currentTarget.style.background='#8F6807'}>
            <Plus size={14}/> Add Vehicle
          </button>
        </div>

        {/* ── Filter tabs ── */}
        <div style={{ display:'flex', gap:3, background:'var(--bg-alt)', borderRadius:14, padding:3, overflow:'hidden' }}>
          {TABS.map(f => (
            <button key={f.id} onClick={() => setFilterStatus(f.id)}
              className={`fl-tab${filterStatus===f.id?' active':''}`}
              style={{
                background: filterStatus===f.id ? f.activeBg : 'transparent',
                color: filterStatus===f.id ? f.activeColor : 'var(--text-muted)',
              }}>
              {f.label}
              <span className="fl-tab-count"
                style={{ background: filterStatus===f.id ? f.activeBg : 'var(--border)', color: filterStatus===f.id ? f.activeColor : 'var(--text-muted)' }}>
                {f.count}
              </span>
            </button>
          ))}
        </div>

        {/* ── Pending POC Verifications ── */}
        {pendingVers.length > 0 && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:7 }}>
              <ArrowLeftRight size={14} color="#7C3AED"/>
              <span style={{ fontSize:12, fontWeight:700, color:'#5B21B6', textTransform:'uppercase', letterSpacing:'0.05em' }}>
                Awaiting Your Verification ({pendingVers.length})
              </span>
            </div>
            {pendingVers.map(pv => (
              <div key={pv.id} style={{ background:'#F5F3FF', border:'2px solid #7C3AED', borderRadius:16, padding:'14px 16px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                  <div style={{ width:38, height:38, borderRadius:11, background:'#EDE9FE', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <ArrowLeftRight size={17} color="#7C3AED"/>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:800, fontSize:14, color:'#1A1612' }}>{pv.vehicle_plate || '—'}</div>
                    <div style={{ fontSize:11.5, color:'#6B7280', marginTop:1 }}>
                      From <strong style={{ color:'#374151' }}>{pv.emp_name}</strong>
                      {pv.receiver_name && <> → <strong style={{ color:'#374151' }}>{pv.receiver_name}</strong></>}
                    </div>
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'#7C3AED', background:'#EDE9FE', borderRadius:20, padding:'2px 8px' }}>POC Pending</div>
                    <div style={{ fontSize:10.5, color:'#9CA3AF', marginTop:3 }}>
                      {new Date(pv.submitted_at).toLocaleDateString('en-AE',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
                    </div>
                  </div>
                </div>
                {[pv.photo_1, pv.photo_2, pv.photo_3, pv.photo_4].some(Boolean) && (
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6, marginBottom:10 }}>
                    {[pv.photo_1, pv.photo_2, pv.photo_3, pv.photo_4].map((url, i) => (
                      url
                        ? <a key={i} href={url} target="_blank" rel="noreferrer" style={{ aspectRatio:'1', borderRadius:9, overflow:'hidden', display:'block', border:'1px solid #DDD6FE' }}>
                            <img src={url} alt="" loading="lazy" decoding="async" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                          </a>
                        : <div key={i} style={{ aspectRatio:'1', borderRadius:9, background:'#EDE9FE', border:'1px dashed #C4B5FD', display:'flex', alignItems:'center', justifyContent:'center' }}>
                            <span style={{ fontSize:9, color:'#A78BFA' }}>{['F','B','L','R'][i]}</span>
                          </div>
                    ))}
                  </div>
                )}
                <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap' }}>
                  {pv.fuel_level && <span style={{ fontSize:11, fontWeight:600, color:'#5B21B6', background:'#EDE9FE', borderRadius:20, padding:'2px 9px' }}>Fuel: {FUEL_LABEL[pv.fuel_level]||pv.fuel_level}</span>}
                  {pv.odometer   && <span style={{ fontSize:11, fontWeight:600, color:'#5B21B6', background:'#EDE9FE', borderRadius:20, padding:'2px 9px' }}>ODO: {Number(pv.odometer).toLocaleString()} km</span>}
                  {pv.condition_note && <span style={{ fontSize:11, color:'#6B7280', fontStyle:'italic' }}>"{pv.condition_note}"</span>}
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={() => pocVerify(pv.id, 'reject')} disabled={verifying===pv.id}
                    style={{ flex:1, padding:10, borderRadius:10, background:'#FEF2F2', border:'1.5px solid #FECACA', color:'#DC2626', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:6, opacity:verifying===pv.id?0.6:1 }}>
                    <X size={14}/> Reject
                  </button>
                  <button onClick={() => pocVerify(pv.id, 'approve')} disabled={verifying===pv.id}
                    style={{ flex:2, padding:10, borderRadius:10, background:'linear-gradient(135deg,#2E7D52,#22C55E)', border:'none', color:'#FFF', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:6, opacity:verifying===pv.id?0.6:1 }}>
                    {verifying===pv.id
                      ? <><span style={{ width:13,height:13,border:'2px solid rgba(255,255,255,0.4)',borderTopColor:'white',borderRadius:'50%',animation:'spin 0.8s linear infinite' }}/> Saving…</>
                      : <><Check size={14}/> Approve Handover</>}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Vehicle Grid ── */}
        {loading ? (
          <div className="fl-grid">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="fl-skel" style={{ height:262, opacity:1 - (i-1)*0.08 }}/>
            ))}
          </div>
        ) : displayVehs.length === 0 ? (
          <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--text-muted)' }}>
            <div style={{ width:64, height:64, borderRadius:'50%', background:'var(--card)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
              <Truck size={28} style={{ opacity:0.2 }}/>
            </div>
            <div style={{ fontWeight:700, fontSize:15, color:'var(--text)', marginBottom:6 }}>
              {filterStatus==='all' && !search ? 'No vehicles yet' : 'No vehicles match this filter'}
            </div>
            <div style={{ fontSize:13, marginBottom:20 }}>
              {filterStatus==='all' && !search ? 'Add your first vehicle using the button above.' : 'Try adjusting the filters or search term.'}
            </div>
            {filterStatus==='all' && !search && (
              <button onClick={() => setModal('vehicle-add')}
                style={{ padding:'10px 24px', borderRadius:10, border:'none', background:'#8F6807', color:'white', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
                <Plus size={13} style={{ display:'inline', marginRight:6, verticalAlign:'middle' }}/> Add Vehicle
              </button>
            )}
          </div>
        ) : (
          <div className="fl-grid">
            {displayVehs.map((v, i) => {
              const asgn    = asgns.find(a => String(a.vehicle_id)===String(v.id))
              const curHV   = currentHVs.find(h => String(h.vehicle_id)===String(v.id))
              const isDown  = v.status !== 'active'
              const sc      = VSTATUS_COLORS[v.status] || '#78716C'
              const sb      = { active:'#ECFDF5', grounded:'#FEF2F2', maintenance:'#FFFBEB', sold:'#F5F4F1' }[v.status] || '#F5F4F1'
              const trackData = tracking ? (tracking[normPlate(v.plate)] || null) : null
              return (
                <div key={v.id} style={{ animation:`slideUp 0.3s ${Math.min(i,8)*0.04}s ease both` }}>
                  <VehicleCard
                    v={v} asgn={asgn} currentHandover={curHV}
                    isDown={isDown} sc={sc} sb={sb}
                    date={date} station={station} emps={emps} allAsgns={asgns} currentUser={user}
                    tracking={trackData}
                    onEdit={() => setModal({ type:'vehicle-edit', vehicle:v })}
                    onDelete={() => setConfirmDlg({
                      title:'Delete vehicle?',
                      message:`Remove ${v.plate}${v.make?' ('+v.make+(v.model?' '+v.model:'')+')'  :''} permanently?`,
                      confirmLabel:'Delete', danger:true,
                      onConfirm: async () => {
                        setConfirmDlg(null)
                        await fetch(`${API}/api/vehicles/${v.id}`, { method:'DELETE', headers:hdr() })
                        load()
                      }
                    })}
                    onAssign={eId => assignVehicle(v.id, eId)}
                  />
                </div>
              )
            })}
          </div>
        )}

        {/* Enrichment indicator — subtle, only while loading phase 2 */}
        {!loading && enriching && (
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px', background:'var(--bg-alt)', border:'1px solid var(--border)', borderRadius:10, fontSize:12, color:'var(--text-muted)' }}>
            <span style={{ width:12, height:12, border:'2px solid var(--border)', borderTopColor:'#8F6807', borderRadius:'50%', animation:'spin 0.8s linear infinite', flexShrink:0 }}/>
            Loading assignments &amp; handovers…
          </div>
        )}

      </div>

      {modal==='vehicle-add'       && <VehicleModal station={station} onClose={() => setModal(null)} onSave={() => { setModal(null); load() }}/>}
      {modal?.type==='vehicle-edit' && <VehicleModal vehicle={modal.vehicle} station={station} onClose={() => setModal(null)} onSave={() => { setModal(null); load() }}/>}
      <ConfirmDialog open={!!confirmDlg} title={confirmDlg?.title} message={confirmDlg?.message} confirmLabel={confirmDlg?.confirmLabel} danger={confirmDlg?.danger??true} onConfirm={confirmDlg?.onConfirm} onCancel={() => setConfirmDlg(null)}/>
    </>
  )
}
