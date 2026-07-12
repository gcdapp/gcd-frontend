'use client'
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { API } from '@/lib/api'
import { Plus, X, Search, Clock, UserCheck, UserX, CalendarOff, AlertCircle, Trash2, RefreshCw } from 'lucide-react'

const STATUS = [
  { v:'present', label:'Present',  color:'#059669', bg:'#ECFDF5', border:'#6EE7B7', dot:'#10B981' },
  { v:'absent',  label:'Absent',   color:'#DC2626', bg:'#FEF2F2', border:'#FCA5A5', dot:'#EF4444' },
  { v:'leave',   label:'On Leave', color:'#D97706', bg:'#FFFBEB', border:'#FCD34D', dot:'#F59E0B' },
]
const DOT_COLOR = { present:'#10B981', absent:'#EF4444', leave:'#F59E0B' }

function getLast7() {
  return Array.from({ length:7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i))
    return d.toISOString().slice(0, 10)
  })
}

function Avatar({ name, size = 38 }) {
  const initials = name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '??'
  const colors   = ['#B8860B','#0F766E','#7C3AED','#DC2626','#0369A1','#059669']
  const color    = colors[(name?.charCodeAt(0) || 0) % colors.length]
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', background:color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:size * 0.34, fontWeight:800, color:'#fff', flexShrink:0, letterSpacing:'-0.01em' }}>
      {initials}
    </div>
  )
}

function WeekDots({ empId, weekMap, weekDates, selectedDate, onDayClick }) {
  const today = new Date().toISOString().slice(0, 10)
  return (
    <div style={{ display:'flex', gap:3 }}>
      {weekDates.map(date => {
        const rec   = (weekMap[date] || []).find(a => a.emp_id === empId)
        const color = rec ? (DOT_COLOR[rec.status] || '#6B7280') : 'var(--border)'
        const isSel = date === selectedDate
        const isToday = date === today
        const day = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday:'short' }).charAt(0)
        return (
          <button key={date} onClick={() => onDayClick(date)} type="button" title={`${date}: ${rec?.status || 'not logged'}`}
            style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, background:'none', border:'none', cursor:'pointer', padding:'2px 1px' }}>
            <span style={{ fontSize:8, fontWeight:700, color: isSel ? '#B8860B' : 'var(--text-muted)', fontFamily:'inherit' }}>{day}</span>
            <div style={{ width:14, height:14, borderRadius:4, background:color, outline: isSel ? '2px solid #B8860B' : isToday ? '2px solid rgba(184,134,11,0.35)' : 'none', outlineOffset:'1px', transition:'all 0.12s' }}/>
          </button>
        )
      })}
    </div>
  )
}

