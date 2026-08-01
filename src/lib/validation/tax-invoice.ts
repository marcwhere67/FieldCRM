// Australian tax-invoice compliance (SPEC.md §3).
//
// A GST tax invoice for a sale of more than $82.50 (inc GST) must show:
//   - the words "Tax Invoice"                 (rendered by the PDF when tax > 0)
//   - the supplier's identity                 (org name)
//   - the supplier's ABN                      (checksum-valid)
//   - the date the invoice was issued
//   - a description of the items sold         (at least one described line)
//   - the GST amount, or a statement that the total includes GST  (the tax line)
//   - for sales of $1,000 or more: the buyer's identity or ABN
//
// This validator BLOCKS sending a non-compliant tax invoice. It also flags the
// no-ABN withholding risk on a plain (non-GST) invoice.
//
// Salt Air is not GST-registered, so its invoices carry tax = 0 and are plain
// "invoices", not "tax invoices" — the tax-invoice rules below don't fire for
// them, which is correct: a non-registered supplier must NOT issue a tax invoice.
import { isValidAbn } from './abn'

// Below this (inc GST) a supplier isn't obliged to issue a tax invoice at all.
export const TAX_INVOICE_THRESHOLD_DOLLARS = 82.5
// At/above this, a tax invoice must also identify the buyer.
export const BUYER_IDENTITY_THRESHOLD_DOLLARS = 1000

export interface TaxInvoiceInput {
  /** Total in dollars, inc GST. */
  total: number
  /** GST component in dollars. tax > 0 means this is a tax invoice. */
  tax: number
  supplierName: string | null
  supplierAbn: string | null
  /** Issue date — any truthy date string. */
  issueDate: string | null
  /** Line items array; we check at least one has a non-empty description. */
  lineItems: unknown
  buyerName: string | null
  buyerAbn: string | null
}

export interface TaxInvoiceResult {
  /** GST is being charged, so tax-invoice rules apply. */
  isTaxInvoice: boolean
  /** True when there are no blocking issues — safe to send. */
  compliant: boolean
  /** Must be fixed before the invoice can be sent. */
  blockingIssues: string[]
  /** Non-blocking advisories (e.g. no-ABN withholding). */
  warnings: string[]
}

/** Cents-safe: avoids 82.5 float edge cases. */
function toCents(dollars: number): number {
  return Math.round(dollars * 100)
}

function hasDescribedLineItem(lineItems: unknown): boolean {
  if (!Array.isArray(lineItems)) return false
  return lineItems.some(
    (li) =>
      li != null &&
      typeof li === 'object' &&
      typeof (li as { description?: unknown }).description === 'string' &&
      (li as { description: string }).description.trim().length > 0,
  )
}

export function validateTaxInvoice(input: TaxInvoiceInput): TaxInvoiceResult {
  const blockingIssues: string[] = []
  const warnings: string[] = []

  const isTaxInvoice = input.tax > 0
  const totalCents = toCents(input.total)
  const supplierAbnValid = isValidAbn(input.supplierAbn ?? '')

  if (isTaxInvoice) {
    // Charging GST without a valid ABN isn't allowed — only GST-registered
    // businesses (which have an ABN) may issue a tax invoice.
    if (!supplierAbnValid) {
      blockingIssues.push(
        'GST is being charged but the business has no valid ABN. Only a GST-registered business with an ABN can issue a tax invoice. Add your ABN in Settings → Business, or set the tax rate to 0.',
      )
    }

    // Full tax-invoice requirements apply above the $82.50 threshold.
    if (totalCents > toCents(TAX_INVOICE_THRESHOLD_DOLLARS)) {
      if (!input.supplierName?.trim()) {
        blockingIssues.push('Add your business name in Settings → Business before sending a tax invoice.')
      }
      if (!input.issueDate) {
        blockingIssues.push('This invoice has no issue date.')
      }
      if (!hasDescribedLineItem(input.lineItems)) {
        blockingIssues.push('Add at least one line item with a description.')
      }
      // The GST amount is shown structurally by the PDF/email tax line when
      // tax > 0, so that requirement is satisfied here.

      if (totalCents >= toCents(BUYER_IDENTITY_THRESHOLD_DOLLARS)) {
        const buyerIdentified = Boolean(input.buyerName?.trim()) || isValidAbn(input.buyerAbn ?? '')
        if (!buyerIdentified) {
          blockingIssues.push(
            "For invoices of $1,000 or more, include the customer's name or ABN. Add it to the contact.",
          )
        }
      }
    }
  } else {
    // Plain invoice (no GST). If the supplier has no ABN, business customers may
    // be required to withhold 47% under the no-ABN withholding rules.
    if (!supplierAbnValid) {
      warnings.push(
        'This invoice shows no ABN. Business customers may be required to withhold 47% of the payment under no-ABN withholding rules. Add your ABN in Settings → Business.',
      )
    }
  }

  return {
    isTaxInvoice,
    compliant: blockingIssues.length === 0,
    blockingIssues,
    warnings,
  }
}
