'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth'
import { API, empApi } from '@/lib/api'
import { useStation, hdr, POCHeader } from '../_components/poc-shared'
import { CalendarOff, History, Calendar, Plus } from 'lucide-react'
import NewLeaveModal from '@/components/leaves/NewLeaveModal'

export default function LeavesPage() {
  const { user } = useAuth()
  const { station, setStation, canSwitch } = useStation(user)
  const [leaves,          setLeaves]          = useState([])
  const [employees,       setEmployees]       = useState([])
  const [loading,         setLoading]         = useState(true)
  const [showHistory,     setShowHistory]      = useState(false)
  const [modal,           setModal]           = useState(false)
  const canAddLeave = user?.role === 'admin' || user?.role === 'general_manager'

  const load = useCallback(async () => {
    setLoading(true)
    const h = { headers: { Authorization: `Bearer ${localStorage.getItem('gcd_token')}` } }
    try {
      const lv = await fetch(`${API}/api/leaves?stage=all`, h).then(r => r.json())
      setLeaves(lv.leaves||[])
      if (canAddLeave) empApi.list().then(d => setEmployees(d.employees||[])).catch(() => {})
    } catch(e) { console.error(e) } finally { setLoading(false) }
  }, [canAddLeave])

  useEffect(() => { load() }, [load])

  async function handleLeave(id, status) {
    await fetch(`${API}/api/leaves/${id}/status`, { method:'PATCH', headers:hdr(), body:JSON.stringify({ status }) })
    load()
  }

  const pendingLeaves  = leaves.filter(l => l.poc_status === 'pending')
  const historyLeaves  = leaves.filter(l => l.poc_status !== 'pending')
  const displayed      = showHistory ? historyLeaves : pendingLeaves

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14, animation:'slideUp 0.3s ease' }}>
      <POCHeader
        title="Leave Requests" icon={CalendarOff} color="#EF4444"
        station={station} onStationChange={setStation} canSwitch={canSwitch}
        showDate={false}
        subtitle={`${pendingLeaves.length} pending · ${historyLeaves.length} reviewed`}
      />

      {/* Toggle */}
      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
        <div style={{ display:'flex', gap:6, background:'var(--bg-alt)', borderRadius:14, padding:4, flex:1 }}>
          <button onClick={() => setShowHistory(false)}
            style={{ flex:1, padding:'9px 12px', borderRadius:11, border:'none', cursor:'pointer', fontWeight:600, fontSize:12.5, transition:'all 0.2s', background:!showHistory?'var(--card)':'transparent', color:!showHistory?'#EF4444':'var(--text-muted)', boxShadow:!showHistory?'0 1px 4px rgba(0,0,0,0.1)':'none', fontFamily:'inherit' }}>
            Pending Review ({pendingLeaves.length})
          </button>
          <button onClick={() => setShowHistory(true)}
            style={{ flex:1, padding:'9px 12px', borderRadius:11, border:'none', cursor:'pointer', fontWeight:600, fontSize:12.5, transition:'all 0.2s', display:'flex', alignItems:'center', justifyContent:'center', gap:5, background:showHistory?'var(--card)':'transparent', color:showHistory?'#EF4444':'var(--text-muted)', boxShadow:showHistory?'0 1px 4px rgba(0,0,0,0.1)':'none', fontFamily:'inherit' }}>
            <History size={13}/> History ({historyLeaves.length})
          </button>
        </div>
        {canAddLeave && (
          <button className="btn btn-primary btn-sm" onClick={() => setModal(true)} style={{ borderRadius:20, flexShrink:0 }}>
            <Plus size={13}/> New Request
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height:100, borderRadius:16 }}/>)}
        </div>
      ) : displayed.length===0 ? (
        <div style={{ textAlign:'center', padding:50, color:'var(--text-muted)' }}>
          <CalendarOff size={36} style={{ margin:'0 auto 12px', display:'block', opacity:0.15 }}/>
          <div style={{ fontSize:13, fontWeight:600 }}>{showHistory ? 'No leave history yet' : 'No pending leave requests'}</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {displayed.map((l, i) => {
            const isApproved = l.status==='approved'
            const isRejected = l.status==='rejected'
            return (
              <div key={l.id} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, overflow:'hidden', animation:`slideUp 0.3s ${i*0.05}s ease both` }}>
                <div style={{ padding:'14px 16px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:20 }}>{l.avatar||'👤'}</span>
                      <div>
                        <div style={{ fontWeight:700, fontSize:14, color:'var(--text)' }}>{l.name}</div>
                        <div style={{ fontSize:11, color:'#B8860B', fontWeight:600 }}>{l.type} Leave</div>
                      </div>
                    </div>
                    {showHistory ? (
                      <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, color:isApproved?'#10B981':isRejected?'#EF4444':'#B45309', background:isApproved?'#ECFDF5':isRejected?'#FEF2F2':'#FFFBEB', border:`1px solid ${isApproved?'#A7F3D0':isRejected?'#FECACA':'#FCD34D'}` }}>
                        {isApproved?'Approved':isRejected?'Rejected':'Pending'}
                      </span>
                    ) : (
                      <span style={{ fontSize:11, fontWeight:700, color:'#3B82F6', background:'#EFF6FF', border:'1px solid #BFDBFE', padding:'3px 10px', borderRadius:20 }}>Awaiting Review</span>
                    )}
                  </div>
                  <div style={{ display:'flex', gap:6, alignItems:'center', fontSize:12, color:'var(--text-muted)', marginBottom:l.reason?8:0 }}>
                    <Calendar size={12}/> {l.from_date?.slice(0,10)} → {l.to_date?.slice(0,10)} · <strong>{l.days} day{l.days!==1?'s':''}</strong>
                  </div>
                  {l.reason && <div style={{ fontSize:12, color:'var(--text-muted)', padding:'7px 10px', background:'var(--bg-alt)', borderRadius:8 }}>{l.reason}</div>}
                  {showHistory && l.updated_at && (
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:6 }}>
                      Actioned: {new Date(l.updated_at).toLocaleString('en-AE',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
                    </div>
                  )}
                </div>
                {!showHistory && (
                  <div style={{ background:'linear-gradient(135deg,#EFF6FF,#DBEAFE)', borderTop:'1px solid #BFDBFE', padding:'10px 16px', display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                    <span style={{ fontSize:12, color:'#3B82F6', fontWeight:700, flex:1 }}>Awaiting your review</span>
                    <button onClick={() => handleLeave(l.id,'approved')} style={{ padding:'7px 18px', borderRadius:20, background:'linear-gradient(135deg,#10B981,#22C55E)', border:'none', color:'white', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>Approve</button>
                    <button onClick={() => handleLeave(l.id,'rejected')} style={{ padding:'7px 18px', borderRadius:20, background:'#FEF2F2', border:'1px solid #FCA5A5', color:'#EF4444', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>Reject</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {modal && <NewLeaveModal employees={employees} onSave={() => { setModal(false); load() }} onClose={() => setModal(false)}/>}
    </div>
  )
}
