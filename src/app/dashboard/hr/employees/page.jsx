'use client'
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { empApi } from '@/lib/api'
import { useSocket } from '@/lib/socket'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import EmpForm from '@/components/employees/EmpForm'
import PageHero from '@/components/employees/PageHero'
import { setEmps } from '@/lib/empCache'
import {
  STATUS, SC_COLOR, SC_BG, SC_BORDER, projectLabel, expiry, profileCompletion,
} from '@/lib/employees'
import { Search, Plus, X, Pencil, Trash2, Users, RefreshCw } from 'lucide-react'

/* ── Completion Ring (SVG) ───────────────────────────────────── */
function CompletionRing({ pct, size=52, stroke=3 }) {
  const r    = (size - stroke) / 2
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

/* ── Modal (Add DA only — Edit lives at hr/employees/[id]/edit) ──── */
function EmpModal({ emp, onSave, onClose, mode }) {
  return createPortal(
    <div className="modal-overlay" style={{ zIndex:9999 }}>
      <EmpForm emp={emp} mode={mode} onSaved={onSave} onCancel={onClose} maxWidth={540}/>
    </div>,
    document.body
  )
}

/* ── Employee Card ───────────────────────────────────────────── */
function EmpCard({ emp, onEdit, onDelete, index, userRole }) {
  const s        = STATUS[emp.status] || STATUS.inactive
  const sc       = SC_COLOR[emp.station_code] || '#B8860B'
  const exp      = expiry(emp.visa_expiry)
  const hasAlert = exp && (exp.label === 'Expired' || parseInt(exp.label) <= 60)
  const pct      = profileCompletion(emp)
  const isOwn    = (emp.visa_type || 'company') === 'own'

  const bc = hasAlert ? '#EF4444' : s.dot

  return (
    <Link href={`/dashboard/hr/employees/${emp.id}`} prefetch
      className="da-card"
      style={{
        background:'var(--card)',
        border:`1.5px solid ${hasAlert ? bc : 'var(--border)'}`,
        borderRadius:16,
        overflow:'hidden',
        textDecoration:'none',
        display:'flex',
        flexDirection:'column',
        animation:`slideUp 0.25s ${Math.min(index,12)*0.025}s ease both`,
      }}>

      <div style={{ padding:'16px 16px 12px', display:'flex', gap:12, alignItems:'flex-start' }}>
        <div style={{ position:'relative', flexShrink:0 }}>
          <div style={{ width:50, height:50, borderRadius:14, background:`linear-gradient(135deg,${bc}18,${bc}35)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:900, color:bc, letterSpacing:'-0.02em' }}>
            {emp.name?.slice(0,2).toUpperCase()}
            <CompletionRing pct={pct} size={50} stroke={3}/>
          </div>
          <div style={{ position:'absolute', bottom:-2, right:-2, width:11, height:11, borderRadius:'50%', background:hasAlert?'#EF4444':s.dot, border:'2.5px solid var(--card)' }}/>
        </div>

        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:6, marginBottom:3 }}>
            <span style={{ fontWeight:800, fontSize:14.5, color:'var(--text)', lineHeight:1.25, wordBreak:'break-word' }}>{emp.name}</span>
            <span style={{ fontSize:9.5, fontWeight:700, color:s.c, background:s.bg, border:`1px solid ${s.bc}`, borderRadius:20, padding:'2px 8px', flexShrink:0, whiteSpace:'nowrap' }}>{s.l}</span>
          </div>
          <div style={{ fontSize:11.5, color:'var(--text-muted)', display:'flex', alignItems:'center', gap:5, flexWrap:'wrap' }}>
            <span style={{ fontWeight:700, color:sc }}>{emp.station_code || '—'}</span>
            {emp.project_type && <>· {projectLabel(emp.project_type)}</>}
            {emp.nationality && <>· {emp.nationality}</>}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:5 }}>
            <span style={{ fontSize:10, fontWeight:600, color:'var(--text-muted)', fontFamily:'monospace' }}>#{emp.id}</span>
            {isOwn && (
              <span style={{ fontSize:9.5, fontWeight:700, color:'#0369A1', background:'#EFF6FF', border:'1px solid #BAE6FD', borderRadius:6, padding:'1px 6px' }}>Own Visa</span>
            )}
            {hasAlert && (
              <span style={{ fontSize:9.5, fontWeight:700, color:'#DC2626', background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:6, padding:'1px 6px' }}>Visa {exp.label}</span>
            )}
          </div>
        </div>
      </div>

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
        {['admin','accountant'].includes(userRole) && (
          <div style={{ display:'flex', gap:4, flexShrink:0 }}>
            <button onClick={e=>{e.preventDefault();e.stopPropagation();onEdit(emp)}}
              style={{ width:30, height:30, borderRadius:8, background:'var(--bg-alt)', border:'1px solid var(--border)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-sub)' }}>
              <Pencil size={11}/>
            </button>
            {userRole === 'admin' && (
              <button onClick={e=>{e.preventDefault();e.stopPropagation();onDelete(emp)}}
                style={{ width:30, height:30, borderRadius:8, background:'var(--red-bg)', border:'1px solid var(--red-border)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--red)' }}>
                <Trash2 size={11}/>
              </button>
            )}
          </div>
        )}
      </div>
    </Link>
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

  useEffect(() => {
    try { const t=localStorage.getItem('gcd_token'); if(t){const p=JSON.parse(atob(t.split('.')[1]));setUserRole(p.role)} } catch(e){}
  }, [])

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await empApi.list({})
      const drivers = (data.employees||[]).filter(e=>(e.role||'').toLowerCase()==='driver')
      setAllEmployees(drivers)
      setEmps(drivers)
    } catch(e) { console.error(e) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const stationEmps = useMemo(() =>
    station==='All' ? allEmployees : allEmployees.filter(e=>e.station_code===station)
  , [allEmployees, station])

  const active  = stationEmps.filter(e=>e.status==='active').length
  const onLeave = stationEmps.filter(e=>e.status==='on_leave').length
  const alerts  = stationEmps.filter(e=>{const v=expiry(e.visa_expiry);return v&&(v.label==='Expired'||parseInt(v.label)<=60)}).length

  const employees = useMemo(() => {
    let r = stationEmps
    if (filterTab==='active')   r = r.filter(e=>e.status==='active')
    if (filterTab==='on_leave') r = r.filter(e=>e.status==='on_leave')
    if (filterTab==='alerts')   r = r.filter(e=>{const v=expiry(e.visa_expiry);return v&&(v.label==='Expired'||parseInt(v.label)<=60)})
    if (search) r = r.filter(e=>[e.name,e.id,e.work_number,e.phone,e.nationality].some(f=>(f||'').toLowerCase().includes(search.toLowerCase())))
    return r
  }, [stationEmps, filterTab, search])

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

  const CSS = `
    .da-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
    .da-card{transition:box-shadow var(--t-base),transform var(--t-base),border-color var(--t-base)}
    .da-card:hover{transform:translateY(-2px);box-shadow:var(--shadow-md);border-color:var(--border-strong)}
    .da-tab{display:flex;align-items:center;justify-content:center;gap:6px;flex:1 0 auto;padding:8px 12px;border-radius:11px;border:none;cursor:pointer;font-weight:500;font-size:12.5px;font-family:inherit;transition:all var(--t-fast);white-space:nowrap;background:transparent}
    .da-tab.active{font-weight:700;background:var(--card);box-shadow:var(--shadow)}
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

        <PageHero icon={Users} title="DAs" subtitle="Delivery Associates — assignments & profiles"
          actions={<>
            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
              {['DDB1','DXE6'].map(st => (
                <button key={st} onClick={()=>setStation(station===st?'All':st)}
                  style={{ padding:'5px 14px', borderRadius:20, border:'none', cursor:'pointer', fontFamily:'inherit', fontWeight:700, fontSize:12, transition:'all var(--t-fast)',
                    background: station===st ? '#3B82F6' : 'rgba(255,255,255,0.08)',
                    color: station===st ? 'white' : 'rgba(255,255,255,0.55)',
                    boxShadow: station===st ? '0 2px 8px rgba(59,130,246,0.4)' : 'none',
                  }}>
                  {st}
                </button>
              ))}
            </div>
            <button onClick={load} title="Refresh"
              style={{ width:36, height:36, borderRadius:10, background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.15)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'rgba(255,255,255,0.7)' }}>
              <RefreshCw size={14}/>
            </button>
          </>}>
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
        </PageHero>

        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <div style={{ flex:1, position:'relative' }}>
            <Search size={14} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', pointerEvents:'none' }}/>
            <input
              style={{ width:'100%', paddingLeft:36, paddingRight:12, paddingTop:10, paddingBottom:10, borderRadius:10, border:'1px solid var(--border)', background:'var(--card)', color:'var(--text)', fontSize:13, fontFamily:'inherit', outline:'none', boxSizing:'border-box' }}
              placeholder="Search name, ID, phone, nationality…"
              value={search} onChange={e=>setSearch(e.target.value)}/>
            {search && <button onClick={()=>setSearch('')} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:0, display:'flex' }}><X size={13}/></button>}
          </div>
          {['admin','accountant'].includes(userRole) && (
            <button onClick={()=>setModal({mode:'add',emp:null})}
              style={{ display:'flex', alignItems:'center', gap:7, padding:'10px 18px', borderRadius:10, border:'none', background:'#B8860B', color:'white', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit', flexShrink:0, whiteSpace:'nowrap', transition:'background var(--t-fast)' }}
              onMouseEnter={e=>e.currentTarget.style.background='#9a7209'}
              onMouseLeave={e=>e.currentTarget.style.background='#B8860B'}>
              <Plus size={14}/> Add DA
            </button>
          )}
        </div>

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
          <div className="da-grid">
            {employees.map((emp,i)=>(
              <EmpCard key={emp.id} emp={emp} index={i}
                onEdit={e=>router.push(`/dashboard/hr/employees/${e.id}/edit`)}
                onDelete={handleDelete}
                userRole={userRole}/>
            ))}
          </div>
        )}
      </div>

      {modal && <EmpModal key={`${modal.mode}-${modal.emp?.id||'new'}`} mode={modal.mode} emp={modal.emp} onClose={()=>setModal(null)} onSave={()=>{setModal(null);load()}}/>}
    </>
  )
}
