'use client'
// Admin-editable rate catalog behind the JNT salary engine — this table's contents ARE
// what jntSalaryEngine.js/jntSalaryCalc.js read at calculation time. See
// backend/src/routes/jnt-salary.js (GET/PUT /rates) and JntSalaryModal.jsx.
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Settings2, Save, Check, AlertCircle } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { jntSalaryApi } from '@/lib/api'
import { fmtAED } from '@/lib/jntSalaryCalc'

const SHIPMENT_ORDER = ['cod', 'non_cod', 'pickup', 'reverse_pickup']

function RateCard({ component, canEdit }) {
  const initial = Object.fromEntries(component.rates.map(r => [r.shipment_type, String(r.value)]))
  const [values, setValues] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [err,    setErr]    = useState(null)

  const dirty = component.rates.some(r => values[r.shipment_type] !== String(r.value))

  const sortedRates = [...component.rates].sort((a, b) => SHIPMENT_ORDER.indexOf(a.shipment_type) - SHIPMENT_ORDER.indexOf(b.shipment_type))

  async function handleSave() {
    for (const r of component.rates) {
      const v = values[r.shipment_type]
      if (v === '' || isNaN(v) || Number(v) < 0) return setErr(`${r.label} must be a non-negative number`)
    }
    setSaving(true); setErr(null); setSaved(false)
    try {
      await jntSalaryApi.updateRates(component.id, component.rates.map(r => ({ shipment_type: r.shipment_type, value: Number(values[r.shipment_type]) })))
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) { setErr(e.message) } finally { setSaving(false) }
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div style={{ fontWeight: 800, fontSize: 14.5, color: 'var(--text)' }}>{component.name}</div>
        {component.description && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{component.description}</div>}
      </div>

      {err && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 9, padding: '8px 12px', fontSize: 12, color: '#DC2626', display: 'flex', gap: 6, alignItems: 'center' }}>
          <AlertCircle size={12} /> {err}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${sortedRates.length}, 1fr)`, gap: 10 }}>
        {sortedRates.map(r => (
          <div key={r.shipment_type}>
            <label className="input-label">{r.label}</label>
            {canEdit ? (
              <input
                className="input" type="number" min="0" step="0.01" inputMode="decimal"
                value={values[r.shipment_type]}
                onChange={e => {
                  const v = e.target.value
                  if (v !== '' && Number(v) < 0) return
                  setValues(p => ({ ...p, [r.shipment_type]: v }))
                }}
              />
            ) : (
              <div className="input" style={{ display: 'flex', alignItems: 'center', color: 'var(--text)', fontWeight: 600, background: 'var(--bg-alt)' }}>
                {fmtAED(r.value)}
              </div>
            )}
          </div>
        ))}
      </div>

      {canEdit && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={handleSave} disabled={!dirty || saving}
            className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: (!dirty || saving) ? 0.6 : 1 }}
          >
            <Save size={13} /> {saving ? 'Saving…' : 'Save'}
          </button>
          {saved && <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#10B981', fontWeight: 700 }}><Check size={13} /> Saved</span>}
        </div>
      )}
    </div>
  )
}

export default function JntRateSettingsPage() {
  const { user } = useAuth()
  const canView = ['admin', 'manager', 'general_manager', 'accountant'].includes(user?.role)
  const canEdit = user?.role === 'admin'

  const [components, setComponents] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

  useEffect(() => {
    if (!canView) return
    jntSalaryApi.rates()
      .then(d => setComponents(d.components || []))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
  }, [canView])

  if (!canView) {
    return (
      <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        You don't have access to Payroll rate settings.
      </div>
    )
  }

  // Only per-shipment components have a global rate table — fixed/percentage custom
  // components are entered per-driver-per-month on the salary form itself, nothing here.
  const rateComponents = components.filter(c => c.calc_method === 'per_shipment' && c.rates.length > 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'slideUp 0.35s ease' }}>
      <div>
        <Link href="/dashboard/finance/payroll" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: 'var(--text-muted)', textDecoration: 'none', marginBottom: 10 }}>
          <ArrowLeft size={13} /> Back to Payroll
        </Link>
        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Settings2 size={18} color="#B8860B" />
            <h2 style={{ fontWeight: 800, fontSize: 17, margin: 0 }}>JNT Salary Rate Settings</h2>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
            {canEdit
              ? 'These rates drive every JNT DA salary calculation — the engine always reads from here, nothing is hardcoded. Changes only apply to entries saved after the change; already-entered months keep the rates they were calculated with.'
              : 'Read-only — only an administrator can change these rates.'}
          </p>
        </div>
      </div>

      {err && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 10, padding: '10px 14px', fontSize: 12.5, color: '#DC2626', display: 'flex', gap: 7, alignItems: 'center' }}>
          <AlertCircle size={13} /> {err}
        </div>
      )}

      {loading ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
      ) : rateComponents.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No rate-based components configured.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {rateComponents.map(c => <RateCard key={c.id} component={c} canEdit={canEdit} />)}
        </div>
      )}
    </div>
  )
}
