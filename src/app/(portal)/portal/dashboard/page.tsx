import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { PortalDashboard } from '@/components/portal/portal-dashboard'

export default async function PortalDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/portal/login')

  // Use service role to bypass RLS for portal data queries
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: contact } = await admin
    .from('contacts')
    .select('id, first_name, last_name, email, org_id')
    .eq('portal_auth_id', user.id)
    .maybeSingle()

  if (!contact) return redirect('/portal/login?error=not_found')

  const [{ data: quotes }, { data: invoices }, { data: jobs }, { data: org }] = await Promise.all([
    admin.from('quotes')
      .select('id, quote_number, status, total, created_at, valid_until')
      .eq('contact_id', contact.id)
      .neq('status', 'draft')
      .order('created_at', { ascending: false }),
    admin.from('invoices')
      .select('id, invoice_number, status, total, due_date')
      .eq('contact_id', contact.id)
      .neq('status', 'draft')
      .order('created_at', { ascending: false }),
    admin.from('jobs')
      .select('id, title, status, scheduled_start, scheduled_end, description')
      .eq('contact_id', contact.id)
      .order('created_at', { ascending: false }),
    admin.from('organisations')
      .select('name, phone, email')
      .eq('id', contact.org_id)
      .single(),
  ])

  return (
    <PortalDashboard
      contact={contact}
      orgName={org?.name ?? 'Customer Portal'}
      orgPhone={org?.phone ?? null}
      orgEmail={org?.email ?? null}
      quotes={quotes ?? []}
      invoices={invoices ?? []}
      jobs={jobs ?? []}
    />
  )
}
