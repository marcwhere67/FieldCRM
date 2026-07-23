export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import React from 'react'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { getGmailAccessToken, sendEmailViaGmail } from '@/lib/gmail'
import { ReceiptPDF } from '@/lib/pdf/receipt-pdf'
import { formatCurrency, melbourneDateOnly } from '@/lib/format'
import { captureError } from '@/lib/monitor'
import {
  buildReceiptEmail, defaultReceiptMessage, defaultReceiptSubject, type EmailShell,
} from '@/lib/emails/invoice-email'

const SOURCE = 'api/invoices/[id]/payment'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('id, org_id, role, full_name').eq('supabase_auth_id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  if (!['admin', 'manager'].includes(profile.role)) {
    return NextResponse.json({ error: 'Only managers or admins can record payments' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const amount = Number(body.amount)
  const method = String(body.method || 'bank_transfer')
  const paymentDate = body.payment_date || melbourneDateOnly()
  const reference = body.reference ? String(body.reference).slice(0, 200) : null
  const note = body.note ? String(body.note).slice(0, 500) : null
  const sendReceipt = body.send_receipt !== false
  const receiptMessage = typeof body.receipt_message === 'string' ? body.receipt_message.trim() : ''

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Enter a payment amount greater than zero' }, { status: 400 })
  }

  const { data: invoice } = await supabase
    .from('invoices')
    .select('id, invoice_number, org_id, contact_id, total, deposit_credit, contacts!invoices_contact_id_fkey(first_name, last_name, email), jobs!invoices_job_id_fkey(scheduled_start, actual_start)')
    .eq('id', id)
    .eq('org_id', profile.org_id)
    .single()
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  // Record the payment (receipt_number assigned by DB trigger)
  const { data: payment, error: payErr } = await supabase
    .from('payments')
    .insert({
      org_id: profile.org_id,
      invoice_id: invoice.id,
      contact_id: invoice.contact_id,
      amount,
      method,
      reference,
      notes: note,
      recorded_at: new Date(`${paymentDate}T12:00:00`).toISOString(),
      recorded_by: profile.id,
    })
    .select('id, receipt_number, amount, method, recorded_at, reference')
    .single()

  if (payErr || !payment) {
    await captureError(payErr ?? new Error('Payment insert returned no row'), {
      source: SOURCE, level: 'critical', orgId: profile.org_id, userId: profile.id,
      context: { invoiceId: invoice.id, amount, method },
    })
    return NextResponse.json({ error: payErr?.message ?? 'Failed to record payment' }, { status: 400 })
  }

  // Authoritative total paid = sum of all payments for this invoice
  const { data: allPayments } = await supabase
    .from('payments').select('amount').eq('invoice_id', invoice.id)
  const totalPaid = (allPayments ?? []).reduce((s, p) => s + Number(p.amount), 0)

  const amountOwed = Number(invoice.total) - Number(invoice.deposit_credit ?? 0)
  const fullyPaid = totalPaid >= amountOwed - 0.005 // cent tolerance
  const balanceRemaining = Math.max(0, Math.round((amountOwed - totalPaid) * 100) / 100)

  const { error: invUpdErr } = await supabase
    .from('invoices')
    .update({
      amount_paid: totalPaid,
      payment_method: method,
      status: fullyPaid ? 'paid' : 'partial',
      paid_at: fullyPaid ? new Date().toISOString() : null,
    })
    .eq('id', invoice.id)

  if (invUpdErr) {
    // Payment IS recorded but the invoice status didn't update — needs a human.
    await captureError(invUpdErr, {
      source: SOURCE, level: 'critical', orgId: profile.org_id, userId: profile.id,
      context: { invoiceId: invoice.id, paymentId: payment.id, totalPaid, fullyPaid },
    })
  }

  // Email the receipt (best-effort — payment is already recorded either way)
  const contact = Array.isArray(invoice.contacts) ? invoice.contacts[0] : invoice.contacts
  let receiptWarning: string | null = null

  if (sendReceipt && contact?.email) {
    try {
      const { data: org } = await supabase
        .from('organisations').select('name, abn, phone, email, address').eq('id', profile.org_id).single()

      const job = Array.isArray(invoice.jobs) ? invoice.jobs[0] : invoice.jobs
      const serviceSrc = job?.actual_start ?? job?.scheduled_start
      const pdfBuffer = await renderToBuffer(
        React.createElement(ReceiptPDF, {
          payment, invoice: { invoice_number: invoice.invoice_number, total: Number(invoice.total) },
          org: org ?? { name: 'Us', abn: null, phone: null, email: null, address: null },
          contact, balanceRemaining,
          serviceDate: serviceSrc ? melbourneDateOnly(serviceSrc) : null,
        }) as React.ReactElement<DocumentProps>,
      )

      const accessToken = await getGmailAccessToken(profile.org_id, profile.id)
      const orgEmail = org?.email
      const fromHeader = org?.name && orgEmail ? `"${org.name.replace(/"/g, '')}" <${orgEmail}>` : (orgEmail ?? '')
      if (!orgEmail) throw new Error('Organisation email not configured')

      const subject = defaultReceiptSubject(org?.name ?? 'us', payment.receipt_number)
      const paidLine = formatCurrency(Number(payment.amount))
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin
      const shell: EmailShell = {
        orgName: org?.name ?? 'us', orgEmail, orgPhone: org?.phone ?? null,
        senderName: profile.full_name, logoUrl: `${siteUrl}/salt-air-logo.png`,
      }
      const message = receiptMessage || defaultReceiptMessage({
        firstName: contact.first_name?.trim(), paidLine, invoiceNumber: invoice.invoice_number,
      })
      const balanceHtml = balanceRemaining > 0
        ? `<p>Remaining balance: <strong>${formatCurrency(balanceRemaining)}</strong>.</p>`
        : '<p>This invoice is now paid in full.</p>'
      const balanceText = balanceRemaining > 0
        ? `Remaining balance: ${formatCurrency(balanceRemaining)}.`
        : 'This invoice is now paid in full.'
      const { html, text } = buildReceiptEmail({ message, shell, balanceHtml, balanceText })

      await sendEmailViaGmail(accessToken, fromHeader, contact.email, subject, html, text, [
        { filename: `${payment.receipt_number}.pdf`, content: Buffer.from(pdfBuffer), mimeType: 'application/pdf' },
      ])
    } catch (err) {
      await captureError(err, {
        source: SOURCE, level: 'warning', orgId: profile.org_id, userId: profile.id,
        context: { stage: 'receipt_email', invoiceId: invoice.id, paymentId: payment.id },
      })
      receiptWarning = err instanceof Error ? err.message : 'Receipt email failed'
    }
  }

  return NextResponse.json({
    ok: true,
    receipt_number: payment.receipt_number,
    status: fullyPaid ? 'paid' : 'partial',
    balance_remaining: balanceRemaining,
    receipt_warning: receiptWarning,
  })
}
