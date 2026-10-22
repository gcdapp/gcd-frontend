'use client'
import { useState, useEffect } from 'react'
import { complianceApi } from '@/lib/api'
import { differenceInDays, parseISO } from 'date-fns'
import { ShieldCheck, AlertTriangle, CheckCircle, Plus, Download, X, Check, FileWarning } from 'lucide-react'

function insStatus(expiry) {
  const d = differenceInDays(parseISO(expiry.slice(0,10)), new Date())
  if (d < 0)   return { label:'Expired',     cls:'badge-danger',  color:'#C0392B', bc:'#FCA5A5' }
  if (d <= 30) return { label:`${d}d left`,  cls:'badge-danger',  color:'#C0392B', bc:'#FCA5A5' }
  if (d <= 90) return { label:`${d}d left`,  cls:'badge-warning', color:'#B45309', bc:'#FCD34D' }
  return             { label:'Active',        cls:'badge-success', color:'#2E7D52', bc:'#A7F3D0' }
}
const FINE_STATUS = { paid:{l:'Paid',c:'badge-success'}, pending:{l:'Pending',c:'badge-warning'}, disputed:{l:'Disputed',c:'badge-info'} }
const SRC_COLORS  = { Amazon:'#FF9900', iMile:'#E85C4C', Noon:'#8F6807', Internal:'#6B5D4A', Traffic:'#7C3AED' }

function StatPill({ label, value, color, bg, bc, delay }) {
  return (
    <div style={{ background:bg, border:`1px solid ${bc}`, borderRadius:14, padding:'18px 20px', animation:`slideUp 0.35s ${delay}s ease both` }}>
      <div style={{ fontWeight:800, fontSize:26, color, letterSpacing:'-0.04em', marginBottom:4 }}>{value}</div>
      <div style={{ fontSize:12, color, fontWeight:600, opacity:0.8 }}>{label}</div>
    </div>
  )
}

