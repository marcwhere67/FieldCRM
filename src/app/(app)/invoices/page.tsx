import { redirect } from 'next/navigation'
import { createClient, getAppProfile } from '@/lib/supabase/server'
import { InvoicesList } from '@/components/invoices/invoices-list'

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const profile = await getAppProfile(user!.id)
  if (!profile) return redirect('/login')

  let query = supabase
    .from('invoices')
    .select(`
      id, invoice_number, invoice_type, status, subtotal, tax, total,
      deposit_credit, due_date, paid_at, sent_at, created_at,
      contacts!invoices_contact_id_fkey(id, first_name, last_name, email)
    `, { count: 'exact' })
    .eq('org_id', profile!.org_id)
    .order('created_at', { ascending: false })

  if (params.status) query = query.eq('status', params.status)
  if (params.type) query = query.eq('invoice_type', params.type)

  // Cap the payload at the 500 most-recent to avoid an unbounded fetch.
  const { data: invoices, count } = await query.limit(500)

  // Mark overdue on the fly (status=sent and past due_date)
  const now = new Date().toISOString().split('T')[0]
  const enriched = (invoices ?? []).map(inv => ({
    ...inv,
    is_overdue: inv.status === 'sent' && inv.due_date && inv.due_date < now,
  }))

  return <InvoicesList invoices={enriched} filters={params} total={count ?? enriched.length} />
}
