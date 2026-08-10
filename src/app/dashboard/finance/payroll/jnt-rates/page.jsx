'use client'
// Admin-editable pay rates for every project type paid a fixed rate rather than a
// per-employee value — JNT's per-shipment components (jntSalaryEngine.js /
// jnt-salary.js), the two Packer types' flat hourly rate (pay-rates.js), and iMile's
// Project × DA Type × Branch rate matrix (imile-salary.js). One page, same "the engine
// always reads from here, nothing is hardcoded" principle for all three.
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Settings2, Save, Check, AlertCircle } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { jntSalaryApi, payRatesApi, imileSalaryApi } from '@/lib/api'
import { fmtAED } from '@/lib/jntSalaryCalc'

const DA_TYPE_LABELS = { internal: 'Internal', external: 'External' }

const SHIPMENT_ORDER = ['cod', 'non_cod', 'pickup', 'reverse_pickup']

function SectionLabel({ children }) {
  return <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '4px 0 -2px' }}>{children}</div>
}

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

// Simple single-value rate — for Creative Packers/Le Chocola's flat hourly rate,
// unlike JNT's per-shipment-type grid above.
function FlatRateCard({ pay_rate, canEdit }) {
  const [value, setValue] = useState(String(pay_rate.value))
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [err,    setErr]    = useState(null)
  const dirty = value !== String(pay_rate.value)

  async function handleSave() {
    if (value === '' || isNaN(value) || Number(value) < 0) return setErr(`${pay_rate.label} must be a non-negative number`)
    setSaving(true); setErr(null); setSaved(false)
    try {
      await payRatesApi.update(pay_rate.key, Number(value))
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) { setErr(e.message) } finally { setSaving(false) }
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontWeight: 800, fontSize: 14.5, color: 'var(--text)' }}>{pay_rate.label}</div>

      {err && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 9, padding: '8px 12px', fontSize: 12, color: '#DC2626', display: 'flex', gap: 6, alignItems: 'center' }}>
          <AlertCircle size={12} /> {err}
        </div>
      )}

      <div style={{ maxWidth: 220 }}>
        <label className="input-label">AED / Hour</label>
        {canEdit ? (
          <input
            className="input" type="number" min="0" step="0.01" inputMode="decimal"
            value={value}
            onChange={e => {
              const v = e.target.value
              if (v !== '' && Number(v) < 0) return
              setValue(v)
            }}
          />
        ) : (
          <div className="input" style={{ display: 'flex', alignItems: 'center', color: 'var(--text)', fontWeight: 600, background: 'var(--bg-alt)' }}>
            {fmtAED(pay_rate.value)}
          </div>
        )}
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

// One (DA Type, Branch) row within an iMile project group — COD/Non-COD rates,
// independently saved via PUT /rates/:id since each combo is its own DB row.
function ImileRateRow({ rate, canEdit }) {
  const [cod, setCod] = useState(String(rate.cod_rate))
  const [nonCod, setNonCod] = useState(String(rate.non_cod_rate))
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [err,    setErr]    = useState(null)
  const dirty = cod !== String(rate.cod_rate) || nonCod !== String(rate.non_cod_rate)

  async function handleSave() {
    if (cod === '' || isNaN(cod) || Number(cod) < 0) return setErr('COD rate must be a non-negative number')
    if (nonCod === '' || isNaN(nonCod) || Number(nonCod) < 0) return setErr('Non-COD rate must be a non-negative number')
    setSaving(true); setErr(null); setSaved(false)
    try {
      await imileSalaryApi.updateRate(rate.id, Number(cod), Number(nonCod))
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) { setErr(e.message) } finally { setSaving(false) }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, padding: '10px 0', borderTop: '1px solid var(--border)' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{DA_TYPE_LABELS[rate.da_type] || rate.da_type}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{rate.branch}</div>
      </div>
      <div style={{ width: 110 }}>
        <label className="input-label" style={{ fontSize: 10.5 }}>COD Rate</label>
        {canEdit ? (
          <input className="input" type="number" min="0" step="0.01" inputMode="decimal" value={cod}
            style={{ padding: '7px 10px', fontSize: 12.5 }}
            onChange={e => { const v = e.target.value; if (v !== '' && Number(v) < 0) return; setCod(v) }} />
        ) : (
          <div className="input" style={{ padding: '7px 10px', fontSize: 12.5, display: 'flex', alignItems: 'center', color: 'var(--text)', fontWeight: 600, background: 'var(--bg-alt)' }}>{fmtAED(rate.cod_rate)}</div>
        )}
      </div>
      <div style={{ width: 110 }}>
        <label className="input-label" style={{ fontSize: 10.5 }}>Non-COD Rate</label>
        {canEdit ? (
          <input className="input" type="number" min="0" step="0.01" inputMode="decimal" value={nonCod}
            style={{ padding: '7px 10px', fontSize: 12.5 }}
            onChange={e => { const v = e.target.value; if (v !== '' && Number(v) < 0) return; setNonCod(v) }} />
        ) : (
          <div className="input" style={{ padding: '7px 10px', fontSize: 12.5, display: 'flex', alignItems: 'center', color: 'var(--text)', fontWeight: 600, background: 'var(--bg-alt)' }}>{fmtAED(rate.non_cod_rate)}</div>
        )}
      </div>
      {canEdit && (
        <button onClick={handleSave} disabled={!dirty || saving} className="btn btn-primary"
          style={{ padding: '7px 12px', fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 5, opacity: (!dirty || saving) ? 0.6 : 1, flexShrink: 0 }}>
          <Save size={12} /> {saving ? 'Saving…' : 'Save'}
        </button>
      )}
      {saved && <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: '#10B981', fontWeight: 700, flexShrink: 0 }}><Check size={12} /> Saved</span>}
      {err && <span style={{ fontSize: 11, color: '#DC2626', flexShrink: 0 }}>{err}</span>}
    </div>
  )
}

