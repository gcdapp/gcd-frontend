'use client'
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/lib/auth'
import Papa from 'papaparse'
import {
  Wallet, ArrowDownLeft, ArrowUpRight,
  ChevronLeft, ChevronRight, X, Users, Trash2, Pencil,
  TrendingUp, TrendingDown, User, Search, Receipt,
  HandCoins, AlertCircle, RefreshCw, UploadCloud, Download, Check,
} from 'lucide-react'
import { API } from '@/lib/api'

const hdr = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('gcd_token') : ''}`,
})

const EXPENSE_TYPES = [
  'ADVANCES', 'AIR TICKETS', 'CASH VARIANCE', 'FINE', 'Fuel',
  'INCENTIVE', 'INCENTIVE DEDUCTIONS', 'Miscellaneous Exp.', 'Mobile Expenses',
  'OverTime', 'Parking Fee', 'RTA PARKING TOPUP', 'RTA TOPUP',
  'Salik', 'Vehicle Damage', 'Vehicle Expenses',
]

const ROLE_LABELS = {
  admin: 'Admin', general_manager: 'Manager', hr: 'HR',
  accountant: 'Accountant', poc: 'POC', manager: 'Manager',
}

function fmt(n) {
  return `AED ${Math.abs(Number(n || 0)).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function Lbl({ children }) {
  return (
    <label style={{ display:'block', fontSize:10.5, fontWeight:700, letterSpacing:'0.07em', textTransform:'uppercase', color:'var(--text-muted)', marginBottom:5 }}>
      {children}
    </label>
  )
}

/* ── Driver Picker ─────────────────────────────────────────── */
function DriverPicker({ drivers, value, onChange }) {
  const [q, setQ]       = useState('')
  const [open, setOpen] = useState(false)
  const selected = drivers.find(d => d.id === value)
  const filtered = drivers.filter(d =>
    !q || d.name.toLowerCase().includes(q.toLowerCase()) || d.id.toLowerCase().includes(q.toLowerCase())
  )
  return (
    <div style={{ position:'relative' }}>
      <div onClick={() => setOpen(o => !o)}
        style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', borderRadius:10, border:'1px solid var(--border)', background:'var(--bg-alt)', cursor:'pointer', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <User size={14} color="var(--text-muted)"/>
          <span style={{ fontSize:13, color: selected ? 'var(--text)' : 'var(--text-muted)', fontWeight: selected ? 600 : 400 }}>
            {selected ? `${selected.name} · ${selected.id}` : 'Select driver (optional)…'}
          </span>
        </div>
        <ChevronRight size={13} color="var(--text-muted)" style={{ transform: open ? 'rotate(90deg)' : 'none', transition:'transform 0.15s' }}/>
      </div>
      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0, background:'var(--card)', border:'1px solid var(--border)', borderRadius:12, boxShadow:'0 8px 24px rgba(0,0,0,0.12)', zIndex:200, overflow:'hidden' }}>
          <div style={{ padding:'8px 10px', borderBottom:'1px solid var(--border)', position:'relative' }}>
            <Search size={12} style={{ position:'absolute', left:20, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }}/>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search driver…"
              style={{ width:'100%', padding:'6px 8px 6px 28px', borderRadius:8, border:'1px solid var(--border)', fontSize:12, background:'var(--bg-alt)', color:'var(--text)', fontFamily:'Poppins,sans-serif', outline:'none' }}
              onClick={e => e.stopPropagation()} autoFocus/>
          </div>
          <div style={{ maxHeight:200, overflowY:'auto' }}>
            <div onClick={() => { onChange(''); setOpen(false); setQ('') }}
              style={{ padding:'9px 14px', cursor:'pointer', fontSize:12, color:'var(--text-muted)', fontStyle:'italic' }}
              onMouseEnter={e => e.currentTarget.style.background='var(--bg-alt)'}
              onMouseLeave={e => e.currentTarget.style.background='transparent'}>
              — No driver
            </div>
            {filtered.map(d => (
              <div key={d.id} onClick={() => { onChange(d.id); setOpen(false); setQ('') }}
                style={{ padding:'9px 14px', cursor:'pointer', display:'flex', gap:8, alignItems:'center', background: d.id === value ? '#FDF6E3' : 'transparent' }}
                onMouseEnter={e => { if (d.id !== value) e.currentTarget.style.background='var(--bg-alt)' }}
                onMouseLeave={e => { if (d.id !== value) e.currentTarget.style.background='transparent' }}>
                <div style={{ width:28, height:28, borderRadius:8, background:'linear-gradient(135deg,#B8860B,#D4A017)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800, color:'white', flexShrink:0 }}>
                  {d.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize:12.5, fontWeight:600, color:'var(--text)' }}>{d.name}</div>
                  <div style={{ fontSize:10.5, color:'var(--text-muted)' }}>{d.id} · {d.station_code||'—'}</div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding:'16px', textAlign:'center', fontSize:12, color:'var(--text-muted)' }}>No drivers found</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Expense Modal ──────────────────────────────────────────── */
function ExpenseModal({ drivers, onSave, onClose }) {
  const [form, setForm] = useState({
    expense_type:'', amount:'', note:'',
    date: new Date().toISOString().slice(0,10),
    emp_id: '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState(null)
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  async function handleSave() {
    if (!form.expense_type || !form.amount) return setErr('Expense type and amount required')
    const amt = parseFloat(form.amount)
    if (isNaN(amt) || amt <= 0) return setErr('Amount must be positive')
    setSaving(true); setErr(null)
    try {
      const res = await fetch(`${API}/api/petty-cash/expense`, {
        method:'POST', headers: hdr(),
        body: JSON.stringify({ expense_type:form.expense_type, amount:amt, note:form.note||null, date:form.date, emp_id:form.emp_id||null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onSave()
    } catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  return (
    <div style={{ position:'fixed', top:0, right:0, bottom:0, left:0, background:'rgba(0,0,0,0.55)', backdropFilter:'blur(6px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:16 }}
      onClick={onClose}>
      <div style={{ background:'var(--card)', borderRadius:20, width:'100%', maxWidth:600, maxHeight:'90vh', border:'1px solid var(--border)', overflow:'hidden', display:'flex', flexDirection:'column', animation:'slideUp 0.2s ease' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ padding:'18px 22px', borderBottom:'1px solid var(--border)', background:'#FDF6E3', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:38, height:38, borderRadius:11, background:'linear-gradient(135deg,#B8860B,#D4A017)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 3px 10px rgba(184,134,11,0.3)' }}>
              <Receipt size={17} color="white"/>
            </div>
            <div>
              <div style={{ fontWeight:800, fontSize:15, color:'#1A1612' }}>Record Expense</div>
              <div style={{ fontSize:11, color:'#A89880', marginTop:1 }}>Log a petty cash expense</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(184,134,11,0.1)', border:'1px solid #F0D78C', cursor:'pointer', color:'#B8860B', display:'flex', padding:6, borderRadius:'50%' }}><X size={16}/></button>
        </div>
        <div style={{ padding:'20px 22px', display:'flex', flexDirection:'column', gap:14, overflowY:'auto' }}>
          {err && (
            <div style={{ background:'#FEF2F2', border:'1px solid #FCA5A5', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#DC2626', display:'flex', gap:8, alignItems:'center' }}>
              <AlertCircle size={14}/> {err}
            </div>
          )}
          <div>
            <Lbl>Expense Type *</Lbl>
            <select className="input" value={form.expense_type} onChange={set('expense_type')} style={{ borderRadius:10 }}>
              <option value="">Select type…</option>
              {EXPENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <Lbl>Amount (AED) *</Lbl>
              <input className="input" type="number" min="0.01" step="0.01" value={form.amount} onChange={set('amount')} placeholder="0.00" style={{ borderRadius:10 }}/>
            </div>
            <div>
              <Lbl>Date *</Lbl>
              <input className="input" type="date" value={form.date} onChange={set('date')} style={{ borderRadius:10 }}/>
            </div>
          </div>
          <div>
            <Lbl>Driver (optional)</Lbl>
            <DriverPicker drivers={drivers} value={form.emp_id} onChange={v => setForm(p => ({ ...p, emp_id:v }))}/>
          </div>
          <div>
            <Lbl>Note (optional)</Lbl>
            <input className="input" value={form.note} onChange={set('note')} placeholder="Add a note…" style={{ borderRadius:10 }}/>
          </div>
          <button onClick={handleSave} disabled={saving}
            style={{ padding:'13px', borderRadius:12, border:'none', cursor:saving?'not-allowed':'pointer', background:saving?'var(--border)':'linear-gradient(135deg,#B8860B,#D4A017)', color:saving?'var(--text-muted)':'white', fontWeight:700, fontSize:14, fontFamily:'Poppins,sans-serif', marginTop:4, transition:'all 0.2s', boxShadow:saving?'none':'0 3px 12px rgba(184,134,11,0.35)' }}>
            {saving ? 'Saving…' : 'Record Expense'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Accepts ISO (YYYY-MM-DD) or DD/MM/YYYY (DD-MM-YYYY) — this app's locale —
// and normalizes to ISO before it ever reaches Postgres, since passing an
// ambiguous slash-separated date straight through as a raw string is what
// broke the bulk upload (one bad date crashed the whole batch).
function parseFlexibleDate(input) {
  const s = String(input || '').trim()
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (m) {
    const day = parseInt(m[1], 10), month = parseInt(m[2], 10), year = m[3]
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    }
  }
  return null
}

/* ── Bulk Upload Modal ──────────────────────────────────────── */
function BulkUploadModal({ drivers, onSave, onClose }) {
  const [rows,      setRows]      = useState([])
  const [fileName,  setFileName]  = useState('')
  const [uploading, setUploading] = useState(false)
  const [err,       setErr]       = useState(null)
  const [result,    setResult]    = useState(null)

  function downloadTemplate() {
    const csv = 'date,expense_type,amount,note,emp_id\n'
      + `${new Date().toISOString().slice(0,10)},Fuel,50.00,Example note,\n`
    const blob = new Blob([csv], { type:'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'petty_cash_expenses_template.csv'
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setFileName(file.name); setErr(null); setResult(null)
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (res) => {
        const parsed = res.data.map((r, i) => {
          const amount       = parseFloat(r.amount)
          const expense_type = (r.expense_type || '').trim()
          const rawDate      = (r.date || '').trim()
          const date         = rawDate ? parseFlexibleDate(rawDate) : new Date().toISOString().slice(0,10)
          const emp_id       = (r.emp_id || '').trim()
          const errors = []
          if (!expense_type) errors.push('expense_type required')
          if (!r.amount || isNaN(amount) || amount <= 0) errors.push('amount must be positive')
          if (rawDate && !date) errors.push(`unrecognized date "${rawDate}" (use YYYY-MM-DD or DD/MM/YYYY)`)
          if (emp_id && !drivers.find(d => d.id === emp_id)) errors.push(`unknown driver id "${emp_id}"`)
          return { row: i + 2, expense_type, amount, date: date || rawDate, note: r.note || '', emp_id, errors }
        })
        setRows(parsed)
      },
      error: (e) => setErr(e.message),
    })
  }

  const validRows = rows.filter(r => r.errors.length === 0)

  async function handleUpload() {
    if (!validRows.length) return
    setUploading(true); setErr(null)
    try {
      const res = await fetch(`${API}/api/petty-cash/expense/bulk`, {
        method:'POST', headers: hdr(),
        body: JSON.stringify({ records: validRows.map(({ row, errors, ...r }) => r) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data)
    } catch(e) { setErr(e.message) } finally { setUploading(false) }
  }

  return (
    <div style={{ position:'fixed', top:0, right:0, bottom:0, left:0, background:'rgba(0,0,0,0.55)', backdropFilter:'blur(6px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:16 }}
      onClick={onClose}>
      <div style={{ background:'var(--card)', borderRadius:20, width:'100%', maxWidth:640, maxHeight:'85vh', border:'1px solid var(--border)', overflow:'hidden', display:'flex', flexDirection:'column', animation:'slideUp 0.2s ease' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ padding:'18px 22px', borderBottom:'1px solid var(--border)', background:'#FDF6E3', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:38, height:38, borderRadius:11, background:'linear-gradient(135deg,#B8860B,#D4A017)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 3px 10px rgba(184,134,11,0.3)' }}>
              <UploadCloud size={17} color="white"/>
            </div>
            <div>
              <div style={{ fontWeight:800, fontSize:15, color:'#1A1612' }}>Bulk Upload Expenses</div>
              <div style={{ fontSize:11, color:'#A89880', marginTop:1 }}>Log many petty cash expenses from a CSV file</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(184,134,11,0.1)', border:'1px solid #F0D78C', cursor:'pointer', color:'#B8860B', display:'flex', padding:6, borderRadius:'50%' }}><X size={16}/></button>
        </div>

        <div style={{ padding:'20px 22px', display:'flex', flexDirection:'column', gap:14, overflowY:'auto', flex:1 }}>
          {err && (
            <div style={{ background:'#FEF2F2', border:'1px solid #FCA5A5', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#DC2626', display:'flex', gap:8, alignItems:'center' }}>
              <AlertCircle size={14}/> {err}
            </div>
          )}

          {result ? (
            <div style={{ textAlign:'center', padding:'20px 10px' }}>
              <div style={{ width:52, height:52, borderRadius:'50%', background:'#ECFDF5', border:'1px solid #A7F3D0', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px' }}>
                <Check size={24} color="#22C55E"/>
              </div>
              <div style={{ fontWeight:800, fontSize:16, color:'var(--text)', marginBottom:6 }}>{result.created} expense{result.created!==1?'s':''} recorded</div>
              {result.skipped > 0 && <div style={{ fontSize:12.5, color:'var(--text-muted)' }}>{result.skipped} row{result.skipped!==1?'s':''} skipped</div>}
              {result.failures?.length > 0 && (
                <div style={{ marginTop:12, textAlign:'left', maxHeight:160, overflowY:'auto', border:'1px solid var(--border)', borderRadius:10 }}>
                  {result.failures.map((f,i) => (
                    <div key={i} style={{ padding:'7px 12px', fontSize:11.5, color:'#DC2626', borderTop: i>0?'1px solid var(--border)':'none' }}>
                      Row {f.row}: {f.reason}
                    </div>
                  ))}
                </div>
              )}
              <button onClick={onSave} className="btn btn-primary" style={{ marginTop:16 }}>Done</button>
            </div>
          ) : (
            <>
              <div style={{ fontSize:12.5, color:'var(--text-muted)', lineHeight:1.5 }}>
                Download the template, fill in one row per expense (columns: <code>date, expense_type, amount, note, emp_id</code> — <code>emp_id</code> is the driver's employee ID and is optional), then upload it back here.
              </div>
              <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
                <button onClick={downloadTemplate} type="button"
                  style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 14px', borderRadius:10, border:'1px solid var(--border)', background:'var(--bg-alt)', color:'var(--text)', fontWeight:600, fontSize:12.5, cursor:'pointer', fontFamily:'inherit' }}>
                  <Download size={13}/> Download Template
                </button>
                <label style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 14px', borderRadius:10, border:'1px solid rgba(184,134,11,0.5)', background:'rgba(184,134,11,0.15)', color:'#B8860B', fontWeight:700, fontSize:12.5, cursor:'pointer' }}>
                  <UploadCloud size={13}/> Choose CSV File
                  <input type="file" accept=".csv" onChange={handleFile} style={{ display:'none' }}/>
                </label>
                {fileName && <span style={{ fontSize:11.5, color:'var(--text-muted)' }}>{fileName}</span>}
              </div>

              {rows.length > 0 && (
                <div style={{ border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
                  <div style={{ padding:'9px 14px', background:'var(--bg-alt)', fontSize:11.5, fontWeight:700, color:'var(--text-muted)', display:'flex', justifyContent:'space-between' }}>
                    <span>{rows.length} row{rows.length!==1?'s':''} parsed</span>
                    <span style={{ color: validRows.length===rows.length ? '#22C55E' : '#D97706' }}>{validRows.length} valid</span>
                  </div>
                  <div style={{ maxHeight:240, overflowY:'auto' }}>
                    {rows.map((r,i) => (
                      <div key={i} title={r.errors.join(', ')}
                        style={{ display:'flex', gap:10, alignItems:'center', padding:'8px 14px', borderTop:'1px solid var(--border)', fontSize:12, background: r.errors.length ? '#FEF2F2' : 'transparent' }}>
                        <span style={{ width:26, color:'var(--text-muted)', flexShrink:0 }}>#{r.row}</span>
                        <span style={{ flex:1, minWidth:0, color:'var(--text)', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.expense_type || '—'}</span>
                        <span style={{ width:80, textAlign:'right', color:'var(--text)', flexShrink:0 }}>{isNaN(r.amount)?'—':`AED ${r.amount}`}</span>
                        <span style={{ width:90, color:'var(--text-muted)', flexShrink:0 }}>{r.date}</span>
                        {r.errors.length > 0 && <AlertCircle size={12} color="#DC2626" style={{ flexShrink:0 }}/>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={handleUpload} disabled={uploading || !validRows.length}
                style={{ padding:'13px', borderRadius:12, border:'none', cursor:(uploading||!validRows.length)?'not-allowed':'pointer', background:(uploading||!validRows.length)?'var(--border)':'linear-gradient(135deg,#B8860B,#D4A017)', color:(uploading||!validRows.length)?'var(--text-muted)':'white', fontWeight:700, fontSize:14, fontFamily:'Poppins,sans-serif', marginTop:4, transition:'all 0.2s' }}>
                {uploading ? 'Uploading…' : validRows.length ? `Upload ${validRows.length} Expense${validRows.length!==1?'s':''}` : 'Choose a file to continue'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Give Cash Modal ────────────────────────────────────────── */
function GiveCashModal({ users, onSave, onClose }) {
  const [form, setForm] = useState({
    user_id:'', amount:'', note:'',
    date: new Date().toISOString().slice(0,10),
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState(null)
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  async function handleSave() {
    if (!form.user_id || !form.amount) return setErr('Recipient and amount required')
    const amt = parseFloat(form.amount)
    if (isNaN(amt) || amt <= 0) return setErr('Amount must be positive')
    setSaving(true); setErr(null)
    try {
      const res = await fetch(`${API}/api/petty-cash/allocate`, {
        method:'POST', headers: hdr(),
        body: JSON.stringify({ user_id:form.user_id, amount:amt, note:form.note||null, date:form.date }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onSave()
    } catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  const selected = users.find(u => u.id === form.user_id)

  return (
    <div style={{ position:'fixed', top:0, right:0, bottom:0, left:0, background:'rgba(0,0,0,0.55)', backdropFilter:'blur(6px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:16 }}
      onClick={onClose}>
      <div style={{ background:'var(--card)', borderRadius:20, width:'100%', maxWidth:600, maxHeight:'90vh', border:'1px solid var(--border)', overflow:'hidden', display:'flex', flexDirection:'column', animation:'slideUp 0.2s ease' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ padding:'18px 22px', borderBottom:'1px solid var(--border)', background:'#ECFDF5', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:38, height:38, borderRadius:11, background:'linear-gradient(135deg,#2E7D52,#22C55E)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 3px 10px rgba(46,125,82,0.3)' }}>
              <HandCoins size={17} color="white"/>
            </div>
            <div>
              <div style={{ fontWeight:800, fontSize:15, color:'#14532D' }}>Give Cash</div>
              <div style={{ fontSize:11, color:'#6B7280', marginTop:1 }}>Allocate petty cash to a team member</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(46,125,82,0.1)', border:'1px solid #A7F3D0', cursor:'pointer', color:'#2E7D52', display:'flex', padding:6, borderRadius:'50%' }}><X size={16}/></button>
        </div>
        <div style={{ padding:'20px 22px', display:'flex', flexDirection:'column', gap:14, overflowY:'auto' }}>
          {err && (
            <div style={{ background:'#FEF2F2', border:'1px solid #FCA5A5', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#DC2626', display:'flex', gap:8, alignItems:'center' }}>
              <AlertCircle size={14}/> {err}
            </div>
          )}
          <div>
            <Lbl>Give To *</Lbl>
            <select className="input" value={form.user_id} onChange={set('user_id')} style={{ borderRadius:10 }}>
              <option value="">Select recipient…</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name} — {ROLE_LABELS[u.role]||u.role}</option>
              ))}
            </select>
            {selected && (
              <div style={{ marginTop:6, display:'flex', alignItems:'center', gap:8, padding:'8px 12px', background:'#ECFDF5', border:'1px solid #A7F3D0', borderRadius:9 }}>
                <div style={{ width:28, height:28, borderRadius:8, background:'#2E7D52', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800, color:'white' }}>
                  {selected.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
                </div>
                <span style={{ fontSize:12, fontWeight:700, color:'#2E7D52' }}>{selected.name} · {ROLE_LABELS[selected.role]||selected.role}</span>
              </div>
            )}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <Lbl>Amount (AED) *</Lbl>
              <input className="input" type="number" min="0.01" step="0.01" value={form.amount} onChange={set('amount')} placeholder="0.00" style={{ borderRadius:10 }}/>
            </div>
            <div>
              <Lbl>Date *</Lbl>
              <input className="input" type="date" value={form.date} onChange={set('date')} style={{ borderRadius:10 }}/>
            </div>
          </div>
          <div>
            <Lbl>Note (optional)</Lbl>
            <input className="input" value={form.note} onChange={set('note')} placeholder="e.g. March operational expenses" style={{ borderRadius:10 }}/>
          </div>
          <button onClick={handleSave} disabled={saving}
            style={{ padding:'13px', borderRadius:12, border:'none', cursor:saving?'not-allowed':'pointer', background:saving?'var(--border)':'linear-gradient(135deg,#2E7D52,#22C55E)', color:saving?'var(--text-muted)':'white', fontWeight:700, fontSize:14, fontFamily:'Poppins,sans-serif', marginTop:4, transition:'all 0.2s', boxShadow:saving?'none':'0 3px 12px rgba(46,125,82,0.3)' }}>
            {saving ? 'Processing…' : 'Give Cash'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Edit Modal ─────────────────────────────────────────────── */
function EditModal({ record, drivers, onSave, onClose }) {
  const isExpense = record.type === 'expense'
  const [form, setForm] = useState({
    amount: record.amount,
    date: record.date?.slice(0,10) || new Date().toISOString().slice(0,10),
    note: record.note || '',
    expense_type: record.expense_type || '',
    emp_id: record.emp_id || '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState(null)
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  async function handleSave() {
    if (!form.amount || !form.date) return setErr('Amount and date required')
    const amt = parseFloat(form.amount)
    if (isNaN(amt) || amt <= 0) return setErr('Amount must be positive')
    if (isExpense && !form.expense_type) return setErr('Expense type required')
    setSaving(true); setErr(null)
    try {
      const body = { amount:amt, date:form.date, note:form.note||null }
      if (isExpense) { body.expense_type = form.expense_type; body.emp_id = form.emp_id||null }
      const res = await fetch(`${API}/api/petty-cash/${record.id}`, {
        method:'PUT', headers: hdr(), body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onSave()
    } catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  return (
    <div style={{ position:'fixed', top:0, right:0, bottom:0, left:0, background:'rgba(0,0,0,0.55)', backdropFilter:'blur(6px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:16 }}
      onClick={onClose}>
      <div style={{ background:'var(--card)', borderRadius:20, width:'100%', maxWidth:600, maxHeight:'90vh', border:'1px solid var(--border)', overflow:'hidden', display:'flex', flexDirection:'column', animation:'slideUp 0.2s ease' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ padding:'18px 22px', borderBottom:'1px solid var(--border)', background:'#EFF6FF', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:38, height:38, borderRadius:11, background:'linear-gradient(135deg,#2563EB,#3B82F6)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 3px 10px rgba(37,99,235,0.3)' }}>
              <Pencil size={16} color="white"/>
            </div>
            <div>
              <div style={{ fontWeight:800, fontSize:15, color:'#1E3A5F' }}>Edit {isExpense?'Expense':'Cash Record'}</div>
              <div style={{ fontSize:11, color:'#6B7280', marginTop:1 }}>Update this petty cash transaction</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(37,99,235,0.1)', border:'1px solid #BFDBFE', cursor:'pointer', color:'#2563EB', display:'flex', padding:6, borderRadius:'50%' }}><X size={16}/></button>
        </div>
        <div style={{ padding:'20px 22px', display:'flex', flexDirection:'column', gap:14, overflowY:'auto' }}>
          {err && (
            <div style={{ background:'#FEF2F2', border:'1px solid #FCA5A5', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#DC2626', display:'flex', gap:8, alignItems:'center' }}>
              <AlertCircle size={14}/> {err}
            </div>
          )}
          {isExpense && (
            <div>
              <Lbl>Expense Type *</Lbl>
              <select className="input" value={form.expense_type} onChange={set('expense_type')} style={{ borderRadius:10 }}>
                <option value="">Select type…</option>
                {EXPENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <Lbl>Amount (AED) *</Lbl>
              <input className="input" type="number" min="0.01" step="0.01" value={form.amount} onChange={set('amount')} placeholder="0.00" style={{ borderRadius:10 }}/>
            </div>
            <div>
              <Lbl>Date *</Lbl>
              <input className="input" type="date" value={form.date} onChange={set('date')} style={{ borderRadius:10 }}/>
            </div>
          </div>
          {isExpense && (
            <div>
              <Lbl>Driver (optional)</Lbl>
              <DriverPicker drivers={drivers} value={form.emp_id} onChange={v => setForm(p => ({ ...p, emp_id:v }))}/>
            </div>
          )}
          <div>
            <Lbl>Note (optional)</Lbl>
            <input className="input" value={form.note} onChange={set('note')} placeholder="Add a note…" style={{ borderRadius:10 }}/>
          </div>
          <button onClick={handleSave} disabled={saving}
            style={{ padding:'13px', borderRadius:12, border:'none', cursor:saving?'not-allowed':'pointer', background:saving?'var(--border)':'linear-gradient(135deg,#2563EB,#3B82F6)', color:saving?'var(--text-muted)':'white', fontWeight:700, fontSize:14, fontFamily:'Poppins,sans-serif', marginTop:4, transition:'all 0.2s', boxShadow:saving?'none':'0 3px 12px rgba(37,99,235,0.35)' }}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Bulk Select Bar ────────────────────────────────────────── */
function BulkSelectBar({ count, total, onSelectAll, onClear, onDelete, deleting }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, padding:'10px 16px', background:'#FEF2F2', borderBottom:'1px solid #FCA5A5', flexWrap:'wrap' }}>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <span style={{ fontSize:12.5, fontWeight:700, color:'#DC2626' }}>{count} selected</span>
        {count < total && (
          <button onClick={onSelectAll} style={{ fontSize:11.5, fontWeight:600, color:'var(--text-muted)', background:'none', border:'none', cursor:'pointer', textDecoration:'underline', padding:0 }}>Select all {total}</button>
        )}
        <button onClick={onClear} style={{ fontSize:11.5, fontWeight:600, color:'var(--text-muted)', background:'none', border:'none', cursor:'pointer', textDecoration:'underline', padding:0 }}>Clear</button>
      </div>
      <button onClick={onDelete} disabled={!count || deleting}
        style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:8, border:'none', background: count ? '#DC2626' : 'var(--border)', color:'white', fontWeight:700, fontSize:12, cursor: count && !deleting ? 'pointer' : 'not-allowed', fontFamily:'inherit' }}>
        <Trash2 size={12}/> {deleting ? 'Deleting…' : `Delete${count ? ` ${count}` : ''}`}
      </button>
    </div>
  )
}

/* ── Pagination ─────────────────────────────────────────────── */
function Pagination({ page, totalPages, onChange, loading }) {
  if (totalPages <= 1) return null
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderTop:'1px solid var(--border)' }}>
      <button onClick={() => onChange(page - 1)} disabled={page <= 1 || loading}
        style={{ display:'flex', alignItems:'center', gap:4, padding:'7px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-alt)', color:'var(--text)', fontWeight:600, fontSize:12, fontFamily:'inherit', cursor: page <= 1 || loading ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.5 : 1 }}>
        <ChevronLeft size={13}/> Prev
      </button>
      <span style={{ fontSize:12, color:'var(--text-muted)', fontWeight:600 }}>Page {page} of {totalPages}</span>
      <button onClick={() => onChange(page + 1)} disabled={page >= totalPages || loading}
        style={{ display:'flex', alignItems:'center', gap:4, padding:'7px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-alt)', color:'var(--text)', fontWeight:600, fontSize:12, fontFamily:'inherit', cursor: page >= totalPages || loading ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.5 : 1 }}>
        Next <ChevronRight size={13}/>
      </button>
    </div>
  )
}

/* ── Transaction Row ────────────────────────────────────────── */
function TxRow({ record, canDelete, onDelete, onEdit, selectMode, selected, onToggleSelect, showUser }) {
  const isAlloc = record.type === 'allocation'
  return (
    <div onClick={selectMode ? () => onToggleSelect(record.id) : undefined}
      style={{ display:'flex', alignItems:'center', gap:12, padding:'13px 16px', borderBottom:'1px solid var(--border)', transition:'background 0.15s', cursor: selectMode ? 'pointer' : 'default', background: selected ? '#FEF2F2' : 'transparent' }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background='var(--bg-alt)' }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background='transparent' }}>
      {selectMode && (
        <input type="checkbox" checked={!!selected} onChange={() => onToggleSelect(record.id)} onClick={e => e.stopPropagation()}
          style={{ width:16, height:16, flexShrink:0, cursor:'pointer', accentColor:'#DC2626' }}/>
      )}
      <div style={{ width:38, height:38, borderRadius:11, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', background: isAlloc ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.1)' }}>
        {isAlloc ? <ArrowDownLeft size={16} color="#22C55E"/> : <ArrowUpRight size={16} color="#EF4444"/>}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>
          {isAlloc ? 'Cash Received' : record.expense_type}
          {showUser && record.user_name && (
            <span style={{ fontWeight:500, color:'var(--text-muted)' }}> · {record.user_name}</span>
          )}
        </div>
        <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2, display:'flex', gap:6, flexWrap:'wrap', alignItems:'baseline' }}>
          {record.emp_name && (
            <span style={{ color:'#B8860B', fontWeight:600, display:'flex', alignItems:'center', gap:3, flexShrink:0 }}>
              <User size={9}/> {record.emp_name}
            </span>
          )}
          {record.note && <span style={{ wordBreak:'break-word' }}>{record.note}</span>}
          {!record.note && !record.emp_name && (
            <span>{isAlloc ? `From ${record.created_by_name||'Accountant'}` : record.date}</span>
          )}
        </div>
      </div>
      <div style={{ textAlign:'right', flexShrink:0 }}>
        <div style={{ fontSize:13, fontWeight:800, color: isAlloc ? '#22C55E' : '#EF4444' }}>
          {isAlloc ? '+' : '-'}{fmt(record.amount)}
        </div>
        <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:2 }}>{record.date}</div>
      </div>
      {canDelete && !selectMode && (
        <div style={{ display:'flex', gap:2, flexShrink:0 }}>
          <button onClick={() => onEdit(record)}
            style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:4, display:'flex', borderRadius:6 }}
            onMouseEnter={e => e.currentTarget.style.color='#2563EB'}
            onMouseLeave={e => e.currentTarget.style.color='var(--text-muted)'}>
            <Pencil size={13}/>
          </button>
          <button onClick={() => onDelete(record.id)}
            style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:4, display:'flex', borderRadius:6 }}
            onMouseEnter={e => e.currentTarget.style.color='#EF4444'}
            onMouseLeave={e => e.currentTarget.style.color='var(--text-muted)'}>
            <Trash2 size={13}/>
          </button>
        </div>
      )}
    </div>
  )
}

/* ── User Detail Panel ──────────────────────────────────────── */
function UserDetailPanel({ userId, userName, userRole, onBack, canDelete, drivers }) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [editRecord, setEditRecord] = useState(null)
  const [selectMode,   setSelectMode]   = useState(false)
  const [selectedIds,  setSelectedIds]  = useState(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/petty-cash/user/${userId}`, { headers: hdr() })
      setData(await res.json())
    } catch {} finally { setLoading(false) }
  }, [userId])

  useEffect(() => { load() }, [load])

  async function handleDelete(id) {
    if (!confirm('Delete this record?')) return
    await fetch(`${API}/api/petty-cash/${id}`, { method:'DELETE', headers:hdr() })
    load()
  }

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  function exitSelectMode() { setSelectMode(false); setSelectedIds(new Set()) }
  async function handleBulkDelete() {
    if (!selectedIds.size) return
    if (!confirm(`Delete ${selectedIds.size} record${selectedIds.size!==1?'s':''}? This cannot be undone.`)) return
    setBulkDeleting(true)
    try {
      await fetch(`${API}/api/petty-cash/delete-bulk`, { method:'POST', headers:hdr(), body: JSON.stringify({ ids:[...selectedIds] }) })
    } finally {
      setBulkDeleting(false)
      exitSelectMode()
      load()
    }
  }

  const balance = Number(data?.balance || 0)
  const isNeg   = balance < 0

  return (
    <div>
      {/* Detail hero */}
      <div style={{ background:'linear-gradient(135deg,#0f1623 0%,#1a2535 50%,#1e3a5f 100%)', borderRadius:16, padding:22, marginBottom:16 }}>
        <button onClick={onBack}
          style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.12)', cursor:'pointer', color:'rgba(255,255,255,0.7)', fontSize:12, fontWeight:600, padding:'6px 12px', borderRadius:8, fontFamily:'Poppins,sans-serif', marginBottom:18 }}>
          <ChevronLeft size={13}/> Back to Overview
        </button>
        <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:20 }}>
          <div style={{ width:48, height:48, borderRadius:14, background:'linear-gradient(135deg,#B8860B,#D4A017)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:15, fontWeight:800, color:'white', boxShadow:'0 4px 12px rgba(184,134,11,0.3)' }}>
            {userName.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight:800, fontSize:17, color:'white', letterSpacing:'-0.02em' }}>{userName}</div>
            <div style={{ fontSize:12, color:'rgba(255,255,255,0.5)', marginTop:2 }}>{ROLE_LABELS[userRole]||userRole}</div>
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
          {[
            { label:'Balance',  value:fmt(balance),                color: isNeg?'#F87171':'#34D399' },
            { label:'Received', value:fmt(data?.total_allocated||0), color:'#34D399' },
            { label:'Spent',    value:fmt(data?.total_spent||0),     color:'#F87171' },
          ].map(s => (
            <div key={s.label} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, padding:'14px 16px' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.45)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>{s.label}</div>
              <div style={{ fontSize:18, fontWeight:900, color:s.color, letterSpacing:'-0.02em' }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Transactions card */}
      <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, overflow:'hidden' }}>
        <div style={{ padding:'13px 16px', borderBottom:'1px solid var(--border)', fontWeight:700, fontSize:13, color:'var(--text)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span>Transaction History</span>
          {canDelete && data?.records?.length > 0 && (
            <button onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
              style={{ fontSize:11.5, fontWeight:700, color: selectMode?'var(--text-muted)':'#DC2626', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}>
              {selectMode ? 'Cancel' : 'Select'}
            </button>
          )}
        </div>
        {selectMode && (
          <BulkSelectBar count={selectedIds.size} total={data?.records?.length||0}
            onSelectAll={() => setSelectedIds(new Set(data.records.map(r=>r.id)))}
            onClear={() => setSelectedIds(new Set())}
            onDelete={handleBulkDelete} deleting={bulkDeleting}/>
        )}
        {loading ? (
          <div style={{ padding:32, textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>Loading…</div>
        ) : !data?.records?.length ? (
          <div style={{ padding:40, textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>No transactions yet</div>
        ) : (
          data.records.map(r => (
            <TxRow key={r.id} record={r} canDelete={canDelete} onDelete={handleDelete} onEdit={setEditRecord}
              selectMode={selectMode} selected={selectedIds.has(r.id)} onToggleSelect={toggleSelect}/>
          ))
        )}
      </div>

      {editRecord && (
        <EditModal record={editRecord} drivers={drivers} onSave={() => { setEditRecord(null); load() }} onClose={() => setEditRecord(null)}/>
      )}
    </div>
  )
}

/* ── Main Page ──────────────────────────────────────────────── */
export default function PettyCashPage() {
  const { user }  = useAuth()
  const [myData,    setMyData]    = useState(null)
  const [summary,   setSummary]   = useState([])
  const [allUsers,  setAllUsers]  = useState([])
  const [drivers,   setDrivers]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [refreshing,setRefreshing]= useState(false)
  const [modal,     setModal]     = useState(null)
  const [drillUser, setDrillUser] = useState(null)
  const [tab,       setTab]       = useState(null)
  const [search,    setSearch]    = useState('')
  const [editRecord,setEditRecord]= useState(null)
  const [selectMode,   setSelectMode]   = useState(false)
  const [selectedIds,  setSelectedIds]  = useState(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [recentData,    setRecentData]    = useState(null)
  const [recentPage,    setRecentPage]    = useState(1)
  const [recentLoading, setRecentLoading] = useState(false)
  const [recentSelectMode,   setRecentSelectMode]   = useState(false)
  const [recentSelectedIds,  setRecentSelectedIds]  = useState(new Set())
  const [recentBulkDeleting, setRecentBulkDeleting] = useState(false)

  const canGiveCash = ['admin','accountant'].includes(user?.role)
  const canViewTeam = ['admin','accountant','general_manager','manager'].includes(user?.role)
  const canDelete   = ['admin','accountant'].includes(user?.role)
  // Admins/accountants distribute cash rather than hold it personally, so they get
  // an all-users "Recent Entries" feed instead of the "My Balance" tab.
  const isCashManager = canDelete

  const load = useCallback(async (isRefresh=false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const h = { headers: hdr() }
      const fetches = [
        fetch(`${API}/api/petty-cash/my`, h).then(r => r.json()),
        fetch(`${API}/api/employees`, h).then(r => r.json()),
      ]
      if (canViewTeam) {
        fetches.push(
          fetch(`${API}/api/petty-cash/summary`, h).then(r => r.json()),
          fetch(`${API}/api/auth/users`, h).then(r => r.json()),
        )
      }
      const results = await Promise.all(fetches)
      setMyData(results[0])
      setDrivers((results[1]?.employees||[]).filter(e => e.role === 'driver'))
      if (canViewTeam) {
        setSummary(results[2]?.summary||[])
        setAllUsers((results[3]?.users||[]).filter(u => u.role !== 'driver' && u.id !== user?.id))
      }
    } catch {} finally { setLoading(false); setRefreshing(false) }
  }, [canViewTeam, user?.id])

  useEffect(() => { load() }, [load])

  const loadRecent = useCallback(async (page = 1) => {
    setRecentLoading(true)
    try {
      const res  = await fetch(`${API}/api/petty-cash/all?page=${page}&limit=20`, { headers: hdr() })
      const data = await res.json()
      setRecentData(data)
      setRecentPage(data.page || page)
    } catch {} finally { setRecentLoading(false) }
  }, [])

  const activeTab = tab || (isCashManager ? 'recent' : 'my')

  useEffect(() => {
    if (isCashManager && activeTab === 'recent') loadRecent(recentPage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCashManager, activeTab])

  async function handleDeleteMy(id) {
    if (!confirm('Delete this record?')) return
    await fetch(`${API}/api/petty-cash/${id}`, { method:'DELETE', headers:hdr() })
    load()
  }

  async function handleDeleteRecent(id) {
    if (!confirm('Delete this record?')) return
    await fetch(`${API}/api/petty-cash/${id}`, { method:'DELETE', headers:hdr() })
    loadRecent(recentPage)
  }

  function toggleRecentSelect(id) {
    setRecentSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  function exitRecentSelectMode() { setRecentSelectMode(false); setRecentSelectedIds(new Set()) }
  async function handleRecentBulkDelete() {
    if (!recentSelectedIds.size) return
    if (!confirm(`Delete ${recentSelectedIds.size} record${recentSelectedIds.size!==1?'s':''}? This cannot be undone.`)) return
    setRecentBulkDeleting(true)
    try {
      await fetch(`${API}/api/petty-cash/delete-bulk`, { method:'POST', headers:hdr(), body: JSON.stringify({ ids:[...recentSelectedIds] }) })
    } finally {
      setRecentBulkDeleting(false)
      exitRecentSelectMode()
      loadRecent(recentPage)
    }
  }

  function refreshAll() {
    load()
    if (isCashManager) loadRecent(recentPage)
  }

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  function exitSelectMode() { setSelectMode(false); setSelectedIds(new Set()) }
  async function handleBulkDelete() {
    if (!selectedIds.size) return
    if (!confirm(`Delete ${selectedIds.size} record${selectedIds.size!==1?'s':''}? This cannot be undone.`)) return
    setBulkDeleting(true)
    try {
      await fetch(`${API}/api/petty-cash/delete-bulk`, { method:'POST', headers:hdr(), body: JSON.stringify({ ids:[...selectedIds] }) })
    } finally {
      setBulkDeleting(false)
      exitSelectMode()
      load()
    }
  }

  const filteredSummary = useMemo(() => {
    if (!search) return summary
    const q = search.toLowerCase()
    return summary.filter(u => u.name.toLowerCase().includes(q))
  }, [summary, search])

  if (loading) return (
    <div>
      <div style={{ background:'linear-gradient(135deg,#0f1623 0%,#1a2535 50%,#1e3a5f 100%)', borderRadius:16, padding:24, marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:20 }}>
          <div className="skeleton" style={{ width:48, height:48, borderRadius:14 }}/>
          <div>
            <div className="skeleton" style={{ width:130, height:18, borderRadius:6, marginBottom:7 }}/>
            <div className="skeleton" style={{ width:170, height:13, borderRadius:6 }}/>
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
          {[0,1,2].map(i => <div key={i} className="skeleton" style={{ height:76, borderRadius:12 }}/>)}
        </div>
      </div>
      <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, padding:20 }}>
        {[0,1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height:56, borderRadius:10, marginBottom:10 }}/>)}
      </div>
    </div>
  )

  const balance       = Number(myData?.balance||0)
  const totalAllocAll = summary.reduce((s,u) => s + Number(u.total_allocated||0), 0)
  const totalSpentAll = summary.reduce((s,u) => s + Number(u.total_spent||0), 0)
  const unaccounted   = summary.filter(u => Number(u.balance) < 0).length
  const isNeg  = balance < 0
  const isZero = balance === 0

  if (drillUser) {
    return (
      <UserDetailPanel
        userId={drillUser.id} userName={drillUser.name} userRole={drillUser.role}
        onBack={() => setDrillUser(null)} canDelete={canDelete} drivers={drivers}/>
    )
  }

  return (
    <>
      <style>{`
        .pc-tab { background:none; border:none; border-bottom:2px solid transparent; padding:11px 18px; font-size:13px; font-weight:500; color:var(--text-muted); cursor:pointer; font-family:Poppins,sans-serif; transition:all 0.15s; }
        .pc-tab.active { color:#B8860B; font-weight:700; border-bottom-color:#B8860B; }
        .pc-tab:hover:not(.active) { color:var(--text); background:var(--bg-alt); }
        @keyframes pc-spin { to { transform:rotate(360deg); } }
        .pc-spin { animation:pc-spin 0.8s linear infinite; }
      `}</style>

      <div>

        {/* ── Hero ── */}
        <div style={{ background:'linear-gradient(135deg,#0f1623 0%,#1a2535 50%,#1e3a5f 100%)', borderRadius:16, padding:24, marginBottom:16 }}>

          {/* Top row */}
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, marginBottom:22, flexWrap:'wrap' }}>
            <div style={{ display:'flex', alignItems:'center', gap:14 }}>
              <div style={{ width:50, height:50, borderRadius:14, background:'rgba(184,134,11,0.2)', border:'1.5px solid rgba(184,134,11,0.4)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <Wallet size={23} color="#D4A017"/>
              </div>
              <div>
                <div style={{ fontWeight:800, fontSize:19, color:'white', letterSpacing:'-0.02em' }}>Petty Cash</div>
                <div style={{ fontSize:12, color:'rgba(255,255,255,0.5)', marginTop:3 }}>
                  {user?.name} · <span style={{ color:'#D4A017', fontWeight:700 }}>{ROLE_LABELS[user?.role]||user?.role}</span>
                </div>
              </div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0, flexWrap:'wrap' }}>
              <button onClick={() => load(true)} title="Refresh"
                style={{ width:36, height:36, borderRadius:9, background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.12)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <RefreshCw size={14} color="rgba(255,255,255,0.6)" className={refreshing ? 'pc-spin' : ''}/>
              </button>
              {canGiveCash && (
                <button onClick={() => setModal('give')}
                  style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 16px', borderRadius:10, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#2E7D52,#22C55E)', color:'white', fontWeight:700, fontSize:13, fontFamily:'Poppins,sans-serif', boxShadow:'0 2px 10px rgba(46,125,82,0.4)', whiteSpace:'nowrap' }}>
                  <HandCoins size={14}/> Give Cash
                </button>
              )}
              <button onClick={() => setModal('expense')}
                style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 16px', borderRadius:10, border:'1px solid rgba(184,134,11,0.5)', cursor:'pointer', background:'rgba(184,134,11,0.15)', color:'#D4A017', fontWeight:700, fontSize:13, fontFamily:'Poppins,sans-serif', whiteSpace:'nowrap' }}>
                <Receipt size={14}/> Record Expense
              </button>
              <button onClick={() => setModal('bulk')}
                style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 16px', borderRadius:10, border:'1px solid rgba(255,255,255,0.15)', cursor:'pointer', background:'rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.85)', fontWeight:700, fontSize:13, fontFamily:'Poppins,sans-serif', whiteSpace:'nowrap' }}>
                <UploadCloud size={14}/> Bulk Upload
              </button>
            </div>
          </div>

          {/* KPI tiles */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
            <div style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, padding:'16px 18px' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.45)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:7 }}>My Balance</div>
              <div style={{ fontSize:21, fontWeight:900, color: isNeg?'#F87171':isZero?'#34D399':'#FBBF24', letterSpacing:'-0.03em', lineHeight:1 }}>
                {isNeg?'-':''}{fmt(balance)}
              </div>
              <div style={{ fontSize:10.5, color:'rgba(255,255,255,0.35)', marginTop:5 }}>
                {isNeg?'To account':isZero?'Fully accounted':'Cash in hand'}
              </div>
            </div>
            <div style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, padding:'16px 18px' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.45)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:7 }}>Received</div>
              <div style={{ fontSize:21, fontWeight:900, color:'#34D399', letterSpacing:'-0.03em', lineHeight:1 }}>{fmt(myData?.total_allocated||0)}</div>
              <div style={{ fontSize:10.5, color:'rgba(255,255,255,0.35)', marginTop:5 }}>Total cash in</div>
            </div>
            <div style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, padding:'16px 18px' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.45)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:7 }}>Spent</div>
              <div style={{ fontSize:21, fontWeight:900, color:'#F87171', letterSpacing:'-0.03em', lineHeight:1 }}>{fmt(myData?.total_spent||0)}</div>
              <div style={{ fontSize:10.5, color:'rgba(255,255,255,0.35)', marginTop:5 }}>Total expenses</div>
            </div>
          </div>
        </div>

        {/* ── Main Card ── */}
        <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, overflow:'hidden' }}>

          {/* Tabs */}
          {canViewTeam && (
            <div style={{ padding:'0 16px', borderBottom:'1px solid var(--border)', display:'flex', gap:2 }}>
              {(isCashManager ? [['recent','Recent Entries'],['team','Team Overview']] : [['my','My Balance'],['team','Team Overview']]).map(([v,l]) => (
                <button key={v} onClick={() => setTab(v)} className={`pc-tab${activeTab===v?' active':''}`}>{l}</button>
              ))}
            </div>
          )}

          {/* ── Recent Entries (admin/accountant) ── */}
          {activeTab === 'recent' && isCashManager && (
            <div>
              <div style={{ padding:'13px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid var(--border)' }}>
                <span style={{ fontWeight:700, fontSize:13, color:'var(--text)' }}>Recent Entries</span>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  {recentData?.total > 0 && (
                    <span style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600 }}>{recentData.total} records</span>
                  )}
                  {canDelete && recentData?.records?.length > 0 && (
                    <button onClick={() => recentSelectMode ? exitRecentSelectMode() : setRecentSelectMode(true)}
                      style={{ fontSize:11.5, fontWeight:700, color: recentSelectMode?'var(--text-muted)':'#DC2626', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}>
                      {recentSelectMode ? 'Cancel' : 'Select'}
                    </button>
                  )}
                </div>
              </div>
              {recentSelectMode && (
                <BulkSelectBar count={recentSelectedIds.size} total={recentData?.records?.length||0}
                  onSelectAll={() => setRecentSelectedIds(new Set(recentData.records.map(r=>r.id)))}
                  onClear={() => setRecentSelectedIds(new Set())}
                  onDelete={handleRecentBulkDelete} deleting={recentBulkDeleting}/>
              )}
              {recentLoading && !recentData ? (
                <div style={{ padding:32 }}>
                  {[0,1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height:56, borderRadius:10, marginBottom:10 }}/>)}
                </div>
              ) : !recentData?.records?.length ? (
                <div style={{ padding:'52px 20px', textAlign:'center', color:'var(--text-muted)' }}>
                  <Wallet size={36} style={{ margin:'0 auto 14px', display:'block', opacity:0.12 }}/>
                  <div style={{ fontWeight:600, fontSize:13 }}>No transactions yet</div>
                  <div style={{ fontSize:11, marginTop:4 }}>Record an expense or give cash to get started</div>
                </div>
              ) : (
                recentData.records.map(r => (
                  <TxRow key={r.id} record={r} canDelete={canDelete} onDelete={handleDeleteRecent} onEdit={setEditRecord}
                    selectMode={recentSelectMode} selected={recentSelectedIds.has(r.id)} onToggleSelect={toggleRecentSelect} showUser/>
                ))
              )}
              <Pagination page={recentPage} totalPages={recentData?.totalPages||1}
                onChange={p => loadRecent(p)} loading={recentLoading}/>
            </div>
          )}

          {/* ── My Balance ── */}
          {activeTab === 'my' && !isCashManager && (
            <div>
              <div style={{ padding:'13px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid var(--border)' }}>
                <span style={{ fontWeight:700, fontSize:13, color:'var(--text)' }}>Transaction History</span>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  {myData?.records?.length > 0 && (
                    <span style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600 }}>{myData.records.length} records</span>
                  )}
                  {canDelete && myData?.records?.length > 0 && (
                    <button onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
                      style={{ fontSize:11.5, fontWeight:700, color: selectMode?'var(--text-muted)':'#DC2626', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}>
                      {selectMode ? 'Cancel' : 'Select'}
                    </button>
                  )}
                </div>
              </div>
              {selectMode && (
                <BulkSelectBar count={selectedIds.size} total={myData?.records?.length||0}
                  onSelectAll={() => setSelectedIds(new Set(myData.records.map(r=>r.id)))}
                  onClear={() => setSelectedIds(new Set())}
                  onDelete={handleBulkDelete} deleting={bulkDeleting}/>
              )}
              {!myData?.records?.length ? (
                <div style={{ padding:'52px 20px', textAlign:'center', color:'var(--text-muted)' }}>
                  <Wallet size={36} style={{ margin:'0 auto 14px', display:'block', opacity:0.12 }}/>
                  <div style={{ fontWeight:600, fontSize:13 }}>No transactions yet</div>
                  <div style={{ fontSize:11, marginTop:4 }}>Record an expense or receive cash to get started</div>
                </div>
              ) : (
                myData.records.map(r => (
                  <TxRow key={r.id} record={r} canDelete={canDelete} onDelete={handleDeleteMy} onEdit={setEditRecord}
                    selectMode={selectMode} selected={selectedIds.has(r.id)} onToggleSelect={toggleSelect}/>
                ))
              )}
            </div>
          )}

          {/* ── Team Overview ── */}
          {activeTab === 'team' && (
            <div>
              {/* Team KPIs */}
              <div style={{ padding:'14px 16px', display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, borderBottom:'1px solid var(--border)', background:'var(--bg-alt)' }}>
                {[
                  { label:'Distributed', value:fmt(totalAllocAll), color:'#22C55E', bg:'rgba(34,197,94,0.08)',  bc:'rgba(34,197,94,0.2)',  icon:<TrendingDown size={11} color="#22C55E"/> },
                  { label:'Total Spent',  value:fmt(totalSpentAll), color:'#EF4444', bg:'rgba(239,68,68,0.08)',  bc:'rgba(239,68,68,0.2)',  icon:<TrendingUp   size={11} color="#EF4444"/> },
                  { label:'Unaccounted', value:String(unaccounted), color:unaccounted>0?'#EF4444':'#22C55E', bg:unaccounted>0?'rgba(239,68,68,0.08)':'rgba(34,197,94,0.08)', bc:unaccounted>0?'rgba(239,68,68,0.2)':'rgba(34,197,94,0.2)', icon:<Users size={11} color={unaccounted>0?'#EF4444':'#22C55E'}/> },
                ].map((s,i) => (
                  <div key={i} style={{ padding:'12px 14px', background:s.bg, border:`1px solid ${s.bc}`, borderRadius:12 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:5 }}>
                      {s.icon}
                      <span style={{ fontSize:9.5, fontWeight:700, color:s.color, textTransform:'uppercase', letterSpacing:'0.06em' }}>{s.label}</span>
                    </div>
                    <div style={{ fontSize:15, fontWeight:900, color:s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Search */}
              <div style={{ padding:'10px 16px', borderBottom:'1px solid var(--border)', position:'relative' }}>
                <Search size={14} style={{ position:'absolute', left:28, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', pointerEvents:'none' }}/>
                <input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search team members…"
                  style={{ width:'100%', padding:'9px 12px 9px 36px', borderRadius:10, border:'1px solid var(--border)', background:'var(--bg-alt)', color:'var(--text)', fontSize:13, fontFamily:'Poppins,sans-serif', outline:'none' }}/>
              </div>

              {/* List header */}
              <div style={{ padding:'10px 16px', fontWeight:700, fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.07em', borderBottom:'1px solid var(--border)' }}>
                Team Members ({filteredSummary.length})
              </div>

              {/* Team list */}
              {!filteredSummary.length ? (
                <div style={{ padding:40, textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>No records found</div>
              ) : filteredSummary.map(u => {
                const bal = Number(u.balance)
                const neg = bal < 0
                return (
                  <div key={u.id} onClick={() => setDrillUser({ id:u.id, name:u.name, role:u.role })}
                    style={{ display:'flex', alignItems:'center', gap:12, padding:'13px 16px', borderBottom:'1px solid var(--border)', cursor:'pointer', transition:'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background='var(--bg-alt)'}
                    onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                    <div style={{ width:40, height:40, borderRadius:12, background:'linear-gradient(135deg,#B8860B,#D4A017)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:13, fontWeight:800, color:'white' }}>
                      {u.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:700, fontSize:13, color:'var(--text)' }}>{u.name}</div>
                      <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>
                        {ROLE_LABELS[u.role]||u.role}{Number(u.transaction_count)>0&&` · ${u.transaction_count} transactions`}
                      </div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <div style={{ fontSize:14, fontWeight:800, color:neg?'#EF4444':'#22C55E' }}>{neg?'-':''}{fmt(Math.abs(bal))}</div>
                      <div style={{ fontSize:10, fontWeight:600, marginTop:3, padding:'2px 8px', borderRadius:6, background:neg?'rgba(239,68,68,0.1)':'rgba(34,197,94,0.1)', color:neg?'#EF4444':'#22C55E', display:'inline-block' }}>
                        {neg?'Unaccounted':'Clear'}
                      </div>
                    </div>
                    <ChevronRight size={14} style={{ color:'var(--text-muted)', flexShrink:0 }}/>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {modal==='expense' && <ExpenseModal drivers={drivers} onSave={() => { setModal(null); refreshAll() }} onClose={() => setModal(null)}/>}
      {modal==='bulk'    && <BulkUploadModal drivers={drivers} onSave={() => { setModal(null); refreshAll() }} onClose={() => setModal(null)}/>}
      {modal==='give'    && <GiveCashModal users={allUsers} onSave={() => { setModal(null); refreshAll() }} onClose={() => setModal(null)}/>}
      {editRecord && <EditModal record={editRecord} drivers={drivers} onSave={() => { setEditRecord(null); refreshAll() }} onClose={() => setEditRecord(null)}/>}
    </>
  )
}
