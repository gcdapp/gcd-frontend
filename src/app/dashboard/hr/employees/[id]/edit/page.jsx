'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { empApi } from '@/lib/api'
import { getEmp, setEmp as cacheEmp } from '@/lib/empCache'
import EmpForm from '@/components/employees/EmpForm'
import BackLink from '@/components/employees/BackLink'

export default function EditDriverPage() {
  const { id } = useParams()
  const router = useRouter()
  const [emp, setEmp] = useState(() => getEmp(id))
  const [loading, setLoading] = useState(!getEmp(id))

  useEffect(() => {
    empApi.get(id).then(d => { setEmp(d.employee); cacheEmp(d.employee) }).catch(() => setEmp(prev => prev)).finally(() => setLoading(false))
  }, [id])

  function backToDashboard() { router.push(`/dashboard/hr/employees/${id}`) }

  if (loading && !emp) return <div style={{ padding:40, textAlign:'center', color:'var(--text-muted)' }}>Loading…</div>
  if (!emp) return (
    <div style={{ padding:40, textAlign:'center' }}>
      <div style={{ fontSize:14, color:'var(--text-muted)', marginBottom:12 }}>Driver not found.</div>
      <button onClick={()=>router.push('/dashboard/hr/employees')} className="btn btn-secondary">Back to DAs</button>
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14, alignItems:'center', animation:'slideUp 0.3s ease' }}>
      <div style={{ width:'100%', maxWidth:720, marginBottom:-4 }}>
        <BackLink router={router} href={`/dashboard/hr/employees/${id}`} label={`Back to ${emp.name}`}/>
      </div>
      <EmpForm emp={emp} mode="edit" maxWidth={720} onCancel={backToDashboard} onSaved={backToDashboard}/>
    </div>
  )
}
