'use client'
import React, { useState } from 'react'
import { useAuth } from '@/lib/auth'
import { Lock, Eye, EyeOff, CheckCircle, ShieldCheck, KeyRound } from 'lucide-react'

import { API } from '@/lib/api'

const ROLE_LABELS = {
  admin: 'Admin', general_manager: 'Manager', hr: 'HR',
  accountant: 'Accountant', poc: 'POC', driver: 'Driver',
}

function StrengthBar({ password }) {
  if (!password) return null
  const strength =
    password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password) ? 4
    : password.length >= 8 && (/[A-Z]/.test(password) || /[0-9]/.test(password)) ? 3
    : password.length >= 6 ? 2 : 1
  const labels = ['Too short', 'Weak', 'Good', 'Strong']
  const colors = ['#EF4444', '#F59E0B', '#3B82F6', '#10B981']
  return (
    <div style={{ marginTop:8 }}>
      <div style={{ display:'flex', gap:4, marginBottom:5 }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{ flex:1, height:3, borderRadius:2, background: i<=strength ? colors[strength-1] : 'var(--border)', transition:'background 0.3s' }}/>
        ))}
      </div>
      <div style={{ fontSize:11, fontWeight:600, color:colors[strength-1] }}>{labels[strength-1]}</div>
    </div>
  )
}

