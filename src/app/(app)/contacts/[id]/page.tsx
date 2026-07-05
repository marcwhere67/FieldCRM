import { redirect } from 'next/navigation'
import { createClient, getAppProfile } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ContactHeader } from '@/components/contacts/contact-header'
import { ContactTabs } from '@/components/contacts/contact-tabs'

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const profile = await getAppProfile(user!.id)
  if (!profile) return redirect('/login')

  const { data: contact } = await supabase
    .from('contacts')
    .select(`
      *,
      users!contacts_assigned_to_fkey(id, full_name),
      pipeline_stages(id, name, color)
    `)
    .eq('id', id)
    .eq('org_id', profile!.org_id)
    .single()

  if (!contact) notFound()

  const [
    { data: jobs },
    { data: quotes },
    { data: invoices },
    { data: conversations },
    { data: properties },
    { data: pipelineStages },
    { data: teamMembers },
  ] = await Promise.all([
    supabase.from('jobs').select('id, job_number, title, status, scheduled_start, scheduled_end').eq('contact_id', id).order('scheduled_start', { ascending: false }).limit(10),
    supabase.from('quotes').select('id, quote_number, status, total, created_at').eq('contact_id', id).order('created_at', { ascending: false }).limit(10),
    supabase.from('invoices').select('id, invoice_number, status, total, amount_paid, due_date').eq('contact_id', id).order('created_at', { ascending: false }).limit(10),
    supabase.from('conversations').select('id, channel, status, last_message_at, unread_count').eq('contact_id', id).order('last_message_at', { ascending: false }).limit(10),
    supabase.from('properties').select('*').eq('contact_id', id),
    supabase.from('pipeline_stages').select('id, name, color').eq('org_id', profile!.org_id).eq('pipeline_type', 'leads').order('position'),
    supabase.from('users').select('id, full_name').eq('org_id', profile!.org_id).eq('is_active', true),
  ])

  return (
    <div className="max-w-6xl space-y-6">
      <ContactHeader
        contact={contact}
        pipelineStages={pipelineStages ?? []}
        teamMembers={teamMembers ?? []}
      />
      <ContactTabs
        contact={contact}
        jobs={jobs ?? []}
        quotes={quotes ?? []}
        invoices={invoices ?? []}
        conversations={conversations ?? []}
        properties={properties ?? []}
      />
    </div>
  )
}
