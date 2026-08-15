'use client'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { analyticsApi } from '@/lib/api'
import { Tooltip, PieChart, Pie, Cell } from 'recharts'
import {
  Users, Wallet, AlertTriangle, Calendar,
  ChevronRight, ArrowUp, ArrowDown, TrendingUp,
  Receipt, CheckCircle
} from 'lucide-react'
import Link from 'next/link'

import { API } from '@/lib/api'
const SC  = { DDB1:'#F59E0B', DXE6:'#38BDF8' }
function hdr() { return { Authorization:`Bearer ${localStorage.getItem('gcd_token')}` } }
function fmt(n) { return Number(n||0).toLocaleString() }
function fmtAED(n) { return `AED ${fmt(n)}` }

/* ── Tooltip ─────────────────────────────────────────────────── */
function Tip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:10, padding:'8px 12px', boxShadow:'var(--shadow-md)', fontSize:12, fontFamily:'Poppins,sans-serif' }}>
      <div style={{ fontWeight:700, color:'var(--text-muted)', marginBottom:4 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color:p.color, fontWeight:600, display:'flex', gap:10, justifyContent:'space-between' }}>
          <span>{p.name}</span><strong>{typeof p.value==='number'&&p.value>999?fmt(p.value):p.value}</strong>
        </div>
      ))}
    </div>
  )
}

/* ── Section Header ──────────────────────────────────────────── */
function SH({ title, sub, right, href }) {
  return (
    <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:14, gap:8 }}>
      <div>
        <h2 style={{ fontWeight:800, fontSize:15, color:'var(--text)', margin:0, letterSpacing:'-0.02em' }}>{title}</h2>
        {sub && <p style={{ fontSize:11.5, color:'var(--text-muted)', margin:'2px 0 0' }}>{sub}</p>}
      </div>
      {(right || href) && (href
        ? <Link href={href} style={{ fontSize:12, fontWeight:600, color:'var(--gold)', display:'flex', alignItems:'center', gap:3, whiteSpace:'nowrap', textDecoration:'none' }}>View all <ChevronRight size={12}/></Link>
        : right
      )}
    </div>
  )
}

/* ── KPI Card ────────────────────────────────────────────────── */
function KPI({ icon:Icon, label, value, color, loading, delay=0, trend, sub }) {
  return (
    <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, padding:'16px', position:'relative', overflow:'hidden', transition:'all 0.2s' }}
      onMouseEnter={e=>{e.currentTarget.style.boxShadow='var(--shadow-md)';e.currentTarget.style.transform='translateY(-2px)'}}
      onMouseLeave={e=>{e.currentTarget.style.boxShadow='var(--shadow)';e.currentTarget.style.transform='none'}}>
      <div style={{ position:'absolute', right:-10, bottom:-10, width:60, height:60, borderRadius:'50%', background:`${color}12`, filter:'blur(8px)', pointerEvents:'none' }}/>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
        <div style={{ width:36, height:36, borderRadius:10, background:`${color}15`, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Icon size={16} color={color}/>
        </div>
        {trend != null && (
          <span style={{ fontSize:10.5, fontWeight:700, color:trend>=0?'#16A34A':'#DC2626', background:trend>=0?'#F0FDF4':'#FEF2F2', borderRadius:8, padding:'2px 7px', display:'flex', alignItems:'center', gap:2 }}>
            {trend>=0?<ArrowUp size={10}/>:<ArrowDown size={10}/>}{Math.abs(trend)}%
          </span>
        )}
      </div>
      {loading ? <div className="sk" style={{ height:24, width:'60%', marginBottom:5 }}/> : (
        <div style={{ fontWeight:800, fontSize:20, color:'var(--text)', letterSpacing:'-0.04em', lineHeight:1, marginBottom:4 }}>{value}</div>
      )}
      <div style={{ fontSize:11.5, fontWeight:600, color:'var(--text-muted)' }}>{label}</div>
      {sub && <div style={{ fontSize:10.5, color:color, fontWeight:600, marginTop:3 }}>{sub}</div>}
    </div>
  )
}

