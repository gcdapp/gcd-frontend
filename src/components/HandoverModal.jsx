'use client'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, Camera, Check, Car, Fuel, FileText, User, Users, Wrench, ArrowLeftRight } from 'lucide-react'

import { API } from '@/lib/api'

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
        if (byteSize <= maxBytes || q <= 0.15) {
          return resolve(dataUrlToFile(dataUrl, name))
        }
      }
      resolve(dataUrlToFile(canvas.toDataURL('image/jpeg', 0.15), name))
    }
    img.onerror = () => { URL.revokeObjectURL(src); resolve(file) }
    img.src = src
  })
}

const FUEL_LEVELS = [
  { v:'empty',         l:'Empty', pct:0   },
  { v:'quarter',       l:'1/4',   pct:25  },
  { v:'half',          l:'1/2',   pct:50  },
  { v:'three_quarter', l:'3/4',   pct:75  },
  { v:'full',          l:'Full',  pct:100 },
]

function PhotoSlot({ index, file, onSelect, onRemove }) {
  const ref = useRef(null)
  const url = file ? URL.createObjectURL(file) : null

  return (
    <div style={{ position:'relative', aspectRatio:'1', borderRadius:12, overflow:'hidden', border:`2px dashed ${file?'#B8860B':'#EAE6DE'}`, background:file?'#000':'#FAFAF8', cursor:'pointer' }}
      onClick={()=>!file && ref.current?.click()}>
      <input ref={ref} type="file" accept="image/*" capture="environment" style={{ display:'none' }}
        onChange={e=>{ if(e.target.files[0]) onSelect(index, e.target.files[0]) }}/>
      {file ? (
        <>
          <img src={url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
          <button onClick={e=>{ e.stopPropagation(); onRemove(index) }}
            style={{ position:'absolute', top:4, right:4, width:22, height:22, borderRadius:'50%', background:'rgba(0,0,0,0.7)', border:'none', color:'white', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13 }}>×</button>
        </>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:4 }}>
          <Camera size={22} color="#C4B49A"/>
          <span style={{ fontSize:10, color:'#C4B49A', fontWeight:600 }}>{['Front','Back','Left','Right'][index]}</span>
        </div>
      )}
    </div>
  )
}

