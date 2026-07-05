import { redirect } from 'next/navigation'
import { createClient, getAppProfile } from '@/lib/supabase/server'
import { AssetsView } from '@/components/assets/assets-view'

export default async function AssetsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const profile = await getAppProfile(user!.id)
  if (!profile) return redirect('/login')

  const [{ data: assets }, { data: team }] = await Promise.all([
    supabase
      .from('assets')
      .select('*')
      .eq('org_id', profile!.org_id)
      .order('created_at', { ascending: false }),
    supabase
      .from('users')
      .select('id, full_name')
      .eq('org_id', profile!.org_id)
      .order('first_name'),
  ])

  const canManage = ['admin', 'manager'].includes(profile!.role)

  return (
    <AssetsView
      initialAssets={assets ?? []}
      team={team ?? []}
      canManage={canManage}
    />
  )
}
