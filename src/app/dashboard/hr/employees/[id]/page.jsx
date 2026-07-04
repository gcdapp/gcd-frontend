'use client'
import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { empApi, payrollApi, API } from '@/lib/api'
import {
  Phone, Mail, Calendar, Building2, Briefcase, CreditCard, Shield, User,
  Truck, ArrowLeftRight, Receipt, ExternalLink, X, AlertTriangle, Wallet,
  TrendingUp, FileText, Clock, ChevronLeft, Pencil, FolderOpen, Banknote, MapPin
} from 'lucide-react'
import { differenceInDays, parseISO } from 'date-fns'

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
function hdr() { return { Authorization:`Bearer ${localStorage.getItem('gcd_token')}` } }

/* ── Work Number Assigner (moved from hr/employees/page.jsx) ─────────── */
function WorkNumberAssigner({ emp, onSaved, userRole, onSelectEmployee }) {
  const [mode,    setMode]    = useState('view') // 'view' | 'pick'
  const [sims,    setSims]    = useState([])
  const [loading, setLoading] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [conflict,setConflict]= useState(null)   // { conflictEmpId, conflictEmpName }
  const [step,    setStep]    = useState(0)       // 0 | 1 | 2
  const [pending, setPending] = useState('')
  const [history, setHistory] = useState(null)   // null = hidden, [] = loaded
  const [hLoad,   setHLoad]   = useState(false)

  const canEdit = ['admin','manager','general_manager','hr','poc'].includes(userRole)

  function reset() { setMode('view'); setStep(0); setConflict(null); setPending(''); setSims([]) }

  async function openPicker() {
    setMode('pick'); setLoading(true)
    try {
      const r = await fetch(`${API}/api/sims`, { headers: hdr() })
      const d = await r.json()
      setSims((d.sims||[]).filter(s => s.phone_number && (s.status==='available' || s.emp_id===emp.id)))
    } catch(e) {} finally { setLoading(false) }
  }

  async function tryAssign(phoneNumber, force=false) {
    setSaving(true)
    try {
      const r = await fetch(`${API}/api/employees/${emp.id}/assign-work-number`, {
        method:'POST', headers:{ ...hdr(), 'Content-Type':'application/json' },
        body: JSON.stringify({ phone_number: phoneNumber, force })
      })
      const d = await r.json()
      if (d.conflict) {
        setPending(phoneNumber)
        setConflict({ conflictEmpId: d.conflictEmpId, conflictEmpName: d.conflictEmpName })
        setStep(1)
      } else if (d.ok) { reset(); onSaved?.() }
      else if (d.error) { alert(d.error); reset() }
    } catch(e) {} finally { setSaving(false) }
  }

  async function handleRemove() {
    if (!confirm('Remove work number from this employee?')) return
    setSaving(true)
    try {
      await fetch(`${API}/api/employees/${emp.id}/work-number`, { method:'DELETE', headers:hdr() })
      onSaved?.()
    } catch(e) {} finally { setSaving(false) }
  }

  async function openHistory() {
    setHLoad(true); setHistory([])
    try {
      const r = await fetch(`${API}/api/employees/work-number/history?emp_id=${emp.id}`, { headers: hdr() })
      const d = await r.json()
      setHistory(d.history||[])
    } catch(e) { setHistory([]) } finally { setHLoad(false) }
  }

  const ACTION_COLOR = { assigned:'#10B981', reassigned:'#F59E0B', removed:'#EF4444' }
  const ACTION_BG    = { assigned:'#F0FDF4', reassigned:'#FFFBEB', removed:'#FEF2F2' }

  return (
    <div style={{ background:'var(--bg-alt)', borderRadius:10, padding:'10px 12px', marginBottom:10, border:'1px solid var(--border)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
        <div style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.07em' }}>Work Number</div>
        {canEdit && emp.work_number && (
          <button onClick={history===null ? openHistory : ()=>setHistory(null)}
            style={{ fontSize:10, color:'var(--text-muted)', background:'none', border:'none', cursor:'pointer', padding:0, fontFamily:'Poppins,sans-serif', textDecoration:'underline' }}>
            {history===null ? 'History' : 'Hide'}
          </button>
        )}
      </div>

      {step===1 && conflict && (
        <div style={{ background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:9, padding:'10px 12px', fontSize:12 }}>
          <div style={{ fontWeight:600, color:'#92400E', marginBottom:8 }}>
            ⚠️ <strong>{pending}</strong> is already assigned to <strong>{conflict.conflictEmpName}</strong>. Proceed?
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={()=>setStep(2)} style={{ flex:1, padding:'6px', borderRadius:100, background:'#B8860B', color:'white', border:'none', cursor:'pointer', fontSize:11, fontWeight:700, fontFamily:'Poppins,sans-serif' }}>Yes, proceed</button>
            <button onClick={reset} style={{ flex:1, padding:'6px', borderRadius:100, background:'var(--card)', color:'var(--text-sub)', border:'1px solid var(--border)', cursor:'pointer', fontSize:11, fontFamily:'Poppins,sans-serif' }}>Cancel</button>
          </div>
        </div>
      )}

      {step===2 && conflict && (
        <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:9, padding:'10px 12px', fontSize:12 }}>
          <div style={{ fontWeight:600, color:'#7F1D1D', marginBottom:8 }}>
            Assign a new number to <strong>{conflict.conflictEmpName}</strong>?
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={()=>{ tryAssign(pending,true); onSelectEmployee?.(conflict.conflictEmpId) }}
              disabled={saving}
              style={{ flex:1, padding:'6px', borderRadius:7, background:'#10B981', color:'white', border:'none', cursor:'pointer', fontSize:11, fontWeight:700, fontFamily:'Poppins,sans-serif' }}>
              Yes, reassign them
            </button>
            <button onClick={()=>tryAssign(pending,true)} disabled={saving}
              style={{ flex:1, padding:'6px', borderRadius:7, background:'#EF4444', color:'white', border:'none', cursor:'pointer', fontSize:11, fontWeight:700, fontFamily:'Poppins,sans-serif' }}>
              {saving?'…':'No, just remove it'}
            </button>
          </div>
        </div>
      )}

      {step===0 && mode==='view' && (
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:13, fontWeight:700, color:emp.work_number?'var(--text)':'var(--text-muted)', fontFamily:'inherit' }}>
            {emp.work_number||'Not assigned'}
          </span>
          {canEdit && (
            <div style={{ display:'flex', gap:5 }}>
              <button onClick={openPicker} style={{ padding:'4px 10px', borderRadius:100, background:'var(--card)', border:'1px solid var(--border)', color:'var(--text-sub)', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'Poppins,sans-serif', display:'flex', alignItems:'center', gap:4 }}>
                <Phone size={10}/> {emp.work_number?'Change':'Assign'}
              </button>
              {emp.work_number && (
                <button onClick={handleRemove} disabled={saving} style={{ padding:'4px 8px', borderRadius:100, background:'var(--red-bg)', border:'1px solid var(--red-border)', color:'var(--red)', cursor:'pointer', display:'flex', alignItems:'center' }}>
                  <X size={10}/>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {step===0 && mode==='pick' && (
        <div>
          {loading ? (
            <div style={{ fontSize:12, color:'var(--text-muted)', textAlign:'center', padding:'10px 0' }}>Loading SIMs…</div>
          ) : sims.length===0 ? (
            <div style={{ fontSize:12, color:'var(--text-muted)', textAlign:'center', padding:'10px 0' }}>No available SIM numbers</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:5, maxHeight:180, overflowY:'auto', marginBottom:8 }}>
              {sims.map(s => (
                <button key={s.id} onClick={()=>tryAssign(s.phone_number)} disabled={saving}
                  style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 10px', borderRadius:8,
                    background: s.emp_id===emp.id ? 'var(--green-bg)' : 'var(--card)',
                    border: `1px solid ${s.emp_id===emp.id ? 'var(--green)' : 'var(--border)'}`,
                    cursor:'pointer', textAlign:'left', fontFamily:'Poppins,sans-serif' }}>
                  <span style={{ fontSize:13, fontWeight:700, fontFamily:'inherit', color:'var(--text)' }}>{s.phone_number}</span>
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    {s.emp_id===emp.id && <span style={{ fontSize:10, color:'var(--green)', fontWeight:700 }}>Current</span>}
                    <span style={{ fontSize:10, color:'var(--text-muted)' }}>{s.carrier}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
          <button onClick={reset} style={{ width:'100%', padding:'6px', borderRadius:100, background:'var(--bg-alt)', border:'1px solid var(--border)', color:'var(--text-sub)', cursor:'pointer', fontSize:11, fontFamily:'Poppins,sans-serif' }}>Cancel</button>
        </div>
      )}

      {history !== null && (
        <div style={{ marginTop:10, borderTop:'1px solid var(--border)', paddingTop:10 }}>
          {hLoad ? (
            <div style={{ fontSize:11, color:'var(--text-muted)', textAlign:'center' }}>Loading…</div>
          ) : history.length===0 ? (
            <div style={{ fontSize:11, color:'var(--text-muted)', textAlign:'center' }}>No history yet</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:5, maxHeight:160, overflowY:'auto' }}>
              {history.map(h => (
                <div key={h.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 8px', borderRadius:7, background:'var(--card)', border:'1px solid var(--border)' }}>
                  <div>
                    <span style={{ fontSize:10, fontWeight:700, color:ACTION_COLOR[h.action], background:ACTION_BG[h.action], borderRadius:4, padding:'1px 6px', marginRight:6, textTransform:'capitalize' }}>{h.action}</span>
                    <span style={{ fontSize:11, fontFamily:'inherit', color:'var(--text)' }}>{h.phone_number}</span>
                  </div>
                  <span style={{ fontSize:10, color:'var(--text-muted)' }}>{new Date(h.performed_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Driver Dashboard page ─────────────────────────────────────────── */
export default function DriverDashboardPage() {
  const { id } = useParams()
  const router = useRouter()

  const [emp,        setEmp]        = useState(null)
  const [loading,     setLoading]    = useState(true)
  const [userRole,    setUserRole]   = useState(null)
  const [leaves,      setLeaves]     = useState([])
  const [leavesLoad,  setLeavesLoad] = useState(true)
  const [expenses,    setExpenses]   = useState([])
  const [expLoad,     setExpLoad]    = useState(false)
  const [fleetHv,     setFleetHv]    = useState([])
  const [fleetAsgn,   setFleetAsgn]  = useState([])
  const [fleetLoad,   setFleetLoad]  = useState(false)
  const [attendance,  setAttendance] = useState([])
  const [attLoad,     setAttLoad]    = useState(false)
  const [salarySnap,  setSalarySnap] = useState(null)
  const [salaryLoad,  setSalaryLoad] = useState(false)
  const [tab,         setTab]        = useState('overview')
  const [isMobile,    setIsMobile]   = useState(false)

  const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('gcd_token')}` })

  useEffect(() => {
    try { const t=localStorage.getItem('gcd_token'); if(t){const p=JSON.parse(atob(t.split('.')[1]));setUserRole(p.role)} } catch(e){}
  }, [])

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900)
    check(); window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  function loadEmp() {
    setLoading(true)
    empApi.get(id).then(d => setEmp(d.employee)).catch(() => setEmp(null)).finally(() => setLoading(false))
  }
  useEffect(() => { loadEmp() }, [id])

  useEffect(() => {
    setLeavesLoad(true)
    fetch(`${API}/api/leaves?emp_id=${id}&stage=all`, { headers: auth() })
      .then(r => r.json()).then(d => setLeaves(d.leaves || [])).catch(() => setLeaves([])).finally(() => setLeavesLoad(false))
  }, [id])

  useEffect(() => {
    setAttLoad(true)
    const month = new Date().toISOString().slice(0, 7)
    fetch(`${API}/api/attendance?emp_id=${id}&month=${month}`, { headers: auth() })
      .then(r => r.json()).then(d => setAttendance(d.records || d.attendance || [])).catch(() => setAttendance([])).finally(() => setAttLoad(false))
  }, [id])

  useEffect(() => {
    if (tab !== 'expenses') return
    setExpLoad(true)
    fetch(`${API}/api/expenses?emp_id=${id}`, { headers: auth() })
      .then(r => r.json()).then(d => setExpenses(d.expenses || [])).catch(() => setExpenses([])).finally(() => setExpLoad(false))
  }, [tab, id])

  useEffect(() => {
    if (tab !== 'fleet') return
    setFleetLoad(true)
    Promise.all([
      fetch(`${API}/api/handovers?emp_id=${id}`, { headers: auth() }).then(r => r.json()).catch(() => ({ handovers: [] })),
      fetch(`${API}/api/vehicles/assignments/history?emp_id=${id}`, { headers: auth() }).then(r => r.json()).catch(() => ({ history: [] })),
    ]).then(([hv, asgn]) => { setFleetHv(hv.handovers || []); setFleetAsgn(asgn.history || []) }).finally(() => setFleetLoad(false))
  }, [tab, id])

  useEffect(() => {
    if (tab !== 'salary') return
    setSalaryLoad(true)
    const month = new Date().toISOString().slice(0, 7)
    payrollApi.list({ emp_id: id, month }).then(d => setSalarySnap((d.payroll || [])[0] || null)).catch(() => setSalarySnap(null)).finally(() => setSalaryLoad(false))
  }, [tab, id])

  if (loading) {
    return <div style={{ padding:40, textAlign:'center', color:'var(--text-muted)' }}>Loading driver profile…</div>
  }
  if (!emp) {
    return (
      <div style={{ padding:40, textAlign:'center' }}>
        <div style={{ fontSize:14, color:'var(--text-muted)', marginBottom:12 }}>Driver not found.</div>
        <button onClick={()=>router.push('/dashboard/hr/employees')} className="btn btn-secondary">Back to DAs</button>
      </div>
    )
  }

  const s           = STATUS[emp.status] || STATUS.inactive
  const sc          = SC_COLOR[emp.station_code]  || '#B8860B'
  const serviceDays = emp.joined ? differenceInDays(new Date(), parseISO(emp.joined.slice(0,10))) : 0
  const serviceYrs  = Math.floor(serviceDays / 365)
  const serviceMos  = Math.floor((serviceDays % 365) / 30)
  const serviceStr  = serviceYrs > 0 ? `${serviceYrs}yr ${serviceMos}mo` : serviceDays > 30 ? `${Math.floor(serviceDays/30)}mo` : `${serviceDays}d`
  const today       = new Date().toISOString().slice(0, 10)
  const onLeaveNow  = leaves.filter(l => l.status === 'approved' && l.from_date <= today && l.to_date >= today).length
  const usedByType  = type => leaves.filter(l => l.type === type && l.status === 'approved').reduce((a, l) => a + (l.days || 0), 0)
  const usedAnnual  = usedByType('Annual')
  const curVehicle  = fleetHv.find(h => h.type === 'received' && !fleetHv.find(h2 => h2.vehicle_id === h.vehicle_id && h2.type === 'returned' && new Date(h2.submitted_at) > new Date(h.submitted_at)))

  function docDays(d) {
    if (!d) return null
    try { return differenceInDays(parseISO(d.slice(0,10)), new Date()) } catch { return null }
  }
  function docChip(d) {
    const days = docDays(d)
    if (days === null) return null
    if (days < 0)   return { label:'Expired',       c:'#DC2626', bg:'#FEF2F2', bc:'#FECACA' }
    if (days <= 30) return { label:`${days}d left`, c:'#DC2626', bg:'#FEF2F2', bc:'#FECACA' }
    if (days <= 90) return { label:`${days}d left`, c:'#D97706', bg:'#FFFBEB', bc:'#FDE68A' }
    return              { label:'Valid',             c:'#059669', bg:'#F0FDF4', bc:'#A7F3D0' }
  }
  const alertCount = [emp.visa_expiry, emp.license_expiry, emp.iloe_expiry].filter(d => { const n = docDays(d); return n !== null && n <= 30 }).length
  const attPresent = attendance.filter(a => a.status === 'present').length
  const attAbsent  = attendance.filter(a => a.status === 'absent').length
  const attLeave   = attendance.filter(a => a.status === 'leave').length

  const TABS = [
    { id:'overview',  l:'Overview'  },
    { id:'leaves',    l:`Leaves${leaves.length ? ` (${leaves.length})` : ''}` },
    { id:'sims',      l:'SIMs'      },
    { id:'fleet',     l:'Fleet'     },
    { id:'documents', l:'Documents' },
    { id:'expenses',  l:'Expenses'  },
    { id:'salary',    l:'Salary'    },
  ]

  function Section({ title, icon: SIcon, children }) {
    return (
      <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
        <div style={{ padding:'9px 16px', borderBottom:'1px solid var(--border)', background:'var(--bg-alt)', display:'flex', alignItems:'center', gap:7 }}>
          {SIcon && <SIcon size={11} color="var(--text-muted)"/>}
          <span style={{ fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.09em', color:'var(--text-muted)' }}>{title}</span>
        </div>
        <div>{children}</div>
      </div>
    )
  }
  function InfoRow({ icon: Icon, label, value, href, mono, accent }) {
    const val = typeof value === 'object' ? JSON.stringify(value) : value
    const display = href && val
      ? <a href={href} style={{ fontSize:13, fontWeight:600, color:'#B8860B', textDecoration:'none', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{val}</a>
      : <span style={{ fontSize:13, fontWeight:600, color: val ? (accent||'var(--text)') : 'var(--text-muted)', fontFamily: mono ? 'monospace' : 'inherit', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{val || '—'}</span>
    return (
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 16px', borderBottom:'1px solid var(--border)' }}>
        <div style={{ width:30, height:30, borderRadius:9, background:'var(--bg-alt)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          {Icon && <Icon size={13} color="var(--text-muted)"/>}
        </div>
        <span style={{ fontSize:12, color:'var(--text-muted)', minWidth:90, flexShrink:0 }}>{label}</span>
        <div style={{ flex:1, minWidth:0 }}>{display}</div>
      </div>
    )
  }
  function DocRow({ label, date }) {
    const chip = docChip(date)
    const days = docDays(date)
    return (
      <div style={{ display:'flex', alignItems:'center', padding:'12px 16px', borderBottom:'1px solid var(--border)', gap:10 }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{label}</div>
          <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{date ? date.slice(0,10) : 'Not on file'}</div>
        </div>
        {chip
          ? <span style={{ fontSize:11, fontWeight:700, color:chip.c, background:chip.bg, border:`1px solid ${chip.bc}`, borderRadius:99, padding:'3px 12px', flexShrink:0 }}>
              {days !== null && days < 0 ? 'Expired' : chip.label}
            </span>
          : <span style={{ fontSize:11, color:'var(--text-muted)', padding:'3px 12px' }}>—</span>}
      </div>
    )
  }
  function QuickLink({ icon: Icon, label, onClick, color }) {
    return (
      <button onClick={onClick} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:7, padding:'11px 14px', borderRadius:12, background:'var(--card)', border:'1px solid var(--border)', color:color||'var(--text)', fontWeight:700, fontSize:12.5, cursor:'pointer', fontFamily:'Poppins,sans-serif' }}>
        <Icon size={14}/> {label}
      </button>
    )
  }

  const netSnap = salarySnap ? Number(salarySnap.net_pay || (Number(salarySnap.base_salary||0) + Number(salarySnap.bonus_total||0) - Number(salarySnap.deduction_total||0))) : null

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14, fontFamily:'Poppins,sans-serif', animation:'slideUp 0.3s ease' }}>

      <button onClick={()=>router.push('/dashboard/hr/employees')}
        style={{ display:'flex', alignItems:'center', gap:6, alignSelf:'flex-start', background:'none', border:'none', color:'var(--text-muted)', fontSize:12.5, fontWeight:600, cursor:'pointer', padding:0, fontFamily:'inherit' }}>
        <ChevronLeft size={14}/> Back to DAs
      </button>

      <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:18, overflow:'hidden' }}>

        {/* Hero header */}
        <div style={{ background:'linear-gradient(135deg,#0f1623 0%,#1a2535 55%,#1e3a5f 100%)', padding:'20px 22px 18px' }}>
          <div style={{ display:'flex', alignItems:'flex-start', gap:14, marginBottom:16 }}>
            <div style={{ position:'relative', flexShrink:0 }}>
              <div style={{ width:58, height:58, borderRadius:16, background:`linear-gradient(145deg,${sc}30,${sc}60)`, border:`2px solid ${sc}60`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:900, color:'white', letterSpacing:'-0.02em', boxShadow:`0 6px 20px ${sc}35` }}>
                {emp.name?.slice(0,2).toUpperCase()}
              </div>
              <div style={{ position:'absolute', bottom:-2, right:-2, width:14, height:14, borderRadius:'50%', background:s.dot, border:'2.5px solid #0f1623', boxShadow:'0 1px 4px rgba(0,0,0,0.4)' }}/>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap' }}>
                <h2 style={{ margin:0, fontSize:18, fontWeight:900, color:'white', letterSpacing:'-0.03em', lineHeight:1.2 }}>{emp.name}</h2>
                <span style={{ fontSize:10, fontWeight:700, color:s.c, background:`${s.c}22`, border:`1px solid ${s.c}50`, borderRadius:99, padding:'2px 9px' }}>{s.l}</span>
              </div>
              <div style={{ fontSize:11.5, color:'rgba(255,255,255,0.45)', marginBottom:8 }}>
                {emp.role} · {emp.station_code||'DDB1'} · <span style={{ fontFamily:'monospace', fontSize:10.5 }}>#{emp.id}</span>
              </div>
              <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                {emp.project_type && <span style={{ fontSize:10, fontWeight:700, color:'#A78BFA', background:'rgba(139,92,246,0.15)', border:'1px solid rgba(139,92,246,0.3)', borderRadius:99, padding:'2px 8px' }}>{projectLabel(emp.project_type).toUpperCase()}</span>}
                {emp.visa_type && <span style={{ fontSize:10, fontWeight:600, color:emp.visa_type==='own'?'#60A5FA':'#34D399', background:emp.visa_type==='own'?'rgba(96,165,250,0.12)':'rgba(52,211,153,0.12)', border:`1px solid ${emp.visa_type==='own'?'rgba(96,165,250,0.3)':'rgba(52,211,153,0.3)'}`, borderRadius:99, padding:'2px 8px' }}>{emp.visa_type==='own'?'Own Visa':'Co. Visa'}</span>}
                {serviceDays > 0 && <span style={{ fontSize:10, color:'rgba(255,255,255,0.4)', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:99, padding:'2px 8px' }}>{serviceStr}</span>}
              </div>
            </div>
            {userRole !== 'accountant' && (
              <button onClick={()=>router.push(`/dashboard/hr/employees/${id}/edit`)} style={{ padding:'8px 18px', borderRadius:10, background:'#B8860B', color:'white', fontWeight:700, fontSize:12.5, border:'none', cursor:'pointer', fontFamily:'Poppins,sans-serif', boxShadow:'0 2px 10px rgba(184,134,11,0.4)', display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                <Pencil size={12}/> Edit
              </button>
            )}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
            {[
              { label:'Service',    v: serviceDays > 0 ? serviceStr : '—',                                             sub: emp.joined ? emp.joined.slice(0,10) : 'No join date',   c:'#60A5FA' },
              { label:'Status',     v: onLeaveNow > 0 ? 'On Leave' : s.l,                                              sub: onLeaveNow > 0 ? 'Currently away' : 'Working',           c: onLeaveNow>0?'#FBBF24':s.dot },
              { label:'Leave Used', v: leavesLoad ? '…' : `${usedAnnual}d`,                                            sub: leavesLoad ? '' : `${Math.max(0,30-usedAnnual)}d left`,  c:'#A78BFA' },
              { label:'Documents',  v: alertCount > 0 ? `${alertCount} Alert${alertCount>1?'s':''}` : 'All OK',        sub: alertCount > 0 ? 'Needs renewal' : 'Up to date',         c: alertCount>0?'#F87171':'#34D399' },
            ].map(m => (
              <div key={m.label} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, padding:'12px 14px' }}>
                <div style={{ fontSize:16, fontWeight:900, color:m.c, letterSpacing:'-0.03em', lineHeight:1, marginBottom:4 }}>{m.v}</div>
                <div style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'0.07em' }}>{m.label}</div>
                <div style={{ fontSize:9.5, color:m.c, opacity:0.7, marginTop:3 }}>{m.sub}</div>
              </div>
            ))}
          </div>

          {alertCount > 0 && (
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 13px', background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:10, marginTop:12 }}>
              <AlertTriangle size={13} color="#F87171" style={{ flexShrink:0 }}/>
              <span style={{ fontSize:12, fontWeight:700, color:'#F87171' }}>
                {[emp.visa_expiry && docDays(emp.visa_expiry) !== null && docDays(emp.visa_expiry) <= 30 && 'Visa',
                  emp.license_expiry && docDays(emp.license_expiry) !== null && docDays(emp.license_expiry) <= 30 && 'License',
                  emp.iloe_expiry && docDays(emp.iloe_expiry) !== null && docDays(emp.iloe_expiry) <= 30 && 'ILOE',
                ].filter(Boolean).join(', ')} expiring soon — action required
              </span>
            </div>
          )}
        </div>

        {/* Quick links row */}
        <div style={{ display:'flex', gap:8, padding:'14px 18px', borderBottom:'1px solid var(--border)', flexWrap:'wrap' }}>
          <QuickLink icon={Receipt}    label="Expenses"  color="#DC2626" onClick={()=>router.push(`/dashboard/hr/employees/${id}/expenses`)}/>
          <QuickLink icon={FolderOpen} label="Documents" color="#2563EB" onClick={()=>router.push(`/dashboard/hr/employees/${id}/documents`)}/>
          <QuickLink icon={Banknote}   label="Salary"    color="#059669" onClick={()=>router.push(`/dashboard/hr/employees/${id}/salary`)}/>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', overflowX:'auto', borderBottom:'1px solid var(--border)', background:'var(--card)', scrollbarWidth:'none', padding:'0 4px' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ padding:'11px 16px', fontSize:12.5, fontWeight:tab===t.id?700:500, color:tab===t.id?'#B8860B':'var(--text-muted)', background:'none', border:'none', borderBottom:`2.5px solid ${tab===t.id?'#B8860B':'transparent'}`, cursor:'pointer', fontFamily:'Poppins,sans-serif', marginBottom:-1, whiteSpace:'nowrap', flexShrink:0, transition:'all 0.15s' }}>
              {t.l}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ padding:'16px 18px', display:'flex', flexDirection:'column', gap:12 }}>

          {tab === 'overview' && (<>
            <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 1fr', gap:12 }}>
              <Section title="Contact" icon={Phone}>
                <InfoRow icon={Phone}      label="Mobile"      value={emp.phone}       href={emp.phone?`tel:${emp.phone}`:null}/>
                <InfoRow icon={Phone}      label="Work SIM"    value={emp.work_number} href={emp.work_number?`tel:${emp.work_number}`:null}/>
                <InfoRow icon={Mail}       label="Email"       value={emp.email_id}    href={emp.email_id?`mailto:${emp.email_id}`:null}/>
                <InfoRow icon={CreditCard} label="Passport"    value={emp.passport_no} mono/>
              </Section>
              <Section title="Employment" icon={Briefcase}>
                <InfoRow icon={Building2}  label="Station"     value={emp.station_code}/>
                <InfoRow icon={Briefcase}  label="Project"     value={emp.project_type ? projectLabel(emp.project_type) : null}/>
                <InfoRow icon={Calendar}   label="Join Date"   value={emp.joined?.slice(0,10)}/>
                <InfoRow icon={Wallet}     label="Base Salary" value={emp.salary ? `AED ${Number(emp.salary).toLocaleString('en-US')}` : null} accent="#B8860B"/>
                {emp.project_type==='pulser' && <InfoRow icon={TrendingUp} label="Hourly Rate"  value={emp.hourly_rate?`AED ${emp.hourly_rate}/hr`:null}/>}
                {emp.project_type==='cret'   && <InfoRow icon={TrendingUp} label="Ship. Rate"   value={emp.per_shipment_rate?`AED ${emp.per_shipment_rate}/pkg`:null}/>}
              </Section>
            </div>

            <Section title="Document Expiry" icon={FileText}>
              <DocRow label="UAE Visa"        date={emp.visa_expiry}/>
              <DocRow label="Driving License" date={emp.license_expiry}/>
              <DocRow label="ILOE"            date={emp.iloe_expiry}/>
            </Section>

            <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 1fr', gap:12 }}>
              <Section title="Leave Balance" icon={Calendar}>
                <div style={{ padding:'14px 16px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:7 }}>
                    <span style={{ fontSize:12.5, fontWeight:600, color:'var(--text)' }}>Annual Leave</span>
                    <span style={{ fontSize:11.5, color:'var(--text-muted)', fontWeight:500 }}>{leavesLoad ? '…' : `${usedAnnual} / 30d`}</span>
                  </div>
                  <div style={{ height:8, borderRadius:99, background:'var(--border)', overflow:'hidden' }}>
                    {!leavesLoad && <div style={{ height:'100%', width:`${Math.min(100,(usedAnnual/30)*100)}%`, background:'linear-gradient(90deg,#7C3AEDaa,#7C3AED)', borderRadius:99 }}/>}
                  </div>
                  <div style={{ fontSize:10.5, color:'#7C3AED', marginTop:5, fontWeight:700 }}>
                    {!leavesLoad && `${Math.max(0,30-usedAnnual)} days remaining`}
                  </div>
                </div>
              </Section>
              <Section title="Attendance — This Month" icon={Clock}>
                <div style={{ padding:'14px 16px' }}>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                    {[
                      { l:'Present', v:attPresent, c:'#059669', bg:'#F0FDF4' },
                      { l:'Absent',  v:attAbsent,  c:'#DC2626', bg:'#FEF2F2' },
                      { l:'Leave',   v:attLeave,   c:'#D97706', bg:'#FFFBEB' },
                    ].map(a => (
                      <div key={a.l} style={{ textAlign:'center', padding:'9px 6px', borderRadius:10, background:a.bg, border:'1px solid var(--border)' }}>
                        <div style={{ fontWeight:900, fontSize:20, color:a.c, lineHeight:1 }}>{attLoad?'…':a.v}</div>
                        <div style={{ fontSize:9.5, fontWeight:600, color:a.c, opacity:0.8, marginTop:4 }}>{a.l}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </Section>
            </div>
          </>)}

          {tab === 'leaves' && (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                {[
                  { l:'Total',    v:leaves.length,                                  c:'var(--text)', bg:'var(--bg-alt)' },
                  { l:'Approved', v:leaves.filter(l=>l.status==='approved').length, c:'#059669',     bg:'#F0FDF4'       },
                  { l:'Pending',  v:leaves.filter(l=>l.status==='pending').length,  c:'#D97706',     bg:'#FFFBEB'       },
                ].map(st => (
                  <div key={st.l} style={{ textAlign:'center', padding:'12px 8px', borderRadius:12, background:st.bg, border:'1px solid var(--border)' }}>
                    <div style={{ fontWeight:900, fontSize:22, color:st.c, lineHeight:1 }}>{st.v}</div>
                    <div style={{ fontSize:10, fontWeight:600, color:st.c, opacity:0.8, marginTop:5 }}>{st.l}</div>
                  </div>
                ))}
              </div>
              {leavesLoad
                ? <div style={{ textAlign:'center', padding:'24px', color:'var(--text-muted)', fontSize:13 }}>Loading…</div>
                : leaves.length === 0
                  ? <div style={{ textAlign:'center', padding:'40px 20px' }}>
                      <Calendar size={32} style={{ margin:'0 auto 12px', display:'block', opacity:0.15 }}/>
                      <div style={{ fontSize:13, color:'var(--text-muted)' }}>No leave records</div>
                    </div>
                  : leaves.map(lv => {
                      const TC  = { Annual:'#B8860B', Sick:'#2563EB', Emergency:'#EF4444', Unpaid:'#6B7280', Other:'#9CA3AF' }
                      const SC2 = { approved:'#059669', pending:'#D97706', rejected:'#EF4444' }
                      const SBG = { approved:'#F0FDF4', pending:'#FFFBEB', rejected:'#FEF2F2' }
                      return (
                        <div key={lv.id} style={{ background:'var(--bg-alt)', border:'1px solid var(--border)', borderRadius:12, padding:'12px 14px' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                            <span style={{ fontSize:12.5, fontWeight:700, color:TC[lv.type]||'#9CA3AF' }}>{lv.type}</span>
                            <span style={{ fontSize:11, fontWeight:700, color:SC2[lv.status]||'#9CA3AF', background:SBG[lv.status], borderRadius:99, padding:'2px 10px', border:`1px solid ${SBG[lv.status]}` }}>{lv.status}</span>
                          </div>
                          <div style={{ fontSize:12.5, fontWeight:600, color:'var(--text)', marginBottom:4 }}>{lv.from_date?.slice(0,10)} → {lv.to_date?.slice(0,10)}</div>
                          <div style={{ display:'flex', justifyContent:'space-between' }}>
                            <span style={{ fontSize:11.5, color:'var(--text-muted)' }}>{lv.days} day{lv.days!==1?'s':''}</span>
                            {lv.reason && <span style={{ fontSize:11, color:'var(--text-sub)', maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{lv.reason}</span>}
                          </div>
                        </div>
                      )
                    })
              }
            </div>
          )}

          {tab === 'sims' && (
            <div>
              <WorkNumberAssigner emp={emp} onSaved={loadEmp} userRole={userRole} onSelectEmployee={empId=>router.push(`/dashboard/hr/employees/${empId}`)}/>
              <div style={{ marginTop:10, background:'var(--bg-alt)', border:'1px solid var(--border)', borderRadius:12, padding:'12px 14px' }}>
                <div style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:5 }}>Personal Phone</div>
                <div style={{ fontSize:13.5, fontWeight:700, color:'var(--text)' }}>{emp.phone || '—'}</div>
              </div>
            </div>
          )}

          {tab === 'fleet' && (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {fleetLoad ? (
                [1,2,3].map(i => <div key={i} className="sk" style={{ height:72, borderRadius:12 }}/>)
              ) : (
                <>
                  {curVehicle ? (
                    <div style={{ background:'#F0FDF4', border:'1px solid #A7F3D0', borderRadius:12, padding:'13px 16px' }}>
                      <div style={{ fontSize:9.5, fontWeight:800, color:'#059669', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:9 }}>Current Vehicle</div>
                      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                        <div style={{ width:42, height:42, borderRadius:12, background:'#DCFCE7', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          <Truck size={20} color="#059669"/>
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontWeight:800, fontSize:16, color:'var(--text)', letterSpacing:'-0.02em' }}>{curVehicle.plate || '—'}</div>
                          <div style={{ fontSize:11.5, color:'var(--text-muted)', marginTop:2 }}>Since {new Date(curVehicle.submitted_at).toLocaleDateString('en-AE',{day:'numeric',month:'short',year:'numeric'})}</div>
                        </div>
                        <span style={{ fontSize:10.5, fontWeight:700, color:'#059669', background:'#DCFCE7', border:'1px solid #A7F3D0', borderRadius:99, padding:'3px 10px' }}>Active</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign:'center', padding:'16px', background:'var(--bg-alt)', border:'1px dashed var(--border)', borderRadius:12 }}>
                      <Truck size={20} color="var(--text-muted)" style={{ margin:'0 auto 6px', display:'block', opacity:0.25 }}/>
                      <div style={{ fontSize:12, color:'var(--text-muted)' }}>No vehicle currently assigned</div>
                    </div>
                  )}
                  {fleetHv.length > 0 && (
                    <div>
                      <div style={{ fontSize:10, fontWeight:800, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
                        <ArrowLeftRight size={10}/> Handover History
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                        {fleetHv.map(h => {
                          const isRecv = h.type === 'received'
                          return (
                            <div key={h.id} style={{ padding:'10px 14px', borderRadius:10, background:'var(--bg-alt)', border:`1px solid ${isRecv?'#A7F3D0':'#FECACA'}` }}>
                              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                                  <span style={{ fontSize:10, fontWeight:700, color:isRecv?'#059669':'#DC2626', background:isRecv?'#F0FDF4':'#FEF2F2', borderRadius:5, padding:'1px 7px', textTransform:'uppercase' }}>{h.type}</span>
                                  <span style={{ fontWeight:700, fontSize:12.5, color:'var(--text)' }}>{h.plate || '—'}</span>
                                </div>
                                <span style={{ fontSize:11, color:'var(--text-muted)' }}>{new Date(h.submitted_at).toLocaleDateString('en-AE',{day:'numeric',month:'short',year:'numeric'})}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {fleetHv.length === 0 && !curVehicle && (
                    <div style={{ textAlign:'center', padding:'20px', color:'var(--text-muted)', fontSize:12 }}>No handover records</div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Documents: short preview, full management lives on its own page ── */}
          {tab === 'documents' && (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <button onClick={()=>router.push(`/dashboard/hr/employees/${id}/documents`)}
                style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'10px 14px', borderRadius:10, background:'var(--blue-bg)', border:'1px solid var(--blue-border)', color:'var(--blue)', fontWeight:600, fontSize:12, cursor:'pointer' }}>
                <FolderOpen size={13}/> Manage Documents <ExternalLink size={11}/>
              </button>
              <Section title="Expiry Dates">
                <DocRow label="UAE Visa"        date={emp.visa_expiry}/>
                <DocRow label="Driving License" date={emp.license_expiry}/>
                <DocRow label="ILOE"            date={emp.iloe_expiry}/>
              </Section>
              {emp.insurance_url && (
                <Section title="Insurance Card">
                  <div style={{ padding:'14px 16px' }}>
                    <a href={emp.insurance_url} target="_blank" rel="noreferrer"
                      style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'13px', borderRadius:12, background:'var(--amber-bg)', border:'1px solid var(--amber-border)', color:'#B8860B', fontWeight:700, fontSize:13, fontFamily:'Poppins,sans-serif', textDecoration:'none' }}>
                      <FileText size={14}/> View Insurance Card <ExternalLink size={12}/>
                    </a>
                  </div>
                </Section>
              )}
            </div>
          )}

          {/* ── Expenses: short preview, add/approve lives on its own page ── */}
          {tab === 'expenses' && (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <button onClick={()=>router.push(`/dashboard/hr/employees/${id}/expenses`)}
                style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'10px 14px', borderRadius:10, background:'var(--blue-bg)', border:'1px solid var(--blue-border)', color:'var(--blue)', fontWeight:600, fontSize:12, cursor:'pointer' }}>
                <Receipt size={13}/> Manage Expenses <ExternalLink size={11}/>
              </button>
              {expLoad
                ? [1,2,3].map(i => <div key={i} className="sk" style={{ height:68, borderRadius:12 }}/>)
                : expenses.length === 0
                  ? <div style={{ textAlign:'center', padding:'40px 20px' }}>
                      <Receipt size={32} style={{ margin:'0 auto 12px', display:'block', opacity:0.15 }}/>
                      <div style={{ fontSize:13, color:'var(--text-muted)' }}>No expense records</div>
                    </div>
                  : expenses.slice(0,5).map(ex => (
                      <div key={ex.id} style={{ background:'var(--bg-alt)', border:'1px solid var(--border)', borderRadius:12, padding:'12px 14px' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
                          <span style={{ fontSize:12.5, fontWeight:700, color:'var(--text)' }}>{ex.description || ex.category || 'Expense'}</span>
                          <span style={{ fontSize:13.5, fontWeight:800, color:'#DC2626' }}>AED {Number(ex.amount||0).toLocaleString('en-US')}</span>
                        </div>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                          <span style={{ fontSize:11.5, color:'var(--text-muted)' }}>{ex.date?.slice(0,10)}</span>
                          <span style={{ fontSize:10.5, fontWeight:700, color:ex.status==='approved'?'#059669':ex.status==='pending'?'#D97706':'#EF4444', background:ex.status==='approved'?'#F0FDF4':ex.status==='pending'?'#FFFBEB':'#FEF2F2', borderRadius:99, padding:'2px 9px' }}>
                            {ex.status}
                          </span>
                        </div>
                      </div>
                    ))
              }
            </div>
          )}

          {/* ── Salary: current-month snapshot, full page has the breakdown ── */}
          {tab === 'salary' && (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <button onClick={()=>router.push(`/dashboard/hr/employees/${id}/salary`)}
                style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'10px 14px', borderRadius:10, background:'var(--blue-bg)', border:'1px solid var(--blue-border)', color:'var(--blue)', fontWeight:600, fontSize:12, cursor:'pointer' }}>
                <Banknote size={13}/> View Full Salary <ExternalLink size={11}/>
              </button>
              {salaryLoad ? (
                <div className="sk" style={{ height:100, borderRadius:14 }}/>
              ) : !salarySnap ? (
                <div style={{ textAlign:'center', padding:'40px 20px' }}>
                  <Banknote size={32} style={{ margin:'0 auto 12px', display:'block', opacity:0.15 }}/>
                  <div style={{ fontSize:13, color:'var(--text-muted)' }}>No payroll record for this month yet</div>
                </div>
              ) : (
                <div style={{ background:'var(--bg-alt)', border:'1px solid var(--border)', borderRadius:14, padding:'16px' }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>Net Pay — {new Date().toISOString().slice(0,7)}</div>
                  <div style={{ fontSize:26, fontWeight:900, color:'#059669', letterSpacing:'-0.03em' }}>AED {netSnap.toLocaleString('en-US')}</div>
                  <div style={{ display:'flex', gap:16, marginTop:10 }}>
                    <div><span style={{ fontSize:11, color:'var(--text-muted)' }}>Base</span> <strong style={{ fontSize:12.5 }}>AED {Number(salarySnap.base_salary||0).toLocaleString('en-US')}</strong></div>
                    <div><span style={{ fontSize:11, color:'var(--text-muted)' }}>Bonuses</span> <strong style={{ fontSize:12.5, color:'#059669' }}>+{Number(salarySnap.bonus_total||0).toLocaleString('en-US')}</strong></div>
                    <div><span style={{ fontSize:11, color:'var(--text-muted)' }}>Deductions</span> <strong style={{ fontSize:12.5, color:'#DC2626' }}>-{Number(salarySnap.deduction_total||0).toLocaleString('en-US')}</strong></div>
                  </div>
                  <span style={{ display:'inline-block', marginTop:10, fontSize:10.5, fontWeight:700, color:salarySnap.payroll_status==='paid'?'#059669':'#D97706', background:salarySnap.payroll_status==='paid'?'#F0FDF4':'#FFFBEB', borderRadius:99, padding:'2px 10px' }}>
                    {salarySnap.payroll_status==='paid'?'Paid':'Pending'}
                  </span>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
