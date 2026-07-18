'use client'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { useAlerts } from '@/lib/AlertsContext'
import { NAV } from '@/lib/data'
import { useState } from 'react'
import {
  BarChart3, Users, DollarSign, UserCircle, Clock, CalendarOff,
  FileText, Wallet, Receipt, ChevronDown, Banknote,
  ShieldCheck, Radio, HardDrive, KeyRound, ChevronLeft, ChevronRight,
  Settings, Trophy, AlertTriangle, Calendar, Zap, LayoutDashboard,
  Truck, Smartphone, Shield, Package, Bell, Building2, ClipboardCheck,
  ArrowLeftRight, ScrollText, CalendarDays, ClipboardList,
} from 'lucide-react'


const ICONS = {
  BarChart3, Users, DollarSign, UserCircle, Clock, CalendarOff,
  FileText, Wallet, Receipt, ShieldCheck, Radio, HardDrive, KeyRound,
  Settings, Trophy, AlertTriangle, Calendar, Zap, LayoutDashboard,
  Truck, Smartphone, Shield, Package, Bell, Banknote, Building2, ClipboardCheck,
  ArrowLeftRight, ScrollText, CalendarDays, ClipboardList,
}

const ROLE_LABELS = {
  admin:           'Admin',
  general_manager: 'Manager',
  hr:              'HR',
  accountant:      'Accountant',
  poc:             'POC',
  driver:          'Driver',
}

