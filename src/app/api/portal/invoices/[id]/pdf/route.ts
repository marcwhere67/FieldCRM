export const runtime = 'nodejs'

import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { InvoicePDF } from '@/lib/pdf/invoice-pdf'
import { NextResponse } from 'next/server'
import React from 'react'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: contact } = await admin
    .from('contacts')
    .select('id, org_id, first_name, last_name, email, address_line1, suburb, state, postcode')
    .eq('portal_auth_id', user.id)
    .maybeSingle()

  if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [{ data: invoice }, { data: org }] = await Promise.all([
    admin.from('invoices')
      .select('invoice_number, status, line_items, subtotal, tax, total, notes_client, deposit_credit, due_date, created_at, stripe_payment_link')
      .eq('id', id)
      .eq('contact_id', contact.id)
      .single(),
    admin.from('organisations')
      .select('name, phone, email, address, abn')
      .eq('id', contact.org_id)
      .single(),
  ])

  if (!invoice || !org) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const buffer = await renderToBuffer(
    React.createElement(InvoicePDF, { invoice, org, contact }) as React.ReactElement<DocumentProps>
  )

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${invoice.invoice_number}.pdf"`,
    },
  })
}
