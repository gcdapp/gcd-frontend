'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Plus, X, Pencil, Trash2, AlertCircle, Calendar, RefreshCw } from 'lucide-react'
import { differenceInDays, parseISO } from 'date-fns'
import { API } from '@/lib/api'

function hdr() { return { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('gcd_token')}` } }

const EVENT_TYPES = [
  { v: 'renewal',  l: 'Renewal',  color: '#1D4ED8', bg: '#EFF6FF' },
  { v: 'meeting',  l: 'Meeting',  color: '#6D28D9', bg: '#F5F3FF' },
  { v: 'deadline', l: 'Deadline', color: '#B91C1C', bg: '#FEF2F2' },
  { v: 'payment',  l: 'Payment',  color: '#B45309', bg: '#FFFBEB' },
  { v: 'holiday',  l: 'Holiday',  color: '#047857', bg: '#F0FDF4' },
  { v: 'other',    l: 'Other',    color: '#4B5563', bg: '#F9FAFB' },
]
const evtMap = Object.fromEntries(EVENT_TYPES.map(e => [e.v, e]))

function Lbl({ children }) {
  return <label style={{ display:'block', fontSize:10.5, fontWeight:700, letterSpacing:'0.07em', textTransform:'uppercase', color:'var(--text-muted)', marginBottom:5 }}>{children}</label>
}

/* ══ EVENT MODAL ════════════════════════════════════════════════ */
function EventModal({ event, onSave, onClose }) {
  const [form, setForm] = useState(event ? {
    title: event.title||'', description: event.description||'',
    event_date: event.event_date?.slice(0,10)||'', event_type: event.event_type||'other',
  } : { title:'', description:'', event_date:'', event_type:'other' })
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState(null)
  function set(k,v) { setForm(p=>({...p,[k]:v})) }

  async function handleSave() {
    if (!form.title||!form.event_date) return setErr('Title and date are required')
    setSaving(true); setErr(null)
    try {
      const url    = event ? `${API}/api/office/events/${event.id}` : `${API}/api/office/events`
      const method = event ? 'PUT' : 'POST'
      const r = await fetch(url, { method, headers: hdr(), body: JSON.stringify(form) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error||'Failed')
      onSave()
    } catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  return createPortal(
    <div className="modal-overlay">
      <div style={{ background:'var(--card)', borderRadius:20, width:'100%', maxWidth:440, maxHeight:'92vh', overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)' }}>
        <div style={{ padding:'22px 24px 18px', borderBottom:'1px solid var(--border)', flexShrink:0, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h3 style={{ fontWeight:800, fontSize:15, color:'var(--text)', margin:0 }}>{event?'Edit Event':'Add Event'}</h3>
          <button onClick={onClose} style={{ width:30, height:30, borderRadius:'50%', background:'var(--bg-alt)', border:'1px solid var(--border)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><X size={14}/></button>
        </div>
        <div style={{ padding:'20px 24px', overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:14 }}>
          {err && <div style={{ display:'flex', gap:8, alignItems:'center', background:'var(--red-bg)', border:'1px solid var(--red-border)', borderRadius:10, padding:'10px 14px', fontSize:12.5, color:'var(--red)' }}><AlertCircle size={14}/>{err}</div>}
          <div>
            <Lbl>Event Type</Lbl>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {EVENT_TYPES.map(t=>(
                <button key={t.v} type="button" onClick={()=>set('event_type',t.v)}
                  style={{ padding:'5px 13px', borderRadius:20, border:`1.5px solid ${form.event_type===t.v?t.color:'var(--border)'}`, background:form.event_type===t.v?t.bg:'var(--card)', color:form.event_type===t.v?t.color:'var(--text-muted)', fontSize:11.5, fontWeight:700, cursor:'pointer', transition:'all 0.15s', fontFamily:'Poppins,sans-serif' }}>
                  {t.l}
                </button>
              ))}
            </div>
          </div>
          <div><Lbl>Title *</Lbl><input className="input" value={form.title} onChange={e=>set('title',e.target.value)} placeholder="e.g. Commercial License Renewal"/></div>
          <div><Lbl>Date *</Lbl><input className="input" type="date" value={form.event_date} onChange={e=>set('event_date',e.target.value)}/></div>
          <div><Lbl>Description</Lbl><textarea className="input" rows={2} value={form.description} onChange={e=>set('description',e.target.value)} placeholder="Details, responsible person…" style={{ resize:'vertical' }}/></div>
        </div>
        <div style={{ padding:'14px 24px 20px', borderTop:'1px solid var(--border)', display:'flex', gap:10, justifyContent:'flex-end', flexShrink:0 }}>
          <button onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ minWidth:110, justifyContent:'center' }}>
            {saving?'Saving…':event?'Save':'Add Event'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

/* ══ MAIN PAGE ══════════════════════════════════════════════════ */
export default function EventsPage() {
  const [events,   setEvents]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [evtModal, setEvtModal] = useState(null)
  const [userRole, setUserRole] = useState(null)

  useEffect(() => {
    try { const t=localStorage.getItem('gcd_token'); if(t){const p=JSON.parse(atob(t.split('.')[1]));setUserRole(p.role)} } catch(e){}
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`${API}/api/office/events`, { headers: hdr() })
      const d = await r.json()
      setEvents(d.events||[])
    } catch(e) { console.error(e) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function deleteEvt(id) {
    if (!confirm('Delete this event?')) return
    await fetch(`${API}/api/office/events/${id}`, { method:'DELETE', headers:hdr() })
    setEvents(p=>p.filter(e=>e.id!==id))
  }

  const today    = new Date(); today.setHours(0,0,0,0)
  const upcoming = events.filter(e=>{ if(!e.event_date) return false; const d=new Date(e.event_date); d.setHours(0,0,0,0); return d>=today }).sort((a,b)=>new Date(a.event_date)-new Date(b.event_date))
  const past     = events.filter(e=>{ if(!e.event_date) return false; const d=new Date(e.event_date); d.setHours(0,0,0,0); return d<today  }).sort((a,b)=>new Date(b.event_date)-new Date(a.event_date))
  const todayEvt = upcoming.filter(e=>{ const d=new Date(e.event_date); d.setHours(0,0,0,0); return d.getTime()===today.getTime() })

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* ── Header ── */}
      <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:18, overflow:'hidden', boxShadow:'var(--shadow)' }}>
        <div style={{ height:4, background:'linear-gradient(90deg,#B8934A,#E8C97A,#B8934A)' }}/>
        <div className="page-header" style={{ padding:'18px 22px', margin:0 }}>
          <div>
            <h1 style={{ fontWeight:900, fontSize:22, color:'var(--text)', margin:0, letterSpacing:'-0.03em' }}>Events</h1>
            <p style={{ fontSize:12.5, color:'var(--text-muted)', marginTop:2 }}>Track renewals, meetings, deadlines &amp; payments</p>
          </div>
          <div className="page-header-actions">
            <button onClick={load} title="Refresh" style={{ width:36, height:36, borderRadius:'50%', background:'var(--bg-alt)', border:'1px solid var(--border)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <RefreshCw size={14} color="var(--text-muted)"/>
            </button>
            <button className="btn btn-primary" onClick={()=>setEvtModal({mode:'add'})}>
              <Plus size={14}/> Add Event
            </button>
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="r-grid-4">
        {[
          { l:'Total Events',    v:events.length,   c:'#1D4ED8', bg:'#EFF6FF', bc:'#BFDBFE' },
          { l:'Upcoming',        v:upcoming.length, c:'#047857', bg:'#F0FDF4', bc:'#A7F3D0' },
          { l:'Today',           v:todayEvt.length, c:'#DC2626', bg:'#FEF2F2', bc:'#FECACA' },
          { l:'Past',            v:past.length,     c:'#6B7280', bg:'#F9FAFB', bc:'#E5E7EB' },
        ].map(s=>(
          <div key={s.l} style={{ background:s.bg, border:`1px solid ${s.bc}`, borderRadius:16, padding:'18px 16px', textAlign:'center', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ fontWeight:900, fontSize:30, color:s.c, letterSpacing:'-0.04em', lineHeight:1 }}>{s.v}</div>
            <div style={{ fontSize:11, color:s.c, fontWeight:600, marginTop:7, opacity:0.8 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* ── Today's events banner ── */}
      {todayEvt.length>0 && (
        <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:12, padding:'11px 16px', display:'flex', alignItems:'center', gap:10 }}>
          <Calendar size={15} color="#DC2626"/>
          <span style={{ fontSize:13, fontWeight:700, color:'#DC2626' }}>Today:</span>
          <span style={{ fontSize:12.5, color:'#7F1D1D' }}>{todayEvt.map(e=>e.title).join(' · ')}</span>
        </div>
      )}

      {/* ── Main Content ── */}
      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {[1,2,3].map(i=><div key={i} className="sk" style={{ height:72, borderRadius:12 }}/>)}
        </div>
      ) : events.length===0 ? (
        <div style={{ textAlign:'center', padding:'80px 20px' }}>
          <div style={{ fontSize:40, marginBottom:12 }}>📅</div>
          <div style={{ fontWeight:700, fontSize:16, color:'var(--text-sub)' }}>No events yet</div>
          <div style={{ fontSize:12.5, color:'var(--text-muted)', marginTop:4 }}>Track renewals, meetings, deadlines and payments</div>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }} className="events-grid">

          {/* Upcoming */}
          <div>
            <div style={{ fontSize:11, fontWeight:800, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12, display:'flex', alignItems:'center', gap:6 }}>
              <Calendar size={12}/> Upcoming · {upcoming.length}
            </div>
            {upcoming.length===0
              ? <div style={{ textAlign:'center', padding:'24px', color:'var(--text-muted)', fontSize:12, background:'var(--bg-alt)', borderRadius:12 }}>No upcoming events</div>
              : <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {upcoming.map(ev=>{
                    const et = evtMap[ev.event_type]||evtMap.other
                    const daysAway = differenceInDays(parseISO(ev.event_date.slice(0,10)), new Date())
                    const isToday  = daysAway===0
                    const isSoon   = daysAway<=7
                    return (
                      <div key={ev.id} style={{ background:'var(--card)', border:`1px solid ${isSoon?et.color+'40':'var(--border)'}`, borderLeft:`4px solid ${et.color}`, borderRadius:12, padding:'12px 14px', display:'flex', gap:12, alignItems:'flex-start' }}>
                        <div style={{ flexShrink:0, textAlign:'center', minWidth:40, paddingTop:2 }}>
                          <div style={{ fontSize:20, fontWeight:900, color:et.color, lineHeight:1 }}>{new Date(ev.event_date).toLocaleDateString('en-AE',{day:'numeric'})}</div>
                          <div style={{ fontSize:9, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', marginTop:1 }}>{new Date(ev.event_date).toLocaleDateString('en-AE',{month:'short'})}</div>
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:3 }}>
                            <span style={{ fontSize:9.5, fontWeight:700, color:et.color, background:et.bg, borderRadius:5, padding:'1px 7px' }}>{et.l}</span>
                            {isToday  && <span style={{ fontSize:9.5, fontWeight:800, color:'#DC2626', background:'#FEF2F2', borderRadius:5, padding:'1px 7px' }}>TODAY</span>}
                            {!isToday&&isSoon && <span style={{ fontSize:9.5, fontWeight:800, color:'#D97706', background:'#FFFBEB', borderRadius:5, padding:'1px 7px' }}>{daysAway}d</span>}
                          </div>
                          <div style={{ fontWeight:700, fontSize:13.5, color:'var(--text)' }}>{ev.title}</div>
                          {ev.description && <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{ev.description}</div>}
                          {ev.created_by_name && <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:4 }}>Added by {ev.created_by_name}</div>}
                        </div>
                        <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                          <button onClick={()=>setEvtModal({mode:'edit',event:ev})} style={{ width:28, height:28, borderRadius:8, background:'var(--bg-alt)', border:'1px solid var(--border)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><Pencil size={11} color="var(--text-sub)"/></button>
                          <button onClick={()=>deleteEvt(ev.id)} style={{ width:28, height:28, borderRadius:8, background:'var(--red-bg)', border:'1px solid var(--red-border)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><Trash2 size={11} color="var(--red)"/></button>
                        </div>
                      </div>
                    )
                  })}
                </div>
            }
          </div>

          {/* Past */}
          <div>
            <div style={{ fontSize:11, fontWeight:800, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12, display:'flex', alignItems:'center', gap:6 }}>
              <Calendar size={12}/> Past · {past.length}
            </div>
            {past.length===0
              ? <div style={{ textAlign:'center', padding:'24px', color:'var(--text-muted)', fontSize:12, background:'var(--bg-alt)', borderRadius:12 }}>No past events</div>
              : <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {past.slice(0,12).map(ev=>{
                    const et = evtMap[ev.event_type]||evtMap.other
                    return (
                      <div key={ev.id} style={{ background:'var(--bg-alt)', border:'1px solid var(--border)', borderLeft:`4px solid ${et.color}80`, borderRadius:12, padding:'11px 14px', display:'flex', gap:12, alignItems:'flex-start', opacity:0.65 }}>
                        <div style={{ flexShrink:0, textAlign:'center', minWidth:40, paddingTop:2 }}>
                          <div style={{ fontSize:18, fontWeight:800, color:'var(--text-muted)', lineHeight:1 }}>{new Date(ev.event_date).toLocaleDateString('en-AE',{day:'numeric'})}</div>
                          <div style={{ fontSize:9, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', marginTop:1 }}>{new Date(ev.event_date).toLocaleDateString('en-AE',{month:'short'})}</div>
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <span style={{ fontSize:9.5, fontWeight:700, color:et.color, background:et.bg, borderRadius:5, padding:'1px 7px', marginBottom:3, display:'inline-block' }}>{et.l}</span>
                          <div style={{ fontWeight:600, fontSize:12.5, color:'var(--text-sub)' }}>{ev.title}</div>
                          {ev.description && <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{ev.description}</div>}
                        </div>
                        <button onClick={()=>deleteEvt(ev.id)} style={{ width:26, height:26, borderRadius:7, background:'var(--red-bg)', border:'1px solid var(--red-border)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><Trash2 size={10} color="var(--red)"/></button>
                      </div>
                    )
                  })}
                </div>
            }
          </div>
        </div>
      )}

      {evtModal && <EventModal event={evtModal.mode==='edit'?evtModal.event:null} onSave={()=>{setEvtModal(null);load()}} onClose={()=>setEvtModal(null)}/>}
    </div>
  )
}
