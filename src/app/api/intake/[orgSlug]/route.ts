import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { captureError } from '@/lib/monitor'
import { notifyNewLead } from '@/lib/notify'

const cap = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')

// Origins allowed to POST cross-origin (the marketing site is a separate
// static host, not part of this Next.js app).
const ALLOWED_ORIGINS = new Set([
  'https://saltaircleaning.com.au',
  'https://www.saltaircleaning.com.au',
])

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : ''
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgSlug: string }> }) {
  const headers = corsHeaders(req.headers.get('origin'))

  // Public endpoint — throttle per IP to blunt lead-spam floods
  if (!rateLimit(`intake:${clientIp(req)}`, 5, 60_000)) {
    return NextResponse.json({ error: 'Too many requests — please try again shortly' }, { status: 429, headers })
  }

  const { orgSlug } = await params
  const raw = await req.json().catch(() => ({}))
  const firstName = cap(raw.firstName ?? raw.first_name, 100)
  const lastName = cap(raw.lastName ?? raw.last_name, 100)
  const phone = cap(raw.phone, 40)
  const email = cap(raw.email, 200)
  const address = cap(raw.address, 300)
  const serviceType = cap(raw.serviceType ?? raw.service, 100)
  const message = cap(raw.message ?? raw.notes, 2000)

  // Extra quote-calculator style fields the website form collects — not core
  // contact fields, so they're folded into custom_fields/notes only.
  const frequency = cap(raw.frequency ?? raw.frequency_other, 100)
  const propertyType = cap(raw.property_type ?? raw.property_type_other, 100)
  const rooms = ['bedrooms', 'bathrooms', 'kitchen', 'powder_rooms', 'laundry', 'office']
    .map(k => [k, raw[k]])
    .filter(([, v]) => v && Number(v) > 0)
    .map(([k, v]) => `${v} ${String(k).replace('_', ' ')}`)
    .join(', ')

  if (!firstName || !phone) {
    return NextResponse.json({ error: 'First name and phone are required' }, { status: 400, headers })
  }

  const supabase = createServiceClient()

  const { data: org } = await supabase
    .from('organisations')
    .select('id')
    .eq('slug', orgSlug)
    .single()
  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404, headers })

  const { data: stage } = await supabase
    .from('pipeline_stages')
    .select('id')
    .eq('org_id', org.id)
    .eq('pipeline_type', 'leads')
    .order('position', { ascending: true })
    .limit(1)
    .maybeSingle()

  const notesParts = [message, propertyType && `Property: ${propertyType}`, rooms && `Rooms: ${rooms}`].filter(Boolean)

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
    custom_fields: { ...(serviceType && { service_type: serviceType }), ...(frequency && { frequency }) },
    notes: notesParts.join('\n') || null,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers })

  // CRM-native notification: email the org's inbox via connected Gmail.
  // Best-effort (never throws) — the lead is already saved.
  await notifyNewLead(org.id, {
    name: [firstName, lastName].filter(Boolean).join(' '),
    phone,
    email,
    address,
    serviceType,
    notes: notesParts.join('\n') || null,
  })

  // Relay the same submission to Formspree so the existing email notification
  // keeps working while the CRM becomes the source of truth. Best-effort —
  // never blocks or fails the lead's success response.
  const formspreeEndpoint = process.env.FORMSPREE_QUOTE_FORM_URL
  if (formspreeEndpoint) {
    try {
      const res = await fetch(formspreeEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(raw),
      })
      if (!res.ok) throw new Error(`Formspree relay returned ${res.status}`)
    } catch (relayError) {
      await captureError(relayError, { source: 'api/intake/[orgSlug] formspree-relay', level: 'warning', orgId: org.id })
    }
  }

  return NextResponse.json({ ok: true }, { headers })
}
