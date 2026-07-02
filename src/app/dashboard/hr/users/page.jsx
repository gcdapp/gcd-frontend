'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { Plus, X, Pencil, Trash2, Eye, EyeOff, RefreshCw, Search, Shield, User, Mail, Lock, Building2, CheckCircle, XCircle, KeyRound, AlertCircle } from 'lucide-react'

import { API } from '@/lib/api'

const ALL_ROLES = ['admin','general_manager','hr','accountant','poc','driver']

// Manager sub-types — stored in manager_type column, shown under Manager label
const MANAGER_TYPES = [
  { value:'general_manager',    label:'General Manager'    },
  { value:'project_manager',    label:'Project Manager'    },
  { value:'operations_manager', label:'Operations Manager' },
  { value:'logistics_manager',  label:'Logistics Manager'  },
  { value:'fleet_manager',      label:'Fleet Manager'      },
]
const STATIONS  = ['DDB1','DXE6']

// Mirrors backend VALID_PROJECTS (backend/src/routes/auth.js) — restricts which DAs/employees this account can see
const PROJECT_OPTIONS = [
  { value:'pulser',           label:'Pulser (Amazon)' },
  { value:'cret',             label:'CRET (Amazon)' },
  { value:'office',           label:'Office' },
  { value:'creative_packers', label:'Creative Packers' },
  { value:'ig_rak',           label:'IG RAK' },
  { value:'imile',            label:'IMILE Delivery Services' },
  { value:'jnt_express',      label:'Jnt Express' },
  { value:'le_chocola',       label:'Le Chocola' },
]

const ROLE_CFG = {
  admin:           { c:'#7C3AED', bg:'#F5F3FF', bc:'#DDD6FE', label:'Admin' },
  general_manager: { c:'#0F766E', bg:'#F0FDFA', bc:'#99F6E4', label:'Manager' },
  hr:              { c:'#B45309', bg:'#FFFBEB', bc:'#FCD34D', label:'HR' },
  accountant:      { c:'#2E7D52', bg:'#ECFDF5', bc:'#A7F3D0', label:'Accountant' },
  poc:             { c:'#B8860B', bg:'#FDF6E3', bc:'#F0D78C', label:'POC' },
  driver:          { c:'#6B5D4A', bg:'#F5F4F1', bc:'#EAE6DE', label:'Driver' },
}

function hdr() { return { 'Content-Type':'application/json', Authorization:`Bearer ${localStorage.getItem('gcd_token')}` } }

