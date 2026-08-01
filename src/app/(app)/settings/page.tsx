import { createClient, getAppProfile } from '@/lib/supabase/server'
import { SettingsView } from '@/components/settings/settings-view'
import { captureError } from '@/lib/monitor'
import { redirect } from 'next/navigation'

const ORG_FIELDS = 'id, name, abn, phone, email, address, default_payment_terms_days, timezone, subscription_plan, bank_account_name, bank_bsb, bank_account_number, bank_payid, payment_instructions'

// website/instagram_url ship via a separate migration (user_email_signature.sql)
// that may not be applied to every environment yet. Falls back to the base
// field set — rather than breaking the whole Settings page — if it isn't.
async function fetchOrg(supabase: Awaited<ReturnType<typeof createClient>>, orgId: string) {
  const withSocials = await supabase
    .from('organisations').select(`${ORG_FIELDS}, website, instagram_url`).eq('id', orgId).single()
  if (!withSocials.error) return withSocials.data

  await captureError(withSocials.error, {
    source: 'settings/page', level: 'warning', orgId,
    context: { stage: 'org_fetch_with_socials', hint: 'has supabase/migrations/user_email_signature.sql been applied?' },
  })
  const base = await supabase.from('organisations').select(ORG_FIELDS).eq('id', orgId).single()
  return base.data ? { ...base.data, website: null, instagram_url: null } : null
}

// email_signature_template ships via 2026-08-01_custom_email_signature.sql,
// same "may not be applied yet" caveat as the org socials above.
async function fetchSignatureTemplate(supabase: Awaited<ReturnType<typeof createClient>>, profileId: string) {
  const { data, error } = await supabase
    .from('users').select('email_signature_template').eq('id', profileId).single()
  if (error) {
    await captureError(error, {
      source: 'settings/page', level: 'warning', context: {
        stage: 'signature_template_fetch', hint: 'has 2026-08-01_custom_email_signature.sql been applied?',
      },
    })
    return null
  }
  return data?.email_signature_template ?? null
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await getAppProfile(user!.id)

  if (!profile) redirect('/login')

  const [org, { data: team }, { data: employeeProfile }, signatureTemplate] = await Promise.all([
    fetchOrg(supabase, profile.org_id),
    supabase
      .from('users')
      .select('id, full_name, email, role, phone, is_active, hourly_rate')
      .eq('org_id', profile.org_id)
      .order('full_name'),
    supabase
      .from('employee_profiles')
      .select('job_title')
      .eq('user_id', profile.id)
      .maybeSingle(),
    fetchSignatureTemplate(supabase, profile.id),
  ])

  if (!org) redirect('/dashboard')

  return (
    <SettingsView
      org={org}
      team={team ?? []}
      profile={profile}
      jobTitle={employeeProfile?.job_title ?? null}
      signatureTemplate={signatureTemplate}
      isAdmin={profile.role === 'admin'}
      initialTab={tab}
    />
  )
}
