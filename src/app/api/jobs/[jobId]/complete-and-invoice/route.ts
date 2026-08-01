export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import React from 'react'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getGmailAccessToken, sendEmailViaGmail } from '@/lib/gmail'
import { resolveSenderSignatureHtml } from '@/lib/emails/signature'
import { InvoicePDF } from '@/lib/pdf/invoice-pdf'
import { formatDate, melbourneDateOnly } from '@/lib/format'
import { captureError } from '@/lib/monitor'
import { buildInvoiceEmail, defaultInvoiceMessage, defaultInvoiceSubject, type EmailShell } from '@/lib/emails/invoice-email'

const SOURCE = 'api/jobs/[jobId]/complete-and-invoice'

interface LineItem { description: string; quantity: number; unit_price: number; tax_rate: number; subtotal: number }

// Auto-invoices a completed job that's on a Service Agreement (a "regular"
// client) and emails it immediately — no manual Create Invoice / Send click.
// Only applies to jobs with service_agreement_id set; one-off/quoted jobs are
// unaffected and still go through the manual flow in /api/jobs/[jobId]/invoice.
export async function POST(_req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('id, org_id, full_name').eq('supabase_auth_id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const admin = createServiceClient()
  const { data: job } = await admin
    .from('jobs')
    .select('id, org_id, contact_id, quote_id, title, invoice_id, service_agreement_id, materials_used, line_items')
    .eq('id', jobId)
    .eq('org_id', profile.org_id)
    .single()
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  if (!job.service_agreement_id) return NextResponse.json({ skipped: 'Not a recurring/agreement job' })
  if (job.invoice_id) return NextResponse.json({ skipped: 'Job already invoiced', id: job.invoice_id })

  let lineItems: LineItem[] = []
  if (job.quote_id) {
    const { data: quote } = await admin.from('quotes').select('line_items').eq('id', job.quote_id).eq('org_id', profile.org_id).single()
    if (quote?.line_items && Array.isArray(quote.line_items) && quote.line_items.length > 0) lineItems = quote.line_items as LineItem[]
  }
  if (lineItems.length === 0 && Array.isArray(job.line_items) && job.line_items.length > 0) {
    lineItems = job.line_items as LineItem[]
  }
  if (lineItems.length === 0 && Array.isArray(job.materials_used) && job.materials_used.length > 0) {
    lineItems = job.materials_used.map((m: { name: string; qty: number; unit_price: number }) => ({
      description: m.name, quantity: Number(m.qty) || 1, unit_price: Number(m.unit_price) || 0,
      tax_rate: 10, subtotal: (Number(m.qty) || 1) * (Number(m.unit_price) || 0),
    }))
  }
  if (lineItems.length === 0) lineItems = [{ description: job.title, quantity: 1, unit_price: 0, tax_rate: 10, subtotal: 0 }]

  const { data: org } = await admin
    .from('organisations')
    .select('name, phone, email, address, abn, default_payment_terms_days, bank_account_name, bank_bsb, bank_account_number, bank_payid, payment_instructions')
    .eq('id', profile.org_id).single()
  const termsDays = org?.default_payment_terms_days ?? 14
  const dueDate = melbourneDateOnly(new Date(Date.now() + termsDays * 86400000))

  const { data: invoice, error: invErr } = await admin
    .from('invoices')
    .insert({
      org_id: profile.org_id, contact_id: job.contact_id, job_id: job.id, quote_id: job.quote_id ?? null,
      status: 'draft', invoice_type: 'standard', line_items: lineItems, due_date: dueDate,
    })
    .select('id, invoice_number, subtotal, tax, total, deposit_credit')
    .single()

  if (invErr || !invoice) {
    await captureError(invErr ?? new Error('Invoice insert returned no row'), {
      source: SOURCE, level: 'critical', orgId: profile.org_id, userId: profile.id,
      context: { jobId: job.id, stage: 'invoice_insert' },
    })
    return NextResponse.json({ error: invErr?.message ?? 'Failed to create invoice' }, { status: 400 })
  }

  const { error: jobErr } = await admin.from('jobs').update({ invoice_id: invoice.id, status: 'invoiced' }).eq('id', job.id)
  if (jobErr) {
    await captureError(jobErr, { source: SOURCE, level: 'error', orgId: profile.org_id, userId: profile.id, context: { jobId: job.id, invoiceId: invoice.id, stage: 'job_link' } })
  }

  // Send via the org's connected Gmail (whoever connected it — not necessarily
  // the field worker completing the job, matching the pattern in lib/notify.ts).
  if (!org?.email) return NextResponse.json({ id: invoice.id, sent: false, warning: 'Organisation email not configured' })

  const { data: connected } = await admin.from('gmail_sync_state').select('user_id').eq('org_id', profile.org_id).limit(1).maybeSingle()
  if (!connected?.user_id) return NextResponse.json({ id: invoice.id, sent: false, warning: 'No Gmail connected for this organisation' })

  try {
    const accessToken = await getGmailAccessToken(profile.org_id, connected.user_id)

    const { data: contact } = await admin
      .from('contacts').select('first_name, last_name, email, address_line1, suburb, state, postcode').eq('id', job.contact_id).single()
    if (!contact?.email) return NextResponse.json({ id: invoice.id, sent: false, warning: 'Contact has no email address' })

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://fieldcrm-sigma.vercel.app'
    const shell: EmailShell = { orgName: org.name ?? 'us', orgEmail: org.email, orgPhone: org.phone ?? null, senderName: profile.full_name, logoUrl: `${siteUrl}/salt-air-logo.png` }
    // Signature is keyed to `connected.user_id` — whoever's Gmail is actually
    // sending this — not `profile` (the field worker who completed the job).
    shell.signatureHtml = await resolveSenderSignatureHtml(admin, connected.user_id, profile.org_id, accessToken, {
      name: org.name ?? null, phone: org.phone ?? null, email: org.email,
    })

    const balanceDue = Number(invoice.total) - Number(invoice.deposit_credit ?? 0)
    const dueText = dueDate ? formatDate(dueDate) : null
    const hasBank = org.bank_bsb || org.bank_account_number || org.bank_payid
    const bankHtml = hasBank
      ? `<p style="background:#F5F0EB;padding:12px 16px;border-radius:4px;">
           <strong>Pay by bank transfer</strong><br>
           ${org.bank_account_name ? `${org.bank_account_name}<br>` : ''}
           ${org.bank_bsb ? `BSB: ${org.bank_bsb} &nbsp; ` : ''}${org.bank_account_number ? `Acc: ${org.bank_account_number}` : ''}
           ${org.bank_payid ? `<br>PayID: ${org.bank_payid}` : ''}
           <br>Reference: <strong>${invoice.invoice_number}</strong>
           ${org.payment_instructions ? `<br>${org.payment_instructions}` : ''}
         </p>`
      : ''
    const bankText = hasBank
      ? `\nPay by bank transfer:\n${org.bank_account_name ? org.bank_account_name + '\n' : ''}${org.bank_bsb ? 'BSB: ' + org.bank_bsb + '  ' : ''}${org.bank_account_number ? 'Acc: ' + org.bank_account_number : ''}${org.bank_payid ? '\nPayID: ' + org.bank_payid : ''}\nReference: ${invoice.invoice_number}${org.payment_instructions ? '\n' + org.payment_instructions : ''}\n`
      : ''

    const invoicePdfData = {
      ...invoice, status: 'sent', created_at: new Date().toISOString(),
      notes_client: null, service_date: melbourneDateOnly(new Date()),
      line_items: lineItems, org_id: profile.org_id, contact_id: job.contact_id, due_date: dueDate,
    }
    const pdfBuffer = await renderToBuffer(
      React.createElement(InvoicePDF, { invoice: invoicePdfData, org, contact }) as React.ReactElement<DocumentProps>,
    )

    const firstName = contact.first_name?.trim() as string | undefined
    const subject = defaultInvoiceSubject(firstName, shell.orgName, invoice.invoice_number)
    const message = defaultInvoiceMessage(firstName, shell.orgName)
    const { html, text } = buildInvoiceEmail({ message, shell, balanceDue, dueText, bankHtml, bankText })
    const fromHeader = shell.orgName ? `"${shell.orgName.replace(/"/g, '')}" <${org.email}>` : org.email
    await sendEmailViaGmail(accessToken, fromHeader, contact.email, subject, html, text, [
      { filename: `${invoice.invoice_number}.pdf`, content: Buffer.from(pdfBuffer), mimeType: 'application/pdf' },
    ])

    await admin.from('invoices').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', invoice.id)
    return NextResponse.json({ id: invoice.id, sent: true })
  } catch (err) {
    await captureError(err, { source: SOURCE, level: 'warning', orgId: profile.org_id, userId: profile.id, context: { jobId: job.id, invoiceId: invoice.id, stage: 'gmail_send' } })
    return NextResponse.json({ id: invoice.id, sent: false, warning: err instanceof Error ? err.message : 'Failed to send email' })
  }
}
