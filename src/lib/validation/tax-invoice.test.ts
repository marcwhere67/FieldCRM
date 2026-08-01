import { describe, it, expect } from 'vitest'
import { validateTaxInvoice, type TaxInvoiceInput } from './tax-invoice'

// A valid, GST-registered supplier baseline. Individual tests override fields.
const VALID_ABN = '51 824 753 556'
const base: TaxInvoiceInput = {
  total: 550,
  tax: 50,
  supplierName: 'Salt Air Cleaning',
  supplierAbn: VALID_ABN,
  issueDate: '2026-07-31',
  lineItems: [{ description: 'Deep clean', quantity: 1, unit_price: 500 }],
  buyerName: 'Emily Chen',
  buyerAbn: null,
}

describe('validateTaxInvoice — compliant tax invoice', () => {
  it('passes a fully-formed GST invoice', () => {
    const r = validateTaxInvoice(base)
    expect(r.isTaxInvoice).toBe(true)
    expect(r.compliant).toBe(true)
    expect(r.blockingIssues).toEqual([])
  })
})

describe('GST without a valid ABN is blocked', () => {
  it('blocks when the supplier ABN is missing', () => {
    const r = validateTaxInvoice({ ...base, supplierAbn: null })
    expect(r.compliant).toBe(false)
    expect(r.blockingIssues.join(' ')).toMatch(/no valid ABN/i)
  })

  it('blocks when the supplier ABN fails the checksum', () => {
    const r = validateTaxInvoice({ ...base, supplierAbn: '51 824 753 557' })
    expect(r.compliant).toBe(false)
    expect(r.blockingIssues.join(' ')).toMatch(/ABN/i)
  })
})

describe('required tax-invoice fields above $82.50', () => {
  it('blocks a missing supplier name', () => {
    const r = validateTaxInvoice({ ...base, supplierName: '   ' })
    expect(r.compliant).toBe(false)
    expect(r.blockingIssues.join(' ')).toMatch(/business name/i)
  })

  it('blocks a missing issue date', () => {
    const r = validateTaxInvoice({ ...base, issueDate: null })
    expect(r.compliant).toBe(false)
    expect(r.blockingIssues.join(' ')).toMatch(/issue date/i)
  })

  it('blocks when no line item has a description', () => {
    const r = validateTaxInvoice({ ...base, lineItems: [{ quantity: 1, unit_price: 500 }] })
    expect(r.compliant).toBe(false)
    expect(r.blockingIssues.join(' ')).toMatch(/description/i)
  })

  it('blocks when line items are not an array', () => {
    const r = validateTaxInvoice({ ...base, lineItems: null })
    expect(r.compliant).toBe(false)
  })
})

describe('$82.50 threshold', () => {
  it('does not require the full field set at or below $82.50', () => {
    // A tiny GST sale with no name/date/description is still allowed to send:
    // below the threshold a tax invoice is not obligatory. The only bar is a
    // valid ABN because GST is being charged.
    const r = validateTaxInvoice({
      total: 82.5,
      tax: 7.5,
      supplierName: null,
      supplierAbn: VALID_ABN,
      issueDate: null,
      lineItems: [],
      buyerName: null,
      buyerAbn: null,
    })
    expect(r.compliant).toBe(true)
  })

  it('requires the full field set just above $82.50', () => {
    const r = validateTaxInvoice({
      total: 82.51,
      tax: 7.5,
      supplierName: null,
      supplierAbn: VALID_ABN,
      issueDate: null,
      lineItems: [],
      buyerName: null,
      buyerAbn: null,
    })
    expect(r.compliant).toBe(false)
    expect(r.blockingIssues.length).toBeGreaterThan(0)
  })
})

describe('$1,000 buyer-identity rule', () => {
  it('requires the buyer identity at exactly $1,000', () => {
    const r = validateTaxInvoice({ ...base, total: 1000, tax: 90, buyerName: null, buyerAbn: null })
    expect(r.compliant).toBe(false)
    expect(r.blockingIssues.join(' ')).toMatch(/\$1,000 or more/i)
  })

  it('accepts a buyer name at $1,000+', () => {
    const r = validateTaxInvoice({ ...base, total: 1000, tax: 90, buyerName: 'Acme Pty Ltd', buyerAbn: null })
    expect(r.compliant).toBe(true)
  })

  it('accepts a buyer ABN in lieu of a name at $1,000+', () => {
    const r = validateTaxInvoice({ ...base, total: 1000, tax: 90, buyerName: null, buyerAbn: '88 000 014 675' })
    expect(r.compliant).toBe(true)
  })

  it('does not require buyer identity just under $1,000', () => {
    const r = validateTaxInvoice({ ...base, total: 999.99, tax: 90, buyerName: null, buyerAbn: null })
    expect(r.compliant).toBe(true)
  })
})

describe('plain (non-GST) invoice — Salt Air case', () => {
  it('is compliant with tax = 0 and a valid ABN, no tax-invoice rules applied', () => {
    const r = validateTaxInvoice({ ...base, tax: 0, total: 500 })
    expect(r.isTaxInvoice).toBe(false)
    expect(r.compliant).toBe(true)
    expect(r.warnings).toEqual([])
  })

  it('warns (but does not block) about no-ABN withholding when there is no ABN', () => {
    const r = validateTaxInvoice({ ...base, tax: 0, total: 500, supplierAbn: null })
    expect(r.isTaxInvoice).toBe(false)
    expect(r.compliant).toBe(true)
    expect(r.warnings.join(' ')).toMatch(/withhold/i)
  })
})
