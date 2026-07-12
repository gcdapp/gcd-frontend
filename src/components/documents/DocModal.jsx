'use client'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { differenceInDays, parseISO } from 'date-fns'
import { AlertTriangle, X, ExternalLink, UploadCloud, Link as LinkIcon, FileText } from 'lucide-react'
import { API } from '@/lib/api'

export const DOC_TYPES = [
  { v:'passport',    l:'Passport',          e:'🛂', c:'#1D6FA4', bg:'#EFF6FF' },
  { v:'emirates_id', l:'Emirates ID',        e:'🪪', c:'#B8860B', bg:'#FDF6E3' },
  { v:'visa',        l:'Visa Copy',          e:'✈️', c:'#7C3AED', bg:'#F5F3FF' },
  { v:'license',     l:'Driving License',    e:'🚗', c:'#2E7D52', bg:'#ECFDF5' },
  { v:'iloe',        l:'ILOE Certificate',   e:'📋', c:'#B45309', bg:'#FFFBEB' },
  { v:'national_id', l:'National ID',        e:'🪪', c:'#6B5D4A', bg:'#F5F4F1' },
  { v:'other',       l:'Other Document',     e:'📎', c:'#A89880', bg:'#FAFAF8' },
]

function hdr() { return { 'Content-Type':'application/json', Authorization:`Bearer ${localStorage.getItem('gcd_token')}` } }

export function expiryStatus(ds) {
  if (!ds) return null
  try {
    const d = differenceInDays(parseISO(ds.slice(0,10)), new Date())
    if (d < 0)   return { label:'Expired',    color:'#C0392B', bg:'#FEF2F2', icon:'❌', days:d }
    if (d <= 30) return { label:`${d}d left`, color:'#C0392B', bg:'#FEF2F2', icon:'⚠️', days:d }
    if (d <= 90) return { label:`${d}d left`, color:'#B45309', bg:'#FFFBEB', icon:'🟡', days:d }
    return { label:'Valid', color:'#2E7D52', bg:'#ECFDF5', icon:'✅', days:d }
  } catch { return null }
}

/**
 * Upload / link a driver document. Supports a real file upload (multipart,
 * stored in the private `driver-documents` Supabase bucket, viewed via
 * short-lived signed URLs) alongside the legacy Google-Drive-link option.
 * Shared by hr/documents/page.jsx and the per-driver Documents page.
 */
