'use client'
import { useState, useEffect, useCallback } from 'react'
import { empApi } from '@/lib/api'
import { differenceInDays, parseISO } from 'date-fns'
import { AlertTriangle, X, ExternalLink, Trash2, Plus, Search, RefreshCw, ChevronRight } from 'lucide-react'
import DocModal, { DOC_TYPES, expiryStatus } from '@/components/documents/DocModal'

import { API } from '@/lib/api'

// ── Document card ─────────────────────────────────────────────
function DocCard({ doc, onDelete }) {
  const dt      = DOC_TYPES.find(t=>t.v===doc.doc_type) || DOC_TYPES[DOC_TYPES.length-1]
  const expInfo = expiryStatus(doc.expires_at)

  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'#FFF', border:`1px solid ${expInfo&&expInfo.days<=30?'#FCA5A5':'#EAE6DE'}`, borderRadius:12, transition:'box-shadow 0.2s' }}
      onMouseEnter={e=>e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,0.07)'}
      onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}>
      {/* Icon */}
      <div style={{ width:38, height:38, borderRadius:10, background:dt.bg, border:`1px solid ${dt.c}25`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>{dt.e}</div>
      {/* Info */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:600, fontSize:13, color:'#1A1612', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{doc.file_name}</div>
        <div style={{ fontSize:11, color:dt.c, fontWeight:600, marginTop:1 }}>{dt.l}</div>
        {doc.expires_at && (
          <div style={{ fontSize:10.5, color:expInfo?.color||'#A89880', marginTop:1, fontWeight:500 }}>
            {expInfo?.icon} Expires: {doc.expires_at.slice(0,10)} {expInfo?.label&&`· ${expInfo.label}`}
          </div>
        )}
      </div>
      {/* Actions */}
      <div style={{ display:'flex', gap:6, flexShrink:0 }}>
        {(doc.signed_url || doc.drive_link) ? (
          <a href={doc.signed_url || doc.drive_link} target="_blank" rel="noopener noreferrer"
            style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:9, background:'linear-gradient(135deg,#EFF6FF,#DBEAFE)', border:'1px solid #BFDBFE', color:'#1D6FA4', fontSize:11.5, fontWeight:700, textDecoration:'none', transition:'transform 0.15s' }}
            onMouseEnter={e=>e.currentTarget.style.transform='scale(1.03)'}
            onMouseLeave={e=>e.currentTarget.style.transform='none'}>
            <ExternalLink size={12}/> View
          </a>
        ) : (
          <span style={{ fontSize:11, color:'#C4B49A', padding:'6px 10px' }}>No link</span>
        )}
        <button onClick={()=>onDelete(doc.id)} style={{ width:30, height:30, borderRadius:9, background:'#FEF2F2', border:'1px solid #FCA5A530', color:'#C0392B', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'background 0.15s' }}
          onMouseEnter={e=>e.currentTarget.style.background='#FEE2E2'}
          onMouseLeave={e=>e.currentTarget.style.background='#FEF2F2'}>
          <Trash2 size={13}/>
        </button>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────
export default function DocumentsPage() {
  const [employees, setEmployees] = useState([])
  const [documents, setDocuments] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [filter,    setFilter]    = useState('all')  // all | expiring | missing
  const [modal,     setModal]     = useState(null)
  const [expanded,  setExpanded]  = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [emps, docs] = await Promise.all([
        empApi.list(),
        fetch(`${API}/api/documents`, { headers:{ Authorization:`Bearer ${localStorage.getItem('gcd_token')}` } }).then(r=>r.json())
      ])
      setEmployees(emps.employees||[])
      setDocuments(docs.documents||[])
    } catch(e) { console.error(e) } finally { setLoading(false) }
  }, [])

  useEffect(()=>{ load() },[load])

  async function handleDelete(id) {
    if (!confirm('Delete this document record?')) return
    await fetch(`${API}/api/documents/${id}`, { method:'DELETE', headers:{ Authorization:`Bearer ${localStorage.getItem('gcd_token')}` } })
    load()
  }

  // Group docs by employee
  const docsByEmp = documents.reduce((acc, d) => {
    if (!acc[d.emp_id]) acc[d.emp_id] = []
    acc[d.emp_id].push(d)
    return acc
  }, {})

  // Stats
  const today       = new Date()
  const expiring60  = documents.filter(d=>d.expires_at&&differenceInDays(parseISO(d.expires_at.slice(0,10)),today)<=60&&differenceInDays(parseISO(d.expires_at.slice(0,10)),today)>=0).length
  const expired     = documents.filter(d=>d.expires_at&&differenceInDays(parseISO(d.expires_at.slice(0,10)),today)<0).length
  const totalDocs   = documents.length

  // Filter employees
  let filteredEmps = employees.filter(e => e.status !== 'inactive')
  if (search) filteredEmps = filteredEmps.filter(e=>e.name.toLowerCase().includes(search.toLowerCase())||e.id.toLowerCase().includes(search.toLowerCase()))
  if (filter==='expiring') filteredEmps = filteredEmps.filter(e=>(docsByEmp[e.id]||[]).some(d=>{const s=expiryStatus(d.expires_at);return s&&s.days<=60}))
  if (filter==='missing')  filteredEmps = filteredEmps.filter(e=>!docsByEmp[e.id]?.length)

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16, animation:'slideUp 0.35s ease' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontWeight:900, fontSize:20, color:'#1A1612', letterSpacing:'-0.03em' }}>Documents</h1>
          <p style={{ fontSize:12, color:'#A89880', marginTop:3 }}>Stored securely on Google Drive · {totalDocs} files</p>
        </div>
        <button onClick={()=>setModal({type:'add',emp:null})} className="btn btn-primary" style={{ borderRadius:24, gap:7 }}>
          <Plus size={15}/> Add Document
        </button>
      </div>

      {/* Stats */}
      <div className="r-grid-3">
        {[
          { l:'Total Files',  v:totalDocs,   c:'#1A1612', bg:'#FAFAF8', bc:'#EAE6DE', icon:'📁' },
          { l:'Expiring Soon',v:expiring60,  c:'#B45309', bg:'#FFFBEB', bc:'#FCD34D', icon:'⏰' },
          { l:'Expired',      v:expired,     c:'#C0392B', bg:'#FEF2F2', bc:'#FCA5A5', icon:'❌' },
        ].map((s,i)=>(
          <div key={s.l} className="stat-card" style={{ padding:'14px 12px', textAlign:'center', background:s.bg, border:`1px solid ${s.bc}`, animationDelay:`${i*0.07}s` }}>
            <div style={{ fontSize:22, marginBottom:5 }}>{s.icon}</div>
            <div style={{ fontWeight:900, fontSize:24, color:s.c, letterSpacing:'-0.04em', lineHeight:1 }}>{s.v}</div>
            <div style={{ fontSize:10.5, color:s.c, fontWeight:600, marginTop:4, opacity:0.8 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Google Drive banner */}
      <div style={{ background:'linear-gradient(135deg,#F0F9FF,#E0F2FE)', border:'1px solid #BAE6FD', borderRadius:14, padding:'14px 18px', display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
        <div style={{ width:36, height:36, borderRadius:10, background:'#FFF', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 8px rgba(0,0,0,0.1)', flexShrink:0 }}>
          <svg width="20" height="18" viewBox="0 0 87.3 78">
            <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
            <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
            <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
            <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
            <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
            <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 27h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
          </svg>
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:700, fontSize:13.5, color:'#0369A1' }}>Powered by Google Drive</div>
          <div style={{ fontSize:12, color:'#0284C7', marginTop:2 }}>Files are stored in your Google Drive. Click "Add Document" → upload to Drive → paste the sharing link.</div>
        </div>
        <a href="https://drive.google.com" target="_blank" rel="noopener noreferrer"
          style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 14px', borderRadius:20, background:'#0369A1', color:'white', fontSize:12, fontWeight:600, textDecoration:'none' }}>
          Open Drive <ExternalLink size={11}/>
        </a>
      </div>

      {/* Search + filter */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ flex:'1 1 200px', position:'relative' }}>
          <Search size={13} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#C4B49A', pointerEvents:'none' }}/>
          <input className="input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search employee…" style={{ paddingLeft:34, borderRadius:20 }}/>
        </div>
        {[{v:'all',l:'All Employees'},{v:'expiring',l:'⏰ Expiring'},{v:'missing',l:'⚠️ No Docs'}].map(f=>(
          <button key={f.v} onClick={()=>setFilter(f.v)}
            style={{ padding:'7px 14px', borderRadius:20, fontSize:12, fontWeight:filter===f.v?700:500, border:`1.5px solid ${filter===f.v?'#B8860B':'#EAE6DE'}`, background:filter===f.v?'#FDF6E3':'#FFF', color:filter===f.v?'#B8860B':'#A89880', cursor:'pointer', transition:'all 0.18s', whiteSpace:'nowrap' }}>
            {f.l}
          </button>
        ))}
        <button onClick={load} style={{ width:34, height:34, borderRadius:'50%', background:'#F5F4F1', border:'1px solid #EAE6DE', color:'#6B5D4A', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <RefreshCw size={14}/>
        </button>
      </div>

      {/* Employee list */}
      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {[1,2,3].map(i=><div key={i} className="skeleton" style={{ height:80, borderRadius:16 }}/>)}
        </div>
      ) : filteredEmps.length === 0 ? (
        <div style={{ textAlign:'center', padding:'50px 20px', color:'#A89880' }}>
          <div style={{ fontSize:40, marginBottom:10 }}>📂</div>
          <div style={{ fontWeight:600, color:'#6B5D4A' }}>{search?`No results for "${search}"`:'No employees found'}</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {filteredEmps.map((emp, i) => {
            const empDocs = docsByEmp[emp.id] || []
            const isOpen  = expanded[emp.id]
            const hasAlert = empDocs.some(d=>{const s=expiryStatus(d.expires_at);return s&&s.days<=60})
            const missing  = empDocs.length === 0

            return (
              <div key={emp.id} style={{ background:'#FFF', border:`1px solid ${hasAlert?'#FCA5A5':missing?'#FCD34D':'#EAE6DE'}`, borderRadius:16, overflow:'hidden', animation:`slideUp 0.4s ${i*0.04}s ease both` }}>
                {/* Employee header */}
                <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', cursor:'pointer' }} onClick={()=>setExpanded(p=>({...p,[emp.id]:!p[emp.id]}))}>
                  <div style={{ width:44, height:44, borderRadius:13, background:'linear-gradient(135deg,#FDF6E3,#FEF3D0)', border:'1.5px solid #F0D78C', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>
                    {emp.avatar||'👤'}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:14, color:'#1A1612' }}>{emp.name}</div>
                    <div style={{ fontSize:11, color:'#A89880', marginTop:1, display:'flex', gap:6, alignItems:'center' }}>
                      <span style={{ fontFamily:'inherit' }}>{emp.id}</span>
                      {emp.station_code && <span style={{ background:'#FDF6E3', color:'#B8860B', fontWeight:700, padding:'1px 6px', borderRadius:5, fontSize:10 }}>{emp.station_code}</span>}
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                    {missing && <span style={{ fontSize:11, color:'#B45309', background:'#FFFBEB', border:'1px solid #FCD34D', borderRadius:20, padding:'3px 9px', fontWeight:600 }}>No docs</span>}
                    {hasAlert && <span style={{ fontSize:11, color:'#C0392B', background:'#FEF2F2', border:'1px solid #FCA5A5', borderRadius:20, padding:'3px 9px', fontWeight:600 }}>⚠️ Alert</span>}
                    {!missing && !hasAlert && <span style={{ fontSize:11, color:'#2E7D52', background:'#ECFDF5', border:'1px solid #A7F3D0', borderRadius:20, padding:'3px 9px', fontWeight:600 }}>{empDocs.length} doc{empDocs.length!==1?'s':''}</span>}
                    <div style={{ color:'#C4B49A', transition:'transform 0.2s', transform:isOpen?'rotate(90deg)':'none' }}>
                      <ChevronRight size={16}/>
                    </div>
                  </div>
                </div>

                {/* Expanded docs */}
                {isOpen && (
                  <div style={{ borderTop:'1px solid #F5F4F1', padding:'12px 14px', background:'#FAFAF8' }}>
                    {empDocs.length > 0 ? (
                      <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:10 }}>
                        {empDocs.map(doc=>(
                          <DocCard key={doc.id} doc={doc} onDelete={handleDelete}/>
                        ))}
                      </div>
                    ) : (
                      <div style={{ textAlign:'center', padding:'16px 0', color:'#A89880', fontSize:13 }}>No documents uploaded yet</div>
                    )}
                    <button onClick={()=>setModal({type:'add',emp})}
                      style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:20, background:'linear-gradient(135deg,#FDF6E3,#FEF9F0)', border:'1.5px dashed #D4A017', color:'#B8860B', fontSize:12, fontWeight:700, cursor:'pointer', width:'100%', justifyContent:'center', transition:'background 0.2s' }}>
                      <Plus size={13}/> Add Document for {emp.name.split(' ')[0]}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {modal?.type==='add' && (
        <DocModal
          emp={modal.emp}
          employees={employees}
          onClose={()=>setModal(null)}
          onSave={()=>{ setModal(null); load() }}
        />
      )}
    </div>
  )
}