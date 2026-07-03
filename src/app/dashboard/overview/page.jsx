'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import {
  Users, Car, Wallet, ChevronRight, Smartphone,
  Receipt, ScrollText, Activity, Package, RefreshCw,
} from 'lucide-react'
import Link from 'next/link'
import { API } from '@/lib/api'

function hdr() { return { Authorization:`Bearer ${localStorage.getItem('gcd_token')}` } }
function fmt(n) { return Number(n||0).toLocaleString('en-US') }
function fmtAED(n) { return `AED ${fmt(n)}` }

function Skel({ w='100%', h=16, r=8 }) {
  return <span className="ov-sk" style={{ display:'block', width:w, height:h, borderRadius:r }}/>
}

const ECATS = [
  {v:'Parking',c:'#F59E0B'},{v:'Advances',c:'#10B981'},{v:'Air Tickets',c:'#3B82F6'},
  {v:'ENOC',c:'#EF4444'},{v:'Health Insurance',c:'#8B5CF6'},{v:'Idfy',c:'#EC4899'},
  {v:'Mobile Expenses',c:'#06B6D4'},{v:'Office Expenses',c:'#84CC16'},{v:'Petty Cash',c:'#F97316'},
  {v:'RTA Top-up',c:'#0EA5E9'},{v:'Vehicle Expenses',c:'#6366F1'},{v:'Vehicle Rent',c:'#7C3AED'},
  {v:'Visa Expenses',c:'#D97706'},{v:'Miscellaneous Expenses',c:'#94A3B8'},
]

