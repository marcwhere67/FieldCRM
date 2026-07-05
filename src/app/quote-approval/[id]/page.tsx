import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { QuoteApproval } from '@/components/quotes/quote-approval'

export default async function QuoteApprovalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Public page for anonymous customers — RLS blocks the anon client,
  // so read with the service client; the quote UUID is the access token.
  const supabase = createServiceClient()

  const { data: quote } = await supabase
    .from('quotes')
    .select(`
      *,
      contacts!quotes_contact_id_fkey(id, first_name, last_name, email, phone),
      properties!quotes_property_id_fkey(id, label, address_line1, suburb, state, postcode)
    `)
    .eq('id', id)
    .single()

  if (!quote) notFound()

  const { data: org } = await supabase
    .from('organisations')
    .select('name, abn, email, phone, address, logo_url')
    .eq('id', quote.org_id)
    .single()

  return <QuoteApproval quote={quote} org={org} />
}
