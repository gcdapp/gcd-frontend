'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Plus, X, Calendar, Users, Truck, Coffee, AlertTriangle, Copy } from 'lucide-react'

import { API } from '@/lib/api'
function hdr() { return { 'Content-Type':'application/json', Authorization:`Bearer ${localStorage.getItem('gcd_token')}` } }

const SHIFT_CFG = {
  regular: { l:'Regular',  c:'#2E7D52', bg:'#ECFDF5', bc:'#A7F3D0', icon:'🚗' },
  rescue:  { l:'Rescue',   c:'#C0392B', bg:'#FEF2F2', bc:'#FCA5A5', icon:'🆘' },
  off:     { l:'Day Off',  c:'#78716C', bg:'#F5F4F1', bc:'#EAE6DE', icon:'🛌' },
  leave:   { l:'On Leave', c:'#B45309', bg:'#FFFBEB', bc:'#FCD34D', icon:'🏖' },
}
const CYCLES = ['A','B','C','D','E','E1','F']
const STATIONS = ['DDB1','DXE6']

function getWeekDates(startDate) {
  return Array.from({length:7},(_,i)=>{
    const d = new Date(startDate)
    d.setDate(d.getDate()+i)
    return d.toISOString().slice(0,10)
  })
}

function getMonday(date=new Date()) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day===0?-6:1)
  d.setDate(diff)
  return d.toISOString().slice(0,10)
}

