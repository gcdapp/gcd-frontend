'use client'
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Search, Plus, X, Pencil, Trash2, Phone, User, Building2,
  AlertCircle, CheckCircle2, Calendar, Shield, Receipt,
  ExternalLink, ChevronRight, DollarSign, Clock, Minus, TrendingUp,
  CheckCircle, XCircle, RefreshCw
} from 'lucide-react'
import { differenceInDays, parseISO } from 'date-fns'

import { API } from '@/lib/api'
const STATIONS = ['DDB1','DXE6']

const ADMIN_ROLE_OPTIONS = ['Manager','HR','Accountant','POC','Admin','Operations Manager','Fleet Manager','POC Supervisor','Finance Manager']
const DEPT_OPTIONS = ['Admin','HR','Finance','Operations']

// Maps JWT/DB role → display role matching ROLE_COLOR keys
const SYS_ROLE_DISPLAY = {
  admin: 'Admin', general_manager: 'Manager', manager: 'Manager',
  hr: 'HR', accountant: 'Accountant', poc: 'POC',
}

// Maps admin-staff display role → DB users.role (must be one of the backend's VALID_ROLES)
const ADMIN_ROLE_TO_SYS_ROLE = {
  Admin: 'admin', Manager: 'manager', HR: 'hr', Accountant: 'accountant', POC: 'poc',
  'Operations Manager': 'manager', 'Fleet Manager': 'manager',
  'POC Supervisor': 'poc', 'Finance Manager': 'accountant',
}

const STATUS = {
  active:   { l:'Active',   c:'#10B981', bg:'#F0FDF4', bc:'#A7F3D0', dot:'#10B981' },
  on_leave: { l:'On Leave', c:'#F59E0B', bg:'#FFFBEB', bc:'#FDE68A', dot:'#F59E0B' },
  inactive: { l:'Inactive', c:'#9CA3AF', bg:'#F9FAFB', bc:'#E5E7EB', dot:'#9CA3AF' },
}

const ROLE_COLOR = {
  Manager:            { c:'#0F766E', bg:'#F0FDFA', bc:'#99F6E4' },
  HR:                 { c:'#B45309', bg:'#FFFBEB', bc:'#FCD34D' },
  Accountant:         { c:'#2E7D52', bg:'#ECFDF5', bc:'#A7F3D0' },
  POC:                { c:'#B8860B', bg:'#FDF6E3', bc:'#F0D78C' },
  Admin:              { c:'#7C3AED', bg:'#F5F3FF', bc:'#DDD6FE' },
  default:            { c:'#6B5D4A', bg:'#F5F4F1', bc:'#EAE6DE' },
}

