'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { Eye, EyeOff, LogIn } from 'lucide-react'

export default function LoginPage() {
  const { login, loading, error: authError } = useAuth()
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  // Hide the auth error banner as soon as the user starts editing their
  // credentials — a stale "Invalid credentials" message while they're
  // already correcting the mistake is confusing and feels broken.
  const [dismissed, setDismissed] = useState(false)
  const error = dismissed ? null : authError

  async function handleSubmit(e) {
    e.preventDefault()
    setDismissed(false)
    const result = await login(email, password)
    if (result.ok) {
      if (result.role === 'driver') router.replace('/driver')
      else if (result.role === 'poc') router.replace('/dashboard/poc')
      else router.replace('/dashboard/overview')
    }
  }

  function handleEmailChange(e) { setEmail(e.target.value); setDismissed(true) }
  function handlePasswordChange(e) { setPassword(e.target.value); setDismissed(true) }

  return (
    <>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes fieldUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin   { to{transform:rotate(360deg)} }

        .login-field-1 { animation: fieldUp 0.4s 0.08s cubic-bezier(0.16,1,0.3,1) both; }
        .login-field-2 { animation: fieldUp 0.4s 0.14s cubic-bezier(0.16,1,0.3,1) both; }
        .login-field-3 { animation: fieldUp 0.4s 0.20s cubic-bezier(0.16,1,0.3,1) both; }

        .login-input {
          width: 100%;
          padding: 12px 16px;
          border: 1.5px solid var(--border-med);
          border-radius: var(--radius-sm);
          font-size: 14px;
          color: var(--text);
          background: var(--bg-alt);
          outline: none;
          transition: border-color var(--t-fast), box-shadow var(--t-fast), background var(--t-fast);
          box-sizing: border-box;
          font-family: inherit;
        }
        .login-input:focus {
          border-color: var(--gold);
          box-shadow: 0 0 0 3px rgba(184,134,11,0.12);
          background: var(--card);
        }
        .login-input::placeholder { color: var(--text-muted); }

        .sign-btn {
          width: 100%;
          padding: 13px;
          border: none;
          border-radius: var(--radius-sm);
          font-size: 14px;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all var(--t-base);
          background: linear-gradient(135deg, #B8860B 0%, #D4A017 100%);
          color: #fff;
          box-shadow: var(--shadow-gold);
        }
        .sign-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: var(--shadow-gold-lg);
        }
        .sign-btn:active:not(:disabled) { transform: translateY(0); }
        .sign-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        @media (max-width: 768px) {
          .left-panel  { display: none !important; }
          .right-panel { border-radius: 0 !important; }
          .login-wrap  { padding: 0 !important; }
        }
      `}</style>

      {/* ── Page wrapper ── */}
      <div className="login-wrap" style={{
        minHeight: '100vh',
        display: 'flex',
        background: 'var(--bg)',
        padding: 20,
        gap: 20,
        boxSizing: 'border-box',
        alignItems: 'stretch',
      }}>

        {/* ══════════════ LEFT PANEL ══════════════ */}
        <div className="left-panel" style={{
          flex: '1 1 0',
          minWidth: 0,
          borderRadius: 20,
          overflow: 'hidden',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-md)',
          animation: 'fadeIn 0.5s ease',
        }}>

          {/* Award image — full bleed entire panel */}
          <img
            src="/award.jpeg"
            alt="Amazon Best Performance Award"
            style={{ width:'100%', height:'100%', objectFit:'cover', display:'block', position:'absolute', top:0, left:0 }}
            onError={e => { e.currentTarget.style.display='none' }}
          />
        </div>

        {/* ══════════════ RIGHT PANEL ══════════════ */}
        <div className="right-panel" style={{
          flex: '1 1 0',
          minWidth: 0,
          background: 'var(--card)',
          borderRadius: 20,
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '52px 48px',
          boxSizing: 'border-box',
          animation: 'fadeUp 0.5s ease',
        }}>
          <div style={{ width:'100%', maxWidth:380 }}>

            {/* Heading */}
            <div style={{ marginBottom:36 }}>
              <h1 style={{ fontWeight:800, fontSize:28, color:'var(--text)', margin:'0 0 8px', letterSpacing:'-0.03em' }}>
                Welcome back 👋
              </h1>
              <p style={{ fontSize:14, color:'var(--text-muted)', margin:0, lineHeight:1.5 }}>
                Sign in to your GCD Operations Dashboard to continue.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:20 }}>

              <div className="login-field-1">
                <label style={{ display:'block', fontSize:11.5, fontWeight:600, color:'var(--text-sub)', marginBottom:8, letterSpacing:'0.05em', textTransform:'uppercase' }}>
                  Email Address
                </label>
                <input
                  className="login-input"
                  type="email"
                  placeholder="you@goldencrescent.ae"
                  value={email}
                  onChange={handleEmailChange}
                  required
                  autoComplete="email"
                  autoFocus
                />
              </div>

              <div className="login-field-2">
                <label style={{ display:'block', fontSize:11.5, fontWeight:600, color:'var(--text-sub)', marginBottom:8, letterSpacing:'0.05em', textTransform:'uppercase' }}>
                  Password
                </label>
                <div style={{ position:'relative' }}>
                  <input
                    className="login-input"
                    type={showPw ? 'text' : 'password'}
                    placeholder="••••••••••"
                    value={password}
                    onChange={handlePasswordChange}
                    required
                    autoComplete="current-password"
                    style={{ paddingRight:46 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', display:'flex', padding:4 }}
                  >
                    {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
                  </button>
                </div>
              </div>

              {error && (
                <div className="fade" style={{ background:'var(--red-bg)', border:'1px solid var(--red-border)', borderRadius:10, padding:'11px 14px', fontSize:13, color:'var(--red)', display:'flex', alignItems:'center', gap:8 }}>
                  <span>⚠️</span> {error}
                </div>
              )}

              <button type="submit" className="sign-btn login-field-3" disabled={loading} style={{ marginTop:4 }}>
                {loading
                  ? <><span style={{ width:16, height:16, border:'2px solid rgba(255,255,255,0.4)', borderTopColor:'#fff', borderRadius:'50%', display:'inline-block', animation:'spin 0.7s linear infinite' }}/> Signing in…</>
                  : <><LogIn size={16}/> Sign In</>
                }
              </button>
            </form>

            <div className="login-field-3" style={{ marginTop:40, paddingTop:24, borderTop:'1px solid var(--border)', textAlign:'center' }}>
              <p style={{ fontSize:12, color:'var(--text-muted)', margin:0, lineHeight:1.7 }}>
                Authorized personnel only.<br/>
                Contact your administrator for access.
              </p>
            </div>
          </div>
        </div>

      </div>
    </>
  )
}