'use client'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/lib/auth'
import { API } from '@/lib/api'
import { esc, sanitizeRich, safeImgSrc } from '@/lib/html'
import { ScrollText, Plus, ChevronLeft, User, Trash2, Pencil, CheckCircle, Clock, Send, Download, Calendar, Eye, FileText, Bold, Italic, Underline, List, ListOrdered, Table2, Undo2, Redo2 } from 'lucide-react'

const hdr = () => ({ Authorization: `Bearer ${localStorage.getItem('gcd_token')}` })
const TODAY = () => new Date().toISOString().split('T')[0]

function fmtDate(d) {
  if (!d) return ''
  const s = typeof d === 'string' ? d.split('T')[0] : d
  return new Date(s + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}
function fmtShort(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' })
}
function buildBodyHtml(body) {
  if (!body) return ''
  if (/<[a-z]/i.test(body)) {
    return `<div style="font-family:Georgia,serif;font-size:13.5px;line-height:1.75;color:#1a1a1a">${sanitizeRich(body)}</div>`
  }
  return body.split('\n').map(
    line => `<p style="margin:0 0 11px 0;line-height:1.75;text-align:justify">${line.trim() ? esc(line) : '&nbsp;'}</p>`
  ).join('')
}
function isBodyEmpty(html) {
  if (!html) return true
  return !html.replace(/<[^>]*>/g, '').replace(/\xa0/g, ' ').replace(/&nbsp;/g, ' ').trim()
}
function getVerifyUrl(l, origin) {
  if (!l?.id) return ''
  return `${origin || ''}/verify/letter/${encodeURIComponent(l.id)}`
}
function getQrUrl(value, size = 96) {
  if (!value) return ''
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=1&data=${encodeURIComponent(value)}`
}
function buildVerificationBlock(l, origin, size = 96) {
  if (l.show_qr === false) return ''
  const verifyUrl = getVerifyUrl(l, origin)
  if (!verifyUrl) return ''
  const qrUrl = getQrUrl(verifyUrl, size)
  return `
    <div style="position:absolute;right:40px;bottom:104px;width:116px;text-align:center;font-family:Arial,sans-serif;color:#444;z-index:3">
      <img src="${qrUrl}" style="width:${size}px;height:${size}px;display:block;margin:0 auto 5px;background:#fff;padding:4px;border:1px solid #ddd" alt="Document verification QR"/>
      <div style="font-size:8px;letter-spacing:0.8px;text-transform:uppercase;font-weight:700;color:#8F6807;margin-bottom:2px">Verify Document</div>
    </div>`
}

function buildLetterHTML(l, origin) {
  const bodyHtml   = buildBodyHtml(l.body)
  const showSign   = l.show_sign  !== false
  const showStamp  = l.show_stamp !== false
  const verifyBlock = buildVerificationBlock(l, origin, 82)
  return `<div style="width:794px;min-height:1123px;background:#fff;font-family:Georgia,serif;font-size:13.5px;color:#1a1a1a;position:relative;padding-bottom:130px;box-sizing:border-box;overflow:hidden">
  <div style="position:absolute;top:-30%;left:-30%;width:160%;height:160%;pointer-events:none;z-index:0;
    background-image:url('${origin}/watermark.png');background-repeat:repeat;background-size:90px auto;
    transform:rotate(-18deg);opacity:0.045"></div>
  <div style="position:relative;z-index:1">
  <div style="padding:28px 40px 16px;display:flex;align-items:center;gap:18px;border-bottom:2.5px solid #8F6807">
    <img src="${origin}/logo.webp" style="height:58px;object-fit:contain" alt="" onerror="this.style.display='none'"/>
    <div style="font-size:26px;font-weight:700;font-family:Georgia,serif;font-style:italic;letter-spacing:0.2px">
      <span style="color:#8F6807">Golden Crescent</span> Delivery Services LLC
    </div>
  </div>
  <div style="padding:28px 40px 0">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;font-size:11.5px;font-family:Arial,sans-serif;color:#555">
      <span style="font-weight:700;color:#333">Ref: ${esc(l.ref_no || '—')}</span>
      <span>${fmtDate(l.date)}</span>
    </div>
    <p style="margin:0 0 14px;font-weight:700;font-size:13.5px">${(l.to_name || 'To Whom It May Concern').replace(/\n/g, '<br/>')}</p>
    ${l.subject ? `<div style="margin-bottom:18px"><p style="margin:0 0 6px;font-size:16px;font-weight:700">Re: ${esc(l.subject)}</p><div style="height:2px;width:240px;background:#8F6807;border-radius:1px"></div></div>` : ''}
    <p style="margin:0 0 16px">${esc(l.greeting || 'Dear Sir / Madam,')}</p>
    <div style="margin-bottom:44px">${bodyHtml}</div>
    <p style="margin:0 0 26px">With warm regards,</p>
    <div style="position:relative;min-height:140px;margin-bottom:6px;width:100%">
      <div style="display:inline-block">
        ${showSign ? `<img src="${safeImgSrc(l.signature_data, origin + '/sign.png') || esc(origin + '/sign.png')}" style="height:78px;display:block;margin-bottom:2px;mix-blend-mode:${l.signature_data ? 'multiply' : 'screen'}" alt="" onerror="this.style.display='none'"/>` : '<div style="height:80px"></div>'}
        <p style="margin:0 0 1px;font-size:15.5px;font-weight:700">${esc(l.signer_name || 'Vardeep Singh Sodhi')}</p>
        <p style="margin:0 0 1px;font-size:12px;color:#555;font-family:Arial,sans-serif">${esc(l.signer_title || 'Director')}</p>
        <p style="margin:0;font-size:11.5px;color:#777;font-family:Arial,sans-serif">Golden Crescent Delivery Services LLC</p>
      </div>
      ${showStamp ? `<img src="${origin}/stamp.png" style="position:absolute;right:0;top:0;height:118px;mix-blend-mode:multiply" alt="" onerror="this.style.display='none'"/>` : ''}
    </div>
  </div>
  </div>
  ${verifyBlock}
  <div style="position:absolute;bottom:0;left:0;right:0;width:100%;padding:16px 40px;background:#f0ede6;border-top:2px solid #8F6807;display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;box-sizing:border-box">
    <div>
      <div style="font-size:8px;letter-spacing:2.5px;font-weight:700;color:#8F6807;font-family:Arial,sans-serif;text-transform:uppercase;margin-bottom:5px">ADDRESS</div>
      <div style="font-size:10.5px;color:#444;line-height:1.55;font-family:Arial,sans-serif">Office 68, 18th Floor<br>Burjuman Business Tower, Dubai</div>
    </div>
    <div>
      <div style="font-size:8px;letter-spacing:2.5px;font-weight:700;color:#8F6807;font-family:Arial,sans-serif;text-transform:uppercase;margin-bottom:5px">CONTACT</div>
      <div style="font-size:10.5px;color:#444;line-height:1.55;font-family:Arial,sans-serif">Landline · 042 59 291<br>Mobile · +971 52 220 1435</div>
    </div>
    <div>
      <div style="font-size:8px;letter-spacing:2.5px;font-weight:700;color:#B8860B;font-family:Arial,sans-serif;text-transform:uppercase;margin-bottom:5px">ONLINE</div>
      <div style="font-size:10.5px;color:#444;line-height:1.55;font-family:Arial,sans-serif">vardeep@crescentdelivery.com<br>goldencrescent.ae</div>
    </div>
  </div>
</div>`
}

function buildPrintHTML(l, origin) {
  const bodyHtml  = buildBodyHtml(l.body)
  const showSign  = l.show_sign  !== false
  const showStamp = l.show_stamp !== false
  const verifyUrl = l.show_qr !== false ? getVerifyUrl(l, origin) : ''
  const printQr = verifyUrl ? `
    <div style="display:flex;justify-content:flex-end;margin-top:28px">
      <div style="text-align:center;font-family:Arial,sans-serif">
        <img src="${getQrUrl(verifyUrl, 92)}" style="width:92px;height:92px;display:block;margin:0 auto 5px;background:#fff;padding:4px;border:1px solid #ddd" alt="QR"/>
        <div style="font-size:8px;letter-spacing:0.8px;text-transform:uppercase;font-weight:700;color:#B8860B">Verify Document</div>
      </div>
    </div>` : ''

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${esc(l.ref_no)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  @page{size:A4 portrait;margin:0}
  html,body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;
    font-family:Georgia,serif;font-size:13.5px;color:#1a1a1a}
  .wm{position:fixed;top:-30%;left:-30%;width:160%;height:160%;
    background-image:url('${origin}/watermark.png');
    background-repeat:repeat;background-size:90px auto;
    transform:rotate(-18deg);opacity:0.045;pointer-events:none;z-index:0}
  table.lt{width:794px;border-collapse:collapse;table-layout:fixed}
  table.lt thead td{padding:0;background:#fff}
  table.lt tfoot td{padding:0}
  table.lt tbody td{padding:28px 40px 24px;vertical-align:top;position:relative;z-index:1}
</style>
</head>
<body>
<div class="wm"></div>
<table class="lt">
  <thead>
    <tr><td>
      <div style="padding:28px 40px 16px;display:flex;align-items:center;gap:18px;border-bottom:2.5px solid #B8860B;background:#fff">
        <img src="${origin}/logo.webp" style="height:58px;object-fit:contain" alt="" onerror="this.style.display='none'"/>
        <div style="font-size:26px;font-weight:700;font-family:Georgia,serif;font-style:italic;letter-spacing:0.2px">
          <span style="color:#B8860B">Golden Crescent</span> Delivery Services LLC
        </div>
      </div>
    </td></tr>
  </thead>
  <tfoot>
    <tr><td>
      <div style="padding:16px 40px;background:#f0ede6;border-top:2px solid #B8860B;display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px">
        <div>
          <div style="font-size:8px;letter-spacing:2.5px;font-weight:700;color:#B8860B;font-family:Arial,sans-serif;text-transform:uppercase;margin-bottom:5px">ADDRESS</div>
          <div style="font-size:10.5px;color:#444;line-height:1.55;font-family:Arial,sans-serif">Office 68, 18th Floor<br>Burjuman Business Tower, Dubai</div>
        </div>
        <div>
          <div style="font-size:8px;letter-spacing:2.5px;font-weight:700;color:#B8860B;font-family:Arial,sans-serif;text-transform:uppercase;margin-bottom:5px">CONTACT</div>
          <div style="font-size:10.5px;color:#444;line-height:1.55;font-family:Arial,sans-serif">Landline · 042 59 291<br>Mobile · +971 52 220 1435</div>
        </div>
        <div>
          <div style="font-size:8px;letter-spacing:2.5px;font-weight:700;color:#B8860B;font-family:Arial,sans-serif;text-transform:uppercase;margin-bottom:5px">ONLINE</div>
          <div style="font-size:10.5px;color:#444;line-height:1.55;font-family:Arial,sans-serif">vardeep@crescentdelivery.com<br>goldencrescent.ae</div>
        </div>
      </div>
    </td></tr>
  </tfoot>
  <tbody>
    <tr><td>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;font-size:11.5px;font-family:Arial,sans-serif;color:#555">
        <span style="font-weight:700;color:#333">Ref: ${esc(l.ref_no || '—')}</span>
        <span>${fmtDate(l.date)}</span>
      </div>
      <p style="margin:0 0 14px;font-weight:700;font-size:13.5px">${(l.to_name || 'To Whom It May Concern').replace(/\n/g, '<br/>')}</p>
      ${l.subject ? `<div style="margin-bottom:18px"><p style="margin:0 0 6px;font-size:16px;font-weight:700">Re: ${esc(l.subject)}</p><div style="height:2px;width:240px;background:#B8860B;border-radius:1px"></div></div>` : ''}
      <p style="margin:0 0 16px">${esc(l.greeting || 'Dear Sir / Madam,')}</p>
      <div style="margin-bottom:44px">${bodyHtml}</div>
      <p style="margin:0 0 26px">With warm regards,</p>
      <div style="position:relative;min-height:140px;margin-bottom:6px;width:100%">
        <div style="display:inline-block">
          ${showSign ? `<img src="${safeImgSrc(l.signature_data, origin + '/sign.png') || esc(origin + '/sign.png')}" style="height:78px;display:block;margin-bottom:2px;mix-blend-mode:${l.signature_data ? 'multiply' : 'screen'}" alt="" onerror="this.style.display='none'"/>` : '<div style="height:80px"></div>'}
          <p style="margin:0 0 1px;font-size:15.5px;font-weight:700">${esc(l.signer_name || 'Vardeep Singh Sodhi')}</p>
          <p style="margin:0 0 1px;font-size:12px;color:#555;font-family:Arial,sans-serif">${esc(l.signer_title || 'Director')}</p>
          <p style="margin:0;font-size:11.5px;color:#777;font-family:Arial,sans-serif">Golden Crescent Delivery Services LLC</p>
        </div>
        ${showStamp ? `<img src="${origin}/stamp.png" style="position:absolute;right:0;top:0;height:118px;mix-blend-mode:multiply" alt="" onerror="this.style.display='none'"/>` : ''}
      </div>
      ${printQr}
    </td></tr>
  </tbody>
</table>
<script>
window.onload=function(){
  var imgs=document.images,n=imgs.length,d=0
  if(!n){window.print();return}
  for(var i=0;i<n;i++){
    imgs[i].onload=imgs[i].onerror=function(){if(++d===n)window.print()}
  }
  setTimeout(function(){window.print()},1800)
}
</script>
</body>
</html>`
}

function openPrint(letter) {
  const origin = window.location.origin
  const w = window.open('', '_blank')
  w.document.write(buildPrintHTML(letter, origin))
  w.document.close()
}

const inputStyle = {
  width:'100%', padding:'8px 11px', borderRadius:8,
  border:'1px solid var(--border)', background:'var(--card)', color:'var(--text)',
  fontSize:12.5, fontFamily:'inherit', boxSizing:'border-box', outline:'none',
}
const labelStyle = {
  fontSize:10.5, fontWeight:700, color:'var(--text-muted)',
  textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:5,
}

function Toggle({ checked, onChange, label }) {
  return (
    <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', userSelect:'none' }}>
      <div style={{ position:'relative', width:36, height:20, flexShrink:0 }}>
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
          style={{ opacity:0, width:0, height:0, position:'absolute' }}/>
        <div style={{ position:'absolute', inset:0, borderRadius:20, background: checked ? '#8F6807' : '#CBD5E1', transition:'background 0.2s' }}/>
        <div style={{ position:'absolute', top:2, left: checked ? 18 : 2, width:16, height:16, borderRadius:'50%', background:'white', boxShadow:'0 1px 3px rgba(0,0,0,0.2)', transition:'left 0.2s' }}/>
      </div>
      <span style={{ fontSize:12, fontWeight:600, color:'var(--text)' }}>{label}</span>
    </label>
  )
}

function cleanPastedHtml(html) {
  try {
    const tmp = document.createElement('div')
    tmp.innerHTML = sanitizeRich(html)
    // Remove HTML comments (Word puts a ton of them)
    const walker = document.createTreeWalker(tmp, NodeFilter.SHOW_COMMENT)
    const comments = []
    while (walker.nextNode()) comments.push(walker.currentNode)
    comments.forEach(c => c.parentNode?.removeChild(c))
    // Strip mso-* style properties but keep element structure
    tmp.querySelectorAll('[style]').forEach(el => {
      const kept = el.getAttribute('style').split(';').filter(s => !s.trim().toLowerCase().startsWith('mso-') && s.trim()).join(';')
      if (kept) el.setAttribute('style', kept)
      else el.removeAttribute('style')
    })
    // Remove MsoNormal and other Word classes
    tmp.querySelectorAll('[class]').forEach(el => {
      if (/mso/i.test(el.getAttribute('class'))) el.removeAttribute('class')
    })
    // Unwrap <font> elements
    tmp.querySelectorAll('font').forEach(el => {
      const span = document.createElement('span')
      span.innerHTML = el.innerHTML
      el.parentNode?.replaceChild(span, el)
    })
    return tmp.innerHTML
  } catch { return sanitizeRich(html) }
}

function RichEditor({ defaultValue, onChange, placeholder = 'Write your letter content here…' }) {
  const editorRef = useRef(null)

  useEffect(() => {
    // Saved letters can be written by other staff — sanitise before loading into the editor
    if (editorRef.current) editorRef.current.innerHTML = sanitizeRich(defaultValue || '')
  }, []) // Only on mount — parent uses key prop to trigger remount on letter change

  function exec(cmd, val) {
    editorRef.current?.focus()
    document.execCommand(cmd, false, val ?? null)
    onChange?.(editorRef.current.innerHTML)
  }

  function insertTable(rows, cols) {
    const cell = `<td style="border:1px solid #ccc;padding:6px 10px;min-width:70px">&nbsp;</td>`
    const row  = `<tr>${cell.repeat(cols)}</tr>`
    exec('insertHTML', `<table style="border-collapse:collapse;width:100%;margin:8px 0"><tbody>${row.repeat(rows)}</tbody></table><p><br></p>`)
  }

  function handlePaste(e) {
    e.preventDefault()
    const html = e.clipboardData.getData('text/html')
    const text = e.clipboardData.getData('text/plain')
    if (html) {
      document.execCommand('insertHTML', false, cleanPastedHtml(html))
    } else {
      document.execCommand('insertText', false, text)
    }
    onChange?.(editorRef.current.innerHTML)
  }

  const Btn = ({ title, children, cmd, val, onClick }) => (
    <button
      className="rte-btn"
      title={title}
      onMouseDown={e => { e.preventDefault(); onClick ? onClick() : exec(cmd, val) }}
    >
      {children}
    </button>
  )
  const Sep = () => <div className="rte-sep"/>

  return (
    <div className="rte-wrap">
      <div className="rte-toolbar">
        <Btn title="Bold (Ctrl+B)"       cmd="bold">      <Bold      size={13}/></Btn>
        <Btn title="Italic (Ctrl+I)"     cmd="italic">    <Italic    size={13}/></Btn>
        <Btn title="Underline (Ctrl+U)"  cmd="underline"> <Underline size={13}/></Btn>
        <Sep/>
        <Btn title="Bullet list"         cmd="insertUnorderedList"><List        size={13}/></Btn>
        <Btn title="Numbered list"       cmd="insertOrderedList">  <ListOrdered size={13}/></Btn>
        <Sep/>
        <Btn title="Insert 2×2 table"    onClick={() => insertTable(2,2)}><Table2 size={13}/></Btn>
        <Btn title="Insert 3×3 table"    onClick={() => insertTable(3,3)}>
          <span style={{ fontFamily:'monospace', fontSize:10, lineHeight:1 }}>3×3</span>
        </Btn>
        <Sep/>
        <Btn title="Undo (Ctrl+Z)"  cmd="undo"><Undo2 size={13}/></Btn>
        <Btn title="Redo (Ctrl+Y)"  cmd="redo"><Redo2 size={13}/></Btn>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className="rte-editor"
        data-placeholder={placeholder}
        onInput={() => onChange?.(editorRef.current.innerHTML)}
        onPaste={handlePaste}
      />
    </div>
  )
}

const PAGE_CSS = `
  /* ── Hero ── */
  .ltr-hero {
    background: var(--hero-bg);
    border-radius: 16px;
    padding: 24px;
    margin-bottom: 20px;
  }
  .ltr-hero-top {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 20px;
    flex-wrap: wrap;
  }
  .ltr-hero-icon {
    width: 44px; height: 44px;
    border-radius: 12px;
    background: rgba(184,134,11,0.15);
    border: 1px solid rgba(184,134,11,0.3);
    display: flex; align-items: center; justify-content: center;
    color: #8F6807;
    flex-shrink: 0;
  }
  .ltr-hero-title { font-size: 20px; font-weight: 800; color: white; margin: 0; }
  .ltr-hero-sub { font-size: 12px; color: rgba(255,255,255,0.5); margin: 3px 0 0; }
  .ltr-new-btn {
    margin-left: auto;
    display: flex; align-items: center; gap: 7px;
    padding: 10px 20px; border-radius: 10px;
    border: none; background: #8F6807; color: white;
    font-weight: 700; font-size: 13px; cursor: pointer;
    font-family: inherit; white-space: nowrap;
    transition: background 0.15s;
  }
  .ltr-new-btn:hover { background: #9a7209; }

  /* ── KPI tiles ── */
  .ltr-kpi-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }
  .ltr-kpi {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px;
    padding: 14px 16px;
  }
  .ltr-kpi-val {
    font-size: 28px; font-weight: 800; line-height: 1.1;
  }
  .ltr-kpi-label {
    font-size: 10px; color: rgba(255,255,255,0.45);
    font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.06em; margin-top: 4px;
  }

  /* ── Cards ── */
  .ltr-cards { display: flex; flex-direction: column; gap: 12px; }
  .ltr-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
    display: flex;
    transition: box-shadow 0.15s, transform 0.15s;
  }
  .ltr-card:hover { box-shadow: 0 4px 24px rgba(0,0,0,0.09); transform: translateY(-1px); }
  .ltr-card-pending { border-color: #FDE68A88; }
  .ltr-card-accent { width: 4px; flex-shrink: 0; }
  .ltr-card-body { flex: 1; padding: 14px 16px; min-width: 0; }
  .ltr-card-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 8px;
  }
  .ltr-card-info { min-width: 0; }
  .ltr-ref {
    font-size: 12px; font-weight: 800; color: #8F6807;
    font-family: monospace; letter-spacing: 0.03em;
  }
  .ltr-subject {
    font-size: 14px; font-weight: 600; color: var(--text);
    margin-top: 3px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    max-width: 460px;
  }
  .ltr-subject-empty { color: var(--text-muted); font-style: italic; font-weight: 400; }
  .ltr-card-meta {
    display: flex; flex-wrap: wrap; gap: 6px 16px;
    font-size: 11.5px; color: var(--text-muted);
    align-items: center; margin-bottom: 12px;
  }
  .ltr-meta-item { display: flex; align-items: center; gap: 4px; }
  .ltr-card-actions { display: flex; flex-wrap: wrap; gap: 6px; }

  /* ── Buttons ── */
  .ltr-btn {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 6px 12px; border-radius: 8px;
    font-size: 11.5px; font-weight: 600; cursor: pointer;
    font-family: inherit; white-space: nowrap;
    transition: opacity 0.15s, transform 0.1s;
    border: 1px solid transparent;
  }
  .ltr-btn:hover { opacity: 0.85; transform: translateY(-1px); }
  .ltr-btn:active { transform: translateY(0); }
  .ltr-btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }
  .ltr-btn-approve { border-color: #FDE68A; background: #FFFBEB; color: #92400E; }
  .ltr-btn-dl      { border-color: #8F6807; background: #FEF9EE; color: #92400E; }
  .ltr-btn-edit    { border-color: #93C5FD; background: #EFF6FF; color: #2563EB; }
  .ltr-btn-del     { border-color: #FCA5A5; background: #FEF2F2; color: #EF4444; padding: 6px 10px; }

  /* ── Badges ── */
  .ltr-badge {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 10.5px; font-weight: 700;
    padding: 3px 10px; border-radius: 20px;
    white-space: nowrap; flex-shrink: 0;
  }
  .ltr-badge-pending  { background: #FFFBEB; border: 1px solid #FDE68A; color: #92400E; }
  .ltr-badge-approved { background: #ECFDF5; border: 1px solid #A7F3D0; color: #065F46; }

  /* ── Skeleton ── */
  @keyframes ltr-pulse { 0%,100%{opacity:.45} 50%{opacity:.85} }
  .ltr-skel { animation: ltr-pulse 1.5s ease infinite; background: var(--card); border-radius: 12px; }

  /* ── Compose ── */
  .cmp-wrap { display: flex; flex-direction: column; height: calc(100vh - 100px); }
  .cmp-toolbar {
    display: flex; align-items: center; gap: 10px;
    padding-bottom: 14px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0; flex-wrap: wrap;
  }
  .cmp-back-btn {
    display: flex; align-items: center; gap: 5px;
    padding: 7px 12px; border-radius: 8px;
    border: 1px solid var(--border); background: var(--card); color: var(--text);
    font-size: 12px; cursor: pointer; font-family: inherit;
  }
  .cmp-title { font-size: 14px; font-weight: 700; color: var(--text); }
  .cmp-approval-badge {
    font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 20px;
    background: #FFFBEB; border: 1px solid #FDE68A; color: #92400E;
  }
  .cmp-dl-btn {
    display: flex; align-items: center; gap: 7px;
    padding: 8px 16px; border-radius: 9px;
    border: 1px solid #8F6807; background: white; color: #8F6807;
    font-weight: 700; font-size: 13px; cursor: pointer; font-family: inherit;
  }
  .cmp-save-btn {
    display: flex; align-items: center; gap: 7px;
    padding: 8px 20px; border-radius: 9px;
    border: none; color: white;
    font-weight: 700; font-size: 13px; cursor: pointer; font-family: inherit;
  }
  .cmp-preview-btn {
    display: none; align-items: center; gap: 5px;
    padding: 7px 13px; border-radius: 8px;
    border: 1px solid var(--border); background: var(--card); color: var(--text);
    font-size: 12px; cursor: pointer; font-family: inherit; font-weight: 600;
  }
  .cmp-body {
    display: grid; grid-template-columns: 320px 1fr;
    gap: 20px; flex: 1; overflow: hidden; padding-top: 16px;
  }
  .cmp-form-panel {
    overflow-y: auto; display: flex; flex-direction: column; gap: 13px; padding-right: 4px;
  }
  .cmp-preview-panel {
    overflow-y: auto; background: #d8d8d8; border-radius: 10px;
    padding: 20px; display: flex; justify-content: center; align-items: flex-start;
  }

  /* ── Responsive ── */
  @media (max-width: 768px) {
    .ltr-hero { padding: 16px; border-radius: 12px; }
    .ltr-kpi-val { font-size: 22px; }
    .ltr-kpi { padding: 10px 14px; }
    .ltr-card-top { flex-direction: column; gap: 8px; }
    .ltr-subject { max-width: 100%; }

    .cmp-preview-btn { display: flex; }
    .cmp-body { grid-template-columns: 1fr; }
    .cmp-preview-panel { display: none; }
    .cmp-preview-panel.cmp-show { display: flex; }
    .cmp-form-panel.cmp-hide { display: none; }
    .cmp-save-btn { font-size: 12px; padding: 8px 14px; }
    .cmp-dl-btn   { font-size: 12px; padding: 8px 12px; }
  }

  /* ── Rich Text Editor ── */
  .rte-wrap { border: 1px solid var(--border); border-radius: 8px; overflow: hidden; background: var(--card); }
  .rte-toolbar {
    display: flex; align-items: center; gap: 1px; flex-wrap: wrap;
    padding: 5px 7px; border-bottom: 1px solid var(--border); background: var(--bg-alt);
  }
  .rte-btn {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 27px; height: 26px; padding: 0 4px; border-radius: 5px;
    border: 1px solid transparent; background: transparent; color: var(--text);
    cursor: pointer; font-family: Georgia, serif; font-size: 13px; font-weight: 700;
    transition: background 0.1s, border-color 0.1s;
  }
  .rte-btn:hover { background: var(--border); }
  .rte-sep { width: 1px; height: 18px; background: var(--border); margin: 0 3px; flex-shrink: 0; }
  .rte-editor {
    min-height: 230px; max-height: 420px; overflow-y: auto;
    padding: 10px 12px; outline: none;
    font-family: Georgia, serif; font-size: 13px; line-height: 1.75; color: var(--text);
  }
  .rte-editor:empty::before { content: attr(data-placeholder); color: var(--text-muted); opacity: 0.5; pointer-events: none; }
  .rte-editor p { margin: 0 0 10px; }
  .rte-editor ul, .rte-editor ol { padding-left: 22px; margin: 0 0 10px; }
  .rte-editor table { border-collapse: collapse; width: 100%; margin: 8px 0; }
  .rte-editor td, .rte-editor th { border: 1px solid #ccc; padding: 6px 10px; min-width: 60px; vertical-align: top; }

  @media (max-width: 520px) {
    .ltr-kpi-grid { grid-template-columns: 1fr 1fr; gap: 8px; }
    .ltr-kpi:last-child { grid-column: span 2; }
    .ltr-new-btn { padding: 8px 14px; font-size: 12px; }
    .ltr-btn { padding: 5px 10px; font-size: 11px; }
    .cmp-approval-badge { display: none; }
    .ltr-card-body { padding: 12px 14px; }
  }
`

export default function LettersPage() {
  const { user } = useAuth()
  const isAdmin  = user?.role === 'admin'

  const [view,         setView]         = useState('list')
  const [letters,      setLetters]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [editingId,    setEditingId]    = useState(null)
  const [submitted,    setSubmitted]    = useState(false)
  const [showPreview,  setShowPreview]  = useState(false)
  const [downloading,  setDownloading]  = useState(false)
  const [composerKey,  setComposerKey]  = useState(0)

  const [date,          setDate]          = useState(TODAY())
  const [toName,        setToName]        = useState('')
  const [subject,       setSubject]       = useState('')
  const [greeting,      setGreeting]      = useState('Dear Sir / Madam,')
  const [body,          setBody]          = useState('')
  const [showSign,      setShowSign]      = useState(true)
  const [showStamp,     setShowStamp]     = useState(true)
  const [showQr,        setShowQr]        = useState(true)
  const [signerName,    setSignerName]    = useState('')
  const [signerTitle,   setSignerTitle]   = useState('')
  const [signatureData, setSignatureData] = useState(null)

  const editingLetter = editingId ? letters.find(l => l.id === editingId) : null
  const draft = {
    date, to_name: toName, subject, greeting, body,
    ref_no: editingLetter?.ref_no || 'GCD/LTR/PREVIEW',
    id: editingLetter?.id || null,
    show_sign: showSign, show_stamp: showStamp, show_qr: showQr,
    signer_name: signerName, signer_title: signerTitle, signature_data: signatureData,
  }
  const SCALE = 0.61

  useEffect(() => {
    fetch(`${API}/api/letters`, { headers: hdr() })
      .then(r => r.json()).then(d => setLetters(d.letters || []))
      .catch(() => {}).finally(() => setLoading(false))
  }, [])

  function resetForm() {
    setDate(TODAY()); setToName(''); setSubject('')
    setGreeting('Dear Sir / Madam,'); setBody('')
    setShowSign(true); setShowStamp(true); setShowQr(true)
    setSignerName(''); setSignerTitle(''); setSignatureData(null)
    setEditingId(null); setSubmitted(false); setShowPreview(false)
    setComposerKey(k => k + 1)
  }

  function handleSignatureUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const maxW = 500, maxH = 200
        let w = img.width, h = img.height
        if (w > maxW) { h = Math.round(h * maxW / w); w = maxW }
        if (h > maxH) { w = Math.round(w * maxH / h); h = maxH }
        canvas.width = w; canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        setSignatureData(canvas.toDataURL('image/png'))
      }
      img.src = ev.target.result
    }
    reader.readAsDataURL(file)
  }

  async function downloadPDF(letter) {
    setDownloading(true)
    try {
      const origin = window.location.origin
      const html   = buildLetterHTML(letter, origin)
      const container = document.createElement('div')
      container.style.cssText = 'position:fixed;top:0;left:-9999px;width:794px;background:white;z-index:-1;'
      container.innerHTML = html
      document.body.appendChild(container)
      await new Promise(r => setTimeout(r, 1200))
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'), import('html2canvas')
      ])
      const canvas = await html2canvas(container, {
        scale: 2, useCORS: true, logging: false,
        width: 794, height: 1123, windowWidth: 794,
      })
      document.body.removeChild(container)
      const imgData = canvas.toDataURL('image/jpeg', 0.92)
      const doc = new jsPDF({
        orientation: 'portrait', unit: 'px', format: [794, 1123],
        compress: true,
        encryption: {
          userPassword: '',
          ownerPassword: 'Khan@55884+',
          userPermissions: ['print'],
        },
      })
      doc.addImage(imgData, 'JPEG', 0, 0, 794, 1123)
      doc.save(`${letter.ref_no || 'letter'}.pdf`)
    } catch (e) {
      alert('PDF generation failed: ' + e.message)
    } finally {
      setDownloading(false)
    }
  }

  function loadEdit(letter) {
    const s = typeof letter.date === 'string' ? letter.date.split('T')[0] : letter.date
    setDate(s || TODAY())
    setToName(letter.to_name || '')
    setSubject(letter.subject || '')
    setGreeting(letter.greeting || 'Dear Sir / Madam,')
    setBody(letter.body || '')
    setShowSign(letter.show_sign !== false)
    setShowStamp(letter.show_stamp !== false)
    setShowQr(letter.show_qr !== false)
    setSignerName(letter.signer_name || '')
    setSignerTitle(letter.signer_title || '')
    setSignatureData(letter.signature_data || null)
    setEditingId(letter.id)
    setSubmitted(false)
    setShowPreview(false)
    setComposerKey(k => k + 1)
    setView('compose')
  }

  async function handleSave() {
    if (isBodyEmpty(body)) return
    setSaving(true)
    try {
      const payload = {
        date, to_name: toName || null, subject: subject || null, greeting, body,
        show_sign: showSign, show_stamp: showStamp, show_qr: showQr,
        signer_name: signerName || null,
        signer_title: signerTitle || null,
        signature_data: signatureData || null,
      }
      let saved
      if (editingId) {
        const r = await fetch(`${API}/api/letters/${editingId}`, {
          method: 'PUT',
          headers: { ...hdr(), 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const d = await r.json()
        if (!r.ok) throw new Error(d.error)
        saved = d.letter
        setLetters(prev => prev.map(l => l.id === editingId ? saved : l))
      } else {
        const r = await fetch(`${API}/api/letters`, {
          method: 'POST',
          headers: { ...hdr(), 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const d = await r.json()
        if (!r.ok) throw new Error(d.error)
        saved = d.letter
        setLetters(prev => [saved, ...prev])
      }
      if (isAdmin) {
        setView('list'); resetForm()
        await downloadPDF(saved)
      } else {
        setSubmitted(true)
      }
    } catch (e) { alert(e.message) }
    finally { setSaving(false) }
  }

  async function handleApprove(letter) {
    try {
      const r = await fetch(`${API}/api/letters/${letter.id}/approve`, {
        method: 'PATCH', headers: hdr(),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setLetters(prev => prev.map(l => l.id === letter.id ? d.letter : l))
      await downloadPDF(d.letter)
    } catch (e) { alert(e.message) }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this letter record?')) return
    await fetch(`${API}/api/letters/${id}`, { method: 'DELETE', headers: hdr() })
    setLetters(prev => prev.filter(l => l.id !== id))
  }

  function canEdit(letter) {
    return isAdmin || String(letter.created_by) === String(user?.id)
  }

  // ── Submitted confirmation ────────────────────────────────────
  if (view === 'compose' && submitted) return (
    <>
      <style>{PAGE_CSS}</style>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, padding:'80px 20px', textAlign:'center' }}>
        <div style={{ width:72, height:72, borderRadius:'50%', background:'#FFFBEB', border:'2px solid #FDE68A', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <CheckCircle size={34} color="#8F6807"/>
        </div>
        <div style={{ fontWeight:800, fontSize:18, color:'var(--text)' }}>Submitted for Approval</div>
        <div style={{ fontSize:13, color:'var(--text-muted)', maxWidth:320 }}>
          Your letter has been saved and sent to the admin for approval. Once approved, it can be printed.
        </div>
        <button onClick={() => { setView('list'); resetForm() }}
          style={{ marginTop:8, padding:'10px 28px', borderRadius:10, border:'none', background:'#8F6807', color:'white', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
          Back to Letters
        </button>
      </div>
    </>
  )

  // ── Compose view ──────────────────────────────────────────────
  if (view === 'compose') return (
    <>
      <style>{PAGE_CSS}</style>
      <div className="cmp-wrap">

        {/* Toolbar */}
        <div className="cmp-toolbar">
          <button onClick={() => { setView('list'); resetForm() }} className="cmp-back-btn">
            <ChevronLeft size={13}/> Back
          </button>
          <span className="cmp-title">{editingId ? 'Edit Letter' : 'New Letter'}</span>
          {!isAdmin && (
            <span className="cmp-approval-badge">Requires admin approval to print</span>
          )}
          <div style={{ flex:1 }}/>
          {/* Mobile preview toggle */}
          <button
            onClick={() => setShowPreview(p => !p)}
            className="cmp-preview-btn"
            style={{ display:'flex' }}>
            <Eye size={13}/>{showPreview ? 'Form' : 'Preview'}
          </button>
          {isAdmin && editingId && (
            <button onClick={() => downloadPDF(draft)} disabled={downloading} className="cmp-dl-btn">
              <Download size={14}/>{downloading ? 'Generating…' : 'Download PDF'}
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={isBodyEmpty(body) || saving}
            className="cmp-save-btn"
            style={{ background: isAdmin ? '#8F6807' : '#6366F1', opacity:(isBodyEmpty(body) || saving) ? 0.55 : 1 }}>
            {isAdmin ? <Download size={14}/> : <Send size={14}/>}
            {saving
              ? (isAdmin ? (editingId ? 'Updating…' : 'Saving…') : 'Submitting…')
              : (isAdmin ? (editingId ? 'Update & Download PDF' : 'Save & Download PDF') : 'Submit for Approval')}
          </button>
        </div>

        {/* Two-column body */}
        <div className="cmp-body">

          {/* Form panel */}
          <div className={`cmp-form-panel${showPreview ? ' cmp-hide' : ''}`}>
            <div>
              <label style={labelStyle}>Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle}/>
            </div>
            <div>
              <label style={labelStyle}>To (Recipient)</label>
              <textarea value={toName} onChange={e => setToName(e.target.value)}
                placeholder={"e.g. The Manager\nABC Company LLC"}
                rows={3}
                style={{ ...inputStyle, resize:'vertical', lineHeight:1.55, fontFamily:'inherit' }}/>
              <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:3 }}>Leave blank → "To Whom It May Concern" · Press Enter for new line</div>
            </div>
            <div>
              <label style={labelStyle}>Subject (Re:)</label>
              <input value={subject} onChange={e => setSubject(e.target.value)}
                placeholder="e.g. Service Introduction" style={inputStyle}/>
            </div>
            <div>
              <label style={labelStyle}>Greeting</label>
              <input value={greeting} onChange={e => setGreeting(e.target.value)} style={inputStyle}/>
            </div>
            <div>
              <label style={labelStyle}>Letter Body <span style={{ color:'#E53E3E' }}>*</span></label>
              <RichEditor key={composerKey} defaultValue={body} onChange={setBody}/>
            </div>
            <div style={{ background:'var(--bg-alt)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 14px', display:'flex', flexDirection:'column', gap:10 }}>
              <div style={{ fontSize:10.5, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Letter Options</div>
              <Toggle checked={showSign}  onChange={setShowSign}  label="Include Signature"/>
              <Toggle checked={showStamp} onChange={setShowStamp} label="Include Stamp"/>
              <Toggle checked={showQr}    onChange={setShowQr}    label="Include QR Code"/>
            </div>
            {showSign && (
              <div style={{ background:'var(--bg-alt)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 14px', display:'flex', flexDirection:'column', gap:10 }}>
                <div style={{ fontSize:10.5, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Signatory</div>
                <div>
                  <label style={labelStyle}>Name</label>
                  <input value={signerName} onChange={e => setSignerName(e.target.value)}
                    placeholder="e.g. John Smith" style={inputStyle}/>
                </div>
                <div>
                  <label style={labelStyle}>Title / Position</label>
                  <input value={signerTitle} onChange={e => setSignerTitle(e.target.value)}
                    placeholder="e.g. Operations Manager" style={inputStyle}/>
                </div>
                <div>
                  <label style={labelStyle}>Signature Image</label>
                  <input type="file" accept="image/*" onChange={handleSignatureUpload}
                    style={{ fontSize:11.5, color:'var(--text)', fontFamily:'inherit' }}/>
                  {signatureData && (
                    <div style={{ marginTop:8, background:'white', border:'1px solid var(--border)', borderRadius:6, padding:6, display:'inline-block' }}>
                      <img src={signatureData} style={{ height:56, display:'block' }} alt="Signature preview"/>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Preview panel */}
          <div className={`cmp-preview-panel${showPreview ? ' cmp-show' : ''}`}>
            <div style={{ width: 794 * SCALE, flexShrink:0, boxShadow:'0 4px 24px rgba(0,0,0,0.18)', borderRadius:2, overflow:'hidden', background:'white' }}>
              <div style={{ transform:`scale(${SCALE})`, transformOrigin:'top left', width:794, pointerEvents:'none' }}
                dangerouslySetInnerHTML={{ __html: buildLetterHTML(draft, typeof window !== 'undefined' ? window.location.origin : '') }}/>
            </div>
          </div>

        </div>
      </div>
    </>
  )

  // ── List view ─────────────────────────────────────────────────
  const thisMonth = letters.filter(l => {
    const d = new Date(l.created_at), n = new Date()
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear()
  }).length
  const pending = letters.filter(l => l.status === 'pending').length

  return (
    <>
      <style>{PAGE_CSS}</style>

      {/* Hero */}
      <div className="ltr-hero">
        <div className="ltr-hero-top">
          <div className="ltr-hero-icon">
            <ScrollText size={20}/>
          </div>
          <div>
            <div className="ltr-hero-title">Office Letters</div>
            <div className="ltr-hero-sub">Official correspondence · GCD/LTR format</div>
          </div>
          <button onClick={() => { resetForm(); setView('compose') }} className="ltr-new-btn">
            <Plus size={15}/> New Letter
          </button>
        </div>

        <div className="ltr-kpi-grid">
          <div className="ltr-kpi">
            <div className="ltr-kpi-val" style={{ color:'#8F6807' }}>{letters.length}</div>
            <div className="ltr-kpi-label">Total Letters</div>
          </div>
          <div className="ltr-kpi">
            <div className="ltr-kpi-val" style={{ color:'#818CF8' }}>{thisMonth}</div>
            <div className="ltr-kpi-label">This Month</div>
          </div>
          <div className="ltr-kpi">
            <div className="ltr-kpi-val" style={{ color: pending > 0 ? '#F59E0B' : 'rgba(255,255,255,0.35)' }}>{pending}</div>
            <div className="ltr-kpi-label">Pending Approval</div>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {[1,2,3].map(i => (
            <div key={i} className="ltr-skel" style={{ height:100, opacity: 1 - i * 0.15 }}/>
          ))}
        </div>
      ) : letters.length === 0 ? (
        <div style={{ textAlign:'center', padding:'70px 20px', color:'var(--text-muted)' }}>
          <div style={{ width:64, height:64, borderRadius:'50%', background:'var(--card)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
            <FileText size={28} style={{ opacity:0.25 }}/>
          </div>
          <div style={{ fontWeight:700, fontSize:15, color:'var(--text)', marginBottom:6 }}>No letters yet</div>
          <div style={{ fontSize:13, marginBottom:20 }}>Create your first official letter using the button above.</div>
          <button onClick={() => { resetForm(); setView('compose') }}
            style={{ padding:'10px 24px', borderRadius:10, border:'none', background:'#8F6807', color:'white', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
            <Plus size={13} style={{ display:'inline', marginRight:6, verticalAlign:'middle' }}/>
            New Letter
          </button>
        </div>
      ) : (
        <div className="ltr-cards">
          {letters.map(l => {
            const isPending = l.status === 'pending'
            return (
              <div key={l.id} className={`ltr-card${isPending ? ' ltr-card-pending' : ''}`}>
                <div className="ltr-card-accent" style={{ background: isPending ? '#F59E0B' : '#8F6807' }}/>
                <div className="ltr-card-body">

                  {/* Top row: ref+subject / badge */}
                  <div className="ltr-card-top">
                    <div className="ltr-card-info">
                      <div className="ltr-ref">{l.ref_no}</div>
                      <div className={`ltr-subject${!l.subject ? ' ltr-subject-empty' : ''}`}>
                        {l.subject || 'No subject'}
                      </div>
                    </div>
                    <span className={`ltr-badge ${isPending ? 'ltr-badge-pending' : 'ltr-badge-approved'}`}>
                      {isPending ? <Clock size={10}/> : <CheckCircle size={10}/>}
                      {isPending ? 'Pending' : 'Approved'}
                    </span>
                  </div>

                  {/* Meta */}
                  <div className="ltr-card-meta">
                    <span className="ltr-meta-item">
                      <Calendar size={11}/>
                      {fmtDate(l.date)}
                    </span>
                    <span className="ltr-meta-item">
                      <User size={11}/>
                      {l.to_name || 'To Whom It May Concern'}
                    </span>
                    <span className="ltr-meta-item" style={{ color:'var(--text-muted)', opacity:0.7 }}>
                      {l.created_by_name || '—'} · {fmtShort(l.created_at)}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="ltr-card-actions">
                    {isAdmin && isPending && (
                      <button onClick={() => handleApprove(l)} className="ltr-btn ltr-btn-approve">
                        <CheckCircle size={11}/> Approve &amp; Download PDF
                      </button>
                    )}
                    {!isPending && (
                      <button onClick={() => downloadPDF(l)} disabled={downloading} className="ltr-btn ltr-btn-dl">
                        <Download size={11}/>{downloading ? 'Generating…' : 'Download PDF'}
                      </button>
                    )}
                    {canEdit(l) && (
                      <button onClick={() => loadEdit(l)} className="ltr-btn ltr-btn-edit">
                        <Pencil size={11}/> Edit
                      </button>
                    )}
                    {isAdmin && (
                      <button onClick={() => handleDelete(l.id)} className="ltr-btn ltr-btn-del">
                        <Trash2 size={11}/>
                      </button>
                    )}
                  </div>

                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
