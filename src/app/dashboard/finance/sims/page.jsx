'use client'
import { useState, useEffect, useCallback } from 'react'
import { API } from '@/lib/api'
import { Smartphone, Search } from 'lucide-react'

export default function AccountantSimsPage() {
  const [sims,    setSims]    = useState([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const h = { headers: { Authorization: `Bearer ${localStorage.getItem('gcd_token')}` } }
      const r = await fetch(`${API}/api/sims`, h)
      const d = await r.json()
      setSims(d.sims || [])
    } catch(e) { console.error(e) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = search.trim()
    ? sims.filter(s =>
        s.number?.toLowerCase().includes(search.toLowerCase()) ||
        s.operator?.toLowerCase().includes(search.toLowerCase()) ||
        s.emp_name?.toLowerCase().includes(search.toLowerCase()) ||
        s.work_number?.toLowerCase().includes(search.toLowerCase())
      )
    : sims

  const assigned   = sims.filter(s => s.emp_id).length
  const unassigned = sims.filter(s => !s.emp_id).length

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16, animation:'slideUp 0.35s ease' }}>
      {/* Header */}
      <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, padding:'16px 20px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
          <Smartphone size={18} color="#0D9488"/>
          <h2 style={{ fontWeight:800, fontSize:17, margin:0 }}>SIM Cards</h2>
        </div>
        <p style={{ fontSize:12, color:'var(--text-muted)', margin:0 }}>{sims.length} SIMs total · {assigned} assigned · {unassigned} unassigned</p>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
        {[
          { l:'Total SIMs',  v:sims.length, c:'#0D9488', bg:'#F0FDFA', bc:'#99F6E4' },
          { l:'Assigned',    v:assigned,    c:'#2E7D52', bg:'#ECFDF5', bc:'#A7F3D0' },
          { l:'Unassigned',  v:unassigned,  c:'#6B7280', bg:'#F9FAFB', bc:'#E5E7EB' },
        ].map(s => (
          <div key={s.l} className="stat-card" style={{ textAlign:'center', background:s.bg, border:`1px solid ${s.bc}` }}>
            <div style={{ fontWeight:800, fontSize:24, color:s.c }}>{s.v}</div>
            <div style={{ fontSize:11, color:s.c, fontWeight:600, marginTop:3 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ position:'relative', maxWidth:300 }}>
        <Search size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', pointerEvents:'none' }}/>
        <input className="input" placeholder="Search number, operator, driver…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft:30 }}/>
      </div>

      {/* Table */}
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        {loading ? (
          <div style={{ padding:40, textAlign:'center', color:'var(--text-muted)' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding:40, textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>
            {search ? 'No SIMs match your search' : 'No SIM cards found'}
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Number</th><th>Operator</th><th>Work No.</th><th>Assigned To</th><th>Station</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(sim => (
                  <tr key={sim.id}>
                    <td style={{ fontFamily:'monospace', fontWeight:700, fontSize:13 }}>{sim.number || '—'}</td>
                    <td style={{ fontSize:12 }}>{sim.operator || '—'}</td>
                    <td style={{ fontFamily:'monospace', fontSize:12, color:'#0D9488', fontWeight:600 }}>{sim.work_number || '—'}</td>
                    <td>
                      {sim.emp_name ? (
                        <div>
                          <div style={{ fontWeight:600, fontSize:13 }}>{sim.emp_name}</div>
                          <div style={{ fontSize:10, color:'var(--text-muted)' }}>{sim.emp_id}</div>
                        </div>
                      ) : <span style={{ color:'var(--text-muted)', fontSize:12 }}>Unassigned</span>}
                    </td>
                    <td>
                      {sim.station_code && (
                        <span style={{ fontSize:11, fontWeight:700, color:'#8F6807', background:'#FDF6E3', border:'1px solid #F0D78C', borderRadius:5, padding:'1px 6px' }}>
                          {sim.station_code}
                        </span>
                      )}
                    </td>
                    <td>
                      <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20,
                        background: sim.status==='active' ? '#ECFDF5' : '#F9FAFB',
                        color: sim.status==='active' ? '#2E7D52' : '#6B7280',
                        border: `1px solid ${sim.status==='active' ? '#A7F3D0' : '#E5E7EB'}` }}>
                        {sim.status || 'unknown'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
