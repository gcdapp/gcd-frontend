'use client'
// Redesigned JNT DA salary entry form — configurable rates, unlimited earning
// components, live-calculating summary. Pairs with backend/src/routes/jnt-salary.js
// and backend/src/lib/jntSalaryEngine.js; frontend calc mirror in lib/jntSalaryCalc.js.
import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { X, Plus, Trash2, AlertCircle, ChevronDown } from 'lucide-react'
import { jntSalaryApi } from '@/lib/api'
import {
  SHIPMENT_TYPES, DEDUCTION_FIELDS, calcComponentAmount, calcSalary, calcDeductions, calcNetSalary, fmtAED,
} from '@/lib/jntSalaryCalc'

const SHIPMENT_LABELS = { cod: 'COD Shipments', non_cod: 'Non-COD Shipments', pickup: 'Pickup Shipments', reverse_pickup: 'Reverse Pickup Shipments' }
const DEDUCTION_LABELS = { jnt_deduction: 'JNT Deductions', sim_charge: 'SIM Charge', car_rent: 'Car Rent', rta_fine: 'RTA Fines', carry_forward: 'Carry Forward', cash_advance: 'Advance Payment' }
const CALC_METHOD_LABELS = { fixed: 'Fixed Amount', per_shipment: 'Per Shipment', percentage: 'Percentage' }

function Lbl({ children }) { return <label className="input-label">{children}</label> }

// A non-negative-only number input — typing "-" or a negative value is simply
// rejected at the input level (satisfies "validation for negative values" by
// construction rather than only catching it on submit).
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