/* ── Mini bar ────────────────────────────────────────────────── */
function Bar2({ value, total, color }) {
  const pct = total > 0 ? Math.min(100, Math.round(value/total*100)) : 0
  return (
    <div style={{ height:5, background:'var(--bg-alt)', borderRadius:10, overflow:'hidden' }}>
      <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:10, transition:'width 1.2s ease' }}/>
    </div>
  )
}

/* ── Mobile Swiper ───────────────────────────────────────────── */
function Swiper({ items, render, peek='85vw' }) {
  const ref = useRef(null)
  const [idx, setIdx] = useState(0)
  function onScroll() {
    if (!ref.current) return
    const w = ref.current.firstChild?.offsetWidth || 200
    setIdx(Math.round(ref.current.scrollLeft / (w + 10)))
  }
  function go(i) {
    const w = ref.current?.firstChild?.offsetWidth || 200
    ref.current?.scrollTo({ left: i*(w+10), behavior:'smooth' })
  }
  return (
    <div>
      <div ref={ref} onScroll={onScroll} className="no-scroll"
        style={{ display:'flex', gap:10, overflowX:'auto', scrollSnapType:'x mandatory', WebkitOverflowScrolling:'touch', paddingBottom:4 }}>
        {items.map((item,i) => (
          <div key={i} style={{ minWidth:peek, maxWidth:peek, scrollSnapAlign:'start', flexShrink:0 }}>
            {render(item, i)}
          </div>
        ))}
      </div>
      {items.length > 1 && (
        <div style={{ display:'flex', justifyContent:'center', gap:5, marginTop:10 }}>
          {items.map((_,i) => (
            <button key={i} onClick={()=>go(i)} style={{ width:i===idx?20:6, height:6, borderRadius:3, background:i===idx?'var(--gold)':'rgba(184,134,11,0.2)', border:'none', cursor:'pointer', padding:0, transition:'all 0.3s' }}/>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Card wrapper ────────────────────────────────────────────── */
function Card({ children, style={} }) {
  return (
    <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, padding:'20px', ...style }}>
      {children}
    </div>
  )
}

const ECATS = [
  {v:'Parking',c:'#F59E0B'},{v:'Advances',c:'#10B981'},{v:'Air Tickets',c:'#3B82F6'},
  {v:'ENOC',c:'#EF4444'},{v:'Health Insurance',c:'#8B5CF6'},{v:'Idfy',c:'#EC4899'},
  {v:'Mobile Expenses',c:'#06B6D4'},{v:'Office Expenses',c:'#84CC16'},{v:'Pension',c:'#059669'},{v:'Petty Cash',c:'#F97316'},
  {v:'RTA Top-up',c:'#0EA5E9'},{v:'Vehicle Expenses',c:'#6366F1'},{v:'Vehicle Rent',c:'#7C3AED'},
  {v:'Visa Expenses',c:'#D97706'},{v:'Miscellaneous Expenses',c:'#94A3B8'},
]

/* ════════════════════════════════════════════════════════════
   ROLE DASHBOARDS — each only shows what's relevant
════════════════════════════════════════════════════════════ */

/* Admin / Manager — full view */
function AdminDashboard({ summary, loading, leaves, onApproveLeave, simStats, simByStation, expenses }) {
  const totalExp   = expenses.reduce((s,e)=>s+Number(e.amount||0),0)
  const pendingExp = expenses.filter(e=>e.status==='pending').length
  const approvedExp= expenses.filter(e=>e.status==='approved').reduce((s,e)=>s+Number(e.amount||0),0)

  const byCat = ECATS.map(cat=>({
    name:cat.v, value:expenses.filter(e=>e.category===cat.v).reduce((s,e)=>s+Number(e.amount||0),0), color:cat.c,
  })).filter(c=>c.value>0).sort((a,b)=>b.value-a.value)

  const byEmp = [...new Set(expenses.map(e=>e.emp_id))].map(id=>({
    id, name: expenses.find(e=>e.emp_id===id)?.emp_name||id,
    total: expenses.filter(e=>e.emp_id===id).reduce((s,e)=>s+Number(e.amount||0),0),
  })).sort((a,b)=>b.total-a.total).slice(0,5)

  const kpis = [
    { icon:Users,         label:'Active DAs',       value:summary?String(summary.employees?.active||0):'—',          color:'#F59E0B' },
    { icon:Wallet,        label:'Net Payroll',       value:summary?fmtAED(Number(summary.payroll?.base_total||0)+Number(summary.payroll?.bonus_total||0)-Number(summary.payroll?.ded_total||0)):'—', color:'#A78BFA' },
    { icon:AlertTriangle, label:'Compliance Alerts', value:summary?String(summary.compliance?.expired||0):'—',       color:'#F87171' },
    { icon:Calendar,      label:'Pending Leaves',   value:summary?String(summary.pending_leaves||0):'—',             color:'#FB923C' },
  ]

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>

      {/* KPIs */}
      <div>
        <SH title="Key Metrics" sub="Live operational snapshot"/>
        <div className="desk" style={{ gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
          {kpis.map((k,i)=><KPI key={k.label} {...k} loading={loading} delay={i*0.05}/>)}
        </div>
        <div className="mob">
          <Swiper items={kpis} peek="calc(50% - 15px)" render={(k,i)=><KPI {...k} loading={loading} delay={i*0.05}/>}/>
        </div>
      </div>

      {/* Expenses */}
      <Card>
        <SH title="Expenses This Month" sub={`${fmtAED(totalExp)} total · ${pendingExp} pending`} href="/dashboard/finance/expenses"/>
        <div className="r-grid-4" style={{ gap:10, marginBottom:16 }}>
          {[{l:'Total Spent',v:fmtAED(totalExp),c:'var(--text)'},{l:'Approved',v:fmtAED(approvedExp),c:'#10B981'},{l:'Pending',v:pendingExp,c:'#F59E0B'},{l:'Categories',v:byCat.length,c:'#A78BFA'}].map(s=>(
            <div key={s.l} style={{ textAlign:'center', padding:'12px 8px', borderRadius:12, background:'var(--bg-alt)', border:'1px solid var(--border)' }}>
              <div style={{ fontWeight:900, fontSize:17, color:s.c, letterSpacing:'-0.02em' }}>{s.v}</div>
              <div style={{ fontSize:10.5, color:'var(--text-muted)', fontWeight:600, marginTop:3 }}>{s.l}</div>
            </div>
          ))}
        </div>
        {byCat.length>0 ? (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }} className="three-col-glass">
            {/* Pie */}
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <div style={{ fontWeight:700, fontSize:13, color:'var(--text)' }}>By Category</div>
              <div style={{ display:'flex', justifyContent:'center' }}>
                <PieChart width={140} height={130}>
                  <Pie data={byCat} cx={65} cy={60} innerRadius={34} outerRadius={58} paddingAngle={3} dataKey="value">
                    {byCat.map((c,i)=><Cell key={c.name} fill={c.color}/>)}
                  </Pie>
                  <Tooltip content={<Tip/>}/>
                </PieChart>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                {byCat.slice(0,4).map(cc=>(
                  <div key={cc.name} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:5, minWidth:0 }}>
                      <div style={{ width:7,height:7,borderRadius:2,background:cc.color,flexShrink:0 }}/>
                      <span style={{ fontSize:10.5,color:'var(--text-sub)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{cc.name}</span>
                    </div>
                    <span style={{ fontSize:10.5,fontWeight:700,color:cc.color,flexShrink:0,marginLeft:4 }}>AED {fmt(cc.value)}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Top categories bars */}
            <div>
              <div style={{ fontWeight:700, fontSize:13, color:'var(--text)', marginBottom:12 }}>Top Categories</div>
              <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
                {byCat.slice(0,5).map(cc=>{
                  const pct=byCat[0]?.value>0?Math.round(cc.value/byCat[0].value*100):0
                  return (
                    <div key={cc.name}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                        <span style={{ fontSize:11,color:'var(--text-sub)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'60%' }}>{cc.name}</span>
                        <span style={{ fontSize:11,fontWeight:700,color:cc.color }}>AED {fmt(cc.value)}</span>
                      </div>
                      <Bar2 value={cc.value} total={byCat[0]?.value||1} color={cc.color}/>
                    </div>
                  )
                })}
              </div>
            </div>
            {/* Top spenders */}
            <div>
              <div style={{ fontWeight:700, fontSize:13, color:'var(--text)', marginBottom:12 }}>Top Spenders</div>
              {byEmp.length===0 ? <div style={{ fontSize:12,color:'var(--text-muted)',textAlign:'center',padding:20 }}>No data</div> : (
                <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
                  {byEmp.map((e,i)=>{
                    const COLORS=['#F59E0B','#6366F1','#10B981','#EF4444','#06B6D4']
                    const col=COLORS[i]||'#94A3B8'
                    return (
                      <div key={e.id}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                          <span style={{ fontSize:11,color:'var(--text-sub)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'60%' }}>{e.name}</span>
                          <span style={{ fontSize:11,fontWeight:700,color:col }}>AED {fmt(e.total)}</span>
                        </div>
                        <Bar2 value={e.total} total={byEmp[0]?.total||1} color={col}/>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ textAlign:'center', padding:30, color:'var(--text-muted)', fontSize:13 }}>No expense data this month</div>
        )}
      </Card>

      {/* Payroll */}
      <Card style={{ padding:'18px' }}>
        <SH title="Payroll This Month" href="/dashboard/finance/payroll"/>
        {[
          { l:'Base Salaries', v:Number(summary?.payroll?.base_total||0), c:'var(--text)' },
          { l:'Bonuses',       v:Number(summary?.payroll?.bonus_total||0),c:'#10B981' },
          { l:'Deductions',    v:Number(summary?.payroll?.ded_total||0),  c:'#EF4444' },
        ].map(s=>{
          const total=Number(summary?.payroll?.base_total||0)+Number(summary?.payroll?.bonus_total||0)
          return (
            <div key={s.l} style={{ marginBottom:13 }}>
              <div style={{ display:'flex',justifyContent:'space-between',marginBottom:5 }}>
                <span style={{ fontSize:12,color:'var(--text-sub)',fontWeight:500 }}>{s.l}</span>
                <span style={{ fontSize:12,fontWeight:700,color:s.c }}>{fmtAED(s.v)}</span>
              </div>
              <Bar2 value={s.v} total={total||1} color={s.c}/>
            </div>
          )
        })}
        <div style={{ background:'var(--amber-bg)',borderRadius:12,padding:'11px 14px',display:'flex',justifyContent:'space-between',alignItems:'center',border:'1px solid var(--amber-border)',marginTop:4 }}>
          <span style={{ fontSize:12.5,fontWeight:700,color:'var(--text)' }}>Net Total</span>
          <span style={{ fontWeight:900,fontSize:17,color:'var(--gold)' }}>
            {fmtAED(Number(summary?.payroll?.base_total||0)+Number(summary?.payroll?.bonus_total||0)-Number(summary?.payroll?.ded_total||0))}
          </span>
        </div>
      </Card>

      {/* SIM */}
      {simStats && (
        <Card style={{ padding:'18px' }}>
          <SH title="SIM Inventory" sub="Fleet communication" href="/dashboard/poc"/>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8, marginBottom:14 }}>
            {[{l:'Total',v:simStats.total||0,c:'var(--text)'},{l:'Assigned',v:simStats.assigned||0,c:'#F59E0B'},{l:'Available',v:simStats.available||0,c:'#10B981'},{l:'Cost/mo',v:fmtAED(simStats.monthly_cost),c:'#A78BFA'}].map(s=>(
              <div key={s.l} style={{ textAlign:'center',padding:'9px 6px',borderRadius:11,background:'var(--bg-alt)',border:'1px solid var(--border)' }}>
                <div style={{ fontWeight:900,fontSize:15,color:s.c }}>{s.v}</div>
                <div style={{ fontSize:10,color:'var(--text-muted)',fontWeight:600,marginTop:2 }}>{s.l}</div>
              </div>
            ))}
          </div>
          {simByStation.map(s=>{
            const col=SC[s.station_code]||'#F59E0B'
            return (
              <div key={s.station_code} style={{ marginBottom:8 }}>
                <div style={{ display:'flex',justifyContent:'space-between',marginBottom:3 }}>
                  <span style={{ fontSize:11.5,fontWeight:700,color:col }}>{s.station_code}</span>
                  <span style={{ fontSize:11,color:'var(--text-muted)' }}>{s.assigned}/{s.total}</span>
                </div>
                <Bar2 value={s.assigned} total={s.total||1} color={col}/>
              </div>
            )
          })}
        </Card>
      )}

      {/* Pending leaves */}
      {leaves?.length>0 && (
        <Card style={{ padding:'18px' }}>
          <SH title="Pending Approvals" sub="Awaiting final sign-off" href="/dashboard/hr/leaves"/>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {leaves.slice(0,5).map(l=>(
              <div key={l.id} style={{ background:'var(--bg-alt)',borderRadius:12,border:'1px solid var(--border)',overflow:'hidden' }}>
                <div style={{ padding:'10px 14px' }}>
                  <div style={{ fontWeight:700,fontSize:13,color:'var(--text)' }}>{l.name}</div>
                  <div style={{ fontSize:11,color:'var(--text-muted)',marginTop:2 }}>{l.type} · {l.from_date} → {l.to_date} · {l.days} days</div>
                </div>
                <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:1,background:'var(--border)' }}>
                  <button onClick={()=>onApproveLeave(l.id,'approved')} style={{ padding:'9px',background:'var(--green-bg)',border:'none',color:'var(--green)',fontWeight:700,fontSize:12,cursor:'pointer',fontFamily:'Poppins,sans-serif' }}>✓ Approve</button>
                  <button onClick={()=>onApproveLeave(l.id,'rejected')} style={{ padding:'9px',background:'var(--red-bg)',border:'none',color:'var(--red)',fontWeight:700,fontSize:12,cursor:'pointer',fontFamily:'Poppins,sans-serif' }}>✕ Reject</button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

/* General Manager */
function GMDashboard({ summary, loading }) {
  const kpis = [
    { icon:Users,         label:'Total Staff',      value:summary?String(summary.employees?.c||0):'—',         color:'#F59E0B' },
    { icon:Calendar,      label:'Pending Leaves',   value:summary?String(summary.pending_leaves||0):'—',       color:'#FB923C' },
    { icon:AlertTriangle, label:'Compliance Alerts',value:summary?String(summary.compliance?.expired||0):'—',  color:'#F87171' },
  ]
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <div>
        <SH title="Operations Overview"/>
        <div className="desk" style={{ gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
          {kpis.map((k,i)=><KPI key={k.label} {...k} loading={loading} delay={i*0.05}/>)}
        </div>
        <div className="mob"><Swiper items={kpis} peek="calc(50% - 15px)" render={(k,i)=><KPI {...k} loading={loading}/>}/></div>
      </div>
    </div>
  )
}

/* HR */
function HRDashboard({ summary, loading }) {
  const kpis = [
    { icon:Users,         label:'Total Staff',     value:summary?String(summary.employees?.c||0):'—',        color:'#F59E0B' },
    { icon:CheckCircle,   label:'Active',           value:summary?String(summary.employees?.active||0):'—',  color:'#10B981' },
    { icon:Calendar,      label:'Pending Leaves',  value:summary?String(summary.pending_leaves||0):'—',      color:'#FB923C' },
    { icon:AlertTriangle, label:'Doc Alerts',       value:summary?String(summary.compliance?.expired||0):'—',color:'#EF4444' },
  ]
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <SH title="HR Overview" sub="Workforce at a glance"/>
      <div className="desk" style={{ gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
        {kpis.map((k,i)=><KPI key={k.label} {...k} loading={loading} delay={i*0.05}/>)}
      </div>
      <div className="mob"><Swiper items={kpis} peek="calc(50% - 15px)" render={(k,i)=><KPI {...k} loading={loading}/>}/></div>
      {summary && (
        <Card style={{ padding:'18px' }}>
          <SH title="Staff Summary"/>
          {[{l:'Total Employees',v:summary.employees?.c||0,c:'var(--text)'},{l:'Active',v:summary.employees?.active||0,c:'#10B981'},{l:'Compliance Alerts',v:summary.compliance?.expired||0,c:'#EF4444'}].map(s=>(
            <div key={s.l} style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'9px 12px',background:'var(--bg-alt)',borderRadius:10,marginBottom:7,border:'1px solid var(--border)' }}>
              <span style={{ fontSize:12.5,color:'var(--text-sub)' }}>{s.l}</span>
              <span style={{ fontWeight:900,fontSize:18,color:s.c }}>{s.v}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}

/* Accountant */
function AccountantDashboard({ summary, loading, expenses }) {
  const net = Number(summary?.payroll?.base_total||0)+Number(summary?.payroll?.bonus_total||0)-Number(summary?.payroll?.ded_total||0)
  const totalExp = expenses.reduce((s,e)=>s+Number(e.amount||0),0)
  const byCat = ECATS.map(cat=>({
    name:cat.v, value:expenses.filter(e=>e.category===cat.v).reduce((s,e)=>s+Number(e.amount||0),0), color:cat.c,
  })).filter(c=>c.value>0).sort((a,b)=>b.value-a.value)

  const kpis = [
    { icon:Wallet,        label:'Base Salaries',  value:fmtAED(summary?.payroll?.base_total),  color:'#F59E0B' },
    { icon:TrendingUp,    label:'Bonuses',         value:fmtAED(summary?.payroll?.bonus_total), color:'#10B981' },
    { icon:AlertTriangle, label:'Deductions',      value:fmtAED(summary?.payroll?.ded_total),   color:'#EF4444' },
    { icon:Wallet,        label:'Net Payroll',     value:fmtAED(net),                           color:'#A78BFA' },
    { icon:Receipt,       label:'Total Expenses',  value:loading?'—':fmtAED(totalExp),          color:'#F59E0B' },
  ]
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <div>
        <SH title="Finance Overview"/>
        <div className="desk" style={{ gridTemplateColumns:'repeat(5,1fr)', gap:10 }}>
          {kpis.map((k,i)=><KPI key={k.label} {...k} loading={loading} delay={i*0.05}/>)}
        </div>
        <div className="mob"><Swiper items={kpis} peek="calc(50% - 15px)" render={(k,i)=><KPI {...k} loading={loading}/>}/></div>
      </div>
      {byCat.length>0 && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }} className="two-col-glass">
          <Card style={{ padding:'18px' }}>
            <SH title="Expense Breakdown" sub="By category this month"/>
            <div style={{ display:'flex', alignItems:'center', gap:14 }}>
              <PieChart width={130} height={130}>
                <Pie data={byCat} cx={60} cy={60} innerRadius={35} outerRadius={58} paddingAngle={3} dataKey="value">
                  {byCat.map((c,i)=><Cell key={c.name} fill={c.color}/>)}
                </Pie>
                <Tooltip content={<Tip/>}/>
              </PieChart>
              <div style={{ flex:1, display:'flex', flexDirection:'column', gap:6 }}>
                {byCat.slice(0,5).map(c=>(
                  <div key={c.name} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:5, minWidth:0 }}>
                      <div style={{ width:7,height:7,borderRadius:2,background:c.color,flexShrink:0 }}/>
                      <span style={{ fontSize:10.5,color:'var(--text-sub)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{c.name}</span>
                    </div>
                    <span style={{ fontSize:10.5,fontWeight:700,color:c.color,flexShrink:0,marginLeft:4 }}>AED {fmt(c.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
          <Card style={{ padding:'18px' }}>
            <SH title="Top Categories" href="/dashboard/finance/expenses"/>
            <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
              {byCat.slice(0,5).map(c=>{
                const pct=byCat[0]?.value>0?Math.round(c.value/byCat[0].value*100):0
                return (
                  <div key={c.name}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                      <span style={{ fontSize:11,color:'var(--text-sub)' }}>{c.name}</span>
                      <span style={{ fontSize:11,fontWeight:700,color:c.color }}>AED {fmt(c.value)}</span>
                    </div>
                    <Bar2 value={c.value} total={byCat[0]?.value||1} color={c.color}/>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

/* POC */
function POCDashboard({ summary, loading }) {
  const kpis = [
    { icon:Users,   label:'My DAs',           value:summary?String(summary.employees?.active||0):'—', color:'#F59E0B' },
    { icon:Calendar,label:'On Leave',          value:summary?String(summary.pending_leaves||0):'—',   color:'#FB923C' },
  ]
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <div>
        <SH title="Station Overview"/>
        <div className="desk" style={{ gridTemplateColumns:'repeat(2,1fr)', gap:10 }}>
          {kpis.map((k,i)=><KPI key={k.label} {...k} loading={loading} delay={i*0.05}/>)}
        </div>
        <div className="mob"><Swiper items={kpis} peek="calc(50% - 15px)" render={(k,i)=><KPI {...k} loading={loading}/>}/></div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   ROOT PAGE
══════════════════════════════════════════════════════════════ */
export default function AnalyticsPage() {
  const [summary,      setSummary]      = useState(null)
  const [leaves,       setLeaves]       = useState([])
  const [loading,      setLoading]      = useState(true)
  const [userRole,     setUserRole]     = useState(null)
  const [simStats,     setSimStats]     = useState(null)
  const [simByStation, setSimByStation] = useState([])
  const [expenses,     setExpenses]     = useState([])

  const load = useCallback(async () => {
    let role = null
    try {
      const token = localStorage.getItem('gcd_token')
      if (token) { role = JSON.parse(atob(token.split('.')[1])).role; setUserRole(role) }
    } catch(e) {}
    setLoading(true)
    try { const sum = await analyticsApi.summary(); setSummary(sum); setLoading(false) }
    catch(e) { setLoading(false) }

    const month = new Date().toISOString().slice(0,7)
    fetch(`${API}/api/expenses?month=${month}`,{headers:hdr()}).then(r=>r.json()).then(d=>setExpenses(d.expenses||[])).catch(()=>{})
    fetch(`${API}/api/sims/stats`,{headers:hdr()}).then(r=>r.json()).then(d=>{setSimStats(d.stats||null);setSimByStation(d.by_station||[])}).catch(()=>{})
    if (['admin','general_manager','manager'].includes(role)) {
      fetch(`${API}/api/leaves?stage=pending`,{headers:hdr()}).then(r=>r.json()).then(d=>setLeaves(d.leaves||[])).catch(()=>{})
    }
  }, [])

  useEffect(()=>{load()},[load])

  async function handleApproveLeave(id, status) {
    await fetch(`${API}/api/leaves/${id}/manager`,{method:'PATCH',headers:{'Content-Type':'application/json',...hdr()},body:JSON.stringify({status})})
    load()
  }

  const role = userRole

  if (loading && !summary) return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <div className="sk" style={{ height:40, borderRadius:12, width:'40%' }}/>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:10 }}>
        {Array(6).fill(0).map((_,i)=><div key={i} className="sk" style={{ height:100, borderRadius:14 }}/>)}
      </div>
      <div className="sk" style={{ height:220, borderRadius:16 }}/>
      <div className="sk" style={{ height:180, borderRadius:16 }}/>
    </div>
  )

  const dashboards = {
    admin:           <AdminDashboard    summary={summary} loading={loading} leaves={leaves} onApproveLeave={handleApproveLeave} simStats={simStats} simByStation={simByStation} expenses={expenses}/>,
    manager:         <AdminDashboard    summary={summary} loading={loading} leaves={leaves} onApproveLeave={handleApproveLeave} simStats={simStats} simByStation={simByStation} expenses={expenses}/>,
    general_manager: <GMDashboard       summary={summary} loading={loading}/>,
    hr:              <HRDashboard       summary={summary} loading={loading}/>,
    accountant:      <AccountantDashboard summary={summary} loading={loading} expenses={expenses}/>,
    poc:             <POCDashboard      summary={summary} loading={loading}/>,
  }

  return dashboards[role] || dashboards.admin
}