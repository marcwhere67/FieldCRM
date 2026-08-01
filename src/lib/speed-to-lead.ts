// Speed-to-lead: median minutes from a new contact landing to the first
// outbound message sent to them. SPEC.md §6 calls this "the single number
// that predicts win rate" — the dashboard tile this feeds is meant to make
// slow response times visible immediately, not just internally reported.
import type { SupabaseClient } from '@supabase/supabase-js'

export interface SpeedToLeadResult {
  medianMinutes: number | null
  sampleSize: number
}

const WINDOW_DAYS = 30
// Bounds the query for a single tenant's recent lead volume; a real backlog
// beyond this is a reporting-page job, not a dashboard tile.
const MAX_LEADS = 500

export async function computeSpeedToLead(
  supabase: SupabaseClient,
  orgId: string,
): Promise<SpeedToLeadResult> {
  const since = new Date(Date.now() - WINDOW_DAYS * 86400000).toISOString()

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, created_at')
    .eq('org_id', orgId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(MAX_LEADS)

  if (!contacts || contacts.length === 0) return { medianMinutes: null, sampleSize: 0 }

  const contactIds = contacts.map(c => c.id)
  const { data: conversations } = await supabase
    .from('conversations')
    .select('id, contact_id')
    .in('contact_id', contactIds)

  if (!conversations || conversations.length === 0) return { medianMinutes: null, sampleSize: 0 }

  const conversationToContact = new Map(conversations.map(c => [c.id, c.contact_id as string]))
  const conversationIds = conversations.map(c => c.id)

  const { data: messages } = await supabase
    .from('messages')
    .select('conversation_id, sent_at')
    .in('conversation_id', conversationIds)
    .eq('direction', 'outbound')
    .order('sent_at', { ascending: true })

  if (!messages || messages.length === 0) return { medianMinutes: null, sampleSize: 0 }

  // First outbound message per contact (messages are already ascending, so the
  // first one seen per conversation/contact is the earliest).
  const firstResponseByContact = new Map<string, string>()
  for (const m of messages) {
    const contactId = conversationToContact.get(m.conversation_id)
    if (!contactId || firstResponseByContact.has(contactId)) continue
    firstResponseByContact.set(contactId, m.sent_at)
  }

  const minutesToRespond: number[] = []
  for (const contact of contacts) {
    const firstResponse = firstResponseByContact.get(contact.id)
    if (!firstResponse) continue
    const minutes = (new Date(firstResponse).getTime() - new Date(contact.created_at).getTime()) / 60000
    if (minutes >= 0) minutesToRespond.push(minutes)
  }

  if (minutesToRespond.length === 0) return { medianMinutes: null, sampleSize: 0 }

  return { medianMinutes: median(minutesToRespond), sampleSize: minutesToRespond.length }
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

// Formats minutes for display: "8 min", "2.3 hrs", "1.4 days".
export function formatSpeedToLead(minutes: number | null): string {
  if (minutes === null) return 'No data'
  if (minutes < 60) return `${Math.round(minutes)} min`
  if (minutes < 1440) return `${(minutes / 60).toFixed(1)} hrs`
  return `${(minutes / 1440).toFixed(1)} days`
}
