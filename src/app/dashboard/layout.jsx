'use client'
import React, { Component, useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { AlertsProvider } from '@/lib/AlertsContext'
import Sidebar from '@/components/layout/Sidebar'
import Topbar from '@/components/layout/Topbar'
import Link from 'next/link'
import { LayoutDashboard, Users, DollarSign, Radio, X } from 'lucide-react'

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'60px 24px', textAlign:'center' }}>
        <div style={{ fontSize:40, marginBottom:16 }}>⚠️</div>
        <div style={{ fontWeight:800, fontSize:18, color:'var(--text)', marginBottom:8 }}>Something went wrong</div>
        <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:20, maxWidth:400 }}>{this.state.error.message}</div>
        <button className="btn btn-primary" onClick={() => this.setState({ error: null })}>Try again</button>
      </div>
    )
    return this.props.children
  }
}

const BOTTOM_NAV = [
  { href:'/dashboard/overview',  icon:LayoutDashboard, label:'Overview',  roles:['admin','general_manager','hr','accountant','poc'] },
  { href:'/dashboard/hr',        icon:Users,        label:'HR',        roles:['admin','general_manager','hr'] },
  { href:'/dashboard/finance',   icon:DollarSign,   label:'Finance',   roles:['admin','accountant','manager','general_manager'] },
  { href:'/dashboard/poc',       icon:Radio,        label:'Station',   roles:['admin','general_manager','poc'] },
]


export default function DashboardLayout({ children }) {
  const { user, loading } = useAuth()
  const router   = useRouter()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed,  setCollapsed]  = useState(false)

  const POC_ALLOWED = [
    '/dashboard/poc',
    '/dashboard/hr/vehicle-inspection',
    '/dashboard/finance/petty-cash',
    '/dashboard/settings',
    '/dashboard/tasks',
  ]

  useEffect(() => {
    if (loading) return
    if (!user) router.replace('/login')
    else if (user.role === 'driver') router.replace('/driver')
    else if (user.role === 'poc') {
      const allowed = POC_ALLOWED.some(p => pathname === p || pathname.startsWith(p + '/'))
      if (!allowed) router.replace('/dashboard/poc')
    }
  }, [user, loading, router, pathname])


  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg,#F9FAFB)' }}>
      <div style={{ textAlign:'center' }}>
        <img src="/logo.webp" alt="GCD" style={{ width:80, height:80, objectFit:'contain', margin:'0 auto 14px', display:'block', borderRadius:16, animation:'logoPulse 1.5s ease-in-out infinite' }}/>
        <div style={{ fontSize:13,color:'#9CA3AF' }}>Loading…</div>
      </div>
    </div>
  )

  if (!user || user.role==='driver') return null

  return (
    <AlertsProvider>
    <div className="dashboard-shell">
      {/* Sidebar overlay for mobile */}
      {mobileOpen && <div className="sidebar-overlay" onClick={()=>setMobileOpen(false)}/>}

      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen}/>

      <div className="main-area">
        <Topbar onMenuClick={()=>setMobileOpen(o=>!o)}/>
        <main className="page-content">
<ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>

    </div>
    </AlertsProvider>
  )
}
