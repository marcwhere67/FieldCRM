export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import React from 'react'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { ReceiptPDF } from '@/lib/pdf/receipt-pdf'

// Download the receipt PDF for a recorded payment (same document as the receipt email).
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

  const { data: payment } = await supabase
    .from('payments')
    .select('id, org_id, invoice_id, receipt_number, amount, method, recorded_at, reference, contacts!payments_contact_id_fkey(first_name, last_name)')
    .eq('id', id)
    .eq('org_id', profile.org_id)
    .single()
  if (!payment || !payment.invoice_id) return NextResponse.json({ error: 'Payment not found' }, { status: 404 })

  const [{ data: invoice }, { data: org }, { data: allPayments }] = await Promise.all([
    supabase.from('invoices')
      .select('invoice_number, total, deposit_credit')
      .eq('id', payment.invoice_id)
      .single(),
    supabase.from('organisations')
      .select('name, abn, phone, email, address')
      .eq('id', profile.org_id)
      .single(),
    supabase.from('payments').select('amount').eq('invoice_id', payment.invoice_id),
  ])
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  const totalPaid = (allPayments ?? []).reduce((s, p) => s + Number(p.amount), 0)
  const amountOwed = Number(invoice.total) - Number(invoice.deposit_credit ?? 0)
  const balanceRemaining = Math.max(0, Math.round((amountOwed - totalPaid) * 100) / 100)

  const contact = Array.isArray(payment.contacts) ? payment.contacts[0] : payment.contacts

  const pdfBuffer = await renderToBuffer(
    React.createElement(ReceiptPDF, {
      payment,
      invoice: { invoice_number: invoice.invoice_number, total: Number(invoice.total) },
      org: org ?? { name: 'Us', abn: null, phone: null, email: null, address: null },
      contact,
      balanceRemaining,
    }) as React.ReactElement<DocumentProps>,
  )

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${payment.receipt_number}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
