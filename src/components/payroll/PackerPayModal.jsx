'use client'
// Dedicated "Add Pay" popup for the two Packer project types — same sectioned-card /
// live-summary template as JntSalaryModal, sized down to their much simpler formula
// (Hours Worked × a fixed company-wide rate, no base salary — see PACKER_HOURLY_RATE
// in backend/src/lib/payrollCalc.js, mirrored here). Bonuses/deductions still go
// through the existing generic sheet-entry + deduction-ledger routes (payrollApi.
// addUnits/getEntry) — only the UI is dedicated, not the backend.
import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { X, AlertCircle } from 'lucide-react'
import { payrollApi } from '@/lib/api'

const PACKER_HOURLY_RATE = { creative_packers: 6.64, le_chocola: 6.99 }
const PACKER_LABELS = { creative_packers: 'Creative Packers', le_chocola: 'Le Chocola Packers' }

const BONUS_FIELDS = [
  { k: 'perfBonus',     f: 'performance_bonus', l: 'Performance Bonus' },
  { k: 'incentive',     f: 'incentive',         l: 'Incentive' },
  { k: 'otherAddition', f: 'other_addition',    l: 'Other Addition' },
  { k: 'eidOt',         f: 'eid_ot',             l: 'Eid OT' },
]
const DEDUCTION_FIELDS = [
  { k: 'trafficFine',   f: 'traffic_fine',  l: 'Traffic Fine' },
  { k: 'cashAdvance',   f: 'cash_advance',  l: 'Cash Advance' },
  { k: 'cashVariance',  f: 'cash_variance', l: 'Cash Variance' },
  { k: 'absentDaysDed', f: 'absent_days',   l: 'Absent Days' },
  { k: 'others',        f: 'others',        l: 'Others' },
]
const emptySheet = () => ({ perfBonus:'', incentive:'', otherAddition:'', eidOt:'', trafficFine:'', cashAdvance:'', cashVariance:'', absentDaysDed:'', others:'' })

function Lbl({ children }) { return <label className="input-label">{children}</label> }

function NumInput({ value, onChange, placeholder = '0', small }) {
  return (
    <input
      className="input" type="number" min="0" step="0.01" inputMode="decimal"
      value={value} placeholder={placeholder}
      style={small ? { padding: '7px 10px', fontSize: 12.5 } : undefined}
      onChange={e => {
        const v = e.target.value
        if (v !== '' && Number(v) < 0) return
        onChange(v)
      }}
    />
  )
}

