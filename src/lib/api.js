// API base URL — reads from env or falls back to localhost
// Ensure the URL always has a protocol (Railway env vars sometimes omit https://)
const _raw = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
const BASE = _raw.startsWith('http') ? _raw : `https://${_raw}`

// Named export used by page components that do raw fetch() calls.
// Previously every page duplicated the same two-line URL derivation; now
// they import this one export and the logic lives in exactly one place.
export const API = BASE

function getToken() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('gcd_token')
}

async function request(method, path, body) {
  const token = getToken()
  const res   = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('gcd_token')
      localStorage.removeItem('gcd_user')
      window.location.href = '/login'
    }
    throw new Error('Unauthorized')
  }

  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

export const api = {
  get:    (path)        => request('GET',    path),
  post:   (path, body)  => request('POST',   path, body),
  put:    (path, body)  => request('PUT',    path, body),
  patch:  (path, body)  => request('PATCH',  path, body),
  delete: (path)        => request('DELETE', path),
}

// Auth helpers
export const authApi = {
  login:   (email, password) => api.post('/api/auth/login', { email, password }),
  me:      ()                => api.get('/api/auth/me'),
  refresh: ()                => api.post('/api/auth/refresh', {}),
}

// Employees
export const empApi = {
  list:       (params = {}) => api.get(`/api/employees?${new URLSearchParams(params)}`),
  get:        (id)          => api.get(`/api/employees/${id}`),
  create:     (data)        => api.post('/api/employees', data),
  update:     (id, data)    => api.put(`/api/employees/${id}`, data),
  delete:     (id)          => api.delete(`/api/employees/${id}`),
  createUser: (id, data)    => api.post(`/api/employees/${id}/create-user`, data),
}

// Attendance
export const attApi = {
  list:     (params = {}) => api.get(`/api/attendance?${new URLSearchParams(params)}`),
  summary:  (month)       => api.get(`/api/attendance/summary?month=${month}`),
  log:      (data)        => api.post('/api/attendance', data),
  bulkLog:  (records)     => api.post('/api/attendance/bulk', { records }),
  checkout: (id, time)    => api.patch(`/api/attendance/${id}/checkout`, { check_out: time }),
}

// Payroll
export const payrollApi = {
  list:           (params = {}) => api.get(`/api/payroll?${new URLSearchParams(params)}`),
  addDeduction:   (data)        => api.post('/api/payroll/deductions', data),
  removeDeduction:(id)          => api.delete(`/api/payroll/deductions/${id}`),
  addBonus:       (data)        => api.post('/api/payroll/bonuses', data),
  markPaid:       (emp_id, month) => api.post('/api/payroll/mark-paid',   { emp_id, month }),
  markUnpaid:     (emp_id, month) => api.post('/api/payroll/mark-unpaid', { emp_id, month }),
  addUnits:       (data)        => api.post('/api/payroll/units', data),
  addUnitsBulk:   (month, records, project_type) => api.post('/api/payroll/units/bulk', { month, records, project_type }),
  pendingDeduction: (emp_id, month) => api.get(`/api/payroll/pending-deduction/${emp_id}?month=${month}`),
  getEntry:       (emp_id, month) => api.get(`/api/payroll/entry/${emp_id}?month=${month}`),
}

// Leaves
export const leaveApi = {
  list:      (params = {}) => api.get(`/api/leaves?${new URLSearchParams(params)}`),
  create:    (data)        => api.post('/api/leaves', data),
  setStatus: (id, status)  => api.patch(`/api/leaves/${id}/status`, { status }),
  hrAction:  (id, status)  => api.patch(`/api/leaves/${id}/hr`, { status }),
  mgrAction: (id, status)  => api.patch(`/api/leaves/${id}/manager`, { status }),
  delete:    (id)          => api.delete(`/api/leaves/${id}`),
}

// Compliance
export const complianceApi = {
  insurance:     ()         => api.get('/api/compliance/insurance'),
  addInsurance:  (data)     => api.post('/api/compliance/insurance', data),
  fines:         (params={}) => api.get(`/api/compliance/fines?${new URLSearchParams(params)}`),
  addFine:       (data)     => api.post('/api/compliance/fines', data),
  setFineStatus: (id, data) => api.patch(`/api/compliance/fines/${id}/status`, data),
}

// Expenses
export const expenseApi = {
  list:      (params={}) => api.get(`/api/expenses?${new URLSearchParams(params)}`),
  create:    (data)      => api.post('/api/expenses', data),
  update:    (id, data)  => api.put(`/api/expenses/${id}`, data),
  setStatus: (id, status) => api.patch(`/api/expenses/${id}/status`, { status }),
  delete:    (id)        => api.delete(`/api/expenses/${id}`),
}

// POC
export const pocApi = {
  drivers:           (station) => api.get(`/api/poc/drivers${station ? `?station=${station}` : ''}`),
  stations:          ()        => api.get('/api/poc/stations'),
  addStation:        (data)    => api.post('/api/poc/stations', data),
  announcements:     (station) => api.get(`/api/poc/announcements${station ? `?station=${station}` : ''}`),
  addAnnouncement:   (data)    => api.post('/api/poc/announcements', data),
  updateAnnouncement:(id, data)=> api.put(`/api/poc/announcements/${id}`, data),
  deleteAnnouncement:(id)      => api.delete(`/api/poc/announcements/${id}`),
}

// Analytics
export const analyticsApi = {
  summary:       () => api.get('/api/analytics/summary'),
  deliveryChart: (months=6) => api.get(`/api/analytics/deliveries-chart?months=${months}`),
  stationStats:  () => api.get('/api/analytics/station-stats'),
}

