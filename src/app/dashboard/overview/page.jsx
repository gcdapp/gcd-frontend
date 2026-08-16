'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { isAmazonOnlyScoped } from '@/lib/employees'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList } from 'recharts'
import {
  Users, Car, Wallet, ChevronRight, Smartphone,
  Receipt, ScrollText, Activity, RefreshCw,
} from 'lucide-react'
import Link from 'next/link'
import { API } from '@/lib/api'

function hdr() { return { Authorization:`Bearer ${localStorage.getItem('gcd_token')}` } }
function fmt(n) { return Number(n||0).toLocaleString('en-US') }
function fmtAED(n) { return `AED ${fmt(n)}` }

function Skel({ w='100%', h=16, r=8 }) {
  return <span className="ov-sk" style={{ display:'block', width:w, height:h, borderRadius:r }}/>
}

function KpiSpark() {
  return (
    <svg width="30" height="14" viewBox="0 0 30 14" fill="none" className="ov-kpi-spark" style={{flexShrink:0}}>
      <path d="M1 11 L7 6 L12 9 L18 3 L24 7 L29 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.55"/>
    </svg>
  )
}

const ECATS = [
  {v:'Parking',c:'#F59E0B'},{v:'Advances',c:'#10B981'},{v:'Air Tickets',c:'#3B82F6'},
  {v:'ENOC',c:'#EF4444'},{v:'Health Insurance',c:'#8B5CF6'},{v:'Idfy',c:'#EC4899'},
  {v:'Mobile Expenses',c:'#06B6D4'},{v:'Office Expenses',c:'#84CC16'},{v:'Pension',c:'#059669'},{v:'Petty Cash',c:'#F97316'},
  {v:'RTA Top-up',c:'#0EA5E9'},{v:'Vehicle Expenses',c:'#6366F1'},{v:'Vehicle Rent',c:'#7C3AED'},
  {v:'Visa Expenses',c:'#D97706'},{v:'Miscellaneous Expenses',c:'#94A3B8'},
]

