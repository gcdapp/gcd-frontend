// Shared constants/helpers for the DA (driver) section — list, dashboard, edit,
// expenses, documents, salary. Single source so labels/colors/gradients can't
// drift between pages (they had: the driver Expenses hero used a different
// gradient than the other 5 pages because each file redefined its own copy).
import { differenceInDays, parseISO } from 'date-fns'

export const SC_COLOR  = { DDB1:'#B8860B', DXE6:'#2563EB' }
export const SC_BG     = { DDB1:'#FFFBEB', DXE6:'#EFF6FF' }
export const SC_BORDER = { DDB1:'#FDE68A', DXE6:'#BFDBFE' }

export const PROJECT_LABELS = {
  pulser: 'Pulser', cret: 'CRET', office: 'Office',
  creative_packers: 'Creative Packers', ig_rak: 'IG RAK',
  imile: 'IMILE Delivery Services', jnt_express: 'Jnt Express', le_chocola: 'Le Chocola',
}
export function projectLabel(v) { return PROJECT_LABELS[v] || (v ? v.charAt(0).toUpperCase()+v.slice(1) : v) }

export const STATUS = {
  active:   { l:'Active',   c:'#10B981', bg:'#F0FDF4', bc:'#A7F3D0', dot:'#10B981' },
  on_leave: { l:'On Leave', c:'#F59E0B', bg:'#FFFBEB', bc:'#FDE68A', dot:'#F59E0B' },
  inactive: { l:'Inactive', c:'#9CA3AF', bg:'#F9FAFB', bc:'#E5E7EB', dot:'#9CA3AF' },
}

export function hdr() { return { 'Content-Type':'application/json', Authorization:`Bearer ${localStorage.getItem('gcd_token')}` } }
export function getUserRole() { try { const t = localStorage.getItem('gcd_token'); return t ? JSON.parse(atob(t.split('.')[1])).role : null } catch { return null } }
export function fmt(n) { return Number(n||0).toLocaleString('en-AE', { maximumFractionDigits: 0 }) }

export function docDays(d) {
  if (!d) return null
  try { return differenceInDays(parseISO(d.slice(0,10)), new Date()) } catch { return null }
}
export function expiry(ds) {
  const d = docDays(ds)
  if (d === null) return null
  if (d < 0)   return { label:'Expired',    c:'#EF4444', bg:'#FEF2F2', bc:'#FECACA' }
  if (d <= 30) return { label:`${d}d left`, c:'#EF4444', bg:'#FEF2F2', bc:'#FECACA' }
  if (d <= 90) return { label:`${d}d left`, c:'#F59E0B', bg:'#FFFBEB', bc:'#FDE68A' }
  return { label:'Valid', c:'#10B981', bg:'#F0FDF4', bc:'#A7F3D0' }
}
export function docChip(d) {
  const days = docDays(d)
  if (days === null) return null
  if (days < 0)   return { label:'Expired',       c:'#DC2626', bg:'#FEF2F2', bc:'#FECACA' }
  if (days <= 30) return { label:`${days}d left`, c:'#DC2626', bg:'#FEF2F2', bc:'#FECACA' }
  if (days <= 90) return { label:`${days}d left`, c:'#D97706', bg:'#FFFBEB', bc:'#FDE68A' }
  return              { label:'Valid',             c:'#059669', bg:'#F0FDF4', bc:'#A7F3D0' }
}

/* ── Profile completion ──────────────────────────────────────── */
const COMPLETION_FIELDS = [
  'phone','emirates_id','nationality','dob','gender','marital_status',
  'passport_no','uid_number','visa_file_no','email_id','father_family_name',
  'residential_location','work_location',
  'emirates_issuing_visa','visa_expiry','license_expiry','amazon_id',
  'sub_group_name',
]
export function profileCompletion(emp) {
  if (!emp) return 0
  const filled = COMPLETION_FIELDS.filter(f => emp[f] && String(emp[f]).trim() !== '').length
  const hasSalary = Number(emp.salary||0) > 0 ? 1 : 0
  return Math.round(((filled + hasSalary) / (COMPLETION_FIELDS.length + 1)) * 100)
}

/* ── Shared hero gradient — every DA page uses this exact one ── */
export const DA_HERO_GRADIENT = 'linear-gradient(135deg,#0f1623 0%,#1a2535 55%,#1e3a5f 100%)'
