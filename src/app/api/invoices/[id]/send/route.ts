export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import React from 'react'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { getGmailAccessToken, sendEmailViaGmail } from '@/lib/gmail'
import { InvoicePDF } from '@/lib/pdf/invoice-pdf'
import { formatCurrency, formatDate, melbourneDateOnly } from '@/lib/format'
import { captureError } from '@/lib/monitor'

const SOURCE = 'api/invoices/[id]/send'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('id, org_id, full_name')
    .eq('supabase_auth_id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const { data: invoice } = await supabase
    .from('invoices')
    .select('id, invoice_number, org_id, contact_id, status, line_items, subtotal, tax, total, notes, deposit_credit, due_date, created_at, stripe_payment_link, contacts!invoices_contact_id_fkey(first_name, last_name, email, address_line1, suburb, state, postcode), jobs!invoices_job_id_fkey(scheduled_start, actual_start)')
    .eq('id', id)
    .eq('org_id', profile.org_id)
    .single()
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  const contact = Array.isArray(invoice.contacts) ? invoice.contacts[0] : invoice.contacts
  const contactEmail = contact?.email
  if (!contactEmail) {
    return NextResponse.json({ error: 'Contact has no email address' }, { status: 400 })
  }

  const { data: org } = await supabase
    .from('organisations')
    .select('name, phone, email, address, abn, bank_account_name, bank_bsb, bank_account_number, bank_payid, payment_instructions')
    .eq('id', profile.org_id)
    .single()

  const orgEmail = org?.email
  if (!orgEmail) {
    return NextResponse.json(
      { error: 'Organisation email not configured. Set it in Settings > Organisation' },
      { status: 400 },
    )
  }

  const balanceDue = Number(invoice.total) - Number(invoice.deposit_credit ?? 0)
  const balanceFormatted = formatCurrency(balanceDue)
  const dueText = invoice.due_date ? formatDate(invoice.due_date) : null

  // Bank transfer block for the email (only if bank details are configured)
  const hasBank = org?.bank_bsb || org?.bank_account_number || org?.bank_payid
  const bankHtml = hasBank
    ? `<p style="background:#F5F0EB;padding:12px 16px;border-radius:4px;">
         <strong>Pay by bank transfer</strong><br>
         ${org?.bank_account_name ? `${org.bank_account_name}<br>` : ''}
         ${org?.bank_bsb ? `BSB: ${org.bank_bsb} &nbsp; ` : ''}${org?.bank_account_number ? `Acc: ${org.bank_account_number}` : ''}
         ${org?.bank_payid ? `<br>PayID: ${org.bank_payid}` : ''}
         <br>Reference: <strong>${invoice.invoice_number}</strong>
         ${org?.payment_instructions ? `<br>${org.payment_instructions}` : ''}
       </p>`
    : ''
  const bankText = hasBank
    ? `\nPay by bank transfer:\n${org?.bank_account_name ? org.bank_account_name + '\n' : ''}${org?.bank_bsb ? 'BSB: ' + org.bank_bsb + '  ' : ''}${org?.bank_account_number ? 'Acc: ' + org.bank_account_number : ''}${org?.bank_payid ? '\nPayID: ' + org.bank_payid : ''}\nReference: ${invoice.invoice_number}${org?.payment_instructions ? '\n' + org.payment_instructions : ''}\n`
    : ''

  let sent = false
  let warning: string | null = null

  try {
    const accessToken = await getGmailAccessToken(profile.org_id, profile.id)

    // InvoicePDF expects `notes_client`; map from the invoice's `notes` column.
    const job = Array.isArray(invoice.jobs) ? invoice.jobs[0] : invoice.jobs
    const serviceSrc = job?.actual_start ?? job?.scheduled_start
    const invoicePdfData = {
      ...invoice,
      notes_client: invoice.notes ?? null,
      service_date: serviceSrc ? melbourneDateOnly(serviceSrc) : null,
    }
    const pdfBuffer = await renderToBuffer(
      React.createElement(InvoicePDF, { invoice: invoicePdfData, org, contact }) as React.ReactElement<DocumentProps>,
    )

    const bizName = org?.name ?? 'us'
    const firstName = contact?.first_name?.trim()
    const subject = firstName
      ? `${firstName}, your invoice from ${bizName} (${invoice.invoice_number})`
      : `Your invoice from ${bizName} (${invoice.invoice_number})`
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin
    const logoUrl = `${siteUrl}/salt-air-logo.png`

    const htmlBody = `
<html>
<body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; margin: 0; padding: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #2C3E50; padding: 16px 24px;">
    <tr>
      <td>
        <img src="${logoUrl}" alt="${org?.name}" height="40" style="display: block;" />
      </td>
    </tr>
  </table>

  <div style="padding: 24px;">
    <p>Hi ${contact?.first_name || 'there'},</p>

    <p>Thank you for choosing ${org?.name}. Please find your invoice for the completed work attached.</p>

    <p><strong>Amount due: ${balanceFormatted}</strong>${dueText ? `<br><strong>Due: ${dueText}</strong>` : ''}</p>

    ${bankHtml}

    <p>Please use your invoice number as the payment reference. If you have any questions, feel free to call or reply to this email.</p>

    <p>Kind regards,</p>

    <p>
      ${profile.full_name}<br>
      ${org?.name}<br>
      ${org?.phone ? org.phone + '<br>' : ''}${orgEmail}<br>
      https://saltaircleaning.com.au
    </p>
  </div>
</body>
</html>`

    const textBody = `Hi ${contact?.first_name || 'there'},

Thank you for choosing ${org?.name}. Please find your invoice for the completed work attached.

Amount due: ${balanceFormatted}${dueText ? `\nDue: ${dueText}` : ''}
${bankText}

Please use your invoice number as the payment reference. If you have any questions, feel free to call or reply to this email.

Kind regards,

${profile.full_name}
${org?.name}
${org?.phone ? org.phone + '\n' : ''}${orgEmail}
https://saltaircleaning.com.au`

    const fromHeader = org?.name ? `"${org.name.replace(/"/g, '')}" <${orgEmail}>` : orgEmail
    await sendEmailViaGmail(accessToken, fromHeader, contactEmail, subject, htmlBody, textBody, [
      { filename: `${invoice.invoice_number}.pdf`, content: Buffer.from(pdfBuffer), mimeType: 'application/pdf' },
    ])
    sent = true
  } catch (err) {
    await captureError(err, {
      source: SOURCE, level: 'warning', orgId: profile.org_id, userId: profile.id,
      context: { stage: 'gmail_send', invoiceId: id },
    })
    warning = err instanceof Error ? err.message : 'Failed to send email'
  }

  if (!sent) {
    return NextResponse.json({ sent: false, error: warning ?? 'Email could not be sent' }, { status: 502 })
  }

  const { error } = await supabase
    .from('invoices')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    await captureError(error, {
      source: SOURCE, level: 'error', orgId: profile.org_id, userId: profile.id,
      context: { stage: 'status_update', invoiceId: id },
    })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ sent: true })
}
