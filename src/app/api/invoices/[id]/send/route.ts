export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import React from 'react'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { getGmailAccessToken, sendEmailViaGmail } from '@/lib/gmail'
import { InvoicePDF } from '@/lib/pdf/invoice-pdf'
import { formatDate, melbourneDateOnly } from '@/lib/format'
import { captureError } from '@/lib/monitor'
import {
  buildInvoiceEmail, defaultInvoiceMessage, defaultInvoiceSubject, type EmailShell,
} from '@/lib/emails/invoice-email'

const SOURCE = 'api/invoices/[id]/send'

// Shared loader for both the send (POST) and the draft preview (GET).
async function loadContext(req: Request, id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { data: profile } = await supabase
    .from('users').select('id, org_id, full_name').eq('supabase_auth_id', user.id).single()
  if (!profile) return { error: NextResponse.json({ error: 'Profile not found' }, { status: 404 }) }

  const { data: invoice } = await supabase
    .from('invoices')
    .select('id, invoice_number, org_id, contact_id, status, line_items, subtotal, tax, total, notes, deposit_credit, due_date, created_at, stripe_payment_link, contacts!invoices_contact_id_fkey(first_name, last_name, email, address_line1, suburb, state, postcode), jobs!invoices_job_id_fkey(scheduled_start, actual_start)')
    .eq('id', id).eq('org_id', profile.org_id).single()
  if (!invoice) return { error: NextResponse.json({ error: 'Invoice not found' }, { status: 404 }) }

  const contact = Array.isArray(invoice.contacts) ? invoice.contacts[0] : invoice.contacts
  const contactEmail = contact?.email
  if (!contactEmail) return { error: NextResponse.json({ error: 'Contact has no email address' }, { status: 400 }) }

  const { data: org } = await supabase
    .from('organisations')
    .select('name, phone, email, address, abn, bank_account_name, bank_bsb, bank_account_number, bank_payid, payment_instructions')
    .eq('id', profile.org_id).single()
  const orgEmail = org?.email
  if (!orgEmail) {
    return { error: NextResponse.json({ error: 'Organisation email not configured. Set it in Settings > Organisation' }, { status: 400 }) }
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin
  const shell: EmailShell = {
    orgName: org?.name ?? 'us', orgEmail, orgPhone: org?.phone ?? null,
    senderName: profile.full_name, logoUrl: `${siteUrl}/salt-air-logo.png`,
  }
  const balanceDue = Number(invoice.total) - Number(invoice.deposit_credit ?? 0)
  const dueText = invoice.due_date ? formatDate(invoice.due_date) : null

  // Bank transfer block (only if bank details are configured).
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

  return {
    supabase, profile, invoice, contact, org, orgEmail, contactEmail, shell,
    balanceDue, dueText, bankHtml, bankText,
    firstName: contact?.first_name?.trim() as string | undefined,
  }
}

// GET → the default editable draft for the "Review & send" modal.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await loadContext(req, id)
  if ('error' in ctx) return ctx.error
  return NextResponse.json({
    to: ctx.contactEmail,
    subject: defaultInvoiceSubject(ctx.firstName, ctx.shell.orgName, ctx.invoice.invoice_number),
    message: defaultInvoiceMessage(ctx.firstName, ctx.shell.orgName),
  })
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await loadContext(req, id)
  if ('error' in ctx) return ctx.error
  const { supabase, profile, invoice, org, contact, orgEmail, contactEmail, shell, balanceDue, dueText, bankHtml, bankText, firstName } = ctx

  const body = await req.json().catch(() => ({})) as { subject?: string; message?: string }
  const subject = body.subject?.trim() || defaultInvoiceSubject(firstName, shell.orgName, invoice.invoice_number)
  const message = body.message?.trim() || defaultInvoiceMessage(firstName, shell.orgName)

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

    const { html, text } = buildInvoiceEmail({ message, shell, balanceDue, dueText, bankHtml, bankText })
    const fromHeader = shell.orgName ? `"${shell.orgName.replace(/"/g, '')}" <${orgEmail}>` : orgEmail
    await sendEmailViaGmail(accessToken, fromHeader, contactEmail, subject, html, text, [
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
    .from('invoices').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', id)

  if (error) {
    await captureError(error, {
      source: SOURCE, level: 'error', orgId: profile.org_id, userId: profile.id,
      context: { stage: 'status_update', invoiceId: id },
    })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ sent: true })
}