export default function OverviewPage() {
  const { user } = useAuth()
  const router   = useRouter()

  useEffect(() => {
    if (user && user.role === 'poc') router?.replace('/dashboard/poc')
  }, [user, router])

  const [summary,        setSummary]        = useState(null)
  const [chart,          setChart]          = useState([])
  const [expenses,       setExpenses]       = useState([])
  const [simStats,       setSimStats]       = useState(null)
  const [simByStation,   setSimByStation]   = useState([])
  const [fleetStats,     setFleetStats]     = useState(null)
  const [pendingLetters, setPendingLetters] = useState([])
  const [mounted,        setMounted]        = useState(false)

  // Per-section loading flags — each resolves independently
  const [loadingExp,   setLoadingExp]   = useState(true)
  const [loadingSim,   setLoadingSim]   = useState(true)
  const [loadingChart, setLoadingChart] = useState(true)
  const [refreshing,   setRefreshing]   = useState(false)

  useEffect(() => { setMounted(true) }, [])

  // Derived: hero is "loading" until both fast aggregates arrive
  const loadingHero = summary === null || fleetStats === null

  const load = useCallback((isRefresh = false) => {
    const month = new Date().toISOString().slice(0, 7)
    const h = { headers: hdr() }

    if (isRefresh) setRefreshing(true)

    // Reset per-section flags
    setSummary(null); setFleetStats(null)
    setLoadingExp(true); setLoadingSim(true); setLoadingChart(true)

    // ── All 6 fire immediately in parallel ──
    // Each updates state as soon as IT resolves — no blocking on the slowest

    fetch(`${API}/api/analytics/summary`, h)
      .then(r => r.json()).then(setSummary)
      .catch(() => setSummary({}))

    fetch(`${API}/api/vehicles/stats`, h)
      .then(r => r.json()).then(d => {
        const vs = d.stats || {}
        setFleetStats({
          total:       parseInt(vs.total       || 0),
          active:      parseInt(vs.active      || 0),
          grounded:    parseInt(vs.grounded    || 0),
          maintenance: parseInt(vs.maintenance || 0),
        })
        if (isRefresh) setRefreshing(false)
      }).catch(() => { setFleetStats({ total:0, active:0, grounded:0, maintenance:0 }); setRefreshing(false) })

    fetch(`${API}/api/analytics/deliveries-chart?months=6`, h)
      .then(r => r.json()).then(d => { setChart(d.chart || []); setLoadingChart(false) })
      .catch(() => setLoadingChart(false))

    fetch(`${API}/api/expenses?month=${month}`, h)
      .then(r => r.json()).then(d => { setExpenses(d.expenses || []); setLoadingExp(false) })
      .catch(() => setLoadingExp(false))

    fetch(`${API}/api/sims/stats`, h)
      .then(r => r.json())
      .then(d => { setSimStats(d.stats||null); setSimByStation(d.by_station||[]); setLoadingSim(false) })
      .catch(() => setLoadingSim(false))

    fetch(`${API}/api/letters?status=pending&limit=5`, h)
      .then(r => r.json()).then(d => setPendingLetters(d.letters || []))
      .catch(() => {})
  }, [])

  useEffect(() => { load() }, [load])

  // Derived values
  const totalExp    = expenses.reduce((s,e) => s + Number(e.amount||0), 0)
  const pendingExp  = expenses.filter(e => e.status === 'pending').length
  const approvedExp = expenses.filter(e => e.status === 'approved').reduce((s,e) => s + Number(e.amount||0), 0)
  const rejectedExp = expenses.filter(e => e.status === 'rejected').length

  const byCat = ECATS.map(cat => ({
    name:  cat.v,
    value: expenses.filter(e => e.category === cat.v).reduce((s,e) => s + Number(e.amount||0), 0),
    color: cat.c,
  })).filter(c => c.value > 0).sort((a,b) => b.value - a.value)

  const totalEmp    = summary?.employees?.c        || 0
  const activeEmp   = summary?.employees?.active   || 0
  const onLeaveEmp  = summary?.employees?.on_leave || 0
  const inactiveEmp = Math.max(0, totalEmp - activeEmp - onLeaveEmp)

  const hour      = new Date().getHours()
  const greeting  = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = user?.name?.split(' ')[0] || ''
  const dateStr   = new Date().toLocaleDateString('en-AE', { weekday:'long', day:'numeric', month:'long', year:'numeric' })

  return (
    <>
      <style>{`
        @keyframes ov-sk-pulse { 0%,100%{opacity:.4} 50%{opacity:.8} }
        .ov-sk { background:rgba(255,255,255,0.12); animation:ov-sk-pulse 1.4s ease infinite; }
        .ov-sk-dark { background:var(--border); animation:ov-sk-pulse 1.4s ease infinite; }

        .ov-page { display:flex; flex-direction:column; gap:18px; animation:slideUp 0.3s ease; }

        /* ── Hero ── */
        .ov-hero {
          background: linear-gradient(135deg, #1a1200 0%, #3a2600 45%, #5c3d00 75%, #B8860B 100%);
          border-radius: 20px; padding: 28px 32px; position: relative; overflow: hidden;
        }
        .ov-hero-decor1 { position:absolute; top:-60px; right:-60px; width:260px; height:260px; border-radius:50%; background:rgba(255,255,255,0.03); pointer-events:none; }
        .ov-hero-decor2 { position:absolute; bottom:-40px; right:100px; width:160px; height:160px; border-radius:50%; background:rgba(184,134,11,0.08); pointer-events:none; }
        .ov-hero-decor3 { position:absolute; top:30px; left:50%; width:1px; height:calc(100% - 60px); background:rgba(255,255,255,0.04); pointer-events:none; }

        .ov-hero-top { display:flex; align-items:flex-start; gap:14px; margin-bottom:24px; }
        .ov-hero-icon { width:46px; height:46px; border-radius:14px; background:rgba(255,255,255,0.12); border:1.5px solid rgba(255,255,255,0.18); display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:2px; }
        .ov-hero-title { font-weight:900; font-size:22px; color:#fff; margin:0; letter-spacing:-0.03em; line-height:1.1; }
        .ov-hero-sub   { font-size:12px; color:rgba(255,255,255,0.5); margin:4px 0 0; }
        .ov-hero-actions { margin-left:auto; display:flex; align-items:center; gap:8px; }
        .ov-refresh-btn {
          display:flex; align-items:center; gap:5px; padding:7px 13px; border-radius:10px;
          border:1px solid rgba(255,255,255,0.15); background:rgba(255,255,255,0.08);
          color:rgba(255,255,255,0.7); font-size:12px; font-weight:600; cursor:pointer;
          font-family:inherit; transition:all 0.15s;
        }
        .ov-refresh-btn:hover { background:rgba(255,255,255,0.14); color:white; }

        /* ── KPI strip ── */
        .ov-kpi-strip { display:grid; grid-template-columns:repeat(4,1fr); gap:1px; background:rgba(255,255,255,0.10); border-radius:16px; overflow:hidden; }
        .ov-kpi       { background:rgba(0,0,0,0.20); padding:18px 22px; transition:background 0.15s; cursor:default; }
        .ov-kpi:hover { background:rgba(255,255,255,0.06); }
        .ov-kpi-val   { font-size:27px; font-weight:900; letter-spacing:-0.05em; line-height:1; transition:color 0.3s; }
        .ov-kpi-lbl   { font-size:11px; color:rgba(255,255,255,0.55); font-weight:600; margin-top:5px; }
        .ov-kpi-hint  { font-size:10px; color:rgba(255,255,255,0.30); margin-top:2px; }

        /* ── Alert banner ── */
        .ov-alert { display:flex; align-items:center; gap:14px; padding:15px 20px; border-radius:14px; border:2px solid #FDE68A; background:linear-gradient(135deg,#FFFBEB,#FEF3C7); text-decoration:none; transition:box-shadow 0.2s,transform 0.2s; cursor:pointer; }
        .ov-alert:hover { box-shadow:0 6px 24px rgba(180,130,0,0.2); transform:translateY(-1px); }

        /* ── Section card ── */
        .ov-card { background:var(--card); border:1px solid var(--border); border-radius:16px; overflow:hidden; }
        .ov-card-hd { padding:18px 20px; display:flex; align-items:flex-end; justify-content:space-between; gap:8px; border-bottom:1px solid var(--border); }
        .ov-card-hd-icon { width:34px; height:34px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .ov-card-title { font-weight:800; font-size:14px; color:var(--text); letter-spacing:-0.02em; margin:0; }
        .ov-card-sub   { font-size:11.5px; color:var(--text-muted); margin-top:3px; }
        .ov-viewall    { font-size:12px; font-weight:600; color:var(--gold); display:flex; align-items:center; gap:3px; white-space:nowrap; flex-shrink:0; }

        /* ── 2-col grid ── */
        .ov-two { display:grid; grid-template-columns:1fr 1fr; gap:16px; }

        /* ── 2×2 stat grid ── */
        .ov-stats { display:grid; grid-template-columns:1fr 1fr; gap:8px; padding:16px 20px; }
        .ov-stat  { border-radius:12px; padding:13px 14px; border:1px solid; }
        .ov-stat-val { font-weight:800; font-size:22px; letter-spacing:-0.05em; line-height:1; }
        .ov-stat-lbl { font-size:10.5px; font-weight:600; margin-top:3px; opacity:0.75; }

        /* ── Progress strip ── */
        .ov-strip { margin:0 20px 20px; padding:12px 16px; border-radius:12px; background:var(--bg-alt); border:1px solid var(--border); display:flex; align-items:center; gap:12px; }
        .ov-progress-head { display:flex; justify-content:space-between; align-items:baseline; }
        .ov-progress-name { font-size:12px; font-weight:700; color:var(--text); }
        .ov-progress-pct  { font-size:14px; font-weight:900; letter-spacing:-0.03em; }
        .ov-bar  { height:5px; border-radius:3px; background:var(--border); overflow:hidden; margin-top:7px; }
        .ov-fill { height:100%; border-radius:3px; transition:width 1.2s cubic-bezier(0.34,1.56,0.64,1); }

        /* ── Expense category list ── */
        .ov-cat { padding:0 20px 20px; display:flex; gap:16px; align-items:flex-start; }
        .ov-cat-rows { flex:1; display:flex; flex-direction:column; gap:8px; }
        .ov-cat-row  { display:flex; align-items:center; gap:8px; }
        .ov-cat-name { font-size:11.5px; color:var(--text-sub); flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .ov-cat-amt  { font-size:11.5px; font-weight:700; color:var(--text); flex-shrink:0; }

        /* ── SIM station blocks ── */
        .ov-station { margin:0 20px 10px; border-radius:12px; background:var(--bg-alt); border:1px solid var(--border); padding:14px 16px; }
        .ov-station:last-child { margin-bottom:20px; }

        /* ── Quick actions ── */
        .ov-qa-grid { display:grid; grid-template-columns:repeat(6,1fr); gap:10px; padding:16px 20px 20px; }
        .ov-qa-item { display:flex; flex-direction:column; align-items:center; gap:9px; padding:16px 8px; border-radius:14px; text-decoration:none; transition:all 0.18s; }

        /* ── Chart ── */
        .ov-chart { padding:4px 20px 20px; }

        /* ── Responsive ── */
        @media (max-width:1024px) {
          .ov-kpi-strip { grid-template-columns:repeat(2,1fr); }
          .ov-qa-grid   { grid-template-columns:repeat(4,1fr); }
        }
        @media (max-width:768px) {
          .ov-hero    { padding:20px 18px; border-radius:16px; }
          .ov-hero-top { flex-wrap:wrap; }
          .ov-hero-actions { margin-left:0; width:100%; justify-content:flex-end; }
          .ov-two     { grid-template-columns:1fr; }
          .ov-kpi-strip { grid-template-columns:repeat(2,1fr); }
          .ov-kpi-val   { font-size:22px; }
          .ov-kpi       { padding:14px 18px; }
          .ov-qa-grid   { grid-template-columns:repeat(3,1fr); }
        }
        @media (max-width:480px) {
          .ov-hero      { padding:18px 14px; }
          .ov-hero-title { font-size:18px; }
          .ov-kpi-val   { font-size:20px; }
          .ov-kpi       { padding:12px 14px; }
          .ov-stats     { gap:7px; padding:12px 14px; }
          .ov-strip     { margin:0 14px 14px; }
          .ov-cat       { padding:0 14px 14px; }
          .ov-station   { margin:0 14px 10px; }
          .ov-station:last-child { margin-bottom:14px; }
          .ov-card-hd   { padding:14px; }
          .ov-qa-grid   { grid-template-columns:repeat(3,1fr); gap:8px; padding:12px 14px 14px; }
          .ov-qa-item   { padding:12px 6px; }
          .ov-chart     { padding:4px 14px 14px; }
        }
      `}</style>

      <div className="ov-page">

        {/* ══ HERO ══════════════════════════════════════════════════ */}
        <div className="ov-hero">
          <div className="ov-hero-decor1"/>
          <div className="ov-hero-decor2"/>
          <div className="ov-hero-decor3"/>
          <div style={{ position:'relative' }}>

            {/* Top row */}
            <div className="ov-hero-top">
              <div className="ov-hero-icon">
                <Activity size={22} color="#FFD700"/>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <h1 className="ov-hero-title">{greeting}{firstName ? `, ${firstName}` : ''}</h1>
                <p className="ov-hero-sub">{dateStr} · Operations Overview</p>
              </div>
              <div className="ov-hero-actions">
                <button onClick={() => load(true)} className="ov-refresh-btn" disabled={loadingHero || refreshing}>
                  <RefreshCw size={12} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }}/>
                  Refresh
                </button>
              </div>
            </div>

            {/* KPI strip */}
            <div className="ov-kpi-strip">
              {[
                {
                  val:   loadingHero ? null : activeEmp,
                  lbl:   'Active DAs',
                  hint:  loadingHero ? '' : `of ${totalEmp} total`,
                  color: '#34D399',
                },
                {
                  val:   loadingHero ? null : (fleetStats?.active ?? 0),
                  lbl:   'Vehicles on Road',
                  hint:  loadingHero ? '' : `of ${fleetStats?.total ?? 0} fleet`,
                  color: '#38BDF8',
                },
                {
                  val:   loadingExp  ? null : fmtAED(totalExp),
                  lbl:   'Expenses This Month',
                  hint:  loadingExp  ? '' : `${pendingExp} pending approval`,
                  color: '#FCD34D',
                  small: true,
                },
                {
                  val:   pendingLetters.length,
                  lbl:   'Letters Pending',
                  hint:  'awaiting signature',
                  color: pendingLetters.length > 0 ? '#FCA5A5' : '#6EE7B7',
                },
              ].map(({ val, lbl, hint, color, small }) => (
                <div key={lbl} className="ov-kpi">
                  {val === null
                    ? <Skel w={60} h={27}/>
                    : <div className="ov-kpi-val kpi-val" style={{ color, fontSize: small ? 18 : undefined }}>{val}</div>}
                  <div className="ov-kpi-lbl">{lbl}</div>
                  {hint ? <div className="ov-kpi-hint">{hint}</div> : <div style={{ height:14 }}/>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ══ PENDING LETTERS ALERT ══════════════════════════════════ */}
        {pendingLetters.length > 0 && (
          <Link href="/dashboard/office/letters" className="ov-alert">
            <div style={{ width:44, height:44, borderRadius:12, background:'#FDE68A', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <ScrollText size={20} color="#92400E"/>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:800, fontSize:14, color:'#92400E', display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                {pendingLetters.length} Letter{pendingLetters.length > 1 ? 's' : ''} Awaiting Approval
                <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20, background:'#F59E0B', color:'#fff', whiteSpace:'nowrap' }}>ACTION REQUIRED</span>
              </div>
              <div style={{ fontSize:12, color:'#B45309', marginTop:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {pendingLetters.map(l => l.ref_no).join(' · ')}
                {' — '}{[...new Set(pendingLetters.map(l => l.created_by_name).filter(Boolean))].join(', ')}
              </div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:3, fontSize:12, fontWeight:700, color:'#92400E', flexShrink:0 }}>
              Review <ChevronRight size={14}/>
            </div>
          </Link>
        )}

        {/* ══ DELIVERY CHART ════════════════════════════════════════ */}
        <div className="ov-card">
          <div style={{ padding:'20px 24px 0', display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
            <div>
              <div className="ov-card-title">Delivery Trend — Last 6 Months</div>
              <div className="ov-card-sub">Project-wise comparison · DDB1 vs DXE6</div>
            </div>
            <div style={{ display:'flex', gap:8, flexShrink:0 }}>
              {[{c:'#F59E0B',label:'DDB1 (Pulser)'},{c:'#38BDF8',label:'DXE6 (CRET)'}].map(({ c, label }) => (
                <div key={label} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 11px', borderRadius:20, background:`${c}12`, border:`1px solid ${c}30` }}>
                  <div style={{ width:8, height:8, borderRadius:2, background:c }}/>
                  <span style={{ fontSize:11, color:c, fontWeight:700 }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ padding:'16px 12px 8px' }}>
            {loadingChart ? (
              <div style={{ padding:'20px 12px', display:'flex', flexDirection:'column', gap:8 }}>
                {[80,65,90,55,75,85].map((w,i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span className="ov-sk-dark" style={{ width:28, height:10, borderRadius:3 }}/>
                    <span className="ov-sk-dark" style={{ width:`${w}%`, height:22, borderRadius:6 }}/>
                  </div>
                ))}
              </div>
            ) : !mounted || chart.length === 0 ? (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'40px 24px', textAlign:'center' }}>
                <div style={{ width:52, height:52, borderRadius:16, background:'var(--bg-alt)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:12 }}>
                  <Package size={22} color="var(--text-muted)"/>
                </div>
                <div style={{ fontWeight:800, fontSize:15, color:'var(--text)', marginBottom:4 }}>No delivery data yet</div>
                <div style={{ fontSize:12.5, color:'var(--text-muted)' }}>Records will appear once deliveries are logged.</div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chart} barSize={22} barCategoryGap="36%" margin={{ top:8, right:8, left:0, bottom:0 }}>
                  <defs>
                    <linearGradient id="gradDDB1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#F59E0B" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#F59E0B" stopOpacity={0.5}/>
                    </linearGradient>
                    <linearGradient id="gradDXE6" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#38BDF8" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#38BDF8" stopOpacity={0.5}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 4" strokeOpacity={0.7}/>
                  <XAxis dataKey="month" tick={{ fontSize:11, fill:'var(--text-muted)', fontWeight:600, fontFamily:'inherit' }} axisLine={false} tickLine={false}
                    tickFormatter={v => { const [y,m] = v.split('-'); return new Date(+y,+m-1).toLocaleDateString('en-US',{month:'short'}) }}/>
                  <YAxis tick={{ fontSize:11, fill:'var(--text-muted)', fontFamily:'inherit' }} axisLine={false} tickLine={false} width={38}
                    tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}/>
                  <Tooltip
                    cursor={{ fill:'rgba(184,134,11,0.06)', rx:6 }}
                    contentStyle={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:12, fontSize:12, boxShadow:'0 8px 24px rgba(0,0,0,0.10)', padding:'10px 14px' }}
                    labelStyle={{ fontWeight:700, color:'var(--text)', marginBottom:6, fontSize:12 }}
                    labelFormatter={v => { const [y,m] = v.split('-'); return new Date(+y,+m-1).toLocaleDateString('en-US',{month:'long',year:'numeric'}) }}
                    formatter={(val, name) => [Number(val).toLocaleString(), name]}
                  />
                  <Bar dataKey="DDB1" name="DDB1 (Pulser)" fill="url(#gradDDB1)" radius={[7,7,0,0]}/>
                  <Bar dataKey="DXE6" name="DXE6 (CRET)"  fill="url(#gradDXE6)" radius={[7,7,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {chart.length > 0 && (() => {
            const totDDB1 = chart.reduce((s,r) => s + (r.DDB1||0), 0)
            const totDXE6 = chart.reduce((s,r) => s + (r.DXE6||0), 0)
            return (
              <div style={{ display:'flex', borderTop:'1px solid var(--border)', background:'var(--bg-alt)' }}>
                {[
                  { label:'Total DDB1',  value:totDDB1.toLocaleString(),          c:'#F59E0B' },
                  { label:'Total DXE6',  value:totDXE6.toLocaleString(),          c:'#38BDF8' },
                  { label:'Combined',    value:(totDDB1+totDXE6).toLocaleString(), c:'var(--text)' },
                ].map(({ label, value, c }) => (
                  <div key={label} style={{ flex:1, padding:'12px 20px', borderRight:'1px solid var(--border)', textAlign:'center' }}>
                    <div style={{ fontWeight:800, fontSize:16, color:c, letterSpacing:'-0.03em' }}>{value}</div>
                    <div style={{ fontSize:10.5, color:'var(--text-muted)', marginTop:2, fontWeight:600 }}>{label}</div>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>

        {/* ══ AGENTS + FLEET ════════════════════════════════════════ */}
        <div className="ov-two">

          {/* Delivery Agents */}
          <div className="ov-card">
            <div className="ov-card-hd">
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div className="ov-card-hd-icon" style={{ background:'#F59E0B18', border:'1px solid #F59E0B30' }}>
                  <Users size={16} color="#F59E0B"/>
                </div>
                <div>
                  <div className="ov-card-title">Delivery Agents</div>
                  <div className="ov-card-sub">
                    {loadingHero ? <span className="ov-sk-dark" style={{ display:'inline-block', width:80, height:11, borderRadius:4, verticalAlign:'middle' }}/> : `${totalEmp} total registered`}
                  </div>
                </div>
              </div>
              <Link href="/dashboard/hr/employees" className="ov-viewall">View all <ChevronRight size={12}/></Link>
            </div>
            <div className="ov-stats">
              {[
                { label:'Active',   value:activeEmp,   color:'#059669', bg:'#ECFDF5', border:'#A7F3D0' },
                { label:'On Leave', value:onLeaveEmp,  color:'#D97706', bg:'#FFFBEB', border:'#FCD34D' },
                { label:'Inactive', value:inactiveEmp, color:'#DC2626', bg:'#FEF2F2', border:'#FCA5A5' },
                { label:'Total',    value:totalEmp,    color:'#7C3AED', bg:'#F5F3FF', border:'#DDD6FE' },
              ].map(({ label, value, color, bg, border }) => (
                <div key={label} className="ov-stat" style={{ background:bg, borderColor:border }}>
                  {loadingHero ? <Skel w={48} h={22} r={6}/> : <div className="ov-stat-val kpi-val" style={{ color }}>{value}</div>}
                  <div className="ov-stat-lbl" style={{ color }}>{label}</div>
                </div>
              ))}
            </div>
            <div className="ov-strip">
              <div style={{ width:38, height:38, borderRadius:11, background:'#F59E0B18', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <Users size={17} color="#F59E0B"/>
              </div>
              <div style={{ flex:1 }}>
                <div className="ov-progress-head">
                  {loadingHero
                    ? <span className="ov-sk-dark" style={{ display:'inline-block', width:140, height:11, borderRadius:4 }}/>
                    : <span className="ov-progress-name">{activeEmp} active DAs across all stations</span>}
                  {!loadingHero && totalEmp > 0 && (
                    <span className="ov-progress-pct" style={{ color:'#F59E0B' }}>{Math.round(activeEmp/totalEmp*100)}%</span>
                  )}
                </div>
                <div className="ov-bar">
                  <div className="ov-fill" style={{ width:`${totalEmp>0?(activeEmp/totalEmp)*100:0}%`, background:'linear-gradient(90deg,#F59E0B,#FCD34D)' }}/>
                </div>
              </div>
            </div>
          </div>

          {/* Fleet Vehicles */}
          <div className="ov-card">
            <div className="ov-card-hd">
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div className="ov-card-hd-icon" style={{ background:'#38BDF818', border:'1px solid #38BDF830' }}>
                  <Car size={16} color="#38BDF8"/>
                </div>
                <div>
                  <div className="ov-card-title">Fleet Vehicles</div>
                  <div className="ov-card-sub">Active vehicle inventory</div>
                </div>
              </div>
              <Link href="/dashboard/poc/fleet" className="ov-viewall">View all <ChevronRight size={12}/></Link>
            </div>
            <div className="ov-stats">
              {[
                { label:'Active',      value:fleetStats?.active      ?? null, color:'#059669', bg:'#ECFDF5', border:'#A7F3D0' },
                { label:'Grounded',    value:fleetStats?.grounded    ?? null, color:'#DC2626', bg:'#FEF2F2', border:'#FCA5A5' },
                { label:'Maintenance', value:fleetStats?.maintenance ?? null, color:'#D97706', bg:'#FFFBEB', border:'#FCD34D' },
                { label:'Total',       value:fleetStats?.total       ?? null, color:'#7C3AED', bg:'#F5F3FF', border:'#DDD6FE' },
              ].map(({ label, value, color, bg, border }) => (
                <div key={label} className="ov-stat" style={{ background:bg, borderColor:border }}>
                  {value === null ? <Skel w={40} h={22} r={6}/> : <div className="ov-stat-val kpi-val" style={{ color }}>{value}</div>}
                  <div className="ov-stat-lbl" style={{ color }}>{label}</div>
                </div>
              ))}
            </div>
            <div className="ov-strip">
              <div style={{ width:38, height:38, borderRadius:11, background:'#38BDF818', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <Car size={17} color="#38BDF8"/>
              </div>
              <div style={{ flex:1 }}>
                <div className="ov-progress-head">
                  {fleetStats === null
                    ? <span className="ov-sk-dark" style={{ display:'inline-block', width:130, height:11, borderRadius:4 }}/>
                    : <span className="ov-progress-name">{fleetStats?.active ?? 0} vehicles active</span>}
                  {fleetStats !== null && fleetStats.total > 0 && (
                    <span className="ov-progress-pct" style={{ color:'#38BDF8' }}>{Math.round((fleetStats.active||0)/fleetStats.total*100)}%</span>
                  )}
                </div>
                <div className="ov-bar">
                  <div className="ov-fill" style={{ width:`${fleetStats?.total>0?((fleetStats.active||0)/fleetStats.total)*100:0}%`, background:'linear-gradient(90deg,#38BDF8,#7DD3FC)' }}/>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ══ EXPENSES + SIM CARDS ══════════════════════════════════ */}
        <div className="ov-two">

          {/* Expenses */}
          <div className="ov-card">
            <div className="ov-card-hd">
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div className="ov-card-hd-icon" style={{ background:'#10B98118', border:'1px solid #10B98130' }}>
                  <Receipt size={16} color="#10B981"/>
                </div>
                <div>
                  <div className="ov-card-title">Expenses This Month</div>
                  <div className="ov-card-sub">
                    {loadingExp ? <span className="ov-sk-dark" style={{ display:'inline-block', width:100, height:11, borderRadius:4, verticalAlign:'middle' }}/> : `${fmtAED(totalExp)} · ${pendingExp} pending`}
                  </div>
                </div>
              </div>
              <Link href="/dashboard/finance/expenses" className="ov-viewall">View all <ChevronRight size={12}/></Link>
            </div>
            <div className="ov-stats">
              {[
                { label:'Total',    value:fmtAED(totalExp),    color:'var(--text)', bg:'var(--bg-alt)', border:'var(--border)', sm:true },
                { label:'Approved', value:fmtAED(approvedExp), color:'#059669',     bg:'#ECFDF5',       border:'#A7F3D0',       sm:true },
                { label:'Pending',  value:pendingExp,           color:'#D97706',     bg:'#FFFBEB',       border:'#FCD34D' },
                { label:'Rejected', value:rejectedExp,          color:'#DC2626',     bg:'#FEF2F2',       border:'#FCA5A5' },
              ].map(({ label, value, color, bg, border, sm }) => (
                <div key={label} className="ov-stat" style={{ background:bg, borderColor:border }}>
                  {loadingExp ? <Skel w={sm?80:40} h={22} r={6}/> : <div className="ov-stat-val kpi-val" style={{ color, fontSize:sm?14:undefined }}>{value}</div>}
                  <div className="ov-stat-lbl" style={{ color }}>{label}</div>
                </div>
              ))}
            </div>
            {!loadingExp && mounted && byCat.length > 0 ? (
              <div className="ov-cat">
                <div style={{ flexShrink:0 }}>
                  <PieChart width={86} height={86}>
                    <Pie data={byCat} cx={40} cy={40} innerRadius={24} outerRadius={41} dataKey="value" strokeWidth={2} stroke="var(--card)">
                      {byCat.map((c,i) => <Cell key={i} fill={c.color}/>)}
                    </Pie>
                  </PieChart>
                </div>
                <div className="ov-cat-rows">
                  {byCat.slice(0,5).map(c => (
                    <div key={c.name} className="ov-cat-row">
                      <div style={{ width:8, height:8, borderRadius:2, background:c.color, flexShrink:0 }}/>
                      <span className="ov-cat-name">{c.name}</span>
                      <span className="ov-cat-amt">AED {fmt(c.value)}</span>
                    </div>
                  ))}
                  {byCat.length > 5 && <div style={{ fontSize:11, color:'var(--text-muted)', paddingLeft:16 }}>+{byCat.length-5} more categories</div>}
                </div>
              </div>
            ) : !loadingExp ? (
              <div style={{ padding:'20px', textAlign:'center', color:'var(--text-muted)', fontSize:12 }}>No expenses logged this month.</div>
            ) : (
              <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:8 }}>
                {[1,2,3].map(i => <span key={i} className="ov-sk-dark" style={{ height:14, borderRadius:6 }}/>)}
              </div>
            )}
          </div>

          {/* SIM Cards */}
          <div className="ov-card">
            <div className="ov-card-hd">
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div className="ov-card-hd-icon" style={{ background:'#8B5CF618', border:'1px solid #8B5CF630' }}>
                  <Smartphone size={16} color="#8B5CF6"/>
                </div>
                <div>
                  <div className="ov-card-title">SIM Card Inventory</div>
                  <div className="ov-card-sub">Fleet communication management</div>
                </div>
              </div>
              <Link href="/dashboard/poc/sims" className="ov-viewall">View all <ChevronRight size={12}/></Link>
            </div>
            <div className="ov-stats">
              {[
                { label:'Total SIMs',   value:simStats?.total     ?? null, color:'#7C3AED', bg:'#F5F3FF', border:'#DDD6FE' },
                { label:'Assigned',     value:simStats?.assigned  ?? null, color:'#D97706', bg:'#FFFBEB', border:'#FCD34D' },
                { label:'Available',    value:simStats?.available ?? null, color:'#059669', bg:'#ECFDF5', border:'#A7F3D0' },
                { label:'Monthly Cost', value:fmtAED(simStats?.monthly_cost||0), color:'#2563EB', bg:'#EFF6FF', border:'#BFDBFE', sm:true },
              ].map(({ label, value, color, bg, border, sm }) => (
                <div key={label} className="ov-stat" style={{ background:bg, borderColor:border }}>
                  {(loadingSim && value === null) ? <Skel w={sm?80:40} h={22} r={6}/> : <div className="ov-stat-val kpi-val" style={{ color, fontSize:sm?14:undefined }}>{value ?? '—'}</div>}
                  <div className="ov-stat-lbl" style={{ color }}>{label}</div>
                </div>
              ))}
            </div>
            {loadingSim ? (
              <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:10 }}>
                {[1,2].map(i => <span key={i} className="ov-sk-dark" style={{ height:68, borderRadius:12 }}/>)}
              </div>
            ) : simByStation.map(s => {
              const col = { DDB1:'#F59E0B', DXE6:'#38BDF8' }[s.station_code] || '#F59E0B'
              const pct = s.total > 0 ? Math.round(s.assigned/s.total*100) : 0
              return (
                <div key={s.station_code} className="ov-station">
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                    <div>
                      <div style={{ fontWeight:800, fontSize:14, color:col }}>{s.station_code}</div>
                      <div style={{ fontSize:10.5, color:'var(--text-muted)', marginTop:1 }}>{s.assigned} assigned / {s.total} total</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontWeight:900, fontSize:20, color:col, letterSpacing:'-0.04em' }}>{pct}%</div>
                      <div style={{ fontSize:10, color:'var(--text-muted)' }}>utilised</div>
                    </div>
                  </div>
                  <div className="ov-bar">
                    <div className="ov-fill" style={{ width:`${pct}%`, background:`linear-gradient(90deg,${col},${col}bb)` }}/>
                  </div>
                  <div style={{ display:'flex', gap:16, marginTop:8 }}>
                    <span style={{ fontSize:11, color:'var(--text-muted)' }}><span style={{ fontWeight:700, color:'#10B981' }}>{s.available||0}</span> available</span>
                    <span style={{ fontSize:11, color:'var(--text-muted)' }}><span style={{ fontWeight:700, color:'#7C3AED' }}>{fmtAED(s.monthly_cost||0)}</span>/mo</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ══ QUICK ACTIONS ═════════════════════════════════════════ */}
        <div className="ov-card">
          <div className="ov-card-hd">
            <div>
              <div className="ov-card-title">Quick Actions</div>
              <div className="ov-card-sub">Navigate to key sections instantly</div>
            </div>
          </div>
          <div className="ov-qa-grid">
            {[
              { l:'Employees', href:'/dashboard/hr/employees',    c:'#F59E0B', icon:Users },
              { l:'Payroll',   href:'/dashboard/finance/payroll', c:'#38BDF8', icon:Wallet },
              { l:'Expenses',  href:'/dashboard/finance/expenses',c:'#10B981', icon:Receipt },
              { l:'SIM Cards', href:'/dashboard/poc/sims',        c:'#A78BFA', icon:Smartphone },
              { l:'Fleet',     href:'/dashboard/poc/fleet',       c:'#06B6D4', icon:Car },
              { l:'Leaves',    href:'/dashboard/hr/leaves',       c:'#F97316', icon:ScrollText },
            ].map(({ l, href, c, icon:Icon }) => (
              <Link key={l} href={href} className="ov-qa-item"
                style={{ background:`${c}10`, border:`1px solid ${c}22` }}
                onMouseEnter={e => { e.currentTarget.style.background=`${c}1E`; e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.boxShadow=`0 8px 24px ${c}30` }}
                onMouseLeave={e => { e.currentTarget.style.background=`${c}10`; e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='' }}>
                <div style={{ width:46, height:46, borderRadius:14, background:`${c}18`, border:`1px solid ${c}30`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Icon size={20} color={c}/>
                </div>
                <span style={{ fontSize:11.5, fontWeight:700, color:c, textAlign:'center', lineHeight:1.3 }}>{l}</span>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </>
  )
}
