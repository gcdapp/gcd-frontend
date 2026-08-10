'use client'
// Dedicated "Add Pay" popup for iMile DAs — same sectioned-card / live-summary
// template as JntSalaryModal/PackerPayModal, but the rate depends on which
// (Project, DA Type, Branch) combo is picked on the form each month rather than a
// single global/fixed rate — see backend/src/routes/imile-salary.js. Deductions go
// straight into salary_deductions (source='sheet_entry', no ledger/installments),
// same as JNT.
import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { X, AlertCircle } from 'lucide-react'
import { imileSalaryApi } from '@/lib/api'
import { DEDUCTION_FIELDS, calcGross, calcDeductions, calcNet, fmtAED } from '@/lib/imileSalaryCalc'

const DA_TYPE_LABELS = { internal: 'Internal', external: 'External' }
const DEDUCTION_LABELS = {
  imile_deduction: 'iMile Deductions', sim_charge: 'SIM Charge', car_rent: 'Car Rent',
  rta_fine: 'RTA Fines', carry_forward: 'Carry Forward', cash_advance: 'Advance Payment',
}

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

export default function ImileSalaryModal({ employees, month, initialEmpId, onSave, onClose, onChangeType }) {
  const imileEmployees = useMemo(() => (employees || []).filter(e => (e.project_type || '').toLowerCase() === 'imile'), [employees])

  const [empId, setEmpId] = useState(initialEmpId || '')
  const [rates, setRates] = useState([])
  const [loadingRates, setLoadingRates] = useState(true)
  const [loadingEntry, setLoadingEntry] = useState(false)
  const [project, setProject] = useState('')
  const [daType, setDaType] = useState('')
  const [branch, setBranch] = useState('')
  const [cod, setCod] = useState('')
  const [nonCod, setNonCod] = useState('')
  const [deductions, setDeductions] = useState(() => Object.fromEntries(DEDUCTION_FIELDS.map(f => [f, ''])))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)
  const setDeductionField = (k, v) => setDeductions(p => ({ ...p, [k]: v }))

  useEffect(() => {
    imileSalaryApi.rates()
      .then(d => setRates(d.rates || []))
      .catch(() => setErr('Failed to load iMile rates'))
      .finally(() => setLoadingRates(false))
  }, [])

  // Cascading options — only combos that actually have a configured rate are
  // selectable, since this isn't a full cartesian product (e.g. no NDD+Internal+AJM DS).
  const projects = useMemo(() => [...new Set(rates.map(r => r.project))].sort(), [rates])
  const daTypes = useMemo(() => [...new Set(rates.filter(r => r.project === project).map(r => r.da_type))].sort(), [rates, project])
  const branches = useMemo(() => [...new Set(rates.filter(r => r.project === project && r.da_type === daType).map(r => r.branch))].sort(), [rates, project, daType])
  const selectedRate = useMemo(() => rates.find(r => r.project === project && r.da_type === daType && r.branch === branch), [rates, project, daType, branch])
  const isGatePass = project === 'JAFZA' && daType === 'external'

  async function pickEmp(id) {
    setEmpId(id); setProject(''); setDaType(''); setBranch(''); setCod(''); setNonCod('')
    setDeductions(Object.fromEntries(DEDUCTION_FIELDS.map(f => [f, ''])))
    if (!id) return
    setLoadingEntry(true)
    try {
      const d = await imileSalaryApi.getEntry(id, month)
      const entry = d.entry
      if (entry) {
        setProject(entry.project || ''); setDaType(entry.da_type || ''); setBranch(entry.branch || '')
        setCod(entry.cod != null ? String(entry.cod) : ''); setNonCod(entry.non_cod != null ? String(entry.non_cod) : '')
      }
      setDeductions(Object.fromEntries(DEDUCTION_FIELDS.map(f => [f, d.deductions?.[f] != null ? String(d.deductions[f]) : ''])))
    } catch (e) { /* non-fatal — prefill is a convenience, not required */ }
    finally { setLoadingEntry(false) }
  }

  useEffect(() => { if (initialEmpId) pickEmp(initialEmpId) },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [])

  const { codPayment, nonCodPayment, grossSalary } = useMemo(
    () => calcGross(cod, selectedRate?.cod_rate, nonCod, selectedRate?.non_cod_rate),
    [cod, nonCod, selectedRate]
  )
  const totalDeductions = useMemo(() => calcDeductions(deductions), [deductions])
  const netSalary = useMemo(() => calcNet(grossSalary, totalDeductions), [grossSalary, totalDeductions])

  async function handleSave() {
    if (!empId) return setErr('Select an employee')
    if (!project || !daType || !branch) return setErr('Select Project, DA Type and Branch')
    if (!selectedRate) return setErr('No rate configured for this Project / DA Type / Branch')
    const c = parseFloat(cod), nc = parseFloat(nonCod)
    if (isNaN(c) || c < 0) return setErr('Enter a valid COD Shipments value')
    if (isNaN(nc) || nc < 0) return setErr('Enter a valid Non-COD Shipments value')
    setSaving(true); setErr(null)
    try {
      const dedPayload = {}
      for (const f of DEDUCTION_FIELDS) dedPayload[f] = deductions[f] === '' ? 0 : parseFloat(deductions[f]) || 0
      await imileSalaryApi.saveEntry({
        emp_id: empId, month, project, da_type: daType, branch, cod: c, non_cod: nc, deductions: dedPayload,
      })
      onSave()
    } catch (e) { setErr(e.message) } finally { setSaving(false) }
  }

  const selectedEmployee = imileEmployees.find(e => e.id === empId)

  return createPortal(
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 600, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '92vh' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', background: 'linear-gradient(135deg,rgba(184,134,11,0.12),transparent)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h3 style={{ fontWeight: 900, fontSize: 16, color: 'var(--text)', margin: 0 }}>{initialEmpId ? 'Edit' : 'Add'} iMile DA Salary</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{month}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {onChangeType && (
              <select
                className="input" value="imile" title="Change pay type"
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
                  {imileEmployees.map(e => <option key={e.id} value={e.id}>{e.name} — {e.id}</option>)}
                </select>
              )}
            </div>
            {loadingEntry && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 8 }}>Loading existing entry…</div>}
          </section>

          {/* ── Classification ── */}
          <section>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Classification</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div>
                <Lbl>Project *</Lbl>
                <select className="input" value={project} disabled={loadingRates}
                  onChange={e => { setProject(e.target.value); setDaType(''); setBranch('') }}>
                  <option value="">Select…</option>
                  {projects.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <Lbl>DA Type *</Lbl>
                <select className="input" value={daType} disabled={!project}
                  onChange={e => { setDaType(e.target.value); setBranch('') }}>
                  <option value="">Select…</option>
                  {daTypes.map(t => <option key={t} value={t}>{DA_TYPE_LABELS[t] || t}</option>)}
                </select>
              </div>
              <div>
                <Lbl>Branch *</Lbl>
                <select className="input" value={branch} disabled={!daType}
                  onChange={e => setBranch(e.target.value)}>
                  <option value="">Select…</option>
                  {branches.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </div>
            {selectedRate && (
              <div style={{ marginTop: 10, background: 'var(--bg-alt)', borderRadius: 10, padding: '9px 13px', display: 'flex', gap: 18 }}>
                <div><span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>COD Rate</span><div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text)' }}>{fmtAED(selectedRate.cod_rate)}</div></div>
                <div><span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Non-COD Rate</span><div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text)' }}>{fmtAED(selectedRate.non_cod_rate)}</div></div>
              </div>
            )}
          </section>

          {/* ── Shipment Details ── */}
          <section>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Shipment Details</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><Lbl>COD Shipments *</Lbl><NumInput value={cod} onChange={setCod} /></div>
              <div><Lbl>Non-COD Shipments *</Lbl><NumInput value={nonCod} onChange={setNonCod} /></div>
            </div>
            {selectedRate && (cod !== '' || nonCod !== '') && (
              <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--text-muted)' }}>
                COD Payment {fmtAED(codPayment)} · Non-COD Payment {fmtAED(nonCodPayment)}
              </div>
            )}
          </section>

          {/* ── Deductions ── */}
          <section>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: '#EF4444', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Deductions</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {DEDUCTION_FIELDS.map(f => (
                <div key={f}>
                  <Lbl>{f === 'rta_fine' && isGatePass ? 'Gate Pass' : DEDUCTION_LABELS[f]}</Lbl>
                  <NumInput value={deductions[f]} onChange={v => setDeductionField(f, v)} small />
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ── Salary Summary (live) ── */}
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', background: 'var(--bg-alt)', flexShrink: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '6px 18px', fontSize: 12.5, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Gross Salary</span><span style={{ fontWeight: 700 }}>{fmtAED(grossSalary)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Total Deductions</span><span style={{ fontWeight: 700, color: '#EF4444' }}>-{fmtAED(totalDeductions)}</span></div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', paddingTop: 4, borderTop: '1px solid var(--border)' }}><span style={{ color: 'var(--text)', fontWeight: 800 }}>Net Salary</span><span style={{ fontWeight: 900, color: 'var(--gold)', fontSize: 14 }}>{fmtAED(netSalary)}</span></div>
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
