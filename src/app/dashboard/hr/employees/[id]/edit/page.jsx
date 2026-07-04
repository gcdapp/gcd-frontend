'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { empApi } from '@/lib/api'
import EmpForm from '@/components/employees/EmpForm'
import { ChevronLeft } from 'lucide-react'

export default function EditDriverPage() {
  const { id } = useParams()
  const router = useRouter()
  const [emp, setEmp] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    empApi.get(id).then(d => setEmp(d.employee)).catch(() => setEmp(null)).finally(() => setLoading(false))
  }, [id])

  function backToDashboard() { router.push(`/dashboard/hr/employees/${id}`) }

  if (loading) return <div style={{ padding:40, textAlign:'center', color:'var(--text-muted)' }}>Loading…</div>
  if (!emp) return (
    <div style={{ padding:40, textAlign:'center' }}>
      <div style={{ fontSize:14, color:'var(--text-muted)', marginBottom:12 }}>Driver not found.</div>
      <button onClick={()=>router.push('/dashboard/hr/employees')} className="btn btn-secondary">Back to DAs</button>
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14, alignItems:'center', animation:'slideUp 0.3s ease' }}>
      <div style={{ width:'100%', maxWidth:720 }}>
        <button onClick={backToDashboard}
          style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none', color:'var(--text-muted)', fontSize:12.5, fontWeight:600, cursor:'pointer', padding:0, marginBottom:14, fontFamily:'inherit' }}>
          <ChevronLeft size={14}/> Back to {emp.name}
        </button>
      </div>
      <EmpForm emp={emp} mode="edit" maxWidth={720} onCancel={backToDashboard} onSaved={backToDashboard}/>
    </div>
  )
}