// Groups iMile's per-combo rate rows under one card per Project, since the matrix
// isn't a full cartesian product (e.g. no NDD+Internal+AJM DS) — flattening all 9 into
// separate cards would read as more options than actually exist.
function ImileProjectCard({ project, rates, canEdit }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ fontWeight: 800, fontSize: 14.5, color: 'var(--text)' }}>{project}</div>
      {rates.map(r => <ImileRateRow key={r.id} rate={r} canEdit={canEdit} />)}
    </div>
  )
}

export default function RateSettingsPage() {
  const { user } = useAuth()
  const canView = ['admin', 'manager', 'general_manager', 'accountant'].includes(user?.role)
  const canEdit = user?.role === 'admin'

  const [components, setComponents] = useState([])
  const [payRates, setPayRates] = useState([])
  const [imileRates, setImileRates] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

  useEffect(() => {
    if (!canView) return
    Promise.all([jntSalaryApi.rates(), payRatesApi.list(), imileSalaryApi.rates()])
      .then(([jnt, pr, im]) => { setComponents(jnt.components || []); setPayRates(pr.rates || []); setImileRates(im.rates || []) })
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

  const imileByProject = imileRates.reduce((acc, r) => {
    (acc[r.project] ||= []).push(r)
    return acc
  }, {})

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'slideUp 0.35s ease' }}>
      <div>
        <Link href="/dashboard/finance/payroll" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: 'var(--text-muted)', textDecoration: 'none', marginBottom: 10 }}>
          <ArrowLeft size={13} /> Back to Payroll
        </Link>
        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Settings2 size={18} color="#B8860B" />
            <h2 style={{ fontWeight: 800, fontSize: 17, margin: 0 }}>Pay Rate Settings</h2>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
            {canEdit
              ? 'These rates drive every JNT / iMile / Creative Packers / Le Chocola salary calculation — the engine always reads from here, nothing is hardcoded. Changes only apply to entries saved after the change; already-entered months keep the rates they were calculated with.'
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
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {rateComponents.length > 0 && (<>
            <SectionLabel>JNT Salary Rates</SectionLabel>
            {rateComponents.map(c => <RateCard key={c.id} component={c} canEdit={canEdit} />)}
          </>)}
          {Object.keys(imileByProject).length > 0 && (<>
            <SectionLabel>iMile Rates</SectionLabel>
            {Object.entries(imileByProject).map(([project, rates]) => (
              <ImileProjectCard key={project} project={project} rates={rates} canEdit={canEdit} />
            ))}
          </>)}
          {payRates.length > 0 && (<>
            <SectionLabel>Packer Hourly Rates</SectionLabel>
            {payRates.map(r => <FlatRateCard key={r.key} pay_rate={r} canEdit={canEdit} />)}
          </>)}
          {rateComponents.length === 0 && payRates.length === 0 && imileRates.length === 0 && (
            <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No rate-based components configured.</div>
          )}
        </div>
      )}
    </div>
  )
}
