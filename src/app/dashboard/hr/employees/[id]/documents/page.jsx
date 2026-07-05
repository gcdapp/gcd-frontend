'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { empApi, docApi, API } from '@/lib/api'
import { getEmp, setEmp as cacheEmp } from '@/lib/empCache'
import { hdr } from '@/lib/employees'
import PageHero from '@/components/employees/PageHero'
import BackLink from '@/components/employees/BackLink'
import DocModal, { DOC_TYPES, expiryStatus } from '@/components/documents/DocModal'
import { Plus, Trash2, ExternalLink, FolderOpen } from 'lucide-react'

export default function DriverDocumentsPage() {
  const { id } = useParams()
  const router = useRouter()
  const [emp,       setEmp]       = useState(() => getEmp(id))
  const [documents, setDocuments] = useState([])
  const [loading,    setLoading]  = useState(true)
  const [modal,      setModal]    = useState(null) // 'add' | doc object

  useEffect(() => { empApi.get(id).then(d => { setEmp(d.employee); cacheEmp(d.employee) }).catch(() => setEmp(prev => prev)) }, [id])

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
      <BackLink router={router} href={`/dashboard/hr/employees/${id}`} label={`Back to ${emp?.name || 'Driver'}`}/>

      <PageHero icon={FolderOpen} iconColor="#2563EB" iconBg="rgba(37,99,235,0.15)" iconBorder="rgba(37,99,235,0.35)"
        title={`Documents — ${emp?.name || '…'}`}
        subtitle={`${documents.length} file${documents.length!==1?'s':''} on record`}
        actions={
          <button onClick={()=>setModal('add')}
            style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 18px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#3B82F6,#2563EB)', color:'white', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
            <Plus size={14}/> Upload Document
          </button>
        }>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginTop:20 }}>
          {[
            { label:'Total Files',   val:documents.length, color:'#F5F5F5' },
            { label:'Expiring Soon', val:expiring,          color:'#FBBF24' },
            { label:'Expired',       val:expired,           color:'#F87171' },
          ].map(k => (
            <div key={k.label} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, padding:'14px 16px' }}>
              <div style={{ fontSize:22, fontWeight:800, color:k.color, lineHeight:1.1 }}>{loading ? '—' : k.val}</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.38)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', marginTop:4 }}>{k.label}</div>
            </div>
          ))}
        </div>
      </PageHero>

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