function ShiftCell({ shift, empId, date, station, onAssign }) {
  const [open,    setOpen]    = useState(false)
  const [type,    setType]    = useState(shift?.shift_type||'regular')
  const [cycle,   setCycle]   = useState(shift?.cycle||'')
  const [saving,  setSaving]  = useState(false)
  const cfg = SHIFT_CFG[shift?.shift_type||''] 

  async function save() {
    setSaving(true)
    try {
      await fetch(`${API}/api/shifts`, { method:'POST', headers:hdr(),
        body:JSON.stringify({ emp_id:empId, shift_date:date, shift_type:type, cycle:cycle||null, station_code:station })})
      onAssign(); setOpen(false)
    } catch(e){} finally{setSaving(false)}
  }

  async function clear() {
    if (!shift) return
    await fetch(`${API}/api/shifts/${shift.id}`, { method:'DELETE', headers:{ Authorization:`Bearer ${localStorage.getItem('gcd_token')}` }})
    onAssign()
  }

  return (
    <div style={{position:'relative'}}>
      <div onClick={()=>setOpen(o=>!o)}
        style={{cursor:'pointer',padding:'6px 8px',borderRadius:9,background:cfg?cfg.bg:'#FAFAF8',border:`1px solid ${cfg?cfg.bc:'#EAE6DE'}`,minHeight:52,transition:'all 0.15s'}}
        onMouseEnter={e=>e.currentTarget.style.transform='scale(1.03)'}
        onMouseLeave={e=>e.currentTarget.style.transform='none'}>
        {shift ? (
          <>
            <div style={{fontSize:14,textAlign:'center',marginBottom:2}}>{cfg?.icon||'🚗'}</div>
            <div style={{fontSize:10,fontWeight:700,color:cfg?.c||'#6B5D4A',textAlign:'center',lineHeight:1.2}}>{cfg?.l||shift.shift_type}</div>
            {shift.cycle && <div style={{fontSize:10,color:'rgba(0,0,0,0.4)',textAlign:'center',fontWeight:600}}>{shift.cycle}</div>}
          </>
        ) : (
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:40,color:'#EAE6DE'}}>
            <Plus size={14}/>
          </div>
        )}
      </div>
      {open && (
        <div style={{position:'fixed',zIndex:200,background:'#FFF',border:'1.5px solid #EAE6DE',borderRadius:14,padding:14,boxShadow:'0 8px 32px rgba(0,0,0,0.15)',width:200}} onClick={e=>e.stopPropagation()}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
            <span style={{fontSize:12,fontWeight:700,color:'#1A1612'}}>{date}</span>
            <button onClick={()=>setOpen(false)} style={{border:'none',background:'none',cursor:'pointer',color:'#78716C',fontSize:16}}>×</button>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:10}}>
            {Object.entries(SHIFT_CFG).map(([k,v])=>(
              <button key={k} onClick={()=>setType(k)} style={{padding:'7px 4px',borderRadius:8,border:`2px solid ${type===k?v.c:'#EAE6DE'}`,background:type===k?v.bg:'#FFF',cursor:'pointer',fontFamily:'inherit',textAlign:'center',fontSize:10,fontWeight:700,color:type===k?v.c:'#78716C',transition:'all 0.15s'}}>
                {v.icon} {v.l}
              </button>
            ))}
          </div>
          {type==='regular'&&<>
            <label style={{fontSize:10,fontWeight:700,color:'#78716C',textTransform:'uppercase',letterSpacing:'0.06em',display:'block',marginBottom:5}}>Cycle</label>
            <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:10}}>
              {CYCLES.map(c=>(
                <button key={c} onClick={()=>setCycle(cycle===c?'':c)} style={{padding:'4px 9px',borderRadius:7,border:`1.5px solid ${cycle===c?'#8F6807':'#EAE6DE'}`,background:cycle===c?'#FDF6E3':'#FFF',color:cycle===c?'#8F6807':'#78716C',fontWeight:700,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>
                  {c}
                </button>
              ))}
            </div>
          </>}
          <div style={{display:'flex',gap:6}}>
            {shift&&<button onClick={clear} style={{flex:1,padding:'7px',borderRadius:100,background:'#FEF2F2',border:'1px solid #FCA5A5',color:'#C0392B',fontWeight:700,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>Clear</button>}
            <button onClick={save} disabled={saving} style={{flex:2,padding:'7px',borderRadius:100,background:'linear-gradient(135deg,#8F6807,#D4A017)',border:'none',color:'white',fontWeight:700,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>
              {saving?'Saving…':'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function RosterPage() {
  const [weekStart, setWeekStart]   = useState(getMonday())
  const [station,   setStation]     = useState('DDB1')
  const [employees, setEmployees]   = useState([])
  const [shifts,    setShifts]      = useState([])
  const [loading,   setLoading]     = useState(true)
  const [copying,   setCopying]     = useState(false)

  const weekDates = getWeekDates(weekStart)
  const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [emps, sh] = await Promise.all([
        fetch(`${API}/api/employees?station_code=${station}&status=active`, {headers:{Authorization:`Bearer ${localStorage.getItem('gcd_token')}`}}).then(r=>r.json()),
        fetch(`${API}/api/shifts?week=${weekStart}&station_code=${station}`, {headers:{Authorization:`Bearer ${localStorage.getItem('gcd_token')}`}}).then(r=>r.json()),
      ])
      setEmployees(emps.employees||[])
      setShifts(sh.shifts||[])
    } catch(e){} finally{setLoading(false)}
  }, [weekStart, station])

  useEffect(()=>{load()},[load])

  function getShift(empId, date) { return shifts.find(s=>s.emp_id===empId && s.shift_date===date) }

  function prevWeek() { const d=new Date(weekStart); d.setDate(d.getDate()-7); setWeekStart(d.toISOString().slice(0,10)) }
  function nextWeek() { const d=new Date(weekStart); d.setDate(d.getDate()+7); setWeekStart(d.toISOString().slice(0,10)) }

  async function copyLastWeek() {
    const lastWeekStart = (() => { const d=new Date(weekStart); d.setDate(d.getDate()-7); return d.toISOString().slice(0,10) })()
    const lastWeekDates = getWeekDates(lastWeekStart)
    setCopying(true)
    try {
      const res = await fetch(`${API}/api/shifts?week=${lastWeekStart}&station_code=${station}`, {
        headers:{ Authorization:`Bearer ${localStorage.getItem('gcd_token')}` }
      })
      const data = await res.json()
      const lastShifts = data.shifts || []
      if (lastShifts.length === 0) { alert('No shifts found in the previous week to copy.'); setCopying(false); return }
      const copies = lastShifts.map((s, i) => {
        const dayIdx = lastWeekDates.indexOf(s.shift_date)
        if (dayIdx < 0) return null
        return fetch(`${API}/api/shifts`, { method:'POST', headers:hdr(),
          body:JSON.stringify({ emp_id:s.emp_id, shift_date:weekDates[dayIdx], shift_type:s.shift_type, cycle:s.cycle||null, station_code:s.station_code })
        })
      }).filter(Boolean)
      await Promise.all(copies)
      load()
    } catch(e) { alert('Failed to copy shifts') } finally { setCopying(false) }
  }

  const today = new Date().toISOString().slice(0,10)

  // Stats
  const shiftCounts = weekDates.map(d=>({
    date:d,
    regular: shifts.filter(s=>s.shift_date===d&&s.shift_type==='regular').length,
    off:     shifts.filter(s=>s.shift_date===d&&(s.shift_type==='off'||s.shift_type==='leave')).length,
  }))

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16,animation:'slideUp 0.35s ease'}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{fontWeight:900,fontSize:22,color:'#1A1612',letterSpacing:'-0.03em',display:'flex',alignItems:'center',gap:10}}>
            <Calendar size={22} color="#8F6807"/> Weekly Roster
          </h1>
          <p style={{fontSize:12,color:'#78716C',marginTop:3}}>Plan and assign shifts for the week</p>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {STATIONS.map(s=>(
            <button key={s} onClick={()=>setStation(s)} style={{padding:'7px 16px',borderRadius:20,border:`1.5px solid ${station===s?'#8F6807':'#EAE6DE'}`,background:station===s?'#FDF6E3':'#FFF',color:station===s?'#8F6807':'#78716C',fontWeight:station===s?700:500,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Week navigator */}
      <div style={{display:'flex',alignItems:'center',gap:12,background:'#FFF',border:'1px solid #EAE6DE',borderRadius:14,padding:'12px 16px'}}>
        <button onClick={prevWeek} style={{width:32,height:32,borderRadius:'50%',background:'#F5F4F1',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}><ChevronLeft size={15}/></button>
        <div style={{flex:1,textAlign:'center'}}>
          <div style={{fontWeight:800,fontSize:14,color:'#1A1612'}}>{weekDates[0]} — {weekDates[6]}</div>
          <div style={{fontSize:11,color:'#78716C',marginTop:2}}>{employees.length} DAs · {station}</div>
        </div>
        <button onClick={nextWeek} style={{width:32,height:32,borderRadius:'50%',background:'#F5F4F1',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}><ChevronRight size={15}/></button>
        <button onClick={()=>setWeekStart(getMonday())} style={{padding:'6px 14px',borderRadius:100,background:'#FDF6E3',border:'1px solid #F0D78C',color:'#8F6807',fontWeight:700,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>Today</button>
        <button onClick={copyLastWeek} disabled={copying} style={{padding:'6px 14px',borderRadius:100,background:'var(--bg-alt)',border:'1px solid var(--border-med)',color:'var(--text-sub)',fontWeight:600,fontSize:11,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',gap:5}}>
          <Copy size={12}/>{copying?'Copying…':'Copy Last Week'}
        </button>
      </div>

      {/* Coverage summary */}
      <div style={{overflowX:'auto',WebkitOverflowScrolling:'touch'}}><div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:6,minWidth:420}}>
        {shiftCounts.map((d,i)=>{
          const isToday = d.date===today
          return (
            <div key={d.date} style={{textAlign:'center',padding:'8px 4px',borderRadius:10,background:isToday?'#FDF6E3':'#FAFAF8',border:`1px solid ${isToday?'#F0D78C':'#EAE6DE'}`}}>
              <div style={{fontSize:10,fontWeight:700,color:isToday?'#8F6807':'#78716C'}}>{DAYS[i]}</div>
              <div style={{fontSize:11,fontWeight:800,color:'#2E7D52',marginTop:3}}>{d.regular} 🚗</div>
              {d.off>0&&<div style={{fontSize:10,color:'#78716C'}}>{d.off} off</div>}
            </div>
          )
        })}
      </div></div>

      {/* Roster grid */}
      {loading ? (
        <div className="skeleton" style={{height:300,borderRadius:16}}/>
      ) : employees.length===0 ? (
        <div style={{textAlign:'center',padding:60,color:'#78716C'}}>
          <Users size={40} style={{margin:'0 auto 12px',display:'block',opacity:0.2}}/>
          <div style={{fontWeight:600,color:'#6B5D4A'}}>No active DAs found for {station}</div>
        </div>
      ) : (
        <div style={{overflowX:'auto'}}>
          <div style={{minWidth:900}}>
            {/* Header row */}
            <div style={{display:'grid',gridTemplateColumns:'180px repeat(7,1fr)',gap:6,marginBottom:6}}>
              <div/>
              {weekDates.map((d,i)=>{
                const isToday = d===today
                return (
                  <div key={d} style={{textAlign:'center',padding:'8px 4px',borderRadius:10,background:isToday?'linear-gradient(135deg,#FDF6E3,#FEF9F0)':'transparent',border:isToday?'1px solid #F0D78C':'1px solid transparent'}}>
                    <div style={{fontWeight:800,fontSize:11,color:isToday?'#8F6807':'#6B5D4A'}}>{DAYS[i]}</div>
                    <div style={{fontSize:10,color:isToday?'#8F6807':'#78716C',marginTop:1}}>{d.slice(5)}</div>
                  </div>
                )
              })}
            </div>
            {/* Employee rows */}
            {employees.map((emp,ei)=>(
              <div key={emp.id} style={{display:'grid',gridTemplateColumns:'180px repeat(7,1fr)',gap:6,marginBottom:6,animation:`slideUp 0.3s ${ei*0.03}s ease both`}}>
                <div style={{display:'flex',alignItems:'center',gap:8,padding:'6px 10px',background:'#FFF',borderRadius:10,border:'1px solid #EAE6DE'}}>
                  <div style={{width:34,height:34,borderRadius:10,background:'linear-gradient(135deg,#FDF6E3,#FEF3D0)',border:'1px solid #F0D78C',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:900,color:'#8F6807',flexShrink:0}}>
                    {emp.name?.slice(0,2).toUpperCase()}
                  </div>
                  <div style={{minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:12,color:'#1A1612',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{emp.name}</div>
                    <div style={{fontSize:10,color:'#78716C',marginTop:1,fontFamily:'inherit'}}>{emp.id}</div>
                  </div>
                </div>
                {weekDates.map(date=>(
                  <ShiftCell key={date} shift={getShift(emp.id,date)} empId={emp.id} date={date} station={station} onAssign={load}/>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
        {Object.entries(SHIFT_CFG).map(([k,v])=>(
          <div key={k} style={{display:'flex',alignItems:'center',gap:5,padding:'5px 11px',borderRadius:20,background:v.bg,border:`1px solid ${v.bc}`}}>
            <span style={{fontSize:13}}>{v.icon}</span>
            <span style={{fontSize:11,fontWeight:700,color:v.c}}>{v.l}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
