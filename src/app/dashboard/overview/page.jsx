'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { isAmazonOnlyScoped } from '@/lib/employees'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList } from 'recharts'
import {
  Users, Car, Wallet, ChevronRight, Smartphone,
  Receipt, ScrollText, RefreshCw, ArrowUpRight,
} from 'lucide-react'
import Link from 'next/link'
import { API } from '@/lib/api'
import { CATEGORIES as EXPENSE_CATEGORIES } from '@/components/expenses/ExpenseModal'

function hdr() { return { Authorization:`Bearer ${localStorage.getItem('gcd_token')}` } }
function fmt(n) { return Number(n||0).toLocaleString('en-US') }
function fmtAED(n) { return `AED ${fmt(n)}` }

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
          // so the Combined view's received bar can stack the same way. Backend
          // gates received to sale_invoice customers only (real revenue) — a
          // purchase_invoice customer's "receipt" is GCD paying a vendor, not
          // income, so this deliberately does NOT match the Customers page's own
          // blended total, which mixes both directions under one "Received" label.
          // other_received exists as a safety net for a future sale customer not
          // yet added to the Amazon/Other-Projects name lists below.
          const chart = (d.chart || []).map(r => ({ ...r, total_received: (r.amazon_received||0) + (r.client_received||0) + (r.other_received||0) }))
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

  const byCat = EXPENSE_CATEGORIES.map(cat => ({
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

  // Chart: two fixed series colours (SVG fill can't read CSS variables) that stay
  // legible on both the light and the dark card — gold = spend, green = received.
  const SPEND = '#B8860B', RECEIVED = '#16A34A'
  const spendKey = expView === 'combined' ? 'total'          : expView
  const recvKey  = expView === 'combined' ? 'total_received' : `${expView}_received`
  const monthShort = v => { const [y,m] = String(v).split('-'); return new Date(+y,+m-1).toLocaleDateString('en-US',{month:'short'}) }
  const compact = v => v >= 1e6 ? `${+(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${Math.round(v/1e3)}k` : `${v}`
  const pct = (a, b) => b > 0 ? Math.round((a / b) * 100) : 0

  const kpis = [
    {
      href:'/dashboard/hr/employees', label:'Active DAs', Icon:Users,
      value: loadingHero ? null : fmt(activeEmp),
      sub:   loadingHero ? '' : `of ${fmt(totalEmp)} registered`,
      bar:   loadingHero ? null : pct(activeEmp, totalEmp),
    },
    ...(isProjectScoped ? [] : [{
      href:'/dashboard/poc/fleet', label:'Vehicles on road', Icon:Car,
      value: loadingHero ? null : fmt(fleetStats?.active ?? 0),
      sub:   loadingHero ? '' : `of ${fmt(fleetStats?.total ?? 0)} in fleet`,
      bar:   loadingHero ? null : pct(fleetStats?.active ?? 0, fleetStats?.total ?? 0),
    }]),
    {
      href:'/dashboard/finance/expenses', label:'Expenses this month', Icon:Wallet,
      value: loadingExp ? null : fmtAED(Math.round(totalExp)),
      sub:   loadingExp ? '' : pendingExp > 0 ? `${pendingExp} awaiting approval` : 'Nothing awaiting approval',
      small: true,
    },
    {
      href:'/dashboard/office/letters', label:'Letters to sign', Icon:ScrollText,
      value: fmt(pendingLetters.length),
      sub:   pendingLetters.length > 0 ? 'Awaiting signature' : 'All letters signed',
      alert: pendingLetters.length > 0,
    },
  ]

  return (
    <>
      <style>{`
        .ov-sk {
          display:block;
          background: linear-gradient(90deg, var(--bg-alt) 25%, var(--border) 50%, var(--bg-alt) 75%);
          background-size: 300% 100%;
          animation: shimmer 1.2s ease-in-out infinite;
        }
        .ov-page { display:flex; flex-direction:column; gap:20px; animation:slideUp 0.3s ease; }

        /* ── Welcome banner ── */
        .ov-hero { background:var(--hero-bg); border-radius:18px; padding:24px; color:#fff; }
        .ov-hero-top { display:flex; align-items:center; gap:14px; flex-wrap:wrap; }
        .ov-hero-title { margin:0; font-size:22px; font-weight:700; letter-spacing:-0.02em; color:#fff; line-height:1.2; }
        .ov-hero-sub   { margin:4px 0 0; font-size:13px; color:rgba(255,255,255,0.62); }
        .ov-refresh {
          margin-left:auto; display:flex; align-items:center; gap:7px; padding:8px 14px; min-height:36px;
          border-radius:10px; border:1px solid rgba(255,255,255,0.16); background:rgba(255,255,255,0.06);
          color:rgba(255,255,255,0.88); font-size:13px; font-weight:600; font-family:inherit; cursor:pointer;
          transition:background var(--t-fast), border-color var(--t-fast);
        }
        .ov-refresh:hover:not(:disabled) { background:rgba(255,255,255,0.12); border-color:rgba(255,255,255,0.26); }
        .ov-refresh:disabled { opacity:0.55; cursor:not-allowed; }

        .ov-kpis { display:grid; grid-template-columns:repeat(${kpis.length},1fr); gap:12px; margin-top:22px; }
        .ov-kpi {
          display:flex; flex-direction:column; gap:6px; padding:16px 18px; border-radius:14px; text-decoration:none;
          background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.09);
          transition:background var(--t-base), border-color var(--t-base);
        }
        .ov-kpi:hover { background:rgba(255,255,255,0.09); border-color:rgba(224,176,58,0.45); }
        .ov-kpi-head { display:flex; align-items:center; gap:8px; color:rgba(255,255,255,0.68); font-size:12.5px; font-weight:500; }
        .ov-kpi-ico  { width:28px; height:28px; border-radius:8px; display:flex; align-items:center; justify-content:center; background:rgba(224,176,58,0.14); color:#E0B03A; flex-shrink:0; }
        .ov-kpi-go   { margin-left:auto; opacity:0; transition:opacity var(--t-fast); color:#E0B03A; }
        .ov-kpi:hover .ov-kpi-go, .ov-kpi:focus-visible .ov-kpi-go { opacity:1; }
        .ov-kpi-val  { font-size:28px; font-weight:700; letter-spacing:-0.02em; color:#fff; line-height:1.15; margin-top:6px; }
        .ov-kpi-val.sm { font-size:22px; }
        .ov-kpi-sub  { font-size:12px; color:rgba(255,255,255,0.6); }
        .ov-kpi-sub.alert { color:#FCD34D; font-weight:600; }
        .ov-kpi-bar  { height:4px; border-radius:2px; background:rgba(255,255,255,0.12); overflow:hidden; margin-top:4px; }
        .ov-kpi-bar > span { display:block; height:100%; border-radius:2px; background:#E0B03A; transition:width 0.9s cubic-bezier(0.16,1,0.3,1); }

        /* ── Letters notice ── */
        .ov-notice {
          display:flex; align-items:center; gap:14px; padding:14px 18px; border-radius:14px; text-decoration:none;
          background:var(--card); border:1px solid var(--amber-border);
        }
        .ov-notice:hover { box-shadow:var(--shadow-md); }

        /* ── Cards ── */
        .ov-card { background:var(--card); border:1px solid var(--border); border-radius:16px; box-shadow:var(--shadow); overflow:hidden; }
        .ov-card-hd { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding:18px 22px; flex-wrap:wrap; }
        .ov-card-title { margin:0; font-size:15px; font-weight:600; color:var(--text); letter-spacing:-0.01em; }
        .ov-card-sub   { margin:3px 0 0; font-size:12.5px; color:var(--text-muted); }
        .ov-link { display:inline-flex; align-items:center; gap:3px; font-size:13px; font-weight:600; color:var(--gold); white-space:nowrap; }
        .ov-link:hover { text-decoration:underline; }
        .ov-two { display:grid; grid-template-columns:1fr 1fr; gap:20px; }

        .ov-seg { display:flex; gap:2px; padding:3px; border-radius:10px; background:var(--bg-alt); border:1px solid var(--border); }
        .ov-seg button {
          padding:6px 12px; min-height:30px; border-radius:7px; border:none; background:none; cursor:pointer;
          font-family:inherit; font-size:12.5px; font-weight:500; color:var(--text-sub); white-space:nowrap;
        }
        .ov-seg button:hover:not(.on) { color:var(--text); }
        .ov-seg button.on { background:var(--card); color:var(--text); font-weight:600; box-shadow:0 1px 2px rgba(28,25,23,0.10), 0 0 0 1px rgba(28,25,23,0.04); }

        /* ── Chart ── */
        .ov-legend { display:flex; gap:16px; flex-wrap:wrap; padding:0 22px; font-size:12.5px; color:var(--text-sub); }
        .ov-legend i { display:inline-block; width:10px; height:10px; border-radius:3px; margin-right:6px; vertical-align:-1px; }
        .ov-sum { display:grid; grid-template-columns:repeat(4,1fr); border-top:1px solid var(--border); }
        .ov-sum > div { padding:14px 22px; border-right:1px solid var(--border); }
        .ov-sum > div:last-child { border-right:none; }
        .ov-sum-lbl { font-size:12px; color:var(--text-muted); }
        .ov-sum-val { font-size:17px; font-weight:700; color:var(--text); letter-spacing:-0.01em; margin-top:3px; }

        /* ── Breakdown cards (workforce / fleet / SIMs) ── */
        .ov-big { display:flex; align-items:baseline; gap:8px; padding:0 22px; }
        .ov-big b { font-size:32px; font-weight:700; color:var(--text); letter-spacing:-0.02em; line-height:1; }
        .ov-big span { font-size:13px; color:var(--text-muted); }
        .ov-split { display:flex; height:10px; border-radius:5px; overflow:hidden; background:var(--bg-alt); margin:16px 22px 6px; gap:2px; }
        .ov-split > span { display:block; height:100%; transition:flex-grow 0.8s cubic-bezier(0.16,1,0.3,1); }
        .ov-rows { padding:8px 22px 18px; display:flex; flex-direction:column; }
        .ov-row { display:flex; align-items:center; gap:10px; padding:9px 0; border-bottom:1px solid var(--border); font-size:13.5px; }
        .ov-row:last-child { border-bottom:none; }
        .ov-row i { width:9px; height:9px; border-radius:50%; flex-shrink:0; }
        .ov-row .lbl { flex:1; color:var(--text-sub); min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .ov-row .num { font-weight:600; color:var(--text); }
        .ov-row .pc  { width:42px; text-align:right; font-size:12px; color:var(--text-muted); }
        .ov-track { height:6px; border-radius:3px; background:var(--bg-alt); overflow:hidden; }
        .ov-track > span { display:block; height:100%; border-radius:3px; }

        /* ── Quick actions ── */
        .ov-qa { display:grid; grid-template-columns:repeat(6,1fr); gap:12px; padding:0 22px 22px; }
        .ov-qa a {
          display:flex; flex-direction:column; align-items:flex-start; gap:10px; padding:14px; border-radius:12px;
          border:1px solid var(--border); background:var(--card); text-decoration:none;
          transition:border-color var(--t-fast), background var(--t-fast), box-shadow var(--t-fast);
        }
        .ov-qa a:hover { border-color:var(--gold-border); background:var(--gold-pale); box-shadow:var(--shadow); }
        .ov-qa-ico { width:34px; height:34px; border-radius:9px; display:flex; align-items:center; justify-content:center; background:var(--gold-tint); color:var(--gold); }
        .ov-qa span { font-size:13.5px; font-weight:600; color:var(--text); }

        @media (max-width:1100px) {
          .ov-kpis { grid-template-columns:repeat(2,1fr); }
          .ov-qa   { grid-template-columns:repeat(3,1fr); }
        }
        @media (max-width:860px) {
          .ov-two { grid-template-columns:1fr; }
          .ov-sum { grid-template-columns:repeat(2,1fr); }
          .ov-sum > div:nth-child(2) { border-right:none; }
          .ov-sum > div:nth-child(-n+2) { border-bottom:1px solid var(--border); }
        }
        @media (max-width:520px) {
          .ov-hero { padding:18px; }
          .ov-hero-title { font-size:19px; }
          .ov-refresh { margin-left:0; }
          .ov-kpis { grid-template-columns:1fr; }
          .ov-qa   { grid-template-columns:repeat(2,1fr); padding:0 16px 16px; }
          .ov-card-hd { padding:16px; }
        }
      `}</style>

      <div className="ov-page">

        {/* ══ WELCOME + KEY NUMBERS ═════════════════════════════════ */}
        <section className="ov-hero" aria-label="Today at a glance">
          <div className="ov-hero-top">
            <div style={{ minWidth:0 }}>
              <h1 className="ov-hero-title">{greeting}{firstName ? `, ${firstName}` : ''}</h1>
              <p className="ov-hero-sub">{dateStr}</p>
            </div>
            <button onClick={() => load(true)} className="ov-refresh" disabled={loadingHero || refreshing}>
              <RefreshCw size={14} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }}/>
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>

          <div className="ov-kpis">
            {kpis.map(({ href, label, Icon, value, sub, bar, small, alert }) => (
              <Link key={label} href={href} className="ov-kpi">
                <div className="ov-kpi-head">
                  <span className="ov-kpi-ico"><Icon size={15}/></span>
                  {label}
                  <ArrowUpRight size={15} className="ov-kpi-go" aria-hidden="true"/>
                </div>
                {value === null
                  ? <span className="ov-sk" style={{ height:30, width:'55%', borderRadius:6, marginTop:6, opacity:0.25 }}/>
                  : <div key={value} className={`ov-kpi-val kpi-val${small ? ' sm' : ''}`}>{value}</div>}
                <div className={`ov-kpi-sub${alert ? ' alert' : ''}`}>{sub || ' '}</div>
                {bar !== undefined && (
                  <div className="ov-kpi-bar" role="img" aria-label={`${bar ?? 0}%`}>
                    <span style={{ width:`${bar ?? 0}%` }}/>
                  </div>
                )}
              </Link>
            ))}
          </div>
        </section>

        {/* ══ LETTERS NOTICE ═════════════════════════════════════════ */}
        {pendingLetters.length > 0 && (
          <Link href="/dashboard/office/letters" className="ov-notice fade-up">
            <span style={{ width:38, height:38, borderRadius:10, background:'var(--amber-bg)', color:'var(--amber)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <ScrollText size={18}/>
            </span>
            <span style={{ flex:1, minWidth:0 }}>
              <span style={{ display:'block', fontWeight:600, fontSize:14, color:'var(--text)' }}>
                {pendingLetters.length} letter{pendingLetters.length > 1 ? 's' : ''} awaiting your approval
              </span>
              <span style={{ display:'block', fontSize:12.5, color:'var(--text-muted)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {pendingLetters.map(l => l.ref_no).join(' · ')}
                {' — '}{[...new Set(pendingLetters.map(l => l.created_by_name).filter(Boolean))].join(', ')}
              </span>
            </span>
            <span className="ov-link">Review <ChevronRight size={14}/></span>
          </Link>
        )}

        {/* ══ SPEND VS RECEIVED ══════════════════════════════════════ */}
        {/* Company-wide totals — matches the backend's /expenses-chart gate. A
            project-scoped manager must never see the whole org's spend. */}
        {canSeeCompanyChart && (
          <section className="ov-card" aria-label="Spend versus received">
            <div className="ov-card-hd">
              <div>
                <h2 className="ov-card-title">Spend vs. received</h2>
                <p className="ov-card-sub">
                  Last 12 months · {amazonLocked || expView === 'amazon' ? 'Amazon' : expView === 'client' ? 'Other Projects' : 'All projects'}
                </p>
              </div>
              {/* Amazon-only-scoped accounts are locked to the Amazon view. */}
              {!amazonLocked && (
                <div className="ov-seg" role="tablist" aria-label="Project filter">
                  {[['combined','All'],['amazon','Amazon'],['client','Other Projects']].map(([id, label]) => (
                    <button key={id} role="tab" aria-selected={expView === id} className={expView === id ? 'on' : ''} onClick={() => setExpView(id)}>{label}</button>
                  ))}
                </div>
              )}
            </div>

            <div className="ov-legend">
              <span><i style={{ background:SPEND }}/>Spend</span>
              <span><i style={{ background:RECEIVED }}/>Received</span>
            </div>

            <div style={{ padding:'8px 12px 6px' }}>
              {loadingExpChart ? (
                <div style={{ display:'flex', alignItems:'flex-end', gap:14, height:250, padding:'20px 24px' }}>
                  {[40,65,30,80,55,90,70,45,85,60].map((h,i) => <span key={i} className="ov-sk" style={{ flex:1, height:`${h}%`, borderRadius:6 }}/>)}
                </div>
              ) : !mounted || expChart.length === 0 ? (
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'48px 24px', textAlign:'center' }}>
                  <Receipt size={26} color="var(--text-muted)" style={{ marginBottom:10 }}/>
                  <div style={{ fontWeight:600, fontSize:14.5, color:'var(--text)' }}>No spend recorded yet</div>
                  <div style={{ fontSize:13, color:'var(--text-muted)', marginTop:4 }}>Months appear here once expenses are logged.</div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={expChart} barGap={4} barCategoryGap="28%" margin={{ top:26, right:12, left:4, bottom:0 }}>
                    <CartesianGrid vertical={false} stroke="#A8A29E" strokeOpacity={0.25}/>
                    <XAxis dataKey="month" tickFormatter={monthShort} axisLine={false} tickLine={false}
                      tick={{ fontSize:12, fill:'#78716C', fontFamily:'inherit' }}/>
                    <YAxis axisLine={false} tickLine={false} width={48} tickFormatter={compact}
                      tick={{ fontSize:12, fill:'#78716C', fontFamily:'inherit' }}/>
                    <Tooltip
                      cursor={{ fill:'rgba(143,104,7,0.07)' }}
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        const row   = payload[0].payload
                        const spend = row[spendKey] || 0
                        const recv  = row[recvKey]  || 0
                        const diff  = recv - spend
                        const [y,m] = String(label).split('-')
                        const title = new Date(+y,+m-1).toLocaleDateString('en-US',{month:'long',year:'numeric'})
                        const line  = (name, v, c, strong) => (
                          <div style={{ display:'flex', justifyContent:'space-between', gap:18, marginTop:4, fontWeight: strong ? 600 : 400 }}>
                            <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                              {c && <span style={{ width:8, height:8, borderRadius:2, background:c }}/>}{name}
                            </span>
                            <span style={{ fontWeight:600 }}>AED {Math.round(v).toLocaleString()}</span>
                          </div>
                        )
                        // Fixed light surface in both themes (text below is dark).
                        return (
                          <div style={{ background:'#fff', color:'#1C1917', border:'1px solid #E7E5E4', borderRadius:10, padding:'10px 14px', fontSize:12.5, boxShadow:'0 8px 24px rgba(28,25,23,0.12)', minWidth:210 }}>
                            <div style={{ fontWeight:600, marginBottom:4 }}>{title}</div>
                            {line('Spend', spend, SPEND, true)}
                            {expView === 'combined' && (row.amazon || row.client) ? (
                              <div style={{ paddingLeft:14, color:'#57534E' }}>
                                {line('Amazon', row.amazon || 0)}
                                {line('Other Projects', row.client || 0)}
                              </div>
                            ) : null}
                            {line('Received', recv, RECEIVED, true)}
                            <div style={{ display:'flex', justifyContent:'space-between', gap:18, marginTop:8, paddingTop:8, borderTop:'1px solid #E7E5E4', fontWeight:600, color: diff >= 0 ? '#15803D' : '#B91C1C' }}>
                              <span>{diff >= 0 ? 'Surplus' : 'Shortfall'}</span>
                              <span>{diff >= 0 ? '+' : '−'}AED {Math.abs(Math.round(diff)).toLocaleString()}</span>
                            </div>
                          </div>
                        )
                      }}
                    />
                    {/* Amounts on top of each bar — compact (418k, 1.2M) so two labels fit
                        per month; empty months get no label. Label colour follows the
                        theme tokens (style, unlike SVG fill, can read CSS variables). */}
                    <Bar dataKey={spendKey} name="Spend"    fill={SPEND}    radius={[5,5,0,0]} maxBarSize={30} isAnimationActive={false}>
                      <LabelList dataKey={spendKey} position="top" offset={6} formatter={v => v > 0 ? compact(Math.round(v)) : ''}
                        style={{ fontSize:11, fontWeight:600, fill:'var(--gold)' }}/>
                    </Bar>
                    <Bar dataKey={recvKey}  name="Received" fill={RECEIVED} radius={[5,5,0,0]} maxBarSize={30} isAnimationActive={false}>
                      <LabelList dataKey={recvKey} position="top" offset={6} formatter={v => v > 0 ? compact(Math.round(v)) : ''}
                        style={{ fontSize:11, fontWeight:600, fill:'var(--green)' }}/>
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {expChart.length > 0 && (() => {
              const totalSpend = expChart.reduce((s,r) => s + (r[spendKey] || 0), 0)
              const totalRecv  = expChart.reduce((s,r) => s + (r[recvKey]  || 0), 0)
              const diff       = totalRecv - totalSpend
              const peak       = expChart.reduce((mx,r) => (r[spendKey] || 0) > (mx?.[spendKey] || 0) ? r : mx, expChart[0])
              return (
                <div className="ov-sum">
                  {[
                    { l:`Total spend · ${expChart.length} mo`, v:fmtAED(Math.round(totalSpend)) },
                    { l:'Monthly average',                     v:fmtAED(Math.round(totalSpend / expChart.length)) },
                    { l:`Highest month · ${monthShort(peak.month)}`, v:fmtAED(Math.round(peak[spendKey] || 0)) },
                    { l:'Received − spend', v:`${diff >= 0 ? '+' : '−'}${fmtAED(Math.abs(Math.round(diff)))}`, c: diff >= 0 ? 'var(--green)' : 'var(--red)' },
                  ].map(({ l, v, c }) => (
                    <div key={l}>
                      <div className="ov-sum-lbl">{l}</div>
                      <div className="ov-sum-val" style={c ? { color:c } : undefined}>{v}</div>
                    </div>
                  ))}
                </div>
              )
            })()}
          </section>
        )}

        {/* ══ WORKFORCE + FLEET ══════════════════════════════════════ */}
        <div className="ov-two">
          <section className="ov-card" style={isProjectScoped ? { gridColumn:'1 / -1' } : undefined} aria-label="Delivery agents">
            <div className="ov-card-hd">
              <div>
                <h2 className="ov-card-title">Delivery agents</h2>
                <p className="ov-card-sub">Workforce status</p>
              </div>
              <Link href="/dashboard/hr/employees" className="ov-link">View all <ChevronRight size={14}/></Link>
            </div>
            {/* Amazon vs Other Projects are separate workforces — re-slice instead
                of only showing them blended. Not shown to a project-scoped manager
                (their data is already only their own projects). */}
            {!isProjectScoped && (
              <div className="ov-seg" role="tablist" aria-label="Workforce filter" style={{ margin:'-4px 22px 16px', width:'fit-content' }}>
                {[['combined','All'],['amazon','Amazon'],['client','Other Projects']].map(([id, label]) => (
                  <button key={id} role="tab" aria-selected={daView === id} className={daView === id ? 'on' : ''} onClick={() => setDaView(id)}>{label}</button>
                ))}
              </div>
            )}
            <div className="ov-big">
              {loadingHero ? <span className="ov-sk" style={{ width:90, height:30, borderRadius:6 }}/> : <b>{fmt(daStats.total)}</b>}
              <span>registered</span>
            </div>
            {(() => {
              const parts = [
                { l:'Active',   v:daStats.active,  c:'#16A34A' },
                { l:'On leave', v:daStats.onLeave, c:'#D97706' },
                { l:'Inactive', v:daInactive,      c:'#A8A29E' },
              ]
              return (<>
                <div className="ov-split" role="img" aria-label={parts.map(p => `${p.l} ${p.v}`).join(', ')}>
                  {parts.map(p => p.v > 0 && <span key={p.l} style={{ flexGrow:p.v, background:p.c }}/>)}
                </div>
                <div className="ov-rows">
                  {parts.map(p => (
                    <div key={p.l} className="ov-row">
                      <i style={{ background:p.c }}/>
                      <span className="lbl">{p.l}</span>
                      <span className="num">{loadingHero ? '–' : fmt(p.v)}</span>
                      <span className="pc">{loadingHero ? '' : `${pct(p.v, daStats.total)}%`}</span>
                    </div>
                  ))}
                </div>
              </>)
            })()}
          </section>

          {/* Fleet is Amazon-station only — hidden for a project-scoped manager,
              same as their sidebar. */}
          {!isProjectScoped && (
            <section className="ov-card" aria-label="Fleet vehicles">
              <div className="ov-card-hd">
                <div>
                  <h2 className="ov-card-title">Fleet vehicles</h2>
                  <p className="ov-card-sub">Vehicle availability</p>
                </div>
                <Link href="/dashboard/poc/fleet" className="ov-link">View all <ChevronRight size={14}/></Link>
              </div>
              <div className="ov-big">
                {fleetStats === null ? <span className="ov-sk" style={{ width:90, height:30, borderRadius:6 }}/> : <b>{fmt(fleetStats.total)}</b>}
                <span>vehicles</span>
              </div>
              {(() => {
                const fs = fleetStats || { total:0, active:0, grounded:0, maintenance:0 }
                const parts = [
                  { l:'On road',     v:fs.active,      c:'#16A34A' },
                  { l:'Maintenance', v:fs.maintenance, c:'#D97706' },
                  { l:'Grounded',    v:fs.grounded,    c:'#DC2626' },
                ]
                return (<>
                  <div className="ov-split" role="img" aria-label={parts.map(p => `${p.l} ${p.v}`).join(', ')}>
                    {parts.map(p => p.v > 0 && <span key={p.l} style={{ flexGrow:p.v, background:p.c }}/>)}
                  </div>
                  <div className="ov-rows">
                    {parts.map(p => (
                      <div key={p.l} className="ov-row">
                        <i style={{ background:p.c }}/>
                        <span className="lbl">{p.l}</span>
                        <span className="num">{fleetStats === null ? '–' : fmt(p.v)}</span>
                        <span className="pc">{fleetStats === null ? '' : `${pct(p.v, fs.total)}%`}</span>
                      </div>
                    ))}
                  </div>
                </>)
              })()}
            </section>
          )}
        </div>

        {/* ══ EXPENSES + SIM CARDS ═══════════════════════════════════ */}
        <div className="ov-two">
          <section className="ov-card" aria-label="Expenses this month">
            <div className="ov-card-hd">
              <div>
                <h2 className="ov-card-title">Expenses this month</h2>
                <p className="ov-card-sub">
                  {loadingExp ? 'Loading…' : `${fmtAED(Math.round(approvedExp))} approved · ${pendingExp} pending · ${rejectedExp} rejected`}
                </p>
              </div>
              <Link href="/dashboard/finance/expenses" className="ov-link">View all <ChevronRight size={14}/></Link>
            </div>
            {loadingExp ? (
              <div style={{ padding:'0 22px 22px', display:'flex', flexDirection:'column', gap:10 }}>
                {[1,2,3,4].map(i => <span key={i} className="ov-sk" style={{ height:14, borderRadius:6 }}/>)}
              </div>
            ) : mounted && byCat.length > 0 ? (
              <div style={{ display:'flex', gap:22, alignItems:'center', padding:'0 22px 22px', flexWrap:'wrap' }}>
                <div style={{ position:'relative', width:132, height:132, flexShrink:0 }}>
                  <PieChart width={132} height={132}>
                    <Pie data={byCat} cx={62} cy={62} innerRadius={44} outerRadius={64} dataKey="value" strokeWidth={2} stroke="var(--card)" paddingAngle={1}>
                      {byCat.map((c,i) => <Cell key={i} fill={c.color}/>)}
                    </Pie>
                  </PieChart>
                  <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
                    <span style={{ fontSize:11.5, color:'var(--text-muted)' }}>Total</span>
                    <span style={{ fontSize:14, fontWeight:700, color:'var(--text)' }}>{compact(Math.round(totalExp))}</span>
                  </div>
                </div>
                <div style={{ flex:1, minWidth:200, display:'flex', flexDirection:'column', gap:10 }}>
                  {byCat.slice(0,5).map(c => (
                    <div key={c.name}>
                      <div style={{ display:'flex', justifyContent:'space-between', gap:10, fontSize:13, marginBottom:4 }}>
                        <span style={{ color:'var(--text-sub)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.name}</span>
                        <span style={{ fontWeight:600, color:'var(--text)', flexShrink:0 }}>{fmtAED(Math.round(c.value))}</span>
                      </div>
                      <div className="ov-track"><span style={{ width:`${pct(c.value, byCat[0].value)}%`, background:c.color }}/></div>
                    </div>
                  ))}
                  {byCat.length > 5 && <div style={{ fontSize:12.5, color:'var(--text-muted)' }}>+{byCat.length - 5} more categories</div>}
                </div>
              </div>
            ) : (
              <div style={{ padding:'8px 22px 26px', fontSize:13, color:'var(--text-muted)' }}>No expenses logged this month.</div>
            )}
          </section>

          <section className="ov-card" aria-label="SIM cards">
            <div className="ov-card-hd">
              <div>
                <h2 className="ov-card-title">SIM cards</h2>
                <p className="ov-card-sub">
                  {loadingSim ? 'Loading…' : `${fmt(simStats?.total ?? 0)} total · ${fmtAED(Math.round(simStats?.monthly_cost || 0))} per month`}
                </p>
              </div>
              <Link href="/dashboard/poc/sims" className="ov-link">View all <ChevronRight size={14}/></Link>
            </div>
            <div className="ov-rows" style={{ paddingTop:0 }}>
              {[
                { l:'Assigned',  v:simStats?.assigned,  c:'#B8860B' },
                { l:'Available', v:simStats?.available, c:'#16A34A' },
                ...(!isProjectScoped && Number(simStats?.assigned) > 0 ? [
                  { l:'Assigned · Amazon',         v:simStats?.assigned_amazon || 0, c:'#2563EB' },
                  { l:'Assigned · Other Projects', v:simStats?.assigned_client || 0, c:'#7C3AED' },
                ] : []),
              ].map(r => (
                <div key={r.l} className="ov-row">
                  <i style={{ background:r.c }}/>
                  <span className="lbl">{r.l}</span>
                  <span className="num">{loadingSim ? '–' : fmt(r.v ?? 0)}</span>
                </div>
              ))}
            </div>
            {!loadingSim && simByStation.length > 0 && (
              <div style={{ padding:'0 22px 22px', display:'flex', flexDirection:'column', gap:14 }}>
                {simByStation.map(s => {
                  const used = pct(s.assigned, s.total)
                  return (
                    <div key={s.station_code}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:10, marginBottom:6 }}>
                        <span style={{ fontWeight:600, fontSize:13.5, color:'var(--text)' }}>{s.station_code}</span>
                        <span style={{ fontSize:12.5, color:'var(--text-muted)' }}>
                          {s.assigned}/{s.total} in use · <b style={{ color:'var(--text)', fontWeight:600 }}>{used}%</b>
                        </span>
                      </div>
                      <div className="ov-track"><span style={{ width:`${used}%`, background:'#B8860B' }}/></div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        {/* ══ QUICK ACTIONS ══════════════════════════════════════════ */}
        <section className="ov-card" aria-label="Quick actions">
          <div className="ov-card-hd">
            <div>
              <h2 className="ov-card-title">Quick actions</h2>
              <p className="ov-card-sub">Jump straight to a section</p>
            </div>
          </div>
          <div className="ov-qa">
            {[
              { l:'Employees', href:'/dashboard/hr/employees',     Icon:Users },
              { l:'Payroll',   href:'/dashboard/finance/payroll',  Icon:Wallet },
              { l:'Expenses',  href:'/dashboard/finance/expenses', Icon:Receipt },
              { l:'SIM cards', href:'/dashboard/poc/sims',         Icon:Smartphone },
              { l:'Fleet',     href:'/dashboard/poc/fleet',        Icon:Car },
              { l:'Leaves',    href:'/dashboard/hr/leaves',        Icon:ScrollText },
            ].map(({ l, href, Icon }) => (
              <Link key={l} href={href}>
                <span className="ov-qa-ico"><Icon size={17}/></span>
                <span>{l}</span>
              </Link>
            ))}
          </div>
        </section>

      </div>
    </>
  )
}
