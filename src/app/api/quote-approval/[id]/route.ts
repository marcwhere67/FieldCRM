import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { rateLimit, clientIp } from '@/lib/rate-limit'

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
    .select('id, status, valid_until')
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

  return NextResponse.json({ status: update.status })
}
