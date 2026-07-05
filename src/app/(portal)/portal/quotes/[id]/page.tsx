import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { redirect, notFound } from 'next/navigation'
import { PortalQuote } from '@/components/portal/portal-quote'

export default async function PortalQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/portal/login')

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: contact } = await admin
    .from('contacts')
    .select('id, org_id')
    .eq('portal_auth_id', user.id)
    .maybeSingle()

  if (!contact) redirect('/portal/login')

  const [{ data: quote }, { data: org }] = await Promise.all([
    admin.from('quotes')
      .select('id, quote_number, status, line_items, subtotal, tax, total, notes_client, valid_until, deposit_type, deposit_amount, created_at')
      .eq('id', id)
      .eq('contact_id', contact.id)
      .single(),
    admin.from('organisations').select('name').eq('id', contact.org_id).single(),
  ])

  if (!quote) notFound()

  return <PortalQuote quote={quote} orgName={org?.name ?? 'Customer Portal'} />
}
