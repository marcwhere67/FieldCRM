import { NextResponse } from 'next/server'
import { createClient, createServiceClient, getAppProfile } from '@/lib/supabase/server'
import { getGmailAccessToken, fetchGmailEmails, getGmailEmail, parseEmailHeaders, decodeGmailBody } from '@/lib/gmail'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const profile = await getAppProfile(user.id)
  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  // gmail_sync_state is only reachable via the service client (tokens live there)
  const admin = createServiceClient()

  try {
    await admin
      .from('gmail_sync_state')
      .update({ sync_status: 'syncing' })
      .eq('org_id', profile.org_id)
      .eq('user_id', profile.id)

    const accessToken = await getGmailAccessToken(profile.org_id, profile.id)
    const messages = await fetchGmailEmails(accessToken, 20)

    for (const message of messages) {
      const emailData = await getGmailEmail(accessToken, message.id)
      const headers = parseEmailHeaders(emailData.payload.headers)
      const body = decodeGmailBody(emailData.payload)

      const fromName = headers.from.includes('<') ? headers.from.split('<')[0].trim().replace(/^"|"$/g, '') : ''
      const fromEmail = extractEmail(headers.from)

      const { data: storedEmail } = await supabase
        .from('emails')
        .upsert(
          {
            org_id: profile.org_id,
            gmail_id: message.id,
            thread_id: message.threadId,
            from_email: fromEmail,
            from_name: fromName,
            to_email: extractEmail(headers.to),
            subject: headers.subject,
            body,
            received_at: new Date(parseInt(emailData.internalDate)).toISOString(),
            labels: emailData.labelIds || [],
          },
          { onConflict: 'org_id,gmail_id' }
        )
        .select()
        .single()

      if (storedEmail && fromEmail) {
        const { data: contact } = await supabase
          .from('contacts')
          .select('id')
          .eq('org_id', profile.org_id)
          .eq('email', fromEmail)
          .limit(1)
          .maybeSingle()

        if (contact) {
          await supabase
            .from('email_contacts')
            .upsert(
              { email_id: storedEmail.id, contact_id: contact.id },
              { onConflict: 'email_id,contact_id', ignoreDuplicates: true }
            )
        }
      }
    }

    await admin
      .from('gmail_sync_state')
      .update({
        sync_status: 'idle',
        error_message: null,
        last_sync_at: new Date().toISOString(),
      })
      .eq('org_id', profile.org_id)
      .eq('user_id', profile.id)

    return NextResponse.json({ success: true, emailsSync: messages.length })
  } catch (error) {
    console.error('Gmail sync error:', error)

    await admin
      .from('gmail_sync_state')
      .update({
        sync_status: 'error',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      })
      .eq('org_id', profile.org_id)
      .eq('user_id', profile.id)

    return NextResponse.json({ error: error instanceof Error ? error.message : 'Sync failed' }, { status: 500 })
  }
}

function extractEmail(emailString: string): string {
  const match = emailString.match(/<(.+?)>/)
  return (match ? match[1] : emailString.trim()).toLowerCase()
}
