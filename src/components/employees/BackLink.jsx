'use client'
import { ChevronLeft } from 'lucide-react'

export default function BackLink({ href, label, router }) {
  return (
    <button onClick={() => router.push(href)}
      style={{ display:'flex', alignItems:'center', gap:6, alignSelf:'flex-start', background:'none', border:'none', color:'var(--text-muted)', fontSize:12.5, fontWeight:600, cursor:'pointer', padding:0, fontFamily:'inherit' }}>
      <ChevronLeft size={14}/> {label}
    </button>
  )
}