export default function CompliancePage() {
  const [tab,      setTab]    = useState('insurance')
  const [policies, setPolicies] = useState([])
  const [fines,    setFines]  = useState([])
  const [loading,  setLoading]= useState(true)
  const [fineFilter, setFineFilter] = useState('All')

  useEffect(() => {
    Promise.all([complianceApi.insurance(), complianceApi.fines()])
      .then(([ins, fin]) => { setPolicies(ins.policies); setFines(fin.fines) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  async function setFineStatus(id, status) {
    try {
      const d = await complianceApi.setFineStatus(id, { status, paid_on: status==='paid' ? new Date().toISOString().slice(0,10) : null })
      setFines(p => p.map(x => x.id===d.fine.id ? {...x,...d.fine} : x))
    } catch(e) { alert(e.message) }
  }

  const insExpired  = policies.filter(p => differenceInDays(parseISO(p.expiry.slice(0,10)), new Date()) < 0).length
  const insExpiring = policies.filter(p => { const d=differenceInDays(parseISO(p.expiry.slice(0,10)),new Date()); return d>=0&&d<=90 }).length
  const insActive   = policies.filter(p => differenceInDays(parseISO(p.expiry.slice(0,10)), new Date()) > 90).length
  const insTotal    = policies.reduce((s,p)=>s+Number(p.premium),0)

  const finePending = fines.filter(f=>f.status==='pending').reduce((s,f)=>s+Number(f.amount),0)
  const finePaid    = fines.filter(f=>f.status==='paid').reduce((s,f)=>s+Number(f.amount),0)
  const fineTotal   = fines.reduce((s,f)=>s+Number(f.amount),0)
  const filteredFines = fineFilter==='All' ? fines : fines.filter(f=>f.status===fineFilter.toLowerCase())
  const pendingCount  = fines.filter(f=>f.status==='pending').length

  if (loading) return <div style={{ padding:60, textAlign:'center', color:'#78716C' }}>Loading…</div>

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20, animation:'slideUp 0.35s ease' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#ECFDF5,#D1FAE5)', border:'1px solid #A7F3D0', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <ShieldCheck size={18} color="#2E7D52"/>
          </div>
          <div>
            <div className="page-title">Compliance</div>
            <div className="page-sub">Insurance policies, ILOE fines & regulatory tracking</div>
          </div>
        </div>
        <button className="btn btn-secondary btn-sm"><Download size={13}/> Export Report</button>
      </div>

      <div className="tabs" style={{ alignSelf:'flex-start' }}>
        <button className={`tab${tab==='insurance'?' active':''}`} onClick={()=>setTab('insurance')}>
          🛡️ Insurance {(insExpired+insExpiring)>0&&<span style={{ background:'#C0392B', color:'#fff', borderRadius:10, padding:'1px 6px', fontSize:10, fontWeight:700, marginLeft:4 }}>{insExpired+insExpiring}</span>}
        </button>
        <button className={`tab${tab==='fines'?' active':''}`} onClick={()=>setTab('fines')}>
          ⚠️ ILOE Fines {pendingCount>0&&<span style={{ background:'#B45309', color:'#fff', borderRadius:10, padding:'1px 6px', fontSize:10, fontWeight:700, marginLeft:4 }}>{pendingCount}</span>}
        </button>
      </div>

      {/* Insurance */}
      {tab==='insurance' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div className="four-kpi-grid">
            <StatPill label="Active"         value={insActive}                      color="#2E7D52" bg="#ECFDF5" bc="#A7F3D0" delay={0.05}/>
            <StatPill label="Expiring Soon"  value={insExpiring}                    color="#B45309" bg="#FFFBEB" bc="#FCD34D" delay={0.10}/>
            <StatPill label="Expired"        value={insExpired}                     color="#C0392B" bg="#FEF2F2" bc="#FCA5A5" delay={0.15}/>
            <StatPill label="Annual Premium" value={`AED ${insTotal.toLocaleString()}`} color="#8F6807" bg="#FDF6E3" bc="#F0D78C" delay={0.20}/>
          </div>
          {(insExpired+insExpiring)>0 && (
            <div style={{ background:'#FEF2F2', border:'1px solid #FCA5A5', borderRadius:12, padding:'14px 18px', display:'flex', gap:12, alignItems:'center' }}>
              <AlertTriangle size={18} color="#C0392B"/>
              <div style={{ fontSize:13.5, fontWeight:600, color:'#C0392B' }}>{insExpired+insExpiring} policies require renewal action</div>
            </div>
          )}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:12 }}>
            {policies.map((p,i) => {
              const st = insStatus(p.expiry)
              const d  = differenceInDays(parseISO(p.expiry.slice(0,10)), new Date())
              return (
                <div key={p.id} className="card" style={{ padding:'16px 18px', animation:`slideUp 0.3s ${i*0.04}s ease both` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:14, color:'#1A1612' }}>{p.type} Insurance</div>
                      <div style={{ fontSize:11.5, color:'#78716C', marginTop:2 }}>{p.provider}</div>
                    </div>
                    <span className={`badge ${st.cls}`}>{st.label}</span>
                  </div>
                  {p.emp_name && (
                    <div style={{ fontSize:12, color:'#6B5D4A', marginBottom:10, padding:'6px 10px', background:'#FAFAF8', borderRadius:8, border:'1px solid #EAE6DE' }}>
                      👤 {p.emp_name} · {p.emp_role}
                    </div>
                  )}
                  {!p.emp_id && <div style={{ fontSize:12, color:'#6B5D4A', marginBottom:10, padding:'6px 10px', background:'#FAFAF8', borderRadius:8, border:'1px solid #EAE6DE' }}>📋 {p.coverage}</div>}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, fontSize:11.5, marginBottom:12 }}>
                    {[['Policy No.',p.policy_no],['Premium',`AED ${Number(p.premium).toLocaleString()}/yr`],['Start',p.start_date?.slice(0,10)],['Expiry',p.expiry?.slice(0,10)]].map(([l,v])=>(
                      <div key={l}><div style={{ color:'#C4B49A', fontSize:10, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:1 }}>{l}</div><div style={{ color:'#1A1612', fontWeight:600, fontSize:12 }}>{v}</div></div>
                    ))}
                  </div>
                  {d>0&&d<=365&&<div style={{ marginBottom:10 }}><div className="progress-bar"><div style={{ height:'100%', borderRadius:3, background:`linear-gradient(90deg,${st.color},${st.color}99)`, width:`${Math.min((d/365)*100,100)}%`, transition:'width 0.7s' }}/></div></div>}
                  <button className="btn btn-secondary btn-sm" style={{ width:'100%', justifyContent:'center', fontSize:11.5 }}>Renew / View Policy</button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Fines */}
      {tab==='fines' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div className="r-grid-3">
            <StatPill label="Total Fines"     value={`AED ${fineTotal.toLocaleString()}`}   color="#1A1612" bg="#F5F4F1" bc="#EAE6DE" delay={0.05}/>
            <StatPill label="Pending Payment" value={`AED ${finePending.toLocaleString()}`} color="#B45309" bg="#FFFBEB" bc="#FCD34D" delay={0.10}/>
            <StatPill label="Settled"         value={`AED ${finePaid.toLocaleString()}`}    color="#2E7D52" bg="#ECFDF5" bc="#A7F3D0" delay={0.15}/>
          </div>
          <div style={{ background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:12, padding:'13px 16px', display:'flex', gap:10 }}>
            <FileWarning size={17} color="#1D6FA4" style={{ flexShrink:0, marginTop:2 }}/>
            <div style={{ fontSize:12.5, color:'#1D6FA4', fontWeight:500, lineHeight:1.5 }}>ILOE fines include partner-imposed penalties from Amazon, iMile, and Noon for SLA breaches, damage claims, and compliance violations. Resolve within 30 days.</div>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10 }}>
            <div className="tabs">
              {['All','Pending','Paid','Disputed'].map(f=>(
                <button key={f} className={`tab${fineFilter===f?' active':''}`} onClick={()=>setFineFilter(f)}>
                  {f}{f==='Pending'&&pendingCount>0?` (${pendingCount})`:''}
                </button>
              ))}
            </div>
            <button className="btn btn-primary btn-sm"><Plus size={13}/> Log Fine</button>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {filteredFines.map((fine,i) => {
              const sc = SRC_COLORS[fine.source]||'#6B5D4A'
              return (
                <div key={fine.id} className="card" style={{ padding:'15px 18px', animation:`slideUp 0.3s ${i*0.05}s ease both` }}>
                  <div style={{ display:'flex', gap:14, alignItems:'flex-start', flexWrap:'wrap' }}>
                    <div style={{ width:40, height:40, borderRadius:10, background:'#FDF6E3', border:'1px solid #F0D78C', display:'flex', alignItems:'center', justifyContent:'center', fontSize:19, flexShrink:0 }}>
                      {fine.avatar||'📋'}
                    </div>
                    <div style={{ flex:1, minWidth:180 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5, flexWrap:'wrap' }}>
                        <span style={{ fontWeight:700, color:'#1A1612', fontSize:14 }}>{fine.emp_name||'General'}</span>
                        <span style={{ fontSize:11, padding:'2px 8px', borderRadius:6, background:`${sc}18`, color:sc, fontWeight:700, border:`1px solid ${sc}35` }}>{fine.source}</span>
                        <span className={`badge ${FINE_STATUS[fine.status]?.c}`}>{FINE_STATUS[fine.status]?.l}</span>
                      </div>
                      <div style={{ fontSize:13, color:'#6B5D4A', fontWeight:500, marginBottom:5 }}>{fine.violation}</div>
                      <div style={{ display:'flex', gap:12, flexWrap:'wrap', fontSize:11.5, color:'#78716C' }}>
                        <span>📅 {fine.date?.slice(0,10)}</span>
                        {fine.reference&&<span style={{ fontFamily:'inherit' }}>Ref: {fine.reference}</span>}
                        {fine.paid_on&&<span style={{ color:'#2E7D52' }}>✓ Settled {fine.paid_on?.slice(0,10)}</span>}
                      </div>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8, flexShrink:0 }}>
                      <div style={{ fontWeight:800, fontSize:18, color:fine.status==='paid'?'#2E7D52':'#C0392B', letterSpacing:'-0.03em' }}>
                        AED {Number(fine.amount).toLocaleString()}
                      </div>
                      {fine.status==='pending'&&(
                        <div style={{ display:'flex', gap:6 }}>
                          <button className="btn btn-success btn-sm" onClick={()=>setFineStatus(fine.id,'paid')}><Check size={12}/> Mark Paid</button>
                          <button className="btn btn-secondary btn-sm" onClick={()=>setFineStatus(fine.id,'disputed')}>Dispute</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
            {filteredFines.length===0&&<div className="empty-state"><CheckCircle size={28} color="#A7F3D0"/><p>No {fineFilter.toLowerCase()!=='all'?fineFilter.toLowerCase():''} fines</p></div>}
          </div>
        </div>
      )}
    </div>
  )
}
