import { describe, it, expect } from 'vitest'
import {
  contactName,
  xeroInvoiceRows,
  myobInvoiceRows,
  basSummary,
  basSummaryRows,
  gstComponentInclusive,
  type ExportInvoice,
  type ExportExpense,
} from './accounting'

const gstInvoice: ExportInvoice = {
  invoice_number: 'INV-0128',
  created_at: '2026-07-15T02:00:00.000Z',
  due_date: '2026-07-29T00:00:00.000Z',
  status: 'sent',
  subtotal: 500,
  tax: 50,
  total: 550,
  contact: { first_name: 'Emily', last_name: 'Chen', company_name: null },
  line_items: [{ description: 'Deep clean', quantity: 1, unit_price: 500, tax_rate: 10 }],
}

// Salt Air: not GST-registered, tax_rate 0.
const gstFreeInvoice: ExportInvoice = {
  invoice_number: 'INV-0129',
  created_at: '2026-07-16T02:00:00.000Z',
  due_date: null,
  status: 'sent',
  subtotal: 300,
  tax: 0,
  total: 300,
  contact: { first_name: 'Marcus', last_name: 'Thompson', company_name: 'Thompson Pty Ltd' },
  line_items: [{ description: 'Regular clean', quantity: 2, unit_price: 150, tax_rate: 0 }],
}

describe('contactName', () => {
  it('prefers company, then person, then a placeholder', () => {
    expect(contactName({ company_name: 'Acme Pty Ltd', first_name: 'A', last_name: 'B' })).toBe('Acme Pty Ltd')
    expect(contactName({ first_name: 'Emily', last_name: 'Chen' })).toBe('Emily Chen')
    expect(contactName(null)).toBe('Unknown customer')
    expect(contactName({})).toBe('Unknown customer')
  })
})

describe('xeroInvoiceRows', () => {
  it('emits one row per line item with the right tax type', () => {
    const rows = xeroInvoiceRows([gstInvoice])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      ContactName: 'Emily Chen',
      InvoiceNumber: 'INV-0128',
      InvoiceDate: '2026-07-15',
      DueDate: '2026-07-29',
      Description: 'Deep clean',
      Quantity: '1',
      UnitAmount: '500.00',
      TaxType: 'OUTPUT',
    })
  })

  it('marks tax-free lines as EXEMPTOUTPUT (Salt Air case)', () => {
    const rows = xeroInvoiceRows([gstFreeInvoice])
    expect(rows[0].TaxType).toBe('EXEMPTOUTPUT')
    expect(rows[0].ContactName).toBe('Thompson Pty Ltd') // company wins
  })

  it('synthesises a single line when an invoice has none', () => {
    const rows = xeroInvoiceRows([{ ...gstInvoice, line_items: [] }])
    expect(rows).toHaveLength(1)
    expect(rows[0].UnitAmount).toBe('550.00')
  })
})

describe('myobInvoiceRows', () => {
  it('emits one row per invoice, tax-inclusive amount', () => {
    const rows = myobInvoiceRows([gstInvoice, gstFreeInvoice])
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      'Co./Last Name': 'Emily Chen',
      'Invoice No.': 'INV-0128',
      'Amount': '550.00',
      'Tax Amount': '50.00',
      'Tax Code': 'GST',
    })
    expect(rows[1]['Tax Code']).toBe('FRE')
  })
})

describe('gstComponentInclusive', () => {
  it('extracts 1/11 of a GST-inclusive amount', () => {
    expect(gstComponentInclusive(110)).toBe(10)
    expect(gstComponentInclusive(55)).toBe(5)
    expect(gstComponentInclusive(100)).toBe(9.09)
  })
})

describe('basSummary', () => {
  const expenses: ExportExpense[] = [
    { expense_date: '2026-07-10', category: 'Materials', description: 'Chemicals', amount: 110, tax_included: true },
    { expense_date: '2026-07-12', category: 'Materials', description: 'Cash sundry', amount: 50, tax_included: false },
  ]

  it('computes G1/1A/G11/1B and net GST', () => {
    const s = basSummary([gstInvoice, gstFreeInvoice], expenses, { from: '2026-07-01', to: '2026-07-31' })
    expect(s.totalSales).toBe(850) // 550 + 300
    expect(s.gstOnSales).toBe(50) // 50 + 0
    expect(s.totalPurchases).toBe(160) // 110 + 50
    expect(s.gstOnPurchases).toBe(10) // 110/11, the non-inclusive one contributes 0
    expect(s.netGst).toBe(40) // 50 - 10
    expect(s.basis).toBe('accrual')
  })

  it('is all zeros for a non-registered supplier with no GST', () => {
    const s = basSummary([gstFreeInvoice], [], { from: '2026-07-01', to: '2026-07-31' })
    expect(s.gstOnSales).toBe(0)
    expect(s.netGst).toBe(0)
    expect(s.totalSales).toBe(300)
  })

  it('renders labelled BAS rows', () => {
    const s = basSummary([gstInvoice], [], { from: '2026-07-01', to: '2026-07-31' })
    const rows = basSummaryRows(s)
    const byLabel = Object.fromEntries(rows.map((r) => [r.Label, r.Value]))
    expect(byLabel['1A GST on sales']).toBe('50.00')
    expect(byLabel['Net GST (1A - 1B)']).toBe('50.00')
    expect(byLabel['Basis']).toBe('Accrual (invoice date)')
  })
})
