'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import { API } from '@/lib/api'
import { useStation } from './_components/poc-shared'
import {
  Clock, Users, Truck, Package, ArrowLeftRight, Smartphone,
  CalendarOff, Bell, ChevronRight, Radio, MapPin, AlertTriangle,
} from 'lucide-react'

const TODAY = () => new Date().toISOString().slice(0, 10)

const SECTIONS = [
  { id:'attendance', label:'Attendance',  icon:Clock,          color:'#10B981', href:'/dashboard/poc/attendance',  desc:'Log daily DA attendance & cycles' },
  { id:'das',        label:'DAs',         icon:Users,          color:'#8B5CF6', href:'/dashboard/poc/das',          desc:'Browse & manage delivery agents'  },
  { id:'fleet',      label:'Fleet',       icon:Truck,          color:'#3B82F6', href:'/dashboard/poc/fleet',        desc:'Vehicles, status & assignments'   },
  { id:'deliveries', label:'Deliveries',  icon:Package,        color:'#F97316', href:'/dashboard/poc/deliveries',   desc:'Track daily delivery numbers'     },
  { id:'handovers',  label:'Handovers',   icon:ArrowLeftRight, color:'#06B6D4', href:'/dashboard/poc/handovers',    desc:'Vehicle pickup & return forms'    },
  { id:'sims',       label:'SIM Cards',   icon:Smartphone,     color:'#0D9488', href:'/dashboard/poc/sims',         desc:'Manage & assign station SIMs'     },
  { id:'leaves',     label:'Leaves',      icon:CalendarOff,    color:'#EF4444', href:'/dashboard/poc/leaves',       desc:'Review & approve leave requests'  },
  { id:'notices',    label:'Notices',     icon:Bell,           color:'#6366F1', href:'/dashboard/poc/notices',      desc:'Station-wide announcements'       },
]

