export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import React from 'react'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { getGmailAccessToken, sendEmailViaGmail } from '@/lib/gmail'
import { QuotePDF } from '@/lib/pdf/quote-pdf'
import { captureError } from '@/lib/monitor'
import {
  buildBatchEmail, defaultBatchMessage, defaultBatchSubject, type EmailShell,
} from '@/lib/emails/quote-email'

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
  const firstName = contact?.first_name?.trim()
  const shell: EmailShell = {
    orgName: org?.name ?? 'us', orgEmail, orgPhone: org?.phone ?? null,
    senderName: profile.full_name, logoUrl: `${siteUrl}/salt-air-logo.png`,
  }
  const quoteSummaries = sortedQuotes.map(q => ({ id: q.id, quote_number: q.quote_number, total: Number(q.total) }))

  // Preview mode → return the default editable draft for the "Review & send" modal.
  if (body?.preview) {
    return NextResponse.json({
      to: contactEmail,
      subject: defaultBatchSubject(firstName, shell.orgName),
      message: defaultBatchMessage(firstName, shell.orgName),
      quotes: quoteSummaries,
    })
  }

  const subject = typeof body?.subject === 'string' && body.subject.trim()
    ? body.subject.trim() : defaultBatchSubject(firstName, shell.orgName)
  const message = typeof body?.message === 'string' && body.message.trim()
    ? body.message.trim() : defaultBatchMessage(firstName, shell.orgName)

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

    const { html, text } = buildBatchEmail({ message, shell, quotes: quoteSummaries, siteUrl })
    const fromHeader = shell.orgName ? `"${shell.orgName.replace(/"/g, '')}" <${orgEmail}>` : orgEmail
    await sendEmailViaGmail(accessToken, fromHeader, contactEmail, subject, html, text, attachments)
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
