import { redirect } from 'next/navigation'
import { createClient, getAppProfile } from '@/lib/supabase/server'
import { InboxView } from '@/components/inbox/inbox-view'

export default async function InboxPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const profile = await getAppProfile(user!.id)
  if (!profile) return redirect('/login')

  const { data: conversations } = await supabase
    .from('conversations')
    .select(`
      id, channel, status, last_message_at, unread_count, created_at,
      contacts!conversations_contact_id_fkey(id, first_name, last_name, phone, email)
    `)
    .eq('org_id', profile!.org_id)
    .order('last_message_at', { ascending: false, nullsFirst: false })

  return (
    <InboxView
      conversations={conversations ?? []}
      orgId={profile!.org_id}
      currentUserId={profile!.id}
      currentUserName={profile!.full_name}
    />
  )
}
