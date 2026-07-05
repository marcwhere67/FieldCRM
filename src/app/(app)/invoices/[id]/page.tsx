import { redirect } from 'next/navigation'
import { createClient, getAppProfile } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { InvoiceDetail } from '@/components/invoices/invoice-detail'

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const profile = await getAppProfile(user!.id)
  if (!profile) return redirect('/login')

  const { data: invoice } = await supabase
    .from('invoices')
    .select(`
      *,
      contacts!invoices_contact_id_fkey(id, first_name, last_name, email, phone),
      jobs!invoices_job_id_fkey(id, title),
      quotes!invoices_quote_id_fkey(id, quote_number)
    `)
    .eq('id', id)
    .eq('org_id', profile!.org_id)
    .single()

  if (!invoice) notFound()

  const { data: org } = await supabase
    .from('organisations')
    .select('name, abn, email, phone, address, logo_url, default_payment_terms_days')
    .eq('id', profile!.org_id)
    .single()

  // If this is a final invoice, find the deposit invoice for this job
  let depositInvoice = null
  if (invoice.job_id && invoice.invoice_type === 'final') {
    const { data } = await supabase
      .from('invoices')
      .select('id, invoice_number, total, status, paid_at')
      .eq('job_id', invoice.job_id)
      .eq('invoice_type', 'deposit')
      .single()
    depositInvoice = data
  }

  return (
    <InvoiceDetail
      invoice={invoice}
      org={org}
      orgId={profile!.org_id}
      depositInvoice={depositInvoice}
    />
  )
}
