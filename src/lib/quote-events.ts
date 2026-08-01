// Quote view/accept/decline audit trail + the "2nd-open" alert (SPEC.md §6 —
// "notify the owner the moment a customer opens a quote a second time").
// Best-effort throughout: a logging/notification failure must never break the
// customer-facing page or action that triggered it.
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendAsOrg } from '@/lib/org-mailer'
import { captureError } from '@/lib/monitor'

interface QuoteMeta {
  id: string
  org_id: string
  quote_number: string
  status: string
}

export type QuoteEventType = 'viewed' | 'accepted' | 'declined'

export async function recordQuoteEvent(
  admin: SupabaseClient,
  quote: QuoteMeta,
  eventType: QuoteEventType,
  ip: string | null,
  userAgent: string | null,
): Promise<void> {
  try {
    // Only "viewed" repeats meaningfully — accepted/declined are one-shot terminal events.
    let priorViews = 0
    if (eventType === 'viewed') {
      const { count } = await admin
        .from('quote_events')
        .select('id', { count: 'exact', head: true })
        .eq('quote_id', quote.id)
        .eq('event_type', 'viewed')
      priorViews = count ?? 0
    }

    await admin.from('quote_events').insert({
      org_id: quote.org_id,
      quote_id: quote.id,
      event_type: eventType,
      ip,
      user_agent: userAgent,
    })

    // The alert fires on the 2nd+ open while the quote is still awaiting a
    // decision — that's the moment worth a phone call, not after it's actioned.
    if (eventType === 'viewed' && priorViews >= 1 && quote.status === 'sent') {
      await notifyQuoteReopened(admin, quote)
    }
  } catch (err) {
    await captureError(err, {
      source: 'lib/quote-events', level: 'warning', orgId: quote.org_id,
      context: { quoteId: quote.id, eventType },
    })
  }
}

async function notifyQuoteReopened(admin: SupabaseClient, quote: QuoteMeta): Promise<void> {
  const { data: org } = await admin.from('organisations').select('email').eq('id', quote.org_id).single()
  if (!org?.email) return

  const subject = `Quote reopened: ${quote.quote_number}`
  const html = `<html><body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
  <p>A customer just opened quote <strong>${quote.quote_number}</strong> again.</p>
  <p>This is often the moment to call — they're actively comparing or deciding right now.</p>
</body></html>`
  const text = `A customer just opened quote ${quote.quote_number} again.\n\nThis is often the moment to call — they're actively comparing or deciding right now.`

  await sendAsOrg(admin, quote.org_id, org.email, subject, html, text)
}
