import { redirect } from 'next/navigation'
import { createClient, getAppProfile } from '@/lib/supabase/server'
import { QuoteBuilder } from '@/components/quotes/quote-builder'

export default async function NewQuotePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const profile = await getAppProfile(user!.id)
  if (!profile) return redirect('/login')

  const [{ data: contacts }, { data: services }, { data: org }, { data: products }] = await Promise.all([
    supabase.from('contacts').select('id, first_name, last_name, email, phone').eq('org_id', profile!.org_id).order('first_name'),
    supabase.from('services').select('*').eq('org_id', profile!.org_id).eq('is_active', true).order('name'),
    supabase.from('organisations').select('name, abn, email, phone, address, logo_url, default_payment_terms_days').eq('id', profile!.org_id).single(),
    supabase.from('products').select('id, name, description, unit_price, unit, type, category').eq('org_id', profile!.org_id).eq('active', true).order('name'),
  ])

  // Generate next quote number
  const { count } = await supabase.from('quotes').select('*', { count: 'exact', head: true }).eq('org_id', profile!.org_id)
  const nextNumber = `Q-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(3, '0')}`

  return (
    <QuoteBuilder
      contacts={contacts ?? []}
      services={services ?? []}
      products={products ?? []}
      org={org}
      nextQuoteNumber={nextNumber}
      orgId={profile!.org_id}
      mode="new"
    />
  )
}
