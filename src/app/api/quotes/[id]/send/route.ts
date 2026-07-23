export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import React from 'react'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { getGmailAccessToken, sendEmailViaGmail } from '@/lib/gmail'
import { QuotePDF } from '@/lib/pdf/quote-pdf'
import { captureError } from '@/lib/monitor'
import {
  buildQuoteEmail, defaultQuoteMessage, defaultQuoteSubject, type EmailShell,
} from '@/lib/emails/quote-email'

const SOURCE = 'api/quotes/[id]/send'

// Shared loader for both the send (POST) and the draft preview (GET) so the
// "Review & send" modal and the actual send use identical data + defaults.
async function loadContext(req: Request, id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { data: profile } = await supabase
    .from('users').select('id, org_id, full_name').eq('supabase_auth_id', user.id).single()
  if (!profile) return { error: NextResponse.json({ error: 'Profile not found' }, { status: 404 }) }

  const { data: quote } = await supabase
    .from('quotes')
    .select('id, quote_number, org_id, contact_id, status, line_items, subtotal, tax, total, notes_client, valid_until, deposit_amount, clean_type, created_at, contacts!quotes_contact_id_fkey(first_name, last_name, email, address_line1, suburb, state, postcode)')
    .eq('id', id).eq('org_id', profile.org_id).single()
  if (!quote) return { error: NextResponse.json({ error: 'Quote not found' }, { status: 404 }) }

  const contact = Array.isArray(quote.contacts) ? quote.contacts[0] : quote.contacts
  const contactEmail = contact?.email
  if (!contactEmail) return { error: NextResponse.json({ error: 'Contact has no email address' }, { status: 400 }) }

  const { data: org } = await supabase
    .from('organisations').select('name, phone, email, address, abn').eq('id', profile.org_id).single()
  const orgEmail = org?.email
  if (!orgEmail) {
    return { error: NextResponse.json({ error: 'Organisation email not configured. Set it in Settings > Organisation' }, { status: 400 }) }
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin
  const shell: EmailShell = {
    orgName: org?.name ?? 'us', orgEmail, orgPhone: org?.phone ?? null,
    senderName: profile.full_name, logoUrl: `${siteUrl}/salt-air-logo.png`,
  }
  return {
    supabase, profile, quote, contact, org, orgEmail, siteUrl, shell,
    approvalUrl: `${siteUrl}/quote-approval/${quote.id}`,
    firstName: contact?.first_name?.trim() as string | undefined,
    contactEmail,
  }
}

// GET → the default editable draft for the "Review & send" modal.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await loadContext(req, id)
  if ('error' in ctx) return ctx.error
  return NextResponse.json({
    to: ctx.contactEmail,
    subject: defaultQuoteSubject(ctx.firstName, ctx.shell.orgName, ctx.quote.quote_number),
    message: defaultQuoteMessage(ctx.firstName, ctx.shell.orgName),
  })
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await loadContext(req, id)
  if ('error' in ctx) return ctx.error
  const { supabase, profile, quote, org, contact, orgEmail, contactEmail, shell, approvalUrl, firstName } = ctx

  const body = await req.json().catch(() => ({})) as { subject?: string; message?: string }
  const subject = body.subject?.trim() || defaultQuoteSubject(firstName, shell.orgName, quote.quote_number)
  const message = body.message?.trim() || defaultQuoteMessage(firstName, shell.orgName)

  let sent = false
  let warning: string | null = null

  try {
    const accessToken = await getGmailAccessToken(profile.org_id, profile.id)

    // Render the quote PDF and attach it (no portal/login needed by the customer).
    const pdfBuffer = await renderToBuffer(
      React.createElement(QuotePDF, { quote, org, contact }) as React.ReactElement<DocumentProps>,
    )

    const { html, text } = buildQuoteEmail({ message, shell, total: Number(quote.total), approvalUrl })
    const fromHeader = shell.orgName ? `"${shell.orgName.replace(/"/g, '')}" <${orgEmail}>` : orgEmail
    await sendEmailViaGmail(accessToken, fromHeader, contactEmail, subject, html, text, [
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
    .from('quotes').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', id)

  if (error) {
    await captureError(error, {
      source: SOURCE, level: 'error', orgId: profile.org_id, userId: profile.id,
      context: { stage: 'status_update', quoteId: id },
    })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ sent: true })
}