// ── User Modal ────────────────────────────────────────────────
function UserModal({ user, onSave, onClose }) {
  const isEdit = !!user
  const [name,     setName]     = useState(user?.name||'')
  const [email,    setEmail]    = useState(user?.email||'')
  const [password, setPassword] = useState('')
  const [role,     setRole]     = useState(user?.role||'driver')
  const [empId,    setEmpId]    = useState(user?.emp_id||'')
  const [station,  setStation]  = useState(user?.station_code||'DDB1')
  const [status,   setStatus]   = useState(user?.status||'active')
  const [mgrType]              = useState(user?.manager_type||'general_manager')
  const [projects, setProjects] = useState(user?.assigned_projects || [])
  const [showPw,   setShowPw]   = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [err,      setErr]      = useState(null)

  const rc = ROLE_CFG[role] || ROLE_CFG.driver
  const showProjectScope = role !== 'driver' && role !== 'poc'

  function toggleProject(v) {
    setProjects(p => p.includes(v) ? p.filter(x=>x!==v) : [...p, v])
  }

  async function handleSave() {
    if (!name||!email) return setErr('Name and email required')
    if (!isEdit && !password) return setErr('Password required for new account')
    setSaving(true); setErr(null)
    try {
      const body = { name, email, role, manager_type:role==='general_manager'?mgrType:null, emp_id:empId||null, station_code:role==='poc'?station:null, status,
        assigned_projects: showProjectScope ? (projects.length ? projects : null) : null }
      if (password) body.password = password
      const res  = await fetch(`${API}/api/auth/users${isEdit?`/${user.id}`:''}`, { method:isEdit?'PUT':'POST', headers:hdr(), body:JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onSave()
    } catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ maxWidth:480, padding:0, overflow:'hidden' }}>
        {/* Header */}
        <div style={{ padding:'22px 24px 18px', background:`linear-gradient(135deg,${rc.bg},#FFF)` }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
            <div>
              <h3 style={{ fontWeight:900, fontSize:17, color:'#1A1612' }}>{isEdit?'Edit User Account':'New User Account'}</h3>
              <p style={{ fontSize:12, color:'#A89880', marginTop:2 }}>{isEdit?`Editing ${user.name}`:'Create login access for a team member'}</p>
            </div>
            <button onClick={onClose} style={{ width:30, height:30, borderRadius:'50%', background:'rgba(0,0,0,0.06)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><X size={14}/></button>
          </div>
          {/* Role selector */}
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', paddingBottom:2 }}>
            {ALL_ROLES.map(r => {
              const cfg = ROLE_CFG[r]
              return (
                <button key={r} onClick={()=>setRole(r)} type="button"
                  style={{ padding:'6px 12px', borderRadius:20, border:`2px solid ${role===r?cfg.c:'#EAE6DE'}`, background:role===r?cfg.bg:'#FFF', color:role===r?cfg.c:'#A89880', fontWeight:role===r?700:500, fontSize:11.5, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0, transition:'all 0.18s', fontFamily:'Poppins,sans-serif' }}>
                  {cfg.label}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ padding:'18px 24px 20px', display:'flex', flexDirection:'column', gap:13 }}>
          {err && <div style={{ display:'flex', gap:8, alignItems:'center', background:'#FEF2F2', border:'1px solid #FCA5A5', borderRadius:9, padding:'9px 12px', fontSize:12.5, color:'#C0392B' }}><AlertCircle size={13}/>{err}</div>}

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:'#A89880', marginBottom:5 }}>Full Name *</label>
              <div style={{ position:'relative' }}>
                <User size={13} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#C4B49A', pointerEvents:'none' }}/>
                <input className="input" value={name} onChange={e=>setName(e.target.value)} style={{ paddingLeft:34 }} autoComplete="off"/>
              </div>
            </div>
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:'#A89880', marginBottom:5 }}>Employee ID</label>
              <input className="input" value={empId} onChange={e=>setEmpId(e.target.value)} placeholder="e.g. DA001" autoComplete="off"/>
            </div>
          </div>

          <div>
            <label style={{ display:'block', fontSize:11, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:'#A89880', marginBottom:5 }}>Email Address *</label>
            <div style={{ position:'relative' }}>
              <Mail size={13} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#C4B49A', pointerEvents:'none' }}/>
              <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} style={{ paddingLeft:34 }} autoComplete="off"/>
            </div>
          </div>

          <div>
            <label style={{ display:'block', fontSize:11, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:'#A89880', marginBottom:5 }}>
              {isEdit ? 'New Password' : 'Password *'}
              {isEdit && <span style={{ fontWeight:400, textTransform:'none', letterSpacing:0, fontSize:10, marginLeft:5, color:'#C4B49A' }}>leave blank to keep current</span>}
            </label>
            <div style={{ position:'relative' }}>
              <Lock size={13} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#C4B49A', pointerEvents:'none' }}/>
              <input className="input" type={showPw?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} style={{ paddingLeft:34, paddingRight:42 }} autoComplete="new-password"/>
              <button type="button" onClick={()=>setShowPw(p=>!p)} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#A89880', padding:0, display:'flex' }}>
                {showPw?<EyeOff size={15}/>:<Eye size={15}/>}
              </button>
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns: role==='poc' ? '1fr 1fr 1fr' : '1fr 1fr', gap:12 }}>
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:'#A89880', marginBottom:5 }}>Selected Role</label>
              <div style={{ padding:'9px 12px', borderRadius:10, background:rc.bg, border:`1.5px solid ${rc.bc}`, fontSize:13, fontWeight:700, color:rc.c, display:'flex', alignItems:'center', gap:6 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:rc.c }}/>
                {rc.label}
              </div>
            </div>
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:'#A89880', marginBottom:5 }}>Status</label>
              <select className="input" value={status} onChange={e=>setStatus(e.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">Blocked</option>
              </select>
            </div>
            {role==='poc' && (
              <div>
                <label style={{ display:'block', fontSize:11, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:'#A89880', marginBottom:5 }}>Station</label>
                <select className="input" value={station} onChange={e=>setStation(e.target.value)}>
                  {STATIONS.map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
            )}
          </div>

          {showProjectScope && (
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:'#A89880', marginBottom:5 }}>
                Project Scope
                <span style={{ fontWeight:400, textTransform:'none', letterSpacing:0, fontSize:10, marginLeft:5, color:'#C4B49A' }}>
                  {projects.length ? 'restricted to selected projects — sees only their DAs' : 'none selected = sees all projects'}
                </span>
              </label>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {PROJECT_OPTIONS.map(p => {
                  const active = projects.includes(p.value)
                  return (
                    <button key={p.value} type="button" onClick={()=>toggleProject(p.value)}
                      style={{ padding:'6px 12px', borderRadius:20, border:`1.5px solid ${active?'#7C3AED':'#EAE6DE'}`, background:active?'#F5F3FF':'#FFF', color:active?'#7C3AED':'#A89880', fontWeight:active?700:500, fontSize:11.5, cursor:'pointer', whiteSpace:'nowrap', fontFamily:'Poppins,sans-serif' }}>
                      {p.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div style={{ padding:'14px 24px 22px', borderTop:'1px solid #EAE6DE', display:'flex', gap:10, justifyContent:'flex-end', background:'#FAFAF8' }}>
          <button onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ minWidth:140, justifyContent:'center' }}>
            {saving ? <span style={{ display:'flex', alignItems:'center', gap:7 }}><span style={{ width:13, height:13, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/> Saving…</span> : isEdit ? 'Save Changes' : 'Create Account'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── User Card ─────────────────────────────────────────────────
function UserCard({ u, onEdit, onDelete, onToggle, index }) {
  const rc = ROLE_CFG[u.role] || ROLE_CFG.driver
  const [confirming, setConfirming] = useState(false)
  const [deleting,   setDeleting]   = useState(false)

  async function handleConfirmDelete() {
    setDeleting(true)
    await onDelete(u)
    setDeleting(false)
    setConfirming(false)
  }

  return (
    <div style={{ background:'#FFF', border:'1px solid #EAE6DE', borderRadius:16, padding:'14px 16px', animation:`slideUp 0.4s ${index*0.04}s ease both`, transition:'all 0.2s' }}
      onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 4px 20px rgba(0,0,0,0.07)';e.currentTarget.style.borderColor='#D4C4A8'}}
      onMouseLeave={e=>{e.currentTarget.style.boxShadow='none';e.currentTarget.style.borderColor='#EAE6DE'}}>

      <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
        {/* Avatar */}
        <div style={{ width:46, height:46, borderRadius:14, background:`linear-gradient(135deg,${rc.bg},#FFF)`, border:`2px solid ${rc.bc}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:900, color:rc.c, flexShrink:0 }}>
          {u.name?.slice(0,2).toUpperCase()}
        </div>

        {/* Main info */}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3, flexWrap:'wrap' }}>
            <span style={{ fontWeight:700, fontSize:14, color:'#1A1612' }}>{u.name}</span>
            <span style={{ fontSize:10.5, fontWeight:700, color:rc.c, background:rc.bg, border:`1px solid ${rc.bc}`, borderRadius:20, padding:'2px 9px' }}>{rc.label}</span>
            {u.role==='general_manager' && u.manager_type && u.manager_type!=='general_manager' && (
              <span style={{ fontSize:10, fontWeight:600, color:'#6B7280', background:'#F3F4F6', border:'1px solid #E5E7EB', borderRadius:20, padding:'2px 8px' }}>
                {MANAGER_TYPES.find(m=>m.value===u.manager_type)?.label||'General Manager'}
              </span>
            )}
            {u.station_code && <span style={{ fontSize:10.5, fontWeight:700, color:'#B8860B', background:'#FDF6E3', border:'1px solid #F0D78C', borderRadius:20, padding:'2px 9px' }}>{u.station_code}</span>}
            {u.assigned_projects?.length > 0 && (
              <span style={{ fontSize:10.5, fontWeight:700, color:'#7C3AED', background:'#F5F3FF', border:'1px solid #DDD6FE', borderRadius:20, padding:'2px 9px' }} title={u.assigned_projects.join(', ')}>
                {u.assigned_projects.length} project{u.assigned_projects.length>1?'s':''} only
              </span>
            )}
            <button onClick={()=>onToggle(u)}
              style={{ fontSize:10.5, fontWeight:700, color:u.status==='active'?'#2E7D52':'#C0392B', background:u.status==='active'?'#ECFDF5':'#FEF2F2', border:`1px solid ${u.status==='active'?'#A7F3D0':'#FCA5A5'}`, borderRadius:20, padding:'2px 9px', cursor:'pointer', fontFamily:'Poppins,sans-serif', display:'flex', alignItems:'center', gap:3 }}>
              {u.status==='active'?<><CheckCircle size={9}/> Active</>:<><XCircle size={9}/> Blocked</>}
            </button>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'#A89880', marginBottom:4 }}>
            <Mail size={11}/> <span style={{ fontFamily:'inherit' }}>{u.email}</span>
          </div>
          {u.emp_id && (
            <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:11.5, color:'#6B5D4A' }}>
              <Building2 size={11}/> <span style={{ fontFamily:'inherit' }}>{u.emp_id}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display:'flex', gap:6, flexShrink:0, alignItems:'center' }}>
          {confirming ? (
            <>
              <span style={{ fontSize:11.5, color:'#C0392B', fontWeight:600 }}>Delete?</span>
              <button onClick={handleConfirmDelete} disabled={deleting}
                style={{ padding:'6px 10px', borderRadius:9, background:'#C0392B', border:'none', cursor:'pointer', fontSize:11.5, color:'#FFF', fontWeight:700, fontFamily:'Poppins,sans-serif', display:'flex', alignItems:'center', gap:4 }}>
                {deleting ? '…' : 'Yes'}
              </button>
              <button onClick={()=>setConfirming(false)}
                style={{ padding:'6px 10px', borderRadius:9, background:'#F5F4F1', border:'none', cursor:'pointer', fontSize:11.5, color:'#6B5D4A', fontWeight:600, fontFamily:'Poppins,sans-serif' }}>
                No
              </button>
            </>
          ) : (
            <>
              <button onClick={()=>onEdit(u)} style={{ padding:'6px 12px', borderRadius:9, background:'#F5F4F1', border:'none', cursor:'pointer', fontSize:11.5, color:'#6B5D4A', fontWeight:600, display:'flex', alignItems:'center', gap:4, fontFamily:'Poppins,sans-serif' }}>
                <Pencil size={12}/> Edit
              </button>
              <button onClick={()=>setConfirming(true)} style={{ padding:'6px 8px', borderRadius:9, background:'#FEF2F2', border:'none', cursor:'pointer', color:'#C0392B', display:'flex', alignItems:'center', fontFamily:'Poppins,sans-serif' }}>
                <Trash2 size={12}/>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Password row — no plaintext stored, show edit button */}
      <div style={{ marginTop:10, paddingTop:10, borderTop:'1px solid #F5F4F1', display:'flex', alignItems:'center', gap:8 }}>
        <KeyRound size={12} color="#C4B49A"/>
        <span style={{ fontSize:11, color:'#A89880', flex:1 }}>Password</span>
        <span style={{ fontFamily:'inherit', fontSize:12, color:'#C4B49A', letterSpacing:'0.12em' }}>••••••••</span>
        <button onClick={()=>onEdit(u)} style={{ padding:'3px 10px', borderRadius:7, background:'#FDF6E3', border:'1px solid #F0D78C', cursor:'pointer', fontSize:11, color:'#B8860B', fontWeight:600, fontFamily:'Poppins,sans-serif' }}>
          Change
        </button>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────
export default function UsersPage() {
  const [users,   setUsers]   = useState([])
  const [loading, setLoading] = useState(true)
  const [modal,   setModal]   = useState(null)
  const [search,  setSearch]  = useState('')
  const [roleFilter, setRoleFilter] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(`${API}/api/auth/users`, { headers:hdr() })
      const data = await res.json()
      setUsers(data.users||[])
    } catch(e) { console.error(e) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleDelete(u) {
    try {
      const res = await fetch(`${API}/api/auth/users/${u.id}`, { method:'DELETE', headers:hdr() })
      const data = await res.json()
      if (!res.ok) { alert(data.error || 'Delete failed'); return }
      load()
    } catch(e) { alert('Network error — could not delete account') }
  }
  async function toggleStatus(u) {
    await fetch(`${API}/api/auth/users/${u.id}`, { method:'PUT', headers:hdr(), body:JSON.stringify({ status: u.status==='active'?'inactive':'active' }) })
    load()
  }

  // Filter
  const filtered = users.filter(u => {
    const matchSearch = !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()) || u.emp_id?.toLowerCase().includes(search.toLowerCase())
    const matchRole   = roleFilter === 'all' || u.role === roleFilter
    return matchSearch && matchRole
  })

  // Stats
  const active   = users.filter(u=>u.status==='active').length
  const blocked  = users.filter(u=>u.status==='inactive').length

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16, animation:'slideUp 0.35s ease' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontWeight:900, fontSize:20, color:'#1A1612', letterSpacing:'-0.03em' }}>User Accounts</h1>
          <p style={{ fontSize:12, color:'#A89880', marginTop:3 }}>{users.length} accounts · {active} active · {blocked} blocked</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={load} style={{ width:36, height:36, borderRadius:'50%', background:'#F5F4F1', border:'1px solid #EAE6DE', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#6B5D4A' }}>
            <RefreshCw size={14}/>
          </button>
          <button className="btn btn-primary" onClick={()=>setModal({user:null})}>
            <Plus size={15}/> New Account
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(110px,1fr))', gap:8 }}>
        {[
          { l:'Total',   v:users.length,  c:'#1A1612', bg:'#FAFAF8', bc:'#EAE6DE' },
          { l:'Active',  v:active,        c:'#2E7D52', bg:'#ECFDF5', bc:'#A7F3D0' },
          { l:'Blocked', v:blocked,       c:'#C0392B', bg:'#FEF2F2', bc:'#FCA5A5' },
          ...ALL_ROLES.map(r => ({ l:ROLE_CFG[r].label, v:users.filter(u=>u.role===r).length, c:ROLE_CFG[r].c, bg:ROLE_CFG[r].bg, bc:ROLE_CFG[r].bc }))
        ].map((s,i) => (
          <div key={s.l} style={{ textAlign:'center', padding:'10px 6px', borderRadius:11, background:s.bg, border:`1px solid ${s.bc}`, animation:`slideUp 0.3s ${i*0.03}s ease both`, cursor:'pointer' }}
            onClick={()=>setRoleFilter(ALL_ROLES.includes(s.l.toLowerCase().replace(' ','_')) ? s.l.toLowerCase().replace(' ','_') : 'all')}>
            <div style={{ fontWeight:900, fontSize:20, color:s.c, letterSpacing:'-0.03em' }}>{s.v}</div>
            <div style={{ fontSize:9.5, color:s.c, fontWeight:600, marginTop:2, opacity:0.85 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Search + filter */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ flex:'1 1 200px', position:'relative' }}>
          <Search size={13} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#C4B49A', pointerEvents:'none' }}/>
          <input className="input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, email, employee ID…" style={{ paddingLeft:34, borderRadius:20 }}/>
          {search && <button onClick={()=>setSearch('')} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#A89880', padding:0, display:'flex' }}><X size={13}/></button>}
        </div>
        <div style={{ display:'flex', gap:5, overflowX:'auto', scrollbarWidth:'none' }}>
          <button onClick={()=>setRoleFilter('all')} style={{ padding:'7px 14px', borderRadius:20, fontSize:12, fontWeight:roleFilter==='all'?700:500, border:`1.5px solid ${roleFilter==='all'?'#B8860B':'#EAE6DE'}`, background:roleFilter==='all'?'#FDF6E3':'#FFF', color:roleFilter==='all'?'#B8860B':'#A89880', cursor:'pointer', whiteSpace:'nowrap', fontFamily:'Poppins,sans-serif' }}>All</button>
          {ALL_ROLES.map(r => {
            const cfg = ROLE_CFG[r]
            return (
              <button key={r} onClick={()=>setRoleFilter(r)}
                style={{ padding:'7px 14px', borderRadius:20, fontSize:12, fontWeight:roleFilter===r?700:500, border:`1.5px solid ${roleFilter===r?cfg.c:'#EAE6DE'}`, background:roleFilter===r?cfg.bg:'#FFF', color:roleFilter===r?cfg.c:'#A89880', cursor:'pointer', whiteSpace:'nowrap', fontFamily:'Poppins,sans-serif' }}>
                {cfg.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* User list */}
      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {[1,2,3].map(i=><div key={i} className="skeleton" style={{ height:100, borderRadius:16 }}/>)}
        </div>
      ) : filtered.length===0 ? (
        <div style={{ textAlign:'center', padding:'50px 20px', color:'#A89880' }}>
          <Shield size={40} style={{ margin:'0 auto 12px', display:'block', opacity:0.2 }}/>
          <div style={{ fontWeight:600, color:'#6B5D4A' }}>{search?`No results for "${search}"`:'No user accounts yet'}</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {filtered.map((u, i) => (
            <UserCard key={u.id} u={u} index={i}
              onEdit={u => setModal({user:u})}
              onDelete={handleDelete}
              onToggle={toggleStatus}/>
          ))}
        </div>
      )}

      {modal && <UserModal user={modal.user} onSave={()=>{setModal(null);load()}} onClose={()=>setModal(null)}/>}
    </div>
  )
}