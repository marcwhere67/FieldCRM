export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import React from 'react'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { QuotePDF } from '@/lib/pdf/quote-pdf'

// Download the same quote PDF that gets attached to the send email.
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

  const { data: quote } = await supabase
    .from('quotes')
    .select('id, quote_number, org_id, status, line_items, subtotal, tax, total, notes_client, valid_until, deposit_amount, clean_type, created_at, contacts!quotes_contact_id_fkey(first_name, last_name, email, address_line1, suburb, state, postcode)')
    .eq('id', id)
    .eq('org_id', profile.org_id)
    .single()
  if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })

  const contact = Array.isArray(quote.contacts) ? quote.contacts[0] : quote.contacts

  const { data: org } = await supabase
    .from('organisations')
    .select('name, phone, email, address, abn')
    .eq('id', profile.org_id)
    .single()
  if (!org) return NextResponse.json({ error: 'Organisation not found' }, { status: 404 })

  const pdfBuffer = await renderToBuffer(
    React.createElement(QuotePDF, { quote, org, contact }) as React.ReactElement<DocumentProps>,
  )

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${quote.quote_number}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
