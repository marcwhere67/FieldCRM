import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { rateLimit, clientIp } from '@/lib/rate-limit'

// Public, unauthenticated opt-out endpoint (AU Spam Act unsubscribe facility).
// The contact UUID is the access token — random v4, unguessable. Writing goes
// through the service client because a logged-out visitor has no session (RLS
// would block the anon client), mirroring the intake / quote-approval pattern.
// Opting out is fail-safe and reversible by an admin, so a bare UUID is enough.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// GET — current opt-out status, used by the confirmation page to render state.
export async function GET(_req: Request, { params }: { params: Promise<{ contactId: string }> }) {
  const { contactId } = await params
  if (!UUID_RE.test(contactId)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('contacts')
    .select('first_name, do_not_contact')
    .eq('id', contactId)
    .single()

  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ first_name: data.first_name, unsubscribed: data.do_not_contact })
}

// POST — perform the opt-out. Idempotent.
export async function POST(req: Request, { params }: { params: Promise<{ contactId: string }> }) {
  const { contactId } = await params
  if (!UUID_RE.test(contactId)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (!rateLimit(`unsub:${clientIp(req)}`, 20, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('contacts')
    .update({ do_not_contact: true })
    .eq('id', contactId)
    .select('id')
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true, unsubscribed: true })
}
