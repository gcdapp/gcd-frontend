'use client'
import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSocket } from '@/lib/socket'
import {
  Plus, X, Receipt, Search, Trash2, Pencil, Check,
  Users, Tag, Download, TrendingUp,
  ChevronDown, Filter, ArrowUp, ArrowDown,
} from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { API } from '@/lib/api'
import ExpenseModal, { CATEGORIES, CAT_MAP } from '@/components/expenses/ExpenseModal'

const MONTHS  = Array.from({ length: 6 }, (_, i) => {
  const d = new Date(); d.setMonth(d.getMonth() - i); return d.toISOString().slice(0, 7)
})
const EMP_COLORS = ['#FBBF24','#818CF8','#34D399','#F87171','#38BDF8','#A78BFA','#FB923C','#4ADE80']
// Each sort field has a "natural" default direction (newest/highest/A-Z first) —
// applied whenever the field changes, so switching fields doesn't feel backwards.
const SORT_DEFAULT_DIR = { date: 'desc', amount: 'desc', emp: 'asc', cat: 'asc' }

// ── Helpers ───────────────────────────────────────────────────────
function hdr(json = true) {
  const h = { Authorization: `Bearer ${localStorage.getItem('gcd_token')}` }
  if (json) h['Content-Type'] = 'application/json'
  return h
}
function fmt(n) { return Number(n || 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function getUserRole() {
  try { const t = localStorage.getItem('gcd_token'); return t ? JSON.parse(atob(t.split('.')[1])).role : null } catch { return null }
}
// Petty-cash/payroll mirrors append an internal "[pcref:ID]"/"[ref:ID]" tag to an
// expense's description so the backend can find and clean it up later — never meant
// to be user-facing. Strip it for display only; the stored description keeps the tag.
function stripRefTag(desc) { return (desc || '').replace(/\s*\[(?:pcref|ref):[^\]]*\]\s*$/, '').trim() }

// ── CSS ───────────────────────────────────────────────────────────
const CSS = `
  .ex-kpi   { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
  .ex-charts{ display:grid; grid-template-columns:repeat(3,1fr); gap:14px; }
  .ex-skel  { background:var(--card); border-radius:14px; animation:ex-pulse 1.4s ease infinite; }
  @keyframes ex-pulse { 0%,100%{opacity:.4} 50%{opacity:.8} }
  .ex-card  { background:var(--card); border:1px solid var(--border); border-radius:16px; overflow:hidden; transition:box-shadow 0.18s,transform 0.18s; }
  .ex-card:hover { box-shadow:0 6px 24px rgba(0,0,0,0.10); transform:translateY(-1px); }
  .ex-filters{ display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
  .ex-select { padding:9px 14px; border-radius:24px; border:1.5px solid var(--border); background:var(--card); color:var(--text); font-size:12.5px; font-weight:600; cursor:pointer; outline:none; font-family:inherit; }
  .ex-hero-row { display:flex; align-items:center; gap:14px; margin-bottom:20px; }
  @media(max-width:640px){
    .ex-kpi    { grid-template-columns:repeat(2,1fr) !important; }
    .ex-charts { grid-template-columns:1fr !important; }
    .ex-hero-row { flex-wrap:wrap; gap:10px; }
    .ex-hero-row>div:last-child { width:100%; }
    .ex-hero-actions { width:100%; display:flex; gap:8px; }
    .ex-hero-actions select, .ex-hero-actions button { flex:1; }
    .ex-filters { gap:6px; }
    .ex-filters .ex-search-wrap { width:100%; }
    .ex-filters .ex-select { flex:1 1 auto; min-width:0; }
  }
  @media(max-width:900px) and (min-width:641px){
    .ex-charts { grid-template-columns:repeat(2,1fr) !important; }
    .ex-kpi    { grid-template-columns:repeat(2,1fr) !important; }
  }
`

// ── Tooltip ───────────────────────────────────────────────────────
const Tip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:10, padding:'8px 12px', fontSize:12, fontFamily:'inherit', boxShadow:'0 4px 16px rgba(0,0,0,0.12)' }}>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.fill, fontWeight:700 }}>
          {p.name} — AED {fmt(p.value)}
        </div>
      ))}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────
export default function ExpensesPage() {
  return (
    <Suspense fallback={null}>
      <ExpensesPageInner/>
    </Suspense>
  )
}

