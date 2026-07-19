export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import React from 'react'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { getGmailAccessToken, sendEmailViaGmail } from '@/lib/gmail'
import { QuotePDF } from '@/lib/pdf/quote-pdf'
import { formatCurrency } from '@/lib/format'
import { captureError } from '@/lib/monitor'

const SOURCE = 'api/quotes/[id]/send'

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
    .select('id, quote_number, org_id, contact_id, status, line_items, subtotal, tax, total, notes_client, valid_until, deposit_amount, clean_type, created_at, contacts!quotes_contact_id_fkey(first_name, last_name, email, address_line1, suburb, state, postcode)')
    .eq('id', id)
    .eq('org_id', profile.org_id)
    .single()
  if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })

  const contact = Array.isArray(quote.contacts) ? quote.contacts[0] : quote.contacts
  const contactEmail = contact?.email
  if (!contactEmail) {
    return NextResponse.json({ error: 'Contact has no email address' }, { status: 400 })
  }

  const { data: org } = await supabase
    .from('organisations')
    .select('name, phone, email, address, abn')
    .eq('id', profile.org_id)
    .single()

  const orgEmail = org?.email
  if (!orgEmail) {
    return NextResponse.json(
      { error: 'Organisation email not configured. Set it in Settings > Organisation' },
      { status: 400 },
    )
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin
  const approvalUrl = `${siteUrl}/quote-approval/${quote.id}`
  const totalFormatted = formatCurrency(Number(quote.total))

  let sent = false
  let warning: string | null = null

  try {
    const accessToken = await getGmailAccessToken(profile.org_id, profile.id)

    // Render the quote PDF and attach it (no portal/login needed by the customer).
    const pdfBuffer = await renderToBuffer(
      React.createElement(QuotePDF, { quote, org, contact }) as React.ReactElement<DocumentProps>,
    )

    const subject = `Quote ${quote.quote_number} from ${org?.name ?? 'us'}`
    const logoUrl = `${siteUrl}/salt-air-logo.png`
    const htmlBody = `
<html>
<body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; margin: 0; padding: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #2C3E50; padding: 16px 24px;">
    <tr>
      <td>
        <img src="${logoUrl}" alt="${org?.name}" height="40" style="display: block;" />
      </td>
    </tr>
  </table>

  <div style="padding: 24px;">
    <p>Hi ${contact?.first_name || 'there'},</p>

    <p>Thank you for your enquiry with ${org?.name}. Please find your quote for the discussed work attached.</p>

    <p><strong>Quote Total: ${totalFormatted}</strong></p>

    <p>
      <a href="${approvalUrl}" style="display: inline-block; background-color: #2C3E50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
        View &amp; Approve Quote
      </a>
    </p>

    <p>This quote is valid for 14 days. If you'd like to proceed, click the button above. For any questions, feel free to call or reply to this email.</p>

    <p>Kind regards,</p>

    <p>
      ${profile.full_name}<br>
      ${org?.name}<br>
      ${org?.phone ? org.phone + '<br>' : ''}${orgEmail}<br>
      https://saltaircleaning.com.au
    </p>
  </div>
</body>
</html>`

    const textBody = `Hi ${contact?.first_name || 'there'},

Thank you for your enquiry with ${org?.name}. Please find your quote for the discussed work attached.

Quote Total: ${totalFormatted}

View & Approve: ${approvalUrl}

This quote is valid for 14 days. If you'd like to proceed, click the link above. For any questions, feel free to call or reply to this email.

Kind regards,

${profile.full_name}
${org?.name}
${org?.phone ? org.phone + '\n' : ''}${orgEmail}
https://saltaircleaning.com.au`

    const fromHeader = org?.name ? `"${org.name.replace(/"/g, '')}" <${orgEmail}>` : orgEmail
    await sendEmailViaGmail(accessToken, fromHeader, contactEmail, subject, htmlBody, textBody, [
      { filename: `${quote.quote_number}.pdf`, content: Buffer.from(pdfBuffer), mimeType: 'application/pdf' },
    ])
    sent = true
  } catch (err) {
    await captureError(err, {
      source: SOURCE, level: 'warning', orgId: profile.org_id, userId: profile.id,
      context: { stage: 'gmail_send', quoteId: id },
    })
    warning = err instanceof Error ? err.message : 'Failed to send email'
  }

  // Do NOT mark the quote as sent if the email never went out — surface the real error.
  if (!sent) {
    return NextResponse.json({ sent: false, error: warning ?? 'Email could not be sent' }, { status: 502 })
  }

  const { error } = await supabase
    .from('quotes')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    await captureError(error, {
      source: SOURCE, level: 'error', orgId: profile.org_id, userId: profile.id,
      context: { stage: 'status_update', quoteId: id },
    })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ sent: true })
}
