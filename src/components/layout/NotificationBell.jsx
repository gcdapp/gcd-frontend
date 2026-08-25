'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Bell, X, AlertTriangle, Users, Truck, RefreshCw } from 'lucide-react'
import { API } from '@/lib/api'

const SEV = {
  expired:  { c:'#C0392B', bg:'#FEF2F2', bc:'#FCA5A5', label:'Expired'  },
  critical: { c:'#D97706', bg:'#FFFBEB', bc:'#FDE68A', label:'Critical' },
  warning:  { c:'#1D6FA4', bg:'#EFF6FF', bc:'#BFDBFE', label:'Expiring' },
}

function AlertItem({ item }) {
  const sev = SEV[item.severity] || SEV.warning
  const abs = Math.abs(item.days)
  return (
    <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)', display:'flex', gap:10, alignItems:'center' }}>
      <div style={{ width:36, height:36, borderRadius:10, background:sev.bg, border:`1px solid ${sev.bc}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        <AlertTriangle size={15} color={sev.c}/>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:700, fontSize:12.5, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.name}</div>
        <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>
          {item.label} · <span style={{ fontWeight:600 }}>{item.date?.slice(0,10)}</span>
          {item.station_code && <span style={{ marginLeft:5, color:'#B8860B', fontWeight:600 }}>{item.station_code}</span>}
        </div>
      </div>
      <div style={{ textAlign:'right', flexShrink:0 }}>
        <span style={{ fontSize:10.5, fontWeight:700, color:sev.c, background:sev.bg, border:`1px solid ${sev.bc}`, borderRadius:20, padding:'2px 8px', display:'block' }}>{sev.label}</span>
        <span style={{ fontSize:10, color:sev.c, fontWeight:600, marginTop:3, display:'block' }}>
          {item.days < 0 ? `${abs}d ago` : `${abs}d left`}
        </span>
      </div>
    </div>
  )
}

function TaskNotifItem({ n }) {
  const isReminder = n.title?.startsWith('⏰')
  return (
    <a href="/dashboard/tasks" style={{
      display:'flex', gap:10, padding:'12px 14px',
      borderBottom:'1px solid var(--border)', alignItems:'flex-start',
      textDecoration:'none',
      background: n.read ? 'transparent' : 'rgba(184,134,11,0.05)',
      transition:'background 0.15s',
    }}
      onMouseEnter={e=>e.currentTarget.style.background='var(--bg-alt)'}
      onMouseLeave={e=>e.currentTarget.style.background=n.read?'transparent':'rgba(184,134,11,0.05)'}
    >
      <div style={{
        width:36, height:36, borderRadius:10, flexShrink:0,
        background: isReminder ? '#FFFBEB' : '#EFF6FF',
        border: `1px solid ${isReminder ? '#FDE68A' : '#BFDBFE'}`,
        display:'flex', alignItems:'center', justifyContent:'center', fontSize:17,
      }}>
        {isReminder ? '⏰' : '📋'}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight: n.read ? 600 : 800, fontSize:12.5, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {n.title}
        </div>
        {n.body && (
          <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {n.body}
          </div>
        )}
        <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:3 }}>
          {new Date(n.created_at).toLocaleString('en-AE',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
        </div>
      </div>
      {!n.read && (
        <div style={{ width:7, height:7, borderRadius:'50%', background:'#C0392B', flexShrink:0, marginTop:6 }}/>
      )}
    </a>
  )
}

export default function NotificationBell({ userRole }) {
  const isDocRole = ['admin','general_manager','manager'].includes(userRole)

  const [open,        setOpen]        = useState(false)
  const [tab,         setTab]         = useState(isDocRole ? 'drivers' : 'tasks')
  const [docData,     setDocData]     = useState(null)
  const [docLoading,  setDocLoading]  = useState(false)
  const [taskNotifs,  setTaskNotifs]  = useState([])
  const [taskLoading, setTaskLoading] = useState(false)
  const ref = useRef(null)

  const fetchDocAlerts = useCallback(async () => {
    if (!isDocRole) return
    setDocLoading(true)
    try {
      const res = await fetch(`${API}/api/notifications/alerts`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('gcd_token')}` }
      })
      if (res.ok) {
        const json = await res.json()
        setDocData(json)
        // Auto-push once per day for expired/critical
        const expired  = json.alerts?.filter(a => a.severity === 'expired').length  || 0
        const critical = json.alerts?.filter(a => a.severity === 'critical').length || 0
        if ((expired + critical) > 0) {
          const today = new Date().toISOString().slice(0, 10)
          if (localStorage.getItem('gcd_last_doc_push') !== today) {
            localStorage.setItem('gcd_last_doc_push', today)
            fetch(`${API}/api/notifications/push-critical`, {
              method: 'POST',
              headers: { 'Content-Type':'application/json', Authorization:`Bearer ${localStorage.getItem('gcd_token')}` },
              body: JSON.stringify({ expiredCount: expired, criticalCount: critical }),
            }).catch(() => {})
          }
        }
      }
    } catch {}
    setDocLoading(false)
  }, [isDocRole])

  const fetchTaskNotifs = useCallback(async () => {
    setTaskLoading(true)
    try {
      const res = await fetch(`${API}/api/notifications`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('gcd_token')}` }
      })
      if (res.ok) {
        const json = await res.json()
        setTaskNotifs((json.notifications || []).filter(n => n.type === 'task'))
      }
    } catch {}
    setTaskLoading(false)
  }, [])

  const markTasksRead = useCallback(async () => {
    const hasUnread = taskNotifs.some(n => !n.read)
    if (!hasUnread) return
    try {
      await fetch(`${API}/api/notifications/read-all`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${localStorage.getItem('gcd_token')}` }
      })
      setTaskNotifs(p => p.map(n => ({ ...n, read: true })))
    } catch {}
  }, [taskNotifs])

  useEffect(() => {
    fetchDocAlerts()
    fetchTaskNotifs()
    // Poll for new task notifications every 5 minutes
    const interval = setInterval(fetchTaskNotifs, 5 * 60 * 1000)
    function close(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => {
      clearInterval(interval)
      document.removeEventListener('mousedown', close)
    }
  }, [fetchDocAlerts, fetchTaskNotifs])

  function handleOpen() {
    const next = !open
    setOpen(next)
    if (next) {
      if (isDocRole) fetchDocAlerts()
      fetchTaskNotifs()
    }
  }

  function handleTaskTab() {
    setTab('tasks')
    markTasksRead()
  }

  if (!userRole || userRole === 'driver') return null

  const docCount    = docData?.total || 0
  const unreadTasks = taskNotifs.filter(n => !n.read).length
  const totalBadge  = (isDocRole ? docCount : 0) + unreadTasks
  const urgentDocs  = docData?.alerts?.filter(a => a.severity !== 'warning').length || 0

  const TabBtn = ({ id, children, count, urgent }) => (
    <button onClick={() => id === 'tasks' ? handleTaskTab() : setTab(id)} style={{
      flex:1, padding:'10px 6px', border:'none',
      background: tab === id ? 'var(--bg-alt)' : 'transparent',
      borderBottom: `2px solid ${tab === id ? '#B8860B' : 'transparent'}`,
      color: tab === id ? '#B8860B' : 'var(--text-muted)',
      fontWeight:700, fontSize:11, cursor:'pointer',
      fontFamily:'Poppins,sans-serif',
      display:'flex', alignItems:'center', justifyContent:'center', gap:4,
      transition:'all 0.15s',
    }}>
      {children}
      {count > 0 && (
        <span style={{
          background: tab === id ? (urgent ? '#C0392B' : '#B8860B') : 'var(--border)',
          color: tab === id ? 'white' : 'var(--text-muted)',
          borderRadius:20, padding:'1px 5px', fontSize:9, fontWeight:800,
        }}>{count}</span>
      )}
    </button>
  )

  return (
    <div ref={ref} style={{ position:'relative', flexShrink:0 }}>
      <button
        onClick={handleOpen}
        className="btn btn-ghost btn-icon"
        title="Notifications"
        style={{ color:'var(--text-sub)', position:'relative' }}>
        <Bell size={17}/>
        {totalBadge > 0 && (
          <span style={{
            position:'absolute', top:3, right:3,
            minWidth:15, height:15, borderRadius:8,
            background: (urgentDocs > 0 || unreadTasks > 0) ? '#C0392B' : '#B8860B',
            color:'white', fontSize:8.5, fontWeight:800,
            display:'flex', alignItems:'center', justifyContent:'center',
            padding:'0 3px', lineHeight:1, boxShadow:'0 0 0 2px var(--bg)',
          }}>
            {totalBadge > 99 ? '99+' : totalBadge}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position:'fixed', top:58, right:12,
          width:360, maxHeight:'75vh',
          background:'var(--card)', border:'1px solid var(--border)',
          borderRadius:16, boxShadow:'0 8px 32px rgba(0,0,0,0.16)',
          zIndex:9999, display:'flex', flexDirection:'column',
          overflow:'hidden', animation:'slideUp 0.2s ease',
        }}>
          {/* Header */}
          <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <Bell size={14} color="#B8860B"/>
              <span style={{ fontWeight:800, fontSize:14, color:'var(--text)' }}>Notifications</span>
              {totalBadge > 0 && (
                <span style={{ fontSize:10.5, fontWeight:700, background:'#FEF2F2', color:'#C0392B', border:'1px solid #FCA5A5', borderRadius:20, padding:'1px 8px' }}>
                  {totalBadge}
                </span>
              )}
            </div>
            <div style={{ display:'flex', gap:4 }}>
              <button onClick={() => { if (isDocRole) fetchDocAlerts(); fetchTaskNotifs() }} className="btn btn-ghost btn-icon" style={{ width:28, height:28 }} title="Refresh">
                <RefreshCw size={12} style={{ animation: (docLoading || taskLoading) ? 'spin 1s linear infinite' : 'none' }}/>
              </button>
              <button onClick={() => setOpen(false)} className="btn btn-ghost btn-icon" style={{ width:28, height:28 }}>
                <X size={13}/>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display:'flex', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
            {isDocRole && (
              <>
                <TabBtn id="drivers" count={(docData?.drivers||[]).length} urgent={urgentDocs > 0}>
                  <Truck size={11}/> Drivers
                </TabBtn>
                <TabBtn id="staff" count={(docData?.staff||[]).length} urgent={urgentDocs > 0}>
                  <Users size={11}/> Staff
                </TabBtn>
              </>
            )}
            <TabBtn id="tasks" count={unreadTasks} urgent={unreadTasks > 0}>
              📋 Tasks
            </TabBtn>
          </div>

          {/* Content */}
          <div style={{ overflowY:'auto', flex:1 }}>

            {/* Document alert tabs (admin/manager only) */}
            {(tab === 'drivers' || tab === 'staff') && isDocRole && (() => {
              if (docLoading) return <div style={{ padding:'30px 20px', textAlign:'center', color:'var(--text-muted)', fontSize:12 }}>Loading…</div>
              const list = tab === 'drivers' ? (docData?.drivers||[]) : (docData?.staff||[])
              if (list.length === 0) return (
                <div style={{ padding:'40px 20px', textAlign:'center', color:'var(--text-muted)' }}>
                  <Bell size={30} style={{ margin:'0 auto 10px', display:'block', opacity:0.15 }}/>
                  <div style={{ fontWeight:700, fontSize:13, color:'var(--text-sub)' }}>All clear</div>
                  <div style={{ fontSize:11, marginTop:4 }}>No {tab === 'drivers' ? 'driver' : 'staff'} document alerts</div>
                </div>
              )
              const exp  = list.filter(a=>a.severity==='expired').length
              const crit = list.filter(a=>a.severity==='critical').length
              const warn = list.filter(a=>a.severity==='warning').length
              return (
                <>
                  <div style={{ display:'flex', gap:6, padding:'10px 14px', background:'var(--bg-alt)', borderBottom:'1px solid var(--border)', flexWrap:'wrap' }}>
                    {exp  > 0 && <span style={{ fontSize:10.5, fontWeight:700, color:'#C0392B', background:'#FEF2F2', border:'1px solid #FCA5A5', borderRadius:20, padding:'2px 9px' }}>🔴 {exp} Expired</span>}
                    {crit > 0 && <span style={{ fontSize:10.5, fontWeight:700, color:'#D97706', background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:20, padding:'2px 9px' }}>🟠 {crit} Critical</span>}
                    {warn > 0 && <span style={{ fontSize:10.5, fontWeight:700, color:'#1D6FA4', background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:20, padding:'2px 9px' }}>🔵 {warn} Expiring</span>}
                  </div>
                  {list.map((item, i) => <AlertItem key={i} item={item}/>)}
                </>
              )
            })()}

            {/* Tasks tab */}
            {tab === 'tasks' && (
              taskLoading ? (
                <div style={{ padding:'30px 20px', textAlign:'center', color:'var(--text-muted)', fontSize:12 }}>Loading…</div>
              ) : taskNotifs.length === 0 ? (
                <div style={{ padding:'40px 20px', textAlign:'center', color:'var(--text-muted)' }}>
                  <div style={{ fontSize:32, marginBottom:10 }}>📋</div>
                  <div style={{ fontWeight:700, fontSize:13, color:'var(--text-sub)' }}>No task notifications</div>
                  <div style={{ fontSize:11, marginTop:4 }}>You&apos;re all caught up</div>
                </div>
              ) : (
                taskNotifs.map(n => <TaskNotifItem key={n.id} n={n}/>)
              )
            )}
          </div>

          {/* Footer */}
          {tab === 'tasks' && taskNotifs.length > 0 && (
            <div style={{ padding:'10px 14px', borderTop:'1px solid var(--border)', flexShrink:0 }}>
              <a href="/dashboard/tasks" style={{ fontSize:11.5, fontWeight:700, color:'#B8860B', textDecoration:'none', display:'flex', alignItems:'center', gap:4 }}>
                View all tasks →
              </a>
            </div>
          )}
          {(tab === 'drivers' || tab === 'staff') && (docData?.total || 0) > 0 && (
            <div style={{ padding:'10px 14px', borderTop:'1px solid var(--border)', flexShrink:0 }}>
              <a href="/dashboard/hr/compliance" style={{ fontSize:11.5, fontWeight:700, color:'#B8860B', textDecoration:'none', display:'flex', alignItems:'center', gap:4 }}>
                View all expiring documents →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
