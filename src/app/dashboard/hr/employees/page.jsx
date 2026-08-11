'use client'
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { empApi } from '@/lib/api'
import { useSocket } from '@/lib/socket'
import { useAuth } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import EmpForm from '@/components/employees/EmpForm'
import PageHero from '@/components/employees/PageHero'
import { setEmps } from '@/lib/empCache'
import {
  STATUS, SC_COLOR, SC_BG, SC_BORDER, projectLabel, expiry, profileCompletion,
  CLIENT_PROJECTS, isClientProject,
} from '@/lib/employees'
import { Search, Plus, X, Pencil, Trash2, Users, RefreshCw, UploadCloud, Download, Check, AlertCircle } from 'lucide-react'
import Papa from 'papaparse'

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

/* ── Modal (Add Employee only — Edit lives at hr/employees/[id]/edit) ──── */
function EmpModal({ emp, onSave, onClose, mode }) {
  return createPortal(
    <div className="modal-overlay" style={{ zIndex:9999 }}>
      <EmpForm emp={emp} mode={mode} onSaved={onSave} onCancel={onClose} maxWidth={540}/>
    </div>,
    document.body
  )
}

/* ── Bulk Upload Modal ───────────────────────────────────────── */
function BulkUploadModal({ isProjectScoped, defaultProject, onSave, onClose }) {
  const [rows,      setRows]      = useState([])
  const [fileName,  setFileName]  = useState('')
  const [uploading, setUploading] = useState(false)
  const [err,       setErr]       = useState(null)
  const [result,    setResult]    = useState(null)

  function downloadTemplate() {
    // DDB1/DXE6 are Amazon-only stations — meaningless (and never saved, see
    // routes/employees.js normalizeStationCode) for client-project DAs, so the
    // example row leaves station_code blank for those instead of suggesting one.
    const exampleStation = isClientProject(defaultProject) ? '' : 'DDB1'
    const csv = 'name,phone,visa_type,project_type,station_code\n'
      + `Mohammed Al Rashid,+971 50 XXX XXXX,${isProjectScoped ? 'own' : 'company'},${defaultProject},${exampleStation}\n`
    const blob = new Blob([csv], { type:'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'employees_template.csv'
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setFileName(file.name); setErr(null); setResult(null)
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (res) => {
        const parsed = res.data.map((r, i) => {
          const name = (r.name || '').trim()
          const errors = []
          if (!name) errors.push('name required')
          return {
            row: i + 2, name, phone: (r.phone || '').trim(),
            visa_type: (r.visa_type || '').trim(), project_type: (r.project_type || '').trim(),
            station_code: (r.station_code || '').trim(), errors,
          }
        })
        setRows(parsed)
      },
      error: (e) => setErr(e.message),
    })
  }

  const validRows = rows.filter(r => r.errors.length === 0)

  async function handleUpload() {
    if (!validRows.length) return
    setUploading(true); setErr(null)
    try {
      const data = await empApi.bulkCreate(validRows.map(({ row, errors, ...r }) => r))
      setResult(data)
    } catch(e) { setErr(e.message) } finally { setUploading(false) }
  }

  return createPortal(
    <div style={{ position:'fixed', top:0, right:0, bottom:0, left:0, background:'rgba(0,0,0,0.55)', backdropFilter:'blur(6px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:16 }}
      onClick={onClose}>
      <div style={{ background:'var(--card)', borderRadius:20, width:'100%', maxWidth:640, maxHeight:'85vh', border:'1px solid var(--border)', overflow:'hidden', display:'flex', flexDirection:'column', animation:'slideUp 0.2s ease' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ padding:'18px 22px', borderBottom:'1px solid var(--border)', background:'#FDF6E3', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:38, height:38, borderRadius:11, background:'linear-gradient(135deg,#B8860B,#D4A017)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 3px 10px rgba(184,134,11,0.3)' }}>
              <UploadCloud size={17} color="white"/>
            </div>
            <div>
              <div style={{ fontWeight:800, fontSize:15, color:'#1A1612' }}>Bulk Upload Employees</div>
              <div style={{ fontSize:11, color:'#A89880', marginTop:1 }}>Add many employees (DAs or Packers) from a CSV file</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(184,134,11,0.1)', border:'1px solid #F0D78C', cursor:'pointer', color:'#B8860B', display:'flex', padding:6, borderRadius:'50%' }}><X size={16}/></button>
        </div>

        <div style={{ padding:'20px 22px', display:'flex', flexDirection:'column', gap:14, overflowY:'auto', flex:1 }}>
          {err && (
            <div style={{ background:'#FEF2F2', border:'1px solid #FCA5A5', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#DC2626', display:'flex', gap:8, alignItems:'center' }}>
              <AlertCircle size={14}/> {err}
            </div>
          )}

          {result ? (
            <div style={{ textAlign:'center', padding:'20px 10px' }}>
              <div style={{ width:52, height:52, borderRadius:'50%', background:'#ECFDF5', border:'1px solid #A7F3D0', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px' }}>
                <Check size={24} color="#22C55E"/>
              </div>
              <div style={{ fontWeight:800, fontSize:16, color:'var(--text)', marginBottom:6 }}>{result.created} DA{result.created!==1?'s':''} added</div>
              {result.skipped > 0 && <div style={{ fontSize:12.5, color:'var(--text-muted)' }}>{result.skipped} row{result.skipped!==1?'s':''} skipped</div>}
              {result.failures?.length > 0 && (
                <div style={{ marginTop:12, textAlign:'left', maxHeight:160, overflowY:'auto', border:'1px solid var(--border)', borderRadius:10 }}>
                  {result.failures.map((f,i) => (
                    <div key={i} style={{ padding:'7px 12px', fontSize:11.5, color:'#DC2626', borderTop: i>0?'1px solid var(--border)':'none' }}>
                      Row {f.row}: {f.reason}
                    </div>
                  ))}
                </div>
              )}
              <button onClick={onSave} className="btn btn-primary" style={{ marginTop:16 }}>Done</button>
            </div>
          ) : (
            <>
              <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
                <button onClick={downloadTemplate} type="button"
                  style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 14px', borderRadius:10, border:'1px solid var(--border)', background:'var(--bg-alt)', color:'var(--text)', fontWeight:600, fontSize:12.5, cursor:'pointer', fontFamily:'inherit' }}>
                  <Download size={13}/> Download Template
                </button>
                <label style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 14px', borderRadius:10, border:'1px solid rgba(184,134,11,0.5)', background:'rgba(184,134,11,0.15)', color:'#B8860B', fontWeight:700, fontSize:12.5, cursor:'pointer' }}>
                  <UploadCloud size={13}/> Choose CSV File
                  <input type="file" accept=".csv" onChange={handleFile} style={{ display:'none' }}/>
                </label>
                {fileName && <span style={{ fontSize:11.5, color:'var(--text-muted)' }}>{fileName}</span>}
              </div>

              {rows.length > 0 && (
                <div style={{ border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
                  <div style={{ padding:'9px 14px', background:'var(--bg-alt)', fontSize:11.5, fontWeight:700, color:'var(--text-muted)', display:'flex', justifyContent:'space-between' }}>
                    <span>{rows.length} row{rows.length!==1?'s':''} parsed</span>
                    <span style={{ color: validRows.length===rows.length ? '#22C55E' : '#D97706' }}>{validRows.length} valid</span>
                  </div>
                  <div style={{ maxHeight:240, overflowY:'auto' }}>
                    {rows.map((r,i) => (
                      <div key={i} title={r.errors.join(', ')}
                        style={{ display:'flex', gap:10, alignItems:'center', padding:'8px 14px', borderTop:'1px solid var(--border)', fontSize:12, background: r.errors.length ? '#FEF2F2' : 'transparent' }}>
                        <span style={{ width:26, color:'var(--text-muted)', flexShrink:0 }}>#{r.row}</span>
                        <span style={{ flex:1, minWidth:0, color:'var(--text)', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.name || '—'}</span>
                        <span style={{ width:130, color:'var(--text-muted)', flexShrink:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.phone || '—'}</span>
                        {r.errors.length > 0 && <AlertCircle size={12} color="#DC2626" style={{ flexShrink:0 }}/>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={handleUpload} disabled={uploading || !validRows.length}
                style={{ padding:'13px', borderRadius:12, border:'none', cursor:(uploading||!validRows.length)?'not-allowed':'pointer', background:(uploading||!validRows.length)?'var(--border)':'linear-gradient(135deg,#B8860B,#D4A017)', color:(uploading||!validRows.length)?'var(--text-muted)':'white', fontWeight:700, fontSize:14, fontFamily:'Poppins,sans-serif', marginTop:4, transition:'all 0.2s' }}>
                {uploading ? 'Uploading…' : validRows.length ? `Upload ${validRows.length} DA${validRows.length!==1?'s':''}` : 'Choose a file to continue'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

/* ── Employee Card ───────────────────────────────────────────── */
function EmpCard({ emp, onEdit, onDelete, index, userRole, isProjectScoped }) {
  const s        = STATUS[emp.status] || STATUS.inactive
  const sc       = SC_COLOR[emp.station_code] || '#B8860B'
  const exp      = expiry(emp.visa_expiry)
  const hasAlert = exp && (exp.label === 'Expired' || parseInt(exp.label) <= 60)
  const pct      = profileCompletion(emp)
  const isOwn    = (emp.visa_type || 'company') === 'own'
  const isClient = isClientProject(emp.project_type)

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
            {isClient ? (
              <span style={{ fontWeight:700, color:'#7C3AED' }}>{projectLabel(emp.project_type)}</span>
            ) : (
              <>
                <span style={{ fontWeight:700, color:sc }}>{emp.station_code || '—'}</span>
                {emp.project_type && <>· {projectLabel(emp.project_type)}</>}
              </>
            )}
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
        {(['admin','accountant'].includes(userRole) || isProjectScoped) && (
          <div style={{ display:'flex', gap:4, flexShrink:0 }}>
            <button onClick={e=>{e.preventDefault();e.stopPropagation();onEdit(emp)}}
              style={{ width:30, height:30, borderRadius:8, background:'var(--bg-alt)', border:'1px solid var(--border)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-sub)' }}>
              <Pencil size={11}/>
            </button>
            {(userRole === 'admin' || isProjectScoped) && (
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
  const { user } = useAuth()
  const [allEmployees, setAllEmployees] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [category,     setCategory]     = useState('amazon')
  const [filterValue,  setFilterValue]  = useState('All')
  const [filterTab,    setFilterTab]    = useState('all')
  const [modal,        setModal]        = useState(null)
  const [bulkOpen,     setBulkOpen]     = useState(false)
  const [userRole,     setUserRole]     = useState(null)

  useEffect(() => {
    try { const t=localStorage.getItem('gcd_token'); if(t){const p=JSON.parse(atob(t.split('.')[1]));setUserRole(p.role)} } catch(e){}
  }, [])

  // A manager scoped to specific non-Amazon client projects (assigned_projects set)
  // has no use for the DDB1/DXE6 Amazon-station toggle — show their actual projects
  // instead, filtering by project_type rather than station_code. Amazon and client
  // projects are otherwise unrelated programs, so an unscoped viewer (admin/HR) gets
  // an explicit category toggle instead of one flat 180-DA list mixing both.
  const isProjectScoped = Array.isArray(user?.assigned_projects) && user.assigned_projects.length > 0
  const filterOptions = isProjectScoped
    ? user.assigned_projects
    : (category === 'client' ? CLIENT_PROJECTS : ['DDB1','DXE6'])
  // A scoped manager's own projects are always client projects — treat her the
  // same as the "Other Projects" toggle for pill labels/colors.
  const isClientView = isProjectScoped || category === 'client'

  function setCategoryAndReset(c) { setCategory(c); setFilterValue('All') }

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

  // Category split only applies for the unscoped (admin/HR) view — a scoped manager's
  // /api/employees list is already server-side filtered to just their own projects.
  const categoryEmps = useMemo(() => {
    if (isProjectScoped) return allEmployees
    return category === 'client'
      ? allEmployees.filter(e => isClientProject(e.project_type))
      : allEmployees.filter(e => !isClientProject(e.project_type))
  }, [allEmployees, category, isProjectScoped])

  const stationEmps = useMemo(() => {
    if (filterValue==='All') return categoryEmps
    return (isProjectScoped || category === 'client')
      ? categoryEmps.filter(e=>e.project_type===filterValue)
      : categoryEmps.filter(e=>e.station_code===filterValue)
  }, [categoryEmps, filterValue, isProjectScoped, category])

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

        <PageHero icon={Users} title="Employees" subtitle="Delivery Associates & Packers — assignments & profiles"
          actions={<>
            {!isProjectScoped && (
              <div style={{ display:'flex', gap:3, background:'rgba(255,255,255,0.06)', borderRadius:24, padding:3 }}>
                {[{id:'amazon',label:'Amazon'},{id:'client',label:'Other Projects'}].map(c => (
                  <button key={c.id} onClick={()=>setCategoryAndReset(c.id)}
                    style={{ padding:'6px 14px', borderRadius:20, border:'none', cursor:'pointer', fontFamily:'inherit', fontWeight:700, fontSize:12, whiteSpace:'nowrap', transition:'all var(--t-fast)',
                      background: category===c.id ? (c.id==='client'?'#7C3AED':'#3B82F6') : 'transparent',
                      color: category===c.id ? 'white' : 'rgba(255,255,255,0.55)',
                    }}>
                    {c.label}
                  </button>
                ))}
              </div>
            )}
            <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
              {filterOptions.map(opt => (
                <button key={opt} onClick={()=>setFilterValue(filterValue===opt?'All':opt)}
                  style={{ padding:'5px 14px', borderRadius:20, border:'none', cursor:'pointer', fontFamily:'inherit', fontWeight:700, fontSize:12, transition:'all var(--t-fast)', whiteSpace:'nowrap',
                    background: filterValue===opt ? (isClientView?'#7C3AED':'#3B82F6') : 'rgba(255,255,255,0.08)',
                    color: filterValue===opt ? 'white' : 'rgba(255,255,255,0.55)',
                    boxShadow: filterValue===opt ? `0 2px 8px ${isClientView?'rgba(124,58,237,0.4)':'rgba(59,130,246,0.4)'}` : 'none',
                  }}>
                  {isClientView ? projectLabel(opt) : opt}
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
              { label:'Total Employees', val:loading?'—':categoryEmps.length, color:'#B8860B' },
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
          {(['admin','accountant'].includes(userRole) || isProjectScoped) && (
            <>
              <button onClick={()=>setBulkOpen(true)}
                style={{ display:'flex', alignItems:'center', gap:7, padding:'10px 16px', borderRadius:10, border:'1px solid var(--border)', background:'var(--card)', color:'var(--text)', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit', flexShrink:0, whiteSpace:'nowrap' }}>
                <UploadCloud size={14}/> Bulk Upload
              </button>
              <button onClick={()=>setModal({mode:'add',emp:null})}
                style={{ display:'flex', alignItems:'center', gap:7, padding:'10px 18px', borderRadius:10, border:'none', background:'#B8860B', color:'white', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit', flexShrink:0, whiteSpace:'nowrap', transition:'background var(--t-fast)' }}
                onMouseEnter={e=>e.currentTarget.style.background='#9a7209'}
                onMouseLeave={e=>e.currentTarget.style.background='#B8860B'}>
                <Plus size={14}/> Add Employee
              </button>
            </>
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
            <div style={{ fontWeight:700, fontSize:15, color:'var(--text-sub)' }}>{search?`No results for "${search}"`:'No employees found'}</div>
          </div>
        ) : (
          <div className="da-grid">
            {employees.map((emp,i)=>(
              <EmpCard key={emp.id} emp={emp} index={i}
                onEdit={e=>router.push(`/dashboard/hr/employees/${e.id}/edit`)}
                onDelete={handleDelete}
                userRole={userRole}
                isProjectScoped={isProjectScoped}/>
            ))}
          </div>
        )}
      </div>

      {modal && <EmpModal key={`${modal.mode}-${modal.emp?.id||'new'}`} mode={modal.mode} emp={modal.emp} onClose={()=>setModal(null)} onSave={()=>{setModal(null);load()}}/>}
      {bulkOpen && (
        <BulkUploadModal isProjectScoped={isProjectScoped} defaultProject={isProjectScoped ? user.assigned_projects[0] : 'pulser'}
          onClose={()=>setBulkOpen(false)} onSave={()=>{setBulkOpen(false);load()}}/>
      )}
    </>
  )
}
