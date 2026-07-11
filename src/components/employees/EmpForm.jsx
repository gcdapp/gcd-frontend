'use client'
import { useState } from 'react'
import { empApi, API } from '@/lib/api'
import { X, AlertCircle } from 'lucide-react'

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

function Lbl({ children }) {
  return <label style={{ display:'block', fontSize:10.5, fontWeight:700, letterSpacing:'0.07em', textTransform:'uppercase', color:'var(--text-muted)', marginBottom:5 }}>{children}</label>
}

/**
 * Driver info form — the "Update Driver Info" / "Add DA" form body.
 * Renders just the card (header + tabs + body + footer), no overlay, so it
 * can be dropped into a modal (Add DA, hr/employees/page.jsx) or a full page
 * (Update Driver Info, hr/employees/[id]/edit/page.jsx).
 */
export default function EmpForm({ emp, mode, onSaved, onCancel, maxWidth = 540 }) {
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
      onSaved?.(res?.employee)
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
    <div style={{ background:'var(--card)', borderRadius:20, width:'100%', maxWidth, maxHeight:'92vh', overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)' }}>
      {/* Header */}
      <div style={{ padding:'20px 24px 0', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
          <div>
            <h3 style={{ fontWeight:800, fontSize:16, color:'var(--text)', margin:0 }}>{mode==='add'?'Add New DA':'Edit DA'}</h3>
            <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>{mode==='add'?'Create a new Delivery Associate':emp?.name}</p>
          </div>
          {onCancel && (
            <button onClick={onCancel} style={{ width:30, height:30, borderRadius:'50%', background:'var(--bg-alt)', border:'1px solid var(--border)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <X size={14} color="var(--text-sub)"/>
            </button>
          )}
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
                  {[{v:'pulser',l:'Pulser',d:'Base + Hours × Rate + Bonus'},{v:'cret',l:'CRET',d:'Base + Shipments × Rate'},{v:'tradelink',l:'Tradelink',d:'Fixed prorated base, no hours/shipments'}].map(p=>(
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
        <button onClick={onCancel} className="btn btn-secondary">Cancel</button>
        <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ minWidth:120, justifyContent:'center' }}>
          {saving ? <><span style={{ width:13,height:13,border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'white',borderRadius:'50%',animation:'spin 0.8s linear infinite',display:'inline-block'}}/> Saving…</> : mode==='add'?'Add DA':'Save Changes'}
        </button>
      </div>
    </div>
  )
}