export default function OverviewPage() {
  const { user } = useAuth()
  const router   = useRouter()
  // Vehicles are tracked purely by Amazon station (DDB1/DXE6) — a manager scoped
  // to specific client projects (Creative Packers, IG RAK, etc.) has no fleet of
  // their own, and Fleet is already hidden from their sidebar nav. Overview must
  // match that instead of independently leaking the whole company's fleet count.
  const isProjectScoped = Array.isArray(user?.assigned_projects) && user.assigned_projects.length > 0
  // A manager scoped to ONLY pulser/cret (Amazon-side — e.g. Iftikhar) is treated
  // differently from a client-project-scoped manager (e.g. Asma): they still see
  // the Expense Trend chart below, just locked to the Amazon view — see amazonLocked.
  const amazonLocked = isAmazonOnlyScoped(user?.assigned_projects)
  // Company-wide Expense Trend chart — open to every back-office role (Reports was
  // removed, Overview now covers that same audience: admin/general_manager/hr/
  // accountant) except a project-scoped manager, who must never see whole-company
  // numbers — unless they're Amazon-only scoped, who get the Amazon-locked slice of
  // it. Backend enforces this too, including the Amazon-only carve-out — see
  // GET /api/analytics/expenses-chart.
  const canSeeCompanyChart = (!isProjectScoped || amazonLocked) && ['admin','general_manager','hr','accountant'].includes(user?.role)

  useEffect(() => {
    if (user && user.role === 'poc') router?.replace('/dashboard/poc')
  }, [user, router])

  const [summary,        setSummary]        = useState(null)
  const [expChart,       setExpChart]       = useState([])
  // Combined = stacked Amazon + Other Projects (+ unattributed company spend);
  // the other two views isolate a single category's bars.
  const [expView,        setExpView]        = useState('combined')
  // user loads asynchronously (useAuth) — amazonLocked is false on first render
  // regardless of the real account, so this has to force the view once it resolves
  // rather than just seeding useState's initial value.
  useEffect(() => { if (amazonLocked) setExpView('amazon') }, [amazonLocked])
  // Same idea for the Delivery Agents card — Active/On Leave/Inactive/Total
  // broken down by Amazon vs Other Projects instead of always blended together.
  const [daView,         setDaView]         = useState('combined')
  const [expenses,       setExpenses]       = useState([])
  const [simStats,       setSimStats]       = useState(null)
  const [simByStation,   setSimByStation]   = useState([])
  const [fleetStats,     setFleetStats]     = useState(null)
  const [pendingLetters, setPendingLetters] = useState([])
  const [mounted,        setMounted]        = useState(false)

  // Per-section loading flags — each resolves independently
  const [loadingExp,   setLoadingExp]   = useState(true)
  const [loadingSim,   setLoadingSim]   = useState(true)
  const [loadingExpChart, setLoadingExpChart] = useState(true)
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
    setLoadingExp(true); setLoadingSim(true); setLoadingExpChart(true)

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

    // Company-wide total spend, unscoped by project — skip the call entirely for
    // anyone who can't see it (backend enforces this too) instead of firing a
    // request that will just 403. See canSeeCompanyChart above.
    if (canSeeCompanyChart) {
      fetch(`${API}/api/analytics/expenses-chart?months=12`, h)
        .then(r => r.json()).then(d => {
          // total_received mirrors the backend's own `total` (amazon+client spend)
          // so the Combined view's received bar can stack the same way.
          const chart = (d.chart || []).map(r => ({ ...r, total_received: (r.amazon_received||0) + (r.client_received||0) }))
          setExpChart(chart); setLoadingExpChart(false)
        })
        .catch(() => setLoadingExpChart(false))
    } else {
      setLoadingExpChart(false)
    }

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
  }, [user?.role, canSeeCompanyChart])

  useEffect(() => { load() }, [load])

  // Derived values — exclude expenses dated later than today (e.g. a forward-dated
  // advance) so these totals mean "spent so far this month," matching the Expense
  // Trend chart below instead of silently disagreeing with it by whatever forward-
  // dated amount happens to exist.
  const todayStr = new Date().toISOString().slice(0, 10)
  const expensesSoFar = expenses.filter(e => (e.date || '').slice(0, 10) <= todayStr)
  const totalExp    = expensesSoFar.reduce((s,e) => s + Number(e.amount||0), 0)
  const pendingExp  = expensesSoFar.filter(e => e.status === 'pending').length
  const approvedExp = expensesSoFar.filter(e => e.status === 'approved').reduce((s,e) => s + Number(e.amount||0), 0)
  const rejectedExp = expensesSoFar.filter(e => e.status === 'rejected').length

  const byCat = ECATS.map(cat => ({
    name:  cat.v,
    value: expensesSoFar.filter(e => e.category === cat.v).reduce((s,e) => s + Number(e.amount||0), 0),
    color: cat.c,
  })).filter(c => c.value > 0).sort((a,b) => b.value - a.value)

  const totalEmp    = summary?.employees?.c        || 0
  const activeEmp   = summary?.employees?.active   || 0
  const onLeaveEmp  = summary?.employees?.on_leave || 0
  const inactiveEmp = Math.max(0, totalEmp - activeEmp - onLeaveEmp)
  // Amazon vs Other Projects split — meaningless (and omitted) for a project-scoped
  // manager, whose /api/analytics/summary is already server-side filtered to just
  // their own projects.
  const amazonEmp  = summary?.employees?.amazon || 0
  const clientEmp  = summary?.employees?.client || 0
  // Delivery Agents card view — Active/On Leave/Inactive/Total for whichever
  // category is selected, instead of always showing the blended total.
  const daActiveAmazon    = summary?.employees?.active_amazon    || 0
  const daActiveClient    = summary?.employees?.active_client    || 0
  const daOnLeaveAmazon   = summary?.employees?.on_leave_amazon  || 0
  const daOnLeaveClient   = summary?.employees?.on_leave_client  || 0
  const daStats = daView === 'amazon'
    ? { active: daActiveAmazon, onLeave: daOnLeaveAmazon, total: amazonEmp }
    : daView === 'client'
    ? { active: daActiveClient, onLeave: daOnLeaveClient, total: clientEmp }
    : { active: activeEmp, onLeave: onLeaveEmp, total: totalEmp }
  const daInactive = Math.max(0, daStats.total - daStats.active - daStats.onLeave)

  const hour      = new Date().getHours()
  const greeting  = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = user?.name?.split(' ')[0] || ''
  const dateStr   = new Date().toLocaleDateString('en-AE', { weekday:'long', day:'numeric', month:'long', year:'numeric' })

  return (
    <>
      <style>{`
        .ov-sk, .ov-sk-dark {
          background: linear-gradient(90deg, var(--bg-alt) 25%, var(--border) 50%, var(--bg-alt) 75%);
          background-size: 300% 100%;
          animation: shimmer 1.2s ease-in-out infinite;
        }

        .ov-page {
          display:flex; flex-direction:column; gap:20px; animation:slideUp 0.3s ease;
          --ov-sky:#38BDF8; --ov-sky-bg:#EFF8FF; --ov-sky-border:#BAE6FD;
        }
        [data-theme="dark"] .ov-page { --ov-sky-bg:#08283F; --ov-sky-border:#0E4467; }

        /* ── Header ── */
        .ov-header { display:flex; align-items:center; gap:14px; flex-wrap:wrap; }
        .ov-header-icon { width:46px; height:46px; border-radius:16px; background:var(--gold-pale); border:1px solid var(--gold-border); color:var(--gold); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .ov-header-title { font-weight:900; font-size:22px; color:var(--text); margin:0; letter-spacing:-0.02em; line-height:1.1; }
        .ov-header-sub   { font-size:12px; color:var(--text-muted); margin:4px 0 0; }
        .ov-header-actions { margin-left:auto; display:flex; align-items:center; gap:8px; }
        .ov-refresh-btn {
          display:flex; align-items:center; gap:6px; padding:8px 14px; border-radius:20px;
          border:1.5px solid var(--border-med); background:var(--card); color:var(--text-muted);
          font-size:12px; font-weight:600; cursor:pointer; font-family:inherit;
          transition:background var(--t-fast), color var(--t-fast), border-color var(--t-fast), transform var(--t-fast);
        }
        .ov-refresh-btn:hover:not(:disabled)  { background:var(--bg-alt); color:var(--text); border-color:var(--border-strong); }
        .ov-refresh-btn:active:not(:disabled) { transform:scale(0.94); }
        .ov-refresh-btn:disabled { opacity:0.5; cursor:not-allowed; }

        /* ── KPI cards ── */
        .ov-kpi-cards       { display:grid; grid-template-columns:repeat(${isProjectScoped ? 3 : 4},1fr); gap:14px; }
        .ov-kpi-card        { background:linear-gradient(135deg,var(--ov-kpi-grad-a) 0%,var(--ov-kpi-grad-b) 100%); border:1px solid var(--ov-kpi-grad-b); border-radius:18px; box-shadow:var(--shadow); padding:18px 20px; transition:box-shadow var(--t-base),transform var(--t-base); }
        .ov-kpi-card:hover  { box-shadow:var(--shadow-md); transform:translateY(-2px); }
        .ov-kpi-card-top    { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
        .ov-kpi-badge       { width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0;
                               background:rgba(255,255,255,0.55); border:1px solid rgba(255,255,255,0.75); backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); box-shadow:0 2px 6px rgba(15,10,3,0.06); }
        [data-theme="dark"] .ov-kpi-badge { background:rgba(0,0,0,0.28); border-color:rgba(255,255,255,0.10); box-shadow:0 2px 6px rgba(0,0,0,0.35); }
        .ov-kpi-spark       { color:rgba(255,255,255,0.6); }
        [data-theme="dark"] .ov-kpi-spark { color:rgba(255,255,255,0.32); }
        .ov-kpi-card-val    { font-size:23px; font-weight:900; letter-spacing:-0.02em; color:var(--text); line-height:1.15; }
        .ov-kpi-card-val-sm { font-size:18px; }
        .ov-kpi-card-label  { font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:0.07em; color:var(--text-sub); margin-top:4px; }
        .ov-kpi-card-sub    { font-size:11px; color:var(--text-sub); margin-top:2px; font-weight:600; }

        /* ── Alert banner ── */
        .ov-alert { display:flex; align-items:center; gap:14px; padding:15px 20px; border-radius:18px; border:1px solid var(--amber-border); background:linear-gradient(135deg,#FFFBEB,#FEF3C7); text-decoration:none; transition:box-shadow var(--t-base),transform var(--t-base); cursor:pointer; }
        .ov-alert:hover  { box-shadow:0 6px 24px rgba(180,130,0,0.2); transform:translateY(-1px); }
        .ov-alert:active { transform:translateY(0) scale(0.995); transition-duration:var(--t-fast); }

        /* ── Pill tabs (Combined/Amazon/Other Projects switchers) ── */
        .ov-pill-tabs { display:flex; gap:3px; background:var(--bg-alt); border:1px solid var(--border); border-radius:24px; padding:3px; flex-shrink:0; }
        .ov-pill-tab  { padding:6px 14px; border-radius:20px; border:none; cursor:pointer; font-family:inherit; font-weight:700; font-size:11.5px; white-space:nowrap; color:var(--text-muted); background:transparent; transition:background var(--t-fast),color var(--t-fast),transform var(--t-fast); }
        .ov-pill-tab:hover:not(.active) { color:var(--text); }
        .ov-pill-tab:active { transform:scale(0.94); }

        /* ── Section card ── */
        .ov-card { background:var(--card); border:1px solid var(--border); border-radius:18px; overflow:hidden; animation:slideUp 0.35s ease both; transition:box-shadow 0.2s ease, border-color 0.2s ease, transform 0.2s ease; }
        .ov-card:hover { box-shadow:var(--shadow-lg); border-color:var(--border-strong,var(--border)); transform:translateY(-2px); }
        .ov-two > .ov-card:nth-child(2) { animation-delay:0.05s; }
        .ov-card-hd { padding:20px 22px; display:flex; align-items:flex-end; justify-content:space-between; gap:8px; border-bottom:1px solid var(--border); }
        .ov-card-hd-icon { width:34px; height:34px; border-radius:12px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .ov-card-title { font-weight:800; font-size:14px; color:var(--text); letter-spacing:-0.02em; margin:0; }
        .ov-card-sub   { font-size:11.5px; color:var(--text-muted); margin-top:3px; }
        .ov-viewall    { font-size:12px; font-weight:600; color:var(--gold); display:flex; align-items:center; gap:3px; white-space:nowrap; flex-shrink:0; }

        /* ── 2-col grid ── */
        .ov-two { display:grid; grid-template-columns:1fr 1fr; gap:18px; }

        /* ── 2×2 stat grid ── */
        .ov-stats { display:grid; grid-template-columns:1fr 1fr; gap:8px; padding:16px 20px; }
        .ov-stat  { border-radius:14px; padding:14px 16px; border:1px solid; }
        .ov-stat-val { font-weight:800; font-size:22px; letter-spacing:-0.05em; line-height:1; }
        .ov-stat-lbl { font-size:10.5px; font-weight:600; margin-top:3px; opacity:0.75; }

        /* ── Progress strip ── */
        .ov-strip { margin:0 20px 20px; padding:12px 16px; border-radius:14px; background:var(--bg-alt); border:1px solid var(--border); display:flex; align-items:center; gap:12px; }
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
        .ov-station { margin:0 20px 10px; border-radius:14px; background:var(--bg-alt); border:1px solid var(--border); padding:14px 16px; }
        .ov-station:last-child { margin-bottom:20px; }

        /* ── Quick actions ── */
        .ov-qa-grid { display:grid; grid-template-columns:repeat(6,1fr); gap:10px; padding:16px 20px 20px; }
        .ov-qa-item {
          display:flex; flex-direction:column; align-items:center; gap:9px; padding:16px 8px; border-radius:16px;
          text-decoration:none; background:var(--qa-bg); border:1px solid var(--qa-border);
          transition:background var(--t-base), transform var(--t-base), box-shadow var(--t-base);
        }
        .ov-qa-item:hover  { background:var(--qa-bg-h); transform:translateY(-3px); box-shadow:0 8px 24px var(--qa-shadow); }
        .ov-qa-item:active { transform:translateY(-1px) scale(0.96); transition-duration:var(--t-fast); }

        /* ── Chart ── */
        .ov-chart { padding:4px 20px 20px; }

        /* ── Responsive ── */
        @media (max-width:1024px) {
          .ov-kpi-cards { grid-template-columns:repeat(2,1fr); }
          .ov-qa-grid   { grid-template-columns:repeat(4,1fr); }
        }
        @media (max-width:768px) {
          .ov-header-actions { margin-left:0; width:100%; justify-content:flex-end; }
          .ov-two       { grid-template-columns:1fr; }
          .ov-qa-grid   { grid-template-columns:repeat(3,1fr); }
        }
        @media (max-width:480px) {
          .ov-header-title { font-size:18px; }
          .ov-kpi-cards { grid-template-columns:repeat(1,1fr); }
          .ov-kpi-card  { padding:14px 16px; }
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

        {/* ══ HEADER ════════════════════════════════════════════════ */}
        <div className="ov-header">
          <div className="ov-header-icon">
            <Activity size={22}/>
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <h1 className="ov-header-title">{greeting}{firstName ? `, ${firstName}` : ''}</h1>
            <p className="ov-header-sub">{dateStr} · Operations Overview</p>
          </div>
          <div className="ov-header-actions">
            <button onClick={() => load(true)} className="ov-refresh-btn" disabled={loadingHero || refreshing}>
              <RefreshCw size={12} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }}/>
              Refresh
            </button>
          </div>
        </div>

        {/* ══ KPI CARDS ═════════════════════════════════════════════ */}
        <div className="ov-kpi-cards">
          {[
            {
              val:   loadingHero ? null : activeEmp,
              lbl:   'Active DAs',
              hint:  loadingHero ? '' : `of ${totalEmp} total`,
              Icon:  Users, color:'var(--green)', bg:'var(--green-bg)', border:'var(--green-border)',
            },
            ...(isProjectScoped ? [] : [{
              val:   loadingHero ? null : (fleetStats?.active ?? 0),
              lbl:   'Vehicles on Road',
              hint:  loadingHero ? '' : `of ${fleetStats?.total ?? 0} fleet`,
              Icon:  Car, color:'var(--ov-sky)', bg:'var(--ov-sky-bg)', border:'var(--ov-sky-border)',
            }]),
            {
              val:   loadingExp  ? null : fmtAED(totalExp),
              lbl:   'Expenses This Month',
              hint:  loadingExp  ? '' : `${pendingExp} pending approval`,
              Icon:  Wallet, color:'var(--gold)', bg:'var(--gold-pale)', border:'var(--gold-border)', small:true,
            },
            {
              val:   pendingLetters.length,
              lbl:   'Letters Pending',
              hint:  'awaiting signature',
              Icon:  ScrollText,
              ...(pendingLetters.length > 0
                ? { color:'var(--red)',   bg:'var(--red-bg)',   border:'var(--red-border)' }
                : { color:'var(--green)', bg:'var(--green-bg)', border:'var(--green-border)' }),
            },
          ].map(({ val, lbl, hint, Icon, color, bg, border, small }, i) => (
            <div key={lbl} className="ov-kpi-card fade-up" style={{ '--ov-kpi-grad-a':bg, '--ov-kpi-grad-b':border, animationDelay:`${i*0.04}s` }}>
              <div className="ov-kpi-card-top">
                <div className="ov-kpi-badge" style={{color}}><Icon size={16}/></div>
                <KpiSpark/>
              </div>
              {val === null
                ? <div className="sk" style={{height:23,width:'55%',borderRadius:6,marginBottom:2}}/>
                : <div key={val} className={`ov-kpi-card-val kpi-val${small?' ov-kpi-card-val-sm':''}`}>{val}</div>}
              <div className="ov-kpi-card-label">{lbl}</div>
              {hint && <div className="ov-kpi-card-sub">{hint}</div>}
            </div>
          ))}
        </div>

        {/* ══ PENDING LETTERS ALERT ══════════════════════════════════ */}
        {pendingLetters.length > 0 && (
          <Link href="/dashboard/office/letters" className="ov-alert fade-up">
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

        {/* ══ EXPENSE CHART ═════════════════════════════════════════ */}
        {/* Company-wide spend total — matches the backend's /expenses-chart gate.
            A project-scoped manager must never see the whole org's spend. */}
        {canSeeCompanyChart && (
        <div className="ov-card">
          <div style={{ padding:'20px 24px 0', display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
            <div>
              <div className="ov-card-title">Expense Trend — Last 12 Months</div>
              <div className="ov-card-sub">
                {amazonLocked ? 'Amazon-side spend vs. amount received' : expView==='combined' ? 'Spend vs. amount received vs. payroll, by month' : expView==='amazon' ? 'Amazon-side spend vs. amount received' : 'Other Projects spend vs. amount received'}
              </div>
            </div>
            {/* Amazon-only-scoped accounts (Iftikhar) get locked to the Amazon view
                (forced above) with no switcher — there's nothing else for them to see. */}
            {!amazonLocked && (
              <div className="ov-pill-tabs">
                {[
                  { id:'combined', label:'Combined',        c:'#B8860B' },
                  { id:'amazon',   label:'Amazon',           c:'#3B82F6' },
                  { id:'client',   label:'Other Projects',  c:'#7C3AED' },
                ].map(v => (
                  <button key={v.id} onClick={()=>setExpView(v.id)} className={`ov-pill-tab${expView===v.id?' active':''}`}
                    style={{ background: expView===v.id ? v.c : undefined, color: expView===v.id ? 'white' : undefined }}>
                    {v.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ padding:'16px 12px 8px' }}>
            {loadingExpChart ? (
              <div style={{ padding:'20px 12px', display:'flex', flexDirection:'column', gap:8 }}>
                {[80,65,90,55,75,85].map((w,i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span className="ov-sk-dark" style={{ width:28, height:10, borderRadius:3 }}/>
                    <span className="ov-sk-dark" style={{ width:`${w}%`, height:22, borderRadius:6 }}/>
                  </div>
                ))}
              </div>
            ) : !mounted || expChart.length === 0 ? (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'40px 24px', textAlign:'center' }}>
                <div style={{ width:52, height:52, borderRadius:16, background:'var(--bg-alt)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:12 }}>
                  <Receipt size={22} color="var(--text-muted)"/>
                </div>
                <div style={{ fontWeight:800, fontSize:15, color:'var(--text)', marginBottom:4 }}>No expense data yet</div>
                <div style={{ fontSize:12.5, color:'var(--text-muted)' }}>Records will appear once expenses are logged.</div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={expChart} barSize={28} barCategoryGap="36%" margin={{ top:26, right:8, left:0, bottom:0 }}>
                  <defs>
                    <linearGradient id="gradAmazon" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#60A5FA" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#60A5FA" stopOpacity={0.5}/>
                    </linearGradient>
                    <linearGradient id="gradClient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#A78BFA" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#A78BFA" stopOpacity={0.5}/>
                    </linearGradient>
                    <linearGradient id="gradReceived" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#34D399" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#34D399" stopOpacity={0.5}/>
                    </linearGradient>
                    <linearGradient id="gradAmazonRecv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#6EE7B7" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#6EE7B7" stopOpacity={0.5}/>
                    </linearGradient>
                    <linearGradient id="gradClientRecv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#059669" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#059669" stopOpacity={0.5}/>
                    </linearGradient>
                    <linearGradient id="gradPayroll" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#7C3AED" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#7C3AED" stopOpacity={0.5}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 4" strokeOpacity={0.7}/>
                  <XAxis dataKey="month" tick={{ fontSize:11, fill:'var(--text-muted)', fontWeight:600, fontFamily:'inherit' }} axisLine={false} tickLine={false}
                    tickFormatter={v => { const [y,m] = v.split('-'); return new Date(+y,+m-1).toLocaleDateString('en-US',{month:'short'}) }}/>
                  <YAxis tick={{ fontSize:11, fill:'var(--text-muted)', fontFamily:'inherit' }} axisLine={false} tickLine={false} width={38}
                    tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}/>
                  <Tooltip
                    cursor={{ fill:'rgba(184,134,11,0.06)', rx:6 }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      const row = payload[0].payload
                      const spend = expView === 'combined' ? row.total : row[expView]
                      const recv  = expView === 'combined' ? row.total_received : row[`${expView}_received`]
                      const diff  = (recv||0) - (spend||0)
                      const [y,m] = label.split('-')
                      const monthLabel = new Date(+y,+m-1).toLocaleDateString('en-US',{month:'long',year:'numeric'})
                      const colors = { amazon:'#60A5FA', client:'#A78BFA', amazon_received:'#6EE7B7', client_received:'#059669', payroll:'#7C3AED' }
                      // Fixed light background regardless of the app's own dark/light theme —
                      // text below is hardcoded black, which would be unreadable against the
                      // dark-mode card color, so this tooltip intentionally doesn't follow it.
                      return (
                        <div style={{ background:'#FFFFFF', border:'1px solid #E5E5E5', borderRadius:12, fontSize:12, boxShadow:'0 8px 24px rgba(0,0,0,0.10)', padding:'10px 14px', minWidth:180 }}>
                          <div style={{ fontWeight:700, color:'#000', marginBottom:6, fontSize:12 }}>{monthLabel}</div>
                          {payload.map(p => (
                            <div key={p.dataKey} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, color:'#000' }}>
                              <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                                <span style={{ width:8, height:8, borderRadius:'50%', background: colors[p.dataKey] || '#000', flexShrink:0 }}/>
                                {p.name}
                              </span>
                              <span style={{ fontWeight:700 }}>AED {Number(p.value).toLocaleString()}</span>
                            </div>
                          ))}
                          <div style={{ display:'flex', justifyContent:'space-between', gap:16, marginTop:6, paddingTop:6, borderTop:'1px solid #E5E5E5', fontWeight:800, color: diff>=0?'#059669':'#DC2626' }}>
                            <span>Difference</span><span>{diff>=0?'+':'-'}AED {Math.abs(diff).toLocaleString()}</span>
                          </div>
                        </div>
                      )
                    }}
                  />
                  {expView === 'combined' ? (
                    <>
                      <Bar dataKey="amazon"  name="Amazon spend"          stackId="exp" fill="url(#gradAmazon)"/>
                      <Bar dataKey="client"  name="Other Projects spend"  stackId="exp" fill="url(#gradClient)" radius={[7,7,0,0]}>
                        <LabelList dataKey="total" position="top" offset={9}
                          formatter={v => `AED ${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`}
                          style={{ fontSize:10.5, fontWeight:800, fill:'var(--text)' }}/>
                      </Bar>
                      <Bar dataKey="amazon_received"  name="Amazon received"          stackId="recv" fill="url(#gradAmazonRecv)"/>
                      <Bar dataKey="client_received"  name="Other Projects received"  stackId="recv" fill="url(#gradClientRecv)" radius={[7,7,0,0]}>
                        <LabelList dataKey="total_received" position="top" offset={9}
                          formatter={v => `AED ${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`}
                          style={{ fontSize:10.5, fontWeight:800, fill:'#059669' }}/>
                      </Bar>
                      {/* Real recorded payroll (only ever set once a month is marked
                          paid — see routes/analytics.js) — not available to an
                          Amazon-only-scoped account, which has no Payroll access at all. */}
                      {!amazonLocked && (
                        <Bar dataKey="payroll" name="Payroll" fill="url(#gradPayroll)" radius={[7,7,0,0]}>
                          <LabelList dataKey="payroll" position="top" offset={9}
                            formatter={v => v > 0 ? `AED ${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}` : ''}
                            style={{ fontSize:10.5, fontWeight:800, fill:'#7C3AED' }}/>
                        </Bar>
                      )}
                    </>
                  ) : (
                    <>
                      <Bar dataKey={expView} name={expView==='amazon'?'Amazon spend':'Other Projects spend'}
                        fill={expView==='amazon'?'url(#gradAmazon)':'url(#gradClient)'} radius={[7,7,0,0]}>
                        <LabelList dataKey={expView} position="top" offset={9}
                          formatter={v => `AED ${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`}
                          style={{ fontSize:10.5, fontWeight:800, fill:'var(--text)' }}/>
                      </Bar>
                      <Bar dataKey={`${expView}_received`} name="Amount received"
                        fill="url(#gradReceived)" radius={[7,7,0,0]}>
                        <LabelList dataKey={`${expView}_received`} position="top" offset={9}
                          formatter={v => `AED ${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`}
                          style={{ fontSize:10.5, fontWeight:800, fill:'#34D399' }}/>
                      </Bar>
                    </>
                  )}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {expChart.length > 0 && (() => {
            const field    = expView === 'combined' ? 'total' : expView
            const recvField = expView === 'combined' ? 'total_received' : `${expView}_received`
            const totalExp6  = expChart.reduce((s,r) => s + (r[field]||0), 0)
            const totalRecv6 = expChart.reduce((s,r) => s + (r[recvField]||0), 0)
            const diff6      = totalRecv6 - totalExp6
            const avgExp6   = totalExp6 / expChart.length
            const peak      = expChart.reduce((max,r) => (r[field]||0) > (max?.[field]||0) ? r : max, expChart[0])
            const peakLabel = (() => { const [y,m] = peak.month.split('-'); return new Date(+y,+m-1).toLocaleDateString('en-US',{month:'short'}) })()
            const accent    = expView==='amazon' ? '#3B82F6' : expView==='client' ? '#7C3AED' : '#FCD34D'
            return (
              <div style={{ display:'flex', borderTop:'1px solid var(--border)', background:'var(--bg-alt)', flexWrap:'wrap' }}>
                {[
                  { label:`Total Spend (${expChart.length} month${expChart.length!==1?'s':''})`, value:`AED ${totalExp6.toLocaleString()}`, c:'var(--text)' },
                  { label:'Monthly Average',        value:`AED ${Math.round(avgExp6).toLocaleString()}`,   c:accent },
                  { label:`Peak Month (${peakLabel})`, value:`AED ${(peak[field]||0).toLocaleString()}`,   c:'#F59E0B' },
                  { label:'Difference (Received − Spend)', value:`${diff6>=0?'+':'-'}AED ${Math.abs(diff6).toLocaleString()}`, c: diff6>=0?'#34D399':'#F87171' },
                ].map(({ label, value, c }) => (
                  <div key={label} style={{ flex:1, minWidth:150, padding:'12px 20px', borderRight:'1px solid var(--border)', textAlign:'center' }}>
                    <div style={{ fontWeight:800, fontSize:16, color:c, letterSpacing:'-0.03em' }}>{value}</div>
                    <div style={{ fontSize:10.5, color:'var(--text-muted)', marginTop:2, fontWeight:600 }}>{label}</div>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
        )}

        {/* ══ AGENTS + FLEET ════════════════════════════════════════ */}
        <div className="ov-two">

          {/* Delivery Agents */}
          <div className="ov-card" style={isProjectScoped ? { gridColumn:'1 / -1' } : undefined}>
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
            {/* Amazon vs Other Projects DAs are two different workforces — this
                toggle re-slices Active/On Leave/Inactive/Total by category instead
                of only ever showing them blended together. Meaningless for a
                project-scoped manager (their data is already just their own). */}
            {!isProjectScoped && (
              <div className="ov-pill-tabs" style={{ margin:'12px 20px 0', width:'fit-content' }}>
                {[
                  { id:'combined', label:'Combined',        c:'#F59E0B' },
                  { id:'amazon',   label:'Amazon',           c:'#3B82F6' },
                  { id:'client',   label:'Other Projects',  c:'#7C3AED' },
                ].map(v => (
                  <button key={v.id} onClick={()=>setDaView(v.id)} className={`ov-pill-tab${daView===v.id?' active':''}`}
                    style={{ background: daView===v.id ? v.c : undefined, color: daView===v.id ? 'white' : undefined }}>
                    {v.label}
                  </button>
                ))}
              </div>
            )}
            <div className="ov-stats">
              {[
                { label:'Active',   value:daStats.active,  color:'var(--green)', bg:'var(--green-bg)', border:'var(--green-border)' },
                { label:'On Leave', value:daStats.onLeave, color:'var(--amber)', bg:'var(--amber-bg)', border:'var(--amber-border)' },
                { label:'Inactive', value:daInactive,      color:'var(--red)',   bg:'var(--red-bg)',   border:'var(--red-border)' },
                { label:'Total',    value:daStats.total,   color:'#7C3AED', bg:'#F5F3FF', border:'#DDD6FE' },
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
                    : <span className="ov-progress-name">
                        {daStats.active} active DA{daStats.active!==1?'s':''}{daView==='amazon'?' (Amazon)':daView==='client'?' (Other Projects)':' across all stations'}
                      </span>}
                  {!loadingHero && daStats.total > 0 && (
                    <span className="ov-progress-pct" style={{ color:'#F59E0B' }}>{Math.round(daStats.active/daStats.total*100)}%</span>
                  )}
                </div>
                <div className="ov-bar">
                  <div className="ov-fill" style={{ width:`${daStats.total>0?(daStats.active/daStats.total)*100:0}%`, background:'linear-gradient(90deg,#F59E0B,#FCD34D)' }}/>
                </div>
              </div>
            </div>
          </div>

          {/* Fleet Vehicles — Amazon-station only, not applicable to a project-scoped
              manager's client projects; Fleet is already hidden from their nav */}
          {!isProjectScoped && (
          <div className="ov-card">
            <div className="ov-card-hd">
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div className="ov-card-hd-icon" style={{ background:'var(--ov-sky-bg)', border:'1px solid var(--ov-sky-border)' }}>
                  <Car size={16} color="var(--ov-sky)"/>
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
                { label:'Active',      value:fleetStats?.active      ?? null, color:'var(--green)', bg:'var(--green-bg)', border:'var(--green-border)' },
                { label:'Grounded',    value:fleetStats?.grounded    ?? null, color:'var(--red)',   bg:'var(--red-bg)',   border:'var(--red-border)' },
                { label:'Maintenance', value:fleetStats?.maintenance ?? null, color:'var(--amber)', bg:'var(--amber-bg)', border:'var(--amber-border)' },
                { label:'Total',       value:fleetStats?.total       ?? null, color:'#7C3AED', bg:'#F5F3FF', border:'#DDD6FE' },
              ].map(({ label, value, color, bg, border }) => (
                <div key={label} className="ov-stat" style={{ background:bg, borderColor:border }}>
                  {value === null ? <Skel w={40} h={22} r={6}/> : <div className="ov-stat-val kpi-val" style={{ color }}>{value}</div>}
                  <div className="ov-stat-lbl" style={{ color }}>{label}</div>
                </div>
              ))}
            </div>
            <div className="ov-strip">
              <div style={{ width:38, height:38, borderRadius:11, background:'var(--ov-sky-bg)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <Car size={17} color="var(--ov-sky)"/>
              </div>
              <div style={{ flex:1 }}>
                <div className="ov-progress-head">
                  {fleetStats === null
                    ? <span className="ov-sk-dark" style={{ display:'inline-block', width:130, height:11, borderRadius:4 }}/>
                    : <span className="ov-progress-name">{fleetStats?.active ?? 0} vehicles active</span>}
                  {fleetStats !== null && fleetStats.total > 0 && (
                    <span className="ov-progress-pct" style={{ color:'var(--ov-sky)' }}>{Math.round((fleetStats.active||0)/fleetStats.total*100)}%</span>
                  )}
                </div>
                <div className="ov-bar">
                  <div className="ov-fill" style={{ width:`${fleetStats?.total>0?((fleetStats.active||0)/fleetStats.total)*100:0}%`, background:'linear-gradient(90deg,var(--ov-sky),#7DD3FC)' }}/>
                </div>
              </div>
            </div>
          </div>
          )}
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
                { label:'Total',    value:fmtAED(totalExp),    color:'var(--text)',  bg:'var(--bg-alt)',   border:'var(--border)', sm:true },
                { label:'Approved', value:fmtAED(approvedExp), color:'var(--green)', bg:'var(--green-bg)', border:'var(--green-border)', sm:true },
                { label:'Pending',  value:pendingExp,           color:'var(--amber)', bg:'var(--amber-bg)', border:'var(--amber-border)' },
                { label:'Rejected', value:rejectedExp,          color:'var(--red)',   bg:'var(--red-bg)',   border:'var(--red-border)' },
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
                { label:'Assigned',     value:simStats?.assigned  ?? null, color:'var(--amber)', bg:'var(--amber-bg)', border:'var(--amber-border)' },
                { label:'Available',    value:simStats?.available ?? null, color:'var(--green)', bg:'var(--green-bg)', border:'var(--green-border)' },
                { label:'Monthly Cost', value:fmtAED(simStats?.monthly_cost||0), color:'#2563EB', bg:'#EFF6FF', border:'#BFDBFE', sm:true },
              ].map(({ label, value, color, bg, border, sm }) => (
                <div key={label} className="ov-stat" style={{ background:bg, borderColor:border }}>
                  {(loadingSim && value === null) ? <Skel w={sm?80:40} h={22} r={6}/> : <div className="ov-stat-val kpi-val" style={{ color, fontSize:sm?14:undefined }}>{value ?? '—'}</div>}
                  <div className="ov-stat-lbl" style={{ color }}>{label}</div>
                </div>
              ))}
            </div>
            {/* Assigned SIMs by whether the DA holding it is Amazon-side or an
                Other-Projects client — same split as Delivery Agents above. */}
            {!isProjectScoped && !loadingSim && Number(simStats?.assigned) > 0 && (
              <div style={{ margin:'0 20px 16px', display:'flex', borderRadius:12, overflow:'hidden', border:'1px solid var(--border)' }}>
                <div style={{ flex: Math.max(Number(simStats?.assigned_amazon||0),0.3), padding:'9px 12px', background:'rgba(59,130,246,0.1)', borderRight:'1px solid var(--border)' }}>
                  <div style={{ fontSize:15, fontWeight:800, color:'#3B82F6', letterSpacing:'-0.02em' }}>{simStats?.assigned_amazon||0}</div>
                  <div style={{ fontSize:9.5, fontWeight:700, color:'#3B82F6', textTransform:'uppercase', letterSpacing:'0.05em', marginTop:1 }}>Amazon</div>
                </div>
                <div style={{ flex: Math.max(Number(simStats?.assigned_client||0),0.3), padding:'9px 12px', background:'rgba(124,58,237,0.1)' }}>
                  <div style={{ fontSize:15, fontWeight:800, color:'#7C3AED', letterSpacing:'-0.02em' }}>{simStats?.assigned_client||0}</div>
                  <div style={{ fontSize:9.5, fontWeight:700, color:'#7C3AED', textTransform:'uppercase', letterSpacing:'0.05em', marginTop:1 }}>Other Projects</div>
                </div>
              </div>
            )}
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
                style={{ '--qa-bg':`${c}10`, '--qa-bg-h':`${c}1E`, '--qa-border':`${c}22`, '--qa-shadow':`${c}30` }}>
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