export default function DocModal({ emp, employees, editDoc, onSave, onClose }) {
  const isEdit  = !!editDoc
  const [empId,    setEmpId]    = useState(editDoc?.emp_id || emp?.id || '')
  const [docType,  setDocType]  = useState(editDoc?.doc_type || 'passport')
  const [fileName, setFileName] = useState(editDoc?.file_name || '')
  const [driveLink,setDriveLink]= useState(editDoc?.drive_link || '')
  const [file,     setFile]     = useState(null)
  const [notes,    setNotes]    = useState(editDoc?.notes || '')
  const [expires,  setExpires]  = useState(editDoc?.expires_at?.slice(0,10) || '')
  const [saving,   setSaving]   = useState(false)
  const [err,      setErr]      = useState(null)
  const [mode,     setMode]     = useState(editDoc?.drive_link ? 'link' : 'upload') // 'upload' | 'link'

  const selectedType = DOC_TYPES.find(t=>t.v===docType)

  async function handleSave() {
    if (!empId) return setErr('Select an employee')
    if (mode==='upload' && !file && !(isEdit && editDoc?.file_url)) return setErr('Choose a file to upload')
    if (mode==='link' && !driveLink) return setErr('Paste the Google Drive link')
    if (!fileName && !file) return setErr('Enter a file name')
    setSaving(true); setErr(null)
    try {
      const url    = isEdit ? `${API}/api/documents/${editDoc.id}` : `${API}/api/documents`
      const method = isEdit ? 'PUT' : 'POST'
      let res
      if (mode==='upload' && file) {
        const fd = new FormData()
        fd.append('emp_id', empId)
        fd.append('doc_type', docType)
        if (fileName) fd.append('file_name', fileName)
        if (notes)    fd.append('notes', notes)
        if (expires)  fd.append('expires_at', expires)
        fd.append('file', file)
        res = await fetch(url, { method, headers: { Authorization:`Bearer ${localStorage.getItem('gcd_token')}` }, body: fd })
      } else {
        const body = { emp_id:empId, doc_type:docType, file_name:fileName, drive_link:driveLink||null, notes:notes||null, expires_at:expires||null }
        res = await fetch(url, { method, headers:hdr(), body:JSON.stringify(body) })
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onSave()
    } catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  return createPortal(
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ maxWidth:500, padding:0, overflow:'hidden' }}>
        {/* Header */}
        <div style={{ padding:'22px 24px 0', background:`linear-gradient(135deg,${selectedType?.bg||'#FDF6E3'},#FFF)` }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
            <div>
              <h3 style={{ fontWeight:900, fontSize:17, color:'#1A1612' }}>{isEdit?'Edit':'Add'} Document</h3>
              <p style={{ fontSize:12, color:'#A89880', marginTop:2 }}>{isEdit?editDoc.emp_name:emp?.name||'Select employee below'}</p>
            </div>
            <button onClick={onClose} style={{ width:30, height:30, borderRadius:'50%', background:'rgba(0,0,0,0.06)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><X size={14}/></button>
          </div>
          {/* Doc type selector */}
          <div className="doc-type-pills" style={{ display:'flex', gap:6, overflowX:'auto', scrollbarWidth:'none', WebkitOverflowScrolling:'touch', paddingBottom:8, cursor:'grab', userSelect:'none' }} onMouseDown={e=>{const el=e.currentTarget;el.isDragging=true;el.startX=e.pageX-el.offsetLeft;el.scrollLeft=el.scrollLeft}} onMouseMove={e=>{const el=e.currentTarget;if(!el.isDragging)return;e.preventDefault();el.scrollLeft=el.scrollLeft-(e.pageX-el.offsetLeft-el.startX);el.startX=e.pageX-el.offsetLeft}} onMouseUp={e=>e.currentTarget.isDragging=false} onMouseLeave={e=>e.currentTarget.isDragging=false}>
            {DOC_TYPES.map(t=>(
              <button key={t.v} onClick={()=>setDocType(t.v)} type="button"
                style={{ padding:'8px 12px', borderRadius:20, border:`2px solid ${docType===t.v?t.c:'#EAE6DE'}`, background:docType===t.v?t.bg:'#FFF', cursor:'pointer', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:5, transition:'all 0.18s', flexShrink:0 }}>
                <span style={{ fontSize:14 }}>{t.e}</span>
                <span style={{ fontSize:11.5, fontWeight:docType===t.v?700:500, color:docType===t.v?t.c:'#A89880' }}>{t.l}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding:'18px 24px 22px', display:'flex', flexDirection:'column', gap:14 }}>
          {err && (
            <div style={{ display:'flex', gap:8, alignItems:'center', background:'#FEF2F2', border:'1px solid #FCA5A5', borderRadius:9, padding:'9px 12px', fontSize:12.5, color:'#C0392B' }}>
              <AlertTriangle size={13}/> {err}
            </div>
          )}

          {!emp && (
            <div>
              <label className="input-label">Employee *</label>
              <select className="input" value={empId} onChange={e=>setEmpId(e.target.value)} style={{ borderRadius:10 }}>
                <option value="">Select employee…</option>
                {employees.map(e=><option key={e.id} value={e.id}>{e.name} ({e.id})</option>)}
              </select>
            </div>
          )}

          {/* Upload vs Drive Link toggle */}
          <div style={{ display:'flex', gap:6 }}>
            {[{v:'upload',l:'Upload File',I:UploadCloud},{v:'link',l:'Drive Link',I:LinkIcon}].map(t=>{
              const TI = t.I
              return (
                <button key={t.v} type="button" onClick={()=>setMode(t.v)}
                  style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'9px', borderRadius:10, border:`2px solid ${mode===t.v?'#B8860B':'#EAE6DE'}`, background:mode===t.v?'#FDF6E3':'#FFF', color:mode===t.v?'#B8860B':'#A89880', fontWeight:mode===t.v?700:500, fontSize:12.5, cursor:'pointer' }}>
                  <TI size={13}/> {t.l}
                </button>
              )
            })}
          </div>

          {mode==='upload' ? (
            <div>
              <label className="input-label">File *</label>
              <label style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', borderRadius:10, border:'1.5px dashed #D4A017', background:'#FDF6E3', cursor:'pointer' }}>
                <UploadCloud size={16} color="#B8860B"/>
                <span style={{ fontSize:12.5, color:'#6B5D4A', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {file ? file.name : editDoc?.file_url ? 'Replace uploaded file…' : 'Click to choose a file (max 10MB)'}
                </span>
                <input type="file" style={{ display:'none' }} onChange={e=>{
                  const f = e.target.files?.[0] || null
                  setFile(f)
                  if (f && !fileName) setFileName(f.name)
                }}/>
              </label>
              {editDoc?.signed_url && !file && (
                <a href={editDoc.signed_url} target="_blank" rel="noreferrer" style={{ display:'inline-flex', alignItems:'center', gap:5, marginTop:6, fontSize:11.5, color:'#1D6FA4' }}>
                  <FileText size={11}/> View current file <ExternalLink size={10}/>
                </a>
              )}
            </div>
          ) : (
            <div>
              <label className="input-label" style={{ display:'flex', alignItems:'center', gap:6 }}>
                <img src="https://www.google.com/drive/static/images/drive/logo-drive.png" alt="" style={{ width:14, height:12, objectFit:'contain' }}/>
                Google Drive Link
              </label>
              <div style={{ position:'relative' }}>
                <input className="input" value={driveLink} onChange={e=>setDriveLink(e.target.value)}
                  placeholder="Paste Google Drive sharing link here…"
                  style={{ borderRadius:10, paddingRight:40 }}/>
                {driveLink && (
                  <a href={driveLink} target="_blank" rel="noopener noreferrer"
                    style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', color:'#B8860B', display:'flex' }}>
                    <ExternalLink size={15}/>
                  </a>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="input-label">Document Name *</label>
            <input className="input" value={fileName} onChange={e=>setFileName(e.target.value)} placeholder={`e.g. ${selectedType?.l} - Mohammed Al Rashid`} autoComplete="off" style={{ borderRadius:10 }}/>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label className="input-label">Expiry Date</label>
              <input className="input" type="date" value={expires} onChange={e=>setExpires(e.target.value)} style={{ borderRadius:10 }}/>
            </div>
            <div>
              <label className="input-label">Notes</label>
              <input className="input" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Any notes…" style={{ borderRadius:10 }}/>
            </div>
          </div>

          <div style={{ display:'flex', gap:10, marginTop:4 }}>
            <button onClick={onClose} className="btn btn-secondary" style={{ flex:1, justifyContent:'center' }}>Cancel</button>
            <button onClick={handleSave} disabled={saving}
              style={{ flex:2, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'11px', borderRadius:100, background:`linear-gradient(135deg,${selectedType?.c||'#B8860B'},${selectedType?.c||'#B8860B'}cc)`, color:'white', fontWeight:700, fontSize:13, border:'none', cursor:'pointer', opacity:saving?0.6:1 }}>
              {saving ? <><span style={{ width:14, height:14, border:'2px solid rgba(255,255,255,0.4)', borderTopColor:'white', borderRadius:'50%', animation:'spin 0.8s linear infinite', display:'inline-block' }}/> Saving…</> : isEdit ? 'Save Changes' : 'Add Document'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
