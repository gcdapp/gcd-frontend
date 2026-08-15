'use client'
import React, { useState, useEffect, useCallback, useMemo, memo } from 'react'
import { createPortal } from 'react-dom'
import Papa from 'papaparse'
import Link from 'next/link'
import { payrollApi, empApi, payRatesApi, jntSalaryApi, imileSalaryApi } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useSocket } from '@/lib/socket'
import {
  Plus, X, Download, Check, Search, Wallet, FileText,
  AlertCircle, Users, ChevronDown, Undo2, UploadCloud, Pencil, Trash2, Settings2,
  Clock, CheckCircle2, TrendingDown, ChevronLeft, ChevronRight
} from 'lucide-react'
import ConfirmDialog from '@/components/ConfirmDialog'
import JntSalaryModal from '@/components/payroll/JntSalaryModal'
import PackerPayModal from '@/components/payroll/PackerPayModal'
import ImileSalaryModal from '@/components/payroll/ImileSalaryModal'
import {
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'
import { API } from '@/lib/api'

const APP_VERSION = '2.4.0'
// Fixed, company-wide hourly rates for the two Packer project types — admin-editable
// via GET/PUT /api/pay-rates (see backend/src/routes/pay-rates.js), not per-employee.
// Module-level so slipData() (a plain function, not a component) can read it directly;
// PayrollPage fetches the live values once on mount and mutates this in place, bumping
// `ratesVersion` state so the payrollCalc useMemo recomputes with the fresh numbers.
let livePackerRates = { creative_packers: 6.64, le_chocola: 6.99 }
// Plain year*12+month arithmetic — d.setMonth(d.getMonth()-i) overflows into
// the next month on a 31st whenever the target month is shorter, producing
// duplicate/skipped months.
const MONTHS = Array.from({length:12},(_,i)=>{
  const now=new Date(), total=now.getFullYear()*12 + now.getMonth() - i
  return `${Math.floor(total/12)}-${String(total%12+1).padStart(2,'0')}`
})
const DED_TYPES = [
  {v:'traffic_fine',  l:'Traffic Fine',  c:'#EF4444'},
  {v:'cash_advance',  l:'Cash Advance',  c:'#D97706'},
  {v:'iloe_fee',      l:'ILOE Fee',      c:'#3B82F6'},
  {v:'iloe_fine',     l:'ILOE Fine',     c:'#EF4444'},
  {v:'cash_variance', l:'Cash Variance', c:'#F59E0B'},
  {v:'absent_days',   l:'Absent Days',   c:'#7C3AED'},
  {v:'other',         l:'Other',         c:'#6B5D4A'},
]
const BON_TYPES = [
  {v:'performance',   l:'Performance',           c:'#10B981'},
  {v:'kpi',           l:'KPI Bonus',             c:'#3B82F6'},
  {v:'reimbursement', l:'Expense Reimbursement', c:'#0EA5E9'},
  {v:'other',         l:'Other',                 c:'#B8860B'},
]
const ROLE_CFG = {
  admin:           {l:'Admin',    c:'#7C3AED', bg:'rgba(124,58,237,0.1)'},
  manager:         {l:'Manager',  c:'#1D6FA4', bg:'rgba(29,111,164,0.1)'},
  general_manager: {l:'GM',       c:'#0F766E', bg:'rgba(15,118,110,0.1)'},
  hr:              {l:'HR',       c:'#B45309', bg:'rgba(180,83,9,0.1)'},
  accountant:      {l:'Acct',     c:'#2E7D52', bg:'rgba(46,125,82,0.1)'},
  poc:             {l:'POC',      c:'#B8860B', bg:'rgba(184,134,11,0.1)'},
  driver:          {l:'DA',       c:'#64748B', bg:'rgba(100,116,139,0.1)'},
  packer:          {l:'Packer',   c:'#64748B', bg:'rgba(100,116,139,0.1)'},
}
// Le Chocola/Creative Packers are warehouse packing roles, not delivery — "DA" is the
// wrong badge for them even though their HR `role` field is still 'Driver' (that field
// just distinguishes "roster of drivers" from staff/admin, same as it always has).
function resolveRole(r, projectType) {
  if (projectType === 'le_chocola' || projectType === 'creative_packers') return ROLE_CFG.packer
  if (!r) return ROLE_CFG.driver
  const k = r.toLowerCase().trim().replace(' ','_')
  return ROLE_CFG[k] || ROLE_CFG.driver
}
function hdr() { return {'Content-Type':'application/json',Authorization:`Bearer ${localStorage.getItem('gcd_token')}`} }
function fmt(n) { return Number(n||0).toLocaleString('en-AE',{minimumFractionDigits:0,maximumFractionDigits:0}) }

/* ── Tooltip ── */
const GlassTip = ({active,payload,label}) => {
  if (!active||!payload?.length) return null
  return (
    <div style={{background:'rgba(255,255,255,0.97)',backdropFilter:'blur(12px)',border:'1px solid rgba(0,0,0,0.08)',borderRadius:10,padding:'8px 12px',boxShadow:'0 4px 16px rgba(0,0,0,0.1)',fontFamily:'Poppins,sans-serif',fontSize:11.5}}>
      <div style={{fontWeight:700,color:'#6B5D4A',marginBottom:4}}>{label}</div>
      {payload.map(p=>(
        <div key={p.name} style={{color:p.color||p.fill,fontWeight:600,display:'flex',gap:10,justifyContent:'space-between'}}>
          <span>{p.name}</span><strong>AED {fmt(p.value)}</strong>
        </div>
      ))}
    </div>
  )
}

// Purely decorative — no real historical trend data source without extra per-month
// API calls (out of scope), just a visual cue matching the KPI card design.
function KpiSpark({color}) {
  return (
    <svg width="30" height="14" viewBox="0 0 30 14" fill="none" style={{color,flexShrink:0}}>
      <path d="M1 11 L7 6 L12 9 L18 3 L24 7 L29 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.55"/>
    </svg>
  )
}

// Deterministic per-employee avatar color (same employee → same color every time,
// unlike random) — gives each row visual identity instead of one flat gold circle
// repeated 84 times. Palette stays within the app's existing token colors.
const AVATAR_PALETTE = [
  {c:'#B8860B', bg:'rgba(184,134,11,0.12)', bd:'rgba(184,134,11,0.28)'},
  {c:'#10B981', bg:'rgba(16,185,129,0.12)', bd:'rgba(16,185,129,0.28)'},
  {c:'#3B82F6', bg:'rgba(59,130,246,0.12)', bd:'rgba(59,130,246,0.28)'},
  {c:'#7C3AED', bg:'rgba(124,58,237,0.12)', bd:'rgba(124,58,237,0.28)'},
  {c:'#F59E0B', bg:'rgba(245,158,11,0.12)', bd:'rgba(245,158,11,0.28)'},
  {c:'#EF4444', bg:'rgba(239,68,68,0.12)', bd:'rgba(239,68,68,0.28)'},
  {c:'#06B6D4', bg:'rgba(6,182,212,0.12)', bd:'rgba(6,182,212,0.28)'},
  {c:'#EC4899', bg:'rgba(236,72,153,0.12)', bd:'rgba(236,72,153,0.28)'},
]
function avatarStyle(seed) {
  let hash = 0
  const s = String(seed||'')
  for (let i=0;i<s.length;i++) hash = (hash*31 + s.charCodeAt(i)) >>> 0
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length]
}

function daysInMonth(month) {
  const [y, m] = String(month||'').split('-').map(Number)
  if (!y || !m) return 30
  return new Date(y, m, 0).getDate()
}

/* ── Payslip data extractor ──
   Rebuilt to match the real accountant salary sheet (GCD MAY 2026 SALARY GLCR and
   CSDS.xlsx) exactly. Mirrors backend/src/lib/payrollCalc.js — keep both in sync. */
function slipData(slip, month) {
  const fmtN = n => Number(n||0).toLocaleString('en-AE',{minimumFractionDigits:2,maximumFractionDigits:2})
  const bonuses = slip.bonuses||[]; const deductions = slip.deductions||[]
  const totalHours = Number(slip.total_hours||0)

  const projectType = (slip.project_type||'').toLowerCase()
  const isCret         = projectType === 'cret'
  const isExternal     = projectType === 'external'
  const isTradelink    = projectType === 'tradelink'
  const isDaSplit       = projectType === 'jnt_express' || projectType === 'imile'
  const isPackerDaily  = projectType === 'creative_packers'
  const isPackerHourly = projectType === 'le_chocola'
  const rawBase      = Number(slip.base_salary||0)
  const perShipRate  = Number(slip.per_shipment_rate||0)
  const nonCodRate   = Number(slip.per_shipment_rate_non_cod||0)
  const unitsNonCod  = Number(slip.units_non_cod||0)

  // Basic salary is prorated by working days out of the days in the month —
  // e.g. 29 working days in a 31-day month = base × 29/31.
  let proratedBase = rawBase
  if (slip.working_days !== undefined && slip.working_days !== null) {
    const dim = daysInMonth(month)
    if (dim > 0) proratedBase = Math.round((rawBase / dim) * Number(slip.working_days) * 100) / 100
  }

  let effectiveBase, hoursEarnings, displayRate, rateLabel, hoursLabel

  // Staff/Admins: a flat amount entered directly for the month, no formula.
  const hasOverride = slip.entry_amount !== undefined && slip.entry_amount !== null
  if (hasOverride) {
    effectiveBase = Number(slip.entry_amount||0)
    hoursEarnings = 0
    displayRate   = null
    rateLabel     = null
    hoursLabel    = null
  } else if (isCret) {
    // The accountant picks the per-shipment rate each month (0.5, 2, or 3) — not
    // derived automatically. 0.5 (or any rate <1) adds to base; 2/3 replace it entirely.
    const rate = slip.cret_rate !== undefined && slip.cret_rate !== null ? Number(slip.cret_rate) : (perShipRate||0.5)
    effectiveBase = rate < 1 ? proratedBase : 0
    hoursEarnings = parseFloat((totalHours * rate).toFixed(2))
    displayRate   = rate
    rateLabel     = 'Shipment Rate'
    hoursLabel    = `Total Shipments (${totalHours})`
  } else if (isExternal) {
    effectiveBase = 0
    hoursEarnings = parseFloat((totalHours * perShipRate).toFixed(2))
    displayRate   = perShipRate
    rateLabel     = 'Shipment Rate'
    hoursLabel    = `Total Shipments (${totalHours})`
  } else if (isTradelink) {
    // Flat prorated base, no hours/shipments component at all — confirmed against the
    // real accountant sheet's dedicated TRADELINK tab (Basic Salary + bonuses only).
    effectiveBase = proratedBase
    hoursEarnings = 0
    displayRate   = null
    rateLabel     = null
    hoursLabel    = null
  } else if (isDaSplit) {
    // COD + Non-COD shipments, each at their own rate, no base salary — verified
    // against the real JNT sheet (e.g. 79 COD×AED4 + 1509 Non-COD×AED3.5 = 5597.5).
    effectiveBase = 0
    hoursEarnings = parseFloat((totalHours*perShipRate + unitsNonCod*nonCodRate).toFixed(2))
    displayRate   = perShipRate
    rateLabel     = 'COD / Non-COD Rate'
    hoursLabel    = `COD ${totalHours} · Non-COD ${unitsNonCod}`
  } else if (isPackerDaily || isPackerHourly) {
    // Hours worked × a fixed company-wide hourly rate, no base salary — not read from
    // the employee record; admin-editable, see livePackerRates above.
    const packerRate = livePackerRates[projectType]
    effectiveBase = 0
    hoursEarnings = parseFloat((totalHours*packerRate).toFixed(2))
    displayRate   = packerRate
    rateLabel     = 'Hourly Rate'
    hoursLabel    = `Hours Worked (${totalHours})`
  } else {
    const hourlyRate_ = Number(slip.hourly_rate||3.85)
    effectiveBase = proratedBase
    hoursEarnings = parseFloat((totalHours * hourlyRate_).toFixed(2))
    displayRate   = hourlyRate_
    rateLabel     = 'Rate Per Hour'
    hoursLabel    = `Total Working Hrs (${totalHours})`
  }

  const incentive    = bonuses.filter(b=>b.type==='kpi').reduce((s,b)=>s+Number(b.amount),0)
  const eidOt        = bonuses.filter(b=>b.type==='eid_ot').reduce((s,b)=>s+Number(b.amount),0)
  // performance bonus is now purely a monthly sheet-entry/ad-hoc figure (bonuses array) —
  // employees.performance_bonus is only a default used to prefill the entry form, never
  // auto-added here, or a $100-default + form-entry double count would show on every slip.
  const perfBonus    = bonuses.filter(b=>b.type==='performance').reduce((s,b)=>s+Number(b.amount),0)
  const otherBon     = bonuses.filter(b=>b.type==='other')
  const monthBonus   = otherBon.length ? Number(otherBon[otherBon.length-1].amount) : 0
  const otherAddition= otherBon.slice(0,-1).reduce((s,b)=>s+Number(b.amount),0)
  const monthBonusLabel = otherBon.length&&otherBon[otherBon.length-1].description
    ? otherBon[otherBon.length-1].description
    : new Date(month+'-01').toLocaleString('en-US',{month:'long',timeZone:'UTC'})+' Bonus'
  // cash_advance and cash_variance are distinct sheet columns — cash_advance gets its own
  // labeled slot on the payslip; cash_variance/ILOE fee/fine fold into the "Other" slot
  // since the printable layout only has 4 named deduction rows.
  const cashAdv     = deductions.filter(d=>d.type==='cash_advance').reduce((s,d)=>s+Number(d.amount),0)
  const trafficFine = deductions.filter(d=>d.type==='traffic_fine').reduce((s,d)=>s+Number(d.amount),0)
  const absentDays  = deductions.filter(d=>d.type==='absent_days').reduce((s,d)=>s+Number(d.amount),0)
  const otherDed    = deductions.filter(d=>['other','cash_variance','iloe_fee','iloe_fine'].includes(d.type)).reduce((s,d)=>s+Number(d.amount),0)

  const base     = effectiveBase
  const totalAdd = base + hoursEarnings + Number(slip.bonus_total||0)
  // deduction_total from the backend is what's actually applied this month (the
  // accountant's chosen amount, defaulting to the full pending balance) -- deductions
  // are a running ledger, not a one-off subtraction. pendingDeduction is the balance
  // going into this month; carryForward is what's left after this month's payment.
  const totalDed          = Number(slip.deduction_total||0)
  const pendingDeduction  = Number(slip.pending_deduction||0)
  const carryForward      = Number(slip.deduction_carry_fwd||0)
  const net      = Number(slip.net_pay||(totalAdd-totalDed))
  const isPaid   = slip.payroll_status==='paid'
  const paidOn   = slip.paid_on ? new Date(slip.paid_on).toLocaleDateString('en-GB',{timeZone:'UTC'}) : '—'
  const monthShort = new Date(month+'-01').toLocaleString('en-US',{month:'short',year:'2-digit',timeZone:'UTC'}).replace(' ','-')
  const roleLabel  = {driver:'Driver',admin:'Admin',hr:'HR Manager',poc:'POC',accountant:'Accountant',manager:'Manager',general_manager:'General Manager'}[slip.role]||slip.role||'Staff'
  const row = (l1,v1,l2,v2) => `<tr><td class="lbl">${l1}</td><td class="val">${fmtN(v1)}</td><td class="lbl">${l2}</td><td class="val">${fmtN(v2)}</td></tr>`

  return {fmtN,totalHours,hoursEarnings,incentive,perfBonus,eidOt,monthBonus,otherAddition,monthBonusLabel,
    cashAdv,trafficFine,absentDays,otherDed,base,hourlyRate:displayRate,
    totalAdd,totalDed,pendingDeduction,carryForward,net,isPaid,paidOn,monthShort,roleLabel,row,
    isCret,isExternal,isTradelink,isDaSplit,isPackerDaily,isPackerHourly,rateLabel,hoursLabel,hasOverride}
}

