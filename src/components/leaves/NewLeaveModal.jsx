'use client'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { leaveApi } from '@/lib/api'
import { X } from 'lucide-react'

// Shared by HR Management > Leaves and Operations > Leaves — both let
// Admin/General Manager add a leave directly. The backend auto-approves it
// immediately when the creator is admin/general_manager (see leaveService.create).
export default function NewLeaveModal({ employees, onSave, onClose }) {
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
          <h3 style={{ fontWeight:800, fontSize:16, color:'var(--text)' }}>New Leave Request</h3>
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
