'use client'
import { useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

// All interactive elements that should receive focus during tab navigation
const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

const MAX_WIDTH = { sm: 380, md: 480, lg: 640, xl: 780 }

/**
 * Modal — accessible dialog with focus trap, scroll lock, and keyboard dismiss.
 *
 * Props:
 *   open       boolean — controls visibility
 *   onClose    () => void — called on Escape, backdrop click, or close button
 *   title      string — renders a simple header; omit for custom headers in children
 *   children   ReactNode — scrollable body content
 *   footer     ReactNode — action buttons; rendered in a sticky bottom bar
 *   size       'sm' | 'md' | 'lg' | 'xl'   default 'md'
 *   hideClose  boolean — hides the × button (use when you provide your own close)
 *   className  string — forwarded to the dialog element
 *
 * Usage:
 *   <Modal open={isOpen} onClose={() => setOpen(false)} title="Edit Employee"
 *     footer={<><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary">Save</Button></>}
 *   >
 *     <Input label="Name" ... />
 *   </Modal>
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size      = 'md',
  hideClose = false,
  className = '',
}) {
  const dialogRef   = useRef(null)
  const returnFocus = useRef(null)

  // Body scroll lock — prevents background content from scrolling behind overlay
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  // Save the element that triggered the dialog; restore focus on close
  useEffect(() => {
    if (open) {
      returnFocus.current = document.activeElement
      requestAnimationFrame(() => {
        dialogRef.current?.querySelector(FOCUSABLE)?.focus()
      })
    } else {
      returnFocus.current?.focus()
    }
  }, [open])

  // Tab trap + Escape dismiss — handled on the dialog div so it's naturally scoped
  const onKeyDown = useCallback((e) => {
    if (e.key === 'Escape') { onClose?.(); return }
    if (e.key !== 'Tab') return
    const els   = [...(dialogRef.current?.querySelectorAll(FOCUSABLE) ?? [])]
    if (!els.length) return
    const first = els[0], last = els[els.length - 1]
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus() }
    } else {
      if (document.activeElement === last)  { e.preventDefault(); first.focus() }
    }
  }, [onClose])

  if (!open) return null

  const hasHeader = title || !hideClose

  return createPortal(
    <div
      className="modal-overlay"
      role="presentation"
      onClick={e => { if (e.target === e.currentTarget) onClose?.() }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        className={`modal ${className}`}
        style={{
          maxWidth: MAX_WIDTH[size] ?? 480,
          display: 'flex', flexDirection: 'column', maxHeight: '90vh',
        }}
        onKeyDown={onKeyDown}
      >
        {hasHeader && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 18, flexShrink: 0,
          }}>
            {title && (
              <h2
                id="modal-title"
                style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}
              >
                {title}
              </h2>
            )}
            {!hideClose && (
              <button
                onClick={onClose}
                className="btn-close"
                aria-label="Close"
                style={{ marginLeft: 'auto', flexShrink: 0 }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Scrollable body — grows to fill available space */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {children}
        </div>

        {footer && (
          <div style={{
            display: 'flex', justifyContent: 'flex-end', gap: 8,
            marginTop: 20, paddingTop: 16,
            borderTop: '1px solid var(--border)', flexShrink: 0,
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
