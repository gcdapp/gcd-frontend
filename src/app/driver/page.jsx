'use client'
import HandoverModal from '@/components/HandoverModal'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { leaveApi } from '@/lib/api'
import {
  LogOut, Calendar, Bell, Plus, Car, Wallet,
  BarChart2, Home, ChevronRight, Check, X, Clock,
  TrendingUp, Shield, Package, FileText, ExternalLink, ZoomIn,
  Phone, Mail, MapPin, Users, CreditCard, User, Building2,
  Camera, Fuel, ArrowLeftRight, Download, AlertTriangle, Maximize2,
  Settings, Eye, EyeOff, Lock
} from 'lucide-react'
import { useSocket } from '@/lib/socket'
import { listenForSWReplay } from '@/lib/offline'
import { API } from '@/lib/api'
import { differenceInDays, parseISO } from 'date-fns'

// ── Helpers ──────────────────────────────────────────────────────
const TYPE_COLORS = { Annual:'#B8860B', Sick:'#2563EB', Emergency:'#DC2626', Unpaid:'#6B7280', Other:'#6B7280' }
const DED_LABELS  = { traffic_fine:'Traffic Fine', iloe_fee:'ILOE Fee', iloe_fine:'ILOE Fine', cash_variance:'Cash Variance', cash_advance:'Cash Advance', absent_days:'Absent Days', other:'Other' }
const PAY_MONTHS = Array.from({length:12},(_,i)=>{
  const d = new Date(); d.setMonth(d.getMonth()-i)
  return d.toISOString().slice(0,7)
})

