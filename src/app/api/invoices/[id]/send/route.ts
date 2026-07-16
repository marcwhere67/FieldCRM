import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGmailAccessToken, sendEmailViaGmail } from '@/lib/gmail'
import { formatCurrency, formatDate } from '@/lib/format'

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

  const { data: invoice } = await supabase
    .from('invoices')
    .select('id, invoice_number, org_id, contact_id, total, deposit_credit, due_date, stripe_payment_link, contacts!invoices_contact_id_fkey(first_name, last_name, email)')
    .eq('id', id)
    .eq('org_id', profile.org_id)
    .single()
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  const contact = Array.isArray(invoice.contacts) ? invoice.contacts[0] : invoice.contacts
  const contactEmail = contact?.email
  if (!contactEmail) {
    return NextResponse.json({ error: 'Contact has no email address' }, { status: 400 })
  }

  const { data: org } = await supabase
    .from('organisations')
    .select('name, email')
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
  const viewUrl = `${siteUrl}/portal/invoices/${invoice.id}`
  const balanceDue = Number(invoice.total) - Number(invoice.deposit_credit ?? 0)
  const balanceFormatted = formatCurrency(balanceDue)
  const dueText = invoice.due_date ? formatDate(invoice.due_date) : null

  let sent = false
  let warning: string | null = null

  try {
    const accessToken = await getGmailAccessToken(profile.org_id, profile.id)

    const subject = `Invoice ${invoice.invoice_number} from ${org?.name ?? 'us'}`
    const payLine = invoice.stripe_payment_link
      ? `<p><a href="${invoice.stripe_payment_link}" style="display: inline-block; background-color: #2C3E50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Pay online</a></p>`
      : ''

    const htmlBody = `
<html>
<body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
  <p>Hi ${contact?.first_name || 'there'},</p>

  <p>Please find your invoice <strong>${invoice.invoice_number}</strong> from <strong>${org?.name}</strong> below.</p>

  <p><strong>Amount due:</strong> ${balanceFormatted}${dueText ? `<br><strong>Due date:</strong> ${dueText}` : ''}</p>

  ${payLine}

  <p>View your invoice online: <a href="${viewUrl}">${viewUrl}</a></p>

  <p>Questions? Reply to this email or contact us at ${orgEmail}.</p>

  <p>Best regards,<br>${profile.full_name}<br>${org?.name}</p>
</body>
</html>`

    const textBody = `Hi ${contact?.first_name || 'there'},

Please find your invoice ${invoice.invoice_number} from ${org?.name}.

Amount due: ${balanceFormatted}${dueText ? `\nDue date: ${dueText}` : ''}
${invoice.stripe_payment_link ? `\nPay online: ${invoice.stripe_payment_link}` : ''}
View your invoice online: ${viewUrl}

Questions? Reply to this email.

Best regards,
${profile.full_name}
${org?.name}`

    const fromHeader = org?.name ? `"${org.name.replace(/"/g, '')}" <${orgEmail}>` : orgEmail
    await sendEmailViaGmail(accessToken, fromHeader, contactEmail, subject, htmlBody, textBody)
    sent = true
  } catch (err) {
    console.error('[INVOICE SEND] Gmail send failed:', err)
    warning = err instanceof Error ? err.message : 'Failed to send email'
  }

  if (!sent) {
    return NextResponse.json({ sent: false, error: warning ?? 'Email could not be sent' }, { status: 502 })
  }

  const { error } = await supabase
    .from('invoices')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ sent: true })
}
