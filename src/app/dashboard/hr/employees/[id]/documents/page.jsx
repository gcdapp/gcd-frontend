'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { empApi, docApi, API } from '@/lib/api'
import DocModal, { DOC_TYPES, expiryStatus } from '@/components/documents/DocModal'
import { ChevronLeft, Plus, Trash2, ExternalLink, FolderOpen } from 'lucide-react'

function hdr() { return { Authorization:`Bearer ${localStorage.getItem('gcd_token')}` } }

export default function DriverDocumentsPage() {
  const { id } = useParams()
  const router = useRouter()
  const [emp,       setEmp]       = useState(null)
  const [documents, setDocuments] = useState([])
  const [loading,    setLoading]  = useState(true)
  const [modal,      setModal]    = useState(null) // 'add' | doc object

  useEffect(() => { empApi.get(id).then(d => setEmp(d.employee)).catch(() => setEmp(null)) }, [id])

  const load = useCallback(() => {
    setLoading(true)
    docApi.list({ emp_id: id }).then(d => setDocuments(d.documents || [])).catch(() => setDocuments([])).finally(() => setLoading(false))
  }, [id])
  useEffect(() => { load() }, [load])

  async function handleDelete(docId) {
    if (!confirm('Delete this document record?')) return
    await fetch(`${API}/api/documents/${docId}`, { method:'DELETE', headers: hdr() })
    load()
  }

  const expiring = documents.filter(d => { const s = expiryStatus(d.expires_at); return s && s.days <= 60 }).length
  const expired  = documents.filter(d => { const s = expiryStatus(d.expires_at); return s && s.days < 0 }).length

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14, animation:'slideUp 0.3s ease' }}>
      <button onClick={()=>router.push(`/dashboard/hr/employees/${id}`)}
        style={{ display:'flex', alignItems:'center', gap:6, alignSelf:'flex-start', background:'none', border:'none', color:'var(--text-muted)', fontSize:12.5, fontWeight:600, cursor:'pointer', padding:0, fontFamily:'inherit' }}>
        <ChevronLeft size={14}/> Back to {emp?.name || 'Driver'}
      </button>

      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontWeight:900, fontSize:20, color:'var(--text)', letterSpacing:'-0.03em' }}>Documents — {emp?.name || '…'}</h1>
          <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:3 }}>{documents.length} file{documents.length!==1?'s':''} on record</p>
        </div>
        <button onClick={()=>setModal('add')} className="btn btn-primary" style={{ borderRadius:24, gap:7 }}>
          <Plus size={15}/> Upload Document
        </button>
      </div>

      <div className="r-grid-3">
        {[
          { l:'Total Files',   v:documents.length, c:'#1A1612', bg:'#FAFAF8', bc:'#EAE6DE', icon:'📁' },
          { l:'Expiring Soon', v:expiring,          c:'#B45309', bg:'#FFFBEB', bc:'#FCD34D', icon:'⏰' },
          { l:'Expired',       v:expired,           c:'#C0392B', bg:'#FEF2F2', bc:'#FCA5A5', icon:'❌' },
        ].map(s => (
          <div key={s.l} className="stat-card" style={{ padding:'14px 12px', textAlign:'center', background:s.bg, border:`1px solid ${s.bc}` }}>
            <div style={{ fontSize:22, marginBottom:5 }}>{s.icon}</div>
            <div style={{ fontWeight:900, fontSize:24, color:s.c, letterSpacing:'-0.04em', lineHeight:1 }}>{loading ? '—' : s.v}</div>
            <div style={{ fontSize:10.5, color:s.c, fontWeight:600, marginTop:4, opacity:0.8 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {[1,2,3].map(i => <div key={i} className="sk" style={{ height:64, borderRadius:12 }}/>)}
        </div>
      ) : documents.length === 0 ? (
        <div style={{ textAlign:'center', padding:'50px 20px', color:'var(--text-muted)' }}>
          <FolderOpen size={32} style={{ margin:'0 auto 12px', display:'block', opacity:0.2 }}/>
          <div style={{ fontWeight:600, color:'var(--text)' }}>No documents uploaded yet</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {documents.map(doc => {
            const dt      = DOC_TYPES.find(t=>t.v===doc.doc_type) || DOC_TYPES[DOC_TYPES.length-1]
            const expInfo = expiryStatus(doc.expires_at)
            const link    = doc.signed_url || doc.drive_link
            return (
              <div key={doc.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', background:'var(--card)', border:`1px solid ${expInfo&&expInfo.days<=30?'#FCA5A5':'var(--border)'}`, borderRadius:12 }}>
                <div style={{ width:38, height:38, borderRadius:10, background:dt.bg, border:`1px solid ${dt.c}25`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>{dt.e}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:600, fontSize:13, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{doc.file_name}</div>
                  <div style={{ fontSize:11, color:dt.c, fontWeight:600, marginTop:1 }}>{dt.l}</div>
                  {doc.expires_at && (
                    <div style={{ fontSize:10.5, color:expInfo?.color||'var(--text-muted)', marginTop:1, fontWeight:500 }}>
                      {expInfo?.icon} Expires: {doc.expires_at.slice(0,10)} {expInfo?.label && `· ${expInfo.label}`}
                    </div>
                  )}
                </div>
                <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                  {link ? (
                    <a href={link} target="_blank" rel="noopener noreferrer"
                      style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:9, background:'var(--blue-bg)', border:'1px solid var(--blue-border)', color:'var(--blue)', fontSize:11.5, fontWeight:700, textDecoration:'none' }}>
                      <ExternalLink size={12}/> View
                    </a>
                  ) : (
                    <span style={{ fontSize:11, color:'var(--text-muted)', padding:'6px 10px' }}>No file</span>
                  )}
                  <button onClick={()=>handleDelete(doc.id)}
                    style={{ width:30, height:30, borderRadius:9, background:'var(--red-bg)', border:'1px solid var(--red-border)', color:'var(--red)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <Trash2 size={13}/>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal==='add' && emp && (
        <DocModal emp={emp} employees={[emp]} onClose={()=>setModal(null)} onSave={()=>{ setModal(null); load() }}/>
      )}
    </div>
  )
}