export default function JntSalaryModal({ employees, month, initialEmpId, onSave, onClose, onChangeType }) {
  const jntEmployees = useMemo(() => (employees || []).filter(e => (e.project_type || '').toLowerCase() === 'jnt_express'), [employees])

  const [empId, setEmpId] = useState(initialEmpId || '')
  const [components, setComponents] = useState([])       // full rate catalog (base + additional)
  const [loadingRates, setLoadingRates] = useState(true)
  const [loadingEntry, setLoadingEntry] = useState(false)
  const [shipmentQtys, setShipmentQtys] = useState({ cod: '', non_cod: '', pickup: '', reverse_pickup: '' })
  // Branch/Days match the real accountant sheet's columns — Branch is just the DA's
  // station (already on their employee record, shown read-only); Days is reference-only
  // (days worked this month), doesn't factor into the shipment-based formula.
  const [workingDays, setWorkingDays] = useState('')
  const [earnings, setEarnings] = useState([])            // this entry's additional-earning rows
  const [deductions, setDeductions] = useState(() => Object.fromEntries(DEDUCTION_FIELDS.map(f => [f, ''])))
  const [showAddPicker, setShowAddPicker] = useState(false)
  const [newComponent, setNewComponent] = useState(null)  // {name, calc_method, shipment_type, rate} while creating one
  const [saving, setSaving] = useState(false)
  const [savingComponent, setSavingComponent] = useState(false)
  const [err, setErr] = useState(null)

  const baseComponent = components.find(c => c.is_base)
  const additionalComponents = components.filter(c => !c.is_base)
  const availableToAdd = additionalComponents.filter(c => !earnings.some(e => e.component_id === c.id))

  useEffect(() => {
    jntSalaryApi.rates()
      .then(d => setComponents(d.components || []))
      .catch(() => setErr('Failed to load salary rates'))
      .finally(() => setLoadingRates(false))
  }, [])

  // Prefill when opened for an employee who already has an entry this month.
  useEffect(() => {
    if (!empId) return
    setLoadingEntry(true)
    jntSalaryApi.getEntry(empId, month)
      .then(d => {
        const baseRow = (d.components || []).find(c => c.is_base)
        if (baseRow?.shipment_qtys) {
          setShipmentQtys({
            cod: String(baseRow.shipment_qtys.cod ?? ''), non_cod: String(baseRow.shipment_qtys.non_cod ?? ''),
            pickup: String(baseRow.shipment_qtys.pickup ?? ''), reverse_pickup: String(baseRow.shipment_qtys.reverse_pickup ?? ''),
          })
        }
        setWorkingDays(d.entry?.working_days != null ? String(d.entry.working_days) : '')
        setEarnings((d.components || []).filter(c => !c.is_base).map(c => ({
          component_id: c.component_id, name: c.component_name, calc_method: c.calc_method,
          shipment_qtys: c.shipment_qtys ? Object.fromEntries(Object.entries(c.shipment_qtys).map(([k, v]) => [k, String(v)])) : {},
          fixed_amount: c.fixed_amount != null ? String(c.fixed_amount) : '',
          percentage_rate: c.percentage_rate != null ? String(c.percentage_rate) : '',
          description: c.description || '',
        })))
        const ded = {}
        for (const f of DEDUCTION_FIELDS) ded[f] = d.deductions?.[f] != null ? String(d.deductions[f]) : ''
        setDeductions(ded)
      })
      .catch(() => {})
      .finally(() => setLoadingEntry(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empId, month])

  // ── Live calculation ──────────────────────────────────────────
  const entryInputs = useMemo(() => {
    const inputs = {}
    if (baseComponent) inputs[baseComponent.id] = { shipment_qtys: shipmentQtys }
    for (const e of earnings) {
      inputs[e.component_id] = { shipment_qtys: e.shipment_qtys, fixed_amount: e.fixed_amount, percentage_rate: e.percentage_rate }
    }
    return inputs
  }, [baseComponent, shipmentQtys, earnings])

  const { base, additionalEarnings, grossSalary } = useMemo(
    () => calcSalary(components, entryInputs), [components, entryInputs]
  )
  const totalDeductions = useMemo(() => calcDeductions(deductions), [deductions])
  const netSalary = calcNetSalary(grossSalary, totalDeductions)

  function updateShipmentQty(key, value) { setShipmentQtys(p => ({ ...p, [key]: value })) }
  function updateDeduction(key, value) { setDeductions(p => ({ ...p, [key]: value })) }

  function addEarningRow(component) {
    setEarnings(p => [...p, {
      component_id: component.id, name: component.name, calc_method: component.calc_method,
      shipment_qtys: {}, fixed_amount: '', percentage_rate: '', description: '',
    }])
    setShowAddPicker(false)
  }
  function removeEarningRow(componentId) {
    setEarnings(p => p.filter(e => e.component_id !== componentId))
  }
  function updateEarningRow(componentId, patch) {
    setEarnings(p => p.map(e => e.component_id === componentId ? { ...e, ...patch } : e))
  }

  async function createComponent() {
    if (!newComponent?.name?.trim()) return setErr('Component name required')
    if (newComponent.calc_method === 'per_shipment' && (!newComponent.shipment_type || newComponent.rate === '' || newComponent.rate == null)) {
      return setErr('Pick a shipment type and rate for a per-shipment component')
    }
    setSavingComponent(true); setErr(null)
    try {
      const body = { name: newComponent.name.trim(), calc_method: newComponent.calc_method }
      if (newComponent.calc_method === 'per_shipment') {
        body.rates = [{ shipment_type: newComponent.shipment_type, label: `${newComponent.name.trim()} (${SHIPMENT_LABELS[newComponent.shipment_type]})`, value: Number(newComponent.rate) }]
      }
      const data = await jntSalaryApi.addComponent(body)
      setComponents(data.components || [])
      const created = (data.components || []).find(c => c.id === data.component_id)
      if (created) addEarningRow(created)
      setNewComponent(null)
    } catch (e) { setErr(e.message) } finally { setSavingComponent(false) }
  }

  async function handleSave() {
    if (!empId) return setErr('Select a driver')
    setSaving(true); setErr(null)
    try {
      await jntSalaryApi.saveEntry({
        emp_id: empId, month, shipment_qtys: shipmentQtys,
        working_days: workingDays === '' ? undefined : workingDays,
        components: earnings.map(e => ({
          component_id: e.component_id, shipment_qtys: e.shipment_qtys,
          fixed_amount: e.fixed_amount === '' ? undefined : e.fixed_amount,
          percentage_rate: e.percentage_rate === '' ? undefined : e.percentage_rate,
          description: e.description || undefined,
        })),
        deductions,
      })
      onSave()
    } catch (e) { setErr(e.message) } finally { setSaving(false) }
  }

  const selectedEmployee = jntEmployees.find(e => e.id === empId)

  return createPortal(
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 620, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '92vh' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', background: 'linear-gradient(135deg,rgba(184,134,11,0.12),transparent)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h3 style={{ fontWeight: 900, fontSize: 16, color: 'var(--text)', margin: 0 }}>{initialEmpId ? 'Edit' : 'Add'} JNT DA Salary</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{month}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {onChangeType && (
              <select
                className="input" value="jnt_express" title="Change pay type"
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
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <Lbl>Employee *</Lbl>
                {initialEmpId ? (
                  <div className="input" style={{ display: 'flex', alignItems: 'center', color: 'var(--text)', fontWeight: 600, background: 'var(--bg-alt)' }}>
                    {selectedEmployee ? `${selectedEmployee.name} — ${selectedEmployee.id}` : empId}
                  </div>
                ) : (
                  <select className="input" value={empId} onChange={e => setEmpId(e.target.value)}>
                    <option value="">Select…</option>
                    {jntEmployees.map(e => <option key={e.id} value={e.id}>{e.name} — {e.id}</option>)}
                  </select>
                )}
              </div>
              <div>
                <Lbl>Salary Month</Lbl>
                <div className="input" style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-alt)', color: 'var(--text-muted)', fontWeight: 600 }}>{month}</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <Lbl>Branch</Lbl>
                <div className="input" style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-alt)', color: 'var(--text-muted)', fontWeight: 600 }}>
                  {selectedEmployee?.station_code || '—'}
                </div>
              </div>
              <div>
                <Lbl>Days (reference only)</Lbl>
                <NumInput value={workingDays} onChange={setWorkingDays} />
              </div>
            </div>
          </section>

          {loadingRates || loadingEntry ? (
            <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>
          ) : (
            <>
              {/* ── Shipment Details ── */}
              <section>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Shipment Details</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {SHIPMENT_TYPES.map(k => (
                    <div key={k}>
                      <Lbl>{SHIPMENT_LABELS[k]} *</Lbl>
                      <NumInput value={shipmentQtys[k]} onChange={v => updateShipmentQty(k, v)} />
                    </div>
                  ))}
                </div>
              </section>

              {/* ── Additional Earnings ── */}
              <section>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 800, color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Additional Earnings</div>
                  <div style={{ position: 'relative' }}>
                    <button type="button" onClick={() => setShowAddPicker(p => !p)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 100, border: '1px solid rgba(16,185,129,0.4)', background: 'rgba(16,185,129,0.1)', color: '#10B981', fontWeight: 700, fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit' }}>
                      <Plus size={12} /> Add Component <ChevronDown size={11} />
                    </button>
                    {showAddPicker && (
                      <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', width: 260, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 50, overflow: 'hidden' }}>
                        {availableToAdd.length === 0 && !newComponent && (
                          <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)' }}>No more catalog components — create one below.</div>
                        )}
                        {availableToAdd.map(c => (
                          <div key={c.id} onClick={() => addEarningRow(c)}
                            style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: 'var(--text)', borderBottom: '1px solid var(--border)' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-alt)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            {c.name} <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>· {CALC_METHOD_LABELS[c.calc_method]}</span>
                          </div>
                        ))}
                        <div onClick={() => { setNewComponent({ name: '', calc_method: 'fixed', shipment_type: 'cod', rate: '' }); setShowAddPicker(false) }}
                          style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: 'var(--gold)' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-alt)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          + New Component…
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {newComponent && (
                  <div style={{ border: '1px dashed var(--border-strong)', borderRadius: 12, padding: 12, marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
                      <div><Lbl>Component Name</Lbl>
                        <input className="input" value={newComponent.name} onChange={e => setNewComponent(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Attendance Bonus" style={{ padding: '7px 10px', fontSize: 12.5 }} /></div>
                      <div><Lbl>Calculation Type</Lbl>
                        <select className="input" value={newComponent.calc_method} onChange={e => setNewComponent(p => ({ ...p, calc_method: e.target.value }))} style={{ padding: '7px 10px', fontSize: 12.5 }}>
                          <option value="fixed">Fixed Amount</option>
                          <option value="per_shipment">Per Shipment</option>
                          <option value="percentage">Percentage</option>
                        </select></div>
                    </div>
                    {newComponent.calc_method === 'per_shipment' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <div><Lbl>Shipment Type</Lbl>
                          <select className="input" value={newComponent.shipment_type} onChange={e => setNewComponent(p => ({ ...p, shipment_type: e.target.value }))} style={{ padding: '7px 10px', fontSize: 12.5 }}>
                            {SHIPMENT_TYPES.map(k => <option key={k} value={k}>{SHIPMENT_LABELS[k]}</option>)}
                          </select></div>
                        <div><Lbl>Rate (AED)</Lbl>
                          <NumInput small value={newComponent.rate} onChange={v => setNewComponent(p => ({ ...p, rate: v }))} /></div>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button type="button" onClick={() => setNewComponent(null)} className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: 12 }}>Cancel</button>
                      <button type="button" onClick={createComponent} disabled={savingComponent} className="btn btn-primary" style={{ padding: '6px 14px', fontSize: 12 }}>{savingComponent ? 'Saving…' : 'Create & Add'}</button>
                    </div>
                  </div>
                )}

                {earnings.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: 12 }}>
                    No earning components added — click "+ Add Component" for Fuel Subsidy, Eid Incentive, or a custom one.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {earnings.map(e => {
                      const comp = components.find(c => c.id === e.component_id)
                      const amount = comp ? calcComponentAmount(comp, e, base) : 0
                      return (
                        <div key={e.component_id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{e.name} <span style={{ fontWeight: 500, fontSize: 11, color: 'var(--text-muted)' }}>· {CALC_METHOD_LABELS[e.calc_method]}</span></div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ fontWeight: 800, fontSize: 13, color: '#10B981' }}>{fmtAED(amount)}</span>
                              <button type="button" onClick={() => removeEarningRow(e.component_id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', display: 'flex', padding: 4 }}><Trash2 size={13} /></button>
                            </div>
                          </div>
                          {e.calc_method === 'per_shipment' && comp && (
                            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${comp.rates.length},1fr)`, gap: 8, marginBottom: 8 }}>
                              {comp.rates.map(r => (
                                <div key={r.shipment_type}>
                                  <Lbl>{r.label} (AED {r.value})</Lbl>
                                  <NumInput small value={e.shipment_qtys?.[r.shipment_type] || ''} onChange={v => updateEarningRow(e.component_id, { shipment_qtys: { ...e.shipment_qtys, [r.shipment_type]: v } })} />
                                </div>
                              ))}
                            </div>
                          )}
                          {e.calc_method === 'fixed' && (
                            <div style={{ marginBottom: 8 }}><Lbl>Amount (AED)</Lbl>
                              <NumInput small value={e.fixed_amount} onChange={v => updateEarningRow(e.component_id, { fixed_amount: v })} /></div>
                          )}
                          {e.calc_method === 'percentage' && (
                            <div style={{ marginBottom: 8 }}><Lbl>Percentage of Base Salary (%)</Lbl>
                              <NumInput small value={e.percentage_rate} onChange={v => updateEarningRow(e.component_id, { percentage_rate: v })} /></div>
                          )}
                          <input className="input" value={e.description} onChange={ev => updateEarningRow(e.component_id, { description: ev.target.value })} placeholder="Description (optional)" style={{ padding: '7px 10px', fontSize: 12 }} />
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>

              {/* ── Deductions ── */}
              <section>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: '#EF4444', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Deductions</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  {DEDUCTION_FIELDS.map(f => (
                    <div key={f}>
                      <Lbl>{DEDUCTION_LABELS[f]}</Lbl>
                      <NumInput small value={deductions[f]} onChange={v => updateDeduction(f, v)} />
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>

        {/* ── Salary Summary (sticky, live) ── */}
        <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-alt)', padding: '14px 22px', flexShrink: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 12 }}>
            {[
              { label: 'Base Salary', value: base, c: 'var(--text)' },
              { label: 'Additional Earnings', value: additionalEarnings, c: '#10B981' },
              { label: 'Gross Salary', value: grossSalary, c: 'var(--text)' },
              { label: 'Total Deductions', value: totalDeductions, c: '#EF4444' },
              { label: 'Net Salary', value: netSalary, c: '#B8860B' },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{s.label}</div>
                <div style={{ fontSize: s.label === 'Net Salary' ? 15 : 13, fontWeight: 900, color: s.c, letterSpacing: '-0.02em' }}>{fmtAED(s.value)}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
            <button onClick={handleSave} disabled={saving || loadingRates}
              style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 11, borderRadius: 100, background: 'linear-gradient(135deg,#B8860B,#D4A017)', color: 'white', fontWeight: 700, fontSize: 13, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'Poppins,sans-serif', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Saving…' : 'Save Salary'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