export default function HandoverModal({ modal, user, onClose, onSave }) {
  const { type, vehicle } = modal
  const isReturn = type === 'returned'

  // For return flow: user picks between handover-to-driver or park-for-maintenance
  const [returnMode, setReturnMode] = useState(isReturn ? null : 'receive')

  const [vehicles,        setVehicles]        = useState([])
  const [drivers,         setDrivers]         = useState([])
  const [vehicleId,       setVehicleId]       = useState(vehicle?.vehicle_id || '')
  const [receiverEmpId,   setReceiverEmpId]   = useState('')
  const [parkingLocation, setParkingLocation] = useState('')
  const [photos,          setPhotos]          = useState([null, null, null, null])
  const [fuel,            setFuel]            = useState('half')
  const [odometer,        setOdometer]        = useState('')
  const [note,            setNote]            = useState('')
  const [handoverPerson,  setHandoverPerson]  = useState('')
  const [saving,          setSaving]          = useState(false)
  const [err,             setErr]             = useState(null)
  const [done,            setDone]            = useState(false)
  const [photoWarn,       setPhotoWarn]       = useState(null)

  const h = { Authorization:`Bearer ${localStorage.getItem('gcd_token')}` }

  useEffect(() => {
    const sc    = user?.station_code
    const today = new Date().toISOString().slice(0, 10)

    if (!isReturn) {
      Promise.all([
        fetch(`${API}/api/vehicles${sc?`?station_code=${sc}`:''}`, { headers:h }).then(r=>r.json()),
        fetch(`${API}/api/handovers/current${sc?`?station_code=${sc}`:''}`, { headers:h }).then(r=>r.ok?r.json():{current:[]}),
        fetch(`${API}/api/vehicles/assignments?date=${today}${sc?`&station_code=${sc}`:''}`, { headers:h }).then(r=>r.ok?r.json():{assignments:[]}),
      ]).then(([vData, hData, aData]) => {
        const handoverBusy = new Set((hData.current||[]).map(h=>String(h.vehicle_id)))
        const pocBusy = new Set(
          (aData.assignments||[])
            .filter(a => a.emp_id && String(a.emp_id) !== String(user?.emp_id))
            .map(a => String(a.vehicle_id))
        )
        setVehicles((vData.vehicles||[]).filter(v =>
          v.status==='active' && !handoverBusy.has(String(v.id)) && !pocBusy.has(String(v.id))
        ))
      }).catch(()=>{})
    }

    if (isReturn) {
      const today = new Date().toISOString().slice(0, 10)
      Promise.all([
        fetch(`${API}/api/employees/for-handover`, { headers:h }).then(r=>r.json()),
        fetch(`${API}/api/handovers/current`, { headers:h }).then(r=>r.ok?r.json():{current:[]}),
        fetch(`${API}/api/vehicles/assignments?date=${today}`, { headers:h }).then(r=>r.ok?r.json():{assignments:[]}),
      ]).then(([empData, hvData, aData]) => {
        const all = (empData.employees || []).filter(Boolean)
        // Drivers who currently hold a vehicle via accepted handover
        const hvDriverIds = new Set((hvData.current||[]).map(h => String(h.receiver_emp_id)).filter(Boolean))
        // Drivers with an admin vehicle assignment today
        const asgnDriverIds = new Set((aData.assignments||[]).filter(a=>a.emp_id).map(a => String(a.emp_id)))
        setDrivers(all.filter(e =>
          String(e.id) !== String(user?.emp_id) &&
          e.station_code === user?.station_code &&
          !hvDriverIds.has(String(e.id)) &&
          !asgnDriverIds.has(String(e.id))
        ))
      }).catch(()=>{})
    }
  }, [isReturn, user])

  function setPhoto(i, file) { setPhotos(p => { const n=[...p]; n[i]=file; return n }) }
  function removePhoto(i)    { setPhotos(p => { const n=[...p]; n[i]=null; return n }) }

  async function handleSubmit() {
    const isMaintenance = returnMode === 'maintenance'

    if (!isReturn && !vehicleId)     return setErr('Please select a vehicle')
    if (returnMode === 'handover' && !receiverEmpId) return setErr('Please select the receiving driver')
    if (isMaintenance && !parkingLocation.trim())    return setErr('Please enter the parking location')

    const needsPhotos = !isReturn || isMaintenance
    if (needsPhotos && photos.filter(Boolean).length < 4)
      return setErr('All 4 photos are required (front, back, left side, right side)')

    if (!odometer || isNaN(Number(odometer)) || Number(odometer) <= 0)
      return setErr('Odometer reading is required')
    if (returnMode === 'handover' && !handoverPerson.trim())
      return setErr('Please enter a handover reference (e.g. your name / note)')

    setSaving(true); setErr(null)

    try {
      const fd = new FormData()
      const submitType = isMaintenance ? 'maintenance' : type
      fd.append('vehicle_id', isReturn ? vehicle.vehicle_id : vehicleId)
      fd.append('type', submitType)
      fd.append('fuel_level', fuel)
      fd.append('condition_note', note)
      if (odometer) fd.append('odometer', odometer)

      if (isMaintenance) {
        fd.append('handover_to', parkingLocation)
        const compressed = await Promise.all(photos.filter(Boolean).map(f => compressImage(f)))
        compressed.forEach(f => fd.append('photos', f))
      } else if (isReturn) {
        fd.append('receiver_emp_id', receiverEmpId)
        if (handoverPerson) fd.append('handover_from', handoverPerson)
      } else {
        if (handoverPerson) fd.append('handover_from', handoverPerson)
        const compressed = await Promise.all(photos.filter(Boolean).map(f => compressImage(f)))
        compressed.forEach(f => fd.append('photos', f))
      }

      const res = await fetch(`${API}/api/handovers`, {
        method: 'POST',
        headers: { Authorization:`Bearer ${localStorage.getItem('gcd_token')}` },
        body: fd
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (data.photos_warning) setPhotoWarn(data.photos_warning)
      setDone(true)
      setTimeout(() => { onSave() }, photoWarn ? 3000 : 1500)
    } catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  const isMaintenance = returnMode === 'maintenance'

  if (done) return createPortal(
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth:340, textAlign:'center', padding:'40px 30px' }}>
        <div style={{ width:64, height:64, borderRadius:'50%', background: isMaintenance ? '#FFF7ED' : '#ECFDF5', border:`2px solid ${isMaintenance ? '#FDE68A' : '#A7F3D0'}`, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
          {isMaintenance ? <Wrench size={30} color="#B45309"/> : <Check size={30} color="#2E7D52"/>}
        </div>
        <div style={{ fontWeight:800, fontSize:18, color:'#1A1612', marginBottom:8 }}>
          {isMaintenance ? 'Parked for Maintenance!' : isReturn ? 'Return Submitted!' : 'Handover Recorded!'}
        </div>
        <div style={{ fontSize:13, color:'#A89880' }}>
          {isMaintenance
            ? `Vehicle parked at ${parkingLocation}. Status updated to maintenance.`
            : isReturn
              ? 'The receiving driver will be notified to accept and complete the handover.'
              : 'Record saved successfully.'}
        </div>
        {photoWarn && (
          <div style={{ marginTop:14, background:'#FEF3C7', border:'1px solid #FDE68A', borderRadius:8, padding:'8px 12px', fontSize:11.5, color:'#92400E' }}>
            ⚠️ {photoWarn}
          </div>
        )}
      </div>
    </div>,
    document.body
  )

  // Mode picker — shown first when returning a vehicle
  if (isReturn && returnMode === null) return createPortal(
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ maxWidth:440, padding:0, overflow:'hidden' }}>
        <div style={{ padding:'20px 22px 16px', background:'linear-gradient(135deg,#FEF2F2,#FFF9F9)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <h3 style={{ fontWeight:900, fontSize:17, color:'#1A1612' }}>Return Vehicle</h3>
              <p style={{ fontSize:12, color:'#A89880', marginTop:3 }}>
                {vehicle?.vehicle_plate || vehicle?.plate} — What would you like to do?
              </p>
            </div>
            <button onClick={onClose} style={{ width:30, height:30, borderRadius:'50%', background:'rgba(0,0,0,0.06)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><X size={14}/></button>
          </div>
        </div>
        <div style={{ padding:'20px 22px 24px', display:'flex', flexDirection:'column', gap:12 }}>
          <button onClick={() => setReturnMode('handover')}
            style={{ display:'flex', alignItems:'center', gap:16, padding:'18px 20px', borderRadius:16, border:'2px solid #B8860B', background:'#FFFBEB', cursor:'pointer', textAlign:'left', width:'100%', fontFamily:'inherit', transition:'all 0.15s' }}>
            <div style={{ width:48, height:48, borderRadius:14, background:'#FEF3C7', border:'1px solid #FDE68A', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <ArrowLeftRight size={22} color="#B8860B"/>
            </div>
            <div>
              <div style={{ fontWeight:800, fontSize:14, color:'#92400E' }}>Handover to Another Driver</div>
              <div style={{ fontSize:12, color:'#A89880', marginTop:3 }}>No photos needed — the receiving driver takes them</div>
            </div>
          </button>

          <button onClick={() => setReturnMode('maintenance')}
            style={{ display:'flex', alignItems:'center', gap:16, padding:'18px 20px', borderRadius:16, border:'2px solid #9CA3AF', background:'#F9FAFB', cursor:'pointer', textAlign:'left', width:'100%', fontFamily:'inherit', transition:'all 0.15s' }}>
            <div style={{ width:48, height:48, borderRadius:14, background:'#F3F4F6', border:'1px solid #E5E7EB', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Wrench size={22} color="#6B7280"/>
            </div>
            <div>
              <div style={{ fontWeight:800, fontSize:14, color:'#374151' }}>Park for Maintenance</div>
              <div style={{ fontSize:12, color:'#A89880', marginTop:3 }}>4 photos required — specify where you are parking it</div>
            </div>
          </button>
        </div>
      </div>
    </div>,
    document.body
  )

  const headerBg = isMaintenance
    ? 'linear-gradient(135deg,#F3F4F6,#F9FAFB)'
    : isReturn
      ? 'linear-gradient(135deg,#FEF2F2,#FFF9F9)'
      : 'linear-gradient(135deg,#ECFDF5,#F0FFF8)'

  const headerTitle = isMaintenance
    ? '🔧 Park for Maintenance'
    : isReturn
      ? '🔑 Handover to Driver'
      : '🚗 Receive Vehicle'

  const headerSub = isMaintenance
    ? `Parking ${vehicle?.vehicle_plate || vehicle?.plate} — 4 photos required`
    : isReturn
      ? `Returning ${vehicle?.vehicle_plate || vehicle?.plate} — photos taken by receiving driver`
      : 'Document the vehicle you received'

  const submitBg = isMaintenance
    ? 'linear-gradient(135deg,#4B5563,#6B7280)'
    : isReturn
      ? 'linear-gradient(135deg,#C0392B,#E74C3C)'
      : 'linear-gradient(135deg,#2E7D52,#22C55E)'

  const submitLabel = isMaintenance ? 'Park for Maintenance' : isReturn ? 'Submit Return' : 'Submit Handover'

  return createPortal(
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ maxWidth:480, padding:0, overflow:'hidden' }}>
        {/* Header */}
        <div style={{ padding:'20px 22px 16px', background:headerBg }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <h3 style={{ fontWeight:900, fontSize:17, color:'#1A1612' }}>{headerTitle}</h3>
              <p style={{ fontSize:12, color:'#A89880', marginTop:3 }}>{headerSub}</p>
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              {isReturn && (
                <button onClick={() => { setReturnMode(null); setErr(null) }}
                  style={{ fontSize:11, color:'#B8860B', background:'#FEF3C7', border:'1px solid #FDE68A', borderRadius:8, padding:'4px 10px', cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>
                  ← Back
                </button>
              )}
              <button onClick={onClose} style={{ width:30, height:30, borderRadius:'50%', background:'rgba(0,0,0,0.06)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><X size={14}/></button>
            </div>
          </div>
        </div>

        <div style={{ padding:'16px 22px 20px', display:'flex', flexDirection:'column', gap:16, maxHeight:'65vh', overflowY:'auto' }}>
          {err && <div style={{ background:'#FEF2F2', border:'1px solid #FCA5A5', borderRadius:9, padding:'10px 14px', fontSize:12.5, color:'#C0392B' }}>{err}</div>}

          {/* Receive: vehicle selector */}
          {!isReturn && (
            <div>
              <label className="input-label" style={{ display:'flex', alignItems:'center', gap:6 }}><Car size={12}/> Select Vehicle *</label>
              <select className="input" value={vehicleId} onChange={e=>setVehicleId(e.target.value)}>
                <option value="">— Choose vehicle —</option>
                {vehicles.map(v=>(
                  <option key={v.id} value={v.id}>{v.plate} {v.make} {v.model}</option>
                ))}
              </select>
            </div>
          )}

          {/* Handover to driver: receiving driver selector */}
          {returnMode === 'handover' && (
            <div>
              <label className="input-label" style={{ display:'flex', alignItems:'center', gap:6 }}><Users size={12}/> Handing Over To (Driver) *</label>
              <select className="input" value={receiverEmpId} onChange={e=>setReceiverEmpId(e.target.value)}>
                <option value="">— Select receiving driver —</option>
                {drivers.map(d=>(
                  <option key={d.id} value={d.id}>{d.name} {d.station_code ? `· ${d.station_code}` : ''}</option>
                ))}
              </select>
              <p style={{ fontSize:11, color:'#A89880', marginTop:5 }}>
                The selected driver will upload the vehicle photos after accepting.
              </p>
            </div>
          )}

          {/* Maintenance: parking location */}
          {isMaintenance && (
            <div>
              <label className="input-label" style={{ display:'flex', alignItems:'center', gap:6 }}><Wrench size={12}/> Parking Location *</label>
              <input className="input" value={parkingLocation} onChange={e=>setParkingLocation(e.target.value)}
                placeholder="e.g. DDB1 yard, Gate 3, Parking Bay 5…" autoComplete="off"/>
              <p style={{ fontSize:11, color:'#A89880', marginTop:5 }}>
                Specify exactly where you are leaving the vehicle so it can be located for maintenance.
              </p>
            </div>
          )}

          {/* Photos — required for receive and maintenance */}
          {(returnMode === 'receive' || isMaintenance) && (
            <div>
              <label className="input-label" style={{ display:'flex', alignItems:'center', gap:6 }}><Camera size={12}/> Vehicle Photos <span style={{color:'#E53E3E'}}>*</span></label>
              <p style={{ fontSize:11, color:'#A89880', marginBottom:10 }}>All 4 photos required — front, back, left side, right side</p>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
                {photos.map((f,i) => (
                  <PhotoSlot key={i} index={i} file={f} onSelect={setPhoto} onRemove={removePhoto}/>
                ))}
              </div>
            </div>
          )}

          {/* Handover to driver: no-photos banner */}
          {returnMode === 'handover' && (
            <div style={{ background:'#FFF7ED', border:'1px solid #FED7AA', borderRadius:9, padding:'10px 13px', fontSize:12, color:'#92400E', display:'flex', gap:8 }}>
              <span style={{ fontSize:16, flexShrink:0 }}>📷</span>
              <span>You do not upload photos when handing over to a driver. The receiving driver will take the photos after accepting.</span>
            </div>
          )}

          {/* Fuel level */}
          <div>
            <label className="input-label" style={{ display:'flex', alignItems:'center', gap:6 }}><Fuel size={12}/> Fuel Level</label>
            <div style={{ display:'flex', gap:6 }}>
              {FUEL_LEVELS.map(f=>(
                <button key={f.v} onClick={()=>setFuel(f.v)} type="button"
                  style={{ flex:1, padding:'8px 4px', borderRadius:10, border:`2px solid ${fuel===f.v?'#B8860B':'#EAE6DE'}`, background:fuel===f.v?'#FDF6E3':'#FAFAF8', cursor:'pointer', textAlign:'center', transition:'all 0.18s', fontFamily:'Poppins,sans-serif' }}>
                  <div style={{ fontSize:10.5, fontWeight:700, color:fuel===f.v?'#B8860B':'#A89880' }}>{f.l}</div>
                </button>
              ))}
            </div>
            <div style={{ marginTop:8, height:8, background:'#F0EDE6', borderRadius:10, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${FUEL_LEVELS.find(f=>f.v===fuel)?.pct||0}%`, background:'linear-gradient(90deg,#B8860B,#D4A017)', borderRadius:10, transition:'width 0.4s ease' }}/>
            </div>
          </div>

          {/* Odometer */}
          <div>
            <label className="input-label">Odometer Reading (km) <span style={{color:'#E53E3E'}}>*</span></label>
            <input className="input" type="number" value={odometer} onChange={e=>setOdometer(e.target.value)} placeholder="e.g. 45230"/>
          </div>

          {/* Handover reference — only for handover-to-driver and receive flows */}
          {returnMode !== 'maintenance' && (
            <div>
              <label className="input-label" style={{ display:'flex', alignItems:'center', gap:6 }}>
                <User size={12}/> {isReturn ? 'Your Name / Reference' : 'Received From'}
                {isReturn && <span style={{ fontSize:10, color:'#A89880', fontWeight:400 }}>(optional)</span>}
                {!isReturn && <span style={{color:'#E53E3E'}}>*</span>}
              </label>
              <input className="input" value={handoverPerson} onChange={e=>setHandoverPerson(e.target.value)}
                placeholder={isReturn ? 'Your name or note' : 'POC name / station'}/>
            </div>
          )}

          {/* Condition note */}
          <div>
            <label className="input-label" style={{ display:'flex', alignItems:'center', gap:6 }}><FileText size={12}/> Condition Notes</label>
            <textarea className="input" rows={3} value={note} onChange={e=>setNote(e.target.value)} placeholder="Any damage, issues, or notes about the vehicle condition…" style={{ resize:'vertical' }}/>
          </div>
        </div>

        <div style={{ padding:'14px 22px 20px', borderTop:'1px solid #EAE6DE', display:'flex', gap:10, background:'#FAFAF8' }}>
          <button onClick={onClose} className="btn btn-secondary" style={{ flex:1, justifyContent:'center' }}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            style={{ flex:2, display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'11px', borderRadius:10, background:submitBg, color:'white', fontWeight:700, fontSize:13, border:'none', cursor:'pointer', fontFamily:'Poppins,sans-serif', opacity:saving?0.7:1 }}>
            {saving
              ? <><span style={{ width:14, height:14, border:'2px solid rgba(255,255,255,0.4)', borderTopColor:'white', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/> Saving…</>
              : submitLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
