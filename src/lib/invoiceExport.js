// Sale / Purchase invoice export to a real .xlsx workbook (numbers stay numbers, so
// the accountant can sum/filter in Excel). exceljs is ~1MB, so it's loaded only when
// someone actually clicks Export, not with the page.
//
// Invoices have no type of their own — sale vs purchase comes from the customer's
// customer_type (returned by GET /api/customer-invoices). A 'both' customer's invoices
// can't be told apart, so they land on a separate "Sale or Purchase" sheet rather than
// being guessed into one of the two.

const KINDS = {
  sale:     { sheet:'Sale Invoices',     title:'Sale Invoices',     types:['sale_invoice'] },
  purchase: { sheet:'Purchase Invoices', title:'Purchase Invoices', types:['purchase_invoice'] },
  unknown:  { sheet:'Sale or Purchase',  title:'Invoices (customer type "Both")', types:['both'] },
}

const COLUMNS = [
  { header:'SNO',            key:'sno',      width:6  },
  { header:'Invoice Date',   key:'date',     width:13, numFmt:'dd/mm/yyyy' },
  { header:'Invoice No',     key:'no',       width:26 },
  { header:'Customer Name',  key:'customer', width:40 },
  { header:'Customer TRN',   key:'trn',      width:18 },
  { header:'Cost Center',    key:'cost',     width:14 },
  { header:'Description',    key:'desc',     width:44 },
  { header:'Invoice Amount', key:'amount',   width:16, numFmt:'#,##0.00', money:true },
  { header:'VAT',            key:'vat',      width:13, numFmt:'#,##0.00', money:true },
  { header:'Grand Total',    key:'total',    width:16, numFmt:'#,##0.00', money:true },
]

function monthTitle(key) {
  const [y, m] = key.split('-')
  return new Date(+y, +m - 1).toLocaleDateString('en-US', { month:'long', year:'numeric' })
}

// 'YYYY-MM-DD' → a Date at UTC midnight, so Excel shows the same calendar day everywhere
function toDate(d) {
  const s = String(d || '').slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00Z`) : null
}

function addSheet(wb, kind, rows, month) {
  const meta = KINDS[kind]
  const ws = wb.addWorksheet(meta.sheet, { views:[{ state:'frozen', ySplit:3 }] })
  ws.columns = COLUMNS.map(c => ({ key:c.key, width:c.width }))

  ws.mergeCells(1, 1, 1, COLUMNS.length)
  ws.getCell(1, 1).value = `${meta.title} — ${monthTitle(month)}`
  ws.getCell(1, 1).font = { bold:true, size:14 }
  ws.getRow(2).height = 6

  const head = ws.getRow(3)
  COLUMNS.forEach((c, i) => {
    const cell = head.getCell(i + 1)
    cell.value = c.header
    cell.font = { bold:true, color:{ argb:'FFFFFFFF' } }
    cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF1F6F5C' } }
    cell.alignment = { vertical:'middle', horizontal: c.money ? 'right' : 'left' }
  })
  head.height = 20

  const sorted = [...rows].sort((a, b) =>
    String(a.invoice_date).localeCompare(String(b.invoice_date)) || String(a.invoice_no || '').localeCompare(String(b.invoice_no || '')))
  sorted.forEach((r, i) => {
    ws.addRow({
      sno: i + 1, date: toDate(r.invoice_date), no: r.invoice_no || '', customer: r.customer_name || '',
      trn: r.customer_trn || '', cost: r.cost_center || '', desc: r.description || '',
      amount: Number(r.invoice_amount || 0), vat: Number(r.vat || 0), total: Number(r.grand_total || 0),
    })
  })

  const first = 4, last = 3 + sorted.length
  const totals = ws.addRow({ desc: `Total (${sorted.length} invoice${sorted.length === 1 ? '' : 's'})` })
  for (const key of ['amount', 'vat', 'total']) {
    const col = COLUMNS.findIndex(c => c.key === key) + 1
    const letter = ws.getColumn(col).letter
    const sum = sorted.reduce((s, r) => s + Number(r[{ amount:'invoice_amount', vat:'vat', total:'grand_total' }[key]] || 0), 0)
    // Formula so edits in Excel re-total; result cached so it shows before recalculation
    totals.getCell(col).value = sorted.length ? { formula:`SUM(${letter}${first}:${letter}${last})`, result: Math.round(sum * 100) / 100 } : 0
  }
  totals.font = { bold:true }
  totals.eachCell({ includeEmpty:true }, cell => { cell.border = { top:{ style:'thin' } } })

  COLUMNS.forEach((c, i) => {
    if (c.numFmt) ws.getColumn(i + 1).numFmt = c.numFmt
    if (c.key === 'desc' || c.key === 'customer') ws.getColumn(i + 1).alignment = { wrapText:true, vertical:'top' }
  })
  ws.autoFilter = { from:{ row:3, column:1 }, to:{ row:3, column:COLUMNS.length } }
}

// invoices: rows from GET /api/customer-invoices; month: 'YYYY-MM';
// kinds: subset of ['sale','purchase'] — one sheet each (plus a 'both'-customer sheet
// when such invoices exist for the month, so nothing silently goes missing).
export async function exportInvoicesXlsx(invoices, month, kinds) {
  const { default: ExcelJS } = await import('exceljs')
  const inMonth = invoices.filter(i => String(i.invoice_date || '').slice(0, 7) === month)
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Golden Crescent Operations'
  wb.created = new Date()

  const counts = {}
  const sheets = [...kinds, 'unknown']
  for (const kind of sheets) {
    const rows = inMonth.filter(i => KINDS[kind].types.includes(i.customer_type))
    counts[kind] = rows.length
    if (kind === 'unknown' && !rows.length) continue
    addSheet(wb, kind, rows, month)
  }

  const buf = await wb.xlsx.writeBuffer()
  const name = kinds.length === 1 ? KINDS[kinds[0]].title.replace(/\s+/g, '_') : 'Sale_and_Purchase_Invoices'
  const url = URL.createObjectURL(new Blob([buf], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a')
  a.href = url; a.download = `${name}_${month}.xlsx`
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return counts
}
