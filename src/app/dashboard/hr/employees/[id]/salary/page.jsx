'use client'
import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useRouter } from 'next/navigation'
import { empApi, payrollApi, API } from '@/lib/api'
import { getEmp, setEmp as cacheEmp } from '@/lib/empCache'
import { hdr, getUserRole, fmt, stripRefTag } from '@/lib/employees'
import PageHero from '@/components/employees/PageHero'
import BackLink from '@/components/employees/BackLink'
import { Banknote, Plus, Trash2, Check, Undo2, X } from 'lucide-react'

// Plain year*12+month arithmetic — d.setMonth(d.getMonth()-i) overflows into
// the next month on a 31st whenever the target month is shorter, producing
// duplicate/skipped months.
const MONTHS = Array.from({ length: 12 }, (_, i) => {
  const now = new Date(), total = now.getFullYear() * 12 + now.getMonth() - i
  return `${Math.floor(total / 12)}-${String(total % 12 + 1).padStart(2, '0')}`
})
const BON_TYPES = [
  { v:'performance',   l:'Performance' },
  { v:'kpi',           l:'KPI Bonus' },
  { v:'reimbursement', l:'Expense Reimbursement' },
  { v:'other',         l:'Other' },
]
const DED_TYPES = [
  { v:'traffic_fine',  l:'Traffic Fine' },
  { v:'iloe_fee',      l:'ILOE Fee' },
  { v:'iloe_fine',     l:'ILOE Fine' },
  { v:'cash_variance', l:'Cash Variance' },
  { v:'other',         l:'Other' },
]

