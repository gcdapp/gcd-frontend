'use client'
import { DA_HERO_GRADIENT } from '@/lib/employees'

// Shared dark hero header for every page in the DA section (list, dashboard,
// edit, expenses, documents, salary) — same gradient everywhere by
// construction, so it can't drift the way it did when each page hand-rolled
// its own (the driver Expenses page ended up with a different gradient).
export default function PageHero({ icon: Icon, iconColor = '#60A5FA', iconBg = 'rgba(59,130,246,0.15)', iconBorder = 'rgba(59,130,246,0.35)', title, subtitle, actions, children }) {
  return (
    <div style={{ background: DA_HERO_GRADIENT, borderRadius: 16, padding: 24 }}>
      <div style={{ display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
        <div style={{ width:46, height:46, borderRadius:14, background:iconBg, border:`1.5px solid ${iconBorder}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          {Icon && <Icon size={22} color={iconColor}/>}
        </div>
        <div>
          <div style={{ fontWeight:900, fontSize:20, color:'white', letterSpacing:'-0.02em', lineHeight:1.1 }}>{title}</div>
          {subtitle && <div style={{ fontSize:12, color:'rgba(255,255,255,0.5)', marginTop:3 }}>{subtitle}</div>}
        </div>
        {actions && <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>{actions}</div>}
      </div>
      {children}
    </div>
  )
}
