import { redirect } from 'next/navigation'
import { createClient, getAppProfile } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { QuoteDetail } from '@/components/quotes/quote-detail'

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const profile = await getAppProfile(user!.id)
  if (!profile) return redirect('/login')

  const { data: quote } = await supabase
    .from('quotes')
    .select(`
      *,
      contacts!quotes_contact_id_fkey(id, first_name, last_name, email, phone),
      properties!quotes_property_id_fkey(id, label, address_line1, suburb, state, postcode)
    `)
    .eq('id', id)
    .eq('org_id', profile!.org_id)
    .single()

  if (!quote) notFound()

  const [{ data: services }, { data: contacts }, { data: org }, { data: products }] = await Promise.all([
    supabase.from('services').select('*').eq('org_id', profile!.org_id).eq('is_active', true),
    supabase.from('contacts').select('id, first_name, last_name, email, phone').eq('org_id', profile!.org_id),
    supabase.from('organisations').select('name, abn, email, phone, address, logo_url, default_payment_terms_days').eq('id', profile!.org_id).single(),
    supabase.from('products').select('id, name, description, unit_price, unit, type, category').eq('org_id', profile!.org_id).eq('active', true).order('name'),
  ])

  return (
    <QuoteDetail
      quote={quote}
      services={services ?? []}
      products={products ?? []}
      contacts={contacts ?? []}
      org={org}
      orgId={profile!.org_id}
    />
  )
}
