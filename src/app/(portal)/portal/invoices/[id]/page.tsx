import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { redirect, notFound } from 'next/navigation'
import { PortalInvoice } from '@/components/portal/portal-invoice'

export default async function PortalInvoicePage({ params }: { params: Promise<{ id: string }> }) {
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

  const [{ data: invoice }, { data: org }] = await Promise.all([
    admin.from('invoices')
      .select('id, invoice_number, status, line_items, subtotal, tax, total, due_date, created_at, stripe_payment_link')
      .eq('id', id)
      .eq('contact_id', contact.id)
      .single(),
    admin.from('organisations').select('name').eq('id', contact.org_id).single(),
  ])

  if (!invoice) notFound()

  return <PortalInvoice invoice={invoice} orgName={org?.name ?? 'Customer Portal'} />
}
