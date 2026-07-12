'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/lib/auth'
import { vehicleApi, vehicleInspectionApi } from '@/lib/api'
import {
  Plus, X, Trash2, Printer, Search, ClipboardCheck,
  ChevronDown, CheckCircle, Calendar, Truck, Eye,
} from 'lucide-react'

// ── Inspection section definitions ────────────────────────────
const SECTIONS = [
  {
    key: 'exterior',
    title: '1.  Exterior Inspection',
    items: [
      'Body Condition: Check for dents, scratches, and signs of previous accidents',
      'Lights: Test headlights, taillights, brake lights, turn signals, and hazard lights',
      'Glass and Mirrors: Inspect windshields, windows, and mirrors for cracks and damage',
      'Tires: Check tire condition, tread depth, and inflation pressure',
      'License Plates: Verify the presence and visibility of front and rear license plates',
    ],
  },
  {
    key: 'interior',
    title: '2.  Interior Inspection',
    items: [
      'Seatbelts: Ensure all seatbelts are functional and in good condition',
      'Dashboard: Check warning lights and gauges for proper functionality',
      'Controls: Test all interior controls (e.g., AC, radio, windows, locks)',
      'Seats and Upholstery: Inspect seats and upholstery for tears or damage',
      'Floor Mats: Check for proper floor mat installation and secure them in place',
    ],
  },
  {
    key: 'engine',
    title: '3.  Engine Compartment',
    items: [
      'Fluid Levels: Check engine oil, coolant, brake fluid, and windshield washer fluid levels',
      'Belts and Hoses: Inspect belts and hoses for signs of wear or damage',
      'Battery: Check battery terminals and ensure they are clean and secure',
      'Engine Condition: Look for leaks or signs of engine problems',
    ],
  },
  {
    key: 'undercarriage',
    title: '4.  Undercarriage Inspection',
    items: [
      'Exhaust System: Check for leaks, rust, and damage in the exhaust system',
      'Suspension: Inspect shocks, struts, and suspension components',
      'Brakes: Check brake lines, pads, and rotors for wear',
      'Steering: Test the steering system for smooth operation',
    ],
  },
  {
    key: 'safety',
    title: '5.  Safety Equipment',
    items: [
      'Spare Tire and Tools: Verify the presence of a functional spare tire and tools',
      'Jack: Check the functionality and condition of the vehicle jack',
      'Warning Triangles: Ensure warning triangles are available in case of emergencies',
      'First Aid Kit: Check for the presence and completeness of a first aid kit',
    ],
  },
  {
    key: 'documentation',
    title: '6.  Vehicle Documentation',
    items: [
      'Vehicle Registration: Verify that the vehicle registration is valid and up-to-date',
      'Insurance: Ensure the vehicle is adequately insured',
      'Service Records: Review the vehicle\'s service history and maintenance records',
      'Owner\'s Manual: Check for the presence of the vehicle\'s owner\'s manual',
    ],
  },
  {
    key: 'compliance',
    title: '7.  Compliance and Emissions',
    items: [
      'Emission Control System: Check for compliance with emission standards',
      'Vehicle Inspection Sticker: Ensure the vehicle has a valid inspection sticker',
      'Compliance with Local Regulations: Verify compliance with local vehicle regulations',
    ],
  },
]

function initSections() {
  return Object.fromEntries(
    SECTIONS.map(s => [s.key, { items: new Array(s.items.length).fill(''), observations: '' }])
  )
}

function fmt(ds) {
  if (!ds) return '—'
  return new Date(ds + 'T00:00:00').toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
}

function countResults(sections) {
  let yes = 0, no = 0, na = 0
  SECTIONS.forEach(s => {
    const sec = sections?.[s.key]
    if (!sec) return
    sec.items?.forEach(v => {
      if (v === 'yes') yes++
      else if (v === 'no') no++
      else if (v === 'na') na++
    })
  })
  return { yes, no, na }
}

