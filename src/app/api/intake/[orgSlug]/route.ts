import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { rateLimit, clientIp } from '@/lib/rate-limit'

const cap = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgSlug: string }> }) {
  // Public endpoint — throttle per IP to blunt lead-spam floods
  if (!rateLimit(`intake:${clientIp(req)}`, 5, 60_000)) {
    return NextResponse.json({ error: 'Too many requests — please try again shortly' }, { status: 429 })
  }

  const { orgSlug } = await params
  const raw = await req.json().catch(() => ({}))
  const firstName = cap(raw.firstName, 100)
  const lastName = cap(raw.lastName, 100)
  const phone = cap(raw.phone, 40)
  const email = cap(raw.email, 200)
  const address = cap(raw.address, 300)
  const serviceType = cap(raw.serviceType, 100)
  const message = cap(raw.message, 2000)

  if (!firstName || !phone) {
    return NextResponse.json({ error: 'First name and phone are required' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: org } = await supabase
    .from('organisations')
    .select('id')
    .eq('slug', orgSlug)
    .single()
  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: stage } = await supabase
    .from('pipeline_stages')
    .select('id')
    .eq('org_id', org.id)
    .eq('pipeline_type', 'leads')
    .order('position', { ascending: true })
    .limit(1)
    .maybeSingle()

  const { error } = await supabase.from('contacts').insert({
    org_id: org.id,
    first_name: firstName,
    last_name: lastName,
    phone,
    email: email || null,
    address_line1: address || null,
    status: 'lead',
    source: 'website',
    pipeline_stage_id: stage?.id ?? null,
    custom_fields: serviceType ? { service_type: serviceType } : {},
    notes: message || null,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