function fmtAED(n) {
  return `AED ${Number(n || 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function PackerPayModal({ employees, month, projectType, initialEmpId, onSave, onClose, onChangeType }) {
  const rate = PACKER_HOURLY_RATE[projectType]
  const empOptions = useMemo(() => (employees || [])
    .filter(e => (e.role || '').toLowerCase() === 'driver' && (e.project_type || '').toLowerCase() === projectType)
    .sort((a, b) => (a.name || '').localeCompare(b.name || '')), [employees, projectType])

  const [empId, setEmpId] = useState(initialEmpId || '')
  const [hours, setHours] = useState('')
  const [sheet, setSheet] = useState(emptySheet())
  const [dedDone, setDedDone] = useState('')
  const [cashAdvMonths, setCashAdvMonths] = useState('')
  const [pending, setPending] = useState(null)
  const [schedule, setSchedule] = useState([])
  const [loadingEntry, setLoadingEntry] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)
  const setSheetField = (k, v) => setSheet(p => ({ ...p, [k]: v }))

  async function pickEmp(id) {
    setEmpId(id); setHours(''); setPending(null); setSchedule([]); setDedDone(''); setSheet(emptySheet()); setCashAdvMonths('')
    if (!id) return
    setLoadingEntry(true)
    try {
      const d = await payrollApi.getEntry(id, month)
      setPending(d.pending); setSchedule(d.schedule || [])
      const entry = d.entry
      if (entry) {
        setHours(entry.units != null ? String(entry.units) : '')
        setDedDone(entry.deductions_done != null ? String(entry.deductions_done) : (d.suggested > 0 ? String(d.suggested) : ''))
      } else {
        setDedDone(d.suggested > 0 ? String(d.suggested) : '')
      }
      setSheet({
        perfBonus:     d.bonuses.performance != null ? String(d.bonuses.performance) : '',
        incentive:     d.bonuses.kpi != null ? String(d.bonuses.kpi) : '',
        otherAddition: d.bonuses.other != null ? String(d.bonuses.other) : '',
        eidOt:         d.bonuses.eid_ot != null ? String(d.bonuses.eid_ot) : '',
        trafficFine:   d.deductions.traffic_fine != null ? String(d.deductions.traffic_fine) : '',
        cashAdvance:   d.deductions.cash_advance != null ? String(d.deductions.cash_advance) : '',
        cashVariance:  d.deductions.cash_variance != null ? String(d.deductions.cash_variance) : '',
        absentDaysDed: d.deductions.absent_days != null ? String(d.deductions.absent_days) : '',
        others:        d.deductions.other != null ? String(d.deductions.other) : '',
      })
      if (d.deduction_installments?.cash_advance) setCashAdvMonths(String(d.deduction_installments.cash_advance))
    } catch (e) { /* non-fatal — prefill is a convenience, not required */ }
    finally { setLoadingEntry(false) }
  }

  useEffect(() => { if (initialEmpId) pickEmp(initialEmpId) },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [])

  const grossPay   = useMemo(() => Math.round((Number(hours || 0) * rate + Number.EPSILON) * 100) / 100, [hours, rate])
  const bonusTotal = useMemo(() => BONUS_FIELDS.reduce((s, { k }) => s + (parseFloat(sheet[k]) || 0), 0), [sheet])
  const newDedTotal = useMemo(() => DEDUCTION_FIELDS.reduce((s, { k }) => s + (parseFloat(sheet[k]) || 0), 0), [sheet])
  const dedApplied = Number(dedDone || 0)
  const netPay = Math.round((grossPay + bonusTotal - dedApplied + Number.EPSILON) * 100) / 100

  async function handleSave() {
    const h = parseFloat(hours)
    if (isNaN(h) || h < 0) return setErr('Enter a valid Hours Worked value')
    if (!empId) return setErr('Select a driver')
    setSaving(true); setErr(null)
    try {
      const sheetPayload = {}
      for (const { k, f } of [...BONUS_FIELDS, ...DEDUCTION_FIELDS]) sheetPayload[f] = sheet[k] === '' ? 0 : parseFloat(sheet[k]) || 0
      if (parseFloat(sheet.cashAdvance) > 0 && cashAdvMonths) sheetPayload.cash_advance_installments = parseInt(cashAdvMonths, 10)
      await payrollApi.addUnits({
        month, units: h, deductions_done: dedDone !== '' ? dedDone : undefined,
        emp_id: empId, project_type: projectType, ...sheetPayload,
      })
      onSave()
    } catch (e) { setErr(e.message) } finally { setSaving(false) }
  }

  const selectedEmployee = empOptions.find(e => e.id === empId)

  return createPortal(
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '92vh' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', background: 'linear-gradient(135deg,rgba(184,134,11,0.12),transparent)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h3 style={{ fontWeight: 900, fontSize: 16, color: 'var(--text)', margin: 0 }}>{initialEmpId ? 'Edit' : 'Add'} {PACKER_LABELS[projectType]} Pay</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{month}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {onChangeType && (
              <select
                className="input" value={projectType} title="Change pay type"
                onChange={e => onChangeType(e.target.value)}
                style={{ padding: '6px 9px', fontSize: 11.5, width: 'auto' }}
              >
                <option value="jnt_express">JNT DAs</option>
                <option value="imile">iMile DAs</option>
                <option value="le_chocola">Le Chocola Packers</option>
                <option value="creative_packers">Creative Packers</option>
              </select>
            )}
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--bg-alt)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><X size={15} /></button>
          </div>
        </div>

        <div style={{ padding: '18px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
          {err && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 10, padding: '9px 13px', fontSize: 12.5, color: '#DC2626', display: 'flex', gap: 7, alignItems: 'center' }}>
              <AlertCircle size={13} /> {err}
            </div>
          )}

          {/* ── Employee Information ── */}
          <section>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Employee Information</div>
            <div>
              <Lbl>Employee *</Lbl>
              {initialEmpId ? (
                <div className="input" style={{ display: 'flex', alignItems: 'center', color: 'var(--text)', fontWeight: 600, background: 'var(--bg-alt)' }}>
                  {selectedEmployee ? `${selectedEmployee.name} — ${selectedEmployee.id}` : empId}
                </div>
              ) : (
                <select className="input" value={empId} onChange={e => pickEmp(e.target.value)}>
                  <option value="">Select…</option>
                  {empOptions.map(e => <option key={e.id} value={e.id}>{e.name} — {e.id}</option>)}
                </select>
              )}
            </div>
          </section>

          {/* ── Hours Worked ── */}
          <section>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Hours Worked</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'end' }}>
              <div>
                <Lbl>Hours Worked *</Lbl>
                <NumInput value={hours} onChange={setHours} />
              </div>
              <div style={{ background: 'var(--bg-alt)', borderRadius: 10, padding: '9px 13px' }}>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Rate · Gross Pay</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginTop: 2 }}>{fmtAED(rate)}/hr → {fmtAED(grossPay)}</div>
              </div>
            </div>
            {loadingEntry && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 8 }}>Loading existing entry…</div>}
          </section>

          {/* ── Bonuses ── */}
          <section>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Bonuses</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {BONUS_FIELDS.map(({ k, l }) => (
                <div key={k}>
                  <Lbl>{l}</Lbl>
                  <NumInput value={sheet[k]} onChange={v => setSheetField(k, v)} small />
                </div>
              ))}
            </div>
          </section>

          {/* ── Deductions ── */}
          <section>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: '#EF4444', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Deductions</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {DEDUCTION_FIELDS.map(({ k, l }) => (
                <div key={k}>
                  <Lbl>{l}</Lbl>
                  <NumInput value={sheet[k]} onChange={v => setSheetField(k, v)} small />
                  {k === 'cashAdvance' && parseFloat(sheet.cashAdvance) > 0 && (
                    <input className="input" type="number" step="1" min="1" value={cashAdvMonths} onChange={e => setCashAdvMonths(e.target.value)}
                      placeholder="Repay over (months)" title="How many months to spread this cash advance's deduction over — leave blank to deduct it in full whenever there's room"
                      style={{ padding: '7px 10px', fontSize: 11.5, marginTop: 5 }} />
                  )}
                </div>
              ))}
            </div>

            {empId && (
              <div style={{ marginTop: 12 }}>
                <Lbl>Deductions to Apply This Month</Lbl>
                <NumInput value={dedDone} onChange={setDedDone} />
                {pending != null && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    Pending balance before this entry: AED {pending.toLocaleString()}{newDedTotal > 0 ? ` · new deductions above: AED ${newDedTotal.toLocaleString()}` : ''} — this defaults to the installment-aware suggested amount; adjust it to decide how much actually comes out of pay this month, the rest carries forward.
                  </div>
                )}
                {schedule.some(s => s.installments) && (
                  <div style={{ marginTop: 8, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ padding: '6px 10px', background: 'var(--bg-alt)', fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)' }}>Active repayment plans</div>
                    {schedule.filter(s => s.installments).map(s => (
                      <div key={s.id} style={{ padding: '6px 10px', fontSize: 11, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', color: 'var(--text)' }}>
                        <span>{s.type.replace('_', ' ')} — AED {s.amount.toLocaleString()} / {s.installments} mo.</span>
                        <span style={{ fontWeight: 700 }}>AED {s.due_this_month.toLocaleString()} due · {s.remaining.toLocaleString()} left</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        {/* ── Salary Summary (live) ── */}
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', background: 'var(--bg-alt)', flexShrink: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '6px 18px', fontSize: 12.5, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Gross Pay</span><span style={{ fontWeight: 700 }}>{fmtAED(grossPay)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Bonuses</span><span style={{ fontWeight: 700, color: '#10B981' }}>+{fmtAED(bonusTotal)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Deductions Applied</span><span style={{ fontWeight: 700, color: '#EF4444' }}>-{fmtAED(dedApplied)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text)', fontWeight: 800 }}>Net Pay</span><span style={{ fontWeight: 900, color: 'var(--gold)', fontSize: 14 }}>{fmtAED(netPay)}</span></div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '11px', borderRadius: 100, background: 'linear-gradient(135deg,#B8860B,#D4A017)', color: 'white', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', fontFamily: 'Poppins,sans-serif', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
