import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { PortalLogin } from '@/components/portal/portal-login'

export default async function PortalLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data: contact } = await admin
      .from('contacts')
      .select('id')
      .eq('portal_auth_id', user.id)
      .maybeSingle()

    if (contact) redirect('/portal/dashboard')
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: org } = await admin
    .from('organisations')
    .select('name')
    .limit(1)
    .maybeSingle()

  return <PortalLogin orgName={org?.name} error={error} />
}
