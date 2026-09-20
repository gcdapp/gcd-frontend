'use client'
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { empApi } from '@/lib/api'
import { Plus, Calendar, ChevronRight, AlertCircle, Search } from 'lucide-react'
import NewLeaveModal from '@/components/leaves/NewLeaveModal'

const TYPE_COLORS = { Annual:'#B8860B', Sick:'#1D6FA4', Emergency:'#C0392B', Unpaid:'#6B5D4A', Other:'#A89880' }
const TYPES = ['Annual','Sick','Emergency','Unpaid','Other']
import { API } from '@/lib/api'
function hdr() { return { 'Content-Type':'application/json', Authorization:`Bearer ${localStorage.getItem('gcd_token')}` } }

function StageChip({ label, status }) {
  const cfg = {
    approved: { c:'#2E7D52', bg:'#ECFDF5', bc:'#A7F3D0' },
    rejected: { c:'#C0392B', bg:'#FEF2F2', bc:'#FCA5A5' },
    pending:  { c:'#1D6FA4', bg:'#EFF6FF', bc:'#BFDBFE' },
    waiting:  { c:'#A89880', bg:'#F5F4F1', bc:'#EAE6DE' },
  }[status] || { c:'#A89880', bg:'#F5F4F1', bc:'#EAE6DE' }
  return (
    <div style={{ textAlign:'center', padding:'5px 10px', borderRadius:8, background:cfg.bg, border:`1px solid ${cfg.bc}` }}>
      <div style={{ fontSize:9.5, color:cfg.c, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</div>
      <div style={{ fontSize:11, color:cfg.c, fontWeight:800, marginTop:1 }}>{status}</div>
    </div>
  )
}

function LeaveRow({ l, i, userRole, action }) {
  return (
    <div style={{ background:'#FFF', border:'1px solid #EAE6DE', borderRadius:16, overflow:'hidden', animation:`slideUp 0.3s ${Math.min(i,8)*0.04}s ease both` }}>
      <div style={{ padding:'14px 16px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:8, marginBottom:10 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
              <span style={{ fontWeight:700, fontSize:14, color:'#1A1612' }}>{l.name}</span>
              <span style={{ fontSize:11, fontWeight:700, color:TYPE_COLORS[l.type]||'#6B5D4A', background:`${TYPE_COLORS[l.type]||'#6B5D4A'}15`, padding:'2px 9px', borderRadius:6 }}>{l.type}</span>
              {l.station_code && <span style={{ fontSize:10.5, fontWeight:700, color:'#B8860B', background:'#FDF6E3', borderRadius:5, padding:'1px 6px' }}>{l.station_code}</span>}
            </div>
            <div style={{ fontSize:12, color:'#A89880', display:'flex', alignItems:'center', gap:5 }}>
              <Calendar size={11}/> {l.from_date} → {l.to_date} · <strong style={{ color:'#6B5D4A' }}>{l.days} days</strong>
            </div>
            {l.reason && <div style={{ fontSize:12, color:'#6B5D4A', marginTop:4 }}>{l.reason}</div>}
          </div>
          {/* 2-stage pipeline: POC, then final approval (Admin/GM) */}
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            <StageChip label={l.poc_approver_name   || 'POC'}     status={l.poc_status||'pending'}/>
            <StageChip label={l.admin_approver_name || 'Manager'} status={l.mgr_status||'waiting'}/>
          </div>
        </div>
      </div>

      {/* POC action bar */}
      {userRole==='poc' && l.poc_status==='pending' && (
        <div style={{ background:'linear-gradient(135deg,#EFF6FF,#DBEAFE)', borderTop:'1px solid #BFDBFE', padding:'10px 16px', display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <span style={{ fontSize:12, color:'#1D6FA4', fontWeight:700, flex:1 }}>Awaiting your review</span>
          <button onClick={()=>action(l.id,'approved','status')} style={{ padding:'7px 18px', borderRadius:20, background:'linear-gradient(135deg,#2E7D52,#22C55E)', border:'none', color:'white', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'Poppins,sans-serif' }}>Approve</button>
          <button onClick={()=>action(l.id,'rejected','status')} style={{ padding:'7px 18px', borderRadius:20, background:'#FEF2F2', border:'1px solid #FCA5A5', color:'#C0392B', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'Poppins,sans-serif' }}>Reject</button>
        </div>
      )}

      {/* Final approval action bar — Admin/General Manager, right after POC */}
      {(userRole==='admin'||userRole==='general_manager') && l.poc_status==='approved' && !['approved','rejected'].includes(l.mgr_status) && (
        <div style={{ background:'linear-gradient(135deg,#F3F4F6,#E5E7EB)', borderTop:'1px solid #D1D5DB', padding:'10px 16px', display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <span style={{ fontSize:12, color:'#374151', fontWeight:700, flex:1 }}>Final approval required</span>
          <button onClick={()=>action(l.id,'approved','manager')} style={{ padding:'7px 18px', borderRadius:20, background:'linear-gradient(135deg,#2E7D52,#22C55E)', border:'none', color:'white', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'Poppins,sans-serif' }}>Approve</button>
          <button onClick={()=>action(l.id,'rejected','manager')} style={{ padding:'7px 18px', borderRadius:20, background:'#FEF2F2', border:'1px solid #FCA5A5', color:'#C0392B', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'Poppins,sans-serif' }}>Reject</button>
        </div>
      )}
    </div>
  )
}

// Month-section header for the "All Leaves" view — name/count/total-days at a
// glance, so browsing a long history doesn't mean scrolling a flat list.
function MonthHeader({ label, count, totalDays }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'2px 2px 4px' }}>
      <span style={{ fontWeight:800, fontSize:13.5, color:'#6B5D4A' }}>{label}</span>
      <span style={{ fontSize:10.5, fontWeight:700, color:'#A89880', background:'#F5F4F1', border:'1px solid #EAE6DE', borderRadius:20, padding:'2px 9px' }}>
        {count} leave{count!==1?'s':''}
      </span>
      <span style={{ fontSize:10.5, fontWeight:700, color:'#B8860B', background:'#FDF6E3', border:'1px solid #F0D78C', borderRadius:20, padding:'2px 9px' }}>
        {totalDays} day{totalDays!==1?'s':''}
      </span>
      <div style={{ flex:1, height:1, background:'#EAE6DE' }}/>
    </div>
  )
}

export default function LeavesPage() {
  const [leaves,    setLeaves]    = useState([])
  const [employees, setEmployees] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [stage,     setStage]     = useState('all')
  const [modal,     setModal]     = useState(false)
  const [userRole,  setUserRole]  = useState(null)
  const [search,     setSearch]     = useState('')
  const [typeFilter, setTypeFilter] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const user = JSON.parse(localStorage.getItem('gcd_user')||'{}')
      setUserRole(user.role)
      const [lv, emps] = await Promise.all([
        fetch(`${API}/api/leaves?stage=${stage}`, { headers:{ Authorization:`Bearer ${localStorage.getItem('gcd_token')}` } }).then(r=>r.json()),
        empApi.list()
      ])
      setLeaves(lv.leaves||[])
      setEmployees(emps.employees||[])
    } catch(e) { console.error(e) } finally { setLoading(false) }
  }, [stage])

  useEffect(() => { load() }, [load])

  async function action(id, status, endpoint) {
    await fetch(`${API}/api/leaves/${id}/${endpoint}`, { method:'PATCH', headers:hdr(), body:JSON.stringify({ status }) })
    load()
  }

  // Pending counts per role — two-step workflow: POC, then final approval.
  const pocPending   = leaves.filter(l => l.poc_status==='pending').length
  const adminPending = leaves.filter(l => l.poc_status==='approved' && !['approved','rejected'].includes(l.mgr_status)).length

  const pendingCount = userRole==='poc' ? pocPending : adminPending

  const STAGES = userRole==='driver'
    ? [{ v:'all', l:'All Leaves', count:null }]
    : [
        { v:'pending', l:'Action Required', count:pendingCount },
        { v:'all',     l:'All Leaves',      count:null },
      ]

  // Search/type filter — only meaningful on the "All Leaves" browse view.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return leaves.filter(l =>
      (typeFilter === 'all' || l.type === typeFilter) &&
      (!q
        || (l.name||'').toLowerCase().includes(q)
        || (l.reason||'').toLowerCase().includes(q)
        || (l.station_code||'').toLowerCase().includes(q)
      )
    )
  }, [leaves, search, typeFilter])

  // Grouped by month (from_date), newest first, each with a count + total-days
  // summary — "categorized" browsing instead of one long flat list.
  const monthGroups = useMemo(() => {
    const map = new Map()
    for (const l of filtered) {
      const key = (l.from_date||'').slice(0,7)
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(l)
    }
    return [...map.entries()]
      .sort((a,b) => b[0].localeCompare(a[0]))
      .map(([key, items]) => {
        const label = key
          ? new Date(+key.slice(0,4), +key.slice(5,7)-1, 1).toLocaleDateString('en-US', { month:'long', year:'numeric' })
          : 'Undated'
        const sorted = [...items].sort((a,b) => (b.from_date||'').localeCompare(a.from_date||''))
        return { key, label, items:sorted, totalDays: items.reduce((s,l)=>s+(Number(l.days)||0),0) }
      })
  }, [filtered])

  const showCategorized = stage === 'all'
  const visibleList = showCategorized ? filtered : leaves

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16, animation:'slideUp 0.35s ease' }}>

      {/* Workflow banner */}
      <div style={{ background:'linear-gradient(135deg,#F8F7FF,#F0EFFF)', border:'1px solid #DDD6FE', borderRadius:14, padding:'14px 18px' }}>
        <div style={{ fontWeight:700, fontSize:13, color:'#7C3AED', marginBottom:6, display:'flex', alignItems:'center', gap:6 }}><AlertCircle size={14}/> Leave Approval Workflow</div>
        <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
          {['DA applies','POC reviews','Manager approves','Done'].map((s,i,arr) => (
            <React.Fragment key={s}>
              <span style={{ fontSize:11.5, fontWeight:600, color:'#7C3AED', background:'rgba(124,58,237,0.08)', padding:'3px 10px', borderRadius:20 }}>{s}</span>
              {i<arr.length-1 && <ChevronRight size={13} color="#A89880"/>}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ display:'flex', gap:6, flex:1 }}>
          {STAGES.map(s => (
            <button key={s.v} onClick={()=>setStage(s.v)}
              style={{ padding:'8px 16px', borderRadius:20, border:`1.5px solid ${stage===s.v?'#B8860B':'#EAE6DE'}`, background:stage===s.v?'#FDF6E3':'#FFF', color:stage===s.v?'#B8860B':'#A89880', fontWeight:stage===s.v?700:500, fontSize:12.5, cursor:'pointer', transition:'all 0.18s', fontFamily:'Poppins,sans-serif', display:'flex', alignItems:'center', gap:6 }}>
              {s.l}
              {s.count!=null && s.count>0 && <span style={{ background:'#B8860B', color:'white', borderRadius:20, padding:'1px 7px', fontSize:10, fontWeight:700 }}>{s.count}</span>}
            </button>
          ))}
        </div>
        {userRole !== 'accountant' && userRole !== 'driver' && (
          <button className="btn btn-primary btn-sm" onClick={()=>setModal(true)} style={{ borderRadius:20 }}>
            <Plus size={13}/> New Request
          </button>
        )}
      </div>

      {/* Search + type filter — All Leaves view only */}
      {showCategorized && (
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
          <div style={{ position:'relative', flex:1, minWidth:200, maxWidth:320 }}>
            <Search size={13} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#A89880', pointerEvents:'none' }}/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, station, reason…"
              style={{ width:'100%', boxSizing:'border-box', padding:'8px 12px 8px 32px', borderRadius:20, border:'1.5px solid #EAE6DE', fontSize:12.5, fontFamily:'inherit', outline:'none' }}/>
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {['all', ...TYPES].map(t => (
              <button key={t} onClick={()=>setTypeFilter(t)}
                style={{ padding:'6px 13px', borderRadius:20, border:`1.5px solid ${typeFilter===t?(TYPE_COLORS[t]||'#B8860B'):'#EAE6DE'}`, background:typeFilter===t?`${TYPE_COLORS[t]||'#B8860B'}15`:'#FFF', color:typeFilter===t?(TYPE_COLORS[t]||'#B8860B'):'#A89880', fontWeight:typeFilter===t?700:500, fontSize:11.5, cursor:'pointer', fontFamily:'inherit' }}>
                {t==='all'?'All Types':t}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Leaves */}
      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {[1,2,3].map(i=><div key={i} className="skeleton" style={{ height:100, borderRadius:14 }}/>)}
        </div>
      ) : visibleList.length===0 ? (
        <div style={{ textAlign:'center', padding:'50px 20px', color:'#A89880' }}>
          <Calendar size={40} style={{ margin:'0 auto 12px', display:'block', opacity:0.2 }}/>
          <div style={{ fontWeight:600, color:'#6B5D4A' }}>
            {stage==='pending' ? 'No leaves awaiting your action' : leaves.length===0 ? 'No leave records found' : 'Nothing matches this filter'}
          </div>
        </div>
      ) : showCategorized ? (
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
          {monthGroups.map(g => (
            <div key={g.key} style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <MonthHeader label={g.label} count={g.items.length} totalDays={g.totalDays}/>
              {g.items.map((l,i) => <LeaveRow key={l.id} l={l} i={i} userRole={userRole} action={action}/>)}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {leaves.map((l,i) => <LeaveRow key={l.id} l={l} i={i} userRole={userRole} action={action}/>)}
        </div>
      )}

      {modal && <NewLeaveModal employees={employees} onSave={()=>{setModal(false);load()}} onClose={()=>setModal(false)}/>}
    </div>
  )
}
