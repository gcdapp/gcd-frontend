'use client'
import { usePathname, useRouter } from 'next/navigation'
import { Menu, LogOut, Moon, Sun } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useEffect, useState } from 'react'
import NotificationBell from '@/components/layout/NotificationBell'

const PAGE_TITLES = {
  '/dashboard/overview':                  'Overview',
  '/dashboard/analytics':                 'Reports',
  '/dashboard/hr':                        'HR Hub',
  '/dashboard/hr/employees':              'Employees',
  '/dashboard/hr/leaves':                 'Leaves',
  '/dashboard/hr/documents':              'Documents',
  '/dashboard/hr/compliance':             'Compliance',
  '/dashboard/hr/users':                  'User Accounts',
  '/dashboard/hr/admins':                 'Admin Accounts',
  '/dashboard/hr/handovers':              'Handovers',
  '/dashboard/hr/vehicle-inspection':     'Vehicle Inspection',
  '/dashboard/finance/payroll':           'Payroll',
  '/dashboard/finance/expenses':          'Expenses',
  '/dashboard/finance/petty-cash':        'Petty Cash',
  '/dashboard/poc':                       'POC Station',
  '/dashboard/poc/das':                   'Delivery Agents',
  '/dashboard/poc/fleet':                 'Fleet',
  '/dashboard/poc/handovers':             'POC Handovers',
  '/dashboard/poc/leaves':                'POC Leaves',
  '/dashboard/poc/sims':                  'SIM Cards',
  '/dashboard/office':                    'Office Profile',
  '/dashboard/office/letters':            'Letters',
  '/dashboard/office/events':             'Events',
  '/dashboard/tasks':                     'Tasks',
  '/dashboard/backup':                    'Backup',
  '/dashboard/settings':                  'Settings',
  '/dashboard/performance':               'Performance',
  '/dashboard/roster':                    'Weekly Roster',
  '/dashboard/damage':                    'Damage Reports',
  '/dashboard/advances':                  'Salary Advances',
  '/dashboard/petty-cash':               'Petty Cash',
  '/dashboard/compliance':               'Compliance',
}

const ROLE_CFG = {
  admin:           { l:'Admin',    e:'👑' },
  manager:         { l:'Manager',  e:'⭐' },
  general_manager: { l:'Manager',  e:'🎯' },
  hr:              { l:'HR',       e:'👥' },
  accountant:      { l:'Finance',  e:'💰' },
  poc:             { l:'POC',      e:'📡' },
  driver:          { l:'Driver',   e:'🚗' },
}

export default function Topbar({ onMenuClick }) {
  const pathname = usePathname()
  const router   = useRouter()
  const { user, logout } = useAuth()

  function signOut() {
    try { logout() } catch(e) {}
    localStorage.removeItem('gcd_token')
    localStorage.removeItem('gcd_user')
    router.replace('/login')
  }

  const [dark, setDark] = useState(false)
  const [dateStr, setDateStr] = useState('')

  useEffect(() => {
    setDark(document.documentElement.getAttribute('data-theme') === 'dark')
    setDateStr(new Date().toLocaleDateString('en-AE',{weekday:'short',day:'numeric',month:'short',year:'numeric'}))
  }, [])

  function toggleTheme() {
    const next = !dark
    setDark(next)
    if (next) {
      document.documentElement.setAttribute('data-theme', 'dark')
      localStorage.setItem('gcd_theme', 'dark')
    } else {
      document.documentElement.removeAttribute('data-theme')
      localStorage.setItem('gcd_theme', 'light')
    }
  }

  const title = PAGE_TITLES[pathname] || 'Dashboard'
  const role  = ROLE_CFG[user?.role] || { l: user?.role, e: '👤' }

  return (
    <header className="topbar">
      {/* Menu button — mobile only */}
      <button onClick={onMenuClick} className="btn btn-ghost btn-icon" id="mobile-menu-btn"
        style={{ display:'none', color:'var(--text-sub)', flexShrink:0 }}>
        <Menu size={20}/>
      </button>

      {/* Title */}
      <div style={{ flex:1, minWidth:0 }}>
        <div className="topbar-title" style={{ fontWeight:700, fontSize:16, color:'var(--text)', letterSpacing:'-0.01em', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{title}</div>
        <div className="topbar-date" style={{ fontSize:10.5, color:'var(--text-muted)', marginTop:1 }}>
          {dateStr}
        </div>
      </div>

      {/* Dark mode toggle */}
      <button onClick={toggleTheme} className="btn btn-ghost btn-icon" title={dark ? 'Light mode' : 'Dark mode'}
        style={{ color:'var(--text-sub)', flexShrink:0 }}>
        {dark ? <Sun size={17}/> : <Moon size={17}/>}
      </button>

      {/* Notification bell */}
      <NotificationBell userRole={user?.role}/>

      {/* Right side — combined user + sign-out pill */}
      <div style={{ display:'flex', alignItems:'center', gap:0, flexShrink:0, background:'var(--card)', border:'1px solid var(--border)', borderRadius:28, boxShadow:'0 1px 4px rgba(0,0,0,0.06)', overflow:'hidden' }}>
        {/* Avatar — initials, not emoji */}
        <div style={{ width:34, height:34, margin:'4px 0 4px 4px', borderRadius:20, background:'linear-gradient(135deg,#B8860B,#D4A017)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, color:'#fff', letterSpacing:'-0.02em', flexShrink:0, userSelect:'none' }}>
          {user?.name?.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() || '--'}
        </div>
        {/* Name + role */}
        <div className="hide-mobile" style={{ padding:'0 10px 0 8px' }}>
          <div style={{ fontSize:12.5, fontWeight:700, color:'var(--text)', lineHeight:1.2 }}>{user?.name?.split(' ')[0]}</div>
          <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight:500 }}>{role.l}</div>
        </div>
        {/* Divider */}
        <div className="hide-mobile" style={{ width:1, height:22, background:'var(--border)', flexShrink:0 }}/>
        {/* Sign out */}
        <button onClick={signOut}
          style={{ display:'flex', alignItems:'center', gap:5, padding:'0 14px', height:42, background:'transparent', border:'none', color:'var(--red)', fontWeight:600, fontSize:12, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap', flexShrink:0, transition:'background 0.15s' }}
          onMouseEnter={e=>e.currentTarget.style.background='var(--red-bg)'}
          onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
          <LogOut size={13}/><span className="hide-mobile" style={{ marginLeft:2 }}>Sign Out</span>
        </button>
      </div>
    </header>
  )
}