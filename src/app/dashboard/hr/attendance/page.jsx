'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { attApi, empApi } from '@/lib/api'
import { useSocket } from '@/lib/socket'
import { Plus, X, Download, CheckSquare, Search } from 'lucide-react'

const CYCLES = ['A','B','C','Beset','MR','FM','Rescue']
const CYCLE_HRS = { A:5, B:4, C:5, Beset:5, MR:4, FM:5 }
const STATUS_BADGE = {
  present:  'badge-success',
  absent:   'badge-danger',
  leave:    'badge-warning',
  half_day: 'badge-gold',
}
const STATIONS = ['All','DDB1','DXE6']

function LogModal({ employees, onSave, onClose }) {
  const [form, setForm] = useState({
    emp_id:'', status:'present', check_in:'', check_out:'',
    cycle:'A', cycle_hours:'5', is_rescue:false, rescue_hours:'', note:''
  })
  const [saving, setSaving] = useState(false)
  const set = (k,v) => setForm(p => ({ ...p, [k]: v }))

  // Auto-fill hours from cycle
  function onCycleChange(c) {
    set('cycle', c)
    if (c !== 'Rescue') set('cycle_hours', String(CYCLE_HRS[c] || ''))
    set('is_rescue', c === 'Rescue')
  }

  const hours = form.is_rescue ? (parseFloat(form.rescue_hours)||0) : (parseFloat(form.cycle_hours)||0)
  const emp   = employees.find(e => e.emp_id === form.emp_id || e.id === form.emp_id)
  const rate  = parseFloat(emp?.hourly_rate || emp?.emp_hourly_rate || 3.85)
  const est   = hours > 0 ? (hours * rate).toFixed(2) : null

  async function handleSave() {
    if (!form.emp_id || !form.status) return
    setSaving(true)
    try {
      await attApi.log({
        emp_id: form.emp_id, status: form.status,
        check_in: form.check_in||null, check_out: form.check_out||null,
        cycle: form.cycle, cycle_hours: form.cycle_hours,
        is_rescue: form.is_rescue, rescue_hours: form.rescue_hours||null,
        note: form.note
      })
      onSave()
    } catch(e) { alert(e.message) } finally { setSaving(false) }
  }

  return createPortal(
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ maxWidth:460 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
          <h3 style={{ fontWeight:700, fontSize:16, color:'#1A1612' }}>Log Attendance</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={17}/></button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div>
            <label className="input-label">Driver *</label>
            <select className="input" value={form.emp_id} onChange={e=>set('emp_id',e.target.value)}>
              <option value="">Select driver…</option>
              {employees.map(e=><option key={e.id||e.emp_id} value={e.id||e.emp_id}>{e.name} {e.station_code?`(${e.station_code})`:''}</option>)}
            </select>
          </div>

          <div>
            <label className="input-label">Status *</label>
            <select className="input" value={form.status} onChange={e=>set('status',e.target.value)}>
              <option value="present">✅ Present</option>
              <option value="absent">❌ Absent</option>
              <option value="leave">🏖 On Leave</option>
              <option value="half_day">⏰ Half Day</option>
            </select>
          </div>

          {form.status === 'present' && <>
            <div>
              <label className="input-label">Cycle</label>
              <div className="cycle-grid">
                {CYCLES.map(c => (
                  <button key={c} type="button"
                    onClick={() => onCycleChange(c)}
                    style={{
                      padding:'8px 4px', borderRadius:8, border:`2px solid ${form.cycle===c?'#B8860B':'#EAE6DE'}`,
                      background: form.cycle===c ? '#FDF6E3' : '#FFFFFF',
                      color: form.cycle===c ? '#B8860B' : '#6B5D4A',
                      fontSize:12, fontWeight:600, cursor:'pointer', textAlign:'center'
                    }}>
                    {c}<br/>
                    <span style={{ fontSize:10, fontWeight:400, color:'#A89880' }}>
                      {c==='Rescue'?'—':`${CYCLE_HRS[c]}h`}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {form.is_rescue ? (
              <div>
                <label className="input-label">Rescue Hours *</label>
                <input className="input" type="number" step="0.25" value={form.rescue_hours}
                  onChange={e=>set('rescue_hours',e.target.value)} placeholder="e.g. 3.5"/>
              </div>
            ) : (
              <div>
                <label className="input-label">Hours <span style={{ color:'#A89880', fontSize:10 }}>(auto-filled by cycle, can override)</span></label>
                <input className="input" type="number" step="0.25" value={form.cycle_hours}
                  onChange={e=>set('cycle_hours',e.target.value)}/>
              </div>
            )}

            {est && (
              <div style={{ background:'#ECFDF5', border:'1px solid #A7F3D0', borderRadius:9, padding:'10px 14px' }}>
                <span style={{ fontSize:13, color:'#2E7D52', fontWeight:600 }}>
                  Estimated earnings: AED {est} ({hours}h × AED {rate}/hr)
                </span>
              </div>
            )}

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div><label className="input-label">Check In</label>
                <input className="input" type="time" value={form.check_in} onChange={e=>set('check_in',e.target.value)}/></div>
              <div><label className="input-label">Check Out</label>
                <input className="input" type="time" value={form.check_out} onChange={e=>set('check_out',e.target.value)}/></div>
            </div>
          </>}

          <div><label className="input-label">Note (optional)</label>
            <input className="input" value={form.note} onChange={e=>set('note',e.target.value)}/></div>
        </div>
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:18 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving||!form.emp_id}>
            {saving?'Saving…':'Log Attendance'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default function AttendancePage() {
  const [attendance,  setAttendance]  = useState([])
  const [employees,   setEmployees]   = useState([])
  const [loading,     setLoading]     = useState(true)
  const [date,        setDate]        = useState(new Date().toISOString().slice(0,10))
  const [stationFilter, setStationFilter] = useState('All')
  const [modal,       setModal]       = useState(false)
  const [viewTab,     setViewTab]     = useState('daily')   // daily | summary
  const [userRole,    setUserRole]    = useState(null)
  const [search,      setSearch]      = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)

  useEffect(() => {
    try { const t=localStorage.getItem('gcd_token'); if(t){const p=JSON.parse(atob(t.split('.')[1]));setUserRole(p.role)} } catch(e){}
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { date }
      if (stationFilter !== 'All') params.station_code = stationFilter
      const [att, emps] = await Promise.all([attApi.list(params), empApi.list()])
      setAttendance(att.attendance)
      setEmployees(emps.employees)
    } catch(e) { console.error(e) } finally { setLoading(false) }
  }, [date, stationFilter])

  useEffect(() => { load() }, [load])
  useSocket({
    'attendance:updated': row => setAttendance(p => {
      const i = p.findIndex(a => a.emp_id===row.emp_id && a.date===date)
      return i >= 0 ? p.map(a => a.emp_id===row.emp_id&&a.date===date ? {...a,...row} : a) : [...p, row]
    })
  })

  async function handleBulkPresent() {
    const unlogged = employees.filter(e => {
      const station = stationFilter === 'All' ? true : e.station_code === stationFilter
      const alreadyLogged = attendance.some(a => (a.emp_id === e.id || a.emp_id === e.emp_id) && a.status === 'present')
      return station && !alreadyLogged
    })
    if (unlogged.length === 0) return alert('All employees already have attendance for this date.')
    if (!confirm(`Mark ${unlogged.length} employee(s) as Present with Cycle A (5h)?`)) return
    setBulkLoading(true)
    try {
      const records = unlogged.map(e => ({
        emp_id: e.id || e.emp_id, date, status: 'present', cycle: 'A', cycle_hours: '5'
      }))
      await attApi.bulkLog(records)
      load()
    } catch(e) { alert(e.message) } finally { setBulkLoading(false) }
  }

  async function handleCheckout(att) {
    const time = new Date().toTimeString().slice(0,5)
    try { await attApi.checkout(att.id, time); load() } catch(e) { alert(e.message) }
  }

  const filtered = search.trim()
    ? attendance.filter(a => a.name?.toLowerCase().includes(search.toLowerCase()))
    : attendance

  const present  = attendance.filter(a=>a.status==='present').length
  const absent   = attendance.filter(a=>a.status==='absent').length
  const onLeave  = attendance.filter(a=>a.status==='leave').length
  const totalEarnings = attendance.reduce((s,a)=>s+parseFloat(a.earnings||0),0)
  const totalHours    = attendance.reduce((s,a)=>s+parseFloat(a.cycle_hours||0),0)

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16, animation:'slideUp 0.35s ease' }}>
      {/* Controls */}
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
        <input className="input" type="date" value={date} onChange={e=>setDate(e.target.value)} style={{ width:180 }}/>
        {STATIONS.map(s => (
          <button key={s} onClick={()=>setStationFilter(s)}
            className={`btn btn-sm ${stationFilter===s?'btn-primary':'btn-secondary'}`}>{s}</button>
        ))}
        <div style={{ position:'relative', flex:'0 0 180px' }}>
          <Search size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', pointerEvents:'none' }}/>
          <input className="input" placeholder="Search name…" value={search} onChange={e=>setSearch(e.target.value)} style={{ paddingLeft:30 }}/>
        </div>
        <div style={{ flex:1 }}/>
        <button className="btn btn-secondary btn-sm"><Download size={13}/> Export</button>
        {userRole !== 'accountant' && userRole !== 'driver' && (<>
          <button className="btn btn-secondary" onClick={handleBulkPresent} disabled={bulkLoading}>
            <CheckSquare size={14}/> {bulkLoading ? 'Marking…' : 'Mark All Present'}
          </button>
          <button className="btn btn-primary" onClick={()=>setModal(true)}><Plus size={14}/> Log Attendance</button>
        </>)}
      </div>

      {/* KPIs */}
      <div className="attendance-kpi-grid" style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12 }}>
        {[
          { l:'Present',   v:present,                   c:'#2E7D52', bg:'#ECFDF5', bc:'#A7F3D0' },
          { l:'Absent',    v:absent,                    c:'#C0392B', bg:'#FEF2F2', bc:'#FCA5A5' },
          { l:'On Leave',  v:onLeave,                   c:'#B45309', bg:'#FFFBEB', bc:'#FCD34D' },
          { l:'Total Hours', v:`${totalHours.toFixed(1)}h`, c:'#1D6FA4', bg:'#EFF6FF', bc:'#BFDBFE' },
          { l:'Est. Earnings', v:`AED ${totalEarnings.toFixed(0)}`, c:'#B8860B', bg:'#FDF6E3', bc:'#F0D78C' },
        ].map((s,i) => (
          <div key={s.l} className="stat-card" style={{ textAlign:'center', background:s.bg, border:`1px solid ${s.bc}`, animationDelay:`${i*0.06}s` }}>
            <div style={{ fontWeight:800, fontSize:22, color:s.c, letterSpacing:'-0.04em' }}>{s.v}</div>
            <div style={{ fontSize:11, color:s.c, fontWeight:600, marginTop:3 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        {loading ? <div style={{ padding:40, textAlign:'center', color:'#A89880' }}>Loading…</div> : (
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr>
                <th>Driver</th><th>Station</th><th>Status</th>
                <th>Cycle</th><th>Hours</th><th>Rate</th><th>Earnings</th>
                <th className="hide-mobile">Check In</th><th className="hide-mobile">Check Out</th>
                <th></th>
              </tr></thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={10} style={{ textAlign:'center', padding:40, color:'#A89880' }}>
                    {search ? 'No matches found.' : `No attendance records for ${date}`}
                  </td></tr>
                )}
                {filtered.map(att => (
                  <tr key={att.id}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:16 }}>{att.avatar}</span>
                        <div>
                          <div style={{ fontWeight:600, color:'#1A1612', fontSize:13 }}>{att.name}</div>
                          <div style={{ fontSize:10, color:'#C4B49A', fontFamily:'inherit' }}>{att.emp_id}</div>
                        </div>
                      </div>
                    </td>
                    <td><span style={{ fontSize:11, fontWeight:700, color:'#B8860B', background:'#FDF6E3', border:'1px solid #F0D78C', borderRadius:5, padding:'1px 6px' }}>{att.station_code||'—'}</span></td>
                    <td><span className={`badge ${STATUS_BADGE[att.status]||'badge-muted'}`}>{att.status?.replace('_',' ')}</span></td>
                    <td>{att.cycle ? <span style={{ fontSize:12, fontWeight:700, color:'#6B5D4A', background:'#F5F4F1', borderRadius:5, padding:'2px 8px' }}>{att.cycle}{att.is_rescue?' 🆘':''}</span> : '—'}</td>
                    <td style={{ fontFamily:'inherit', fontWeight:600, color:'#1D6FA4' }}>{att.cycle_hours ? `${att.cycle_hours}h` : '—'}</td>
                    <td style={{ fontFamily:'inherit', fontSize:12 }}>{att.hourly_rate ? `${att.hourly_rate}/hr` : '—'}</td>
                    <td style={{ fontFamily:'inherit', fontWeight:700, color:'#2E7D52' }}>{att.earnings ? `AED ${parseFloat(att.earnings).toFixed(2)}` : '—'}</td>
                    <td className="hide-mobile" style={{ fontFamily:'inherit', fontSize:12, color:'#6B5D4A' }}>{att.check_in||'—'}</td>
                    <td className="hide-mobile" style={{ fontFamily:'inherit', fontSize:12, color:'#A89880' }}>{att.check_out||'—'}</td>
                    <td>
                      {att.status==='present' && att.check_in && !att.check_out && userRole !== 'accountant' && (
                        <button className="btn btn-secondary btn-sm" onClick={()=>handleCheckout(att)}>Check Out</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && <LogModal employees={employees} onClose={()=>setModal(false)} onSave={()=>{setModal(false);load()}}/>}
    </div>
  )
}
