'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/lib/auth'
import { customerApi, customerInvoiceApi, customerReceiptApi, customerLedgerApi } from '@/lib/api'
import {
  Building2, Plus, Search, Pencil, Trash2, X, ChevronLeft,
  Hash, MapPin, FileText, DollarSign, Tag, Receipt,
  RefreshCw, AlertCircle, FileSpreadsheet, ArrowDownLeft,
  TrendingUp, TrendingDown, CheckCircle2, BookOpen, Printer,
} from 'lucide-react'

const TYPE_META = {
  sale_invoice:     { label:'Sale Invoice',     bg:'#EFF6FF', border:'#BFDBFE', color:'#1D4ED8' },
  purchase_invoice: { label:'Purchase Invoice', bg:'#F5F3FF', border:'#DDD6FE', color:'#6D28D9' },
  both:             { label:'Both',             bg:'#FFFBEB', border:'#FDE68A', color:'#92400E' },
}

const EMPTY_FORM = {
  name:'', address:'', trn_no:'', opening_balance:'',
  customer_type:'sale_invoice', cost_center:'',
  ncod_rate:'', cod_rate:'', rp_rate:'', pickup_rate:'',
  ncod_inv_rate:'', cod_inv_rate:'', rp_inv_rate:'', pickup_inv_rate:'',
  notes:'',
}

function fmtAed(n) {
  const v = parseFloat(n)
  return isNaN(v) ? 'AED 0.00' : `AED ${v.toLocaleString('en-AE', { minimumFractionDigits:2, maximumFractionDigits:2 })}`
}
function fmtNum(n) {
  const v = parseFloat(n)
  return isNaN(v) ? null : v.toLocaleString('en-AE', { minimumFractionDigits:2, maximumFractionDigits:2 })
}
function initials(name) {
  return (name || '?').split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase()
}