function fmt(n)  { return Number(n || 0).toLocaleString('en-US') }
function fmtA(n) { return `AED ${fmt(n)}` }
function localDateKey(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem('gcd_token')}` }
}

function findAllCurrentVehicles(handovers) {
  return handovers.filter(h =>
    h.type === 'received' &&
    (h.status === 'completed' || h.status === 'poc_pending') &&
    !handovers.find(h2 =>
      String(h2.vehicle_id) === String(h.vehicle_id) &&
      h2.type === 'returned' &&
      h2.status !== 'pending_acceptance' &&
      h2.status !== 'rejected' &&
      new Date(h2.submitted_at) > new Date(h.submitted_at)
    )
  )
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = window.atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

function getGrade(s) {
  if (s >= 92) return { label:'Fantastic+', c:'#10B981' }
  if (s >= 85) return { label:'Fantastic',  c:'#2563EB' }
  if (s >= 70) return { label:'Great',      c:'#F59E0B' }
  if (s >= 50) return { label:'Fair',       c:'#F97316' }
  return              { label:'Poor',       c:'#EF4444' }
}

function expiryAlert(ds) {
  if (!ds) return false
  try {
    const d = differenceInDays(parseISO(ds.slice(0,10)), new Date())
    return d < 0 || d <= 30
  } catch { return false }
}

const TABS = [
  { id:'home',      label:'Home',        icon:Home      },
  { id:'att',       label:'Attendance',  icon:Clock     },
  { id:'pay',       label:'Payslips',    icon:Wallet    },
  { id:'leaves',    label:'Leaves',      icon:Calendar  },
  { id:'perf',      label:'Performance', icon:BarChart2 },
  { id:'vehicle',   label:'Vehicle',     icon:Car       },
  { id:'insurance', label:'Insurance',   icon:Shield    },
  { id:'notices',   label:'Notices',     icon:Bell      },
]

// ── Leave Modal ───────────────────────────────────────────────────
function LeaveModal({ empId, onClose, onSave }) {
  const [form,   setForm]   = useState({ type:'Annual', from_date:'', to_date:'', reason:'' })
  const [saving, setSaving] = useState(false)
  const set  = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const days = form.from_date && form.to_date
    ? Math.max(1, Math.round((new Date(form.to_date) - new Date(form.from_date)) / 86400000) + 1)
    : 0

  async function submit() {
    if (!form.from_date || !form.to_date) return
    setSaving(true)
    try   { await leaveApi.create({ ...form, emp_id: empId, days }); onSave() }
    catch (e) { alert(e.message) }
    finally   { setSaving(false) }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:300, display:'flex', alignItems:'flex-end' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width:'100%', maxWidth:480, margin:'0 auto', background:'#FFF', borderRadius:'24px 24px 0 0', padding:'20px 20px 40px', boxShadow:'0 -4px 30px rgba(0,0,0,0.12)' }}>
        <div style={{ width:36, height:4, background:'#E5E7EB', borderRadius:2, margin:'0 auto 20px' }}/>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h3 style={{ fontWeight:700, fontSize:17, color:'#111', margin:0 }}>Apply for Leave</h3>
          <button onClick={onClose} style={{ width:30, height:30, borderRadius:'50%', background:'#F3F4F6', border:'none', cursor:'pointer', fontSize:18, color:'#6B7280' }}>×</button>
        </div>
        <div style={{ display:'flex', gap:7, marginBottom:16, flexWrap:'wrap' }}>
          {['Annual','Emergency','Unpaid'].map(t => (
            <button key={t} onClick={() => set('type', t)}
              style={{ padding:'7px 14px', borderRadius:20, border:`1.5px solid ${form.type===t ? TYPE_COLORS[t] : '#E5E7EB'}`, background:form.type===t ? `${TYPE_COLORS[t]}12` : '#FFF', color:form.type===t ? TYPE_COLORS[t] : '#6B7280', fontWeight:600, fontSize:12.5, cursor:'pointer', fontFamily:'Poppins,sans-serif' }}>{t}</button>
          ))}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
          {[['From','from_date'], ['To','to_date']].map(([l, k]) => (
            <div key={k}>
              <label style={{ fontSize:11, fontWeight:600, color:'#6B7280', display:'block', marginBottom:5 }}>{l}</label>
              <input type="date" value={form[k]} onChange={e => set(k, e.target.value)}
                style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1.5px solid #E5E7EB', fontSize:13, fontFamily:'Poppins,sans-serif', outline:'none', boxSizing:'border-box', background:'#F9FAFB' }}/>
            </div>
          ))}
        </div>
        {days > 0 && (
          <div style={{ textAlign:'center', fontSize:13, fontWeight:600, color:'#B8860B', background:'#FFFBEB', borderRadius:10, padding:'8px', marginBottom:12 }}>
            {days} day{days > 1 ? 's' : ''}
          </div>
        )}
        <input value={form.reason} onChange={e => set('reason', e.target.value)} placeholder="Reason (optional)"
          style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1.5px solid #E5E7EB', fontSize:13, fontFamily:'Poppins,sans-serif', outline:'none', boxSizing:'border-box', background:'#F9FAFB', marginBottom:14 }}/>
        <button onClick={submit} disabled={saving || !form.from_date || !form.to_date}
          style={{ width:'100%', padding:'13px', borderRadius:12, background:'#111', color:'#FFF', fontWeight:700, fontSize:14, border:'none', cursor:'pointer', fontFamily:'Poppins,sans-serif', opacity: saving || !form.from_date || !form.to_date ? 0.6 : 1 }}>
          {saving ? 'Submitting…' : 'Submit Request'}
        </button>
      </div>
    </div>
  )
}

// ── Status pill ───────────────────────────────────────────────────
function Pill({ label, color }) {
  const c = color || '#6B7280'
  return <span style={{ fontSize:11, fontWeight:600, color:c, background:`${c}15`, borderRadius:20, padding:'2px 9px', display:'inline-block' }}>{label}</span>
}

// ── Section card ──────────────────────────────────────────────────
function Card({ children, style }) {
  return (
    <div style={{ background:'#FFF', borderRadius:16, border:'1px solid #EBEBEB', padding:'16px', boxShadow:'0 1px 4px rgba(0,0,0,0.04)', ...style }}>
      {children}
    </div>
  )
}

// ── Mini info row ─────────────────────────────────────────────────
function InfoRow({ label, value }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', padding:'6px 0', borderBottom:'1px solid #F3F4F6', gap:8 }}>
      <span style={{ fontSize:11.5, color:'#9CA3AF', flexShrink:0 }}>{label}</span>
      <span style={{ fontSize:12, fontWeight:600, color: value ? '#111' : '#D1D5DB', textAlign:'right', wordBreak:'break-word' }}>{value || '—'}</span>
    </div>
  )
}

// ── Image helpers ─────────────────────────────────────────────────
function dataUrlToFile(dataUrl, name) {
  const [header, b64] = dataUrl.split(',')
  const mime = header.match(/:(.*?);/)[1]
  const raw  = atob(b64)
  const buf  = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i)
  return new File([buf], name, { type: mime })
}

function compressImage(file, maxBytes = 300 * 1024) {
  return new Promise(resolve => {
    const img = new Image()
    const src = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(src)
      let { width: w, height: h } = img
      const MAX_PX = 1024
      if (w >= h && w > MAX_PX) { h = Math.round(h * MAX_PX / w); w = MAX_PX }
      else if (h > MAX_PX)      { w = Math.round(w * MAX_PX / h); h = MAX_PX }
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      const name = file.name.replace(/\.[^.]+$/, '.jpg')
      for (let q = 0.85; q >= 0.15; q = Math.round((q - 0.1) * 100) / 100) {
        const dataUrl  = canvas.toDataURL('image/jpeg', q)
        const byteSize = Math.ceil((dataUrl.length - dataUrl.indexOf(',') - 1) * 3 / 4)
        if (byteSize <= maxBytes || q <= 0.15) return resolve(dataUrlToFile(dataUrl, name))
      }
      resolve(dataUrlToFile(canvas.toDataURL('image/jpeg', 0.15), name))
    }
    img.onerror = () => { URL.revokeObjectURL(src); resolve(file) }
    img.src = src
  })
}

const FUEL_LEVELS_DRIVER = [
  { v:'empty', l:'Empty', pct:0 }, { v:'quarter', l:'1/4', pct:25 },
  { v:'half',  l:'1/2',  pct:50 }, { v:'three_quarter', l:'3/4', pct:75 },
  { v:'full',  l:'Full', pct:100 },
]

// ── Photo slot ────────────────────────────────────────────────────
function DriverPhotoSlot({ index, file, onSelect, onRemove }) {
  const ref = useRef(null)
  const url = file ? URL.createObjectURL(file) : null
  return (
    <div style={{ position:'relative', aspectRatio:'1', borderRadius:10, overflow:'hidden', border:`2px dashed ${file?'#B8860B':'#D1D5DB'}`, background:file?'#000':'#F9FAFB', cursor:'pointer' }}
      onClick={()=>!file && ref.current?.click()}>
      <input ref={ref} type="file" accept="image/*" capture="environment" style={{ display:'none' }}
        onChange={e=>{ if(e.target.files[0]) onSelect(index, e.target.files[0]) }}/>
      {file ? (
        <>
          <img src={url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
          <button onClick={e=>{ e.stopPropagation(); onRemove(index) }}
            style={{ position:'absolute', top:3, right:3, width:20, height:20, borderRadius:'50%', background:'rgba(0,0,0,0.7)', border:'none', color:'white', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12 }}>×</button>
        </>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:3 }}>
          <Camera size={18} color="#9CA3AF"/>
          <span style={{ fontSize:9, color:'#9CA3AF', fontWeight:600 }}>{['Front','Back','Left','Right'][index]}</span>
        </div>
      )}
    </div>
  )
}

// ── Complete Handover Sheet ───────────────────────────────────────
function CompleteHandoverSheet({ handover, onClose, onDone }) {
  const [photos,   setPhotos]   = useState([null, null, null, null])
  const [fuel,     setFuel]     = useState(handover.fuel_level || 'half')
  const [odometer, setOdometer] = useState(handover.odometer ? String(handover.odometer) : '')
  const [note,     setNote]     = useState('')
  const [saving,   setSaving]   = useState(false)
  const [err,      setErr]      = useState(null)
  const [done,     setDone]     = useState(false)

  function setPhoto(i, file) { setPhotos(p => { const n=[...p]; n[i]=file; return n }) }
  function rmPhoto(i)        { setPhotos(p => { const n=[...p]; n[i]=null; return n }) }

  async function submit() {
    if (photos.filter(Boolean).length < 4) return setErr('All 4 photos are required')
    if (!odometer || isNaN(Number(odometer)) || Number(odometer) <= 0) return setErr('Odometer reading is required')
    setSaving(true); setErr(null)
    try {
      const compressed = await Promise.all(photos.filter(Boolean).map(f => compressImage(f)))
      const fd = new FormData()
      fd.append('fuel_level', fuel)
      fd.append('odometer', odometer)
      if (note) fd.append('condition_note', note)
      compressed.forEach(f => fd.append('photos', f))
      const res = await fetch(`${API}/api/handovers/${handover.id}/complete`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${localStorage.getItem('gcd_token')}` },
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setDone(true)
      setTimeout(onDone, 1500)
    } catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:300, display:'flex', alignItems:'flex-end' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width:'100%', maxWidth:480, margin:'0 auto', background:'#FFF', borderRadius:'24px 24px 0 0', padding:'16px 16px 40px', boxShadow:'0 -4px 30px rgba(0,0,0,0.12)', maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ width:36, height:4, background:'#E5E7EB', borderRadius:2, margin:'0 auto 16px' }}/>
        {done ? (
          <div style={{ textAlign:'center', padding:'30px 0' }}>
            <div style={{ width:56, height:56, borderRadius:'50%', background:'#ECFDF5', border:'2px solid #A7F3D0', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px' }}>
              <Check size={26} color="#2E7D52"/>
            </div>
            <div style={{ fontWeight:800, fontSize:17, color:'#111', marginBottom:6 }}>Handover Complete!</div>
            <div style={{ fontSize:13, color:'#9CA3AF' }}>Vehicle is now assigned to you.</div>
          </div>
        ) : (
          <>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <div>
                <div style={{ fontWeight:700, fontSize:16, color:'#111' }}>Complete Handover</div>
                <div style={{ fontSize:12, color:'#9CA3AF', marginTop:2 }}>
                  Receiving {handover.vehicle_plate || handover.plate} from {handover.emp_name}
                </div>
              </div>
              <button onClick={onClose} style={{ width:30, height:30, borderRadius:'50%', background:'#F3F4F6', border:'none', cursor:'pointer', fontSize:18, color:'#6B7280' }}>×</button>
            </div>
            {err && <div style={{ background:'#FEF2F2', border:'1px solid #FCA5A5', borderRadius:9, padding:'9px 13px', fontSize:12.5, color:'#C0392B', marginBottom:14 }}>{err}</div>}
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#374151', marginBottom:6 }}>Vehicle Photos * <span style={{ fontSize:10, fontWeight:400, color:'#9CA3AF' }}>— all 4 required</span></div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:7 }}>
                {photos.map((f,i) => <DriverPhotoSlot key={i} index={i} file={f} onSelect={setPhoto} onRemove={rmPhoto}/>)}
              </div>
            </div>
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#374151', marginBottom:6, display:'flex', alignItems:'center', gap:5 }}><Fuel size={11}/> Fuel Level</div>
              <div style={{ display:'flex', gap:5 }}>
                {FUEL_LEVELS_DRIVER.map(f=>(
                  <button key={f.v} onClick={()=>setFuel(f.v)} type="button"
                    style={{ flex:1, padding:'7px 3px', borderRadius:9, border:`2px solid ${fuel===f.v?'#111':'#E5E7EB'}`, background:fuel===f.v?'#111':'#F9FAFB', cursor:'pointer', fontFamily:'Poppins,sans-serif' }}>
                    <div style={{ fontSize:10, fontWeight:700, color:fuel===f.v?'#FFF':'#9CA3AF' }}>{f.l}</div>
                  </button>
                ))}
              </div>
              <div style={{ marginTop:7, height:7, background:'#F3F4F6', borderRadius:10, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${FUEL_LEVELS_DRIVER.find(f=>f.v===fuel)?.pct||0}%`, background:'#111', borderRadius:10, transition:'width 0.4s ease' }}/>
              </div>
            </div>
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#374151', marginBottom:6 }}>Odometer (km) *</div>
              <input type="number" value={odometer} onChange={e=>setOdometer(e.target.value)} placeholder="e.g. 45230"
                style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1.5px solid #E5E7EB', fontSize:13, fontFamily:'Poppins,sans-serif', outline:'none', boxSizing:'border-box', background:'#F9FAFB' }}/>
            </div>
            <div style={{ marginBottom:18 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#374151', marginBottom:6 }}>Condition Notes <span style={{ fontWeight:400, color:'#9CA3AF' }}>(optional)</span></div>
              <textarea value={note} onChange={e=>setNote(e.target.value)} rows={2} placeholder="Any damage, issues, or notes…"
                style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1.5px solid #E5E7EB', fontSize:13, fontFamily:'Poppins,sans-serif', outline:'none', boxSizing:'border-box', background:'#F9FAFB', resize:'vertical' }}/>
            </div>
            <button onClick={submit} disabled={saving}
              style={{ width:'100%', padding:'13px', borderRadius:12, background:'#111', color:'#FFF', fontWeight:700, fontSize:14, border:'none', cursor:'pointer', fontFamily:'Poppins,sans-serif', opacity:saving?0.7:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              {saving ? <><span style={{ width:14, height:14, border:'2px solid rgba(255,255,255,0.4)', borderTopColor:'white', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/> Saving…</> : 'Complete Handover'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Google Drive URL → embed ──────────────────────────────────────
function toEmbedUrl(url) {
  if (!url) return null
  const m  = url.match(/\/file\/d\/([^/]+)/)
  if (m)  return `https://drive.google.com/file/d/${m[1]}/preview`
  const m2 = url.match(/[?&]id=([^&]+)/)
  if (m2) return `https://drive.google.com/file/d/${m2[1]}/preview`
  return url
}

// ── Insurance Tab ─────────────────────────────────────────────────
function InsuranceTab({ profile }) {
  const [zoomed, setZoomed] = useState(false)
  const embedUrl = toEmbedUrl(profile?.insurance_url)

  if (!embedUrl) {
    return (
      <div className="fade" style={{ display:'flex', flexDirection:'column', gap:16 }}>
        <h2 style={{ fontWeight:700, fontSize:20, color:'#111', margin:0 }}>Digital Insurance Card</h2>
        <Card style={{ textAlign:'center', padding:'48px 24px' }}>
          <div style={{ width:64, height:64, borderRadius:20, background:'#EFF6FF', border:'1px solid #BFDBFE', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
            <Shield size={28} color="#2563EB"/>
          </div>
          <div style={{ fontWeight:700, fontSize:15, color:'#111', marginBottom:8 }}>No insurance card on file</div>
          <div style={{ fontSize:13, color:'#9CA3AF', lineHeight:1.6 }}>
            Your insurance card hasn't been uploaded yet.<br/>Please contact your station admin.
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="fade" style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <h2 style={{ fontWeight:700, fontSize:20, color:'#111', margin:0 }}>Digital Insurance Card View</h2>

      {/* Action buttons */}
      <div style={{ display:'flex', gap:10 }}>
        <button onClick={() => setZoomed(true)}
          style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:7, padding:'12px', borderRadius:14, background:'#2563EB', color:'#FFF', fontWeight:700, fontSize:13, border:'none', cursor:'pointer', fontFamily:'Poppins,sans-serif' }}>
          <Maximize2 size={15}/> Full Screen
        </button>
        <a href={profile?.insurance_url} target="_blank" rel="noreferrer"
          style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:7, padding:'12px', borderRadius:14, background:'#F59E0B', color:'#FFF', fontWeight:700, fontSize:13, textDecoration:'none', fontFamily:'Poppins,sans-serif' }}>
          <Download size={15}/> Download/Export
        </a>
      </div>

      {/* Card preview */}
      <div style={{ borderRadius:20, overflow:'hidden', boxShadow:'0 8px 32px rgba(0,0,0,0.12)', border:'1px solid #EBEBEB' }}>
        <iframe src={embedUrl} width="100%" allow="autoplay"
          style={{ border:'none', display:'block', height:'min(520px, 62vh)' }}
          title="Insurance Card"/>
      </div>

      {/* Fullscreen overlay */}
      {zoomed && (
        <div onClick={() => setZoomed(false)}
          style={{ position:'fixed', inset:0, zIndex:500, background:'rgba(0,0,0,0.95)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:16 }}>
          <button onClick={() => setZoomed(false)}
            style={{ position:'absolute', top:16, right:16, width:36, height:36, borderRadius:'50%', background:'rgba(255,255,255,0.12)', border:'1px solid rgba(255,255,255,0.2)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'white' }}>
            <X size={16}/>
          </button>
          <iframe src={embedUrl}
            style={{ width:'100%', maxWidth:700, height:'88vh', border:'none', borderRadius:16 }}
            allow="autoplay" title="Insurance Card Full"/>
        </div>
      )}
    </div>
  )
}

// ── Settings Modal ────────────────────────────────────────────────
function SettingsModal({ onClose }) {
  const [form,    setForm]    = useState({ current:'', next:'', confirm:'' })
  const [showPw,  setShowPw]  = useState({ current:false, next:false, confirm:false })
  const [saving,  setSaving]  = useState(false)
  const [msg,     setMsg]     = useState(null)

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const toggleShow = k => setShowPw(p => ({ ...p, [k]: !p[k] }))

  function strength(pw) {
    if (!pw) return 0
    let s = 0
    if (pw.length >= 8)               s++
    if (/[A-Z]/.test(pw))             s++
    if (/[0-9]/.test(pw))             s++
    if (/[^A-Za-z0-9]/.test(pw))      s++
    return s
  }

  const pwStrength = strength(form.next)
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][pwStrength]
  const strengthColor = ['', '#EF4444', '#F97316', '#EAB308', '#22C55E'][pwStrength]

  async function submit() {
    setMsg(null)
    if (!form.current)              return setMsg({ ok:false, text:'Current password is required' })
    if (form.next.length < 8)       return setMsg({ ok:false, text:'New password must be at least 8 characters' })
    if (form.next !== form.confirm) return setMsg({ ok:false, text:'Passwords do not match' })
    setSaving(true)
    try {
      const res = await fetch(`${API}/api/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', Authorization:`Bearer ${localStorage.getItem('gcd_token')}` },
        body: JSON.stringify({ current_password: form.current, new_password: form.next }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setMsg({ ok: true, text: 'Password changed successfully!' })
      setForm({ current:'', next:'', confirm:'' })
    } catch(e) {
      setMsg({ ok: false, text: e.message })
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = {
    width:'100%', padding:'11px 40px 11px 12px', borderRadius:10,
    border:'1.5px solid #E5E7EB', fontSize:13.5, fontFamily:'Poppins,sans-serif',
    outline:'none', boxSizing:'border-box', background:'#F9FAFB',
  }

  function PwField({ label, k }) {
    return (
      <div style={{ marginBottom:14 }}>
        <label style={{ fontSize:11, fontWeight:600, color:'#6B7280', display:'block', marginBottom:5 }}>{label}</label>
        <div style={{ position:'relative' }}>
          <input type={showPw[k] ? 'text' : 'password'} value={form[k]}
            onChange={e => set(k, e.target.value)} style={inputStyle}/>
          <button type="button" onClick={() => toggleShow(k)}
            style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#9CA3AF', padding:2, display:'flex' }}>
            {showPw[k] ? <EyeOff size={15}/> : <Eye size={15}/>}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:400, display:'flex', alignItems:'flex-end' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width:'100%', maxWidth:480, margin:'0 auto', background:'#FFF', borderRadius:'24px 24px 0 0', padding:'20px 20px 48px', boxShadow:'0 -4px 30px rgba(0,0,0,0.15)' }}>
        <div style={{ width:36, height:4, background:'#E5E7EB', borderRadius:2, margin:'0 auto 20px' }}/>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:'#F3F4F6', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Lock size={17} color="#374151"/>
            </div>
            <div>
              <div style={{ fontWeight:700, fontSize:16, color:'#111', lineHeight:1 }}>Change Password</div>
              <div style={{ fontSize:11, color:'#9CA3AF', marginTop:2 }}>Keep your account secure</div>
            </div>
          </div>
          <button onClick={onClose} style={{ width:30, height:30, borderRadius:'50%', background:'#F3F4F6', border:'none', cursor:'pointer', fontSize:18, color:'#6B7280', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
        </div>

        <PwField label="Current Password" k="current"/>
        <PwField label="New Password"     k="next"/>

        {form.next && (
          <div style={{ marginTop:-8, marginBottom:14 }}>
            <div style={{ display:'flex', gap:4, marginBottom:4 }}>
              {[1,2,3,4].map(i => (
                <div key={i} style={{ flex:1, height:4, borderRadius:2, background: i <= pwStrength ? strengthColor : '#E5E7EB', transition:'background 0.2s' }}/>
              ))}
            </div>
            <div style={{ fontSize:11, color: strengthColor, fontWeight:600 }}>{strengthLabel}</div>
          </div>
        )}

        <PwField label="Confirm New Password" k="confirm"/>

        {msg && (
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', borderRadius:10, background: msg.ok ? '#ECFDF5' : '#FEF2F2', border:`1px solid ${msg.ok ? '#A7F3D0' : '#FCA5A5'}`, marginBottom:16 }}>
            {msg.ok ? <Check size={15} color="#16A34A"/> : <X size={15} color="#DC2626"/>}
            <span style={{ fontSize:12.5, fontWeight:600, color: msg.ok ? '#16A34A' : '#DC2626' }}>{msg.text}</span>
          </div>
        )}

        <button onClick={submit} disabled={saving}
          style={{ width:'100%', padding:'13px', borderRadius:12, background: saving ? '#9CA3AF' : '#111', color:'#FFF', fontWeight:700, fontSize:14, border:'none', cursor: saving ? 'not-allowed' : 'pointer', fontFamily:'Poppins,sans-serif', transition:'background 0.2s' }}>
          {saving ? 'Saving…' : 'Update Password'}
        </button>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────
export default function DriverPortal() {
  const { user, loading: authLoading, logout } = useAuth()
  const router = useRouter()

  const [mounted,       setMounted]       = useState(false)
  const [tab,           setTab]           = useState('home')
  const [settingsOpen,  setSettingsOpen]  = useState(false)
  const [loading,       setLoading]       = useState(true)
  const [profile,       setProfile]       = useState(null)
  const [payroll,       setPayroll]       = useState(null)
  const [payMonth,      setPayMonth]      = useState(new Date().toISOString().slice(0, 7))
  const [payslip,       setPayslip]       = useState(null)
  const [attEarnings,   setAttEarnings]   = useState(null)
  const [leaves,        setLeaves]        = useState([])
  const [notices,       setNotices]       = useState([])
  const [handovers,     setHandovers]     = useState([])
  const [perf,          setPerf]          = useState(null)
  const [todayAsgn,     setTodayAsgn]     = useState(null)
  const [asgHistory,    setAsgHistory]    = useState([])
  const [leaveModal,        setLeaveModal]        = useState(false)
  const [hvModal,           setHvModal]           = useState(null)
  const [pendingHandovers,  setPendingHandovers]  = useState([])
  const [completingHandover,setCompletingHandover]= useState(null)
  const [notifications,     setNotifications]     = useState([])
  const [unreadCount,       setUnreadCount]       = useState(0)
  const [toast,             setToast]             = useState(null)

  useEffect(() => { setMounted(true) }, [])

  function signOut() { logout(); router.replace('/login') }

  const refreshLeaves = useCallback(() => {
    fetch(`${API}/api/leaves`, { headers: authHeader() })
      .then(r => r.json()).then(d => setLeaves(d.leaves || [])).catch(() => {})
  }, [])

  const refreshHandovers = useCallback(() => {
    fetch(`${API}/api/handovers`, { headers: authHeader() })
      .then(r => r.json()).then(d => {
        setHandovers(d.handovers || [])
      }).catch(() => {})
  }, [])

  const refreshPending = useCallback(() => {
    fetch(`${API}/api/handovers/pending`, { headers: authHeader() })
      .then(r => r.json()).then(d => setPendingHandovers(d.pending || [])).catch(() => {})
  }, [])

  const refreshAssignments = useCallback(() => {
    if (!user?.emp_id) return
    const today = localDateKey()
    const h = authHeader()
    Promise.all([
      fetch(`${API}/api/vehicles/assignments/current?date=${today}&emp_id=${encodeURIComponent(user.emp_id)}`, { headers: h })
        .then(r => r.json()).catch(() => ({ assignments: [] })),
      fetch(`${API}/api/vehicles/assignments/history?emp_id=${encodeURIComponent(user.emp_id)}&limit=60`, { headers: h })
        .then(r => r.json()).catch(() => ({ history: [] })),
    ]).then(([current, history]) => {
      const direct = (current.assignments || []).find(a => String(a.emp_id) === String(user.emp_id))
      const list = history.history || []
      setAsgHistory(list)
      setTodayAsgn(direct || list.find(a => a.date?.slice(0, 10) === today) || null)
    }).catch(() => {})
  }, [user?.emp_id])

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.replace('/login'); return }
    if (user.role !== 'driver') { router.replace('/dashboard/analytics'); return }

    const hdr   = authHeader()
    const today = localDateKey()
    const ctrl  = new AbortController()

    fetch(`${API}/api/employees/${user.emp_id}`, { headers: hdr, signal: ctrl.signal })
      .then(r => r.json()).catch(() => ({ employee: null }))
      .then(emp => { setProfile(emp.employee || null); setLoading(false) })

    const bg = (url, onData) =>
      fetch(`${API}${url}`, { headers: hdr, signal: ctrl.signal })
        .then(r => r.json()).then(onData).catch(() => {})

    bg(`/api/leaves`,                                                        d => setLeaves(d.leaves || []))
    bg(`/api/poc/announcements?station_code=${user.station_code}`,           d => setNotices(d.announcements || []))
    bg(`/api/notifications`,                                                 d => {
      const list = d.notifications || []
      setNotifications(list)
      setUnreadCount(list.filter(n => !n.read).length)
    })
    bg(`/api/handovers`,                                                     d => {
      setHandovers(d.handovers || [])
    })
    bg(`/api/handovers/pending`,                                             d => setPendingHandovers(d.pending || []))
    bg(`/api/performance/${user.emp_id}`,                                    d => setPerf(d.history?.[0] || null))
    bg(`/api/vehicles/assignments/current?date=${today}&emp_id=${encodeURIComponent(user.emp_id)}`, d => {
      const direct = (d.assignments || []).find(a => String(a.emp_id) === String(user.emp_id))
      setTodayAsgn(direct || null)
    })
    bg(`/api/vehicles/assignments/history?emp_id=${encodeURIComponent(user.emp_id)}&limit=60`,   d => {
      const list = d.history || []
      setAsgHistory(list)
      setTodayAsgn(prev => prev || list.find(a => a.date?.slice(0, 10) === today) || null)
    })

    return () => ctrl.abort()
  }, [user, authLoading, router])

  // Current month's payroll + attendance-earnings — feeds the Home hero card and the
  // Attendance tab, both of which mean "right now," not whatever month is selected in
  // the Payslip tab below.
  useEffect(() => {
    if (!user?.emp_id) return
    const hdr   = authHeader()
    const month = new Date().toISOString().slice(0, 7)
    const ctrl  = new AbortController()
    Promise.all([
      fetch(`${API}/api/payroll?month=${month}`,             { headers: hdr, signal: ctrl.signal }).then(r => r.json()).catch(() => ({ payroll: [] })),
      fetch(`${API}/api/attendance/earnings?month=${month}`, { headers: hdr, signal: ctrl.signal }).then(r => r.json()).catch(() => null),
    ]).then(([pr, ae]) => {
      const slip = (pr.payroll || []).find(p => p.id === user.emp_id || p.emp_id === user.emp_id)
      setPayroll(slip || null)
      setAttEarnings(ae || null)
    })
    return () => ctrl.abort()
  }, [user?.emp_id])

  // Payslip tab has its own selectable month, independent of "current month" above —
  // drivers need to look back at last month's salary once it's been paid, not just
  // whatever's in progress today.
  useEffect(() => {
    if (!user?.emp_id) return
    const hdr  = authHeader()
    const ctrl = new AbortController()
    fetch(`${API}/api/payroll?month=${payMonth}`, { headers: hdr, signal: ctrl.signal })
      .then(r => r.json()).catch(() => ({ payroll: [] }))
      .then(pr => {
        const slip = (pr.payroll || []).find(p => p.id === user.emp_id || p.emp_id === user.emp_id)
        setPayslip(slip || null)
      })
    return () => ctrl.abort()
  }, [user?.emp_id, payMonth])

  useSocket({
    'notification:new': (notif) => {
      setNotifications(p => [{ ...notif, read: false }, ...p])
      setUnreadCount(c => c + 1)
      setToast(notif)
      setTimeout(() => setToast(null), 4500)
    },
    'handover:incoming':     () => { refreshPending() },
    'handover:created':      () => { refreshPending() },
    'handover:updated':      () => { refreshPending(); refreshHandovers() },
    'handover:completed':    () => { refreshPending(); refreshHandovers() },
    'handover:poc-approved': () => { refreshPending(); refreshHandovers() },
    'handover:poc-rejected': () => { refreshPending(); refreshHandovers() },
    'vehicle:assigned':      () => { refreshAssignments() },
  })

  useEffect(() => {
    if (!user || user.role !== 'driver') return
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return
    async function registerPush() {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js')
        await navigator.serviceWorker.ready
        listenForSWReplay()
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') return
        let sub = await reg.pushManager.getSubscription()
        if (!sub) {
          const keyRes = await fetch(`${API}/api/notifications/vapid-public-key`)
          const { key } = await keyRes.json()
          if (!key) return
          sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) })
        }
        await fetch(`${API}/api/notifications/subscribe`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader() }, body: JSON.stringify(sub.toJSON()),
        })
      } catch (e) {}
    }
    registerPush()
  }, [user])

  function openNotices() {
    setTab('notices')
    if (unreadCount > 0) {
      setUnreadCount(0)
      setNotifications(p => p.map(n => ({ ...n, read: true })))
      fetch(`${API}/api/notifications/read-all`, { method:'PATCH', headers: authHeader() }).catch(() => {})
    }
  }

  function handleLeaveSave()    { setLeaveModal(false); refreshLeaves()    }
  function handleHandoverSave() { setHvModal(null);     refreshHandovers(); refreshPending() }
  function handleCompleteDone() { setCompletingHandover(null); refreshHandovers(); refreshPending() }

  if (!mounted || !user || loading) return (
    <div style={{ minHeight:'100vh', background:'#F0F1F5', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:40, height:40, borderRadius:'50%', border:'3px solid #E5E7EB', borderTopColor:'#111', animation:'spin 0.7s linear infinite', margin:'0 auto 12px' }}/>
        <div style={{ fontSize:13, color:'#9CA3AF' }}>Loading your portal…</div>
      </div>
    </div>
  )

  const net          = payroll ? Number(payroll.base_salary||0) + Number(payroll.bonus_total||0) - Number(payroll.deduction_total||0) : 0
  const payslipNet   = payslip ? Number(payslip.base_salary||0) + Number(payslip.bonus_total||0) - Number(payslip.deduction_total||0) : 0
  const isCurrentPayMonth = payMonth === new Date().toISOString().slice(0, 7)
  const payMonthLabel = new Date(payMonth+'-01').toLocaleString('en-US',{month:'long',year:'numeric'}).toUpperCase()
  const isShipmentEmp = profile?.station_code === 'DXE6'
  const attRecords   = attEarnings?.records || []
  const attPresent   = attRecords.filter(r => r.status === 'present').length
  const attAbsent    = attRecords.filter(r => r.status === 'absent').length
  const attLeave     = attRecords.filter(r => r.status === 'leave').length
  const totalUnits   = attRecords.filter(r => r.status === 'present').reduce((s,r) => s + parseFloat(r.cycle_hours||0), 0)
  const variablePay  = attRecords.reduce((s,r) => s + parseFloat(r.earnings||0), 0)
  const grade        = perf ? getGrade(perf.total_score) : null
  const p            = profile
  const today2       = mounted ? localDateKey() : ''
  const monthLabel   = new Date().toLocaleString('en-US',{month:'long',year:'numeric'}).toUpperCase()
  const alertCount   = [p?.visa_expiry, p?.license_expiry, p?.iloe_expiry].filter(expiryAlert).length
  const annualUsed   = leaves.filter(l=>l.type==='Annual'&&l.status==='approved').reduce((s,l)=>s+(l.days||0),0)
  const sickUsed     = leaves.filter(l=>l.type==='Sick'&&l.status==='approved').reduce((s,l)=>s+(l.days||0),0)
  const allCurrentVehicles = findAllCurrentVehicles(handovers)
  const vehicle      = allCurrentVehicles[0] || null
  const hasTwoVehicles = allCurrentVehicles.length >= 2
  const myPendingReturn = handovers.find(h =>
    h.type === 'returned' &&
    String(h.emp_id) === String(user.emp_id) &&
    ['pending_acceptance','accepted','poc_pending'].includes(h.status)
  )
  const hasPendingReturn = !!myPendingReturn
  const effectiveTodayAsgn = (vehicle || hasPendingReturn) ? null : todayAsgn

  return (
    <div style={{ minHeight:'100vh', background:'#F0F1F5', fontFamily:'Poppins,sans-serif', paddingBottom:'calc(72px + env(safe-area-inset-bottom, 0px))' }}>

      {/* ── TOAST ── */}
      {toast && (
        <div onClick={openNotices}
          style={{ position:'fixed', top:16, left:'50%', transform:'translateX(-50%)', zIndex:200, maxWidth:340, width:'calc(100% - 32px)', background:'#FFF', borderRadius:16, padding:'12px 14px', boxShadow:'0 8px 30px rgba(0,0,0,0.12)', border:'1px solid #EBEBEB', cursor:'pointer', animation:'slideUp 0.3s ease', display:'flex', gap:10, alignItems:'flex-start' }}>
          <div style={{ width:32, height:32, borderRadius:10, background:'#111', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <Bell size={15} color="#FFF"/>
          </div>
          <div style={{ minWidth:0 }}>
            <div style={{ fontWeight:700, fontSize:12.5, color:'#111', marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{toast.title}</div>
            <div style={{ fontSize:11.5, color:'#6B7280', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{toast.body}</div>
          </div>
          <button onClick={e => { e.stopPropagation(); setToast(null) }}
            style={{ background:'none', border:'none', cursor:'pointer', color:'#9CA3AF', padding:2, flexShrink:0 }}><X size={14}/></button>
        </div>
      )}

      {/* ── CONTENT ── */}
      <div style={{ maxWidth:520, margin:'0 auto' }}>

        {/* ════ HOME ════ */}
        {tab === 'home' && (
          <div className="fade">

            {/* Profile header */}
            <div style={{ background:'#FFF', padding:'16px 16px 0', position:'sticky', top:0, zIndex:50, borderBottom:'1px solid #F0F0EE', boxShadow:'0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:12, paddingBottom:14 }}>
                {/* Avatar */}
                <div style={{ width:48, height:48, borderRadius:24, background:'#E5E7EB', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:800, color:'#374151', flexShrink:0 }}>
                  {user.name?.slice(0,2).toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:2 }}>
                    <span style={{ fontWeight:800, fontSize:15, color:'#111' }}>{user.name}</span>
                    <span style={{ fontSize:10, fontWeight:700, color:'#10B981', background:'#ECFDF5', border:'1px solid #A7F3D0', borderRadius:20, padding:'2px 8px' }}>Active</span>
                  </div>
                  <div style={{ fontSize:11.5, color:'#9CA3AF' }}>Delivery Associate</div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                  <button onClick={() => setSettingsOpen(true)}
                    style={{ display:'flex', alignItems:'center', justifyContent:'center', width:32, height:32, borderRadius:20, background:'#F3F4F6', border:'1px solid #E5E7EB', color:'#6B7280', cursor:'pointer', fontFamily:'Poppins,sans-serif' }}>
                    <Settings size={14}/>
                  </button>
                  <button onClick={signOut}
                    style={{ display:'flex', alignItems:'center', gap:4, padding:'7px 12px', borderRadius:20, background:'#FEF2F2', border:'1px solid #FECACA', color:'#EF4444', fontWeight:600, fontSize:11.5, cursor:'pointer', fontFamily:'Poppins,sans-serif' }}>
                    <LogOut size={12}/> Out
                  </button>
                </div>
              </div>
            </div>

            <div style={{ padding:'12px', display:'flex', flexDirection:'column', gap:12 }}>

              {/* Salary card — iridescent dark */}
              <div style={{ borderRadius:20, overflow:'hidden', position:'relative', background:'linear-gradient(135deg,#F8F4FF 0%,#FFF4F0 25%,#F0FFF8 50%,#F0F4FF 75%,#FFF8F0 100%)', border:'1px solid rgba(0,0,0,0.06)', padding:'20px 18px 16px', boxShadow:'0 4px 20px rgba(0,0,0,0.07)' }}>
                {/* Shimmer blobs */}
                <div style={{ position:'absolute', top:-40, right:-40, width:160, height:160, borderRadius:'50%', background:'radial-gradient(circle,rgba(124,58,237,0.12),transparent 70%)', pointerEvents:'none' }}/>
                <div style={{ position:'absolute', bottom:-30, left:-20, width:120, height:120, borderRadius:'50%', background:'radial-gradient(circle,rgba(59,130,246,0.1),transparent 70%)', pointerEvents:'none' }}/>
                <div style={{ fontSize:10, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6 }}>
                  This Month · {monthLabel}
                </div>
                <div style={{ fontWeight:900, fontSize:38, color:'#111', letterSpacing:'-0.04em', marginBottom:10, lineHeight:1 }}>
                  {fmtA(net)}
                </div>
                {/* Progress bar with arrow */}
                <div style={{ position:'relative', marginBottom:12 }}>
                  <div style={{ height:8, background:'rgba(0,0,0,0.08)', borderRadius:10, overflow:'hidden' }}>
                    <div style={{ height:'100%', width: net > 0 && payroll?.base_salary > 0 ? `${Math.min(100, Math.round(net / Number(payroll.base_salary) * 85))}%` : '70%', background:'rgba(0,0,0,0.35)', borderRadius:10, transition:'width 0.6s ease' }}/>
                  </div>
                  <div style={{ position:'absolute', right:0, top:'50%', transform:'translateY(-50%)', width:26, height:26, borderRadius:'50%', background:'#FFF', boxShadow:'0 2px 8px rgba(0,0,0,0.15)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}
                    onClick={() => setTab('pay')}>
                    <ChevronRight size={13} color="#111"/>
                  </div>
                </div>
                <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
                  <span style={{ fontSize:12, color:'#374151', fontWeight:500 }}>Base {fmtA(payroll?.base_salary||0)}</span>
                  {Number(payroll?.bonus_total)>0     && <span style={{ fontSize:12, color:'#16A34A', fontWeight:600 }}>+{fmtA(payroll.bonus_total)}</span>}
                  {Number(payroll?.deduction_total)>0 && <span style={{ fontSize:12, color:'#DC2626', fontWeight:600 }}>−{fmtA(payroll.deduction_total)}</span>}
                </div>
              </div>

              {/* Quick actions */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                {[
                  { l:'Apply Leave',  icon:Plus,       c:'#F59E0B', bg:'#FFF7ED', action:()=>setLeaveModal(true)  },
                  { l:'Payslips',     icon:FileText,   c:'#10B981', bg:'#F0FDF4', action:()=>setTab('pay')        },
                  { l:'Leaves',       icon:Calendar,   c:'#7C3AED', bg:'#F5F3FF', action:()=>setTab('leaves')     },
                  { l:'Vehicle',      icon:Car,        c:'#2563EB', bg:'#EFF6FF', action:()=>setTab('vehicle')    },
                  { l:'Performance',  icon:BarChart2,  c:'#F97316', bg:'#FFF7ED', action:()=>setTab('perf')       },
                  { l:'Insurance',    icon:Shield,     c:'#0F766E', bg:'#F0FDFA', action:()=>setTab('insurance')  },
                  { l:'Notices',      icon:Bell,       c:'#DC2626', bg:'#FEF2F2', action:openNotices              },
                ].map(a => {
                  const Icon = a.icon
                  return (
                    <button key={a.l} onClick={a.action}
                      style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 12px', borderRadius:16, background:'#FFF', border:'1px solid #EBEBEB', cursor:'pointer', fontFamily:'Poppins,sans-serif', textAlign:'left', width:'100%', boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
                      <div style={{ width:36, height:36, borderRadius:10, background:a.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <Icon size={16} color={a.c}/>
                      </div>
                      <span style={{ fontWeight:600, fontSize:13, color:'#111', lineHeight:1.3 }}>{a.l}</span>
                    </button>
                  )
                })}
              </div>

              {/* Vehicle Status */}
              <div>
                <div style={{ fontWeight:700, fontSize:15, color:'#111', marginBottom:10 }}>Vehicle Status</div>

                {hasTwoVehicles && (
                  <div style={{ background:'#FEF2F2', border:'1.5px solid #FCA5A5', borderRadius:14, padding:'12px 14px', display:'flex', gap:10, alignItems:'flex-start', marginBottom:10 }}>
                    <AlertTriangle size={18} color="#DC2626" style={{ flexShrink:0, marginTop:1 }}/>
                    <div>
                      <div style={{ fontWeight:800, fontSize:13.5, color:'#DC2626', marginBottom:2 }}>You have {allCurrentVehicles.length} vehicles assigned</div>
                      <div style={{ fontSize:12, color:'#991B1B', lineHeight:1.5 }}>You must return one vehicle before receiving another.</div>
                    </div>
                  </div>
                )}

                {myPendingReturn ? (
                  myPendingReturn.status === 'pending_acceptance' ? (
                    <Card style={{ border:'1px solid #FDE68A', background:'linear-gradient(135deg,#FFFBEB,#FEF3C7)' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
                        <div style={{ width:48, height:48, borderRadius:14, background:'#FEF3C7', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          <ArrowLeftRight size={22} color="#D97706"/>
                        </div>
                        <div>
                          <div style={{ fontWeight:800, fontSize:17, color:'#111', letterSpacing:'-0.02em' }}>{myPendingReturn.vehicle_plate || '—'}</div>
                          <div style={{ fontSize:12, color:'#6B7280', marginTop:2 }}>Return submitted to {myPendingReturn.receiver_name || 'driver'}</div>
                        </div>
                      </div>
                      <div style={{ padding:'9px 12px', background:'#FEF3C7', border:'1px solid #FDE68A', borderRadius:10, fontSize:12.5, color:'#92400E', fontWeight:600, textAlign:'center' }}>
                        ⏳ Awaiting {myPendingReturn.receiver_name || 'the driver'} to accept
                      </div>
                    </Card>
                  ) : (
                    <Card style={{ border:'1px solid #A7F3D0', background:'linear-gradient(135deg,#ECFDF5,#D1FAE5)' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
                        <div style={{ width:48, height:48, borderRadius:'50%', background:'#DCFCE7', border:'2px solid #A7F3D0', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          <Check size={22} color="#16A34A"/>
                        </div>
                        <div>
                          <div style={{ fontWeight:800, fontSize:17, color:'#111' }}>{myPendingReturn.vehicle_plate} Returned</div>
                          <div style={{ fontSize:12, color:'#6B7280', marginTop:2 }}>Accepted by {myPendingReturn.receiver_name || 'driver'}</div>
                        </div>
                      </div>
                      <div style={{ padding:'9px 12px', background:'#D1FAE5', border:'1px solid #A7F3D0', borderRadius:10, fontSize:12.5, color:'#065F46', fontWeight:700, textAlign:'center' }}>
                        ✓ Handover successful — you&apos;re all done!
                      </div>
                    </Card>
                  )
                ) : vehicle ? (
                  <Card style={{ border:'1px solid #A7F3D0', background:'linear-gradient(135deg,#F0FDF4,#DCFCE7)' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
                      <div style={{ width:48, height:48, borderRadius:14, background:'#DCFCE7', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <Car size={22} color="#16A34A"/>
                      </div>
                      <div>
                        <div style={{ fontWeight:800, fontSize:17, color:'#111', letterSpacing:'-0.02em' }}>{vehicle.vehicle_plate || vehicle.plate}</div>
                        <div style={{ fontSize:12, color:'#6B7280', marginTop:2 }}>
                          {[vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'Vehicle'} · Since {new Date(vehicle.submitted_at).toLocaleDateString('en-AE',{day:'numeric',month:'short'})}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setHvModal('returned')}
                      style={{ width:'100%', padding:'11px', borderRadius:12, background:'#FEF2F2', border:'1.5px solid #FECACA', color:'#DC2626', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'Poppins,sans-serif' }}>
                      Return Vehicle
                    </button>
                  </Card>
                ) : effectiveTodayAsgn ? (
                  <Card style={{ border:'1px solid #BFDBFE', background:'linear-gradient(135deg,#EFF6FF,#DBEAFE)' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
                      <div style={{ width:48, height:48, borderRadius:14, background:'#DBEAFE', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <Car size={22} color="#2563EB"/>
                      </div>
                      <div>
                        <div style={{ fontWeight:800, fontSize:17, color:'#111' }}>{effectiveTodayAsgn.plate}</div>
                        <div style={{ fontSize:12, color:'#6B7280', marginTop:2 }}>{[effectiveTodayAsgn.make,effectiveTodayAsgn.model].filter(Boolean).join(' ')||'Vehicle'}</div>
                      </div>
                    </div>
                    <button onClick={() => setHvModal('returned')}
                      style={{ width:'100%', padding:'11px', borderRadius:12, background:'#FEF2F2', border:'1.5px solid #FECACA', color:'#DC2626', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'Poppins,sans-serif' }}>
                      Return Vehicle
                    </button>
                  </Card>
                ) : (
                  <Card style={{ textAlign:'center', padding:'32px 20px' }}>
                    <svg width="88" height="56" viewBox="0 0 88 56" fill="none" style={{ margin:'0 auto 14px', display:'block' }}>
                      <ellipse cx="44" cy="50" rx="32" ry="5" fill="#E5E7EB" opacity="0.6"/>
                      <rect x="10" y="24" width="68" height="24" rx="6" fill="#D1D5DB"/>
                      <path d="M18 24 L28 10 L60 10 L70 24Z" fill="#E5E7EB"/>
                      <rect x="8" y="36" width="10" height="10" rx="5" fill="#9CA3AF"/>
                      <rect x="70" y="36" width="10" height="10" rx="5" fill="#9CA3AF"/>
                      <rect x="20" y="14" width="18" height="10" rx="2" fill="#BFDBFE" opacity="0.8"/>
                      <rect x="50" y="14" width="18" height="10" rx="2" fill="#BFDBFE" opacity="0.8"/>
                    </svg>
                    <div style={{ fontWeight:600, fontSize:14, color:'#374151', marginBottom:4 }}>No vehicle assigned.</div>
                    <div style={{ fontSize:12, color:'#9CA3AF' }}>Your station will assign a vehicle</div>
                  </Card>
                )}
              </div>

              {/* Pending handovers */}
              {pendingHandovers.map(ph => {
                const isPendingAccept = ph.status === 'pending_acceptance'
                const isAccepted      = ph.status === 'accepted'
                const isPocPending    = ph.status === 'poc_pending'
                const cardBg     = isPendingAccept ? '#FFF7ED' : isPocPending ? '#F5F3FF' : '#F0FDF4'
                const cardBorder = isPendingAccept ? '#FED7AA' : isPocPending ? '#DDD6FE' : '#A7F3D0'
                const iconBg     = isPendingAccept ? '#FEF3C7' : isPocPending ? '#EDE9FE' : '#DCFCE7'
                const iconColor  = isPendingAccept ? '#D97706' : isPocPending ? '#7C3AED' : '#16A34A'
                const statusLabel = isPendingAccept ? 'Incoming Handover Request'
                                  : isPocPending    ? 'Awaiting POC Verification'
                                  : 'Handover Accepted — Upload Photos'
                return (
                  <Card key={ph.id} style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                      <div style={{ width:36, height:36, borderRadius:10, background: iconBg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <ArrowLeftRight size={16} color={iconColor}/>
                      </div>
                      <div>
                        <div style={{ fontSize:11, fontWeight:700, color: iconColor, textTransform:'uppercase', letterSpacing:'0.06em' }}>{statusLabel}</div>
                        <div style={{ fontSize:12, color:'#374151', fontWeight:600, marginTop:1 }}>{ph.vehicle_plate || ph.plate} · from {ph.emp_name}</div>
                      </div>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:10 }}>
                      {[
                        { l:'Vehicle', v: `${ph.make||''} ${ph.model||''}`.trim() || '—' },
                        { l:'Fuel',    v: { empty:'Empty', quarter:'1/4', half:'1/2', three_quarter:'3/4', full:'Full' }[ph.fuel_level] || ph.fuel_level || '—' },
                        { l:'ODO',     v: ph.odometer ? `${Number(ph.odometer).toLocaleString()} km` : '—' },
                        { l:'Date',    v: new Date(ph.submitted_at).toLocaleDateString('en-AE',{day:'numeric',month:'short'}) },
                      ].map(c=>(
                        <div key={c.l} style={{ background:'rgba(255,255,255,0.6)', borderRadius:8, padding:'6px 8px' }}>
                          <div style={{ fontSize:9, color:'#9CA3AF', fontWeight:700 }}>{c.l}</div>
                          <div style={{ fontSize:11.5, color:'#111', fontWeight:600 }}>{c.v}</div>
                        </div>
                      ))}
                    </div>
                    {isPendingAccept && (
                      <div style={{ display:'flex', gap:8 }}>
                        <button onClick={async () => {
                            if (!confirm('Reject this handover?')) return
                            try {
                              const r = await fetch(`${API}/api/handovers/${ph.id}/reject`, { method:'PATCH', headers: authHeader() })
                              if (!r.ok) { const d=await r.json(); alert(d.error||'Failed'); return }
                              refreshPending()
                            } catch(e) { alert(e.message) }
                          }}
                          style={{ flex:1, padding:'10px', borderRadius:12, background:'#FEF2F2', color:'#DC2626', fontWeight:700, fontSize:13, border:'1.5px solid #FCA5A5', cursor:'pointer', fontFamily:'Poppins,sans-serif' }}>
                          Reject
                        </button>
                        <button onClick={async () => {
                            try {
                              const r = await fetch(`${API}/api/handovers/${ph.id}/accept`, { method:'PATCH', headers: authHeader() })
                              if (!r.ok) { const d=await r.json(); alert(d.error||'Failed'); return }
                              refreshPending()
                            } catch(e) { alert(e.message) }
                          }}
                          style={{ flex:2, padding:'10px', borderRadius:12, background:'#D97706', color:'#FFF', fontWeight:700, fontSize:13, border:'none', cursor:'pointer', fontFamily:'Poppins,sans-serif' }}>
                          Accept Handover
                        </button>
                      </div>
                    )}
                    {isAccepted && (
                      <button onClick={() => setCompletingHandover(ph)}
                        style={{ width:'100%', padding:'10px', borderRadius:12, background:'#16A34A', color:'#FFF', fontWeight:700, fontSize:13, border:'none', cursor:'pointer', fontFamily:'Poppins,sans-serif' }}>
                        Upload Photos &amp; Complete
                      </button>
                    )}
                    {isPocPending && (
                      <div style={{ padding:'9px 12px', borderRadius:10, background:'#EDE9FE', border:'1px solid #DDD6FE', fontSize:12, color:'#5B21B6', fontWeight:600, textAlign:'center' }}>
                        ⏳ Waiting for POC to verify this handover
                      </div>
                    )}
                  </Card>
                )
              })}

              {/* Document expiry */}
              {p && (p.visa_expiry || p.license_expiry || p.iloe_expiry) && (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                  {[['Visa',p.visa_expiry],['License',p.license_expiry],['ILOE',p.iloe_expiry]].map(([l,d])=>{
                    const days = d ? differenceInDays(parseISO(d.slice(0,10)), new Date()) : null
                    const c = days===null?'#9CA3AF':days<0?'#EF4444':days<=30?'#EF4444':days<=90?'#F59E0B':'#10B981'
                    const bg = days===null?'#F9FAFB':days<0?'#FEF2F2':days<=30?'#FEF2F2':days<=90?'#FFFBEB':'#F0FDF4'
                    return (
                      <div key={l} style={{ textAlign:'center', padding:'10px 8px', borderRadius:12, background:bg, border:`1px solid ${c}30` }}>
                        <div style={{ fontSize:9, fontWeight:800, color:c, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:3 }}>{l}</div>
                        <div style={{ fontSize:12, color:c, fontWeight:700 }}>
                          {d ? (days < 0 ? 'Expired' : days <= 90 ? `${days}d` : 'Valid') : 'N/A'}
                        </div>
                        {d && <div style={{ fontSize:9, color:c, opacity:0.6, marginTop:2 }}>{d.slice(0,10)}</div>}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Latest notice */}
              {notices.length > 0 && (
                <Card>
                  <div style={{ fontSize:10, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Latest Notice</div>
                  <div style={{ fontWeight:600, fontSize:13.5, color:'#111', marginBottom:4 }}>{notices[0].title}</div>
                  <div style={{ fontSize:12.5, color:'#6B7280', lineHeight:1.6 }}>
                    {notices[0].message?.slice(0,120)}{notices[0].message?.length>120?'…':''}
                  </div>
                  {notices.length > 1 && (
                    <button onClick={()=>setTab('notices')}
                      style={{ marginTop:8, fontSize:12, color:'#2563EB', fontWeight:600, background:'none', border:'none', cursor:'pointer', fontFamily:'Poppins,sans-serif', padding:0, display:'flex', alignItems:'center', gap:3 }}>
                      View all {notices.length} <ChevronRight size={12}/>
                    </button>
                  )}
                </Card>
              )}
            </div>
          </div>
        )}

        {/* ════ ATTENDANCE ════ */}
        {tab === 'att' && (
          <div style={{ padding:'16px', display:'flex', flexDirection:'column', gap:14 }} className="fade">
            <h2 style={{ fontWeight:800, fontSize:22, color:'#111', margin:0 }}>My Attendance</h2>
            <div style={{ fontSize:12, color:'#9CA3AF', marginTop:-8 }}>{monthLabel}</div>

            {/* Monthly summary */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
              {[
                { label:'Present', value:attPresent, color:'#059669', bg:'#ECFDF5', border:'#A7F3D0' },
                { label:'Absent',  value:attAbsent,  color:'#DC2626', bg:'#FEF2F2', border:'#FCA5A5' },
                { label:'Leave',   value:attLeave,   color:'#D97706', bg:'#FFFBEB', border:'#FCD34D' },
              ].map(s => (
                <div key={s.label} style={{ background:s.bg, border:`1px solid ${s.border}`, borderRadius:14, padding:'14px 10px', textAlign:'center' }}>
                  <div style={{ fontSize:28, fontWeight:900, color:s.color, letterSpacing:'-0.05em' }}>{s.value}</div>
                  <div style={{ fontSize:11, fontWeight:600, color:s.color, opacity:0.8 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Variable pay summary */}
            <div style={{ background:'linear-gradient(135deg,#FFFBEB,#FEF3C7)', border:'1.5px solid #FDE68A', borderRadius:16, padding:'18px 16px' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#B45309', textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:4 }}>
                {isShipmentEmp ? 'Total Shipments This Month' : 'Total Hours This Month'}
              </div>
              <div style={{ fontWeight:900, fontSize:32, color:'#92400E', letterSpacing:'-0.04em' }}>
                {totalUnits > 0 ? (isShipmentEmp ? `${Math.round(totalUnits)} shipments` : `${totalUnits.toFixed(1)}h`) : '—'}
              </div>
              <div style={{ marginTop:10, paddingTop:10, borderTop:'1px solid #FDE68A', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:13, color:'#92400E', fontWeight:600 }}>Variable pay so far</span>
                <span style={{ fontWeight:900, fontSize:18, color:'#B8860B' }}>{fmtA(variablePay)}</span>
              </div>
              <div style={{ fontSize:11, color:'#B45309', marginTop:4, opacity:0.7 }}>
                {isShipmentEmp ? 'shipments × AED 0.50' : 'hours × AED 3.85'} + AED 2,000 base = monthly salary
              </div>
            </div>

            {/* Daily records */}
            {attRecords.length > 0 ? (
              <div style={{ background:'#FFF', border:'1px solid #EBEBEB', borderRadius:16, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ padding:'12px 16px', borderBottom:'1px solid #F3F4F6', fontSize:11, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.08em' }}>Daily Records</div>
                {[...attRecords].sort((a,b) => b.date.localeCompare(a.date)).map(r => {
                  const sColor = { present:'#059669', absent:'#DC2626', leave:'#D97706' }[r.status] || '#9CA3AF'
                  const sBg    = { present:'#ECFDF5', absent:'#FEF2F2', leave:'#FFFBEB' }[r.status] || '#F9FAFB'
                  const units  = parseFloat(r.cycle_hours || 0)
                  const dLabel = new Date(r.date + 'T00:00:00').toLocaleDateString('en-AE', { weekday:'short', day:'numeric', month:'short' })
                  return (
                    <div key={r.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom:'1px solid #F9FAFB' }}>
                      <div>
                        <div style={{ fontSize:13, fontWeight:600, color:'#111' }}>{dLabel}</div>
                        {units > 0 && r.status === 'present' && (
                          <div style={{ fontSize:11, color:'#9CA3AF', marginTop:1 }}>
                            {isShipmentEmp ? `${Math.round(units)} shipments` : `${units}h worked`}
                          </div>
                        )}
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:3 }}>
                        <span style={{ fontSize:11, fontWeight:700, color:sColor, background:sBg, padding:'3px 10px', borderRadius:20 }}>
                          {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                        </span>
                        {r.status === 'present' && parseFloat(r.earnings||0) > 0 && (
                          <span style={{ fontSize:11, fontWeight:600, color:'#B8860B' }}>{fmtA(parseFloat(r.earnings).toFixed(2))}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ background:'#FFF', border:'1px solid #EBEBEB', borderRadius:16, padding:'40px 20px', textAlign:'center' }}>
                <Clock size={28} color="#D1D5DB" style={{ margin:'0 auto 10px', display:'block' }}/>
                <div style={{ fontSize:14, color:'#9CA3AF', fontWeight:500 }}>No attendance records this month</div>
              </div>
            )}
          </div>
        )}

        {/* ════ PAYSLIPS ════ */}
        {tab === 'pay' && (
          <div style={{ padding:'16px', display:'flex', flexDirection:'column', gap:14 }} className="fade">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h2 style={{ fontWeight:800, fontSize:22, color:'#111', margin:0 }}>My Payslip</h2>
              <select value={payMonth} onChange={e=>setPayMonth(e.target.value)}
                style={{ fontSize:12, fontWeight:700, color:'#111', background:'#FFF', border:'1px solid #E5E7EB', borderRadius:10, padding:'7px 10px', fontFamily:'inherit' }}>
                {PAY_MONTHS.map(m => (
                  <option key={m} value={m}>{new Date(m+'-01').toLocaleString('en-US',{month:'long',year:'numeric'})}</option>
                ))}
              </select>
            </div>
            {!payslip ? (
              <Card style={{ textAlign:'center', padding:'40px' }}>
                <Wallet size={32} color="#D1D5DB" style={{ margin:'0 auto 10px', display:'block' }}/>
                <div style={{ fontSize:14, color:'#9CA3AF', fontWeight:500 }}>No payroll data for {payMonthLabel}</div>
              </Card>
            ) : (
              <>
                {/* Net salary hero */}
                <div style={{ borderRadius:20, padding:'22px 20px', background:'linear-gradient(135deg,#FFFBEB,#FEF3C7)', border:'1.5px solid #FDE68A', boxShadow:'0 4px 16px rgba(184,134,11,0.12)' }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'#B45309', textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:8 }}>Net Salary · {payMonthLabel}</div>
                  <div style={{ fontWeight:900, fontSize:36, color:'#92400E', letterSpacing:'-0.04em', marginBottom:10 }}>{fmtA(payslipNet)}</div>
                  <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color: payslip.payroll_status==='paid' ? '#16A34A' : '#B45309', fontWeight:600 }}>
                    {payslip.payroll_status==='paid'
                      ? <><Check size={14}/> Paid</>
                      : <><Clock size={14}/> Pending payment</>
                    }
                  </div>
                </div>

                {/* Variable pay from attendance — only meaningful for the month in
                    progress; a closed past month's totals are already in the breakdown below. */}
                {isCurrentPayMonth && attEarnings && variablePay > 0 && (
                  <div style={{ background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:14, padding:'14px 16px' }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'#065F46', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6 }}>Variable Pay This Month</div>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ fontSize:12, color:'#065F46' }}>
                        {isShipmentEmp ? `${Math.round(totalUnits)} shipments × AED 0.50` : `${totalUnits.toFixed(1)}h × AED 3.85`}
                      </span>
                      <span style={{ fontWeight:800, fontSize:16, color:'#16A34A' }}>{fmtA(variablePay.toFixed(2))}</span>
                    </div>
                    <div style={{ fontSize:10, color:'#6B7280', marginTop:4 }}>Added to AED 2,000 base → monthly salary</div>
                  </div>
                )}

                {/* Breakdown */}
                <Card>
                  <div style={{ fontSize:10, fontWeight:800, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:14 }}>Payroll Breakdown</div>
                  {[
                    { l:'Base Salary', v:fmtA(payslip.base_salary),             c:'#111'    },
                    { l:'Bonuses',     v:`+${fmtA(payslip.bonus_total||0)}`,     c:'#16A34A' },
                    { l:'Deductions',  v:`−${fmtA(payslip.deduction_total||0)}`, c:'#DC2626' },
                  ].map((r,i) => (
                    <div key={r.l} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'11px 0', borderBottom: i<2 ? '1px solid #F3F4F6' : 'none' }}>
                      <span style={{ fontSize:14, color:'#6B7280' }}>{r.l}</span>
                      <span style={{ fontWeight:700, fontSize:14, color:r.c }}>{r.v}</span>
                    </div>
                  ))}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'13px 16px', background:'#FFFBEB', borderRadius:12, marginTop:10, border:'1px solid #FDE68A' }}>
                    <span style={{ fontWeight:700, fontSize:14, color:'#92400E' }}>Net Total</span>
                    <span style={{ fontWeight:900, fontSize:18, color:'#B8860B' }}>{fmtA(payslipNet)}</span>
                  </div>
                </Card>

                {/* Additions */}
                {(payslip.bonuses||[]).length > 0 && (
                  <Card>
                    <div style={{ fontSize:10, fontWeight:800, color:'#16A34A', textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:12 }}>Additions</div>
                    {payslip.bonuses.map(b => (
                      <div key={b.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', background:'#F0FDF4', borderRadius:10, marginBottom:6 }}>
                        <span style={{ fontSize:13, color:'#065F46', fontWeight:500 }}>{b.type?.charAt(0).toUpperCase()+b.type?.slice(1)}{b.description ? ` — ${b.description}` : ''}</span>
                        <span style={{ fontWeight:700, fontSize:13, color:'#16A34A' }}>+{fmtA(b.amount)}</span>
                      </div>
                    ))}
                  </Card>
                )}

                {/* Deductions */}
                {(payslip.deductions||[]).length > 0 && (
                  <Card>
                    <div style={{ fontSize:10, fontWeight:800, color:'#DC2626', textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:12 }}>Deductions</div>
                    {payslip.deductions.map(d => (
                      <div key={d.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', background:'#FEF2F2', borderRadius:10, marginBottom:6 }}>
                        <span style={{ fontSize:13, color:'#991B1B', fontWeight:500 }}>{DED_LABELS[d.type]||d.type}{d.description ? ` — ${d.description}` : ''}</span>
                        <span style={{ fontWeight:700, fontSize:13, color:'#DC2626' }}>−{fmtA(d.amount)}</span>
                      </div>
                    ))}
                  </Card>
                )}
              </>
            )}
          </div>
        )}

        {/* ════ LEAVES ════ */}
        {tab === 'leaves' && (
          <div style={{ padding:'16px', display:'flex', flexDirection:'column', gap:14 }} className="fade">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h2 style={{ fontWeight:800, fontSize:22, color:'#111', margin:0 }}>My Leaves</h2>
              <button onClick={()=>setLeaveModal(true)}
                style={{ display:'flex', alignItems:'center', gap:5, padding:'8px 14px', borderRadius:20, background:'transparent', color:'#111', fontWeight:600, fontSize:12.5, border:'1.5px solid #D1D5DB', cursor:'pointer', fontFamily:'Poppins,sans-serif' }}>
                Apply Leave <Plus size={13}/>
              </button>
            </div>

            {leaves.length === 0 ? (
              <Card style={{ textAlign:'center', padding:'48px 24px' }}>
                <div style={{ width:72, height:72, borderRadius:20, background:'#F3F4F6', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
                  <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                    <rect x="4" y="8" width="28" height="24" rx="4" stroke="#9CA3AF" strokeWidth="2"/>
                    <path d="M4 14h28" stroke="#9CA3AF" strokeWidth="2"/>
                    <path d="M12 4v8M24 4v8" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M13 22l3 3 7-7" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div style={{ fontWeight:700, fontSize:15, color:'#111', marginBottom:6 }}>No leave requests yet</div>
                <div style={{ fontSize:13, color:'#9CA3AF', lineHeight:1.6 }}>Your past and future leave requests<br/>will appear here.</div>
              </Card>
            ) : (
              <Card style={{ padding:0, overflow:'hidden' }}>
                {leaves.map((l, i) => {
                  const tc = TYPE_COLORS[l.type] || '#6B7280'
                  const statusCfg = l.status === 'approved'
                    ? { c:'#16A34A', bg:'#DCFCE7', label:'Approved' }
                    : l.status === 'rejected'
                    ? { c:'#DC2626', bg:'#FEE2E2', label:'Rejected' }
                    : { c:'#D97706', bg:'#FEF3C7', label:'Pending' }
                  const fromFmt = new Date(l.from_date+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})
                  const toFmt   = new Date(l.to_date+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})
                  return (
                    <div key={l.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', borderBottom: i < leaves.length-1 ? '1px solid #F3F4F6' : 'none' }}>
                      {/* Calendar icon box */}
                      <div style={{ width:42, height:42, borderRadius:12, background:'#EFF6FF', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <Calendar size={18} color="#2563EB"/>
                      </div>
                      {/* Content */}
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:700, fontSize:14, color:'#111', marginBottom:2 }}>{l.type} Leave</div>
                        <div style={{ fontSize:12, color:'#6B7280' }}>{fromFmt} – {toFmt}</div>
                      </div>
                      {/* Status pill */}
                      <span style={{ fontSize:12, fontWeight:700, color:statusCfg.c, background:statusCfg.bg, borderRadius:20, padding:'4px 12px', flexShrink:0 }}>
                        {statusCfg.label}
                      </span>
                    </div>
                  )
                })}
              </Card>
            )}
            <p style={{ fontSize:12.5, color:'#9CA3AF', textAlign:'center', margin:0 }}>Need to take time off? Apply for a new leave.</p>
          </div>
        )}

        {/* ════ PERFORMANCE ════ */}
        {tab === 'perf' && (
          <div style={{ padding:'16px', display:'flex', flexDirection:'column', gap:14 }} className="fade">
            <h2 style={{ fontWeight:800, fontSize:22, color:'#111', margin:0 }}>Performance</h2>
            <Card style={{ textAlign:'center', padding:'52px 24px' }}>
              <div style={{ width:72, height:72, borderRadius:20, background:'linear-gradient(135deg,#FDF6E3,#FEF3D0)', border:'1px solid #F0D78C', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 18px' }}>
                <BarChart2 size={30} color="#B8860B"/>
              </div>
              <div style={{ fontWeight:800, fontSize:18, color:'#111', marginBottom:8 }}>Coming Soon</div>
              <div style={{ fontSize:13, color:'#9CA3AF', lineHeight:1.6 }}>Performance tracking is being set up.<br/>Check back soon.</div>
            </Card>
          </div>
        )}

        {/* ════ VEHICLE ════ */}
        {tab === 'vehicle' && (
          <div style={{ padding:'16px', display:'flex', flexDirection:'column', gap:14 }} className="fade">
            <h2 style={{ fontWeight:800, fontSize:22, color:'#111', margin:0 }}>Vehicle Assignment and Logs</h2>

            {hasTwoVehicles && (
              <div style={{ background:'#FEF2F2', border:'1.5px solid #FCA5A5', borderRadius:14, padding:'12px 14px', display:'flex', gap:10, alignItems:'flex-start' }}>
                <AlertTriangle size={18} color="#DC2626" style={{ flexShrink:0, marginTop:1 }}/>
                <div>
                  <div style={{ fontWeight:800, fontSize:13.5, color:'#DC2626', marginBottom:2 }}>You have {allCurrentVehicles.length} vehicles assigned</div>
                  <div style={{ fontSize:12, color:'#991B1B', lineHeight:1.5 }}>You must return one vehicle before receiving another.</div>
                </div>
              </div>
            )}

            {/* Assigned vehicle card */}
            {myPendingReturn ? (
              <>
                {myPendingReturn.status === 'pending_acceptance' && (vehicle || effectiveTodayAsgn) && (() => {
                  const v = vehicle || effectiveTodayAsgn
                  const plate = v.vehicle_plate || v.plate || myPendingReturn.vehicle_plate || '—'
                  const makeModel = [v.make, v.model].filter(Boolean).join(' ') || 'Vehicle'
                  const assignedOn = v.submitted_at || v.date
                    ? new Date(v.submitted_at || v.date).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})
                    : '—'
                  return (
                    <Card>
                      <div style={{ display:'flex', gap:14, marginBottom:10 }}>
                        <div style={{ width:100, height:80, background:'#F8FAFC', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, border:'1px solid #E5E7EB' }}>
                          <svg width="68" height="44" viewBox="0 0 68 44" fill="none">
                            <ellipse cx="34" cy="40" rx="26" ry="4" fill="#E5E7EB" opacity="0.7"/>
                            <rect x="6" y="18" width="56" height="20" rx="5" fill="#CBD5E1"/>
                            <path d="M12 18 L20 6 L48 6 L56 18Z" fill="#94A3B8"/>
                            <rect x="4" y="28" width="8" height="8" rx="4" fill="#64748B"/>
                            <rect x="56" y="28" width="8" height="8" rx="4" fill="#64748B"/>
                            <rect x="14" y="9" width="14" height="9" rx="2" fill="#BFDBFE" opacity="0.9"/>
                            <rect x="40" y="9" width="14" height="9" rx="2" fill="#BFDBFE" opacity="0.9"/>
                            <rect x="10" y="22" width="8" height="4" rx="2" fill="#FCD34D"/>
                            <rect x="50" y="22" width="8" height="4" rx="2" fill="#F87171"/>
                          </svg>
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:11, color:'#9CA3AF', marginBottom:2 }}>Currently assigned:</div>
                          <div style={{ fontWeight:800, fontSize:16, color:'#111', marginBottom:6 }}>{makeModel}</div>
                          <div style={{ fontSize:12.5, color:'#374151', marginBottom:3 }}><span style={{ color:'#9CA3AF' }}>Plate: </span>{plate}</div>
                          <div style={{ fontSize:12.5, color:'#374151' }}><span style={{ color:'#9CA3AF' }}>Since: </span>{assignedOn}</div>
                        </div>
                      </div>
                      <div style={{ padding:'10px 12px', background:'#FEF3C7', border:'1px solid #FDE68A', borderRadius:10, fontSize:12.5, color:'#92400E', fontWeight:600, textAlign:'center' }}>
                        ⏳ Return submitted — awaiting {myPendingReturn.receiver_name || 'driver'} to accept
                      </div>
                    </Card>
                  )
                })()}
                {myPendingReturn.status !== 'pending_acceptance' && (
                  <Card style={{ border:'1px solid #A7F3D0', background:'linear-gradient(135deg,#ECFDF5,#D1FAE5)', textAlign:'center', padding:'32px 20px' }}>
                    <div style={{ width:56, height:56, borderRadius:'50%', background:'#DCFCE7', border:'2px solid #A7F3D0', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>
                      <Check size={26} color="#16A34A"/>
                    </div>
                    <div style={{ fontWeight:800, fontSize:18, color:'#111', marginBottom:4 }}>{myPendingReturn.vehicle_plate} Returned</div>
                    <div style={{ fontSize:13, color:'#6B7280', marginBottom:14 }}>Accepted by {myPendingReturn.receiver_name || 'driver'}</div>
                    <div style={{ padding:'10px 12px', background:'#D1FAE5', border:'1px solid #A7F3D0', borderRadius:10, fontSize:12.5, color:'#065F46', fontWeight:700 }}>
                      ✓ Handover successful — you&apos;re all done!
                    </div>
                  </Card>
                )}
              </>
            ) : (vehicle || effectiveTodayAsgn) ? (() => {
              const v = vehicle || effectiveTodayAsgn
              const plate = v.vehicle_plate || v.plate || '—'
              const makeModel = [v.make, v.model].filter(Boolean).join(' ') || 'Vehicle'
              const assignedOn = v.submitted_at || v.date
                ? new Date(v.submitted_at || v.date).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})
                : '—'
              return (
                <Card>
                  <div style={{ display:'flex', gap:14, marginBottom:14 }}>
                    <div style={{ width:100, height:80, background:'#F8FAFC', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, border:'1px solid #E5E7EB' }}>
                      <svg width="68" height="44" viewBox="0 0 68 44" fill="none">
                        <ellipse cx="34" cy="40" rx="26" ry="4" fill="#E5E7EB" opacity="0.7"/>
                        <rect x="6" y="18" width="56" height="20" rx="5" fill="#CBD5E1"/>
                        <path d="M12 18 L20 6 L48 6 L56 18Z" fill="#94A3B8"/>
                        <rect x="4" y="28" width="8" height="8" rx="4" fill="#64748B"/>
                        <rect x="56" y="28" width="8" height="8" rx="4" fill="#64748B"/>
                        <rect x="14" y="9" width="14" height="9" rx="2" fill="#BFDBFE" opacity="0.9"/>
                        <rect x="40" y="9" width="14" height="9" rx="2" fill="#BFDBFE" opacity="0.9"/>
                        <rect x="10" y="22" width="8" height="4" rx="2" fill="#FCD34D"/>
                        <rect x="50" y="22" width="8" height="4" rx="2" fill="#F87171"/>
                      </svg>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:11, color:'#9CA3AF', marginBottom:2 }}>Assigned:</div>
                      <div style={{ fontWeight:800, fontSize:16, color:'#111', marginBottom:6 }}>{makeModel}</div>
                      <div style={{ fontSize:12.5, color:'#374151', marginBottom:3 }}>
                        <span style={{ color:'#9CA3AF' }}>License Plate: </span>{plate}
                      </div>
                      <div style={{ fontSize:12.5, color:'#374151' }}>
                        <span style={{ color:'#9CA3AF' }}>Assigned on: </span>{assignedOn}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setHvModal('returned')}
                    style={{ width:'100%', padding:'12px', borderRadius:12, background:'#2563EB', color:'#FFF', fontWeight:700, fontSize:14, border:'none', cursor:'pointer', fontFamily:'Poppins,sans-serif' }}>
                    Report Issue / Return Vehicle
                  </button>
                </Card>
              )
            })() : (
              <Card style={{ textAlign:'center', padding:'32px 20px' }}>
                <svg width="88" height="56" viewBox="0 0 88 56" fill="none" style={{ margin:'0 auto 14px', display:'block' }}>
                  <ellipse cx="44" cy="50" rx="32" ry="5" fill="#E5E7EB" opacity="0.6"/>
                  <rect x="10" y="24" width="68" height="24" rx="6" fill="#D1D5DB"/>
                  <path d="M18 24 L28 10 L60 10 L70 24Z" fill="#E5E7EB"/>
                  <rect x="8" y="36" width="10" height="10" rx="5" fill="#9CA3AF"/>
                  <rect x="70" y="36" width="10" height="10" rx="5" fill="#9CA3AF"/>
                  <rect x="20" y="14" width="18" height="10" rx="2" fill="#BFDBFE" opacity="0.8"/>
                  <rect x="50" y="14" width="18" height="10" rx="2" fill="#BFDBFE" opacity="0.8"/>
                </svg>
                <div style={{ fontWeight:600, fontSize:14, color:'#374151', marginBottom:4 }}>No vehicle assigned.</div>
                <div style={{ fontSize:12, color:'#9CA3AF' }}>Your station will assign a vehicle for today</div>
              </Card>
            )}

            {/* Handover log — timeline */}
            {handovers.length > 0 && (
              <div>
                <div style={{ fontWeight:700, fontSize:16, color:'#111', marginBottom:14 }}>Handover Log</div>
                <Card style={{ padding:'16px 14px' }}>
                  {handovers.map((h, i) => {
                    const isLast = i === handovers.length - 1
                    const isReceived = h.type === 'received'
                    const dateStr = new Date(h.submitted_at).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})
                    const actionLabel = isReceived
                      ? `Received from ${h.emp_name || 'Station'}`
                      : `Handed Over to ${h.emp_name || 'Station'}`
                    return (
                      <div key={h.id} style={{ display:'flex', gap:12 }}>
                        {/* Timeline indicator */}
                        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:36, flexShrink:0 }}>
                          <div style={{ width:36, height:36, borderRadius:'50%', background:'#EFF6FF', border:'2px solid #BFDBFE', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, zIndex:1 }}>
                            <Car size={15} color="#2563EB"/>
                          </div>
                          {!isLast && <div style={{ width:2, flex:1, background:'#E5E7EB', minHeight:20, marginTop:2 }}/>}
                        </div>
                        {/* Content */}
                        <div style={{ paddingBottom: isLast ? 0 : 18, flex:1, minWidth:0 }}>
                          <div style={{ fontSize:12, color:'#9CA3AF', marginBottom:2 }}>{dateStr}</div>
                          <div style={{ fontWeight:700, fontSize:14, color:'#111', marginBottom: h.condition_note ? 3 : 0 }}>{actionLabel}</div>
                          {h.condition_note && <div style={{ fontSize:12, color:'#6B7280' }}>Condition: {h.condition_note}</div>}
                          {h.fuel_level && !h.condition_note && <div style={{ fontSize:12, color:'#6B7280' }}>Fuel: {{ empty:'Empty', quarter:'1/4', half:'1/2', three_quarter:'3/4', full:'Full' }[h.fuel_level] || h.fuel_level}</div>}
                        </div>
                      </div>
                    )
                  })}
                </Card>
              </div>
            )}

            {/* Assignment history */}
            {asgHistory.length > 0 && (
              <div>
                <div style={{ fontWeight:700, fontSize:16, color:'#111', marginBottom:10 }}>Assignment History</div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {asgHistory.map(a => (
                    <div key={a.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', borderRadius:14, background:'#FFF', border:'1px solid #EBEBEB' }}>
                      <div style={{ width:36, height:36, borderRadius:10, background:'#EFF6FF', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <Car size={16} color="#2563EB"/>
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:700, fontSize:13, color:'#111' }}>{a.plate}</div>
                        <div style={{ fontSize:11, color:'#9CA3AF', marginTop:1 }}>{[a.make,a.model].filter(Boolean).join(' ')}</div>
                      </div>
                      <div style={{ textAlign:'right', flexShrink:0 }}>
                        <div style={{ fontSize:12, fontWeight:600, color:'#374151' }}>{a.date?.slice(0,10)}</div>
                        <div style={{ fontSize:10, color:'#2563EB', marginTop:1 }}>{a.station_code}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════ INSURANCE ════ */}
        {tab === 'insurance' && (
          <div style={{ padding:'16px' }}>
            <InsuranceTab profile={profile}/>
          </div>
        )}

        {/* ════ NOTICES ════ */}
        {tab === 'notices' && (
          <div style={{ padding:'16px', display:'flex', flexDirection:'column', gap:14 }} className="fade">
            <h2 style={{ fontWeight:800, fontSize:22, color:'#111', margin:0 }}>Notices</h2>
            {notices.length === 0 ? (
              <Card style={{ textAlign:'center', padding:'40px' }}>
                <Bell size={32} color="#D1D5DB" style={{ margin:'0 auto 10px', display:'block' }}/>
                <div style={{ fontSize:14, color:'#9CA3AF' }}>No notices from your station</div>
              </Card>
            ) : notices.map(n => (
              <Card key={n.id}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                  <span style={{ fontWeight:700, fontSize:14, color:'#111' }}>{n.title}</span>
                  <span style={{ fontSize:11, color:'#9CA3AF', flexShrink:0, marginLeft:8 }}>{n.created_at?.slice(0,10)}</span>
                </div>
                <div style={{ fontSize:13, color:'#6B7280', lineHeight:1.6 }}>{n.message}</div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ── BOTTOM NAV ── */}
      <nav style={{ position:'fixed', bottom:0, left:0, right:0, background:'#FFF', borderTop:'1px solid #F0F0EE', display:'flex', zIndex:100, boxShadow:'0 -4px 16px rgba(0,0,0,0.06)', paddingBottom:'env(safe-area-inset-bottom,0px)' }}>
        {TABS.map(t => {
          const Icon   = t.icon
          const active = tab === t.id
          const isNotices = t.id === 'notices'
          return (
            <button key={t.id} onClick={isNotices ? openNotices : () => setTab(t.id)}
              style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'9px 1px 10px', border:'none', background:'none', cursor:'pointer', fontFamily:'Poppins,sans-serif', minWidth:0, position:'relative' }}>
              {active && <div style={{ position:'absolute', top:0, left:'50%', transform:'translateX(-50%)', width:24, height:3, background:'#111', borderRadius:'0 0 4px 4px' }}/>}
              <span style={{ position:'relative' }}>
                <Icon size={19} color={active ? '#111' : '#9CA3AF'} strokeWidth={active ? 2.5 : 1.8}/>
                {isNotices && unreadCount > 0 && (
                  <span style={{ position:'absolute', top:-4, right:-5, minWidth:14, height:14, borderRadius:7, background:'#EF4444', color:'#FFF', fontSize:8, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 3px', lineHeight:1 }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </span>
              <span className="dp-nav-label" style={{ fontWeight: active ? 700 : 500, color: active ? '#111' : '#9CA3AF', marginTop:3, fontSize:9.5, lineHeight:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'100%', padding:'0 1px' }}>
                {t.label}
              </span>
            </button>
          )
        })}
      </nav>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)}/>}
      {leaveModal && <LeaveModal empId={user.emp_id} onClose={()=>setLeaveModal(false)} onSave={handleLeaveSave}/>}
      {hvModal && (
        <HandoverModal
          modal={{ type:hvModal, vehicle:hvModal==='returned'?(vehicle || effectiveTodayAsgn):null }}
          user={user} onClose={()=>setHvModal(null)} onSave={handleHandoverSave}/>
      )}
      {completingHandover && (
        <CompleteHandoverSheet
          handover={completingHandover}
          onClose={()=>setCompletingHandover(null)}
          onDone={handleCompleteDone}/>
      )}
    </div>
  )
}