// Deliveries
export const deliveriesApi = {
  list:    (p={}) => api.get(`/api/deliveries?${new URLSearchParams(p)}`),
  log:     (data) => api.post('/api/deliveries', data),
  summary: (months=6) => api.get(`/api/deliveries/monthly-summary?months=${months}`),
}

// Vehicle Inspections
export const vehicleInspectionApi = {
  list:   (params={}) => api.get(`/api/vehicle-inspections?${new URLSearchParams(params)}`),
  get:    (id)        => api.get(`/api/vehicle-inspections/${id}`),
  create: (data)      => api.post('/api/vehicle-inspections', data),
  update: (id, data)  => api.put(`/api/vehicle-inspections/${id}`, data),
  delete: (id)        => api.delete(`/api/vehicle-inspections/${id}`),
}

// Vehicles
export const vehicleApi = {
  list:        (params={}) => api.get(`/api/vehicles?${new URLSearchParams(params)}`),
  create:      (data)      => api.post('/api/vehicles', data),
  update:      (id, data)  => api.put(`/api/vehicles/${id}`, data),
  delete:      (id)        => api.delete(`/api/vehicles/${id}`),
  assignments: (params={}) => api.get(`/api/vehicles/assignments?${new URLSearchParams(params)}`),
  assign:      (data)      => api.post('/api/vehicles/assignments', data),
}

// SIMs
export const simApi = {
  list:   (params={}) => api.get(`/api/sims?${new URLSearchParams(params)}`),
  stats:  ()          => api.get('/api/sims/stats'),
  create: (data)      => api.post('/api/sims', data),
  update: (id, data)  => api.put(`/api/sims/${id}`, data),
  delete: (id)        => api.delete(`/api/sims/${id}`),
}

// Handovers
export const handoverApi = {
  list:    (params={}) => api.get(`/api/handovers?${new URLSearchParams(params)}`),
  current: (params={}) => api.get(`/api/handovers/current?${new URLSearchParams(params)}`),
  delete:  (id)        => api.delete(`/api/handovers/${id}`),
}

// Documents
export const docApi = {
  list:     (params={}) => api.get(`/api/documents?${new URLSearchParams(params)}`),
  expiring: (days=60)   => api.get(`/api/documents/expiring?days=${days}`),
  create:   (data)      => api.post('/api/documents', data),
  update:   (id, data)  => api.put(`/api/documents/${id}`, data),
  delete:   (id)        => api.delete(`/api/documents/${id}`),
}

// Performance
export const perfApi = {
  list:    (params={}) => api.get(`/api/performance?${new URLSearchParams(params)}`),
  history: (empId)     => api.get(`/api/performance/${empId}`),
}

// Advances
export const advanceApi = {
  list:   (params={}) => api.get(`/api/advances?${new URLSearchParams(params)}`),
  create: (data)      => api.post('/api/advances', data),
  review: (id, data)  => api.patch(`/api/advances/${id}`, data),
}

// Damage
export const damageApi = {
  list:   (params={}) => api.get(`/api/damage?${new URLSearchParams(params)}`),
  review: (id, data)  => api.patch(`/api/damage/${id}/review`, data),
}

// Petty cash
export const pettyCashApi = {
  summary:  ()         => api.get('/api/petty-cash/summary'),
  my:       ()         => api.get('/api/petty-cash/my'),
  user:     (uid)      => api.get(`/api/petty-cash/user/${uid}`),
  allocate: (data)     => api.post('/api/petty-cash/allocate', data),
  expense:  (data)     => api.post('/api/petty-cash/expense', data),
  delete:   (id)       => api.delete(`/api/petty-cash/${id}`),
}

// Shifts
export const shiftApi = {
  list:   (params={}) => api.get(`/api/shifts?${new URLSearchParams(params)}`),
  save:   (data)      => api.post('/api/shifts', data),
  delete: (id)        => api.delete(`/api/shifts/${id}`),
}

// Customers
export const customerApi = {
  list:   (params={}) => api.get(`/api/customers?${new URLSearchParams(params)}`),
  get:    (id)        => api.get(`/api/customers/${id}`),
  create: (data)      => api.post('/api/customers', data),
  update: (id, data)  => api.put(`/api/customers/${id}`, data),
  delete: (id)        => api.delete(`/api/customers/${id}`),
}

// Customer Invoices
export const customerInvoiceApi = {
  list:   (customerId) => api.get(`/api/customer-invoices?customer_id=${customerId}`),
  create: (data)       => api.post('/api/customer-invoices', data),
  update: (id, data)   => api.put(`/api/customer-invoices/${id}`, data),
  delete: (id)         => api.delete(`/api/customer-invoices/${id}`),
}

// Customer Receipts
export const customerReceiptApi = {
  list:   (customerId) => api.get(`/api/customer-receipts?customer_id=${customerId}`),
  create: (data)       => api.post('/api/customer-receipts', data),
  update: (id, data)   => api.put(`/api/customer-receipts/${id}`, data),
  delete: (id)         => api.delete(`/api/customer-receipts/${id}`),
}

// Customer Ledger
export const customerLedgerApi = {
  get: (customerId, year) => api.get(`/api/customer-ledger?customer_id=${customerId}&year=${year}`),
}

// Etisalat IoT Mobility — fleet tracking
export const etisalatApi = {
  fleet:  () => api.get('/api/etisalat/fleet'),
  status: () => api.get('/api/etisalat/status'),
}

// Backup
export const backupApi = {
  stats:    ()   => api.get('/api/backup/stats'),
  history:  ()   => api.get('/api/backup/history'),
  download: async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('gcd_token') : null
    const res   = await fetch(`${BASE}/api/backup/download`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error('Backup failed')
    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `gcd_backup_${new Date().toISOString().slice(0,10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
}
