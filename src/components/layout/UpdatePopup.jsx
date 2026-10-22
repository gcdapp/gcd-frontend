'use client'
// "What changed for you" popup — shows any unread notification of type 'update' for the
// signed-in user, one at a time, until they press "Got it". These are created per
// person with backend/scripts/notify-update.js whenever something is changed for them.
import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { API } from '@/lib/api'

function hdr() { return { Authorization: `Bearer ${localStorage.getItem('gcd_token')}` } }

export default function UpdatePopup() {
  const router = useRouter()
  const [updates, setUpdates] = useState([])

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/notifications`, { headers: hdr() })
      if (!res.ok) return
      const json = await res.json()
      // Oldest first, so several changes are read in the order they were made
      setUpdates((json.notifications || []).filter(n => n.type === 'update' && !n.read).reverse())
    } catch {}
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [load])

  const current = updates[0]
  if (!current) return null

  function dismiss(openUrl) {
    fetch(`${API}/api/notifications/${current.id}/read`, { method: 'PATCH', headers: hdr() }).catch(() => {})
    setUpdates(u => u.slice(1))
    if (openUrl) router.push(openUrl)
  }

  return createPortal(
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth:420, padding:0, overflow:'hidden' }}>
        <div style={{ padding:'22px 22px 6px', display:'flex', gap:12, alignItems:'flex-start' }}>
          <div style={{ width:40, height:40, borderRadius:12, background:'rgba(184,134,11,0.12)', border:'1px solid rgba(184,134,11,0.28)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <Sparkles size={18} color="#8F6807"/>
          </div>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#8F6807', textTransform:'uppercase', letterSpacing:'0.07em' }}>
              New for you{updates.length > 1 ? ` · 1 of ${updates.length}` : ''}
            </div>
            <h3 style={{ margin:'3px 0 0', fontSize:16, fontWeight:800, color:'var(--text)' }}>{current.title}</h3>
          </div>
        </div>
        {current.body && (
          <div style={{ padding:'8px 22px 0', fontSize:13, lineHeight:1.55, color:'var(--text-sub)', whiteSpace:'pre-line' }}>{current.body}</div>
        )}
        <div style={{ display:'flex', gap:10, padding:'18px 22px 20px' }}>
          {current.url && (
            <button onClick={() => dismiss(current.url)} className="btn btn-secondary" style={{ flex:1, justifyContent:'center' }}>Show me</button>
          )}
          <button onClick={() => dismiss()} className="btn btn-primary" style={{ flex:1, justifyContent:'center' }}>Got it</button>
        </div>
      </div>
    </div>,
    document.body
  )
}