const EMPTY = {
  id:'', name:'', role:'HR', dept:'Admin', status:'active',
  salary:'', joined:'', phone:'', work_number:'', nationality:'',
  visa_expiry:'', license_expiry:'', iloe_expiry:'',
  station_code:'DDB1', avatar:'👔', emirates_id:'',
  annual_leave_balance:30, annual_leave_start:'', insurance_url:'',
  login_email:'', login_password:''
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

function roleStyle(role) { return ROLE_COLOR[role] || ROLE_COLOR.default }

function Lbl({ children }) {
  return <label style={{ display:'block', fontSize:10.5, fontWeight:700, letterSpacing:'0.07em', textTransform:'uppercase', color:'var(--text-muted)', marginBottom:5 }}>{children}</label>
}

/* ── Admin Modal ─────────────────────────────────────────────── */
function AdminModal({ emp, onSave, onClose, mode }) {
  const [form, setForm] = useState(() => emp ? {
    ...EMPTY,
    ...emp,
    salary:             emp.salary||'',
    joined:             emp.joined?.slice(0,10)||'',
    visa_expiry:        emp.visa_expiry?.slice(0,10)||'',
    license_expiry:     emp.license_expiry?.slice(0,10)||'',
    iloe_expiry:        emp.iloe_expiry?.slice(0,10)||'',
    annual_leave_start: emp.annual_leave_start?.slice(0,10)||'',
    insurance_url:      emp.insurance_url||'',
  } : EMPTY)
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState(null)
  const [tab,    setTab]    = useState('identity')

  function set(k,v) { setForm(p=>({...p,[k]:v})) }

  async function handleSave() {
    if (!form.name || !form.role || !form.dept) return setErr('Name, role and department required')
    if (mode==='add' && !form.id) return setErr('Employee ID required')
    if (mode==='add' && form.login_email && form.login_password && form.login_password.length < 6) {
      return setErr('Login password must be at least 6 characters')
    }
    setSaving(true); setErr(null)
    try {
      const body = { ...form, salary: Number(form.salary)||0, hourly_rate: 0 }
      const url  = mode==='add' ? `${API}/api/employees` : `${API}/api/employees/${form.id}`
      const res  = await fetch(url, { method: mode==='add'?'POST':'PUT', headers: hdr(), body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      const savedEmp = data.employee || data
      if (mode==='add' && form.login_email && form.login_password) {
        const loginRes = await fetch(`${API}/api/auth/users`, {
          method:'POST', headers:hdr(),
          body: JSON.stringify({
            email: form.login_email.trim().toLowerCase(),
            password: form.login_password,
            name: form.name,
            role: ADMIN_ROLE_TO_SYS_ROLE[form.role] || 'admin',
            emp_id: savedEmp.id,
            station_code: form.station_code,
            status: 'active',
          })
        })
        const loginData = await loginRes.json()
        if (!loginRes.ok) throw new Error(`Staff saved, but login creation failed: ${loginData.error || 'unknown error'}`)
      }
      onSave(savedEmp)
    } catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  function inp(label, k, type='text', placeholder='') {
    return (
      <div key={k}>
        <Lbl>{label}</Lbl>
        <input className="input" type={type} value={form[k]||''} autoComplete="off" spellCheck={false}
          placeholder={placeholder} onChange={e=>set(k,e.target.value)}/>
      </div>
    )
  }
  function sel(label, k, options) {
    return (
      <div key={k}>
        <Lbl>{label}</Lbl>
        <select className="input" value={form[k]||''} onChange={e=>set(k,e.target.value)}>
          {options.map(o=><option key={o.v||o} value={o.v||o}>{o.l||o}</option>)}
        </select>
      </div>
    )
  }

  const TABS = [
    { id:'identity', l:'Identity' }, { id:'work', l:'Work & Pay' }, { id:'docs', l:'Documents' },
    ...(mode==='add' ? [{ id:'login', l:'Login' }] : []),
  ]

  return (
    <div className="modal-overlay" style={{ zIndex:9999 }} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:'var(--card)', borderRadius:20, width:'100%', maxWidth:520, maxHeight:'92vh', overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)' }}>
        <div style={{ padding:'20px 24px 0', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
            <div>
              <h3 style={{ fontWeight:800, fontSize:16, color:'var(--text)', margin:0 }}>{mode==='add'?'Add Admin Staff':'Edit Admin Staff'}</h3>
              <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>{mode==='add'?'Add a new admin team member':emp?.name}</p>
            </div>
            <button onClick={onClose} style={{ width:30, height:30, borderRadius:'50%', background:'var(--bg-alt)', border:'1px solid var(--border)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <X size={14} color="var(--text-sub)"/>
            </button>
          </div>
          <div style={{ display:'flex', gap:2 }}>
            {TABS.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)}
                style={{ padding:'8px 14px', fontSize:12.5, fontWeight:tab===t.id?700:500, color:tab===t.id?'var(--gold)':'var(--text-muted)', background:'none', border:'none', borderBottom:`2px solid ${tab===t.id?'var(--gold)':'transparent'}`, cursor:'pointer', fontFamily:'Poppins,sans-serif', marginBottom:-1, transition:'all 0.15s' }}>
                {t.l}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding:'20px 24px', overflowY:'auto', flex:1 }}>
          {err && (
            <div style={{ display:'flex', gap:8, alignItems:'center', background:'var(--red-bg)', border:'1px solid var(--red-border)', borderRadius:10, padding:'10px 14px', fontSize:12.5, color:'var(--red)', marginBottom:14 }}>
              <AlertCircle size={14}/>{err}
            </div>
          )}

          {tab==='identity' && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:13 }}>
              {mode==='add' && inp('Employee ID *','id','text','ADM001')}
              {inp('Full Name *','name','text','Ahmed Al Mansouri')}
              {inp('Personal Phone','phone','tel','+971 50 XXX XXXX')}
              {inp('Emirates ID','emirates_id','text','784-XXXX-XXXXXXX-X')}
              {inp('Nationality','nationality','text','UAE')}
            </div>
          )}

          {tab==='work' && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:13 }}>
              {sel('Role *','role',ADMIN_ROLE_OPTIONS)}
              {sel('Department *','dept',DEPT_OPTIONS)}
              {form.role?.toLowerCase().includes('poc')
                ? sel('Station','station_code',STATIONS)
                : <div><Lbl>Location</Lbl><input className="input" value="Office" readOnly style={{ color:'var(--text-muted)', background:'var(--bg-alt)', cursor:'default' }}/></div>
              }
              {sel('Status','status',[{v:'active',l:'Active'},{v:'on_leave',l:'On Leave'},{v:'inactive',l:'Inactive'}])}
              {inp('Fixed Monthly Salary (AED)','salary','number','5000')}
              {inp('Start Date','joined','date')}
              {inp('AL Start Date','annual_leave_start','date')}
              {inp('AL Balance (days)','annual_leave_balance','number','30')}
            </div>
          )}

          {tab==='docs' && (
            <div style={{ display:'flex', flexDirection:'column', gap:13 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:13 }}>
                {inp('Visa Expiry','visa_expiry','date')}
                {inp('License / ID Expiry','license_expiry','date')}
                {inp('ILOE Expiry','iloe_expiry','date')}
              </div>
              <div>
                <Lbl>Insurance Card (Google Drive URL)</Lbl>
                <input className="input" type="url" value={form.insurance_url||''} autoComplete="off" spellCheck={false}
                  placeholder="https://drive.google.com/file/d/…/view"
                  onChange={e=>set('insurance_url',e.target.value)}/>
                <div style={{ fontSize:10.5, color:'var(--text-muted)', marginTop:5 }}>
                  Paste the Google Drive sharing link for this staff member's insurance card.
                </div>
              </div>
            </div>
          )}

          {tab==='login' && mode==='add' && (
            <div style={{ display:'flex', flexDirection:'column', gap:13 }}>
              <div style={{ background:'var(--amber-bg)', border:'1px solid var(--amber-border)', borderRadius:10, padding:'12px 14px', fontSize:12.5, color:'#92400E' }}>
                <strong>Optional:</strong> Creates a dashboard login for this admin staff member, using their assigned role ({form.role}).
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:13 }}>
                {inp('Login Email','login_email','email','name@goldencrescent.ae')}
                {inp('Login Password','login_password','password','Min 6 characters')}
              </div>
            </div>
          )}
        </div>

        <div style={{ padding:'14px 24px 20px', borderTop:'1px solid var(--border)', display:'flex', gap:10, justifyContent:'flex-end', flexShrink:0 }}>
          <button onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ minWidth:130, justifyContent:'center' }}>
            {saving ? <><span style={{ width:13,height:13,border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'white',borderRadius:'50%',animation:'spin 0.8s linear infinite',display:'inline-block'}}/> Saving…</> : mode==='add'?'Add Staff':'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Work Number Assigner (copied from employees, same API) ───── */
function WorkNumberAssigner({ emp, onSaved, userRole }) {
  const [mode,    setMode]    = useState('view')
  const [sims,    setSims]    = useState([])
  const [loading, setLoading] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [conflict,setConflict]= useState(null)
  const [step,    setStep]    = useState(0)
  const [pending, setPending] = useState('')
  const [history, setHistory] = useState(null)
  const [hLoad,   setHLoad]   = useState(false)

  const canEdit = ['admin','manager','general_manager','hr'].includes(userRole)

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
        method:'POST', headers:hdr(), body: JSON.stringify({ phone_number: phoneNumber, force })
      })
      const d = await r.json()
      if (d.conflict) { setPending(phoneNumber); setConflict({ conflictEmpId: d.conflictEmpId, conflictEmpName: d.conflictEmpName }); setStep(1) }
      else if (d.ok) { reset(); onSaved?.() }
      else if (d.error) { alert(d.error); reset() }
    } catch(e) {} finally { setSaving(false) }
  }

  async function handleRemove() {
    if (!confirm('Remove work number from this staff member?')) return
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
          <div style={{ fontWeight:600, color:'#92400E', marginBottom:8 }}>⚠️ <strong>{pending}</strong> is assigned to <strong>{conflict.conflictEmpName}</strong>. Proceed?</div>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={()=>setStep(2)} style={{ flex:1, padding:'6px', borderRadius:100, background:'#B8860B', color:'white', border:'none', cursor:'pointer', fontSize:11, fontWeight:700, fontFamily:'Poppins,sans-serif' }}>Yes, proceed</button>
            <button onClick={reset} style={{ flex:1, padding:'6px', borderRadius:100, background:'var(--card)', color:'var(--text-sub)', border:'1px solid var(--border)', cursor:'pointer', fontSize:11, fontFamily:'Poppins,sans-serif' }}>Cancel</button>
          </div>
        </div>
      )}

      {step===2 && conflict && (
        <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:9, padding:'10px 12px', fontSize:12 }}>
          <div style={{ fontWeight:600, color:'#7F1D1D', marginBottom:8 }}>Assign a new number to <strong>{conflict.conflictEmpName}</strong>?</div>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={()=>tryAssign(pending,true)} disabled={saving} style={{ flex:1, padding:'6px', borderRadius:100, background:'#10B981', color:'white', border:'none', cursor:'pointer', fontSize:11, fontWeight:700, fontFamily:'Poppins,sans-serif' }}>Yes, reassign</button>
            <button onClick={()=>tryAssign(pending,true)} disabled={saving} style={{ flex:1, padding:'6px', borderRadius:100, background:'#EF4444', color:'white', border:'none', cursor:'pointer', fontSize:11, fontWeight:700, fontFamily:'Poppins,sans-serif' }}>{saving?'…':'No, just remove'}</button>
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
          {loading ? <div style={{ textAlign:'center', padding:10, fontSize:12, color:'var(--text-muted)' }}>Loading SIM pool…</div>
          : sims.length===0 ? <div style={{ fontSize:12, color:'var(--text-muted)', textAlign:'center', padding:8 }}>No available SIMs</div>
          : sims.map(s => (
            <div key={s.id} onClick={()=>tryAssign(s.phone_number)}
              style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 10px', borderRadius:8, cursor:'pointer', marginBottom:4, background: s.emp_id===emp.id?'#F0FDF4':'var(--card)', border:`1px solid ${s.emp_id===emp.id?'#A7F3D0':'var(--border)'}`, transition:'background 0.15s' }}>
              <span style={{ fontFamily:'inherit', fontSize:12.5, color:'var(--text)', fontWeight:600 }}>{s.phone_number}</span>
              <span style={{ fontSize:10.5, color:s.emp_id===emp.id?'#10B981':'var(--text-muted)' }}>{s.emp_id===emp.id?'Current':'Available'}</span>
            </div>
          ))}
          <button onClick={reset} style={{ width:'100%', marginTop:4, padding:'6px', borderRadius:100, background:'none', border:'1px solid var(--border)', fontSize:11, color:'var(--text-muted)', cursor:'pointer', fontFamily:'Poppins,sans-serif' }}>Cancel</button>
        </div>
      )}

      {history !== null && (
        <div style={{ marginTop:8, borderTop:'1px solid var(--border)', paddingTop:8 }}>
          {hLoad ? <div style={{ textAlign:'center', padding:8, fontSize:11, color:'var(--text-muted)' }}>Loading…</div>
          : history.length===0 ? <div style={{ textAlign:'center', fontSize:11, color:'var(--text-muted)', padding:6 }}>No history</div>
          : history.map(h=>(
            <div key={h.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 0', borderBottom:'1px solid var(--border)', fontSize:11 }}>
              <div>
                <span style={{ fontWeight:700, color:ACTION_COLOR[h.action]||'var(--text)', background:ACTION_BG[h.action]||'var(--bg-alt)', borderRadius:4, padding:'1px 6px', fontSize:10 }}>{h.action}</span>
                <span style={{ marginLeft:6, fontFamily:'inherit', color:'var(--text)' }}>{h.phone_number}</span>
              </div>
              <span style={{ color:'var(--text-muted)', fontSize:10 }}>{h.performed_at?.slice(0,10)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Salary Panel ─────────────────────────────────────────────── */
function SalaryPanel({ emp, userRole }) {
  const [month,   setMonth]   = useState(new Date().toISOString().slice(0,7))
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(false)
  const [bonusAmt,setBonusAmt]= useState('')
  const [bonusDesc,setBonusDesc]=useState('')
  const [dedAmt,  setDedAmt]  = useState('')
  const [dedType, setDedType] = useState('other')
  const [dedDesc, setDedDesc] = useState('')
  const [saving,  setSaving]  = useState(false)
  const [showBonus,setShowBonus]=useState(false)
  const [showDed, setShowDed] = useState(false)

  const canManage = ['admin'].includes(userRole)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`${API}/api/payroll?month=${month}&emp_id=${emp.id}`, { headers: hdr() })
      const d = await r.json()
      setData(d.payroll?.[0] || null)
    } catch(e) {} finally { setLoading(false) }
  }, [emp.id, month])

  useEffect(() => { load() }, [load])

  async function addBonus() {
    if (!bonusAmt) return
    setSaving(true)
    try {
      await fetch(`${API}/api/payroll/bonuses`, { method:'POST', headers:hdr(), body:JSON.stringify({ emp_id:emp.id, month, amount:Number(bonusAmt), description:bonusDesc||null }) })
      setBonusAmt(''); setBonusDesc(''); setShowBonus(false); load()
    } catch(e) { alert('Failed') } finally { setSaving(false) }
  }

  async function addDeduction() {
    if (!dedAmt) return
    setSaving(true)
    try {
      await fetch(`${API}/api/payroll/deductions`, { method:'POST', headers:hdr(), body:JSON.stringify({ emp_id:emp.id, month, type:dedType, amount:Number(dedAmt), description:dedDesc||null }) })
      setDedAmt(''); setDedDesc(''); setShowDed(false); load()
    } catch(e) { alert('Failed') } finally { setSaving(false) }
  }

  async function removeDeduction(id) {
    if (!confirm('Remove this deduction?')) return
    await fetch(`${API}/api/payroll/deductions/${id}`, { method:'DELETE', headers:hdr() })
    load()
  }

  async function markPaid() {
    if (!confirm('Mark salary as paid for this month?')) return
    await fetch(`${API}/api/payroll/mark-paid`, { method:'POST', headers:hdr(), body:JSON.stringify({ emp_id:emp.id, month }) })
    load()
  }

  const base    = Number(emp.salary||0)
  const bonus   = Number(data?.bonus_total||0)
  const ded     = Number(data?.deduction_total||0)
  const net     = base + bonus - ded
  const isPaid  = data?.payroll_status === 'paid'

  return (
    <div>
      {/* Month selector */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <input type="month" value={month} onChange={e=>setMonth(e.target.value)}
          style={{ padding:'6px 10px', borderRadius:9, border:'1px solid var(--border)', fontSize:12, background:'var(--card)', color:'var(--text)', fontFamily:'Poppins,sans-serif' }}/>
        {isPaid
          ? <span style={{ fontSize:11, fontWeight:700, color:'#10B981', background:'#F0FDF4', border:'1px solid #A7F3D0', borderRadius:20, padding:'3px 10px' }}>✓ Paid</span>
          : canManage && !loading && <button onClick={markPaid} style={{ padding:'5px 12px', borderRadius:100, background:'#10B981', color:'white', border:'none', cursor:'pointer', fontSize:11, fontWeight:700, fontFamily:'Poppins,sans-serif' }}>Mark Paid</button>
        }
      </div>

      {loading ? <div className="sk" style={{ height:80, borderRadius:12 }}/> : (
        <>
          {/* Summary cards */}
          <div className="four-kpi-grid" style={{ gap:8, marginBottom:14 }}>
            {[
              { l:'Base',       v:`${base.toLocaleString()}`,    c:'var(--text)',  bg:'var(--bg-alt)' },
              { l:'Bonuses',    v:`+${bonus.toLocaleString()}`,  c:'#10B981',     bg:'#F0FDF4' },
              { l:'Deductions', v:`-${ded.toLocaleString()}`,    c:'#EF4444',     bg:'#FEF2F2' },
              { l:'Net Pay',    v:`${net.toLocaleString()}`,     c:'#B8860B',     bg:'#FDF6E3' },
            ].map(s=>(
              <div key={s.l} style={{ textAlign:'center', padding:'10px 6px', borderRadius:10, background:s.bg, border:'1px solid var(--border)' }}>
                <div style={{ fontWeight:800, fontSize:14, color:s.c }}>{s.v}</div>
                <div style={{ fontSize:9.5, color:s.c, fontWeight:600, marginTop:2, opacity:0.8 }}>{s.l}</div>
              </div>
            ))}
          </div>

          {/* Bonuses list */}
          {data?.bonuses?.length > 0 && (
            <div style={{ marginBottom:10 }}>
              <div style={{ fontSize:10.5, fontWeight:700, color:'#10B981', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>Bonuses</div>
              {data.bonuses.map(b=>(
                <div key={b.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 10px', background:'#F0FDF4', border:'1px solid #A7F3D0', borderRadius:8, marginBottom:4, fontSize:12 }}>
                  <span style={{ color:'var(--text)', fontWeight:500 }}>{b.description||b.type||'Bonus'}</span>
                  <span style={{ fontWeight:700, color:'#10B981' }}>+AED {Number(b.amount).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}

          {/* Deductions list */}
          {data?.deductions?.length > 0 && (
            <div style={{ marginBottom:10 }}>
              <div style={{ fontSize:10.5, fontWeight:700, color:'#EF4444', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>Deductions</div>
              {data.deductions.map(d=>(
                <div key={d.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 10px', background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:8, marginBottom:4, fontSize:12 }}>
                  <span style={{ color:'var(--text)', fontWeight:500 }}>{d.description||d.type}</span>
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <span style={{ fontWeight:700, color:'#EF4444' }}>-AED {Number(d.amount).toLocaleString()}</span>
                    {canManage && !isPaid && <button onClick={()=>removeDeduction(d.id)} style={{ padding:'2px 6px', borderRadius:5, background:'none', border:'1px solid #FECACA', color:'#EF4444', cursor:'pointer', fontSize:10, fontFamily:'Poppins,sans-serif' }}>×</button>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add bonus / deduction buttons */}
          {canManage && !isPaid && (
            <div style={{ display:'flex', gap:8, marginBottom:10 }}>
              <button onClick={()=>{setShowBonus(p=>!p);setShowDed(false)}} style={{ flex:1, padding:'7px', borderRadius:9, background:'#F0FDF4', border:'1px solid #A7F3D0', color:'#10B981', fontWeight:700, fontSize:11.5, cursor:'pointer', fontFamily:'Poppins,sans-serif', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                <TrendingUp size={12}/> {showBonus?'Cancel':'Add Bonus'}
              </button>
              <button onClick={()=>{setShowDed(p=>!p);setShowBonus(false)}} style={{ flex:1, padding:'7px', borderRadius:9, background:'#FEF2F2', border:'1px solid #FECACA', color:'#EF4444', fontWeight:700, fontSize:11.5, cursor:'pointer', fontFamily:'Poppins,sans-serif', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                <Minus size={12}/> {showDed?'Cancel':'Add Deduction'}
              </button>
            </div>
          )}

          {showBonus && (
            <div style={{ background:'#F0FDF4', border:'1px solid #A7F3D0', borderRadius:10, padding:'12px', marginBottom:10 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
                <div><Lbl>Amount (AED)</Lbl><input className="input" type="number" value={bonusAmt} onChange={e=>setBonusAmt(e.target.value)} placeholder="500"/></div>
                <div><Lbl>Description</Lbl><input className="input" value={bonusDesc} onChange={e=>setBonusDesc(e.target.value)} placeholder="Performance bonus"/></div>
              </div>
              <button onClick={addBonus} disabled={saving||!bonusAmt} className="btn btn-primary" style={{ width:'100%', justifyContent:'center' }}>{saving?'Adding…':'Add Bonus'}</button>
            </div>
          )}

          {showDed && (
            <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:10, padding:'12px', marginBottom:10 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
                <div>
                  <Lbl>Type</Lbl>
                  <select className="input" value={dedType} onChange={e=>setDedType(e.target.value)}>
                    {['traffic_fine','iloe_fee','iloe_fine','cash_variance','other'].map(t=><option key={t} value={t}>{t.replace('_',' ')}</option>)}
                  </select>
                </div>
                <div><Lbl>Amount (AED)</Lbl><input className="input" type="number" value={dedAmt} onChange={e=>setDedAmt(e.target.value)} placeholder="200"/></div>
                <div style={{ gridColumn:'span 2' }}><Lbl>Description</Lbl><input className="input" value={dedDesc} onChange={e=>setDedDesc(e.target.value)} placeholder="Reason for deduction"/></div>
              </div>
              <button onClick={addDeduction} disabled={saving||!dedAmt} className="btn btn-primary" style={{ width:'100%', justifyContent:'center' }}>{saving?'Adding…':'Add Deduction'}</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ── Attendance Panel ─────────────────────────────────────────── */
function AttendancePanel({ emp, userRole }) {
  const [month,   setMonth]   = useState(new Date().toISOString().slice(0,7))
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0,10))
  const [logStatus,setLogStatus]=useState('present')
  const [logNote, setLogNote] = useState('')
  const [saving,  setSaving]  = useState(false)
  const [showLog, setShowLog] = useState(false)

  const canManage = ['admin','manager','general_manager'].includes(userRole)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`${API}/api/attendance?date=${month}-01&emp_id=${emp.id}`, { headers: hdr() })
      // Actually fetch month range - use earnings endpoint which gives monthly records
      const r2 = await fetch(`${API}/api/attendance/earnings?emp_id=${emp.id}&month=${month}`, { headers: hdr() })
      const d = await r2.json()
      setRecords(d.records||[])
    } catch(e) {} finally { setLoading(false) }
  }, [emp.id, month])

  useEffect(() => { load() }, [load])

  async function logAttendance() {
    if (!logDate || !logStatus) return
    setSaving(true)
    try {
      await fetch(`${API}/api/attendance`, {
        method: 'POST', headers: hdr(),
        body: JSON.stringify({ emp_id: emp.id, date: logDate, status: logStatus, note: logNote||null })
      })
      setLogDate(new Date().toISOString().slice(0,10)); setLogNote(''); setShowLog(false); load()
    } catch(e) { alert('Failed to log attendance') } finally { setSaving(false) }
  }

  const present = records.filter(r=>r.status==='present').length
  const absent  = records.filter(r=>r.status==='absent').length
  const leave   = records.filter(r=>r.status==='leave').length

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <input type="month" value={month} onChange={e=>setMonth(e.target.value)}
          style={{ padding:'6px 10px', borderRadius:9, border:'1px solid var(--border)', fontSize:12, background:'var(--card)', color:'var(--text)', fontFamily:'Poppins,sans-serif' }}/>
        {canManage && <button onClick={()=>setShowLog(p=>!p)} style={{ padding:'5px 12px', borderRadius:9, background:showLog?'var(--bg-alt)':'var(--gold)', color:showLog?'var(--text-muted)':'white', border:'none', cursor:'pointer', fontSize:11, fontWeight:700, fontFamily:'Poppins,sans-serif' }}>{showLog?'Cancel':'Log Day'}</button>}
      </div>

      {/* Summary */}
      <div className="r-grid-3" style={{ gap:8, marginBottom:12 }}>
        {[{l:'Present',v:present,c:'#10B981',bg:'#F0FDF4'},{l:'Absent',v:absent,c:'#EF4444',bg:'#FEF2F2'},{l:'Leave',v:leave,c:'#F59E0B',bg:'#FFFBEB'}].map(s=>(
          <div key={s.l} style={{ textAlign:'center', padding:'9px', borderRadius:10, background:s.bg, border:'1px solid var(--border)' }}>
            <div style={{ fontWeight:900, fontSize:17, color:s.c }}>{s.v}</div>
            <div style={{ fontSize:10, color:s.c, fontWeight:600, marginTop:1, opacity:0.8 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {showLog && (
        <div style={{ background:'var(--bg-alt)', border:'1px solid var(--border)', borderRadius:10, padding:'12px', marginBottom:12 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
            <div><Lbl>Date</Lbl><input className="input" type="date" value={logDate} onChange={e=>setLogDate(e.target.value)}/></div>
            <div>
              <Lbl>Status</Lbl>
              <select className="input" value={logStatus} onChange={e=>setLogStatus(e.target.value)}>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="leave">Leave</option>
              </select>
            </div>
            <div style={{ gridColumn:'span 2' }}><Lbl>Note</Lbl><input className="input" value={logNote} onChange={e=>setLogNote(e.target.value)} placeholder="Optional note"/></div>
          </div>
          <button onClick={logAttendance} disabled={saving} className="btn btn-primary" style={{ width:'100%', justifyContent:'center' }}>{saving?'Logging…':'Log Attendance'}</button>
        </div>
      )}

      {loading ? <div className="sk" style={{ height:60, borderRadius:10 }}/> : (
        records.length === 0
          ? <div style={{ textAlign:'center', padding:'20px 0', color:'var(--text-muted)', fontSize:12 }}>No records for this month</div>
          : <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              {records.map(r=>{
                const SC2 = { present:'#10B981', absent:'#EF4444', leave:'#F59E0B' }
                const SBG = { present:'#F0FDF4', absent:'#FEF2F2', leave:'#FFFBEB' }
                return (
                  <div key={r.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 10px', background:SBG[r.status]||'var(--bg-alt)', border:'1px solid var(--border)', borderRadius:9, fontSize:12 }}>
                    <span style={{ fontWeight:600, color:'var(--text)' }}>{r.date?.slice(0,10)}</span>
                    <span style={{ fontWeight:700, color:SC2[r.status]||'var(--text-muted)', fontSize:11 }}>{r.status}</span>
                  </div>
                )
              })}
            </div>
      )}
    </div>
  )
}

/* ── Detail Drawer ─────────────────────────────────────────────── */
function DetailDrawer({ emp, onEdit, onDelete, onClose, onRefresh, onCreateProfile, userRole }) {
  const [tab, setTab] = useState('profile')
  const rc = roleStyle(emp.role)
  const s  = STATUS[emp.status]||STATUS.inactive

  // ── User-only entry (no employee profile yet) ──────────────────
  if (!emp.hasProfile) {
    return (
      <div style={{ background:'var(--card)', borderRadius:20, overflow:'hidden', display:'flex', flexDirection:'column', height:'100%' }}>
        <div style={{ background:`linear-gradient(120deg,${rc.bg} 0%,var(--card) 60%)`, padding:'22px 24px 18px', position:'relative', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
          <button onClick={onClose} style={{ position:'absolute',top:14,right:16,width:28,height:28,borderRadius:'50%',background:'var(--card)',border:'1px solid var(--border)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>
            <X size={14} color="var(--text-sub)"/>
          </button>
          <div style={{ display:'flex', alignItems:'center', gap:20 }}>
            <div style={{ width:72,height:72,borderRadius:20,background:`linear-gradient(135deg,${rc.bg},${rc.bc})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,fontWeight:900,color:rc.c,boxShadow:`0 6px 20px ${rc.c}28` }}>
              {emp.name?.slice(0,2).toUpperCase()}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:900,fontSize:18,color:'var(--text)',letterSpacing:'-0.02em',marginBottom:4 }}>{emp.name}</div>
              <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                <span style={{ fontSize:11,fontWeight:700,color:rc.c,background:rc.bg,border:`1.5px solid ${rc.bc}`,borderRadius:20,padding:'3px 10px' }}>{emp.role}</span>
                {emp.station_code && <span style={{ fontSize:11,fontWeight:700,color:'var(--text-sub)',background:'var(--bg-alt)',border:'1px solid var(--border)',borderRadius:20,padding:'3px 10px' }}>{emp.station_code}</span>}
              </div>
            </div>
          </div>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'16px' }}>
          <div style={{ background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:12, padding:'12px 14px', marginBottom:14, fontSize:12.5, color:'#B45309', display:'flex', gap:8, alignItems:'flex-start' }}>
            <AlertCircle size={14} style={{ flexShrink:0, marginTop:1 }}/>
            <span>This user has a login account but no employee profile yet. Create a profile to track their salary, attendance, and documents.</span>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:16 }}>
            {[
              { l:'Name',    v: emp.name },
              { l:'Role',    v: emp.role },
              { l:'Email',   v: emp.email || '—' },
              { l:'Station', v: emp.station_code || '—' },
            ].map(row => (
              <div key={row.l} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', borderRadius:9, background:'var(--bg-alt)' }}>
                <span style={{ fontSize:11.5, color:'var(--text-muted)', flex:1 }}>{row.l}</span>
                <span style={{ fontSize:12, color:'var(--text)', fontWeight:600 }}>{row.v}</span>
              </div>
            ))}
          </div>
          <button onClick={()=>onCreateProfile(emp)} className="btn btn-primary" style={{ width:'100%', justifyContent:'center', borderRadius:12 }}>
            <Plus size={14}/> Create Employee Profile
          </button>
        </div>
      </div>
    )
  }

  const TABS = [
    { id:'profile',    l:'Profile'    },
    { id:'docs',       l:'Documents'  },
    { id:'sims',       l:'SIMs'       },
    { id:'salary',     l:'Salary'     },
    { id:'attendance', l:'Attendance' },
  ]

  return (
    <div style={{ background:'var(--card)', borderRadius:20, overflow:'hidden', display:'flex', flexDirection:'column', height:'100%' }}>
      {/* Horizontal header — same layout as DA DetailDrawer */}
      <div style={{ background:`linear-gradient(120deg,${rc.bg} 0%,var(--card) 60%)`, padding:'22px 24px 18px', position:'relative', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
        <button onClick={onClose} style={{ position:'absolute',top:14,right:16,width:28,height:28,borderRadius:'50%',background:'var(--card)',border:'1px solid var(--border)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'var(--shadow-sm)' }}>
          <X size={14} color="var(--text-sub)"/>
        </button>
        <div style={{ display:'flex', alignItems:'center', gap:20 }}>
          {/* Avatar */}
          <div style={{ position:'relative', flexShrink:0 }}>
            <div style={{ width:72,height:72,borderRadius:20,background:`linear-gradient(135deg,${rc.bg},${rc.bc})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,fontWeight:900,color:rc.c,boxShadow:`0 6px 20px ${rc.c}28` }}>
              {emp.name?.slice(0,2).toUpperCase()}
            </div>
            {/* status dot */}
            <div style={{ position:'absolute',bottom:2,right:2,width:13,height:13,borderRadius:'50%',background:s.dot,border:'2.5px solid var(--card)',boxShadow:`0 0 0 2px ${s.dot}40` }}/>
          </div>
          {/* Name + meta */}
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontWeight:900,fontSize:18,color:'var(--text)',letterSpacing:'-0.02em',marginBottom:3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{emp.name}</div>
            <div style={{ fontSize:12.5,color:'var(--text-muted)',marginBottom:10 }}>{emp.dept} · <span style={{ fontFamily:'inherit',fontSize:12 }}>{emp.id}</span></div>
            <div style={{ display:'flex',gap:6,flexWrap:'wrap',alignItems:'center' }}>
              <span style={{ fontSize:11,fontWeight:700,color:s.c,background:s.bg,border:`1.5px solid ${s.bc}`,borderRadius:20,padding:'3px 10px' }}>{s.l}</span>
              <span style={{ fontSize:11,fontWeight:700,color:rc.c,background:rc.bg,border:`1.5px solid ${rc.bc}`,borderRadius:20,padding:'3px 10px' }}>{emp.role}</span>
              {emp.station_code && <span style={{ fontSize:11,fontWeight:700,color:'var(--text-sub)',background:'var(--bg-alt)',border:'1px solid var(--border)',borderRadius:20,padding:'3px 10px' }}>{emp.station_code}</span>}
            </div>
          </div>
          {/* Actions */}
          <div style={{ display:'flex', gap:8, flexShrink:0 }}>
            <button onClick={onEdit} style={{ padding:'7px 14px',borderRadius:100,background:'var(--bg-alt)',border:'1px solid var(--border)',cursor:'pointer',fontSize:12.5,color:'var(--text-sub)',fontWeight:600,display:'flex',alignItems:'center',gap:5,fontFamily:'Poppins,sans-serif' }}>
              <Pencil size={13}/> Edit
            </button>
            <button onClick={onDelete} style={{ padding:'7px 10px',borderRadius:100,background:'var(--red-bg)',border:'1px solid var(--red-border)',cursor:'pointer',color:'var(--red)',display:'flex',alignItems:'center',fontFamily:'Poppins,sans-serif' }}>
              <Trash2 size={13}/>
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable tab bar */}
      <div className="detail-tabs" style={{ display:'flex', overflowX:'auto', padding:'0 14px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{ padding:'9px 12px', fontSize:12, fontWeight:tab===t.id?700:500, color:tab===t.id?'var(--gold)':'var(--text-muted)', background:'none', border:'none', borderBottom:`2px solid ${tab===t.id?'var(--gold)':'transparent'}`, cursor:'pointer', fontFamily:'Poppins,sans-serif', marginBottom:-1, transition:'all 0.15s', whiteSpace:'nowrap', flexShrink:0 }}>
            {t.l}
          </button>
        ))}
      </div>

      {/* Scrollable content */}
      <div style={{ flex:1, overflowY:'auto', padding:'14px' }}>
        {/* ── Profile ── */}
        {tab==='profile' && (
          <>
            <div style={{ display:'flex', flexDirection:'column', gap:1, marginBottom:12 }}>
              {[
                { icon:User,       l:'Employee ID',   v:emp.id,                    mono:true  },
                { icon:Phone,      l:'Personal Phone',v:emp.phone||'—',            mono:false },
                { icon:Building2,  l:'Department',    v:emp.dept||'—',             mono:false },
                { icon:User,       l:'Nationality',   v:emp.nationality||'—',      mono:false },
                { icon:Shield,     l:'Emirates ID',   v:emp.emirates_id||'—',      mono:true  },
                { icon:Calendar,   l:'Start Date',    v:emp.joined?.slice(0,10)||'—', mono:false },
                { icon:DollarSign, l:'Salary',        v:`AED ${Number(emp.salary||0).toLocaleString()}/mo`, mono:false },
              ].map(row=>{
                const Icon=row.icon
                return (
                  <div key={row.l} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', borderRadius:9, background:'var(--bg-alt)' }}>
                    <Icon size={12} color="var(--text-muted)" style={{ flexShrink:0 }}/>
                    <span style={{ fontSize:11.5, color:'var(--text-muted)', flex:1 }}>{row.l}</span>
                    <span style={{ fontSize:12, color:'var(--text)', fontWeight:600, fontFamily:'inherit', maxWidth:110, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{row.v}</span>
                  </div>
                )
              })}
            </div>

            <a href={`/dashboard/finance/expenses?emp_id=${emp.id}`}
              style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'9px', borderRadius:10, background:'var(--blue-bg)', border:'1px solid var(--blue-border)', color:'var(--blue)', fontWeight:600, fontSize:12, textDecoration:'none', marginBottom:10 }}>
              <Receipt size={13}/> View Expenses <ExternalLink size={11}/>
            </a>

            {userRole !== 'accountant' && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <button onClick={onEdit} className="btn btn-secondary" style={{ justifyContent:'center' }}>
                  <Pencil size={13}/> Edit
                </button>
                <button onClick={onDelete} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'9px', borderRadius:100, background:'var(--red-bg)', border:'1px solid var(--red-border)', color:'var(--red)', fontWeight:600, fontSize:12, cursor:'pointer', fontFamily:'Poppins,sans-serif' }}>
                  <Trash2 size={13}/> Delete
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Documents ── */}
        {tab==='docs' && (
          <>
            <div className="r-grid-3" style={{ gap:8, marginBottom:10 }}>
              {[['Visa',emp.visa_expiry],['License',emp.license_expiry],['ILOE',emp.iloe_expiry]].map(([l,d])=>{
                const info = expiry(d)
                return (
                  <div key={l} style={{ textAlign:'center', padding:'14px 6px', borderRadius:12, background:info?.bg||'var(--bg-alt)', border:`1px solid ${info?.bc||'var(--border)'}` }}>
                    <div style={{ fontSize:10, fontWeight:700, color:info?.c||'var(--text-muted)', marginBottom:4 }}>{l}</div>
                    <div style={{ fontSize:10, color:info?.c||'var(--text-muted)', fontWeight:600 }}>{info?.label||'N/A'}</div>
                    {d && <div style={{ fontSize:9, color:'var(--text-muted)', marginTop:2 }}>{d.slice(0,10)}</div>}
                  </div>
                )
              })}
            </div>
            {[['Visa',emp.visa_expiry],['License',emp.license_expiry],['ILOE',emp.iloe_expiry]].filter(([,d])=>d).map(([l,d])=>{
              const info = expiry(d)
              if (!info || info.label==='Valid') return null
              return (
                <div key={l} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', background:info.bg, border:`1px solid ${info.bc}`, borderRadius:10, marginBottom:6, fontSize:12 }}>
                  <AlertCircle size={13} color={info.c} style={{ flexShrink:0 }}/>
                  <span style={{ fontWeight:600, color:info.c }}>{l} — {info.label}</span>
                </div>
              )
            })}
          </>
        )}

        {/* ── SIMs ── */}
        {tab==='sims' && (
          <div>
            <WorkNumberAssigner emp={emp} onSaved={onRefresh} userRole={userRole}/>
            <div style={{ marginTop:10, padding:'10px 12px', background:'var(--bg-alt)', border:'1px solid var(--border)', borderRadius:10 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>Personal Phone</div>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', fontFamily:'inherit' }}>{emp.phone||'—'}</div>
            </div>
          </div>
        )}

        {/* ── Salary ── */}
        {tab==='salary' && <SalaryPanel emp={emp} userRole={userRole}/>}

        {/* ── Attendance ── */}
        {tab==='attendance' && <AttendancePanel emp={emp} userRole={userRole}/>}
      </div>
    </div>
  )
}

/* ── Admin Staff Card ─────────────────────────────────────────── */
function AdminCard({ emp, onClick, onEdit, onDelete, index, isSelected, userRole }) {
  const rc  = roleStyle(emp.role)
  const s   = STATUS[emp.status] || STATUS.inactive
  const vExp = expiry(emp.visa_expiry)
  const lExp = expiry(emp.license_expiry)
  const hasAlert = (vExp&&(vExp.label==='Expired'||parseInt(vExp.label)<=60)) || (lExp&&(lExp.label==='Expired'||parseInt(lExp.label)<=60))

  const bc   = hasAlert ? '#EF4444' : isSelected ? rc.c : s.dot
  const glow = hasAlert ? '#EF444420' : isSelected ? `${rc.c}28` : `${s.dot}15`

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
        animation:`slideUp 0.25s ${Math.min(index,12)*0.04}s ease both`,
      }}
      onMouseEnter={e=>{if(!isSelected){e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow=`0 0 0 1px ${glow}, 0 10px 28px rgba(0,0,0,0.10)`}}}
      onMouseLeave={e=>{if(!isSelected){e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow=`0 0 0 1px ${glow}, 0 4px 16px rgba(0,0,0,0.06)`}}}>

      {/* Main content */}
      <div style={{ padding:'16px 16px 12px', display:'flex', gap:12, alignItems:'center' }}>
        {/* Avatar */}
        <div style={{ position:'relative', flexShrink:0 }}>
          <div style={{ width:50, height:50, borderRadius:14, background:`linear-gradient(135deg,${bc}22,${bc}40)`, border:`1.5px solid ${bc}45`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:900, color:bc, letterSpacing:'-0.02em' }}>
            {emp.name?.slice(0,2).toUpperCase()}
          </div>
          <div style={{ position:'absolute', bottom:-2, right:-2, width:12, height:12, borderRadius:'50%', background:hasAlert?'#EF4444':s.dot, border:'2.5px solid var(--card)' }}/>
        </div>

        {/* Identity */}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
            <span style={{ fontWeight:800, fontSize:14, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{emp.name}</span>
            {!emp.hasProfile && <span style={{ fontSize:9, fontWeight:700, color:'#6B7280', background:'#F3F4F6', border:'1px solid #E5E7EB', borderRadius:4, padding:'1px 5px', flexShrink:0 }}>No Profile</span>}
          </div>
          <div style={{ fontSize:10.5, color:'var(--text-muted)', marginBottom:7, fontFamily:'monospace' }}>
            {emp.hasProfile ? `#${emp.id}` : emp.email || '—'}
            {emp.work_number && <span style={{ marginLeft:5, color:'var(--text-sub)', fontFamily:'inherit' }}>· {emp.work_number}</span>}
          </div>
          <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
            <span style={{ fontSize:10, fontWeight:700, color:rc.c, background:rc.bg, border:`1px solid ${rc.bc}`, borderRadius:6, padding:'2px 7px' }}>{emp.role}</span>
            {emp.dept && emp.dept !== '—' && <span style={{ fontSize:10, fontWeight:600, color:'var(--text-muted)', background:'var(--bg-alt)', border:'1px solid var(--border)', borderRadius:6, padding:'2px 7px' }}>{emp.dept}</span>}
            {emp.station_code && <span style={{ fontSize:10, fontWeight:600, color:'#2563EB', background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:6, padding:'2px 7px' }}>{emp.station_code}</span>}
          </div>
        </div>

        {/* Salary + actions */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6, flexShrink:0 }}>
          {emp.salary ? <span style={{ fontSize:11.5, fontWeight:700, color:'var(--text-muted)' }}>AED {Number(emp.salary).toLocaleString()}</span> : null}
          {userRole !== 'accountant' && (
            <div style={{ display:'flex', gap:4 }}>
              <button onClick={e=>{e.stopPropagation();onEdit(emp)}} style={{ width:28, height:28, borderRadius:7, background:'var(--bg-alt)', border:'1px solid var(--border)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-sub)' }}>
                <Pencil size={11}/>
              </button>
              <button onClick={e=>{e.stopPropagation();onDelete(emp)}} style={{ width:28, height:28, borderRadius:7, background:'var(--red-bg)', border:'1px solid var(--red-border)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--red)' }}>
                <Trash2 size={11}/>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ margin:'0 16px 14px', borderTop:'1px solid var(--border)', paddingTop:10, display:'flex', alignItems:'center', gap:10 }}>
        <span style={{ flex:1, display:'flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600, color:s.c }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background:s.dot, display:'inline-block', flexShrink:0 }}/>{s.l}
        </span>
        {emp.phone && <span style={{ fontSize:11, color:'var(--text-sub)', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:130 }}>{emp.phone}</span>}
      </div>
    </div>
  )
}

/* ══ MAIN PAGE ═══════════════════════════════════════════════ */
const ROLE_TABS = ['All','Admin','Manager','HR','Accountant','POC']

export default function AdminsPage() {
  const [allAdmins,  setAllAdmins]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [roleFilter, setRoleFilter] = useState('All')
  const [selected,   setSelected]   = useState(null)
  const [modal,      setModal]      = useState(null)
  const [userRole,   setUserRole]   = useState(null)

  useEffect(() => {
    try { const t=localStorage.getItem('gcd_token'); if(t){const p=JSON.parse(atob(t.split('.')[1]));setUserRole(p.role)} } catch(e){}
  }, [])

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const [empRes, userRes] = await Promise.all([
        fetch(`${API}/api/employees`,  { headers: hdr() }),
        fetch(`${API}/api/auth/users`, { headers: hdr() }),
      ])
      const empData  = await empRes.json()
      const userData = await userRes.json()

      const nonDriverEmps = (empData.employees||[]).filter(e=>(e.role||'').toLowerCase()!=='driver')
      const empsWithFlag  = nonDriverEmps.map(e=>({...e, hasProfile:true}))
      const empIdSet      = new Set(nonDriverEmps.map(e=>e.id))

      const usersWithoutProfile = (userData.users||[]).filter(u=>
        u.role!=='driver' && (!u.emp_id || !empIdSet.has(u.emp_id))
      )
      const userOnlyEntries = usersWithoutProfile.map(u=>({
        id:u.id, userId:u.id, name:u.name,
        role: SYS_ROLE_DISPLAY[u.role]||u.role,
        dept:'—', status:u.status||'active',
        station_code:u.station_code, email:u.email,
        phone:null, salary:null, hasProfile:false, _userRole:u.role,
      }))

      const merged = [...empsWithFlag, ...userOnlyEntries]
      setAllAdmins(merged)
      setSelected(s => s ? (merged.find(e=>e.id===s.id)||s) : null)
    } catch(e) { console.error(e) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // Client-side filtering — instant
  const filtered = useMemo(() => {
    let r = roleFilter==='All' ? allAdmins : allAdmins.filter(e=>(e.role||'').toLowerCase()===roleFilter.toLowerCase())
    if (search) r = r.filter(e=>[e.name,e.id,e.role,e.email,e.phone].some(f=>(f||'').toLowerCase().includes(search.toLowerCase())))
    return r
  }, [allAdmins, roleFilter, search])

  async function handleDelete(emp) {
    if (!confirm(`Delete ${emp.name}? This cannot be undone.`)) return
    try {
      await fetch(`${API}/api/employees/${emp.id}`, { method:'DELETE', headers:hdr() })
      setAllAdmins(p=>p.filter(e=>e.id!==emp.id))
      if (selected?.id===emp.id) setSelected(null)
    } catch(e) { alert(e.message) }
  }

  const total   = allAdmins.length
  const active  = allAdmins.filter(e=>e.status==='active').length
  const onLeave = allAdmins.filter(e=>e.status==='on_leave').length
  const alerts  = allAdmins.filter(e=>{const v=expiry(e.visa_expiry);return v&&(v.label==='Expired'||parseInt(v.label)<=60)}).length

  const CSS = `
    .adm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px}
    .adm-tab{display:flex;align-items:center;justify-content:center;gap:6px;flex:1 0 auto;padding:8px 10px;border-radius:11px;border:none;cursor:pointer;font-weight:500;font-size:12px;font-family:inherit;transition:all 0.18s;white-space:nowrap;background:transparent}
    .adm-tab.active{font-weight:700;background:var(--card);box-shadow:0 1px 6px rgba(0,0,0,0.10)}
    .adm-tab-count{font-size:10px;font-weight:700;padding:1px 6px;border-radius:20px}
    .adm-skel{background:var(--bg-alt);border-radius:16px;animation:adm-pulse 1.4s ease infinite}
    @keyframes adm-pulse{0%,100%{opacity:.45}50%{opacity:.85}}
    .adm-kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:20px}
    @media(max-width:640px){
      .adm-grid{grid-template-columns:1fr !important}
      .adm-tab{font-size:10.5px;padding:7px 6px}
      .adm-kpi{grid-template-columns:1fr 1fr !important}
    }
    @media(max-width:900px) and (min-width:641px){
      .adm-grid{grid-template-columns:repeat(2,1fr) !important}
    }
  `

  const ROLE_TAB_COLORS = {
    All:        { c:'#B8860B', bg:'#B8860B18' },
    Admin:      { c:'#7C3AED', bg:'#7C3AED18' },
    Manager:    { c:'#0F766E', bg:'#0F766E18' },
    HR:         { c:'#B45309', bg:'#B4530918' },
    Accountant: { c:'#2E7D52', bg:'#2E7D5218' },
    POC:        { c:'#B8860B', bg:'#B8860B18' },
  }

  return (
    <>
      <style>{CSS}</style>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

        {/* ── Hero ─────────────────────────────────────────────── */}
        <div style={{ background:'linear-gradient(135deg,#0f1623 0%,#1a2535 50%,#1e3a5f 100%)', borderRadius:16, padding:24 }}>

          {/* Title row */}
          <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:20, flexWrap:'wrap' }}>
            <div style={{ width:46, height:46, borderRadius:14, background:'rgba(124,58,237,0.15)', border:'1.5px solid rgba(124,58,237,0.35)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Shield size={22} color="#A78BFA"/>
            </div>
            <div>
              <div style={{ fontWeight:900, fontSize:20, color:'white', letterSpacing:'-0.02em', lineHeight:1.1 }}>Admin Staff</div>
              <div style={{ fontSize:12, color:'rgba(255,255,255,0.5)', marginTop:3 }}>Admin accounts, salaries &amp; attendance</div>
            </div>
            <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
              <button onClick={load} title="Refresh"
                style={{ width:36, height:36, borderRadius:10, background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.15)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'rgba(255,255,255,0.7)' }}>
                <RefreshCw size={14}/>
              </button>
            </div>
          </div>

          {/* KPI tiles */}
          <div className="adm-kpi">
            {[
              { label:'Total Staff', val:loading?'—':total,   color:'#B8860B' },
              { label:'Active',      val:loading?'—':active,  color:'#4ADE80' },
              { label:'On Leave',    val:loading?'—':onLeave, color:'#FBBF24' },
              { label:'Alerts',      val:loading?'—':alerts,  color:alerts>0?'#F87171':'#4ADE80' },
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

        {/* ── Search + Add Staff ───────────────────────────────── */}
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <div style={{ flex:1, position:'relative' }}>
            <Search size={14} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', pointerEvents:'none' }}/>
            <input
              style={{ width:'100%', paddingLeft:36, paddingRight:12, paddingTop:10, paddingBottom:10, borderRadius:10, border:'1px solid var(--border)', background:'var(--card)', color:'var(--text)', fontSize:13, fontFamily:'inherit', outline:'none', boxSizing:'border-box' }}
              placeholder="Search name, ID, role, email…"
              value={search} onChange={e=>setSearch(e.target.value)}/>
            {search && <button onClick={()=>setSearch('')} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:0, display:'flex' }}><X size={13}/></button>}
          </div>
          {['admin','hr','general_manager'].includes(userRole) && (
            <button onClick={()=>setModal({mode:'add',emp:null})}
              style={{ display:'flex', alignItems:'center', gap:7, padding:'10px 18px', borderRadius:10, border:'none', background:'#B8860B', color:'white', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit', flexShrink:0, whiteSpace:'nowrap', transition:'background 0.15s' }}
              onMouseEnter={e=>e.currentTarget.style.background='#9a7209'}
              onMouseLeave={e=>e.currentTarget.style.background='#B8860B'}>
              <Plus size={14}/> Add Staff
            </button>
          )}
        </div>

        {/* ── Role filter tabs ─────────────────────────────────── */}
        <div style={{ display:'flex', gap:3, background:'var(--bg-alt)', borderRadius:14, padding:3, overflowX:'auto' }}>
          {ROLE_TABS.map(r=>{
            const count = r==='All' ? allAdmins.length : allAdmins.filter(e=>(e.role||'').toLowerCase()===r.toLowerCase()).length
            const tc = ROLE_TAB_COLORS[r] || ROLE_TAB_COLORS.All
            const isOn = roleFilter===r
            return (
              <button key={r} onClick={()=>setRoleFilter(r)}
                className={`adm-tab${isOn?' active':''}`}
                style={{ color:isOn?tc.c:'var(--text-muted)', background:isOn?tc.bg:'transparent' }}>
                {r}
                <span className="adm-tab-count"
                  style={{ background:isOn?tc.bg:'var(--border)', color:isOn?tc.c:'var(--text-muted)' }}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* ── Cards ────────────────────────────────────────────── */}
        {loading ? (
          <div className="adm-grid">
            {[1,2,3,4,5,6].map(i=><div key={i} className="adm-skel" style={{ height:140 }}/>)}
          </div>
        ) : filtered.length===0 ? (
          <div style={{ textAlign:'center', padding:'60px 20px' }}>
            <Shield size={40} style={{ margin:'0 auto 12px', display:'block', opacity:0.15 }}/>
            <div style={{ fontWeight:700, fontSize:15, color:'var(--text-sub)' }}>{search?`No results for "${search}"`:'No admin staff yet'}</div>
          </div>
        ) : (
          <div className="adm-grid">
            {filtered.map((emp,i)=>(
              <AdminCard key={emp.id} emp={emp} index={i}
                isSelected={selected?.id===emp.id}
                onClick={()=>setSelected(selected?.id===emp.id?null:emp)}
                onEdit={e=>setModal({mode:'edit',emp:e})}
                onDelete={handleDelete}
                userRole={userRole}/>
            ))}
          </div>
        )}
      </div>

      {/* ── Detail — centered modal ──────────────────────────── */}
      {selected && (
        <div style={{ position:'fixed', inset:0, zIndex:9998, background:'rgba(0,0,0,0.55)', backdropFilter:'blur(6px)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
          onClick={()=>setSelected(null)}>
          <div style={{ background:'var(--card)', borderRadius:20, width:'100%', maxWidth:700, maxHeight:'90vh', overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'0 25px 60px rgba(0,0,0,0.45)', border:'1px solid var(--border)' }}
            onClick={e=>e.stopPropagation()}>
            <DetailDrawer emp={selected} onEdit={()=>setModal({mode:'edit',emp:selected})} onDelete={()=>handleDelete(selected)} onClose={()=>setSelected(null)} onRefresh={load} userRole={userRole}
              onCreateProfile={u=>setModal({mode:'add',emp:{name:u.name,role:u.role,station_code:u.station_code},linkUserId:u.userId})}/>
          </div>
        </div>
      )}

      {/* ── Add/Edit modal ───────────────────────────────────── */}
      {modal && (
        <AdminModal
          emp={modal.emp}
          mode={modal.mode}
          onClose={()=>setModal(null)}
          onSave={async (savedEmp) => {
            if (modal.linkUserId && savedEmp?.id) {
              try {
                await fetch(`${API}/api/auth/users/${modal.linkUserId}`, {
                  method:'PUT', headers:hdr(),
                  body: JSON.stringify({ emp_id: savedEmp.id })
                })
              } catch(e) { console.error('Link failed:', e) }
            }
            setModal(null); load()
          }}/>
      )}
    </>
  )
}
