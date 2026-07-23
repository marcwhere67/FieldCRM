export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import React from 'react'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { getGmailAccessToken, sendEmailViaGmail } from '@/lib/gmail'
import { QuotePDF } from '@/lib/pdf/quote-pdf'
import { formatCurrency } from '@/lib/format'
import { captureError } from '@/lib/monitor'

const SOURCE = 'api/quotes/send-batch'

// Sends 2+ quotes belonging to the SAME contact as one email, each quote's
// PDF attached separately. Mirrors /api/quotes/[id]/send but batches the
// attachments into a single sendEmailViaGmail call and marks every quote sent.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const quoteIds: string[] = Array.isArray(body?.quoteIds) ? body.quoteIds : []
  if (quoteIds.length < 2) {
    return NextResponse.json({ error: 'Select at least 2 quotes to send together' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('id, org_id, full_name')
    .eq('supabase_auth_id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const { data: quotes } = await supabase
    .from('quotes')
    .select('id, quote_number, org_id, contact_id, status, line_items, subtotal, tax, total, notes_client, valid_until, deposit_amount, clean_type, created_at, contacts!quotes_contact_id_fkey(first_name, last_name, email, address_line1, suburb, state, postcode)')
    .in('id', quoteIds)
    .eq('org_id', profile.org_id)

  if (!quotes || quotes.length !== quoteIds.length) {
    return NextResponse.json({ error: 'One or more quotes could not be found' }, { status: 404 })
  }

  const contactIds = new Set(quotes.map(q => q.contact_id))
  if (contactIds.size > 1) {
    return NextResponse.json({ error: 'Selected quotes must all belong to the same contact' }, { status: 400 })
  }

  const contact = Array.isArray(quotes[0].contacts) ? quotes[0].contacts[0] : quotes[0].contacts
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
  const sortedQuotes = [...quotes].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  let sent = false
  let warning: string | null = null

  try {
    const accessToken = await getGmailAccessToken(profile.org_id, profile.id)

    const attachments = await Promise.all(sortedQuotes.map(async (quote) => {
      const pdfBuffer = await renderToBuffer(
        React.createElement(QuotePDF, { quote, org, contact }) as React.ReactElement<DocumentProps>,
      )
      return { filename: `${quote.quote_number}.pdf`, content: Buffer.from(pdfBuffer), mimeType: 'application/pdf' }
    }))

    const bizName = org?.name ?? 'us'
    const firstName = contact?.first_name?.trim()
    const subject = firstName
      ? `${firstName}, your cleaning quotes from ${bizName}`
      : `Your cleaning quotes from ${bizName}`
    const logoUrl = `${siteUrl}/salt-air-logo.png`
    const quotesWord = sortedQuotes.length === 2 ? 'both quotes' : 'the quotes'

    const quoteRowsHtml = sortedQuotes.map(q => `
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${q.quote_number}</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; text-align: right;">${formatCurrency(Number(q.total))}</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; text-align: right;">
          <a href="${siteUrl}/quote-approval/${q.id}" style="color: #2C3E50; font-weight: bold;">View &amp; Approve</a>
        </td>
      </tr>`).join('')

    const quoteRowsText = sortedQuotes.map(q =>
      `${q.quote_number} — ${formatCurrency(Number(q.total))} — View & Approve: ${siteUrl}/quote-approval/${q.id}`,
    ).join('\n')

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

    <p>Thank you for choosing ${org?.name} — we're looking forward to looking after your home.</p>

    <p>For new regular clients, our protocol starts off with a one-off deep clean before your ongoing service begins. It brings the whole home up to our standard from day one and makes every regular clean afterwards more thorough and more consistent. From there, your recurring visits keep everything in top condition with minimal fuss.</p>

    <p>You'll find ${quotesWord} attached and summarised below — the initial deep clean and your ongoing regular service:</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 16px 0;">
      ${quoteRowsHtml}
    </table>

    <p>Each quote is valid for 14 days from when it was issued. Just click through to approve, and we'll take care of the rest. If you have any questions or would like to adjust anything, simply reply to this email or give us a call.</p>

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

Thank you for choosing ${org?.name} — we're looking forward to looking after your home.

For new regular clients, our protocol starts off with a one-off deep clean before your ongoing service begins. It brings the whole home up to our standard from day one and makes every regular clean afterwards more thorough and more consistent. From there, your recurring visits keep everything in top condition with minimal fuss.

You'll find ${quotesWord} attached and summarised below — the initial deep clean and your ongoing regular service:

${quoteRowsText}

Each quote is valid for 14 days from when it was issued. Just click through to approve, and we'll take care of the rest. If you have any questions or would like to adjust anything, simply reply to this email or give us a call.

Kind regards,

${profile.full_name}
${org?.name}
${org?.phone ? org.phone + '\n' : ''}${orgEmail}
https://saltaircleaning.com.au`

    const fromHeader = org?.name ? `"${org.name.replace(/"/g, '')}" <${orgEmail}>` : orgEmail
    await sendEmailViaGmail(accessToken, fromHeader, contactEmail, subject, htmlBody, textBody, attachments)
    sent = true
  } catch (err) {
    await captureError(err, {
      source: SOURCE, level: 'warning', orgId: profile.org_id, userId: profile.id,
      context: { stage: 'gmail_send', quoteIds },
    })
    warning = err instanceof Error ? err.message : 'Failed to send email'
  }

  if (!sent) {
    return NextResponse.json({ sent: false, error: warning ?? 'Email could not be sent' }, { status: 502 })
  }

  const { error } = await supabase
    .from('quotes')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .in('id', quoteIds)

  if (error) {
    await captureError(error, {
      source: SOURCE, level: 'error', orgId: profile.org_id, userId: profile.id,
      context: { stage: 'status_update', quoteIds },
    })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ sent: true, count: sortedQuotes.length })
}
