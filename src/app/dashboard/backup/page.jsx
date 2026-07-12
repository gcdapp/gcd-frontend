'use client'
import React, { useState, useRef } from 'react'
import {
  HardDrive, Download, RefreshCw, CheckCircle, AlertCircle,
  Database, Upload, AlertTriangle, FileJson, X, RotateCcw,
  ShieldCheck, Info
} from 'lucide-react'
import { API } from '@/lib/api'

function hdr() { return { Authorization: `Bearer ${localStorage.getItem('gcd_token')}` } }

function fmt(n) { return Number(n || 0).toLocaleString() }

function SectionTitle({ icon: Icon, title, subtitle, color = '#B8860B' }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:18 }}>
      <div style={{ width:40, height:40, borderRadius:12, background:`${color}15`, border:`1.5px solid ${color}30`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        <Icon size={18} color={color}/>
      </div>
      <div>
        <div style={{ fontWeight:800, fontSize:15, color:'#1A1612', lineHeight:1 }}>{title}</div>
        {subtitle && <div style={{ fontSize:11.5, color:'#A89880', marginTop:3 }}>{subtitle}</div>}
      </div>
    </div>
  )
}

function StatusBanner({ status }) {
  if (!status) return null
  const ok = status.ok
  return (
    <div style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'12px 16px', borderRadius:12, background:ok?'#ECFDF5':'#FEF2F2', border:`1px solid ${ok?'#A7F3D0':'#FCA5A5'}`, marginBottom:16 }}>
      {ok
        ? <CheckCircle size={17} color="#16A34A" style={{ flexShrink:0, marginTop:1 }}/>
        : <AlertCircle size={17} color="#C0392B" style={{ flexShrink:0, marginTop:1 }}/>}
      <span style={{ fontSize:13, fontWeight:600, color:ok?'#16A34A':'#C0392B', lineHeight:1.5 }}>{status.msg}</span>
    </div>
  )
}

// ── Download section ──────────────────────────────────────────────
function DownloadCard() {
  const [loading, setLoading] = useState(false)
  const [status,  setStatus]  = useState(null)

  async function runBackup() {
    setLoading(true); setStatus(null)
    try {
      const res = await fetch(`${API}/api/backup/download`, { headers: hdr() })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Backup failed')
      }
      const blob     = await res.blob()
      const filename = `gcd_backup_${new Date().toISOString().slice(0,10)}.json`
      const url      = URL.createObjectURL(blob)
      const a        = document.createElement('a')
      a.href = url; a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setStatus({ ok: true, msg: `Downloaded: ${filename}` })
    } catch(e) {
      setStatus({ ok: false, msg: e.message || 'Server unreachable' })
    } finally { setLoading(false) }
  }

  return (
    <div className="card" style={{ padding:'24px' }}>
      <SectionTitle icon={Download} title="Download Backup" subtitle="Full JSON snapshot of all operational data"/>

      <StatusBanner status={status}/>

      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px', borderRadius:12, background:'#FAFAF8', border:'1px solid #F0EDE6', marginBottom:20 }}>
        <HardDrive size={20} color="#B8860B"/>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13, fontWeight:600, color:'#1A1612' }}>What gets backed up</div>
          <div style={{ fontSize:11.5, color:'#A89880', marginTop:2 }}>
            Everything — Employees · Payroll · Petty Cash · Vehicles · SIMs · Handovers · Inspections · Customers · Tasks · Documents · Compliance, and 30+ other tables. Only login sessions (which regenerate automatically) are excluded.
          </div>
        </div>
      </div>

      <button onClick={runBackup} disabled={loading}
        style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'11px 24px', borderRadius:24, background:loading?'#C4A882':'linear-gradient(135deg,#B8860B,#D4A017)', color:'#FFF', fontWeight:700, fontSize:13.5, border:'none', cursor:loading?'not-allowed':'pointer', fontFamily:'Poppins,sans-serif', boxShadow:loading?'none':'0 4px 16px rgba(184,134,11,0.3)', transition:'all 0.2s' }}>
        {loading
          ? <><RefreshCw size={15} style={{ animation:'spin 1s linear infinite' }}/> Creating backup…</>
          : <><Download size={15}/> Download Backup</>}
      </button>
    </div>
  )
}