function slipInnerHtml(slip, month, logoUrl, payMethod='bank') {
  const {fmtN,totalHours,hoursEarnings,incentive,perfBonus,eidOt,monthBonus,otherAddition,monthBonusLabel,
    cashAdv,trafficFine,absentDays,otherDed,base,hourlyRate,totalAdd,totalDed,pendingDeduction,carryForward,net,paidOn,monthShort,
    roleLabel,row,isCret,rateLabel,hoursLabel}=slipData(slip,month)
  const cashTick = payMethod==='cash' ? '&#10003;' : ''
  const bankTick = payMethod==='bank' ? '&#10003;' : ''
  const cretNote = isCret ? `<tr><td class="lbl" style="color:#7C3AED;font-weight:700;">Shipment Rate Used</td><td class="val" style="color:#7C3AED;">AED ${hourlyRate}/shipment</td><td></td><td></td></tr>` : ''
  const eidOtRow = eidOt > 0 ? `<tr><td class="lbl">Eid OT</td><td class="val">${fmtN(eidOt)}</td><td></td><td></td></tr>` : ''
  return `
  <div class="hdr">
    <img src="${logoUrl}" alt="GCD" onerror="this.style.display='none'"/>
    <div class="hdr-text"><div class="co-name">Golden Crescent Delivery Services</div><div class="co-addr">Burjuman Business Tower, 18th floor, office #1868</div></div>
  </div>
  <div class="slip-title">Salary Slip</div>
  <table class="info-tbl">
    <tr><td class="key">Employee ID</td><td class="data">${slip.id}</td><td class="key">Employee Name</td><td class="data">${slip.name}</td></tr>
    <tr><td class="key">Designation</td><td class="data">${roleLabel}</td><td class="key">Salary Period</td><td class="data">${monthShort}</td></tr>
  </table>
  <table class="main-tbl">
    <tr><th colspan="2">Earnings</th><th colspan="2">Deductions</th></tr>
    ${row('Basic Salary',base,'Cash Advance',cashAdv)}
    ${row(rateLabel||'',rateLabel?hourlyRate:'','Traffic Fine',trafficFine)}
    ${row(hoursLabel||'',hoursLabel?hoursEarnings:'','Absent Days',absentDays)}
    ${row('Incentive',incentive,'Other',otherDed)}
    ${row('Performance Bonus',perfBonus,'Pending Deductions',pendingDeduction)}
    ${row('Other Addition',otherAddition,'Carry Forwarded',carryForward)}
    ${cretNote}
    ${eidOtRow}
    <tr><td class="lbl">${monthBonusLabel}</td><td class="val">${fmtN(monthBonus)}</td><td></td><td></td></tr>
    <tr class="total-row"><td>TOTAL ADDITION</td><td style="text-align:right;font-weight:bold;">${fmtN(totalAdd)}</td><td>TOTAL DEDUCTION</td><td style="text-align:right;font-weight:bold;">${fmtN(totalDed)}</td></tr>
    <tr class="net-row"><td colspan="2" style="text-align:center;font-weight:bold;">Net Salary</td><td colspan="2" style="text-align:center;font-weight:bold;">${fmtN(net)}</td></tr>
  </table>
  <div class="footer">
    <div>Salary paid by &nbsp;<span class="cb">${cashTick}</span> Cash &nbsp;&nbsp;<span class="cb">${bankTick}</span> Bank account</div>
    <div style="margin-top:4px">Date of amount paid: &nbsp;${paidOn}</div>
    <div class="footer-grid"><div></div><div class="sig-line">Employee Signature</div></div>
  </div>`
}

