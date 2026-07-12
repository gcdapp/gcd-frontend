'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Plus, X, Pencil, Trash2, AlertCircle, ExternalLink,
  Download, Printer, RefreshCw, Link2,
} from 'lucide-react'
import { differenceInDays, parseISO } from 'date-fns'

import { API } from '@/lib/api'

function hdr() { return { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('gcd_token')}` } }

function expiry(ds) {
  if (!ds) return null
  try {
    const d = differenceInDays(parseISO(ds.slice(0, 10)), new Date())
    if (d < 0)   return { label: 'Expired',    d, c: '#EF4444', bg: '#FEF2F2', bc: '#FECACA' }
    if (d <= 30) return { label: `${d}d left`, d, c: '#EF4444', bg: '#FEF2F2', bc: '#FECACA' }
    if (d <= 90) return { label: `${d}d left`, d, c: '#F59E0B', bg: '#FFFBEB', bc: '#FDE68A' }
    return { label: 'Valid', d, c: '#10B981', bg: '#F0FDF4', bc: '#A7F3D0' }
  } catch { return null }
}

const CATEGORIES = [
  { v: 'license',    l: 'Commercial License', emoji: '🏢', color: '#1D4ED8', bg: '#EFF6FF', bc: '#BFDBFE' },
  { v: 'ejari',      l: 'Ejari / Tenancy',    emoji: '🏠', color: '#6D28D9', bg: '#F5F3FF', bc: '#DDD6FE' },
  { v: 'insurance',  l: 'Insurance',          emoji: '🛡️', color: '#047857', bg: '#F0FDF4', bc: '#A7F3D0' },
  { v: 'permit',     l: 'Permit / Approval',  emoji: '✅', color: '#B45309', bg: '#FFFBEB', bc: '#FDE68A' },
  { v: 'certificate',l: 'Certificate',        emoji: '📜', color: '#B91C1C', bg: '#FEF2F2', bc: '#FECACA' },
  { v: 'other',      l: 'Other',              emoji: '📄', color: '#4B5563', bg: '#F9FAFB', bc: '#E5E7EB' },
]
const catMap = Object.fromEntries(CATEGORIES.map(c => [c.v, c]))

function Lbl({ children }) {
  return <label style={{ display:'block', fontSize:10.5, fontWeight:700, letterSpacing:'0.07em', textTransform:'uppercase', color:'var(--text-muted)', marginBottom:5 }}>{children}</label>
}

function driveViewUrl(url) {
  if (!url) return null
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/)
  if (m) return `https://drive.google.com/file/d/${m[1]}/view`
  return url
}

