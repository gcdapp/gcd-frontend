'use client'
// ConfirmDialog — replaces window.confirm() across the app.
//
// Why: window.confirm() breaks visual consistency (browser-styled, no branding),
// is inaccessible to screen readers, and can't be styled for severity level.
// This component matches the app's design system and supports Escape-to-dismiss,
// backdrop click, and severity-aware colors (danger = red, warning = amber).
//
// Usage:
//   const [pending, setPending] = useState(null)
//   <ConfirmDialog {...pending} onCancel={() => setPending(null)} />
//
//   setPending({
//     title: 'Delete SIM card?',
//     message: 'This cannot be undone.',
//     confirmLabel: 'Delete',
//     danger: true,
//     onConfirm: () => handleDelete(id),
//   })

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle } from 'lucide-react'

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel  = 'Cancel',
  danger       = true,
  onConfirm,
  onCancel,
}) {
  // Escape key dismisses
  useEffect(() => {
    if (!open) return
    function handle(e) { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [open, onCancel])

  if (!open) return null

  const accentColor = danger ? 'var(--red)'   : 'var(--amber)'
  const accentBg    = danger ? 'var(--red-bg)' : 'var(--amber-bg)'

  return createPortal(
    <div
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div style={{
        background: 'var(--card)', borderRadius: 16, padding: '22px 22px 20px',
        maxWidth: 380, width: '100%',
        boxShadow: '0 12px 48px rgba(0,0,0,0.18)', border: '1px solid var(--border)',
        animation: 'fadeUp 0.2s cubic-bezier(0.16,1,0.3,1)',
      }}>
        {/* Icon + text */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13, marginBottom: 20 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            background: accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AlertTriangle size={18} color={accentColor} />
          </div>
          <div style={{ paddingTop: 2 }}>
            <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--text)', lineHeight: 1.3 }}>
              {title}
            </div>
            {message && (
              <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 5, lineHeight: 1.55 }}>
                {message}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            className="btn btn-secondary"
            style={{ borderRadius: 10, fontSize: 13 }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '9px 18px', borderRadius: 10, border: 'none',
              fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              background: accentColor, color: 'white',
              transition: 'opacity 0.15s',
            }}
            onMouseOver={e => e.currentTarget.style.opacity = '0.88'}
            onMouseOut={e => e.currentTarget.style.opacity = '1'}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