export default function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }) {
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const { counts = {} } = useAlerts()
  const [expanded, setExpanded] = useState({})

  function isChildActive(href) {
    const [path, qs] = href.split('?')
    if (pathname !== path && !pathname.startsWith(path + '/')) return false
    if (!qs) return true
    const params = new URLSearchParams(qs)
    for (const [k, v] of params.entries()) {
      if (searchParams.get(k) !== v) return false
    }
    return true
  }

  function toggle(href) { setExpanded(p => ({ ...p, [href]: !p[href] })) }

  // Filter out manager role from nav visibility — admin handles everything manager did
  const nav = NAV.filter(item => !item.roles || item.roles.includes(user?.role))

  // Active: exact match, OR prefix match only when no sibling nav item is a closer match
  const navHrefs = nav.filter(n => n.href).map(n => n.href)
  function isItemActive(href) {
    if (pathname === href) return true
    if (!pathname.startsWith(href + '/')) return false
    return !navHrefs.some(other => other !== href && other.startsWith(href + '/') && (pathname === other || pathname.startsWith(other + '/')))
  }

  return (
    <>
      {mobileOpen && <div className="sidebar-overlay" onClick={() => setMobileOpen(false)}/>}

      <aside className={`sidebar${collapsed?' collapsed':''}${mobileOpen?' mobile-open':''}`}>

        {/* ── Logo ── */}
        <div className="sidebar-logo">
          <div style={{ display:'flex', alignItems:'center', justifyContent: collapsed?'center':'space-between', gap:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, overflow:'hidden', minWidth:0 }}>
              {/* Logo image */}
              <img src="/logo.webp" alt="GCD" style={{ flexShrink:0, width:collapsed?34:38, height:collapsed?34:38, borderRadius:10, objectFit:'contain', display:'block', transition:'width 0.2s,height 0.2s' }}/>
              {/* Brand text — hidden when collapsed */}
              {!collapsed && (
                <div style={{ minWidth:0, overflow:'hidden' }}>
                  <div style={{ fontWeight:800, fontSize:13.5, color:'var(--text)', letterSpacing:'-0.02em', lineHeight:1.2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                    Golden Crescent
                  </div>
                  <div style={{ fontSize:9, color:'var(--gold)', fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase', marginTop:1 }}>
                    Operations
                  </div>
                </div>
              )}
            </div>
            {/* Collapse toggle — desktop only */}
            <button onClick={() => setCollapsed(p => !p)}
              className="sidebar-collapse-btn"
              style={{ flexShrink:0, width:26, height:26, borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-alt)', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'var(--text-muted)' }}
              title={collapsed?'Expand':'Collapse'}>
              {collapsed ? <ChevronRight size={13}/> : <ChevronLeft size={13}/>}
            </button>
          </div>
        </div>

        {/* ── User chip ── */}
        {!collapsed && user && (
          <div style={{ margin:'8px 10px', padding:'9px 11px', background:'var(--bg-alt)', borderRadius:11, border:'1px solid var(--border)' }}>
            <div style={{ fontWeight:700, fontSize:12.5, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {user.name}
            </div>
            <div style={{ fontSize:10.5, color:'var(--gold)', fontWeight:600, marginTop:1 }}>
              {ROLE_LABELS[user.role] || user.role}{user.station_code ? ` · ${user.station_code}` : ''}
            </div>
          </div>
        )}

        {/* ── Nav ── */}
        <nav style={{ flex:1, paddingTop:4, paddingBottom:12, overflowY:'auto', overflowX:'hidden' }}>
          {nav.map((item, i) => {
            // Section divider
            if (item.type === 'section') {
              if (collapsed) return null
              return (
                <div key={`section-${item.label}`} style={{ fontSize:9, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.1em', textTransform:'uppercase', padding:'14px 14px 4px', marginTop:2 }}>
                  {item.label}
                </div>
              )
            }

            const Icon       = ICONS[item.icon]
            const isActive   = isItemActive(item.href)
            const isExpanded = expanded[item.href]
            const hasKids    = item.children?.length > 0
            const itemBadge  = item.alertKey ? (counts[item.alertKey] || 0) : 0

            return (
              <div key={item.href}>
                {hasKids ? (<>
                  <div className={`nav-item${isActive?' active':''}`}
                    onClick={() => !collapsed && toggle(item.href)}
                    style={{ userSelect:'none', cursor:'pointer' }}>
                    {Icon && <Icon size={16}/>}
                    <span className="nav-label" style={{ flex:1 }}>{item.label}</span>
                    {itemBadge > 0 && (
                      <span style={{ minWidth:17, height:17, borderRadius:9, background:'#EF4444', color:'white', fontSize:10, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 4px', flexShrink:0 }}>
                        {itemBadge > 99 ? '99+' : itemBadge}
                      </span>
                    )}
                    {!collapsed && (
                      <ChevronDown size={12} style={{ transition:'transform 0.2s', transform:isExpanded?'rotate(180deg)':'none', opacity:0.4, flexShrink:0 }}/>
                    )}
                  </div>
                  <div style={{ overflow:'hidden', maxHeight: collapsed?0 : isExpanded?'500px':'0', transition:'max-height 0.3s ease' }}>
                    {item.children
                      ?.filter(c => !c.roles || c.roles.includes(user?.role))
                      .filter(c => !c.roles || !c.roles.every(r => r === 'manager'))
                      .map(child => {
                        const CIcon      = ICONS[child.icon]
                        const active     = isChildActive(child.href)
                        const childBadge = child.alertKey ? (counts[child.alertKey] || 0) : 0
                        return (
                          <Link key={child.href} href={child.href}
                            className={`nav-item${active?' active':''}`}
                            style={{ paddingLeft: collapsed?undefined:34, fontSize:12.5 }}
                            onClick={() => setMobileOpen(false)}>
                            {CIcon && <CIcon size={13} style={{ opacity:0.7 }}/>}
                            <span className="nav-label" style={{ flex:1 }}>{child.label}</span>
                            {childBadge > 0 && (
                              <span style={{ minWidth:16, height:16, borderRadius:8, background:'#EF4444', color:'white', fontSize:9, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 4px', flexShrink:0 }}>
                                {childBadge > 99 ? '99+' : childBadge}
                              </span>
                            )}
                          </Link>
                        )
                    })}
                  </div>
                </>) : (
                  <Link href={item.href}
                    className={`nav-item${isActive?' active':''}`}
                    onClick={() => setMobileOpen(false)}>
                    {Icon && <Icon size={16}/>}
                    <span className="nav-label">{item.label}</span>
                  </Link>
                )}
              </div>
            )
          })}
        </nav>

      </aside>
    </>
  )
}