// ── Restore section ───────────────────────────────────────────────
function RestoreCard() {
  const [file,        setFile]        = useState(null)
  const [uploading,   setUploading]   = useState(false)
  const [status,      setStatus]      = useState(null)
  const [confirming,  setConfirming]  = useState(false)
  const [result,      setResult]      = useState(null)
  const fileRef = useRef()

  function onFileChange(e) {
    const f = e.target.files?.[0]
    setFile(f || null)
    setStatus(null)
    setResult(null)
    setConfirming(false)
  }

  function clearFile() {
    setFile(null)
    setStatus(null)
    setResult(null)
    setConfirming(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function doRestore() {
    if (!file) return
    setUploading(true)
    setStatus(null)
    setResult(null)
    setConfirming(false)

    const form = new FormData()
    form.append('backup', file)

    try {
      const res  = await fetch(`${API}/api/backup/restore`, { method:'POST', headers: hdr(), body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Restore failed')
      setResult(data)
      setStatus({ ok: true, msg: `Restore complete — ${fmt(data.totalRows)} rows across ${data.tablesRestored} tables` })
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
    } catch(e) {
      setStatus({ ok: false, msg: e.message || 'Server unreachable' })
    } finally {
      setUploading(false)
    }
  }

  const fileSizeLabel = file
    ? file.size > 1024*1024
      ? `${(file.size/1024/1024).toFixed(1)} MB`
      : `${(file.size/1024).toFixed(0)} KB`
    : ''

  return (
    <div className="card" style={{ padding:'24px' }}>
      <SectionTitle icon={RotateCcw} title="Restore from Backup" subtitle="Upload a .json backup file to restore all data" color="#C0392B"/>

      {/* Warning banner */}
      <div style={{ display:'flex', gap:10, padding:'12px 14px', borderRadius:12, background:'#FFFBEB', border:'1px solid #FDE68A', marginBottom:20 }}>
        <AlertTriangle size={16} color="#D97706" style={{ flexShrink:0, marginTop:1 }}/>
        <div style={{ fontSize:12, color:'#92400E', lineHeight:1.6 }}>
          <strong>This will overwrite virtually all existing data</strong> — employees, payroll, petty cash, vehicles, customers, and every other backed-up table. This action cannot be undone. Make sure you have a fresh backup before proceeding.
        </div>
      </div>

      <StatusBanner status={status}/>

      {/* Result table */}
      {result?.summary && (
        <div style={{ marginBottom:20, borderRadius:12, border:'1px solid #E8E3DC', overflow:'hidden' }}>
          <div style={{ padding:'10px 14px', background:'#F9F7F4', borderBottom:'1px solid #E8E3DC', fontSize:12, fontWeight:700, color:'#6B5D4A' }}>
            Tables Restored
          </div>
          <div style={{ maxHeight:220, overflowY:'auto' }}>
            {Object.entries(result.summary).map(([tbl, rows]) => (
              <div key={tbl} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 14px', borderBottom:'1px solid #F5F2EE', fontSize:12 }}>
                <span style={{ color:'#374151', fontFamily:'monospace' }}>{tbl}</span>
                <span style={{ fontWeight:700, color: rows > 0 ? '#2E7D52' : '#9CA3AF' }}>
                  {fmt(rows)} row{rows !== 1 ? 's' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* File picker */}
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        style={{ display:'none' }}
        onChange={onFileChange}
      />

      {!file ? (
        <button
          onClick={() => fileRef.current?.click()}
          style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, width:'100%', padding:'32px 20px', borderRadius:14, border:'2px dashed #D9B96E', background:'#FFFDF5', cursor:'pointer', fontFamily:'Poppins,sans-serif', transition:'all 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.background='#FFF8E7'; e.currentTarget.style.borderColor='#B8860B' }}
          onMouseLeave={e => { e.currentTarget.style.background='#FFFDF5'; e.currentTarget.style.borderColor='#D9B96E' }}>
          <FileJson size={28} color="#B8860B"/>
          <div style={{ textAlign:'left' }}>
            <div style={{ fontWeight:700, fontSize:13.5, color:'#1A1612' }}>Choose backup file</div>
            <div style={{ fontSize:11.5, color:'#A89880', marginTop:2 }}>Select a .json backup exported from this system</div>
          </div>
        </button>
      ) : (
        <div>
          {/* Selected file preview */}
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', borderRadius:12, background:'#F9F7F4', border:'1px solid #E8E3DC', marginBottom:14 }}>
            <FileJson size={20} color="#B8860B" style={{ flexShrink:0 }}/>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#1A1612', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{file.name}</div>
              <div style={{ fontSize:11, color:'#A89880', marginTop:1 }}>{fileSizeLabel}</div>
            </div>
            <button onClick={clearFile} style={{ background:'none', border:'none', cursor:'pointer', color:'#9CA3AF', padding:4, display:'flex' }}>
              <X size={16}/>
            </button>
          </div>

          {/* Confirm step */}
          {!confirming ? (
            <button onClick={() => setConfirming(true)} disabled={uploading}
              style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, width:'100%', padding:'12px', borderRadius:12, background:'linear-gradient(135deg,#C0392B,#E74C3C)', color:'#FFF', fontWeight:700, fontSize:13.5, border:'none', cursor:'pointer', fontFamily:'Poppins,sans-serif', boxShadow:'0 4px 16px rgba(192,57,43,0.3)' }}>
              <Upload size={15}/> Restore from this file
            </button>
          ) : (
            <div style={{ borderRadius:12, border:'2px solid #FCA5A5', background:'#FEF2F2', padding:'16px' }}>
              <div style={{ display:'flex', gap:8, alignItems:'flex-start', marginBottom:14 }}>
                <AlertCircle size={16} color="#C0392B" style={{ flexShrink:0, marginTop:1 }}/>
                <div style={{ fontSize:12.5, color:'#7F1D1D', lineHeight:1.5 }}>
                  <strong>Are you sure?</strong> This will permanently overwrite the current database with the backup data. All users will be logged out after the restore.
                </div>
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={() => setConfirming(false)} disabled={uploading}
                  style={{ flex:1, padding:'10px', borderRadius:10, background:'#F3F4F6', border:'none', cursor:'pointer', fontWeight:600, fontSize:13, fontFamily:'Poppins,sans-serif', color:'#374151' }}>
                  Cancel
                </button>
                <button onClick={doRestore} disabled={uploading}
                  style={{ flex:2, display:'flex', alignItems:'center', justifyContent:'center', gap:7, padding:'10px', borderRadius:10, background: uploading ? '#9CA3AF' : '#C0392B', color:'#FFF', border:'none', cursor: uploading ? 'not-allowed' : 'pointer', fontWeight:700, fontSize:13, fontFamily:'Poppins,sans-serif' }}>
                  {uploading
                    ? <><RefreshCw size={14} style={{ animation:'spin 1s linear infinite' }}/> Restoring…</>
                    : <><ShieldCheck size={14}/> Yes, restore now</>}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info note */}
      <div style={{ display:'flex', gap:8, marginTop:16, padding:'10px 12px', borderRadius:10, background:'#F0F4FF', border:'1px solid #C7D2FE' }}>
        <Info size={13} color="#4F46E5" style={{ flexShrink:0, marginTop:1 }}/>
        <p style={{ fontSize:11, color:'#3730A3', margin:0, lineHeight:1.6 }}>
          Only login sessions are excluded from both backup and restore — they're tied to specific sign-ins and regenerate automatically next time someone logs in. Every other table is replaced.
        </p>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────
export default function BackupPage() {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20, animation:'slideUp 0.35s ease' }}>
      <div>
        <h1 style={{ fontWeight:900, fontSize:22, color:'#1A1612', letterSpacing:'-0.03em', margin:0 }}>Backup & Restore</h1>
        <p style={{ fontSize:12, color:'#A89880', marginTop:4 }}>Download a full database snapshot or restore from a previous backup</p>
      </div>

      <DownloadCard/>
      <RestoreCard/>
    </div>
  )
}