function ExpensesPageInner() {
  const searchParams  = useSearchParams()
  const [expenses,    setExpenses]    = useState([])
  const [employees,   setEmployees]   = useState([])
  const [loading,     setLoading]     = useState(true)
  const [modal,       setModal]       = useState(null)
  const [search,      setSearch]      = useState('')
  const [catFilter,   setCatFilter]   = useState('all')
  const [statusFilter,setStatusFilter]= useState('all')
  const [empFilter,   setEmpFilter]   = useState(searchParams.get('emp_id') || 'all')
  const [sortBy,      setSortBy]      = useState('date')
  const [sortDir,     setSortDir]     = useState('desc')
  const [month,       setMonth]       = useState(MONTHS[0])
  const [userRole,    setUserRole]    = useState(null)
  const [showCharts,  setShowCharts]  = useState(true)
  const [page,        setPage]        = useState(1)
  const PAGE_SIZE = 20

  useEffect(() => { setUserRole(getUserRole()) }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const h = { headers: { Authorization: `Bearer ${localStorage.getItem('gcd_token')}` } }
    try {
      // ── Phase 1: expenses only → KPI + list render immediately ──
      const exp = await fetch(`${API}/api/expenses?month=${month}`, h).then(r => r.json())
      setExpenses(exp.expenses || [])
      setLoading(false)
      // ── Phase 2: employees in background (needed for modal only) ──
      fetch(`${API}/api/employees`, h).then(r => r.json()).then(e => setEmployees(e.employees || [])).catch(() => {})
    } catch (e) {
      console.error(e)
      setLoading(false)
    }
  }, [month])

  useEffect(() => { load() }, [load])
  useSocket({ 'expense:created': load, 'expense:updated': load })

  // ── All computed values memoized ──────────────────────────────
  const { total, approvedAmt, pendingCount, byCat, byEmp } = useMemo(() => {
    const total       = expenses.reduce((s, e) => s + Number(e.amount || 0), 0)
    const approvedAmt = expenses.filter(e => e.status === 'approved').reduce((s, e) => s + Number(e.amount || 0), 0)
    const pendingCount = expenses.filter(e => e.status === 'pending').length

    const byCat = CATEGORIES.map(cat => ({
      name: cat.v, short: cat.v.split(' ')[0], Icon: cat.I,
      value: expenses.filter(e => e.category === cat.v).reduce((s, e) => s + Number(e.amount || 0), 0),
      color: cat.c,
    })).filter(c => c.value > 0).sort((a, b) => b.value - a.value)

    // Build from expense records — no employees API needed
    const empMap = {}
    for (const exp of expenses) {
      const name = exp.emp_name || exp.emp_id || 'Company Expense'
      if (!empMap[name]) empMap[name] = { name, id: exp.emp_id, value: 0, count: 0 }
      empMap[name].value += Number(exp.amount || 0)
      empMap[name].count++
    }
    const byEmp = Object.values(empMap).sort((a, b) => b.value - a.value)

    return { total, approvedAmt, pendingCount, byCat, byEmp }
  }, [expenses])

  const filtered = useMemo(() => {
    let list = expenses.filter(e => {
      const q = search.toLowerCase()
      return (
        (!search || (e.emp_name || '').toLowerCase().includes(q) || (e.description || '').toLowerCase().includes(q)) &&
        (catFilter === 'all' || e.category === catFilter) &&
        (empFilter === 'all' || e.emp_id === empFilter) &&
        (statusFilter === 'all' || e.status === statusFilter)
      )
    })
    return [...list].sort((a, b) => {
      let cmp = 0
      if (sortBy === 'amount')      cmp = Number(a.amount) - Number(b.amount)
      else if (sortBy === 'emp')    cmp = (a.emp_name || '').localeCompare(b.emp_name || '')
      else if (sortBy === 'cat')    cmp = a.category.localeCompare(b.category)
      else                          cmp = new Date(a.date || a.created_at) - new Date(b.date || b.created_at)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [expenses, search, catFilter, empFilter, statusFilter, sortBy, sortDir])

  useEffect(() => { setPage(1) }, [search, catFilter, empFilter, statusFilter, sortBy, sortDir, month])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page])

  const canEdit     = ['accountant', 'admin', 'general_manager', 'manager'].includes(userRole)
  const canApprove  = userRole === 'admin'

  async function del(id) {
    if (!confirm('Delete this expense?')) return
    await fetch(`${API}/api/expenses/${id}`, { method: 'DELETE', headers: hdr() })
    load()
  }

  async function setStatus(id, status) {
    await fetch(`${API}/api/expenses/${id}/status`, { method: 'PATCH', headers: hdr(), body: JSON.stringify({ status }) })
    load()
  }

  function exportCSV() {
    const stations = [...new Set(expenses.map(e => e.emp_station).filter(Boolean))].sort()
    const rows = [['Expense Type', ...stations, 'Total']]
    for (const cat of CATEGORIES) {
      const exps = expenses.filter(e => e.category === cat.v)
      if (!exps.length) continue
      const sTotals = stations.map(st => exps.filter(e => e.emp_station === st).reduce((s, e) => s + Number(e.amount || 0), 0))
      rows.push([cat.v, ...sTotals.map(v => v || ''), exps.reduce((s, e) => s + Number(e.amount || 0), 0)])
    }
    const colTotals = stations.map(st => expenses.filter(e => e.emp_station === st).reduce((s, e) => s + Number(e.amount || 0), 0))
    rows.push(['Total', ...colTotals.map(v => v || ''), expenses.reduce((s, e) => s + Number(e.amount || 0), 0)])
    const csv = rows.map(r => r.join(',')).join('\n')
    const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv); a.download = `expenses-${month}.csv`; a.click()
  }

  return (
    <>
      <style>{CSS}</style>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'slideUp 0.3s ease' }}>

        {/* ── Hero ── */}
        <div style={{ background: 'linear-gradient(135deg,#0f1117 0%,#1a1f2e 50%,#1f1a2e 100%)', borderRadius: 16, padding: 24 }}>

          {/* Title row */}
          <div className="ex-hero-row">
            <div style={{ width: 46, height: 46, borderRadius: 14, background: 'rgba(251,191,36,0.15)', border: '1.5px solid rgba(251,191,36,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Receipt size={22} color="#FBBF24"/>
            </div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 20, color: 'white', letterSpacing: '-0.02em', lineHeight: 1.1 }}>Expenses</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 3 }}>
                {loading ? 'Loading…' : `${expenses.length} record${expenses.length !== 1 ? 's' : ''} · AED ${fmt(total)} this month`}
              </div>
            </div>
            <div className="ex-hero-actions" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <select value={month} onChange={e => setMonth(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '8px 13px', color: 'rgba(255,255,255,0.85)', fontSize: 12.5, outline: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                {MONTHS.map(m => <option key={m}>{m}</option>)}
              </select>
              {canEdit && (
                <button onClick={() => setModal('add')}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#F59E0B,#D97706)', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, whiteSpace: 'nowrap', transition: 'opacity 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                  <Plus size={14}/> Add Expense
                </button>
              )}
            </div>
          </div>

          {/* KPI tiles — Total/Approved/Pending double as status filters; click again to clear */}
          <div className="ex-kpi">
            {[
              { label: 'Total',     val: `AED ${fmt(total)}`,        color: '#F5F5F5',  sub: `${expenses.length} records`, filterValue: 'all' },
              { label: 'Approved',  val: `AED ${fmt(approvedAmt)}`,  color: '#4ADE80',  sub: `${expenses.filter(e=>e.status==='approved').length} entries`, filterValue: 'approved' },
              { label: 'Pending',   val: pendingCount,               color: '#FBBF24',  sub: 'awaiting approval', filterValue: 'pending' },
              { label: 'Employees', val: byEmp.length,               color: '#A78BFA',  sub: 'with expenses'                 },
            ].map(k => {
              const isActive = k.filterValue && statusFilter === k.filterValue
              return (
                <div key={k.label}
                  onClick={k.filterValue ? () => setStatusFilter(s => s === k.filterValue ? 'all' : k.filterValue) : undefined}
                  style={{
                    background: isActive ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${isActive ? k.color : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: 12, padding: '14px 16px',
                    cursor: k.filterValue ? 'pointer' : 'default',
                    transition: 'background 0.15s, border-color 0.15s',
                  }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: k.color, lineHeight: 1.1 }}>
                    {loading ? <span style={{ opacity: 0.25 }}>—</span> : k.val}
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>{k.label}</div>
                  {!loading && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', marginTop: 2 }}>{k.sub}</div>}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Analytics (collapsible) ── */}
        {!loading && (byCat.length > 0 || byEmp.length > 0) && (
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
            <button onClick={() => setShowCharts(p => !p)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 18px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={14} color="#FBBF24"/>
                <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--text)' }}>Analytics</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Spending breakdown for {month}</span>
              </div>
              <ChevronDown size={15} color="var(--text-muted)" style={{ transform: showCharts ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}/>
            </button>

            {showCharts && (
              <div style={{ padding: '0 14px 14px' }}>
                <div className="ex-charts">

                  {/* Donut — by category */}
                  {byCat.length > 0 && (
                    <div style={{ background: 'var(--bg-alt)', borderRadius: 12, padding: 16 }}>
                      <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--text)', marginBottom: 10 }}>By Category</div>
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                        <PieChart width={130} height={120}>
                          <Pie data={byCat} cx={60} cy={55} innerRadius={30} outerRadius={52} paddingAngle={3} dataKey="value">
                            {byCat.map(c => <Cell key={c.name} fill={c.color}/>)}
                          </Pie>
                          <Tooltip content={<Tip/>}/>
                        </PieChart>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {byCat.slice(0, 5).map(c => (
                          <div key={c.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ width: 7, height: 7, borderRadius: 2, background: c.color, flexShrink: 0 }}/>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: c.color }}>AED {fmt(c.value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bar — top categories */}
                  {byCat.length > 0 && (
                    <div style={{ background: 'var(--bg-alt)', borderRadius: 12, padding: 16 }}>
                      <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--text)', marginBottom: 10 }}>Top Spending</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                        {byCat.slice(0, 6).map(c => {
                          const pct = byCat[0]?.value > 0 ? Math.round(c.value / byCat[0].value * 100) : 0
                          return (
                            <div key={c.name}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <span style={{ fontSize: 11.5, color: 'var(--text)', fontWeight: 500 }}>{c.short}</span>
                                <span style={{ fontSize: 11.5, fontWeight: 700, color: c.color }}>AED {fmt(c.value)}</span>
                              </div>
                              <div style={{ height: 5, background: 'var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${pct}%`, background: c.color, borderRadius: 10, transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)' }}/>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Bar — employees */}
                  {byEmp.length > 0 && (
                    <div style={{ background: 'var(--bg-alt)', borderRadius: 12, padding: 16 }}>
                      <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--text)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Users size={13} color="#FBBF24"/> By Employee
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                        {byEmp.slice(0, 6).map((e, i) => {
                          const pct = byEmp[0]?.value > 0 ? Math.round(e.value / byEmp[0].value * 100) : 0
                          const c   = EMP_COLORS[i] || '#94A3B8'
                          return (
                            <div key={e.id || e.name}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <span style={{ fontSize: 11.5, color: 'var(--text)', fontWeight: 500, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</span>
                                <span style={{ fontSize: 11.5, fontWeight: 700, color: c }}>AED {fmt(e.value)}</span>
                              </div>
                              <div style={{ height: 5, background: 'var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${pct}%`, background: c, borderRadius: 10, transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)' }}/>
                              </div>
                              <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 2 }}>{e.count} record{e.count !== 1 ? 's' : ''}</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Costwise Summary Table ── */}
        {!loading && expenses.length > 0 && (() => {
          const stations   = [...new Set(expenses.map(e => e.emp_station).filter(Boolean))].sort()
          const catRows    = CATEGORIES.filter(cat => expenses.some(e => e.category === cat.v))
          const catTotals  = catRows.map(cat => ({
            cat,
            sts: stations.map(st => expenses.filter(e => e.category === cat.v && e.emp_station === st).reduce((s, e) => s + Number(e.amount || 0), 0)),
            row: expenses.filter(e => e.category === cat.v).reduce((s, e) => s + Number(e.amount || 0), 0),
          }))
          const colTotals  = stations.map(st => expenses.filter(e => e.emp_station === st).reduce((s, e) => s + Number(e.amount || 0), 0))
          const grandTotal = expenses.reduce((s, e) => s + Number(e.amount || 0), 0)
          if (!catRows.length) return null
          const TH = { padding: '10px 14px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', background: 'var(--bg-alt)', borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap', textAlign: 'right' }
          const TD = { padding: '9px 14px', fontSize: 12.5, color: 'var(--text)', borderBottom: '1px solid var(--border)', textAlign: 'right', whiteSpace: 'nowrap' }
          return (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '13px 18px 11px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 13.5, color: 'var(--text)' }}>Costwise Summary</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>By category × station</div>
                </div>
                <button onClick={exportCSV}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 20, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#10B981', fontWeight: 700, fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <Download size={12}/> CSV
                </button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...TH, textAlign: 'left', position: 'sticky', left: 0, zIndex: 1, minWidth: 160 }}>Expense Type</th>
                      {stations.map(st => <th key={st} style={TH}>{st}</th>)}
                      <th style={{ ...TH, color: '#FBBF24' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catTotals.map(({ cat, sts, row }) => (
                      <tr key={cat.v}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-alt)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ ...TD, textAlign: 'left', position: 'sticky', left: 0, background: 'var(--card)', fontWeight: 600 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <div style={{ width: 8, height: 8, borderRadius: 2, background: cat.c, flexShrink: 0 }}/>
                            <span style={{ color: cat.c }}>{cat.v}</span>
                          </div>
                        </td>
                        {sts.map((v, i) => (
                          <td key={stations[i]} style={{ ...TD, color: v > 0 ? 'var(--text)' : 'var(--text-muted)', opacity: v > 0 ? 1 : 0.4 }}>
                            {v > 0 ? fmt(v) : '—'}
                          </td>
                        ))}
                        <td style={{ ...TD, fontWeight: 800, color: '#FBBF24' }}>{fmt(row)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid var(--border)' }}>
                      <td style={{ ...TD, textAlign: 'left', position: 'sticky', left: 0, background: 'var(--bg-alt)', fontWeight: 800, color: 'var(--text)' }}>Total</td>
                      {colTotals.map((v, i) => (
                        <td key={stations[i]} style={{ ...TD, background: 'var(--bg-alt)', fontWeight: 700, color: '#FBBF24' }}>{v > 0 ? fmt(v) : '—'}</td>
                      ))}
                      <td style={{ ...TD, background: 'var(--bg-alt)', fontWeight: 900, color: '#FBBF24', fontSize: 14 }}>{fmt(grandTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )
        })()}

        {/* ── Filters ── */}
        <div className="ex-filters">
          <div className="ex-search-wrap" style={{ flex: '1 1 200px', position: 'relative', minWidth: 160 }}>
            <Search size={13} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}/>
            <input
              style={{ width: '100%', paddingLeft: 36, paddingRight: 12, paddingTop: 9, paddingBottom: 9, borderRadius: 24, border: '1.5px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
              placeholder="Search name, description…"
              value={search} onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select value={empFilter} onChange={e => setEmpFilter(e.target.value)} className="ex-select">
            <option value="all">All Employees</option>
            {byEmp.map(e => <option key={e.id || e.name} value={e.id}>{e.name}</option>)}
          </select>
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="ex-select">
            <option value="all">All Categories</option>
            {CATEGORIES.map(c => <option key={c.v} value={c.v}>{c.v}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="ex-select">
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <select value={sortBy} onChange={e => { setSortBy(e.target.value); setSortDir(SORT_DEFAULT_DIR[e.target.value] || 'desc') }} className="ex-select">
            <option value="date">Sort: Date</option>
            <option value="amount">Sort: Amount</option>
            <option value="emp">Sort: Employee</option>
            <option value="cat">Sort: Category</option>
          </select>
          <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
            title={sortDir === 'asc' ? 'Ascending — click to reverse' : 'Descending — click to reverse'}
            style={{ width: 34, height: 34, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', border: '1.5px solid var(--border)', background: 'var(--card)', color: 'var(--text)', cursor: 'pointer' }}>
            {sortDir === 'asc' ? <ArrowUp size={13}/> : <ArrowDown size={13}/>}
          </button>
          {filtered.length > 0 && (
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
              {filtered.length} result{filtered.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* ── Expense List ── */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="ex-skel" style={{ height: 88, opacity: 1 - (i - 1) * 0.15 }}/>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--card)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <Receipt size={28} style={{ opacity: 0.2 }}/>
            </div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 6 }}>
              {expenses.length === 0 ? 'No expenses this month' : 'No results match your filters'}
            </div>
            <div style={{ fontSize: 13 }}>
              {expenses.length === 0 ? 'Add your first expense using the button above.' : 'Try adjusting filters or search.'}
            </div>
            {expenses.length === 0 && canEdit && (
              <button onClick={() => setModal('add')}
                style={{ marginTop: 18, padding: '10px 24px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#F59E0B,#D97706)', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                <Plus size={13} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }}/> Add Expense
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {paginated.map((exp, i) => {
              const cat       = CAT_MAP[exp.category] || { c: '#94A3B8', I: Tag }
              const CatIcon   = cat.I
              const isPending  = exp.status === 'pending'
              const isRejected = exp.status === 'rejected'
              const statusC    = isPending ? '#FBBF24' : isRejected ? '#F87171' : '#34D399'
              const statusBg   = isPending ? 'rgba(251,191,36,0.1)' : isRejected ? 'rgba(248,113,113,0.1)' : 'rgba(52,211,153,0.1)'
              const statusLabel = isPending ? 'Pending' : isRejected ? 'Rejected' : 'Approved'

              return (
                <div key={exp.id} className="ex-card" style={{ animation: `slideUp 0.28s ${Math.min(i, 10) * 0.025}s ease both` }}>
                  {/* Category accent bar */}
                  <div style={{ height: 3, background: `linear-gradient(90deg,${cat.c},${cat.c}55)` }}/>

                  <div style={{ padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 13 }}>
                    {/* Icon */}
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: `${cat.c}15`, border: `1.5px solid ${cat.c}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <CatIcon size={19} color={cat.c}/>
                    </div>

                    {/* Main content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', lineHeight: 1.2 }}>
                            {exp.emp_name || exp.emp_id || 'Company Expense'}
                          </div>
                          <div style={{ fontSize: 11, color: cat.c, fontWeight: 600, marginTop: 2 }}>
                            {exp.category}
                          </div>
                          {exp.description && (
                            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>
                              {stripRefTag(exp.description)}
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontWeight: 900, fontSize: 17, color: 'var(--text)', letterSpacing: '-0.03em' }}>
                            AED {fmt(exp.amount)}
                          </div>
                          <span style={{ display: 'inline-block', marginTop: 4, fontSize: 10.5, fontWeight: 700, color: statusC, background: statusBg, borderRadius: 20, padding: '2px 9px' }}>
                            {statusLabel}
                          </span>
                        </div>
                      </div>

                      {/* Footer */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 8 }}>
                          <span>{exp.date?.slice(0, 10)}</span>
                          {exp.month && <span>· {exp.month}</span>}
                          {exp.emp_station && <span style={{ fontWeight: 600 }}>· {exp.emp_station}</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 5 }}>
                          {canApprove && isPending && (
                            <>
                              <button onClick={() => setStatus(exp.id, 'approved')}
                                style={{ padding: '4px 11px', borderRadius: 8, background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', color: '#34D399', fontWeight: 700, fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Check size={10}/> Approve
                              </button>
                              <button onClick={() => setStatus(exp.id, 'rejected')}
                                style={{ padding: '4px 9px', borderRadius: 8, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)', color: '#EF4444', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center' }}>
                                <X size={11}/>
                              </button>
                            </>
                          )}
                          {canEdit && (
                            <>
                              <button onClick={() => setModal(exp)}
                                style={{ padding: '4px 11px', borderRadius: 8, background: 'var(--bg-alt)', border: '1px solid var(--border)', color: 'var(--text)', fontWeight: 600, fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4, transition: 'background 0.15s' }}>
                                <Pencil size={10}/> Edit
                              </button>
                              <button onClick={() => del(exp.id)}
                                style={{ padding: '4px 9px', borderRadius: 8, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)', color: '#EF4444', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', transition: 'background 0.15s' }}>
                                <Trash2 size={11}/>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Pagination ── */}
        {!loading && totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 2px' }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              style={{ padding: '7px 14px', borderRadius: 20, border: '1.5px solid var(--border)', background: 'var(--card)', color: page <= 1 ? 'var(--text-muted)' : 'var(--text)', fontWeight: 600, fontSize: 12.5, cursor: page <= 1 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: page <= 1 ? 0.5 : 1 }}>
              ← Prev
            </button>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Page {page} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              style={{ padding: '7px 14px', borderRadius: 20, border: '1.5px solid var(--border)', background: 'var(--card)', color: page >= totalPages ? 'var(--text-muted)' : 'var(--text)', fontWeight: 600, fontSize: 12.5, cursor: page >= totalPages ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: page >= totalPages ? 0.5 : 1 }}>
              Next →
            </button>
          </div>
        )}

      </div>

      {/* ── Modal ── */}
      {(modal === 'add' || (typeof modal === 'object' && modal?.id)) && (
        <ExpenseModal
          expense={typeof modal === 'object' ? modal : null}
          employees={employees}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); load() }}
        />
      )}
    </>
  )
}
