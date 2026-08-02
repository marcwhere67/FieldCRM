import { formatCurrency } from '@/lib/format'
import { esc, paragraphsHtml, shellHtml, signoffText, ctaButton, amountPanel, type EmailShell } from '@/lib/emails/shell'

// Single source of truth for quote emails, shared by the send routes (default
// content) and the "Review & send" draft preview so the two never drift.
// The editable part is the plain-text `message` (the personal prose). The
// branded shell — logo header, quote summary / approve buttons, sign-off — is
// added automatically at send time and is NOT user-editable.

export type { EmailShell }

// ---------------- Single quote ----------------

export function defaultQuoteSubject(firstName: string | undefined, orgName: string, quoteNumber: string): string {
  return firstName
    ? `${firstName}, your quote from ${orgName} (${quoteNumber})`
    : `Your quote from ${orgName} (${quoteNumber})`
}

export function defaultQuoteMessage(firstName: string | undefined, orgName: string): string {
  return `Hi ${firstName || 'there'},\n\nThank you for your enquiry with ${orgName}. Please find your quote for the discussed work attached.`
}

export function buildQuoteEmail(opts: { message: string; shell: EmailShell; total: number; approvalUrl: string }): { html: string; text: string } {
  const { message, shell, total, approvalUrl } = opts
  const totalFmt = formatCurrency(total)
  const cta = `${amountPanel('Quote Total', totalFmt)}
    ${ctaButton(approvalUrl, 'View & Approve Quote')}
    <p style="margin:0 0 16px;font-size:12px;color:#8A9BA6;">Before accepting, please take a moment to review the quote details and our Terms &amp; Conditions, included with the attached PDF and shown on the approval page above.</p>`
  const closing = `<p style="margin:0 0 16px;">This quote is valid for 14 days. If you'd like to proceed, click the button above. For any questions, feel free to call or reply to this email.</p>`
  const html = shellHtml(shell, `${paragraphsHtml(message)}\n    ${cta}\n    ${closing}`)
  const text = `${message.trim()}\n\nQuote Total: ${totalFmt}\n\nView & Approve: ${approvalUrl}\n\nBefore accepting, please take a moment to review the quote details and our Terms & Conditions, included with the attached PDF and shown on the approval page above.\n\nThis quote is valid for 14 days. If you'd like to proceed, click the link above. For any questions, feel free to call or reply to this email.\n\n${signoffText(shell)}`
  return { html, text }
}

// ---------------- Multi-quote batch ----------------

export function defaultBatchSubject(firstName: string | undefined, orgName: string): string {
  return firstName ? `${firstName}, your cleaning quotes from ${orgName}` : `Your cleaning quotes from ${orgName}`
}

export function defaultBatchMessage(firstName: string | undefined, orgName: string): string {
  return `Hi ${firstName || 'there'},\n\nThank you for choosing ${orgName} — we're looking forward to looking after your home.\n\nFor new regular clients, our protocol starts off with a one-off deep clean before your ongoing service begins. It brings the whole home up to our standard from day one and makes every regular clean afterwards more thorough and more consistent. From there, your recurring visits keep everything in top condition with minimal fuss.`
}

export function buildBatchEmail(opts: {
  message: string
  shell: EmailShell
  quotes: { id: string; quote_number: string; total: number }[]
  siteUrl: string
}): { html: string; text: string } {
  const { message, shell, quotes, siteUrl } = opts
  const quotesWord = quotes.length === 2 ? 'both quotes' : 'the quotes'
  const rowsHtml = quotes.map((q, i) => `<tr>
        <td style="padding:12px 4px;background-color:${i % 2 === 0 ? '#ffffff' : '#F5F0EB'};border-bottom:1px solid rgba(44,62,80,0.10);font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1C2A35;">${esc(q.quote_number)}</td>
        <td style="padding:12px 4px;background-color:${i % 2 === 0 ? '#ffffff' : '#F5F0EB'};border-bottom:1px solid rgba(44,62,80,0.10);text-align:right;font-family:Georgia,'Times New Roman',serif;font-size:16px;color:#2C3E50;">${formatCurrency(Number(q.total))}</td>
        <td style="padding:12px 4px;background-color:${i % 2 === 0 ? '#ffffff' : '#F5F0EB'};border-bottom:1px solid rgba(44,62,80,0.10);text-align:right;">
          <a href="${siteUrl}/quote-approval/${q.id}" style="color:#76A58F;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;text-decoration:none;">View &amp; Approve →</a>
        </td>
      </tr>`).join('\n      ')
  const rowsText = quotes.map(q => `${q.quote_number} — ${formatCurrency(Number(q.total))} — View & Approve: ${siteUrl}/quote-approval/${q.id}`).join('\n')

  const summaryLine = `<p style="margin:0 0 16px;">You'll find ${quotesWord} attached and summarised below — the initial deep clean and your ongoing regular service:</p>`
  const table = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;border:1px solid rgba(44,62,80,0.10);">
      ${rowsHtml}
    </table>`
  const tcNote = `<p style="margin:0 0 16px;font-size:12px;color:#8A9BA6;">Before accepting, please take a moment to review each quote and our Terms &amp; Conditions, included with the attached PDFs and shown on the approval pages.</p>`
  const closing = `<p style="margin:0 0 16px;">Each quote is valid for 14 days from when it was issued. Just click through to approve, and we'll take care of the rest. If you have any questions or would like to adjust anything, simply reply to this email or give us a call.</p>`

  const html = shellHtml(shell, `${paragraphsHtml(message)}\n    ${summaryLine}\n    ${table}\n    ${tcNote}\n    ${closing}`)
  const text = `${message.trim()}\n\nYou'll find ${quotesWord} attached and summarised below — the initial deep clean and your ongoing regular service:\n\n${rowsText}\n\nBefore accepting, please take a moment to review each quote and our Terms & Conditions, included with the attached PDFs and shown on the approval pages.\n\nEach quote is valid for 14 days from when it was issued. Just click through to approve, and we'll take care of the rest. If you have any questions or would like to adjust anything, simply reply to this email or give us a call.\n\n${signoffText(shell)}`
  return { html, text }
}
