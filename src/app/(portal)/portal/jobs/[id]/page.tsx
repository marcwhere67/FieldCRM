import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { redirect, notFound } from 'next/navigation'
import { PortalJob } from '@/components/portal/portal-job'

export default async function PortalJobPage({ params }: { params: Promise<{ id: string }> }) {
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

  if (!contact) redirect('/portal/login?error=not_found')

  const [{ data: job }, { data: org }] = await Promise.all([
    admin.from('jobs')
      .select('id, job_number, title, description, status, scheduled_start, scheduled_end, instructions')
      .eq('id', id)
      .eq('contact_id', contact.id)
      .maybeSingle(),
    admin.from('organisations')
      .select('name')
      .eq('id', contact.org_id)
      .single(),
  ])

  if (!job) notFound()

  return <PortalJob job={job} orgName={org?.name ?? 'Customer Portal'} />
}
