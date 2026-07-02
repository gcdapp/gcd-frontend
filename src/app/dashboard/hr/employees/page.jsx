'use client'
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { empApi } from '@/lib/api'
import { useSocket } from '@/lib/socket'
import {
  Search, Plus, X, Pencil, Trash2, Phone, User, Building2,
  AlertCircle, CheckCircle2, Briefcase, CreditCard, Calendar,
  Users, Receipt, ExternalLink, Shield, ChevronRight, Truck, ArrowLeftRight,
  Mail, MapPin, Clock, AlertTriangle, Wallet, TrendingUp, FileText, RefreshCw
} from 'lucide-react'
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

const EMPTY = {
  id:'', name:'', role:'Driver', dept:'Operations', status:'active',
  salary:'', joined:'', phone:'', work_number:'', nationality:'', zone:'',
  visa_expiry:'', license_expiry:'', avatar:'',
  station_code:'DDB1', hourly_rate:'3.85',
  iloe_expiry:'', annual_leave_start:'',
  amazon_id:'', emirates_id:'', annual_leave_balance:30,
  visa_type:'company',
  project_type:'pulser', per_shipment_rate:'0.5', performance_bonus:'100',
  login_email:'', login_password:'',
  // Extended personal / WPS fields
  sub_group_name:'', beneficiary_first_name:'', beneficiary_middle_name:'',
  beneficiary_last_name:'', father_family_name:'', dob:'', gender:'',
  marital_status:'', uid_number:'', emirates_issuing_visa:'',
  residential_location:'', work_location:'', passport_no:'', email_id:'', visa_file_no:'',
  insurance_url:''
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

/* ── Label ───────────────────────────────────────────────────── */
function Lbl({ children }) {
  return <label style={{ display:'block', fontSize:10.5, fontWeight:700, letterSpacing:'0.07em', textTransform:'uppercase', color:'var(--text-muted)', marginBottom:5 }}>{children}</label>
}

/* ── Modal ───────────────────────────────────────────────────── */
function EmpModal({ emp, onSave, onClose, mode }) {
  const [form, setForm] = useState(() => emp ? {
    ...emp,
    salary:               emp.salary||'',
    hourly_rate:          emp.hourly_rate||'3.85',
    annual_leave_balance: emp.annual_leave_balance||30,
    joined:               emp.joined?.slice(0,10)||'',
    visa_expiry:          emp.visa_expiry?.slice(0,10)||'',
    license_expiry:       emp.license_expiry?.slice(0,10)||'',
    iloe_expiry:          emp.iloe_expiry?.slice(0,10)||'',
    annual_leave_start:   emp.annual_leave_start?.slice(0,10)||'',
    dob:                  emp.dob?.slice(0,10)||'',
    visa_type:            emp.visa_type||'company',
    project_type:         emp.project_type||'pulser',
    per_shipment_rate:    emp.per_shipment_rate||'0.5',
    performance_bonus:    emp.performance_bonus||'100',
    sub_group_name:           emp.sub_group_name||'',
    beneficiary_first_name:   emp.beneficiary_first_name||'',
    beneficiary_middle_name:  emp.beneficiary_middle_name||'',
    beneficiary_last_name:    emp.beneficiary_last_name||'',
    father_family_name:       emp.father_family_name||'',
    gender:                   emp.gender||'',
    marital_status:            emp.marital_status||'',
    uid_number:               emp.uid_number||'',
    emirates_issuing_visa:    emp.emirates_issuing_visa||'',
    residential_location:     emp.residential_location||'',
    work_location:            emp.work_location||'',
    passport_no:              emp.passport_no||'',
    email_id:                 emp.email_id||'',
    visa_file_no:             emp.visa_file_no||'',
    insurance_url:            emp.insurance_url||'',
    login_email:'', login_password:''
  } : EMPTY)
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState(null)
  const [tab,    setTab]    = useState('identity')

  function set(k,v) { setForm(p=>({...p,[k]:v})) }

  async function handleSave() {
    if (!form.name||!form.role||!form.dept) return setErr('Name, role and department required')
    if (mode==='add'&&!form.id) return setErr('Employee ID required')
    setSaving(true); setErr(null)
    try {
      const safeDate = v => (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) ? v : null
      const data = {
        ...form,
        salary:             Number(form.salary)||0,
        hourly_rate:        Number(form.hourly_rate)||3.85,
        per_shipment_rate:  Number(form.per_shipment_rate)||0.5,
        performance_bonus:  Number(form.performance_bonus)||100,
        annual_leave_balance: Number(form.annual_leave_balance)||30,
        dob:                safeDate(form.dob),
        joined:             safeDate(form.joined),
        visa_expiry:        safeDate(form.visa_expiry),
        license_expiry:     safeDate(form.license_expiry),
        iloe_expiry:        safeDate(form.iloe_expiry),
        annual_leave_start: safeDate(form.annual_leave_start),
      }
      const res = mode==='add' ? await empApi.create(data) : await empApi.update(form.id,data)
      if (mode==='add'&&form.login_email&&form.login_password) {
        const empId = res?.employee?.id||form.id
        await fetch(`${API}/api/employees/${empId}/create-user`,{method:'POST',headers:hdr(),body:JSON.stringify({email:form.login_email.trim().toLowerCase(),password:form.login_password})}).catch(()=>{})
      }
      onSave()
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
    {id:'identity',l:'Identity'},
    {id:'personal',l:'Personal'},
    {id:'work',l:'Work & Pay'},
    {id:'docs',l:'Documents'},
    ...(mode==='add'?[{id:'login',l:'Login'}]:[]),
  ]

  const previewSalary = () => {
    const base=Number(form.salary||0), rate=Number(form.hourly_rate||3.85)
    const perf=Number(form.performance_bonus||100), perShip=Number(form.per_shipment_rate||0.5)
    if (form.project_type==='cret')   return `AED ${base} + shipments × ${perShip}`
    if (form.project_type==='pulser') return `AED ${base} + hours × ${rate} + ${perf} bonus`
    return `AED ${base} (fixed salary)`
  }

  return (
    <div className="modal-overlay" style={{ zIndex:9999 }}>
      <div style={{ background:'var(--card)', borderRadius:20, width:'100%', maxWidth:540, maxHeight:'92vh', overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)' }}>
        {/* Header */}
        <div style={{ padding:'20px 24px 0', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
            <div>
              <h3 style={{ fontWeight:800, fontSize:16, color:'var(--text)', margin:0 }}>{mode==='add'?'Add New DA':'Edit DA'}</h3>
              <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>{mode==='add'?'Create a new Delivery Associate':emp?.name}</p>
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

        {/* Body */}
        <div style={{ padding:'20px 24px', overflowY:'auto', flex:1 }}>
          {err && (
            <div style={{ display:'flex', gap:8, alignItems:'center', background:'var(--red-bg)', border:'1px solid var(--red-border)', borderRadius:10, padding:'10px 14px', fontSize:12.5, color:'var(--red)', marginBottom:14 }}>
              <AlertCircle size={14}/>{err}
            </div>
          )}

          {tab==='identity' && (
            <div className="modal-two-col">
              {mode==='add' && inp('Employee ID *','id','text','DA001')}
              {inp('Full Name *','name','text','Mohammed Al Rashid')}
              {inp('Phone Number','phone','tel','+971 50 XXX XXXX')}
              {inp('Work Number','work_number','text','Internal contact')}
              {inp('Amazon / Transporter ID','amazon_id','text','TRS-00123')}
              {inp('Emirates ID','emirates_id','text','784-XXXX-XXXXXXX-X')}
              {inp('Nationality','nationality','text','UAE')}
              <div style={{ gridColumn:'span 2' }}>
                <Lbl>Visa Type</Lbl>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  {[
                    { v:'company', l:'Company Visa',  d:'Sponsored by Golden Crescent' },
                    { v:'own',     l:'Own Visa',       d:"Employee's own sponsorship"  },
                  ].map(opt => (
                    <button key={opt.v} type="button" onClick={() => set('visa_type', opt.v)}
                      style={{ padding:'12px', borderRadius:11, border:`2px solid ${form.visa_type===opt.v?'var(--gold)':'var(--border)'}`, background:form.visa_type===opt.v?'var(--amber-bg)':'var(--card)', cursor:'pointer', textAlign:'left', transition:'all 0.15s' }}>
                      <div style={{ fontWeight:700, fontSize:13, color:form.visa_type===opt.v?'var(--gold)':'var(--text)' }}>{opt.l}</div>
                      <div style={{ fontSize:10.5, color:'var(--text-muted)', marginTop:2 }}>{opt.d}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab==='personal' && (
            <div className="modal-two-col">
              {inp('Sub Group Name','sub_group_name')}
              {inp('Passport No','passport_no','text','A1234567')}
              {inp('Email ID','email_id','email','name@example.com')}
              {inp('Visa File No','visa_file_no')}
              {inp('UID Number','uid_number')}
              {inp('Emirates Issuing Visa','emirates_issuing_visa','text','Dubai')}
              {inp('Father / Family Name','father_family_name')}
              {inp('Date of Birth','dob','date')}
              {sel('Gender','gender',[{v:'',l:'— Select —'},{v:'Male',l:'Male'},{v:'Female',l:'Female'}])}
              {sel('Marital Status','marital_status',[{v:'',l:'— Select —'},{v:'Single',l:'Single'},{v:'Married',l:'Married'},{v:'Divorced',l:'Divorced'},{v:'Widowed',l:'Widowed'}])}
              {inp('Residential Location','residential_location','text','Dubai, Al Quoz')}
              {inp('Work Location','work_location','text','DXE6 Station')}
            </div>
          )}

          {tab==='work' && (
            <div className="modal-two-col">
              {sel('Role *','role',['Driver','HR Manager','Finance Mgr','Accountant','Dispatcher','General Manager','Admin','POC','Other'])}
              {sel('Department *','dept',['Operations','HR','Finance','Admin','Other'])}
              {sel('Station','station_code',['DDB1','DXE6'])}
              {sel('Status','status',[{v:'active',l:'Active'},{v:'on_leave',l:'On Leave'},{v:'inactive',l:'Inactive'}])}
              <div style={{ gridColumn:'span 2' }}>
                <div style={{ background:'var(--purple-bg)', border:'1px solid var(--purple-border)', borderRadius:12, padding:'14px 16px' }}>
                  <label style={{ fontSize:11, fontWeight:800, letterSpacing:'0.06em', textTransform:'uppercase', color:'#7C3AED', marginBottom:10, display:'block' }}>Project & Salary Type</label>
                  <div style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', margin:'2px 0 6px' }}>Amazon</div>
                  <div className="modal-proj-col" style={{ marginBottom:10 }}>
                    {[{v:'pulser',l:'Pulser',d:'Base + Hours × Rate + Bonus'},{v:'cret',l:'CRET',d:'Base + Shipments × Rate'},{v:'office',l:'Office',d:'Fixed Base Salary'}].map(p=>(
                      <button key={p.v} onClick={e=>{e.stopPropagation();set('project_type',p.v)}} type="button"
                        style={{ padding:'11px', borderRadius:10, border:`2px solid ${form.project_type===p.v?'#7C3AED':'var(--border)'}`, background:form.project_type===p.v?'var(--purple-bg)':'var(--card)', cursor:'pointer', textAlign:'left', transition:'all 0.15s' }}>
                        <div style={{ fontWeight:700, fontSize:13, color:form.project_type===p.v?'#7C3AED':'var(--text)' }}>{p.l}</div>
                        <div style={{ fontSize:10.5, color:'var(--text-muted)', marginTop:2 }}>{p.d}</div>
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', margin:'2px 0 6px' }}>Other Clients</div>
                  <div className="modal-proj-col" style={{ marginBottom:12 }}>
                    {[
                      {v:'creative_packers',l:'Creative Packers',d:'Fixed Base Salary'},
                      {v:'ig_rak',l:'IG RAK',d:'Fixed Base Salary'},
                      {v:'imile',l:'IMILE Delivery Services',d:'Fixed Base Salary'},
                      {v:'jnt_express',l:'Jnt Express',d:'Fixed Base Salary'},
                      {v:'le_chocola',l:'Le Chocola',d:'Fixed Base Salary'},
                    ].map(p=>(
                      <button key={p.v} onClick={e=>{e.stopPropagation();set('project_type',p.v)}} type="button"
                        style={{ padding:'11px', borderRadius:10, border:`2px solid ${form.project_type===p.v?'#7C3AED':'var(--border)'}`, background:form.project_type===p.v?'var(--purple-bg)':'var(--card)', cursor:'pointer', textAlign:'left', transition:'all 0.15s' }}>
                        <div style={{ fontWeight:700, fontSize:13, color:form.project_type===p.v?'#7C3AED':'var(--text)' }}>{p.l}</div>
                        <div style={{ fontSize:10.5, color:'var(--text-muted)', marginTop:2 }}>{p.d}</div>
                      </button>
                    ))}
                  </div>
                  <div className="modal-proj-col">
                    {inp('Base Salary (AED)','salary','number','3800')}
                    {form.project_type==='pulser' && inp('Hourly Rate','hourly_rate','number','3.85')}
                    {form.project_type==='cret' && inp('Per Shipment Rate','per_shipment_rate','number','0.5')}
                    {form.project_type==='pulser' && inp('Performance Bonus','performance_bonus','number','100')}
                  </div>
                  <div style={{ marginTop:10, background:form.project_type==='pulser'?'var(--green-bg)':form.project_type==='cret'?'var(--blue-bg)':'var(--amber-bg)', borderRadius:9, padding:'8px 12px', fontSize:12, color:form.project_type==='pulser'?'var(--green)':form.project_type==='cret'?'var(--blue)':'#92400E', fontWeight:600 }}>
                    Formula: {previewSalary()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab==='docs' && (
            <div style={{ display:'flex', flexDirection:'column', gap:13 }}>
              <div className="modal-two-col">
                {inp('Visa Expiry','visa_expiry','date')}
                {inp('License Expiry','license_expiry','date')}
                {inp('ILOE Expiry','iloe_expiry','date')}
              </div>
              <div>
                <Lbl>Insurance Card (Google Drive URL)</Lbl>
                <input className="input" type="url" value={form.insurance_url||''} autoComplete="off" spellCheck={false}
                  placeholder="https://drive.google.com/file/d/…/view"
                  onChange={e=>set('insurance_url',e.target.value)}/>
                <div style={{ fontSize:10.5, color:'var(--text-muted)', marginTop:5 }}>
                  Paste the Google Drive sharing link. The DA will see their insurance card in the portal.
                </div>
              </div>
            </div>
          )}

          {tab==='login' && mode==='add' && (
            <div style={{ display:'flex', flexDirection:'column', gap:13 }}>
              <div style={{ background:'var(--amber-bg)', border:'1px solid var(--amber-border)', borderRadius:10, padding:'12px 14px', fontSize:12.5, color:'#92400E' }}>
                <strong>Optional:</strong> Creates a driver portal login for this DA.
              </div>
              <div className="modal-two-col">
                {inp('Login Email','login_email','email','da@goldencrescent.ae')}
                {inp('Login Password','login_password','password','Min 6 characters')}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding:'14px 24px 20px', borderTop:'1px solid var(--border)', display:'flex', gap:10, justifyContent:'flex-end', flexShrink:0 }}>
          <button onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ minWidth:120, justifyContent:'center' }}>
            {saving ? <><span style={{ width:13,height:13,border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'white',borderRadius:'50%',animation:'spin 0.8s linear infinite',display:'inline-block'}}/> Saving…</> : mode==='add'?'Add DA':'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Work Number Assigner ─────────────────────────────────────── */
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
        method:'POST', headers:hdr(),
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

      {/* ── Conflict step 1 ── */}
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

      {/* ── Conflict step 2 ── */}
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

      {/* ── View mode ── */}
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

      {/* ── SIM picker ── */}
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

      {/* ── History panel ── */}
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

/* ── Detail Drawer ───────────────────────────────────────────── */
function DetailDrawer({ emp, onEdit, onDelete, onClose, onRefresh, userRole, onSelectEmployee }) {
  const [leaves,     setLeaves]    = useState([])
  const [leavesLoad, setLeavesLoad]= useState(true)
  const [expenses,   setExpenses]  = useState([])
  const [expLoad,    setExpLoad]   = useState(false)
  const [fleetHv,    setFleetHv]   = useState([])
  const [fleetAsgn,  setFleetAsgn] = useState([])
  const [fleetLoad,  setFleetLoad] = useState(false)
  const [attendance, setAttendance]= useState([])
  const [attLoad,    setAttLoad]   = useState(false)
  const [tab,        setTab]       = useState('overview')
  const [isMobile,   setIsMobile]  = useState(false)

  const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('gcd_token')}` })

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900)
    check(); window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Eager loads — shown on Overview
  useEffect(() => {
    setLeavesLoad(true)
    fetch(`${API}/api/leaves?emp_id=${emp.id}&stage=all`, { headers: auth() })
      .then(r => r.json()).then(d => setLeaves(d.leaves || [])).catch(() => setLeaves([])).finally(() => setLeavesLoad(false))
  }, [emp.id])

  useEffect(() => {
    setAttLoad(true)
    const month = new Date().toISOString().slice(0, 7)
    fetch(`${API}/api/attendance?emp_id=${emp.id}&month=${month}`, { headers: auth() })
      .then(r => r.json()).then(d => setAttendance(d.records || d.attendance || [])).catch(() => setAttendance([])).finally(() => setAttLoad(false))
  }, [emp.id])

  // Lazy loads
  useEffect(() => {
    if (tab !== 'expenses') return
    setExpLoad(true)
    fetch(`${API}/api/expenses?emp_id=${emp.id}`, { headers: auth() })
      .then(r => r.json()).then(d => setExpenses(d.expenses || [])).catch(() => setExpenses([])).finally(() => setExpLoad(false))
  }, [tab, emp.id])

  useEffect(() => {
    if (tab !== 'fleet') return
    setFleetLoad(true)
    Promise.all([
      fetch(`${API}/api/handovers?emp_id=${emp.id}`, { headers: auth() }).then(r => r.json()).catch(() => ({ handovers: [] })),
      fetch(`${API}/api/vehicles/assignments/history?emp_id=${emp.id}`, { headers: auth() }).then(r => r.json()).catch(() => ({ history: [] })),
    ]).then(([hv, asgn]) => { setFleetHv(hv.handovers || []); setFleetAsgn(asgn.history || []) }).finally(() => setFleetLoad(false))
  }, [tab, emp.id])

  // ── Computed values ─────────────────────────────────────────
  const s           = STATUS[emp.status] || STATUS.inactive
  const sc          = SC_COLOR[emp.station_code]  || '#B8860B'
  const sbg         = SC_BG[emp.station_code]     || '#FFFBEB'
  const sbc         = SC_BORDER[emp.station_code] || '#FDE68A'
  const serviceDays = emp.joined ? differenceInDays(new Date(), parseISO(emp.joined.slice(0,10))) : 0
  const serviceYrs  = Math.floor(serviceDays / 365)
  const serviceMos  = Math.floor((serviceDays % 365) / 30)
  const serviceStr  = serviceYrs > 0 ? `${serviceYrs}yr ${serviceMos}mo` : serviceDays > 30 ? `${Math.floor(serviceDays/30)}mo` : `${serviceDays}d`
  const today       = new Date().toISOString().slice(0, 10)
  const onLeaveNow  = leaves.filter(l => l.status === 'approved' && l.from_date <= today && l.to_date >= today).length
  const usedByType  = type => leaves.filter(l => l.type === type && l.status === 'approved').reduce((a, l) => a + (l.days || 0), 0)
  const usedAnnual  = usedByType('Annual')
  const usedSick    = usedByType('Sick')
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
  const visaChip   = docChip(emp.visa_expiry)
  const licChip    = docChip(emp.license_expiry)
  const iloeChip   = docChip(emp.iloe_expiry)
  const alertCount = [emp.visa_expiry, emp.license_expiry, emp.iloe_expiry].filter(d => { const n = docDays(d); return n !== null && n <= 30 }).length
  const attPresent = attendance.filter(a => a.status === 'present').length
  const attAbsent  = attendance.filter(a => a.status === 'absent').length
  const attLeave   = attendance.filter(a => a.status === 'leave').length

  const TABS = [
    { id:'overview',  l:'Overview'  },
    { id:'leaves',    l:`Leaves${leaves.length ? ` (${leaves.length})` : ''}` },
    { id:'documents', l:'Documents' },
    { id:'sims',      l:'SIMs'      },
    { id:'fleet',     l:'Fleet'     },
    { id:'expenses',  l:'Expenses'  },
  ]

  // ── Sub-components ──────────────────────────────────────────
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
  const InfoItem = InfoRow

  function DocRow({ label, date }) {
    const chip = docChip(date)
    const days = docDays(date)
    const isAlert = chip && (days === null || days <= 30)
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

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', fontFamily:'Poppins,sans-serif', overflow:'hidden' }}>

      {/* ══ DARK HERO HEADER ════════════════════════════════════ */}
      <div style={{ background:'linear-gradient(135deg,#0f1623 0%,#1a2535 55%,#1e3a5f 100%)', padding:'20px 22px 18px', flexShrink:0 }}>

        {/* Top row: avatar + name + actions */}
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

          <div style={{ display:'flex', gap:6, flexShrink:0 }}>
            {userRole !== 'accountant' && (
              <button onClick={onEdit} style={{ padding:'8px 18px', borderRadius:10, background:'#B8860B', color:'white', fontWeight:700, fontSize:12.5, border:'none', cursor:'pointer', fontFamily:'Poppins,sans-serif', boxShadow:'0 2px 10px rgba(184,134,11,0.4)' }}>Edit</button>
            )}
            <button onClick={onClose} style={{ width:36, height:36, borderRadius:10, background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.14)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'rgba(255,255,255,0.6)' }}><X size={15}/></button>
          </div>
        </div>

        {/* KPI tiles */}
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

        {/* Alert banner */}
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

      {/* ══ TABS ════════════════════════════════════════════════ */}
      <div style={{ display:'flex', overflowX:'auto', borderBottom:'1px solid var(--border)', flexShrink:0, background:'var(--card)', scrollbarWidth:'none', padding:'0 4px' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding:'11px 16px', fontSize:12.5, fontWeight:tab===t.id?700:500, color:tab===t.id?'#B8860B':'var(--text-muted)', background:'none', border:'none', borderBottom:`2.5px solid ${tab===t.id?'#B8860B':'transparent'}`, cursor:'pointer', fontFamily:'Poppins,sans-serif', marginBottom:-1, whiteSpace:'nowrap', flexShrink:0, transition:'all 0.15s' }}>
            {t.l}
          </button>
        ))}
      </div>

      {/* ══ SCROLLABLE CONTENT ══════════════════════════════════ */}
      <div style={{ flex:1, overflowY:'auto', padding:'16px 18px', display:'flex', flexDirection:'column', gap:12 }}>

        {/* ════ OVERVIEW ════ */}
        {tab === 'overview' && (<>

          {/* Contact + Employment 2-col */}
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

          {/* Documents */}
          <Section title="Document Expiry" icon={FileText}>
            <DocRow label="UAE Visa"        date={emp.visa_expiry}/>
            <DocRow label="Driving License" date={emp.license_expiry}/>
            <DocRow label="ILOE"            date={emp.iloe_expiry}/>
            {emp.insurance_url && (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px' }}>
                <span style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>Insurance Card</span>
                <a href={emp.insurance_url} target="_blank" rel="noreferrer" style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, fontWeight:700, color:'#B8860B', textDecoration:'none' }}>
                  View <ExternalLink size={11}/>
                </a>
              </div>
            )}
          </Section>

          {/* Leave Balance + Attendance side by side */}
          <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 1fr', gap:12 }}>
            <Section title="Leave Balance" icon={Calendar}>
              <div style={{ padding:'14px 16px', display:'flex', flexDirection:'column', gap:14 }}>
                {[
                  { label:'Annual Leave', used:usedAnnual, total:30, c:'#7C3AED' },
                ].map(lb => (
                  <div key={lb.label}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:7 }}>
                      <span style={{ fontSize:12.5, fontWeight:600, color:'var(--text)' }}>{lb.label}</span>
                      <span style={{ fontSize:11.5, color:'var(--text-muted)', fontWeight:500 }}>{leavesLoad ? '…' : `${lb.used} / ${lb.total}d`}</span>
                    </div>
                    <div style={{ height:8, borderRadius:99, background:'var(--border)', overflow:'hidden' }}>
                      {!leavesLoad && <div style={{ height:'100%', width:`${Math.min(100,(lb.used/lb.total)*100)}%`, background:`linear-gradient(90deg,${lb.c}aa,${lb.c})`, borderRadius:99, transition:'width 0.6s cubic-bezier(0.16,1,0.3,1)' }}/>}
                    </div>
                    <div style={{ fontSize:10.5, color:lb.c, marginTop:5, fontWeight:700 }}>
                      {!leavesLoad && `${Math.max(0,lb.total-lb.used)} days remaining`}
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Attendance — This Month" icon={Clock}>
              <div style={{ padding:'14px 16px' }}>
                {attLoad ? (
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                    {[1,2,3].map(i => <div key={i} className="sk" style={{ height:52, borderRadius:10 }}/>)}
                  </div>
                ) : (
                  <>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:12 }}>
                      {[
                        { l:'Present', v:attPresent, c:'#059669', bg:'#F0FDF4' },
                        { l:'Absent',  v:attAbsent,  c:'#DC2626', bg:'#FEF2F2' },
                        { l:'Leave',   v:attLeave,   c:'#D97706', bg:'#FFFBEB' },
                      ].map(a => (
                        <div key={a.l} style={{ textAlign:'center', padding:'9px 6px', borderRadius:10, background:a.bg, border:'1px solid var(--border)' }}>
                          <div style={{ fontWeight:900, fontSize:20, color:a.c, lineHeight:1 }}>{a.v}</div>
                          <div style={{ fontSize:9.5, fontWeight:600, color:a.c, opacity:0.8, marginTop:4 }}>{a.l}</div>
                        </div>
                      ))}
                    </div>
                    {attendance.length > 0 && (
                      <div style={{ display:'flex', gap:3, flexWrap:'wrap' }}>
                        {attendance.slice(0,31).map((a, i) => {
                          const c = a.status==='present'?'#059669':a.status==='absent'?'#DC2626':'#D97706'
                          return <div key={i} title={`${a.date?.slice(0,10)} · ${a.status}`} style={{ width:8, height:22, borderRadius:3, background:c, opacity:0.8, flexShrink:0 }}/>
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            </Section>
          </div>
        </>)}

        {/* ════ LEAVES ════ */}
        {tab === 'leaves' && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
              {[
                { l:'Total',    v:leaves.length,                                  c:'var(--text)', bg:'var(--bg-alt)' },
                { l:'Approved', v:leaves.filter(l=>l.status==='approved').length, c:'#059669',     bg:'#F0FDF4'       },
                { l:'Pending',  v:leaves.filter(l=>l.status==='pending').length,  c:'#D97706',     bg:'#FFFBEB'       },
              ].map(s => (
                <div key={s.l} style={{ textAlign:'center', padding:'12px 8px', borderRadius:12, background:s.bg, border:'1px solid var(--border)' }}>
                  <div style={{ fontWeight:900, fontSize:22, color:s.c, lineHeight:1 }}>{s.v}</div>
                  <div style={{ fontSize:10, fontWeight:600, color:s.c, opacity:0.8, marginTop:5 }}>{s.l}</div>
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

        {/* ════ DOCUMENTS ════ */}
        {tab === 'documents' && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <Section title="Expiry Dates">
              <DocRow label="UAE Visa"        date={emp.visa_expiry}/>
              <DocRow label="Driving License" date={emp.license_expiry}/>
              <DocRow label="ILOE"            date={emp.iloe_expiry}/>
            </Section>
            <Section title="Identity & Numbers">
              <InfoItem icon={CreditCard} label="Passport No"     value={emp.passport_no}          mono/>
              <InfoItem icon={Shield}     label="Emirates ID"     value={emp.emirates_id}           mono/>
              <InfoItem icon={FileText}   label="UID Number"      value={emp.uid_number}            mono/>
              <InfoItem icon={FileText}   label="Visa File No"    value={emp.visa_file_no}/>
              <InfoItem icon={MapPin}     label="Issuing Emirate" value={emp.emirates_issuing_visa}/>
              <InfoItem icon={User}       label="Visa Type"       value={emp.visa_type==='own'?'Own Visa':'Company Visa'}/>
              <InfoItem icon={FileText}   label="Sub Group"       value={emp.sub_group_name}/>
            </Section>
            {emp.insurance_url ? (
              <Section title="Insurance Card">
                <div style={{ padding:'14px 16px' }}>
                  <a href={emp.insurance_url} target="_blank" rel="noreferrer"
                    style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'13px', borderRadius:12, background:'var(--amber-bg)', border:'1px solid var(--amber-border)', color:'#B8860B', fontWeight:700, fontSize:13, fontFamily:'Poppins,sans-serif', textDecoration:'none' }}>
                    <FileText size={14}/> View Insurance Card <ExternalLink size={12}/>
                  </a>
                </div>
              </Section>
            ) : (
              <div style={{ textAlign:'center', padding:'20px', background:'var(--bg-alt)', border:'1px solid var(--border)', borderRadius:14, fontSize:12, color:'var(--text-muted)' }}>
                No insurance card on file
              </div>
            )}
          </div>
        )}

        {/* ════ SIMS ════ */}
        {tab === 'sims' && (
          <div>
            <WorkNumberAssigner emp={emp} onSaved={onRefresh} userRole={userRole} onSelectEmployee={onSelectEmployee}/>
            <div style={{ marginTop:10, background:'var(--bg-alt)', border:'1px solid var(--border)', borderRadius:12, padding:'12px 14px' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:5 }}>Personal Phone</div>
              <div style={{ fontSize:13.5, fontWeight:700, color:'var(--text)' }}>{emp.phone || '—'}</div>
            </div>
          </div>
        )}

        {/* ════ FLEET ════ */}
        {tab === 'fleet' && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {fleetLoad ? (
              [1,2,3].map(i => <div key={i} className="sk" style={{ height:72, borderRadius:12 }}/>)
            ) : (
              <>
                {/* Current vehicle highlight */}
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

                {/* Handover history */}
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
                            {(h.fuel_level||h.odometer||h.condition_note) && (
                              <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginTop:5 }}>
                                {h.fuel_level && <span style={{ fontSize:10.5, color:'var(--text-sub)' }}>Fuel: {h.fuel_level}</span>}
                                {h.odometer && <span style={{ fontSize:10.5, color:'var(--text-sub)' }}>ODO: {h.odometer} km</span>}
                                {h.condition_note && <span style={{ fontSize:10.5, color:'var(--text-sub)' }}>{h.condition_note}</span>}
                              </div>
                            )}
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

        {/* ════ EXPENSES ════ */}
        {tab === 'expenses' && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <a href={`/dashboard/finance/expenses?emp_id=${emp.id}`}
              style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'10px 14px', borderRadius:10, background:'var(--blue-bg)', border:'1px solid var(--blue-border)', color:'var(--blue)', fontWeight:600, fontSize:12, textDecoration:'none' }}>
              <Receipt size={13}/> View All Expenses <ExternalLink size={11}/>
            </a>
            {expLoad
              ? [1,2,3].map(i => <div key={i} className="sk" style={{ height:68, borderRadius:12 }}/>)
              : expenses.length === 0
                ? <div style={{ textAlign:'center', padding:'40px 20px' }}>
                    <Receipt size={32} style={{ margin:'0 auto 12px', display:'block', opacity:0.15 }}/>
                    <div style={{ fontSize:13, color:'var(--text-muted)' }}>No expense records</div>
                  </div>
                : expenses.slice(0,30).map(ex => (
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

      </div>
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
  const [allEmployees, setAllEmployees] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [station,      setStation]      = useState('All')
  const [filterTab,    setFilterTab]    = useState('all')
  const [selected,     setSelected]     = useState(null)
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
    'employee:updated': e      => { setAllEmployees(p=>p.map(x=>x.id===e.id?e:x)); setSelected(s=>s?.id===e.id?e:s) },
    'employee:deleted': ({id}) => { setAllEmployees(p=>p.filter(x=>x.id!==id)); setSelected(s=>s?.id===id?null:s) },
  })

  async function handleDelete(emp) {
    if (!confirm(`Delete ${emp.name}? This cannot be undone.`)) return
    try { await empApi.delete(emp.id); setAllEmployees(p=>p.filter(e=>e.id!==emp.id)); if(selected?.id===emp.id) setSelected(null) }
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
                  isSelected={selected?.id===emp.id}
                  onClick={()=>setSelected(selected?.id===emp.id?null:emp)}
                  onEdit={e=>setModal({mode:'edit',emp:e})}
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

      {/* ── Detail — centered modal ──────────────────────────── */}
      {selected && (
        <div style={{ position:'fixed', inset:0, zIndex:9998, background:'rgba(0,0,0,0.55)', backdropFilter:'blur(6px)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
          onClick={()=>setSelected(null)}>
          <div style={{ background:'var(--card)', borderRadius:20, width:'100%', maxWidth:700, maxHeight:'90vh', overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'0 25px 60px rgba(0,0,0,0.45)', border:'1px solid var(--border)' }}
            onClick={e=>e.stopPropagation()}>
            <DetailDrawer emp={selected} onEdit={()=>setModal({mode:'edit',emp:selected})} onDelete={()=>handleDelete(selected)} onClose={()=>setSelected(null)} onRefresh={load} userRole={userRole}
              onSelectEmployee={id=>{const t=allEmployees.find(e=>e.id===id);if(t)setSelected(t)}}/>
          </div>
        </div>
      )}

      {modal && <EmpModal key={`${modal.mode}-${modal.emp?.id||'new'}`} mode={modal.mode} emp={modal.emp} onClose={()=>setModal(null)} onSave={()=>{setModal(null);load()}}/>}
    </>
  )
}