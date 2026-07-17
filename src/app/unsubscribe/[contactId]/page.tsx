import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { UnsubscribeForm } from '@/components/unsubscribe/unsubscribe-form'

// Public opt-out confirmation page. The contact UUID is the access token.
export default async function UnsubscribePage({ params }: { params: Promise<{ contactId: string }> }) {
  const { contactId } = await params

  const supabase = createServiceClient()
  const { data: contact } = await supabase
    .from('contacts')
    .select('id, first_name, do_not_contact, org_id')
    .eq('id', contactId)
    .single()

  if (!contact) notFound()

  const { data: org } = await supabase
    .from('organisations')
    .select('name')
    .eq('id', contact.org_id)
    .single()

  return (
    <UnsubscribeForm
      contactId={contact.id}
      firstName={contact.first_name}
      orgName={org?.name ?? 'us'}
      alreadyUnsubscribed={contact.do_not_contact}
    />
  )
}
