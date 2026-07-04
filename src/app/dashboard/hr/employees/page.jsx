'use client'
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { empApi } from '@/lib/api'
import { useSocket } from '@/lib/socket'
import { useRouter } from 'next/navigation'
import EmpForm from '@/components/employees/EmpForm'
import { Search, Plus, X, Pencil, Trash2, Users, RefreshCw } from 'lucide-react'
import { differenceInDays, parseISO } from 'date-fns'

import { API } from '@/lib/api'
const STATIONS = ['All','DDB1','DXE6']
const SC_COLOR = { DDB1:'#B8860B', DXE6:'#2563EB' }
const SC_BG    = { DDB1:'#FFFBEB', DXE6:'#EFF6FF' }
const SC_BORDER= { DDB1:'#FDE68A', DXE6:'#BFDBFE' }

const PROJECT_LABELS = {
  pulser: 'Pulser', cret: 'CRET', office: 'Office',
  creative_packers: 'Creative Packers', ig_rak: 'IG RAK',
  imile: 'IMILE Delivery Services', jnt_express: 'Jnt Express', le_chocola: 'Le Chocola',
}
function projectLabel(v) { return PROJECT_LABELS[v] || (v ? v.charAt(0).toUpperCase()+v.slice(1) : v) }

const STATUS = {
  active:   { l:'Active',   c:'#10B981', bg:'#F0FDF4', bc:'#A7F3D0', dot:'#10B981' },
  on_leave: { l:'On Leave', c:'#F59E0B', bg:'#FFFBEB', bc:'#FDE68A', dot:'#F59E0B' },
  inactive: { l:'Inactive', c:'#9CA3AF', bg:'#F9FAFB', bc:'#E5E7EB', dot:'#9CA3AF' },
}

function hdr() { return { 'Content-Type':'application/json', Authorization:`Bearer ${localStorage.getItem('gcd_token')}` } }
function expiry(ds) {
  if (!ds) return null
  try {
    const d = differenceInDays(parseISO(ds.slice(0,10)), new Date())
    if (d < 0)   return { label:'Expired',    c:'#EF4444', bg:'#FEF2F2', bc:'#FECACA' }
    if (d <= 30) return { label:`${d}d left`, c:'#EF4444', bg:'#FEF2F2', bc:'#FECACA' }
    if (d <= 90) return { label:`${d}d left`, c:'#F59E0B', bg:'#FFFBEB', bc:'#FDE68A' }
    return { label:'Valid', c:'#10B981', bg:'#F0FDF4', bc:'#A7F3D0' }
  } catch { return null }
}

/* ── Profile completion ──────────────────────────────────────── */
const COMPLETION_FIELDS = [
  'phone','emirates_id','nationality','dob','gender','marital_status',
  'passport_no','uid_number','visa_file_no','email_id','father_family_name',
  'residential_location','work_location',
  'emirates_issuing_visa','visa_expiry','license_expiry','amazon_id',
  'sub_group_name',
]
const COMPLETION_LABELS = {
  phone:'Phone', emirates_id:'Emirates ID', nationality:'Nationality',
  dob:'Date of Birth', gender:'Gender', marital_status:'Marital Status',
  passport_no:'Passport No', uid_number:'UID Number', visa_file_no:'Visa File No',
  email_id:'Email', father_family_name:'Father/Family Name',
  residential_location:'Residential Location',
  work_location:'Work Location', emirates_issuing_visa:'Emirates Issuing Visa',
  visa_expiry:'Visa Expiry', license_expiry:'License Expiry',
  amazon_id:'Amazon ID', sub_group_name:'Sub Group',
}
function profileCompletion(emp) {
  if (!emp) return 0
  const filled = COMPLETION_FIELDS.filter(f => emp[f] && String(emp[f]).trim() !== '').length
  const hasSalary = Number(emp.salary||0) > 0 ? 1 : 0
  return Math.round(((filled + hasSalary) / (COMPLETION_FIELDS.length + 1)) * 100)
}
function missingFields(emp) {
  if (!emp) return []
  const missing = COMPLETION_FIELDS.filter(f => !emp[f] || String(emp[f]).trim() === '').map(f => COMPLETION_LABELS[f]||f)
  if (!Number(emp.salary||0)) missing.unshift('Salary')
  return missing
}

