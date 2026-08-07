// Frontend mirror of backend/src/lib/jntSalaryEngine.js — same "keep the frontend
// calc in sync with the backend" convention slipData()/payrollCalc.js already use
// elsewhere in this app. Used for the JNT salary form's live-updating summary; the
// server always recomputes and is the source of truth on save.

export const SHIPMENT_TYPES = ['cod', 'non_cod', 'pickup', 'reverse_pickup']
export const DEDUCTION_FIELDS = ['traffic_fine', 'cash_advance', 'cash_variance', 'sim_charge', 'car_rent', 'carry_forward', 'other']

export function round2(n) {
  return Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100
}

// component: { calc_method, rates: [{shipment_type, value}] }
// input: { shipment_qtys?, fixed_amount?, percentage_rate? }
export function calcComponentAmount(component, input = {}, baseSalary = 0) {
  const { calc_method, rates = [] } = component
  if (calc_method === 'fixed') return round2(input.fixed_amount)
  if (calc_method === 'percentage') return round2((Number(input.percentage_rate || 0) / 100) * Number(baseSalary || 0))
  const qtys = input.shipment_qtys || {}
  let amount = 0
  for (const r of rates) amount += Number(qtys[r.shipment_type] || 0) * r.value
  return round2(amount)
}

// components: [{id, is_base, calc_method, rates}]
// entryInputs: { [componentId]: input }
export function calcSalary(components, entryInputs = {}) {
  const baseComponent = components.find(c => c.is_base)
  const base = baseComponent ? calcComponentAmount(baseComponent, entryInputs[baseComponent.id] || {}, 0) : 0

  let additionalEarnings = 0
  for (const c of components) {
    if (c.is_base) continue
    const input = entryInputs[c.id]
    if (!input) continue
    additionalEarnings = round2(additionalEarnings + calcComponentAmount(c, input, base))
  }
  return { base, additionalEarnings, grossSalary: round2(base + additionalEarnings) }
}

export function calcDeductions(deductions = {}) {
  let total = 0
  for (const f of DEDUCTION_FIELDS) total += Number(deductions[f] || 0)
  return round2(total)
}

export function calcNetSalary(grossSalary, totalDeductions) {
  return round2(Number(grossSalary || 0) - Number(totalDeductions || 0))
}

export function fmtAED(n) {
  return `AED ${Number(n || 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