/* ══ DOCUMENT MODAL ═════════════════════════════════════════════ */
function DocModal({ doc, onSave, onClose }) {
  const [form, setForm] = useState(doc ? {
    name: doc.name||'', document_number: doc.document_number||'',
    issued_by: doc.issued_by||'', issue_date: doc.issue_date?.slice(0,10)||'',
    expiry_date: doc.expiry_date?.slice(0,10)||'', category: doc.category||'other',
    notes: doc.notes||'', file_url: doc.file_url||'',
  } : { name:'', document_number:'', issued_by:'', issue_date:'', expiry_date:'', category:'other', notes:'', file_url:'' })
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState(null)
  function set(k,v) { setForm(p=>({...p,[k]:v})) }

  async function handleSave() {
    if (!form.name) return setErr('Document name is required')
    setSaving(true); setErr(null)
    try {
      const url    = doc ? `${API}/api/office/documents/${doc.id}` : `${API}/api/office/documents`
      const method = doc ? 'PUT' : 'POST'
      const r = await fetch(url, { method, headers: hdr(), body: JSON.stringify(form) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error||'Failed')
      onSave()
    } catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  return createPortal(
    <div className="modal-overlay">
      <div style={{ background:'var(--card)', borderRadius:20, width:'100%', maxWidth:520, maxHeight:'92vh', overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)' }}>
        <div style={{ padding:'22px 24px 18px', borderBottom:'1px solid var(--border)', flexShrink:0, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <h3 style={{ fontWeight:800, fontSize:15, color:'var(--text)', margin:0 }}>{doc?'Edit Document':'Add Document'}</h3>
            <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>Office record with expiry tracking</p>
          </div>
          <button onClick={onClose} style={{ width:30, height:30, borderRadius:'50%', background:'var(--bg-alt)', border:'1px solid var(--border)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><X size={14}/></button>
        </div>

        <div style={{ padding:'20px 24px', overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:14 }}>
          {err && <div style={{ display:'flex', gap:8, alignItems:'center', background:'var(--red-bg)', border:'1px solid var(--red-border)', borderRadius:10, padding:'10px 14px', fontSize:12.5, color:'var(--red)' }}><AlertCircle size={14}/>{err}</div>}

          <div>
            <Lbl>Category</Lbl>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:7 }}>
              {CATEGORIES.map(c=>(
                <button key={c.v} type="button" onClick={()=>set('category',c.v)}
                  style={{ padding:'10px 8px', borderRadius:12, border:`2px solid ${form.category===c.v?c.color:'var(--border)'}`, background:form.category===c.v?c.bg:'var(--card)', cursor:'pointer', textAlign:'center', transition:'all 0.15s' }}>
                  <div style={{ fontSize:18, marginBottom:4 }}>{c.emoji}</div>
                  <div style={{ fontSize:9.5, fontWeight:700, color:form.category===c.v?c.color:'var(--text-muted)', lineHeight:1.2 }}>{c.l}</div>
                </button>
              ))}
            </div>
          </div>

          <div><Lbl>Document Name *</Lbl><input className="input" value={form.name} onChange={e=>set('name',e.target.value)} placeholder="e.g. Commercial License 2025-26"/></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:13 }}>
            <div><Lbl>Document Number</Lbl><input className="input" value={form.document_number} onChange={e=>set('document_number',e.target.value)} placeholder="CN-12345"/></div>
            <div><Lbl>Issued By</Lbl><input className="input" value={form.issued_by} onChange={e=>set('issued_by',e.target.value)} placeholder="DED, RERA, DLD…"/></div>
            <div><Lbl>Issue Date</Lbl><input className="input" type="date" value={form.issue_date} onChange={e=>set('issue_date',e.target.value)}/></div>
            <div><Lbl>Expiry Date</Lbl><input className="input" type="date" value={form.expiry_date} onChange={e=>set('expiry_date',e.target.value)}/></div>
          </div>

          <div>
            <Lbl>Google Drive Link</Lbl>
            <div style={{ position:'relative' }}>
              <Link2 size={13} style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', pointerEvents:'none' }}/>
              <input className="input" style={{ paddingLeft:32 }} value={form.file_url} onChange={e=>set('file_url',e.target.value)} placeholder="Paste Google Drive share link…"/>
            </div>
            <p style={{ fontSize:10.5, color:'var(--text-muted)', marginTop:5 }}>Share the file in Google Drive → Copy link → Paste here.</p>
          </div>

          <div><Lbl>Notes</Lbl><textarea className="input" rows={2} value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Any additional notes…" style={{ resize:'vertical' }}/></div>
        </div>

        <div style={{ padding:'14px 24px 20px', borderTop:'1px solid var(--border)', display:'flex', gap:10, justifyContent:'flex-end', flexShrink:0 }}>
          <button onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ minWidth:130, justifyContent:'center' }}>
            {saving ? 'Saving…' : doc ? 'Save Changes' : 'Add Document'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

/* ══ MAIN PAGE ══════════════════════════════════════════════════ */
export default function OfficePage() {
  const [docs,     setDocs]     = useState([])
  const [loading,  setLoading]  = useState(true)
  const [docModal, setDocModal] = useState(null)
  const [userRole, setUserRole] = useState(null)

  useEffect(() => {
    try { const t=localStorage.getItem('gcd_token'); if(t){const p=JSON.parse(atob(t.split('.')[1]));setUserRole(p.role)} } catch(e){}
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`${API}/api/office/documents`, { headers: hdr() })
      const d = await r.json()
      setDocs(d.documents||[])
    } catch(e) { console.error(e) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const canEdit = ['admin','general_manager','hr','accountant'].includes(userRole)

  async function deleteDoc(id) {
    if (!confirm('Delete this document?')) return
    await fetch(`${API}/api/office/documents/${id}`, { method:'DELETE', headers:hdr() })
    setDocs(p=>p.filter(d=>d.id!==id))
  }

  const expired    = docs.filter(d=>{ const e=expiry(d.expiry_date); return e&&e.d<0 })
  const expiring30 = docs.filter(d=>{ const e=expiry(d.expiry_date); return e&&e.d>=0&&e.d<=30 })

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* ── Header ── */}
      <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:18, overflow:'hidden', boxShadow:'var(--shadow)' }}>
        <div style={{ height:4, background:'linear-gradient(90deg,#B8934A,#E8C97A,#B8934A)' }}/>
        <div className="page-header" style={{ padding:'18px 22px', margin:0 }}>
          <div>
            <h1 style={{ fontWeight:900, fontSize:22, color:'var(--text)', margin:0, letterSpacing:'-0.03em' }}>Office Profile</h1>
            <p style={{ fontSize:12.5, color:'var(--text-muted)', marginTop:2 }}>Company documents, licenses &amp; expiry tracking</p>
          </div>
          <div className="page-header-actions">
            <button onClick={load} title="Refresh" style={{ width:36, height:36, borderRadius:'50%', background:'var(--bg-alt)', border:'1px solid var(--border)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <RefreshCw size={14} color="var(--text-muted)"/>
            </button>
            {canEdit && (
              <button className="btn btn-primary" onClick={()=>setDocModal({mode:'add'})}>
                <Plus size={14}/> Add Document
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="r-grid-4">
        {[
          { l:'Total Documents',     v:docs.length,        c:'#1D4ED8', bg:'#EFF6FF', bc:'#BFDBFE' },
          { l:'Expired',             v:expired.length,     c:'#DC2626', bg:'#FEF2F2', bc:'#FECACA' },
          { l:'Expiring in 30 days', v:expiring30.length,  c:'#D97706', bg:'#FFFBEB', bc:'#FDE68A' },
          { l:'Valid',               v:docs.length-expired.length-expiring30.length, c:'#047857', bg:'#F0FDF4', bc:'#A7F3D0' },
        ].map(s=>(
          <div key={s.l} style={{ background:s.bg, border:`1px solid ${s.bc}`, borderRadius:16, padding:'18px 16px', textAlign:'center', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ fontWeight:900, fontSize:30, color:s.c, letterSpacing:'-0.04em', lineHeight:1 }}>{s.v}</div>
            <div style={{ fontSize:11, color:s.c, fontWeight:600, marginTop:7, opacity:0.8 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* ── Alert banners ── */}
      {expired.length>0 && (
        <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:12, padding:'11px 16px', display:'flex', alignItems:'center', gap:10 }}>
          <AlertCircle size={15} color="#DC2626"/>
          <span style={{ fontSize:13, fontWeight:700, color:'#DC2626' }}>{expired.length} document{expired.length>1?'s':''} expired:</span>
          <span style={{ fontSize:12.5, color:'#7F1D1D' }}>{expired.map(d=>d.name).join(' · ')}</span>
        </div>
      )}
      {expiring30.length>0 && (
        <div style={{ background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:12, padding:'11px 16px', display:'flex', alignItems:'center', gap:10 }}>
          <AlertCircle size={15} color="#D97706"/>
          <span style={{ fontSize:13, fontWeight:700, color:'#D97706' }}>{expiring30.length} expiring within 30 days:</span>
          <span style={{ fontSize:12.5, color:'#92400E' }}>{expiring30.map(d=>d.name).join(' · ')}</span>
        </div>
      )}

      {/* ── Documents ── */}
      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {[1,2,3].map(i=><div key={i} className="sk" style={{ height:120, borderRadius:14 }}/>)}
        </div>
      ) : docs.length===0 ? (
        <div style={{ textAlign:'center', padding:'80px 20px' }}>
          <div style={{ fontSize:40, marginBottom:12 }}>📁</div>
          <div style={{ fontWeight:700, fontSize:16, color:'var(--text-sub)' }}>No documents yet</div>
          <div style={{ fontSize:12.5, color:'var(--text-muted)', marginTop:4 }}>Add your first office document to start tracking expiries</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {docs.map(doc=>{
            const cat = catMap[doc.category]||catMap.other
            const exp = expiry(doc.expiry_date)
            const fileUrl = driveViewUrl(doc.file_url)
            return (
              <div key={doc.id} className="doc-card" style={{ border:`1px solid ${exp&&exp.d<=30?exp.bc:'var(--border)'}` }}
                onMouseEnter={e=>e.currentTarget.style.boxShadow='var(--shadow-md)'}
                onMouseLeave={e=>e.currentTarget.style.boxShadow='var(--shadow)'}>

                <div style={{ width:5, background:cat.color, flexShrink:0 }}/>

                <div className="doc-card-body">
                  <div style={{ display:'flex', alignItems:'center', gap:14, flex:1, minWidth:0, width:'100%' }}>
                    <div style={{ width:50, height:50, borderRadius:15, background:cat.bg, border:`1.5px solid ${cat.bc}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0, boxShadow:'0 2px 6px rgba(0,0,0,0.06)' }}>
                      {cat.emoji}
                    </div>

                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap' }}>
                        <span style={{ fontSize:10, fontWeight:800, color:cat.color, textTransform:'uppercase', letterSpacing:'0.07em', background:cat.bg, border:`1px solid ${cat.bc}`, borderRadius:6, padding:'1px 8px' }}>{cat.l}</span>
                        {exp && <span style={{ fontSize:10.5, fontWeight:700, color:exp.c, background:exp.bg, border:`1px solid ${exp.bc}`, borderRadius:20, padding:'1px 9px' }}>{exp.label}</span>}
                      </div>
                      <div style={{ fontWeight:800, fontSize:15, color:'var(--text)', marginBottom:4 }}>{doc.name}</div>
                      <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginTop:2 }}>
                        {doc.document_number && <span style={{ fontSize:10.5, color:'var(--text-sub)', background:'var(--bg-alt)', border:'1px solid var(--border)', borderRadius:6, padding:'2px 9px' }}>#{doc.document_number}</span>}
                        {doc.issued_by       && <span style={{ fontSize:10.5, color:'var(--text-sub)', background:'var(--bg-alt)', border:'1px solid var(--border)', borderRadius:6, padding:'2px 9px' }}>{doc.issued_by}</span>}
                        {doc.issue_date      && <span style={{ fontSize:10.5, color:'var(--text-muted)', background:'var(--bg-alt)', border:'1px solid var(--border)', borderRadius:6, padding:'2px 9px' }}>Issued {doc.issue_date.slice(0,10)}</span>}
                        {doc.expiry_date     && <span style={{ fontSize:10.5, color:'var(--text-muted)', background:'var(--bg-alt)', border:'1px solid var(--border)', borderRadius:6, padding:'2px 9px' }}>Expires {doc.expiry_date.slice(0,10)}</span>}
                      </div>
                      {doc.notes && <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4, fontStyle:'italic' }}>{doc.notes}</div>}
                    </div>
                  </div>

                  <div className="doc-card-actions">
                    {fileUrl ? (
                      <>
                        <a href={fileUrl} target="_blank" rel="noreferrer"
                          style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 13px', borderRadius:9, background:'#EFF6FF', border:'1px solid #BFDBFE', color:'#1D4ED8', fontSize:12, fontWeight:700, textDecoration:'none', whiteSpace:'nowrap' }}>
                          <ExternalLink size={12}/> View
                        </a>
                        <a href={doc.file_url} download
                          style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 13px', borderRadius:9, background:'var(--bg-alt)', border:'1px solid var(--border)', color:'var(--text-sub)', fontSize:12, fontWeight:700, textDecoration:'none', whiteSpace:'nowrap' }}>
                          <Download size={12}/> Download
                        </a>
                        <a href={fileUrl} target="_blank" rel="noreferrer" onClick={e=>{ e.preventDefault(); const w=window.open(fileUrl,'_blank'); w&&setTimeout(()=>w.print(),2000) }}
                          style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 13px', borderRadius:9, background:'var(--bg-alt)', border:'1px solid var(--border)', color:'var(--text-sub)', fontSize:12, fontWeight:700, textDecoration:'none', cursor:'pointer', whiteSpace:'nowrap' }}>
                          <Printer size={12}/> Print
                        </a>
                      </>
                    ) : (
                      <span style={{ fontSize:11, color:'var(--text-muted)', fontStyle:'italic' }}>No file attached</span>
                    )}
                    {canEdit && (
                      <>
                        <button onClick={()=>setDocModal({mode:'edit',doc})} style={{ width:32, height:32, borderRadius:9, background:'var(--bg-alt)', border:'1px solid var(--border)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                          <Pencil size={13} color="var(--text-sub)"/>
                        </button>
                        <button onClick={()=>deleteDoc(doc.id)} style={{ width:32, height:32, borderRadius:9, background:'var(--red-bg)', border:'1px solid var(--red-border)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                          <Trash2 size={13} color="var(--red)"/>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {docModal && <DocModal doc={docModal.mode==='edit'?docModal.doc:null} onSave={()=>{setDocModal(null);load()}} onClose={()=>setDocModal(null)}/>}
    </div>
  )
}