// ── Radio button ──────────────────────────────────────────────
function Radio({ value, current, onChange, label, color }) {
  const on = current === value
  return (
    <label style={{ display:'flex', alignItems:'center', gap:5, cursor:'pointer', userSelect:'none' }}>
      <div
        onClick={() => onChange(value)}
        style={{
          width: 18, height: 18, borderRadius: '50%',
          border: `2px solid ${on ? color : 'var(--border-med)'}`,
          background: on ? color : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s', flexShrink: 0, cursor: 'pointer',
        }}
      >
        {on && <div style={{ width:7, height:7, borderRadius:'50%', background:'white' }}/>}
      </div>
      <span style={{ fontSize: 11.5, color: on ? color : 'var(--text-muted)', fontWeight: on ? 700 : 400 }}>
        {label}
      </span>
    </label>
  )
}

// ── Section row ───────────────────────────────────────────────
function SectionBlock({ section, data, onChange }) {
  const set = (idx, val) => {
    const items = [...(data.items || [])]
    items[idx] = val
    onChange({ ...data, items })
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        fontWeight: 800, fontSize: 13, color: 'var(--text)',
        letterSpacing: '0.03em', paddingBottom: 10,
        borderBottom: '2px solid var(--gold)', marginBottom: 10,
      }}>
        {section.title}
      </div>

      {section.items.map((item, idx) => (
        <div key={idx} style={{
          display: 'flex', alignItems: 'flex-start', gap: 12,
          padding: '9px 0', borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ flex: 1, fontSize: 12.5, color: 'var(--text)', lineHeight: 1.4 }}>{item}</span>
          <div style={{ display: 'flex', gap: 14, flexShrink: 0, marginTop: 2 }}>
            <Radio value="yes" current={data.items?.[idx] || ''} onChange={v => set(idx, v)} label="Yes" color="#2E7D52"/>
            <Radio value="no"  current={data.items?.[idx] || ''} onChange={v => set(idx, v)} label="No"  color="#C0392B"/>
            <Radio value="na"  current={data.items?.[idx] || ''} onChange={v => set(idx, v)} label="NA"  color="#A89880"/>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── New / Edit Inspection Modal ───────────────────────────────
function InspectionModal({ vehicles, editInspection, onSave, onClose }) {
  const isEdit = !!editInspection
  const today  = new Date().toISOString().slice(0, 10)

  const [vehicleId,     setVehicleId]     = useState(editInspection?.vehicle_id || '')
  const [date,          setDate]          = useState(editInspection?.inspection_date?.slice(0,10) || today)
  const [inspectorName, setInspectorName] = useState(editInspection?.inspector_name || '')
  const [sections,      setSections]      = useState(
    editInspection?.sections
      ? (typeof editInspection.sections === 'string' ? JSON.parse(editInspection.sections) : editInspection.sections)
      : initSections()
  )
  const [addlNotes, setAddlNotes] = useState(editInspection?.additional_notes || '')
  const [saving,    setSaving]    = useState(false)
  const [err,       setErr]       = useState(null)

  const setSection = (key, val) => setSections(p => ({ ...p, [key]: val }))

  async function handleSave() {
    if (!vehicleId) return setErr('Please select a vehicle')
    if (!date)      return setErr('Please enter an inspection date')
    setSaving(true); setErr(null)
    try {
      const body = {
        vehicle_id:      vehicleId,
        inspection_date: date,
        inspector_name:  inspectorName || null,
        sections,
        additional_notes: addlNotes || null,
        status: 'completed',
      }
      if (isEdit) {
        await vehicleInspectionApi.update(editInspection.id, body)
      } else {
        await vehicleInspectionApi.create(body)
      }
      onSave()
    } catch (e) { setErr(e.message) } finally { setSaving(false) }
  }

  const selectedVehicle = vehicles.find(v => v.id === vehicleId)

  return createPortal(
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 780, padding: 0, overflow: 'hidden', maxHeight: '96vh', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px 16px', background: 'linear-gradient(135deg,#FFFBEB,#FDF6E3)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ fontWeight: 900, fontSize: 18, color: 'var(--text)' }}>
                {isEdit ? 'Edit' : 'New'} Vehicle Inspection
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                Complete all 7 sections with Yes / No / NA
              </p>
            </div>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,0,0,0.06)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={15}/>
            </button>
          </div>
        </div>

        {/* Body — scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* Vehicle Info */}
          <div style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', marginBottom: 24 }}>
            <div style={{ fontWeight: 800, fontSize: 12.5, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>
              Vehicle Information
            </div>
            <div className="modal-two-col" style={{ marginBottom: 12 }}>
              <div>
                <label className="input-label">Vehicle *</label>
                <select className="input" value={vehicleId} onChange={e => setVehicleId(e.target.value)}>
                  <option value="">— Select vehicle —</option>
                  {Object.entries(
                    vehicles.reduce((acc, v) => {
                      const sc = v.station_code || 'Unknown'
                      if (!acc[sc]) acc[sc] = []
                      acc[sc].push(v)
                      return acc
                    }, {})
                  ).map(([sc, svs]) => (
                    <optgroup key={sc} label={`Station ${sc}`}>
                      {svs.map(v => (
                        <option key={v.id} value={v.id}>
                          {v.plate}{v.make ? ` · ${v.make}` : ''}{v.model ? ` ${v.model}` : ''}{v.year ? ` (${v.year})` : ''}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <label className="input-label">Date of Inspection *</label>
                <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)}/>
              </div>
              <div>
                <label className="input-label">Inspector Name</label>
                <input className="input" value={inspectorName} onChange={e => setInspectorName(e.target.value)} placeholder="Full name"/>
              </div>
              <div>
                <label className="input-label">License Plate</label>
                <input className="input" value={selectedVehicle?.plate || ''} readOnly style={{ opacity: 0.7 }}/>
              </div>
            </div>

          </div>

          {/* Sections */}
          {SECTIONS.map(section => (
            <SectionBlock
              key={section.key}
              section={section}
              data={sections[section.key] || { items: [], observations: '' }}
              onChange={val => setSection(section.key, val)}
            />
          ))}

          {/* Additional Notes */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text)', letterSpacing: '0.03em', paddingBottom: 10, borderBottom: '2px solid var(--gold)', marginBottom: 10 }}>
              Additional Notes / Observations
            </div>
            <textarea
              value={addlNotes}
              onChange={e => setAddlNotes(e.target.value)}
              rows={4}
              className="input"
              style={{ width: '100%', resize: 'vertical', fontSize: 12.5 }}
              placeholder="Insert any additional notes or vehicle inspection observations made during the inspection…"
            />
          </div>

          {err && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', fontSize: 12.5, color: '#C0392B', marginTop: 12 }}>
              {err}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0 }}>
          <button onClick={onClose} className="btn-secondary" style={{ padding: '9px 20px', fontSize: 13 }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ padding: '9px 20px', fontSize: 13 }}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Save Inspection'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Print helper ──────────────────────────────────────────────
function printInspection(insp) {
  const secs = typeof insp.sections === 'string' ? JSON.parse(insp.sections) : (insp.sections || {})

  const radioHtml = (val) => {
    const box = (v, lbl, c) => `
      <span class="radio-group">
        <span class="radio-box${val===v?` checked" style="border-color:${c};background:${c}`:''}"></span>
        ${lbl}
      </span>`
    return `<span class="radio-row">${box('yes','Yes','#2E7D52')}${box('no','No','#C0392B')}${box('na','NA','#A89880')}</span>`
  }

  const sectionsHtml = SECTIONS.map(section => {
    const data = secs[section.key] || { items: [] }
    const rows = section.items.map((item, idx) => `
      <tr>
        <td class="item-cell">${item}</td>
        <td class="check-cell">${radioHtml(data.items?.[idx] || '')}</td>
      </tr>`).join('')
    return `
      <div class="section">
        <div class="section-title">${section.title}</div>
        <table class="check-table">
          <tbody>${rows}</tbody>
        </table>
      </div>`
  }).join('')

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Vehicle Inspection — ${insp.plate}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0 }
  @page { size:A4; margin:14mm 14mm }
  body { font-family:'Segoe UI',Arial,sans-serif; font-size:10.5pt; color:#1A1612 }
  h1 { text-align:center; font-size:20pt; font-weight:900; margin-bottom:18px; letter-spacing:-0.02em }
  .info-section { border:1px solid #ccc; border-radius:6px; padding:12px 14px; margin-bottom:16px }
  .info-section h2 { font-size:9pt; font-weight:800; text-transform:uppercase; letter-spacing:0.08em; color:#888; margin-bottom:10px }
  .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px }
  .info-row { display:flex; gap:8px; align-items:baseline }
  .info-label { font-size:9pt; color:#888; min-width:110px; flex-shrink:0 }
  .info-val { font-size:10pt; font-weight:700; border-bottom:1px solid #ddd; flex:1; padding-bottom:2px; min-height:18px }
  .instructions { border:1px dashed #ccc; border-radius:4px; padding:9px 12px; margin-bottom:16px; font-size:9pt; color:#666; line-height:1.6 }
  .instructions strong { color:#1A1612 }
  .section { margin-bottom:18px }
  .section-title { font-size:10.5pt; font-weight:800; border-bottom:2px solid #B8860B; padding-bottom:6px; margin-bottom:8px; letter-spacing:0.03em }
  .check-table { width:100%; border-collapse:collapse }
  .check-table tr { border-bottom:1px solid #eee }
  .item-cell { padding:7px 0; font-size:9.5pt; line-height:1.4; width:72% }
  .check-cell { text-align:right; vertical-align:middle; padding:7px 0 }
  .radio-row { display:flex; gap:12px; justify-content:flex-end }
  .radio-group { display:flex; align-items:center; gap:4px; font-size:9pt; color:#555 }
  .radio-box { display:inline-block; width:12px; height:12px; border-radius:3px; border:2px solid #ccc; vertical-align:middle }
  .radio-box.checked { background:#2E7D52; border-color:#2E7D52 }
  .obs-row { display:flex; gap:10px; margin-top:8px; align-items:flex-start }
  .obs-label { font-size:8.5pt; color:#888; min-width:140px; flex-shrink:0; line-height:1.5; padding-top:4px }
  .obs-box { flex:1; border:1px solid #ccc; border-radius:4px; min-height:52px; padding:6px 8px; font-size:9.5pt }
  .addl-title { font-size:10.5pt; font-weight:800; border-bottom:2px solid #B8860B; padding-bottom:6px; margin-bottom:8px }
  .addl-box { border:1px solid #ccc; border-radius:4px; min-height:70px; padding:8px; font-size:9.5pt; margin-bottom:18px; white-space:pre-wrap }
  .sign-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:6px }
  .sign-block h3 { font-size:9pt; font-weight:800; text-transform:uppercase; letter-spacing:0.08em; color:#888; margin-bottom:10px }
  .sign-row { display:flex; gap:8px; margin-bottom:8px; align-items:baseline }
  .sign-label { font-size:9pt; color:#888; min-width:80px; flex-shrink:0 }
  .sign-line { flex:1; border-bottom:1px solid #ccc; min-height:18px }
  .sign-box { border:1px solid #ccc; border-radius:4px; height:52px; margin-top:4px }
  .statement { font-size:9pt; color:#555; line-height:1.6; margin-bottom:10px }
  @media print { html,body { width:210mm } }
</style>
</head>
<body>
<h1>Vehicle Inspection</h1>

<div class="info-section">
  <h2>Vehicle Information</h2>
  <div class="info-grid">
    <div class="info-row"><span class="info-label">License Plate</span><span class="info-val">${insp.plate || ''}</span></div>
    <div class="info-row"><span class="info-label">Make</span><span class="info-val">${insp.make || ''}</span></div>
    <div class="info-row"><span class="info-label">Model</span><span class="info-val">${insp.model || ''}</span></div>
    <div class="info-row"><span class="info-label">Year</span><span class="info-val">${insp.year || ''}</span></div>
    <div class="info-row"><span class="info-label">Date of Inspection</span><span class="info-val">${fmt(insp.inspection_date)}</span></div>
    <div class="info-row"><span class="info-label">Inspector Name</span><span class="info-val">${insp.inspector_name || ''}</span></div>
  </div>
</div>

${sectionsHtml}

${insp.additional_notes ? `<div class="addl-title">Additional Notes / Observations</div><div class="addl-box">${insp.additional_notes}</div>` : ''}

<div class="sign-block" style="max-width:420px;margin-top:12px">
  <h3>Statement of Inspection</h3>
  <p class="statement">I hereby certify that I have conducted the above vehicle inspection and that the vehicle has been thoroughly inspected for safety and compliance. Any identified issues have been documented, and necessary corrective actions have been recommended.</p>
  <div class="sign-row"><span class="sign-label">Inspector's Name</span><span class="sign-line">${insp.inspector_name || ''}</span></div>
  <div class="sign-row"><span class="sign-label">Date</span><span class="sign-line">${fmt(insp.inspection_date)}</span></div>
  <div class="sign-row"><span class="sign-label">Signature</span><div class="sign-box"></div></div>
</div>

</body>
</html>`

  const w = window.open('', '_blank')
  w.document.write(html)
  w.document.close()
  w.onload = () => { w.focus(); w.print() }
}

// ── View Inspection Modal (read-only) ─────────────────────────
function ViewModal({ inspection, onClose, onEdit, onDelete }) {
  const secs = typeof inspection.sections === 'string'
    ? JSON.parse(inspection.sections)
    : (inspection.sections || {})

  const { yes, no, na } = countResults(secs)
  const total = yes + no + na

  const badge = (v, lbl, color, bg) => (
    <span style={{ padding:'3px 10px', borderRadius:20, background:bg, color, fontSize:11.5, fontWeight:700 }}>
      {lbl}: {v}
    </span>
  )

  return createPortal(
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:740, padding:0, overflow:'hidden', maxHeight:'96vh', display:'flex', flexDirection:'column' }}>

        {/* Header */}
        <div style={{ padding:'20px 24px 16px', background:'linear-gradient(135deg,#FFFBEB,#FDF6E3)', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <h3 style={{ fontWeight:900, fontSize:17, color:'var(--text)' }}>
                Vehicle Inspection — {inspection.plate}
              </h3>
              <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>
                {inspection.make} {inspection.model} {inspection.year} · {fmt(inspection.inspection_date)}
              </p>
              <div style={{ display:'flex', gap:8, marginTop:8, flexWrap:'wrap' }}>
                {badge(yes, 'Yes', '#2E7D52', '#ECFDF5')}
                {badge(no,  'No',  '#C0392B', '#FEF2F2')}
                {badge(na,  'NA',  '#A89880', '#F5F4F1')}
              </div>
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <button onClick={() => printInspection(inspection)} className="btn-secondary" style={{ padding:'7px 14px', fontSize:12, display:'flex', alignItems:'center', gap:6 }}>
                <Printer size={13}/> Print
              </button>
              <button onClick={onClose} style={{ width:32, height:32, borderRadius:'50%', background:'rgba(0,0,0,0.06)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <X size={15}/>
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex:1, overflowY:'auto', padding:'20px 24px' }}>

          {/* Inspector */}
          {inspection.inspector_name && (
            <div style={{ background:'var(--bg-alt)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 14px', marginBottom:20 }}>
              <div style={{ fontSize:10.5, color:'var(--text-muted)', marginBottom:4 }}>Inspector</div>
              <div style={{ fontWeight:700, fontSize:13, color:'var(--text)' }}>{inspection.inspector_name}</div>
            </div>
          )}

          {/* Sections (read-only) */}
          {SECTIONS.map(section => {
            const data = secs[section.key] || { items: [], observations: '' }
            return (
              <div key={section.key} style={{ marginBottom:20 }}>
                <div style={{ fontWeight:800, fontSize:12.5, color:'var(--text)', borderBottom:'2px solid var(--gold)', paddingBottom:8, marginBottom:8, letterSpacing:'0.02em' }}>
                  {section.title}
                </div>
                {section.items.map((item, idx) => {
                  const val = data.items?.[idx] || ''
                  const color = val==='yes' ? '#2E7D52' : val==='no' ? '#C0392B' : '#A89880'
                  const bg    = val==='yes' ? '#ECFDF5' : val==='no' ? '#FEF2F2' : '#F5F4F1'
                  return (
                    <div key={idx} style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'7px 0', borderBottom:'1px solid var(--border)' }}>
                      <span style={{ flex:1, fontSize:12, color:'var(--text)', lineHeight:1.4 }}>{item}</span>
                      {val ? (
                        <span style={{ padding:'2px 10px', borderRadius:12, background:bg, color, fontSize:11, fontWeight:700, flexShrink:0 }}>
                          {val.toUpperCase()}
                        </span>
                      ) : (
                        <span style={{ fontSize:11, color:'var(--text-muted)', flexShrink:0 }}>—</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}

          {inspection.additional_notes && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontWeight:800, fontSize:12.5, color:'var(--text)', borderBottom:'2px solid var(--gold)', paddingBottom:8, marginBottom:8 }}>
                Additional Notes / Observations
              </div>
              <p style={{ fontSize:12.5, color:'var(--text)', lineHeight:1.6, whiteSpace:'pre-wrap' }}>
                {inspection.additional_notes}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding:'14px 24px', borderTop:'1px solid var(--border)', display:'flex', gap:10, justifyContent:'space-between', flexShrink:0 }}>
          <button onClick={() => onDelete(inspection.id)} style={{ padding:'8px 16px', borderRadius:10, background:'#FEF2F2', border:'1px solid #FECACA', color:'#C0392B', cursor:'pointer', fontSize:12.5, display:'flex', alignItems:'center', gap:6 }}>
            <Trash2 size={13}/> Delete
          </button>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={onClose} className="btn-secondary" style={{ padding:'8px 18px', fontSize:13 }}>Close</button>
            <button onClick={() => onEdit(inspection)} className="btn-primary" style={{ padding:'8px 18px', fontSize:13 }}>Edit</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Main Page ─────────────────────────────────────────────────
export default function VehicleInspectionPage() {
  const { user } = useAuth()
  const [vehicles,     setVehicles]     = useState([])
  const [inspections,  setInspections]  = useState([])
  const [loading,      setLoading]      = useState(true)
  const [showModal,    setShowModal]    = useState(false)
  const [editInsp,     setEditInsp]     = useState(null)
  const [viewInsp,     setViewInsp]     = useState(null)
  const [filterStation,setFilterStation] = useState('')
  const [filterVehicle,setFilterVehicle]= useState('')
  const [search,       setSearch]       = useState('')
  const [deleting,     setDeleting]     = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const vRes = await vehicleApi.list()
      setVehicles((vRes.vehicles || []).filter(v => v.status !== 'sold'))
    } catch(e) { console.error('vehicles:', e) }
    try {
      const iRes = await vehicleInspectionApi.list()
      setInspections(iRes.inspections || [])
    } catch(e) { console.error('inspections:', e) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const stations = [...new Set(vehicles.map(v => v.station_code).filter(Boolean))].sort()

  // Vehicles scoped to the selected station (used in modal dropdown + page filter)
  const stationVehicles = filterStation
    ? vehicles.filter(v => v.station_code === filterStation)
    : vehicles

  const filtered = inspections.filter(i => {
    if (filterStation && i.station_code !== filterStation) return false
    if (filterVehicle && i.vehicle_id !== filterVehicle) return false
    if (search) {
      const q = search.toLowerCase()
      if (
        !i.plate?.toLowerCase().includes(q) &&
        !i.inspector_name?.toLowerCase().includes(q) &&
        !i.make?.toLowerCase().includes(q) &&
        !i.model?.toLowerCase().includes(q)
      ) return false
    }
    return true
  })

  async function handleDelete(id) {
    if (!confirm('Delete this inspection? This cannot be undone.')) return
    setDeleting(id)
    try {
      await vehicleInspectionApi.delete(id)
      setViewInsp(null)
      await load()
    } catch (e) { alert(e.message) } finally { setDeleting(null) }
  }

  function openEdit(insp) {
    setViewInsp(null)
    setEditInsp(insp)
    setShowModal(true)
  }

  function openNew() {
    setEditInsp(null)
    setShowModal(true)
  }

  async function handleSave() {
    setShowModal(false)
    setEditInsp(null)
    await load()
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 style={{ fontWeight:900, fontSize:20, color:'var(--text)', letterSpacing:'-0.03em' }}>
            Vehicle Inspections
          </h1>
          <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:3 }}>
            Comprehensive vehicle safety and compliance checklists
          </p>
        </div>
        <div className="page-header-actions">
          <button onClick={openNew} className="btn-primary" style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 18px', fontSize:13 }}>
            <Plus size={15}/> New Inspection
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ position:'relative', flex:1, minWidth:200 }}>
          <Search size={13} style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }}/>
          <input
            className="input"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by plate, inspector, make…"
            style={{ paddingLeft:32, fontSize:12.5 }}
          />
        </div>
        {stations.length > 1 && (
          <select
            className="input"
            value={filterStation}
            onChange={e => { setFilterStation(e.target.value); setFilterVehicle('') }}
            style={{ minWidth:160, fontSize:12.5 }}
          >
            <option value="">All Stations</option>
            {stations.map(sc => <option key={sc} value={sc}>{sc}</option>)}
          </select>
        )}
        <select
          className="input"
          value={filterVehicle}
          onChange={e => setFilterVehicle(e.target.value)}
          style={{ minWidth:200, fontSize:12.5 }}
        >
          <option value="">All Vehicles</option>
          {stationVehicles.map(v => (
            <option key={v.id} value={v.id}>
              {v.plate}{v.make ? ` · ${v.make}` : ''}{v.model ? ` ${v.model}` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Stats row */}
      <div className="r-grid-4" style={{ gap:10 }}>
        {[
          { label:'Total Inspections', value:inspections.length, color:'var(--gold)', bg:'#FFFBEB' },
          { label:'This Month', value:inspections.filter(i => i.inspection_date?.slice(0,7) === new Date().toISOString().slice(0,7)).length, color:'#2563EB', bg:'#EFF6FF' },
          { label:'Vehicles Covered', value:new Set(inspections.map(i=>i.vehicle_id)).size, color:'#2E7D52', bg:'#ECFDF5' },
          { label:'Total Vehicles', value:vehicles.length, color:'#7C3AED', bg:'#F5F3FF' },
        ].map(s => (
          <div key={s.label} style={{ background:s.bg, border:`1px solid ${s.color}22`, borderRadius:14, padding:'14px 16px' }}>
            <div style={{ fontSize:22, fontWeight:900, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:11.5, color:'var(--text-muted)', marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Inspection cards */}
      {loading ? (
        <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, padding:48, textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>
          Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, padding:'60px 24px', display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center' }}>
          <div style={{ width:64, height:64, borderRadius:18, background:'linear-gradient(135deg,#FFFBEB,#FDF6E3)', border:'1px solid var(--gold-border)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:16 }}>
            <ClipboardCheck size={28} color="var(--gold)"/>
          </div>
          <div style={{ fontWeight:800, fontSize:17, color:'var(--text)', marginBottom:8 }}>
            {search || filterVehicle ? 'No inspections found' : 'No inspections yet'}
          </div>
          <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:20 }}>
            {search || filterVehicle ? 'Try adjusting your filters' : 'Click "New Inspection" to record your first vehicle inspection.'}
          </div>
          {!search && !filterVehicle && (
            <button onClick={openNew} className="btn-primary" style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 18px', fontSize:13 }}>
              <Plus size={14}/> New Inspection
            </button>
          )}
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {filtered.map(insp => {
            const secs = typeof insp.sections === 'string' ? JSON.parse(insp.sections) : (insp.sections || {})
            const { yes, no, na } = countResults(secs)
            const total = yes + no + na
            return (
              <div key={insp.id} style={{
                background:'var(--card)', border:`1px solid ${no > 0 ? '#FECACA' : 'var(--border)'}`,
                borderRadius:14, padding:'16px 18px',
                display:'flex', alignItems:'center', gap:16,
                transition:'box-shadow 0.15s',
              }}>
                {/* Vehicle icon */}
                <div style={{ width:46, height:46, borderRadius:13, background:'linear-gradient(135deg,#FFFBEB,#FDF6E3)', border:'1px solid var(--gold-border)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <Truck size={20} color="var(--gold)"/>
                </div>

                {/* Info */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                    <span style={{ fontWeight:800, fontSize:15, color:'var(--text)', letterSpacing:'0.04em' }}>{insp.plate}</span>
                    <span style={{ fontSize:12, color:'var(--text-muted)' }}>
                      {[insp.make, insp.model, insp.year].filter(Boolean).join(' ') || 'Vehicle'}
                    </span>
                    {no > 0 && (
                      <span style={{ padding:'2px 9px', borderRadius:10, background:'#FEF2F2', color:'#C0392B', fontSize:11, fontWeight:700 }}>
                        {no} issue{no > 1 ? 's' : ''}
                      </span>
                    )}
                    {no === 0 && total > 0 && (
                      <span style={{ padding:'2px 9px', borderRadius:10, background:'#ECFDF5', color:'#2E7D52', fontSize:11, fontWeight:700 }}>
                        Pass
                      </span>
                    )}
                  </div>
                  <div style={{ display:'flex', gap:14, marginTop:5, flexWrap:'wrap' }}>
                    <span style={{ fontSize:12, color:'var(--text-muted)', display:'flex', alignItems:'center', gap:4 }}>
                      <Calendar size={11}/> {fmt(insp.inspection_date)}
                    </span>
                    {insp.inspector_name && (
                      <span style={{ fontSize:12, color:'var(--text-muted)' }}>
                        Inspector: {insp.inspector_name}
                      </span>
                    )}
                    {total > 0 && (
                      <span style={{ fontSize:12, color:'var(--text-muted)' }}>
                        <span style={{ color:'#2E7D52', fontWeight:700 }}>{yes} ✓</span>{' '}
                        {no > 0 && <span style={{ color:'#C0392B', fontWeight:700 }}>{no} ✗ </span>}
                        {na > 0 && <span style={{ color:'#A89880' }}>{na} N/A</span>}
                      </span>
                    )}
                    {insp.station_code && (
                      <span style={{ fontSize:12, color:'var(--text-muted)' }}>{insp.station_code}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                  <button
                    onClick={() => setViewInsp(insp)}
                    style={{ padding:'7px 14px', borderRadius:9, background:'var(--bg-alt)', border:'1px solid var(--border)', cursor:'pointer', fontSize:12, color:'var(--text)', display:'flex', alignItems:'center', gap:6, fontWeight:600 }}>
                    <Eye size={13}/> View
                  </button>
                  <button
                    onClick={() => printInspection(insp)}
                    style={{ padding:'7px 14px', borderRadius:9, background:'var(--bg-alt)', border:'1px solid var(--border)', cursor:'pointer', fontSize:12, color:'var(--text)', display:'flex', alignItems:'center', gap:6, fontWeight:600 }}>
                    <Printer size={13}/> Print
                  </button>
                  <button
                    onClick={() => handleDelete(insp.id)}
                    disabled={deleting === insp.id}
                    style={{ width:34, height:34, borderRadius:9, background:'#FEF2F2', border:'1px solid #FECACA', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <Trash2 size={14} color="#C0392B"/>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modals */}
      {showModal && (
        <InspectionModal
          vehicles={stationVehicles}
          editInspection={editInsp}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditInsp(null) }}
        />
      )}
      {viewInsp && (
        <ViewModal
          inspection={viewInsp}
          onClose={() => setViewInsp(null)}
          onEdit={openEdit}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}
