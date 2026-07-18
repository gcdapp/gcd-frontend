'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { empApi, expenseApi, API } from '@/lib/api'
import { getEmp, setEmp as cacheEmp } from '@/lib/empCache'
import { hdr, getUserRole, fmt, stripRefTag } from '@/lib/employees'
import PageHero from '@/components/employees/PageHero'
import BackLink from '@/components/employees/BackLink'
import ExpenseModal, { CAT_MAP } from '@/components/expenses/ExpenseModal'
import { Plus, Pencil, Trash2, Check, X, Receipt, Tag, ArrowUp, ArrowDown } from 'lucide-react'

// Natural default direction per field (newest/highest/A-Z first) — applied
// whenever the field changes, so switching fields doesn't feel backwards.
const SORT_DEFAULT_DIR = { date: 'desc', amount: 'desc', cat: 'asc' }

export default function DriverExpensesPage() {
  const { id } = useParams()
  const router = useRouter()
  const [emp,       setEmp]      = useState(() => getEmp(id))
  const [expenses,  setExpenses] = useState([])
  const [loading,   setLoading]  = useState(true)
  const [modal,     setModal]    = useState(null) // 'add' | expense object
  const [userRole,  setUserRole] = useState(null)
  const [sortBy,    setSortBy]   = useState('date')
  const [sortDir,   setSortDir]  = useState('desc')

  useEffect(() => { setUserRole(getUserRole()) }, [])
  useEffect(() => { empApi.get(id).then(d => { setEmp(d.employee); cacheEmp(d.employee) }).catch(() => setEmp(prev => prev)) }, [id])

  const load = useCallback(() => {
    setLoading(true)
    expenseApi.list({ emp_id: id }).then(d => setExpenses(d.expenses || [])).catch(() => setExpenses([])).finally(() => setLoading(false))
  }, [id])
  useEffect(() => { load() }, [load])

  const canEdit    = ['accountant','admin','general_manager','manager'].includes(userRole)
  // POC can edit an entry but not delete it — same split as the main Expenses page.
  const canEditRow = canEdit || userRole === 'poc'
  const canApprove = userRole === 'admin'

  async function del(expId) {
    if (!confirm('Delete this expense?')) return
    await fetch(`${API}/api/expenses/${expId}`, { method: 'DELETE', headers: hdr() })
    load()
  }
  async function setStatus(expId, status) {
    await fetch(`${API}/api/expenses/${expId}/status`, { method: 'PATCH', headers: hdr(), body: JSON.stringify({ status }) })
    load()
  }

  const total    = expenses.reduce((s, e) => s + Number(e.amount || 0), 0)
  const approved = expenses.filter(e => e.status === 'approved').reduce((s, e) => s + Number(e.amount || 0), 0)
  const pending  = expenses.filter(e => e.status === 'pending').length

  const sorted = useMemo(() => {
    return [...expenses].sort((a, b) => {
      let cmp = 0
      if (sortBy === 'amount')   cmp = Number(a.amount) - Number(b.amount)
      else if (sortBy === 'cat') cmp = a.category.localeCompare(b.category)
      else                       cmp = new Date(a.date || a.created_at) - new Date(b.date || b.created_at)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [expenses, sortBy, sortDir])

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14, animation:'slideUp 0.3s ease' }}>
      <BackLink router={router} href={`/dashboard/hr/employees/${id}`} label={`Back to ${emp?.name || 'Driver'}`}/>

      <PageHero icon={Receipt} iconColor="#D97706" iconBg="rgba(217,119,6,0.15)" iconBorder="rgba(217,119,6,0.35)"
        title={`Expenses — ${emp?.name || '…'}`}
        subtitle={loading ? 'Loading…' : `${expenses.length} record${expenses.length!==1?'s':''} · AED ${fmt(total)} total`}
        actions={
          <button onClick={()=>setModal('add')}
            style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 18px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#F59E0B,#D97706)', color:'white', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
            <Plus size={14}/> Add Expense
          </button>
        }>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginTop:20 }}>
          {[
            { label:'Total',    val:`AED ${fmt(total)}`,    color:'#F5F5F5' },
            { label:'Approved', val:`AED ${fmt(approved)}`, color:'#4ADE80' },
            { label:'Pending',  val:pending,                 color:'#FBBF24' },
          ].map(k => (
            <div key={k.label} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, padding:'14px 16px' }}>
              <div style={{ fontSize:22, fontWeight:800, color:k.color, lineHeight:1.1 }}>{loading ? '—' : k.val}</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.38)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', marginTop:4 }}>{k.label}</div>
            </div>
          ))}
        </div>
      </PageHero>

      {/* Sort controls */}
      {!loading && expenses.length > 0 && (
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <select value={sortBy} onChange={e => { setSortBy(e.target.value); setSortDir(SORT_DEFAULT_DIR[e.target.value] || 'desc') }}
            className="input" style={{ width:'auto', padding:'8px 30px 8px 12px', borderRadius:24, fontSize:12.5 }}>
            <option value="date">Sort: Date</option>
            <option value="amount">Sort: Amount</option>
            <option value="cat">Sort: Category</option>
          </select>
          <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
            title={sortDir === 'asc' ? 'Ascending — click to reverse' : 'Descending — click to reverse'}
            style={{ width:34, height:34, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:'50%', border:'1.5px solid var(--border)', background:'var(--card)', color:'var(--text)', cursor:'pointer' }}>
            {sortDir === 'asc' ? <ArrowUp size={13}/> : <ArrowDown size={13}/>}
          </button>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {[1,2,3].map(i => <div key={i} className="sk" style={{ height:80, borderRadius:16 }}/>)}
        </div>
      ) : expenses.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--text-muted)' }}>
          <Receipt size={32} style={{ margin:'0 auto 12px', display:'block', opacity:0.2 }}/>
          <div style={{ fontWeight:700, fontSize:15, color:'var(--text)', marginBottom:6 }}>No expenses yet</div>
          <div style={{ fontSize:13 }}>Add the first expense for {emp?.name || 'this driver'} using the button above.</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {sorted.map((ex, i) => {
            const cat        = CAT_MAP[ex.category] || { c:'#94A3B8', I:Tag }
            const CatIcon    = cat.I
            const isPending  = ex.status === 'pending'
            const isRejected = ex.status === 'rejected'
            const statusC    = isPending ? '#D97706' : isRejected ? '#DC2626' : '#059669'
            const statusBg   = isPending ? '#FFFBEB' : isRejected ? '#FEF2F2' : '#F0FDF4'
            const statusLabel= isPending ? 'Pending' : isRejected ? 'Rejected' : 'Approved'

            return (
              <div key={ex.id} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, overflow:'hidden', animation:`slideUp 0.25s ${Math.min(i,10)*0.025}s ease both` }}>
                <div style={{ height:3, background:`linear-gradient(90deg,${cat.c},${cat.c}55)` }}/>
                <div style={{ padding:'13px 16px', display:'flex', alignItems:'center', gap:13 }}>
                  <div style={{ width:44, height:44, borderRadius:12, background:`${cat.c}15`, border:`1.5px solid ${cat.c}28`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <CatIcon size={19} color={cat.c}/>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                      <div style={{ minWidth:0 }}>
                        <div style={{ fontSize:11, color:cat.c, fontWeight:700 }}>{ex.category}</div>
                        {ex.description && <div style={{ fontSize:12.5, color:'var(--text)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:320 }}>{stripRefTag(ex.description)}</div>}
                      </div>
                      <div style={{ textAlign:'right', flexShrink:0 }}>
                        <div style={{ fontWeight:900, fontSize:17, color:'var(--text)', letterSpacing:'-0.03em' }}>AED {fmt(ex.amount)}</div>
                        <span style={{ display:'inline-block', marginTop:4, fontSize:10.5, fontWeight:700, color:statusC, background:statusBg, borderRadius:20, padding:'2px 9px' }}>{statusLabel}</span>
                      </div>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:10, paddingTop:8, borderTop:'1px solid var(--border)' }}>
                      <span style={{ fontSize:11, color:'var(--text-muted)' }}>{ex.date?.slice(0,10)}</span>
                      <div style={{ display:'flex', gap:5 }}>
                        {canApprove && isPending && (<>
                          <button onClick={()=>setStatus(ex.id,'approved')}
                            style={{ padding:'4px 11px', borderRadius:8, background:'rgba(52,211,153,0.1)', border:'1px solid rgba(52,211,153,0.3)', color:'#059669', fontWeight:700, fontSize:11.5, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:4 }}>
                            <Check size={10}/> Approve
                          </button>
                          <button onClick={()=>setStatus(ex.id,'rejected')}
                            style={{ padding:'4px 9px', borderRadius:8, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.18)', color:'#EF4444', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center' }}>
                            <X size={11}/>
                          </button>
                        </>)}
                        {canEditRow && (
                          <button onClick={()=>setModal(ex)}
                            style={{ padding:'4px 11px', borderRadius:8, background:'var(--bg-alt)', border:'1px solid var(--border)', color:'var(--text)', fontWeight:600, fontSize:11.5, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:4 }}>
                            <Pencil size={10}/> Edit
                          </button>
                        )}
                        {canEdit && (
                          <button onClick={()=>del(ex.id)}
                            style={{ padding:'4px 9px', borderRadius:8, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.18)', color:'#EF4444', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center' }}>
                            <Trash2 size={11}/>
                          </button>
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

      {modal && (
        <ExpenseModal
          expense={typeof modal === 'object' ? modal : null}
          employees={emp ? [emp] : []}
          lockEmpId={id}
          onClose={()=>setModal(null)}
          onSave={()=>{ setModal(null); load() }}
        />
      )}
    </div>
  )
}
