// Frontend mirror of backend/src/routes/imile-salary.js's calc — same "keep the
// frontend calc in sync with the backend" convention jntSalaryCalc.js/slipData()
// already use elsewhere. Used for the iMile salary form's live-updating summary; the
// server always recomputes and is the source of truth on save.

export const DEDUCTION_FIELDS = ['imile_deduction', 'sim_charge', 'car_rent', 'rta_fine', 'carry_forward', 'cash_advance']

export function round2(n) {
  return Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100
}

export function calcGross(cod, codRate, nonCod, nonCodRate) {
  const codPayment = round2(Number(cod || 0) * Number(codRate || 0))
  const nonCodPayment = round2(Number(nonCod || 0) * Number(nonCodRate || 0))
  return { codPayment, nonCodPayment, grossSalary: round2(codPayment + nonCodPayment) }
}

export function calcDeductions(deductions = {}) {
  let total = 0
  for (const f of DEDUCTION_FIELDS) total += Number(deductions[f] || 0)
  return round2(total)
}

export function calcNet(grossSalary, totalDeductions) {
  return round2(Number(grossSalary || 0) - Number(totalDeductions || 0))
}

export function fmtAED(n) {
  return `AED ${Number(n || 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