/* ── Completion Ring (SVG) ───────────────────────────────────── */
function CompletionRing({ pct, size=54, stroke=3 }) {
  const r   = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  const color = pct === 100 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#EF4444'
  return (
    <svg width={size} height={size} style={{ position:'absolute', top:0, left:0, transform:'rotate(-90deg)', pointerEvents:'none' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition:'stroke-dasharray 0.5s ease' }}/>
    </svg>
  )
}

/* ── Modal (Add DA only — Edit now lives at hr/employees/[id]/edit) ──── */
function EmpModal({ emp, onSave, onClose, mode }) {
  return (
    <div className="modal-overlay" style={{ zIndex:9999 }}>
      <EmpForm emp={emp} mode={mode} onSaved={onSave} onCancel={onClose} maxWidth={540}/>
    </div>
  )
}

/* ── Employee Card ───────────────────────────────────────────── */
function EmpCard({ emp, onClick, onEdit, onDelete, index, isSelected, userRole }) {
  const s        = STATUS[emp.status] || STATUS.inactive
  const sc       = SC_COLOR[emp.station_code]  || '#B8860B'
  const sbg      = SC_BG[emp.station_code]     || '#FFFBEB'
  const sbc      = SC_BORDER[emp.station_code] || '#FDE68A'
  const exp      = expiry(emp.visa_expiry)
  const hasAlert = exp && (exp.label === 'Expired' || parseInt(exp.label) <= 60)
  const pct      = profileCompletion(emp)
  const vt       = emp.visa_type || 'company'
  const isOwn    = vt === 'own'

  const bc   = hasAlert ? '#EF4444' : isSelected ? sc : s.dot
  const glow = hasAlert ? '#EF444420' : isSelected ? `${sc}28` : `${s.dot}18`

  return (
    <div onClick={onClick}
      style={{
        background:'var(--card)',
        border:`2px solid ${bc}`,
        borderRadius:16,
        overflow:'hidden',
        cursor:'pointer',
        transition:'box-shadow 0.18s, transform 0.18s',
        boxShadow:`0 0 0 1px ${glow}, 0 4px 16px rgba(0,0,0,0.06)`,
        display:'flex',
        flexDirection:'column',
        animation:`slideUp 0.25s ${Math.min(index,12)*0.025}s ease both`,
      }}
      onMouseEnter={e => {
        if (!isSelected) {
          e.currentTarget.style.transform = 'translateY(-2px)'
          e.currentTarget.style.boxShadow = `0 0 0 1px ${glow}, 0 10px 28px rgba(0,0,0,0.10)`
        }
      }}
      onMouseLeave={e => {
        if (!isSelected) {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = `0 0 0 1px ${glow}, 0 4px 16px rgba(0,0,0,0.06)`
        }
      }}>

      {/* Main content */}
      <div style={{ padding:'16px 16px 12px', display:'flex', gap:12, alignItems:'flex-start' }}>
        {/* Avatar with completion ring */}
        <div style={{ position:'relative', flexShrink:0 }}>
          <div style={{ width:52, height:52, borderRadius:14, background:`linear-gradient(135deg,${bc}22,${bc}40)`, border:`1.5px solid ${bc}45`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:900, color:bc, letterSpacing:'-0.02em' }}>
            {emp.name?.slice(0,2).toUpperCase()}
            <CompletionRing pct={pct} size={52} stroke={3}/>
          </div>
          <div style={{ position:'absolute', bottom:-2, right:-2, width:12, height:12, borderRadius:'50%', background:hasAlert?'#EF4444':s.dot, border:'2.5px solid var(--card)' }}/>
        </div>

        {/* Identity */}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:6, marginBottom:4 }}>
            <span style={{ fontWeight:800, fontSize:14, color:'var(--text)', lineHeight:1.25, wordBreak:'break-word' }}>{emp.name}</span>
            <span style={{ fontSize:9.5, fontWeight:700, color:s.c, background:s.bg, border:`1px solid ${s.bc}`, borderRadius:20, padding:'2px 8px', flexShrink:0, whiteSpace:'nowrap' }}>{s.l}</span>
          </div>
          <div style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', fontFamily:'monospace', marginBottom:7 }}>#{emp.id}</div>
          <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
            {emp.station_code && (
              <span style={{ fontSize:10, fontWeight:700, color:sc, background:sbg, border:`1px solid ${sbc}`, borderRadius:6, padding:'2px 7px' }}>{emp.station_code}</span>
            )}
            {emp.nationality && (
              <span style={{ fontSize:10, fontWeight:600, color:'var(--text-muted)', background:'var(--bg-alt)', border:'1px solid var(--border)', borderRadius:6, padding:'2px 7px' }}>{emp.nationality}</span>
            )}
            {emp.project_type && (
              <span style={{ fontSize:10, fontWeight:700, color:'#7C3AED', background:'var(--purple-bg)', border:'1px solid var(--purple-border)', borderRadius:6, padding:'2px 7px' }}>{projectLabel(emp.project_type).toUpperCase()}</span>
            )}
            <span style={{ fontSize:10, fontWeight:600, color:isOwn?'#0369A1':'#065F46', background:isOwn?'#EFF6FF':'#ECFDF5', border:`1px solid ${isOwn?'#BAE6FD':'#A7F3D0'}`, borderRadius:6, padding:'2px 7px' }}>
              {isOwn ? 'Own Visa' : 'Co. Visa'}
            </span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ margin:'0 16px 14px', borderTop:'1px solid var(--border)', paddingTop:10, display:'flex', alignItems:'center', gap:8 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:9, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:2 }}>Personal</div>
          <div style={{ fontSize:11.5, fontWeight:600, color:emp.phone?'var(--text)':'var(--text-muted)', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {emp.phone || '—'}
          </div>
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:9, fontWeight:700, color:'#7C3AED', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:2 }}>Work SIM</div>
          <div style={{ fontSize:11.5, fontWeight:600, color:emp.work_number?'#7C3AED':'var(--text-muted)', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {emp.work_number || '—'}
          </div>
        </div>
        {userRole !== 'accountant' && (
          <div style={{ display:'flex', gap:4, flexShrink:0 }}>
            <button onClick={e=>{e.stopPropagation();onEdit(emp)}}
              style={{ width:30, height:30, borderRadius:8, background:'var(--bg-alt)', border:'1px solid var(--border)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-sub)' }}>
              <Pencil size={11}/>
            </button>
            <button onClick={e=>{e.stopPropagation();onDelete(emp)}}
              style={{ width:30, height:30, borderRadius:8, background:'var(--red-bg)', border:'1px solid var(--red-border)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--red)' }}>
              <Trash2 size={11}/>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ══ MAIN PAGE ═══════════════════════════════════════════════ */
export default function EmployeesPage() {
  const router = useRouter()
  const [allEmployees, setAllEmployees] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [station,      setStation]      = useState('All')
  const [filterTab,    setFilterTab]    = useState('all')
  const [modal,        setModal]        = useState(null)
  const [userRole,     setUserRole]     = useState(null)
  const [page,         setPage]         = useState(1)
  const PAGE_SIZE = 24

  useEffect(() => {
    try { const t=localStorage.getItem('gcd_token'); if(t){const p=JSON.parse(atob(t.split('.')[1]));setUserRole(p.role)} } catch(e){}
  }, [])

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await empApi.list({})
      setAllEmployees((data.employees||[]).filter(e=>(e.role||'').toLowerCase()==='driver'))
    } catch(e) { console.error(e) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // Station-scoped counts for tab badges
  const stationEmps = useMemo(() =>
    station==='All' ? allEmployees : allEmployees.filter(e=>e.station_code===station)
  , [allEmployees, station])

  const active  = stationEmps.filter(e=>e.status==='active').length
  const onLeave = stationEmps.filter(e=>e.status==='on_leave').length
  const alerts  = stationEmps.filter(e=>{const v=expiry(e.visa_expiry);return v&&(v.label==='Expired'||parseInt(v.label)<=60)}).length

  // Full client-side filter: station + tab + search (all instant)
  const employees = useMemo(() => {
    let r = stationEmps
    if (filterTab==='active')   r = r.filter(e=>e.status==='active')
    if (filterTab==='on_leave') r = r.filter(e=>e.status==='on_leave')
    if (filterTab==='alerts')   r = r.filter(e=>{const v=expiry(e.visa_expiry);return v&&(v.label==='Expired'||parseInt(v.label)<=60)})
    if (search) r = r.filter(e=>[e.name,e.id,e.work_number,e.phone,e.nationality].some(f=>(f||'').toLowerCase().includes(search.toLowerCase())))
    return r
  }, [stationEmps, filterTab, search])

  useEffect(() => { setPage(1) }, [search, station, filterTab])

  useSocket({
    'employee:created': e      => { if((e.role||'').toLowerCase()==='driver') setAllEmployees(p=>[...p,e]) },
    'employee:updated': e      => { setAllEmployees(p=>p.map(x=>x.id===e.id?e:x)) },
    'employee:deleted': ({id}) => { setAllEmployees(p=>p.filter(x=>x.id!==id)) },
  })

  async function handleDelete(emp) {
    if (!confirm(`Delete ${emp.name}? This cannot be undone.`)) return
    try { await empApi.delete(emp.id); setAllEmployees(p=>p.filter(e=>e.id!==emp.id)) }
    catch(e) { alert(e.message) }
  }

  const total      = employees.length
  const totalPages = Math.ceil(total / PAGE_SIZE)
  const paginated  = employees.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE)

  const CSS = `
    .da-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px}
    .da-tab{display:flex;align-items:center;justify-content:center;gap:6px;flex:1 0 auto;padding:8px 12px;border-radius:11px;border:none;cursor:pointer;font-weight:500;font-size:12.5px;font-family:inherit;transition:all 0.18s;white-space:nowrap;background:transparent}
    .da-tab.active{font-weight:700;background:var(--card);box-shadow:0 1px 6px rgba(0,0,0,0.10)}
    .da-tab-count{font-size:10px;font-weight:700;padding:1px 6px;border-radius:20px}
    .da-skel{background:var(--bg-alt);border-radius:16px;animation:da-pulse 1.4s ease infinite}
    @keyframes da-pulse{0%,100%{opacity:.45}50%{opacity:.85}}
    .da-hero-kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:20px}
    @media(max-width:640px){
      .da-grid{grid-template-columns:1fr !important}
      .da-tab{font-size:11px;padding:7px 8px}
      .da-hero-kpi{grid-template-columns:1fr 1fr !important}
    }
    @media(max-width:900px) and (min-width:641px){
      .da-grid{grid-template-columns:repeat(2,1fr) !important}
    }
  `

  const TABS = [
    { id:'all',      label:'All',      count:stationEmps.length, activeColor:'#B8860B', activeBg:'#B8860B18' },
    { id:'active',   label:'Active',   count:active,              activeColor:'#2E7D52', activeBg:'#2E7D5218' },
    { id:'on_leave', label:'On Leave', count:onLeave,             activeColor:'#B45309', activeBg:'#B4530918' },
    { id:'alerts',   label:'Alerts',   count:alerts,              activeColor:'#C0392B', activeBg:'#C0392B18' },
  ]

  return (
    <>
      <style>{CSS}</style>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

        {/* ── Hero (matches fleet exactly) ─────────────────────── */}
        <div style={{ background:'linear-gradient(135deg,#0f1623 0%,#1a2535 50%,#1e3a5f 100%)', borderRadius:16, padding:24 }}>

          {/* Title row */}
          <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:20, flexWrap:'wrap' }}>
            <div style={{ width:46, height:46, borderRadius:14, background:'rgba(59,130,246,0.15)', border:'1.5px solid rgba(59,130,246,0.35)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Users size={22} color="#60A5FA"/>
            </div>
            <div>
              <div style={{ fontWeight:900, fontSize:20, color:'white', letterSpacing:'-0.02em', lineHeight:1.1 }}>DAs</div>
              <div style={{ fontSize:12, color:'rgba(255,255,255,0.5)', marginTop:3 }}>Delivery Associates — assignments &amp; profiles</div>
            </div>
            <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
              {/* Station pills */}
              <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                {['DDB1','DXE6'].map(s => (
                  <button key={s} onClick={()=>setStation(station===s?'All':s)}
                    style={{ padding:'5px 14px', borderRadius:20, border:'none', cursor:'pointer', fontFamily:'inherit', fontWeight:700, fontSize:12, transition:'all 0.18s',
                      background: station===s ? '#3B82F6' : 'rgba(255,255,255,0.08)',
                      color: station===s ? 'white' : 'rgba(255,255,255,0.55)',
                      boxShadow: station===s ? '0 2px 8px rgba(59,130,246,0.4)' : 'none',
                    }}>
                    {s}
                  </button>
                ))}
              </div>
              {/* Refresh */}
              <button onClick={load} title="Refresh"
                style={{ width:36, height:36, borderRadius:10, background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.15)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'rgba(255,255,255,0.7)' }}>
                <RefreshCw size={14}/>
              </button>
            </div>
          </div>

          {/* KPI tiles */}
          <div className="da-hero-kpi">
            {[
              { label:'Total DAs',  val:loading?'—':allEmployees.length, color:'#B8860B' },
              { label:'Active',     val:loading?'—':active,              color:'#4ADE80' },
              { label:'On Leave',   val:loading?'—':onLeave,             color:'#FBBF24' },
              { label:'Alerts',     val:loading?'—':alerts,              color:alerts>0?'#F87171':'#4ADE80' },
            ].map(k=>(
              <div key={k.label} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, padding:'14px 16px' }}>
                <div style={{ fontSize:26, fontWeight:800, color:k.color, lineHeight:1.1 }}>
                  {loading ? <span style={{ opacity:0.3 }}>—</span> : k.val}
                </div>
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', marginTop:4 }}>{k.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Search + Add DA ─────────────────────────────────── */}
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <div style={{ flex:1, position:'relative' }}>
            <Search size={14} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', pointerEvents:'none' }}/>
            <input
              style={{ width:'100%', paddingLeft:36, paddingRight:12, paddingTop:10, paddingBottom:10, borderRadius:10, border:'1px solid var(--border)', background:'var(--card)', color:'var(--text)', fontSize:13, fontFamily:'inherit', outline:'none', boxSizing:'border-box' }}
              placeholder="Search name, ID, phone, nationality…"
              value={search} onChange={e=>setSearch(e.target.value)}/>
            {search && <button onClick={()=>setSearch('')} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:0, display:'flex' }}><X size={13}/></button>}
          </div>
          {userRole !== 'accountant' && (
            <button onClick={()=>setModal({mode:'add',emp:null})}
              style={{ display:'flex', alignItems:'center', gap:7, padding:'10px 18px', borderRadius:10, border:'none', background:'#B8860B', color:'white', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit', flexShrink:0, whiteSpace:'nowrap', transition:'background 0.15s' }}
              onMouseEnter={e=>e.currentTarget.style.background='#9a7209'}
              onMouseLeave={e=>e.currentTarget.style.background='#B8860B'}>
              <Plus size={14}/> Add DA
            </button>
          )}
        </div>

        {/* ── Filter tabs ─────────────────────────────────────── */}
        <div style={{ display:'flex', gap:3, background:'var(--bg-alt)', borderRadius:14, padding:3 }}>
          {TABS.map(f=>(
            <button key={f.id} onClick={()=>setFilterTab(f.id)}
              className={`da-tab${filterTab===f.id?' active':''}`}
              style={{ color:filterTab===f.id?f.activeColor:'var(--text-muted)', background:filterTab===f.id?f.activeBg:'transparent' }}>
              {f.label}
              <span className="da-tab-count"
                style={{ background:filterTab===f.id?f.activeBg:'var(--border)', color:filterTab===f.id?f.activeColor:'var(--text-muted)' }}>
                {f.count}
              </span>
            </button>
          ))}
        </div>

        {/* ── Cards ────────────────────────────────────────────── */}
        {loading ? (
          <div className="da-grid">
            {[1,2,3,4,5,6].map(i=><div key={i} className="da-skel" style={{ height:150 }}/>)}
          </div>
        ) : employees.length===0 ? (
          <div style={{ textAlign:'center', padding:'60px 20px' }}>
            <Users size={40} style={{ margin:'0 auto 12px', display:'block', opacity:0.15 }}/>
            <div style={{ fontWeight:700, fontSize:15, color:'var(--text-sub)' }}>{search?`No results for "${search}"`:'No DAs found'}</div>
          </div>
        ) : (
          <>
            <div className="da-grid">
              {paginated.map((emp,i)=>(
                <EmpCard key={emp.id} emp={emp} index={i}
                  isSelected={false}
                  onClick={()=>router.push(`/dashboard/hr/employees/${emp.id}`)}
                  onEdit={e=>router.push(`/dashboard/hr/employees/${e.id}/edit`)}
                  onDelete={handleDelete}
                  userRole={userRole}/>
              ))}
            </div>
            {totalPages>1 && (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, paddingTop:8 }}>
                <button className="btn btn-secondary btn-sm" onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}>‹ Prev</button>
                <span style={{ fontSize:12.5, color:'var(--text-muted)' }}>Page {page} of {totalPages}</span>
                <button className="btn btn-secondary btn-sm" onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}>Next ›</button>
              </div>
            )}
          </>
        )}
      </div>

      {modal && <EmpModal key={`${modal.mode}-${modal.emp?.id||'new'}`} mode={modal.mode} emp={modal.emp} onClose={()=>setModal(null)} onSave={()=>{setModal(null);load()}}/>}
    </>
  )
}