function AddModal({ kind, empId, month, onClose, onSaved }) {
  const types = kind === 'bonus' ? BON_TYPES : DED_TYPES
  const [type, setType]   = useState(types[0].v)
  const [amount, setAmount] = useState('')
  const [desc, setDesc]     = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState(null)

  async function save() {
    if (!amount) return setErr('Amount is required')
    setSaving(true); setErr(null)
    try {
      const path = kind === 'bonus' ? '/api/payroll/bonuses' : '/api/payroll/deductions'
      const res = await fetch(`${API}${path}`, {
        method:'POST', headers:hdr(),
        body: JSON.stringify({ emp_id:empId, month, type, amount, description:desc||null })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onSaved()
    } catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  return createPortal(
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ maxWidth:420, padding:0, overflow:'hidden' }}>
        <div style={{ padding:'18px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h3 style={{ margin:0, fontSize:16, fontWeight:800, color:'var(--text)' }}>{kind==='bonus'?'Add Bonus':'Add Deduction'}</h3>
          <button onClick={onClose} style={{ width:28, height:28, borderRadius:'50%', background:'var(--bg-alt)', border:'none', cursor:'pointer' }}><X size={13}/></button>
        </div>
        <div style={{ padding:'16px 20px 20px', display:'flex', flexDirection:'column', gap:12 }}>
          {err && <div style={{ background:'var(--red-bg)', border:'1px solid var(--red-border)', borderRadius:9, padding:'9px 12px', fontSize:12.5, color:'var(--red)' }}>{err}</div>}
          <div>
            <label className="input-label">Type</label>
            <select className="input" value={type} onChange={e=>setType(e.target.value)}>
              {types.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </div>
          <div>
            <label className="input-label">Amount (AED) *</label>
            <input className="input" type="number" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/>
          </div>
          <div>
            <label className="input-label">Description</label>
            <input className="input" value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Optional note…"/>
          </div>
          <div style={{ display:'flex', gap:10, marginTop:4 }}>
            <button onClick={onClose} className="btn btn-secondary" style={{ flex:1, justifyContent:'center' }}>Cancel</button>
            <button onClick={save} disabled={saving} className="btn btn-primary" style={{ flex:2, justifyContent:'center' }}>{saving?'Saving…':'Save'}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default function DriverSalaryPage() {
  const { id } = useParams()
  const router = useRouter()
  const [emp,      setEmp]      = useState(() => getEmp(id))
  const [row,      setRow]      = useState(null)
  const [month,    setMonth]    = useState(MONTHS[0])
  const [loading,  setLoading]  = useState(true)
  const [userRole, setUserRole] = useState(null)
  const [addModal, setAddModal] = useState(null) // 'bonus' | 'deduction'
  const [busy,     setBusy]     = useState(false)

  useEffect(() => { setUserRole(getUserRole()) }, [])
  useEffect(() => { empApi.get(id).then(d => { setEmp(d.employee); cacheEmp(d.employee) }).catch(() => setEmp(prev => prev)) }, [id])

  const load = useCallback(() => {
    setLoading(true)
    payrollApi.list({ emp_id: id, month }).then(d => setRow((d.payroll || [])[0] || null)).catch(() => setRow(null)).finally(() => setLoading(false))
  }, [id, month])
  useEffect(() => { load() }, [load])

  const canPay    = ['admin','accountant'].includes(userRole)
  const canAddMod = ['admin','manager','general_manager','accountant'].includes(userRole)
  const canRemove = ['admin','accountant'].includes(userRole)

  async function markPaid() {
    setBusy(true)
    try { await payrollApi.markPaid(id, month); load() } finally { setBusy(false) }
  }
  async function markUnpaid() {
    setBusy(true)
    try { await payrollApi.markUnpaid(id, month); load() } finally { setBusy(false) }
  }
  async function removeItem(kind, itemId) {
    if (!confirm('Remove this line item?')) return
    const path = kind === 'bonus' ? 'bonuses' : 'deductions'
    await fetch(`${API}/api/payroll/${path}/${itemId}`, { method:'DELETE', headers:hdr() })
    load()
  }

  // Everything here comes from the month's payroll entry (Add Manually / Bulk Upload),
  // computed server-side with the same formula mark-paid uses — base is the prorated/
  // confirmed figure for the month, not the employee's contract salary.
  const base       = Number(row?.earnings_base ?? row?.base_salary ?? 0)
  const unitsPay   = Number(row?.earnings_units || 0)
  const bonuses    = row?.bonuses || []
  const deds       = row?.deductions || []
  const pettyCash  = row?.petty_cash || []
  const bonusTotal = Number(row?.bonus_total || 0)
  const dedTotal   = Number(row?.deduction_total || 0)
  const dedPending = Number(row?.pending_deduction || 0)
  const dedCarry   = Number(row?.deduction_carry_fwd || 0)
  const pettyTotal = pettyCash.reduce((s, p) => s + Number(p.amount || 0), 0)
  const isPaid     = row?.payroll_status === 'paid'
  // A paid month is a locked snapshot; an unpaid one is whatever the entry computes to now.
  const net        = !row ? 0 : isPaid && row.net_pay != null ? Number(row.net_pay) : Number(row.computed_net ?? (base + unitsPay + bonusTotal - dedTotal))
  const pt         = (row?.project_type || '').toLowerCase()
  const isHours    = !['cret','external','jnt_express','imile'].includes(pt)
  const isSplit    = pt === 'jnt_express' || pt === 'imile'
  const units      = Number(row?.total_hours || 0)
  const unitsLabel = isSplit ? `COD ${units} · Non-COD ${Number(row?.units_non_cod || 0)}` : `${units} ${isHours ? 'hrs' : 'shipments'}`
  const sheet = row ? [
    row.working_days != null && { l:'Working Days', v:String(row.working_days) },
    row.entry_amount == null && { l:isHours ? 'Hours Worked' : 'Shipments', v:isSplit ? unitsLabel : String(units) },
    { l:row.entry_amount != null ? 'Confirmed Amount' : 'Basic Salary', v:`AED ${fmt(base)}` },
    row.entry_amount == null && { l:isHours ? 'Hours Earnings' : 'Shipment Earnings', v:`AED ${fmt(unitsPay)}` },
    { l:'Bonuses', v:`+${fmt(bonusTotal)}`, c:'#059669' },
    { l:'Deductions Applied', v:`-${fmt(dedTotal)}`, c:'#DC2626' },
    { l:'Carried Forward', v:fmt(dedCarry) },
  ].filter(Boolean) : []

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14, animation:'slideUp 0.3s ease' }}>
      <BackLink router={router} href={`/dashboard/hr/employees/${id}`} label={`Back to ${emp?.name || 'Driver'}`}/>

      <PageHero icon={Banknote} iconColor="#34D399" iconBg="rgba(16,185,129,0.15)" iconBorder="rgba(16,185,129,0.35)"
        title={`Salary — ${emp?.name || '…'}`}
        subtitle="Payroll breakdown by month"
        actions={
          <select value={month} onChange={e=>setMonth(e.target.value)}
            style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:10, padding:'8px 13px', color:'rgba(255,255,255,0.85)', fontSize:12.5, outline:'none', cursor:'pointer', fontFamily:'inherit' }}>
            {MONTHS.map(m => <option key={m}>{m}</option>)}
          </select>
        }>
        <div style={{ marginTop:20, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:'18px 20px' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>Net Pay</div>
          <div style={{ fontSize:30, fontWeight:900, color:'#34D399', letterSpacing:'-0.03em' }}>{loading ? '—' : `AED ${fmt(net)}`}</div>
          <div style={{ display:'flex', gap:18, marginTop:10, flexWrap:'wrap' }}>
            <div><span style={{ fontSize:11, color:'rgba(255,255,255,0.4)' }}>Base</span> <strong style={{ fontSize:13, color:'white', marginLeft:4 }}>AED {fmt(base)}</strong></div>
            {unitsPay > 0 && <div><span style={{ fontSize:11, color:'rgba(255,255,255,0.4)' }}>{isHours ? 'Hours' : 'Shipments'} ({unitsLabel})</span> <strong style={{ fontSize:13, color:'white', marginLeft:4 }}>AED {fmt(unitsPay)}</strong></div>}
            <div><span style={{ fontSize:11, color:'rgba(255,255,255,0.4)' }}>Bonuses</span> <strong style={{ fontSize:13, color:'#34D399', marginLeft:4 }}>+{fmt(bonusTotal)}</strong></div>
            <div><span style={{ fontSize:11, color:'rgba(255,255,255,0.4)' }}>Deductions</span> <strong style={{ fontSize:13, color:'#F87171', marginLeft:4 }}>-{fmt(dedTotal)}</strong></div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:14 }}>
            <span style={{ fontSize:11, fontWeight:700, color:isPaid?'#34D399':'#FBBF24', background:isPaid?'rgba(52,211,153,0.15)':'rgba(251,191,36,0.15)', borderRadius:99, padding:'3px 12px' }}>
              {isPaid ? 'Paid' : 'Pending'}
            </span>
            {canPay && row && (
              isPaid ? (
                <button onClick={markUnpaid} disabled={busy}
                  style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 14px', borderRadius:20, background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.15)', color:'white', fontSize:11.5, fontWeight:700, cursor:'pointer' }}>
                  <Undo2 size={11}/> Mark Unpaid
                </button>
              ) : (
                <button onClick={markPaid} disabled={busy}
                  style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 14px', borderRadius:20, background:'#10B981', border:'none', color:'white', fontSize:11.5, fontWeight:700, cursor:'pointer' }}>
                  <Check size={11}/> Mark Paid
                </button>
              )
            )}
          </div>
        </div>
      </PageHero>

      {!loading && !row ? (
        <div style={{ textAlign:'center', padding:'40px 20px', color:'var(--text-muted)' }}>
          <Banknote size={32} style={{ margin:'0 auto 12px', display:'block', opacity:0.2 }}/>
          No payroll record for {month} yet.
        </div>
      ) : (<>
        {/* Payroll sheet — what was entered for this month via Add Manually / Bulk Upload */}
        {row && (
          <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', background:'var(--bg-alt)' }}>
              <span style={{ fontSize:12, fontWeight:800, color:'var(--text)' }}>Payroll Sheet — {month}</span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:1, background:'var(--border)' }}>
              {sheet.map(c => (
                <div key={c.l} style={{ background:'var(--card)', padding:'12px 16px' }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>{c.l}</div>
                  <div style={{ fontSize:14, fontWeight:800, color:c.c || 'var(--text)', marginTop:4 }}>{c.v}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          {/* Bonuses */}
          <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center', background:'var(--bg-alt)' }}>
              <span style={{ fontSize:12, fontWeight:800, color:'var(--text)' }}>Bonuses</span>
              {canAddMod && <button onClick={()=>setAddModal('bonus')} style={{ display:'flex', alignItems:'center', gap:4, background:'none', border:'none', color:'#059669', fontWeight:700, fontSize:11.5, cursor:'pointer' }}><Plus size={11}/> Add</button>}
            </div>
            {bonuses.length === 0 ? (
              <div style={{ padding:'20px', textAlign:'center', fontSize:12, color:'var(--text-muted)' }}>No bonuses this month</div>
            ) : bonuses.map(b => (
              <div key={b.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 16px', borderBottom:'1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize:12.5, fontWeight:600, color:'var(--text)' }}>{BON_TYPES.find(t=>t.v===b.type)?.l || b.type}</div>
                  {b.description && <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{stripRefTag(b.description)}</div>}
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:13, fontWeight:800, color:'#059669' }}>+{fmt(b.amount)}</span>
                  {canRemove && <button onClick={()=>removeItem('bonus', b.id)} style={{ background:'none', border:'none', color:'var(--red)', cursor:'pointer', display:'flex' }}><Trash2 size={12}/></button>}
                </div>
              </div>
            ))}
          </div>

          {/* Deductions */}
          <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center', background:'var(--bg-alt)' }}>
              <span style={{ fontSize:12, fontWeight:800, color:'var(--text)' }}>Deductions Ledger <span style={{ fontWeight:500, color:'var(--text-muted)' }}>· all months</span></span>
              {canAddMod && <button onClick={()=>setAddModal('deduction')} style={{ display:'flex', alignItems:'center', gap:4, background:'none', border:'none', color:'#DC2626', fontWeight:700, fontSize:11.5, cursor:'pointer' }}><Plus size={11}/> Add</button>}
            </div>
            {deds.length === 0 ? (
              <div style={{ padding:'20px', textAlign:'center', fontSize:12, color:'var(--text-muted)' }}>No deductions logged</div>
            ) : deds.map(d => (
              <div key={d.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 16px', borderBottom:'1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize:12.5, fontWeight:600, color:'var(--text)' }}>{DED_TYPES.find(t=>t.v===d.type)?.l || d.type}</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{[d.month, stripRefTag(d.description)].filter(Boolean).join(' · ')}</div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:13, fontWeight:800, color:'#DC2626' }}>-{fmt(d.amount)}</span>
                  {canRemove && <button onClick={()=>removeItem('deduction', d.id)} style={{ background:'none', border:'none', color:'var(--red)', cursor:'pointer', display:'flex' }}><Trash2 size={12}/></button>}
                </div>
              </div>
            ))}
            {deds.length > 0 && (
              <div style={{ display:'flex', justifyContent:'space-between', gap:12, flexWrap:'wrap', padding:'10px 16px', background:'var(--bg-alt)', fontSize:11.5, color:'var(--text-muted)' }}>
                <span>Outstanding balance <strong style={{ color:'var(--text)' }}>{fmt(dedPending)}</strong></span>
                <span>Applied this month <strong style={{ color:'#DC2626' }}>-{fmt(dedTotal)}</strong></span>
                <span>Carried forward <strong style={{ color:'var(--text)' }}>{fmt(dedCarry)}</strong></span>
              </div>
            )}
          </div>
        </div>

        {/* Petty cash — already paid out in cash, so it is listed for reference only */}
        {pettyCash.length > 0 && (
          <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap', background:'var(--bg-alt)' }}>
              <span style={{ fontSize:12, fontWeight:800, color:'var(--text)' }}>Petty Cash <span style={{ fontWeight:500, color:'var(--text-muted)' }}>· paid in cash, not included in net pay</span></span>
              <span style={{ fontSize:12, fontWeight:800, color:'var(--text)' }}>AED {fmt(pettyTotal)}</span>
            </div>
            {pettyCash.map(p => (
              <div key={p.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 16px', borderBottom:'1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize:12.5, fontWeight:600, color:'var(--text)' }}>{p.expense_type}</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{[p.date, p.note].filter(Boolean).join(' · ')}</div>
                </div>
                <span style={{ fontSize:13, fontWeight:800, color:'var(--text)' }}>{fmt(p.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </>)}

      {addModal && (
        <AddModal kind={addModal} empId={id} month={month} onClose={()=>setAddModal(null)} onSaved={()=>{ setAddModal(null); load() }}/>
      )}
    </div>
  )
}
