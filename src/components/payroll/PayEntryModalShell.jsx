'use client'
// Shared portal/overlay/card/header for the "Add/Edit External DA Salary" family —
// JntSalaryModal, ImileSalaryModal, PackerPayModal — so switching the pay-type
// dropdown swaps only the body content instead of unmounting one full modal (own
// portal, own .modal-overlay/.modal) and mounting a different one, which replayed
// the fadeIn/fadeUp entrance animations and looked like a new popup opening. Only
// this family uses it — GenericUnitsModal (Staff/Pulser/CRET/Tradelink/IG RAK) keeps
// its own separate overlay, unrelated to this dropdown.
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export default function PayEntryModalShell({ title, month, maxWidth = 600, onClose, typeValue, onTypeChange, children }) {
  return createPortal(
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '92vh' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', background: 'linear-gradient(135deg,rgba(184,134,11,0.12),transparent)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h3 style={{ fontWeight: 900, fontSize: 16, color: 'var(--text)', margin: 0 }}>{title}</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{month}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {onTypeChange && (
              <select
                className="input" value={typeValue} title="Change pay type"
                onChange={e => onTypeChange(e.target.value)}
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
        {children}
      </div>
    </div>,
    document.body
  )
}
