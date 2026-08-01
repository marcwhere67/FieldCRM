// Accounting export shapes: Xero sales invoices, MYOB sales, and a BAS GST
// summary (SPEC.md §3).
//
// Money is in dollars (the current storage form). GST is 10%. A line is GST when
// its tax_rate > 0; Salt Air runs tax_rate 0, so its lines export as GST-free —
// correct for a non-registered supplier.
//
// BASIS: the BAS summary is computed on an ACCRUAL basis (by invoice issue date),
// because that's what invoice data supports cleanly. Documented in DECISIONS.md
// (D-006) and labelled in the export so an accountant knows which basis to file.
import { money2 } from './csv'

export interface ExportLineItem {
  description?: string
  quantity?: number
  unit_price?: number
  tax_rate?: number
}

export interface ExportContact {
  first_name?: string | null
  last_name?: string | null
  company_name?: string | null
}

export interface ExportInvoice {
  invoice_number: string
  created_at: string // issue date (ISO)
  due_date: string | null
  status: string
  subtotal: number
  tax: number
  total: number
  contact: ExportContact | null
  line_items: ExportLineItem[]
}

export interface ExportExpense {
  expense_date: string
  category: string | null
  description: string | null
  amount: number
  tax_included: boolean
}

/** Buyer identity: company if present, else person name, else a placeholder. */
export function contactName(contact: ExportContact | null): string {
  if (!contact) return 'Unknown customer'
  if (contact.company_name?.trim()) return contact.company_name.trim()
  const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim()
  return name || 'Unknown customer'
}

/** YYYY-MM-DD from an ISO timestamp (date part only). */
function dateOnly(iso: string): string {
  return iso.slice(0, 10)
}

// ---- Xero: Sales Invoices import (one row per line item) --------------------

export interface XeroRow extends Record<string, string> {
  ContactName: string
  InvoiceNumber: string
  InvoiceDate: string
  DueDate: string
  Description: string
  Quantity: string
  UnitAmount: string
  AccountCode: string
  TaxType: string
}

export const XERO_COLUMNS: (keyof XeroRow & string)[] = [
  'ContactName', 'InvoiceNumber', 'InvoiceDate', 'DueDate',
  'Description', 'Quantity', 'UnitAmount', 'AccountCode', 'TaxType',
]

export function xeroInvoiceRows(invoices: ExportInvoice[], salesAccountCode = '200'): XeroRow[] {
  const rows: XeroRow[] = []
  for (const inv of invoices) {
    const items = inv.line_items.length > 0 ? inv.line_items : [{ description: 'Services', quantity: 1, unit_price: inv.total, tax_rate: inv.tax > 0 ? 10 : 0 }]
    for (const li of items) {
      const gst = (li.tax_rate ?? 0) > 0
      rows.push({
        ContactName: contactName(inv.contact),
        InvoiceNumber: inv.invoice_number,
        InvoiceDate: dateOnly(inv.created_at),
        DueDate: inv.due_date ? dateOnly(inv.due_date) : '',
        Description: li.description?.trim() || 'Services',
        Quantity: String(li.quantity ?? 1),
        UnitAmount: money2(li.unit_price ?? 0),
        AccountCode: salesAccountCode,
        // Xero's standard AU tax type codes.
        TaxType: gst ? 'OUTPUT' : 'EXEMPTOUTPUT',
      })
    }
  }
  return rows
}

// ---- MYOB: Sales (one row per invoice) --------------------------------------

export interface MyobRow extends Record<string, string> {
  'Co./Last Name': string
  'Invoice No.': string
  'Date': string
  'Customer PO': string
  'Description': string
  'Amount': string
  'Tax Amount': string
  'Tax Code': string
}

export const MYOB_COLUMNS: (keyof MyobRow & string)[] = [
  'Co./Last Name', 'Invoice No.', 'Date', 'Customer PO',
  'Description', 'Amount', 'Tax Amount', 'Tax Code',
]

export function myobInvoiceRows(invoices: ExportInvoice[]): MyobRow[] {
  return invoices.map((inv) => ({
    'Co./Last Name': contactName(inv.contact),
    'Invoice No.': inv.invoice_number,
    'Date': dateOnly(inv.created_at),
    'Customer PO': '',
    'Description': inv.line_items.map((li) => li.description?.trim()).filter(Boolean).join('; ') || 'Services',
    // MYOB "Amount" is the tax-inclusive total; "Tax Amount" the GST component.
    'Amount': money2(inv.total),
    'Tax Amount': money2(inv.tax),
    'Tax Code': inv.tax > 0 ? 'GST' : 'FRE',
  }))
}

// ---- BAS GST summary --------------------------------------------------------

export interface BasSummary {
  from: string
  to: string
  basis: 'accrual'
  invoiceCount: number
  expenseCount: number
  /** G1 — total sales (inc GST), dollars. */
  totalSales: number
  /** 1A — GST on sales collected, dollars. */
  gstOnSales: number
  /** G11 — total purchases (inc GST), dollars. */
  totalPurchases: number
  /** 1B — GST on purchases (credits), dollars. */
  gstOnPurchases: number
  /** Net GST = 1A − 1B. Positive = payable to the ATO, negative = refund. */
  netGst: number
}

/**
 * GST component of a GST-inclusive amount: total / 11 (10% GST). Only applies
 * when the expense was recorded as tax-inclusive.
 */
export function gstComponentInclusive(amountIncGst: number): number {
  return Math.round((amountIncGst / 11) * 100) / 100
}

export function basSummary(
  invoices: ExportInvoice[],
  expenses: ExportExpense[],
  range: { from: string; to: string },
): BasSummary {
  const totalSales = invoices.reduce((s, i) => s + i.total, 0)
  const gstOnSales = invoices.reduce((s, i) => s + i.tax, 0)
  const totalPurchases = expenses.reduce((s, e) => s + e.amount, 0)
  const gstOnPurchases = expenses.reduce(
    (s, e) => s + (e.tax_included ? gstComponentInclusive(e.amount) : 0),
    0,
  )
  const round = (n: number) => Math.round(n * 100) / 100
  return {
    from: range.from,
    to: range.to,
    basis: 'accrual',
    invoiceCount: invoices.length,
    expenseCount: expenses.length,
    totalSales: round(totalSales),
    gstOnSales: round(gstOnSales),
    totalPurchases: round(totalPurchases),
    gstOnPurchases: round(gstOnPurchases),
    netGst: round(gstOnSales - gstOnPurchases),
  }
}

/** BAS summary as labelled two-column rows for CSV. */
export interface BasRow extends Record<string, string> {
  Label: string
  Value: string
}

export const BAS_COLUMNS: (keyof BasRow & string)[] = ['Label', 'Value']

export function basSummaryRows(s: BasSummary): BasRow[] {
  return [
    { Label: 'Period from', Value: s.from },
    { Label: 'Period to', Value: s.to },
    { Label: 'Basis', Value: 'Accrual (invoice date)' },
    { Label: 'Invoices in period', Value: String(s.invoiceCount) },
    { Label: 'Expenses in period', Value: String(s.expenseCount) },
    { Label: 'G1 Total sales (inc GST)', Value: money2(s.totalSales) },
    { Label: '1A GST on sales', Value: money2(s.gstOnSales) },
    { Label: 'G11 Total purchases (inc GST)', Value: money2(s.totalPurchases) },
    { Label: '1B GST on purchases', Value: money2(s.gstOnPurchases) },
    { Label: 'Net GST (1A - 1B)', Value: money2(s.netGst) },
  ]
}
