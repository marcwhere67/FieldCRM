export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import React from 'react'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { InvoicePDF } from '@/lib/pdf/invoice-pdf'
import { melbourneDateOnly } from '@/lib/format'

// Service date = when the work was (or is) done: actual start if present, else scheduled.
function jobServiceDate(job: { scheduled_start: string | null; actual_start: string | null } | null): string | null {
  const src = job?.actual_start ?? job?.scheduled_start
  return src ? melbourneDateOnly(src) : null
}

// Download the same invoice PDF that gets attached to the send email.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('id, org_id')
    .eq('supabase_auth_id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const { data: invoice } = await supabase
    .from('invoices')
    .select('id, invoice_number, org_id, status, line_items, subtotal, tax, total, notes, deposit_credit, due_date, created_at, stripe_payment_link, contacts!invoices_contact_id_fkey(first_name, last_name, email, address_line1, suburb, state, postcode), jobs!invoices_job_id_fkey(scheduled_start, actual_start)')
    .eq('id', id)
    .eq('org_id', profile.org_id)
    .single()
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  const contact = Array.isArray(invoice.contacts) ? invoice.contacts[0] : invoice.contacts

  const { data: org } = await supabase
    .from('organisations')
    .select('name, phone, email, address, abn, bank_account_name, bank_bsb, bank_account_number, bank_payid, payment_instructions')
    .eq('id', profile.org_id)
    .single()
  if (!org) return NextResponse.json({ error: 'Organisation not found' }, { status: 404 })

  const job = Array.isArray(invoice.jobs) ? invoice.jobs[0] : invoice.jobs

  // InvoicePDF expects `notes_client`; map from the invoice's `notes` column.
  const invoicePdfData = { ...invoice, notes_client: invoice.notes ?? null, service_date: jobServiceDate(job) }
  const pdfBuffer = await renderToBuffer(
    React.createElement(InvoicePDF, { invoice: invoicePdfData, org, contact }) as React.ReactElement<DocumentProps>,
  )

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${invoice.invoice_number}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