export default function POCHub() {
  const { user }  = useAuth()
  const { station, setStation, canSwitch } = useStation(user)
  const [date]    = useState(TODAY())
  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!station) return
    setLoading(true)
    const h = { headers: { Authorization: `Bearer ${localStorage.getItem('gcd_token')}` } }
    Promise.all([
      fetch(`${API}/api/attendance?date=${date}`, h).then(r => r.json()),
      fetch(`${API}/api/vehicles`, h).then(r => r.json()),
      fetch(`${API}/api/leaves?stage=all`, h).then(r => r.json()),
      fetch(`${API}/api/sims`, h).then(r => r.json()),
      fetch(`${API}/api/poc/announcements`, h).then(r => r.json()),
      fetch(`${API}/api/handovers/current?station_code=${station}`, h).then(r => r.json()),
      fetch(`${API}/api/employees`, h).then(r => r.json()),
      fetch(`${API}/api/deliveries?station=${station}`, h).then(r => r.json()),
    ]).then(([att, vehs, lvs, sims, anns, hvs, emps, delivs]) => {
      const stationAtt  = (att.attendance||[]).filter(a => a.station_code === station)
      const stationEmps = (emps.employees||[]).filter(e => e.station_code === station)
      const stationSims = (sims.sims||[]).filter(s => s.station_code === station)
      const stationVehs = (vehs.vehicles||[]).filter(v => v.station_code === station)
      const pendingLvs  = (lvs.leaves||[]).filter(l => l.poc_status === 'pending')
      const todayDelivs = (delivs.deliveries||[]).find(d => d.date === date)
      setStats({
        present:       stationAtt.filter(a => a.status==='present').length,
        absent:        stationAtt.filter(a => a.status==='absent').length,
        logged:        stationAtt.length,
        total_das:     stationEmps.length,
        earnings:      stationAtt.reduce((s,a) => s+parseFloat(a.earnings||0), 0),
        active_vehs:   stationVehs.filter(v => v.status==='active').length,
        total_vehs:    stationVehs.length,
        grounded:      stationVehs.filter(v => v.status!=='active').length,
        sims_free:     stationSims.filter(s => s.status==='available').length,
        sims_total:    stationSims.length,
        pending_leaves:pendingLvs.length,
        handovers:     (hvs.current||[]).length,
        notices:       (anns.announcements||[]).length,
        deliveries:    todayDelivs?.total || null,
      })
    }).catch(console.error).finally(() => setLoading(false))
  }, [station, date])

  function getSectionCount(id) {
    if (!stats) return null
    const m = {
      attendance: stats.present||null, das: stats.total_das||null,
      fleet: stats.active_vehs||null,  deliveries: stats.deliveries,
      handovers: stats.handovers||null, sims: stats.sims_total||null,
      leaves: stats.pending_leaves||null, notices: stats.notices||null,
    }
    return m[id]
  }

  function getSectionAlert(id) {
    if (!stats) return false
    if (id==='leaves' && stats.pending_leaves > 0) return true
    if (id==='fleet'  && stats.grounded > 0) return true
    return false
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18, animation:'slideUp 0.3s ease' }}>

      {/* ── Hero Banner ── */}
      <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:22, overflow:'hidden' }}>
        <div style={{ height:5, background:'linear-gradient(90deg,#B8860B 0%,#D4A017 40%,#F59E0B 70%,#B8860B 100%)' }}/>
        <div style={{ padding:'22px 24px' }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16, marginBottom:20 }}>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                <div style={{ width:9, height:9, borderRadius:'50%', background:'#10B981', boxShadow:'0 0 0 3px rgba(16,185,129,0.25)', animation:'pulse-dot 2s infinite' }}/>
                <span style={{ fontSize:11, color:'var(--text-muted)', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase' }}>Live Station</span>
              </div>
              <h1 style={{ fontWeight:900, fontSize:26, letterSpacing:'-0.03em', lineHeight:1.1, color:'var(--text)', margin:'0 0 8px 0', display:'flex', alignItems:'center', gap:10 }}>
                <Radio size={22} color="var(--gold)"/>
                POC Station
              </h1>
              <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:'var(--text-muted)', flexWrap:'wrap' }}>
                <MapPin size={13} color="var(--gold)"/>
                <span style={{ fontWeight:700, color:'var(--gold)' }}>{station}</span>
                <span>·</span>
                <span>{date}</span>
                {!loading && stats && <><span>·</span><span style={{ fontWeight:600 }}>{stats.total_das} DAs</span></>}
              </div>
              {canSwitch && (
                <div style={{ display:'flex', gap:6, marginTop:12 }}>
                  {['DDB1','DXE6'].map(s => (
                    <button key={s} onClick={() => setStation(s)}
                      style={{ padding:'5px 16px', borderRadius:20, border:`1.5px solid ${station===s?'#B8860B':'var(--border)'}`, background:station===s?'#FDF6E3':'var(--bg-alt)', color:station===s?'#B8860B':'var(--text-muted)', fontWeight:station===s?700:500, fontSize:12, cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s' }}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick stats */}
          {loading ? (
            <div className="four-kpi-grid">
              {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height:78, borderRadius:14 }}/>)}
            </div>
          ) : stats && (
            <div className="four-kpi-grid">
              {[
                { l:'Present Today',   v:stats.present,                      sub:`${stats.logged}/${stats.total_das} logged`,  c:'#10B981', bg:'#ECFDF5', bc:'#A7F3D0' },
                { l:'Active Vehicles', v:stats.active_vehs,                  sub:`${stats.grounded} down`,                     c:'#3B82F6', bg:'#EFF6FF', bc:'#BFDBFE' },
                { l:'Earnings Today',  v:`AED ${stats.earnings.toFixed(0)}`, sub:'attendance wages',                           c:'#B8860B', bg:'#FDF6E3', bc:'#F0D78C' },
                { l:'Pending Leaves',  v:stats.pending_leaves,               sub:'awaiting review',                            c:stats.pending_leaves>0?'#EF4444':'#10B981', bg:stats.pending_leaves>0?'#FEF2F2':'#ECFDF5', bc:stats.pending_leaves>0?'#FCA5A5':'#A7F3D0' },
              ].map(s => (
                <div key={s.l} style={{ background:s.bg, border:`1px solid ${s.bc}`, borderRadius:14, padding:'14px 10px', textAlign:'center' }}>
                  <div style={{ fontWeight:900, fontSize:s.v?.toString().startsWith('AED')?13:22, color:s.c, letterSpacing:'-0.02em', lineHeight:1.2 }}>{s.v}</div>
                  <div style={{ fontSize:9.5, color:s.c, opacity:0.75, fontWeight:600, marginTop:3, textTransform:'uppercase', letterSpacing:'0.04em' }}>{s.l}</div>
                  <div style={{ fontSize:9.5, color:s.c, opacity:0.55, marginTop:2 }}>{s.sub}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Section Cards ── */}
      <div>
        <div style={{ fontSize:10.5, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:12 }}>Sections</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(210px,1fr))', gap:10 }}>
          {SECTIONS.map((sec, i) => {
            const Icon     = sec.icon
            const count    = getSectionCount(sec.id)
            const hasAlert = getSectionAlert(sec.id)
            return (
              <Link key={sec.id} href={sec.href} style={{ textDecoration:'none', display:'block', animation:`slideUp 0.3s ${i*0.04}s ease both` }}>
                <div
                  className="poc-sec-card"
                  style={{ '--hover-border':sec.color+'55', '--hover-shadow':sec.color+'18', background:'var(--card)', border:'1px solid var(--border)', borderRadius:18, padding:'16px', cursor:'pointer', position:'relative', overflow:'hidden', height:'100%' }}>
                  <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:`linear-gradient(90deg,${sec.color},${sec.color}70)` }}/>
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:10, marginTop:4 }}>
                    <div style={{ width:42, height:42, borderRadius:13, background:`${sec.color}15`, border:`1.5px solid ${sec.color}28`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <Icon size={20} color={sec.color}/>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                      {hasAlert && <AlertTriangle size={14} color="#EF4444"/>}
                      {count != null && count > 0 && (
                        <span style={{ fontSize:12, fontWeight:800, color:sec.color, background:`${sec.color}15`, border:`1px solid ${sec.color}28`, borderRadius:20, padding:'2px 10px' }}>{count}</span>
                      )}
                    </div>
                  </div>
                  <div style={{ fontWeight:800, fontSize:14, color:'var(--text)', marginBottom:4 }}>{sec.label}</div>
                  <div style={{ fontSize:11.5, color:'var(--text-muted)', lineHeight:1.5, marginBottom:12 }}>{sec.desc}</div>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end' }}>
                    <span style={{ display:'flex', alignItems:'center', gap:3, fontSize:11.5, fontWeight:700, color:sec.color }}>Open <ChevronRight size={13}/></span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

    </div>
  )
}