/* ─────────────────────────────────────────── CSS ─────────────────────────── */
const CSS = `
  .cust-hero {
    background: linear-gradient(135deg, #0f1623 0%, #1a2535 50%, #1e3a5f 100%);
    border-radius: 16px; padding: 24px; margin-bottom: 20px;
  }
  .cust-hero-top { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; flex-wrap: wrap; }
  .cust-hero-icon {
    width: 44px; height: 44px; border-radius: 12px;
    background: rgba(184,134,11,0.15); border: 1px solid rgba(184,134,11,0.3);
    display: flex; align-items: center; justify-content: center; color: #B8860B; flex-shrink: 0;
  }
  .cust-hero-title { font-size: 20px; font-weight: 800; color: white; margin: 0; }
  .cust-hero-sub   { font-size: 12px; color: rgba(255,255,255,0.5); margin: 3px 0 0; }
  .cust-add-btn {
    margin-left: auto; display: flex; align-items: center; gap: 7px;
    padding: 10px 20px; border-radius: 10px; border: none;
    background: #B8860B; color: white; font-weight: 700; font-size: 13px;
    cursor: pointer; font-family: Poppins, sans-serif; white-space: nowrap; transition: background 0.15s;
  }
  .cust-add-btn:hover { background: #9a7209; }
  .cust-kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  .cust-kpi {
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px; padding: 14px 16px;
  }
  .cust-kpi-val   { font-size: 26px; font-weight: 800; line-height: 1.1; }
  .cust-kpi-label { font-size: 10px; color: rgba(255,255,255,0.45); font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 4px; }

  .cust-toolbar { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; align-items: center; }
  .cust-search-wrap {
    display: flex; align-items: center; gap: 8px; flex: 1; min-width: 200px;
    background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 0 12px;
  }
  .cust-search-input {
    flex: 1; border: none; outline: none; background: transparent; color: var(--text);
    font-family: Poppins, sans-serif; font-size: 13px; padding: 9px 0;
  }
  .cust-filter-sel {
    padding: 9px 14px; border-radius: 10px; border: 1px solid var(--border);
    background: var(--card); color: var(--text); font-family: Poppins, sans-serif;
    font-size: 13px; outline: none; cursor: pointer;
  }

  .cust-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
  .cust-card {
    background: var(--card); border: 1px solid var(--border); border-radius: 14px;
    overflow: hidden; display: flex; flex-direction: column; transition: box-shadow 0.15s, transform 0.15s;
  }
  .cust-card:hover { box-shadow: 0 6px 28px rgba(0,0,0,0.10); transform: translateY(-2px); }
  .cust-card-header { display: flex; align-items: center; gap: 12px; padding: 16px 16px 12px; border-bottom: 1px solid var(--border); }
  .cust-avatar {
    width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
    background: linear-gradient(135deg, #B8860B, #D4A017);
    display: flex; align-items: center; justify-content: center;
    font-weight: 800; font-size: 15px; color: white; letter-spacing: 0.03em;
  }
  .cust-name  { font-size: 14px; font-weight: 700; color: var(--text); line-height: 1.3; }
  .cust-trn   { font-size: 11px; color: var(--text-muted); margin-top: 2px; font-family: monospace; }
  .cust-badges { display: flex; gap: 6px; flex-wrap: wrap; margin-left: auto; flex-shrink: 0; }
  .cust-badge {
    display: inline-flex; align-items: center; gap: 3px;
    font-size: 10.5px; font-weight: 700; padding: 3px 9px; border-radius: 20px;
    border: 1px solid; white-space: nowrap;
  }
  .cust-card-body { padding: 12px 16px; flex: 1; display: flex; flex-direction: column; gap: 10px; }
  .cust-meta { display: flex; align-items: flex-start; gap: 6px; font-size: 12px; color: var(--text-muted); }
  .cust-meta-icon { flex-shrink: 0; margin-top: 1px; }
  .cust-rates {
    display: grid; grid-template-columns: repeat(4, 1fr);
    gap: 6px; background: var(--bg-alt); border-radius: 10px; padding: 10px; border: 1px solid var(--border);
  }
  .cust-rate-item  { text-align: center; }
  .cust-rate-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 2px; }
  .cust-rate-val   { font-size: 13px; font-weight: 700; color: var(--text); }
  .cust-rate-nil   { font-size: 12px; color: var(--text-muted); opacity: 0.4; }
  .cust-card-actions { padding: 10px 16px 14px; display: flex; gap: 7px; flex-wrap: wrap; }
  .cust-btn {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 6px 13px; border-radius: 8px; font-size: 12px; font-weight: 600;
    cursor: pointer; font-family: Poppins, sans-serif; white-space: nowrap;
    transition: opacity 0.15s; border: 1px solid transparent;
  }
  .cust-btn:hover { opacity: 0.82; }
  .cust-btn-view { border-color: #93C5FD; background: #EFF6FF; color: #2563EB; }
  .cust-btn-edit { border-color: #6EE7B7; background: #ECFDF5; color: #059669; }
  .cust-btn-del  { border-color: #FCA5A5; background: #FEF2F2; color: #EF4444; padding: 6px 10px; }

  /* ── Customer modal ── */
  .cust-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 9998;
    display: flex; align-items: flex-start; justify-content: center;
    padding: 24px 16px; overflow-y: auto; backdrop-filter: blur(4px);
  }
  .cust-modal {
    background: var(--card); border-radius: 16px; width: 100%; max-width: 740px;
    box-shadow: 0 24px 80px rgba(0,0,0,0.3); display: flex; flex-direction: column;
    animation: cust-slide 0.2s ease;
  }
  @keyframes cust-slide { from { opacity:0; transform:translateY(-16px) } to { opacity:1; transform:translateY(0) } }
  .cust-modal-header { display: flex; align-items: center; gap: 12px; padding: 20px 24px 16px; border-bottom: 1px solid var(--border); }
  .cust-modal-title  { font-size: 16px; font-weight: 800; color: var(--text); flex: 1; }
  .cust-modal-close  {
    width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--border);
    background: var(--bg-alt); display: flex; align-items: center; justify-content: center;
    cursor: pointer; color: var(--text-muted);
  }
  .cust-modal-body   { padding: 20px 24px; display: flex; flex-direction: column; gap: 20px; overflow-y: auto; max-height: 70vh; }
  .cust-section-label {
    font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em;
    color: #B8860B; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;
  }
  .cust-section-label::after { content:''; flex:1; height:1px; background: rgba(184,134,11,0.2); }
  .cust-form-row   { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .cust-form-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
  .cust-field label {
    display: block; font-size: 10.5px; font-weight: 700; color: var(--text-muted);
    text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px;
  }
  .cust-input {
    width: 100%; padding: 8px 11px; border-radius: 8px;
    border: 1px solid var(--border); background: var(--bg-alt); color: var(--text);
    font-size: 12.5px; font-family: Poppins, sans-serif; outline: none; box-sizing: border-box;
    transition: border-color 0.15s;
  }
  .cust-input:focus { border-color: #B8860B; }
  .cust-input-prefix { display: flex; }
  .cust-input-prefix span {
    padding: 8px 10px; background: var(--card); border: 1px solid var(--border);
    border-right: none; border-radius: 8px 0 0 8px; font-size: 11px; font-weight: 700;
    color: var(--text-muted); display: flex; align-items: center;
  }
  .cust-input-prefix .cust-input { border-radius: 0 8px 8px 0; }
  .cust-input-suffix { display: flex; }
  .cust-input-suffix .cust-input { border-radius: 8px 0 0 8px; }
  .cust-input-suffix span {
    padding: 8px 10px; background: var(--card); border: 1px solid var(--border);
    border-left: none; border-radius: 0 8px 8px 0; font-size: 11px; font-weight: 700;
    color: var(--text-muted); display: flex; align-items: center;
  }
  .cust-type-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; }
  .cust-type-opt {
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    padding: 10px 8px; border-radius: 10px; cursor: pointer;
    border: 2px solid var(--border); background: var(--bg-alt);
    transition: all 0.15s; text-align: center;
  }
  .cust-type-opt.active { border-color: #B8860B; background: #FFFBEB; }
  .cust-type-opt span   { font-size: 11px; font-weight: 700; color: var(--text); }
  .cust-modal-footer { display: flex; justify-content: flex-end; gap: 10px; padding: 16px 24px; border-top: 1px solid var(--border); }
  .cust-btn-cancel {
    padding: 9px 20px; border-radius: 9px; border: 1px solid var(--border);
    background: var(--bg-alt); color: var(--text); font-weight: 600; font-size: 13px;
    cursor: pointer; font-family: Poppins, sans-serif;
  }
  .cust-btn-save {
    padding: 9px 24px; border-radius: 9px; border: none;
    background: #B8860B; color: white; font-weight: 700; font-size: 13px;
    cursor: pointer; font-family: Poppins, sans-serif; transition: background 0.15s;
  }
  .cust-btn-save:hover    { background: #9a7209; }
  .cust-btn-save:disabled { opacity: 0.55; cursor: not-allowed; }

  /* ── Detail hero ── */
  .det-hero {
    background: linear-gradient(135deg, #0f1623 0%, #1a2535 50%, #1e3a5f 100%);
    border-radius: 16px; padding: 22px; margin-bottom: 16px;
  }
  .det-back-btn {
    display: inline-flex; align-items: center; gap: 6px;
    background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12);
    color: rgba(255,255,255,0.7); font-size: 12px; font-weight: 600;
    padding: 6px 12px; border-radius: 8px; cursor: pointer;
    font-family: Poppins, sans-serif; margin-bottom: 18px;
  }
  .det-hero-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 20px; }
  .det-avatar {
    width: 50px; height: 50px; border-radius: 14px; flex-shrink: 0;
    background: linear-gradient(135deg, #B8860B, #D4A017);
    display: flex; align-items: center; justify-content: center;
    font-weight: 800; font-size: 16px; color: white;
    box-shadow: 0 4px 12px rgba(184,134,11,0.3);
  }
  .det-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  .det-kpi {
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px; padding: 14px 16px;
  }
  .det-kpi-label { font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.45); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 7px; }
  .det-kpi-val   { font-size: 17px; font-weight: 900; letter-spacing: -0.02em; line-height: 1; }
  .det-kpi-sub   { font-size: 10px; color: rgba(255,255,255,0.35); margin-top: 4px; }

  /* ── Tabs ── */
  .det-tabs { display: flex; gap: 2px; padding: 0 16px; border-bottom: 1px solid var(--border); background: var(--card); }
  .det-tab {
    background: none; border: none; border-bottom: 2px solid transparent; padding: 12px 18px;
    font-size: 13px; font-weight: 500; color: var(--text-muted); cursor: pointer;
    font-family: Poppins, sans-serif; transition: all 0.15s; display: flex; align-items: center; gap: 6px;
  }
  .det-tab.active { color: #B8860B; font-weight: 700; border-bottom-color: #B8860B; }
  .det-tab:hover:not(.active) { color: var(--text); background: var(--bg-alt); }
  .det-tab-count {
    font-size: 10px; font-weight: 800; padding: 1px 6px; border-radius: 10px;
    background: var(--bg-alt); color: var(--text-muted); min-width: 18px; text-align: center;
  }
  .det-tab.active .det-tab-count { background: rgba(184,134,11,0.15); color: #B8860B; }

  /* ── Table ── */
  .det-card { background: var(--card); border: 1px solid var(--border); border-radius: 16px; overflow: hidden; }
  .det-table-wrap { overflow-x: auto; }
  .det-table { width: 100%; border-collapse: collapse; }
  .det-table th {
    padding: 11px 14px; font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--text-muted); background: var(--bg-alt);
    border-bottom: 1px solid var(--border); text-align: left; white-space: nowrap;
  }
  .det-table td {
    padding: 12px 14px; font-size: 13px; color: var(--text);
    border-bottom: 1px solid var(--border); vertical-align: middle;
  }
  .det-table tr:last-child td { border-bottom: none; }
  .det-table tr:hover td { background: var(--bg-alt); }
  .det-table .col-r { text-align: right; font-weight: 700; white-space: nowrap; }
  .det-table .col-grand { text-align: right; font-weight: 800; color: #2563EB; white-space: nowrap; }
  .det-table .col-credit { text-align: right; font-weight: 800; color: #059669; white-space: nowrap; }
  .det-table .col-act  { text-align: right; white-space: nowrap; }
  .mono-badge {
    font-family: monospace; font-size: 11.5px; font-weight: 700;
    background: var(--bg-alt); border: 1px solid var(--border);
    padding: 2px 8px; border-radius: 6px;
  }
  .cc-badge {
    font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 6px;
    background: var(--bg-alt); border: 1px solid var(--border);
  }

  /* ── Balance tab ── */
  .bal-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 20px; border-bottom: 1px solid var(--border);
    font-size: 13px;
  }
  .bal-row:last-child { border-bottom: none; }
  .bal-label { display: flex; align-items: center; gap: 8px; color: var(--text); font-weight: 600; }
  .bal-val   { font-weight: 800; font-size: 15px; }

  /* ── Entry modal ── */
  .ent-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 9999;
    display: flex; align-items: center; justify-content: center;
    padding: 20px; backdrop-filter: blur(6px);
  }
  .ent-modal {
    background: var(--card); border-radius: 20px; width: 100%; max-width: 500px;
    border: 1px solid var(--border); overflow: hidden; animation: cust-slide 0.2s ease;
    box-shadow: 0 24px 60px rgba(0,0,0,0.35);
  }
  .ent-modal-head {
    padding: 18px 22px; border-bottom: 1px solid var(--border);
    background: linear-gradient(135deg, #0f1623, #1a2535);
    display: flex; align-items: center; justify-content: space-between;
  }

  /* ── General Ledger ── */
  .ldg-toolbar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 16px; border-bottom: 1px solid var(--border); gap: 10px; flex-wrap: wrap;
  }
  .ldg-year-sel {
    padding: 7px 12px; border-radius: 9px; border: 1px solid var(--border);
    background: var(--bg-alt); color: var(--text);
    font-family: Poppins, sans-serif; font-size: 13px; font-weight: 600; outline: none; cursor: pointer;
  }
  .ldg-print-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 7px 14px; border-radius: 9px;
    border: 1px solid var(--border); background: var(--bg-alt);
    color: var(--text); font-size: 12px; font-weight: 600;
    cursor: pointer; font-family: Poppins, sans-serif; transition: opacity 0.15s;
  }
  .ldg-print-btn:hover { opacity: 0.75; }
  .ldg-bal-chip {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 800; white-space: nowrap;
  }
  .ldg-table { width: 100%; border-collapse: collapse; }
  .ldg-table th {
    padding: 10px 14px; font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--text-muted); background: var(--bg-alt);
    border-bottom: 1px solid var(--border); white-space: nowrap;
  }
  .ldg-table th.r { text-align: right; }
  .ldg-table td {
    padding: 11px 14px; font-size: 12.5px; color: var(--text);
    border-bottom: 1px solid var(--border); vertical-align: middle;
  }
  .ldg-table tr:last-child td { border-bottom: none; }
  .ldg-table tr.ldg-row-inv:hover td { background: rgba(251,191,36,0.04); }
  .ldg-table tr.ldg-row-rec:hover td { background: rgba(34,197,94,0.04); }
  .ldg-bf-row td { background: rgba(255,255,255,0.025); font-style: italic; }
  .ldg-total-row td {
    background: var(--bg-alt); font-weight: 800; font-size: 13px;
    border-top: 2px solid var(--border); border-bottom: none;
  }
  .ldg-debit  { text-align: right; font-weight: 800; color: #F97316; white-space: nowrap; font-family: monospace; font-size: 13px; }
  .ldg-credit { text-align: right; font-weight: 800; color: #22C55E; white-space: nowrap; font-family: monospace; font-size: 13px; }
  .ldg-bal-db { text-align: right; font-weight: 800; color: #F97316; white-space: nowrap; font-family: monospace; font-size: 13px; }
  .ldg-bal-cr { text-align: right; font-weight: 800; color: #22C55E; white-space: nowrap; font-family: monospace; font-size: 13px; }
  .ldg-nil    { text-align: right; color: var(--text-muted); font-size: 11px; }
  .ldg-sno    { color: var(--text-muted); font-size: 11px; font-weight: 600; }
  .ldg-type-pill {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 20px; white-space: nowrap;
  }

  @media print {
    .det-back-btn, .det-hero-row button, .cust-add-btn, .det-tabs,
    .ldg-toolbar .ldg-print-btn, .ldg-toolbar .ldg-year-sel { display: none !important; }
    .det-hero { border-radius: 0 !important; }
    .ldg-table td, .ldg-table th { font-size: 11px; padding: 7px 10px; }
  }

  /* ── Skeletons ── */
  @keyframes cust-pulse { 0%,100%{opacity:.4} 50%{opacity:.8} }
  .cust-skel { animation: cust-pulse 1.5s ease infinite; background: var(--card); border-radius: 14px; }
  @keyframes pc-spin { to { transform:rotate(360deg); } }
  .pc-spin { animation: pc-spin 0.8s linear infinite; }

  @media (max-width: 900px) {
    .cust-grid   { grid-template-columns: 1fr; }
    .cust-kpi-grid { grid-template-columns: repeat(2, 1fr); }
    .det-kpis { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 600px) {
    .cust-hero { padding: 16px; border-radius: 12px; }
    .cust-kpi-grid { grid-template-columns: 1fr 1fr; gap: 8px; }
    .cust-kpi-val  { font-size: 20px; }
    .cust-add-btn  { padding: 8px 14px; font-size: 12px; }
    .cust-form-row   { grid-template-columns: 1fr; }
    .cust-form-row-3 { grid-template-columns: 1fr 1fr; }
    .cust-modal-body   { padding: 16px; }
    .cust-modal-header { padding: 16px; }
    .cust-modal-footer { padding: 12px 16px; }
    .cust-rates { grid-template-columns: repeat(2,1fr); }
    .cust-card-header { flex-wrap: wrap; }
    .cust-badges { margin-left: 0; }
    .det-kpis { grid-template-columns: 1fr 1fr; }
  }
`

