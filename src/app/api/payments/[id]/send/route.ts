export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import React from 'react'
import { z } from 'zod'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { getGmailAccessToken, sendEmailViaGmail } from '@/lib/gmail'
import { resolveSenderSignatureHtml } from '@/lib/emails/signature'
import { ReceiptPDF } from '@/lib/pdf/receipt-pdf'
import { formatCurrency, melbourneDateOnly } from '@/lib/format'
import { captureError } from '@/lib/monitor'
import { formatZodError, jsonError } from '@/lib/http'
import {
  buildReceiptEmail, defaultReceiptMessage, defaultReceiptSubject, type EmailShell,
} from '@/lib/emails/invoice-email'

const SOURCE = 'api/payments/[id]/send'

// Callers hit this endpoint with no body at all (`fetch(url, { method: 'POST' })`),
// so an empty/missing body must be tolerated rather than rejected as invalid JSON.
const resendReceiptSchema = z.object({
  message: z.string().trim().max(5000).optional(),
})

// Re-email the receipt for an already-recorded payment (same PDF + email the
// customer got when the payment was first recorded). Managers/admins only, to
// match who can record a payment in the first place.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('id, org_id, role, full_name').eq('supabase_auth_id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  if (!['admin', 'manager'].includes(profile.role)) {
    return NextResponse.json({ error: 'Only managers or admins can send receipts' }, { status: 403 })
  }

  const { data: payment } = await supabase
    .from('payments')
    .select('id, org_id, invoice_id, receipt_number, amount, method, recorded_at, reference, contacts!payments_contact_id_fkey(first_name, last_name, email)')
    .eq('id', id)
    .eq('org_id', profile.org_id)
    .single()
  if (!payment || !payment.invoice_id) return NextResponse.json({ error: 'Payment not found' }, { status: 404 })

  const contact = Array.isArray(payment.contacts) ? payment.contacts[0] : payment.contacts
  if (!contact?.email) return NextResponse.json({ error: 'Contact has no email address' }, { status: 400 })

  const [{ data: invoice }, { data: org }, { data: allPayments }] = await Promise.all([
    supabase.from('invoices')
      .select('invoice_number, total, deposit_credit, jobs!invoices_job_id_fkey(scheduled_start, actual_start)')
      .eq('id', payment.invoice_id).single(),
    supabase.from('organisations')
      .select('name, abn, phone, email, address').eq('id', profile.org_id).single(),
    supabase.from('payments').select('amount').eq('invoice_id', payment.invoice_id),
  ])
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  const orgEmail = org?.email
  if (!orgEmail) {
    return NextResponse.json({ error: 'Organisation email not configured. Set it in Settings > Organisation' }, { status: 400 })
  }

  const totalPaid = (allPayments ?? []).reduce((s, p) => s + Number(p.amount), 0)
  const amountOwed = Number(invoice.total) - Number(invoice.deposit_credit ?? 0)
  const balanceRemaining = Math.max(0, Math.round((amountOwed - totalPaid) * 100) / 100)

  const job = Array.isArray(invoice.jobs) ? invoice.jobs[0] : invoice.jobs
  const serviceSrc = job?.actual_start ?? job?.scheduled_start

  try {
    const pdfBuffer = await renderToBuffer(
      React.createElement(ReceiptPDF, {
        payment,
        invoice: { invoice_number: invoice.invoice_number, total: Number(invoice.total) },
        org: org ?? { name: 'Us', abn: null, phone: null, email: null, address: null },
        contact,
        balanceRemaining,
        serviceDate: serviceSrc ? melbourneDateOnly(serviceSrc) : null,
      }) as React.ReactElement<DocumentProps>,
    )

    const accessToken = await getGmailAccessToken(profile.org_id, profile.id)
    const fromHeader = org?.name ? `"${org.name.replace(/"/g, '')}" <${orgEmail}>` : orgEmail

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin
    const shell: EmailShell = {
      orgName: org?.name ?? 'us', orgEmail, orgPhone: org?.phone ?? null,
      senderName: profile.full_name, logoUrl: `${siteUrl}/salt-air-logo.png`,
    }
    // Pre-existing gap: this resend path never set a signature at all (unlike
    // the receipt sent when the payment is first recorded). Fixed alongside
    // the per-sender signature work rather than left newly inconsistent.
    shell.signatureHtml = await resolveSenderSignatureHtml(supabase, profile.id, profile.org_id, accessToken, {
      name: org?.name ?? null, phone: org?.phone ?? null, email: orgEmail, logoUrl: shell.logoUrl,
    })

    let rawBody: unknown = {}
    try {
      rawBody = await req.json()
    } catch {
      rawBody = {}
    }
    const parsedBody = resendReceiptSchema.safeParse(rawBody)
    if (!parsedBody.success) {
      const { message: errMessage } = formatZodError(parsedBody.error)
      return jsonError(errMessage, 400)
    }
    const paidLine = formatCurrency(Number(payment.amount))
    const message = parsedBody.data.message?.trim() || defaultReceiptMessage({
      firstName: contact.first_name?.trim(), paidLine, invoiceNumber: invoice.invoice_number,
    })
    const subject = defaultReceiptSubject(org?.name ?? 'us', payment.receipt_number ?? '')
    const balanceHtml = balanceRemaining > 0
      ? `<p>Remaining balance: <strong>${formatCurrency(balanceRemaining)}</strong>.</p>`
      : '<p>This invoice is now paid in full.</p>'
    const balanceText = balanceRemaining > 0
      ? `Remaining balance: ${formatCurrency(balanceRemaining)}.`
      : 'This invoice is now paid in full.'
    const { html, text } = buildReceiptEmail({ message, shell, balanceHtml, balanceText })

    await sendEmailViaGmail(accessToken, fromHeader, contact.email, subject, html, text, [
      { filename: `${payment.receipt_number ?? 'receipt'}.pdf`, content: Buffer.from(pdfBuffer), mimeType: 'application/pdf' },
    ])
  } catch (err) {
    await captureError(err, {
      source: SOURCE, level: 'warning', orgId: profile.org_id, userId: profile.id,
      context: { paymentId: id },
    })
    return NextResponse.json({ sent: false, error: err instanceof Error ? err.message : 'Failed to send receipt' }, { status: 502 })
  }

  return NextResponse.json({ sent: true })
}