export default function SettingsPage() {
  const { user } = useAuth()
  const [current, setCurrent] = useState('')
  const [newPw,   setNewPw]   = useState('')
  const [confirm, setConfirm] = useState('')
  const [showCur, setShowCur] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showCon, setShowCon] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [done,    setDone]    = useState(false)
  const [err,     setErr]     = useState(null)

  async function handleSave() {
    if (!current || !newPw) return setErr('All fields required')
    if (newPw !== confirm)  return setErr('New passwords do not match')
    if (newPw.length < 6)   return setErr('Password must be at least 6 characters')
    setSaving(true); setErr(null); setDone(false)
    try {
      const res = await fetch(`${API}/api/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', Authorization:`Bearer ${localStorage.getItem('gcd_token')}` },
        body: JSON.stringify({ currentPassword: current, newPassword: newPw })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setDone(true)
      setCurrent(''); setNewPw(''); setConfirm('')
      // Clear session — force re-login with new password
      setTimeout(() => {
        localStorage.removeItem('gcd_token')
        localStorage.removeItem('gcd_user')
        window.location.href = '/login'
      }, 2000)
    } catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  const canSubmit = current && newPw && confirm && !saving
  const match     = confirm && newPw === confirm

  return (
    <div style={{ maxWidth:520, margin:'0 auto', display:'flex', flexDirection:'column', gap:16 }}>

      {/* ── Hero header ── */}
      <div style={{ background:'linear-gradient(135deg,#1A1612 0%,#2C1F0A 100%)', borderRadius:20, padding:'24px 24px 20px', color:'white', position:'relative', overflow:'hidden' }}>
        {/* decorative circles */}
        <div style={{ position:'absolute', right:-30, top:-30, width:120, height:120, borderRadius:'50%', background:'rgba(184,134,11,0.15)' }}/>
        <div style={{ position:'absolute', right:40, bottom:-40, width:80, height:80, borderRadius:'50%', background:'rgba(184,134,11,0.1)' }}/>
        <div style={{ position:'relative', zIndex:1, display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ width:52, height:52, borderRadius:16, background:'linear-gradient(135deg,#8F6807,#D4A017)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow:'0 4px 14px rgba(184,134,11,0.4)' }}>
            <ShieldCheck size={26} color="white"/>
          </div>
          <div>
            <div style={{ fontWeight:800, fontSize:18, letterSpacing:'-0.02em', lineHeight:1.2 }}>Account Security</div>
            <div style={{ fontSize:12, color:'rgba(255,255,255,0.55)', marginTop:3 }}>
              {user?.name} · <span style={{ color:'#D4A017', fontWeight:600 }}>{ROLE_LABELS[user?.role] || user?.role}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Password form card ── */}
      <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:20, overflow:'hidden' }}>

        {/* Card title row */}
        <div style={{ padding:'18px 22px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:34, height:34, borderRadius:10, background:'linear-gradient(135deg,#FDF6E3,#FEF3D0)', border:'1px solid #F0D78C', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <KeyRound size={16} color="#8F6807"/>
          </div>
          <div>
            <div style={{ fontWeight:700, fontSize:14.5, color:'var(--text)' }}>Change Password</div>
            <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:1 }}>Keep your account safe with a strong password</div>
          </div>
        </div>

        <div style={{ padding:'20px 22px 22px', display:'flex', flexDirection:'column', gap:16 }}>

          {/* Success */}
          {done && (
            <div style={{ display:'flex', gap:10, alignItems:'center', background:'#ECFDF5', border:'1px solid #A7F3D0', borderRadius:12, padding:'12px 16px' }}>
              <CheckCircle size={16} color="#059669"/>
              <span style={{ fontSize:13, color:'#059669', fontWeight:600 }}>Password updated! Signing you out to re-login…</span>
            </div>
          )}

          {/* Error */}
          {err && (
            <div style={{ background:'#FEF2F2', border:'1px solid #FCA5A5', borderRadius:12, padding:'12px 16px', fontSize:13, color:'#DC2626', fontWeight:500 }}>{err}</div>
          )}

          {/* Current password */}
          <div>
            <label style={{ display:'block', fontSize:11, fontWeight:700, letterSpacing:'0.07em', textTransform:'uppercase', color:'var(--text-muted)', marginBottom:7 }}>Current Password</label>
            <div style={{ position:'relative' }}>
              <input
                className="input"
                type={showCur ? 'text' : 'password'}
                value={current}
                onChange={e => { setCurrent(e.target.value); setDone(false); setErr(null) }}
                placeholder="Enter current password"
                style={{ paddingRight:44, borderRadius:12 }}
                autoComplete="current-password"
              />
              <button type="button" onClick={()=>setShowCur(p=>!p)}
                style={{ position:'absolute', right:13, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:0, display:'flex' }}>
                {showCur ? <EyeOff size={15}/> : <Eye size={15}/>}
              </button>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height:1, background:'var(--border)', margin:'0 -22px', padding:'0 22px' }}/>

          {/* New password */}
          <div>
            <label style={{ display:'block', fontSize:11, fontWeight:700, letterSpacing:'0.07em', textTransform:'uppercase', color:'var(--text-muted)', marginBottom:7 }}>New Password</label>
            <div style={{ position:'relative' }}>
              <input
                className="input"
                type={showNew ? 'text' : 'password'}
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                placeholder="Enter new password"
                style={{ paddingRight:44, borderRadius:12 }}
                autoComplete="new-password"
              />
              <button type="button" onClick={()=>setShowNew(p=>!p)}
                style={{ position:'absolute', right:13, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:0, display:'flex' }}>
                {showNew ? <EyeOff size={15}/> : <Eye size={15}/>}
              </button>
            </div>
            <StrengthBar password={newPw}/>
          </div>

          {/* Confirm password */}
          <div>
            <label style={{ display:'block', fontSize:11, fontWeight:700, letterSpacing:'0.07em', textTransform:'uppercase', color:'var(--text-muted)', marginBottom:7 }}>Confirm New Password</label>
            <div style={{ position:'relative' }}>
              <input
                className="input"
                type={showCon ? 'text' : 'password'}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Re-enter new password"
                style={{ paddingRight:44, borderRadius:12, borderColor: confirm ? (match ? '#A7F3D0' : '#FCA5A5') : undefined }}
                autoComplete="new-password"
              />
              <button type="button" onClick={()=>setShowCon(p=>!p)}
                style={{ position:'absolute', right:13, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:0, display:'flex' }}>
                {showCon ? <EyeOff size={15}/> : <Eye size={15}/>}
              </button>
            </div>
            {confirm && (
              <div style={{ fontSize:11.5, marginTop:5, color: match ? '#059669' : '#DC2626', fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
                {match ? <CheckCircle size={12}/> : <Lock size={12}/>}
                {match ? 'Passwords match' : 'Passwords do not match'}
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            onClick={handleSave}
            disabled={!canSubmit}
            style={{
              marginTop:4, padding:'13px 24px', borderRadius:14, border:'none', cursor: canSubmit ? 'pointer' : 'not-allowed',
              background: canSubmit ? 'linear-gradient(135deg,#8F6807,#D4A017)' : 'var(--border)',
              color: canSubmit ? 'white' : 'var(--text-muted)',
              fontWeight:700, fontSize:14, fontFamily:'inherit',
              display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              transition:'all 0.2s', boxShadow: canSubmit ? '0 4px 14px rgba(184,134,11,0.35)' : 'none',
            }}>
            {saving ? (
              <><span style={{ width:14,height:14,border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'white',borderRadius:'50%',animation:'spin 0.8s linear infinite',display:'inline-block' }}/> Updating…</>
            ) : (
              <><ShieldCheck size={15}/> Update Password</>
            )}
          </button>
        </div>
      </div>

      {/* ── Tips card ── */}
      <div style={{ background:'var(--bg-alt)', border:'1px solid var(--border)', borderRadius:16, padding:'14px 18px' }}>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.07em', textTransform:'uppercase', marginBottom:10 }}>Password Tips</div>
        <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
          {[
            'Use at least 8 characters',
            'Mix uppercase, lowercase, numbers & symbols',
            'Avoid using your name or common words',
          ].map((tip, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:8, fontSize:12.5, color:'var(--text-sub)' }}>
              <div style={{ width:5, height:5, borderRadius:'50%', background:'#8F6807', flexShrink:0 }}/>
              {tip}
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
