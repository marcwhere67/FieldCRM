import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { sendAsOrg } from '@/lib/org-mailer'
import { captureError } from '@/lib/monitor'
import { formatCurrency } from '@/lib/format'

const SOURCE = 'api/quote-approval/[id]'

// Public endpoint — the unguessable quote UUID is the access token.
// Anonymous customers can't write through RLS, so this runs server-side.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // Throttle per IP: legit customers click once; scripts probing UUIDs get cut off
  if (!rateLimit(`quote-approval:${clientIp(req)}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const { id } = await params
  const { action } = await req.json().catch(() => ({}))
  if (action !== 'approve' && action !== 'decline') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const admin = createServiceClient()
  const { data: quote } = await admin
    .from('quotes')
    .select('id, status, valid_until, quote_number, org_id, total, contacts!quotes_contact_id_fkey(first_name, last_name, email, phone)')
    .eq('id', id)
    .single()

  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (['approved', 'declined', 'converted'].includes(quote.status)) {
    return NextResponse.json({ error: 'Quote already responded to' }, { status: 409 })
  }
  if (quote.valid_until && new Date(quote.valid_until) < new Date()) {
    return NextResponse.json({ error: 'Quote has expired' }, { status: 410 })
  }

  const now = new Date().toISOString()
  const update = action === 'approve'
    ? { status: 'approved', approved_at: now }
    : { status: 'declined', declined_at: now }

  const { error } = await admin.from('quotes').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: 'Failed to update quote' }, { status: 500 })

  // Notifications are best-effort — the customer's decision is already saved,
  // so a mail failure must never surface as a failed approval.
  try {
    await notify(admin, quote, action)
  } catch (err) {
    await captureError(err, {
      source: SOURCE, level: 'warning', orgId: quote.org_id,
      context: { stage: 'notify', quoteId: id, action },
    })
  }

  return NextResponse.json({ status: update.status })
}

interface QuoteRow {
  id: string
  quote_number: string
  org_id: string
  total: number
  contacts: { first_name: string; last_name: string; email: string | null; phone: string | null }
    | { first_name: string; last_name: string; email: string | null; phone: string | null }[] | null
}

async function notify(
  admin: ReturnType<typeof createServiceClient>,
  quote: unknown,
  action: 'approve' | 'decline',
) {
  const q = quote as QuoteRow
  const contact = Array.isArray(q.contacts) ? q.contacts[0] : q.contacts
  const customerName = contact ? `${contact.first_name} ${contact.last_name}`.trim() : 'A customer'
  const amount = formatCurrency(Number(q.total ?? 0))

  const { data: org } = await admin
    .from('organisations').select('name, email, phone').eq('id', q.org_id).single()
  if (!org) return

  const bizName = org.name ?? 'us'
  const verb = action === 'approve' ? 'accepted' : 'declined'

  // 1. Internal notification — tell the business straight away.
  if (org.email) {
    const subject = `Quote ${verb}: ${q.quote_number} - ${customerName} (${amount})`
    const details = [
      `Quote: ${q.quote_number}`,
      `Customer: ${customerName}`,
      contact?.email ? `Email: ${contact.email}` : '',
      contact?.phone ? `Phone: ${contact.phone}` : '',
      `Amount: ${amount}`,
    ].filter(Boolean)

    const html = `<html><body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
  <p><strong>${customerName}</strong> has ${verb} quote <strong>${q.quote_number}</strong>.</p>
  <p>${details.map(d => d.replace(/^([^:]+):/, '<strong>$1:</strong>')).join('<br>')}</p>
  ${action === 'approve' ? '<p>The customer has been told you’ll be in touch within 2 business days to arrange a date.</p>' : ''}
</body></html>`
    const text = `${customerName} has ${verb} quote ${q.quote_number}.\n\n${details.join('\n')}${
      action === 'approve' ? '\n\nThe customer has been told you’ll be in touch within 2 business days to arrange a date.' : ''
    }`

    await sendAsOrg(admin, q.org_id, org.email, subject, html, text)
  }

  // 2. Customer confirmation — only on acceptance.
  if (action === 'approve' && contact?.email) {
    const firstName = contact.first_name?.trim()
    const subject = firstName
      ? `${firstName}, thank you for accepting your quote (${q.quote_number})`
      : `Thank you for accepting your quote (${q.quote_number})`

    const html = `<html><body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
  <p>Hi ${firstName || 'there'},</p>
  <p>Thank you for accepting quote <strong>${q.quote_number}</strong>. We’re delighted to be working with you.</p>
  <p><strong>What happens next:</strong> a member of our team will be in touch within <strong>2 business days</strong> to confirm a date and arrange the details of your service.</p>
  <p>If anything changes in the meantime, or you have any questions, simply reply to this email${org.phone ? ` or call us on ${org.phone}` : ''}.</p>
  <p>Kind regards,<br>${bizName}</p>
</body></html>`
    const text = `Hi ${firstName || 'there'},

Thank you for accepting quote ${q.quote_number}. We're delighted to be working with you.

What happens next: a member of our team will be in touch within 2 business days to confirm a date and arrange the details of your service.

If anything changes in the meantime, or you have any questions, simply reply to this email${org.phone ? ` or call us on ${org.phone}` : ''}.

Kind regards,
${bizName}`

    await sendAsOrg(admin, q.org_id, contact.email, subject, html, text)
  }
}