/* ── Rate Cell ──────────────────────────────────────────────── */
function RateCell({ label, value }) {
  const v = fmtNum(value)
  return (
    <div className="cust-rate-item">
      <div className="cust-rate-label">{label}</div>
      {v !== null
        ? <div className="cust-rate-val">AED {v}</div>
        : <div className="cust-rate-nil">—</div>}
    </div>
  )
}

/* ── Entry Modal (Invoice or Receipt) ──────────────────────── */
function EntryModal({ type, customer, entry, onSave, onClose }) {
  const isInvoice = type === 'invoice'
  const isEdit    = !!entry
  const hasTrn    = !!customer?.trn_no?.trim()

  const blank = isInvoice
    ? { invoice_date: new Date().toISOString().slice(0,10), invoice_no:'', cost_center: customer?.cost_center||'', description:'', invoice_amount:'', vat_percent: hasTrn ? '5' : '', grand_total:'' }
    : { receipt_date: new Date().toISOString().slice(0,10), cost_center: customer?.cost_center||'', description:'', credit:'' }

  const [form, setForm] = useState(entry ? (() => {
    if (isInvoice) return {
      invoice_date:   entry.invoice_date?.slice(0,10) || new Date().toISOString().slice(0,10),
      invoice_no:     entry.invoice_no    || '',
      cost_center:    entry.cost_center   || '',
      description:    entry.description   || '',
      invoice_amount: entry.invoice_amount != null ? String(entry.invoice_amount) : '',
      // VAT is stored as an AED amount; derive the display percentage from amount + vat.
      vat_percent:    (entry.vat != null && entry.invoice_amount)
        ? String(Math.round((entry.vat / entry.invoice_amount) * 10000) / 100)
        : (entry.vat != null ? '0' : ''),
      grand_total:    entry.grand_total    != null ? String(entry.grand_total)    : '',
    }
    return {
      receipt_date: entry.receipt_date?.slice(0,10) || new Date().toISOString().slice(0,10),
      cost_center:  entry.cost_center || '',
      description:  entry.description || '',
      credit:       entry.credit != null ? String(entry.credit) : '',
    }
  })() : blank)

  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState('')

  function set(k, v) {
    setForm(f => {
      const next = { ...f, [k]: v }
      if (isInvoice && (k === 'invoice_amount' || k === 'vat_percent')) {
        const amt = parseFloat(next.invoice_amount)
        const pct = parseFloat(next.vat_percent)
        const vatAmt = (!isNaN(amt) && amt >= 0 && !isNaN(pct)) ? Math.round(amt * pct) / 100 : 0
        next.grand_total = (!isNaN(amt) && amt >= 0)
          ? String(Math.round((amt + vatAmt) * 100) / 100)
          : ''
      }
      return next
    })
  }

  const vatAmount = (() => {
    const amt = parseFloat(form.invoice_amount)
    const pct = parseFloat(form.vat_percent)
    return (!isNaN(amt) && amt >= 0 && !isNaN(pct)) ? Math.round(amt * pct) / 100 : 0
  })()

  async function handleSubmit() {
    setErr('')
    try {
      if (isInvoice) {
        if (!form.invoice_date || !form.invoice_amount) { setErr('Invoice date and amount are required'); return }
        const amt = parseFloat(form.invoice_amount)
        if (isNaN(amt) || amt <= 0) { setErr('Invoice amount must be a positive number'); return }
        setSaving(true)
        const payload = {
          customer_id: customer.id,
          invoice_date: form.invoice_date,
          invoice_no: form.invoice_no || null,
          cost_center: form.cost_center || null,
          description: form.description || null,
          invoice_amount: amt,
          vat: vatAmount,
          grand_total: form.grand_total !== '' ? parseFloat(form.grand_total) : (amt + vatAmount),
        }
        if (isEdit) await customerInvoiceApi.update(entry.id, payload)
        else        await customerInvoiceApi.create(payload)
      } else {
        if (!form.receipt_date || !form.credit) { setErr('Date and credit amount are required'); return }
        const amt = parseFloat(form.credit)
        if (isNaN(amt) || amt <= 0) { setErr('Credit amount must be a positive number'); return }
        setSaving(true)
        const payload = {
          customer_id: customer.id,
          receipt_date: form.receipt_date,
          cost_center: form.cost_center || null,
          description: form.description || null,
          credit: amt,
        }
        if (isEdit) await customerReceiptApi.update(entry.id, payload)
        else        await customerReceiptApi.create(payload)
      }
      onSave()
    } catch(e) { setErr(e.message) } finally { setSaving(false) }
  }

  const iconBg   = isInvoice ? 'rgba(184,134,11,0.2)'  : 'rgba(34,197,94,0.2)'
  const iconBdr  = isInvoice ? 'rgba(184,134,11,0.4)'  : 'rgba(34,197,94,0.4)'
  const iconColor= isInvoice ? '#D4A017' : '#22C55E'
  const btnBg    = isInvoice ? 'linear-gradient(135deg,#B8860B,#D4A017)' : 'linear-gradient(135deg,#15803D,#22C55E)'
  const btnShadow= isInvoice ? '0 3px 12px rgba(184,134,11,0.35)' : '0 3px 12px rgba(34,197,94,0.3)'

  return createPortal(
    <div className="ent-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ent-modal">
        <div className="ent-modal-head">
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:iconBg, border:`1px solid ${iconBdr}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
              {isInvoice ? <Receipt size={17} color={iconColor}/> : <ArrowDownLeft size={17} color={iconColor}/>}
            </div>
            <div>
              <div style={{ fontWeight:800, fontSize:15, color:'white' }}>
                {isEdit ? `Edit ${isInvoice ? 'Invoice' : 'Receipt'}` : `New ${isInvoice ? 'Invoice' : 'Payment Receipt'}`}
              </div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.45)', marginTop:1 }}>{customer.name}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.15)', cursor:'pointer', color:'rgba(255,255,255,0.6)', display:'flex', padding:7, borderRadius:8 }}><X size={15}/></button>
        </div>
        <div style={{ padding:'20px 22px', display:'flex', flexDirection:'column', gap:14 }}>
          {err && (
            <div style={{ background:'#FEF2F2', border:'1px solid #FCA5A5', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#DC2626', display:'flex', gap:8, alignItems:'center' }}>
              <AlertCircle size={14}/> {err}
            </div>
          )}

          {isInvoice ? (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div className="cust-field">
                  <label>Invoice Date <span style={{ color:'#EF4444' }}>*</span></label>
                  <input type="date" value={form.invoice_date} onChange={e => set('invoice_date', e.target.value)} className="cust-input"/>
                </div>
                <div className="cust-field">
                  <label>Invoice No</label>
                  <input value={form.invoice_no} onChange={e => set('invoice_no', e.target.value)} placeholder="e.g. INV-2026-001" className="cust-input" style={{ fontFamily:'monospace' }}/>
                </div>
              </div>
              <div className="cust-field">
                <label>Description</label>
                <input value={form.description} onChange={e => set('description', e.target.value)} placeholder="e.g. AMAZON DSH6 January Services" className="cust-input"/>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div className="cust-field">
                  <label>Cost Center</label>
                  <input value={form.cost_center} onChange={e => set('cost_center', e.target.value)} placeholder="e.g. DSH6" className="cust-input"/>
                </div>
                <div className="cust-field">
                  <label>Invoice Amount (AED) <span style={{ color:'#EF4444' }}>*</span></label>
                  <div className="cust-input-prefix">
                    <span>AED</span>
                    <input type="number" min="0" step="0.01" value={form.invoice_amount} onChange={e => set('invoice_amount', e.target.value)} placeholder="0.00" className="cust-input"/>
                  </div>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div className="cust-field">
                  <label>VAT {hasTrn
                    ? <span style={{ fontSize:9, color:'#16A34A' }}>(defaults to 5%)</span>
                    : <span style={{ fontSize:9, color:'#DC2626' }}>(no TRN — enter % manually)</span>}
                  </label>
                  <div className="cust-input-suffix">
                    <input type="number" min="0" max="100" step="0.01" value={form.vat_percent} onChange={e => set('vat_percent', e.target.value)} placeholder="0" className="cust-input"/>
                    <span>%</span>
                  </div>
                  <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:4 }}>= AED {vatAmount.toLocaleString('en-AE', { minimumFractionDigits:2, maximumFractionDigits:2 })}</div>
                </div>
                <div className="cust-field">
                  <label>Grand Total</label>
                  <div className="cust-input-prefix">
                    <span>AED</span>
                    <input type="number" min="0" step="0.01" value={form.grand_total} onChange={e => set('grand_total', e.target.value)} placeholder="0.00" className="cust-input" style={{ fontWeight:700 }}/>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div className="cust-field">
                  <label>Payment Date <span style={{ color:'#EF4444' }}>*</span></label>
                  <input type="date" value={form.receipt_date} onChange={e => set('receipt_date', e.target.value)} className="cust-input"/>
                </div>
                <div className="cust-field">
                  <label>Credit Amount (AED) <span style={{ color:'#EF4444' }}>*</span></label>
                  <div className="cust-input-prefix">
                    <span>AED</span>
                    <input type="number" min="0" step="0.01" value={form.credit} onChange={e => set('credit', e.target.value)} placeholder="0.00" className="cust-input"/>
                  </div>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div className="cust-field">
                  <label>Cost Center</label>
                  <input value={form.cost_center} onChange={e => set('cost_center', e.target.value)} placeholder="e.g. DSH6" className="cust-input"/>
                </div>
                <div className="cust-field">
                  <label>Description</label>
                  <input value={form.description} onChange={e => set('description', e.target.value)} placeholder="e.g. Bank transfer Jan" className="cust-input"/>
                </div>
              </div>
            </>
          )}

          <button onClick={handleSubmit} disabled={saving}
            style={{ padding:'13px', borderRadius:12, border:'none', cursor:saving?'not-allowed':'pointer', background:saving?'var(--border)':btnBg, color:saving?'var(--text-muted)':'white', fontWeight:700, fontSize:14, fontFamily:'Poppins,sans-serif', marginTop:4, transition:'all 0.2s', boxShadow:saving?'none':btnShadow }}>
            {saving ? (isEdit ? 'Saving…' : 'Adding…') : (isEdit ? 'Save Changes' : isInvoice ? 'Add Invoice' : 'Add Payment Receipt')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

/* ── General Ledger Tab ─────────────────────────────────────── */
const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = Array.from({ length: CURRENT_YEAR - 2022 }, (_, i) => 2023 + i).reverse()

function numFmt(n) {
  const v = parseFloat(n)
  return isNaN(v) ? '0.00' : v.toLocaleString('en-AE', { minimumFractionDigits:2, maximumFractionDigits:2 })
}
function aed(n) { return `AED ${numFmt(n)}` }

function openLedgerPrint(customer, year, data) {
  const now = new Date().toLocaleString('en-AE', { dateStyle:'long', timeStyle:'short' })
  const showBf = data.bf_balance > 0

  const rows = [
    ...(showBf ? [`
      <tr class="bf-row">
        <td style="color:#aaa;font-style:italic">—</td>
        <td style="color:#aaa;font-style:italic">${year}-01-01</td>
        <td colspan="3" style="color:#aaa;font-style:italic;font-weight:600">Balance B/F (brought forward)</td>
        <td class="${data.bf_sign==='Db'?'db':'nil'}">${data.bf_sign==='Db'?aed(data.bf_balance):'—'}</td>
        <td class="${data.bf_sign==='Cr'?'cr':'nil'}">${data.bf_sign==='Cr'?aed(data.bf_balance):'—'}</td>
        <td class="${data.bf_sign==='Db'?'db':'cr'}">${aed(data.bf_balance)} <sup>${data.bf_sign}</sup></td>
      </tr>`] : []),
    ...data.entries.map((e, i) => {
      const inv = e.entry_type === 'invoice'
      return `
      <tr class="${inv?'inv-row':'rec-row'}">
        <td class="sno">${i+1}</td>
        <td class="date">${e.date?.slice(0,10)||''}</td>
        <td><span class="pill ${inv?'pill-inv':'pill-rec'}">${inv?'INV':'REC'}</span>${e.description||'<span style="color:#bbb">—</span>'}</td>
        <td class="mono">${e.ref||'—'}</td>
        <td>${e.cost_center||'—'}</td>
        <td class="${e.debit?'db':'nil'}">${e.debit?aed(e.debit):'—'}</td>
        <td class="${e.credit?'cr':'nil'}">${e.credit?aed(e.credit):'—'}</td>
        <td class="${e.balance_sign==='Db'?'db':'cr'}">${aed(e.balance)} <sup>${e.balance_sign}</sup></td>
      </tr>`
    }),
  ].join('')

  const totalRow = data.entries.length > 0 ? `
    <tr class="total-row">
      <td colspan="5">Closing Balance — ${year}</td>
      <td class="db">${aed(data.total_debit)}</td>
      <td class="cr">${aed(data.total_credit)}</td>
      <td class="${data.closing_sign==='Db'?'db':'cr'}" style="font-size:14px">${aed(data.closing_balance)} <sup>${data.closing_sign}</sup></td>
    </tr>` : ''

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>General Ledger — ${customer.name} — ${year}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #1a1a2e; padding: 28px 32px; font-size: 12px; }

  /* ── Header ── */
  .page-header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; border-bottom: 3px solid #B8860B; margin-bottom: 20px; }
  .company-name { font-size: 20px; font-weight: 900; color: #B8860B; letter-spacing: -0.02em; }
  .doc-title { font-size: 13px; font-weight: 700; color: #1a1a2e; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.08em; }
  .print-meta { text-align: right; font-size: 10px; color: #888; line-height: 1.6; }

  /* ── Customer card ── */
  .cust-card { background: #fafaf7; border: 1px solid #e8dfc0; border-radius: 10px; padding: 14px 18px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
  .cust-left {}
  .cust-name { font-size: 17px; font-weight: 800; color: #1a1a2e; }
  .cust-meta { font-size: 11px; color: #666; margin-top: 5px; display: flex; gap: 16px; flex-wrap: wrap; }
  .cust-meta span { display: flex; align-items: center; gap: 4px; }
  .year-pill { background: #1a1a2e; color: #B8860B; font-weight: 800; font-size: 15px; padding: 6px 18px; border-radius: 20px; letter-spacing: 0.04em; }

  /* ── Balance summary strip ── */
  .bal-strip { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; margin-bottom: 20px; }
  .bal-box { border-radius: 8px; padding: 12px 14px; text-align: center; }
  .bal-box-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 5px; opacity: 0.6; }
  .bal-box-val { font-size: 15px; font-weight: 800; }

  /* ── Table ── */
  table { width: 100%; border-collapse: collapse; }
  thead tr { background: #1a1a2e; }
  th { color: white; padding: 9px 11px; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; white-space: nowrap; }
  th.r { text-align: right; }
  td { padding: 9px 11px; border-bottom: 1px solid #f0ece0; vertical-align: middle; }
  tr.bf-row td { background: #fdf8ed; }
  tr.inv-row:hover td { background: #fffdf5; }
  tr.rec-row:hover td { background: #f5fff8; }
  .sno  { color: #bbb; font-size: 10px; font-weight: 600; }
  .date { font-weight: 600; white-space: nowrap; color: #333; }
  .mono { font-family: monospace; font-size: 11px; background: #f5f5f5; padding: 1px 6px; border-radius: 4px; white-space: nowrap; display: inline-block; }
  .pill { display: inline-block; font-size: 9px; font-weight: 800; padding: 2px 7px; border-radius: 10px; margin-right: 6px; }
  .pill-inv { background: #fffbeb; border: 1px solid #fde68a; color: #b45309; }
  .pill-rec { background: #f0fdf4; border: 1px solid #86efac; color: #15803d; }
  .db  { text-align: right; font-weight: 700; color: #c2410c; font-family: monospace; white-space: nowrap; }
  .cr  { text-align: right; font-weight: 700; color: #15803d; font-family: monospace; white-space: nowrap; }
  .nil { text-align: right; color: #ccc; }
  sup  { font-size: 8px; font-weight: 800; opacity: 0.75; }
  tr.total-row td { background: #1a1a2e; color: white; font-weight: 700; border: none; }
  tr.total-row .db { color: #fbbf24; }
  tr.total-row .cr { color: #34d399; }

  /* ── Footer ── */
  .page-footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e8dfc0; display: flex; justify-content: space-between; font-size: 9.5px; color: #aaa; }

  @page { margin: 12mm 10mm; size: A4 landscape; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>

<div class="page-header">
  <div>
    <div class="company-name">Golden Crescent Delivery</div>
    <div class="doc-title">General Ledger — Customer Statement</div>
  </div>
  <div class="print-meta">
    <div>Printed: ${now}</div>
    <div>Period: 01 Jan ${year} — 31 Dec ${year}</div>
    <div style="margin-top:4px;font-weight:700;color:#1a1a2e">fms.goldencrescent.ae</div>
  </div>
</div>

<div class="cust-card">
  <div class="cust-left">
    <div class="cust-name">${customer.name}</div>
    <div class="cust-meta">
      ${customer.trn_no ? `<span>TRN: <strong>${customer.trn_no}</strong></span>` : ''}
      ${customer.cost_center ? `<span>Cost Center: <strong>${customer.cost_center}</strong></span>` : ''}
      ${customer.address ? `<span>${customer.address}</span>` : ''}
    </div>
  </div>
  <div class="year-pill">${year}</div>
</div>

<div class="bal-strip">
  <div class="bal-box" style="background:#fffbf0;border:1px solid #fde68a">
    <div class="bal-box-label" style="color:#b45309">Total Invoiced</div>
    <div class="bal-box-val" style="color:#b45309">${aed(data.total_debit)}</div>
  </div>
  <div class="bal-box" style="background:#f0fdf4;border:1px solid #86efac">
    <div class="bal-box-label" style="color:#15803d">Total Receipts</div>
    <div class="bal-box-val" style="color:#15803d">${aed(data.total_credit)}</div>
  </div>
  <div class="bal-box" style="background:${data.closing_sign==='Cr'?'#f0fdf4':'#fff7ed'};border:1px solid ${data.closing_sign==='Cr'?'#86efac':'#fed7aa'}">
    <div class="bal-box-label" style="color:${data.closing_sign==='Cr'?'#15803d':'#c2410c'}">Closing Balance</div>
    <div class="bal-box-val" style="color:${data.closing_sign==='Cr'?'#15803d':'#c2410c'}">${aed(data.closing_balance)} <sup style="font-size:10px">${data.closing_sign}</sup></div>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th style="width:36px">S.No</th>
      <th>Date</th>
      <th>Description</th>
      <th>Ref / Invoice No</th>
      <th>Cost Center</th>
      <th class="r">Debit (AED)</th>
      <th class="r">Credit (AED)</th>
      <th class="r">Balance (AED)</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
    ${totalRow}
  </tbody>
</table>

<div class="page-footer">
  <span>Golden Crescent Delivery — Confidential</span>
  <span>Generated by GCD Fleet Management System</span>
</div>

<script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); }</script>
</body>
</html>`

  const w = window.open('', '_blank', 'width=1100,height=750')
  w.document.write(html)
  w.document.close()
}

function LedgerTab({ customer }) {
  const [year,    setYear]    = useState(CURRENT_YEAR)
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [err,     setErr]     = useState('')

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try { setData(await customerLedgerApi.get(customer.id, year)) }
    catch(e) { setErr(e.message) }
    finally  { setLoading(false) }
  }, [customer.id, year])

  useEffect(() => { load() }, [load])

  const closingColor = data?.closing_sign === 'Cr' ? '#22C55E' : '#F97316'
  const showBf = data && data.bf_balance > 0

  return (
    <div>
      <div className="ldg-toolbar">
        <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
          <select className="ldg-year-sel" value={year} onChange={e => setYear(Number(e.target.value))}>
            {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {!loading && data && (
            <div className="ldg-bal-chip" style={{
              background: data.closing_sign === 'Cr' ? 'rgba(34,197,94,0.1)' : 'rgba(249,115,22,0.1)',
              border: `1px solid ${data.closing_sign === 'Cr' ? 'rgba(34,197,94,0.3)' : 'rgba(249,115,22,0.3)'}`,
              color: closingColor,
            }}>
              Balance: AED {numFmt(data.closing_balance)}
              <span style={{ fontSize:10, fontWeight:800, opacity:0.8, marginLeft:3 }}>{data.closing_sign}</span>
            </div>
          )}
        </div>
        <button className="ldg-print-btn" onClick={() => data && openLedgerPrint(customer, year, data)}>
          <Printer size={13}/> Print
        </button>
      </div>

      {err && (
        <div style={{ margin:16, padding:'12px 16px', borderRadius:10, background:'#FEF2F2', border:'1px solid #FCA5A5', color:'#DC2626', fontSize:13, display:'flex', gap:8, alignItems:'center' }}>
          <AlertCircle size={14}/> {err}
        </div>
      )}

      {loading ? (
        <div style={{ padding:40, textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>Loading ledger…</div>
      ) : !data ? null : (
        <div className="det-table-wrap">
          <table className="ldg-table" style={{ minWidth:700 }}>
            <thead>
              <tr>
                <th style={{ width:42 }}>S.No</th>
                <th>Date</th>
                <th>Description</th>
                <th>Ref / Invoice No</th>
                <th>Cost Center</th>
                <th className="r">Debit (AED)</th>
                <th className="r">Credit (AED)</th>
                <th className="r">Balance (AED)</th>
              </tr>
            </thead>
            <tbody>
              {/* B/F row — only shown when there is a non-zero carried forward balance */}
              {showBf && (
                <tr className="ldg-bf-row">
                  <td className="ldg-sno">—</td>
                  <td style={{ color:'var(--text-muted)', fontSize:12, whiteSpace:'nowrap' }}>{year}-01-01</td>
                  <td colSpan={3} style={{ color:'var(--text-muted)', fontWeight:700, fontSize:12 }}>
                    Balance B/F (brought forward)
                  </td>
                  <td className={data.bf_sign === 'Db' ? 'ldg-debit' : 'ldg-nil'}>
                    {data.bf_sign === 'Db' ? aed(data.bf_balance) : '—'}
                  </td>
                  <td className={data.bf_sign === 'Cr' ? 'ldg-credit' : 'ldg-nil'}>
                    {data.bf_sign === 'Cr' ? aed(data.bf_balance) : '—'}
                  </td>
                  <td className={data.bf_sign === 'Db' ? 'ldg-bal-db' : 'ldg-bal-cr'}>
                    {aed(data.bf_balance)} <span style={{ fontSize:9, fontWeight:800 }}>{data.bf_sign}</span>
                  </td>
                </tr>
              )}

              {data.entries.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign:'center', padding:'40px 20px', color:'var(--text-muted)', fontSize:13 }}>
                    No transactions in {year}
                  </td>
                </tr>
              )}

              {data.entries.map((e, i) => {
                const isInv = e.entry_type === 'invoice'
                return (
                  <tr key={e.id} className={isInv ? 'ldg-row-inv' : 'ldg-row-rec'}>
                    <td className="ldg-sno">{i + 1}</td>
                    <td style={{ fontWeight:600, fontSize:12, whiteSpace:'nowrap' }}>{e.date?.slice(0,10)}</td>
                    <td style={{ maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      <span className="ldg-type-pill" style={{
                        background: isInv ? 'rgba(251,191,36,0.1)' : 'rgba(34,197,94,0.1)',
                        border: isInv ? '1px solid rgba(251,191,36,0.25)' : '1px solid rgba(34,197,94,0.25)',
                        color: isInv ? '#D97706' : '#16A34A', marginRight:6,
                      }}>{isInv ? 'INV' : 'REC'}</span>
                      {e.description || <span style={{ color:'var(--text-muted)', fontSize:11 }}>—</span>}
                    </td>
                    <td>
                      {e.ref ? <span className="mono-badge" style={{ fontSize:11 }}>{e.ref}</span>
                              : <span style={{ color:'var(--text-muted)', fontSize:11 }}>—</span>}
                    </td>
                    <td>
                      {e.cost_center ? <span className="cc-badge">{e.cost_center}</span>
                                     : <span style={{ color:'var(--text-muted)', fontSize:11 }}>—</span>}
                    </td>
                    <td className={e.debit  ? 'ldg-debit'  : 'ldg-nil'}>{e.debit  ? aed(e.debit)  : '—'}</td>
                    <td className={e.credit ? 'ldg-credit' : 'ldg-nil'}>{e.credit ? aed(e.credit) : '—'}</td>
                    <td className={e.balance_sign === 'Db' ? 'ldg-bal-db' : 'ldg-bal-cr'}>
                      {aed(e.balance)} <span style={{ fontSize:9, fontWeight:800 }}>{e.balance_sign}</span>
                    </td>
                  </tr>
                )
              })}

              {data.entries.length > 0 && (
                <tr className="ldg-total-row">
                  <td colSpan={5} style={{ color:'var(--text-muted)', fontSize:11, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase' }}>
                    Closing Balance — {year}
                  </td>
                  <td className="ldg-debit">{aed(data.total_debit)}</td>
                  <td className="ldg-credit">{aed(data.total_credit)}</td>
                  <td className={data.closing_sign === 'Db' ? 'ldg-bal-db' : 'ldg-bal-cr'} style={{ fontSize:14 }}>
                    {aed(data.closing_balance)} <span style={{ fontSize:9, fontWeight:800 }}>{data.closing_sign}</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ── Customer Detail (Invoices + Receipts + Balance) ────────── */
function CustomerDetailView({ customer, isAdmin, onBack }) {
  const [invData,    setInvData]    = useState(null)
  const [recData,    setRecData]    = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [tab,        setTab]        = useState('invoices')
  const [modal,      setModal]      = useState(null) // null | {type, entry}
  const [search,     setSearch]     = useState('')

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const [inv, rec] = await Promise.all([
        customerInvoiceApi.list(customer.id),
        customerReceiptApi.list(customer.id),
      ])
      setInvData(inv)
      setRecData(rec)
    } catch(e) { console.error(e) }
    finally { setLoading(false); setRefreshing(false) }
  }, [customer.id])

  useEffect(() => { load() }, [load])

  async function handleDeleteInv(id) {
    if (!confirm('Delete this invoice?')) return
    try { await customerInvoiceApi.delete(id); load() } catch(e) { alert(e.message) }
  }
  async function handleDeleteRec(id) {
    if (!confirm('Delete this receipt?')) return
    try { await customerReceiptApi.delete(id); load() } catch(e) { alert(e.message) }
  }

  const filteredInv = useMemo(() => {
    const list = invData?.invoices || []
    if (!search) return list
    const q = search.toLowerCase()
    return list.filter(i =>
      i.invoice_no?.toLowerCase().includes(q) ||
      i.description?.toLowerCase().includes(q) ||
      i.cost_center?.toLowerCase().includes(q) ||
      i.invoice_date?.includes(q)
    )
  }, [invData, search])

  const filteredRec = useMemo(() => {
    const list = recData?.receipts || []
    if (!search) return list
    const q = search.toLowerCase()
    return list.filter(r =>
      r.description?.toLowerCase().includes(q) ||
      r.cost_center?.toLowerCase().includes(q) ||
      r.receipt_date?.includes(q)
    )
  }, [recData, search])

  const typeMeta    = TYPE_META[customer.customer_type] || TYPE_META.sale_invoice
  const totalGrand  = Number(invData?.total_grand  || 0)
  const totalReceipt= Number(recData?.total_credit || 0)
  const balance     = totalGrand - totalReceipt
  const balNeg      = balance < 0

  return (
    <div>
      {/* Hero */}
      <div className="det-hero">
        <button onClick={onBack} className="det-back-btn">
          <ChevronLeft size={13}/> Back to Customers
        </button>
        <div className="det-hero-row">
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <div className="det-avatar">{initials(customer.name)}</div>
            <div>
              <div style={{ fontWeight:800, fontSize:18, color:'white', letterSpacing:'-0.02em' }}>{customer.name}</div>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:5, flexWrap:'wrap' }}>
                <span style={{ fontSize:11, padding:'2px 10px', borderRadius:20, background:typeMeta.bg, color:typeMeta.color, fontWeight:700, border:`1px solid ${typeMeta.border}` }}>
                  {typeMeta.label}
                </span>
                {customer.cost_center && (
                  <span style={{ fontSize:11, color:'rgba(255,255,255,0.5)' }}>
                    <Hash size={10} style={{ display:'inline', marginRight:3 }}/>{customer.cost_center}
                  </span>
                )}
                {customer.trn_no && (
                  <span style={{ fontSize:11, color:'rgba(255,255,255,0.4)', fontFamily:'monospace' }}>TRN: {customer.trn_no}</span>
                )}
              </div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0, flexWrap:'wrap' }}>
            <button onClick={() => load(true)} title="Refresh"
              style={{ width:36, height:36, borderRadius:9, background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.12)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <RefreshCw size={14} color="rgba(255,255,255,0.6)" className={refreshing ? 'pc-spin' : ''}/>
            </button>
            <button onClick={() => setModal({ type:'receipt', entry:null })}
              style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 16px', borderRadius:10, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#15803D,#22C55E)', color:'white', fontWeight:700, fontSize:13, fontFamily:'Poppins,sans-serif', boxShadow:'0 2px 10px rgba(34,197,94,0.35)', whiteSpace:'nowrap' }}>
              <ArrowDownLeft size={14}/> Add Receipt
            </button>
            <button onClick={() => setModal({ type:'invoice', entry:null })}
              style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 16px', borderRadius:10, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#B8860B,#D4A017)', color:'white', fontWeight:700, fontSize:13, fontFamily:'Poppins,sans-serif', boxShadow:'0 2px 10px rgba(184,134,11,0.4)', whiteSpace:'nowrap' }}>
              <Plus size={14}/> Add Invoice
            </button>
          </div>
        </div>
        {/* KPI tiles */}
        <div className="det-kpis">
          <div className="det-kpi">
            <div className="det-kpi-label">Invoice Total</div>
            <div className="det-kpi-val" style={{ color:'#FBBF24' }}>{loading ? '…' : fmtAed(totalGrand)}</div>
            <div className="det-kpi-sub">{loading ? '' : `${invData?.count || 0} invoices`}</div>
          </div>
          <div className="det-kpi">
            <div className="det-kpi-label">Receipts</div>
            <div className="det-kpi-val" style={{ color:'#34D399' }}>{loading ? '…' : fmtAed(totalReceipt)}</div>
            <div className="det-kpi-sub">{loading ? '' : `${recData?.count || 0} payments`}</div>
          </div>
          <div className="det-kpi">
            <div className="det-kpi-label">Outstanding</div>
            <div className="det-kpi-val" style={{ color: balNeg ? '#34D399' : balance === 0 ? '#34D399' : '#F87171' }}>
              {loading ? '…' : fmtAed(Math.abs(balance))}
            </div>
            <div className="det-kpi-sub">{loading ? '' : balNeg ? 'Credit surplus' : balance === 0 ? 'Fully settled' : 'Amount due'}</div>
          </div>
          <div className="det-kpi">
            <div className="det-kpi-label">VAT Total</div>
            <div className="det-kpi-val" style={{ color:'#60A5FA' }}>{loading ? '…' : fmtAed(invData?.total_vat || 0)}</div>
            <div className="det-kpi-sub">From invoices</div>
          </div>
        </div>
      </div>

      {/* Tab card */}
      <div className="det-card">
        {/* Tabs */}
        <div className="det-tabs">
          {[
            { key:'invoices', label:'Invoices',  count: invData?.count },
            { key:'receipts', label:'Receipts',  count: recData?.count },
            { key:'balance',  label:'Balance',   count: null },
            { key:'ledger',   label:'Ledger',    count: null },
          ].map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setSearch('') }}
              className={`det-tab${tab===t.key?' active':''}`}>
              {t.key === 'ledger' && <BookOpen size={12}/>}
              {t.label}
              {t.count != null && <span className="det-tab-count">{t.count}</span>}
            </button>
          ))}
        </div>

        {/* Search bar (invoices + receipts tabs) */}
        {tab !== 'balance' && tab !== 'ledger' && (
          <div style={{ padding:'10px 16px', borderBottom:'1px solid var(--border)', position:'relative' }}>
            <Search size={14} style={{ position:'absolute', left:28, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', pointerEvents:'none' }}/>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={`Search ${tab}…`}
              style={{ width:'100%', padding:'8px 12px 8px 36px', borderRadius:9, border:'1px solid var(--border)', background:'var(--bg-alt)', color:'var(--text)', fontSize:13, fontFamily:'Poppins,sans-serif', outline:'none', boxSizing:'border-box' }}/>
          </div>
        )}

        {/* ── INVOICES TAB ── */}
        {tab === 'invoices' && (
          loading ? (
            <div style={{ padding:32, textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>Loading…</div>
          ) : filteredInv.length === 0 ? (
            <div style={{ padding:'48px 20px', textAlign:'center', color:'var(--text-muted)' }}>
              <FileSpreadsheet size={38} style={{ margin:'0 auto 12px', display:'block', opacity:0.12 }}/>
              <div style={{ fontWeight:600, fontSize:13 }}>{search ? 'No invoices match' : 'No invoices yet'}</div>
              {!search && <div style={{ fontSize:11, marginTop:4 }}>Click "+ Add Invoice" to create the first one</div>}
            </div>
          ) : (
            <div className="det-table-wrap">
              <table className="det-table" style={{ minWidth:780 }}>
                <thead><tr>
                  <th>#</th><th>Date</th><th>Invoice No</th><th>Description</th>
                  <th>Cost Center</th><th style={{ textAlign:'right' }}>Amount</th>
                  <th style={{ textAlign:'right' }}>VAT</th><th style={{ textAlign:'right' }}>Grand Total</th>
                  <th style={{ textAlign:'right' }}>Actions</th>
                </tr></thead>
                <tbody>
                  {filteredInv.map((inv, i) => (
                    <tr key={inv.id}>
                      <td style={{ color:'var(--text-muted)', fontSize:11, fontWeight:600 }}>{i+1}</td>
                      <td style={{ fontWeight:600, whiteSpace:'nowrap' }}>{inv.invoice_date?.slice(0,10)}</td>
                      <td>{inv.invoice_no ? <span className="mono-badge">{inv.invoice_no}</span> : <span style={{ color:'var(--text-muted)', fontSize:11 }}>—</span>}</td>
                      <td style={{ maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {inv.description || <span style={{ color:'var(--text-muted)', fontSize:11 }}>—</span>}
                      </td>
                      <td>{inv.cost_center ? <span className="cc-badge">{inv.cost_center}</span> : <span style={{ color:'var(--text-muted)', fontSize:11 }}>—</span>}</td>
                      <td className="col-r">{fmtAed(inv.invoice_amount)}</td>
                      <td className="col-r" style={{ color:'#059669' }}>{fmtAed(inv.vat)}</td>
                      <td className="col-grand">{fmtAed(inv.grand_total)}</td>
                      <td className="col-act">
                        <button onClick={() => setModal({ type:'invoice', entry:inv })}
                          style={{ background:'#EFF6FF', border:'1px solid #93C5FD', color:'#2563EB', borderRadius:7, padding:'4px 10px', fontSize:11.5, fontWeight:600, cursor:'pointer', fontFamily:'Poppins,sans-serif', marginRight:6 }}>
                          <Pencil size={10} style={{ display:'inline', marginRight:4 }}/>Edit
                        </button>
                        {isAdmin && (
                          <button onClick={() => handleDeleteInv(inv.id)}
                            style={{ background:'#FEF2F2', border:'1px solid #FCA5A5', color:'#EF4444', borderRadius:7, padding:'4px 8px', cursor:'pointer' }}>
                            <Trash2 size={10}/>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* ── RECEIPTS TAB ── */}
        {tab === 'receipts' && (
          loading ? (
            <div style={{ padding:32, textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>Loading…</div>
          ) : filteredRec.length === 0 ? (
            <div style={{ padding:'48px 20px', textAlign:'center', color:'var(--text-muted)' }}>
              <ArrowDownLeft size={38} style={{ margin:'0 auto 12px', display:'block', opacity:0.12 }}/>
              <div style={{ fontWeight:600, fontSize:13 }}>{search ? 'No receipts match' : 'No receipts yet'}</div>
              {!search && <div style={{ fontSize:11, marginTop:4 }}>Click "+ Add Receipt" to log a payment</div>}
            </div>
          ) : (
            <div className="det-table-wrap">
              <table className="det-table" style={{ minWidth:580 }}>
                <thead><tr>
                  <th>#</th><th>Date</th><th>Description</th><th>Cost Center</th>
                  <th style={{ textAlign:'right' }}>Credit (AED)</th>
                  <th style={{ textAlign:'right' }}>Actions</th>
                </tr></thead>
                <tbody>
                  {filteredRec.map((rec, i) => (
                    <tr key={rec.id}>
                      <td style={{ color:'var(--text-muted)', fontSize:11, fontWeight:600 }}>{i+1}</td>
                      <td style={{ fontWeight:600, whiteSpace:'nowrap' }}>{rec.receipt_date?.slice(0,10)}</td>
                      <td style={{ maxWidth:240, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {rec.description || <span style={{ color:'var(--text-muted)', fontSize:11 }}>—</span>}
                      </td>
                      <td>{rec.cost_center ? <span className="cc-badge">{rec.cost_center}</span> : <span style={{ color:'var(--text-muted)', fontSize:11 }}>—</span>}</td>
                      <td className="col-credit">{fmtAed(rec.credit)}</td>
                      <td className="col-act">
                        <button onClick={() => setModal({ type:'receipt', entry:rec })}
                          style={{ background:'#ECFDF5', border:'1px solid #6EE7B7', color:'#059669', borderRadius:7, padding:'4px 10px', fontSize:11.5, fontWeight:600, cursor:'pointer', fontFamily:'Poppins,sans-serif', marginRight:6 }}>
                          <Pencil size={10} style={{ display:'inline', marginRight:4 }}/>Edit
                        </button>
                        {isAdmin && (
                          <button onClick={() => handleDeleteRec(rec.id)}
                            style={{ background:'#FEF2F2', border:'1px solid #FCA5A5', color:'#EF4444', borderRadius:7, padding:'4px 8px', cursor:'pointer' }}>
                            <Trash2 size={10}/>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* ── BALANCE TAB ── */}
        {tab === 'balance' && (
          <div>
            {[
              { icon:<TrendingUp size={16} color="#FBBF24"/>,   label:'Total Invoiced (Grand Total)', value: fmtAed(totalGrand),   color:'var(--text)' },
              { icon:<ArrowDownLeft size={16} color="#22C55E"/>,label:'Total Receipts (Payments)',     value: fmtAed(totalReceipt), color:'#22C55E' },
            ].map((r, i) => (
              <div key={i} className="bal-row">
                <div className="bal-label">{r.icon} {r.label}</div>
                <div className="bal-val" style={{ color:r.color }}>{r.value}</div>
              </div>
            ))}
            {/* Divider */}
            <div style={{ margin:'0 20px', borderTop:'2px solid var(--border)' }}/>
            <div className="bal-row" style={{ paddingTop:16, paddingBottom:20 }}>
              <div className="bal-label" style={{ fontSize:15 }}>
                {balance <= 0
                  ? <><CheckCircle2 size={18} color="#22C55E"/> Outstanding Balance</>
                  : <><TrendingDown size={18} color="#EF4444"/> Outstanding Balance</>}
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:22, fontWeight:900, color: balance <= 0 ? '#22C55E' : '#EF4444', letterSpacing:'-0.02em' }}>
                  {fmtAed(Math.abs(balance))}
                </div>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:3, fontWeight:600 }}>
                  {balance < 0 ? 'Customer is in credit' : balance === 0 ? 'Fully settled' : 'Amount still due from customer'}
                </div>
              </div>
            </div>
            {/* Mini summary table */}
            {(invData?.count > 0 || recData?.count > 0) && (
              <div style={{ margin:'0 16px 16px', background:'var(--bg-alt)', borderRadius:12, padding:14, border:'1px solid var(--border)' }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
                  {[
                    { label:'Invoices',         value: String(invData?.count || 0), color:'#FBBF24' },
                    { label:'Invoice Amount',   value: fmtAed(invData?.total_amount || 0), color:'var(--text)' },
                    { label:'VAT',              value: fmtAed(invData?.total_vat || 0), color:'#60A5FA' },
                    { label:'Receipts',         value: String(recData?.count || 0), color:'#34D399' },
                    { label:'Total Received',   value: fmtAed(totalReceipt), color:'#22C55E' },
                    { label:'Balance',          value: fmtAed(Math.abs(balance)), color: balance <= 0 ? '#22C55E' : '#EF4444' },
                  ].map((s, i) => (
                    <div key={i} style={{ textAlign:'center' }}>
                      <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-muted)', marginBottom:4 }}>{s.label}</div>
                      <div style={{ fontSize:13, fontWeight:800, color:s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── LEDGER TAB ── */}
        {tab === 'ledger' && (
          <LedgerTab customer={customer}/>
        )}
      </div>

      {/* Entry modal */}
      {modal && (
        <EntryModal
          type={modal.type}
          customer={customer}
          entry={modal.entry}
          onSave={() => { setModal(null); load() }}
          onClose={() => setModal(null)}/>
      )}
    </div>
  )
}

/* ── Customer Modal ─────────────────────────────────────────── */
function CustomerModal({ customer, onSave, onClose }) {
  const isEdit = !!customer
  const [form, setForm] = useState(customer ? {
    name:            customer.name            || '',
    address:         customer.address         || '',
    trn_no:          customer.trn_no          || '',
    opening_balance: customer.opening_balance != null ? String(customer.opening_balance) : '',
    customer_type:   customer.customer_type   || 'sale_invoice',
    cost_center:     customer.cost_center     || '',
    ncod_rate:       customer.ncod_rate       != null ? String(customer.ncod_rate)       : '',
    cod_rate:        customer.cod_rate        != null ? String(customer.cod_rate)        : '',
    rp_rate:         customer.rp_rate         != null ? String(customer.rp_rate)         : '',
    pickup_rate:     customer.pickup_rate     != null ? String(customer.pickup_rate)     : '',
    ncod_inv_rate:   customer.ncod_inv_rate   != null ? String(customer.ncod_inv_rate)   : '',
    cod_inv_rate:    customer.cod_inv_rate    != null ? String(customer.cod_inv_rate)    : '',
    rp_inv_rate:     customer.rp_inv_rate     != null ? String(customer.rp_inv_rate)     : '',
    pickup_inv_rate: customer.pickup_inv_rate != null ? String(customer.pickup_inv_rate) : '',
    notes:           customer.notes           || '',
  } : { ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit() {
    if (!form.name.trim()) { setError('Customer name is required'); return }
    setSaving(true); setError('')
    try {
      const payload = {
        ...form,
        opening_balance:  form.opening_balance  !== '' ? parseFloat(form.opening_balance)  : 0,
        ncod_rate:        form.ncod_rate        !== '' ? parseFloat(form.ncod_rate)        : null,
        cod_rate:         form.cod_rate         !== '' ? parseFloat(form.cod_rate)         : null,
        rp_rate:          form.rp_rate          !== '' ? parseFloat(form.rp_rate)          : null,
        pickup_rate:      form.pickup_rate      !== '' ? parseFloat(form.pickup_rate)      : null,
        ncod_inv_rate:    form.ncod_inv_rate    !== '' ? parseFloat(form.ncod_inv_rate)    : null,
        cod_inv_rate:     form.cod_inv_rate     !== '' ? parseFloat(form.cod_inv_rate)     : null,
        rp_inv_rate:      form.rp_inv_rate      !== '' ? parseFloat(form.rp_inv_rate)      : null,
        pickup_inv_rate:  form.pickup_inv_rate  !== '' ? parseFloat(form.pickup_inv_rate)  : null,
      }
      if (isEdit) await customerApi.update(customer.id, payload)
      else        await customerApi.create(payload)
      onSave()
    } catch(e) { setError(e.message) }
    finally { setSaving(false) }
  }

  return createPortal(
    <div className="cust-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="cust-modal">
        <div className="cust-modal-header">
          <div style={{ width:36, height:36, borderRadius:10, background:'rgba(184,134,11,0.12)', border:'1px solid rgba(184,134,11,0.25)', display:'flex', alignItems:'center', justifyContent:'center', color:'#B8860B' }}>
            <Building2 size={18}/>
          </div>
          <div className="cust-modal-title">{isEdit ? 'Edit Customer' : 'Add New Customer'}</div>
          <button onClick={onClose} className="cust-modal-close"><X size={15}/></button>
        </div>
        <div className="cust-modal-body">
          {error && (
            <div style={{ background:'#FEF2F2', border:'1px solid #FCA5A5', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#DC2626', fontWeight:600 }}>{error}</div>
          )}
          <div>
            <div className="cust-section-label"><Building2 size={12}/> Company Details</div>
            <div className="cust-form-row" style={{ marginBottom:12 }}>
              <div className="cust-field" style={{ gridColumn:'span 2' }}>
                <label>Customer Name <span style={{ color:'#EF4444' }}>*</span></label>
                <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Noon Food LLC" className="cust-input"/>
              </div>
            </div>
            <div className="cust-form-row">
              <div className="cust-field" style={{ gridColumn:'span 2' }}>
                <label>Address</label>
                <input value={form.address} onChange={e => set('address', e.target.value)} placeholder="e.g. Boulevard Plaza, Downtown Dubai" className="cust-input"/>
              </div>
            </div>
            <div className="cust-form-row" style={{ marginTop:12 }}>
              <div className="cust-field">
                <label>TRN Number</label>
                <input value={form.trn_no} onChange={e => set('trn_no', e.target.value)} placeholder="e.g. 100435177900003" className="cust-input" style={{ fontFamily:'monospace' }}/>
              </div>
              <div className="cust-field">
                <label>Cost Center</label>
                <input value={form.cost_center} onChange={e => set('cost_center', e.target.value)} placeholder="e.g. JNT, DDB6, NOON" className="cust-input"/>
              </div>
            </div>
          </div>
          <div>
            <div className="cust-section-label"><Tag size={12}/> Classification</div>
            <div className="cust-form-row">
              <div className="cust-field">
                <label>Customer Type</label>
                <div className="cust-type-grid">
                  {Object.entries(TYPE_META).map(([k, m]) => (
                    <div key={k} className={`cust-type-opt${form.customer_type === k ? ' active' : ''}`} onClick={() => set('customer_type', k)}>
                      <span>{m.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="cust-field">
                <label>Opening Balance (AED)</label>
                <div className="cust-input-prefix">
                  <span>AED</span>
                  <input type="number" min="0" step="0.01" value={form.opening_balance} onChange={e => set('opening_balance', e.target.value)} placeholder="0.00" className="cust-input"/>
                </div>
                <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:4 }}>Starting balance for this customer</div>
              </div>
            </div>
          </div>
          <div>
            <div className="cust-section-label"><DollarSign size={12}/> Rate Card</div>
            <div style={{ background:'var(--bg-alt)', border:'1px solid var(--border)', borderRadius:12, padding:'14px 16px' }}>
              <div style={{ display:'grid', gridTemplateColumns:'80px 1fr 1fr', gap:'8px 12px', alignItems:'center', marginBottom:10 }}>
                <div/>
                <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-muted)', textAlign:'center' }}>Rate</div>
                <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-muted)', textAlign:'center' }}>Invoice Rate</div>
              </div>
              {[
                { key:'ncod_rate', ikey:'ncod_inv_rate', label:'NCOD' },
                { key:'cod_rate',  ikey:'cod_inv_rate',  label:'COD' },
                { key:'rp_rate',   ikey:'rp_inv_rate',   label:'RP' },
                { key:'pickup_rate', ikey:'pickup_inv_rate', label:'Pickup' },
              ].map(r => (
                <div key={r.key} style={{ display:'grid', gridTemplateColumns:'80px 1fr 1fr', gap:'8px 12px', alignItems:'center', marginBottom:8 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'var(--text)' }}>{r.label}</div>
                  <div className="cust-input-prefix">
                    <span>AED</span>
                    <input type="number" min="0" step="0.01" value={form[r.key]} onChange={e => set(r.key, e.target.value)} placeholder="0.00" className="cust-input"/>
                  </div>
                  <div className="cust-input-prefix">
                    <span>AED</span>
                    <input type="number" min="0" step="0.01" value={form[r.ikey]} onChange={e => set(r.ikey, e.target.value)} placeholder="0.00" className="cust-input"/>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="cust-section-label"><FileText size={12}/> Notes</div>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="Any additional notes about this customer…" className="cust-input" style={{ resize:'vertical', padding:'10px 11px' }}/>
          </div>
        </div>
        <div className="cust-modal-footer">
          <button onClick={onClose} className="cust-btn-cancel">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="cust-btn-save">
            {saving ? (isEdit ? 'Saving…' : 'Adding…') : (isEdit ? 'Save Changes' : 'Add Customer')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

/* ── Main Page ──────────────────────────────────────────────── */
export default function CustomersPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [customers,     setCustomers]     = useState([])
  const [loading,       setLoading]       = useState(true)
  const [modal,         setModal]         = useState(null)
  const [search,        setSearch]        = useState('')
  const [typeFilter,    setTypeFilter]    = useState('')
  const [drillCustomer, setDrillCustomer] = useState(null)

  async function load() {
    try { setCustomers((await customerApi.list()).customers || []) }
    catch(e) { console.error(e) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  async function handleDelete(id) {
    if (!confirm('Delete this customer? This cannot be undone.')) return
    try { await customerApi.delete(id); setCustomers(prev => prev.filter(c => c.id !== id)) }
    catch(e) { alert(e.message) }
  }

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    return customers.filter(c => {
      if (typeFilter && c.customer_type !== typeFilter) return false
      if (!s) return true
      return (
        c.name?.toLowerCase().includes(s) ||
        c.trn_no?.toLowerCase().includes(s) ||
        c.cost_center?.toLowerCase().includes(s) ||
        c.address?.toLowerCase().includes(s)
      )
    })
  }, [customers, search, typeFilter])

  const totalSale = customers.filter(c => c.customer_type === 'sale_invoice').length
  const totalPur  = customers.filter(c => c.customer_type === 'purchase_invoice').length
  const totalBoth = customers.filter(c => c.customer_type === 'both').length

  if (drillCustomer) {
    return (
      <>
        <style>{CSS}</style>
        <CustomerDetailView customer={drillCustomer} isAdmin={isAdmin} onBack={() => setDrillCustomer(null)}/>
      </>
    )
  }

  return (
    <>
      <style>{CSS}</style>

      <div className="cust-hero">
        <div className="cust-hero-top">
          <div className="cust-hero-icon"><Building2 size={20}/></div>
          <div>
            <div className="cust-hero-title">Customers</div>
            <div className="cust-hero-sub">Companies &amp; clients we receive payments from</div>
          </div>
          <button onClick={() => setModal('add')} className="cust-add-btn"><Plus size={15}/> Add Customer</button>
        </div>
        <div className="cust-kpi-grid">
          <div className="cust-kpi"><div className="cust-kpi-val" style={{ color:'#B8860B' }}>{customers.length}</div><div className="cust-kpi-label">Total</div></div>
          <div className="cust-kpi"><div className="cust-kpi-val" style={{ color:'#3B82F6' }}>{totalSale}</div><div className="cust-kpi-label">Sale Invoice</div></div>
          <div className="cust-kpi"><div className="cust-kpi-val" style={{ color:'#8B5CF6' }}>{totalPur}</div><div className="cust-kpi-label">Purchase Invoice</div></div>
          <div className="cust-kpi"><div className="cust-kpi-val" style={{ color:'#F59E0B' }}>{totalBoth}</div><div className="cust-kpi-label">Both Types</div></div>
        </div>
      </div>

      <div className="cust-toolbar">
        <div className="cust-search-wrap">
          <Search size={14} style={{ color:'var(--text-muted)', flexShrink:0 }}/>
          <input className="cust-search-input" placeholder="Search by name, TRN, cost center…" value={search} onChange={e => setSearch(e.target.value)}/>
          {search && <button onClick={() => setSearch('')} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', display:'flex' }}><X size={13}/></button>}
        </div>
        <select className="cust-filter-sel" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">All Types</option>
          <option value="sale_invoice">Sale Invoice</option>
          <option value="purchase_invoice">Purchase Invoice</option>
          <option value="both">Both</option>
        </select>
      </div>

      {loading ? (
        <div className="cust-grid">
          {[1,2,3,4].map(i => <div key={i} className="cust-skel" style={{ height:220, opacity:1-(i-1)*0.12 }}/>)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'70px 20px', color:'var(--text-muted)' }}>
          <div style={{ width:64, height:64, borderRadius:'50%', background:'var(--card)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
            <Building2 size={28} style={{ opacity:0.25 }}/>
          </div>
          <div style={{ fontWeight:700, fontSize:15, color:'var(--text)', marginBottom:6 }}>
            {search || typeFilter ? 'No customers match your search' : 'No customers yet'}
          </div>
          <div style={{ fontSize:13, marginBottom:20 }}>{search || typeFilter ? 'Try adjusting your filters' : 'Add your first customer to get started.'}</div>
          {!search && !typeFilter && (
            <button onClick={() => setModal('add')}
              style={{ padding:'10px 24px', borderRadius:10, border:'none', background:'#B8860B', color:'white', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'Poppins,sans-serif' }}>
              <Plus size={13} style={{ display:'inline', marginRight:6, verticalAlign:'middle' }}/> Add Customer
            </button>
          )}
        </div>
      ) : (
        <div className="cust-grid">
          {filtered.map(c => {
            const typeMeta = TYPE_META[c.customer_type] || TYPE_META.sale_invoice
            const hasRates = [c.ncod_rate, c.cod_rate, c.rp_rate, c.pickup_rate].some(r => r != null)
            return (
              <div key={c.id} className="cust-card">
                <div className="cust-card-header">
                  <div className="cust-avatar">{initials(c.name)}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div className="cust-name">{c.name}</div>
                    {c.trn_no && <div className="cust-trn">TRN: {c.trn_no}</div>}
                  </div>
                  <div className="cust-badges">
                    <span className="cust-badge" style={{ background:typeMeta.bg, borderColor:typeMeta.border, color:typeMeta.color }}>{typeMeta.label}</span>
                    {c.cost_center && <span className="cust-badge" style={{ background:'var(--bg-alt)', borderColor:'var(--border)', color:'var(--text-muted)' }}><Hash size={9}/> {c.cost_center}</span>}
                  </div>
                </div>
                <div className="cust-card-body">
                  {c.address && <div className="cust-meta"><MapPin size={11} className="cust-meta-icon" style={{ color:'var(--text-muted)' }}/><span>{c.address}</span></div>}
                  {c.opening_balance != null && parseFloat(c.opening_balance) !== 0 && (
                    <div className="cust-meta">
                      <DollarSign size={11} className="cust-meta-icon" style={{ color:'#B8860B' }}/>
                      <span>Opening Balance: <strong style={{ color:'var(--text)' }}>AED {fmtNum(c.opening_balance)}</strong></span>
                    </div>
                  )}
                  {hasRates && (
                    <div className="cust-rates">
                      <RateCell label="NCOD"   value={c.ncod_rate}/>
                      <RateCell label="COD"    value={c.cod_rate}/>
                      <RateCell label="RP"     value={c.rp_rate}/>
                      <RateCell label="Pickup" value={c.pickup_rate}/>
                    </div>
                  )}
                  {c.notes && <div style={{ fontSize:11.5, color:'var(--text-muted)', fontStyle:'italic', borderLeft:'2px solid var(--border)', paddingLeft:8 }}>{c.notes}</div>}
                </div>
                <div className="cust-card-actions">
                  <button onClick={() => setDrillCustomer(c)} className="cust-btn cust-btn-view">
                    <FileSpreadsheet size={11}/> View
                  </button>
                  <button onClick={() => setModal(c)} className="cust-btn cust-btn-edit">
                    <Pencil size={11}/> Edit
                  </button>
                  {isAdmin && <button onClick={() => handleDelete(c.id)} className="cust-btn cust-btn-del"><Trash2 size={11}/></button>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal && <CustomerModal customer={modal === 'add' ? null : modal} onSave={() => { setModal(null); load() }} onClose={() => setModal(null)}/>}
    </>
  )
}
