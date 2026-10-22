'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth'
import {
  Wallet, Plus, ArrowDownLeft, ArrowUpRight,
  ChevronLeft, ChevronRight, X, Users, TrendingDown,
} from 'lucide-react'

import { API } from '@/lib/api'
const hdr = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('gcd_token') : ''}`,
})

const EXPENSE_TYPES = [
  'ADVANCES', 'AIR TICKETS', 'CASH VARIANCE', 'FINE', 'Fuel',
  'INCENTIVE', 'INCENTIVE DEDUCTIONS', 'Miscellaneous Exp.', 'Mobile Expenses',
  'OverTime', 'Parking Fee', 'RTA PARKING TOPUP', 'RTA TOPUP',
  'Salik', 'Vehicle Damage', 'Vehicle Expenses',
]

const ROLE_LABELS = {
  admin: 'Admin', general_manager: 'Manager', hr: 'HR',
  accountant: 'Accountant', poc: 'POC',
}

const ROLE_EMOJI = {
  general_manager: '🎯', hr: '👥', accountant: '💰', poc: '📡', admin: '👑',
}

function fmt(n) {
  return `AED ${Math.abs(Number(n || 0)).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function Lbl({ children }) {
  return (
    <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 5 }}>
      {children}
    </label>
  )
}

/* ── Expense Modal ──────────────────────────────────────────── */
function ExpenseModal({ onSave, onClose }) {
  const [form, setForm] = useState({
    expense_type: '', amount: '', note: '',
    date: new Date().toISOString().slice(0, 10),
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  async function handleSave() {
    if (!form.expense_type || !form.amount) return setErr('Expense type and amount required')
    const amt = parseFloat(form.amount)
    if (isNaN(amt) || amt <= 0) return setErr('Amount must be positive')
    setSaving(true); setErr(null)
    try {
      const res = await fetch(`${API}/api/petty-cash/expense`, {
        method: 'POST', headers: hdr(),
        body: JSON.stringify({ expense_type: form.expense_type, amount: amt, note: form.note || null, date: form.date }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onSave()
    } catch (e) { setErr(e.message) } finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ background: 'var(--card)', borderRadius: 20, width: '100%', maxWidth: 440, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>Record Expense</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Log a petty cash expense</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4 }}><X size={18} /></button>
        </div>
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {err && <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#DC2626' }}>{err}</div>}
          <div>
            <Lbl>Expense Type</Lbl>
            <select className="input" value={form.expense_type} onChange={set('expense_type')} style={{ borderRadius: 10 }}>
              <option value="">Select type…</option>
              {EXPENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <Lbl>Amount (AED)</Lbl>
            <input className="input" type="number" min="0.01" step="0.01" value={form.amount} onChange={set('amount')} placeholder="0.00" style={{ borderRadius: 10 }} />
          </div>
          <div>
            <Lbl>Date</Lbl>
            <input className="input" type="date" value={form.date} onChange={set('date')} style={{ borderRadius: 10 }} />
          </div>
          <div>
            <Lbl>Note (optional)</Lbl>
            <input className="input" value={form.note} onChange={set('note')} placeholder="Add a note…" style={{ borderRadius: 10 }} />
          </div>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: '12px', borderRadius: 12, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', background: saving ? 'var(--border)' : 'linear-gradient(135deg,#7A5906,#8F6807)', color: saving ? 'var(--text-muted)' : 'white', fontWeight: 700, fontSize: 14, fontFamily:'inherit', marginTop: 4, transition: 'all 0.2s' }}>
            {saving ? 'Saving…' : 'Record Expense'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Allocate Modal ─────────────────────────────────────────── */
function AllocateModal({ users, onSave, onClose }) {
  const [form, setForm] = useState({
    user_id: '', amount: '', note: '',
    date: new Date().toISOString().slice(0, 10),
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  async function handleSave() {
    if (!form.user_id || !form.amount) return setErr('User and amount required')
    const amt = parseFloat(form.amount)
    if (isNaN(amt) || amt <= 0) return setErr('Amount must be positive')
    setSaving(true); setErr(null)
    try {
      const res = await fetch(`${API}/api/petty-cash/allocate`, {
        method: 'POST', headers: hdr(),
        body: JSON.stringify({ user_id: form.user_id, amount: amt, note: form.note || null, date: form.date }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onSave()
    } catch (e) { setErr(e.message) } finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ background: 'var(--card)', borderRadius: 20, width: '100%', maxWidth: 440, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>Give Petty Cash</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Allocate cash to a team member</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4 }}><X size={18} /></button>
        </div>
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {err && <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#DC2626' }}>{err}</div>}
          <div>
            <Lbl>Give To</Lbl>
            <select className="input" value={form.user_id} onChange={set('user_id')} style={{ borderRadius: 10 }}>
              <option value="">Select user…</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} ({ROLE_LABELS[u.role] || u.role})
                </option>
              ))}
            </select>
          </div>
          <div>
            <Lbl>Amount (AED)</Lbl>
            <input className="input" type="number" min="0.01" step="0.01" value={form.amount} onChange={set('amount')} placeholder="0.00" style={{ borderRadius: 10 }} />
          </div>
          <div>
            <Lbl>Date</Lbl>
            <input className="input" type="date" value={form.date} onChange={set('date')} style={{ borderRadius: 10 }} />
          </div>
          <div>
            <Lbl>Note (optional)</Lbl>
            <input className="input" value={form.note} onChange={set('note')} placeholder="e.g. March operational expenses" style={{ borderRadius: 10 }} />
          </div>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: '12px', borderRadius: 12, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', background: saving ? 'var(--border)' : 'linear-gradient(135deg,#7A5906,#8F6807)', color: saving ? 'var(--text-muted)' : 'white', fontWeight: 700, fontSize: 14, fontFamily:'inherit', marginTop: 4, transition: 'all 0.2s' }}>
            {saving ? 'Giving…' : 'Give Cash'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Transaction Row ────────────────────────────────────────── */
function TxRow({ record, canDelete, onDelete }) {
  const isAlloc = record.type === 'allocation'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-alt)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isAlloc ? 'rgba(251,191,36,0.15)' : 'rgba(239,68,68,0.1)' }}>
        {isAlloc
          ? <ArrowDownLeft size={16} color="#F59E0B" />
          : <ArrowUpRight size={16} color="#EF4444" />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
          {isAlloc ? 'Cash Received' : record.expense_type}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {record.note || (isAlloc ? `From ${record.created_by_name || 'Accountant'}` : record.date)}
        </div>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: isAlloc ? '#F59E0B' : '#EF4444', flexShrink: 0 }}>
        {isAlloc ? '+' : '-'}{fmt(record.amount)}
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', flexShrink: 0, minWidth: 72, textAlign: 'right' }}>
        {record.date}
      </div>
      {canDelete && (
        <button onClick={() => onDelete(record.id)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex', borderRadius: 6, flexShrink: 0 }}
          onMouseEnter={e => e.currentTarget.style.color = '#EF4444'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
          <X size={14} />
        </button>
      )}
    </div>
  )
}

/* ── User Detail Panel (accountant drill-down) ──────────────── */
function UserDetailPanel({ userId, userName, userRole, onBack, canDelete }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/petty-cash/user/${userId}`, { headers: hdr() })
      const d = await res.json()
      setData(d)
    } catch { } finally { setLoading(false) }
  }, [userId])

  useEffect(() => { load() }, [load])

  async function handleDelete(id) {
    if (!confirm('Delete this record?')) return
    await fetch(`${API}/api/petty-cash/${id}`, { method: 'DELETE', headers: hdr() })
    load()
  }

  const balance = Number(data?.balance || 0)
  const isNeg = balance < 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <button onClick={onBack}
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, padding: 0, fontFamily:'inherit', alignSelf: 'flex-start' }}>
        <ChevronLeft size={14} /> Back to Overview
      </button>

      {/* User balance card */}
      <div style={{ background: isNeg ? 'linear-gradient(135deg,#1A0A0A,#2C1212)' : 'linear-gradient(135deg,#0D1F12,#133A1F)', borderRadius: 16, padding: '20px 22px', color: 'white' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg,#7A5906,#8F6807)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18 }}>
            {ROLE_EMOJI[userRole] || '👤'}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{userName}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{ROLE_LABELS[userRole] || userRole}</div>
          </div>
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, color: isNeg ? '#FCA5A5' : '#6EE7B7', letterSpacing: '-0.03em' }}>
          {isNeg ? '-' : ''}{fmt(balance)}
        </div>
        <div style={{ display: 'flex', gap: 20, marginTop: 12 }}>
          <div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Total Received</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#FCD34D' }}>{fmt(data?.total_allocated || 0)}</div>
          </div>
          <div style={{ width: 1, background: 'rgba(255,255,255,0.1)' }} />
          <div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Total Recorded</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#6EE7B7' }}>{fmt(data?.total_spent || 0)}</div>
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 13.5, color: 'var(--text)' }}>
          Transaction History
        </div>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>
        ) : !data?.records?.length ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No transactions yet</div>
        ) : (
          data.records.map(r => <TxRow key={r.id} record={r} canDelete={canDelete} onDelete={handleDelete} />)
        )}
      </div>
    </div>
  )
}

/* ── Main Page ──────────────────────────────────────────────── */
export default function PettyCashPage() {
  const { user } = useAuth()
  const [myData, setMyData]   = useState(null)
  const [summary, setSummary] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(null)       // 'expense' | 'allocate'
  const [drillUser, setDrillUser] = useState(null)   // { id, name, role }
  const [tab, setTab]         = useState('my')       // 'my' | 'team'

  const canManage  = ['admin', 'accountant', 'general_manager'].includes(user?.role)
  const canDelete  = ['admin', 'accountant'].includes(user?.role)

  const load = useCallback(async () => {
    try {
      const fetches = [
        fetch(`${API}/api/petty-cash/my`, { headers: hdr() }).then(r => r.json()),
      ]
      if (canManage) {
        fetches.push(
          fetch(`${API}/api/petty-cash/summary`, { headers: hdr() }).then(r => r.json()),
          fetch(`${API}/api/auth/users`, { headers: hdr() }).then(r => r.json()),
        )
      }
      const results = await Promise.all(fetches)
      setMyData(results[0])
      if (canManage) {
        setSummary(results[1]?.summary || [])
        setAllUsers((results[2]?.users || []).filter(u => u.role !== 'driver' && u.id !== user?.id))
      }
    } catch { } finally { setLoading(false) }
  }, [canManage, user?.id])

  useEffect(() => { load() }, [load])

  async function handleDeleteMy(id) {
    if (!confirm('Delete this record?')) return
    await fetch(`${API}/api/petty-cash/${id}`, { method: 'DELETE', headers: hdr() })
    load()
  }

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>
  )

  // Drill-down into a user (accountant view)
  if (drillUser) {
    return (
      <div style={{ maxWidth: 660, margin: '0 auto' }}>
        <UserDetailPanel
          userId={drillUser.id}
          userName={drillUser.name}
          userRole={drillUser.role}
          onBack={() => setDrillUser(null)}
          canDelete={canDelete}
        />
      </div>
    )
  }

  const balance = Number(myData?.balance || 0)
  const isNeg   = balance < 0

  // Summary stats for accountant team tab
  const totalAllocatedAll = summary.reduce((s, u) => s + Number(u.total_allocated || 0), 0)
  const totalSpentAll     = summary.reduce((s, u) => s + Number(u.total_spent || 0), 0)
  const unaccounted       = summary.filter(u => Number(u.balance) < 0).length

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Hero ── */}
      <div style={{ background: 'linear-gradient(135deg,#1A1612 0%,#2C1F0A 100%)', borderRadius: 20, padding: '24px', color: 'white', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: -30, top: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(184,134,11,0.15)' }} />
        <div style={{ position: 'absolute', right: 40, bottom: -40, width: 80, height: 80, borderRadius: '50%', background: 'rgba(184,134,11,0.1)' }} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(135deg,#7A5906,#8F6807)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 14px rgba(184,134,11,0.4)' }}>
              <Wallet size={26} color="white" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em', lineHeight: 1.2 }}>Petty Cash</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 3 }}>
                {user?.name} · <span style={{ color: '#D4A017', fontWeight: 600 }}>{ROLE_LABELS[user?.role] || user?.role}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {/* Give Cash — accountant/manager only */}
            {canManage && (
              <button onClick={() => setModal('allocate')}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 12, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#7A5906,#8F6807)', color: 'white', fontWeight: 700, fontSize: 13, fontFamily:'inherit' }}>
                <Plus size={14} /> Give Cash
              </button>
            )}
            {/* Record Expense — everyone */}
            <button onClick={() => setModal('expense')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', background: 'rgba(255,255,255,0.1)', color: 'white', fontWeight: 600, fontSize: 13, fontFamily:'inherit' }}>
              <Plus size={14} /> Record Expense
            </button>
          </div>
        </div>
      </div>

      {/* ── Tabs (accountant/manager only) ── */}
      {canManage && (
        <div style={{ display: 'flex', gap: 8 }}>
          {[['my', 'My Balance'], ['team', 'Team Overview']].map(([v, l]) => (
            <button key={v} onClick={() => setTab(v)}
              style={{ padding: '8px 18px', borderRadius: 20, border: `1px solid ${tab === v ? '#8F6807' : 'var(--border)'}`, background: tab === v ? 'linear-gradient(135deg,#7A5906,#8F6807)' : 'var(--card)', color: tab === v ? 'white' : 'var(--text)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily:'inherit', transition: 'all 0.2s' }}>
              {l}
            </button>
          ))}
        </div>
      )}

      {/* ── My Balance Tab ── */}
      {tab === 'my' && (
        <>
          {/* Balance card */}
          <div style={{ background: isNeg ? 'linear-gradient(135deg,#1A0A0A,#2C1212)' : 'linear-gradient(135deg,#0D1F12,#133A1F)', borderRadius: 16, padding: '20px 22px', color: 'white' }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Your Balance</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: isNeg ? '#FCA5A5' : '#6EE7B7', letterSpacing: '-0.03em' }}>
              {isNeg ? '-' : ''}{fmt(balance)}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
              {isNeg
                ? `${fmt(Math.abs(balance))} remaining to record as expenses`
                : balance === 0 ? 'Fully accounted — nothing pending'
                : 'All expenses recorded'}
            </div>
            <div style={{ display: 'flex', gap: 20, marginTop: 14 }}>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Total Received</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#FCD34D' }}>{fmt(myData?.total_allocated || 0)}</div>
              </div>
              <div style={{ width: 1, background: 'rgba(255,255,255,0.1)' }} />
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Total Recorded</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#6EE7B7' }}>{fmt(myData?.total_spent || 0)}</div>
              </div>
            </div>
          </div>

          {/* Transaction history */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 13.5, color: 'var(--text)' }}>
              Transaction History
            </div>
            {!myData?.records?.length ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                No transactions yet
              </div>
            ) : (
              myData.records.map(r => (
                <TxRow key={r.id} record={r} canDelete={canDelete} onDelete={handleDeleteMy} />
              ))
            )}
          </div>
        </>
      )}

      {/* ── Team Overview Tab ── */}
      {tab === 'team' && (
        <>
          {/* Stats row */}
          <div className="r-grid-3">
            {[
              { label: 'Total Distributed', value: fmt(totalAllocatedAll), color: '#F59E0B', icon: <Wallet size={16} /> },
              { label: 'Total Recorded', value: fmt(totalSpentAll), color: '#10B981', icon: <ArrowUpRight size={16} /> },
              { label: 'Unaccounted Users', value: unaccounted, color: unaccounted > 0 ? '#EF4444' : '#10B981', icon: <Users size={16} /> },
            ].map((s, i) => (
              <div key={i} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: s.color, marginBottom: 6 }}>
                  {s.icon}
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{s.label}</span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Users table */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 13.5, color: 'var(--text)' }}>
              All Users
            </div>
            {!summary.length ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No records yet</div>
            ) : (
              summary.map(u => {
                const bal = Number(u.balance)
                const neg = bal < 0
                return (
                  <div key={u.id}
                    onClick={() => setDrillUser({ id: u.id, name: u.name, role: u.role })}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-alt)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ width: 38, height: 38, borderRadius: 11, background: 'linear-gradient(135deg,#7A5906,#8F6807)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 17 }}>
                      {ROLE_EMOJI[u.role] || '👤'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{u.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {ROLE_LABELS[u.role] || u.role}
                        {Number(u.transaction_count) > 0 && ` · ${u.transaction_count} transactions`}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: neg ? '#EF4444' : '#10B981' }}>
                        {neg ? '-' : ''}{fmt(Math.abs(bal))}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                        {neg ? 'Unaccounted' : 'Clear'}
                      </div>
                    </div>
                    <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  </div>
                )
              })
            )}
          </div>
        </>
      )}

      {/* Modals */}
      {modal === 'expense'  && <ExpenseModal  onSave={() => { setModal(null); load() }} onClose={() => setModal(null)} />}
      {modal === 'allocate' && <AllocateModal users={allUsers} onSave={() => { setModal(null); load() }} onClose={() => setModal(null)} />}
    </div>
  )
}
