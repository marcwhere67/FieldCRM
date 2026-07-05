import { createClient, getAppProfile } from '@/lib/supabase/server'
import { SettingsView } from '@/components/settings/settings-view'
import { redirect } from 'next/navigation'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await getAppProfile(user!.id)

  if (!profile) redirect('/login')

  const [{ data: org }, { data: team }] = await Promise.all([
    supabase
      .from('organisations')
      .select('id, name, abn, phone, email, address, default_payment_terms_days, timezone, subscription_plan')
      .eq('id', profile.org_id)
      .single(),
    supabase
      .from('users')
      .select('id, full_name, email, role, phone, is_active, hourly_rate')
      .eq('org_id', profile.org_id)
      .order('full_name'),
  ])

  if (!org) redirect('/dashboard')

  return (
    <SettingsView
      org={org}
      team={team ?? []}
      profile={profile}
      isAdmin={profile.role === 'admin'}
    />
  )
}
