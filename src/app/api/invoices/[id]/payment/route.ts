export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import React from 'react'
import { z } from 'zod'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { requireRole, parseBody, jsonError, friendlyDbError, MANAGER_ROLES } from '@/lib/http'
import {
  zUuid, zPositiveMoneyInput, zDateOnly, zNullableText, zLongText,
} from '@/lib/validation/common'
import { getGmailAccessToken, sendEmailViaGmail } from '@/lib/gmail'
import { resolveSenderSignatureHtml } from '@/lib/emails/signature'
import { ReceiptPDF } from '@/lib/pdf/receipt-pdf'
import { formatCurrency, melbourneDateOnly } from '@/lib/format'
import { captureError } from '@/lib/monitor'
import {
  buildReceiptEmail, defaultReceiptMessage, defaultReceiptSubject, type EmailShell,
} from '@/lib/emails/invoice-email'

const SOURCE = 'api/invoices/[id]/payment'

export const PAYMENT_METHODS = ['bank_transfer', 'card', 'cash', 'cheque', 'payid', 'other'] as const

const paymentSchema = z.object({
  amount: zPositiveMoneyInput,
  method: z.enum(PAYMENT_METHODS, { error: 'Choose a valid payment method' }).default('bank_transfer'),
  payment_date: zDateOnly.optional(),
  reference: zNullableText(200),
  note: zNullableText(500),
  send_receipt: z.boolean().default(true),
  receipt_message: zLongText(5000).optional(),
  // Idempotency key minted by the client when the payment modal opens and
  // reused on every retry, so a double-tap or a retried-after-timeout request
  // records the payment (and emails the receipt) exactly once. A malformed key
  // is now a 400 rather than being silently dropped — dropping it turned a
  // retry into a duplicate payment.
  client_request_id: zUuid.nullish(),
})

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const auth = await requireRole(MANAGER_ROLES)
  if (!auth.ok) return auth.response
  const { profile, supabase } = auth.data

  const parsed = await parseBody(req, paymentSchema)
  if (!parsed.ok) return parsed.response

  const amount = parsed.data.amount
  const method = parsed.data.method
  const paymentDate = parsed.data.payment_date ?? melbourneDateOnly()
  const reference = parsed.data.reference
  const note = parsed.data.note
  const sendReceipt = parsed.data.send_receipt
  const receiptMessage = parsed.data.receipt_message ?? ''
  const clientRequestId = parsed.data.client_request_id ?? null

  const { data: invoice } = await supabase
    .from('invoices')
    .select('id, invoice_number, org_id, contact_id, total, deposit_credit, contacts!invoices_contact_id_fkey(first_name, last_name, email), jobs!invoices_job_id_fkey(scheduled_start, actual_start)')
    .eq('id', id)
    .eq('org_id', profile.org_id)
    .single()
  if (!invoice) return jsonError('Invoice not found', 404)
  const inv = invoice

  // Idempotent replay: this exact request already recorded a payment. Return
  // the prior result without inserting again or re-sending the receipt.
  async function alreadyRecorded(receiptNumber: string | null) {
    const { data: allPayments } = await supabase
      .from('payments').select('amount').eq('invoice_id', inv.id)
    const totalPaid = (allPayments ?? []).reduce((s, p) => s + Number(p.amount), 0)
    const amountOwed = Number(inv.total) - Number(inv.deposit_credit ?? 0)
    const balanceRemaining = Math.max(0, Math.round((amountOwed - totalPaid) * 100) / 100)
    return NextResponse.json({
      ok: true,
      receipt_number: receiptNumber,
      status: totalPaid >= amountOwed - 0.005 ? 'paid' : 'partial',
      balance_remaining: balanceRemaining,
      receipt_warning: null,
      idempotent_replay: true,
    })
  }

  if (clientRequestId) {
    const { data: prior } = await supabase
      .from('payments')
      .select('receipt_number')
      .eq('invoice_id', inv.id)
      .eq('client_request_id', clientRequestId)
      .maybeSingle()
    if (prior) return alreadyRecorded(prior.receipt_number)
  }

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
      client_request_id: clientRequestId,
    })
    .select('id, receipt_number, amount, method, recorded_at, reference')
    .single()

  if (payErr || !payment) {
    // Unique-index violation on client_request_id => a concurrent request beat
    // us to it. Treat as an idempotent replay, not an error.
    if (payErr?.code === '23505' && clientRequestId) {
      const { data: prior } = await supabase
        .from('payments')
        .select('receipt_number')
        .eq('invoice_id', inv.id)
        .eq('client_request_id', clientRequestId)
        .maybeSingle()
      if (prior) return alreadyRecorded(prior.receipt_number)
    }
    await captureError(payErr ?? new Error('Payment insert returned no row'), {
      source: SOURCE, level: 'critical', orgId: profile.org_id, userId: profile.id,
      context: { invoiceId: invoice.id, amount, method },
    })
    // Rule 7: the driver's constraint text never reaches the UI.
    return jsonError(friendlyDbError(payErr), 400)
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
        senderName: profile.full_name ?? org?.name ?? 'us', logoUrl: `${siteUrl}/salt-air-logo.png`,
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
      shell.signatureHtml = await resolveSenderSignatureHtml(supabase, profile.id, profile.org_id, accessToken, {
        name: org?.name ?? null, phone: org?.phone ?? null, email: orgEmail, logoUrl: shell.logoUrl,
      })
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
