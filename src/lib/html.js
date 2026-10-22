// Helpers for the few places that build raw HTML strings (printable payslips,
// letters, ledgers, inspection reports). Those strings are written into a new
// window that runs as this site, so any staff-entered text containing markup
// could otherwise execute script with the viewer's session.
import DOMPurify from 'dompurify'

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

// Plain text → safe to place in HTML text or a quoted attribute.
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ESC[c])
}

// Rich text from the letter editor → keep formatting, drop scripts, event
// handlers, iframes and javascript: links. Server-side render has no DOM, so
// fall back to escaping (letters are only previewed/printed in the browser).
export function sanitizeRich(html) {
  if (typeof window === 'undefined' || !DOMPurify.isSupported) return esc(html)
  return DOMPurify.sanitize(String(html ?? ''), {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['srcset'],
  })
}

// Image src for a stored signature: only inline images or same-site paths.
export function safeImgSrc(src, fallback = '') {
  const s = String(src ?? '')
  if (/^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(s)) return s
  if (/^(https?:)?\/\//i.test(s) || s.startsWith('/')) return esc(s)
  return esc(fallback)
}
