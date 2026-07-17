import { redirect } from 'next/navigation'
import { createClient, getAppProfile } from '@/lib/supabase/server'
import { QuoteBuilder } from '@/components/quotes/quote-builder'

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ amount?: string; description?: string; gst?: string }>
}) {
  const params = await searchParams
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

  // Pre-fill a line item when arriving from the quote calculator
  const amount = params.amount ? Number(params.amount) : NaN
  const initialLineItems = Number.isFinite(amount) && amount > 0
    ? [{
        description: params.description || 'Cleaning service',
        quantity: 1,
        unit_price: Math.round(amount * 100) / 100,
        tax_rate: params.gst === '1' ? 10 : 0,
        subtotal: Math.round(amount * 100) / 100,
      }]
    : undefined

  return (
    <QuoteBuilder
      contacts={contacts ?? []}
      services={services ?? []}
      products={products ?? []}
      org={org}
      orgId={profile!.org_id}
      mode="new"
      initialLineItems={initialLineItems}
    />
  )
}
