import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { IntakeForm } from '@/components/intake/intake-form'

export default async function IntakePage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params
  const supabase = createServiceClient()

  const { data: org } = await supabase
    .from('organisations')
    .select('name, phone, email, logo_url')
    .eq('slug', orgSlug)
    .single()

  if (!org) notFound()

  return <IntakeForm org={org} orgSlug={orgSlug} />
}
