import { formatCurrency } from '@/lib/format'
import { paragraphsHtml, shellHtml, signoffText, type EmailShell } from '@/lib/emails/shell'

// Invoice + receipt emails. Same model as quote-email.ts: the editable part is
// the plain-text `message`; the branded shell, amount-due line, bank-transfer
// block and sign-off are fixed and added at send time.

export type { EmailShell }

// ---------------- Invoice ----------------

export function defaultInvoiceSubject(firstName: string | undefined, orgName: string, invoiceNumber: string): string {
  return firstName
    ? `${firstName}, your invoice from ${orgName} (${invoiceNumber})`
    : `Your invoice from ${orgName} (${invoiceNumber})`
}

export function defaultInvoiceMessage(firstName: string | undefined, orgName: string): string {
  return `Hi ${firstName || 'there'},\n\nThank you for choosing ${orgName}. Please find your invoice for the completed work attached.`
}

export function buildInvoiceEmail(opts: {
  message: string
  shell: EmailShell
  balanceDue: number
  dueText: string | null
  bankHtml: string
  bankText: string
}): { html: string; text: string } {
  const { message, shell, balanceDue, dueText, bankHtml, bankText } = opts
  const balanceFormatted = formatCurrency(balanceDue)
  const amountLine = `<p><strong>Amount due: ${balanceFormatted}</strong>${dueText ? `<br><strong>Due: ${dueText}</strong>` : ''}</p>`
  const closing = `<p>Please use your invoice number as the payment reference. If you have any questions, feel free to call or reply to this email.</p>`

  const html = shellHtml(shell, `${paragraphsHtml(message)}\n    ${amountLine}\n    ${bankHtml}\n    ${closing}`)
  const text = `${message.trim()}\n\nAmount due: ${balanceFormatted}${dueText ? `\nDue: ${dueText}` : ''}\n${bankText}\n\nPlease use your invoice number as the payment reference. If you have any questions, feel free to call or reply to this email.\n\n${signoffText(shell)}`
  return { html, text }
}

// ---------------- Receipt (sent when a payment is recorded) ----------------

export function defaultReceiptSubject(orgName: string, receiptNumber: string): string {
  return `Receipt ${receiptNumber} from ${orgName}`
}

// Receipt-number is assigned by the DB trigger on insert, so it's unknown when
// this default is shown in the Record Payment modal — the number lives on the
// attached PDF instead, so the prose just says "your receipt is attached".
export function defaultReceiptMessage(opts: {
  firstName: string | undefined
  paidLine: string
  invoiceNumber: string
}): string {
  const { firstName, paidLine, invoiceNumber } = opts
  return `Hi ${firstName || 'there'},\n\nThank you — we've received your payment of ${paidLine} for invoice ${invoiceNumber}. Your receipt is attached.`
}

export function buildReceiptEmail(opts: {
  message: string
  shell: EmailShell
  balanceHtml: string
  balanceText: string
}): { html: string; text: string } {
  const { message, shell, balanceHtml, balanceText } = opts
  const html = shellHtml(shell, `${paragraphsHtml(message)}\n    ${balanceHtml}`)
  const text = `${message.trim()}\n${balanceText}\n\n${signoffText(shell)}`
  return { html, text }
}
