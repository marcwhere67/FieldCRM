import { redirect } from 'next/navigation'
import { createClient, getAppProfile } from '@/lib/supabase/server'
import { QuotesList } from '@/components/quotes/quotes-list'

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const profile = await getAppProfile(user!.id)
  if (!profile) return redirect('/login')

  let query = supabase
    .from('quotes')
    .select(`
      id, quote_number, status, subtotal, tax, total,
      valid_until, sent_at, approved_at, created_at,
      contacts!quotes_contact_id_fkey(id, first_name, last_name, email, phone)
    `, { count: 'exact' })
    .eq('org_id', profile!.org_id)
    .order('created_at', { ascending: false })

  if (params.status) query = query.eq('status', params.status)

  // Cap the payload at the 500 most-recent to avoid an unbounded fetch.
  const { data: quotes, count } = await query.limit(500)

  return <QuotesList quotes={quotes ?? []} filters={params} total={count ?? (quotes?.length ?? 0)} />
}
