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
  '/dashboard/hr/compliance':             'Document Expiry',
  '/dashboard/hr/users':                  'User Accounts',
  '/dashboard/hr/admins':                 'Admin Accounts',
  '/dashboard/hr/handovers':              'Handovers',
  '/dashboard/hr/vehicle-inspection':     'Vehicle Inspection',
  '/dashboard/finance/payroll':           'Payroll',
  '/dashboard/finance/expenses':          'Expenses',
  '/dashboard/finance/petty-cash':        'Petty Cash',
  '/dashboard/finance/customers':         'Customers',
  '/dashboard/finance/sims':              'SIM Cards',
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

const ROLE_LABELS = {
  admin: 'Admin', manager: 'Manager', general_manager: 'Manager', hr: 'HR',
  accountant: 'Finance', poc: 'POC', driver: 'Driver',
}

// Exact match first, then the closest parent route — so detail pages like
// /dashboard/hr/employees/CSDSPL45/salary show "Employees", not "Dashboard".
function titleFor(pathname) {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  const parent = Object.keys(PAGE_TITLES)
    .filter(k => pathname.startsWith(k + '/'))
    .sort((a, b) => b.length - a.length)[0]
  return parent ? PAGE_TITLES[parent] : 'Dashboard'
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

  const title = titleFor(pathname)
  const roleLabel = ROLE_LABELS[user?.role] || user?.role
  const initials  = user?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '--'

  return (
    <header className="topbar">
      {/* Menu button — mobile only */}
      <button onClick={onMenuClick} className="btn btn-ghost btn-icon" id="mobile-menu-btn" aria-label="Open menu"
        style={{ display:'none', color:'var(--text-sub)', flexShrink:0 }}>
        <Menu size={20}/>
      </button>

      {/* Title */}
      <div style={{ flex:1, minWidth:0 }}>
        <h1 className="topbar-title" style={{ fontWeight:650, fontSize:17, color:'var(--text)', letterSpacing:'-0.02em', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', margin:0, lineHeight:1.25 }}>{title}</h1>
        <div className="topbar-date" style={{ fontSize:12, color:'var(--text-muted)', marginTop:1 }}>
          {dateStr}
        </div>
      </div>

      {/* Dark mode toggle */}
      <button onClick={toggleTheme} className="btn btn-ghost btn-icon" title={dark ? 'Light mode' : 'Dark mode'} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        style={{ color:'var(--text-sub)', flexShrink:0 }}>
        {dark ? <Sun size={17}/> : <Moon size={17}/>}
      </button>

      {/* Notification bell */}
      <NotificationBell userRole={user?.role}/>

      {/* Right side — combined user + sign-out pill */}
      <div style={{ width:1, height:24, background:'var(--border)', flexShrink:0, margin:'0 4px' }} className="hide-mobile"/>
      {/* User */}
      <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
        <div aria-hidden="true" style={{ width:34, height:34, borderRadius:'50%', background:'var(--gold)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12.5, fontWeight:600, color:'#fff', flexShrink:0, userSelect:'none' }}>
          {initials}
        </div>
        <div className="hide-mobile" style={{ lineHeight:1.25 }}>
          <div style={{ fontSize:13.5, fontWeight:600, color:'var(--text)' }}>{user?.name?.split(' ')[0]}</div>
          <div style={{ fontSize:12, color:'var(--text-muted)' }}>{roleLabel}</div>
        </div>
      </div>
      {/* Sign out */}
      <button onClick={signOut} className="btn btn-ghost" aria-label="Sign out" title="Sign out"
        style={{ color:'var(--text-sub)', gap:6, padding:'7px 10px', flexShrink:0 }}>
        <LogOut size={15}/><span className="hide-mobile">Sign out</span>
      </button>
    </header>
  )
}