const SLIP_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Poppins',Arial,sans-serif;background:#fff;padding:24px;font-size:11px;color:#000;}
.wrap{max-width:700px;margin:0 auto;}
.hdr{display:flex;align-items:center;gap:14px;margin-bottom:6px;}
.hdr img{width:68px;height:auto;flex-shrink:0;}
.hdr-text{flex:1;}
.co-name{font-size:15px;font-weight:800;text-transform:uppercase;text-align:center;letter-spacing:0.04em;}
.co-addr{font-size:9.5px;text-align:center;margin-top:2px;color:#555;}
.slip-title{text-align:center;font-size:12.5px;font-style:italic;font-weight:700;border-top:2px solid #000;border-bottom:2px solid #000;padding:4px 0;margin:8px 0 10px;}
.info-tbl{width:100%;border-collapse:collapse;margin-bottom:10px;}
.info-tbl td{border:1px solid #000;padding:5px 8px;font-family:'Poppins',Arial,sans-serif;}
.info-tbl .key{font-weight:700;width:18%;}
.info-tbl .data{width:32%;font-weight:500;}
.main-tbl{width:100%;border-collapse:collapse;margin-bottom:0;}
.main-tbl td,.main-tbl th{border:1px solid #000;padding:5px 8px;font-family:'Poppins',Arial,sans-serif;}
.main-tbl th{background:#d9d9d9;font-weight:700;text-align:center;font-size:11px;}
.lbl{width:22%;color:#000;font-weight:500;}
.val{width:28%;text-align:right;font-weight:700;}
.total-row td{font-weight:700;background:#f0f0f0;}
.net-row td{font-weight:800;font-size:12px;}
.footer{margin-top:18px;font-size:11px;font-family:'Poppins',Arial,sans-serif;}
.footer-grid{display:flex;justify-content:space-between;align-items:flex-end;margin-top:28px;}
.sig-line{border-top:1px solid #000;padding-top:4px;min-width:160px;text-align:center;font-size:10px;}
.cb{display:inline-block;width:12px;height:12px;border:1px solid #000;vertical-align:middle;margin-right:2px;text-align:center;line-height:11px;font-size:10px;font-weight:700;}
@media(max-width:600px){
  body{padding:10px;}
  .co-name{font-size:12px;}
  .co-addr{font-size:8.5px;}
  .info-tbl td,.main-tbl td,.main-tbl th{padding:3px 5px;font-size:9px;}
  .hdr img{width:48px;}
  .net-row td{font-size:10px;}
}
@media print{body{padding:6px;}@page{size:A4;margin:10mm;}}
`

function generatePayslip(slip, month, payMethod='bank') {
  const logoUrl = window.location.origin+'/logo.webp'
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Payslip — ${slip.name} — ${month}</title><style>${SLIP_CSS}</style></head><body><div class="wrap">${slipInnerHtml(slip,month,logoUrl,payMethod)}</div><script>window.onload=function(){setTimeout(function(){window.print()},700)}<\/script></body></html>`
  const w = window.open('','_blank')
  if (!w) {
    // Popup blocked — download as HTML file instead
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([html],{type:'text/html'}))
    a.download = `payslip_${slip.id}_${month}.html`
    a.click()
    return
  }
  w.document.write(html)
  w.document.close()
}

function generateAllPayslips(slips, month, payMethod='bank') {
  const logoUrl = window.location.origin+'/logo.webp'
  const pages=[];for(let i=0;i<slips.length;i+=2)pages.push(slips.slice(i,i+2))
  const bulk=`*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;background:#fff;font-size:10px;color:#000;}.page{display:flex;flex-direction:column;height:277mm;padding:8mm;page-break-after:always;}.page.last{page-break-after:avoid;}.slip{flex:1;min-height:0;overflow:hidden;padding:5mm;border:1px solid #ccc;}.slip.empty{border:none;}.sep{height:4mm;flex-shrink:0;}.hdr{display:flex;align-items:center;gap:10px;margin-bottom:4px;}.hdr img{width:52px;height:auto;}.hdr-text{flex:1;}.co-name{font-size:12px;font-weight:bold;text-transform:uppercase;text-align:center;letter-spacing:0.02em;}.co-addr{font-size:8.5px;text-align:center;margin-top:2px;color:#333;}.slip-title{text-align:center;font-size:10.5px;font-style:italic;font-weight:bold;border-top:1.5px solid #000;border-bottom:1.5px solid #000;padding:3px 0;margin:5px 0 7px;}.info-tbl{width:100%;border-collapse:collapse;margin-bottom:7px;}.info-tbl td{border:1px solid #000;padding:3px 6px;font-size:9.5px;}.info-tbl .key{font-weight:bold;width:18%;}.info-tbl .data{width:32%;}.main-tbl{width:100%;border-collapse:collapse;}.main-tbl td,.main-tbl th{border:1px solid #000;padding:3px 6px;font-size:9.5px;}.main-tbl th{background:#d9d9d9;font-weight:bold;text-align:center;}.lbl{width:22%;color:#000;}.val{width:28%;text-align:right;font-weight:bold;}.total-row td{font-weight:bold;background:#f0f0f0;}.net-row td{font-weight:bold;font-size:10px;}.footer{margin-top:10px;font-size:9.5px;}.footer-grid{display:flex;justify-content:space-between;align-items:flex-end;margin-top:14px;}.sig-line{border-top:1px solid #000;padding-top:3px;min-width:140px;text-align:center;font-size:8.5px;}.cb{display:inline-block;width:10px;height:10px;border:1px solid #000;vertical-align:middle;margin-right:2px;text-align:center;line-height:10px;font-size:8px;}@media print{body{background:#fff;}@page{size:A4 portrait;margin:0;}.page{page-break-after:always;}.page.last{page-break-after:avoid;}}`
  const pagesHtml=pages.map((pair,pi)=>`<div class="page${pi===pages.length-1?' last':''}"><div class="slip">${slipInnerHtml(pair[0],month,logoUrl,payMethod)}</div>${pair[1]?`<div class="sep"></div><div class="slip">${slipInnerHtml(pair[1],month,logoUrl,payMethod)}</div>`:'<div class="slip empty"></div>'}</div>`).join('\n')
  const fullHtml=`<!DOCTYPE html><html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>All Payslips — ${month}</title><style>${bulk}</style></head><body>${pagesHtml}<script>window.onload=function(){setTimeout(function(){window.print()},800)}<\/script></body></html>`
  const w=window.open('','_blank')
  if (!w) {
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([fullHtml],{type:'text/html'}));a.download=`payslips_all_${month}.html`;a.click();return
  }
  w.document.write(fullHtml)
  w.document.close()
}

function exportCSV(payroll, month, single=null) {
  const rows = single ? [single] : payroll
  const calc = rows.map(s => ({ s, c: slipData(s, month) }))
  const lines=[['GOLDEN CRESCENT DELIVERY SERVICES LLC'],[`Payroll Report — ${month}`],[`Generated: ${new Date().toLocaleDateString('en-AE')} | v${APP_VERSION}`],[],
    ['Employee','ID','Role','Station','Project','Base (AED)','Hours/Shipment Earnings (AED)','Bonuses (AED)','Deductions (AED)','Net Pay (AED)','Status'],
    ...calc.map(({s,c})=>[s.name,s.id,ROLE_CFG[s.role]?.l||s.role||'',s.station_code||'',(s.project_type||'pulser').toUpperCase(),c.base,c.hoursEarnings,c.totalAdd-c.base-c.hoursEarnings,c.totalDed,c.net,s.payroll_status==='paid'?'PAID':'PENDING']),
    [],['','','','','TOTALS',
      calc.reduce((a,{c})=>a+c.base,0),
      calc.reduce((a,{c})=>a+c.hoursEarnings,0),
      calc.reduce((a,{c})=>a+(c.totalAdd-c.base-c.hoursEarnings),0),
      calc.reduce((a,{c})=>a+c.totalDed,0),
      calc.reduce((a,{c})=>a+c.net,0),
      `${rows.filter(s=>s.payroll_status==='paid').length}/${rows.length} paid`]]
  const csv=lines.map(r=>r.map(v=>`"${v}"`).join(',')).join('\n')
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8'}));a.download=single?`payslip_${single.id}_${month}.csv`:`payroll_${month}.csv`;a.click()
}

/* ── Salary Modal ── */
function SalaryModal({emp, onSave, onClose}) {
  const [salary,setSalary]=useState(String(emp?.base_salary||emp?.salary||''))
  const [saving,setSaving]=useState(false)
  const [err,setErr]=useState(null)
  async function handleSave() {
    if (!salary||isNaN(parseFloat(salary))) return setErr('Enter a valid amount')
    setSaving(true);setErr(null)
    try {
      const cur=await fetch(`${API}/api/employees/${emp.id}`,{headers:{Authorization:`Bearer ${localStorage.getItem('gcd_token')}`}}).then(r=>r.json())
      const empData=cur.employee||emp
      const res=await fetch(`${API}/api/employees/${emp.id}`,{method:'PUT',headers:hdr(),body:JSON.stringify({...empData,salary:parseFloat(salary),id:emp.id})})
      const d=await res.json();if(!res.ok)throw new Error(d.error||'Failed')
      onSave()
    } catch(e){setErr(e.message)}finally{setSaving(false)}
  }
  return createPortal(
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:360,padding:0,overflow:'hidden'}}>
        <div style={{padding:'22px 24px 18px',background:'linear-gradient(135deg,rgba(184,134,11,0.1),transparent)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
            <h3 style={{fontWeight:900,fontSize:16,color:'var(--text)',margin:0}}>Edit Base Salary</h3>
            <button onClick={onClose} style={{width:28,height:28,borderRadius:'50%',background:'rgba(0,0,0,0.06)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}><X size={13}/></button>
          </div>
          <p style={{fontSize:12,color:'var(--text-muted)',margin:0}}>{emp.name} · {ROLE_CFG[emp.role]?.l||emp.role||'Staff'}</p>
        </div>
        <div style={{padding:'16px 24px 22px'}}>
          {err&&<div style={{background:'#FEF2F2',border:'1px solid #FCA5A5',borderRadius:9,padding:'8px 12px',fontSize:12.5,color:'#EF4444',marginBottom:12,display:'flex',gap:6,alignItems:'center'}}><AlertCircle size={12}/>{err}</div>}
          <label className="input-label">Base Salary (AED/month)</label>
          <div style={{position:'relative'}}>
            <span style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',fontSize:13,color:'var(--text-muted)',fontWeight:600}}>AED</span>
            <input className="input" type="number" value={salary} onChange={e=>setSalary(e.target.value)} autoFocus style={{paddingLeft:50,fontSize:20,fontWeight:900}}/>
          </div>
          <div style={{display:'flex',gap:10,marginTop:18}}>
            <button onClick={onClose} className="btn btn-secondary" style={{flex:1,justifyContent:'center'}}>Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{flex:2,justifyContent:'center'}}>{saving?'Saving…':'Update Salary'}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

/* ── Bonus Modal ── */
function BonusModal({employees, month, onSave, onClose}) {
  const [bulk,setBulk]=useState(false)
  const [empId,setEmpId]=useState('')
  const [type,setType]=useState('performance')
  const [amount,setAmount]=useState('')
  const [desc,setDesc]=useState('')
  const [saving,setSaving]=useState(false)
  const [err,setErr]=useState(null)
  async function handleSave() {
    if (!amount) return setErr('Amount required')
    if (!bulk&&!empId) return setErr('Select an employee')
    setSaving(true);setErr(null)
    try {
      if (bulk) await Promise.all(employees.map(e=>payrollApi.addBonus({emp_id:e.id,type,amount:parseFloat(amount),description:desc,month})))
      else await payrollApi.addBonus({emp_id:empId,type,amount:parseFloat(amount),description:desc,month})
      onSave()
    } catch(e){setErr(e.message)}finally{setSaving(false)}
  }
  return createPortal(
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:440,padding:0,overflow:'hidden'}}>
        <div style={{padding:'20px 22px 16px',background:'linear-gradient(135deg,rgba(16,185,129,0.1),transparent)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <div><h3 style={{fontWeight:900,fontSize:16,color:'var(--text)',margin:0}}>Add Bonus</h3><p style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>{month}</p></div>
            <button onClick={onClose} style={{width:28,height:28,borderRadius:'50%',background:'rgba(0,0,0,0.06)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}><X size={13}/></button>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:7}}>
            {BON_TYPES.map(t=>(
              <button key={t.v} onClick={()=>setType(t.v)} type="button"
                style={{padding:'8px',borderRadius:100,border:`2px solid ${type===t.v?t.c:'rgba(0,0,0,0.1)'}`,background:type===t.v?`${t.c}15`:'transparent',cursor:'pointer',transition:'all 0.15s',fontFamily:'Poppins,sans-serif'}}>
                <div style={{fontSize:11,fontWeight:700,color:type===t.v?t.c:'var(--text-muted)'}}>{t.l}</div>
              </button>
            ))}
          </div>
        </div>
        <div style={{padding:'16px 22px 20px',display:'flex',flexDirection:'column',gap:12}}>
          {err&&<div style={{background:'#FEF2F2',border:'1px solid #FCA5A5',borderRadius:9,padding:'8px 12px',fontSize:12,color:'#EF4444',display:'flex',gap:6,alignItems:'center'}}><AlertCircle size={12}/>{err}</div>}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            <button onClick={()=>{setBulk(false);setEmpId('')}} style={{padding:'9px',borderRadius:100,border:`2px solid ${!bulk?'#10B981':'rgba(0,0,0,0.1)'}`,background:!bulk?'rgba(16,185,129,0.1)':'transparent',color:!bulk?'#10B981':'var(--text-muted)',fontWeight:700,fontSize:12,cursor:'pointer',fontFamily:'Poppins,sans-serif'}}>Single</button>
            <button onClick={()=>setBulk(true)} style={{padding:'9px',borderRadius:100,border:`2px solid ${bulk?'#10B981':'rgba(0,0,0,0.1)'}`,background:bulk?'rgba(16,185,129,0.1)':'transparent',color:bulk?'#10B981':'var(--text-muted)',fontWeight:700,fontSize:12,cursor:'pointer',fontFamily:'Poppins,sans-serif'}}>All ({employees.length})</button>
          </div>
          {!bulk&&<div><label className="input-label">Employee</label>
            <select className="input" value={empId} onChange={e=>setEmpId(e.target.value)}>
              <option value="">Select…</option>
              {employees.map(e=><option key={e.id} value={e.id}>{e.name} — {e.id}</option>)}
            </select></div>}
          {bulk&&<div style={{background:'rgba(245,158,11,0.1)',border:'1px solid rgba(245,158,11,0.3)',borderRadius:10,padding:'10px 12px',fontSize:12.5,color:'#B45309',fontWeight:600}}>Bonus will be added to all {employees.length} employees</div>}
          <div><label className="input-label">Amount (AED)</label>
            <div style={{position:'relative'}}><span style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',fontSize:13,color:'var(--text-muted)',fontWeight:600}}>AED</span>
              <input className="input" type="number" value={amount} onChange={e=>setAmount(e.target.value)} style={{paddingLeft:50,fontSize:16,fontWeight:700}}/></div></div>
          <div><label className="input-label">Description</label>
            <input className="input" value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Reason for bonus"/></div>
          <div style={{display:'flex',gap:10,marginTop:4}}>
            <button onClick={onClose} className="btn btn-secondary" style={{flex:1,justifyContent:'center'}}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{flex:2,display:'flex',alignItems:'center',justifyContent:'center',gap:6,padding:'11px',borderRadius:100,background:'linear-gradient(135deg,#10B981,#22C55E)',color:'white',fontWeight:700,fontSize:13,border:'none',cursor:'pointer',fontFamily:'Poppins,sans-serif',opacity:saving?0.7:1}}>
              {saving?'Saving…':bulk?`Add to All`:'Add Bonus'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

/* ── Deduction Modal ── */
function DeductionModal({employees, month, onSave, onClose}) {
  const [form,setForm]=useState({emp_id:'',type:'traffic_fine',amount:'',description:'',reference:'',installments:''})
  const [saving,setSaving]=useState(false)
  const [err,setErr]=useState(null)
  const set=(k,v)=>setForm(p=>({...p,[k]:v}))
  async function handleSave() {
    if (!form.emp_id||!form.amount) return setErr('Employee and amount required')
    setSaving(true);setErr(null)
    try {await payrollApi.addDeduction({...form,month,amount:parseFloat(form.amount),installments:form.installments||undefined});onSave()}
    catch(e){setErr(e.message)}finally{setSaving(false)}
  }
  return createPortal(
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:440,padding:0,overflow:'hidden'}}>
        <div style={{padding:'20px 22px 16px',background:'linear-gradient(135deg,rgba(239,68,68,0.08),transparent)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <div><h3 style={{fontWeight:900,fontSize:16,color:'var(--text)',margin:0}}>Add Deduction</h3><p style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>{month}</p></div>
            <button onClick={onClose} style={{width:28,height:28,borderRadius:'50%',background:'rgba(0,0,0,0.06)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}><X size={13}/></button>
          </div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {DED_TYPES.map(t=>(
              <button key={t.v} onClick={()=>set('type',t.v)} type="button"
                style={{padding:'5px 11px',borderRadius:20,border:`2px solid ${form.type===t.v?t.c:'rgba(0,0,0,0.1)'}`,background:form.type===t.v?`${t.c}12`:'transparent',cursor:'pointer',fontFamily:'Poppins,sans-serif'}}>
                <span style={{fontSize:11,fontWeight:700,color:form.type===t.v?t.c:'var(--text-muted)'}}>{t.l}</span>
              </button>
            ))}
          </div>
        </div>
        <div style={{padding:'16px 22px 20px',display:'flex',flexDirection:'column',gap:12}}>
          {err&&<div style={{background:'#FEF2F2',border:'1px solid #FCA5A5',borderRadius:9,padding:'8px 12px',fontSize:12,color:'#EF4444',display:'flex',gap:6,alignItems:'center'}}><AlertCircle size={12}/>{err}</div>}
          <div><label className="input-label">Employee</label>
            <select className="input" value={form.emp_id} onChange={e=>set('emp_id',e.target.value)}>
              <option value="">Select…</option>
              {employees.map(e=><option key={e.id} value={e.id}>{e.name} — {e.id}</option>)}
            </select></div>
          <div><label className="input-label">Amount (AED)</label>
            <div style={{position:'relative'}}><span style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',fontSize:13,color:'var(--text-muted)',fontWeight:600}}>AED</span>
              <input className="input" type="number" value={form.amount} onChange={e=>set('amount',e.target.value)} style={{paddingLeft:50,fontSize:16,fontWeight:700}}/></div></div>
          {form.type==='cash_advance' && (
            <div><label className="input-label">Repay Over (months)</label>
              <input className="input" type="number" min="1" step="1" value={form.installments} onChange={e=>set('installments',e.target.value)} placeholder="Leave blank to deduct in full whenever there's room"/>
            </div>
          )}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div><label className="input-label">Description</label><input className="input" value={form.description} onChange={e=>set('description',e.target.value)} placeholder="Visible to DA"/></div>
            <div><label className="input-label">Reference No.</label><input className="input" value={form.reference} onChange={e=>set('reference',e.target.value)} placeholder="Fine / ticket no."/></div>
          </div>
          <div style={{display:'flex',gap:10,marginTop:4}}>
            <button onClick={onClose} className="btn btn-secondary" style={{flex:1,justifyContent:'center'}}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{flex:2,display:'flex',alignItems:'center',justifyContent:'center',gap:6,padding:'11px',borderRadius:100,background:'linear-gradient(135deg,#EF4444,#F87171)',color:'white',fontWeight:700,fontSize:13,border:'none',cursor:'pointer',fontFamily:'Poppins,sans-serif',opacity:saving?0.7:1}}>
              {saving?'Saving…':'Add Deduction'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

/* ── Add Driver/Staff Pay Modal (manual, sheet-style) ──
   Mirrors the real accountant salary sheet: base units/amount plus named, selectable
   bonus & deduction columns (rather than a generic type+amount pair). Prefills from
   GET /api/payroll/entry when re-opened for someone already entered this month. */
const SHEET_BONUS_FIELDS = [
  {k:'perfBonus',     f:'performance_bonus', l:'Performance Bonus'},
  {k:'incentive',     f:'incentive',         l:'Incentive'},
  {k:'otherAddition', f:'other_addition',    l:'Other Addition'},
  {k:'eidOt',         f:'eid_ot',            l:'Eid OT'},
]
const SHEET_DEDUCTION_FIELDS = [
  {k:'trafficFine',  f:'traffic_fine',  l:'Traffic Fine'},
  {k:'cashAdvance',  f:'cash_advance',  l:'Cash Advance'},
  {k:'cashVariance', f:'cash_variance', l:'Cash Variance'},
  {k:'absentDaysDed',f:'absent_days',   l:'Absent Days'},
  {k:'others',       f:'others',        l:'Others'},
]
const emptySheetFields = () => ({perfBonus:'',incentive:'',otherAddition:'',eidOt:'',trafficFine:'',cashAdvance:'',cashVariance:'',absentDaysDed:'',others:''})

const PROJECT_TYPE_LABELS = { staff:'Staff/Admin', pulser:'Pulser', cret:'CRET', tradelink:'Tradelink', external:'External',
  jnt_express:'JNT DAs', imile:'iMile DAs', le_chocola:'Le Chocola Packers', creative_packers:'Creative Packers' }
// These 4 client-project piece-work types don't get their own tab — they live under
// "External" (client/non-Amazon work, same as ad-hoc external drivers), so the tab bar
// isn't 5 mostly-empty tabs deep. Each keeps its own pay formula/rate fields — this only
// changes which tab groups them, not how their pay is calculated.
const EXTERNAL_MERGED_TYPES = ['jnt_express', 'imile', 'le_chocola', 'creative_packers']
// Thin router: owns the one piece of state ("which pay type is this") and picks which
// modal actually renders. Kept separate from GenericUnitsModal below (rather than an
// early-return partway through that component) because JNT/non-JNT need different hook
// sets, and React requires the same hooks in the same order on every render of one
// component instance — splitting into sibling components sidesteps that entirely.
function AddUnitsModal({employees, month, projectType, initialEmpId, onSave, onClose}) {
  // Opened from the merged "External" tab (projectType==='external'), the actual formula
  // is ambiguous until the accountant says which one applies — JNT/iMile/Le Chocola/
  // Creative Packers are calculated completely differently from a flat-rate external
  // driver. Editing an existing entry always passes that employee's real type directly
  // (see editEntry below), so this selector only matters for a brand-new entry.
  const [subType, setSubType] = useState(projectType === 'external' ? 'jnt_express' : projectType)
  const effType = projectType === 'external' ? subType : projectType

  if (effType === 'jnt_express') {
    return (
      <JntSalaryModal
        employees={employees} month={month} initialEmpId={initialEmpId}
        onSave={onSave} onClose={onClose}
        onChangeType={projectType === 'external' ? setSubType : undefined}
      />
    )
  }

  if (effType === 'creative_packers' || effType === 'le_chocola') {
    return (
      <PackerPayModal
        employees={employees} month={month} projectType={effType} initialEmpId={initialEmpId}
        onSave={onSave} onClose={onClose}
        onChangeType={projectType === 'external' ? setSubType : undefined}
      />
    )
  }

  if (effType === 'imile') {
    return (
      <ImileSalaryModal
        employees={employees} month={month} initialEmpId={initialEmpId}
        onSave={onSave} onClose={onClose}
        onChangeType={projectType === 'external' ? setSubType : undefined}
      />
    )
  }

  return (
    <GenericUnitsModal
      employees={employees} month={month} projectType={projectType} initialEmpId={initialEmpId}
      subType={subType} setSubType={setSubType} onSave={onSave} onClose={onClose}
    />
  )
}

function GenericUnitsModal({employees, month, projectType, initialEmpId, subType, setSubType, onSave, onClose}) {
  const effType = projectType === 'external' ? subType : projectType

  const isStaff     = effType === 'staff'
  const isExternal  = effType === 'external'
  const isCret      = effType === 'cret'
  const isPulser    = effType === 'pulser'
  const isTradelink = effType === 'tradelink'
  const isDaSplit       = effType === 'jnt_express' || effType === 'imile'
  const isPackerDaily  = effType === 'creative_packers'
  const isPackerHourly = effType === 'le_chocola'
  const isDriverTab = isExternal || isCret || isPulser || isTradelink || isDaSplit || isPackerDaily || isPackerHourly
  const label = PROJECT_TYPE_LABELS[effType] || effType
  const valueLabel = isStaff ? 'Salary Amount (AED)' : isPulser || isPackerHourly || isPackerDaily ? 'Hours Worked' : isDaSplit ? 'COD Shipments' : 'Shipments'
  // Every driver category only shows its own roster — a Pulser driver isn't a CRET
  // candidate, a JNT DA isn't a Creative Packer, and so on. Null/unset project_type
  // defaults to 'pulser' (the historical default before project_type existed).
  const empOptions = isStaff
    ? employees.filter(e => (e.role||'').toLowerCase()!=='driver')
    : employees.filter(e => (e.role||'').toLowerCase()==='driver' && (e.project_type||'pulser').toLowerCase()===effType)
        .sort((a,b) => (a.name||'').localeCompare(b.name||''))

  const [empId,       setEmpId]       = useState('')
  const [name,        setName]        = useState('')
  const [company,     setCompany]     = useState('')
  const [rate,        setRate]        = useState('0.5')
  const [value,       setValue]       = useState('')
  const [valueNonCod, setValueNonCod] = useState('')
  const [workingDays, setWorkingDays] = useState('')
  const [cretRate,    setCretRate]    = useState('0.5')
  const [pending,        setPending]        = useState(null)
  const [schedule,       setSchedule]       = useState([])
  const [loadingEntry,   setLoadingEntry]   = useState(false)
  const [dedDone,     setDedDone]     = useState('')
  const [sheet,        setSheet]        = useState(emptySheetFields())
  const [cashAdvMonths, setCashAdvMonths] = useState('')
  const [saving,      setSaving]      = useState(false)
  const [err,         setErr]         = useState(null)
  const setSheetField = (k,v) => setSheet(p=>({...p,[k]:v}))

  // Prefill with any existing entry for this employee+month (units, working days, cret
  // rate, deductions-to-apply, and every sheet bonus/deduction field), or with sensible
  // defaults for a brand-new entry (employee's stored salary/performance-bonus default).
  async function pickEmp(id) {
    setEmpId(id); setPending(null); setSchedule([]); setDedDone(''); setSheet(emptySheetFields()); setCashAdvMonths('')
    setWorkingDays(''); setCretRate('0.5'); setValueNonCod('')
    if (!id) { setValue(''); return }
    const e = empOptions.find(o=>o.id===id)
    setValue(isStaff ? String(e?.salary||'') : '')
    setLoadingEntry(true)
    try {
      const d = await payrollApi.getEntry(id, month)
      setPending(d.pending); setSchedule(d.schedule||[])
      const entry = d.entry
      if (entry) {
        if (!isStaff && !isTradelink) setValue(entry.units!=null ? String(entry.units) : '')
        else if (entry.amount!=null) setValue(String(entry.amount))
        if (entry.units_non_cod!=null) setValueNonCod(String(entry.units_non_cod))
        if (entry.working_days!=null) setWorkingDays(String(entry.working_days))
        if (entry.cret_rate!=null) setCretRate(String(entry.cret_rate))
        setDedDone(entry.deductions_done!=null ? String(entry.deductions_done) : (d.suggested>0?String(d.suggested):''))
      } else {
        setDedDone(d.suggested>0 ? String(d.suggested) : '')
      }
      setSheet({
        perfBonus:     d.bonuses.performance != null ? String(d.bonuses.performance) : (!entry && isPulser ? String(e?.performance_bonus||'') : ''),
        incentive:     d.bonuses.kpi   != null ? String(d.bonuses.kpi)   : '',
        otherAddition: d.bonuses.other != null ? String(d.bonuses.other) : '',
        eidOt:         d.bonuses.eid_ot != null ? String(d.bonuses.eid_ot) : '',
        trafficFine:   d.deductions.traffic_fine  != null ? String(d.deductions.traffic_fine)  : '',
        cashAdvance:   d.deductions.cash_advance  != null ? String(d.deductions.cash_advance)  : '',
        cashVariance:  d.deductions.cash_variance != null ? String(d.deductions.cash_variance) : '',
        absentDaysDed: d.deductions.absent_days   != null ? String(d.deductions.absent_days)   : '',
        others:        d.deductions.other != null ? String(d.deductions.other) : '',
      })
      if (d.deduction_installments?.cash_advance) setCashAdvMonths(String(d.deduction_installments.cash_advance))
    } catch(e) { /* non-fatal — prefill is a convenience, not required */ }
    finally { setLoadingEntry(false) }
  }

  // Opened as "Edit" from an existing payroll row — jump straight to that employee's
  // entry instead of making the accountant reselect them from the dropdown.
  useEffect(() => { if (initialEmpId) pickEmp(initialEmpId) },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [])

  const fieldMap = { perfBonus:'performance_bonus', incentive:'incentive', otherAddition:'other_addition', eidOt:'eid_ot',
    trafficFine:'traffic_fine', cashAdvance:'cash_advance', cashVariance:'cash_variance', absentDaysDed:'absent_days', others:'others' }

  async function handleSave() {
    let v = 0
    if (!isTradelink) {
      v = parseFloat(value)
      if (isNaN(v) || v < 0) return setErr(`Enter a valid ${valueLabel.toLowerCase()} value`)
    }
    let vNonCod = 0
    if (isDaSplit) {
      vNonCod = parseFloat(valueNonCod || 0)
      if (isNaN(vNonCod) || vNonCod < 0) return setErr('Enter a valid Non-COD shipments value')
    }
    if (!empId && (!isExternal || !name)) return setErr(isExternal ? 'Select a driver or enter a name for a new one' : `Select a ${isStaff?'staff member':'driver'}`)
    setSaving(true); setErr(null)
    try {
      const sheetPayload = {}
      for (const [k,f] of Object.entries(fieldMap)) sheetPayload[f] = sheet[k]===''?0:parseFloat(sheet[k])||0
      if (parseFloat(sheet.cashAdvance) > 0 && cashAdvMonths) sheetPayload.cash_advance_installments = parseInt(cashAdvMonths, 10)
      await payrollApi.addUnits({
        month,
        units:  isStaff ? undefined : (isTradelink ? 0 : v),
        units_non_cod: isDaSplit ? vNonCod : undefined,
        amount: isStaff ? v : undefined,
        working_days: (isPulser||isCret||isTradelink) && workingDays!=='' ? workingDays : undefined,
        cret_rate: isCret ? cretRate : undefined,
        deductions_done: dedDone!=='' ? dedDone : undefined,
        emp_id: empId || undefined,
        name: !empId ? name : undefined,
        external_company: !empId ? (company||undefined) : undefined,
        per_shipment_rate: !empId ? (parseFloat(rate)||0.5) : undefined,
        project_type: isDriverTab ? effType : undefined,
        ...sheetPayload,
      })
      onSave()
    } catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  const newDedTotal = SHEET_DEDUCTION_FIELDS.reduce((s,{k})=>s+(parseFloat(sheet[k])||0),0)

  return createPortal(
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:480,maxHeight:'85vh',padding:0,overflow:'hidden',display:'flex',flexDirection:'column'}}>
        <div style={{padding:'20px 22px 16px',background:'linear-gradient(135deg,rgba(184,134,11,0.1),transparent)',flexShrink:0}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div><h3 style={{fontWeight:900,fontSize:16,color:'var(--text)',margin:0}}>{initialEmpId?'Edit':'Add'} {label} Pay</h3><p style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>{month}</p></div>
            <button onClick={onClose} style={{width:28,height:28,borderRadius:'50%',background:'rgba(0,0,0,0.06)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}><X size={13}/></button>
          </div>
        </div>
        <div style={{padding:'16px 22px 20px',display:'flex',flexDirection:'column',gap:12,overflowY:'auto'}}>
          {err&&<div style={{background:'#FEF2F2',border:'1px solid #FCA5A5',borderRadius:9,padding:'8px 12px',fontSize:12,color:'#EF4444',display:'flex',gap:6,alignItems:'center'}}><AlertCircle size={12}/>{err}</div>}

          {projectType === 'external' && (
            <div><label className="input-label">Pay Type *</label>
              <select className="input" value={subType} onChange={e=>{setSubType(e.target.value); pickEmp('')}}>
                <option value="jnt_express">JNT DAs</option>
                <option value="imile">iMile DAs</option>
                <option value="le_chocola">Le Chocola Packers</option>
                <option value="creative_packers">Creative Packers</option>
              </select></div>
          )}

          <div><label className="input-label">{isExternal ? 'Existing Driver (optional)' : isStaff ? 'Staff / Admin *' : 'Driver *'}</label>
            <select className="input" value={empId} onChange={e=>pickEmp(e.target.value)}>
              <option value="">{isExternal ? '— Create new driver —' : 'Select…'}</option>
              {empOptions.map(e=><option key={e.id} value={e.id}>{e.name} — {e.id}</option>)}
            </select></div>

          {isExternal && !empId && (<>
            <div><label className="input-label">Driver Name *</label>
              <input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="Full name"/></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div><label className="input-label">Company</label>
                <input className="input" value={company} onChange={e=>setCompany(e.target.value)} placeholder="JNT, iMile, Le Chocolat…"/></div>
              <div><label className="input-label">Rate / Shipment (AED)</label>
                <input className="input" type="number" step="0.01" value={rate} onChange={e=>setRate(e.target.value)}/></div>
            </div>
          </>)}

          {(isPulser || isCret || isTradelink) && (
            <div><label className="input-label">Working Days (this month)</label>
              <input className="input" type="number" step="0.5" min="0" max="31" value={workingDays} onChange={e=>setWorkingDays(e.target.value)} placeholder="e.g. 31"/></div>
          )}

          {isCret && (
            <div><label className="input-label">Shipment Rate — this driver, this month *</label>
              <select className="input" value={cretRate} onChange={e=>setCretRate(e.target.value)}>
                <option value="0.5">AED 0.5 / shipment (+ base salary)</option>
                <option value="2">AED 2 / shipment (flat, no base)</option>
                <option value="3">AED 3 / shipment (flat, no base)</option>
              </select></div>
          )}

          {!isTradelink && (
            <div><label className="input-label">{valueLabel} *</label>
              <input className="input" type="number" step="0.01" min="0" value={value} onChange={e=>setValue(e.target.value)} placeholder="0"/></div>
          )}

          {isDaSplit && (
            <div><label className="input-label">Non-COD Shipments *</label>
              <input className="input" type="number" step="0.01" min="0" value={valueNonCod} onChange={e=>setValueNonCod(e.target.value)} placeholder="0"/></div>
          )}

          {loadingEntry && <div style={{fontSize:11.5,color:'var(--text-muted)'}}>Loading existing entry…</div>}

          <div style={{borderTop:'1px solid var(--border)',paddingTop:10}}>
            <div style={{fontSize:11.5,fontWeight:800,color:'#10B981',textTransform:'uppercase',letterSpacing:'0.03em',marginBottom:8}}>Bonuses</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
              {SHEET_BONUS_FIELDS.map(({k,l})=>(
                <div key={k}><label className="input-label" style={{fontSize:10.5}}>{l}</label>
                  <input className="input" type="number" step="0.01" min="0" value={sheet[k]} onChange={e=>setSheetField(k,e.target.value)} placeholder="0" style={{padding:'8px 10px',fontSize:12.5}}/></div>
              ))}
            </div>
          </div>

          <div style={{borderTop:'1px solid var(--border)',paddingTop:10}}>
            <div style={{fontSize:11.5,fontWeight:800,color:'#EF4444',textTransform:'uppercase',letterSpacing:'0.03em',marginBottom:8}}>Deductions</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
              {SHEET_DEDUCTION_FIELDS.map(({k,l})=>(
                <div key={k}>
                  <label className="input-label" style={{fontSize:10.5}}>{l}</label>
                  <input className="input" type="number" step="0.01" min="0" value={sheet[k]} onChange={e=>setSheetField(k,e.target.value)} placeholder="0" style={{padding:'8px 10px',fontSize:12.5}}/>
                  {k==='cashAdvance' && parseFloat(sheet.cashAdvance)>0 && (
                    <input className="input" type="number" step="1" min="1" value={cashAdvMonths} onChange={e=>setCashAdvMonths(e.target.value)}
                      placeholder="Repay over (months)" title="How many months to spread this cash advance's deduction over — leave blank to deduct it in full whenever there's room"
                      style={{padding:'8px 10px',fontSize:11.5,marginTop:5}}/>
                  )}
                </div>
              ))}
            </div>
          </div>

          {empId && (
            <div>
              <label className="input-label">Deductions to Apply This Month</label>
              <input className="input" type="number" step="0.01" min="0" value={dedDone} onChange={e=>setDedDone(e.target.value)} placeholder="0"/>
              <div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>
                {pending!=null && (
                  <>Pending balance before this entry: AED {pending.toLocaleString()}{newDedTotal>0?` · new deductions above: AED ${newDedTotal.toLocaleString()}`:''} — this defaults to the installment-aware suggested amount; adjust it to decide how much actually comes out of pay this month, the rest carries forward.</>
                )}
              </div>
              {schedule.some(s=>s.installments) && (
                <div style={{marginTop:8,border:'1px solid var(--border)',borderRadius:8,overflow:'hidden'}}>
                  <div style={{padding:'6px 10px',background:'var(--bg-alt)',fontSize:10.5,fontWeight:700,color:'var(--text-muted)'}}>Active repayment plans</div>
                  {schedule.filter(s=>s.installments).map(s=>(
                    <div key={s.id} style={{padding:'6px 10px',fontSize:11,borderTop:'1px solid var(--border)',display:'flex',justifyContent:'space-between',color:'var(--text)'}}>
                      <span>{s.type.replace('_',' ')} — AED {s.amount.toLocaleString()} / {s.installments} mo.</span>
                      <span style={{fontWeight:700}}>AED {s.due_this_month.toLocaleString()} due · {s.remaining.toLocaleString()} left</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{display:'flex',gap:10,marginTop:4}}>
            <button onClick={onClose} className="btn btn-secondary" style={{flex:1,justifyContent:'center'}}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{flex:2,display:'flex',alignItems:'center',justifyContent:'center',gap:6,padding:'11px',borderRadius:100,background:'linear-gradient(135deg,#B8860B,#D4A017)',color:'white',fontWeight:700,fontSize:13,border:'none',cursor:'pointer',fontFamily:'Poppins,sans-serif',opacity:saving?0.7:1}}>
              {saving?'Saving…':'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

// Optional named bonus/deduction columns appended to every bulk template — mirrors the
// real salary sheet's selectable columns. Blank/omitted cells clear that field for the
// month (bulk upload replaces the whole monthly entry, same as the manual form).
const SHEET_CSV_COLS = ['performance_bonus','incentive','other_addition','eid_ot','traffic_fine','cash_advance','cash_advance_installments','cash_variance','absent_days','others']

/* ── Bulk Upload Pay Modal ── */
function BulkUnitsModal({month, projectType, employees, onSave, onClose}) {
  // Same ambiguity as AddUnitsModal above when opened from the merged "External" tab —
  // the CSV format itself differs per formula, so the accountant has to pick before
  // downloading a template or uploading a file. JNT and iMile each go through their
  // own dedicated engine (jntSalaryApi/imileSalaryApi saveEntriesBulk) instead of the
  // generic payrollApi.addUnitsBulk — see handleUpload below.
  const [subType, setSubType] = useState(projectType === 'external' ? 'jnt_express' : projectType)
  const effType = projectType === 'external' ? subType : projectType

  const isStaff     = effType === 'staff'
  const isExternal  = effType === 'external'
  const isCret       = effType === 'cret'
  const isPulser     = effType === 'pulser'
  const isTradelink  = effType === 'tradelink'
  const isJnt   = effType === 'jnt_express'
  const isImile = effType === 'imile'
  const isPackerDaily  = effType === 'creative_packers'
  const isPackerHourly = effType === 'le_chocola'
  const isDriverTab  = isExternal || isCret || isPulser || isTradelink || isJnt || isImile || isPackerDaily || isPackerHourly
  const label = PROJECT_TYPE_LABELS[effType] || effType
  const valueLabel = isStaff ? 'AED' : isPackerHourly || isPackerDaily ? 'hours' : (isJnt || isImile) ? 'COD shipments' : isPulser ? 'hours' : 'shipments'
  // Everyone currently on this project's roster — the template is pre-filled with
  // their real ID/name so the accountant just fills in numbers next to each name,
  // instead of hand-typing IDs (and risking a typo the upload then rejects).
  const roster = isStaff
    ? (employees||[]).filter(e => (e.role||'').toLowerCase() !== 'driver')
    : (employees||[]).filter(e => (e.role||'').toLowerCase() === 'driver' && (e.project_type||'pulser').toLowerCase() === effType)
        .sort((a,b) => (a.name||'').localeCompare(b.name||''))

  const [rows,      setRows]      = useState([])
  const [fileName,  setFileName]  = useState('')
  const [uploading, setUploading] = useState(false)
  const [err,       setErr]       = useState(null)
  const [result,    setResult]    = useState(null)

  function resetSubType(v) { setSubType(v); setRows([]); setFileName(''); setErr(null); setResult(null) }

  function downloadTemplate() {
    if (isExternal) {
      // Ad-hoc/subcontracted drivers aren't on any roster to pre-fill from — this is
      // the only type where a brand-new person can be created straight from the CSV.
      const csv = 'name,external_company,units,per_shipment_rate,deductions_done\nJohn Doe,JNT,120,0.75,0\n'
      const blob = new Blob([csv], { type:'text/csv' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = `${effType}_pay_template.csv`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
      return
    }

    // cols[0]/[1] are always emp_id,name — everything after is left blank for the
    // accountant to fill in. JNT/iMile have their own deduction sets and skip the
    // generic bonus/deduction sheet columns entirely (extraCols=[]); JNT bulk also
    // doesn't cover "Additional Earnings" components — those still need the single
    // JNT DA Salary form.
    let cols, extraCols = SHEET_CSV_COLS
    if (isStaff) cols = ['emp_id','name','amount','deductions_done']
    else if (isCret) cols = ['emp_id','name','units','working_days','cret_rate','deductions_done']
    else if (isTradelink) cols = ['emp_id','name','working_days','deductions_done']
    else if (isJnt) {
      // Matches the real accountant sheet's column layout/order exactly — no emp_id
      // column (the real sheet doesn't have one), so rows are matched to a DA by Name
      // on upload instead (see handleFile below). Includes the sheet's computed
      // columns too (total_shipments, *_payment, total_salary, salary_to_be_paid) so
      // an existing sheet can be pasted straight in — only the raw inputs are read on
      // upload, the computed ones are ignored.
      cols = ['name','branch','days','total_shipments','cod_shipments','cod_payment','non_cod_shipments','non_cod_payment',
        'pickup_shipments','pickup_payment','reverse_pickup_shipments','reverse_payment','total_salary',
        'jnt_deduction','sim_charge','car_rent','rta_fines','carry_forward','advance_payment','salary_to_be_paid']
      extraCols = []
    }
    else if (isImile) { cols = ['emp_id','name','project','da_type','branch','cod_shipments','non_cod_shipments','imile_deduction','sim_charge','car_rent','rta_fine','carry_forward','cash_advance']; extraCols = [] }
    else if (isPackerDaily || isPackerHourly) cols = ['emp_id','name','hours_worked','deductions_done']
    else cols = ['emp_id','name','units','working_days','deductions_done'] // pulser

    const allCols = [...cols, ...extraCols]
    // "branch" is only ever a pre-fillable reference column for JNT (the DA's known
    // station) — for iMile it's a real per-entry input (DXB DS/AQS DS/AJM DS, not the
    // employee's station_code), so it must stay blank there for the accountant to pick.
    const colValue = (c, e) => {
      if (c === 'emp_id') return e.id
      if (c === 'name') return `"${(e.name||'').replace(/"/g,'""')}"`
      if (c === 'branch' && isJnt) return e.station_code || ''
      return ''
    }
    const blankRow = id => allCols.map(c => c==='emp_id' ? id : '').join(',')
    const rosterLines = roster.map(e => allCols.map(c => colValue(c, e)).join(','))
    const lines = rosterLines.length ? rosterLines : [blankRow('E001')]
    const csv = `${allCols.join(',')}\n${lines.join('\n')}\n`
    const blob = new Blob([csv], { type:'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `${effType}_pay_template.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Blank cell → 0, same "not filled in yet" convention every other numeric column
  // in this uploader already uses; only flags an error if something non-numeric or
  // negative was actually typed in.
  function numField(r, col, errors) {
    if (r[col] === undefined || r[col] === '') return 0
    const v = parseFloat(r[col])
    if (isNaN(v) || v < 0) { errors.push(`${col} must be a non-negative number`); return 0 }
    return v
  }

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setFileName(file.name); setErr(null); setResult(null)
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (res) => {
        const unitsCol = isStaff ? 'amount' : (isJnt || isImile) ? 'cod_shipments' : (isPackerDaily || isPackerHourly) ? 'hours_worked' : 'units'
        const parsed = res.data.map((r,i) => {
          let emp_id = (r.emp_id||'').trim()
          const name   = (r.name||'').trim()
          const errors = []
          if (isStaff && !emp_id) errors.push('emp_id required')
          if (isExternal && !emp_id && !name) errors.push('name required (or emp_id for an existing driver)')
          if (!isStaff && !isExternal && !isJnt && !emp_id) errors.push('emp_id required')
          if (isCret && r.cret_rate && isNaN(parseFloat(r.cret_rate))) errors.push('cret_rate must be a number')

          if (isJnt) {
            // The real sheet has no ID column, only Name — so rows are matched to a
            // roster DA by name instead. Exact match required; ambiguous (2+ DAs
            // sharing a name) or unmatched names fail that row rather than guessing.
            if (!name) errors.push('name required')
            else {
              const matches = roster.filter(r2 => (r2.name||'').trim().toLowerCase() === name.toLowerCase())
              if (matches.length === 0) errors.push(`No JNT DA found named "${name}"`)
              else if (matches.length > 1) errors.push(`Multiple JNT DAs named "${name}" — rename one to be unique before uploading`)
              else emp_id = matches[0].id
            }
            // branch/total_shipments/*_payment/total_salary/salary_to_be_paid are
            // present as columns (matching the real sheet, so it pastes in directly)
            // but are reference/computed-only — not read here.
            return {
              row: i+2, emp_id, name,
              cod: numField(r,'cod_shipments',errors), non_cod: numField(r,'non_cod_shipments',errors),
              pickup: numField(r,'pickup_shipments',errors), reverse_pickup: numField(r,'reverse_pickup_shipments',errors),
              working_days: r.days !== undefined && r.days !== '' ? numField(r,'days',errors) : undefined,
              jnt_deduction: numField(r,'jnt_deduction',errors), sim_charge: numField(r,'sim_charge',errors),
              car_rent: numField(r,'car_rent',errors), rta_fine: numField(r,'rta_fines',errors),
              carry_forward: numField(r,'carry_forward',errors), cash_advance: numField(r,'advance_payment',errors),
              get units() { return this.cod }, errors,
            }
          }
          if (isImile) {
            const project = (r.project||'').trim(), da_type = (r.da_type||'').trim().toLowerCase(), branch = (r.branch||'').trim()
            if (!project || !da_type || !branch) errors.push('project, da_type and branch are required')
            return {
              row: i+2, emp_id, name, project, da_type, branch,
              cod: numField(r,'cod_shipments',errors), non_cod: numField(r,'non_cod_shipments',errors),
              imile_deduction: numField(r,'imile_deduction',errors), sim_charge: numField(r,'sim_charge',errors),
              car_rent: numField(r,'car_rent',errors), rta_fine: numField(r,'rta_fine',errors),
              carry_forward: numField(r,'carry_forward',errors), cash_advance: numField(r,'cash_advance',errors),
              get units() { return this.cod }, errors,
            }
          }

          const value      = isTradelink ? 0 : parseFloat(r[unitsCol])
          if (!isTradelink && (isNaN(value) || value < 0)) errors.push(`${unitsCol} must be a non-negative number`)
          const sheetCols = {}
          for (const col of SHEET_CSV_COLS) if (r[col] !== undefined) sheetCols[col] = col === 'cash_advance_installments' ? (parseInt(r[col],10)||undefined) : (parseFloat(r[col])||0)
          return {
            row: i+2, emp_id, name,
            external_company: (r.external_company||'').trim(),
            per_shipment_rate: r.per_shipment_rate ? parseFloat(r.per_shipment_rate) : undefined,
            working_days: (isPulser||isCret||isTradelink) && r.working_days ? parseFloat(r.working_days) : undefined,
            cret_rate: isCret && r.cret_rate ? parseFloat(r.cret_rate) : undefined,
            deductions_done: r.deductions_done !== undefined && r.deductions_done !== '' ? parseFloat(r.deductions_done) : undefined,
            units:  isStaff ? undefined : value,
            amount: isStaff ? value : undefined,
            ...sheetCols,
            errors,
          }
        })
        setRows(parsed)
      },
      error: (e) => setErr(e.message),
    })
  }

  const validRows = rows.filter(r => r.errors.length === 0)

  async function handleUpload() {
    if (!validRows.length) return
    setUploading(true); setErr(null)
    try {
      let data
      if (isJnt) {
        data = await jntSalaryApi.saveEntriesBulk(month, validRows.map(({row,errors,units,name,...r}) => r))
      } else if (isImile) {
        data = await imileSalaryApi.saveEntriesBulk(month, validRows.map(({row,errors,units,name,...r}) => r))
      } else {
        data = await payrollApi.addUnitsBulk(month, validRows.map(({row,errors,name,...r}) => r), isDriverTab ? effType : undefined)
      }
      setResult(data)
    } catch(e) { setErr(e.message) } finally { setUploading(false) }
  }

  return createPortal(
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:600,maxHeight:'85vh',padding:0,overflow:'hidden',display:'flex',flexDirection:'column'}}>
        <div style={{padding:'20px 22px 16px',background:'linear-gradient(135deg,rgba(184,134,11,0.1),transparent)',flexShrink:0}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div><h3 style={{fontWeight:900,fontSize:16,color:'var(--text)',margin:0}}>Bulk Upload {label} Pay</h3><p style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>{month}</p></div>
            <button onClick={onClose} style={{width:28,height:28,borderRadius:'50%',background:'rgba(0,0,0,0.06)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}><X size={13}/></button>
          </div>
        </div>

        <div style={{padding:'16px 22px 20px',display:'flex',flexDirection:'column',gap:14,overflowY:'auto',flex:1}}>
          {err&&<div style={{background:'#FEF2F2',border:'1px solid #FCA5A5',borderRadius:9,padding:'8px 12px',fontSize:12,color:'#EF4444',display:'flex',gap:6,alignItems:'center'}}><AlertCircle size={12}/>{err}</div>}

          {projectType === 'external' && !result && (
            <div><label className="input-label">Pay Type *</label>
              <select className="input" value={subType} onChange={e=>resetSubType(e.target.value)}>
                <option value="jnt_express">JNT DAs</option>
                <option value="imile">iMile DAs</option>
                <option value="le_chocola">Le Chocola Packers</option>
                <option value="creative_packers">Creative Packers</option>
              </select></div>
          )}
          {(isJnt) && !result && (
            <div style={{fontSize:11.5,color:'var(--text-muted)',background:'var(--bg-alt)',borderRadius:9,padding:'8px 12px'}}>
              Bulk upload covers Base Shipment Pay + the 6 deductions only — Fuel Subsidy, Eid Incentive and other "Additional Earnings" still need the single JNT DA Salary form. Branch/Total Shipments/*Payment/Total Salary/Salary To Be Paid columns match the real sheet for easy copy-paste but are reference only — not read on upload.
            </div>
          )}

          {result ? (
            <div style={{textAlign:'center',padding:'16px 8px'}}>
              <div style={{width:48,height:48,borderRadius:'50%',background:'#ECFDF5',border:'1px solid #A7F3D0',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px'}}>
                <Check size={22} color="#22C55E"/>
              </div>
              <div style={{fontWeight:800,fontSize:15,color:'var(--text)',marginBottom:6}}>{result.recorded} record{result.recorded!==1?'s':''} updated</div>
              {result.created > 0 && <div style={{fontSize:12.5,color:'var(--text-muted)'}}>{result.created} new external driver{result.created!==1?'s':''} created</div>}
              {result.failures?.length > 0 && (
                <>
                  <div style={{marginTop:12,textAlign:'left',fontSize:12,fontWeight:700,color:'#DC2626'}}>{result.failures.length} row{result.failures.length!==1?'s':''} failed — fix these and re-upload just those rows:</div>
                  <div style={{marginTop:6,textAlign:'left',maxHeight:220,overflowY:'auto',border:'1px solid var(--border)',borderRadius:10}}>
                    {result.failures.map((f,i)=>(
                      <div key={i} style={{padding:'7px 12px',fontSize:11.5,color:'#DC2626',borderTop:i>0?'1px solid var(--border)':'none'}}>
                        Row {f.row}{f.emp_id?` (${f.emp_id})`:''}: {f.reason}
                      </div>
                    ))}
                  </div>
                </>
              )}
              <button onClick={onSave} className="btn btn-primary" style={{marginTop:16}}>Done</button>
            </div>
          ) : (
            <>
              <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
                <button onClick={downloadTemplate} type="button"
                  style={{display:'flex',alignItems:'center',gap:6,padding:'9px 14px',borderRadius:10,border:'1px solid var(--border)',background:'var(--bg-alt)',color:'var(--text)',fontWeight:600,fontSize:12.5,cursor:'pointer',fontFamily:'inherit'}}>
                  <Download size={13}/> Download Template
                </button>
                <label style={{display:'flex',alignItems:'center',gap:6,padding:'9px 14px',borderRadius:10,border:'1px solid rgba(184,134,11,0.5)',background:'rgba(184,134,11,0.15)',color:'#B8860B',fontWeight:700,fontSize:12.5,cursor:'pointer'}}>
                  <UploadCloud size={13}/> Choose CSV File
                  <input type="file" accept=".csv" onChange={handleFile} style={{display:'none'}}/>
                </label>
                {fileName && <span style={{fontSize:11.5,color:'var(--text-muted)'}}>{fileName}</span>}
              </div>

              {rows.length > 0 && (
                <div style={{border:'1px solid var(--border)',borderRadius:12,overflow:'hidden'}}>
                  <div style={{padding:'9px 14px',background:'var(--bg-alt)',fontSize:11.5,fontWeight:700,color:'var(--text-muted)',display:'flex',justifyContent:'space-between'}}>
                    <span>{rows.length} row{rows.length!==1?'s':''} parsed</span>
                    <span style={{color:validRows.length===rows.length?'#22C55E':'#D97706'}}>{validRows.length} valid</span>
                  </div>
                  <div style={{maxHeight:220,overflowY:'auto'}}>
                    {rows.map((r,i)=>(
                      <div key={i} title={r.errors.join(', ')}
                        style={{display:'flex',gap:10,alignItems:'center',padding:'8px 14px',borderTop:'1px solid var(--border)',fontSize:12,background:r.errors.length?'#FEF2F2':'transparent'}}>
                        <span style={{width:26,color:'var(--text-muted)',flexShrink:0}}>#{r.row}</span>
                        <span style={{flex:1,minWidth:0,color:'var(--text)',fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.emp_id||r.name||'—'}</span>
                        <span style={{width:90,textAlign:'right',color:'var(--text)',flexShrink:0}}>{isStaff ? (isNaN(r.amount)?'—':`AED ${r.amount}`) : (isNaN(r.units)?'—':`${r.units} ${valueLabel}`)}</span>
                        {r.errors.length>0 && <AlertCircle size={12} color="#DC2626" style={{flexShrink:0}}/>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={handleUpload} disabled={uploading||!validRows.length}
                style={{padding:'13px',borderRadius:12,border:'none',cursor:(uploading||!validRows.length)?'not-allowed':'pointer',background:(uploading||!validRows.length)?'var(--border)':'linear-gradient(135deg,#B8860B,#D4A017)',color:(uploading||!validRows.length)?'var(--text-muted)':'white',fontWeight:700,fontSize:14,fontFamily:'Poppins,sans-serif',marginTop:4,transition:'all 0.2s'}}>
                {uploading?'Uploading…':validRows.length?`Upload ${validRows.length} Record${validRows.length!==1?'s':''}`:'Choose a file to continue'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

/* ── CSS ── */
const PAY_CSS = `
  @keyframes pySlide { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes pySpin  { to{transform:rotate(360deg)} }
  @keyframes pySk    { 0%,100%{opacity:.4} 50%{opacity:.8} }

  /* Header */
  .py-header      { display:flex; align-items:center; gap:14px; flex-wrap:wrap; }
  .py-header-icon { width:44px; height:44px; border-radius:12px; background:var(--gold-pale); border:1px solid var(--gold-border); display:flex; align-items:center; justify-content:center; color:var(--gold); flex-shrink:0; }
  .py-header-title { font-size:20px; font-weight:800; color:var(--text); margin:0; }
  .py-header-sub   { font-size:11.5px; color:var(--text-muted); margin-top:3px; }
  .py-month-sel  { margin-left:auto; padding:8px 14px; border-radius:20px; border:1.5px solid var(--border-med); background:var(--card); color:var(--text); font-size:13px; font-weight:600; cursor:pointer; outline:none; font-family:Poppins,sans-serif; }

  /* KPI cards */
  .py-kpi-cards    { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; }
  .py-kpi-card     { position:relative; overflow:hidden; background:var(--card); border:1px solid var(--border); border-radius:16px; box-shadow:var(--shadow); padding:18px 20px; transition:box-shadow var(--t-base),transform var(--t-base),border-color var(--t-base); }
  .py-kpi-card:hover { box-shadow:var(--shadow-md); transform:translateY(-3px); border-color:var(--border-strong); }
  .py-kpi-card::before { content:''; position:absolute; top:-40%; right:-30%; width:120px; height:120px; border-radius:50%; background:var(--kpi-glow,transparent); opacity:0.5; pointer-events:none; }
  .py-kpi-card-top { position:relative; display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
  .py-kpi-badge    { width:38px; height:38px; border-radius:50%; border:1px solid transparent; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .py-kpi-card-val { position:relative; font-size:24px; font-weight:900; letter-spacing:-0.02em; color:var(--text); line-height:1.15; }
  .py-kpi-card-label { position:relative; font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:var(--text-muted); margin-top:5px; }
  .py-kpi-card-sub { position:relative; font-size:11px; color:var(--text-muted); margin-top:2px; font-weight:600; }

  /* Charts */
  .py-charts { display:grid; grid-template-columns:1fr 1fr; gap:14px; }

  /* Toolbar */
  .py-toolbar { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
  .py-search-wrap { flex:1 1 180px; position:relative; }
  .py-search-icon { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--text-muted); pointer-events:none; }
  .py-search { width:100%; padding:8px 12px 8px 34px; border-radius:20px; border:1.5px solid var(--border); background:var(--card); color:var(--text); font-size:12.5px; font-family:Poppins,sans-serif; outline:none; box-sizing:border-box; transition:border-color var(--t-fast),box-shadow var(--t-fast); }
  .py-search:focus { border-color:var(--gold-border); box-shadow:0 0 0 3px var(--gold-pale); }
  .py-tbtn { display:flex; align-items:center; gap:5px; padding:8px 14px; border-radius:20px; font-size:12px; font-weight:600; cursor:pointer; font-family:Poppins,sans-serif; white-space:nowrap; transition:opacity 0.15s,transform 0.1s; }
  .py-tbtn:hover { opacity:0.82; transform:translateY(-1px); }
  .py-tbtn:active { opacity:0.7; transform:translateY(0) scale(0.96); }
  .py-tbtn-csv   { background:var(--card); border:1.5px solid var(--border); color:var(--text-muted); }
  .py-tbtn-slip  { background:rgba(29,111,164,0.1); border:1.5px solid rgba(29,111,164,0.3); color:#1D6FA4; }
  .py-tbtn-bonus { background:rgba(16,185,129,0.1); border:1.5px solid rgba(16,185,129,0.3); color:#10B981; }
  .py-tbtn-ded   { background:rgba(239,68,68,0.08); border:1.5px solid rgba(239,68,68,0.25); color:#EF4444; }
  .py-tbtn-all   { background:linear-gradient(135deg,#B8860B,#D4A017); border:none; color:white; box-shadow:var(--shadow-gold); }
  .py-tbtn-all:hover { box-shadow:var(--shadow-gold-lg); }

  /* Section header */
  .py-sec-hdr { display:flex; align-items:center; justify-content:space-between; padding:12px 0 8px; border-bottom:1.5px solid var(--border); margin-top:4px; }
  .py-sec-title { display:flex; align-items:center; gap:8px; font-size:11.5px; font-weight:800; color:var(--text); text-transform:uppercase; letter-spacing:0.07em; }
  .py-sec-count { background:rgba(184,134,11,0.12); color:#B8860B; border:1px solid rgba(184,134,11,0.25); border-radius:20px; padding:1px 9px; font-size:10px; font-weight:700; letter-spacing:0; text-transform:none; }
  .py-sec-mark { display:flex; align-items:center; gap:4px; padding:5px 12px; border-radius:20px; border:1px solid rgba(16,185,129,0.3); background:rgba(16,185,129,0.07); color:#10B981; font-size:11px; font-weight:700; cursor:pointer; font-family:Poppins,sans-serif; transition:opacity 0.15s; }
  .py-sec-mark:hover { opacity:0.8; }

  /* Employee row */
  .py-row { background:var(--card); border:1px solid var(--border); border-radius:14px; overflow:hidden; box-shadow:var(--shadow); transition:box-shadow var(--t-base),transform var(--t-base),border-color var(--t-base); animation:pySlide 0.35s ease both; }
  .py-row:hover { box-shadow:var(--shadow-md); transform:translateY(-2px); border-color:var(--border-strong); }
  .py-row-paid  { border-color:rgba(52,211,153,0.25); }
  .py-row-top   { height:3px; flex-shrink:0; }
  .py-row-paid  .py-row-top { background:linear-gradient(90deg,#34D399,#10B981); }
  .py-row-pend  .py-row-top { background:linear-gradient(90deg,#B8860B,#D4A017); }
  .py-row-inner { display:flex; align-items:center; gap:14px; padding:14px 18px; cursor:pointer; user-select:none; }
  .py-avatar { width:42px; height:42px; border-radius:50%; border:1.5px solid; display:flex; align-items:center; justify-content:center; font-size:12.5px; font-weight:900; flex-shrink:0; transition:transform var(--t-base); }
  .py-row:hover .py-avatar { transform:scale(1.06); }
  .py-info { flex:1; min-width:0; }
  .py-name-row { display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-bottom:4px; }
  .py-name { font-weight:700; font-size:13.5px; color:var(--text); letter-spacing:-0.01em; }
  .py-empid { font-size:10px; color:var(--text-muted); font-family:monospace; letter-spacing:0.03em; }

  /* Inline columns */
  .py-cols { display:flex; align-items:center; gap:26px; flex-shrink:0; }
  .py-col { text-align:right; min-width:78px; }
  .py-col-lbl { font-size:9.5px; font-weight:700; letter-spacing:0.07em; text-transform:uppercase; color:var(--text-muted); margin-bottom:3px; opacity:0.8; }
  .py-col-val { font-weight:700; font-size:13.5px; color:var(--text); letter-spacing:-0.02em; }
  .py-col-val-ded { color:#EF4444; }
  .py-col-net .py-col-val { font-weight:900; font-size:17px; color:#B8860B; letter-spacing:-0.03em; }
  .py-col-net .py-col-val.py-net-paid { color:#10B981; }

  /* Badges */
  .py-badge { font-size:9.5px; font-weight:700; border-radius:20px; padding:3px 9px; border:1px solid transparent; white-space:nowrap; letter-spacing:0.02em; }
  .py-badge-sta { color:#B8860B; background:rgba(184,134,11,0.1); border-color:rgba(184,134,11,0.18); }
  .py-badge-prj { color:#7C3AED; background:rgba(124,58,237,0.08); border-color:rgba(124,58,237,0.16); }
  .py-status { font-size:10.5px; font-weight:700; padding:3px 10px; border-radius:20px; white-space:nowrap; border:1px solid transparent; }
  .py-status-paid { color:#10B981; background:rgba(16,185,129,0.1); border-color:rgba(16,185,129,0.2); }
  .py-status-pend { color:#F59E0B; background:rgba(245,158,11,0.1); border-color:rgba(245,158,11,0.2); }
  .py-chevron { color:var(--text-muted); transition:transform 0.2s; flex-shrink:0; }
  .py-chevron-open { transform:rotate(180deg); }

  /* Expand/collapse */
  .py-expand-wrap { display:grid; grid-template-rows:0fr; transition:grid-template-rows var(--t-slow); }
  .py-expand-open { grid-template-rows:1fr; }
  .py-expand-inner { overflow:hidden; min-height:0; }
  .py-expanded { border-top:1px solid var(--border); }
  .py-actions { display:flex; align-items:center; gap:6px; padding:9px 14px; background:var(--bg-alt); flex-wrap:wrap; }
  .py-act { display:flex; align-items:center; gap:4px; padding:5px 11px; border-radius:8px; background:var(--card); border:1px solid var(--border); color:var(--text); font-size:11.5px; font-weight:600; cursor:pointer; font-family:Poppins,sans-serif; transition:opacity 0.15s; white-space:nowrap; }
  .py-act:hover { opacity:0.75; }
  .py-act-blue  { border-color:rgba(29,111,164,0.3); color:#1D6FA4; }
  .py-act-green { border-color:rgba(16,185,129,0.3); color:#10B981; }
  .py-spacer { flex:1; }
  .py-pay-btn { display:flex; align-items:center; gap:5px; padding:6px 14px; border-radius:8px; background:linear-gradient(135deg,#10B981,#22C55E); border:none; color:white; font-size:11.5px; font-weight:700; cursor:pointer; font-family:Poppins,sans-serif; white-space:nowrap; transition:opacity 0.15s; }
  .py-pay-btn:disabled { opacity:0.55; cursor:not-allowed; }
  .py-unpay-btn { display:flex; align-items:center; gap:5px; padding:6px 14px; border-radius:8px; background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.25); color:#EF4444; font-size:11.5px; font-weight:600; cursor:pointer; font-family:Poppins,sans-serif; white-space:nowrap; transition:opacity 0.15s; }
  .py-unpay-btn:hover { opacity:0.8; }

  /* Bonus / deduction items */
  .py-items { padding:9px 14px; border-top:1px solid rgba(0,0,0,0.04); }
  .py-items-lbl { font-size:8.5px; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; margin-bottom:7px; }
  .py-items-lbl-bon { color:#10B981; }
  .py-items-lbl-ded { color:#EF4444; }
  .py-item { display:flex; justify-content:space-between; align-items:center; padding:6px 10px; border-radius:8px; margin-bottom:5px; }
  .py-item-bon { background:rgba(16,185,129,0.05); border:1px solid rgba(16,185,129,0.12); }
  .py-item-ded { background:rgba(239,68,68,0.04); border:1px solid rgba(239,68,68,0.1); }
  .py-item-type { font-size:11.5px; font-weight:600; color:var(--text); }
  .py-item-desc { font-size:10.5px; color:var(--text-muted); }
  .py-item-ref  { font-size:9.5px; color:var(--text-muted); font-family:monospace; opacity:0.7; }
  .py-item-r { display:flex; align-items:center; gap:8px; flex-shrink:0; }
  .py-item-amt { font-size:12.5px; font-weight:800; }
  .py-item-amt-bon { color:#10B981; }
  .py-item-amt-ded { color:#EF4444; }
  .py-rm { width:20px; height:20px; border-radius:5px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.2); color:#EF4444; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:14px; line-height:1; flex-shrink:0; }

  /* Skeleton */
  .py-sk { animation:pySk 1.5s ease infinite; background:var(--card); border-radius:12px; }

  /* Spinner */
  .py-spin { display:inline-block; width:10px; height:10px; border:2px solid rgba(255,255,255,0.35); border-top-color:white; border-radius:50%; animation:pySpin 0.7s linear infinite; }

  /* Driver tabs */
  .py-driver-tabs { display:flex; align-items:center; gap:4px; padding:4px; background:var(--bg-alt); border:1px solid var(--border); border-radius:12px; margin-bottom:10px; flex-wrap:wrap; }
  .py-driver-tab { display:flex; align-items:center; gap:6px; padding:8px 14px; border-radius:9px; border:none; background:transparent; color:var(--text-muted); font-weight:700; font-size:12.5px; cursor:pointer; font-family:Poppins,sans-serif; transition:all 0.15s; }
  .py-driver-tab:hover:not(.active) { color:var(--text); }
  .py-driver-tab:active { transform:scale(0.96); }
  .py-driver-tab.active { background:var(--card); color:#B8860B; box-shadow:0 1px 4px rgba(0,0,0,0.08); }
  .py-driver-tab-count { font-size:10px; font-weight:700; background:rgba(0,0,0,0.06); color:inherit; border-radius:20px; padding:1px 7px; }
  .py-driver-tab.active .py-driver-tab-count { background:rgba(184,134,11,0.15); }
  .py-driver-tab-actions { margin-left:auto; display:flex; gap:6px; flex-wrap:wrap; }

  /* Pagination */
  .py-pagination { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:14px 4px 4px; margin-top:2px; flex-wrap:wrap; }
  .py-page-info { font-size:11.5px; color:var(--text-muted); font-weight:600; }
  .py-page-nums { display:flex; align-items:center; gap:4px; }
  .py-page-arrow { display:flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:8px; border:1.5px solid var(--border); background:var(--card); color:var(--text); cursor:pointer; transition:opacity var(--t-fast),transform var(--t-fast); }
  .py-page-arrow:disabled { opacity:0.35; cursor:not-allowed; }
  .py-page-arrow:not(:disabled):hover { opacity:0.75; }
  .py-page-arrow:not(:disabled):active { transform:scale(0.92); }
  .py-page-num { min-width:28px; height:28px; padding:0 6px; border-radius:8px; border:1.5px solid transparent; background:transparent; color:var(--text-muted); font-weight:700; font-size:12px; cursor:pointer; font-family:Poppins,sans-serif; transition:all var(--t-fast); }
  .py-page-num:hover { background:var(--bg-alt); color:var(--text); }
  .py-page-num:active { transform:scale(0.92); }
  .py-page-num.active { background:linear-gradient(135deg,#B8860B,#D4A017); border-color:transparent; color:white; box-shadow:var(--shadow-gold); }
  .py-page-dots { color:var(--text-muted); font-size:12px; padding:0 2px; }
  .py-page-size { padding:6px 10px; border-radius:8px; border:1.5px solid var(--border); background:var(--card); color:var(--text); font-weight:600; font-size:11.5px; cursor:pointer; font-family:Poppins,sans-serif; outline:none; }

  /* Responsive */
  @media(max-width:640px) {
    .py-kpi-cards { grid-template-columns:repeat(2,1fr); }
    .py-charts    { grid-template-columns:1fr; }
    .py-toolbar   { flex-direction:column; align-items:stretch; }
    .py-search-wrap { flex:none; }
    .py-cols { gap:0; }
    .py-col:not(.py-col-net) { display:none; }
  }
`

/* ── Payroll Card ── */
const PayrollCard = memo(function PayrollCard({slip, onMarkPaid, onMarkUnpaid, markingPaid, onEditSalary, onRemoveDed, onRemoveBonus, onEditEntry, onDeleteEntry, month, index, canPay, selectMode, selectedIds, onToggleSelect}) {
  const [open,      setOpen]      = useState(false)
  const [payMethod, setPayMethod] = useState('bank')
  const calc   = slip._calc
  const net    = calc.net
  const isPaid = slip.payroll_status === 'paid'
  const role   = resolveRole(slip.role, slip.project_type)
  const selected = !!(selectMode && selectedIds?.has(slip.id))
  const av = avatarStyle(slip.id||slip.name)

  return (
    <div className={`py-row ${isPaid ? 'py-row-paid' : 'py-row-pend'}`} style={{animationDelay:`${Math.min(index*0.03,0.4)}s`, background: selected ? 'rgba(220,38,38,0.05)' : undefined}}>
      <div className="py-row-top"/>
      <div className="py-row-inner" onClick={()=> selectMode ? onToggleSelect(slip.id) : setOpen(p=>!p)}>
        {selectMode && (
          <input type="checkbox" checked={selected} onChange={()=>onToggleSelect(slip.id)} onClick={e=>e.stopPropagation()}
            style={{width:16,height:16,flexShrink:0,cursor:'pointer',accentColor:'#DC2626'}}/>
        )}
        <div className="py-avatar" style={{background:av.bg,borderColor:av.bd,color:av.c}}>{slip.name?.slice(0,2).toUpperCase()}</div>
        <div className="py-info">
          <div className="py-name-row">
            <span className="py-name">{slip.name}</span>
            <span className="py-badge" style={{color:role.c,background:role.bg,borderColor:role.c+'33'}}>{role.l}</span>
            {slip.station_code && <span className="py-badge py-badge-sta">{slip.station_code}</span>}
            {slip.project_type && <span className="py-badge py-badge-prj">{slip.project_type.toUpperCase()}</span>}
          </div>
          <div className="py-empid">{slip.id}</div>
        </div>
        <div className="py-cols">
          <div className="py-col">
            <div className="py-col-lbl">Gross Pay</div>
            <div className="py-col-val">AED {fmt(calc.totalAdd)}</div>
          </div>
          <div className="py-col">
            <div className="py-col-lbl">Deductions</div>
            <div className="py-col-val py-col-val-ded">{calc.totalDed>0 ? `-AED ${fmt(calc.totalDed)}` : '—'}</div>
          </div>
          <div className="py-col py-col-net">
            <div className="py-col-lbl">Net Pay</div>
            <div className={`py-col-val${isPaid?' py-net-paid':''}`}>AED {fmt(net)}</div>
          </div>
          <span className={`py-status ${isPaid?'py-status-paid':'py-status-pend'}`}>{isPaid?'✓ Paid':'Pending'}</span>
          <ChevronDown size={12} className={`py-chevron${open?' py-chevron-open':''}`}/>
        </div>
      </div>

      <div className={`py-expand-wrap${open?' py-expand-open':''}`}>
        <div className="py-expand-inner">
        <div className="py-expanded">
          <div className="py-actions">
            {!calc.isExternal && !calc.isDaSplit && !calc.isPackerDaily && !calc.isPackerHourly && (
              <button onClick={()=>!isPaid&&onEditSalary(slip)} disabled={isPaid} className="py-act"
                style={isPaid?{opacity:0.55,cursor:'not-allowed'}:undefined}
                title={isPaid?'Mark unpaid first to edit':undefined}>
                <Wallet size={11}/> {calc.hasOverride ? 'Salary' : 'Base'}: AED {fmt(calc.base)}
              </button>
            )}
            {!calc.hasOverride && (
              <span className="py-act" style={{cursor:'default'}} title={`${calc.rateLabel}: AED ${calc.hourlyRate}`}>
                {calc.hoursLabel}: AED {fmt(calc.hoursEarnings)}
              </span>
            )}
            {calc.isCret && (
              <span className="py-act" style={{cursor:'default',color:'#7C3AED',borderColor:'rgba(124,58,237,0.3)'}}>
                Rate: AED {calc.hourlyRate}/shipment
              </span>
            )}
            {calc.pendingDeduction > 0 && (
              <span className="py-act" style={{cursor:'default',color:'#EF4444',borderColor:'rgba(239,68,68,0.3)'}} title="Balance owed before this month's deduction">
                Pending Ded: AED {fmt(calc.pendingDeduction)}
              </span>
            )}
            {/* Payment method selector + generate payslip */}
            <div style={{display:'flex',alignItems:'center',gap:0,border:'1px solid rgba(29,111,164,0.3)',borderRadius:8,overflow:'hidden',background:'rgba(29,111,164,0.05)'}}>
              <select value={payMethod} onChange={e=>setPayMethod(e.target.value)}
                style={{padding:'5px 6px',border:'none',background:'transparent',color:'#1D6FA4',fontWeight:700,fontSize:10.5,fontFamily:'Poppins,sans-serif',cursor:'pointer',outline:'none',appearance:'none',WebkitAppearance:'none'}}>
                <option value="bank">Bank</option>
                <option value="cash">Cash</option>
              </select>
              <div style={{width:1,height:20,background:'rgba(29,111,164,0.25)'}}/>
              <button onClick={()=>generatePayslip({...slip},month,payMethod)} className="py-act py-act-blue"
                style={{border:'none',borderRadius:0,background:'transparent'}}>
                <FileText size={11}/> Payslip
              </button>
            </div>
            <button onClick={()=>exportCSV(null,month,slip)} className="py-act py-act-green">
              <Download size={11}/> CSV
            </button>
            <div className="py-spacer"/>
            {canPay && (
              <button onClick={()=>!isPaid&&onEditEntry(slip)} disabled={isPaid} className="py-act py-act-blue"
                style={isPaid?{opacity:0.55,cursor:'not-allowed'}:undefined}
                title={isPaid?'Mark unpaid first to edit':undefined}>
                <Pencil size={11}/> Edit
              </button>
            )}
            {canPay && (
              <button onClick={()=>!isPaid&&onDeleteEntry(slip)} disabled={isPaid} className="py-act"
                style={{color:isPaid?'var(--text-muted)':'#EF4444', borderColor:isPaid?'var(--border)':'rgba(239,68,68,0.3)', opacity:isPaid?0.55:1, cursor:isPaid?'not-allowed':'pointer'}}
                title={isPaid?'Mark unpaid first to delete':'Remove from this month\'s payroll'}>
                <Trash2 size={11}/> Delete
              </button>
            )}
            {canPay && !isPaid && (
              <button onClick={()=>!markingPaid&&onMarkPaid(slip)} disabled={markingPaid} className="py-pay-btn">
                {markingPaid ? <><span className="py-spin"/> Saving…</> : <><Check size={11}/> Mark Paid</>}
              </button>
            )}
            {canPay && isPaid && (
              <button onClick={()=>onMarkUnpaid(slip)} className="py-unpay-btn">
                <Undo2 size={11}/> Mark Unpaid
              </button>
            )}
          </div>

          {slip.bonuses?.length > 0 && (
            <div className="py-items">
              <div className="py-items-lbl py-items-lbl-bon">Additions</div>
              {slip.bonuses.map(b=>(
                <div key={b.id} className="py-item py-item-bon">
                  <div>
                    <span className="py-item-type">{BON_TYPES.find(t=>t.v===b.type)?.l||b.type}</span>
                    {b.description&&<span className="py-item-desc"> · {b.description}</span>}
                  </div>
                  <div className="py-item-r">
                    <span className="py-item-amt py-item-amt-bon">+AED {fmt(b.amount)}</span>
                    <button onClick={()=>!isPaid&&onRemoveBonus(b.id,b.type)} disabled={isPaid} className="py-rm"
                      style={isPaid?{opacity:0.4,cursor:'not-allowed'}:undefined}
                      title={isPaid?'Mark unpaid first to remove':undefined}>×</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {slip.deductions?.length > 0 && (
            <div className="py-items">
              <div className="py-items-lbl py-items-lbl-ded">Deductions</div>
              {slip.deductions.map(d=>{
                const dt=DED_TYPES.find(t=>t.v===d.type)
                return (
                  <div key={d.id} className="py-item py-item-ded">
                    <div>
                      <span className="py-item-type" style={{color:dt?.c}}>{dt?.l||d.type}</span>
                      {d.description&&<span className="py-item-desc"> · {d.description}</span>}
                      {d.reference&&<span className="py-item-ref"> · Ref: {d.reference}</span>}
                    </div>
                    <div className="py-item-r">
                      <span className="py-item-amt py-item-amt-ded">-AED {fmt(d.amount)}</span>
                      <button onClick={()=>onRemoveDed(d.id,dt?.l||d.type)} className="py-rm">×</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  )
})

/* ── Section ── */
const PAGE_SIZE_OPTIONS = [10,25,50,100]

// Numbered page list with ellipsis markers for truncation, e.g. [1,2,'e2',9] → "1 2 … 9"
function buildPageList(current, total, boundary=1, siblings=1) {
  if (total <= boundary*2 + siblings*2 + 1) return Array.from({length:total},(_,i)=>i+1)
  const pages = new Set()
  for (let i=1; i<=boundary; i++) pages.add(i)
  for (let i=total-boundary+1; i<=total; i++) pages.add(i)
  for (let i=Math.max(1,current-siblings); i<=Math.min(total,current+siblings); i++) pages.add(i)
  const sorted = [...pages].sort((a,b)=>a-b)
  const out = []
  let prev = null
  for (const p of sorted) {
    if (prev !== null && p - prev > 1) out.push(`e${p}`)
    out.push(p)
    prev = p
  }
  return out
}

function Section({title, slips, onMarkAllPaid, selectMode, selectedIds, onToggleSelect, onEnterSelect, onExitSelect, onSelectAll, onClear, onBulkDelete, bulkDeleting, ...cardProps}) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  useEffect(() => { setPage(1) }, [slips])

  const unpaidCount   = slips.filter(s=>s.payroll_status!=='paid').length
  const totalPages    = Math.max(1, Math.ceil(slips.length / pageSize))
  const pageSlips      = slips.slice((page-1)*pageSize, page*pageSize)
  const selectedCount = selectedIds ? selectedIds.size : 0
  const rangeStart    = slips.length===0 ? 0 : (page-1)*pageSize+1
  const rangeEnd      = Math.min(page*pageSize, slips.length)
  const pageList      = buildPageList(page, totalPages)

  return (
    <>
      <div className="py-sec-hdr">
        <div className="py-sec-title">
          <Users size={13}/>
          {title}
          <span className="py-sec-count">{slips.length}</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          {cardProps.canPay && slips.length > 0 && (
            <button className="py-sec-mark"
              style={selectMode ? {color:'var(--text-muted)',background:'transparent',borderColor:'var(--border)'} : undefined}
              onClick={()=> selectMode ? onExitSelect() : onEnterSelect()}>
              {selectMode ? 'Cancel' : 'Select'}
            </button>
          )}
          {cardProps.canPay && unpaidCount > 0 && !selectMode && (
            <button className="py-sec-mark" onClick={()=>onMarkAllPaid(slips)}>
              <Check size={11}/> Mark All Paid ({unpaidCount})
            </button>
          )}
        </div>
      </div>
      {selectMode && (
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,padding:'10px 14px',background:'#FEF2F2',border:'1px solid #FCA5A5',borderRadius:10,marginTop:8,flexWrap:'wrap'}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <span style={{fontSize:12.5,fontWeight:700,color:'#DC2626'}}>{selectedCount} selected</span>
            {selectedCount < slips.length && (
              <button onClick={()=>onSelectAll(slips)} style={{fontSize:11.5,fontWeight:600,color:'var(--text-muted)',background:'none',border:'none',cursor:'pointer',textDecoration:'underline',padding:0}}>Select all {slips.length}</button>
            )}
            <button onClick={onClear} style={{fontSize:11.5,fontWeight:600,color:'var(--text-muted)',background:'none',border:'none',cursor:'pointer',textDecoration:'underline',padding:0}}>Clear</button>
          </div>
          <button onClick={onBulkDelete} disabled={!selectedCount||bulkDeleting}
            style={{display:'flex',alignItems:'center',gap:6,padding:'7px 14px',borderRadius:8,border:'none',background:selectedCount?'#DC2626':'var(--border)',color:'white',fontWeight:700,fontSize:12,cursor:selectedCount&&!bulkDeleting?'pointer':'not-allowed',fontFamily:'inherit'}}>
            <Trash2 size={12}/> {bulkDeleting?'Deleting…':`Delete${selectedCount?` ${selectedCount}`:''}`}
          </button>
        </div>
      )}
      <div style={{display:'flex',flexDirection:'column',gap:8,marginTop:8}}>
        {pageSlips.map((slip,i)=>(
          <PayrollCard key={slip.id||slip.emp_id} slip={slip} index={i}
            selectMode={selectMode} selectedIds={selectedIds} onToggleSelect={onToggleSelect} {...cardProps}/>
        ))}
      </div>
      {slips.length > 0 && (
        <div className="py-pagination">
          <span className="py-page-info">Showing {rangeStart} to {rangeEnd} of {slips.length} entries</span>
          <div className="py-page-nums">
            <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page<=1} className="py-page-arrow" aria-label="Previous page"><ChevronLeft size={14}/></button>
            {pageList.map(p => typeof p==='number'
              ? <button key={p} onClick={()=>setPage(p)} className={`py-page-num${p===page?' active':''}`}>{p}</button>
              : <span key={p} className="py-page-dots">…</span>)}
            <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page>=totalPages} className="py-page-arrow" aria-label="Next page"><ChevronRight size={14}/></button>
          </div>
          <select value={pageSize} onChange={e=>{setPageSize(Number(e.target.value)); setPage(1)}} className="py-page-size">
            {PAGE_SIZE_OPTIONS.map(n=><option key={n} value={n}>{n} / page</option>)}
          </select>
        </div>
      )}
    </>
  )
}

/* ── Main Page ── */
export default function PayrollPage() {
  const {user}    = useAuth()
  const canPay    = ['admin','accountant'].includes(user?.role)
  const canAddMod = ['admin','manager','general_manager','accountant'].includes(user?.role)

  const [payroll,     setPayroll]     = useState([])
  const [employees,   setEmployees]   = useState([])
  const [loading,     setLoading]     = useState(true)
  // Default to last month, not the current (still-in-progress) one — on the 4th of
  // August almost nobody has August pay entered yet, so opening straight into an
  // empty current month is more confusing than useful. Still fully selectable via
  // the dropdown, just not the default.
  const [month,       setMonth]       = useState(MONTHS[1])
  const [modal,       setModal]       = useState(null)
  const [search,      setSearch]      = useState('')
  const [confirmDlg,  setConfirmDlg]  = useState(null)
  const [markingPaid, setMarkingPaid] = useState(new Set())
  const [bulkMethod,  setBulkMethod]  = useState('bank')
  const [entrySelectMode,   setEntrySelectMode]   = useState(false)
  const [selectedEntryIds,  setSelectedEntryIds]  = useState(new Set())
  const [bulkEntryDeleting, setBulkEntryDeleting] = useState(false)
  const [ratesVersion, setRatesVersion] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [pr, emps] = await Promise.all([payrollApi.list({month}), empApi.list()])
      setPayroll(pr.payroll||[])
      setEmployees(emps.employees||[])
    } catch(e){ console.error(e) } finally { setLoading(false) }
  }, [month])

  useEffect(()=>{load()},[load])
  // Packer pay rates rarely change and aren't month-scoped, so this loads once — not
  // inside load() — and just bumps ratesVersion to make payrollCalc below recompute.
  useEffect(() => {
    payRatesApi.list().then(d => {
      for (const r of d.rates||[]) livePackerRates[r.key] = r.value
      setRatesVersion(v=>v+1)
    }).catch(()=>{})
  }, [])
  useSocket({'payroll:deduction_added':load,'payroll:bonus_added':load,'payroll:paid':load,'payroll:updated':load})

  function markPaidSlip(slip) {
    setConfirmDlg({
      title:`Mark ${slip.name} as paid?`,
      message:`This will record ${slip.name}'s salary for ${month} as paid.`,
      confirmLabel:'Mark Paid', danger:false,
      onConfirm:async()=>{
        setConfirmDlg(null)
        setMarkingPaid(s=>new Set(s).add(slip.id))
        try{await payrollApi.markPaid(slip.id,month);load()}catch(e){console.error(e)}
        finally{setMarkingPaid(s=>{const n=new Set(s);n.delete(slip.id);return n})}
      },
    })
  }
  function markUnpaidSlip(slip) {
    setConfirmDlg({
      title:`Mark ${slip.name} as unpaid?`,
      message:`This will revert ${slip.name}'s payment status for ${month} back to pending.`,
      confirmLabel:'Mark Unpaid', danger:true,
      onConfirm:async()=>{
        setConfirmDlg(null)
        try{await payrollApi.markUnpaid(slip.id,month);load()}catch(e){console.error(e)}
      },
    })
  }
  function markAllPaidInGroup(group) {
    const unpaid=group.filter(p=>p.payroll_status!=='paid')
    if (!unpaid.length) return
    setConfirmDlg({
      title:`Mark ${unpaid.length} employees as paid?`,
      message:`This will lock payslips for ${unpaid.length} employees for ${month}.`,
      confirmLabel:`Pay ${unpaid.length}`, danger:false,
      onConfirm:async()=>{
        setConfirmDlg(null)
        const ids=unpaid.map(s=>s.id)
        setMarkingPaid(new Set(ids))
        await Promise.all(unpaid.map(s=>payrollApi.markPaid(s.id,month)))
        setMarkingPaid(new Set())
        load()
      },
    })
  }
  function removeDed(id,label) {
    setConfirmDlg({
      title:'Remove deduction?', message:label?`Remove "${label}" deduction?`:'Remove this deduction?',
      confirmLabel:'Remove', danger:true,
      onConfirm:async()=>{setConfirmDlg(null);try{await payrollApi.removeDeduction(id);load()}catch(e){console.error(e)}},
    })
  }
  function removeBonus(id,label) {
    setConfirmDlg({
      title:'Remove bonus?', message:label?`Remove "${label}" addition?`:'Remove this bonus?',
      confirmLabel:'Remove', danger:true,
      onConfirm:async()=>{
        setConfirmDlg(null)
        try{await fetch(`${API}/api/payroll/bonuses/${id}`,{method:'DELETE',headers:{Authorization:`Bearer ${localStorage.getItem('gcd_token')}`}});load()}catch(e){console.error(e)}
      },
    })
  }
  function editEntry(slip) {
    setModal({type:'addUnits', projectType: isDriverRole(slip) ? (slip.project_type||'pulser') : 'staff', initialEmpId: slip.id})
  }
  function deleteEntry(slip) {
    setConfirmDlg({
      title:`Remove ${slip.name} from ${month} payroll?`,
      message:`This removes their payroll entry for ${month}. Bonuses/deductions added via the standalone buttons are not affected.`,
      confirmLabel:'Delete', danger:true,
      onConfirm:async()=>{
        setConfirmDlg(null)
        try{await payrollApi.deleteEntry(slip.id,month);load()}
        catch(e){alert(e.message)}
      },
    })
  }
  function toggleEntrySelect(id) {
    setSelectedEntryIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  function exitEntrySelectMode() { setEntrySelectMode(false); setSelectedEntryIds(new Set()) }
  function handleBulkDeleteEntries() {
    if (!selectedEntryIds.size) return
    const count = selectedEntryIds.size
    setConfirmDlg({
      title:`Remove ${count} ${count!==1?'entries':'entry'} from ${month} payroll?`,
      message:`Paid entries are skipped — mark them unpaid first if you need to remove those too.`,
      confirmLabel:'Delete', danger:true,
      onConfirm:async()=>{
        setConfirmDlg(null)
        setBulkEntryDeleting(true)
        try {
          const res = await payrollApi.deleteEntriesBulk([...selectedEntryIds], month)
          if (res.failures?.length) alert(`${res.deleted} removed, ${res.failures.length} skipped:\n`+res.failures.map(f=>`${f.emp_id}: ${f.reason}`).join('\n'))
        } catch(e) { alert(e.message) }
        finally { setBulkEntryDeleting(false); exitEntrySelectMode(); load() }
      },
    })
  }

  // Wire the real Pulser (hourly) / CRET (per-shipment) formula in everywhere —
  // slipData() was previously only used for the printable payslip.
  const payrollCalc = useMemo(() => payroll.map(s => ({ ...s, _calc: slipData(s, month) })), [payroll, month, ratesVersion])

  const filtered   = useMemo(() => payrollCalc.filter(s=>!search||s.name?.toLowerCase().includes(search.toLowerCase())||s.id?.toLowerCase().includes(search.toLowerCase())), [payrollCalc, search])
  // role is stored as 'Driver' (capitalized) — compare case-insensitively, or every
  // driver silently falls into Staff & Admins instead of the driver tabs below.
  const isDriverRole = s => (s.role||'').toLowerCase() === 'driver'
  const staffSlips     = useMemo(() => filtered.filter(s=>!isDriverRole(s)), [filtered])
  const driverSlips    = useMemo(() => filtered.filter(isDriverRole), [filtered])
  const pulserSlips    = useMemo(() => driverSlips.filter(s=>(s.project_type||'pulser').toLowerCase()==='pulser'), [driverSlips])
  const cretSlips      = useMemo(() => driverSlips.filter(s=>(s.project_type||'').toLowerCase()==='cret'), [driverSlips])
  // "External" covers ad-hoc external drivers AND the 4 client-project piece-work types
  // (JNT/iMile/Le Chocola/Creative Packers) — they don't get their own tabs, see
  // EXTERNAL_MERGED_TYPES above. Each row still carries and is paid on its own real
  // project_type; this only changes which tab groups them together.
  const externalSlips  = useMemo(() => driverSlips.filter(s=>{
    const t = (s.project_type||'').toLowerCase()
    return t==='external' || EXTERNAL_MERGED_TYPES.includes(t)
  }), [driverSlips])
  const tradelinkSlips = useMemo(() => driverSlips.filter(s=>(s.project_type||'').toLowerCase()==='tradelink'), [driverSlips])
  // The External tab merges 5 real project_types into one list (90+ people) with no
  // way to isolate just one — this pill row lets it be sorted/filtered down to a
  // single project. 'external' here is the literal project_type IG RAK employees
  // carry (they don't have a dedicated salary engine, unlike the other 4).
  const EXTERNAL_PROJECT_TYPES = [
    ['jnt_express','JNT'],['imile','iMile'],['creative_packers','Packers'],['le_chocola','Le Chocola'],['external','IG RAK'],
  ]
  const externalProjectCounts = useMemo(() => {
    const m = {}
    for (const s of externalSlips) { const t=(s.project_type||'').toLowerCase(); m[t]=(m[t]||0)+1 }
    return m
  }, [externalSlips])
  const [extProjectFilter, setExtProjectFilter] = useState('all')
  const externalSlipsFiltered = useMemo(() =>
    extProjectFilter==='all' ? externalSlips : externalSlips.filter(s=>(s.project_type||'').toLowerCase()===extProjectFilter),
    [externalSlips, extProjectFilter])
  const [payTab, setPayTab] = useState('staff')
  const ALL_PAY_TABS = [
    ['staff','Staff & Admins',staffSlips.length],['pulser','Pulser',pulserSlips.length],['cret','CRET',cretSlips.length],
    ['tradelink','Tradelink',tradelinkSlips.length],['external','External',externalSlips.length],
  ]
  // A project-scoped manager (e.g. Asma) only manages her own client-project workers —
  // same restriction already applied to the DAs list and Overview pages. The backend
  // GET /api/payroll already scopes the underlying data; this just declutters her tab
  // bar down to the ones that can ever have anyone in them. Her assigned_projects hold
  // the specific project_type values (e.g. 'jnt_express'), not the literal 'external'
  // tab value they're grouped under, so External is granted separately when any of
  // those match.
  const isProjectScoped = Array.isArray(user?.assigned_projects) && user.assigned_projects.length > 0
  const PAY_TABS = isProjectScoped
    ? ALL_PAY_TABS.filter(([v]) => user.assigned_projects.includes(v)
        || (v === 'external' && user.assigned_projects.some(p => EXTERNAL_MERGED_TYPES.includes(p))))
    : ALL_PAY_TABS
  const TAB_SLIPS = { staff:staffSlips, pulser:pulserSlips, cret:cretSlips, tradelink:tradelinkSlips, external:externalSlipsFiltered }
  const activeTabSlips = TAB_SLIPS[payTab] || staffSlips
  // payTab can briefly point at a tab PAY_TABS just filtered out (e.g. a scoped
  // manager's first render, before the effect below corrects it) — .find() would
  // then return undefined and crash on [1] wherever the label is read.
  const currentTabLabel = PAY_TABS.find(([v])=>v===payTab)?.[1] || PROJECT_TYPE_LABELS[payTab] || payTab
  const currentSectionLabel = payTab==='external' && extProjectFilter!=='all'
    ? (EXTERNAL_PROJECT_TYPES.find(([t])=>t===extProjectFilter)?.[1] || currentTabLabel)
    : currentTabLabel

  // Land a scoped manager on one of her own tabs instead of the default "Staff &
  // Admins" (which she'd never have anyone in, or may not even be allowed to open).
  useEffect(() => {
    if (isProjectScoped && PAY_TABS.length && !PAY_TABS.some(([v]) => v === payTab)) {
      setPayTab(PAY_TABS[0][0])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProjectScoped, PAY_TABS.map(([v]) => v).join(',')])

  const totalEarned = payrollCalc.reduce((s,p)=>s+p._calc.base+p._calc.hoursEarnings,0)
  const totalBonus  = payrollCalc.reduce((s,p)=>s+(p._calc.totalAdd-p._calc.base-p._calc.hoursEarnings),0)
  const totalDed    = payrollCalc.reduce((s,p)=>s+p._calc.totalDed,0)
  const totalNet    = payrollCalc.reduce((s,p)=>s+p._calc.net,0)
  const paidCount   = payroll.filter(p=>p.payroll_status==='paid').length
  const paidNet     = payrollCalc.filter(p=>p.payroll_status==='paid').reduce((s,p)=>s+p._calc.net,0)
  const pendingNet    = totalNet - paidNet
  const pendingCount  = payroll.length - paidCount
  const KPI_DEFS = [
    {key:'total',   label:'Total Payroll',     value:fmt(totalNet),    sub:null,                        Icon:Wallet,        color:'var(--gold)',  bg:'var(--gold-pale)',  border:'var(--gold-border)'},
    {key:'paid',    label:'Total Paid',        value:fmt(paidNet),     sub:`${paidCount} employees`,     Icon:CheckCircle2,  color:'var(--green)', bg:'var(--green-bg)',   border:'var(--green-border)'},
    {key:'pending', label:'Pending',           value:fmt(pendingNet),  sub:`${pendingCount} employees`,  Icon:Clock,         color:'var(--amber)', bg:'var(--amber-bg)',   border:'var(--amber-border)'},
    {key:'ded',     label:'Total Deductions',  value:fmt(totalDed),    sub:'This Month',                 Icon:TrendingDown,  color:'var(--red)',   bg:'var(--red-bg)',     border:'var(--red-border)'},
  ]

  // Amazon (Pulser+CRET) vs External (the merged External tab) payroll split — reuses
  // the tab-level filters already memoized above instead of re-scanning all 180 rows,
  // and reduces each group in one pass over just its own (much smaller) slice.
  const amazonExternal = useMemo(() => {
    const agg = slips => slips.reduce((a,s) => {
      a.earned += s._calc.base+s._calc.hoursEarnings
      a.bonus  += s._calc.totalAdd-s._calc.base-s._calc.hoursEarnings
      a.ded    += s._calc.totalDed
      a.net    += s._calc.net
      a.paid   += s.payroll_status==='paid' ? 1 : 0
      a.count++
      return a
    }, {earned:0,bonus:0,ded:0,net:0,paid:0,count:0})
    const amazon = agg([...pulserSlips, ...cretSlips])
    const external = agg(externalSlips)
    const totalAbsNet = Math.abs(amazon.net)+Math.abs(external.net)
    return {amazon, external, amazonPct: totalAbsNet ? Math.round(Math.abs(amazon.net)/totalAbsNet*100) : 50}
  }, [pulserSlips, cretSlips, externalSlips])
  const pieData = [{name:'Earned',value:totalEarned,color:'#B8860B'},{name:'Bonus',value:totalBonus,color:'#10B981'},{name:'Deductions',value:totalDed,color:'#EF4444'}].filter(d=>d.value>0)

  const cardProps = {month, onMarkPaid:markPaidSlip, onMarkUnpaid:markUnpaidSlip, onEditSalary:s=>setModal({type:'salary',emp:s}), onRemoveDed:removeDed, onRemoveBonus:removeBonus, onEditEntry:editEntry, onDeleteEntry:deleteEntry, canPay}

  // Selection is scoped to whichever tab/month is on screen — switching either clears it.
  useEffect(() => { exitEntrySelectMode() }, [payTab, month])
  // The project pill-filter only applies within the External tab — leaving it set
  // while on another tab (or a different month, where the mix of projects present
  // may differ) would silently hide rows the next time External is revisited.
  useEffect(() => { setExtProjectFilter('all') }, [payTab, month])

  return (
    <>
      <style>{PAY_CSS}</style>
      <div style={{display:'flex',flexDirection:'column',gap:16}}>

        {/* Header */}
        <div className="py-header">
          <div className="py-header-icon"><Wallet size={20}/></div>
          <div>
            <div className="py-header-title">Payroll</div>
            <div className="py-header-sub">{payroll.length} employees · {paidCount} paid · v{APP_VERSION}</div>
          </div>
          <select value={month} onChange={e=>setMonth(e.target.value)} className="py-month-sel">
            {MONTHS.map(m=><option key={m}>{m}</option>)}
          </select>
        </div>

        {/* KPI cards */}
        <div className="py-kpi-cards">
          {KPI_DEFS.map((k,i)=>(
            <div key={k.key} className={i<3?`py-kpi-card fade-up-${i+1}`:'py-kpi-card fade-up'} style={{'--kpi-glow':k.bg, ...(i===3?{animationDelay:'0.16s'}:{})}}>
              <div className="py-kpi-card-top">
                <div className="py-kpi-badge" style={{color:k.color,background:k.bg,borderColor:k.border}}><k.Icon size={16}/></div>
                <KpiSpark color={k.color}/>
              </div>
              {loading
                ? <div className="sk" style={{height:23,width:'55%',borderRadius:6,marginBottom:2}}/>
                : <div key={k.value} className="py-kpi-card-val kpi-val">AED {k.value}</div>}
              <div className="py-kpi-card-label">{k.label}</div>
              {k.sub && <div className="py-kpi-card-sub">{k.sub}</div>}
            </div>
          ))}
        </div>

        {/* Charts — only after data loads */}
        {!loading && payroll.length > 0 && (
          <div className="py-charts">
            <div className="card" style={{padding:'16px'}}>
              <div style={{fontWeight:700,fontSize:13,color:'var(--text)',marginBottom:12}}>Amazon vs External</div>
              <div style={{display:'flex',height:9,borderRadius:6,overflow:'hidden',marginBottom:16,background:'var(--bg-alt)'}}>
                <div style={{width:`${amazonExternal.amazonPct}%`,background:'#3B82F6',transition:'width 0.3s ease'}}/>
                <div style={{width:`${100-amazonExternal.amazonPct}%`,background:'#7C3AED',transition:'width 0.3s ease'}}/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                {[
                  {label:'Amazon', sub:'Pulser + CRET', color:'#3B82F6', d:amazonExternal.amazon},
                  {label:'External', sub:'JNT / iMile / Packers / IG RAK', color:'#7C3AED', d:amazonExternal.external},
                ].map(g=>(
                  <div key={g.label}>
                    <div style={{display:'flex',alignItems:'center',gap:6}}>
                      <span style={{width:8,height:8,borderRadius:2,background:g.color,flexShrink:0}}/>
                      <span style={{fontSize:11.5,fontWeight:700,color:'var(--text)'}}>{g.label}</span>
                      <span style={{fontSize:10,color:'var(--text-muted)'}}>({g.d.count})</span>
                    </div>
                    <div style={{fontSize:18,fontWeight:800,color:'var(--text)',marginTop:4,letterSpacing:'-0.02em'}}>AED {fmt(g.d.net)}</div>
                    <div style={{fontSize:10.5,color:'var(--text-muted)',marginTop:2}}>Net · {g.d.paid}/{g.d.count} paid</div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:8,fontSize:10.5}}>
                      <span style={{color:'var(--text-muted)'}}>{fmt(g.d.earned)} earned</span>
                      <span style={{color:'#10B981'}}>+{fmt(g.d.bonus)}</span>
                      <span style={{color:'#EF4444'}}>-{fmt(g.d.ded)}</span>
                    </div>
                    <div style={{fontSize:9.5,color:'var(--text-muted)',marginTop:6,opacity:0.7}}>{g.sub}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card" style={{padding:'16px'}}>
              <div style={{fontWeight:700,fontSize:13,color:'var(--text)',marginBottom:12}}>Payroll Distribution</div>
              <div style={{display:'flex',alignItems:'center',gap:16}}>
                <PieChart width={120} height={120}>
                  <Pie data={pieData} cx={56} cy={56} innerRadius={30} outerRadius={52} paddingAngle={3} dataKey="value">
                    {pieData.map((p,i)=><Cell key={p.name} fill={p.color}/>)}
                  </Pie>
                  <Tooltip content={<GlassTip/>}/>
                </PieChart>
                <div style={{flex:1,display:'flex',flexDirection:'column',gap:9}}>
                  {pieData.map(p=>(
                    <div key={p.name}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                        <span style={{fontSize:11,color:'var(--text-muted)',display:'flex',alignItems:'center',gap:5}}>
                          <span style={{width:7,height:7,borderRadius:2,background:p.color,display:'inline-block'}}/>{p.name}
                        </span>
                        <span style={{fontSize:11,fontWeight:700,color:p.color}}>AED {fmt(p.value)}</span>
                      </div>
                      <div style={{height:4,background:'rgba(0,0,0,0.06)',borderRadius:10,overflow:'hidden'}}>
                        <div style={{height:'100%',width:`${totalNet>0?Math.round(p.value/totalNet*100):0}%`,background:p.color,borderRadius:10}}/>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="py-toolbar">
          <div className="py-search-wrap">
            <Search size={13} className="py-search-icon"/>
            <input className="py-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search employee…"/>
          </div>
          <button onClick={()=>exportCSV(payroll,month)} className="py-tbtn py-tbtn-csv"><Download size={13}/> Export CSV</button>
          <div style={{display:'flex',border:'1px solid rgba(109,60,219,0.3)',borderRadius:8,overflow:'hidden'}}>
            <select value={bulkMethod} onChange={e=>setBulkMethod(e.target.value)}
              style={{padding:'0 8px',fontSize:11,fontWeight:600,border:'none',borderRight:'1px solid rgba(109,60,219,0.3)',background:'rgba(109,60,219,0.06)',color:'#6D3CDB',cursor:'pointer',fontFamily:'Poppins,sans-serif',outline:'none'}}>
              <option value="bank">Bank</option>
              <option value="cash">Cash</option>
            </select>
            <button onClick={()=>generateAllPayslips(filtered,month,bulkMethod)} className="py-tbtn py-tbtn-slip" style={{borderRadius:0,border:'none'}}><FileText size={13}/> All Payslips</button>
          </div>
          {canAddMod && <>
            <button onClick={()=>setModal('bonus')} className="py-tbtn py-tbtn-bonus"><Plus size={13}/> Bonus</button>
            <button onClick={()=>setModal('deduction')} className="py-tbtn py-tbtn-ded"><Plus size={13}/> Deduction</button>
          </>}
          {canPay && <button onClick={()=>markAllPaidInGroup(filtered)} className="py-tbtn py-tbtn-all"><Check size={13}/> Mark All Paid</button>}
        </div>

        {/* Employee lists */}
        {loading ? (
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {Array(5).fill(0).map((_,i)=><div key={i} className="py-sk" style={{height:78,opacity:1-i*0.12}}/>)}
          </div>
        ) : (
          <div>
            {/* Everyone — staff/admins and drivers alike — is tabbed and hidden until pay
                is explicitly added for the month. Tabs + Add buttons always render here
                (even with zero entries this month) since they're how anyone gets added. */}
            <div className="py-driver-tabs">
              {PAY_TABS.map(([v,l,c])=>(
                <button key={v} onClick={()=>setPayTab(v)} className={`py-driver-tab${payTab===v?' active':''}`}>
                  {l} <span className="py-driver-tab-count">{c}</span>
                </button>
              ))}
              {canAddMod && (
                <div className="py-driver-tab-actions">
                  <button onClick={()=>setModal({type:'addUnits',projectType:payTab})} className="py-tbtn py-tbtn-bonus" style={{padding:'6px 12px'}}>
                    <Plus size={12}/> Add Manually
                  </button>
                  <button onClick={()=>setModal({type:'bulkUnits',projectType:payTab})} className="py-tbtn py-tbtn-csv" style={{padding:'6px 12px'}}>
                    <UploadCloud size={12}/> Bulk Upload
                  </button>
                  {payTab==='external' && user?.role==='admin' && (
                    <Link href="/dashboard/finance/payroll/jnt-rates" className="py-tbtn py-tbtn-bonus" style={{padding:'6px 12px',textDecoration:'none'}}>
                      <Settings2 size={12}/> Rate Settings
                    </Link>
                  )}
                </div>
              )}
            </div>
            {payTab==='external' && EXTERNAL_PROJECT_TYPES.filter(([t])=>externalProjectCounts[t]>0).length > 1 && (
              <div className="py-driver-tabs" style={{marginTop:-4}}>
                <button onClick={()=>setExtProjectFilter('all')} className={`py-driver-tab${extProjectFilter==='all'?' active':''}`}>
                  All <span className="py-driver-tab-count">{externalSlips.length}</span>
                </button>
                {EXTERNAL_PROJECT_TYPES.filter(([t])=>externalProjectCounts[t]>0).map(([t,l])=>(
                  <button key={t} onClick={()=>setExtProjectFilter(t)} className={`py-driver-tab${extProjectFilter===t?' active':''}`}>
                    {l} <span className="py-driver-tab-count">{externalProjectCounts[t]}</span>
                  </button>
                ))}
              </div>
            )}
            {activeTabSlips.length > 0 ? (
              <Section title={currentSectionLabel}
                slips={activeTabSlips} onMarkAllPaid={markAllPaidInGroup} {...cardProps}
                markingPaid={(id)=>markingPaid.has(id)}
                selectMode={entrySelectMode} selectedIds={selectedEntryIds} onToggleSelect={toggleEntrySelect}
                onEnterSelect={()=>setEntrySelectMode(true)} onExitSelect={exitEntrySelectMode}
                onSelectAll={(slips)=>setSelectedEntryIds(new Set(slips.map(s=>s.id)))}
                onClear={()=>setSelectedEntryIds(new Set())}
                onBulkDelete={handleBulkDeleteEntries} bulkDeleting={bulkEntryDeleting}/>
            ) : (
              <div style={{textAlign:'center',padding:'40px 20px',color:'var(--text-muted)',background:'var(--card)',border:'1px solid var(--border)',borderRadius:12}}>
                <Wallet size={28} style={{margin:'0 auto 10px',display:'block',opacity:0.2}}/>
                <div style={{fontWeight:700,fontSize:13,color:'var(--text)',marginBottom:4}}>No {currentTabLabel} entries for {month}</div>
                <div style={{fontSize:12}}>Use Add Manually or Bulk Upload to add {payTab==='staff'||payTab==='tradelink'?'salary':payTab==='pulser'?'hours worked':payTab==='external'?'their pay':'shipments'} — nobody appears here until their pay is entered.</div>
              </div>
            )}
          </div>
        )}

        {modal==='bonus'        && <BonusModal     employees={employees} month={month} onClose={()=>setModal(null)} onSave={()=>{setModal(null);load()}}/>}
        {modal==='deduction'    && <DeductionModal employees={employees} month={month} onClose={()=>setModal(null)} onSave={()=>{setModal(null);load()}}/>}
        {modal?.type==='salary' && <SalaryModal    emp={modal.emp}       onClose={()=>setModal(null)} onSave={()=>{setModal(null);load()}}/>}
        {modal?.type==='addUnits' && <AddUnitsModal employees={employees} month={month} projectType={modal.projectType} initialEmpId={modal.initialEmpId} onClose={()=>setModal(null)} onSave={()=>{setModal(null);load()}}/>}
        {modal?.type==='bulkUnits' && <BulkUnitsModal month={month} projectType={modal.projectType} employees={employees} onClose={()=>setModal(null)} onSave={()=>{setModal(null);load()}}/>}

        <ConfirmDialog
          open={!!confirmDlg}
          title={confirmDlg?.title}
          message={confirmDlg?.message}
          confirmLabel={confirmDlg?.confirmLabel}
          danger={confirmDlg?.danger??false}
          onConfirm={confirmDlg?.onConfirm}
          onCancel={()=>setConfirmDlg(null)}
        />
      </div>
    </>
  )
}