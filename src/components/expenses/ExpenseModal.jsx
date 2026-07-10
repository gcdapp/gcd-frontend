'use client'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { API } from '@/lib/api'
import {
  X, AlertCircle, ParkingCircle, Banknote, Plane, Fuel, HeartPulse,
  ScanSearch, Smartphone, Building2, Wallet, Bus, Car, KeyRound, FileText, Package,
  Scale, Gavel, Award, TrendingDown, Clock, Wrench, Route,
} from 'lucide-react'

export const CATEGORIES = [
  { v:'Parking',               c:'#F59E0B', I:ParkingCircle  },
  { v:'Parking Fee',           c:'#F59E0B', I:ParkingCircle  },
  { v:'Advances',              c:'#10B981', I:Banknote       },
  { v:'Air Tickets',           c:'#3B82F6', I:Plane          },
  { v:'ENOC',                  c:'#EF4444', I:Fuel           },
  { v:'Fuel',                  c:'#EF4444', I:Fuel           },
  { v:'Health Insurance',      c:'#8B5CF6', I:HeartPulse     },
  { v:'Idfy',                  c:'#EC4899', I:ScanSearch     },
  { v:'Mobile Expenses',       c:'#06B6D4', I:Smartphone     },
  { v:'Office Expenses',       c:'#84CC16', I:Building2      },
  { v:'Petty Cash',            c:'#F97316', I:Wallet         },
  { v:'RTA Top-up',            c:'#0EA5E9', I:Bus            },
  { v:'Salik',                 c:'#0EA5E9', I:Route          },
  { v:'Vehicle Expenses',      c:'#6366F1', I:Car            },
  { v:'Vehicle Rent',          c:'#7C3AED', I:KeyRound       },
  { v:'Vehicle Damage',        c:'#DC2626', I:Wrench         },
  { v:'Visa Expenses',         c:'#D97706', I:FileText       },
  { v:'Cash Variance',         c:'#F59E0B', I:Scale          },
  { v:'Fine',                  c:'#DC2626', I:Gavel          },
  { v:'Incentive',             c:'#22C55E', I:Award          },
  { v:'Incentive Deductions',  c:'#DC2626', I:TrendingDown   },
  { v:'Overtime',              c:'#8B5CF6', I:Clock          },
  { v:'Miscellaneous Expenses',c:'#94A3B8', I:Package        },
]
export const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.v, c]))

const MONTHS = Array.from({ length: 6 }, (_, i) => {
  const d = new Date(); d.setMonth(d.getMonth() - i); return d.toISOString().slice(0, 7)
})

function hdr(json = true) {
  const h = { Authorization: `Bearer ${localStorage.getItem('gcd_token')}` }
  if (json) h['Content-Type'] = 'application/json'
  return h
}

/**
 * Add/Edit Expense modal. Shared by Finance > Expenses (full employee picker)
 * and the per-driver Expenses page (locked to that driver via `lockEmpId`).
 */
export default function ExpenseModal({ expense, employees = [], lockEmpId, onSave, onClose }) {
  const isEdit = !!expense
  const [form, setForm] = useState({
    emp_id:      expense?.emp_id      || lockEmpId || '',
    category:    expense?.category    || CATEGORIES[0].v,
    amount:      expense?.amount      || '',
    date:        expense?.date?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    description: expense?.description || '',
    month:       expense?.month       || MONTHS[0],
  })
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState(null)
  const set  = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const cat  = CAT_MAP[form.category] || CATEGORIES[0]

  async function handleSave() {
    if (!form.amount) return setErr('Amount is required')
    setSaving(true); setErr(null)
    try {
      const url    = isEdit ? `${API}/api/expenses/${expense.id}` : `${API}/api/expenses`
      const method = isEdit ? 'PUT' : 'POST'
      const res    = await fetch(url, { method, headers: hdr(), body: JSON.stringify(form) })
      const data   = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to save expense')
      onSave()
    } catch (e) { setErr(e.message) } finally { setSaving(false) }
  }

  const lockedEmpName = lockEmpId ? (employees.find(e => e.id === lockEmpId)?.name || expense?.emp_name) : null

  return createPortal(
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480, padding: 0, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '20px 22px 14px', background: `linear-gradient(135deg,${cat.c}18,transparent)`, borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <h3 style={{ fontWeight: 900, fontSize: 17, color: 'var(--text)', margin: 0 }}>{isEdit ? 'Edit Expense' : 'Add Expense'}</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{lockedEmpName ? `For ${lockedEmpName}` : isEdit ? 'Update this record' : 'Log a company expense'}</p>
            </div>
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--bg-alt)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={14}/>
            </button>
          </div>
          {/* Expense type */}
          <div>
            <label className="input-label">Expense Type *</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: `${cat.c}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <cat.I size={15} color={cat.c}/>
              </div>
              <select className="input" value={form.category} onChange={e => set('category', e.target.value)} style={{ flex: 1 }}>
                {CATEGORIES.map(c => <option key={c.v} value={c.v}>{c.v}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div style={{ padding: '16px 22px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {err && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 9, padding: '9px 12px', fontSize: 12.5, color: '#C0392B', display: 'flex', gap: 7, alignItems: 'center' }}>
              <AlertCircle size={13}/>{err}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {!lockEmpId ? (
              <div>
                <label className="input-label">Employee (optional)</label>
                <select className="input" value={form.emp_id} onChange={e => set('emp_id', e.target.value)}>
                  <option value="">No employee (company expense)</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
            ) : (
              <div>
                <label className="input-label">Employee</label>
                <div className="input" style={{ display:'flex', alignItems:'center', color:'var(--text-muted)', background:'var(--bg-alt)' }}>{lockedEmpName || lockEmpId}</div>
              </div>
            )}
            <div>
              <label className="input-label">Month</label>
              <select className="input" value={form.month} onChange={e => set('month', e.target.value)}>
                {MONTHS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="input-label">Amount (AED) *</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--text-muted)', fontWeight: 700 }}>AED</span>
              <input className="input" type="number" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} style={{ paddingLeft: 52, fontSize: 16, fontWeight: 700 }}/>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="input-label">Date</label>
              <input className="input" type="date" value={form.date} onChange={e => set('date', e.target.value)}/>
            </div>
            <div>
              <label className="input-label">Description</label>
              <input className="input" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Brief note…"/>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button onClick={onClose} className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
            <button onClick={handleSave} disabled={saving}
              style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: 11, borderRadius: 10, background: `linear-gradient(135deg,${cat.c},${cat.c}cc)`, color: 'white', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.7 : 1, transition: 'opacity 0.15s' }}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Expense'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
