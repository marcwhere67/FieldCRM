import { redirect } from 'next/navigation'
import { createClient, getAppProfile } from '@/lib/supabase/server'

export default async function RestrictedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await getAppProfile(user.id)
  if (!profile) redirect('/login')
  if (!['admin', 'manager'].includes(profile.role)) redirect('/dashboard')

  return <>{children}</>
}
