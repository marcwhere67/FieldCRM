import { createClient, getAppProfile } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CatalogueView } from '@/components/catalogue/catalogue-view'

export default async function CataloguePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await getAppProfile(user!.id)

  if (!profile) redirect('/login')

  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('org_id', profile.org_id)
    .order('type')
    .order('name')

  return (
    <CatalogueView
      initialProducts={products ?? []}
      canManage={['admin', 'manager'].includes(profile.role)}
    />
  )
}
