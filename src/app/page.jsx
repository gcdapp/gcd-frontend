'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'

export default function Root() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return   // wait until auth is resolved
    if (user) {
      if (user.role === 'driver') router.replace('/driver')
      else if (user.role === 'poc') router.replace('/dashboard/poc')
      else router.replace('/dashboard/overview')
    } else {
      router.replace('/login')
    }
  }, [user, loading, router])

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#F8F7F4' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:48, height:48, borderRadius:14, background:'linear-gradient(135deg,#B8860B,#D4A017)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, margin:'0 auto 12px' }}>🌙</div>
        <div style={{ fontSize:13, color:'#A89880' }}>Loading…</div>
      </div>
    </div>
  )
}
