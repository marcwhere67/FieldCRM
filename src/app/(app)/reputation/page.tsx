import { createClient, getAppProfile } from '@/lib/supabase/server'
import { ReputationView } from '@/components/reputation/reputation-view'
import { redirect } from 'next/navigation'

export default async function ReputationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await getAppProfile(user!.id)

  if (!profile) redirect('/login')

  const { data: reviews } = await supabase
    .from('reviews')
    .select('*, contacts(first_name, last_name)')
    .order('received_at', { ascending: false })

  return (
    <ReputationView
      initialReviews={reviews ?? []}
      canManage={['admin', 'manager'].includes(profile.role)}
    />
  )
}