function WeekNav({ weekDates, weekMap, employees, selectedDate, onDayClick }) {
  const today  = new Date().toISOString().slice(0, 10)
  const empIds = new Set(employees.map(e => e.id))
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:6 }}>
      {weekDates.map(date => {
        const recs    = (weekMap[date] || []).filter(a => empIds.has(a.emp_id))
        const present = recs.filter(a => a.status === 'present').length
        const isSel   = date === selectedDate
        const isToday = date === today
        const dayName = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday:'short' })
        const dayNum  = new Date(date + 'T00:00:00').getDate()
        const pct     = employees.length > 0 ? Math.round(recs.length / employees.length * 100) : 0
        return (
          <button key={date} onClick={() => onDayClick(date)} type="button"
            style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, padding:'10px 4px', borderRadius:12, border:'none', cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s',
              background: isSel ? '#B8860B' : isToday ? 'rgba(184,134,11,0.08)' : 'var(--bg-alt)',
              outline: !isSel && isToday ? '1.5px solid rgba(184,134,11,0.35)' : 'none' }}>
            <span style={{ fontSize:9, fontWeight:700, color: isSel ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)', letterSpacing:'0.05em' }}>{dayName.toUpperCase()}</span>
            <span style={{ fontSize:17, fontWeight:900, color: isSel ? '#fff' : 'var(--text)', letterSpacing:'-0.03em' }}>{dayNum}</span>
            {recs.length > 0 ? (
              <span style={{ fontSize:9.5, fontWeight:700, color: isSel ? 'rgba(255,255,255,0.9)' : '#059669', background: isSel ? 'rgba(255,255,255,0.18)' : '#ECFDF5', padding:'1px 6px', borderRadius:10 }}>
                {present}/{employees.length}
              </span>
            ) : (
              <span style={{ fontSize:9, color: isSel ? 'rgba(255,255,255,0.4)' : 'var(--text-muted)' }}>—</span>
            )}
            {recs.length > 0 && (
              <div style={{ width:'80%', height:3, borderRadius:2, background: isSel ? 'rgba(255,255,255,0.25)' : 'var(--border)', overflow:'hidden', marginTop:1 }}>
                <div style={{ height:'100%', width:`${pct}%`, background: isSel ? 'rgba(255,255,255,0.8)' : '#10B981', borderRadius:2 }}/>
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}

function LogModal({ employees, date, onSave, onClose }) {
  const [empId,  setEmpId]  = useState('')
  const [status, setStatus] = useState('present')
  const [note,   setNote]   = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!empId) return
    setSaving(true)
    try {
      const h = { 'Content-Type':'application/json', Authorization:`Bearer ${localStorage.getItem('gcd_token')}` }
      const res = await fetch(`${API}/api/attendance`, {
        method:'POST', headers:h,
        body:JSON.stringify({ emp_id:empId, status, note:note||null, date }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed') }
      onSave()
    } catch(e) { alert(e.message) } finally { setSaving(false) }
  }

  return createPortal(
    <div className="modal-overlay" style={{ zIndex:9999 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:420, borderRadius:20 }}>
        <div style={{ background:'linear-gradient(135deg,#B8860B,#D4A017)', borderRadius:'16px 16px 0 0', padding:'18px 20px', margin:'-24px -24px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontWeight:800, fontSize:16, color:'#fff' }}>Log Attendance</div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.7)', marginTop:2 }}>{date}</div>
          </div>
          <button onClick={onClose} style={{ width:30, height:30, borderRadius:8, border:'1px solid rgba(255,255,255,0.3)', background:'rgba(255,255,255,0.15)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
            <X size={14}/>
          </button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <label className="input-label">Employee *</label>
            <select className="input" value={empId} onChange={e => setEmpId(e.target.value)}>
              <option value="">Select employee…</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}{e.role ? ` — ${e.role}` : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="input-label">Status *</label>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
              {STATUS.map(s => (
                <button key={s.v} type="button" onClick={() => setStatus(s.v)}
                  style={{ padding:'12px 6px', borderRadius:12, border:`2px solid ${status===s.v ? s.border : 'var(--border)'}`, background:status===s.v ? s.bg : 'var(--bg-alt)', color:status===s.v ? s.color : 'var(--text-muted)', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s', display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                  <span style={{ width:8, height:8, borderRadius:4, background:status===s.v ? s.dot : 'var(--border)', display:'block' }}/>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="input-label">Note (optional)</label>
            <input className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Doctor's appointment…"/>
          </div>
        </div>
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:20 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !empId} style={{ minWidth:100 }}>
            {saving ? 'Saving…' : 'Log Attendance'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default function StaffAttendancePage() {
  const [attendance, setAttendance] = useState([])
  const [employees,  setEmployees]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [date,       setDate]       = useState(new Date().toISOString().slice(0, 10))
  const [modal,      setModal]      = useState(false)
  const [search,     setSearch]     = useState('')
  const [weekMap,    setWeekMap]    = useState({})
  const [weekLoading, setWeekLoading] = useState(true)

  const weekDates = useMemo(() => getLast7(), [])
  const auth = useMemo(() => ({ Authorization:`Bearer ${localStorage.getItem('gcd_token')}` }), [])

  const loadWeek = useCallback(async () => {
    setWeekLoading(true)
    try {
      const results = await Promise.all(
        weekDates.map(d => fetch(`${API}/api/attendance?date=${d}`, { headers:auth }).then(r => r.json()).catch(() => ({ attendance:[] })))
      )
      const map = {}
      weekDates.forEach((d, i) => { map[d] = results[i].attendance || [] })
      setWeekMap(map)
    } catch(e) { console.error(e) } finally { setWeekLoading(false) }
  }, [weekDates, auth])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [attRes, empRes] = await Promise.all([
        fetch(`${API}/api/attendance?date=${date}`, { headers:auth }).then(r => r.json()),
        fetch(`${API}/api/employees`, { headers:auth }).then(r => r.json()),
      ])
      const staff = (empRes.employees || []).filter(e =>
        e.status !== 'inactive' &&
        !['driver'].includes((e.role || '').toLowerCase()) &&
        !['operations','delivery'].includes((e.dept || '').toLowerCase())
      )
      setEmployees(staff)
      const staffIds = new Set(staff.map(e => e.id))
      setAttendance((attRes.attendance || []).filter(a => staffIds.has(a.emp_id)))
    } catch(e) { console.error(e) } finally { setLoading(false) }
  }, [date, auth])

  useEffect(() => { load() },     [load])
  useEffect(() => { loadWeek() }, [loadWeek])

  const loggedIds  = new Set(attendance.map(a => a.emp_id))
  const present    = attendance.filter(a => a.status === 'present').length
  const absent     = attendance.filter(a => a.status === 'absent').length
  const onLeave    = attendance.filter(a => a.status === 'leave').length
  const total      = employees.length
  const notLogged  = total - attendance.length

  const filtered = (search.trim()
    ? employees.filter(e => e.name?.toLowerCase().includes(search.toLowerCase()))
    : employees
  ).sort((a, b) => (loggedIds.has(a.id) ? 0 : 1) - (loggedIds.has(b.id) ? 0 : 1))

  async function deleteRecord(id) {
    if (!confirm('Remove this attendance record?')) return
    await fetch(`${API}/api/attendance/${id}`, { method:'DELETE', headers:auth })
    load(); loadWeek()
  }

  function onSaved() { setModal(false); load(); loadWeek() }

  const displayDate = new Date(date + 'T00:00:00').toLocaleDateString('en-AE', { weekday:'long', day:'numeric', month:'long', year:'numeric' })

  const CSS = `
    .satt-page{display:flex;flex-direction:column;gap:14px}
    .satt-kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:20px}
    .satt-week-card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:16px 18px}
    .satt-list{background:var(--card);border:1px solid var(--border);border-radius:16px;overflow:hidden}
    .satt-list-hd{padding:13px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px}
    .satt-row{display:flex;align-items:center;gap:12px;padding:13px 18px;transition:background 0.12s;border-bottom:1px solid var(--border)}
    .satt-row:last-child{border-bottom:none}
    .satt-row:hover{background:var(--bg-alt)}
    .satt-row-mid{flex:1;min-width:0}
    .satt-row-right{display:flex;align-items:center;gap:8px;flex-shrink:0}
    .satt-date-inp{padding:7px 11px;border-radius:10px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.85);font-size:12.5px;font-family:inherit;cursor:pointer;outline:none}
    .satt-prog-bar{height:4px;border-radius:2px;background:rgba(255,255,255,0.1);overflow:hidden;margin-top:14px}
    .satt-prog-fill{height:100%;border-radius:2px;background:linear-gradient(90deg,#10B981,#34D399);transition:width 0.5s ease}
    @media(max-width:768px){
      .satt-kpi{grid-template-columns:1fr 1fr !important}
      .satt-row{flex-wrap:wrap;gap:8px}
      .satt-row-right{width:100%;justify-content:flex-end}
    }
    @media(max-width:480px){
      .satt-row{padding:11px 14px}
    }
  `

  return (
    <>
      <style>{CSS}</style>
      <div className="satt-page">

        {/* ── Hero (fleet style) ───────────────────────────────── */}
        <div style={{ background:'linear-gradient(135deg,#0f1623 0%,#1a2535 50%,#1e3a5f 100%)', borderRadius:16, padding:24 }}>

          {/* Title row */}
          <div style={{ display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
            <div style={{ width:46, height:46, borderRadius:14, background:'rgba(16,185,129,0.15)', border:'1.5px solid rgba(16,185,129,0.3)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Clock size={22} color="#34D399"/>
            </div>
            <div>
              <div style={{ fontWeight:900, fontSize:20, color:'white', letterSpacing:'-0.02em', lineHeight:1.1 }}>Staff Attendance</div>
              <div style={{ fontSize:12, color:'rgba(255,255,255,0.5)', marginTop:3 }}>{displayDate} · Office &amp; admin staff</div>
            </div>
            <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
              <button onClick={() => { load(); loadWeek() }} title="Refresh"
                style={{ width:36, height:36, borderRadius:10, background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.15)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'rgba(255,255,255,0.7)' }}>
                <RefreshCw size={14}/>
              </button>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="satt-date-inp"/>
            </div>
          </div>

          {/* KPI tiles */}
          <div className="satt-kpi">
            {[
              { label:'Present',    val:loading?'—':present,   color:'#4ADE80' },
              { label:'Absent',     val:loading?'—':absent,    color:'#F87171' },
              { label:'On Leave',   val:loading?'—':onLeave,   color:'#FBBF24' },
              { label:'Not Logged', val:loading?'—':notLogged, color:'rgba(255,255,255,0.5)' },
            ].map(k=>(
              <div key={k.label} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, padding:'14px 16px' }}>
                <div style={{ fontSize:26, fontWeight:800, color:k.color, lineHeight:1.1 }}>
                  {loading ? <span style={{ opacity:0.3 }}>—</span> : k.val}
                </div>
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', marginTop:4 }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          {total > 0 && (
            <div style={{ marginTop:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                <span style={{ fontSize:10, color:'rgba(255,255,255,0.4)', fontWeight:700, letterSpacing:'0.08em' }}>LOGGED TODAY</span>
                <span style={{ fontSize:11, color:'rgba(255,255,255,0.6)', fontWeight:700 }}>{attendance.length}/{total}</span>
              </div>
              <div className="satt-prog-bar">
                <div className="satt-prog-fill" style={{ width:`${total>0?(attendance.length/total)*100:0}%` }}/>
              </div>
            </div>
          )}
        </div>

        {/* ── Search + Log button ──────────────────────────────── */}
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <div style={{ flex:1, position:'relative' }}>
            <Search size={14} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', pointerEvents:'none' }}/>
            <input
              style={{ width:'100%', paddingLeft:36, paddingRight:12, paddingTop:10, paddingBottom:10, borderRadius:10, border:'1px solid var(--border)', background:'var(--card)', color:'var(--text)', fontSize:13, fontFamily:'inherit', outline:'none', boxSizing:'border-box' }}
              placeholder="Search employee…" value={search} onChange={e => setSearch(e.target.value)}/>
            {search && <button onClick={()=>setSearch('')} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:0, display:'flex' }}><X size={13}/></button>}
          </div>
          <button onClick={() => setModal(true)}
            style={{ display:'flex', alignItems:'center', gap:7, padding:'10px 18px', borderRadius:10, border:'none', background:'#B8860B', color:'white', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit', flexShrink:0, whiteSpace:'nowrap', transition:'background 0.15s' }}
            onMouseEnter={e=>e.currentTarget.style.background='#9a7209'}
            onMouseLeave={e=>e.currentTarget.style.background='#B8860B'}>
            <Plus size={14}/> Log Attendance
          </button>
        </div>

        {/* ── Week Navigator ───────────────────────────────────── */}
        <div className="satt-week-card">
          <div style={{ fontSize:10.5, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12 }}>Last 7 Days — click to navigate</div>
          <WeekNav weekDates={weekDates} weekMap={weekMap} employees={employees} selectedDate={date} onDayClick={d => setDate(d)}/>
        </div>

        {/* ── Employee List ────────────────────────────────────── */}
        <div className="satt-list">
          <div className="satt-list-hd">
            <div style={{ width:8, height:8, borderRadius:4, background:'#10B981' }}/>
            <span style={{ fontWeight:700, fontSize:13.5 }}>All Staff</span>
            <span style={{ color:'var(--text-muted)', fontSize:13 }}>({filtered.length})</span>
            <span style={{ marginLeft:'auto', fontSize:11.5, color:'var(--text-muted)', fontWeight:600 }}>7-day history</span>
          </div>

          {loading ? (
            <div style={{ padding:56, textAlign:'center' }}>
              <div style={{ width:32, height:32, border:'3px solid var(--border)', borderTopColor:'#B8860B', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 10px' }}/>
              <div style={{ fontSize:13, color:'var(--text-muted)' }}>Loading…</div>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding:56, textAlign:'center' }}>
              <Clock size={34} color="var(--border)" style={{ margin:'0 auto 10px' }}/>
              <div style={{ fontWeight:600, fontSize:14, color:'var(--text-muted)' }}>No employees match</div>
            </div>
          ) : filtered.map((emp) => {
            const att = attendance.find(a => a.emp_id === emp.id)
            const st  = att ? STATUS.find(s => s.v === att.status) : null
            return (
              <div key={emp.id} className="satt-row">
                <Avatar name={emp.name}/>
                <div className="satt-row-mid">
                  <div style={{ fontWeight:700, fontSize:13.5, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{emp.name}</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{emp.role || '—'}{emp.dept ? ` · ${emp.dept}` : ''}</div>
                </div>
                <WeekDots empId={emp.id} weekMap={weekMap} weekDates={weekDates} selectedDate={date} onDayClick={d => setDate(d)}/>
                <div className="satt-row-right">
                  {att ? (
                    <>
                      <span style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:20, background:st?.bg, border:`1px solid ${st?.border}`, color:st?.color, fontSize:12, fontWeight:700, whiteSpace:'nowrap' }}>
                        <span style={{ width:6, height:6, borderRadius:3, background:st?.dot }}/>
                        {st?.label}
                      </span>
                      <button onClick={() => deleteRecord(att.id)}
                        style={{ width:30, height:30, borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text-muted)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', transition:'all 0.15s', flexShrink:0 }}
                        onMouseEnter={e=>{e.currentTarget.style.background='#FEF2F2';e.currentTarget.style.color='#EF4444';e.currentTarget.style.borderColor='#FCA5A5'}}
                        onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color='var(--text-muted)';e.currentTarget.style.borderColor='var(--border)'}}>
                        <Trash2 size={13}/>
                      </button>
                    </>
                  ) : (
                    <span style={{ fontSize:11.5, color:'var(--text-muted)', background:'var(--bg-alt)', border:'1px solid var(--border)', padding:'5px 12px', borderRadius:20, fontWeight:500, whiteSpace:'nowrap' }}>Not logged</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

      </div>

      {modal && <LogModal employees={employees} date={date} onClose={() => setModal(false)} onSave={onSaved}/>}
    </>
  )
}
