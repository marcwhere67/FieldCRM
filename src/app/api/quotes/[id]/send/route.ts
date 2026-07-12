import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGmailAccessToken, sendEmailViaGmail } from '@/lib/gmail'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('id, org_id, full_name')
    .eq('supabase_auth_id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const { data: quote } = await supabase
    .from('quotes')
    .select('id, quote_number, org_id, contact_id, total, contacts!quotes_contact_id_fkey(first_name, last_name, email)')
    .eq('id', id)
    .eq('org_id', profile.org_id)
    .single()
  if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })

  const contact = Array.isArray(quote.contacts) ? quote.contacts[0] : quote.contacts
  const contactEmail = contact?.email
  
  if (!contactEmail) {
    return NextResponse.json({ 
      error: 'Contact has no email address' 
    }, { status: 400 })
  }

  const { data: org } = await supabase
    .from('organisations')
    .select('name, email')
    .eq('id', profile.org_id)
    .single()

  const orgEmail = org?.email
  if (!orgEmail) {
    return NextResponse.json({
      error: 'Organisation email not configured. Set it in Settings > Organisation'
    }, { status: 400 })
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin
  const approvalUrl = `${siteUrl}/quote-approval/${quote.id}`
  const pdfUrl = `${siteUrl}/api/portal/quotes/${quote.id}/pdf`

  let sent = false
  let warning: string | null = null

  try {
    const accessToken = await getGmailAccessToken(profile.org_id, user.id)
    
    const subject = `Quote ${quote.quote_number} from ${org?.name ?? 'us'}`
    const htmlBody = `
<html>
<body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
  <p>Hi ${contact?.first_name || 'there'},</p>
  
  <p>Your quote <strong>${quote.quote_number}</strong> from <strong>${org?.name}</strong> is ready.</p>
  
  <p><strong>Quote Total:</strong> $${(quote.total / 100).toFixed(2)}</p>
  
  <p>
    <a href="${approvalUrl}" style="display: inline-block; background-color: #2C3E50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
      View & Approve Quote
    </a>
  </p>
  
  <p>You can also download the quote as a PDF: <a href="${pdfUrl}">Download PDF</a></p>
  
  <p>Questions? Reply to this email or contact us at ${orgEmail}.</p>
  
  <p>Best regards,<br>${profile.full_name}<br>${org?.name}</p>
</body>
</html>`

    const textBody = `Hi ${contact?.first_name || 'there'},

Your quote ${quote.quote_number} from ${org?.name} is ready.

Quote Total: $${(quote.total / 100).toFixed(2)}

View & Approve: ${approvalUrl}
Download PDF: ${pdfUrl}

Questions? Reply to this email.

Best regards,
${profile.full_name}
${org?.name}`

    await sendEmailViaGmail(accessToken, orgEmail, contactEmail, subject, htmlBody, textBody)
    sent = true
  } catch (err) {
    console.error('Gmail send failed:', err)
    warning = err instanceof Error ? err.message : 'Failed to send email'
  }

  const { error } = await supabase
    .from('quotes')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', id)
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ sent, warning })
}
