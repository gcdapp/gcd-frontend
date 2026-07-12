'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { leaveApi, empApi } from '@/lib/api'
import { Check, X, Clock, Plus, Calendar, ChevronRight, AlertCircle } from 'lucide-react'

const TYPE_COLORS = { Annual:'#B8860B', Sick:'#1D6FA4', Emergency:'#C0392B', Unpaid:'#6B5D4A', Other:'#A89880' }
import { API } from '@/lib/api'
function hdr() { return { 'Content-Type':'application/json', Authorization:`Bearer ${localStorage.getItem('gcd_token')}` } }

function StageChip({ label, status }) {
  const cfg = {
    approved: { c:'#2E7D52', bg:'#ECFDF5', bc:'#A7F3D0' },
    rejected: { c:'#C0392B', bg:'#FEF2F2', bc:'#FCA5A5' },
    pending:  { c:'#1D6FA4', bg:'#EFF6FF', bc:'#BFDBFE' },
    waiting:  { c:'#A89880', bg:'#F5F4F1', bc:'#EAE6DE' },
  }[status] || { c:'#A89880', bg:'#F5F4F1', bc:'#EAE6DE' }
  return (
    <div style={{ textAlign:'center', padding:'5px 10px', borderRadius:8, background:cfg.bg, border:`1px solid ${cfg.bc}` }}>
      <div style={{ fontSize:9.5, color:cfg.c, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</div>
      <div style={{ fontSize:11, color:cfg.c, fontWeight:800, marginTop:1 }}>{status}</div>
    </div>
  )
}

function NewLeaveModal({ employees, onSave, onClose }) {
  const [form, setForm] = useState({ emp_id:'', type:'Annual', from_date:'', to_date:'', reason:'' })
  const [saving, setSaving] = useState(false)
  const set = (k,v) => setForm(p=>({...p,[k]:v}))
  const days = form.from_date && form.to_date ? Math.max(1,Math.round((new Date(form.to_date)-new Date(form.from_date))/86400000)+1) : 0

  async function handleSave() {
    if (!form.emp_id||!form.from_date||!form.to_date) return
    setSaving(true)
    try { await leaveApi.create({...form,days}); onSave() }
    catch(e) { alert(e.message) } finally { setSaving(false) }
  }

  return createPortal(
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ maxWidth:420 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
          <h3 style={{ fontWeight:800, fontSize:16, color:'#1A1612' }}>New Leave Request</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={17}/></button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div>
            <label className="input-label">Employee *</label>
            <select className="input" value={form.emp_id} onChange={e=>set('emp_id',e.target.value)}>
              <option value="">Select employee…</option>
              {employees.map(e=><option key={e.id} value={e.id}>{e.name} ({e.id})</option>)}
            </select>
          </div>
          <div>
            <label className="input-label">Leave Type</label>
            <select className="input" value={form.type} onChange={e=>set('type',e.target.value)}>
              {['Annual','Emergency','Unpaid','Other'].map(t=><option key={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div><label className="input-label">From *</label><input className="input" type="date" value={form.from_date} onChange={e=>set('from_date',e.target.value)}/></div>
            <div><label className="input-label">To *</label><input className="input" type="date" value={form.to_date} onChange={e=>set('to_date',e.target.value)}/></div>
          </div>
          {days>0 && <div style={{ background:'#FDF6E3', border:'1px solid #F0D78C', borderRadius:9, padding:'8px 12px', fontSize:13, color:'#B8860B', fontWeight:700 }}>{days} day{days>1?'s':''}</div>}
          <div><label className="input-label">Reason</label><input className="input" value={form.reason} onChange={e=>set('reason',e.target.value)}/></div>
        </div>
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:18 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving||!form.emp_id||!form.from_date||!form.to_date}>{saving?'Saving…':'Submit'}</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default function LeavesPage() {
  const [leaves,    setLeaves]    = useState([])
  const [employees, setEmployees] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [stage,     setStage]     = useState('all')
  const [modal,     setModal]     = useState(false)
  const [userRole,  setUserRole]  = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const user = JSON.parse(localStorage.getItem('gcd_user')||'{}')
      setUserRole(user.role)
      const [lv, emps] = await Promise.all([
        fetch(`${API}/api/leaves?stage=${stage}`, { headers:{ Authorization:`Bearer ${localStorage.getItem('gcd_token')}` } }).then(r=>r.json()),
        empApi.list()
      ])
      setLeaves(lv.leaves||[])
      setEmployees(emps.employees||[])
    } catch(e) { console.error(e) } finally { setLoading(false) }
  }, [stage])

  useEffect(() => { load() }, [load])

  async function action(id, status, endpoint) {
    await fetch(`${API}/api/leaves/${id}/${endpoint}`, { method:'PATCH', headers:hdr(), body:JSON.stringify({ status }) })
    load()
  }

  // Pending counts per role
  const pocPending   = leaves.filter(l => l.poc_status==='pending').length
  const mgrPending   = leaves.filter(l => l.poc_status==='approved' && !['approved','rejected'].includes(l.hr_status)).length
  const adminPending = leaves.filter(l => l.hr_status==='approved'  && !['approved','rejected'].includes(l.mgr_status)).length

  const pendingCount = userRole==='poc' ? pocPending : userRole==='manager' ? mgrPending : adminPending

  const STAGES = userRole==='driver'
    ? [{ v:'all', l:'All Leaves', count:null }]
    : [
        { v:'pending', l:'Action Required', count:pendingCount },
        { v:'all',     l:'All Leaves',      count:null },
      ]

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16, animation:'slideUp 0.35s ease' }}>

      {/* Workflow banner */}
      <div style={{ background:'linear-gradient(135deg,#F8F7FF,#F0EFFF)', border:'1px solid #DDD6FE', borderRadius:14, padding:'14px 18px' }}>
        <div style={{ fontWeight:700, fontSize:13, color:'#7C3AED', marginBottom:6, display:'flex', alignItems:'center', gap:6 }}><AlertCircle size={14}/> Leave Approval Workflow</div>
        <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
          {['DA applies','POC reviews','Manager reviews','Admin approves','Done'].map((s,i,arr) => (
            <React.Fragment key={s}>
              <span style={{ fontSize:11.5, fontWeight:600, color:'#7C3AED', background:'rgba(124,58,237,0.08)', padding:'3px 10px', borderRadius:20 }}>{s}</span>
              {i<arr.length-1 && <ChevronRight size={13} color="#A89880"/>}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ display:'flex', gap:6, flex:1 }}>
          {STAGES.map(s => (
            <button key={s.v} onClick={()=>setStage(s.v)}
              style={{ padding:'8px 16px', borderRadius:20, border:`1.5px solid ${stage===s.v?'#B8860B':'#EAE6DE'}`, background:stage===s.v?'#FDF6E3':'#FFF', color:stage===s.v?'#B8860B':'#A89880', fontWeight:stage===s.v?700:500, fontSize:12.5, cursor:'pointer', transition:'all 0.18s', fontFamily:'Poppins,sans-serif', display:'flex', alignItems:'center', gap:6 }}>
              {s.l}
              {s.count!=null && s.count>0 && <span style={{ background:'#B8860B', color:'white', borderRadius:20, padding:'1px 7px', fontSize:10, fontWeight:700 }}>{s.count}</span>}
            </button>
          ))}
        </div>
        {userRole !== 'accountant' && userRole !== 'driver' && (
          <button className="btn btn-primary btn-sm" onClick={()=>setModal(true)} style={{ borderRadius:20 }}>
            <Plus size={13}/> New Request
          </button>
        )}
      </div>

      {/* Leaves */}
      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {[1,2,3].map(i=><div key={i} className="skeleton" style={{ height:100, borderRadius:14 }}/>)}
        </div>
      ) : leaves.length===0 ? (
        <div style={{ textAlign:'center', padding:'50px 20px', color:'#A89880' }}>
          <Calendar size={40} style={{ margin:'0 auto 12px', display:'block', opacity:0.2 }}/>
          <div style={{ fontWeight:600, color:'#6B5D4A' }}>{stage==='pending'?'No leaves awaiting your action':'No leave records found'}</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {leaves.map((l,i) => (
            <div key={l.id} style={{ background:'#FFF', border:'1px solid #EAE6DE', borderRadius:16, overflow:'hidden', animation:`slideUp 0.3s ${i*0.04}s ease both` }}>
              <div style={{ padding:'14px 16px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:8, marginBottom:10 }}>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                      <span style={{ fontWeight:700, fontSize:14, color:'#1A1612' }}>{l.name}</span>
                      <span style={{ fontSize:11, fontWeight:700, color:TYPE_COLORS[l.type]||'#6B5D4A', background:`${TYPE_COLORS[l.type]||'#6B5D4A'}15`, padding:'2px 9px', borderRadius:6 }}>{l.type}</span>
                      {l.station_code && <span style={{ fontSize:10.5, fontWeight:700, color:'#B8860B', background:'#FDF6E3', borderRadius:5, padding:'1px 6px' }}>{l.station_code}</span>}
                    </div>
                    <div style={{ fontSize:12, color:'#A89880', display:'flex', alignItems:'center', gap:5 }}>
                      <Calendar size={11}/> {l.from_date} → {l.to_date} · <strong style={{ color:'#6B5D4A' }}>{l.days} days</strong>
                    </div>
                    {l.reason && <div style={{ fontSize:12, color:'#6B5D4A', marginTop:4 }}>{l.reason}</div>}
                  </div>
                  {/* 3-stage pipeline */}
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    <StageChip label={l.poc_approver_name || 'POC'}     status={l.poc_status||'pending'}/>
                    <StageChip label={l.mgr_approver_name || 'Manager'} status={l.hr_status||'waiting'}/>
                    <StageChip label={l.admin_approver_name || 'Admin'} status={l.mgr_status||'waiting'}/>
                  </div>
                </div>
              </div>

              {/* POC action bar */}
              {userRole==='poc' && l.poc_status==='pending' && (
                <div style={{ background:'linear-gradient(135deg,#EFF6FF,#DBEAFE)', borderTop:'1px solid #BFDBFE', padding:'10px 16px', display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                  <span style={{ fontSize:12, color:'#1D6FA4', fontWeight:700, flex:1 }}>Awaiting your review</span>
                  <button onClick={()=>action(l.id,'approved','status')} style={{ padding:'7px 18px', borderRadius:20, background:'linear-gradient(135deg,#2E7D52,#22C55E)', border:'none', color:'white', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'Poppins,sans-serif' }}>Approve</button>
                  <button onClick={()=>action(l.id,'rejected','status')} style={{ padding:'7px 18px', borderRadius:20, background:'#FEF2F2', border:'1px solid #FCA5A5', color:'#C0392B', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'Poppins,sans-serif' }}>Reject</button>
                </div>
              )}

              {/* Manager action bar */}
              {userRole==='manager' && l.poc_status==='approved' && !['approved','rejected'].includes(l.hr_status) && (
                <div style={{ background:'linear-gradient(135deg,#FDF6E3,#FFFBEB)', borderTop:'1px solid #F0D78C', padding:'10px 16px', display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                  <span style={{ fontSize:12, color:'#B8860B', fontWeight:700, flex:1 }}>Awaiting your decision</span>
                  <button onClick={()=>action(l.id,'approved','hr')} style={{ padding:'7px 18px', borderRadius:20, background:'linear-gradient(135deg,#2E7D52,#22C55E)', border:'none', color:'white', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'Poppins,sans-serif' }}>Approve</button>
                  <button onClick={()=>action(l.id,'rejected','hr')} style={{ padding:'7px 18px', borderRadius:20, background:'#FEF2F2', border:'1px solid #FCA5A5', color:'#C0392B', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'Poppins,sans-serif' }}>Reject</button>
                </div>
              )}

              {/* Admin action bar */}
              {(userRole==='admin'||userRole==='general_manager') && l.hr_status==='approved' && !['approved','rejected'].includes(l.mgr_status) && (
                <div style={{ background:'linear-gradient(135deg,#F3F4F6,#E5E7EB)', borderTop:'1px solid #D1D5DB', padding:'10px 16px', display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                  <span style={{ fontSize:12, color:'#374151', fontWeight:700, flex:1 }}>Final approval required</span>
                  <button onClick={()=>action(l.id,'approved','manager')} style={{ padding:'7px 18px', borderRadius:20, background:'linear-gradient(135deg,#2E7D52,#22C55E)', border:'none', color:'white', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'Poppins,sans-serif' }}>Approve</button>
                  <button onClick={()=>action(l.id,'rejected','manager')} style={{ padding:'7px 18px', borderRadius:20, background:'#FEF2F2', border:'1px solid #FCA5A5', color:'#C0392B', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'Poppins,sans-serif' }}>Reject</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modal && <NewLeaveModal employees={employees} onSave={()=>{setModal(false);load()}} onClose={()=>setModal(false)}/>}
    </div>
  )
}
