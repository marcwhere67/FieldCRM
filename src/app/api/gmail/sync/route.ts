import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGmailAccessToken, fetchGmailEmails, getGmailEmail, parseEmailHeaders, decodeGmailBody } from '@/lib/gmail'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { profile } = await getAppProfile(supabase, user.id)
    if (!profile) throw new Error('Profile not found')

    // Update sync status
    await supabase
      .from('gmail_sync_state')
      .update({ sync_status: 'syncing' })
      .eq('org_id', profile.org_id)
      .eq('user_id', user.id)

    const accessToken = await getGmailAccessToken(profile.org_id, user.id)
    const messages = await fetchGmailEmails(accessToken, 20)

    for (const message of messages) {
      const emailData = await getGmailEmail(accessToken, message.id)
      const headers = parseEmailHeaders(emailData.payload.headers)
      const body = decodeGmailBody(emailData.payload)

      const [firstName, ...lastNameParts] = headers.from.split(' ')
      const fromName = headers.from.includes('<') ? headers.from.split('<')[0].trim() : ''

      // Store email in database
      const { data: storedEmail } = await supabase
        .from('emails')
        .upsert(
          {
            org_id: profile.org_id,
            gmail_id: message.id,
            thread_id: message.threadId,
            from_email: extractEmail(headers.from),
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

      if (storedEmail) {
        // Link email to contact by matching email address
        const { data: contact } = await supabase
          .from('contacts')
          .select('id')
          .eq('org_id', profile.org_id)
          .or(`email.eq.${extractEmail(headers.from)},email2.eq.${extractEmail(headers.from)}`)
          .single()

        if (contact) {
          await supabase
            .from('email_contacts')
            .upsert({
              email_id: storedEmail.id,
              contact_id: contact.id,
            })
        }
      }
    }

    // Update sync status
    await supabase
      .from('gmail_sync_state')
      .update({
        sync_status: 'idle',
        last_sync_at: new Date().toISOString(),
      })
      .eq('org_id', profile.org_id)
      .eq('user_id', user.id)

    return NextResponse.json({ success: true, emailsSync: messages.length })
  } catch (error) {
    console.error('Gmail sync error:', error)
    const { data: { user } } = await supabase.auth.getUser()
    const { profile } = await getAppProfile(supabase, user!.id)

    await supabase
      .from('gmail_sync_state')
      .update({
        sync_status: 'error',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      })
      .eq('org_id', profile.org_id)
      .eq('user_id', user!.id)

    return NextResponse.json({ error: error instanceof Error ? error.message : 'Sync failed' }, { status: 500 })
  }
}

function extractEmail(emailString: string): string {
  const match = emailString.match(/<(.+?)>/)
  return match ? match[1] : emailString.trim()
}

async function getAppProfile(supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  return { profile }
}
